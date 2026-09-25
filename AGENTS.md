## Complete Web promotion payload

WEB_DEPLOYMENT_MANIFEST = COMPLETE_PROMOTION_PAYLOAD
MULTI_MANIFEST_SINGLE_PROMOTION = FORBIDDEN
PRECOPY_OUTSIDE_LEASE = FORBIDDEN
LEGACY_256_FILE_LIMIT = SUPERSEDED

Normal and first GitHub promotions require the `web-complete-v1` contract in
`docs/project-control/web-atomic-full-manifest-delivery-v1.md` and the independent
limits in `web-manifest-safety-policy.json`. One candidate, one complete manifest,
one lease and one Web deployment receipt. Prestage, exact provenance/hashes,
complete rollback and postdeploy fileset checks gate final baseline advancement.
Production cannot fill missing candidate files. Historical subset manifests are
retained only for historical rollback and isolated compatibility fixtures.

## Native first-promotion entry

NATIVE_PROMOTION_PATH = AVAILABLE. Native candidates are built only through
`scripts/build-native-candidate.py`, admitted with a pinned
`scripts/prepare-native-candidate.mjs` manifest, and deployed only through
`ops/ro-stack/deploy-native-candidate.mjs` using an owned first-promotion lease.
The default entry is read-only; actual mutation requires explicit Production
authority and `--execute true`. Native precedes Web. Exact hashes, 18-capability
superset, rollback, one runtime, ProcDump and final linked receipts are mandatory.
Canonical contract: `docs/project-control/github-first-production-promotion-protocol-v1.md`.

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

# 鬼島傳說工作規則

本文件是每個 Work／Codex 工作的第一份上下文。專案目前以 `ops/ro-stack/dashboard.mjs` 提供的 8788 Dashboard 為唯一玩家入口，rAthena Renewal、SERVER_AGENT／PA 與 MariaDB 為現行服務。OpenKore 保留為歷史參考，runtime count 維持 0。Vinext 瀏覽器 demo 與 D1 API 原型只保留為封存程式碼，接手時依 `docs/CURRENT_STATUS.md` 判斷實際執行環境。

## Headless Control Authority

```text
CLIENT_REQUIRED_FOR_PRODUCT_RUNTIME = NO
CLIENT_REQUIRED_FOR_TESTING = NO
CLIENT_REQUIRED_FOR_ADMIN_CONTROL = NO
NATIVE_CLIENT_REQUIRED_FOR_ACCEPTANCE = NO
OPENKORE_RUNTIME_REQUIRED = NO
OPENKORE_RUNTIME_FOR_TESTING = FORBIDDEN
TEST_CONTROL_MUST_BE_HEADLESS = YES
CANONICAL_PLAYER_CONTROL = WEB → SERVER_AGENT / PA → rAthena
CANONICAL_TEST_CONTROL = ADMIN / TEST TRANSPORT → SERVER_AGENT / TEST FIXTURE ADAPTER → rAthena authority
```

Native Client 可保留為歷史參考或選用傳輸。測試與管理控制使用已認證的伺服器端傳輸，由 rAthena 裁定指令權限及世界狀態。Fixture 設定使用 TEST_SUPERUSER；最終玩家流程驗收使用 TEST_PLAYER，GM fixture 結果不得計入玩家流程 PASS。

## Admin Access Boundary

`ADMIN_ACCESS_BOUNDARY_FROZEN = YES`。Admin Browser 的登入與身分權威為 `CLOUDFLARE_ACCESS_EDGE`；Dashboard 不另建 Admin Browser 身分系統、不要求重新登入，也不要求 Cloudflare identity header、JWT 或 Gmail 地址映射。Player host、普通 Player 與 Support-only 均不得讀取 Admin data。`server_admin_api` 的無憑證 loopback `GET /api/admin/server/status` 以 HTTP 403 視為健康，沒有 Admin data 或寫入權限。未符合明定重啟條件，不得重開 Admin Browser identity 深查。完整邊界、六項重啟條件與免密碼測試規則見 `docs/project-control/admin-access-boundary.md`；本文件仍為 policy authority。

執行 substantial Repository 工作前，先依 `.agents/skills/task-model-router/SKILL.md` 判斷建議模型、推理強度與速度，並在施工前提醒使用者。該 Skill 只負責建議，不得改變任務 scope，也不得自行宣稱已切換模型。

## Project Control Dispatch Standard

版本：`PC-DISPATCH-STANDARD-v1.1`

完整的 Project Control 回覆、A～E 狀態表、模型／Fast 欄位、平行派工、
Browser acceptance、真實使用者 evidence 與 Git checkpoint 操作規則，見
`docs/project-control/project-control-response-protocol.md`。該文件是本節
的 canonical operational reference；AGENTS.md 仍是 policy authority。

最重要鐵律：

- 每次 Project Control 回覆底部固定附 A～E 六欄工作表，模型與 1.5× Fast 欄位不得省略。
- 每份派工固定使用外層 Header → 單一可複製 Worker prompt → 外層 Footer；三行 destination/model/Fast 不得進入 prompt 本體，Header/Footer 必須一致。
- 沒有正式派工不得標 `WORKING`；Worker 完成後沒有下一棒即改 `WAITING` 或 `CLOSED`。
- 平行施工以不發生 file、runtime、fixture、Browser session、deploy collision 為前提。
- Browser Web 驗收採 control-by-control；真實使用者 Browser FAIL 優先於其他 fixture PASS。
- Git checkpoint 必須精確對應本次 patch；mixed file 無法隔離時標記 `BLOCKED_BY_MIXED_FILE`。
- Production Web 多檔部署只走 manifest-driven `deploy-dashboard-manifest.ps1`；先通過唯讀 precheck，保留完整 rollback 與 receipt，僅由 `dashboard-service.ps1` 管理單一 Dashboard。不得直接複製檔案或重啟 rAthena；完整契約與驗收狀態見 `docs/project-control/web-production-deployment.md`。

本節固定 Project Control 1／2／3 歸納出的開發方法，避免更換 Project Control 對話後：開發方向遺失、已完成能力被重新實作、派工格式退化、工作線 scope 失控、大量 recursive search、infrastructure／refactor 蓋過玩家功能恢復，或功能恢復而沒有 Git checkpoint。

### 1. Development Method

所有既有功能恢復工作固定使用：

```text
LAST_GOOD
→ CURRENT
→ FIRST_BROKEN_TRANSITION
→ MINIMAL_FIX
→ BOUNDED_TEST
→ LIVE_ACCEPTANCE
→ GIT_CHECKPOINT
```

任何過去已由 OpenKore Exit docs、Gate 1A / 1B / 2 / 3、runtime proof、historical PASS、known-good commit 證明存在的能力，預設視為 `REGRESSION` / `INTEGRATION RESTORATION`，不得直接重新設計或重新實作。只有證據證明能力從未存在，才允許 new implementation。

預設問題永遠是：

```text
"Where is the first broken transition?"
```

不是：

```text
"How should we redesign this system?"
```

### SYNTHETIC_FIRST_DEBUGGING_GATE_V1

跨層 runtime／control-flow 問題涉及 Player Web、Dashboard API、Auth、
Ownership、Controller、Command Dispatch、Native、Persistent Agent、
rAthena、Event Ledger 或 state reconciliation 時，必須先使用
`SYNTHETIC_FIRST_DEBUGGING_GATE_V1`。正式順序為：

```text
DIAGNOSTIC FIRST
→ TRACE FIRST
→ SYNTHETIC FIRST
→ FIRST_BROKEN_TRANSITION
→ MINIMAL FIX
→ SYNTHETIC REGRESSION
→ BROWSER LAST
```

完整 Worker 執行方式見：
`.agents/skills/synthetic-first-debugging/SKILL.md`。

Canonical execution sequence：

```text
LAST_GOOD / CURRENT
→ WEB_DIAGNOSTIC / RUNTIME_HEALTH
→ ACTION_TRACE
→ SYNTHETIC_SCENARIO
→ FIRST_BROKEN_TRANSITION
→ OWNER
→ MINIMAL_FIX
→ BOUNDED_TEST
→ SYNTHETIC_REGRESSION
→ CLEAN_CHECKPOINT
→ SUPERSET / PROVENANCE
→ CONTROLLED_DEPLOY
→ SYNTHETIC_LIVE_ACCEPTANCE
→ BROWSER_FINAL_ACCEPTANCE
```

`HTTP 200 != PASS`、`SOURCE_PASS != PRODUCTION_PASS`、`NO_EVIDENCE != PASS`、
`STALE_EVIDENCE != CURRENT_PASS`。Synthetic PASS 不取代涉及 UI 的 Player Web
最終 Browser acceptance。

有既有 scenario 支援時，Worker 必須優先使用
`scripts/player-scenario-runner.mjs`。預設為 dry-run；live mutation 需要
明確 `--execute`，並使用合法 auth、canonical endpoint、canonical controller
與唯一 canonical runtime。不得 bypass auth、手動改 DB、偽造 success 或建立
第二套 runtime。

純 CSS／layout／DOM／browser-only presentation defect 可由 Browser 先定位，
並將 Browser 標為 `FIRST_BROKEN_TRANSITION` domain。此例外不改變 Browser
final acceptance 規則。

Owner stop rule：

```text
A 發現斷點已進 Native → STOP，OWNER = D
D 發現 Native 正常而 Web projection 錯 → STOP，OWNER = A / B
B 發現 server state 正確但 DOM reconcile 錯 → B 繼續
```

預設 owner routing 為：Browser／presentation → B、Dashboard／API／Controller
→ A、Native／PA → D、Quest semantics → E、reference gap → F。Admin diagnostic
read model → G 與 Synthetic／Trace infrastructure → H 僅是 Project Control
明確指定後才成立的邏輯 owner，不改變既有 A～E footer 狀態表。

不得跨 owner 擴修。Synthetic First 只負責 bounded reproduction／diagnosis，
不覆蓋 Quest Flow First、rAthena Reference Atlas、OpenKore Reference Atlas、
Single Runtime Policy、nearest legal reproducible state、Browser final
acceptance 或 Git hygiene。

### CONTINUOUS_REFERENCE_MINING_V1

```text
REFERENCE_MINING_IS_CONTINUOUS = YES
REFERENCE_LOOKUP_MODE = REACTIVE_LOOKUP / PROACTIVE_MINING
F = REFERENCE_MINING_OWNER
C = GOVERNANCE / PRIORITY / GATE
OTHER_WORKLINES = ATLAS_CONSUMERS
```

Reference work has two valid modes. `REACTIVE_LOOKUP` runs before development or
when a blocker appears. `PROACTIVE_MINING` lets F work the canonical
`docs/reference-mining/research-backlog.yml` when no urgent request is active.
An existing Atlas answer is reused; a semantic or high-risk gap becomes
`REFERENCE_MINING_GAP = YES` and routes to F. A topic can be `CLOSED_TOPIC` while
the F capability remains available.

Evidence priority is fixed:

```text
CURRENT_PROJECT_CANONICAL_SOURCE
→ CURRENT_AUTHORITATIVE_UPSTREAM_SOURCE
→ OFFICIAL_DOCS / WIKI
→ HIGH_VALUE_RATHENA_FORUM_TECHNICAL_EVIDENCE
→ OPENKORE_AUTHORITATIVE_SOURCE / DOCS
→ OTHER_COMMUNITY_MATERIAL
```

`FORUM != AUTHORITY`. Every forum or community finding must pass:

```text
FORUM_FINDING
→ CURRENT_UPSTREAM_SOURCE_VERIFICATION
→ PROJECT_LAST_GOOD_COMPARISON
→ APPLICABILITY_CLASSIFICATION
→ ATLAS_UPDATE
```

Use only `REUSE`, `ADAPT`, `IMPROVE`, `REJECT_LEGACY` or `NOT_APPLICABLE`.
Every inheritable reference record carries `UPSTREAM_BASELINE`, `LAST_REVIEWED`,
`VERSION_CONFLICT` and `STALE_REFERENCE`. Current source semantics win a stale
or conflicting reference; record `ADAPT` or `REJECT_LEGACY`, never inherit
silently.

`REFERENCE_MINING_DONE = YES` requires a durable record containing:

```text
QUESTION
PROJECT_RELEVANCE
AUTHORITATIVE_SOURCE_CHECK
FORUM/WIKI_FINDING
CURRENT_VERSION_APPLICABILITY
PROJECT_LAST_GOOD_CHECK
CLASSIFICATION
SOURCE_POINTERS
RISKS
ATLAS_UPDATE
INDEX_UPDATE
```

Continuous mining applies to runtime semantics, server authority, navigation,
combat, Quest, item, session, protocol, performance, security and high-risk
architecture. It does not block low-risk local UI or CSS work. Synthetic First
still diagnoses the actual runtime break before a broad semantic reference
search; Quest Flow First and both Reference Atlas gates retain their order.

### 2. Project Control Migration

Project Control 搬到新對話時，禁止只搬最後一條工作指示。必須建立完整 `PROJECT CONTROL MIGRATION BUNDLE`，至少包含：

```text
PROJECT IDENTITY
NON-NEGOTIABLE RULES
CURRENT PRODUCTION STATE
CURRENT GIT STATE
LAST-GOOD EVIDENCE
CURRENT FEATURE MATRIX
PRODUCT DECISIONS
COMPLETED WORKLINES
ACTIVE / PENDING WORKLINES
TEST / LIVE ACCEPTANCE MATRIX
KNOWN TECH DEBT
NEXT 3 ACTIONS
```

