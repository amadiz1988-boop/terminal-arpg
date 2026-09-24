# RO World Context and Autonomy Research V1

研究狀態：`RESEARCH_ONLY`

研究日期：2026-09-21

工作線：`RO-LORE-WORLD-CONTEXT-RESEARCH-V1`

本報告整理 Ragnarok Online 的世界語境，供未來 Character Genesis、Life Director、Social Director 與 WORLD_OWNED context 使用。報告中的 lore 只提供 context、bias、meaning，不建立行為規則，也不取得 rAthena 的權威。

## 1. Source hierarchy and version boundary

| Tier | 使用方式 | 本輪來源 |
|---|---|---|
| Tier 1 | 官方或授權世界觀與地區說明 | GungHo Ragnarok Online 官方世界地圖、國家 Story Guide、職業頁、官方 episode 頁面 |
| Tier 2 | 實際遊戲內容與目前 server implementation | 專案鎖定的 rAthena 參考 `e985006171d2eb320ee512a653f4c83aea3d81b6`；目前 native checkout `ff72578f608935d1df5d664b3e9df9d436361043`；Renewal NPC、職業、Quest 與 map 來源 |
| Tier 3 | 外部 archival/reference | 本輪只用於交叉檢查城市功能，未用來覆寫 Tier 1 或 Tier 2 |
| Tier 4 | 產品映射與推論 | 以 `INFERENCE / PRODUCT POSSIBILITY` 明確標記 |

版本邊界：`game/ro/source.ts` 將專案的 rAthena 參考鎖定在 `e985006171d2eb320ee512a653f4c83aea3d81b6`。目前 native source checkout 位於另一個較新的 commit `ff72578f608935d1df5d664b3e9df9d436361043`。兩者保留為 `LORE_CONFLICT = YES` 的版本差異，沒有融合成單一 canonical timeline。未來實作前必須先選定 episode、region、Renewal／Pre-Renewal 與 source commit。

## 2. World overview

### 2.1 World structure

Tier 1 官方世界地圖把玩家生活的主要舞台描述為 Midgard continent，並以 Rune-Midgarts Kingdom 為中心。官方同時把世界分成 Rune-Midgarts、Schwartzvald Republic、Arunafeltz Theocracy、其他國家與 Ash Vacuum 等區域。地形包含草原、沙漠、森林、洞窟與地下城；地區特徵與當地出現的魔物相互對應。各城市設有職業轉職 guild 或 school。

可採用的高階結構如下：

| 區域 | Tier 1／Tier 2 已知定位 | Character-life 語境 |
|---|---|---|
| Rune-Midgarts | 大陸南部王國，首都 Prontera，地方城市各有文化 | 王權、教會、騎士、冒險者與跨城商旅 |
| Schwartzvald | 北東部共和國，工業、火藥、研究與魔法技術集中 | 工廠、企業、研究、階級差異與知識機構 |
| Arunafeltz | 崇拜 Freya 的宗教國家，Rachel 為首都 | 神殿、教義、荒地、牧民與宗教秩序 |
| Ash Vacuum | 魔王 Morroc 造成的時空裂隙後的異世界 | 三國聯合軍、前線基地、原生族群與未知資源 |
| 其他國家／島嶼 | Amatsu、Gonryun、Ayothaya、Umbala、Comodo、Malangdo 等 | 跨文化航路、地方語言、族群與島嶼社會 |

### 2.2 Historical context

官方 Rune-Midgarts Story Guide 記載 Geoborg Tristan I 與七名建國者建立王國，Geoborg 家長子承受 Jormungand curse，王國也有 Tristan III 失蹤、王位繼承與七王家平衡等當代政治脈絡。官方 episode 內容另外記載魔王 Morroc 復活、沙漠與城市受到破壞，以及多國冒險者和 guild 聯合對抗災難。這些內容可作為歷史語境與集體記憶來源，不能直接推導單一角色的命運。

官方 iRO Transcendent Classes 頁面以 Book of Ymir、Valkyries、Valhalla 與重生描述轉生傳統。這是官方服務版本的敘事證據，與現行各 region、episode 的實際任務順序未必相同。

