# Allflame 起始技能研究

查核日期：2026-09-08

## 選擇依據

Poe Ninja 的 PoE1 build index API 顯示目前一般 Allflame 聯盟收錄 124,467 名角色。Winter Orb 為 Occultist 4.697% 與 Elementalist 2.633%，Righteous Fire 為 Chieftain 4.402%，Penance Brand 為 Elementalist 2.438%，Cyclone of Tumult 為 Slayer 1.835%。

本版選用冬季之球、贖罪烙印與旋風斬．騷動。三者都位於該 API 顯示的熱門技能資料中，且分別提供投射物、附著蓄能爆炸、移動引導近戰三種可辨識戰鬥形態。Righteous Fire 需要處理 90% 最大生命與 70% 最大能量護盾的自焚公式；目前角色系統尚無火焰抗性與能量護盾完整模型，因此先不作為 Lv.1 起始技能。

## 實作映射

| 職業 | 技能 | 已核實形態 | 小地圖呈現 |
| --- | --- | --- | --- |
| 盜賊 | 旋風斬．騷動 | 引導移動、持續範圍攻擊；每 0.4 秒一層，最多 5 層；每層 25% 更多攻速、半徑 +0.1 公尺、10% 更少移速 | 玩家周圍旋轉範圍環，疊層增加半徑，範圍內怪物逐一死亡 |
| 魔法師 | 冬季之球 | 引導累積至 8 層，冰球向附近敵人發射投射物並在落點爆炸 | 玩家上方冰球、飛行線、目標落點爆炸與附近怪物死亡 |
| 服事 | 贖罪烙印 | 附著敵人，每 0.1 秒增加能量，20 層時爆炸；50% 物理轉閃電 | 玩家至目標的烙印連線、0 至 20 能量、爆炸範圍與怪物死亡 |

## 來源

- https://poe.ninja/poe1/api/data/build-index-state
- https://poedb.tw/tw/Cyclone_of_Tumult
- https://www.poewiki.net/wiki/Winter_Orb
- https://www.poewiki.net/wiki/Penance_Brand
- https://www.poewiki.net/wiki/Righteous_Fire
