# RO_ORIGINAL_MINIMAP_LIVE_COMBAT_POC_V1

## Scope and lineage

```text
TASK_ID = RO_ORIGINAL_MINIMAP_LIVE_COMBAT_POC_V1
REFERENCE_COMMIT = 6470972260221c0fe0cd4825b66c5ac5fb20055a
PARENT_CHECKPOINT = d406ae6
TRANSFERRED_WIP_REUSED = readonly-live-adapter.js typed read-only position/event adapter; existing preview shell
TRANSFERRED_WIP_SUPERSEDED = prior custom text damage / CSS combat flash / fixed 0.5x controls; replaced by original bitmap digits, lens assets, source modes, 100% defaults
```

This is an isolated browser presentation fixture. It does not alter PA, rAthena, Stage2, Supply, Quest, Production Player Web, formal minimap, combat runtime, database, or gameplay authority.

## Test page

```text
TEST_PAGE = ops/ro-stack/dashboard/poc/minimap-live-combat/index.html
PREVIEW_URL = http://127.0.0.1:8799/ops/ro-stack/dashboard/poc/minimap-live-combat/
```

The preview server is loopback-only and must be stopped after the Product Owner review window.

## Fidelity gate

| Contract | Result |
|---|---|
| RO_MINIMAP | BLOCKED_NOT_PROVEN |
| RO_PLAYER_SCALE | BLOCKED_NOT_PROVEN |
| RO_MONSTER_SCALE | BLOCKED_NOT_PROVEN |
| RO_PLAYER_IDLE | PASS |
| RO_PLAYER_WALK | PASS |
| RO_PLAYER_ATTACK | PASS |
| RO_PLAYER_HIT | BLOCKED_MISSING_ASSET |
| RO_MONSTER_IDLE | PASS |
| RO_MONSTER_WALK | BLOCKED_NOT_PROVEN |
| RO_MONSTER_ATTACK | BLOCKED_NOT_PROVEN |
| RO_MONSTER_HIT | BLOCKED_NOT_PROVEN |
| RO_MONSTER_DIE | BLOCKED_MISSING_ASSET |
| RO_ATTACK_EFFECT | BLOCKED_MISSING_ASSET |
| RO_HIT_EFFECT | PASS |
| RO_CRITICAL_EFFECT | PASS |
| RO_DAMAGE_NUMBER | PASS |
| RO_LEVEL_UP_EFFECT | BLOCKED_MISSING_ASSET |
| RO_ATTACK_SOUND | PASS |
| RO_HIT_SOUND | PASS |
| RO_CRITICAL_SOUND | PASS |
| RO_DEATH_SOUND | PASS |
| RO_LEVEL_UP_SOUND | PASS |

```text
RO_ORIGINAL_FIDELITY_COMPLETE = NO
RO_ORIGINAL_EVIDENCE_MISSING = PLAYER_HIT_ACT, PLAYER_DIE_ACT, MONSTER_ACTION_ACT/SPR_WEB_FRAMES, MONSTER_DEATH_EFFECT, LEVEL_UP_VISUAL_EFFECT, ORIGINAL_FONT_BEHAVIOR_SCREENSHOT, LIVE_TARGET_POSITION, LIVE_AUTHORITATIVE_ATTACK_HIT_KILL_FOR_BROWSER
```

The page does not substitute missing original assets. The monster WebP outputs are the verified idle outputs. The source ACT/SPR pairs remain recorded for a later lossless action-atlas workline.

## Live data contract

```text
PLAYER_POSITION_CONTRACT = /api/live-position?characterId=<session character>; one minimal authoritative position projection
PLAYER_MOVEMENT_CONTRACT = authoritative samples; adapter interpolates received samples in rAF; no browser pathfinding
TARGET_CONTRACT = /api/events target line only when authoritative; LIVE_TARGET_POSITION = NOT_AVAILABLE when no target position exists
COMBAT_CONTRACT = /api/combat-snapshot then /api/combat-stream or /api/events; ATTACK is not promoted to HIT without authoritative damage
LEVEL_UP_CONTRACT = no level-up event in current adapter; preview button remains visual-only and blocked for missing visual asset
```

