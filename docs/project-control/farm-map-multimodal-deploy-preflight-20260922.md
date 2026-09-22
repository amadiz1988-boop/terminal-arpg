# FARM_MAP_CHANGE_MULTIMODAL_CONTROLLED_DEPLOY_AND_LIVE_ACCEPTANCE_V1

Status: BLOCKED_BY_WEB_COORDINATOR_INTEGRATION. No Dashboard or rAthena restart.

## Verified native correction

The running map-server executable hash is
`F72E08D71323B820F68D1A31A83864257D7F39EC3C15D6E9C62F288BF781AECA`.
It matches the product owner's supplied deployment identity for native checkpoint
`ba299496c1048729216e8b4d544e875e86337b0e`.
`BLOCKED_BY_NATIVE_LIFECYCLE = FALSE`; native lifecycle was not re-audited.

## Candidate and evidence correction

Web HEAD `13ea08c58bc5cc66cfb5f7f0b8d611284860d020` contains
`024b4436873f7744976070d5c5b46e0f7576edd2` and
`7f96d6ad12f8dcca67b839572856848ee203b8f0` by Git ancestry.
Ancestry is PASS; overall deployment superset/provenance is NOT COMPLETE.
The previous source-pass report did not cover the planner/executor integration.

Two concrete preflight failures were reproduced using the existing executor:

1. A DIRECT_TO_TARGET step has canonical route objects ending in
   `{map:'pay_dun00',x:73,y:78}`. After dispatch, an observation with
   `currentMap='pay_dun00',agentMode='PERSISTENT_IDLE'` leaves index at 0,
   `action=null`, `waitingForConfirmation=true`. Executor lines 68-69 compare
   the map string with the terminal object. Arrival cannot advance this stage.
2. A KAFRA_DIALOG_TRANSFER stage emits its first action and marks the stage
   dispatched. The next observation still on prontera returns `action=null`.
   Dashboard's `if (!next.action) continue` occurs before commandIndexByStage
   dispatch. The remaining dialogue commands cannot be sent.

FIRST_BROKEN_TRANSITION for a Kafra path:
`FIRST_KAFRA_COMMAND -> SUBSEQUENT_DIALOGUE_COMMAND_DISPATCH`.
An independent later failure is
`AUTHORITATIVE_NAVIGATION_ARRIVAL -> WEB_RELOCATION_STAGE_ADVANCE`.

Minimal required follow-up: bind per-command authoritative acknowledgements and
dialog readiness to the existing stage command cursor; recognize canonical
terminal map objects and require authoritative navigation completion. Cover the
combined planner/coordinator path before another deployment. Do not use arbitrary
revision changes as command acknowledgement or merely clear the dispatched flag.

## Production writes and exact rollback

Dashboard was temporarily patched on disk, and map-route.mjs was copied from the
immutable 13ea08c blob. No process reload was issued. Both files were restored
from the original preflight copy after the integration failures were confirmed.
Hash comparisons guarded against intervening production edits before rollback.

Backup directory:
`C:\Users\Administrator\ghost-island-production\ro-stack\deploy-backups\farm-map-multimodal-20260922-085226`

| File | Restored SHA256 |
| --- | --- |
| ops/ro-stack/dashboard.mjs | F6615E31E8BAD09B18E3EA4DDC591DBC9CB137614160E0C9F99CEC94CC315D34 |
| ops/ro-stack/persistent-agent/map-route.mjs | 8EB84B15881D4C03EAE70E7C05F7D82B59CB183C519AF9E165C027E8FC01BDA3 |

PRODUCTION_DEPLOYED = NO, ROLLED_BACK_BEFORE_RESTART.
The earlier commentary claiming production provenance PASS is superseded by
this report. No successful deployment receipt was produced.

## Health and acceptance

3307, 6901, 6122, 5122 and 8788 each have exactly one listener.
PIDs: DB 22792, login 20288, char 1596, map 41192, Dashboard 49136.
OPENKORE = 0. Both /api/internal/health and /api/internal/probe return HTTP 200.
The health response reports database/login/character/map services true.

150039 and all six representative live cases = NOT_RUN.
COMBAT_FIXTURE_AVAILABLE = NOT_PROVEN.
MINIMAP_MOVING_SESSION_AVAILABLE = NOT_PROVEN.
No success notification was sent to I or B because no fixture was established.
PAY_DUN00_SUPPLY_REGRESSION = NOT_RUN_THIS_TURN.
NAVIGATION_LIFECYCLE_REGRESSION = NOT_RUN_THIS_TURN.
P_JOURNEY_LIVE_ACCEPTANCE = BLOCKED.

BASE_PORTAL_GRAPH_ADJACENCY_BASED = YES.
FARM_MAP_PLANNER_MULTIMODAL = YES (source candidate).
IS_MAP_ADJACENCY_ONLY = NO.

## Continuation: WEB_MULTIMODAL_COORDINATOR_CONTRACT_REPAIR_V1

The two reproduced coordinator defects were repaired in the canonical Web
worktree without touching Production:

- `routeStepDestinationMap()` is the single terminal-map seam for string and
  `{map,x,y}` route terminals. Direct, service, savepoint, butterfly and
  dungeon arrival checks use the seam.
- Kafra dispatch now reads the existing command ledger status as the explicit
  command acknowledgement. `commandIndexByStage` advances one confirmed
  command at a time; stage completion still requires sequence completion and
  authoritative arrival. Rejection and retry remain bounded.

Bounded verification passed:

`test-relocation-executor.mjs` 24/24; `test-map-route-multimodal.mjs` 6/6;
`test-relocation-command-surface.mjs` 12/12; `test-farm-route-unavailable.mjs`
10/10; `test-relocation-coordinator.mjs` Kafra cursor, authoritative arrival,
multimodal sequence, rejection and bounded retry PASS; Dashboard syntax check
PASS. No Production restart or write occurred.

The candidate is still not deployable: the checked-in Dashboard contains
unrelated pre-existing changes and the controlled deploy tool allows only the
Dashboard plus its fixture path, while this repair also changes the relocation
executor and adds its bounded test. `SUPERSET_PROVENANCE=BLOCKED` until an
exact clean candidate lineage and authorized deploy manifest are established.

## CONTEXT_REPORT

NEXT_UNFINISHED_STEP = WEB_PLANNER_COORDINATOR_CONTRACT_REPAIR.
Then repeat deployment preflight, establish 150039 through normal Player flow,
notify I/B when authoritative AUTO_FARM is stable, and run the requested matrix.
Combat HIT acceptance remains I-owned. No Native, Minimap, Combat or Supply
policy changes were made in this continuation.
