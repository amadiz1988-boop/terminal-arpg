# 伊甸園第一套裝備來源決策

日期：2026-09-12

## 版本閘門

- rAthena Renewal：`e985006171d2eb320ee512a653f4c83aea3d81b6`
- OpenKore：`51de1ddfc4449ae5217f6886de702f87ca934030`
- 啟用入口：`npc/re/scripts_athena.conf`
- 採用腳本：`npc/re/quests/eden/eden_common.txt`、`npc/re/quests/eden/eden_quests.txt`
- 排除腳本：`npc/re/quests/eden/eden_iro.txt`，該入口在 Renewal 設定中為註解狀態

## 第一版採用任務

| 欄位     | 鎖定來源結果                                                                                                                            |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 任務     | Conquer the Desert，任務 ID 7128 至 7132                                                                                                |
| 接取 NPC | Instructor Boya，`moc_para01` `(25,35)`                                                                                                 |
| 等級     | Base Lv.12 至 19                                                                                                                        |
| 職業     | 原生腳本沒有 Job Lv. 條件；WEB 沿用新生流程，要求角色已完成一轉                                                                         |
| 前置     | 持有 Eden Group Mark 6219 或 22508，且 `para_suv01=0`                                                                                   |
| 現地 NPC | Talking Dog，`moc_fild11` `(180,253)`                                                                                                   |
| 目標一   | Condor 1009，10 隻，quest 7129                                                                                                          |
| 目標二   | Baby Desert Wolf 1107，10 隻，quest 7130                                                                                                |
| 目標三   | Scorpion 1001，5 隻，quest 7131                                                                                                         |
| 目標地圖 | `moc_fild11`；Renewal spawn 為 Condor 137、Baby Desert Wolf 137、Scorpion 41                                                            |
| 回報 NPC | Talking Dog 將 7131 換成 7132；Instructor Boya 完成 7132                                                                                |
| 領取 NPC | Administrator Michael，`moc_para01` `(112,96)`                                                                                          |
| 獎勵     | 5583 Eden Team Hat I、2560 Eden Team Manteau I、2456 Eden Team Boots I、15009 Eden Team Uniform I                                       |
| 一次性   | Michael 僅在 `para_suv01=11` 發放，領取時寫為 12 並將 `para_suv02` 寫為 1                                                               |
| 完成狀態 | quest 7132 由 Boya 執行 `completequest`，MariaDB quest state 為 completed；裝備領取完成由 `para_suv01=12` 與四件原生 inventory 共同確認 |

## 橋接決策

WEB 沿用現有任務日誌，只傳送 allowlisted Eden 任務動作。OpenKore 依 `%questList` 的 `mob_goal` 與 `mob_count` 切換戰鬥階段，並只使用 route、NPC talk 與既有戰鬥 AI。任務狀態、完成與獎勵均由上述 rAthena 原生腳本產生。
