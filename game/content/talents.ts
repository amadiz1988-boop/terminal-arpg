export type TalentBoardId = 'might' | 'hunt' | 'wisdom';
export type TalentEffect = {
  damage?: number;
  attackDamage?: number;
  spellDamage?: number;
  speed?: number;
  attackSpeed?: number;
  castSpeed?: number;
  move?: number;
  life?: number;
  armor?: number;
  mana?: number;
  skillCostReduction?: number;
  boss?: number;
  clear?: number;
};
type Provenance = {
  sourceGame: 'Torchlight: Infinite';
  sourceUrl: string;
  sourceVersion: string;
  verifiedAt: string;
  sourceStatus: 'verified';
  implementationNotes: string;
};
export type TalentNode = Provenance & { id: string; board: TalentBoardId; name: string; description: string; effect: TalentEffect; requires?: string };

const sourceUrl='https://tlidb.com/tw/Talent';
const provenance=(implementationNotes:string):Provenance=>({sourceGame:'Torchlight: Infinite',sourceUrl,sourceVersion:'TLIDB live snapshot 2026-09-06',verifiedAt:'2026-09-06',sourceStatus:'verified',implementationNotes});

export const TALENT_BOARDS: Record<TalentBoardId, Provenance & { name: string; tag: string }> = {
  might: { name:'巨力之神',tag:'力量 · 攻擊',...provenance('採用 TLIDB 巨力之神可查證的小型及中型天賦。') },
  hunt: { name:'狩獵之神',tag:'敏捷 · 速度',...provenance('採用 TLIDB 狩獵之神可查證的小型及中型天賦。') },
  wisdom: { name:'知識之神',tag:'智慧 · 法術',...provenance('採用 TLIDB 知識之神可查證的小型及中型天賦。') },
};

export const TALENTS: TalentNode[] = [
  { id:'might-damage',board:'might',name:'攻擊傷害',description:'攻擊傷害 +9%、移動速度 +2%',effect:{attackDamage:9,move:2},...provenance('巨力之神小型天賦，僅對攻擊標籤技能套用傷害。') },
  { id:'might-power',board:'might',name:'強化攻擊傷害',description:'攻擊傷害 +18%',effect:{attackDamage:18},requires:'might-damage',...provenance('巨力之神中型天賦，僅對攻擊標籤技能套用傷害。') },
  { id:'might-life',board:'might',name:'生命與護甲',description:'護甲值 +10%、最大生命 +4%',effect:{armor:10,life:4},requires:'might-power',...provenance('巨力之神中型天賦，完整套用兩項已支援屬性。') },
  { id:'hunt-damage',board:'hunt',name:'傷害',description:'傷害 +9%',effect:{damage:9},...provenance('狩獵之神小型天賦，套用至所有技能傷害。') },
  { id:'hunt-speed',board:'hunt',name:'攻擊與施法速度',description:'攻擊與施法速度 +3%',effect:{speed:3},requires:'hunt-damage',...provenance('狩獵之神小型天賦，套用至攻擊與施法速度。') },
  { id:'hunt-tempo',board:'hunt',name:'速度與技能消耗',description:'攻擊與施法速度 +6%、移動速度 +4%、技能消耗 -4',effect:{speed:6,move:4,skillCostReduction:4},requires:'hunt-speed',...provenance('狩獵之神中型天賦，三項效果皆進入戰鬥計算。') },
  { id:'wisdom-power',board:'wisdom',name:'法術傷害',description:'法術傷害 +9%',effect:{spellDamage:9},...provenance('知識之神小型天賦，僅對法術標籤技能套用傷害。') },
  { id:'wisdom-speed',board:'wisdom',name:'施法速度',description:'施法速度 +3%',effect:{castSpeed:3},requires:'wisdom-power',...provenance('知識之神小型天賦，僅對法術標籤技能套用速度。') },
  { id:'wisdom-mana',board:'wisdom',name:'最大魔力',description:'最大魔力 +8%',effect:{mana:8},requires:'wisdom-speed',...provenance('知識之神中型天賦，套用至 PoE 基礎最大魔力公式的乘數層。') },
];

export const TALENTS_BY_ID = Object.fromEntries(TALENTS.map((node) => [node.id, node])) as Record<string, TalentNode>;
