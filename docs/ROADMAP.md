# Product Roadmap

## North star

The player forms a build hypothesis, automates maps, reads evidence, changes skills or gear, and sees measurable efficiency gains. Long-term depth comes from interacting build, farming and economy decisions.

## Foundation 0.2: repeatable core

- New characters begin with one starter weapon and one active skill
- Five-operation onboarding campaign unlocks systems in sequence
- Build Blueprints show milestones, missing parts and acquisition sources
- Map count, duration and inventory-depletion modes
- Tier selection and map inventory
- Equipment drops, comparison and equip action
- Skill selection with visible stat impact
- Deterministic simulation contracts
- Modular architecture and regression tests

Success: one input starts multiple maps; the player makes at least two meaningful build or farming decisions between sessions.

## Foundation 0.3: real build engine

- Base, increased, more and conditional modifier layers
- Damage, speed, crit, area, movement and defenses
- Active skill plus support links
- Character sheet and dummy encounter use the same resolved stats
- Item affix pools with item level and tier

Success: two builds with similar tooltip DPS produce measurably different clear speed, boss time or survival.

## Alpha 0.4: mapping game

- Map layouts, packs, rares, bosses and failure states
- Atlas unlock path from T1 upward
- Map modifiers, quantity, rarity and risk
- Run policy with measurable tradeoffs
- Efficiency report: maps per hour, currency per hour, deaths and upgrade value

Success: players deliberately choose a Tier, layout and policy for a stated goal.

## Friends Alpha 0.5: persistent characters

- Accounts, server-authoritative runs and database persistence
- Character slots, inventory, stash and save migrations
- Shareable build summary
- Telemetry for session length, decisions, abandonment and progression

Success: 3 to 10 invited players can return on another device without lost progress.

## Economy Alpha 0.6

- Currency identities and crafting sinks
- Item listing and asynchronous trade
- Price history and server validation
- Seasonal reset rehearsal

Success: farming choices create distinct supply and demand without developer-injected prices.

## Season 1

- One modular encounter mechanic
- One new crafting resource
- New affixes, farming specialization and boss
- Full reset, migration and balance process

Success: seasonal content changes build and farming decisions while core engines remain unchanged.

## Work order

Contracts → formulas → deterministic tests → application state → UI → persistence → multiplayer → economy → season content.

## Playtest gate

Before a public link is sent:

1. Complete three sessions with different skills and policies.
2. Verify every continuous-run stop condition.
3. Equip at least two drops and confirm resolved stats change.
4. Confirm Tier inventory consumption and progression.
5. Record one decision that improved efficiency and one remaining dead choice.
6. Pass build, lint and deterministic engine tests.
