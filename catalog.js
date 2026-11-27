// Carbon — umumiy katalog va qoidalar. Brauzerda ham (<script>), serverda ham (require) ishlaydi.
// Narx/vaqt/tekshiruv qoidalari bitta joyda — sayt va API bir xil hisoblaydi.
(function (root) {
  const SHOP = { open: "07:30", close: "23:30", slot: 30, daysAhead: 7, tzOffsetMin: 300, phone: "+998 90 067 77 74" };

  const KINDS = {
    wash: { name: "Moyka", role: "washer", roleName: "Moyshik", prefix: "M" },
    service: { name: "Avtoservis", role: "master", roleName: "Usta", prefix: "S" },
  };

  // Narxlar namuna — haqiqiylari bilan almashtiring. from: true — "...dan" (aniq narx ko'rikdan keyin).
  const SERVICES = [
    { id: "express", kind: "wash", name: "Ekspress yuvish", desc: "Kuzovni faol ko'pik bilan yuvish, yuqori bosimda chayish va mikrofibra bilan quritish.", price: 50000, min: 20, icon: "drop" },
    { id: "full", kind: "wash", name: "Kompleks yuvish", desc: "Kuzov, salon changyutgich, oynalar ichi-tashqarisi va gilamchalar.", price: 90000, min: 40, icon: "car" },
    { id: "premium", kind: "wash", name: "Premium", desc: "Kompleks yuvish ustiga himoya mumi, shinalarga qora rang va salon plastigiga parvarish.", price: 150000, min: 60, icon: "spark", feature: true },
    { id: "salon", kind: "wash", name: "Salonni kimyoviy tozalash", desc: "O'rindiqlar, shift, eshik qoplamalari va polni chuqur tozalash, dog' va hidlarni yo'qotish.", price: 400000, min: 180, icon: "seat" },
    { id: "diag", kind: "service", name: "Kompyuter diagnostika", desc: "Skaner bilan xatolarni o'qish, dvigatel va datchiklar holatini tekshirish.", price: 100000, min: 30, icon: "scan" },
    { id: "oil", kind: "service", name: "Moy almashtirish", desc: "Motor moyi va filtrlarni almashtirish. Moyingizni olib kelsangiz ham bo'ladi.", price: 60000, min: 30, icon: "oil", from: true },
    { id: "razval", kind: "service", name: "Razval-shoxojdeniye", desc: "G'ildiraklar burchagini 3D stendda sozlash.", price: 150000, min: 40, icon: "align" },
    { id: "balance", kind: "service", name: "Balansirovka", desc: "4 ta g'ildirakni balansirovka qilish, rulda titrashni yo'qotish.", price: 80000, min: 40, icon: "wheel" },
    { id: "tire", kind: "service", name: "Shinomontaj", desc: "Shinani yechish-taqish, almashtirish, teshikni yamash.", price: 80000, min: 30, icon: "wheel", from: true },
    { id: "chassis", kind: "service", name: "Xodovoy ta'miri", desc: "Amortizator, richag, sharovoy, rulevoy uchlari: tekshirish va almashtirish.", price: 200000, min: 120, icon: "spring", from: true },
    { id: "motor", kind: "service", name: "Motor ta'miri", desc: "Dvigatel nosozliklarini topish va ta'mirlash.", price: 500000, min: 240, icon: "engine", from: true },
    { id: "gearbox", kind: "service", name: "Karobka ta'miri", desc: "Mexanik va avtomat uzatmalar qutisi: diagnostika, moy almashtirish, ta'mir.", price: 600000, min: 240, icon: "gear", from: true },
  ];

  const CAR_TYPES = [
    { id: "sedan", name: "Yengil", hint: "sedan, hetchbek", k: 1 },
    { id: "cross", name: "Krossover", hint: "Tracker, Tucson", k: 1.2 },
    { id: "suv", name: "Jip / miniven", hint: "Tahoe, Damas", k: 1.4 },
  ];

  const STATUS = { booked: "Bron qilingan", arrived: "Keldi", working: "Ishlanmoqda", done: "Tayyor", noshow: "Kelmadi", cancelled: "Bekor qilindi" };
  const ACTIVE = ["booked", "arrived", "working"];

  // Kafe menyusi namuna — haqiqiysi bilan almashtiring.
  const CAFE_MENU = [
    { id: "espresso", cat: "Qahva", name: "Espresso", desc: "30 ml, quyuq", price: 15000 },
    { id: "americano", cat: "Qahva", name: "Amerikano", desc: "250 ml", price: 18000 },
    { id: "cappuccino", cat: "Qahva", name: "Kapuchino", desc: "300 ml, sut ko'pigi", price: 25000 },
    { id: "latte", cat: "Qahva", name: "Latte", desc: "350 ml", price: 27000 },
    { id: "raf", cat: "Qahva", name: "Raf", desc: "350 ml, vanilli", price: 30000 },
    { id: "icelatte", cat: "Qahva", name: "Ays-latte", desc: "400 ml, muzli", price: 29000 },
    { id: "greentea", cat: "Choy", name: "Ko'k choy", desc: "choynakda", price: 12000 },
    { id: "lemontea", cat: "Choy", name: "Limonli qora choy", desc: "choynakda", price: 15000 },
    { id: "croissant", cat: "Yegulik", name: "Kruassan", desc: "sariyog'li", price: 20000 },
    { id: "sandwich", cat: "Yegulik", name: "Sendvich", desc: "tovuqli", price: 32000 },
  ];
  const CAFE_STATUS = { new: "Yangi", making: "Tayyorlanmoqda", ready: "Tayyor", given: "Berildi", cancelled: "Bekor" };

  /* ---- Vaqt: hamma joyda Toshkent vaqti (UTC+5), brauzer yoki server qaysi zonada bo'lishidan qat'i nazar ---- */
  const pad = (n) => String(n).padStart(2, "0");
  const tzNow = () => new Date(Date.now() + SHOP.tzOffsetMin * 60000); // UTC-maydonlari Toshkent vaqtini beradi
  const today = () => { const d = tzNow(); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
  const nowMin = () => { const d = tzNow(); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
  const addDays = (date, n) => { const d = new Date(date + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
  const dateOfTs = (ts) => { const d = new Date(ts + SHOP.tzOffsetMin * 60000); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
  const toMin = (hhmm) => { const [h, m] = String(hhmm).split(":").map(Number); return h * 60 + m; };
  const toHHMM = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
  const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
  const isTime = (s) => /^\d{2}:\d{2}$/.test(s || "");

  const service = (id) => SERVICES.find((s) => s.id === id);
  const carType = (id) => CAR_TYPES.find((c) => c.id === id);
  const cafeItem = (id) => CAFE_MENU.find((m) => m.id === id);
  const priceOf = (svcId, typeId) => Math.round((service(svcId).price * carType(typeId).k) / 1000) * 1000;
  const durationOf = (svcId, typeId) => Math.ceil((service(svcId).min * (service(svcId).kind === "wash" ? carType(typeId).k : 1)) / 10) * 10;

  // Ish vaqtidagi barcha boshlanish vaqtlari: xizmat yopilishdan oldin TUGASHI kerak
  function slotTimes(dur) {
    const out = [];
    for (let t = toMin(SHOP.open); t + dur <= toMin(SHOP.close); t += SHOP.slot) out.push(toHHMM(t));
    return out;
  }

  /* ---- Tekshiruvlar ---- */
  // Telefon: faqat O'zbekiston raqami, 998XXXXXXXXX ko'rinishiga keltiriladi
  function normalizePhone(raw) {
    const d = String(raw || "").replace(/\D/g, "");
    const full = d.length === 9 ? "998" + d : d;
    return /^998\d{9}$/.test(full) ? "+" + full : null;
  }
  // Avto raqam: harf/raqamdan boshqasini olib tashlab solishtiriladi (01 A 777 AA == 01A777AA)
  const plateKey = (raw) => String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  function normalizePlate(raw) {
    const k = plateKey(raw);
    // O'zbekiston formatlari: 01A123BC, 01123ABC (+ eski/maxsus 7–9 belgili)
    if (!/^\d{2}[A-Z0-9]{5,7}$/.test(k) || !/[A-Z]/.test(k)) return null;
    let m = k.match(/^(\d{2})([A-Z])(\d{3})([A-Z]{2})$/);
    if (m) return `${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
    m = k.match(/^(\d{2})(\d{3})([A-Z]{3})$/);
    if (m) return `${m[1]} ${m[2]} ${m[3]}`;
    return k;
  }
  const cleanText = (s, max = 60) => String(s || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max);
  // Ism tozalanishdan OLDIN tekshiriladi: <script> kabi kiritish "script" bo'lib o'tib ketmasin
  const validName = (s) => /^[\p{L}][\p{L} 'ʻʼ`.-]{1,39}$/u.test(String(s || "").trim());

  const api = {
    SHOP, KINDS, SERVICES, CAR_TYPES, STATUS, ACTIVE, CAFE_MENU, CAFE_STATUS,
    pad, tzNow, today, nowMin, addDays, dateOfTs, toMin, toHHMM, isDate, isTime,
    service, carType, cafeItem, priceOf, durationOf, slotTimes,
    normalizePhone, plateKey, normalizePlate, cleanText, validName,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== "undefined" ? globalThis : this);
