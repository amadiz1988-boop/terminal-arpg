// Canonical first-job content for the Quest Runtime.
//
// Content (routes, resume targets, NPC identity) lives here; execution lives in
// the generic Persistent Agent navigation/dialog actions. This module performs
// no transport and owns no quest rule: it only validates canonical content and
// resolves a job or level into a route/identity the caller can execute natively.
//
// The academy NPC identity is deliberately ASCII (`terminal_academy_guide`) and
// is bound to the rAthena script `學院結業導師#terminal` by an in-server
// `duplicate()`. The CJK source name is content, not transport identity: the
// Persistent Agent dialog payload only accepts ASCII NPC identities, so the
// stable ASCII alias replaces byte-length/Unicode workarounds.

const jobKeys = Object.freeze([
  'swordman',
  'mage',
  'archer',
  'acolyte',
  'merchant',
  'thief',
  'supernovice',
  'taekwon',
  'gunslinger',
  'ninja',
]);

const identityPattern = /^[A-Za-z0-9_]{1,31}$/;
const mapPattern = /^[a-z0-9_]{1,31}$/;

function requireCoordinate(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 32767)
    throw new Error(`FIRST_JOB_CONTENT_INVALID_COORDINATE:${label}`);
}

function requireMap(value, label) {
  if (typeof value !== 'string' || !mapPattern.test(value))
    throw new Error(`FIRST_JOB_CONTENT_INVALID_MAP:${label}`);
}

function requireIdentity(value, label) {
  if (typeof value !== 'string' || !identityPattern.test(value))
    throw new Error(`FIRST_JOB_CONTENT_INVALID_IDENTITY:${label}`);
}

export function parseFirstJobContent(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('FIRST_JOB_CONTENT_INVALID');
  if (input.contentId !== 'first_job_v1')
    throw new Error('FIRST_JOB_CONTENT_INVALID_ID');
  const academy = input.academy;
  if (!academy || typeof academy !== 'object')
    throw new Error('FIRST_JOB_CONTENT_INVALID_ACADEMY');
  requireIdentity(academy.identity, 'academy.identity');
  requireMap(academy.map, 'academy.map');
  requireCoordinate(academy.x, 'academy.x');
  requireCoordinate(academy.y, 'academy.y');
  if (!input.routes || typeof input.routes !== 'object')
    throw new Error('FIRST_JOB_CONTENT_INVALID_ROUTES');
  const routes = {};
  for (const job of jobKeys) {
    const route = input.routes[job];
    if (!route || typeof route !== 'object')
      throw new Error(`FIRST_JOB_CONTENT_MISSING_ROUTE:${job}`);
    requireMap(route.map, `routes.${job}.map`);
    requireCoordinate(route.x, `routes.${job}.x`);
    requireCoordinate(route.y, `routes.${job}.y`);
    routes[job] = Object.freeze({
      map: route.map,
      x: route.x,
      y: route.y,
      npcIdentity: academy.identity,
    });
  }
  if (Object.keys(input.routes).length !== jobKeys.length)
    throw new Error('FIRST_JOB_CONTENT_UNKNOWN_ROUTE');
  if (!Array.isArray(input.resumeTargets) || input.resumeTargets.length < 1)
    throw new Error('FIRST_JOB_CONTENT_INVALID_RESUME_TARGETS');
  const resumeTargets = input.resumeTargets.map((target, index) => {
    if (!target || typeof target !== 'object')
      throw new Error('FIRST_JOB_CONTENT_INVALID_RESUME_TARGET');
    if (!Number.isSafeInteger(target.minimumBaseLevel) || target.minimumBaseLevel < 1)
      throw new Error(`FIRST_JOB_CONTENT_INVALID_RESUME_LEVEL:${index}`);
    requireMap(target.map, `resumeTargets.${index}.map`);
    requireCoordinate(target.x, `resumeTargets.${index}.x`);
    requireCoordinate(target.y, `resumeTargets.${index}.y`);
    return Object.freeze({
      minimumBaseLevel: target.minimumBaseLevel,
      map: target.map,
      x: target.x,
      y: target.y,
    });
  });
  for (let index = 1; index < resumeTargets.length; index += 1) {
    if (resumeTargets[index - 1].minimumBaseLevel <= resumeTargets[index].minimumBaseLevel)
      throw new Error('FIRST_JOB_CONTENT_RESUME_TARGETS_NOT_DESCENDING');
  }
  if (resumeTargets[resumeTargets.length - 1].minimumBaseLevel !== 1)
    throw new Error('FIRST_JOB_CONTENT_RESUME_TARGETS_NOT_EXHAUSTIVE');
  return Object.freeze({
    contentId: input.contentId,
    academy: Object.freeze({
      identity: academy.identity,
      sourceScript:
        typeof academy.sourceScript === 'string' ? academy.sourceScript : '',
      map: academy.map,
      x: academy.x,
      y: academy.y,
    }),
    routes: Object.freeze(routes),
    resumeTargets: Object.freeze(resumeTargets),
  });
}

export function firstJobRoute(content, job) {
  const key = String(job ?? '');
  const route = content?.routes?.[key];
  if (!route) throw new Error(`FIRST_JOB_ROUTE_UNKNOWN:${key}`);
  return route;
}

export function firstJobResumeTarget(content, baseLevel) {
  const level = Number(baseLevel);
  if (!Number.isSafeInteger(level) || level < 1)
    throw new Error('FIRST_JOB_RESUME_LEVEL_INVALID');
  const target = content?.resumeTargets?.find(
    (candidate) => level >= candidate.minimumBaseLevel,
  );
  if (!target) throw new Error('FIRST_JOB_RESUME_TARGET_MISSING');
  return target;
}

export function firstJobNavigationRoute(destination) {
  return [
    {
      map: destination.map,
      x: destination.x,
      y: destination.y,
    },
  ];
}

export const FIRST_JOB_KEYS = jobKeys;
