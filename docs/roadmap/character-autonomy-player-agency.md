# Character Autonomy / Player Agency

```text
DESIGN_ID = CHARACTER-AUTONOMY-PLAYER-AGENCY
STATUS = PLANNED
IMPLEMENTATION_AUTHORIZED = NO
DECISION_DATE = 2026-09-19
DOCUMENT_TYPE = CROSS-CUTTING PRODUCT DESIGN AUTHORITY
```

## 定位與適用範圍

本文件保存 2026-09-19 已確認的角色自主、玩家控制權、生活敘事、自主獨立、因果與跨世代產品決策。它約束未來的 Persistent Life、Life Director、Social Director、Autonomous Character、Player Web control、Diary / Memory、Relationship / Fate、`FREE_AGENT` / `WORLD_OWNED` 與 Character ownership transition 設計。

本文件是產品設計 authority，不是 runtime engine，也不取代 PL1 或 PL2。`PLANNED` 不代表施工授權；本文件不授權修改 runtime、Persistent Agent、Dashboard、DB schema 或 production。

既有 `docs/character-life-social-simulation-roadmap.md` 維持 LONG-TERM PRODUCT NORTH STAR 的歷史 canonical 原文。本文件獨立保存本次新決策，不改寫、不現代化、不覆寫該歷史文件。

## 1. Diegetic identity rule

`DIEGETIC_IDENTITY_RULE`：玩家就是角色本人。角色不知曉螢幕外存在玩家或操作者。玩家從 Web 發出的合法操作，在世界觀內均視為角色本人作出的明確、主動、有意識決定。

角色日誌、對話與記憶不得建立外部玩家第三人稱，也不得描述等待玩家、被玩家照顧、感知玩家存在或感謝玩家代操作。不存在 `PLAYER ↔ CHARACTER` 關係，亦不建立角色對外部玩家的 trust、attachment、gratitude 或 resentment。角色只能理解自己的人生、選擇、需求、情緒與記憶。

## 2. 明確決定與自主決定

```text
PLAYER_DECISION = deliberate conscious self-decision
AUTONOMOUS_DECISION = character continues living when no explicit deliberate Web decision is supplied
```

兩者屬於同一個角色。玩家決定角色人生的重要方向，角色決定自己如何經歷那段人生。

### PLAYER_DIRECTED

玩家從 Web 指定 Macro Goal，例如到斐揚洞穴掛機。角色持續尊重主要目標，但保留 Micro Autonomy，包括情緒反應、社交、對話、組隊判斷、補給期間生活行為、短暫休息、城鎮活動與合理的小型自主決策。插曲完成後回到 Macro Goal。

```text
PLAYER_DIRECTED != EMOTION_DISABLED
PLAYER_DIRECTED != SOCIAL_DISABLED
AUTO_FARM != CHARACTER_WITHOUT_PERSONALITY
```

### AUTONOMOUS

玩家主動選擇角色自主後，Life Director 才能自行選擇 Macro Goal，例如練功、賺錢、解任務、探索、找朋友、社交或低風險活動。活動必須同時受 traits、mood、memory、relationship、world state、current capability 與 server rules 約束。

### FREE_AGENT / WORLD_OWNED

玩家失去角色直接控制權後，角色仍持續存在、生活、成長與社交。ownership 改變不得刪除角色人生紀錄。

## 3. Offline / Life Summary

「你不在的這段時間」應呈現角色有意義的決定、經歷、原因，以及事件對感受與記憶的影響。它不重複 AUTO_FARM / Combat Statistics 的離線時間、擊殺數、物品數、NPC 互動、地圖變更或死亡統計。

未來名稱可為角色生活誌、最近發生的事、今日冒險或角色近況，UI 文案尚未定案。Browser 是否開啟不影響 Persistent Life 運行。掛機是角色當下的一件事，不能等同人格暫停或統計模式。

### Significance Filter

事件流採用：

```text
Raw Server Events
→ Significance Filter
→ Meaningful Life Event
→ Emotion / Memory
→ Diary / Narrative
```

