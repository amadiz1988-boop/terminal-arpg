# Normal Attack Class Parity 驗收準備 V1

## Workline 與結論

```text
WORKLINE_ID = NORMAL_ATTACK_CLASS_PARITY_ACCEPTANCE_PREP_V1
STAGE2_SOURCE_CHECKPOINT = 7e6f0f527ba122394260562a063e76a1011b3a14
CURRENT_EXECUTOR_SEMANTICS = GENERIC_NORMAL_ATTACK
NORMAL_ATTACK_CLASS_PARITY = NOT_YET_PROVEN
NORMAL_ATTACK_EXECUTOR = NOT_GENERALIZED
PRODUCTION_TOUCHED = NO
RUNTIME_RESTARTED = NO
GAMEPLAY_SOURCE_CHANGED = NO
```

這個分類來自目前 native source：PA 的 `issue_melee_attack()` 與 fallback 路徑都呼叫原生 `unit_attack(sd, target, 1)`；`unit_attack_timer_sub()` 依 `status_get_status_data(*src)->rhw.range` 及 `battle_check_range()` 判定距離；`battle_weapon_attack()` 再依武器與彈藥進入原生 `battle_calc_attack(BF_WEAPON, ...)`。因此攻擊執行語意沒有被限制為近戰。

目前阻止立即宣稱三類 parity 的因素位於驗收契約：Stage2 admission、lease、environment flag、trace context、PA pending 欄位、事件命名與 OpenKore atlas mapping 都仍以 `melee` 命名。`stage2_melee_canary_for()` 沒有檢查 weapon type，這證明執行器可承接遠程武器，也同時表示目前的 proof surface 沒有 class-aware contract。這是「通用執行器，近戰專用證據層」的狀態。

## 權威來源與 reference gate

```text
OPENKORE_REFERENCE_REQUIRED = YES
OPENKORE_REFERENCE_TRIGGERED = YES
OPENKORE_ATLAS_TOPIC = COMBAT (topic 10), TARGET_SELECTION (topic 07)
OPENKORE_ATLAS_FILES = docs/openkore-reference/reference-index.yml; docs/openkore-reference/combat-and-targeting.md
OPENKORE_ATLAS_SEARCHED = YES
RATHENA_ATLAS_SEARCHED = YES
AUTHORITATIVE_SOURCE_CHECKED = YES
PROJECT_LAST_GOOD_CHECKED = YES
OPENKORE_MATURE_BEHAVIOR_CHECKED = YES
RATHENA_AUTHORITY_CHECKED = YES
CURRENT_PA_CHECKED = YES
REFERENCE_GAP = NOT_CONFIRMED
OPENKORE_REFERENCE_VERSION = master
OPENKORE_REFERENCE_COMMIT = 51de1ddfc4449ae5217f6886de702f87ca934030
OPENKORE_REFERENCE_INHERITED = YES
OPENKORE_BEHAVIOR_COMPARED = YES
SERVER_AUTHORITY_INVARIANTS_PRESERVED = YES
REFERENCE_CONFLICT_RESOLVED = YES
GHOST_ISLAND_OPTIMIZATION_REVIEWED = YES
OPTIMIZATION_APPLIED = NO_NOT_NEEDED
```

OpenKore 的可繼承語意是 target eligibility、approach、attack request、authoritative damage observation、target loss 與 bounded stop。Current design 採 `ADAPT`：PA 保留 intent、target 與 lifecycle，rAthena 保留 range、ammo legality、damage、HP、death 與 loot authority。OpenKore process count 仍必須為 `0`，不得把 OpenKore runtime 帶入下一階段。

主要證據：

