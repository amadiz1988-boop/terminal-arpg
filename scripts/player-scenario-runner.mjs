import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadWarpGraph,
  planFarmMapChange,
} from '../ops/ro-stack/persistent-agent/map-route.mjs';
import {
  RESULT,
  parseCli,
  helpText,
  createTraceId,
  sleep,
  transition,
  firstBrokenTransition,
  resultFromTransitions,
  extractEventNames,
  eventCheckpoints,
  exitCodeForResult,
  renderHuman,
} from './lib/player-scenario/scenario-core.mjs';
import { traceScenarioResult } from './lib/player-scenario/trace-adapter.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEFAULT_RATHENA_ROOT = 'C:\\Users\\Administrator\\source\\ghost-island-rathena';
const DEFAULT_MAP_INFO_ROOT = join(ROOT, 'public', 'ro', 'data', 'map-info');
const DEFAULT_ITEM_IDS = Object.freeze({ fly: 601, butterfly: 602 });

function boundedNow() {
  return Date.now();
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function itemAmount(item) {
  return numberOrNull(item?.amount ?? item?.count ?? item?.quantity) ?? 0;
}

function normalizeState(body) {
  const character = body?.character ?? {};
  const live = body?.liveStatus ?? body?.live ?? {};
  const derived = body?.derived ?? {};
  const automation = body?.automation ?? {};
  const mode =
    live.agentMode ?? live.mode ?? derived.agentMode ?? automation.mode ??
    body?.persistentAgentRollout?.agentMode ?? null;
  const map = live.map ?? character.map ?? derived.map ?? null;
  const x = numberOrNull(live.x ?? live.playerX ?? character.x ?? derived.playerX);
  const y = numberOrNull(live.y ?? live.playerY ?? character.y ?? derived.playerY);
  const inventory = Array.isArray(body?.inventory)
    ? body.inventory
    : Array.isArray(derived?.inventory)
      ? derived.inventory
      : [];
  const savePoint =
    body?.grindHubTransition?.authoritativeSavePoint?.map ??
    body?.authoritativeSavePoint?.map ??
    derived?.savePoint ?? derived?.saveMap ?? null;
  return {
    raw: body,
    charId: numberOrNull(character.charId ?? body?.account?.characterId),
    map: map == null ? null : String(map),
    x,
    y,
    mode: mode == null ? null : String(mode),
    farmTarget: body?.grindTarget?.mapId ?? body?.grindTarget?.targetMap ??
      live.targetMap ?? derived.targetMap ?? null,
    runtimePhase: live.runtimePhase ?? live.phase ?? derived.runtimePhase ?? null,
    hp: numberOrNull(live.hp ?? character.hp ?? derived.hp),
    sp: numberOrNull(live.sp ?? character.sp ?? derived.sp),
    inventory,
    savePoint: savePoint == null ? null : String(savePoint),
  };
}

function findInventoryItem(state, itemId) {
  return state.inventory.find((item) => Number(item?.itemId) === Number(itemId)) ?? null;
}

function positionChanged(before, after) {
  return Boolean(before && after) &&
    (before.map !== after.map || before.x !== after.x || before.y !== after.y);
}

function commandFromBody(body) {
  const command = body?.command ?? body;
  if (!command || typeof command !== 'object') return null;
  const commandId = command.commandId ?? body?.commandId ?? null;
  return commandId ? { ...command, commandId: String(commandId) } : null;
}

function commandStatusAccepted(command) {
  return ['QUEUED', 'ACCEPTED', 'CONFIRMED'].includes(String(command?.status ?? '').toUpperCase());
}

function commandStatusRejected(command) {
  return ['REJECTED', 'FAILED', 'ERROR'].includes(String(command?.status ?? '').toUpperCase());
}

class ScenarioApi {
  constructor(options, traceId) {
    this.origin = options.origin;
    this.traceId = traceId;
    this.cookie = '';
    this.options = options;
  }

  async request(path, init = {}) {
    const headers = {
      accept: 'application/json',
      'x-scenario-trace-id': this.traceId,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(this.cookie ? { cookie: this.cookie } : {}),
      ...(init.headers ?? {}),
    };
    const response = await fetch(`${this.origin}${path}`, { ...init, headers });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) this.cookie = setCookie.split(';')[0];
    return { status: response.status, ok: response.ok, body, text };
  }

  async login() {
    if (this.options.supportSession) {
      if (this.options.supportSessionCookie) {
        this.cookie = String(this.options.supportSessionCookie).split(';')[0];
        const session = await this.request('/api/session');
        this.options.supportSessionContext = session.body?.supportSession ?? null;
        return { ...session, username: session.body?.account?.username ?? null };
      }
      const adminToken = String(process.env.SYNTHETIC_SUPPORT_ADMIN_TOKEN ?? '');
      if (!adminToken)
        return { ok: false, status: 0, body: { error: 'SUPPORT_ADMIN_TOKEN_REQUIRED' } };
      const response = await this.request('/api/admin/support-sessions', {
        method: 'POST',
        headers: { 'x-ro-local-admin-token': adminToken },
        body: JSON.stringify({
          effectiveCharId: this.options.charId,
          reason: this.options.supportReason,
          mode: this.options.supportMode,
          ttlMinutes: this.options.supportTtlMinutes,
        }),
      });
      if (response.ok) this.options.supportSessionContext = response.body?.supportSession ?? null;
      return { ...response, username: response.body?.supportSession?.effectiveUsername ?? null };
    }
    const credentials = JSON.parse(await readFile(resolve(ROOT, this.options.credentials), 'utf8'));
    const username = this.options.username ?? credentials.username;
    if (!username)
      return { ok: false, status: 0, body: { error: 'AUTH_USERNAME_REQUIRED' } };
    const response = await this.request('/api/account', {
      method: 'POST',
      body: JSON.stringify({
        username,
        password: credentials.password,
        sex: process.env.SYNTHETIC_PLAYER_SEX ?? 'F',
      }),
    });
    return { ...response, username };
  }

  async state() {
    const response = await this.request('/api/state?view=full');
    return { ...response, state: normalizeState(response.body) };
  }

  async events(cursor = null) {
    const query = cursor == null ? 'interest=combat' : `interest=combat&cursor=${encodeURIComponent(cursor)}`;
    const response = await this.request(`/api/events?${query}`);
    const body = response.body ?? {};
    return {
      ...response,
      cursor: Number.isInteger(Number(body.cursor)) ? Number(body.cursor) : cursor,
      names: extractEventNames({ lines: body.lines ?? [], combatDelta: body.combatDelta ?? null }),
      raw: body,
    };
  }

  async command(charId, commandId) {
    return this.request(`/api/ro/agents/${Number(charId)}/ownership/commands/${encodeURIComponent(commandId)}`);
  }
}

