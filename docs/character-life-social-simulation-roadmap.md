# Character Life & Social Simulation Roadmap

## Vision

角色不是玩家登入時才存在的工具，而是長期活在伺服器世界裡的居民。玩家關閉 WEB 後，角色仍會持續生活、移動、練功、解任務、社交與形成關係；WEB 是觀察與指揮角色的控制台，而不是傳統 RO Client。

核心體驗：

- 玩家不是「登入角色」，而是「連回一個一直活在伺服器世界裡的角色」。
- 玩家一覺醒來，可以看到角色昨天去了哪裡、做了什麼、跟誰組隊、打到什麼、跟誰越來越熟，甚至發展出戀愛關係。
- 關係與人生事件必須由真實遊戲事件累積而來，不以純隨機數字直接偽造劇情。
- 角色白天由本地決策系統自主生活；LLM 只在低頻、重要的反思與語言層參與，不作為遊戲世界 authority。

## Target Architecture

### Life Director
決定角色「今天想做什麼」。

可能行為：
- 練功
- 解任務
- 補給
- 探索新地圖
- 賺錢 / 收集材料
- 整理倉庫
- 找隊伍
- 找公會
- 社交
- 在情緒或壓力改變時切換成較安全、較低強度或偏單人的活動

Life Director 採「先判斷動機，再選行為 / 地點」的方式，而不是只找最高效率地圖。

例如高等角色出現在低等地圖時，可能是因為：
- 陪低等朋友練功
- 幫助好友完成任務
- 尋找特定材料
- 與熟人約好見面
- 近期壓力高，主動選擇低風險活動

因此決策需同時考量成長、經濟、安全、任務、友情、社交、個性、情緒與記憶，而不是只看 EXP / hour。

### Social Director
決定角色「要跟誰一起做」。

可能行為：
- 同地圖遇到熟人後主動組隊
- 對常見面角色提高組隊偏好
- 自動加好友
- 尋找適合自己的公會
- 私下約熟人一起練功
- 聊天與社交互動

Social Director 不得把「看見其他角色」等同於「建立社交關係」。大多數陌生人應只是擦肩而過，只有有意義互動才逐步形成熟面孔、熟人、朋友或更深關係。

### Persistent Agent
負責把 Life/Social Director 的決策實際執行到 rAthena 世界：
- Navigation
- Combat
- Skill
- Loot
- Recovery
- NPC
- Service
- Quest
- Party / Friend / Guild / Chat（未來）

## Character Psyche Model

角色不使用單一「社交值」模擬人格，而是拆成長期穩定特質、背景、動態情緒與記憶。

### Stable Traits / Temperament

可參考心理學人格模型（例如 Big Five）作為底層數值，再用遊戲世界觀包裝成星座、出生背景、家庭與成長經歷。

可能欄位：
- extraversion / introversion
- agreeableness
- conscientiousness
- openness
- neuroticism / emotional sensitivity
- empathy
- risk_tolerance
- trust_threshold
- help_stranger_bias
- party_preference
- chat_frequency
- privacy_preference
- attachment_tendency
- competition_tendency
- loneliness_tolerance

星座可作為角色生成與敘事表現的一部分，但底層應轉換成可計算 trait，不直接用星座名稱硬寫行為。

### Background

出生或建立角色時可產生背景，例如：
- 成長地區
- 家庭背景
- 經濟條件
- 童年事件
- 重要恩人
- 曾遭背叛
- 過去失敗 / 成功經驗
- 初始價值觀

背景需轉成初始 trait、memory seed 或 sensitivity modifier，而不是只做裝飾文字。

### Dynamic Mood State

角色當下情緒是動態狀態，不等於人格。

可能欄位：
- energy / drive
- happiness
- stress
- loneliness
- confidence
- irritability
- curiosity
- social_desire
- security
- gratitude
- resentment

情緒由真實遊戲事件改變，例如：
- 連續死亡 → stress 上升、confidence 下降
- 升級 / 稀有掉落 → confidence / happiness 上升
- 長時間沒有熟人互動 → loneliness 上升
- 被陌生人救援 → gratitude / curiosity 上升
- 長時間社交 → social_desire 可能下降

