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

## A | Persistent Agent / OpenKore Exit

```
WORKLINE:        A
STATUS:          ACTIVE
ACTIVE_WORKTREE: C:\Users\Administrator\.codex\.chatgpt-projects\g-p-6a9bcb57afdc8191966436643af8acdf\.tmp-server-agent-no-client-controller-v1
ACTIVE_BRANCH:   candidate/server-agent-no-client-controller-v1
CANONICAL_HEAD:  verify on entry (git rev-parse HEAD)
SOURCE_OF_TRUTH: terminal-arpg/docs/openkore-exit-source-of-truth.md
LAST_VERIFIED:   2026-09-16
DO_NOT_SEARCH:   C:\ root, project root, other worktrees unless SoT explicitly references them
```

---

## B | Gameplay / Core

```
WORKLINE:        B
STATUS:          ACTIVE_GATE1A
ACTIVE_WORKTREE: C:\Users\Administrator\.codex\.chatgpt-projects\g-p-6a9bcb57afdc8191966436643af8acdf\.tmp-gate1a-player-flow-v1
ACTIVE_BRANCH:   candidate/gate1a-player-flow-v1
CANONICAL_HEAD:  3ffdad1420feadde1e4d96667d7a33136bddb3c5
PARENT:          3ffdad1420feadde1e4d96667d7a33136bddb3c5
SOURCE_OF_TRUTH: terminal-arpg/docs/openkore-exit-source-of-truth.md
LAST_VERIFIED:   2026-09-16
SEARCH_SCOPE:    ACTIVE_WORKTREE_ONLY
CROSS_WORKTREE_ALLOWED: NO
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

## Kilo Workspace Note

Do NOT open `C:\` or `g-p-6a9bcb57afdc8191966436643af8acdf\` as daily coding workspace.
Open the ACTIVE_WORKTREE directly. Examples:
- Workline A → `.tmp-server-agent-no-client-controller-v1`
- Workline C → `terminal-arpg-phase4a-canonical`
