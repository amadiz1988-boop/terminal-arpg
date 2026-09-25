## Native canonical source authority cutover, 2026-09-26

```text
NATIVE_SOURCE_AUTHORITY: PRIVATE_GITHUB_MAIN
CANONICAL_NATIVE_WORKING_ROOT: C:\Users\Administrator\source\ghost-island-rathena
CANONICAL_NATIVE_BRANCH: main
CANONICAL_NATIVE_HEAD_AT_CUTOVER: 1a2aa5532f9ec23ce9c976eac23fd1bfa6031cca
CANONICAL_NATIVE_REMOTE: https://github.com/amadiz1988-boop/ghost-island-rathena.git
LEGACY_NATIVE_ARCHIVE: C:\Users\Administrator\source\ghost-island-rathena-legacy-931cd598
LEGACY_NATIVE_HEAD: 931cd598160e426908a733e389c3d20c6e7b25c6
LEGACY_NATIVE_SOURCE_AUTHORITY: NO
LEGACY_NATIVE_CLASSIFICATION: HISTORICAL_EVIDENCE / READ_ONLY
CUTOVER_METHOD: PRESERVE_AND_RECLONE
UNRELATED_HISTORY_MERGED: NO
```

Native source work starts from the private GitHub `main` lineage at the canonical
working root. A feature branch may advance from verified canonical ancestry;
direct edits starting from current `main` additionally require the exact remote
`main` HEAD. Before any Native source modification, run
`node ops/ro-stack/native-source-authority-preflight.mjs --root "C:\Users\Administrator\source\ghost-island-rathena"`
from the canonical Web governance checkout and require
`NATIVE_SOURCE_AUTHORITY_PREFLIGHT = PASS`. Pass the exact Native worktree being
modified as `--root`; an omitted root fails closed.
Use `--start-from-current-main` only when the workline requires that exact start.
The guard checks the private GitHub repository and current remote lineage without
modifying the Native tree. A failure is `SOURCE_AUTHORITY_GOVERNANCE_REGRESSION`:
fix the guard or its root cause in place. `ROUTINE_NATIVE_RECONCILIATION_ALLOWED = NO`;
only an explicit Project Control source migration authorizes a new cutover.
The legacy archive is historical evidence only; use exact-file and exact-symbol
evidence before porting a missing behavior as a new commit on GitHub `main`.
Keep the archive and its linked worktrees intact. The archive's working files
are read-only by policy; its shared Git metadata remains available to those
historical worktrees. Cutover evidence and F handoff:
`docs/project-control/native-canonical-source-authority-cutover-v1.md`.

## GitHub canonical authority V6, 2026-09-24

SAFE_CANONICAL_GITHUB_RECONSTRUCTION_V6 supersedes older local source-authority
and V4/V5 publication-blocker declarations below for this governance cutover.
Web authority: https://github.com/amadiz1988-boop/terminal-arpg.git, refs/heads/main.
Native authority: PRIVATE https://github.com/amadiz1988-boop/ghost-island-rathena.git,
refs/heads/main, accepted source a4c736d865eeedca398aad97aeff1c1036f2dc39.
Runtime asset authority: PRIVATE ghost-island-assets immutable Release
web-runtime-assets-v1.1.0, exact package/manifest hashes in
`docs/project-control/production-release-authority.json`.
Source edits begin from fresh canonical GitHub clones. Existing dirty source,
V4 worktree, old Native bundle history and old local routing rows are retained
as evidence; they confer no future promotion authority. Active workers keep
their isolated work pending an explicit task routing update. V6 worktree:
`C:/Users/Administrator/.codex/worktrees/github-reconstruction-v6/terminal-arpg`,
branch `codex/github-reconstruction-v6`; published authority is main.
Do not copy runtime licensed assets into public Git. The 478 pre-cutover RO
binary objects are LEGACY_PUBLIC_HISTORY_EXCEPTION; normal forward commits
preserve their published ancestry. Every future licensed asset uses a pinned
private immutable release. See `docs/project-control/safe-canonical-reconstruction-v6.md`.
Production deployment remains a separately authorized manifest/receipt/lease
operation. No V6 source acceptance grants a runtime restart or deployment.

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
  - terminal-arpg/docs/PROJECT_ROADMAP.md

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

