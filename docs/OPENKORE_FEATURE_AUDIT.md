# OpenKore 功能盤點

## 查核基線

- Repository: `https://github.com/OpenKore/openkore`
- Commit: `51de1ddfc4449ae5217f6886de702f87ca934030`
- 主要證據：`control/config.txt`、`control/mon_control.txt`、`src/AI/CoreLogic.pm`、`src/AI/Attack.pm`、`src/Task/MapRoute.pm`、`src/Task/CalcMapRoute.pm`、`src/Task/Teleport.pm`

本文件只盤點固定版本中能找到的功能。多人共用怪物、掉落及重生屬於 RO 伺服器世界職責，由 rAthena 資料與本專案的共享世界服務實作。

## 已確認功能

| 類別 | OpenKore 功能或設定 | 用途 |
| --- | --- | --- |
| 固定掛機地圖 | `lockMap`、`lockMap_x/y`、`lockMap_randX/Y` | 維持單一掛機目的地，離開後自動返回 |
| 跨地圖導航 | `Task::MapRoute`、`Task::CalcMapRoute` | 經傳送點、NPC、飛空艇及地圖內路線抵達指定地圖 |
| 路線成本 | `routeWeights`、地圖權重、傳送點成本 | 比較候選跨圖路線 |
| 回儲存點 | `saveMap_warp` | 把傳送回儲存點納入跨圖路線候選 |
| 道具傳送 | `route_warpByItem` | 把可用傳送道具及後續路程納入成本比較 |
| 地圖內探索 | `route_randomWalk` | 沒有其他任務時在指定地圖隨機巡走 |
| 找怪傳送 | `teleportAuto_search`、`teleportAuto_idle` | 達到搜尋或閒置條件後隨機傳送 |
| 自動攻擊 | `attackAuto`、距離、視線、換目標、放棄目標 | 篩選目標、接近並攻擊 |
| 防搶怪 | `aggressiveAntiKS`、目標受傷判斷 | 避免攻擊其他玩家已交戰的怪物 |
| 怪物個別政策 | `mon_control.txt` | 每種怪設定攻擊、傳送逃跑、搜尋及條件 |
| MVP迴避 | MVP範例使用 `attack=-1`、`teleport=1` | 畫面出現指定MVP時不攻擊並傳送離開 |
| 生存傳送 | `teleportAuto_hp`、`deadly`、`maxDmg`、`minAggressives` | 低HP、致命傷害或圍攻時逃離 |
| 拾取 | `itemsTakeAuto`、`itemsGatherAuto` | 戰後拾取及主動蒐集地面物品 |
| 坐下恢復 | `sitAuto_hp_lower/upper`、`sitAuto_sp_lower/upper` | 依HP/SP門檻坐下與起身 |
| 補品 | `useSelf_item` | 依自身條件使用消耗品 |
| 攻擊技能 | `attackSkillSlot`、`attackComboSlot` | 按怪物、距離、施法與自身條件使用技能 |
| 輔助技能 | `useSelf_skill`、`partySkill`、`monsterSkill` | 自身、隊友及怪物條件技能 |
| 裝備切換 | `autoSwitch`、`equipAuto` | 依射程、武器或條件更換裝備 |
| 死亡處理 | `autoMoveOnDeath`、Teleport Respawn task | 重生後移動或重新進入任務流程 |
| 能力與技能配點 | `statsAddAuto`、`skillsAddAuto` | 按設定自動分配點數 |
| 補給與倉庫 | `buyAuto`、`sellAuto`、`storageAuto`、`getAuto` | 購買、販售、存倉及取倉 |
| 社交 | `partyAuto`、`dealAuto`、`follow` | 組隊、交易及跟隨玩家 |
| 商店 | `shopAuto_open`、`buyerShopAuto_open` | 自動開設販賣或收購商店 |
| 其他角色 | 傭兵、生命體、寵物設定 | 攻擊、跟隨、餵食及自動行為 |
| 紀錄 | 戰鬥、聊天、怪物、玩家及死亡日誌 | 終端分類與歷史保存 |

## 首版實作順序

1. 共享地圖世界：同一地圖的玩家共用怪物實體、HP、死亡、掉落與重生計時。
2. `lockMap`：玩家手動指定唯一掛機地圖，系統不能同時執行第二張掛機地圖。
3. `MapRoute`：建立地圖與傳送點圖，依實際步行及轉移成本求最短路徑。
4. 回城與傳送候選：有蝴蝶翅膀時比較回儲存點路線；沒有道具時走傳送點及NPC路線。
5. 地圖內找怪：視野沒有合法目標時巡走；達設定條件且持有蒼蠅翅膀時隨機傳送。
6. 怪物政策：普通怪、被其他玩家交戰的怪、危險怪與MVP分開處理。
7. MVP預設：不主動攻擊；指定MVP進入視野時使用蒼蠅翅膀，缺少逃生方法時執行步行逃跑。
8. 拾取、重量、補品、坐下、死亡回城與重新返回 `lockMap`。
9. 技能條件、裝備切換、能力配點、補給、倉庫與組隊。

## 邊界

- OpenKore具備 `lockMap`、跨地圖導航、找怪傳送、怪物個別逃跑及MVP迴避範例。
- 「洞窟內固定優先使用蝴蝶翅膀」不是單一現成開關。OpenKore會把回儲存點及傳送道具放進路線候選；本專案會依使用者規則提高洞窟回城候選優先級，仍先檢查地圖禁止傳送旗標與道具數量。
- 多人共享世界與怪物重生由伺服器維護，不能放在每位玩家各自的掛機模擬器內。
