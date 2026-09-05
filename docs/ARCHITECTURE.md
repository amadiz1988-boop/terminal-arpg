# Terminal ARPG Architecture

## Architecture goal

Every release extends one stable simulation core. UI, seasonal content and persistence may change independently without rewriting combat, items or modifiers.

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
| `game/content` | Skills, item bases, affixes, maps, enemies, drop tables | Runtime state |
| `game/modifiers` | Modifier stacking, conditions, stat resolution | UI labels |
| `game/combat` | Hit, crit, mitigation, ailments, resource costs | Map inventory |
| `game/items` | Item generation, rarity, affixes, equipment validation | Combat timing |
| `game/maps` | Tier, encounters, completion and map drops | Character formulas |
| `game/simulation` | Deterministic run orchestration and event stream | Rendering delays |
| `game/progression` | XP, level, unlocks and atlas progression | Authentication |
| `game/economy` | Currency sinks, crafting and trade contracts | Direct database calls |
| `game/player` | Character, build, inventory and policy aggregate | Presentation state |
| `app` | Commands, autosave and session lifecycle | Damage or loot rules |
| `components` | Rendering and player input | Random drops or rule mutation |

## Stable contracts

All simulations accept a seed and return a result plus domain events. Runs remain reproducible and testable.

```ts
simulateMap(input: RunInput): RunResult
resolveStats(build: BuildSnapshot): ResolvedStats
generateDrops(context: DropContext): Item[]
applyCommand(state: GameState, command: GameCommand): GameState
```

Content uses IDs and versioned data. Saved characters store IDs and rolled values, never React objects or display text.

## Server authority path

Alpha runs locally for fast playtesting. Friends Alpha moves map simulation, loot generation, inventory writes and progression to server commands. The client receives validated results and renders events. Domain types and UI commands stay unchanged.

## Rules that prevent rewrites

1. No combat, loot or progression formula inside a component.
2. No content definition inside an engine.
3. One modifier pipeline powers tooltip DPS, dummy DPS and map simulation.
4. Seasonal mechanics register hooks and reward tables; the core engine never branches by season name.
5. Every engine feature ships with deterministic tests before UI wiring.
6. Save schema changes require a version and migration.
7. Each task names its owning module and acceptance test.

## Planned folders

```text
game/
  content/       versioned game data
  core/          IDs, random seed, shared domain types
  modifiers/     stat and modifier pipeline
  combat/        combat resolution
  items/         item generation and equipment
  maps/          map rules and encounters
  simulation/    run orchestration and event stream
  progression/   XP, unlocks and atlas
  economy/       currencies, crafting and trade
  player/        build and inventory aggregate
app/             pages and application composition
components/game/ terminal and control panels
tests/game/      deterministic engine tests
```

## Architecture gate

A release is blocked when domain logic exists in React, a new feature bypasses the modifier pipeline, a random outcome lacks a seed, or a saved-state change lacks migration coverage.