## Canonical Production Web Deployment

```text
CANONICAL_WEB_DEPLOY_TOOL: ops/ro-stack/deploy-dashboard-manifest.ps1
CANONICAL_DASHBOARD_LIFECYCLE: ops/ro-stack/dashboard-service.ps1
DEPLOY_TOOL_CHECKPOINT: 8f3073079e075771cd63c2a830da100e722068a7
DEPLOY_TOOL_SOURCE_OF_TRUTH: terminal-arpg canonical shared checkout
DEPLOY_TOOL_ACCEPTED_BASELINE_WORKTREE: C:\Users\Administrator\.codex\worktrees\manifest-web-only-deploy-v1\terminal-arpg
DEPLOY_TOOL_IN_SHARED_HEAD: YES
CANONICAL_DEPLOYMENT_POLICY: ACTIVE
SOURCE_VALIDATED: YES
OFFLINE_VALIDATED: YES (8/8)
PRODUCTION_VALIDATED: NO
PRODUCTION_VALIDATION_STATUS: NOT_REACHED
```

`deploy-dashboard-checkpoint.ps1` and `deploy-web-journey-atomic.ps1` are
`LEGACY_BOUNDED_DEPLOY_TOOL` / `SOURCE_REFERENCE=YES`, not general Production
release entrypoints. The accepted checkpoint worktree is provenance, while the
integrated tool in `terminal-arpg` is source authority. Do not use a Production
runtime copy as source.
Policy, release gates, receipt contract, and current gaps:
`docs/project-control/web-production-deployment.md`.

---

## Canonical Project Roadmap

```text
Canonical Project Roadmap: docs/PROJECT_ROADMAP.md
Detailed future roadmap:   docs/roadmap/
```

- `docs/PROJECT_ROADMAP.md` is the single top-level planning index and the
  authority for roadmap ordering, planning states and `IMPLEMENTATION_AUTHORIZED`.
- `docs/roadmap/` holds detailed future systems (PL1 Diary V1, PL2 Social PA V1)
  referenced from that index.
- Current engineering priority remains OpenKore Exit, tracked in
  `terminal-arpg/docs/openkore-exit-source-of-truth.md`.
- Do NOT duplicate the roadmap text into worktrees; read the canonical path.

---

## Persistent Agent Native Source Authority

### M1 Local Hunting continuation routing, 2026-09-24

```text
WORKLINE_ID: OPENKORE_MATURE_CAPABILITY_GAP_CENSUS_AND_CLOSURE_V1
F_ROLE: OpenKore pinned-source comparison and evidence only
F_PHASE: REFERENCE_RECONCILIATION
NATIVE_OWNER: canonical Native source
NATIVE_ACTIVE_WORKTREE: C:\Users\Administrator\source\ghost-island-rathena
NATIVE_EXACT_FILES_FIRST: src/map/persistent_agent.cpp, src/map/persistent_agent.hpp, tools/pa-command-contract/
NATIVE_PHASE: SUPPLY_AND_INVENTORY_SOURCE_RECONCILIATION
WEB_OWNER: canonical Web source, Workline B
WEB_ACTIVE_WORKTREE: C:\Users\Administrator\.codex\.chatgpt-projects\g-p-6a9bcb57afdc8191966436643af8acdf\terminal-arpg
WEB_EXACT_FILES_FIRST: ops/ro-stack/dashboard.mjs, ops/ro-stack/dashboard/config-schema.mjs, ops/ro-stack/persistent-agent/, scripts/test-world-map-teleport.mjs
WEB_PHASE: FARM_MAP_PREFLIGHT_AND_SETTINGS_SOURCE_RECONCILIATION
PRODUCT_AUTHORITY: docs/project-control/canonical-m1-world-travel-supply-ui-v1.md
VALIDATION_PHASE: SOURCE_AND_SYNTHETIC_FIRST; VERIFIED_TEST_AND_BROWSER_AFTER_CONTROLLED_DEPLOY
HISTORICAL_TMP_WORKTREE_IMPLEMENTATION: FORBIDDEN
```

