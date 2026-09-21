# HYBRID_LOCAL_COMBAT_MIGRATION

```text
TASK_ID = PA_RATHENA_COMBAT_REPLACEMENT_IMPACT_AUDIT_V1
DESIGN_STATUS = DESIGN_ACCEPTED
PLANNING_STATE = PLANNED
IMPLEMENTATION_AUTHORIZED = NO
IMPLEMENTATION_STARTED = NO
PRODUCTION_TOUCHED = NO
RUNTIME_RESTARTED = NO
GLOBAL_AUTOLOOT = PRODUCT_ACCEPTED_DIRECTION
GLOBAL_AUTOLOOT_TO_INVENTORY = YES
GLOBAL_AUTOSTORE = NO
STAGE1_SHADOW_OBSERVER = IMPLEMENTATION_ACTIVE
STAGE2_MELEE_CANARY = BOUNDED_LIVE_PROOF_COMPLETE_NOT_PROMOTED
HYBRID_SUPPLY_RETURN_BASELINE = HYBRID_SUPPLY_RETURN_BASELINE_150069
RATHENA_AUTOCOMBAT_REFERENCE_CHECKPOINT = 961ac3c
RATHENA_MATURE_FLOOR = SAME_MAP_SERVER_SIDE_COMBAT
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
- Native source reference：`src/map/mob.cpp::mob_item_drop` 進行 drop log、
  autoloot 判定與 loot distribution；`src/map/pc.cpp::pc_additem` 是
  authoritative inventory add，會拒絕 overweight、inventory capacity 與
  item limit。這些函式目前只作 source reference，Stage 1 不改動 Production
  loot path。
- rAthena 與 OpenKore Atlas 已查核；OpenKore runtime count 為 `0`。
- `rAthena auto combat showcase` 在 reuse registry 為 `REFERENCE_ONLY`，
  license `Unknown`，license risk `BLOCKER`，不得抄碼或直接導入。
- Reference dependency checkpoint `961ac3c`：
  `docs/reference-mining/topics/rathena-server-side-autocombat.md`、
  `docs/reference-mining/rathena-autocombat-capability-matrix.yml` 與
  `docs/reference-mining/rathena-autocombat-vs-project-pa.md`。此 reference
  將成熟 floor 定義為 same-map server-side combat，涵蓋 target、retarget、
  pathing、attack、skill、buff、potion、loot、teleport、death 與 partial
  offline。分類為 `ADAPT`，reference 是 floor，不是 ceiling。
- `CROSS_MAP_SUPPLY_PUBLIC_EVIDENCE = NO_PUBLIC_EVIDENCE`、
  `RETURN_TO_FARM_MAP_PUBLIC_EVIDENCE = NO_PUBLIC_EVIDENCE`、
  `AUTO_RESUME_AFTER_SUPPLY_PUBLIC_EVIDENCE = NO_PUBLIC_EVIDENCE`。因此
  supply、cross-map navigation、service、return-to-farm、quest、social、
  parent intent 與 recovery 繼續由 PA 保留。reference 中的
  autoloot-to-storage hook 只作 public hook claim，不改變
  `GLOBAL_AUTOLOOT_TO_INVENTORY = YES` 與 `GLOBAL_AUTOSTORE = NO`。

## 2. Current responsibility matrix

| Capability | Current owner | Authoritative boundary | Candidate disposition |
| --- | --- | --- | --- |
| Farm map eligibility / map guard | PA | PA lifecycle and selected map | KEEP_IN_PA |
| Target scan, claim, lock and retarget | PA with rAthena legality checks | `battle_check_target`, mob state | SAFE_WITH_CONTRACT only |
| Approach / path and portal containment | PA orchestration, rAthena path primitives | `path.cpp`, `unit_walktobl`, map state | KEEP_IN_PA; research executor lease |
| Attack cadence / attack request | PA issues `unit_attack` | rAthena accepts or rejects action | SAFE_WITH_CONTRACT |
| Skill selection / fallback | PA policy, rAthena skill checks | `skill_check_condition_castbegin`, cooldown and SP | RESEARCH_MORE |
| Damage, hit result, death and kill | rAthena | battle/status/mob authority | SAFE_TO_REPLACE = NO, KEEP_AUTHORITY_IN_RATHENA |
| Drop resolution / global autoloot | rAthena | `mob_item_drop`, drop rules | SAFE_WITH_CONTRACT |
| Authoritative inventory add / result | rAthena | `pc_additem`, inventory delta | SAFE_WITH_CONTRACT |
| Ordinary hunting pickup orchestration | rAthena global autoloot | server drop path | SAFE_WITH_CONTRACT |
| Inventory lifecycle interpretation | PA | authoritative inventory/weight observation | KEEP_IN_PA |
| Potion choice and recovery policy | PA | rAthena item effect and cooldown | KEEP_IN_PA |
| Supply trigger, service route, replenishment | PA | rAthena shop/storage/item transaction | KEEP_IN_PA |
| Return-to-farm and resume | PA navigation and lifecycle | rAthena map/position | KEEP_IN_PA |
| Quest pause and resume | PA quest runtime | rAthena quest/NPC state | KEEP_IN_PA |
| Social / Life parent intent | Life/Social intent, PA capability | Event Ledger facts only | KEEP_IN_PA |

結論：目前沒有整個 local combat component 可直接安全替換。Stage 1 已啟動
zero-authority shadow observer。可評估的最小替換單位是「PA 已授權、同地圖、
已鎖定目標後的 melee attack cadence」，加上明確的 stop、epoch、結果事件與
失敗回收契約。ordinary hunting pickup 不再列為 PA future ownership。

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
LOOT_CANDIDATE / LOOT_ADD_REJECTED / LOOT_ACQUIRED / LOOT_SKIPPED
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

`GLOBAL_AUTOLOOT = PRODUCT_ACCEPTED_DIRECTION`。rAthena owns monster drop
resolution、global autoloot execution、authoritative inventory add 與 loot
acquisition result。PA 不再負責 ordinary hunting 的 floor-item candidate
selection、pickup ordering、走到 floor item 或 pickup orchestration。

PA 永久保留 inventory lifecycle interpretation、weight threshold、supply
decision、sell/storage policy、restock/withdraw、cross-map supply、
return-to-farm 與 parent intent。`GLOBAL_AUTOLOOT_TO_INVENTORY = YES`，
`GLOBAL_AUTOSTORE = NO`。autoloot 不得直接寫入 storage 以繞過 PA supply
lifecycle。

`DROP != ACQUIRED`。只有 authoritative inventory add 成功後才能 emit
`LOOT_ACQUIRED`，至少包含 `charId`、monster id/name where available、
`itemId`、`itemName`、`amount`、inventory delta、`combatSessionId`、
`executionEpoch`、`traceId`。inventory full、weight rejection 或 item add
failure 只能產生 `LOOT_ADD_REJECTED`，不得顯示成功拾取。

Combat Log pipeline：

```text
MONSTER_KILL
→ DROP_RESOLUTION
→ GLOBAL_AUTOLOOT
→ AUTHORITATIVE_INVENTORY_ADD
→ LOOT_ACQUIRED
→ EVENT_LEDGER
→ PLAYER_COMBAT_LOG
```

Stage 1 只定義契約，不改動 Production loot execution。

### Supply and return proof

現有 PA source 已有 `SUPPLY_LOW`、`SUPPLY_MODE_ENTER`、`SUPPLY_STARTED`、
`SUPPLY_TARGET_REACHED`、`SUPPLY_COMPLETE`、`RETURN_TO_FARM`，以及
`post_supply_stage` 的 target→attack chain。這證明目前 PA path 的設計
連續性，沒有證明新 executor 的連續性。新 executor 必須重現：

```text
MONSTER_KILL
→ DROP_RESOLUTION
→ GLOBAL_AUTOLOOT_TO_INVENTORY
→ AUTHORITATIVE_INVENTORY_ADD
→ inventory/weight observation
→ SUPPLY_REQUIRED
→ STOP_LOCAL_COMBAT
→ PA service / replenishment
→ SUPPLY_TARGET_REACHED
→ RETURN_TO_FARM
→ TARGET_SELECTED
→ ATTACK_ISSUED
→ HIT
→ MONSTER_KILL
```

在此 proof chain 完成前，`SUPPLY_RETURN_PROOF = DESIGN_ONLY`，且
`NO_SUPPLY_REGRESSION = NOT_PROVEN`。

### 4.1 Production regression fixture

`docs/fixtures/hybrid-supply-return-baseline-150069.yml` 是 Local Hunting
authority transfer 的固定 baseline。它保留 D 已驗證的 quarantine recovery、
target map restore、supply service route、Butterfly authoritative arrival、
return route、farm reentry 與 auto-resume 要求。`MONSTER_ATTACK` 只代表
attack intent；`MONSTER_HIT` 或 authoritative monster HP decrease 才能計入
命中 proof。Production baseline binary SHA256 必須保持
`A931DE99551E55A418C6B1102FC9FA75821139D6FCAA9ED1031FFA3823F3D5AF`，任何
candidate promotion 都必須先通過 `SUPERSET_CHECK` 與 `PROVENANCE_CHECK`。

Stage 2 canary 只驗證 PA 已授權同地圖 melee lease、rAthena attack cadence、
authoritative hit 與 idempotent stop。Supply、cross-map service、return route、
farm target 與 parent auto-resume 仍屬 PA，canary 通過也不代表完整 replacement
promotion。

## 5. Stage 1 shadow observer

```text
STAGE1_SHADOW_OBSERVER = IMPLEMENTATION_ACTIVE
ZERO_GAMEPLAY_AUTHORITY = YES
```

Observer 只建模 `TARGET_SCAN`、`TARGET_SELECTION`、`TARGET_REJECTION`、
`RETARGET`、`APPROACH_DECISION`、`IN_ATTACK_RANGE`、`MELEE_ATTACK_READY`。
它不移動、攻擊、施法、消耗道具、傳送、拾取、改變 target authority、PA
state 或 supply state。每個 runtime 最多輸出 64 筆 bounded observation，
不寫入 Event Ledger 或高頻資料庫。

輸入包含 char/map/coord、PA target、visible monster eligibility、range、
pathability、combat policy、execution epoch、shadow combat session id 與
trace id。輸出包含 candidate/rejected count、shadow target、approach、
attack-ready、decision reason、parity 與 mismatch class。

Stage 1 comparison classes：`PA_BETTER`、`RATHENA_BETTER`、
`POLICY_DIFFERENCE`、`REFERENCE_GAP`、`STATE_STALE`、
`PATHABILITY_DIFFERENCE`、`UNKNOWN`。observer 不自動宣稱 rAthena better。

Stage 1 bounded observer evidence：standalone comparison test covers eight
deterministic cases: target parity, approach parity, attack-ready parity,
shadow-only target, PA-only target, policy difference, stale target and
pathability difference. Canonical Release|x64 `rAthena.sln` build includes the
observer in `map-server`; no runtime or production instance was restarted.
Reference-only capabilities remain waiting: skill execution, buff, potion,
ammo, roaming/Fly Wing, party/KS and autonomous supply policy.

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
STAGE1_SHADOW_SOURCE_PASS = YES
TARGET_APPROACH_ATTACK_PARITY_MEASURED = YES  # bounded deterministic cases
RESULT_EQUIVALENT_OR_BETTER = NOT_APPLICABLE  # Stage 2 authority transfer not started
CHANGE_APPROVED = NO
CHANGE_REJECTED = YES
WORKLINE_DONE = NO  # Stage 1 observer complete; authority migration remains closed
```

