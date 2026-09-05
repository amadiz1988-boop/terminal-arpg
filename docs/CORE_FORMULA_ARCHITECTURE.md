# 核心公式與內容架構

更新日期：2026-09-05

這份規格定義長期資料契約。PoEDB 與 TLIDB 用於研究詞綴分類和公式行為；遊戲內容採原創 ID、名稱與世界觀。

## 修正值模型

每個效果先轉成同一種結構，再交給解析器：

```ts
type Modifier = {
  id: string
  stat: StatKey
  operation: 'BASE_ADD' | 'INCREASED' | 'MORE' | 'OVERRIDE'
  value: number
  source: { type: 'item' | 'skill' | 'support' | 'passive' | 'unique'; id: string }
  tags: string[]
  condition?: Condition
  priority?: number
}
```

`BASE_ADD` 加進基礎池，`INCREASED` 在相同作用域內相加，`MORE` 每個來源分別相乘，`OVERRIDE` 依優先序改寫結果。條件先求值，未滿足的修正不進管線。

## 傷害計算順序

```text
1. 取得技能或武器基礎傷害
2. 加入有效的固定點傷
3. 依序處理傷害轉換，總轉換上限由規則決定
4. 對每種傷害類型加總 Increased
5. 逐項乘上 More
6. 套用有效攻擊或施放頻率
7. 套用命中率與暴擊期望值
8. 套用敵方抗性、穿透、曝曬與承受傷害修正
9. 產生 Hit、Ailment 或 Damage over Time 結果
```

傷害事件保存來源、類型與標籤。投射物、範圍、攻擊、法術、持續傷害只影響標籤符合的修正。

## 防禦計算順序

```text
承受傷害
→ 承受傷害轉換
→ 抗性或護甲
→ Less Damage Taken
→ 格擋、壓抑或避免
→ 能量護盾、生命與其他資源分攤
→ 受擊後恢復
```

護甲需要攻擊傷害值才能計算，因此面板提供多個標準情境：小怪連擊、稀有怪重擊、首領大擊。生存評分顯示各情境的有效生命，不能只顯示護甲百分比。

## 詞綴生成

```ts
type AffixDefinition = {
  id: string
  family: 'prefix' | 'suffix' | 'implicit' | 'corrupted' | 'crafted'
  group: string
  tiers: Array<{ tier: number; minItemLevel: number; min: number; max: number; weight: number }>
  requiredTags: string[]
  forbiddenTags: string[]
  modifiers: ModifierTemplate[]
  source: DropSourceId | CraftMethodId
}
```

生成流程先選底材，再依物品等級、標籤和來源建立候選池，排除互斥群組後按權重抽取。稀有度只決定詞綴容量；物品強度由底材、詞綴階級、組合與 Build 契合度共同決定。

## 天賦圖

```ts
type PassiveNode = {
  id: string
  boardId: string
  kind: 'minor' | 'notable' | 'keystone'
  requires: string[]
  cost: number
  modifiers: Modifier[]
  ruleHooks?: UniqueEffect[]
}
```

後端保存完整圖結構。手機介面一次顯示一塊板，提供推薦路徑、花費預覽與一鍵撤銷預覽；確認後才提交。關鍵天賦必須同時改變玩法並帶來限制，例如犧牲暴擊換取穩定命中。

## 傳奇與規則鉤子

```ts
type UniqueEffect = {
  id: string
  hook: 'BEFORE_HIT' | 'AFTER_HIT' | 'ON_KILL' | 'ON_CAST' | 'RESOURCE_COST' | 'STAT_OVERRIDE'
  condition?: Condition
  parameters: Record<string, number | string | boolean>
  priority: number
  exclusivityGroup?: string
}
```

鉤子由引擎登錄表執行，內容資料不能插入任意程式碼。每個效果都有固定測試：觸發條件、未觸發條件、與其他鉤子的順序、上限和循環依賴。

## 手機介面契約

* 首層只顯示可採取的動作與結果。
* 長按或展開才顯示公式來源。
* 裝備頁固定顯示清圖、首領、生存三種差值。
* 製裝先選目標詞綴類別，再顯示成本、可能結果和保留條件。
* 天賦改動先預覽整體差值，確認後一次套用。
* 交易行可從裝備、天賦、製裝頁直接帶入篩選條件。
* 主要按鈕觸控高度至少 44 像素，關鍵流程不依賴滑鼠懸停。

## 實作順序

1. 把現有六種簡化詞綴轉成 Modifier 資料。
2. 加入傷害標籤、BASE_ADD、INCREASED、MORE 與條件解析。
3. 補齊命中、暴擊倍率、敵方抗性與標準防禦情境。
4. 建立分板天賦圖及兩個會改規則的關鍵天賦。
5. 建立三件原創傳奇，分別驗證傷害轉換、擊殺觸發與資源改寫。
6. 所有系統再接入 Build 比較、製裝與交易篩選介面。
