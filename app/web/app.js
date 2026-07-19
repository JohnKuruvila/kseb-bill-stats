const flashEl = document.getElementById("flash");
const loadingStateEl = document.getElementById("loadingState");
const loadingTitleEl = document.getElementById("loadingTitle");
const loadingDetailEl = document.getElementById("loadingDetail");
const chartStatusBannerEl = document.getElementById("chartStatusBanner");
const authCard = document.getElementById("authCard");
const appPanel = document.getElementById("appPanel");
const landingEl = document.getElementById("landing");
const seoLoginSection = document.getElementById("seo-login-section");

function setAuthedView(isAuthed) {
  document.body.classList.toggle("is-authed", isAuthed);
  if (landingEl) {
    landingEl.hidden = isAuthed;
  }
  if (authCard) {
    authCard.hidden = isAuthed;
  }
  if (appPanel) {
    appPanel.hidden = !isAuthed;
  }
  if (seoLoginSection) {
    seoLoginSection.hidden = isAuthed;
  }
}
const loginForm = document.getElementById("loginForm");
const consumerNumberInput = document.getElementById("consumerNumber");
const mobileNumberInput = document.getElementById("mobileNumber");
const loginSubmitButton = loginForm?.querySelector('button[type="submit"]') || null;
const uploadForm = document.getElementById("uploadForm");
const uploadInput = document.getElementById("uploadInput");
const uploadSubmitButton = uploadForm?.querySelector('button[type="submit"]') || null;
const pushButton = document.getElementById("pushButton");
const syncButton = document.getElementById("syncButton");
const exportButton = document.getElementById("exportButton");
const deleteButton = document.getElementById("deleteButton");
const logoutButton = document.getElementById("logoutButton");
const identityTitle = document.getElementById("identityTitle");
const identityMeta = document.getElementById("identityMeta");
const moreMenuButton = document.getElementById("moreMenuButton");
const moreMenu = document.getElementById("moreMenu");
const uploadMenuButton = document.getElementById("uploadMenuButton");
const notificationsMenuButton = document.getElementById("notificationsMenuButton");
const notificationsPanel = document.getElementById("notificationsPanel");
const closeNotificationsButton = document.getElementById("closeNotificationsButton");
const customRangeRow = document.getElementById("customRangeRow");
const rangeFromInput = document.getElementById("rangeFrom");
const rangeToInput = document.getElementById("rangeTo");
const applyCustomRangeButton = document.getElementById("applyCustomRange");
const rangeSummaryEl = document.getElementById("rangeSummary");
const ledgerCardsEl = document.getElementById("ledgerCards");

const CREDENTIALS_STORAGE_KEYS = {
  consumerNumber: "ksebBillStats.consumerNumber",
  mobileNumber: "ksebBillStats.mobileNumber",
  accounts: "ksebBillStats.accounts",
};
const DATE_RANGE_STORAGE_KEY = "ksebBillStats.dateRange";
const MAX_SAVED_ACCOUNTS = 10;
const savedAccountsEl = document.getElementById("savedAccounts");
const savedAccountsListEl = document.getElementById("savedAccountsList");

function normalizeDigitsForStorage(value) {
  // Persist digits only so autofill behaves consistently even if the user types spaces/dashes.
  return String(value ?? "").replace(/\D/g, "");
}

function maskAccountDigits(value, visible = 4) {
  const digits = normalizeDigitsForStorage(value);
  if (!digits) {
    return "";
  }
  if (digits.length <= visible) {
    return digits;
  }
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

    // Migrate the older single-pair keys into the multi-account list.
    const legacyConsumer = normalizeDigitsForStorage(
      window.localStorage.getItem(CREDENTIALS_STORAGE_KEYS.consumerNumber),
    );
    const legacyMobile = normalizeDigitsForStorage(
      window.localStorage.getItem(CREDENTIALS_STORAGE_KEYS.mobileNumber),
    );
    if (legacyConsumer && legacyMobile) {
      const migrated = [
        {
          consumerNumber: legacyConsumer,
          mobileNumber: legacyMobile,
          lastUsedAt: Date.now(),
        },
      ];
      writeSavedAccounts(migrated);
      return migrated;
    }
  } catch {
    // localStorage might be blocked (privacy mode, tracking protection, etc).
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
    // Ignore storage failures; the sign-in flow should still work.
  }
}

function fillCredentialsForm(consumerNumber, mobileNumber) {
  if (!consumerNumberInput || !mobileNumberInput) {
    return;
  }
  consumerNumberInput.value = normalizeDigitsForStorage(consumerNumber);
  mobileNumberInput.value = normalizeDigitsForStorage(mobileNumber);
}

function loadSavedCredentialsIntoForm() {
  if (!consumerNumberInput || !mobileNumberInput) {
    return;
  }
  const accounts = readSavedAccounts();
  const latest = accounts[0];
  if (!latest) {
    return;
  }
  if (!consumerNumberInput.value) {
    consumerNumberInput.value = latest.consumerNumber;
  }
  if (!mobileNumberInput.value) {
    mobileNumberInput.value = latest.mobileNumber;
  }
}

