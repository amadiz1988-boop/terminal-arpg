# WORKLINE_CONTINUATION_TEMPLATE_V1

STATUS: CANONICAL

POLICY AUTHORITY:
AGENTS.md / PC-DISPATCH-STANDARD-v1.1

PURPOSE:
Canonical structure for continuing an existing workline
without restarting discovery or losing current state.

---

## 0. CORE PRINCIPLE

```text
CONTINUE FROM CURRENT STATE.
DO NOT RESTART AUDIT.
```

Restart discovery only when:

```text
CURRENT evidence is invalid
```

or:

```text
Project Control explicitly orders a Last-Good reconstruction.
```

Short form:

```text
For existing workline:
Use WORKLINE_CONTINUATION_TEMPLATE_V1.
Continue from CURRENT_PHASE.
Do not restart audit.
```

---

## 1. CONTINUE EXISTING WINDOW

```text
【CONTINUE EXISTING WINDOW】
<window name>
```

---

## 2. WORKLINE_ID

Reuse the original ID.

```text
WORKLINE_ID = <original stable identifier>
```

A continuation MUST NOT create a second duplicate workline.

---

## 3. CURRENT_PHASE

```text
CURRENT_PHASE =
```

Allowed values:

```text
SOURCE_ANALYSIS
BUILD
DEPLOY
LIVE_ACCEPTANCE
BROWSER_ACCEPTANCE
BLOCKED
```

---

## 4. LAST_CONFIRMED_GOOD

```text
LAST_CONFIRMED_GOOD =
```

Record only the last transition that was actually proven successful.

---

## 5. CURRENT_BLOCKER

```text
EXPECTED =
ACTUAL =

FIRST_BROKEN_TRANSITION =

BLOCKER_LAYER =
```

`BLOCKER_LAYER` is limited to:

```text
CONFIG
COMMAND_CONTRACT
CONTROLLER
READ_MODEL
TRANSPORT
ROUTE_RESOLUTION
COMMAND_DELIVERY
NATIVE_INTAKE
RUNTIME_EXECUTION
SERVICE_INTERACTION
RETURN
RESUME
BROWSER_RENDER
RUNTIME_LIFECYCLE
TEST_ENVIRONMENT
GIT_DEPLOY_CONFLICT
```

---

## 6. SOURCE_CHANGE_REQUIRED

```text
SOURCE_CHANGE_REQUIRED = YES / NO / UNKNOWN
```

If `UNKNOWN`:

```text
bounded trace first.
```

Do not modify source before the first broken transition is located.

---

## 7. DO NOT REPEAT

List work already completed that must not be rerun, for example:

```text
Last-Good reconstruction complete
canonical resolver identified
Native build already passed
browser root cause already located
reference Gate already completed
```

Purpose: prevent a re-continued worker from re-burning tokens on finished work.

---

## 8. NEXT_MINIMAL_ACTION

```text
NEXT_ACTION =
```

Exactly one minimal action. Opening several new directions at once is forbidden.

---

## 9. REFERENCE / POLICY

Every continuation handoff MUST also carry the long-term product direction:

```text
LONG_TERM_PRODUCT_DIRECTION = Character Life & Social Simulation
CANONICAL_DIRECTION_DOC      = docs/character-life-social-simulation-roadmap.md
```

Do not paste the roadmap. For scopes listed in `AGENTS.md`
(`CHARACTER_LIFE_SOCIAL_SIMULATION_DIRECTION`), report
`CHARACTER_LIFE_DIRECTION_COMPATIBILITY = PASS / FAIL / N/A`.

For a Quest-related continuation, complete the Atlas lookup in section 9A and
then `QUEST_FLOW_FIRST_HARD_GATE` in section 9B before continuing or evaluating
the OpenKore policy below:

```text
RATHENA_REFERENCE_ATLAS_LOOKUP -> QUEST_FLOW_FIRST_HARD_GATE ->
OPENKORE_REFERENCE_ATLAS_LOOKUP -> OPENKORE_REFERENCE_GATE ->
PROJECT_LAST_GOOD_MAPPING -> CURRENT_RUNTIME_MAPPING ->
FIRST_BROKEN_TRANSITION -> implementation
```

Continue the policy already required by the original workline, for example:

```text
OPENKORE_REFERENCE_REQUIRED = YES
Follow OPENKORE_REFERENCE_POLICY and OPENKORE_REFERENCE_GATE_V1.1.
Reference Gate already completed at <evidence>.
REFERENCE_DOSSIER = <path or NONE>
OPENKORE_REFERENCE_INHERITED = YES / NO
OPENKORE_REFERENCE_ATLAS_REQUIRED = YES / NO
OPENKORE_ATLAS_TOPIC =
OPENKORE_ATLAS_FILES =
OPENKORE_ATLAS_SEARCHED = YES / NO
RATHENA_ATLAS_SEARCHED = YES / NO
AUTHORITATIVE_SOURCE_CHECKED = YES / NO
PROJECT_LAST_GOOD_CHECKED = YES / NO
OPENKORE_MATURE_BEHAVIOR_CHECKED = YES / NO
RATHENA_AUTHORITY_CHECKED = YES / NO
CURRENT_PA_CHECKED = YES / NO
REFERENCE_IS_FLOOR_NOT_CEILING = YES
FINAL_DESIGN_CENTER = PA / SERVER_AGENT
```

If reference suitability has not yet been evaluated:

```text
Execute only the missing Gate subsection.
```

Do not continue source work while the hard gate is `FAIL`, `BLOCKED`, or
missing required reconstruction evidence. A continuation must preserve the
existing behavior mapping and record any new reference conflict or deviation
for Project Control approval.

Continuation must preserve the pinned reference version, commit, source, date and
project last-good config provenance. `PRE_IMPLEMENTATION_REUSE_GATE` exemptions
do not exempt behavior-affecting bug fix, maintenance, refactor or optimization
from this hard gate. Before the hard gate is complete, use only bounded read-only
diagnostics or isolated instrumentation that preserves gameplay semantics.

Do not rerun the entire Gate.

## 9A.1. RO_ECOSYSTEM_REFERENCE_SWEEP_CONTINUATION

For a substantial RO-domain continuation, preserve the existing research
checkpoint and reuse decision. Do not repeat a full ecosystem search. Read the
project and historical evidence already recorded, then fill only a stale,
version-mismatched or missing source seam:

```text
RO_ECOSYSTEM_REUSE_FIRST = YES
REFERENCE_SWEEP_REQUIRED = YES
ECOSYSTEM_REFERENCE_SWEEP_COMPLETED = YES / NO
PROJECT_EXISTING_CAPABILITY =
RATHENA_SOURCE_CAPABILITY =
RATHENA_DOCS_CAPABILITY =
RATHENA_FORUM_CAPABILITY =
RATHENA_ISSUE_PR_CAPABILITY =
OPENKORE_SOURCE_CAPABILITY =
OPENKORE_DATA_CAPABILITY =
OPENKORE_COMMUNITY_CAPABILITY =
MATURE_SOLUTION_FOUND = YES / NO / PARTIAL
REFERENCE_SOURCE =
REUSE_SEAM =
REUSE_CLASSIFICATION = DIRECT_REUSE / PORT / ADAPTER /
                        INTEGRATION_ONLY / PROJECT_POLICY / CUSTOM_REQUIRED
CUSTOM_IMPLEMENTATION_APPROVED = YES / NO
```

Navigation continuations must include rAthena world/map/warp/NPC authority and
known routing patterns together with OpenKore MapRoute/CalcMapRoute/Route and
mature map/portal/NPC/weight/recovery data. An incomplete sweep keeps source
implementation blocked. This continuation gate supplements Quest Flow First,
OpenKore Atlas, Synthetic First and the existing Last-Good mapping.

---

## 9A. RATHENA_REFERENCE_ATLAS_CONTINUATION

If the existing workline touches server-authoritative RO gameplay or asks how
rAthena already behaves, preserve its Atlas lookup state:

```text
RATHENA_REFERENCE_ATLAS_TRIGGERED = YES
RATHENA_REFERENCE_ATLAS_TOPIC =
RATHENA_REFERENCE_ATLAS_FILES =
ATLAS_SEARCHED = YES / NO
AUTHORITATIVE_SOURCE_CHECKED = YES / NO
PROJECT_LAST_GOOD_CHECKED = YES / NO
REFERENCE_ATLAS_STALE_OR_CONFLICTING = YES / NO
REFERENCE_GAP = CONFIRMED / NOT_CONFIRMED
```

Continue from `docs/rathena-reference/reference-index.yml` and the relevant
topic only. Do not reread the full Atlas. Current rAthena source, project
rules and authoritative config win stale or conflicting Atlas text. Only after
the three checks are `YES` may the workline declare a confirmed reference gap.

## 9B. QUEST_FLOW_FIRST_CONTINUATION

If the existing workline touches Quest, NPC, dialogue, quest state, Quest
Runtime, novice/onboarding, Eden, job change, event quest, quest navigation,
quest recovery or automatic questing, continue with the original Quest Flow
First state. Do not restart the full archaeology unless current evidence is
invalid or Project Control explicitly orders reconstruction.

