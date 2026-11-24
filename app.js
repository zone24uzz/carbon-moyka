// Carbon Car Wash: ro'yxatdan o'tish, navbat va admin panel.
// Ma'lumotlar brauzerning localStorage'ida saqlanadi (backend yo'q).

const ICONS = {
  drop: '<path d="M12 3.5c3.5 4.2 6 7.4 6 10.5a6 6 0 0 1-12 0c0-3.1 2.5-6.3 6-10.5Z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
  car: '<path d="M4 16.5V13l2-5h12l2 5v3.5M4 16.5h16M4 16.5V19h3v-2.5M17 16.5V19h3v-2.5M6 13h12"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  seat: '<path d="M6 11V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5M4 11a2 2 0 0 1 2 2v2h12v-2a2 2 0 0 1 4 0v4H2v-4a2 2 0 0 1 2-2ZM5 17v3M19 17v3"/>',
  arrow: '<path d="M7 17 17 7M8 7h9v9"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

// Narxlar namuna: haqiqiylari bilan almashtiring.
const SERVICES = [
  { id: "express", name: "Ekspress yuvish", desc: "Kuzovni faol ko'pik bilan yuvish, yuqori bosimda chayish va mikrofibra bilan quritish.", price: 50000, min: 15, icon: "drop" },
  { id: "full", name: "Kompleks yuvish", desc: "Kuzov, salon changyutgich, oynalar ichi-tashqarisi va gilamchalar.", price: 90000, min: 35, icon: "car" },
  { id: "premium", name: "Premium", desc: "Kompleks yuvish ustiga himoya mumi, shinalarga qora rang va salon plastigiga parvarish. Mashina ko'rgazmadan chiqqandek bo'ladi.", price: 150000, min: 50, icon: "spark", feature: true },
  { id: "salon", name: "Salonni kimyoviy tozalash", desc: "O'rindiqlar, shift, eshik qoplamalari va polni chuqur tozalash, dog' va hidlarni yo'qotish.", price: 400000, min: 180, icon: "seat", wide: true },
];

// Admin kirish ma'lumotlari. Sayt serverga qo'yilsa, buni backendga o'tkazing.
const ADMIN = { login: "admin", password: "carbon2026" };

const KEY = "carbon_queue";
const MY_KEY = "carbon_my_ticket";
const STATUS = { waiting: "Navbatda", washing: "Yuvilmoqda", done: "Tayyor" };

const $ = (s) => document.querySelector(s);
const fmt = (n) => n.toLocaleString("ru-RU").replace(/\s|,/g, " ");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const service = (id) => SERVICES.find((s) => s.id === id) || SERVICES[0];
const time = (ts) => new Date(ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
const isToday = (ts) => new Date(ts).toDateString() === new Date().toDateString();

const load = () => JSON.parse(localStorage.getItem(KEY) || "[]");
const save = (list) => localStorage.setItem(KEY, JSON.stringify(list));
const active = (list) => list.filter((x) => x.status !== "done").sort((a, b) => a.createdAt - b.createdAt);
const badge = (status) => `<span class="badge badge--${status}">${STATUS[status]}</span>`;

// Shu yozuvdan oldin kutiladigan taxminiy daqiqalar (id yo'q bo'lsa — butun navbat)
function waitMinutes(list, id) {
  let total = 0;
  for (const x of active(list)) {
    if (x.id === id) break;
    total += x.status === "washing" ? Math.ceil(service(x.service).min / 2) : service(x.service).min;
  }
  return total;
}

function startClock() {
  const el = $("#clock");
  if (!el) return;
  const tick = () => (el.textContent = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }));
  tick();
  setInterval(tick, 15000);
}

