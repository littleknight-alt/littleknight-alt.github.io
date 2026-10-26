import * as pdfjsLib from "./pdf.min.mjs";

/* =========================================================
   Security posture
   - pdf.js and pdf-lib are served from this site's own origin (no CDN).
   - PDF scripting / XFA forms are never run (enableXfa:false, no scripting sandbox shipped).
   - A strict Content-Security-Policy (index.html) allows network access only to this site and,
     when the person turns sync on, to Google sign-in and the Google Drive API.
   - Google access is limited to the drive.appdata scope: a hidden folder only this app can see.
     Gmail and every other Drive file stay out of reach. The access token lives in this tab only.
   - Notes are always saved in this browser (IndexedDB) first; Drive is a mirror.
   - User text is only ever written with textContent.
   ========================================================= */
const asset = (p) => new URL(p, document.baseURI).href;
const b64ToBytes = (s) => { const bin = atob(s.trim()), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };

/* The pdf.js worker is a plain file on this site. */
pdfjsLib.GlobalWorkerOptions.workerSrc = asset("pdf.worker.min.mjs");
/* pdf-lib (PDF export) also ships with the page and loads only when the first export starts. */
let pdfLibReady = null;
function loadPdfLib() {
  pdfLibReady ||= new Promise((res, rej) => {
    if (window.PDFLib) { res(window.PDFLib); return; }
    const s = document.createElement("script");
    s.src = asset("pdf-lib.min.js");
    s.onload = () => window.PDFLib ? res(window.PDFLib) : rej(new Error("pdf-lib missing"));
    s.onerror = () => rej(new Error("pdf-lib load"));
    document.head.append(s);
  });
  pdfLibReady.catch(() => { pdfLibReady = null; });
  return pdfLibReady;
}

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

/* ---------- icons (static, authored here) ---------- */
const I = {
  pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 18v-6m-3 3 3 3 3-3"/></svg>',
  blank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M12 9v6M9 12h6"/></svg>',
  folderPlus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 10.5v5M9.5 13h5"/></svg>',
  backup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M3 4h18v3H3zM10 11h4"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 5 6v5c0 4.4 3 8.3 7 9.5 4-1.2 7-5.1 7-9.5V6z"/><path d="m9 12 2 2 4-4"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4.5 4.5L19 7"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 4 2.8 20h18.4z"/><path d="M12 10v4m0 3v.01"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1.2-4.6L16.6 4a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z"/><path d="m14.5 6 3.5 3.5"/></svg>',
  hl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m9 15 7.5-11 4 2.8L13 18z"/><path d="M9 15 7 19l4 .8 2-1.8"/><path d="M3 21h8" stroke-width="3" opacity=".55"/></svg>',
  er: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 20 3.6 15a2 2 0 0 1 0-2.8L12.8 3a2 2 0 0 1 2.8 0l4.6 4.6a2 2 0 0 1 0 2.8L10.5 20z"/><path d="M8.5 20H20M7 10l7 7"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
  redo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/></svg>',
  zin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5M11 8v6M8 11h6"/></svg>',
  zout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5M8 11h6"/></svg>',
  addp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M12 9v6M9 12h6"/></svg>',
  pages: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="8" rx="1.2"/><rect x="13.5" y="3.5" width="7" height="8" rx="1.2"/><rect x="3.5" y="14" width="7" height="6.5" rx="1.2"/><rect x="13.5" y="14" width="7" height="6.5" rx="1.2"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3m-4 4 4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 14 6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 10 6 6 6-6"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
  hand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5V4.5a1.5 1.5 0 0 1 3 0V11m0-4.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.6a6 6 0 0 1-4.6-2.2L3.6 15a1.6 1.6 0 0 1 2.4-2.1L9 15.5V8a1.5 1.5 0 0 1 3 0"/></svg>',
};
const setBtn = (id, icon, label) => { const b = $(id); b.innerHTML = I[icon]; if (label) b.append(document.createTextNode(label)); };
setBtn("openPdfBtn", "pdf", "PDFを開く");
setBtn("newBlankBtn", "blank", "白紙ノート");
setBtn("newFolderBtn", "folderPlus", "フォルダ");
setBtn("backupBtn", "backup", "バックアップ");
setBtn("libBack", "back", "ノート");
$("safetyLead").innerHTML = I.shield; $("safetyLead").append("安全設計");
setBtn("backBtn", "back", "ノート");
$("tPen").innerHTML = I.pen; $("tHl").innerHTML = I.hl; $("tEr").innerHTML = I.er;
$("undoBtn").innerHTML = I.undo; $("redoBtn").innerHTML = I.redo;
$("zIn").innerHTML = I.zin; $("zOut").innerHTML = I.zout;
setBtn("pagesBtn", "pages", "ページ一覧");
setBtn("searchBtn", "search", "検索");
$("libSearchIcon").outerHTML = I.search; $("drSearchIcon").outerHTML = I.search;
setBtn("addPageBtn", "addp", "ページ追加");
setBtn("exportBtn", "share", "PDF書き出し");
setBtn("fingerBtn", "hand", "指で書く");
$("drClose").innerHTML = I.close;
setBtn("drAdd", "addp", "最後にページを追加");

/* ---------- folders: drawn bare, no card behind them ---------- */
const FOLDER_COLORS = ["#3d6fd8", "#2f8fbf", "#2f9c95", "#4a9d4f", "#93a332", "#e0a526", "#e07b2c", "#d4483b", "#d2457f", "#9353c9", "#5b5fc7", "#6b7b8c"];
function folderSvg(color) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 120 92"); svg.setAttribute("aria-hidden", "true");
  const back = document.createElementNS(svg.namespaceURI, "path");
  back.setAttribute("d", "M6 14a8 8 0 0 1 8-8h28c3 0 5 1.2 6.6 3.4L53 15h53a8 8 0 0 1 8 8v58a8 8 0 0 1-8 8H14a8 8 0 0 1-8-8z");
  back.setAttribute("fill", color); back.setAttribute("opacity", ".72");
  const paper = document.createElementNS(svg.namespaceURI, "rect");
  paper.setAttribute("x", "16"); paper.setAttribute("y", "22"); paper.setAttribute("width", "88"); paper.setAttribute("height", "40"); paper.setAttribute("rx", "3"); paper.setAttribute("fill", "#fff"); paper.setAttribute("opacity", ".92");
  const front = document.createElementNS(svg.namespaceURI, "path");
  front.setAttribute("d", "M6 34a8 8 0 0 1 8-8h92a8 8 0 0 1 8 8v47a8 8 0 0 1-8 8H14a8 8 0 0 1-8-8z");
  front.setAttribute("fill", color);
  const shine = document.createElementNS(svg.namespaceURI, "path");
  shine.setAttribute("d", "M14 26h92a8 8 0 0 1 8 8v3H6v-3a8 8 0 0 1 8-8z"); shine.setAttribute("fill", "#fff"); shine.setAttribute("opacity", ".16");
  svg.append(back, paper, front, shine);
  return svg;
}

/* ---------- small helpers ---------- */
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmtDate = (t) => { const d = new Date(t); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; };
const fmtMB = (b) => (b / 1048576).toFixed(b < 10485760 ? 1 : 0) + " MB";
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
let toastTimer;
function toast(msg, ms = 2600) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms); }
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* ---------- storage (IndexedDB, this browser only) ---------- */
const DB_NAME = "simple-pdf-note";
let dbPromise = null;
function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((res, rej) => {
    let r;
    try { r = indexedDB.open(DB_NAME, 4); } catch (e) { rej(e); return; }
    r.onupgradeneeded = () => { const d = r.result; for (const s of ["notes", "pdfs", "ink", "thumbs", "folders", "texts", "sync"]) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error("blocked"));
  });
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}
async function tx(store, mode, fn) {
  const d = await openDB();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode); const req = fn(t.objectStore(store)); let out;
    if (req) req.onsuccess = () => { out = req.result; };
    t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error("abort"));
  });
}
const getFolders = async () => (await idb.all("folders")).filter(f => !f.deleted);
const idb = {
  get: (s, k) => tx(s, "readonly", st => st.get(k)),
  put: (s, k, v) => tx(s, "readwrite", st => st.put(v, k)),
  del: (s, k) => tx(s, "readwrite", st => st.delete(k)),
  all: (s) => tx(s, "readonly", st => st.getAll()),
};
let persistAsked = false;
function askPersist() { if (persistAsked) return; persistAsked = true; try { navigator.storage?.persist?.().catch(() => {}); } catch {} }

/* ---------- pdf.js ---------- */
/* Character maps and fonts ship with this site as two JSON bundles; this loader reads only those
   same-origin files, so pdf.js never reaches the network on its own. */
const bundles = {};
function bundle(name) {
  bundles[name] ||= fetch(asset(name)).then(r => { if (!r.ok) throw new Error(name + " " + r.status); return r.json(); });
  bundles[name].catch(() => { delete bundles[name]; });
  return bundles[name];
}
class LocalDataFactory {
  constructor() {}
  async fetch({ kind, filename }) {
    if (!/^[A-Za-z0-9._-]+$/.test(filename)) throw new Error("bad asset request");
    if (kind === "wasmUrl") {
      const r = await fetch(asset(filename)); if (!r.ok) throw new Error("asset " + r.status);
      return new Uint8Array(await r.arrayBuffer());
    }
    const b = await bundle(kind === "cMapUrl" ? "cmaps.json" : "fonts.json");
    if (typeof b[filename] !== "string") throw new Error("missing " + filename);
    return b64ToBytes(b[filename]);
  }
}
async function loadPdf(bytes) {
  return pdfjsLib.getDocument({
    data: new Uint8Array(bytes.slice(0)),   // copy: pdf.js may transfer the buffer to its worker
    cMapUrl: asset("./"), cMapPacked: true,
    standardFontDataUrl: asset("./"),
    wasmUrl: asset("./"),
    BinaryDataFactory: LocalDataFactory, useWorkerFetch: false,
    enableXfa: false,                        // never build XFA forms
    stopAtErrors: false,
  }).promise;
}
function looksLikePdf(buf) {
  const head = new Uint8Array(buf, 0, Math.min(1024, buf.byteLength));
  for (let i = 0; i < head.length - 4; i++) if (head[i] === 37 && head[i + 1] === 80 && head[i + 2] === 68 && head[i + 3] === 70) return true; // %PDF
  return false;
}

/* ---------- page backgrounds ---------- */
const A4 = { w: 595.28, h: 841.89 };
const TPL = { plain: "白紙", ruled: "罫線", grid: "方眼", dots: "ドット" };
function drawTemplate(ctx, tpl, w, h, k) {
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w * k, h * k);
  if (tpl === "ruled") {
    ctx.strokeStyle = "#bccadb"; ctx.lineWidth = Math.max(1, 0.7 * k);
    for (let y = 72; y < h - 30; y += 26) { const yy = Math.round(y * k) + .5; ctx.beginPath(); ctx.moveTo(28 * k, yy); ctx.lineTo((w - 28) * k, yy); ctx.stroke(); }
    ctx.strokeStyle = "#e6b4b4"; ctx.beginPath(); ctx.moveTo(64 * k, 40 * k); ctx.lineTo(64 * k, (h - 30) * k); ctx.stroke();
  } else if (tpl === "grid") {
    ctx.strokeStyle = "#d3dbe5"; ctx.lineWidth = Math.max(1, 0.5 * k);
    for (let x = 18; x < w; x += 18) { const xx = Math.round(x * k) + .5; ctx.beginPath(); ctx.moveTo(xx, 0); ctx.lineTo(xx, h * k); ctx.stroke(); }
    for (let y = 18; y < h; y += 18) { const yy = Math.round(y * k) + .5; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w * k, yy); ctx.stroke(); }
  } else if (tpl === "dots") {
    ctx.fillStyle = "#a9b8ca"; const r = Math.max(.8, .95 * k);
    for (let y = 18; y < h; y += 18) for (let x = 18; x < w; x += 18) { ctx.beginPath(); ctx.arc(x * k, y * k, r, 0, 6.2832); ctx.fill(); }
  }
}

/* ---------- ink ---------- */
const pw = (p) => 0.35 + 0.9 * p;
function segOf(P, n, j) {
  const x = P[j * 3], y = P[j * 3 + 1];
  let sx, sy, ex, ey;
  if (j === 0) { sx = x; sy = y; } else { sx = (P[j * 3 - 3] + x) / 2; sy = (P[j * 3 - 2] + y) / 2; }
  if (j === n - 1) { ex = x; ey = y; } else { ex = (x + P[j * 3 + 3]) / 2; ey = (y + P[j * 3 + 4]) / 2; }
  return [sx, sy, x, y, ex, ey];
}
function penSeg(ctx, P, n, j, w, k) {
  const [sx, sy, x, y, ex, ey] = segOf(P, n, j);
  ctx.lineWidth = Math.max(0.5, w * pw(P[j * 3 + 2]) * k);
  ctx.beginPath(); ctx.moveTo(sx * k, sy * k); ctx.quadraticCurveTo(x * k, y * k, ex * k + 0.001, ey * k); ctx.stroke();
}
function drawStroke(ctx, s, k) {
  const P = s.p, n = P.length / 3; if (!n) return;
  ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = s.c;
  if (s.t === "hl") {
    ctx.globalAlpha = .34; ctx.globalCompositeOperation = "multiply"; ctx.lineWidth = s.w * k;
    ctx.beginPath(); ctx.moveTo(P[0] * k, P[1] * k);
    if (n === 1) ctx.lineTo(P[0] * k + .01, P[1] * k);
    for (let i = 1; i < n - 1; i++) { const x = P[i * 3], y = P[i * 3 + 1]; ctx.quadraticCurveTo(x * k, y * k, (x + P[i * 3 + 3]) / 2 * k, (y + P[i * 3 + 4]) / 2 * k); }
    if (n > 1) ctx.lineTo(P[(n - 1) * 3] * k, P[(n - 1) * 3 + 1] * k);
    ctx.stroke();
  } else {
    for (let j = 0; j < n; j++) penSeg(ctx, P, n, j, s.w, k);
  }
  ctx.restore();
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0; t = clamp(t, 0, 1);
  const x = ax + t * dx - px, y = ay + t * dy - py; return Math.sqrt(x * x + y * y);
}
function hitStroke(s, x, y, r) {
  const P = s.p, n = P.length / 3, rr = r + s.w / 2;
  if (n === 1) return Math.hypot(P[0] - x, P[1] - y) <= rr;
  for (let i = 0; i < n - 1; i++) if (segDist(x, y, P[i * 3], P[i * 3 + 1], P[i * 3 + 3], P[i * 3 + 4]) <= rr) return true;
  return false;
}

