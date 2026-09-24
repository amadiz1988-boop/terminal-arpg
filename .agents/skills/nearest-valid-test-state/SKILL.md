---
name: nearest-valid-test-state
description: 在大型 Repository 執行功能驗證、Integration、Vertical Slice、Restart、Quest、Agent 或長時間自動化測試時，從距離被測功能最近的合法可重現狀態開始，避免重跑無關的高成本前置流程。一般單元測試與明確 Full E2E 任務仍依其原範圍執行。
---

# Nearest Valid Test State

大型測試開始前先回答：「本輪真正要驗證的是什麼？」接著選擇距離該功能最近、合法、可重現、具正式 authority 且成本最低的已知狀態。

此 Skill 只調整測試起點與範圍，不降低可信度、不跳過當前被測功能，也不擴大修改或操作權限。

## Representative Evidence / Test Acceleration Rule

固定原則：「可以加速環境，不可以偽造結果。」

測試加速只可用於隔離測試帳號、fixture、PoC、regression 與 production-like 測試環境。正式玩家或 production gameplay 一律禁止。

### Representative Evidence Gate

加速前必須先保存至少一份真實 runtime evidence，證明與被加速重複條件相同的核心機制閉環有效。證據必須來自真實 authority，不接受 UI local state、mock success、手動改寫後的狀態或文字聲明。

例如擊殺任務，必須先真實完成：

```text
target selection
→ movement
→ combat
→ kill attribution
→ rAthena 真實 quest progress 增加
```

只有這條鏈路已取得證據，後續同種怪物的純刷新等待才可加速。若核心機制、目標類型、authority 或被測邊界改變，必須重新取得 representative evidence。

### 允許的環境加速

- 生成測試怪物：已證明至少一次同種目標的完整擊殺與任務進度鏈後，可在隔離環境於角色附近生成剩餘同種怪物。Agent 仍必須自行找怪、移動、攻擊與擊殺，rAthena 仍必須自行增加 quest progress。
- 測試角色等級加速：已證明真實 EXP 與 Job EXP 正常增加後，可為進入下一測試門檻調整隔離角色等級。必須記錄加速前後數值與原因，不將結果當成養成效率或 leveling persistence 證據。
- 測試資源補充：已證明對應的 item consumption、loot 或 inventory 流程後，可為後續非資源型測試補充 fixture 資源。補充必須標記 fixture，使用行為仍走原生 item use，且不將補充當成 gameplay reward 或 loot evidence。
- Fixture cooldown／timer 縮短：只限自訂 fixture，不修改正式 RO rule 的 production 數值。
- 大量重複操作：核心行為已有 representative evidence 後，可縮短不具新增測試價值的純等待，但不得省略仍處於本輪驗證邊界內的系統動作。

### 禁止的結果偽造

- 直接修改 quest count、以 SQL 直接改 quest state 或直接標記 quest complete。
- 直接發放正式 quest reward。
- 直接改 Inventory 並將其當成 loot evidence，或直接改 Zeny 並將其當成 shop／service evidence。
- 直接改 HP／SP 並將其當成 recovery evidence。
- 跳過當前被測的 NPC script、Navigation、ownership collision、restart recovery 或 reward confirmation。
- 偽造 restart recovery、reward confirmation 或任何 authority event。
- 將 fixture、PoC 或 isolated representative 結果稱為 production PASS。

Fixture 可以保存已由真實系統建立的前置 Quest State checkpoint，但不可在當前被測 Quest 中直接改寫 count、state、completion 或 reward。

### Evidence 記錄

每次使用加速都必須在 runtime evidence、`RESULTS.md` 或 Roadmap 中寫入：

- `TEST ACCELERATION`
- 加速原因。
- 加速前已取得的真實證據。
- 加速的環境條件。
- 仍由真實系統產生的結果。
- 對 production validity 的影響。

### 固定判斷案例

1. 等怪刷新五分鐘，已有一次真實 kill 與 progress evidence：`ALLOW test spawn`。
2. 任務尚未真實擊殺任何目標怪：`DENY progress acceleration`。
3. 已證明真實 EXP gain：`ALLOW test-only level acceleration`，不納入養成效率證據。
4. 尚未驗證 loot：`DENY inventory grant as loot PASS`。
5. 正式玩家或 production gameplay：`DENY test acceleration`。

Eden Course A 例子：Scorpion `0/5 → 1/5` 必須已透過真實 target selection、movement、combat、kill attribution 與 rAthena quest progress 取得證據。滿足後可以 test-only spawn 剩餘四隻 Scorpion，由 Agent 自行完成擊殺並由 rAthena 將進度推至 `5/5`；不可直接把 quest count 改為 5。

## 執行前必填

先明確列出：

- 本輪被測功能。
- 測試層級。
- 合法起始狀態。
- 必要前置條件。
- 本輪不需重新驗證的已完成功能。
- 使用的 fixture、checkpoint、snapshot、known-good character 或 isolated DB state。
- Representative Evidence Gate 是否滿足，以及本輪是否使用 Test Acceleration。
- 是否需要超過 1 分鐘的等待型操作。

