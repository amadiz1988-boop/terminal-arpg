# Headless test superuser joint live acceptance, 2026-09-23

## Context report

```text
TASK_ID = HEADLESS_TEST_SUPERUSER_JOINT_CONTROLLED_LIVE_ACCEPTANCE_V1
WORKLINE = current-window joint acceptance
NEAREST_LEGAL_STATE = existing TEST_SUPERUSER 2000164/150106 and TEST_PLAYER 2000163/150105, both SERVER_AGENT resident
TEST_LEVEL = controlled Production fixture vertical slice
TEST_ACCELERATION = NO
SYNTHETIC_FIRST_TRIGGERED = YES (new command-dispatch blocker)
LAST_CONFIRMED_GOOD = Web fixture d22361ed; deploy tool bfff9c93; Native group fix 21fe9d29; ProcDump operations 5cae7743
CURRENT_PHASE = live acceptance complete; economy isolation remains PARTIAL
FIRST_BROKEN_TRANSITION = queued fixture command to Native poll
ROOT_CAUSE = Production conf/persistent_agent_commands.json omitted the test_fixture_atcommand registration present in canonical Native source
OWNER = Native command contract deployment, same scope
MINIMAL_FIX = preserve Production contract preimage, copy exact 21fe9d source contract, restart the sole canonical rAthena stack
BOUNDED_TEST = 41 actions loaded; new group 99 heal confirmed; group 0 heal denied by rAthena; position, HP, item and cleanup verified
SOURCE_CHECKPOINT = 21fe9d292a5321f9fad0abd5fc45ae0978d7bc4f
WEB_CHECKPOINTS = d22361ed9e618f8bd9fd6290c44d989f823a75ef; bfff9c93f51134e8ff4612a452c31e6c7b7b2bd4
PROCDUMP_CHECKPOINT = 5cae7743fa78bc6511600f1e674315c0e34a852d
```

## Binary and deployment identity

| Artifact | Production preimage SHA256 | Active candidate SHA256 |
| --- | --- | --- |
| char-server.exe | `1B06B668E0E578D315AB54606FC55FF5FD86C08B811DCBC76A36BD656C709162` | `C9907E89DF27ECB6C19340A2A8EC7C02C0E460BE3137EE194099F6D85DD8CA9D` |
| char-server.pdb | absent | `4334737886A19D648D0BD80BD82D06813AC395604762F1E33ED46846688DDDDD` |
| map-server.exe | `F72E08D71323B820F68D1A31A83864257D7F39EC3C15D6E9C62F288BF781AECA` | `CBAFE17233A558A184EDA462398815F9D6DDC07C08E523948262526FC8A3DCD7` |
| map-server.pdb | absent | `B917A6052BD66EAA293189B54EB3EA1767E994AB5EE60A3B34ADD40957134DD8` |
| persistent_agent_commands.json | `9B1CBD0A228DF6E4BD3867E5A250E6094C481A0ED2C714A0059AEF70FCB6F441` | `15EAA5942309BC016AA241B8860AA4BE5CEB68AEC1AFF2B89F6021C8B0C1450D` |

Both EXE/PDB pairs passed `symchk` against the source artifacts. Native preimages and the command contract preimage are saved under `C:\Users\Administrator\ghost-island-production\ro-stack\.local\ro-stack\deploy-backups\headless-fixture-char-map-preimage-20260923-170954`. The canonical `ro-stack.ps1` stop/start lifecycle restarted login because it manages login, char, and map together; no second stack was started. The Web deployment used the exact three-file manifest SHA256 `C64D538D3E1709D5F6D936F32A7346B10419E2F112E2B0DAAE41CD0B3D061DDD` and receipt `C:\Users\Administrator\ghost-island-production\ro-stack\.local\ro-stack\dashboard\deploy-receipts\manifest-93611a880ae04848b3bcef470439fdab\deploy-receipt.json`. Server-side fixture enablement was set for that Dashboard start. The Web tool reported `DEPLOY_PASS` with Native PIDs unchanged.

## Live authority evidence

At 17:15 the map runtime loaded TEST_PLAYER group 0 and TEST_SUPERUSER group 99, each `fd=0` and `IDLE_READY`. The first queued request `d1d5d296-c0d3-4c12-b6ed-af7e384c5088` was denied `NOT_RESIDENT` during restart rehydration and was not reused as acceptance. New requests after residency completed:

| Request ID | Actor | Command | Native permission and result | State evidence |
| --- | --- | --- | --- | --- |
| `2672789e-c1e5-4c1c-b9ea-f3bba24f7c00` | 2000164/150106 | heal | `g=99;p=ALLOW;e=EXECUTED` | confirmed |
| `1e5fcb59-c02a-4b17-a694-f5c54a7b3673` | 2000163/150105 | heal | `g=0;p=DENY;e=NOT_RUN` | rejected by rAthena |
| `57c03bae-513b-4756-bbdd-51e9783f6f0b` | 2000164/150106 | warp | `g=99;p=ALLOW;e=EXECUTED` | authoritative position `iz_int04 20,30` to `21,30` |
| `20e7e9f6-2803-4a77-b659-cbb0203c6d80` | 2000164/150106 | warp cleanup | `g=99;p=ALLOW;e=EXECUTED` | returned to `20,30` |
| `ba9e7600-c951-423f-af42-808d3a707328` | 2000164/150106 | heal -5 | `g=99;p=ALLOW;e=EXECUTED` | live HP observed `37/40`, later restored `40/40` |
| `d2f011bb-b90b-486c-a45c-6159be9eedfe` | 2000164/150106 | item 501 1 | `g=99;p=ALLOW;e=EXECUTED` | live inventory item 501: absent to one |