普通擊殺通常不形成日記。極稀有掉落、首次擊敗重要怪物、死亡、救援、升級、關鍵任務完成與重要社交事件可成為 Emotion Event、Memory Event 或 Diary Event。數值與公式仍未定案。

## 4. PLAYER_DIRECTED 中的生活與社交

玩家指定掛機地圖後，角色仍可依 personality / traits、mood、existing relationship、familiarity、current activity、risk、party utility、social desire、cooldown 與 context 決定是否打招呼、回應、聊天、接受或拒絕組隊、認識熟人或短暫互動。看到人不代表必須互動，陌生人大多只是擦肩而過。

補給也是生活的一部分。回城補給期間可以休息、逛城鎮、遇到熟人、聊天或觀察周遭，完成後回到玩家指定 Macro Goal，不能永久背離主要目標。

## 5. Player Exclusive Actions

`PLAYER_EXCLUSIVE_ACTIONS` 指需要明確、有意識、自我決策的重大選擇，不代表 autonomous system 技術上無法執行。至少包括：

- 裝備穿脫與重要裝備配置
- Attribute Point allocation
- Skill Point allocation
- 插卡
- Build 方向
- 永久性或重大策略性道具使用
- 重要資產處置
- 主動放棄角色
- 其他重大不可逆決策

角色可以形成 Desire / Intention，例如認為武器不足或防禦需要調整，但 `DESIRE != AUTHORITY`，不得自行執行 Player Exclusive Action。

道具使用需拆分：TACTICAL / SURVIVAL CONSUMPTION 可由 autonomy 使用；PERMANENT / STRATEGIC ITEM DECISION 屬 Player Exclusive。紅水、補給品與生存消耗品可屬前者；插卡、永久能力型道具與重大資產物品屬後者。完整分類仍為 TBD。

## 6. Web Player Control Matrix

未來需盤點全部 Web control surface，但本文件不進行完整 runtime audit。分類至少包括：

| 分類 | 定義 |
| --- | --- |
| `PLAYER_EXCLUSIVE` | 只有真人可作出的重大決定 |
| `AUTONOMY_ALLOWED` | 角色可依合法能力自主執行 |
| `SHARED_WITH_CONSTRAINTS` | 玩家與角色皆可操作，受條件與權限約束 |
| `SERVER_AUTOMATIC` | 由 server authority 自動裁定 |

Social 行為不得預設全部屬於 Player Exclusive。

## 7. Character Self / Life State

因玩家就是角色，不建立 `PLAYER_CHARACTER_BOND`。未來可研究 `life_satisfaction`、`self_efficacy`、`frustration`、`fulfillment`、`agency`、`autonomy_preference`、`goal_progress`、`identity_alignment`、`confidence` 與 `stress` 等 Product Concept。這些名稱目前不代表 DB schema 授權。

角色提出需求後，若長期沒有以自己的明確行動處理，Life State 可以改變。需求被滿足時，可使 frustration 下降、confidence 與 life_satisfaction 上升。公式與數值 TBD。

需求不得做成每日登入懲罰、Login Streak 或 Tamagotchi punishment。只有長期缺乏重大主動決策、重要人生需求停滯且角色狀態逐步改變，才可能累積 Autonomous Independence。

## 8. Self-Emancipation 與 Warning

角色在極端且長期缺乏 deliberate self-direction 時，未來可能逐步由 PLAYER_CONTROLLED 轉為永久自主。候選狀態流程為：

```text
PLAYER_OWNED
→ AUTONOMY_RISK
→ SEPARATION_WARNING
→ SELF_EMANCIPATED_PROVISIONAL
→ WORLD_OWNED_FINAL
```

真正進入即將失去控制權前，玩家至少取得七天明確緩衝與警告。七天是 Final Warning Buffer，不代表七天不上線就失去角色。進入七天警告前，必須已有較長期且合理的 Life State / Autonomy progression。

