# M1 basic recovery: no available action

Pinned OpenKore: `51de1ddfc4449ae5217f6886de702f87ca934030`.

| Field | Evidence |
| --- | --- |
| OPENKORE_FILE | `control/config.txt`; `src/AI/CoreLogic.pm` |
| OPENKORE_SYMBOL | `processSitAuto`; `processAutoItemUse`; `processAutoSkillUse` |
| OPENKORE_CONFIG | `sitAuto_hp_lower/upper`, `sitAuto_sp_lower/upper`, `sitAuto_over_50`, `useSelf_item`, `useSelf_skill` |
| OPENKORE_DEFAULT | `sitAuto_hp_lower 40`, `sitAuto_hp_upper 100`, `sitAuto_sp_lower 0`, `sitAuto_sp_upper 0`, `sitAuto_over_50 0` (`control/config.txt:290-295`) |
| OPENKORE_BEHAVIOR | `processSitAuto` only queues sit from idle/follow/eligible route when no attack is queued, no aggressive monster exists, weight is below 50% unless configured, and Basic Skill level 3 or Summoner Basic level 1 is learned (`CoreLogic.pm:2909-2962`). It stands at configured upper HP/SP thresholds, subject to optional safe-stand delay. |
| OPENKORE_TRANSITION | Low HP/SP and eligible sit predicate → `sitAuto` → sit → upper threshold → stand; a false predicate does not authorize forced sit. |
| CURRENT_GI_BEHAVIOR | `persistent_agent.cpp:2988-3118` tries items/skill, then forces sit; a supply route failure or prolonged no-progress yield quarantines. Existing Supply already pauses combat and preserves AUTO_FARM parent. |
| PORT_MAPPING | Reuse rAthena item/skill/sit and existing Supply journey. When no recovery action or legal sit is available, pause combat and keep a recoverable blocked phase; re-evaluate boundedly. No new combat engine or status authority. |

`RECOVERY_BLOCKED` is an explicit Ghost Island safety policy authorized by Project Control for the no-method case. It is not claimed to be an OpenKore state. OpenKore provides the sit predicate and item/skill decision reference; rAthena remains the authority for weight, learned skills, item use, combat and health. The accepted GI HP thresholds (30/60 by default) remain product configuration and are not relabeled as OpenKore defaults.

Last-good evidence: `docs/openkore-exit-source-of-truth.md` Gate 1B records HP 102→43, Red Potion 501 count 8→7, HP 43→102, and recovery complete. It does not establish the no-method branch. Source-only tests and build cannot establish live recovery or Browser acceptance.

## Source candidate, 2026-09-23

- Native `handle_survival` now stops the melee lease and active attack at recovery entry. Item and skill attempts continue through rAthena.
- No-method arbitration uses the pinned sit predicate. Eligible Supply uses the existing `handle_supply` path; unavailable Supply plus ineligible sit enters recoverable `RECOVERY_BLOCKED`, with a 1000 ms policy recheck and no attack/target processing. Safe authoritative HP/SP, an available local recovery action, or successful Supply can clear the block. `AUTO_FARM` parent intent stays unchanged.
- `live_runtime_phase` projects `RECOVERY_BLOCKED`. The phase is read-only and not a new persisted mode.
- Evidence: `tools/pa-recovery-policy/build-and-test-recovery-policy.ps1` passes its C++ predicates and source wiring checks; `tools/pa-supply-recovery/test-supply-recovery.mjs` passes 38/38; Release x64 solution build passed. No live runtime, Production or Browser acceptance was performed.
- Remaining parity: configurable `sitAuto_over_50` and wider OpenKore sit context are not exposed in M1; no new policy is inferred from them. The M1 capability census remains open outside this bounded branch.
