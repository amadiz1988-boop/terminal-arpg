// SERVER_AGENT Web relocation route resolver (presentation-server side only).
//
// W4 seam: a player selects a semantic farm destination in the Web world map.
// The browser sends only `mapId`. This module turns that semantic destination
// into the explicit waypoint sequence the rAthena Persistent Agent navigation
// runtime already accepts (`start_navigation` route + `_resumeMode`).
//
// It is a ROUTE RESOLVER, not a movement engine:
//   - authority for walking, warps, timing, retries, ownership and lifecycle is
//     the rAthena server (Persistent Agent navigation runtime);
//   - the physical topology comes from rAthena-owned warp NPC definitions
//     (`npc/re/warps/**` `warp` entries), never from OpenKore config/status;
//   - only physical walk-warps are edges. Paid / conversational warpers
//     (`Warper`, `Warpra`, `duplicate(...)`) are NPC service scripts and are
//     deliberately NOT part of the direct graph.
//
// Route policy (Phase 3): a Web map change is DIRECT. A hub / Kafra detour is
// only ever justified by a real supply / storage / save-point need, and that
// need is owned by the Persistent Agent supply subsystem, not by this resolver.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// rAthena map names may contain '-' (new_1-3, iz_int01-style variants excluded)
// and '@' (instance maps). The native executor resolves maps via
// map_mapname2mapid, so the planner must accept the same charset or it silently
// drops legitimate warps (e.g. new_1-3 -> iz_ac01 #to_ac01-2).
const mapIdPattern = /^[a-z0-9_@-]{1,31}$/;

// Exactly the warp script lists the rAthena map server itself loads for
// Renewal (npc/re/scripts_main.conf -> these two confs). No pre-renewal and no
// mob/spawn files are consulted.
const ACTIVE_WARP_CONFS = ['npc/scripts_warps.conf', 'npc/re/scripts_warps.conf'];

export function parseWarpConfPaths(text) {
  const paths = [];
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//')) continue;
    const match = line.match(/^npc:\s*(\S+)/);
    if (match) paths.push(match[1]);
  }
  return paths;
}

// Build the physical warp graph from the LIVE map-server runtime tree.
export async function loadWarpGraph(runtimeRoot) {
  const scripts = [];
  for (const conf of ACTIVE_WARP_CONFS) {
    try {
      scripts.push(...parseWarpConfPaths(await readFile(join(runtimeRoot, conf), 'utf8')));
    } catch {
      // Conf absent: contributes no warps.
    }
  }
  let text = '';
  for (const relative of scripts) {
    try {
      text += (await readFile(join(runtimeRoot, relative), 'utf8')) + '\n';
    } catch {
      // Missing script file contributes no warps (the map server would reject it too).
    }
  }
  return buildWarpGraph(parseWarpScripts(text));
}

// rAthena warp script line:
//   <map>,<x>,<y>,<dir>\twarp\t<name>\t<xs>,<ys>,<toMap>,<toX>,<toY>
export function parseWarpScripts(text) {
  const warps = [];
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//') || line.startsWith('#')) continue;
    const fields = line.split(/\s+/);
    if (fields.length < 4 || fields[1] !== 'warp') continue;
    const head = fields[0].split(',');
    if (head.length < 4) continue;
    const [map, x, y] = head;
    if (!mapIdPattern.test(map) || !/^\d+$/.test(x) || !/^\d+$/.test(y)) continue;
    const dest = fields[3].split(',');
    if (dest.length < 5) continue;
    const [xs, ys, to, toX, toY] = dest;
    if (
      !mapIdPattern.test(to) ||
      !/^\d+$/.test(xs) || !/^\d+$/.test(ys) ||
      !/^\d+$/.test(toX) || !/^\d+$/.test(toY)
    )
      continue;
    if (Number(xs) <= 0 || Number(ys) <= 0) continue;
    warps.push({
      map,
      x: Number(x),
      y: Number(y),
      name: fields[2] ?? '',
      to,
      toX: Number(toX),
      toY: Number(toY),
      xs: Number(xs),
      ys: Number(ys),
    });
  }
  return warps;
}

export function buildWarpGraph(warps) {
  const graph = new Map();
  for (const warp of warps) {
    if (warp.map === warp.to) continue;
    if (!graph.has(warp.map)) graph.set(warp.map, []);
    graph.get(warp.map).push(warp);
  }
  return graph;
}

