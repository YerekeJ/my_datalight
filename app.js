const SUPABASE_URL = "https://iybljtviwkuxjfpmfopb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5YmxqdHZpd2t1eGpmcG1mb3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMzEwNDQsImV4cCI6MjA5NzcwNzA0NH0.fgIfXxTf5GdUTNlac6VWN7mE6TtSUugK8OzFH-lZS4g";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const statuses = ["Проект", "Анализ", "Подали", "Выиграли", "Проиграли", "Договор", "Отказ", "Закрыто"];
const inactiveStatuses = new Set(["Закрыто", "Проиграли", "Отказ"]);

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
  importInput: document.querySelector("#importInput"),
  
  // Элементы авторизации
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

// --- АВТОРИЗАЦИЯ ---

function setupAuth() {
  els.loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = event.target.email.value;
    const password = event.target.password.value;
    
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      alert("Ошибка входа: проверьте логин или пароль");
    }
  });

  els.logoutButton?.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
  });

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) {
      els.loginDialog?.close();
      if (els.logoutButton) els.logoutButton.hidden = false;
      loadStateFromSupabase(); 
    } else {
      els.loginDialog?.showModal();
      if (els.logoutButton) els.logoutButton.hidden = true;
      state = { lots: [], calculations: [] }; 
      render();
    }
  });
}

// --- СЛОЙ ДАННЫХ И SUPABASE ---