若等待本身不屬於本輪被測功能，先尋找同等可信的 fixture、checkpoint、known-good state、snapshot 或 deterministic reset。存在較短路徑時，採用較短路徑。

## 測試層級

### A. Unit / Component

只測單一函式、元件、contract 或 state transition。不得啟動無關的完整遊戲流程。

### B. Integration

從最近的合法狀態開始，驗證數個真實模組串接。Quest Runtime、Persistent Agent、OpenKore 與 rAthena 的整合測試不需要從 Novice 開始。

### C. Feature Vertical Slice

驗證當前功能完整閉環。測 Thief 至 Assassin 時，合法起點是已完成一轉並符合前置條件的 Thief；當前 Quest、Trial、Final Commit 與 Job Change 必須走真實流程。

### D. Full End-to-End Regression

只有下列情況採用完整角色建立、onboarding、一轉、練等、二轉與後續流程：

- milestone 或 release gate。
- 大型架構變更。
- 本輪修改 onboarding、轉職鏈、EXP、leveling 或跨模組 persistence。
- regression evidence 指向前後流程整合破壞。
- 使用者明確要求 Full E2E 或 full regression。
- 前置狀態無法安全 fixture 化。

Full E2E 不作為每次 feature 修改後的預設循環。

## Fixture 與 Checkpoint

已穩定且已驗證的前置系統優先建立或沿用 reusable fixture。Fixture 可包含固定隔離測試身份、職業、Base／Job Level、技能、Inventory、Zeny、已由真實系統建立的前置 Quest State checkpoint、位置、補給、死亡或 Trial 狀態。

Fixture 必須：

- 在遊戲規則上合法。
- 不繞過本輪真正要驗證的 server authority。
- 不以 UI local state 或 mock success 冒充 Production PASS。
- 不修改或重置正式玩家資料。
- 可 deterministic reset，並能證明回到 known-good state。
- Reset 後不留下 stale agent、session、重複角色或測試垃圾。

Fixture 已存在時不得另建角色從頭練。重複出現的測試狀態應在第一次完成後評估建立 reusable fixture，例如 Assassin-ready Thief、TRIAL_ACTIVE、低補給 SAFE／DEFERRED、Trial 中死亡與 target whitelist map。

## 高成本前置限制

以下流程只有在其本身是本輪目標或符合 Full E2E 條件時執行：

- 從初心者重新練等、重跑 onboarding 或重做已驗證的一轉。
- 重複刷 Base／Job Level、素材或後段測試資格。
- 重複跑已驗證的長距離導航或任務鏈。
- 重複建立相同測試角色。
- 為到達 known-good state 等待自然成長或長時間掛機。

### 練等

只有測 EXP、Auto Battle leveling、Base／Job progression、level gate、onboarding progression、growth pacing 或 leveling persistence 時，才用實際掛機練等。其餘測試使用合法的既有角色、isolated DB fixture 或 deterministic reset。

### 農素材

只有測 drop rate、loot、item objective、farming logic 或 inventory persistence 時，才走真實農怪流程。其餘測試使用合法 fixture inventory 或 isolated test grant。不得修改正式玩家 inventory。

### 導航

只有測 GO_MAP、GO_NPC、route planning、portal traversal、navigation restart 或 route failure 時，才重跑對應路線。其餘測試可從已到達合法 map 的 fixture 或 checkpoint 開始。

### 任務

已具 Production PASS、正式 state evidence 與 regression coverage 的前置 Quest 不需重跑。測後續 Quest 時，從合法完成前置步驟的 checkpoint 開始；當前被測 Quest、Trial 或 Final Commit 不得跳過。

### Restart / Recovery

從最接近風險點的 active state 開始：Trial restart 使用 `TRIAL_ACTIVE`，Supply restart 使用 supply active state，Death Recovery 使用 `DEAD`／`RECOVERING`。不得為單一 restart case 重新建角並完整練到該狀態。

## 預設回歸循環

開發中的預設順序：

```text
Component
→ Integration
→ Feature Vertical Slice
```

小修改執行 targeted regression；模組修改執行 module integration regression；feature 完成執行 feature vertical slice；milestone 與 release 才執行 Full E2E／full regression。

更慢不等於更可信。選擇能驗證當前風險、具正式 authority、可重現、可隔離且成本最低的測試路徑。

## 高成本流程例外回報

必須重跑高成本前置時，開始前先確認理由，完成後回報：

1. 無法使用既有 fixture 的原因。
2. 無法從更接近功能的 checkpoint 開始的原因。
3. 前置流程是否屬於本輪被測功能。
4. 本次需要 Full E2E 的依據。
5. 是否建立 reusable fixture。
6. 實際花費時間。
7. 對正式環境的影響。

## 每次大型測試回報

- 本輪真正被測功能。
- 測試層級與起始狀態。
- 使用的 fixture 或 checkpoint。
- 是否重跑高成本前置及原因。
- 是否建立可重用 checkpoint。
- 是否使用 Test Acceleration；若有，附上 Representative Evidence Gate 與完整 evidence 記錄。
- Targeted regression 結果。
- 是否執行 Full E2E及其依據。
