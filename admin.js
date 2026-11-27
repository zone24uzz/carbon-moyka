// Carbon — admin panel: API orqali (token bilan). Jadval, kafe, xodimlar, hisobot, yangi bron xabarlari.

const ui = { view: "schedule", date: today(), kind: "all", status: "all", staffPeriod: 1, repPeriod: 7 };
const D = { bookings: [], staff: [], cafe: [], loaded: false };
const known = { b: null, c: null };
const logged = () => !!sessionStorage.getItem(TOKENS.admin);
const inRange = (b, days) => b.date >= addDays(today(), -(days - 1)) && b.date <= today();
const workerOf = (b) => b.startedBy || b.staffId;
const staffName = (id) => D.staff.find((s) => s.id === id)?.name || "—";
const minutes = (a, b) => Math.max(1, Math.round((b - a) / 60000));
const dateTime = (ts) => {
  if (!ts) return "—";
  const d = dateOfTs(ts);
  return d === today() ? clock(ts) : `${dObj(d).getUTCDate()}-${MONTHS[dObj(d).getUTCMonth()]} ${clock(ts)}`;
};

/* =================== Kirish =================== */
function initAdmin() {
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { login, password } = Object.fromEntries(new FormData(e.target));
    const btn = $("button[type=submit]", e.target);
    btn.disabled = true;
    try {
      const r = await api("/admin/login", { method: "POST", body: { login, password }, auth: false });
      sessionStorage.setItem(TOKENS.admin, r.token);
      $("#loginError").textContent = "";
      e.target.reset();
      await show();
    } catch (err) { $("#loginError").textContent = err.message; }
    finally { btn.disabled = false; }
  });
  $("#logoutBtn").addEventListener("click", () => { sessionStorage.removeItem(TOKENS.admin); show(); });
  $("#notifyBtn").addEventListener("click", async () => { if (await Notify.ask()) { toast("Yangi bron va buyurtmalar haqida xabar keladi.", "ok"); updateNotifyBtn(); } });

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

  setInterval(() => ($("#clock").textContent = toHHMM(nowMin())), 15000);
  $("#clock").textContent = toHHMM(nowMin());
  setInterval(() => logged() && !document.activeElement?.matches("input, select") && load(), 10000);
  let rw;
  window.addEventListener("resize", () => { clearTimeout(rw); rw = setTimeout(() => logged() && ui.view === "report" && renderReport(), 150); });
  show();
}

async function show() {
  const on = logged();
  if (on) {
    try { await api("/admin/me", { auth: "admin" }); }
    catch { sessionStorage.removeItem(TOKENS.admin); return show(); }
  }
  $("#loginView").classList.toggle("hidden", logged());
  $("#panelView").classList.toggle("hidden", !logged());
  if (logged()) { updateNotifyBtn(); await load(); }
}
function updateNotifyBtn() {
  const b = $("#notifyBtn");
  b.classList.toggle("is-on", Notify.enabled());
  b.title = Notify.enabled() ? "Xabarlar yoqilgan" : "Yangi bronlar haqida xabar olish";
}

/* =================== Ma'lumot yuklash =================== */
async function load() {
  try {
    const t = today();
    const [bookings, staff, cafe] = await Promise.all([
      api(`/admin/bookings?from=${addDays(t, -29)}&to=${addDays(t, 7)}`, { auth: "admin" }),
      api("/admin/staff", { auth: "admin" }),
      api(`/admin/cafe?from=${addDays(t, -29)}`, { auth: "admin" }),
    ]);
    detectNew(bookings, cafe);
    Object.assign(D, { bookings, staff, cafe, loaded: true });
    $("#apiState").classList.add("hidden");
    render();
  } catch (err) {
    if (err.status === 401) return show();
    $("#apiState").classList.remove("hidden");
  }
}
// Yangi bron / kafe buyurtmasi — Notification
function detectNew(bookings, cafe) {
  const bIds = new Set(bookings.map((b) => b.id));
  const cIds = new Set(cafe.map((c) => c.id));
  if (known.b) {
    bookings.filter((b) => !known.b.has(b.id) && !b.walkin).forEach((b) =>
      Notify.send("Yangi bron", `${b.code} · ${dayLabel(b.date)} ${b.time} · ${b.plate} · ${service(b.service).name}`, "nb" + b.id));
    cafe.filter((c) => !known.c.has(c.id)).forEach((c) =>
      Notify.send("Kafe: yangi buyurtma", `${c.code} · ${c.items.map((i) => `${i.qty}× ${cafeItem(i.id)?.name}`).join(", ")}${c.where === "car" ? ` → ${c.plate}` : ""}`, "nc" + c.id));
  }
  known.b = bIds; known.c = cIds;
}
async function act(path, body, method = "PATCH") {
  try { await api(path, { method, body, auth: "admin" }); await load(); }
  catch (err) { toast(err.message, "err"); if (err.status === 401) show(); else load(); }
}

