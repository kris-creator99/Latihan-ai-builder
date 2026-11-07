// Logika pencarian yang dipakai bersama oleh server.js (Node) dan
// cari-beasiswa.html (langsung di browser). Tidak bergantung pada Node.
//
// runSearch() memanggil Claude dengan web search dan mengirim event ke
// `send(event, data)`: status, query, sources, citation, text, blockend,
// notice, error, done.

export const MODEL = "claude-opus-5-5";
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export const SYSTEM_PROMPT = `Kamu adalah "Cari Beasiswa", mesin pencari info beasiswa untuk pelajar Indonesia, jenjang S1, S2, dan S3 (dalam dan luar negeri).

Cara kerja:
- SELALU gunakan web search untuk mencari info terbaru. Utamakan sumber resmi (situs penyedia beasiswa, kampus, kedutaan, LPDP, Kemdikbud, dsb). Jangan mengandalkan ingatan untuk deadline atau syarat.
- Fokus pada beasiswa yang pendaftarannya masih buka atau akan buka (berdasarkan tanggal hari ini yang diberikan). Kalau periode sudah lewat, sebutkan periode berikutnya yang diperkirakan dan beri tanda.
- Jawab dalam Bahasa Indonesia yang santai tapi jelas.

Format jawaban (Markdown):
1. Satu paragraf ringkasan singkat di awal.
2. Untuk tiap beasiswa, pakai heading "### Nama Beasiswa" lalu bullet:
   - **Jenjang:** S1 / S2 / S3
   - **Negara / kampus:**
   - **Pendanaan:** (penuh/parsial, apa saja yang ditanggung)
   - **Deadline:** (tanggal persis kalau ada; tulis "belum diumumkan" kalau tidak jelas)
   - **Syarat utama:** (IPK, bahasa, usia, dsb, singkat)
   - **Link resmi:** URL
3. Tutup dengan bagian "### Tips" berisi 2-3 tips praktis.
4. Di baris paling akhir, tulis persis satu baris dengan format:
   RELATED: pertanyaan lanjutan 1 | pertanyaan lanjutan 2 | pertanyaan lanjutan 3
   (tiga pertanyaan lanjutan yang relevan, singkat, dalam Bahasa Indonesia).

Kalau info tidak ditemukan atau ragu, katakan terus terang. Jangan mengarang nama beasiswa, nominal, atau tanggal.`;

export function buildUserMessage({ query, levels, region, history }) {
  const today = new Date().toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
  });
  const parts = [`Tanggal hari ini: ${today}.`];
  if (levels?.length) parts.push(`Filter jenjang: ${levels.join(", ")}.`);
  if (region && region !== "semua") {
    parts.push(`Filter lokasi studi: ${region === "dalam" ? "dalam negeri (Indonesia)" : "luar negeri"}.`);
  }
  if (history?.length) {
    // Konteks percakapan sebelumnya dikirim sebagai teks biasa (bukan
    // riwayat pesan), supaya tiap pencarian berdiri sendiri.
    const ctx = history.slice(-3).map((h, i) =>
      `Pertanyaan ${i + 1}: ${h.query}\nRingkasan jawaban: ${String(h.answer).slice(0, 1500)}`
    ).join("\n\n");
    parts.push(`Konteks pencarian sebelumnya:\n${ctx}`);
  }
  parts.push(`Pertanyaan: ${query}`);
  return parts.join("\n\n");
}

// `Anthropic` = kelas SDK (untuk instanceof), `client` = instance-nya.
export async function runSearch({ client, Anthropic, input, send, signal }) {
  const messages = [{ role: "user", content: buildUserMessage(input) }];
  let useFallbacks = true;
  try {
    // Web search bisa membuat giliran "pause_turn"; lanjutkan sampai selesai.
    for (let round = 0; round < 5; round++) {
      const params = {
        model: MODEL,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }],
        messages,
      };
      if (useFallbacks) {
        params.betas = [FALLBACK_BETA];
        params.fallbacks = "default";
      }

      let stream;
      try {
        stream = client.beta.messages.stream(params, { signal });
        await consumeStream(stream, send);
      } catch (err) {
        // Kalau akun belum mendukung server-side fallback, ulangi tanpa itu.
        if (useFallbacks && err instanceof Anthropic.BadRequestError && /fallback/i.test(err.message)) {
          useFallbacks = false;
          round--;
          continue;
        }
        throw err;
      }

      const msg = await stream.finalMessage();
      if (msg.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: msg.content });
        continue;
      }
      if (msg.stop_reason === "refusal") {
        send("error", { message: "Permintaan ini tidak bisa diproses. Coba ubah pertanyaannya." });
      } else if (msg.stop_reason === "max_tokens") {
        send("notice", { message: "Jawaban terpotong karena terlalu panjang. Coba persempit pencarian." });
      }
      break;
    }
    send("done", {});
  } catch (err) {
    if (signal?.aborted) return;
    send("error", { message: friendlyError(err, Anthropic) });
  }
}

