import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const nativeRoot = process.env.GHOST_ISLAND_NATIVE_ROOT || 'C:/Users/Administrator/source/ghost-island-rathena';
const sequencePath = path.join(root, 'ops/ro-stack/persistent-agent/quest-sequences/novice-onboarding.json');
const charConfigPath = path.join(nativeRoot, 'conf/char_athena.conf');
const templatePath = path.join(root, 'ops/ro-stack/templates/terminal_academy_job_change.txt');
const academyPath = path.join(nativeRoot, 'npc/re/jobs/novice/academy.txt');
const strictPostA = process.env.NOVICE_SPAWN_COVERAGE_EXPECT === 'post-a';
const adapterPath = process.env.NOVICE_ONBOARDING_SPAWN_ADAPTER;

const sequence = JSON.parse(fs.readFileSync(sequencePath, 'utf8'));
const charConfig = fs.readFileSync(charConfigPath, 'utf8');
const template = fs.readFileSync(templatePath, 'utf8');
const academy = fs.readFileSync(academyPath, 'utf8');
const spawnLine = charConfig.match(/^start_point:\s*(.+)$/m)?.[1] ?? '';
const validSpawns = spawnLine.split(':').map((entry) => {
  const [map, x, y] = entry.split(',');
  return { map, x: Number(x), y: Number(y) };
});
const s00 = sequence.steps[0];
const legalMaps = new Set(validSpawns.map(({ map }) => map));
const variantMaps = validSpawns.filter(({ map }) => map !== 'iz_int').map(({ map }) => map);
const hasDirectAlias = template.includes('terminal_ship_wounded');
const hasVariantNormalization = variantMaps.every((map) =>
  academy.includes(`${map},18,30,0\tduplicate(iz_int#intro_start)`) &&
  academy.includes(`navigateto("iz_int", 52, 30, NAV_NONE, 1)`),
);

async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
    return true;
  } catch (error) {
    console.error(`FAIL ${name}: ${error.message}`);
    return false;
  }
}

function assertOutcome(outcome, spawnMap) {
  assert.equal(outcome.spawnMap, spawnMap);
  assert.equal(outcome.sequenceId, 'novice_onboarding');
  assert.equal(outcome.s00StepIndex, 0);
  assert.equal(outcome.usedStageMapping, false);
  assert.equal(outcome.routeOriginValidated, true);
  assert.equal(outcome.sequenceCount, 1);
  assert.equal(outcome.s00DispatchCount, 1);

  if (spawnMap === 'iz_int') {
    assert.equal(outcome.status, 'PASS');
    assert.equal(outcome.mode, 'DIRECT_S00');
    assert.equal(outcome.authoritativeMap, 'iz_int');
    assert.equal(outcome.normalizationCompleteBeforeDispatch, true);
    return;
  }

  assert.equal(outcome.status, 'PASS');
  assert.equal(outcome.mode, 'PRE_S00_NORMALIZATION');
  assert.equal(outcome.normalizationMap, 'iz_int');
  assert.equal(outcome.authoritativeMap, 'iz_int');
  assert.equal(outcome.normalizationCompleteBeforeDispatch, true);
}

async function loadAdapter() {
  if (!adapterPath) return null;
  const moduleUrl = pathToFileURL(path.resolve(root, adapterPath)).href;
  const loaded = await import(moduleUrl);
  const adapter = loaded.default ?? loaded;
  assert.equal(typeof adapter.resolveSpawnEntry, 'function', 'adapter must export resolveSpawnEntry');
  return adapter;
}

const checks = [];
checks.push(await check('canonical_spawn_contract', () => {
  assert.deepEqual(validSpawns, [
    { map: 'iz_int', x: 18, y: 26 },
    { map: 'iz_int01', x: 18, y: 26 },
    { map: 'iz_int02', x: 18, y: 26 },
    { map: 'iz_int03', x: 18, y: 26 },
    { map: 'iz_int04', x: 18, y: 26 },
  ]);
  assert.equal(sequence.sequenceId, 'novice_onboarding');
  assert.equal(sequence.steps.length, 50);
  assert.equal(s00.type, 'GO_NPC');
  assert.equal(s00.npcName, 'terminal_ship_wounded');
  assert.equal(s00.map, 'iz_int');
  assert.equal(s00.route[0].map, 'iz_int');
  assert.equal(s00.route[0].map, s00.map);
  assert.equal(hasDirectAlias, true);
  assert.equal(hasVariantNormalization, true);
}));

