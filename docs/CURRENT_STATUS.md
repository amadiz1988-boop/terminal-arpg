# 目前狀態

## 2026-09-26 F 五張原廠掛機地圖 Native 准入阻擋

- 授權的 Native `15d5c35` 已通過來源權威、f7 祖先與精確三檔差異檢查；25 項新來源檢查 PASS，並已推至 Native GitHub main。Fresh Release x64 編譯成功，但既有 canonical 離線測試仍要求舊怪物來源白名單，以 `M1_DYNAMIC_NORMAL_SPAWN_SOURCE_FAILED` 中止。完整證據與下一授權需求見 [五圖 Native 建置阻擋](project-control/m1-v15-five-map-native-build-blocker-2026-09-26.md)。Production 保持 f7，五圖 live 驗收尚未執行。

## 2026-09-26 彩虹橋地圖清單呈現來源候選

- A 的既有世界地圖分支沿用 Kafra 26 地圖、39 儲存點與 274 張掛機圖。原圖只保留掛機圖點擊；城鎮與儲存據點改由下方「地圖清單」進入，按城鎮、野外、洞穴分組。
- 野外及洞穴以普通永久怪物的出生數加權平均等級排序；城鎮依可達的一跳野外平均等級排序，無一跳時使用最近野外層，無資料仍顯示。桌機 1440×900 與手機 390×844 的隔離 Dashboard 瀏覽器驗證已通過；Production、Native runtime 與玩家狀態均未變更。
- 地圖清單已改為三欄名稱按鈕，手機長名稱最多兩行。城鎮按鈕直接開既有傳送確認；野外、洞穴的等級與傳送條件集中於精簡資訊彈窗，再接既有掛機確認。原有「設為儲存據點」保留為身處可儲存地圖時的獨立操作。隔離瀏覽器已驗證三條既有 API 請求路徑，未執行正式玩家傳送或 Production 部署。

## 2026-09-26 M1 V15 Economy Test Player 來源候選

- Project Control 已改用固定 TEST_PLAYER 2000163／150105、`group_id=0`、`is_test=1` 執行 Store／Sell 驗收。先前要求借用一般非測試帳號的預檢結論已被取代。
- Native `06da93f1` 在 personal storage 與 NPC sell 入口加入固定 TEST_PLAYER 的 group-0 准入，並於既有本機 Admin fixture transport 加入固定 502／503 物品的準備與清理；一般交換、丟棄、擺攤、郵件與公會倉庫仍受原限制。原生 Release x64 編譯與離線回歸已通過；本次增補的倉庫載入前置檢查通過 M1 V15 來源測試。Store／Sell live mutation 尚未驗收。
- 01:04 UTC 事故證據已封存，原因仍為 `UNKNOWN`。同一 Production runtime 經一次受控重啟後於 02:01 UTC 健康。Native 新候選尚未部署，首次 GitHub-first 推廣仍未完成。

## 2026-09-26 M1 V15 經濟驗收資格預檢

- 即時唯讀檢查確認指定角色 150095 的 `is_test=1`，因此不進行正常玩家 Store／Sell 驗收；有界盤點找到 14 名一般非測試角色，但尚無可用的合法 Player 登入與安全物品準備路徑。同輪健康檢查顯示 login、char、map 埠未監聽，事故分類仍為 `UNKNOWN`。驗收停在前置條件，未改動 Production 或玩家狀態，也未重啟服務。證據見 [M1 V15 normal-player economy preflight](project-control/m1-v15-normal-player-economy-preflight-2026-09-26.md)。
## 2026-09-25 M1 legacy launcher GitHub-first 來源重建

- 已在隔離的 V15 Web 候選中以 Production `ro-stack.ps1` 精確 preimage 重建 launcher，保留現行生命週期、PA/Service/Supply 投影與 single-runtime 行為，加入明確的 M1 Supply 啟動環境投影。來源對帳及能力矩陣見 [M1 launcher reconciliation](project-control/m1-legacy-launcher-reconciliation-v1.md)。
- 舊有 PA 投影測試原有 36 項失敗已在重建來源通過；M1 值域及 exact preimage-subsequence 測試通過。完整 Web manifest 已加入此既有 Production 檔案的精確採納與回復契約。此來源候選尚未部署，Production 設定及 Native runtime 尚未變更。

## 2026-09-25 M1 首次推廣 Native 候選鏈來源治理

- 同一份首次推廣 lease 的 Native 第二次修訂已建立鏈式准入工具與隔離測試。歷史 shutdown-race 修訂以原收據雜湊固定；後續修訂驗證目前部署候選、GitHub 來源、核准原因、受限差異、直接測試、前一候選 rollback 與單一 runtime。第二次修訂的候選來源、部署與最終驗收仍未完成。
- Production 僅接受唯讀歷史鏈檢查，沒有因本項來源治理而變更檔案、角色狀態或重啟服務。

## 2026-09-24 Web Runtime 私有素材套件

- 已建立本機私有套件 `ghost-island-web-runtime-assets-v1`，其 3,267 個必要素材均通過大小與 SHA-256 驗證；套件與清單雜湊固定於 `docs/project-control/web-runtime-asset-package-lock-v1.json`。來源與限制見 `docs/project-control/web-runtime-private-asset-package-v1.md`。
- 原列為可重製的 2,476 個衍生素材尚未完成逐位元組重跑驗證，已改列 `PRIVATE_PACKAGE_REQUIRED`，由完整私有套件供應。正式環境未部署，素材未發布至 GitHub。
- 隔離的乾淨 Web checkout 已使用套件補齊並核對全部 3,267 個素材，缺檔與雜湊不符均為 0；13 支離線來源回歸通過。需本機憑證或連線的 Browser／live 測試沒有納入此次 PASS。

## 2026-09-24 M1 Web Full Production Superset V2 來源整合

- 以 M1 Web `0cbfd0b4` 為基礎，整合目前 Production 已接受的技能樹、原版按鈕音效、Admin recovery/security、support session、寵物與地板素材，同時保留 M1 World Map、Supply、同圖掛機、傳送呈現、角色設定與 Discord 帳號連結。完整來源與 Production 資產分類見 [M1 Web Full Production Superset V2](project-control/m1-web-full-production-superset-v2.md)。
- 限定來源測試已通過；Production 部署、服務重啟、端點測試及 Browser 驗收均未執行。

## 2026-09-24 M1 Web 與 Admin recovery 來源整合

- 從 M1 Web `dff86f79` 整合 Production 已接受的 Admin quarantine recovery `be9ddb39`：沿用既有 recovery adapter 與 Native command，補齊 Admin API、Fleet「安全恢復」及 Cloudflare Access Admin host 邊界。公開 Player host 與無憑證 loopback 的 Admin API 請求回 403，沒有新增 Player session 或 Admin Browser 登入流程。
- 同圖 AUTO_FARM 舊測試改為執行目前 World Map 入口。進行中的掛機維持原狀；待機只送出 `start_farm`；測試確認傳送指令 0、費用 0、冷卻寫入 0、非必要重啟 0。
- World Map、Map Info、Supply、設定映射、傳送音效狀態機、Admin recovery/security、Web canary 的限定來源測試通過。Production 部署、服務重啟與 Browser 驗收均未執行；來源驗證不代表 Production 玩家流程通過。

## 2026-09-24 M1 世界移動與掛機規格

- 產品決策唯一權威：[M1 世界移動、補給與介面產品決策 V1](project-control/canonical-m1-world-travel-supply-ui-v1.md)，狀態 `CANONICAL / ACTIVE`。玩家換掛機地圖與 Supply 世界段採直接權威傳送；城內補給仍用既有 Navigation。可見根及其正常常駐樓層依新規格分類，舊 STANDARD、28/136 與泛用 `QUEST_ACCESS_REVIEW_REQUIRED` 限制只保留歷史證據。
- 此項為規格固化；來源實作、合成測試、本機 Browser 與 Production 玩家 Browser 的完成狀態各自核定，本段不宣告 M1 產品驗收通過。

## 2026-09-23 更換掛機地圖的大地圖迷霧移除

- 原廠世界地圖取消底圖暗化與區域明暗拼貼，保留既有可選地圖條件與停用狀態；未變更掛機或換圖指令。
- Source checkpoint `a5efb93`，整合部署 checkpoint `a342c0c`。正式 manifest 部署通過，Browser 重整後確認地圖無迷霧、可選區域仍能開啟資訊、不可選區域維持停用，`/api/health` 為 `ok:true`，OpenKore 執行數為 0。

## 2026-09-23 M1 Local Hunting 來源閉合進度

- 已將 pinned OpenKore 59 項成熟能力完整分派至 M1 必要 38、M1 選用 14、後續 6、不適用 1；每個 M1 必要項的現況、PA seam、首個斷點、修正與 UI 啟用條件記於 `docs/openkore-reference/m1-core-hunting-closure.md`。這是來源盤點，尚非玩家流程驗收。
- Synthetic 換圖矩陣改用與 Player endpoint 相同的 `planFarmMapChange`。先前只查 direct physical route，將 `moc_pryd01` 到 `mjolnir_07`／`pay_fild04` 均誤列 `NO_DIRECT_ROUTE`；完整 weighted planner 對兩者皆產生 Kafra multimodal candidate。矩陣未驗角色物資、SavePoint、執行、到達或戰鬥恢復。
- `test-openkore-mature-capability-census.mjs`、`test-player-scenario-runner.mjs` 及既有 multimodal planner 測試通過。M1 source candidate 尚未完成；Production 未部署、runtime 未重啟。

## 2026-09-22 Discord OAuth Account Linking V1

- 已加入 provider-neutral `account_external_identity` 與一次性 `web_oauth_state` migration，沿用既有 rAthena `login.account_id`、Web password credential 與 `web_sessions`，沒有建立第二套 account 或 character authority。
- 已加入 server-side Discord authorization-code flow、`identify` 最小 scope、state／flow-cookie／原 session 綁定、callback replay 防護、session rotation、Discord unique identity mapping 與安全 unlink。未知 Discord identity fail closed，V1 限定既有帳號綁定與已綁定帳號登入。
- `DISCORD_LINK_REQUIRED` 預設關閉；`DISCORD_GUILD_ID`／`DISCORD_GUILD_MEMBERSHIP_REQUIRED` 保留 extension seam，沒有 Bot、Role、踢人或 feedback bot。真實 Discord provider 尚未配置，因此 Browser OAuth callback acceptance 為 `REQUIRES_CONFIGURED_DISCORD_APP`。
- 驗證：`node scripts/test-discord-oauth-account-linking.mjs` 通過 11 項 flow checks，`node --test scripts/test-discord-identity-store.mjs` 通過 19 項 persistence／route checks；Node syntax checks 通過。Production 未部署、未重啟。

## Future Roadmap

長期方向與未來工作的唯一入口是 `docs/PROJECT_ROADMAP.md`；詳細未來系統置於 `docs/roadmap/`。以下僅為指標，不是現行實作狀態，且不代表已授權實作。

| 項目 | 規劃狀態 | IMPLEMENTATION_AUTHORIZED |
| --- | --- | --- |
| OpenKore Exit（現行工程優先） | `ACTIVE` | YES（既有已授權工程線） |
| `PL1-PERSISTENT-LIFE-DIARY`（Persistent Life Diary V1） | `PLANNED` | `NO` |
| `PL2-PERSISTENT-SOCIAL-PA`（Persistent Social PA V1） | `PLANNED` | `NO` |

- 現行工程優先序仍以 `docs/openkore-exit-source-of-truth.md` 為唯一依據。
- 本節不描述實作細節；規劃內容見 `docs/PROJECT_ROADMAP.md`。

## 2026-09-17 UI1 玩家道具說明清理與紙娃娃攻擊同步

- 玩家端道具說明不再顯示 `Item ID`、`原廠…` 來源／美術註記與通用「目前無法裝備」。內部 metadata（ItemID、asset role、provenance label）仍保留在 view model，GM／`?debugAssets`／`window.RO_ITEM_DEBUG` 可繼續查看；消耗品、材料、任務道具與 ETC 一律不顯示裝備限制，只有裝備類且有伺服器提供之自然語言限制時才顯示（例如「限定初心者／超級初心者使用」）。
- `roAssetTooltip`、`equipmentTooltip` 的 ID 與「圖片來源」改為僅在 debug 模式輸出，一般玩家 hover 只看到名稱與玩家必要資訊。
- 紙娃娃攻擊錯位根因：`hair/*-attack.png`（全部 84 組）與 novice／archer／gunslinger 的 `body/*-attack.png` 仍是 2026-09-12 以 ACT 第 40 組（受擊）產生的 5 幀舊圖，而 manifest 已宣告第 32 組（攻擊）6 幀；頭飾層已是 6 幀，因此頭髮／身體播放受擊動作、帽子播放攻擊動作而分離。已用既有 `build-ro-character-showcase.mjs`（新增 `RO_SHOWCASE_SCOPE`／`RO_SHOWCASE_ACTIONS`／`RO_SHOWCASE_PRESERVE_MANIFEST` 局部重建模式）重建 84 組髮型與 6 組身體攻擊圖，並重建逐檔版本雜湊。
- 渲染器 `layerAnchorOffset` 改為「圖層自身畫格」對「身體實際畫格」的共用 head/neck 附著基準，頭飾永遠跟隨最終 head transform，不再因圖層幀數較少而落後一幀。
- 驗證：`test:character-showcase`、`test:ro-item-detail`、`test:ro-asset-index`、`test:ro-item-collection-art`、`test:showcase-versioning-ui`、`npm test`（96/96）、`npm run lint` 通過；390×844 真實 Chrome 道具詳情零外洩；紙娃娃同步探針 24 組合 0 問題，攻擊時帽子對頭髮位移 0px、帽子對身體 ≤3.2px。本輪未觸碰 Navigation／SERVER_AGENT／PA runtime。

## 2026-09-17 LEGACY_OPENKORE_COMPATIBILITY_HOTFIX — 掛機據點轉換 Busy-State 修正

- 修正 `ops/ro-stack/openkore-plugins/status-export/status-export.pl` 的掛機據點轉換 busy-state 缺陷：`process_grind_hub_transition` 原本只在 `AI::isIdle()` 成立時才送 destination `move <hub>`，但轉換期間 `route_randomWalk 1`、`itemsTakeAuto 2` 等背景 AI 持續佔用佇列，`AI::isIdle()` 幾乎不成立，因此永遠不送 move，300 秒逾時後 rollback。
- routing 前先完整快照角色原值 `attackAuto`、`route_randomWalk`、`itemsTakeAuto`、`teleportAuto_idle`（`priorAiSettings`），停止衝突行為，於有界 route-ready 條件後只送一次 destination move（`routeMoveCount`）；SUCCESS／FAIL／TIMEOUT／ROLLBACK／unload 全部還原，`grind_hub_transition_fail` 另還原 `lockMap`／`saveMap` 座標與 route warp 設定。
- 實機 `賴清德`（player_2000102）由 `moc_fild11` 轉換至 `moc_fild02`：destination route 確實發出（日誌 `Calculating route to: Payon ... 181, 104`），實際地圖轉換 `moc_fild11 -> morocc -> payon`，`routeMoveCount=1`；rollback 後四個 AI 設定與掛機目標完整還原並恢復 `moc_fild11` 掛機（`lastCombatAt` 持續更新）。
- 未解 blocker（非本次 busy-state 缺陷）：`verifying` 階段 `ai_useTeleport(2)`（蝴蝶翅膀）遭 rAthena 以 `MSI_BUSY` 拒絕（`clif.cpp`：`sd->npc_id` 未清除），`verificationArrived` 永遠為 false，20 秒後失敗；角色因此一度卡在 payon 卡普拉。此為既有缺陷，`蕭美琴`（player_2000111）以舊外掛亦同樣失敗。已以單一角色 OpenKore 重連解除卡住狀態。
- 已知殘留：失敗前卡普拉已實際寫入伺服器儲存點 `payon 160,58`（DB `char.save_map`），設定端 `saveMap` 依 `priorConfig` 還原為 `morocc`，屬遊戲狀態與設定不一致；此為舊驗證流程本身無法復原的結果，已記錄待後續處理。
- `LEGACY_OPENKORE_COMPATIBILITY_HOTFIX`；`REMOVE_AFTER_SERVER_AGENT_GATE3_W4_MIGRATION`。未觸碰 canonical SERVER_AGENT Gate 3 或 `persistent_agent.cpp`；未重啟 rAthena login/char/map server。`scripts/test-grind-hub-transition.mjs` 的 A–F 決定性測試通過。

