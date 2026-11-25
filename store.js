// Carbon Car Wash — umumiy ma'lumotlar qatlami (sayt va admin panel uchun).
// Hamma narsa brauzer localStorage'ida saqlanadi. Backend ulanganda faqat shu fayl o'zgaradi.

/* ---------------- Sozlamalar ---------------- */
const SHOP = {
  open: "07:30",
  close: "23:30",
  slot: 30,               // daqiqa
  daysAhead: 7,           // necha kun oldinga bron qilish mumkin
  phone: "+998 90 067 77 74",
};

// Admin kirish ma'lumotlari. Sayt serverga qo'yilsa, buni backendga o'tkazing.
const ADMIN = { login: "admin", password: "carbon2026" };

const KINDS = {
  wash: { name: "Moyka", role: "washer", roleName: "Moyshik", verb: "yuvadi", prefix: "M" },
  service: { name: "Avtoservis", role: "master", roleName: "Usta", verb: "ta'mirlaydi", prefix: "S" },
};

// Narxlar namuna: haqiqiylari bilan almashtiring. from: true — "...dan" (aniq narx ko'rikdan keyin).
const SERVICES = [
  { id: "express", kind: "wash", name: "Ekspress yuvish", desc: "Kuzovni faol ko'pik bilan yuvish, yuqori bosimda chayish va mikrofibra bilan quritish.", price: 50000, min: 20, icon: "drop" },
  { id: "full", kind: "wash", name: "Kompleks yuvish", desc: "Kuzov, salon changyutgich, oynalar ichi-tashqarisi va gilamchalar.", price: 90000, min: 40, icon: "car" },
  { id: "premium", kind: "wash", name: "Premium", desc: "Kompleks yuvish ustiga himoya mumi, shinalarga qora rang va salon plastigiga parvarish. Mashina ko'rgazmadan chiqqandek bo'ladi.", price: 150000, min: 60, icon: "spark", feature: true },
  { id: "salon", kind: "wash", name: "Salonni kimyoviy tozalash", desc: "O'rindiqlar, shift, eshik qoplamalari va polni chuqur tozalash, dog' va hidlarni yo'qotish.", price: 400000, min: 180, icon: "seat", wide: true },

  { id: "diag", kind: "service", name: "Kompyuter diagnostika", desc: "Skaner bilan xatolarni o'qish va dvigatel, datchiklar holatini tekshirish.", price: 100000, min: 30, icon: "scan" },
  { id: "oil", kind: "service", name: "Moy almashtirish", desc: "Motor moyi va filtrlarni almashtirish. Moyingizni olib kelsangiz ham bo'ladi.", price: 60000, min: 30, icon: "oil", from: true },
  { id: "razval", kind: "service", name: "Razval-shoxojdeniye", desc: "G'ildiraklar burchagini 3D stendda sozlash. Mashina to'g'ri yuradi, shina bir tekis yeyiladi.", price: 150000, min: 40, icon: "align" },
  { id: "balance", kind: "service", name: "Balansirovka", desc: "4 ta g'ildirakni balansirovka qilish, rulda titrashni yo'qotish.", price: 80000, min: 40, icon: "wheel" },
  { id: "tire", kind: "service", name: "Shinomontaj", desc: "Shinani yechish-taqish, almashtirish, teshikni yamash.", price: 80000, min: 30, icon: "wheel", from: true },
  { id: "chassis", kind: "service", name: "Xodovoy ta'miri", desc: "Amortizator, richag, sharovoy, rulevoy uchlari: tekshirish va almashtirish.", price: 200000, min: 120, icon: "spring", from: true },
  { id: "motor", kind: "service", name: "Motor ta'miri", desc: "Dvigatel nosozliklarini topish va ta'mirlash: kapital ta'mirgacha.", price: 500000, min: 240, icon: "engine", from: true },
  { id: "gearbox", kind: "service", name: "Karobka ta'miri", desc: "Mexanik va avtomat uzatmalar qutisi: diagnostika, moy almashtirish, ta'mir.", price: 600000, min: 240, icon: "gear", from: true },
];

const CAR_TYPES = [
  { id: "sedan", name: "Yengil", hint: "sedan, hetchbek", k: 1 },
  { id: "cross", name: "Krossover", hint: "Tracker, Tucson", k: 1.2 },
  { id: "suv", name: "Jip / miniven", hint: "Tahoe, Damas", k: 1.4 },
];

