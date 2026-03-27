const flashEl = document.getElementById("flash");
const loadingStateEl = document.getElementById("loadingState");
const loadingTitleEl = document.getElementById("loadingTitle");
const loadingDetailEl = document.getElementById("loadingDetail");
const chartStatusBannerEl = document.getElementById("chartStatusBanner");
const authCard = document.getElementById("authCard");
const appPanel = document.getElementById("appPanel");
const seoLoginSection = document.getElementById("seo-login-section");
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

const CREDENTIALS_STORAGE_KEYS = {
  consumerNumber: "ksebBillStats.consumerNumber",
  mobileNumber: "ksebBillStats.mobileNumber",
};

function normalizeDigitsForStorage(value) {
  // Persist digits only so autofill behaves consistently even if the user types spaces/dashes.
  return String(value ?? "").replace(/\D/g, "");
}

function loadSavedCredentialsIntoForm() {
  if (!consumerNumberInput || !mobileNumberInput) {
    return;
  }
  try {
    const savedConsumer = window.localStorage.getItem(CREDENTIALS_STORAGE_KEYS.consumerNumber);
    const savedMobile = window.localStorage.getItem(CREDENTIALS_STORAGE_KEYS.mobileNumber);

    if (savedConsumer && !consumerNumberInput.value) {
      consumerNumberInput.value = savedConsumer;
    }
    if (savedMobile && !mobileNumberInput.value) {
      mobileNumberInput.value = savedMobile;
    }
  } catch {
    // localStorage might be blocked (privacy mode, tracking protection, etc).
  }
}

function persistCredentialsFromForm() {
  if (!consumerNumberInput || !mobileNumberInput) {
    return;
  }
  const consumer = normalizeDigitsForStorage(consumerNumberInput.value);
  const mobile = normalizeDigitsForStorage(mobileNumberInput.value);

  try {
    if (consumer) {
      window.localStorage.setItem(CREDENTIALS_STORAGE_KEYS.consumerNumber, consumer);
    }
    if (mobile) {
      window.localStorage.setItem(CREDENTIALS_STORAGE_KEYS.mobileNumber, mobile);
    }
  } catch {
    // Ignore storage failures; the sign-in flow should still work.
  }
}

