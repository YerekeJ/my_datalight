const SUPABASE_URL = "https://iybljtviwkuxjfpmfopb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5YmxqdHZpd2t1eGpmcG1mb3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMzEwNDQsImV4cCI6MjA5NzcwNzA0NH0.fgIfXxTf5GdUTNlac6VWN7mE6TtSUugK8OzFH-lZS4g";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
async function testSupabase() {
  const { data, error } = await supabaseClient
    .from("lots")
    .select("*")
    .limit(1);

  console.log("DATA:", data);
  console.log("ERROR:", error);
}

testSupabase();

async function loadStateFromSupabase() {
  const { data: lots, error: lotsError } = await supabaseClient
    .from("lots")
    .select("*");

  if (lotsError) {
    console.error("LOTS ERROR", lotsError);
    return;
  }

  const { data: calculations, error: calcError } = await supabaseClient
    .from("calculations")
    .select("*");

  if (calcError) {
    console.error("CALC ERROR", calcError);
    return;
  }

  state = {
    lots: lots || [],
    calculations: calculations || []
  };

  render();
}

const STORAGE_KEY = "zakup-pwa-state-v1";
const statuses = ["Проект", "Анализ", "Подали", "Выиграли", "Проиграли", "Договор", "Отказ", "Закрыто"];
const inactiveStatuses = new Set(["Закрыто", "Проиграли", "Отказ"]);

const seedState = {
  lots: [
    {
      id: crypto.randomUUID(),
      lotNumber: "12622761-1",
      status: "Анализ",
      name: "Поставка хозяйственных товаров",
      category: "Товары",
      deadline: "2026-06-25T16:00",
      address: "Кызылорда",
      budget: 399999,
      comment: "Проверить доставку",
      link: "",
      docs: "",
      closedAt: ""
    },
    {
      id: crypto.randomUUID(),
      lotNumber: "12625402-1",
      status: "Договор",
      name: "Канцелярские товары",
      category: "Товары",
      deadline: "2026-06-28T12:00",
      address: "Астана",
      budget: 99000,
      comment: "",
      link: "",
      docs: "",
      closedAt: "2026-06-18"
    },
    {
      id: crypto.randomUUID(),
      lotNumber: "12630864-1",
      status: "Подали",
      name: "Расходные материалы",
      category: "Товары",
      deadline: "2026-07-03T10:30",
      address: "Алматы",
      budget: 650000,
      comment: "Ждем итог",
      link: "",
      docs: "",
      closedAt: ""
    }
  ],
  calculations: []
};

seedState.calculations = [
  {
    id: crypto.randomUUID(),
    lotId: seedState.lots[0].id,
    purchase: 310000,
    delivery: 10000,
    work: 0,
    extra: 0,
    sale: 399999
  },
  {
    id: crypto.randomUUID(),
    lotId: seedState.lots[1].id,
    purchase: 75000,
    delivery: 2000,
    work: 0,
    extra: 0,
    sale: 99000
  }
];

let state = {
  lots: [],
  calculations: []
};

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
  importInput: document.querySelector("#importInput")
};

init();

async function init() {
  fillStatusOptions();
  bindEvents();

  await loadStateFromSupabase();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

function bindEvents() {
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  document.querySelectorAll("[data-open-lot]").forEach((button) => {
    button.addEventListener("click", () => openLotDialog());
  });

  document.querySelectorAll("[data-open-calc]").forEach((button) => {
    button.addEventListener("click", () => openCalcDialog());
  });

  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelector(`#${button.dataset.closeDialog}`)?.close();
    });
  });

  els.lotSearch.addEventListener("input", renderLots);
  els.calcSearch.addEventListener("input", renderCalculations);
  els.statusFilter.addEventListener("change", renderLots);

  els.lotForm.addEventListener("submit", saveLotFromForm);
  els.calcForm.addEventListener("submit", saveCalcFromForm);
  els.deleteLotButton.addEventListener("click", deleteCurrentLot);
  els.deleteCalcButton.addEventListener("click", deleteCurrentCalc);
  els.calcForm.addEventListener("input", updateCalcPreview);
  els.backupButton.addEventListener("click", downloadBackup);
  els.importButton.addEventListener("click", () => els.importInput.click());
  els.importInput.addEventListener("change", importBackup);
}

function fillStatusOptions() {
  els.statusFilter.innerHTML = `<option value="">Все статусы</option>${statuses.map((status) => `<option>${status}</option>`).join("")}`;
  els.lotForm.elements.status.innerHTML = statuses.map((status) => `<option>${status}</option>`).join("");
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.lots && saved?.calculations) return saved;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seedState));
  return structuredClone(seedState);
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render() {
  renderDashboard();
  renderLots();
  renderCalculations();
  refreshCalcLotOptions();
}

