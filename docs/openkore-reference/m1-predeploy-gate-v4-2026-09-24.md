# M1 predeploy evidence gate V4, 2026-09-24

Scope: source and monitoring-sidecar evidence only. No game service, database,
player, or Production gameplay binary was changed. The M1 product authority is
`docs/project-control/canonical-m1-world-travel-supply-ui-v1.md` at `76487252`.
Native source is `de168f566325f140c87b355a1d442dddabf0b8ad`; Web candidate
is `76487252f4257ec3b51cbc61c4d37f1ead40634e`.

## A. Current Production Native provenance

The current 5122 owner remains map PID `43092`, executable
`C:\Users\Administrator\ghost-island-production\ro-stack\.local\ro-stack\rathena\map-server.exe`,
SHA256 `294482A656BCE8DC3374514ADFCCC4D074ADD3D4CD90FD0C070D447D02D89B0B`.
The runtime Git base is `e985006`, but runtime source and
`.persistent-agent-build-stamp` are absent. A bounded search of the known
Production audit, deployment-backup, deploy-backup, log and ops locations found
no deploy or build receipt containing this executable hash. The existing
`character-reset-native-20260923-150322/deploy-receipt.json` binds source
`8e1db006` to a **different** executable hash
`5A4C445FF36BB9B2FA1558A988F85682E33DE54F68D11A72E967FE6D72E08198`.
Its PDB candidate hash matches the PDB still on disk, but its executable hash
does not match the running binary. The current executable's PE CodeView record
names the canonical source checkout and RSDS
`{1FCE783D-10FF-457B-9EBD-B2D8A12A2117}` age `15`; it does not encode a
source commit or the missing build/deploy receipt. The canonical source
checkout's present `map-server.exe` and `Release/map-server.exe` hashes also
differ from the running binary.

`DEPLOY_RECEIPT_FOUND=NO` for the current hash;
`BUILD_RECEIPT_FOUND=NO` for the current hash;
`SOURCE_CHECKPOINT_BOUND_TO_BINARY=NO`;
`CURRENT_PRODUCTION_NATIVE_LINEAGE=UNRESOLVED`.
The missing link is an accepted source checkpoint and build manifest/receipt
that bind to the exact running SHA256, followed by its deployment receipt.
Neither file timestamps nor matching strings establish that link.

## Independent accepted-capability source cross-check

The following **11 enumerated source capability groups** are present in the
clean `de168f5` archive. The cited introducing/accepted commits are ancestors
of `de168f5`, and the current source sites plus focused regressions were
checked. This is source preservation evidence, not executable equivalence to
the unproven running Production binary or a live transition test.

| Group | Accepted source and current evidence |
| --- | --- |
| SERVER_AGENT ownership | `f105f6c`; `src/map/persistent_agent.hpp` owner enum and `persistent_agent.cpp::controller_mode` require both control and ownership fields. |
| PERSISTENT_IDLE | `f105f6c`; `persistent_agent.hpp` mode enum, `persistent_agent.cpp::attach_runtime` idle state and read projection. |
| Safe quarantine | `f105f6c`; `persistent_agent.cpp::quarantine` invalidates execution, records reason, releases entity. |
| RECOVER_QUARANTINED_TO_IDLE | `61b6248`; admission, SQL CAS, attached-entity idle validation and confirmation in `persistent_agent.cpp`, `persistent_agent_state.cpp`, and `persistent_agent_quarantine_recovery_policy.hpp`. |
| Stale task cleanup | `61b6248`; `persistent_agent_state_begin_quarantine_idle_recovery` clears `task_type`, `task_id`, `task_phase`; C++ policy rejects a surviving task. |
| Stale owner cleanup | `f39e648`; `persistent_agent.cpp::request_load` rejects a live challenger and permits bounded offline stale-runtime reclaim through `persistent_agent_state_acquire_runtime`. |
| Stale target cleanup | `61b6248`; recovery CAS clears target map/rules and attach-time validation requires no current target. |
| Graceful shutdown | `19e2beb`; `persistent_agent_prepare_shutdown` cancels six timers and stops current actions; `persistent_agent_confirm_shutdown` confirms durable clean shutdown. |
| Current command contract | `866f423` plus `f1f6e08`; deployed and candidate `conf/persistent_agent_commands.json` both SHA256 `9CD430EA279CD93817A0C1501BE7AA3314966C9BF3C204F356B9F8ADC7673FC0`; PowerShell contract 487 checks and C++ contract 81 cases pass. |
| Farm/combat authority boundary | `f105f6c` lineage; `persistent_agent.cpp::issue_melee_attack` delegates to rAthena `unit_attack`; `report_melee_hit` requires authoritative monster HP reduction before `MONSTER_HIT`. |
| No OpenKore runtime dependency | `Test-PaRestartRestore.ps1` checks Native source dependency absence; running OpenKore process count is zero. |

`ACCEPTED_NATIVE_CAPABILITIES=11`, `CANDIDATE_PRESERVED_CAPABILITIES=11`,
`CANDIDATE_MISSING_CAPABILITIES=0` within this enumerated source inventory.
The Production binary provenance blocker remains open independently.

## B. Current-map ProcDump monitoring receipt