- `C:\Users\Administrator\source\ghost-island-rathena\src\map\persistent_agent.cpp:2445-2578`：Stage2 canary、lease、`issue_melee_attack()`、`report_melee_hit()`。
- `C:\Users\Administrator\source\ghost-island-rathena\src\map\persistent_agent.cpp:8198-8418`：farm tick、hit observation、skill fallback 與 normal attack dispatch。
- `C:\Users\Administrator\source\ghost-island-rathena\src\map\unit.cpp:2943-3372`：`unit_attack()`、timer validation、range check、`battle_weapon_attack` dispatch。
- `C:\Users\Administrator\source\ghost-island-rathena\src\map\battle.cpp:7168-7423`：normal weapon attack、bow/gun ammo check、`battle_calc_attack`、ammo consume、native delayed damage。
- `C:\Users\Administrator\source\ghost-island-rathena\src\map\pc.hpp:959-1004`：weapon and ammo enums。
- `docs/architecture/local-hunting-hybrid-architecture.md:229-260`：bounded melee PASS、class parity hard gate、global promotion pending。
- `docs/roadmap/hybrid-local-combat-migration.md:354-378,484-490`：Stage2 contract 與三類 parity gate。
- `docs/reference-mining/topics/monster-ai-combat-target-retarget.md:29-55,116-123`：`MONSTER_ATTACK` 與 `MONSTER_HIT` 的權威語意差異。
- `docs/rathena-reference/debugging.md:142-153`：combat success evidence 定義。

## 三類驗收矩陣

