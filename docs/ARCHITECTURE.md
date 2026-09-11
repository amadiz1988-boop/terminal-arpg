# RO Renewal 與自動冒險架構

產品責任分界與 NPC 服務流程以 `docs/RO_AUTOMATION_PRODUCT_CONSTITUTION.md` 為最高層契約。世界服務產生唯一權威事件，小地圖、戰鬥終端、角色介面與 NPC 視窗只能讀取狀態或提交命令，不能自行模擬結果。

本架構只採用 RO Renewal、rAthena、OpenKore 與 Gravity RO 的資料和規則。版本、來源與取捨記錄在 `docs/RO_SOURCE_BASELINE.md`、`docs/DESIGN_SOURCE_POLICY.md` 及各 RO 審查文件中。

## Architecture goal

每個版本都延伸同一個可重現的 RO 世界服務。介面、內容匯入與持久化可以獨立演進，移動、戰鬥、道具、任務與轉職規則維持單一權威實作。

## Dependency direction

```text
UI → Application commands → RO domain services → RO content data
                         ↓
                    Persistence port
```

依賴只向內。RO 領域服務使用純 TypeScript，不匯入 React、瀏覽器 API 或畫面計時器。

## Modules

| Module | Owns | Must not own |
| --- | --- | --- |
| `game/ro/content` | Renewal 職業、技能、道具、怪物、地圖、NPC 與任務資料 | 執行期狀態 |
| `game/ro/core` | RO 世界共用型別、事件識別與可重現亂數 | UI 狀態 |
| `game/ro/formulas` | Base/Job 經驗、能力值、命中、傷害、ASPD、重量與轉職門檻 | 畫面排版 |
| `game/ro/world` | 地圖格線、角色、怪物、掉落物、傳送點與世界時鐘 | React 狀態 |
| `game/ro/automation` | OpenKore 風格掛機策略、任務佇列、撿取、補給、回城與卡路脫離 | 畫面事件 |
| `game/ro/combat` | 普攻、技能、屬性、狀態、攻擊延遲與戰鬥事件 | 地圖繪製 |
| `game/ro/inventory` | 道具堆疊、重量、裝備、使用、丟棄、交易與倉庫 | 戰鬥計時 |
| `game/ro/progression` | Base/Job 經驗、能力點、技能點、任務進度與轉職 | 身分驗證 |
| `game/server` | 權威命令、連線同步、帳號角色持久化與防濫用限制 | 客戶端自行結算 |
| `app` | 頁面組合、命令提交、即時訂閱、音效與 session 生命週期 | 傷害、掉落或轉職公式 |
| `components/game` | RO 風格視窗、戰鬥終端、任務日誌、裝備紙娃娃與玩家輸入 | 隨機掉落或規則變更 |

## Stable contracts

所有世界運算接受種子與目前狀態，回傳更新後狀態及領域事件。事件由 UI 以時間戳和分類呈現，戰鬥數字、任務日誌與小地圖都從同一事件流取得。

```ts
advanceRoWorld(state: RoWorldState, ticks: number): RoWorldState
resolveRoStats(character: RoCharacterState): ResolvedRoStats
stepRoAutomation(state: RoWorldState, policy: RoAutomationPolicy): RoDecision
applyRoCommand(state: RoGameState, command: RoGameCommand): RoGameState
```

內容使用可追蹤 ID 與版本化資料。角色存檔只保存 ID、數值與任務狀態，不保存 React 物件或顯示文字。

## Server authority path

開發測試可使用本機 RO 服務。公開測試時，伺服器負責地圖移動、碰撞、戰鬥、掉落、重量、裝備、任務、轉職與經驗值；客戶端只提交命令並渲染伺服器驗證後的狀態和事件。所有命令具備角色、版本、請求序號與冪等鍵，避免前端先扣除後被舊資料覆蓋。

## Rules that prevent rewrites

1. 移動、掛機、戰鬥、掉落、重量、任務、經驗與轉職公式不可放在 React 元件。
2. 內容定義不可放在運算引擎，所有數值規則要標示 RO 來源與版本。
3. 角色、裝備、戰鬥終端、任務日誌與小地圖必須讀取同一份已驗證狀態。
4. 隨機結果必須帶種子，事件必須能重播，存檔格式變更必須提供遷移。
5. 每個功能先完成領域測試，再接上玩家介面與實機尺寸驗收。
6. 發現舊時代或非 RO 規則時先停用並查核來源，確認新版 Renewal 系統後才新增實作。

## Repository layout

```text
game/
  ro/
    content/       Renewal 職業、技能、道具、怪物、地圖與 NPC
    core/           RO 共用型別、事件與可重現亂數
    formulas/      能力、傷害、經驗、重量與轉職公式
    world/         地圖、角色、怪物、掉落物與傳送點
    automation/    掛機、任務佇列、撿取、補給與卡路脫離
    combat/        戰鬥解析與事件
    inventory/     裝備、道具、重量、倉庫與交易
    progression/   經驗、能力點、技能點、任務與轉職
  server/          權威命令、同步、持久化與防濫用
app/               頁面與應用程式組合
components/game/  RO 風格視窗與玩家輸入
tests/game/        領域、伺服器與介面契約測試
docs/              RO 來源、規格、審查與發行紀錄
```

## Release gate

發行前必須通過 `npm run test:release`，包含領域測試、lint、build、手機尺寸 UI 驗收、RO 繁中道具檢查、掛機停止與重量邊界檢查。公開網址、提交 SHA、測試結果與 UI 驗收報告必須一併記錄，未通過不得宣稱完成公開發行。