function render() {
  if (!D.loaded) return;
  if (ui.view === "schedule") renderSchedule();
  if (ui.view === "staff") renderStaff();
  if (ui.view === "report") renderReport();
  if (ui.view === "cafe") renderCafe();
  const n = D.cafe.filter((o) => o.status === "new").length;
  $("#cafeBadge").textContent = n;
  $("#cafeBadge").classList.toggle("hidden", !n);
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
  const setDate = (d) => {
    const min = addDays(today(), -29), max = addDays(today(), 7);
    ui.date = d < min ? min : d > max ? max : d;
    pick.value = ui.date;
    renderSchedule();
  };
  pick.value = ui.date;
  pick.min = addDays(today(), -29);
  pick.max = addDays(today(), 7);
  pick.addEventListener("change", () => pick.value && setDate(pick.value));
  $("#dPrev").addEventListener("click", () => setDate(addDays(ui.date, -1)));
  $("#dNext").addEventListener("click", () => setDate(addDays(ui.date, 1)));
  $("#dToday").addEventListener("click", () => setDate(today()));
  segment("#kindFilter", "k", (k) => { ui.kind = k; renderSchedule(); });
  $("#statusFilter").addEventListener("change", (e) => { ui.status = e.target.value; renderSchedule(); });
  $("#search").addEventListener("input", renderSchedule);

  const view = $("#view-schedule");
  view.addEventListener("change", (e) => {
    const sel = e.target.closest("select[data-staff]");
    if (sel) act(`/admin/bookings/${sel.dataset.staff}`, { staffId: sel.value });
  });
  view.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const id = btn.dataset.id, a = btn.dataset.act;
    const b = D.bookings.find((x) => x.id === id);
    if (a === "delete") {
      if (confirm(`${b.code} (${b.plate}) butunlay o'chirilsinmi?`)) act(`/admin/bookings/${id}`, null, "DELETE");
      return;
    }
    const sel = $(`select[data-staff="${id}"]`);
    act(`/admin/bookings/${id}`, { action: a, staffId: a === "start" && sel ? sel.value : undefined });
  });

  // Jonli mijoz
  const f = $("#walkinForm");
  const fill = () => {
    const kind = f.kind.value;
    f.service.innerHTML = SERVICES.filter((s) => s.kind === kind).map((s) => `<option value="${s.id}">${s.name}</option>`).join("");
    f.carType.innerHTML = CAR_TYPES.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
    f.staffId.innerHTML = D.staff.filter((s) => s.active && s.role === KINDS[kind].role).map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("");
  };
  f.kind.addEventListener("change", fill);
  $("#walkin").addEventListener("toggle", fill);
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    if (!normalizePlate(d.plate)) { $("#walkinError").textContent = "Avto raqam noto'g'ri. Masalan: 01 A 123 BC"; return; }
    try {
      await api("/admin/bookings", { method: "POST", body: d, auth: "admin" });
      f.reset(); $("#walkinError").textContent = ""; $("#walkin").open = false;
      ui.date = today(); $("#dPick").value = ui.date;
      await load();
      toast("Mijoz qo'shildi.", "ok");
    } catch (err) { $("#walkinError").textContent = err.message; }
  });
}

