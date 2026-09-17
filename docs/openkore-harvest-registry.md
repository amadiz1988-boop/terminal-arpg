# OpenKore Harvest Registry

Governance / knowledge-preservation document. Created before OpenKore bridge /
runtime removal. This document does **not** reimplement features, does not
change runtime behavior, and does not change any OpenKore Exit status.

- TASK_TYPE: `GOVERNANCE / KNOWLEDGE PRESERVATION ONLY`
- SOURCE_CANONICAL: `ops/ro-stack/openkore-plugins/status-export/status-export.pl`
- SOURCE_OF_TRUTH: `docs/openkore-exit-source-of-truth.md`
- OPENKORE_EXIT_STATUS: `OPENKORE_REMOVED = NO` / `PRODUCTION_READY = NO` (unchanged)

## Scope rule used for these classifications

A capability is a **runtime-exit blocker** only when its absence would regress
CURRENT supported product behavior or remove required current authority. A
capability that OpenKore happens to implement but that is not part of current
supported product behavior is recorded as knowledge preserved and
implementation deferred, and MUST_IMPLEMENT_BEFORE_RUNTIME_EXIT = NO.

Preferred field values:

- `CURRENT_REPLACEMENT_STATUS`: `UNIQUE_NO_REPLACEMENT` | `PARTIAL_REPLACEMENT` | `HARVESTED_AUTHORITATIVE_COPY_EXISTS` | `DEFERRED`
- `MUST_IMPLEMENT_BEFORE_RUNTIME_EXIT`: `YES` | `NO`

Provenance shorthand: `SE` = `ops/ro-stack/openkore-plugins/status-export/status-export.pl`.

---

# A. UNIQUE_PROJECT_ARTIFACTS

Project-specific knowledge that currently lives only (or authoritatively) inside
the OpenKore bridge, or whose only complete copy is the bridge. All entries here
have `KNOWLEDGE_PRESERVED = YES`.

## A1. Onboarding (newbie) phase model

- SOURCE: `SE:172-198` (`%onboarding_phase_info`), `SE:2865-2878`
  (`onboarding_map_matches`, `is_onboarding_map`), `SE:2938-2944`
  (`set_onboarding_phase`), `SE:2990-3042` (`onboarding_move`,
  `onboarding_talk_at`), `SE:3044-3076` (`process_onboarding_dialog`),
  `SE:3078-3092` (`finish_onboarding`), `SE:4292-4485` (`process_onboarding`)
- TARGET_OWNER: SERVER_AGENT onboarding orchestrator (to be created);
  `ops/ro-stack/dashboard.mjs` quest journal projection;
  rAthena NPC `ops/ro-stack/templates/terminal_academy_job_change.txt` remains
  server authority for quest/variable mutation
- CURRENT_REPLACEMENT_STATUS: `PARTIAL_REPLACEMENT`
- MUST_IMPLEMENT_BEFORE_RUNTIME_EXIT: `YES`
- KNOWLEDGE_PRESERVED: `YES`
- DETAIL — Phase vocabulary (26 phases, in order):
  `starting`, `respawning`, `ship_wounded`, `ship_exit`, `island_captain`,
  `island_lumin`, `island_lumber`, `island_sailor`, `sail_izlude`,
  `izlude_captain`, `izlude_hun_intro`, `izlude_hun_drink`, `izlude_hun_finish`,
  `academy_route`, `academy_registration`, `academy_pet_intro`,
  `academy_training_route`, `academy_training_heal`, `academy_basic_skill`,
  `academy_training`, `academy_return`, `academy_graduation`, `academy_exit`,
  `returning_hunt`, `supernovice_relocating`, `supernovice_training`,
  `supernovice_ready`, `awaiting_map`.
  Each phase carries `[title, detail, target]` Chinese presentation strings.
  Map gating: `iz_int*|int_land*|izlude*|iz_ac01*|new_1-3`.
  Progression predicates: `quest_state(21001/21008/7471/7472/7473/4269/2293)`,
  `inventory_amount(611/6008/531/18730/569)`,
  `char.jobID`/`lv_job`/`skills.NV_BASIC.lv`/`points_skill`,
  `%onboarding_dialog_completed` per-phase dialog completion flags.
  Finish path: `academy_graduation` at `iz_ac01 (60,67)` → `academy_exit` →
  `finish_onboarding()` → `job_resume_pending` (see A3).
- REPLACEMENT_EVIDENCE (partial): onboarding quest IDs + titles already exist in
  `ops/ro-stack/dashboard.mjs:3189-3196` (`renewalNoviceQuests`) and
  `queryOnboardingProgress` (`dashboard.mjs:3198-3254`); server-side progression
  authority is the rAthena NPC template (`terminal_academy_job_change.txt`,
  quest IDs at lines 248-263); regression `scripts/test-renewal-onboarding.mjs`.
  The full phase state machine and its transition predicates have no
  authoritative copy outside `SE`.

## A2. Eden phase model

- SOURCE: `SE:199-234` (`%eden_phase_info`), `SE:3108-3118` (`set_eden_phase`),
  `SE:3810-3872` (`process_eden_dialog`), `SE:3874-3944`
  (`finish_eden_enrollment`, `finish_eden_equipment`), `SE:3963-4290`
  (`process_eden`), `SE:4597-4690` (`eden_exit_step`,
  `eden_return_kafra_destination`, `process_eden_return_kafra_dialog`,
  `eden_return_to_hunt_step`)
- TARGET_OWNER: SERVER_AGENT quest orchestrator +
  `ops/ro-stack/persistent-agent/quest-sequences/eden-course-a.json`;
  dashboard Eden projection `dashboard.mjs:3256-3573`
