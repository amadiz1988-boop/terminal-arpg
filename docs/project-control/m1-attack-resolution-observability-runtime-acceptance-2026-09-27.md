# M1 attack-resolution diagnostic runtime acceptance

Status: `DIAGNOSTIC_COMPLETE_NORMAL_FIVE_MAP_ACCEPTANCE_PENDING`. Owner: F｜M1 最終整合. Lease: `869f1725-dbd0-452d-b9dd-37ee79cc3f9a`. This record covers the authorized temporary observer candidate only. No Stage2 melee canary was enabled.

## Provenance and safety

- Native source: clean GitHub commit `2eae230904970c7368e1d1f8752bf4b1033cb2cd`, descended from `433a3323efb9eca5c4e0963b9528df6261a3cd76`. F's source-SHA-locked Release x64 rebuild passed 13 offline programs. The deployed `map-server.exe` SHA-256 is `2075EAFE4D78459012ACC4D6D15DD9B94B658E0C2159013877B0DA7DBA7CD01B`; deployed config SHA-256 is `4A7392E038F4394E5B5CE7F5EB6F3CFD4C1E835D46EEC582DC9EFA608AE6FCF2` and config Git blob is `bf8064430a213d3e6caa03fb1868021d27d9dd5b`.
- Admission, same-lease amendment, three-artifact rollback, deploy, and post-deploy `verifyNativeStage` passed. The `433a3323` intermediate rollback and its config are retained. The Native promotion receipt is `.local/ro-stack/native-promotion-receipt-2eae23090497.json` under Production.
- Diagnostic identity was ordinary TEST_PLAYER account `2000163`, character `150105`, group `0`, `is_test=1`. The accepted temporary Lv170 Super Novice stat/equipment fixture was used for both low-risk and `ver_eju` checks. Stage2 remained off. No other farm map was exercised.

## Bounded observations

The trace-off baseline used normal authenticated `POST /api/grind-target` for `prt_fild05`, then normal `stop_farm`. AUTO_FARM, target, attack, and six kills with EXP change were observed in Production map log `20260927-000352-map.out.log`. The observer emitted no lines while off. This baseline proves combat resolution through kill/EXP; a separate authoritative `AUTO_FARM_HIT` was not emitted on lethal one-shot attacks. The baseline exceeded the requested three-resolution cap before stop and is recorded as a test-window deviation.

Observer-on restart set only `PERSISTENT_AGENT_ATTACK_OBSERVE=1`, selected char `150105`, and trace ID `m1-attobs-2eae-20260927-a1`. Its first ProcDump snapshot raced sidecar attachment; the immediately repeated snapshot confirmed the same map PID and ProcDump identity. The same `prt_fild05` fixture produced ordinary `issue_melee_attack → unit_attack → timer → battle → DAMAGE_APPLIED`, two kills, and no Stage2 lease path. Relevant Production map log: `20260927-000723-map.out.log`, lines 516–623. This is the semantic non-interference gate, not random-roll equivalence.

Normal authenticated `POST /api/grind-target` to `ver_eju` returned command `CONFIRMED`, authoritative arrival, and AUTO_FARM. Scenario trace ID: `scenario-change-farm-map-f100c254-4ca2-4ffe-a78d-223f1b9476a2`. The bounded observer stopped on the first `DAMAGE_APPLIED` after 3.83 seconds and normal `stop_farm` converged to `PERSISTENT_IDLE`. Production map log: `20260927-000723-map.out.log`, lines 642–712. Five `AUTO_FARM_ATTACK` requests occurred by stop convergence; these were two executed attacks plus requests coalesced onto existing timers.

| Request tick | Target | Player / target coordinates | HP/SP | Unit result and terminal classification |
| --- | --- | --- | --- | --- |
| `8297626750` | Recon Robot `3154`, entity `110029148` | `149,130` / `148,130`, distance 1 | `10930/361` | Immediate attack executed, hit roll 28 at HIT 445 vs FLEE 325, hit rate 100, damage 237 scheduled on timer 29 at tick `8297627170`, applied tick `8297627203`: monster HP `256000→255763`. `HIT`. |
| `8297626968` | same | same, distance 1 | `10930/361` | `unit_attack` returned `EXISTING_TIMER/ALREADY_SCHEDULED`, timer 58 pending for tick `8297627590`. `OTHER_EXACT: EXISTING_TIMER_ALREADY_SCHEDULED`. |
| `8297627203` | same | same, distance 1 | `10930/361` | Same pending timer 58. `OTHER_EXACT: EXISTING_TIMER_ALREADY_SCHEDULED`. |
| `8297627406` | same | same, distance 1 | `8561/361` | Same pending timer 58. `OTHER_EXACT: EXISTING_TIMER_ALREADY_SCHEDULED`. |
| `8297627625` | same | same, distance 1 | `8561/361` | Pending timer 73 after timer 58 had executed at tick `8297627593`. `OTHER_EXACT: EXISTING_TIMER_ALREADY_SCHEDULED`. |

Timer 58 independently reached `BATTLE_WEAPON_ATTACK`, `HIT_RESOLUTION`, damage calculation 235, and damage timer 64. That delayed damage applied after `stop_farm` at tick `8297628015`, monster HP `255763→255528`. `AUTO_FARM_HIT` for the first 237 damage was emitted at line 686. The character took 2369 damage after the first applied hit, remained above the 70% recovery threshold, and no `RECOVERING_ENTER`, `NO_LEGAL_RECOVERY_ACTION`, or death was emitted in this window. An earlier dry-run route graph returned `NO_LEGAL_ROUTE` for `prt_fild05→ver_eju`; the real Player endpoint used its canonical direct world-map teleport policy and succeeded. The dry-run graph result does not supersede the authoritative direct policy.

## Restoration and boundary

Both fixture `restored.json` receipts were written. Final authenticated Admin projection reports character `150105` as Lv7 Novice, `prt_fild05`, HP `71/71`, SP `17/17`, no farm target, and `PERSISTENT_IDLE`. The observer variables and Stage2 flag were explicitly unset for a final controlled restart. Final runtime has one login, one char, one map, one Dashboard and one database, ProcDump identity matches map PID `41616`, `/api/health` is true, OpenKore count is 0, complete quarantine roster count is 2. All three existing dump files predate candidate deployment; new dump count is 0. The diagnostic Native candidate remains deployed under the same lease, with Web Production still at its pre-existing candidate. No DB schema or gameplay rule was changed.

The previous `ver_eju` observation's first unproven transition was `AUTO_FARM_ATTACK → authoritative damage`. This diagnostic closes that evidence gap for one observed normal Player attempt: rAthena computed and applied damage. It does not close five-map acceptance, sustained combat, recovery, or the separate Player Web equipment classification gap. The next owner is Project Control / D for the resulting classification and separate normal acceptance.
