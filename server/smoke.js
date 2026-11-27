// API sinovi: sharhda topilgan har bir xato uchun tekshiruv. `npm test`
const assert = require("assert/strict");
const C = require("../catalog.js");

async function main() {
  const { MongoMemoryServer } = require("mongodb-memory-server");
  const mem = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mem.getUri();
  process.env.ADMIN_PASSWORD = "test-pass-123";
  process.env.TOKEN_SECRET = "test-secret-0123456789abcdef";
  const app = require("./app");
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (path, { method = "GET", body, token } = {}) => {
    const r = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, data: await r.json().catch(() => null) };
  };
  let passed = 0;
  const ok = async (name, fn) => { await fn(); passed++; console.log("  ✓", name); };

  const tomorrow = C.addDays(C.today(), 1);
  const good = { service: "express", carType: "sedan", date: tomorrow, time: "10:00", staffId: "any", name: "Jasur", phone: "+998 90 123 45 67", plate: "01 A 777 AA", model: "Cobalt" };

  try {
    await ok("health", async () => { const r = await call("/health"); assert.equal(r.status, 200); });
    await ok("xodimlar standart ro'yxati", async () => { const r = await call("/staff"); assert.ok(r.data.length >= 4); });

    await ok("bron yaratiladi va xodim biriktiriladi", async () => {
      const r = await call("/bookings", { method: "POST", body: good });
      assert.equal(r.status, 201, JSON.stringify(r.data));
      assert.match(r.data.code, /^M-\d+$/);
      assert.ok(r.data.staffId);
      good.id = r.data.id;
    });
    await ok("[bug 5] bir xil mashina boshqa yozilishda (01A777AA) — rad", async () => {
      const r = await call("/bookings", { method: "POST", body: { ...good, plate: "01a777aa", time: "12:00" } });
      assert.equal(r.status, 409);
    });
    await ok("[bug 5] telefon ++++++++++ — rad", async () => {
      const r = await call("/bookings", { method: "POST", body: { ...good, phone: "++++++++++", plate: "10 B 111 BB" } });
      assert.equal(r.status, 400);
    });
    await ok("[bug 5] raqam !!!! — rad", async () => {
      const r = await call("/bookings", { method: "POST", body: { ...good, plate: "!!!!" } });
      assert.equal(r.status, 400);
    });
    await ok("[bug 5] ism o'rniga belgilar — rad", async () => {
      const r = await call("/bookings", { method: "POST", body: { ...good, name: "<script>", plate: "10 B 112 BB" } });
      assert.equal(r.status, 400);
    });
    await ok("[bug 3] o'tgan sanaga bron — rad", async () => {
      const r = await call("/bookings", { method: "POST", body: { ...good, date: C.addDays(C.today(), -1), plate: "10 B 113 BB" } });
      assert.equal(r.status, 400);
    });
    await ok("[bug 4] 4 soatlik motor ta'miri 23:00 ga — rad (23:30 da yopiladi)", async () => {
      const r = await call("/bookings", { method: "POST", body: { ...good, service: "motor", time: "23:00", plate: "10 B 114 BB" } });
      assert.equal(r.status, 400);
    });
    await ok("[bug 4] motor uchun oxirgi vaqt 19:30, slotlarda 23:00 yo'q", async () => {
      const r = await call(`/slots?service=motor&carType=sedan&date=${tomorrow}`);
      const times = r.data.slots.map((s) => s.time);
      assert.equal(times.at(-1), "19:30");
      assert.ok(!times.includes("23:00"));
    });
    await ok("bir xodim bir vaqtda ikki joyda bo'lmaydi", async () => {
      const team = (await call("/staff")).data.filter((s) => s.role === "washer");
      for (let i = 0; i < team.length - 1; i++) {
        const r = await call("/bookings", { method: "POST", body: { ...good, time: "10:00", plate: `20 C ${200 + i} CC` } });
        assert.equal(r.status, 201);
      }
      const full = await call("/bookings", { method: "POST", body: { ...good, time: "10:00", plate: "20 C 299 CC" } });
      assert.equal(full.status, 409, "hamma moyshik band bo'lishi kerak");
    });
    await ok("ochiq jadvalda telefon va to'liq raqam yo'q", async () => {
      const r = await call("/public/today");
      assert.ok(!JSON.stringify(r.data).includes("998901234567"));
    });
    await ok("mening bronim id orqali qaytadi", async () => {
      const r = await call(`/bookings/mine?ids=${good.id}`);
      assert.equal(r.data[0].id, good.id);
    });
    await ok("bronni kod + telefon bilan topish", async () => {
      const mine = (await call(`/bookings/mine?ids=${good.id}`)).data[0];
      const r = await call(`/bookings/lookup?code=${mine.code}&phone=901234567`);
      assert.equal(r.status, 200);
      assert.equal(r.data.id, good.id);
    });

    await ok("[bug 6] admin API tokensiz — 401", async () => {
      assert.equal((await call("/admin/bookings")).status, 401);
      assert.equal((await call("/admin/me", { token: "soxta.token" })).status, 401);
    });
    await ok("[bug 6] noto'g'ri parol — 401, to'g'ri parol — token", async () => {
      assert.equal((await call("/admin/login", { method: "POST", body: { login: "admin", password: "carbon2026" } })).status, 401);
      const r = await call("/admin/login", { method: "POST", body: { login: "admin", password: "test-pass-123" } });
      assert.equal(r.status, 200);
      good.admin = r.data.token;
    });
    await ok("admin: keldi → boshladi → tayyor, noto'g'ri o'tish rad", async () => {
      const t = good.admin;
      assert.equal((await call(`/admin/bookings/${good.id}`, { method: "PATCH", token: t, body: { action: "done" } })).status, 409);
      assert.equal((await call(`/admin/bookings/${good.id}`, { method: "PATCH", token: t, body: { action: "arrive" } })).status, 200);
      assert.equal((await call(`/admin/bookings/${good.id}`, { method: "PATCH", token: t, body: { action: "start" } })).status, 200);
      const d = await call(`/admin/bookings/${good.id}`, { method: "PATCH", token: t, body: { action: "done" } });
      assert.equal(d.data.status, "done");
      assert.ok(d.data.doneAt && d.data.startedBy);
    });
    await ok("mijoz holat o'zgarganini ko'radi (Notification uchun)", async () => {
      const r = await call(`/bookings/mine?ids=${good.id}`);
      assert.equal(r.data[0].status, "done");
    });

    await ok("ro'yxatdan o'tish, takroriy raqam rad, kirish", async () => {
      const reg = await call("/auth/register", { method: "POST", body: { name: "Kamola", phone: "93 555 44 33", password: "secret12" } });
      assert.equal(reg.status, 201);
      assert.equal((await call("/auth/register", { method: "POST", body: { name: "Kamola", phone: "+998935554433", password: "secret12" } })).status, 409);
      assert.equal((await call("/auth/login", { method: "POST", body: { phone: "+998935554433", password: "wrong!!" } })).status, 401);
      const log = await call("/auth/login", { method: "POST", body: { phone: "935554433", password: "secret12" } });
      assert.equal(log.status, 200);
      good.user = log.data.token;
      assert.equal((await call("/auth/me", { token: good.user })).data.name, "Kamola");
    });
    await ok("akkaunt bilan qilingan bron boshqa qurilmada ham ko'rinadi", async () => {
      const b = await call("/bookings", { method: "POST", token: good.user, body: { ...good, plate: "30 K 555 KA", time: "14:00", name: "Kamola", phone: "935554433" } });
      assert.equal(b.status, 201);
      const mine = await call("/bookings/mine", { token: good.user }); // id'larsiz, faqat token
      assert.ok(mine.data.some((x) => x.id === b.data.id));
    });

    await ok("kafe: narx serverda hisoblanadi, noto'g'ri mahsulot o'tmaydi", async () => {
      const now = C.nowMin();
      const r = await call("/cafe/orders", { method: "POST", body: { items: [{ id: "latte", qty: 2 }, { id: "fake", qty: 5 }], name: "Jasur", phone: "901234567", where: "cafe", total: 1 } });
      if (now < C.toMin(C.SHOP.open) || now > C.toMin(C.SHOP.close) - 15) { assert.equal(r.status, 409); return; }
      assert.equal(r.status, 201);
      assert.equal(r.data.total, 54000);
      assert.equal(r.data.items.length, 1);
    });
    console.log(`\n${passed} ta tekshiruv o'tdi.`);
  } catch (e) {
    console.error(`\n✗ ${passed + 1}-tekshiruv yiqildi: ${e.message}`);
    process.exitCode = 1;
  } finally {
    server.close();
    await mem.stop();
  }
}
main().then(() => process.exit(process.exitCode || 0)).catch((e) => { console.error(e); process.exit(1); });
