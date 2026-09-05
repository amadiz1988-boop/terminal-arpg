export type SkillId = 'ember' | 'arc' | 'quake' | 'venom' | 'firebolt' | 'smite';
export type Policy = 'full-clear' | 'boss-rush' | 'currency';
export type RunMode = 'count' | 'time' | 'empty';
export type ContractId = 'scout' | 'greed' | 'apex';
export type MasteryId = 'power' | 'tempo' | 'guard';
export type FarmingRouteId = 'arsenal' | 'foundry' | 'hunter';
export type SupportId = 'momentum' | 'echo' | 'focus' | 'fortify';
export type SocketColor = 'R' | 'G' | 'B' | 'W';
export type ClassId = 'thief' | 'mage' | 'acolyte';
export type SecondJobId = 'assassin' | 'rogue' | 'wizard' | 'sage' | 'priest' | 'monk';
export type ItemSlot = 'weapon' | 'armor' | 'helmet' | 'gloves' | 'boots' | 'amulet';
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
  socketColor: SocketColor;
};

export type SupportDefinition = {
  id: SupportId;
  name: string;
  description: string;
  damageMultiplier: number;
  bossMultiplier: number;
  clearMultiplier: number;
  speedMultiplier: number;
  lifeMultiplier: number;
  socketColor: SocketColor;
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
  links?: number;
  sockets?: SocketColor[];
  locked?: boolean;
};

export type BuildSnapshot = {
  skill: SkillDefinition;
  weapon?: Item;
  armor?: Item;
  helmet?: Item;
  gloves?: Item;
  boots?: Item;
  amulet?: Item;
  masteries?: Record<MasteryId, number>;
  supports?: SupportDefinition[];
  supportSlots?: number;
  talents?: string[];
  classId?: ClassId;
  secondJobId?: SecondJobId;
  ascendancyNodes?: string[];
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
export type OrbWallet = { alteration: number; chromatic: number; fusing: number; jeweller: number };
export type GemDrop = { type: 'skill'; id: SkillId } | { type: 'support'; id: SupportId };
