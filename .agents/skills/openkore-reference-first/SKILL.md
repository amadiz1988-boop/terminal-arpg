---
name: openkore-reference-first
description: 在任何可能影響 OpenKore-era gameplay semantics 的 Web、Controller、API、Persistent Agent、SERVER_AGENT、Native、Quest automation、bug fix、regression、refactor、optimization、migration 或 replacement 工作前，執行阻擋式 OpenKore reference reconstruction、Ghost Island optimization 與玩家結果等價性驗證。
---

# OPENKORE_REFERENCE_FIRST_HARD_GATE

```text
SKILL_ID = OPENKORE_REFERENCE_FIRST_HARD_GATE
VERSION = V1
SEVERITY = MANDATORY / BLOCKING
POLICY_AUTHORITY = AGENTS.md
OPERATIONAL_GATE = docs/project-control/openkore-reference-gate.md
```

## 1. Trigger

Set `OPENKORE_REFERENCE_REQUIRED = YES` when gameplay behavior can be affected
by the work. This includes Web, Controller, API, Persistent Agent,
SERVER_AGENT, Native, Quest automation, gameplay integration, bug fix,
regression restore, refactor, optimization, migration and replacement work.

The capability scope includes AUTO_FARM, combat, target selection, loot,
survival, HP/SP recovery, item use, supply, Fly Wing, Butterfly Wing, SaveMap,
LockMap, BuyAuto, SellAuto, StorageAuto, Kafra, navigation, routing, portal
handling, NPC interaction, death recovery, restart, reconnect, party, follow,
quest automation, skill use, equipment, inventory, weight and avoidance.

Pure CSS, layout, accessibility and static asset presentation may use
`OPENKORE_REFERENCE_REQUIRED = NO` only when gameplay state, eligibility,
command behavior, lifecycle and player result remain unchanged.

## 2. Trigger and exemption rule

`PRE_IMPLEMENTATION_REUSE_GATE` exemptions do not exempt this hard gate. Any
behavior-affecting bug fix, maintenance, refactor or optimization still triggers
this skill. Only pure documentation, formatting, CSS/layout or static asset work
that leaves gameplay state, authority, lifecycle and player-visible behavior
unchanged may use `OPENKORE_REFERENCE_REQUIRED = NO`.

## 3. Six-question core alignment veto

Before source edit and again during Project Control acceptance, answer:

```text
OPENKORE_REFERENCE_TRIGGERED = YES / NO
OPENKORE_BEHAVIOR_COMPARED = YES / NO
SERVER_AUTHORITY_INVARIANTS_PRESERVED = YES / NO
REFERENCE_CONFLICT_RESOLVED = YES / NO
GHOST_ISLAND_OPTIMIZATION_REVIEWED = YES / NO
RESULT_EQUIVALENT_OR_BETTER = YES / NO
```

Only six `YES` values authorize acceptance:

```text
CHANGE_APPROVED = YES
```

Any `NO`, `FAIL`, `UNKNOWN` or `NOT_PROVEN` produces:

```text
CHANGE_APPROVED = NO
CHANGE_REJECTED = YES
IMPLEMENTATION_ACCEPTANCE = FAIL
PRODUCTION_DEPLOY = BLOCKED
WORKLINE_DONE = NO
```

Source tests, builds, shorter code, simpler code or model confidence never
override this veto.

`OPTIMIZATION_APPLIED = NO_NOT_NEEDED` is valid after a documented review. Any
regression or critical unproven equivalence dimension still rejects acceptance.

## 4. Mandatory pre-implementation record

Before source edit, report every field:

```text
OPENKORE_REFERENCE_REQUIRED = YES / NO
OPENKORE_REFERENCE_TRIGGERED = YES / NO
OPENKORE_CAPABILITY_EXISTS = YES / NO / UNKNOWN
OPENKORE_REFERENCE_FILES =
OPENKORE_REFERENCE_SYMBOLS =
OPENKORE_CONFIG_KEYS =
OPENKORE_LAST_GOOD_BEHAVIOR =
OPENKORE_TRIGGER_CONDITION =
OPENKORE_STATE_MACHINE =
OPENKORE_SUCCESS_PATH =
OPENKORE_FAILURE_PATH =
OPENKORE_RECOVERY_PATH =
OPENKORE_RETRY_POLICY =
OPENKORE_EDGE_CASES =
OPENKORE_AUTHORITY_BOUNDARY =
CURRENT_GHOST_ISLAND_BEHAVIOR =
BEHAVIOR_DIFFERENCES =
OPENKORE_REFERENCE_VERSION =
OPENKORE_REFERENCE_COMMIT =
OPENKORE_REFERENCE_SOURCE =
OPENKORE_REFERENCE_DATE =
PROJECT_LAST_GOOD_OPENKORE_CONFIG =
PROJECT_LAST_GOOD_OPENKORE_CONFIG_SOURCE =
PROJECT_LAST_GOOD_OPENKORE_CONFIG_VERSION =
PROJECT_LAST_GOOD_OPENKORE_CONFIG_PROVENANCE =
OPENKORE_REFERENCE_INHERITED = YES / NO
REFERENCE_DOSSIER = <path or NONE>
OPENKORE_BEHAVIOR_COMPARED = YES / NO
SERVER_AUTHORITY_INVARIANTS_PRESERVED = YES / NO
REFERENCE_CONFLICT_RESOLVED = YES / NO
```

