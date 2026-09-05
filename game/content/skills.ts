import type { SkillDefinition, SkillId } from '../core/types';

export const SKILLS: Record<SkillId, SkillDefinition> = {
  ember: { id: 'ember', name: '穿焰矢', description: '高單體，首領增傷', tags: ['attack', 'projectile', 'fire'], baseDamage: 1420, attacksPerSecond: 2.8, critChance: 38, moveSpeed: 126, color: '#ff8a47' },
  arc: { id: 'arc', name: '裂空電弧', description: '連鎖 5 次，清圖迅速', tags: ['spell', 'chain', 'lightning'], baseDamage: 1010, attacksPerSecond: 3.7, critChance: 30, moveSpeed: 148, color: '#7dd3fc' },
  quake: { id: 'quake', name: '玄鐵震地', description: '範圍重擊，生存穩定', tags: ['attack', 'area', 'physical'], baseDamage: 1760, attacksPerSecond: 2.1, critChance: 22, moveSpeed: 112, color: '#c4b5fd' },
};

export const POLICIES = {
  'full-clear': ['全圖掃蕩', '高掉落，耗時較長'],
  'boss-rush': ['首領突襲', '快速取得高階地圖'],
  currency: ['通貨獵人', '優先稀有與事件怪'],
} as const;