/* ---------- page pictures (library covers and the page drawer) ---------- */
async function pageCanvas(p, W, doc, strokes) {
  const k = W / p.w, H = Math.max(1, Math.round(p.h * k));
  const c = document.createElement("canvas"); c.width = W; c.height = H; const ctx = c.getContext("2d");
  if (p.src === "pdf" && doc) {
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    const page = await doc.getPage(p.n);
    await page.render({ canvasContext: ctx, viewport: page.getViewport({ scale: k }) }).promise;
  } else drawTemplate(ctx, p.tpl || "plain", p.w, p.h, k);
  for (const s of (strokes || [])) drawStroke(ctx, s, k);
  return c;
}
const canvasBlob = (c, q = .82) => new Promise(r => c.toBlob(r, "image/jpeg", q));
async function renderThumb(note, ink, doc) {
  const p = note.pages[0]; if (!p) return;
  try {
    const c = await pageCanvas(p, 300, doc, ink?.[p.id]);
    const blob = await canvasBlob(c); c.width = c.height = 0;
    if (blob) await idb.put("thumbs", note.id, blob);
  } catch (e) { console.warn("thumb", e); }
}

/* =========================================================
   Search: PDF text is read once per note and kept in this browser
   ========================================================= */
async function extractTexts(doc) {
  const pages = {};
  for (let i = 1; i <= doc.numPages; i++) {
    try {
      const tc = await (await doc.getPage(i)).getTextContent();
      let t = ""; for (const it of tc.items) { if (typeof it.str === "string") t += it.str; if (it.hasEOL) t += "\n"; }
      pages[i] = t.slice(0, 200000);
    } catch { pages[i] = ""; }
  }
  return { v: 1, pages };
}
const normQ = (q) => q.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
function normMap(raw) {
  let s = ""; const map = [];
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i].normalize("NFKC").toLowerCase();
    if (/^\s+$/.test(c)) continue;
    for (const ch of c) { s += ch; map.push(i); }
  }
  return { s, map };
}
const normCache = new Map();   // noteId -> { pages: { n: {s,map,raw} } }
async function normFor(noteId, texts) {
  let c = normCache.get(noteId); if (c) return c;
  texts ||= await idb.get("texts", noteId).catch(() => null);
  if (!texts) return null;
  c = { pages: {} };
  for (const [n, raw] of Object.entries(texts.pages || {})) c.pages[n] = { raw, ...normMap(raw) };
  normCache.set(noteId, c); return c;
}
function findIn(entry, q) {
  const hits = []; let i = entry.s.indexOf(q);
  while (i >= 0 && hits.length < 50) { hits.push(i); i = entry.s.indexOf(q, i + q.length); }
  return hits;
}
function snippetEl(entry, idx, qlen) {
  const raw = entry.raw, start = entry.map[idx], end = entry.map[idx + qlen - 1] + 1;
  const a = Math.max(0, start - 26), b = Math.min(raw.length, end + 46);
  const clean = (t) => t.replace(/\s+/g, " ");
  const sn = el("span", "sn");
  sn.append(document.createTextNode((a > 0 ? "…" : "") + clean(raw.slice(a, start))), el("mark", null, clean(raw.slice(start, end))), document.createTextNode(clean(raw.slice(end, b)) + (b < raw.length ? "…" : "")));
  return sn;
}
/* Notes added before search existed get their text read the first time someone searches. */
let indexing = null;
function ensureIndexed(onProgress) {
  indexing ||= (async () => {
    const notes = (await idb.all("notes")).filter(n => n.kind === "pdf");
    const missing = [];
    for (const n of notes) if (!(await idb.get("texts", n.id))) missing.push(n);
    let done = 0;
    for (const n of missing) {
      onProgress?.(done, missing.length);
      let doc = null;
      try { const bytes = await idb.get("pdfs", n.id); if (bytes) { doc = await loadPdf(bytes); await idb.put("texts", n.id, await extractTexts(doc)); } }
      catch (e) { console.warn("index", e); }
      finally { try { await doc?.destroy(); } catch {} }
      done++;
    }
    return missing.length;
  })();
  indexing.finally(() => { indexing = null; });
  return indexing;
}

/* =========================================================
   Library
   ========================================================= */
let thumbUrls = [];
let storageOk = true;
let libFolder = null;                 // null = top level
async function renderLibrary() {
  let notes = [], folders = [];
  try { notes = await idb.all("notes"); folders = await getFolders(); storageOk = true; }
  catch (e) { storageOk = false; }
  const banner = $("libBanner");
  if (!storageOk) {
    banner.hidden = false; banner.className = "banner bad";
    banner.textContent = "このブラウザでは保存領域が使えないため、ノートを保存できません。プライベートブラウズを使っている場合は通常の画面で開いてください。";
  } else banner.hidden = true;

  const fmap = new Map(folders.map(f => [f.id, f]));
  if (libFolder && !fmap.has(libFolder)) libFolder = null;
  const cur = libFolder ? fmap.get(libFolder) : null;
  folders.sort((a, b) => a.name.localeCompare(b.name, "ja"));
  notes.sort((a, b) => b.updated - a.updated);
  const inFolder = (n) => n.folder && fmap.has(n.folder);
  const shownNotes = cur ? notes.filter(n => n.folder === cur.id) : notes.filter(n => !inFolder(n));
  const shownFolders = cur ? [] : folders;

  $("libTitle").textContent = cur ? cur.name : "ノート";
  $("libBack").hidden = !cur;
  $("newFolderBtn").hidden = !!cur;
  const parts = [];
  if (shownFolders.length) parts.push(`フォルダ ${shownFolders.length}`);
  if (shownNotes.length) parts.push(`ノート ${shownNotes.length}冊`);
  $("libCount").textContent = parts.join(" · ") || " ";

  thumbUrls.forEach(u => URL.revokeObjectURL(u)); thumbUrls = [];
  const grid = $("grid"); grid.replaceChildren();
  const empty = $("empty");
  empty.hidden = !storageOk || shownNotes.length + shownFolders.length > 0 || libSearchActive();
  if (libSearchActive()) { runLibSearch(); }
  empty.textContent = cur ? "このフォルダは空です。ここで「PDFを開く」か「白紙ノート」を押すと、このフォルダに入ります。" : "まだノートがありません。「PDFを開く」か「白紙ノート」から始めましょう。";

  for (const f of shownFolders) {
    const count = notes.filter(n => n.folder === f.id).length;
    const wrap = el("div", "card-wrap");
    const card = el("button", "card"); card.type = "button"; card.setAttribute("aria-label", `フォルダ ${f.name}`);
    const fc = el("div", "fcover"); fc.append(folderSvg(f.color));
    card.append(fc, el("div", "t", f.name), el("div", "m", `${count}冊`));
    card.addEventListener("click", () => { libFolder = f.id; renderLibrary(); scrollTo(0, 0); });
    const more = el("button", "more on-folder"); more.type = "button"; more.innerHTML = I.more; more.setAttribute("aria-label", `${f.name} のメニュー`);
    more.addEventListener("click", (e) => { e.stopPropagation(); folderMenu(f, count); });
    wrap.append(card, more); grid.append(wrap);
  }
  for (const n of shownNotes) {
    const wrap = el("div", "card-wrap");
    const card = el("button", "card"); card.type = "button";
    const cover = el("div", "cover");
    let blob = null; try { blob = await idb.get("thumbs", n.id); } catch {}
    if (blob) { const u = URL.createObjectURL(blob); thumbUrls.push(u); const img = el("img"); img.alt = ""; img.src = u; cover.append(img); }
    else cover.append(el("span", "ph", n.kind === "pdf" ? "PDF" : TPL[n.template] || "ノート"));
    card.append(cover, el("div", "t", n.title), el("div", "m", `${n.pages.length}ページ · ${fmtDate(n.updated)}`));
    card.addEventListener("click", () => openEditor(n.id));
    const more = el("button", "more"); more.type = "button"; more.innerHTML = I.more; more.setAttribute("aria-label", `${n.title} のメニュー`);
    more.addEventListener("click", (e) => { e.stopPropagation(); noteMenu(n); });
    wrap.append(card, more); grid.append(wrap);
  }
}
$("libBack").addEventListener("click", () => { libFolder = null; renderLibrary(); });

let libSearchT = 0, libSearchGen = 0;
function libSearchActive() { return normQ($("libQuery").value).length > 0; }
function showResultsMode(on) {
  $("results").hidden = !on; $("grid").hidden = on;
  if (on) $("empty").hidden = true;
}
async function runLibSearch() {
  const gen = ++libSearchGen;
  const q = normQ($("libQuery").value);
  const box = $("results");
  if (!q) { showResultsMode(false); renderLibrary(); return; }
  showResultsMode(true);
  const meta = el("div", "res-meta", "検索しています…");
  if (!box.firstChild) box.replaceChildren(meta);
  let notes = [], folders = [];
  try { notes = await idb.all("notes"); folders = await getFolders(); } catch {}
  const fmap = new Map(folders.map(f => [f.id, f]));
  notes.sort((a, b) => b.updated - a.updated);
  const groups = []; let pageCount = 0, rows = 0;
  for (const n of notes) {
    if (gen !== libSearchGen) return;
    const titleHit = normMap(n.title).s.includes(q);
    const hits = [];
    if (n.kind === "pdf") {
      const nc = await normFor(n.id);
      if (nc) n.pages.forEach((p, i) => {
        if (p.src !== "pdf" || rows >= 300) return;
        const e = nc.pages[p.n]; if (!e) return;
        const f = findIn(e, q); if (f.length) { hits.push({ i, e, idx: f[0], count: f.length }); rows++; }
      });
    }
    if (titleHit || hits.length) { groups.push({ n, titleHit, hits }); pageCount += hits.length; }
  }
  if (gen !== libSearchGen) return;
  const frag = [];
  const m = el("div", "res-meta", groups.length ? `${groups.length}冊のノート · ${pageCount}ページで見つかりました` : "見つかりませんでした。PDFの文字とノートのタイトルを検索します（手書きの文字はまだ検索できません）。");
  frag.push(m);
  for (const g of groups) {
    const box2 = el("section", "rg");
    const head = el("button", "rg-head"); head.type = "button";
    head.append(el("span", "t", g.n.title));
    if (g.titleHit) head.append(el("span", "tag", "タイトル"));
    const f = g.n.folder && fmap.get(g.n.folder);
    if (f) { const chip = el("span", "chip"); chip.append(folderSvg(f.color), document.createTextNode(f.name)); head.append(chip); }
    head.addEventListener("click", () => openEditor(g.n.id, { q: $("libQuery").value }));
    box2.append(head);
    for (const h of g.hits) {
      const row = el("button", "sr-item"); row.type = "button";
      const pg = el("span", "pg"); pg.append(el("b", null, String(h.i + 1)), document.createTextNode(" ページ"));
      const sn = snippetEl(h.e, h.idx, q.length);
      if (h.count > 1) sn.append(el("span", "n", `ほか${h.count - 1}件`));
      row.append(pg, sn);
      row.addEventListener("click", () => openEditor(g.n.id, { page: h.i, q: $("libQuery").value }));
      box2.append(row);
    }
    frag.push(box2);
  }
  box.replaceChildren(...frag);
}
$("libQuery").addEventListener("input", () => {
  clearTimeout(libSearchT);
  libSearchT = setTimeout(async () => {
    if (!libSearchActive()) { runLibSearch(); return; }
    const pending = ensureIndexed((d, t) => { if (t) { $("results").hidden = false; $("grid").hidden = true; $("results").replaceChildren(el("div", "res-meta", `検索の準備をしています… ${d}/${t}冊（はじめの1回だけ）`)); } });
    const added = await pending.catch(() => 0);
    if (added) normCache.clear();
    runLibSearch();
  }, 220);
});
$("libQuery").addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.blur(); });

async function ensureSample() {
  if (lsGet("spn.sampled", false)) return;
  try {
    const notes = await idb.all("notes");
    if (notes.length === 0) {
      const now = Date.now(), id = uid();
      const note = { v: 1, id, title: "サンプルノート（削除できます）", kind: "blank", template: "ruled", folder: null, sample: true, created: now, updated: now,
        pages: [{ id: uid(), src: "blank", tpl: "ruled", w: A4.w, h: A4.h }] };
      const ink = { [note.pages[0].id]: [
        { t: "pen", c: "#1f4fbf", w: 2, p: wave(80, 120, 300, 0) },
        { t: "hl", c: "#ffd400", w: 14, p: wave(80, 182, 260, 1) },
        { t: "pen", c: "#c62828", w: 2.2, p: [90, 240, .5, 100, 252, .6, 108, 260, .7, 126, 236, .6, 150, 206, .5] },
      ] };
      await idb.put("notes", id, note); await idb.put("ink", id, ink); await renderThumb(note, ink, null);
    }
    lsSet("spn.sampled", true);
  } catch {}
}
function wave(x0, y0, len, flat) { const p = []; for (let i = 0; i <= 40; i++) { const x = x0 + len * i / 40; p.push(x, y0 + (flat ? 0 : Math.sin(i / 3) * 3), .4 + .3 * Math.sin(i / 7)); } return p; }

/* ---------- sheets ---------- */
function openSheet(build) {
  const back = el("div", "sheet-back"); const sh = el("div", "sheet");
  sh.setAttribute("role", "dialog"); sh.setAttribute("aria-modal", "true");
  back.append(sh);
  const prev = document.activeElement;
  const close = () => { back.remove(); document.removeEventListener("keydown", onKey); try { prev?.focus?.(); } catch {} };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  back.addEventListener("pointerdown", (e) => { if (e.target === back) close(); });
  build(sh, close);
  document.body.append(back);
  (sh.querySelector("input[type=text]") || sh.querySelector(".primary") || sh.querySelector("button"))?.focus();
  return close;
}
const btnEl = (label, cls, fn) => { const b = el("button", "btn " + (cls || ""), label); b.type = "button"; b.addEventListener("click", fn); return b; };

function noteMenu(n) {
  openSheet((sh, close) => {
    sh.append(el("h2", null, n.title), el("p", null, `${n.pages.length}ページ · 最終更新 ${fmtDate(n.updated)}`));
    const stack = el("div", "stack");
    stack.append(
      btnEl("開く", "primary", () => { close(); openEditor(n.id); }),
      btnEl("名前を変更", "", () => { close(); renameSheet(n); }),
      btnEl("フォルダに移動", "", () => { close(); moveSheet(n); }),
      btnEl("PDFで書き出し", "", () => { close(); exportPdf(n.id); }),
      btnEl("削除", "", () => { close(); confirmDelete(n); }),
    );
    sh.append(stack);
  });
}
function renameSheet(n, after) {
  openSheet((sh, close) => {
    sh.append(el("h2", null, "名前を変更"));
    const lab = el("label", "f", "ノートの名前"); const inp = el("input"); inp.type = "text"; inp.id = "renameInput"; inp.maxLength = 100; inp.value = n.title; lab.append(inp);
    const save = async () => {
      const v = inp.value.trim().slice(0, 100); if (!v) { inp.focus(); return; }
      try {
        if (ed.note?.id === n.id) { ed.note.title = v; $("edTitle").textContent = v; await flushSave(true); }
        else { const cur = await idb.get("notes", n.id); if (cur) { cur.title = v; cur.updated = Date.now(); await idb.put("notes", n.id, cur); markNoteDirty(n.id); } }
        close(); toast("名前を変更しました"); after ? after() : renderLibrary();
      } catch { toast("保存できませんでした"); }
    };
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") save(); });
    const row = el("div", "row"); row.append(btnEl("キャンセル", "", close), btnEl("保存", "primary", save));
    sh.append(lab, row);
  });
}
function confirmDelete(n) {
  openSheet((sh, close) => {
    sh.append(el("h2", null, `「${n.title}」を削除しますか？`), el("p", null, "書き込みも含めて、このiPadから完全に消えます。元に戻せません。"));
    const row = el("div", "row");
    row.append(btnEl("キャンセル", "", close), btnEl("削除する", "danger", async () => {
      try { for (const s of ["notes", "pdfs", "ink", "thumbs", "texts"]) await idb.del(s, n.id); normCache.delete(n.id); await markNoteDeleted(n.id); toast("削除しました"); } catch { toast("削除できませんでした"); }
      close(); renderLibrary();
    }));
    sh.append(row);
  });
}

