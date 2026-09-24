# M1 世界移動、補給與介面產品決策 V1

```text
WORKLINE_ID = M1_WORLD_TRAVEL_SUPPLY_UI_CANONICAL_FREEZE_V1
STATUS = CANONICAL / ACTIVE
AUTHORITY = PRODUCT_DECISION
SOURCE_EVIDENCE = docs/openkore-reference/m1-world-map-supply-cutover-source.md
CAPABILITY_EVIDENCE = docs/openkore-reference/m1-core-hunting-closure.md
IMPLEMENTATION_STATUS = SEPARATE_SOURCE_AND_LIVE_GATES
SUPERSEDED_BY = NONE
```

本文件是 M1 世界地圖移動、掛機地圖、主城、儲存主城、蝴蝶翅膀、補給、設定介面及最終玩家驗收的唯一產品決策。來源證據與歷史測試數字保留在上述文件；它們不會修改本規格。F 保留鎖定 OpenKore 來源比對，Native 補給與背包管理屬 canonical Native owner，Web 切圖前判定與設定屬 canonical Web owner。`SOURCE_PASS`、本機 Browser 檢查及 Production 玩家 Browser 驗收分別記錄，不互相替代。

## CANONICAL_DECISION_MATRIX

| 情境 | 費用 | 成功後冷卻 | 決策與權威 |
| --- | --- | --- | --- |
| FIELD → TOWN | 免費 | 無 | 可選任何已啟用主城；繞過既有世界傳送冷卻，且不寫入新冷卻 |
| TOWN → TOWN | 免費 | 30 秒 | 成功時由伺服器寫入 `WORLD_TELEPORT_AVAILABLE_AT = server_now + 30s` |
| TOWN → FIELD | Base Lv.66 以下免費；Lv.67 起為目的地 `FARM_MAP_MIN_LEVEL × 10` Zeny | 60 秒 | 須達目的地等級，由伺服器核定與寫入 |
| FIELD → FIELD | 同 TOWN → FIELD | 60 秒 | 直接傳送；玩家換掛機地圖不走跨圖 Navigation |
| SAME MAP | 免費 | 不變 | 回傳 `ALREADY_ON_TARGET_MAP`，顯示「已經在該地圖」；不傳送、不改座標、不重啟既有掛機 |
| 設定 Saved Town | 免費 | 不變 | 僅角色已在所選主城時，以 rAthena 儲存點權威設定 |
| 蝴蝶翅膀回有效 Saved Town | 免費 | 無 | `RETURN_TO_SAVED_TOWN`；繞過世界傳送冷卻 |
| Supply 城內移動 | 依原有商店交易 | 不屬世界傳送冷卻 | 沿用現有 Navigation 到商人或服務 NPC |

## 世界傳送與掛機地圖

玩家從世界地圖選目的掛機地圖後，流程為 `WORLD_MAP_SELECTION → VALIDATE → DIRECT_AUTHORITATIVE_TELEPORT → AUTHORITATIVE_ARRIVAL → FARM_DESTINATION_COMMIT → AUTO_FARM_START/RESUME`。若已在目的地，保持座標、Zeny、冷卻與進行中的掛機；閒置角色可直接開始掛機。玩家換掛機地圖的跨圖 Navigation 規格為 `SUPERSEDED`。

Browser 僅提交意圖。伺服器權威決定當前與目的地圖、角色 Base Lv、目的地最低等級、Zeny、費用、冷卻資格、安全落點與最終成功。以單一角色權威欄位 `WORLD_TELEPORT_AVAILABLE_AT` 或已存在的等價欄位管理冷卻；Browser 時鐘與報價只供呈現。失敗交易不扣 Zeny、不啟動冷卻；同圖亦不寫冷卻。伺服器須以權威到達結果核定掛機目標與啟動。

