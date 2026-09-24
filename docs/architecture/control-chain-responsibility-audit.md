# Control Chain Responsibility Audit V1

## Audit metadata

```text
TASK_ID = ARCHITECTURE_CONTROL_CHAIN_RESPONSIBILITY_AUDIT_V1
AUDIT_MODE = READ_ONLY_SOURCE_AND_REFERENCE_AUDIT
AUDIT_DATE = 2026-09-20
CANONICAL_WEB_SOURCE = C:\Users\Administrator\.codex\.chatgpt-projects\g-p-6a9bcb57afdc8191966436643af8acdf\terminal-arpg
CANONICAL_NATIVE_SOURCE = C:\Users\Administrator\source\ghost-island-rathena
PRODUCTION_TOUCHED = NO
GAMEPLAY_CHANGED = NO
RUNTIME_RESTARTED = NO
SYNTHETIC_FIRST_TRIGGERED = YES
LIVE_SYNTHETIC_RUN = DEFERRED
```

本文件是責任邊界審查，範圍限定為架構證據與責任歸屬，不包含重構施工，也不構成 live acceptance。證據採用目前 source、rAthena Atlas、OpenKore reference Atlas、Project Last-Good 與既有 trace foundation。已知 `char_id=150075` 的 `HTTP 409 supply_route_unavailable` 取自既有 bounded trace fixture；本輪未重新送出 live mutation。

## 1. 結論摘要

### Current high-level chain

```text
Player Web
  -> Dashboard HTTP/session/auth/ownership/bounded payload validation
  -> Dashboard command bridge
  -> persistent_agent_command
  -> Native Persistent Agent command contract
  -> PA orchestration and runtime state
  -> rAthena authoritative world state
  -> persistent_life_event / live-status read model
  -> Dashboard projection / Event Ledger observation
```

### Target high-level chain

```text
Player Web intent
  -> Dashboard auth, ownership, bounded input validation, command bridge
  -> PA gameplay orchestration, navigation, combat, supply, recovery, quest execution
  -> rAthena world authority
  -> Event Ledger, Action Trace, RUM and Admin observation only
```

### Overall verdict

架構的主責任分工大致成立。過度複雜度集中在 Dashboard 的 `start_farm` 跨層前置決策：它在建立當前農場命令前，先知道供給服務地圖、服務座標、Save Point 路線與出入路線。這使未來供給能力成為當前 Start 的命令建立前置條件。此處是本審查的主要 `MOVE_TO_PA` 與高風險項目。

`rAthena` 仍是地圖、位置、物品、傷害、死亡、任務與世界互動的 authority。`Event Ledger`、live-status 與 Web projection 在已核對路徑中屬於讀取與投影責任，未發現已證實的反向 gameplay execution coupling。

## 2. Evidence provenance

| Evidence | Confirmed responsibility | Key location |
|---|---|---|
| Dashboard Web canary | Browser sends `start`/`stop`; Dashboard resolves target and queues command | `ops/ro-stack/dashboard.mjs:2403-2455` |
| Farm eligibility | Map is farmable when canonical map metadata contains monster spawn | `ops/ro-stack/dashboard.mjs:419-436` |
| Supply topology | Dashboard owns configured service map `prt_fild05`, service cell and route payload assembly | `ops/ro-stack/dashboard.mjs:406-417`, `3255-3293` |
| Ownership and payload boundary | Dashboard checks account ownership, rollout, revision, command id and bounded payload shape | `ops/ro-stack/dashboard.mjs:3006-3044`, `3050-3205` |
| Native farm authority | Native requires resident idle character and target map equal to authoritative current map before activation | `src/map/persistent_agent.cpp:5001-5049`, `2755-2849` |
| Native command dispatch | Native validates payload before action dispatch, then routes `start_farm`, `stop_farm`, item and quest commands | `src/map/persistent_agent.cpp:6354-6422` |
| Native supply runtime | PA stores and consumes outbound, service and return route legs in its runtime state | `src/map/persistent_agent.cpp:345-405`, `2834-2841` |
| Event Ledger projection | Native facts are converted into bounded Web observation lines; no OpenKore log is used | `ops/ro-stack/web-observation.mjs:715-729`, `754-792` |
| Event endpoint | `/api/events` refreshes bounded projection and reads live status; it does not queue gameplay commands | `ops/ro-stack/dashboard.mjs:10184-10235` |
| OpenKore reference | OpenKore is reference evidence only, runtime count remains zero | `docs/openkore-reference/reference-index.yml:1-17` |
| rAthena authority | Map, path, savepoint, item, combat, loot, quest and recovery authority is in native rAthena source | `docs/rathena-reference/reference-index.yml` topics 05, 06, 08, 10, 14, 16, 30, 32 |
| Existing trace fixture | Historical bounded trace stops at Controller pre-command failure for `char_id=150075` | `docs/player-action-trace-foundation.md:1-41` |

