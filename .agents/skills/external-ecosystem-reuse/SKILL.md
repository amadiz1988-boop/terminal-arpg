---
name: external-ecosystem-reuse
description: 在 terminal-arpg 的 A、B、C 或 Future Life/Social 新需求需要外部元件、rAthena primitive、OpenKore 行為參考或技術選型時，先查持久化 registry，執行 freshness 與 license gate，僅在必要時做增量研究並維護研究紀錄。研究評估專用，不負責導入 dependency 或修改 production code。
---

# External Ecosystem Reuse

使用此 Skill 時，先讀：

- `ops/research/external-reuse-registry.json`：機器可讀的唯一候選 registry。
- `docs/external-ecosystem-reuse-audit.md`：人類可讀的基線、理由、授權與工作線對照。

預設模式固定為 `INCREMENTAL_RESEARCH_ONLY`。不得重新執行全量掃描。

## 固定流程

1. 從 repository root 執行：

   ```powershell
   node .agents/skills/external-ecosystem-reuse/scripts/check-registry.mjs "<需求>"
   ```

2. 先檢查匹配的 rAthena native primitive，再檢查其餘候選。
3. 對匹配結果執行 freshness 與 license gate。
4. 條目新鮮時，直接 reuse prior research。
5. 條目過期時，只驗證受影響的 version、license、maintainer、activity、security 與 integration assumption。
6. 沒有匹配時，只對該需求做 targeted new research。
7. 準備導入 dependency 時，以 `--intent adopt` 強制 fresh verification。
8. 增量研究完成後，更新 registry；只有摘要或結論改變時才同步更新 audit 文件。

流程狀態：

```text
NEW_REQUIREMENT
→ SEARCH_LOCAL_REGISTRY
→ NATIVE_PRIMITIVE_FIRST
→ MATCH_FOUND
  → FRESH: REUSE_PRIOR_RESULT
  → STALE: INCREMENTAL_VERIFY
→ NO_MATCH: TARGETED_NEW_RESEARCH
→ LICENSE_GATE
→ REUSE_DECISION
→ UPDATE_REGISTRY_WHEN_RESEARCH_CHANGED
```

不得因需求相似而重新掃描 rAthena forum、OpenKore forum、GitHub 全站、Hercules/HPM 全站或 Generic OSS 全量列表。

## Native Primitive First

遊戲功能先查 rAthena entry。已存在 `NATIVE_PRIMITIVE_EXISTS` 或 `WRAPPER_ONLY_NEEDED` 時：

- 優先直接調用 native primitive。
- 只新增 wrapper、typed action、precondition、ownership 或 orchestration。
- 不建立平行的 movement、pathfinding、party、guild、friend、storage、shop、NPC、skill、quest、respawn、item-use 或 save 系統。

rAthena/MariaDB 保持 authoritative state；Dashboard 與 projection 不得模擬權威寫入。

## Freshness Policy

| 類型 | Freshness |
|---|---|
| Stable foundational tool / rAthena native primitive | 6 至 12 個月；helper 採 12 個月上限 |
| Active OSS / OpenKore / Hercules / HPM | 3 至 6 個月；helper 採 6 個月上限 |
| Before dependency adoption | 每次立即 fresh verify |
| REJECT 且拒絕原因未改變 | 預設不重查 |
| Registry missing | 立即做 targeted research |
| User explicitly requests refresh | 立即做 targeted refresh |

架構需求、version、license、maintainer 或 rejection reason 改變時，只刷新相關條目。

## License Gate

License gate 必須先於技術建議：

- `Unknown`：最高只能 `REFERENCE_ONLY`。
- License incompatible：不得輸出 `REUSE`。
- GPL/AGPL/MPL：明確記錄 integration implication、linking/derivative boundary 與 distribution obligation。
- Forum code：未取得明確 license 前禁止複製。
- 技術品質不得覆蓋授權限制。

## Reuse Decision

每次固定輸出：

```text
decision: REUSE | ADOPT_PATTERN | REFERENCE_ONLY | REJECT
rating: A | B | C | D
reason: <與需求及架構的直接理由>
license: <SPDX 或 Unknown>
integrationCost: LOW | MEDIUM | HIGH | PROHIBITIVE
maintenanceRisk: LOW | MEDIUM | HIGH
applicableWorklines: [A, B, C, Future-Life-Social]
freshness: FRESH | STALE | PRE_ADOPTION_VERIFY | REJECT_HOLD | MISSING
evidence: [<registry evidenceLinks>]
researchAction: REUSE_PRIOR_RESULT | INCREMENTAL_VERIFY | TARGETED_NEW_RESEARCH | NO_RECHECK
```

輸出必須指出匹配的 registry entry id。多個候選時，先列 native primitive，再列 A、B、C、D。

## OpenKore Exit Support

匹配 OpenKore storage、routing、NPC、reconnect、stuck recovery、party 或 social hooks 時，額外輸出：

```text
specialMode: OPENKORE_BEHAVIOR_REFERENCE
behaviorContract: <輸入、狀態、成功、失敗、timeout、resume>
acceptanceCriteria: <可觀察且可重播的驗收條件>
nativeTarget: <Persistent Agent + rAthena primitive>
regressionTest: <需新增的 server-authoritative regression>
retirementGate: <測試通過後才可退休的 OpenKore capability>
```

OpenKore 只提供 behavior contract 與 acceptance criteria。Persistent Agent 使用 rAthena native primitive 實作；通過 regression test 後才可標記 capability retired。

## 工作線路由

- A：architecture、lifecycle、testing、telemetry、schema、retry。
- B：quest、navigation、combat、NPC、storage、routing、reconnect。
- C：SSE、cache、projection、load test、telemetry。
- Future Life/Social：decision runtime、social graph、event memory、behavior tree、GOAP pattern。

## Registry Maintenance

增量研究改變已知事實時，更新 `ops/research/external-reuse-registry.json` 對應 entry 的：

- `lastCheckedAt`
- `status`
- `rating`
- `license`
- `evidenceLinks`
- `notes`
- `version`
- `lastMeaningfulActivity`

新 entry 必須符合既有 schema、使用穩定 id、記錄 `applicableWorklines`，並保留 primary evidence。更新後驗證 JSON parse、required fields、enum、unique id 與 evidenceLinks。

## Reuse Defaults

下列領域優先查 registry 的成熟候選，仍需遵守條目 recommendation 與 license gate：JSON Schema validation、LRU/TTL cache、structured logging、tracing/metrics、property-based testing、retry/timeout/circuit breaker、SSE/load testing、social graph algorithms、behavior tree runtime、rAthena native primitives。

## Scope Boundary

此 Skill 只負責 research、evaluation、reuse recommendation 與 registry maintenance。它不授權：

- 導入 dependency。
- 修改 production code。
- clone 或執行第三方 binary。
- merge plugin。
- 複製 forum code。
- 自動採用 OSS。

真正導入必須取得該實作任務的明確授權，並執行 fresh verification。

## Completion Gate

只有以下全部成立才完成研究回合：

```text
REGISTRY_FIRST = PASS
FRESHNESS_POLICY = PASS
LICENSE_GATE = PASS
OPENKORE_ACCEPTANCE_MODE = PASS
INCREMENTAL_ONLY = PASS
FULL_SCAN_RETRIGGER = 0
PRODUCTION_CORE_MODIFICATIONS = 0
```
