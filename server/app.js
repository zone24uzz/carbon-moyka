// Carbon API — Express + MongoDB.
// Hamma qoidalar (narx, vaqt, bandlik, tekshiruv) serverda qayta tekshiriladi: brauzerga ishonilmaydi.
const express = require("express");
const crypto = require("crypto");
const C = require("../catalog.js");
const { getDb } = require("./db");

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "30kb" }));

/* ---------------- CORS (GitHub Pages'dan ham ishlashi uchun) ---------------- */
const allowed = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
app.use((req, res, next) => {
  const o = req.headers.origin;
  if (o && (allowed.includes(o) || /^http:\/\/localhost(:\d+)?$/.test(o))) {
    res.setHeader("Access-Control-Allow-Origin", o);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  }
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

/* ---------------- Yordamchilar ---------------- */
const rid = (n = 18) => crypto.randomBytes(n).toString("base64url");
const nowTs = () => Date.now();
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const strip = ({ _id, passHash, plateKey, ...rest }) => rest;

function secret() {
  const s = process.env.TOKEN_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.VERCEL) throw new HttpError(503, "Server sozlanmagan (TOKEN_SECRET)");
  return "local-dev-secret-change-me";
}
function sign(payload, hours) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: nowTs() + hours * 3600000 })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function verify(token) {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const good = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    return p.exp > nowTs() ? p : null;
  } catch { return null; }
}
const bearer = (req) => verify((req.headers.authorization || "").replace(/^Bearer\s+/i, ""));
function requireAdmin(req, _res, next) {
  const p = bearer(req);
  if (!p || p.role !== "admin") return next(new HttpError(401, "Admin sifatida kiring"));
  next();
}
const hashPass = (pw, salt = crypto.randomBytes(16).toString("hex")) =>
  `${salt}:${crypto.scryptSync(pw, salt, 32).toString("hex")}`;
function checkPass(pw, stored) {
  const [salt, hash] = String(stored).split(":");
  const test = crypto.scryptSync(pw, salt, 32);
  return test.length === Buffer.from(hash, "hex").length && crypto.timingSafeEqual(test, Buffer.from(hash, "hex"));
}
function sameText(a, b) {
  const x = crypto.createHash("sha256").update(String(a)).digest();
  const y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

/* ---------------- Ma'lumot ---------------- */
const DEFAULT_STAFF = [
  { id: "w1", name: "Aziz", role: "washer" },
  { id: "w2", name: "Bekzod", role: "washer" },
  { id: "w3", name: "Sardor", role: "washer" },
  { id: "w4", name: "Jasur", role: "washer" },
  { id: "m1", name: "Rustam usta", role: "master" },
  { id: "m2", name: "Dilshod usta", role: "master" },
];
async function cols() {
  const db = await getDb();
  return { db, bookings: db.collection("bookings"), staff: db.collection("staff"), cafe: db.collection("cafe"), users: db.collection("users"), counters: db.collection("counters") };
}
async function staffList(c) {
  let list = await c.staff.find({}, { projection: { _id: 0 } }).toArray();
  if (!list.length) {
    await c.staff.insertMany(DEFAULT_STAFF.map((s) => ({ ...s, active: true, createdAt: nowTs() }))).catch(() => {});
    list = await c.staff.find({}, { projection: { _id: 0 } }).toArray();
  }
  return list;
}
async function nextNum(c, key) {
  const r = await c.counters.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });
  return (r.value || r).seq;
}

// Bandlik: shu sanadagi faol bronlar
const busyQuery = (date) => ({ date, status: { $nin: ["cancelled", "noshow"] } });
const overlaps = (b, start, dur) => { const s = C.toMin(b.time); return s < start + dur && start < s + b.duration; };

function computeSlots({ kind, date, dur, staff, busy }) {
  const role = C.KINDS[kind].role;
  const team = staff.filter((s) => s.active && s.role === role);
  const isToday = date === C.today();
  const now = C.nowMin();
  const load = (id) => busy.filter((b) => b.staffId === id).length;
  return C.slotTimes(dur).map((time) => {
    const start = C.toMin(time);
    const past = isToday && start < now + 10;
    const free = past ? [] : team
      .filter((s) => !busy.some((b) => b.staffId === s.id && overlaps(b, start, dur)))
      .sort((a, b) => load(a.id) - load(b.id))
      .map((s) => ({ id: s.id, name: s.name }));
    return { time, past, free };
  }).filter((s) => !s.past);
}

