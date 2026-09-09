import { AUTOMATION_RULESET, rAthenaSource, type SourceTrace } from '../source';

export const PRT_FILD08_FIELD_SOURCE: SourceTrace = Object.freeze({
  repository: AUTOMATION_RULESET.repository,
  commit: AUTOMATION_RULESET.commit,
  path: 'fields/prt_fild08.fld2.gz',
});

export const PRT_FILD08_SPAWN_SOURCE = rAthenaSource(
  'npc/re/mobs/fields/prontera.txt',
  'prt_fild08 Poring spawns',
);

export type MonsterSpawn = Readonly<{
  monster: 'PORING' | 'LUNATIC' | 'FABRE' | 'PUPA' | 'LITTLE_PORING';
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  count: number;
  respawnMs: number;
}>;

export const PRT_FILD08 = Object.freeze({
  id: 'prt_fild08',
  fieldUrl: '/ro/maps/prt_fild08.fld2.bin',
  width: 400,
  height: 400,
  noviceEntry: { x: 170, y: 375 },
  monsterSpawns: [
    {
      monster: 'PORING',
      centerX: 0,
      centerY: 0,
      width: 0,
      height: 0,
      count: 20,
      respawnMs: 5000,
    },
    {
      monster: 'PORING',
      centerX: 305,
      centerY: 233,
      width: 10,
      height: 10,
      count: 2,
      respawnMs: 15000,
    },
    {
      monster: 'PORING',
      centerX: 271,
      centerY: 249,
      width: 20,
      height: 20,
      count: 5,
      respawnMs: 15000,
    },
    {
      monster: 'PORING',
      centerX: 94,
      centerY: 335,
      width: 50,
      height: 50,
      count: 20,
      respawnMs: 10000,
    },
    {
      monster: 'PORING',
      centerX: 166,
      centerY: 334,
      width: 50,
      height: 50,
      count: 20,
      respawnMs: 10000,
    },
    {
      monster: 'PORING',
      centerX: 253,
      centerY: 337,
      width: 50,
      height: 50,
      count: 20,
      respawnMs: 10000,
    },
    {
      monster: 'LUNATIC',
      centerX: 0,
      centerY: 0,
      width: 0,
      height: 0,
      count: 20,
      respawnMs: 5000,
    },
    {
      monster: 'LUNATIC',
      centerX: 305,
      centerY: 233,
      width: 10,
      height: 10,
      count: 2,
      respawnMs: 15000,
    },
    {
      monster: 'LUNATIC',
      centerX: 271,
      centerY: 249,
      width: 20,
      height: 20,
      count: 5,
      respawnMs: 15000,
    },
    ...[
      [228, 230],
      [246, 263],
      [190, 237],
      [100, 256],
    ].map(([centerX, centerY]) => ({
      monster: 'LUNATIC' as const,
      centerX,
      centerY,
      width: 20,
      height: 20,
      count: 10,
      respawnMs: 10000,
    })),
    {
      monster: 'FABRE',
      centerX: 0,
      centerY: 0,
      width: 0,
      height: 0,
      count: 10,
      respawnMs: 5000,
    },
    {
      monster: 'FABRE',
      centerX: 305,
      centerY: 233,
      width: 10,
      height: 10,
      count: 2,
      respawnMs: 15000,
    },
    {
      monster: 'FABRE',
      centerX: 271,
      centerY: 249,
      width: 20,
      height: 20,
      count: 5,
      respawnMs: 15000,
    },
    ...[
      [70, 164],
      [144, 147],
      [263, 79],
    ].map(([centerX, centerY]) => ({
      monster: 'FABRE' as const,
      centerX,
      centerY,
      width: 50,
      height: 50,
      count: 20,
      respawnMs: 10000,
    })),
    {
      monster: 'PUPA',
      centerX: 336,
      centerY: 113,
      width: 40,
      height: 40,
      count: 20,
      respawnMs: 10000,
    },
    {
      monster: 'LITTLE_PORING',
      centerX: 330,
      centerY: 269,
      width: 40,
      height: 40,
      count: 20,
      respawnMs: 10000,
    },
  ] satisfies readonly MonsterSpawn[],
});

export const PRT_FILD08_MONSTER_COUNTS = Object.freeze(
  Object.fromEntries(
    ['PORING', 'LUNATIC', 'FABRE', 'PUPA', 'LITTLE_PORING'].map((monster) => [
      monster,
      PRT_FILD08.monsterSpawns
        .filter((spawn) => spawn.monster === monster)
        .reduce((sum, spawn) => sum + spawn.count, 0),
    ]),
  ) as Record<
    'PORING' | 'LUNATIC' | 'FABRE' | 'PUPA' | 'LITTLE_PORING',
    number
  >,
);
export const PRT_FILD08_PORING_COUNT = PRT_FILD08_MONSTER_COUNTS.PORING;
export const PRT_FILD08_MONSTER_COUNT = Object.values(
  PRT_FILD08_MONSTER_COUNTS,
).reduce((sum, count) => sum + count, 0);