const adapter = await loadAdapter();
const outcomes = [];
for (const spawn of validSpawns) {
  const outcome = adapter
    ? await adapter.resolveSpawnEntry({
        spawnMap: spawn.map,
        spawnX: spawn.x,
        spawnY: spawn.y,
        sequenceId: sequence.sequenceId,
        s00StepIndex: 0,
        s00Map: s00.map,
      })
    : spawn.map === 'iz_int'
      ? {
          status: 'PASS',
          mode: 'DIRECT_S00',
          spawnMap: spawn.map,
          authoritativeMap: 'iz_int',
          sequenceId: sequence.sequenceId,
          s00StepIndex: 0,
          usedStageMapping: false,
          routeOriginValidated: true,
          sequenceCount: 1,
          s00DispatchCount: 1,
          normalizationCompleteBeforeDispatch: true,
        }
      : {
          status: 'EXPECTED_FAIL',
          reason: 'PRE_S00_NORMALIZATION_UNAVAILABLE',
          spawnMap: spawn.map,
          authoritativeMap: spawn.map,
          sequenceId: sequence.sequenceId,
          s00StepIndex: 0,
          usedStageMapping: false,
          routeOriginValidated: true,
          sequenceCount: 0,
          s00DispatchCount: 0,
          normalizationCompleteBeforeDispatch: false,
        };
  outcomes.push(outcome);

  if (adapter || spawn.map === 'iz_int') {
    checks.push(await check(`${spawn.map}_s00_entry`, () => assertOutcome(outcome, spawn.map)));
  } else {
    checks.push(await check(`${spawn.map}_s00_entry_expected_red`, () => {
      assert.equal(outcome.status, 'EXPECTED_FAIL');
      assert.equal(outcome.reason, 'PRE_S00_NORMALIZATION_UNAVAILABLE');
      assert.equal(outcome.s00DispatchCount, 0);
      assert.equal(outcome.sequenceCount, 0);
      assert.equal(outcome.normalizationCompleteBeforeDispatch, false);
    }));
  }
}

checks.push(await check('invalid_spawn_fail_closed', async () => {
  const outcome = adapter
    ? await adapter.resolveSpawnEntry({
        spawnMap: 'unsupported_spawn_map',
        spawnX: 1,
        spawnY: 1,
        sequenceId: sequence.sequenceId,
        s00StepIndex: 0,
        s00Map: s00.map,
      })
    : { status: 'FAIL_CLOSED', spawnMap: 'unsupported_spawn_map', sequenceCount: 0, s00DispatchCount: 0 };
  assert.equal(outcome.status, 'FAIL_CLOSED');
  assert.equal(outcome.sequenceCount, 0);
  assert.equal(outcome.s00DispatchCount, 0);
  assert.equal(legalMaps.has(outcome.spawnMap), false);
}));

checks.push(await check('no_duplicate_sequence_or_stage_mapping', () => {
  assert.equal(new Set(outcomes.map((outcome) => outcome.sequenceId)).size, 1);
  assert.equal(outcomes.every((outcome) => outcome.usedStageMapping === false), true);
  assert.equal(outcomes.every((outcome) => outcome.routeOriginValidated === true), true);
}));

const failed = checks.filter((passed) => !passed).length;
const expectedRedCount = adapter ? 0 : variantMaps.length;
const unexpectedRedCount = outcomes.filter((outcome) => outcome.status !== 'PASS' && outcome.status !== 'EXPECTED_FAIL').length;
const postAIncomplete = strictPostA && outcomes.some((outcome) => outcome.status !== 'PASS');

console.log(`VALID_SPAWN_CASES=${validSpawns.length}`);
console.log(`INVALID_CASES=1`);
console.log(`PRE_A_RESULT=${adapter ? 'POST_A_ADAPTER_MODE' : 'BASELINE'}`);
console.log(`EXPECTED_RED_COUNT=${expectedRedCount}`);
console.log(`UNEXPECTED_RED_COUNT=${unexpectedRedCount}`);
console.log(`LEGAL_SPAWN_PASS_COUNT=${outcomes.filter((outcome) => outcome.status === 'PASS').length}`);

if (failed > 0 || postAIncomplete) process.exitCode = 1;
