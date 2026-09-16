# RO 自動掛機版產品鐵律

## 第一性原理優先

### 目的與適用範圍

本規範適用於架構、功能、測試、除錯、整合與生命週期決策。每次工作先定義真正不可替代的領域目標，再選擇實作方式，並以可重現的玩家流程與來源證據驗證。

### 責任分層

| 層 | 核心責任 | 判定依據 |
| --- | --- | --- |
| `Server Authority` | 裁定角色、世界、任務、物品、地圖、NPC、冷卻、擁有權與生命週期 | rAthena、MariaDB 與既有權威流程 |
| `Controller` | 提出、排程與執行合法意圖 | Native Client、`SERVER_AGENT`、OpenKore 或其他受限 controller |
| `Transport` | 傳遞意圖、回應與事件 | packet、命令、檔案、API 或內部 continuation |
| `Presentation / UI` | 顯示權威狀態並收集玩家輸入 | Dashboard、Native Client UI 或其他呈現層 |
| `Historical implementation` | 提供來源、相容性與差異稽核 | 舊版腳本、舊 client flow、舊 packet 或封存介面 |

歷史實作、既有 Client、OpenKore、packet、UI、`status.json`、`.cmd` 與 `.result` 均先列為可替換依賴。遊戲規則必須回到 Server Authority 與不可破壞的 invariant 定義。

### 固定思考流程

#### STEP 1：DEFINE THE REAL GOAL

先寫出領域結果與完成條件。例：目標是「讓角色完成合法隨機傳送」，再檢查各種控制器如何提出意圖。

#### STEP 2：IDENTIFY AUTHORITY

定位真正裁定結果的來源。蒼蠅翅膀的隨機傳送、地圖生命週期、物品扣除與限制由 rAthena authority 裁定。

#### STEP 3：IDENTIFY ACCIDENTAL DEPENDENCIES

逐項檢查 Client ACK、packet、OpenKore process、UI window、`status.json`、`.cmd` 與 `.result`。只有在它們承擔不可替代的領域規則時，才列為必要依賴；其餘依賴應降為 transport、controller 或 presentation 選項。

#### STEP 4：PRESERVE INVARIANTS

至少保留 ownership、execution epoch、inventory authority、map lifecycle、NPC script state、cooldown、distance 與 quest authority。任何縮短流程的方案都先驗證這些 invariant。

#### STEP 5：CHOOSE THE SHORTEST REALISTIC TEST

先設計符合真實玩家行為的最短可重現流程，再使用隔離 fixture 或 diagnostic test 定位底層問題。測試分類與證據標籤沿用 [Player-flow First Acceptance Policy](testing-fixture-policy.md)。

#### STEP 6：ONLY THEN IMPLEMENT

完成目標、authority、依賴與 invariant 審查後，才選擇最小實作範圍與回歸閘門。

### OpenKore Exit 範例

錯誤決策會從「OpenKore 原本怎麼做」開始，將整個流程複製到 Persistent Agent。第一性原理流程先定位 OpenKore 為 Controller，rAthena 為 Server Authority。Native Client 與 `SERVER_AGENT` 可以使用不同 Controller，共用同一套 Server Authority；Controller 只需提交合法意圖並接收權威結果。

### Fly Wing 範例

歷史路徑可能包含 item use、client skill、client response 與 random warp。真正不可替代的結果是 rAthena 裁定 random warp、map lifecycle、item validation、消耗時機與地圖限制。`SERVER_AGENT` 可驗證 intent，再以 server-side continuation 接入同一套 rAthena authority。執行時保留 item validation、map lifecycle 與實際座標結果，禁止跳過驗證、直接改座標、使用 `@warp` 或自製 teleport。

### NPC 範例

