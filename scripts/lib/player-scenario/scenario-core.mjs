import { randomUUID } from 'node:crypto';

export const SCENARIOS = Object.freeze([
  'start-farm',
  'stop-farm',
  'change-farm-map',
  'use-fly-wing',
  'use-butterfly-wing',
  'supply-return',
  'combat-cycle',
]);

export const RESULT = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  BLOCKED: 'BLOCKED',
});

export const EXIT_CODE = Object.freeze({
  PASS: 0,
  FAIL: 1,
  BLOCKED: 2,
  INVALID: 2,
});

const optionNames = new Set([
  '--scenario', '--char', '--source', '--target', '--item-id', '--timeout',
  '--origin', '--username', '--credentials', '--runtime-root', '--json',
  '--dry-run', '--execute', '--matrix', '--help', '--trace-id',
]);

function valueAfter(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--'))
    throw new Error(`${option} requires a value`);
  return value;
}

export function parseCli(argv = []) {
  const options = {
    scenario: null,
    charId: null,
    sourceMap: null,
    targetMap: null,
    itemId: null,
    timeoutMs: 30_000,
    origin: process.env.RO_DEMO_ORIGIN ?? 'http://127.0.0.1:8788',
    username: process.env.SYNTHETIC_PLAYER_USERNAME ?? null,
    credentials: '.local/ro-stack/multiplayer-test-v2-credentials.json',
    runtimeRoot: process.env.RO_RATHENA_ROOT ?? null,
    json: false,
    dryRun: true,
    matrix: false,
    traceId: null,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!optionNames.has(arg))
      throw new Error(`unknown option: ${arg}`);
    if (arg === '--help') {
      options.help = true;
      continue;
    }
    if (arg === '--json' || arg === '--matrix') {
      options[arg.slice(2)] = true;
      continue;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--execute') {
      options.dryRun = false;
      continue;
    }
    const value = valueAfter(argv, index, arg);
    index += 1;
    if (arg === '--scenario') options.scenario = value;
    if (arg === '--char') options.charId = Number(value);
    if (arg === '--source') options.sourceMap = value;
    if (arg === '--target') options.targetMap = value;
    if (arg === '--item-id') options.itemId = Number(value);
    if (arg === '--timeout') options.timeoutMs = Number(value);
    if (arg === '--origin') options.origin = value.replace(/\/$/, '');
    if (arg === '--username') options.username = value;
    if (arg === '--credentials') options.credentials = value;
    if (arg === '--runtime-root') options.runtimeRoot = value;
    if (arg === '--trace-id') options.traceId = value;
  }

  if (options.help) return options;
  if (options.matrix && options.scenario)
    throw new Error('--matrix cannot be combined with --scenario');
  if (!options.matrix && !SCENARIOS.includes(options.scenario))
    throw new Error(`--scenario must be one of: ${SCENARIOS.join(', ')}`);
  if (options.scenario === 'change-farm-map' && !options.sourceMap)
    throw new Error('--source is required for change-farm-map');
  if (options.scenario === 'change-farm-map' && !options.targetMap)
    throw new Error('--target is required for change-farm-map');
  if (options.charId != null && (!Number.isSafeInteger(options.charId) || options.charId <= 0))
    throw new Error('--char must be a positive integer');
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0 || options.timeoutMs > 3_600_000)
    throw new Error('--timeout must be between 1 and 3600000 milliseconds');
  if (options.itemId != null && (!Number.isSafeInteger(options.itemId) || options.itemId <= 0))
    throw new Error('--item-id must be a positive integer');
  if (options.matrix && !options.sourceMap)
    throw new Error('--matrix requires --source');
  return options;
}

export function helpText() {
  return [
    'Usage:',
    '  node scripts/player-scenario-runner.mjs --scenario <name> [options]',
    '  node scripts/player-scenario-runner.mjs --matrix --source <map> [options]',
    '',
    `Scenarios: ${SCENARIOS.join(', ')}`,
    'Safe default is --dry-run. Mutating scenarios require --execute.',
    'Options: --char <id> --source <map> --target <map> --item-id <id>',
    '         --timeout <ms> --origin <url> --username <name>',
    '         --credentials <path> --runtime-root <path> --json --execute',
  ].join('\n');
}

