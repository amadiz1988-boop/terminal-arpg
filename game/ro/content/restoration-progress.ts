export const RESTORATION_CATEGORIES = Object.freeze([
  {
    name: '世界地圖與怪物',
    completed: 5,
    total: 12,
    evidence: '真實 prt_fild08 地形、五種怪物、271 個原生成區域重生個體',
  },
  {
    name: '角色成長與職業',
    completed: 5,
    total: 14,
    evidence: '初心者人物／職業等級、能力點取得與重置',
  },
  {
    name: '戰鬥與技能',
    completed: 5,
    total: 15,
    evidence: '逐格移動、逐次攻防、命中、初心者基本技能',
  },
  {
    name: '道具裝備與經濟',
    completed: 6,
    total: 16,
    evidence: '真實掉落、拾取、逐件負重、超重限制、消耗品與裝備穿脫',
  },
  { name: 'NPC、城鎮與任務', completed: 0, total: 12, evidence: '尚未實裝' },
  {
    name: 'OpenKore 自動化',
    completed: 7,
    total: 12,
    evidence: '17 格視野索敵、巡走、蒼蠅翅膀、戰鬥、拾取與暫停續跑',
  },
  { name: '多人社交與伺服器', completed: 0, total: 10, evidence: '尚未實裝' },
  {
    name: 'RO 介面與繁中資料',
    completed: 6,
    total: 9,
    evidence: '基本資訊、終端、地圖、能力、背包與繁中顯示',
  },
]);

export const RESTORATION_TOTAL = RESTORATION_CATEGORIES.reduce(
  (sum, item) => sum + item.total,
  0,
);
export const RESTORATION_COMPLETED = RESTORATION_CATEGORIES.reduce(
  (sum, item) => sum + item.completed,
  0,
);
export const RESTORATION_PERCENT =
  Math.floor((RESTORATION_COMPLETED / RESTORATION_TOTAL) * 1000) / 10;
