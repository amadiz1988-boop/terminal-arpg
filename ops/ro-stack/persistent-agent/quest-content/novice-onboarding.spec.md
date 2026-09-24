# Novice Onboarding — Frozen Behavioral Spec (26 phases)

MIGRATION SOURCE OF TRUTH. Reconstructed from the last-known-good execution
driver `ops/ro-stack/openkore-plugins/status-export/status-export.pl::process_onboarding`
(status-export.pl:4292-4485) and its callers. OpenKore is removed and MUST NOT be
restored; this spec is the behavioral authority for the native port.

- sequenceId: `novice_onboarding`
- owner: Workline A (orchestration port)
- executor: canonical Persistent Agent Quest Runtime sequence executor (Workline B)
- rule invariants: real Base/Job EXP only; `JobLevel>=10` and `NV_BASIC>=9`
  required for graduation; native `jobchange` only; no SQL class/skill mutation;
  no fake EXP/level/skill; no OpenKore worker; no `.cmd`/`.result` transport.

Column legend: ENTRY = activation condition; DONE = completion; NEXT = successor;
RETRY = stall/retry semantics; OLD = last-good primitive; NATIVE = target native capability.

| # | phase id | visible task | ENTRY | ACTION | DONE | NEXT | RETRY | OLD | NATIVE |
|---|---|---|---|---|---|---|---|---|---|
| 1 | starting | — | char in-game, jobID=0, onboarding map | init, ai manual | state set | 2–26 | re-init | configModify/ai manual | session init |
| 2 | respawning | — | char.dead | none | respawned | resume | bounded wait | OpenKore death event | B death lifecycle |
| 3 | academy_exit | — | jobID 1..6 & iz_ac01 | talk academy guide | warp to prt_fild08 | finish | talk retry | onboarding_talk_at | TALK_NPC |
| 4 | ship_wounded | 逃離沉船 | iz_int & q21001==0 | talk `terminal_ship_wounded` | q21001→2 | 5 | talk retry | talk_at 56,32 | TALK_NPC+DIALOG_NEXT |
| 5 | ship_exit | 逃離沉船 | iz_int else | move 56,15 | map change | 6 | move retry | onboarding_move | GO_MAP |
| 6 | island_captain | 初次相遇/第一次戰鬥 | int_land q21008==0, no 611 | talk `Captain Carocc#intro_npc03` | q21008 active | 7 | talk retry | talk_at 78,103 | TALK_NPC |
| 7 | island_lumin | 初次相遇 | q7471==0 | talk `Lumin#new_ship` | q7471→2 | 8 | talk retry | talk_at 73,100 | TALK_NPC |
| 8 | island_lumber | 第一次戰鬥 | q21008==1 & item6008<2 | combat for lumber | 6008≥2 | 9 | idle retry | set_onboarding_ai('auto') | KILL_MONSTER/COLLECT_ITEM |
| 9 | island_sailor | 第一次戰鬥 | q21008==1 | talk `Sailor#intro_npc04` | q complete | 10 | talk retry | talk_at 58,69 | TALK_NPC |
| 10 | sail_izlude | 新世界的第一步 | else | move izlude 49,57 | map change | 11 | move retry | move | GO_MAP |
| 11 | izlude_captain | 新世界的第一步 | q7472==0 | talk `Captain Carocc#iz` | q7472→2 | 12 | talk retry | talk_at 198,213 | TALK_NPC |
| 12 | izlude_hun_intro | 清涼飲料 | q7473==0 | talk `Criatura Academy Staff#0` | q7473 active | 13 | talk retry | talk_at 122,207 | TALK_NPC |
| 13 | izlude_hun_drink | 清涼飲料 | q7473==1 & item531 | use item 531 | consumed | 14 | throttle | inventory use | USE_ITEM |
| 14 | izlude_hun_finish | 清涼飲料 | q7473==1 | talk staff | q7473→2 | 15 | talk retry | talk_at 122,207 | TALK_NPC |
| 15 | academy_route | 新生學院報到 | else | move iz_ac01 100,39 | map change | 16 | move retry | move | GO_MAP |
| 16 | academy_registration | 新生學院報到 | q4269≠2 & no 18730 | talk `Academy Receptionist#1` | q4269→2, 18730 | 17 | talk retry | talk_at 100,39 | TALK_NPC |
| 17 | academy_pet_intro | 一轉結業 | JobLv<10 & q2293==0 | talk `Adept Adventurer#ac` | q2293 active | 18 | talk retry | talk_at 45,80 | TALK_NPC |
| 18 | academy_training_route | 一轉結業 | JobLv<10 | move new_1-3 95,171 | map change | 19/20/21 | move retry | move | GO_MAP |
| 19 | academy_training_heal | 一轉結業 | HP<60% & item569 | use 569 | HP recovered | 21 | throttle | inventory use | USE_ITEM (reactive) |
| 20 | academy_basic_skill | 一轉結業 | NV_BASIC<9 & skill pts | allocate NV_BASIC | level +1 | 23 | 0.5s throttle | sendAddSkillPoint(1) | ALLOCATE_SKILL |
| 21 | academy_training | 一轉結業 | JobLv<10 | combat on new_1-3 | JobLv≥10 | 22 | idle retry | set_onboarding_ai('auto') | KILL_MONSTER (loop) |
| 22 | academy_return | 一轉結業 | JobLv≥10 | ai manual + move iz_ac01 49,73 | map change | 23 | move retry | move/ai | GO_MAP |
| 23 | academy_graduation | 一轉結業 | NV_BASIC≥9 | talk guide + select | native jobchange | finish | talk retry | jobchange | TALK_NPC+DIALOG_MENU_SELECT+guarded jobchange |
| 24 | supernovice_relocating | 一轉結業 | training map & BaseLv<45 | move training map | map change | 25 | move retry | move | GO_MAP |
| 25 | supernovice_training | 一轉結業 | BaseLv<45 | combat | BaseLv≥45 | 26 | idle retry | ai auto | KILL_MONSTER (loop) |
| 26 | supernovice_ready | 一轉結業 | BaseLv≥45 | combat→graduate | graduation | 23 | — | ai | KILL_MONSTER→graduate |

