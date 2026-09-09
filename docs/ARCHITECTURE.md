# RO OpenKore-like Architecture

延伸規格：

* [核心公式與內容架構](./CORE_FORMULA_ARCHITECTURE.md)
* [ARPG 玩家循環研究](./ARPG_PLAYER_LOOP_RESEARCH.md)
* [Alpha 0.5 實玩驗收](./PLAYTEST_ALPHA_0.5.md)

## Architecture goal

Every release extends one deterministic RO world simulation. UI, content imports and persistence may change independently without rewriting movement, AI, combat or inventory rules.

## Dependency direction

```text
UI → Application commands → Domain engines → Content data
                         ↓
                    Persistence port
```

Dependencies only point inward. Domain engines contain pure TypeScript and never import React, timers, browser APIs or storage.

## Modules

| Module | Owns | Must not own |
| --- | --- | --- |
| `game/content` | Versioned RO jobs, skills, items, monsters, maps and NPC data | Runtime state |
| `game/world` | Grid, actors, ground items, portals and world clock | UI timing |
| `game/ai` | OpenKore-like task queue, target selection and policies | React state |
| `game/combat` | Hit, flee, damage, ASPD, cast, delay, elements and status | Map rendering |
| `game/inventory` | Weight, equipment, stack, use, drop, trade and storage | Combat timing |
| `game/simulation` | Deterministic tick orchestration and event stream | Rendering delays |
| `game/progression` | Base/Job EXP, stats, skills and job changes | Authentication |
| `game/player` | Character, inventory and automation policy aggregate | Presentation state |
| `app` | Commands, autosave and session lifecycle | Damage or loot rules |
| `components` | Rendering and player input | Random drops or rule mutation |

## Stable contracts

All simulations accept a seed and return a result plus domain events. Runs remain reproducible and testable.

```ts
advanceWorld(state: WorldState, ticks: number): WorldState
resolveStats(character: CharacterState): ResolvedStats
stepAi(state: WorldState, policy: AutomationPolicy): AiDecision
applyCommand(state: GameState, command: GameCommand): GameState
```

Content uses IDs and versioned data. Saved characters store IDs and rolled values, never React objects or display text.

## Server authority path

Alpha runs locally for fast playtesting. Friends Alpha moves map simulation, loot generation, inventory writes and progression to server commands. The client receives validated results and renders events. Domain types and UI commands stay unchanged.

## Rules that prevent rewrites

1. No movement, AI, combat, loot or progression formula inside a component.
2. No content definition inside an engine.
3. Character sheet, combat and terminal use the same resolved state.
4. Every numeric rule cites the pinned source file and version.
5. Every engine feature ships with deterministic tests before UI wiring.
6. Save schema changes require a version and migration.
7. Each task names its owning module and acceptance test.

## Planned folders

```text
game/
  content/       versioned game data
  core/          IDs, random seed, shared domain types
  world/         grid, actors, portals and ground items
  ai/            task queue and automation policies
  combat/        combat resolution
  inventory/     equipment, weight, item use and storage
  simulation/    tick orchestration and event stream
  progression/   Base/Job EXP, stats, skills and job changes
  player/        character and automation aggregate
app/             pages and application composition
components/game/ terminal and control panels
tests/game/      deterministic engine tests
```

## Architecture gate

A release is blocked when domain logic exists in React, a numeric rule lacks a source, a random outcome lacks a seed, or a saved-state change lacks migration coverage.

Friends Alpha 另加一個遊玩閘門：每個候選版本需通過至少 30 分鐘等價的固定種子測試，再以真實手機尺寸操作核心流程。自動評分只檢查機械密度，人工評分必須扣除內容廣度、理解成本與操作問題。
