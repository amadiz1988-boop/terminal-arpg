const LEGAL_SPAWN_POINTS = Object.freeze({
  iz_int: Object.freeze({ x: 18, y: 26 }),
  iz_int01: Object.freeze({ x: 18, y: 26 }),
  iz_int02: Object.freeze({ x: 18, y: 26 }),
  iz_int03: Object.freeze({ x: 18, y: 26 }),
  iz_int04: Object.freeze({ x: 18, y: 26 }),
});

const HIDDEN_WARP_ENTRY = Object.freeze({ x: 18, y: 30 });
const CANONICAL_CLIENT_NAVIGATION = Object.freeze({
  map: 'iz_int',
  x: 52,
  y: 30,
});

function baseOutcome(input, status) {
  return {
    status,
    spawnMap: String(input.spawnMap ?? ''),
    sequenceId: String(input.sequenceId ?? ''),
    s00StepIndex: Number(input.s00StepIndex),
    usedStageMapping: false,
    routeOriginValidated: false,
    sequenceCount: 0,
    s00DispatchCount: 0,
    normalizationCompleteBeforeDispatch: false,
  };
}

export function resolveSpawnEntry(input = {}) {
  const outcome = baseOutcome(input, 'FAIL_CLOSED');
  const spawnMap = String(input.spawnMap ?? '');
  const point = LEGAL_SPAWN_POINTS[spawnMap];
  const s00Map = String(input.s00Map ?? '');
  const spawnX = input.spawnX === undefined ? null : Number(input.spawnX);
  const spawnY = input.spawnY === undefined ? null : Number(input.spawnY);
  const atSpawnPoint = point &&
    (spawnX === null || spawnX === point.x) &&
    (spawnY === null || spawnY === point.y);
  const atHiddenWarpEntry = spawnMap !== 'iz_int' &&
    (spawnX === null || spawnX === HIDDEN_WARP_ENTRY.x) &&
    (spawnY === null || spawnY === HIDDEN_WARP_ENTRY.y);
  const pointMatches = atSpawnPoint || atHiddenWarpEntry;
  const routeOriginValidated =
    input.sequenceId === 'novice_onboarding' &&
    Number(input.s00StepIndex) === 0 &&
    s00Map === 'iz_int';
  if (!pointMatches || !routeOriginValidated) return outcome;

  const common = {
    ...outcome,
    status: 'PASS',
    routeOriginValidated: true,
    authoritativeMap: 'iz_int',
  };
  if (spawnMap === 'iz_int')
    return {
      ...common,
      mode: 'DIRECT_S00',
      sequenceCount: 1,
      s00DispatchCount: 1,
      normalizationCompleteBeforeDispatch: true,
    };
  return {
    ...common,
    firstLeg: {
      route: [{ map: spawnMap, ...HIDDEN_WARP_ENTRY }],
      expectedArrival: { map: spawnMap, ...HIDDEN_WARP_ENTRY },
    },
    secondLeg: {
      route: [{ ...CANONICAL_CLIENT_NAVIGATION }],
      expectedDestinationMap: CANONICAL_CLIENT_NAVIGATION.map,
    },
    mode: 'PRE_S00_NORMALIZATION',
    normalizationMap: 'iz_int',
    normalizationTarget: { map: 'iz_int' },
    normalizationRoute: [{ map: spawnMap, ...HIDDEN_WARP_ENTRY }],
    sequenceCount: 0,
    s00DispatchCount: 0,
    normalizationCompleteBeforeDispatch: false,
  };
}

function samePoint(actual, expected) {
  return actual?.map === expected?.map &&
    Number(actual?.x) === Number(expected?.x) &&
    Number(actual?.y) === Number(expected?.y);
}

export function decideNormalizationAction(input = {}) {
  const authoritativeMap = String(input.authoritativeMap ?? input.spawnMap ?? '');
  const sequenceId = String(input.sequenceId ?? '');
  const s00Map = String(input.s00Map ?? '');
  const checkpoint = input.checkpoint ?? null;
  if (checkpoint) return { action: 'NOOP', reason: 'CHECKPOINT_EXISTS' };
  if (input.s00Dispatched)
    return { action: 'NOOP', reason: 'S00_ALREADY_DISPATCHED' };
  if (authoritativeMap === 'iz_int')
    return { action: 'S00', dispatchCount: 1 };

  const entry = resolveSpawnEntry({
    spawnMap: authoritativeMap,
    spawnX: input.spawnX,
    spawnY: input.spawnY,
    sequenceId,
    s00StepIndex: input.s00StepIndex,
    s00Map,
  });
  if (entry.status !== 'PASS')
    return { action: 'FAIL_CLOSED', reason: 'INVALID_SPAWN_OR_ROUTE' };

  const current = {
    map: authoritativeMap,
    x: Number(input.spawnX),
    y: Number(input.spawnY),
  };
  if (samePoint(current, entry.firstLeg.expectedArrival)) {
    return { action: 'WAIT_FOR_MAP', reason: 'HIDDEN_WARP_ENTRY_REACHED' };
  }

  const spawnPoint = LEGAL_SPAWN_POINTS[authoritativeMap];
  if (samePoint(current, { map: authoritativeMap, ...spawnPoint })) {
    if (input.firstLegDispatched)
      return { action: 'WAIT_FOR_ENTRY', reason: 'FIRST_LEG_IN_FLIGHT' };
    return {
      action: 'FIRST_LEG',
      dispatchCount: 1,
      route: entry.firstLeg.route,
    };
  }

  return { action: 'FAIL_CLOSED', reason: 'UNSUPPORTED_NORMALIZATION_POSITION' };
}

export { CANONICAL_CLIENT_NAVIGATION, HIDDEN_WARP_ENTRY, LEGAL_SPAWN_POINTS };