### 2.3 Religion, magic and technology

1. Geffen 的官方定位是魔法城市，城市中心有 Geffen Tower，地下傳說與封印構成城市的危險記憶。
2. Rachel 是 Arunafeltz 的首都，Freya 大神殿位於城市北側，官方頁面把神殿與城市居民區、荒地、牧民土地放在同一個社會脈絡中。
3. Juno 是 Schwartzvald 的知識與政治中心，包含議事機構、Sage Castle、圖書館、魔法 academy 與 monster museum。
4. Schwartzvald 官方 Story Guide 明確記錄鐵鋼、火藥、工廠、研究機構與企業 Rekkenber 的衝突。科技、研究與企業權力可成為社會 context，不能成為角色固定的道德性格。
5. Umbala 官方頁面記錄 Wootan 族的樹上居所、木雕生計、獨特語言與對外來者的警戒。這是族群與地方生活證據，不能簡化為所有角色的 personality stereotype。

## 3. Regional and city context

下表只整理能支撐角色生活語境的高價值城市。移動方式與危險度取自官方頁面；人物理由則以「玩家角色為何合理前往或停留」的世界內解讀標記為 Tier 4。

| 城市 | 區域 | 已知社會角色與設施 | 合理停留／前往理由 |
|---|---|---|---|
| Prontera | Rune-Midgarts | 首都、王國中心、大聖堂、騎士團、王城、公園、露店與商人聚集 | 求職、教會服務、王國行政、交易、結伴與接受冒險委託 |
| Izlude | Rune-Midgarts | Prontera satellite、劍士修練場、剣士 guild、港口、通往 Alberta 的定期船、Arena | 劍士訓練、海運、競技、前往島嶼與港口城市 |
| Payon | Rune-Midgarts | 山岳森林城市、地方自治傳統、弓手村、Hunter Guild、Payon forest／cave | 弓手訓練、森林採集、地方任務、接觸較少受王權直接影響的社會 |
| Geffen | Rune-Midgarts | 魔法城市、魔法學校、Magician Guild、Geffen Tower、酒館與工匠設施 | 魔法學習、研究古代遺跡、工藝交易、處理塔與地下遺跡風險 |
| Alberta | Rune-Midgarts | 海外貿易港、船運、商人組合、精鍊所、通往多個海外地區的 NPC | 貿易、航行、商業、跨文化交涉與海上冒險 |
| Morocc | Rune-Midgarts | Sograt Desert oasis；官方記載城市曾受魔王 Morroc 破壞，居民在 Pyramid 周邊避難；Continental Guard 與 Thief job NPC 在此活動 | 災後生存、沙漠交通、保安、遺跡探索、Thief guild 社會 |
| Aldebaran | Schwartzvald 南端 | 運河與風車供水、Alchemy Guild、Kafra 本社、Clock Tower | 水利與物流、煉金術、倉儲服務、調查時計塔危險 |
| Juno | Schwartzvald | 共和國首都、議事機構、Sage Castle、圖書館、魔法 academy、monster museum | 政治與知識、學術、研究、跨區域情報與飛空艇交通 |
| Lighthalzen | Schwartzvald | 官方世界地圖將其定位為企業城市；相關 episode 與 rAthena 內容連結到 Bio Lab 與企業研究脈絡 | 工業與企業工作、研究、調查、貧民區與企業權力衝突 |
| Rachel | Arunafeltz | Freya 大神殿、宗教首都、荒地與牧民土地；陸路危險，飛空艇是較安全的路徑 | 朝聖、神殿服務、宗教政治、護送與前線交通 |
| Veins | Arunafeltz | 峽谷城市，鄰近火山與危險 field | 採礦、護送、火山調查與高危險任務 |
| Comodo | Rune-Midgarts | 南端海邊洞穴城市，舞者轉職場地、酒吧、casino；王國禁賭規則下的特殊例外 | 表演、賭博、海邊生活、洞窟探險與非主流社交 |
| Umbala | Rune-Midgarts | Wootan 族村落，樹上住宅、木雕、獨特語言與文化、Yggdrasil trunk | 族群交流、木工交易、探索樹與森林，須尊重地方信任邊界 |

