# 資料外部核對紀錄（2026-07-29）

本文件記錄 `src/data/screens.json` 與 `src/data/films.json` 的外部查核結果。
查核時點為 Asia/Taipei 2026-07-29。優先順序為官方影城／片商／設備商，
其次為政府或可信媒體；論壇只作線索，不據此把 `verified` 翻為 `true`。

狀態：

- `確認`：現值有直接、可存取的第一方來源支持。
- `部分確認`：核心主張成立，但部分欄位仍只有二手來源。
- `應修正`：已有足夠證據指出現值錯誤或缺漏。
- `待證`：搜尋不到足以支持現值的可靠來源，或不同來源衝突。

## 第一批：影響排名與電影版本的高風險資料

### 影廳

| id | 欄位／主張 | 現值 | 判定 | 查核結果與建議 |
|---|---|---:|---|---|
| `miramar-dazhi-imax-gt` | 銀幕 | 28.4 × 20.54 m | 確認 | 美麗華官方 IMAX 頁直接列出 28.4 × 20.54 m；舊有 21.2 m 高度不應再採用。 |
| `miramar-dazhi-imax-gt` | 音響 | IMAX 12.1 | 確認 | 同一官方頁直接列出 12.1 聲道。 |
| `miramar-dazhi-imax-gt` | 席次 | 404 | 確認 | 美麗華官方團劃／包廳頁列 IMAX 404 席。 |
| `miramar-dazhi-dolby` | 席次 | `null` | 應修正 | 美麗華官方團劃／包廳頁列 Dolby Cinema 303 席，建議補為 `303`，並加入官方來源。 |
| `miramar-dazhi-dolby` | 銀幕 | 14.8 × 7.0 m | 待證 | 官網 Dolby Cinema 介紹頁未列尺寸；目前資料所稱官方 Facebook 原文尚未取得可穩定引用的頁面。維持數值時不應只因官網可確認廳型便翻正尺寸。 |
| `ambassador-taipei-grand` | 銀幕 | 22 × 12 m | 確認 | 國賓官方影城介紹直接列出 22 × 12 m Harkness 銀幕。可將尺寸 `verified` 翻為 `true`。 |
| `ambassador-taipei-grand` | 投影 | 雙機 4K RGB 雷射、90,000 流明 | 確認 | 國賓官方頁直接支持。 |
| `ambassador-taipei-grand` | 「全台最大 Atmos 影廳」 | notes 內相關敘述 | 確認為業者自稱 | 國賓官方使用「全台最大的 Dolby Atmos 影廳」。應寫成「國賓官方稱」，不要延伸成全球排名。現有「全球第二大」仍只有二手來源，待證。 |
| `in89-chiayi-imax` | 銀幕 | 21.5 × 12.3 m | 確認 | in89 官方 IMAX 特刊列 21.49 × 12.31 m；現值為合理四捨五入，可翻正尺寸。 |
| `in89-chiayi-imax` | 雷射／12.1 聲道 | 雷射、IMAX 12.1 | 部分確認 | 官方特刊可確認雷射 IMAX；12.1 的直接證據目前是官方 Facebook 截圖被論壇轉載，尚需取得原始官方頁或詢問影城。 |
| `in89-chiayi-luxe` | 銀幕 | 20.5 × 10.5 m | 待證 | 目前可搜尋證據是官方 Facebook 規格的論壇轉載，尚未取得穩定的官方原頁；暫不翻正。 |
| `vieshow-hualien-imax` | 雷射／12.1 聲道 | 雷射、IMAX 12.1 | 確認 | 威秀官方花蓮據點頁直接列出 IMAX 雷射與 12.1 聲道。 |
| `vieshow-hualien-imax` | 銀幕 | 21.3 × 12 m | 待證 | 官方頁未列尺寸；目前數值仍來自非官方資料庫／論壇整理。 |
| `milihsin-taimall-imax` | 席次 | 325 | 來源衝突 | 文化部舊表列 329 席，專案稱現行官方為 325，但本輪未找到可引用的官方規格頁。需確認 325 是否不含 4 個無障礙席；在釐清前不宜把整筆尺寸與席次一起視為已驗證。 |
| `skcinemas-taoyuan-luxe` | 席次 | 328 | 來源衝突 | 專案來源文字同時出現 322 與 328。應取得新光現行座位圖或官方包廳資料後再定值。 |

### 電影

