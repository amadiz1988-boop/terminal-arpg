# RO 官方戰鬥音效對照

## 來源紀錄

- sourceGame: Ragnarok Online 台灣官方客戶端
- sourceUrl: `local://C:/Program Files (x86)/Gravity/RagnarokOnline/data0.grf`
- version: `2026-09-10` 本機安裝檔快照
- verifiedAt: `2026-09-11T20:27:18+08:00`
- status: `verified`
- archiveSha256: `913402ace1d3c67818b4f070650a07eb157a6d62df9e394d596d59b4c7e6678a`
- notes: 音檔由使用者已授權的官方客戶端 `data0.grf` 擷取。每個輸出檔的來源路徑、大小與 SHA-256 記錄於 `public/ro/client/sfx/official/combat-manifest.json`。

## 玩家武器聲音

| 類型 | 揮擊 | 命中 |
| --- | --- | --- |
| 短劍 | `_attack_dagger.wav` | `_hit_dagger.wav` |
| 單手劍 | `_attack_sword.wav` | `_hit_sword.wav` |
| 鈍器 | `_attack_mace.wav` | `_hit_mace.wav` |
| 法杖 | `_attack_rod.wav` | `_hit_rod.wav` |
| 弓 | `_attack_bow.wav` | `_hit_arrow.wav` |
| 斧 | `_attack_axe.wav` | `_hit_axe.wav` |
| 空手 | 無獨立揮擊音 | `_hit_fist1.wav` 至 `_hit_fist4.wav` 輪替 |

裝備判定優先讀取右手裝備的 Aegis 名稱與顯示名稱；無法辨識時依一轉職業選用武器類型。二刀連擊播放一次短劍揮擊、兩次短劍命中與兩次目標受傷音，兩次命中相隔 347 毫秒。

## 南門怪物 ACT 對照

| 怪物 | 攻擊 | 受傷 | 死亡 |
| --- | --- | --- | --- |
| Poring | `poring_attack.wav` | `poring_damage.wav`，ACT 偏移 100ms | `poring_die.wav`，ACT 偏移 25ms |
| Lunatic | `lunatic_attack.wav` | ACT 無聲音觸發 | `lunatic_die.wav`，ACT 偏移 75ms |
| Fabre | `fabre_attack.wav` | `monster_insect.wav` 與 `fabre_damage.wav` | `fabre_die.wav`，ACT 偏移 100ms |
| Pupa | ACT 無獨立攻擊音 | `monster_shell.wav` 與 `peco_egg_heartbeat.wav` | `pupa_die.wav` |
| Little Poring | `poring_attack.wav` | `poring_damage.wav`，ACT 偏移 100ms | ACT 無聲音觸發 |
| Drops | 沿用 Poring 音組 | 沿用 Poring 音組 | 沿用 Poring 音組 |

對照依據是各怪物 `.act` 內的聲音索引、動作分組與影格位置。保留 ACT 的無聲事件，避免為瘋兔受傷、小波利死亡與蛹攻擊補入不存在的音效。

## 玩家介面事件

| 介面事件 | 官方音檔 | 接入位置 |
| --- | --- | --- |
| 確認／一般操作 | `se_ding1.wav` | 一般按鈕 |
| 取消／停止／登出 | `se_ding2.wav` | 停止與離開按鈕 |
| 頁籤與背包分類 | `se_turn_page01.wav` | 頁籤切換 |
| 視窗開啟／收合 | `se_top.wav`／`se_top2.wav` | 可收合視窗按鈕 |
| 撿取道具 | `itempokjuk.wav` | 戰鬥紀錄取得物品事件 |
| 丟棄道具 | `drop_effect_1.wav` | 戰鬥紀錄丟棄事件 |
| 穿脫裝備 | `se_equip_item_01.wav` 至 `07.wav` | 雙擊裝備與卸下 |
| 使用藥水 | `se_drink_potion.wav` | 道具使用事件 |
| 使用蒼蠅翅膀 | `ef_teleportation.wav` | 道具使用事件 |
| 地圖傳送／換圖 | `warp.wav` | 地圖變更事件 |
| 治癒 | `ef_healsp.wav` | 治癒事件 |
| Base／Job 升級 | `levelup.wav`／`st_job_level_up.wav` | 經驗事件 |
| 成功／失敗 | `p_success.wav`／`p_failed.wav` | 回饋事件 |
| 取得 Zeny | `se_get_coin.wav` | 金幣事件 |

介面檔案均來自同一份已核對 SHA-256 的 `data0.grf`。檔名與功能語意可直接確認；官方客戶端的原始 UI 呼叫點未開放為可讀 TypeScript，故表內的「接入位置」是本專案控制層事件對應，音檔來源仍維持官方檔案。

## 玩家受傷與死亡

男性角色使用 `damage_male.wav` 與 `die_male.wav`。女性角色依初心者、劍士、魔法師、弓箭手、服事、商人與盜賊職業使用各自的 `*_damage_female.wav` 與 `*_die_female.wav`。

## 驗證方式

`scripts/test-damage-floats-ui.mjs` 以 390×844 手機視窗登入真實玩家頁面，啟用音效後驗證：

1. 二刀連擊只播放一次短劍揮擊，播放兩次短劍命中與兩次波利受傷音。
2. 兩次短劍命中與兩次波利受傷音的間隔均介於 250 至 500 毫秒。
3. 傷害數字與音效具有相同 combatEventId 與 hitIndex。
4. 綠棉蟲攻擊、玩家受傷與波利死亡音均由玩家頁面的戰鬥事件觸發。
5. 所有音效由 Web Audio 成功開始播放，介面無執行期錯誤。