## 2026-09-16 Web Experience Observatory Phase 4A Production Telemetry Canary

- 新增預設關閉的 Production Telemetry Canary，限定 `automation_start`、`automation_stop`、`minimap_marker_update`、`quest_open` 與 `inventory_open` 五個 action。遙測採匿名化、固定採樣、記憶體聚合與 24 小時滾動 NDJSON，失敗採 fail-open，不改變玩家操作或遊戲權威狀態。
- Dashboard 由 `/api/session` 傳遞 canary eligibility 與 deployment identity；符合資格的玩家才送 `/api/web-experience/telemetry`。管理摘要與 action 詳情限 loopback，明確區分 `LIVE_CANARY` 與 `SYNTHETIC`，無 live 樣本的 action 維持 `GRAY`。
- deployment identity 優先使用 GIT SHA，否則使用 Dashboard、前端與 telemetry module 的 SHA256。事件禁止密碼、session token、聊天、NPC 對話、完整背包與其他私有內容。
- `PRODUCTION_TELEMETRY_CANARY_PASS`、Telemetry Aggregator、管理後台 1440×900 與 390×844 回歸及 Dashboard 語法檢查通過。正式 Dashboard 本輪未重新載入，rAthena、OpenKore 與線上玩家程序均未重啟；指定的真實 canary 樣本仍待維護窗口收集。
- Phase 4A Production RC 已完成乾淨 overlay 組裝，`PHASE4A_RC_READY=YES`。新的上一版 canonical 回滾包已完成來源雜湊與 ZIP round-trip 驗證，舊 Phase2 包已標記 superseded。Closure evidence 位於 `.local/ro-stack/evidence/WEB_EXPERIENCE_PHASE4A_RC_CLOSURE`，正式 canary 與 reload 仍未執行。

## 2026-09-15 道具詳情與卡片插入視窗

- 306 個道具與 150 個裝備已接入 twRO 說明表，450／456 筆有來源可追溯的繁中說明；缺少來源的 6 筆固定顯示「【資料不足，無法確認】」。
- 道具欄單擊可查看原廠圖示、名稱與說明；Item ID 與來源註記屬內部／debug 資訊，一般玩家畫面不顯示（2026-09-17 UI1 清理）。66 張已驗證卡片使用原廠 300×400 美術。手機使用置中視窗，桌面仍保留卡片 hover 預覽。
- 雙擊使用、裝備與卸裝行為維持。卡片雙擊或詳情視窗的使用按鈕會開啟相容裝備視窗，依卡片部位、裝備部位、總洞數與已插卡數篩選。
- Dashboard 在送出命令前再次驗證部位與空洞；OpenKore 匯出實際卡片欄位，rAthena 維持最終權威。390×844 的卡片詳情、一般道具詳情、候選裝備及零水平溢位測試通過；測試沒有消耗卡片。

## 2026-09-15 掛機拾取統計中文化

- 掛機拾取統計與補給規則已改用中央 RO 資產解析器，不再依賴頁面內少量英文名稱對照。
- 執行期名稱可保留裝備洞數，例如 `Wand [2]` 顯示為「橡木魔杖 [2]」；OpenKore 的 `Pecopeco Card` 拼法也能對齊索引內的 `Peco Peco Card`。
- 截圖中的 15 種物品已加入伺服器端與瀏覽器端回歸檢查，中文名稱來源為版本鎖定的 OpenKore twRO `items.txt`，物品身分由 rAthena ItemID 交叉確認。

## 2026-09-15 Stat Allocation Domain Delta

- 六圍與剩餘能力點已建立獨立 `statRevision`、typed result、同角色序列鎖、commandId 冪等快取及 20 筆有界 optimistic queue。HP/SP 不會推進 Stat revision。
- 能力加點確認已移除 action-driven `/api/events` 輪詢與 full-state refresh；revision mismatch 只校正 Stat state，單一拒絕只回滾該命令。舊格式後端 409 以相同 commandId 有界重試一次，維持維護發布前的相容性。
- 390×844 隔離真實鏈路 12/12 成功，單次 p50/p95/p99 為 318/599/599ms，快速 +5/+10 為 2541/3251ms。正式 8788 相容驗證六項能力 6/6 成功，PID 55612、rAthena 與 OpenKore 均未重啟。
- 完整協定、Before/After 與發布阻擋記錄於 `docs/stat-allocation-domain-delta.md`。

## 2026-09-15 紙娃娃逐檔版本防呆

- 蕭美琴的實際裝備為女劍士、髮型 1、Item 5583 克里圖拉學院帽、View ID 465。現行攻擊資產的八方向各六幀、100ms delay 與第一 anchor 完全一致；帽子和髮型每幀維持固定 20px 垂直重疊。
- 紙娃娃 Manifest 的 2,490 個唯一身體、髮型、頭飾、武器及盾牌圖檔，現已將逐檔 SHA256 前 16 碼附加至各圖層網址。只要內容改變，瀏覽器會取得新網址，未變更圖層仍可使用四小時公開快取；Manifest 不重複保存完整 64 碼欄位。
- 三個紙娃娃建置入口均自動重建版本資料，避免日後重新產圖卻漏更新版本。外網 Manifest、前端版本函式及 View 465 女角攻擊圖已確認生效；版本化帽子圖為 8,757 bytes。
- `test:character-showcase` 已加入蕭美琴組合的 frame count、anchor、delay 同步檢查；外網 390×844 無資料修改的真實 Chrome 測試於 5,741ms 完成登入、進場及紙娃娃預載，三層網址分別取得獨立內容版本，水平 overflow 為 0、browser exception 為 0。`test:ro-asset-index`、中央索引 schema 及相關語法檢查通過。本輪未重啟 Dashboard、rAthena 或 OpenKore。

## 2026-09-15 地圖怪物與伊甸園裝備原廠圖示補齊

- 69 份地圖詳細資料引用的 127 種怪物，已由授權 Client 的 ACT／SPR 產生 96×96 透明預覽並寫入怪物中央索引。
- 伊甸園裝備與目前角色持有物品已依 Client `iteminfo_new.lub`、GRF 及 rAthena 等價 ItemID 資料抽取原廠圖示。現行索引共有 306 個道具與 150 個裝備圖示；457 個 Dashboard 必要 ItemID 全數有圖。
- `assets:dashboard:sync-coverage` 會掃描全部地圖怪物與線上資料庫的背包、手推車、倉庫 ItemID，抽取 Client 原廠資產、重建中央索引並執行零缺口檢查。`unresolvedSource` 與 `missingInGrf` 均為 0；Dashboard resolver 每 5 秒偵測索引異動並載入，無需重啟服務。
- 新增 runtime-awarded equipment requirement 清單，補圖流程不再依賴 Dashboard 手寫 catalog 才收錄任務獎勵。原廠 Client 與 GRF 維持唯讀，本輪沒有重啟 Dashboard、rAthena 或 OpenKore。

## 2026-09-15 Lean Game Entry

- 新增 `GAME_ENTRY_LEAN_STATE`，進入遊戲先取得角色識別、等級／職業、HP／SP、地圖、automation、ownership 與 Combat SSE metadata，再於 first playable 後 hydration Combat summary 與 Social；Quest、Inventory、Equipment、World Map、History、Journal 維持按需載入。
- 390×844 cold cache 實測，Local 10 次 first playable p50／p95／p99 為 82.0／94.9／94.9ms；Cloudflare 外網 10 個獨立 session 為 337.6／357.5／357.5ms。外網原基準為 3283.4／3897.0／3897.0ms。
- Quest 10 次、Inventory 5 次、resume 10 次及 Combat SSE contract 回歸完成。正式 8788 Dashboard 未重啟，詳見 `docs/web-lean-game-entry.md`。

## 2026-09-15 原廠登入視窗 Pilot

- 正式 8788 Dashboard 登入表單已接入本機授權 Client `data.grf` 的原廠 `login_interface/win_login.bmp` 與 `btn_connect_a/b.bmp`；帳號、密碼與登入按鈕沿用原廠 280×120 座標系，登入 API、首次建帳、音樂及創角流程未改動。
- 390×844 實測視窗為 372×159.42、登入按鈕 55.8×26.56；1024×768 視窗為 560×240、按鈕 84×40。兩者均無水平溢位，輸入框及按鈕維持在視窗內。
- 六個登入資產已加入 `docs/ro-ui-asset-index.json`，包含原廠視窗、登入按鈕、儲存帳號 checkbox 與 `data.grf:data\texture\유저인터페이스\t_login.jpg` 1024×768 登入背景。完整來源路徑、Client／GRF SHA256、原檔與 Web 輸出 hash 均已記錄。
- 三個授權 GRF 合計只找到一張明確登入背景，因此目前固定使用 `t_login.jpg`；只有出現第二張來源驗證完成的登入背景時才啟用隨機輪替。
- 儲存帳號採原廠 `chk_saveon/off.bmp`。勾選後只將格式合格的帳號保存於瀏覽器 localStorage；密碼永不保存；取消勾選立即清除。390×844 實測命中區為 74.39×26.56。
- `npm run test:login-ui` 回傳 `LOGIN_UI_PASS`；背景、帳號跨 reload 還原、密碼空白、取消勾選清除、Desktop、390×844 Mobile 與零水平溢位均通過。本 Pilot 因缺同版本 Client 實機 screenshot 維持 Fidelity C。

## 2026-09-15 原廠單角色選擇 Pilot

- 原廠 `login_interface/win_select2.bmp` 576×358 與 `box_select.bmp` 139×144 已唯讀抽取、轉成 PNG、建立 provenance 索引並接入正式角色選擇頁。
- 正式 DOM 只有一個角色 slot，沒有空白 slot；建立角色端點維持已有角色即拒絕，錯誤文案已改為「此帳號已有角色」。新帳號資料列改為 `character_slots=1`。
- 上線前資料庫查核為 71 個帳號、58 個角色，最多每帳號 1 個角色，多角色帳號為 0。現有 70 個可建立角色的帳號已由 3／9 格調整為 1 格；伺服器用途帳號保持 0 格。沒有刪除或重建角色。
- 角色選擇初版曾將 576×358 原廠視窗放大至 720×447.5，但紙娃娃接近固定像素，造成 Web 版比例失衡。修正後 1024×768 回到原廠 576×358 基準，Desktop 紙娃娃放大至 0.98 倍、原廠按鈕維持 42×20；390×844 為 372×231.2，紙娃娃使用 0.66 倍且按鈕放大至 56×27。兩者只有一個可選角色且沒有水平溢位。
- 原廠 `win_select2.bmp` 固有三框版面，未使用框以來源已驗證的 `sysbox_bg` 遮罩。`npm run test:login-ui` 回傳 `LOGIN_UI_PASS`；本項屬單角色 Web 適配，Fidelity C。

## 2026-09-14 紙娃娃 View ID 資料驅動覆蓋

- 紙娃娃頭飾解析已改為官方 Client View ID 優先，ItemID 保留相容查找；裝備頁、選角與排行榜繼續共用同一中央 resolver。
- Dashboard 現行索引的 29 件頭飾已對應 28 個官方 View ID，唯讀抽取男女各一組、站立／移動／坐下／攻擊／弓攻擊及八方向原廠 ACT／SPR；View 101 的蛋殼帽與初心者蛋殼帽共用資產。
- 武器映射已由指定 ItemID 擴充為依 rAthena SubType 自動套用 dagger、sword、twoHandSword、spear、twoHandSpear、axe、twoHandAxe、club、rod、bow、revolver；ItemID 1117、1361、1460、1461、1613 優先使用 Client 專屬 Sprite，再回退到同類武器。
- 盾牌已由 View 1 擴充到 View 1 至 4，並依職業與性別選擇 guard、buckler、shield、mirrorShield。現行 121 件裝備中 76 件已有紙娃娃映射；拳刃、書本、鞭子與盾牌 View 5 保持 `paperDollAssetStatus: missing`。
- 角色與裝備 ACT 的攻擊動作由第 40 組修正為第 32 組；Client 武器 Sprite 在第 32 組有實際像素，第 40 組為受擊。122 個有效武器／盾牌職業性別組合的攻擊圖層均通過非透明像素檢查。
- `ro-asset-index` Skill 已加入完整範圍規則，要求測試未穿戴裝備與共用 View ID，防止以當下角色 Inventory 當成支援清單。

## 2026-09-14 Minimal Web E2E Latency Tracing

- 新增預設關閉的 `WEB_LATENCY_TRACE`，以安全 `interactionId`、AsyncLocalStorage、Server-Timing 及 Browser Performance API 串聯 request、DB、projection、OpenKore dependent bridge、serialize、response 與 visible complete。
- 本機及隔離 Cloudflare 外網各完成 login 5、enter game 5、Quest page 10、安全拒絕 Quest action 10、inventory 5、resume 10。證據位於 `.local/ro-stack/evidence/WEB_LATENCY_TRACE_MINIMAL`。
- 外網 initial entry 為 2600.6ms；enter game p50/p95 為 3291.0/3996.9ms；Quest cold 為 1712.3/1954.8ms，warm 為 747.4/857.6ms；resume 為 604.0/622.1ms。
- Quest cold projection p50 為 1044.9ms，OpenKore dependent bridge p50/p95 為 0.0/120.0ms。主要成本已定位在 DB-backed projection、entry 提早載入與 game entry 後續資產/DOM 工作。
- 2,000 request synthetic HTTP benchmark 的 trace ON 相較 OFF 增加 p50 0.083ms、p95 0.462ms；production Dashboard、rAthena、OpenKore 與正式 Tunnel 均未重啟。完整說明見 `docs/web-e2e-latency-tracing.md`。

## 2026-09-14 能力頁 Desktop / Web 自適應

- 能力頁原本在桌面固定為原廠 280 px，於專用全寬區段只占約三分之一欄寬，形成大面積留白。
- 桌面版現依可用寬度等比例放大；1024×768 使用 2 倍的 560 px，1440×900 使用 3 倍的 840 px。390×844 手機仍維持 380 px，各種 viewport 獨立計算比例。
- `ro-original-ui` Skill 已增加 Desktop / Web Fill Gate，要求桌面量測 painted width、可用欄寬、比例與 overflow，防止手機通過後桌面退化。

## 2026-09-14 手機能力加點觸控修正

- 390×844 下原廠 `arw_up` 箭頭原本只有約 15×15 px 實際命中範圍，且透明的衍生能力圖層覆蓋六圍區並攔截座標觸控。
- 非互動衍生能力圖層現已停用 pointer interception；手機版保留原廠箭頭與位置，將每項能力的同一列擴充為互不重疊的透明命中區，實測約 140×22 px。
- 正式 8788 Dashboard 以 390×844、`pointerType: touch` 從擴充區邊緣及箭頭位置各觸發一次，兩次均送出 STR action；測試端攔截命令並強制拒絕，因此沒有修改測試角色能力值。
- `RO_STATUS_UI_PILOT_PASS`、`STATUS_HOLD_UI_PASS`、`ACTIVE_WEB_ENTRYPOINT_PASS`、Skill validator 與 diff check 全部通過。

## 2026-09-14 槍手已裝備子彈判斷修正

- 實際角色 `賴清德` 的 OpenKore 即時狀態確認 Item 13200 Bullet 共 500 發、裝備位置 32768、`equipped=true`，rAthena 傳出的道具類型為 `IT_AMMO = 10`。
- Dashboard 前端與技能自動化命令 gate 原先將 Bullet、Shuriken、Cannonball 誤對應為 16、17、19，導致只要求特定彈藥的技能顯示「目前不足」並拒絕勾選。
- 目前技能資料實際使用的九種彈藥資源 Arrow、Dagger、Bullet、Shell、Grenade、Shuriken、Kunai、Cannonball、Throwweapon，現在全數依 rAthena `IT_AMMO = 10` 驗證；前端顯示與伺服器命令採相同規則，`test:ammo-resource-gate` 會從技能資料自動枚舉，防止新子類再次遺漏。

## 2026-09-14 RO 原廠內容資產索引 Pilot