function persistCredentialsFromForm() {
  if (!consumerNumberInput || !mobileNumberInput) {
    return;
  }
  const consumer = normalizeDigitsForStorage(consumerNumberInput.value);
  const mobile = normalizeDigitsForStorage(mobileNumberInput.value);
  if (!consumer || !mobile) {
    return;
  }

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
  if (!savedAccountsEl || !savedAccountsListEl) {
    return;
  }
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
    row.className = "saved-account-row";

    const useButton = document.createElement("button");
    useButton.type = "button";
    useButton.className = "saved-account-use";
    useButton.textContent = `${maskAccountDigits(account.consumerNumber)} · ${maskAccountDigits(account.mobileNumber)}`;
    useButton.title = "Fill this account into the form";
    useButton.addEventListener("click", () => {
      fillCredentialsForm(account.consumerNumber, account.mobileNumber);
      consumerNumberInput?.focus();
    });

    const forgetButton = document.createElement("button");
    forgetButton.type = "button";
    forgetButton.className = "ghost saved-account-forget";
    forgetButton.setAttribute("aria-label", "Forget this saved account");
    forgetButton.textContent = "Forget";
    forgetButton.addEventListener("click", () => {
      const label = `${maskAccountDigits(account.consumerNumber)} · ${maskAccountDigits(account.mobileNumber)}`;
      const confirmed = window.confirm(`Forget saved account ${label} on this device?`);
      if (!confirmed) {
        return;
      }
      removeSavedAccount(account.consumerNumber, account.mobileNumber);
    });

    row.append(useButton, forgetButton);
    savedAccountsListEl.append(row);
  }
}

loadSavedCredentialsIntoForm();
renderSavedAccounts();

const CHART_ELEMENT_IDS = ["trendChart", "importVsSolarChart", "flowChart", "performanceChart"];
const chartInstances = new Map();
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

const DEFAULT_LOADING_COPY = {
  title: "Fetching your latest bills",
  detail: "This can take a few seconds during your first sign-in.",
};
const DASHBOARD_LOADING_COPY = {
  title: "Refreshing your dashboard",
  detail: "Pulling together your latest bills, sync status, and stored files.",
};

let activeTabId = "overview";
let currentBills = [];
let filteredBills = [];
let dateRangeState = loadDateRangeState();
let activeLoadingControl = null;
let activeLoadingLabel = "";

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
    // Ignore storage failures.
  }
  return { preset: "3m", from: "", to: "" };
}

function persistDateRangeState() {
  try {
    window.localStorage.setItem(DATE_RANGE_STORAGE_KEY, JSON.stringify(dateRangeState));
  } catch {
    // Ignore storage failures.
  }
}

function parseInputDate(value) {
  if (!value) {
    return null;
  }
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
    if (state.from && !from) {
      return { from: null, to: null, label: "Invalid from date" };
    }
    if (state.to && !to) {
      return { from: null, to: null, label: "Invalid to date" };
    }
    if (from && to && from > to) {
      return { from: null, to: null, label: "From date must be on or before to date" };
    }
    const parts = [];
    if (from) parts.push(`from ${formatDate(toInputDate(from))}`);
    if (to) parts.push(`to ${formatDate(toInputDate(to))}`);
    return {
      from,
      to,
      label: parts.length ? `Showing ${parts.join(" ")}` : "Choose a custom date range",
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
    if (!billDate) {
      return false;
    }
    const day = startOfDay(billDate);
    if (bounds.from && day < bounds.from) {
      return false;
    }
    if (bounds.to && day > bounds.to) {
      return false;
    }
    return true;
  });
  return { bills: filtered, bounds };
}

function setFlash(message, tone = "success") {
  if (!flashEl) {
    return;
  }
  let text = "";
  if (typeof message === "string") {
    text = message;
  } else if (message) {
    try {
      text = JSON.stringify(message);
    } catch {
      text = String(message);
    }
  }

  flashEl.hidden = !text;
  flashEl.textContent = text;
  flashEl.className = `flash ${tone}`;
}

function setStatus(message, tone = "info") {
  if (!chartStatusBannerEl) {
    return;
  }
  chartStatusBannerEl.hidden = !message;
  chartStatusBannerEl.textContent = message || "";
  chartStatusBannerEl.className = "status-banner";
  if (message && tone !== "info") {
    chartStatusBannerEl.classList.add(`is-${tone}`);
  }
}

function setLoadingState(
  active,
  {
    title = DEFAULT_LOADING_COPY.title,
    detail = DEFAULT_LOADING_COPY.detail,
    control = null,
    busyLabel = "",
  } = {},
) {
  if (!loadingStateEl || !loadingTitleEl || !loadingDetailEl) {
    return;
  }
  loadingStateEl.hidden = !active;
  loadingTitleEl.textContent = title;
  loadingDetailEl.textContent = detail;

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

function formatCurrency(value, digits = 0) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function formatUnits(value, digits = 0) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return `${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)} kWh`;
}

function formatPercent(value, digits = 0) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return `${(value * 100).toFixed(digits)}%`;
}

function formatDate(value) {
  if (!value) {
    return "-";
  }
  const date = value instanceof Date ? value : parseInputDate(value) || new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
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
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return numeric < 0 ? 0 : numeric;
}

function sumNumbers(values) {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

function isChargeBreakdownConsistent(totalAmount, fixedCharge, energyCharge, taxAndRent) {
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return false;
  }
  const components = [fixedCharge, energyCharge, taxAndRent].filter(Number.isFinite);
  if (!components.length) {
    return false;
  }
  const tolerance = Math.max(50, totalAmount * 0.2);
  return sumNumbers(components) <= totalAmount + tolerance;
}

function average(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? sumNumbers(valid) / valid.length : null;
}

