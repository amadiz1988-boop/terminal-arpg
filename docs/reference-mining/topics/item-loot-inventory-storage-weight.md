# Mining Dossier: Item, Loot, Inventory, Storage and Weight

```text
TOPIC_ID = ITEM_LOOT_INVENTORY_STORAGE_WEIGHT
QUESTION = Which mature item and inventory invariants must PA preserve for loot, identify, supply and storage without making local inventory state authoritative?
PROJECT_RELEVANCE = AutoLoot, Auto-Identify, Inventory, Storage, Supply, Fly Wing, Butterfly Wing and weight-triggered return.
UPSTREAM_SOURCE_CHECKED = rAthena source at native HEAD 389337236afe67b380385095d1a0d103edaf901a; OpenKore master reference commit 51de1ddfc4449ae5217f6886de702f87ca934030.
FORUM / WIKI FINDINGS = No forum claim was promoted. Current source and official rAthena docs were sufficient for the examined invariants.
CURRENT_VERSION_APPLICABLE = PARTIAL
PROJECT_LAST_GOOD_CHECKED = Gate 1A loot; Gate 1B item recovery and Fly Wing; Gate 2 inventory/Zeny confirmation; docs/openkore-reference/supply.md; docs/testing-fixture-policy.md.
CLASSIFICATION = ADAPT
CANONICAL_SOURCE_POINTERS = See tables below.
PROJECT_USAGE = PA observes and requests; rAthena owns item, inventory, weight, storage and transaction results.
KNOWN_RISKS = stale snapshot, duplicate item identity, overweight, full slots, storage session timeout, restart durability and false command-success interpretation.
STALE / VERSION CONFLICT = OpenKore client-packet and local config behavior is historical reference; rAthena native state overrides it. No direct semantic conflict was found in the reviewed paths.
ATLAS_UPDATED = YES
```

## Version and source baseline

| Source | Baseline | Status |
|---|---|---|
| Project Native | `C:\Users\Administrator\source\ghost-island-rathena`, `389337236afe67b380385095d1a0d103edaf901a` | Current source inspected |
| rAthena Atlas | `e985006171d2eb320ee512a653f4c83aea3d81b6` | Public master baseline recorded by Atlas |
| OpenKore Atlas | `51de1ddfc4449ae5217f6886de702f87ca934030` | Reference only, runtime count remains zero |

## Mature behavior extracted

| Behavior | OpenKore mature pattern | rAthena current authority | Project mapping |
|---|---|---|---|
| Loot | Observe drop, approach, pickup, reconcile inventory, resume combat or scan | `mob.cpp` creates drop/pickup flow; `pc_additem` validates result | `ADAPT`: PA may request and resume only after authoritative inventory/event |
| Item use | Available → requested → confirmed/rejected; cooldown and state reread | `pc_useitem` and item database semantics | `ADAPT`: command accepted never proves consumption or movement |
| Inventory | Wait until ready, use snapshot to gate dependent action, reread after transaction | `map_session_data::inventory`, `pc_search_inventory`, `pc_additem` | `ADAPT`: inventory is observation and server authority |
| Weight | Threshold warning before movement/pickup is blocked; avoid repeating unchanged service | `pc_getpercentweight`, `pc_updateweightstatus`, `pc_additem` | `ADAPT`: threshold is PA policy input; rAthena decides weight result |
| Storage | Route, open session, deposit, close, confirm capacity | `storage_storageopen`, `storage_storageadd`, `storage_storageget`, `storage_storageclose` | `ADAPT`: storage transaction remains server-owned |
| Shop | Low resource → route → transaction → inventory/Zeny confirmation | `vending.cpp`, shop/NPC and `pc_additem` | `ADAPT`: buy result must be confirmed by rAthena state |
| Identify | Select unidentified item and confirm item flag | `clif.cpp` identify handlers, item `identify` field | `ADAPT`: Auto-Identify must observe server item flag |

## Canonical source pointers

### rAthena

- Item weight is loaded from item data in `src/map/itemdb.cpp`; item stack and storage flags are also item database fields.
- `src/map/pc.cpp:3020-3059` calculates weight percentage and transitions overweight status.
- `src/map/pc.cpp:5976-6055` searches inventory and rejects invalid, overamount, overweight and full-slot additions before mutation.
- `src/map/storage.cpp:133-189` opens storage and validates storage insertion conditions.
- `src/map/storage.cpp:241-378` adds/removes storage items and only removes inventory after storage acceptance.
- `src/map/storage.cpp:458-505` saves and closes storage, preserving the session boundary.
- `src/map/vending.cpp:147-228` checks free slots, aggregate weight, item legality and then calls `pc_additem` for a purchase.
- `src/map/clif.cpp` identify handlers expose the authoritative `identify` flag and acknowledgement result.
- Official support: `doc/item_db.txt`, `doc/mob_db.txt`, `doc/item_group.txt`, `doc/packet_client.txt`, `doc/script_commands.txt`.