- 新增 `.agents/skills/ro-asset-index/`，集中規範原廠 Client、rAthena、OpenKore twRO、Wiki 與英文 fallback 的查核順序；`AGENTS.md` 已加入強制觸發規則。
- 建立 items、equipment、skills、monsters、npcs、maps、paper-doll 七類索引與共用 `ro-asset-resolver.mjs`。Dashboard 道具查詢缺少舊 catalog 記錄時會改查集中索引。
- Pilot 完成 6 個道具、4 個裝備 icon、4 個怪物透明預覽及 `prt_fild08` 原廠 512×512 minimap。NPC 身分已索引，原廠繁中與 Sprite 路徑仍標記缺少。
- `鱗片梗` 已確認為 Item 906、`Pointed_Scale`，本機 Client 資源名為 `비늘줄기`。舊程序使用 `비늘로된_줄기` 導致誤判缺圖；別名覆蓋與原廠 icon 已加入。
- `test:ro-asset-index`、`test:item-localization`、`test:character-showcase`、`test:map-info` 與 Dashboard 語法檢查通過。本輪沒有重啟 Dashboard、rAthena 或 OpenKore。

## 2026-09-14 Web Observation Phase 2 正式載入與壓測

- Dashboard 已由 PID 30536 安全重載為 PID 11340，20 個 OpenKore worker 完成分批滾動；20 / 20 具有 domain revision 並進入 NO_WEB。rAthena login、char、map 均未重啟，本機與公開健康檢查通過。
- NO_WEB 期間 browser viewer 為 0，20 名角色持續在線；status file write 由舊 full-state 壓力樣本 243.9 / 秒降至 idle 1.47 / 秒。新版 lean state p50 / p95 / p99 為 0.6 / 2.2 / 261.1ms，combat events 為 0.5 / 2.0 / 12.4ms。
- 8 個同角色 viewer 的 production 驗證為 1 次 projection build、7 次 coalesced。前端同時 state refresh 已合併，同一 quest action 只送出一次 full state。
- 100 與 300 等效連線的 A、B、C、D 情境全數通過且 0 errors。500 Scenario A 出現 p95 751.8ms 與 event-loop max 757.1ms，依停止規則終止；1000 未執行。
- 390×844 local COMBAT gate 通過；公開入口最後一次 COMBAT p95 696.3ms，1.6 秒只完成 2 次 event request，判定失敗。QUEST、OTHER、HIDDEN、NO_WEB 與 resume 通過。
- Phase 3 建議現在導入限定 COMBAT delta 的 SSE，保留 HTTP snapshot。500 停止點只有約 8.3 DB process / 秒且沒有 query storm，DB connection pool 延後。完整證據見 `docs/web-observation-scalability-plan.md`。

## 2026-09-14 掛機程序與長時間閒置自動復原

- 阿修羅關東煮的資料庫 `web_automation.desired_running=1`，保存掛機目標與 `lockMap` 均為 `prt_fild00`，但 OpenKore 程序及 `state.json` 已消失。最後心跳停在 `prontera (116,72)`；日誌沒有 crash、斷線或致命錯誤，也沒有記錄停止來源，停止觸發者為【資料不足，無法確認】。
- 該角色重新啟動時另查出歷史 `buyAuto 501` 區塊缺少 `minAmount`，啟動安全檢查直接回報 `buyAuto 501 field minAmount was not found`。`Set-BuyAutoValue` 現在會在完整區塊內補回缺少欄位，仍保留區塊與結尾括號驗證；阿修羅關東煮已修復為 `minAmount 200`。
- Dashboard 現在每 30 秒核對 `web_automation.desired_running=1` 與真實 worker PID。程序消失時只啟動該帳號，並以每 instance Promise 互斥阻止重複 spawn；失敗採 30、60、120、240、300 秒上限退避，玩家按下停止會先將 desired intent 清除，因此不會被監聽重新開啟。
- OpenKore 現有保存掛機目標防呆已擴充：角色在目標地圖、AI 自動模式、站立且存活，連續 90 秒沒有位置及戰鬥進展時，清除空轉 AI、恢復自動模式並只移動一個可行走相鄰格。同一異常維持最多 3 次、退避 60 秒；任務、NPC、補給、轉職、伊甸園及其他持有控制權的流程仍優先。
- 實機先完成原本中斷的販售與存倉，負重由 1664.5 降至 770.5，Zeny 由 40,686 增至 51,473；角色回到 `prt_fild00` 後 Base EXP 由 20,251 增至 20,267。受控中斷舊 PID 52808 後，監聽約 33 秒建立 PID 13596，重新登入原位置並戰鬥，Base EXP 再由 20,893 增至 21,131。
- `node --check ops/ro-stack/dashboard.mjs`、`test-grind-hub-transition.mjs`、`test-supply-interruption-recovery.mjs`、`test-eden-equipment.mjs`、PowerShell parser 與 active web entrypoint 均通過。Dashboard 已安全重載，本機與 `https://play.g8land.com/api/health` 均回傳健康；rAthena 與其他玩家程序未重啟。

## 2026-09-14 伊甸園 Lv.40 回報導航重送修正

- Source decision 維持現行 Renewal `npc/re/quests/eden/eden_quests.txt`。Quest 7148 達成 Orc Baby 10 / 10 後，由 `in_orcs01 (38,175)` 的 Eden Member Hooksha 原生對話切換至 Quest 7149；停用中的 `eden_iro.txt` 未納入流程。
- 根因有兩項。Lv.40 達標分支每次輪詢都執行 `AI::clear()`，使剛建立的 Hooksha 跨圖路線立即被下一輪清除；NPC 關閉封包到達後又過早清除 `Task::TalkNPC`，阻止 OpenKore 依鎖定版原生流程送出最後的 `npc_talk_cancel`，rAthena 因此持續拒絕移動與翅膀使用。
- Lv.26 與 Lv.40 達標分支現在只在首次進入回報階段清除舊 AI。Eden 對話狀態會等待 `Task::TalkNPC` 離開 AI 佇列，再允許階段切換及導航；相同路線不再於每次輪詢重送。
- 實際角色 `蕭美琴` 從原生 Quest 7148、10 / 10、`gef_fild10` 接續。修正後抵達 Hooksha，伺服器刪除 Quest 7148 並新增 Quest 7149；角色離開 `in_orcs01`，沿合法路線返回 `gef_fild10`，Orc Warrior 進度由 0 / 10 增加至 1 / 10，任務保持 active 且錯誤欄為空。
- 本輪只重新載入 `player_2000111` 的 OpenKore 程序，沒有重啟 rAthena、Dashboard 或其他玩家。`npm run test:eden-equipment` 與本次差異格式檢查通過；未執行完整發布。

## 2026-09-14 Mission Interaction Stage Production Ready

- 任務頁沿用單一 `#assassinMissionStage` 與既有三職 renderer。`JobQuestService` 現在統一投影 stable dialog line、NPC identity／visual key、純顯示 Auto 許可、玩家輸入 gate、server action、revision 與 generation。
- Assassin、Rogue、Knight 的 Entry、Quiz／Choice、分支或面談與 Final 均已依本機 Renewal rAthena source 建立 Adapter mapping。普通 DIALOG 可安全逐句播放；Quiz、Choice、Password、Route Event 與 Final Commit 強制停止 Auto。
- 新增 NPC visual manifest／resolver。Repository 尚無可直接對應的合法靜態 portrait，因此各 NPC 以正確名稱的中性 missing fallback 顯示；404 或未知 key 不阻止任務。
- stale interaction 會在舊 renderer 改寫 DOM 前拒絕；refresh、reconnect、Auto 與 Skip 均為零 mutation。30 項矩陣、三種手機尺寸、Foundation、Adapter Contract、Event Log、完成任務摺疊、47 項 Vitest、active entrypoint 與 lint 全數通過，狀態為 `READY`。
- 當前 Dashboard Node 程序啟動於 01:28:22，server projection 檔案更新於 01:54:56 之後；靜態首頁已送出新版前端資產，但程序尚未載入 server contract。完整正式提供玩家前只剩安全重新載入與公開入口 smoke check。完整報告見 `docs/MISSION_INTERACTION_STAGE_PROTOTYPE.md`。

## 2026-09-14 任務頁已完成清單預設摺疊

- 新手任務、伊甸園成長訓練與已完成二轉會從主要進行中／可進行區塊移入單一「已完成任務（N）」區段，完成數量由目前三類任務投影即時計算。
- 已完成區段在首次進入、瀏覽器重新整理與重新進入遊戲時預設收合。收合狀態不建立完成項目 DOM；玩家主動展開後才產生簡潔列表，重新收合即清除列表。
- 已完成二轉不再保留完整 Mission Stage 版面；沒有未完成項目的新手或伊甸園分類會隱藏，任務行動紀錄維持在主要分類下方。
- 手機展開清單限制在 180px 內局部捲動；收合列維持單列且不產生水平溢位。`npm run test:quest-completed-collapse` 覆蓋驗收 21 至 25。

## 2026-09-13 保存掛機目標自動接回防呆

- OpenKore status export 會定期核對 `grind-target.json`、即時 `lockMap`、AI 模式與角色所在地圖。已保存掛機目標卻停在目標外、被切成手動或保留舊的空白 `lockMap` 時，穩定閒置 3 秒後自動恢復目標、站起、切回自動模式並重新計算路線。
- 伊甸園、onboarding、通用 Quest Runtime、掛機據點切換、補給、NPC 對話及其他已持有控制權的導航流程均優先，避免防呆搶走合法任務控制權。同一異常最多連續修復 3 次，之後退避 60 秒並留下可見錯誤事件，避免無限重試增加負擔。
- Integration 使用既有 `JobTestMerchant` 重現 `grind-target.json=prt_fild08`、`lockMap` 空白、角色在 `alberta` 坐著的狀態。重啟該角色 OpenKore 後事件出現「恢復掛機目標」，`lockMap` 回復 `prt_fild08`，AI 開始計算跨圖路線。
- 蕭美琴的 OpenKore 已單獨重載本版防呆。重載後仍在保存目標 `moc_fild02`，座標由 `(331,268)` 移動至 `(267,265)`，狀態為 `route`；未重啟 rAthena、Dashboard 或其他玩家程序。

## 2026-09-13 伊甸園 Lv.40 高等角色補課保護

- 可重現 rAthena patch 已將 `S_Quest3` 的 Orc Village 入口改為 Base Lv.40 以上，Base Lv.50、99、175 的隔離角色不會被目前等級分流到 Orc Dungeon 或 Ocean City，任務仍須由 `para_suv01 = 23`、原生 NPC 與 Quest `7147 -> 7151` 推進。
- Dashboard 已加入 Quest 7147 至 7151、三種獸人目標、第三套裝備、Base Lv.40 以上與 `para_suv01 = 23` 的狀態投影及命令 gate。OpenKore 已加入 Boya、Hooksha、Orc Village 三段狩獵、Boya 回報、Michael 領獎、補給與有限導航重試的 Lv.40 執行鏈。
- 已二轉或三轉的高等角色只要持有伊甸園徽章，裝備訓練不再被 Dashboard 的一轉 Job ID 清單拒絕。新加入且 Base Lv.12 以上的角色固定從第一套未完成訓練開始，再依 `para_suv01` 順序接續 Lv.26 與 Lv.40，避免按目前等級跳過前置任務。
- `scripts/test-eden-equipment.mjs` 已加入 Lv.40、50、99、175 無上限案例，以及 7147 至 7151、Orc Baby、Orc Warrior、Orc Lady、第三套裝備與命令上限防護；patch 套用檢查與 `EDEN_EQUIPMENT_SOURCE_AND_BRIDGE_PASS` 通過。
- Lv.12／Lv.26 與 Lv.40 等級規則已拆成兩個可獨立重播的 patch，避免既有 runtime 只套用前兩個 hunk 時，後續 `setup` 因部分套用狀態失敗。本機 runtime 檔案已準備 `BaseLevel >= 40`，尚未重載進線上 map-server。
- 為保護同工作區正在執行的其他任務，本輪沒有重載 rAthena、沒有修改角色資料、沒有直接改 Quest progress。上述結果屬程式與靜態 regression PASS；滿等隔離角色的原生接取、三段擊殺、回報與獎勵仍待 runtime 驗證，正式服務目前尚未開放本版。

## 2026-09-13 伊甸園裝備訓練取消等級上限

- 現行 Renewal 啟用 `npc/re/quests/eden/eden_quests.txt`，停用 `eden_iro.txt`。本伺服器透過可重現 patch 將第一階段條件改為 Base Lv.12 以上固定接 quest 7128，第二階段改為 Base Lv.26 以上固定接 quest 7138；最低等級、原生 quest、`para_suv01`、NPC 回報與獎勵規則均保留。
- WEB 任務日誌維持雙擊啟動，顯示最低等級且不再顯示上限；Dashboard 與 OpenKore 已移除 Lv.20／Lv.33 上限拒絕。第一套領取後，Base Lv.26 以上角色會接續第二階段。
- 實際角色 `蕭美琴` Base Lv.36、初始 `para_suv01=0`。任務命令成功啟動，在補給完成後與 Boya 對話；MariaDB 實際出現 quest 7128、state 1，`para_suv01=1`，角色開始前往 `moc_fild11`。
- 實測同步發現 OpenKore 會把 `buyAuto 501` 的首個 `npc` 欄位寫到區塊標頭，導致到店未購買。啟動流程已加入格式校正；蕭美琴實際販售 3 項戰利品並以 640 Zeny 購入 64 瓶紅色藥水，任務隨後恢復。
- `npm run test:eden-equipment` 回傳 `EDEN_EQUIPMENT_SOURCE_AND_BRIDGE_PASS`；rAthena、Dashboard 與蕭美琴 OpenKore 重載後健康檢查通過。

## 2026-09-13 永久旅行翅膀

- 依使用者裁定，rAthena Renewal 的 601 蒼蠅翅膀與 602 蝴蝶翅膀保留原生 `AL_TELEPORT` Lv.1／Lv.3 效果及地圖限制，透過 item import 改為重量 0、使用不消耗，並禁止玩家丟棄、交易、販售、放入推車／倉庫／公會倉庫、郵寄及拍賣。
- rAthena 登入事件會替缺少任一翅膀的角色補上 1 個；指定練功地圖的 load event 再做一次冪等補足。OpenKore 建立與啟動 instance 時移除 601／602 `buyAuto`，把兩者固定為保留道具並禁止 `pickupitems -1`。
- Dashboard 補給規則不接受 601／602，也不在玩家處置清單顯示兩者。現存 79／79 個 OpenKore instance 已同步；rAthena 與 Dashboard 已於 2026-09-13 受控重啟並載入本版規則。
- 重啟後 16／16 份即時角色狀態均同時持有 601 與 602。測試角色使用蒼蠅翅膀後座標由 `(207,267)` 變為 `(263,97)` 且數量維持 47；使用蝴蝶翅膀後回到同圖儲存點 `(263,241)` 且數量維持 1。map-server 沒有 item import 或 NPC label 錯誤。

## 2026-09-13 世界地圖洞穴樓層選擇

- 世界地圖詳細面板已支援同一原廠區域內的樓層選擇。第一批開放海底洞穴 `iz_dun00`～`iz_dun05`、斐揚洞穴 `pay_dun00`～`pay_dun04` 與夢羅克金字塔 `moc_pryd01`～`moc_pryd06`，共新增 15 張可選掛機地圖。
- 樓層順序與跨層連線來自啟用中的 rAthena Renewal warp import；OpenKore instance 的 `portals.txt` 已包含相同入口。每層怪物、代表等級區間與 Boss 資料仍由 active spawn scripts 及 `db/re/mob_db.yml` 產生。
- 選取樓層沿用 `/api/grind-target`、`grind-target.json`、`lockMap` 與 OpenKore `Task::CalcMapRoute`，沒有新增傳送 NPC、直接改座標或平行掛機狀態。
- 海底 1～5 樓沿用原生 warp，5 樓至 6 樓沿用 Renewal `Gatekeeper#iz_dun` NPC。390×844 驗證確認斐揚洞穴 5 個樓層按鈕可切換至 `pay_dun04`，詳細資料、選取狀態與原生傳送點說明正確；`npm run test:map-info` 回傳 `MAP_INFO_SYNC_PASS`。
- 鎖定版 OpenKore 路由瞬移已設為洞穴與野外共同預設：跨圖路由所在位置距下一個 portal 超過 75 格時，以永久蒼蠅翅膀隨機傳送；每張地圖最多嘗試 8 次，進入 75 格內、抵達嘗試上限或瞬移失敗後改為步行。城市與 `route_teleport_notInMaps` 禁用地圖維持排除。
- 洞穴實機路線由測試帳號 `jobtest_swordman` 從 `prt_fild08` 前往 `pay_dun01`。角色進入 `pay_dun00` 後在剩餘路徑 311、266、260、198 格時使用蒼蠅翅膀，抵達 `(166,42)` 後改走至 `(184,33)` portal，最後到達 `pay_dun01 (19,33)`；翅膀數量維持 51。
- 野外實機路線由測試帳號 `gate2_eden0912a` 從 `moc_fild11` 前往 `moc_fild12`。OpenKore 依剩餘路徑嘗試 8 次隨機傳送，達上限後自動步行至 `moc_fild11 (26,161)` portal，再到達 `moc_fild12 (286,168)`；HP 維持 298，翅膀數量維持 21，測試後已恢復原目標與戰鬥設定。
- 深層洞穴 Integration 使用 `is_test=1` 的 `jobtest_swordman`，由 `pay_dun01` 依序通過 `pay_dun02`、`pay_dun03` 抵達 `pay_dun04 (201,204)`，再沿反向原生 portal 返回 `pay_dun00 (181,33)`。三張中繼地圖均觸發路由蒼蠅翅膀；每圖達 8 次上限時改為步行，翅膀數量全程維持 51。
- 測試期間只替該測試帳號暫時套用 rAthena 原生 `@monsterignore`。`pay_dun04` 視野內 5 至 7 隻怪物時，12 秒觀察 HP 固定為 3455；測試後伺服器回覆已恢復正常狀態，帳號 `group_id` 由暫時的 99 還原為 0，戰鬥、拾取及 worker 均已恢復。
- 深層測試發現跨掛機地圖後會保留前一地圖的 `lockMap_x`、`lockMap_y` 與隨機範圍，導致新地圖回覆座標不可行走。掛機目標寫入現會同步清空四個固定座標欄位，再由新地圖與原生 portal 重新計算。
- 目前停止條件採固定 75 格與每圖 8 次上限。先前提到的相對 50% 距離節省條件尚未接入鎖定版 OpenKore。

