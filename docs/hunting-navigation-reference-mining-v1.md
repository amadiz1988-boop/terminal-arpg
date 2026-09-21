# Hunting Navigation Reference Mining V1

```text
TASK_ID = HUNTING_NAVIGATION_REFERENCE_MINING_V1
MODE = READ_ONLY_REFERENCE_MINING
PROJECT_BRANCH = fix/post-exit-web-auto-v1
PROJECT_HEAD_AT_REVIEW = 7599d896b1059e54489220582b261580c93622b6
NATIVE_BRANCH_AT_REVIEW = integration/p2-openkore-exit-native-v1
NATIVE_HEAD_AT_REVIEW = ba299496c1048729216e8b4d544e875e86337b0e
OPENKORE_REFERENCE_COMMIT = 51de1ddfc4449ae5217f6886de702f87ca934030
RATHENA_ATLAS_BASELINE = e985006171d2eb320ee512a653f4c83aea3d81b6
OPENKORE_RUNTIME = 0
GAMEPLAY_SOURCE_CHANGED = NO
PRODUCTION_TOUCHED = NO
RUNTIME_RESTARTED = NO
DB_SCHEMA_TOUCHED = NO
SECOND_ROUTE_ENGINE = NO
SECOND_COMBAT_DIRECTOR = NO
```

## CONTEXT_REPORT

本回合針對 P-Journey 與 I-Combat 的狩獵修復需求，採用既有 OpenKore Atlas、rAthena Atlas、專案導航 dossier、Supply dossier、Recovery dossier、目前 PA relocation policy 與 current native source 的增量比對。Registry 查詢結果為 `registryFirst: PASS`、`researchAction: REUSE_PRIOR_RESULT`、`fullScanRetrigger: 0`。本文件只記錄可重用語義與缺口，沒有複製 forum code，也沒有建立新的 planner、navigation engine 或 combat director。

## 1. 研究基線與證據分層

| 層級 | 證據 | 用途 |
|---|---|---|
| Project current | `ops/ro-stack/persistent-agent/map-route.mjs`、`relocation-policy.mjs`、`docs/architecture/local-hunting-hybrid-architecture.md` | 目前 route、Supply、PA ownership 與 I-Combat 邊界 |
| Project Last-Good | `docs/reference-mining/topics/navigation-warp-portal-pathfinding.md`、`docs/openkore-reference/navigation.md`、`recovery.md`、`supply.md` | 已驗證的玩家結果與 bounded recovery |
| OpenKore | `src/Task/CalcMapRoute.pm`、`src/Task/MapRoute.pm`、`src/Task/Route.pm`、`src/Task/Teleport.pm`、`src/AI/CoreLogic.pm`、`src/AI/Attack.pm` | 行為參考與狀態機，不作 runtime authority |
| rAthena | `src/map/path.cpp`、`src/map/npc.cpp`、`src/map/pc.cpp`、`src/map/skill.cpp`、`src/map/party.cpp`、`src/map/unit.cpp` | 走路、轉移、技能、隊伍與角色位置的權威語義 |

OpenKore 的 Route 與 MapRoute 形成有邊界的兩層流程：同圖 collision-aware route、跨圖 map solution、portal/NPC 接近、地圖變更觀察、重新計算與 arrival tolerance。`CalcMapRoute.pm` 同時整理 portal、NPC、airship、save-map 與 item-warp 候選，候選是否可用仍須通過角色、地圖、距離、費用、冷卻與 authoritative result。`MapRoute.pm` 在當前地圖與 solution 不一致時清理 stale step、重新計算，並對 command、NPC、teleport item、missing portal 與 per-map block 採有上限的處理。參考來源：[CalcMapRoute.pm](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/src/Task/CalcMapRoute.pm)、[MapRoute.pm](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/src/Task/MapRoute.pm)、[Route.pm](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/src/Task/Route.pm)。

## 2. A 到 F，成熟參考語義