/* =================== OCHIQ API =================== */
const r = express.Router();

r.get("/health", (_req, res) => res.json({ ok: true, today: C.today(), time: C.toHHMM(C.nowMin()) }));

r.get("/staff", wrap(async (_req, res) => {
  const c = await cols();
  res.json((await staffList(c)).filter((s) => s.active).map(({ id, name, role }) => ({ id, name, role })));
}));

r.get("/slots", wrap(async (req, res) => {
  const { service: svcId, carType: typeId, date } = req.query;
  const svc = C.service(svcId);
  if (!svc || !C.carType(typeId) || !C.isDate(date)) fail(400, "Noto'g'ri so'rov");
  const t = C.today();
  if (date < t || date > C.addDays(t, C.SHOP.daysAhead - 1)) return res.json({ slots: [] });
  const c = await cols();
  const [staff, busy] = await Promise.all([staffList(c), c.bookings.find(busyQuery(date), { projection: { _id: 0, staffId: 1, time: 1, duration: 1 } }).toArray()]);
  res.json({ date, slots: computeSlots({ kind: svc.kind, date, dur: C.durationOf(svcId, typeId), staff, busy }) });
}));

// Bugungi ochiq jadval: shaxsiy ma'lumotsiz (raqam yashirilgan, telefon yo'q)
const mask = (p) => String(p).replace(/^(\S+\s?\S?)(.*?)(\S{2})$/, (m, a, mid, b) => a + mid.replace(/\d/g, "•") + b);
r.get("/public/today", wrap(async (_req, res) => {
  const c = await cols();
  const date = C.today();
  const [list, staff] = await Promise.all([
    c.bookings.find({ date, status: { $in: ["booked", "arrived", "working", "done"] } }).sort({ time: 1 }).toArray(),
    staffList(c),
  ]);
  const name = (id) => staff.find((s) => s.id === id)?.name || "—";
  // Eng yaqin bo'sh moyka vaqti (bugun yoki ertaga)
  let nextFree = null;
  for (let d = 0; d < 2 && !nextFree; d++) {
    const dd = C.addDays(date, d);
    const busy = d === 0 ? list : await c.bookings.find(busyQuery(dd)).toArray();
    const s = computeSlots({ kind: "wash", date: dd, dur: C.durationOf("express", "sedan"), staff, busy }).find((x) => x.free.length);
    if (s) nextFree = { date: dd, time: s.time, tomorrow: d === 1 };
  }
  res.json({
    date, nextFree,
    items: list.map((b) => ({ code: b.code, kind: b.kind, time: b.time, plate: mask(b.plate), service: b.service, staff: name(b.startedBy || b.staffId), status: b.status, ref: crypto.createHash("sha1").update(b.id).digest("hex").slice(0, 10) })),
  });
}));

