import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import {
  LEGACY_ITEM_RULE_BASELINE, defaultCanonicalConfig, migrateLegacyConfig, validateCanonicalConfig,
} from '../ops/ro-stack/dashboard/config-schema.mjs';
import { loadCanonicalConfig } from '../ops/ro-stack/dashboard/config-storage.mjs';
import { resolveFarmExecutionProfile } from '../ops/ro-stack/dashboard/farm-execution-profile.mjs';
import { nativeSupplyPolicy } from '../ops/ro-stack/persistent-agent/native-supply-policy.mjs';

// Mirrors the shared OpenKore items_control template shape found on legacy
// accounts: baseline rows, 1632 distinct identities, 34 repeated rows, names,
// travel wings, ammunition, sell and storage rows. Values are synthetic.
function legacyTemplate() {
  const lines = ['all 0 1 0', '602 30000 0 0', '601 30000 0 0', '501 0 0 0',
    '1750 0 1 0', '13200 0 0 1', 'Red Potion 50 1 0', 'Jellopy 0 0 1', '505 0 1 0'];
  for (let id = 2000; lines.length < 1632; id++) lines.push(`${id} 0 0 ${id % 3 === 0 ? 1 : 0} 0 0`);
  for (let index = 0; index < 34; index++) lines.push(lines[9 + index]);
  return lines.join('\n');
}
const itemsControlText = legacyTemplate();
const configText = ['itemsMaxWeight_sellOrStore 80', 'itemsMaxNum_sellOrStore 99',
  'sellAuto 0', 'storageAuto 0', 'attackAuto 2', 'attackUseWeapon 1',
  'buyAuto 501 {', 'minAmount 50', 'maxAmount 100', '}',
  'useSelf_item 501 {', 'hp < 50%', '}'].join('\n');
const pickupText = 'all 1\n601 1\n602 1\n1750 2\nJellopy 0';
const supplyCycle = { enabled: true, returnWeight: 80, store: false, sell: false, buy: true,
  redPotionMin: 50, redPotionMax: 100, rules: [] };
const legacy = { supplyCycle, configText, itemsControlText, pickupText };
let cases = 0;
const check = (name, body) => { body(); cases++; };

check('1 empty legacy config uses valid defaults', () => {
  const { config } = migrateLegacyConfig({});
  assert.deepEqual(validateCanonicalConfig(config), []);
  assert.deepEqual(config.supply.itemRules.map((row) => row.item).sort(), [...LEGACY_ITEM_RULE_BASELINE].sort());
});
check('2 small HP/SP rules stay valid', () => {
  const { config } = migrateLegacyConfig({ configText: 'buyAuto 505 {\nminAmount 5\nmaxAmount 20\n}\nbuyAuto 501 {\nminAmount 10\nmaxAmount 40\n}' });
  assert.deepEqual(validateCanonicalConfig(config), []);
  assert.deepEqual(nativeSupplyPolicy(config).buyRules.map((row) => row.itemId).sort(), [501, 505]);
});
const first = migrateLegacyConfig(legacy);
const second = migrateLegacyConfig(legacy);
check('3 1666-row legacy template migrates deterministically', () => {
  assert.deepEqual(validateCanonicalConfig(first.config), []);
  assert.deepEqual(JSON.stringify(first.config), JSON.stringify(second.config));
  assert.deepEqual(first.migration.itemRuleProjection, { itemsControlRows: 1666, pickupRows: 5,
    projected: 4, retainedOutsideM1: 1628, duplicates: 36, invalid: 0 });
});
const rules = new Map(first.config.supply.itemRules.map((row) => [row.item, row]));
check('4 Fly Wing keeps fixed nonconsumable policy only', () => {
  assert.deepEqual([rules.get('601').keepAmount, rules.get('601').storage, rules.get('601').sell], [1, false, false]);
  assert.ok(!first.config.supply.services.buy.rules.some((row) => row.item === '601'));
});
check('5 Butterfly Wing keeps fixed nonconsumable policy only', () => {
  assert.deepEqual([rules.get('602').keepAmount, rules.get('602').storage, rules.get('602').sell], [1, false, false]);
  assert.ok(!first.config.supply.services.buy.rules.some((row) => row.item === '602'));
});
check('6 Arrow rows create no rule', () => assert.equal(rules.has('1750'), false));
check('7 Bullet rows create no rule', () => assert.equal(rules.has('13200'), false));
const profile = resolveFarmExecutionProfile(first.config, { targetMap: 'pay_fild07', survivalEnabled: true });
check('8 weight trigger stays out of the start_farm execution payload', () => {
  assert.equal(profile.ok, true);
  assert.equal('weightTriggerPercent' in profile.payload, false);
});
check('9 inventory slot trigger stays out of the start_farm execution payload', () =>
  assert.equal('inventorySlotTrigger' in profile.payload, false));