`RESULT_EQUIVALENT_OR_BETTER = NO` 是證據狀態，不代表候選設計永久淘汰。
必須先完成 bounded shadow、contract regression、supply-return proof、
quest pause/resume proof、loot exclusion proof 與 runtime single-executor
admission proof。

## 8. Staged migration plan

| Stage | Scope | Gate | Status |
| --- | --- | --- | --- |
| 0 | Contract、ownership、event schema、failure matrix | hard-gate review | DESIGN_ACCEPTED |
| 1 | Shadow observer，完全不改 action authority；ordinary loot 只保留契約 | target/approach/attack parity + supply ownership | IMPLEMENTATION_ACTIVE |
| 2 | Same-map melee cadence only; PA retains target, stop, supply and parent intent | bounded combat parity + stop race + loot proof gate | NOT_STARTED |
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
| Global autoloot to inventory | YES | PRODUCT_ACCEPTED_DIRECTION |
| Global autostore | NO | FORBIDDEN |
| Loot acquisition after inventory add | proven | CONTRACT_DEFINED, PROOF_PENDING |
| Combat Log pickup display | retained | CONTRACT_DEFINED, PROOF_PENDING |
| Loot remains PA-owned | NO | ordinary pickup orchestration moved to rAthena contract |
| PA inventory/supply interpretation | YES | PASS by design |
| Quest pause/resume | proven | NOT_EXECUTED |
| Social/Life parent intent | preserved | PASS by design |
| Single runtime / single executor | proven | NOT_EXECUTED |
| Production migration | explicitly authorized | NO |

Overall: `HYBRID_LOCAL_COMBAT_MIGRATION_RECOMMENDED = YES` as a staged design
direction. `SAFE_TO_REPLACE = NONE_NOW`; `SAFE_WITH_CONTRACT = same-map melee
cadence, global autoloot-to-inventory and authoritative result relay`;
`KEEP_IN_PA = inventory lifecycle interpretation, weight threshold, supply,
recovery/potion, sell/storage policy, restock/withdraw, cross-map navigation,
return-to-farm, parent intent, quest, social/life`; `RESEARCH_MORE = skills,
roaming, party/kill-steal, executor failover, authoritative item-add proof,
Combat Log proof and supply regression proof`.
