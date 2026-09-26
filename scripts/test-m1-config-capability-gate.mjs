import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG_FORM_SCHEMA, clone, defaultCanonicalConfig, defaultConfigRow,
  getConfigPath, setConfigPath } from '../ops/ro-stack/dashboard/config-schema.mjs';
import {
  CONFIG_SECTIONS, configCapability, configCapabilityCounts, configControlVisible,
  configRowFieldSupported, configSection, configWriteAdmission,
  M1_EXECUTOR_PATHS, m1ConfigExecutionCapabilities,
} from '../ops/ro-stack/dashboard/config-capabilities.mjs';

const all = Object.values(CONFIG_FORM_SCHEMA).flatMap((schema) => [...schema.fields, ...(schema.arrays ?? [])]);
assert.equal(CONFIG_SECTIONS.length, 9);
assert.equal(new Set(CONFIG_SECTIONS).size, 9);
for (const descriptor of all) assert.ok(CONFIG_SECTIONS.includes(configSection(descriptor.path)), descriptor.path);

const unaccepted = { applied: false, reason: 'CONFIG_ONLY_NO_EXECUTOR_COMMAND' };
const initial = configCapabilityCounts(unaccepted);
assert.equal(initial.SUPPORTED, 0);
assert.equal(initial.PARTIAL + initial.UNAVAILABLE, all.filter((descriptor) =>
  !descriptor.fixed && configControlVisible(descriptor.path)).length);
assert.equal(configControlVisible('combat.attack.routeToLock'), false);
assert.equal(configCapability(unaccepted, 'combat.skills.attackSlots'), 'PARTIAL');
assert.equal(configCapability(unaccepted, 'combat.skills.partySkills'), 'UNAVAILABLE');
assert.equal(configCapability({ applied: false, capabilities: { 'combat.profile': 'SUPPORTED' } }, 'combat.profile'), 'PARTIAL');
assert.equal(configCapability({ applied: false, editable: true, capabilities: { 'supply.enabled': 'SUPPORTED' } }, 'supply.enabled'), 'SUPPORTED');
assert.equal(configCapability({ applied: true, capabilities: { 'combat.profile': 'SUPPORTED' } }, 'combat.profile'), 'SUPPORTED');
assert.equal(configCapability({ applied: true, capabilities: { 'combat.profile': 'PARTIAL' } }, 'combat.profile'), 'PARTIAL');
assert.equal(configCapability({ applied: true, capabilities: { 'combat.profile': 'UNAVAILABLE' } }, 'combat.profile'), 'UNAVAILABLE');
assert.equal(configCapability({ applied: true, capabilities: { 'combat.skills.partySkills': 'SUPPORTED' } }, 'combat.skills.partySkills'), 'UNAVAILABLE');
// M1_INVENTORY_MAINTENANCE_V1: these are now attested executor paths.
for (const path of [
  'supply.weightTriggerPercent', 'supply.inventorySlotTrigger',
  'supply.services.storage.enabled', 'supply.services.sell.enabled', 'supply.itemRules',
]) {
  assert.equal(configCapability({ editable: true, capabilities: { [path]: 'SUPPORTED' } }, path), 'SUPPORTED');
  assert.equal(configCapability(unaccepted, path), 'PARTIAL');
}
// Storage/sell NPC overrides stay on the canonical Saved Town services.
assert.notEqual(configCapability({ editable: true, capabilities: m1ConfigExecutionCapabilities(true, true) },
  'supply.services.storage.npc'), 'SUPPORTED');
assert.equal(configSection('combat.travel.flyWing.enabled'), '蒼蠅翅膀');
assert.equal(configSection('supply.tools.butterflyWing.required'), '蝴蝶翅膀 / 回城補給');
assert.equal(configSection('combat.itemUse'), 'HP / SP');
const before = defaultCanonicalConfig();
const editableSupply = { editable: true, capabilities: Object.fromEntries([
  'supply.enabled', 'supply.services.buy.enabled', 'supply.services.buy.rules',
].map((path) => [path, 'SUPPORTED'])) };
const changed = (mutate, execution = editableSupply) => {
  const after = clone(before);
  mutate(after);
  return configWriteAdmission(before, after, execution);
};
assert.deepEqual(changed((config) => { config.supply.enabled = true; }),
  { ok: true, unsupportedPaths: [] });
assert.deepEqual(changed((config) => { config.supply.enabled = true; }, unaccepted),
  { ok: false, unsupportedPaths: ['supply.enabled'] });
assert.deepEqual(changed((config) => { config.supply.weightTriggerPercent = 80; }),
  { ok: false, unsupportedPaths: ['supply.weightTriggerPercent'] });
assert.deepEqual(changed((config) => { config.combat.profile = 'SKILL_CAST'; }),
  { ok: false, unsupportedPaths: ['combat.profile'] });
assert.deepEqual(changed((config) => { config.supply.services.buy.rules[0].maxAmount = 30; }),
  { ok: true, unsupportedPaths: [] });
assert.deepEqual(changed((config) => { config.supply.services.buy.rules[0].npc = 'prontera'; }),
  { ok: false, unsupportedPaths: ['supply.services.buy.rules'] });