### OpenKore

- `src/AI/CoreLogic.pm` supplies mature loot, buy/sell, storage and weight policy behavior.
- `src/Actor/Item.pm` and `src/InventoryList.pm` model observed item and inventory snapshots.
- `src/Commands.pm` provides item, shop and storage intents.
- `control/pickupitems.txt`, `control/config.txt` contain policy knobs such as `itemsTakeAuto`, `buyAuto`, `storageAuto`, `itemsMaxWeight` and `itemsMaxWeight_sellOrStore`.
- Existing Atlas topics 13 `LOOT`, 14 `ITEM_USE`, 15 `INVENTORY`, 19 `STORAGE`, 21 `SUPPLY_AUTOMATION` and 22 `WEIGHT_THRESHOLDS` were compared.

## Project Last-Good and current usage

| Project flow | Evidence | Reuse decision |
|---|---|---|
| AutoLoot | Gate 1A loot pickup and Event Ledger | Reuse outcome invariant; do not copy client polling |
| Auto-Identify | rAthena identify field/ack path and item display semantics | Adapt into server-confirmed item flag transition |
| Supply | Gate 2 inventory/Zeny confirmation and `docs/openkore-reference/supply.md` | Preserve low → transaction → return → resume; PA owns lifecycle |
| Fly Wing / Butterfly Wing | Gate 1B item evidence and project non-consumable rule | Confirm position/savepoint and count; never infer from HTTP success |
| Storage | OpenKore historical `storageAuto`; current project player-flow closure absent | Keep as backlog gap; no production claim |
| Weight | Historical `itemsMaxWeight` policy and current rAthena status | Use threshold as policy input; rAthena owns rejection/status |

## State and authority contract

```text
ITEM_INTENT
  -> authenticated command
  -> PA bounded action / supply stage
  -> rAthena item legality and mutation
  -> authoritative inventory / weight / storage / Zeny state
  -> Event Ledger / projection
```

Required invariants:

1. Inventory snapshots can gate an action, but they cannot mutate inventory or override rAthena results.
2. `pc_additem` result is the authoritative outcome for capacity, weight, stack and slot checks.
3. Storage removal happens only after storage acceptance; a local optimistic delete is invalid.
4. Shop acceptance requires inventory and Zeny confirmation; a queued buy command is insufficient.
5. Weight transitions are observed from authoritative weight and status changes, not inferred from a policy threshold alone.
6. Identify state is confirmed through the authoritative item flag or acknowledgement, not a client label.
7. Non-consumable wing policy requires unchanged quantity plus confirmed authoritative position or SavePoint result.

## Known gaps and risks

| Gap | Evidence status | Impact |
|---|---|---|
| Storage player-flow closure | `UNKNOWN / NOT_PROVEN` | Storage return may be misreported as complete |
| Restart durability of inventory-derived PA intent | `PARTIAL` in OpenKore Atlas | Resume can require reconciliation before action |
| Generic PA item action parity | `PARTIAL` | Item action failures need per-item authority evidence |
| Weight-triggered storage flow | `UNKNOWN / NOT_PROVEN` | Supply may stop at weight threshold without bounded service path |
| Party loot ownership | `UNKNOWN / NOT_APPLICABLE` to current solo acceptance | Do not infer multiplayer policy from solo AUTO_FARM |

## Forum and Wiki rule

本輪沒有把 forum 或 wiki 的未回到 source 驗證說法納入成熟解法。後續若遇到 storage edge case、weight timing 或 packet delay 的 community finding，必須先比對 current rAthena source、OpenKore baseline 與 Project Last-Good，再標記 `REUSE`、`ADAPT`、`IMPROVE` 或 `STALE_REFERENCE`。

## Decision

```text
CLASSIFICATION = ADAPT
CURRENT_VERSION_APPLICABLE = PARTIAL
RATHENA_AUTHORITY = PASS
OPENKORE_REFERENCE = PASS, runtime return prohibited
REFERENCE_MINING_GAP = NO for item/loot/inventory core semantics
REFERENCE_MINING_GAP = YES for storage player-flow closure and restart durability
GAMEPLAY_CHANGE = NO
```

The durable rule is to retain OpenKore's mature state/retry invariants while placing item, inventory, weight, storage and transaction authority in rAthena, with PA owning intent and lifecycle. This dossier is evidence for future work and does not authorize gameplay changes.
