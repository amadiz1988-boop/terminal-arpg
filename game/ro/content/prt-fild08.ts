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

export const PRT_FILD08_WARP_SOURCE = rAthenaSource(
  'npc/re/warps/fields/prontera_fild.txt',
  'prt_fild08 warp portals',
);

export type MonsterSpawn = Readonly<{
  monster: 'PORING' | 'LUNATIC' | 'FABRE' | 'PUPA' | 'LITTLE_PORING';
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  count: number;
  respawnMs: number;
  respawnVarianceMs: number;
}>;

export type WarpPortal = Readonly<{
  centerX: number;
  centerY: number;
  spanX: number;
  spanY: number;
  destination: string;
}>;

export const PRT_FILD08 = Object.freeze({
  id: 'prt_fild08',
  fieldUrl: '/ro/maps/prt_fild08.fld2.gz',
  width: 400,
  height: 400,
  noviceEntry: { x: 170, y: 375 },
  warpPortals: [
    {
      centerX: 16,
      centerY: 187,
      spanX: 3,
      spanY: 17,
      destination: 'prt_fild07',
    },
    {
      centerX: 16,
      centerY: 239,
      spanX: 3,
      spanY: 15,
      destination: 'prt_fild07',
    },
    { centerX: 170, centerY: 378, spanX: 3, spanY: 2, destination: 'prontera' },
    {
      centerX: 233,
      centerY: 16,
      spanX: 12,
      spanY: 1,
      destination: 'moc_fild01',
    },
    { centerX: 55, centerY: 21, spanX: 4, spanY: 2, destination: 'moc_fild01' },
  ] satisfies readonly WarpPortal[],
  monsterSpawns: [
    {
      monster: 'PORING',
      centerX: 0,
      centerY: 0,
      width: 0,
      height: 0,
      count: 20,
      respawnMs: 5000,
      respawnVarianceMs: 0,
    },
    {
      monster: 'PORING',
      centerX: 305,
      centerY: 233,
      width: 10,
      height: 10,
      count: 2,
      respawnMs: 15000,
      respawnVarianceMs: 0,
    },
    {
      monster: 'PORING',
      centerX: 271,
      centerY: 249,
      width: 20,
      height: 20,
      count: 5,
      respawnMs: 15000,
      respawnVarianceMs: 0,
    },
    {
      monster: 'PORING',
      centerX: 94,
      centerY: 335,
      width: 50,
      height: 50,
      count: 20,
      respawnMs: 10000,
      respawnVarianceMs: 0,
    },
    {
      monster: 'PORING',
      centerX: 166,
      centerY: 334,
      width: 50,
      height: 50,
      count: 20,
      respawnMs: 10000,
      respawnVarianceMs: 0,
    },
    {
      monster: 'PORING',
      centerX: 253,
      centerY: 337,
      width: 50,
      height: 50,
      count: 20,
      respawnMs: 10000,
      respawnVarianceMs: 0,
    },
    {
      monster: 'LUNATIC',
      centerX: 0,
      centerY: 0,
      width: 0,
      height: 0,
      count: 20,
      respawnMs: 5000,
      respawnVarianceMs: 0,
    },
    {
      monster: 'LUNATIC',
      centerX: 305,
      centerY: 233,
      width: 10,
      height: 10,
      count: 2,
      respawnMs: 15000,
      respawnVarianceMs: 0,
    },
    {
      monster: 'LUNATIC',
      centerX: 271,
      centerY: 249,
      width: 20,
      height: 20,
      count: 5,
      respawnMs: 15000,
      respawnVarianceMs: 0,
    },
    ...[
      [228, 230, 30, 30],
      [246, 263, 50, 50],
      [190, 237, 50, 50],
      [100, 256, 50, 50],
    ].map(([centerX, centerY, width, height]) => ({
      monster: 'LUNATIC' as const,
      centerX,
      centerY,
      width,
      height,
      count: 10,
      respawnMs: 10000,
      respawnVarianceMs: 0,
    })),
    {
      monster: 'FABRE',
      centerX: 0,
      centerY: 0,
      width: 0,
      height: 0,
      count: 10,
      respawnMs: 5000,
      respawnVarianceMs: 0,
    },
    {
      monster: 'FABRE',
      centerX: 305,
      centerY: 233,
      width: 10,
      height: 10,
      count: 2,
      respawnMs: 15000,
      respawnVarianceMs: 0,
    },
    {
      monster: 'FABRE',
      centerX: 271,
      centerY: 249,
      width: 20,
      height: 20,
      count: 5,
      respawnMs: 15000,
      respawnVarianceMs: 0,
    },
    ...[
      [70, 164, 70, 70],
      [144, 147, 70, 70],
      [263, 79, 90, 90],
    ].map(([centerX, centerY, width, height]) => ({
      monster: 'FABRE' as const,
      centerX,
      centerY,
      width,
      height,
      count: 20,
      respawnMs: 10000,
      respawnVarianceMs: 0,
    })),
    {
      monster: 'PUPA',
      centerX: 336,
      centerY: 113,
      width: 40,
      height: 40,
      count: 20,
      respawnMs: 10000,
      respawnVarianceMs: 0,
    },
    {
      monster: 'LITTLE_PORING',
      centerX: 330,
      centerY: 269,
      width: 40,
      height: 40,
      count: 20,
      respawnMs: 10000,
      respawnVarianceMs: 0,
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