Before repair, ProcDump PID `57060` had the approved path and exact `-ma -n 2
-e 1 -f <ten filters> 43092 <dump-folder>` command, targeting map PID `43092`.
Its output path was
`.local/ro-stack/crash-capture/canonical-map-43092-20260923-173058/procdump.stdout.log`;
that file held only a UTF-16 BOM. The state receipt reported `FAILED` /
`PROCDUMP_OUTPUT_UNVERIFIED`; Windows reported no debugger attached. Two older
sidecars, PIDs `52468` and `19120`, targeted former map PIDs `47052` and
`28240`. Canonical `procdump64.exe -cancel <target-PID>` failed for all three
because their cancel events did not exist. After exact executable, command-line
and PID checks, the three un-attached ProcDump-only processes were terminated
using `Win32_Process.Terminate`; no game process was terminated.

The sentinel runs as SYSTEM, which lacked the ProcDump EULA acceptance recorded
for Administrator. Its automatic retry PID `28588` again produced only a
banner/BOM and no debugger. After validating this repeat failure and its exact
identity, that un-attached sidecar was terminated. The existing canonical
ProcDump command and approved binary SHA256
`D1FC99AE304BD1D2BF28ABEB62531DA959E2431916194981B88C958FD713A8E6`
were used under Administrator with hidden window, redirected logs, and the
protected capture directory. New sidecar PID `47864` targets map PID `43092`.
Its output at
`.local/ro-stack/crash-capture/canonical-map-43092-adminreattach-20260924-040757/procdump.stdout.log`
lists the exact process image/PID, first-chance plus unhandled monitoring,
all ten filters, two dumps maximum and that folder. Windows
`CheckRemoteDebuggerPresent` returned success and `true`. The source-side
`Invoke-MapProcDumpTick` rechecked the canonical guard and live output, then
wrote `.local/ro-stack/procdump-attachment-state.json` with
`runtimeGenerationId=ro-1790184652475`, `procdumpAttachedPid=43092`,
`procdumpProcessId=47864`, `procdumpAttachStatus=ATTACHED`, and the new output
directory. Login `13988`, char `50252`, map `43092`, Dashboard `21848` and
ports `6901/6122/5122/8788` were unchanged; `/api/health` remained `ok:true`.

The old source transition trusted the previous failed output directory when a
new approved sidecar replaced it. `runtime-procdump-sidecar.lib.ps1` now derives
and verifies the **current sidecar's** bounded output folder before recording
`ATTACHED`; the focused regression passed `14/14`. This source repair was not
deployed to Production. Current-PID monitoring is confirmed; automatic SYSTEM
reattachment after a future map restart still needs an EULA/identity operation
and is not claimed by this receipt. No crash was induced.

`PROCDUMP_PRECHECK=PASS`; `PROCDUMP_ATTACHMENT_CONFIRMED=YES` for PID `43092`;
`PROCDUMP_GATE=PASS` for the current map generation only.

## C. Web composition and D. canonical product authority

`git merge-base --is-ancestor 5beb3a39 b1f17698` exited zero; `5beb3a39`
is the direct parent of `b1f17698`. Web source and tests verify A
`ef_readyportal.wav` once, B `ef_portal.wav` as one loop, cancellation silencing
C/D, accepted preflight stopping B, complete C `warp.wav` then complete D
`ef_teleportation.wav`, closing only after authoritative arrival and D-ended,
and normal successful Fly playing D once. The five legacy Supply fields are
`UNAVAILABLE` rather than falsely attested as Native-supported. The exact
canonical document amendment is commit `76487252`, which descends from both
Web checkpoints. Source tests passed: teleport presentation `11`, world-map
teleport `40`, Supply cutover `70`, config capability `46 fields`, Native Supply
adapter `14`, Web canary `27`, canonical M1 doc `4`, and `node --check` on four
affected Web modules. No Browser acceptance was attempted.

## Full clean Native build and source regression

Git archive of `de168f566325f140c87b355a1d442dddabf0b8ad` has SHA256
`880CD777D85C0734811453B6A425C02238FB336B34345DDC83A604B140C2285D`.
Fresh full `rAthena.sln /t:Rebuild /p:Configuration=Release
/p:Platform=x64` completed with exit code zero in a separate build archive.
The built binary is
`C:\Users\Administrator\AppData\Local\Temp\m1-native-v4-de168f5\source\map-server.exe`,
SHA256 `28929DA878C3B29C403FF22A3795E6300340FB8DE4277EBB007EA261579FC2F3`.
Only existing compiler code-page warnings were emitted in the checked log;
there were no `error C*` or linker errors. Focused Native regressions passed:
M1 canonical Supply policy, C++ M1 Supply policy, PA command contract
`487+81`, quarantine recovery, nonconsumable ammo, missing-ammo safe block,
restart/restore `39`, and `git diff --check`. Web Settings mapping also passed.

## Gate

`SUPPORTED_BUT_NATIVE_IGNORED=0` for the five corrected Supply controls.
The stale AUTO_FARM reconciliation expectation was already corrected in V3;
`AUTO_FARM_RECONCILIATION_FAILURE_BLOCKS_DEPLOYMENT=NO` for that test.
`GAME_RUNTIME_TOUCHED=NO`, `PROCDUMP_MONITOR_TOUCHED=YES`,
`CONTROLLED_NATIVE_DEPLOY=NOT_RUN`, `REAL_PLAYER_MUTATED=0`,
`SECOND_RUNTIME_STARTED=NO`, `OPENKORE_RUNTIME_COUNT=0`.

`PREDEPLOY_GATE_READY=NO` because the exact current Production Native binary
lineage is unresolved. Return this evidence to Project Control. Do not deploy
Native/Web, restart game services, run Fly-to-HIT or Supply-to-HIT, or claim
desktop/mobile Browser acceptance in this task.
