# Character Life & Social Simulation Roadmap

## Vision

角色不是玩家登入時才存在的工具，而是長期活在伺服器世界裡的居民。玩家關閉 WEB 後，角色仍會持續生活、移動、練功、解任務、社交與形成關係；WEB 是觀察與指揮角色的控制台，而不是傳統 RO Client。

核心體驗：

- 玩家不是「登入角色」，而是「連回一個一直活在伺服器世界裡的角色」。
- 玩家一覺醒來，可以看到角色昨天去了哪裡、做了什麼、跟誰組隊、打到什麼、跟誰越來越熟，甚至發展出戀愛關係。
- 關係與人生事件必須由真實遊戲事件累積而來，不以純隨機數字直接偽造劇情。

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
- 休息
- 找隊伍
- 找公會
- 社交

### Social Director
決定角色「要跟誰一起做」。

可能行為：
- 同地圖遇到熟人後主動組隊
- 對常見面角色提高組隊偏好
- 自動加好友
- 尋找適合自己的公會
- 私下約熟人一起練功
- 聊天與社交互動

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
1. Event Log / Daily Journal 基礎
2. Encounter / Interaction telemetry
3. Pairwise Relationship Graph
4. Party preference
5. Friend behavior
6. Guild discovery / join behavior
7. Social Director
8. Chat behavior
9. Mutual relationship progression
10. Romance
11. Life Director
12. One Active Character / Permanent Release
13. FREE_AGENT ownership
14. Karma / Fate Graph
15. Cross-generation re-encounter
16. Aging / Death / Generational systems

## Key Principles

1. 角色所有重要生活與社交結果，應由可追溯的真實遊戲事件推導，而不是直接由隨機劇情生成。
2. 玩家負責影響人生，而不是逐步操控人生。
3. 放棄角色是永久且不可逆的 ownership 轉移，不是刪除資料。
4. FREE_AGENT 後續人生不再屬於原玩家。
5. 因果影響相遇與行為傾向，但不能直接硬寫關係結果。
6. 戀愛、友誼、敵對都必須由雙方後續真實互動累積。
7. 世界必須保留玩家過去選擇造成的長期後果。

這份文件目前是未來產品方向紀錄，不代表已進入 Production Implementation。