```text
OPENKORE_ROUTE_GRAPH_MODEL = 加權有向圖；地圖是節點，靜態 portal、NPC/service、item teleport、save-map 與 dungeon transition 是候選邊；每一邊仍要經過同圖路徑、前置條件與結果觀察
OPENKORE_EDGE_TYPES = static portal, one-way/scripted transfer, NPC/service, Kafra, dungeon floor portal, save-point/respawn, item teleport, learned or fallback portal candidate
OPENKORE_COST_MODEL = walk distance + route policy weight + map/edge restrictions + service fee/time + teleport cooldown/reliability；OpenKore 鎖定版本的完整數值公式未在 Atlas 中形成穩定公共契約，精確數值 = 【資料不足，無法確認】
OPENKORE_KAFRA_MODEL = 以 TalkNPC 與服務結果組成的條件式 transition；NPC reachable、dialogue sequence、費用或資格、destination 與 map result 都成立後，才把它視為可執行路線
OPENKORE_SAVEPOINT_MODEL = authoritative teleport/respawn destination；Save Point 是 route restart/terminal node，抵達 map 與位置確認後，PA 重新建立父意圖下的 route
OPENKORE_ROUTE_RECOVERY_MODEL = operation-specific timeout、repath、portal/source 暫停、per-map block、bounded retry/backoff、authoritative state reconcile；失敗需要原因與 terminal ceiling
```

### 2.1 Route graph 與 cost

目前 Project `map-route.mjs` 的 BFS 與 terminal route 可重用於 static dry-run、farm eligibility、arrival checkpoint 與 route step ceiling。它目前只解析 canonical static warp files，排除 Kafra、Warper、對話、script transfer、instance 與 item teleport。這是 coverage gap，尚未足以宣稱世界不可達。`buildRouteSteps()` 的 15 hop ceiling 與 `relocation-policy.mjs` 的 bounded coordinator budget 可作現有安全界線，不能被解讀成所有地圖的最短時間成本。

OpenKore 參考中的 cost 應保持為可替換 policy input：步行距離、map route 權重、service fee、等待時間、item cooldown、失敗歷史與 edge reliability。沒有證據支持新增單一固定權重或用 hop count 取代真實走路成本。

### 2.2 Kafra

```text
KAFRA_IS_GRAPH_EDGE = CONDITIONAL
KAFRA_PRECONDITIONS = NPC 可達、服務在該地圖存在、dialogue sequence 合法、角色在線且未被較高優先級 Supply/Quest/Recovery 中斷、費用與資格通過、destination 可由腳本接受
KAFRA_COST = 服務費 + 對話與走路時間 + edge reliability；目前專案沒有權威的通用固定數字，精確金額以 rAthena script/runtime result 為準
KAFRA_RESULT_CONFIRMATION = dialogue/service accepted + authoritative map/position change 或明確 service result；靠近 NPC 或收到 UI navigation hint 都不算成功
KAFRA_REUSE_SEAM = 現有 supplyServiceRoute、service destination selection、TALK_NPC/DIALOG_NEXT/DIALOG_MENU_SELECT、map arrival observer 與 bounded retry
```

`docs/reference-mining/topics/navigation-warp-portal-pathfinding.md` 已確認 Kafra、Warper 與 scripted transfer 不在目前 static parser 內。`relocation-policy.mjs` 已保存 Kafra save、close、Butterfly、dialogue transfer、service arrival 與 direct-to-target 的狀態形狀。下一步若施工，只需將 edge metadata 與 authoritative service result 接到既有 seam，無需建立第二個 route planner。

### 2.3 Save Point 與 Butterfly

```text
SAVEPOINT_AS_ROUTE_NODE = YES
SAVEPOINT_ROLE = terminal/restart node；死亡、Butterfly 或 recovery 的 map/cell 由 rAthena 決定，PA 以 map/cell confirmation 重新接上 parent intent
BUTTERFLY_AS_ROUTE_EDGE = CONDITIONAL
BUTTERFLY_EDGE_POLICY = Project rule: item 602 is NON_CONSUMABLE；以 inventory presence 判定可用，weight = 0，成功不扣 count
BUTTERFLY_CONFIRMATION = command accepted 之後重新讀 authoritative save-point map/cell；count 穩定是 project invariant，不能取代 arrival proof
BUTTERFLY_REUSE_SEAM = 現有 Kafra save、close NPC、item-use、save-point verification、supplyRouteBack 與 return-to-farm checkpoint
```