DIEGETIC MESSAGE 與 SYSTEM WARNING 分層。角色世界內只表達逐漸習慣自己作決定；Web System Layer 才能清楚告知真人角色接近永久自主化，以及未重新產生有效 deliberate participation 的後果。

## 9. Voluntary Release 與 Self-Emancipation

### VOLUNTARY_RELEASE

玩家主動確認永久放棄角色。ownership 永久轉為 `FREE_AGENT` / `WORLD_OWNED`，原玩家不能重新 claim，操作不是普通刪除，原則上不可透過 Support 恢復。這是玩家主動且不可逆的決策。

### SELF_EMANCIPATION

角色因長期自主化離開帳號控制，並非玩家主動永久放棄。未來可設計 `SUPPORT_RECOVERY`，讓住院、現實事故、長期無法登入、帳號異常或其他合理特殊原因成為申訴情境。

`SELF_EMANCIPATED_PROVISIONAL` 可有 Support Recovery Window。超過尚未定義的條件後才可能進入 `WORLD_OWNED_FINAL`。若角色已建立重要新關係、固定隊伍、公會、戀愛或長期身份，強制綁回帳號可能破壞 Persistent World，因此 Finalization Gate 必須另行定義。

## 10. Ownership restore 與世界歷史

```text
RESTORE_OWNERSHIP != RESTORE_TIMELINE
```

管理員恢復角色控制時，只恢復 Control Authority，不 rollback 等級、裝備、財產、Diary、Memory、Relationship、Guild、Friends、Romance、World Events 或 Life Events。角色自主期間發生的事情全部保留。

未來可記錄 server-authoritative `CONTROL_AUTHORITY_RESTORED`，`reason = SUPPORT_OVERRIDE`。角色不理解管理員或玩家，只能以自身人生狀態理解新的 deliberate decision phase。

## 11. Karma / Fate 與跨世代

Karma / Fate 維持多維度，禁止用單一分數直接決定敵對、PK 或劇情。可沿用或擴充 `abandonment_karma`、`memory_strength`、`resentment`、`gratitude`、`attachment`、`fate_affinity`，完整 schema TBD。

同一帳號可形成 `ACCOUNT_SOUL → Character A → Character B` 的跨世代脈絡。系統與玩家知道歷史，但 Character A 與 B 不天然知道同一外部真人或同帳號前代角色，禁止第四面牆知識。

Karma / Fate 只能影響 encounter probability、attention、familiarity feeling、attraction / aversion、互動意願與未來行為傾向，不能直接寫死結果。真實 encounter、personality、mood、relationship、history、current circumstances、mutual decisions、world rules 與 server events 共同演化後，才可能形成冷淡、競爭、好友、敵對、戀愛或其他關係。

因果提高傾向與交集，不直接硬寫人生。`KARMA / FATE != SCRIPTED RESULT`。

## 12. Product conclusion

玩家就是角色本人。Autonomous System 的定位是：當真人沒有做出明確決定時，讓同一個角色仍依照已形成的人格、情緒、記憶、關係與人生脈絡，繼續在世界裡生活。

角色離開 Web 後仍是完整生命中的一個行動者。持續生活、掛機、社交與形成記憶的 authority 仍由 server rules、Persistent Agent 及未來 Life / Social Director 的合法邊界共同約束。

## 13. 未決事項，全部保留 TBD

- Self-Emancipation 實際累積時間
- 七天 Final Warning 以前的完整時間尺度
- Support Recovery Window 長度
- `WORLD_OWNED_FINAL` Finalization Gate
- 計入 meaningful deliberate participation 的 Web 行為
- Mood / Life State 欄位與參數權重
- 日記需求的重要度演算法
- Karma / Fate 完整 schema
- PK eligibility 與 server rules
- 完整 Player Control Matrix
- Life Director / Social Director 具體演算法
- UI 最終文案與名稱

以上項目在另有正式產品決策前，不得自行補充答案、建立 schema 或開始 runtime implementation。

## 14. Character Autonomy Engine 架構定位