/* ---- Bron ---- */
r.post("/bookings", wrap(async (req, res) => {
  const b = req.body || {};
  const svc = C.service(b.service);
  if (!svc) fail(400, "Xizmatni tanlang.");
  if (!C.carType(b.carType)) fail(400, "Mashina turini tanlang.");
  const name = C.cleanText(b.name, 40);
  if (!C.validName(b.name)) fail(400, "Ismni to'g'ri yozing (faqat harflar).");
  const phone = C.normalizePhone(b.phone);
  if (!phone) fail(400, "Telefon raqam noto'g'ri. Masalan: +998 90 123 45 67");
  const plate = C.normalizePlate(b.plate);
  if (!plate) fail(400, "Avto raqam noto'g'ri. Masalan: 01 A 123 BC");
  const model = C.cleanText(b.model, 30);
  if (model.length < 2) fail(400, "Mashina modelini yozing.");
  const t = C.today();
  if (!C.isDate(b.date) || b.date < t || b.date > C.addDays(t, C.SHOP.daysAhead - 1)) fail(400, "Bu kunga bron qilib bo'lmaydi. Sahifani yangilab, kunni qayta tanlang.");
  const dur = C.durationOf(svc.id, b.carType);
  if (!C.isTime(b.time) || !C.slotTimes(dur).includes(b.time)) fail(400, "Bu vaqtda xizmat ish vaqti tugaguncha ulgurmaydi. Ertaroq vaqt tanlang.");
  if (b.date === t && C.toMin(b.time) < C.nowMin() + 10) fail(400, "Bu vaqt o'tib ketdi. Keyingi vaqtni tanlang.");

  const c = await cols();
  const key = C.plateKey(plate);
  if (await c.bookings.findOne({ plateKey: key, date: b.date, kind: svc.kind, status: { $in: C.ACTIVE } })) fail(409, "Bu mashina shu kunga allaqachon bron qilingan.");

  const [staff, busy] = await Promise.all([staffList(c), c.bookings.find(busyQuery(b.date)).toArray()]);
  const slot = computeSlots({ kind: svc.kind, date: b.date, dur, staff, busy }).find((s) => s.time === b.time);
  if (!slot || !slot.free.length) fail(409, "Bu vaqt band bo'lib qoldi. Boshqa vaqtni tanlang.");
  const chosen = b.staffId && b.staffId !== "any" ? slot.free.find((s) => s.id === b.staffId) : slot.free[0];
  if (!chosen) fail(409, "Tanlangan xodim bu vaqtda band. Boshqa vaqt yoki «Farqi yo'q»ni tanlang.");

  const user = bearer(req);
  const num = await nextNum(c, `${b.date}:${svc.kind}`);
  const doc = {
    id: rid(), num, code: `${C.KINDS[svc.kind].prefix}-${C.pad(num)}`, kind: svc.kind, service: svc.id, carType: b.carType,
    name, phone, plate, plateKey: key, model, date: b.date, time: b.time, duration: dur, price: C.priceOf(svc.id, b.carType),
    staffId: chosen.id, status: "booked", createdAt: nowTs(), userId: user && user.role === "user" ? user.uid : null,
  };
  await c.bookings.insertOne(doc);
  // Bir vaqtda ikki kishi bir xil xodimni olsa — keyingisi bekor qilinadi
  const clash = await c.bookings.find({ ...busyQuery(b.date), staffId: chosen.id, id: { $ne: doc.id } }).toArray();
  if (clash.some((x) => overlaps(x, C.toMin(doc.time), dur) && x.createdAt <= doc.createdAt)) {
    await c.bookings.deleteOne({ id: doc.id });
    fail(409, "Bu vaqt hozirgina band bo'ldi. Boshqa vaqtni tanlang.");
  }
  res.status(201).json(strip(doc));
}));

r.get("/bookings/mine", wrap(async (req, res) => {
  const ids = String(req.query.ids || "").split(",").map((s) => s.trim()).filter((s) => /^[\w-]{10,40}$/.test(s)).slice(0, 30);
  const user = bearer(req);
  const or = [];
  if (ids.length) or.push({ id: { $in: ids } });
  if (user && user.role === "user") or.push({ userId: user.uid });
  if (!or.length) return res.json([]);
  const c = await cols();
  const list = await c.bookings.find({ $or: or, date: { $gte: C.addDays(C.today(), -1) } }).sort({ date: 1, time: 1 }).limit(40).toArray();
  res.json(list.map(strip));
}));

r.get("/bookings/lookup", wrap(async (req, res) => {
  const code = String(req.query.code || "").toUpperCase().trim();
  const phone = C.normalizePhone(req.query.phone);
  if (!/^[MS]-\d{2,4}$/.test(code) || !phone) fail(400, "Kod (masalan M-03) va telefonni kiriting.");
  const c = await cols();
  const b = await c.bookings.findOne({ code, phone, date: { $gte: C.today() } }, { sort: { date: 1 } });
  if (!b) fail(404, "Bunday bron topilmadi.");
  res.json(strip(b));
}));

r.post("/bookings/:id/cancel", wrap(async (req, res) => {
  const c = await cols();
  const b = await c.bookings.findOne({ id: String(req.params.id) });
  if (!b) fail(404, "Bron topilmadi.");
  if (b.status !== "booked") fail(409, "Bu bronni endi bekor qilib bo'lmaydi.");
  await c.bookings.updateOne({ id: b.id }, { $set: { status: "cancelled", cancelledAt: nowTs() } });
  res.json({ ok: true });
}));

