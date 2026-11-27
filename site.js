// Carbon — mijoz sayti: xizmatlar, bron (API), kafe (API), ro'yxatdan o'tish, qidiruv, xabarlar.

const state = { kind: "wash", service: "express", carType: "sedan", date: today(), time: null, staffId: "any" };
const MY = { bookings: "carbon_my_tickets", cafe: "carbon_my_cafe", seen: "carbon_seen_status" };
let staffCache = [];
let slotsCache = { key: "", slots: [], loading: false };
let schedFilter = "all";
let user = null;
const cart = {};

/* =================== START =================== */
async function initSite() {
  $("#year").textContent = new Date().getFullYear();
  initMenu();
  renderServices();
  initBooking();
  initCafe();
  initAuth();
  initSearch();
  initLookup();
  initReveal();
  initClock();

  $("#schedFilter").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-k]");
    if (!b) return;
    schedFilter = b.dataset.k;
    $$("#schedFilter button").forEach((x) => x.classList.toggle("is-active", x === b));
    renderSchedule();
  });

  await loadStaff();
  await refreshAll();
  setInterval(refreshAll, 15000);
  document.addEventListener("visibilitychange", () => !document.hidden && refreshAll());
}

async function refreshAll() {
  // Yarim tundan keyin sana eskirib qolmasin
  if (state.date < today()) { state.date = today(); state.time = null; renderDays(); }
  await Promise.allSettled([loadPublic(), loadMine(), loadMyCafe(), loadSlots()]);
}

