import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createWorldMapTeleportPresentation } from
  '../ops/ro-stack/dashboard/world-map-teleport-presentation.mjs';
import { NATIVE_COMBAT_EVENT_TYPES, nativeLifeEventLine } from
  '../ops/ro-stack/web-observation.mjs';

const turn = () => new Promise((resolve) => setImmediate(resolve));

function fixture() {
  const calls = [];
  const playing = new Map();
  const adapter = {
    onStage: (stage) => calls.push(['stage', stage]),
    onComplete: (destination) => calls.push(['complete', destination]),
    onFailure: (error) => calls.push(['failure', error.message]),
    pauseBgm: () => calls.push(['bgm', 'pause']),
    resumeBgm: (map) => calls.push(['bgm', map ?? 'current']),
    playCue: (key, options = {}) => {
      calls.push(['play', key, Boolean(options.loop)]);
      return new Promise((resolve) => playing.set(key, resolve));
    },
    stopCue: (key) => {
      calls.push(['stop', key]);
      playing.get(key)?.('cancelled');
      playing.delete(key);
    },
  };
  const presentation = createWorldMapTeleportPresentation(adapter);
  const count = (kind, key) => calls.filter((call) =>
    call[0] === kind && (key === undefined || call[1] === key)).length;
  return {
    calls, count, presentation,
    isPlaying: (key) => playing.has(key),
    end: async (key) => { playing.get(key)?.('ended'); playing.delete(key); await turn(); },
  };
}

test('open starts A once and one sustained B; rapid duplicate open does not multiply loops', () => {
  const f = fixture();
  assert.equal(f.presentation.open(), true);
  assert.equal(f.count('play', 'readyPortal'), 1);
  assert.equal(f.count('play', 'portal'), 1);
  assert.deepEqual(f.calls.find((call) => call[0] === 'play' && call[1] === 'portal'),
    ['play', 'portal', true]);
  assert.equal(f.presentation.open(), false);
  assert.equal(f.count('play', 'portal'), 1);
  assert.equal(f.isPlaying('portal'), true);
  f.presentation.cancel();
  assert.equal(f.isPlaying('portal'), false);
  assert.equal(f.presentation.open(), true);
  assert.equal(f.count('play', 'portal'), 2);
  assert.equal(f.isPlaying('portal'), true);
});

test('cancel stops B and never starts C/D; preflight rejection keeps C/D silent', () => {
  const f = fixture();
  f.presentation.open();
  assert.equal(f.presentation.cancel(), true);
  assert.equal(f.count('stop', 'portal'), 1);
  assert.equal(f.count('play', 'warp'), 0);
  assert.equal(f.count('play', 'flyWing'), 0);
  f.presentation.open();
  assert.equal(f.presentation.beginSubmission(), true);
  assert.equal(f.presentation.preflightRejected(), true);
  assert.equal(f.presentation.state, 'MAP_PORTAL_OPEN');
  assert.equal(f.isPlaying('portal'), true);
  assert.equal(f.count('play', 'warp'), 0);
  assert.equal(f.count('play', 'flyWing'), 0);
});

test('accepted preflight stops B; C ends before D starts; both play once', async () => {
  const f = fixture();
  f.presentation.open();
  assert.equal(f.presentation.beginSubmission(), true);
  assert.equal(f.presentation.beginSubmission(), false);
  assert.equal(f.presentation.preflightAccepted({ mapId: 'pay_fild04', name: 'Payon' }), true);
  assert.equal(f.count('stop', 'portal'), 1);
  assert.equal(f.count('play', 'warp'), 1);
  assert.equal(f.count('play', 'flyWing'), 0);
  assert.equal(f.isPlaying('portal'), false);
  await f.end('warp');
  assert.equal(f.count('play', 'flyWing'), 1);
  assert.equal(f.presentation.state, 'FINAL_TELEPORT');
  assert.equal(f.presentation.preflightAccepted({ mapId: 'pay_fild04' }), false);
  assert.equal(f.count('play', 'warp'), 1);
});

test('arrival first keeps transition until D ended, then BGM and reveal', async () => {
  const f = fixture();
  f.presentation.open();
  f.presentation.beginSubmission();
  f.presentation.preflightAccepted({ mapId: 'pay_fild04', name: 'Payon' });
  assert.equal(f.presentation.authoritativeArrival('pay_fild04'), true);
  assert.equal(f.count('complete'), 0);
  assert.equal(f.presentation.isTransitionActive(), true);
  await f.end('warp');
  assert.equal(f.count('complete'), 0);
  await f.end('flyWing');
  assert.equal(f.presentation.state, 'ARRIVED');
  assert.equal(f.count('complete'), 1);
  assert.deepEqual(f.calls.at(-2), ['bgm', 'pay_fild04']);
  assert.equal(f.calls.at(-1)[0], 'complete');
});

test('D first waits for authoritative arrival without replay', async () => {
  const f = fixture();
  f.presentation.open();
  f.presentation.beginSubmission();
  f.presentation.preflightAccepted({ mapId: 'mjolnir_07', name: 'Mjolnir' });
  await f.end('warp');
  await f.end('flyWing');
  assert.equal(f.presentation.state, 'WAIT_FOR_ARRIVAL');
  assert.equal(f.count('complete'), 0);
  assert.equal(f.count('play', 'warp'), 1);
  assert.equal(f.count('play', 'flyWing'), 1);
  assert.equal(f.presentation.authoritativeArrival('wrong_map'), false);
  assert.equal(f.presentation.authoritativeArrival('mjolnir_07'), true);
  assert.equal(f.count('complete'), 1);
});