function maxBy(items, selector) {
  return items.reduce((best, item) => {
    const value = selector(item);
    if (!Number.isFinite(value)) {
      return best;
    }
    if (!best || value > selector(best)) {
      return item;
    }
    return best;
  }, null);
}

function minBy(items, selector) {
  return items.reduce((best, item) => {
    const value = selector(item);
    if (!Number.isFinite(value)) {
      return best;
    }
    if (!best || value < selector(best)) {
      return item;
    }
    return best;
  }, null);
}

function setMetric(id, value, metaId, meta) {
  const valueEl = document.getElementById(id);
  const metaEl = document.getElementById(metaId);
  if (valueEl) {
    valueEl.textContent = value;
  }
  if (metaEl) {
    metaEl.textContent = meta;
  }
}

function describeBill(bill, formatter, fallback) {
  return bill ? formatter(bill) : fallback;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(extractApiErrorMessage(data) || `Request failed (${response.status}).`);
  }
  return data;
}

function safeStringify(value) {
  if (value === null) return "null";
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
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

    return messages.length ? messages.join("; ") : safeStringify(detail);
  }

  if (detail && typeof detail === "object") {
    return safeStringify(detail.msg || detail.message || detail);
  }

  return safeStringify(detail);
}

function extractApiErrorMessage(data) {
  if (data && typeof data === "object") {
    if ("detail" in data) {
      return extractDetailMessage(data.detail);
    }
    if ("message" in data) {
      return safeStringify(data.message);
    }
    return safeStringify(data);
  }
  return safeStringify(data);
}

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
  const electricityDuty = toNumber(bill.electricity_duty);
  const meterRent = toNumber(bill.meter_rent);
  const derivedTaxAndRent =
    Number.isFinite(electricityDuty) || Number.isFinite(meterRent)
      ? +sumNumbers([electricityDuty, meterRent]).toFixed(2)
      : null;
  const taxAndRent = toNonNegativeMoney(toNumber(bill.tax_and_rent) ?? derivedTaxAndRent);
  const fixedCharge = toNonNegativeMoney(bill.fixed_charge);
  const energyCharge = toNonNegativeMoney(bill.energy_charge);
  const isConsistentFromClient = isChargeBreakdownConsistent(bill.total_amount, fixedCharge, energyCharge, taxAndRent);
  const chargeBreakdownValid = bill.charge_breakdown_valid === false ? false : isConsistentFromClient;
  const otherCharges =
    chargeBreakdownValid
      ? toNonNegativeMoney(bill.other_charges) ??
        (Number.isFinite(fixedCharge) ||
        Number.isFinite(energyCharge) ||
        Number.isFinite(electricityDuty) ||
        Number.isFinite(meterRent)
          ? toNonNegativeMoney(+(bill.total_amount - sumNumbers([fixedCharge, energyCharge, taxAndRent])).toFixed(2))
          : null)
      : null;
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
    fixedCharge: chargeBreakdownValid ? fixedCharge : null,
    energyCharge: chargeBreakdownValid ? energyCharge : null,
    electricityDuty,
    meterRent,
    taxAndRent: chargeBreakdownValid && Number.isFinite(taxAndRent) ? +taxAndRent.toFixed(2) : null,
    otherCharges,
    chargeBreakdownValid,
    costPerHomeUnit,
    normalizedTotalAmount: toNumber(bill.normalized_total_amount),
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
  const costPerUnitValues = bills.map((bill) => bill.costPerHomeUnit).filter(Number.isFinite);

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
    lowestCostPerUnitBill: minBy(bills, (bill) => bill.costPerHomeUnit),
    highestCostPerUnitBill: maxBy(bills, (bill) => bill.costPerHomeUnit),
    avgCostPerUnit: average(costPerUnitValues),
  };
}

function buildInsights(summary) {
  const insights = [];

  if (summary.lowestBill && summary.highestBill) {
    insights.push({
      kicker: "Lowest bill",
      text: `${summary.lowestBill.label} came in at ${formatCurrency(summary.lowestBill.total_amount)}, while the peak month was ${summary.highestBill.label} at ${formatCurrency(summary.highestBill.total_amount)}.`,
    });
  }

  if (summary.bestCoverage) {
    insights.push({
      kicker: "Strongest solar share",
      text: `${summary.bestCoverage.label} met ${formatPercent(summary.bestCoverage.solarCoverage, 1)} of home demand directly from on-site solar.`,
    });
  }

  if (summary.highestDemand) {
    insights.push({
      kicker: "Highest demand",
      text: `${summary.highestDemand.label} recorded ${formatUnits(summary.highestDemand.homeDemand)} of household demand.`,
    });
  }

  if (insights.length < 3 && summary.highestSolarGenerationMonth) {
    insights.push({
      kicker: "Strongest solar generation",
      text: `${summary.highestSolarGenerationMonth.label} generated ${formatUnits(summary.highestSolarGenerationMonth.solarGeneration)}, with ${formatUnits(summary.highestSolarGenerationMonth.solarSelfUsed)} used on site.`,
    });
  }

  if (insights.length) {
    return insights.slice(0, 3);
  }

  return [
    {
      kicker: "Waiting for more data",
      text: "Not enough complete data in this date range to surface highlights.",
    },
  ];
}