外向不代表永遠想社交；內向也不代表永遠拒絕互動。人格是長期偏好，Mood 是短期狀態，兩者共同影響決策。

### Seasonal / Environmental Sensitivity

世界可有季節、天候、日夜等環境因素，但不得讓所有角色同步產生相同情緒。

可為角色設定不同敏感度，例如：
- season_sensitivity
- rain_preference
- night_preference
- crowd_tolerance

同樣的雨天，有人心情變好、有人變差、有人完全不受影響。

## Time / Rest Product Rule

目前方向：**角色世界不強制需要睡眠。**

理由：本產品仍然是放置遊戲，核心爽點是「玩家在睡覺，角色仍在替玩家生活與工作」。若角色被強制長時間休眠，會削弱持續成長與 persistent world 的體驗。

因此：
- 不把睡眠設成必要生理需求。
- 不採「現實 1 小時 = 遊戲 8 小時」這種全世界高速時間倍率。
- 世界時間可維持接近現實時間或獨立但穩定的時間軸，後續再定。
- 情緒、壓力、社交慾望可以改變角色活動類型，但不必迫使角色停止活動。
- 壓力高時可改成低風險練功、單人活動、補給、整理倉庫、較安全任務或其他低強度行為。

曾討論過「旅館休息並瞬間快轉角色個人 8 小時」方案，但目前不採為核心規則，避免產生 World Clock、Character Clock、年齡計算與放置收益之間不必要的複雜度。

## Encounter / Emergent Interaction Model

「巧遇 → 幫助 → 組隊 → 一起練功」不應由 scripted 劇情硬寫，而應由多個普通規則自然串起來。

範例流程：
1. 兩個角色各自因合理動機選擇同一張地圖。
2. 進入彼此感知範圍後產生 ENCOUNTER，但不一定建立 relationship。
3. 其中一人低 HP，另一人依技能、距離、風險、人格、關係與 help_stranger_bias 評估是否幫忙。
4. 若發生真實 Heal / Rescue，記錄 RESCUE_HEAL 等 interaction event。
5. 雙方仍有相同活動目標時，各自評估 party utility。
6. 雙方意願皆達門檻時才邀請 / 接受組隊。
7. 共同活動時間、共同擊殺、支援與後續互動才逐步建立 relationship。

核心原則：大多數陌生人只是擦肩而過。社會關係應呈現稀疏分布，而不是全服角色都變成高頻社交者。

## Interaction Event Log

角色的社會與情緒變化必須建立在 server-authoritative event 上。

可記錄：
- ENCOUNTER
- HEAL
- RESCUE_HEAL
- REVIVE
- PARTY_INVITE / ACCEPT / LEAVE
- SHARED_KILL
- SHARED_ACTIVITY_TIME
- QUEST_TOGETHER
- CHAT_INTERACTION
- TRADE
- FRIEND_ADD
- GUILD_ACTIVITY
- RELATIONSHIP_MILESTONE

例如「阿明在角色 HP 9% 時使用 Heal，之後共同練功 40 分鐘」應由 rAthena 真實事件推導，而不是由 LLM 想像。

Event Log 應支援：
- 可追溯
- idempotency
- 因果來源
- 時間戳
- actor / target
- 重要 context
- 後續 projection / rebuild

## Relationship Graph

每個角色與其他角色都維持獨立 pairwise relationship，而不是只有單一全域親密度。

建議欄位：
- familiarity：熟悉度
- trust：信任
- affinity：好感
- cooperation：合作默契
- romance：戀愛傾向

關係值應由真實互動事件累積，例如：
- 一起練功時間
- 組隊次數
- 同地圖相遇頻率
- 互相支援 / 治療 / 復活
- 一起完成任務
- 聊天頻率
- 私下組隊次數
- 同公會活動

禁止只用隨機事件直接增加關係，重要關係變化必須可追溯到真實 interaction events。

Relationship Graph 必須保持稀疏：只有達到有意義互動門檻才建立或保留 pairwise relationship，不能為每個看見過的陌生人建立完整關係資料。

## Social Behaviors

### Party
- 同地圖遇到適合角色時可主動邀請組隊
- 熟悉度 / cooperation 越高，未來再次組隊機率越高
- 常一起練功的角色可以形成穩定小隊

