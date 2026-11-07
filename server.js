// Cari Beasiswa — server kecil tanpa framework.
// Menyajikan public/ dan endpoint POST /api/search yang men-stream jawaban
// Claude (dengan web search live) ke browser sebagai Server-Sent Events.
// Logika pencarian ada di lib/search-core.js (dipakai juga oleh versi .html).

import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { runSearch, demoSearch } from "./lib/search-core.js";

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = join(fileURLToPath(new URL(".", import.meta.url)), "public");

const client = new Anthropic(); // baca ANTHROPIC_API_KEY dari environment

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

async function handleSearch(req, res) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 200_000) { res.writeHead(413).end(); return; }
  }
  let input;
  try { input = JSON.parse(body); } catch { res.writeHead(400).end("JSON tidak valid"); return; }
  const query = String(input.query || "").trim().slice(0, 500);
  if (!query) { res.writeHead(400).end("Pertanyaan kosong"); return; }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  const abort = new AbortController();
  res.on("close", () => abort.abort());

  try {
    if (process.env.DEMO === "1") await demoSearch(send);
    else await runSearch({ client, Anthropic, input: { ...input, query }, send, signal: abort.signal });
  } finally {
    res.end();
  }
}

async function serveStatic(req, res) {
  const url = new URL(req.url, "http://localhost");
  const rel = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const file = normalize(join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403).end(); return; }
  try {
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404).end("Not found");
  }
}

http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/search") return handleSearch(req, res);
  if (req.method === "GET") return serveStatic(req, res);
  res.writeHead(405).end();
}).listen(PORT, () => {
  console.log(`Cari Beasiswa jalan di http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY && process.env.DEMO !== "1") {
    console.warn("⚠ ANTHROPIC_API_KEY belum di-set — pencarian akan gagal sampai key diisi.");
  }
});
