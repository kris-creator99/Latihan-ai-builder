# Cari Beasiswa

Search engine beasiswa S1–S3 (dalam dan luar negeri) dengan tampilan ala Perplexity.
Setiap pencarian memakai Claude (`claude-opus-5-5`) plus **web search live**, jadi info deadline dan syarat diambil dari web saat itu juga, lengkap dengan sumber dan nomor sitasi.

## Cara paling gampang: satu file .html

Double-click **`cari-beasiswa.html`**. File ini langsung kebuka di browser, nggak perlu server atau install apa pun.
Pas pertama dibuka, kamu bakal diminta API key Anthropic. Key itu cuma disimpan di browser kamu dan dipakai buat manggil Claude langsung dari situ.
Kalau mau coba tampilannya aja, klik **Coba mode demo**.

Catatan: file ini butuh internet (buat memuat library Claude dari CDN dan buat pencariannya). Jangan bagikan file ini dalam keadaan browser orang lain sudah berisi API key kamu.

Kalau kamu mengubah file di `public/`, `lib/`, atau `standalone/`, buat ulang .html-nya dengan `node build-html.mjs`.

## Cara lain: pakai server lokal

1. Ambil API key di https://platform.claude.com (menu API Keys).
2. Di folder ini (PowerShell):

```powershell
npm install
$env:ANTHROPIC_API_KEY = "sk-ant-..."
npm start
```

3. Buka http://localhost:3000

Mau coba tampilannya dulu tanpa API key? Jalankan mode demo (jawaban contoh, bukan data asli):

```powershell
$env:DEMO = "1"; npm start
```

## Fitur

- Filter jenjang (S1/S2/S3) dan lokasi (dalam/luar negeri)
- Kartu sumber + badge sitasi [1] [2] di dalam jawaban
- Jawaban di-stream secara langsung, kelihatan kata kunci yang sedang dicari
- Pertanyaan terkait + kolom tanya lanjutan
- Riwayat pencarian di sidebar (tersimpan di browser)

## File

- `server.js`: server Node + panggilan Claude API dengan web search, di-stream ke browser (SSE)
- `public/`: tampilan (HTML/CSS/JS polos, tanpa build step)

Biaya: tiap pencarian memakai token Claude ditambah biaya web search (beberapa pencarian per pertanyaan) di akun API kamu.