function renderDashboard() {
  els.totalLots.textContent = state.lots.length;
  els.monthRevenue.textContent = formatMoney(getMonthRevenue());

  const upcoming = state.lots
    .filter((lot) => lot.deadline && !inactiveStatuses.has(lot.status))
    .filter((lot) => new Date(lot.deadline) >= startOfToday())
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 3);

  els.deadlineList.innerHTML = upcoming.length
    ? upcoming.map((lot) => `<div class="deadline-item"><strong>${escapeHtml(lot.lotNumber)}</strong><span>${formatDate(lot.deadline)}</span></div>`).join("")
    : `<div class="empty">Нет ближайших сроков</div>`;
}

function renderLots() {
  const query = els.lotSearch.value.trim().toLowerCase();
  const status = els.statusFilter.value;
  const rows = state.lots.filter((lot) => {
    const matchesStatus = !status || lot.status === status;
    const haystack = `${lot.lotNumber} ${lot.name} ${lot.category} ${lot.address}`.toLowerCase();
    return matchesStatus && haystack.includes(query);
  });

  els.lotsList.innerHTML = rows.length
    ? rows.map((lot) => lotRow(lot)).join("")
    : `<div class="empty">Заявок пока нет</div>`;

  els.lotsList.querySelectorAll("[data-lot-id]").forEach((row) => {
    row.addEventListener("click", () => openLotDialog(row.dataset.lotId));
  });
}

function renderCalculations() {
  const query = els.calcSearch.value.trim().toLowerCase();
  const rows = state.calculations.filter((calc) => {
    const lot = findLot(calc.lotId);
    return lot && lot.lotNumber.toLowerCase().includes(query);
  });

  els.calcList.innerHTML = rows.length
    ? rows.map((calc) => calcRow(calc)).join("")
    : `<div class="empty">Расчетов пока нет</div>`;

  els.calcList.querySelectorAll("[data-calc-id]").forEach((row) => {
    row.addEventListener("click", () => openCalcDialog(row.dataset.calcId));
  });
}

function lotRow(lot) {
  const calc = state.calculations.find((item) => item.lotId === lot.id);
  const totals = calc ? calculate(calc) : null;
  const profitClass = totals?.profit >= 0 ? "profit-positive" : "profit-negative";
  const profitText = totals ? `<span class="${profitClass}">${formatPercent(totals.profitPercent)}</span>` : `<span>Есеп жоқ</span>`;
  const title = lot.name || "Без наименования";

  return `
    <button class="list-row" data-lot-id="${lot.id}" type="button">
      <div class="list-row-main">
        <span class="lot-number">${escapeHtml(lot.lotNumber)}</span>
        <span class="badge">${escapeHtml(lot.status)}</span>
      </div>
      <p class="row-title">${escapeHtml(title)}</p>
      <div class="row-meta">
        <span>${lot.deadline ? formatDate(lot.deadline) : "Срок не указан"}</span>
        <span>${formatMoney(Number(lot.budget) || 0)}</span>
        ${profitText}
      </div>
    </button>
  `;
}

function calcRow(calc) {
  const lot = findLot(calc.lotId);
  const totals = calculate(calc);
  const profitClass = totals.profit >= 0 ? "profit-positive" : "profit-negative";

  return `
    <button class="list-row" data-calc-id="${calc.id}" type="button">
      <div class="list-row-main">
        <span class="lot-number">${escapeHtml(lot?.lotNumber || "Лот удален")}</span>
        <span class="${profitClass}">${formatPercent(totals.profitPercent)}</span>
      </div>
      <div class="row-meta">
        <span>Закуп: ${formatMoney(num(calc.purchase))}</span>
        <span>ЦП: ${formatMoney(num(calc.sale))}</span>
        <span>Пайда: ${formatMoney(totals.profit)}</span>
      </div>
    </button>
  `;
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
  els.deleteLotButton.hidden = !lot;
  els.lotDialog.showModal();
}

function openCalcDialog(id = "") {
  const calc = id ? state.calculations.find((item) => item.id === id) : null;
  refreshCalcLotOptions();
  els.calcForm.reset();
  els.calcForm.elements.id.value = calc?.id || "";
  els.calcForm.elements.lotId.value = calc?.lotId || state.lots[0]?.id || "";
  els.calcForm.elements.purchase.value = calc?.purchase || "";
  els.calcForm.elements.delivery.value = calc?.delivery || "";
  els.calcForm.elements.work.value = calc?.work || "";
  els.calcForm.elements.extra.value = calc?.extra || "";
  els.calcForm.elements.sale.value = calc?.sale || "";
  els.deleteCalcButton.hidden = !calc;
  updateCalcPreview();
  els.calcDialog.showModal();
}

