# 架構決策紀錄

## 2026-07-28 資料收錄準則

### 只收真正商業影廳
科教場館（海科館 8K 巨幕等）平常不放商業電影，對「這部片去哪看」沒有參考價值，自資料庫移除、不再收錄。曾為 IMAX 的歷史可留在文件，不佔資料列。

### 音效認證分級依據
杜比在影院端有三個常被混用的層級：Dolby Cinema（整廳認證）＞ DVA（2024/4 杜比開放的 Vision+Atmos 授權，不掛 Dolby Cinema 牌，例：大巨蛋秀泰）＞ Atmos 授權廳（僅音響系統依規範安裝校準）。未來 `audioTier` 欄位以此分級（見 `data-plan.md` §4），不把 DVA 廳誤標為杜比影院。

## 2026-07-28 分類架構

### hallCategory 與描述欄位分離
`hallCategory`（IMAX_GT/IMAX/DOLBY_CINEMA/PREMIUM/STANDARD）只負責一件事：決定該廳拿到哪個發行版本畫幅。放映系統（雷射/氙燈/8K/LED）、廳品牌（MUVIE TITAN、鉅院廳、DVA）、Atmos 與否都是獨立描述欄位，不混進類別——否則類別會組合爆炸。

### 尺寸可為 null
杜比影院與多數 Atmos 廳不公布銀幕尺寸。與其漏掉這些廳，收錄後標「尺寸未公布」、不納入成像排名。`isSized` type guard 區分兩者。

### 已歇業影廳保留資料、UI 過濾
`status: closed`（如西門 in89、台南國賓）保留在 JSON 供未來歷史區塊使用，UI 只顯示 operating。

## 2026-07-27 專案起始

### 靜態網站而非 App
資料管線（JSON + GitHub Actions）與呈現分離，先用 GitHub Pages 免費託管、網址可分享。之後要做 iOS App 可直接吃同一份 JSON。低頻查詢工具不值得承擔上架與發版成本。

### 場次不做爬蟲
查證結果：台灣商業影城（威秀／國賓／秀泰等）無公開場次 API。文化部 `cloud.culture.tw` category=8 API（政府資料開放授權）只涵蓋博物館、圖書館、影展等藝文放映，不含商業影城。爬開眼等聚合站維護成本高、易壞，改用各影城訂票頁深連結。

### 畫幅資料手工維護
TMDB 沒有畫幅（aspect ratio）欄位；IMDb Technical Specs 有但無開放 API。台灣每週值得標註的大片僅數部，手工維護 `films.json` 成本低於任何自動化方案。

### 不沿用 rexx/theater-screen-size-2 的資料與程式碼
該 repo 無 LICENSE（預設保留所有權利）。本專案獨立實作，資料結構自訂，種子資料標記 `verified: false` 與 `sources`，待逐廳以丈量紀錄或官方來源查證後翻正。README 致謝原專案。

### 一般廳的版本不確定性
同一部片對一般廳可能同時發行 1.85（flat）與 2.39（scope）版，實際排哪版依影城而定。計算時取成像面積較大者並在 UI 標註「依影城而定」，不假裝知道答案。

### vite base 用相對路徑 './'
GitHub Pages 部署在 `/<repo>/` 子路徑，相對路徑不用綁定 repo 名稱。
