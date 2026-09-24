// Authoritative Kafra relocation content (from canonical rAthena scripts).
//
// Sources (all static, reproduced exactly):
//   npc/kafras/functions_kafras.txt  F_Kafra (menu), F_KafSet (@wrpD$/@wrpP),
//                                    F_KafTele (city select + warp coordinates)
//   npc/kafras/kafras.txt            Kafra NPC coordinates + savepoint
//   npc/re/kafras/kafras.txt         izlude explicit duplicate names
//   ops/ro-stack/grind-hub-routing.mjs  supplyHubs npc/save coordinates
//
// Verified facts:
//   - every hub's Kafra uses menu_num=0 -> F_Kafra default menu:
//       [Save, Use Storage, Use Teleport Service, Rent a Pushcart, ...]
//       => saveMenuIndex = 1, transportMenuIndex = 3
//   - F_KafTele menu order == @wrpD$ order (F_KafSet:670 @wrpC$ = @wrpD$ + price)
//       => a destination's cityMenuIndex is its 1-based position in @wrpD$
//   - F_KafTele warp coordinates are the authoritative arrival x/y.
//
// Payment (Free Ticket 7060 / Zeny) and the warp stay inside the rAthena script.
// This module only names WHICH menu entry to select - it never moves Zeny/items.
//
// NPC identity (source-proven, not guessed). rAthena npc_name2id() keys on
// npc_data.exname, which npc_parsename() derives deterministically:
//   - `script Name::Label`  -> exname = Label            (kafras.txt Kafra Employee::kaf_*)
//   - plain `Name` / duplicate name token -> exname = Name (no auto suffix when unique)
// All five labels below are globally unique in the loaded tree, so no
// `i_map_x_y` auto-rename (npc.cpp:3703-3720) applies. Source root:
// src/map/npc.cpp (npc_parsename, npc_parse_duplicate, npc_name2id).