## 2026-09-13 moc_fild20 危險中繼路由修正

- Source decision：現行 Renewal 伺服器啟用 `npc/quests/quests_morocc.txt`；`Continental Guard#07/#08` 的離場選項實際回到 `morocc (160,61)`。OpenKore tRO `portals.txt` 將同一 NPC 額外記成 `moc_fild01 (86,32)` 的兩筆路由與伺服器行為衝突，不納入本專案 Renewal 路由表。
- 玩家入口維持 Dashboard 世界地圖與掛機目標 API；OpenKore `Task::CalcMapRoute` 仍負責實際路由。一般補給路由對 Lv.132～134 的 `moc_fild20` 加入 10000 路由成本，保留必要的原生任務進入能力。
- 修正版已覆蓋現存 76 個角色實例的 Renewal 路由檔並寫入避讓權重；76/76 均不含 `moc_fild20 -> moc_fild01` 的錯誤出口。其餘 12 個在線角色查核時均未停留於 `moc_fild20`，下次重連會載入修正版。
- 賴清德的一次性復原先在夢羅克原生商店販售既有戰利品，Zeny 由 188 增至 5,404；其後使用原生卡普拉抵達普隆德拉、完成買藥與存倉，再經 `prt_fild08` 進入掛機目標 `moc_fild01`。
- 實機驗收確認賴清德在 `moc_fild01` 擊殺 Muka 與 Peco Peco，20 秒內 Base EXP 由 7,941 增至 8,350，期間未死亡且未再進入 `moc_fild20`。

## 2026-09-13 RO 二轉 Web Quest Runtime Foundation

- 通用 Quest Runtime state、MariaDB CAS persistence、checkpoint、SAFE／DEFERRED／LOCKED、Supply Reservation、Trial lock、死亡斷路器、Combat Policy、Route Event、Mission Stage 與 Server-authoritative COMMIT gate 已接入正式 Dashboard command directory 與 OpenKore callback pump。
- 固定 Production representative fixture `AssassinGateThief` 已建立：Thief、Base Lv.50、Job Lv.40、未使用技能點 0、合法配置 39 點 Thief 技能、Assassin quest 與三個 `ASSIN_Q` 變數均未啟動、Inventory／Zeny／起點可重置，並標記為測試帳號。完整 onboarding → Thief 保留為獨立 regression，不列入 Assassin Gate。
- OpenKore executor 沿用既有 sellAuto／buyAuto／NPC／navigation 完成真實補給閉環；固定 Thief 在補給中 Agent restart 後實際購得 item 501 共 30 個，authority inventory 通過後恢復 original objective。
- NO_ATTACK、TARGET_WHITELIST 與 THREAT_AVOID 在 `checkMonsterAutoAttack` 與 `shouldDropTarget` 強制。真實 OpenKore 驗證場上有怪不攻擊、白名單無目標不 fallback、只攻擊 Poring，以及 policy release 後恢復一般攻擊。
- Agent restart during objective／supply／combat policy 均通過固定 Thief fixture 的真實 stack 驗證。active Trial 的 map-server restart 使用獨立 MariaDB、login、char、map 與 OpenKore 完成 ISOLATED REPRESENTATIVE 驗證，結果回 TRIAL_FAILED、NORMAL 與原 checkpoint。
- `web_quest_runtime` 與 `web_quest_commit` schema 已套用；processed event identity 保存於版本化 runtime state。17 項 Production Gate、Foundation、MariaDB、47 項 Vitest、lint 與 active web entrypoint 均通過。整體狀態為 `READY`。
- 本輪沒有加入 Assassin 任務內容或正式 Assassin adapter；下一輪可開始 Thief → Assassin Production Vertical Slice。

## 2026-09-13 固定公開入口

- Cloudflare 網域 `g8land.com` 已由 Cloudflare 權威 DNS 管理；Named Tunnel `g8land-game` 已建立，固定玩家入口為 `https://play.g8land.com`，來源服務維持 `127.0.0.1:8788`。
- `demo-tunnel.ps1` 會優先讀取未納入 Git 的 `.local/ro-stack/dashboard/tunnel-config.json` 啟動 Named Tunnel，並以固定入口 `/api/health` 驗證實際可達性；未設定 Named Tunnel 的環境仍保留 Quick Tunnel 相容模式。
- 本機與公開 `/api/health` 均回傳 HTTP 200 與 `{"ok":true}`；公開首頁回傳 HTTP 200，實際瀏覽器載入登入頁後顯示「伺服器正常」。
- 中斷 Named Tunnel 程序的故障注入已通過：15 秒 watchdog 在約 9 秒內建立新程序，網址維持 `https://play.g8land.com`，恢復後公開健康檢查回傳 HTTP 200。
- Cloudflare 已部署只涵蓋 `/api/account` 的每 IP Rate Limiting Rule：10 秒內超過 10 次即 Block 10 秒。公開受控測試第 11、12 次請求收到 error 1015，10 秒後恢復；其他遊戲 API 與已登入玩家流程不在規則範圍。
- 主機關機、休眠、斷網或 watchdog 本身停止仍會中斷服務；Windows 開機自動啟動與長時間手機多人驗收尚未完成。

## 2026-09-13 世界地圖掛機目標第一版

- Dashboard 掛機區新增接近全螢幕的世界地圖選擇 Overlay。圖層使用本機授權 Gravity `data.grf` 的 `worldmap_mob.bmp`，節點座標由同一 GRF 的 `worldviewdata_table.lub` 解碼，363 筆座標中有 13 張現行流程地圖具可戰鬥普通怪物與原廠座標，可在圖上選擇。
- 等級資料由啟用中的 rAthena Renewal `npc/re/scripts_main.conf` spawn import 鏈與 `db/re/mob_db.yml` 自動產生。主要掛機區間排除資源型怪物與 Boss／MVP，再採出生數至少占可戰鬥普通怪 10% 的代表怪物；完整可戰鬥區間、資源型怪物與 Boss／MVP 仍在詳細面板分開顯示。
- 掛機目標保存於各帳號 OpenKore instance 的 `grind-target.json`，經 `/api/grind-target` 驗證後更新 OpenKore `lockMap`，並沿用現有設定重載命令與 Renewal portal table 執行跨圖路線。任務進行中、HP 低於 60% 或紅色藥水不足時禁止設定；worker 重建時會重新讀取保存目標。
- `npm run assets:world-map` 以唯讀方式匯入原廠 1280×1024 世界圖、363 筆原廠節點座標及 SHA-256 manifest；原始 `data.grf` 未修改。
- `npm run assets:world-map` 與 `npm run assets:map-info` 已通過；390×844 Overlay、13 個原廠座標節點、代表怪物區間與圖層載入由 `npm run test:map-info` 驗證。隔離帳號 `jobtest_merchant` 實際呼叫 API 設定同圖 `prt_fild08`，API、state、`grind-target.json` 與 `lockMap` 均一致，命令佇列已清空。
- 手機世界圖的已開放區域保留至少 38px 透明點選範圍，不疊加地圖名稱與等級文字；390px 視窗內畫布寬 380px，不再以 820px 畫布製造橫向捲動與常駐文字重疊。
- 世界圖已移除藍色、黃色、目前位置與等級圓點；依原廠 363 筆座標聚合為 249 個不改變座標的區域 hit area，地圖本身的地名、等級數字與美術完整保留。
- 解鎖狀態由 `map-info.json` 的 `availableForAfk`、`unlocked`、`selectable` 資料驅動；世界圖底圖以 brightness 0.58 柔和變暗，現行 13 張掛機地圖以同一原圖裁切還原亮度，其餘 236 個區域保持暗色。未開放區域帶 `aria-disabled=true`，資訊卡不產生設定按鈕；掛機 API 同步驗證三個欄位。
- 掛機目標 API 從 rAthena `char.save_map/save_x/save_y` 同步重生點，並依 Renewal 實體 portal 拓撲計算掛機地圖最近的城市據點。儲存點不符時，先交由 OpenKore 使用原生卡普拉、票券與 Zeny 路線抵達該城市並向卡普拉登記，再啟用 Butterfly Wing 回城及新的掛機 `lockMap`。

## 2026-09-13 RO 原廠 Pet Companion 三角色

- 已由本機官方 `C:\Program Files (x86)\Gravity\RagnarokOnline\data0.grf` 唯讀擷取怪物版 `baphomet`、`angeling`、`moonlight` ACT／SPR，來源 GRF SHA-256 維持 `913402ace1d3c67818b4f070650a07eb157a6d62df9e394d596d59b4c7e6678a`。
- 新增巴風特、天使波利、月夜貓至桌面寵物選單。六種 Companion 狀態直接對應原廠 Idle、Walking、Attack、Hit、Dead；run 沿用原廠 Walking 畫格並加快播放，sleep 播放 Dead 後停在末幀。
- Web atlas 保留每個 ACT direction 的原始幀數與 delay，支援每種動畫 4 至 28 欄，不再強制壓成八幀。轉換保留 ACT layer 的 mirror、scale、rotation、RGBA 乘色與相對 offset，輸出 96×96 cell 的 lossless WebP 真 Alpha。
- `scripts/extract-ro-official-pets.ps1` 負責唯讀擷取，`scripts/build-ro-official-pets.mjs` 負責可重現建置，三份 manifest 保存 GRF entry、ACT／SPR 雜湊、原始幀數、方向、速度、狀態映射與輸出雜湊。
- `npm run test:pet:ro-official` 已驗證三隻、六種動畫、八方向、每格非空、尺寸、Alpha、雜湊、選單、前後端白名單及 variable atlas renderer。Chrome 實測支援 `steps(var(--pet-sheet-columns))`；公開入口與三組 idle 資產均回傳 HTTP 200。
- 目前 Dashboard node 程序於 2026-09-13 02:22:56 啟動且未使用 watch；公開靜態選單與資產已更新，帳號層 `pet_companion_species` 新值需在安全時段重新載入 Dashboard 後才會由新版後端接受。本次查核畫面顯示 14 人在線，因此未中斷服務。

## 2026-09-13 Grok 妙蛙種子 Production Candidate

- 使用者完成 A/B 選定後，grok-v1 已複製至 `ops/ro-stack/dashboard/assets/pets/bulbasaur/grok-v1/` 並設為 Dashboard 正式預設。原候選與 local-v1 資產均保留，可在 localhost／127.0.0.1 使用 `?petRendererSource=local-v1` 回退比較。
- 唯一角色來源為使用者指定的 `grok-91b7ef52-f5bf-438e-a69b-440f6d171b50.jpg`，SHA-256 為 `856A525C5CE104A19667626171110C40DF30CE1A5322A62EA0EA2EB4B18F1CAE`。建置流程移除邊界連通白底與原圖地面陰影，再依影像內容辨識五個方向；使用者後續提供的棋盤格 JPEG 未納入候選。
- idle、walk、happy、run、pant、sleep 均已產出 768×768 lossless WebP、96×96 cell、8 方向與真 Alpha。共用 pivot 為 `(48,78)`；front、front-left、left、back-left、back 為來源方向，其餘三方向依 manifest 水平鏡像。
- 原始來源每方向只有一張定姿稿。六組動態幀以可重現的局部變形、腳部相位、呼吸、前傾、壓低與眼簾修正建立；這是候選的已知美術限制，正式升級仍需人工 A/B 通過。
- 公開網域固定使用正式預設 `grok-v1`，不接受 URL 或 sessionStorage 切換。grok-v1 六種狀態皆回報 `data-pet-renderer="sprite"` 與 `data-pet-fallback="false"`，local-v1 的 run／pant／sleep fallback 行為維持原狀。
- `npm run test:pet:grok-candidate` 驗證尺寸、Alpha、雜湊、非空幀、幀差異、方向、padding 與 renderer 對應；`npm run test:pet-companion` 分別對 local-v1 與 grok-v1 驗證桌機 72／88／104px、手機 64／72／88px、零水平溢出、避讓、狀態切換與 fallback。

## 2026-09-13 帖拉所伊朵 Pet Companion 測試

- 已由使用者合法授權的本機石器時代客戶端唯讀抽取「帖拉所伊朵」。名稱表 `lua/file.cf:19` 指向 AnimationID `100374`；動畫資源位於 `path/pet` 四檔組合，使用 `Palet_4.sap`。
- SAP 色彩資料確認以 BGR 儲存，輸出時轉為 RGB，銀白機械外殼與紅色線條已和使用者參考圖核對。原始客戶端檔案未修改。
- Dashboard 系統設定新增「寵物選擇（測試）」，可在妙蛙種子與帖拉所伊朵間切換。程式與 MariaDB `web_preferences.pet_companion_species` 欄位已完成；目前執行中的 Dashboard 未重新載入新版後端，同帳號沿用仍待安全時段重新載入後驗收。本機瀏覽器選擇可由既有設定儲存機制保留。
- 帖拉所伊朵提供 96×96、8 方向的 idle、walk、happy atlas；idle 與 happy 為 8 幀，walk 依原始 action code 4 保留完整 6 幀。沿用既有 Companion 移動、避讓、大小與活動程度狀態機。素材內含原廠影子，顯示時停用妙蛙種子的額外影子層。
- 原始 action code 的官方名稱為【資料不足，無法確認】；manifest 明確記錄目前 Web Companion 動作屬視覺對應，狀態維持 `test`。
- `npm run test:pet:terasoid` 驗證尺寸、Alpha、非空影格、動畫差異、紅色調色板、來源 manifest、種類切換與伺服器偏好欄位；`npm run test:pet-companion` 在現行 8788 通過桌面、390×844 手機、種類切換、素材 URL、影子層、避讓與既有互動回歸。測試標示依使用者要求保留。
- 已修正休息效果覆蓋逐格動畫的衝突；休息中的帖拉所伊朵同時保留 8 幀循環與呼吸縮放。UI 回歸直接比對 180ms 前後的背景影格位置，防止只載入第一幀。
- 實機 Chrome 確認使用者環境的 `prefers-reduced-motion` 為 `reduce`，舊規則會停止所有寵物 sprite 動畫。新版保留 idle、walk、happy 的逐格影格，並繼續停用符號晃動及頁面位移，兼顧減少動態效果設定。
- 大型寵物的水平候選點改以 `#game` 實際內容左右邊界計算，不再使用整個寬螢幕邊緣；一般與大型模式完整留在內容寬度內，展示模式的可視焦點留在內容寬度內，手機仍使用完整可視視窗並保留底部控制區。
- 手機尺寸改為主要驗收規格：650px 以下的寵物有效尺寸上限為 160px，並受 `100vw - 32px` 二次限制。桌面設定值可保留，手機顯示一律使用一般模式，整隻寵物維持在可視區內且避開底部操作區。
- 帖拉所伊朵缺少獨立素材的狀態不再留白：run 重複使用 walk atlas，pant 與 sleep 重複使用 idle atlas；三種狀態各自使用不同播放速度，保持狀態節奏差異。
- 寵物跟隨已移除快速捲動時的跨畫面重定位與減少動態效果模式的終點跳轉。所有需要換位的路徑均逐幀前進；減少動態效果模式固定使用較慢的 walk，短距離則留在原位，避免視覺瞬移。
- 使用者依實機動態確認原先預覽標為「受擊」的 action code 4 為移動動作。Web 的 walk 與 run 已改用該組八方向、每方向六格、1000ms 原始序列；run 使用相同影格加快至 600ms。原廠文字表中的正式動作名稱仍為【資料不足，無法確認】。

