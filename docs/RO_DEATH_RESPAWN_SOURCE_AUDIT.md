# RO 死亡與 OpenKore 重生來源核對

固定來源版本見 `game/ro/source.ts`。

| 規則 | 固定來源 | 實作 |
| --- | --- | --- |
| OpenKore 死亡後自動送出重生 | `OpenKore/src/AI/CoreLogic.pm` 的 `processDead` | `dcOnDeath != -1` 時依 `ai_dead_respawn` 等待後送出 `sendRestart(0)` |
| 預設重生等待 | `OpenKore/control/timeouts.txt` | `ai_dead_respawn 4`，即 4 秒 |
| 預設不因死亡斷線 | `OpenKore/control/config.txt` | `dcOnDeath 0` |
| 重生回儲存點 | `rAthena/src/map/pc.cpp` | 死亡角色的 last point 改為 save point |
| 回城復活 | `rAthena/conf/battle/player.conf` 與 `pc_setrestartvalue` | `revive_onwarp: yes`，HP／SP 恢復至角色基礎上限 |
| 初心者死亡懲罰 | `rAthena/src/map/pc.cpp` 的死亡懲罰條件 | Novice 明確排除 Base／Job 經驗懲罰 |

## DEMO 邊界

目前只載入 `prt_fild08`，儲存點暫設為該地圖南門入口。跨圖回到 `iz_int` 或城鎮必須等對應 FLD2、傳點圖與 MapRoute 匯入後才計入還原完成。