歷史 UI 路徑可呈現為點 NPC、顯示選單、玩家選項、packet 與 script resume。第一性原理模型是角色合法 TALK NPC、NPC script 進入 `WAIT`、Controller 提供 response、server script continuation 產生結果。Native Client 與 `SERVER_AGENT` 只是 response provider，NPC script state 與 quest mutation 仍由 Server Authority 裁定。

### 與 Player-flow First 的關係

第一性原理決定真正要驗證的結果、authority 與 invariant。Player-flow First 決定以玩家實際會採取的行為鏈驗證該結果。前者負責定義測試目標，後者負責證明玩家可完成流程；兩者必須同時成立。測試類型、fixture 邊界與結果標籤依 [testing-fixture-policy.md](testing-fixture-policy.md) 執行，OpenKore 退出狀態依 [openkore-exit-source-of-truth.md](openkore-exit-source-of-truth.md) 判定。

### 第一性原理的使用邊界

第一性原理流程不得用來：

- 跳過 Server validation。
- 任意改寫 DB。
- 破壞既有遊戲規則。
- 為了簡化而重寫全部系統。
- 無視相容性需求。
- 取代來源與 runtime 實證。

目標是移除非必要假設，同時保留必要 invariant、相容性與實證門檻。

### FIRST_PRINCIPLES_REVIEW

大型架構或跨層變更開始前，先填寫：

```text
FIRST_PRINCIPLES_REVIEW

REAL_GOAL:
AUTHORITY:
NON_NEGOTIABLE_INVARIANTS:
HISTORICAL_ASSUMPTIONS:
REMOVABLE_DEPENDENCIES:
PLAYER_FLOW:
MINIMAL_POC:
PASS_EVIDENCE:
STOP_CONDITIONS:
```

## 原廠命令優先

開發角色操作前，先依 [RO_COMMAND_REUSE_POLICY.md](RO_COMMAND_REUSE_POLICY.md) 與 `.agents/skills/ro-command-bridge` 查核 rAthena 與 OpenKore 內建指令、設定、任務、NPC、傳送與封包。玩家行為優先透過 OpenKore 指令交由 rAthena 驗證，NPC 與任務優先採用 rAthena 腳本命令。網頁層不得接受原始命令字串。

## Renewal 現行版本優先

- 每個功能開始前先列出鎖定版 rAthena 中並存的 Renewal、Pre-Renewal、停用及歷史實作，再以目前載入設定判定現行版本。
- `npc/re`、Renewal 資料庫、已啟用的 `scripts_*.conf`、角色出生設定與對應原始碼構成現行基準。
- 新版已啟用時直接採用新版入口、任務、地圖、NPC、交通、獎勵與資料；舊版只保留為歷史稽核資料。
- 兩個現行方案都可用且選擇會改變養成、經濟、路線、獎勵或玩家預期時，開發暫停並交由使用者裁定。
- 一轉永久回歸案例：`conf/char_athena.conf` 的 Renewal 出生點是 `iz_int`；`npc/re/jobs/novice/academy.txt` 是 Criatura Academy 現行流程；`npc/re/jobs/novice/novice.txt` 已註記舊 `new_1-1` 教學於 2012 年被取代。任何重新接回舊訓練場或六個舊公會長途流程的變更都不得通過驗收。

## 原廠介面與聲音

- 基本訊息視窗依照經典 RO 版面，不加入角色頭像格。
- 登入畫面使用 `BGM/01.mp3`，普隆德拉使用 `BGM/08.mp3`，`prt_fild08` 使用 `BGM/12.mp3`。
- 所有後續地圖 BGM 依 `docs/RO_CLASSIC_BGM_MAP.md` 的已核實編號接入；禁止依印象或地圖名稱猜測曲目。
- 音樂依登入狀態與地圖切換。介面不顯示瀏覽器自動播放技術提示。
- 預設背景音樂 20%，預設音效 35%。
- 戰鬥音效只由真實攻擊、受傷與擊倒事件觸發。
- 能力配點於掛機中保持可用，支援長按連續配點與全部重置。

