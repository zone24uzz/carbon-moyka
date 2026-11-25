// Carbon — admin panel: jadval (bronlar), xodimlar, hisobot.

const ui = { view: "schedule", date: ymd(), kind: "all", status: "all", staffPeriod: 1, repPeriod: 7 };
const logged = () => sessionStorage.getItem("carbon_admin") === "1";
const inRange = (b, days) => b.date >= addDays(ymd(), -(days - 1)) && b.date <= ymd();
const workerOf = (b) => b.startedBy || b.staffId;
const minutes = (a, b) => Math.max(1, Math.round((b - a) / 60000));
const dateTime = (ts) => {
  if (!ts) return "—";
  const d = new Date(ts);
  return ymd(d) === ymd() ? clock(ts) : `${d.getDate()}-${MONTHS[d.getMonth()]} ${clock(ts)}`;
};

function initAdmin() {
  seedDemo();

  $("#loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const { login, password } = Object.fromEntries(new FormData(e.target));
    if (login === ADMIN.login && password === ADMIN.password) {
      sessionStorage.setItem("carbon_admin", "1");
      show();
    } else $("#loginError").textContent = "Login yoki parol noto'g'ri.";
  });
  $("#logoutBtn").addEventListener("click", () => { sessionStorage.removeItem("carbon_admin"); show(); });

  $("#views").addEventListener("click", (e) => {
    const b = e.target.closest("[data-view]");
    if (!b) return;
    ui.view = b.dataset.view;
    $$("#views .tab").forEach((t) => t.classList.toggle("is-active", t === b));
    $$(".view").forEach((v) => v.classList.toggle("hidden", v.id !== `view-${ui.view}`));
    render();
  });

  initSchedule();
  initStaff();
  initReport();
  initCafe();

  const tick = () => ($("#clock").textContent = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }));
  tick();
  setInterval(tick, 15000);
  setInterval(() => logged() && !document.activeElement?.matches("input, select") && render(), 10000);
  window.addEventListener("storage", () => logged() && render());
  let rw;
  window.addEventListener("resize", () => { clearTimeout(rw); rw = setTimeout(() => logged() && ui.view === "report" && renderReport(), 150); });

  show();
}

function show() {
  $("#loginView").classList.toggle("hidden", logged());
  $("#panelView").classList.toggle("hidden", !logged());
  if (logged()) render();
}

function render() {
  if (ui.view === "schedule") renderSchedule();
  if (ui.view === "staff") renderStaff();
  if (ui.view === "report") renderReport();
  if (ui.view === "cafe") renderCafe();
  updateCafeBadge();
}

function segment(sel, key, cb) {
  $(sel).addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    $$(`${sel} button`).forEach((x) => x.classList.toggle("is-active", x === b));
    cb(b.dataset[key]);
  });
}