本節記錄 2026-09-20 的 reference architecture。它只描述 Life Director / Social Director 上層自主決策如何組成，不建立第二套 Game Simulation。

```text
AUTONOMY_ENGINE != WORLD_SIMULATOR
AUTONOMY_ENGINE != SECOND_RATHENA
AUTONOMY_ENGINE != SECOND_PERSISTENT_AGENT
```

Autonomy Engine 只回答「角色現在想做什麼，以及在既有限制下下一步應提出什麼 Intent」。世界結果仍由既有 authority 裁定：

```text
rAthena / SERVER_AGENT = WORLD AUTHORITY
Persistent Agent       = GAMEPLAY EXECUTION AUTHORITY
Event Ledger           = FACTUAL HISTORY
LLM                    = INTERPRETATION / NARRATION / BOUNDED REFLECTION
```

### Reference flow

```text
DELIBERATE WEB DECISION
        ↓
CONTROL AUTHORITY
        ↓
CHARACTER AUTONOMY ENGINE
        ├ Character State
        ├ Psyche
        ├ Life Director
        ├ Social Director
        ├ Utility Evaluation
        ├ Goal Stack
        ├ HTN / Planner
        ├ Permission Policy
        └ Scheduler / Interrupt Manager
        ↓
Intent → Persistent Agent → rAthena → Real World Result
        ↓
Event Ledger → Significance / Emotion / Relationship / Memory
        ↓
Reflection / Diary / Narrative → feedback to Character State
```

## 15. Control Authority 與世界觀映射

Control Authority 回答「現在誰有資格決定 Macro Goal」。概念狀態包括 `PLAYER_DIRECTED`、`AUTONOMOUS`、`FREE_AGENT / WORLD_OWNED` 與 `ADMIN_OVERRIDE / SUPPORT_AUTHORITY`。

`ADMIN_OVERRIDE` 只處理 ownership、support recovery 與 administrative state transition，不代表管理員成為角色的 Life Director。

延續 `DIEGETIC_IDENTITY_RULE`，Audit 可記錄 `origin = WEB`，角色內部語意仍為 `actor = SELF`、`decision = DELIBERATE_SELF_DECISION`。禁止建立 `PLAYER told CHARACTER` 的世界觀模型。Web 加 STR 的技術來源可標為 Web，世界事實仍是角色自己作出明確決定。

## 16. Constraint-aware Autonomy

`PLAYER_DIRECTED` 仍啟用 Life Director 與 Social Director，只將玩家 Macro Goal 作為 Constraint。指定斐揚洞穴掛機時，Life Director 不得永久更換 `FARM / specified map`，但可處理情緒、社交、組隊、補給期間生活行為、短暫休息、城鎮互動與遇人反應。Micro Activity 完成後必須依 Return Contract Resume Parent Goal。

## 17. Life Director、Social Director 與決策模型

Life Director 負責 `WHY / WHAT NEXT`，輸出 `ACTIVITY_INTENT`，不直接操作座標、攻擊、喝水、NPC click 或 pathfinding。候選 Activity 可包括 `FARM`、`QUEST`、`EXPLORE`、`REST`、`SUPPLY`、`SOCIALIZE`、`EARN_MONEY`、`SAFE_ACTIVITY` 及未來授權活動。

Social Director 負責「要不要跟誰一起做或互動」，不成為第二套 Life Director。Life Intent 是繼續練功時，Social Director 才評估熟人互動、組隊、聊天或忽略。`INVITE != ACCEPT`，邀請雙方都必須經過各自的 Social Director / Policy。

目前 preferred direction：

```text
ALGORITHM_DIRECTION = UTILITY_AI
FORMULA = TBD
```

Utility AI 用 traits、mood、current goal、risk、growth need、economy need、social desire、relationship、memory、opportunity、environment 與 player-directed constraints 比較候選活動。公式、權重與 normalization 全部 TBD。

## 18. Planner、Goal Stack 與 Return Contract