function bindEvents() {
  document.querySelectorAll(".nav-button:not(#logoutButton)").forEach((button) => {
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
  return {
    id: dbLot.id,
    lotNumber: dbLot.lot_number,
    status: dbLot.status,
    name: dbLot.name,
    category: dbLot.category,
    deadline: dbLot.deadline,
    address: dbLot.address,
    budget: dbLot.budget,
    comment: dbLot.comment,
    link: dbLot.link,
    docs: dbLot.docs,
    closedAt: dbLot.closed_at
  };
}

function mapCalcToClient(dbCalc) {
  return {
    id: dbCalc.id,
    lotId: dbCalc.lot_id,
    purchase: dbCalc.purchase,
    delivery: dbCalc.delivery,
    work: dbCalc.work,
    extra: dbCalc.extra,
    sale: dbCalc.sale
  };
}

async function loadStateFromSupabase() {
  const { data: lots, error: lotsError } = await supabaseClient
    .from("lots")
    .select("*");

  if (lotsError) {
    console.error("LOTS ERROR", lotsError);
    alert("Ошибка загрузки лотов");
    return;
  }

  const { data: calculations, error: calcError } = await supabaseClient
    .from("calculations")
    .select("*");

  if (calcError) {
    console.error("CALC ERROR", calcError);
    alert("Ошибка загрузки расчетов");
    return;
  }

  state = {
    lots: (lots || []).map(mapLotToClient),
    calculations: (calculations || []).map(mapCalcToClient)
  };

  render();
}

async function saveLotFromForm(event) {
  event.preventDefault();
  const form = els.lotForm.elements;
  const id = form.id.value || crypto.randomUUID();

  const payload = {
    id,
    lot_number: form.lotNumber.value.trim(),
    status: form.status.value,
    name: form.name.value.trim(),
    category: form.category.value.trim(),
    deadline: form.deadline.value || null,
    address: form.address.value.trim(),
    budget: num(form.budget.value),
    comment: form.comment.value.trim(),
    link: form.link.value.trim(),
    docs: form.docs.value.trim(),
    closed_at: form.closedAt.value || null
  };

  const result = await supabaseClient.from("lots").upsert(payload);

  if (result.error) {
    console.error(result.error);
    alert("Ошибка сохранения лота");
    return;
  }

  await loadStateFromSupabase();
  els.lotDialog.close();
}

async function saveCalcFromForm(event) {
  event.preventDefault();
  const form = els.calcForm.elements;
  const id = form.id.value || crypto.randomUUID();
  
  const payload = {
    id,
    lot_id: form.lotId.value,
    purchase: num(form.purchase.value),
    delivery: num(form.delivery.value),
    work: num(form.work.value),
    extra: num(form.extra.value),
    sale: num(form.sale.value)
  };

  const duplicate = state.calculations.find((calc) => calc.lotId === payload.lot_id && calc.id !== id);
  if (duplicate) {
    alert("Для этого лота уже есть Есеп.");
    return;
  }

  const result = await supabaseClient.from("calculations").upsert(payload);

  if (result.error) {
    console.error(result.error);
    alert("Ошибка сохранения расчета");
    return;
  }

  await loadStateFromSupabase();
  els.calcDialog.close();
}

async function deleteCurrentLot() {
  const id = els.lotForm.elements.id.value;
  if (!id || !confirm("Удалить заявку и связанный есеп?")) return;

  await supabaseClient.from("calculations").delete().eq("lot_id", id);
  const result = await supabaseClient.from("lots").delete().eq("id", id);

  if (result.error) {
    alert("Ошибка удаления лота");
    return;
  }

  await loadStateFromSupabase();
  els.lotDialog.close();
}

async function deleteCurrentCalc() {
  const id = els.calcForm.elements.id.value;
  if (!id || !confirm("Удалить расчет?")) return;

  const result = await supabaseClient.from("calculations").delete().eq("id", id);

  if (result.error) {
    alert("Ошибка удаления расчета");
    return;
  }

  await loadStateFromSupabase();
  els.calcDialog.close();
}

async function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  
  reader.onload = async () => {
    try {
      const imported = JSON.parse(String(reader.result));
      if (!Array.isArray(imported.lots) || !Array.isArray(imported.calculations)) throw new Error("bad shape");

      const dbLots = imported.lots.map(lot => ({
        id: lot.id,
        lot_number: lot.lotNumber,
        status: lot.status,
        name: lot.name,
        category: lot.category,
        deadline: lot.deadline || null,
        address: lot.address,
        budget: num(lot.budget),
        comment: lot.comment,
        link: lot.link,
        docs: lot.docs,
        closed_at: lot.closedAt || null
      }));

      const dbCalcs = imported.calculations.map(calc => ({
        id: calc.id,
        lot_id: calc.lotId,
        purchase: num(calc.purchase),
        delivery: num(calc.delivery),
        work: num(calc.work),
        extra: num(calc.extra),
        sale: num(calc.sale)
      }));

      if (dbLots.length > 0) await supabaseClient.from("lots").upsert(dbLots);
      if (dbCalcs.length > 0) await supabaseClient.from("calculations").upsert(dbCalcs);

      await loadStateFromSupabase();
      alert("Импорт в базу данных успешно завершен.");
    } catch (error) {
      console.error(error);
      alert("Не получилось импортировать файл.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

// --- СЛОЙ РЕНДЕРА И UI ---

function fillStatusOptions() {
  if (els.statusFilter) els.statusFilter.innerHTML = `<option value="">Все статусы</option>${statuses.map((status) => `<option>${status}</option>`).join("")}`;
  if (els.lotForm) els.lotForm.elements.status.innerHTML = statuses.map((status) => `<option>${status}</option>`).join("");
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

  const upcoming = state.lots
    .filter((lot) => lot.deadline && !inactiveStatuses.has(lot.status))
    .filter((lot) => new Date(lot.deadline) >= startOfToday())
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 3);

  if (els.deadlineList) els.deadlineList.innerHTML = upcoming.length
    ? upcoming.map((lot) => `<div class="deadline-item"><strong>${escapeHtml(lot.lotNumber)}</strong><span>${formatDate(lot.deadline)}</span></div>`).join("")
    : `<div class="empty">Нет ближайших сроков</div>`;
}

function renderLots() {
  if (!els.lotsList) return;
  const query = (els.lotSearch?.value || "").trim().toLowerCase();
  const status = els.statusFilter?.value || "";
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
  if (!els.calcList) return;
  const query = (els.calcSearch?.value || "").trim().toLowerCase();
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
  if (els.deleteLotButton) els.deleteLotButton.hidden = !lot;
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
  if (els.deleteCalcButton) els.deleteCalcButton.hidden = !calc;
  updateCalcPreview();
  els.calcDialog.showModal();
}

function refreshCalcLotOptions() {
  if (!els.calcForm) return;
  const usedLotIds = new Set(state.calculations.map((calc) => calc.lotId));
  const currentCalcId = els.calcForm?.elements.id?.value;
  const currentCalc = state.calculations.find((calc) => calc.id === currentCalcId);

  els.calcForm.elements.lotId.innerHTML = state.lots
    .filter((lot) => !usedLotIds.has(lot.id) || lot.id === currentCalc?.lotId)
    .map((lot) => `<option value="${lot.id}">${escapeHtml(lot.lotNumber)}</option>`)
    .join("");
}

function updateCalcPreview() {
  if (!els.calcForm || !els.calcPreview) return;
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

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

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
  document.querySelectorAll(".nav-button:not(#logoutButton)").forEach((button) => button.classList.toggle("active", button.dataset.view === id));
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

function findLot(id) {
  return state.lots.find((lot) => lot.id === id);
}

function num(value) {
  if (typeof value === "string") {
    value = value.replace(/\s/g, "");
  }
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