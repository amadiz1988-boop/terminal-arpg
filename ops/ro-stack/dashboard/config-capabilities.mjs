import { CONFIG_FORM_SCHEMA, defaultConfigRow, getConfigPath } from './config-schema.mjs';
import { resolveAttackSkillProfile } from './attack-skill-profile.mjs';
import { resolveSelfRecoverySkillProfile } from './self-recovery-skill-profile.mjs';
import { resolveHpPotionProfile } from './hp-potion-profile.mjs';

// UI metadata only. The server must explicitly attest each accepted executor
// capability before a stored configuration field can become interactive.
export const CONFIG_SECTIONS = Object.freeze([
  '掛機', '戰鬥', '技能', 'HP / SP', '補給', '蒼蠅翅膀',
  '蝴蝶翅膀 / 回城補給', '恢復', '進階功能 / 尚未支援',
]);

// This capability list is admitted only behind the controlled Native M1
// rollout and a real SERVER_AGENT character controller. Saved combat intent is
// effective on the next start_farm; it is not an immediate combat mutation.
export const M1_EXECUTOR_PATHS = Object.freeze([
  'supply.enabled', 'supply.services.buy.enabled', 'supply.services.buy.rules',
  // M1_INVENTORY_MAINTENANCE_V1: OpenKore itemsMaxWeight_sellOrStore,
  // itemsMaxNum_sellOrStore, storageAuto, sellAuto and items_control rows.
  'supply.weightTriggerPercent', 'supply.inventorySlotTrigger',
  'supply.services.storage.enabled', 'supply.services.sell.enabled',
  'supply.itemRules',
  'combat.profile', 'combat.attack.mode', 'combat.attack.useWeapon',
  'combat.attack.distance', 'combat.attack.maxDistance',
  'combat.travel.flyWing.enabled', 'combat.skills.attackSlots',
  'combat.skills.selfSkills', 'combat.itemUse',
]);

export function m1ConfigExecutionCapabilities(rolloutEnabled, controllerReady) {
  if (!rolloutEnabled || !controllerReady) return {};
  return Object.fromEntries(M1_EXECUTOR_PATHS.map((path) => [path, 'SUPPORTED']));
}

export function configControlVisible(path) {
  // Cross-map travel is controlled by the World Map action, not Player
  // Navigation settings. Retain the stored schema field for migration only.
  return path !== 'combat.attack.routeToLock';
}

export function configSection(path) {
  if (path.startsWith('combat.follow.') || path === 'combat.skills.partySkills') return CONFIG_SECTIONS[8];
  if (path.startsWith('combat.travel.flyWing.') || path.startsWith('combat.travel.teleport.')) return CONFIG_SECTIONS[5];
  if (path.startsWith('supply.tools.butterflyWing.')) return CONFIG_SECTIONS[6];
  if (path === 'combat.skills.selfSkills') return CONFIG_SECTIONS[7];
  if (path === 'combat.itemUse') return CONFIG_SECTIONS[3];
  if (path === 'combat.skills.attackSlots') return CONFIG_SECTIONS[2];
  if (path === 'combat.profile') return CONFIG_SECTIONS[0];
  if (path.startsWith('combat.')) return CONFIG_SECTIONS[1];
  if (path.startsWith('supply.')) return CONFIG_SECTIONS[4];
  return CONFIG_SECTIONS[8];
}

export function configCapability(execution, path) {
  // These are outside the authorized first M1 core loop. The existing stored
  // values are preserved but the controls cannot send a new policy.
  if (path.startsWith('combat.follow.') || path === 'combat.skills.partySkills') return 'UNAVAILABLE';
  const attested = execution?.capabilities?.[path];
  if (attested === 'UNAVAILABLE') return 'UNAVAILABLE';
  if (attested === 'SUPPORTED' && (execution?.applied === true || execution?.editable === true)) return 'SUPPORTED';
  return 'PARTIAL';
}