目前 preferred planning architecture 為 HTN。Utility AI 負責 `WHAT / WHY`，HTN 負責 `HOW`，Persistent Agent 負責 `EXECUTE`。GOAP / ReGOAP 保留為 secondary reference，因目前產品需要可預期的階層、父目標、中斷、恢復與 bounded subgoal。

概念流程：

```text
FARM pay_dun
→ ensure readiness
→ travel
→ combat
→ supply when required
→ return town
→ optional life window
→ return pay_dun
→ resume farm
```

Goal Stack 範例：`PLAYER MACRO GOAL`、`REQUIRED SUBGOAL`、`OPTIONAL LIFE ACTIVITY`、`SOCIAL INTERRUPT`。Temporary / Micro Autonomous Activity 必須攜帶概念上的 Return Contract：`WHY`、`PARENT_GOAL`、`DURATION / COST BUDGET`、`INTERRUPTIBILITY`、`RETURN_CONDITION`、`RESUME_TARGET`。實際 schema TBD。

## 19. Permission Policy 與 Persistent Agent 邊界

Action Permission Policy 必須分開 `DESIRE`、`DECISION`、`AUTHORITY` 與 `EXECUTION`。角色想換武器時可保留 Desire，若 Policy 為 `PLAYER_EXCLUSIVE` 則 `EXECUTION_DENIED`；飲用生存藥水若為 `AUTONOMY_ALLOWED`，則可交由 Persistent Agent 執行。

Persistent Agent 維持 execution-focused，負責 Navigation、Combat、Loot、Supply、Recovery、Quest、Social Action 與既有 gameplay capability。人格、長期人生動機、情緒解讀、Relationship interpretation 與 Life choice 不塞回 Persistent Agent。

## 20. Character State 與五層資料分離

避免 Everything Context Blob。概念上分為：

| 層 | 內容 |
| --- | --- |
| Stable Identity | traits、temperament、background、values、risk tolerance、social tendency |
| Dynamic State | stress、confidence、happiness、loneliness、social_desire、frustration、fulfillment、life_satisfaction |
| Current Life Context | map、activity、macro goal、HP/SP、party、nearby actors、quest context、recent meaningful event |
| Long-term Context | memory、relationship、unfinished desire、important goal、guild、friends、romance、life trajectory |

以上是 Product Concept，不構成 DB schema authorization。

## 21. Fact、State、Intent、Memory、Narrative

五者不得互相取代：

| 層 | 定義 | 例 |
| --- | --- | --- |
| `FACT` | 發生過什麼 | 掉落稀有卡片 |
| `STATE` | 現在是什麼狀態 | happiness 高 |
| `INTENT` | 現在想做什麼 | 想再練一陣子 |
| `MEMORY` | 角色如何記得過去 | 記得第一次稀有掉落 |
| `NARRATIVE` | 角色如何描述它 | 對事件的主觀敘述 |

Event Ledger 是不可變事實，Memory 是角色對部分事件形成的持久認知。Memory 未來可研究 salience、decay、reinforcement、reinterpretation、actor association 與 episodic / summary classification，完整 schema TBD。

## 22. Significance、Emotion 與 Event Gateway

事件處理採：

```text
EVENT LEDGER
→ SIGNIFICANCE EVALUATION
→ LIFE EVENT
```

Significance 同時考量 event type、rarity、character history、expectation、relationship、current mood、personal values 與 prior memory。第一次死亡對新角色可能很重要，第 1000 次普通死亡可能較低，曾敵對者在危急時救援也可能很重要。演算法 TBD。

Emotion 只作 Decision Input，不直接硬寫 Action。Traits、Mood、Memory、Current Goal、Opportunity、Environment 與 Relationship 共同進 Utility Evaluation。

千人架構必須有概念上的 `AUTONOMY EVENT GATEWAY`：

| 分類 | 處理方向 |
| --- | --- |
| `IMMEDIATE_MEANINGFUL` | 死亡、稀有掉落、重要任務、組隊邀請 |
| `ACTIVITY_SUMMARY` | 500 次擊殺、完整補給、活動邊界 |
| `IGNORE_FOR_AUTONOMY` | 普通 hit、普通 damage、一般 monster movement |