OpenKore 的 item-warp 候選需要 inventory presence、map policy 與 cooldown。Project 對 item 602 的非消耗規則優先於 OpenKore 的一般 item-count 假設，因此只採用觸發時機、結果確認、重試與恢復語義。`docs/openkore-reference/supply.md` 已把 Butterfly Wing -> Save Point -> service -> original farm -> target reacquisition -> combat resume 定為 Supply contract。

### 2.4 Dungeon floor 與 portal requirements

```text
DUNGEON_FLOOR_MODEL = 每個 floor 是 map node；入口、出口、floor portal、NPC/script/instance transition 是明確 edge；不使用 map-specific hardcode
PORTAL_REQUIREMENTS_MODEL = source/destination、觸發 cell、one-way、walkability、mapflag、NPC/script/service、item/skill、party/instance/quest 條件與 expected arrival
UNREACHABLE_CLASSIFICATION = NO_STATIC_EDGE, EDGE_BLOCKED, NPC_OR_SERVICE_UNAVAILABLE, CELL_UNREACHABLE, MAPFLAG_REJECTED, INSTANCE_OR_QUEST_PRECONDITION, ROUTE_TIMEOUT, ARRIVAL_NOT_CONFIRMED
REQUIRED_FLOOR_SUPPORT = moc_pryd01、moc_pryd02、pay_dun01 以 graph data 與 authority result 支援，禁止為單張地圖增加專用分支
```

`pay_dun01` 只能在 floor edge、入口腳本與 runtime arrival 都可觀察時宣稱可達。`moc_pryd01` 到 `moc_pryd02` 的判斷應透過 loaded portal/script data，沒有 edge 時回報 typed reason。靜態 graph disconnected 只能表示目前 planner coverage 不足，不能直接報告世界不可達。

### 2.5 Same-map target search、Fly Wing 與 post-teleport

```text
NO_TARGET_SEARCH_POLICY = same-map bounded scan -> bounded local movement/radius expansion -> check higher-priority Supply/Quest/Recovery -> Fly Wing candidate only when policy and cooldown pass -> authoritative map/position confirmation -> rescan
FLY_WING_TRIGGER = no legal target after configured scan and movement bound, map permits item use, safe HP/SP, no pending parent interruption, item 601 present, cooldown clear
SEARCH_BOUND = 使用既有 character policy 的 scan/radius/time/attempt bound；本文件不新增 magic constant
TELEPORT_COOLDOWN = authoritative item or skill cooldown plus last-use timestamp
ANTI_SPAM_GUARD = per-character action timer + max attempts per window + reason key dedupe + backoff + stop on unchanged map/position
POST_TELEPORT_RESCAN = YES；先確認 map/position、cooldown 與 lease，再重新讀 monster candidates，不沿用 teleport 前的 target identity
```

OpenKore `Task::Teleport`、`AI::CoreLogic` 與 `CalcMapRoute` 已提供 cooldown-aware item use、search/route teleport 與結果後重新讀 map、target、inventory 的行為參考。Project `Fly Wing = NON_CONSUMABLE` 只改變 count invariant，不改變上述 trigger、cooldown、rescan 與 bounded give-up。

### 2.6 Retarget 與 attack lifecycle

