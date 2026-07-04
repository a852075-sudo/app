export const ROOMS = [
  { id: "ct1", name: "1F CT", sheetName: "Sheet A", icon: "radiology", accent: "#2563eb", items: ["Omnipaque", "Visipague320", "高壓針筒"] },
  { id: "ct3", name: "3F CT", sheetName: "Sheet B", icon: "scanner", accent: "#0891b2", items: ["Omnipaque", "Visipague320", "高壓針筒"] },
  { id: "rct", name: "RCT", sheetName: "Sheet C", icon: "monitor_heart", accent: "#7c3aed", items: ["Omnipaque", "Ultravist370", "Visipague320", "高壓針筒"] },
  { id: "mri1", name: "1F MRI", sheetName: "Sheet D", icon: "magnet", accent: "#0f766e", items: ["Gadolinium", "Eovist", "生理食鹽水"] },
  { id: "mri3", name: "3F MRI", sheetName: "Sheet E", icon: "view_in_ar", accent: "#16a34a", items: ["Gadolinium", "Eovist", "生理食鹽水"] },
  { id: "mri3t", name: "3T MRI", sheetName: "Sheet F", icon: "settings_input_antenna", accent: "#ca8a04", items: ["Gadolinium", "Primovist", "生理食鹽水"] },
  { id: "special", name: "特殊", sheetName: "Sheet G", icon: "biotech", accent: "#db2777", items: ["Ultravist300", "Ultravist370", "Barium", "Omnipaque"] },
  { id: "vascular", name: "血管", sheetName: "Sheet H", icon: "vascular", accent: "#dc2626", items: ["Omnipaque", "Ultravist370", "Visipague320", "高壓針筒"] },
  { id: "ivp", name: "IVP", sheetName: "Sheet I", icon: "science", accent: "#9333ea", items: ["Ultravist300"] },
  { id: "summary", name: "總盤點彙整", sheetName: "Summary", icon: "inventory_2", accent: "#4f46e5", type: "summary", items: [] },
  { id: "syringe", name: "高壓注射器針筒", sheetName: "Sheet J", icon: "syringe", accent: "#0d9488", type: "syringe", items: ["高壓針筒", "延長管", "三通閥"] }
];

export const DEFAULT_SETTINGS = {
  apiUrl: "https://script.google.com/macros/s/AKfycbyzlRGnF0LrTkGGLj1j2gpd7RX95EgEd88kP40XFNJJTCQCGa6uB02ypOhpyiy8t1Iv/exec",
  sheets: Object.fromEntries(ROOMS.map((room) => [room.id, room.sheetName])),
  initialStocks: {
    "rct:omni": 26,
    "rct:ultravist370": 32,
    "ct3:omni": 50,
    "ct1:omni": 54,
    "vascular:omni": 10,
    "vascular:ultravist370": 9,
    "special:omni": 2,
    "special:ultravist300": 5,
    "special:ultravist370": 8,
    "special:barium": 17,
    "ivp:ultravist300": 17,
    "mri1:ultravist300": 17,
    "mri1:gadovist": 0,
    "mri1:dotarem": 0,
    "mri1:primovist": 0,
    "mri3:gadovist": 0,
    "mri3:dotarem": 0,
    "mri3:primovist": 0,
    "mri3t:gadovist": 0,
    "mri3t:dotarem": 0,
    "mri3t:primovist": 0,
    "ct1:visipague": 0,
    "ct3:visipague": 0,
    "rct:visipague": 0,
    "vascular:visipague": 0
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
      apiUrl: parsed.apiUrl || DEFAULT_SETTINGS.apiUrl,
      sheets: { ...DEFAULT_SETTINGS.sheets, ...(parsed.sheets || {}) },
      initialStocks: normalizeInitialStocks(parsed.initialStocks || {})
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

export function stockKey(roomId, itemKey) {
  return `${roomId}:${itemKey}`;
}

export function getInitialStock(settings, roomId, itemKey) {
  return Number(settings.initialStocks?.[stockKey(roomId, itemKey)] || 0);
}

function normalizeInitialStocks(savedStocks) {
  const normalized = { ...DEFAULT_SETTINGS.initialStocks, ...savedStocks };
  const legacyMap = {
    ct1: "ct1:omni",
    ct3: "ct3:omni",
    rct: "rct:omni",
    mri1: "mri1:gadovist",
    mri3: "mri3:gadovist",
    mri3t: "mri3t:gadovist",
    special: "special:omni",
    vascular: "vascular:omni"
  };
  Object.entries(legacyMap).forEach(([legacyKey, newKey]) => {
    if (savedStocks[legacyKey] != null && savedStocks[newKey] == null) {
      normalized[newKey] = Number(savedStocks[legacyKey] || 0);
    }
    delete normalized[legacyKey];
  });
  return normalized;
}
