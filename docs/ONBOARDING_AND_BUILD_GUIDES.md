# Onboarding and Build Blueprints

## Principle

Every character starts from zero. A Build Blueprint is a transparent goal and acquisition guide. It never grants or equips a finished build.

The opening guarantees a playable skeleton: one starter weapon, one basic skill and enough defense to finish the first encounter. Power, automation and specialization are earned in sequence.

## Short campaign

The campaign is five terminal operations lasting about 30 to 45 minutes in total. Duration is a tuning target that requires playtest validation.

| Operation | Player action | System taught | Guaranteed milestone |
| --- | --- | --- | --- |
| 0. Boot Sequence | Equip a damaged starter weapon and use one skill | Character, skill and terminal combat | Starter weapon and skill |
| 1. Broken Relay | Compare and equip the first drop | Item score, affixes and inventory | One relevant magic item |
| 2. Signal Split | Choose one of three support rewards | Skill tags and support links | First support skill |
| 3. Supply Route | Select a route and repeat-run condition | Automation policy and opportunity cost | Material wallet and salvage |
| 4. Hunter Trace | Pursue a named enemy for a build component | Target farming and source lookup | One core build component |
| 5. First Breach | Assemble the starter build and defeat a boss | Build checklist, defense gate and failure report | T1 maps and Atlas access |

Narrative is delivered through short mission briefings, terminal messages and boss records. Each operation exists to teach one decision.

## Starter state

- Level 1 character
- One worn weapon with a single base stat
- One class-compatible active skill
- No support skill
- No rare equipment
- No currency or map inventory
- One suggested Blueprint selected, freely changeable

The first combat remains manually started. Continuous automation unlocks in Operation 3 after the player understands one run and its costs.

## Build Blueprint

A Blueprint describes the destination and the road:

```text
Build identity
Why it works
Required skill and support tags
Core item or affix requirements
Acceptable substitutes
Acquisition source for every requirement
Milestone versions: starter, mapping, advanced
Current checklist and next best target
```

Example guidance:

```text
Ember Volley · Starter 4/7
✓ Ember Arrow: Operation 0 reward
✓ Pierce Support: Operation 2 choice
○ Weapon with Fire Damage: Ash Barracks, Captain Veyra
○ 20% Fire Resistance: any armor, crafting or trader
Next target: farm Ash Barracks · estimated relevant drop chance shown from the server table
```

The system explains where an item, skill or affix comes from. Clicking a missing requirement opens its sources, alternatives and reason for inclusion.

## Agency and protection

- Operation rewards offer choices; they do not auto-equip.
- Core starter components have deterministic quest routes.
- Optional upgrades use targeted drop tables and crafting.
- Duplicate or unsuitable drops feed the material economy.
- A bad reward choice can be corrected through an unlocked vendor or repeatable source.
- Blueprint selection changes guidance and loot emphasis, never drop legality.
- Players may ignore all Blueprints and build freely.

## Content and architecture

Campaign operations, objectives, dialogue, rewards and unlocks are versioned content data. The quest engine evaluates domain events such as `item_equipped`, `support_linked`, `run_policy_selected` and `boss_defeated`.

Build Blueprints reference stable skill, affix, item-base, enemy and area IDs. Acquisition sources come from drop tables, so guide text cannot drift away from game data.

```text
content/campaign → objectives and rewards
content/blueprints → requirements and milestones
content/drop-tables → authoritative acquisition sources
progression → unlock state
simulation → emits objective events
UI → renders guidance and choices
```

## Acceptance tests

1. A new save contains only the declared starter state.
2. Every tutorial message follows a player action and explains its result.
3. A player reaches T1 with one coherent but incomplete Build.
4. Every missing Blueprint component has at least one valid acquisition source.
5. Switching Blueprint changes checklist and guidance without changing owned items.
6. Campaign completion unlocks continuous mapping; it does not grant an endgame set.
7. The tutorial can be skipped by experienced players after one account completion.