新 Project Control 必須能在不重讀舊聊天的情況下接手。

### 3. Worker Dispatch Format

所有 Kilo / Codex / A／B／C／D／E substantial workline 固定包含：

```text
WINDOW
WORKLINE_ID
ROLE
OBJECTIVE
CURRENT SOURCE OF TRUTH
WORKSPACE_ROOT
ALLOWED_PATHS
EXACT_FILES_FIRST
FORBIDDEN_SEARCH
DO_NOT_TOUCH
PHASES
STOP_CONDITIONS
TESTS
FINAL REPORT FORMAT
```

不能只寫「找問題修一下」。

### 4. Search Policy

優先：

```text
exact files
git grep
git ls-files
指定目錄 bounded search
```

禁止預設使用：

```text
Get-ChildItem -Recurse
dir /s
C:\ recursive search
Project root recursive scan
.tmp-* archaeology
node_modules scan
backup scan
```

如果 `ALLOWED_PATHS` 找不到需要的 symbol：

```text
STOP
→ 回報 SEARCH_SCOPE_INSUFFICIENT
```

不得自行擴大搜尋範圍。

### 5. Canonical Source

```text
Web repo:
C:\Users\Administrator\.codex\.chatgpt-projects\g-p-6a9bcb57afdc8191966436643af8acdf\terminal-arpg

Persistent native source:
C:\Users\Administrator\source\ghost-island-rathena

Production:
C:\Users\Administrator\ghost-island-production\ro-stack
```

`.tmp-*` worktree 只能作為歷史證據、patch evidence、isolated work，不得作為 canonical production source。

### 6. Single Runtime Policy

只允許 canonical `login`、`char`、`map`、`Dashboard`、`MariaDB`。禁止啟第二套 login／char／map runtime。需要 runtime proof 時，使用既有 canonical runtime。

### 7. OpenKore Policy

OpenKore runtime count 必須保持 `0`。OpenKore 不得重新成為 runtime dependency。OpenKore Exit 文件只能作 `LAST_GOOD` / historical evidence。

### 8. Project Control Priority

優先順序：

```text
1. 玩家可見功能恢復
2. 已知成功行為保留
3. 最小 regression surface
4. 最少 production disruption
5. Git 可重建性
6. architecture cleanup / tooling cleanup
```

不得讓 launcher refactor、retry harness、framework、architecture cleanup、tooling redesign 長期阻塞玩家功能恢復；除非它是當前功能真正的 `FIRST_BROKEN_TRANSITION`。

### 9. UI Policy

UI styling 預設 frozen。除非使用者明確要求，不得進行 cosmetic redesign。功能恢復優先。

### 10. Token / Context Policy

- Project Control 可以保留完整 `CURRENT SOURCE OF TRUTH`。
- Worker 只取得當前任務需要的 context。
- 一般 worker prompt：背景保持精簡，但 implementation phases 必須明確完整。
- Worker final report：約 10–20 行。`PASS` 只報結果與 test counts；`FAIL` 才附必要 evidence。
- 如果 worker 對話開始堆積大量歷史：`STOP` → 新開 worker conversation → short `CURRENT SOURCE OF TRUTH` handoff。不要無限累積上下文。

### 11. Git Checkpoint Policy

已完成工作不能長期只存在 dirty／untracked tree。重大 continuation 或 Project Control migration 前，應建立 Git checkpoint。

changes 分類：

```text
READY
WIP
UNKNOWN
UNRELATED
```

只有 `READY` 可以 commit。禁止：

```text
git add .
git add -A
git clean
git reset --hard
git checkout .
git restore .
```

逐檔 `git add <exact-file>`；mixed file 用 `git add -p <exact-file>`。commit 前執行 `git diff --cached --stat` 與 `git diff --cached`。

不得 commit：runtime log、backup、binary、secret、database、`node_modules`、`.tmp` artifact。

Production 已部署但 Git 無法 fresh-checkout 重建：不能視為真正完成。

### 12. Completion Definition

功能真正 `DONE` 必須符合適用項目：

```text
SOURCE FIXED
BOUNDED TEST PASS
LIVE ACCEPTANCE PASS
PRODUCTION HEALTHY
OPENKORE = 0
GIT CHECKPOINT EXISTS
```

不能只有 `source changed` 或 `production currently works` 就宣告永久完成。

For user-facing Web features:
DONE requires BROWSER_UI_PASS when the acceptance criteria depend on visible UI behavior.

### 13. Current Product Decision Examples

以下作為「產品決策應寫入 Migration Bundle」的例子：

- 玩家掛機只選地圖，不選怪物
- 只有存在合法 monster spawn 的地圖可掛機
- 城鎮可顯示，但不可作掛機地圖
- `AUTO_FARM` 自己 SCAN / TARGET / RETARGET
- Admin control 不建立 Player Web session
- OpenKore 不恢復

這些是目前決策的例子。未來產品決策若改變，必須更新 `CURRENT SOURCE OF TRUTH`，不能靠舊聊天猜測。

### 14. Default Workflow

任何工作線預設：

```text
PHASE 1  LAST_GOOD / CURRENT
PHASE 2  FIRST_BROKEN_TRANSITION
PHASE 3  MINIMAL_FIX
PHASE 4  BOUNDED_TEST
PHASE 5  LIVE_ACCEPTANCE（如必要）
PHASE 6  GIT_CHECKPOINT
```

若某 Phase 不需要，必須說明原因。

### 15. Reporting Discipline

報告分清 `FACT` / `INFERENCE` / `UNKNOWN`。Evidence 不足時寫 `UNKNOWN`，不得猜測。Worker completion report 不寫聊天式回顧，固定使用：

```text
LAST_GOOD =
CURRENT =
FIRST_BROKEN_TRANSITION =
ROOT_CAUSE =
MINIMAL_FIX =
FILES_CHANGED =
TESTS =
LIVE_ACCEPTANCE =
GIT_CHECKPOINT =
PRODUCTION_TOUCHED =
READY / DONE =
```

### 16. Browser / UI Live Acceptance Policy

When a feature's acceptance criteria require observing or interacting with the actual Player Web / Admin Web browser UI, backend evidence alone is insufficient.

The following are NOT equivalent to browser/UI acceptance:

```text
API returns 200
backend command CONFIRMED
database/read-model updated
native/server logs show PASS
curl/http request succeeds
source/unit tests pass
```

These may prove the backend path, but they do NOT prove that the user-facing Web flow is correct.

If the worker environment does not have real browser/UI interaction capability, the worker MUST report separately:

```text
BACKEND_PATH = PASS/FAIL
UI_LIVE_ACCEPTANCE = REQUIRES_BROWSER
```

and MUST NOT report:

```text
PLAYER_WEB_E2E = PASS
ADMIN_WEB_E2E = PASS
MINIMAP_REALTIME = PASS
UI_STATE_SYNC = PASS
```

unless the actual browser UI was observed/interacted with.

For browser-required features, final acceptance must verify the actual UI behavior, including where relevant:

- button click works
- visible state changes correctly
- loading/disabled states are correct
- rendered values match backend state
- live freshness/latency is acceptable
- map/marker/UI position updates are visible
- no stale UI remains after backend success

Project Control must distinguish:

```text
SOURCE_PASS
BACKEND_PASS
BROWSER_UI_PASS
```

Only BROWSER_UI_PASS qualifies as full E2E PASS when UI observation is part of the acceptance criteria.

If browser access is unavailable:

```text
STOP at backend/source acceptance and explicitly request browser/live acceptance.
Do not substitute API/log evidence.
```

### 16A. Developer Diagnostics / Admin Browser Separation Policy

Before writing a new diagnostic or handing off a same-owner blocker, inspect
`node ops/ro-stack/ghost-island-dev.mjs capabilities <domain> --json` and use
the registered local command when it supplies the required evidence. The
canonical guide is `docs/project-control/developer-diagnostics-console.md`.
Use the lower-level authority when the registry has a gap or the task needs
evidence the console does not expose. A local action is permitted only through
the existing canonical action contract and its approval, audit and admission
gates. Report `DEVELOPER_CONSOLE_CAPABILITY_CHECK`,
`DEVELOPER_CONSOLE_USED`, `DEVELOPER_CONSOLE_COMMANDS`, and
`DEVELOPER_CONSOLE_GAP`; if a relevant command exists but is unused, explain why.
The same owner continues bounded diagnosis or maintenance in place.

```text
DEVELOPER_DIAGNOSTICS_BROWSER_REQUIRED = NO
LOCAL_CANONICAL_AUTHORITY_FIRST = YES
CANONICAL_SERVER_SIDE_ACTION_FIRST = YES
BROWSER_REQUIRED_ONLY_FOR_UI_ACCEPTANCE = YES
DIRECT_DB_MUTATION_AS_ACTION_SUBSTITUTE = FORBIDDEN
```

Developer debugging uses local authoritative evidence in this order: rAthena /
Native / PA logs; runtime process, listener and state; PA / SERVER_AGENT live
projections; Event Ledger and command state; read-only DB; deployment, runtime,
lease and receipt evidence; ProcDump / memory dump; Windows process and event
evidence. Inspect mode, ownership, quarantine reason, command, target, errors,
logs, health and crash or hang evidence through these channels. Determine
`FIRST_BROKEN_TRANSITION` without requiring Admin Browser or human login.

For an existing state-changing capability, use an approved local developer
entry point to the **same** canonical server-side action and its authorization
and business validation. This includes `recover_quarantined_to_idle`, runtime
recovery, safe release and controlled stop/start. A CLI, local adapter or
server-side command is valid only when it invokes that existing action contract.
Human Admin Web remains protected by Cloudflare Access. Local diagnostics and
developer actions retain their own authorized boundary. Never substitute direct
SQL state mutation, forged or copied credentials, disabled authentication or a
second action authority.

If the Browser is the only executable entry point for an existing backend
action, report `DEVELOPER_ACTION_ENTRYPOINT_MISSING = YES`. The same owner may
add a bounded local developer entry point only when it reuses the canonical
action, preserves authorization and validation, stays local, and parity tests
pass. A new subsystem or authority boundary requires Project Control review.

Real Browser evidence remains mandatory for visible UI behavior, button
interaction, responsive layout, map rendering, animation, Browser audio and
visible state synchronization. Backend evidence does not establish
`BROWSER_UI_PASS`. Applicable reports include
`DIAGNOSTIC_AUTHORITY_USED`, `BROWSER_REQUIRED_FOR_TASK`, `BROWSER_USED`,
`SERVER_SIDE_ACTION_USED`, `DIRECT_DB_MUTATION_USED` and
`DEVELOPER_ACTION_ENTRYPOINT_MISSING`.

### 17. Canonical Workline Templates

New worklines MUST use:

```text
WORKLINE_DISPATCH_TEMPLATE_V1.2
defined at:
docs/project-control/workline-dispatch-template.md
```

Existing / blocked worklines MUST use:

```text
WORKLINE_CONTINUATION_TEMPLATE_V1.2
defined at:
docs/project-control/workline-continuation-template.md
```

Templates are operational procedure. `AGENTS.md` remains policy authority.

Continuation work MUST NOT restart discovery by default. It must resume from:

```text
CURRENT_PHASE
LAST_CONFIRMED_GOOD
FIRST_BROKEN_TRANSITION
```

unless Project Control explicitly orders a reconstruction.

Short form:

```text
For new workline:
Use WORKLINE_DISPATCH_TEMPLATE_V1.2.

For existing workline:
Use WORKLINE_CONTINUATION_TEMPLATE_V1.2.
Continue from CURRENT_PHASE.
Do not restart audit.
```

### CONTINUE_IN_PLACE_EXECUTION_POLICY

```text
CONTINUE_IN_PLACE_FIRST = YES
ORIGINAL_WINDOW_OWNS_BOUNDED_BLOCKERS = YES
BOUNDED_BLOCKER_AUTONOMOUS_RESOLUTION_REQUIRED = YES
WORKER_MUST_EXECUTE_TO_COMPLETION_WITHIN_SCOPE = YES
```

既有工作線遇到同一 owner、同一 capability scope、可由既有架構處理的 bounded blocker，
須在原視窗依 `FIRST_BROKEN_TRANSITION → ROOT_CAUSE → MINIMAL_FIX → BOUNDED_TEST
→ CHECKPOINT → RESUME ORIGINAL TASK` 處理。例行同範圍 blocker 不送回 Project Control；
僅觸發 canonical `PROJECT_CONTROL_STOP_CONDITIONS` 時回報決策。缺少舊指令或本機參數
應先依既有文件與工具安全重建。人工 Player login／密碼不得作為預設測試前置；
優先使用已授權的 headless fixture／test control，並保留正式 Browser 驗收要求。
完整執行與停止條件見 `docs/project-control/workline-continuation-template.md`；
既有 routing、security、Single Runtime 與 no-progress 安全閥仍有效。

### DEVELOPMENT_FLOW_EFFICIENCY_POLICY_V1

```text
DEVELOPMENT_FLOW_EFFICIENCY_IS_ARCHITECTURE_QUALITY = YES
CONTINUE_IN_PLACE_FIRST = YES
END_TO_END_PREFLIGHT_FIRST = YES
CAPABILITY_FIRST = YES
OBSERVABILITY_BY_DESIGN = YES
ACCEPTANCE_DEFINED_BEFORE_BUILD = YES
REPEATED_FRICTION_ESCALATION = YES
AUTONOMY_TRACEABILITY = YES
NEW_DAILY_MANUAL_APPROVAL_GATE = NO
```