## 3. Responsibility type matrix

| Responsibility | Player Web | Dashboard / Controller | PA / Native controller | rAthena | Ledger / projection |
|---|---|---|---|---|---|
| `PLAYER_INTENT` | collect map, start/stop, item and quest intent | normalize intent into command | consume command | apply legal world result | observe |
| `AUTHENTICATION` | session presentation | owns session/auth checks | receives authenticated command | owns account/character world context | none |
| `OWNERSHIP` | no authority | account-to-character check and rollout gate | persistent ownership transition | authoritative character entity | observe |
| `INPUT_VALIDATION` | presentation constraints | bounded shape, id, revision and field validation | payload contract revalidation | semantic and world legality | none |
| `PRODUCT_POLICY` | display eligibility | farm-map visibility/farmable projection | policy-compatible execution | world rules | display only |
| `GAMEPLAY_ORCHESTRATION` | none | currently partial for relocation and supply route pre-resolution | should own all runtime orchestration | resolves world effects | none |
| `NAVIGATION` | none | currently plans/coordinator for some Web relocation | executes route, retry, arrival and recovery | owns movement, warp and map change | observes map change |
| `COMBAT_AI` | none | none | target, attack loop, hit/kill/loot resume | damage and death authority | observes event facts |
| `SUPPLY_AI` | none | currently resolves service topology and route payload | executes supply substates and route legs | shop, inventory and savepoint authority | observes supply events |
| `QUEST_SEMANTICS` | submits bounded intent | validates command shape and rollout | phase/task execution | quest/NPC/dialogue/world mutation | observes phase events |
| `WORLD_AUTHORITY` | none | none | requests | rAthena | projects |
| `STATE_PROJECTION` | renders | reads live-status/event rows | writes runtime/read-model facts | source facts | owns presentation projection only |
| `OBSERVABILITY` | UI display | `/api/events`, live position, RUM | emits facts | persists factual state/events | read-only |
| `ERROR_CORRELATION` | displays error | HTTP/controller/command ids | native reason and revision | authoritative rejection reason | trace/event correlation gap remains |
| `PERSISTENCE` | none | command row and read model access | runtime/session/event writes | character/world persistence | read model |

## 4. Flow audits

### 4.1 START_FARM

**Observed chain**

```text
Web start
 -> queueCanaryAutomation
 -> farmMapEligibility and fresh live map check
 -> same-map direct command or relocation coordinator
 -> queueOwnershipCommand
 -> optional supply service/out/back route resolution
 -> persistent_agent_command
 -> Native pa_contract and process_start_farm
 -> activate_farm_runtime
 -> AUTO_FARM state and FARM_SESSION_STARTED
```

| Field | Finding |
|---|---|
| `CURRENT_RESPONSIBILITY` | Web expresses start intent. Dashboard checks auth, ownership, rollout, farmability, live position and payload shape. It may resolve relocation and future supply route. PA validates command and starts AUTO_FARM. |
| `ACTUAL_AUTHORITY` | rAthena/Native PA owns current map, resident state, farm activation, target scan and session state. |
| `INPUT` | Map-only farm target plus loot, skill, survival and death-recovery flags. Browser does not select mob. |
| `OUTPUT` | Queued command, `AUTO_FARM` runtime state, authoritative farm session event and live-status projection. |
| `NECESSARY_VALIDATION` | Session/auth, character ownership, rollout, revision, command id, bounded map/flag/skill fields, Native payload contract and authoritative same-map/resident checks. |
| `GAMEPLAY_ORCHESTRATION` | Dashboard currently performs cross-map decision and may precompute supply legs before current start command exists. PA performs the actual farm lifecycle. |
| `STATE_OWNERSHIP` | PA/rAthena owns `AUTO_FARM`, target and farm session. Dashboard owns only command/read-model rows. |
| `DUPLICATED_WITH` | Dashboard bounded shape validation and Native `pa_contract` validation are duplicated by design at a trust boundary. This is intentional defense in depth. |
| `LEAKED_RESPONSIBILITY` | Future supply-route availability can block the present start command in `queueOwnershipCommand` when the skip flag is false. |
| `WHY_LAYER_EXISTS` | Dashboard bridge provides authenticated, idempotent command transport and safe user-facing blockers. Native enforces world legality. |
| `FAILURE_MODE_IF_REMOVED` | Removing Dashboard auth/ownership checks permits unauthorized commands. Removing Native checks permits invalid world transitions. Removing supply pre-resolution would require PA to resolve or reject its own future supply plan. |