/* =================== Menyu, soat, reveal =================== */
function initMenu() {
  const burger = $("#burger");
  const toggle = (open) => {
    document.body.classList.toggle("menu-open", open);
    burger.setAttribute("aria-expanded", open);
    burger.setAttribute("aria-label", open ? "Menyuni yopish" : "Menyuni ochish");
    $("#menu").setAttribute("aria-hidden", !open);
  };
  burger.addEventListener("click", () => toggle(!document.body.classList.contains("menu-open")));
  $("#menu").addEventListener("click", (e) => e.target.closest("a, button") && toggle(false));
  document.addEventListener("keydown", (e) => e.key === "Escape" && toggle(false));
}
function initClock() {
  const tick = () => ($("#clock").textContent = toHHMM(nowMin()));
  tick();
  setInterval(tick, 15000);
}
function initReveal() {
  document.documentElement.classList.add("js");
  const io = new IntersectionObserver((entries) => {
    entries.filter((e) => e.isIntersecting).forEach((e, i) => {
      e.target.style.setProperty("--d", `${i * 0.08}s`);
      e.target.classList.add("is-in");
      setTimeout(() => flushNums(e.target), 250);
      io.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  $$(".reveal").forEach((el) => io.observe(el));
}

/* =================== Xizmatlar =================== */
function renderServices() {
  $("#washList").innerHTML = SERVICES.filter((s) => s.kind === "wash").map((s, i) => `
    <article class="pack reveal ${s.feature ? "pack--feature" : ""}" id="svc-${s.id}">
      <div class="pack__top">
        <span class="pack__num">0${i + 1}</span>
        ${s.feature ? '<span class="pack__tag">Eng ko&#39;p tanlanadi</span>' : `<span class="pack__icon">${svg(s.icon)}</span>`}
      </div>
      <h3>${s.name}</h3>
      <p>${s.desc}</p>
      <div class="pack__price"><b>${fmt(s.price)}</b><span>so'm · ~${s.min} daq</span></div>
      <a href="#book" class="btn ${s.feature ? "btn--lime" : "btn--ghost"} btn--full" data-pick="${s.id}">Tanlash<span class="btn__icon" aria-hidden="true">${svg("arrow")}</span></a>
    </article>`).join("");

  $("#serviceList").innerHTML = SERVICES.filter((s) => s.kind === "service").map((s, i) => `
    <li class="price-row reveal" id="svc-${s.id}">
      <a href="#book" data-pick="${s.id}" aria-label="${s.name} — bron qilish">
        <span class="price-row__num">${pad(i + 1)}</span>
        <span class="price-row__icon">${svg(s.icon)}</span>
        <span class="price-row__main"><b>${s.name}</b><small>${s.desc}</small></span>
        <span class="price-row__time">~${s.min} daq</span>
        <span class="price-row__price">${fmt(s.price)}<small>so'm${s.from ? " dan" : ""}</small></span>
        <span class="price-row__go">${svg("arrow")}</span>
      </a>
    </li>`).join("");

  document.addEventListener("click", (e) => {
    const pick = e.target.closest("[data-pick]");
    if (!pick) return;
    pickService(pick.dataset.pick);
  });
}
function pickService(id) {
  const s = service(id);
  if (!s) return;
  Object.assign(state, { kind: s.kind, service: s.id, time: null, staffId: "any" });
  $(`input[name="kind"][value="${s.kind}"]`).checked = true;
  renderBookingStatic();
  loadSlots();
}

/* =================== Jonli panel va bugungi jadval (API) =================== */
let publicData = { items: [], nextFree: null };
async function loadPublic() {
  try {
    publicData = await api("/public/today");
    $("#apiState")?.classList.add("hidden");
  } catch (e) {
    $("#apiState")?.classList.remove("hidden");
    return;
  }
  renderBoard();
  renderSchedule();
}
function renderBoard() {
  const list = publicData.items;
  const working = list.filter((b) => b.status === "working");
  setNum($("#statDone"), list.filter((b) => b.status === "done").length);
  setNum($("#statWorking"), working.length);
  $("#boardNow").textContent = working.length ? `${working.length} ta mashina` : "Bokslar bo'sh";
  $("#boardWho").textContent = working.slice(0, 3).map((b) => `${b.code} · ${b.staff}`).join("  ·  ");
  const nf = publicData.nextFree;
  const free = nf ? (nf.tomorrow ? `ertaga ${nf.time}` : nf.time) : "—";
  $("#statFree").textContent = free;
  if ($("#ctaTime")) $("#ctaTime").textContent = nf ? (nf.tomorrow ? `Ertaga ${nf.time}` : nf.time) : "—";
  const upcoming = list.filter((b) => b.status === "booked" || b.status === "arrived");
  $("#boardNext").innerHTML = upcoming.length
    ? upcoming.slice(0, 4).map((b) => `<li><span>${b.time}</span><span>${esc(b.plate)}</span><span>${esc(b.staff)}</span></li>`).join("")
    : `<li class="empty-row">Bugun uchun bronlar yo'q — hoziroq keling.</li>`;
}
function renderSchedule() {
  const mine = new Set(myBookings.map((b) => b.code + b.date));
  let list = publicData.items;
  if (schedFilter !== "all") list = list.filter((b) => b.kind === schedFilter);
  $("#scheduleList").innerHTML = list.length
    ? list.map((b) => `
      <div class="q-item ${mine.has(b.code + today()) ? "is-mine" : ""}">
        <span class="q-item__num">${b.time}</span>
        <div class="q-item__plate">${esc(b.plate)}${mine.has(b.code + today()) ? " · siz" : ""}<small>${b.code} · ${service(b.service)?.name || ""}</small></div>
        <span class="q-item__eta">${svg("user")} ${esc(b.staff)}</span>
        ${badge(b.status)}
      </div>`).join("")
    : `<div class="q-empty">Bugun uchun bron yo'q. Hoziroq kelsangiz, darhol xizmat qilamiz.</div>`;
}

/* =================== Mening bronlarim + xabarlar =================== */
let myBookings = [];
const ids = (k) => read(k, []);
async function loadMine() {
  const list = ids(MY.bookings);
  if (!list.length && !user) { myBookings = []; return renderMyTickets(); }
  try { myBookings = await api(`/bookings/mine?ids=${encodeURIComponent(list.join(","))}`); } catch { return; }
  watchStatus(myBookings, (b) => {
    if (b.status === "arrived") return null;
    if (b.status === "working") return ["Ish boshlandi", `${b.code}: ${b.kind === "wash" ? "mashinangiz yuvilmoqda" : "usta ishni boshladi"}.`];
    if (b.status === "done") return ["Mashinangiz tayyor!", `${b.code} · ${b.plate} — olib ketishingiz mumkin.`];
    if (b.status === "cancelled") return ["Bron bekor qilindi", `${b.code} · ${dayLabel(b.date)} ${b.time}`];
    return null;
  }, "b");
  renderMyTickets();
  renderSchedule();
}
// Holat o'zgarishini kuzatish: avvalgi holat localStorage'da, o'zgarsa — Notification
function watchStatus(list, msgOf, prefix) {
  const seen = read(MY.seen, {});
  let changed = false;
  list.forEach((x) => {
    const k = prefix + x.id;
    if (seen[k] && seen[k] !== x.status) {
      const m = msgOf(x);
      if (m) Notify.send(m[0], m[1], k);
    }
    if (seen[k] !== x.status) { seen[k] = x.status; changed = true; }
  });
  if (changed) write(MY.seen, seen);
}
function renderMyTickets() {
  const visible = myBookings.filter((b) => ACTIVE.includes(b.status) || (b.status === "done" && Date.now() - (b.doneAt || 0) < 6 * 3600000));
  const notifyBtn = visible.length && Notify.supported() && !Notify.enabled()
    ? `<button class="notify-cta" type="button" id="askNotify">${svg("bell")}<span><b>Tayyor bo'lganda xabar bersin</b><small>Brauzer bildirishnomasini yoqing</small></span></button>` : "";
  $("#myTickets").innerHTML = notifyBtn + visible.map((b) => {
    const s = service(b.service);
    const who = staffName(b.startedBy || b.staffId);
    let line;
    if (b.status === "done") line = "Mashinangiz tayyor. Olib ketishingiz mumkin.";
    else if (b.status === "working") line = `${who} hozir ishlayapti.`;
    else if (b.status === "arrived") line = "Keldingiz, tez orada boshlaymiz.";
    else line = `${dayLabel(b.date)}, soat ${b.time} da keling.`;
    return `
      <div class="ticket-wrap">
        <div class="ticket">
          <div class="ticket__top"><span class="ticket__num">${b.code}</span>${badge(b.status)}</div>
          <div class="ticket__when">${svg("clock")}<b>${dayLabel(b.date)}, ${weekday(b.date)} · ${b.time}</b><span>~${b.duration} daq</span></div>
          <div class="ticket__who">${svg("user")}<span>${KINDS[b.kind].roleName}:</span><b>${esc(who)}</b></div>
          <p class="ticket__pos">${line}</p>
          <span class="ticket__line"></span>
          <p class="ticket__meta">${esc(b.plate)} · ${esc(b.model)} · ${s?.name || ""} · ${fmt(b.price)} so'm${s?.from ? " dan" : ""}</p>
          ${b.status === "booked" ? `<button class="btn btn--ghost btn--sm" data-cancel="${b.id}">Bronni bekor qilish</button>` : ""}
        </div>
      </div>`;
  }).join("");
}
const staffName = (id) => staffCache.find((s) => s.id === id)?.name || "—";
async function loadStaff() { try { staffCache = await api("/staff"); } catch { staffCache = []; } }

/* =================== Bron formasi =================== */
function initBooking() {
  const f = $("#bookForm");
  f.addEventListener("change", (e) => {
    const t = e.target;
    if (t.name === "kind") { Object.assign(state, { kind: t.value, service: SERVICES.find((s) => s.kind === t.value).id, time: null, staffId: "any" }); renderBookingStatic(); }
    if (t.name === "service") { state.service = t.value; state.time = null; }
    if (t.name === "carType") { state.carType = t.value; state.time = null; }
    if (t.name === "date") { state.date = t.value; state.time = null; }
    if (t.name === "time") state.time = t.value;
    if (t.name === "staff") state.staffId = t.value;
    if (["kind", "service", "carType", "date"].includes(t.name)) loadSlots();
    else if (["time", "staff"].includes(t.name)) renderSlotsAndStaff();
  });

  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    $$("input", f).forEach((i) => i.removeAttribute("aria-invalid"));
    const fail = (field, msg) => { $("#formError").textContent = msg; if (field) { f[field].setAttribute("aria-invalid", "true"); f[field].focus(); } };
    if (!state.time) return fail(null, "Vaqtni tanlang.");
    if (!validName(d.name)) return fail("name", "Ismni to'g'ri yozing (faqat harflar).");
    if (!normalizePhone(d.phone)) return fail("phone", "Telefon raqam noto'g'ri. Masalan: +998 90 123 45 67");
    if (!normalizePlate(d.plate)) return fail("plate", "Avto raqam noto'g'ri. Masalan: 01 A 123 BC");
    if (cleanText(d.model, 30).length < 2) return fail("model", "Mashina modelini yozing.");
    if (myBookings.some((b) => plateKey(b.plate) === plateKey(d.plate) && b.date === state.date && b.kind === state.kind && ACTIVE.includes(b.status))) return fail("plate", "Bu mashina shu kunga allaqachon bron qilingan.");

    const btn = $("#bookSubmit");
    btn.disabled = true; btn.classList.add("is-loading");
    try {
      const b = await api("/bookings", { method: "POST", body: { service: state.service, carType: state.carType, date: state.date, time: state.time, staffId: state.staffId, name: d.name, phone: d.phone, plate: d.plate, model: d.model } });
      $("#formError").textContent = "";
      write(MY.bookings, [...ids(MY.bookings), b.id].slice(-30));
      const seen = read(MY.seen, {}); seen["b" + b.id] = b.status; write(MY.seen, seen);
      myBookings.push(b);
      ["plate", "model"].forEach((k) => (f[k].value = ""));
      state.time = null; state.staffId = "any";
      renderMyTickets();
      toast(`Bron qabul qilindi: ${b.code}, ${dayLabel(b.date)} ${b.time}`, "ok");
      $("#myTickets").scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => window.fxBurst?.($("#myTickets .ticket")), 450);
      if (Notify.supported() && Notification.permission === "default") setTimeout(() => Notify.ask().then((ok) => ok && renderMyTickets()), 900);
      refreshAll();
    } catch (err) {
      fail(null, err.message);
      if (err.status === 409 || err.status === 400) { state.time = null; loadSlots(); }
    } finally {
      btn.disabled = false; btn.classList.remove("is-loading");
    }
  });

  $("#myTickets").addEventListener("click", async (e) => {
    if (e.target.closest("#askNotify")) { if (await Notify.ask()) { toast("Xabarlar yoqildi. Mashina tayyor bo'lganda xabar keladi.", "ok"); renderMyTickets(); } return; }
    const id = e.target.closest("[data-cancel]")?.dataset.cancel;
    if (!id) return;
    try { await api(`/bookings/${encodeURIComponent(id)}/cancel`, { method: "POST" }); toast("Bron bekor qilindi."); refreshAll(); }
    catch (err) { toast(err.message, "err"); }
  });

  renderBookingStatic();
}

function renderBookingStatic() {
  $("#svcChips").innerHTML = SERVICES.filter((s) => s.kind === state.kind).map((s) => `
    <label class="chip"><input type="radio" name="service" value="${s.id}" ${s.id === state.service ? "checked" : ""}>
      <span>${s.name}<small>${fmt(s.price)} so'm${s.from ? " dan" : ""} · ${s.min} daq</small></span></label>`).join("");
  $("#typeChips").innerHTML = CAR_TYPES.map((c) => `
    <label class="chip"><input type="radio" name="carType" value="${c.id}" ${c.id === state.carType ? "checked" : ""}>
      <span>${c.name}<small>${c.hint}</small></span></label>`).join("");
  renderDays();
  $("#staffLegend").textContent = state.kind === "wash" ? "Kim yuvadi" : "Qaysi usta";
  renderSlotsAndStaff();
}
function renderDays() {
  const t = today();
  $("#dayChips").innerHTML = Array.from({ length: SHOP.daysAhead }, (_, i) => addDays(t, i)).map((d) => {
    const l = dayLabel(d);
    return `<label class="day"><input type="radio" name="date" value="${d}" ${d === state.date ? "checked" : ""}>
      <span><small>${weekday(d)}</small><b>${dObj(d).getUTCDate()}</b><small>${/^\d/.test(l) ? MONTHS[dObj(d).getUTCMonth()] : l}</small></span></label>`;
  }).join("");
}

async function loadSlots() {
  const key = [state.service, state.carType, state.date].join("|");
  slotsCache.loading = slotsCache.key !== key;
  if (slotsCache.loading) renderSlotsAndStaff();
  try {
    const r = await api(`/slots?service=${state.service}&carType=${state.carType}&date=${state.date}`);
    if ([state.service, state.carType, state.date].join("|") !== key) return; // eskirgan javob
    slotsCache = { key, slots: r.slots, loading: false };
  } catch (err) {
    slotsCache = { key, slots: [], loading: false, error: err.message };
  }
  renderSlotsAndStaff();
}

function renderSlotsAndStaff() {
  const dur = durationOf(state.service, state.carType);
  const wanted = state.staffId !== "any" ? state.staffId : null;
  const slots = slotsCache.slots;
  const ok = (s) => s.free.length && (!wanted || s.free.some((x) => x.id === wanted));
  if (state.time && !slots.some((s) => s.time === state.time && ok(s))) state.time = null;
  const freeCount = slots.filter(ok).length;
  $("#slotHint").textContent = slotsCache.loading ? "· yuklanmoqda…" : slots.length ? `· ${freeCount} ta bo'sh` : "";
  $("#slotGrid").innerHTML = slotsCache.loading
    ? `<p class="empty">Bo'sh vaqtlar yuklanmoqda…</p>`
    : slotsCache.error ? `<p class="empty">${esc(slotsCache.error)}</p>`
    : slots.length
      ? slots.map((s) => `<label class="slot ${ok(s) ? "" : "is-busy"}"><input type="radio" name="time" value="${s.time}" ${s.time === state.time ? "checked" : ""} ${ok(s) ? "" : "disabled"}><span>${s.time}</span></label>`).join("")
      : `<p class="empty">${state.date === today() ? "Bugun bu xizmat uchun vaqt qolmadi. Ertangi kunni tanlang." : "Bu kunda bo'sh vaqt yo'q."}</p>`;

  const role = KINDS[state.kind].role;
  const team = staffCache.filter((s) => s.role === role);
  const slot = slots.find((s) => s.time === state.time);
  const freeIds = slot ? slot.free.map((x) => x.id) : null;
  if (wanted && !team.some((s) => s.id === wanted)) state.staffId = "any";
  $("#staffChips").innerHTML = `
    <label class="chip"><input type="radio" name="staff" value="any" ${state.staffId === "any" ? "checked" : ""}><span>Farqi yo'q<small>bo'sh xodim biriktiriladi</small></span></label>` +
    team.map((s) => {
      const busy = freeIds && !freeIds.includes(s.id);
      return `<label class="chip ${busy ? "is-busy" : ""}"><input type="radio" name="staff" value="${s.id}" ${state.staffId === s.id ? "checked" : ""} ${busy ? "disabled" : ""}><span>${esc(s.name)}<small>${busy ? "bu vaqtda band" : KINDS[state.kind].roleName.toLowerCase()}</small></span></label>`;
    }).join("");

  const s = service(state.service);
  const who = slot ? (wanted ? staffName(wanted) : slot.free[0]?.name || "—") : "vaqtni tanlang";
  $("#summary").innerHTML = `
    <div><span>Xizmat</span><b>${s.name}</b></div>
    <div><span>Vaqt</span><b>${dayLabel(state.date)}, ${state.time || "—"}</b></div>
    <div><span>${KINDS[state.kind].roleName}</span><b>${esc(who)}</b></div>
    <div><span>Narx</span><b>${fmt(priceOf(state.service, state.carType))} so'm${s.from ? " dan" : ""}</b><small>~${dur} daq</small></div>`;
}

/* =================== Kafe =================== */
function initCafe() {
  const cats = [...new Set(CAFE_MENU.map((m) => m.cat))];
  $("#cafeMenu").innerHTML = cats.map((c) => `
    <div class="menu-cat reveal">
      <h3 class="menu-cat__title">${c}</h3>
      ${CAFE_MENU.filter((m) => m.cat === c).map((m) => `
        <div class="menu-item" data-id="${m.id}" id="menu-${m.id}">
          <span class="menu-item__icon">${svg("cup")}</span>
          <span class="menu-item__name"><b>${m.name}</b><small>${m.desc}</small></span>
          <span class="menu-item__price">${fmt(m.price)}</span>
          <span class="qty">
            <button type="button" data-q="-1" aria-label="${m.name}: kamaytirish">${svg("minus")}</button>
            <output>0</output>
            <button type="button" data-q="1" aria-label="${m.name}: qo'shish">${svg("plus")}</button>
          </span>
        </div>`).join("")}
    </div>`).join("");

  $("#cafeMenu").addEventListener("click", (e) => {
    const b = e.target.closest("[data-q]");
    if (b) addToCart(b.closest(".menu-item").dataset.id, +b.dataset.q);
  });
  $("#cartItems").addEventListener("click", (e) => {
    const id = e.target.closest("[data-rm]")?.dataset.rm;
    if (id) { delete cart[id]; renderCart(); }
  });
  const f = $("#cafeForm");
  f.addEventListener("change", (e) => { if (e.target.name === "where") $("#cafePlateField").classList.toggle("hidden", e.target.value !== "car"); });
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    const items = Object.entries(cart).map(([id, qty]) => ({ id, qty }));
    const err = (m) => ($("#cafeError").textContent = m);
    if (!items.length) return err("Menyudan kamida bitta narsa tanlang.");
    if (!validName(d.name)) return err("Ismni to'g'ri yozing.");
    if (!normalizePhone(d.phone)) return err("Telefon raqam noto'g'ri.");
    if (d.where === "car" && !normalizePlate(d.plate)) return err("Mashinangiz raqamini to'g'ri yozing — olib chiqamiz.");
    err("");
    const btn = $("button[type=submit]", f);
    btn.disabled = true;
    try {
      const o = await api("/cafe/orders", { method: "POST", body: { items, name: d.name, phone: d.phone, where: d.where, plate: d.plate, note: d.note } });
      write(MY.cafe, [...ids(MY.cafe), o.id].slice(-30));
      const seen = read(MY.seen, {}); seen["c" + o.id] = o.status; write(MY.seen, seen);
      Object.keys(cart).forEach((k) => delete cart[k]);
      f.note.value = "";
      renderCart();
      toast(`Buyurtma qabul qilindi: ${o.code}`, "ok");
      if (Notify.supported() && Notification.permission === "default") Notify.ask();
      await loadMyCafe();
      setTimeout(() => window.fxBurst?.($("#myCafe .cafe-ticket")), 200);
    } catch (e2) { err(e2.message); }
    finally { btn.disabled = false; }
  });
  renderCart();
}
function addToCart(id, d) {
  cart[id] = Math.max(0, Math.min(20, (cart[id] || 0) + d));
  if (!cart[id]) delete cart[id];
  renderCart();
}
function renderCart() {
  $$(".menu-item").forEach((el) => { const q = cart[el.dataset.id] || 0; $("output", el).textContent = q; el.classList.toggle("is-on", q > 0); });
  const items = Object.entries(cart);
  $("#cartCount").textContent = `${items.reduce((s, [, q]) => s + q, 0)} ta`;
  $("#cartTotal").textContent = `${fmt(items.reduce((s, [id, q]) => s + cafeItem(id).price * q, 0))} so'm`;
  $("#cartItems").innerHTML = items.length
    ? items.map(([id, q]) => { const m = cafeItem(id); return `<li><span>${q} × ${m.name}</span><b>${fmt(m.price * q)}</b><button type="button" data-rm="${id}" aria-label="${m.name} ni olib tashlash">×</button></li>`; }).join("")
    : `<li class="cart__empty">Savat bo'sh — menyudan tanlang.</li>`;
}
let myCafe = [];
async function loadMyCafe() {
  const list = ids(MY.cafe);
  if (!list.length && !user) { myCafe = []; return renderMyCafe(); }
  try { myCafe = await api(`/cafe/mine?ids=${encodeURIComponent(list.join(","))}`); } catch { return; }
  watchStatus(myCafe, (o) => o.status === "ready" ? ["Qahvangiz tayyor! ☕", `${o.code} — ${o.where === "car" ? "mashinangizga olib chiqilmoqda" : "kafedan olib keting"}.`] : null, "c");
  renderMyCafe();
}
function renderMyCafe() {
  const list = myCafe.filter((o) => o.status !== "cancelled" && (o.status !== "given" || Date.now() - (o.givenAt || 0) < 3600000));
  $("#myCafe").innerHTML = list.map((o) => `
    <div class="cafe-ticket">
      <div class="cafe-ticket__top"><b>${o.code}</b><span class="badge badge--cafe-${o.status}">${CAFE_STATUS[o.status]}</span></div>
      <p>${o.items.map((it) => `${it.qty}× ${cafeItem(it.id)?.name || it.id}`).join(", ")}</p>
      <small>${o.where === "car" ? `Mashinaga olib chiqiladi · ${esc(o.plate)}` : "Kafeda olasiz"} · ${fmt(o.total)} so'm</small>
    </div>`).join("");
}