`FARM_MAP_MIN_LEVEL` 取目的地所有**有效一般掛機怪物**的最低 Base Level，排除資源怪、資源植物及非掛機實體。沿用單一 canonical 資源怪分類；UI 不另造分類器。門檻是 `PLAYER_BASE_LEVEL >= FARM_MAP_MIN_LEVEL`。最高、平均或加權怪物等級均無產品決策效力。費用按**目的地**門檻計算，不按玩家等級計算。

## 世界地圖可見根與樓層

現行原廠世界地圖畫面是 M1 範圍權威。若可辨識的地區、洞穴、地下城或野外群組根節點可見，`ROOT_VISIBLE=YES`，其下所有正常、常駐的子地圖與樓層均進入可選範圍。結構為 `ROOT_REGION → CHILD_MAP → CHILD_FLOOR → 更深的有效常駐樓層`。例如東邊洞穴與螞蟻地域密穴的有效樓層；子樓層不必在頂層地圖另有文字標籤。使用現行 rAthena 地圖資料、Client/world-map metadata 與既有 portal 關係證明歸屬；portal 圖可作親子證據，走路可達性不構成傳送前提。

若沒有可辨識的可見根，該家族標記 `ROOT_NOT_VISIBLE / OUT_OF_CURRENT_WORLD_MAP_SCOPE`，在 M1 `WORLD_MAP_SELECTABLE=NO`、`TELEPORT_AVAILABLE=NO`、`FARM_MAP_AVAILABLE=NO`。所有可見紅字標籤都是真實可選地區，必須逐一分類；多樓層紅色根節點須列出全部正常常駐樓層，不得靜默遺漏。

真正排除理由限定 `INSTANCE_ONLY`、`DYNAMIC_INSTANCE_COPY`、`EVENT_ONLY`、`TEMPORARY_MAP`、`NON_PERSISTENT_CHILD`、`SERVER_UNSUPPORTED`、`INVALID_MAP`。`NO_NAV_ROUTE`、`ROUTE_UNREACHABLE`、`MISSING_NAV_EDGE`、`ENTRANCE_PATH`、`OLD_STANDARD_WHITELIST`、`PORTAL_GRAPH_INCOMPLETE` 與舊手動步行要求，不得單獨排除玩家世界地圖傳送。

範圍內子樓層須同時具備 canonical 地圖、map server 支援、安全落點、至少一種有效一般掛機怪物、可推導 `FARM_MAP_MIN_LEVEL`，且無真正排除理由，才有 `FARM_MAP_AVAILABLE=YES`。無一般掛機怪物的地圖可保留可選與查看資料，但掛機不可用。來源索引的舊 28/136 與 `QUEST_ACCESS_REVIEW_REQUIRED` 統計只代表當時證據，不是現行 M1 可選範圍門檻。

## 世界地圖介面

沿用既有 RO 世界地圖圖片，在現有主城實際圖上位置疊加可點擊的城名，不建立獨立主要城鎮清單。V1 主城集合維持目前已核對的 `geffen`、`izlude`、`payon`、`prontera`、`alberta`、`comodo`、`aldebaran`；擴充須有現行 canonical 證據。rAthena 的 `town` mapflag 不自動授權成為主城傳送目的地。

點城名只選擇並開啟右側詳情，不立即傳送。城鎮面板依序顯示：城名、`【傳送至<主城>】`、符合實際在場條件時的 `【設為儲存主城】`，接著是 Map ID、類型「主城」、費用「免費」、目前傳送冷卻、目前儲存主城與相關資訊。點傳送後顯示「是否傳送至普隆德拉？」及「傳送費用：免費」，按鈕為「取消」、「確定傳送」。依下節音效序列及權威到達雙條件關閉過場後，更新當前地圖並顯示非阻斷提示「已抵達 普隆德拉」；不再顯示第二個確認視窗。失敗不播成功音。

