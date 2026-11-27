// Carbon — brauzer tomoni: API bilan ishlash (fetch), umumiy yordamchilar, diagrammalar.
// Katalog va qoidalar catalog.js da (server bilan bir xil).

/* ---------------- API ---------------- */
// GitHub Pages'da ochilsa — API Vercel'dagi serverda; boshqa holatda shu domenning /api yo'li.
const API_BASE = (window.CARBON_API || (location.hostname.endsWith("github.io") ? "https://carbon-moyka.vercel.app" : "")) + "/api";
const TOKENS = { user: "carbon_user_token", admin: "carbon_admin_token" };

class ApiError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

async function api(path, { method = "GET", body, auth } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  const tok = auth === "admin" ? sessionStorage.getItem(TOKENS.admin) : localStorage.getItem(TOKENS.user);
  if (tok && auth !== false) headers.Authorization = `Bearer ${tok}`;
  let res;
  try {
    res = await fetch(API_BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, "Server bilan aloqa yo'q. Internetni tekshirib, qayta urinib ko'ring.");
  }
  let data = null;
  try { data = await res.json(); } catch { /* bo'sh javob */ }
  if (!res.ok) {
    if (res.status === 401 && auth === "admin") sessionStorage.removeItem(TOKENS.admin);
    throw new ApiError(res.status, data?.error || `Xatolik (${res.status})`);
  }
  return data;
}

/* ---------------- Yordamchilar ---------------- */
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const fmt = (n) => Math.round(n || 0).toLocaleString("ru-RU").replace(/\s/g, " ");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ymd = today; // eski nom bilan moslik
const clock = (ts) => (ts ? new Date(ts + SHOP.tzOffsetMin * 60000).toISOString().slice(11, 16) : "—");
const read = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

const WEEKDAYS = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];
const MONTHS = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
const dObj = (date) => new Date(date + "T12:00:00Z");
function dayLabel(date) {
  const t = today();
  if (date === t) return "Bugun";
  if (date === addDays(t, 1)) return "Ertaga";
  if (date === addDays(t, -1)) return "Kecha";
  return `${dObj(date).getUTCDate()}-${MONTHS[dObj(date).getUTCMonth()]}`;
}
const weekday = (date) => WEEKDAYS[dObj(date).getUTCDay()];
const isServed = (b) => b.status === "done";

/* ---------------- Toast va brauzer xabarlari (Notification) ---------------- */
function toast(msg, kind = "info") {
  let box = $("#toasts");
  if (!box) { box = document.createElement("div"); box.id = "toasts"; box.className = "toasts"; box.setAttribute("aria-live", "polite"); document.body.append(box); }
  const t = document.createElement("div");
  t.className = `toast toast--${kind}`;
  t.textContent = msg;
  box.append(t);
  setTimeout(() => t.classList.add("is-out"), 4200);
  setTimeout(() => t.remove(), 4800);
}

const Notify = {
  supported: () => "Notification" in window,
  enabled: () => "Notification" in window && Notification.permission === "granted",
  async ask() {
    if (!this.supported()) { toast("Brauzeringiz xabarlarni qo'llamaydi — holat sahifada yangilanadi."); return false; }
    if (Notification.permission === "denied") { toast("Xabarlar bloklangan. Brauzer sozlamalaridan ruxsat bering."); return false; }
    const p = await Notification.requestPermission();
    return p === "granted";
  },
  send(title, body, tag) {
    beep();
    toast(`${title} — ${body}`, "ok");
    if (this.enabled()) {
      try { new Notification(title, { body, tag, icon: "assets/logo-mark.svg", badge: "assets/logo-mark.svg" }); } catch { /* ba'zi mobil brauzerlar */ }
    }
    const old = document.title;
    document.title = `● ${title}`;
    setTimeout(() => (document.title = old), 6000);
  },
};
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880; g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    o.start(); o.stop(ctx.currentTime + 0.42);
  } catch { /* ovoz yo'q */ }
}

