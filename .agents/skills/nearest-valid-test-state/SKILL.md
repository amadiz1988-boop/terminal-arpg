---
name: nearest-valid-test-state
description: 在大型 Repository 執行功能驗證、Integration、Vertical Slice、Restart、Quest、Agent 或長時間自動化測試時，從距離被測功能最近的合法可重現狀態開始，避免重跑無關的高成本前置流程。一般單元測試與明確 Full E2E 任務仍依其原範圍執行。
---

# Nearest Valid Test State

大型測試開始前先回答：「本輪真正要驗證的是什麼？」接著選擇距離該功能最近、合法、可重現、具正式 authority 且成本最低的已知狀態。

此 Skill 只調整測試起點與範圍，不降低可信度、不跳過當前被測功能，也不擴大修改或操作權限。

## 執行前必填

先明確列出：

- 本輪被測功能。
- 測試層級。
- 合法起始狀態。
- 必要前置條件。
- 本輪不需重新驗證的已完成功能。
- 使用的 fixture、checkpoint、snapshot、known-good character 或 isolated DB state。
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

已穩定且已驗證的前置系統優先建立或沿用 reusable fixture。Fixture 可包含固定隔離測試身份、職業、Base／Job Level、技能、Inventory、Zeny、Quest State、位置、補給、死亡或 Trial 狀態。

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
- Targeted regression 結果。
- 是否執行 Full E2E及其依據。