掛機地圖右側面板依序顯示地圖名稱、`【設定為掛機地圖】`、Map ID、地圖需求、傳送費、冷卻狀態、主要掛機怪物等級範圍、完整可戰鬥怪物等級範圍、非 Boss spawn、主要怪物、Boss/MVP、資源怪與其他資料。移除底部重複掛機按鈕。此按鈕是一個設定目的地、必要時傳送、權威到達後啟動或恢復 `AUTO_FARM` 的動作，無須再點傳送。狀態包含 `AVAILABLE`、`ALREADY_ON_MAP`、`LEVEL_TOO_LOW`、`COOLDOWN`、`INSUFFICIENT_ZENY`、`UNAVAILABLE_MAP`；鄰近顯示「地圖需求：Base Lv.X」、「傳送費：免費 / N Zeny」，冷卻與等級不足分別顯示「XX 秒後可再次傳送」、「需要 Base Lv.X」。

多樓層根節點點擊後，在右側詳情加入精簡樓層選擇 `[1F] [2F] [3F] ...`。每層獨立顯示名稱、Map ID、等級門檻、費用、主要掛機與完整戰鬥怪物範圍、spawn、Boss/MVP、資源怪、傳送與掛機狀態及不可用原因；各可掛機樓層各有自己的 `【設定為掛機地圖】`。

世界地圖頁首唯讀顯示「儲存主城：<Town>」或「儲存主城：尚未設定」。桌面與 390×844 手機版須可操作城名、紅色根節點、樓層選擇、掛機詳情及按鈕、主城詳情、儲存主城、傳送確認、設定與補給狀態，且沒有水平溢位。

### World Map 傳送音效與過場，2026-09-24 定案

```text
M1_TELEPORT_PRESENTATION_DECISION = CANONICAL / ACTIVE
A = ef_readyportal.wav
B = ef_portal.wav
C = warp.wav
D = ef_teleportation.wav
TRANSITION_CLOSE = AUTHORITATIVE_ARRIVAL AND D_PLAYBACK_COMPLETE
```

開啟世界地圖選圖流程時，A 播放一次，B 維持單一循環。取消或關閉時停止 B，且不播放 C、D。目的地確認經 Dashboard 權威 preflight 接受後，停止 B，完整播放 C；C 的實際 `ended` 後才完整播放 D。只有權威到達及 D 的實際播放完成同時成立，才關閉過場、揭露目的地，隨後啟動目的地 BGM；兩事件的先後順序不影響此雙條件。正常蒼蠅翅膀使用取得權威成功位移時僅播放 D 一次，拒絕或失敗時不播放 D。蒼蠅翅膀維持非消耗。音效與過場只負責呈現，世界地圖的 Server Direct Teleport 與 rAthena 權威到達判定不變。此定案取代本文件此前「到達後才開始播放傳送音」的時序描述；來源資產與未證實的原廠 Client 觸發鏈仍分別記錄於 `docs/ro-original-ui/ro-warp-portal-teleport-audio-provenance.md`。

## Saved Town、蝴蝶翅膀與補給

角色只有一個 `SAVED_TOWN` 概念，沿用 rAthena `save_point` 與 `pc_setsavepoint` 的既有來源映射。不建立獨立 `SUPPLY_TOWN`、`HOME_TOWN` 或 `BUTTERFLY_TOWN` 權威。玩家只能在 `CURRENT_MAP == SELECTED_TOWN_MAP` 時把該主城設為儲存主城；免費、無冷卻，不改世界傳送冷卻。已是目前儲存主城時，顯示停用狀態 `【目前儲存主城】`；角色不在該城時，停用設定動作。

既有 rAthena save point 若對應支援主城就直接沿用；若不對應，標記 `SAVED_TOWN_SETUP_REQUIRED=YES`，頁面顯示「儲存主城：尚未設定」，保留原值且不自動改成普隆德拉。有效 Saved Town 的蝴蝶翅膀語義是 `RETURN_TO_SAVED_TOWN`，從野外回城免費、無冷卻，繞過世界傳送冷卻。玩家尚未建立支援的 Saved Town 前，蝴蝶翅膀本身維持 rAthena 舊 save point 行為。玩家手動從野外返回任一啟用主城不改 Saved Town；只有明確點選設定動作才修改。