禁止每次 HIT、DAMAGE 或 Monster Movement 都喚醒完整 Autonomy Engine。Transport 尚未決定。

## 23. Event-driven、Scheduler 與 Character Actor

禁止所有角色每秒完整重新思考人生。採 `EVENT-DRIVEN + SCHEDULED REEVALUATION`：

- Immediate Interrupt：死亡、HP danger、Party Invite、重要 whisper、稀有掉落、重大任務事件
- Activity Boundary：補給完成、旅行完成、任務階段完成、抵達城鎮、隊伍結束
- Periodic Reevaluation：boredom、social desire、life satisfaction、goal progress、activity continuation
- Daily / Low-frequency Reflection：diary、reflection、長期 psyche interpretation

一名 Persistent Character 對應一個主要 Character Actor / logical entity。Life Director、Social Director、Emotion、Planner 與 Memory 優先視為 Character Actor 內部 deterministic modules / services，不各自拆成爭奪控制權的 Actor。Character Actor 的責任是 identity boundary、state ownership、concurrency boundary、message serialization 與 lifecycle boundary。實際 cadence TBD。

## 24. Preferred Technology Candidate 與研究範圍

```text
CHARACTER AUTONOMY SERVICE = C# / .NET
VIRTUAL ACTOR CANDIDATE    = Microsoft Orleans
```

這是 preferred reference candidate，未授權安裝或實作。C# / .NET 的考量包括 strongly typed application model、async support、long-lived service suitability、Windows 開發環境相容、actor / persistence / scheduling ecosystem 與未來 scale-out potential。這些是設計考量，不是 benchmark 結論。

Orleans、Erlang / OTP、Apache Pekko、Utility AI implementations、Fluid HTN 或其他成熟 HTN implementations、GOAP / ReGOAP、BehaviorTree.CPP 與 OpenKore 均列為 reference study direction：

| Reference | 研究用途 |
| --- | --- |
| Microsoft Orleans | Virtual Actor、identity、lifecycle、persistence、timers、reminders、placement、failure handling |
| Erlang / OTP | supervision、process isolation、failure containment、restart strategy、message-driven design |
| Apache Pekko | actor model、cluster sharding、persistent entity、distributed placement |
| Utility AI | consideration scoring、response curves、normalization、inertia、hysteresis、避免 oscillation |
| Fluid HTN / mature HTN | hierarchical decomposition、partial planning、replan、interruption、observability |
| GOAP / ReGOAP | preconditions、effects、world-state planning、dynamic replanning；secondary reference |
| BehaviorTree.CPP | reactive execution、async action、interrupt、failure propagation、debugging；不得重寫 PA |
| OpenKore | RO automation、navigation、combat、supply、party、follow、reconnect、edge cases；不得恢復 runtime dependency |

在正式寫入 license、API capability、framework limitation、platform support 或 clustering semantics 前，必須查官方 Repository / 官方文件。無法確認時標記 `【資料不足，無法確認】`。

## 25. rAthena、Database 與 Scale-out 邊界

rAthena C++ 仍是 World Authority，不把 combat、damage、drop、inventory、quest authority 或 map authority 搬到 C#。Autonomy Service 只負責高階 decision、life state 與 planning。

```text
SCALE_TARGET = 1000+ persistent characters
SCALE_VALIDATED = NO
```

1000 個角色不等於每秒 1000 次完整 Think。若平均每 30 秒一次 Life reevaluation，概念平均約為 `1000 / 30 ≈ 33 evaluations / second`，這不是 benchmark。實際負載取決於 decision cadence、event volume、combat noise filtering、DB latency、Character State size、relationship density、PA execution、LLM usage 與 hardware。

維持 Sparse Relationship Graph；`Encounter != Relationship Allocation`，只有 meaningful interaction 才建立或保留 pairwise relationship。避免 unnecessary actor wakeups、excessive DB queries、relationship O(N²)、高頻 LLM 與 duplicated world simulation。

