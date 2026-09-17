# WORKSPACE_INDEX

Authority document. Read this before any grep/glob/read/edit. Do not modify without Project Control.

## Bootstrap Path Resolution

```
PROJECT_CONTAINER_ROOT: resolve from working directory or environment context
SHARED_GOVERNANCE_ROOT: <PROJECT_CONTAINER_ROOT>\terminal-arpg
WORKSPACE_INDEX_PATH:   <SHARED_GOVERNANCE_ROOT>\WORKSPACE_INDEX.md  ← this file
```

Rules:
- Agents MUST derive WORKSPACE_INDEX_PATH from PROJECT_CONTAINER_ROOT. Do NOT guess a relative path.
- Do NOT search C:\, project root, or sibling worktrees if the path is not immediately known.
- If WORKSPACE_INDEX_PATH does not exist at the derived path: STOP → report SHARED_GOVERNANCE_ROOT_INVALID.

---

## GLOBAL: Shared Roots

```
SHARED_GOVERNANCE_ROOT:   terminal-arpg
SHARED_GOVERNANCE_ACCESS: READ_ONLY_EXACT_PATH

# Agents in any runtime/source worktree may read the following canonical
# governance paths directly.  This is NOT cross-worktree source discovery.
# Do NOT search for alternate copies.  Do NOT copy files into the worktree.
SHARED_GOVERNANCE_EXACT_PATHS:
  - terminal-arpg/AGENTS.md
  - terminal-arpg/WORKSPACE_INDEX.md
  - terminal-arpg/docs/RO_AUTOMATION_PRODUCT_CONSTITUTION.md
  - terminal-arpg/docs/testing-fixture-policy.md
  - terminal-arpg/docs/openkore-exit-source-of-truth.md

SHARED_SUPPORT_ROOTS:
  GATE1A_HARNESS: .tmp-pa-iso-runtime
  # Classification: RUNTIME_SUPPORT / TEST_SUPPORT (no Git repository)
  # SOURCE_AUTHORITY: NO
  # May contain: scenario scripts, runtime binaries, evidence, fixtures.
  # May NOT become: PA source authority, command-contract authority, or
  #                 ownership/lifecycle implementation.
  # Purpose: isolated server startup, isolated DB/schema, fixture setup,
  #          formal command transport, runtime observation, cleanup.
  # Rules:
  #   - access only when task explicitly requires the harness
  #   - do NOT treat as alternate source worktree
  #   - do NOT search sibling source worktrees from it
  #   - do NOT copy harness into each active worktree
  #   - runtime/source modifications still belong only to ACTIVE_WORKTREE
```

---

## Persistent Agent Canonical Source Authority

Single authoritative Persistent Agent source lineage. This supersedes every
other PA worktree, branch, patch artifact and runtime copy.

```
PERSISTENT_AGENT_CANONICAL_SOURCE:
C:\Users\Administrator\.codex\.chatgpt-projects\g-p-6a9bcb57afdc8191966436643af8acdf\.tmp-pa-gate3-live-status-integration-v1
PERSISTENT_AGENT_CANONICAL_BRANCH: canonical/persistent-agent-gate3-v1
PERSISTENT_AGENT_CANONICAL_HEAD:   ba0e4433b310e6932464700d93bd37175d71077b
PERSISTENT_AGENT_LINEAGE:          3ffdad1 -> 5ed8f0d -> 866f423 -> ea5b995 -> c41cc4c -> a3cea54 -> 1fd30bd -> ba0e443
PERSISTENT_AGENT_MILESTONE_REF:    milestone/gate1a-no-client-player-flow-pass-20260917
PERSISTENT_AGENT_MILESTONE_TARGET: 5ed8f0d21ee138ddd37db4f7070a4decafeb84e5
PERSISTENT_AGENT_MILESTONE_REF_2:  milestone/gate1b-survival-death-recovery-pass-20260917
PERSISTENT_AGENT_MILESTONE_TARGET_2: c41cc4c86fff3feb35da54fd4ebf7206cd09818d
PERSISTENT_AGENT_MILESTONE_REF_3:  milestone/gate2-supply-replenishment-pass-20260917
PERSISTENT_AGENT_MILESTONE_TARGET_3: a3cea54da3ae15b86a256dd23627af784b391056
PERSISTENT_AGENT_MILESTONE_REF_4:  milestone/gate3-multimap-relocation-pass-20260917
PERSISTENT_AGENT_MILESTONE_TARGET_4: ba0e4433b310e6932464700d93bd37175d71077b
```

Rules:

- Future PA source changes start ONLY in the canonical worktree above.
- Historical PA worktrees are read-only reference; do not delete them.
- `.tmp-gate1a-player-flow-v1` is now `LEGACY_DIRTY_REFERENCE` / `SOURCE_AUTHORITY=NO`:
  its branch `canonical/persistent-agent-no-client-v1` remains frozen at `a3cea54`
  with an uncommitted dirty worktree. Do NOT reset／stash／clean／checkout／
  branch-switch／commit／delete it. It is no longer source authority.
