# WORKSPACE_INDEX

Authority document. Read this before any grep/glob/read/edit. Do not modify without Project Control.

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
STATUS:          ROUTING_REQUIRES_PROJECT_CONTROL
ACTIVE_WORKTREE: UNRESOLVED
ACTIVE_BRANCH:   UNRESOLVED
CANONICAL_HEAD:  UNRESOLVED
SOURCE_OF_TRUTH: UNRESOLVED
LAST_VERIFIED:   2026-09-16
DO_NOT_SEARCH:   Do not start work. Report ROUTING_STALE and stop.
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
```

---

## Kilo Workspace Note

Do NOT open `C:\` or `g-p-6a9bcb57afdc8191966436643af8acdf\` as daily coding workspace.
Open the ACTIVE_WORKTREE directly. Examples:
- Workline A → `.tmp-server-agent-no-client-controller-v1`
- Workline C → `terminal-arpg-phase4a-canonical`