初期不預設更換 MariaDB。rAthena Game Authority State、Autonomy State、Event Ledger、Memory Projection、Relationship Graph 與 Diary / Reflection 需保持責任分離。Redis、PostgreSQL、specialized graph DB 與 message broker 皆為 `TBD / MEASUREMENT REQUIRED`。

## 26. LLM、Self-Emancipation 與 Fault Isolation

LLM 維持最外圍、低頻：`Event Summary → Daily / bounded Reflection → restricted interpretation → server rule validation`。LLM 不控制 movement、combat、drops、quest result，不直接修改 mood DB、relationship 或下一個 world action；LLM 不可用時核心遊戲仍須運作。

Self-Emancipation 不由 Emotion Engine 直接執行。正確邊界為：

```text
Life State
→ Autonomy Tendency
→ Eligibility
→ Governance State Machine
→ Warning
→ Authority Transition
```

Psyche 只能成為輸入，ownership 屬高權限 domain。未來 Autonomy Runtime 也必須具備 fault isolation，一名角色的 Planner / Actor 錯誤不得拖垮全部角色；具體 supervision 與 lifecycle 實作未決。

## 27. Architecture Anti-patterns

未來避免以下模式：

- 每個功能各自建立 AI，互相爭奪角色控制權
- Mood 直接執行 Action，混淆 `Mood` 與 `Decision`
- Life Director 直接操作 rAthena，跳過 `Intent → Persistent Agent → rAthena`
- 複製 movement、inventory、combat 或 quest truth，建立第二套世界模擬
- Every Event = Memory，跳過 Significance
- Every Character = Always Active，忽略 event-driven / scheduled activation
- 建立全矩陣 Relationship Graph，破壞 sparse graph
- 為了未來規模直接引入 Kubernetes、Kafka、NATS、Redis、Elasticsearch 或多套 microservices

原則為 `START SIMPLE → DESIGN FOR HORIZONTAL SCALE → SCALE ONLY WITH EVIDENCE`。

## 28. Preferred Reference Architecture Summary

```text
Dashboard / Web
→ Deliberate Self Decision
→ Control Authority
→ Character Actor
   → Character State
   → Utility Life Director
   → Social Director
   → HTN Planner
   → Goal Stack
   → Permission Policy
   → Scheduler / Interrupt
→ Persistent Agent
→ rAthena
→ Event Ledger
→ Significance / Emotion / Relationship / Memory
→ Daily Reflection / Narrative
→ feedback to Character State
```

```text
World Authority:          C++ / rAthena
Gameplay Executor:        Existing Persistent Agent
Autonomy Service Candidate:C# / .NET
Virtual Actor Candidate:  Microsoft Orleans
Life Decision:             Utility AI
Planner:                   HTN
Execution:                 Existing PA / rAthena
LLM:                       Low-frequency interpretation / narrative only
```

## 29. 本架構仍未授權實作

本文件新增的是 reference architecture 與 research direction。禁止因本文件安裝 Orleans、Pekko、BehaviorTree.CPP、HTN library 或任何 dependency；禁止建立 Autonomy Runtime、第二套 simulation、第二套 Persistent Agent 或 production integration。

所有實作仍須先通過既有 reuse gate、dependency evaluation、license verification、prototype / benchmark、integration boundary review 與 Project Control explicit authorization。

## 30. 架構未決事項

以下全部標記 `TBD / RESEARCH REQUIRED`：

- Orleans 是否正式採用
- Autonomy Service 是否獨立 process
- PA ↔ Autonomy transport
- Actor persistence provider
- actor state size 與 activation strategy
- decision / scheduler cadence
- Utility formula、HTN domain representation
- Event Gateway transport
- Memory schema 與 Relationship storage
- horizontal sharding、failover 與 deployment topology
- exact hardware requirement 與 verified 1000-character capacity
- Redis / broker 是否必要
- LLM provider / model
- Admin observability

不得自行補充上述答案。