async function loadMapMetadata(mapId) {
  if (!mapId) return null;
  try {
    return JSON.parse(await readFile(join(DEFAULT_MAP_INFO_ROOT, `${mapId}.json`), 'utf8'));
  } catch {
    return null;
  }
}

async function resolveRuntimeRoot(options) {
  const roots = [options.runtimeRoot ?? DEFAULT_RATHENA_ROOT]
    .filter(Boolean)
    .map((value) => resolve(value));
  for (const root of roots) {
    if (existsSync(join(root, 'npc', 'scripts_warps.conf')) ||
        existsSync(join(root, 'rathena', 'npc', 'scripts_warps.conf')))
      return existsSync(join(root, 'npc', 'scripts_warps.conf')) ? root : join(root, 'rathena');
  }
  return null;
}

async function mapFeasibility(options, sourceMap, targetMap) {
  if (!await loadMapMetadata(sourceMap))
    return { map: targetMap, farmEligible: false, relocationSupported: false, routeFound: false, reason: 'INVALID_SOURCE_MAP' };
  const map = await loadMapMetadata(targetMap);
  if (!map)
    return { map: targetMap, farmEligible: false, relocationSupported: false, routeFound: false, reason: 'INVALID_DESTINATION_MAP' };
  const farmEligible = Number(map.normalMonsterCount ?? 0) > 0 ||
    Number(map.combatMonsterCount ?? 0) > 0 || Number(map.bossCount ?? 0) > 0 ||
    (map.primaryMonsters?.length ?? 0) > 0;
  if (!farmEligible)
    return { map: targetMap, farmEligible: false, relocationSupported: false, routeFound: false, reason: 'NON_FARM' };
  const runtimeRoot = await resolveRuntimeRoot(options);
  if (!runtimeRoot)
    return { map: targetMap, farmEligible: true, relocationSupported: false, routeFound: false, reason: 'RUNTIME_WARP_GRAPH_UNAVAILABLE' };
  const graph = await loadWarpGraph(runtimeRoot);
  return { map: targetMap, farmEligible: true, ...summarizeFarmMapPlan(graph, sourceMap, targetMap) };
}

