import type { SkillDefinition, SkillId } from '../core/types';

export const SKILLS: Record<SkillId, SkillDefinition> = {
  ember: { id: 'ember', name: '穿焰矢', description: '高單體，首領增傷', tags: ['attack', 'projectile', 'fire'], baseDamage: 1420, attacksPerSecond: 2.8, critChance: 38, moveSpeed: 126, color: '#65d99b', socketColor: 'G' },
  arc: { id: 'arc', name: '裂空電弧', description: '連鎖 5 次，清圖迅速', tags: ['spell', 'chain', 'lightning'], baseDamage: 1010, attacksPerSecond: 3.7, critChance: 30, moveSpeed: 148, color: '#7dd3fc', socketColor: 'B' },
  quake: { id: 'quake', name: '玄鐵震地', description: '範圍重擊，生存穩定', tags: ['attack', 'area', 'physical'], baseDamage: 1760, attacksPerSecond: 2.1, critChance: 22, moveSpeed: 112, color: '#f87171', socketColor: 'R' },
  venom: { id: 'venom', name: '音速投擲', description: '高速近戰，暴擊時連續追擊', tags: ['attack', 'melee', 'critical'], baseDamage: 760, attacksPerSecond: 6.2, critChance: 48, moveSpeed: 142, color: '#65d99b', socketColor: 'G' },
  firebolt: { id: 'firebolt', name: '火箭術', description: '火焰法術，可轉點燃或爆發', tags: ['spell', 'fire', 'projectile'], baseDamage: 1680, attacksPerSecond: 2.2, critChance: 26, moveSpeed: 118, color: '#7dd3fc', socketColor: 'B' },
  smite: { id: 'smite', name: '聖光重擊', description: '近戰聖光，可走暴力或召喚', tags: ['attack', 'melee', 'holy'], baseDamage: 1320, attacksPerSecond: 3, critChance: 30, moveSpeed: 124, color: '#f87171', socketColor: 'R' },
};

export const POLICIES = {
  'full-clear': ['全圖掃蕩', '高掉落，耗時較長'],
  'boss-rush': ['首領突襲', '快速取得高階地圖'],
  currency: ['通貨獵人', '優先稀有與事件怪'],
} as const;