const STATUS = {
  booked: "Bron qilingan",
  arrived: "Keldi",
  working: "Ishlanmoqda",
  done: "Tayyor",
  noshow: "Kelmadi",
  cancelled: "Bekor qilindi",
};
const ACTIVE = ["booked", "arrived", "working"];

const DEFAULT_STAFF = [
  { id: "w1", name: "Aziz", role: "washer", active: true },
  { id: "w2", name: "Bekzod", role: "washer", active: true },
  { id: "w3", name: "Sardor", role: "washer", active: true },
  { id: "w4", name: "Jasur", role: "washer", active: true },
  { id: "m1", name: "Rustam usta", role: "master", active: true },
  { id: "m2", name: "Dilshod usta", role: "master", active: true },
];

/* ---------------- Yordamchilar ---------------- */
const KEYS = { bookings: "carbon_bookings", staff: "carbon_staff", my: "carbon_my_tickets", seeded: "carbon_seeded_v3" };

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const fmt = (n) => Math.round(n).toLocaleString("ru-RU").replace(/\s/g, " ");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = (n) => String(n).padStart(2, "0");

const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (date, n) => { const d = new Date(date + "T12:00:00"); d.setDate(d.getDate() + n); return ymd(d); };
const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const toHHMM = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const clock = (ts) => (ts ? new Date(ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "—");
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

const WEEKDAYS = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];
const MONTHS = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
function dayLabel(date) {
  const today = ymd();
  if (date === today) return "Bugun";
  if (date === addDays(today, 1)) return "Ertaga";
  if (date === addDays(today, -1)) return "Kecha";
  const d = new Date(date + "T12:00:00");
  return `${d.getDate()}-${MONTHS[d.getMonth()]}`;
}
const weekday = (date) => WEEKDAYS[new Date(date + "T12:00:00").getDay()];

const service = (id) => SERVICES.find((s) => s.id === id) || SERVICES[0];
const carType = (id) => CAR_TYPES.find((c) => c.id === id) || CAR_TYPES[0];
const priceOf = (svcId, typeId) => Math.round((service(svcId).price * carType(typeId).k) / 1000) * 1000;
const durationOf = (svcId, typeId) => Math.ceil((service(svcId).min * (service(svcId).kind === "wash" ? carType(typeId).k : 1)) / 10) * 10;
const maskPlate = (p) => String(p).replace(/^(\S+\s?\S?)(.*?)(\S{2})$/, (m, a, mid, b) => a + mid.replace(/\d/g, "•") + b);

/* ---------------- Saqlash ---------------- */
const read = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

const Store = {
  bookings: () => read(KEYS.bookings, []),
  saveBookings: (list) => write(KEYS.bookings, list),
  staff: () => read(KEYS.staff, null) || DEFAULT_STAFF,
  saveStaff: (list) => write(KEYS.staff, list),
  staffById: (id) => Store.staff().find((s) => s.id === id),
  staffName: (id) => Store.staffById(id)?.name || "—",
  myIds: () => read(KEYS.my, []),
  saveMyIds: (ids) => write(KEYS.my, ids),

  update(id, patch) {
    const list = Store.bookings();
    const b = list.find((x) => x.id === id);
    if (!b) return null;
    Object.assign(b, patch);
    Store.saveBookings(list);
    return b;
  },
};

/* ---------------- Bandlik va vaqtlar ---------------- */
function overlaps(b, date, start, dur) {
  if (b.date !== date || b.status === "cancelled" || b.status === "noshow") return false;
  const s = toMin(b.time);
  return s < start + dur && start < s + b.duration;
}

// Shu vaqtda bo'sh xodimlar (kind bo'yicha)
function freeStaff(kind, date, time, dur, list = Store.bookings()) {
  const start = toMin(time);
  return Store.staff()
    .filter((s) => s.active && s.role === KINDS[kind].role)
    .filter((s) => !list.some((b) => (b.staffId === s.id) && overlaps(b, date, start, dur)));
}

function slotsFor(kind, date, dur, list = Store.bookings()) {
  const open = toMin(SHOP.open);
  const close = toMin(SHOP.close);
  const isToday = date === ymd();
  const out = [];
  for (let t = open; t + Math.min(dur, 30) <= close; t += SHOP.slot) {
    const time = toHHMM(t);
    const past = isToday && t < nowMin() + 10;
    const free = past ? [] : freeStaff(kind, date, time, dur, list);
    out.push({ time, past, free });
  }
  return out;
}

