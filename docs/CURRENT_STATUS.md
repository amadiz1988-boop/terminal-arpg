# 目前狀態

## 2026-09-13 管理後台固定外網入口與登入保護

- 固定 HTTPS 入口為 `https://admin.g8land.com`。獨立 Cloudflare Named Tunnel `g8land-admin` 只轉送至 loopback `127.0.0.1:8790`，不改動玩家入口或 rAthena、OpenKore、MariaDB。
- 所有管理頁、JavaScript 與 `/api/v1/*` 均要求管理員登入；未登入 API 回 `401 AUTH_REQUIRED`。登入密碼以 scrypt 雜湊保存，session cookie 使用 HMAC、HttpOnly、SameSite Strict，經 HTTPS 時加上 Secure，效期 12 小時。
- 登入失敗同時套用來源與全域十分鐘限流；回應包含 HSTS、CSP、no-referrer、noindex、Permissions-Policy 與 nosniff。憑證檔不保存明文密碼，Windows ACL 僅允許 Administrator 與 SYSTEM。
- 新增獨立 Ops Agent Tunnel 與 15 秒 watchdog；watchdog 只恢復 Ops Agent 及其 Tunnel，連續兩次健康檢查失敗才重啟 Ops Agent，不操作玩家 Dashboard 或遊戲服務。
- 公開 Integration 驗證通過：未登入首頁顯示登入頁、未登入 API 為 401、正確登入為 200、登入後 evidence API 為 200，八項服務全數 healthy。玩家公開 Dashboard 同時維持 HTTP 200。
- 角色 Runtime 已區分 `active`、`stopped`、`unknown`。歷史或已停止程序不再被 `STALE_HEARTBEAT` 誤列為警示；公開驗證結果為 51 筆角色紀錄、16 個執行中、35 個已停止、0 個需處理警示。
- 管理頁優先顯示角色名稱、白話原因與處理建議；帳號 ID、provider、lifecycle 與原始錯誤碼收進「進階資訊」。已停止紀錄預設隱藏，可由管理者手動展開。
- `OPS_AGENT_AUTH_PASS`、`OPS_AGENT_CONTRACT_PASS`、`OPS_AGENT_READONLY_PASS`、`OPS_AGENT_INCIDENTS_PASS` 與 390×844 `OPS_AGENT_MOBILE_UI_PASS` 全數通過。控制 API 仍保持關閉。

## 2026-09-13 Ops Agent 手機管理頁

- `http://127.0.0.1:8790/` 新增獨立管理頁，390×844 為主要版型。畫面顯示整體健康、8 類服務、角色 runtime、事故時間線與逐項 evidence。
- 管理頁只讀取版本化 Ops Agent API，不解析 OpenKore log、命令目錄或 Persistent Agent 內部格式。角色搜尋支援帳號 ID、角色 ID、地圖及 provider；異常角色優先排列。
- 所有互動均可用 tap 操作，主要按鈕及 evidence summary 觸控高度至少 44px。Chrome 以 390×844 驗證 8 個服務卡、角色卡、事故詳情、零水平 overflow、零前端 runtime error，結果為 `OPS_AGENT_MOBILE_UI_PASS`。
- Phase 2 本機與公開唯讀 Gate 已完成。Phase 3 安全控制仍待後續功能切片。

## 2026-09-13 Ops Agent Incident Snapshot

- 新增健康轉換監視器。服務從 healthy 轉為 degraded、unreachable、stopped、unknown，或角色出現 stale heartbeat／ownership conflict 時，會建立版本化 incident snapshot；恢復正常時也會保存結案快照，相同問題簽章維持不變時不重複寫入。
- Snapshot 以原子檔案寫入 `.local/ro-stack/ops-agent/incidents/`，最多保留 100 份及 30 天。`GET /api/v1/incidents` 提供摘要，`GET /api/v1/incidents/:id` 提供已遮罩詳情；路徑 ID 有 allowlist 驗證。
- 保存前先套用既有 `IncidentSnapshot` contract，再遮罩 Authorization、password、token、cookie、session、secret 與 DSN 密碼。Snapshot 不包含完整命令列、資料庫連線字串或原始聊天內容。
- Fixture 已覆蓋 Dashboard、Tunnel、MariaDB 與單一 OpenKore heartbeat 四類故障、重複狀態去重、敏感資料遮罩、保留上限、路徑穿越拒絕與唯讀 API。`OPS_AGENT_INCIDENTS_PASS`。
- 本切片仍無 start、stop、restart、kill、claim 或 release API。