/* ---- Kafe ---- */
r.post("/cafe/orders", wrap(async (req, res) => {
  const b = req.body || {};
  const items = (Array.isArray(b.items) ? b.items : [])
    .map((it) => ({ id: String(it.id), qty: Math.floor(Number(it.qty)) }))
    .filter((it) => C.cafeItem(it.id) && it.qty >= 1 && it.qty <= 20);
  if (!items.length) fail(400, "Menyudan kamida bitta narsa tanlang.");
  const name = C.cleanText(b.name, 40);
  if (!C.validName(b.name)) fail(400, "Ismni to'g'ri yozing.");
  const phone = C.normalizePhone(b.phone);
  if (!phone) fail(400, "Telefon raqam noto'g'ri.");
  const where = b.where === "car" ? "car" : "cafe";
  const plate = where === "car" ? C.normalizePlate(b.plate) : "";
  if (where === "car" && !plate) fail(400, "Mashinangiz raqamini to'g'ri yozing — olib chiqamiz.");
  const now = C.nowMin();
  if (now < C.toMin(C.SHOP.open) || now > C.toMin(C.SHOP.close) - 15) fail(409, "Kafe hozir yopiq. Ish vaqti 07:30 – 23:30.");
  const c = await cols();
  const date = C.today();
  const n = await nextNum(c, `${date}:cafe`);
  const user = bearer(req);
  const doc = {
    id: rid(), code: `K-${C.pad(n)}`, date, items, total: items.reduce((s, it) => s + C.cafeItem(it.id).price * it.qty, 0),
    name, phone, where, plate, note: C.cleanText(b.note, 120), status: "new", createdAt: nowTs(),
    userId: user && user.role === "user" ? user.uid : null,
  };
  await c.cafe.insertOne(doc);
  res.status(201).json(strip(doc));
}));

r.get("/cafe/mine", wrap(async (req, res) => {
  const ids = String(req.query.ids || "").split(",").filter((s) => /^[\w-]{10,40}$/.test(s)).slice(0, 30);
  const user = bearer(req);
  const or = [];
  if (ids.length) or.push({ id: { $in: ids } });
  if (user && user.role === "user") or.push({ userId: user.uid });
  if (!or.length) return res.json([]);
  const c = await cols();
  res.json((await c.cafe.find({ $or: or, date: C.today() }).sort({ createdAt: 1 }).toArray()).map(strip));
}));

/* ---- Mijoz: ro'yxatdan o'tish / kirish ---- */
r.post("/auth/register", wrap(async (req, res) => {
  const b = req.body || {};
  const name = C.cleanText(b.name, 40);
  if (!C.validName(b.name)) fail(400, "Ismni to'g'ri yozing.");
  const phone = C.normalizePhone(b.phone);
  if (!phone) fail(400, "Telefon raqam noto'g'ri.");
  const pw = String(b.password || "");
  if (pw.length < 6 || pw.length > 72) fail(400, "Parol kamida 6 belgi bo'lsin.");
  const c = await cols();
  if (await c.users.findOne({ phone })) fail(409, "Bu raqam bilan ro'yxatdan o'tilgan. «Kirish»ni bosing.");
  const user = { id: rid(12), name, phone, passHash: hashPass(pw), createdAt: nowTs() };
  await c.users.insertOne(user);
  // Oldin mehmon sifatida qilingan bronlarni (shu qurilmadagi) akkauntga bog'lash
  const ids = (Array.isArray(b.claim) ? b.claim : []).filter((s) => /^[\w-]{10,40}$/.test(s)).slice(0, 30);
  if (ids.length) await c.bookings.updateMany({ id: { $in: ids }, phone, userId: null }, { $set: { userId: user.id } });
  res.status(201).json({ token: sign({ uid: user.id, role: "user" }, 24 * 30), user: { name, phone } });
}));

r.post("/auth/login", wrap(async (req, res) => {
  const phone = C.normalizePhone(req.body?.phone);
  const pw = String(req.body?.password || "");
  const c = await cols();
  const u = phone && (await c.users.findOne({ phone }));
  if (!u || !checkPass(pw, u.passHash)) fail(401, "Telefon yoki parol noto'g'ri.");
  res.json({ token: sign({ uid: u.id, role: "user" }, 24 * 30), user: { name: u.name, phone: u.phone } });
}));

