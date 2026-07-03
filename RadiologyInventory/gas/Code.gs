const HEADERS = ["id", "roomId", "date", "item", "inQty", "usedQty", "balanceQty", "wasteQty", "note", "updatedAt"];

function doGet(e) {
  const params = e.parameter || {};
  const sheet = getSheet(params.sheet);
  const rows = readRows(sheet);
  return json({ ok: true, rows });
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents || "{}");

  if (payload.action === "appendReport") {
    const sheet = getSheetWithHeaders(payload.sheet, payload.headers || []);
    appendReportRows(sheet, payload.headers || [], payload.rows || []);
    return json({ ok: true, mode: "appendReport", count: (payload.rows || []).length });
  }

  const sheet = getSheet(payload.sheet);

  if (payload.action === "overwrite") {
    writeAll(sheet, payload.rows || []);
    return json({ ok: true, mode: "overwrite", count: (payload.rows || []).length });
  }

  if (payload.action === "delete") {
    deleteById(sheet, payload.id);
    return json({ ok: true, mode: "delete" });
  }

  upsertRow(sheet, payload.row);
  return json({ ok: true, mode: "upsert", row: payload.row });
}

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = name || "Sheet A";
  const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  ensureHeader(sheet);
  return sheet;
}

function getSheetWithHeaders(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = name || "Summary";
  const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  const safeHeaders = headers && headers.length ? headers : ["recordedAt", "month", "name", "value"];
  const range = sheet.getRange(1, 1, 1, safeHeaders.length);
  const values = range.getValues()[0];
  if (values.join("") === "") range.setValues([safeHeaders]);
  else if (!hasHeaderRow(sheet, safeHeaders)) {
    sheet.appendRow(safeHeaders);
  }
  return sheet;
}

function appendReportRows(sheet, headers, rows) {
  if (!rows.length) return;
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length)
    .setValues(rows.map((row) => headers.map((key) => row[key] == null ? "" : row[key])));
}

function hasHeaderRow(sheet, headers) {
  const lastRow = sheet.getLastRow();
  if (!lastRow) return false;
  const width = headers.length;
  return sheet.getRange(1, 1, lastRow, width).getValues()
    .some((row) => row.join("|") === headers.join("|"));
}

function ensureHeader(sheet) {
  const range = sheet.getRange(1, 1, 1, HEADERS.length);
  const values = range.getValues()[0];
  if (values.join("") !== HEADERS.join("")) range.setValues([HEADERS]);
}

function readRows(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  return sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues().map((row) => {
    const record = {};
    HEADERS.forEach((key, index) => record[key] = row[index]);
    return record;
  });
}

function upsertRow(sheet, row) {
  if (!row || !row.id) throw new Error("row.id is required");
  const rows = readRows(sheet);
  const index = rows.findIndex((record) => String(record.id).trim() === String(row.id).trim());
  const values = [HEADERS.map((key) => row[key] || "")];
  if (index >= 0) sheet.getRange(index + 2, 1, 1, HEADERS.length).setValues(values);
  else sheet.appendRow(values[0]);
}

function writeAll(sheet, rows) {
  sheet.clearContents();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  if (!rows.length) return;
  sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows.map((row) => HEADERS.map((key) => row[key] || "")));
}

function deleteById(sheet, id) {
  const rows = readRows(sheet);
  const index = rows.findIndex((record) => String(record.id).trim() === String(id).trim());
  if (index >= 0) sheet.deleteRow(index + 2);
}

function json(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