// Mijoz tanlagan yoki eng kam band bo'sh xodimni tanlash
function pickStaff(kind, date, time, dur, wanted) {
  const list = Store.bookings();
  const free = freeStaff(kind, date, time, dur, list);
  if (wanted && wanted !== "any") return free.find((s) => s.id === wanted) || null;
  if (!free.length) return null;
  const load = (s) => list.filter((b) => b.date === date && b.staffId === s.id && b.status !== "cancelled").length;
  return free.sort((a, b) => load(a) - load(b))[0];
}

function createBooking(data) {
  const list = Store.bookings();
  const dur = durationOf(data.service, data.carType);
  const kind = service(data.service).kind;
  const staff = pickStaff(kind, data.date, data.time, dur, data.staffId);
  if (!staff) return { error: "Bu vaqt band bo'lib qoldi. Boshqa vaqtni tanlang." };
  const sameDay = list.filter((b) => b.date === data.date && b.kind === kind);
  const num = sameDay.length ? Math.max(...sameDay.map((b) => b.num)) + 1 : 1;
  const b = {
    id: uid(),
    num,
    code: `${KINDS[kind].prefix}-${pad(num)}`,
    kind,
    service: data.service,
    carType: data.carType,
    name: data.name,
    phone: data.phone,
    plate: data.plate,
    model: data.model,
    date: data.date,
    time: data.time,
    duration: dur,
    price: priceOf(data.service, data.carType),
    staffId: staff.id,
    status: "booked",
    createdAt: Date.now(),
  };
  list.push(b);
  Store.saveBookings(list);
  return { booking: b };
}

/* ---------------- Statistika ---------------- */
const isServed = (b) => b.status === "done";

function dailyCounts(days, list = Store.bookings()) {
  const today = ymd();
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const served = list.filter((b) => b.date === date && isServed(b));
    out.push({
      date,
      label: i === 0 ? "Bugun" : `${weekday(date)} ${new Date(date + "T12:00:00").getDate()}`,
      wash: served.filter((b) => b.kind === "wash").length,
      service: served.filter((b) => b.kind === "service").length,
      revenue: served.reduce((s, b) => s + b.price, 0),
    });
  }
  return out;
}

/* ---------------- Demo ma'lumot ---------------- */
// Bo'sh saytda diagrammalar ko'rinishi uchun so'nggi 14 kunlik namuna. Admin paneldan o'chirsa bo'ladi.
function seedDemo() {
  if (localStorage.getItem(KEYS.seeded)) return;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const names = ["Jasur", "Bobur", "Akmal", "Otabek", "Dilshod", "Ulug'bek", "Shoxrux", "Kamola", "Nodira", "Javohir", "Sherzod", "Madina", "Farrux", "Islom"];
  const cars = [["Cobalt", "sedan"], ["Gentra", "sedan"], ["Nexia 3", "sedan"], ["Malibu", "sedan"], ["Onix", "sedan"], ["Spark", "sedan"], ["Kia K5", "sedan"], ["Tracker", "cross"], ["Equinox", "cross"], ["Tucson", "cross"], ["BYD Song", "cross"], ["Chery Tiggo", "cross"], ["Captiva", "suv"], ["Tahoe", "suv"], ["Damas", "suv"], ["Lexus LX", "suv"]];
  const regions = ["01", "10", "30", "40", "50", "60", "70", "80", "90", "95"];
  const L = "ABCDEHKMOPTXYZ";
  const plate = () => `${pick(regions)} ${pick(L)} ${String(100 + Math.floor(rnd() * 899))} ${pick(L)}${pick(L)}`;
  const washSvc = ["express", "express", "full", "full", "full", "premium", "salon"];
  const servSvc = ["diag", "oil", "oil", "razval", "balance", "tire", "chassis", "motor", "gearbox"];

  const list = [];
  const today = ymd();
  const make = (date, kind, time, status) => {
    const [model, type] = pick(cars);
    const svc = pick(kind === "wash" ? washSvc : servSvc);
    const dur = durationOf(svc, type);
    const staff = freeStaff(kind, date, time, dur, list)[0];
    if (!staff) return;
    const sameDay = list.filter((b) => b.date === date && b.kind === kind);
    const num = sameDay.length + 1;
    const base = new Date(`${date}T${time}:00`).getTime();
    const created = base - (1 + Math.floor(rnd() * 20)) * 3600000;
    const b = {
      id: uid() + num, num, code: `${KINDS[kind].prefix}-${pad(num)}`, kind, service: svc, carType: type,
      name: pick(names), phone: `+99890${String(1000000 + Math.floor(rnd() * 8999999))}`, plate: plate(), model,
      date, time, duration: dur, price: priceOf(svc, type), staffId: staff.id, status, createdAt: created, demo: true,
    };
    if (status !== "booked") {
      b.arrivedAt = base + Math.floor(rnd() * 12 - 6) * 60000;
      if (status === "working" || status === "done") { b.startedAt = b.arrivedAt + Math.floor(2 + rnd() * 8) * 60000; b.startedBy = staff.id; }
      if (status === "done") b.doneAt = b.startedAt + Math.floor(dur * (0.85 + rnd() * 0.3)) * 60000;
    }
    list.push(b);
  };

  const open = toMin(SHOP.open), close = toMin(SHOP.close);
  for (let d = 13; d >= 0; d--) {
    const date = addDays(today, -d);
    const weekend = [0, 6].includes(new Date(date + "T12:00:00").getDay());
    const nWash = Math.floor((weekend ? 16 : 9) + rnd() * 8);
    const nServ = Math.floor(2 + rnd() * 5);
    const times = (n) => Array.from({ length: n }, () => toHHMM(open + Math.floor(rnd() * ((close - open - 60) / 30)) * 30)).sort();
    const now = nowMin();
    for (const t of times(nWash)) {
      if (d > 0) make(date, "wash", t, rnd() < 0.94 ? "done" : "noshow");
      else make(date, "wash", t, toMin(t) + 60 < now ? "done" : toMin(t) < now ? "working" : toMin(t) < now + 30 ? "arrived" : "booked");
    }
    for (const t of times(nServ)) {
      if (d > 0) make(date, "service", t, "done");
      else make(date, "service", t, toMin(t) + 120 < now ? "done" : toMin(t) < now ? "working" : "booked");
    }
  }
  // Ertaga uchun bir nechta bron
  for (const t of ["09:00", "10:30", "12:00", "15:30", "18:00"]) make(addDays(today, 1), "wash", t, "booked");
  make(addDays(today, 1), "service", "10:00", "booked");

  Store.saveBookings([...Store.bookings(), ...list]);
  localStorage.setItem(KEYS.seeded, "1");
}