主要交通語境包含 Kafra 空間移動、船、飛空艇、步行 field route、沙漠危險路線與異世界裂隙。交通費用、路線與地圖結果仍由 server authority 裁定。

## 4. Organizations and institutions

| 組織／機構 | Tier 1／Tier 2 證據 | 角色生命意義 |
|---|---|---|
| Rune-Midgarts 王國、王城、騎士團 | Prontera 官方城市頁、王國 Story Guide | 法律、軍事、王權與公共危機記憶 |
| Prontera 大聖堂 | 官方城市頁；Acolyte script 位於 `prt_church` | 信仰服務、婚姻、救濟、牧職與教會網絡 |
| 六大初階職業 guild | Renewal `npc/re/jobs/1-1/*.txt`、官方職業頁 | 受訓、考試、社會身份與師徒關係 |
| Kafra Service | 官方城市頁與 Kafra HQ 說明 | 倉儲、保存點、跨城移動與日常商業基礎設施 |
| Eden Group | Renewal `npc/re/quests/eden/eden_common.txt`、`eden_tutorial.txt`、各等級任務檔 | 冒險者媒合、委託、訓練與跨城任務網 |
| Rekkenber | Schwartzvald 官方 Story Guide、Lighthalzen 相關 episode | 研究、企業權力、勞動與社會不平等的 context |
| Midgard Alliance Camp | 官方 Ash Vacuum world map | 多國聯合、前線補給、跨族群協作 |
| Cat Paw Merchant Association | `npc/re/quests/quests_malangdo.txt` | 海島商業、投資、商人網絡與跨種族交易 |
| Continental Guard | `npc/re/quests/quests_morocc.txt` | 邊界管制、危險告知、進入許可與公共安全 |
| Player guild | 官方 guild system 說明；rAthena guild scripts | 長期社會連結、職位、互助、同盟與敵對關係 |

## 5. Class and profession identity

職業身份以「訓練場所、組織、任務語言與社會功能」整理。以下內容是職業文化的 evidence，不是 personality stereotype。

| 初階職業線 | 訓練／轉職位置 | 世界語境與價值線索 | 可供 context 使用的欄位 |
|---|---|---|---|
| Swordman | Izlude Swordman Guild | 近戰、防衛、訓練、武器與身體耐力；官方職業頁強調高 HP 與多種近戰武器 | `profession_identity`, `training_place`, `defense_experience` |
| Magician | Geffen Magic School／Mage Guild | 元素魔法、學習、考試、魔法研究；低 HP 與距離戰鬥是玩法特性，不是人格 | `school_affinity`, `magic_study`, `research_memory` |
| Archer | Payon Archer Guild／弓手村 | 森林、遠距離、集中訓練、Hunter Guild；可形成環境熟悉度與訓練記憶 | `forest_familiarity`, `ranged_training`, `guild_contact` |
| Acolyte | Prontera Church | 服事神、治療、協助有需要的人；script 以「become a servant of God」建立職業承諾語境 | `faith_context`, `care_practice`, `church_contact` |
| Thief | Morocc Pyramid 周邊 Thief Guide | 沙漠城市、秘密 pub、潛行與生存技巧；不可推論為天生不誠實 | `desert_familiarity`, `stealth_training`, `underworld_contact` |
| Merchant | Alberta Merchant Guild | 航運、資本、交易、手工與市場協商；Merchant script 也呈現商業倫理與價格判斷 | `trade_network`, `craft_practice`, `market_memory` |

二轉與特殊職業可延伸為「職業組織與經歷」的 context，例如 Knight／Crusader 對王國與教會、Wizard／Sage 對學術、Blacksmith／Alchemist 對工坊與研究、Assassin／Rogue 對秘密網絡、Hunter／Bard／Dancer 對地方表演與野外專業。正式採用前仍需逐職業查核當前 Renewal script 與官方 region 版本。

## 6. Representative NPC and Quest lore