**Known failure and current-source qualification**

The existing bounded trace records `char_id=150075` as `HTTP 409 supply_route_unavailable`, controller rejection before command creation and Native not reached. That confirms a historical Controller-to-Command break. Current source also contains an explicit same-map bypass at `queueCanaryAutomation:2426-2449`; therefore the statement “every same-map start currently hits the supply precheck” is not proven by source alone. Whether the bypass is active for that character requires a live synthetic run and remains `UNKNOWN_NEEDS_EVIDENCE` under this read-only audit.

**Verdict:** `MOVE_TO_PA`, risk `HIGH` for the supply pre-resolution coupling. Same-map direct start path is otherwise a valid bounded simplification. `FIRST_BROKEN_TRANSITION` for the existing fixture: `Controller -> Command creation`.

### 4.2 STOP_FARM

| Field | Finding |
|---|---|
| `CURRENT_RESPONSIBILITY` | Dashboard accepts stop intent and queues `stop_farm`; Native dispatches `process_stop_farm`; runtime is stopped and farm session closes. |
| `ACTUAL_AUTHORITY` | Native PA/rAthena runtime state. |
| `INPUT` | Authenticated character, expected revision and stop action. |
| `OUTPUT` | Stopped runtime, persisted session boundary and projection. |
| `NECESSARY_VALIDATION` | Ownership, action allowlist, revision, active-mode transition and Native payload contract. |
| `GAMEPLAY_ORCHESTRATION` | Native only. |
| `STATE_OWNERSHIP` | PA runtime and rAthena. |
| `DUPLICATED_WITH` | Shape validation at Dashboard and Native boundary, intentional. |
| `LEAKED_RESPONSIBILITY` | None confirmed. |
| `WHY_LAYER_EXISTS` | Stop is a player intent and must pass the same authenticated command bridge. |
| `FAILURE_MODE_IF_REMOVED` | Removing Native transition checks could stop an unrelated or inactive runtime. |

**Verdict:** `KEEP`, risk `LOW`.

### 4.3 CHANGE_FARM_MAP

The audit separates three predicates:

| Predicate | Current source | Correct owner | Verdict |
|---|---|---|---|
| `farmEligible` | Dashboard `farmMapEligibility` counts canonical monster spawn metadata | Product policy/read-model gate, with Native semantic recheck | `SAFE_SIMPLIFICATION` if exposed separately from route result |
| `relocationSupported` | Dashboard relocation policy selects direct, hub, Butterfly and Kafra transfer policy | PA capability contract; Dashboard may display a pure plan | `MOVE_TO_PA` for execution decision, `KEEP` for pure read-only plan |
| `routeFound` | Dashboard graph/planner produces route and may coordinate stages | PA/native navigation execution; rAthena confirms arrival | `MOVE_TO_PA` for runtime orchestration |

| Field | Finding |
|---|---|
| `CURRENT_RESPONSIBILITY` | Web selects map. Dashboard reports eligibility and currently coordinates cross-map relocation. Native executes route and only accepts `start_farm` on the target map. |
| `ACTUAL_AUTHORITY` | rAthena owns position, warp and arrival. PA owns navigation lifecycle and farm resume. |
| `INPUT` | `charId`, source/current map, target map and execute/dry-run intent. |
| `OUTPUT` | Eligibility, policy, route steps, arrival and farm target/resume state. |
| `NECESSARY_VALIDATION` | Ownership, target map syntax, farmability, fresh current position, route bounds and authoritative arrival. |
| `GAMEPLAY_ORCHESTRATION` | Dashboard `queueServerAgentRelocation` coordinates STOP, navigation, arrival and START. Native remains executor. |
| `STATE_OWNERSHIP` | PA/rAthena owns movement and farm state; Dashboard owns plan/projection. |
| `DUPLICATED_WITH` | Farmability and route feasibility are currently presented through adjacent Web checks, which can be conflated by a single error surface. |
| `LEAKED_RESPONSIBILITY` | Dashboard controls a multi-stage gameplay coordinator instead of submitting one relocation intent. |
| `WHY_LAYER_EXISTS` | Current Web integration restores a bounded W4 coordinator and preserves player-selected target. |
| `FAILURE_MODE_IF_REMOVED` | Removing the coordinator without a PA replacement loses cross-map start behavior. Removing the route distinction causes UI/backend mismatch. |

