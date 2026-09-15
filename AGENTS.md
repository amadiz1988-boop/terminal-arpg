# 鬼島傳說開發鐵律

## RO 來源真實性鐵律

遊戲規則與內容固定以鎖定版本的 rAthena Renewal、OpenKore 原始碼、Gravity 可核對資料及可重現的 RO 遊戲內行為為基準。專案不載入其他 ARPG 的職業、技能、物品、地圖、經濟、打造或天賦規則。

每次新增或修改內容時，必須依序執行：

1. 優先查鎖定版本的 rAthena `src`、`db/re`、`npc`、`doc` 與 OpenKore 原始碼。
2. 再查 Gravity 官方公告、官方遊戲說明或可驗證的 RO 遊戲內資訊。
3. 資料不足時，保留 `【資料不足，無法確認】`，不可將推導值寫入正式內容。
4. 至少保存來源網址、資料日期、遊戲版本、原始效果與本作實作對照。
5. 需要調整值時，記錄證據、假設與推導步驟，並標記 `待使用者核准`。

每筆內容資料至少包含：

```text
sourceGame: rAthena Renewal | OpenKore | Gravity RO
sourceUrl
sourceVersion
verifiedAt
sourceStatus: verified | inferred | user-approved
implementationNotes
```

介面必須區分：

- `原作可確認`：名稱、效果與公式有 RO 來源支持。
- `分析推導`：來源不完整，已列出推導依據，尚待核准。
- `使用者核准`：使用者已明確接受本作調整值。

所有新功能先查核 rAthena 與 OpenKore 是否已有原生能力，再決定重用或補接。發現來源與現行 RO 規格衝突時，先停止該項目並建立稽核紀錄。

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

## 公開版本壓力測試鐵律

任何公開版本都必須完整執行 `npm run test:release`，並取得 `RELEASE_GATE_PASS`。禁止用單元測試、建置成功或人工瀏覽其中一項代替完整發布門檻。

發布門檻固定包含：

1. 所有領域規則與回歸測試。
2. 5,000 張地圖結果壓力測試。
3. 1,000 組逐殺獎勵守恆測試。
4. 單一帳號 1,000 張地圖加速養成測試。
5. 手機寬度介面、起始流程、實際戰鬥、擊殺經驗、掉落入帳與瀏覽器錯誤檢查。
6. 靜態檢查與正式環境建置。
7. 公開後再次執行相同的玩家流程冒煙測試。

任一檢查失敗時，版本狀態只能標記為 `未通過發布門檻`，修正並重新跑完整流程後才能公開。測試報告必須記錄測試數量、耗時、失敗項目與公開站驗證結果。
