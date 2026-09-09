import { rAthenaSource } from '../source';

export const PORING_SOURCE = rAthenaSource('db/re/mob_db.yml', 'Id: 1002');

export const PORING_RENEWAL = Object.freeze({
  id: 1002,
  aegisName: 'PORING',
  name: 'Poring',
  level: 1,
  hp: 55,
  baseExp: 150,
  jobExp: 40,
  attackMin: 1,
  attackMax: 1,
  defense: 2,
  magicDefense: 5,
  stats: { str: 6, agi: 1, vit: 1, int: 0, dex: 6, luk: 5 },
  attackRange: 1,
  skillRange: 10,
  chaseRange: 12,
  size: 'Medium',
  race: 'Plant',
  element: 'Water',
  elementLevel: 1,
  walkSpeedMs: 400,
  attackDelayMs: 1872,
  attackMotionMs: 672,
  clientAttackMotionMs: 288,
  damageMotionMs: 480,
  ai: '02',
  drops: [
    { item: 'Jellopy', ratePerTenThousand: 7000 },
    { item: 'Knife_', ratePerTenThousand: 100 },
    { item: 'Sticky_Mucus', ratePerTenThousand: 400 },
    { item: 'Apple', ratePerTenThousand: 1000 },
    { item: 'Wing_Of_Fly', ratePerTenThousand: 500 },
    { item: 'Apple', ratePerTenThousand: 150 },
    { item: 'Unripe_Apple', ratePerTenThousand: 20 },
    { item: 'Poring_Card', ratePerTenThousand: 20, stealProtected: true },
  ],
});

export function passesDropRate(ratePerTenThousand: number, roll: number) {
  if (!Number.isInteger(roll) || roll < 0 || roll >= 10000) {
    throw new RangeError('drop roll must be an integer from 0 to 9999');
  }
  return roll < ratePerTenThousand;
}
