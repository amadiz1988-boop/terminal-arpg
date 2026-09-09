import { createRandom } from '../../core/random';
import { PRT_FILD08, type PoringSpawn } from '../content/prt-fild08';
import { fieldOffset, isWalkable, type RoField } from './fld2';

export type GridPosition = Readonly<{ x: number; y: number }>;
export type PoringPlacement = GridPosition & Readonly<{ spawnIndex: number; respawnMs: number }>;

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
  if (originOffset < 0 || !isWalkable(field, origin.x, origin.y)) return distance;

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
      if (nextOffset < 0 || distance[nextOffset] >= 0 || !isWalkable(field, nextX, nextY)) continue;
      distance[nextOffset] = distance[offset] + 1;
      queue[write++] = nextOffset;
    }
  }

  return distance;
}

export function shortestPath(field: RoField, origin: GridPosition, destination: GridPosition) {
  const originOffset = fieldOffset(field, origin.x, origin.y);
  const destinationOffset = fieldOffset(field, destination.x, destination.y);
  if (
    originOffset < 0 ||
    destinationOffset < 0 ||
    !isWalkable(field, origin.x, origin.y) ||
    !isWalkable(field, destination.x, destination.y)
  ) return [];
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
      if (nextOffset < 0 || previous[nextOffset] !== -2 || !isWalkable(field, x + direction.x, y + direction.y)) continue;
      previous[nextOffset] = offset;
      queue[write++] = nextOffset;
      if (nextOffset === destinationOffset) break;
    }
  }
  if (previous[destinationOffset] === -2) return [];

  const reversed: GridPosition[] = [];
  for (let offset = destinationOffset; offset !== originOffset; offset = previous[offset]) {
    reversed.push({ x: offset % field.width, y: Math.trunc(offset / field.width) });
  }
  return reversed.reverse();
}

function spawnBounds(field: RoField, spawn: PoringSpawn) {
  if (spawn.width === 0 || spawn.height === 0) {
    return { minX: 0, maxX: field.width - 1, minY: 0, maxY: field.height - 1 };
  }
  const halfWidth = Math.trunc(spawn.width / 2);
  const halfHeight = Math.trunc(spawn.height / 2);
  return {
    minX: Math.max(0, spawn.centerX - halfWidth),
    maxX: Math.min(field.width - 1, spawn.centerX + halfWidth),
    minY: Math.max(0, spawn.centerY - halfHeight),
    maxY: Math.min(field.height - 1, spawn.centerY + halfHeight),
  };
}

export function createPoringPlacements(field: RoField, seed: number) {
  const random = createRandom(seed);
  const reachable = floodWalkable(field, PRT_FILD08.noviceEntry);
  const occupied = new Set<number>();
  const positions: PoringPlacement[] = [];

  for (const [spawnIndex, spawn] of PRT_FILD08.poringSpawns.entries()) {
    const bounds = spawnBounds(field, spawn);
    const candidates: number[] = [];
    for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
      for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
        const offset = fieldOffset(field, x, y);
        if (reachable[offset] >= 0 && !occupied.has(offset)) candidates.push(offset);
      }
    }
    if (candidates.length < spawn.count) throw new RangeError('Poring spawn area lacks reachable cells');
    for (let index = 0; index < spawn.count; index += 1) {
      const selectedIndex = Math.trunc(random() * candidates.length);
      const [offset] = candidates.splice(selectedIndex, 1);
      occupied.add(offset);
      positions.push({
        x: offset % field.width,
        y: Math.trunc(offset / field.width),
        spawnIndex,
        respawnMs: spawn.respawnMs,
      });
    }
  }

  return positions;
}

export function createPoringPositions(field: RoField, seed: number): GridPosition[] {
  return createPoringPlacements(field, seed).map(({ x, y }) => ({ x, y }));
}