// Ko'rinish maydoniga kirganda sekin paydo bo'lish
function initReveal() {
  document.documentElement.classList.add("js");
  const io = new IntersectionObserver((entries) => {
    entries.filter((e) => e.isIntersecting).forEach((e, i) => {
      e.target.style.setProperty("--d", `${i * 0.08}s`);
      e.target.classList.add("is-in");
      io.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
}

/* ================= SAYT ================= */
function initSite() {
  $("#year").textContent = new Date().getFullYear();

  // Mobil menyu
  const burger = $("#burger");
  const toggleMenu = (open) => {
    document.body.classList.toggle("menu-open", open);
    burger.setAttribute("aria-expanded", open);
    burger.setAttribute("aria-label", open ? "Menyuni yopish" : "Menyuni ochish");
    $("#menu").setAttribute("aria-hidden", !open);
  };
  burger.addEventListener("click", () => toggleMenu(!document.body.classList.contains("menu-open")));
  $("#menu").addEventListener("click", (e) => e.target.closest("a") && toggleMenu(false));
  document.addEventListener("keydown", (e) => e.key === "Escape" && toggleMenu(false));

  // Xizmatlar (bento): featured birinchi, wide oxirida
  const order = [...SERVICES].sort((a, b) => (b.feature ? 1 : 0) - (a.feature ? 1 : 0) || (a.wide ? 1 : 0) - (b.wide ? 1 : 0));
  $("#servicesList").innerHTML = order.map((s) => `
    <article class="bezel reveal ${s.feature ? "is-feature" : ""} ${s.wide ? "is-wide" : ""}">
      <div class="bezel__core svc">
        ${s.feature ? '<span class="svc__tag">Eng ko\'p tanlanadi</span>' : ""}
        <span class="svc__icon">${svg(s.icon)}</span>
        <h3>${s.name}</h3>
        <p>${s.desc}</p>
        <div class="svc__foot">
          <div>
            <span class="svc__time">~${s.min} DAQIQA</span>
            <span class="svc__price">${fmt(s.price)}<small>so'm</small></span>
          </div>
          <a href="#register" class="svc__pick" data-pick="${s.id}">Tanlash ${svg("arrow")}</a>
        </div>
      </div>
    </article>`).join("");

  $("#serviceChips").innerHTML = SERVICES.map((s, i) => `
    <label class="chip">
      <input type="radio" name="service" value="${s.id}" ${i === 0 ? "checked" : ""}>
      <span>${s.name}<small>${fmt(s.price)} so'm · ${s.min} daq</small></span>
    </label>`).join("");

  $("#servicesList").addEventListener("click", (e) => {
    const pick = e.target.closest("[data-pick]");
    if (pick) {
      const radio = document.querySelector(`input[name="service"][value="${pick.dataset.pick}"]`);
      if (radio) radio.checked = true;
    }
  });

  $("#registerForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    const data = Object.fromEntries(new FormData(f));
    const phone = data.phone.replace(/[^\d+]/g, "");
    f.querySelectorAll("input").forEach((i) => i.removeAttribute("aria-invalid"));

    const fail = (field, msg) => {
      $("#formError").textContent = msg;
      if (field) { f[field].setAttribute("aria-invalid", "true"); f[field].focus(); }
    };
    if (data.name.trim().length < 2) return fail("name", "Ismingizni kiriting.");
    if (phone.replace("+", "").length < 9) return fail("phone", "Telefon raqam to'liq emas.");
    if (data.plate.trim().length < 4) return fail("plate", "Avtomobil raqamini kiriting.");

    const list = load();
    const plate = data.plate.trim().toUpperCase().replace(/\s+/g, " ");
    if (active(list).some((x) => x.plate === plate)) return fail("plate", "Bu avtomobil allaqachon navbatda.");
    $("#formError").textContent = "";

    const todayNums = list.filter((x) => isToday(x.createdAt)).map((x) => x.num);
    const item = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      num: todayNums.length ? Math.max(...todayNums) + 1 : 1,
      name: data.name.trim(),
      phone,
      plate,
      model: data.model.trim(),
      service: data.service,
      status: "waiting",
      createdAt: Date.now(),
    };
    list.push(item);
    save(list);
    localStorage.setItem(MY_KEY, item.id);
    f.reset();
    renderSite();
  });

  $("#myTicket").addEventListener("click", (e) => {
    const act = e.target.closest("[data-ticket]")?.dataset.ticket;
    if (!act) return;
    const myId = localStorage.getItem(MY_KEY);
    if (act === "cancel") save(load().filter((x) => x.id !== myId));
    localStorage.removeItem(MY_KEY);
    renderSite();
  });

  startClock();
  initReveal();
  renderSite();
  setInterval(renderSite, 5000);
  window.addEventListener("storage", renderSite);
}

function renderSite() {
  const list = load();
  const queue = active(list);
  const waiting = queue.filter((x) => x.status === "waiting");
  const washing = queue.filter((x) => x.status === "washing");
  const myId = localStorage.getItem(MY_KEY);
  const mine = list.find((x) => x.id === myId);

  // Jonli panel
  $("#statWaiting").textContent = waiting.length;
  $("#statWashing").textContent = washing.length;
  $("#statWait").textContent = waitMinutes(list, null);
  $("#boardNow").textContent = washing.length ? washing.map((x) => `№${x.num} · ${x.plate}`).join(", ") : "Boks bo'sh";
  $("#boardNext").innerHTML = waiting.length
    ? waiting.slice(0, 4).map((x) => `<li><span>№${x.num}</span><span>${esc(x.plate)}</span><span class="mono-label">~${waitMinutes(list, x.id)} daq</span></li>`).join("")
    : `<li class="empty-row">Navbat bo'sh — hoziroq kelishingiz mumkin.</li>`;

  // Navbat ro'yxati
  $("#queueList").innerHTML = queue.length
    ? queue.map((x) => `
      <div class="q-item ${x.id === myId ? "is-mine" : ""}">
        <span class="q-item__num">№${x.num}</span>
        <div class="q-item__plate">${esc(x.plate)}${x.id === myId ? " · siz" : ""}<small>${service(x.service).name}</small></div>
        <span class="q-item__eta">${x.status === "waiting" ? `~${waitMinutes(list, x.id)} daq` : "boksda"}</span>
        ${badge(x.status)}
      </div>`).join("")
    : `<div class="q-empty">Navbat bo'sh. Hoziroq kelsangiz, darhol yuvamiz.</div>`;

  // Mening chiptam
  const form = $("#registerForm");
  const ticket = $("#myTicket");
  if (!mine) {
    form.classList.remove("hidden");
    ticket.classList.add("hidden");
    return;
  }

  const ahead = queue.findIndex((x) => x.id === mine.id);
  let pos;
  if (mine.status === "done") pos = "Mashinangiz tayyor. Olib ketishingiz mumkin.";
  else if (mine.status === "washing") pos = "Mashinangiz hozir yuvilmoqda.";
  else if (ahead === 0) pos = "Siz navbatda birinchisiz. Kelishingiz mumkin.";
  else pos = `Oldingizda ${ahead} ta mashina, taxminan ${waitMinutes(list, mine.id)} daqiqa.`;

  const s = service(mine.service);
  form.classList.add("hidden");
  ticket.classList.remove("hidden");
  ticket.innerHTML = `
    <span class="mono-label">Sizning navbatingiz</span>
    <span class="ticket__num">№${mine.num}</span>
    ${badge(mine.status)}
    <p class="ticket__pos">${pos}</p>
    <span class="ticket__line"></span>
    <p class="ticket__meta">${esc(mine.plate)} · ${s.name} · ${fmt(s.price)} so'm</p>
    <div class="ticket__actions">
      ${mine.status === "waiting" ? `<button class="btn btn--ghost btn--sm" data-ticket="cancel">Navbatni bekor qilish</button>` : ""}
      ${mine.status === "done" ? `<button class="btn btn--sm" data-ticket="new">Yangi navbat olish<span class="btn__icon">${svg("arrow")}</span></button>` : ""}
    </div>`;
}

/* ================= ADMIN ================= */
let filter = "active";
const logged = () => sessionStorage.getItem("carbon_admin") === "1";

function initAdmin() {
  const show = () => {
    $("#loginView").classList.toggle("hidden", logged());
    $("#panelView").classList.toggle("hidden", !logged());
    if (logged()) renderAdmin();
  };

  $("#loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const { login, password } = Object.fromEntries(new FormData(e.target));
    if (login === ADMIN.login && password === ADMIN.password) {
      sessionStorage.setItem("carbon_admin", "1");
      show();
    } else {
      $("#loginError").textContent = "Login yoki parol noto'g'ri.";
    }
  });

  $("#logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem("carbon_admin");
    show();
  });

  $("#tabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    filter = btn.dataset.filter;
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("is-active", t === btn));
    renderAdmin();
  });

  $("#search").addEventListener("input", renderAdmin);

  $("#clearDone").addEventListener("click", () => {
    if (confirm("Tayyor bo'lgan yozuvlar o'chirilsinmi?")) {
      save(load().filter((x) => x.status !== "done"));
      renderAdmin();
    }
  });

  $("#adminTable").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const list = load();
    const item = list.find((x) => x.id === btn.dataset.id);
    if (!item) return;
    const act = btn.dataset.act;

    if (act === "delete") {
      if (!confirm(`№${item.num} (${item.plate}) o'chirilsinmi?`)) return;
      save(list.filter((x) => x.id !== item.id));
    } else {
      item.status = act;
      if (act === "done") item.doneAt = Date.now();
      save(list);
    }
    renderAdmin();
  });

  startClock();
  show();
  setInterval(() => logged() && renderAdmin(), 5000);
  window.addEventListener("storage", () => logged() && renderAdmin());
}

