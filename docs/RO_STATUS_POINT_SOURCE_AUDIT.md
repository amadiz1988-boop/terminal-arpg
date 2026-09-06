# RO 能力與衍生屬性來源稽核

## Alpha 0.16 已實作規則

| 規則 | 實作 | 來源 |
| --- | --- | --- |
| 六項能力 | STR、AGI、VIT、INT、DEX、LUK，初始皆為 1，單項上限 99 | [仙境全書角色數值](https://ro.ntome.com/stat/attr) |
| 本作初始點數 | Lv.1 為 0 點；舊版 RO 的 48 點創角額度不帶入本作 | 本作已核准的從零成長規則 |
| 升級取得點數 | 從等級 x 升至 x+1，取得 `floor(x/5)+3`；Lv.2 累積 3、Lv.6 累積 16、Lv.99 累積 1225 | [iRO Classic Stats](https://irowiki.org/classic/Stats) |
| 能力提升成本 | 從 x 升至 x+1，消耗 `floor((x-1)/10)+2` | [iRO Classic Stats](https://irowiki.org/classic/Stats)、[rAthena pc.cpp](https://github.com/rathena/rathena/blob/master/src/map/pc.cpp) |
| STR | 每 1 點近戰素質 ATK +1；每 5 點遠程素質 ATK +1 | [仙境全書角色數值](https://ro.ntome.com/stat/attr) |
| AGI | 每 1 點 FLEE +1；每 5 點素質 DEF +1；進入普攻與攻擊技能間隔 | [仙境全書角色數值](https://ro.ntome.com/stat/attr) |
| VIT | 每 1 點最大生命 +1%；每 2 點素質 DEF +1；每 5 點素質 MDEF +1 | [仙境全書角色數值](https://ro.ntome.com/stat/attr) |
| INT | 每 1 點 MATK +1.5、MDEF +1、最大魔力 +1%；可變詠唱權重為 DEX 的一半 | [仙境全書角色數值](https://ro.ntome.com/stat/attr)、[iRO Renewal Cast Time](https://irowiki.org/wiki/Cast_Time) |
| DEX | 每 1 點遠程素質 ATK、HIT +1；每 5 點近戰 ATK、MATK、MDEF +1 | [仙境全書角色數值](https://ro.ntome.com/stat/attr) |
| LUK | 每 1 點暴擊 +0.3；每 3 點 ATK、MATK、HIT +1；每 5 點 FLEE +1；每 10 點完全迴避 +1 | [仙境全書角色數值](https://ro.ntome.com/stat/attr) |
| 基礎等級 | 每 1 級 HIT、FLEE +1；每 2 級 DEF +1；每 4 級 ATK、MATK、MDEF +1 | [仙境全書角色數值](https://ro.ntome.com/stat/attr) |
| ASPD 顯示 | `200 - 50 / 每秒攻擊次數`，目前上限 190 | [iRO Classic ASPD](https://irowiki.org/classic/ASPD) |
| 可變詠唱 | `1 - sqrt((DEX*2+INT)/530)` | [iRO Renewal Cast Time](https://irowiki.org/wiki/Cast_Time) |

## 48 點來源與本作決策

舊版 RO 把 48 點視為創角六圍配置的等價額度，所以 Lv.1 的總可用點數會包含 48。鬼島傳說要求角色從零成長，因此 Lv.1 僅保留六圍基礎值 1，可用點數固定為 0。升到 Lv.2 才依 RO 升級公式取得第一批 3 點。舊存檔若超出新等級預算，載入時會重置六圍並保留角色、裝備與進度。

## 跨系統對照

本作技能沿用 PoE 標籤。`Attack` 使用 RO 物理攻擊與 AGI 間隔，`Spell` 使用 RO MATK 與 Renewal 可變詠唱，`Bow` 使用 RO 遠程攻擊。INT 的最大 SP 效果對應本作最大魔力。配點與重置會立即重新解析戰鬥能力，進行中的地圖會在下一個戰鬥步更新生命與魔力上限。