正式能力的工程完成度涵蓋適用的 SOURCE、TEST、RUNTIME、OBSERVABILITY、
DIAGNOSTICS、MAINTENANCE、DEPLOYMENT、ROLLBACK 與 ACCEPTANCE。新正式能力或重大
能力變更開工前，在既有工作脈絡中做 bounded `END_TO_END_PREFLIGHT_FIRST`：
`SOURCE → TEST → RUNTIME → DIAGNOSTICS → DEPLOYMENT → ROLLBACK → ACCEPTANCE`。
依工作範圍標記適用項；明確缺口記為 `DEVELOPMENT_PATH_GAP = <環節／證據／owner>`，
在大量施工前處理。純文件、局部樣式與普通 bounded source bug 可將不適用項標 `N/A`。
此預檢沿用派工與工作紀錄，不另產生日常文件或人工核准。

`CONTINUE_IN_PLACE_FIRST` 適用於同一 authority、security、architecture、
workline objective 與既定 owner 內的 bounded blocker。檔案類型或 tooling 層不同，
不構成換線理由。原視窗沿既有 `FIRST_BROKEN_TRANSITION → MINIMAL_FIX →
BOUNDED_TEST → CHECKPOINT → RESUME` 執行；真正跨越 authority、security、
ownership、runtime engine、product decision 或 canonical `PC_STOP_*` 時依既有
owner routing 停止並交接。

診斷及維護採 `CAPABILITY_FIRST`：先查現有 Developer Console 與 capability
registry（`docs/project-control/developer-console-capability-matrix.json`）。已有命令就
`REUSE`；有 canonical capability 但缺統一入口，就在原 action／authority 上
`EXTEND_ENTRYPOINT`；真正缺能力則記 `DEVELOPER_CONSOLE_GAP`，沿既有 owner 與
authorization 處理。保留底層權威的直接診斷通道，避免一次性 script 或第二套
business logic 取代正式入口。

新增正式能力時採 `OBSERVABILITY_BY_DESIGN`，在既有設計或工作紀錄回答
`AUTHORITY / STATE / SUCCESS_SIGNAL / FAILURE_SIGNAL / EVENT / LOG /
CORRELATION / DIAGNOSTIC_ENTRYPOINT`。source change 前定義適用的
`HOW_TO_PROVE_SUCCESS / HOW_TO_PROVE_FAILURE / LIVE_ACCEPTANCE /
ROLLBACK_ACCEPTANCE`。缺診斷或驗收路徑時，以 `DEVELOPMENT_PATH_GAP` 處理，
避免功能完成後才尋找驗收方法。

Governance 應降低合法操作的反覆摩擦，同時維持 fail-closed、GitHub-first、
authority、可重建性、部署安全、rollback 與 Browser UI 驗收。既有 gate 對同一合法
操作造成反覆人工往返時，在原工作線評估 `AUTOMATE_GATE / GENERALIZE_TOOL /
REMOVE_REDUNDANT_STEP`，保留真正的安全 invariant。同類摩擦第二次出現，記
`REPEATED_FRICTION = YES`，評估 `PLATFORM_CAPABILITY_FIX / DEVELOPER_TOOLING_FIX /
DEPLOYMENT_TOOLING_FIX / GOVERNANCE_SIMPLIFICATION`，優先處理根因；跨越既定
scope 或安全邊界仍依 `PC_STOP_*`。普通 source bug 不新增 Project Control 核准。

未來 PA／Character Autonomy 架構須以 correlation identity 追查
`Life Director intent → Social Director（適用時）→ Persistent Agent action →
rAthena authoritative result → Event Ledger factual record`，並能回答
`WHY_DECISION / INTENT / ACTION / EXECUTION_RESULT / FIRST_BROKEN_TRANSITION /
EVENT_EVIDENCE`。這是架構相容性要求；`NORTH_STAR != IMPLEMENTATION_AUTHORIZATION`，
不授權實作尚未核准的 Director 或 autonomous runtime。

## Short-Term Product North Star

SHORT-TERM PRODUCT NORTH STAR:
Persistent Life V1 — offline SERVER_AGENT-controlled characters continue
participating in the world and accumulate factual Event Ledger memories;
LLM is narrator-only. Canonical definition:
docs/RO_AUTOMATION_PRODUCT_CONSTITUTION.md

Roadmap / future work index（規劃狀態與 `IMPLEMENTATION_AUTHORIZED` 的唯一依據）：
docs/PROJECT_ROADMAP.md；詳細未來系統：docs/roadmap/。
`PLANNED` 不代表已授權實作。

## Character Life & Social Simulation Direction 鐵律

`CHARACTER_LIFE_SOCIAL_SIMULATION_DIRECTION`：`docs/character-life-social-simulation-roadmap.md`
is the canonical long-term product direction for persistent character autonomy
and living-world / social simulation。此方向不是廢棄概念，而是專案的
LONG-TERM PRODUCT NORTH STAR。

Core architecture：

```text
Life Director
→ Social Director
→ Persistent Agent
→ rAthena
```

- Persistent Agent remains the execution authority；Life Director／Social Director 只提出 high-level intent。
- `AUTO_FARM`／Supply／Navigation／Recovery／Quest 是可重用的底層 capability，位於 autonomy layer 之下；它們不是完整的 autonomy product。
- Autonomous mode、`FREE_AGENT`／`WORLD_OWNED`、psyche／mood、memory、diary、Daily Reflection、relationship graph 與 player interaction runtime 均尚未 production；不得因 `AUTO_FARM` 存在就宣稱角色自主完成。
- 所有影響 PA capabilities、control authority、Event Ledger、character state、memory、social interaction 或 autonomous execution 的架構，MUST 保持與此方向相容，除非 Project Control 明確 supersede。

`NORTH_STAR != IMMEDIATE_IMPLEMENTATION_MANDATE`：

- North Star 約束架構，不授權施工；current restoration work 仍為優先。
- Workers MUST NOT opportunistically 開始 Life Director、Social Director、LLM runtime 或 Daily Reflection 實作，也不得藉此擴張當前 workline scope。
- AC1／AC2／AC3 prototypes 維持 `HISTORICAL_REFERENCE`，不得直接 copy 進 production；autonomy implementation 的啟動時機由 Project Control 決定。

Project Control handoff：每次 `CURRENT SOURCE OF TRUTH`／cutover handoff MUST 包含：

```text
LONG_TERM_PRODUCT_DIRECTION = Character Life & Social Simulation
CANONICAL_DIRECTION_DOC      = docs/character-life-social-simulation-roadmap.md
FOUNDATION_STATUS            =
AUTONOMOUS_RUNTIME_STATUS    =
```

禁止每次貼整份 roadmap。

Architecture compatibility gate：下列範圍的派工與驗收 MUST 增加：

```text
CHARACTER_LIFE_DIRECTION_COMPATIBILITY = PASS / FAIL / N/A
```

Question：Does this implementation remain reusable by Life Director／Social Director／Autonomous Character without requiring a second runtime engine？

Scope：Persistent Agent、Combat、Navigation、Supply、Recovery、Quest、Event Ledger、Live State、Control Authority、Memory、Social、Character autonomy。

若 `FAIL`：`STOP` → `PROJECT_CONTROL_DECISION_REQUIRED = YES`。

Current implementation map（不建立新文件）：

```text
FOUNDATION（IMPLEMENTED / PARTIAL）
  Persistent Agent · Event Ledger（persistent_life_session / persistent_life_event）
  AUTO_FARM · Navigation · Supply · Recovery · Quest Runtime · Live projections

NOT YET PRODUCTION
  Life Director · Social Director · AUTONOMOUS mode · FREE_AGENT / WORLD_OWNED
  Psyche / Mood · Memory · Daily Reflection · Relationship Graph · Player interaction runtime
```

Canonical direction doc 內容為歷史原文（`e29b4c5`），不得改寫或現代化；產品設計變更另由 Project Control 決策。

## Routing First 鐵律

### Routing Bootstrap — Canonical Path Derivation

每個新對話開始前，必須依序 **derive** 下列三個路徑，不得猜測或相對定位：

```
Step 1 — Resolve PROJECT_CONTAINER_ROOT
  The directory that contains the terminal-arpg folder.
  Example: C:\Users\Administrator\.codex\.chatgpt-projects\g-p-6a9bcb57afdc8191966436643af8acdf

Step 2 — Derive SHARED_GOVERNANCE_ROOT
  SHARED_GOVERNANCE_ROOT = <PROJECT_CONTAINER_ROOT>\terminal-arpg

Step 3 — Derive WORKSPACE_INDEX_PATH
  WORKSPACE_INDEX_PATH = <SHARED_GOVERNANCE_ROOT>\WORKSPACE_INDEX.md
```

**Missing-path STOP rule**: If `WORKSPACE_INDEX_PATH` does not exist at the derived exact path:

```
STOP → report SHARED_GOVERNANCE_ROOT_INVALID
```

Do **not** search `C:\`, do **not** search sibling worktrees, do **not** guess an alternate location.

任何 Agent 工作開始前：

1. 執行上述 Bootstrap 取得 `WORKSPACE_INDEX_PATH`，以 exact path 讀取
2. 找到自己的 WORKLINE
3. `cd` 到 `ACTIVE_WORKTREE`
4. 驗證：branch（`git branch --show-current`）與 HEAD（`git rev-parse HEAD`）
5. 確認符合索引後才可開始 grep／glob／read／edit

若 branch 或 HEAD 與索引不一致：

回報 `ROUTING_STALE` 並 **STOP**。

**禁止**：因 routing 不一致就自行從 `C:\` 或 Project Root 全域搜尋所有 worktree。

**搜尋範圍規則**：進入 ACTIVE_WORKTREE 後，所有 grep／glob／git／read／edit／build／test 預設只能在該 worktree。跨 worktree 操作只在 Source of Truth 明確引用或 Project Control 明確要求時，且必須使用 exact path。

**Kilo 日常 workspace**：不應以 `C:\` 或整個 project root 開啟。應直接開 ACTIVE_WORKTREE（例如 Workline B → `.tmp-p2d-pa-equipment-action-v1`（Persistent Agent canonical），Workline C → `terminal-arpg-phase4a-canonical`）。

### Routing Extension — Shared Governance Exact-Path Access

**SHARED_GOVERNANCE_ROOT**: `terminal-arpg`
**SHARED_GOVERNANCE_ACCESS**: `READ_ONLY_EXACT_PATH`

A runtime or source worktree does **not** need local copies of governance documents. Agents are explicitly allowed to read the following canonical paths directly:

- `terminal-arpg/AGENTS.md`
- `terminal-arpg/WORKSPACE_INDEX.md`
- `terminal-arpg/docs/RO_AUTOMATION_PRODUCT_CONSTITUTION.md`
- `terminal-arpg/docs/testing-fixture-policy.md`
- `terminal-arpg/docs/openkore-exit-source-of-truth.md`

Rules:
- This exact-path read is **allowed** and is **not** cross-worktree source discovery.
- Must **not** trigger project-root or global search.
- Must **not** cause governance files to be copied into runtime worktrees.
- If a governance file is missing locally: read the canonical shared path. Do **not** search for alternate copies.

### Routing Extension — Shared Support / Harness Roots

**SHARED_SUPPORT_ROOTS** are explicit support resources, not source-of-truth worktrees.

**SHARED_GATE1A_HARNESS_ROOT**: `.tmp-pa-iso-runtime`

Purpose: isolated server startup, isolated DB/schema, fixture setup, formal command transport, runtime observation, cleanup.

Rules:
- Access only when the task explicitly requires the harness.
- Do **not** treat as an alternate source worktree.
- Do **not** search sibling source worktrees from it.
- Do **not** copy the harness into each active worktree.
- Runtime/source modifications still belong only to `ACTIVE_WORKTREE`.

### Routing Extension — Logical Workline Semantics

A / B / C / D / E are **logical worklines**. They are **not** persistent Kilo windows or sessions.

Expected workflow per atomic task:

```
new atomic task
→ declare WORKLINE
→ read WORKSPACE_INDEX
→ route to ACTIVE_WORKTREE
→ work
→ handoff / close conversation
```

### Kilo New-Conversation Absolute Path Rule

For every task intended to start in a **new Kilo conversation**, the handoff prompt MUST include exact absolute paths for:

1. `CANONICAL_PROJECT_ROOT`
2. `SHARED_GOVERNANCE_ROOT`
3. `AGENTS.md` (absolute path)
4. `WORKSPACE_INDEX.md` (absolute path)
5. the task's `ACTIVE_WORKTREE`
6. any authorized shared harness/support root required by the task

**Placeholders MUST NOT be used** in a new-conversation execution prompt when the actual path is already known:

```
<PROJECT_CONTAINER_ROOT>      ← FORBIDDEN in execution prompt
<SHARED_GOVERNANCE_ROOT>      ← FORBIDDEN in execution prompt
<ACTIVE_WORKTREE>             ← FORBIDDEN in execution prompt
```

A new Kilo conversation **MUST NOT** rediscover these locations by:

- searching `C:\`
- recursively searching `C:\Users`
- globbing for `terminal-arpg`
- guessing the repository root

**If an exact path supplied by Project Control does not exist:**

```
STOP → report EXACT_ROUTING_PATH_INVALID
```

Do **not** fall back to global path discovery.

**Required header format for new-conversation prompts:**

```text
CANONICAL_PROJECT_ROOT:
C:\Users\Administrator\.codex\.chatgpt-projects\g-p-6a9bcb57afdc8191966436643af8acdf