/* ---------- folder sheets ---------- */
function folderEditSheet(existing, onDone) {
  openSheet((sh, close) => {
    let color = existing?.color || FOLDER_COLORS[0];
    sh.append(el("h2", null, existing ? "フォルダを編集" : "新しいフォルダ"));
    const lab = el("label", "f", "フォルダの名前"); const inp = el("input"); inp.type = "text"; inp.id = "folderName"; inp.maxLength = 60;
    inp.value = existing?.name || ""; inp.placeholder = "例: 循環器"; lab.append(inp);
    const colors = el("div", "fcolors"); colors.setAttribute("role", "group"); colors.setAttribute("aria-label", "フォルダの色");
    const btns = FOLDER_COLORS.map((c, i) => {
      const b = el("button"); b.type = "button"; b.style.background = c; b.setAttribute("aria-label", `色${i + 1}`); b.setAttribute("aria-pressed", String(c === color));
      b.addEventListener("click", () => { color = c; btns.forEach(x => x.setAttribute("aria-pressed", String(x === b))); });
      colors.append(b); return b;
    });
    const save = async () => {
      const name = inp.value.trim().slice(0, 60); if (!name) { inp.focus(); toast("フォルダの名前を入れてください"); return; }
      const f = existing ? { ...existing, name, color, updated: Date.now() } : { id: uid(), name, color, created: Date.now(), updated: Date.now() };
      try { await idb.put("folders", f.id, f); markFoldersDirty(); close(); onDone ? onDone(f) : renderLibrary(); }
      catch { toast("保存できませんでした"); }
    };
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") save(); });
    const row = el("div", "row"); row.append(btnEl("キャンセル", "", close), btnEl(existing ? "保存" : "作成", "primary", save));
    sh.append(lab, colors, row);
  });
}
function folderMenu(f, count) {
  openSheet((sh, close) => {
    sh.append(el("h2", null, f.name), el("p", null, `${count}冊のノート`));
    const stack = el("div", "stack");
    stack.append(
      btnEl("開く", "primary", () => { close(); libFolder = f.id; renderLibrary(); }),
      btnEl("名前と色を変更", "", () => { close(); folderEditSheet(f); }),
      btnEl("フォルダを削除", "", () => { close(); confirmFolderDelete(f, count); }),
    );
    sh.append(stack);
  });
}
function confirmFolderDelete(f, count) {
  openSheet((sh, close) => {
    sh.append(el("h2", null, `フォルダ「${f.name}」を削除しますか？`),
      el("p", null, count ? `中の${count}冊のノートは消えずに、フォルダの外に出ます。` : "空のフォルダです。"));
    const row = el("div", "row");
    row.append(btnEl("キャンセル", "", close), btnEl("削除する", "danger", async () => {
      try {
        for (const n of await idb.all("notes")) if (n.folder === f.id) { n.folder = null; await idb.put("notes", n.id, n); markNoteDirty(n.id); }
        await idb.put("folders", f.id, { id: f.id, deleted: true, updated: Date.now() }); markFoldersDirty(); toast("フォルダを削除しました");
      } catch { toast("削除できませんでした"); }
      close(); renderLibrary();
    }));
    sh.append(row);
  });
}
function moveSheet(n) {
  openSheet(async (sh, close) => {
    sh.append(el("h2", null, "フォルダに移動"), el("p", null, n.title));
    const stack = el("div", "stack"); sh.append(stack);
    const moveTo = async (fid) => {
      try { const cur = await idb.get("notes", n.id); if (cur) { cur.folder = fid; cur.updated = Date.now(); await idb.put("notes", n.id, cur); markNoteDirty(n.id); } close(); renderLibrary(); toast(fid ? "フォルダに移動しました" : "フォルダから出しました"); }
      catch { toast("移動できませんでした"); }
    };
    let folders = []; try { folders = await getFolders(); } catch {}
    folders.sort((a, b) => a.name.localeCompare(b.name, "ja"));
    for (const f of folders) {
      const b = btnEl("", n.folder === f.id ? "on" : "", () => moveTo(f.id));
      const mini = folderSvg(f.color); mini.classList.add("mini-folder");
      b.append(mini, document.createTextNode(f.name));
      stack.append(b);
    }
    if (n.folder) stack.append(btnEl("フォルダから出す", "", () => moveTo(null)));
    const nb = btnEl("", "", () => { close(); folderEditSheet(null, async (f) => { const cur = await idb.get("notes", n.id); if (cur) { cur.folder = f.id; cur.updated = Date.now(); await idb.put("notes", n.id, cur); markNoteDirty(n.id); } renderLibrary(); toast(`「${f.name}」に移動しました`); }); });
    nb.innerHTML = I.folderPlus; nb.append(document.createTextNode("新しいフォルダを作って移動"));
    stack.append(nb);
    const row = el("div", "row"); row.append(btnEl("キャンセル", "", close)); sh.append(row);
  });
}

function safetySheet() {
  openSheet((sh, close) => {
    sh.append(el("h2", null, "このアプリの安全設計"));
    const ul = el("ul", "checks");
    const item = (ok, b, s) => { const li = el("li", ok ? "" : "w"); li.innerHTML = ok ? I.check : I.warn; const d = el("div"); d.append(el("b", null, b), el("span", null, s)); li.append(d); ul.append(li); };
    if (syncOn()) {
      item(true, "Googleで使うのは「このアプリ専用の隠しフォルダ」だけ", "許可するのはGoogleドライブの隠しフォルダ（アプリ専用）への読み書きだけです。Gmail、カレンダー、ドライブにある他のファイルには触れられません。");
      item(true, "通信先はGoogleだけ", "ログインとドライブ以外の通信はブラウザの設定（CSP）で禁止しています。PDFを表示・書き出す部品もこのサイトの中にあります。");
      item(true, "パスワードを預かりません", "ログインはGoogleの画面で行い、このアプリはパスワードを見ません。受け取る許可は1時間ほどで切れ、このタブを閉じると消えます。");
    } else {
      item(true, "Googleアカウントには触れていません", "同期をオンにするまで、Googleを含む外部とは一切通信しません。");
      item(true, "外部との通信なし", "PDFを表示する部品も書き出す部品も、このサイトの中にあります。ノートが外へ送られることはありません。");
    }
    item(true, "PDFの中のプログラムは実行しません", "PDFに仕込まれたスクリプトやフォームは動かさず、表示だけを行います。");
    item(true, "まずこのiPadに保存", syncOn() ? "書いた内容は先にこの端末に保存され、そのあとドライブに送られます。電波がなくても書けます。" : "データはこの端末のブラウザの中だけにあります。");
    item(false, syncOn() ? "同期が止まっていないか、ときどき確認" : "バックアップはこまめに", syncOn() ? "画面上の雲のマークが「タップして同期を続ける」になっていたら、タップしてください。" : "ブラウザのデータ消去や容量不足で消えることがあります。「バックアップ」から定期的にファイルへ保存するか、Googleドライブ同期をオンにしてください。");
    item(false, "患者さんの情報は入れないでください", "実習の資料など、個人情報を含むPDFはこのアプリで扱わないでください。");
    sh.append(ul);
    const row = el("div", "row"); row.append(btnEl("閉じる", "primary", close)); sh.append(row);
  });
}

/* ---------- new notes ---------- */
function newBlankSheet() {
  openSheet((sh, close) => {
    let tpl = "ruled";
    sh.append(el("h2", null, "白紙ノートを作る"));
    const lab = el("label", "f", "ノートの名前"); const inp = el("input"); inp.type = "text"; inp.id = "newTitle"; inp.maxLength = 100;
    const d = new Date(); inp.value = `ノート ${d.getMonth() + 1}/${d.getDate()}`; lab.append(inp);
    const tp = el("div", "tpls"); tp.setAttribute("role", "group"); tp.setAttribute("aria-label", "用紙");
    const btns = Object.entries(TPL).map(([k, v]) => {
      const b = el("button", "tpl"); b.type = "button"; b.setAttribute("aria-pressed", String(k === tpl));
      b.append(el("i", k), document.createTextNode(v));
      b.addEventListener("click", () => { tpl = k; btns.forEach(x => x.setAttribute("aria-pressed", String(x === b))); });
      tp.append(b); return b;
    });
    const create = async () => {
      const title = inp.value.trim().slice(0, 100) || "ノート";
      const now = Date.now(), id = uid();
      const note = { v: 1, id, title, kind: "blank", template: tpl, folder: libFolder, created: now, updated: now, pages: [{ id: uid(), src: "blank", tpl, w: A4.w, h: A4.h }] };
      try { await idb.put("notes", id, note); await idb.put("ink", id, {}); markNoteDirty(id); askPersist(); close(); openEditor(id); }
      catch { toast("保存できませんでした。保存領域を確認してください"); }
    };
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") create(); });
    const row = el("div", "row"); row.append(btnEl("キャンセル", "", close), btnEl("作成", "primary", create));
    sh.append(lab, tp, row);
  });
}
async function importPdf(file) {
  if (!file) return;
  if (file.size > 400 * 1048576) { toast("400MBを超えるPDFは開けません"); return; }
  toast("PDFを読み込んでいます…", 60000);
  let doc;
  try {
    const buf = await file.arrayBuffer();
    if (!looksLikePdf(buf)) { toast("PDFファイルではないようです"); return; }
    doc = await loadPdf(buf);
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const vp = (await doc.getPage(i)).getViewport({ scale: 1 });
      pages.push({ id: uid(), src: "pdf", n: i, w: vp.width, h: vp.height });
    }
    const now = Date.now(), id = uid();
    const title = (file.name || "PDF").replace(/\.pdf$/i, "").slice(0, 100) || "PDF";
    const note = { v: 1, id, title, kind: "pdf", template: "plain", folder: libFolder, created: now, updated: now, pages };
    await idb.put("pdfs", id, buf); await idb.put("notes", id, note); await idb.put("ink", id, {}); markNoteDirty(id);
    try { await idb.put("texts", id, await extractTexts(doc)); } catch (e) { console.warn("texts", e); }
    await renderThumb(note, {}, doc);
    askPersist();
    $("toast").hidden = true;
    await openEditor(id);
  } catch (e) {
    const name = e?.name || "";
    if (name === "PasswordException") toast("パスワード付きのPDFには、まだ対応していません");
    else if (name === "QuotaExceededError") toast("保存容量が足りません。不要なノートを削除してください");
    else { console.warn(e); toast("このPDFを開けませんでした"); }
  } finally { try { await doc?.destroy(); } catch {} }
}

/* =========================================================
   Editor
   ========================================================= */
const PEN_COLORS = ["#1b1d22", "#1f4fbf", "#c62828", "#2e7d32"];
const HL_COLORS = ["#ffd400", "#ff8ac0", "#6cc4ff", "#8ee08a"];
const PEN_W = [1.1, 1.9, 3.2], HL_W = [8, 13, 20];
const cfg = Object.assign({ tool: "pen", pen: { c: PEN_COLORS[0], w: 1 }, hl: { c: HL_COLORS[0], w: 1 }, finger: false }, lsGet("spn.tools", {}));
if (!PEN_COLORS.includes(cfg.pen?.c)) cfg.pen = { c: PEN_COLORS[0], w: 1 };
if (!HL_COLORS.includes(cfg.hl?.c)) cfg.hl = { c: HL_COLORS[0], w: 1 };
if (!["pen", "hl", "er"].includes(cfg.tool)) cfg.tool = "pen";

const ed = { note: null, ink: {}, doc: null, pages: [], zoom: 1, base: 1, tops: [], undo: [], redo: [], cur: null, pinch: null, cur_i: 0, ver: {} };
const scroller = $("scroller"), pagesEl = $("pages");
const MAX_PX = 4_000_000;
const bump = (pid) => { ed.ver[pid] = (ed.ver[pid] || 0) + 1; };

function scale() { return ed.base * ed.zoom; }
function layout() {
  if (!ed.note) return;
  const avail = scroller.clientWidth - 24;
  const maxW = Math.max(...ed.note.pages.map(p => p.w));
  ed.base = clamp(avail / maxW, 0.2, 2.2);
  const s = scale();
  pagesEl.style.setProperty("--total-scale-factor", String(s));
  for (const pe of ed.pages) { pe.el.style.width = (pe.p.w * s).toFixed(1) + "px"; pe.el.style.height = (pe.p.h * s).toFixed(1) + "px"; }
  ed.tops = ed.pages.map(pe => pe.el.offsetTop);
  $("zLbl").textContent = Math.round(ed.zoom * 100) + "%";
  renderVisible();
}
function makePageEl(p) {
  const e = el("div", "page"); const bg = el("canvas", "bg"); const ink = el("canvas", "ink"); e.append(bg, ink);
  const pe = { el: e, bg, ink, live: null, p, vis: false, bgKey: null, inkKey: null, task: null, text: null };
  e._pe = pe; return pe;
}
const io = new IntersectionObserver((entries) => {
  for (const en of entries) { const pe = en.target._pe; if (!pe) continue; pe.vis = en.isIntersecting; if (!pe.vis) releasePage(pe); }
  renderVisible();
}, { root: scroller, rootMargin: "100% 0px 100% 0px" });

