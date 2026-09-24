# Player-flow First Acceptance Policy

## 目的

本政策將功能驗收與底層診斷分開。Fixture 是建立合法前置條件與縮短等待時間的工具，核心被測行為仍須由真實 runtime、伺服器權威與玩家可採取的行為鏈完成。

## Headless 測試權威

```text
CLIENT_REQUIRED_FOR_TESTING = NO
NATIVE_CLIENT_REQUIRED_FOR_ACCEPTANCE = NO
OPENKORE_RUNTIME_FOR_TESTING = FORBIDDEN
CANONICAL_PLAYER_CONTROL = WEB → SERVER_AGENT / PA → rAthena
CANONICAL_TEST_CONTROL = ADMIN / TEST TRANSPORT → SERVER_AGENT / TEST FIXTURE ADAPTER → rAthena authority
```

測試 fixture 由已認證的伺服器端傳輸建立，指令權限與狀態變更由 rAthena 裁定。使用 TEST_SUPERUSER 準備前置條件，使用 TEST_PLAYER 完成最終玩家流程驗收。Native Client 可作歷史參考或選用工具。

## 測試類型

### A. `PLAYER_FLOW_TEST`

用途：正式功能驗收。

要求：

- 模擬真實玩家的合理行為。
- 儘量覆蓋完整 end-to-end 行為鏈。
- 核心 runtime behavior 必須真實執行。
- 地圖移動、NPC 對話、戰鬥、拾取、補給、死亡恢復與狀態保存，依功能範圍由實際系統完成。
- 最終功能 PASS 必須依 `PLAYER_FLOW_TEST` 判定。

測試報告標記：

```text
TEST_TYPE: PLAYER_FLOW
RESULT: FEATURE_PASS
```

### B. `DIAGNOSTIC_TEST`

用途：快速定位 bug、subsystem 或 function。

允許使用：

- DB fixture
- GM command
- teleport
- heal
- deterministic spawn
- direct setup
- artificial state
- narrow isolated test

診斷測試可以縮小重現範圍與快速確認單一函式，但結果只能標記：

```text
TEST_TYPE: DIAGNOSTIC
RESULT: DIAGNOSTIC_PASS
```

`DIAGNOSTIC_PASS` 不等於 `FEATURE_PASS`。診斷結果不能單獨宣告正式功能完成。

## TEST DESIGN ORDER

1. 先回答玩家正常會怎麼做。
2. 先設計 `PLAYER_FLOW_TEST`，描述正式遊玩的完整行為鏈。
3. 若 Player-flow test 失敗，先分類問題來源，例如 runtime、資料、環境、fixture power 或玩家流程整合。
4. 再使用 fixture、DB、GM 或 isolated diagnostic 縮小問題。
5. 修正根因並保留診斷證據。
6. 最後重新執行 `PLAYER_FLOW_TEST`。
7. Player-flow PASS 後才能宣告 `FEATURE_PASS`。

## AUTO_FARM 範例

### 不能作為主要驗收的流程

角色固定站在座標，工程端生成一隻指定怪，測一次攻擊後宣告 `AUTO_FARM PASS`。這只能標記為 `DIAGNOSTIC_TEST` 與 `DIAGNOSTIC_PASS`。

### 正確的 Player-flow 驗收

```text
角色進入練功區
→ 附近沒有目標
→ 使用蒼蠅翅膀或正常移動找怪
→ teleport／movement 後重新掃描
→ 找到合法怪物
→ 鎖定
→ 接近
→ 攻擊
→ HP mutation
→ 擊殺
→ 撿物
→ HP 不足時補血
→ 繼續尋找下一個目標
```

OpenKore Exit 情境還要確認：

- OpenKore process = 0
- `SERVER_AGENT` owner 正確
- `fd=0` 的 headless entity 正常
- `status.json` dependency = 0

只有完整 Player-flow 通過，才能標記 `SUPPLY_FLOW_PASS` 或 `FEATURE_PASS` 所涵蓋的 AUTO_FARM 功能。

## Supply 範例

Diagnostic：直接由 DB 增加紅水，只能證明 inventory state 可以建立，結果標記 `DIAGNOSTIC_PASS`。

Player-flow：

```text
紅水不足
→ 判斷需要補給
→ 安全離開練功區
→ 回城／Kafra／商店
→ 購買或取出紅水
→ 由 authoritative inventory 確認
→ 返回練功區
→ 恢復 AUTO_FARM
```

只有後者可以宣告：

```text
SUPPLY_FLOW_PASS
```

## Death Recovery 範例

Diagnostic：直接設定 dead state 後呼叫 recovery function，只能標記 `DIAGNOSTIC_PASS`。

Player-flow：

```text
角色真實死亡
→ 復活
→ 恢復必要狀態
→ 補給
→ 重新導航
→ 回到原目標
→ AUTO_FARM 繼續
```

只有完整鏈路通過，才能宣告死亡恢復功能的 `FEATURE_PASS`。

## 與既有 Fixture Policy 的關係

既有原則保留：

> 前置條件可以人工建立，核心被測行為必須真跑。

本政策補充：人工 fixture 是加速工具，不是玩家流程的替代品。測試設計優先順序為：

```text
Player realism
→ test stability
→ reproducibility
→ diagnostic efficiency
```

Fixture 必須使用隔離帳號或隔離環境，記錄建立方式、調整項目、可重置方式與對正式有效性的限制。Fixture 結果不得直接列入正式玩家平衡、排行榜或公開功能完成度。

## 測試報告標籤

所有後續測試報告至少標示：

```text
TEST_TYPE: PLAYER_FLOW
```

或：

```text
TEST_TYPE: DIAGNOSTIC
```

結果使用：

```text
DIAGNOSTIC_PASS
FEATURE_PASS
```

判定規則固定為：

```text
DIAGNOSTIC_PASS ≠ FEATURE_PASS
```

當 Player-flow 未通過時，即使 Diagnostic 已通過，也要保留功能狀態為未完成或待修正，直到重新完成 Player-flow acceptance。


## Deterministic fixture execution contract

SETUP / PROVISION -> EXECUTE -> ASSERT -> CLEANUP. Define TEST_OBJECTIVE, TEST_BOUNDARY, SETUP_ALLOWED, SETUP_FORBIDDEN, PASS_EVIDENCE and CLEANUP. Preserve reproducible setup and separate FLOW from BALANCE fixtures. Current headless and player-flow authority above governs all fixture execution.