**Verdict:** Separate `farmEligible`, `relocationSupported` and `routeFound` in the contract now. Move runtime orchestration to PA only after an equivalent PA command/observation contract exists. Risk `HIGH` for direct migration, `LOW` for response-shape clarification.

### 4.4 SUPPLY / SUPPLY_RETURN

**Observed intended chain**

```text
AUTO_FARM -> SUPPLY_LOW -> combat pause -> Butterfly/savepoint or service route
-> rAthena shop/inventory transaction -> route back -> target reacquire -> combat
```

| Field | Finding |
|---|---|
| `CURRENT_RESPONSIBILITY` | Dashboard knows fixed service map/cell and resolves `supplyServiceRoute`, `supplyRouteOut` and `supplyRouteBack` into `start_farm`. Native PA stores these legs and executes supply substates. rAthena owns savepoint, movement, shop and inventory effects. |
| `ACTUAL_AUTHORITY` | rAthena for map, savepoint, inventory, Zeny, shop and item use. PA for supply lifecycle and resumption. |
| `INPUT` | Player farm intent plus inventory/supply policy. Current command may contain precomputed route legs. |
| `OUTPUT` | Supply pause, service transaction, return, target reacquisition and combat events. |
| `NECESSARY_VALIDATION` | Ownership, route shape, item identity, inventory generation, authoritative inventory/Zeny/shop and arrival checks. |
| `GAMEPLAY_ORCHESTRATION` | Dashboard precomputes future supply topology. PA executes supplied legs and supply state machine. |
| `STATE_OWNERSHIP` | PA supply substate; rAthena inventory/savepoint/shop; Dashboard projection only. |
| `DUPLICATED_WITH` | Dashboard route validity and Native route parsing are separate trust-boundary checks. |
| `LEAKED_RESPONSIBILITY` | Service topology and future route availability are coupled to current `start_farm` command creation. |
| `WHY_LAYER_EXISTS` | Gate3 contract currently delivers controller-resolved legs to Native and preserves deterministic route behavior. |
| `FAILURE_MODE_IF_REMOVED` | Removing the Web resolver without a PA resolver leaves Native without required route inputs under the current contract. |

**Verdict:** `MOVE_TO_PA`, risk `HIGH`. Preserve rAthena transaction authority and the PA supply state machine. Dashboard should eventually submit supply policy/intent and observe a PA-resolved plan, allowing a current farm start to succeed when a future supply attempt is not yet required. `/api/supply-cycle` currently fails closed for SERVER_AGENT with `CAPABILITY_NOT_NATIVE`; this is a capability boundary, not a supply authority.

### 4.5 FLY_WING

| Field | Finding |
|---|---|
| `CURRENT_RESPONSIBILITY` | Dashboard `/api/item-action` validates item identity and queues `use_item`; PA/native executes intent; rAthena applies item semantics and position change. |
| `ACTUAL_AUTHORITY` | rAthena item database, inventory and map position. |
| `INPUT` | Canonical item id, inventory index and generation. Project policy treats item 601 as non-consumable. |
| `OUTPUT` | Accepted/rejected command, authoritative position and unchanged count under the project policy. |
| `NECESSARY_VALIDATION` | Ownership, identity/generation and rAthena item/use legality. |
| `GAMEPLAY_ORCHESTRATION` | PA may use the item inside relocation/hunt behavior; Dashboard does not decide destination. |
| `STATE_OWNERSHIP` | rAthena inventory/position; PA intent and recovery state. |
| `DUPLICATED_WITH` | Input shape is checked at Web and Native contract boundaries. |
| `LEAKED_RESPONSIBILITY` | None confirmed. |
| `WHY_LAYER_EXISTS` | Web needs a safe intent bridge; server must retain item authority. |
| `FAILURE_MODE_IF_REMOVED` | Accepting a client count or position would violate world authority. |