/* =================== JADVAL =================== */
function initSchedule() {
  const pick = $("#dPick");
  const setDate = (d) => { ui.date = d; pick.value = d; renderSchedule(); };
  pick.value = ui.date;
  pick.addEventListener("change", () => pick.value && setDate(pick.value));
  $("#dPrev").addEventListener("click", () => setDate(addDays(ui.date, -1)));
  $("#dNext").addEventListener("click", () => setDate(addDays(ui.date, 1)));
  $("#dToday").addEventListener("click", () => setDate(ymd()));
  segment("#kindFilter", "k", (k) => { ui.kind = k; renderSchedule(); });
  $("#statusFilter").addEventListener("change", (e) => { ui.status = e.target.value; renderSchedule(); });
  $("#search").addEventListener("input", renderSchedule);

  // Xodimni almashtirish
  $("#view-schedule").addEventListener("change", (e) => {
    const sel = e.target.closest("select[data-staff]");
    if (sel) { Store.update(sel.dataset.staff, { staffId: sel.value }); renderSchedule(); }
  });

  // Holat tugmalari
  $("#view-schedule").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const id = btn.dataset.id;
    const b = Store.bookings().find((x) => x.id === id);
    if (!b) return;
    const now = Date.now();
    const sel = $(`select[data-staff="${id}"]`);
    switch (btn.dataset.act) {
      case "arrive": Store.update(id, { status: "arrived", arrivedAt: now }); break;
      case "start": Store.update(id, { status: "working", startedAt: now, startedBy: sel ? sel.value : b.staffId, staffId: sel ? sel.value : b.staffId, arrivedAt: b.arrivedAt || now }); break;
      case "done": Store.update(id, { status: "done", doneAt: now }); break;
      case "back": Store.update(id, { status: "arrived", startedAt: null, startedBy: null }); break;
      case "noshow": Store.update(id, { status: "noshow" }); break;
      case "cancel": Store.update(id, { status: "cancelled", cancelledAt: now }); break;
      case "restore": Store.update(id, { status: "booked", arrivedAt: null, startedAt: null, startedBy: null, doneAt: null }); break;
      case "delete":
        if (!confirm(`${b.code} (${b.plate}) butunlay o'chirilsinmi?`)) return;
        Store.saveBookings(Store.bookings().filter((x) => x.id !== id));
        break;
    }
    renderSchedule();
  });

  // Jonli mijoz
  const f = $("#walkinForm");
  const fillWalkin = () => {
    const kind = f.kind.value;
    f.service.innerHTML = SERVICES.filter((s) => s.kind === kind).map((s) => `<option value="${s.id}">${s.name}</option>`).join("");
    f.carType.innerHTML = CAR_TYPES.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
    f.staffId.innerHTML = Store.staff().filter((s) => s.active && s.role === KINDS[kind].role).map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("");
  };
  f.kind.addEventListener("change", fillWalkin);
  $("#walkin").addEventListener("toggle", fillWalkin);
  fillWalkin();
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    if ((d.plate || "").trim().length < 4) { $("#walkinError").textContent = "Avto raqamini kiriting."; return; }
    if (!d.staffId) { $("#walkinError").textContent = "Bu bo'limda faol xodim yo'q."; return; }
    const list = Store.bookings();
    const today = ymd();
    const kind = d.kind;
    const sameDay = list.filter((b) => b.date === today && b.kind === kind);
    const num = sameDay.length ? Math.max(...sameDay.map((b) => b.num)) + 1 : 1;
    list.push({
      id: uid(), num, code: `${KINDS[kind].prefix}-${pad(num)}`, kind, service: d.service, carType: d.carType,
      name: d.name.trim() || "Jonli mijoz", phone: d.phone.replace(/[^\d+]/g, ""), plate: d.plate.trim().toUpperCase().replace(/\s+/g, " "),
      model: d.model.trim(), date: today, time: toHHMM(Math.floor(nowMin() / 5) * 5),
      duration: durationOf(d.service, d.carType), price: priceOf(d.service, d.carType),
      staffId: d.staffId, status: "arrived", createdAt: Date.now(), arrivedAt: Date.now(), walkin: true,
    });
    Store.saveBookings(list);
    f.reset(); fillWalkin();
    $("#walkinError").textContent = "";
    $("#walkin").open = false;
    ui.date = today; $("#dPick").value = today;
    renderSchedule();
  });
}

