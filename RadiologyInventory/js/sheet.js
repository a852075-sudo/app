import { loadSettings } from "./setting.js";
import { replaceEntriesForRoom } from "./inventory.js";

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
  replaceEntriesForRoom(roomId, rows);
  return rows;
}

export async function syncEntry(entry) {
  const settings = loadSettings();
  if (!settings.apiUrl) return { offline: true };
  const response = await fetch(settings.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "upsert",
      sheet: settings.sheets[entry.roomId],
      row: entry
    })
  });
  if (!response.ok) throw new Error(`Google Sheets 寫入失敗：${response.status}`);
  return response.json();
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
