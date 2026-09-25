import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildWarpGraph, planWebRelocation } from '../ops/ro-stack/persistent-agent/map-route.mjs';
import {
  RESULT,
  parseCli,
  firstBrokenTransition,
  extractEventNames,
  eventCheckpoints,
} from './lib/player-scenario/scenario-core.mjs';
import {
  modeTransitionResult,
  normalizeState,
  positionChanged,
  run,
  summarizeFarmMapPlan,
} from './player-scenario-runner.mjs';

function runCli(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['scripts/player-scenario-runner.mjs', ...args], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

const defaults = parseCli(['--scenario', 'start-farm']);
assert.equal(defaults.dryRun, true, 'dry-run must be the default');
assert.equal(defaults.json, false);

const execute = parseCli(['--scenario', 'start-farm', '--execute', '--char', '150094']);
assert.equal(execute.dryRun, false);
assert.equal(execute.charId, 150094);

assert.throws(
  () => parseCli(['--scenario', 'start-farm', '--execute', '--timeout', '0']),
  /timeout/,
);
assert.throws(() => parseCli(['--scenario', 'start-farm', '--matrix']), /cannot be combined/);
assert.throws(() => parseCli(['--scenario', 'change-farm-map']), /source is required/);
assert.throws(() => parseCli(['--scenario', 'change-farm-map', '--source', 'moc_pryd01']), /target is required/);

assert.equal(
  firstBrokenTransition([
    { name: 'HTTP -> Controller', ok: true },
    { name: 'Controller -> Command', ok: false },
  ]),
  'Controller -> Command',
);
assert.equal(firstBrokenTransition([{ name: 'one', ok: true }]), null);

const eventNames = extractEventNames({
  lines: ['MONSTER_ATTACK', 'damage confirmed', 'MONSTER_KILL', 'Item Appeared'],
  combatDelta: { eventType: 'MONSTER_HIT' },
});
for (const expected of ['MONSTER_ATTACK', 'MONSTER_HIT', 'MONSTER_KILL', 'LOOT_ACQUIRED'])
  assert.ok(eventNames.includes(expected), `missing event ${expected}`);
assert.deepEqual(
  eventCheckpoints(eventNames, ['MONSTER_ATTACK', 'MONSTER_HIT']).map((entry) => entry.ok),
  [true, true],
);

function journal(agentMode, revision, owner = 'SERVER_AGENT') {
  return { revision, ownership: { owner, agentMode } };
}

const state = normalizeState({
  character: { charId: 150094, map: 'moc_pryd01', x: 192, y: 9 },
  liveStatus: { available: true, fresh: true, phase: 'COMBAT', map: 'moc_pryd01', x: 192, y: 9 },
  questJournal: journal('AUTO_FARM', 12),
  grindTarget: { mapId: 'moc_pryd01' },
  inventory: [{ itemId: 601, amount: 30, inventoryIndex: 4 }],
});
assert.equal(state.charId, 150094);
assert.equal(state.mode, 'AUTO_FARM');
assert.equal(state.modeRevision, 12);
assert.equal(state.modeSource, 'questJournal.ownership.agentMode');
assert.equal(state.farmTarget, 'moc_pryd01');
assert.equal(positionChanged(state, { ...state, x: 193 }), true);

// Mode observation contract: authoritative ownership projection only.
const idle = normalizeState({ questJournal: journal('PERSISTENT_IDLE', 11) });
assert.equal(idle.mode, 'PERSISTENT_IDLE');
const liveOnly = normalizeState({ liveStatus: { phase: 'IDLE', mode: 'AUTO_FARM', agentMode: 'AUTO_FARM' } });
assert.equal(liveOnly.mode, null, 'liveStatus is not a mode authority');
assert.equal(liveOnly.modeReason, 'MODE_PROJECTION_MISSING');
const defaulted = normalizeState({ questJournal: journal('PERSISTENT_IDLE', 0, 'OPENKORE') });
assert.equal(defaulted.mode, null, 'journal default for a missing ownership row is not an observation');
assert.equal(defaulted.modeReason, 'MODE_PROJECTION_NOT_SERVER_AGENT');
assert.equal(normalizeState({ questJournal: journal('', 3) }).modeReason, 'MODE_PROJECTION_EMPTY');
assert.equal(normalizeState({ questJournal: journal('WEIRD_MODE', 3) }).mode, 'WEIRD_MODE');
assert.equal(modeTransitionResult(idle, state, 'AUTO_FARM').ok, true);
assert.equal(modeTransitionResult(state, normalizeState({ questJournal: journal('PERSISTENT_IDLE', 13) }), 'PERSISTENT_IDLE').ok, true);
assert.match(modeTransitionResult(idle, normalizeState({ questJournal: journal('AUTO_FARM', 11) }), 'AUTO_FARM').reason, /mode_projection_stale/);
assert.equal(modeTransitionResult(idle, liveOnly, 'AUTO_FARM').reason, 'MODE_PROJECTION_MISSING');
assert.equal(modeTransitionResult(idle, normalizeState({ questJournal: journal('WEIRD_MODE', 12) }), 'AUTO_FARM').reason, 'mode=WEIRD_MODE');

const multimodalGraph = buildWarpGraph([
  ['prt_fild08', 'prontera'], ['morocc', 'moc_ruins'], ['moc_ruins', 'moc_pryd01'],
].map(([map, to], index) => ({
  map, to, x: index + 1, y: index + 2, toX: index + 3, toY: index + 4,
  name: `scenario_${index}`, xs: 1, ys: 1,
})));
assert.equal(planWebRelocation(multimodalGraph, 'prt_fild08', 'moc_pryd01').route, null);
const multimodal = summarizeFarmMapPlan(multimodalGraph, 'prt_fild08', 'moc_pryd01');
assert.equal(multimodal.relocationSupported, true);
assert.equal(multimodal.policy, 'KAFRA_DIALOG_TRANSFER');
assert.equal(multimodal.terminal, 'START_FARM');
assert.equal(multimodal.feasibilityScope, 'GRAPH_AND_KAFRA_WITHOUT_CHARACTER_INVENTORY_OR_SAVEPOINT');
assert.equal(positionChanged(state, state), false);

const dryRun = await runCli(['--scenario', 'start-farm', '--json']);
assert.equal(dryRun.code, 2);
const dryRunResult = JSON.parse(dryRun.stderr || dryRun.stdout);
assert.equal(dryRunResult.result, RESULT.BLOCKED);
assert.equal(dryRunResult.failReason, 'DRY_RUN_DEFAULT_USE_EXECUTE_FOR_LIVE_SCENARIO');
assert.equal(dryRunResult.trace.actionKey, 'start_farm');
assert.equal(dryRunResult.traceAnalysis.firstBrokenTransition, 'HTTP -> Controller');
assert.equal(dryRunResult.tracePropagationGap.present, true);

const matrix = await runCli([
  '--matrix', '--source', 'moc_pryd01', '--target', 'mjolnir_07',
  '--runtime-root', 'C:/path/that/does/not/exist', '--json',
]);
assert.equal(matrix.code, 0);
const matrixResult = JSON.parse(matrix.stdout);
assert.equal(matrixResult.result, RESULT.PASS);
assert.equal(matrixResult.matrix.length, 1);
assert.equal(matrixResult.matrix[0].farmEligible, true);
assert.equal(matrixResult.matrix[0].relocationSupported, false);
assert.equal(matrixResult.matrix[0].reason, 'RUNTIME_WARP_GRAPH_UNAVAILABLE');

// Live-flow observation against a local fake Dashboard; no Production access.
async function withFakeDashboard(initial, onCommand, body) {
  const world = { mode: initial.mode, revision: initial.revision, owner: initial.owner ?? 'SERVER_AGENT',
    projection: initial.projection ?? true, posts: 0 };
  const server = createServer(async (request, response) => {
    const send = (status, payload, headers = {}) => {
      response.writeHead(status, { 'content-type': 'application/json', ...headers });
      response.end(JSON.stringify(payload));
    };
    for await (const _chunk of request) { /* drain */ }
    const path = new URL(request.url, 'http://fake').pathname;
    if (path === '/api/account') return send(200, { ok: true }, { 'set-cookie': 'ro_session=fake; HttpOnly' });
    if (path === '/api/state') {
      return send(200, {
        character: { charId: 150094, map: 'moc_pryd01', x: 1, y: 1 },
        liveStatus: { available: true, fresh: true, phase: 'IDLE', map: 'moc_pryd01', x: 1, y: 1 },
        ...(world.projection ? { questJournal: journal(world.mode, world.revision, world.owner) } : {}),
      });
    }
    if (path === '/api/events') return send(200, { cursor: 0, lines: [] });
    if (path === '/api/automation') {
      world.posts += 1;
      setTimeout(() => onCommand(world), 150);
      return send(202, { executor: 'SERVER_AGENT', command: { commandId: 'fake-1', status: 'QUEUED' } });
    }
    if (path.endsWith('/ownership/commands/fake-1')) return send(200, { command: { commandId: 'fake-1', status: 'CONFIRMED' } });
    return send(404, { error: 'not_found' });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await body(`http://127.0.0.1:${server.address().port}`, world);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const credentialDir = await mkdtemp(join(tmpdir(), 'scenario-runner-'));
const credentialPath = join(credentialDir, 'credentials.json');
await writeFile(credentialPath, JSON.stringify({ username: 'fake_player', password: 'fake' }));
const scenarioRun = (scenario, origin) => run(parseCli([
  '--scenario', scenario, '--execute', '--char', '150094', '--origin', origin,
  '--credentials', credentialPath, '--timeout', '1500',
]));

try {
  const start = await withFakeDashboard({ mode: 'PERSISTENT_IDLE', revision: 40 },
    (world) => { world.mode = 'AUTO_FARM'; world.revision += 1; },
    (origin) => scenarioRun('start-farm', origin));
  assert.equal(start.result, RESULT.PASS, `START_FARM_SCENARIO_OBSERVATION ${start.failReason}`);
  assert.equal(start.observed.after.mode, 'AUTO_FARM');

  const stop = await withFakeDashboard({ mode: 'AUTO_FARM', revision: 41 },
    (world) => { world.mode = 'PERSISTENT_IDLE'; world.revision += 1; },
    (origin) => scenarioRun('stop-farm', origin));
  assert.equal(stop.result, RESULT.PASS, `STOP_FARM_SCENARIO_OBSERVATION ${stop.failReason}`);
  assert.equal(stop.observed.after.mode, 'PERSISTENT_IDLE');

  const stale = await withFakeDashboard({ mode: 'PERSISTENT_IDLE', revision: 40 },
    (world) => { world.mode = 'AUTO_FARM'; },
    (origin) => scenarioRun('start-farm', origin));
  assert.equal(stale.result, RESULT.FAIL);
  assert.match(stale.failReason, /mode_projection_stale/);

  const unknown = await withFakeDashboard({ mode: 'AUTO_FARM', revision: 41 },
    (world) => { world.mode = 'WEIRD_MODE'; world.revision += 1; },
    (origin) => scenarioRun('stop-farm', origin));
  assert.equal(unknown.result, RESULT.FAIL);
  assert.equal(unknown.failReason, 'mode=WEIRD_MODE');

  for (const initial of [{ projection: false }, { owner: 'OPENKORE', mode: 'PERSISTENT_IDLE', revision: 0 }]) {
    let posted = 0;
    const missing = await withFakeDashboard({ mode: 'AUTO_FARM', revision: 1, ...initial },
      () => {}, async (origin, world) => { const result = await scenarioRun('stop-farm', origin); posted = world.posts; return result; });
    assert.equal(missing.result, RESULT.BLOCKED, 'missing projection must never pass');
    assert.match(missing.failReason, /^MODE_PROJECTION_/);
    assert.equal(posted, 0, 'missing projection must not send a command');
  }
} finally {
  await rm(credentialDir, { recursive: true, force: true });
}

console.log('PLAYER_SCENARIO_RUNNER_TEST_PASS checks=59');