/* =================== Ro'yxatdan o'tish / kirish =================== */
function initAuth() {
  const dlg = $("#authDialog");
  const f = $("#authForm");
  let mode = "register";
  const setMode = (m) => {
    mode = m;
    $("#authTitle").textContent = m === "register" ? "Ro'yxatdan o'tish" : "Kirish";
    $("#authNameField").classList.toggle("hidden", m !== "register");
    $("#authSubmit").firstChild.textContent = m === "register" ? "Ro'yxatdan o'tish" : "Kirish";
    $("#authSwitch").innerHTML = m === "register" ? "Akkauntingiz bormi? <b>Kirish</b>" : "Akkaunt yo'qmi? <b>Ro'yxatdan o'tish</b>";
    f.password.autocomplete = m === "register" ? "new-password" : "current-password";
    $("#authError").textContent = "";
  };
  $$("[data-auth]").forEach((b) => b.addEventListener("click", () => {
    if (user) return logout();
    setMode(b.dataset.auth || "register");
    dlg.showModal();
  }));
  $("#authSwitch").addEventListener("click", () => setMode(mode === "register" ? "login" : "register"));
  $("#authClose").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => e.target === dlg && dlg.close());
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    const err = (m) => ($("#authError").textContent = m);
    if (mode === "register" && !validName(d.name)) return err("Ismni to'g'ri yozing.");
    if (!normalizePhone(d.phone)) return err("Telefon raqam noto'g'ri.");
    if ((d.password || "").length < 6) return err("Parol kamida 6 belgi bo'lsin.");
    try {
      const r = await api(`/auth/${mode}`, { method: "POST", body: { name: d.name, phone: d.phone, password: d.password, claim: ids(MY.bookings) }, auth: false });
      localStorage.setItem(TOKENS.user, r.token);
      setUser(r.user);
      dlg.close();
      f.reset();
      toast(mode === "register" ? `Xush kelibsiz, ${r.user.name}!` : `Qaytganingizdan xursandmiz, ${r.user.name}!`, "ok");
      refreshAll();
    } catch (e2) { err(e2.message); }
  });
  if (localStorage.getItem(TOKENS.user)) api("/auth/me").then(setUser).catch(() => localStorage.removeItem(TOKENS.user));
}
function setUser(u) {
  user = u;
  $$("[data-auth]").forEach((b) => {
    b.classList.toggle("is-user", !!u);
    $(".auth-label", b).textContent = u ? u.name : "Kirish";
    b.title = u ? "Chiqish" : "Kirish yoki ro'yxatdan o'tish";
  });
  // Formani avtomatik to'ldirish
  if (u) {
    ["#f-name", "#c-name"].forEach((s) => { const i = $(s); if (i && !i.value) i.value = u.name; });
    ["#f-phone", "#c-phone"].forEach((s) => { const i = $(s); if (i && !i.value) i.value = u.phone; });
  }
}
function logout() {
  if (!confirm("Akkauntdan chiqasizmi?")) return;
  localStorage.removeItem(TOKENS.user);
  setUser(null);
  toast("Akkauntdan chiqdingiz.");
  refreshAll();
}