function renderInsights(insights) {
  const container = document.getElementById("insightList");
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
  const list = document.getElementById("notificationList");
  if (!notifications.length) {
    list.innerHTML = '<div class="stack-item muted">No notification events yet. A new bill fetch will appear here.</div>';
    return;
  }

  list.replaceChildren(
    ...notifications.map((item) => {
      const node = document.createElement("div");
      node.className = "stack-item";

      const title = document.createElement("strong");
      title.textContent = item.title;

      const body = document.createElement("div");
      body.textContent = item.body;

      const meta = document.createElement("div");
      meta.className = "stack-meta";
      meta.textContent = `${formatDate(item.created_at)} • ${item.status}`;

      node.append(title, body, meta);
      return node;
    }),
  );
}

function renderLedger(bills) {
  const body = document.getElementById("ledgerBody");
  const emptyMessage =
    currentBills.length && !bills.length
      ? "No bills in this date range. Try a wider range."
      : "No parsed bills available yet. Fetch the latest bill or upload historical PDFs.";

  if (ledgerCardsEl) {
    if (!bills.length) {
      ledgerCardsEl.innerHTML = `<div class="ledger-card muted">${emptyMessage}</div>`;
    } else {
      ledgerCardsEl.replaceChildren(
        ...bills.map((bill) => {
          const card = document.createElement("article");
          card.className = "ledger-card";
          card.innerHTML = `
            <div class="ledger-card-top">
              <div class="ledger-card-date">${formatDate(bill.bill_date)}</div>
              <div class="ledger-card-amount">${formatCurrency(bill.total_amount)}</div>
            </div>
            <div class="ledger-card-grid">
              <div><span>Import</span><strong>${formatUnits(bill.unitsImported)}</strong></div>
              <div><span>Solar share</span><strong>${formatPercent(bill.solarCoverage, 1)}</strong></div>
              <div><span>Solar</span><strong>${formatUnits(bill.solarGeneration)}</strong></div>
              <div><span>Cost / unit</span><strong>${formatCurrency(bill.costPerHomeUnit, 2)}</strong></div>
            </div>
          `;
          return card;
        }),
      );
    }
  }

  if (!body) {
    return;
  }

  if (!bills.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.className = "muted";
    cell.textContent = emptyMessage;
    row.appendChild(cell);
    body.replaceChildren(row);
    return;
  }

  body.replaceChildren(
    ...bills.map((bill) => {
      const row = document.createElement("tr");
      const values = [
        formatDate(bill.bill_date),
        formatCurrency(bill.total_amount),
        formatUnits(bill.unitsImported),
        formatUnits(bill.unitsExported),
        formatUnits(bill.solarGeneration),
        formatUnits(bill.homeDemand),
        formatCurrency(bill.costPerHomeUnit, 2),
      ];

      values.forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });

      return row;
    }),
  );
}

function renderSummary(summary, bills) {
  const hasBills = bills.length > 0;
  const emptyMeta = currentBills.length
    ? "No bills in this date range."
    : "Waiting for parsed bills to calculate totals.";

  setMetric(
    "totalSpend",
    hasBills ? formatCurrency(summary.totalSpend) : "-",
    "totalSpendMeta",
    hasBills ? `${formatCurrency(summary.avgBill)} average across ${bills.length} bills.` : emptyMeta,
  );
  setMetric(
    "avgBill",
    hasBills ? formatCurrency(summary.avgBill) : "-",
    "avgBillMeta",
    describeBill(
      summary.lowestBill,
      (bill) => `${bill.label} was the lowest at ${formatCurrency(bill.total_amount)}.`,
      emptyMeta,
    ),
  );
  setMetric(
    "totalDemand",
    hasBills ? formatUnits(summary.totalHomeDemand) : "-",
    "totalDemandMeta",
    describeBill(
      summary.highestDemand,
      (bill) => `${bill.label} had the highest demand at ${formatUnits(bill.homeDemand)}.`,
      emptyMeta,
    ),
  );
  setMetric(
    "solarCoverage",
    hasBills ? formatPercent(summary.avgCoverage, 1) : "-",
    "solarCoverageMeta",
    describeBill(
      summary.bestCoverage,
      (bill) => `${bill.label} met ${formatPercent(bill.solarCoverage, 1)} of demand from solar.`,
      emptyMeta,
    ),
  );

  const peakValue = document.getElementById("overviewSolarPeakValue");
  const peakMeta = document.getElementById("overviewSolarPeakMeta");
  const useValue = document.getElementById("overviewSolarUseValue");
  const useMeta = document.getElementById("overviewSolarUseMeta");
  const latestValue = document.getElementById("overviewSolarLatestValue");
  const latestMeta = document.getElementById("overviewSolarLatestMeta");

  if (peakValue) {
    peakValue.textContent = summary.highestSolarGenerationMonth
      ? summary.highestSolarGenerationMonth.label
      : "-";
  }
  if (peakMeta) {
    peakMeta.textContent = summary.highestSolarGenerationMonth
      ? `${formatUnits(summary.highestSolarGenerationMonth.solarGeneration)} generated, with ${formatUnits(summary.highestSolarGenerationMonth.solarSelfUsed)} self-used.`
      : emptyMeta;
  }
  if (useValue) {
    useValue.textContent = hasBills ? formatPercent(summary.solarSelfUseShare, 1) : "-";
  }
  if (useMeta) {
    useMeta.textContent = Number.isFinite(summary.avgSolarGeneration)
      ? `${formatUnits(summary.avgSolarGeneration)} average solar generation per cycle.`
      : emptyMeta;
  }
  if (latestValue) {
    latestValue.textContent = summary.latestBill
      ? formatUnits(summary.latestBill.solarGeneration)
      : "-";
  }
  if (latestMeta) {
    latestMeta.textContent =
      summary.latestBill && Number.isFinite(summary.latestBill.solarSelfUsed)
        ? `${summary.latestBill.label} self-used ${formatUnits(summary.latestBill.solarSelfUsed)} and sent ${formatUnits(summary.latestBill.unitsExported)} to the grid.`
        : emptyMeta;
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
      ? `Latest bill ${billDelta >= 0 ? "up" : "down"} ${formatCurrency(Math.abs(billDelta))} vs previous`
      : "Tracking month-on-month movement";
  }

  const ledgerBadge = document.getElementById("ledgerBadge");
  if (ledgerBadge) {
    ledgerBadge.textContent = `${bills.length} bill${bills.length === 1 ? "" : "s"}`;
  }
}

