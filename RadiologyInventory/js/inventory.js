import { loadSettings } from "./setting.js";

const STORAGE_KEY = "radiology_inventory_entries_v1";

export function loadEntries() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function upsertEntry(entry) {
  const entries = loadEntries();
  const next = {
    id: entry.id || crypto.randomUUID(),
    roomId: entry.roomId,
    date: entry.date,
    item: entry.item.trim(),
    inQty: Number(entry.inQty || 0),
    usedQty: Number(entry.usedQty || 0),
    balanceQty: Number(entry.balanceQty ?? 0),
    wasteQty: Number(entry.wasteQty || 0),
    note: entry.note || "",
    updatedAt: new Date().toISOString()
  };
  const index = entries.findIndex((row) => row.id === next.id);
  if (index >= 0) entries[index] = next;
  else entries.push(next);
  saveEntries(entries);
  return next;
}

export function replaceEntriesForRoom(roomId, rows) {
  const keep = loadEntries().filter((entry) => entry.roomId !== roomId);
  const normalized = rows.map((row) => ({
    id: row.id || crypto.randomUUID(),
    roomId,
    date: normalizeDate(row.date),
    item: row.item || row.品項 || "未命名",
    inQty: Number(row.inQty ?? row.入庫 ?? 0),
    usedQty: Number(row.usedQty ?? row.使用 ?? 0),
    balanceQty: Number(row.balanceQty ?? row.結存 ?? 0),
    wasteQty: Number(row.wasteQty ?? row.報廢 ?? 0),
    note: row.note || row.備註 || "",
    updatedAt: row.updatedAt || new Date().toISOString()
  }));
  saveEntries([...keep, ...normalized]);
}

export function entriesFor(roomId, year, month) {
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  return loadEntries()
    .filter((entry) => entry.roomId === roomId && entry.date?.startsWith(prefix))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

export function isoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function normalizeDate(value) {
  if (!value) return isoDate(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());
  return String(value).replaceAll("/", "-").slice(0, 10);
}

export function calculateDailyRows(roomId, year, month) {
  const settings = loadSettings();
  const entries = entriesFor(roomId, year, month);
  let balance = resolveOpeningStock(roomId, year, month);
  const totalDays = daysInMonth(year, month);

  return Array.from({ length: totalDays }, (_, index) => {
    const day = index + 1;
    const date = isoDate(year, month, day);
    const dayEntries = entries.filter((entry) => entry.date === date);
    const inQty = sum(dayEntries, "inQty");
    const usedQty = sum(dayEntries, "usedQty");
    const wasteQty = sum(dayEntries, "wasteQty");
    balance = balance + inQty - usedQty - wasteQty;
    return {
      day,
      date,
      weekday: new Date(`${date}T00:00:00`).getDay(),
      entries: dayEntries,
      itemText: [...new Set(dayEntries.map((entry) => entry.item))].join("、"),
      inQty,
      usedQty,
      wasteQty,
      balance,
      openingStock: settings.initialStocks[roomId] || 0,
      completed: dayEntries.length > 0
    };
  });
}

export function calculateAlert(roomId, year, month, today = new Date()) {
  const rows = calculateDailyRows(roomId, year, month);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const cutoff = year === currentYear && month === currentMonth ? today.getDate() : daysInMonth(year, month);
  const missing = rows.filter((row) => row.day <= cutoff && row.weekday !== 0 && !row.completed);
  return {
    missingCount: missing.length,
    missingDays: missing.map((row) => row.day),
    complete: missing.length === 0
  };
}

export function calculateMonthlyMetrics(roomId, year, month) {
  const rows = calculateDailyRows(roomId, year, month);
  return {
    roomId,
    year,
    month,
    inQty: sum(rows, "inQty"),
    usedQty: sum(rows, "usedQty"),
    wasteQty: sum(rows, "wasteQty"),
    endingStock: rows.at(-1)?.balance || resolveOpeningStock(roomId, year, month),
    openingStock: resolveOpeningStock(roomId, year, month)
  };
}

export function calculateSummary(roomIds, year, month) {
  const roomMetrics = roomIds.map((roomId) => calculateMonthlyMetrics(roomId, year, month));
  return {
    roomMetrics,
    totals: {
      inQty: sum(roomMetrics, "inQty"),
      usedQty: sum(roomMetrics, "usedQty"),
      wasteQty: sum(roomMetrics, "wasteQty"),
      endingStock: sum(roomMetrics, "endingStock")
    }
  };
}

export function resolveOpeningStock(roomId, year, month) {
  const settings = loadSettings();
  let opening = Number(settings.initialStocks[roomId] || 0);
  for (let currentMonth = 1; currentMonth < month; currentMonth += 1) {
    const previousRows = calculateDailyRowsWithoutCarry(roomId, year, currentMonth, opening);
    opening = previousRows.at(-1)?.balance ?? opening;
  }
  return opening;
}

function calculateDailyRowsWithoutCarry(roomId, year, month, opening) {
  const entries = entriesFor(roomId, year, month);
  let balance = opening;
  return Array.from({ length: daysInMonth(year, month) }, (_, index) => {
    const date = isoDate(year, month, index + 1);
    const dayEntries = entries.filter((entry) => entry.date === date);
    balance = balance + sum(dayEntries, "inQty") - sum(dayEntries, "usedQty") - sum(dayEntries, "wasteQty");
    return { date, balance };
  });
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}
