const SUPABASE_URL = "https://iybljtviwkuxjfpmfopb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5YmxqdHZpd2t1eGpmcG1mb3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMzEwNDQsImV4cCI6MjA5NzcwNzA0NH0.fgIfXxTf5GdUTNlac6VWN7mE6TtSUugK8OzFH-lZS4g";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const statuses = ["Проект", "Анализ", "Подали", "Выиграли", "Проиграли", "Договор", "Отказ", "Закрыто"];
const inactiveStatuses = new Set(["Закрыто", "Проиграли", "Отказ"]);

let state = { lots: [], calculations: [] };

const els = {
  totalLots: document.querySelector("#totalLots"),
  monthRevenue: document.querySelector("#monthRevenue"),
  deadlineList: document.querySelector("#deadlineList"),
  lotsList: document.querySelector("#lotsList"),
  calcList: document.querySelector("#calcList"),
  lotSearch: document.querySelector("#lotSearch"),
  calcSearch: document.querySelector("#calcSearch"),
  statusFilter: document.querySelector("#statusFilter"),
  lotDialog: document.querySelector("#lotDialog"),
  calcDialog: document.querySelector("#calcDialog"),
  lotForm: document.querySelector("#lotForm"),
  calcForm: document.querySelector("#calcForm"),
  deleteLotButton: document.querySelector("#deleteLotButton"),
  deleteCalcButton: document.querySelector("#deleteCalcButton"),
  calcPreview: document.querySelector("#calcPreview"),
  backupButton: document.querySelector("#backupButton"),
  importButton: document.querySelector("#importButton"),
  importInput: document.querySelector("#importInput"),
  loginDialog: document.querySelector("#loginDialog"),
  loginForm: document.querySelector("#loginForm"),
  logoutButton: document.querySelector("#logoutButton")
};

init();

function init() {
  fillStatusOptions();
  bindEvents();
  setupAuth();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

// --- СИСТЕМА АВТОРИЗАЦИИ (КОМПЛЕКСНАЯ) ---
function setupAuth() {
  els.loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = event.target.email.value.trim();
    const password = event.target.password.value.trim();
    
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      alert("Ошибка авторизации: проверьте данные.");
    }
  });

  els.logoutButton?.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    localStorage.clear();
    window.location.reload();
  });

  // Первичная проверка при загрузке
  supabaseClient.auth.getSession().then(({ data: { session } }) => {
    handleAuthRoute(session);
  });

  // Динамическое отслеживание сессии
  supabaseClient.auth.onAuthStateChange((event, session) => {
    handleAuthRoute(session);
  });
}

function handleAuthRoute(session) {
  if (session) {
    if (els.loginDialog?.open) els.loginDialog.close();
    if (els.logoutButton) els.logoutButton.style.display = "block";
    loadStateFromSupabase(); 
  } else {
    if (els.loginDialog && !els.loginDialog.open) els.loginDialog.showModal();
    if (els.logoutButton) els.logoutButton.style.display = "none";
    state = { lots: [], calculations: [] }; 
    render();
  }
}

// --- РАБОТА С ДАННЫМИ (SUPABASE) ---
function bindEvents() {
  document.querySelectorAll(".nav-button:not(#logoutButton)").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });
  document.querySelectorAll("[data-open-lot]").forEach((b) => b.addEventListener("click", () => openLotDialog()));
  document.querySelectorAll("[data-open-calc]").forEach((b) => b.addEventListener("click", () => openCalcDialog()));
  document.querySelectorAll("[data-close-dialog]").forEach((b) => {
    b.addEventListener("click", () => document.querySelector(`#${b.dataset.closeDialog}`)?.close());
  });

  els.lotSearch?.addEventListener("input", renderLots);
  els.calcSearch?.addEventListener("input", renderCalculations);
  els.statusFilter?.addEventListener("change", renderLots);
  els.lotForm?.addEventListener("submit", saveLotFromForm);
  els.calcForm?.addEventListener("submit", saveCalcFromForm);
  els.deleteLotButton?.addEventListener("click", deleteCurrentLot);
  els.deleteCalcButton?.addEventListener("click", deleteCurrentCalc);
  els.calcForm?.addEventListener("input", updateCalcPreview);
  els.backupButton?.addEventListener("click", downloadBackup);
  els.importButton?.addEventListener("click", () => els.importInput?.click());
  els.importInput?.addEventListener("change", importBackup);
}