```text
RETARGET_CONDITIONS = target dead/disappeared/invalid、map changed、target claimed、target unreachable、out of range、no progress、attack timeout、MONSTER_ATTACK without MONSTER_HIT、Supply/Recovery/Death interruption
TARGET_INVALIDATION = 清除 target identity 與 pending attack，保留 parent intent，寫入 reason、attempt、next-at；重新掃描只能使用新 authoritative snapshot
ATTACK_RETRY_MODEL = 每個 target bounded attempts + cooldown/backoff + hit/damage evidence；達到 ceiling 後標記 target/edge 暫時 blocked，選下一個合法 target 或進入 no-target policy
UNREACHABLE_TARGET_HANDLING = 分類 cell path、portal/edge、lease、map mismatch、timeout；以 bounded TTL blacklist 或 source suspension 防止同一失敗重播
COMBAT_EVIDENCE = MONSTER_ATTACK 表示攻擊嘗試；只有 MONSTER_HIT 才能證明 authoritative damage，MONSTER_KILL 與 LOOT_ACQUIRED 才能完成後段鏈
```

目前 architecture 已把 PA 的 target authority、parent intent、interruption、resume 與 rAthena local hunting executor 分開。I-Combat 可重用 target scan/lock、target claim、attack/hit Event Ledger、lease/epoch 與 bounded reset；不要把 cross-map route、Supply 或 Save Point 行為搬進 local combat executor。

## 3. P-Journey 與 I-Combat 對照矩陣

| CAPABILITY | CURRENT PROJECT | OPENKORE/RATHENA REFERENCE | GAP | REUSE SEAM | OWNER |
|---|---|---|---|---|---|
| Cross-map route planning | `map-route.mjs` static BFS、terminal route、step ceiling | `CalcMapRoute` + `MapRoute` weighted candidates and replan | NPC/service/item/instance edge metadata absent | existing map graph, relocation policy, arrival checkpoint | P-Journey |
| Portal graph | static warp parser from loaded scripts | `%portals_lut`, portal source suspension, rAthena warp/script authority | scripted and learned edges excluded | `buildWarpGraph`, typed edge adapter | P-Journey |
| Route cost | hop count and bounded budget | walk distance, route policy, edge/service cost, time and reliability | no common cost contract | current route step count as safety bound only | P-Journey |
| Kafra | service route and dialogue step shape in relocation policy | TalkNPC/service transition with fee, permission and result | full runtime acceptance and typed failure projection partial | `supplyServiceRoute`, dialogue handlers, map observer | P-Journey |
| SavePoint | save-point read and verification seam | respawn/save-map result is authoritative | route node typing not yet generalized | `VERIFY_SAVEPOINT`, recovery resume | P-Journey |
| Butterfly Wing | item 602 non-consumable contract, Supply Out migration target | item-warp candidate with presence/cooldown and map result | primary live supply-out closure pending | item use, save verification, Supply Back | P-Journey |
| Dungeon floor | generic static map graph can carry maps | floor maps plus portal/script/instance requirements | no typed floor/edge requirement model | same graph and arrival observer | P-Journey |
| Route recovery | bounded route abort, three-failure supply backoff, resume | MapRoute repath, missing portal suspension, per-map block, timeout | typed reason and edge TTL not uniform | recovery reason/attempt/backoff contract | P-Journey |
| Blacklist/source suspension | partial route failure and no-direct-route | missing portal removal/re-add and no-go/no-warp buckets | shared typed blacklist absent | bounded failure bucket and next-at | P-Journey |
| Same-map target search | target scan and local hunting boundary | attack/search loop, lock map and target drop | Fly Wing no-target policy not generalized | target scan, parent interruption, Event Ledger | I-Combat with P-Journey trigger |
| Fly Wing search | item 601 native effect; roaming not production-complete | cooldown-aware teleport/search, post-result re-read | trigger, anti-spam and rescan contract incomplete | item use, state observer, target reacquire | I-Combat/P-Journey |
| Retarget | target authority and target lock exist | Attack drops invalid/dead/hidden target and reacquires | reason taxonomy and no-progress ceiling partial | target invalidation, claim, epoch, event ledger | I-Combat |
| Attack retry | native attack/hit evidence and bounded stop | attack retry with target loss and route reset | per-target retry reason projection partial | `MONSTER_ATTACK`/`MONSTER_HIT`, bounded executor | I-Combat |
| Kafra supply return | `supplyRouteBack` and service route exist | Supply service stages and authoritative transaction | Butterfly primary out still migration target | Supply contract and existing route back | P-Journey |

