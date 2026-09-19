const MAP_PATTERN = /^[a-z0-9_]{1,31}$/;
const POSITION_LIMIT = 32767;

export function parseAdminFixtureNavigationInput(input) {
  const targetMap = String(input?.targetMap ?? '').trim();
  const targetX = Number(input?.targetX);
  const targetY = Number(input?.targetY);
  if (
    !MAP_PATTERN.test(targetMap) ||
    !Number.isSafeInteger(targetX) ||
    targetX < 0 ||
    targetX > POSITION_LIMIT ||
    !Number.isSafeInteger(targetY) ||
    targetY < 0 ||
    targetY > POSITION_LIMIT
  )
    return { ok: false, reason: 'invalid_transition' };
  return { ok: true, targetMap, targetX, targetY };
}

export function buildAdminFixtureNavigationRoute({
  currentMap,
  targetMap,
  targetX,
  targetY,
  resolvedRoute,
}) {
  const from = String(currentMap ?? '');
  if (!MAP_PATTERN.test(from) || !MAP_PATTERN.test(targetMap)) return null;
  if (from === targetMap)
    return [{ map: targetMap, x: targetX, y: targetY }];
  if (!Array.isArray(resolvedRoute) || resolvedRoute.length < 1 || resolvedRoute.length > 16)
    return null;
  const route = resolvedRoute.map((step) => ({ ...step }));
  const last = route[route.length - 1];
  if (!last || last.map !== targetMap) return null;
  route[route.length - 1] = {
    ...last,
    x: targetX,
    y: targetY,
  };
  return route;
}

export function navigationCommandIsPending(status) {
  return ['QUEUED', 'ACCEPTED', 'CONFIRMED'].includes(String(status ?? ''));
}
