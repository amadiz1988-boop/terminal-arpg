# HYBRID_LOCAL_COMBAT_MIGRATION

```text
TASK_ID = PA_RATHENA_COMBAT_REPLACEMENT_IMPACT_AUDIT_V1
DESIGN_STATUS = DESIGN_ACCEPTED
PLANNING_STATE = PLANNED
IMPLEMENTATION_AUTHORIZED = NO
IMPLEMENTATION_STARTED = NO
PRODUCTION_TOUCHED = NO
RUNTIME_RESTARTED = NO
```

## 1. Audit boundary

本文件只評估把 PA 目前的區域戰鬥協調器部分移到 rAthena map-server
內部 executor 的影響。rAthena 的傷害、死亡、掉落、背包、技能合法性與
位置仍是世界權威。PA 的補給、跨地圖導航、回農地、父級意圖、任務、社交、
生命週期與 recovery 仍由 PA 擁有。沒有修改 Native gameplay source、命令
shared seam、Production 或 runtime。

證據基線：

- Web project HEAD `2c05c29b3ae3e538348d1b2b0ce78c7f127d5ace`。
- Native canonical HEAD `ff72578f608935d1df5d664b3e9df9d436361043`。
- `src/map/persistent_agent.cpp` 的 `persistent_agent_farm_tick` 目前每
  200 ms 依序處理 survival、supply、target、approach、attack、hit、kill、
  loot 與 relocation。
- rAthena 與 OpenKore Atlas 已查核；OpenKore runtime count 為 `0`。
- `rAthena auto combat showcase` 在 reuse registry 為 `REFERENCE_ONLY`，
  license `Unknown`，license risk `BLOCKER`，不得抄碼或直接導入。

## 2. Current responsibility matrix

| Capability | Current owner | Authoritative boundary | Candidate disposition |
| --- | --- | --- | --- |
| Farm map eligibility / map guard | PA | PA lifecycle and selected map | KEEP_IN_PA |
| Target scan, claim, lock and retarget | PA with rAthena legality checks | `battle_check_target`, mob state | SAFE_WITH_CONTRACT only |
| Approach / path and portal containment | PA orchestration, rAthena path primitives | `path.cpp`, `unit_walktobl`, map state | KEEP_IN_PA; research executor lease |
| Attack cadence / attack request | PA issues `unit_attack` | rAthena accepts or rejects action | SAFE_WITH_CONTRACT |
| Skill selection / fallback | PA policy, rAthena skill checks | `skill_check_condition_castbegin`, cooldown and SP | RESEARCH_MORE |
| Damage, hit result, death and kill | rAthena | battle/status/mob authority | SAFE_TO_REPLACE = NO, KEEP_AUTHORITY_IN_RATHENA |
| Loot policy / pickup ordering | PA | rAthena `pc_takeitem`, inventory | KEEP_IN_PA |
| Potion choice and recovery policy | PA | rAthena item effect and cooldown | KEEP_IN_PA |
| Supply trigger, service route, replenishment | PA | rAthena shop/storage/item transaction | KEEP_IN_PA |
| Return-to-farm and resume | PA navigation and lifecycle | rAthena map/position | KEEP_IN_PA |
| Quest pause and resume | PA quest runtime | rAthena quest/NPC state | KEEP_IN_PA |
| Social / Life parent intent | Life/Social intent, PA capability | Event Ledger facts only | KEEP_IN_PA |

結論：目前沒有整個 local combat component 可直接安全替換。可評估的最小
替換單位是「PA 已授權、同地圖、已鎖定目標後的 melee attack cadence」，
加上明確的 stop、epoch、結果事件與失敗回收契約。

## 3. Contract required before any implementation

### 3.1 Combat executor lease

PA 建立 `combatSessionId` 與 `executionEpoch`，只授權同地圖、同 target
claim、同 owner 的短期 combat lease。rAthena executor 只處理 lease 內的
approach、range check、attack request 與 authoritative result observation。
lease 失效時必須停止新 action，保留既有 authoritative state，回報
`COMBAT_STOPPED`。

