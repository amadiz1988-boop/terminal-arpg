# M1 V15 Native runtime contract artifact gate

Status: contract deployed and loaded; final Player acceptance blocked at the Web availability endpoint. This record does not claim full promotion.

## Exact provenance

- Active owner lease: `869f1725-dbd0-452d-b9dd-37ee79cc3f9a`, owner `F｜M1 最終整合`.
- Approved Native candidate: `18523076a6034ca3731aefb73bf41993f4a0ef06`.
- Approved Web candidate: `5a31570a861e1665841e62245c7caa105a796b3a`.
- Source: Native tracked `conf/persistent_agent_commands.json`, SHA-256 `3AF34756EB4DC067167261BD3C25EF8D3AB1FA41C7AAC11E3F567DF5C0D46306` in the canonical Native worktree.
- Preimage: Production `.local/ro-stack/rathena/conf/persistent_agent_commands.json`, SHA-256 `9CD430EA279CD93817A0C1501BE7AA3314966C9BF3C204F356B9F8ADC7673FC0`.
- Native clean GitHub checkout of the approved commit and canonical Native worktree have the same tracked Git blob. Worktree line-ending materialization differs; the candidate is admitted only when its exact `3AF34756` byte image and the approved commit's normalized blob both match.
- Scope: one `RUNTIME_CONTRACT` artifact required by `map-server.exe`. No binary replacement, arbitrary file path, DB schema or gameplay implementation change.

## Backward compatibility

Contract version and kind remain 1 and `persistent_agent_command_contract`. The 46-action preimage becomes 47 actions. The only new action is `prepare_m1_acceptance_fixture`. The only existing action changed is `start_farm`, whose optional payload gains `attackDistance`, `attackMaxDistance`, and `selfRecoverySkillSlots`. Every other action and existing field is identical in the full JSON comparison.

The production 46-action contract and candidate 47-action contract both passed the 13-case legacy `start_farm` matrix with 75 shared start-farm assertions. The candidate's full C++ contract suite passed 81 cases. `Test-M1V15ExecutorFixture.ps1` passed its settings executor and fixture security checks under Windows PowerShell 5.1. The Native parser accepts both attack-distance keys together, or neither; omitted keys retain the server-weapon-range default. The self-recovery list is optional, and omitted lists retain the existing recovery path. rAthena remains skill and item authority.

## Controlled continuation

Use `ops/ro-stack/native-runtime-contract-artifact.mjs` for one-artifact prepare, dry-run, and explicit `--execute true` deploy. It verifies the lease, prior Native receipt, candidate manifest, GitHub tracked blob, exact source bytes, old preimage, allowlist and semantic delta. A deploy keeps a verified exact preimage and immutable receipt under `.local/ro-stack/native-runtime-contract-artifact-<lease>-<native-prefix>/`; failed replacement restores the exact preimage. The tool never restarts a process. Map-server loads this registry at char-server-ready, so runtime adoption requires a controlled canonical Native lifecycle restart with fresh health and ProcDump evidence. The existing queued fixture command has an expired Local Admin session and must be observed as rejected before one newly authenticated command is submitted. Do not claim the old command as confirmed.

Before live continuation, rerun dry-run and the artifact tests. Final acceptance must separately prove runtime load, valid fixture command, 12 settings, 42 gate, Fly/HIT, Supply/HIT, 38 capabilities, Browser desktop/mobile/audio, final release receipt and lease release. A source or dry-run PASS alone leaves Production promotion incomplete.

## Live continuation on 2026-09-25

- `CONTRACT_DEPLOY=PASS`: one allowlisted artifact was installed with receipt SHA-256 `E53A88E003DA68E9C371AC0CDE6D701E668CEE7D15B49AD32CE74CEE254132DB`; installed image `3AF34756EB4DC067167261BD3C25EF8D3AB1FA41C7AAC11E3F567DF5C0D46306` and rollback preimage `9CD430EA279CD93817A0C1501BE7AA3314966C9BF3C204F356B9F8ADC7673FC0` were verified afterward. Lease and pending record point to the same immutable receipt.
- `RUNTIME_LOAD=PASS`: the existing launcher gracefully stopped map, char, and login, then started one replacement set without replacing binaries. Map startup logged `command contract v1 loaded ... (47 actions)`; new map PID `22988` has SYSTEM ProcDump attached to that same PID. Dashboard and DB stayed running; `/api/health` returned 200 and OpenKore count remained zero.
- `EXISTING_QUEUED_COMMAND_SAFE_TO_RESUME=NO`: command `e361025c-87de-4f76-aa67-c0473fb43117` was rejected by Native with `m1_fixture_authority_denied` because its Local Admin session had expired. It was not reclassified as success. One fresh authenticated local Admin request created command `e5c46b98-f433-40bf-b819-d58fc92a7db8`, which reached `CONFIRMED` with Native event `PREREQUISITES_READY` for TEST_PLAYER `150105`.
- `12_SETTINGS_TRANSPORT=SUPPORTED`: authenticated `/api/config` lists all twelve executor paths as `SUPPORTED`, with `controller=SERVER_AGENT` and `reason=SAVED_FOR_NEXT_FARM`. `execution.applied=false`, so no live effect is attested yet.
- `FIRST_BROKEN_TRANSITION=GET /api/farm-map-availability -> Dashboard handler`: the authenticated endpoint returned a server operation error. Dashboard stderr recorded `ReferenceError: Cannot access 'account' before initialization` at `ops/ro-stack/dashboard.mjs:10510:67`. The handler invokes `playerWorldMapAvailability(account)` before `const account = await resolveRequestAccount()` at line 10754 in the deployed Web candidate. Dashboard/API/Controller ownership routes this fix to workline A; F stopped before altering its Web source or attempting farm destination movement.
- Promotion remains `LEGACY_PRE_GITHUB_FIRST`, drift `OPEN`, phase `FIRST_PROMOTION_NATIVE_STAGE_COMPLETE`, same ACTIVE F lease. Final receipt, 42-row live gate, Fly/HIT, Supply/HIT, 38-capability product closure and Browser acceptance remain unproven. No finalization or lease release was attempted.
