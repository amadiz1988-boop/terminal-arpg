# RO Renewal 負重來源核對

固定來源版本見 `game/ro/source.ts`。

| 規則                 | 固定來源                                                                   | 實作                                                              |
| -------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 初心者基礎負重上限   | rAthena `db/re/job_stats.yml`                                              | Novice 未覆寫 `MaxWeight`，使用預設內部值 20,000                  |
| 道具重量             | rAthena `db/re/item_db_usable.yml`、`item_db_etc.yml`、`item_db_equip.yml` | 目前 `prt_fild08` 全部掉落及可裝備物逐項固定重量                  |
| 裝備仍計入負重       | rAthena `pc_additem` 與角色總負重欄位                                      | 背包與已裝備物品共同計算角色負重                                  |
| 拾取上限             | rAthena `src/map/pc.cpp` 的 `pc_additem`                                   | 新重量超過 `max_weight` 時回傳 `ADDITEM_OVERWEIGHT`，物品留在地面 |
| Renewal 自然恢復限制 | rAthena `src/map/battle.cpp`                                               | `natural_heal_weight_rate` 預設 70%                               |
| 嚴重超重             | rAthena `src/map/battle.cpp` 與 `pc_updateweightstatus`                    | 90% 進入 `SC_WEIGHT90`，無法自然恢復、攻擊或使用技能              |
| 顯示單位             | OpenKore `src/Network/Receive.pm`                                          | `VAR_WEIGHT` 與 `VAR_MAXWEIGHT` 接收後除以 10 顯示                |

目前 DEMO 尚未實裝倉庫自動補給。角色達 90% 負重後停止攻擊屬原規則結果，後續由 `storageAuto` 回城、存倉與返回掛圖解除。
