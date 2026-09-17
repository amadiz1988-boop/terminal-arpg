import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  getRoAssetIndexSnapshot,
  resolveMonsterAsset,
  resolveMonsterDisplayName,
} from '../ops/ro-stack/ro-asset-resolver.mjs';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const origin = process.env.RO_DEMO_ORIGIN ?? 'http://127.0.0.1:8788';
const han = /[\u3400-\u9fff]/u;

const appSource = await readFile('ops/ro-stack/dashboard/app.js', 'utf8');
const resolverSource = await readFile(
  'ops/ro-stack/dashboard/ro-asset-resolver.js',
  'utf8',
);
const map = JSON.parse(
  await readFile('public/ro/data/map-info/prt_fild08.json', 'utf8'),
);
const mapNamesById = new Map(map.monsters.map((monster) => [monster.id, monster.name]));

// ---- Static wiring: player-facing combat log must use the canonical resolver ----
assert.match(
  appSource,
  /resolveMonsterDisplayName/,
  'combat log must resolve monster names through the canonical display resolver',
);
assert.doesNotMatch(
  appSource,
  /\[受傷\] \$1 攻擊你/,
  'hurt line must not keep the raw English monster name',
);
assert.doesNotMatch(
  appSource,
  /\[擊倒\] \$1/,
  'kill line must not keep the raw English monster name',
);
assert.doesNotMatch(
  appSource,
  /(?:Poring|Drops|Lunatic): '/,
  'legacy partial monster table must not shadow the canonical resolver',
);
assert.match(
  resolverSource,
  /resolveMonsterDisplayName/,
  'browser resolver must expose the shared monster display-name resolver',
);
assert.match(
  appSource,
  /resolveMonsterAsset\(\{[\s\S]*?mobId: monster\.id/,
  'map info must keep resolving monsters through the same canonical resolver',
);

// ---- Canonical data equality: MAP_INFO_NAME == COMBAT_LOG_NAME per mob id ----
const combatEnglishNames = new Map([
  [1002, 'Poring'],
  [1063, 'Lunatic'],
  [1007, 'Fabre'],
  [1008, 'Pupa'],
  [2398, 'Little Poring'],
]);
const equality = {};
for (const [mobId, english] of combatEnglishNames) {
  const mapInfoName = resolveMonsterDisplayName({
    mobId,
    name: mapNamesById.get(mobId),
  });
  const combatName = resolveMonsterDisplayName({ mobId, name: english });
  const combatByName = resolveMonsterDisplayName(english);
  assert.ok(
    han.test(mapInfoName ?? ''),
    `map info name for mob ${mobId} must be zh-TW`,
  );
  assert.equal(
    combatName,
    mapInfoName,
    `combat name for mob ${mobId} must equal map info name`,
  );
  assert.equal(
    combatByName,
    mapInfoName,
    `combat English name ${english} must resolve to the map info name`,
  );
  assert.equal(resolveMonsterAsset({ mobId, name: english }).name, mapInfoName);
  assert.doesNotMatch(
    combatName,
    /\d{3,}/,
    `display name for mob ${mobId} must not embed a mob id`,
  );
  equality[String(mobId)] = { english, display: combatName };
}
assert.ok(Object.keys(equality).length >= 3);

// ---- Fallback: per-monster, never a global English mode ----
assert.equal(resolveMonsterDisplayName('Not A Real Monster'), null);
assert.equal(
  resolveMonsterDisplayName({ mobId: 999999, name: 'Not A Real Monster' }),
  null,
);
const indexEntries = getRoAssetIndexSnapshot().indexes.monsters ?? [];
assert.ok(indexEntries.length > 0, 'monster index must be loaded');
const localized = indexEntries
  .map((entry) =>
    resolveMonsterDisplayName({ mobId: entry.mobId, name: entry.enName }),
  )
  .filter((value) => han.test(value ?? ''));
assert.ok(
  localized.length >= Math.floor(indexEntries.length * 0.9),
  'canonical resolver must localize the dataset without falling back globally to English',
);

// ---- Execute the real production combat-line transform (no duplicated logic) ----
function extractFunction(source, header) {
  const match = source.match(
    new RegExp(`${header}[\\s\\S]*?\\n\\}`),
  );
  assert.ok(match, `unable to extract ${header} from app.js`);
  return match[0];
}
const displayFn = extractFunction(appSource, 'function monsterDisplayName\\(name, mobId\\) \\{');
const localizeFn = extractFunction(appSource, 'function localize\\(line\\) \\{');
const buildLocalize = new Function(
  'window',
  'mapNames',
  'names',
  'passiveProcName',
  'localizedSkillName',
  'localizedSkillDefinition',
  `${displayFn}\n${localizeFn}\nreturn localize;`,
);
const localize = buildLocalize(
  { roAssetResolver: { resolveMonsterDisplayName } },
  { prontera: '普隆德拉', prt_fild08: '普隆德拉原野', prt_in: '普隆德拉城內' },
  {},
  () => '',
  (name) => name,
  () => null,
);
const transformed = {
  acquired: localize('You are now attacking Monster Poring (1002)'),
  hit: localize('You attack Monster Poring (1002) (Dmg: 5)'),
  skillHit: localize('You use Fire Bolt (Lv: 3) on Monster Lunatic (1063) (Dmg: 9)'),
  hurt: localize('Monster Poring (1002) attacks you (Dmg: 3)'),
  kill: localize('Target Monster Lunatic (1063) died'),
  unknownKill: localize('Target Monster Nonexistent (999999) died'),
};
assert.equal(transformed.acquired, '[索敵] 鎖定 波利');
assert.equal(transformed.hit, '[攻擊] 你攻擊 波利 (傷害：5)');
assert.match(transformed.skillHit, /^\[主動技能\] Fire Bolt Lv\.3 · 攻擊 瘋兔/);
assert.equal(transformed.hurt, '[受傷] 波利 攻擊你 (傷害：3)');
assert.equal(transformed.kill, '[擊倒] 瘋兔');
assert.equal(transformed.unknownKill, '[擊倒] Nonexistent');
for (const line of Object.values(transformed)) {
  assert.doesNotMatch(
    line,
    /\(\d{3,}\)/,
    `player-facing combat line must not expose a mob id: ${line}`,
  );
}

// ---- Live player Web path: real browser + real canonical index data ----
const probe = await fetch(origin)
  .then((response) => response.ok)
  .catch(() => false);
assert.ok(probe, `live player Web path must be reachable: ${origin}`);

const profile = mkdtempSync(join(tmpdir(), 'ro-monster-names-'));
const debugPort = 19471;
const browser = spawn(
  chromePath,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { windowsHide: true },
);

let live = { status: 'BLOCKED' };
try {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if ((await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const target = await fetch(
    `http://127.0.0.1:${debugPort}/json/new?about:blank`,
    { method: 'PUT' },
  ).then((response) => response.json());
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let requestId = 0;
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  };
  await new Promise((resolve) => {
    socket.onopen = resolve;
  });
  const call = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++requestId;
      pending.set(id, resolve);
      socket.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression, awaitPromise = false) =>
    (
      await call('Runtime.evaluate', {
        expression,
        awaitPromise,
        returnByValue: true,
      })
    ).result.result.value;

  await call('Runtime.enable');
  await call('Page.enable');
  await call('Page.navigate', { url: origin });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if ((await evaluate('document.readyState')) === 'complete') break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await evaluate(resolverSource);
  const result = await evaluate(
    `(async () => {
      await window.roAssetResolver.load();
      const detail = await fetch('/ro/data/map-info/prt_fild08.json', { cache: 'no-store' }).then((r) => r.json());
      const byId = new Map(detail.monsters.map((monster) => [monster.id, monster.name]));
      return {
        version: window.roAssetResolver.version(),
        acquired: window.roAssetResolver.resolveMonsterDisplayName({ mobId: 1002, name: 'Poring' }),
        mapPoring: window.roAssetResolver.resolveMonsterDisplayName({ mobId: 1002, name: byId.get(1002) }),
        lunatic: window.roAssetResolver.resolveMonsterDisplayName({ mobId: 1063, name: 'Lunatic' }),
        fabre: window.roAssetResolver.resolveMonsterDisplayName({ mobId: 1007, name: 'Fabre' }),
        unknown: window.roAssetResolver.resolveMonsterDisplayName('Not A Real Monster'),
      };
    })()`,
    true,
  );
  assert.equal(result.acquired, result.mapPoring);
  assert.equal(result.acquired, '波利');
  assert.equal(result.lunatic, '瘋兔');
  assert.equal(result.fabre, '綠棉蟲');
  assert.equal(result.unknown, null);
  live = { status: 'PASS', origin, ...result };
  socket.close();
} finally {
  browser.kill();
  await Promise.race([
    new Promise((resolve) => browser.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]);
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch {}
}

console.log(
  JSON.stringify(
    {
      result: 'MONSTER_DISPLAY_NAMES_PASS',
      newTranslationTableCreated: false,
      equality,
      transformed,
      live,
    },
    null,
    2,
  ),
);