Mapping notes (not 1:1 with visible tasks): phases 1/2/3 are infrastructure;
6 straddles 初次相遇 & 第一次戰鬥; 17/18/19/21/22 and 24/25/26 are sub-states of
一轉結業. No visible task may be dropped.

NPC identity resolution (P0): 8/8 resolved. Aliases required where the upstream
unique name exceeds 31 chars.
- `terminal_ship_wounded` (21) = duplicate of `Wounded Swordsman#intro_npc01_iz_int` (36) on iz_int,56,32; intro_npc02 stays distinct.

## P3 — Entrypoint semantics (design; not executed)
- identity: `(charId, sequenceId='novice_onboarding')`.
- persisted checkpoint: canonical `persistent_agent_state.task_id/task_phase`
  (+ `target_rules` for step index).
- after create → targetJob persisted → SERVER_AGENT claim CONFIRMED:
  - existing active checkpoint → RESUME (never restart at phase 1)
  - sequence completed (`terminal_academy_graduated` / class≠Novice) → NO-OP
  - no checkpoint → START at phase 1.
- idempotent: duplicate start requests collapse to the existing task identity.

## P4 — Web progress contract (fields only; no fabricated values)
`sequenceId, phaseId, stepIndex, status, checkpointAt, lastTransitionAt, blockedReason`.
Until a native projection exists, the UI MUST render “pending/unavailable”, never
synthetic progress, and must not derive phase state from the old worker callback.

## Engine status
The canonical PA Quest Runtime baseline required by this frozen spec is present
in the native source at c81feed0334feb194a935b53811f08b02e48147c:

1. `ALLOCATE_SKILL_EXECUTOR` uses authoritative skill points and confirmation.
2. `CONDITION_REPEAT_EXECUTOR` evaluates native JobLevel, BaseLevel, skill,
   inventory, quest and HP state readers.
3. `CHECKPOINT_PROGRESS_PROJECTION` persists CP2 frame checkpoints and CP3
   recovery pause/resume without replaying completed steps.
4. `FARM_UNTIL` hands off to the existing AUTO_FARM runtime, stops it when the
   authoritative condition is true, and advances the sequence once.

The source-ready declarative payload is `../quest-sequences/novice-onboarding.json`.
The Web/controller loader remains a Workline A integration dependency and is
kept outside this workline's file ownership.