function releaseText(pe) {
  if (pe.text?.tl) { try { pe.text.tl.cancel(); } catch {} }
  pe.text?.div?.remove(); pe.text = null;
}
function releasePage(pe) {
  if (ed.cur?.pe === pe) return;
  try { pe.task?.cancel(); } catch {}
  pe.task = null; pe.bgKey = null; pe.inkKey = null;
  pe.bg.width = pe.bg.height = 0; pe.ink.width = pe.ink.height = 0;
  releaseText(pe);
}
function pixelSize(pe) {
  const s = scale(), cw = pe.p.w * s, ch = pe.p.h * s;
  let dpr = Math.min(window.devicePixelRatio || 1, 3);
  if (cw * ch * dpr * dpr > MAX_PX) dpr = Math.sqrt(MAX_PX / (cw * ch));
  const W = Math.max(1, Math.floor(cw * dpr)), H = Math.max(1, Math.floor(ch * dpr));
  return { W, H, k: W / pe.p.w, key: W + "x" + H };
}
function redrawInk(pe) {
  const { W, H, k, key } = pixelSize(pe);
  if (pe.ink.width !== W || pe.ink.height !== H) { pe.ink.width = W; pe.ink.height = H; }
  const ctx = pe.ink.getContext("2d"); ctx.clearRect(0, 0, W, H);
  for (const s of (ed.ink[pe.p.id] || [])) drawStroke(ctx, s, k);
  pe.inkKey = key;
}
async function renderBg(pe) {
  const { W, H, k, key } = pixelSize(pe);
  if (pe.bgKey === key) return;
  pe.bgKey = key;
  try { pe.task?.cancel(); } catch {}
  const c = el("canvas", "bg"); c.width = W; c.height = H; const ctx = c.getContext("2d");
  if (pe.p.src === "pdf" && ed.doc) {
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    try {
      const page = await ed.doc.getPage(pe.p.n);
      if (pe.bgKey !== key) return;
      pe.task = page.render({ canvasContext: ctx, viewport: page.getViewport({ scale: k }) });
      await pe.task.promise; pe.task = null;
    } catch (e) {
      if (e?.name !== "RenderingCancelledException") console.warn(e);
      if (pe.bgKey === key) pe.bgKey = null;
      c.width = c.height = 0; return;
    }
  } else drawTemplate(ctx, pe.p.tpl || "plain", pe.p.w, pe.p.h, k);
  if (pe.bgKey !== key || !pe.vis) { c.width = c.height = 0; if (pe.bgKey === key) pe.bgKey = null; return; }
  const old = pe.bg; pe.el.replaceChild(c, old); pe.bg = c; old.width = old.height = 0;
}
/* Transparent, selectable copy of the PDF's text so a long press can select, copy, look up or translate. */
async function ensureText(pe) {
  if (pe.text || pe.p.src !== "pdf" || !ed.doc || !pe.vis) return;
  const holder = { tl: null, div: null }; pe.text = holder;
  try {
    const page = await ed.doc.getPage(pe.p.n);
    if (pe.text !== holder) return;
    const vp = page.getViewport({ scale: 1 });
    if (vp.rotation % 360 !== 0) return;            // rotated pages: drawing works, text selection is skipped for now
    const div = el("div", "textLayer"); holder.div = div;
    const live = pe.el.querySelector(".live");
    pe.el.insertBefore(div, live || null);
    holder.tl = new pdfjsLib.TextLayer({ textContentSource: page.streamTextContent(), container: div, viewport: vp });
    await holder.tl.render();
    if (pe.text === holder) markHits(pe);
  } catch (e) {
    if (e?.name !== "AbortException") console.warn("text", e);
  }
}
/* Highlight search matches on the page: spans are joined, matched, and every overlapping span is tinted. */
function markHits(pe) {
  const div = pe.text?.div; if (!div) return;
  const spans = [...div.querySelectorAll("span:not(.markedContent)")];
  spans.forEach(sp => sp.classList.remove("hit"));
  const q = ed.hlq; if (!q) return;
  let all = ""; const ranges = [];
  for (const sp of spans) { const t = normMap(sp.textContent || "").s; ranges.push([all.length, all.length + t.length, sp]); all += t; }
  let i = all.indexOf(q), guard = 0;
  while (i >= 0 && guard++ < 200) {
    const j = i + q.length;
    for (const [a, b, sp] of ranges) if (a < j && b > i) sp.classList.add("hit");
    i = all.indexOf(q, j);
  }
}
const markAllHits = () => { for (const pe of ed.pages) markHits(pe); };

let renderGen = 0;
async function renderVisible() {
  const gen = ++renderGen;
  const mid = scroller.scrollTop + scroller.clientHeight / 2;
  const list = ed.pages.filter(pe => pe.vis).sort((a, b) => Math.abs(a.el.offsetTop + a.el.offsetHeight / 2 - mid) - Math.abs(b.el.offsetTop + b.el.offsetHeight / 2 - mid));
  for (const pe of list) if (pe.inkKey !== pixelSize(pe).key) redrawInk(pe);
  for (const pe of list) { if (gen !== renderGen || !ed.note) return; await renderBg(pe); }
  for (const pe of list) { if (gen !== renderGen || !ed.note) return; if (!ed.cur) await ensureText(pe); }
}
function updatePageNum() {
  const t = ed.tops, y = scroller.scrollTop + scroller.clientHeight * 0.4;
  let lo = 0, hi = t.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (t[m] <= y) lo = m; else hi = m - 1; }
  ed.cur_i = lo; $("pageNum").textContent = `${lo + 1} / ${t.length}`;
}
let scrollRaf = 0;
scroller.addEventListener("scroll", () => { if (!scrollRaf) scrollRaf = requestAnimationFrame(() => { scrollRaf = 0; updatePageNum(); }); }, { passive: true });
function scrollToPage(i, smooth = true) {
  const pe = ed.pages[i]; if (!pe) return;
  scroller.scrollTo({ top: Math.max(0, pe.el.offsetTop * (ed.pinch ? 1 : 1) - 12), behavior: smooth && !reduceMotion() ? "smooth" : "auto" });
}

async function openEditor(id, opts = {}) {
  let note, ink, pdf = null;
  try { note = await idb.get("notes", id); ink = (await idb.get("ink", id)) || {}; if (note?.kind === "pdf") pdf = await idb.get("pdfs", id); }
  catch { toast("ノートを読み込めませんでした"); return; }
  if (!note) { toast("ノートが見つかりません"); return; }
  ed.note = note; ed.ink = ink; ed.undo = []; ed.redo = []; ed.zoom = 1; ed.doc = null; ed.ver = {};
  ed.hlq = opts.q ? normQ(opts.q) : "";
  sync.openId = id; renderSyncChips();
  if (pdf) { try { ed.doc = await loadPdf(pdf); } catch (e) { console.warn(e); toast("PDFを表示できませんでした"); } }
  $("edTitle").textContent = note.title;
  setSave("ok");
  $("library").hidden = true; $("editor").hidden = false;
  pagesEl.replaceChildren();
  ed.pages = note.pages.map(p => { const pe = makePageEl(p); pagesEl.append(pe.el); io.observe(pe.el); return pe; });
  scroller.scrollTop = 0; scroller.scrollLeft = 0;
  layout(); syncTools(); syncUndo();
  if (opts.page != null) scrollToPage(clamp(opts.page, 0, ed.pages.length - 1), false);
  updatePageNum();
  if (opts.q) $("drQuery").value = opts.q;
}
async function closeEditor() {
  if (!ed.note) return;
  closeDrawer();
  await flushSave();
  const note = ed.note, ink = ed.ink, doc = ed.doc;
  io.disconnect();
  for (const pe of ed.pages) { try { pe.task?.cancel(); } catch {} releaseText(pe); pe.bg.width = pe.bg.height = 0; pe.ink.width = pe.ink.height = 0; }
  ed.pages = []; pagesEl.replaceChildren(); ed.note = null; ed.doc = null; ed.hlq = ""; $("drQuery").value = "";
  sync.openId = null; renderSyncChips(); scheduleSync(800);
  for (const v of thumbCache.values()) URL.revokeObjectURL(v.url); thumbCache.clear();
  $("editor").hidden = true; $("library").hidden = false;
  await renderThumb(note, ink, doc);
  try { await doc?.destroy(); } catch {}
  renderLibrary();
}

/* ---------- saving ---------- */
let saveTimer = 0, saving = null;
function setSave(s) { const e = $("saveState"); e.dataset.s = s; e.textContent = s === "saving" ? "保存中…" : s === "error" ? "保存できませんでした" : "保存済み"; }
function scheduleSave() { setSave("saving"); clearTimeout(saveTimer); saveTimer = setTimeout(flushSave, 700); }
async function flushSave(force) {
  const pending = !!saveTimer;
  clearTimeout(saveTimer); saveTimer = 0;
  if (!ed.note || (!pending && !force)) { if (saving) await saving; return; }
  if (saving) await saving;
  const note = ed.note, ink = ed.ink;
  saving = (async () => {
    try { note.updated = Date.now(); delete note.sample; await idb.put("ink", note.id, ink); await idb.put("notes", note.id, note); setSave("ok"); markNoteDirty(note.id); }
    catch (e) { console.warn(e); setSave("error"); }
  })();
  await saving; saving = null;
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && saveTimer) flushSave(); });
window.addEventListener("pagehide", () => { if (saveTimer) flushSave(); });

/* ---------- toolbar ---------- */
function syncTools() {
  $("tPen").setAttribute("aria-pressed", String(cfg.tool === "pen"));
  $("tHl").setAttribute("aria-pressed", String(cfg.tool === "hl"));
  $("tEr").setAttribute("aria-pressed", String(cfg.tool === "er"));
  $("fingerBtn").setAttribute("aria-pressed", String(!!cfg.finger));
  pagesEl.classList.toggle("finger-ink", !!cfg.finger);
  const sw = $("swatches"), wd = $("widths"); sw.replaceChildren(); wd.replaceChildren();
  const t = cfg.tool === "er" ? null : cfg.tool;
  sw.style.opacity = wd.style.opacity = t ? "1" : ".35";
  const colors = t === "hl" ? HL_COLORS : PEN_COLORS, curC = cfg[t || "pen"].c;
  colors.forEach((c, i) => {
    const b = el("button", "sw"); b.type = "button"; b.style.background = c; b.disabled = !t;
    b.setAttribute("aria-label", ["色1", "色2", "色3", "色4"][i]); b.setAttribute("aria-pressed", String(t && c === curC));
    b.addEventListener("click", () => { cfg[t].c = c; lsSet("spn.tools", cfg); syncTools(); }); sw.append(b);
  });
  ["細", "中", "太"].forEach((lab, i) => {
    const b = el("button", "wd"); b.type = "button"; b.disabled = !t; b.setAttribute("aria-label", lab);
    b.setAttribute("aria-pressed", String(t && cfg[t].w === i));
    const dot = el("span"); const sz = [5, 9, 14][i]; dot.style.width = dot.style.height = sz + "px"; b.append(dot);
    b.addEventListener("click", () => { cfg[t].w = i; lsSet("spn.tools", cfg); syncTools(); }); wd.append(b);
  });
}
const setTool = (t) => { cfg.tool = t; lsSet("spn.tools", cfg); syncTools(); };
$("tPen").addEventListener("click", () => setTool("pen"));
$("tHl").addEventListener("click", () => setTool("hl"));
$("tEr").addEventListener("click", () => setTool("er"));
$("fingerBtn").addEventListener("click", () => { cfg.finger = !cfg.finger; lsSet("spn.tools", cfg); syncTools(); toast(cfg.finger ? "指でも書けます（2本指でスクロール・拡大）" : "指はスクロールと文字の選択に戻しました"); });
$("backBtn").addEventListener("click", closeEditor);
$("edTitle").addEventListener("click", () => ed.note && renameSheet(ed.note, () => {}));
$("exportBtn").addEventListener("click", () => ed.note && exportPdf(ed.note.id));

function setZoom(z, cx, cy) {
  const old = ed.zoom; z = clamp(z, 0.5, 4); if (Math.abs(z - old) < 1e-3) return;
  cx ??= scroller.clientWidth / 2; cy ??= scroller.clientHeight / 2;
  const px = scroller.scrollLeft + cx, py = scroller.scrollTop + cy, r = z / old;
  ed.zoom = z; layout();
  scroller.scrollLeft = px * r - cx; scroller.scrollTop = py * r - cy; updatePageNum();
}
$("zIn").addEventListener("click", () => setZoom(ed.zoom * 1.25));
$("zOut").addEventListener("click", () => setZoom(ed.zoom / 1.25));
$("zLbl").addEventListener("click", () => setZoom(1));
let resizeT; window.addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (ed.note) { layout(); updatePageNum(); } }, 120); });

/* ---------- page operations (all undoable) ---------- */
function reorderDom() { for (const pe of ed.pages) pagesEl.append(pe.el); }
function insertPageObj(at, p, strokes) {
  ed.note.pages.splice(at, 0, p);
  const pe = makePageEl(p);
  pagesEl.insertBefore(pe.el, ed.pages[at]?.el || null);
  ed.pages.splice(at, 0, pe); io.observe(pe.el);
  if (strokes) ed.ink[p.id] = strokes;
  bump(p.id);
  return pe;
}
function removePageAt(i) {
  const pe = ed.pages[i]; const p = pe.p; const strokes = ed.ink[p.id] || null;
  io.unobserve(pe.el); releasePage(pe); pe.el.remove();
  ed.pages.splice(i, 1); ed.note.pages.splice(i, 1);
  delete ed.ink[p.id];
  const c = thumbCache.get(p.id); if (c) { URL.revokeObjectURL(c.url); thumbCache.delete(p.id); }
  return { p, strokes };
}
function swapPages(i, j) {
  const P = ed.note.pages, E = ed.pages;
  [P[i], P[j]] = [P[j], P[i]]; [E[i], E[j]] = [E[j], E[i]];
  reorderDom();
}
function afterPageChange(focus) {
  layout(); updatePageNum(); syncUndo(); scheduleSave();
  if (dr.open && dr.mode === "pages") buildDrawer(focus);
}
function pushUndo(op) { ed.undo.push(op); ed.redo = []; }
function addPageAt(at) {
  if (!ed.note) return;
  at = clamp(at, 0, ed.note.pages.length);
  const ref = ed.note.pages[Math.max(0, at - 1)] || { w: A4.w, h: A4.h };
  const tpl = ed.note.kind === "blank" ? (ed.note.template || "plain") : "plain";
  const p = { id: uid(), src: "blank", tpl, w: ref.w, h: ref.h };
  insertPageObj(at, p, null);
  pushUndo({ type: "padd", at, p, strokes: null });
  afterPageChange(at);
  scrollToPage(at);
  toast(`${at + 1}ページ目に白紙のページを追加しました`);
}
function movePage(i, d) {
  const j = i + d; if (!ed.note || j < 0 || j >= ed.pages.length) return;
  swapPages(i, j);
  pushUndo({ type: "pmove", i, j });
  afterPageChange(j);
}
function deletePage(i) {
  if (!ed.note) return;
  if (ed.pages.length <= 1) { toast("最後の1ページは削除できません"); return; }
  openSheet((sh, close) => {
    sh.append(el("h2", null, `${i + 1}ページ目を削除しますか？`), el("p", null, "このページの書き込みも消えます。間違えたときは「取り消す」で戻せます（ノートを閉じるまで）。元のPDFファイルには影響しません。"));
    const row = el("div", "row");
    row.append(btnEl("キャンセル", "", close), btnEl("削除する", "danger", () => {
      close();
      if (!ed.pages[i]) return;
      const r = removePageAt(i);
      pushUndo({ type: "pdel", at: i, p: r.p, strokes: r.strokes });
      afterPageChange(Math.min(i, ed.pages.length - 1));
      toast("ページを削除しました");
    }));
    sh.append(row);
  });
}
function applyPageOp(op, dir) {
  if (op.type === "pmove") { swapPages(op.i, op.j); afterPageChange(dir < 0 ? op.i : op.j); scrollToPage(dir < 0 ? op.i : op.j, false); return; }
  const restore = (op.type === "pdel") === (dir < 0);     // undo a delete / redo an add -> page comes back
  if (restore) { insertPageObj(op.at, op.p, op.strokes); afterPageChange(op.at); scrollToPage(op.at, false); }
  else { const r = removePageAt(op.at); op.strokes = r.strokes; afterPageChange(Math.min(op.at, ed.pages.length - 1)); }
  toast(restore ? `${op.at + 1}ページ目を戻しました` : `${op.at + 1}ページ目を取り除きました`);
}
$("addPageBtn").addEventListener("click", () => addPageAt(ed.cur_i + 1));

