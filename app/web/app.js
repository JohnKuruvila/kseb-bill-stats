/**
 * KSEB Energy Intelligence — Clean Modern Controller
 */

// Toast & Progress Bar
const toastContainer = document.getElementById("toastContainer");
const toastPill = document.getElementById("toastPill");
const toastIcon = document.getElementById("toastIcon");
const toastTitle = document.getElementById("toastTitle");
const toastMessage = document.getElementById("toastMessage");
const toastCloseBtn = document.getElementById("toastCloseBtn");
const topProgressBar = document.getElementById("topProgressBar");

const flashEl = document.getElementById("flash");
const loadingStateEl = document.getElementById("loadingState");
const loadingTitleEl = document.getElementById("loadingTitle");
const loadingDetailEl = document.getElementById("loadingDetail");
const chartStatusBannerEl = document.getElementById("chartStatusBanner");

// Main Layout
const landingEl = document.getElementById("landing");
const authCard = document.getElementById("authCard");
const appPanel = document.getElementById("appPanel");
const seoLoginSection = document.getElementById("seo-login-section");

// Form & Auth
const loginForm = document.getElementById("loginForm");
const consumerNumberInput = document.getElementById("consumerNumber");
const mobileNumberInput = document.getElementById("mobileNumber");
const loginSubmitButton = loginForm?.querySelector('button[type="submit"]') || null;
const savedAccountsEl = document.getElementById("savedAccounts");
const savedAccountsListEl = document.getElementById("savedAccountsList");
const identityConsumerBadge = document.getElementById("identityConsumerBadge");
const pageSectionTitle = document.getElementById("pageSectionTitle");

// Navigation & Actions
const syncButton = document.getElementById("syncButton");
const uploadModalTrigger = document.getElementById("uploadModalTrigger");
const settingsModalTrigger = document.getElementById("settingsModalTrigger");
const notificationsToggleBtn = document.getElementById("notificationsToggleBtn");
const notifBadgeDot = document.getElementById("notifBadgeDot");

// Modals
const uploadSheetModal = document.getElementById("uploadSheetModal");
const closeUploadSheetBtn = document.getElementById("closeUploadSheetBtn");
const cancelUploadBtn = document.getElementById("cancelUploadBtn");
const uploadForm = document.getElementById("uploadForm");
const uploadInput = document.getElementById("uploadInput");
const dropZone = document.getElementById("dropZone");
const selectedFilesList = document.getElementById("selectedFilesList");
const uploadSubmitButton = uploadForm?.querySelector('button[type="submit"]') || null;

const notificationsSheetModal = document.getElementById("notificationsSheetModal");
const closeNotificationsButton = document.getElementById("closeNotificationsButton");
const notificationList = document.getElementById("notificationList");

const settingsModal = document.getElementById("settingsModal");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const settingsConsumerNumber = document.getElementById("settingsConsumerNumber");
const settingsMobileNumber = document.getElementById("settingsMobileNumber");
const pushButton = document.getElementById("pushButton");
const exportButton = document.getElementById("exportButton");
const topNavLogoutButton = document.getElementById("topNavLogoutButton");
const settingsLogoutButton = document.getElementById("settingsLogoutButton");
const logoutButton = document.getElementById("logoutButton");
const deleteButton = document.getElementById("deleteButton");

// Date Filters
const customRangeToggle = document.getElementById("customRangeToggle");
const customRangeRow = document.getElementById("customRangeRow");
const rangeFromInput = document.getElementById("rangeFrom");
const rangeToInput = document.getElementById("rangeTo");
const applyCustomRangeButton = document.getElementById("applyCustomRange");
const cancelCustomRangeButton = document.getElementById("cancelCustomRange");
const rangeSummaryEl = document.getElementById("rangeSummary");

// Ledger
const ledgerCardsEl = document.getElementById("ledgerCards");
const ledgerBodyEl = document.getElementById("ledgerBody");
const ledgerSearchInput = document.getElementById("ledgerSearchInput");
const ledgerBadge = document.getElementById("ledgerBadge");

// Storage Keys & State
const CREDENTIALS_STORAGE_KEYS = {
  consumerNumber: "ksebBillStats.consumerNumber",
  mobileNumber: "ksebBillStats.mobileNumber",
  accounts: "ksebBillStats.accounts",
};
const DATE_RANGE_STORAGE_KEY = "ksebBillStats.dateRange";
const MAX_SAVED_ACCOUNTS = 10;

const CHART_ELEMENT_IDS = ["trendChart", "importVsSolarChart", "flowChart", "performanceChart"];
const chartInstances = new Map();

let activeTabId = "overview";
let currentBills = [];
let filteredBills = [];
let dateRangeState = loadDateRangeState();
let activeLoadingControl = null;
let activeLoadingLabel = "";
let toastTimer = null;
let ledgerSearchQuery = "";

// ==========================================================================
// 1. Toast Notification System
// ==========================================================================

function showToast(title, message, tone = "info", duration = 4000) {
  if (!toastPill || !toastTitle || !toastMessage) return;

  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }

  toastTitle.textContent = title || (tone === "error" ? "Error" : tone === "success" ? "Success" : "Notice");
  toastMessage.textContent = typeof message === "string" ? message : JSON.stringify(message);

  toastPill.className = `toast-card is-${tone}`;
  toastPill.hidden = false;

  if (toastIcon) {
    toastIcon.textContent = tone === "error" ? "✕" : tone === "success" ? "✓" : "ℹ";
  }

  if (duration > 0) {
    toastTimer = setTimeout(() => {
      toastPill.hidden = true;
    }, duration);
  }
}

toastCloseBtn?.addEventListener("click", () => {
  if (toastPill) toastPill.hidden = true;
});

function setFlash(message, tone = "success") {
  if (!message) {
    if (toastPill) toastPill.hidden = true;
    return;
  }
  const title = tone === "error" ? "Action Failed" : tone === "success" ? "Success" : "Notice";
  showToast(title, message, tone, tone === "error" ? 6000 : 4000);
}

function setStatus(message, tone = "info") {
  if (!chartStatusBannerEl) return;
  chartStatusBannerEl.hidden = !message;
  chartStatusBannerEl.textContent = message || "";
  chartStatusBannerEl.className = "alert-banner";
  if (message && tone !== "info") {
    chartStatusBannerEl.classList.add(`is-${tone}`);
  }
}

// ==========================================================================
// 2. Loading State & Async Tasks
// ==========================================================================

function setLoadingState(active, { control = null, busyLabel = "" } = {}) {
  if (topProgressBar) {
    topProgressBar.hidden = !active;
  }

  if (!active) {
    if (activeLoadingControl) {
      activeLoadingControl.disabled = false;
      if (activeLoadingLabel) {
        activeLoadingControl.textContent = activeLoadingLabel;
      }
    }
    activeLoadingControl = null;
    activeLoadingLabel = "";
    return;
  }

  if (activeLoadingControl && activeLoadingControl !== control) {
    activeLoadingControl.disabled = false;
    if (activeLoadingLabel) {
      activeLoadingControl.textContent = activeLoadingLabel;
    }
  }

  activeLoadingControl = control;
  activeLoadingLabel = control?.textContent || "";
  if (control) {
    control.disabled = true;
    if (busyLabel) {
      control.textContent = busyLabel;
    }
  }
}

async function runWithLoading(config, task) {
  setLoadingState(true, config);
  try {
    return await task();
  } finally {
    setLoadingState(false);
  }
}

// ==========================================================================
// 3. Authentication & View Switching
// ==========================================================================

function setAuthedView(isAuthed) {
  document.body.classList.toggle("is-authed", isAuthed);
  if (landingEl) landingEl.hidden = isAuthed;
  if (authCard) authCard.hidden = isAuthed;
  if (appPanel) appPanel.hidden = !isAuthed;
  if (seoLoginSection) seoLoginSection.hidden = isAuthed;
  const demoBanner = document.getElementById("demoModeBanner");
  if (demoBanner) {
    demoBanner.hidden = !isDemoMode;
  }
}

function normalizeDigitsForStorage(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function maskAccountDigits(value, visible = 4) {
  const digits = normalizeDigitsForStorage(value);
  if (!digits) return "";
  if (digits.length <= visible) return digits;
  return `${"•".repeat(Math.min(digits.length - visible, 4))}${digits.slice(-visible)}`;
}

function readSavedAccounts() {
  try {
    const raw = window.localStorage.getItem(CREDENTIALS_STORAGE_KEYS.accounts);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((entry) => ({
            consumerNumber: normalizeDigitsForStorage(entry?.consumerNumber),
            mobileNumber: normalizeDigitsForStorage(entry?.mobileNumber),
            lastUsedAt: Number(entry?.lastUsedAt) || 0,
          }))
          .filter((entry) => entry.consumerNumber && entry.mobileNumber)
          .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
          .slice(0, MAX_SAVED_ACCOUNTS);
      }
    }

    const legacyConsumer = normalizeDigitsForStorage(
      window.localStorage.getItem(CREDENTIALS_STORAGE_KEYS.consumerNumber),
    );
    const legacyMobile = normalizeDigitsForStorage(
      window.localStorage.getItem(CREDENTIALS_STORAGE_KEYS.mobileNumber),
    );
    if (legacyConsumer && legacyMobile) {
      const migrated = [{ consumerNumber: legacyConsumer, mobileNumber: legacyMobile, lastUsedAt: Date.now() }];
      writeSavedAccounts(migrated);
      return migrated;
    }
  } catch {
    // Storage blocked or unavailable
  }
  return [];
}

function writeSavedAccounts(accounts) {
  try {
    window.localStorage.setItem(CREDENTIALS_STORAGE_KEYS.accounts, JSON.stringify(accounts));
    const latest = accounts[0];
    if (latest) {
      window.localStorage.setItem(CREDENTIALS_STORAGE_KEYS.consumerNumber, latest.consumerNumber);
      window.localStorage.setItem(CREDENTIALS_STORAGE_KEYS.mobileNumber, latest.mobileNumber);
    } else {
      window.localStorage.removeItem(CREDENTIALS_STORAGE_KEYS.consumerNumber);
      window.localStorage.removeItem(CREDENTIALS_STORAGE_KEYS.mobileNumber);
    }
  } catch {
    // Ignore storage failures
  }
}