function renderChartFallback(message) {
  CHART_ELEMENT_IDS.forEach((id) => {
    const element = document.getElementById(id);
    element.replaceChildren();
    element.classList.add("chart-empty");
    element.textContent = message;
  });
}

function clearChartFallback() {
  CHART_ELEMENT_IDS.forEach((id) => {
    const element = document.getElementById(id);
    element.classList.remove("chart-empty");
    if (!element.childElementCount) {
      element.textContent = "";
    }
  });
}

function resetCharts() {
  chartInstances.forEach((chart) => chart.dispose());
  chartInstances.clear();
}

function ensureTabCharts(tabId) {
  if (!window.echarts || !filteredBills.length) {
    return;
  }

  for (const [chartId, builder] of TAB_CHART_BUILDERS[tabId] || []) {
    if (!chartInstances.has(chartId)) {
      chartInstances.set(chartId, builder(filteredBills));
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
      renderChartFallback("No parsed bills available yet. Fetch or upload PDFs to populate the graphs.");
    }
    setActiveTab(activeTabId);
    return;
  }

  if (!filteredBills.length) {
    setStatus(bounds.label.includes("Invalid") || bounds.label.includes("must be")
      ? bounds.label
      : "No bills match this date range. Try a wider range or All.", "warning");
    if (rebuildCharts) {
      resetCharts();
      renderChartFallback("No bills in this date range.");
    }
    setActiveTab(activeTabId);
    return;
  }

  if (!window.echarts) {
    setStatus(
      "The dashboard data loaded, but charts are unavailable because ECharts could not be loaded from the CDN.",
      "warning",
    );
    if (rebuildCharts) {
      resetCharts();
      renderChartFallback("Charts are unavailable because ECharts could not be loaded from the CDN.");
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
  dateRangeState = {
    ...dateRangeState,
    preset,
  };
  if (preset !== "custom") {
    dateRangeState.from = "";
    dateRangeState.to = "";
  } else if (!dateRangeState.from && !dateRangeState.to && currentBills.length) {
    const dates = currentBills.map(parseBillDate).filter(Boolean).sort((a, b) => a - b);
    if (dates.length) {
      dateRangeState.from = toInputDate(dates[0]);
      dateRangeState.to = toInputDate(dates[dates.length - 1]);
    }
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

function closeMoreMenu() {
  if (!moreMenu || !moreMenuButton) {
    return;
  }
  moreMenu.hidden = true;
  moreMenuButton.setAttribute("aria-expanded", "false");
}

function setupMoreMenu() {
  if (!moreMenuButton || !moreMenu) {
    return;
  }

  moreMenuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = moreMenu.hidden;
    moreMenu.hidden = !willOpen;
    moreMenuButton.setAttribute("aria-expanded", String(willOpen));
  });

  document.addEventListener("click", (event) => {
    if (!moreMenu.hidden && !moreMenu.contains(event.target) && event.target !== moreMenuButton) {
      closeMoreMenu();
    }
  });

  uploadMenuButton?.addEventListener("click", () => {
    closeMoreMenu();
    if (uploadForm) {
      uploadForm.hidden = !uploadForm.hidden;
      if (!uploadForm.hidden) {
        uploadInput?.focus();
      }
    }
  });

  notificationsMenuButton?.addEventListener("click", () => {
    closeMoreMenu();
    if (notificationsPanel) {
      notificationsPanel.hidden = false;
      notificationsPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  closeNotificationsButton?.addEventListener("click", () => {
    if (notificationsPanel) {
      notificationsPanel.hidden = true;
    }
  });

  [pushButton, exportButton, deleteButton, logoutButton].forEach((button) => {
    button?.addEventListener("click", () => closeMoreMenu(), true);
  });
}

function setupDateRangeControls() {
  document.querySelectorAll("[data-range-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      setDateRangePreset(button.dataset.rangePreset);
    });
  });

  applyCustomRangeButton?.addEventListener("click", () => {
    applyCustomDateRange();
  });

  syncDateRangeControls();
}

function setActiveTab(tabId) {
  activeTabId = tabId;

  document.querySelectorAll("[data-tab]").forEach((button) => {
    const isActive = button.dataset.tab === tabId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  });

  document.querySelectorAll("[data-panel]").forEach((panel) => {
    const isActive = panel.dataset.panel === tabId;
    panel.hidden = !isActive;
    panel.tabIndex = isActive ? 0 : -1;
  });

  ensureTabCharts(tabId);

  requestAnimationFrame(() => {
    for (const [chartId] of TAB_CHART_BUILDERS[tabId] || []) {
      const chart = chartInstances.get(chartId);
      if (chart) {
        chart.resize();
      }
    }
  });
}

function setupTabs() {
  const tabs = Array.from(document.querySelectorAll("[data-tab]"));
  tabs.forEach((button, index) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.tab));
    button.addEventListener("keydown", (event) => {
      let targetIndex = null;

      if (event.key === "ArrowRight") {
        targetIndex = (index + 1) % tabs.length;
      } else if (event.key === "ArrowLeft") {
        targetIndex = (index - 1 + tabs.length) % tabs.length;
      } else if (event.key === "Home") {
        targetIndex = 0;
      } else if (event.key === "End") {
        targetIndex = tabs.length - 1;
      }

      if (targetIndex === null) {
        return;
      }

      event.preventDefault();
      const targetTab = tabs[targetIndex];
      setActiveTab(targetTab.dataset.tab);
      targetTab.focus();
    });
  });
}

