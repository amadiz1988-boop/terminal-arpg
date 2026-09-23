import assert from 'node:assert/strict';
import { CONFIG_FORM_SCHEMA } from '../ops/ro-stack/dashboard/config-schema.mjs';
import {
  CONFIG_SECTIONS, configCapability, configCapabilityCounts, configControlVisible, configSection,
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
assert.equal(configCapability({ applied: true, capabilities: { 'combat.profile': 'SUPPORTED' } }, 'combat.profile'), 'SUPPORTED');
assert.equal(configCapability({ applied: true, capabilities: { 'combat.profile': 'PARTIAL' } }, 'combat.profile'), 'PARTIAL');
assert.equal(configCapability({ applied: true, capabilities: { 'combat.profile': 'UNAVAILABLE' } }, 'combat.profile'), 'UNAVAILABLE');
assert.equal(configCapability({ applied: true, capabilities: { 'combat.skills.partySkills': 'SUPPORTED' } }, 'combat.skills.partySkills'), 'UNAVAILABLE');
assert.equal(configSection('combat.travel.flyWing.enabled'), '蒼蠅翅膀');
assert.equal(configSection('supply.tools.butterflyWing.required'), '蝴蝶翅膀 / 回城補給');
assert.equal(configSection('combat.itemUse'), 'HP / SP');
console.log(`M1_CONFIG_CAPABILITY_GATE_PASS fields=${all.length} sections=${CONFIG_SECTIONS.length}`);