function clearDemo() {
  Store.saveBookings(Store.bookings().filter((b) => !b.demo));
}

/* ---------------- Ikonkalar (yupqa chiziqli SVG) ---------------- */
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
  check: '<path d="M5 12.5 10 17 19 7"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ""}</svg>`;
const badge = (status) => `<span class="badge badge--${status}">${STATUS[status]}</span>`;

/* ---------------- Diagramma (SVG, ustunli, stacked) ---------------- */
// rows: [{label, values:{key:num}}], series: [{key,name,cls}]
function barChart(el, rows, series, { height = 260, unit = "ta" } = {}) {
  const W = Math.max(el.clientWidth || 640, 320);
  const H = height;
  const m = { t: 24, r: 8, b: 34, l: 34 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const totals = rows.map((r) => series.reduce((s, x) => s + (r.values[x.key] || 0), 0));
  const max = Math.max(4, ...totals);
  const step = Math.ceil(max / 4 / (max > 20 ? 5 : 1)) * (max > 20 ? 5 : 1);
  const top = step * 4;
  const y = (v) => ih - (v / top) * ih;
  const bw = Math.min(42, (iw / rows.length) * 0.56);
  const cx = (i) => (iw / rows.length) * (i + 0.5);

  let g = "";
  for (let i = 0; i <= 4; i++) {
    const v = step * i;
    g += `<line class="ch-grid" x1="0" x2="${iw}" y1="${y(v)}" y2="${y(v)}"/><text class="ch-tick" x="-10" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  }
  let bars = "";
  rows.forEach((r, i) => {
    let acc = 0;
    const segs = series.filter((s) => r.values[s.key] > 0);
    segs.forEach((s, j) => {
      const v = r.values[s.key];
      const y0 = y(acc), y1 = y(acc + v);
      const gap = j > 0 ? 2 : 0; // 2px fon oralig'i pastdagi segment bilan
      const h = Math.max(0, y0 - y1 - gap);
      const isTop = j === segs.length - 1;
      const rr = Math.min(4, h / 2);
      const x = cx(i) - bw / 2;
      bars += isTop
        ? `<path class="ch-bar ${s.cls}" style="--bi:${i}" d="M${x},${y1 + h} V${y1 + rr} Q${x},${y1} ${x + rr},${y1} H${x + bw - rr} Q${x + bw},${y1} ${x + bw},${y1 + rr} V${y1 + h} Z"/>`
        : `<rect class="ch-bar ${s.cls}" style="--bi:${i}" x="${x}" y="${y1}" width="${bw}" height="${h}"/>`;
      acc += v;
    });
    const dense = rows.length > 16;
    const last = rows.length - 1;
    if (totals[i] > 0 && (!dense || i === last)) bars += `<text class="ch-total" x="${cx(i)}" y="${y(totals[i]) - 8}" text-anchor="middle">${totals[i]}</text>`;
    if (!dense || (last - i) % 4 === 0) bars += `<text class="ch-label ${r.label === "Bugun" ? "is-today" : ""}" x="${cx(i)}" y="${ih + 22}" text-anchor="middle">${r.label}</text>`;
    bars += `<rect class="ch-hit" data-i="${i}" x="${cx(i) - iw / rows.length / 2}" y="0" width="${iw / rows.length}" height="${ih}"/>`;
  });

  el.innerHTML = `
    <svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Kunlar bo'yicha xizmat ko'rsatilgan mashinalar">
      <g transform="translate(${m.l},${m.t})">${g}<line class="ch-base" x1="0" x2="${iw}" y1="${ih}" y2="${ih}"/>${bars}</g>
    </svg>
    <div class="ch-tip" hidden></div>`;

  const tip = $(".ch-tip", el);
  $$(".ch-hit", el).forEach((hit) => {
    const show = () => {
      const r = rows[+hit.dataset.i];
      tip.innerHTML = `<b>${r.title || r.label}</b>${series.map((s) => `<span><i class="sw ${s.cls}"></i>${s.name}<em>${r.values[s.key] || 0} ${unit}</em></span>`).join("")}${r.extra ? `<span class="ch-tip__extra">${r.extra}</span>` : ""}`;
      tip.hidden = false;
      const px = ((m.l + cx(+hit.dataset.i)) / W) * el.clientWidth;
      tip.style.left = `${Math.min(Math.max(px, 90), el.clientWidth - 90)}px`;
      $$(".ch-hit", el).forEach((h) => h.classList.toggle("is-hover", h === hit));
    };
    hit.addEventListener("mouseenter", show);
    hit.addEventListener("click", show);
  });
  el.addEventListener("mouseleave", () => { tip.hidden = true; $$(".ch-hit", el).forEach((h) => h.classList.remove("is-hover")); });
}

// Gorizontal ustunlar (bitta qator — bitta ko'rsatkich), to'g'ridan-to'g'ri yozuvli
function hBars(el, items, { unit = "ta", cls = "s1" } = {}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  el.innerHTML = items.length
    ? `<ul class="hbars">${items.map((i) => `
      <li>
        <span class="hbars__label">${esc(i.label)}${i.sub ? `<small>${esc(i.sub)}</small>` : ""}</span>
        <span class="hbars__track"><span class="hbars__bar ${i.cls || cls}" style="--w:${(i.value / max) * 100}%"></span></span>
        <span class="hbars__val">${fmt(i.value)} ${unit}</span>
      </li>`).join("")}</ul>`
    : `<p class="empty">Ma'lumot yo'q.</p>`;
}

/* ---------------- Raqamni sanab chiqarish ---------------- */
// Ko'rinmagan (.reveal hali ochilmagan) joyda — ko'rinishi bilan sanaydi.
function setNum(el, n, f = (x) => String(x)) {
  if (!el) return;
  const reveal = el.closest(".reveal");
  if (reveal && !reveal.classList.contains("is-in") && document.documentElement.classList.contains("js")) {
    el._pending = [n, f];
    el._v = 0;
    el.textContent = f(0);
    (reveal._nums ||= new Set()).add(el);
    return;
  }
  const from = el._v ?? 0;
  el._v = n;
  if (from === n || matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = f(n); return; }
  const t0 = performance.now(), d = 1100;
  cancelAnimationFrame(el._raf);
  const step = (t) => {
    const p = Math.min(1, (t - t0) / d);
    const e = 1 - Math.pow(1 - p, 4);
    el.textContent = f(Math.round(from + (n - from) * e));
    if (p < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
}
function flushNums(reveal) {
  reveal._nums?.forEach((el) => { const [n, f] = el._pending || []; el._pending = null; if (n != null) setNum(el, n, f); });
  reveal._nums = null;
}