| 案例 | WORLD_FACT | SOURCE | WHY_IT_MATTERS_TO_CHARACTER_LIFE |
|---|---|---|---|
| Izlude 的 Edgar's Offer | Izlude 與 Alberta 由港口連結；船長可提供付費或折扣航程，對話提到家人與船員生涯 | Tier 2 `npc/re/quests/quests_izlude.txt`；Tier 1 Izlude／Alberta 官方頁 | 交通是社會關係與金錢交換，角色可記得某條航線與一位熟人 |
| Morocc Continental Guard | Guard 以異常時空現象為由封鎖區域，進入前明示由冒險者自行承擔風險 | Tier 2 `npc/re/quests/quests_morocc.txt` | 危險地不是單純刷怪點，角色可形成「被警告後仍選擇進入」的事件記憶 |
| Eden Group | Eden scripts 提供分級委託、冒險者導引、地圖與物品目標 | Tier 2 `npc/re/quests/eden/`；Tier 1 官方 Academy／restart guide | 冒險者生涯有組織化入口，委託與城市移動可形成社會履歷 |
| Geffen 工匠 | Welding Mask script 描述資深 Blacksmith、長期鍛造與工坊安全需求 | Tier 2 `npc/quests/quests_geffen.txt`，目前 loader 狀態需另核對 | 工匠知識可成為 apprenticeship 或 craft memory；不代表所有 Merchant／Blacksmith 性格相同 |
| Payon Granny | Granny 採集山中蘑菇、為孫輩節慶衣物尋找材料 | Tier 2 `npc/quests/quests_payon.txt`，目前 loader 狀態需另核對 | 小型生活請託揭示家庭、季節、採集與地方互助 |
| Glast Heim Hugin follower | NPC 描述 Old Glast Heim 的 dark force、時間與次元，並依危險程度收取不同費用 | Tier 2 `npc/re/quests/quests_glastheim.txt` | 遺跡是有歷史與風險的工作場所，探索選擇可留下 memory seed |
| Dicastes entrance | Entrance Manager 以 Sapha 身份與邀請條件控制進入 El Dicastes | Tier 2 `npc/re/quests/quests_dicastes.txt` | 族群身份、通行權與信任可作 social context，不應被轉成永久敵我規則 |
| Malangdo Cat Paw | Cat Paw Merchant Association 透過帳戶、投資與物品條件建立商業互動 | Tier 2 `npc/re/quests/quests_malangdo.txt` | 商業網絡可支持交易記憶與組織 affinity |

## 7. Monster and dungeon context

| 地點／魔物語境 | 已知事實 | 可保存的意義 |
|---|---|---|
| Prontera Culvert | 舊官方轉換 script 描述水道蟲害、污染風險與王國隔離令 | 城市基礎設施危機、公共衛生與志願防衛；需先確認當前 server 是否載入此 legacy script |
| Geffen Tower／Geffenia | 官方頁面把 Geffen Tower 與古代遺跡傳說連結；Geffenia 需 The Sign quest 且入口隨機 | 魔法遺跡、資格與團隊探索，不等同固定練功地點 |
| Morocc／Pyramid／Dimensional Rift | 官方頁面記載魔王復活造成城市破壞、居民在 Pyramid 周邊避難，並將周邊 field 標為危險 | 災後都市、避難、保安與禁區記憶 |
| Aldebaran Clock Tower | rAthena script 描述能扭曲時間與記憶的怪物、分層危險與付費進入 | 時間異常、記憶不可靠與高風險探索；屬事件語境，不是角色必然創傷 |
| Old Glast Heim | rAthena script 描述 dark force、Hugin 與跨時間／次元探索 | 古代遺跡、考古與危險知識的 memory seed |
| Ash Vacuum | 官方頁面記載時空裂隙、三國聯合軍、Splendide、Manuk、El Dicastes、Mora、Yggdrasil interior 與 Scaraba | 前線、外交、族群協作、資源調查與未知道路 |
| Umbala／Yggdrasil trunk | 官方頁面記載 Wootan 村、木雕生計、獨特語言與巨大樹的寶物傳聞 | 族群文化、資源傳聞與對外來者的信任邊界 |