If either trigger or behavior comparison is not `YES`, stop and prohibit source
edit.

## 5. Reconstruction order

```text
OpenKore mature behavior
→ Last-Good reconstruction
→ Current Ghost Island behavior
→ exact behavior comparison
→ behavior mapping
→ Ghost Island optimization
→ player-result equivalence evidence
→ source edit / acceptance
```

OpenKore is the reference implementation, Last-Good behavior source,
state-machine reference, recovery reference and edge-case reference. Production
authority remains:

```text
PA / SERVER_AGENT → rAthena
```

OpenKore runtime remains disabled as a production dependency.

## 6. Behavior mapping

Every major behavior requires an itemized mapping:

```text
BEHAVIOR_MAPPING =
1.
OPENKORE =
CURRENT_GHOST_ISLAND =
DECISION = REPRODUCE / ADAPT / REJECT_LEGACY
WHY =
EXACT_STATE_TRANSITION =
EXACT_RECOVERY =
EXACT_DIFFERENCE =
```

`REPRODUCE` retains mature semantics. `ADAPT` retains semantics while moving
execution into PA / SERVER_AGENT and rAthena authority. `REJECT_LEGACY` records
the exact client/process artifact and the reason it cannot enter the current
architecture.

## 7. Ghost Island optimization review

After behavior comparison, report:

```text
GHOST_ISLAND_OPTIMIZATION_REVIEWED = YES / NO
OPTIMIZATION_APPLIED = YES / NO_NOT_NEEDED
OPTIMIZATION_REASON =
OPTIMIZATION_DIMENSIONS =
OPENKORE_INVARIANTS =
WHAT_WE_KEEP =
WHAT_WE_ADAPT =
WHAT_WE_REMOVE_AS_LEGACY_TRANSPORT =
SERVER_AUTHORITY_IMPROVEMENT =
RECOVERY_IMPROVEMENT =
SCALABILITY_IMPROVEMENT =
LATENCY_IMPROVEMENT =
MAINTAINABILITY_IMPROVEMENT =
SINGLE_AUTHORITY_IMPROVEMENT =
NEW_RISKS =
ROLLBACK_PATH =
```

`NO_NOT_NEEDED` is valid when the review confirms that changing mature behavior
would add risk without player or architecture value. When applied, optimization
preserves mature player-visible behavior while improving
server-authority, recovery, latency, duplicate-state control, scalability and
maintainability. It does not justify an unreviewed new engine or a gameplay
semantic rewrite.

## 8. Objective result comparison

Acceptance must compare the proven OpenKore player result with the current
Ghost Island player result:

```text
OPENKORE_LAST_GOOD_PLAYER_RESULT =
GHOST_ISLAND_CURRENT_PLAYER_RESULT =
EQUIVALENCE_EVIDENCE =
PLAYER_VISIBLE_BEHAVIOR = PROVEN / UNPROVEN
SUCCESS_PATH = PROVEN / UNPROVEN
FAILURE_PATH = PROVEN / UNPROVEN
RECOVERY = PROVEN / UNPROVEN
RETRY = PROVEN / UNPROVEN
RESTART_SAFETY = PROVEN / UNPROVEN
RECONNECT_SAFETY = PROVEN / UNPROVEN
AUTHORITY_CORRECTNESS = PROVEN / UNPROVEN
STATE_CONSISTENCY = PROVEN / UNPROVEN
RELIABILITY = PROVEN / UNPROVEN
LATENCY = PROVEN / UNPROVEN
SCALABILITY = PROVEN / UNPROVEN
MAINTAINABILITY = PROVEN / UNPROVEN
BETTER_DIMENSIONS =
REGRESSED_DIMENSIONS = NONE
UNPROVEN_DIMENSIONS =
RESULT_EQUIVALENT_OR_BETTER = YES / NO
PLAYER_FLOW_EQUIVALENCE = PASS / FAIL / NOT_TESTED
```

Evidence covers visible result, success, failure, recovery, retry, restart,
reconnect, edge cases and authority correctness. `RESULT_EQUIVALENT_OR_BETTER`
requires direct evidence; inference is insufficient.

## 9. Project Control responsibilities

Project Control marks `OPENKORE_REFERENCE_REQUIRED` in every related dispatch
and includes:

```text
DO NOT IMPLEMENT BEFORE:
OPENKORE_REFERENCE_GATE = PASS
MANDATORY_PRE_IMPLEMENTATION_CHECK:
OPENKORE_REFERENCE_TRIGGERED =
OPENKORE_BEHAVIOR_COMPARED =
SERVER_AUTHORITY_INVARIANTS_PRESERVED =
REFERENCE_CONFLICT_RESOLVED =
BEHAVIOR_MAPPING =
GHOST_ISLAND_OPTIMIZATION_REVIEWED =
OPTIMIZATION_APPLIED =
OPTIMIZATION_REASON =
```