**Verdict:** `KEEP`, risk `MEDIUM` because roaming semantics remain a documented research gap. Command acceptance alone is insufficient; position change and authoritative count must be observed.

### 4.6 BUTTERFLY_WING

| Field | Finding |
|---|---|
| `CURRENT_RESPONSIBILITY` | Same item-intent bridge as Fly Wing. PA uses item 602 in return-to-savepoint policy. rAthena confirms savepoint and position. |
| `ACTUAL_AUTHORITY` | rAthena savepoint, item and map transition. |
| `INPUT` | Canonical item identity and inventory generation; project policy treats item 602 as non-consumable. |
| `OUTPUT` | SavePoint return, authoritative map/position and unchanged count under project policy. |
| `NECESSARY_VALIDATION` | Identity/generation, item legality, savepoint and authoritative map confirmation. |
| `GAMEPLAY_ORCHESTRATION` | PA relocation and supply return state. |
| `STATE_OWNERSHIP` | rAthena savepoint/position/inventory; PA relocation stage. |
| `DUPLICATED_WITH` | Web and Native shape checks only. |
| `LEAKED_RESPONSIBILITY` | None confirmed. |
| `WHY_LAYER_EXISTS` | Player intent and PA return behavior need distinct layers. |
| `FAILURE_MODE_IF_REMOVED` | Local Web success without savepoint confirmation would create false supply recovery. |

**Verdict:** `KEEP`, risk `MEDIUM`; primary-out acceptance is still separate from the historical contract and must not be inferred from a queued command.

### 4.7 COMBAT

| Field | Finding |
|---|---|
| `CURRENT_RESPONSIBILITY` | PA scans/selects/retargets, attacks, recovers and resumes loot. rAthena calculates damage, death and drops. Event Ledger persists factual transitions. Dashboard renders them. |
| `ACTUAL_AUTHORITY` | rAthena battle, mob death and drop systems; PA controls intent/lifecycle. |
| `INPUT` | Farm map and capability flags; no browser-selected mob for AUTO_FARM. |
| `OUTPUT` | `MONSTER_TARGET`, `MONSTER_ATTACK`, `MONSTER_HIT`, `MONSTER_KILL`, `LOOT_ACQUIRED`, inventory change. |
| `NECESSARY_VALIDATION` | Target legality, server combat rules, damage confirmation and inventory authority. |
| `GAMEPLAY_ORCHESTRATION` | PA only. Dashboard observes. |
| `STATE_OWNERSHIP` | PA target/runtime; rAthena HP/damage/death/loot/inventory; projection reads. |
| `DUPLICATED_WITH` | Event rendering maps native facts to Web lines; it does not create combat facts. |
| `LEAKED_RESPONSIBILITY` | None confirmed. |
| `WHY_LAYER_EXISTS` | Event projection preserves presentation compatibility without a second combat engine. |
| `FAILURE_MODE_IF_REMOVED` | Treating `MONSTER_ATTACK` as damage would produce false hit evidence. |

**Verdict:** `KEEP`, risk `LOW`. `MONSTER_ATTACK` is not damage confirmation; only `MONSTER_HIT` proves authoritative damage.

### 4.8 QUEST

| Field | Finding |
|---|---|
| `CURRENT_RESPONSIBILITY` | Dashboard authenticates, applies rollout and bounded task/sequence payload validation. Quest Runtime/PA executes phase/task orchestration. rAthena NPC, quest state, item, combat and job systems remain authoritative. Event log and Web projection observe. |
| `ACTUAL_AUTHORITY` | rAthena quest/NPC/world state; PA owns execution phase and retry lifecycle. |
| `INPUT` | Bounded task/quest/sequence intent, NPC/map/objective fields and allowed steps. |
| `OUTPUT` | Authoritative quest state changes, phase events, rewards and projected status. |
| `NECESSARY_VALIDATION` | Ownership, rollout, bounded sequence depth/count/deadline, Native contract and authoritative quest checks. |
| `GAMEPLAY_ORCHESTRATION` | PA Quest Runtime. Dashboard has payload normalization but no confirmed world mutation. |
| `STATE_OWNERSHIP` | rAthena quest state; PA `web_quest_runtime` phase/revision as execution state; Web projection read-only. |
| `DUPLICATED_WITH` | Web and Native validate payload shape. This is an intentional boundary, not duplicate quest authority. |
| `LEAKED_RESPONSIBILITY` | No confirmed Dashboard quest semantics mutation. |
| `WHY_LAYER_EXISTS` | Web must bound user input; PA must execute resumable phases; rAthena must decide legal quest results. |
| `FAILURE_MODE_IF_REMOVED` | Removing the authoritative quest read/check would permit phase state to drift from rAthena. |

