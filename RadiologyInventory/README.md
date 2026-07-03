# 放射科對比劑智慧盤點系統 PWA

手機優先的 Progressive Web App，可安裝到 Android / iPhone 主畫面，支援離線瀏覽與本機盤點，並可透過 Google Apps Script 同步 Google Sheets。

## 專案結構

```text
RadiologyInventory/
├── index.html
├── manifest.json
├── sw.js
├── css/
│   ├── style.css
│   └── mobile.css
├── js/
│   ├── app.js
│   ├── ui.js
│   ├── sheet.js
│   ├── inventory.js
│   ├── setting.js
│   └── timeline.js
├── icons/
├── assets/
├── gas/
│   └── Code.gs
└── README.md
```

## 功能

- 首頁 10 個 Material Design 3 icon 卡片：1F CT、3F CT、RCT、1F MRI、3F MRI、3T MRI、特殊、血管、總盤點彙整、高壓注射器針筒。
- 每個攝影室有獨立月份時間軸、缺漏警報、1 至 31 日自動日統計表。
- 新增 Dialog 支援日期、品項、入庫、使用、報廢、備註。
- 自動計算結存：昨日結存 + 入庫 - 使用 - 報廢。
- 排除星期日後檢查本月尚未完成盤點日。
- 設定可維護月初期初庫存、Sheet 對照與 Apps Script API URL。
- 總盤點彙整可切換月份，顯示本月總入庫、總使用、總報廢與月底總庫存，並匯出 CSV 或列印成 PDF。
- PWA manifest、service worker、localStorage 本機快取與更新提示。

## 本機測試

建議用本機伺服器開啟，PWA 與 ES Modules 不建議直接用 `file://`。

```powershell
cd C:\Users\a8520\Downloads\RadiologyInventory
python -m http.server 8080
```

開啟：

```text
http://localhost:8080/
```

## Google Sheets 設定

1. 建立一份 Google 試算表。
2. 建立或確認下列工作表名稱：`Sheet A` 至 `Sheet J`，也可在系統「設定」中改成自己的名稱。
3. 在 Google Sheets 選擇「擴充功能」>「Apps Script」。
4. 將 `gas/Code.gs` 貼到 Apps Script。
5. 部署為 Web App：
   - 執行身分：自己
   - 存取權：知道連結的任何人，或依院內 Google Workspace 權限設定
6. 複製 Web App URL，貼到 PWA 右上角「設定」>「API 網址」。

## Sheet 欄位

Apps Script 會自動建立表頭：

```text
id, roomId, date, item, inQty, usedQty, wasteQty, note, updatedAt
```

每個 Icon 會依設定中的 Sheet 名稱讀寫自己的工作表。

## 部署

可部署到任一靜態網站服務，例如 GitHub Pages、Firebase Hosting、Netlify、院內 IIS / Nginx 靜態目錄。

正式部署需使用 HTTPS，否則多數瀏覽器不會啟用 PWA 安裝與 service worker。

## 後續擴充

- 新增攝影室：編輯 `js/setting.js` 的 `ROOMS` 與 `DEFAULT_SETTINGS.initialStocks`。
- 新增品項：在對應 room 的 `items` 陣列加入品項。
- 更換 Google Sheet：在 App 右上角設定修改 Sheet 名稱。
- 改表格格式：優先修改 `js/ui.js` 的 render functions。
- 改盤點規則：集中修改 `js/inventory.js`。