## 2026-09-13 Pet Companion Size-aware Behavior

- 桌機依 48 至 200px、201 至 500px、501 至 1200px 分為 normal、large、showcase；手機依 48 至 160px、161 至 320px、321 至 880px 分級。斷點集中於 `pet-companion-settings.js`。
- large 沿用同一套移動狀態機，提高跟隨與跑步門檻、關閉隨機反應、優先評估畫面邊緣，並以較大的互動元件安全距離與三倍 soft penalty 避讓內容。
- showcase 只接受 panel、viewport、尺寸及啟用等重大 context change；一般 scroll、Combat Log 更新、內容 mutation 與 reaction follow 均不重新選位。寵物依 active anchor 中心選擇相反側停靠，允許部分水平出界。
- showcase 使用可見側焦點區與最大 128px hitbox 保護互動元件；內容重疊時 opacity 降至 0.88，玩家指標或焦點靠近時短暫降至 0.68。手機 Companion layer 會在底部導覽上方裁切。
- 設定超過 500px 顯示展示模式 inline 提示。DOM 提供 `data-pet-size-mode`、`data-pet-dock`、`data-pet-content-overlap` 與 `data-pet-hard-overlap` 查核狀態。

## 2026-09-13 Grok 妙蛙種子 Sprite 工程化預覽

- `C:\Users\Administrator\Desktop\御三家\妙蛙種子` 內五張 Grok 輸出已完成唯讀審計。五張皆為單列五方向定姿稿，每方向僅一幀；一張 PNG 具真 Alpha、兩張 JPEG 為白底、兩張 JPEG 含烙入像素的棋盤格。
- 本機建置流程會依影像內容偵測五個角色區塊、排除來源地面陰影、保持長寬比、套用共用 32 色 palette，並對齊 96×96 cell 的 `(48,78)` 腳底基準。右前、右側、右後由三個安全方向水平鏡像。
- 開發預覽 `idle.grok-preview.webp` 為 768×768 lossless WebP 與真 Alpha。來源缺少動畫幀，因此八欄只用於靜態 A/B hold，manifest 明確標示 `formalReplacementEligible: false`；正式 idle／walk／happy 未被覆蓋。
- 本機可用 `?petRendererSource=grok-preview` 切換 idle 預覽。公開網域不建立此 debug API；walk／happy 與 run／pant／sleep 沿用現行 local-v1／fallback。
- `npm run test:pet:grok-preview`、local-v1 Sprite 測試、local-v1 Dashboard 測試與 Grok preview Dashboard 測試均通過。桌機與 390×844 手機在 56／72／88／104px 均通過尺寸、零控制元件重疊、跟隨與 fallback 回歸。

## 2026-09-13 Pet Companion Settings V1

- 系統設定新增桌面寵物顯示、48 至 1200px 大小、安靜／一般／活潑、閒置睡眠與戰鬥 Log 降低活動。手機顯示上限為 880px；超大尺寸以最大 128px 的獨立點擊區維持底層 UI 可操作。
- 五項桌面顯示設定寫入現有 MariaDB `web_preferences`；`show_pet_in_profile` 與 `show_pet_in_ranking` 已獨立預留，公開展示不受 `pet_companion_enabled` 控制。
- 關閉桌面寵物會隱藏同一 DOM 實體，停止 Companion 的 RAF、輸入／捲動監聽、ResizeObserver、MutationObserver、閒置與活潑反應計時器。重新開啟後沿用原狀態機與 anchor follow。
- `CharacterShowcase` 資料形狀與獨立 `PetShowcaseMode` 已預留給排行榜前三名。展示模式固定站在角色旁，只支援 idle／happy，不使用 Dashboard 的 scroll chase 或 panel anchor。
- `data-pet-animation`、`data-pet-renderer`、`data-pet-fallback` 可在開發者工具確認 renderer。idle／walk／happy 為正式 sprite；run／pant／sleep 目前標記 fallback。
- `npm run test:pet-companion` 通過關閉與恢復、四種尺寸、三檔活躍程度、睡眠開關、Log 降低活動、fallback 標記、帳號持久化、既有跟隨流程與 390×844 手機驗收。`npm run test:pet-showcase` 通過獨立展示結構驗收。

## 2026-09-13 地圖情報隨目前地圖更新

- 問題原因有兩項：地圖情報只在玩家點擊分頁時載入一次；查不到目前地圖時會回退顯示資料檔中的第一張地圖，造成跨圖後仍顯示南門情報。
- 事件輪詢取得新地圖後，地圖情報會同步切換標題、怪物種類、固定生成總量與怪物清單。缺少已查核資料時會顯示目前 map ID 與「無資料」，不再顯示其他地圖內容。
- `assets:map-info` 現依鎖定版 rAthena Renewal 實際啟用的 `npc/re/scripts_main.conf` import 鏈，為 53 張目前玩家流程地圖產生索引與獨立詳細檔。詳細檔只在玩家開啟地圖情報時按目前地圖載入。
- 實際資料確認 `moc_fild11` 為 4 種、318 隻，`pay_dun00` 為 7 種、125 隻；城鎮或沒有固定生成資料的地圖顯示 0 種、0 隻。
- `moc_fild20` 即使沒有公開 FLD2 地形，仍會依啟用中的 rAthena Renewal 生怪腳本顯示 5 種、5 隻固定怪，其中 4 隻為 Boss；由於只有 1 隻一般怪物且缺少世界地圖定位，不列為掛機地圖。
- 角色標頭、即時小地圖與地圖情報現由 `/api/state` 與 `/api/events` 任一途徑取得的最新角色快照同步；切入無索引地圖時會立即作廢前一張地圖的未完成請求，避免舊回應覆蓋目前位置。
- 390×844 瀏覽器測試已驗證 `moc_fild11` 切換至 `pay_dun00` 後內容同步更新、兩張詳細檔分開請求、無水平溢出及瀏覽器例外為 0，結果為 `MAP_INFO_SYNC_PASS`。

## 2026-09-13 常駐 Pet Companion 原型

- 現行 `127.0.0.1:8788` Dashboard 已加入單一常駐 Pet Companion；切換能力、技能、裝備、道具、地圖情報、掛機與戰鬥終端時沿用同一 DOM 實體，不會隨 panel 重新建立。
- 妙蛙種子的 idle、walk、happy 使用正式 Sprite；run、pant、sleep 保留可辨識 fallback，畫面不常駐顯示寵物名稱。
- 各主要區塊使用 `data-pet-anchor` 提供停留目標。快速捲動時寵物由畫面邊緣跑入，抵達後喘氣；閒置 30 秒進入休息，90 秒進入睡眠，點擊後顯示短暫反應。
- 寵物外層不接收事件，只有圖示可點擊；桌機與手機會搜尋鄰近且不重疊按鈕、輸入框、頁籤、裝備格與道具格的位置。390×844 實測操作元件重疊面積為 0，頁面無水平溢出。
- `node scripts/test-pet-companion-ui.mjs` 已在真實 Dashboard 登入流程通過能力、技能、裝備、戰鬥 Log、快速捲動、休息、睡眠、點擊、原控制元件與手機版驗收，結果為 `PET_COMPANION_UI_PASS`，瀏覽器例外為 0。

## 2026-09-12 Git 版本管理狀態

- Repository 已啟用 Git，穩定分支為 `main`，遠端為 `origin`：`https://github.com/amadiz1988-boop/terminal-arpg.git`。
- 目前開發分支為 `recovery/2026-09-13-working-tree`；`main` 的 `HEAD` 為 `265c1f7`。
- 2026-09-13 已建立並推送 `recovery/2026-09-13-working-tree`，提交 `da9ba6a` 保存 64 個程式、測試、設定與文件檔案。
- 救援分支與遠端差異為 `0 / 0`。`main` 保持在 `265c1f7`，待功能切片驗證後再整合。
- 尚未追蹤的 1,012 個檔案包含 1,009 個 Gravity BGM／紙娃娃衍生素材，以及 3 個隔離的 Persistent Agent 文件、patch 與 SQL。素材需完成授權與來源確認，Persistent Agent 需維持獨立範圍。
- 後續持續開發，每個可驗證功能完成後立即建立小提交並推送，避免再次累積大型工作樹。

## 2026-09-12 Vinext／D1 舊版網頁封存

- `http://localhost:3000/` 已無監聽程序，實際連線為拒絕連線。舊入口為 `app/`、`game/`、`db/` 與 Vinext／D1 的瀏覽器原型。
- `.openai/hosting.json` 已移至 `archive/legacy-vinext-demo/hosting.json`，並標記 `status: disabled`，避免專案被自動識別為舊 Sites 網站。
- `npm run dev` 與 `npm start` 改為啟動 `127.0.0.1:8788` Dashboard。舊 `build`、`qa:ui` 與 `test:release` 指令會輸出 `LEGACY_WEB_ARCHIVED` 並停止，`vite.config.ts` 也有明確封存阻擋。
- 舊原始碼保留作為可追溯封存，沒有刪除玩家或測試資料。目前唯一啟用的玩家入口為 `http://127.0.0.1:8788/`。

## 2026-09-12 掛機初心者藥水優先補血

- 一般掛機在 HP 低於 60% 時會先使用 item 569 初心者藥水；初心者藥水耗盡後，沿用 item 501 紅色藥水補血。
- 初心者藥水區塊固定排在紅色藥水前，並於 OpenKore 執行個體建立及啟動時重新套用。

## 2026-09-12 紙娃娃攻擊錨點與裝備欄旋轉修正

- 頭髮與身體在攻擊時分離的原因已定位：ACT 解碼器原先只略過每幀 16 bytes 的錨點資料，圖層因此沒有套用原廠的身體錨點減去頭髮錨點位移。
- ACT 解碼器現保留每幀錨點；排行榜與裝備紙娃娃共用身體幀時間與錨點差值。自動測試中的攻擊幀實際套用 `translate(-3px, 1px)`，與 manifest 錨點計算相同。
- 排行榜原本的左右雙箭頭是瀏覽器 `ew-resize` 游標，現已改為一般拖曳游標。Gravity Default Skin 可確認有 `sysbox_arr_l.bmp` 與 `sysbox_arr_r.bmp`，檔名顯示屬於 system box；是否原廠專用於裝備紙娃娃為 `【資料不足，無法確認】`。
- 裝備紙娃娃保留原有拖曳八方向，並新增上述官方像素箭頭的左右按鈕。每按一次旋轉一格，八次回到原方向。

## 2026-09-12 排行榜八方向旋轉與動作節奏修正

- 排行榜前十名的角色圖現可用滑鼠左右拖曳或手機左右滑動，逐格切換正面、左前、左側、左後、背面、右後、右側與右前八個方向。鍵盤左右鍵同步可用。
- 截圖中的職業身體對應正確；異常觀感來自前三名同步重複攻擊 4 秒。現改為以站立為主、攻擊僅 1.2 秒，並依名次錯開 0.9 秒。
- 390×844 測試會實際發出拖曳事件，驗證方向 0 → 1，再轉滿八格回到 0，同時保留垂直頁面滾動與無水平溢出。

## 2026-09-12 排行榜 11 職業紙娃娃補齊

- 已由本機 Gravity `data0.grf` 確認並唯讀擷取目前 11 個開放職業的男女 ACT／SPR，共 22 組身體素材。
- 排行榜與裝備欄展示現可正確對應初心者、劍士、魔法師、弓箭手、服事、商人、盜賊、跚拳少年／少女、超級初心者、神槍手與忍者。
- 所有 22 組都產生八方向站立、走路、坐下、攻擊與弓攻擊圖集。排行前三名保留動作輪播，第四至十名保留靜態站立，不再顯示「職業外觀製作中」。
- 新增 `assets:showcase:extract` 以 GrfCL 函式庫直接處理 CP949 路徑，解決 GrfCL.exe 在非 ASCII 素材路徑上的「控制代碼無效」。原始 GRF 保持未修改。
- `npm run test:character-showcase` 與 `npm run test:class-rankings` 通過；390×844 驗證 11 職業全數具備男女身體圖集、前三名換幀、零缺圖卡片及無水平溢出。

## 2026-09-12 神槍手紙娃娃修復

- 已核對玩家角色「賴清德」即時狀態為職業 ID 24 神槍手，原展示素材僅含初心者與弓箭手，導致畫面回退為靜態初心者。
- 已由本機 Gravity `data0.grf` 取得男女神槍手官方 ACT／SPR，產生站立、走路、坐下、攻擊及八方向展示圖集，並將職業 ID 24 接入展示台。
- 回歸測試新增男女神槍手圖集與前端職業映射檢查，防止再次誤顯示初心者。

## 2026-09-12 初始文件快照，已被上方現況取代

以下表格保留當時的稽核紀錄。其 Vinext、D1、建置與入口結論已失效，不得作為現行架構依據。

快照日期：2026-09-12
基準提交：`b72fede`（`main`，開始本次文件重構前工作樹乾淨，與 `origin/main` 同步）
套件版本：`0.90.0`
來源版本：rAthena Renewal `e985006171d2eb320ee512a653f4c83aea3d81b6`；OpenKore `51de1ddfc4449ae5217f6886de702f87ca934030`

本文件是新 Work／Codex 判斷現況的入口。完成度數字以 [RO_RESTORATION_PROGRESS.md](RO_RESTORATION_PROGRESS.md) 的逐項證據為準；優先序以 [TODO.md](TODO.md) 為準；版本決策與歷史脈絡見 [DEVELOPMENT_REVIEW_LOG.md](DEVELOPMENT_REVIEW_LOG.md)。

## 本次檢查已確認

| 項目         | 結果                                                               | 證據                                   |
| ------------ | ------------------------------------------------------------------ | -------------------------------------- |
| Git 狀態     | 開始整理前 `main...origin/main`，無待提交變更                      | `git status --short --branch`          |
| 領域測試     | 3 個測試檔、45 個測試全數通過                                      | `npm test`，耗時約 4 秒                |
| 靜態檢查     | 通過                                                               | `npm run lint`                         |
| 舊版正式建置 | 當時通過，產生 Vinext app 與 API routes；現已封存                  | 歷史 `npm run build`                   |
| 差異格式     | 通過                                                               | `git diff --check`                     |
| 當時入口     | `app/page.tsx` → `app/game-shell.tsx` 固定 seed demo；現已封存     | 歷史檔案檢查                           |
| 當時網站資料 | D1 `DB` binding 與 `world_json`；現已封存                          | 歷史設定與 schema                      |
| 本機服務     | 可由 `ops/ro-stack` 管理固定版 rAthena／OpenKore／MariaDB          | `docs/RO_LOCAL_SERVER_ARCHITECTURE.md` |

現行入口、驗證與發布規則以本文件最上方狀態及 `AGENTS.md` 為準。

## 已完成能力

以下是現行程式與既有驗收紀錄已支持的範圍：

- 固定 rAthena Renewal、OpenKore 版本，並在 `game/ro/source.ts` 提供來源識別。
- `prt_fild08` FLD2 地圖、怪物生成、逐格導航、索敵、普通攻擊、受傷、死亡、重生、掉落與拾取。
- Base／Job 經驗、等級提升、能力點、技能點、初心者技能、裝備與 Renewal 負重規則。
- OpenKore 風格的視野策略、隨機巡走、蒼蠅翅膀政策、自動拾取 89% 上限與負重觸發行為。
- 8788 Dashboard 提供帳號、工作階段、角色建立、角色選擇、掛機控制與真實狀態 API；正式角色狀態由 rAthena、MariaDB 與 OpenKore 提供。
- RO 風格玩家頁、小地圖、戰鬥終端、狀態、技能、裝備、道具、地圖情報與還原進度視窗。
- 官方皮膚、物品圖示、地圖與音效等部分資產匯入及繁中轉譯。
- 劍士、服事、魔法師、弓箭手與盜賊等一轉流程，以及新生任務中斷恢復與結業後返回掛圖，已有逐項紀錄；十種一轉資料已進入轉換器，其他職業仍待逐職實測。
- 本機 rAthena／OpenKore／MariaDB stack、健康檢查、控制頁與朋友測試腳本已有固定操作文件。