function renderSchedule() {
  const all = Store.bookings();
  const day = all.filter((b) => b.date === ui.date);
  $("#schedDayLabel").textContent = `${dayLabel(ui.date)} · ${weekday(ui.date)}`;

  const real = day.filter((b) => b.status !== "cancelled");
  const done = day.filter((b) => b.status === "done");
  $("#kTotal").textContent = real.length;
  $("#kArrived").textContent = day.filter((b) => ["arrived", "working", "done"].includes(b.status)).length;
  $("#kWorking").textContent = day.filter((b) => b.status === "working").length;
  $("#kDone").textContent = done.length;
  $("#kRevenue").textContent = fmt(done.reduce((s, b) => s + b.price, 0));

  const q = $("#search").value.trim().toLowerCase();
  let rows = day.sort((a, b) => a.time.localeCompare(b.time) || a.createdAt - b.createdAt);
  if (ui.kind !== "all") rows = rows.filter((b) => b.kind === ui.kind);
  if (ui.status !== "all") rows = rows.filter((b) => b.status === ui.status);
  if (q) rows = rows.filter((b) => [b.name, b.phone, b.plate, b.model, b.code].join(" ").toLowerCase().includes(q));

  const staff = Store.staff();
  renderKanban(rows, staff);
  $("#schedEmpty").classList.toggle("hidden", rows.length > 0);
  $("#schedTable").innerHTML = rows.map((b) => {
    const s = service(b.service);
    const editable = ["booked", "arrived"].includes(b.status);
    const options = staff.filter((x) => x.role === KINDS[b.kind].role && (x.active || x.id === b.staffId))
      .map((x) => `<option value="${x.id}" ${x.id === b.staffId ? "selected" : ""}>${esc(x.name)}</option>`).join("");
    const worker = editable
      ? `<select class="mini-select" data-staff="${b.id}" aria-label="Xodim">${options}</select>`
      : `<span class="t-staff">${svg("user")}${esc(Store.staffName(workerOf(b)))}</span>`;

    const hist = [
      `<li><span>Yozildi</span>${dateTime(b.createdAt)}${b.walkin ? " · jonli" : ""}</li>`,
      b.arrivedAt ? `<li><span>Keldi</span>${clock(b.arrivedAt)}</li>` : "",
      b.startedAt ? `<li><span>Boshladi</span>${clock(b.startedAt)} · ${esc(Store.staffName(b.startedBy))}</li>` : "",
      b.doneAt ? `<li><span>Tayyor</span>${clock(b.doneAt)} · ${minutes(b.startedAt || b.arrivedAt, b.doneAt)} daq</li>` : "",
    ].join("");

    const A = (act, label, cls = "") => `<button class="act ${cls}" data-act="${act}" data-id="${b.id}">${label}</button>`;
    const acts = {
      booked: [A("arrive", "Keldi", "act--primary"), A("noshow", "Kelmadi"), A("cancel", "Bekor")],
      arrived: [A("start", "Boshlash", "act--primary"), A("noshow", "Kelmadi")],
      working: [A("done", "Tayyor", "act--ok"), A("back", "Qaytarish")],
      done: [],
      noshow: [A("restore", "Tiklash")],
      cancelled: [A("restore", "Tiklash")],
    }[b.status];
    acts.push(`<button class="act act--icon" data-act="delete" data-id="${b.id}" aria-label="${b.code} ni o'chirish">${svg("trash")}</button>`);

    return `
      <tr class="row--${b.status}">
        <td><b class="t-time">${b.time}</b><small>${b.code} · ~${b.duration} daq</small></td>
        <td>${esc(b.name)}<small>${b.phone ? `<a href="tel:${esc(b.phone)}">${esc(b.phone)}</a>` : "—"}</small></td>
        <td><span class="t-plate">${esc(b.plate)}</span><small>${esc(b.model) || "—"} · ${carType(b.carType).name}</small></td>
        <td><span class="t-kind t-kind--${b.kind}">${KINDS[b.kind].name}</span>${s.name}<small>${fmt(b.price)} so'm</small></td>
        <td>${worker}</td>
        <td><ul class="hist">${hist}</ul></td>
        <td>${badge(b.status)}</td>
        <td><div class="actions">${acts.join("")}</div></td>
      </tr>`;
  }).join("");
}

