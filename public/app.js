// Cari Beasiswa — frontend
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const home = $("#home"), thread = $("#thread"), followForm = $("#followForm");
  const homeForm = $("#homeForm"), homeInput = $("#homeInput"), followInput = $("#followInput");
  const regionSel = $("#region"), historyEl = $("#history");

  const SUGGESTIONS = [
    "Beasiswa S1 dalam negeri yang buka sekarang",
    "LPDP 2027: jadwal dan syarat terbaru",
    "Beasiswa S2 full funding ke Jepang",
    "Beasiswa S3 riset AI di Eropa",
    "Beasiswa S2 tanpa IELTS",
    "Chevening vs Australia Awards",
  ];

  // ---- State ---------------------------------------------------------------
  let sessions = load();            // [{id, turns:[{query, levels, region, answer, sources}]}]
  let current = null;               // session aktif
  let busy = false;
  let ctl = null;

  function load() {
    try { return JSON.parse(localStorage.getItem("cb_sessions") || "[]"); } catch { return []; }
  }
  function save() {
    try { localStorage.setItem("cb_sessions", JSON.stringify(sessions.slice(0, 30))); } catch {}
  }

  // ---- Filters -------------------------------------------------------------
  document.querySelectorAll(".chip").forEach((c) =>
    c.addEventListener("click", () => c.classList.toggle("on")));
  const getLevels = () => [...document.querySelectorAll(".chip.on")].map((c) => c.dataset.value);

  // ---- Suggestions ---------------------------------------------------------
  const sugEl = $("#suggestions");
  SUGGESTIONS.forEach((s) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = s;
    b.onclick = () => { homeInput.value = s; homeForm.requestSubmit(); };
    sugEl.append(b);
  });

  homeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); homeForm.requestSubmit(); }
  });
  homeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = homeInput.value.trim();
    if (!q || busy) return;
    current = { id: Date.now(), turns: [] };
    sessions.unshift(current);
    showThread();
    thread.innerHTML = "";
    ask(q, getLevels(), regionSel.value);
  });
  followForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = followInput.value.trim();
    if (!q || busy) return;
    followInput.value = "";
    const last = current.turns.at(-1) || {};
    ask(q, last.levels || [], last.region || "semua");
  });
  $("#newBtn").onclick = goHome;

  function goHome() {
    ctl?.abort();
    current = null;
    home.hidden = false; thread.hidden = true; followForm.hidden = true;
    homeInput.value = ""; homeInput.focus();
    renderHistory();
  }
  function showThread() {
    home.hidden = true; thread.hidden = false; followForm.hidden = false;
  }

  // ---- History sidebar -----------------------------------------------------
  function renderHistory() {
    historyEl.innerHTML = "";
    sessions.filter((s) => s.turns.length).forEach((s) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.textContent = s.turns[0].query;
      b.title = s.turns[0].query;
      if (s === current) b.classList.add("active");
      b.onclick = () => openSession(s);
      li.append(b); historyEl.append(li);
    });
  }
  function openSession(s) {
    if (busy) ctl?.abort();
    current = s;
    showThread();
    thread.innerHTML = "";
    s.turns.forEach((t) => {
      const el = makeTurn(t);
      renderSources(el, t.sources);
      $(".status", el).hidden = true;
      finishAnswer(el, t.answer, t.sources);
    });
    renderHistory();
  }

  // ---- Turn rendering ------------------------------------------------------
  function makeTurn(t) {
    const el = $("#turnTpl").content.firstElementChild.cloneNode(true);
    $(".question", el).textContent = t.query;
    const tags = $(".tags", el);
    const labels = [...(t.levels || [])];
    if (t.region === "dalam") labels.push("Dalam negeri");
    if (t.region === "luar") labels.push("Luar negeri");
    labels.forEach((l) => { const s = document.createElement("span"); s.textContent = l; tags.append(s); });
    thread.append(el);
    return el;
  }

  function domainOf(url) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } }

  function renderSources(el, sources) {
    const box = $(".sources", el);
    box.innerHTML = "";
    box.classList.toggle("empty", !sources.length);
    if (!sources.length) { box.textContent = "Belum ada sumber."; return; }
    const MAX = 3;
    const shown = sources.length > 4 ? sources.slice(0, MAX) : sources;
    shown.forEach((s, i) => box.append(sourceCard(s, i + 1)));
    if (sources.length > 4) {
      const more = document.createElement("button");
      more.type = "button"; more.className = "source more";
      more.innerHTML = `<span class="t">+${sources.length - MAX} sumber lainnya</span><span class="d"></span>`;
      const icons = $(".d", more);
      sources.slice(MAX, MAX + 5).forEach((s) => icons.append(favicon(s.url)));
      more.onclick = () => { box.innerHTML = ""; sources.forEach((s, i) => box.append(sourceCard(s, i + 1))); };
      box.append(more);
    }
  }
  function favicon(url) {
    const img = document.createElement("img");
    img.alt = ""; img.loading = "lazy";
    img.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domainOf(url))}&sz=32`;
    img.onerror = () => img.remove();
    return img;
  }
  function sourceCard(s, n) {
    const a = document.createElement("a");
    a.className = "source"; a.href = s.url; a.target = "_blank"; a.rel = "noopener noreferrer";
    a.title = s.title || s.url;
    const t = document.createElement("span"); t.className = "t"; t.textContent = s.title || s.url;
    const d = document.createElement("span"); d.className = "d";
    d.append(favicon(s.url), document.createTextNode(domainOf(s.url)));
    const num = document.createElement("span"); num.className = "n"; num.textContent = n;
    d.append(num);
    a.append(t, d);
    return a;
  }

  // ---- Search --------------------------------------------------------------
  async function ask(query, levels, region) {
    busy = true; setBusy(true);
    const turn = { query, levels, region, answer: "", sources: [] };
    const el = makeTurn(turn);
    el.scrollIntoView({ behavior: "smooth", block: "start" });

    const statusEl = $(".status", el), statusText = $(".status-text", el);
    const queriesEl = $(".queries", el), answerEl = $(".answer", el);
    const srcIndex = new Map();
    let pendingCites = [];
    let gotSources = false;

    const addSource = (s) => {
      if (srcIndex.has(s.url)) return srcIndex.get(s.url);
      turn.sources.push({ url: s.url, title: s.title });
      srcIndex.set(s.url, turn.sources.length);
      return turn.sources.length;
    };
    let raf = 0;
    const paint = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        answerEl.innerHTML = renderMarkdown(stripRelated(turn.answer), turn.sources);
      });
    };

    const history = current.turns.map((t) => ({ query: t.query, answer: stripRelated(t.answer) }));
    ctl = new AbortController();
    const onEvent = (ev, data) => {
      switch (ev) {
        case "status": statusText.textContent = data.message; break;
        case "query": {
          const s = document.createElement("span"); s.textContent = data.query; queriesEl.append(s); break;
        }
        case "sources":
          data.items.forEach(addSource);
          gotSources = true;
          renderSources(el, turn.sources);
          break;
        case "citation": {
          const n = addSource(data);
          if (!pendingCites.includes(n)) pendingCites.push(n);
          break;
        }
        case "blockend":
          if (pendingCites.length) {
            // Sisipkan badge sebelum spasi/baris baru di akhir teks agar tetap menempel ke kalimatnya.
            const marks = pendingCites.map((n) => `\u0001${n}\u0002`).join("");
            const m = /\s*$/.exec(turn.answer);
            turn.answer = turn.answer.slice(0, m.index) + marks + m[0];
            pendingCites = [];
            renderSources(el, turn.sources);
            paint();
          }
          break;
        case "text":
          statusEl.hidden = true;
          turn.answer += data.text;
          paint();
          break;
        case "notice": addNotice(el, data.message, false); break;
        case "error": addNotice(el, data.message, true); break;
      }
    };
    try {
      await (window.CB_TRANSPORT || serverTransport)({ query, levels, region, history }, onEvent, ctl.signal);
    } catch (err) {
      if (err.name !== "AbortError") addNotice(el, "Gagal: " + err.message, true);
    } finally {
      statusEl.hidden = true;
      if (!gotSources && !turn.sources.length) renderSources(el, []);
      finishAnswer(el, turn.answer, turn.sources);
      if (turn.answer) { current.turns.push(turn); save(); renderHistory(); }
      busy = false; setBusy(false);
      followInput.focus();
    }
  }

  // Transport default: server lokal (server.js) lewat Server-Sent Events.
  async function serverTransport(payload, onEvent, signal) {
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
    if (!res.ok || !res.body) throw new Error(await res.text() || `HTTP ${res.status}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const frame = buf.slice(0, idx); buf = buf.slice(idx + 2);
        const ev = /^event: (.+)$/m.exec(frame)?.[1];
        const dataLine = /^data: (.*)$/m.exec(frame)?.[1];
        if (ev && dataLine != null) onEvent(ev, JSON.parse(dataLine));
      }
    }
  }

  function setBusy(b) {
    document.querySelectorAll(".send").forEach((x) => (x.disabled = b));
  }
  function addNotice(el, msg, isErr) {
    const n = document.createElement("div");
    n.className = "notice" + (isErr ? " err" : "");
    n.textContent = msg;
    $(".answer", el).after(n);
  }

  function finishAnswer(el, answer, sources) {
    $(".answer", el).innerHTML = renderMarkdown(stripRelated(answer), sources);
    const rel = parseRelated(answer);
    const wrap = $(".related-wrap", el), list = $(".related", el);
    list.innerHTML = "";
    rel.forEach((q) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button"; b.textContent = q;
      b.onclick = () => {
        if (busy) return;
        const last = current.turns.at(-1) || {};
        ask(q, last.levels || [], last.region || "semua");
      };
      li.append(b); list.append(li);
    });
    wrap.hidden = !rel.length;
  }

  // ---- Related questions ---------------------------------------------------
  function stripRelated(text) {
    const i = text.search(/(^|\n)\s*RELATED:/);
    return i === -1 ? text : text.slice(0, i);
  }
  function parseRelated(text) {
    const m = /(?:^|\n)\s*RELATED:\s*(.+)/.exec(text);
    if (!m) return [];
    return m[1].replace(/\u0001\d+\u0002/g, "").split("|").map((s) => s.trim()).filter(Boolean).slice(0, 4);
  }

  // ---- Mini markdown renderer ---------------------------------------------
  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function safeUrl(u) {
    return /^https?:\/\//i.test(u) ? u : "#";
  }
  function inline(s, sources) {
    let h = esc(s);
    h = h.replace(/`([^`]+)`/g, "<code>$1</code>");
    h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      (_, t, u) => `<a href="${safeUrl(u)}" target="_blank" rel="noopener noreferrer">${t}</a>`);
    h = h.replace(/(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,;:])/g,
      (_, p, u) => `${p}<a href="${safeUrl(u)}" target="_blank" rel="noopener noreferrer">${u}</a>`);
    h = h.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    h = h.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
    h = h.replace(/\u0001(\d+)\u0002/g, (_, n) => {
      const s = sources[n - 1];
      if (!s) return "";
      return `<a class="cite" href="${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer" title="${esc(s.title || s.url)}">${n}</a>`;
    });
    return h;
  }
  function renderMarkdown(md, sources) {
    const lines = md.replace(/\r/g, "").split("\n");
    let html = "", list = null, para = [];
    const flushPara = () => { if (para.length) { html += `<p>${inline(para.join(" "), sources)}</p>`; para = []; } };
    const closeList = () => { if (list) { html += `</${list}>`; list = null; } };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let m;
      if (!line.trim()) { flushPara(); closeList(); continue; }
      if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) {
        flushPara(); closeList();
        const lvl = Math.min(Math.max(m[1].length, 3), 4);
        html += `<h${lvl}>${inline(m[2], sources)}</h${lvl}>`;
        continue;
      }
      if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(lines[i + 1] || "")) {
        flushPara(); closeList();
        const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        html += "<table><thead><tr>" + cells(line).map((c) => `<th>${inline(c, sources)}</th>`).join("") + "</tr></thead><tbody>";
        i += 2;
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
          html += "<tr>" + cells(lines[i]).map((c) => `<td>${inline(c, sources)}</td>`).join("") + "</tr>";
          i++;
        }
        i--;
        html += "</tbody></table>";
        continue;
      }
      if ((m = /^\s*[-*•]\s+(.*)$/.exec(line)) || (m = /^\s*\d+[.)]\s+(.*)$/.exec(line))) {
        flushPara();
        const type = /^\s*\d/.test(line) ? "ol" : "ul";
        if (list !== type) { closeList(); html += `<${type}>`; list = type; }
        html += `<li>${inline(m[1], sources)}</li>`;
        continue;
      }
      if (/^---+$/.test(line.trim())) { flushPara(); closeList(); continue; }
      closeList();
      para.push(line.trim());
    }
    flushPara(); closeList();
    return html;
  }

  renderHistory();
  homeInput.focus();
})();