function fillCredentialsForm(consumerNumber, mobileNumber) {
  if (!consumerNumberInput || !mobileNumberInput) return;
  consumerNumberInput.value = normalizeDigitsForStorage(consumerNumber);
  mobileNumberInput.value = normalizeDigitsForStorage(mobileNumber);
}

function loadSavedCredentialsIntoForm() {
  if (!consumerNumberInput || !mobileNumberInput) return;
  const accounts = readSavedAccounts();
  const latest = accounts[0];
  if (!latest) return;
  if (!consumerNumberInput.value) consumerNumberInput.value = latest.consumerNumber;
  if (!mobileNumberInput.value) mobileNumberInput.value = latest.mobileNumber;
}

function persistCredentialsFromForm() {
  if (!consumerNumberInput || !mobileNumberInput) return;
  const consumer = normalizeDigitsForStorage(consumerNumberInput.value);
  const mobile = normalizeDigitsForStorage(mobileNumberInput.value);
  if (!consumer || !mobile) return;

  const accounts = readSavedAccounts().filter(
    (entry) => !(entry.consumerNumber === consumer && entry.mobileNumber === mobile),
  );
  accounts.unshift({
    consumerNumber: consumer,
    mobileNumber: mobile,
    lastUsedAt: Date.now(),
  });
  writeSavedAccounts(accounts.slice(0, MAX_SAVED_ACCOUNTS));
  renderSavedAccounts();
}

function removeSavedAccount(consumerNumber, mobileNumber) {
  const consumer = normalizeDigitsForStorage(consumerNumber);
  const mobile = normalizeDigitsForStorage(mobileNumber);
  const accounts = readSavedAccounts().filter(
    (entry) => !(entry.consumerNumber === consumer && entry.mobileNumber === mobile),
  );
  writeSavedAccounts(accounts);
  if (
    normalizeDigitsForStorage(consumerNumberInput?.value) === consumer &&
    normalizeDigitsForStorage(mobileNumberInput?.value) === mobile
  ) {
    const next = accounts[0];
    if (next) {
      fillCredentialsForm(next.consumerNumber, next.mobileNumber);
    } else if (consumerNumberInput && mobileNumberInput) {
      consumerNumberInput.value = "";
      mobileNumberInput.value = "";
    }
  }
  renderSavedAccounts();
}

function renderSavedAccounts() {
  if (!savedAccountsEl || !savedAccountsListEl) return;
  const accounts = readSavedAccounts();
  if (!accounts.length) {
    savedAccountsEl.hidden = true;
    savedAccountsListEl.replaceChildren();
    return;
  }

  savedAccountsEl.hidden = false;
  savedAccountsListEl.replaceChildren();
  for (const account of accounts) {
    const row = document.createElement("div");
    row.className = "saved-account-item";

    const useButton = document.createElement("button");
    useButton.type = "button";
    useButton.className = "saved-account-btn";
    useButton.innerHTML = `
      <span>⚡ Consumer <strong>${maskAccountDigits(account.consumerNumber)}</strong></span>
      <span style="color: var(--text-muted); font-size: 11px;">${maskAccountDigits(account.mobileNumber)}</span>
    `;
    useButton.title = "Select this account";
    useButton.addEventListener("click", () => {
      fillCredentialsForm(account.consumerNumber, account.mobileNumber);
      consumerNumberInput?.focus();
    });

    const forgetButton = document.createElement("button");
    forgetButton.type = "button";
    forgetButton.className = "saved-account-del";
    forgetButton.textContent = "✕";
    forgetButton.title = "Forget account";
    forgetButton.addEventListener("click", () => {
      removeSavedAccount(account.consumerNumber, account.mobileNumber);
    });

    row.append(useButton, forgetButton);
    savedAccountsListEl.append(row);
  }
}

// ==========================================================================
// 4. Date Range & Filtering Logic
// ==========================================================================

function loadDateRangeState() {
  try {
    const raw = window.localStorage.getItem(DATE_RANGE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return {
          preset: ["3m", "6m", "1y", "all", "custom"].includes(parsed.preset) ? parsed.preset : "3m",
          from: typeof parsed.from === "string" ? parsed.from : "",
          to: typeof parsed.to === "string" ? parsed.to : "",
        };
      }
    }
  } catch {
    // Ignore storage failures
  }
  return { preset: "3m", from: "", to: "" };
}

function persistDateRangeState() {
  try {
    window.localStorage.setItem(DATE_RANGE_STORAGE_KEY, JSON.stringify(dateRangeState));
  } catch {
    // Ignore storage failures
  }
}

function parseInputDate(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : startOfDay(date);
}

function parseBillDate(bill) {
  return parseInputDate(bill?.bill_date || bill?.label || "");
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addMonths(date, months) {
  const next = new Date(date.getTime());
  next.setMonth(next.getMonth() + months);
  return next;
}

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateRangeBounds(state = dateRangeState) {
  const today = startOfDay(new Date());
  if (state.preset === "all") {
    return { from: null, to: null, label: "Showing all bills" };
  }
  if (state.preset === "custom") {
    const from = state.from ? parseInputDate(state.from) : null;
    const to = state.to ? parseInputDate(state.to) : null;
    if (state.from && !from) return { from: null, to: null, label: "Invalid from date" };
    if (state.to && !to) return { from: null, to: null, label: "Invalid to date" };
    if (from && to && from > to) return { from: null, to: null, label: "From date must be on or before to date" };
    const parts = [];
    if (from) parts.push(`from ${formatDate(toInputDate(from))}`);
    if (to) parts.push(`to ${formatDate(toInputDate(to))}`);
    return {
      from,
      to,
      label: parts.length ? `Showing ${parts.join(" ")}` : "Custom date range",
    };
  }

  const months = state.preset === "6m" ? 6 : state.preset === "1y" ? 12 : 3;
  const from = addMonths(today, -months);
  const labels = { "3m": "last 3 months", "6m": "last 6 months", "1y": "last 12 months" };
  return {
    from,
    to: today,
    label: `Showing ${labels[state.preset] || "selected range"}`,
  };
}

function filterBillsByDateRange(bills, state = dateRangeState) {
  const bounds = getDateRangeBounds(state);
  if (bounds.from === null && bounds.to === null && state.preset !== "custom") {
    return { bills, bounds };
  }
  if (state.preset === "custom" && !bounds.from && !bounds.to) {
    return { bills: [], bounds };
  }

  const filtered = bills.filter((bill) => {
    const billDate = parseBillDate(bill);
    if (!billDate) return false;
    const day = startOfDay(billDate);
    if (bounds.from && day < bounds.from) return false;
    if (bounds.to && day > bounds.to) return false;
    return true;
  });
  return { bills: filtered, bounds };
}

// ==========================================================================
// 5. Formatting Helpers
// ==========================================================================

function formatCurrency(value, digits = 0) {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function formatUnits(value, digits = 0) {
  if (!Number.isFinite(value)) return "-";
  return `${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)} kWh`;
}

function formatPercent(value, digits = 0) {
  if (!Number.isFinite(value)) return "-";
  return `${(value * 100).toFixed(digits)}%`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = value instanceof Date ? value : parseInputDate(value) || new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(date);
}

function formatFullDate(value) {
  if (!value) return "-";
  const date = value instanceof Date ? value : parseInputDate(value) || new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date);
}

function formatAxisNumber(value) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

function toNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toNonNegativeMoney(value) {
  const numeric = toNumber(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric < 0 ? 0 : numeric;
}

function sumNumbers(values) {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

function average(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? sumNumbers(valid) / valid.length : null;
}

function maxBy(items, selector) {
  return items.reduce((best, item) => {
    const value = selector(item);
    if (!Number.isFinite(value)) return best;
    if (!best || value > selector(best)) return item;
    return best;
  }, null);
}

function minBy(items, selector) {
  return items.reduce((best, item) => {
    const value = selector(item);
    if (!Number.isFinite(value)) return best;
    if (!best || value < selector(best)) return item;
    return best;
  }, null);
}

// ==========================================================================
// 6. API Helpers
// ==========================================================================

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(extractApiErrorMessage(data) || `Request failed (${response.status}).`);
  }
  return data;
}

function extractDetailMessage(detail) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") return item.msg || item.message || null;
        return null;
      })
      .filter(Boolean);
    return messages.length ? messages.join("; ") : JSON.stringify(detail);
  }
  if (detail && typeof detail === "object") {
    return String(detail.msg || detail.message || JSON.stringify(detail));
  }
  return String(detail);
}

function extractApiErrorMessage(data) {
  if (data && typeof data === "object") {
    if ("detail" in data) return extractDetailMessage(data.detail);
    if ("message" in data) return String(data.message);
    return JSON.stringify(data);
  }
  return String(data);
}

// ==========================================================================
// 7. Metrics & Dashboard Data Processing
// ==========================================================================

function normalizeTrendBill(bill) {
  const unitsImported = toNumber(bill.units_imported);
  const unitsExported = toNumber(bill.units_exported);
  const solarGeneration = toNumber(bill.solar_generation_kwh);
  const solarSelfUsed =
    toNumber(bill.solar_self_used_kwh) ??
    (Number.isFinite(solarGeneration) && Number.isFinite(unitsExported)
      ? Math.max(solarGeneration - unitsExported, 0)
      : null);
  const homeDemand =
    toNumber(bill.home_demand_kwh) ??
    (Number.isFinite(unitsImported) && Number.isFinite(solarSelfUsed) ? unitsImported + solarSelfUsed : null);
  const netGrid =
    toNumber(bill.net_grid_consumption_kwh) ??
    (Number.isFinite(unitsImported) && Number.isFinite(unitsExported) ? unitsImported - unitsExported : null);
  const costPerHomeUnit =
    toNumber(bill.cost_per_home_unit) ??
    (Number.isFinite(homeDemand) && homeDemand > 0 ? +(bill.total_amount / homeDemand).toFixed(2) : null);

  return {
    ...bill,
    label: bill.label || formatDate(bill.bill_date),
    unitsImported,
    unitsExported,
    solarGeneration,
    solarSelfUsed,
    homeDemand,
    solarCoverage: toNumber(bill.solar_coverage),
    netGrid,
    costPerHomeUnit,
  };
}

