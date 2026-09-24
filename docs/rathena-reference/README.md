# RATHENA_REFERENCE_ATLAS

本索引是 rAthena Renewal / Pre-Renewal 研究的快速入口。它只保存可追溯的路徑、symbol、版本上下文、用途與查找順序，不取代 rAthena 原始碼，也不授權直接修改 gameplay。

## 研究基線

| 欄位 | 已核對值 |
|---|---|
| 公開 upstream | https://github.com/rathena/rathena |
| upstream branch | `master` |
| upstream commit | `e985006171d2eb320ee512a653f4c83aea3d81b6` |
| commit date | `2026-08-21` |
| 專案 native checkout | `C:\Users\Administrator\source\ghost-island-rathena` |
| 專案 native HEAD | `1ffd06a07f8d997cf500334f92ccc7df6db354f7` |
| 研究日期 | `2026-09-21` |
| 版本規則 | 任務必先確認 Renewal / Pre-Renewal、branch、commit，再引用行為 |

upstream master 是公開行為基線，專案 native checkout 是本專案實際可執行的 source truth。兩者不同時記錄衝突，不自動消除差異。

## 先查哪一份

| 問題 | 入口 |
|---|---|
| Quest ID、目標怪、掉落計數 | [quest-automation.md](quest-automation.md)，`db/re/quest_db.yml`，NPC script |
| NPC 沒反應、踩點觸發、隱藏 NPC | [npc-and-trigger-model.md](npc-and-trigger-model.md)，`doc/script_commands.txt` |
| 角色換地圖、Warp、存點、翅膀 | [navigation-and-warp.md](navigation-and-warp.md)，`src/map/pc.cpp`、`src/map/unit.cpp` |
| Script command / 變數 / scope | [scripting-primitives.md](scripting-primitives.md) |
| Job change、Eden、Novice | [quest-automation.md](quest-automation.md) 與 `npc/jobs/`、`npc/re/quests/eden/` |
| Kafra、Storage、Shop、Item | [source-map.md](source-map.md) 與對應 script / `src/map/storage.cpp` |
| Instance、Timer、Event | [npc-and-trigger-model.md](npc-and-trigger-model.md)，`doc/sample/instancing.txt` |
| Plugin / extension | [extensions-and-plugins.md](extensions-and-plugins.md) |
| Debugging、packet boundary、structured probe | [debugging.md](debugging.md) |
| Item、loot、inventory、storage、weight | [reference-mining/topics/item-loot-inventory-storage-weight.md](../reference-mining/topics/item-loot-inventory-storage-weight.md) |
| Forum 成熟參考 | [forum-resource-index.md](forum-resource-index.md) |
| 下一個 exact file / symbol | [lookup-playbook.md](lookup-playbook.md) |

## 35 個 topic taxonomy

01 QUEST · 02 NPC · 03 DIALOGUE · 04 ONTOUCH / HIDDEN NPC · 05 WARP / MAP TRANSFER · 06 NAVIGATION / PATH · 07 MAP / MAPFLAG · 08 SAVE POINT / RESPAWN · 09 JOB CHANGE · 10 ITEM / INVENTORY · 11 SHOP / BUY / SELL · 12 KAFRA · 13 STORAGE · 14 COMBAT · 15 MONSTER / SPAWN · 16 LOOT / DROP · 17 SKILL · 18 STATUS EFFECT · 19 EXP / LEVEL / JOB LEVEL · 20 PARTY · 21 GUILD · 22 CHAT · 23 INSTANCE · 24 EVENT / TIMER · 25 QUEST DATABASE · 26 CHARACTER DATABASE · 27 SCRIPT ENGINE · 28 CLIENT PACKET / CLIF · 29 SERVER AUTHORITY · 30 RECOVERY / DEATH · 31 TELEPORT / FLY WING / BUTTERFLY WING · 32 AUTONOMOUS QUEST SUPPORT · 33 PLUGIN / EXTENSION · 34 TEST / DEBUG / SCRIPT COMMANDS · 35 DEBUGGING / STRUCTURED PROBES。

完整 machine-readable 對照見 [reference-index.yml](reference-index.yml)。

## 權威層級

`RATHENA_AUTHORITATIVE_SOURCE` 高於 `RATHENA_OFFICIAL_DOC`，官方 sample 用來確認可運作模式；forum / community 只作 pattern 或歷史參考。`PROJECT_LAST_GOOD` 可證明本專案曾經通過的流程，不能覆寫當前 rAthena authority。

## Anti-loop gate

建立新 gameplay mechanism 前固定執行：

1. 搜尋本 Atlas。
2. 搜尋 Project Last-Good。
3. 讀取 rAthena authoritative source。
4. 找出 `FIRST_BROKEN_TRANSITION`。
5. 先 reuse / adapt。

只有 `REFERENCE_GAP = CONFIRMED` 才能提出 new implementation。`UNKNOWN` 不等於 `DOES_NOT_EXIST`。

## 專案歷史連結

- `docs/EDEN_EQUIPMENT_SOURCE_DECISION.md`：Renewal Eden source selection。
- `docs/eden-next-tier-source-audit.md`：7138–7151 source mapping 與限制。
- `docs/JOB_QUEST_ADAPTER_CONTRACT.md`：目前 Quest Runtime job adapter contract。
- `docs/openkore-exit-source-of-truth.md`：OpenKore 只作 historical reference，production authority 為 PA / rAthena。
- `ops/ro-stack/persistent-agent/quest-sequences/eden-course-a.json`：專案 Last-Good typed flow。

這些連結是 `PROJECT_LAST_GOOD` 或 design contract，不代表所有流程目前都通過 production rollout。

## 研究限制

- Forum 索引只保留高價值、能說明 pattern 或陷阱的項目；舊文標記 `HISTORICAL_REFERENCE`。
- 沒有逐篇保存論壇全文；需要現況時回到 exact URL 與 upstream source。
- 本任務新增 debugging reference、索引、native opt-in probe foundation 與 bounded contract test，沒有修改 Persistent Agent、Quest gameplay、Dashboard gameplay、DB 或 runtime。
