import type { ClassId, SecondJobId, SkillId } from '../core/types';

type Effect = { damage?: number; speed?: number; crit?: number; move?: number; life?: number; armor?: number; boss?: number; clear?: number };

export const CLASSES: Record<ClassId, { name: string; trait: string; description: string; starterSkill: SkillId; effect: Effect; jobs: SecondJobId[] }> = {
  thief: { name: '盜賊', trait: '雙擊節奏', description: '攻擊越快，暴擊回饋越密集', starterSkill: 'cycloneTumult', effect: { speed: 15, crit: 12, move: 8 }, jobs: ['assassin', 'rogue'] },
  mage: { name: '魔法師', trait: '元素共鳴', description: '法術寶石獲得額外傷害與清圖能力', starterSkill: 'winterOrb', effect: { damage: 18, clear: 12 }, jobs: ['wizard', 'sage'] },
  acolyte: { name: '服事', trait: '信仰轉換', description: '生命與傷害同時成長，可走暴力或召喚', starterSkill: 'penanceBrand', effect: { damage: 8, life: 18 }, jobs: ['priest', 'monk'] },
};

export const SECOND_JOBS: Record<SecondJobId, { name: string; classId: ClassId; trait: string; description: string; effect: Effect; nodes: Array<{ id: string; name: string; description: string; effect: Effect }> }> = {
  assassin: { name: '刺客', classId: 'thief', trait: '拳刃狂舞', description: '暴擊會追加一次快速傷害回報', effect: { crit: 22, speed: 18 }, nodes: [
    { id: 'assassin-katar', name: '拳刃專精', description: '+25% 暴擊率', effect: { crit: 25 } },
    { id: 'assassin-chain', name: '殘影連擊', description: '+20% 攻速與清圖', effect: { speed: 20, clear: 20 } },
    { id: 'assassin-lethal', name: '致命音速', description: '首領傷害 +35%', effect: { boss: 35 } },
  ] },
  rogue: { name: '流氓', classId: 'thief', trait: '掠奪標記', description: '提高通貨與地圖回收效率', effect: { move: 15, clear: 18 }, nodes: [
    { id: 'rogue-ambush', name: '伏擊', description: '+20% 傷害', effect: { damage: 20 } },
    { id: 'rogue-plunder', name: '巧取', description: '+25% 清圖效率', effect: { clear: 25 } },
    { id: 'rogue-escape', name: '脫身', description: '+25% 生命與移速', effect: { life: 25, move: 25 } },
  ] },
  wizard: { name: '巫師', classId: 'mage', trait: '元素風暴', description: '大幅強化範圍與元素爆發', effect: { damage: 22, clear: 28 }, nodes: [
    { id: 'wizard-echo', name: '魔力增幅', description: '+25% 傷害', effect: { damage: 25 } },
    { id: 'wizard-storm', name: '暴風連鎖', description: '+35% 清圖效率', effect: { clear: 35 } },
    { id: 'wizard-focus', name: '元素穿透', description: '首領傷害 +32%', effect: { boss: 32 } },
  ] },
  sage: { name: '賢者', classId: 'mage', trait: '法術編纂', description: '用防禦與速度換取穩定施法', effect: { speed: 15, life: 20 }, nodes: [
    { id: 'sage-cast', name: '快速詠唱', description: '+18% 攻速', effect: { speed: 18 } },
    { id: 'sage-barrier', name: '魔力屏障', description: '+30% 生命', effect: { life: 30 } },
    { id: 'sage-cycle', name: '元素循環', description: '+22% 傷害與清圖', effect: { damage: 22, clear: 22 } },
  ] },
  priest: { name: '祭司', classId: 'acolyte', trait: '神聖領域', description: '以高生存支撐法術、召喚或近戰', effect: { life: 35, armor: 20 }, nodes: [
    { id: 'priest-faith', name: '堅定信仰', description: '+35% 生命', effect: { life: 35 } },
    { id: 'priest-aura', name: '祝福光環', description: '+18% 傷害與攻速', effect: { damage: 18, speed: 18 } },
    { id: 'priest-judgement', name: '審判', description: '首領傷害 +30%', effect: { boss: 30 } },
  ] },
  monk: { name: '武僧', classId: 'acolyte', trait: '連環拳', description: '將信仰轉成高速近戰爆發', effect: { damage: 18, speed: 22, boss: 15 }, nodes: [
    { id: 'monk-combo', name: '六合連擊', description: '+25% 攻速', effect: { speed: 25 } },
    { id: 'monk-spirit', name: '蓄氣', description: '+28% 傷害', effect: { damage: 28 } },
    { id: 'monk-asura', name: '阿修羅霸凰拳', description: '首領傷害 +45%', effect: { boss: 45 } },
  ] },
};

export const ALL_RO_JOB_PATHS = [
  ['劍士', '騎士', '十字軍'], ['盜賊', '刺客', '流氓'], ['魔法師', '巫師', '賢者'],
  ['服事', '祭司', '武僧'], ['弓箭手', '獵人', '詩人／舞孃'], ['商人', '鐵匠', '鍊金術師'],
] as const;

export function classEffects(classId?: ClassId, secondJobId?: SecondJobId, nodes: string[] = []) {
  const sources: Effect[] = [classId ? CLASSES[classId].effect : {}, secondJobId ? SECOND_JOBS[secondJobId].effect : {}];
  if (secondJobId) sources.push(...SECOND_JOBS[secondJobId].nodes.filter((node) => nodes.includes(node.id)).map((node) => node.effect));
  return sources.reduce((total, effect) => ({
    damage: (total.damage ?? 0) + (effect.damage ?? 0), speed: (total.speed ?? 0) + (effect.speed ?? 0), crit: (total.crit ?? 0) + (effect.crit ?? 0), move: (total.move ?? 0) + (effect.move ?? 0), life: (total.life ?? 0) + (effect.life ?? 0), armor: (total.armor ?? 0) + (effect.armor ?? 0), boss: (total.boss ?? 0) + (effect.boss ?? 0), clear: (total.clear ?? 0) + (effect.clear ?? 0),
  }), {} as Effect);
}