SHARED_GOVERNANCE_ROOT:
C:\Users\Administrator\.codex\.chatgpt-projects\g-p-6a9bcb57afdc8191966436643af8acdf\terminal-arpg

READ EXACTLY:
C:\Users\Administrator\.codex\.chatgpt-projects\g-p-6a9bcb57afdc8191966436643af8acdf\terminal-arpg\AGENTS.md
C:\Users\Administrator\.codex\.chatgpt-projects\g-p-6a9bcb57afdc8191966436643af8acdf\terminal-arpg\WORKSPACE_INDEX.md

ACTIVE_WORKTREE:
<absolute task worktree path>

AUTHORIZED_SUPPORT_ROOTS:
<absolute paths if any>
```

The concrete paths may vary by task, but the header itself is mandatory for all new Kilo conversations.

### Persistent Agent 單一來源權威

Persistent Agent 只有一條 authoritative source lineage。此宣告取代其他 PA worktree、branch、patch artifact 與 runtime copy。

```
PERSISTENT_AGENT_CANONICAL_SOURCE:
C:\Users\Administrator\.codex\.chatgpt-projects\g-p-6a9bcb57afdc8191966436643af8acdf\.tmp-p2d-pa-equipment-action-v1
PERSISTENT_AGENT_CANONICAL_BRANCH: canonical/persistent-agent-p2f-v1
PERSISTENT_AGENT_CANONICAL_HEAD:   fd12d2a10ac0109a5f802be2c24107afd11f7419
PERSISTENT_AGENT_LINEAGE:          3ffdad1 -> 5ed8f0d -> 866f423 -> ea5b995 -> c41cc4c -> a3cea54 -> 1fd30bd -> ba0e443 -> 704a4ac (P2B) -> b13a8e2 (P2C NAV4) -> ab44223 (P2D) -> fd12d2a (P2F)
PERSISTENT_AGENT_SUPERSEDED_HEAD: ba0e4433b310e6932464700d93bd37175d71077b (superseded; MUST NOT be used as runtime truth)
PERSISTENT_AGENT_MILESTONE_REF:    milestone/gate3-multimap-relocation-pass-20260917 -> ba0e4433b310e6932464700d93bd37175d71077b
P2F_READ_MODEL_COMMIT:             fd12d2a10ac0109a5f802be2c24107afd11f7419
P2F_READ_MODEL_BRANCH:             feature/p2d-pa-equipment-action-v1
WEB_P2F_READ_MODEL_BRANCH:         feature/p2f-headless-web-read-model
WEB_P2F_READ_MODEL_HEAD:           b6e5a6aafed39ac01eb411f1411e48c2d56a2400
```

- P2F canonical advance 由 P2D worktree 升格：`.tmp-p2d-pa-equipment-action-v1` 同時承載 P2B（supply）、P2C NAV4 integration 與 P2D equip/unequip，並在其上加入 P2F authoritative read model。
- `ba0e443` 為 P2B 之前的中間里程碑，已被 `ab44223` 取代；不得再作為 canonical runtime truth。
- Persistent Agent source 變更一律從上列 canonical worktree 開始。
- 舊 canonical worktree `.tmp-gate1a-player-flow-v1`（branch `canonical/persistent-agent-no-client-v1` @ `a3cea54`，工作樹 dirty）自 canonical advance 完成起降級為 `LEGACY_DIRTY_REFERENCE` / `SOURCE_AUTHORITY=NO`，唯讀保留；不得對它執行 reset／stash／clean／checkout／branch-switch／commit／delete。
- `.tmp-server-agent-no-client-controller-v1`、`.tmp-pa-lifecycle-consolidation-v1` 為唯讀歷史 reference，不得刪除。
- `.tmp-pa-iso-runtime` 為 shared test/runtime support，不是 source authority、不是 command-contract authority。
- 舊 `persistent-agent.patch` 為 stale derived artifact，不得視為來源權威。
- 在其他 PA worktree 嘗試 PA source edit：STOP → 回報 `NON_CANONICAL_PA_WORKTREE`。

詳細分類見 `terminal-arpg/WORKSPACE_INDEX.md` 與 `docs/openkore-exit-source-of-truth.md`。

### Web／SERVER_AGENT W1–W4 Closure Source

W1–W4 Web 整合已凍結為一條乾淨 source lineage。Web source 修改自此 lineage 開始，不得再把 `terminal-arpg` dirty web tree 當作實作來源。

```
WEB_SERVER_AGENT_W1_W4_CLOSURE_WORKTREE:
C:\Users\Administrator\.codex\.chatgpt-projects\g-p-6a9bcb57afdc8191966436643af8acdf\.tmp-web-server-agent-w4-closure
CLOSURE_BRANCH: closure/web-server-agent-w4-v1
CLOSURE_HEAD:   728b0eac9792b50ea5861dd95247ee23fe65bf90
CLEAN_BASE:     e179a996e0dcddd217e87d1e4b94c62576fc8ab3
MILESTONE_REF:  milestone/web-w1-w4-server-agent-integration-pass-20260917
WEB_W1_W4_PROVENANCE: CLOSED
NEXT:           AUTOMATED_PRODUCTION_CANARY
```

- W1／W2／W3／W4 已 PASS（W1_CONTROL_CANARY、W2_AUTONOMOUS_STATE、W3_SUPPLY_STATE、W4_MULTI_MAP_WEB_FUNCTIONAL、W4_DIRECT_DUNGEON_FLOOR）。
- `OPENKORE_REMOVED = NO`、`PRODUCTION_READY = NO`；不得因本 closure 宣稱 OpenKore Exit 完成。
- `terminal-arpg` dirty web tree 維持 `READ_ONLY` 參照；其 web source 未被 closure 修改。
- 詳細 provenance、限制與 accepted runtime hash 見 `docs/openkore-exit-source-of-truth.md` 的 W1–W4 SERVER_AGENT Web Integration Closure 節。

## Single Runtime Policy 鐵律

Project Control 於 2026-09-18 生效：`EXTRA_TEST_SERVER_ALLOWED = NO`、
`SECOND_RATHENA_STACK_ALLOWED = NO`。唯一授權 runtime 為 canonical
login 6901／char 6122／map 5122／dashboard 8788，DB `ragnarok`，穩態必須是
login／char／map 各一。

- 退休所有測試 runtime 慣例（6902／6123／5123／8792、6904／6124／5124、
  6905／6125／5125）與 `.tmp-*` rAthena live stack；任何 Workline 不得自行重建。
- 需要載入新版 binary 時，只允許受控重啟 canonical instance，不得 old + new
  同時存活或建立第二套 parallel runtime。
- 任何 canonical restart 前必須完成 `docs/single-runtime-policy.md` 的
  RESTART SAFETY 清單（範圍、binary／config、PID、graceful stop、port released、
  exactly one replacement、health gate、Persistent Agent resident gate、
  OpenKore = 0、Web smoke test）。
- destructive 測試（deliberate map crash、duplicate owner、quarantine、
  stale runtime corruption、destructive DB mutation、competing physical
  map-server）禁止在 production 進行；改用 unit／persistence-layer／
  state-machine harness／controlled claimant fixture，無法證明時 STOP 回報
  Project Control。
- `ops/ro-stack/runtime-guard.ps1` 是唯一 runtime admission control 且
  fail-closed；偵測到 login／char／map 超過一個、非 canonical runtime path 或
  retired port listener 時固定標記 `UNAUTHORIZED_RATHENA_RUNTIME`。
  `ops/ro-stack/ro-stack.ps1 start|restart` 啟動前必須通過此 guard。
- `ops/ro-stack/runtime-sentinel.ps1` 由 hidden Scheduled Task
  `GhostIslandRO-RuntimeSentinel`（`-Continuous -IntervalSeconds 10`）常駐，防止
  從 VSCode／Kilo／CMD 直接啟動繞過 launcher；只檢查 live process + TCP
  listener，不掃磁碟，fail-safe 不 kill canonical port holder，終止前寫 audit，
  cloudflared 只稽核不 kill。

完整決策、restart 清單與操作指令見 [Single Runtime Policy](docs/single-runtime-policy.md)。

## 第一性原理優先鐵律

所有架構、功能、測試與除錯工作，先定義真正目標，再檢查現有實作與工具。

固定區分以下責任層：

- `Server Authority`：裁定世界、角色、任務、物品、地圖、NPC、冷卻、擁有權與生命週期。
- `Controller`：提出並執行合法意圖，例如 Native Client、`SERVER_AGENT` 或 OpenKore。
- `Transport`：傳遞意圖、回應與事件的封包、命令、檔案或 API。
- `Presentation / UI`：呈現狀態與收集輸入。
- `Historical implementation`：保留作來源與相容性參考的舊流程。

Native Client、OpenKore、packet、UI、`status.json`、`.cmd` 與 `.result` 先視為可替換實作方式；遊戲規則由 Server Authority 與不可破壞的 invariant 定義。修改前固定回答：

1. 真正的 authority 在哪裡？
2. 哪些 invariant 不能破壞？
3. 哪些部分只負責 transport？
4. 哪些部分只負責 UI？
5. 哪些部分屬於歷史相容層？
6. 最短可驗證的玩家流程是什麼？

優先重用既有 Server Authority，維持 `docs/testing-fixture-policy.md` 的 Player-flow First 驗收與 `docs/openkore-exit-source-of-truth.md` 的 OpenKore Exit 判定。完整思考流程、範例與決策模板集中於 [RO 自動掛機版產品鐵律](docs/RO_AUTOMATION_PRODUCT_CONSTITUTION.md#第一性原理優先)。

執行大型功能驗證、Integration、Vertical Slice、Restart、Quest、Agent 或長時間自動化測試前，必須讀取 `.agents/skills/nearest-valid-test-state/SKILL.md`。除非任務明確要求 Full End-to-End Regression，測試必須從距離被測功能最近、合法、可重現且不污染正式資料的已知狀態開始。不得為取得後段測試資格，重跑與本輪目標無直接關係的練等、農素材、onboarding、一轉、長距離導航或已驗證任務鏈。

### Representative Evidence / Test Acceleration Rule

固定原則：「可以加速環境，不可以偽造結果。」測試加速只限隔離測試帳號、fixture、PoC、regression 或 production-like 測試環境；正式玩家與 production gameplay 全數禁止。

啟用加速前，必須先以真實 runtime evidence 完成至少一次與被加速重複條件相同的核心機制閉環。例如擊殺任務必須先證明 target selection → movement → combat → kill attribution → rAthena 真實 quest progress 增加，後續才可在隔離環境生成剩餘同種測試怪物。Agent 仍必須自行尋找、移動、戰鬥與擊殺，任務進度仍由 rAthena 原生機制產生。EXP／Job EXP、測試資源、fixture cooldown／timer 與重複純等待也適用相同閥門。

禁止直接修改 quest count、以 SQL 改 quest state、直接標記 quest complete、直接發放正式 quest reward，或將手動改寫 Inventory、Zeny、HP／SP 當成 loot、shop／service、recovery evidence。不得跳過當前被測的 NPC script、Navigation、ownership collision、restart recovery 或 reward confirmation，也不得將 fixture 結果稱為 production PASS。

每次使用測試加速，必須在 runtime evidence、`RESULTS.md` 或 Roadmap 標記 `TEST ACCELERATION`，並記錄加速原因、加速前真實證據、被調整的環境條件、仍由真實系統產生的結果，以及對 production validity 的影響。完整決策與範例見 `.agents/skills/nearest-valid-test-state/SKILL.md`。

## Pre-Implementation Reuse Gate 鐵律

```text
NO NEW FEATURE / SUBSYSTEM IMPLEMENTATION
WITHOUT PRE_IMPLEMENTATION_REUSE_GATE = PASS
```

新增 `NEW_FEATURE`、`NEW_SUBSYSTEM`、`NEW_CAPABILITY`、
`NEW_EXTERNAL_DEPENDENCY`、`NEW_MAJOR_ALGORITHM`、
`REPLACEMENT_OF_EXISTING_SUBSYSTEM` 前，必須先完成
`PRE_IMPLEMENTATION_REUSE_GATE`：先查現行專案與 legacy，再查
`ops/research/external-reuse-registry.json`；OpenKore 相關能力先查
`docs/openkore-harvest-registry.md`（`OPENKORE_REMOVED = NO` 期間 OpenKore
為 incumbent legacy reference）；最後才查外部生態。

`BUILD_NEW` 必須有 `whyNotReuse`。`BUG_FIX`、`TEST_ONLY`、`DOC_ONLY`、
`PROVENANCE_ONLY`、`FORMAT_ONLY` 與一般 maintenance 不需要 gate；
`KNOWN_IMPLEMENTATION_TASK` 以 `REUSE_GATE_INHERITED_FROM` 繼承 parent gate，
不重跑同一份 audit。

Canonical schema、decision taxonomy、failure codes 與 evaluator 只在
`docs/pre-implementation-reuse-gate.md` 與
`.agents/skills/external-ecosystem-reuse/SKILL.md` 定義；本節不複製 schema。

## Player-flow First 測試鐵律

1. 功能驗收優先使用真實玩家正常會採取的行為流程。
2. 設計測試前，先回答三個問題：玩家正常會怎麼做？正式遊玩時的完整行為鏈是什麼？這次測試是否覆蓋該玩家流程？
3. DB provisioning、GM／admin command、teleport、heal、item injection、deterministic monster spawn、固定座標與 `test-only allowlist` 可用於建立 fixture、加速測試、diagnostic test 與問題重現。人工化診斷結果不得直接作為完整功能驗收 PASS。
4. 功能最終 PASS 必須由 Player-flow test 完成。
5. 玩家會走路、使用蒼蠅翅膀、回城、補給、使用 Kafra、找 NPC、換地圖、找怪、戰鬥、撿物或死亡後恢復時，主要驗收優先覆蓋同一條真實行為鏈。
6. Diagnostic test 可以高度人工化，只用於定位底層問題，不能取代 Player-flow acceptance。

固定測試身分契約見 `docs/project-control/canonical-test-identities.md`：`TEST_SUPERUSER` 僅建立測試前置條件，`TEST_PLAYER` 以一般玩家權限執行最終驗收。`GM_FIXTURE_RESULT != PLAYER_FLOW_PASS`；每次測試加速必須揭露原因、管理員動作、先前真實證據與有效性限制。測試帳號須排除公開排名與正式經濟、Life／Social 模擬；帳密、token、cookie 與 secret 只存放本機受控憑證機制，禁止寫入 Git、治理文件或測試回報。

## OPENKORE-REFERENCE / PA-RUNTIME POLICY 鐵律

Policy name：`OPENKORE_REFERENCE_POLICY`

OpenKore Exit 的本質是 `RUNTIME AUTHORITY MIGRATION`，不是功能或工程知識的廢棄。
OpenKore 退出 Production Runtime，由 PA／SERVER_AGENT 接替正式執行角色；但 OpenKore
累積多年的成熟工程知識、演算法、資料模型、狀態機、例外處理與 Last-Good 行為必須
永久保留，並優先作為 Reference Implementation。

核心原則：

```text
Study OpenKore.
Understand its proven behavior.
Reproduce that behavior faithfully in PA / rAthena.
Do not re-enable OpenKore as the runtime.
```

### 1. Runtime Authority

```text
Production Runtime:     PA / SERVER_AGENT → rAthena authoritative runtime
OpenKore process count: 0
```

正式執行鏈固定為 `PA → rAthena`，禁止 `PA → OpenKore → rAthena`。OpenKore 不得重新
成為 production runtime dependency，也不得成為 command、navigation、combat 或
supply executor，或任何 gameplay authority。

### 2. OpenKore Permanent Value

OpenKore 永久保留為：Reference Implementation、Last-Good Behavior Source、
Data Contract Reference、Algorithm Reference、State-Machine Reference、
Edge-Case Knowledge Base、Historical Acceptance Evidence。退出 Runtime 不代表我們
應忽略或重造這些能力。

### 3. Learn and Reproduce, Do Not Re-enable

「模仿 OpenKore」指模仿其 behavior、semantics、algorithm、data model、
update timing、state transitions、retry policy、recovery behavior 與
edge-case handling，不是複製其 process／runtime architecture。

### 4. Default Restoration Strategy

對既有能力（包括但不限於 Combat、Target Selection、Loot、Navigation、Supply、
Death Recovery、Shop、Kafra、Inventory、Equipment、Farm Statistics、
Character Live State、Web Status Projection、Quest-related legacy behavior）預設流程：

```text
OpenKore Last-Good / Reference
→ Current PA implementation
→ FIRST_BROKEN_TRANSITION
→ Minimal Glue / Minimal Port
→ Bounded Test
→ Live Acceptance
→ Browser UI Acceptance
→ Git Checkpoint
```

不得跳過 Last-Good reconstruction 直接重新設計功能。

### 5. No Duplicate Engine Policy

若 OpenKore 已有成熟且已驗證的 route planner、combat policy、target policy、
supply behavior、state machine、retry／recovery algorithm、inventory semantics 或
data contract，必須先研究其現有實作。禁止在沒有證據與 Project Control 決策下重新
發明第二套 navigation engine、combat engine、supply engine、route planner、
state machine、character state model 或 Web data contract。

若要偏離 OpenKore Last-Good 行為，必須明確記錄：

1. Technical reason
2. Current architecture constraint
3. Project Control decision

### 6. PA Replaces OpenKore's Runtime Role

```text
Historical: rAthena → packets → OpenKore → maintained character state → status/logs → Dashboard → Browser
Current:    rAthena → PA / SERVER_AGENT → authoritative live state / projections / event ledger → Dashboard → Browser
```

PA 承接 OpenKore 過去作為「角色即時狀態提供者」的功能角色；且 PA 直接位於 rAthena
authority 內，應比 OpenKore 更直接取得與提供角色狀態。

### 7. Data Migration Principle

OpenKore Exit 前，Web 消費 OpenKore 已整理完成的角色狀態；Exit 後，不應讓每個
Web page／consumer 各自從多個 DB source 臨時重新拼出同一份角色狀態。應優先由 PA
authority 提供清楚的 Live Snapshot、Inventory／Equipment Projection、
Farm Session State、Event Ledger、Quest State 與 Navigation／Runtime State。

Migration 核心目標：

```text
OpenKore-provided state semantics → PA-provided authoritative state semantics
```

而不是：

```text
OpenKore removed → every Web feature redesigns its own data source
```

### 8. State vs Event

```text
Live Snapshot / Projection = 現在角色是什麼狀態
Event Ledger               = 剛剛發生了什麼事情
```

Live state 可包含 map、x／y、HP／SP、Base EXP／Job EXP、Zeny、runtime mode、
farm target、current target、updatedAt、revision。Inventory／Equipment Projection
包含 inventory、equipment、generation／revision。Event Ledger 包含 target、attack、
hit、kill、loot、supply、death、recovery、navigation events。

不得為了降低 query 次數，就建立一個包含所有系統的巨大 Everything Snapshot。

### 9. Restore First, Optimize Second

```text
PHASE A: OpenKore-era proven behavior → PA authoritative runtime
PHASE B: 功能與資料接線穩定後，再進行 measurement-driven 效能優化
```

PHASE B 才允許 Real User Monitoring、Browser latency tracing、P50／P95／P99、
Network／Server／Read Model／Frontend Render latency 與 freshness／revision
monitoring。固定原則：

```text
Correct behavior first.
Measure second.
Optimize the measured bottleneck third.
```

功能接線尚未恢復時，禁止在無明確證據下進行大型 architecture rewrite、
transport rewrite、telemetry rewrite、data layer rewrite 或 speculative
performance refactor。

### 10. Project Control Default Decision

遇到「OpenKore 以前有這個功能，Current PA／Web 現在不知道怎麼接」時，預設答案不是
重新設計，而是：

```text
1. 查 OpenKore Last-Good
2. 查 OpenKore reference implementation
3. 確認原始 behavior / data contract
4. 對照 PA 已有能力
5. 找 FIRST_BROKEN_TRANSITION
6. 只補缺失 seam / glue
7. 正式執行仍由 PA / rAthena 完成
```

只有 OpenKore 沒有成熟方案，或 OpenKore 方案與 Current architecture 明確不相容，
才允許進入新的架構設計。

### 11. Short Form Rule

```text
OPENKORE_REFERENCE_POLICY:
OpenKore = reference implementation / last-good knowledge.
PA / SERVER_AGENT = production runtime authority.
Reproduce proven OpenKore behavior in PA.
Do not re-enable OpenKore runtime.
Do not reinvent a proven capability without evidence.
```

### 12. Operational Compliance Gate (MANDATORY)

For any workline involving an OpenKore-era capability, the worker MUST execute:

`OPENKORE_REFERENCE_GATE_V1.1`

defined at:

`docs/project-control/openkore-reference-gate.md`

before making source changes.

Gate now includes mature rAthena reference evaluation.

A statement such as "OpenKore was referenced" is not sufficient evidence.

Compliance requires:

- exact reference files/symbols
- Last-Good reconstruction
- OpenKore → PA behavior mapping
- mature rAthena reference check（如適用）
- `FIRST_BROKEN_TRANSITION`
- duplicate-engine check

The Gate is operational procedure.
`AGENTS.md` remains policy authority.

### OpenKore Reference Atlas integration

OpenKore-era capability work, including discussion, planning, dispatch,
debugging, implementation, refactor, migration, recovery and testing, must
first search
`docs/openkore-reference/reference-index.yml` and read only the relevant topic.
Then check Project Last-Good, locked OpenKore mature behavior, rAthena
authority, Current PA and `FIRST_BROKEN_TRANSITION`.

```text
OPENKORE_REFERENCE_ATLAS_TRIGGER = MANDATORY / BLOCKING
OPENKORE_RUNTIME_COUNT = 0
RATHENA_ATLAS_SEARCHED = YES / NO
OPENKORE_ATLAS_SEARCHED = YES / NO
AUTHORITATIVE_SOURCE_CHECKED = YES / NO
PROJECT_LAST_GOOD_CHECKED = YES / NO
REFERENCE_GAP = CONFIRMED / NOT_CONFIRMED
REFERENCE_IS_FLOOR_NOT_CEILING = YES
OPENKORE_REFERENCE_ATLAS != PRODUCT_SPEC
OPENKORE_REFERENCE_ATLAS != RUNTIME_AUTHORITY
FINAL_DESIGN_CENTER = PA / SERVER_AGENT
REUSE_CLASSIFICATIONS = REPRODUCE / ADAPT / IMPROVE / REJECT_LEGACY / NOT_APPLICABLE
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

