import { readFile } from 'node:fs/promises';

const origin = process.env.RO_DEMO_ORIGIN ?? 'http://127.0.0.1:8788';
const account = process.env.RO_JOB_TEST_ACCOUNT ?? 'gate2_03';
const job = process.env.RO_JOB_TEST_TARGET ?? 'swordman';
const fixture = JSON.parse(
  await readFile('.local/ro-stack/multiplayer-test-v2-credentials.json', 'utf8'),
);
const session = { cookie: '' };

async function request(path, options = {}) {
  const response = await fetch(`${origin}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      origin,
      ...(session.cookie ? { cookie: session.cookie } : {}),
      ...options.headers,
    },
  });
  const body = await response.json();
  const cookie = response.headers.get('set-cookie');
  if (cookie) session.cookie = cookie.split(';')[0];
  if (!response.ok)
    throw new Error(`${path}: ${body.error ?? response.status}`);
  return body;
}

const login = await request('/api/account', {
  method: 'POST',
  body: JSON.stringify({ username: account, password: fixture.password }),
});
if (!login.account) throw new Error('login failed');
const initial = await request('/api/state');
if (
  Number(initial.derived?.jobId) !== 0 ||
  Number(initial.character?.jobLevel) < 10 ||
  Number(initial.derived?.basicSkillLevel) < 9
)
  throw new Error('test character is not eligible for first job change');

await request('/api/job-change', {
  method: 'POST',
  body: JSON.stringify({ action: 'route', job }),
});

const transitions = [];
let previous = '';
let live = null;
const routeDeadline = Date.now() + Number(process.env.RO_JOB_ROUTE_TIMEOUT_MS ?? 240_000);
while (Date.now() < routeDeadline) {
  const events = await request('/api/events');
  live = events.live;
  const position = `${live?.map}:${live?.playerX},${live?.playerY}`;
  if (live?.map && live.map !== previous) {
    transitions.push(position);
    previous = live.map;
    console.log(`route ${position}`);
  }
  if (live?.jobRoute?.arrived) break;
  await new Promise((resolve) => setTimeout(resolve, 500));
}
if (!live?.jobRoute?.arrived)
  throw new Error(`route did not arrive: ${JSON.stringify(live?.jobRoute)}`);

await request('/api/job-change', {
  method: 'POST',
  body: JSON.stringify({ action: 'talk', job }),
});
const dialogDeadline = Date.now() + 10_000;
while (Date.now() < dialogDeadline) {
  const events = await request('/api/events');
  live = events.live;
  if (live?.npcDialog?.active && live.npcDialog.message) break;
  await new Promise((resolve) => setTimeout(resolve, 150));
}
if (!live?.npcDialog?.active || !live.npcDialog.message)
  throw new Error('rAthena NPC dialog was not received');

const dialogEvidence = {
  stage: live.npcDialog.stage,
  message: live.npcDialog.message,
  responses: live.npcDialog.responses,
};
await request('/api/job-change', {
  method: 'POST',
  body: JSON.stringify({ action: 'close' }),
});
await request('/api/job-change', {
  method: 'POST',
  body: JSON.stringify({ action: 'resume' }),
});

const returnDeadline =
  Date.now() +
  Number(
    process.env.RO_JOB_RETURN_TIMEOUT_MS ??
      process.env.RO_JOB_ROUTE_TIMEOUT_MS ??
      240_000,
  );
while (Date.now() < returnDeadline) {
  const events = await request('/api/events');
  live = events.live;
  if (live?.map === 'prt_fild08' && !live?.jobRoute) break;
  await new Promise((resolve) => setTimeout(resolve, 500));
}
if (live?.map !== 'prt_fild08' || live?.jobRoute)
  throw new Error('character did not resume the original farming map');
if (Number(live.jobId) !== 0)
  throw new Error('route-only test unexpectedly changed the character job');

console.log(
  JSON.stringify(
    {
      result: 'JOB_ROUTE_PASS',
      job,
      transitions,
      arrivedAt: `${dialogEvidence.stage}:${live.playerX},${live.playerY}`,
      dialogEvidence,
      resumedMap: live.map,
      jobId: live.jobId,
    },
    null,
    2,
  ),
);