- CURRENT_REPLACEMENT_STATUS: `PARTIAL_REPLACEMENT`
- MUST_IMPLEMENT_BEFORE_RUNTIME_EXIT: `YES`
- KNOWLEDGE_PRESERVED: `YES`
- DETAIL — Phase vocabulary (in order): `route_officer`,
  `enter_headquarters`, `route_secretary`, `register_member`,
  `equipment_accept`, `equipment_route_field`, `equipment_dog`,
  `equipment_hunt_condor`, `equipment_hunt_wolf`, `equipment_hunt_scorpion`,
  `equipment26_accept`, `equipment26_route_field`, `equipment26_karl`,
  `equipment26_hunt_skeleton`, `equipment26_hunt_poporing`,
  `equipment26_report_boya`, `equipment26_reward`, `equipment40_accept`,
  `equipment40_route_field`, `equipment40_hooksha`, `equipment40_hunt_baby`,
  `equipment40_hunt_warrior`, `equipment40_hunt_lady`,
  `equipment40_report_boya`, `equipment40_reward`, `equipment_sync_target`,
  `equipment_report_boya`, `equipment_reward`, `equipment_closing_dialog`,
  `equipment_supply`, `equipment_returning_hunt`, `equipment_complete`,
  `returning_hunt`, `complete`.
  Tier task IDs: `member` → `equipment12` (≥Lv.12) → `equipment26` (≥Lv.26) →
  `equipment40` (≥Lv.40). Dialog select steps: `enter_headquarters=[1]`,
  `register_member=[2,1]`, `equipment_accept=[2,1,1]`,
  `equipment26_accept=[2]`, `equipment_dog=[2]`, `equipment_reward=[1,2]`,
  `equipment26_reward=[1,2]`, `equipment40_accept=[1]`,
  `equipment40_reward=[1,2]` (`SE:3846-3857`).
  Eden HQ escape is via in-building Kafra (`moc_para01 35,23`) because butterfly
  wings are blocked inside `moc_para01`; destination choice
  `prt_fild05=1`, `prt_fild07=2`, `prt_fild04=3`, `pay_*=4`, `moc_*|iz_*=5`
  (`SE:4603-4611`).
- REPLACEMENT_EVIDENCE (partial): Course A (`7128`-`7132`) has a full
  SERVER_AGENT step sequence in
  `ops/ro-stack/persistent-agent/quest-sequences/eden-course-a.json`
  (`sequenceId: eden_course_a_v1`) and a journal contract in
  `ops/ro-stack/persistent-agent/quest-journal-contract.mjs:10-27`;
  `equipment26`/`equipment40` have dashboard projections and `implemented:true`
  milestone flags (`dashboard.mjs:3300-3320`) but no SERVER_AGENT sequence.
  The phase state machine, dialog choice steps and Kafra-return logic have no
  authoritative copy outside `SE`.

## A3. Job / job-change phase model

- SOURCE: `SE:235-246` (`%job_routes`), `SE:274-281` (`job_route_target`,
  `job_route_distance`), `SE:283-288` (`job_resume_target`),
  `SE:449,4549-4567` (`process_dialog_cancel`), `SE:4569-4595`
  (`fail_job_resume`), `SE:4692-4802` (`process_job_resume`),
  `SE:4804-4810` (`process_job_death`), `SE:4812-4821`
  (`process_job_route_retry`), `SE:5424-5472` (`job_resume`, `job_route`,
  `job_talk` commands)
- TARGET_OWNER: `ops/ro-stack/quest-runtime/job-adapter-contract.mjs` +
  per-job adapters (`assassin-adapter.mjs`, `rogue-adapter.mjs`,
  `knight-adapter.mjs`, `crusader-adapter.mjs`) + rAthena NPC
  `ops/ro-stack/templates/terminal_academy_job_change.txt`
- CURRENT_REPLACEMENT_STATUS: `PARTIAL_REPLACEMENT`
- MUST_IMPLEMENT_BEFORE_RUNTIME_EXIT: `YES`
- KNOWLEDGE_PRESERVED: `YES`
- DETAIL — Job-change NPC route table (all 10 first-job branches route to
  `iz_ac01, 60, 67`): `swordman`, `mage`, `archer`, `acolyte`, `merchant`,
  `thief`, `supernovice`, `taekwon`, `gunslinger`, `ninja`.
  Level→resume-map table (`job_resume_target`):
  `lv >= 26 → pay_dun00 (73,78)`, `lv >= 12 → moc_fild11 (180,253)`,
  else `prt_fild08 (170,374)`.
  `job_resume_pending` sub-state machine: `0 → 1 → 2 → 3` guarding
  stand-up, `moc_para01` Kafra return vs direct `move`, arrival confirmation
  at target map, then `lockMap` + `teleportAuto_idle=1` + `ai auto`.
  Recovery bounds: `job_resume_started_at >= 600s → route_timeout`;
  4 recovery attempts → `route_stuck`; `job_route_retry` reissues
  `move <map> <x> <y> 3`.
- REPLACEMENT_EVIDENCE (partial):
  `docs/RO_FIRST_JOB_CHANGE_PLAN.md` defines current product rules and server
  authority; `job-adapter-contract.mjs` defines eligibility/commit contract and
  `finalCommit.commitType = JOB_CHANGE`; `dashboard.mjs:5496-5497` mirrors the
  resume-map selection; the deprecated per-guild job-change path is already
  retired in docs. The OpenKore resume/return state machine and its route
  coordinates have no authoritative copy outside `SE`.

## A4. Quest-ID tables and quest-ID → mob/map/phase mappings

- SOURCE: `SE:1565-1577` (`eden_target_allowed`), `SE:1632-1654`
  (`hold_eden_target_policy`), `SE:1695-1720` (`eden_map_change_guard`),
  `SE:3172-3192` (`eden_current_combat_progress`), `SE:3383-3407`
  (`eden_reward_equip_items`), `SE:3634-3647`
  (`eden_equipment_rewards_complete`/`26`/`40`), `SE:3649-3663`
  (`eden_equipment_quest_id`), `SE:4001-4260` (tier routing),
  `SE:5748-5759` (onboarding `questStates` projection)
- TARGET_OWNER: `dashboard.mjs` (`renewalNoviceQuests`, Eden quest tables),
  `ops/ro-stack/persistent-agent/quest-journal-contract.mjs`,
  rAthena NPC templates
- CURRENT_REPLACEMENT_STATUS: `PARTIAL_REPLACEMENT`
- MUST_IMPLEMENT_BEFORE_RUNTIME_EXIT: `YES` (for the tier→mob→map→phase
  authority; the raw quest-ID/reward tables are already harvested)
