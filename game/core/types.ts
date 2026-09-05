export type SkillId = 'ember' | 'arc' | 'quake';
export type Policy = 'full-clear' | 'boss-rush' | 'currency';
export type RunMode = 'count' | 'time' | 'empty';
export type ContractId = 'scout' | 'greed' | 'apex';
export type MasteryId = 'power' | 'tempo' | 'guard';
export type FarmingRouteId = 'arsenal' | 'foundry' | 'hunter';
export type ItemSlot = 'weapon' | 'armor';
export type Rarity = 'COMMON' | 'MAGIC' | 'RARE' | 'LEGENDARY';
export type AffixStat = 'damage' | 'speed' | 'crit' | 'move' | 'life' | 'armor';

export type SkillDefinition = {
  id: SkillId;
  name: string;
  description: string;
  tags: string[];
  baseDamage: number;
  attacksPerSecond: number;
  critChance: number;
  moveSpeed: number;
  color: string;
};

export type Affix = {
  id: string;
  name: string;
  stat: AffixStat;
  value: number;
  tier: number;
  tags: string[];
};

export type Item = {
  id: string;
  baseId: string;
  name: string;
  slot: ItemSlot;
  rarity: Rarity;
  itemLevel: number;
  affixes: Affix[];
  locked?: boolean;
};

export type BuildSnapshot = {
  skill: SkillDefinition;
  weapon?: Item;
  armor?: Item;
  masteries?: Record<MasteryId, number>;
};

export type ResolvedStats = {
  dps: number;
  bossDps: number;
  clearScore: number;
  life: number;
  armor: number;
  moveSpeed: number;
  critChance: number;
};

export type ItemEvaluation = {
  itemId: string;
  dpsDelta: number;
  bossDelta: number;
  clearDelta: number;
  survivalDelta: number;
  moveDelta: number;
  potential: number;
  classification: 'upgrade' | 'sidegrade' | 'craft' | 'salvage';
};

export type SalvageMaterials = { scrap: number; essence: number; core: number };
