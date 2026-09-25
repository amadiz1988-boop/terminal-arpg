# WORKLINE_CONTINUATION_TEMPLATE_V1.2

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
Use WORKLINE_CONTINUATION_TEMPLATE_V1.2.
Continue from CURRENT_PHASE.
Do not restart audit.
```

---

## 0A. CONTINUE-IN-PLACE EXECUTION CONTRACT

Every substantial continuation inherits these defaults without repeating them
in each prompt:

```text
EXECUTE_TO_COMPLETION = YES
CONTINUE_IN_PLACE_FIRST = YES
ORIGINAL_WINDOW_OWNS_BOUNDED_BLOCKERS = YES
BOUNDED_BLOCKER_AUTONOMY = REQUIRED
RETURN_TO_PC_ONLY_ON_STOP_CONDITION = YES
USER_INTERRUPTION_MINIMIZATION = REQUIRED
```

Keep the original workline and current window. Own a new blocker in place only
when all of these are established:

```text
SAME_OWNER = YES
SAME_CAPABILITY_SCOPE = YES
EXISTING_ARCHITECTURE_SUFFICIENT = YES
NO_NEW_SUBSYSTEM = YES
NO_NEW_AUTHORITY_BOUNDARY = YES
NO_NEW_DESTRUCTIVE_PRODUCTION_SCOPE = YES
CANONICAL_DIRECTION_CLEAR = YES
```

Then execute the unfinished chain without a Project Control round-trip:

```text
LAST_CONFIRMED_GOOD
→ FIRST_BROKEN_TRANSITION
→ OWNER
→ ROOT_CAUSE
→ MINIMAL_FIX
→ BOUNDED_TEST / REGRESSION
→ CLEAN_CHECKPOINT
→ NEXT_UNFINISHED_STEP
→ RESUME ORIGINAL TASK
```

Record intermediate blockers in work context. Send a final report when the
original task is done, a `PC_STOP_*` condition is triggered, Production safety
requires an immediate halt, or canonical evidence needs a decision. A blocker
directly exposed by the previous step stays in this execution chain while its
owner and authority remain unchanged. Do not reopen completed discovery or
repeat accepted PASS evidence. Existing no-progress circuit breakers remain
active; a safety halt never authorizes a workaround or broader search.

Canonical `PROJECT_CONTROL_STOP_CONDITIONS`:

```text
PC_STOP_1  = another explicit owner / workline is required
PC_STOP_2  = established product specification must change
PC_STOP_3  = world / authority ownership boundary must change
PC_STOP_4  = new subsystem, engine or major architecture is required
PC_STOP_5  = new destructive Production mutation exceeds original authorization
PC_STOP_6  = security, auth or Single Runtime hard rule would be bypassed or changed
PC_STOP_7  = unrelated historical defect is not causal to this task's first break
PC_STOP_8  = canonical evidence conflicts and source of truth cannot be resolved
PC_STOP_9  = a product decision cannot be derived from canonical policy
PC_STOP_10 = correction materially exceeds original task scope
```

Missing operational detail is not an automatic stop. Reconstruct a lost command,
test invocation, local tool argument, PID or temporary path from canonical docs,
installed tool help, accepted logs, official tool documentation, bounded isolated
tests or existing source contract. Validate the reconstruction, record it, and
continue. A missing authority or an unresolved contradiction still follows the
applicable stop condition.

An original task's controlled-deploy authorization remains valid after a bounded
same-scope fix when deployment surface, destructive behavior, security boundary
and Single Runtime policy stay unchanged. Complete fix, build and precheck, then
continue that authorized deployment. A material deployment-scope change follows
`PC_STOP_5`, `PC_STOP_6` or `PC_STOP_10`.

Use `docs/testing-fixture-policy.md` for legal headless test authority. Unless
login UX itself is under test, manual Player login, a Player password, an RO
Client or OpenKore runtime is not a default prerequisite. Reuse authorized
Support Session, fixed fixture identity, headless transport, SERVER_AGENT,
synthetic harness or test bootstrap within their existing permissions. Browser
UI acceptance still requires real Browser evidence when the feature demands it.
Ask the user to act only for a product decision, credential consent, an external
human-only step or UI acceptance that cannot be automated lawfully. The user is
not a command relay or worker-to-worker message bus.

```text
PASSWORD_REQUIRED_FOR_TEST_FIXTURE = NO
MANUAL_PLAYER_LOGIN_AS_TEST_PREREQUISITE = FORBIDDEN_BY_DEFAULT
PASSWORDLESS_AUTHORIZED_TEST_CONTROL_REUSE_FIRST = YES
```

Final reports add:

```text
BOUNDED_BLOCKERS_FOUND =
BOUNDED_BLOCKERS_RESOLVED_IN_PLACE =
PROJECT_CONTROL_STOP_TRIGGERED = YES / NO
PROJECT_CONTROL_STOP_REASON =
USER_MANUAL_ACTION_REQUIRED = YES / NO
```

If manual action is required, state why existing authorized automation and
fixtures cannot complete that step.

---

## 0B. DEVELOPER DIAGNOSTICS / ACTION CONTINUATION

Check `node ops/ro-stack/ghost-island-dev.mjs capabilities <domain> --json`
before creating a diagnostic script or handing off a bounded blocker. Use an
existing console diagnostic or approved action in this window. Record the
registry gap when the console lacks the capability, and use direct authority
when its lower-level evidence is required. Keep Browser UI acceptance separate.

Continue from available local authoritative diagnostics for logs, runtime
state, projections, Event Ledger, read-only DB and receipts. A Browser,
Cloudflare Access or human-login blocker does not block facts available through
those channels. For an existing state-changing capability, use its approved
local developer entry point to the same canonical action and validation.
Report `DEVELOPER_ACTION_ENTRYPOINT_MISSING = YES` if Browser UI is the only
executable entry point; use the bounded-entry-point rule in `AGENTS.md`.
Direct DB mutation remains forbidden as an action substitute. Browser
acceptance remains required when the target is visible UI or Browser behavior.

```text
DIAGNOSTIC_AUTHORITY_USED =
DEVELOPER_CONSOLE_USED = YES / NO
DEVELOPER_CONSOLE_COMMANDS =
DEVELOPER_CONSOLE_GAP =
BROWSER_REQUIRED_FOR_TASK = YES / NO
BROWSER_USED = YES / NO
SERVER_SIDE_ACTION_USED = YES / NO
DIRECT_DB_MUTATION_USED = NO
DEVELOPER_ACTION_ENTRYPOINT_MISSING = YES / NO / N/A
```

---

## 0C. DEVELOPMENT_FLOW_EFFICIENCY_CONTINUATION

Inherit the original capability path and accepted evidence. Fill only the
changed or missing links; a routine same-scope blocker continues in this
window. Record `N/A` for unrelated links. Use the existing work context; this
adds no document or approval. `AGENTS.md` remains policy authority.

```text
END_TO_END_PREFLIGHT = PASS / GAP:<link and owner> / N/A
DEVELOPER_CONSOLE_CAPABILITY_CHECK = <domain and registry result> / N/A
OBSERVABILITY_READY = YES / GAP:<signal or entrypoint> / N/A
ACCEPTANCE_DEFINED = YES / GAP:<proof path> / N/A
CONTINUE_IN_PLACE_ELIGIBLE = YES / NO:<boundary> / N/A
REPEATED_FRICTION = YES:<fix category> / NO
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
CAPABILITY_SCOPE =
MATURE_REFERENCE_APPLICABLE = YES / NO
REFERENCE_GATE = PASS / INHERITED_PASS / FAIL / BLOCKED
DELTA_REFERENCE_AUDIT_REQUIRED = YES / NO
REUSE_GATE_INHERITED_FROM =
SAME_CAPABILITY_SCOPE = YES / NO
REFERENCE_COVERAGE_STILL_COMPLETE = YES / NO
NO_NEW_CAPABILITY_SURFACE = YES / NO
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