本段處理現行 M1 續作的 owner 路由；下方 F 區塊仍只描述 W1–W4 歷史來源，不授權在其 `.tmp-*` 工作樹施工。兩個 canonical 工作樹開始修改前各自核對 branch、HEAD 與既有 dirty 變更。

CANONICAL_NATIVE_SOURCE:
C:\Users\Administrator\source\ghost-island-rathena

The Persistent Agent native implementation is owned by the private GitHub
`main` lineage checked out at that canonical rAthena source tree. No `.tmp-*`
worktree or archived local bundle history is source authority for native PA code.

The `.tmp-p2d-pa-equipment-action-v1` lineage below is retained ONLY as
`HISTORICAL_EVIDENCE` / `LAST_GOOD_LINEAGE`; it is NOT `SOURCE_OF_TRUTH`, NOT
`NATIVE_AUTHORITY` and NOT a `CANONICAL_SOURCE`.

```
PERSISTENT_AGENT_LAST_GOOD_LINEAGE_WORKTREE:
C:\Users\Administrator\.codex\.chatgpt-projects\g-p-6a9bcb57afdc8191966436643af8acdf\.tmp-p2d-pa-equipment-action-v1
PERSISTENT_AGENT_LAST_GOOD_LINEAGE_BRANCH: canonical/persistent-agent-p2f-v1
PERSISTENT_AGENT_LAST_GOOD_LINEAGE_HEAD:   fd12d2a10ac0109a5f802be2c24107afd11f7419
PERSISTENT_AGENT_LINEAGE:          3ffdad1 -> 5ed8f0d -> 866f423 -> ea5b995 -> c41cc4c -> a3cea54 -> 1fd30bd -> ba0e443 -> 704a4ac (P2B) -> b13a8e2 (P2C NAV4) -> ab44223 (P2D) -> fd12d2a (P2F)
PERSISTENT_AGENT_SUPERSEDED_HEAD: ba0e4433b310e6932464700d93bd37175d71077b (superseded by ab44223; not runtime truth)
PERSISTENT_AGENT_MILESTONE_REF:    milestone/gate1a-no-client-player-flow-pass-20260917
PERSISTENT_AGENT_MILESTONE_TARGET: 5ed8f0d21ee138ddd37db4f7070a4decafeb84e5
PERSISTENT_AGENT_MILESTONE_REF_2:  milestone/gate1b-survival-death-recovery-pass-20260917
PERSISTENT_AGENT_MILESTONE_TARGET_2: c41cc4c86fff3feb35da54fd4ebf7206cd09818d
PERSISTENT_AGENT_MILESTONE_REF_3:  milestone/gate2-supply-replenishment-pass-20260917
PERSISTENT_AGENT_MILESTONE_TARGET_3: a3cea54da3ae15b86a256dd23627af784b391056
PERSISTENT_AGENT_MILESTONE_REF_4:  milestone/gate3-multimap-relocation-pass-20260917
PERSISTENT_AGENT_MILESTONE_TARGET_4: ba0e4433b310e6932464700d93bd37175d71077b
P2F_READ_MODEL_COMMIT:             fd12d2a10ac0109a5f802be2c24107afd11f7419
WEB_P2F_READ_MODEL_BRANCH:         feature/p2f-headless-web-read-model
WEB_P2F_READ_MODEL_HEAD:           b6e5a6aafed39ac01eb411f1411e48c2d56a2400
```

Rules:

- Native PA source changes start ONLY in `CANONICAL_NATIVE_SOURCE`
  (`C:\Users\Administrator\source\ghost-island-rathena`).