export function summarizeFarmMapPlan(graph, sourceMap, targetMap) {
  // Match the player endpoint's full weighted farm-map planner. The direct
  // physical-only plan can report NO_DIRECT_ROUTE while a legal Kafra/service
  // plan exists; dry-run must not misclassify that destination as unsupported.
  const plan = planFarmMapChange(graph, sourceMap, targetMap);
  const routeFound = plan.mode !== 'UNREACHABLE';
  return {
    relocationSupported: routeFound,
    routeFound,
    reason: routeFound ? null : String(plan.reason ?? 'ROUTE_UNAVAILABLE').toUpperCase(),
    routeSteps: plan.steps ?? [],
    hops: plan.routeCost ?? 0,
    terminal: routeFound ? plan.steps?.at(-1)?.kind ?? null : null,
    policy: routeFound ? plan.policy : null,
    routeQuality: routeFound ? plan.routeQuality ?? null : null,
    feasibilityScope: 'GRAPH_AND_KAFRA_WITHOUT_CHARACTER_INVENTORY_OR_SAVEPOINT',
  };
}

async function runMapMatrix(options, traceId) {
  const targets = options.targetMap ? [options.targetMap] : ['mjolnir_07', 'pay_fild04'];
  const matrix = [];
  for (const target of targets)
    matrix.push(await mapFeasibility(options, options.sourceMap, target));
  return {
    scenario: 'change-farm-map',
    traceId,
    precondition: `source=${options.sourceMap}`,
    action: 'planner feasibility only',
    matrix,
    result: RESULT.PASS,
    failReason: null,
    firstBrokenTransition: null,
    durationMs: 0,
  };
}

function blockedResult(scenario, traceId, reason, precondition = 'NOT_EXECUTED', action = 'not dispatched') {
  return {
    scenario,
    traceId,
    charId: null,
    precondition,
    action,
    api: transition('HTTP -> Controller', false, reason),
    controller: transition('Controller -> Command', false, reason),
    command: transition('Command -> Native Receive', false, reason),
    native: transition('Native Receive -> Native Result', false, reason),
    state: transition('Native Result -> Authoritative State', false, reason),
    events: transition('Authoritative State -> Event Ledger', false, reason),
    firstBrokenTransition: 'HTTP -> Controller',
    result: RESULT.BLOCKED,
    failReason: reason,
    durationMs: 0,
  };
}

async function observeWindow(api, charId, options, predicate, requiredEvents = []) {
  const started = boundedNow();
  let cursor = null;
  let stateResult = await api.state();
  let eventResult = await api.events();
  cursor = eventResult.cursor;
  const names = new Set(eventResult.names);
  let lastCommand = null;
  let lastError = null;
  while (boundedNow() - started <= options.timeoutMs) {
    if (predicate(stateResult.state, names))
      return { stateResult, names: [...names], lastCommand, lastError, timedOut: false };
    await sleep(Math.min(500, Math.max(100, options.timeoutMs / 40)));
    stateResult = await api.state();
    if (!stateResult.ok) lastError = stateResult.body?.error ?? `state_http_${stateResult.status}`;
    eventResult = await api.events(cursor);
    if (!eventResult.ok) lastError = eventResult.body?.error ?? `events_http_${eventResult.status}`;
    cursor = eventResult.cursor ?? cursor;
    for (const name of eventResult.names) names.add(name);
    if (predicate(stateResult.state, names))
      return { stateResult, names: [...names], lastCommand, lastError, timedOut: false };
  }
  return { stateResult, names: [...names], lastCommand, lastError, timedOut: true };
}