The item was consumed through the normal Player `/api/item-action` support session path. Native `use_item` command `549fd737-a2aa-491b-8063-7be881686fa0` was `CONFIRMED`; live inventory item 501 returned to absent. The temporary support session was revoked. A separate passwordless `OBSERVE_ONLY` read as TEST_PLAYER returned `/api/state?view=entry` with `GAME_ENTRY_LEAN_STATE`, 150105 resident, `SERVER_AGENT` ownership, and fresh `rathena.persistent_agent.live_status` (95 ms age at read). Its support session was revoked.

The persisted `persistent_agent_command` payloads and `persistent_agent_rollout_event` rows correlate request ID, actor account and character, command, runtime group, permission, execution, and timestamp. Fixture command and fixture audit rows for non-test character IDs since 17:12 both counted zero. All exercised Native commands target their own resident session; no real-player target or global command was submitted. This zero is attributable to this fixture workflow and does not assert that other players were inactive.

The latest canonical rehydration called normal Life admission for both fixtures and logged `TEST_FIXTURE_LIFE_EXCLUDED`. Four historical test Life sessions remain (`INTERRUPTED`, two per identity); sessions started after the 17:15 admission attempt counted zero. Economy isolation is `PARTIAL`: the deployed source contains test guards on documented economy surfaces, while no live trade or market denial was exercised against a real player.

## Security and stability

Player-host `/admin/server-ops.html` and fixture API each returned 404. A support-only session calling the fixture Admin API returned 403 `support_admin_boundary`. The Cloudflare Admin page rendered `Overall HEALTHY` and displayed healthy Database, Login, Char, Map, Persistent Agent, Dashboard, and Web Experience. `/api/admin/server/status` returned 200; the `server_admin_api` contract accepts 200/401/403. Admin UI also showed existing stale-data and quarantined-character alerts; these were not attributed to this fixture acceptance.

At 17:21, approximately six minutes after the final Native activation, 6901/6122/5122/8788 each had one listener, `/api/health` returned `ok:true`, OpenKore runtime count was zero, and the active EXE hashes matched the candidates. ProcDump produced no dump in the dedicated capture directory. Canonical cancellation removed the ProcDump process; map PID 21996 survived with one 5122 listener and healthy Dashboard. No Native crash was observed during this bounded window.

```text
NATIVE_DEPLOY = PASS
WEB_DEPLOY = PASS
TEST_SUPERUSER_RESIDENT = PASS
TEST_SUPERUSER_RUNTIME_GROUP = 99
SUPERUSER_PERMISSION_SEAM = PASS
POSITION_COMMAND = PASS
STATE_COMMAND = PASS
INVENTORY_COMMAND = PASS
TEST_PLAYER_RESIDENT = PASS
TEST_PLAYER_RUNTIME_GROUP = 0
TEST_PLAYER_TRANSPORT_TO_PERMISSION_SEAM = PASS
TEST_PLAYER_GM_PERMISSION = DENIED_BY_RATHENA
TEST_COMMAND_AUDIT_LIVE = PASS
REQUEST_RESULT_CORRELATION = PASS
NON_TEST_ACCOUNT_MUTATIONS = 0 attributable to fixture workflow
NON_TEST_CHARACTER_MUTATIONS = 0 attributable to fixture workflow
REAL_PLAYER_TARGETING = 0
GLOBAL_GAMEPLAY_MUTATION = 0
PREEXISTING_TEST_LIFE_SESSIONS = 4 INTERRUPTED
NEW_TEST_LIFE_ADMISSION = DENIED / NOT_CREATED
NEW_TEST_LIFE_SESSION_COUNT = 0
ECONOMY_EXCLUSION_LIVE = PARTIAL
PLAYER_FLOW_AUTHORITY = PASS (passwordless read and normal item use)
ADMIN_SECURITY_REGRESSION_LIVE = PASS
PASSWORD_REQUIRED = NO
MANUAL_PLAYER_LOGIN_REQUIRED = NO
BOUNDED_BLOCKERS_FOUND = 1
BOUNDED_BLOCKERS_RESOLVED_IN_PLACE = 1
PROJECT_CONTROL_STOP_TRIGGERED = NO
USER_MANUAL_ACTION_REQUIRED = NO
LOGIN_PID_BEFORE_AFTER = 40512 -> 52944
CHAR_PID_BEFORE_AFTER = 38660 -> 36328
MAP_PID_BEFORE_AFTER = 52784 -> 21996
DASHBOARD_PID_BEFORE_AFTER = 49228 -> 5236
FINAL_6901 = 1
FINAL_6122 = 1
FINAL_5122 = 1
FINAL_8788 = 1
FINAL_HEALTH = PASS
OPENKORE_RUNTIME_COUNT = 0
NATIVE_CRASH_DURING_ACCEPTANCE = NO
MAP_SERVER_SURVIVED_CAPTURE_DETACH = PASS
WEB_ROLLBACK_EXECUTED = NO
NATIVE_ROLLBACK_EXECUTED = NO
HEADLESS_TEST_SUPERUSER_LIVE_READY = YES
CANONICAL_TEST_IDENTITIES_READY = NO (Economy isolation PARTIAL)
```

The accepted Native and Web fixture infrastructure remains deployed. The next separate gate for full canonical test identity readiness is a bounded, isolated Economy denial acceptance that preserves the real-player economy boundary.