**Verdict:** `KEEP`, risk `MEDIUM`. Do not copy an OpenKore macro interpreter into Dashboard or PA. Preserve phase orchestration plus authoritative observation.

## 5. OpenKore reference comparison

`OPENKORE_REFERENCE_REQUIRED = YES`

`OPENKORE_REFERENCE_TRIGGERED = YES`

`OPENKORE_REFERENCE_GATE = PASS`

`OPENKORE_REFERENCE_INHERITED = NO`

`REFERENCE_DOSSIER = docs/openkore-reference/reference-index.yml; docs/openkore-reference/project-last-good-map.md; docs/openkore-reference/navigation.md; docs/openkore-reference/combat-and-targeting.md; docs/openkore-reference/supply.md; docs/openkore-reference/quest-automation.md`

`REFERENCE_VERSION = OpenKore master 51de1ddfc4449ae5217f6886de702f87ca934030`

`REFERENCE_SOURCE_DATE = Atlas verified in current repository; runtime count 0`

`REFERENCE_AUTHORITY = PA / SERVER_AGENT -> rAthena`

| Behavior | OpenKore evidence | Current project mapping | Classification | Equivalence result |
|---|---|---|---|---|
| AI action queue | Action queue, bounded retry/recovery | PA lifecycle and command state | `REPRODUCE` | `PASS` at responsibility level |
| Navigation | Route, move, failure and repath | PA native navigation; rAthena map authority; Dashboard has pure plan/coordinator | `ADAPT` | `PARTIAL`, Web coordinator remains |
| Farm lock/return | Leave farm, service, return and reacquire | PA supply/relocation state; rAthena movement | `REPRODUCE` | `PARTIAL`, route ownership split |
| Target selection | Scan eligible target, engage, drop stale target, reacquire | PA server-side target selection | `REPRODUCE` | `PASS` at authority level |
| Combat | Attack followed by authoritative hit/kill | PA combat loop plus rAthena battle | `ADAPT` | `PASS` for authority; event trace correlation gap remains |
| Loot | Drop, pickup, inventory update | PA loot plus rAthena inventory | `ADAPT` | `PASS` at authority level |
| Supply | Low -> service -> buy -> return -> resume | PA supply state, rAthena shop/inventory, Dashboard pre-resolved legs | `ADAPT` | `PARTIAL`, Dashboard coupling is open finding |
| Fly Wing | Historical item relocation behavior | PA item intent, rAthena item/position | `ADAPT` | `PARTIAL`, roaming acceptance not proven |
| Butterfly Wing | SavePoint return primitive | PA relocation/supply, rAthena savepoint | `ADAPT` | `PARTIAL`, primary-out acceptance pending |
| Death/recovery | Respawn and recover | PA recovery, rAthena respawn/savepoint | `REPRODUCE` | `PASS` at authority level |
| Quest | Phase/task route and authoritative observation | Quest Runtime phase state plus rAthena quest state | `IMPROVE` | `PASS` with no macro copy |

`REFERENCE_FILES_SYMBOLS_CHECKED = YES`: Atlas capability rows, Project Last-Good mapping, route/combat/supply/quest dossiers and current source seams were compared. `CONFLICT_WITH_CORE = NO`. `CHANGE_APPROVED = NO` for source refactor in this audit because the requested scope is documentation-only. `WORKLINE_DONE = YES`.

## 6. rAthena authority check

| Authority invariant | Source-of-truth | Audit result |
|---|---|---|
| Map transfer and position | Native `pc.cpp`, `unit.cpp`, warp/NPC paths | `PASS` |
| Navigation/path legality | Native path/unit/navigation | `PASS` |
| SavePoint/respawn | Native player/status/recovery paths | `PASS` |
| Item and inventory | Native item DB/player inventory | `PASS` |
| Shop/buy/sell/storage | Native shop/trade/NPC services | `PASS` |
| Combat damage and death | Native battle/mob/status | `PASS` |
| Loot/drop | Native mob/drop tables | `PASS` |
| Quest/NPC/world mutation | Native quest/NPC/script authority | `PASS` |
| Web state projection | Read-only live-status/Event Ledger projection | `PASS` |

