# Renewal 新生訓練與一轉流程

## 現行產品規則

- 創角時由玩家選定六種一轉志願：劍士、魔法師、弓箭手、服事、商人、盜賊。
- 志願寫入角色永久變數 `terminal_target_job$`，角色完成一轉前不可改選。
- 資格固定為初心者 Job Lv.10 與基本技能 `NV_BASIC` Lv.9。
- 達標後由 OpenKore 暫停戰鬥並快速引導至伊斯魯得島 `Criatura Academy`。
- `iz_ac01 (104,39)` 的結業導師再次檢查角色職業、Job 等級、基本技能與創角志願。
- rAthena NPC 腳本執行 `jobchange`、學院報到、原職業新手裝備及弓箭手箭筒發放。
- 完成後玩家可返回 `prt_fild08`，恢復原掛機狀態。

玩家介面及 OpenKore 均無法直接寫入 `char.class`。職業結果以 rAthena 地圖伺服器回送封包為準。

## 學院結業獎勵

| 志願 | rAthena Job | 職業獎勵 |
| --- | --- | --- |
| 劍士 | `Job_Swordman` | `N_Falchion` |
| 魔法師 | `Job_Mage` | `N_Rod` |
| 弓箭手 | `Job_Archer` | `N_Composite_Bow` 與三種箭筒 |
| 服事 | `Job_Acolyte` | `N_Mace` |
| 商人 | `Job_Merchant` | `N_Battle_Axe` |
| 盜賊 | `Job_Thief` | `N_Main_Gauche` |

首次學院報到另依 Renewal Academy Receptionist 規格發放初心者防具、武器、學院帽、髮型券與新手藥水。

## 已停用流程

玩家端不再前往 `izlude_in` 劍士公會、`geffen_in` 魔法師公會、`payon_in02` 弓箭手公會、`prt_church` 教堂、`alberta_in` 商人公會及 `moc_prydb1` 盜賊公會執行一轉。舊測試紀錄只保留作版本稽核，不再列為現行產品流程。

## 來源

- 鎖定版 rAthena `npc/re/jobs/novice/academy.txt`
- 鎖定版 rAthena `npc/re/jobs/1-1/*.txt`
- 鎖定版 rAthena `npc/other/Global_Functions.txt`
- 專案腳本 `ops/ro-stack/templates/terminal_academy_job_change.txt`

## 2026-09-11 驗收

- 手機 390×844 玩家頁實際完成盜賊志願流程。
- 實際地圖事件：`prt_fild08 → izlude → izlude_in → izlude → iz_ac01`；未操作舊職業公會 NPC。`izlude_in` 為目前 Portal route 的一次室內繞行，已列入待校正項目。
- NPC 對話、結業確認、Job ID 6、Job Lv.1、十項盜賊技能、新手短劍及返回掛機均通過。
- 瀏覽器錯誤 0，素材載入失敗 0，測試角色結束後停止。
- 商人同流程已由 rAthena 回送 Job ID 5、Job Lv.1 與 `N_Battle_Axe`；玩家頁的專用戰斧圖示缺件，該職驗收尚未通過。
- 其餘四職及六職並發仍待現行學院流程驗收。