## 產品定義

本遊戲以固定版 rAthena Renewal 建立 RO 世界規則，以固定版 OpenKore 建立角色自動化行為。玩家不直接控制角色移動與攻擊；戰鬥、尋路、傳送、死亡與拾取只透過小地圖、角色狀態及小黑窗呈現。

省略範圍只包含角色、怪物、技能、場景的即時美術與動作演出。角色養成、能力值、Base/Job 等級、技能、職業、裝備、卡片、消耗品、重量、Zeny、NPC、商店、精煉、倉庫、傳送、隊伍、交易、怪物、掉落、重生及 MVP 規則都必須保留。

任何新增功能都先回答：原始 RO 中由哪一項資料、公式、NPC或介面承擔？OpenKore如何自動執行，玩家又需要做哪項養成決策？查無來源時標記 `【資料不足，無法確認】`，停止建立虛構規則。

## 操作責任分界

### 系統自動執行

- 按唯一 `lockMap` 目的地跨圖尋路。
- 逐格移動、索敵、普攻、技能、受傷、死亡、重生及返回掛圖。
- 依玩家設定使用蒼蠅翅膀、蝴蝶翅膀、補品及坐下恢復。
- 逐件生成掉落，走到地面物品座標後拾取。
- 依怪物個別政策避開其他玩家目標、危險怪及 MVP。
- 與指定 NPC 的移動及抵達判定。
- MapRoute 依玩家的真實 Zeny、卡普拉券、傳送技能與物品選擇可用的原廠交通服務。

### 玩家親自決定

- 掛機地圖、攻擊怪物、技能及生存策略。
- 能力點、技能點、職業與轉職方向。
- 裝備穿脫、卡片、道具使用及快捷策略。
- 買賣、倉庫、精煉、交易、組隊及NPC選項。
- 是否攻擊 MVP、是否消耗傳送及補給道具。

玩家選擇養成操作時，角色先停止目前掛機工作。需要 NPC 的服務必須在共享世界中完成實際路程，抵達 NPC 互動範圍後才開啟對話與功能視窗。

玩家角色的等級、技能點、Zeny、裝備與物品必須由養成取得。專用測試角色可由伺服器端準備必要強度與資源，但必須持久標記並排除所有公開排名、社交探索與投資展示資料，詳見 `docs/RO_TEST_ACCOUNT_POLICY.md`。

## 介面準則

RO 原廠介面是結構、像素、控制方式與資訊層級的基準。已取得使用授權且官方客戶端具有對應素材時，網頁版直接使用該素材；只允許透明背景、網頁格式及必要縮放轉換。官方素材缺件時顯示待補狀態，不得以自創控制或錯誤素材冒充。細則見 `docs/RO_OFFICIAL_UI_ASSET_POLICY.md`。

### 永久角色資訊

- 角色名稱、職業、Base Level、Job Level。
- HP、SP、負重及 Zeny。
- Base EXP與Job EXP進度。
- 當前地圖、座標及掛機狀態。
- 基本訊息視窗下方常駐 RO 對話欄，切換能力、技能、裝備、道具、地圖情報與系統頁時保持可見。

### 對話與社交

- 一般頻道使用 OpenKore `sendChat()`，由 rAthena 驗證並依原廠附近範圍回送；伺服器回送前不在介面顯示成功訊息。
- RO 表情使用 OpenKore `sendEmotion(ID)`，編號以鎖定版 `tables/emotions.txt` 為準；rAthena 保留基本技能 Lv.2 與每秒一次限制。
- 玩家文字只作為聊天封包內容，不進入 OpenKore 命令解析器。介面只接受固定頻道、80 字內單行文字與白名單表情。
- 對話欄提供全部、一般、密語、隊伍、公會、家族、戰場、地圖、全服、交易、支援、同盟及系統檢視。系統訊息維持唯讀，群組頻道由 rAthena 驗證成員資格。
- 密語、隊伍、公會、家族、戰場、同盟及聊天房依 OpenKore 與 rAthena 原始頻道逐項接入；尚未具備成員資格時保留頻道頁並顯示伺服器拒絕，完成有資格雙向收發後才列為完成。
- 語音訊息明確標示為網頁擴充功能。第一階段限一般頻道同地圖在線玩家，採登入保護同源播放、30 秒、1 MB 與三秒限流；公開測試前補齊檢舉、封鎖、保存與刪除規則。

