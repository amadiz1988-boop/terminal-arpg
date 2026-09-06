# 普通攻擊來源稽核

更新日期：2026-09-06

## 正式計算

普通攻擊使用武器平均物理傷害、每秒攻擊次數與武器暴擊率。全域增加傷害、攻擊速度與暴擊率沿用角色屬性解析器；技能寶石與輔助寶石不參與普通攻擊。魔力低於目前技能消耗時切換普通攻擊，魔力足夠後優先恢復技能。

| 職業基準 | 平均物理傷害 | 每秒攻擊 | 暴擊率 | 來源 |
| --- | ---: | ---: | ---: | --- |
| 盜賊，玻璃利片 | 8 | 1.5 | 8% | https://poedb.tw/tw/Glass_Shank |
| 法師，朽木法杖 | 7 | 1.5 | 8.3% | https://poedb.tw/tw/Driftwood_Wand |
| 服事，朽木之棒 | 7 | 1.45 | 5% | https://poedb.tw/tw/Driftwood_Club |

PoB 計算架構參考：https://github.com/PathOfBuildingCommunity/PathOfBuilding/blob/dev/docs/calcOffence.md

PoE 普通攻擊標籤參考：https://poedb.tw/tw/Default_Attack

## 限制

目前裝備系統尚未替每一把掉落武器建立已查證的 PoE 底材傷害，因此普通攻擊暫時沿用職業初始武器基準，再套用現有裝備詞綴。新增底材前必須逐筆完成來源資料。