### Friends
- 達到一定互動門檻後可自動提出好友
- Friend state 與 relationship graph 分開；好友是社交關係，relationship score 是內部累積狀態

### Guild
- 角色可依等級、職業、活動習慣、熟人分布尋找公會
- 朋友或固定隊伍所在公會可提高加入偏好
- 未來可支援自主創建 / 加入 / 離開公會，但需另做權限與經濟規則

### Chat
- 角色可在合適情境聊天
- 聊天本身可增加 familiarity / affinity，但需要 rate limit 與內容安全機制
- 長期聊天與共同活動比單純大量訊息更能提高關係

## Romance

戀愛不建議只用「親密度 100」單條件觸發。

建議採 mutual relationship gate：
- 雙方 affinity 達高門檻
- 雙方 trust 達一定門檻
- shared activity 達門檻
- private party / interaction 達門檻
- 雙方皆符合 romance eligibility
- 沒有既有互斥關係

達成後可轉為 ROMANTIC relationship。

產品目標之一：
> 玩家重新打開 WEB 時，可能發現角色在玩家離線期間自然發展出戀愛關係。

## Daily Reflection / LLM Policy

LLM 不作為常駐決策引擎，也不應每幾秒或每個事件都被呼叫。

目前建議：**每個角色最多每天一次 Daily Reflection**，必要時再為重大事件設少量例外。

白天：
- Life Director / Social Director / Relationship Engine 使用本地規則與數值系統。
- rAthena 與 Persistent Agent 產生真實事件。
- Event Log 累積重要 interaction 與 gameplay facts。

每日結算時：
- 系統先將當日重要事件壓縮成結構化摘要。
- 提供角色 stable traits、background、昨日 mood、重要 relationship context、最近少量日記摘要。
- LLM 分析角色「今天如何感受」，並產生日記文字。
- LLM 只回傳受限 schema，不得直接修改 DB 或直接決定遊戲行為。

LLM 可輸出軟狀態建議，例如：
- stress delta
- loneliness delta
- confidence delta
- social_desire delta
- gratitude / disappointment / curiosity 等情緒分類
- 對少數重要人物的情緒 interpretation

最終數值更新仍由 server-side rule engine 驗證、裁切與寫入。

隔天 Life Director 可把 Mood State 當成決策輸入之一，但 LLM 不直接決定「明天去哪張圖、跟誰組隊、買什麼、送什麼」。

核心循環：

真實事件
→ 每日摘要
→ LLM Daily Reflection
→ 受限情緒 / 關係 interpretation
→ Server Rule Engine 更新 Mood / Memory
→ 隔日 Life/Social Director 使用這些狀態

這可同時達到：
- 每個角色具有連續心理脈絡
- 日記自然可讀
- API token 成本可控
- API 故障時核心遊戲仍可運作
- LLM 不成為遊戲世界 authority

長期日記不得每天把完整歷史全文重新送給 LLM。應採：
- 最近 3–7 天短摘要
- 重大人生事件永久摘要
- 特定人物相關記憶按需檢索
- 舊的一般日記逐步壓縮 / archive

## Daily Journal / WEB Experience

WEB 不只顯示 Lv / EXP，應提供「今天的冒險」摘要。

可能事件：
- 去了哪張地圖
- 練功多久
- 擊殺哪些怪物
- 打到哪些重要掉落
- 跟誰組隊
- 跟誰常一起練功
- 誰治療 / 復活過自己
- 加了誰好友
- 加入哪個公會
- 跟誰關係提升
- 是否形成戀人關係
- Daily Reflection 產生的角色主觀日記

範例：
- 09:12 前往斐揚洞穴練功
- 10:03 遇到某角色並組隊
- 10:47 兩人一起擊敗 182 隻怪物
- 11:05 對方使用治癒術支援
- 11:42 互加好友
- 15:08 再次一起練功
- 關係：familiarity 61 → 74

WEB 應讓玩家理解「角色在世界裡生活」，而不是只看到自動掛機數字。

## One Active Character / Permanent Release

產品方向：玩家同一時間只能控制一名現役角色，但「放棄角色」不等於刪除角色資料。