- KNOWLEDGE_PRESERVED: `YES`
- DETAIL — Onboarding quest IDs: `21001`, `21008`, `7471`, `7472`, `7473`,
  `4269`, `2293`.
  Eden tier quest-ID sets: equipment12 `{7128,7129,7130,7131,7132}`,
  equipment26 `{7138,7139,7140,7141}`, equipment40 `{7147,7148,7149,7150,7151}`.
  Quest → mob → map → phase:
  `7129/#1009 Condor/moc_fild11`, `7130/#1107 Baby Desert Wolf/moc_fild11`,
  `7131/#1001 Scorpion/moc_fild11`, `7139/#1076 Skeleton/pay_dun00`,
  `7140/#1031 Poporing/pay_dun00`, `7148/#1686 Orc Baby/gef_fild10`,
  `7149/#1023 Orc Warrior/gef_fild10`, `7150/#1273 Orc Lady/gef_fild10`.
  equipment40 target guard forces Orc Lord (`#1190`) and Orc Archer
  (`#1189`) mon_control to `attack_auto=-1, teleport_auto=1`
  (`SE:1650-1653`). Rewards: equipment12 `{5583, 2560, 2456, 15009}`,
  equipment26 `{2457, 15010}` (+`1747` bow alt), equipment40 `{2458, 15011}`.
  Eden membership markers: items `6219` or `22508`.
- REPLACEMENT_EVIDENCE (partial): `dashboard.mjs:3256-3299` holds the same
  quest→mob→goal and reward tables; `quest-journal-contract.mjs:16-27` holds
  Course A mobs/rewards; `quest-sequences/eden-course-a.json` embeds the
  Course A quest→NPC→map order. The equipment26/equipment40 quest→mob→map→phase
  guard (including the Orc Lord escape policy) exists only in `SE`.

## A5. `quest_runtime_agent` state shape

- SOURCE: `SE:146-153` (module state), `SE:1924-1992`
  (`quest_runtime_command_is_stale`, `quest_runtime_accept_command`),
  `SE:1994-2020` (`quest_runtime_finish`, `quest_runtime_fail`),
  `SE:2586-2677` (`process_quest_runtime_agent`), `SE:2893-2911`
  (`quest_runtime_agent_json`), `SE:919-950`
  (`quest_runtime_state_path`, write/load), `SE:1495-1522`
  (`quest_runtime_emit`)
- TARGET_OWNER: `ops/ro-stack/quest-runtime/contracts.mjs`, `runtime.mjs`,
  `agent-events.mjs`, `service.mjs`, `store.mjs`; OpenKore bridge replaced by
  `ops/ro-stack/quest-runtime/openkore-bridge.mjs`
- CURRENT_REPLACEMENT_STATUS: `HARVESTED_AUTHORITATIVE_COPY_EXISTS`
- MUST_IMPLEMENT_BEFORE_RUNTIME_EXIT: `NO` (the OpenKore *executor* that
  consumes this shape is a runtime blocker; see C4)
- KNOWLEDGE_PRESERVED: `YES`
- DETAIL — Persisted JSON `quest-runtime-agent.json` fields:
  `identity{charId, accountId, questSessionId, objectiveId, generation,
  sourceRevision}`, `protocolVersion`, `missionStage.type`, `objective{type,
  map, x, y, range, waypoints[], waypointRange, timeoutSeconds,
  completionQuestId, trialBoundary{map,minX,maxX,minY,maxY},
  unavoidableThreatPolicy, blockedThreatRange, preserveNavigationHold,
  serverCommand{name,arguments}, completionServerCommand, prepareCommand,
  prepareFromMap, requirements.items[]}`, `combatPolicy{mode, targets, names,
  engageAllowedTargets, avoidHostiles, avoidHostilesRange}`, `stage`,
  `eventSequence`, `startedAt`, `attempts`, `waypointIndex`, `avoidanceMoves`,
  `avoidanceState`, `prohibitedAttackStarts`, `prohibitedAttackPackets`,
  `offensiveSkillPackets`, `blockedAvoidanceTargets`, `dead`, `active`.
  Objective executor types: `SUPPLY`, `COMBAT_HOLD`, `SERVER_COMMAND`,
  `NO_KILL_ROUTE`, `GO_MAP`/`NAVIGATION`. Staleness rule: reject when same
  `questSessionId` and `generation` lower, or equal generation with
  `sourceRevision <= current`.
  Event file contract: `quest-events/<20-digit-ms>-<6-digit-seq>.event`
  (atomic `.pending` → rename) with
  `eventId = evt:<questSessionId>:<generation>:<sequence>`.
- REPLACEMENT_EVIDENCE: `quest-runtime/contracts.mjs` is the authoritative
  enum/validator source (`QuestStatus`, `InterruptPolicy`, `RiskLevel`,
  `PreflightStatus`, `CombatPolicy`, `MissionStageType`, `QuestStepType`,
  `CommitType`, `ObjectiveCompletionMode`) and
  `docs/QUEST_RUNTIME_FOUNDATION.md` documents the full round trip.
  The `prohibited*`/`offensiveSkillPackets` instrumentation counters are
  observability-only and are projected by `SE`; they have no server-side
  counterpart but carry no authority.

## A6. Status domain / revision contract

- SOURCE: `SE:882-907` (`web_status_interval`, `web_command_interval`),
  `SE:909-917` (`observe_domain_revision`), `SE:5568-5586` (export loop),
  `SE:5670-5710` (per-domain fingerprint + revision computation),
  `SE:5770-5784` (snapshot envelope), `SE:789-880`
  (web-presence marker read/expiry contract)
- TARGET_OWNER: `ops/ro-stack/web-observation.mjs`
  (`ObservationInterest`, `ObservationDomain`, `OBSERVATION_POLICY`,
  `DomainRevisionTracker`, `revisionKeyForInterest`, `projectLiveSnapshot`),
  `ops/ro-stack/web-presence.mjs`, `dashboard.mjs`
- CURRENT_REPLACEMENT_STATUS: `HARVESTED_AUTHORITATIVE_COPY_EXISTS`
- MUST_IMPLEMENT_BEFORE_RUNTIME_EXIT: `NO`
- KNOWLEDGE_PRESERVED: `YES`
- DETAIL — Domains: `combat`, `vitals`, `quest`, `inventory`, `ownership`,
  `social`, `journal`, `events`, `map`. Envelope keys: `grindHubTransitionVersion`,
  `webViewMode` (`high|low|hidden|none`), `webInterest`, `statusIntervalMs`,
  `includedDomains[]`, `domainRevisions{}`. Fingerprint inputs per domain
  (vitals = hp/sp/weight/levels/exp/zeny; map = map+coords; combat = attack/
  def/hit/flee/critical + monsters + players; inventory = inventory+skills;
  quest = missions + eden/onboarding envelope + npc dialog; events = task
  events). Interval policy by interest (COMBAT 0.30s status / 0.25s command …).
  Web-presence marker contract: files `commands/web-presence-{high,low,hidden}.json`
  with `expiresAt` (ms), `interest`, `domains[]`, `statusExportMs`,
  `commandPollMs`; expiry unlinks the marker.
