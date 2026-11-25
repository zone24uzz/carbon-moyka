// Carbon — asosiy sayt: xizmatlar, statistika, bron qilish, bugungi jadval.

const state = { kind: "wash", service: "express", carType: "sedan", date: ymd(), time: null, staffId: "any" };
let schedFilter = "all";

function initSite() {
  seedDemo();
  $("#year").textContent = new Date().getFullYear();
  initMenu();
  renderServices();
  initBooking();
  initCafe();
  initClock();
  initReveal();

  $("#schedFilter").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-k]");
    if (!b) return;
    schedFilter = b.dataset.k;
    $$("#schedFilter button").forEach((x) => x.classList.toggle("is-active", x === b));
    renderSchedule();
  });

  renderLive();
  setInterval(renderLive, 10000);
  window.addEventListener("storage", renderLive);
  let rw;
  window.addEventListener("resize", () => { clearTimeout(rw); rw = setTimeout(renderStats, 150); });
}

function renderLive() {
  renderBoard();
  renderStats();
  renderSchedule();
  renderMyTickets();
  renderBookingDynamic();
  if (typeof renderMyCafe === "function") renderMyCafe();
}

/* ---------- Menyu, soat, reveal ---------- */
function initMenu() {
  const burger = $("#burger");
  const toggle = (open) => {
    document.body.classList.toggle("menu-open", open);
    burger.setAttribute("aria-expanded", open);
    burger.setAttribute("aria-label", open ? "Menyuni yopish" : "Menyuni ochish");
    $("#menu").setAttribute("aria-hidden", !open);
  };
  burger.addEventListener("click", () => toggle(!document.body.classList.contains("menu-open")));
  $("#menu").addEventListener("click", (e) => e.target.closest("a") && toggle(false));
  document.addEventListener("keydown", (e) => e.key === "Escape" && toggle(false));
}

function initClock() {
  const tick = () => ($("#clock").textContent = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }));
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

/* ---------- Xizmatlar ---------- */
function priceText(s) {
  return `${fmt(s.price)}<small>so'm${s.from ? " dan" : ""}</small>`;
}

