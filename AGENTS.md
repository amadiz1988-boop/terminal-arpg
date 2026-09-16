# 鬼島傳說工作規則

本文件是每個 Work／Codex 工作的第一份上下文。專案目前以 `ops/ro-stack/dashboard.mjs` 提供的 8788 Dashboard 為唯一玩家入口，rAthena Renewal、OpenKore 與 MariaDB 為現行服務。Vinext 瀏覽器 demo 與 D1 API 原型只保留為封存程式碼，接手時依 `docs/CURRENT_STATUS.md` 判斷實際執行環境。

執行 substantial Repository 工作前，先依 `.agents/skills/task-model-router/SKILL.md` 判斷建議模型、推理強度與速度，並在施工前提醒使用者。該 Skill 只負責建議，不得改變任務 scope，也不得自行宣稱已切換模型。

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

**Kilo 日常 workspace**：不應以 `C:\` 或整個 project root 開啟。應直接開 ACTIVE_WORKTREE（例如 Workline A → `.tmp-server-agent-no-client-controller-v1`，Workline C → `terminal-arpg-phase4a-canonical`）。

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

## Player-flow First 測試鐵律

1. 功能驗收優先使用真實玩家正常會採取的行為流程。
2. 設計測試前，先回答三個問題：玩家正常會怎麼做？正式遊玩時的完整行為鏈是什麼？這次測試是否覆蓋該玩家流程？
3. DB provisioning、GM／admin command、teleport、heal、item injection、deterministic monster spawn、固定座標與 `test-only allowlist` 可用於建立 fixture、加速測試、diagnostic test 與問題重現。人工化診斷結果不得直接作為完整功能驗收 PASS。
4. 功能最終 PASS 必須由 Player-flow test 完成。
5. 玩家會走路、使用蒼蠅翅膀、回城、補給、使用 Kafra、找 NPC、換地圖、找怪、戰鬥、撿物或死亡後恢復時，主要驗收優先覆蓋同一條真實行為鏈。
6. Diagnostic test 可以高度人工化，只用於定位底層問題，不能取代 Player-flow acceptance。

## OpenKore Exit 驗收鐵律

- Source presence 不等於能力完成。
- 每項 OpenKore 能力依序使用 `SOURCE_ONLY` → `DIAGNOSTIC_PASS` → `PLAYER_FLOW_PASS` → `OPENKORE_REMOVED`。
- 最終完成度以 Player-flow First 驗收。
- 沒有 runtime evidence 不得標記 `READY`。
- 完整狀態以 `docs/openkore-exit-source-of-truth.md` 為唯一 Source of Truth。

修改 Quest、NPC、補給、回程、掛機地圖或其他自動導航前，必須讀取 `.agents/skills/navigation-stall-safety/SKILL.md`。所有導航步驟都要以地圖變更、座標變更、有效 NPC 對話或任務階段推進判定進度；相同動作不得高頻重送，重試不得刷新自身停滯計時，並必須具備有限重試、已查核替代路線及恢復一般自動操作的終止狀態。

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
- stuck -> return evidence to Project Control, do not self-expand scope or attempt invalid acceptance shortcut

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