const TREND_SPLIT_LINE = { lineStyle: { color: "rgba(255,255,255,0.06)" } };

function syncTrendChartGrid(chart, selected = {}) {
  const billVisible = selected["Bill amount"] !== false;
  chart.setOption({
    yAxis: [
      { splitLine: { ...TREND_SPLIT_LINE, show: billVisible } },
      { splitLine: { ...TREND_SPLIT_LINE, show: !billVisible } },
    ],
  });
}

function buildTrendChart(bills) {
  const chart = window.echarts.init(document.getElementById("trendChart"));
  chart.setOption({
    backgroundColor: "transparent",
    animationDuration: 700,
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(7, 17, 31, 0.96)",
      borderColor: "rgba(255,255,255,0.1)",
      textStyle: { color: "#eef5ff" },
    },
    legend: { top: 0, textStyle: { color: "#9db0ca" } },
    grid: { left: 14, right: 20, top: 48, bottom: 18, containLabel: true },
    xAxis: {
      type: "category",
      data: bills.map((bill) => bill.label),
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.12)" } },
      axisLabel: { color: "#9db0ca" },
    },
    yAxis: [
      {
        type: "value",
        name: "INR",
        axisLabel: { color: "#9db0ca" },
        splitLine: { ...TREND_SPLIT_LINE, show: true },
      },
      {
        type: "value",
        name: "kWh",
        axisLabel: { color: "#9db0ca" },
        splitLine: { ...TREND_SPLIT_LINE, show: false },
      },
    ],
    series: [
      {
        name: "Bill amount",
        type: "bar",
        yAxisIndex: 0,
        barWidth: 24,
        itemStyle: {
          color: new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "#4f8cff" },
            { offset: 1, color: "#2351c7" },
          ]),
          borderRadius: [10, 10, 0, 0],
        },
        data: bills.map((bill) => bill.total_amount),
      },
      {
        name: "Home demand",
        type: "line",
        yAxisIndex: 1,
        smooth: true,
        symbolSize: 8,
        itemStyle: { color: "#34d7ff" },
        lineStyle: { width: 3, color: "#34d7ff" },
        areaStyle: {
          color: new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(52, 215, 255, 0.32)" },
            { offset: 1, color: "rgba(52, 215, 255, 0.02)" },
          ]),
        },
        data: bills.map((bill) => bill.homeDemand),
      },
      {
        name: "Solar generated",
        type: "line",
        yAxisIndex: 1,
        smooth: true,
        symbolSize: 7,
        itemStyle: { color: "#55d69e" },
        lineStyle: { width: 2.5, color: "#55d69e" },
        data: bills.map((bill) => bill.solarGeneration),
      },
    ],
  });
  chart.on("legendselectchanged", (event) => {
    syncTrendChartGrid(chart, event.selected);
  });
  return chart;
}

function buildImportVsSolarChart(bills) {
  const chart = window.echarts.init(document.getElementById("importVsSolarChart"));
  const imported = bills.map((bill) => bill.unitsImported ?? 0);
  const solar = bills.map((bill) => bill.solarGeneration ?? 0);
  const maxValue = Math.max(0, ...imported, ...solar);
  const axisLimit = maxValue ? Math.ceil((maxValue * 1.15) / 50) * 50 : 100;

  chart.setOption({
    backgroundColor: "transparent",
    animationDuration: 700,
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(7, 17, 31, 0.96)",
      borderColor: "rgba(255,255,255,0.1)",
      textStyle: { color: "#eef5ff" },
    },
    legend: { top: 0, textStyle: { color: "#9db0ca" } },
    grid: { left: 14, right: 20, top: 48, bottom: 18, containLabel: true },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: bills.map((bill) => bill.label),
      axisTick: { show: false },
      axisLabel: { color: "#9db0ca" },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.12)" } },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: axisLimit,
      axisLabel: { color: "#9db0ca", formatter: (value) => formatAxisNumber(value) },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
    },
    series: [
      {
        name: "KSEB import",
        type: "line",
        smooth: true,
        symbolSize: 8,
        itemStyle: { color: "#4f8cff" },
        lineStyle: { width: 3, color: "#4f8cff" },
        areaStyle: {
          color: new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(79, 140, 255, 0.32)" },
            { offset: 1, color: "rgba(79, 140, 255, 0.02)" },
          ]),
        },
        data: imported,
      },
      {
        name: "Solar produced",
        type: "line",
        smooth: true,
        symbolSize: 7,
        itemStyle: { color: "#ffbf5f" },
        lineStyle: { width: 2.5, color: "#ffbf5f" },
        areaStyle: {
          color: new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(255, 191, 95, 0.32)" },
            { offset: 1, color: "rgba(255, 191, 95, 0.02)" },
          ]),
        },
        data: solar,
      },
    ],
  });
  return chart;
}

