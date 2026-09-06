import type { SkillDefinition, SkillId } from '../core/types';

const provenance = (sourceUrl:string,implementationNotes:string) => ({
  sourceGame:'Path of Exile' as const,
  sourceUrl,
  sourceVersion:'PoEDB 2026-09-06',
  verifiedAt:'2026-09-06',
  sourceStatus:'verified' as const,
  implementationNotes,
});

export const SKILLS: Record<SkillId, SkillDefinition> = {
  ember: { id:'ember',name:'燃燒箭矢',description:'弓攻擊，物理傷害轉為火焰並可點燃',tags:['attack','projectile','fire','bow'],baseDamage:25.2,attacksPerSecond:.98,critChance:5,moveSpeed:100,color:'#65d99b',socketColor:'G',...provenance('https://poedb.tw/tw/Burning_Arrow','Lv.1 取粗製弓平均物傷 9 × 280%；攻速 1.4 × 70%。') },
  arc: { id:'arc',name:'電弧',description:'閃電法術，命中後連鎖至其他目標',tags:['spell','chain','lightning'],baseDamage:19,attacksPerSecond:1.6667,critChance:6,moveSpeed:100,color:'#7dd3fc',socketColor:'B',...provenance('https://poedb.tw/tw/Arc','Lv.1 平均傷害 (6+32)/2；施放時間 0.60 秒。') },
  quake: { id:'quake',name:'震地',description:'近戰範圍重擊，裂縫延遲產生餘震',tags:['attack','melee','area','physical','slam'],baseDamage:10.08,attacksPerSecond:1.0875,critChance:5,moveSpeed:100,color:'#f87171',socketColor:'R',...provenance('https://poedb.tw/tw/Earthquake','Lv.1 取朽木之棒平均物傷 7 × 144%；攻速 1.45 × 75%。') },
  venom: { id:'venom',name:'毒蛇鞭笞',description:'爪或匕首投射物攻擊，可連鎖並造成中毒',tags:['attack','projectile','chaos'],baseDamage:10,attacksPerSecond:1.8,critChance:8,moveSpeed:100,color:'#65d99b',socketColor:'G',...provenance('https://poedb.tw/tw/Cobra_Lash','Lv.1 取玻璃利片平均物傷 8 × 125%；攻速 1.5 × 120%。') },
  firebolt: { id:'firebolt',name:'火球',description:'發射火焰投射物，接觸怪物時爆炸',tags:['spell','fire','projectile','area'],baseDamage:11.5,attacksPerSecond:1.3333,critChance:5,moveSpeed:100,color:'#7dd3fc',socketColor:'B',...provenance('https://poedb.tw/tw/Fireball','Lv.1 平均傷害 (9+14)/2；施放時間 0.75 秒。') },
  smite: { id:'smite',name:'雷鳴重擊',description:'近戰打擊並以閃電命中附近目標',tags:['attack','melee','lightning','area','strike','aura'],baseDamage:15.75,attacksPerSecond:1.2325,critChance:5,moveSpeed:100,color:'#f87171',socketColor:'R',...provenance('https://poedb.tw/tw/Smite','Lv.1 取朽木之棒平均物傷 7 × 225%；攻速 1.45 × 85%。') },
};

export const POLICIES = {
  'full-clear': ['全圖掃蕩', '高掉落，耗時較長'],
  'boss-rush': ['首領突襲', '快速取得高階地圖'],
  currency: ['通貨獵人', '優先稀有與事件怪'],
} as const;