// Jonli doska: 4 bosqich
function renderKanban(rows, staff) {
  const cols = [
    { key: "booked", name: "Kutilmoqda", hint: "bron qilingan" },
    { key: "arrived", name: "Keldi", hint: "navbatda turibdi" },
    { key: "working", name: "Ishlanmoqda", hint: "boksda / ko'targichda" },
    { key: "done", name: "Tayyor", hint: "topshirildi" },
  ];
  const now = Date.now();
  $("#kanban").innerHTML = cols.map((c) => {
    const items = rows.filter((b) => b.status === c.key);
    return `
      <section class="kcol kcol--${c.key}">
        <header class="kcol__head"><span class="kcol__dot"></span><b>${c.name}</b><em>${items.length}</em><small>${c.hint}</small></header>
        <div class="kcol__list">
          ${items.length ? items.map((b) => {
            const s = service(b.service);
            const who = Store.staffName(workerOf(b));
            const opts = staff.filter((x) => x.role === KINDS[b.kind].role && (x.active || x.id === b.staffId))
              .map((x) => `<option value="${x.id}" ${x.id === b.staffId ? "selected" : ""}>${esc(x.name)}</option>`).join("");
            let extra = "";
            if (b.status === "working") {
              const el = minutes(b.startedAt, now);
              const pct = Math.min(100, (el / b.duration) * 100);
              extra = `<div class="kcard__timer ${el > b.duration ? "is-late" : ""}"><span>${el} / ${b.duration} daq</span><i style="--p:${pct}%"></i></div>`;
            }
            if (b.status === "done") extra = `<div class="kcard__meta">${clock(b.doneAt)} da tugadi · ${minutes(b.startedAt || b.arrivedAt, b.doneAt)} daq</div>`;
            if (b.status === "arrived") extra = `<div class="kcard__meta">${clock(b.arrivedAt)} da keldi · ${minutes(b.arrivedAt, now)} daq kutyapti</div>`;
            const action = {
              booked: `<button class="act act--primary" data-act="arrive" data-id="${b.id}">Keldi</button>`,
              arrived: `<button class="act act--primary" data-act="start" data-id="${b.id}">Boshlash</button>`,
              working: `<button class="act act--ok" data-act="done" data-id="${b.id}">Tayyor</button>`,
              done: "",
            }[b.status];
            return `
              <article class="kcard kcard--${b.kind}">
                <div class="kcard__top"><b class="kcard__time">${b.time}</b><span class="t-kind t-kind--${b.kind}">${b.kind === "wash" ? "Moyka" : "Servis"}</span><span class="kcard__code">${b.code}</span></div>
                <div class="kcard__plate">${esc(b.plate)}</div>
                <div class="kcard__car">${esc(b.model) || "—"} · ${carType(b.carType).name}</div>
                <div class="kcard__svc">${s.name}</div>
                ${extra}
                <div class="kcard__foot">
                  ${["booked", "arrived"].includes(b.status)
                    ? `<select class="mini-select" data-staff="${b.id}" aria-label="Xodim">${opts}</select>`
                    : `<span class="t-staff">${svg("user")}${esc(who)}</span>`}
                  ${action}
                </div>
              </article>`;
          }).join("") : `<p class="kcol__empty">Bo'sh</p>`}
        </div>
      </section>`;
  }).join("");
}

/* =================== XODIMLAR =================== */
function initStaff() {
  segment("#staffPeriod", "p", (p) => { ui.staffPeriod = +p; renderStaff(); });

  $("#addStaff").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    const name = f.name.value.trim();
    if (name.length < 2) return;
    const list = Store.staff();
    list.push({ id: (f.role.value === "washer" ? "w" : "m") + uid(), name, role: f.role.value, active: true });
    Store.saveStaff(list);
    f.reset();
    renderStaff();
  });

  $("#staffGrid").addEventListener("change", (e) => {
    const t = e.target;
    const list = Store.staff();
    const s = list.find((x) => x.id === t.dataset.id);
    if (!s) return;
    if (t.dataset.f === "name" && t.value.trim().length >= 2) s.name = t.value.trim();
    if (t.dataset.f === "active") s.active = t.checked;
    Store.saveStaff(list);
    renderStaff();
  });

  $("#staffGrid").addEventListener("click", (e) => {
    const del = e.target.closest("[data-del]");
    if (!del) return;
    const s = Store.staffById(del.dataset.del);
    if (!confirm(`${s.name} ro'yxatdan o'chirilsinmi?`)) return;
    Store.saveStaff(Store.staff().filter((x) => x.id !== s.id));
    renderStaff();
  });
}

function renderStaff() {
  const days = ui.staffPeriod;
  const all = Store.bookings();
  const today = ymd();
  const periodName = days === 1 ? "bugun" : `${days} kunda`;

  $("#staffGrid").innerHTML = Store.staff().map((s) => {
    const served = all.filter((b) => isServed(b) && workerOf(b) === s.id && inRange(b, days))
      .sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
    const total = all.filter((b) => isServed(b) && workerOf(b) === s.id).length;
    const revenue = served.reduce((x, b) => x + b.price, 0);
    const timed = served.filter((b) => b.startedAt && b.doneAt);
    const avg = timed.length ? Math.round(timed.reduce((x, b) => x + minutes(b.startedAt, b.doneAt), 0) / timed.length) : 0;
    const now = all.find((b) => b.date === today && b.status === "working" && workerOf(b) === s.id);
    const next = all.filter((b) => b.date === today && ["booked", "arrived"].includes(b.status) && b.staffId === s.id).sort((a, b) => a.time.localeCompare(b.time))[0];
    const typeMax = Math.max(1, ...CAR_TYPES.map((c) => served.filter((b) => b.carType === c.id).length));
    const role = s.role === "washer" ? "Moyshik" : "Usta";

    return `
      <article class="bezel staff-card ${s.active ? "" : "is-off"}">
        <div class="bezel__core staff-card__core">
          <header class="staff-card__head">
            <span class="staff-ava staff-ava--${s.role}">${esc(s.name.slice(0, 1))}</span>
            <div class="staff-card__name">
              <input type="text" value="${esc(s.name)}" data-id="${s.id}" data-f="name" aria-label="Ism">
              <span class="t-kind t-kind--${s.role === "washer" ? "wash" : "service"}">${role}</span>
            </div>
            <label class="switch" title="Ishda / dam olishda">
              <input type="checkbox" data-id="${s.id}" data-f="active" ${s.active ? "checked" : ""}>
              <span></span><em>${s.active ? "Ishda" : "Dam olishda"}</em>
            </label>
          </header>

          <div class="staff-now ${now ? "is-busy" : ""}">
            ${now ? `<i class="dot dot--live"></i> Hozir: <b>${now.code} · ${esc(now.plate)}</b> ${esc(now.model)} · ${clock(now.startedAt)} dan`
                  : next ? `Keyingisi: <b>${next.time} · ${next.code}</b> ${esc(next.model)}` : "Hozir bo'sh"}
          </div>

          <div class="staff-stats">
            <div><b>${served.length}</b><span>mashina ${periodName}</span></div>
            <div><b>${fmt(revenue)}</b><span>so'm ${periodName}</span></div>
            <div><b>${avg || "—"}</b><span>o'rtacha daq</span></div>
            <div><b>${total}</b><span>jami</span></div>
          </div>

          <div class="staff-types">
            ${CAR_TYPES.map((c) => {
              const n = served.filter((b) => b.carType === c.id).length;
              return `<div><span>${c.name}</span><span class="hbars__track"><span class="hbars__bar s3" style="--w:${(n / typeMax) * 100}%"></span></span><b>${n}</b></div>`;
            }).join("")}
          </div>

          <details class="staff-cars">
            <summary>Qaysi mashinalarni ${s.role === "washer" ? "yuvdi" : "ta'mirladi"} (${served.length})</summary>
            ${served.length ? `<table class="mini-table">
              <thead><tr><th>Vaqt</th><th>Mashina</th><th>Turi</th><th>Xizmat</th><th>Daq</th></tr></thead>
              <tbody>${served.slice(0, 60).map((b) => `
                <tr><td>${dateTime(b.doneAt)}</td><td><b class="t-plate">${esc(b.plate)}</b> ${esc(b.model)}</td><td>${carType(b.carType).name}</td><td>${service(b.service).name}</td><td>${b.startedAt && b.doneAt ? minutes(b.startedAt, b.doneAt) : "—"}</td></tr>`).join("")}
              </tbody></table>` : `<p class="empty">Bu davrda mashina yo'q.</p>`}
          </details>

          ${total === 0 ? `<button class="act act--icon staff-del" data-del="${s.id}" aria-label="${esc(s.name)} ni o'chirish">${svg("trash")}</button>` : ""}
        </div>
      </article>`;
  }).join("");
}

/* =================== HISOBOT =================== */
function initReport() {
  segment("#repPeriod", "p", (p) => { ui.repPeriod = +p; renderReport(); });
  $("#clearDemo").addEventListener("click", () => {
    if (!confirm("Barcha demo yozuvlar o'chirilsinmi? Haqiqiy bronlar qoladi.")) return;
    clearDemo();
    render();
  });
}

function renderReport() {
  const days = ui.repPeriod;
  const all = Store.bookings();
  const inP = all.filter((b) => inRange(b, days));
  const served = inP.filter(isServed);

  $("#rTotal").textContent = served.length;
  $("#rWash").textContent = served.filter((b) => b.kind === "wash").length;
  $("#rServ").textContent = served.filter((b) => b.kind === "service").length;
  $("#rRevenue").textContent = fmt(served.reduce((s, b) => s + b.price, 0));
  $("#rNoshow").textContent = inP.filter((b) => b.status === "noshow").length;
  $("#repRange").textContent = `${dayLabel(addDays(ymd(), -(days - 1)))} — bugun`;
  $("#demoBar").classList.toggle("hidden", !all.some((b) => b.demo));

  barChart($("#repDaily"), dailyCounts(days, all).map((d) => ({
    label: d.label,
    title: `${dayLabel(d.date)}, ${weekday(d.date)}`,
    values: { wash: d.wash, service: d.service },
    extra: `Tushum: ${fmt(d.revenue)} so'm`,
  })), [{ key: "wash", name: "Moyka", cls: "s1" }, { key: "service", name: "Avtoservis", cls: "s2" }], { height: 280 });

  hBars($("#repStaff"), Store.staff().map((s) => {
    const mine = served.filter((b) => workerOf(b) === s.id);
    return { label: s.name, sub: `${fmt(mine.reduce((x, b) => x + b.price, 0))} so'm`, value: mine.length, cls: s.role === "washer" ? "s1" : "s2" };
  }).sort((a, b) => b.value - a.value));

  hBars($("#repTypes"), CAR_TYPES.map((c) => ({ label: c.name, sub: c.hint, value: served.filter((b) => b.carType === c.id).length })), { cls: "s3" });

  const models = {};
  served.forEach((b) => { const m = (b.model || "—").trim(); models[m] = (models[m] || 0) + 1; });
  hBars($("#repModels"), Object.entries(models).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value })), { cls: "s3" });

  hBars($("#repServices"), SERVICES.map((s) => {
    const mine = served.filter((b) => b.service === s.id);
    return { label: s.name, sub: `${fmt(mine.reduce((x, b) => x + b.price, 0))} so'm`, value: mine.length, cls: s.kind === "wash" ? "s1" : "s2" };
  }).filter((i) => i.value).sort((a, b) => b.value - a.value).slice(0, 8));
}

