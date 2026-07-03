import { ROOMS, operationalRooms, roomById, loadSettings, saveSettings, getInitialStock, stockKey } from "./setting.js";
import {
  calculateAlert,
  calculateDailyRows,
  calculateSummary,
  entriesFor,
  isoDate,
  upsertEntry
} from "./inventory.js";
import { renderTimeline } from "./timeline.js";
import { syncEntry, fetchRoomEntries } from "./sheet.js";

export function createUI(state, actions) {
  const root = document.querySelector("#viewRoot");
  const title = document.querySelector("#appTitle");
  const subtitle = document.querySelector("#appSubtitle");
  const backBtn = document.querySelector("#backBtn");
  const entryDialog = document.querySelector("#entryDialog");
  const entryForm = document.querySelector("#entryForm");
  const settingsDialog = document.querySelector("#settingsDialog");
  const settingsForm = document.querySelector("#settingsForm");

  function render() {
    root.innerHTML = "";
    const room = state.roomId ? roomById(state.roomId) : null;
    backBtn.classList.toggle("is-hidden", !room);
    title.textContent = room ? room.name : "放射科對比劑智慧盤點";
    subtitle.textContent = room ? `${state.year} 年 ${String(state.month).padStart(2, "0")} 月` : "Google Sheets 智慧同步盤點";

    if (!room) renderHome(root);
    else if (room.type === "summary") renderSummary(root);
    else renderRoom(root, room);
    root.focus({ preventScroll: true });
  }

  function renderHome(target) {
    target.append(el("section", "hero-panel", `
      <div>
        <h2>今日盤點工作台</h2>
      </div>
    `));

    const grid = el("section", "icon-grid");
    ROOMS.forEach((room) => {
      const card = el("button", "app-card");
      card.type = "button";
      card.style.setProperty("--accent", room.accent);
      card.innerHTML = `
        <span class="card-icon"><span class="material-symbols-rounded">${room.icon}</span></span>
        <h3>${room.name}</h3>
        <p>${room.type === "summary" ? "整合月報與匯出" : "每日盤點與結存"}</p>
      `;
      card.addEventListener("click", () => actions.openRoom(room.id));
      grid.append(card);
    });
    target.append(grid);
  }

function renderRoom(target, room) {
    target.append(renderTimeline({
      year: state.year,
      month: state.month,
      onSelect: actions.setMonth,
      onYearChange: actions.changeYear
    }));

    if (room.type === "syringe") {
      target.append(renderSyringeReferencePanel(room));
      return;
    }

    const alert = calculateAlert(room.id, state.year, state.month);
    target.append(el("section", `alert-card ${alert.complete ? "success" : "danger"}`, `
      <span class="material-symbols-rounded">${alert.complete ? "check_circle" : "warning"}</span>
      <strong>${alert.complete ? "本月盤點完成" : `尚有 ${alert.missingCount} 天未完成盤點`}</strong>
      ${alert.complete ? "" : `<span class="muted">缺漏日期：${alert.missingDays.join("、")}</span>`}
    `));

    if (REFERENCE_TABLES[room.id]) {
      target.append(renderReferenceRoomTable(room, REFERENCE_TABLES[room.id]));
      return;
    }

    const rows = calculateDailyRows(room.id, state.year, state.month);
    const table = tableShell(`${room.name} 日統計表`, "新增");
    table.querySelector("[data-add]").addEventListener("click", () => openEntryDialog(room, isoDate(state.year, state.month, new Date().getDate())));
    table.querySelector("thead").innerHTML = `
      <tr><th>日期</th><th>品項</th><th>入庫</th><th>使用</th><th>報廢</th><th>結存</th><th>狀態</th><th>操作</th></tr>
    `;
    const body = table.querySelector("tbody");
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.day} 日</td>
        <td>${row.itemText || "<span class='empty-cell'>未登記</span>"}</td>
        <td>${row.inQty}</td>
        <td>${row.usedQty}</td>
        <td>${row.wasteQty}</td>
        <td><strong>${row.balance}</strong></td>
        <td><span class="badge">${row.weekday === 0 ? "週日排除" : row.completed ? "完成" : "待補"}</span></td>
        <td><button class="tonal-btn" type="button" data-date="${row.date}"><span class="material-symbols-rounded">add</span>新增</button></td>
      `;
      tr.querySelector("[data-date]").addEventListener("click", () => openEntryDialog(room, row.date));
      body.append(tr);
    });
    target.append(table);
  }

  function renderReferenceRoomTable(room, config) {
    const rows = calculateDailyRows(room.id, state.year, state.month);
    const table = tableShell(`${room.name} 攝影室 每日盤點與明細登記`, "新增當日登記");
    table.classList.add("reference-panel");
    table.querySelector("[data-add]").addEventListener("click", () => openEntryDialog(room, isoDate(state.year, state.month, new Date().getDate())));
    table.querySelector("thead").innerHTML = `
      <tr>
        <th rowspan="2">日期</th>
        ${config.groups.map((group) => `<th colspan="${group.columns.length}">${group.label}</th>`).join("")}
        <th rowspan="2">操作</th>
      </tr>
      <tr>
        ${config.groups.flatMap((group) => group.columns.map((column) => `<th class="${columnClass(column)}">${columnLabel(column)}</th>`)).join("")}
      </tr>
    `;
    const body = table.querySelector("tbody");
    const settings = loadSettings();
    const balances = Object.fromEntries(config.groups.map((group) => [
      group.key,
      getInitialStock(settings, room.id, group.key)
    ]));
    const previousDayHadInput = Object.fromEntries(config.groups.map((group) => [group.key, false]));
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      const cells = config.groups.flatMap((group) => {
        const totals = itemTotals(row.entries, ...group.aliases);
        const previousBalance = balances[group.key] || 0;
        const hasAnyEntry = row.entries.some((entry) => matchesItem(entry.item, group.aliases));
        const hasRecordedBalance = row.entries.some((entry) => matchesItem(entry.item, group.aliases) && Number(entry.balanceQty || 0) > 0);
        const currentBalance = hasRecordedBalance
          ? sumItemEntries(row.entries, group.aliases, "balanceQty")
          : previousBalance + totals.inQty - totals.usedQty - totals.wasteQty;
        const calculatedUsed = Math.max(0, previousBalance + totals.inQty - currentBalance);
        const showSundayCarry = row.weekday === 0 && previousDayHadInput[group.key];
        balances[group.key] = currentBalance;
        const renderedCells = group.columns.map((column) => renderReferenceCell(column, totals, currentBalance, calculatedUsed, {
          hasAnyEntry,
          showSundayCarry
        }));
        previousDayHadInput[group.key] = hasAnyEntry;
        return renderedCells;
      });
      tr.innerHTML = `
        <td><strong>${row.date.replaceAll("-", "/")}</strong></td>
        ${cells.join("")}
        <td><button class="tonal-btn" type="button" data-date="${row.date}"><span class="material-symbols-rounded">add</span>新增</button></td>
      `;
      tr.querySelector("[data-date]").addEventListener("click", () => openEntryDialog(room, row.date));
      body.append(tr);
    });
    return table;
  }

  function renderSummary(target) {
    target.append(renderTimeline({
      year: state.year,
      month: state.month,
      onSelect: actions.setMonth,
      onYearChange: actions.changeYear
    }));
    const summaryRows = buildContrastSummaryRows(state.year, state.month);
    const table = tableShell("對比劑物料總盤點彙整 (Stock & Cabinet Inventory)", "匯出 Excel");
    table.classList.add("reference-panel");
    const exportBtn = table.querySelector("[data-add]");
    exportBtn.innerHTML = `<span class="material-symbols-rounded">download</span>Excel`;
    exportBtn.addEventListener("click", () => exportContrastCsv(summaryRows));
    const toolbar = table.querySelector(".table-toolbar");
    toolbar.querySelector("h3").innerHTML = `<span class="material-symbols-rounded">inventory_2</span>對比劑物料總盤點彙整 (Stock & Cabinet Inventory)`;
    const pdfBtn = el("button", "tonal-btn", `<span class="material-symbols-rounded">picture_as_pdf</span>PDF`);
    pdfBtn.type = "button";
    pdfBtn.addEventListener("click", () => window.print());
    toolbar.append(pdfBtn);
    table.querySelector("table").classList.add("inventory-summary-table");
    table.querySelector("thead").innerHTML = `
      <tr>
        <th>對比劑藥名</th>
        <th>本月使用人數 (人)</th>
        <th class="consumption-head">本月消耗瓶數 (瓶)</th>
        <th>攝影室期末結存 (瓶)</th>
        <th>申請量 (可直接修改)</th>
        <th>鐵櫃結存 (可直接修改)</th>
      </tr>
    `;
    const body = table.querySelector("tbody");
    summaryRows.forEach((row) => {
      body.insertAdjacentHTML("beforeend", `
        <tr>
          <td><strong>${row.name}</strong></td>
          <td>${row.people}</td>
          <td class="consumption-cell"><strong>${row.consumed}</strong></td>
          <td><strong>${row.roomEnding}</strong></td>
          <td><input class="inline-number" type="number" min="0" value="${row.requestQty}" aria-label="${row.name} 申請量"></td>
          <td><input class="inline-number" type="number" min="0" value="${row.cabinetStock}" aria-label="${row.name} 鐵櫃結存"></td>
        </tr>
      `);
    });
    target.append(table);
  }

  function renderSyringeReferencePanel(room) {
    const metrics = buildSyringeMetrics(state.year, state.month);
    const panel = el("section", "syringe-panel", `
      <div class="table-toolbar">
        <h3><span class="material-symbols-rounded">syringe</span>高壓注射器針筒消耗明細與總計 (選定區間)</h3>
      </div>
      <div class="syringe-card-grid">
        <div class="syringe-stat-card"><span>RCT 攝影室消耗</span><strong>${metrics.rct} 支</strong></div>
        <div class="syringe-stat-card"><span>3F CT 攝影室消耗</span><strong>${metrics.ct3} 支</strong></div>
        <div class="syringe-stat-card"><span>1F CT 攝影室消耗</span><strong>${metrics.ct1} 支</strong></div>
        <div class="syringe-stat-card total"><span>高壓針筒全院總計</span><strong>${metrics.total} 支</strong></div>
      </div>
    `);
    return panel;
  }

  function openEntryDialog(room, date) {
    document.querySelector("#entryDialogTitle").textContent = `新增 ${room.name} 盤點`;
    document.querySelector("#entryDate").value = date;
    document.querySelector("#entryItem").value = room.items[0] || "";
    document.querySelector("#entryIn").value = 0;
    document.querySelector("#entryUsed").value = 0;
    document.querySelector("#entryWaste").value = 0;
    document.querySelector("#entryNote").value = "";
    const datalist = document.querySelector("#itemList");
    datalist.innerHTML = room.items.map((item) => `<option value="${item}"></option>`).join("");
    entryForm.dataset.roomId = room.id;
    entryDialog.showModal();
  }

  entryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(entryForm);
    const entry = upsertEntry({
      roomId: entryForm.dataset.roomId,
      date: data.get("date"),
      item: data.get("item"),
      inQty: data.get("inQty"),
      usedQty: 0,
      balanceQty: data.get("usedQty"),
      wasteQty: data.get("wasteQty"),
      note: data.get("note")
    });
    entryDialog.close();
    render();
    try {
      await syncEntry(entry);
      toast("已儲存並同步");
    } catch (error) {
      toast(`已本機儲存，同步待重試：${error.message}`);
    }
  });

  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => button.closest("dialog").close());
  });

  function openSettings() {
    const settings = loadSettings();
    document.querySelector("#apiUrlInput").value = settings.apiUrl;
    document.querySelector("#initialStockInputs").innerHTML = stockSettingItems().map((item) => `
      <div class="settings-row">
        <strong>${item.label}</strong>
        <input name="stock:${item.key}" type="number" min="0" step="1" value="${settings.initialStocks[item.key] || 0}">
      </div>
    `).join("");
    document.querySelector("#sheetMapInputs").innerHTML = ROOMS.map((room) => `
      <div class="settings-row">
        <strong>${room.name}</strong>
        <input name="sheet:${room.id}" value="${settings.sheets[room.id] || room.sheetName}">
      </div>
    `).join("");
    settingsDialog.showModal();
  }

  settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(settingsForm);
    const settings = loadSettings();
    settings.apiUrl = data.get("apiUrl") || "";
    for (const [key, value] of data.entries()) {
      if (key.startsWith("stock:")) settings.initialStocks[key.replace("stock:", "")] = Number(value || 0);
      if (key.startsWith("sheet:")) settings.sheets[key.replace("sheet:", "")] = value || "";
    }
    saveSettings(settings);
    settingsDialog.close();
    render();
    toast("設定已儲存");
  });

  async function syncCurrentRoom() {
    const syncTargets = state.roomId
      ? [roomById(state.roomId)]
      : operationalRooms();
    toast(state.roomId ? "正在同步目前頁面..." : "正在同步全部資料...");
    try {
      const results = await Promise.allSettled(syncTargets.map((room) => fetchRoomEntries(room.id)));
      render();
      const successCount = results.filter((result) => result.status === "fulfilled").length;
      const failCount = results.length - successCount;
      toast(failCount ? `已同步 ${successCount} 項，${failCount} 項失敗` : "已完成全部同步");
    } catch (error) {
      toast(error.message);
    }
  }

  return { render, openSettings, syncCurrentRoom };
}

function tableShell(title, actionText) {
  return el("section", "table-card", `
    <div class="table-toolbar">
      <h3>${title}</h3>
      <button class="tonal-btn" type="button" data-add><span class="material-symbols-rounded">add</span>${actionText}</button>
    </div>
    <div class="table-wrap"><table><thead></thead><tbody></tbody></table></div>
  `);
}

const REFERENCE_TABLES = {
  ct1: {
    groups: [
      referenceGroup("omni", "Omnipaque", ["Omnipaque"], ["people", "in", "balance", "used"]),
      referenceGroup("visipague", "Visipague", ["Visipague", "Visipaque"], ["people"]),
      referenceGroup("injector", "注射器", ["注射器", "針筒", "syringe", "高壓"], ["dose"]),
      referenceGroup("syringeRefill", "針筒補充", ["注射器", "針筒", "syringe", "高壓"], ["refill"])
    ]
  },
  ct3: {
    groups: [
      referenceGroup("omni", "Omnipaque", ["Omnipaque"], ["people", "in", "balance", "used"]),
      referenceGroup("visipague", "Visipague", ["Visipague", "Visipaque"], ["people"]),
      referenceGroup("injector", "注射器", ["注射器", "針筒", "syringe", "高壓"], ["dose"])
    ]
  },
  rct: {
    groups: [
      referenceGroup("omni", "Omnipaque", ["Omnipaque"], ["people", "in", "balance", "used"]),
      referenceGroup("ultravist370", "Ultravist 370", ["Ultravist370", "Ultravist 370"], ["people", "in", "balance", "used"]),
      referenceGroup("visipague", "Visipague", ["Visipague", "Visipaque"], ["people"]),
      referenceGroup("injector", "注射器", ["注射器", "針筒", "syringe", "高壓"], ["dose"])
    ]
  },
  mri1: {
    groups: [
      referenceGroup("gadovist", "Gadovist", ["Gadovist", "Gadolinium"], ["people", "in", "balance", "used"]),
      referenceGroup("dotarem", "Dotarem", ["Dotarem"], ["people", "in", "balance", "used"]),
      referenceGroup("primovist", "Primovist", ["Primovist", "Eovist"], ["people"])
    ]
  },
  mri3: {
    groups: [
      referenceGroup("gadovist", "Gadovist", ["Gadovist", "Gadolinium"], ["people", "in", "balance", "used"]),
      referenceGroup("dotarem", "Dotarem", ["Dotarem"], ["people", "in", "balance", "used"]),
      referenceGroup("primovist", "Primovist", ["Primovist", "Eovist"], ["people"])
    ]
  },
  mri3t: {
    groups: [
      referenceGroup("gadovist", "Gadovist", ["Gadovist", "Gadolinium"], ["people", "in", "balance", "used"]),
      referenceGroup("dotarem", "Dotarem", ["Dotarem"], ["people", "in", "balance", "used"]),
      referenceGroup("primovist", "Primovist", ["Primovist", "Eovist"], ["people"])
    ]
  },
  special: {
    groups: [
      referenceGroup("omni", "Omnipaque", ["Omnipaque"], ["people", "in", "balance", "used"]),
      referenceGroup("ultravist300", "Ultravist 300", ["Ultravist300", "Ultravist 300"], ["people", "in", "balance", "used"]),
      referenceGroup("barium", "鋇劑 (Barium)", ["Barium", "鋇劑"], ["people", "in", "balance", "used"]),
      referenceGroup("ultravist370", "Ultravist 370", ["Ultravist370", "Ultravist 370"], ["people", "in", "balance", "used"])
    ]
  },
  vascular: {
    groups: [
      referenceGroup("omni", "Omnipaque", ["Omnipaque"], ["people", "in", "balance", "used"]),
      referenceGroup("ultravist370", "Ultravist 370", ["Ultravist370", "Ultravist 370"], ["people", "in", "balance", "used"]),
      referenceGroup("visipague", "Visipague", ["Visipague", "Visipaque"], ["people"])
    ]
  }
};

function referenceGroup(key, label, aliases, columns) {
  return { key, label, aliases, columns };
}

function stockSettingItems() {
  return Object.entries(REFERENCE_TABLES).flatMap(([roomId, config]) => {
    const room = roomById(roomId);
    return config.groups
      .filter((group) => group.columns.includes("balance"))
      .map((group) => ({
        key: stockKey(roomId, group.key),
        label: `${room.name} ${group.label}`
      }));
  });
}

function columnLabel(column) {
  return {
    people: "人數",
    in: "補充",
    balance: "結存",
    used: "使用",
    dose: "用量",
    refill: "補充數"
  }[column] || column;
}

function columnClass(column) {
  return column === "used" ? "usage-head" : "";
}

function renderReferenceCell(column, totals, balance, calculatedUsed, display = {}) {
  const shouldShowValue = display.hasAnyEntry || (column === "balance" && display.showSundayCarry);
  if (!shouldShowValue) {
    const className = column === "used" ? " class=\"usage-cell\"" : "";
    return `<td${className}></td>`;
  }

  const value = {
    people: calculatedUsed,
    in: totals.inQty,
    balance,
    used: calculatedUsed,
    dose: calculatedUsed,
    refill: totals.inQty
  }[column] ?? 0;
  const strong = column === "balance" || column === "used";
  const className = column === "used" ? " class=\"usage-cell\"" : "";
  return `<td${className}>${strong ? `<strong>${value}</strong>` : value}</td>`;
}

const CONTRAST_SUMMARY_ITEMS = [
  { name: "Omnipaque", aliases: ["omnipaque"] },
  { name: "Ultravist 300", aliases: ["ultravist300", "ultravist 300", "優視特300"] },
  { name: "Ultravist 370", aliases: ["ultravist370", "ultravist 370"] },
  { name: "Visipague 320", aliases: ["visipague320", "visipague", "visipaque"] },
  { name: "鋇劑 (Barium)", aliases: ["barium", "鋇劑"] },
  { name: "Gadovist", aliases: ["gadovist", "gadolinium"] },
  { name: "Dotarem", aliases: ["dotarem"] },
  { name: "Primovist", aliases: ["primovist", "eovist"] }
];

function buildContrastSummaryRows(year, month) {
  return CONTRAST_SUMMARY_ITEMS.map((definition) => {
    const stats = summarizeContrastItem(definition, year, month);
    return {
      name: definition.name,
      people: stats.usedQty,
      consumed: stats.usedQty,
      roomEnding: stats.endingStock,
      requestQty: 0,
      cabinetStock: 0
    };
  });
}

function buildSyringeMetrics(year, month) {
  const targetRooms = ["rct", "ct3", "ct1"];
  const values = Object.fromEntries(targetRooms.map((roomId) => {
    const entries = filterEntriesByAliases(entriesFor(roomId, year, month), ["針筒", "syringe", "高壓"]);
    return [roomId, sumEntries(entries, "usedQty")];
  }));
  return {
    rct: values.rct || 0,
    ct3: values.ct3 || 0,
    ct1: values.ct1 || 0,
    total: (values.rct || 0) + (values.ct3 || 0) + (values.ct1 || 0)
  };
}

function filterEntriesByAliases(entries, aliases) {
  return entries.filter((entry) => matchesItem(entry.item, aliases));
}

function matchesItem(itemName, aliases) {
  const item = normalizeItem(itemName);
  return aliases.some((alias) => item.includes(normalizeItem(alias)));
}

function normalizeItem(value) {
  return String(value || "").toLowerCase().replaceAll(" ", "");
}

function sumEntries(entries, key) {
  return entries.reduce((total, entry) => total + Number(entry[key] || 0), 0);
}

function sumItemEntries(entries, aliases, key) {
  return sumEntries(filterEntriesByAliases(entries, aliases), key);
}

function summarizeContrastItem(definition, year, month) {
  let usedQty = 0;
  let endingStock = 0;
  operationalRooms()
    .filter((room) => room.type !== "syringe")
    .forEach((room) => {
      const config = REFERENCE_TABLES[room.id];
      if (!config) return;
      config.groups
        .filter((group) => group.columns.includes("balance") && group.aliases.some((alias) => definition.aliases.map(normalizeItem).includes(normalizeItem(alias))))
        .forEach((group) => {
          const rows = calculateDailyRows(room.id, year, month);
          const settings = loadSettings();
          let balance = getInitialStock(settings, room.id, group.key);
          rows.forEach((row) => {
            const totals = itemTotals(row.entries, ...group.aliases);
            const hasRecordedBalance = row.entries.some((entry) => matchesItem(entry.item, group.aliases) && Number(entry.balanceQty || 0) > 0);
            const currentBalance = hasRecordedBalance
              ? sumItemEntries(row.entries, group.aliases, "balanceQty")
              : balance + totals.inQty - totals.usedQty - totals.wasteQty;
            usedQty += Math.max(0, balance + totals.inQty - currentBalance);
            balance = currentBalance;
          });
          endingStock += balance;
        });
    });
  return { usedQty, endingStock };
}

function exportContrastCsv(rows) {
  const header = ["對比劑藥名", "本月使用人數 (人)", "本月消耗瓶數 (瓶)", "攝影室期末結存 (瓶)", "申請量", "鐵櫃結存"];
  const csv = [header, ...rows.map((row) => [
    row.name,
    row.people,
    row.consumed,
    row.roomEnding,
    row.requestQty,
    row.cabinetStock
  ])].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `對比劑物料總盤點彙整.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportCsv(summary) {
  const header = ["攝影室", "期初", "入庫", "使用", "報廢", "月底庫存"];
  const rows = summary.roomMetrics.map((metric) => [
    roomById(metric.roomId).name,
    metric.openingStock,
    metric.inQty,
    metric.usedQty,
    metric.wasteQty,
    metric.endingStock
  ]);
  const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `放射科總盤點彙整.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function itemTotals(entries, ...tokens) {
  const matched = entries.filter((entry) => {
    const item = String(entry.item || "").toLowerCase();
    return tokens.some((token) => item.includes(String(token).toLowerCase()));
  });
  return {
    inQty: matched.reduce((total, entry) => total + Number(entry.inQty || 0), 0),
    usedQty: matched.reduce((total, entry) => total + Number(entry.usedQty || 0), 0),
    wasteQty: matched.reduce((total, entry) => total + Number(entry.wasteQty || 0), 0)
  };
}

function toast(message) {
  const node = document.querySelector("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove("show"), 2600);
}

function el(tag, className, html = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.innerHTML = html;
  return node;
}