async function waitForCommandAndState(api, charId, commandId, options, predicate, requiredEvents = []) {
  const started = boundedNow();
  let cursor = null;
  let stateResult = await api.state();
  let eventResult = await api.events();
  cursor = eventResult.cursor;
  const names = new Set(eventResult.names);
  let commandResult = null;
  let command = null;
  let lastError = null;
  while (boundedNow() - started <= options.timeoutMs) {
    if (commandId) {
      commandResult = await api.command(charId, commandId);
      command = commandResult.body?.command ?? commandResult.body ?? null;
      if (commandResult.status >= 400) lastError = commandResult.body?.error ?? `command_http_${commandResult.status}`;
      if (commandStatusRejected(command)) break;
    }
    stateResult = await api.state();
    if (!stateResult.ok) lastError = stateResult.body?.error ?? `state_http_${stateResult.status}`;
    eventResult = await api.events(cursor);
    if (!eventResult.ok) lastError = eventResult.body?.error ?? `events_http_${eventResult.status}`;
    cursor = eventResult.cursor ?? cursor;
    for (const name of eventResult.names) names.add(name);
    if (predicate(stateResult.state, names)) break;
    await sleep(Math.min(500, Math.max(100, options.timeoutMs / 40)));
  }
  const events = eventCheckpoints([...names], requiredEvents);
  return {
    stateResult,
    command,
    commandResult,
    names: [...names],
    eventCheckpoints: events,
    lastError,
    timedOut: boundedNow() - started > options.timeoutMs,
  };
}