/* ---------- page drawer ---------- */
const dr = { open: false, queue: [], busy: false, io: null, mode: "pages" };
const thumbCache = new Map();   // page id -> { ver, url }
function openDrawer(mode = "pages") {
  if (!ed.note) return;
  dr.mode = mode; dr.open = true; $("drawer").hidden = false; $("drBack").hidden = mode === "search";
  $("drSearchRow").hidden = mode !== "search"; $("drFoot").hidden = mode !== "pages";
  $("drawer").setAttribute("aria-label", mode === "search" ? "ノート内の検索" : "ページ一覧");
  if (mode === "search") { $("drTitle").textContent = "このノートを検索"; runNoteSearch(); setTimeout(() => $("drQuery").focus(), 30); }
  else { buildDrawer(ed.cur_i); $("drClose").focus(); }
}
function closeDrawer() {
  dr.open = false; dr.queue = []; $("drawer").hidden = true; $("drBack").hidden = true;
  dr.io?.disconnect(); $("drList").replaceChildren();
}
function buildDrawer(focusIndex) {
  if (dr.mode !== "pages") return;
  const list = $("drList");
  const keep = list.scrollTop;
  dr.io?.disconnect(); dr.queue = [];
  dr.io = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { dr.queue.push(en.target); dr.io.unobserve(en.target); }
    pumpThumbs();
  }, { root: list, rootMargin: "200px 0px" });
  list.replaceChildren();
  const n = ed.pages.length;
  $("drTitle").textContent = `ページ一覧（${n}）`;
  ed.pages.forEach((pe, i) => {
    const item = el("div", "dr-item" + (i === ed.cur_i ? " cur" : "")); item.dataset.pid = pe.p.id;
    const tb = el("button", "dr-thumb"); tb.type = "button"; tb.style.aspectRatio = `${pe.p.w} / ${pe.p.h}`;
    tb.setAttribute("aria-label", `${i + 1}ページ目へ移動`);
    const img = el("img"); img.alt = "";
    const c = thumbCache.get(pe.p.id); if (c && c.ver === (ed.ver[pe.p.id] || 0)) img.src = c.url;
    tb.append(img);
    tb.addEventListener("click", () => { closeDrawer(); scrollToPage(i, false); });
    const side = el("div", "dr-side");
    const num = el("div", "dr-num"); num.append(el("b", null, String(i + 1)), document.createTextNode(pe.p.src === "pdf" ? `PDF p.${pe.p.n}` : TPL[pe.p.tpl] || "白紙"));
    const ctr = el("div", "dr-ctrls");
    const mk = (icon, label, dis, fn, cls) => { const b = el("button", "ib sm" + (cls ? " " + cls : "")); b.type = "button"; b.innerHTML = I[icon]; b.setAttribute("aria-label", label); b.disabled = dis; b.addEventListener("click", fn); return b; };
    ctr.append(
      mk("up", `${i + 1}ページ目を上へ`, i === 0, () => movePage(i, -1)),
      mk("down", `${i + 1}ページ目を下へ`, i === n - 1, () => movePage(i, 1)),
      mk("trash", `${i + 1}ページ目を削除`, n <= 1, () => deletePage(i), "del"),
    );
    side.append(num, ctr);
    item.append(tb, side);
    list.append(item);
    if (!img.src) dr.io.observe(item);
  });
  if (focusIndex != null && list.children[focusIndex]) {
    const it = list.children[focusIndex];
    if (it.offsetTop < keep || it.offsetTop + it.offsetHeight > keep + list.clientHeight) list.scrollTop = it.offsetTop - list.clientHeight / 3;
    else list.scrollTop = keep;
  }
}
async function pumpThumbs() {
  if (dr.busy) return; dr.busy = true;
  try {
    while (dr.open && dr.queue.length) {
      const item = dr.queue.shift();
      const pe = ed.pages.find(x => x.p.id === item.dataset.pid); if (!pe) continue;
      const ver = ed.ver[pe.p.id] || 0;
      let c = thumbCache.get(pe.p.id);
      if (!c || c.ver !== ver) {
        try {
          const cv = await pageCanvas(pe.p, 152, ed.doc, ed.ink[pe.p.id]);
          const blob = await canvasBlob(cv, .8); cv.width = cv.height = 0;
          if (!blob) continue;
          if (c) URL.revokeObjectURL(c.url);
          c = { ver, url: URL.createObjectURL(blob) }; thumbCache.set(pe.p.id, c);
        } catch (e) { console.warn(e); continue; }
      }
      const img = item.querySelector("img"); if (img && item.isConnected) img.src = c.url;
    }
  } finally { dr.busy = false; }
}
$("pagesBtn").addEventListener("click", () => openDrawer("pages"));
$("searchBtn").addEventListener("click", () => openDrawer("search"));

/* ---------- search inside the open note ---------- */
let noteSearchT = 0, noteSearchGen = 0;
async function noteTexts() {
  const id = ed.note.id;
  let nc = await normFor(id);
  if (!nc && ed.doc) {
    try { const t = await extractTexts(ed.doc); await idb.put("texts", id, t); nc = await normFor(id, t); } catch (e) { console.warn(e); }
  }
  return nc;
}
async function runNoteSearch() {
  const gen = ++noteSearchGen;
  const list = $("drList"); dr.io?.disconnect();
  const raw = $("drQuery").value, q = normQ(raw);
  ed.hlq = q; markAllHits();
  if (!q) {
    list.replaceChildren(el("div", "res-meta", ed.note.kind === "pdf" ? "PDFの文字を検索できます。見つかったページをタップすると、そのページへ移動します。" : "白紙ノートには検索できる文字がありません（手書きの文字はまだ検索できません）。"));
    return;
  }
  const nc = ed.note.kind === "pdf" ? await noteTexts() : null;
  if (gen !== noteSearchGen || !ed.note) return;
  const items = [];
  ed.pages.forEach((pe, i) => {
    if (pe.p.src !== "pdf" || !nc) return;
    const e = nc.pages[pe.p.n]; if (!e) return;
    const f = findIn(e, q); if (!f.length) return;
    const row = el("button", "sr-item" + (i === ed.cur_i ? " on" : "")); row.type = "button";
    const pg = el("span", "pg"); pg.append(el("b", null, String(i + 1)), document.createTextNode(" ページ"));
    const sn = snippetEl(e, f[0], q.length); if (f.length > 1) sn.append(el("span", "n", `ほか${f.length - 1}件`));
    row.append(pg, sn);
    row.addEventListener("click", () => { list.querySelectorAll(".sr-item.on").forEach(x => x.classList.remove("on")); row.classList.add("on"); scrollToPage(i, false); });
    items.push(row);
  });
  list.replaceChildren(el("div", "res-meta", items.length ? `${items.length}ページで見つかりました` : "見つかりませんでした"), ...items);
}
$("drQuery").addEventListener("input", () => { clearTimeout(noteSearchT); noteSearchT = setTimeout(runNoteSearch, 200); });
$("drQuery").addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.blur(); });
$("drClose").addEventListener("click", closeDrawer);
$("drBack").addEventListener("click", closeDrawer);
$("drAdd").addEventListener("click", () => { const at = ed.pages.length; closeDrawer(); addPageAt(at); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && dr.open && !document.querySelector(".sheet-back")) closeDrawer(); });

/* ---------- undo / redo ---------- */
function syncUndo() { $("undoBtn").disabled = !ed.undo.length; $("redoBtn").disabled = !ed.redo.length; }
function pageById(pid) { return ed.pages.find(pe => pe.p.id === pid); }
function applyOp(op, dir) {
  if (op.type === "padd" || op.type === "pdel" || op.type === "pmove") { applyPageOp(op, dir); return; }
  const arr = (ed.ink[op.pid] ||= []);
  if (op.type === "add") {
    if (dir < 0) { const i = arr.lastIndexOf(op.stroke); if (i >= 0) arr.splice(i, 1); } else arr.push(op.stroke);
  } else {
    if (dir < 0) for (let i = op.items.length - 1; i >= 0; i--) arr.splice(op.items[i].i, 0, op.items[i].s);
    else for (const it of op.items) { const i = arr.indexOf(it.s); if (i >= 0) arr.splice(i, 1); }
  }
  bump(op.pid);
  const pe = pageById(op.pid); if (pe && pe.vis) redrawInk(pe);
}
function undo() { const op = ed.undo.pop(); if (!op) return; applyOp(op, -1); ed.redo.push(op); syncUndo(); scheduleSave(); }
function redo() { const op = ed.redo.pop(); if (!op) return; applyOp(op, 1); ed.undo.push(op); syncUndo(); scheduleSave(); }
$("undoBtn").addEventListener("click", undo);
$("redoBtn").addEventListener("click", redo);
document.addEventListener("keydown", (e) => {
  if (!ed.note || !(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
  e.preventDefault(); e.shiftKey ? redo() : undo();
});

/* ---------- drawing ---------- */
const canDraw = (e) => e.pointerType === "pen" || e.pointerType === "mouse" || (e.pointerType === "touch" && cfg.finger);
function ptOf(pe, e) {
  const r = pe.el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width * pe.p.w, y = (e.clientY - r.top) / r.height * pe.p.h;
  const pr = e.pointerType === "pen" ? (e.pressure > 0 ? e.pressure : .5) : .5;
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(pr * 100) / 100, r];
}
function eraseAt(pe, x, y, pxPerPt) {
  const arr = ed.ink[pe.p.id]; if (!arr?.length) return;
  const r = 10 / pxPerPt; let hit = false;
  for (let i = arr.length - 1; i >= 0; i--) if (hitStroke(arr[i], x, y, r)) { ed.cur.items.push({ i, s: arr[i] }); arr.splice(i, 1); hit = true; }
  if (hit) redrawInk(pe);
}
function liveCanvas(pe) {
  if (!pe.live) { pe.live = el("canvas", "live"); pe.el.append(pe.live); }
  if (pe.live.width !== pe.ink.width || pe.live.height !== pe.ink.height) { pe.live.width = pe.ink.width; pe.live.height = pe.ink.height; }
  return pe.live;
}
pagesEl.addEventListener("pointerdown", (e) => {
  if (ed.pinch || ed.cur || !canDraw(e) || e.button > 0) return;
  const pageEl = e.target.closest(".page"); if (!pageEl) return;
  const pe = pageEl._pe; e.preventDefault();
  try { window.getSelection()?.removeAllRanges(); } catch {}
  try { pageEl.setPointerCapture(e.pointerId); } catch {}
  if (pe.inkKey !== pixelSize(pe).key) redrawInk(pe);
  const [x, y, pr, r] = ptOf(pe, e);
  if (cfg.tool === "er") { ed.cur = { pe, id: e.pointerId, er: true, items: [] }; eraseAt(pe, x, y, r.width / pe.p.w); return; }
  const t = cfg.tool, conf = cfg[t];
  const stroke = { t: t === "hl" ? "hl" : "pen", c: conf.c, w: (t === "hl" ? HL_W : PEN_W)[conf.w] ?? 2, p: [x, y, pr] };
  ed.cur = { pe, id: e.pointerId, stroke, drawn: 0, raf: 0 };
});
pagesEl.addEventListener("pointermove", (e) => {
  const c = ed.cur; if (!c || e.pointerId !== c.id) return;
  e.preventDefault();
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of (evs.length ? evs : [e])) {
    const [x, y, pr, r] = ptOf(c.pe, ev);
    if (c.er) { eraseAt(c.pe, x, y, r.width / c.pe.p.w); continue; }
    const P = c.stroke.p, n = P.length;
    if (Math.hypot(x - P[n - 3], y - P[n - 2]) < 0.35) continue;
    P.push(x, y, pr);
  }
  if (c.er) return;
  const { k } = pixelSize(c.pe), n = c.stroke.p.length / 3;
  if (c.stroke.t === "pen") {
    const ctx = c.pe.ink.getContext("2d"); ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = c.stroke.c;
    for (let j = c.drawn; j < n - 1; j++) penSeg(ctx, c.stroke.p, n, j, c.stroke.w, k);
    ctx.restore(); c.drawn = Math.max(c.drawn, n - 1);
  } else if (!c.raf) {
    c.raf = requestAnimationFrame(() => { c.raf = 0; if (ed.cur !== c) return; const lc = liveCanvas(c.pe), ctx = lc.getContext("2d"); ctx.clearRect(0, 0, lc.width, lc.height); drawStroke(ctx, c.stroke, k); });
  }
});
function endStroke(e, cancel) {
  const c = ed.cur; if (!c || (e && e.pointerId !== c.id)) return;
  ed.cur = null;
  if (c.er) { if (c.items.length) { bump(c.pe.p.id); ed.undo.push({ type: "erase", pid: c.pe.p.id, items: c.items }); ed.redo = []; syncUndo(); scheduleSave(); } return; }
  if (c.raf) cancelAnimationFrame(c.raf);
  if (c.pe.live) { c.pe.live.remove(); c.pe.live = null; }
  const pid = c.pe.p.id;
  if (cancel && c.stroke.p.length < 9) { redrawInk(c.pe); return; }
  (ed.ink[pid] ||= []).push(c.stroke);
  if (c.stroke.t === "pen") {
    const { k } = pixelSize(c.pe), n = c.stroke.p.length / 3, ctx = c.pe.ink.getContext("2d");
    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = c.stroke.c;
    for (let j = c.drawn; j < n; j++) penSeg(ctx, c.stroke.p, n, j, c.stroke.w, k);
    ctx.restore();
  } else redrawInk(c.pe);
  bump(pid);
  ed.undo.push({ type: "add", pid, stroke: c.stroke }); ed.redo = []; syncUndo(); scheduleSave();
}
pagesEl.addEventListener("pointerup", (e) => endStroke(e, false));
pagesEl.addEventListener("pointercancel", (e) => endStroke(e, true));

/* Keep the Pencil from scrolling or selecting text while writing (Safari reports it as a "stylus" touch). */
const stylusGuard = (e) => {
  const ts = [...e.touches];
  if (ts.some(t => t.touchType === "stylus")) { e.preventDefault(); return; }
  if (cfg.finger && ts.length === 1 && e.target.closest?.(".page")) e.preventDefault();
};
pagesEl.addEventListener("touchstart", stylusGuard, { passive: false });
pagesEl.addEventListener("touchmove", stylusGuard, { passive: false });