- REPLACEMENT_EVIDENCE: `web-observation.mjs` contains the authoritative
  `DomainRevisionTracker` (fingerprint→revision bump), `OBSERVATION_POLICY`
  intervals, domain→interest mapping and live-field projection;
  `web-presence.mjs` defines presence semantics; canonical PA Gate 3 already
  produced `LIVE_STATUS_EXPORT = PASS` server-side. `SE` remains the legacy
  client-side producer only.

## A7. Grind-hub transition state machine

- SOURCE: `SE:162-169` and `SE:379-410` and `SE:1258-1335`
  (`LEGACY_OPENKORE_COMPATIBILITY_HOTFIX` Kafra close gate),
  `SE:952-1058` (state file, validation, background-AI quiesce),
  `SE:1060-1144` (restore + fail), `SE:1146-1210`
  (finish/accept), `SE:1212-1256` (`process_grind_hub_dialog`),
  `SE:1338-1488` (`process_grind_hub_transition`), `SE:247-273`
  (`%grind_hubs`), `SE:2913-2930` (`grind_hub_transition_json`)
- TARGET_OWNER: `ops/ro-stack/grind-hub-routing.mjs` (hub table only) +
  SERVER_AGENT map/save relocation (to be completed)
- CURRENT_REPLACEMENT_STATUS: `PARTIAL_REPLACEMENT`
- MUST_IMPLEMENT_BEFORE_RUNTIME_EXIT: `YES`
- KNOWLEDGE_PRESERVED: `YES`
- DETAIL — State machine stages: `requested → routing → saving → closing →
  verifying → complete | failed`. Guard constants: `route_ready_grace = 1.0s`,
  `route_stall_seconds = 45s`, routing timeout `300_000ms`, route failure
  limit `3`, `npc_close_delay = 0.4s`, `npc_close_timeout = 8.0s`,
  verification timeout `20_000ms`.
  Dialog interaction: find "Save" response by `/^\s*Save\s*$/i`, send response
  index+1, then close gate. Close gate: `sendTalkCancel`,
  `npcDialogCloseRequestedAt`, prefer server ack via packet `npc_image type=255`
  (cutin clear) → `npcDialogCloseAck='image_clear'`, else bounded fallback
  `bounded_client_clear` after 1500ms. Verification: `ai_useTeleport(2)`
  (butterfly wing) lands on server save point; `verificationMap` must equal
  `hub.saveMap`; `config saveMap` intentionally not used for acceptance.
  Finish writes `saveMap/saveMap_x/saveMap_y`, `storageAuto_npc`,
  `sellAuto_npc`, `buyAuto_0_npc`, `route_warpByItem=1`,
  `route_warpByItem_chaining=0`, `route_warpByItem_minDistance=150`,
  `route_warpItem_minGain=40`, `saveMap_warp=1`,
  `saveMap_warp_minDistance=80`, `lockMap=<target>`.
- REPLACEMENT_EVIDENCE (partial): the 5 hub definitions with exact NPC/save
  coordinates are harvested in `ops/ro-stack/grind-hub-routing.mjs:1-27`
  (prontera, payon, morocc, geffen, izlude) and consumed by `dashboard.mjs`;
  W4 (`docs/openkore-exit-source-of-truth.md`) proved server-side cross-map
  relocation but **not** the Kafra save-point change transition. The state
  machine, MSI_BUSY workaround and close-ack semantics have no authoritative
  replacement outside `SE`; the source itself labels them
  `REMOVE_AFTER_SERVER_AGENT_GATE3_W4_MIGRATION`.

## A8. Grind / supply circuit-breaker behavior

- SOURCE: `SE:489-525` (`record_failed_map_route`), `SE:527-554`
  (`process_supply_route_abort`), `SE:556-570`
  (`process_navigation_route_resume`), `SE:572-692` (grind-target recovery),
  `SE:694-718` (supply storage/weight backoff), `SE:2946-2963`
  (`process_stuck_recovery`), `SE:4549-4567` (dialog cancel),
  `SE:3205-3221` (Eden combat death breaker), `SE:3223-3297` (Eden recovery)
- TARGET_OWNER: SERVER_AGENT controller supply policy +
  `dashboard.mjs` grind-target handling
- CURRENT_REPLACEMENT_STATUS: `PARTIAL_REPLACEMENT`
- MUST_IMPLEMENT_BEFORE_RUNTIME_EXIT: `YES`
- KNOWLEDGE_PRESERVED: `YES`
- DETAIL — Route circuit breaker: same `(from,to)` or 30s window, 3 consecutive
  `fail_calc_map_route` → abort; supply failures set `supply_retry_after = +300s`;
  navigation failures clear `lockMap`, save resume map, retry after `+300s`.
  Supply weight breaker: if post-storage weight ≥ `itemsMaxWeight_sellOrStore`
  and not reduced → `supply_retry_after = +300s`.
  Grind-target guard: check every 2s; stall threshold 90s; 3 idle seconds to arm;
  5s min action gap; 3 attempts → 60s backoff. Triggers: `lockMap` mismatch,
  automation paused, forced sit, outside-target idle, on-target combat+position
  idle. Healing actions: restore `lockMap`, `route_randomWalk=1`,
  `teleportAuto_idle=1`, `ai auto`, 1-step walkable nudge.
  Eden safety: HP < 60% pauses and recovers to 90% (600s timeout, fly-wing on
  aggression); 2 deaths at same quest progress → `combat_power_insufficient`;
  3 NPC dialog attempts without quest progress → `npc_no_progress`.