- `.tmp-p2d-pa-equipment-action-v1` (`canonical/persistent-agent-p2f-v1` @
  `fd12d2a`) is `HISTORICAL_EVIDENCE` / `LAST_GOOD_LINEAGE` only; it is NOT
  SOURCE_OF_TRUTH, NOT NATIVE_AUTHORITY and NOT a CANONICAL_SOURCE.
- Historical PA worktrees are read-only reference; do not delete them.
- `.tmp-gate1a-player-flow-v1` is now `LEGACY_DIRTY_REFERENCE` / `SOURCE_AUTHORITY=NO`:
  its branch `canonical/persistent-agent-no-client-v1` remains frozen at `a3cea54`
  with an uncommitted dirty worktree. Do NOT reset／stash／clean／checkout／
  branch-switch／commit／delete it. It is no longer source authority.
- `.tmp-pa-iso-runtime` is shared test/runtime support only; it is NOT source authority.
- Binaries and runtime copies are never source authority.
- Patch artifacts are derived artifacts unless explicitly declared canonical.
- A future agent attempting a native PA source edit outside
  `CANONICAL_NATIVE_SOURCE` must STOP and report `NON_CANONICAL_PA_WORKTREE`.

PA root classification (frozen references; do not delete):

| Root | Classification | Source authority |
| --- | --- | --- |
| `.tmp-p2d-pa-equipment-action-v1` | HISTORICAL_EVIDENCE / LAST_GOOD_LINEAGE (`canonical/persistent-agent-p2f-v1` @ `fd12d2a`; contains P2B + P2C NAV4 + P2D + P2F) | NO |
| `.tmp-pa-gate3-live-status-integration-v1` | SUPERSEDED_REFERENCE (`canonical/persistent-agent-gate3-v1` @ `ba0e443`, superseded by `ab44223`; not runtime truth) | NO |
| `.tmp-gate1a-player-flow-v1` | LEGACY_DIRTY_REFERENCE (branch `canonical/persistent-agent-no-client-v1` @ `a3cea54`, dirty worktree) | NO |
| `.tmp-server-agent-no-client-controller-v1` | REFERENCE (ancestor snapshot `3ffdad1`) | NO |
| `.tmp-pa-lifecycle-consolidation-v1` | REFERENCE (divergent historical `95376cc`) | NO |
| `.tmp-pa-iso-runtime` | RUNTIME_SUPPORT (shared Gate1A harness, no Git) | NO |

Legacy patch `terminal-arpg/ops/ro-stack/patches/persistent-agent.patch`
= `STALE_REFERENCE` / derived artifact (last generated 2026-09-14, predates
command-contract hardening `866f423`). Never use it as source authority over
`CANONICAL_NATIVE_SOURCE`.

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
DO_NOT_EDIT:     read-only reference; native PA source edits belong to CANONICAL_NATIVE_SOURCE (C:\Users\Administrator\source\ghost-island-rathena)
DO_NOT_SEARCH:   C:\ root, project root, other worktrees unless SoT explicitly references them
```

---

## B | Gameplay / Core

```
WORKLINE:        B
STATUS:          CANONICAL
ROLE:            CANONICAL_WEB_WORKLINE (Dashboard / Player Web / relocation)
ACTIVE_WORKTREE: C:\Users\Administrator\.codex\.chatgpt-projects\g-p-6a9bcb57afdc8191966436643af8acdf\terminal-arpg
ACTIVE_BRANCH:   verify on entry (git branch --show-current)
CANONICAL_HEAD:  verify on entry (git rev-parse HEAD)
PERSISTENT_AGENT_NATIVE_AUTHORITY: C:\Users\Administrator\source\ghost-island-rathena
PERSISTENT_AGENT_LAST_GOOD_LINEAGE:
  # HISTORICAL_EVIDENCE only; NOT SOURCE_OF_TRUTH / NATIVE_AUTHORITY / CANONICAL_SOURCE
  WORKTREE: .tmp-p2d-pa-equipment-action-v1
  BRANCH:   canonical/persistent-agent-p2f-v1
  HEAD:     fd12d2a10ac0109a5f802be2c24107afd11f7419
