# M1 V15 normal-player economy preflight

Workline: `M1_FIRST_GITHUB_FIRST_PROMOTION_FINAL_ACCEPTANCE_V15`.
Result: `BLOCKED` before Store/Sell mutation. No economy action or final promotion was performed in this continuation.

## Current read-only evidence

- At 2026-09-26 01:10 UTC, `player economy-eligibility 150095` returned account 2000139, `groupId=0`, `accountState=0`, `isTest=true`, `agentMode=PERSISTENT_IDLE`, `ownershipState=SERVER_AGENT`, and `activeCommandCount=0`. The current test marker disqualifies the Project Control primary character, regardless of historical normal-group evidence.
- A fixed, bounded census returned 14 characters with `login.group_id=0`, `login.state=0`, and `COALESCE(web_account_flags.is_test,0)=0`. The result is only an identity candidate list. It does not establish an authenticated Player session, inventory safety, Store/Sell access, or current live projection freshness.
- Character 150075 is a normal non-test identity in that census, but its Dashboard roster showed HP 1/2497 and stale PA projection. Character 150097 showed HP 784/784, idle mode and no active command in the fixed read, but its Dashboard projection was stale. Neither was selected for mutation.
- The only exact local credential files found in the canonical project `.local/ro-stack` were the four existing test/multiplayer fixture credential files. No credential or authenticated Player session for a census candidate was found through that known path. Credentials were not printed or copied.
- `ops/ro-stack/support-session.mjs:classifySupportMutation` permits bounded automation actions in `PLAYER_ACTIONS` mode but denies `/api/config`. Support impersonation therefore cannot configure the item-policy rules needed for this Store/Sell acceptance through the current Player path.
- `ops/ro-stack/test-fixture-command.mjs:createM1AcceptanceFixtureTransport` pins its target to canonical `TEST_PLAYER` account/character and verifies `is_test=1`. This existing fixture-provisioning path cannot safely provision an item to a normal non-test census character.
- At 2026-09-26 01:12 UTC, Developer Console runtime health was `RUNTIME_UNHEALTHY`: DB and Dashboard listeners were present, while login, char and map listeners were absent. The latest incident record identifies char as the first exit at 2026-09-26 09:04:53 +08:00, exit code 0, classification `UNKNOWN`, with no crash dump. Exit code 0 is not causal proof. No restart or recovery was attempted. Earlier PA roster values in this note were stale and cannot certify live gameplay readiness.

## Transition and stop condition

`NORMAL_PLAYER_ECONOMY_ELIGIBILITY_PREFLIGHT → LEGAL_PLAYER_AUTH_AND_SAFE_FIXTURE` is the first unclosed transition. The exact stop condition is that a safe fixture item cannot be provisioned for a normal non-test candidate through the existing canonical path. Current runtime health also blocks live acceptance. No inventory, storage, Zeny, policy, or player-state preimage was taken for a selected candidate, so Store/Sell execution is prohibited by the workline contract.

Next required action: provide an authorized, existing normal-player authentication and safe-item preparation path for one census candidate, or a bounded product-approved fixture mechanism that preserves the normal-player economy authority boundary. Then re-run the full current preflight and record inventory, storage, and Zeny preimages before any mutation. Do not change `is_test`, group authority, or economy permissions.

Production application files, runtime, schema, and player state were not changed. GitHub-first final receipt, drift closure, baseline transition, and lease release remain pending.

## Source verification

The Developer Console now exposes fixed read-only `player economy-eligibility <charId>` and `player economy-candidates` commands. Syntax checks, the Developer Console test, routing test, support-session test, and `git diff --check` passed. The unrelated `scripts/test-test-fixture-command.mjs` currently fails because it still expects the literal `RO_TEST_FIXTURE_COMMANDS_ENABLED !== '1'` in `dashboard.mjs`; current source delegates that check to `fixtureTransportEnabled`. Neither file was modified in this continuation.
