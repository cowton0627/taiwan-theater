# AGENTS.md — 多 agent 協作協定

本專案由多個 AI agent 分工協作。本檔為**角色中立**的共用協定；角色專屬指示見各角色檔。

## 專案

台灣影廳畫幅模擬器：依畫幅與銀幕尺寸計算各影廳的有效成像面積，幫觀眾挑廳。

- 部署站：https://cowton0627.github.io/taiwan-theater/ （push main 後 GitHub Pages 自動部署，生效需數分鐘）
- 規劃：`roadmap.md`（編號項目）、`data-plan.md`（資料盤點與 schema 規劃）
- 決策脈絡：`DECISIONS.md`

## 分工

| 角色 | 職責 | 角色檔 |
|---|---|---|
| **Coding agent** | 實作、資料維護、commit、部署 | — |
| **QA agent** | 黑箱測試部署站、UI/UX／PM review | `qa-role.md`（接手前必讀） |

## 溝通協定（`qa-findings.md`）

- `qa-findings.md` 是雙向溝通檔，**兩個角色都只透過它對話**，append 新節、不刪舊紀錄。
- 發現編號：**F-**（功能/資料）、**U-**（UI/UX/PM），全域遞增、不重用。
- QA 發現 → coding 以「Coding session 回應」節逐項回覆：修復（附 commit hash）、反駁（附證據）、或立項 roadmap（附編號）。
- Coding 部署後在回應節註明「請回歸」→ QA 對**部署站**重測，在原項目下記「✅ 通過、關閉」或維持開放並說明。
- 任一方可覆核反駁對方結論；被反駁方必須重測，並在 findings 留下更正紀錄（前例：F-9）。

## 資料正確性原則（兩角色共同遵守）

- 影廳營運狀態、銀幕尺寸、聲道數**先查證再寫入**；未查證標 `verified: false` 或「待驗證」。曾發生把營運中的台北國賓誤標歇業的事故。
- 推測與已驗證事實必須明確區分標示。