```text
QUEST_FLOW_FIRST_TRIGGERED = YES
QUEST_REFERENCE_DOSSIER =
PLAYER_FLOW_UNDERSTOOD = YES / NO / UNKNOWN / PARTIAL
PLAYER_FLOW_SOURCE =
RATHENA_SCRIPT_SOURCE =
HISTORICAL_LAST_GOOD =
CURRENT_QUEST_RUNTIME =
INTERACTION_CLASSIFICATION =
REUSABLE_COMPONENTS =
WRONG_ASSUMPTIONS =
FIRST_BROKEN_TRANSITION =
WEB_CONTROL_REQUIRED = YES / NO
SERVER_AGENT_AUTONOMY_ALLOWED = YES / NO
IMPLEMENTATION_ALLOWED = YES / NO
```

If `PLAYER_FLOW_UNDERSTOOD` is `UNKNOWN`, `NOT_PROVEN` or `PARTIAL`, continue
only read-only archaeology, source tracing, historical reconstruction,
current-runtime comparison or test-only diagnostics. Web control is not an
execution prerequisite: when `WEB_CONTROL_REQUIRED = NO` and the semantic,
authority and automation gates pass, SERVER_AGENT may continue approved
internal quest steps autonomously.

The gate order remains:

```text
RATHENA_REFERENCE_ATLAS_LOOKUP -> QUEST_FLOW_FIRST_HARD_GATE ->
OPENKORE_REFERENCE_ATLAS_LOOKUP -> OPENKORE_REFERENCE_GATE ->
PROJECT_LAST_GOOD_MAPPING -> CURRENT_RUNTIME_MAPPING ->
FIRST_BROKEN_TRANSITION -> implementation
```

After two downstream blockers, record an upstream assumption recheck before
any third gameplay-semantic fix:

```text
UPSTREAM_ASSUMPTION_RECHECKED = YES
DOWNSTREAM_BLOCKER_COUNT =
THIRD_SEMANTIC_FIX_ALLOWED = NO
```

---

## 9C. OPENKORE_REFERENCE_ATLAS_CONTINUATION

For an OpenKore-relevant continuation, preserve the focused Atlas lookup and
classification before resuming the OpenKore hard gate:

```text
OPENKORE_REFERENCE_ATLAS_TRIGGER = MANDATORY / BLOCKING
OPENKORE_REFERENCE_ATLAS_TRIGGERED = YES
OPENKORE_ATLAS_TOPIC =
OPENKORE_ATLAS_FILES =
OPENKORE_ATLAS_SEARCHED = YES / NO
RATHENA_ATLAS_SEARCHED = YES / NO
AUTHORITATIVE_SOURCE_CHECKED = YES / NO
PROJECT_LAST_GOOD_CHECKED = YES / NO
OPENKORE_MATURE_BEHAVIOR_CHECKED = YES / NO
RATHENA_AUTHORITY_CHECKED = YES / NO
CURRENT_PA_CHECKED = YES / NO
REFERENCE_GAP = CONFIRMED / NOT_CONFIRMED
REFERENCE_IS_FLOOR_NOT_CEILING = YES
OPENKORE_REFERENCE_ATLAS != PRODUCT_SPEC
OPENKORE_REFERENCE_ATLAS != RUNTIME_AUTHORITY
FINAL_DESIGN_CENTER = PA / SERVER_AGENT
REUSE_CLASSIFICATION = REPRODUCE / ADAPT / IMPROVE / REJECT_LEGACY / NOT_APPLICABLE
WHY_DEVIATE =
WHAT_IS_BETTER =
SERVER_AUTHORITY_PRESERVED = YES / NO
REGRESSION_RISK =
RESULT_EQUIVALENT_OR_BETTER = YES / NO
REFERENCE_CONFLICT = YES / NO
OPENKORE_BEHAVIOR =
PROJECT_LAST_GOOD =
RATHENA_BEHAVIOR =
CURRENT_PA_BEHAVIOR =
PROJECT_RULE =
LIKELY_REASON =
PA_RECOMMENDED_DIRECTION =
NEEDS_PC_DECISION = YES / NO
```

Do not reread the full Atlas. Continue from the index, relevant topic,
Project Last-Good and current phase. A confirmed reference gap requires Atlas,
authoritative rAthena, OpenKore mature behavior and Project Last-Good checks.

---

## 9C.1. MATURE_CAPABILITY_REUSE_FIRST_CONTINUATION