### 能力值視窗

- STR、AGI、VIT、INT、DEX、LUK。
- 基礎值、職業或裝備加成、剩餘 Status Point。
- ATK、MATK、DEF、MDEF、HIT、FLEE、CRITICAL、ASPD。
- 所有衍生數值使用即時角色狀態計算，裝備、能力點或狀態改變後立即更新。

### 裝備與道具視窗

- 裝備部位與固定版 RO 資料一致。
- 顯示物品名稱、精煉值、洞數、卡片、需求等級及職業限制。
- 穿脫後立即重新計算角色狀態。
- 道具依 RO 物品類別分頁，顯示數量、重量、鑑定及可用狀態。
- 雙擊或操作選單使用道具；結果由世界服務驗證。
- 負重與無法拾取、使用、交易或存倉限制依物品資料執行。

### OpenKore設定

- 掛機地圖與座標。
- 一般攻擊、攻擊技能、輔助技能及連段條件。
- 怪物個別攻擊、忽略及傳送政策。
- HP/SP、補品、坐下與逃生條件。
- 拾取、重量、買賣、倉庫及補給條件。
- 戰利品販售清單、回城條件、補給 NPC、購買數量、倉庫存取與補給後返回掛圖。
- 蒼蠅翅膀、蝴蝶翅膀與路線策略。
- MVP預設關閉攻擊；玩家主動開啟後才列入目標。

## 小地圖與小黑窗

- 小地圖顯示真實地形、迷霧、玩家、其他玩家、怪物、NPC、傳送點與逐格移動。
- 不在小地圖顯示地面掉落圖示，避免遮蔽交戰資訊。
- 小黑窗只消費世界服務產生的路線、移動、索敵、技能、命中、Miss、傷害、死亡、EXP、掉落、拾取、道具、NPC及系統事件。
- UI不能自行生成戰鬥文字，也不能用動畫結算取代逐擊模擬。
- 同圖玩家與怪物共用同一份權威座標、HP、死亡與掉落資料。

## NPC服務共同流程

```text
停止掛機
→ 玩家選擇NPC服務
→ 檢查所在位置、道具與地圖限制
→ 必要時使用蝴蝶翅膀回儲存點
→ 依真實資源優先使用卡普拉、傳送之陣、交通 NPC 或其他原廠傳送
→ 無可用傳送時採安全步行路徑
→ 逐格走到NPC
→ 抵達互動範圍
→ 開啟原始NPC對話流程
→ 玩家選擇服務
→ 開啟功能視窗
→ 伺服器驗證並寫入結果
→ 玩家自行決定是否返回掛機
```

不得從野外直接開啟精煉、卡普拉、商店、轉職或其他必須由NPC提供的服務。

## 初心者一轉