function summarizeBills(bills) {
  const billAmounts = bills.map((bill) => bill.total_amount).filter(Number.isFinite);
  const imports = bills.map((bill) => bill.unitsImported).filter(Number.isFinite);
  const solarToGrid = bills.map((bill) => bill.unitsExported).filter(Number.isFinite);
  const solarGeneration = bills.map((bill) => bill.solarGeneration).filter(Number.isFinite);
  const solarSelfUse = bills.map((bill) => bill.solarSelfUsed).filter(Number.isFinite);
  const homeDemand = bills.map((bill) => bill.homeDemand).filter(Number.isFinite);
  const solarCoverage = bills.map((bill) => bill.solarCoverage).filter(Number.isFinite);

  const totalSpend = sumNumbers(billAmounts);
  const totalSolarGeneration = sumNumbers(solarGeneration);
  const totalSolarSelfUsed = sumNumbers(solarSelfUse);
  const totalHomeDemand = sumNumbers(homeDemand);

  return {
    totalSpend,
    avgBill: average(billAmounts),
    totalGridImport: sumNumbers(imports),
    totalSolarToGrid: sumNumbers(solarToGrid),
    totalSolarGeneration,
    totalSolarSelfUsed,
    totalHomeDemand,
    avgCoverage: average(solarCoverage),
    avgSolarGeneration: average(solarGeneration),
    solarSelfUseShare: totalSolarGeneration > 0 ? totalSolarSelfUsed / totalSolarGeneration : null,
    latestBill: bills[bills.length - 1] || null,
    previousBill: bills[bills.length - 2] || null,
    lowestBill: minBy(bills, (bill) => bill.total_amount),
    highestBill: maxBy(bills, (bill) => bill.total_amount),
    highestDemand: maxBy(bills, (bill) => bill.homeDemand),
    bestCoverage: maxBy(bills, (bill) => bill.solarCoverage),
    highestSolarGenerationMonth: maxBy(bills, (bill) => bill.solarGeneration),
    highestSolarToGridMonth: maxBy(bills, (bill) => bill.unitsExported),
  };
}

function buildInsights(summary) {
  const insights = [];

  if (summary.lowestBill && summary.highestBill) {
    insights.push({
      kicker: "Spend Range",
      text: `${summary.lowestBill.label} was lowest at ${formatCurrency(summary.lowestBill.total_amount)}, while peak month was ${summary.highestBill.label} at ${formatCurrency(summary.highestBill.total_amount)}.`,
    });
  }

  if (summary.bestCoverage && summary.bestCoverage.solarCoverage > 0) {
    insights.push({
      kicker: "Peak Solar Offset",
      text: `${summary.bestCoverage.label} met ${formatPercent(summary.bestCoverage.solarCoverage, 1)} of total home electricity load directly from solar generation.`,
    });
  }

  if (summary.highestDemand) {
    insights.push({
      kicker: "Peak Household Load",
      text: `${summary.highestDemand.label} recorded highest home energy demand at ${formatUnits(summary.highestDemand.homeDemand)}.`,
    });
  }

  if (insights.length < 3 && summary.highestSolarGenerationMonth && summary.highestSolarGenerationMonth.solarGeneration > 0) {
    insights.push({
      kicker: "Solar Output",
      text: `${summary.highestSolarGenerationMonth.label} generated ${formatUnits(summary.highestSolarGenerationMonth.solarGeneration)}, with ${formatUnits(summary.highestSolarGenerationMonth.solarSelfUsed)} used directly at home.`,
    });
  }

  return insights.length ? insights.slice(0, 3) : [
    {
      kicker: "Awaiting Data",
      text: "Upload or fetch bills to generate automated energy insights.",
    },
  ];
}

function renderInsights(insights) {
  const container = document.getElementById("insightList");
  if (!container) return;

  container.replaceChildren(
    ...insights.map((insight) => {
      const item = document.createElement("div");
      item.className = "insight-item";

      const kicker = document.createElement("div");
      kicker.className = "insight-kicker";
      kicker.textContent = insight.kicker;

      const text = document.createElement("div");
      text.className = "insight-text";
      text.textContent = insight.text;

      item.append(kicker, text);
      return item;
    }),
  );
}

function renderNotifications(notifications) {
  if (!notificationList) return;
  if (notifBadgeDot) {
    notifBadgeDot.hidden = !notifications.length;
  }

  if (!notifications.length) {
    notificationList.innerHTML = '<div class="notif-item"><p style="color: var(--text-muted);">No notification events recorded yet.</p></div>';
    return;
  }

  notificationList.replaceChildren(
    ...notifications.map((item) => {
      const node = document.createElement("div");
      node.className = "notif-item";

      const title = document.createElement("strong");
      title.textContent = item.title;

      const body = document.createElement("p");
      body.textContent = item.body;

      const meta = document.createElement("div");
      meta.className = "notif-meta";
      meta.textContent = `${formatFullDate(item.created_at)} • ${item.status}`;

      node.append(title, body, meta);
      return node;
    }),
  );
}

function filterLedgerBySearch(bills, query) {
  if (!query) return bills;
  const q = query.toLowerCase().trim();
  return bills.filter((b) => {
    const label = (b.label || "").toLowerCase();
    const amount = String(b.total_amount || "");
    const date = (b.bill_date ? String(b.bill_date) : "").toLowerCase();
    return label.includes(q) || amount.includes(q) || date.includes(q);
  });
}

function renderLedger(bills) {
  const displayedBills = filterLedgerBySearch(bills, ledgerSearchQuery);

  const emptyMsg = currentBills.length && !displayedBills.length
    ? (ledgerSearchQuery ? `No bills matching "${ledgerSearchQuery}".` : "No bills in this date range. Try selecting All.")
    : "No parsed bills available yet. Click Refresh or upload PDF files.";

  // Mobile Cards Render
  if (ledgerCardsEl) {
    if (!displayedBills.length) {
      ledgerCardsEl.innerHTML = `<div class="mobile-ledger-card"><p style="color: var(--text-muted);">${emptyMsg}</p></div>`;
    } else {
      ledgerCardsEl.replaceChildren(
        ...displayedBills.map((bill) => {
          const card = document.createElement("div");
          card.className = "mobile-ledger-card";
          card.innerHTML = `
            <div class="mobile-card-top">
              <span class="mobile-card-date">${bill.label}</span>
              <span class="mobile-card-amount">${formatCurrency(bill.total_amount)}</span>
            </div>
            <div class="mobile-card-grid">
              <div class="mobile-stat-col"><span>Grid Import</span><strong>${formatUnits(bill.unitsImported)}</strong></div>
              <div class="mobile-stat-col"><span>Solar Share</span><strong>${Number.isFinite(bill.solarCoverage) && bill.solarCoverage > 0 ? formatPercent(bill.solarCoverage, 1) : "0% (Grid)"}</strong></div>
              <div class="mobile-stat-col"><span>Solar Gen</span><strong>${formatUnits(bill.solarGeneration)}</strong></div>
              <div class="mobile-stat-col"><span>Unit Rate</span><strong>${formatCurrency(bill.costPerHomeUnit, 2)}</strong></div>
            </div>
          `;
          return card;
        }),
      );
    }
  }

  // Desktop Table Render
  if (!ledgerBodyEl) return;

  if (!displayedBills.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.style.color = "var(--text-muted)";
    cell.style.textAlign = "center";
    cell.style.padding = "24px";
    cell.textContent = emptyMsg;
    row.appendChild(cell);
    ledgerBodyEl.replaceChildren(row);
    return;
  }

  ledgerBodyEl.replaceChildren(
    ...displayedBills.map((bill) => {
      const row = document.createElement("tr");
      const values = [
        bill.label,
        formatCurrency(bill.total_amount),
        formatUnits(bill.unitsImported),
        formatUnits(bill.unitsExported),
        formatUnits(bill.solarGeneration),
        formatUnits(bill.homeDemand),
        formatCurrency(bill.costPerHomeUnit, 2),
      ];

      values.forEach((value, idx) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        if (idx === 1) {
          cell.style.fontWeight = "600";
          cell.style.color = "var(--text-primary)";
        }
        row.appendChild(cell);
      });

      return row;
    }),
  );
}

function setMetric(id, value, metaId, meta) {
  const valEl = document.getElementById(id);
  const metaEl = document.getElementById(metaId);
  if (valEl) valEl.textContent = value;
  if (metaEl) metaEl.textContent = meta;
}

