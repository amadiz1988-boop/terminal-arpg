import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  RESULT,
  parseCli,
  firstBrokenTransition,
  extractEventNames,
  eventCheckpoints,
} from './lib/player-scenario/scenario-core.mjs';
import { normalizeState, positionChanged } from './player-scenario-runner.mjs';

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

const state = normalizeState({
  character: { charId: 150094, map: 'moc_pryd01', x: 192, y: 9 },
  liveStatus: { agentMode: 'AUTO_FARM', map: 'moc_pryd01', x: 192, y: 9 },
  grindTarget: { mapId: 'moc_pryd01' },
  inventory: [{ itemId: 601, amount: 30, inventoryIndex: 4 }],
});
assert.equal(state.charId, 150094);
assert.equal(state.mode, 'AUTO_FARM');
assert.equal(state.farmTarget, 'moc_pryd01');
assert.equal(positionChanged(state, { ...state, x: 193 }), true);
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

console.log('PLAYER_SCENARIO_RUNNER_TEST_PASS checks=23');