function renderServices() {
  const wash = SERVICES.filter((s) => s.kind === "wash");
  $("#washList").innerHTML = wash.map((s, i) => `
    <article class="pack reveal ${s.feature ? "pack--feature" : ""}">
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
    <li class="price-row reveal">
      <a href="#book" data-pick="${s.id}" aria-label="${s.name} — bron qilish">
        <span class="price-row__num">${String(i + 1).padStart(2, "0")}</span>
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
    const s = service(pick.dataset.pick);
    state.kind = s.kind;
    state.service = s.id;
    state.time = null;
    state.staffId = "any";
    $(`input[name="kind"][value="${s.kind}"]`).checked = true;
    renderBookingStatic();
    renderBookingDynamic();
  });
}

/* ---------- Jonli panel (hero) ---------- */
function renderBoard() {
  const today = ymd();
  const list = Store.bookings().filter((b) => b.date === today);
  const working = list.filter((b) => b.status === "working");
  const done = list.filter((b) => b.status === "done");

  setNum($("#statDone"), done.length);
  setNum($("#statWorking"), working.length);
  $("#boardNow").textContent = working.length ? `${working.length} ta mashina` : "Bokslar bo'sh";
  $("#boardWho").textContent = working.slice(0, 3).map((b) => `${b.code} · ${Store.staffName(b.startedBy || b.staffId)}`).join("  ·  ");

  // Eng yaqin bo'sh moyka vaqti
  let free = "—";
  for (let d = 0; d < 2 && free === "—"; d++) {
    const date = addDays(today, d);
    const s = slotsFor("wash", date, durationOf("express", "sedan")).find((x) => !x.past && x.free.length);
    if (s) free = d === 0 ? s.time : `ertaga ${s.time}`;
  }
  $("#statFree").textContent = free;
  if ($("#ctaTime")) $("#ctaTime").textContent = free === "—" ? "Ertaga" : free;

  const upcoming = list.filter((b) => b.status === "booked" || b.status === "arrived").sort((a, b) => a.time.localeCompare(b.time));
  $("#boardNext").innerHTML = upcoming.length
    ? upcoming.slice(0, 4).map((b) => `<li><span>${b.time}</span><span>${esc(maskPlate(b.plate))}</span><span class="mono-label">${esc(Store.staffName(b.staffId))}</span></li>`).join("")
    : `<li class="empty-row">Bugun uchun bronlar yo'q — hoziroq keling.</li>`;
}

/* ---------- Statistika ---------- */
function renderStats() {
  const list = Store.bookings();
  const d30 = dailyCounts(30, list);
  const wash30 = d30.reduce((s, d) => s + d.wash, 0);
  const serv30 = d30.reduce((s, d) => s + d.service, 0);
  setNum($("#st30"), wash30 + serv30, fmt);
  setNum($("#stWash"), wash30);
  setNum($("#stServ"), serv30);
  const t = d30[d30.length - 1];
  setNum($("#stToday"), t.wash + t.service);

  const rows = dailyCounts(14, list).map((d) => ({
    label: d.label,
    title: `${dayLabel(d.date)}, ${weekday(d.date)}`,
    values: { wash: d.wash, service: d.service },
    extra: `Jami: ${d.wash + d.service} ta`,
  }));
  barChart($("#dailyChart"), rows, [
    { key: "wash", name: "Moyka", cls: "s1" },
    { key: "service", name: "Avtoservis", cls: "s2" },
  ]);
  $("#dailyTable").innerHTML = `<table class="mini-table"><thead><tr><th>Kun</th><th>Moyka</th><th>Avtoservis</th><th>Jami</th></tr></thead><tbody>${
    rows.map((r) => `<tr><td>${r.title}</td><td>${r.values.wash}</td><td>${r.values.service}</td><td>${r.values.wash + r.values.service}</td></tr>`).join("")
  }</tbody></table>`;
}

/* ---------- Bugungi jadval ---------- */
function renderSchedule() {
  const today = ymd();
  let list = Store.bookings().filter((b) => b.date === today && b.status !== "cancelled").sort((a, b) => a.time.localeCompare(b.time));
  if (schedFilter !== "all") list = list.filter((b) => b.kind === schedFilter);
  const mine = Store.myIds();
  $("#scheduleList").innerHTML = list.length
    ? list.map((b) => `
      <div class="q-item ${mine.includes(b.id) ? "is-mine" : ""}">
        <span class="q-item__num">${b.time}</span>
        <div class="q-item__plate">${esc(maskPlate(b.plate))}${mine.includes(b.id) ? " · siz" : ""}<small>${b.code} · ${service(b.service).name}</small></div>
        <span class="q-item__eta">${svg("user")} ${esc(Store.staffName(b.startedBy || b.staffId))}</span>
        ${badge(b.status)}
      </div>`).join("")
    : `<div class="q-empty">Bugun uchun bron yo'q. Hoziroq kelsangiz, darhol xizmat qilamiz.</div>`;
}

/* ---------- Mening bronlarim ---------- */
function renderMyTickets() {
  const all = Store.bookings();
  const ids = Store.myIds().filter((id) => all.some((b) => b.id === id));
  Store.saveMyIds(ids);
  const mine = ids.map((id) => all.find((b) => b.id === id))
    .filter((b) => ACTIVE.includes(b.status) || (b.status === "done" && Date.now() - (b.doneAt || 0) < 6 * 3600000))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  $("#myTickets").innerHTML = mine.map((b) => {
    const s = service(b.service);
    const who = Store.staffName(b.startedBy || b.staffId);
    let line;
    if (b.status === "done") line = "Mashinangiz tayyor. Olib ketishingiz mumkin.";
    else if (b.status === "working") line = `${who} hozir ishlayapti.`;
    else if (b.status === "arrived") line = "Keldingiz, tez orada boshlaymiz.";
    else line = `${dayLabel(b.date)}, soat ${b.time} da kuting.`;
    return `
      <div class="bezel ticket-wrap">
        <div class="bezel__core ticket">
          <div class="ticket__top">
            <span class="ticket__num">${b.code}</span>
            ${badge(b.status)}
          </div>
          <div class="ticket__when">${svg("clock")}<b>${dayLabel(b.date)}, ${weekday(b.date)} · ${b.time}</b><span>~${b.duration} daq</span></div>
          <div class="ticket__who">${svg("user")}<span>${KINDS[b.kind].roleName}:</span><b>${esc(who)}</b></div>
          <p class="ticket__pos">${line}</p>
          <span class="ticket__line"></span>
          <p class="ticket__meta">${esc(b.plate)} · ${esc(b.model)} · ${s.name} · ${fmt(b.price)} so'm${s.from ? " dan" : ""}</p>
          ${b.status === "booked" ? `<button class="btn btn--ghost btn--sm" data-cancel="${b.id}">Bronni bekor qilish</button>` : ""}
        </div>
      </div>`;
  }).join("");
}

/* ---------- Bron formasi ---------- */
function initBooking() {
  const f = $("#bookForm");
  f.addEventListener("change", (e) => {
    const t = e.target;
    if (t.name === "kind") {
      state.kind = t.value;
      state.service = SERVICES.find((s) => s.kind === t.value).id;
      state.time = null; state.staffId = "any";
      renderBookingStatic();
    }
    if (t.name === "service") { state.service = t.value; state.time = null; }
    if (t.name === "carType") { state.carType = t.value; state.time = null; }
    if (t.name === "date") { state.date = t.value; state.time = null; }
    if (t.name === "time") state.time = t.value;
    if (t.name === "staff") { state.staffId = t.value; }
    if (["kind", "service", "carType", "date", "time", "staff"].includes(t.name)) renderBookingDynamic();
  });

  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(f));
    const phone = (data.phone || "").replace(/[^\d+]/g, "");
    $$("input", f).forEach((i) => i.removeAttribute("aria-invalid"));
    const fail = (field, msg) => {
      $("#formError").textContent = msg;
      if (field) { f[field].setAttribute("aria-invalid", "true"); f[field].focus(); }
    };
    if (!state.time) return fail(null, "Vaqtni tanlang.");
    if ((data.name || "").trim().length < 2) return fail("name", "Ismingizni kiriting.");
    if (phone.replace("+", "").length < 9) return fail("phone", "Telefon raqam to'liq emas.");
    if ((data.plate || "").trim().length < 4) return fail("plate", "Avtomobil raqamini kiriting.");
    if ((data.model || "").trim().length < 2) return fail("model", "Mashina modelini kiriting.");

    const plate = data.plate.trim().toUpperCase().replace(/\s+/g, " ");
    const dup = Store.bookings().some((b) => b.plate === plate && b.date === state.date && b.kind === state.kind && ACTIVE.includes(b.status));
    if (dup) return fail("plate", "Bu mashina shu kunga allaqachon bron qilingan.");

    const res = createBooking({
      service: state.service, carType: state.carType, date: state.date, time: state.time, staffId: state.staffId,
      name: data.name.trim(), phone, plate, model: data.model.trim(),
    });
    if (res.error) { state.time = null; renderBookingDynamic(); return fail(null, res.error); }

    $("#formError").textContent = "";
    Store.saveMyIds([...Store.myIds(), res.booking.id]);
    f.reset();
    $(`input[name="kind"][value="${state.kind}"]`).checked = true;
    state.time = null; state.staffId = "any";
    renderBookingStatic();
    renderLive();
    $("#myTickets").scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => window.fxBurst?.($("#myTickets .ticket")), 450);
  });

  $("#myTickets").addEventListener("click", (e) => {
    const id = e.target.closest("[data-cancel]")?.dataset.cancel;
    if (!id) return;
    Store.update(id, { status: "cancelled", cancelledAt: Date.now() });
    renderLive();
  });

  renderBookingStatic();
}