## 2026-09-13 獨立唯讀 Ops Agent Phase 1

- 新增與玩家 Dashboard 分離的本機 Ops Agent，固定以 loopback `127.0.0.1:8790` 提供版本化唯讀 API：`/health`、`/api/v1/services`、`/api/v1/characters` 與 `/api/v1/evidence`。
- Windows Native Provider 讀取現行 stack config、受管 process state、listener、Dashboard local health、Cloudflare public health、MariaDB read-only query、rAthena service-link log marker、OpenKore heartbeat 與 MariaDB ownership authority。實際連接埠取自 `stack.config.psd1`。
- 每項網路、HTTP、程序與資料庫檢查都有 timeout；低權限無法取得程序資訊時回 `unknown`。API 固定移除秘密、完整路徑及命令列，POST、PUT、PATCH、DELETE 均回 `405 READ_ONLY`。
- `ops-agent-service.ps1` 只管理 Ops Agent 自身，不操作 Dashboard、Tunnel、MariaDB、rAthena、OpenKore 或角色 ownership。可用 `npm run ops:agent:start|health|stop` 管理本機程序。
- Component fixture 驗證全健康、Dashboard 停止、PID 證據不足、provider ownership、唯讀能力及 mutation rejection；真實唯讀冒煙測試成功回傳 8 個服務與 51 個具有 MariaDB ownership 結果的角色。冒煙測試發現 PowerShell Tunnel state 含 UTF-8 BOM，解析器加入 BOM regression 後公開入口查核回健康。
- Phase 1 與 Phase 2 已啟動常駐 Ops Agent、獨立管理 Tunnel 與 watchdog。沒有重啟玩家 Dashboard、rAthena、OpenKore 或 MariaDB，也沒有對正式角色或 MariaDB 寫入。控制按鈕仍未建立。

## 2026-09-13 地圖情報隨目前地圖更新

- 問題原因有兩項：地圖情報只在玩家點擊分頁時載入一次；查不到目前地圖時會回退顯示資料檔中的第一張地圖，造成跨圖後仍顯示南門情報。
- 事件輪詢取得新地圖後，地圖情報會同步切換標題、怪物種類、固定生成總量與怪物清單。缺少已查核資料時會顯示目前 map ID 與「無資料」，不再顯示其他地圖內容。
- `assets:map-info` 現依鎖定版 rAthena Renewal 實際啟用的 `npc/re/scripts_main.conf` import 鏈，為 53 張目前玩家流程地圖產生索引與獨立詳細檔。詳細檔只在玩家開啟地圖情報時按目前地圖載入。
- 實際資料確認 `moc_fild11` 為 4 種、318 隻，`pay_dun00` 為 7 種、125 隻；城鎮或沒有固定生成資料的地圖顯示 0 種、0 隻。
- 390×844 瀏覽器測試已驗證 `moc_fild11` 切換至 `pay_dun00` 後內容同步更新、兩張詳細檔分開請求、無水平溢出及瀏覽器例外為 0，結果為 `MAP_INFO_SYNC_PASS`。

## 2026-09-13 常駐 Pet Companion 原型

- 現行 `127.0.0.1:8788` Dashboard 已加入單一常駐 Pet Companion；切換能力、技能、裝備、道具、地圖情報、掛機與戰鬥終端時沿用同一 DOM 實體，不會隨 panel 重新建立。
- 第一版以可替換的 `🌱` 圖層代表妙蛙種子，不常駐顯示寵物名稱；目前狀態包含 idle、walk、run、pant、sleep 與 happy。
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
- 多帳號背景程序、固定公開入口與長時間公開運作仍待整合驗收。
- 穩定固定網域、斷線恢復、監控、備份與公開入口仍依公開發布閘門追蹤。

## 下一步

優先執行 [TODO.md](TODO.md) 的 P0、P1 項目，順序如下：

1. 保持這組接手文件與實際程式、測試、版本一致。
2. 完成固定公開入口、Tunnel 回復與長時間多人驗證。
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