function renderAdmin() {
  const list = load();
  const doneToday = list.filter((x) => x.status === "done" && isToday(x.doneAt || x.createdAt));

  $("#aWaiting").textContent = list.filter((x) => x.status === "waiting").length;
  $("#aWashing").textContent = list.filter((x) => x.status === "washing").length;
  $("#aDone").textContent = doneToday.length;
  $("#aRevenue").textContent = fmt(doneToday.reduce((s, x) => s + service(x.service).price, 0));

  const q = $("#search").value.trim().toLowerCase();
  let rows = filter === "active" ? active(list)
    : filter === "done" ? list.filter((x) => x.status === "done").sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0))
    : [...list].sort((a, b) => b.createdAt - a.createdAt);
  if (q) rows = rows.filter((x) => [x.name, x.phone, x.plate, x.model].join(" ").toLowerCase().includes(q));

  $("#adminEmpty").classList.toggle("hidden", rows.length > 0);
  $("#adminTable").innerHTML = rows.map((x) => {
    const s = service(x.service);
    const btn = (act, label, cls = "") => `<button class="act ${cls}" data-act="${act}" data-id="${x.id}">${label}</button>`;
    const actions = [];
    if (x.status === "waiting") actions.push(btn("washing", "Boshlash", "act--primary"));
    if (x.status === "washing") actions.push(btn("done", "Tayyor", "act--ok"), btn("waiting", "Qaytarish"));
    actions.push(`<button class="act act--icon" data-act="delete" data-id="${x.id}" aria-label="№${x.num} ni o'chirish">${svg("trash")}</button>`);
    return `
      <tr>
        <td><span class="t-num">№${x.num}</span></td>
        <td>${esc(x.name)}<small><a href="tel:${esc(x.phone)}">${esc(x.phone)}</a></small></td>
        <td><span class="t-plate">${esc(x.plate)}</span><small>${esc(x.model) || "—"}</small></td>
        <td>${s.name}<small>${fmt(s.price)} so'm</small></td>
        <td>${time(x.createdAt)}<small>${isToday(x.createdAt) ? "bugun" : new Date(x.createdAt).toLocaleDateString("ru-RU")}</small></td>
        <td>${badge(x.status)}</td>
        <td><div class="actions">${actions.join("")}</div></td>
      </tr>`;
  }).join("");
}

/* ================= START ================= */
if (document.body.classList.contains("admin")) initAdmin();
else initSite();