test('pending/confirmed submission cannot be cancelled or doubled', () => {
  const f = fixture();
  f.presentation.open();
  f.presentation.beginSubmission();
  assert.equal(f.presentation.cancel(), false);
  assert.equal(f.presentation.beginSubmission(), false);
  f.presentation.preflightAccepted({ mapId: 'pay_fild04' });
  assert.equal(f.presentation.cancel(), false);
  assert.equal(f.presentation.beginSubmission(), false);
  f.presentation.dispose();
  assert.equal(f.count('stop', 'warp'), 1);
  assert.equal(f.count('bgm', 'pause'), 2);
});

test('failed transition stops C/D and does not claim arrival', async () => {
  const f = fixture();
  f.presentation.open();
  f.presentation.beginSubmission();
  f.presentation.preflightAccepted({ mapId: 'pay_fild04' });
  assert.equal(f.presentation.failed(new Error('authority timeout')), true);
  await turn();
  assert.equal(f.presentation.state, 'IDLE');
  assert.equal(f.count('complete'), 0);
  assert.equal(f.count('failure'), 1);
  assert.equal(f.isPlaying('warp'), false);
});

test('page disposal stops an active sustained portal loop', () => {
  const f = fixture();
  f.presentation.open();
  assert.equal(f.isPlaying('portal'), true);
  f.presentation.dispose();
  assert.equal(f.isPlaying('portal'), false);
  assert.equal(f.count('stop', 'portal'), 1);
  assert.equal(f.count('play', 'warp'), 0);
  assert.equal(f.count('play', 'flyWing'), 0);
});

test('native Fly ledger projects success only, not rejection', () => {
  assert.equal(NATIVE_COMBAT_EVENT_TYPES.includes('FLY_WING_RELOCATED'), true);
  assert.equal(NATIVE_COMBAT_EVENT_TYPES.includes('FLY_WING_REJECTED'), false);
  assert.equal(nativeLifeEventLine({ eventType: 'FLY_WING_RELOCATED' }),
    'Fly Wing relocated');
  assert.equal(nativeLifeEventLine({ eventType: 'FLY_WING_REJECTED' }), null);
});

test('browser wiring retains authoritative and nonconsumable gates', async () => {
  const source = await readFile('ops/ro-stack/dashboard/app.js', 'utf8');
  assert.match(source, /worldMapTravelPresentation\.preflightAccepted/);
  assert.match(source, /worldMapTravelPresentation\.authoritativeArrival\(mapId\)/);
  assert.match(source, /Number\(after\.amount\) === Number\(before\?\.amount\)/);
  assert.ok(/if \(confirmed\) \{[\s\S]*?action === 'use' && Number\(before\?\.itemId\) === 601/.test(source),
    'Fly sound follows confirmed item use');
  assert.match(source, /Number\(before\?\.itemId\) === 601/);
  assert.match(source, /!reset \|\| !\/\^Fly Wing relocated\$\//);
  assert.match(source, /addEventListener\('pagehide', \(\) => worldMapTravelPresentation\?\.dispose\(\)\)/);
  assert.match(source, /session\.source\.onended = \(\) => settle\('ended'\)/);
  assert.match(source, /session\.audio\.onended = \(\) => settle\('ended'\)/);
  assert.match(source, /session\.source\.loop = loop/);
  assert.match(source, /session\.audio\.loop = loop/);
  assert.match(source, /session\.updateVolume\(\)/);
  assert.match(source, /worldMapTravelPresentation\?\.isTransitionActive\(\)/);
  assert.match(source, /if \(result\.reason === 'ALREADY_ON_TARGET_MAP'\) \{[\s\S]*?preflightRejected\(\)/);
  assert.match(source, /if \(error\?\.code === 'NON_JSON_RESPONSE'\) \{[\s\S]*?preflightRejected\(\)/);
  assert.match(source, /for \(const session of travelCueSessions\.values\(\)\) session\.updateVolume\?\.\(\)/);
  assert.match(source, /session\.gain\.gain\.value = audible\(\) \? volume\(\) : 0/);
  assert.match(source, /session\.audio\.muted = !audible\(\)/);
  assert.match(source, /if \(!worldMapTravelPresentation\?\.isTransitionActive\(\) &&[\s\S]*?audioPrefs\.musicEnabled/);
  assert.match(source, /if \(worldMapTravelPresentation\?\.isTransitionActive\(\)\) return;\s*const bgm/);
  assert.doesNotMatch(source, /playCombatSound\('warp'/);
});

test('selected A/B/C/D files preserve verified original PCM bytes', async () => {
  const selected = {
    ready_portal: 'd011b5576002352515f68a0d1b4a138389cc90a68e9df8fee2363644fb63771a',
    portal: 'fe87f49897cc025485dbb86feeac2b8d4c03a84e9dba6651afaef81d0dea1cfe',
    warp: 'd74f63cb03879178d647ee3a3982a93b7ee949083e20e6bc3e8c7ea5715cbe08',
    fly_wing: '7527a65b58ba61ddc664c9b1da5c03f2058417a6ef1036b6cef6d24c26ff5ffd',
  };
  const manifestText = await readFile('public/ro/client/sfx/official/combat-manifest.json', 'utf8');
  const manifest = JSON.parse(manifestText.replace(/^\uFEFF/, ''));
  for (const [name, hash] of Object.entries(selected)) {
    const path = `public/ro/client/sfx/official/${name}.wav`;
    const bytes = await readFile(path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash, path);
    assert.equal(manifest.files.find((entry) => entry.output === path)?.sha256, hash);
  }
});