| 類別 | JOB / CLASS | WEAPON TYPE | AMMO REQUIRED / TYPE | ATTACK RANGE 與 TARGET RANGE | EQUIPMENT REQUIREMENT | CURRENT PA PROFILE | CURRENT rAthena SUPPORT | CURRENT STAGE2 SUPPORT | EXPECTED UNIT_ATTACK PATH | EXPECTED AUTHORITATIVE DAMAGE PATH | EXPECTED HIT EVIDENCE | STOP / POST-STOP | SUPPLY INTERACTION | KNOWN BLOCKER | SOURCE_CHANGE_REQUIRED |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| MELEE | legal melee job，例如 Swordman `class=1`；歷史 Stage2 fixture 使用 `150056`，目前 snapshot 已是 bow | `W_1HSWORD`、`W_2HSWORD` 或其他非 ranged weapon；enum 見 `pc.hpp:959-970` | 否，`AMMO_NONE` | 由 equipped weapon 的 `rhw.range` 決定，近身 target 必須通過 `battle_check_range` | 合法 melee weapon，角色 job 可裝備，target map 有 allowlisted mob | `MELEE_DAMAGE`；Stage2 bounded melee profile | PASS，原生 timer、range、battle damage | PASS 只限 bounded melee evidence，不能替代三類 parity | `issue_melee_attack` → `unit_attack` → timer → `battle_weapon_attack` | `battle_calc_attack(BF_WEAPON)` → `battle_delay_damage` / `battle_damage` → mob HP | 同一 target 的 `MONSTER_HIT`，`hpBefore > hpAfter`，至少 3 次，必要時同時核對 native log | `STOP_LOCAL_COMBAT` → `unit_stop_attack`；停止後不得有新 `UNIT_ATTACK_REQUEST`、`BATTLE_ATTACK_CALL` 或 `MONSTER_HIT`；Stage2 baseline 已有 post-stop 0 | 供應中斷時 lease 先失效，return 後必須建立新 lease；本輪不新增 potion/ammo policy | 目前唯一 reusable Stage2 fixture 的角色武器已漂移為 bow；150075 雖是 Swordman，現有 route fixture 回報 Controller pre-command blocker | **NO**，前提是 I 完成 Stage2 promotion gate 且沿用既有 bounded melee proof |
| BOW / RANGED | Archer `class=3`；可用同 class 的合法 Archer fixture | `W_BOW=11` | 是，`AMMO_ARROW`；`battle.cpp:7215-7218` | fixture 必須保留 bow 的 `rhw.range`，target 距離可大於 1 且通過 client/server range 與 LOS | 合法 bow，例如 Eden Bow I `item 1747`；合法 arrow，例如 `item 1750`；兩者均需正確 equip 與 job eligibility | `RANGED_DAMAGE` 尚未 production class-aware；目前可沿用 normal attack intent | PASS，native 設定 `arrow_atk`、驗證 arrow subtype、消耗 ammo，使用同一 battle authority | 執行路徑可承接，但 lease/trace/event 仍標 `melee`，因此 class parity proof 未建立 | 同一 generic path，range 由 equipped bow 提供 | 同一 `BF_WEAPON` path，native ranged formula 與 arrow flag 生效，成功後 consume arrow | `MONSTER_HIT` 必須對應真實 HP decrease；另記錄 attack 前後 arrow quantity，ammo consume 不可冒充 hit | 同 MELEE；停用後禁止 timer rearm、attack call、hit；ammo quantity 只在真實 attack 成功路徑變更 | 現有 PA supply 只覆蓋 Red Potion；本 gate 先固定足量 arrow，不測 ammo restock | current fixture `150056` 目前 `weapon=11` 且有 arrow，但 `last_map=pay_arche` 不在 current farm map allowlist；需合法 checkpoint 或 isolated fixture | **UNKNOWN**：rAthena attack path 不需改；若 acceptance 要求 class-labelled lease/trace 或 ammo lifecycle，需最小 source/contract change |
| GUN / RANGED | Gunslinger `class=24`；Rebellion 可作後續擴展，不列入第一輪 | `W_REVOLVER=17`，後續可覆蓋 rifle/gatling/shotgun/grenade | 是，revolver/rifle/gatling/shotgun 使用 `AMMO_BULLET`；`battle.cpp:7221-7226` | fixture 必須保留 gun 的 `rhw.range`，target 距離與 LOS 通過 server range | 合法 gun，例如 Six Shooter `item 13101`；合法 Bullet `item 13200`；兩者需正確 equip 與 job eligibility | `RANGED_DAMAGE` 尚未 production class-aware；目前可沿用 normal attack intent | PASS，native 會設定 `arrow_atk`、驗證 bullet subtype、消耗 ammo，使用同一 battle authority | 執行路徑可承接，但 Stage2 lease/trace 仍標 `melee`，且未有 ammo-specific acceptance contract | 同一 generic path，range 由 equipped gun 提供 | 同一 `BF_WEAPON` path，native ranged formula 與 bullet flag 生效，成功後 consume bullet | `MONSTER_HIT` 必須對應真實 HP decrease；另記錄 bullet quantity 與 no-ammo rejection，不以 attack log 代替 hit | 同 MELEE；stop 後不可有 rearm、attack、hit；若 ammo 用盡，必須是 native rejection，不能算 PASS | 現有 PA supply 沒有 ammo replenishment；第一輪固定足量 bullet，補給與 ammo policy 另案 | current baseline `150069` 為 Gunslinger、`weapon=17`、有 500 bullets，但 `last_map=prt_fild08` 不在 current farm map allowlist，且既有 baseline 的 authoritative hit count 為 0 | **UNKNOWN**：rAthena attack path 不需改；若要求 generalized lease/trace、no-ammo typed result 或 ammo restock，需最小 source/contract change |

## 目前可用角色與 fixture 判定

以下資料來自 2026-09-21 canonical MariaDB 唯讀查詢，以及 native item/job source。沒有執行 INSERT、UPDATE、GM、teleport、equipment mutation 或 gameplay command。