怪物存在原因只有在官方 episode、NPC script 或地圖內容明確說明時才可寫入 lore fact。單看 mob name、level、spawn 或 EXP 不足以證明生態、歷史或居民觀點。

## 8. Character-life-relevant lore facts

1. 角色出生地可以保存為 `origin_region` 與 `familiarity_seed`，只影響熟悉度與可回憶 context。
2. 第一次在城市接受職業訓練可以保存 `profession_training_memory`、`mentor_or_guild_contact` 與 `place_memory`。
3. 實際完成的航程、Guard 警告、NPC 請託、研究、交易與救援可以成為 Event Ledger 的 factual memory。
4. 角色曾在 Rachel 神殿、Juno library、Aldebaran Kafra HQ、Alberta harbor、Malangdo 商業網絡停留，可形成社會 contact 與地點偏好。
5. Quest 的動機可引用角色已知的地方問題、組織請託、親友關係或曾經歷的危險；動機不能跳過 server quest prerequisite。
6. 職業文化可作為語境和候選 affinity，例如「受過 Geffen 魔法學校訓練」；不可寫成「所有 Magician 都必然喜歡研究」。

## 9. Autonomy hook candidates

| LORE_FACT | SOURCE_TIER | POSSIBLE_AUTONOMY_USE | IMPLEMENTATION_RECOMMENDED |
|---|---:|---|---|
| 出生城市與實際長期停留 | 2／4 | `GENESIS`, `FAMILIARITY`, `MEMORY_SEED` | LATER |
| 職業 guild 與訓練地 | 1／2 | `GENESIS`, `SOCIAL_CONTEXT`, `PROFESSION_CONTEXT` | LATER |
| 已完成航程、交易、護送、Guard 警告 | 2 | `MEMORY_SEED`, `SOCIAL_CONTEXT`, `QUEST_CONTEXT` | YES，僅作事件投影 |
| 城市文化標籤，例如港口、神殿、工業、森林 | 1 | `LIFE_DIRECTOR_CONTEXT`, `FAMILIARITY` | LATER |
| 組織關係，例如 Eden、Kafra、guild、Cat Paw | 1／2 | `SOCIAL_CONTEXT`, `MOTIVATION` | LATER |
| 災難與遺跡背景 | 1／2 | `MEMORY_SEED`, `QUEST_CONTEXT`, `MOTIVATION` | LATER |
| Monster level、EXP、掉率 | 2 | `NONE` 作為 lore；由 gameplay planner 另行處理 | NO |
| 「某職業一定有某性格」 | 4 | `NONE` | NO |
| 官方未描述的出生家庭、政治立場、心理創傷 | UNKNOWN | `NONE`，等待新證據 | NO |

產品映射規則：`Lore Context → Director intent proposal → Persistent Agent capability → rAthena authority`。Lore subsystem 不得控制 combat、movement result、drop、quest completion、item、地圖座標或重生結果。

## 10. Anti-scripted-story guard

可接受的表述：

`角色曾在 Morocc 避難營完成護送事件，因此對 Pyramid 周邊較熟悉，往後遇到相關請託時提高注意。`

不可接受的表述：

`角色來自 Morocc，所以命中注定要成為討伐魔王的英雄。`

前者由已發生的 server event 與有限 context 組成，後者把 lore 變成預寫命運。WORLD_OWNED 的人生必須由真實遊戲事件持續形成。

## 11. Unsupported or uncertain claims

以下目前保持 `【資料不足，無法確認】`：

1. 所有城市的一致法律、稅制、婚姻、家庭與教育制度。
2. 每個職業 guild 的完整師徒制度、階級與日常生活。
3. 各版本 Midgard 大陸的單一、無衝突時間線。
4. 各地居民對魔物的完整生態觀、飲食、語言與民間信仰。
5. 角色出生地與實際 server 起始地之間是否存在 canonical 關係。
6. 任何未由官方內容、當前 rAthena script、client asset 或實際 quest event 證明的 NPC 心理與政治動機。
7. `npc/quests/quests_prontera.txt`、`quests_geffen.txt`、`quests_payon.txt` 等舊 script 是否在本專案目前 Renewal loader 中啟用。它們可以作歷史 reference，不能直接當成 current runtime fact。