/* ---------- pinch zoom (two fingers) ---------- */
const fingers = (e) => [...e.touches].filter(t => t.touchType !== "stylus");
scroller.addEventListener("touchstart", (e) => {
  const f = fingers(e); if (f.length !== 2) return;
  e.preventDefault();
  if (ed.cur && !ed.cur.er) {          // a second finger means "zoom", so drop the stroke that just started
    const c = ed.cur; ed.cur = null; if (c.raf) cancelAnimationFrame(c.raf);
    if (c.pe.live) { c.pe.live.remove(); c.pe.live = null; } redrawInk(c.pe);
  }
  const r = scroller.getBoundingClientRect();
  const cx = (f[0].clientX + f[1].clientX) / 2 - r.left, cy = (f[0].clientY + f[1].clientY) / 2 - r.top;
  ed.pinch = { d0: Math.hypot(f[0].clientX - f[1].clientX, f[0].clientY - f[1].clientY), cx, cy, s: 1 };
  pagesEl.style.transformOrigin = `${scroller.scrollLeft + cx}px ${scroller.scrollTop + cy}px`;
}, { passive: false });
scroller.addEventListener("touchmove", (e) => {
  if (!ed.pinch) return; const f = fingers(e); if (f.length !== 2) return;
  e.preventDefault();
  const d = Math.hypot(f[0].clientX - f[1].clientX, f[0].clientY - f[1].clientY);
  const s = clamp(d / ed.pinch.d0, 0.5 / ed.zoom, 4 / ed.zoom); ed.pinch.s = s;
  pagesEl.style.transform = `scale(${s})`;
}, { passive: false });
const pinchEnd = (e) => {
  if (!ed.pinch || fingers(e).length >= 2) return;
  const { s, cx, cy } = ed.pinch; ed.pinch = null;
  pagesEl.style.transform = ""; setZoom(ed.zoom * s, cx, cy);
};
scroller.addEventListener("touchend", pinchEnd); scroller.addEventListener("touchcancel", pinchEnd);
/* double tap with one finger: zoom to 200% at that spot, double tap again to return to 100% */
let tap1 = null, lastTap = { t: 0, x: 0, y: 0 }, zoomAnim = false;
function animateZoom(target, cx, cy) {
  target = clamp(target, 0.5, 4);
  if (reduceMotion() || zoomAnim) { setZoom(target, cx, cy); return; }
  zoomAnim = true;
  const s = target / ed.zoom;
  pagesEl.style.transformOrigin = `${scroller.scrollLeft + cx}px ${scroller.scrollTop + cy}px`;
  pagesEl.style.transition = "transform .2s cubic-bezier(.2,.7,.3,1)";
  requestAnimationFrame(() => { pagesEl.style.transform = `scale(${s})`; });
  setTimeout(() => { pagesEl.style.transition = ""; pagesEl.style.transform = ""; zoomAnim = false; setZoom(target, cx, cy); }, 210);
}
scroller.addEventListener("touchstart", (e) => {
  const t = e.touches[0];
  tap1 = (e.touches.length === 1 && t.touchType !== "stylus" && !cfg.finger) ? { x: t.clientX, y: t.clientY, t: performance.now(), moved: false } : null;
}, { passive: true });
scroller.addEventListener("touchmove", (e) => {
  if (!tap1) return; const t = e.touches[0];
  if (e.touches.length > 1 || Math.hypot(t.clientX - tap1.x, t.clientY - tap1.y) > 10) tap1 = null;
}, { passive: true });
scroller.addEventListener("touchend", (e) => {
  const a = tap1; tap1 = null;
  if (!a || e.touches.length || performance.now() - a.t > 260) return;
  const now = performance.now();
  if (now - lastTap.t < 330 && Math.hypot(a.x - lastTap.x, a.y - lastTap.y) < 34) {
    lastTap.t = 0;
    if (e.cancelable) e.preventDefault();
    try { window.getSelection()?.removeAllRanges(); } catch {}
    const r = scroller.getBoundingClientRect();
    animateZoom(ed.zoom < 1.5 ? 2 : 1, a.x - r.left, a.y - r.top);
  } else lastTap = { t: now, x: a.x, y: a.y };
}, { passive: false });

/* trackpad / ctrl+wheel zoom on desktop */
scroller.addEventListener("wheel", (e) => {
  if (!e.ctrlKey) return; e.preventDefault();
  const r = scroller.getBoundingClientRect(); setZoom(ed.zoom * Math.exp(-e.deltaY / 200), e.clientX - r.left, e.clientY - r.top);
}, { passive: false });

/* =========================================================
   Saving files to the iPad (export / backup)
   ========================================================= */
let downloads = null;
(async () => { try { downloads = await window.claude?.use?.("downloads"); } catch { downloads = null; } })();
const safeName = (s) => (s || "ノート").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 80).trim() || "ノート";
function browserDownload(filename, blob) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = u; a.download = filename; a.rel = "noopener";
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 120000);
  return true;
}
async function saveFile(filename, blob) {
  if (!downloads) return browserDownload(filename, blob);
  try { await downloads.save({ filename, data: blob }); return true; }
  catch (e) {
    const code = e?.code;
    if (code === "declined") toast("保存をキャンセルしました");
    else if (code === "rate_limited") toast("少し待ってから、もう一度お試しください");
    else if (code === "too_large") toast("ファイルが大きすぎて保存できませんでした");
    else { console.warn(e); toast("ファイルを保存できませんでした"); }
    return false;
  }
}

/* ---------- PDF export: original pages stay as they are, ink is added as vector lines ---------- */
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
function invertMatrix([a, b, c, d, e, f]) {
  const det = a * d - b * c;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}
const r2 = (v) => Math.round(v * 100) / 100;
function templateOps(L, tpl, w, h) {
  const ops = [];
  const line = (x1, y1, x2, y2) => ops.push(L.moveTo(r2(x1), r2(y1)), L.lineTo(r2(x2), r2(y2)));
  if (tpl === "ruled") {
    ops.push(L.setStrokingRgbColor(...hexRgb("#bccadb")), L.setLineWidth(0.7));
    for (let y = 72; y < h - 30; y += 26) line(28, y, w - 28, y);
    ops.push(L.stroke(), L.setStrokingRgbColor(...hexRgb("#e6b4b4")));
    line(64, 40, 64, h - 30); ops.push(L.stroke());
  } else if (tpl === "grid") {
    ops.push(L.setStrokingRgbColor(...hexRgb("#d3dbe5")), L.setLineWidth(0.5));
    for (let x = 18; x < w; x += 18) line(x, 0, x, h);
    for (let y = 18; y < h; y += 18) line(0, y, w, y);
    ops.push(L.stroke());
  } else if (tpl === "dots") {
    ops.push(L.setStrokingRgbColor(...hexRgb("#a9b8ca")), L.setLineWidth(1.9), L.setLineCap(L.LineCapStyle.Round));
    for (let y = 18; y < h; y += 18) for (let x = 18; x < w; x += 18) line(x, y, x + 0.01, y);
    ops.push(L.stroke());
  }
  return ops;
}
function inkOps(L, out, page, strokes) {
  const ops = [];
  let hlKey = null;
  for (const s of strokes) {
    const P = s.p, n = P.length / 3; if (!n) continue;
    const [r, g, b] = hexRgb(s.c);
    if (s.t === "hl") {
      hlKey ||= page.node.newExtGState("GS", out.context.obj({ Type: "ExtGState", CA: 0.34, ca: 0.34, BM: "Multiply" }));
      ops.push(L.pushGraphicsState(), L.setGraphicsState(hlKey), L.setStrokingRgbColor(r, g, b), L.setLineWidth(s.w), L.moveTo(r2(P[0]), r2(P[1])));
      if (n === 1) ops.push(L.lineTo(r2(P[0] + .01), r2(P[1])));
      for (let i = 1; i < n - 1; i++) { const x = P[i * 3], y = P[i * 3 + 1]; ops.push(L.appendQuadraticCurve(r2(x), r2(y), r2((x + P[i * 3 + 3]) / 2), r2((y + P[i * 3 + 4]) / 2))); }
      if (n > 1) ops.push(L.lineTo(r2(P[(n - 1) * 3]), r2(P[(n - 1) * 3 + 1])));
      ops.push(L.stroke(), L.popGraphicsState());
    } else {
      ops.push(L.setStrokingRgbColor(r, g, b));
      let curW = -1, open = false;
      for (let j = 0; j < n; j++) {
        const [sx, sy, x, y, ex, ey] = segOf(P, n, j);
        const wv = Math.round(Math.max(0.5, s.w * pw(P[j * 3 + 2])) * 10) / 10;
        if (wv !== curW || !open) { if (open) ops.push(L.stroke()); ops.push(L.setLineWidth(wv), L.moveTo(r2(sx), r2(sy))); curW = wv; open = true; }
        if (n === 1) ops.push(L.lineTo(r2(x + .01), r2(y)));
        else ops.push(L.appendQuadraticCurve(r2(x), r2(y), r2(ex), r2(ey)));
      }
      if (open) ops.push(L.stroke());
    }
  }
  return ops;
}
async function rasterPage(jsPage, p) {
  const k = Math.min(2.5, Math.sqrt(9e6 / (p.w * p.h)));
  const c = document.createElement("canvas"); c.width = Math.round(p.w * k); c.height = Math.round(p.h * k);
  const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  await jsPage.render({ canvasContext: ctx, viewport: jsPage.getViewport({ scale: k }) }).promise;
  const blob = await canvasBlob(c, .9); c.width = c.height = 0;
  return new Uint8Array(await blob.arrayBuffer());
}
let exporting = false;
async function exportPdf(noteId) {
  if (exporting) return;
  exporting = true;
  let jsdoc = null;
  try {
    if (ed.note?.id === noteId) await flushSave();
    const note = await idb.get("notes", noteId); if (!note) throw new Error("no note");
    const ink = (await idb.get("ink", noteId)) || {};
    const bytes = note.kind === "pdf" ? await idb.get("pdfs", noteId) : null;
    toast("PDFを書き出しています…", 120000);
    const L = await loadPdfLib();
    const out = await L.PDFDocument.create();
    let copied = null;
    if (bytes) {
      jsdoc = await loadPdf(bytes);
      try {
        const src = await L.PDFDocument.load(bytes.slice(0), { updateMetadata: false });
        const idx = note.pages.filter(p => p.src === "pdf").map(p => p.n - 1);
        copied = idx.length ? await out.copyPages(src, idx) : [];
      } catch (e) { console.warn("vector copy failed, using images", e); copied = null; }
    }
    let ci = 0, raster = false;
    for (let i = 0; i < note.pages.length; i++) {
      const p = note.pages[i]; let page, M;
      if (p.src === "pdf" && jsdoc) {
        const jp = await jsdoc.getPage(p.n);
        if (copied) { page = out.addPage(copied[ci++]); M = invertMatrix(jp.getViewport({ scale: 1 }).transform); }
        else {
          raster = true; page = out.addPage([p.w, p.h]);
          const img = await out.embedJpg(await rasterPage(jp, p));
          page.drawImage(img, { x: 0, y: 0, width: p.w, height: p.h }); M = [1, 0, 0, -1, 0, p.h];
        }
      } else {
        page = out.addPage([p.w, p.h]); M = [1, 0, 0, -1, 0, p.h];
      }
      const body = [];
      if (p.src !== "pdf") body.push(...templateOps(L, p.tpl || "plain", p.w, p.h));
      body.push(...inkOps(L, out, page, ink[p.id] || []));
      if (body.length) page.pushOperators(L.pushGraphicsState(), L.concatTransformationMatrix(...M.map(v => Math.round(v * 1e6) / 1e6)), L.setLineCap(L.LineCapStyle.Round), L.setLineJoin(L.LineJoinStyle.Round), ...body, L.popGraphicsState());
      if (note.pages.length > 8 && i % 4 === 3) toast(`PDFを書き出しています… ${i + 1}/${note.pages.length}`, 120000);
    }
    out.setTitle(note.title); out.setProducer("シンプルPDFノート"); out.setCreator("シンプルPDFノート");
    const data = await out.save();
    $("toast").hidden = true;
    const ok = await saveFile(`${safeName(note.title)}.pdf`, new Blob([data], { type: "application/pdf" }));
    if (ok) toast(raster ? "書き出しました（このPDFは保護されていたため、ページを画像として入れました）" : "PDFを書き出しました", 4200);
  } catch (e) {
    console.warn(e); toast("PDFを書き出せませんでした");
  } finally {
    exporting = false;
    try { await jsdoc?.destroy(); } catch {}
  }
}

/* ---------- backup (export to a file / restore from a file) ---------- */
function b64FromBuf(buf) {
  const u = new Uint8Array(buf), parts = [], C = 3 * 0x2000;
  for (let i = 0; i < u.length; i += C) { let s = ""; const sub = u.subarray(i, i + C); for (let j = 0; j < sub.length; j++) s += String.fromCharCode(sub[j]); parts.push(btoa(s)); }
  return parts.join("");
}
async function exportBackup() {
  toast("バックアップを作っています…", 60000);
  try {
    await flushSave();
    const notes = await idb.all("notes"), folders = await getFolders();
    const parts = [`{"app":"simple-pdf-note","format":2,"exported":${JSON.stringify(new Date().toISOString())},"folders":${JSON.stringify(folders)},"notes":[`];
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i], ink = (await idb.get("ink", n.id)) || {};
      const pdf = n.kind === "pdf" ? await idb.get("pdfs", n.id) : null;
      parts.push((i ? "," : "") + `{"meta":${JSON.stringify(n)},"ink":${JSON.stringify(ink)},"pdf":${pdf ? '"' + b64FromBuf(pdf) + '"' : "null"}}`);
    }
    parts.push("]}");
    const blob = new Blob(parts, { type: "application/json" });
    const d = new Date(), name = `simple-pdf-note-backup-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.json`;
    $("toast").hidden = true;
    if (await saveFile(name, blob)) { lsSet("spn.lastBackup", Date.now()); toast("バックアップを保存しました"); }
  } catch (e) { console.warn(e); toast("バックアップを作れませんでした"); }
}

