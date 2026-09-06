# 天賦來源稽核

資料查證日期：2026-09-06

## Alpha 0.13 已進入正式計算

| 天賦板 | 節點效果 | 條件 | 來源 |
|---|---|---|---|
| 巨力之神 | 攻擊傷害 +9%、移動速度 +2% | 傷害只套用攻擊標籤 | https://tlidb.com/tw/Talent |
| 巨力之神 | 攻擊傷害 +18% | 傷害只套用攻擊標籤 | https://tlidb.com/tw/Talent |
| 巨力之神 | 護甲值 +10%、最大生命 +4% | 全部套用 | https://tlidb.com/tw/Talent |
| 狩獵之神 | 傷害 +9% | 全部技能 | https://tlidb.com/tw/Talent |
| 狩獵之神 | 攻擊與施法速度 +3% | 全部技能 | https://tlidb.com/tw/Talent |
| 狩獵之神 | 攻擊與施法速度 +6%、移動速度 +4%、技能消耗 -4 | 全部套用 | https://tlidb.com/tw/Talent |
| 知識之神 | 法術傷害 +9% | 傷害只套用法術標籤 | https://tlidb.com/tw/Talent |
| 知識之神 | 施法速度 +3% | 速度只套用法術標籤 | https://tlidb.com/tw/Talent |
| 知識之神 | 最大魔力 +8% | 套用至基礎最大魔力後 | https://tlidb.com/tw/Talent |

每個天賦板與節點保存 `sourceGame`、`sourceUrl`、`sourceVersion`、`verifiedAt`、`sourceStatus` 與實作對照。介面直接標記「火炬之光：無限 · 原作可確認」。

## 已隔離的舊資料

Alpha 0.12 的職業、二轉與昇華百分比沒有逐筆來源，因此 Alpha 0.13 已停止將這些數值送入角色屬性解析器。職業名稱與玩家選擇仍保留，數值效果會在完成 PoEDB 昇華節點配對後逐項恢復。

目前狀態：職業效果與二轉特殊節點 `【資料不足，無法確認】`。
