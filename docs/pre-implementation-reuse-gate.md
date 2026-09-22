# Pre-Implementation Reuse Gate

> Canonical authority for the fail-closed `PRE_IMPLEMENTATION_REUSE_GATE`.
> Scope: governance, research, skill and test areas only. This document does
> not modify runtime source, production services or the database.

```text
NO NEW FEATURE / SUBSYSTEM IMPLEMENTATION
WITHOUT PRE_IMPLEMENTATION_REUSE_GATE = PASS
```

The gate upgrades the advisory External Ecosystem Reuse Audit into a mandatory,
fail-closed pre-implementation check. It does not replace that audit; it makes
the audit an input the implementation cannot bypass.

Related authorities:

- Operational checklist: `.agents/skills/external-ecosystem-reuse/SKILL.md`
- Machine evaluator: `.agents/skills/external-ecosystem-reuse/scripts/reuse-gate.mjs`
- Research cache: `ops/research/external-reuse-registry.json`
- Human-readable audit baseline: `docs/external-ecosystem-reuse-audit.md`
- OpenKore preserved knowledge: `docs/openkore-harvest-registry.md`
- OpenKore Exit status: `docs/openkore-exit-source-of-truth.md`

## 1. Principle

```text
Do not reinvent before checking.
Existing research is a cache, not a suggestion.
Legacy systems scheduled for removal remain valuable implementation references
until their capability knowledge has been harvested.
```

The gate exists to stop one recurring failure mode:

```text
external search
→ brand-new implementation
```

when the answer was already inside the repository, the reuse registry, or the
preserved OpenKore knowledge. Reuse is checked first; fresh research is the
exception, not the default.

## 2. Gate Scope

The gate is required for work that creates or replaces capability:

| Task category | Gate |
| --- | --- |
| `NEW_FEATURE` | REQUIRED |
| `NEW_SUBSYSTEM` | REQUIRED |
| `NEW_CAPABILITY` | REQUIRED |
| `NEW_EXTERNAL_DEPENDENCY` | REQUIRED |
| `NEW_MAJOR_ALGORITHM` | REQUIRED |
| `REPLACEMENT_OF_EXISTING_SUBSYSTEM` | REQUIRED |

`MATURE_CAPABILITY_DELTA_GATE` also triggers when any task, including an
otherwise exempt or inherited task, does one of the following:

```text
adds a capability
replaces a capability
changes behavior
changes configuration semantics
changes UI that exposes an existing mature capability
changes exception or recovery behavior
changes a data model used by a mature capability
```

The task label does not override the capability delta. A Web, UI, presentation,
bug-fix, maintenance or `KNOWN_IMPLEMENTATION_TASK` label remains gated when its
actual scope changes a mature capability surface.

The gate is not required for work that does not create capability:

| Task category | Gate |
| --- | --- |
| `BUG_FIX` | NOT_REQUIRED |
| `TEST_ONLY` | NOT_REQUIRED |
| `DOC_ONLY` | NOT_REQUIRED |
| `PROVENANCE_ONLY` | NOT_REQUIRED |
| `FORMAT_ONLY` | NOT_REQUIRED |
| `MAINTENANCE` / `TYPO_FIX` | NOT_REQUIRED |
| `KNOWN_IMPLEMENTATION_TASK` | NOT_REQUIRED, but must inherit |

`KNOWN_IMPLEMENTATION_TASK` is a slice of an already-approved parent design. It
may inherit through `REUSE_GATE_INHERITED_FROM` only when all three predicates
are `YES`: `SAME_CAPABILITY_SCOPE`, `REFERENCE_COVERAGE_STILL_COMPLETE` and
`NO_NEW_CAPABILITY_SURFACE`. Any other value requires
`DELTA_REFERENCE_AUDIT_REQUIRED = YES` and a bounded delta gate before source
change. A missing parent fails with `REUSE_GATE_INHERITANCE_MISSING`; an
unreviewed scope expansion fails with `CAPABILITY_DELTA_AUDIT_MISSING`.