- `.tmp-pa-iso-runtime` is shared test/runtime support only; it is NOT source authority.
- Binaries and runtime copies are never source authority.
- Patch artifacts are derived artifacts unless explicitly declared canonical.
- A future agent located in any other PA worktree must STOP and report
  `NON_CANONICAL_PA_WORKTREE` before attempting a PA source edit.

PA root classification (frozen references; do not delete):

| Root | Classification | Source authority |
| --- | --- | --- |
| `.tmp-pa-gate3-live-status-integration-v1` | CANONICAL (`canonical/persistent-agent-gate3-v1` @ `ba0e443`) | YES |
| `.tmp-gate1a-player-flow-v1` | LEGACY_DIRTY_REFERENCE (branch `canonical/persistent-agent-no-client-v1` @ `a3cea54`, dirty worktree) | NO |
| `.tmp-server-agent-no-client-controller-v1` | REFERENCE (ancestor snapshot `3ffdad1`) | NO |
| `.tmp-pa-lifecycle-consolidation-v1` | REFERENCE (divergent historical `95376cc`) | NO |
| `.tmp-pa-iso-runtime` | RUNTIME_SUPPORT (shared Gate1A harness, no Git) | NO |

Legacy patch `terminal-arpg/ops/ro-stack/patches/persistent-agent.patch`
= `STALE_REFERENCE` / derived artifact (last generated 2026-09-14, predates
command-contract hardening `866f423`). Never use it as source authority over
the canonical Git source.

---

## A | Persistent Agent / OpenKore Exit

```
WORKLINE:        A
STATUS:          REFERENCE_ONLY
ROLE:            HISTORICAL_PA_ANCESTOR_REFERENCE
ACTIVE_WORKTREE: C:\Users\Administrator\.codex\.chatgpt-projects\g-p-6a9bcb57afdc8191966436643af8acdf\.tmp-server-agent-no-client-controller-v1
ACTIVE_BRANCH:   candidate/server-agent-no-client-controller-v1 (frozen)
CANONICAL_HEAD:  3ffdad1420feadde1e4d96667d7a33136bddb3c5
SOURCE_AUTHORITY: NO
SOURCE_OF_TRUTH: terminal-arpg/docs/openkore-exit-source-of-truth.md
LAST_VERIFIED:   2026-09-17
DO_NOT_EDIT:     read-only reference; PA source edits belong to Workline B canonical worktree
DO_NOT_SEARCH:   C:\ root, project root, other worktrees unless SoT explicitly references them
```

---

## B | Gameplay / Core

```
WORKLINE:        B
STATUS:          CANONICAL
ROLE:            PERSISTENT_AGENT_CANONICAL_SOURCE
ACTIVE_WORKTREE: C:\Users\Administrator\.codex\.chatgpt-projects\g-p-6a9bcb57afdc8191966436643af8acdf\.tmp-pa-gate3-live-status-integration-v1
ACTIVE_BRANCH:   canonical/persistent-agent-gate3-v1
CANONICAL_HEAD:  ba0e4433b310e6932464700d93bd37175d71077b
PARENT:          1fd30bdd83fa90d6c25ebbabe88ccad13c08453a
GRANDPARENT:     a3cea54da3ae15b86a256dd23627af784b391056
MILESTONE_REF:   milestone/gate1a-no-client-player-flow-pass-20260917 -> 5ed8f0d21ee138ddd37db4f7070a4decafeb84e5
MILESTONE_REF_2: milestone/gate1b-survival-death-recovery-pass-20260917 -> c41cc4c86fff3feb35da54fd4ebf7206cd09818d
MILESTONE_REF_3: milestone/gate2-supply-replenishment-pass-20260917 -> a3cea54da3ae15b86a256dd23627af784b391056
MILESTONE_REF_4: milestone/gate3-multimap-relocation-pass-20260917 -> ba0e4433b310e6932464700d93bd37175d71077b
SOURCE_OF_TRUTH: terminal-arpg/docs/openkore-exit-source-of-truth.md
LAST_VERIFIED:   2026-09-17
SEARCH_SCOPE:    ACTIVE_WORKTREE_ONLY
CROSS_WORKTREE_ALLOWED: NO
LEGACY_DIRTY_REFERENCE:
  PATH: C:\Users\Administrator\.codex\.chatgpt-projects\g-p-6a9bcb57afdc8191966436643af8acdf\.tmp-gate1a-player-flow-v1
  BRANCH: canonical/persistent-agent-no-client-v1 (frozen @ a3cea54, dirty)
  SOURCE_AUTHORITY: NO
  READ_ONLY: YES (no reset/stash/clean/checkout/branch-switch/commit/delete)
NON_CANONICAL_EDIT: STOP -> report NON_CANONICAL_PA_WORKTREE
```