function renderSummary(summary, bills) {
  const hasBills = bills.length > 0;
  const emptyMeta = currentBills.length ? "No bills in range." : "Awaiting bill data.";

  setMetric(
    "totalSpend",
    hasBills ? formatCurrency(summary.totalSpend) : "-",
    "totalSpendMeta",
    hasBills ? `${formatCurrency(summary.avgBill)} average across ${bills.length} cycle${bills.length === 1 ? "" : "s"}` : emptyMeta,
  );
  setMetric(
    "avgBill",
    hasBills ? formatCurrency(summary.avgBill) : "-",
    "avgBillMeta",
    summary.lowestBill ? `Lowest was ${summary.lowestBill.label} (${formatCurrency(summary.lowestBill.total_amount)})` : emptyMeta,
  );
  setMetric(
    "totalDemand",
    hasBills ? formatUnits(summary.totalHomeDemand) : "-",
    "totalDemandMeta",
    summary.highestDemand ? `Peak was ${summary.highestDemand.label} (${formatUnits(summary.highestDemand.homeDemand)})` : emptyMeta,
  );

  const hasSolar = summary.totalSolarGeneration > 0;
  setMetric(
    "solarCoverage",
    hasBills ? (hasSolar ? formatPercent(summary.avgCoverage, 1) : "Grid Only") : "-",
    "solarCoverageMeta",
    hasBills
      ? (hasSolar ? (summary.bestCoverage ? `Best was ${summary.bestCoverage.label} (${formatPercent(summary.bestCoverage.solarCoverage, 1)})` : "Solar coverage") : "100% powered by KSEB grid")
      : emptyMeta,
  );

  const peakValue = document.getElementById("overviewSolarPeakValue");
  const peakMeta = document.getElementById("overviewSolarPeakMeta");
  const useValue = document.getElementById("overviewSolarUseValue");
  const useMeta = document.getElementById("overviewSolarUseMeta");
  const latestValue = document.getElementById("overviewSolarLatestValue");
  const latestMeta = document.getElementById("overviewSolarLatestMeta");

  if (peakValue) peakValue.textContent = summary.highestSolarGenerationMonth ? summary.highestSolarGenerationMonth.label : (hasSolar ? "-" : "N/A");
  if (peakMeta) {
    peakMeta.textContent = summary.highestSolarGenerationMonth
      ? `${formatUnits(summary.highestSolarGenerationMonth.solarGeneration)} total generated`
      : (hasSolar ? emptyMeta : "No solar generation recorded");
  }
  if (useValue) useValue.textContent = hasSolar ? formatPercent(summary.solarSelfUseShare, 1) : (hasBills ? "N/A" : "-");
  if (useMeta) {
    useMeta.textContent = hasSolar && Number.isFinite(summary.avgSolarGeneration)
      ? `${formatUnits(summary.avgSolarGeneration)} avg generation per cycle`
      : (hasSolar ? emptyMeta : "On-site solar not active");
  }
  if (latestValue) latestValue.textContent = hasSolar && summary.latestBill ? formatUnits(summary.latestBill.solarGeneration) : (hasBills ? "N/A" : "-");
  if (latestMeta) {
    latestMeta.textContent = hasSolar && summary.latestBill && Number.isFinite(summary.latestBill.solarSelfUsed)
      ? `${summary.latestBill.label}: ${formatUnits(summary.latestBill.solarSelfUsed)} used on-site`
      : (hasSolar ? emptyMeta : "Connect rooftop solar to view generation");
  }

  const billDelta =
    summary.latestBill &&
    summary.previousBill &&
    Number.isFinite(summary.latestBill.total_amount) &&
    Number.isFinite(summary.previousBill.total_amount)
      ? summary.latestBill.total_amount - summary.previousBill.total_amount
      : null;

  const trendBadge = document.getElementById("trendBadge");
  if (trendBadge) {
    trendBadge.textContent = Number.isFinite(billDelta)
      ? `Latest bill ${billDelta >= 0 ? "▲" : "▼"} ${formatCurrency(Math.abs(billDelta))} vs prior cycle`
      : "Month-on-month trend";
  }

  if (ledgerBadge) {
    ledgerBadge.textContent = `${bills.length} bill${bills.length === 1 ? "" : "s"}`;
  }
}

// ==========================================================================
// 8. ECharts Visualizations
// ==========================================================================

const ECHARTS_CLEAN_TOOLTIP = {
  trigger: "axis",
  backgroundColor: "#1a2030",
  borderColor: "#2e374d",
  borderWidth: 1,
  padding: [10, 14],
  textStyle: {
    color: "#ffffff",
    fontFamily: "'Inter', sans-serif",
    fontSize: 12,
  },
  extraCssText: "border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.5);",
};

function renderChartFallback(message) {
  CHART_ELEMENT_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.replaceChildren();
    el.classList.add("chart-empty");
    el.textContent = message;
  });
}

function clearChartFallback() {
  CHART_ELEMENT_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("chart-empty");
    if (!el.childElementCount) {
      el.textContent = "";
    }
  });
}

function resetCharts() {
  chartInstances.forEach((chart) => chart.dispose());
  chartInstances.clear();
}

function buildTrendChart(bills) {
  const chartEl = document.getElementById("trendChart");
  if (!chartEl) return null;
  const chart = window.echarts.init(chartEl);

  chart.setOption({
    backgroundColor: "transparent",
    animationDuration: 500,
    tooltip: ECHARTS_CLEAN_TOOLTIP,
    legend: {
      type: "scroll",
      top: 0,
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 12,
      pageIconSize: 10,
      pageTextStyle: { color: "#94a3b8", fontSize: 10 },
      textStyle: { color: "#94a3b8", fontSize: 11 },
    },
    grid: { left: 6, right: 10, top: 46, bottom: 12, containLabel: true },
    xAxis: {
      type: "category",
      data: bills.map((b) => b.label),
      axisLine: { lineStyle: { color: "#1e2434" } },
      axisLabel: { color: "#64748b", fontSize: 11 },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: "value",
        name: "Bill (₹)",
        nameTextStyle: { color: "#64748b", fontSize: 10, padding: [0, 0, 2, 0] },
        axisLabel: { color: "#64748b", fontSize: 10 },
        splitLine: { lineStyle: { color: "#1e2434" } },
      },
      {
        type: "value",
        name: "Energy (kWh)",
        nameTextStyle: { color: "#64748b", fontSize: 10, padding: [0, 0, 2, 0] },
        axisLabel: { color: "#64748b", fontSize: 10 },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: "Bill (₹)",
        type: "bar",
        yAxisIndex: 0,
        barMaxWidth: 22,
        itemStyle: {
          color: new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "#60a5fa" },
            { offset: 1, color: "#2563eb" },
          ]),
          borderRadius: [4, 4, 0, 0],
        },
        data: bills.map((b) => b.total_amount),
      },
      {
        name: "Demand (kWh)",
        type: "line",
        yAxisIndex: 1,
        smooth: true,
        symbolSize: 6,
        itemStyle: { color: "#06b6d4" },
        lineStyle: { width: 2.5, color: "#06b6d4" },
        areaStyle: {
          color: new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(6, 182, 212, 0.18)" },
            { offset: 1, color: "rgba(6, 182, 212, 0.0)" },
          ]),
        },
        data: bills.map((b) => b.homeDemand),
      },
      {
        name: "Solar (kWh)",
        type: "line",
        yAxisIndex: 1,
        smooth: true,
        symbolSize: 5,
        itemStyle: { color: "#10b981" },
        lineStyle: { width: 2, color: "#10b981" },
        data: bills.map((b) => b.solarGeneration),
      },
    ],
  });

  return chart;
}

function buildImportVsSolarChart(bills) {
  const chartEl = document.getElementById("importVsSolarChart");
  if (!chartEl) return null;
  const chart = window.echarts.init(chartEl);

  const imported = bills.map((b) => b.unitsImported ?? 0);
  const solar = bills.map((b) => b.solarGeneration ?? 0);

  chart.setOption({
    backgroundColor: "transparent",
    animationDuration: 500,
    tooltip: ECHARTS_CLEAN_TOOLTIP,
    legend: {
      type: "scroll",
      top: 0,
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 12,
      pageIconSize: 10,
      pageTextStyle: { color: "#94a3b8", fontSize: 10 },
      textStyle: { color: "#94a3b8", fontSize: 11 },
    },
    grid: { left: 6, right: 10, top: 42, bottom: 12, containLabel: true },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: bills.map((b) => b.label),
      axisLine: { lineStyle: { color: "#1e2434" } },
      axisLabel: { color: "#64748b", fontSize: 11 },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      name: "kWh",
      nameTextStyle: { color: "#64748b", fontSize: 10, padding: [0, 0, 2, 0] },
      axisLabel: { color: "#64748b", fontSize: 10, formatter: (v) => formatAxisNumber(v) },
      splitLine: { lineStyle: { color: "#1e2434" } },
    },
    series: [
      {
        name: "Grid Import",
        type: "line",
        smooth: true,
        symbolSize: 6,
        itemStyle: { color: "#3b82f6" },
        lineStyle: { width: 2.5, color: "#3b82f6" },
        areaStyle: {
          color: new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(59, 130, 246, 0.2)" },
            { offset: 1, color: "rgba(59, 130, 246, 0.0)" },
          ]),
        },
        data: imported,
      },
      {
        name: "Solar Gen",
        type: "line",
        smooth: true,
        symbolSize: 5,
        itemStyle: { color: "#f59e0b" },
        lineStyle: { width: 2, color: "#f59e0b" },
        areaStyle: {
          color: new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(245, 158, 11, 0.18)" },
            { offset: 1, color: "rgba(245, 158, 11, 0.0)" },
          ]),
        },
        data: solar,
      },
    ],
  });

  return chart;
}

