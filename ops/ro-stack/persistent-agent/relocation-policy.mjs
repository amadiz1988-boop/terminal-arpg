// SERVER_AGENT Web relocation policy (presentation-server side, PURE).
//
// CP-R1: restores the last-good relocation *decision* semantics that the W4 seam
// collapsed into a single walking-only `no_direct_route`. It is a planner, not a
// movement engine:
//   - authority for walking, warps, timing, retries, ownership and lifecycle is
//     the rAthena Persistent Agent runtime;
//   - the walking topology is the existing grind-hub graph (buildPhysicalMapGraph
//     over rAthena warp definitions), scored by the existing
//     nearestSupplyHubForMap();
//   - cross-region transfer uses the existing Kafra NPC dialogue semantics
//     (TALK_NPC / DIALOG_NEXT / DIALOG_MENU_SELECT). service_transport is NOT used;
//   - the return-to-savepoint primitive is Butterfly Wing item 602 (Kafra Save ->
//     close -> Butterfly Wing -> verify authoritative save point);
//   - Fly Wing item 601 (hunt_relocation_items) is untouched by this module.
//
// The planner only decides HOW TO GET THERE. It never chooses or rewrites the
// farm target: the player-selected persisted target wins.

import { supplyHubs, nearestSupplyHubForMap } from '../grind-hub-routing.mjs';

export const BUTTERFLY_WING_ITEM_ID = 602;
export const FLY_WING_ITEM_ID = 601;

export const RELOCATION_POLICY = Object.freeze({
  DIRECT: 'DIRECT',
  RETURN_TO_SAVEPOINT_BUTTERFLY: 'RETURN_TO_SAVEPOINT_BUTTERFLY',
  KAFRA_DIALOG_TRANSFER: 'KAFRA_DIALOG_TRANSFER',
  UNREACHABLE: 'UNREACHABLE',
});

// Planner states mirror the last-good grind-hub transition stages.
export const RELOCATION_STATE = Object.freeze({
  READY_TO_START_FARM: 'READY_TO_START_FARM',
  ROUTING_TO_HUB: 'ROUTING_TO_HUB',
  SAVING: 'SAVING',
  CLOSING: 'CLOSING',
  VERIFYING_SAVEPOINT: 'VERIFYING_SAVEPOINT',
  SERVICE_DIALOG: 'SERVICE_DIALOG',
  VERIFYING_SERVICE_ARRIVAL: 'VERIFYING_SERVICE_ARRIVAL',
  DIRECT_TO_TARGET: 'DIRECT_TO_TARGET',
});

export const RELOCATION_REASON = Object.freeze({
  FARM_TARGET_INVALID: 'farm_target_invalid',
  HUB_UNREACHABLE: 'hub_unreachable',
  BUTTERFLY_MISSING: 'butterfly_missing',
  SAVEPOINT_VERIFICATION_FAILED: 'savepoint_verification_failed',
  KAFRA_DIALOG_FAILED: 'kafra_dialog_failed',
  SERVICE_DESTINATION_UNAVAILABLE: 'service_destination_unavailable',
  SERVICE_TRANSFER_FAILED: 'service_transfer_failed',
  POST_SERVICE_ROUTE_UNREACHABLE: 'post_service_route_unreachable',
});

export const STEP = Object.freeze({
  DIRECT_TO_HUB: 'DIRECT_TO_HUB',
  KAFRA_SAVE: 'KAFRA_SAVE',
  CLOSE_NPC: 'CLOSE_NPC',
  VERIFY_SAVEPOINT: 'VERIFY_SAVEPOINT',
  BUTTERFLY_WING: 'BUTTERFLY_WING',
  KAFRA_DIALOG_TRANSFER: 'KAFRA_DIALOG_TRANSFER',
  VERIFY_SERVICE_ARRIVAL: 'VERIFY_SERVICE_ARRIVAL',
  DIRECT_TO_TARGET: 'DIRECT_TO_TARGET',
  START_FARM: 'START_FARM',
});

// The coordinator deadline follows the already resolved route length. Native
// execution remains authoritative for movement, retries and arrival.
export const RELOCATION_STEP_BUDGET_MS = 120_000;
export const RELOCATION_STEP_CAP = 16;
export const RELOCATION_BUDGET_CAP_MS = 3_600_000;
export const RELOCATION_COORDINATOR_GRACE_MS = 60_000;

export function coordinatorDeadlineMsForRouteSteps(routeSteps) {
  const requested = Number.isFinite(Number(routeSteps))
    ? Math.trunc(Number(routeSteps))
    : 1;
  const steps = Math.max(1, Math.min(requested, RELOCATION_STEP_CAP));
  const budget = Math.min(
    steps * RELOCATION_STEP_BUDGET_MS,
    RELOCATION_BUDGET_CAP_MS,
  );
  return budget + RELOCATION_COORDINATOR_GRACE_MS;
}

