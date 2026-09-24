import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  COMBAT_PROFILES, CONFIG_FORM_SCHEMA, FIXED_POLICY, applyProfileTemplate, applySupplyCycleSettings, canonicalToOpenKorePreview,
  defaultCanonicalConfig, migrateLegacyConfig, validateCanonicalConfig,
} from '../ops/ro-stack/dashboard/config-schema.mjs';
import { loadCanonicalConfig, saveCanonicalConfig } from '../ops/ro-stack/dashboard/config-storage.mjs';
const expectValid = (config) => assert.deepEqual(validateCanonicalConfig(config), []);
const base = defaultCanonicalConfig(0);
expectValid(base);
assert.deepEqual(base.supply.loot, FIXED_POLICY.loot);
assert.equal(base.supply.itemRules.find((row) => row.item === 'all').storage, true);
assert.equal(base.supply.itemRules.find((row) => row.item === '501').keepAmount, 100);
assert.deepEqual(base.combat.loot, FIXED_POLICY.loot);
assert.equal(base.supply.tools.butterflyWing.presenceBased, true);
assert.equal(base.supply.tools.butterflyWing.nonConsumable, true);
assert.equal(base.supply.tools.butterflyWing.weight, 0);
assert.equal(base.combat.travel.flyWing.enabled, true);
assert.equal(COMBAT_PROFILES.length, 8);
assert.equal(CONFIG_FORM_SCHEMA.supply.arrays.find((row) => row.kind === 'buy').path, 'supply.services.buy.rules');
assert.equal(CONFIG_FORM_SCHEMA.combat.arrays.find((row) => row.kind === 'attackSkill').path, 'combat.skills.attackSlots');
const supplyForm = applySupplyCycleSettings(base, { enabled: true, returnWeight: 68,
  store: false, sell: true, buy: false, redPotionMin: 7, redPotionMax: 30,
  rules: [{ itemId: 909, action: 'sell' }] });
expectValid(supplyForm);
assert.deepEqual([supplyForm.supply.enabled, supplyForm.supply.weightTriggerPercent,
  supplyForm.supply.services.storage.enabled, supplyForm.supply.services.sell.enabled,
  supplyForm.supply.services.buy.enabled], [true, 68, false, true, false]);
assert.deepEqual([supplyForm.supply.services.buy.rules[0].minAmount,
  supplyForm.supply.services.buy.rules[0].maxAmount], [7, 30]);