---

## C | Web / UI

```
WORKLINE:        C
STATUS:          ACTIVE
ACTIVE_WORKTREE: C:\Users\Administrator\.codex\.chatgpt-projects\g-p-6a9bcb57afdc8191966436643af8acdf\terminal-arpg-phase4a-canonical
ACTIVE_BRANCH:   fix/mobile-layout-regression-20260916
CANONICAL_HEAD:  verify on entry (git rev-parse HEAD)
SOURCE_OF_TRUTH: terminal-arpg-phase4a-canonical (Phase4A closure docs + candidate/web-experience-phase4a lineage)
LAST_VERIFIED:   2026-09-16
DO_NOT_SEARCH:   C:\ root, project root, other worktrees
```

---

## D | RO UI Research

```
WORKLINE:        D
STATUS:          PAUSED_BY_USER
ACTIVE_WORKTREE: C:\Users\Administrator\.codex\.chatgpt-projects\g-p-6a9bcb57afdc8191966436643af8acdf\.tmp-ro-hud-phase1
ACTIVE_BRANCH:   verify on resume
CANONICAL_HEAD:  verify on resume
SOURCE_OF_TRUTH: .tmp-ro-hud-phase1 internal docs
LAST_VERIFIED:   2026-09-16
DO_NOT_SEARCH:   Do not start work without explicit Project Control resume.
SEARCH_SCOPE:       PAUSED (no search)
CROSS_WORKTREE_ALLOWED: NO
```

---

## E | Quest / Job Change

```
WORKLINE:        E
STATUS:          ROUTING_REQUIRES_PROJECT_CONTROL
ACTIVE_WORKTREE: UNRESOLVED
ACTIVE_BRANCH:   UNRESOLVED
CANONICAL_HEAD:  UNRESOLVED
SOURCE_OF_TRUTH: UNRESOLVED
LAST_VERIFIED:   2026-09-16
DO_NOT_SEARCH:   Do not start work. Report ROUTING_STALE and stop.
SEARCH_SCOPE:       N/A (ROUTING_STALE)
CROSS_WORKTREE_ALLOWED: NO
```

---

## F | Web / SERVER_AGENT W1–W4 Closure

```
WORKLINE:        F
STATUS:          CLOSED (W1/W2/W3/W4 PASS)
ROLE:            WEB_SERVER_AGENT_W1_W4_PROVENANCE
ACTIVE_WORKTREE: C:\Users\Administrator\.codex\.chatgpt-projects\g-p-6a9bcb57afdc8191966436643af8acdf\.tmp-web-server-agent-w4-closure
ACTIVE_BRANCH:   closure/web-server-agent-w4-v1
CANONICAL_HEAD:  728b0eac9792b50ea5861dd95247ee23fe65bf90
BASE:            e179a996e0dcddd217e87d1e4b94c62576fc8ab3 (candidate/web-experience-phase4a lineage)
CLOSURE_COMMITS: bfa9e6f (W1) -> 0d46f26 (W2/W3) -> 9960141 (W4) -> 728b0ea (test infra)
TREE_HASH:       3021dad0ac5f47a8120cbd073fc79172138317b4
MILESTONE_REF:   milestone/web-w1-w4-server-agent-integration-pass-20260917 -> 728b0eac9792b50ea5861dd95247ee23fe65bf90
SOURCE_OF_TRUTH: terminal-arpg/docs/openkore-exit-source-of-truth.md
LAST_VERIFIED:   2026-09-17
SEARCH_SCOPE:    ACTIVE_WORKTREE_ONLY
CROSS_WORKTREE_ALLOWED: NO
NOTE: Web closure lineage 為 W1–W4 web source 的唯一乾淨來源。`terminal-arpg` dirty web tree 仍為
      READ_ONLY 參照（未作為 base、其 web source 未被本輪修改）；未來 web source 變更自此 closure lineage 開始。
NEXT: AUTOMATED_PRODUCTION_CANARY
```

---

## Kilo Workspace Note

Do NOT open `C:\` or `g-p-6a9bcb57afdc8191966436643af8acdf\` as daily coding workspace.
Open the ACTIVE_WORKTREE directly. Examples:
- Workline B (Persistent Agent, canonical) → `.tmp-pa-gate3-live-status-integration-v1`
- Workline C → `terminal-arpg-phase4a-canonical`

Persistent Agent edits belong ONLY to Workline B's canonical worktree above.
`.tmp-server-agent-no-client-controller-v1` is a frozen reference, not a workspace.
`.tmp-gate1a-player-flow-v1` is now `LEGACY_DIRTY_REFERENCE` (dirty worktree, no
source authority); do not open it for PA edits or attempt to clean it.