OpenKore Atlas knowledge is a floor for mature behavior, retry, recovery and
edge-case coverage. PA may improve it when server authority and player-visible
equivalence are preserved. A deviation records `WHY_DEVIATE`,
`WHAT_IS_BETTER`, `SERVER_AUTHORITY_PRESERVED`, `REGRESSION_RISK` and
`RESULT_EQUIVALENT_OR_BETTER`.

### 12A. OPENKORE_REFERENCE_FIRST_HARD_GATE

```text
OPENKORE_REFERENCE_FIRST_HARD_GATE = MANDATORY / BLOCKING
VERSION = V1
```

任何涉及 OpenKore-era gameplay capability、Web gameplay control、Controller、
SERVER_AGENT、Persistent Agent、功能恢復、重構或新增能力的 workline，source edit
前必須完成 `OPENKORE_REFERENCE_GATE_V1.1`，並回報完整 reconstruction evidence。
缺少任一必要欄位時：

```text
OPENKORE_REFERENCE_GATE = FAIL
SOURCE_EDIT = PROHIBITED
```

強制順序：

```text
OpenKore Reference Atlas lookup
→ OpenKore mature behavior
→ Last-Good reconstruction
→ Current Ghost Island behavior
→ REPRODUCE / ADAPT / IMPROVE / REJECT_LEGACY / NOT_APPLICABLE mapping
→ GHOST_ISLAND_OPTIMIZATION_REVIEW
→ source edit
```

適用範圍包含 AUTO_FARM、Combat、Target、Loot、Survival、Recovery、Supply、
Fly Wing／Butterfly Wing、SaveMap／LockMap、Buy／Sell／Storage、Kafra、Navigation、
Routing、NPC、Quest、Skill、Equipment、Inventory、Weight、Death、Restart、Reconnect、
Party、Follow，以及控制或呈現上述能力的任何 Web button、API 或 controller action。

`PRE_IMPLEMENTATION_REUSE_GATE` 的 `BUG_FIX`、`MAINTENANCE`、`REFACTOR`、
`OPTIMIZATION` 或既有 implementation exemption，不豁免
`OPENKORE_REFERENCE_FIRST_HARD_GATE`。只要會影響 gameplay semantics、state
machine、authority、control、player-visible result 或 recovery，仍必須完成本
hard gate。純文件、純格式、純 CSS/layout 且不改變上述行為者，才可標記
`OPENKORE_REFERENCE_REQUIRED = NO`。

Worker 在 source edit 前必須回報：

```text
OPENKORE_REFERENCE_GATE =
FEATURE =
OPENKORE_CAPABILITY_EXISTS = YES / NO / UNKNOWN
OPENKORE_EXACT_REFERENCE_FILES =
OPENKORE_EXACT_SYMBOLS =
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
REFERENCE_DOSSIER =
```

每個主要行為必須明確分類：

```text
REPRODUCE = 保留 OpenKore 成熟 semantics
ADAPT = 保留 semantics，改由 PA / SERVER_AGENT → rAthena 執行
REJECT_LEGACY = 明確記錄 OpenKore 行為不適用的理由
```

`GHOST_ISLAND_OPTIMIZATION_REVIEW` 必須先回答不可破壞 invariant、PA authority
邊界、可移除的 client／process／file transport、必須保留的 recovery／retry／edge
cases，以及玩家可見結果是否與 OpenKore Last-Good 等價或更好。優化可以判定為
`NO_NOT_NEEDED`，不得為了填欄位而強制改動成熟行為。完成 mapping 前，
禁止以「比較簡單」、「比較乾淨」或「最小版本」作為跳過 reference 的理由。

Web 只能呈現 authoritative state、收集 intent、呼叫 controller、呈現 command／
runtime result。Web 不得自行建立 gameplay semantics。