## 12. Lore conflicts

| CONFLICT | 影響 | 處理 |
|---|---|---|
| 官方現行網站包含較新的 4th job、episode 與地區；專案 rAthena reference 鎖在舊 commit | 職業、任務與城市可用性不一致 | 研究記錄 source date、region、episode、commit；實作前選版本 |
| `game/ro/source.ts` 鎖定 `e985006...`；native checkout 為 `ff72578...` | 目前 source 與專案 reference lineage 不同 | 保留兩條 evidence lineage，禁止 silent merge |
| 官方城市頁描述完整世界；rAthena script 會載入子集或自訂分支，實際範圍待核對 | lore 存在不代表當前 server 可互動 | 以 `scripts_athena.conf`、NPC scope 與實際 quest state 再驗證 |
| 舊 script 標記 `[Official Conversion]`，但版本、loader 與 region 未必一致 | 不能把 script header 當成現行官方 canon | 標為 Tier 2 historical，等待 loader 與 runtime confirmation |
| Morocc、Rachel、Ash Vacuum 等 episode 的官方敘事與地圖狀態會隨版本變化 | 角色記憶需要時間點 | Event Ledger 必須保存發生時的 map、quest、source version |

## 13. Recommended next research

1. Project Control 先決定一個可執行的 lore baseline：region、episode、Renewal／Pre-Renewal、rAthena commit 與 official source region。
2. 以 Prontera、Morocc、Geffen、Payon、Alberta、Rachel、Juno 七城各做一次 bounded city dossier，逐一核對官方頁、當前 loader、NPC scope、map 與 quest state。
3. 建立六大初階職業的 source matrix，加入職業 guild、轉職條件、任務對話、二轉延伸與當前 server 可達性。
4. 從 Eden、Morocc、Glast Heim、Ash Vacuum、Malangdo 各選一條代表 quest flow，建立 `WORLD_FACT → EVENT_LEDGER_EVIDENCE → POSSIBLE_CONTEXT` 對照。
5. 對需要跨版本的 Ymir、Valhalla、Morocc、Jormungand、Rekkenber、Freya 故事建立 conflict records，不把不同 region 的內容合成單一事實。
6. 只有在上述 baseline 固定後，才設計唯讀的 world-context data contract；第一版只允許查詢 context，不允許寫入 behavior rule。

## 14. References

### Tier 1 official