/* strict validation: anything unexpected in the file is rejected */
const ID_RE = /^[A-Za-z0-9-]{8,64}$/, COLOR_RE = /^#[0-9a-fA-F]{6}$/, B64_RE = /^[A-Za-z0-9+/]*={0,2}$/;
const num = (v, a, b) => typeof v === "number" && Number.isFinite(v) && v >= a && v <= b;
function cleanFolder(f) {
  if (!f || !ID_RE.test(f.id) || typeof f.name !== "string") return null;
  return { id: f.id, name: f.name.slice(0, 60) || "フォルダ", color: FOLDER_COLORS.includes(f.color) ? f.color : FOLDER_COLORS[0], created: num(f.created, 0, 1e14) ? f.created : Date.now(), updated: num(f.updated, 0, 1e14) ? f.updated : 0 };
}
function cleanFolderSync(f) {
  if (f && f.deleted === true && ID_RE.test(f.id)) return { id: f.id, deleted: true, updated: num(f.updated, 0, 1e14) ? f.updated : 0 };
  return cleanFolder(f);
}
function cleanNote(raw, folderIds, opts = {}) {
  const m = raw?.meta; if (!m || typeof m !== "object") return null;
  if (!ID_RE.test(m.id) || typeof m.title !== "string" || !["pdf", "blank"].includes(m.kind)) return null;
  if (!Array.isArray(m.pages) || m.pages.length < 1 || m.pages.length > 5000) return null;
  const pages = [];
  for (const p of m.pages) {
    if (!p || !ID_RE.test(p.id) || !["pdf", "blank"].includes(p.src) || !num(p.w, 10, 20000) || !num(p.h, 10, 20000)) return null;
    const q = { id: p.id, src: p.src, w: p.w, h: p.h };
    if (p.src === "pdf") { if (!Number.isInteger(p.n) || p.n < 1) return null; q.n = p.n; } else q.tpl = TPL[p.tpl] ? p.tpl : "plain";
    pages.push(q);
  }
  const ink = {}; const pids = new Set(pages.map(p => p.id));
  if (raw.ink && typeof raw.ink === "object") for (const [pid, arr] of Object.entries(raw.ink)) {
    if (!pids.has(pid) || !Array.isArray(arr)) continue;
    ink[pid] = arr.filter(s => s && (s.t === "pen" || s.t === "hl") && COLOR_RE.test(s.c) && num(s.w, .1, 80) && Array.isArray(s.p) && s.p.length % 3 === 0 && s.p.length <= 300000 && s.p.every(v => num(v, -1e5, 1e5)))
      .map(s => ({ t: s.t, c: s.c, w: s.w, p: s.p }));
  }
  let pdf = null;
  if (m.kind === "pdf" && !opts.noPdf) {
    if (typeof raw.pdf !== "string" || raw.pdf.length % 4 !== 0 || !B64_RE.test(raw.pdf)) return null;
    pdf = b64ToBytes(raw.pdf).buffer; if (!looksLikePdf(pdf)) return null;
  }
  const now = Date.now();
  const folder = typeof m.folder === "string" && folderIds.has(m.folder) ? m.folder : null;
  return { meta: { v: 1, id: m.id, title: m.title.slice(0, 100) || "ノート", kind: m.kind, template: TPL[m.template] ? m.template : "plain", folder, created: num(m.created, 0, 1e14) ? m.created : now, updated: num(m.updated, 0, 1e14) ? m.updated : now, pages }, ink, pdf };
}
async function importBackup(file) {
  if (!file) return;
  if (file.size > 1024 * 1048576) { toast("ファイルが大きすぎます"); return; }
  toast("バックアップを読み込んでいます…", 60000);
  let data;
  try { data = JSON.parse(await file.text()); } catch { toast("バックアップファイルとして読み込めませんでした"); return; }
  if (data?.app !== "simple-pdf-note" || ![1, 2].includes(data.format) || !Array.isArray(data.notes)) { toast("このアプリのバックアップファイルではありません"); return; }
  const folderIds = new Set((await getFolders().catch(() => [])).map(f => f.id));
  if (Array.isArray(data.folders)) for (const raw of data.folders.slice(0, 500)) {
    const f = cleanFolder(raw); if (!f) continue;
    if (!folderIds.has(f.id)) { try { f.updated = Date.now(); await idb.put("folders", f.id, f); folderIds.add(f.id); markFoldersDirty(); } catch {} }
  }
  let ok = 0, bad = 0;
  const existing = new Set((await idb.all("notes").catch(() => [])).map(n => n.id));
  for (const raw of data.notes) {
    const c = cleanNote(raw, folderIds); if (!c) { bad++; continue; }
    if (existing.has(c.meta.id)) { c.meta.id = uid(); c.meta.title = (c.meta.title + "（復元）").slice(0, 100); }
    try {
      if (c.pdf) await idb.put("pdfs", c.meta.id, c.pdf);
      await idb.put("ink", c.meta.id, c.ink); await idb.put("notes", c.meta.id, c.meta); markNoteDirty(c.meta.id);
      let doc = null; if (c.pdf) { try { doc = await loadPdf(c.pdf); } catch {} }
      await renderThumb(c.meta, c.ink, doc); try { await doc?.destroy(); } catch {}
      ok++;
    } catch { bad++; }
  }
  normCache.clear();
  askPersist(); await renderLibrary();
  toast(bad ? `${ok}冊を復元しました（${bad}冊は読み込めませんでした）` : `${ok}冊を復元しました`, 4200);
}

function backupSheet() {
  openSheet(async (sh, close) => {
    sh.append(el("h2", null, "バックアップ"));
    sh.append(el("p", null, "すべてのノート（PDF・書き込み・フォルダ）を1つのファイルにまとめて保存します。保存したファイルは「ファイル」アプリで、iCloud DriveやGoogleドライブに置いておくと安心です。"));
    const last = lsGet("spn.lastBackup", 0);
    const info = el("div", "meter", last ? `前回のバックアップ: ${fmtDate(last)}` : "まだバックアップしていません");
    sh.append(info);
    try { const est = await navigator.storage?.estimate?.(); if (est?.usage != null) info.textContent += ` · 使用量 ${fmtMB(est.usage)}`; } catch {}
    const row = el("div", "row");
    row.append(
      btnEl("ファイルから復元", "", () => { close(); $("backupInput").click(); }),
      btnEl("バックアップを保存", "primary", () => { close(); exportBackup(); }),
    );
    sh.append(row);
  });
}

/* =========================================================
   Google Drive sync
   - Scope: drive.appdata only (a hidden folder that only this app can see).
   - Every note is always saved locally first; Drive is a mirror kept in step.
   - Files in the hidden folder:
       n_<noteId>.json   note details + ink (or a small "deleted" marker)
       p_<noteId>.pdf    the original PDF (uploaded once, never changes)
       folders.json      the folder list (with markers for deleted folders)
   - Changes are detected with Drive's per-file version number.
   - If both devices changed the same note, both versions are kept.
   ========================================================= */
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const CLIENT_RE = /^[0-9]{6,}-[a-z0-9]{10,}\.apps\.googleusercontent\.com$/;
const sync = {
  clientId: lsGet("spn.clientId", ""), enabled: !!lsGet("spn.syncOn", false), consented: !!lsGet("spn.consented", false),
  token: null, exp: 0, tokenClient: null, gis: null,
  state: "off", msg: "", lastSync: lsGet("spn.lastSync", 0),
  running: null, again: false, timer: 0, openId: null,
};
const syncOn = () => sync.enabled && CLIENT_RE.test(sync.clientId);
class AuthError extends Error {}

/* ---------- token (kept for this tab only) ---------- */
function loadSession() {
  try { const t = JSON.parse(sessionStorage.getItem("spn.tok") || "null"); if (t && typeof t.tok === "string" && t.exp > Date.now() + 60000) { sync.token = t.tok; sync.exp = t.exp; } } catch {}
}
function saveSession() { try { sessionStorage.setItem("spn.tok", JSON.stringify({ tok: sync.token, exp: sync.exp })); } catch {} }
function clearSession() { sync.token = null; sync.exp = 0; try { sessionStorage.removeItem("spn.tok"); } catch {} }
const tokenOk = () => !!sync.token && sync.exp > Date.now() + 30000;

function loadGis() {
  sync.gis ||= new Promise((res, rej) => {
    if (window.google?.accounts?.oauth2) { res(); return; }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client"; s.async = true;
    s.onload = () => window.google?.accounts?.oauth2 ? res() : rej(new Error("gis missing"));
    s.onerror = () => rej(new Error("gis load"));
    document.head.append(s);
  });
  sync.gis.catch(() => { sync.gis = null; });
  return sync.gis;
}
function getTokenClient() {
  if (sync.tokenClient) return sync.tokenClient;
  sync.tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: sync.clientId,
    scope: DRIVE_SCOPE,
    callback: (r) => {
      if (!r || r.error || !r.access_token) { setSyncState("auth", "Googleの許可が得られませんでした。もう一度お試しください。"); return; }
      if (google.accounts.oauth2.hasGrantedAllScopes && !google.accounts.oauth2.hasGrantedAllScopes(r, DRIVE_SCOPE)) {
        setSyncState("auth", "ドライブへの保存が許可されていません。もう一度接続して、チェックを入れてください。"); return;
      }
      sync.token = r.access_token; sync.exp = Date.now() + (Number(r.expires_in) || 3600) * 1000; saveSession();
      if (!sync.consented) { sync.consented = true; lsSet("spn.consented", true); }
      setSyncState("idle"); runSync();
    },
    error_callback: (e) => {
      setSyncState("auth", e?.type === "popup_closed" ? "接続がキャンセルされました。" : e?.type === "popup_failed_to_open" ? "Googleの画面を開けませんでした。ホーム画面からではなく、Safariのタブで開いてお試しください。" : "Googleにつなげませんでした。");
    },
  });
  return sync.tokenClient;
}
/* Must run directly inside a tap: Safari only opens Google's window from a user gesture. */
function connectDrive() {
  if (!syncOn()) { syncSheet(); return; }
  if (!window.google?.accounts?.oauth2) { loadGis().catch(() => {}); toast("Googleの準備をしています。数秒後にもう一度タップしてください"); return; }
  try { getTokenClient().requestAccessToken({ prompt: sync.consented ? "" : "consent" }); }
  catch (e) { console.warn(e); toast("Googleの画面を開けませんでした"); }
}