async function consumeStream(stream, send) {
  const toolInputs = new Map(); // index -> partial JSON untuk query pencarian
  const textBlocks = new Set();
  for await (const event of stream) {
    switch (event.type) {
      case "content_block_start": {
        const block = event.content_block;
        if (block.type === "server_tool_use" && block.name === "web_search") {
          toolInputs.set(event.index, "");
          send("status", { message: "Mencari di web…" });
        } else if (block.type === "web_search_tool_result") {
          if (Array.isArray(block.content)) {
            send("sources", {
              items: block.content
                .filter((r) => r.type === "web_search_result")
                .map((r) => ({ url: r.url, title: r.title, age: r.page_age || null })),
            });
          }
        } else if (block.type === "text") {
          textBlocks.add(event.index);
          send("status", { message: "Menulis jawaban…" });
        }
        break;
      }
      case "content_block_delta": {
        const d = event.delta;
        if (d.type === "text_delta") send("text", { text: d.text });
        else if (d.type === "citations_delta" && d.citation?.type === "web_search_result_location") {
          send("citation", { url: d.citation.url, title: d.citation.title });
        } else if (d.type === "input_json_delta" && toolInputs.has(event.index)) {
          toolInputs.set(event.index, toolInputs.get(event.index) + d.partial_json);
        }
        break;
      }
      case "content_block_stop": {
        if (textBlocks.delete(event.index)) send("blockend", {});
        if (toolInputs.has(event.index)) {
          try {
            const { query } = JSON.parse(toolInputs.get(event.index) || "{}");
            if (query) send("query", { query });
          } catch { /* input belum lengkap, abaikan */ }
          toolInputs.delete(event.index);
        }
        break;
      }
    }
  }
}

export function friendlyError(err, Anthropic) {
  if (err instanceof Anthropic.AuthenticationError) return "API key Anthropic tidak valid. Cek lagi key-nya.";
  if (err instanceof Anthropic.RateLimitError) return "Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.";
  if (err instanceof Anthropic.APIConnectionError) return "Tidak bisa terhubung ke API. Cek koneksi internet.";
  if (err instanceof Anthropic.APIError) return `Error dari API (${err.status}): ${err.message}`;
  if (/authentication|api.?key/i.test(err?.message || "")) return "API key Anthropic belum diisi.";
  return "Terjadi kesalahan: " + (err?.message || String(err));
}

// Mode demo: jawaban contoh tanpa memanggil API, untuk mencoba tampilan.
export async function demoSearch(send) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  send("status", { message: "Mencari di web…" });
  await wait(400);
  send("query", { query: "contoh pencarian beasiswa" });
  send("sources", { items: [
    { url: "https://example.com/beasiswa-a", title: "Contoh sumber A (mode demo)" },
    { url: "https://example.org/beasiswa-b", title: "Contoh sumber B (mode demo)" },
  ] });
  await wait(400);
  const chunks = [
    "Ini **mode demo**: jawaban contoh, bukan data beasiswa sungguhan.\n\n",
    "### Contoh Beasiswa\n- **Jenjang:** S2\n- **Deadline:** belum diumumkan\n",
    "- **Link resmi:** https://example.com/beasiswa-a\n\n",
    "RELATED: Contoh pertanyaan lanjutan 1 | Contoh pertanyaan lanjutan 2 | Contoh pertanyaan lanjutan 3",
  ];
  for (const [i, c] of chunks.entries()) {
    if (i === 1) send("citation", { url: "https://example.com/beasiswa-a", title: "Contoh sumber A (mode demo)" });
    send("text", { text: c });
    if (i === 1) send("blockend", {});
    await wait(250);
  }
  send("done", {});
}
