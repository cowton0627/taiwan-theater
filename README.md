# 台灣影廳畫幅模擬器

同一部片在不同影廳，實際看到的畫面有多大？

輸入電影的發行畫幅（1.43 / 1.85 / 1.90 / 2.39 …），依各影廳銀幕的實際寬高計算「有效成像面積」並排名。核心觀念：**銀幕大不等於畫面大**——2.39:1 的片在 1.90:1 的 IMAX 幕上會上下留黑，1.43:1 的片在 Scope 幕上會左右留黑；排名會因片而異。

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
| `src/data/screens.json` | 影廳銀幕尺寸、類別、音響、訂票連結 | 手工維護，每筆須附 `sources` |
| `src/data/films.json` | 電影各版本畫幅、音效規格 | 手工維護（TMDB 無畫幅欄位），來源如 IMDb Technical Specs、發行商公告 |
| `public/data/tmdb.json` | 台灣上映中／即將上映片單 | `scripts/fetch-tmdb.mjs`，GitHub Actions 每日執行（需 `TMDB_TOKEN` secret，見 `.env.example`） |

`screens.json` 的 `verified` 欄位標記尺寸是否經過查證；目前種子資料皆為社群流傳值（`verified: false`），待逐廳補來源。**徵求資料**：MUVIE TITAN、板橋／台中／高雄大遠百 IMAX、各 Dolby Atmos 廳的實測或官方尺寸。

## 資料來源與致謝

- 比較方法啟發自 [rexx/theater-screen-size-2](https://github.com/Rexx/theater-screen-size-2)（該 repo 未附授權，本專案未沿用其程式碼，資料獨立整理）
- 銀幕尺寸主要來源：PTT Theater 板〈全台灣 IMAX／巨幕廳資料整理〉（IMAX 數據源自 lfexaminer.com）
- 片單資料來自 [TMDB](https://www.themoviedb.org/)（本專案未獲 TMDB 背書）

## Roadmap

- [x] 階段一：畫幅 × 銀幕模擬器（本版）
- [ ] 階段二：接上 TMDB 片單，點片名自動帶入畫幅（畫幅仍手工標註）
- [ ] 階段三：各影廳訂票頁深連結完善；商業影城無公開場次 API（文化部 cloud.culture.tw 僅涵蓋藝文場館），不做爬蟲