function saveLotFromForm(event) {
  event.preventDefault();
  const form = els.lotForm.elements;
  const id = form.id.value || crypto.randomUUID();
  const payload = {
    id,
    lotNumber: form.lotNumber.value.trim(),
    status: form.status.value,
    name: form.name.value.trim(),
    category: form.category.value.trim(),
    deadline: form.deadline.value,
    address: form.address.value.trim(),
    budget: num(form.budget.value),
    comment: form.comment.value.trim(),
    link: form.link.value.trim(),
    docs: form.docs.value.trim(),
    closedAt: form.closedAt.value
  };

  const index = state.lots.findIndex((lot) => lot.id === id);
  if (index >= 0) state.lots[index] = payload;
  else state.lots.push(payload);

  persist();
  els.lotDialog.close();
  render();
}

function saveCalcFromForm(event) {
  event.preventDefault();
  const form = els.calcForm.elements;
  const id = form.id.value || crypto.randomUUID();
  const payload = {
    id,
    lotId: form.lotId.value,
    purchase: num(form.purchase.value),
    delivery: num(form.delivery.value),
    work: num(form.work.value),
    extra: num(form.extra.value),
    sale: num(form.sale.value)
  };

  const duplicate = state.calculations.find((calc) => calc.lotId === payload.lotId && calc.id !== id);
  if (duplicate) {
    alert("Для этого лота уже есть Есеп.");
    return;
  }

  const index = state.calculations.findIndex((calc) => calc.id === id);
  if (index >= 0) state.calculations[index] = payload;
  else state.calculations.push(payload);

  persist();
  els.calcDialog.close();
  render();
}

function deleteCurrentLot() {
  const id = els.lotForm.elements.id.value;
  if (!id || !confirm("Удалить заявку и связанный есеп?")) return;
  state.lots = state.lots.filter((lot) => lot.id !== id);
  state.calculations = state.calculations.filter((calc) => calc.lotId !== id);
  persist();
  els.lotDialog.close();
  render();
}

function deleteCurrentCalc() {
  const id = els.calcForm.elements.id.value;
  if (!id || !confirm("Удалить расчет?")) return;
  state.calculations = state.calculations.filter((calc) => calc.id !== id);
  persist();
  els.calcDialog.close();
  render();
}

function refreshCalcLotOptions() {
  const usedLotIds = new Set(state.calculations.map((calc) => calc.lotId));
  const currentCalcId = els.calcForm?.elements.id?.value;
  const currentCalc = state.calculations.find((calc) => calc.id === currentCalcId);

  els.calcForm.elements.lotId.innerHTML = state.lots
    .filter((lot) => !usedLotIds.has(lot.id) || lot.id === currentCalc?.lotId)
    .map((lot) => `<option value="${lot.id}">${escapeHtml(lot.lotNumber)}</option>`)
    .join("");
}

function updateCalcPreview() {
  const form = els.calcForm.elements;
  const totals = calculate({
    purchase: num(form.purchase.value),
    delivery: num(form.delivery.value),
    work: num(form.work.value),
    extra: num(form.extra.value),
    sale: num(form.sale.value)
  });

  els.calcPreview.innerHTML = `
    <div><span>Налог</span><strong>${formatMoney(totals.tax)}</strong></div>
    <div><span>Пайда</span><strong>${formatMoney(totals.profit)}</strong></div>
    <div><span>Пайда %</span><strong>${formatPercent(totals.profitPercent)}</strong></div>
  `;
}

function calculate(calc) {
  const sale = num(calc.sale);
  const tax = sale * 0.1;
  const profit = sale - num(calc.purchase) - tax - num(calc.delivery) - num(calc.work) - num(calc.extra);
  const profitPercent = sale > 0 ? (profit / sale) * 100 : 0;
  return { tax, profit, profitPercent };
}

function getMonthRevenue() {
  const now = new Date();
  return state.calculations.reduce((sum, calc) => {
    const lot = findLot(calc.lotId);
    if (!lot || !["Договор", "Закрыто"].includes(lot.status) || !lot.closedAt) return sum;
    const date = new Date(lot.closedAt);
    const sameMonth = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    return sameMonth ? sum + num(calc.sale) : sum;
  }, 0);
}

function switchView(id) {
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === id));
  document.querySelectorAll(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.view === id));
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

function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(String(reader.result));
      if (!Array.isArray(imported.lots) || !Array.isArray(imported.calculations)) throw new Error("bad shape");
      state = imported;
      persist();
      render();
      alert("Импорт готов.");
    } catch {
      alert("Не получилось импортировать файл.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function findLot(id) {
  return state.lots.find((lot) => lot.id === id);
}

function num(value) {
  return Number(value) || 0;
}

function formatMoney(value) {
  return `${Math.round(num(value)).toLocaleString("ru-RU")} ₸`;
}

function formatPercent(value) {
  return `${num(value).toFixed(1)}%`;
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function toDateTimeLocalInput(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T09:00`;
  return value.slice(0, 16);
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
