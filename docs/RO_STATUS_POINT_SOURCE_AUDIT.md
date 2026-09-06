# RO 能力配點來源稽核

## Alpha 0.15 已實作規則

| 規則 | 實作 | 來源 |
| --- | --- | --- |
| 六項能力 | STR、AGI、VIT、INT、DEX、LUK，初始皆為 1，單項上限 99 | [iRO Classic Stats](https://irowiki.org/classic/Stats) |
| 初始點數 | Lv.1 可配置 48 點 | [rAthena Renewal statpoint.yml](https://github.com/rathena/rathena/blob/master/db/re/statpoint.yml) |
| 升級取得點數 | 從等級 x 升至 x+1，取得 `floor(x/5)+3` | [iRO Classic Stats](https://irowiki.org/classic/Stats) |
| 能力提升成本 | 從 x 升至 x+1，消耗 `floor((x-1)/10)+2` | [iRO Classic Stats](https://irowiki.org/classic/Stats)、[rAthena pc.cpp](https://github.com/rathena/rathena/blob/master/src/map/pc.cpp) |
| STR | 近戰攻擊 `STR + floor(STR/10)^2`；每 5 STR 增加 1 遠程攻擊 | [iRO Classic Stats](https://irowiki.org/classic/Stats) |
| AGI | 每點縮短 0.4% 基本攻擊間隔 | [iRO Classic Stats](https://irowiki.org/classic/Stats) |
| VIT | 每點增加 1% 最大生命 | [iRO Classic Stats](https://irowiki.org/classic/Stats) |
| INT | 最小 MATK `INT + floor(INT/7)^2`；最大 MATK `INT + floor(INT/5)^2`；每點增加 1% 最大 SP | [iRO Classic Stats](https://irowiki.org/classic/Stats) |
| DEX | 遠程攻擊 `DEX + floor(DEX/10)^2`；施法時間縮短 `DEX/150` | [iRO Classic Stats](https://irowiki.org/classic/Stats) |
| LUK | 每點增加 0.3 暴擊；每 5 點增加 1 攻擊；不影響掉落率 | [iRO Classic Stats](https://irowiki.org/classic/Stats) |

## 跨系統對照

本作技能沿用 PoE 標籤。`Attack` 使用 RO 物理攻擊與 AGI 間隔，`Spell` 使用 RO MATK 與 DEX 施法時間，`Bow` 使用 RO 遠程攻擊。INT 的最大 SP 對應本作最大魔力。這些對照屬本作明示整合規則，原始數值公式保持可追溯。

尚未建立怪物 HIT、FLEE、軟防禦與狀態抗性前，DEX 命中、AGI 迴避、VIT 軟防禦與 LUK 完全迴避不進入公開戰鬥計算。