若 OpenKore 與成熟 rAthena reference 有差異，或 reference 與目前 server
authority 發生衝突：

```text
OPENKORE_BEHAVIOR =
RATHENA_BEHAVIOR =
CURRENT_ARCHITECTURE_CONSTRAINT =
PLAYER_VALUE_IMPACT =
REFERENCE_CONFLICT_RESOLVED = NO
PROJECT_CONTROL_DECISION_REQUIRED = YES
```

Worker 不得自行選擇其中一方。若找不到 reference：

```text
OPENKORE_REFERENCE_GATE = BLOCKED
REFERENCE_NOT_FOUND = YES
SOURCE_EDIT = PROHIBITED
```

任何故意偏離 OpenKore Last-Good behavior 的設計，都必須取得 Project Control
approval，並記錄：OpenKore behavior、Proposed Ghost Island behavior、原因、玩家
價值、architecture gain、new risk 與 rollback path。

Supply 反例固定記錄為：

```text
ANTI_PATTERN_EXAMPLE = PA_SUPPLY_WALKING_REIMPLEMENTATION
```

Supply restoration 必須先重建：

```text
SUPPLY_LOW → RETURN_HOME → BUY → RETURN_FARM → RESUME
```

不得先修 PA walking route，再事後猜測 OpenKore semantics。

相關 workline final report 必須包含：

```text
OPENKORE_REFERENCE_REQUIRED = YES / NO
OPENKORE_REFERENCE_TRIGGERED = YES / NO
OPENKORE_REFERENCE_GATE = PASS / FAIL / NOT_APPLICABLE
OPENKORE_CAPABILITY_EXISTS = YES / NO / UNKNOWN
OPENKORE_REFERENCE_FILES =
OPENKORE_REFERENCE_SYMBOLS =
OPENKORE_CONFIG_KEYS =
OPENKORE_LAST_GOOD_BEHAVIOR =
CURRENT_GHOST_ISLAND_BEHAVIOR =
OPENKORE_BEHAVIOR_COMPARED = YES / NO
BEHAVIOR_MAPPING =
REFERENCE_CONFLICT = YES / NO
REFERENCE_CONFLICT_RESOLVED = YES / NO
SERVER_AUTHORITY_INVARIANTS_PRESERVED = YES / NO
OPENKORE_DEVIATION = YES / NO
GHOST_ISLAND_OPTIMIZATION_REVIEWED = YES / NO
OPTIMIZATION_APPLIED = YES / NO_NOT_NEEDED
OPTIMIZATION_REASON =
OPTIMIZATION_DIMENSIONS =
OPENKORE_LAST_GOOD_PLAYER_RESULT =
GHOST_ISLAND_CURRENT_PLAYER_RESULT =
EQUIVALENCE_EVIDENCE =
BETTER_DIMENSIONS =
REGRESSED_DIMENSIONS = NONE
UNPROVEN_DIMENSIONS =
RESULT_EQUIVALENT_OR_BETTER = YES / NO
PLAYER_FLOW_EQUIVALENCE = PASS / FAIL / NOT_TESTED
OPENKORE_CORE_ALIGNMENT_VETO = PASS / FAIL
CHANGE_APPROVED = YES / NO
CHANGE_REJECTED = YES / NO
WORKLINE_DONE = YES / NO
```

缺少上述欄位時，`WORKLINE_DONE = NO`。

### 12B. OPENKORE_CORE_ALIGNMENT_VETO

任何 `OPENKORE_REFERENCE_REQUIRED = YES` 的 workline，都必須在 source edit
前與 Project Control acceptance 時完成六問：

```text
OPENKORE_REFERENCE_TRIGGERED = YES
OPENKORE_BEHAVIOR_COMPARED = YES
SERVER_AUTHORITY_INVARIANTS_PRESERVED = YES
REFERENCE_CONFLICT_RESOLVED = YES
GHOST_ISLAND_OPTIMIZATION_REVIEWED = YES
RESULT_EQUIVALENT_OR_BETTER = YES
```

任一欄位為 `NO`、`FAIL`、`UNKNOWN` 或 `NOT_PROVEN` 時，固定結果為：

```text
CHANGE_APPROVED = NO
CHANGE_REJECTED = YES
IMPLEMENTATION_ACCEPTANCE = FAIL
PRODUCTION_DEPLOY = BLOCKED
WORKLINE_DONE = NO
```

`OPTIMIZATION_APPLIED = NO_NOT_NEEDED` 在 `GHOST_ISLAND_OPTIMIZATION_REVIEWED = YES`
時屬有效結果，不構成否決。`test pass`、`build pass`、`source pass`、較少程式碼、
較簡單實作或模型信心不得覆蓋否決結果。Project Control 必須自行核對 reference、
authority、objective equivalence 與玩家結果 evidence，不能只採用 Worker 自報。

Objective equivalence 必須逐項回報：

```text
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
```

`REGRESSED_DIMENSIONS` 不得為空值以外的內容。任何 regression 或 critical
dimension 未證明時，`RESULT_EQUIVALENT_OR_BETTER = NO`，並回到 Project Control
決策。第二次 acceptance 必須由 Project Control 獨立重做六問，不得沿用 Worker
結論。

同一 gameplay subsystem 若累計至少兩個 downstream blockers，Project Control
必須執行：

```text
UPSTREAM_ASSUMPTION_RECHECK = YES
DOWNSTREAM_BLOCKER_COUNT =
CURRENT_CONTRACT_REVALIDATED = YES / NO
OPENKORE_LAST_GOOD_RECHECKED = YES / NO
CONTINUE_CURRENT_DIRECTION = YES / NO
```

在 recheck 完成前不得進行第三個下游修補。Recheck 應分類目前實作為
`LEGITIMATE_ADAPTATION / REGRESSION / WRONG_REIMPLEMENTATION / HISTORICAL_WORKAROUND`。

Gate PASS 前只允許 read-only source/log/runtime/historical Git/OpenKore/rAthena
inspection、bounded diagnostic reproduction，以及不改變 gameplay semantics 的
isolated test-only instrumentation。禁止 gameplay source edit、state-machine
redesign、production deploy、runtime mutation、新 gameplay contract 或永久 route/
supply/combat/recovery implementation。

### 13. Mature rAthena Reference Policy

OpenKore 仍是 automation behavior 的主要成熟參考來源；成熟 rAthena
official／community implementation 是重要的 secondary reference，尤其適合
server-side behavior。對 PA 開發，若 rAthena ecosystem 已有成熟 server-side
實作，必須在重新設計前先研究。

Reference scope 包含：behavior、algorithm、state transitions、server-side API
usage、recovery logic、targeting rules、navigation logic、item／equipment
semantics、combat automation、supply automation、edge-case handling。

研究成熟方案 ≠ 直接安裝第三方插件。正式 Runtime Authority 不變：

```text
PA / SERVER_AGENT → rAthena
```

Reference reconstruction 優先考慮：

```text
A. OpenKore mature implementation
B. Mature rAthena official/community implementation
C. Project historical Last-Good / acceptance evidence
D. Current PA implementation
```

這不是「排名決定誰一定正確」。真正流程是 collect mature references → compare
proven behaviors → identify common semantics → map into PA architecture。若
OpenKore 與 rAthena implementation 有差異，不得自行選一邊，必須記錄：

```text
REFERENCE_CONFLICT = YES
OPENKORE_BEHAVIOR =
RATHENA_BEHAVIOR =
CURRENT_PA_CONSTRAINT =
```

再由 Project Control 決定。

License／Code Reuse 規則：允許研究 behavior、architecture、algorithm、state
machine、edge cases 與 data semantics；但直接複製第三方 source code 前必須確認
license。Mandatory：

```text
REFERENCE_LICENSE =
DIRECT_CODE_REUSE_ALLOWED = YES/NO/UNKNOWN
```

若 `LICENSE = UNKNOWN`，則 `DIRECT_CODE_REUSE_ALLOWED = NO`：可以研究行為，但不得
直接 copy source。OpenKore 亦同樣適用。

### 13A. Mature Capability Reuse First

所有 substantial implementation workline 在 SOURCE CHANGE 前必須完成
`MATURE_CAPABILITY_REUSE_FIRST` gate：先查 current project capability、historical
Last-Good、成熟 rAthena server-side capability、OpenKore mature capability 與
Project Control 指定 reference。成熟能力存在時，預設採 `REUSE / PORT / ADAPT`，
不得直接建立第二套核心 engine、planner、state machine、world data 或 recovery
logic。

```text
MATURE_CAPABILITY_REUSE_FIRST = YES
MATURE_REFERENCE_FIRST = REQUIRED
RESULT_EQUIVALENT_OR_BETTER_THAN_MATURE_REFERENCE = REQUIRED
CUSTOM_IMPLEMENTATION_APPROVAL_GATE = REQUIRED
CUSTOM_IMPLEMENTATION_ALLOWED = NO_UNTIL_PROJECT_CONTROL_APPROVES
NAVIGATION_ROUTE_ENGINE_COUNT = 1
PER_MAP_NAVIGATION_HARDCODE = FORBIDDEN
```

Navigation 必須使用 `OPENKORE_NAVIGATION_REUSE_FIRST = YES` 與
`OPENKORE_ROUTE_PARITY_REQUIRED = YES`。OpenKore 保持 runtime 0；
`RUNTIME_REUSE != CAPABILITY_REUSE`。完整 authority boundary、adapter seam、
custom planner migration status 與 adoption audit 見
`docs/architecture/local-hunting-hybrid-architecture.md`。

任何 dispatch 必須記錄：

```text
OPENKORE_EXISTING_CAPABILITY =
OPENKORE_REFERENCE =
OPENKORE_REUSE_SEAM =
CUSTOM_CODE_REQUIRED =
WHY =
```

若 `CUSTOM_IMPLEMENTATION_REQUIRED`，必須同時提供 reuse 不可行原因、架構衝突、
license 狀態、reference capability 缺口，並取得 Project Control 明確批准。

`MATURE_CAPABILITY_DELTA_GATE` 自動套用於新增／替換 capability、behavior、config
semantics、exposed mature-capability UI、exception/recovery 或 mature capability data
model 變更。`REUSE_GATE_INHERITED_FROM` 只有在下列三項均為 `YES` 時有效：

```text
SAME_CAPABILITY_SCOPE = YES
REFERENCE_COVERAGE_STILL_COMPLETE = YES
NO_NEW_CAPABILITY_SURFACE = YES
```

否則必須設定 `DELTA_REFERENCE_AUDIT_REQUIRED = YES`。Web、UI、presentation、
bug-fix、maintenance 或 `KNOWN_IMPLEMENTATION_TASK` 標籤不豁免 capability delta。
適用 workline source change 前必須依 `docs/pre-implementation-reuse-gate.md`
完成 mature reference matrix，且 `MATURE_CAPABILITY_LOSS = NONE`、
`RESULT_EQUIVALENT_OR_BETTER = PASS`；applicable 欄位含 `UNKNOWN` 時不得 PASS。

本節強化既有 `Single Runtime Policy`、`PC-DISPATCH-STANDARD`、
`LAST_GOOD → CURRENT → FIRST_BROKEN_TRANSITION`、Browser UI acceptance、
Git hygiene 與 OpenKore Exit 驗收規則；若文字與既有規則重複，保留原規則，本節只
引用與強化，不取代其中任何一條。

### 13B. RO Ecosystem Reuse First

任何 RO-domain substantial implementation 在 custom implementation 前，必須完成
`ECOSYSTEM_REFERENCE_SWEEP`。適用範圍包含 Navigation、Combat、NPC、Quest、Items、
Skills、Pathfinding、Warp、Kafra、AI、server automation、character lifecycle 與
map/world data。掃描必須先讀既有 project research、historical accepted implementation
與 reference atlas，再依適用性檢查 rAthena source、official docs/wiki、Forum、Issues/PR/
Discussions、mature scripts/config/DB patterns，以及 OpenKore source、tables/data、docs/wiki
與 community-established behavior。

```text
RO_ECOSYSTEM_REUSE_FIRST = YES
REFERENCE_SWEEP_REQUIRED = YES
ECOSYSTEM_REFERENCE_SWEEP_COMPLETED = YES / NO
MATURE_SOLUTION_FOUND = YES / NO / PARTIAL
REUSE_CLASSIFICATION = DIRECT_REUSE / PORT / ADAPTER / INTEGRATION_ONLY /
                        PROJECT_POLICY / CUSTOM_REQUIRED
CUSTOM_IMPLEMENTATION_APPROVED = YES / NO
```

來源層級為 `canonical source/runtime evidence`、`official maintained docs/data`、
`maintainer PR/Issue/technical discussion`、`rAthena Forum/OpenKore community proven
patterns`、`generic external articles`。低層級來源只能發現候選；採用前必須回驗目前
source、runtime authority、Project Last-Good 與 license。`FORUM_POST != CANONICAL_TRUTH`，
但找到成熟解法時不得忽略後自行建立簡化版本，必須追到可 reuse 的 implementation seam。

施工前 worker 必須回報：

```text
PROJECT_EXISTING_CAPABILITY =
RATHENA_SOURCE_CAPABILITY =
RATHENA_DOCS_CAPABILITY =
RATHENA_FORUM_CAPABILITY =
RATHENA_ISSUE_PR_CAPABILITY =
OPENKORE_SOURCE_CAPABILITY =
OPENKORE_DATA_CAPABILITY =
OPENKORE_COMMUNITY_CAPABILITY =
REFERENCE_SOURCE =
REUSE_SEAM =
```