function buildFlowChart(bills) {
  const chart = window.echarts.init(document.getElementById("flowChart"));
  const maxValue = Math.max(
    0,
    ...bills.map((bill) => bill.homeDemand ?? 0),
    ...bills.map((bill) => bill.solarGeneration ?? 0),
    ...bills.map((bill) => bill.unitsExported ?? 0),
  );
  const axisLimit = maxValue ? Math.ceil((maxValue * 1.18) / 50) * 50 : 100;

  chart.setOption({
    backgroundColor: "transparent",
    animationDuration: 700,
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(7, 17, 31, 0.96)",
      borderColor: "rgba(255,255,255,0.1)",
      textStyle: { color: "#eef5ff" },
    },
    legend: { top: 0, textStyle: { color: "#9db0ca" } },
    grid: { left: 12, right: 20, top: 52, bottom: 18, containLabel: true },
    xAxis: {
      type: "category",
      data: bills.map((bill) => bill.label),
      axisTick: { show: false },
      axisLabel: { color: "#9db0ca", rotate: 18 },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.12)" } },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: axisLimit,
      axisLabel: { color: "#9db0ca", formatter: (value) => formatAxisNumber(value) },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
    },
    series: [
      {
        name: "Solar self-used",
        type: "bar",
        stack: "demand",
        barMaxWidth: 30,
        itemStyle: {
          color: new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "#7ff0ba" },
            { offset: 1, color: "#3db683" },
          ]),
        },
        data: bills.map((bill) => bill.solarSelfUsed),
      },
      {
        name: "KSEB import",
        type: "bar",
        stack: "demand",
        barMaxWidth: 30,
        itemStyle: {
          color: new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "#7cb0ff" },
            { offset: 1, color: "#3267ea" },
          ]),
        },
        data: bills.map((bill) => bill.unitsImported),
      },
      {
        name: "Solar to grid",
        type: "bar",
        barMaxWidth: 30,
        itemStyle: {
          color: new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "#ff9faa" },
            { offset: 1, color: "#ef6373" },
          ]),
        },
        data: bills.map((bill) => bill.unitsExported),
      },
      {
        name: "Solar generated",
        type: "line",
        smooth: true,
        symbolSize: 7,
        itemStyle: { color: "#ffd36f" },
        lineStyle: { width: 2.5, color: "#ffd36f" },
        data: bills.map((bill) => bill.solarGeneration),
      },
    ],
  });
  return chart;
}

function buildPerformanceChart(bills) {
  const chart = window.echarts.init(document.getElementById("performanceChart"));
  chart.setOption({
    backgroundColor: "transparent",
    animationDuration: 700,
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(7, 17, 31, 0.96)",
      borderColor: "rgba(255,255,255,0.1)",
      textStyle: { color: "#eef5ff" },
    },
    legend: { top: 0, textStyle: { color: "#9db0ca" } },
    grid: { left: 14, right: 20, top: 44, bottom: 18, containLabel: true },
    xAxis: {
      type: "category",
      data: bills.map((bill) => bill.label),
      axisLabel: { color: "#9db0ca" },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.12)" } },
    },
    yAxis: [
      {
        type: "value",
        name: "Coverage %",
        axisLabel: { color: "#9db0ca", formatter: (value) => `${value}%` },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
      },
      {
        type: "value",
        name: "INR / kWh",
        axisLabel: { color: "#9db0ca" },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: "Demand met by solar",
        type: "line",
        smooth: true,
        symbolSize: 8,
        itemStyle: { color: "#55d69e" },
        lineStyle: { width: 3, color: "#55d69e" },
        data: bills.map((bill) =>
          Number.isFinite(bill.solarCoverage) ? +(bill.solarCoverage * 100).toFixed(1) : null,
        ),
      },
      {
        name: "Cost per home unit",
        type: "line",
        yAxisIndex: 1,
        smooth: true,
        symbolSize: 7,
        itemStyle: { color: "#ffbf5f" },
        lineStyle: { width: 2.5, color: "#ffbf5f" },
        data: bills.map((bill) => (Number.isFinite(bill.costPerHomeUnit) ? bill.costPerHomeUnit : null)),
      },
    ],
  });
  return chart;
}

async function loadDashboard({ loading = null } = {}) {
  const load = async () => {
    const [me, dashboard] = await Promise.all([api("/api/me"), api("/api/dashboard")]);

    currentBills = (dashboard.trend || []).map(normalizeTrendBill);

    setAuthedView(true);
    identityTitle.textContent = `${me.masked_consumer_number} • ${me.masked_mobile_number}`;
    identityMeta.textContent = "This session is isolated to your own customer data.";

    renderNotifications(dashboard.notifications || []);
    applyDashboardView();

    if (!currentBills.length) {
      setStatus(
        "Sign-in succeeded, but no parsed bills are available yet. Fetch the latest bill or upload older PDFs to repopulate the restored charts.",
        "warning",
      );
    }
  };

  if (loading) {
    return runWithLoading(loading, load);
  }

  return load();
}