### 3.2 STOP_LOCAL_COMBAT_CONTRACT

PA 發出 idempotent `STOP_LOCAL_COMBAT`，欄位至少包含 `charId`、
`combatSessionId`、`executionEpoch`、`reason`、`traceId`。reason enum：
`SUPPLY_LOW`、`RECOVERY`、`QUEST`、`SOCIAL`、`PARENT_INTENT`、`DEATH`、
`OWNER_REVOKE`、`MAP_EXIT`。executor 必須：

1. 拒絕新的 attack/skill request。
2. 清除 ephemeral target、pending action 與 timer。
3. 呼叫既有 server stop primitive，不呼叫 supply、navigation、quest 或
   social side effect。
4. 回報 `COMBAT_STOPPED`，重送相同 epoch 必須得到相同結果。

### 3.3 SUPPLY_SIGNAL_CONTRACT

補給仍由 PA 判定與執行。executor 只能回報：

`SUPPLY_LOW { charId, itemId, count, threshold, targetMap, combatSessionId,
executionEpoch, traceId }`。

PA 收到後完成 `STOP_LOCAL_COMBAT`、Butterfly Wing 或既有服務路由、
權威補貨與 `SUPPLY_TARGET_REACHED` 驗證，再發出 `RETURN_TO_FARM`。executor
不得自行選 NPC、購買、消耗補給品或改變父級 intent。

### 3.4 Event contract

每個事件都必須帶 `charId`、`combatSessionId`、`executionEpoch`、map、
target entity/mob id、`traceId` 與 authoritative result reference。最小事件
集合：

```text
COMBAT_SESSION_STARTED
TARGET_SELECTED / TARGET_REJECTED / TARGET_LOST / RETARGET
APPROACH_STARTED / ARRIVAL / IN_ATTACK_RANGE / APPROACH_FAILED
ATTACK_ISSUED / HIT / MISS / NO_DAMAGE / ATTACK_TIMEOUT
MONSTER_KILL
COMBAT_PAUSED / COMBAT_STOPPED / COMBAT_FAILED
LOOT_CANDIDATE / LOOT_ACQUIRED / LOOT_SKIPPED
```

事件只記錄已由 rAthena 裁定的事實。H owned traceId propagation 保持整合
規格，這一輪不修改 H dashboard、command schema 或 shared seam。

## 4. Boundaries

### Potion boundary

PA 保留 HP/SP threshold、item/skill 選擇、recovery mode、supply escalation
與 quarantine policy。executor 不得自行喝藥。若日後需要 server-side apply，
只能使用 PA 授權的 recovery lease，通過既有 `pc_useitem`、cooldown、inventory
與 effect confirmation，並回報 `ITEM_USE_ACCEPTED`、`ITEM_EFFECT_APPLIED` 或
拒絕原因。

### Loot boundary

PA 保留 loot enabled policy、ownership、pickup ordering、overweight、
unreachable、blocked cooldown 與 resume。executor 可發出
`LOOT_CANDIDATE`，目前不取得物品。`pc_takeitem` 與 inventory delta 仍是
rAthena authoritative path。

### Supply and return proof

現有 PA source 已有 `SUPPLY_LOW`、`SUPPLY_MODE_ENTER`、`SUPPLY_STARTED`、
`SUPPLY_TARGET_REACHED`、`SUPPLY_COMPLETE`、`RETURN_TO_FARM`，以及
`post_supply_stage` 的 target→attack chain。這證明目前 PA path 的設計
連續性，沒有證明新 executor 的連續性。新 executor 必須重現：

```text
SUPPLY_LOW
→ STOP_LOCAL_COMBAT
→ PA service / replenishment
→ SUPPLY_TARGET_REACHED
→ RETURN_TO_FARM
→ TARGET_SELECTED
→ ATTACK_ISSUED
→ HIT
→ MONSTER_KILL
```

在此 proof chain 完成前，`SUPPLY_RETURN_PROOF = DESIGN_ONLY`。

