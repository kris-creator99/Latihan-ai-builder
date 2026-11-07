// Bagian khusus versi .html: memanggil Claude API langsung dari browser
// pakai API key milik pengguna (disimpan di localStorage browser ini saja).
// File ini digabung ke cari-beasiswa.html oleh build-html.mjs, setelah isi
// lib/search-core.js (runSearch, demoSearch sudah tersedia di scope).

const SDK_URL = "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.4.0/+esm";
const KEY_STORE = "cb_api_key";
const DEMO_STORE = "cb_demo";

const store = {
  get: (k) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } },
  set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} },
};

const dlg = document.getElementById("keyDialog");
const keyInput = document.getElementById("keyInput");
const keyBtn = document.getElementById("keyBtn");
const keyState = document.getElementById("keyState");

function refreshKeyState() {
  const key = store.get(KEY_STORE), demo = store.get(DEMO_STORE) === "1";
  keyState.textContent = key ? "API key tersimpan" : demo ? "Mode demo" : "Belum ada API key";
  keyState.dataset.ok = key ? "1" : "";
}
function openKeyDialog() {
  keyInput.value = store.get(KEY_STORE);
  dlg.showModal();
  keyInput.focus();
}
keyBtn.addEventListener("click", openKeyDialog);
document.getElementById("keySave").addEventListener("click", (e) => {
  e.preventDefault();
  const v = keyInput.value.trim();
  store.set(KEY_STORE, v);
  if (v) store.set(DEMO_STORE, "");
  client = null;
  refreshKeyState();
  dlg.close();
});
document.getElementById("keyDemo").addEventListener("click", (e) => {
  e.preventDefault();
  store.set(DEMO_STORE, "1");
  store.set(KEY_STORE, "");
  client = null;
  refreshKeyState();
  dlg.close();
});
document.getElementById("keyCancel").addEventListener("click", (e) => { e.preventDefault(); dlg.close(); });

let AnthropicClass = null, client = null;
async function getClient(key) {
  if (!AnthropicClass) {
    try {
      AnthropicClass = (await import(SDK_URL)).default;
    } catch {
      throw new Error("Gagal memuat library Claude dari internet. Cek koneksi lalu coba lagi.");
    }
  }
  if (!client) client = new AnthropicClass({ apiKey: key, dangerouslyAllowBrowser: true });
  return client;
}

window.CB_TRANSPORT = async (input, send, signal) => {
  if (store.get(DEMO_STORE) === "1") return demoSearch(send);
  const key = store.get(KEY_STORE);
  if (!key) {
    openKeyDialog();
    throw new Error("Isi API key Anthropic dulu (atau pilih mode demo), lalu cari lagi.");
  }
  const c = await getClient(key);
  await runSearch({ client: c, Anthropic: AnthropicClass, input, send, signal });
};

refreshKeyState();
if (!store.get(KEY_STORE) && store.get(DEMO_STORE) !== "1") openKeyDialog();