A missing or unrecognized task category fails closed with
`TASK_CATEGORY_UNKNOWN`; classify the work explicitly.

## 3. Required Checks

Every gate record addresses seven sources, in this order of importance:

1. `currentProject` — does the capability already exist, partially exist, is
   owned by another workline, or is there a reusable utility/module?
2. `legacyProject` — did a legacy subsystem already solve it?
3. `reuseRegistry` — did prior research already answer this?
4. `rAthena` — does the server authority already provide the primitive?
5. `openKore` — incumbent legacy implementation and preserved harvest knowledge.
6. `externalEcosystem` — OpenKore/Hercules/HPM/RO ecosystem.
7. `genericOSS` — generic open-source where materially relevant.

### Current project first

The most important source is the current project. Before any external search,
determine whether the capability already exists, is partially implemented, is
owned by another workline, or has a reusable utility. The gate must discourage
external search followed by new implementation when the repository already
contains the answer.

### Registry first

`ops/research/external-reuse-registry.json` is a first-class cache of prior
research. Before fresh external research, check the registry. After materially
new research, write back to the registry (or record an explicit no-change
result). Registry entries capture only enough to avoid redoing research:

```text
capability / topic
sources
versions / date
findings
reuse decision
license / provenance note
project owner
freshness / research-needed status
```

Large research reports are referenced, not duplicated into JSON.

### Fresh research is the exception

Fresh research happens only when:

- registry entry absent
- entry stale
- target version materially changed
- integration is about to happen
- licensing / provenance unresolved
- evidence is insufficient

Otherwise reuse cached knowledge and record `REGISTRY_HIT`.

## 4. Decision Taxonomy

The gate ends in exactly one primary decision:

| Decision | Meaning |
| --- | --- |
| `DIRECT_REUSE` | Adopt an existing implementation as-is (native primitive, existing module, registry-backed dependency). No new logic. |
| `PORTABLE_LOGIC` | Transpose proven logic/design from an existing implementation into our architecture, adapting to our ownership/authority boundaries. |
| `REIMPLEMENT_FROM_BEHAVIOR` | Reimplement from an observed behavior contract/acceptance criteria (e.g. OpenKore behavior) because the original implementation is not portable; behavior is the spec. |
| `REFERENCE_ONLY` | Use as design reference only. No code, no dependency, no license obligation taken. |
| `BUILD_NEW` | Build new capability with no reusable source. Requires `whyNotReuse`. |
| `ALREADY_EXISTS` | The project already has the required capability; no implementation is necessary. Requires current-project evidence. |

## 5. Gate Record

Compact, machine-readable, cheap to write. JSON is the canonical form; YAML is
acceptable when the same fields exist.

```json
{
  "PRE_IMPLEMENTATION_REUSE_GATE": {
    "featureId": "res-life-party-follow",
    "featureName": "Offline Party Follow",
    "scope": "NEW_CAPABILITY",
    "taskCategory": "NEW_CAPABILITY",
    "categories": ["party", "follow"],
    "openKoreRelevant": true,
    "checks": {
      "currentProject": { "status": "CHECKED", "evidence": "..." },
      "legacyProject": { "status": "CHECKED", "evidence": "..." },
      "reuseRegistry": { "status": "REGISTRY_HIT", "reference": "..." },
      "rAthena": { "status": "CHECKED", "evidence": "..." },
      "openKore": { "status": "CHECKED", "evidence": "docs/openkore-harvest-registry.md#..." },
      "externalEcosystem": { "status": "NOT_APPLICABLE", "reason": "..." },
      "genericOSS": { "status": "NOT_APPLICABLE", "reason": "..." }
    },
    "decision": "PORTABLE_LOGIC",
    "whyNotReuse": "",
    "freshResearchPerformed": false,
    "freshResearchJustification": "",
    "registryUpdateRequired": false,
    "registryUpdate": { "status": "", "entryId": "", "evidence": "" },
    "inheritedFrom": "",
    "capabilityScope": "party support action and UI surface",
    "matureReferenceApplicable": true,
    "referenceGate": "PASS",
    "deltaReferenceAuditRequired": true,
    "capabilityDelta": {
      "addsCapability": true,
      "replacesCapability": false,
      "changesBehavior": true,
      "changesConfigurationSemantics": false,
      "changesCapabilityUi": true,
      "changesExceptionRecovery": true,
      "changesMatureCapabilityDataModel": false
    },
    "matureReferenceMatrix": {
      "currentGiCapability": "...",
      "openKoreCapability": "...",
      "rAthenaCapability": "...",
      "otherMatureReference": "NOT_APPLICABLE: ...",
      "matureExceptionBehavior": "...",
      "matureRecoveryBehavior": "...",
      "matureConfigSemantics": "...",
      "matureUiSemantics": "...",
      "directReuse": "...",
      "adapt": "...",
      "projectPolicy": "...",
      "improvements": "...",
      "matureCapabilityLoss": "NONE",
      "resultEquivalentOrBetter": "PASS"
    }
  }
}
```