公開手機流程、外網玩家頁與素材驗收的詳細數值，僅以 `RO_RESTORATION_PROGRESS.md` 與對應驗收紀錄為證；新工作應先確認目標提交是否包含該紀錄對應的程式。

## 進行中

- `game/ro/world/simulation.ts` 仍承擔大量世界、戰鬥、物品與成長責任，尚未按行為邊界拆分；維持現況可工作，拆分需另立小任務與回歸測試。
- 完整職業、技能、裝備與任務資料仍需按固定來源逐職核對；十種一轉資料已轉換不代表十種流程都完成實測。
- `prt_fild08` 以外的地圖、傳點、路線與掛圖建議持續擴充。
- 官方 UI 的髮色、紙娃娃分層、字型與像素級比例仍有未通過項目。
- 多帳號背景程序、Windows 開機自動啟動與長時間公開運作仍待整合驗收。
- 固定網域與 Tunnel 程序斷線恢復已完成；主機層監督、備份與公開入口仍依公開發布閘門追蹤。

## 下一步

優先執行 [TODO.md](TODO.md) 的 P0、P1 項目，順序如下：

1. 保持這組接手文件與實際程式、測試、版本一致。
2. 完成 Windows 開機自動啟動與固定入口的長時間手機多人驗證。
3. 依來源補齊職業、技能、地圖與 UI 對齊，逐項留下測試證據。
4. 建立 Dashboard 綜合發布指令；完成前逐項保存測試、SHA、部署版本與公開流程結果，狀態維持 `未通過發布門檻`。

## 目前不可宣稱

- 不能把本文件的測試通過解讀為最新公開版本已部署。
- 不能把封存的 D1 原型資料當成 rAthena 正式角色權威資料或待整合系統。
- 不能把文件中的規劃模組當成已存在的程式目錄。
- 不能以單元測試、建置或一次人工瀏覽取代完整公開發布閘門。

## 2026-09-12 連線事件

- 玩家登入畫面顯示「無法連線」時，主機的 Dashboard、login、character、map 與 Quick Tunnel 均未運行；舊的 `trycloudflare.com` 網址已失效。
- 清除失效的程序狀態後重新啟動本機服務、Dashboard、Quick Tunnel 與 15 秒 watchdog。
- 驗證結果：資料庫、login、character、map、Dashboard、Tunnel 與 watchdog 健康檢查全數通過；新的公開入口首頁及 `/api/health` 均回傳 HTTP 200，健康內容為 `{"ok":true}`。
- 現有日誌只能確認服務停止，停止原因為 `【資料不足，無法確認】`。Quick Tunnel 每次重建都會更換網址，玩家必須使用 `.local/ro-stack/dashboard/tunnel-state.json` 記錄的最新入口。

## 2026-09-12 外網手機連線降載

- 登入後的 `/api/state` 已在本機重現平均 619.1ms，外網 Quick Tunnel 平均 636.8ms；未登入的首頁與 `/api/health` 當時皆可成功回應。
- 前端原本每 150ms 查詢戰鬥事件、每 350ms 查詢聊天、每 1.5 秒重建完整狀態。現調整為 300ms、1 秒與 5 秒，並在連續失敗時逐步退避至最長 5 秒，降低外網手機的持續請求量與斷線重試壓力。
- 手機登入頁的任意首次觸碰原會觸發 68 種戰鬥音效的預載與解碼；已改為真正播放到某種戰鬥音效時才單獨載入。手機登入按鈕同時由 42×20 放大為 84×40，送出期間鎖定重複點擊並顯示連線狀態。
- 逐畫面查核後，登入與創角只保留當前畫面必要的標題音樂、登入背景與紙娃娃。選角直接使用 `/api/session` 同一次回應中的輕量角色摘要，不再額外查詢或提前載入完整 `/api/state`、背包、裝備、任務與補給資料；傷害數字素材延後到真正進入遊戲才載入。

## 2026-09-12 原廠地圖音樂對齊

- 地圖音樂已依本機 Gravity 客戶端 `data.grf` 的 `data/mp3nametable.txt` 對齊，覆蓋目前 51 張公開路線地圖，以及 `prt_in`、`moc_para01`、`moc_fild11`、`pay_dun00` 等現行商店與伊甸園流程地圖。
- 新生任務路線使用原廠曲目：沉船與伊斯魯得／克里圖拉學院為 26、訓練場 `new_1-3` 為 30；普隆德拉與南門維持 08、12。
- 鎖定客戶端的 `int_land` 五個漂流島變體沒有 BGM 對照項目。由沉船進入時保留原廠 26；若直接登入該地圖則保持靜音，避免登入主題曲流入遊戲地圖。
- 新增 `npm run assets:bgm` 與 `npm run test:map-bgm`。測試會阻止新加入的公開路線地圖遺漏查核，並可透過 `RO_CLIENT_DIR` 比對公開音樂與本機原廠檔案雜湊。

## 2026-09-12 原廠式對話欄控制

- 「全部訊息」改為純聚合檢視，發言目標由獨立選單控制，預設「一般（附近）」，避免玩家把「全部」誤認為全服廣播。
- 顯示設定可關閉「全部」或其他分頁，至少保留一個顯示分頁；預設只顯示全部、一般、密語、隊伍、公會與系統，其餘 rAthena 頻道可自行開啟。
- 對話欄收合按鈕使用本機 Gravity Default Skin 的 `chat_close`／`chat_open` 圖示。文字仍由 OpenKore 對接真實 rAthena 封包；一般文字為附近玩家，錄音保留並送給同地圖的 WEB 玩家。
- 每行訊息顯示繁中頻道標籤。全服、地圖、交易、支援、同盟標籤分別採用 rAthena `channels.conf` 的白、黃、淺綠、藍、綠色碼；一般、密語、隊伍、公會、家族、戰場與系統依封包類型使用不同色彩。錄音標示為「一般」。
- `@web_...` 內部橋接命令會在 Dashboard API 與瀏覽器渲染兩層排除，避免任務控制文字再次出現在玩家對話欄。

## 2026-09-12 職業等級排行榜第一版

- 鎖定版 rAthena 原生排行為鐵匠、鍊金術師與跆拳名聲前10名，`MAX_FAME_LIST` 固定為10；OpenKore 有相同三類查詢封包。各職業等級前100名屬 WEB 擴充，角色進度仍以 rAthena MariaDB 為唯一來源。
- 玩家頁新增「排行榜」分頁，涵蓋目前開放的11個職業。排序依人物等級、職業等級、隱藏人物經驗、隱藏職業經驗及角色 ID，固定回傳最多100名。
- 前三名輪播站立、走路、坐下、攻擊，第四至十名顯示靜態紙娃娃，第十一至一百名使用精簡表格。展示復用裝備欄的官方 ACT／SPR 圖集與共用角色座標，不查詢或公開裝備、背包、能力、技能及所在地圖。
- 目前可確認動畫身體素材涵蓋初心者、弓箭手與神槍手；其餘職業顯示「職業外觀製作中」，避免使用錯誤職業外觀。後續需從已授權 Gravity 客戶端逐職匯入身體 ACT／SPR。
- 排行榜只在玩家開啟分頁時載入，每職業快取60秒，資料庫增加職業與等級複合索引；GM、刪除中角色及 `web_account_flags.is_test=1` 的測試帳號均排除。
- `npm run test:class-rankings` 在390×844通過 API 欄位白名單、100名上限、快取、非法職業拒絕、前三名動畫換幀、其餘版面與無水平溢出驗證。Dashboard 重啟後健康檢查通過。

## 2026-09-12 彈藥與補給循環修正

- 使用者核准將箭矢與子彈設定為「必須裝備、戰鬥不扣數量」；rAthena 既有 `battle_config.arrow_decrement` 提供此政策，未修改戰鬥核心。
- `ops/ro-stack/templates/battle_conf.txt` 與本機 `conf/import/battle_conf.txt` 現在設定 `arrow_decrement: 0`，保留 `ammo_unequip: yes` 與 `ammo_check_weapon: yes`。箭矢與子彈仍由 `Type: Ammo` 及 `Locations: Ammo` 維持彈藥欄裝備要求。
- 角色 `12345`（角色名 `123132131`）重啟後在 `prt_fild08` 持續攻擊；箭矢保持已裝備，連續 8 秒觀察數量由 43 維持 43。伺服器 `ro-stack.ps1 health` 的資料庫、三個連接埠、程序與服務連結全數通過。
- 此為全域自訂政策，涵蓋普通攻擊與需要彈藥的技能；若日後要只套用特定箭矢或子彈，需另建物品白名單規則。

## 2026-09-12 小地圖單位數量標示

- 小地圖圖例顯示目前地圖的怪物總量與在線玩家總量。怪物總量取自 `public/ro/data/map-info.json` 的地圖資料，玩家總量由控制層查詢遊戲資料庫中 `online=1` 且 `last_map` 相同的角色。
- 玩家總量查詢依地圖快取 1 秒，事件輪詢不會每次都新增資料庫查詢。
- 「你」與「交戰」圖例文字與顏色保持原樣；數量只附加在「怪物」與「玩家」後方。
- `scripts/test-social-ui.mjs` 新增圖例數量與地圖資料、控制層快照的一致性檢查。

## 2026-09-12 伊甸園第一套裝備流程

- Renewal version gate 鎖定 rAthena `e985006171d2eb320ee512a653f4c83aea3d81b6` 與 OpenKore `51de1ddfc4449ae5217f6886de702f87ca934030`。啟用來源、任務鏈、NPC、目標與獎勵記錄於 [EDEN_EQUIPMENT_SOURCE_DECISION.md](EDEN_EQUIPMENT_SOURCE_DECISION.md)。
- 現有 WEB 任務日誌已接入 Lv.12 伊甸園裝備訓練。雙擊後依 rAthena `para_suv01`、quest 7128 至 7132、MariaDB inventory 與 OpenKore `%questList` 執行入團、接取、三段擊殺、回報與領裝。
- 任務列顯示名稱、狀態、當前目標、擊殺進度、下一步、可否回報與四件獎勵。Lv.26 與 Lv.40 保持顯示並回覆 `not_available`，尚未接入執行。
- 同帳號具備 5 秒發起互斥，OpenKore 同時只接受一個 onboarding 或 Eden 任務。快速重複請求回覆 `command_rejected`。
- 隔離 Lv.12 一轉角色的手機頁任務列顯示「可進行」、目標、下一步、回報狀態與四件獎勵；雙擊後進入 `route_officer`，立即重複請求回覆 HTTP 409 `command_rejected`。
- 實測角色 `EdenTest0912A` 完成 Condor 10 隻、Baby Desert Wolf 10 隻、Scorpion 5 隻。原生 Michael NPC 發放 item 5583、2560、2456、15009；MariaDB 記錄 `para_suv01=12`、`para_suv02=1`、quest 7132 state 2，四件 inventory 數量各 1。
- 完成後再次呼叫 Lv.12 任務回覆 HTTP 409 `already_completed`；未完成一轉的隔離測試角色回覆 HTTP 409 `prerequisite_incomplete`。
- `npm run test:eden-equipment` 通過。未執行完整 `npm run test:release`，本輪未進行公開發布。

## 2026-09-12 伊甸園 Lv.26 任務與離場修正

- 伊甸園入團完成後依 Base Lv. 自動銜接裝備訓練。Base Lv.26 至 32 使用 rAthena 原生 quest 7138 至 7141。
- 伊甸園總部離場改用伺服器 `@web_eden_return` 傳送，避免 OpenKore 對 `moc_para01,30,10` 的 OnTouch 出口反覆尋路。
- Lv.26 流程已接入 Boya、Karl、Skeleton 15 隻、Poporing 10 隻、Boya 回報、Michael 領取 Boots II、Uniform II 與職業武器。
- 實測角色 `123132131` 已由 `moc_para01` 傳送離場、接取 quest 7138、由 Karl 切換至 quest 7139，並在 `pay_dun00` 完成 Skeleton 進度 1 / 15。角色保持在線並繼續執行任務。
- `npm run test:eden-equipment`、Dashboard 與 OpenKore 實機載入通過。未執行完整 `npm run test:release`，本輪未進行公開發布。

## 2026-09-12 伊甸園 Lv.26 收尾與裝備穿脫修正

- 問題重現：角色 `123132131` 完成 Lv.26 領裝後停在 `moc_para01`，`@web_eden_return` 被伺服器當作一般聊天；五件伊甸園裝備均具備可裝備標記，但領獎 NPC 對話仍為 `close`，穿裝封包送出後未生效。
- 自訂 NPC 的三個 `bindatcmd` 改用唯一 NPC 名稱 `strnpcinfo(3)` 綁定事件。服務重載後，角色執行離場恢復，由 `moc_para01` 成功傳送並返回 Base Lv.32 推薦掛圖 `pay_dun00`。
- 領裝收尾會先關閉 NPC 對話，等待對話狀態清除後再自動穿上伊甸園獎勵，避免伺服器在 NPC 互動期間拒絕穿裝。
- 實機穿脫驗證通過：Eden Bow I 可穿上、卸下、再次穿上；Boots II、Uniform II、Hat、Manteau 均已穿上，資料快照分別回報 equip mask 64、16、256、4，Bow I 回報 34。
- `node scripts/test-eden-equipment.mjs` 通過，rAthena 健康檢查的資料庫、三個服務連接埠、程序與服務連結全數通過。本輪未執行公開發布。

## 2026-09-12 跨地圖小地圖地形修正

- 問題重現：`pay_dun00` 的 OpenKore runtime 已有 FLD2 地形，`public/ro/maps/pay_dun00.fld2.bin` 缺少，原請求回 HTTP 404，WEB 小地圖因此只繪製黑底。
- 控制頁依序使用公開素材、有效的 OpenKore FLD2、鎖定版 rAthena `map_cache.dat`。OpenKore 檔案缺少或格式無效時，控制頁會把伺服器快取內的 GAT cell 即時轉成 FLD2 並快取結果；未知地圖維持 HTTP 404。
- 全量盤點 rAthena 三層快取共 1,296 張伺服器地圖。實際逐張 HTTP 請求結果為公開素材 51 張、OpenKore 備援 922 張、rAthena 快取備援 323 張，全部通過尺寸與格數驗證；含 `@` 的副本地圖也在測試範圍。
- OpenKore runtime 共 1,115 個檔案，其中 6 個無效舊檔均未出現在 rAthena 伺服器快取，不影響目前啟用地圖。有效 OpenKore 檔案仍會優先使用，格式不正確時自動降級至 rAthena 快取。
- `pay_dun00` 載入為 200 × 200、8,285 個可行走格；既有 `prt_fild08` 公開地形仍由原路徑載入。動態備援由伺服器記憶體與瀏覽器各快取一小時，地圖切換期間不增加資料庫查詢或定時輪詢。
- `npm run test:minimap-terrain` 全部 1,296 張通過，並涵蓋公開素材、OpenKore、rAthena、一般地圖、副本地圖與未知地圖。未執行完整 `npm run test:release`，本輪未進行公開發布。

## 2026-09-12 推薦掛圖存檔點同步

- 角色進入符合目前 Base Lv. 的推薦掛圖時，由 rAthena `OnPCLoadMapEvent` 同步附近城鎮存檔點；存檔點已相同時不重複寫入。
- Lv.1 至 11 的 `prt_fild08` 對應普隆德拉南門 `prontera,150,33`；Lv.12 至 25 的 `moc_fild11` 對應夢羅克南側 `morocc,156,46`；Lv.26 以上的 `pay_dun00` 對應斐揚洞窟入口村莊 `pay_arche,49,144`。座標沿用鎖定版 rAthena 卡普拉腳本。
- 此流程使用三張推薦掛圖的 `loadevent`，沒有新增玩家可輸入的管理指令；未符合地圖及等級組合的角色不變更存檔點。
- 實測角色 `123132131` 為 Base Lv.33，進入 `pay_dun00` 後收到同步訊息；重新登入前資料庫存檔點由 `izlude,129,141` 更新為 `pay_arche,48,143`，座標落在卡普拉腳本設定的 1 格隨機範圍內。角色已重新連線並載入地圖。
- `npm run test:eden-equipment` 與 rAthena 啟動腳本解析通過；資料庫、login、character、map、程序與服務連結健康檢查全數通過。本輪未進行公開發布。