export const KAFRA_CONTENT = Object.freeze({
  prontera: Object.freeze({
    hubId: 'prontera', npcMap: 'prontera', npcX: 151, npcY: 29,
    saveMap: 'prontera', saveX: 150, saveY: 33,
    saveMenuIndex: 1, transportMenuIndex: 3,
    npcName: 'kaf_prontera2', npcNameSource: 'script_label',
    npcQuery: Object.freeze({ map: 'prontera', x: 151, y: 29 }),
    destinations: Object.freeze({
      izlude: Object.freeze({ menuIndex: 1, map: 'izlude', x: 128, y: 98 }),
      geffen: Object.freeze({ menuIndex: 2, map: 'geffen', x: 120, y: 39 }),
      payon: Object.freeze({ menuIndex: 3, map: 'payon', x: 161, y: 58 }),
      morocc: Object.freeze({ menuIndex: 4, map: 'morocc', x: 156, y: 46 }),
      gef_fild10: Object.freeze({ menuIndex: 5, map: 'gef_fild10', x: 52, y: 326 }),
      alberta: Object.freeze({ menuIndex: 6, map: 'alberta', x: 117, y: 56 }),
    }),
  }),
  payon: Object.freeze({
    hubId: 'payon', npcMap: 'payon', npcX: 181, npcY: 104,
    saveMap: 'payon', saveX: 160, saveY: 58,
    saveMenuIndex: 1, transportMenuIndex: 3,
    npcName: 'kaf_payon', npcNameSource: 'script_label',
    npcQuery: Object.freeze({ map: 'payon', x: 181, y: 104 }),
    destinations: Object.freeze({
      prontera: Object.freeze({ menuIndex: 1, map: 'prontera', x: 116, y: 72 }),
      alberta: Object.freeze({ menuIndex: 2, map: 'alberta', x: 117, y: 56 }),
      morocc: Object.freeze({ menuIndex: 3, map: 'morocc', x: 156, y: 46 }),
    }),
  }),
  morocc: Object.freeze({
    hubId: 'morocc', npcMap: 'morocc', npcX: 156, npcY: 97,
    saveMap: 'morocc', saveX: 156, saveY: 46,
    saveMenuIndex: 1, transportMenuIndex: 3,
    npcName: 'kaf_morocc', npcNameSource: 'script_label',
    npcQuery: Object.freeze({ map: 'morocc', x: 156, y: 97 }),
    destinations: Object.freeze({
      prontera: Object.freeze({ menuIndex: 1, map: 'prontera', x: 116, y: 72 }),
      payon: Object.freeze({ menuIndex: 2, map: 'payon', x: 161, y: 58 }),
      alberta: Object.freeze({ menuIndex: 3, map: 'alberta', x: 117, y: 56 }),
      comodo: Object.freeze({ menuIndex: 4, map: 'comodo', x: 209, y: 143 }),
      cmd_fild07: Object.freeze({ menuIndex: 5, map: 'cmd_fild07', x: 127, y: 134 }),
    }),
  }),
  geffen: Object.freeze({
    hubId: 'geffen', npcMap: 'geffen', npcX: 120, npcY: 62,
    saveMap: 'geffen', saveX: 119, saveY: 40,
    saveMenuIndex: 1, transportMenuIndex: 3,
    npcName: 'kaf_geffen', npcNameSource: 'script_label',
    npcQuery: Object.freeze({ map: 'geffen', x: 120, y: 62 }),
    destinations: Object.freeze({
      prontera: Object.freeze({ menuIndex: 1, map: 'prontera', x: 116, y: 72 }),
      aldebaran: Object.freeze({ menuIndex: 2, map: 'aldebaran', x: 168, y: 112 }),
      gef_fild10: Object.freeze({ menuIndex: 3, map: 'gef_fild10', x: 52, y: 326 }),
      mjolnir_02: Object.freeze({ menuIndex: 4, map: 'mjolnir_02', x: 99, y: 351 }),
    }),
  }),
  izlude: Object.freeze({
    hubId: 'izlude', npcMap: 'izlude', npcX: 128, npcY: 148,
    saveMap: 'izlude', saveX: 94, saveY: 103,
    saveMenuIndex: 1, transportMenuIndex: 3,
    npcName: 'Kafra Employee#iz', npcNameSource: 'script_explicit',
    npcQuery: Object.freeze({ map: 'izlude', x: 128, y: 148 }),
    destinations: Object.freeze({
      geffen: Object.freeze({ menuIndex: 1, map: 'geffen', x: 120, y: 39 }),
      payon: Object.freeze({ menuIndex: 2, map: 'payon', x: 161, y: 58 }),
      morocc: Object.freeze({ menuIndex: 3, map: 'morocc', x: 156, y: 46 }),
      aldebaran: Object.freeze({ menuIndex: 4, map: 'aldebaran', x: 168, y: 112 }),
    }),
  }),
});

// Resolve the teleport destination entry for a hub. Fail closed (no guessing,
// no wildcard) when the hub or destination city is unsupported.
export function resolveKafraDestination(hubId, destinationMap) {
  const hub = KAFRA_CONTENT[hubId];
  if (!hub)
    return { reason: 'hub_unreachable' };
  const destination = hub.destinations[destinationMap];
  if (!destination)
    return { reason: 'service_destination_unavailable' };
  return { hubId: hub.hubId, ...destination };
}

// Binding context for relocation-command-surface.mjs, derived from a plan.
// Returns null when the hub's authoritative NPC identity or the destination
// mapping is not available -> the caller fails closed (kafra_dialog_failed).
export function kafraContextForPlan(plan) {
  const save = plan?.steps?.find((s) => s.kind === 'KAFRA_SAVE');
  const transfer = plan?.steps?.find((s) => s.kind === 'KAFRA_DIALOG_TRANSFER');
  const hubId = save?.hubId ?? plan?.hubId;
  const hub = KAFRA_CONTENT[hubId];
  if (!hub || !hub.npcName)
    return null;
  const context = {
    npcName: hub.npcName,
    saveMenuIndex: hub.saveMenuIndex,
    transportMenuIndex: hub.transportMenuIndex,
  };
  if (transfer) {
    const destination = resolveKafraDestination(hub.hubId, transfer.destinationCity);
    if (destination.reason)
      return null;
    context.cityMenuIndex = destination.menuIndex;
  }
  return context;
}
