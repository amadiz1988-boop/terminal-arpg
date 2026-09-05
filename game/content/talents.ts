export type TalentBoardId = 'might' | 'hunt' | 'wisdom';
export type TalentEffect = { damage?: number; speed?: number; crit?: number; move?: number; life?: number; armor?: number; boss?: number; clear?: number };
export type TalentNode = { id: string; board: TalentBoardId; name: string; description: string; effect: TalentEffect; requires?: string };

export const TALENT_BOARDS: Record<TalentBoardId, { name: string; tag: string }> = {
  might: { name: '巨力之路', tag: '力量 · 攻擊' },
  hunt: { name: '狩獵之路', tag: '敏捷 · 速度' },
  wisdom: { name: '知識之路', tag: '智慧 · 法術' },
};

export const TALENTS: TalentNode[] = [
  { id: 'might-damage', board: 'might', name: '猛攻', description: '+12% 傷害', effect: { damage: 12 } },
  { id: 'might-life', board: 'might', name: '堅韌', description: '+15% 最大生命與護甲', effect: { life: 15, armor: 15 }, requires: 'might-damage' },
  { id: 'might-execute', board: 'might', name: '淘汰', description: '首領傷害 +28%', effect: { boss: 28 }, requires: 'might-life' },
  { id: 'hunt-speed', board: 'hunt', name: '疾行', description: '+8% 攻速與移速', effect: { speed: 8, move: 8 } },
  { id: 'hunt-crit', board: 'hunt', name: '致命節奏', description: '+18% 暴擊率', effect: { crit: 18 }, requires: 'hunt-speed' },
  { id: 'hunt-chain', board: 'hunt', name: '獵殺連鎖', description: '清圖效率 +30%', effect: { clear: 30 }, requires: 'hunt-crit' },
  { id: 'wisdom-power', board: 'wisdom', name: '秘法增幅', description: '+15% 傷害', effect: { damage: 15 } },
  { id: 'wisdom-guard', board: 'wisdom', name: '能量屏障', description: '+22% 最大生命', effect: { life: 22 }, requires: 'wisdom-power' },
  { id: 'wisdom-surge', board: 'wisdom', name: '法術迸發', description: '+20% 傷害與首領傷害', effect: { damage: 20, boss: 20 }, requires: 'wisdom-guard' },
];

export const TALENTS_BY_ID = Object.fromEntries(TALENTS.map((node) => [node.id, node])) as Record<string, TalentNode>;