補給流程：`AUTO_FARM → SUPPLY_REQUIRED → 保留 FARM_PARENT_INTENT 與 FARM_DESTINATION → RETURN_TO_SAVED_TOWN → 權威到城 → CITY_LOCAL_NAVIGATION → 商人/服務 NPC → 購買/補充 → 權威背包驗證 → 計算並保留返程費 → TELEPORT_TO_FARM_MAP → 權威到達 → AUTO_FARM_RESUME → SCAN → TARGET → COMBAT`。野外回 Saved Town、主城回掛機地圖均直接傳送；城內安全點到商人及其他服務 NPC 沿用現有 Navigation，保留進度、有界重試、停滯偵測與安全終止/恢復，不建立第二套城內導航。

返程採 TOWN → FIELD 規則：Lv.66 以下免費，Lv.67 起收目的掛機地圖最低等級 ×10 Zeny，成功後 60 秒冷卻。購物前保留 `RETURN_TELEPORT_COST`，不可花掉離城所需 Zeny。若補給觸發時沒有支援的 Saved Town，回報 `SUPPLY_HOME_REQUIRED` 或現行精確等價狀態，保留掛機意圖，安全停下，不猜主城、不隔離、不無限重試。Navigation 仍服務城內補給、Quest/M2、未來角色自主移動與其他同圖移動；`PLAYER_WORLD_NAVIGATION_SETTINGS=NOT_APPLICABLE`。

### 歷史：M1 補給觸發與背包安全補充決策

此段 2026-09-24 的重量／格數補給與服務存倉／販售決策保留為歷史證據；最新 `M1_NONCONSUMABLE_TRAVEL_AND_AMMO_OVERRIDE_V1` 指示明確恢復下方的戰鬥延續物品限定補給規則。此段狀態為 `HISTORICAL / SUPERSEDED_BY = M1_NONCONSUMABLE_TRAVEL_AND_AMMO_OVERRIDE_V1`，不得作為現行 M1 執行或 UI 開關依據。

```text
M1_SUPPLY_STORAGE_SELL_AND_PREFLIGHT_V1 = HISTORICAL / SUPERSEDED
M1_SUPPLY_TRIGGER = COMBAT_CONTINUITY_ITEMS_OR_WEIGHT_OR_SLOTS
M1_WEIGHT_TRIGGER_SUPPLY = YES
M1_INVENTORY_TRIGGER_SUPPLY = YES
AUTO_STORAGE = IN_M1_WHEN_POLICY_AND_SERVICE_AVAILABLE
AUTO_SELL = IN_M1_WHEN_EXPLICIT_ITEM_RULE_AND_SERVICE_AVAILABLE
PLAYER_FARM_MAP_CHANGE_PREFLIGHT = BEFORE_FARM_STOP_FEE_COOLDOWN_TELEPORT
```

以鎖定 OpenKore `src/AI.pm` 的服務順序為參考：重量或已用背包格數達門檻時，依序判定存倉、販售，再判定需購買的戰鬥延續物品。歷史角色 `config.txt` 的 `itemsMaxWeight_sellOrStore=68`、`itemsMaxNum_sellOrStore=99`、`itemsMaxWeight=89` 是可追溯的角色範例；角色設定與權威狀態決定實際門檻。單一購買物品不足仍可觸發補給；未使用該戰鬥資源的角色保持 `NOT_APPLICABLE`。

逐項物品處置沿用 `items_control.txt` 的最小保留量、存倉、販售及優先順序。歷史 `all 0 1 0` 代表未逐項列出的物品預設存倉；販售只依明確逐項設定與可賣數量進行。存倉優先；存倉滿或不可用不授權無條件販售。裝備中、不可販售或受保護物品不得販售。rAthena 裁定物品合法性、倉庫容量、NPC 交易、背包、重量及 Zeny 的實際結果；每步以權威前後狀態確認。

