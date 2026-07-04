import { loadSettings, roomById } from "./setting.js";
import { replaceAllEntries, replaceEntriesForRoom } from "./inventory.js";

export async function fetchRoomEntries(roomId) {
  const settings = loadSettings();
  if (!settings.apiUrl) return [];
  const url = new URL(settings.apiUrl);
  url.searchParams.set("action", "list");
  url.searchParams.set("sheet", settings.sheets[roomId]);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Google Sheets 讀取失敗：${response.status}`);
  const payload = await response.json();
  const rows = Array.isArray(payload) ? payload : payload.rows || [];
  replaceEntriesForRoom(roomId, normalizeSheetRows(roomId, rows));
  return rows;
}

export async function fetchRoomsFresh(roomIds) {
  const settings = loadSettings();
  if (!settings.apiUrl) return [];
  const results = await Promise.all(roomIds.map(async (roomId) => {
    const url = new URL(settings.apiUrl);
    url.searchParams.set("action", "list");
    url.searchParams.set("sheet", settings.sheets[roomId]);
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`${roomById(roomId).name} 讀取失敗：${response.status}`);
    const payload = await response.json();
    const rows = Array.isArray(payload) ? payload : payload.rows || [];
    return normalizeSheetRows(roomId, rows);
  }));
  const entries = results.flat();
  replaceAllEntries(entries);
  return entries;
}

export async function syncEntry(entry) {
  const settings = loadSettings();
  if (!settings.apiUrl) return { offline: true };
  const response = await fetch(settings.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "upsertDaily",
      sheet: settings.sheets[entry.roomId],
      row: entry,
      fields: buildDailyFields(entry)
    })
  });
  if (!response.ok) throw new Error(`Google Sheets 寫入失敗：${response.status}`);
  return response.json();
}

function buildDailyFields(entry) {
  const room = roomById(entry.roomId);
  const prefix = `${room.name} ${entry.item}`;
  const touched = entry.touched || {};
  const fields = {
    "日期": entry.date
  };
  if (touched.note || entry.note) fields["備註"] = entry.note || "";
  if (touched.peopleQty || (!entry.touched && Number(entry.peopleQty || 0))) fields[`${prefix} 人數`] = Number(entry.peopleQty || 0);
  if (touched.inQty || (!entry.touched && Number(entry.inQty || 0))) {
    const inLabel = String(entry.item || "").includes("補充") ? "補充數" : "補充";
    fields[`${prefix} ${inLabel}`] = Number(entry.inQty || 0);
  }
  if (touched.balanceQty || (!entry.touched && Number(entry.balanceQty || 0))) fields[`${prefix} 結存`] = Number(entry.balanceQty || 0);
  if (touched.usedQty || (!entry.touched && Number(entry.usedQty || 0))) fields[`${prefix} 用量`] = Number(entry.usedQty || 0);
  return fields;
}

function normalizeSheetRows(roomId, rows) {
  const room = roomById(roomId);
  return rows.flatMap((row, rowIndex) => {
    if (row.item || row.品項) return [row];
    const date = row["日期"] || row.date;
    if (!date) return [];
    const grouped = new Map();
    Object.entries(row).forEach(([header, value]) => {
      if (value === "" || value == null) return;
      const parsed = parseDailyHeader(header, room.name);
      if (!parsed) return;
      const current = grouped.get(parsed.item) || {
        id: `${roomId}-${date}-${parsed.item}-${rowIndex}`,
        roomId,
        date,
        item: parsed.item,
        peopleQty: 0,
        inQty: 0,
        usedQty: 0,
        balanceQty: 0,
        wasteQty: 0,
        note: row["備註"] || ""
      };
      current[parsed.key] = Number(value || 0);
      grouped.set(parsed.item, current);
    });
    return [...grouped.values()];
  });
}

function parseDailyHeader(header, roomName) {
  if (header === "日期" || header === "備註" || !header.startsWith(`${roomName} `)) return null;
  const suffixMap = [
    [" 補充數", "inQty"],
    [" 人數", "peopleQty"],
    [" 補充", "inQty"],
    [" 結存", "balanceQty"],
    [" 用量", "usedQty"]
  ];
  const body = header.slice(roomName.length + 1);
  const match = suffixMap.find(([suffix]) => body.endsWith(suffix));
  if (!match) return null;
  return {
    item: body.slice(0, -match[0].length),
    key: match[1]
  };
}

export async function overwriteRoom(roomId, entries) {
  const settings = loadSettings();
  if (!settings.apiUrl) return { offline: true };
  const response = await fetch(settings.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "overwrite",
      sheet: settings.sheets[roomId],
      rows: entries
    })
  });
  if (!response.ok) throw new Error(`Google Sheets 覆蓋失敗：${response.status}`);
  return response.json();
}

export async function appendReportRows({ sheet, headers, rows }) {
  const settings = loadSettings();
  if (!settings.apiUrl) return { offline: true };
  const response = await fetch(settings.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "appendReport",
      sheet,
      headers,
      rows
    })
  });
  if (!response.ok) throw new Error(`Google Sheets 月紀錄寫入失敗：${response.status}`);
  return response.json();
}