// Xizmat, mashina turi va kunlar (kind o'zgarganda qayta chiziladi)
function renderBookingStatic() {
  $("#svcChips").innerHTML = SERVICES.filter((s) => s.kind === state.kind).map((s) => `
    <label class="chip"><input type="radio" name="service" value="${s.id}" ${s.id === state.service ? "checked" : ""}>
      <span>${s.name}<small>${fmt(s.price)} so'm${s.from ? " dan" : ""} · ${s.min} daq</small></span></label>`).join("");

  $("#typeChips").innerHTML = CAR_TYPES.map((c) => `
    <label class="chip"><input type="radio" name="carType" value="${c.id}" ${c.id === state.carType ? "checked" : ""}>
      <span>${c.name}<small>${c.hint}</small></span></label>`).join("");

  const today = ymd();
  $("#dayChips").innerHTML = Array.from({ length: SHOP.daysAhead }, (_, i) => addDays(today, i)).map((d) => `
    <label class="day"><input type="radio" name="date" value="${d}" ${d === state.date ? "checked" : ""}>
      <span><small>${weekday(d)}</small><b>${new Date(d + "T12:00:00").getDate()}</b><small>${i0(d)}</small></span></label>`).join("");

  $("#staffLegend").textContent = state.kind === "wash" ? "Kim yuvadi" : "Qaysi usta";
}
const i0 = (d) => { const l = dayLabel(d); return /^\d/.test(l) ? MONTHS[new Date(d + "T12:00:00").getMonth()] : l; };

