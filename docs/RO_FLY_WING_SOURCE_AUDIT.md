# RO 蒼蠅翅膀與 OpenKore 索敵來源核對

固定來源版本見 `game/ro/source.ts`。

| 規則           | 固定來源                                        | 實作                                                     |
| -------------- | ----------------------------------------------- | -------------------------------------------------------- |
| 客戶端視野     | OpenKore `control/config.txt`                   | `clientSight 17`                                         |
| 視野外演員排除 | OpenKore `src/Misc.pm`                          | 方塊距離大於或等於 `clientSight` 的演員不列入目前視野    |
| 攻擊掃描週期   | OpenKore `control/timeouts.txt`                 | `ai_attack 0.5`，每 500ms 可重新掃描                     |
| 預設隨機巡走   | OpenKore `control/config.txt`                   | `route_randomWalk 1`、`route_randomWalk_maxRouteTime 75` |
| 隨機巡走落點   | OpenKore `src/Field.pm`                         | 最多嘗試 500 次，僅選地圖內可行走格                      |
| 蒼蠅翅膀資料   | rAthena `db/re/item_db_usable.yml` 的 Id 601    | `Wing_Of_Fly`、重量 50、使用 `AL_TELEPORT` Lv.1          |
| 隨機傳送落點   | rAthena `src/map/pc.cpp` 的 `pc_randomwarp`     | 地圖邊緣保留 15 格，最多嘗試 1000 次，只選可行走格       |
| 傳點排除       | rAthena `conf/battle/skill.conf`                | `teleport_on_portal: no`，拒絕傳送門作用範圍外擴 1 格    |
| 本圖傳點       | rAthena `npc/re/warps/fields/prontera_fild.txt` | 匯入 `prt_fild08` 的五個傳點矩形                         |

## 使用者裁定

OpenKore 的 `teleportAuto_idle` 預設為 0。此專案依使用者明確規則，把「視野內無怪且背包有蒼蠅翅膀時使用」設為玩家策略。沒有蒼蠅翅膀時，回到 OpenKore 預設隨機巡走。介面必須明示這是玩家策略，不能標為 OpenKore 預設。

停止掛機時，玩家不掃描目標、不移動，也不消耗蒼蠅翅膀。共享世界中的怪物巡走、攻擊與重生照常推進。
