# M1 HP potion source gate

```text
PINNED_OPENKORE = 51de1ddfc4449ae5217f6886de702f87ca934030
CAPABILITY = R04 useSelf_item HP-conditioned potion
SOURCE_SCOPE = Character configuration to existing PA survival/item authority
PRODUCTION_DEPLOYMENT = NO
```

| Evidence | Exact result |
|---|---|
| OPENKORE_FILE | `control/config.txt:727-730`; `control/timeouts.txt:171`; `src/AI/CoreLogic.pm:2982-3003`; `src/Misc.pm:5487-5545,5708-5723`; `src/Utils.pm:1454-1502` |
| OPENKORE_SYMBOL | `processAutoItemUse`, `checkSelfCondition`, `inRange`, `getRange` |
| OPENKORE_CONFIG | Numbered `useSelf_item_i`, `useSelf_item_i_hp`, `useSelf_item_i_timeout`, `useSelf_item_i_dcOnEmpty` |
| OPENKORE_DEFAULT | No active item row; block `dcOnEmpty 0`; blank row timeout becomes zero; global `ai_item_use_auto` interval is 0.5 seconds. |
| OPENKORE_BEHAVIOR | During eligible AI actions and global item-use timeout, scan numbered rows in order. A row must have an item name and pass self conditions. Select the first present item, send use, stamp row/global time and stop scanning. Missing item falls through to the next row when `dcOnEmpty=0`. |
| OPENKORE_TRANSITION | Eligible state and HP range → inventory item present → item-use request → timestamp after request; next eligible row only on a later tick. `checkSelfCondition` interprets `< N%` against current HP percentage and honors per-row timeout. |
| CURRENT_GI_BEHAVIOR | `ops/ro-stack/dashboard/config-schema.mjs` stores `combat.itemUse` rows. `dashboard.mjs` returns `CONFIG_ONLY_NO_EXECUTOR_COMMAND`. `src/map/persistent_agent.cpp:2694-2721,2808-2890` uses a global item allowlist and global 30/60 HP threshold in `handle_survival`; it calls rAthena `pc_useitem`. |
| FIRST_BROKEN_TRANSITION | Stored character row → `start_farm` command → Native row predicate/item selection. The row is currently omitted. |
| RATHENA_AUTHORITY | `src/map/pc.cpp:6460+` `pc_useitem` checks inventory, item usability, status, cooldown and map restrictions, applies item effects and consumption. PA must observe its outcome and authoritative HP/inventory. |
| PORT_MAPPING | Preserve the ordered, first-applicable HP potion row semantics in the existing `start_farm` payload and PA survival tick. Admit only exact M1-supported conditions. Reject unsupported configured conditions with a typed error. Let `pc_useitem` decide legality. Keep existing PA recovery/supply arbitration and never add a second item engine. |

M1 supported subset: numeric item ID, HP `< N%` with `1 <= N <= 100`,
nonnegative row timeout, no additional configured predicates. Disabled rows are
ignored. This subset is narrower than OpenKore's full condition evaluator;
all other predicates remain `PARTIAL` and Player UI disabled. The existing
global survival path remains a separate fallback until a bounded live test
can prove the requested potion action, inventory decrement and HP increase.
No `dcOnEmpty` disconnect is ported, matching its pinned default of zero.

Current `ro-stack.ps1` environment can opt in to a different global HP
threshold than the pinned OpenKore sit default. This gap remains `R01 PARTIAL`;
the potion row may not be marked Player-supported until the overlap is tested
and resolved without regressing the existing supply/stand/resume path.