// All canonical physical warps that can move `fromMap` -> `toMap`, ordered by a
// stable canonical identity (trigger cell, then warp name). A destination map
// can be served by several redundant warps with different trigger cells; this
// only enumerates them. Callers that must walk to the trigger choose the
// reachable one with the native path search at runtime (the Persistent Agent
// applies that rule authoritatively), so no candidate is silently assumed.
export function listWarpCandidates(graph, fromMap, toMap) {
  if (!mapIdPattern.test(String(fromMap)) || !mapIdPattern.test(String(toMap)))
    return [];
  return (graph.get(fromMap) ?? [])
    .filter((warp) => warp.to === toMap)
    .slice()
    .sort(
      (left, right) =>
        left.x - right.x ||
        left.y - right.y ||
        String(left.name ?? '').localeCompare(String(right.name ?? '')),
    );
}

// Breadth-first search over physical map warps. Returns the ordered hop list
// (one physical warp per hop) or null when no walk route exists.
export function findWarpPath(graph, fromMap, toMap) {
  if (!mapIdPattern.test(String(fromMap)) || !mapIdPattern.test(String(toMap)))
    return null;
  if (fromMap === toMap) return [];
  const visited = new Set([fromMap]);
  const queue = [[fromMap, []]];
  for (let index = 0; index < queue.length; index++) {
    const [map, path] = queue[index];
    const warps = (graph.get(map) ?? [])
      .slice()
      .sort((left, right) =>
        (left.to === toMap ? 0 : 1) - (right.to === toMap ? 0 : 1),
      );
    for (const warp of warps) {
      if (visited.has(warp.to)) continue;
      const next = [...path, warp];
      if (warp.to === toMap) return next;
      visited.add(warp.to);
      queue.push([warp.to, next]);
    }
  }
  return null;
}

// Convert hops into the Persistent Agent navigation route shape. Each hop is a
// warp step (`portalTo`); a final arrival step lands the character on the warp
// destination cell so the agent can resume its farm policy there.
export function buildRouteSteps(path) {
  if (!Array.isArray(path) || path.length === 0) return null;
  if (path.length > 15) return null;
  const steps = path.map((hop) => ({
    map: hop.map,
    x: hop.x,
    y: hop.y,
    portalTo: hop.to,
  }));
  const last = path[path.length - 1];
  steps.push({ map: last.to, x: last.toX, y: last.toY });
  return steps;
}

// Phase 3 route decision policy. The Web adapter calls this for every map
// selection. `needsService` is only true when a real supply / storage /
// save-point action is required at the destination; an ordinary farm-map change
// stays DIRECT and must never detour through a town / Kafra hub.
export function decideRelocationPolicy({ needsService = false } = {}) {
  return needsService ? 'SERVICE' : 'DIRECT';
}

// Full server-side resolution for a Web map selection.
// Returns { policy, route, hops } or { policy, route: null, reason } when the
// destination cannot be reached by walking. The caller must treat `route:null`
// as a bounded failure (never an unbounded navigation attempt).
export function planWebRelocation(graph, currentMap, targetMap, { needsService = false } = {}) {
  const policy = decideRelocationPolicy({ needsService });
  if (policy === 'SERVICE')
    return { policy, route: null, reason: 'service_relocation_required' };
  if (!mapIdPattern.test(String(targetMap)))
    return { policy, route: null, reason: 'invalid_target_map' };
  if (currentMap === targetMap)
    return { policy, route: null, reason: 'already_at_destination', hops: 0 };
  const path = findWarpPath(graph, currentMap, targetMap);
  if (!path || path.length === 0)
    return { policy, route: null, reason: 'no_direct_route' };
  const route = buildRouteSteps(path);
  if (!route) return { policy, route: null, reason: 'route_unrepresentable' };
  return { policy, route, hops: path.length };
}

// Terminal-route adapter for controller-owned service destinations. Topology is
// still resolved exclusively by planWebRelocation; this only replaces the final
// landing cell with the configured service handoff point.
export function buildTerminalRoute(graph, currentMap, targetMap, targetX, targetY) {
  if (!mapIdPattern.test(String(currentMap)) ||
      !mapIdPattern.test(String(targetMap)) ||
      !Number.isSafeInteger(targetX) || targetX < 0 || targetX > 32767 ||
      !Number.isSafeInteger(targetY) || targetY < 0 || targetY > 32767)
    return null;
  if (currentMap === targetMap)
    return [{ map: currentMap, x: targetX, y: targetY }];
  const plan = planWebRelocation(graph, currentMap, targetMap);
  if (!plan?.route) return null;
  const last = plan.route[plan.route.length - 1];
  if (!last || last.portalTo || last.map !== targetMap) return null;
  return plan.route.map((step, index) =>
    index === plan.route.length - 1
      ? { ...step, x: targetX, y: targetY }
      : step,
  );
}
