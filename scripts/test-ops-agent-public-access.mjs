import assert from 'node:assert/strict';

const publicUrl = String(process.env.OPS_AGENT_PUBLIC_URL ?? '').replace(/\/$/, '');
const username = process.env.OPS_AGENT_ADMIN_USERNAME;
const password = process.env.OPS_AGENT_ADMIN_PASSWORD;
if (!publicUrl.startsWith('https://') || !username || !password) {
  throw new Error(
    'OPS_AGENT_PUBLIC_URL, OPS_AGENT_ADMIN_USERNAME and OPS_AGENT_ADMIN_PASSWORD are required',
  );
}

const health = await fetch(`${publicUrl}/health`);
assert.equal(health.status, 200);
assert.equal((await health.json()).access, 'authenticated');
assert.match(health.headers.get('strict-transport-security') ?? '', /max-age=/);
assert.equal(health.headers.get('x-robots-tag'), 'noindex, nofollow');

const loginPage = await fetch(`${publicUrl}/`);
assert.equal(loginPage.status, 200);
assert.match(await loginPage.text(), /管理員登入/);

const unauthorized = await fetch(`${publicUrl}/api/v1/evidence`);
assert.equal(unauthorized.status, 401);
assert.equal((await unauthorized.json()).error, 'AUTH_REQUIRED');

const login = await fetch(`${publicUrl}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password }),
});
assert.equal(login.status, 200);
const cookie = login.headers.get('set-cookie');
assert.match(cookie ?? '', /ghost_ops_session=/);
assert.match(cookie ?? '', /HttpOnly/);
assert.match(cookie ?? '', /Secure/);

const evidenceResponse = await fetch(`${publicUrl}/api/v1/evidence`, {
  headers: { Cookie: cookie.split(';')[0] },
});
assert.equal(evidenceResponse.status, 200);
const evidence = await evidenceResponse.json();
assert.ok(evidence.services.length >= 8);
assert.equal(
  evidence.services.find((service) => service.serviceId === 'ops-admin-tunnel')
    ?.state,
  'healthy',
);
assert.ok(evidence.characters.every((character) => character.characterName));
assert.ok(
  evidence.characters.every((character) =>
    ['active', 'stopped', 'unknown'].includes(character.lifecycle),
  ),
);

console.log(
  JSON.stringify({
    status: 'OPS_AGENT_PUBLIC_ACCESS_PASS',
    services: evidence.services.length,
    activeCharacters: evidence.characters.filter(
      (character) => character.lifecycle === 'active',
    ).length,
    stoppedCharacters: evidence.characters.filter(
      (character) => character.lifecycle === 'stopped',
    ).length,
    warnings: evidence.characters.filter((character) => character.lastErrorCode)
      .length,
  }),
);