// Vaqtlar, xodimlar va xulosa (bandlik o'zgarganda qayta chiziladi)
function renderBookingDynamic() {
  if (!$("#slotGrid")) return;
  const dur = durationOf(state.service, state.carType);
  const slots = slotsFor(state.kind, state.date, dur);
  const wanted = state.staffId !== "any" ? state.staffId : null;
  const ok = (s) => !s.past && s.free.length && (!wanted || s.free.some((x) => x.id === wanted));
  if (state.time && !slots.some((s) => s.time === state.time && ok(s))) state.time = null;

  const visible = slots.filter((s) => !s.past);
  const freeCount = visible.filter(ok).length;
  $("#slotHint").textContent = visible.length ? `· ${freeCount} ta bo'sh` : "";
  $("#slotGrid").innerHTML = visible.length
    ? visible.map((s) => `
      <label class="slot ${ok(s) ? "" : "is-busy"}"><input type="radio" name="time" value="${s.time}" ${s.time === state.time ? "checked" : ""} ${ok(s) ? "" : "disabled"}>
        <span>${s.time}</span></label>`).join("")
    : `<p class="empty">Bugun ish vaqti tugadi. Ertangi kunni tanlang.</p>`;

  // Xodimlar: tanlangan vaqtda bo'sh/band
  const role = KINDS[state.kind].role;
  const staff = Store.staff().filter((s) => s.active && s.role === role);
  const freeAt = state.time ? freeStaff(state.kind, state.date, state.time, dur).map((s) => s.id) : null;
  if (state.staffId !== "any" && !staff.some((s) => s.id === state.staffId)) state.staffId = "any";
  $("#staffChips").innerHTML = `
    <label class="chip"><input type="radio" name="staff" value="any" ${state.staffId === "any" ? "checked" : ""}>
      <span>Farqi yo'q<small>bo'sh xodim biriktiriladi</small></span></label>` +
    staff.map((s) => {
      const busy = freeAt && !freeAt.includes(s.id);
      return `<label class="chip ${busy ? "is-busy" : ""}"><input type="radio" name="staff" value="${s.id}" ${state.staffId === s.id ? "checked" : ""} ${busy ? "disabled" : ""}>
        <span>${esc(s.name)}<small>${busy ? "bu vaqtda band" : KINDS[state.kind].roleName.toLowerCase()}</small></span></label>`;
    }).join("");

  // Xulosa
  const s = service(state.service);
  const who = state.time
    ? (state.staffId !== "any" ? Store.staffName(state.staffId) : (pickStaff(state.kind, state.date, state.time, dur)?.name || "—"))
    : "vaqtni tanlang";
  $("#summary").innerHTML = `
    <div><span>Xizmat</span><b>${s.name}</b></div>
    <div><span>Vaqt</span><b>${dayLabel(state.date)}, ${state.time || "—"}</b></div>
    <div><span>${KINDS[state.kind].roleName}</span><b>${esc(who)}</b></div>
    <div><span>Narx</span><b>${fmt(priceOf(state.service, state.carType))} so'm${s.from ? " dan" : ""}</b><small>~${dur} daq</small></div>`;
}

/* ---------- Kafe ---------- */
const cart = {};