## 4. Reuse decision

```text
P_JOURNEY_REUSE_RECOMMENDATION = ADAPT existing static graph, relocation policy, service route, Save Point verification, route arrival and bounded recovery. Add typed edge metadata and result reasons only at the existing seam.
I_COMBAT_REUSE_RECOMMENDATION = ADAPT existing target scan, target claim/lock, local executor lease, attack/hit Event Ledger and bounded reset. Add no-target Fly Wing trigger and retarget/attack reason projection at the existing seam.
CAPABILITIES_ALREADY_PRESENT = static route feasibility, terminal route, farm target ownership, map arrival checkpoint, Supply service route, Supply Back, Save Point read, target scan/lock, attack/hit evidence, bounded retry/stop, Event Ledger vocabulary
CAPABILITIES_MISSING = typed service/Kafra/dungeon edge registry, shared route cost/reliability contract, typed unreachable classification, Fly Wing no-target rescan policy, per-target retry/blacklist reason projection
INTEGRATION_GAPS = planner-to-authority edge confirmation, map arrival to route continuation, item use to no-target search, target invalidation to attack retry and Event Ledger, Supply Out primary Butterfly closure
SECOND_ROUTE_ENGINE_REQUIRED = NO
SECOND_COMBAT_DIRECTOR_REQUIRED = NO
```

### 4.1 OpenKore behavior mapping

| 行為 | OpenKore 參考 | Current Ghost Island | 判定 |
|---|---|---|---|
| Cross-map route | MapRoute consumes a map solution, walks to a portal/NPC, waits for map change, then recalculates | PA owns destination and rAthena owns movement and arrival; static map graph is current input | ADAPT |
| Missing portal | Suspend source, recompute, bounded restore or alternative | Current route failure is bounded, typed source suspension is incomplete | ADAPT |
| Kafra/service | TalkNPC sequence plus fee/result checks | Existing supply/dialogue seam with rAthena script authority | ADAPT |
| Save point | Teleport/respawn result followed by map and mode reconciliation | Save Point verification and Supply resume contract | ADAPT |
| Butterfly/Fly Wing | Item presence, cooldown, route/search reason, map result | Preserve trigger and result semantics; apply project non-consumable rule | ADAPT |
| Retarget/attack | Drop stale target, retry within ceiling, reacquire from fresh state | Target authority, lease and Event Ledger exist; reason taxonomy still partial | ADAPT |

```text
OPENKORE_REFERENCE_REQUIRED = YES
OPENKORE_REFERENCE_TRIGGERED = YES
OPENKORE_ATLAS_TOPIC = ROUTING, FIELD_PORTAL_TABLES, KAFRA, SUPPLY_AUTOMATION, TELEPORT, BUTTERFLY_WING, MONSTER_TARGETING, TIMEOUT_RETRY_BACKOFF
OPENKORE_ATLAS_SEARCHED = YES
RATHENA_ATLAS_SEARCHED = YES
AUTHORITATIVE_SOURCE_CHECKED = YES
PROJECT_LAST_GOOD_CHECKED = YES
OPENKORE_MATURE_BEHAVIOR_CHECKED = YES
RATHENA_AUTHORITY_CHECKED = YES
CURRENT_PA_CHECKED = YES
REFERENCE_GAP = NOT_CONFIRMED
REFERENCE_MINING_GAP = YES for typed edge taxonomy and integrated Fly Wing search; NO for the mature route/retry baseline
REFERENCE_IS_FLOOR_NOT_CEILING = YES
FINAL_DESIGN_CENTER = PA / SERVER_AGENT
REUSE_CLASSIFICATION = ADAPT
OPENKORE_REFERENCE_INHERITED = YES
REFERENCE_CONFLICT = YES only for item consumption semantics; resolved by project NON_CONSUMABLE rule
REFERENCE_CONFLICT_RESOLVED = YES
SERVER_AUTHORITY_INVARIANTS_PRESERVED = YES
```