export function configCapabilityCounts(execution) {
  const counts = { SUPPORTED: 0, PARTIAL: 0, UNAVAILABLE: 0 };
  for (const schema of Object.values(CONFIG_FORM_SCHEMA)) {
    for (const descriptor of [...schema.fields, ...(schema.arrays ?? [])]) {
      if (descriptor.fixed || !configControlVisible(descriptor.path)) continue;
      counts[configCapability(execution, descriptor.path)]++;
    }
  }
  return counts;
}

// Historical config is retained, while writes require an attested executor.
// Array admission also rejects predicates which the M1 executor ignores.
const supportedRowPaths = Object.freeze({
  buy: new Set(['item', 'disabled', 'minAmount', 'maxAmount']),
  attackSkill: new Set(['skill', 'level', 'disabled', 'conditions.hp',
    'conditions.sp', 'conditions.timeout']),
  selfSkill: new Set(['skill', 'level', 'disabled', 'conditions.hp',
    'conditions.sp', 'conditions.timeout']),
  itemUse: new Set(['item', 'disabled', 'conditions.hp', 'conditions.timeout']),
  // Native parse_m1_supply_policy consumes exactly these items_control fields.
  itemRule: new Set(['item', 'keepAmount', 'storage', 'sell']),
});

export function configRowFieldSupported(kind, path) {
  return supportedRowPaths[kind]?.has(path) === true;
}

function changedPaths(before, after, prefix = '') {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (Array.isArray(before) || Array.isArray(after) ||
      !before || !after || typeof before !== 'object' || typeof after !== 'object')
    return [prefix];
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .flatMap((key) => changedPaths(before[key], after[key], prefix ? `${prefix}.${key}` : key));
}

function arrayRowChangesSupported(before, after, kind) {
  if (!supportedRowPaths[kind] || !Array.isArray(before) || !Array.isArray(after)) return false;
  for (let index = 0; index < after.length; index++) {
    const baseline = before[index] ?? defaultConfigRow(kind);
    if (changedPaths(baseline, after[index]).some((path) => !configRowFieldSupported(kind, path)))
      return false;
  }
  return true;
}

export function configWriteAdmission(before, after, execution) {
  const arrays = new Map(Object.values(CONFIG_FORM_SCHEMA)
    .flatMap((schema) => schema.arrays ?? []).map((descriptor) => [descriptor.path, descriptor.kind]));
  const scalarPaths = new Set(Object.values(CONFIG_FORM_SCHEMA)
    .flatMap((schema) => schema.fields).map((descriptor) => descriptor.path));
  const errors = [];
  const changed = changedPaths(before, after);
  for (const path of changed) {
    if (path === 'revision' || path === 'version') continue;
    if (configCapability(execution, path) !== 'SUPPORTED' ||
        !(scalarPaths.has(path) || arrays.has(path))) {
      errors.push(path);
      continue;
    }
    const kind = arrays.get(path);
    if (kind && !arrayRowChangesSupported(getConfigPath(before, path),
      getConfigPath(after, path), kind)) errors.push(path);
  }
  const touches = (...paths) => paths.some((path) => changed.includes(path));
  if (touches('combat.profile') &&
      !['MELEE_DAMAGE', 'SKILL_CAST', 'HYBRID_DAMAGE'].includes(after?.combat?.profile))
    errors.push('combat.profile');
  if (touches('combat.attack.mode') && after?.combat?.attack?.mode !== 2)
    errors.push('combat.attack.mode');
  if (touches('combat.attack.distance', 'combat.attack.maxDistance')) {
    const desired = after?.combat?.attack?.distance;
    const maximum = after?.combat?.attack?.maxDistance;
    if (!Number.isInteger(desired) || !Number.isInteger(maximum) ||
        desired < 1 || desired > 30 || maximum < desired || maximum > 30)
      errors.push('combat.attack.distance');
  }
  if (touches('combat.skills.attackSlots') && !resolveAttackSkillProfile(after).ok)
    errors.push('combat.skills.attackSlots');
  if (touches('combat.skills.selfSkills') && !resolveSelfRecoverySkillProfile(after).ok)
    errors.push('combat.skills.selfSkills');
  if (touches('combat.itemUse') && !resolveHpPotionProfile(after).ok)
    errors.push('combat.itemUse');
  return { ok: errors.length === 0, unsupportedPaths: [...new Set(errors)] };
}