## 2026-09-12 伊甸園回程、裝備與任務補給修正

- 實機確認角色 `123132131` 的 Lv.26 原生 quest 7141 已完成，MariaDB 為 `para_suv01=23`、quest 7141 state 2。rAthena Michael 發放 item 1747、2457、15010、5583、2560，五件均已穿上；弓箭手換弓後會重新裝備 item 1750 箭矢。
- 第一套 item 2456、15009 從未進入此角色 inventory、storage 或 picklog。WEB 不再僅以 `para_suv01 >= 12` 顯示第一套已領取，改用原生階段、`para_suv02` 與實際獎勵物品共同判定。
- `@web_eden_return` 在本次實機仍被當作一般聊天。Eden 回程改走啟用中的原生 `moc_para01,30,10` OnTouch 出口，並將停滯重試限制為至少 8 秒一次。
- Lv.12 領裝後，若 Base Lv.26 至 32，既有 Eden task 直接切換至 Lv.26 接取階段；最終完成後依等級回到 `pay_dun00`、`moc_fild11` 或 `prt_fild08`。Dashboard 建立背景角色時使用同一級距，不再固定南門。
- 任務或返回掛圖前紅色藥水少於等於 20 個時，流程暫停戰鬥與拾取，依序販售、購買、儲存，再續跑。OpenKore 購買金額條件從無效的開放區間改為 `>=`；實機已販售 19 種戰利品，購得 item 501 ×100、601 ×20、602 ×3。
- 紅色藥水於 HP 低於 60% 自動使用；實機在 `pay_dun00` 已確認 item 501 數量下降且 HP 回復。找怪閒置 12 秒使用 item 601，補給回城使用 item 602，兩者均由既有 OpenKore 路徑執行。
- 能力值按鈕長按 380ms 後開始連續加點，間隔由 220ms 漸進縮短至 65ms；每次仍等待伺服器確認，放開或移出按鈕立即停止。
- `npm run test:eden-equipment`、JavaScript 語法、PowerShell 語法、差異格式與 OpenKore 實機載入通過。未執行完整 `npm run test:release`，本輪未進行公開發布。

## 2026-09-12 原廠傷害與暴擊素材實機驗收

- 本機 `main` 已納入 PR #1 提交 `6c624f2`，並以 GrfCL 對 Gravity RagnarokOnline 的 `data.grf`、`data0.grf` 進行唯讀擷取。
- `npm run assets:damage` 顯示 `RO_DAMAGE_ASSETS_IMPORTED=24`；輸出包含兩組 0 至 9 數字、暴擊底圖、lens1、lens2、音效與 manifest。
- 匯入前後三個客戶端 GRF 的檔案大小、修改時間與 SHA-256 完全一致。
- `npm run test:damage-floats-ui` 回報 `DAMAGE_FLOATS_UI_PASS`；另於 390×844 的即時 rAthena 戰鬥捕捉自然暴擊 36，官方素材載入、兩位數圖塊、暴擊底圖與八方向光線均通過。
- `npx vitest run tests/game/ro-client-image.test.ts` 共 2 項通過。本輪只準備提交合法授權的轉換素材，未執行完整公開發布。

## 2026-09-12 手機傷害顯示直接調整

- 暴擊八方向光線的寬、高均使用 `--damage-float-size` 計算，會與一般數字、暴擊數字及暴擊底圖同步縮放。
- 系統頁的傷害預覽支援拖曳灰色數字改變水平與垂直位置，並可拖曳右下角把手改變 10% 至 1000% 的傷害大小；實戰黑窗保持不可觸控。新帳號與尚未建立偏好資料的帳號預設為 500%，已儲存的玩家設定維持原值。
- 拖曳會即時同步大小、水平位置與垂直位置滑軌及百分比，並沿用既有 250ms 防抖寫入帳號偏好。
- 390×844 測試把位置拖至 44%／63%、大小由 80% 拉至 130%，滑軌、文字、無障礙數值與資料庫回讀一致；放射寬度／高度實測為傷害尺寸的 0.42／7.5 倍。
- `npm run test:damage-floats-ui` 回報 `DAMAGE_FLOATS_UI_PASS`，瀏覽器錯誤與水平溢位皆為零。本輪未執行完整發布。

## 2026-09-12 擴充一轉與超級初心者往返流程

- 實際資料庫確認角色 `賴清德` 的創角志願為 `gunslinger`；線上舊版學院 NPC 只辨識六個標準一轉，因此錯誤顯示「沒有選擇一轉志願」。
- 學院結業導師與 OpenKore 轉職路由已補齊超級初心者、跆拳、神槍手及忍者，四職共用 `iz_ac01,60,67` 的伺服器權威轉職 NPC。
- 超級初心者在 Job Lv.10、基本技能 Lv.9 且 Base Lv.45 未達標時，由導師依現行等級級距送至 `prt_fild08`、`moc_fild11` 或 `pay_dun00` 自動練功；任務日誌的「一轉結業」未達標時返回推薦練功地，達標後傳回學院。
- 超級初心者的「一轉結業」在未完成期間保持可操作；未滿 Base Lv.45 顯示目前進度，達標後顯示「可返回學院」。
- 神槍手的 `Six Shooter [2]` 要求 Base Lv.10，忍者的 `Asura [2]` 要求 Base Lv.12；快速結業會精確補到裝備門檻並自動裝上武器與彈藥。
- 已以單一 NPC 檔案熱更新套用，login、character、map 三項服務均未重啟。實測角色 `賴清德` 已成為 Job ID 24 神槍手，Base Lv.10、Job Lv.1，在 `prt_fild08` 裝備 `Six Shooter [2]` 與 500 發子彈並恢復自動練功。

## 2026-09-12 原廠角色展示台第一階段

- 裝備欄中央紙娃娃改用官方 ACT／SPR 的共用角色座標繪製，移除固定 26px 頭身拼接。男女初心者、男女弓箭手與 42 種男女髮型均已產生可重建圖集。
- 展示台支援站立、走路、坐下、攻擊四種原廠動作，每種動作均保留八方向。平時依序輪播，按住左右拖曳時固定自然站姿並可轉完八方向一圈；鍵盤左右鍵提供同等操作。
- 髮型、身體以後髮、身體、前髮三層排列，方向與動畫時間共用同一狀態。角色名稱、職業、性別、髮型、髮色與已裝備件數仍讀取遊戲伺服器快照。
- 目前動畫身體素材明確涵蓋初心者與弓箭手；其他職業保留原靜態紙娃娃。裝備名稱、圖示及穿脫功能維持現行伺服器流程，外觀圖層進度見下方第二階段。
- `npm run assets:showcase` 產出 4 組身體、84 組髮型；`npm run test:character-showcase`、`npm run test:eden-equipment` 與 `npm run build` 通過。`test:social-ui` 受既有音效測試狀態缺失中止；`test:combat-equipment-ui` 受線上角色補給循環逾時，兩者均未取得通過結果。本輪未進行公開發布。

## 2026-09-12 補給中斷戰鬥復原

- 問題重現：角色 `賴清德` 的武器與子彈均已裝備，OpenKore 持續巡走，但 `attackAuto 0` 與 `itemsTakeAuto 0` 被寫入角色設定，造成永久停止攻擊與拾取。
- 補給流程現在會在關閉戰鬥前，以角色實例內的 `supply-guard.txt` 原子保存原始攻擊與拾取設定；建立安全鎖失敗時保留戰鬥設定並略過該次補給。
- OpenKore 啟動或外掛重新載入後會檢查安全鎖、還原設定並移除安全鎖。補給完成、任務失敗及補給逾時均清除安全鎖。
- 180 秒逾時檢查移至 AI 佇列檢查之前，持續尋路或商店佇列無法再阻止復原。
- 受控中斷驗收將角色設定為 `attackAuto 0`、`itemsTakeAuto 0` 並留下安全鎖後重連；系統自動還原兩項為 `2`、移除安全鎖，角色隨後擊殺兩隻 Lunatic、取得 Base 與 Job 經驗並拾取 Carrot。
- `npm run test:supply-recovery`、`npm run test:expanded-first-job`、47 項 Vitest、lint 與 `git diff --check` 均通過。login、character、map 服務未重新啟動。

## 2026-09-12 玩家命令通道與技能同步修正

- 角色 `賴清德` 的手動 OpenKore 重連缺少 `RO_COMMAND_DIR`，網頁送出的能力、技能、任務及補給命令停留在角色 commands 資料夾。重新以 Dashboard 相同的 `RO_STATUS_SNAPSHOT`、`RO_COMMAND_DIR`、`RO_SOCIAL_LOG` 環境啟動單一角色程序後，命令通道恢復。
- 兩筆舊的 `social_global ...` 測試訊息已移至角色實例內可復原隔離資料夾，避免重新連線後延遲廣播。玩家原先送出的兩次 Luk 配點已套用，Luk 由 1 升至 3。
- 第二個問題發生於角色剛進入遊戲且技能清單尚未同步時；舊流程直接回覆「此技能目前無法提升」並移除命令。技能命令現在會保留在佇列，等到伺服器技能清單到齊後才判定與送出。
- 重新送出玩家原先的技能操作後，`GS_GLITTERING` 由 0 升至 2、`GS_SNAKEEYE` 由 0 升至 1，三筆命令均回覆成功。角色保持攻擊與拾取。
- `npm run test:command-bridge`、`npm run test:supply-recovery`、47 項 Vitest、lint 與 `git diff --check` 通過。login、character、map 服務未重新啟動。

## 2026-09-12 原廠角色展示台第二階段

- 站立與坐下固定使用各方向第一畫格，頭髮、頭飾與身體不再循環位移。走路及攻擊保留原廠動畫。
- 平時每 10 秒切換一次展示動作；玩家點選任一動作後，該動作保持 60 秒再恢復自動輪播。拖曳旋轉切回站姿時保留原輪播截止時間。
- 目前角色的身體、髮型、伊甸園帽及弓箭素材會在展示前一次預載；八方向只切換已載入圖集的背景座標，避免轉向期間分層載入造成閃爍。
- 新增「顯示裝備外觀」本機偏好開關。rAthena item 5583 的 `View: 465` 對應目前 Gravity 客戶端 `ACCESSORY_PARADE_CAP = 465` 與男女頭飾 ACT／SPR；弓箭手裝備名稱或 Aegis 名稱含 Bow／弓時使用男女通用弓圖層，攻擊動作改用原廠弓攻擊群組。
- 官方裝備頁的 `Open equipment` 勾選用途是允許其他玩家查看裝備資訊，來源為 iRO Wiki Basic Game Control；本專案的「顯示裝備外觀」是角色展示台的本機顯示選項。Eden Uniform II、Boots II、Manteau I 在鎖定版 rAthena item DB 沒有 `View` 欄位，本輪不產生身體外觀圖層。
- `npm run assets:showcase` 產出 4 組身體、84 組髮型與男女帽子／弓共 4 組裝備外觀；`npm run test:character-showcase`、`npm run test:eden-equipment`、`npm run build` 與差異格式檢查通過。本輪未進行公開發布。
# 2026-09-12 任務與補給循環隔離

- 實機重現角色 `賴清德` 執行伊甸園 Lv.12 裝備任務時，74.6% 負重高於玩家設定的55%門檻；一般補給在每次擊殺後介入，累計12次往返普隆德拉，且8 Zeny低於40 Zeny開倉門檻，任務只推進至 Baby Desert Wolf 3 / 10。
- 伊甸園 Lv.12／Lv.26 裝備任務進行中會阻止一般負重補給取得控制權，任務專用的低紅水補給仍可執行。
- 自動購買會保留 `minStorageZeny` 所需金額；存倉完成後負重沒有下降時，補給暫停5分鐘再重試，避免立即跨城循環。
- 新帳號補給回程預設門檻由68%調整為75%，89%停止拾取安全門檻維持不變。

# 2026-09-13 伊甸園任務離場對話復原

- 實機重現角色 `賴清德` 已完成 Lv.12 伊甸園裝備任務並領取四件獎勵，但 NPC 對話仍停在 `close`，角色固定於 `moc_para01 (110,94)`，持續重算前往出口的路線。
- 對話取消期限到期後，只要伺服器仍保留對話 ID，外掛會延長取消期限並持續送出關閉；對話 ID 消失後才清除取消狀態。
- 返回掛機地圖的所有階段現在先等待 NPC 對話完全關閉，再進行穿裝、站立或尋路，避免在對話狀態中無限重算出口路線。
- 離開伊甸園後實機重現普隆德拉卡普拉傳送表在初始對話狀態尚未穩定時便執行舊步驟，造成 OpenKore 清除剩餘選單；Renewal 路線現在先等待初始對話同步，再依伺服器順序繼續、選「Use Teleport Service」、繼續並選夢羅克。
- 單一角色實機驗收通過：賴清德由伊甸園裝備室離場，使用一張免費卡普拉傳送券抵達夢羅克，步行進入 `moc_fild11`，回程狀態歸零且 NPC 對話關閉；AI 恢復自動模式後連續擊殺 Scorpion 與兩隻 Baby Desert Wolf，Base EXP 由 7159 增至 7487、Job EXP 由 1862 增至 2072。
- `npm run test:eden-equipment`、`npm run test:supply-recovery`、lint 與 `git diff --check` 通過；login、character、map 服務及其他角色程序均未重啟。
- 單一角色標準啟動腳本仍會因現行資料庫缺少 `persistent_agent_state` 而拒絕啟動，本次沿用 Dashboard 的角色環境參數恢復該程序；此資料庫相容問題需另案修正。
- 回程狀態機新增三層有限防護：NPC 對話等待與取消各以15秒為限，角色原地10秒會清除舊路線並重算且最多4次，整段回程最多10分鐘。
- 任一防護達到上限後會停止回程重試、清空舊 AI 路線、恢復目前地圖自動操作，並在任務事件留下 `job_resume_failed` 與 `dialog_timeout`、`route_stuck` 或 `route_timeout` 原因，避免無限移動與無限對話重試。
- 防護版本已載入賴清德的單一角色程序；rAthena 釋放舊連線後自動重連成功，角色保持於 `moc_fild11`、回程狀態為0、NPC 對話關閉，並立即攻擊 Baby Desert Wolf。
- 補給回程另重現 `moc_fild01 (84,19)` 的 Continental Guard 路線資料錯誤：OpenKore 將任務型 NPC 記成無對話傳點且使用錯誤落點 `moc_fild20 (209,333)`；Renewal 路線已依 rAthena `quests_morocc.txt` 改為等待對話、繼續兩次、選擇「Enter the Field」，並使用伺服器實際落點 `moc_fild20 (208,207)`。
- 單一角色實機驗收通過：賴清德成功完成 Continental Guard 三階段對話並抵達 `moc_fild20 (208,207)`，其後經夢羅克與 `moc_fild12` 返回 `moc_fild11`；補給狀態由 `route` 恢復為 `attack`，擊殺 Baby Desert Wolf 後 Base EXP 由2563增至2718、Job EXP 由5858增至5957並拾取 Orange。
- 修正版已套用至現存 74 個角色實例的 Renewal 路線檔，74/74 均為 `moc_fild01 (84,19)` 經 Continental Guard 對話進入 `moc_fild20 (208,207)`。12 個仍載入舊路線的在線角色採逐隻重連，最終 13/13 個在線角色均重新登入、路線正確且無殘留 NPC 對話；login、character、map 服務全程未重啟。

# 2026-09-13 伊甸園補給與導航循環防護

- 實機確認 `JobTestMage`、`JobTestThief`、`阿修羅關東煮` 與 `EdenTest0912A` 曾在 `moc_para01` 連續重算跨圖路線；其中 `阿修羅關東煮` 的最新 120 行日誌含 60 次 `moc_para01 -> prt_in` 失敗與 60 次自動購買重試。
- 根因一為 Fly Wing／Butterfly Wing 被固定設為 `prt_in (126,76)` 必買品。兩項永久移動道具已從自動購買清單移除，缺少時不會觸發跨城採購；角色仍可沿用正常走路與卡普拉路線。
- 根因二為此 rAthena 版本將伊甸園斷開樓層放在同一張 `moc_para01`，上游 tRO 路線仍使用 `moc_paraup`。已依 `npc/re/warps/other/paradise.txt` 同步 15 條內部傳點，包含伊甸園徽章落點附近的 `(179,90) -> (41,185)`，再接 `(47,161) -> (47,18)` 與 `(30,10)` 出口。
- 通用路線防護現在監聽 `fail_calc_map_route`。同一自動補給或掛機導航在 30 秒內連續失敗 3 次會清除舊 AI 路線、停止即時重算並進入 5 分鐘冷卻；一般導航冷卻後只在玩家未另選地圖時恢復原 `lockMap`。
- 僅重連四個已確認循環的角色程序，login、character、map 與其他正常角色程序均未重啟。實測 `阿修羅關東煮` 依序通過 `moc_para01 (171,115) -> (41,185) -> (47,18) -> prontera`，抵達 `prt_fild00` 後完成至少 10 次攻擊；新日誌路線失敗為 0。
- 最終掃描 14 個在線角色各自最新 120 行日誌，`Cannot calculate a route` 合計為 0；上述四個受影響角色的 `Calculating auto-buy route to: Inside Prontera` 均為 0。補給復原與伊甸園裝備靜態測試通過，差異格式檢查通過。