function renderSchedule() {
  const day = D.bookings.filter((b) => b.date === ui.date);
  $("#schedDayLabel").textContent = `${dayLabel(ui.date)} · ${weekday(ui.date)}`;
  const done = day.filter((b) => b.status === "done");
  setNum($("#kTotal"), day.filter((b) => b.status !== "cancelled").length);
  setNum($("#kArrived"), day.filter((b) => ["arrived", "working", "done"].includes(b.status)).length);
  setNum($("#kWorking"), day.filter((b) => b.status === "working").length);
  setNum($("#kDone"), done.length);
  $("#kRevenue").textContent = fmt(done.reduce((s, b) => s + b.price, 0));

  const q = $("#search").value.trim().toLowerCase();
  const qKey = plateKey(q);
  let rows = [...day].sort((a, b) => a.time.localeCompare(b.time) || a.createdAt - b.createdAt);
  if (ui.kind !== "all") rows = rows.filter((b) => b.kind === ui.kind);
  if (ui.status !== "all") rows = rows.filter((b) => b.status === ui.status);
  if (q) rows = rows.filter((b) => [b.name, b.phone, b.plate, b.model, b.code].join(" ").toLowerCase().includes(q) || (qKey.length > 2 && plateKey(b.plate).includes(qKey)));

  renderKanban(rows);
  $("#schedEmpty").classList.toggle("hidden", rows.length > 0);
  $("#schedTable").innerHTML = rows.map((b) => {
    const s = service(b.service);
    const editable = ["booked", "arrived"].includes(b.status);
    const options = D.staff.filter((x) => x.role === KINDS[b.kind].role && (x.active || x.id === b.staffId))
      .map((x) => `<option value="${x.id}" ${x.id === b.staffId ? "selected" : ""}>${esc(x.name)}</option>`).join("");
    const worker = editable ? `<select class="mini-select" data-staff="${b.id}" aria-label="Xodim">${options}</select>` : `<span class="t-staff">${svg("user")}${esc(staffName(workerOf(b)))}</span>`;
    const hist = [
      `<li><span>Yozildi</span>${dateTime(b.createdAt)}${b.walkin ? " · jonli" : b.userId ? " · akkaunt" : ""}</li>`,
      b.arrivedAt ? `<li><span>Keldi</span>${clock(b.arrivedAt)}</li>` : "",
      b.startedAt ? `<li><span>Boshladi</span>${clock(b.startedAt)} · ${esc(staffName(b.startedBy))}</li>` : "",
      b.doneAt ? `<li><span>Tayyor</span>${clock(b.doneAt)} · ${minutes(b.startedAt || b.arrivedAt, b.doneAt)} daq</li>` : "",
    ].join("");
    const A = (a, label, cls = "") => `<button class="act ${cls}" data-act="${a}" data-id="${b.id}">${label}</button>`;
    const acts = {
      booked: [A("arrive", "Keldi", "act--primary"), A("noshow", "Kelmadi"), A("cancel", "Bekor")],
      arrived: [A("start", "Boshlash", "act--primary"), A("noshow", "Kelmadi")],
      working: [A("done", "Tayyor", "act--ok"), A("back", "Qaytarish")],
      done: [], noshow: [A("restore", "Tiklash")], cancelled: [A("restore", "Tiklash")],
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

function renderKanban(rows) {
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
            const opts = D.staff.filter((x) => x.role === KINDS[b.kind].role && (x.active || x.id === b.staffId)).map((x) => `<option value="${x.id}" ${x.id === b.staffId ? "selected" : ""}>${esc(x.name)}</option>`).join("");
            let extra = "";
            if (b.status === "working") { const el = minutes(b.startedAt, now); extra = `<div class="kcard__timer ${el > b.duration ? "is-late" : ""}"><span>${el} / ${b.duration} daq</span><i style="--p:${Math.min(100, (el / b.duration) * 100)}%"></i></div>`; }
            if (b.status === "done") extra = `<div class="kcard__meta">${clock(b.doneAt)} da tugadi · ${minutes(b.startedAt || b.arrivedAt, b.doneAt)} daq</div>`;
            if (b.status === "arrived") extra = `<div class="kcard__meta">${clock(b.arrivedAt)} da keldi · ${minutes(b.arrivedAt, now)} daq kutyapti</div>`;
            const action = { booked: `<button class="act act--primary" data-act="arrive" data-id="${b.id}">Keldi</button>`, arrived: `<button class="act act--primary" data-act="start" data-id="${b.id}">Boshlash</button>`, working: `<button class="act act--ok" data-act="done" data-id="${b.id}">Tayyor</button>`, done: "" }[b.status];
            return `
              <article class="kcard kcard--${b.kind}">
                <div class="kcard__top"><b class="kcard__time">${b.time}</b><span class="t-kind t-kind--${b.kind}">${b.kind === "wash" ? "Moyka" : "Servis"}</span><span class="kcard__code">${b.code}</span></div>
                <div class="kcard__plate">${esc(b.plate)}</div>
                <div class="kcard__car">${esc(b.model) || "—"} · ${carType(b.carType).name}</div>
                <div class="kcard__svc">${service(b.service).name}</div>
                ${extra}
                <div class="kcard__foot">
                  ${["booked", "arrived"].includes(b.status) ? `<select class="mini-select" data-staff="${b.id}" aria-label="Xodim">${opts}</select>` : `<span class="t-staff">${svg("user")}${esc(staffName(workerOf(b)))}</span>`}
                  ${action}
                </div>
              </article>`;
          }).join("") : `<p class="kcol__empty">Bo'sh</p>`}
        </div>
      </section>`;
  }).join("");
}

/* =================== KAFE =================== */
function initCafe() {
  $("#cafeBoard").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-cafe]");
    if (!btn) return;
    const to = btn.dataset.cafe;
    if (to === "cancelled" && !confirm("Buyurtma bekor qilinsinmi?")) return;
    act(`/admin/cafe/${btn.dataset.id}`, { status: to });
  });
}
function renderCafe() {
  const list = D.cafe.filter((o) => o.date === today() && o.status !== "cancelled");
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
                  ${c.key !== "given" ? `<button class="act act--icon" data-cafe="cancelled" data-id="${o.id}" aria-label="${o.code} ni bekor qilish">${svg("trash")}</button>` : ""}
                </span>
              </div>
            </article>`).join("") : `<p class="kcol__empty">Bo'sh</p>`}
        </div>
      </section>`;
  }).join("");
}

/* =================== XODIMLAR =================== */
function initStaff() {
  segment("#staffPeriod", "p", (p) => { ui.staffPeriod = +p; renderStaff(); });
  $("#addStaff").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    if (!validName(f.name.value)) return toast("Ismni to'g'ri yozing.", "err");
    await act("/admin/staff", { name: f.name.value, role: f.role.value }, "POST");
    f.reset();
  });
  $("#staffGrid").addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.f === "name" && validName(t.value)) act(`/admin/staff/${t.dataset.id}`, { name: t.value });
    if (t.dataset.f === "active") act(`/admin/staff/${t.dataset.id}`, { active: t.checked });
  });
  $("#staffGrid").addEventListener("click", (e) => {
    const del = e.target.closest("[data-del]");
    if (del && confirm(`${staffName(del.dataset.del)} ro'yxatdan o'chirilsinmi?`)) act(`/admin/staff/${del.dataset.del}`, null, "DELETE");
  });
}
function renderStaff() {
  const days = ui.staffPeriod;
  const all = D.bookings;
  const t = today();
  const periodName = days === 1 ? "bugun" : `${days} kunda`;
  $("#staffGrid").innerHTML = D.staff.map((s) => {
    const served = all.filter((b) => isServed(b) && workerOf(b) === s.id && inRange(b, days)).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
    const total = all.filter((b) => isServed(b) && workerOf(b) === s.id).length;
    const revenue = served.reduce((x, b) => x + b.price, 0);
    const timed = served.filter((b) => b.startedAt && b.doneAt);
    const avg = timed.length ? Math.round(timed.reduce((x, b) => x + minutes(b.startedAt, b.doneAt), 0) / timed.length) : 0;
    const now = all.find((b) => b.date === t && b.status === "working" && workerOf(b) === s.id);
    const next = all.filter((b) => b.date === t && ["booked", "arrived"].includes(b.status) && b.staffId === s.id).sort((a, b) => a.time.localeCompare(b.time))[0];
    const typeMax = Math.max(1, ...CAR_TYPES.map((c) => served.filter((b) => b.carType === c.id).length));
    const used = all.some((b) => b.staffId === s.id || b.startedBy === s.id);
    return `
      <article class="bezel staff-card ${s.active ? "" : "is-off"}">
        <div class="bezel__core staff-card__core">
          <header class="staff-card__head">
            <span class="staff-ava staff-ava--${s.role}">${esc(s.name.slice(0, 1))}</span>
            <div class="staff-card__name">
              <input type="text" value="${esc(s.name)}" data-id="${s.id}" data-f="name" aria-label="Ism">
              <span class="t-kind t-kind--${s.role === "washer" ? "wash" : "service"}">${s.role === "washer" ? "Moyshik" : "Usta"}</span>
            </div>
            <label class="switch" title="Ishda / dam olishda"><input type="checkbox" data-id="${s.id}" data-f="active" ${s.active ? "checked" : ""}><span></span><em>${s.active ? "Ishda" : "Dam olishda"}</em></label>
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
            ${CAR_TYPES.map((c) => { const n = served.filter((b) => b.carType === c.id).length; return `<div><span>${c.name}</span><span class="hbars__track"><span class="hbars__bar s3" style="--w:${(n / typeMax) * 100}%"></span></span><b>${n}</b></div>`; }).join("")}
          </div>
          <details class="staff-cars">
            <summary>Qaysi mashinalarni ${s.role === "washer" ? "yuvdi" : "ta'mirladi"} (${served.length})</summary>
            ${served.length ? `<table class="mini-table"><thead><tr><th>Vaqt</th><th>Mashina</th><th>Turi</th><th>Xizmat</th><th>Daq</th></tr></thead><tbody>${served.slice(0, 60).map((b) => `
              <tr><td>${dateTime(b.doneAt)}</td><td><b class="t-plate">${esc(b.plate)}</b> ${esc(b.model)}</td><td>${carType(b.carType).name}</td><td>${service(b.service).name}</td><td>${b.startedAt && b.doneAt ? minutes(b.startedAt, b.doneAt) : "—"}</td></tr>`).join("")}</tbody></table>` : `<p class="empty">Bu davrda mashina yo'q.</p>`}
          </details>
          ${!used ? `<button class="act act--icon staff-del" data-del="${s.id}" aria-label="${esc(s.name)} ni o'chirish">${svg("trash")}</button>` : ""}
        </div>
      </article>`;
  }).join("");
}

/* =================== HISOBOT =================== */
function initReport() { segment("#repPeriod", "p", (p) => { ui.repPeriod = +p; renderReport(); }); }
function renderReport() {
  const days = ui.repPeriod;
  const inP = D.bookings.filter((b) => inRange(b, days));
  const served = inP.filter(isServed);
  const cafeP = D.cafe.filter((o) => o.status === "given" && o.date >= addDays(today(), -(days - 1)));
  setNum($("#rTotal"), served.length);
  setNum($("#rWash"), served.filter((b) => b.kind === "wash").length);
  setNum($("#rServ"), served.filter((b) => b.kind === "service").length);
  $("#rRevenue").textContent = fmt(served.reduce((s, b) => s + b.price, 0) + cafeP.reduce((s, o) => s + o.total, 0));
  setNum($("#rNoshow"), inP.filter((b) => b.status === "noshow").length);
  $("#repRange").textContent = `${dayLabel(addDays(today(), -(days - 1)))} — bugun · kafe tushumi ham hisobda`;
  barChart($("#repDaily"), dailyCounts(days, D.bookings).map((d) => ({ label: d.label, title: `${dayLabel(d.date)}, ${weekday(d.date)}`, values: { wash: d.wash, service: d.service }, extra: `Tushum: ${fmt(d.revenue)} so'm` })),
    [{ key: "wash", name: "Moyka", cls: "s1" }, { key: "service", name: "Avtoservis", cls: "s2" }], { height: 280 });
  hBars($("#repStaff"), D.staff.map((s) => { const m = served.filter((b) => workerOf(b) === s.id); return { label: s.name, sub: `${fmt(m.reduce((x, b) => x + b.price, 0))} so'm`, value: m.length, cls: s.role === "washer" ? "s1" : "s2" }; }).sort((a, b) => b.value - a.value));
  hBars($("#repTypes"), CAR_TYPES.map((c) => ({ label: c.name, sub: c.hint, value: served.filter((b) => b.carType === c.id).length })), { cls: "s3" });
  const models = {};
  served.forEach((b) => { const k = (b.model || "—").trim(); models[k] = (models[k] || 0) + 1; });
  hBars($("#repModels"), Object.entries(models).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value })), { cls: "s3" });
  hBars($("#repServices"), SERVICES.map((s) => { const m = served.filter((b) => b.service === s.id); return { label: s.name, sub: `${fmt(m.reduce((x, b) => x + b.price, 0))} so'm`, value: m.length, cls: s.kind === "wash" ? "s1" : "s2" }; }).filter((i) => i.value).sort((a, b) => b.value - a.value).slice(0, 8));
}

initAdmin();