Resume the existing reuse gate before any source change. Do not restart broad
research when the prior workline already recorded valid source pointers.

```text
MATURE_CAPABILITY_REUSE_FIRST = YES
REFERENCE_SEARCH_COMPLETED = YES / NO
MATURE_CAPABILITY_EXISTS = YES / NO / PARTIAL
REFERENCE_SOURCE =
CURRENT_PROJECT_CAPABILITY =
OPENKORE_EXISTING_CAPABILITY =
OPENKORE_REFERENCE =
OPENKORE_REUSE_SEAM =
CUSTOM_CODE_REQUIRED = YES / NO / UNKNOWN
WHY =
REUSE_CLASSIFICATION = DIRECT_REUSE / PORT / ADAPTER / PROJECT_POLICY_LAYER / INTEGRATION_ONLY / CUSTOM_IMPLEMENTATION_REQUIRED
CUSTOM_IMPLEMENTATION_ALLOWED = YES / NO
PROJECT_CONTROL_APPROVAL_REQUIRED = YES / NO
```

For Navigation, preserve:

```text
OPENKORE_NAVIGATION_REUSE_FIRST = YES
OPENKORE_ROUTE_PARITY_REQUIRED = YES
NAVIGATION_ROUTE_ENGINE_COUNT = 1
PER_MAP_NAVIGATION_HARDCODE = FORBIDDEN
```

If the prior gate classified `CUSTOM_IMPLEMENTATION_REQUIRED`, continue only
with the recorded reuse rationale and Project Control decision. This gate does
not supersede Quest Flow First, either Reference Atlas, Synthetic First, Single
Runtime Policy, nearest legal reproducible state, Browser final acceptance or
Git hygiene.

---

## 9D. SYNTHETIC_FIRST_DEBUGGING_CONTINUATION

For a runtime or control-flow continuation, resume from the existing evidence
and do not restart diagnosis from scratch:

```text
LAST_GOOD =
CURRENT =
SYNTHETIC_FIRST_TRIGGERED = YES
DIAGNOSTIC_SOURCE =
ACTION_TRACE =
TRACE_EVIDENCE =
SCENARIO =
SCENARIO_RESULT = PASS / FAIL / BLOCKED / N/A
FIRST_BROKEN_TRANSITION =
CURRENT_OWNER =
OWNER =
MINIMAL_FIX =
NEXT_MINIMAL_FIX =
SYNTHETIC_REGRESSION =
SYNTHETIC_LIVE_ACCEPTANCE =
BROWSER_FINAL_ACCEPTANCE =
```

Continue with `.agents/skills/synthetic-first-debugging/SKILL.md` and
`scripts/player-scenario-runner.mjs` when the scenario is supported. Preserve
Quest Flow First, both Reference Atlas gates, Single Runtime Policy, nearest
legal reproducible state and Browser final acceptance. Pure documentation,
design, CSS-only, asset-review, static-content and reference-research
continuations may use `SYNTHETIC_FIRST_TRIGGERED = N/A`.

---

## 9E. CONTINUOUS_REFERENCE_MINING_CONTINUATION

Continuation must consume existing Atlas knowledge before requesting new research:

```text
REFERENCE_MINING_IS_CONTINUOUS = YES
RATHENA_REFERENCE_TRIGGERED = YES / NO / N/A
OPENKORE_REFERENCE_TRIGGERED = YES / NO / N/A
REFERENCE_MINING_GAP = YES / NO / N/A
REFERENCE_TOPIC =
REFERENCE_CLASSIFICATION = REUSE / ADAPT / IMPROVE / REJECT_LEGACY / NOT_APPLICABLE
PROACTIVE_BACKLOG = docs/reference-mining/research-backlog.yml
STALE_REFERENCE = YES / NO / UNKNOWN
MINING_DONE = YES / NO / N/A
```

If the topic is already indexed and its version, accepted contract and edge
cases remain valid, inherit the exact source pointers and do not repeat research.
If a semantic or high-risk gap remains, route `REFERENCE_MINING_GAP = YES` to F.
Pure local UI, CSS, static content and documentation may use `N/A`.

---

## 10. LIVE TEST INVALIDATION RULE

If acceptance is disturbed by any of the following:

```text
map restart
Dashboard restart
external deploy
resident char lost
unrelated worker modified runtime
```

then:

```text
TEST = INVALIDATED
```

Do not judge the source FAIL. Re-obtain a stable window and retest.

---

## 11. FAIL RULE

On continuation failure report only:

```text
CURRENT_PHASE =
LAST_CONFIRMED_GOOD =
EXPECTED =
ACTUAL =
FIRST_BROKEN_TRANSITION =
BLOCKER_LAYER =
SOURCE_CHANGE_REQUIRED =
```

Do not rewrite the whole project history.

---

## 12. FINAL REPORT

```text
12-16 lines maximum
```

Report only:

```text
CURRENT_PHASE
LAST_CONFIRMED_GOOD
FIRST_BROKEN_TRANSITION
SOURCE_CHANGE_REQUIRED
FILES_CHANGED
TESTS
LIVE_PASS
BROWSER_UI_PASS
NEXT_ACTION / CLOSED
```

For a runtime or control-flow continuation, also report:

```text
SYNTHETIC_FIRST_TRIGGERED
DIAGNOSTIC_SOURCE
TRACE_EVIDENCE
SCENARIO_RESULT
FIRST_BROKEN_TRANSITION
CURRENT_OWNER
NEXT_MINIMAL_FIX
SYNTHETIC_REGRESSION
SYNTHETIC_LIVE_ACCEPTANCE
BROWSER_FINAL_ACCEPTANCE
RATHENA_REFERENCE_TRIGGERED
OPENKORE_REFERENCE_TRIGGERED
MATURE_CAPABILITY_REUSE_FIRST
REFERENCE_SEARCH_COMPLETED
MATURE_CAPABILITY_EXISTS
OPENKORE_EXISTING_CAPABILITY
OPENKORE_REFERENCE
OPENKORE_REUSE_SEAM
CUSTOM_CODE_REQUIRED
REUSE_CLASSIFICATION
CUSTOM_IMPLEMENTATION_ALLOWED
PROJECT_CONTROL_APPROVAL_REQUIRED
REFERENCE_MINING_GAP
REFERENCE_TOPIC
REFERENCE_CLASSIFICATION
MINING_DONE
```

For an OpenKore-relevant workline, also report:

```text
OPENKORE_REFERENCE_GATE
OPENKORE_REFERENCE_INHERITED
OPENKORE_REFERENCE_ATLAS_TRIGGERED
OPENKORE_ATLAS_TOPIC
OPENKORE_ATLAS_FILES
OPENKORE_ATLAS_SEARCHED
PROJECT_LAST_GOOD_CHECKED
OPENKORE_MATURE_BEHAVIOR_CHECKED
RATHENA_AUTHORITY_CHECKED
CURRENT_PA_CHECKED
REFERENCE_IS_FLOOR_NOT_CEILING
OPENKORE_REFERENCE_ATLAS != PRODUCT_SPEC
OPENKORE_REFERENCE_ATLAS != RUNTIME_AUTHORITY
FINAL_DESIGN_CENTER
REFERENCE_DOSSIER
OPENKORE_REFERENCE_VERSION
OPENKORE_REFERENCE_COMMIT
OPENKORE_REFERENCE_SOURCE
OPENKORE_REFERENCE_DATE
OPENKORE_REFERENCE_FILES
OPENKORE_REFERENCE_SYMBOLS
PROJECT_LAST_GOOD_OPENKORE_CONFIG
PROJECT_LAST_GOOD_OPENKORE_CONFIG_SOURCE
PROJECT_LAST_GOOD_OPENKORE_CONFIG_VERSION
PROJECT_LAST_GOOD_OPENKORE_CONFIG_PROVENANCE
OPENKORE_LAST_GOOD_BEHAVIOR
CURRENT_BEHAVIOR
BEHAVIOR_MAPPING = REPRODUCE / ADAPT / IMPROVE / REJECT_LEGACY / NOT_APPLICABLE
SERVER_AUTHORITY_INVARIANTS_PRESERVED
REFERENCE_CONFLICT_RESOLVED
OPENKORE_DEVIATION
GHOST_ISLAND_OPTIMIZATION_REVIEWED
OPTIMIZATION_APPLIED
OPTIMIZATION_REASON
OPTIMIZATION_DIMENSIONS
EQUIVALENCE_EVIDENCE
BETTER_DIMENSIONS
REGRESSED_DIMENSIONS
UNPROVEN_DIMENSIONS
RESULT_EQUIVALENT_OR_BETTER
OPENKORE_CORE_ALIGNMENT_VETO
PLAYER_FLOW_EQUIVALENCE
```

---

## 13. VERSIONING

```text
TEMPLATE = WORKLINE_CONTINUATION_TEMPLATE_V1
```

No silent semantic change. Future substantive change:

```text
V1.1
V2
```

and the `AGENTS.md` reference must be updated in the same change.