function mapLotToClient(dbLot) {
  return { id: dbLot.id, lotNumber: dbLot.lot_number, status: dbLot.status, name: dbLot.name, category: dbLot.category, deadline: dbLot.deadline, address: dbLot.address, budget: dbLot.budget, comment: dbLot.comment, link: dbLot.link, docs: dbLot.docs, closedAt: dbLot.closed_at };
}

function mapCalcToClient(dbCalc) {
  return { id: dbCalc.id, lotId: dbCalc.lot_id, purchase: dbCalc.purchase, delivery: dbCalc.delivery, work: dbCalc.work, extra: dbCalc.extra, sale: dbCalc.sale };
}

async function loadStateFromSupabase() {
  const { data: lots, error: lotsError } = await supabaseClient.from("lots").select("*");
  if (lotsError) return console.error("LOTS ERROR", lotsError);

  const { data: calculations, error: calcError } = await supabaseClient.from("calculations").select("*");
  if (calcError) return console.error("CALC ERROR", calcError);

  state = { lots: (lots || []).map(mapLotToClient), calculations: (calculations || []).map(mapCalcToClient) };
  render();
}

async function saveLotFromForm(event) {
  event.preventDefault();
  const form = els.lotForm.elements;
  const id = form.id.value || crypto.randomUUID();
  const payload = { id, lot_number: form.lotNumber.value.trim(), status: form.status.value, name: form.name.value.trim(), category: form.category.value.trim(), deadline: form.deadline.value || null, address: form.address.value.trim(), budget: num(form.budget.value), comment: form.comment.value.trim(), link: form.link.value.trim(), docs: form.docs.value.trim(), closed_at: form.closedAt.value || null };

  const result = await supabaseClient.from("lots").upsert(payload);
  if (result.error) return alert("Ошибка сохранения лота");
  await loadStateFromSupabase();
  els.lotDialog.close();
}

async function saveCalcFromForm(event) {
  event.preventDefault();
  const form = els.calcForm.elements;
  const id = form.id.value || crypto.randomUUID();
  const payload = { id, lot_id: form.lotId.value, purchase: num(form.purchase.value), delivery: num(form.delivery.value), work: num(form.work.value), extra: num(form.extra.value), sale: num(form.sale.value) };

  const duplicate = state.calculations.find((c) => c.lotId === payload.lot_id && c.id !== id);
  if (duplicate) return alert("Для этого лота уже есть Есеп.");

  const result = await supabaseClient.from("calculations").upsert(payload);
  if (result.error) return alert("Ошибка сохранения есепа");
  await loadStateFromSupabase();
  els.calcDialog.close();
}

async function deleteCurrentLot() {
  const id = els.lotForm.elements.id.value;
  if (!id || !confirm("Удалить лот и его расчет?")) return;
  await supabaseClient.from("calculations").delete().eq("lot_id", id);
  await supabaseClient.from("lots").delete().eq("id", id);
  await loadStateFromSupabase();
  els.lotDialog.close();
}

async function deleteCurrentCalc() {
  const id = els.calcForm.elements.id.value;
  if (!id || !confirm("Удалить расчет?")) return;
  await supabaseClient.from("calculations").delete().eq("id", id);
  await loadStateFromSupabase();
  els.calcDialog.close();
}

// --- СЛОЙ UI И РЕНДЕРА ---
function fillStatusOptions() {
  if (els.statusFilter) els.statusFilter.innerHTML = `<option value="">Все статусы</option>${statuses.map((s) => `<option>${s}</option>`).join("")}`;
  if (els.lotForm) els.lotForm.elements.status.innerHTML = statuses.map((s) => `<option>${s}</option>`).join("");
}

function render() {
  renderDashboard();
  renderLots();
  renderCalculations();
  refreshCalcLotOptions();
}

function renderDashboard() {
  if (els.totalLots) els.totalLots.textContent = state.lots.length;
  if (els.monthRevenue) els.monthRevenue.textContent = formatMoney(getMonthRevenue());
  const upcoming = state.lots.filter((l) => l.deadline && !inactiveStatuses.has(l.status)).filter((l) => new Date(l.deadline) >= startOfToday()).sort((a, b) => new Date(a.deadline) - new Date(b.deadline)).slice(0, 3);
  if (els.deadlineList) els.deadlineList.innerHTML = upcoming.length ? upcoming.map((l) => `<div class="list-row" style="margin-bottom:5px;"><strong>${escapeHtml(l.lotNumber)}</strong> - ${formatDate(l.deadline)}</div>`).join("") : `<div class="empty">Нет ближайших дедлайнов</div>`;
}

