import { CONFIG_FORM_SCHEMA } from './config-schema.mjs';

// UI metadata only. The server must explicitly attest each accepted executor
// capability before a stored configuration field can become interactive.
export const CONFIG_SECTIONS = Object.freeze([
  '掛機', '戰鬥', '技能', 'HP / SP', '補給', '蒼蠅翅膀',
  '蝴蝶翅膀 / 回城補給', '恢復', '進階功能 / 尚未支援',
]);

export function configSection(path) {
  if (path.startsWith('combat.follow.') || path === 'combat.skills.partySkills') return CONFIG_SECTIONS[8];
  if (path.startsWith('combat.travel.flyWing.') || path.startsWith('combat.travel.teleport.')) return CONFIG_SECTIONS[5];
  if (path.startsWith('supply.tools.butterflyWing.')) return CONFIG_SECTIONS[6];
  if (path === 'combat.skills.selfSkills') return CONFIG_SECTIONS[7];
  if (path === 'combat.itemUse') return CONFIG_SECTIONS[3];
  if (path === 'combat.skills.attackSlots') return CONFIG_SECTIONS[2];
  if (path === 'combat.profile' || path === 'combat.attack.routeToLock') return CONFIG_SECTIONS[0];
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
  if (attested === 'SUPPORTED' && execution?.applied === true) return 'SUPPORTED';
  return 'PARTIAL';
}

export function configCapabilityCounts(execution) {
  const counts = { SUPPORTED: 0, PARTIAL: 0, UNAVAILABLE: 0 };
  for (const schema of Object.values(CONFIG_FORM_SCHEMA)) {
    for (const descriptor of [...schema.fields, ...(schema.arrays ?? [])]) {
      if (descriptor.fixed) continue;
      counts[configCapability(execution, descriptor.path)]++;
    }
  }
  return counts;
}
