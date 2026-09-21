# RO_ORIGINAL_MINIMAP_LIVE_COMBAT_POC_V1 資產矩陣

查核基線：`PARENT_CHECKPOINT=d406ae6`、roBrowserLegacy `6470972260221c0fe0cd4825b66c5ac5fb20055a`。本頁只使用本機授權素材與現有唯讀 adapter。

| 項目 | SOURCE | FORMAT / 尺寸 | PROVENANCE | RO_ORIGINAL_CONFIRMED | WEB_USABLE |
|---|---|---|---|---|---|
| MINIMAP_BACKGROUND | `data.grf:data/texture/.../map/prt_fild08.bmp`，Web `/ro/client/maps/prt_fild08.png` | PNG 512×512 | `docs/ro-asset-index/maps.json`，source SHA `532685...`，web hash 已驗證 | YES | YES |
| PLAYER_BODY | `data0.grf` 授權 Client 轉換的 `showcase/body/novice-male-{stand,walk,attack}.png` | 每格 96×160，8 directions | `public/ro/client/showcase/manifest.json`，frameWidth 96、frameHeight 160、origin 48,108 | YES | YES |
| PLAYER_HEAD | 本 PoC 未使用頭部層 | 未載入 | 無本頁需要的頭部層矩陣 | NO | NO |
| PLAYER_WEAPON | 本 PoC 未使用武器層 | 未載入 | Novice body action 已是現有展示轉檔，沒有本頁可核對的武器 layer | NO | NO |
| MONSTER_SPRITE | `data0.grf:data/sprite/怪物/{Poring,Lunatic,Fabre}.spr` 轉成 WebP | 96×96 idle preview | `public/ro/client/monsters/manifest.json`，各有 source SPR SHA、web SHA | YES，僅 idle Web 輸出 | YES，僅 idle |
| PLAYER_ACT | 現有 showcase metadata | `stand 3×100ms`、`walk 8×75ms`、`attack 6×100ms`，每個 action 8 方向 | `public/ro/client/showcase/manifest.json` | YES，已用於 IDLE/WALK/ATTACK | YES |
| MONSTER_ACT | `data0.grf` ACT source 已在 manifest 記錄 | ACT source 存在，Web action frame atlas 未輸出 | `monsters/manifest.json` 有 act path、SHA、idle frame counts | YES source，NO Web complete actions | NO，待轉檔 |
| ATTACK_EFFECT_ASSET | 未找到已證明的普通攻擊專用 effect | N/A | 目前只有 hit lens asset | NO | NO |
| HIT_EFFECT_ASSET | `data/texture/effect/lens1.tga` → `/ro/client/damage/lens1.png`；音效 `ef_hit2.wav` | PNG 32×128 full ray strip | `public/ro/client/damage/manifest.json`；Canvas uses eight narrow screen-blended rays | YES | YES |
| CRITICAL_EFFECT_ASSET | `lens2.png`＋`critical-bg.png` | PNG 32×128 full ray strip、70×60 | `damage/manifest.json`：lens2 及 `msg.spr#frame-3`；Canvas uses eight rays plus critical background | YES，素材來源確認 | YES |
| DEATH_EFFECT_ASSET | 未找到本頁可核對的死亡視覺 effect | N/A | 只有怪物死亡 WAV | NO | NO |
| LEVEL_UP_EFFECT_ASSET | 未找到 level-up visual effect；`lv_up_on.png` 是 status UI 狀態圖 | PNG UI state，非戰鬥特效 | `docs/ro-ui-asset-index.json` status pilot | NO | NO |
| DAMAGE_NUMBER_ASSET / FONT STYLE | `數字.spr` frames 0–9 → `number-0..9.png`；crit numbers；`msg.spr#frame-3` | Bitmap digits，原始像素尺寸保留 | `damage/manifest.json`，font 原廠畫面未取得 | YES 素材，NO 原廠字體畫面 | YES |
| ATTACK_SOUND | `data0.grf:data/wav/_attack_sword.wav` | WAV | `sfx/official/combat-manifest.json` | YES source，trigger 仍需 Client screenshot | YES |
| HIT_SOUND | `data0.grf:data/wav/_hit_sword.wav` | WAV | `combat-manifest.json` | YES source，trigger 仍需 Client screenshot | YES |
| CRITICAL_SOUND | `data/wav/effect/ef_hit2.wav` | WAV | `damage/manifest.json` | YES source，critical trigger 仍需 Client screenshot | YES |
| DEATH_SOUND | `data0.grf:data/wav/poring_die.wav` | WAV | `combat-manifest.json` | YES source，trigger 仍需 Client screenshot | YES |
| LEVEL_UP_SOUND | `data0.grf:data/wav/levelup.wav` | WAV | `combat-manifest.json` | YES source，trigger 仍需 Client screenshot | YES |

## Projection matrix

```text
MAP_WIDTH = 512
MAP_HEIGHT = 512
MINIMAP_SOURCE_SIZE = 512x512
COORDINATE_ORIGIN = lower-left RO world coordinates
Y_AXIS_DIRECTION = RO y increases upward; Canvas y is inverted
PROJECT_X = pad + x * ((canvas.width - 2*pad) / MAP_WIDTH)
PROJECT_Y = canvas.height - pad - y * ((canvas.height - 2*pad) / MAP_HEIGHT)
```

`PLAYER_SCALE=100%` 與 `MONSTER_SCALE=100%` 是頁面預設控制值。它們只乘上現有 Web asset 的呈現比例，不改變任何 x/y、距離、路徑、攻擊範圍、碰撞或 target。原廠 Client 與 Web 小地圖之間的像素對應尚未取得同畫面校準，因此 fidelity 仍列 `BLOCKED_NOT_PROVEN`。

## Missing evidence gate

```text
RO_ORIGINAL_EVIDENCE_MISSING =
PLAYER_HIT_ACT,
PLAYER_DIE_ACT,
MONSTER_ACTION_ACT/SPR_WEB_FRAMES,
MONSTER_DEATH_EFFECT,
LEVEL_UP_VISUAL_EFFECT,
ORIGINAL_FONT_BEHAVIOR_SCREENSHOT,
LIVE_TARGET_POSITION,
LIVE_AUTHORITATIVE_ATTACK_HIT_KILL_FOR_BROWSER
```

未證明項目保持空白或顯示阻塞狀態。頁面不建立自製 CSS 粒子、替代死亡動畫、替代升級動畫或瀏覽器端 target／damage authority。