export function createTraceId(scenario, requested = null) {
  if (requested) return String(requested);
  return `scenario-${String(scenario ?? 'matrix').replace(/[^a-z0-9]+/gi, '-')}-${randomUUID()}`;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function withTimeout(promise, timeoutMs, label = 'operation') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}_timeout`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function transition(name, ok, reason = null, details = {}) {
  return { name, ok: Boolean(ok), reason: reason ?? null, ...details };
}

export function firstBrokenTransition(transitions = []) {
  const failed = transitions.find((entry) => !entry.ok);
  if (!failed) return null;
  return failed.name;
}

export function resultFromTransitions(transitions, blocked = false) {
  if (blocked) return RESULT.BLOCKED;
  return transitions.every((entry) => entry.ok) ? RESULT.PASS : RESULT.FAIL;
}

function parseEventObject(value, out) {
  if (value == null) return;
  if (typeof value === 'string') {
    const text = value;
    try {
      const parsed = JSON.parse(text);
      if (parsed && parsed !== value) parseEventObject(parsed, out);
    } catch {}
    const upper = text.toUpperCase();
    const aliases = [
      ['MONSTER_HIT', /(?:MONSTER[_ ]?HIT|DAMAGE|YOU HIT|HIT MONSTER)/],
      ['MONSTER_ATTACK', /(?:MONSTER[_ ]?ATTACK|YOU ATTACK|ATTACKING MONSTER)/],
      ['MONSTER_KILL', /(?:MONSTER[_ ]?KILL|KILL(?:ED)? MONSTER|MONSTER DIED)/],
      ['LOOT_ACQUIRED', /(?:LOOT[_ ]?ACQUIRED|ITEM APPEARED|GOT ITEM|GAINED)/],
      ['MAP_CHANGED', /(?:MAP[_ ]?CHANGED|MAP CHANGE|NOW ON MAP|YOU ARE NOW)/],
      ['SUPPLY_LOW', /SUPPLY[_ ]?LOW/],
      ['SUPPLY_RETURN', /SUPPLY[_ ]?(?:RETURN|COMPLETE|RESUME)/],
      ['AUTO_FARM', /AUTO[_ ]?FARM/],
    ];
    for (const [name, pattern] of aliases) {
      if (pattern.test(upper)) out.add(name);
    }
    for (const match of upper.matchAll(/\b(?:MONSTER|LOOT|SUPPLY|MAP|AUTO_FARM|FARM|COMMAND|NATIVE|TARGET|ATTACK|HIT|KILL|ITEM)[A-Z0-9_]{2,}\b/g))
      out.add(match[0]);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) parseEventObject(item, out);
    return;
  }
  if (typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const upperKey = key.toUpperCase();
    if (['EVENT', 'EVENTTYPE', 'TYPE', 'KIND', 'ACTION', 'NAME', 'CODE'].includes(upperKey)) {
      if (typeof child === 'string') out.add(child.toUpperCase());
    }
    parseEventObject(child, out);
  }
}

export function extractEventNames(payload) {
  const names = new Set();
  parseEventObject(payload, names);
  return [...names];
}

export function eventCheckpoints(eventNames, required) {
  const present = new Set(eventNames.map((value) => String(value).toUpperCase()));
  return required.map((name) => ({
    name,
    ok: present.has(name),
    reason: present.has(name) ? null : 'event_not_observed',
  }));
}

export function exitCodeForResult(result) {
  return EXIT_CODE[result] ?? EXIT_CODE.FAIL;
}

export function renderHuman(result) {
  const lines = [
    `SCENARIO = ${result.scenario ?? 'matrix'}`,
    `TRACE_ID = ${result.traceId ?? ''}`,
    `CHAR_ID = ${result.charId ?? ''}`,
    `PRECONDITION = ${result.precondition ?? ''}`,
    `ACTION = ${result.action ?? ''}`,
    `API = ${formatCheckpoint(result.api)}`,
    `CONTROLLER = ${formatCheckpoint(result.controller)}`,
    `COMMAND = ${formatCheckpoint(result.command)}`,
    `NATIVE = ${formatCheckpoint(result.native)}`,
    `STATE = ${formatCheckpoint(result.state)}`,
    `EVENTS = ${formatCheckpoint(result.events)}`,
    `FIRST_BROKEN_TRANSITION = ${result.firstBrokenTransition ?? 'NONE'}`,
    `FAIL_LAYER = ${result.failLayer ?? 'NONE'}`,
    `FAIL_ERROR_CODE = ${result.failErrorCode ?? ''}`,
    `TRACE_PROPAGATION_GAP = ${result.tracePropagationGap?.present ? 'PRESENT' : 'NONE'}`,
    `RESULT = ${result.result ?? RESULT.BLOCKED}`,
    `FAIL_REASON = ${result.failReason ?? ''}`,
    `DURATION_MS = ${result.durationMs ?? 0}`,
  ];
  if (result.matrix) {
    lines.push('MAP_MATRIX =');
    lines.push(...result.matrix.map((row) =>
      `${row.map.padEnd(16)} FARM=${row.farmEligible ? 'YES' : 'NO'} SUPPORTED=${row.relocationSupported ? 'YES' : 'NO'} ROUTE=${row.routeFound ? 'YES' : 'NO'} REASON=${row.reason ?? 'NONE'}`));
  }
  return lines.join('\n');
}

function formatCheckpoint(value) {
  if (!value) return 'UNKNOWN';
  if (typeof value === 'string') return value;
  return value.ok ? 'PASS' : `FAIL(${value.reason ?? 'unknown'})`;
}
