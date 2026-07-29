# 台灣影廳畫幅模擬器

**線上使用：<https://cowton0627.github.io/taiwan-theater/>**

同一部片在不同影廳，實際看到的畫面有多大？

輸入電影的發行畫幅（1.43 / 1.85 / 1.90 / 2.39 …），依各影廳銀幕的實際寬高計算「有效成像面積」並排名。核心觀念：**銀幕大不等於畫面大**——2.39:1 的片在 1.90:1 的 IMAX 幕上會上下留黑，1.43:1 的片在 Scope 幕上會左右留黑；排名會因片而異。

## 功能

- **單一排名清單**（隨所選影片的畫幅而變）＋**疊圖比較**：同比例尺、每 5 公尺格線、1.7m 人形參照，點卡片自選最多 6 廳
- **三種排序**：成像面積（㎡）／音效層級（8 級，認證與規格層級非實測音質）／綜合評比（逐項得分卡，公式透明、未查證標「？」不扣分）
- **篩選**：片單（含任意畫幅輸入 0.5–4）、影城品牌、地區、城市（地理順序）
- **每廳資訊**：平日 2D 全票票價（顯示不計分）、分店級訂票深連結、地址與 Google Maps、座位數、音效層級徽章與色彩圖例
- **決策摘要一行**：把排名翻成結論（「第 1 名是第 2 名的 2.1 倍」），隨篩選與排序即時更新
- **URL 狀態分享**：選片／篩選／排序／自選比較全部入網址，F5 不歸零、可傳給朋友；og 分享卡已就緒
- **行動版首屏**：控制列選完收成一行摘要、疊圖預設收合

## 使用

```bash
npm install
npm run dev      # 開發
npm run build    # 產出 dist/
```

推上 GitHub 後：repo Settings → Pages → Source 選「GitHub Actions」，push main 即自動部署。

## 資料維護

| 檔案 | 內容 | 維護方式 |
|------|------|----------|
| `src/data/screens.json` | 影廳銀幕尺寸、音效層級、座位、票價、訂票深連結、地址 | 手工維護，每筆須附 `sources` |
| `src/data/films.json` | 電影各版本畫幅（含信心旗標）、拍攝規格、原生大畫幅片段 | 手工維護（TMDB 無畫幅欄位），來源如片商格式頁、BBFC、媒體 |
| `public/data/tmdb.json` | 台灣片單（階段二） | **尚未入庫**——workflow 目前停用（見下） |

- 資料庫現況：**50 筆影廳（46 筆營運中、4 筆歇業保留歷史紀錄）**，涵蓋全台 IMAX、杜比影院、DVA、LUXE、巨幕、ScreenX 與代表性 Atmos 廳。
- `verified` 欄位標記**銀幕尺寸**是否經官方公布或丈量查證：目前 4 筆為 `true`（美麗華 IMAX GT、台茂 IMAX、國賓鉅院廳、嘉義 in89 IMAX），其餘為社群流傳值待查。roadmap 30 規劃升級為**欄位級 provenance**（尺寸／音效／席次／票價各自標可信度）。
- **TMDB 狀態**：`update-tmdb.yml` 已停用（disabled），排程不會執行、無成功紀錄；啟用步驟＝repo Settings → Secrets 加 `TMDB_TOKEN`（v4 Read Access Token）→ `gh workflow enable "Update TMDB film list"`。啟用前 roadmap 7 不打勾。

**徵求資料**：任何影廳的官方尺寸或丈量紀錄、音響聲道實測、座位數——請開 [GitHub issue](https://github.com/cowton0627/taiwan-theater/issues) 附來源，資料衝突會並列各說法不隱藏異議。

## 資料來源與致謝

- 比較方法啟發自 [rexx/theater-screen-size-2](https://github.com/rexx/theater-screen-size-2)（該 repo 未附授權，本專案未沿用其程式碼，資料獨立整理）
- 銀幕尺寸與音效：各影城官網／官方 FB、PTT Theater 板整理與實測文（2026/07《奧德賽》全台十廳簡評等）、Dcard 實測、媒體開幕報導——逐筆記於各資料的 `sources`
- 杜比認證體系（Dolby Cinema／DVA／Atmos 授權三層級）：Dolby 官方新聞稿與規格文件
- 片單資料將來自 [TMDB](https://www.themoviedb.org/)（本專案未獲 TMDB 背書）

## Roadmap（精簡版，完整見 [roadmap.md](roadmap.md)）

- [x] 階段一：畫幅 × 銀幕模擬器＋疊圖、三種排序、綜合評比、票價、URL 分享、行動版首屏（roadmap 1–29 主體完成）
- [x] 訂票深連結：基礎建置完成（50 廳分店級連結），後續持續維護
- [ ] 進行中：口碑與推薦座位策展（14）、體驗型廳與座位補全（16）、來源可追溯（33→30）、卡片漸進展開（32）、淺色模式（3）
- [ ] 階段二：TMDB 片單接入（7，workflow 停用中）
- 場次不做爬蟲：商業影城無公開場次 API（文化部 cloud.culture.tw 僅涵蓋藝文場館），以各分店訂票深連結替代