function buildFlowChart(bills) {
  const chartEl = document.getElementById("flowChart");
  if (!chartEl) return null;
  const chart = window.echarts.init(chartEl);

  chart.setOption({
    backgroundColor: "transparent",
    animationDuration: 500,
    tooltip: ECHARTS_CLEAN_TOOLTIP,
    legend: {
      type: "scroll",
      top: 0,
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 10,
      pageIconSize: 10,
      pageTextStyle: { color: "#94a3b8", fontSize: 10 },
      textStyle: { color: "#94a3b8", fontSize: 11 },
    },
    grid: { left: 6, right: 10, top: 44, bottom: 12, containLabel: true },
    xAxis: {
      type: "category",
      data: bills.map((b) => b.label),
      axisLine: { lineStyle: { color: "#1e2434" } },
      axisLabel: { color: "#64748b", fontSize: 11 },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      name: "kWh",
      nameTextStyle: { color: "#64748b", fontSize: 10, padding: [0, 0, 2, 0] },
      axisLabel: { color: "#64748b", fontSize: 10, formatter: (v) => formatAxisNumber(v) },
      splitLine: { lineStyle: { color: "#1e2434" } },
    },
    series: [
      {
        name: "Solar Used",
        type: "bar",
        stack: "flow",
        barMaxWidth: 22,
        itemStyle: { color: "#10b981" },
        data: bills.map((b) => b.solarSelfUsed),
      },
      {
        name: "Grid Import",
        type: "bar",
        stack: "flow",
        barMaxWidth: 22,
        itemStyle: { color: "#3b82f6" },
        data: bills.map((b) => b.unitsImported),
      },
      {
        name: "Solar Export",
        type: "bar",
        barMaxWidth: 22,
        itemStyle: { color: "#ef4444", borderRadius: [4, 4, 0, 0] },
        data: bills.map((b) => b.unitsExported),
      },
      {
        name: "Solar Gen",
        type: "line",
        smooth: true,
        symbolSize: 5,
        itemStyle: { color: "#fbbf24" },
        lineStyle: { width: 2, color: "#fbbf24" },
        data: bills.map((b) => b.solarGeneration),
      },
    ],
  });

  return chart;
}

function buildPerformanceChart(bills) {
  const chartEl = document.getElementById("performanceChart");
  if (!chartEl) return null;
  const chart = window.echarts.init(chartEl);

  chart.setOption({
    backgroundColor: "transparent",
    animationDuration: 500,
    tooltip: ECHARTS_CLEAN_TOOLTIP,
    legend: {
      type: "scroll",
      top: 0,
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 12,
      pageIconSize: 10,
      pageTextStyle: { color: "#94a3b8", fontSize: 10 },
      textStyle: { color: "#94a3b8", fontSize: 11 },
    },
    grid: { left: 6, right: 10, top: 44, bottom: 12, containLabel: true },
    xAxis: {
      type: "category",
      data: bills.map((b) => b.label),
      axisLine: { lineStyle: { color: "#1e2434" } },
      axisLabel: { color: "#64748b", fontSize: 11 },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: "value",
        name: "Coverage %",
        nameTextStyle: { color: "#64748b", fontSize: 10, padding: [0, 0, 2, 0] },
        axisLabel: { color: "#64748b", fontSize: 10, formatter: (v) => `${v}%` },
        splitLine: { lineStyle: { color: "#1e2434" } },
      },
      {
        type: "value",
        name: "Cost / kWh (₹)",
        nameTextStyle: { color: "#64748b", fontSize: 10, padding: [0, 0, 2, 0] },
        axisLabel: { color: "#64748b", fontSize: 10, formatter: (v) => `₹${v}` },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: "Solar Share (%)",
        type: "line",
        smooth: true,
        symbolSize: 6,
        itemStyle: { color: "#10b981" },
        lineStyle: { width: 2.5, color: "#10b981" },
        data: bills.map((b) => (Number.isFinite(b.solarCoverage) ? +(b.solarCoverage * 100).toFixed(1) : null)),
      },
      {
        name: "Cost / Unit (₹)",
        type: "line",
        yAxisIndex: 1,
        smooth: true,
        symbolSize: 5,
        itemStyle: { color: "#f59e0b" },
        lineStyle: { width: 2, color: "#f59e0b" },
        data: bills.map((b) => (Number.isFinite(b.costPerHomeUnit) ? b.costPerHomeUnit : null)),
      },
    ],
  });

  return chart;
}

const TAB_CHART_BUILDERS = {
  overview: [
    ["trend", buildTrendChart],
    ["importVsSolar", buildImportVsSolarChart],
  ],
  energy: [
    ["flow", buildFlowChart],
    ["performance", buildPerformanceChart],
  ],
  ledger: [],
};

function ensureTabCharts(tabId) {
  if (!window.echarts || !filteredBills.length) return;
  for (const [chartId, builder] of TAB_CHART_BUILDERS[tabId] || []) {
    if (!chartInstances.has(chartId)) {
      const instance = builder(filteredBills);
      if (instance) chartInstances.set(chartId, instance);
    }
  }
}

function syncDateRangeControls() {
  document.querySelectorAll("[data-range-preset]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.rangePreset === dateRangeState.preset);
  });

  if (customRangeRow) {
    customRangeRow.hidden = dateRangeState.preset !== "custom";
  }
  if (rangeFromInput && dateRangeState.from) {
    rangeFromInput.value = dateRangeState.from;
  }
  if (rangeToInput && dateRangeState.to) {
    rangeToInput.value = dateRangeState.to;
  }

  const bounds = getDateRangeBounds();
  if (rangeSummaryEl) {
    const countLabel = filteredBills.length
      ? `${filteredBills.length} bill${filteredBills.length === 1 ? "" : "s"}`
      : "no bills";
    rangeSummaryEl.textContent = `${bounds.label} · ${countLabel}`;
  }
}

function applyDashboardView({ rebuildCharts = true } = {}) {
  const { bills, bounds } = filterBillsByDateRange(currentBills);
  filteredBills = bills;
  const summary = summarizeBills(filteredBills);

  renderSummary(summary, filteredBills);
  renderInsights(buildInsights(summary));
  renderLedger(filteredBills);
  syncDateRangeControls();

  if (!currentBills.length) {
    if (rebuildCharts) {
      resetCharts();
      renderChartFallback("No parsed bills available yet. Click Refresh or upload PDF files to view analytics.");
    }
    setActiveTab(activeTabId);
    return;
  }

  if (!filteredBills.length) {
    setStatus(bounds.label.includes("Invalid") || bounds.label.includes("must be")
      ? bounds.label
      : "No bills match this date range. Try selecting All.", "warning");
    if (rebuildCharts) {
      resetCharts();
      renderChartFallback("No bills in this date range.");
    }
    setActiveTab(activeTabId);
    return;
  }

  if (!window.echarts) {
    setStatus("Charts are unavailable because ECharts could not be loaded from the network.", "warning");
    if (rebuildCharts) {
      resetCharts();
      renderChartFallback("Charts are unavailable.");
    }
    setActiveTab(activeTabId);
    return;
  }

  setStatus("");
  if (rebuildCharts) {
    clearChartFallback();
    resetCharts();
  }
  setActiveTab(activeTabId);
}

function setDateRangePreset(preset) {
  dateRangeState = { ...dateRangeState, preset };
  if (preset !== "custom") {
    dateRangeState.from = "";
    dateRangeState.to = "";
    if (customRangeRow) customRangeRow.hidden = true;
  } else if (!dateRangeState.from && !dateRangeState.to && currentBills.length) {
    const dates = currentBills.map(parseBillDate).filter(Boolean).sort((a, b) => a - b);
    if (dates.length) {
      dateRangeState.from = toInputDate(dates[0]);
      dateRangeState.to = toInputDate(dates[dates.length - 1]);
    }
    if (customRangeRow) customRangeRow.hidden = false;
  } else {
    if (customRangeRow) customRangeRow.hidden = false;
  }
  persistDateRangeState();
  applyDashboardView();
}

function applyCustomDateRange() {
  dateRangeState = {
    preset: "custom",
    from: rangeFromInput?.value || "",
    to: rangeToInput?.value || "",
  };
  persistDateRangeState();
  applyDashboardView();
}

function setActiveTab(tabId) {
  activeTabId = tabId;

  // Update tabs
  document.querySelectorAll(".nav-tab").forEach((button) => {
    const isActive = button.dataset.tab === tabId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  // Update panels
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    const isActive = panel.dataset.panel === tabId;
    panel.hidden = !isActive;
  });

  // Update title
  if (pageSectionTitle) {
    if (tabId === "overview") pageSectionTitle.textContent = "Electricity Overview";
    else if (tabId === "energy") pageSectionTitle.textContent = "Solar & Energy Mix";
    else if (tabId === "ledger") pageSectionTitle.textContent = "Bill History Ledger";
  }

  ensureTabCharts(tabId);

  requestAnimationFrame(() => {
    for (const [chartId] of TAB_CHART_BUILDERS[tabId] || []) {
      const chart = chartInstances.get(chartId);
      if (chart) chart.resize();
    }
  });
}

// ==========================================================================
// 9. Modals & Sheet Controls
// ==========================================================================

function openUploadModal() {
  if (uploadSheetModal) {
    uploadSheetModal.hidden = false;
    uploadInput?.focus();
  }
}

function closeUploadModal() {
  if (uploadSheetModal) {
    uploadSheetModal.hidden = true;
    uploadForm?.reset();
    if (selectedFilesList) {
      selectedFilesList.replaceChildren();
      selectedFilesList.hidden = true;
    }
  }
}

function openNotificationsModal() {
  if (notificationsSheetModal) {
    notificationsSheetModal.hidden = false;
  }
}

function closeNotificationsModal() {
  if (notificationsSheetModal) {
    notificationsSheetModal.hidden = true;
  }
}

function openSettingsModal() {
  if (settingsModal) {
    settingsModal.hidden = false;
  }
}

function closeSettingsModal() {
  if (settingsModal) {
    settingsModal.hidden = true;
  }
}