function initCafe() {
  if (!$("#cafeMenu")) return;
  const cats = [...new Set(CAFE_MENU.map((m) => m.cat))];
  $("#cafeMenu").innerHTML = cats.map((c) => `
    <div class="menu-cat reveal">
      <h3 class="menu-cat__title">${c}</h3>
      ${CAFE_MENU.filter((m) => m.cat === c).map((m) => `
        <div class="menu-item" data-id="${m.id}">
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
    if (!b) return;
    const id = b.closest(".menu-item").dataset.id;
    cart[id] = Math.max(0, Math.min(20, (cart[id] || 0) + +b.dataset.q));
    if (!cart[id]) delete cart[id];
    renderCart();
  });
  $("#cartItems").addEventListener("click", (e) => {
    const id = e.target.closest("[data-rm]")?.dataset.rm;
    if (id) { delete cart[id]; renderCart(); }
  });

  const f = $("#cafeForm");
  f.addEventListener("change", (e) => {
    if (e.target.name === "where") $("#cafePlateField").classList.toggle("hidden", e.target.value !== "car");
  });
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    const items = Object.entries(cart).map(([id, qty]) => ({ id, qty }));
    const err = (m) => ($("#cafeError").textContent = m);
    if (!items.length) return err("Menyudan kamida bitta narsa tanlang.");
    if ((d.name || "").trim().length < 2) return err("Ismingizni yozing.");
    if ((d.phone || "").replace(/\D/g, "").length < 9) return err("Telefon raqam to'liq emas.");
    if (d.where === "car" && (d.plate || "").trim().length < 4) return err("Mashinangiz raqamini yozing — olib chiqamiz.");
    err("");
    const o = createCafeOrder({
      items, name: d.name.trim(), phone: d.phone.replace(/[^\d+]/g, ""), where: d.where,
      plate: (d.plate || "").trim().toUpperCase(), note: (d.note || "").trim(),
    });
    localStorage.setItem(KEYS.myCafe, JSON.stringify([...(read(KEYS.myCafe, [])), o.id]));
    Object.keys(cart).forEach((k) => delete cart[k]);
    f.reset();
    $("#cafePlateField").classList.add("hidden");
    renderCart();
    renderMyCafe();
    setTimeout(() => window.fxBurst?.($("#myCafe .cafe-ticket")), 200);
  });

  renderCart();
  renderMyCafe();
}

function renderCart() {
  $$(".menu-item").forEach((el) => {
    const q = cart[el.dataset.id] || 0;
    $("output", el).textContent = q;
    el.classList.toggle("is-on", q > 0);
  });
  const items = Object.entries(cart);
  const count = items.reduce((s, [, q]) => s + q, 0);
  $("#cartCount").textContent = `${count} ta`;
  $("#cartTotal").textContent = `${fmt(cafeTotal(items.map(([id, qty]) => ({ id, qty }))))} so'm`;
  $("#cartItems").innerHTML = items.length
    ? items.map(([id, q]) => {
        const m = cafeItem(id);
        return `<li><span>${q} × ${m.name}</span><b>${fmt(m.price * q)}</b><button type="button" data-rm="${id}" aria-label="${m.name} ni olib tashlash">×</button></li>`;
      }).join("")
    : `<li class="cart__empty">Savat bo'sh — menyudan tanlang.</li>`;
}

function renderMyCafe() {
  if (!$("#myCafe")) return;
  const mine = read(KEYS.myCafe, []);
  const list = Store.cafe().filter((o) => mine.includes(o.id) && o.status !== "cancelled" && (o.status !== "given" || Date.now() - (o.givenAt || 0) < 3600000));
  $("#myCafe").innerHTML = list.map((o) => `
    <div class="cafe-ticket">
      <div class="cafe-ticket__top"><b>${o.code}</b><span class="badge badge--cafe-${o.status}">${CAFE_STATUS[o.status]}</span></div>
      <p>${o.items.map((it) => `${it.qty}× ${cafeItem(it.id)?.name || it.id}`).join(", ")}</p>
      <small>${o.where === "car" ? `Mashinaga olib chiqiladi · ${esc(o.plate)}` : "Kafeda olasiz"} · ${fmt(o.total)} so'm</small>
    </div>`).join("");
}

initSite();