assert.deepEqual(supplyForm.supply.itemRules.find((row) => row.item === '909')?.sell, true);
assert.equal(base.supply.enabled, false);
const legacyText = [
  'attackAuto 0', 'attackUseWeapon 0', 'attackDistance 2', 'attackMaxDistance 4',
  'itemsMaxNum_sellOrStore 88',
  'attackCheckLOS 1', 'attackCanSnipe 0', 'attackAuto_routeToLock 1',
  'attackRouteMaxPathDistance 17',
  'teleportAuto_hp 15%', 'teleportAuto_sp > 20%',
  'attackSkillSlot_0 SM_BASH', 'attackSkillSlot_0_lvl 5', 'attackSkillSlot_0_dist 2',
  'attackSkillSlot_0_maxDist 4', 'attackSkillSlot_0_maxCastTime 350',
  'attackSkillSlot_0_minCastTime 25', 'attackSkillSlot_0_maxAttempts 2',
  'useSelf_skill_0 AL_HEAL', 'useSelf_skill_0_lvl 3', 'useSelf_skill_0_hp < 70%',
  'buyAuto_0 Red Potion', 'buyAuto_0_minAmount 5', 'buyAuto_0_maxAmount 20', 'buyAuto_0_batchSize 5',
  'getAuto_0 Fly Wing', 'getAuto_0_minAmount 2', 'getAuto_0_maxAmount 30', 'getAuto_0_batchSize 10',
].join('\n');
const migrated = migrateLegacyConfig({
  source: 'test-legacy',
  supplyCycle: { enabled: true, returnWeight: 68, store: true, sell: false, buy: true,
    rules: [{ itemId: 501, action: 'keep' }, { itemId: 909, action: 'sell' }, { itemId: 910, action: 'store' }, { itemId: 911, action: 'ignore' }, { itemId: 912, action: 'discard' }] },
  configText: legacyText,
  itemsControlText: 'all 0 1 0',
  skillAutomation: { buff: { handle: 'AL_BLESSING', level: 10, minimumSp: 20 } },
});
expectValid(migrated.config);
assert.equal(migrated.config.supply.enabled, true);
assert.equal(migrated.config.supply.weightTriggerPercent, 68);
assert.equal(migrated.config.supply.inventorySlotTrigger, 88);
assert.equal(migrated.config.supply.services.buy.enabled, true);
assert.equal(migrated.config.supply.services.sell.enabled, false);
assert.equal(migrated.config.supply.services.buy.rules[0].minAmount, 5);
assert.equal(migrated.config.supply.services.buy.rules[0].item, '501');
assert.equal(migrated.config.supply.services.buy.rules[0].maxAmount, 20);
assert.equal(migrated.config.supply.services.withdraw.rules[0].item, 'Fly Wing');
assert.equal(migrated.config.supply.services.withdraw.rules[0].batchSize, 10);
assert.equal(migrated.config.supply.itemRules.find((x) => x.item === '909').sell, true);
assert.equal(migrated.config.supply.itemRules.find((x) => x.item === '910').storage, true);
assert.equal(migrated.config.supply.itemRules.find((x) => x.item === '911').pickup, 0);
assert.equal(migrated.config.supply.itemRules.find((x) => x.item === '912').pickup, -1);
assert.equal(migrated.config.supply.itemRules.find((x) => x.item === 'all').storage, true);
assert.equal(migrated.config.supply.itemRules.find((x) => x.item === '501').storage, false);
assert.equal(migrated.config.combat.attack.mode, 0);
assert.equal(migrated.config.combat.attack.useWeapon, false);
assert.equal(migrated.config.combat.attack.checkLOS, true);
assert.equal(migrated.config.combat.skills.attackSlots[0].maxCastTime, 350);
assert.equal(migrated.config.combat.skills.attackSlots[0].minCastTime, 25);
assert.equal(migrated.config.combat.skills.selfSkills[0].conditions.hp, '< 70%');
assert.ok(migrated.config.combat.skills.selfSkills.some((row) => row.skill === 'AL_BLESSING'));
assert.equal(migrated.config.combat.profile, 'SKILL_CAST');
assert.equal(migrated.config.combat.travel.teleport.sp, '> 20%');
assert.equal(migrated.config.combat.attack.distance, 2);
assert.equal(migrated.config.combat.attack.maxDistance, 4);
assert.equal(migrated.config.combat.attack.maxRouteDistance, 17);
assert.equal(base.combat.attack.maxRouteDistance, 20);
assert.equal(migrated.config.supply.loot.autoLoot, true);
assert.equal(migrated.config.supply.loot.autoStore, false);
assert.equal(migrated.config.combat.travel.flyWing.enabled, true);
assert.ok(migrated.migration.mappings.some((entry) => entry.disposition === 'REMOVE_DUPLICATE'));
for (const profile of COMBAT_PROFILES) {
  const candidate = applyProfileTemplate(base, profile);
  expectValid(candidate);
  if (profile === 'SKILL_CAST') assert.equal(candidate.combat.attack.useWeapon, false);
  if (profile === 'MELEE_DAMAGE' || profile === 'HYBRID_DAMAGE') assert.equal(candidate.combat.attack.useWeapon, true);
  if (profile === 'HEAL_SUPPORT' || profile === 'PASSIVE_FOLLOW') assert.equal(candidate.combat.attack.mode, -1);
  if (profile === 'FOLLOW_SUPPORT' || profile === 'PASSIVE_FOLLOW') assert.equal(candidate.combat.follow.enabled, true);
}
const flyOff = applyProfileTemplate(base, 'RANGED_DAMAGE');
flyOff.combat.travel.flyWing.enabled = false;
expectValid(flyOff);
const preview = canonicalToOpenKorePreview(migrated.config);
assert.match(preview.configText, /attackAuto 0/);
assert.match(preview.configText, /attackUseWeapon 0/);
assert.match(preview.configText, /attackRouteMaxPathDistance 17/);
assert.doesNotMatch(preview.configText, /attackMaxRouteDistance/);
assert.match(preview.configText, /itemsTakeAuto 2/);
assert.match(preview.configText, /getAuto Fly Wing/);
assert.match(preview.pickupitems, /911 0/);
assert.match(preview.itemsControl, /909 0 0 1 0 0/);
assert.match(preview.itemsControl, /^all 0 1 0 0 0$/m);
assert.match(preview.monControl, /^/);
const invalid = defaultCanonicalConfig(0);
invalid.combat.attack.mode = 9;
assert.ok(validateCanonicalConfig(invalid).some((entry) => entry.path === 'combat.attack.mode'));
invalid.combat.attack.mode = 2;
invalid.combat.loot.autoStore = true;
assert.ok(validateCanonicalConfig(invalid).some((entry) => entry.path === 'combat.loot.autoStore'));
invalid.combat.loot.autoStore = false;
invalid.supply.tools.butterflyWing.itemId = 601;
assert.ok(validateCanonicalConfig(invalid).some((entry) => entry.path === 'supply.tools.butterflyWing.itemId'));
const root = await mkdtemp(join(tmpdir(), 'ghost-island-config-contract-'));
try {
  const first = await loadCanonicalConfig({ instancesRoot: root, accountId: 7, characterId: 70 });
  assert.equal(first.source, 'default');
  const saved = await saveCanonicalConfig({ instancesRoot: root, accountId: 7, characterId: 70, config: migrated.config, expectedRevision: first.config.revision });
  assert.equal(saved.config.revision, 1);
  const reloaded = await loadCanonicalConfig({ instancesRoot: root, accountId: 7, characterId: 70 });
  assert.equal(reloaded.config.revision, 1);
  assert.equal(reloaded.config.combat.skills.attackSlots[0].skill, 'SM_BASH');
  await assert.rejects(() => saveCanonicalConfig({ instancesRoot: root, accountId: 7, characterId: 70, config: reloaded.config, expectedRevision: 0 }), (error) => error.code === 'CONFIG_REVISION_CONFLICT');
  const raw = JSON.parse(await readFile(join(root, 'player_7', 'config', 'character_70.json'), 'utf8'));
  assert.equal(raw.revision, 1);
} finally { await rm(root, { recursive: true, force: true }); }
console.log('OPENKORE_CONFIG_SCHEMA_TEST_PASS', JSON.stringify({ profiles: COMBAT_PROFILES.length, mappings: migrated.migration.mappings.length, checks: 'schema-contract' }));