For dispatch and final-report text, the canonical field names are:

```text
CAPABILITY_SCOPE =
MATURE_REFERENCE_APPLICABLE = YES / NO
REFERENCE_GATE = PASS / INHERITED_PASS / FAIL / BLOCKED
DELTA_REFERENCE_AUDIT_REQUIRED = YES / NO

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

Applicable fields cannot be `UNKNOWN` when PASS is claimed. `NOT_APPLICABLE`
must include a reason.

Check status enum:

| Status | Required payload |
| --- | --- |
| `CHECKED` | non-empty `evidence` |
| `REGISTRY_HIT` | non-empty `reference` or `evidence` |
| `NOT_APPLICABLE` | non-empty `reason` |
| `RESEARCH_REQUIRED` | incomplete; the gate cannot pass yet |

`registryUpdate.status` is `UPDATED` or `NO_CHANGE`, both with non-empty
`evidence` when `registryUpdateRequired` is true.

`whyNotReuse` is mandatory for `BUILD_NEW`.

## 6. Fail-Closed Rules

The gate blocks implementation when any of the following holds. Failure codes
are stable and machine-checkable.

| Failure code | Condition |
| --- | --- |
| `REUSE_GATE_MISSING` | Gate required, but no `PRE_IMPLEMENTATION_REUSE_GATE` record / no structured `checks`. |
| `REUSE_DECISION_MISSING` | Gate present, but `decision` missing or not in the taxonomy. |
| `BUILD_NEW_WITHOUT_WHY_NOT_REUSE` | `decision = BUILD_NEW` and `whyNotReuse` empty. |
| `EXISTING_CAPABILITY_IGNORED` | Current-project implementation found, `decision = BUILD_NEW`, and no rationale explains why it cannot be reused/extended. |
| `OPENKORE_REUSE_CHECK_MISSING` | OpenKore-relevant capability, but harvest/census knowledge was not checked. |
| `REDUNDANT_RESEARCH_WITHOUT_JUSTIFICATION` | Registry says the capability was already researched, fresh ecosystem research was performed, and no STALE/INSUFFICIENT/INTEGRATION/VERSION/LICENSE justification exists. |
| `REQUIRED_CHECK_INCOMPLETE` | A required check is missing, `RESEARCH_REQUIRED`, or lacks evidence / NOT_APPLICABLE reason. |
| `REGISTRY_UPDATE_MISSING` | Fresh research was performed or `registryUpdateRequired = true`, but no registry update/no-change evidence exists. |
| `REUSE_GATE_INHERITANCE_MISSING` | `KNOWN_IMPLEMENTATION_TASK` without `REUSE_GATE_INHERITED_FROM`. |
| `REUSE_GATE_INHERITANCE_SCOPE_UNPROVEN` | One or more inheritance predicates are not `YES`. |
| `CAPABILITY_DELTA_AUDIT_MISSING` | Capability scope changed or is unproven without a delta audit. |
| `MATURE_REFERENCE_MATRIX_INCOMPLETE` | Applicable matrix field is missing or `UNKNOWN`. |
| `MATURE_CAPABILITY_LOSS` | Candidate loses mature-reference capability. |
| `RESULT_NOT_EQUIVALENT_OR_BETTER` | Candidate does not prove `PASS`. |
| `TASK_CATEGORY_UNKNOWN` | Task category missing or unrecognized; classify the work. |
| `DISCOVERY_STALLED` | Equivalent discovery exhausted without new evidence (max 3 attempts, or 5 minutes without new material evidence). |

A gate passes only when every failure code is absent:
`PRE_IMPLEMENTATION_REUSE_GATE = PASS`.

## 7. OpenKore Incumbent Special Rule

```text
OPENKORE_REMOVED = NO
```

Until `OPENKORE_REMOVED = YES`, OpenKore is `INCUMBENT_LEGACY_IMPLEMENTATION`,
not merely an external library. For any work involving:

```text
navigation, routing, combat, target selection, skills, loot, inventory,
equipment, NPC, dialog, quest, supply, buy/sell/storage, death/respawn,
party, follow, reconnect, automation, policy, timeout/retry,
failure recovery, observability, status export, task scheduling
```

the gate MUST check preserved OpenKore harvest/census knowledge first. Do not
rescan all OpenKore source each time. Preferred order:

```text
harvest registry / capability census
→ existing reuse registry
→ source drill-down only if needed
```

For every OpenKore-relevant workline, this reuse gate is paired with the
blocking `OPENKORE_REFERENCE_FIRST_HARD_GATE`. `PRE_IMPLEMENTATION_REUSE_GATE =
PASS` alone does not authorize source edit until
`OPENKORE_REFERENCE_GATE_V1.1` has also passed with the required Last-Good
reconstruction and behavior mapping.

The task-category exemptions in this document do not exempt the OpenKore
reference-first hard gate. Any behavior-affecting `BUG_FIX`, `MAINTENANCE`,
`REFACTOR` or `OPTIMIZATION` still requires `OPENKORE_REFERENCE_GATE_V1.1`.
Only documentation, formatting, or pure presentation work with unchanged
gameplay semantics may omit that hard gate.

The rule expires only when `OPENKORE_REMOVED = YES`. Even after removal,
preserved harvest knowledge remains a reusable reference.

### Full census status

```text
OPENKORE_FULL_CAPABILITY_CENSUS = COMPLETE   (Project Control result)
UNKNOWN_CAPABILITY_GAPS        = 0           (Project Control result)
```

The census is already complete and MUST NOT be rerun. Preserved knowledge lives
in `docs/openkore-harvest-registry.md`.

PENDING_PRESERVATION_DEPENDENCY: the canonical full-census artifact itself is
not yet committed to shared governance; only the Project Control result and the
harvest registry are present. Reference this dependency; do not invent census
contents.

## 8. Research Invalidation / Freshness

Prior research becomes stale when evidence changes, not on a universal timer.

| Trigger | Action |
| --- | --- |
| `UPSTREAM_VERSION_CHANGED` | Refresh only the affected entry. |
| `PROJECT_REQUIREMENT_CHANGED` | Re-evaluate the reuse decision against the new requirement. |
| `LICENSE_STATUS_UNRESOLVED` | Refresh license/provenance before any adoption. |
| `INTEGRATION_IMMINENT` | Fresh verify immediately before dependency adoption. |
| `EVIDENCE_TOO_SHALLOW` | Upgrade to primary-source evidence; do not adopt. |
| `REGISTRY_TOO_OLD_FOR_FAST_MOVING_DEPENDENCY` | Refresh fast-moving OSS/dependency entries. |
| Stable algorithm / rAthena primitive | Evidence-based; no arbitrary calendar expiry. |

These triggers map to `freshResearchJustification` values:
`STALE`, `INSUFFICIENT_EVIDENCE`, `VERSION_CHANGED`, `INTEGRATION_IMMINENT`,
`LICENSE_UNRESOLVED`, `REGISTRY_MISS`.

## 9. Gate Inheritance

Small slices of an approved design must not repeat the audit. A child task sets:

```text
REUSE_GATE_INHERITED_FROM = <parent featureId / gate id>
SAME_CAPABILITY_SCOPE = YES
REFERENCE_COVERAGE_STILL_COMPLETE = YES
NO_NEW_CAPABILITY_SURFACE = YES
DELTA_REFERENCE_AUDIT_REQUIRED = NO
```

Only this exact state inherits the parent decision. A new UI/config surface,
behavior, exception/recovery path, capability, replacement or mature-capability
data model sets `DELTA_REFERENCE_AUDIT_REQUIRED = YES`. Audit only the changed
surface and reuse the unchanged parent evidence. Do not re-run the same audit.

## 10. Research Loop Prevention

The gate must save time, not create bureaucracy:

- A registry hit means do not re-research by default.
- Maximum 3 equivalent discovery attempts.
- Third attempt with no new evidence → `DISCOVERY_STALLED`.
- No new material evidence for 5 minutes → stop.
- No drive-wide / repo-wide search without scoped evidence.

These integrate the Execution Budget / No-Progress Circuit Breaker in
`AGENTS.md`.

## 11. Examples

### Example 1 — World Route Planner (`NEW_CAPABILITY`)

```text
current project: Gate3 executor = CHECKED
rAthena navigation/path data = CHECKED
openKore: docs/openkore-harvest-registry.md (MapRoute / CalcMapRoute) = CHECKED
decision = PORTABLE_LOGIC
```

Reuse decision: `PORTABLE_LOGIC` (or `REIMPLEMENT_FROM_BEHAVIOR` when the
OpenKore route planner is the behavior spec and no code is portable).

### Example 2 — Offline Party Follow (`NEW_CAPABILITY`)

OpenKore `FollowActor` capability must be checked first, before any new
follow implementation is designed.

### Example 3 — Unrelated Web CSS bugfix (`BUG_FIX`)

Reuse gate not required. This is the intended exemption: the gate applies to
new capability creation, not every trivial code edit.

### Regression — historical navigation miss

A developer starting a new cross-map route planner without checking OpenKore
`MapRoute` / `CalcMapRoute` now fails with `OPENKORE_REUSE_CHECK_MISSING`.
After checking the OpenKore harvest, existing Gate 3 and rAthena, and recording
a decision, the same gate passes. This is the exact historical failure the gate
prevents.

### Automatic trigger regression matrix

| Historical scope | Trigger | Required gate |
| --- | --- | --- |
| Navigation | routing capability and recovery semantics | Full mature/OpenKore/rAthena reference gate |
| Minimap original-color replacement | UI exposes mature map/navigation data | Delta reference audit |
| Supply settings UI | configuration and UI semantics | Delta reference audit |
| Combat AutoSkill | new skill behavior and exception/recovery paths | Full or delta reference audit |
| Party Support | new capability surface beyond base combat | Full or delta reference audit |

All five require the reference matrix. A parent Navigation, Supply or Combat
gate cannot cover the child solely through inheritance. Acceptance requires
`MATURE_CAPABILITY_LOSS = NONE` and
`RESULT_EQUIVALENT_OR_BETTER = PASS`; `SIMPLIFY_BELOW_REFERENCE` is rejected.

## 12. Adoption Rule

An implementation agent must not start a gated task until the gate record exists
and evaluates to `PRE_IMPLEMENTATION_REUSE_GATE = PASS`. The evaluator is:

```powershell
node .agents/skills/external-ecosystem-reuse/scripts/reuse-gate.mjs "<gate-record.json>"
```

Deterministic proof of fail-closed behavior lives in
`tests/governance/reuse-gate.test.ts`.
