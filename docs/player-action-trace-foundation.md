# Player Action Trace Foundation V1

本文件定義 synthetic player scenario 與未來 Admin Experience Health 共用的 bounded action trace contract。V1 只新增 scenario-side foundation，不修改 Dashboard、Player Web、RUM telemetry、Native command schema 或 runtime。

## 既有 observability inventory

| 能力 | 現行來源 | 可重用訊號 | V1 缺口 |
| --- | --- | --- | --- |
| Scenario trace header | `scripts/player-scenario-runner.mjs` | `traceId`、`x-scenario-trace-id`、HTTP/state/event checkpoints | Dashboard command 與 Event Ledger 尚未持久化 correlation |
| 中文 action label | `ops/ro-stack/web-experience/action-labels.mjs` | `actionLabel()`、既有 `automation_start`、`inventory_open`、`quest_open`、`combat_state_visible` | scenario actionKey 需要與既有 label key 對應 |
| Server-Timing / request timing | `ops/ro-stack/web-latency-trace.mjs`、`docs/web-e2e-latency-tracing.md`、`scripts/audit-ui-action-response.mjs` | request、DB、projection、bridge、serialize timing | V1 不寫入第二套 timing transport |
| Web Experience Health | `ops/ro-stack/web-experience/experience-health.mjs`、`test-experience-health.mjs` | bounded action health、traceId、error code、rolling windows | 目前是 Web telemetry read model，不含 Native/PA transition timeline |
| Event Ledger | `ops/ro-stack/web-observation.mjs`、`ops/ro-stack/dashboard.mjs` `/api/events`、`ops/ro-stack/quest-runtime/agent-events.mjs` | `MONSTER_TARGET`、`MONSTER_ATTACK`、`MONSTER_HIT`、`MONSTER_KILL`、`LOOT_ACQUIRED`、bounded cursor | scenario header 未跨入 ledger row |
| Dashboard request metrics | `ops/ro-stack/dashboard.mjs` | `/api/state`、`/api/events`、`/api/automation`、`/api/grind-target`、`/api/item-action`、command status | action-level trace persistence 尚待 A/B workline 完成 |
| Command response | `ops/ro-stack/dashboard.mjs` | command id、status、reasonCode、HTTP error | trace correlation field 不得在本輪自行擴充 |

## Action Registry

`scripts/lib/player-scenario/action-registry.mjs` 直接引用既有 `action-labels.mjs`，集中補足 action category、read-only/mutation、expected endpoint、success condition 與 terminal layer。registry 的 actionKey 唯一，中文 label 不另建第二份來源。

支援 action：`start_farm`、`stop_farm`、`change_farm_map`、`use_fly_wing`、`use_butterfly_wing`、`supply_return`、`inventory_load`、`quest_open`、`character_enter`、`combat_log_load`、`farm_stats_load`。

## Trace schema

每個 trace 具有：

```text
schema, traceId, actionKey, actionLabel, charId, accountId,
startedAt, completedAt, result, currentMap, targetMap,
layers[], tracePropagationGap
```

每個 layer event 具有 `layer`、`stage`、`timestamp`、`result`、`durationMs`、`errorCode`、`reason`、`transition` 與 bounded `metadata`。允許 layer 為 `BROWSER`、`API`、`AUTH`、`OWNERSHIP`、`CONTROLLER`、`COMMAND_DISPATCH`、`NATIVE_RECEIVE`、`NATIVE_ACCEPT`、`PA_STATE`、`RATHENA_AUTHORITY`、`EVENT_LEDGER`、`RECONCILE`。metadata 會移除 password、token、secret、cookie、authorization、credential 欄位，並限制深度、字串長度與集合大小。

目前 scenario 只能觀察 header，因此每筆 trace 明確輸出：

```text
TRACE_PROPAGATION_GAP = PRESENT
```

這是可觀察範圍的事實，不代表 Native 或 Event Ledger 已完成跨層 correlation。

## Error taxonomy

`scripts/lib/player-scenario/error-taxonomy.mjs` 維持 bounded public taxonomy。核心 codes：

`AUTH_FAILED`、`OWNERSHIP_MISMATCH`、`INVALID_RUNTIME_STATE`、`SUPPLY_ROUTE_UNAVAILABLE`、`RELOCATION_UNSUPPORTED`、`COMMAND_DISPATCH_FAILED`、`NATIVE_REJECTED`、`STATE_TRANSITION_TIMEOUT`、`AUTHORITATIVE_POSITION_UNCHANGED`、`EVENT_NOT_OBSERVED`、`RECONCILIATION_FAILED`。