/* ---------------- Raqamni sanab chiqarish ---------------- */
function setNum(el, n, f = (x) => String(x)) {
  if (!el) return;
  const reveal = el.closest(".reveal");
  if (reveal && !reveal.classList.contains("is-in") && document.documentElement.classList.contains("js")) {
    el._pending = [n, f]; el._v = 0; el.textContent = f(0);
    (reveal._nums ||= new Set()).add(el);
    return;
  }
  const from = el._v ?? 0;
  el._v = n;
  if (from === n || matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = f(n); return; }
  const t0 = performance.now(), d = 900;
  cancelAnimationFrame(el._raf);
  const step = (t) => {
    const p = Math.min(1, (t - t0) / d);
    el.textContent = f(Math.round(from + (n - from) * (1 - Math.pow(1 - p, 4))));
    if (p < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
}
function flushNums(reveal) {
  reveal._nums?.forEach((el) => { const [n, f] = el._pending || []; el._pending = null; if (n != null) setNum(el, n, f); });
  reveal._nums = null;
}

/* ---------------- Ikonkalar ---------------- */
const ICONS = {
  drop: '<path d="M12 3.5c3.5 4.2 6 7.4 6 10.5a6 6 0 0 1-12 0c0-3.1 2.5-6.3 6-10.5Z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
  car: '<path d="M4 16.5V13l2-5h12l2 5v3.5M4 16.5h16M4 16.5V19h3v-2.5M17 16.5V19h3v-2.5M6 13h12"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  seat: '<path d="M6 11V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5M4 11a2 2 0 0 1 2 2v2h12v-2a2 2 0 0 1 4 0v4H2v-4a2 2 0 0 1 2-2ZM5 17v3M19 17v3"/>',
  scan: '<rect x="5" y="6" width="14" height="10" rx="2"/><path d="M9 20h6M12 16v4M8 11h2l1-2 2 4 1-2h2"/>',
  oil: '<path d="M4 10h9l3-3h4v3l-3 2v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-7ZM7 10V7h4M20 15.5c.8 1 1.2 1.7 1.2 2.3a1.2 1.2 0 0 1-2.4 0c0-.6.4-1.3 1.2-2.3Z"/>',
  align: '<rect x="3" y="5" width="4" height="14" rx="1.5"/><rect x="17" y="5" width="4" height="14" rx="1.5"/><path d="M7 12h10M10 9l-3 3 3 3M14 9l3 3-3 3"/>',
  wheel: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><path d="M12 3.5V9M12 15v5.5M3.5 12H9M15 12h5.5"/>',
  spring: '<path d="M12 2v3M12 19v3M8 5h8M8 19h8M8 7.5l8 1.5-8 1.5 8 1.5-8 1.5 8 1.5"/>',
  engine: '<path d="M4 10h2V8h3V6h5v2h3l2 2h2v6h-2l-2 2H8l-2-2H4v-6ZM2 11v4M10 6V4h4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  arrow: '<path d="M7 17 17 7M8 7h9v9"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  cup: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9ZM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5c0 1 1 1 1 2M11.5 3.5c0 1 1 1 1 2"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16ZM10 20a2 2 0 0 0 4 0"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ""}</svg>`;
const badge = (status) => `<span class="badge badge--${status}">${STATUS[status]}</span>`;

/* ---------------- Diagrammalar (admin) ---------------- */
function dailyCounts(days, list) {
  const t = today();
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(t, -i);
    const served = list.filter((b) => b.date === date && isServed(b));
    out.push({
      date,
      label: i === 0 ? "Bugun" : `${weekday(date)} ${dObj(date).getUTCDate()}`,
      wash: served.filter((b) => b.kind === "wash").length,
      service: served.filter((b) => b.kind === "service").length,
      revenue: served.reduce((s, b) => s + b.price, 0),
    });
  }
  return out;
}

function barChart(el, rows, series, { height = 260, unit = "ta" } = {}) {
  const W = Math.max(el.clientWidth || 640, 320), H = height;
  const m = { t: 24, r: 8, b: 34, l: 34 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const totals = rows.map((r) => series.reduce((s, x) => s + (r.values[x.key] || 0), 0));
  const max = Math.max(4, ...totals);
  const step = Math.ceil(max / 4 / (max > 20 ? 5 : 1)) * (max > 20 ? 5 : 1);
  const top = step * 4;
  const y = (v) => ih - (v / top) * ih;
  const bw = Math.min(42, (iw / rows.length) * 0.56);
  const cx = (i) => (iw / rows.length) * (i + 0.5);
  const dense = rows.length > 16, last = rows.length - 1;
  let g = "";
  for (let i = 0; i <= 4; i++) g += `<line class="ch-grid" x1="0" x2="${iw}" y1="${y(step * i)}" y2="${y(step * i)}"/><text class="ch-tick" x="-10" y="${y(step * i) + 4}" text-anchor="end">${step * i}</text>`;
  let bars = "";
  rows.forEach((r, i) => {
    let acc = 0;
    const segs = series.filter((s) => r.values[s.key] > 0);
    segs.forEach((s, j) => {
      const v = r.values[s.key];
      const y0 = y(acc), y1 = y(acc + v);
      const h = Math.max(0, y0 - y1 - (j > 0 ? 2 : 0));
      const rr = Math.min(4, h / 2), x = cx(i) - bw / 2;
      bars += j === segs.length - 1
        ? `<path class="ch-bar ${s.cls}" style="--bi:${i}" d="M${x},${y1 + h} V${y1 + rr} Q${x},${y1} ${x + rr},${y1} H${x + bw - rr} Q${x + bw},${y1} ${x + bw},${y1 + rr} V${y1 + h} Z"/>`
        : `<rect class="ch-bar ${s.cls}" style="--bi:${i}" x="${x}" y="${y1}" width="${bw}" height="${h}"/>`;
      acc += v;
    });
    if (totals[i] > 0 && (!dense || i === last)) bars += `<text class="ch-total" x="${cx(i)}" y="${y(totals[i]) - 8}" text-anchor="middle">${totals[i]}</text>`;
    if (!dense || (last - i) % 4 === 0) bars += `<text class="ch-label ${r.label === "Bugun" ? "is-today" : ""}" x="${cx(i)}" y="${ih + 22}" text-anchor="middle">${r.label}</text>`;
    bars += `<rect class="ch-hit" data-i="${i}" x="${cx(i) - iw / rows.length / 2}" y="0" width="${iw / rows.length}" height="${ih}"/>`;
  });
  el.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Kunlar bo'yicha xizmat ko'rsatilgan mashinalar"><g transform="translate(${m.l},${m.t})">${g}<line class="ch-base" x1="0" x2="${iw}" y1="${ih}" y2="${ih}"/>${bars}</g></svg><div class="ch-tip" hidden></div>`;
  const tip = $(".ch-tip", el);
  $$(".ch-hit", el).forEach((hit) => {
    const show = () => {
      const r = rows[+hit.dataset.i];
      tip.innerHTML = `<b>${r.title || r.label}</b>${series.map((s) => `<span><i class="sw ${s.cls}"></i>${s.name}<em>${r.values[s.key] || 0} ${unit}</em></span>`).join("")}${r.extra ? `<span class="ch-tip__extra">${r.extra}</span>` : ""}`;
      tip.hidden = false;
      tip.style.left = `${Math.min(Math.max(((m.l + cx(+hit.dataset.i)) / W) * el.clientWidth, 90), el.clientWidth - 90)}px`;
      $$(".ch-hit", el).forEach((h) => h.classList.toggle("is-hover", h === hit));
    };
    hit.addEventListener("mouseenter", show);
    hit.addEventListener("click", show);
  });
  el.addEventListener("mouseleave", () => { tip.hidden = true; $$(".ch-hit", el).forEach((h) => h.classList.remove("is-hover")); });
}

function hBars(el, items, { unit = "ta", cls = "s1" } = {}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  el.innerHTML = items.length
    ? `<ul class="hbars">${items.map((i) => `
      <li>
        <span class="hbars__label">${esc(i.label)}${i.sub ? `<small>${esc(i.sub)}</small>` : ""}</span>
        <span class="hbars__track"><span class="hbars__bar ${i.cls || cls}" style="--w:${(i.value / max) * 100}%"></span></span>
        <span class="hbars__val">${fmt(i.value)} ${unit}</span>
      </li>`).join("")}</ul>`
    : `<p class="empty">Hozircha ma'lumot yo'q.</p>`;
}
