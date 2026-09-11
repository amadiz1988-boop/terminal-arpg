import { readFile } from 'node:fs/promises';

const origin = process.env.RO_DEMO_ORIGIN ?? 'http://127.0.0.1:8788';
const fixture = JSON.parse(
  await readFile(
    '.local/ro-stack/multiplayer-test-v2-credentials.json',
    'utf8',
  ),
);
const session = { cookie: '' };
async function request(path, options = {}) {
  const response = await fetch(origin + path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(session.cookie ? { cookie: session.cookie } : {}),
      ...options.headers,
    },
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(`${path}: ${body.error ?? response.status}`);
  const cookie = response.headers.get('set-cookie');
  if (cookie) session.cookie = cookie.split(';')[0];
  return body;
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await request('/api/account', {
  method: 'POST',
  body: JSON.stringify({
    username: 'gate2_01',
    password: fixture.password,
    sex: 'M',
  }),
});
await request('/api/automation', {
  method: 'POST',
  body: JSON.stringify({ action: 'start' }),
});
let before = await request('/api/state');
for (
  let attempt = 0;
  attempt < 100 && (!before.running || !before.character?.online);
  attempt++
) {
  await sleep(200);
  before = await request('/api/state');
}
if (!before.running || !before.character?.online)
  throw new Error('測試角色未在線掛機');
if (before.character.statusPoint < 2) throw new Error('測試角色能力點不足');
await request('/api/status-point', {
  method: 'POST',
  body: JSON.stringify({ stat: 'str' }),
});
let allocated = null;
for (let attempt = 0; attempt < 40; attempt++) {
  await sleep(150);
  allocated = await request('/api/state');
  if (allocated.character.str === before.character.str + 1) break;
}
if (allocated.character.str !== before.character.str + 1)
  throw new Error('掛機中能力配點未獲伺服器確認');
const runningBeforeReset = allocated.running;
await request('/api/status-reset', { method: 'POST' });
let restored = null;
let stayedOnline = true;
for (let attempt = 0; attempt < 60; attempt++) {
  await sleep(100);
  restored = await request('/api/state');
  stayedOnline &&= Boolean(restored.running && restored.character?.online);
  if (
    ['str', 'agi', 'vit', 'int', 'dex', 'luk'].every(
      (key) => Number(restored.derived?.[key]) === 1,
    )
  )
    break;
}
if (!stayedOnline) throw new Error('能力重置期間掛機或角色曾離線');
if (
  ['str', 'agi', 'vit', 'int', 'dex', 'luk'].some(
    (key) => Number(restored.derived?.[key]) !== 1,
  )
)
  throw new Error('能力重置結果不正確');
console.log(
  JSON.stringify(
    {
      result: 'STATUS_COMMAND_PASS',
      before: {
        str: before.character.str,
        points: before.character.statusPoint,
      },
      allocated: {
        str: allocated.character.str,
        points: allocated.character.statusPoint,
      },
      reset: {
        str: restored.character.str,
        points: restored.character.statusPoint,
      },
      stayedOnline,
      runningRestored: restored.running && restored.character.online,
    },
    null,
    2,
  ),
);