角色被玩家放棄後：
- ownership 永久從 PLAYER_OWNED 轉為 FREE_AGENT / WORLD_OWNED。
- 玩家帳號釋放 active character slot，可建立下一名角色。
- 舊角色保留等級、裝備、背包、任務歷史、朋友、公會、戀愛、名聲與世界紀錄。
- 舊角色繼續由 Life Director / Social Director / Persistent Agent 自主生活。
- 原玩家永遠不得重新 claim、恢復控制或把該角色重新綁回帳號。
- 此操作必須是不可逆決策，WEB 不應使用一般「刪除角色」語意。

建議玩家文案方向：
> 放棄控制權後，此角色不會被刪除，而會成為世界中的自由居民。你未來可能再次遇見他，但永遠無法重新取得控制權。

設計目的：避免玩家把放棄角色當作廉價 reroll 工具，並讓每一段角色人生對世界留下永久後果。

## Karma / Fate System

玩家放棄角色後，帳號與該 FREE_AGENT 之間保留不可逆的因果關係。新創角色不是單純與舊角色毫無關係，而可能因過往因果，以新的角度再次產生交集。

建議將「帳號」視為跨世代的 Soul / Player Identity，角色則是每一世的具體人生。

可追蹤的因果欄位：
- abandonment_karma：被放棄本身造成的因果影響
- memory_strength：舊角色對過往關係的記憶強度
- resentment：怨念 / 負向記憶
- gratitude：感激
- attachment：依戀
- fate_affinity：未來再次交集的傾向

因果值不應直接硬寫劇情，而應影響行為傾向與事件機率，例如：
- 更容易在同地圖活動
- 更容易再次遇見
- 更容易主動搭話
- 更容易組隊或拒絕組隊
- 更容易成為朋友、競爭者、導師、敵人或公會夥伴
- 更容易對新角色產生特殊熟悉感或情緒反應

核心原則：
> 角色可以被玩家放棄，但世界不會忘記。

## Past Character Re-encounter

被放棄的角色成為 FREE_AGENT 後，未來可從不同角度出現在同一玩家的新角色人生中。

可能關係：
- 偶遇的陌生人
- 練功夥伴
- 固定隊友
- 前輩 / 導師
- 公會夥伴
- 公會對手
- 競爭者
- 敵對角色
- 好友
- 戀人

重要設定：
- 玩家知道這是自己曾經控制過的角色。
- 新角色在世界觀內不必天然知道這段「前世」關係。
- 舊角色也不需要用超自然方式理解前世，而是由記憶、因果與真實新互動逐步形成新關係。
- 舊角色一旦自由，其後人生不再由原玩家決定。

這會形成一種特殊的情感體驗：玩家可能在多年後，用新角色再次遇見自己曾經放棄的人，而對方已擁有新的朋友、公會、人生甚至伴侶。

## Romance Across Generations

舊 FREE_AGENT 與同帳號後續新角色之間，允許自然發展成戀愛關係。

不得設定成「因果值高就自動戀愛」。因果只能提高再次交集、特殊關注與關係成長的機率。

真正 ROMANTIC transition 仍必須遵守一般 mutual relationship gate：
- 雙向 affinity
- 雙向 trust
- shared activity
- private interaction / party
- romance eligibility
- 既有伴侶與互斥規則

因此可能出現：
> 玩家曾經放棄的角色，在成為自由人後，若干時間後與玩家的新角色再次相遇、一起冒險，最後自然成為戀人。

這是未來產品極具辨識度的情境之一。

## Aging / Death / Generations

長期方向：角色會成長、老化，最終可能死亡。

但死亡不應等於玩家所有投入歸零。

可研究：
- 帳號倉庫繼承
- 部分財產 / 裝備繼承
- 家族聲望
- 成就與歷史保留
- 後代 / 繼承者
- 族譜
- 前代角色墓碑 / 世界紀錄

核心方向：
> 死亡 = 世代交替，而不是單純懲罰或清空帳號資產。

## Account Soul / Generational Model

長期可將資料概念分成：

Account Soul
├─ Generation 1 Character → FREE_AGENT / deceased
├─ Generation 2 Character
├─ Generation 3 Character
└─ Karma / Fate Graph
   ├─ past characters
   ├─ friends
   ├─ guild relations
   ├─ lovers
   ├─ rivals
   └─ descendants