| CHAR_ID | 名稱 | class / job 判讀 | weapon 欄位 | 相關 inventory | current state | 判定 |
|---|---|---|---:|---|---|---|
| `150056` | `123132131` | `class=3`，Archer | `11=W_BOW` | `1747` Eden Bow I equipped；`1750` Arrow amount `43` equipped | `SERVER_AGENT/SERVER_AGENT/PERSISTENT_IDLE`，`pay_arche` | Bow candidate。既有 Stage2 acceptance fixture 指向此 CID，但 current map 不在現行 farm allowlist，不能直接宣稱 ready。 |
| `150069` | `賴清德` | `class=24`，Gunslinger | `17=W_REVOLVER` | `13101` Six Shooter equipped；`13200` Bullet amount `500` equipped | `SERVER_AGENT/SERVER_AGENT/PERSISTENT_IDLE`，`prt_fild08` | Gun candidate。既有 supply baseline；current map 不在現行 farm allowlist，且該 baseline 的 authoritative hit evidence 為 `0`，不能當 gun PASS。 |
| `150075` | `蕭美琴` | `class=1`，Swordman | `3=W_2HSWORD` | current inventory query 未建立完整 melee equipment proof | `SERVER_AGENT/SERVER_AGENT/PERSISTENT_IDLE`，`moc_pryd01` | Melee candidate only。既有 trace fixture 的 `start_farm` 曾在 Controller → command creation 回 `409 supply_route_unavailable`，須先通過 current admission，不能繞過。 |
| `150094` | `AssassinGateThief` | `class=17`，Rogue | `1`，非 bow/gun | 無 parity-required ammo | `ROUTE_FAILED`，`prontera` | 排除本輪 class parity fixture。 |

```text
MELEE_FIXTURE_READY = NO
BOW_FIXTURE_READY = NO
GUN_FIXTURE_READY = NO
```
最近合法狀態優先順序：

1. 等待 I 完成 Stage2 promotion gate 後，先重查 `150056`、`150069`、`150075` 的 owner、resident、farm map、weapon、equip 與 ammo。
2. 若 current production allowlist 仍不接受上述 map，建立 isolated DB 的合法 reusable fixture，角色、job、weapon、ammo、target map 與 ownership 一次固定，保留原生 combat authority。
3. 不在 production 直接改 `char.weapon`、inventory、position、map、agent state 或 ammo；不得用 GM teleport 作為 gameplay success。

## 權威 HIT、停止與供應證據

每一類都必須獨立產生下列證據，並以相同 target entity、lease session 與 execution epoch 關聯：

```text
MONSTER_TARGET             = target selected by PA and legal under rAthena
MONSTER_ATTACK             = attack intent only
UNIT_ATTACK_REQUEST        = native unit attack request
ATTACK_TIMER_*             = native timer scheduled/fired/validated
BATTLE_ATTACK_CALL         = battle_weapon_attack entered
BATTLE_CALC_ATTACK         = BF_WEAPON calculation returned
AUTHORITATIVE_HP_DECREASE  = mob status.hp before > after
MONSTER_HIT                = emitted only from that authoritative decrease
MONSTER_KILL               = optional, only after native death/removal
```

最低命中 gate 為每類至少三次 `MONSTER_HIT` 或三次可逐筆對應的 native HP decrease。`MONSTER_ATTACK`、animation、HTTP、單純 log 或 `BATTLE_CALC_ATTACK` 都不足以證明命中。

停止 gate：

```text
STOP_LOCAL_COMBAT accepted
→ unit_stop_attack(sd)
→ lease inactive / target action cleared
→ bounded observation window
→ post-stop UNIT_ATTACK_REQUEST = 0
→ post-stop BATTLE_ATTACK_CALL = 0
→ post-stop MONSTER_HIT = 0
```

Supply interaction 只驗證 lease interruption contract。若 supply active，既有 `validate_melee_lease()` 應使 lease 失效，PA 完成 return 後重新取得合法 target、建立新 lease，再開始命中計數。Bow/gun 的 ammo 數量屬 native equipment contract；本 gate 使用預先存在且合法的足量 ammo，不把補充 ammo 當成 loot 或 combat proof。

## 下一階段執行順序