- 新角色使用 Renewal 官方出生點 `iz_int (18,26)`，由 OpenKore 自動執行沉船、初戰、抵達伊斯魯德、學院報到、基礎訓練及結業流程。
- 玩家在創角時選擇一轉志願；選擇只鎖定養成方向，角色仍以初心者進入 Renewal 新生任務。
- 開放條件固定為初心者 Job Lv.10 且基本技能 Lv.9。
- 系統不得依能力值或裝備改寫玩家志願。
- 完成新生任務後由 OpenKore 進入 Criatura Academy 結業流程，職業變更前角色與世界持續在線。
- NPC 對話、下一步、選項、職業變更與贈品均取自 rAthena 真實流程，玩家介面不得直接改寫職業資料。
- 新生任務發放的職業武器、學院帽及弓箭手箭矢由該任務腳本立即穿戴；此規則只套用新生任務，後續裝備由玩家自行決定。
- 任務頁以 OpenKore 任務目標、NPC 對話、路由事件與角色經驗封包顯示非戰鬥行動紀錄；逐次攻擊內容只留在戰鬥終端。
- 任務尋路收到 OpenKore `route: stuck` 時，先移至鄰近可行走格，再由目前任務階段重新建立路線。
- 未結業初心者離開新手區、重連、死亡回錯誤儲存點或 OpenKore 中斷時，任務頁必須依 rAthena 任務紀錄提供恢復。回程階段只能由伺服器裁定，不得在前端伪造進度。
- 恢復傳送只限未結業初心者；已一轉或 `terminal_academy_graduated=1` 時必須拒絕。恢復動作不發放道具、EXP、Zeny 或任務獎勵。
- 完成一轉並離開新手區後，OpenKore 先自動前往 `prt_fild08` 並開始掛機，避免流程停在無操作入口的狀態。任務頁與掛機頁後續提供依角色等級排序的推薦地圖及單一 `lockMap` 選擇。
- 十種一轉職業座標、來源及驗收詳見 `docs/RO_FIRST_JOB_CHANGE_PLAN.md`。

## 忽克連與精煉

固定版 rAthena 證據：

- `npc/merchants/refine.txt`
- `conf/battle/feature.conf` 的 `feature.refineui: on`
- 普隆德拉忽克連位於 `prt_in,63,60`
- 對話結束後呼叫 `refineui()`
- 精煉請求由伺服器檢查視窗狀態、裝備、材料、Zeny、精煉等級及成功結果

玩家流程：

1. 停止掛機。
2. 從道具欄使用永久蝴蝶翅膀並返回已記錄儲存點，道具數量維持不變。
3. MapRoute計算到 `prt_in (63,60)` 的跨圖與室內路線。
4. 小地圖逐格顯示移動，小黑窗顯示傳送、路線與抵達。
5. 抵達後顯示忽克連對話框。
6. 對話完成後同時開啟精煉視窗與可精煉裝備清單。
7. 玩家選擇裝備與材料，介面顯示目前精煉值、材料、費用及來源可確認的機率。
8. 伺服器一次性扣除材料與Zeny並決定成功、失敗、破壞或其他結果。

twRO官方流程也確認：與城鎮精煉師交談後開啟精煉介面，從背包拖曳或雙擊裝備，介面依材料顯示機率。

## 卡普拉與倉庫

固定版 rAthena 的卡普拉各自具有座標及服務參數。以普隆德拉為例，`npc/kafras/kafras.txt` 定義多位卡普拉及各自儲存點。

- 角色必須走到指定卡普拉。
- 先顯示該NPC腳本提供的對話與選單。
- 儲存位置、倉庫、傳送、手推車及其他服務依該NPC實際參數顯示。
- 開倉前驗證費用、密碼及狀態限制。
- 倉庫物品與角色背包由伺服器進行原子移轉。
- 關閉NPC服務後不自動恢復掛機，交由玩家確認。

同一模式適用於商店、旅館、轉職、技能學習、修理、鑑定及其他NPC服務。

## 開發驗收鐵律

每項功能必須通過來源追蹤、無介面規則測試、自動移動與NPC抵達測試、UI流程測試、暫停斷線重試測試、多人一致性測試及加速壓力測試。任何只有外觀、沒有真實世界流程的功能均不能標記完成。

## 玩家介面安全鐵律