async function executeAutomation(options, traceId, scenario) {
  const api = new ScenarioApi(options, traceId);
  const login = await api.login();
  if (!login.ok)
    return blockedResult(scenario, traceId, login.body?.error ?? 'AUTH_FAILED');
  const beforeResult = await api.state();
  const before = beforeResult.state;
  const charId = options.charId ?? before.charId;
  if (!charId || (options.charId && before.charId && Number(options.charId) !== Number(before.charId)))
    return blockedResult(scenario, traceId, 'CHARACTER_OWNERSHIP_MISMATCH', `observed=${before.charId}`);
  const isStart = scenario === 'start-farm';
  const isStop = scenario === 'stop-farm';
  const action = isStart ? 'start' : 'stop';
  if (isStart && before.mode === 'AUTO_FARM')
    return blockedResult(scenario, traceId, 'PRECONDITION_ALREADY_AUTO_FARM', `mode=${before.mode}`);
  if (isStop && before.mode !== 'AUTO_FARM')
    return blockedResult(scenario, traceId, 'PRECONDITION_NOT_AUTO_FARM', `mode=${before.mode ?? 'UNKNOWN'}`);
  const response = await api.request('/api/automation', {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
  const command = commandFromBody(response.body);
  const apiStep = transition('HTTP -> Controller', response.status >= 200 && response.status < 300,
    response.body?.error ?? `http_${response.status}`, { httpStatus: response.status, body: response.body });
  const controllerStep = transition('Controller -> Command', apiStep.ok &&
    (response.body?.executor === 'SERVER_AGENT' || command || response.body?.policy),
    apiStep.ok ? null : response.body?.error ?? 'controller_not_entered');
  if (!apiStep.ok) {
    return {
      scenario, traceId, charId, precondition: `mode=${before.mode ?? 'UNKNOWN'} map=${before.map ?? 'UNKNOWN'}`,
      action: `POST /api/automation { action: ${action} }`, api: apiStep, controller: controllerStep,
      command: transition('Command -> Native Receive', false, 'command_not_created'),
      native: transition('Native Receive -> Native Result', false, 'command_not_created'),
      state: transition('Native Result -> Authoritative State', false, 'controller_rejected'),
      events: transition('Authoritative State -> Event Ledger', false, 'controller_rejected'),
      firstBrokenTransition: firstBrokenTransition([apiStep, controllerStep]),
      result: RESULT.FAIL, failReason: response.body?.error ?? `http_${response.status}`, durationMs: 0,
    };
  }
  const observation = await waitForCommandAndState(
    api,
    charId,
    command?.commandId ?? null,
    options,
    (state) => (isStart ? state.mode === 'AUTO_FARM' : state.mode === 'PERSISTENT_IDLE'),
  );
  const commandAccepted = command ? commandStatusAccepted(observation.command) : false;
  const commandStep = transition('Command -> Native Receive', Boolean(command), command ? null : 'command_pending_coordinator');
  const nativeStep = transition('Native Receive -> Native Result', commandAccepted,
    commandAccepted ? null : observation.command?.reasonCode ?? observation.command?.status ?? 'native_result_timeout',
    { status: observation.command?.status ?? null, reasonCode: observation.command?.reasonCode ?? null });
  const stateOk = isStart ? observation.stateResult.state.mode === 'AUTO_FARM' : observation.stateResult.state.mode === 'PERSISTENT_IDLE';
  const stateStep = transition('Native Result -> Authoritative State', stateOk,
    stateOk ? null : `mode=${observation.stateResult.state.mode ?? 'UNKNOWN'}`,
    { mode: observation.stateResult.state.mode });
  const eventsStep = transition('Authoritative State -> Event Ledger', !observation.lastError,
    observation.lastError);
  const transitions = [apiStep, controllerStep, commandStep, nativeStep, stateStep, eventsStep];
  return {
    scenario, traceId, charId, precondition: `mode=${before.mode ?? 'UNKNOWN'} map=${before.map ?? 'UNKNOWN'}`,
    action: `POST /api/automation { action: ${action} }`, api: apiStep, controller: controllerStep,
    command: commandStep, native: nativeStep, state: stateStep, events: eventsStep,
    firstBrokenTransition: firstBrokenTransition(transitions),
    result: resultFromTransitions(transitions),
    failReason: transitions.find((entry) => !entry.ok)?.reason ?? null,
    durationMs: 0,
    commandId: command?.commandId ?? null,
    observed: { before, after: observation.stateResult.state, command: observation.command },
  };
}

async function executeChangeMap(options, traceId) {
  const api = new ScenarioApi(options, traceId);
  const login = await api.login();
  if (!login.ok) return blockedResult('change-farm-map', traceId, login.body?.error ?? 'AUTH_FAILED');
  const beforeResult = await api.state();
  const before = beforeResult.state;
  const charId = options.charId ?? before.charId;
  if (!charId || (options.charId && before.charId && Number(options.charId) !== Number(before.charId)))
    return blockedResult('change-farm-map', traceId, 'CHARACTER_OWNERSHIP_MISMATCH', `observed=${before.charId}`);
  const target = options.targetMap;
  if (options.sourceMap && before.map !== options.sourceMap)
    return blockedResult('change-farm-map', traceId, 'SOURCE_MAP_MISMATCH', `observed=${before.map ?? 'UNKNOWN'} expected=${options.sourceMap}`);
  if (!target) return blockedResult('change-farm-map', traceId, 'TARGET_MAP_REQUIRED');
  const response = await api.request('/api/grind-target', {
    method: 'POST',
    body: JSON.stringify({ mapId: target }),
  });
  const command = commandFromBody(response.body);
  const apiStep = transition('HTTP -> Controller', response.status >= 200 && response.status < 300,
    response.body?.error ?? `http_${response.status}`, { httpStatus: response.status, body: response.body });
  const controllerStep = transition('Controller -> Command', apiStep.ok &&
    (response.body?.policy || response.body?.grindTarget || command),
    apiStep.ok ? null : response.body?.error ?? 'controller_not_entered');
  if (!apiStep.ok) {
    return {
      scenario: 'change-farm-map', traceId, charId,
      precondition: `map=${before.map ?? 'UNKNOWN'} target=${target}`,
      action: `POST /api/grind-target { mapId: ${target} }`, api: apiStep, controller: controllerStep,
      command: transition('Command -> Native Receive', false, 'command_not_created'),
      native: transition('Native Receive -> Native Result', false, 'command_not_created'),
      state: transition('Native Result -> Authoritative State', false, 'controller_rejected'),
      events: transition('Authoritative State -> Event Ledger', false, 'controller_rejected'),
      firstBrokenTransition: firstBrokenTransition([apiStep, controllerStep]),
      result: RESULT.FAIL, failReason: response.body?.error ?? `http_${response.status}`, durationMs: 0,
    };
  }
  const observation = await waitForCommandAndState(
    api, charId, command?.commandId ?? null, options,
    (state) => state.map === target && state.farmTarget === target && state.mode === 'AUTO_FARM',
  );
  const commandStep = transition('Command -> Native Receive', Boolean(command) || Boolean(response.body?.policy),
    command || response.body?.policy ? null : 'command_pending_coordinator');
  const nativeStep = transition('Native Receive -> Native Result', !command || commandStatusAccepted(observation.command),
    command ? observation.command?.reasonCode ?? observation.command?.status ?? 'native_result_timeout' : 'coordinator_pending');
  const state = observation.stateResult.state;
  const arrival = state.map === target;
  const targetSaved = state.farmTarget === target;
  const resumed = state.mode === 'AUTO_FARM';
  const stateStep = transition('Native Result -> Authoritative State', arrival && targetSaved && resumed,
    arrival && targetSaved && resumed ? null : `arrival=${arrival} farmTarget=${targetSaved} mode=${state.mode ?? 'UNKNOWN'}`,
    { arrival, farmTarget: state.farmTarget, mode: state.mode });
  const eventsStep = transition('Authoritative State -> Event Ledger', !observation.lastError,
    observation.lastError);
  const transitions = [apiStep, controllerStep, commandStep, nativeStep, stateStep, eventsStep];
  return {
    scenario: 'change-farm-map', traceId, charId,
    precondition: `map=${before.map ?? 'UNKNOWN'} target=${target}`,
    action: `POST /api/grind-target { mapId: ${target} }`, api: apiStep, controller: controllerStep,
    command: commandStep, native: nativeStep, state: stateStep, events: eventsStep,
    firstBrokenTransition: firstBrokenTransition(transitions), result: resultFromTransitions(transitions),
    failReason: transitions.find((entry) => !entry.ok)?.reason ?? null, durationMs: 0,
    commandId: command?.commandId ?? null,
    relocationSupported: Boolean(response.body?.route || response.body?.policy === 'DIRECT'),
    routeFound: Boolean(response.body?.route || response.body?.policy === 'DIRECT'),
    terminal: response.body?.policy ?? null,
    arrival,
    farmTarget: state.farmTarget,
    autoFarmResumed: resumed,
    commandResult: observation.command?.status ?? null,
    observed: { before, after: state, route: response.body?.route ?? null },
  };
}

async function executeWing(options, traceId, itemId) {
  const scenario = itemId === DEFAULT_ITEM_IDS.fly ? 'use-fly-wing' : 'use-butterfly-wing';
  const expectedItemId = scenario === 'use-fly-wing' ? DEFAULT_ITEM_IDS.fly : DEFAULT_ITEM_IDS.butterfly;
  if (itemId !== expectedItemId)
    return blockedResult(scenario, traceId, `ITEM_ID_MISMATCH_EXPECTED_${expectedItemId}`);
  const api = new ScenarioApi(options, traceId);
  const login = await api.login();
  if (!login.ok) return blockedResult(scenario, traceId, login.body?.error ?? 'AUTH_FAILED');
  const beforeResult = await api.state();
  const before = beforeResult.state;
  const charId = options.charId ?? before.charId;
  const item = findInventoryItem(before, itemId);
  if (!charId || (options.charId && before.charId && Number(options.charId) !== Number(before.charId)))
    return blockedResult(scenario, traceId, 'CHARACTER_OWNERSHIP_MISMATCH', `observed=${before.charId}`);
  if (!item) return blockedResult(scenario, traceId, `ITEM_${itemId}_UNAVAILABLE`, `map=${before.map ?? 'UNKNOWN'}`);
  const response = await api.request('/api/item-action', {
    method: 'POST',
    body: JSON.stringify({
      action: 'use', itemId, inventoryIndex: item.inventoryIndex,
      binId: item.binId, inventoryGeneration: item.inventoryGeneration,
    }),
  });
  const command = commandFromBody(response.body);
  const apiStep = transition('HTTP -> Controller', response.status >= 200 && response.status < 300,
    response.body?.error ?? `http_${response.status}`, { httpStatus: response.status, body: response.body });
  const controllerStep = transition('Controller -> Command', apiStep.ok && Boolean(command),
    apiStep.ok ? (command ? null : 'command_not_created') : response.body?.error);
  if (!apiStep.ok) {
    return {
      scenario, traceId, charId,
      precondition: `map=${before.map ?? 'UNKNOWN'} item=${itemId} count=${itemAmount(item)}`,
      action: `POST /api/item-action { action: use, itemId: ${itemId} }`, api: apiStep, controller: controllerStep,
      command: transition('Command -> Native Receive', false, 'command_not_created'),
      native: transition('Native Receive -> Native Result', false, 'command_not_created'),
      state: transition('Native Result -> Authoritative State', false, 'controller_rejected'),
      events: transition('Authoritative State -> Event Ledger', false, 'controller_rejected'),
      firstBrokenTransition: firstBrokenTransition([apiStep, controllerStep]),
      result: RESULT.FAIL, failReason: response.body?.error ?? `http_${response.status}`, durationMs: 0,
    };
  }
  const observation = await waitForCommandAndState(
    api, charId, command?.commandId ?? null, options,
    (state) => positionChanged(before, state),
  );
  const after = observation.stateResult.state;
  const commandStep = transition('Command -> Native Receive', Boolean(command), command ? null : 'command_not_created');
  const nativeStep = transition('Native Receive -> Native Result', commandStatusAccepted(observation.command),
    observation.command?.reasonCode ?? observation.command?.status ?? 'native_result_timeout',
    { status: observation.command?.status ?? null, reasonCode: observation.command?.reasonCode ?? null });
  const changed = positionChanged(before, after);
  const afterItem = findInventoryItem(after, itemId);
  const countUnchanged = afterItem ? itemAmount(afterItem) === itemAmount(item) : false;
  const savePointOk = itemId === DEFAULT_ITEM_IDS.fly ||
    (Boolean(after.savePoint) && after.map === after.savePoint);
  const stateStep = transition('Native Result -> Authoritative State', changed && countUnchanged && savePointOk,
    changed && countUnchanged && savePointOk ? null :
      `positionChanged=${changed} countUnchanged=${countUnchanged} savePoint=${after.savePoint ?? 'UNKNOWN'}`,
    { before, after, countBefore: itemAmount(item), countAfter: afterItem ? itemAmount(afterItem) : null });
  const eventsStep = transition('Authoritative State -> Event Ledger', !observation.lastError,
    observation.lastError);
  const transitions = [apiStep, controllerStep, commandStep, nativeStep, stateStep, eventsStep];
  return {
    scenario, traceId, charId,
    precondition: `map=${before.map ?? 'UNKNOWN'} item=${itemId} count=${itemAmount(item)}`,
    action: `POST /api/item-action { action: use, itemId: ${itemId} }`, api: apiStep, controller: controllerStep,
    command: commandStep, native: nativeStep, state: stateStep, events: eventsStep,
    firstBrokenTransition: firstBrokenTransition(transitions), result: resultFromTransitions(transitions),
    failReason: transitions.find((entry) => !entry.ok)?.reason ?? null, durationMs: 0,
    commandId: command?.commandId ?? null, observed: { before, after },
  };
}

async function executeEventScenario(options, traceId, scenario) {
  const api = new ScenarioApi(options, traceId);
  const login = await api.login();
  if (!login.ok) return blockedResult(scenario, traceId, login.body?.error ?? 'AUTH_FAILED');
  const beforeResult = await api.state();
  const before = beforeResult.state;
  const charId = options.charId ?? before.charId;
  if (!charId || (options.charId && before.charId && Number(options.charId) !== Number(before.charId)))
    return blockedResult(scenario, traceId, 'CHARACTER_OWNERSHIP_MISMATCH', `observed=${before.charId}`);
  if (before.mode !== 'AUTO_FARM')
    return blockedResult(scenario, traceId, 'PRECONDITION_NOT_AUTO_FARM', `mode=${before.mode ?? 'UNKNOWN'}`);
  const required = scenario === 'combat-cycle'
    ? ['MONSTER_TARGET', 'MONSTER_ATTACK', 'MONSTER_HIT', 'MONSTER_KILL', 'LOOT_ACQUIRED']
    : ['SUPPLY_LOW', 'MAP_CHANGED', 'SUPPLY_RETURN', 'MONSTER_TARGET', 'MONSTER_ATTACK', 'MONSTER_HIT', 'MONSTER_KILL', 'LOOT_ACQUIRED'];
  if (scenario === 'supply-return' && !/SUPPLY/i.test(String(before.runtimePhase ?? '')))
    return blockedResult(scenario, traceId, 'SUPPLY_PRECONDITION_NOT_ACTIVE', `runtimePhase=${before.runtimePhase ?? 'UNKNOWN'}`);
  const started = boundedNow();
  const observation = await waitForCommandAndState(
    api, charId, null, options,
    (state, names) => {
      const expected = scenario === 'combat-cycle'
        ? names.includes('MONSTER_HIT') && names.includes('MONSTER_KILL') && names.includes('LOOT_ACQUIRED')
        : names.includes('SUPPLY_RETURN') && state.mode === 'AUTO_FARM' && names.includes('MONSTER_HIT');
      return expected;
    },
    required,
  );
  const checkpoints = observation.eventCheckpoints;
  const eventsStep = transition('Authoritative State -> Event Ledger', checkpoints.every((entry) => entry.ok),
    checkpoints.find((entry) => !entry.ok)?.reason ?? null, { checkpoints, names: observation.names });
  const state = observation.stateResult.state;
  const stateOk = scenario === 'combat-cycle'
    ? state.mode === 'AUTO_FARM'
    : state.mode === 'AUTO_FARM' && state.map === before.map;
  const stateStep = transition('Native Result -> Authoritative State', stateOk,
    stateOk ? null : `mode=${state.mode ?? 'UNKNOWN'} map=${state.map ?? 'UNKNOWN'}`,
    { before, after: state });
  const apiStep = transition('HTTP -> Controller', true, null, { observationOnly: true });
  const controllerStep = transition('Controller -> Command', true, null, { observationOnly: true });
  const commandStep = transition('Command -> Native Receive', true, null, { observationOnly: true });
  const nativeStep = transition('Native Receive -> Native Result', true, null, { observationOnly: true });
  const transitions = [apiStep, controllerStep, commandStep, nativeStep, stateStep, eventsStep];
  return {
    scenario, traceId, charId,
    precondition: `mode=${before.mode} map=${before.map ?? 'UNKNOWN'} runtimePhase=${before.runtimePhase ?? 'UNKNOWN'}`,
    action: 'read-only bounded observation window', api: apiStep, controller: controllerStep,
    command: commandStep, native: nativeStep, state: stateStep, events: eventsStep,
    firstBrokenTransition: firstBrokenTransition(transitions), result: resultFromTransitions(transitions),
    failReason: transitions.find((entry) => !entry.ok)?.reason ?? null,
    durationMs: boundedNow() - started, observed: { before, after: state },
  };
}

async function run(options) {
  const scenario = options.matrix ? 'change-farm-map' : options.scenario;
  const traceId = createTraceId(scenario, options.traceId);
  const started = boundedNow();
  let result;
  if (options.matrix || (scenario === 'change-farm-map' && options.dryRun)) {
    result = await runMapMatrix(options, traceId);
  } else if (options.dryRun) {
    result = blockedResult(scenario, traceId, 'DRY_RUN_DEFAULT_USE_EXECUTE_FOR_LIVE_SCENARIO', 'NOT_EXECUTED', '--dry-run');
  } else if (scenario === 'start-farm' || scenario === 'stop-farm') {
    result = await executeAutomation(options, traceId, scenario);
  } else if (scenario === 'change-farm-map') {
    result = await executeChangeMap(options, traceId);
  } else if (scenario === 'use-fly-wing' || scenario === 'use-butterfly-wing') {
    const itemId = options.itemId ?? (scenario === 'use-fly-wing' ? DEFAULT_ITEM_IDS.fly : DEFAULT_ITEM_IDS.butterfly);
    result = await executeWing(options, traceId, itemId);
  } else {
    result = await executeEventScenario(options, traceId, scenario);
  }
  result.durationMs = boundedNow() - started;
  const traced = traceScenarioResult(result, {
    ...options,
    startedAt: new Date(started).toISOString(),
  });
  result.trace = traced.trace;
  result.traceAnalysis = traced.analysis;
  result.firstBrokenTransition = traced.analysis.firstBrokenTransition ?? result.firstBrokenTransition ?? null;
  result.failLayer = traced.analysis.failLayer;
  result.failErrorCode = traced.analysis.failErrorCode;
  result.tracePropagationGap = traced.trace.tracePropagationGap;
  return result;
}

export { mapFeasibility, normalizeState, positionChanged, run };

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const modulePath = fileURLToPath(import.meta.url);
if (invokedPath && invokedPath === modulePath) {
  try {
    const options = parseCli(process.argv.slice(2));
    if (options.help) {
      console.log(helpText());
      process.exitCode = 0;
    } else {
      const result = await run(options);
      console.log(options.json ? JSON.stringify(result, null, 2) : renderHuman(result));
      process.exitCode = exitCodeForResult(result.result);
    }
  } catch (error) {
    const result = {
      scenario: null,
      traceId: null,
      result: RESULT.BLOCKED,
      firstBrokenTransition: 'CLI -> Scenario Runner',
      failReason: error?.message ?? String(error),
      durationMs: 0,
    };
    console.error(process.argv.includes('--json') ? JSON.stringify(result, null, 2) : renderHuman(result));
    process.exitCode = 2;
  }
}
