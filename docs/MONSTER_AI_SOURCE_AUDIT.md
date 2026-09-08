# 怪物 AI 與交戰來源稽核

## 查證資料

| 項目 | 原作資料 | 本作實作 |
| --- | --- | --- |
| 怪物行為 | 怪物技能依攻擊、施放速度、冷卻與 AI 行為執行 | 每隻怪物保存獨立移動與攻擊時鐘 |
| 普通怪移速 | 稀有度沒有額外移速加成 | 基礎逐格移動延遲維持 250ms |
| 魔法怪移速 | 10% increased Movement Speed | 移動延遲套用 `250 / 1.10` |
| 稀有怪移速 | 25% increased Movement Speed | 移動延遲套用 `250 / 1.25` |
| 魔法怪攻速 | 20% increased Attack/Cast Speed | 攻擊間隔套用 `1000 / 1.20` |
| 稀有怪攻速 | 33% increased Attack/Cast Speed | 攻擊間隔套用 `1000 / 1.33` |
| 怪物稀有度傷害 | 魔法 30% more 並有 20% less；稀有 50% more 並有 33% less | 沿用既有 `rankDamage` 乘區 |

## 來源欄位

- sourceGame: Path of Exile
- sourceUrl: https://poedb.tw/tw/Monster
- sourceVersion: PoEDB，查證日頁面
- verifiedAt: 2026-09-08
- sourceStatus: verified
- implementationNotes: 250ms 基礎格速與 1000ms 基礎攻擊間隔是既有終端模擬時間尺度；本版只把 PoEDB 可確認的稀有度增速套進該尺度。怪物近身距離以相鄰地圖格表達，屬介面離散化，沒有宣稱為 PoE 公尺距離公式。

## 未納入項目

遠程怪、衝鋒怪、施法怪與首領技能需要逐一綁定 PoEDB 的實際怪物條目、技能、攻擊時間及冷卻。完成來源配對前不加入公開資料。