function renderLots() {
  if (!els.lotsList) return;
  const query = (els.lotSearch?.value || "").trim().toLowerCase();
  const status = els.statusFilter?.value || "";
  const rows = state.lots.filter((l) => (!status || l.status === status) && `${l.lotNumber} ${l.name}`.toLowerCase().includes(query));
  els.lotsList.innerHTML = rows.length ? rows.map((l) => lotRow(l)).join("") : `<div class="empty">Заявок нет</div>`;
  els.lotsList.querySelectorAll("[data-lot-id]").forEach((r) => r.addEventListener("click", () => openLotDialog(r.dataset.lotId)));
}

function renderCalculations() {
  if (!els.calcList) return;
  const query = (els.calcSearch?.value || "").trim().toLowerCase();
  const rows = state.calculations.filter((c) => { const lot = findLot(c.lotId); return lot && lot.lotNumber.toLowerCase().includes(query); });
  els.calcList.innerHTML = rows.length ? rows.map((c) => calcRow(c)).join("") : `<div class="empty">Расчетов нет</div>`;
  els.calcList.querySelectorAll("[data-calc-id]").forEach((r) => r.addEventListener("click", () => openCalcDialog(r.dataset.calcId)));
}

function lotRow(lot) {
  const calc = state.calculations.find((c) => c.lotId === lot.id);
  const totals = calc ? calculate(calc) : null;
  const profitText = totals ? `<span class="${totals.profit >= 0 ? "profit-positive" : "profit-negative"}">${formatPercent(totals.profitPercent)}</span>` : `<span>Есеп жоқ</span>`;
  return `<button class="list-row" data-lot-id="${lot.id}" type="button"><div class="list-row-main"><span class="lot-number">${escapeHtml(lot.lotNumber)}</span><span class="badge">${escapeHtml(lot.status)}</span></div><p class="row-title">${escapeHtml(lot.name || "Без названия")}</p><div class="row-meta"><span>${lot.deadline ? formatDate(lot.deadline) : "Срок не указан"}</span><span>${formatMoney(lot.budget)}</span>${profitText}</div></button>`;
}

function calcRow(calc) {
  const lot = findLot(calc.lotId);
  const totals = calculate(calc);
  return `<button class="list-row" data-calc-id="${calc.id}" type="button"><div class="list-row-main"><span class="lot-number">${escapeHtml(lot?.lotNumber || "Лот удален")}</span><span class="${totals.profit >= 0 ? "profit-positive" : "profit-negative"}">${formatPercent(totals.profitPercent)}</span></div><div class="row-meta"><span>Закуп: ${formatMoney(calc.purchase)}</span><span>ЦП: ${formatMoney(calc.sale)}</span><span>Пайда: ${formatMoney(totals.profit)}</span></div></button>`;
}

function openLotDialog(id = "") {
  const lot = id ? findLot(id) : null;
  els.lotForm.reset();
  els.lotForm.elements.id.value = lot?.id || "";
  els.lotForm.elements.lotNumber.value = lot?.lotNumber || "";
  els.lotForm.elements.status.value = lot?.status || "Проект";
  els.lotForm.elements.name.value = lot?.name || "";
  els.lotForm.elements.category.value = lot?.category || "";
  els.lotForm.elements.deadline.value = toDateTimeLocalInput(lot?.deadline);
  els.lotForm.elements.address.value = lot?.address || "";
  els.lotForm.elements.budget.value = lot?.budget || "";
  els.lotForm.elements.comment.value = lot?.comment || "";
  els.lotForm.elements.link.value = lot?.link || "";
  els.lotForm.elements.docs.value = lot?.docs || "";
  els.lotForm.elements.closedAt.value = lot?.closedAt || "";
  if (els.deleteLotButton) els.deleteLotButton.style.display = lot ? "block" : "none";
  els.lotDialog.showModal();
}