## 7. Findings, verdicts and risk

| ID | Finding | Verdict | Risk | Blast radius | Rollback |
|---|---|---|---|---|---|
| `F-01` | Future supply route can block current `start_farm` command creation when the route-resolution skip is false | `MOVE_TO_PA` | `HIGH` | Start Farm, supply entry, command creation | Revert resolver gate or restore prior PA route contract |
| `F-02` | Dashboard relocation coordinator owns a multi-stage gameplay decision while Native owns execution | `MOVE_TO_PA` | `HIGH` | Change map, navigation, supply and farm resume | Restore current W4 coordinator while PA contract is validated |
| `F-03` | Farm eligibility, relocation support and route found are exposed too close together | `SAFE_SIMPLIFICATION` | `LOW` | Map selector, dry-run matrix and error reporting | Restore combined presentation field |
| `F-04` | Web and Native both validate payload shape | `KEEP` | `LOW` | All command surfaces | Keep both trust boundaries; no rollback needed |
| `F-05` | Event Ledger projection maps facts to Web text without confirmed execution feedback | `OBSERVATION_ONLY` | `LOW` | Combat terminal, `/api/events` | Disable projection only; gameplay remains unaffected |
| `F-06` | Trace id is not persisted through every command and ledger row | `UNKNOWN_NEEDS_EVIDENCE` | `MEDIUM` | Synthetic diagnosis and correlation | Preserve current bounded trace until schema decision |

`DUPLICATED_VALIDATION_COUNT = 1 confirmed intentional trust-boundary duplication (F-04)`

`GAMEPLAY_ORCHESTRATION_LEAK_COUNT = 2 confirmed (F-01, F-02)`

`OBSERVABILITY_EXECUTION_COUPLING_COUNT = 0 confirmed; 1 unproven trace-correlation risk (F-06)`

`SAFE_SIMPLIFICATION_COUNT = 1 (F-03)`

`MOVE_TO_PA_COUNT = 2 (F-01, F-02)`

`REMOVE_CANDIDATE_COUNT = 0`

`HIGH_RISK_COUNT = 2 (F-01, F-02)`

## 8. Top safe simplifications and migration order

1. Keep Dashboard farm eligibility as a product/read-model predicate, but return it separately from `relocationSupported` and `routeFound`. This is a low-risk contract clarification.
2. Keep Web payload validation and Native contract validation. They protect different trust boundaries; remove no validation without a replacement security proof.
3. Make the PA accept a durable farm intent plus supply policy and resolve future supply routes inside PA. Do this only after an equivalent native command/observation contract and bounded rollback are available. This is high risk and was not implemented.
4. Preserve Event Ledger and Action Trace as observation paths. Add correlation only through an approved schema change; do not let trace availability become a gameplay prerequisite.

## 9. Synthetic-first and live-run status

`SYNTHETIC_FIRST_TRIGGERED = YES`

`DIAGNOSTIC_PATH = existing scenario runner and action trace foundation`

`FIRST_BROKEN_TRANSITION = Controller -> Command creation for the existing start_farm fixture`

`TRACE_PROPAGATION_GAP = PRESENT`: trace headers and bounded checkpoints exist, while command and ledger persistence do not yet share a durable correlation field.

`LIVE_SYNTHETIC_RUN = DEFERRED`: this audit did not mutate the canonical runtime or interfere with concurrent worklines.

`BROWSER_UI_ACCEPTANCE = NOT IN SCOPE`: this artifact audits architecture and source responsibility only.

## 10. Required final status

```text
ARCHITECTURE_IS_OVERCOMPLEX = YES, localized to Dashboard route/supply pre-resolution and relocation coordination
OVERCOMPLEXITY_SOURCE = Dashboard carries future supply topology and multi-stage relocation decisions before PA execution
OPENKORE_RUNTIME_RETURN_RECOMMENDED = NO
NO_REFACTOR_EXECUTED = YES
```

The architecture is not globally over-complex. The safe boundary is Dashboard as authenticated intent bridge and projection surface, PA as gameplay orchestration, and rAthena as world authority. The high-risk seam is the Web-side precomputation of future supply and relocation behavior.