- 玩家端永遠視為不受信任，只能接收角色可見資料與送出固定白名單操作。
- 玩家端不能輸入或轉送原始 OpenKore 命令、rAthena 管理指令、封包、SQL、程式碼、其他角色 ID 或任意 action。
- 所有效果由 Session 所屬角色的 OpenKore／rAthena 權威驗證；前端顯示及按鈕狀態不構成授權。
- 玩家 API 不揭露資料庫、內部服務、來源 IP、連接埠、程序、檔案路徑、錯誤堆疊與管理端點。
- 正式入口採 HTTPS 反向代理或 outbound-only tunnel，來源遊戲服務只監聽本機或私有網路。
- 詳細威脅邊界與驗收清單固定記錄於 `docs/PLAYER_INTERFACE_SECURITY_BOUNDARY.md`。

## 台灣繁中顯示鐵律

- 玩家可見的地圖、怪物、物品、職業、技能、屬性、LOG、設定與功能視窗以台灣繁體中文顯示。
- rAthena Aegis 名稱、地圖代碼與內部 ID 保留在資料層，不能直接取代玩家名稱。
- 繁中名稱需對應可追溯的 twRO 資料。查無資料時顯示「未校正名稱」與原始 ID，禁止自行翻譯成正式名稱。
- 小地圖地形與所有角色標記必須採用相同座標轉換；不可行走格不能出現角色或怪物。
- 地圖選擇需顯示繁中地圖名及目前載入怪物等級；地圖情報需列出怪物等級、HP、攻防、種族、體型、屬性、經驗與逐項掉落率。

## 視覺與流程參考

- 使用者提供精煉影片：https://www.youtube.com/watch?v=Qs6sOOcKfUw
- twRO官方精煉說明：https://ro.gnjoy.com.tw/notice/guide_view.aspx?id=216542
- rAthena忽克連腳本：https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/npc/merchants/refine.txt
- rAthena卡普拉腳本：https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/npc/kafras/kafras.txt
- RO傳統介面導覽：https://steamcommunity.com/sharedfiles/filedetails/?id=190870754
- RO官方角色與裝備介面範例：https://ragnarokonline.gungho.jp/campaign_event/campaign/baselv220cp-2.html
- twRO地圖與繁中名稱資料：https://ragnaplace.com/zh-t/twro/map/prt_fild08
- twRO波利與掉落繁中名稱：https://ragnaplace.com/zh-t/twro/mob/1002

影片內容目前無法由研究工具擷取，暫不把未核實的影片細節寫成規則。


## Execution Budget / No-Progress Circuit Breaker

### 目的

補充現有 FIRST PRINCIPLES、PLAYER-FLOW、ROUTING FIRST 與 CONTEXT BUDGET 治理框架中尚缺的一個維度：

即使 Agent 已在正確 worktree、搜尋範圍也正確，仍必須有明確的停止條件，防止無進展的重複搜尋、無限推理與非法捷徑。

### 治理概念對照