function setupModalListeners() {
  uploadModalTrigger?.addEventListener("click", openUploadModal);
  closeUploadSheetBtn?.addEventListener("click", closeUploadModal);
  cancelUploadBtn?.addEventListener("click", closeUploadModal);

  notificationsToggleBtn?.addEventListener("click", openNotificationsModal);
  closeNotificationsButton?.addEventListener("click", closeNotificationsModal);

  settingsModalTrigger?.addEventListener("click", openSettingsModal);
  closeSettingsBtn?.addEventListener("click", closeSettingsModal);

  // Close modals on backdrop click
  [uploadSheetModal, notificationsSheetModal, settingsModal].forEach((modal) => {
    modal?.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.hidden = true;
      }
    });
  });

  // Drag and drop for upload zone
  if (dropZone && uploadInput) {
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("drag-over");
    });

    dropZone.addEventListener("dragleave", () => {
      dropZone.classList.remove("drag-over");
    });

    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("drag-over");
      if (e.dataTransfer?.files?.length) {
        uploadInput.files = e.dataTransfer.files;
        renderSelectedFilesPreview(Array.from(uploadInput.files));
      }
    });

    uploadInput.addEventListener("change", () => {
      if (uploadInput.files?.length) {
        renderSelectedFilesPreview(Array.from(uploadInput.files));
      }
    });
  }

  // Escape key closes modals
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeUploadModal();
      closeNotificationsModal();
      closeSettingsModal();
      if (customRangeRow) customRangeRow.hidden = true;
    }
  });

  // Ledger live search
  ledgerSearchInput?.addEventListener("input", (e) => {
    ledgerSearchQuery = e.target.value;
    renderLedger(filteredBills);
  });
}

function renderSelectedFilesPreview(files) {
  if (!selectedFilesList) return;
  if (!files.length) {
    selectedFilesList.hidden = true;
    selectedFilesList.replaceChildren();
    return;
  }

  selectedFilesList.hidden = false;
  selectedFilesList.replaceChildren(
    ...files.map((file) => {
      const row = document.createElement("div");
      row.className = "selected-file-row";
      row.innerHTML = `
        <span>📄 ${file.name}</span>
        <span style="color: var(--text-muted);">${(file.size / 1024).toFixed(0)} KB</span>
      `;
      return row;
    }),
  );
}

// ==========================================================================
// 10. Dashboard API Operations
// ==========================================================================

async function loadDashboard({ loading = null } = {}) {
  const load = async () => {
    const [me, dashboard] = await Promise.all([api("/api/me"), api("/api/dashboard")]);

    isDemoMode = false;
    currentBills = (dashboard.trend || []).map(normalizeTrendBill);

    setAuthedView(true);
    if (identityConsumerBadge) {
      identityConsumerBadge.textContent = me.masked_consumer_number;
    }
    if (settingsConsumerNumber) {
      settingsConsumerNumber.textContent = me.masked_consumer_number;
    }
    if (settingsMobileNumber) {
      settingsMobileNumber.textContent = me.masked_mobile_number;
    }

    renderNotifications(dashboard.notifications || []);
    applyDashboardView();

    if (!currentBills.length) {
      setStatus("Sign-in succeeded. Click 'Refresh' or upload PDF files to populate graphs.", "warning");
    }
  };

  if (loading) {
    return runWithLoading(loading, load);
  }
  return load();
}

async function enablePushNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("This browser does not support web push notifications.");
  }

  const sw = await navigator.serviceWorker.register("/sw.js");
  const keyResponse = await api("/api/push/public-key");
  if (!keyResponse.enabled || !keyResponse.publicKey) {
    throw new Error("Push notifications are not configured on this server.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const subscription = await sw.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(keyResponse.publicKey),
  });

  await api("/api/push/subscribe", {
    method: "POST",
    body: JSON.stringify(subscription.toJSON()),
  });
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function resetAppView() {
  resetCharts();
  currentBills = [];
  filteredBills = [];
  setStatus("");
  setAuthedView(false);
  closeUploadModal();
  closeNotificationsModal();
  closeSettingsModal();
  renderSavedAccounts();
}

// ==========================================================================
// 11. Event Handlers & Submissions
// ==========================================================================

// Login submission
if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await runWithLoading(
        {
          control: loginSubmitButton,
          busyLabel: "Signing In...",
        },
        async () => {
          persistCredentialsFromForm();
          await api("/api/session", {
            method: "POST",
            body: JSON.stringify({
              consumer_number: consumerNumberInput.value,
              mobile_number: mobileNumberInput.value,
            }),
          });
          showToast("Signed In", "Loading your energy dashboard...", "success");
          await loadDashboard();
        },
      );
    } catch (error) {
      showToast("Sign In Failed", error.message, "error");
    }
  });
}

// Upload submission
if (uploadForm && uploadInput) {
  uploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const files = Array.from(uploadInput.files || []);
    if (!files.length) {
      showToast("No File Chosen", "Please select at least one PDF bill.", "error");
      return;
    }

    if (isDemoMode) {
      showToast("Demo Mode", "Upload disabled in simulated preview. Sign in to upload real PDF bills.", "warning");
      return;
    }

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    try {
      await runWithLoading(
        {
          control: uploadSubmitButton,
          busyLabel: files.length > 1 ? `Uploading ${files.length} PDFs...` : "Uploading PDF...",
        },
        async () => {
          const response = await fetch("/api/uploads", {
            method: "POST",
            body: formData,
            credentials: "same-origin",
          });
          const contentType = response.headers.get("content-type") || "";
          const data = contentType.includes("application/json") ? await response.json() : await response.text();
          if (!response.ok) {
            throw new Error(extractApiErrorMessage(data) || "Upload failed.");
          }

          const uploadedFiles = data.uploads || [];
          const parsed = uploadedFiles.filter((i) => i.parser_status === "parsed");
          const failed = uploadedFiles.filter((i) => i.parser_status !== "parsed");

          if (failed.length) {
            const reason = failed.map((i) => i.error_message || i.filename).join(", ");
            showToast("Upload Result", `Parsed ${parsed.length} of ${uploadedFiles.length}. Failed: ${reason}`, "error", 7000);
          } else {
            showToast("Upload Successful", `Successfully parsed ${parsed.length} PDF bill${parsed.length === 1 ? "" : "s"}.`, "success");
          }

          closeUploadModal();
          await loadDashboard();
        },
      );
    } catch (error) {
      showToast("Upload Error", error.message, "error");
    }
  });
}

// Sync / Refresh
if (syncButton) {
  syncButton.addEventListener("click", async () => {
    if (isDemoMode) {
      showToast("Demo Mode", "Sync is disabled in simulated preview. Sign in with your KSEB credentials to sync live bills.", "warning");
      return;
    }

    try {
      const syncIcon = syncButton.querySelector(".sync-icon");
      if (syncIcon) syncIcon.style.animation = "progress-pulse 0.8s linear infinite";

      await runWithLoading(
        {
          control: syncButton,
          busyLabel: "Refreshing...",
        },
        async () => {
          await api("/api/sync", { method: "POST" });
          showToast("Refreshed", "Fetched and parsed latest bills from KSEB.", "success");
          await loadDashboard();
        },
      );
    } catch (error) {
      showToast("Refresh Failed", error.message, "error");
    } finally {
      const syncIcon = syncButton.querySelector(".sync-icon");
      if (syncIcon) syncIcon.style.animation = "";
    }
  });
}

// Push Notifications
if (pushButton) {
  pushButton.addEventListener("click", async () => {
    if (isDemoMode) {
      showToast("Demo Mode", "Notifications are disabled in simulated preview.", "warning");
      return;
    }

    try {
      await runWithLoading(
        { control: pushButton },
        async () => {
          await enablePushNotifications();
          showToast("Notifications Enabled", "You will receive alerts on new KSEB bill syncs.", "success");
          await loadDashboard();
        },
      );
    } catch (error) {
      showToast("Setup Failed", error.message, "error");
    }
  });
}

// Export Data
if (exportButton) {
  exportButton.addEventListener("click", async () => {
    if (isDemoMode) {
      showToast("Demo Mode", "Data export not applicable for simulated preview.", "warning");
      return;
    }

    try {
      await runWithLoading(
        { control: exportButton },
        async () => {
          const payload = await api("/api/account/export");
          const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "kseb-energy-export.json";
          link.click();
          URL.revokeObjectURL(url);
          showToast("Export Downloaded", "Account energy data saved to JSON.", "success");
        },
      );
    } catch (error) {
      showToast("Export Failed", error.message, "error");
    }
  });
}

// Logout Handlers (Top Nav and Settings Sheet)
async function performLogout(triggerButton) {
  closeSettingsModal();
  if (isDemoMode) {
    exitDemoMode();
    return;
  }
  try {
    await runWithLoading(
      { control: triggerButton, busyLabel: "Signing Out..." },
      async () => {
        await api("/api/session", { method: "DELETE" });
        resetAppView();
        showToast("Signed Out", "Your session has been securely closed.", "info");
      },
    );
  } catch (error) {
    showToast("Sign Out Error", error.message, "error");
  }
}

topNavLogoutButton?.addEventListener("click", () => performLogout(topNavLogoutButton));
settingsLogoutButton?.addEventListener("click", () => performLogout(settingsLogoutButton));
logoutButton?.addEventListener("click", () => performLogout(logoutButton));

// Delete Account
if (deleteButton) {
  deleteButton.addEventListener("click", async () => {
    if (isDemoMode) {
      showToast("Demo Mode", "Account deletion not applicable for simulated preview.", "warning");
      return;
    }

    const confirmed = window.confirm("Are you sure you want to permanently delete your account and all stored KSEB bills from this server?");
    if (!confirmed) return;

    closeSettingsModal();
    try {
      await runWithLoading(
        { control: deleteButton },
        async () => {
          await api("/api/account", { method: "DELETE" });
          resetAppView();
          showToast("Account Erased", "All your data has been permanently deleted.", "info");
        },
      );
    } catch (error) {
      showToast("Deletion Error", error.message, "error");
    }
  });
}

// Setup tabs & range controls
function setupTabs() {
  document.querySelectorAll(".nav-tab").forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.tab));
  });
}

function setupDateRangeControls() {
  document.querySelectorAll("[data-range-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      setDateRangePreset(button.dataset.rangePreset);
    });
  });

  applyCustomRangeButton?.addEventListener("click", applyCustomDateRange);
  cancelCustomRangeButton?.addEventListener("click", () => {
    if (customRangeRow) customRangeRow.hidden = true;
  });
  syncDateRangeControls();
}

