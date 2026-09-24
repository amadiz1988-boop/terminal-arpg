# M1 Web Production Superset source audit

TASK_ID: `M1_WEB_PRODUCTION_SUPERSET_INTEGRATION_V1`
INPUT_M1_WEB_HEAD: `dff86f79348616efc999f1c5e1ad7de25b32ce33`
INPUT_ADMIN_RECOVERY_HEAD: `be9ddb39c4786f8d0a6f93a65346d8d73fcf06e9`
BASELINE: clean checkout of M1 Web head
SCOPE: source integration only

| Relevant hunk | Classification | Resolution |
| --- | --- | --- |
| M1 World Map direct teleport, Saved Town, Supply mapping, excluded settings | M1_KEEP | Retained from M1 head without change. |
| M1 teleport presentation A/B/C/D and authoritative arrival gate | M1_KEEP | Retained from M1 head without change. |
| `dashboard/admin-quarantine-recovery.mjs` | ADMIN_RECOVERY_KEEP | M1 head already contains the exact accepted blob `ebefd814`. |
| Recovery command grant and audit in `dashboard.mjs` | ADMIN_RECOVERY_KEEP | Integrated accepted Native command admission and event audit. |
| Recovery API route in `dashboard.mjs` | SHARED_MERGE_REQUIRED | Adapted to M1 route layout and Cloudflare Access Admin host boundary. |
| Fleet safe recovery action in `dashboard/admin/server-ops.js` | SHARED_MERGE_REQUIRED | Added only quarantine action, confirmation, Native result polling, and busy state. |
| Accepted recovery contract test | ADMIN_RECOVERY_KEEP | Retained and extended with Admin host and Fleet wiring checks. |
| `skipSupplyRouteResolution` assertions | STALE | Replaced with current World Map action execution and state assertions. |

UNKNOWN_HUNKS: 0

The current same-map action returns `ALREADY_ON_TARGET_MAP` for active `AUTO_FARM`.
For `PERSISTENT_IDLE`, it queues only `start_farm` before cross-map Supply
preflight. The bounded test checks no teleport, fee, cooldown write, or
unnecessary restart.

Admin recovery uses the existing Cloudflare Access protected Admin host. The
Dashboard creates a short-lived Native command grant and enqueues the accepted
`recover_quarantined_to_idle` action. The adapter checks quarantine
preconditions and confirms Native command plus state before reporting recovery.
Public Player host, unlisted Admin-like hosts, and credential-free loopback
requests are denied by the Admin API gate. No Player session is created.

Source checks: World Map 40 cases; Map Info 394 files; Supply cutover 70
checks; Supply preflight 11 cases; Supply synthetic 44 cases; Supply service
33 checks; Native Supply policy 14 cases; settings capability 46 fields;
OpenKore config mapping 31 mappings; teleport presentation 11 tests;
same-map 3 scenarios; Admin recovery/security 6 tests; Admin Fleet 19 tests;
Web canary projection and idle contract passed. Node syntax and Git whitespace
checks passed.

The existing `test-player-security.mjs` made unauthenticated loopback HTTP
requests before stopping at a missing local credential fixture. It provided
no Admin security acceptance result. The existing Supply UI Browser test
also stopped at that missing fixture before Browser launch. The Admin
security result above comes from the bounded recovery contract tests.
Production deployment, service restart, Browser acceptance, and live Player
mutation were outside this source checkpoint.