既有 `supply_route_unavailable` 會映射為 `SUPPLY_ROUTE_UNAVAILABLE`，layer 為 `CONTROLLER`、stage 為 `PRECONDITION`。public message 與 exact admin error code 分開保存。

## FIRST_BROKEN_TRANSITION

`trace-analyzer.mjs` 依 layer 順序只取第一個 `FAIL`、`TIMEOUT` 或 `BLOCKED`。第一個 failure 之後的 `NOT_RUN` 不會被當成額外 failure。timeout 會保留 `awaitedTransition`。HTTP 200 只會讓 API layer PASS，後續 PA state 未收斂仍會回報 FAIL。命令已接受但權威位置未改變會落在 `RATHENA_AUTHORITY` failure。

## Bounded trace store

`trace-store.mjs` 提供 process-local `BoundedTraceStore`：固定最大 trace 數、每筆最大 event 數、一般 TTL、FAIL trace 較長但仍有上限的 retention、append/complete/get/listRecent/filter。它不寫 MariaDB，也不建立高頻 telemetry。失敗時採 fail-soft 的 null/空清單回傳邊界。

## Current start_farm regression fixture

測試 fixture：

```text
CHAR_ID = 150075
ACTION = start_farm
HTTP = 409
ERROR = supply_route_unavailable
CONTROLLER = rejected before command creation
NATIVE = NOT_REACHED
EXPECTED_RESULT = FAIL
EXPECTED_FAIL_LAYER = CONTROLLER
EXPECTED_FIRST_BROKEN_TRANSITION = Controller -> Command
```

這是 deterministic analyzer regression fixture。V1 不對 live Dashboard 發送 mutation，因此 `START_FARM_LIVE_RUN = DEFERRED`。

## Admin Web contract only

本輪不修改 Admin UI。未來列表欄位固定為：時間、角色、action、結果、failure layer、error code、總耗時、trace ID。篩選為角色、action、PASS/FAIL、layer、error、5 分鐘、1 小時，並提供 FAIL quick filter。detail view 顯示 bounded full timeline，並在頂端顯示 `FIRST_BROKEN_TRANSITION`。

範例 detail：

```text
13:00:00.120 API RESPONSE PASS HTTP 409
13:00:00.121 CONTROLLER PRECONDITION FAIL SUPPLY_ROUTE_UNAVAILABLE
13:00:00.121 COMMAND_DISPATCH CREATE NOT_RUN
13:00:00.121 NATIVE_RECEIVE RECEIVE NOT_RUN
FIRST_BROKEN_TRANSITION = Controller -> Command
RESULT = FAIL
```

## Integration plan after A/B

| FILE | FUNCTION / SEAM | TRACE INPUT | TRACE OUTPUT | COLLISION_OWNER | READY_AFTER |
| --- | --- | --- | --- | --- | --- |
| `ops/ro-stack/dashboard/app.js` | Player Web action wrapper | actionKey、traceId、charId | BROWSER start/complete | B | B RUM timing patch merged |
| `ops/ro-stack/dashboard.mjs` | HTTP request entry | header traceId、endpoint、status | API layer | A | A start_farm candidate merged |
| `ops/ro-stack/dashboard.mjs` | controller validation | action、char ownership、error code | AUTH/OWNERSHIP/CONTROLLER | A | A controller seam stable |
| `ops/ro-stack/dashboard.mjs` | command creation/dispatch | commandId、payload hash、status | COMMAND_DISPATCH | A | command contract unchanged |
| Native / PA command status bridge | acknowledgement | commandId、status、reasonCode | NATIVE_RECEIVE/NATIVE_ACCEPT | Native owner | Native correlation design approved |
| PA state projection | state convergence | mode/map/x/y/target | PA_STATE/RATHENA_AUTHORITY | PA owner | read model seam stable |
| Event Ledger projection | bounded events | cursor、event type、occurredAt | EVENT_LEDGER | PA/Event Ledger owner | event correlation field approved |
| Admin API | trace list/detail | filters | trace summary/timeline | future Admin owner | foundation contract accepted |
| Admin UI | list/detail filters | trace summary | visible experience health | future Admin owner | Admin API available |

本表只作 integration plan，不在 A/B 完成前修改 collision owner 檔案。

## 驗收命令

```text
node --check scripts/player-scenario-runner.mjs
node --check scripts/lib/player-scenario/*.mjs
node scripts/test-player-action-trace-foundation.mjs
node scripts/test-player-scenario-runner.mjs
git diff --check
```

本輪未啟動 Dashboard、Native、MariaDB，未執行 live mutation。`start_farm`、供給、翅膀與 combat 的 live run 保留給 A/B seam 完成後，以 `--execute` 明確授權並使用 bounded timeout 執行。
