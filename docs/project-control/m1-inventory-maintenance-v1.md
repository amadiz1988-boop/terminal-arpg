# M1_INVENTORY_MAINTENANCE_V1 capability closure

Authority: canonical M1 doc section `M1_INVENTORY_MAINTENANCE_V1` (2026-09-25),
superseding `GLOBAL_AUTOSTORE = NO`, `AUTO_SELL = OUTSIDE_M1` and
`AUTO_STORAGE = OUTSIDE_M1`. Lease `869f1725-dbd0-452d-b9dd-37ee79cc3f9a`.

## OpenKore reference

Source provenance: Production materialized checkout
`.local/ro-stack/openkore`, a Git repository whose HEAD is exactly
`51de1ddfc4449ae5217f6886de702f87ca934030` (canonical checkout was empty).

| Concept | File / symbol | Default | GI mapping |
| --- | --- | --- | --- |
| Weight trigger | `src/AI.pm` `shouldStartAutoStorage`/`shouldStartAutoSell`, `itemsMaxWeight_sellOrStore` | 48 | `supply.weightTriggerPercent` (Web default 75, range 40..88) |
| Slot trigger | same, `itemsMaxNum_sellOrStore` | 99 | `supply.inventorySlotTrigger` |
| Storable check | `src/AI.pm` `ai_storageAutoCheck` + `ai_canOpenStorage` (NV_BASIC 6) | - | `m1_storage_candidate`, `m1_storage_openable` |
| Sellable check | `src/AI.pm` `ai_sellAutoCheck` (skip equipped/unsellable) | - | `m1_sell_candidate` (explicit rows only) |
| Item policy | `src/Misc.pm` `items_control`, `control/items_control.txt` `all 0 1 0` | store unlisted | `supply.itemRules` item/keepAmount/storage/sell |
| Order | `src/AI/CoreLogic.pm` `processAutoStorage` → `processAutoSell` → `processAutoBuy` | - | one PA journey: storage leg 4, shop leg 5 (sell then buy) |
| Stop pickup | `src/AI/CoreLogic.pm` items_take, `itemsMaxWeight` | 89 | `m1_stop_pickup_weight_percent = 89` fallback |
| Storage full | `processAutoStorage` "still overweight after storageAuto" | - | `INVENTORY_MAINTENANCE_UNRESOLVED` bounded block |

GI overrides: travel wings 601/602 and Supply buy targets are never moved by
the implicit `all` row; favorite and equipment-switch items are kept in
inventory. Explicit Sell requires a standard merchant, an unbound non-rental
non-pet item, positive rAthena sale value and room for the full Zeny credit.
This preflight follows `npc_selllist`'s item-removal-before-credit order and
prevents a failed post-sale check from losing protected property. rAthena
`SC_WEIGHT90` (major_overweight_rate 90) forbids attacks, so PA issues none
while it is active.

## Layers

| Layer | Classification | Implementation |
| --- | --- | --- |
| STATE | ALIGNED | six-field live status: occupied slots, `sd->status.inventory_slots`, weight, max weight, consumable-only `supply_required`/`supply_reason`; additive nullable 012 columns, column-gated writer |
| TRIGGER | ALIGNED | `inventory_maintenance_reason` (INVENTORY_WEIGHT/INVENTORY_SLOTS) sibling of `supply_preflight_reason` |
| ACTION | ALIGNED | `m1_switch_store_items`, `m1_switch_sell_and_buy` with rAthena transaction verification |
| MAINTENANCE | ALIGNED | `handle_m1_farm_supply` single owner, Saved Town storage/shop routes, bounded 3 retries |
| RESUME | ALIGNED | `m1_switch_finish_services` keeps parent intent and service plan, existing paid return and AUTO_FARM resume |

`ITEM_IGNORE_POLICY` (pickup filter) is not executed by Native; the Web row
field `pickup` stays unsupported and disabled. It does not break the
Loot → Maintenance → Resume lifecycle.

Loot capacity failures no longer park the hunt with the HP/SP recovery flag.
Capacity reasons are projected as `INVENTORY_MAINTENANCE`,
`INVENTORY_MAINTENANCE_BLOCKED` or `INVENTORY_CAPACITY_BLOCKED`.

## Source checkpoints

Native `0914b85501d04bd9fb9f2656efe753b4285a1229` on GitHub main includes
the sale preflight fix after `4d805113`; the earlier checkpoint passed full
Release x64 build and 13-program offline regression. The new checkpoint's
13-program offline regression passed, including zero-price and Zeny-cap cases.
Web candidate adds the five attested settings paths and phase labels. The
schema step uses `ops/ro-stack/apply-live-status-inventory-migration.mjs`
(dry run, explicit apply, tracked-statement exactness, receipt, rollback
statement). Native amendment reason `M1_INVENTORY_MAINTENANCE_V1` is an
approved chain entry limited to six Native files.

Live six-field inspection after deploying `0914b855` found all 22 idle rows
had `supply_required=0` with `supply_reason=SUPPLY_POLICY_UNAVAILABLE`.
The pinned contract requires an empty reason when no consumable shortage exists.
Native `fe57cf945e77e5e4d132e7d3228535adb47420fe` changes only that
projection and its source contract test. The correction uses the same lease,
an appended immutable amendment and the deployed `0914b855` rollback receipt.
