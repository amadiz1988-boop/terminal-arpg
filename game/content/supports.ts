import type { SupportDefinition, SupportId } from '../core/types';

export const SUPPORTS: Record<SupportId, SupportDefinition> = {
  momentum: { id: 'momentum', name: '氣勢輔助', description: '輔助攻擊技能，提高攻擊與清圖速度', damageMultiplier: 1, bossMultiplier: 1, clearMultiplier: 1.08, speedMultiplier: 1.18, lifeMultiplier: 1, socketColor: 'G', requiredSkillTags: ['attack'] },
  echo: { id: 'echo', name: '迴響輔助', description: '輔助法術技能，使施放重複', damageMultiplier: 1.24, bossMultiplier: 1.08, clearMultiplier: 1.08, speedMultiplier: .94, lifeMultiplier: 1, socketColor: 'B', requiredSkillTags: ['spell'] },
  focus: { id: 'focus', name: '集中效應輔助', description: '輔助範圍技能，犧牲範圍換取首領傷害', damageMultiplier: 1.18, bossMultiplier: 1.35, clearMultiplier: .82, speedMultiplier: 1, lifeMultiplier: 1, socketColor: 'B', requiredSkillTags: ['area'] },
  fortify: { id: 'fortify', name: '護體輔助', description: '輔助近戰技能，降低少量輸出換取生存', damageMultiplier: .94, bossMultiplier: 1, clearMultiplier: 1, speedMultiplier: 1, lifeMultiplier: 1.28, socketColor: 'R', requiredSkillTags: ['melee'] },
};

export const SUPPORT_ORDER: SupportId[] = ['momentum', 'echo', 'focus', 'fortify'];

export function isSupportCompatible(support: SupportDefinition, skillTags: string[]) {
  const required = support.requiredSkillTags.length === 0 || support.requiredSkillTags.some((tag) => skillTags.includes(tag));
  const excluded = (support.excludedSkillTags ?? []).some((tag) => skillTags.includes(tag));
  return required && !excluded;
}