# 2026-09-13 掛機地圖最近卡普拉據點

- 據點選擇改由 3,534 筆 Renewal portal 路線建立的實體地圖拓撲計算，不再以地圖名稱或前綴判斷城市。付費城市傳送邊不參與「哪個城市最近」的距離計算。
- 現行 28 張可選掛機地圖均能找到有限距離的普隆德拉、斐揚、夢羅克、吉芬或伊斯魯德島據點；斐揚洞穴、蘇克拉特沙漠、吉芬原野與海底洞穴的代表結果分別指向斐揚、夢羅克、吉芬與伊斯魯德島。
- 變更掛機地圖時先比較資料庫權威儲存點。城市不同會持久化遷移狀態、暫停戰鬥、前往目標卡普拉、選擇 `Save`，完成後才更新存倉、販售、回城及 `lockMap` 設定；失敗會恢復原掛機目標與戰鬥設定。
- 隔離測試角色 `JobTestSuperNovice` 從 `prt_fild08` 進入普隆德拉，向 `prontera (151,29)` 卡普拉選擇 `Use Teleport Service` 與 `Payon`，消耗一張卡普拉傳送免費券後抵達 `payon (161,58)`，再向 `payon (181,104)` 卡普拉選擇 `Save`。資料庫最終確認 `save_map=payon`，OpenKore 設定為 `lockMap=pay_dun00`、`storageAuto_npc=payon 181 104`、`sellAuto_npc=payon 159 96`，戰鬥恢復為 `attackAuto=2`。
- 舊版角色程序在玩家首次更換掛機地圖時會受控更新一次，等待新版導航快照後才接受指令，避免舊外掛忽略據點遷移命令。
- `npm run test:grind-hub-transition`、`npm run test:map-info`、三項 JavaScript 語法檢查及相關差異格式檢查通過。
# 2026-09-13 Thief 到 Assassin Production Vertical Slice

- 固定 `AssassinGateThief` 已從 Thief、Base Lv.50、Job Lv.40、技能點 0 的可重置起點完成 Assassin 志願、刺客公會受理、三套正式題庫之一、精準目標、試煉前補給、無擊殺路線、三節點迷宮、公會長與 Frozen Heart。
- 最終 commit 由 rAthena 扣除 Frozen Heart、完成 Quest 8008 並執行 `Job_Change,Job_Assassin`；MariaDB 實機確認 class 12、Job Lv.1、Quest 8008 狀態 2，重複送出由 idempotency commit 去重。
- 玩家任務頁已接入完整 Mission Stage，桌面與 390×844 手機畫面實際顯示刺客、刺客公會及「正式轉職完成」。
- 24 項刺客矩陣、17 項 Foundation gate、Quest Runtime、MariaDB、Supply、47 項 Vitest、lint 與目前玩家入口檢查全部通過。完整證據見 [ASSASSIN_VERTICAL_SLICE.md](ASSASSIN_VERTICAL_SLICE.md)。
- 本輪未執行 Novice、新生引導、Thief 一轉或自然練等，login、character、map 與其他角色程序均未重啟。

# 2026-09-14 Swordman 到 Knight Production Vertical Slice

- 固定 FLOW fixture `KnightGateSwordman` 從合法 Swordman、Base Lv.60、Job Lv.40、Skill Point 0 的可重置起點完成 Knight 志願、騎士團、材料、八題知識測驗、Renewal 三波、騎士倫理、五分鐘禁殺、最終面談與手動 COMMIT。
- FLOW 實測 ATK 90+175、Max HP 2,475、DEF 60+207；三波第一次完成，白水由 80 降至 78。測試帳號 `is_test=1` 且排除公開統計。正式 Balance 驗證尚未執行。
- 禁殺實機觀測 329.854 秒、39 個不同位置、75 次避敵移動；SAFE、MOVING、THREAT、FALLBACK 均出現，三種攻擊計數皆為 0。
- 手動提交前仍是 class 1 且獎勵 0；提交後由 rAthena 確認 class 7、Job Lv.1、Quest 9012 state 2、Awakening Potion 7。
- 通用 Quest Event Log、Windows 長 SQL 標準輸入傳輸、任務期間自動 NPC 對話暫停，以及 map-server restart 回試煉 checkpoint 已完成。完整證據見 [KNIGHT_VERTICAL_SLICE.md](KNIGHT_VERTICAL_SLICE.md) 與 [QUEST_EVENT_LOG.md](QUEST_EVENT_LOG.md)。

# 2026-09-13 二轉 Quest Runtime 架構收尾

- Generic Quest Runtime 已移除 Assassin public projection 與 `state.assassin` completion 判斷，改由 `adapterState`、`adapterStatus` 與 `SERVER_AUTHORITY` completion mode 驅動。
- Trial、Route Event、Supply、Death、Restart 與 Job Change commit 保持共用；Assassin 的 no-kill preflight、補給離場 descriptor、Quest ID、item、mob、地圖、題庫與文案集中於 Adapter。
- OpenKore executor 改用通用 `quest_server_command`、objective `serverCommand` 與 supply `prepareCommand` descriptor，沒有 Assassin 專用 command channel 或 supply 分支。
- Dashboard 提供通用 job quest service registry、`/api/quest-runtime/job-action`、`/api/quest-runtime/job-commit` 與玩家頁 renderer registry；舊 Assassin API 保留相容入口，不承載流程規則。
- 新增 [JOB_QUEST_ADAPTER_CONTRACT.md](JOB_QUEST_ADAPTER_CONTRACT.md) 與 `test:quest-runtime:adapter-contract` 架構 Gate。測試從既有固定 Thief fixture 與 component checkpoint 開始，沒有重跑 onboarding 或 Thief 一轉。

# 2026-09-13 伊甸園 Lv.26 接取循環修正

- 實機角色 `蕭美琴` 在 `moc_para01` 與 Instructor Boya 完成 512 次相同對話；伺服器始終沒有建立 Quest 7138，`para_suv01` 停在 12。
- 根因為 `equipment26_accept` 沒有 NPC 選項映射，通用預設選到拒絕選項 `No, way.`。已固定選擇第二項 `Absolutely, I will.`。
- 同一任務階段完成 NPC 對話後若伺服器狀態仍未推進，會等待 2 秒再確認；累計三次即停止任務並顯示「NPC 對話無進展」，避免無限循環。
- 僅重連 `player_2000111` 角色程序。實測 Quest 7138 成功建立、`para_suv01` 由 12 前進到 13，後續 Quest 7139 已建立，角色抵達 `pay_dun00` 並進入 `equipment26_hunt_skeleton`。
- 新程序中 Boya 接取對話、正確選項與 Quest 7138 建立均各一次，外掛載入錯誤為 0；`npm run test:eden-equipment` 與差異格式檢查通過。login、character、map 與其他角色程序均未重啟。

## 2026-09-13 管理後台角色活動與緊湊版面

- 角色卡改為緊湊資訊格。桌面寬度 1040px 以上每列最多三張服務卡與角色卡；390px 手機維持單欄、44px 觸控高度及零水平溢位。
- Ops Agent 依角色程序、OpenKore AI 動作、onboarding、伊甸園、Quest Runtime、轉職路線及掛機據點遷移狀態，統一顯示「掛機中」「任務中」「待機中」「已停止」或「無法判斷」。
- OpenKore 狀態快照新增 `lastCombatAt`，由角色開始攻擊及伺服器攻擊封包更新；尚未重新載入新版外掛的在線角色，由 Ops Agent 依即時 attack／engaged 快照補記本次程序觀察到的最後打怪時間。
- 角色卡直接顯示地圖與相對最後打怪時間；帳號、角色編號、活動、目前動作、完整最後打怪時間、最後回報、執行器與錯誤碼保留於進階資訊。
- 角色清單優先顯示尚無打怪紀錄的執行中角色，其後依最後打怪時間由舊至新排列；已停止的歷史角色維持在清單末端。
- `OPS_AGENT_CONTRACT_PASS`、`OPS_AGENT_READONLY_PASS`、`OPS_AGENT_MOBILE_UI_PASS`、`OPS_AGENT_INCIDENTS_PASS`、`OPS_AGENT_AUTH_PASS`、`EDEN_EQUIPMENT_SOURCE_AND_BRIDGE_PASS` 及差異格式檢查通過。

## 2026-09-14 千人級 Web 監控降頻

- Dashboard 以每個瀏覽器分頁的短期 lease 判斷 `high`、`low`、`hidden`。只有玩家正在查看「掛機」頁且世界地圖未覆蓋時維持 300ms 戰鬥事件更新；其他遊戲頁為 2.5 秒，背景分頁為 5 秒。
- OpenKore 狀態快照由固定 150ms 改為高頻頁 300ms、其他情況 2 秒；命令資料夾檢查依高頻、一般、無 Web 觀看者分別為 250ms、500ms、1 秒。瀏覽器關閉或 lease 逾時 30 秒會自動降頻。
- 背景分頁的完整角色狀態由 5 秒改為 30 秒；社交訊息在可見頁維持 1 秒，背景分頁改為 5 秒。登入、創角及選角頁仍不啟動戰鬥事件輪詢。
- 戰鬥事件快取上限由每角色 1,000 筆降為 100 筆，游標落後超過保留範圍時會重置到最新 100 筆；OpenKore 任務 callback watcher 改為有期限的 Map，只追蹤有待處理事件或近期派送任務的角色；掛機目標檔改為讀一次並於正式命令更新時失效。
- 所有遊戲頁與背景分頁的週期狀態請求改走 live 精簡投影，不執行新手任務、伊甸園、二轉任務、據點與 ownership 的完整資料庫組裝；首次進入遊戲、切換功能頁及玩家操作完成後才讀完整狀態。
- 1,000 人全在其他遊戲頁的模型：狀態檔寫入由每秒約 6,667 次降為 500 次，事件請求由每秒約 3,333 次降為 400 次；1,000 個背景分頁的事件與精簡狀態請求分別為每秒 200 次與約 33 次。1,000 人停留掛機頁時，原先每秒 200 次完整資料庫狀態組裝降為穩態 0 次，仍保留每秒 200 次 live 精簡狀態更新。
- `npm run test:monitoring-efficiency`、`npm run test:realtime`、`npm run test:login-ui`、`npm run test:active-web-entrypoint`、四項 JavaScript 語法檢查與差異格式檢查通過。測試涵蓋 500／1,000 人投影、任務 watcher 事件限定與 lease 到期回收；登入、創角與選角頁的遊戲資產請求為 0。
- 重啟前版本的完整 `/api/state` 延遲測試未通過，30 次請求平均 1,475.1ms；本輪已將週期請求移出完整資料庫組裝路徑。新精簡路徑仍需在安全時段載入後重新執行延遲與多人壓測。
- 本輪未重啟 Dashboard、rAthena 或在線角色程序，執行中服務仍使用重啟前版本。

## 2026-09-14 Phase 4 外部 1000 SSE Viewer 驗證

- 建立 10-process production-like viewer harness；每個 viewer 各自執行 TLS、snapshot、revision、SSE、eventId/order、reconnect、hidden/foreground 與 close。
- 獨立 named Cloudflare Tunnel 經完整外部路徑完成 100、300、500、750、1,000 viewers。1,000 combat foreground 為 p50/p95/p99 139/147/248ms，event-loop p95/p99/max 26.43/31.54/45.48ms，RSS peak 263.8MB，origin peak 1,001 sockets，0 error、0 gap、0 duplicate。
- 1,000 reconnect 全數恢復；分批 hidden → foreground 全數恢復；5 個刻意 slow viewers 均被 64 KiB queue gate 要求 resnapshot，正常 viewers 未受拖累；單角色第 9 viewer 正確拒絕。
- 最終封存時正式 `play.g8land.com` direct canary 為 p50/p95/p99 141/143/143ms；390×844 UI 三次均通過，p95 分別為 148/143/147ms、resume 最大 627.4ms、polling request 0、application error 0，未觀察到真人 Web 體驗退化。
- rAthena、production Dashboard、OpenKore 均未重啟。DB 沒有 query storm，connection pool 維持 deferred。完整證據位於 `.local/ro-stack/evidence/PHASE4_1000_SSE_CANONICAL`。

## 2026-09-24 M1 World Map 傳送音效來源候選

- 使用者定案的原始 Client WAV 為 A `ef_readyportal.wav`、B `ef_portal.wav`、C `warp.wav`、D `ef_teleportation.wav`；來源與 hash 記於 `docs/ro-original-ui/ro-warp-portal-teleport-audio-provenance.md`。
- World Map 過場來源接入既有 Dashboard preflight、權威到達與 Web 音訊系統；取消或拒絕不播放 C/D，到達與 D 完成都成立後才揭露目的地並恢復 BGM。蒼蠅翅膀音效僅在權威成功位移時觸發，物品不消耗規則未更動。
- 此為 source candidate。Production 未部署、runtime 未重啟；桌面與 390×844 Player Browser 聲音及視覺驗收仍待受控部署後執行。

## 2026-09-24 M1 部署前閘門 V3

- 五個 Native 忽略的舊 Supply 設定已從 Web 的 `SUPPORTED` 能力宣告移除；它們依 `c0450b1c` 歸為 M1 排除或明確產品覆寫，並保持停用。AUTO_FARM 未追蹤測試的隔離角色可啟動預期已更正，來源測試通過。
- 目前 Production map binary 缺少可連到 canonical Native checkpoint 的部署收據；ProcDump 雖有對應 sidecar，map 的 debugger 查核為未附掛，正式 attachment 收據仍是 `FAILED`。因此受控部署、Fly／Supply 實機閉環與 Browser 驗收均延期，Production 和 runtime 未更動。詳見 `docs/openkore-reference/m1-predeploy-gate-v3-2026-09-24.md`。

## 2026-09-26 M1 V15 Native Kafra 修訂與待完成驗收

- 同一份 F first-promotion lease 已完成精確 Native `4cc2744 → f7e4097` 修訂，來源只有八個 Kafra Save 相關檔案。Release x64、13 組 canonical offline tests 與獨立 Kafra catalog tests 通過。Production 受控替換後 login/char/map/Dashboard 各一個 listener，DB healthy，ProcDump attached，OpenKore 0，quarantine 0；Web 尚維持 `055d3427`。證據與二進位雜湊見 `docs/project-control/m1-v15-kafra-native-f7-admission.md`。
- 目前 Production Player World Map 只提供 7 個 town rows，Morocc 與指定 field hub 缺席。f7 Native 的 Kafra Player live acceptance 需等待已整合 27 town nodes 的最終 Web 來源在 Settings 與原始 hunting-label Native 阻擋點關閉後受控部署。未把 Admin/原始 Native 指令算作 Player PASS。
- Settings source contract 共 46 欄、9 節；17 欄有來源執行映射可編輯，20 欄待支援及 5 欄未開放均停用，3 欄固定唯讀，1 欄隱藏。`SETTINGS_SOURCE_CONTRACT_GATE=PASS`；Production Browser 儲存／重載及 Supply/Store/Sell 設定效果仍未驗收。詳見 `docs/project-control/m1-v15-settings-and-capability-recalculation.md`。
- 40 項當前 M1 必要能力逐項重算為 4 PASS、36 PARTIAL、0 MISSING、0 UNCLASSIFIED；每個 PARTIAL 的第一個缺少驗收點見 `docs/project-control/m1-v15-capability-reconciliation-2026-09-26.md`。原始 hunting-label 盤點尚有 5 個 Native-owned 不可接受阻擋點。`CAPABILITY_FINAL_GATE` 與最終 Web/Browser/音效個人聆聽/Promotion receipt 仍為 BLOCKED 或 NOT_MEASURED。
