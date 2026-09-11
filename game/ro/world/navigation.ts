import { createRandom } from '../core/random';
import { PRT_FILD08, type MonsterSpawn } from '../content/prt-fild08';
import { fieldOffset, isWalkable, type RoField } from './fld2';

export type GridPosition = Readonly<{ x: number; y: number }>;
export type MonsterPlacement = GridPosition &
  Readonly<{
    monster: MonsterSpawn['monster'];
    spawnIndex: number;
    respawnMs: number;
    respawnVarianceMs: number;
  }>;

const DIRECTIONS = Object.freeze([
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
]);

export function floodWalkable(field: RoField, origin: GridPosition) {
  const distance = new Int32Array(field.width * field.height);
  distance.fill(-1);
  const originOffset = fieldOffset(field, origin.x, origin.y);
  if (originOffset < 0 || !isWalkable(field, origin.x, origin.y))
    return distance;

  const queue = new Int32Array(field.width * field.height);
  let read = 0;
  let write = 1;
  queue[0] = originOffset;
  distance[originOffset] = 0;

  while (read < write) {
    const offset = queue[read++];
    const x = offset % field.width;
    const y = Math.trunc(offset / field.width);
    for (const direction of DIRECTIONS) {
      const nextX = x + direction.x;
      const nextY = y + direction.y;
      const nextOffset = fieldOffset(field, nextX, nextY);
      if (
        nextOffset < 0 ||
        distance[nextOffset] >= 0 ||
        !isWalkable(field, nextX, nextY)
      )
        continue;
      distance[nextOffset] = distance[offset] + 1;
      queue[write++] = nextOffset;
    }
  }

  return distance;
}

export function shortestPath(
  field: RoField,
  origin: GridPosition,
  destination: GridPosition,
) {
  const originOffset = fieldOffset(field, origin.x, origin.y);
  const destinationOffset = fieldOffset(field, destination.x, destination.y);
  if (
    originOffset < 0 ||
    destinationOffset < 0 ||
    !isWalkable(field, origin.x, origin.y) ||
    !isWalkable(field, destination.x, destination.y)
  )
    return [];
  if (originOffset === destinationOffset) return [];

  const previous = new Int32Array(field.width * field.height);
  previous.fill(-2);
  previous[originOffset] = -1;
  const queue = new Int32Array(field.width * field.height);
  let read = 0;
  let write = 1;
  queue[0] = originOffset;

  while (read < write && previous[destinationOffset] === -2) {
    const offset = queue[read++];
    const x = offset % field.width;
    const y = Math.trunc(offset / field.width);
    for (const direction of DIRECTIONS) {
      const nextOffset = fieldOffset(field, x + direction.x, y + direction.y);
      if (
        nextOffset < 0 ||
        previous[nextOffset] !== -2 ||
        !isWalkable(field, x + direction.x, y + direction.y)
      )
        continue;
      previous[nextOffset] = offset;
      queue[write++] = nextOffset;
      if (nextOffset === destinationOffset) break;
    }
  }
  if (previous[destinationOffset] === -2) return [];

  const reversed: GridPosition[] = [];
  for (
    let offset = destinationOffset;
    offset !== originOffset;
    offset = previous[offset]
  ) {
    reversed.push({
      x: offset % field.width,
      y: Math.trunc(offset / field.width),
    });
  }
  return reversed.reverse();
}

function spawnBounds(field: RoField, spawn: MonsterSpawn) {
  if (spawn.width === 0 || spawn.height === 0) {
    return {
      minX: 15,
      maxX: field.width - 16,
      minY: 15,
      maxY: field.height - 16,
    };
  }
  const radiusX = spawn.width - 1;
  const radiusY = spawn.height - 1;
  return {
    minX: Math.max(5, spawn.centerX - radiusX),
    maxX: Math.min(field.width - 5, spawn.centerX + radiusX),
    minY: Math.max(5, spawn.centerY - radiusY),
    maxY: Math.min(field.height - 5, spawn.centerY + radiusY),
  };
}

export function sourceSpawnPosition(
  field: RoField,
  spawn: MonsterSpawn,
  random: () => number,
): GridPosition {
  const bounds = spawnBounds(field, spawn);
  const center = { x: spawn.centerX, y: spawn.centerY };
  const mapWide = spawn.width === 0 || spawn.height === 0;
  const centerReachable = !mapWide && isWalkable(field, center.x, center.y);
  const keepCenter =
    centerReachable && random() < 1 / (spawn.width * spawn.height);
  if (keepCenter) return center;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const position = {
      x: bounds.minX + Math.trunc(random() * (bounds.maxX - bounds.minX + 1)),
      y: bounds.minY + Math.trunc(random() * (bounds.maxY - bounds.minY + 1)),
    };
    if (
      (mapWide || position.x !== center.x || position.y !== center.y) &&
      isWalkable(field, position.x, position.y)
    )
      return position;
  }
  if (centerReachable) return center;

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const position = {
      x: 15 + Math.trunc(random() * (field.width - 30)),
      y: 15 + Math.trunc(random() * (field.height - 30)),
    };
    if (isWalkable(field, position.x, position.y)) return position;
  }
  throw new RangeError(`${spawn.monster} spawn area lacks a reachable cell`);
}

export function isNearWarpPortal(position: GridPosition) {
  return PRT_FILD08.warpPortals.some(
    (portal) =>
      Math.abs(position.x - portal.centerX) <= portal.spanX + 1 &&
      Math.abs(position.y - portal.centerY) <= portal.spanY + 1,
  );
}

export function randomTeleportPosition(
  field: RoField,
  random: () => number,
): GridPosition {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const position = {
      x: 15 + Math.trunc(random() * (field.width - 30)),
      y: 15 + Math.trunc(random() * (field.height - 30)),
    };
    if (
      isWalkable(field, position.x, position.y) &&
      !isNearWarpPortal(position)
    )
      return position;
  }
  throw new RangeError('random teleport could not find a legal cell');
}

export function randomWalkDestination(
  field: RoField,
  random: () => number,
): GridPosition | null {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const position = {
      x: Math.trunc(random() * field.width),
      y: Math.trunc(random() * field.height),
    };
    if (
      position.x > 0 &&
      position.y > 0 &&
      position.x < field.width - 1 &&
      position.y < field.height - 1 &&
      isWalkable(field, position.x, position.y)
    )
      return position;
  }
  return null;
}

export function createMonsterPlacements(field: RoField, seed: number) {
  const random = createRandom(seed);
  const positions: MonsterPlacement[] = [];

  for (const [spawnIndex, spawn] of PRT_FILD08.monsterSpawns.entries()) {
    for (let index = 0; index < spawn.count; index += 1) {
      const position = sourceSpawnPosition(field, spawn, random);
      positions.push({
        monster: spawn.monster,
        x: position.x,
        y: position.y,
        spawnIndex,
        respawnMs: spawn.respawnMs,
        respawnVarianceMs: spawn.respawnVarianceMs,
      });
    }
  }

  return positions;
}

export function createPoringPositions(
  field: RoField,
  seed: number,
): GridPosition[] {
  return createMonsterPlacements(field, seed)
    .filter(({ monster }) => monster === 'PORING')
    .map(({ x, y }) => ({ x, y }));
}
