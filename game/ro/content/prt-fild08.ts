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

export const PRT_FILD08 = Object.freeze({
  id: 'prt_fild08',
  fieldUrl: '/ro/maps/prt_fild08.fld2.gz',
  width: 400,
  height: 400,
  noviceEntry: { x: 170, y: 375 },
  poringSpawns: [
    { centerX: 0, centerY: 0, width: 0, height: 0, count: 20, respawnMs: 5000 },
    { centerX: 305, centerY: 233, width: 10, height: 10, count: 2, respawnMs: 15000 },
    { centerX: 271, centerY: 249, width: 20, height: 20, count: 5, respawnMs: 15000 },
    { centerX: 94, centerY: 335, width: 50, height: 50, count: 20, respawnMs: 10000 },
    { centerX: 166, centerY: 334, width: 50, height: 50, count: 20, respawnMs: 10000 },
    { centerX: 253, centerY: 337, width: 50, height: 50, count: 20, respawnMs: 10000 },
  ],
});

export const PRT_FILD08_PORING_COUNT = PRT_FILD08.poringSpawns.reduce(
  (total, spawn) => total + spawn.count,
  0,
);