PARENT:          ab442233a2741ab02a2829428bf82a135dcc8a91
GRANDPARENT:     b13a8e2 (P2C NAV4 integration)
SUPERSEDED_HEAD: ba0e4433b310e6932464700d93bd37175d71077b (ba0e443 MUST NOT be runtime truth)
MILESTONE_REF:   milestone/gate1a-no-client-player-flow-pass-20260917 -> 5ed8f0d21ee138ddd37db4f7070a4decafeb84e5
MILESTONE_REF_2: milestone/gate1b-survival-death-recovery-pass-20260917 -> c41cc4c86fff3feb35da54fd4ebf7206cd09818d
MILESTONE_REF_3: milestone/gate2-supply-replenishment-pass-20260917 -> a3cea54da3ae15b86a256dd23627af784b391056
MILESTONE_REF_4: milestone/gate3-multimap-relocation-pass-20260917 -> ba0e4433b310e6932464700d93bd37175d71077b
SOURCE_OF_TRUTH: terminal-arpg (canonical Web source: ops/ro-stack/dashboard.mjs,
                 ops/ro-stack/dashboard/app.js, ops/ro-stack/persistent-agent/*)
P2F_READ_MODEL_COMMIT: fd12d2a10ac0109a5f802be2c24107afd11f7419 (P2F-HEADLESS-WEB-READ-MODEL)
LAST_VERIFIED:   2026-09-19
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
STATUS:          READY
ACTIVE_WORKTREE: C:/Users/Administrator/.codex/.chatgpt-projects/g-p-6a9bcb57afdc8191966436643af8acdf/.tmp-quest-dialogue-runtime-v1-canonical
ACTIVE_BRANCH:   feat/quest-dialogue-runtime-v1-canonical
CANONICAL_HEAD:  16648143597a49482c787d308fd63943b4891716
BASE_HEAD:       fae560807caaaa24419e0da5c441fd08fb9fc0ba
SOURCE_OF_TRUTH: Quest/Web/Runtime = C:/Users/Administrator/.codex/.chatgpt-projects/g-p-6a9bcb57afdc8191966436643af8acdf/.tmp-quest-dialogue-runtime-v1-canonical
NATIVE_AUTHORITY: C:\Users\Administrator\source\ghost-island-rathena (READ-ONLY; route Native defects to D)
NAVIGATION_REFERENCE: 31bc821257c47d0793fb3f2586d5eb9e17ad58cc (REFERENCE_DEPENDENCY; not an implementation base requirement)
LOCAL_HUNTING_ADR: docs/architecture/local-hunting-hybrid-architecture.md
LOCAL_HUNTING_STATUS: ACCEPTED / MIGRATION_IN_PROGRESS / STAGE2_NOT_GLOBALLY_PROMOTED
RATHENA_AUTOCOMBAT_REFERENCE: 961ac3c (REFERENCE_DEPENDENCY)
LAST_VERIFIED:   2026-09-21
DO_NOT_SEARCH:   Use the resolved E worktree only. Do not search sibling worktrees.
SEARCH_SCOPE:    E worktree exact paths; Native authority read-only when explicitly required
CROSS_WORKTREE_ALLOWED: NO
ROUTING_STALE:   NO
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
- Workline B (Web / Dashboard, canonical) → `terminal-arpg`
- Workline C → `terminal-arpg-phase4a-canonical`

Persistent Agent native edits belong ONLY to `CANONICAL_NATIVE_SOURCE` (`C:\Users\Administrator\source\ghost-island-rathena`); the `.tmp-p2d-pa-equipment-action-v1` lineage is `HISTORICAL_EVIDENCE` / `LAST_GOOD_LINEAGE` only.
`.tmp-server-agent-no-client-controller-v1` is a frozen reference, not a workspace.
`.tmp-gate1a-player-flow-v1` is now `LEGACY_DIRTY_REFERENCE` (dirty worktree, no
source authority); do not open it for PA edits or attempt to clean it.