function setActiveTab(tabId) {
  activeTabId = tabId;
  if (window.location.hash !== `#${tabId}`) {
    history.replaceState(null, "", `#${tabId}`);
  }

  // Update tabs
  document.querySelectorAll(".nav-tab").forEach((button) => {
    const isActive = button.dataset.tab === tabId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  // Update panels
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    const isActive = panel.dataset.panel === tabId;
    panel.hidden = !isActive;
  });

  // Update title
  if (pageSectionTitle) {
    if (tabId === "overview") pageSectionTitle.textContent = "Electricity Overview";
    else if (tabId === "energy") pageSectionTitle.textContent = "Solar & Energy Mix";
    else if (tabId === "ledger") pageSectionTitle.textContent = "Bill History Ledger";
  }

  ensureTabCharts(tabId);

  requestAnimationFrame(() => {
    for (const [chartId] of TAB_CHART_BUILDERS[tabId] || []) {
      const chart = chartInstances.get(chartId);
      if (chart) chart.resize();
    }
  });
}

// ==========================================================================
// 12. Landing Segmented Navigation, Bill Calculator, Solar & Demo Mode
// ==========================================================================

let isDemoMode = false;
let calcPhase = "single";

const SAMPLE_DEMO_BILLS = [
  {
    id: "demo-bill-6",
    bill_date: "2026-04-03",
    due_date: "2026-04-14",
    total_amount: 1420.0,
    label: "Apr 2026",
    units_imported: 310.0,
    units_exported: 360.0,
    solar_generation_kwh: 520.0,
    solar_self_used_kwh: 160.0,
    home_demand_kwh: 470.0,
    solar_coverage: 110.6,
    cost_per_home_unit: 3.02,
    net_grid_consumption_kwh: -50.0,
    fixed_charge: 220.0,
    energy_charge: 1020.0,
    tax_and_rent: 180.0,
    billing_period_category: "bimonthly",
    billing_period_days: 60,
  },
  {
    id: "demo-bill-5",
    bill_date: "2026-02-03",
    due_date: "2026-02-13",
    total_amount: 890.0,
    label: "Feb 2026",
    units_imported: 240.0,
    units_exported: 410.0,
    solar_generation_kwh: 580.0,
    solar_self_used_kwh: 170.0,
    home_demand_kwh: 410.0,
    solar_coverage: 141.5,
    cost_per_home_unit: 2.17,
    net_grid_consumption_kwh: -170.0,
    fixed_charge: 180.0,
    energy_charge: 590.0,
    tax_and_rent: 120.0,
    billing_period_category: "bimonthly",
    billing_period_days: 61,
  },
  {
    id: "demo-bill-4",
    bill_date: "2025-12-03",
    due_date: "2025-12-14",
    total_amount: 1150.0,
    label: "Dec 2025",
    units_imported: 280.0,
    units_exported: 290.0,
    solar_generation_kwh: 420.0,
    solar_self_used_kwh: 130.0,
    home_demand_kwh: 410.0,
    solar_coverage: 102.4,
    cost_per_home_unit: 2.80,
    net_grid_consumption_kwh: -10.0,
    fixed_charge: 180.0,
    energy_charge: 840.0,
    tax_and_rent: 130.0,
    billing_period_category: "bimonthly",
    billing_period_days: 61,
  },
  {
    id: "demo-bill-3",
    bill_date: "2025-10-03",
    due_date: "2025-10-14",
    total_amount: 1780.0,
    label: "Oct 2025",
    units_imported: 360.0,
    units_exported: 180.0,
    solar_generation_kwh: 310.0,
    solar_self_used_kwh: 130.0,
    home_demand_kwh: 490.0,
    solar_coverage: 63.3,
    cost_per_home_unit: 3.63,
    net_grid_consumption_kwh: 180.0,
    fixed_charge: 220.0,
    energy_charge: 1360.0,
    tax_and_rent: 200.0,
    billing_period_category: "bimonthly",
    billing_period_days: 61,
  },
  {
    id: "demo-bill-2",
    bill_date: "2025-08-03",
    due_date: "2025-08-14",
    total_amount: 2150.0,
    label: "Aug 2025",
    units_imported: 420.0,
    units_exported: 90.0,
    solar_generation_kwh: 220.0,
    solar_self_used_kwh: 130.0,
    home_demand_kwh: 550.0,
    solar_coverage: 40.0,
    cost_per_home_unit: 3.91,
    net_grid_consumption_kwh: 330.0,
    fixed_charge: 260.0,
    energy_charge: 1650.0,
    tax_and_rent: 240.0,
    billing_period_category: "bimonthly",
    billing_period_days: 61,
  },
  {
    id: "demo-bill-1",
    bill_date: "2025-06-03",
    due_date: "2025-06-13",
    total_amount: 1980.0,
    label: "Jun 2025",
    units_imported: 390.0,
    units_exported: 120.0,
    solar_generation_kwh: 260.0,
    solar_self_used_kwh: 140.0,
    home_demand_kwh: 530.0,
    solar_coverage: 49.1,
    cost_per_home_unit: 3.74,
    net_grid_consumption_kwh: 270.0,
    fixed_charge: 220.0,
    energy_charge: 1530.0,
    tax_and_rent: 230.0,
    billing_period_category: "bimonthly",
    billing_period_days: 61,
  },
];

function startDemoMode() {
  isDemoMode = true;
  currentBills = SAMPLE_DEMO_BILLS.map(normalizeTrendBill);
  filteredBills = [...currentBills];
  setAuthedView(true);

  const demoBanner = document.getElementById("demoModeBanner");
  if (demoBanner) demoBanner.hidden = false;

  if (identityConsumerBadge) {
    identityConsumerBadge.textContent = "DEMO (Sample Data)";
  }
  if (settingsConsumerNumber) {
    settingsConsumerNumber.textContent = "1155000012345 (Demo)";
  }
  if (settingsMobileNumber) {
    settingsMobileNumber.textContent = "9847000000 (Demo)";
  }

  renderNotifications([
    {
      id: "demo-note-1",
      title: "KSEB Energy Live Preview",
      message: "Viewing simulated solar & grid energy telemetry for a Kerala domestic installation.",
      severity: "info",
      created_at: new Date().toISOString(),
    },
  ]);

  applyDashboardView();
  showToast("Demo Mode Active", "Exploring live dashboard with simulated Kerala household bills.", "info");
}

function exitDemoMode() {
  isDemoMode = false;
  const demoBanner = document.getElementById("demoModeBanner");
  if (demoBanner) demoBanner.hidden = true;
  resetAppView();
  showToast("Exited Demo", "Returned to sign-in portal.", "info");
}

function calculateDomesticBill(units, isThreePhase = false) {
  units = Math.max(0, parseFloat(units) || 0);
  const slabsBreakdown = [];
  let energyCharge = 0;
  let fixedCharge = 0;
  let isTelescopic = true;

  if (units <= 500) {
    isTelescopic = true;
    const slabDefs = [
      { size: 80, rate: 3.50, label: "0 - 80 Units" },
      { size: 80, rate: 4.20, label: "81 - 160 Units" },
      { size: 40, rate: 4.80, label: "161 - 200 Units" },
      { size: 80, rate: 5.80, label: "201 - 280 Units" },
      { size: 20, rate: 6.60, label: "281 - 300 Units" },
      { size: 100, rate: 7.30, label: "301 - 400 Units" },
      { size: 100, rate: 8.40, label: "401 - 500 Units" },
    ];

    let remaining = units;
    for (const slab of slabDefs) {
      if (remaining <= 0) break;
      const taken = Math.min(remaining, slab.size);
      const subtotal = Math.round(taken * slab.rate * 100) / 100;
      energyCharge += subtotal;
      slabsBreakdown.push({ label: slab.label, units: taken, rate: slab.rate, subtotal });
      remaining -= taken;
    }

    if (units <= 80) fixedCharge = isThreePhase ? 180 : 70;
    else if (units <= 160) fixedCharge = isThreePhase ? 200 : 100;
    else if (units <= 200) fixedCharge = isThreePhase ? 240 : 140;
    else if (units <= 280) fixedCharge = isThreePhase ? 280 : 180;
    else if (units <= 300) fixedCharge = isThreePhase ? 300 : 200;
    else if (units <= 400) fixedCharge = isThreePhase ? 320 : 220;
    else fixedCharge = isThreePhase ? 360 : 260;
  } else {
    isTelescopic = false;
    let rate = 6.60;
    let slabLabel = "501 - 600 Units (Non-Telescopic)";
    fixedCharge = isThreePhase ? 380 : 280;

    if (units <= 600) {
      rate = 6.60;
      slabLabel = "501 - 600 Units (Non-Telescopic)";
      fixedCharge = isThreePhase ? 380 : 280;
    } else if (units <= 700) {
      rate = 7.30;
      slabLabel = "601 - 700 Units (Non-Telescopic)";
      fixedCharge = isThreePhase ? 400 : 300;
    } else if (units <= 800) {
      rate = 7.90;
      slabLabel = "701 - 800 Units (Non-Telescopic)";
      fixedCharge = isThreePhase ? 420 : 320;
    } else if (units <= 1000) {
      rate = 8.80;
      slabLabel = "801 - 1000 Units (Non-Telescopic)";
      fixedCharge = isThreePhase ? 450 : 350;
    } else {
      rate = 9.50;
      slabLabel = "Above 1000 Units (Non-Telescopic)";
      fixedCharge = isThreePhase ? 480 : 380;
    }

    energyCharge = Math.round(units * rate * 100) / 100;
    slabsBreakdown.push({ label: slabLabel, units, rate, subtotal: energyCharge });
  }

  const fuelSurcharge = Math.round(units * 0.10 * 100) / 100;
  const duty = Math.round(energyCharge * 0.10 * 100) / 100;
  const meterRent = isThreePhase ? 35 : 14;
  const otherCharges = Math.round((fuelSurcharge + duty + meterRent) * 100) / 100;
  const totalBill = Math.round((energyCharge + fixedCharge + otherCharges) * 100) / 100;
  const effectiveRate = units > 0 ? (totalBill / units).toFixed(2) : "0.00";

  return {
    units,
    isThreePhase,
    isTelescopic,
    energyCharge: Math.round(energyCharge),
    fixedCharge,
    fuelSurcharge,
    duty,
    meterRent,
    otherCharges: Math.round(otherCharges),
    totalBill: Math.round(totalBill),
    effectiveRate,
    slabsBreakdown,
  };
}

