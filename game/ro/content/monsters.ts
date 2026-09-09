import { PORING_RENEWAL } from './poring';

export type MonsterDefinition = Readonly<{
  id: number;
  aegisName: string;
  nameZhTw: string;
  level: number;
  hp: number;
  baseExp: number;
  jobExp: number;
  attackMin: number;
  attackMax: number;
  defense: number;
  magicDefense: number;
  stats: {
    str: number;
    agi: number;
    vit: number;
    int: number;
    dex: number;
    luk: number;
  };
  attackRange: number;
  attackDelayMs: number;
  walkSpeedMs: number;
  raceZhTw: string;
  sizeZhTw: string;
  elementZhTw: string;
  mapColor: string;
  drops: ReadonlyArray<
    Readonly<{
      item: string;
      ratePerTenThousand: number;
      stealProtected?: boolean;
    }>
  >;
}>;

export const PRT_FILD08_MONSTERS: Readonly<Record<string, MonsterDefinition>> =
  Object.freeze({
    PORING: {
      ...PORING_RENEWAL,
      nameZhTw: '波利',
      raceZhTw: '植物',
      sizeZhTw: '中型',
      elementZhTw: '水 1',
      mapColor: '#ff98c1',
    },
    LUNATIC: {
      id: 1063,
      aegisName: 'LUNATIC',
      nameZhTw: '瘋兔',
      level: 3,
      hp: 48,
      baseExp: 150,
      jobExp: 50,
      attackMin: 1,
      attackMax: 1,
      defense: 18,
      magicDefense: 0,
      stats: { str: 10, agi: 3, vit: 3, int: 0, dex: 8, luk: 5 },
      attackRange: 1,
      attackDelayMs: 1456,
      walkSpeedMs: 200,
      raceZhTw: '動物',
      sizeZhTw: '小型',
      elementZhTw: '無 3',
      mapColor: '#efe7df',
      drops: [
        { item: 'Clover', ratePerTenThousand: 7000 },
        { item: 'Feather', ratePerTenThousand: 3000 },
        { item: 'Pierrot_Nose', ratePerTenThousand: 4 },
        { item: 'Sword_', ratePerTenThousand: 100 },
        { item: 'Wing_Of_Fly', ratePerTenThousand: 500 },
        { item: 'Carrot', ratePerTenThousand: 3000 },
        { item: 'Rainbow_Carrot', ratePerTenThousand: 20 },
        { item: 'Lunatic_Card', ratePerTenThousand: 20, stealProtected: true },
      ],
    },
    FABRE: {
      id: 1007,
      aegisName: 'FABRE',
      nameZhTw: '綠棉蟲',
      level: 6,
      hp: 59,
      baseExp: 158,
      jobExp: 65,
      attackMin: 1,
      attackMax: 3,
      defense: 24,
      magicDefense: 0,
      stats: { str: 12, agi: 5, vit: 5, int: 5, dex: 12, luk: 5 },
      attackRange: 1,
      attackDelayMs: 1672,
      walkSpeedMs: 400,
      raceZhTw: '昆蟲',
      sizeZhTw: '小型',
      elementZhTw: '地 1',
      mapColor: '#74d66d',
      drops: [
        { item: 'Fluff', ratePerTenThousand: 7000 },
        { item: 'Feather', ratePerTenThousand: 1000 },
        { item: 'Club_', ratePerTenThousand: 80 },
        { item: 'Wing_Of_Fly', ratePerTenThousand: 500 },
        { item: 'Green_Herb', ratePerTenThousand: 3000 },
        { item: 'Clover', ratePerTenThousand: 1000 },
        { item: 'Club', ratePerTenThousand: 200 },
        { item: 'Fabre_Card', ratePerTenThousand: 20, stealProtected: true },
      ],
    },
    PUPA: {
      id: 1008,
      aegisName: 'PUPA',
      nameZhTw: '蛹',
      level: 4,
      hp: 51,
      baseExp: 157,
      jobExp: 55,
      attackMin: 1,
      attackMax: 3,
      defense: 24,
      magicDefense: 2,
      stats: { str: 11, agi: 0, vit: 3, int: 3, dex: 8, luk: 6 },
      attackRange: 1,
      attackDelayMs: 1001,
      walkSpeedMs: 1000,
      raceZhTw: '昆蟲',
      sizeZhTw: '小型',
      elementZhTw: '地 1',
      mapColor: '#d7b46a',
      drops: [
        { item: 'Phracon', ratePerTenThousand: 600 },
        { item: 'Chrysalis', ratePerTenThousand: 7000 },
        { item: 'Sticky_Mucus', ratePerTenThousand: 700 },
        { item: 'Guard_', ratePerTenThousand: 20 },
        { item: 'Shell', ratePerTenThousand: 1000 },
        { item: 'Wing_Of_Fly', ratePerTenThousand: 500 },
        { item: 'Iron_Ore', ratePerTenThousand: 500 },
        { item: 'Pupa_Card', ratePerTenThousand: 1, stealProtected: true },
      ],
    },
    LITTLE_PORING: {
      id: 2398,
      aegisName: 'LITTLE_PORING',
      nameZhTw: '小波利',
      level: 1,
      hp: 40,
      baseExp: 18,
      jobExp: 10,
      attackMin: 1,
      attackMax: 1,
      defense: 2,
      magicDefense: 5,
      stats: { str: 6, agi: 0, vit: 0, int: 0, dex: 6, luk: 5 },
      attackRange: 1,
      attackDelayMs: 1872,
      walkSpeedMs: 400,
      raceZhTw: '植物',
      sizeZhTw: '小型',
      elementZhTw: '水 1',
      mapColor: '#ff6db1',
      drops: [
        { item: 'Jellopy', ratePerTenThousand: 9000 },
        { item: 'Knife_', ratePerTenThousand: 100 },
        { item: 'Sticky_Mucus', ratePerTenThousand: 1000 },
        { item: 'Apple', ratePerTenThousand: 5000 },
        { item: 'Red_Herb', ratePerTenThousand: 1000 },
        { item: 'Apple', ratePerTenThousand: 500 },
        { item: 'Red_Herb', ratePerTenThousand: 1000 },
        {
          item: 'Novice_Poring_Card',
          ratePerTenThousand: 100,
          stealProtected: true,
        },
      ],
    },
  });

export type PrtFild08MonsterKey = keyof typeof PRT_FILD08_MONSTERS;