loadSavedCredentialsIntoForm();

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
let activeLoadingControl = null;
let activeLoadingLabel = "";

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
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
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
  document.getElementById(id).textContent = value;
  document.getElementById(metaId).textContent = meta;
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
      text: `${summary.highestDemand.label} recorded ${formatUnits(summary.highestDemand.homeDemand)} of household demand, which is where the system faced its biggest load.`,
    });
  }

  if (summary.highestSolarToGridMonth) {
    insights.push({
      kicker: "Highest solar to grid",
      text: `${summary.highestSolarToGridMonth.label} sent ${formatUnits(summary.highestSolarToGridMonth.unitsExported)} of solar to the grid and kept ${formatUnits(summary.highestSolarToGridMonth.solarSelfUsed)} on site.`,
    });
  }

  if (summary.highestSolarGenerationMonth) {
    insights.push({
      kicker: "Strongest solar generation",
      text: `${summary.highestSolarGenerationMonth.label} generated ${formatUnits(summary.highestSolarGenerationMonth.solarGeneration)}, with ${formatUnits(summary.highestSolarGenerationMonth.solarSelfUsed)} used on site.`,
    });
  }

  if (insights.length) {
    return insights;
  }

  return [
    {
      kicker: "Waiting for more data",
      text: "Your bill archive loaded, but there is not enough complete data yet to surface highlights.",
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
  if (!bills.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 12;
    cell.className = "muted";
    cell.textContent = "No parsed bills available yet. Fetch the latest bill or upload historical PDFs.";
    row.appendChild(cell);
    body.replaceChildren(row);
    return;
  }

  body.replaceChildren(
    ...bills.map((bill) => {
      const row = document.createElement("tr");
      const values = [
        formatDate(bill.bill_date),
        bill.billing_period_days ? `${bill.billing_period_days} days` : bill.billing_period_category || "-",
        formatCurrency(bill.total_amount),
        formatUnits(bill.unitsImported),
        formatUnits(bill.unitsExported),
        formatUnits(bill.solarGeneration),
        formatUnits(bill.solarSelfUsed),
        formatUnits(bill.homeDemand),
        formatUnits(bill.netGrid),
        formatPercent(bill.solarCoverage, 1),
        formatCurrency(bill.costPerHomeUnit, 2),
        formatCurrency(bill.normalizedTotalAmount),
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
  setMetric(
    "totalSpend",
    hasBills ? formatCurrency(summary.totalSpend) : "-",
    "totalSpendMeta",
    hasBills
      ? `${formatCurrency(summary.avgBill)} average across ${bills.length} bills.`
      : "Waiting for parsed bills to calculate totals.",
  );
  setMetric(
    "avgBill",
    formatCurrency(summary.avgBill),
    "avgBillMeta",
    describeBill(
      summary.lowestBill,
      (bill) => `${bill.label} was the lowest at ${formatCurrency(bill.total_amount)}.`,
      "Waiting for a valid billed amount in the loaded data.",
    ),
  );
  setMetric(
    "totalDemand",
    formatUnits(summary.totalHomeDemand),
    "totalDemandMeta",
    describeBill(
      summary.highestDemand,
      (bill) => `${bill.label} had the highest measured home demand at ${formatUnits(bill.homeDemand)}.`,
      "Home demand appears once both KSEB import and solar self-use are available.",
    ),
  );
  setMetric(
    "solarCoverage",
    formatPercent(summary.avgCoverage, 1),
    "solarCoverageMeta",
    describeBill(
      summary.bestCoverage,
      (bill) => `${bill.label} met ${formatPercent(bill.solarCoverage, 1)} of home demand directly from solar.`,
      "Demand met by solar appears once generation and export readings are available.",
    ),
  );
  setMetric(
    "gridImport",
    hasBills ? formatUnits(summary.totalGridImport) : "-",
    "gridImportMeta",
    hasBills
      ? `${formatUnits(summary.totalSolarToGrid)} of measured solar was sent to the grid.`
      : "Grid import totals appear once your first bill is parsed.",
  );
  setMetric(
    "solarSelfUse",
    hasBills ? formatUnits(summary.totalSolarSelfUsed) : "-",
    "solarSelfUseMeta",
    hasBills
      ? `${formatUnits(summary.totalSolarGeneration)} total measured solar generation, including ${formatUnits(summary.totalSolarToGrid)} sent to the grid.`
      : "Solar self-use appears once generation and export readings are available.",
  );

  document.getElementById("overviewSolarPeakValue").textContent = summary.highestSolarGenerationMonth
    ? summary.highestSolarGenerationMonth.label
    : "-";
  document.getElementById("overviewSolarPeakMeta").textContent = summary.highestSolarGenerationMonth
    ? `${formatUnits(summary.highestSolarGenerationMonth.solarGeneration)} generated, with ${formatUnits(summary.highestSolarGenerationMonth.solarSelfUsed)} self-used.`
    : "Waiting for measured solar generation in the loaded data.";

  document.getElementById("overviewSolarUseValue").textContent = formatPercent(summary.solarSelfUseShare, 1);
  document.getElementById("overviewSolarUseMeta").textContent = Number.isFinite(summary.avgSolarGeneration)
    ? `${formatUnits(summary.avgSolarGeneration)} average solar generation per bill cycle.`
    : "Self-use ratio appears once generation and export readings are available.";

  document.getElementById("overviewSolarLatestValue").textContent = summary.latestBill
    ? formatUnits(summary.latestBill.solarGeneration)
    : "-";
  document.getElementById("overviewSolarLatestMeta").textContent =
    summary.latestBill && Number.isFinite(summary.latestBill.solarSelfUsed)
      ? `${summary.latestBill.label} self-used ${formatUnits(summary.latestBill.solarSelfUsed)} and sent ${formatUnits(summary.latestBill.unitsExported)} to the grid.`
      : "Latest month solar details appear once generation and export readings are available.";

  const billDelta =
    summary.latestBill &&
    summary.previousBill &&
    Number.isFinite(summary.latestBill.total_amount) &&
    Number.isFinite(summary.previousBill.total_amount)
      ? summary.latestBill.total_amount - summary.previousBill.total_amount
      : null;
  document.getElementById("trendBadge").textContent = Number.isFinite(billDelta)
    ? `Latest bill ${billDelta >= 0 ? "up" : "down"} ${formatCurrency(Math.abs(billDelta))} vs previous bill`
    : "Tracking month-on-month movement";

  document.getElementById("ledgerBadge").textContent = `${bills.length} usage months ready for review`;

  const footerNoteEl = document.getElementById("footerNote");
  if (footerNoteEl) {
    footerNoteEl.textContent =
      "All figures are calculated from your parsed bills. KSEB import is energy drawn from the grid, solar to grid comes from the bill's export reading, and demand met by solar = self-consumed solar / total home demand.";
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
  if (!window.echarts || !currentBills.length) {
    return;
  }

  for (const [chartId, builder] of TAB_CHART_BUILDERS[tabId] || []) {
    if (!chartInstances.has(chartId)) {
      chartInstances.set(chartId, builder(currentBills));
    }
  }
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
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
      },
      {
        type: "value",
        name: "kWh",
        axisLabel: { color: "#9db0ca" },
        splitLine: { show: false },
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
    const summary = summarizeBills(currentBills);

    authCard.hidden = true;
    appPanel.hidden = false;
    if (seoLoginSection) {
      seoLoginSection.hidden = true;
    }
    identityTitle.textContent = `${me.masked_consumer_number} • ${me.masked_mobile_number}`;
    identityMeta.textContent = "This session is isolated to your own customer data.";

    renderSummary(summary, currentBills);
    renderNotifications(dashboard.notifications || []);
    renderInsights(buildInsights(summary));
    renderLedger(currentBills);

    if (!currentBills.length) {
      setStatus(
        "Sign-in succeeded, but no parsed bills are available yet. Fetch the latest bill or upload older PDFs to repopulate the restored charts.",
        "warning",
      );
      resetCharts();
      renderChartFallback("No parsed bills available yet. Fetch or upload PDFs to populate the graphs.");
      setActiveTab(activeTabId);
      return;
    }

    if (!window.echarts) {
      setStatus(
        "The dashboard data loaded, but charts are unavailable because ECharts could not be loaded from the CDN.",
        "warning",
      );
      resetCharts();
      renderChartFallback("Charts are unavailable because ECharts could not be loaded from the CDN.");
      setActiveTab(activeTabId);
      return;
    }

    setStatus("");
    clearChartFallback();
    resetCharts();
    setActiveTab(activeTabId);
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
  setStatus("");
  authCard.hidden = false;
  appPanel.hidden = true;
  if (seoLoginSection) {
    seoLoginSection.hidden = false;
  }
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
  try {
    await loadDashboard({
      loading: {
        ...DASHBOARD_LOADING_COPY,
        detail: "Checking for an active session and loading your latest dashboard data.",
      },
    });
  } catch {
    authCard.hidden = false;
    appPanel.hidden = true;
    if (seoLoginSection) {
      seoLoginSection.hidden = false;
    }
  }
}

init();
