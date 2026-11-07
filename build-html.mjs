// Menggabungkan tampilan (public/) + logika pencarian (lib/) menjadi satu
// file cari-beasiswa.html yang bisa dibuka langsung di browser, tanpa server.
// Jalankan ulang setelah mengubah file di public/, lib/, atau standalone/:
//   node build-html.mjs

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

let html = read("./public/index.html");
const css = read("./public/style.css") + "\n" + read("./standalone/extra.css");
const appJs = read("./public/app.js");
const core = read("./lib/search-core.js").replace(/^export /gm, "");
const standaloneJs = read("./standalone/standalone.js");

const keyButton = `
    <button class="key-btn" id="keyBtn" type="button"><span class="dot"></span><span id="keyState">API key</span></button>`;

// Pakai fungsi sebagai pengganti supaya karakter "$" di kode tidak ditafsirkan.
const swap = (from, to) => {
  if (!html.includes(from)) throw new Error("Penanda tidak ditemukan: " + from);
  html = html.replace(from, () => to);
};
swap('<link rel="stylesheet" href="style.css">', `<style>\n${css}\n</style>`);
swap('<ul class="history" id="history"></ul>', '<ul class="history" id="history"></ul>' + keyButton);
swap('<template id="turnTpl">', read("./standalone/extra.html") + '\n  <template id="turnTpl">');
swap('<script src="app.js"></script>',
  `<script>\n${appJs}\n</script>\n  <script type="module">\n${core}\n${standaloneJs}\n</script>`);

writeFileSync(new URL("./cari-beasiswa.html", import.meta.url), html);
console.log("cari-beasiswa.html dibuat (" + Math.round(html.length / 1024) + " KB)");

// Salinan untuk website (Vercel menyajikan folder dist/ sebagai situs statis).
mkdirSync(new URL("./dist/", import.meta.url), { recursive: true });
writeFileSync(new URL("./dist/index.html", import.meta.url), html);
console.log("dist/index.html dibuat (untuk deploy ke Vercel)");