## 5. Optimization and acceptance boundary

```text
GHOST_ISLAND_OPTIMIZATION_REVIEWED = YES
OPTIMIZATION_APPLIED = NO_NOT_NEEDED
OPTIMIZATION_REASON = 既有 PA/rAthena split 已保留 server authority、intent persistence、event evidence 與 duplicate control；本回合只需接 seam，重寫 planner 或 combat director 會擴大 regression surface
WHAT_WE_KEEP = bounded route/retry, parent intent, map arrival proof, target authority, MONSTER_HIT semantics, Supply contract
WHAT_WE_ADAPT = OpenKore route candidates、Kafra/save-point/item timing、missing portal suspension、retarget and retry evidence
WHAT_WE_REMOVE_AS_LEGACY_TRANSPORT = client path replay、盲目 random walking、HTTP accepted as arrival、OpenKore runtime dependency
SERVER_AUTHORITY_IMPROVEMENT = rAthena owns map, position, item, NPC, skill and damage result
RECOVERY_IMPROVEMENT = reasoned retry, backoff, state reconcile, safe idle
SCALABILITY_IMPROVEMENT = bounded windows and per-character action keys
LATENCY_IMPROVEMENT = same-map local executor remains local; cross-map only enters PA route flow
MAINTAINABILITY_IMPROVEMENT = reuse existing route, Supply and combat seams
SINGLE_AUTHORITY_IMPROVEMENT = no Dashboard or runner state mutation
NEW_RISKS = stale portal metadata, unsupported script edge, false arrival, duplicate item action
ROLLBACK_PATH = no source change; discard this documentation commit only
```

This is a reference-only gate. It does not prove current live behavior. `HTTP 200`、queued command、`navigateto`、static route list 或 `MONSTER_ATTACK` alone remain insufficient. Player-flow equivalence requires authoritative map/position, inventory/fee, target reacquisition, `MONSTER_HIT`, `MONSTER_KILL` and loot evidence where the scenario requires them.

## 6. Registry and license gate

```text
REGISTRY_FIRST = PASS
NATIVE_PRIMITIVE_FIRST = PASS
FRESHNESS_POLICY = PASS for existing rAthena and OpenKore locked entries
LICENSE_GATE = PASS for REFERENCE_ONLY / ADAPT evaluation
OPENKORE_LICENSE = GPL-2.0 source headers; no OpenKore runtime adoption
RATHENA_LICENSE = GPL-3.0 project core; use existing native source lineage
FORUM_CODE_COPIED = NO
REGISTRY_WRITEBACK = NOT_REQUIRED; this increment adds no changed candidate fact or dependency adoption
FULL_SCAN_RETRIGGER = 0
PRE_IMPLEMENTATION_REUSE_GATE = NOT_REQUIRED for DOC_ONLY, with reuse evidence recorded
OPENKORE_ACCEPTANCE_MODE = PASS, behavior contract only
```

Primary source links:

