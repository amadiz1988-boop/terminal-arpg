import { PRT_FILD08 } from '@/game/ro/content/prt-fild08';
import { loadFld2Gzip } from '@/game/ro/world/fld2';
import {
  advanceRoWorld,
  createRoWorld,
  type RoWorldState,
} from '@/game/ro/world/simulation';

const STEP_MS = 30 * 60_000;
const EVENT_LIMIT = 240;
let cachedField: ReturnType<typeof loadFld2Gzip> | null = null;

async function serverField(request: Request) {
  cachedField ??= loadFld2Gzip(
    new URL(PRT_FILD08.fieldUrl, request.url).toString(),
  );
  return cachedField;
}

export async function freshWorld(request: Request, seed: number) {
  return createRoWorld(await serverField(request), seed);
}

export async function reconcileWorld(
  request: Request,
  world: RoWorldState,
  elapsedMs: number,
) {
  const field = await serverField(request);
  let remaining = Math.max(0, Math.trunc(elapsedMs));
  let current = world;
  while (remaining > 0) {
    const duration = Math.min(STEP_MS, remaining);
    current = advanceRoWorld(current, field, duration, true);
    current.events = current.events.slice(-EVENT_LIMIT);
    remaining -= duration;
  }
  return current;
}
