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
  cycloneTumult: { id:'cycloneTumult',name:'旋風斬．騷動',description:'引導旋轉並攻擊周圍敵人，每 0.4 秒疊加範圍與攻速',tags:['attack','area','melee','movement','channelling'],baseDamage:6.56,attacksPerSecond:2.7,critChance:5,moveSpeed:100,color:'#65d99b',socketColor:'G',targeting:{mode:'area'},mechanic:'cyclone',...provenance('https://poedb.tw/tw/Cyclone_of_Tumult','3.29 Lv.1：取玻璃利片平均物傷 8 × 82%；攻速 1.5 × 180%；消耗 4 魔力。引導每 0.4 秒獲得 1 層，最多 5 層。') },
  winterOrb: { id:'winterOrb',name:'冬季之球',description:'引導累積至 8 層，冰球自動向附近敵人發射落地爆炸投射物',tags:['cold','spell','channelling','area','duration','projectile','orb'],baseDamage:44,attacksPerSecond:1.5,critChance:6,moveSpeed:100,color:'#7dd3fc',socketColor:'B',targeting:{mode:'area'},mechanic:'winter-orb',...provenance('https://www.poewiki.net/wiki/Winter_Orb','Lv.1 平均冰冷傷害 (39+49)/2；基礎每 1.2 秒發射，持續引導有 80% 更多投射頻率，最多 8 層；消耗 2 魔力。') },
  penanceBrand: { id:'penanceBrand',name:'贖罪烙印',description:'烙印附著敵人，每 0.1 秒增加能量，20 層時產生大範圍爆炸',tags:['spell','area','physical','lightning','duration','brand'],baseDamage:243,attacksPerSecond:.5,critChance:6,moveSpeed:100,color:'#f87171',socketColor:'B',targeting:{mode:'area'},mechanic:'penance-brand',...provenance('https://www.poewiki.net/wiki/Penance_Brand','Lv.1 平均物理傷害 (194+292)/2，50% 物理轉閃電；每 0.1 秒啟動，20 能量時爆炸，等效每 2 秒一次爆炸；消耗 15 魔力。') },
  ember: { id:'ember',name:'燃燒箭矢',description:'弓攻擊，物理傷害轉為火焰並可點燃',tags:['attack','projectile','fire','bow'],baseDamage:25.2,attacksPerSecond:.98,critChance:5,moveSpeed:100,color:'#65d99b',socketColor:'G',targeting:{mode:'single'},...provenance('https://poedb.tw/tw/Burning_Arrow','Lv.1 取粗製弓平均物傷 9 × 280%；攻速 1.4 × 70%。') },
  arc: { id:'arc',name:'電弧',description:'閃電法術，命中後連鎖至其他目標',tags:['spell','chain','lightning'],baseDamage:19,attacksPerSecond:1.6667,critChance:6,moveSpeed:100,color:'#7dd3fc',socketColor:'B',targeting:{mode:'chain',additionalTargets:8},...provenance('https://poedb.tw/tw/Arc','Lv.1 平均傷害 (6+32)/2；施放時間 0.60 秒。4 次主連鎖，每次另生一條不再連鎖的二段電弧，同一怪群最多額外命中 8 個不同目標。') },
  quake: { id:'quake',name:'震地',description:'近戰範圍重擊，裂縫延遲產生餘震',tags:['attack','melee','area','physical','slam'],baseDamage:10.08,attacksPerSecond:1.0875,critChance:5,moveSpeed:100,color:'#f87171',socketColor:'R',targeting:{mode:'area'},...provenance('https://poedb.tw/tw/Earthquake','Lv.1 取朽木之棒平均物傷 7 × 144%；攻速 1.45 × 75%。技能對附近區域造成傷害，本作以同一怪群代表該區域。') },
  venom: { id:'venom',name:'毒蛇鞭笞',description:'爪或匕首投射物攻擊，可連鎖並造成中毒',tags:['attack','projectile','chaos','chain'],baseDamage:10,attacksPerSecond:1.8,critChance:8,moveSpeed:100,color:'#65d99b',socketColor:'G',targeting:{mode:'chain',additionalTargets:3},...provenance('https://poedb.tw/tw/Cobra_Lash','Lv.1 取玻璃利片平均物傷 8 × 125%；攻速 1.5 × 120%；Lv.1 連鎖 +3 次。') },
  firebolt: { id:'firebolt',name:'火球',description:'發射火焰投射物，接觸怪物時爆炸',tags:['spell','fire','projectile','area'],baseDamage:11.5,attacksPerSecond:1.3333,critChance:5,moveSpeed:100,color:'#7dd3fc',socketColor:'B',targeting:{mode:'area'},...provenance('https://poedb.tw/tw/Fireball','Lv.1 平均傷害 (9+14)/2；施放時間 0.75 秒；接觸怪物後爆炸並傷害周圍敵人，本作以同一怪群代表爆炸區域。') },
  smite: { id:'smite',name:'雷鳴重擊',description:'近戰打擊並以閃電命中附近目標',tags:['attack','melee','lightning','area','strike','aura'],baseDamage:15.75,attacksPerSecond:1.2325,critChance:5,moveSpeed:100,color:'#f87171',socketColor:'R',targeting:{mode:'area'},...provenance('https://poedb.tw/tw/Smite','Lv.1 取朽木之棒平均物傷 7 × 225%；攻速 1.45 × 85%；打擊與附近閃電均造成範圍傷害，本作以同一怪群代表範圍。') },
};

export const POLICIES = {
  'full-clear': ['全圖掃蕩', '高掉落，耗時較長'],
  'boss-rush': ['首領突襲', '快速取得高階地圖'],
  currency: ['通貨獵人', '優先稀有與事件怪'],
} as const;
