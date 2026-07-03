export const ROOMS = [
  { id: "ct1", name: "1F CT", sheetName: "Sheet A", icon: "radiology", accent: "#2563eb", items: ["Omnipaque", "Visipague320", "高壓針筒"] },
  { id: "ct3", name: "3F CT", sheetName: "Sheet B", icon: "scanner", accent: "#0891b2", items: ["Omnipaque", "Visipague320", "高壓針筒"] },
  { id: "rct", name: "RCT", sheetName: "Sheet C", icon: "monitor_heart", accent: "#7c3aed", items: ["Omnipaque", "Ultravist370", "Visipague320", "高壓針筒"] },
  { id: "mri1", name: "1F MRI", sheetName: "Sheet D", icon: "magnet", accent: "#0f766e", items: ["Gadolinium", "Eovist", "生理食鹽水"] },
  { id: "mri3", name: "3F MRI", sheetName: "Sheet E", icon: "view_in_ar", accent: "#16a34a", items: ["Gadolinium", "Eovist", "生理食鹽水"] },
  { id: "mri3t", name: "3T MRI", sheetName: "Sheet F", icon: "settings_input_antenna", accent: "#ca8a04", items: ["Gadolinium", "Primovist", "生理食鹽水"] },
  { id: "special", name: "特殊", sheetName: "Sheet G", icon: "biotech", accent: "#db2777", items: ["Ultravist300", "Ultravist370", "Barium", "Omnipaque"] },
  { id: "vascular", name: "血管", sheetName: "Sheet H", icon: "vascular", accent: "#dc2626", items: ["Omnipaque", "Ultravist370", "Visipague320", "高壓針筒"] },
  { id: "summary", name: "總盤點彙整", sheetName: "Summary", icon: "inventory_2", accent: "#4f46e5", type: "summary", items: [] },
  { id: "syringe", name: "高壓注射器針筒", sheetName: "Sheet J", icon: "syringe", accent: "#0d9488", type: "syringe", items: ["高壓針筒", "延長管", "三通閥"] }
];

export const DEFAULT_SETTINGS = {
  apiUrl: "",
  sheets: Object.fromEntries(ROOMS.map((room) => [room.id, room.sheetName])),
  initialStocks: {
    ct1: 46,
    ct3: 54,
    rct: 87,
    mri1: 300,
    mri3: 500,
    mri3t: 100,
    special: 47,
    vascular: 10,
    syringe: 500
  }
};

const STORAGE_KEYS = {
  settings: "radiology_inventory_settings_v1"
};

export function loadSettings() {
  const raw = localStorage.getItem(STORAGE_KEYS.settings);
  if (!raw) return structuredClone(DEFAULT_SETTINGS);
  try {
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULT_SETTINGS),
      ...parsed,
      sheets: { ...DEFAULT_SETTINGS.sheets, ...(parsed.sheets || {}) },
      initialStocks: { ...DEFAULT_SETTINGS.initialStocks, ...(parsed.initialStocks || {}) }
    };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
}

export function roomById(id) {
  return ROOMS.find((room) => room.id === id) || ROOMS[0];
}

export function operationalRooms() {
  return ROOMS.filter((room) => room.type !== "summary");
}