const mapIdPattern = /^[a-z0-9_]{1,31}$/;

function isUsableTarget(target) {
  return target != null && mapIdPattern.test(String(target.targetMap ?? '')) &&
    Number.isInteger(target.mobId) && target.mobId > 0;
}

// Priority: 1) active persisted task target, 2) player-selected grind target,
// 3) canonical fallback ONLY if neither is valid.
export function selectFarmTarget({ persistedTaskTarget = null, selectedGrindTarget = null,
  canonicalFallback = null } = {}) {
  for (const [source, candidate] of [
    ['persisted_task', persistedTaskTarget],
    ['selected', selectedGrindTarget],
    ['canonical_fallback', canonicalFallback],
  ]) {
    if (isUsableTarget(candidate))
      return { targetMap: candidate.targetMap, mobId: candidate.mobId, source };
  }
  return { reason: RELOCATION_REASON.FARM_TARGET_INVALID };
}

// Breadth-first walking route over the grind-hub graph (Map<map, Set<map>>).
export function walkingRoute(graph, fromMap, toMap) {
  if (!mapIdPattern.test(String(fromMap)) || !mapIdPattern.test(String(toMap)))
    return null;
  if (fromMap === toMap)
    return [fromMap];
  const visited = new Set([fromMap]);
  const queue = [[fromMap, [fromMap]]];
  for (let index = 0; index < queue.length; index++) {
    const [map, path] = queue[index];
    for (const next of graph.get(map) ?? []) {
      if (visited.has(next))
        continue;
      const nextPath = [...path, next];
      if (next === toMap)
        return nextPath;
      visited.add(next);
      queue.push([next, nextPath]);
    }
  }
  return null;
}

function hubNpcForMap(mapId) {
  return Object.values(supplyHubs).find((hub) => hub.npcMap === mapId) ?? null;
}

function nearestHubToTarget(targetMap, graph) {
  // Destination side scoring: the Kafra destination city whose saveMap minimises
  // the remaining walking route to the player-selected farm target.
  let best = null;
  for (const hub of Object.values(supplyHubs)) {
    const route = walkingRoute(graph, hub.saveMap, targetMap);
    if (!route)
      continue;
    if (!best || route.length < best.route.length)
      best = { hub, route };
  }
  return best;
}

function unreachable(reason, extra = {}) {
  return { policy: RELOCATION_POLICY.UNREACHABLE, state: null, reason, steps: [], ...extra };
}