- [OpenKore CalcMapRoute.pm at locked reference](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/src/Task/CalcMapRoute.pm)
- [OpenKore MapRoute.pm at locked reference](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/src/Task/MapRoute.pm)
- [OpenKore Teleport.pm at locked reference](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/src/Task/Teleport.pm)
- [OpenKore CoreLogic.pm at locked reference](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/src/AI/CoreLogic.pm)
- [OpenKore Attack.pm](https://github.com/OpenKore/openkore/blob/51de1ddfc4449ae5217f6886de702f87ca934030/src/AI/Attack.pm)
- [rAthena pathfinding](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/path.cpp)
- [rAthena NPC/script authority](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/npc.cpp)
- [rAthena character movement and respawn](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/pc.cpp)
- [rAthena skill and status authority](https://github.com/rathena/rathena/blob/e985006171d2eb320ee512a653f4c83aea3d81b6/src/map/skill.cpp)

## 7. Required final fields

```text
OPENKORE_ROUTE_GRAPH_MODEL = weighted directed map graph with portal, service, save-point and item candidates; each edge requires local route and authoritative confirmation
OPENKORE_EDGE_TYPES = static portal, scripted/one-way, NPC/service/Kafra, dungeon floor, save-point/respawn, item teleport, learned/fallback candidate
OPENKORE_COST_MODEL = distance + policy weight + restrictions + service/time/reliability; exact locked numeric formula = 【資料不足，無法確認】
KAFRA_IS_GRAPH_EDGE = CONDITIONAL
KAFRA_REUSE_SEAM = existing service route, dialogue executor, result observer and bounded recovery
SAVEPOINT_AS_ROUTE_NODE = YES
BUTTERFLY_AS_ROUTE_EDGE = CONDITIONAL, project item 602 non-consumable and presence-based
DUNGEON_FLOOR_MODEL = data-driven map nodes and requirement-bearing floor edges
NO_TARGET_SEARCH_POLICY = bounded scan, bounded local movement, Fly Wing only under policy, authoritative result, fresh rescan
FLY_WING_TRIGGER = no legal target after bound plus safe state, no higher interruption, item present, cooldown clear
ANTI_SPAM_GUARD = per-character timer, reason dedupe, attempt/window ceiling and backoff
POST_TELEPORT_RESCAN = YES
RETARGET_CONDITIONS = stale/dead/invalid/unreachable/out-of-range/no-progress/timeout/map-change/interruption
ATTACK_RETRY_MODEL = bounded per-target retry with cooldown/backoff, MONSTER_HIT evidence, then retarget or safe pause
P_JOURNEY_REUSE_RECOMMENDATION = reuse map-route, relocation policy, Supply service/save-point/arrival seams; adapt typed edge metadata only
I_COMBAT_REUSE_RECOMMENDATION = reuse target authority, local executor, lease/epoch and Event Ledger; adapt no-target and retry reasons only
CAPABILITIES_ALREADY_PRESENT = static feasibility, arrival, Supply Back, target scan/lock, attack/hit evidence, bounded recovery
CAPABILITIES_MISSING = typed edge taxonomy, route cost/reliability, Fly Wing search/rescan, unified target retry reason projection
INTEGRATION_GAPS = planner-authority confirmation, map arrival continuation, item-use rescan, target invalidation to retry events, primary Butterfly Supply Out closure
SECOND_ROUTE_ENGINE_REQUIRED = NO
SECOND_COMBAT_DIRECTOR_REQUIRED = NO
OPENKORE_RUNTIME_REQUIRED = NO
SOURCE_CHANGED = NO
PRODUCTION_TOUCHED = NO
FILES_CHANGED = docs/hunting-navigation-reference-mining-v1.md
VALIDATION = Markdown review, required-field review, forbidden-phrase scan, git diff check
GIT_CHECKPOINT = pending at document creation, exact file only
READY_FOR_NEXT = YES for bounded seam implementation planning; live runtime acceptance remains separate
CONTEXT_REPORT = incremental reference mining complete; no gameplay semantics or runtime state changed
```

## 8. OpenKore core alignment veto

```text
DID_WE_TRIGGER_OPENKORE_REFERENCE = YES
DID_WE_COMPARE_OPENKORE_AND_CURRENT_BEHAVIOR = YES
DID_WE_PRESERVE_SERVER_AUTHORITY = YES
DID_WE_RESOLVE_REFERENCE_CONFLICT = YES
DID_WE_REVIEW_GHOST_ISLAND_OPTIMIZATION = YES
IS_RESULT_PROVEN_EQUIVALENT_OR_BETTER = NO, this is reference mining and no live player-flow run was authorized
OPENKORE_CORE_ALIGNMENT_VETO = FAIL for implementation acceptance; PASS for DOC_ONLY research completion
CHANGE_APPROVED = NO source change requested
CHANGE_REJECTED = NO, documentation-only scope completed
WORKLINE_DONE = YES
```