r.get("/auth/me", wrap(async (req, res) => {
  const p = bearer(req);
  if (!p || p.role !== "user") fail(401, "Kirilmagan");
  const c = await cols();
  const u = await c.users.findOne({ id: p.uid });
  if (!u) fail(401, "Kirilmagan");
  res.json({ name: u.name, phone: u.phone });
}));

/* =================== ADMIN API =================== */
r.post("/admin/login", wrap(async (req, res) => {
  const L = process.env.ADMIN_LOGIN || "admin";
  const P = process.env.ADMIN_PASSWORD;
  if (!P) fail(503, "Admin paroli serverda sozlanmagan (ADMIN_PASSWORD).");
  const { login, password } = req.body || {};
  if (!sameText(login || "", L) || !sameText(password || "", P)) {
    await new Promise((ok) => setTimeout(ok, 600)); // parol terib ko'rishni sekinlashtirish
    fail(401, "Login yoki parol noto'g'ri.");
  }
  res.json({ token: sign({ role: "admin" }, 12) });
}));

const a = express.Router();
a.use(requireAdmin);
a.get("/me", (_req, res) => res.json({ ok: true }));

a.get("/bookings", wrap(async (req, res) => {
  const t = C.today();
  const from = C.isDate(req.query.from) ? req.query.from : C.addDays(t, -29);
  const to = C.isDate(req.query.to) ? req.query.to : C.addDays(t, 7);
  const c = await cols();
  res.json((await c.bookings.find({ date: { $gte: from, $lte: to } }).sort({ date: 1, time: 1 }).toArray()).map(({ _id, plateKey, ...x }) => x));
}));

// Jonli (oldindan yozilmagan) mijoz
a.post("/bookings", wrap(async (req, res) => {
  const b = req.body || {};
  const svc = C.service(b.service);
  if (!svc || !C.carType(b.carType)) fail(400, "Xizmat va mashina turini tanlang.");
  const plate = C.normalizePlate(b.plate);
  if (!plate) fail(400, "Avto raqam noto'g'ri.");
  const c = await cols();
  const staff = await staffList(c);
  const st = staff.find((s) => s.id === b.staffId && s.role === C.KINDS[svc.kind].role);
  if (!st) fail(400, "Xodimni tanlang.");
  const date = C.today();
  const num = await nextNum(c, `${date}:${svc.kind}`);
  const doc = {
    id: rid(), num, code: `${C.KINDS[svc.kind].prefix}-${C.pad(num)}`, kind: svc.kind, service: svc.id, carType: b.carType,
    name: C.cleanText(b.name, 40) || "Jonli mijoz", phone: C.normalizePhone(b.phone) || "", plate, plateKey: C.plateKey(plate),
    model: C.cleanText(b.model, 30), date, time: C.toHHMM(Math.floor(C.nowMin() / 5) * 5), duration: C.durationOf(svc.id, b.carType),
    price: C.priceOf(svc.id, b.carType), staffId: st.id, status: "arrived", createdAt: nowTs(), arrivedAt: nowTs(), walkin: true, userId: null,
  };
  await c.bookings.insertOne(doc);
  res.status(201).json(strip(doc));
}));

const FLOW = {
  arrive: { from: ["booked"], set: () => ({ status: "arrived", arrivedAt: nowTs() }) },
  start: { from: ["arrived", "booked"], set: (b, staffId) => ({ status: "working", startedAt: nowTs(), startedBy: staffId || b.staffId, staffId: staffId || b.staffId, arrivedAt: b.arrivedAt || nowTs() }) },
  done: { from: ["working"], set: () => ({ status: "done", doneAt: nowTs() }) },
  back: { from: ["working"], set: () => ({ status: "arrived", startedAt: null, startedBy: null }) },
  noshow: { from: ["booked", "arrived"], set: () => ({ status: "noshow" }) },
  cancel: { from: ["booked", "arrived"], set: () => ({ status: "cancelled", cancelledAt: nowTs() }) },
  restore: { from: ["noshow", "cancelled"], set: () => ({ status: "booked", arrivedAt: null, startedAt: null, startedBy: null, doneAt: null }) },
};
a.patch("/bookings/:id", wrap(async (req, res) => {
  const c = await cols();
  const b = await c.bookings.findOne({ id: String(req.params.id) });
  if (!b) fail(404, "Bron topilmadi.");
  const { action, staffId } = req.body || {};
  const staff = await staffList(c);
  if (staffId && !staff.some((s) => s.id === staffId && s.role === C.KINDS[b.kind].role)) fail(400, "Bu xodim bu bo'limda ishlamaydi.");
  let set;
  if (action) {
    const f = FLOW[action];
    if (!f) fail(400, "Noma'lum amal.");
    if (!f.from.includes(b.status)) fail(409, `«${C.STATUS[b.status]}» holatidan bu amalni qilib bo'lmaydi.`);
    set = f.set(b, staffId);
  } else if (staffId) {
    if (!["booked", "arrived"].includes(b.status)) fail(409, "Ish boshlangandan keyin xodimni almashtirib bo'lmaydi.");
    set = { staffId };
  } else fail(400, "O'zgarish yo'q.");
  await c.bookings.updateOne({ id: b.id }, { $set: set });
  res.json(strip({ ...b, ...set }));
}));