assert.deepEqual(changed((config) => { config.unknownField = true; }),
  { ok: false, unsupportedPaths: ['unknownField'] });
assert.equal(configRowFieldSupported('buy', 'maxAmount'), true);
assert.equal(configRowFieldSupported('buy', 'npc'), false);
assert.equal(configRowFieldSupported('selfSkill', 'conditions.hp'), true);
assert.equal(configRowFieldSupported('selfSkill', 'conditions.whenStatusActive'), false);
assert.equal(M1_EXECUTOR_PATHS.length, 17);
assert.deepEqual(m1ConfigExecutionCapabilities(false, true), {});
assert.deepEqual(m1ConfigExecutionCapabilities(true, false), {});
assert.equal(Object.keys(m1ConfigExecutionCapabilities(true, true)).length, 17);
assert.equal(configCapability({ editable: true,
  capabilities: m1ConfigExecutionCapabilities(true, true) }, 'combat.skills.selfSkills'), 'SUPPORTED');
const m1Execution = { editable: true, capabilities: m1ConfigExecutionCapabilities(true, true) };
const visible = all.filter((descriptor) => configControlVisible(descriptor.path));
const editable = visible.filter((descriptor) => !descriptor.fixed &&
  configCapability(m1Execution, descriptor.path) === 'SUPPORTED');
const disabled = visible.filter((descriptor) => !descriptor.fixed &&
  configCapability(m1Execution, descriptor.path) !== 'SUPPORTED');
assert.equal(all.length, 46);
assert.equal(visible.length, 45);
assert.equal(visible.filter((descriptor) => descriptor.fixed).length, 3);
assert.deepEqual(configCapabilityCounts(m1Execution),
  { SUPPORTED: 17, PARTIAL: 20, UNAVAILABLE: 5 });
assert.equal(editable.length, M1_EXECUTOR_PATHS.length);
assert.equal(new Set(M1_EXECUTOR_PATHS).size, editable.length);
assert.deepEqual(new Set(editable.map((descriptor) => descriptor.path)), new Set(M1_EXECUTOR_PATHS));
assert.equal(disabled.length, 25);
for (const descriptor of disabled) {
  const path = descriptor.path;
  const current = getConfigPath(before, path);
  const value = Array.isArray(current) ? [{ item: '501' }] :
    typeof current === 'boolean' ? !current :
      typeof current === 'number' ? current + 1 : `${current}shipping-contract-probe`;
  const candidate = clone(before);
  setConfigPath(candidate, path, value);
  assert.ok(configWriteAdmission(before, candidate, m1Execution).unsupportedPaths.includes(path), path);
}
const editorSource = readFileSync(new URL('../ops/ro-stack/dashboard/config-editor.js', import.meta.url), 'utf8');
assert.match(editorSource, /input\.disabled = locked/);
assert.match(editorSource, /add\.disabled = capability !== 'SUPPORTED'/);
assert.match(editorSource, /remove\.disabled = capability !== 'SUPPORTED'/);
assert.equal(configCapability(m1Execution, 'combat.attack.routeToLock'), 'PARTIAL');
assert.equal(configControlVisible('combat.attack.routeToLock'), false);
assert.deepEqual(changed((config) => { config.supply.weightTriggerPercent = 60; }, m1Execution),
  { ok: true, unsupportedPaths: [] });
assert.deepEqual(changed((config) => { config.supply.services.sell.enabled = true; }, m1Execution),
  { ok: true, unsupportedPaths: [] });
assert.deepEqual(changed((config) => { config.supply.itemRules.push({ ...defaultConfigRow('itemRule'),
  item: '909', keepAmount: 0, storage: false, sell: true }); }, m1Execution), { ok: true, unsupportedPaths: [] });
assert.deepEqual(changed((config) => { config.supply.itemRules[0].cartAdd = true; }, m1Execution),
  { ok: false, unsupportedPaths: ['supply.itemRules'] });
assert.deepEqual(changed((config) => { config.combat.attack.mode = 1; }, m1Execution),
  { ok: false, unsupportedPaths: ['combat.attack.mode'] });
assert.deepEqual(changed((config) => { config.combat.attack.distance = 2.5; }, m1Execution),
  { ok: false, unsupportedPaths: ['combat.attack.distance'] });
assert.deepEqual(changed((config) => { config.combat.profile = 'HEAL_SUPPORT'; }, m1Execution),
  { ok: false, unsupportedPaths: ['combat.profile'] });
assert.deepEqual(changed((config) => { config.combat.skills.selfSkills.push({
  skill: '28', level: 1, conditions: { hp: '< 60%' }, smartEncore: true,
}); }, m1Execution), { ok: false, unsupportedPaths: ['combat.skills.selfSkills'] });
console.log(`M1_CONFIG_CAPABILITY_GATE_PASS fields=${all.length} sections=${CONFIG_SECTIONS.length} ` +
  `editable=${editable.length} disabled=${disabled.length} unsupportedEditable=0 unmapped=0 configOnlyVisible=0 noOpVisible=0`);