- REPLACEMENT_EVIDENCE (partial): server-side supply policy exists
  (`PERSISTENT_AGENT_SUPPLY_ENABLED/ITEM/MIN/TARGET/NPC/GRACE_MS/MAX_RETRIES`,
  `SUPPLY_CONFIG_INVALID` fail-fast) and quest-runtime documents a death
  circuit breaker (`docs/QUEST_RUNTIME_FOUNDATION.md` #16). The grind-target
  idle-recovery heuristic and the route/supply backoff constants are unique to
  `SE`.

## A9. Config snapshot / rollback behavior

- SOURCE: `SE:1060-1094` (`grind_hub_quiesce_background_ai`,
  `grind_hub_restore_background_ai`), `SE:1096-1115`
  (`grind_hub_restore_prior_route_settings`), `SE:1117-1144`
  (`grind_hub_transition_fail`), `SE:720-756`
  (`reserve_storage_zeny`, `restore_supply_buy_limits`),
  `SE:3120-3159` (Eden settings hold/restore), `SE:1767-1828`
  (quest-runtime policy/hold restore + apply), `SE:1830-1863`
  (background automation suspend/restore), `SE:3299-3349`
  (`supply-guard.txt` write/recover)
- TARGET_OWNER: `ops/ro-stack/quest-runtime` policy lifecycle
  (`TRIAL_POLICY_APPLIED`/`TRIAL_POLICY_RELEASED`) for semantic parity
- CURRENT_REPLACEMENT_STATUS: `PARTIAL_REPLACEMENT`
- MUST_IMPLEMENT_BEFORE_RUNTIME_EXIT: `NO` (OpenKore config keys are
  implementation-specific; the semantic requirement to restore prior
  combat/navigation behavior is already owned by quest-runtime policy release)
- KNOWLEDGE_PRESERVED: `YES`
- DETAIL — Snapshot key groups captured and deterministically restored:
  background AI `attackAuto, route_randomWalk, itemsTakeAuto,
  teleportAuto_idle`; prior `attackAuto`; route options
  `lockMap_x/y/randX/randY, route_warpByItem(+chaining,+minDistance),
  route_warpItem_minGain, saveMap_warp(+minDistance)`; hub config
  `lockMap, saveMap, saveMap_x/y, storageAuto_npc, sellAuto_npc`;
  quest-runtime `priorLockMap, priorRandomWalk, priorIdleTeleport,
  priorBackgroundAutomation{storageAuto, sellAuto, autoTalkCont,
  buyAutoDisabled{}}, priorAttackAuto, priorAttackOptions
  {attackAuto_routeToLock/outOfLock/party/followTarget}, priorMonControl{key →
  {existed, value}}`; supply buy limits
  `buyAuto_<i>_{maxAmount,batchSize}`.
  Crash-safe guard file `supply-guard.txt` (`attackAuto=<n>`,
  `itemsTakeAuto=<n>`) is read once on startup to recover interrupted supply.
- REPLACEMENT_EVIDENCE: quest-runtime contract/policy lifecycle already
  implements deterministic release (`docs/QUEST_RUNTIME_FOUNDATION.md`,
  `contracts.mjs` `assertCombatPolicy`). The OpenKore-specific key names and the
  `supply-guard.txt` crash guard are not needed server-side.

## A10. Project-specific constants and state semantics (no other copy)

- SOURCE: multiple `SE` ranges listed per item
- TARGET_OWNER: per-item
- CURRENT_REPLACEMENT_STATUS: `PARTIAL_REPLACEMENT` (mixed)
- MUST_IMPLEMENT_BEFORE_RUNTIME_EXIT: `YES` for items marked `[BLOCKER]`,
  otherwise `NO`
- KNOWLEDGE_PRESERVED: `YES`
- DETAIL:
  - `[BLOCKER]` Fly-Wing/Butterfly item IDs: `601` (Fly Wing),
    `602` (Butterfly Wing), `501` (Red Potion), `569` (novice potion),
    `531` (Hun juice), `1750` (archer arrow), `1742` (bow repair trigger)
    (`SE:601, 334-347, 3517, 4388, 4718-4739`). Source-of-truth keeps the
    non-consume Fly Wing rule for item `601`.
  - `[BLOCKER]` Quest server-command contract:
    `terminal_<job>_sync` with ≤16 args matching
    `/^[A-Za-z0-9_.:-]{1,64}$/` (`SE:2051-2065`); mirrored authoritatively by
    `quest-runtime/job-adapter-contract.mjs:18-33`.
  - `[BLOCKER]` `@terminal_archer_repair` / `@terminal_expanded_repair`
    triggers: archer (job 3) bow `1742`; gunslinger (job 24) weapon `13101` +
    ammo `13200` min Lv.10; ninja (job 25) weapon `13010` + ammo `13250` min
    Lv.12 (`SE:3094-3106, 4526-4547`).
  - `[BLOCKER]` `test_onboarding_accelerate` gate (`@jlvl +N`) restricted to
    `jobtest_ob_*`, job 0, phase `academy_training`, Job Lv.5-9
    (`SE:5487-5499`) — test acceleration authority.
  - `[BLOCKER]` Web observation interval contract keys
    `statusExportMs`/`commandPollMs` bounds (`250-30000` / `200-5000`)
    (`SE:846-853`).
  - `NO` Social contract: channel aliases `Global/Map/Trade/Support/Ally`;
    allowed emotion IDs `{0,1,2,3,4,5,7,9,10,12,14,15,16,17,20,21,23,26,28,
    29,30,33,36,45,46}`; social log JSONL at `RO_SOCIAL_LOG`
    (`SE:4892, 4903, 5010, 4823-4839`).
  - `NO` Item action contract: `use` (usable), `equip` (equippable), `unequip`
    (equipped), `card` merge (mergeable into equippable) (`SE:5508-5536`).
  - `NO` Skill automation mapping: `attackSkillSlot_0`, `useSelf_skill_0`
    (self recovery), `useSelf_skill_1` (buff); allowed buff status-source map
    `{SM_ENDURE→EFST_ENDURE, AL_ANGELUS→EFST_ANGELUS,
    AC_CONCENTRATION→EFST_CONCENTRATION, MC_LOUD→EFST_SHOUT}`; slot-0 reserved
    as disabled placeholder (`SE:2706-2732, 5050-5206`).
  - `NO` Task event ring buffer: max 80 events, dedupe by
    `type|title|detail|target` (`SE:2679-2704`).
  - `NO` Eden reward auto-equip groups (first available per group):
    `[5583],[2560],[2458,2457,2456],[15011,15010,15009],`
    `[1193,13424,13051,16005,1748,1651,13113,26100,1192,13423,13050,16004,`
    `1747,1650,13112,1699]`; archer (job 3) additionally equips ammo `1750`
    (`SE:3383-3407`).
  - `NO` Eden completion markers: equipment12 membership items
    `6219`/`22508`; reward-complete checks as listed in A4 (`SE:3966, 3634-3647`).
  - `NO` Task position/dialog bookkeeping: `last_task_map/x/y`,
    `last_position_changed_at`, dialog cancel window (`+3s`, 15s timeout)
    (`SE:2965-2982, 4549-4567`).
  - `NO` Grind target file schema: `grind-target.json` with `mapId` validated
    `/^[a-z0-9_]{1,31}$/` (`SE:963-988`).
  - `NO` Grind hub file schema: `grind-hub-transition.json` validated against
    the 5-hub allowlist and exact hub key equality
    (`npcMap,npcX,npcY,saveMap,saveX,saveY,storageNpc,shopNpc`)
    (`SE:990-1034`).

---

# B. OPENKORE_IDEAS_ALREADY_HARVESTED

Generic OpenKore architecture that has an authoritative project copy or that
was already replaced by SERVER_AGENT. These must not be re-documented or
re-copied from `SE`.

| # | Idea / capability | SOURCE (OpenKore) | TARGET_OWNER | CURRENT_REPLACEMENT_STATUS | MUST_IMPLEMENT_BEFORE_RUNTIME_EXIT | KNOWLEDGE_PRESERVED |
| --- | --- | --- | --- | --- | --- | --- |
| B1 | Grind-hub city table (5 hubs, exact NPC/save coords) | `SE:247-273` | `ops/ro-stack/grind-hub-routing.mjs:1-27` | `HARVESTED_AUTHORITATIVE_COPY_EXISTS` | NO | YES |
| B2 | Eden Course A quest sequence (7128-7132) | `SE:4001-4090` | `persistent-agent/quest-sequences/eden-course-a.json`, `quest-journal-contract.mjs` | `HARVESTED_AUTHORITATIVE_COPY_EXISTS` | NO | YES |
| B3 | Quest runtime contract (identity, stage, combat policy) | `SE:1924-2677` | `quest-runtime/contracts.mjs` + `runtime.mjs` + docs | `HARVESTED_AUTHORITATIVE_COPY_EXISTS` | NO | YES |
| B4 | Status domain/revision + observation policy | `SE:882-917, 5670-5784` | `web-observation.mjs` | `HARVESTED_AUTHORITATIVE_COPY_EXISTS` | NO | YES |
| B5 | Web presence model (marker expiry, view modes) | `SE:789-880` | `web-presence.mjs`, `web-observation.mjs` | `HARVESTED_AUTHORITATIVE_COPY_EXISTS` | NO | YES |
| B6 | Basic combat loop (target/move/attack/kill/loot) | `SE` hooks + OpenKore AI | rAthena persistent agent (`persistent_agent.cpp`) | `HARVESTED_AUTHORITATIVE_COPY_EXISTS` (Gate 1A `PLAYER_FLOW_PASS`) | NO | YES |
| B7 | Survival / death / respawn / recovery | OpenKore survival AI | `persistent_agent.cpp` (`handle_survival`, `handle_death`) | `HARVESTED_AUTHORITATIVE_COPY_EXISTS` (Gate 1B `PLAYER_FLOW_PASS`) | NO | YES |
| B8 | Supply cycle (buy-based) | `SE:2067-2179, 694-756` | SERVER_AGENT `handle_supply` + server config | `HARVESTED_AUTHORITATIVE_COPY_EXISTS` (Gate 2 `PLAYER_FLOW_PASS`) | NO | YES |
| B9 | Multi-map / cross-map navigation + death return | OpenKore `Task::MapRoute` | rAthena warp/route data + `persistent-agent/map-route.mjs` | `HARVESTED_AUTHORITATIVE_COPY_EXISTS` (Gate 3 `PLAYER_FLOW_PASS`) | NO | YES |
| B10 | Server-side live runtime status export | client-side `status.json` | canonical PA `LIVE_STATUS_EXPORT` | `HARVESTED_AUTHORITATIVE_COPY_EXISTS` (Gate 3) | NO | YES |
| B11 | W1-W4 web wiring (canary, autonomous state, supply state, map) | `SE` status/command files | `.tmp-web-server-agent-w4-closure` lineage | `HARVESTED_AUTHORITATIVE_COPY_EXISTS` | NO | YES |
| B12 | Generic OpenKore plugin/event-hook architecture (`Plugins::addHooks`, AI queue, `configModify`, packet hooks) | whole `SE` skeleton | N/A - implementation framework, not project knowledge | `HARVESTED_AUTHORITATIVE_COPY_EXISTS` (not project-specific) | NO | YES |
| B13 | JSON status projection field names (inventory/skills/actors/missions) | `SE:2792-2833, 5587-5764` | `web-observation.mjs` projections + dashboard | `HARVESTED_AUTHORITATIVE_COPY_EXISTS` | NO | YES |

---

# C. CURRENT_EXIT_BLOCKERS

Knowledge/capability that is part of CURRENT supported product behavior and has
no complete non-OpenKore owner. While any of these is unimplemented, literally
removing the OpenKore runtime regresses current behavior. All entries have
`KNOWLEDGE_PRESERVED = YES`.

## C1. `.cmd` / `.result` command transport and web-presence marker files

- SOURCE: `SE:4929-5556` (`process_commands`), `SE:789-800`
  (`web_presence_marker_path`), `SE:3305-3349` (`supply-guard.txt`)
- TARGET_OWNER: Dashboard `/api` command queue + SERVER_AGENT command contract
  (`conf/persistent_agent_commands.json`)
- CURRENT_REPLACEMENT_STATUS: `PARTIAL_REPLACEMENT` (SERVER_AGENT path exists;
  OpenKore-owned characters still use `.cmd`/`.result`)
- MUST_IMPLEMENT_BEFORE_RUNTIME_EXIT: `YES`
- KNOWLEDGE_PRESERVED: `YES`

## C2. OpenKore `status.json` / worker / `start.exe` removal (Gate 5)

- SOURCE: `SE:5766-5804` (`RO_STATUS_SNAPSHOT`), matrix #38/#40 in
  `docs/openkore-exit-source-of-truth.md`
- TARGET_OWNER: Dashboard live-status reader + SERVER_AGENT live export
- CURRENT_REPLACEMENT_STATUS: `PARTIAL_REPLACEMENT`
  (server-side `LIVE_STATUS_EXPORT = PASS`, removal count still 0)
- MUST_IMPLEMENT_BEFORE_RUNTIME_EXIT: `YES`
- KNOWLEDGE_PRESERVED: `YES`

## C3. NPC / Quest (Gate 4) generic player flow

- SOURCE: matrix #24-#27 (`SOURCE_ONLY`) in
  `docs/openkore-exit-source-of-truth.md`
- TARGET_OWNER: SERVER_AGENT NPC/quest handlers + rAthena script state
- CURRENT_REPLACEMENT_STATUS: `PARTIAL_REPLACEMENT` (`SOURCE_ONLY`)
- MUST_IMPLEMENT_BEFORE_RUNTIME_EXIT: `YES`
- KNOWLEDGE_PRESERVED: `YES`

## C4. Quest Runtime executor currently inside the OpenKore plugin

- SOURCE: `SE:1490-2677` (events, policy, supply, navigation, combat hold,
  no-kill route, server command), `SE:5020-5037` (`quest_runtime_apply`,
  `quest_server_command`)
- TARGET_OWNER: SERVER_AGENT objective executor
- CURRENT_REPLACEMENT_STATUS: `PARTIAL_REPLACEMENT` (contract/runtime exist
  server-side; execution for quest objectives is via OpenKore)
- MUST_IMPLEMENT_BEFORE_RUNTIME_EXIT: `YES`
- KNOWLEDGE_PRESERVED: `YES`

## C5. Grind-hub Kafra save-point transition (legacy compat hotfix)

- SOURCE: `SE:162-169, 379-410, 1121-1135, 1258-1335`
- TARGET_OWNER: SERVER_AGENT save-point change authority
- CURRENT_REPLACEMENT_STATUS: `PARTIAL_REPLACEMENT`
  (hub table harvested; state machine + MSI_BUSY close-ack workaround unique)
- MUST_IMPLEMENT_BEFORE_RUNTIME_EXIT: `YES`
- KNOWLEDGE_PRESERVED: `YES`

## C6. Onboarding + job-change orchestration and return-to-grind

- SOURCE: A1, A3 ranges
- TARGET_OWNER: SERVER_AGENT onboarding/job-change orchestrator
- CURRENT_REPLACEMENT_STATUS: `PARTIAL_REPLACEMENT`
- MUST_IMPLEMENT_BEFORE_RUNTIME_EXIT: `YES`
- KNOWLEDGE_PRESERVED: `YES`

## C7. Eden equipment tiers 26 / 40 (Eden journey current content)

- SOURCE: A2, A4 ranges (`SE:3601-3632, 4177-4260`)
- TARGET_OWNER: SERVER_AGENT quest sequence (Course A exists only for
  equipment12)
- CURRENT_REPLACEMENT_STATUS: `PARTIAL_REPLACEMENT`
  (dashboard marks all tiers `implemented:true`; SERVER_AGENT sequence missing)
- MUST_IMPLEMENT_BEFORE_RUNTIME_EXIT: `YES`
- KNOWLEDGE_PRESERVED: `YES`

## C8. Grind-target persistence + idle recovery

- SOURCE: `SE:572-692, 963-988, 5038-5049`
- TARGET_OWNER: `dashboard.mjs` grind-target handling + SERVER_AGENT
- CURRENT_REPLACEMENT_STATUS: `PARTIAL_REPLACEMENT`
- MUST_IMPLEMENT_BEFORE_RUNTIME_EXIT: `YES`
- KNOWLEDGE_PRESERVED: `YES`

## C9. Shop sell used by current supply/quest supply path

- SOURCE: `SE:460-467` (`prefer_sell_before_storage`), `SE:2148`,
  `SE:3548` (`AI::queue('sellAuto')`), matrix #29 (`SOURCE_ONLY`)
- TARGET_OWNER: SERVER_AGENT service/sell path
- CURRENT_REPLACEMENT_STATUS: `PARTIAL_REPLACEMENT` (`SOURCE_ONLY`)
- MUST_IMPLEMENT_BEFORE_RUNTIME_EXIT: `YES`
- KNOWLEDGE_PRESERVED: `YES`

Note: Kafra storage deposit/withdraw, save point service and the 24h soak /
scale gates remain OpenKore Exit gates but are **not** current-supported
regressions (Gate 2 explicitly set `STORAGE = NOT_REQUIRED_FOR_GATE2`); they are
recorded in D.

---

# D. DEFERRED_FUTURE_CAPABILITIES

Knowledge is preserved; implementation may be deferred. These are NOT
OpenKore Exit blockers merely because OpenKore implements them.

| # | Capability | SOURCE | TARGET_OWNER | CURRENT_REPLACEMENT_STATUS | MUST_IMPLEMENT_BEFORE_RUNTIME_EXIT | KNOWLEDGE_PRESERVED | IMPLEMENTATION_DEFERRED |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D1 | Full stat / skill automation (stat allocation, skill upgrade, attack/self/buff auto-slots) | `SE:5050-5206` | Dashboard skill/stat domain | `DEFERRED` | NO | YES | YES |
| D2 | Skill attack in combat (#8) | matrix #8 | server skill combat | `DEFERRED` (`SOURCE_ONLY`) | NO | YES | YES |
| D3 | SP recovery (#13) | matrix #13 | rAthena SP recovery | `DEFERRED` (`SOURCE_ONLY`) | NO | YES | YES |
| D4 | Butterfly Wing (#15) | matrix #15 | rAthena save-point route | `DEFERRED` (`SOURCE_ONLY`) | NO | YES | YES |
| D5 | Equipment auto-switch (#17) | matrix #17 | rAthena inventory/equipment | `DEFERRED` (`SOURCE_ONLY`) | NO | YES | YES |
| D6 | Kafra storage deposit / withdraw (#30/#31) | matrix #30/#31 | rAthena storage | `DEFERRED` (`SOURCE_ONLY`) | NO | YES | YES |
| D7 | Save point service (#32) | matrix #32, `SE:4603-4611` | rAthena save point | `DEFERRED` (`SOURCE_ONLY`) | NO | YES | YES |
| D8 | Quest USE_ITEM action (#27) | matrix #27 | rAthena quest/item | `DEFERRED` (`SOURCE_ONLY`) | NO | YES | YES |
| D9 | Party / social automation (#35) | matrix #35, `SE:4869-4972` | server command boundary; Agent禁止 | `DEFERRED` | NO | YES | YES |
| D10 | Advanced party automation, vending | not in `SE` | future product slice | `DEFERRED` | NO | YES | YES |
| D11 | Card merge, generic item use/equip/unequip actions | `SE:5508-5536` | Dashboard inventory domain | `DEFERRED` | NO | YES | YES |
| D12 | 24h OpenKore=0 soak, 100/300/1000 actor scale gates | `docs/openkore-exit-source-of-truth.md` Gate 6 | ops/scale workline | `DEFERRED` | NO | YES | YES |
| D13 | Offline Party / Persistent Life, LLM diary | product constitution | future product slice | `DEFERRED` | NO | YES | YES |
| D14 | Party/guild/clan/battleground chat send | `SE:4969-5008` | Dashboard social domain | `DEFERRED` | NO | YES | YES |
| D15 | Emotion / social failure logging | `SE:4910-4927` | Dashboard social domain | `DEFERRED` | NO | YES | YES |

---

# E. DO_NOT_INHERIT

OpenKore-specific workarounds and implementation artifacts that MUST NOT be
carried into the SERVER_AGENT architecture. These are recorded so a future
implementer does not accidentally port them.

| # | Do-not-inherit artifact | SOURCE | WHY | MUST_IMPLEMENT_BEFORE_RUNTIME_EXIT | KNOWLEDGE_PRESERVED |
| --- | --- | --- | --- | --- | --- |
| E1 | `LEGACY_OPENKORE_COMPATIBILITY_HOTFIX` Kafra close gate / `MSI_BUSY` workaround / `CZ_CLOSE_DIALOG` ack | `SE:162-169, 379-410, 1258-1335` | Client-transport artifact; server authority should not require a client close ack. Replace the *semantics* (dialog actually ended before teleport), never the code. | YES (replace semantics) | YES |
| E2 | `Commands::run('ai auto'/'ai manual'/'move ...'/'stand'/'sit'/'respawn')` imperative string driver | `SE` throughout | OpenKore command bus; SERVER_AGENT uses typed intents/commands. | NO | YES |
| E3 | File-poison `.cmd` / `.result` protocol | `SE:4929-5556` | Unreliable file transport; superseded by the server command queue. | NO | YES |
| E4 | `Commands::run('reload config'/'reload pickupitems'/'reload items_control')` | `SE:5043-5049` | Client config reload hack; no server analogue. | NO | YES |
| E5 | Reserved skill slots `useSelf_skill_0`/`useSelf_skill_1` with disabled placeholder | `SE:5129-5206` | Slot-collision workaround for OpenKore's single-slot model. | NO | YES |
| E6 | Hook-based combat policy enforcement (`checkMonsterAutoAttack`, `shouldDropTarget`, `%mon_control` mutation) | `SE:290-325, 1617-1748` | Must become server-side target-selection authority, not client hook filtering. | NO | YES |
| E7 | `%prior*` OpenKore config snapshot/restore inside the plugin | `SE:1060-1115, 1767-1863, 3120-3159` | Client config lifecycle; server owns policy release. | NO | YES |
| E8 | `sendTalkCancel` delayed-cancel timing / `unpack('V', $npc_id)` raw id handling | `SE:1283-1335, 3822` | Packet-timing artifact, not domain logic. | NO | YES |
| E9 | Extending the grind-hub transition into a routing engine | `SE:952-957` (explicit source warning) | Explicitly declared "not the future navigation architecture". | NO | YES |
| E10 | Chat-based GM acceleration `@jlvl`, `@terminal_*_repair`, `@resetstat`, `@terminal_onboarding_resume` | `SE:3103, 4544, 5420, 5494, 5505` | Test-only/legacy acceleration channels; must stay test-only and must not become product control surfaces. | NO | YES |
| E11 | Generic English→Chinese dialog placeholder translation map | `SE:2746-2757` | Cosmetic fallback; hides missing localization instead of owning it. | NO | YES |
| E12 | In-memory, non-durable `%onboarding_dialog_completed` / `%eden_equip_skipped` session flags | `SE:57, 94, 3047` | Not restart-safe; SERVER_AGENT persistence must own this state. | NO | YES |
| E13 | `RO_SOCIAL_LOG` append-file event sink | `SE:4823-4839` | Local file sink; project persistence is MariaDB. | NO | YES |
| E14 | Hardcoded numeric emotion allowlist | `SE:5010` | Static client table; social domain should own it. | NO | YES |
| E15 | Per-character OpenKore worker / `start.exe` process model | matrix #40 | Replaced by in-process SERVER_AGENT; process-per-character is the thing being removed. | NO | YES |
| E16 | OpenKore `%talk` / `$ai_v{npc_talk}` dialog-stage introspection (`next`/`select`/`text`/`close`) | `SE:1229-1253, 3060-3073, 3843-3869` | Client dialog state machine; NPC/quest continuation must be server-owned. | NO | YES |

---

# Provenance index (bridge regions)

| Region | Lines | Harvested concept |
| --- | --- | --- |
| Module state | 20-171 | presence, grind, quest-runtime, onboarding, Eden state variables |
| Onboarding phases | 172-198 | A1 |
| Eden phases | 199-234 | A2 |
| Job routes / hubs | 235-288 | A3, A7 |
| Hook registration | 289-325 | B12, E6 |
| Web presence | 789-907 | A6, B5 |
| Quest runtime identity/policy | 919-950, 1490-2677 | A5 |
| Grind/supply breakers | 489-756, 2946-2963 | A8 |
| Grind hub machine | 952-1488 | A7 |
| Eden machine | 308-410, 3108-3944, 3963-4690 | A2, A4 |
| Onboarding machine | 2865-3092, 4292-4485 | A1 |
| Command transport | 4929-5556 | C1, E2, E3 |
| Status export envelope | 5558-5804 | A6, B13, C2 |

# Status boundary

```text
DOCUMENT_TYPE                  = GOVERNANCE / KNOWLEDGE PRESERVATION
RUNTIME_CHANGED                = NO
PRODUCTION_TOUCHED             = NO
OPENKORE_REMOVED               = NO
PRODUCTION_READY               = NO
```

This registry does not change OpenKore Exit capability states. The canonical
status remains `docs/openkore-exit-source-of-truth.md`.