function openCalcDialog(id = "") {
  const calc = id ? state.calculations.find((c) => c.id === id) : null;
  refreshCalcLotOptions();
  els.calcForm.reset();
  els.calcForm.elements.id.value = calc?.id || "";
  els.calcForm.elements.lotId.value = calc?.lotId || state.lots[0]?.id || "";
  els.calcForm.elements.purchase.value = calc?.purchase || "";
  els.calcForm.elements.delivery.value = calc?.delivery || "";
  els.calcForm.elements.work.value = calc?.work || "";
  els.calcForm.elements.extra.value = calc?.extra || "";
  els.calcForm.elements.sale.value = calc?.sale || "";
  if (els.deleteCalcButton) els.deleteCalcButton.style.display = calc ? "block" : "none";
  updateCalcPreview();
  els.calcDialog.showModal();
}

function refreshCalcLotOptions() {
  if (!els.calcForm) return;
  const usedLotIds = new Set(state.calculations.map((c) => c.lotId));
  const currentCalcId = els.calcForm.elements.id.value;
  const currentCalc = state.calculations.find((c) => c.id === currentCalcId);
  els.calcForm.elements.lotId.innerHTML = state.lots.filter((l) => !usedLotIds.has(l.id) || l.id === currentCalc?.lotId).map((l) => `<option value="${l.id}">${escapeHtml(l.lotNumber)}</option>`).join("");
}

function updateCalcPreview() {
  if (!els.calcForm || !els.calcPreview) return;
  const form = els.calcForm.elements;
  const totals = calculate({ purchase: num(form.purchase.value), delivery: num(form.delivery.value), work: num(form.work.value), extra: num(form.extra.value), sale: num(form.sale.value) });
  els.calcPreview.innerHTML = `<div>Налог (10%): <b>${formatMoney(totals.tax)}</b></div><div>Пайда: <b>${formatMoney(totals.profit)}</b></div><div>Пайда %: <b>${formatPercent(totals.profitPercent)}</b></div>`;
}

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
function calculate(calc) {
  const sale = num(calc.sale);
  const tax = sale * 0.1;
  const profit = sale - num(calc.purchase) - tax - num(calc.delivery) - num(calc.work) - num(calc.extra);
  return { tax, profit, profitPercent: sale > 0 ? (profit / sale) * 100 : 0 };
}

function getMonthRevenue() {
  const now = new Date();
  return state.calculations.reduce((sum, c) => {
    const lot = findLot(c.lotId);
    if (!lot || !["Договор", "Закрыто"].includes(lot.status) || !lot.closedAt) return sum;
    const d = new Date(lot.closedAt);
    return (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) ? sum + num(c.sale) : sum;
  }, 0);
}

function switchView(id) {
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === id));
  document.querySelectorAll(".nav-button:not(#logoutButton)").forEach((b) => b.classList.toggle("active", b.dataset.view === id));
}

function downloadBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `zakup-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const imported = JSON.parse(String(reader.result));
      const dbLots = imported.lots.map(l => ({ id: l.id, lot_number: l.lotNumber, status: l.status, name: l.name, category: l.category, deadline: l.deadline || null, address: l.address, budget: num(l.budget), comment: l.comment, link: l.link, docs: l.docs, closed_at: l.closedAt || null }));
      const dbCalcs = imported.calculations.map(c => ({ id: c.id, lot_id: c.lotId, purchase: num(c.purchase), delivery: num(c.delivery), work: num(c.work), extra: num(c.extra), sale: num(c.sale) }));
      if (dbLots.length > 0) await supabaseClient.from("lots").upsert(dbLots);
      if (dbCalcs.length > 0) await supabaseClient.from("calculations").upsert(dbCalcs);
      await loadStateFromSupabase();
      alert("Импорт завершен!");
    } catch (e) { alert("Ошибка файла бэкапа"); }
  };
  reader.readAsText(file);
}

function findLot(id) { return state.lots.find((l) => l.id === id); }
function num(v) { return Number(String(v || "").replace(/\s/g, "")) || 0; }
function formatMoney(v) { return `${Math.round(num(v)).toLocaleString("ru-RU")} ₸`; }
function formatPercent(v) { return `${num(v).toFixed(1)}%`; }
function formatDate(v) { return v ? new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(v)) : ""; }
function toDateTimeLocalInput(v) { return v ? (v.includes("T") ? v.slice(0, 16) : `${v}T09:00`) : ""; }
function startOfToday() { const d = new Date(); d.setHours(0,0,0,0); return d; }
function escapeHtml(v) { return String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