```text
LIVE_PLAYER_POSITION = adapter implemented; browser acceptance requires authenticated session
LIVE_EVENT_PROJECTION = read-only adapter events are rendered only from authoritative TARGET / ATTACK / HIT-with-damage / KILL / DEATH / LOOT / MAP_CHANGE records; browser acceptance requires authenticated session
LIVE_PLAYER_MOVEMENT = NOT_MEASURED in this isolated page
LIVE_TARGET = NOT_AVAILABLE unless authoritative projection supplies identity and position
LIVE_ATTACK = NOT_MEASURED
LIVE_HIT = NOT_MEASURED
LIVE_DAMAGE = NOT_MEASURED
LIVE_CRITICAL = NOT_MEASURED
LIVE_KILL = NOT_MEASURED
LIVE_DEATH = NOT_MEASURED
LIVE_LEVEL_UP = NOT_AVAILABLE
MISSING_PRESENTATION_CONTRACTS = target position, authoritative combat damage/critical/kill/death browser projection, level-up event and visual
```

## Controls and audio

```text
PLAYER_SCALE_CONTROL = 50%, 75%, 100%, 150%, 200%; default 150% for Product Owner review
MONSTER_SCALE_CONTROL = 35%, 50%, 75%, 100%, 150%, 200%; default 35% for Product Owner review
HIT_RAY_SCALE = follows player scale so player-hit and monster-hit rays remain visually equal
DEFAULT_OTHER_PLAYERS = OFF
DEFAULT_PLAYER_NAMES = OFF
DEFAULT_MONSTER_NAMES = OFF
CURRENT_GHOST_ISLAND_AUDIO = attack.wav, hurt.wav, defeat.wav, level_up.wav
RO_ORIGINAL_AUDIO = _attack_sword.wav, _hit_sword.wav, ef_hit2.wav, damage_male.wav, poring_die.wav, level_up.wav
AUDIO_CONFLICTS = NO production conflict observed; this page selects one sound set per event
DUPLICATE_SOUND_GUARD = event id + sound set key de-duplicates one primary sound per event
```

## Performance matrix

The browser acceptance run records FPS and frame time in the page telemetry. Exact mobile P50/P95/P99/MAX and audio/effect deltas remain `NOT MEASURED` until the Product Owner review session supplies a 390×844 run with the required toggles.

```text
MOBILE_VIEWPORT = 390x844
FPS_SELF_TARGET = NOT MEASURED
FPS_5_MONSTERS = NOT MEASURED
FPS_10_MONSTERS = NOT MEASURED
FPS_20_MONSTERS = NOT MEASURED
FRAME_P50 = NOT MEASURED
FRAME_P95 = NOT MEASURED
FRAME_P99 = NOT MEASURED
FRAME_MAX = NOT MEASURED
STALL_GT_100MS = NOT MEASURED
NAMES_OFF_COST = NOT MEASURED
NAMES_ON_COST = NOT MEASURED
AUDIO_OFF_COST = NOT MEASURED
RO_AUDIO_COST = NOT MEASURED
EFFECTS_OFF_COST = NOT MEASURED
RO_EFFECTS_COST = NOT MEASURED
DISPLAY_SCALE_EFFECT_ON_PERFORMANCE = NOT MEASURED
CANVAS2D_MOBILE_VIABLE = REQUIRES_390x844_MEASUREMENT
```

## Browser acceptance evidence

Browser: Codex In-app Browser against the loopback preview URL. The preview used the nearest valid isolated deterministic scenario state; no production runtime was restarted.