| id | 欄位／主張 | 判定 | 查核結果與建議 |
|---|---|---|---|
| `the-odyssey-2026` | 全片以 IMAX 底片攝影機拍攝 | 確認 | 電影官方格式頁與 IMAX 官方頁均直接確認。 |
| `the-odyssey-2026` | IMAX 70mm 全片 1.43:1 | 確認 | 官方格式頁明列 IMAX 70mm 為 1.43:1；但台灣美麗華是 GT Laser，不是 70mm，台灣實際 DCP 是否全片 1.43 仍應另以台灣場次或影城公告證實。 |
| `the-odyssey-2026` | 片長 172 分 | 確認 | IMAX 官方頁與美麗華官方場次頁均列 2 小時 52 分／172 分。 |
| `the-odyssey-2026` | 「5.1 聲道（無 Dolby Atmos）」 | 待證，且容易誤導 | 電影確實在美麗華 Dolby Cinema 放映；這不等於一定有 Atmos 原生混音，也不等於沒有。現有官方格式頁未直接支持此音效結論。建議在取得片尾技術資料、Dolby 官方片單或發行規格前改為「音效格式待確認」。 |
| `spiderman-brand-new-day-2026` | 片長 145 分 | 確認 | AP、BBFC 與美麗華官方場次資料相符。 |
| `spiderman-brand-new-day-2026` | 台灣 7/29 上映、無 IMAX 場次 | 部分確認 | 美麗華官方 7/29 起只列 Dolby Cinema 與標準廳，IMAX 繼續放映《奧德賽》，可直接支持美麗華無 IMAX；其他台灣 IMAX 據點仍應抽查後，才能寫成全台排他性結論。 |
| `spiderman-brand-new-day-2026` | Shot for ScreenX | 確認 | BBFC 有 `Shot for Screen X` 宣傳片分級紀錄，導演公開說法亦支持專為側翼畫面拍攝。現有 schema 無法把這項版本資訊對應到 ScreenX 影廳，屬既知建模缺口。 |
| `spiderman-brand-new-day-2026` | 全片 2.39:1 基準 | 待證／可能過度簡化 | 目前沒有找到片商第一方技術頁直接支持「唯一基準 2.39」。已有市場資料指一般 Flat 與 Scope 可能分別最佳化為 1.90 與 2.39。建議在取得台灣 DCP 規格前，不要只建一個 STANDARD 2.39 版本。 |
| `dune-part-three-2026` | 2026-12-18 上映、IMAX 70mm | 確認 | IMAX 官方售票公告直接支持。 |
| `dune-part-three-2026` | 大部分採 IMAX 底片、沙漠保留數位 IMAX | 確認 | Motion Picture Association 專訪直接引述導演：「a big part」以 IMAX film 拍攝，沙漠使用 digital IMAX。 |
| `dune-part-three-2026` | 攝影 Linus Sandgren | 確認 | 同一 Motion Picture Association 專訪直接支持。 |
| `dune-part-three-2026` | 1.43／1.90／2.39 版本比例 | 維持 `expected` | 官方已確認 IMAX 70mm，但尚未公布完整比例切換與台灣 DCP 配置；現有 `confidence: expected` 是正確做法。 |

## 本批可直接採用的修正

1. `miramar-dazhi-dolby.seats`: `null` → `303`。
2. `ambassador-taipei-grand` 的 22 × 12 m 可改為已驗證；「全球第二大 Atmos」不可隨之視為已證實。
3. `in89-chiayi-imax` 的銀幕尺寸可採官方特刊精確值 21.49 × 12.31 m，或保留目前四捨五入值並翻正。
4. 《奧德賽》的 `audio` 暫改為「音效格式待確認」，不要把「有 Dolby Cinema 場次」或「原生 5.1」自行推導為有／無 Atmos。
5. 《蜘蛛人：重生日》不宜把一般廳唯一建模為 2.39；先標待證，並另行抽查台灣 Flat／Scope DCP。

## 來源

- [美麗華 IMAX 官方介紹](https://www.miramarcinemas.tw/Home/imaxcinema)
- [美麗華 Dolby Cinema 官方介紹](https://www.miramarcinemas.tw/Home/dolbycinema)
- [美麗華官方團劃／包廳資料（含各廳席次）](https://www.miramarcinemas.tw/Home/groupticket2)
- [美麗華官方場次](https://www.miramarcinemas.tw/timetable)
- [國賓大戲院官方介紹](https://shinefilm.ambassador.com.tw/home/theater_intro_b1)
- [in89 官方 IMAX 特刊 PDF](https://imax.in89cinemax.com/wp-content/uploads/2022/05/IMAX%E7%89%B9%E5%88%8A.pdf)
- [威秀花蓮新天堂樂園官方據點頁](https://www.vscinemas.com.tw/theater/detail.aspx?id=21)
- [《奧德賽》官方格式頁](https://www.odysseymovie.com/explore-formats/)
- [《奧德賽》IMAX 官方頁](https://www.imax.com/theodyssey)
- [《蜘蛛人：重生日》BBFC 分級資料](https://www.bbfc.co.uk/release/spider-man-brand-new-day-q29sbgvjdglvbjpwwc0xmtezmty0)
- [《沙丘：第三部》IMAX 70mm 官方公告](https://www.imax.com/news/dune-part-three-in-imax-70mm-film)
- [Motion Picture Association 對 Denis Villeneuve 的專訪](https://www.motionpictures.org/2026/03/denis-villeneuve-on-filming-dune-part-three-as-a-more-tense-more-muscular-imax-film/)

## 尚待後續批次

- 其餘 IMAX 廳的尺寸、雷射世代、聲道與席次。
- Dolby Cinema／DVA／Atmos 名單的排他性核對。
- 巨幕、LUXE、ScreenX、TITAN 等品牌廳的標稱尺寸與實測尺寸分離。
- 48 筆營運狀態、票價、地址與訂票深連結逐筆抽查。
- 台灣各 IMAX 據點 2026-07-29《蜘蛛人：重生日》版本抽查。
