// Canonical product availability projection for Player AUTO_FARM map selection.
export const FARM_ROUTE_CLASS = Object.freeze({
  STANDARD: 'STANDARD',
  SPECIAL_TRANSPORT: 'SPECIAL_TRANSPORT',
  NONE: 'NONE',
  UNKNOWN: 'UNKNOWN',
});

export const FARM_AVAILABILITY_REASON = Object.freeze({
  STANDARD_ROUTE_READY: 'STANDARD_ROUTE_READY',
  SPECIAL_TRANSPORT_PENDING: 'SPECIAL_TRANSPORT_PENDING',
  NON_FARMABLE_WORLD_CLASS: 'NON_FARMABLE_WORLD_CLASS',
  ROUTE_OR_AUTHORITY_UNPROVEN: 'ROUTE_OR_AUTHORITY_UNPROVEN',
});

export const SPECIAL_TRANSPORT_HOLD_MAPS = Object.freeze([
  'gef_dun03', 'xmas_dun01', 'xmas_dun02', 'xmas_fild01',
  'yggdrasil01', 'jawaii_in', 'kh_kiehl01', 'moc_fild20',
  'moc_fild21', 'moc_fild22', 'harboro2', 'rockrdg1', 'rockrdg2',
  'ba_2whs01', 'ba_2whs02', 'ba_bath', 'ba_lib', 'ba_lost',
  'ba_pw01', 'ba_pw02', 'ba_pw03', 'sp_rudus', 'sp_rudus2', 'sp_rudus3',
]);

const VALID_ROUTE_CLASSES = new Set(Object.values(FARM_ROUTE_CLASS));
const VALID_REASONS = new Set(Object.values(FARM_AVAILABILITY_REASON));

export function indexFarmMapAvailability(registry) {
  const rows = Array.isArray(registry?.maps) ? registry.maps : [];
  const byMap = new Map();
  for (const row of rows) {
    const map = String(row?.map ?? '').trim();
    if (!map) throw new Error('FARM_AVAILABILITY_MAP_ID_MISSING');
    if (byMap.has(map)) throw new Error(`FARM_AVAILABILITY_DUPLICATE_MAP:${map}`);
    if (!VALID_ROUTE_CLASSES.has(row.routeClass)) throw new Error(`FARM_AVAILABILITY_ROUTE_CLASS_INVALID:${map}`);
    if (!VALID_REASONS.has(row.availabilityReason)) throw new Error(`FARM_AVAILABILITY_REASON_INVALID:${map}`);
    if (row.farmSelectionAvailable && row.availabilityReason !== FARM_AVAILABILITY_REASON.STANDARD_ROUTE_READY) throw new Error(`FARM_AVAILABILITY_SELECTION_REASON_MISMATCH:${map}`);
    if (row.availabilityReason === FARM_AVAILABILITY_REASON.SPECIAL_TRANSPORT_PENDING && row.farmSelectionAvailable) throw new Error(`FARM_AVAILABILITY_SPECIAL_MAP_SELECTABLE:${map}`);
    byMap.set(map, Object.freeze({ ...row, map }));
  }
  return byMap;
}

export function evaluateFarmMapSelection({ mapSummary, availability }) {
  if (!mapSummary) return { farmable: false, farmSelectionAvailable: false, reason: 'farm_target_unresolved' };
  const hasMonster = Number(mapSummary.normalMonsterCount ?? 0) > 0
    || Number(mapSummary.combatMonsterCount ?? 0) > 0
    || Number(mapSummary.bossCount ?? 0) > 0
    || (mapSummary.primaryMonsters?.length ?? 0) > 0;
  if (!hasMonster) return { farmable: false, farmSelectionAvailable: false, reason: 'farm_map_not_farmable' };
  if (!availability) return { farmable: true, farmSelectionAvailable: false, reason: 'farm_map_not_released' };
  return {
    farmable: Boolean(availability.farmable),
    farmSelectionAvailable: Boolean(availability.farmSelectionAvailable),
    reason: availability.farmSelectionAvailable ? null
      : availability.availabilityReason === FARM_AVAILABILITY_REASON.NON_FARMABLE_WORLD_CLASS
        ? 'farm_map_not_farmable' : 'farm_map_not_released',
    availability,
  };
}

export function assertSpecialTransportHoldSet(registry) {
  const byMap = indexFarmMapAvailability(registry);
  const actual = SPECIAL_TRANSPORT_HOLD_MAPS.filter((map) => byMap.get(map)?.availabilityReason === FARM_AVAILABILITY_REASON.SPECIAL_TRANSPORT_PENDING);
  if (actual.length !== SPECIAL_TRANSPORT_HOLD_MAPS.length) throw new Error(`FARM_AVAILABILITY_SPECIAL_HOLD_SET_MISMATCH:${actual.length}/${SPECIAL_TRANSPORT_HOLD_MAPS.length}`);
  return true;
}