/* =================== Qidiruv =================== */
function initSearch() {
  const dlg = $("#searchDialog");
  const input = $("#searchInput");
  const out = $("#searchResults");
  const items = [
    ...SERVICES.map((s) => ({ type: s.kind === "wash" ? "Moyka" : "Servis", title: s.name, text: s.desc, price: `${fmt(s.price)} so'm${s.from ? " dan" : ""}`, act: () => { pickService(s.id); location.hash = "book"; } })),
    ...CAFE_MENU.map((m) => ({ type: "Kafe", title: m.name, text: m.desc, price: `${fmt(m.price)} so'm`, act: () => { addToCart(m.id, 1); location.hash = "cafe"; toast(`${m.name} savatga qo'shildi`, "ok"); } })),
    { type: "Ma'lumot", title: "Ish vaqti", text: "Har kuni 07:30 – 23:30", act: () => (location.hash = "contact") },
    { type: "Ma'lumot", title: "Manzil va xarita", text: "9883+FC9, Toshkent", act: () => (location.hash = "contact") },
    { type: "Ma'lumot", title: "Bronni topish", text: "Kod va telefon orqali bron holatini bilish", act: () => (location.hash = "lookup") },
  ];
  const norm = (s) => s.toLowerCase().replace(/[ʻʼ'`]/g, "").replace(/\s+/g, " ");
  const render = () => {
    const q = norm(input.value.trim());
    const found = q ? items.filter((i) => norm(`${i.title} ${i.text} ${i.type}`).includes(q)) : items.slice(0, 6);
    out.innerHTML = found.length
      ? found.slice(0, 12).map((i, n) => `<li><button type="button" data-n="${items.indexOf(i)}"><span class="mono">${i.type}</span><b>${esc(i.title)}</b><small>${esc(i.text)}</small>${i.price ? `<em>${i.price}</em>` : ""}</button></li>`).join("")
      : `<li class="search__empty">«${esc(input.value)}» bo'yicha hech narsa topilmadi.</li>`;
  };
  const open = () => { dlg.showModal(); input.value = ""; render(); setTimeout(() => input.focus(), 50); };
  $$("[data-search]").forEach((b) => b.addEventListener("click", open));
  document.addEventListener("keydown", (e) => {
    if ((e.key === "/" || (e.key === "k" && (e.ctrlKey || e.metaKey))) && !e.target.closest("input, textarea")) { e.preventDefault(); open(); }
  });
  input.addEventListener("input", render);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") out.querySelector("button")?.click(); });
  out.addEventListener("click", (e) => { const b = e.target.closest("[data-n]"); if (b) { dlg.close(); items[+b.dataset.n].act(); } });
  dlg.addEventListener("click", (e) => e.target === dlg && dlg.close());
}

/* =================== Bronni kod + telefon bo'yicha topish =================== */
function initLookup() {
  const f = $("#lookupForm");
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    const out = $("#lookupResult");
    try {
      const b = await api(`/bookings/lookup?code=${encodeURIComponent(d.code)}&phone=${encodeURIComponent(d.phone)}`);
      if (!ids(MY.bookings).includes(b.id)) write(MY.bookings, [...ids(MY.bookings), b.id].slice(-30));
      out.innerHTML = `<span class="ok">Topildi: <b>${b.code}</b> · ${dayLabel(b.date)} ${b.time} · ${esc(b.plate)} — ${STATUS[b.status]}. Bron «Mening bronlarim»ga qo'shildi.</span>`;
      await loadMine();
    } catch (err) { out.innerHTML = `<span class="err">${esc(err.message)}</span>`; }
  });
}

initSite();
