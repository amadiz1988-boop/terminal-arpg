# Item Triage, Inventory and Salvage

## Design goal

Loot creates decisions without creating clerical work. Every drop is evaluated against the active build, routed automatically, and remains explainable.

## Drop pipeline

```text
Drop
  → identify affixes
  → protect special items
  → evaluate active build
  → assign upgrade and potential scores
  → apply loot policy
  → inventory, stash, sell queue or salvage
  → material wallet
```

Only actionable items enter the visible backpack. Salvaged items appear as one session summary instead of individual rows.

## Item information hierarchy

Each item row leads with the information that changes a decision:

1. `+12.4% DPS` or `-3.1% DPS`
2. `+6.2% EHP`, resistance cap changes or movement changes
3. Upgrade class: direct upgrade, sidegrade, crafting base, market candidate or salvage
4. Rarity, base, item level and affix count
5. Affixes ordered by contribution to the selected build

Green means a direct upgrade, blue means a build tradeoff, gold means crafting or market potential, gray means salvage. Sorting defaults to direct upgrades first, then potential, then rarity.

## Evaluation model

Rarity is presentation metadata. Item value is contextual.

```text
directUpgradeScore = weighted delta of resolved build scenarios
potentialScore = base quality + open affix capacity + affix tiers + rare tags
```

The shared Modifier Engine calculates deltas for three scenarios:

- Clear: pack damage, area, speed and movement
- Boss: sustained single-target damage and survival
- Safe: effective health, mitigation, recovery and resistance caps

The UI shows the chosen policy's primary delta and allows inspection of all scenarios. Conditional effects show the condition beside the estimate. Unsupported interactions display `尚未評估` and are protected from automatic salvage.

## Auto-salvage

Three presets provide a safe start:

| Preset | Keeps | Salvages |
| --- | --- | --- |
| Beginner | Any upgrade, unseen unique, useful rare, crafting base | Common items below current progression |
| Progression | Upgrade above 1%, valuable affix, high item level, special base | Low-potential common and magic items |
| Endgame | Upgrade above configured threshold, top-tier affix, market and craft targets | Everything else |

Advanced rules may filter by rarity, slot, item level, affix tier, affix tag, upgrade percentage and potential score.

Protection rules always run before salvage:

- Equipped, locked or favorited
- Unseen unique or collection entry
- Item with an unscored affix
- Item matching a pinned crafting target
- Item exceeding a market-value threshold

Players receive a recoverable salvage bin for the latest session. Items become permanent materials when the next session starts or the player confirms.

## Material economy

Salvage produces a material wallet instead of more inventory objects.

| Material | Source | Sink |
| --- | --- | --- |
| Scrap | Common and magic gear | Reroll one numeric value within its tier |
| Essence Dust | Rare affixes | Replace one chosen affix from a tagged pool |
| Core Shard | High-tier affix or legendary duplicate | Raise one affix tier with escalating cost |

Costs rise by item level and target affix tier. These sinks create a choice between equipping an immediate upgrade, preserving a crafting base and salvaging for progress.

## Inventory limits

- Backpack contains 24 actionable item slots.
- Material wallet has no item slots.
- Overflow follows the active loot policy.
- Locked items count toward capacity.
- Session report shows kept, salvaged, protected and overflow counts.

The slot count is an Alpha tuning value, not a domain constant.

## Architecture requirements

- Evaluation consumes a `BuildSnapshot` and uses the same stat resolver as combat.
- Salvage rules operate on tags and scores, never display names.
- Item, filter and material definitions are versioned content data.
- Every automatic action emits a reason code for UI explanation and telemetry.
- Server authority validates generation, equipment, salvage and material spending in Friends Alpha.

## Acceptance tests

1. A stronger weapon appears above a rarer but weaker weapon for the active build.
2. Switching skills can reorder the same inventory.
3. Protected and unscored items never auto-salvage.
4. A five-map session can complete with a full backpack and no modal interruption.
5. Salvage materials have at least one available sink when salvage unlocks.
6. DPS, survival and speed deltas match the combat stat resolver.