| 概念 | 定義 | 完整文件 |
| --- | --- | --- |
| FIRST PRINCIPLES | WHAT actually matters | [第一性原理優先](#第一性原理優先) |
| PLAYER-FLOW | HOW the feature is accepted | [testing-fixture-policy.md](testing-fixture-policy.md) |
| ROUTING | WHERE the Agent works | [Routing First 鐵律 in AGENTS.md](../AGENTS.md) |
| CONTEXT BUDGET | HOW MUCH the Agent may inspect | [Context Budget / Routing Report 鐵律](#context-budget--routing-report-鐵律) |
| EXECUTION BUDGET | HOW LONG / HOW MANY attempts | 本節 |
| CIRCUIT BREAKER | WHEN the Agent must stop | 本節 |

### 硬限制

#### MAX_EQUIVALENT_DISCOVERY_ATTEMPTS = 3

對同一目的（找同一 symbol、source file、invocation path、config，或重複近似的 grep / glob），最多執行 3 次等價嘗試。

第 3 次仍無 materially new evidence：

```
DISCOVERY_STALLED → STOP
```

不得執行第 4 次等價搜尋。

#### NO_NEW_EVIDENCE_LIMIT = 5 分鐘

針對同一 blocker，連續 5 分鐘未取得新的實質證據（未新增 exact file/line、caller/callee、runtime state、reproducible result、failing boundary 或 provenance evidence），必須停止。

禁止以「再想一下」、「再找一下」、「再 grep 一次」延長工作。

#### MAX_BLOCKER_INVESTIGATION_TIME = 15 分鐘

單一 blocker / hypothesis 的調查上限。到達上限後必須回報以下之一：

- `ROOT_CAUSE_CONFIRMED`
- `NEEDS_MODEL_ESCALATION`
- `NEEDS_PROJECT_CONTROL_DECISION`
- `INSUFFICIENT_EVIDENCE`

不得自行無限延長調查。

#### MAX_DISCOVERY_TOOL_CALLS_PER_BLOCKER = 10

只計算 discovery 類工具呼叫：grep、glob、find、用於定位的 read、git archaeology、directory enumeration。

達到 10 次時必須 checkpoint：

```
NEW_EVIDENCE_FOUND: YES / NO
```

若 NO → STOP。
若 YES → 必須明確說明 `NEW_EVIDENCE: <what changed the hypothesis>` 才能繼續。

### Search Loop Self-Detection

若 Agent 對同一目標連續三次出現本質相同的意圖（如「I need to find...」、「Let me locate...」、「I need to search...」）：

```
SEARCH_LOOP_DETECTED = YES → 立即停止該 discovery 路線
```

優先重用已取得的最佳 evidence，禁止換關鍵字重複搜尋同一件事。

### Silent / Opaque Work Circuit Breaker

若 `NO_OBSERVABLE_PROGRESS >= 5 分鐘`，且並非正在執行有明確 timeout 的 build、test 或 server readiness wait：

```
STOP / CHECKPOINT
```

所有合法長命令必須有 bounded timeout。禁止黑箱「thinking」數十分鐘。

### Invalid Acceptance Shortcut

若 Agent 發現自己打算「直接修改正在被驗證的結果以繞過正式 runtime path」，必須立即 STOP，並依既有 [Player-flow / Fixture Policy](testing-fixture-policy.md) 判斷，回報：

```
INVALID_ACCEPTANCE_SHORTCUT_PROPOSED = YES
```

例如：驗證 claim_agent 時，不得直接寫 ownership state 來宣告 PASS。允許與禁止內容以既有 Fixture Policy 為準。

### Model Escalation（平台無關）

永久治理規則中禁止寫死特定模型名稱。一律使用：

```
MODEL_ESCALATION_RECOMMENDED = YES
```

典型觸發條件：lifecycle ambiguity、race / ownership、cross-subsystem state corruption、server authority boundary 不清、continuation architecture 未解、Execution Budget 已耗盡仍無 root cause。

由 Project Control 決定當下升級哪個模型。

### EXECUTION_REPORT 模板

所有較複雜 repo / runtime 任務在 CONTEXT_REPORT 後附加：

```
【EXECUTION_REPORT】

BLOCKERS_ENCOUNTERED:

MAX_EQUIVALENT_DISCOVERY_ATTEMPTS_USED:

DISCOVERY_TOOL_CALL_COUNT:

LONGEST_BLOCKER_MINUTES:

NO_NEW_EVIDENCE_TRIGGERED:
YES / NO

SEARCH_LOOP_DETECTED:
YES / NO

INVALID_ACCEPTANCE_SHORTCUT_PROPOSED:
YES / NO

MODEL_ESCALATION_RECOMMENDED:
YES / NO

BOUNDED_TIMEOUT_VIOLATION:
YES / NO

EXECUTION_BUDGET_VIOLATION:
YES / NO
```

若全部 NO，不需要額外長篇解釋。

### 事故範例（Anonymized）

**BAD:**
same SERVER_AGENT source discovery → repeated equivalent searches → no material new evidence → ~52 minutes → attempted acceptance shortcut

**EXPECTED:**
third equivalent search without new evidence → `DISCOVERY_STALLED` → STOP → return evidence to Project Control

## Context Budget / Routing Report 鐵律

### 目的

防止 Agent 在大型 project root 或 sibling worktrees 做無界搜尋，避免 token / context 暴增、provider request 過大、model 次數快速消耗、Source of Truth 混亂與誤用錯誤 worktree / branch。

### 任務開頭固定格式

所有 repo 任務開頭必須聲明：

```
WORKLINE:
WORKSPACE:
EXPECTED_BRANCH:
EXPECTED_HEAD_OR_PARENT:
SOURCE_OF_TRUTH:
TASK_TYPE:
```

Agent 必須驗證並回報：

```
WORKSPACE_ROOT:
BRANCH:
HEAD:
ROUTING_MATCH: YES / NO
```

若 ROUTING_MATCH=NO：STOP → 回報 ROUTING_STALE，不得自行全域搜尋替代 worktree。

### 搜尋範圍硬規則

1. routing 完成後，grep / glob / read / git 預設只能在 ACTIVE_WORKTREE 內。
2. 禁止從 C:\ 全域搜尋。
3. 禁止從 project root 無界 grep。
4. 禁止掃 sibling .tmp-* worktrees。
5. 禁止 Get-ChildItem -Recurse 全專案。
6. 禁止 glob **/* 全專案。
7. 禁止大量無限制 Get-Content。
   例外：任務明確授權 cross-worktree provenance lookup，且必須先聲明 WHY_CROSS_WORKTREE_SEARCH_REQUIRED。

一個任務預設最多：1 個 ACTIVE_WORKTREE + 少量明確 Source of Truth 文件。

### 異常門檻

以下任一條件觸發時，Agent 必須解釋原因，不得默默繼續擴張；若非任務必要，STOP / 收斂搜尋範圍：

- TOP_LEVEL_SEARCH_PATH_COUNT > 3
- CROSS_WORKTREE_SEARCH_PERFORMED = YES
- PROJECT_ROOT_SEARCH_PERFORMED = YES
- UNBOUNDED_RECURSIVE_SEARCH_PERFORMED = YES

### Bounded Tool Rule

推薦固定模式：

- read exact file/range
- grep exact pattern
- Select-Object -First N
- git diff --stat
- git diff --name-only
- git status --porcelain --untracked-files=no

所有可能卡住的 shell 命令必須設 bounded timeout。禁止無限等待。

### Conversation Budget

一個 Kilo 對話只處理一個 atomic goal。以下情況觸發 HANDOFF → NEW CONVERSATION：

- milestone 完成
- blocker 已定位
- commit 完成
- context 明顯膨脹
- provider 出現 context/channel/400 類問題

禁止同一對話長期混入：Git archaeology、UI、PA、NPC、Dashboard、deployment、不同 workline。

### 固定 CONTEXT_REPORT 模板

所有 repo 任務最後必須回報：

```
【CONTEXT_REPORT】

WORKLINE:
WORKSPACE_ROOT:
BRANCH:
HEAD:
WORKSPACE_ROUTING_MATCH:

INDEXED_SEARCHED_PATHS:
TOP_LEVEL_SEARCH_PATH_COUNT:

CROSS_WORKTREE_SEARCH_PERFORMED:
PROJECT_ROOT_SEARCH_PERFORMED:
C_DRIVE_SEARCH_PERFORMED:
UNBOUNDED_RECURSIVE_SEARCH_PERFORMED:
LARGE_OUTPUT_COMMAND_USED:

SOURCE_OF_TRUTH_FILES_READ:

CONTEXT_BUDGET_VIOLATION:
YES / NO

If YES:
WHY:
MITIGATION:
```