同一時間玩家只直接控制一名現役角色，但世界中可同時存在該玩家過往世代留下的 FREE_AGENT 角色。

## Emergent Society Vision

最終可能形成：

玩家
→ 角色
→ 熟人圈
→ 固定隊伍
→ 公會
→ 好友
→ 戀愛關係
→ 家族 / 世代
→ FREE_AGENT 舊角色
→ 因果與跨世代再次相遇

目標不是做 scripted NPC 劇情，而是讓大量 Persistent Characters 在同一個 RO 世界中，透過真實活動形成 emergent social graph。

## Recommended Development Order

目前不要立即施工。本方向應排在 Persistent Server Agent / Eden / OpenKore reduction 主線穩定後。

建議順序：
1. Immutable Event Log / Daily Journal 基礎
2. Character Identity / Ownership / Soul contract
3. Encounter / Interaction telemetry
4. Character Psyche Model（traits / background / mood）
5. Pairwise Sparse Relationship Graph
6. Party preference
7. Friend behavior
8. Guild discovery / join behavior
9. Social Director
10. Chat behavior
11. Daily Reflection / LLM restricted schema
12. Mutual relationship progression
13. Romance
14. Life Director motivation-first decision layer
15. One Active Character / Permanent Release
16. FREE_AGENT ownership
17. Karma / Fate Graph
18. Cross-generation re-encounter
19. Aging / Death / Generational systems

## Key Principles

1. 角色所有重要生活與社交結果，應由可追溯的真實遊戲事件推導，而不是直接由隨機劇情生成。
2. 玩家負責影響人生，而不是逐步操控人生。
3. 放棄角色是永久且不可逆的 ownership 轉移，不是刪除資料。
4. FREE_AGENT 後續人生不再屬於原玩家。
5. 因果影響相遇與行為傾向，但不能直接硬寫關係結果。
6. 戀愛、友誼、敵對都必須由雙方後續真實互動累積。
7. 世界必須保留玩家過去選擇造成的長期後果。
8. 陌生人應是社會中的常態，大多數 encounter 不應自動形成 relationship。
9. 人格是長期偏好，Mood 是短期狀態；同一角色在不同日子可以做不同選擇。
10. 角色不需要強制睡眠；情緒與壓力改變活動內容，而非讓 Persistent Life 停止。
11. LLM 原則上每角色每天最多一次 Daily Reflection；不作為高頻決策引擎。
12. LLM 不得直接修改遊戲 authority 狀態，所有數值與行為仍由 server-side rule engine 裁定。
13. 世界不應是每個人都高頻社交；社交行為必須受到人格、情緒、關係、情境、冷卻與成本約束。
14. Life Director 必須可解釋「為什麼做這件事」，尤其是看似低效率但具有友情、任務或情緒動機的行為。

這份文件目前是未來產品方向紀錄，不代表已進入 Production Implementation。

## Product milestone dependency registration

This canonical long-term direction is registered behind the current execution
substrate order:

```text
M1 LOCAL_HUNTING_V1
-> M2 NOVICE_TO_EDEN_LV40_QUEST_AUTOMATION_V1 + QUEST_UI_V1
-> M3 CHARACTER_AUTONOMY_V1
```

`CHARACTER_AUTONOMY_V1` reuses the existing Local Hunting, PA Journey, Supply,
Quest Runtime and Social capabilities. It is a bounded high-level decision
layer that emits the next legal intent and delegates execution to the canonical
runtime. It does not become a second combat, quest, navigation or world runtime.

```text
M3_STATUS = DESIGN_ACCEPTED / IMPLEMENTATION_NOT_STARTED
PHASE4A_SOCIAL_NATIVE_LIFE_WORK = PAUSED / FUTURE_RECONNECT
ADMIN_AUTONOMOUS_CHARACTERS = CANONICAL_RUNTIME_ONLY
PLAYER_AUTONOMY = OFF / ON HIGH_LEVEL_DECISION_DIRECTION
```

Existing S｜Social Candidate / Encounter, N｜Native Projection / Acceptance and
L｜WORLD_OWNED / Life Director work remain design dependencies for M3 and later
Life/Social phases. This registration does not authorize their implementation.