1. [Official world map](https://ragnarokonline.gungho.jp/gameguide/worldmap/)
2. [Prontera](https://ragnarokonline.gungho.jp/gameguide/worldmap/prontera.html)
3. [Izlude](https://ragnarokonline.gungho.jp/gameguide/worldmap/izlude.html)
4. [Payon](https://ragnarokonline.gungho.jp/gameguide/worldmap/payon.html)
5. [Geffen](https://ragnarokonline.gungho.jp/gameguide/worldmap/geffen.html)
6. [Alberta](https://ragnarokonline.gungho.jp/gameguide/worldmap/alberta.html)
7. [Morocc](https://ragnarokonline.gungho.jp/gameguide/worldmap/morocc.html)
8. [Aldebaran](https://ragnarokonline.gungho.jp/gameguide/worldmap/aldebaran.html)
9. [Juno](https://ragnarokonline.gungho.jp/gameguide/worldmap/yuno.html)
10. [Rachel](https://ragnarokonline.gungho.jp/gameguide/worldmap/rachel.html)
11. [Comodo](https://ragnarokonline.gungho.jp/gameguide/worldmap/comodo.html)
12. [Umbala](https://ragnarokonline.gungho.jp/gameguide/worldmap/umbala.html)
13. [Rune-Midgarts Story Guide](https://ragnarokonline.gungho.jp/special/storyguide/rune-midgarts/)
14. [Schwartzvald Story Guide](https://ragnarokonline.gungho.jp/special/storyguide/schwartzvald/)
15. [Ash Vacuum](https://ragnarokonline.gungho.jp/gameguide/worldmap/ash-vacuum/)
16. [Official character and job guide](https://ragnarokonline.gungho.jp/gameguide/character/)
17. [Swordman](https://ragnarokonline.gungho.jp/gameguide/character/swordman/swordman.html) and [Magician](https://ragnarokonline.gungho.jp/gameguide/character/magician/magician.html)
18. [Official guild guide](https://ragnarokonline.gungho.jp/gameguide/system/guild.html)
19. [Official Morocc episode](https://ragnarokonline.gungho.jp/gameguide/episode/morocc.html)
20. [iRO Transcendent Classes and Book of Ymir](https://iro.ragnarokonline.com/news/updatedetail.aspx?id=136)

### Tier 2 project and rAthena

1. Project source lock: `game/ro/source.ts`.
2. Current native source: `C:\Users\Administrator\source\ghost-island-rathena`, commit `ff72578f608935d1df5d664b3e9df9d436361043`.
3. Renewal loader: `npc/re/scripts_athena.conf`, `npc/re/scripts_jobs.conf`.
4. Initial job scripts: `npc/re/jobs/1-1/acolyte.txt`, `archer.txt`, `mage.txt`, `merchant.txt`, `swordman.txt`, `thief.txt`.
5. Current representative scripts: `npc/re/quests/quests_izlude.txt`, `quests_morocc.txt`, `quests_glastheim.txt`, `quests_dicastes.txt`, `quests_malangdo.txt`, `npc/re/quests/eden/`.
6. Historical city scripts requiring loader verification: `npc/quests/quests_prontera.txt`, `quests_geffen.txt`, `quests_payon.txt`.
7. Project authority notes: `docs/rathena-reference/source-map.md`, `docs/rathena-reference/quest-automation.md`.

## 15. Final report

```text
WORLD_CONTEXT_RESEARCH = COMPLETE_RESEARCH_REPORT
SOURCE_TIERS_USED = TIER_1, TIER_2, TIER_4; TIER_3 CROSS-CHECK ONLY
REGIONS_COVERED = Rune-Midgarts, Schwartzvald, Arunafeltz, Ash Vacuum, selected overseas regions
CITIES_COVERED = Prontera, Izlude, Payon, Geffen, Alberta, Morocc, Aldebaran, Juno, Lighthalzen, Rachel, Veins, Comodo, Umbala
ORGANIZATIONS_COVERED = Kingdom, Church, Knight Order, six first-job guilds, Kafra, Eden Group, Rekkenber, Midgard Alliance, Continental Guard, Cat Paw, player guilds
CLASS_LINES_COVERED = Swordman, Magician, Archer, Acolyte, Thief, Merchant; selected second-job extension points
QUEST_NPC_CASES = 8 representative cases
DUNGEON_MONSTER_CASES = Prontera Culvert, Geffen Tower/Geffenia, Morocc/Pyramid/Rift, Clock Tower, Old Glast Heim, Ash Vacuum, Umbala/Yggdrasil
HIGH_VALUE_AUTONOMY_HOOKS = origin familiarity, guild training, actual travel, organization contact, local request, hazard warning, factual event memory
GENESIS_HOOKS = origin_region, profession_training_place, initial organization context
LIFE_DIRECTOR_HOOKS = geography, city function, hazard and route context, organization requests
SOCIAL_HOOKS = guild, Kafra, Eden, church, merchants, guard, Cat Paw contacts
MEMORY_HOOKS = completed travel, NPC request, warning, rescue, trade, apprenticeship, dungeon expedition
LORE_CONFLICTS = YES; source commit, episode, region, loader and timeline differences recorded
UNSUPPORTED_AREAS = exact birth culture, full law/family systems, unified timeline, unproven ecology, NPC psychology
FILES_CHANGED = docs/research/ro-world-context-autonomy-v1.md
GIT_CHECKPOINT = COMMIT_CREATED_AFTER_REVIEW; exact file only
PRODUCTION_TOUCHED = NO
RUNTIME_RESTARTED = NO
READY_FOR_PROJECT_CONTROL_REVIEW = YES
```