若 `ECOSYSTEM_REFERENCE_SWEEP_COMPLETED != YES`，`IMPLEMENTATION_AUTHORIZATION = NO`。
若既有 research checkpoint 新鮮可用，worker 必須沿用其 provenance；只有 stale、version
mismatch 或缺少必要 evidence 時才能做 targeted incremental research，不得重跑同一問題的
全量搜尋。Navigation 額外要求 rAthena world/map/warp/NPC authority、已知 routing pattern、
OpenKore `MapRoute`/`CalcMapRoute`/`Route` 與成熟 map/portal/NPC/weight/recovery data 一起
納入 reuse evaluation。此規則補充 `MATURE_CAPABILITY_REUSE_FIRST`，不取代 Quest Flow
First、兩個 Reference Atlas、Single Runtime、Synthetic First、nearest legal state、
Browser acceptance 與 Git hygiene。

## PLAYER WEB RESPONSE EXPERIENCE POLICY 鐵律

Policy name：`PLAYER_WEB_RESPONSE_EXPERIENCE_POLICY`

Version：`PLAYER_WEB_RESPONSE_EXPERIENCE_POLICY_V1.2`

All Player Web development and performance work MUST follow:

```text
PLAYER_WEB_RESPONSE_EXPERIENCE_POLICY
defined at:
docs/project-control/player-web-response-experience-policy.md
```

尤其涉及下列項目時必須遵守：

```text
polling
SSE
WebSocket
API refresh
route loading
lazy loading
minimap
combat log
inventory
farm stats
quest
RUM
dashboard projection
```

This policy is operational / design reference.
`AGENTS.md` remains policy authority.
The full policy is NOT copied into `AGENTS.md`.

Short form:

```text
PLAYER_VALUE_FIRST_DATA_PRINCIPLE:

Before fetching or delivering Web data, ask:

Need?
How fast?
Changed?
Visible?

If the player does not currently need or see it,
or the authoritative revision has not changed,
do not maintain unnecessary high-frequency delivery.

PA Runtime remains independent of Web presence.
```

```text
PLAYER_WEB_RESPONSE_EXPERIENCE_POLICY:
Load only what the current route needs.
Subscribe only to currently relevant domains.
Prioritize visible data.
Throttle or stop hidden/inactive delivery.
Stop high-frequency Web delivery when no Browser session exists.
Keep PA runtime independent.
Initial authoritative snapshot first.
Then use revision/delta/event cursor.
No unchanged full-payload refresh.
No Everything Snapshot.
Measure real player latency before optimizing.
```

V1.2 authoritative delivery direction, concise reference only:

```text
PA_AUTHORITATIVE_WEB_DELIVERY_DIRECTION:

For Player Web data flows:

PA/rAthena authority
→ domain projection
→ interest-driven delivery
→ revision/delta
→ Browser.

Produce once.
Read once where practical.
Deliver only on current interest.
Send only changed data.
Keep hot paths small.
Do not let Web presence control PA runtime.
```

此 policy 必須相容 `PC-DISPATCH-STANDARD`、`WORKLINE_DISPATCH_TEMPLATE_V1.2`、
`WORKLINE_CONTINUATION_TEMPLATE_V1.2`、`OPENKORE_REFERENCE_POLICY`、
`OPENKORE_REFERENCE_GATE_V1.1`、`Single Runtime Policy` 與 Browser Acceptance
Policy，且不得重定義 PA Runtime Authority。

## OpenKore Exit 驗收鐵律

- Source presence 不等於能力完成。
- 每項 OpenKore 能力依序使用 `SOURCE_ONLY` → `DIAGNOSTIC_PASS` → `PLAYER_FLOW_PASS` → `OPENKORE_REMOVED`。
- 最終完成度以 Player-flow First 驗收。
- 沒有 runtime evidence 不得標記 `READY`。
- 完整狀態以 `docs/openkore-exit-source-of-truth.md` 為唯一 Source of Truth。

修改 Quest、NPC、補給、回程、掛機地圖或其他自動導航前，必須讀取 `.agents/skills/navigation-stall-safety/SKILL.md`。所有導航步驟都要以地圖變更、座標變更、有效 NPC 對話或任務階段推進判定進度；相同動作不得高頻重送，重試不得刷新自身停滯計時，並必須具備有限重試、已查核替代路線及恢復一般自動操作的終止狀態。

## rAthena Reference Atlas Lookup Gate

涉及 Quest、NPC、dialogue、OnTouch、hidden NPC、Warp、Map、Mapflag、
Navigation、Save Point、Respawn、Job Change、Item、Inventory、Shop、
Buy／Sell、Kafra、Storage、Combat、Monster／Spawn、Loot／Drop、Skill、
Status Effect、EXP／Job EXP、Party、Guild、Instance、Event／Timer、Script
Engine、Client／CLIF gameplay、Teleport、Fly Wing、Butterfly Wing 或其他
server-authoritative RO gameplay behavior 的 discussion、planning、dispatch、
debugging、implementation、refactor、migration、recovery 與 testing，必須
先使用：

`docs/rathena-reference/reference-index.yml`

```text
RATHENA_REFERENCE_ATLAS_TRIGGER = MANDATORY / BLOCKING
RATHENA_REFERENCE_ATLAS != SOURCE_OF_TRUTH
```

固定 lookup 順序：

```text
RATHENA_REFERENCE_ATLAS_LOOKUP
→ relevant Atlas topic / lookup-playbook
→ exact authoritative rAthena source path
→ Project Last-Good / OpenKore reference（如適用）
→ FIRST_BROKEN_TRANSITION
→ implementation
```

Atlas 是 index／lookup aid，不是 gameplay authority。若 Atlas 與 current
canonical rAthena source、project-specific server rule 或 authoritative config
衝突，記錄 `REFERENCE_ATLAS_STALE_OR_CONFLICTING = YES`，以 current
authoritative source 為準並安排 Atlas correction。只有在
`ATLAS_SEARCHED = YES`、`AUTHORITATIVE_SOURCE_CHECKED = YES`、
`PROJECT_LAST_GOOD_CHECKED = YES` 後，才能回報
`REFERENCE_GAP = CONFIRMED` 並提出 `NEW_IMPLEMENTATION`。

預設只讀 reference-index、相關 topic 與必要的 lookup-playbook，不要求
Worker 閱讀完整 Atlas。F 為 `REFERENCE_MINING_OWNER`，可處於
`ON_DEMAND`、`PROACTIVE_RESEARCH`、`REFERENCE_GAP` 或 `CLOSED_TOPIC`；
F 只做 research、indexing、source mapping、provenance 與 conflict review，
不直接修改 gameplay。優先類別為 P0 debugging／logging／packet／crash、
navigation／warp／portal／pathfinding、monster AI／combat／target／retarget、
item／loot／inventory／storage／weight；P1 reconnect／lifecycle、NPC／Quest、
performance／SQL／timers、client compatibility／PACKETVER；P2 extension、
security 與 exploit mitigation。具體排序以
`docs/reference-mining/research-backlog.yml` 為準。

## Quest Flow First Hard Gate

凡涉及 Quest、任務、NPC、OnTouch、hidden NPC、dialogue、quest state、
Quest Runtime、novice／onboarding、Eden、伊甸園、一轉、二轉、轉職、
event quest、quest navigation、quest recovery 或 automatic questing 的
discussion、planning、dispatch、debugging、implementation、refactor、
migration、recovery 與 testing，必須先讀取：

`.agents/skills/quest-flow-first/SKILL.md`

固定順序：

```text
RATHENA_REFERENCE_ATLAS_LOOKUP
→ QUEST_FLOW_FIRST_HARD_GATE（如 Quest）
→ OPENKORE_REFERENCE_ATLAS_LOOKUP（如適用）
→ OPENKORE_REFERENCE_GATE（如適用）
→ PROJECT_LAST_GOOD_MAPPING
→ CURRENT_QUEST_RUNTIME_MAPPING（如 Quest）
→ CURRENT_RUNTIME_MAPPING（非 Quest）
→ FIRST_BROKEN_TRANSITION
→ REPRODUCE / ADAPT / IMPROVE / REJECT_LEGACY / NOT_APPLICABLE
→ implementation
```

Quest work 的完整順序為：

```text
RATHENA_REFERENCE_ATLAS_LOOKUP
→ QUEST_FLOW_FIRST_HARD_GATE
→ OPENKORE_REFERENCE_ATLAS_LOOKUP（如適用）
→ OPENKORE_REFERENCE_GATE（如適用）
→ PROJECT_LAST_GOOD_MAPPING
→ CURRENT_QUEST_RUNTIME_MAPPING
→ FIRST_BROKEN_TRANSITION
→ implementation
```

在正常玩家流程、rAthena server authority、互動類型、歷史 Last-Good、
現有 Quest Runtime 與 `FIRST_BROKEN_TRANSITION` 尚未證明前，
`GAMEPLAY_SEMANTIC_IMPLEMENTATION = BLOCKED`。此規則同時適用 Project
Control 與 Worker，且不把 Player Web 手動控制當成 Quest Runtime 執行前提。

每個 Quest dossier 必須標明：

```text
WEB_CONTROL_REQUIRED = YES / NO
SERVER_AGENT_AUTONOMY_ALLOWED = YES / NO
```

`WEB_CONTROL_REQUIRED = NO` 時，通過 Quest Flow First、server authority 與
automation contract 後，SERVER_AGENT 可執行合法的內部導航、搜尋、戰鬥、
對話與恢復步驟。兩個 downstream blocker 後，第三個 gameplay-semantic fix
前必須執行 upstream assumption recheck。

## 新工作讀取順序

開始任何修改前，依序讀取：

1. `AGENTS.md`：規則、修改邊界、驗證與提交流程。
2. `docs/CURRENT_STATUS.md`：目前已完成、進行中、下一步與本次驗證快照。
3. `docs/ARCHITECTURE.md`：實際檔案分層、資料流與責任邊界。
4. `docs/GAME_DESIGN.md`：玩家循環、RO／OpenKore 規則與產品取捨。
5. `docs/TODO.md`：可接手的優先工作與完成條件。
6. 與任務直接相關的程式、測試及來源稽核文件。

不要先讀完整 Git 歷史或整個 `node_modules`。需要追溯決策時，再查 `docs/DEVELOPMENT_REVIEW_LOG.md`、`docs/RO_RESTORATION_PROGRESS.md` 與指定提交。

## Source of truth

| 主題 | 唯一依據 |
| --- | --- |
| rAthena／OpenKore 固定版本 | `game/ro/source.ts`、`docs/RO_SOURCE_BASELINE.md` |
| RO 內容資料 | `game/ro/content/` 與各資料的 `SourceTrace`，來源稽核見 `docs/*_SOURCE_AUDIT.md` |
| 世界、移動、戰鬥、掉落、拾取與成長 | rAthena Renewal、MariaDB 與 OpenKore 實際狀態；鎖定來源見 `game/ro/source.ts` |
| RO 公式與共用型別 | `game/ro/formulas/renewal.ts`、`game/content/ro-stats.ts` |
| 帳號、角色、工作階段與狀態 API | `ops/ro-stack/dashboard.mjs`、rAthena MariaDB |
| 持久化結構 | rAthena MariaDB；Dashboard 的 Web 工作階段與偏好也由同一 MariaDB 服務保存 |
| 玩家頁與命令提交 | `ops/ro-stack/dashboard/index.html`、`app.js`、`styles.css`、`dashboard.mjs` |
| 自動操作與即時狀態 | `ops/ro-stack/openkore-instance.ps1`、`ops/ro-stack/openkore-plugins/status-export/`、每角色 OpenKore 程序 |
| 封存網站原型 | `app/`、`game/server/`、`db/`、`archive/legacy-vinext-demo/`；不得作為現行入口或正式角色狀態來源 |
| 官方素材與產出資料 | `public/ro/`、`scripts/`、`THIRD_PARTY_NOTICES.md` |
| 接手狀態與優先序 | `docs/CURRENT_STATUS.md`、`docs/TODO.md` |
| Project Roadmap（長期方向、未來工作、授權狀態） | `docs/PROJECT_ROADMAP.md`、`docs/roadmap/` |

文件可解釋程式，但不取代程式、測試或鎖定來源。現況文件若與程式不一致，先修正文件或建立稽核項目，再宣稱完成。

## RO 來源真實性

每項新增或修改的規則，依序查核鎖定版 rAthena `src`、`db/re`、`npc`、`doc`，再查鎖定版 OpenKore、Gravity 官方資料與可重現的 RO 遊戲內行為。每筆正式資料保存來源網址或本機來源、版本、日期、原始效果與實作對照。

凡涉及 RO UI、音效、Sprite、按鈕、視窗或 Icon 的原廠還原工作，必須先完整讀取 `.agents/skills/ro-original-ui/SKILL.md`，再依該 Skill 的來源、驗收與 provenance 規則施工。

凡涉及 RO 道具、裝備、技能、怪物、NPC、地圖、紙娃娃、繁中名稱或原廠圖片，或使用者要求「原廠」、「正確圖片」、「原廠圖示」、「繁中名稱」、「RO原版」時，必須先完整讀取 `.agents/skills/ro-asset-index/SKILL.md`，並透過集中索引與共用 resolver 取得名稱及資產。