After worker completion, Project Control independently reruns the six-question
veto. Worker self-report alone does not approve a change. If the same gameplay
subsystem has at least two downstream blockers, Project Control must record an
upstream assumption recheck before authorizing a third fix:

```text
UPSTREAM_ASSUMPTION_RECHECK = YES
DOWNSTREAM_BLOCKER_COUNT =
CURRENT_CONTRACT_REVALIDATED = YES / NO
OPENKORE_LAST_GOOD_RECHECKED = YES / NO
CONTINUE_CURRENT_DIRECTION = YES / NO
```

Before the gate passes, allow only read-only source/log/runtime/historical Git,
bounded diagnostics and isolated instrumentation that preserves gameplay
semantics. Prohibit gameplay source edit, state-machine redesign, production
deploy, runtime mutation and permanent route/supply/combat/recovery implementation.

## 10. Permanent Supply anti-pattern

```text
ANTI_PATTERN_ID = PA_SUPPLY_WALKING_REIMPLEMENTATION
```

The required reconstruction is:

```text
OpenKore Supply Last-Good
→ Butterfly Wing / SaveMap
→ BuyAuto
→ Return to LockMap
→ compare PA
→ REPRODUCE / ADAPT / REJECT_LEGACY
→ server-authoritative implementation
```

When current code already exists, classify it as:

```text
CURRENT_IMPLEMENTATION_CLASS =
LEGITIMATE_ADAPTATION / REGRESSION / WRONG_REIMPLEMENTATION / HISTORICAL_WORKAROUND
```

`WRONG_REIMPLEMENTATION` and `HISTORICAL_WORKAROUND` cannot be hardened further
without Project Control direction.

## 11. Required final report

Every applicable final report contains:

```text
OPENKORE_REFERENCE_REQUIRED =
OPENKORE_REFERENCE_TRIGGERED =
OPENKORE_REFERENCE_GATE = PASS / FAIL / BLOCKED / NOT_APPLICABLE
OPENKORE_REFERENCE_INHERITED = YES / NO
REFERENCE_DOSSIER =
OPENKORE_REFERENCE_VERSION =
OPENKORE_REFERENCE_COMMIT =
OPENKORE_REFERENCE_SOURCE =
OPENKORE_REFERENCE_DATE =
OPENKORE_CAPABILITY_EXISTS =
OPENKORE_REFERENCE_FILES =
OPENKORE_REFERENCE_SYMBOLS =
OPENKORE_CONFIG_KEYS =
PROJECT_LAST_GOOD_OPENKORE_CONFIG =
PROJECT_LAST_GOOD_OPENKORE_CONFIG_SOURCE =
PROJECT_LAST_GOOD_OPENKORE_CONFIG_VERSION =
PROJECT_LAST_GOOD_OPENKORE_CONFIG_PROVENANCE =
OPENKORE_LAST_GOOD_BEHAVIOR =
CURRENT_GHOST_ISLAND_BEHAVIOR =
OPENKORE_BEHAVIOR_COMPARED =
BEHAVIOR_MAPPING =
REFERENCE_CONFLICT =
REFERENCE_CONFLICT_RESOLVED =
SERVER_AUTHORITY_INVARIANTS_PRESERVED =
OPENKORE_DEVIATION = YES / NO
PROJECT_CONTROL_APPROVAL =
GHOST_ISLAND_OPTIMIZATION_REVIEWED =
OPTIMIZATION_APPLIED = YES / NO_NOT_NEEDED
OPTIMIZATION_REASON =
OPTIMIZATION_DIMENSIONS =
GHOST_ISLAND_OPTIMIZATION =
OPENKORE_LAST_GOOD_PLAYER_RESULT =
GHOST_ISLAND_CURRENT_PLAYER_RESULT =
EQUIVALENCE_EVIDENCE =
BETTER_DIMENSIONS =
REGRESSED_DIMENSIONS = NONE
UNPROVEN_DIMENSIONS =
RESULT_EQUIVALENT_OR_BETTER =
PLAYER_FLOW_EQUIVALENCE = PASS / FAIL / NOT_TESTED
OPENKORE_CORE_ALIGNMENT_VETO = PASS / FAIL
CHANGE_APPROVED = YES / NO
CHANGE_REJECTED = YES / NO
WORKLINE_DONE = YES / NO
```

## 12. Skill self-check

```text
FINAL_CORE_ALIGNMENT_CHECK =
DID_WE_TRIGGER_OPENKORE_REFERENCE = YES / NO
DID_WE_COMPARE_OPENKORE_AND_CURRENT_BEHAVIOR = YES / NO
DID_WE_PRESERVE_SERVER_AUTHORITY = YES / NO
DID_WE_RESOLVE_REFERENCE_CONFLICT = YES / NO
DID_WE_REVIEW_GHOST_ISLAND_OPTIMIZATION = YES / NO
IS_RESULT_PROVEN_EQUIVALENT_OR_BETTER = YES / NO
```

Any answer other than `YES` sets:

```text
CORE_ALIGNMENT = FAIL
CHANGE_REJECTED = YES
WORKLINE_DONE = NO
```