## 5. Quest, Social and Life impact

- Quest runtime 目前在開始任務前呼叫 `stop_farm_runtime`。executor 必須先
  停止，任務 dialog、NPC、quest state 與 resume 仍由 PA/rAthena 負責。
- Social/Life 只能以 parent intent 暫停、恢復或替換 combat capability；
  combat event 是 factual observation，不得直接升格成 social encounter、
  relationship 或 diary fact。
- `CHARACTER_LIFE_DIRECTION_COMPATIBILITY = PASS`，原因是候選 executor
  只承接低階 local combat lease，PA 仍是 Life/Social 可重用的 capability
  boundary，沒有建立第二套 runtime engine。

## 6. State ownership

```text
rAthena world authority:
  HP/SP、damage、hit/miss、death、drop、inventory、position、skill legality、
  cooldown、map entity。

PA authority:
  owner/lifecycle、farm map、target policy/claim、supply/recovery、loot policy、
  navigation、quest、parent intent、social/life pause/resume、quarantine。

Candidate executor:
  combat lease、ephemeral target/action timer、action result relay。

Event Ledger:
  append-only factual projection; never writes gameplay authority.
```

## 7. Hard-gate result

```text
OPENKORE_REFERENCE_TRIGGERED = YES
OPENKORE_BEHAVIOR_COMPARED = YES
SERVER_AUTHORITY_INVARIANTS_PRESERVED = YES
REFERENCE_CONFLICT_RESOLVED = YES
GHOST_ISLAND_OPTIMIZATION_REVIEWED = YES
RESULT_EQUIVALENT_OR_BETTER = NO  # migration proof not executed
CHANGE_APPROVED = NO
CHANGE_REJECTED = YES
WORKLINE_DONE = NO  # implementation gate remains closed; design audit is complete
```

`RESULT_EQUIVALENT_OR_BETTER = NO` 是證據狀態，不代表候選設計永久淘汰。
必須先完成 bounded shadow、contract regression、supply-return proof、
quest pause/resume proof、loot exclusion proof 與 runtime single-executor
admission proof。

## 8. Staged migration plan

| Stage | Scope | Gate | Status |
| --- | --- | --- | --- |
| 0 | Contract、ownership、event schema、failure matrix | hard-gate review | DESIGN_ACCEPTED |
| 1 | Shadow observer，完全不改 action authority | event ordering and trace audit | NOT_STARTED |
| 2 | Same-map melee cadence only; PA retains target, stop, supply and loot | bounded combat parity + stop race | NOT_STARTED |
| 3 | Skill executor under explicit skill lease | cooldown/SP/effect parity | NOT_STARTED |
| 4 | Optional pickup assist only after ownership and overweight proof | loot boundary approval | NOT_STARTED |
| 5 | Any roaming, party/KS or autonomous policy | separate Project Control decision | NOT_AUTHORIZED |

## 9. Go / No-Go matrix

| Gate | Required result | Current result |
| --- | --- | --- |
| Existing PA combat preserved | YES | PASS |
| rAthena remains world authority | YES | PASS |
| OpenKore reference gate | all six YES | RESULT equivalence NO |
| Supply stop and return contract | proven | DESIGN_ONLY |
| Potion autonomy removed from executor | YES | PASS by design |
| Loot remains PA-owned | YES | PASS by design |
| Quest pause/resume | proven | NOT_EXECUTED |
| Social/Life parent intent | preserved | PASS by design |
| Single runtime / single executor | proven | NOT_EXECUTED |
| Production migration | explicitly authorized | NO |

Overall: `HYBRID_LOCAL_COMBAT_MIGRATION_RECOMMENDED = YES` as a staged design
direction only. `SAFE_TO_REPLACE = NONE_NOW`; `SAFE_WITH_CONTRACT = same-map
melee cadence and server result relay`; `KEEP_IN_PA = supply, recovery/potion,
loot policy, navigation/return, parent intent, quest, social/life`; `RESEARCH_MORE
= skills, roaming, party/kill-steal, executor failover and full parity`.