If the continuation changes capability scope, behavior, config semantics,
exposed mature-capability UI, exception/recovery or a mature-capability data
model, the parent gate cannot be inherited alone. Complete only the delta and
preserve unchanged parent evidence:

```text
CURRENT_GI_CAPABILITY =
OPENKORE_CAPABILITY =
RATHENA_CAPABILITY =
OTHER_MATURE_REFERENCE =
MATURE_EXCEPTION_BEHAVIOR =
MATURE_RECOVERY_BEHAVIOR =
MATURE_CONFIG_SEMANTICS =
MATURE_UI_SEMANTICS =
DIRECT_REUSE =
ADAPT =
PROJECT_POLICY =
IMPROVEMENTS =
MATURE_CAPABILITY_LOSS = NONE
RESULT_EQUIVALENT_OR_BETTER = PASS
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

## 9C.2. OPENKORE_CAPABILITY_LAYER_CONTINUATION

When a workline touches a mature OpenKore or reference capability family, or
relies on a GI override or disabled feature, classify each layer separately.
Each value is `ALIGNED / PARTIAL / MISSING / GI_EXPLICIT_OVERRIDE /
NOT_APPLICABLE / NOT_IMPLEMENTED_PRODUCT`. A disabled action never disables
state, trigger or maintenance by inference. Mark `N/A` when no capability
family is involved. This adds no approval step; the policy is
`OPENKORE_CAPABILITY_LAYERING_POLICY_V1` in `AGENTS.md`.

```text
CAPABILITY_LAYER_CHECK = PASS / GAP:<layer> / N/A
STATE_LAYER =
TRIGGER_LAYER =
ACTION_LAYER =
MAINTENANCE_LAYER =
RESUME_LAYER =
DEPENDENCY_REAUDIT_REQUIRED = YES / NO
CAPABILITY_LIFECYCLE_GAP = YES:<transition> / NO / N/A
```

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

## 11. STOP REPORT RULE

Report an unresolved continuation blocker only when `PC_STOP_*`, an immediate
Production safety halt or an unresolved canonical contradiction applies. Keep
routine same-scope blockers in the original execution chain. The stop report
contains only:

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
12-16 lines; up to 22 when the applicable diagnostics fields are included
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
BOUNDED_BLOCKERS_FOUND
BOUNDED_BLOCKERS_RESOLVED_IN_PLACE
PROJECT_CONTROL_STOP_TRIGGERED
PROJECT_CONTROL_STOP_REASON
USER_MANUAL_ACTION_REQUIRED
```