玩家切換掛機地圖時，在停止原掛機、扣費、寫冷卻及傳送之前，由權威角色狀態判定是否需補給。若需服務，保留所選地圖與原掛機父意圖，返回有效 Saved Town，依序完成城內存倉、合規販售及購買，核對背包、重量、Zeny 與 `RETURN_TELEPORT_COST`，再直接傳往所選地圖並恢復 `AUTO_FARM`。不可先切圖再補判，也不可用 Browser 自報的背包狀態作權威。

服務不可用、倉庫滿、處置後仍超重或滿格、Zeny 不足及交易拒絕時，保留父意圖與所選地圖，進入可恢復的安全阻擋狀態。重試必須有進度條件與總次數／時間上限；禁止隔離、空轉及用販售取代無法完成的存倉。此狀態為 `SAFE / RECOVERABLE / NO_QUARANTINE`，待權威狀態變化或明確玩家處理後續行。

### NON-CONSUMABLE TRAVEL / AMMO OVERRIDES

```text
CLASSIFICATION = GI_EXPLICIT_OVERRIDE
FLY_WING_CONSUMPTION = NO
BUTTERFLY_WING_CONSUMPTION = NO
BULLET_CONSUMPTION = NO
ARROW_CONSUMPTION = NO
```

蒼蠅翅膀仍須完成權威同圖隨機移動，蝴蝶翅膀仍須完成權威 Saved Town 回城；成功與否以地圖、座標及權威到達結果判定，數量保持不變。遠程攻擊保留 rAthena 的彈藥類型、裝備、武器、射程、傷害及技能合法性判定；具備相容彈藥後，命中不扣箭矢或子彈數量。缺少必要相容彈藥時，保留安全的戰鬥資源阻擋狀態與掛機父意圖，不隔離角色。

四類非消耗資源均不適用數量耗盡補給門檻，不以其數量下降觸發 Supply，也不顯示補貨或耗盡閾值設定。此條款只凍結四類資源的非消耗性及其補給排除；其他補給、重量、格數與服務政策依本文件各自的現行決策處理。

### 現行 M1 補給觸發與背包安全決策

```text
M1_NONCONSUMABLE_TRAVEL_AND_AMMO_OVERRIDE_V1 = CANONICAL / ACTIVE
M1_SUPPLY_TRIGGER_MODEL = COMBAT_CONTINUITY_ITEMS_ONLY
M1_WEIGHT_TRIGGER_SUPPLY = NO
M1_INVENTORY_TRIGGER_SUPPLY = NO
GLOBAL_AUTOSTORE = NO
AUTO_SELL = OUTSIDE_M1
AUTO_STORAGE = OUTSIDE_M1
```

補給耗盡觸發只涵蓋實際消耗的 HP／SP 物品及現行 M1 runtime 已支援的技能必需消耗物；蒼蠅翅膀、蝴蝶翅膀、箭矢、子彈均排除。缺少必要相容彈藥屬於合法性／可用性阻擋，不建立彈藥耗盡補貨循環。背包滿格或重量阻擋保持安全、可恢復、無隔離與有界重試；不得自動觸發 M1 存倉或販售。切換掛機地圖的權威補給預檢保留，僅檢查現行 M1 支援的戰鬥延續消耗物與安全條件。

## M1 設定與 Fly Wing 拒絕

玩家設定區順序為：1 掛機、2 戰鬥、3 技能、4 HP / SP、5 補給、6 蒼蠅翅膀、7 蝴蝶翅膀 / 回城、8 恢復、9 進階 / 尚未支援；不加入玩家 Navigation 區。每個設定須可追溯 `OPENKORE_FILE`、`OPENKORE_SYMBOL`、`OPENKORE_CONFIG`、`OPENKORE_DEFAULT`、`OPENKORE_BEHAVIOR`、`GI_RUNTIME_MAPPING`、`UI_CONTROL`、`UI_STATE`。`UI_ENABLEMENT <= RUNTIME_CAPABILITY`，`ENABLED_UI_NO_OP_COUNT=0`；執行尚未接通的控制須停用或唯讀。

