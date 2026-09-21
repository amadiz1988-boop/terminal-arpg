# MINIMAP_LIVE_COMBAT_POC_V1

## Scope

- Test-only visual PoC. No Player Web navigation, API, Persistent Agent, Native rAthena, Event Ledger, OpenKore, Stage2 Hunting, Supply, Quest, or production minimap changes.
- Legal nearest test state: isolated deterministic browser fixture with mock authority snapshots and mock combat events. No gameplay authority is exercised.
- Representative evidence gate: N/A for presentation-only mock fixture. Test acceleration: NO.

## Browser acceptance evidence

Browser: Codex In-app Browser against the short-lived static preview server `http://127.0.0.1:8799/ops/ro-stack/dashboard/poc/minimap-live-combat/`.

| Control / behavior | Result | Evidence |
| --- | --- | --- |
| PLAYER_WALK_VISIBLE | PASS | Canvas visibly moved player from spawn to monster A; AX showed `Running · WALK_A`. |
| MONSTER_WALK_VISIBLE | PASS | Monster B moved during the deterministic walk segment; event trace showed `9.8s WALK · 瘋兔進入移動段`. |
| PLAYER_ATTACK_VISIBLE | PASS | AX event trace showed `5.6s ATTACK · 玩家攻擊 波利` and later `14.5s ATTACK · 玩家攻擊 瘋兔`. |
| MONSTER_HIT_VISIBLE | PASS | AX event trace showed `7.0s HIT · 波利受到攻擊` and `13.3s HIT · 瘋兔攻擊玩家`. |
| DAMAGE_NUMBER_VISIBLE | PASS | Canvas damage float is rendered; trace showed `8.2s DAMAGE · 傷害 124` and `15.3s DAMAGE · 傷害 138`. |
| MONSTER_DEATH_VISIBLE | PASS | Trace showed paired `KILL` and `DEATH` for 波利 and 瘋兔; Canvas fades the target after death. |
| RETARGET_VISIBLE | PASS | Trace showed `4.7s TARGET · 鎖定 波利` and `12.4s TARGET · 重新鎖定 瘋兔`; lock-on ring is drawn around target. |
| Start / Pause / Reset | PASS | Pause changed visible state to `Paused · ready`; Start resumed the loop; Reset cleared snapshots and event trace. |

## Latency observations

- `500MS_VISUAL_ACCEPTABLE = PASS`: map and entity motion remained smooth at 60 FPS; received authority revision lagged while render loop stayed independent.
- `1200MS_VISUAL_ACCEPTABLE = PASS`: known movement segments continued to their bounded endpoints; UI showed the independent renderer and delayed snapshot revision.
- `2000MS_RECOVERY_BEHAVIOR = PASS`: when authority snapshots were delayed, the browser held the legal endpoint and resumed after the next snapshot. No unbounded extrapolation was observed.

## Scale observations

- `0.35X = PASS`: smallest readable footprint; least map occlusion.
- `0.5X = PASS / BEST_BALANCE`: player and monster silhouettes remained readable while preserving map context.
- `0.7X = PASS`: clearest silhouettes; increased map occlusion.

## Performance observation

Measured in browser AX telemetry with each entity count selected and started:

- `FPS_1_ENTITY = 60`, frame time `16.7ms`.
- `FPS_5_ENTITY = 60`, frame time `16.7ms`.
- `FPS_10_ENTITY = 60`, frame time `16.7ms`.
- `FPS_20_ENTITY = 60`, frame time `16.6ms`.
- `CANVAS2D_20_ENTITY_VIABLE = YES` for this presentation fixture and viewport. This is not a production performance certification.

## Safety / deployment

- `NO_GAMEPLAY_AUTHORITY_CHANGE = YES`
- `PRODUCTION_TOUCHED = NO`
- `RUNTIME_RESTARTED = NO`
- `OPENKORE_RUNTIME = 0` (no OpenKore process was started by this task)
- The preview server was static-only, bound to loopback port 8799, and is stopped after this report.

## Verdict

`POC_VERDICT = PROMISING`

`CHARACTER_LIFE_DIRECTION_COMPATIBILITY = PASS`: the page keeps authority state, render state, and mock event presentation separate, so a future Life Director or Social Director could consume a typed read model without introducing a second movement or combat authority.

`NEXT_RECOMMENDED_SLICE =` add a typed read-only snapshot adapter against an isolated fixture, preserving the same browser-only renderer and retaining the no-production-integration gate.