**「原廠還原任務中，未經來源驗證的視覺資產，視同不存在。」**

來源資料至少保留以下欄位，欄位名稱可依資料格式映射：

```text
sourceGame: rAthena Renewal | OpenKore | Gravity RO
sourceUrl
sourceVersion
verifiedAt
sourceStatus: verified | inferred | user-approved
implementationNotes
```

資料不足時，正式內容保留 `【資料不足，無法確認】`，不把推導值寫成原作規則。需要調整數值時，記錄證據、假設與推導，並標記 `待使用者核准`。介面與文件清楚區分 `原作可確認`、`分析推導`、`使用者核准`。

新增職業、技能、物品、地圖、NPC、任務、掉落、轉職或掛機行為前，先查核來源是否已有原生能力，再決定重用或補接。來源與現行規格衝突時，先停下該項目並建立稽核紀錄。

## 修改範圍

- 現行玩家流程優先修改 `ops/ro-stack/dashboard*`、OpenKore bridge 與 rAthena 原生資料；只有實際需要時才新增模組。
- `ops/ro-stack/dashboard/` 負責畫面、輸入與呈現，`dashboard.mjs` 驗證工作階段、角色擁有權與命令。
- `app/`、`game/server/`、`db/` 與 Vinext 相關檔案屬封存原型；除封存維護任務外不得接回現行流程。
- 內容資料、模擬狀態、API、資料庫與 UI 依 `docs/ARCHITECTURE.md` 的依賴方向工作。
- 不在文件整理任務中改寫遊戲功能、替換來源資料或刪除歷史稽核證據。
- `.next/`、`.vinext/`、`.wrangler/`、`dist/`、`.local/`、`tmp/` 與 `node_modules/` 是產出或本機狀態；除非任務明確要求，不加入提交。
- 變更行為時同步更新 `docs/CURRENT_STATUS.md`、`docs/TODO.md` 或對應來源稽核；純文件整理不重寫程式。

## 測試 Fixture 與開發驗證鐵律

所有工作線（A/B/C/D/E/G）在開發測試時，必須遵守 `docs/testing-fixture-policy.md`。

固定原則：

```text
SETUP / PROVISION
→ EXECUTE
→ ASSERT
→ CLEANUP
```

1. 在 `DEV_ISOLATED` 或明確 test-only fixture 中，可以合理使用測試 DB 修改、GM／管理指令、角色能力調整、裝備與補給、傳送、生成測試怪、allowlist 與 fixture provisioning，以快速建立穩定、可重現的前置條件。
2. 不得為了「測試純粹」而讓無關條件反覆阻塞，例如角色太弱一直死亡、位置離目標太遠、附近隨機沒有怪、舊 ownership residue 沒清乾淨等。
3. 每輪測試都要先界定 `TEST_OBJECTIVE / TEST_BOUNDARY / SETUP_ALLOWED / SETUP_FORBIDDEN / PASS_EVIDENCE / CLEANUP`。
4. 前置條件可以人工建立，但本輪核心被測行為必須由真正系統執行；不得用 SQL、GM 指令或 mock 直接偽造 PASS。
5. PASS 必須有 authority / runtime evidence；command 回傳成功本身不等於功能成功。
6. FLOW fixture 與 BALANCE fixture 必須分開。流程驗證可以合理偏安全，避免平衡噪音阻塞功能測試。
7. 重要 fixture 優先做成 provisioning/reset script 或 manifest，避免依賴人工記憶。
8. Production 不適用 test shortcut。除非有明確正式操作批准，測試必須維持 `production_process_modified=0 / production_db_mutation=0 / production_player_modified=0`。

遇到 blocker 時，固定依序排查：

```text
Fixture 問題
→ Harness 問題
→ Observation 問題
→ 真正 Runtime / Product Bug
```

詳細規定以 `docs/testing-fixture-policy.md` 為準。


## 驗證流程

依變更範圍執行最小充分檢查：

```text
git status --short --branch
npm test
npm run lint
npm run test:active-web-entrypoint
git diff --check
```

改動玩家流程、API、公開版本或來源規則時，再執行對應的 Dashboard `npm run test:*`，並以本機 8788 與當次公開 HTTPS 入口驗證同一流程。`npm run build`、`npm run qa:ui` 與 `npm run test:release` 已隨 Vinext 原型停用，執行時會回覆 `LEGACY_WEB_ARCHIVED`。單元測試或一次人工瀏覽不足以代表公開版本完成。

文件只變更時至少執行 `git diff --check`，並核對連結、命令、版本、提交 SHA 與程式現況。

## 公開版本發布閘門

舊 Vinext 的 `npm run test:release` 已停用。新的 Dashboard 綜合發布指令尚未建立，因此目前不得宣稱任何新版本已通過完整發布門檻。發布紀錄仍須涵蓋：

1. 領域規則與回歸測試。
2. 5,000 張地圖結果壓力測試。
3. 1,000 組逐殺獎勵守恆測試。
4. 單一帳號 1,000 張地圖加速養成測試。
5. 手機寬度介面、起始流程、實際戰鬥、擊殺經驗、掉落入帳與瀏覽器錯誤檢查。
6. 靜態檢查、Dashboard 啟動與入口唯一性檢查。
7. 公開後重跑相同玩家流程的冒煙測試。

在新的綜合發布指令完成前，逐項執行並保存上述證據。任一項目缺失或失敗時，版本狀態標記為 `未通過發布門檻`。部署完成與產品完成度分開記錄，產品評估仍需依版本檢討與實際遊玩證據。

## 提交流程

1. 先確認工作樹與基準分支，保留使用者既有修改。
2. 檢查 `git diff`，確認每個檔案都屬於目前任務。
3. 依上表執行必要測試並記錄結果。
4. 使用一個清楚的原子提交描述單一目的；提交前不納入產出目錄或秘密。
5. 若需要推送，先 `git fetch origin main`、檢查分歧、`git rebase origin/main`，再推送並回報最終 SHA。

沒有明確提交或推送要求時，完成檢查後保留工作樹變更，讓使用者先審閱。

## 新 Work／Codex 啟動指令

將以下文字貼到新的工作：

```text
請先讀取 AGENTS.md、docs/CURRENT_STATUS.md、docs/ARCHITECTURE.md、docs/GAME_DESIGN.md、docs/TODO.md，再檢查 git status。只處理 TODO 中指定的一個範圍，先列出相關 source of truth、完成條件與預計修改檔案；完成後執行必要測試、更新現況文件，並回報實際修改與未完成項目。不要依賴舊對話，也不要改動任務範圍外的遊戲功能。
```

## 專案 Skills

按需載入 `.agents/skills/` 下的短流程 Skill，避免每次重新探索整個 repository：

- `project-handoff`：新 Work／Codex 接手時建立最小必要上下文。
- `implement-feature`：依最小修改範圍實作、測試並更新現況。
- `debug-bug`：依錯誤證據定位、最小修正、回歸測試並記錄結果。
- `nearest-valid-test-state`：大型測試先定義被測功能與合法起點，優先使用 fixture／checkpoint，限制高成本前置與 Full E2E。
- `navigation-stall-safety`：任務、NPC、補給與掛機導航必須有可觀察進度、有限重試、替代路線及安全終止。
- `ro-original-ui`：RO 原廠 UI／UX、視覺資產、音效、Sprite、按鈕、視窗與 Icon 還原時，執行 Original Asset First、來源驗證、視覺比較與 provenance 登錄。
- `ro-asset-index`：RO 道具、裝備、技能、怪物、NPC、地圖、紙娃娃、繁中名稱與原廠內容圖片的集中索引、來源驗證及 Web resolver。

使用方式可直接在任務中指定 `$project-handoff`、`$implement-feature`、`$debug-bug` 或 `$ro-original-ui`，也可由符合描述的工作按需觸發。RO 原廠還原相關工作強制讀取 `ro-original-ui`。這些 Skill 不取代本文件的驗證、來源與修改邊界規則。


## Execution Budget / No-Progress Circuit Breaker

- equivalent discovery attempts <= 3 -> 3rd attempt with no new evidence: `DISCOVERY_STALLED`, STOP
- no new evidence for 5 min on same blocker -> STOP
- single blocker investigation <= 15 min -> then checkpoint/stop, report one of: `ROOT_CAUSE_CONFIRMED` / `NEEDS_MODEL_ESCALATION` / `NEEDS_PROJECT_CONTROL_DECISION` / `INSUFFICIENT_EVIDENCE`
- discovery tool calls (grep/glob/find/read-for-location/git-archaeology) <= 10 per blocker -> checkpoint: `NEW_EVIDENCE_FOUND YES/NO`
- repeated-search loop self-detection: 3 consecutive equivalent intent -> `SEARCH_LOOP_DETECTED`, STOP
- silent/opaque work >= 5 min without observable progress -> STOP; all shell commands must have bounded timeout
- stuck -> halt unsafe or repeated attempts, preserve evidence and seek new bounded evidence in place; return to Project Control only on `PC_STOP_*`, without scope expansion or invalid acceptance shortcuts

Complete definitions: [RO Automation Product Constitution](docs/RO_AUTOMATION_PRODUCT_CONSTITUTION.md#execution-budget--no-progress-circuit-breaker)

## Context Budget / Routing Report 鐵律

### 任務開始前強制 Routing 驗證

所有 repo 任務開始前，Agent 必須完成：

1. 讀 `terminal-arpg/WORKSPACE_INDEX.md`
2. 解析 WORKLINE → 確認 `ACTIVE_WORKTREE`
3. `cd` 到 `ACTIVE_WORKTREE`
4. 驗證 `git branch --show-current` 與 `git rev-parse HEAD`

回報以下格式後才可開始工作：

```text
WORKSPACE_ROOT:   <absolute path>
BRANCH:           <branch name>
HEAD:             <commit SHA>
ROUTING_MATCH:    YES / NO
```

若 `ROUTING_MATCH=NO`：立即 `STOP → ROUTING_STALE`。禁止自行全域搜尋替代 worktree。

---

### 固定任務開頭格式

每份核心工作指令建議包含：

```text
WORKLINE:
WORKSPACE:
EXPECTED_BRANCH:
EXPECTED_HEAD_OR_PARENT:
SOURCE_OF_TRUTH:
TASK_TYPE:
```

---

### 搜尋範圍鐵律

進入 `ACTIVE_WORKTREE` 後，所有 grep／glob／read／git／edit／build／test 預設只能在該 worktree 內執行。

**嚴格禁止（除非任務明確授權 cross-worktree provenance lookup）：**

- 從 `C:\` 全域搜尋
- 從 project root 無界 `grep`
- 掃描 sibling `.tmp-*` worktrees
- `Get-ChildItem -Recurse` 全專案
- `glob **/*` 全專案
- 大量無限制 `Get-Content`

一個任務預設最多：

```text
1 個 ACTIVE_WORKTREE
+ 少量明確 Source of Truth 文件
```

---

### 跨 Worktree 搜尋例外規則

如需跨 worktree 搜尋，必須先聲明：

```text
WHY_CROSS_WORKTREE_SEARCH_REQUIRED: <原因>
```

未聲明不得執行。

---

### Bounded Tool 推薦模式

```text
read exact file/range
grep exact pattern
Select-Object -First N
git diff --stat
git diff --name-only
git status --porcelain --untracked-files=no
```

所有可能卡住的 shell 命令必須設定 bounded timeout。禁止無限等待。

---

### 異常門檻

以下任一條件成立，Agent 必須解釋原因、不得默默擴張；若非任務必要，立即 `STOP / 收斂搜尋範圍`：

- `TOP_LEVEL_SEARCH_PATH_COUNT > 3`
- `CROSS_WORKTREE_SEARCH_PERFORMED = YES`
- `PROJECT_ROOT_SEARCH_PERFORMED = YES`
- `UNBOUNDED_RECURSIVE_SEARCH_PERFORMED = YES`

---

### Conversation Budget（對話預算）

一個 Kilo 對話只處理一個 atomic goal。

當下列任一情況發生，執行 `HANDOFF → NEW CONVERSATION`：

- milestone 完成
- blocker 已定位
- commit 完成
- context 明顯膨脹
- provider 出現 context／channel／400 類問題

同一對話禁止長期混入：Git archaeology、UI、PA、NPC、Dashboard、deployment、不同 workline。

---

### 固定任務結尾 CONTEXT_REPORT 模板

所有 repo 任務最後必須回報：

```text
【CONTEXT_REPORT】

WORKLINE:
WORKSPACE_ROOT:
BRANCH:
HEAD:
WORKSPACE_ROUTING_MATCH:          YES / NO

INDEXED_SEARCHED_PATHS:
- <exact path 1>
- <exact path 2>
TOP_LEVEL_SEARCH_PATH_COUNT:      <number>

CROSS_WORKTREE_SEARCH_PERFORMED:  YES / NO
PROJECT_ROOT_SEARCH_PERFORMED:    YES / NO
C_DRIVE_SEARCH_PERFORMED:         YES / NO
UNBOUNDED_RECURSIVE_SEARCH_PERFORMED: YES / NO

LARGE_OUTPUT_COMMAND_USED:        YES / NO
If YES:
  COMMAND:
  WHY_REQUIRED:

SOURCE_OF_TRUTH_FILES_READ:
- <file 1>

CONTEXT_BUDGET_VIOLATION:         YES / NO
If YES:
  WHY:
  MITIGATION:
```
