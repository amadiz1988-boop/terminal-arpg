// Explicit sort ranks for the Server Ops admin tables.
//
// The Health column renders one of the existing character health keys
// (HEALTHY / DEGRADED / OFFLINE / DOWN, produced by `charHealthKey`). The sort
// must rank that SAME key explicitly — never the CSS class name, the rendered
// text, boolean truthiness or the current DOM order. Keeping the rank here as a
// pure module lets the browser and the test harness share one implementation.
//
// Ordering (rank ASC = best first):
//   HEALTHY(0) < DEGRADED(1) < DOWN(2) < OFFLINE(3) < UNKNOWN(4)
// HEALTHY therefore always forms one contiguous block; a missing/unknown key
// falls back to UNKNOWN instead of silently sorting as healthy.
export const CHARACTER_HEALTH_RANK = Object.freeze({
  HEALTHY: 0,
  DEGRADED: 1,
  DOWN: 2,
  OFFLINE: 3,
  UNKNOWN: 4,
});

export function characterHealthRank(healthKey) {
  const key = String(healthKey ?? '').toUpperCase();
  return Object.prototype.hasOwnProperty.call(CHARACTER_HEALTH_RANK, key)
    ? CHARACTER_HEALTH_RANK[key]
    : CHARACTER_HEALTH_RANK.UNKNOWN;
}

// Stable secondary sort for equal health ranks: char_id ascending, then name.
// This is what keeps same-health rows deterministic across re-renders.
export function compareCharacterHealth(left, right, direction = 1) {
  const rankDelta =
    (characterHealthRank(left?.health) - characterHealthRank(right?.health)) *
    (direction < 0 ? -1 : 1);
  if (rankDelta !== 0) return rankDelta;
  const leftId = Number(left?.charId);
  const rightId = Number(right?.charId);
  if (Number.isFinite(leftId) && Number.isFinite(rightId) && leftId !== rightId)
    return leftId - rightId;
  return String(left?.name ?? '').localeCompare(String(right?.name ?? ''), 'zh-Hant');
}