a.delete("/bookings/:id", wrap(async (req, res) => {
  const c = await cols();
  await c.bookings.deleteOne({ id: String(req.params.id) });
  res.json({ ok: true });
}));

a.get("/staff", wrap(async (_req, res) => res.json(await staffList(await cols()))));
a.post("/staff", wrap(async (req, res) => {
  const name = C.cleanText(req.body?.name, 40);
  const role = req.body?.role === "master" ? "master" : "washer";
  if (!C.validName(req.body?.name)) fail(400, "Ismni to'g'ri yozing.");
  const c = await cols();
  const s = { id: (role === "washer" ? "w" : "m") + rid(6), name, role, active: true, createdAt: nowTs() };
  await c.staff.insertOne(s);
  res.status(201).json(strip(s));
}));
a.patch("/staff/:id", wrap(async (req, res) => {
  const set = {};
  if (req.body?.name != null) { const n = C.cleanText(req.body.name, 40); if (!C.validName(req.body.name)) fail(400, "Ismni to'g'ri yozing."); set.name = n; }
  if (req.body?.active != null) set.active = !!req.body.active;
  const c = await cols();
  await c.staff.updateOne({ id: String(req.params.id) }, { $set: set });
  res.json({ ok: true });
}));
a.delete("/staff/:id", wrap(async (req, res) => {
  const c = await cols();
  const id = String(req.params.id);
  if (await c.bookings.findOne({ $or: [{ staffId: id }, { startedBy: id }] })) fail(409, "Bu xodimning bronlari bor — o'chirish o'rniga «Dam olishda» qiling.");
  await c.staff.deleteOne({ id });
  res.json({ ok: true });
}));

a.get("/cafe", wrap(async (req, res) => {
  const t = C.today();
  const from = C.isDate(req.query.from) ? req.query.from : t;
  const c = await cols();
  res.json((await c.cafe.find({ date: { $gte: from, $lte: t } }).sort({ createdAt: 1 }).toArray()).map(strip));
}));
const CAFE_FLOW = { making: ["new"], ready: ["making"], given: ["ready"], cancelled: ["new", "making", "ready"] };
a.patch("/cafe/:id", wrap(async (req, res) => {
  const to = req.body?.status;
  if (!CAFE_FLOW[to]) fail(400, "Noma'lum holat.");
  const c = await cols();
  const o = await c.cafe.findOne({ id: String(req.params.id) });
  if (!o) fail(404, "Buyurtma topilmadi.");
  if (!CAFE_FLOW[to].includes(o.status)) fail(409, "Bu holatga o'tkazib bo'lmaydi.");
  const set = { status: to, [`${to}At`]: nowTs() };
  await c.cafe.updateOne({ id: o.id }, { $set: set });
  res.json(strip({ ...o, ...set }));
}));

r.use("/admin", a);

app.use("/api", r);
app.use(r); // Vercel ba'zan yo'lni /api prefiksisiz uzatadi

/* ---------------- Xatolar ---------------- */
app.use((req, res) => res.status(404).json({ error: "Topilmadi" }));
app.use((err, _req, res, _next) => {
  const status = err.status || (err.type === "entity.parse.failed" ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 && !err.status ? "Serverda xatolik. Birozdan keyin urinib ko'ring." : err.message });
});

module.exports = app;