rAthena 拒絕 Fly Wing 時，結束該次嘗試，保留 `AUTO_FARM` 與 `SEARCH`，不在同一週期或遞迴重試、不隔離、不回報假成功。持續性拒絕須等相關權威狀態變化才重試；暫時性拒絕可在稍後正常排程或搜尋週期重新評估。

## 最終 M1 玩家驗收

以同一段連續合法玩家流程觀察：`World Map → 傳送掛機地圖 → AUTO_FARM → TARGET → ATTACK → HIT → DAMAGE → KILL → LOOT → 藥水/恢復 → Fly → Supply 觸發 → Saved Town → 城內商人 Navigation → 補足 → 直接傳回 → AUTO_FARM resume → HIT → KILL → LOOT`。來源、合成檢查、API 與本機 Browser 結果分別報告；最終 Production 玩家 Browser 流程須獨立驗收。

該流程的原廠彩色 minimap 必須正確、marker 可見、換圖更新背景、座標變化使 marker 移動，且不需重整頁面；量測 `MINIMAP_POSITION_LATENCY`，靜態截圖不算通過。Browser Combat Log 須從權威遊戲事實顯示 `TARGET`、`ATTACK`、`HIT`、`DAMAGE`、`KILL`、`LOOT_ACQUIRED`；不建立假 Life session。另驗傷害數字、適用時的暴擊視覺、戰鬥音效、靜音/解除靜音、無重複音效、無事件不出聲。

原廠戰鬥音效須查韓文檔名與 GRF 路徑、適用的日文/JRO 名稱、編碼或內部檔名、解碼別名、現有專案音效索引、Client/rAthena 參照及 SHA256，不限英文字檔名。每個採用紀錄必備 `GAME_EVENT`、`SOURCE_CLIENT`、`ORIGINAL_GRF_PATH`、`ORIGINAL_FILENAME`、`ORIGINAL_LANGUAGE`、`DECODED_NAME`、`SOURCE_REFERENCE`、`SHA256`、`WEB_DERIVATIVE`、`MAPPING_CONFIDENCE`。對應不明標 `UNRESOLVED`，不猜測。

## 被取代規格與歷史證據

| 歷史規格或證據 | 目前狀態 | 現行決策 |
| --- | --- | --- |
| 玩家換掛機地圖走 portal 或跨圖 Navigation；H04 舊 `Task::MapRoute` 映射 | `HISTORICAL / SUPERSEDED` | 世界地圖直接權威傳送，H04 驗到達後掛機恢復 |
| Supply 野外回城與主城返掛機地圖走世界 Navigation | `HISTORICAL / SUPERSEDED` | 直接傳送，Navigation 留在城內服務段 |
| STANDARD 地圖白名單、舊 28/136 可選地圖斷言 | `HISTORICAL / SUPERSEDED` | 現行世界地圖可見根與常駐子樓層逐一分類 |
| 以 `QUEST_ACCESS_REVIEW_REQUIRED` 泛用標記阻止可見根子樓層 | `HISTORICAL / SUPERSEDED` | 依本文件真實排除原因與掛機條件核定 |
| 玩家 Navigation 設定區與獨立 Supply Town 權威 | `HISTORICAL / SUPERSEDED` | 不顯示 Navigation 區；只使用 `SAVED_TOWN` |
| 世界地圖詳情底部掛機按鈕 | `HISTORICAL / SUPERSEDED` | 按鈕緊接地圖名稱，每個樓層獨立 |

上述舊數字、路線、測試與來源差異可繼續作歷史或實作證據，不能作為當前產品範圍與驗收準則。對新實作及測試，本文件優先；完成狀態仍由來源與現場證據核定。