For applicable continuations, also report:

```text
DIAGNOSTIC_AUTHORITY_USED
DEVELOPER_CONSOLE_CAPABILITY_CHECK
DEVELOPER_CONSOLE_USED
DEVELOPER_CONSOLE_COMMANDS
DEVELOPER_CONSOLE_GAP
BROWSER_REQUIRED_FOR_TASK
BROWSER_USED
SERVER_SIDE_ACTION_USED
DIRECT_DB_MUTATION_USED
DEVELOPER_ACTION_ENTRYPOINT_MISSING
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

For every capability-changing continuation, also report:

```text
CAPABILITY_SCOPE
MATURE_REFERENCE_AUDIT
OPENKORE_REFERENCE
RATHENA_REFERENCE
MATURE_EXCEPTION_BEHAVIOR_REVIEWED
MATURE_UI_CONFIG_REVIEWED
DELTA_REFERENCE_AUDIT_REQUIRED
MATURE_CAPABILITY_LOSS
RESULT_EQUIVALENT_OR_BETTER
CAPABILITY_LAYER_CHECK
STATE_LAYER
TRIGGER_LAYER
ACTION_LAYER
MAINTENANCE_LAYER
RESUME_LAYER
DEPENDENCY_REAUDIT_REQUIRED
CAPABILITY_LIFECYCLE_GAP
```

PASS requires no `UNKNOWN` applicable value, `MATURE_CAPABILITY_LOSS = NONE`,
`RESULT_EQUIVALENT_OR_BETTER = PASS` and no unclassified capability layer.

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
TEMPLATE = WORKLINE_CONTINUATION_TEMPLATE_V1.2
```

No silent semantic change. Future substantive change:

```text
V1.3
V2
```

and the `AGENTS.md` reference must be updated in the same change.

V1.2 supersedes V1.1 for new continuations; existing handoffs inherit the
current `AGENTS.md` policy.

V1.2 amendment 2026-09-25 adds section 9C.2 and its report fields for
`OPENKORE_CAPABILITY_LAYERING_POLICY_V1`.
