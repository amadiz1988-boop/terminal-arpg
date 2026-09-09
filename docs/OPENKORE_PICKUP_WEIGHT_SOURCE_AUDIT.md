# OpenKore 自動拾取負重來源核對

固定來源版本見 `game/ro/source.ts`。

| 規則            | 固定來源                          | 實作                                                     |
| --------------- | --------------------------------- | -------------------------------------------------------- |
| 自動拾取        | OpenKore `control/config.txt`     | `itemsTakeAuto 2`、`itemsGatherAuto 2`                   |
| 拾取負重上限    | OpenKore `control/config.txt`     | `itemsMaxWeight 89`                                      |
| 取得掉落前檢查  | OpenKore `src/Network/Receive.pm` | 目前負重百分比小於 `itemsMaxWeight` 才立即送出拾取       |
| items_take 中止 | OpenKore `src/AI/CoreLogic.pm`    | 目前負重百分比大於或等於 `itemsMaxWeight` 時退出拾取佇列 |
| 伺服器最終上限  | rAthena `src/map/pc.cpp`          | 加入道具後超過角色最大負重時回傳 `ADDITEM_OVERWEIGHT`    |

此規則檢查拾取前的目前負重。因此角色在 88% 時仍能拾取一件合法道具，拾取後可以跨過 89%；下一次 `items_take` 才停止。地面物品不會因此加入背包。