/* ---------- Drive REST calls ---------- */
async function gfetch(url, opts = {}) {
  if (!tokenOk()) { clearSession(); throw new AuthError("no token"); }
  let r;
  try { r = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: "Bearer " + sync.token } }); }
  catch { const e = new Error("offline"); e.offline = true; throw e; }
  if (r.status === 401) { clearSession(); throw new AuthError("expired"); }
  if (!r.ok) { const t = await r.text().catch(() => ""); const e = new Error(`drive ${r.status} ${t.slice(0, 200)}`); e.status = r.status; throw e; }
  return r;
}
async function driveList() {
  const files = []; let pageToken = "";
  do {
    const u = new URL(DRIVE_API + "/files");
    u.searchParams.set("spaces", "appDataFolder");
    u.searchParams.set("fields", "nextPageToken,files(id,name,version,size)");
    u.searchParams.set("pageSize", "1000");
    if (pageToken) u.searchParams.set("pageToken", pageToken);
    const j = await (await gfetch(u.href)).json();
    files.push(...(j.files || [])); pageToken = j.nextPageToken || "";
  } while (pageToken);
  return files;
}
async function driveGet(id, as = "json") {
  const r = await gfetch(`${DRIVE_API}/files/${encodeURIComponent(id)}?alt=media`);
  return as === "json" ? r.json() : r.arrayBuffer();
}
async function driveDelete(id) {
  try { await gfetch(`${DRIVE_API}/files/${encodeURIComponent(id)}`, { method: "DELETE" }); }
  catch (e) { if (e.status !== 404) throw e; }
}
async function driveUpload({ id, name, mime, data }) {
  const meta = id ? {} : { name, parents: ["appDataFolder"] };
  const q = "fields=id,version,name";
  if (data.size <= 4.5 * 1048576) {
    const boundary = "spn" + crypto.getRandomValues(new Uint32Array(2)).join("");
    const body = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`, data, `\r\n--${boundary}--`]);
    const url = id ? `${DRIVE_UPLOAD}/files/${encodeURIComponent(id)}?uploadType=multipart&${q}` : `${DRIVE_UPLOAD}/files?uploadType=multipart&${q}`;
    return (await gfetch(url, { method: id ? "PATCH" : "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body })).json();
  }
  // large files (big PDFs): resumable upload in one request
  const url = id ? `${DRIVE_UPLOAD}/files/${encodeURIComponent(id)}?uploadType=resumable&${q}` : `${DRIVE_UPLOAD}/files?uploadType=resumable&${q}`;
  const init = await gfetch(url, { method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": mime }, body: JSON.stringify(meta) });
  const loc = init.headers.get("Location");
  if (!loc || !loc.startsWith(DRIVE_UPLOAD + "/")) throw new Error("no upload session");
  return (await gfetch(loc, { method: "PUT", headers: { "Content-Type": mime }, body: data })).json();
}

/* ---------- local bookkeeping ---------- */
const stGet = (k) => idb.get("sync", k).catch(() => null);
const stPut = (k, v) => idb.put("sync", k, { ...v, id: k });
async function markNoteDirty(id) {
  try { const st = (await stGet(id)) || {}; st.dirty = true; st.gen = (st.gen || 0) + 1; delete st.deleted; await stPut(id, st); } catch {}
  scheduleSync();
}
async function markNoteDeleted(id) {
  try {
    const st = (await stGet(id)) || {};
    if (!st.remoteId && !st.version) { await idb.del("sync", id); return; }
    st.deleted = true; st.dirty = true; st.gen = (st.gen || 0) + 1; await stPut(id, st);
  } catch {}
  scheduleSync();
}
async function markFoldersDirty() {
  try { const st = (await stGet("__folders")) || {}; st.dirty = true; st.gen = (st.gen || 0) + 1; await stPut("__folders", st); } catch {}
  scheduleSync();
}
function scheduleSync(delay = 4000) {
  if (!syncOn()) return;
  clearTimeout(sync.timer); sync.timer = setTimeout(runSync, delay);
}

/* ---------- the sync pass ---------- */
async function runSync() {
  if (!syncOn()) return;
  if (sync.running) { sync.again = true; return sync.running; }
  if (!tokenOk()) { clearSession(); setSyncState("auth"); return; }
  if (navigator.onLine === false) { setSyncState("offline"); return; }
  setSyncState("syncing");
  sync.running = (async () => {
    try {
      do { sync.again = false; await syncOnce(); } while (sync.again && tokenOk());
      sync.lastSync = Date.now(); lsSet("spn.lastSync", sync.lastSync);
      setSyncState("idle");
    } catch (e) {
      if (e instanceof AuthError) setSyncState("auth");
      else if (e.offline) setSyncState("offline");
      else { console.warn("sync", e); setSyncState("error", "同期できませんでした。少しあとで自動的にやり直します。"); }
    } finally { sync.running = null; }
  })();
  return sync.running;
}
async function syncOnce() {
  const remote = await driveList();
  const byName = new Map();
  for (const f of remote) { const a = byName.get(f.name) || []; a.push(f); byName.set(f.name, a); }
  const newest = (arr) => arr.slice().sort((a, b) => Number(b.version) - Number(a.version))[0];
  let changed = await syncFolders(byName.get("folders.json") || []);

  const remoteNotes = new Map(), remotePdfs = new Map();
  for (const [name, arr] of byName) {
    let m = /^n_([A-Za-z0-9-]{8,64})\.json$/.exec(name); if (m) { remoteNotes.set(m[1], newest(arr)); continue; }
    m = /^p_([A-Za-z0-9-]{8,64})\.pdf$/.exec(name); if (m) remotePdfs.set(m[1], newest(arr));
  }
  const locals = new Map((await idb.all("notes")).map(n => [n.id, n]));
  const states = new Map((await idb.all("sync")).filter(s => s.id && s.id !== "__folders").map(s => [s.id, s]));
  const ids = new Set([...remoteNotes.keys(), ...locals.keys(), ...states.keys()]);
  for (const id of ids) {
    if (!tokenOk()) throw new AuthError("expired");
    if (await syncNote(id, locals.get(id), states.get(id), remoteNotes.get(id), remotePdfs.get(id))) changed = true;
  }
  if (changed && !ed.note) renderLibrary();
}

async function syncFolders(files) {
  const st = (await stGet("__folders")) || {};
  const main = files.slice().sort((a, b) => Number(b.version) - Number(a.version))[0];
  const remoteChanged = !!main && String(main.version) !== String(st.version || "");
  if (main && !remoteChanged && !st.dirty && files.length === 1) return false;
  const local = await idb.all("folders");
  if (!main && !local.length) return false;
  const gen = st.gen || 0;
  const remoteList = [];
  for (const f of files) {
    try { const j = await driveGet(f.id); if (Array.isArray(j?.folders)) remoteList.push(...j.folders.slice(0, 1000)); }
    catch (e) { if (e instanceof AuthError || e.offline) throw e; console.warn("folders", e); }
  }
  const merged = new Map();
  for (const raw of [...local, ...remoteList]) {
    const f = cleanFolderSync(raw); if (!f) continue;
    const prev = merged.get(f.id);
    if (!prev || (f.updated || 0) > (prev.updated || 0)) merged.set(f.id, f);
  }
  const all = [...merged.values()];
  const key = (arr) => JSON.stringify(arr.map(f => [f.id, f.updated || 0, !!f.deleted, f.name || "", f.color || ""]).sort());
  let changedLocal = false;
  if (key(all) !== key(local)) { for (const f of all) await idb.put("folders", f.id, f); changedLocal = true; }
  let version = main?.version, remoteId = main?.id;
  if (!main || key(all) !== key(remoteList) || files.length > 1) {
    const r = await driveUpload({ id: main?.id, name: "folders.json", mime: "application/json", data: new Blob([JSON.stringify({ format: 1, folders: all })], { type: "application/json" }) });
    version = r.version; remoteId = r.id;
    for (const f of files) if (f !== main) await driveDelete(f.id);
  }
  const cur = (await stGet("__folders")) || {};
  cur.version = version; cur.remoteId = remoteId; if ((cur.gen || 0) === gen) cur.dirty = false;
  await stPut("__folders", cur);
  return changedLocal;
}

async function syncNote(id, local, st, rf, rpdf) {
  st ||= {};
  const remoteChanged = !!rf && String(rf.version) !== String(st.version || "");

  // a note deleted on this device
  if (st.deleted && !local) {
    const gen = st.gen;
    if (rf) await driveUpload({ id: rf.id, mime: "application/json", data: new Blob([JSON.stringify({ format: 1, deleted: true, id, updated: Date.now() })], { type: "application/json" }) });
    if (rpdf) await driveDelete(rpdf.id);
    const cur = await stGet(id);
    if (!cur || cur.gen === gen) await idb.del("sync", id);
    return false;
  }
  // only on Drive: bring it here (unless it is a deletion marker we already know)
  if (!local) {
    if (!rf) { if (st.id) await idb.del("sync", id).catch(() => {}); return false; }
    if (!remoteChanged && st.version) return false;
    return await pullNote(id, rf, rpdf, st, null);
  }
  if (local.sample && !st.dirty) return false;          // the built-in sample stays on each device
  if (!rf) { await pushNote(local, st, null, rpdf); return false; }

  const firstContact = !st.version;
  if (id === sync.openId && remoteChanged && !firstContact && !st.dirty) return false;  // open in the editor: update after it closes
  if (!remoteChanged && !st.dirty) return false;
  if (!remoteChanged && st.dirty) { await pushNote(local, st, rf, rpdf); return false; }
  if (remoteChanged && !st.dirty && !firstContact) return await pullNote(id, rf, rpdf, st, local);

  // both sides changed (or the same note met for the first time)
  const doc = await driveGet(rf.id);
  const ink = (await idb.get("ink", id)) || {};
  if (doc?.deleted) { await pushNote(local, st, rf, rpdf); return false; }    // deleted elsewhere but edited here: keep it
  if (sameNote(doc, local, ink)) { await stPut(id, { ...st, remoteId: rf.id, version: rf.version, pdfRemoteId: rpdf?.id, dirty: false }); return false; }
  if (id === sync.openId) return false;                                       // decide after the editor closes
  await copyLocalNote(local, ink, "（この端末の版）");
  await applyRemote(id, doc, rf, rpdf, st);
  toast(`「${local.title}」は2台で同時に変更されていたので、両方を残しました`, 6000);
  return true;
}
const docKey = (meta, ink) => JSON.stringify({ t: meta.title, f: meta.folder || null, tp: meta.template, p: meta.pages, ink });
function sameNote(doc, local, ink) {
  try { return docKey(doc.meta, doc.ink || {}) === docKey(local, ink); } catch { return false; }
}

async function pullNote(id, rf, rpdf, st, local) {
  const doc = await driveGet(rf.id);
  if (doc?.deleted) {
    if (local) { for (const s of ["notes", "pdfs", "ink", "thumbs", "texts"]) await idb.del(s, id); normCache.delete(id); }
    await stPut(id, { remoteId: rf.id, version: rf.version, dirty: false, gen: st.gen || 0 });
    return !!local;
  }
  await applyRemote(id, doc, rf, rpdf, st);
  return true;
}
async function applyRemote(id, doc, rf, rpdf, st) {
  const folderIds = new Set((await getFolders()).map(f => f.id));
  const c = cleanNote({ meta: doc?.meta, ink: doc?.ink }, folderIds, { noPdf: true });
  if (!c || c.meta.id !== id) throw new Error("bad note file " + id);
  let pdfBuf = null;
  if (c.meta.kind === "pdf") {
    pdfBuf = await idb.get("pdfs", id);
    if (!pdfBuf) {
      if (!rpdf) throw new Error("pdf not uploaded yet " + id);
      pdfBuf = await driveGet(rpdf.id, "buf");
      if (!looksLikePdf(pdfBuf)) throw new Error("bad pdf file " + id);
      await idb.put("pdfs", id, pdfBuf);
    }
  }
  await idb.put("ink", id, c.ink); await idb.put("notes", id, c.meta);
  await idb.del("texts", id).catch(() => {}); normCache.delete(id);
  const cur = (await stGet(id)) || {};
  await stPut(id, { remoteId: rf.id, version: rf.version, pdfRemoteId: rpdf?.id || null, dirty: false, gen: cur.gen || st.gen || 0 });
  let doc2 = null;
  try { if (pdfBuf) doc2 = await loadPdf(pdfBuf); await renderThumb(c.meta, c.ink, doc2); } catch (e) { console.warn(e); }
  finally { try { await doc2?.destroy(); } catch {} }
}
async function pushNote(local, st, rf, rpdf) {
  const id = local.id, gen = st.gen || 0;
  let pdfId = rpdf?.id || null;
  if (local.kind === "pdf" && !rpdf) {
    const bytes = await idb.get("pdfs", id);
    if (bytes) pdfId = (await driveUpload({ name: `p_${id}.pdf`, mime: "application/pdf", data: new Blob([bytes], { type: "application/pdf" }) })).id;
  }
  const note = (await idb.get("notes", id)) || local;
  const ink = (await idb.get("ink", id)) || {};
  const meta = { ...note }; delete meta.sample;
  const r = await driveUpload({ id: rf?.id, name: `n_${id}.json`, mime: "application/json", data: new Blob([JSON.stringify({ format: 1, deleted: false, meta, ink })], { type: "application/json" }) });
  const cur = (await stGet(id)) || {};
  cur.remoteId = r.id; cur.version = r.version; cur.pdfRemoteId = pdfId;
  if ((cur.gen || 0) === gen) cur.dirty = false;
  delete cur.deleted;
  await stPut(id, cur);
}
async function copyLocalNote(local, ink, suffix) {
  const nid = uid(), now = Date.now();
  const meta = { ...local, id: nid, title: (local.title + suffix).slice(0, 100), updated: now }; delete meta.sample;
  if (local.kind === "pdf") { const b = await idb.get("pdfs", local.id); if (b) await idb.put("pdfs", nid, b); }
  await idb.put("ink", nid, ink); await idb.put("notes", nid, meta);
  try { const t = await idb.get("thumbs", local.id); if (t) await idb.put("thumbs", nid, t); } catch {}
  await stPut(nid, { dirty: true, gen: 1 });
  sync.again = true;                       // upload the copy in the same sync run
}

/* ---------- status display ---------- */
const CLOUD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.5 9.2 4.4 4.4 0 0 0 7 18z"/></svg>';
const hhmm = (t) => { const d = new Date(t); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`; };
function syncLabel() {
  switch (sync.state) {
    case "off": return "Googleドライブ同期: オフ";
    case "syncing": return "同期中…";
    case "auth": return "タップして同期を続ける";
    case "offline": return "オフライン（あとで同期）";
    case "error": return "同期できませんでした";
    default: return sync.lastSync ? `同期済み ${hhmm(sync.lastSync)}` : "同期済み";
  }
}
function setSyncState(s, msg = "") { sync.state = syncOn() ? s : "off"; sync.msg = msg; renderSyncChips(); }
function renderSyncChips() {
  for (const id of ["libSync", "edSync"]) {
    const b = $(id); if (!b) continue;
    b.dataset.s = sync.state; b.innerHTML = CLOUD; b.append(document.createTextNode(id === "edSync" && sync.state === "idle" ? "同期済み" : syncLabel()));
    b.setAttribute("aria-label", syncLabel());
  }
  $("edSync").hidden = !syncOn();
  const st = $("safetyText");
  if (st) st.textContent = syncOn() ? "まずこの端末に保存 · Googleドライブの専用フォルダに同期 · ほかの通信なし" : "この端末の中だけに保存 · 外部との通信なし · ログイン不要";
  const live = document.getElementById("syncStatusLine");
  if (live) { live.dataset.s = sync.state; live.lastChild.textContent = syncLabel() + (sync.msg ? ` — ${sync.msg}` : ""); }
}
function onChipTap() { if (sync.state === "auth") connectDrive(); else syncSheet(); }
$("libSync").addEventListener("click", onChipTap);
$("edSync").addEventListener("click", onChipTap);

/* ---------- settings sheet ---------- */
function syncSheet() {
  openSheet((sh, close) => {
    sh.append(el("h2", null, "Googleドライブで同期"));
    if (!syncOn()) {
      sh.append(el("p", null, "ノートを、あなたのGoogleドライブの「このアプリ専用の隠しフォルダ」に自動で保存し、ほかの端末とそろえます。"));
      const ul = el("ul", "checks");
      const item = (b, s) => { const li = el("li"); li.innerHTML = I.check; const d = el("div"); d.append(el("b", null, b), el("span", null, s)); li.append(d); ul.append(li); };
      item("見られるのは専用フォルダだけ", "Gmailや、ドライブにある他のファイルには触れません。");
      item("ノートはまずこの端末に保存", "電波がなくても書けて、つながったときに送られます。");
      item("1時間ほどで再接続", "Googleの許可は時間がたつと切れます。雲のマークの「タップして同期を続ける」を押してください。");
      sh.append(ul);
      const lab = el("label", "f", "Google Cloudで作った「クライアントID」");
      const inp = el("input"); inp.type = "text"; inp.id = "clientIdInput"; inp.autocomplete = "off"; inp.spellcheck = false; inp.autocapitalize = "off";
      inp.placeholder = "123456789012-abc...apps.googleusercontent.com"; inp.value = sync.clientId; lab.append(inp);
      sh.append(lab);
      const row = el("div", "row");
      row.append(btnEl("キャンセル", "", close), btnEl("保存して次へ", "primary", () => {
        const v = inp.value.trim();
        if (!CLIENT_RE.test(v)) { toast("クライアントIDの形が違うようです。「….apps.googleusercontent.com」で終わる文字をそのまま貼り付けてください", 5000); inp.focus(); return; }
        if (v !== sync.clientId) { sync.tokenClient = null; clearSession(); }
        sync.clientId = v; lsSet("spn.clientId", v); sync.enabled = true; lsSet("spn.syncOn", true);
        loadGis().catch(() => toast("Googleのログイン部品を読み込めませんでした。通信を確認してください"));
        setSyncState("auth"); close(); syncSheet();
      }));
      sh.append(row);
      return;
    }
    const line = el("div", "status"); line.id = "syncStatusLine"; line.dataset.s = sync.state;
    line.append(el("span", "dot"), document.createTextNode(syncLabel() + (sync.msg ? ` — ${sync.msg}` : "")));
    sh.append(line);
    sh.append(el("p", null, sync.lastSync ? `最後に同期した時刻: ${fmtDate(sync.lastSync)} ${hhmm(sync.lastSync)}` : "まだ一度も同期していません。"));
    const stack = el("div", "stack");
    if (tokenOk()) stack.append(btnEl("今すぐ同期", "primary", () => { runSync(); }));
    else stack.append(btnEl(sync.consented ? "Googleに再接続して同期" : "Googleドライブに接続", "primary", () => { connectDrive(); }));
    stack.append(btnEl("この端末の同期をやめる", "", () => { close(); stopSyncSheet(); }));
    sh.append(stack);
    sh.append(el("p", "mono", `クライアントID: ${sync.clientId}`));
    const row = el("div", "row"); row.append(btnEl("閉じる", "", close)); sh.append(row);
    renderSyncChips();
  });
}
function stopSyncSheet() {
  openSheet((sh, close) => {
    sh.append(el("h2", null, "この端末の同期をやめますか？"),
      el("p", null, "この端末のノートはそのまま残ります。Googleドライブの専用フォルダの中身も消えません（ほかの端末は同期を続けられます）。"),
      el("p", null, "ドライブ側のデータも消したいときは、パソコンのGoogleドライブで「設定 → アプリを管理 → シンプルPDFノート → オプション → 隠しアプリデータを削除」を選んでください。"));
    const row = el("div", "row");
    row.append(btnEl("キャンセル", "", close), btnEl("同期をやめる", "danger", async () => {
      const tok = sync.token;
      try { if (tok && window.google?.accounts?.oauth2?.revoke) google.accounts.oauth2.revoke(tok, () => {}); } catch {}
      clearSession(); sync.enabled = false; lsSet("spn.syncOn", false); sync.tokenClient = null;
      try { await tx("sync", "readwrite", s => s.clear()); } catch {}
      sync.lastSync = 0; lsSet("spn.lastSync", 0);
      setSyncState("off"); close(); toast("この端末の同期をやめました");
    }));
    sh.append(row);
  });
}

/* ---------- when to sync ---------- */
function startSync() {
  loadSession();
  if (!syncOn()) { setSyncState("off"); return; }
  loadGis().catch(() => {});
  if (tokenOk()) { setSyncState("idle"); runSync(); } else setSyncState("auth");
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !syncOn()) return;
  if (tokenOk()) runSync(); else setSyncState("auth");
});
window.addEventListener("online", () => { if (syncOn() && tokenOk()) runSync(); });
window.addEventListener("offline", () => { if (syncOn()) setSyncState("offline"); });
setInterval(() => {
  if (!syncOn() || document.visibilityState !== "visible") return;
  if (!tokenOk()) { if (sync.state !== "auth") { clearSession(); setSyncState("auth"); } return; }
  runSync();
}, 60000);
setInterval(() => { if (sync.state === "idle") renderSyncChips(); }, 30000);

/* ---------- wire up library ---------- */
$("openPdfBtn").addEventListener("click", () => $("pdfInput").click());
$("pdfInput").addEventListener("change", (e) => { const f = e.target.files?.[0]; e.target.value = ""; importPdf(f); });
$("backupInput").addEventListener("change", (e) => { const f = e.target.files?.[0]; e.target.value = ""; importBackup(f); });
$("newBlankBtn").addEventListener("click", newBlankSheet);
$("newFolderBtn").addEventListener("click", () => folderEditSheet(null));
$("backupBtn").addEventListener("click", backupSheet);
$("safetyBtn").addEventListener("click", safetySheet);

await ensureSample();
await renderLibrary();
startSync();