// Build the deterministic relocation plan. Pure: identical inputs -> identical
// plan; the selected farm target is never mutated or replaced by the planner.
export function planRelocation({ currentMap, target, graph, mapSummary = null,
  inventory = {}, savePoint = null } = {}) {
  const resolved = isUsableTarget(target) ? target : null;
  if (!resolved)
    return unreachable(RELOCATION_REASON.FARM_TARGET_INVALID);

  const targetMap = resolved.targetMap;
  const base = { targetMap, mobId: resolved.mobId, targetSource: resolved.source ?? null };

  if (currentMap === targetMap) {
    return { policy: RELOCATION_POLICY.DIRECT, state: RELOCATION_STATE.READY_TO_START_FARM,
      reason: null, ...base, steps: [{ kind: STEP.START_FARM, targetMap, mobId: resolved.mobId }] };
  }

  const direct = walkingRoute(graph, currentMap, targetMap);
  if (direct) {
    return { policy: RELOCATION_POLICY.DIRECT, state: RELOCATION_STATE.READY_TO_START_FARM,
      reason: null, ...base,
      steps: [
        { kind: STEP.DIRECT_TO_TARGET, route: direct },
        { kind: STEP.START_FARM, targetMap, mobId: resolved.mobId },
      ] };
  }

  // Cross-region: 1) walking hub scoring, 2) Kafra Save + Butterfly, 3) Kafra
  // dialogue city transfer, 4) post-service walking.
  let hub;
  try {
    hub = nearestSupplyHubForMap(currentMap, graph, mapSummary);
  } catch {
    return unreachable(RELOCATION_REASON.HUB_UNREACHABLE, base);
  }

  const toHub = walkingRoute(graph, currentMap, hub.npcMap);
  if (!toHub)
    return unreachable(RELOCATION_REASON.HUB_UNREACHABLE, base);

  const steps = [{ kind: STEP.DIRECT_TO_HUB, route: toHub, hubId: hub.id }];
  let policy = RELOCATION_POLICY.KAFRA_DIALOG_TRANSFER;
  let stateAfterHub = RELOCATION_STATE.SERVICE_DIALOG;

  const butterflyAvailable = inventory.butterflyWing === true ||
    Number(inventory[String(BUTTERFLY_WING_ITEM_ID)] ?? 0) > 0;
  const savePointVerified = savePoint === hub.saveMap;

  if (butterflyAvailable && !savePointVerified) {
    // Last-good: Kafra Save -> close NPC session -> Butterfly Wing -> verify the
    // authoritative save point equals hub.saveMap.
    policy = RELOCATION_POLICY.RETURN_TO_SAVEPOINT_BUTTERFLY;
    stateAfterHub = RELOCATION_STATE.SAVING;
    steps.push({ kind: STEP.KAFRA_SAVE, hubId: hub.id, npcMap: hub.npcMap, saveMap: hub.saveMap });
    steps.push({ kind: STEP.CLOSE_NPC, hubId: hub.id });
    steps.push({ kind: STEP.VERIFY_SAVEPOINT, expectedMap: hub.saveMap });
    steps.push({ kind: STEP.BUTTERFLY_WING, itemId: BUTTERFLY_WING_ITEM_ID,
      expectedMap: hub.saveMap, saveMap: hub.saveMap });
  }
  // Without a Butterfly Wing the plan simply skips the save-point leg and uses
  // the Kafra dialogue transfer below. BUTTERFLY_MISSING is reported only when a
  // caller explicitly requires the return-to-savepoint policy.

  // After the hub/save-point stage, the remaining walking leg from hub.saveMap to
  // the target. If it is not walkable, use the existing Kafra dialogue transfer to
  // the destination city nearest the player-selected farm target.
  const fromHubToTarget = walkingRoute(graph, hub.saveMap, targetMap);
  if (fromHubToTarget) {
    steps.push({ kind: STEP.DIRECT_TO_TARGET, route: fromHubToTarget });
  } else {
    const destination = nearestHubToTarget(targetMap, graph);
    if (!destination)
      return unreachable(RELOCATION_REASON.SERVICE_DESTINATION_UNAVAILABLE, { ...base, hubId: hub.id });
    const postRoute = destination.route;
    if (!postRoute)
      return unreachable(RELOCATION_REASON.POST_SERVICE_ROUTE_UNREACHABLE, { ...base, hubId: hub.id });
    const transferNpc = hubNpcForMap(hub.saveMap) ?? hub;
    steps.push({
      kind: STEP.KAFRA_DIALOG_TRANSFER,
      policy: 'DIALOG',
      npcMap: transferNpc.npcMap,
      destinationCity: destination.hub.id,
      // Existing native NPC dialogue primitive; the RO script owns ticket/Zeny/warp.
      dialogue: [
        { action: 'TALK_NPC', npcMap: transferNpc.npcMap },
        { action: 'DIALOG_NEXT' },
        { action: 'DIALOG_MENU_SELECT', option: 'Use Teleport Service' },
        { action: 'DIALOG_NEXT' },
        { action: 'DIALOG_MENU_SELECT', city: destination.hub.id },
      ],
    });
    steps.push({ kind: STEP.VERIFY_SERVICE_ARRIVAL, expectedMap: destination.hub.saveMap });
    steps.push({ kind: STEP.DIRECT_TO_TARGET, route: postRoute });
  }
  steps.push({ kind: STEP.START_FARM, targetMap, mobId: resolved.mobId });

  return { policy, state: stateAfterHub, reason: null, ...base, hubId: hub.id, steps };
}

// Build the ordered state sequence a confirmed execution would traverse. Each
// state advances only after authoritative server/read-model confirmation.
export function relocationStateSequence(plan) {
  if (!plan || plan.policy === RELOCATION_POLICY.UNREACHABLE)
    return [];
  const map = {
    [STEP.DIRECT_TO_HUB]: RELOCATION_STATE.ROUTING_TO_HUB,
    [STEP.KAFRA_SAVE]: RELOCATION_STATE.SAVING,
    [STEP.CLOSE_NPC]: RELOCATION_STATE.CLOSING,
    [STEP.VERIFY_SAVEPOINT]: RELOCATION_STATE.VERIFYING_SAVEPOINT,
    [STEP.BUTTERFLY_WING]: RELOCATION_STATE.VERIFYING_SAVEPOINT,
    [STEP.KAFRA_DIALOG_TRANSFER]: RELOCATION_STATE.SERVICE_DIALOG,
    [STEP.VERIFY_SERVICE_ARRIVAL]: RELOCATION_STATE.VERIFYING_SERVICE_ARRIVAL,
    [STEP.DIRECT_TO_TARGET]: RELOCATION_STATE.DIRECT_TO_TARGET,
    [STEP.START_FARM]: RELOCATION_STATE.READY_TO_START_FARM,
  };
  return plan.steps.map((step) => map[step.kind]).filter(Boolean);
}