1. `PRECONDITION`：確認 I 的 Stage2 promotion result、native HEAD、single runtime、OpenKore count `0`、canonical map 只有一個、角色 owner/resident 合法。
2. `FIXTURE_READ`：唯讀確認 job、weapon、equipped item、ammo subtype、ammo quantity、farm map、target mob allowlist、HP/SP 與 revision。任一欄不符即 `NOT_REACHED`，不改 production。
3. `TRACE_SETUP`：為該 class 設唯一 trace ID，保存 attack/hit/stop counter baseline；不得修改 Stage2 executor。
4. `START`：以正常 PA start path 取得 target，確認 `MONSTER_TARGET`、lease creation、range legality 與 `UNIT_ATTACK_REQUEST`。
5. `COMBAT`：觀察同 target 至少三次 authoritative HP decrease，逐筆確認 `MONSTER_HIT`，bow/gun 額外核對 ammo subtype 與數量變化。
6. `STOP`：正常 `STOP_FARM` 或 `STOP_LOCAL_COMBAT`，於 bounded window 驗證 post-stop attack/hit 全為零。
7. `INTERRUPT_REENTRY`：只有 I 的 Stage2 reentry gate 已 PASS 時才測 supply interruption；確認 return 後是新 lease，不重用舊 epoch/session。
8. `RESET`：將角色留在合法 `PERSISTENT_IDLE`，保存 fixture reset evidence，不清除或重置正式玩家資料。
9. 三類都 PASS 後，Project Control 才能把 `NORMAL_ATTACK_EXECUTOR` 改為 `GENERALIZED`。任一類未到達 combat 或 fixture blocker，只記 `NOT_REACHED`，不能標 FAIL 或 PASS。

## Source-change 預測與 FIRST_BROKEN_TRANSITION

```text
MELEE_SOURCE_CHANGE_REQUIRED = NO, 以現有 Stage2 bounded melee contract 為前提
BOW_SOURCE_CHANGE_REQUIRED = UNKNOWN
GUN_SOURCE_CHANGE_REQUIRED = UNKNOWN
```

目前沒有證據顯示 rAthena 的 normal weapon attack 需要為 bow 或 gun 重寫。若第一輪只用固定合法 weapon/ammo fixture，預期可重用原生 path。若驗收要求正式 generalized contract，最小預測變更會落在 admission/lease/trace/event naming 與 class/ammo metadata，不應改 attack cadence 或 battle formula。若第一個失敗發生在 `unit_attack` 之前，owner 是 PA admission/fixture；若已進入 `BATTLE_ATTACK_CALL` 但無 HP decrease，owner 是 native legality、range、ammo 或 battle result；若 HP 已下降但沒有 `MONSTER_HIT`，owner 是 PA projection。這三種情況才可填入下一輪 `FIRST_BROKEN_TRANSITION`。

本輪目前的固定判定：

```text
FIRST_BROKEN_TRANSITION = UNKNOWN / NOT_REACHED
```

沒有 bow/gun 執行證據前，不把「melee 命名」推論成 melee-only，也不把缺少 evidence 推論成 native failure。

## Ready-to-execute continuation

下一個 worker 應直接從以下狀態開始，不重做 discovery：

```text
CURRENT_PHASE = post-Stage2 promotion, class parity execution pending
LAST_CONFIRMED_GOOD = Stage2 bounded melee canary at 7e6f0f527ba122394260562a063e76a1011b3a14
FIRST_BROKEN_TRANSITION = UNKNOWN / NOT_REACHED
OWNER = D for native combat evidence; A for PA admission/projection
DO_NOT_TOUCH = Stage2 executor, attack cadence, melee lease semantics, production, second runtime
REQUIRED_CLASSES = MELEE, BOW/RANGED, GUN/RANGED
PASS_GATE = each class has target → attack → 3 authoritative HP decreases/MONSTER_HIT → stop with zero post-stop attacks
GENERALIZATION_GATE = all three classes PASS, then Project Control decision
```

## Validation record

```text
git diff --check = PASS
native combat source diff = NONE
roadmap diff = NONE
hybrid ADR diff = NONE
production mutation = NONE
runtime restart = NONE
```