async function enablePushNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("This browser does not support push notifications.");
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
  if (uploadForm) {
    uploadForm.hidden = true;
  }
  if (notificationsPanel) {
    notificationsPanel.hidden = true;
  }
  closeMoreMenu();
  renderSavedAccounts();
}

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setFlash("");
  try {
    await runWithLoading(
      {
        title: "Fetching your latest bills",
        detail: "Signing in to KSEB and loading your restored private dashboard.",
        control: loginSubmitButton,
        busyLabel: "Loading your dashboard...",
      },
      async () => {
        // Save what the user entered so the next visit can pre-fill the form.
        // Backend will still validate and normalize before authentication.
        persistCredentialsFromForm();
        await api("/api/session", {
          method: "POST",
          body: JSON.stringify({
            consumer_number: consumerNumberInput.value,
            mobile_number: mobileNumberInput.value,
          }),
        });
        setFlash("Sign-in successful. Loading your private dashboard.");
        await loadDashboard();
      },
    );
    setFlash("Sign-in successful. Loading your private dashboard.");
  } catch (error) {
    setFlash(error.message, "error");
  }
  });
}

if (uploadForm && uploadInput) {
  uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setFlash("");
  const files = Array.from(uploadInput.files || []);
  if (!files.length) {
    setFlash("Choose at least one PDF first.", "error");
    return;
  }

  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  try {
    await runWithLoading(
      {
        title: files.length > 1 ? "Uploading and processing your PDFs" : "Uploading and processing your PDF",
        detail:
          files.length > 1
            ? `Uploading ${files.length} bill PDFs, parsing them, and refreshing the dashboard.`
            : "Uploading your bill PDF, parsing it, and refreshing the dashboard.",
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
        const parsedUploads = uploadedFiles.filter((item) => item.parser_status === "parsed");
        const failedUploads = uploadedFiles.filter((item) => item.parser_status !== "parsed");
        if (failedUploads.length) {
          const failedSummary = failedUploads
            .map((item) => item.error_message || `${item.filename} could not be parsed`)
            .join(" ");
          if (parsedUploads.length) {
            setFlash(
              `Processed ${uploadedFiles.length} PDFs: ${parsedUploads.length} parsed and ${failedUploads.length} failed. ${failedSummary}`,
              "error",
            );
          } else {
            setFlash(`None of the uploaded PDFs could be parsed. ${failedSummary}`, "error");
          }
        } else {
          const uploadedCount = parsedUploads.length;
          const uploadedLabel = uploadedCount === 1 ? parsedUploads[0]?.filename || "1 PDF" : `${uploadedCount} PDFs`;
          setFlash(`Uploaded ${uploadedLabel}. The restored bill graphs have been refreshed.`);
        }
        uploadForm.reset();
        await loadDashboard();
      },
    );
  } catch (error) {
    setFlash(error.message, "error");
  }
  });
}

if (pushButton) {
  pushButton.addEventListener("click", async () => {
  setFlash("");
  try {
    await runWithLoading(
      {
        title: "Enabling notifications",
        detail: "Registering this browser for bill alerts and refreshing your dashboard settings.",
        control: pushButton,
      },
      async () => {
        await enablePushNotifications();
        setFlash("Browser notifications enabled for this device.");
        await loadDashboard();
      },
    );
  } catch (error) {
    setFlash(error.message, "error");
  }
  });
}

if (syncButton) {
  syncButton.addEventListener("click", async () => {
  setFlash("");
  try {
    await runWithLoading(
      {
        title: "Fetching your latest KSEB bill",
        detail: "Checking KSEB for a new bill, parsing it, and refreshing your dashboard.",
        control: syncButton,
        busyLabel: "Fetching latest bill...",
      },
      async () => {
        await api("/api/sync", { method: "POST" });
        setFlash("Latest bill fetch completed.");
        await loadDashboard();
      },
    );
  } catch (error) {
    setFlash(error.message, "error");
  }
  });
}

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
  setFlash("");
  try {
    await runWithLoading(
      {
        title: "Logging you out",
        detail: "Closing your private session for this browser.",
        control: logoutButton,
      },
      async () => {
        await api("/api/session", { method: "DELETE" });
        resetAppView();
        setFlash("Logged out.");
      },
    );
  } catch (error) {
    setFlash(error.message, "error");
  }
  });
}

if (exportButton) {
  exportButton.addEventListener("click", async () => {
  setFlash("");
  try {
    await runWithLoading(
      {
        title: "Preparing your account export",
        detail: "Collecting your stored bills, documents, and account data for download.",
        control: exportButton,
      },
      async () => {
        const payload = await api("/api/account/export");
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "kseb-account-export.json";
        link.click();
        URL.revokeObjectURL(url);
        setFlash("Account export downloaded.");
      },
    );
  } catch (error) {
    setFlash(error.message, "error");
  }
  });
}

if (deleteButton) {
  deleteButton.addEventListener("click", async () => {
  const confirmed = window.confirm("Delete your account and all stored KSEB data for this app?");
  if (!confirmed) {
    return;
  }

  setFlash("");
  try {
    await runWithLoading(
      {
        title: "Deleting your account",
        detail: "Removing your stored KSEB data and ending this session.",
        control: deleteButton,
      },
      async () => {
        await api("/api/account", { method: "DELETE" });
        resetAppView();
        setFlash("Your account and stored data were deleted.");
      },
    );
  } catch (error) {
    setFlash(error.message, "error");
  }
  });
}

window.addEventListener("resize", () => {
  chartInstances.forEach((chart) => chart.resize());
});

async function init() {
  setupTabs();
  setupMoreMenu();
  setupDateRangeControls();
  try {
    await loadDashboard({
      loading: {
        ...DASHBOARD_LOADING_COPY,
        detail: "Checking for an active session and loading your latest dashboard data.",
      },
    });
  } catch {
    setAuthedView(false);
  }
}

init();