check('10 storage rows are not projected', () =>
  assert.equal(first.config.supply.itemRules.filter((row) => row.storage && row.item !== 'all').length, 0));
check('11 sell rows are not projected', () =>
  assert.equal(first.config.supply.itemRules.filter((row) => row.sell).length, 0));
check('12 duplicates collapse and every source line is retained', () => {
  assert.equal(first.migration.retained.itemsControl.length, 1666);
  assert.equal(new Set(first.config.supply.itemRules.map((row) => row.item)).size, first.config.supply.itemRules.length);
  assert.ok(first.migration.mappings.some((row) => row.disposition === 'RETAIN_OUTSIDE_M1'));
});
check('13 current HP consumable behavior is preserved', () => {
  assert.deepEqual(first.config.supply.services.buy.rules.map((row) => [row.item, row.minAmount, row.maxAmount]), [['501', 50, 100]]);
  assert.deepEqual(first.config.combat.itemUse.map((row) => row.item), ['501']);
  assert.equal(rules.get('all').storage, true);
  const web = migrateLegacyConfig({ ...legacy, supplyCycle: { ...supplyCycle, rules: [{ itemId: 909, action: 'sell' }] } });
  assert.equal(web.config.supply.itemRules.find((row) => row.item === '909').sell, true);
});
check('14 migrated config satisfies both validators', () => {
  assert.ok(first.config.supply.itemRules.length <= 300);
  assert.equal(nativeSupplyPolicy(first.config).itemRules.length, 4);
});
check('15 over-limit canonical rows still fail closed', () => {
  const tooMany = defaultCanonicalConfig(0);
  for (let id = 1000; tooMany.supply.itemRules.length <= 300; id++)
    tooMany.supply.itemRules.push({ ...tooMany.supply.itemRules[1], item: String(id) });
  assert.ok(validateCanonicalConfig(tooMany).some((row) => row.path === 'supply.itemRules'));
});
check('16 projected rule order is stable', () =>
  assert.deepEqual(first.config.supply.itemRules.map((row) => row.item), ['all', '602', '601', '501']));

// Current dashboard source: settings migration -> start_farm rules -> payload.
const source = await readFile(new URL('../ops/ro-stack/dashboard.mjs', import.meta.url), 'utf8');
const start = source.indexOf('async function buildCanonicalFarmRules(');
const end = source.indexOf('async function nativeSupplyServicePlan(', start);
assert.ok(start >= 0 && end > start, 'buildCanonicalFarmRules is present');
class HttpError extends Error { constructor(statusCode, message) { super(message); this.statusCode = statusCode; } }
const root = await mkdtemp(join(tmpdir(), 'legacy-item-rule-start-farm-'));
try {
  const folder = join(root, 'player_2000139');
  await mkdir(join(folder, 'control'), { recursive: true });
  await writeFile(join(folder, 'supply-cycle.json'), JSON.stringify(supplyCycle));
  await writeFile(join(folder, 'control', 'config.txt'), configText);
  await writeFile(join(folder, 'control', 'items_control.txt'), itemsControlText);
  await writeFile(join(folder, 'control', 'pickupitems.txt'), pickupText);
  for (const flag of [false, true]) {
    const build = runInNewContext(`(${source.slice(start, end)})`, {
      loadCanonicalConfig, instancesRoot: root, resolveFarmExecutionProfile, nativeSupplyPolicy,
      nativeSupplyPolicyCommandEnabled: flag, HttpError,
      nativeSupplyServicePlan: async () => ({ shopServiceRoute: [], shopNpcName: 'fixture_shop' }),
      readCharacterSavePoint: async () => null, SUPPLY_TOWN_SERVICES: {},
    });
    const base = { targetMap: 'pay_fild07', lootEnabled: true, skillEnabled: false, skillId: 0,
      survivalEnabled: true, deathRecoveryEnabled: true };
    let status = 202; let payload = null;
    try { payload = await build({ accountId: 2000139, characterId: 150095 }, base); }
    catch (error) { status = Number(error?.statusCode) || 400; }
    assert.equal(status, 202, `start_farm flag=${flag}`);
    const commandPayload = JSON.stringify(payload);
    assert.equal(payload.targetMap, 'pay_fild07');
    assert.equal(commandPayload.includes('13200'), false);
    if (flag) assert.deepEqual(payload.supplyPolicy.buyRules, [{ itemId: 501, minAmount: 50, maxAmount: 100 }]);
    else assert.equal('supplyPolicy' in payload, false);
  }
  assert.deepEqual(await readdir(folder).then((names) => names.includes('config')), false,
    'start_farm migration does not write Player settings');
  cases++;
} finally { await rm(root, { recursive: true, force: true }); }
console.log('LEGACY_ITEM_RULE_MIGRATION_PASS', JSON.stringify({ cases, legacyRows: 1666, projected: 4 }));