| Control / behavior | Result | Evidence |
|---|---|---|
| RO map visible | PASS | Screenshot showed `prt_fild08` source map and 512×512 label. |
| Player IDLE / WALK / ATTACK | PASS | Original novice body sheets were visible; event trace showed WALK at 1.2s and ATTACK at 5.6s / 14.5s. |
| Monster presentation | PASS for verified idle asset | Poring and Lunatic WebP outputs were visible at the default 100% control; complete monster action fidelity remains blocked. |
| Combat timeline | PASS for preview trace | TARGET → WALK → ATTACK → HIT → DAMAGE → KILL → DEATH events were visible in order. |
| Original bitmap damage | PASS | Normal and critical number PNGs were rendered; critical preview showed the original critical background and lens2 asset. |
| Eight-ray hit effect | PASS_FOR_EQUIVALENT_PRESENTATION | `lens1/lens2` full 32×128 strips are presented as eight narrow screen-blended rays; the former white square from a single 32×32 crop is gone. |
| Hit-ray size equality | PASS_FOR_REVIEW | Product Owner review defaults are player 150% and monster 35%; both player-hit and monster-hit rays use the player-scale reference. |
| Preview buttons | PASS | Normal Attack, Critical, Player Hit, Monster Hit, Monster Death and Level Up all produced a visible event or explicit blocked status. |
| Names and scale controls | PASS | Other Players, Player Names and Monster Names defaulted off; Monster Names toggled on; 150% player and 50% monster controls changed visible settings. |
| Sound set control | PASS | AX showed default `RO ORIGINAL`; CURRENT GHOST ISLAND and OFF are selectable. One event id plus sound-set guard prevents duplicate playback. |
| LIVE READ-ONLY boundary | PASS | Selecting LIVE showed the character ID control; Start without an ID stopped at `LIVE READ-ONLY · 請輸入角色 ID`. No preview entity was injected into live mode. |
| Pause / Reset | PASS | Pause returned to `RO SCENARIO PREVIEW · 已就緒`; Reset cleared revision and event trace. |

Desktop telemetry observed during the browser run:

```text
FPS_SELF_TARGET = 60
FPS_5_MONSTERS = NOT_MEASURED_THIS_RUN
FPS_10_MONSTERS = NOT_MEASURED_THIS_RUN
FPS_20_MONSTERS = NOT_MEASURED_THIS_RUN
FRAME_P50 = NOT_MEASURED
FRAME_P95 = 16.8ms (single visible sample window)
FRAME_P99 = NOT_MEASURED
FRAME_MAX = 16.8ms (single visible sample window)
STALL_GT_100MS = 0 observed in the run
```

The 390×844 mobile P50/P95/P99/MAX matrix still requires a dedicated viewport measurement and is not inferred from the desktop run.

## Authority and quality

```text
NO_FAKE_AUTHORITY = YES
NO_GAMEPLAY_AUTHORITY_CHANGE = YES
NO_SECOND_MOVEMENT_ENGINE = YES
PRODUCTION_TOUCHED = NO
PA_TOUCHED = NO
RATHENA_TOUCHED = NO
RUNTIME_RESTARTED = NO
OPENKORE_RUNTIME = 0
BROWSER_UI_PASS = PASS_FOR_ISOLATED_PREVIEW_CONTROLS
PRODUCT_OWNER_VISUAL_ACCEPTANCE = REQUIRES_USER_REVIEW
FILES_CHANGED = index.html, app.js, styles.css, readonly-live-adapter.js, REFERENCE_NOTES.md, RO_ORIGINAL_ASSET_MATRIX.md, RESULTS.md
GIT_CHECKPOINT = 63dab43
READY_FOR_PRODUCT_OWNER_REVIEW = YES
READY_FOR_PRODUCTION_INTEGRATION = NO
CHARACTER_LIFE_DIRECTION_COMPATIBILITY = PASS
```

`CHARACTER_LIFE_DIRECTION_COMPATIBILITY = PASS` because the adapter consumes a typed read-only projection and the renderer remains a presentation layer. Life Director, Social Director, Persistent Agent ownership, and rAthena authority are untouched.

`WHITE_SQUARE_HIT_EFFECT_REGRESSION = PASS`: Browser preview at 100% showed the normal hit as eight directional rays without the opaque square. Browser preview at 200% showed the same verified asset enlarged proportionally. Critical preview retained `critical-bg.png`, bitmap critical digits, and `lens2` rays.