initAdmin();

/* =================== KAFE =================== */
function updateCafeBadge() {
  const n = Store.cafe().filter((o) => o.status === "new").length;
  const b = $("#cafeBadge");
  if (!b) return;
  b.textContent = n;
  b.classList.toggle("hidden", !n);
}

function initCafe() {
  $("#cafeBoard").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-cafe]");
    if (!btn) return;
    const id = btn.dataset.id, act = btn.dataset.cafe, now = Date.now();
    if (act === "cancel" && !confirm("Buyurtma bekor qilinsinmi?")) return;
    const patch = { making: { status: "making", makingAt: now }, ready: { status: "ready", readyAt: now }, given: { status: "given", givenAt: now }, cancel: { status: "cancelled" } }[act];
    Store.updateCafe(id, patch);
    renderCafe();
    updateCafeBadge();
  });
}

function renderCafe() {
  const today = ymd();
  const list = Store.cafe().filter((o) => ymd(new Date(o.createdAt)) === today && o.status !== "cancelled").sort((a, b) => a.createdAt - b.createdAt);
  const given = list.filter((o) => o.status === "given");
  setNum($("#cNew"), list.filter((o) => o.status === "new").length);
  setNum($("#cMaking"), list.filter((o) => o.status === "making").length);
  setNum($("#cGiven"), given.length);
  $("#cRevenue").textContent = fmt(given.reduce((s, o) => s + o.total, 0));

  const cols = [
    { key: "new", name: "Yangi", hint: "qabul qiling", act: ["making", "Tayyorlash", "act--primary"] },
    { key: "making", name: "Tayyorlanmoqda", hint: "barista ishlayapti", act: ["ready", "Tayyor", "act--ok"] },
    { key: "ready", name: "Tayyor", hint: "berish kerak", act: ["given", "Berildi", "act--primary"] },
    { key: "given", name: "Berildi", hint: "bugun" },
  ];
  $("#cafeBoard").innerHTML = cols.map((c) => {
    const items = list.filter((o) => o.status === c.key);
    return `
      <section class="kcol kcol--cafe-${c.key}">
        <header class="kcol__head"><span class="kcol__dot"></span><b>${c.name}</b><em>${items.length}</em><small>${c.hint}</small></header>
        <div class="kcol__list">
          ${items.length ? items.map((o) => `
            <article class="kcard kcard--cafe">
              <div class="kcard__top"><b class="kcard__time">${clock(o.createdAt)}</b><span class="t-kind t-kind--cafe">${o.where === "car" ? "Mashinaga" : "Kafeda"}</span><span class="kcard__code">${o.code}</span></div>
              <ul class="kcard__order">${o.items.map((it) => `<li><b>${it.qty}×</b> ${esc(cafeItem(it.id)?.name || it.id)}</li>`).join("")}</ul>
              ${o.note ? `<div class="kcard__note">«${esc(o.note)}»</div>` : ""}
              <div class="kcard__car">${esc(o.name)} · <a href="tel:${esc(o.phone)}">${esc(o.phone)}</a>${o.where === "car" ? ` · <b class="t-plate">${esc(o.plate)}</b>` : ""}</div>
              <div class="kcard__foot">
                <b class="kcard__sum">${fmt(o.total)} so'm</b>
                <span class="actions">
                  ${c.act ? `<button class="act ${c.act[2]}" data-cafe="${c.act[0]}" data-id="${o.id}">${c.act[1]}</button>` : `<span class="kcard__meta">${clock(o.givenAt)}</span>`}
                  ${c.key !== "given" ? `<button class="act act--icon" data-cafe="cancel" data-id="${o.id}" aria-label="${o.code} ni bekor qilish">${svg("trash")}</button>` : ""}
                </span>
              </div>
            </article>`).join("") : `<p class="kcol__empty">Bo'sh</p>`}
        </div>
      </section>`;
  }).join("");
}