function calculateSolarNetMetering(generation, demand) {
  generation = Math.max(0, parseFloat(generation) || 0);
  demand = Math.max(0, parseFloat(demand) || 0);

  const selfConsumed = Math.round(Math.min(generation, demand * 0.45));
  const exportUnits = Math.round(Math.max(0, generation - selfConsumed));
  const importUnits = Math.round(Math.max(0, demand - selfConsumed));

  const netUnits = importUnits - exportUnits;
  const isSurplus = netUnits <= 0;
  const surplusBanked = isSurplus ? Math.abs(netUnits) : 0;
  const billedUnits = !isSurplus ? netUnits : 0;

  const baselineBill = calculateDomesticBill(demand, false).totalBill;
  const solarBill = calculateDomesticBill(billedUnits, false).totalBill;
  const estimatedSavings = Math.max(0, baselineBill - solarBill);
  const coveragePercent = demand > 0 ? Math.min(Math.round((generation / demand) * 100), 100) : 0;

  return {
    generation,
    demand,
    selfConsumed,
    exportUnits,
    importUnits,
    isSurplus,
    surplusBanked,
    billedUnits,
    estimatedSavings,
    coveragePercent,
  };
}

function setupLandingFeatures() {
  const landingTabs = document.querySelectorAll(".landing-tab");
  const landingPanes = {
    signin: document.getElementById("landingPaneSignin"),
    calculator: document.getElementById("landingPaneCalculator"),
    solar: document.getElementById("landingPaneSolar"),
    faq: document.getElementById("landingPaneFaq"),
  };

  function setLandingTab(tabKey) {
    landingTabs.forEach((tab) => {
      const isActive = tab.dataset.landingTab === tabKey;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
    });

    Object.entries(landingPanes).forEach(([key, pane]) => {
      if (pane) {
        const isActive = key === tabKey;
        pane.hidden = !isActive;
        pane.classList.toggle("is-active", isActive);
      }
    });

    if (window.location.hash !== `#${tabKey}`) {
      history.replaceState(null, "", `#${tabKey}`);
    }
  }

  landingTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setLandingTab(tab.dataset.landingTab);
    });
  });

  const initialHash = window.location.hash.replace("#", "");
  if (["signin", "calculator", "solar", "faq"].includes(initialHash)) {
    setLandingTab(initialHash);
  }

  const demoModeBtn = document.getElementById("demoModeBtn");
  const exitDemoBtn = document.getElementById("exitDemoBtn");
  demoModeBtn?.addEventListener("click", startDemoMode);
  exitDemoBtn?.addEventListener("click", exitDemoMode);

  const calcUnitsInput = document.getElementById("calcUnitsInput");
  const calcUnitsSlider = document.getElementById("calcUnitsSlider");
  const phaseSingleBtn = document.getElementById("phaseSingleBtn");
  const phaseThreeBtn = document.getElementById("phaseThreeBtn");

  function updateCalculatorFromUnits(units) {
    const isThreePhase = calcPhase === "three";
    const result = calculateDomesticBill(units, isThreePhase);

    const totalBillEl = document.getElementById("calcTotalBill");
    const effectiveRateEl = document.getElementById("calcEffectiveRate");
    const energyChargeEl = document.getElementById("calcEnergyCharge");
    const slabTypeBadgeEl = document.getElementById("calcSlabTypeBadge");
    const fixedChargeEl = document.getElementById("calcFixedCharge");
    const phaseSubEl = document.getElementById("calcPhaseSub");
    const dutySurchargeEl = document.getElementById("calcDutySurcharge");
    const alertBox = document.getElementById("calcSlabAlert");
    const alertText = document.getElementById("calcSlabAlertText");
    const tableBody = document.getElementById("calcSlabTableBody");

    if (totalBillEl) totalBillEl.textContent = `₹${result.totalBill.toLocaleString("en-IN")}`;
    if (effectiveRateEl) effectiveRateEl.textContent = `₹${result.effectiveRate} / unit effective`;
    if (energyChargeEl) energyChargeEl.textContent = `₹${result.energyCharge.toLocaleString("en-IN")}`;
    if (slabTypeBadgeEl) slabTypeBadgeEl.textContent = result.isTelescopic ? "Telescopic Slabs" : "Non-Telescopic";
    if (fixedChargeEl) fixedChargeEl.textContent = `₹${result.fixedCharge.toLocaleString("en-IN")}`;
    if (phaseSubEl) phaseSubEl.textContent = isThreePhase ? "Three Phase (3φ)" : "Single Phase (1φ)";
    if (dutySurchargeEl) dutySurchargeEl.textContent = `₹${result.otherCharges.toLocaleString("en-IN")}`;

    if (alertBox && alertText) {
      if (result.isTelescopic) {
        alertBox.className = "calc-slab-alert info";
        alertText.textContent = "Telescopic Tariff: For consumption up to 500 units bi-monthly (250 units/month), lower consumption slabs are billed at discounted progressive rates.";
      } else {
        alertBox.className = "calc-slab-alert warning";
        alertText.textContent = `⚠️ Non-Telescopic Threshold Exceeded (>500 units): All ${result.units} units are charged at a uniform flat rate without telescopic benefits.`;
      }
    }

    if (tableBody) {
      tableBody.innerHTML = result.slabsBreakdown
        .map(
          (item) => `
          <tr>
            <td>${item.label}</td>
            <td>${item.units} units</td>
            <td>₹${item.rate.toFixed(2)}</td>
            <td class="text-right">₹${item.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          </tr>`
        )
        .join("");
    }
  }

  calcUnitsInput?.addEventListener("input", (e) => {
    const val = Number(e.target.value) || 0;
    if (calcUnitsSlider) calcUnitsSlider.value = Math.min(val, 1000);
    updateCalculatorFromUnits(val);
  });

  calcUnitsSlider?.addEventListener("input", (e) => {
    const val = Number(e.target.value) || 0;
    if (calcUnitsInput) calcUnitsInput.value = val;
    updateCalculatorFromUnits(val);
  });

  phaseSingleBtn?.addEventListener("click", () => {
    calcPhase = "single";
    phaseSingleBtn.classList.add("is-active");
    phaseThreeBtn?.classList.remove("is-active");
    updateCalculatorFromUnits(Number(calcUnitsInput?.value) || 240);
  });

  phaseThreeBtn?.addEventListener("click", () => {
    calcPhase = "three";
    phaseThreeBtn.classList.add("is-active");
    phaseSingleBtn?.classList.remove("is-active");
    updateCalculatorFromUnits(Number(calcUnitsInput?.value) || 240);
  });

  updateCalculatorFromUnits(240);

  const solarGenInput = document.getElementById("solarGenInput");
  const solarDemandInput = document.getElementById("solarDemandInput");

  function updateSolarFromInputs() {
    const gen = Number(solarGenInput?.value) || 0;
    const demand = Number(solarDemandInput?.value) || 0;
    const res = calculateSolarNetMetering(gen, demand);

    const savingsEl = document.getElementById("solarSavingsVal");
    const coverageEl = document.getElementById("solarCoverageSub");
    const selfConsumedEl = document.getElementById("solarSelfConsumedVal");
    const exportEl = document.getElementById("solarExportVal");
    const netLabelEl = document.getElementById("solarNetStatusLabel");
    const netValEl = document.getElementById("solarNetUnitsVal");
    const netSubEl = document.getElementById("solarNetUnitsSub");

    if (savingsEl) savingsEl.textContent = `₹${res.estimatedSavings.toLocaleString("en-IN")}`;
    if (coverageEl) coverageEl.textContent = `${res.coveragePercent}% solar coverage`;
    if (selfConsumedEl) selfConsumedEl.textContent = `${res.selfConsumed} kWh`;
    if (exportEl) exportEl.textContent = `${res.exportUnits} kWh`;

    if (netLabelEl && netValEl && netSubEl) {
      if (res.isSurplus) {
        netLabelEl.textContent = "Banked Surplus Units";
        netValEl.textContent = `+${res.surplusBanked} kWh`;
        netSubEl.textContent = "Carried forward to next cycle";
      } else {
        netLabelEl.textContent = "Net Billed Units";
        netValEl.textContent = `${res.billedUnits} kWh`;
        netSubEl.textContent = "Payable at standard LT-1A slab rate";
      }
    }
  }

  solarGenInput?.addEventListener("input", updateSolarFromInputs);
  solarDemandInput?.addEventListener("input", updateSolarFromInputs);

  updateSolarFromInputs();
}

// Window resize handling for charts
window.addEventListener("resize", () => {
  chartInstances.forEach((chart) => chart.resize());
});

window.addEventListener("hashchange", () => {
  const hash = window.location.hash.replace("#", "");
  if (["overview", "energy", "ledger"].includes(hash) && hash !== activeTabId) {
    setActiveTab(hash);
  } else if (["signin", "calculator", "solar", "faq"].includes(hash)) {
    const targetTab = document.querySelector(`[data-landing-tab="${hash}"]`);
    if (targetTab) targetTab.click();
  }
});

// App Initialization
async function init() {
  loadSavedCredentialsIntoForm();
  renderSavedAccounts();
  setupTabs();
  setupDateRangeControls();
  setupModalListeners();
  setupLandingFeatures();

  const hash = window.location.hash.replace("#", "");
  if (["overview", "energy", "ledger"].includes(hash)) {
    activeTabId = hash;
  }

  try {
    await loadDashboard({
      loading: {
        control: null,
      },
    });
  } catch {
    setAuthedView(false);
  }
}

init();

