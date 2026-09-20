import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const origin = process.env.RO_DEMO_ORIGIN ?? 'http://127.0.0.1:8788';
const fixture = JSON.parse(
  await readFile(
    process.env.RO_DB_MEASURE_FIXTURE ??
      '.local/ro-stack/quest-runtime-thief-fixture.json',
    'utf8',
  ),
);

const login = await fetch(`${origin}/api/account`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    username: fixture.username,
    password: fixture.password,
    sex: 'M',
  }),
});
assert.equal(login.status, 200);
const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? '';
assert.ok(cookie);

async function get(path) {
  const response = await fetch(`${origin}${path}`, { headers: { cookie } });
  const body = await response.json();
  assert.equal(response.status, 200, `${path} returned ${response.status}`);
  return body;
}

try {
  const health = await fetch(`${origin}/api/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).ok, true);

  const session = await get('/api/session');
  assert.ok(session.account?.characterId);
  assert.ok(Array.isArray(session.equipment));

  const entry = await get('/api/session?view=entry');
  assert.ok(entry.account?.characterId);
  assert.equal(Object.hasOwn(entry, 'equipment'), false);

  const state = await get(
    '/api/state?view=entry&interest=COMBAT_PAGE',
  );
  assert.ok(state.account?.characterId ?? state.character?.charId);
} finally {
  await fetch(`${origin}/api/account`, {
    method: 'DELETE',
    headers: { cookie },
  });
}

console.log('DASHBOARD_DB_LIVE_PASS checks=7');
