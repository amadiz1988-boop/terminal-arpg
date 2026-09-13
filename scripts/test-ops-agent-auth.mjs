import assert from 'node:assert/strict';

import {
  createAuthService,
  createCredentialRecord,
} from '../ops/ro-stack/ops-agent/auth.mjs';
import { createOpsAgentServer } from '../ops/ro-stack/ops-agent/server.mjs';

let nowValue = Date.parse('2026-09-13T16:00:00+08:00');
const now = () => nowValue;
const { record } = createCredentialRecord({
  username: 'admin',
  password: 'Correct-Horse-2026!',
  now,
});
assert.equal('password' in record, false);
const auth = createAuthService(record, { now, failureLimit: 3 });

assert.equal(auth.authenticate('admin', 'wrong', 'rate-test').ok, false);
assert.equal(auth.authenticate('admin', 'wrong', 'rate-test').ok, false);
assert.equal(auth.authenticate('admin', 'wrong', 'rate-test').rateLimited, true);
assert.equal(
  auth.authenticate('admin', 'Correct-Horse-2026!', 'rate-test').rateLimited,
  true,
);
assert.equal(
  auth.authenticate('admin', 'Correct-Horse-2026!', 'valid-test').ok,
  true,
);
const session = auth.issueSession();
assert.equal(auth.verifySession(`ghost_ops_session=${session}`), true);
nowValue += 13 * 60 * 60 * 1000;
assert.equal(auth.verifySession(`ghost_ops_session=${session}`), false);
nowValue -= 13 * 60 * 60 * 1000;

const server = createOpsAgentServer(
  { port: 0 },
  { auth },
);
await new Promise((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
const base = `http://127.0.0.1:${server.address().port}`;
try {
  const loginPage = await fetch(`${base}/`);
  assert.equal(loginPage.status, 200);
  assert.match(await loginPage.text(), /管理員登入/);

  const protectedResponse = await fetch(`${base}/api/v1/incidents`);
  assert.equal(protectedResponse.status, 401);
  assert.equal((await protectedResponse.json()).error, 'AUTH_REQUIRED');

  const invalidLogin = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'wrong' }),
  });
  assert.equal(invalidLogin.status, 401);

  const crossSiteLogin = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Sec-Fetch-Site': 'cross-site',
    },
    body: JSON.stringify({
      username: 'admin',
      password: 'Correct-Horse-2026!',
    }),
  });
  assert.equal(crossSiteLogin.status, 403);

  const validLogin = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-Proto': 'https',
      'CF-Connecting-IP': '203.0.113.8',
    },
    body: JSON.stringify({
      username: 'admin',
      password: 'Correct-Horse-2026!',
    }),
  });
  assert.equal(validLogin.status, 200);
  const cookie = validLogin.headers.get('set-cookie');
  assert.match(cookie, /ghost_ops_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Secure/);

  const authenticated = await fetch(`${base}/api/v1/incidents`, {
    headers: { Cookie: cookie.split(';')[0] },
  });
  assert.equal(authenticated.status, 200);

  const mutation = await fetch(`${base}/api/v1/services`, {
    method: 'POST',
    headers: { Cookie: cookie.split(';')[0] },
  });
  assert.equal(mutation.status, 405);
  assert.equal((await mutation.json()).error, 'READ_ONLY');

  const health = await fetch(`${base}/health`).then((response) => response.json());
  assert.equal(health.ok, true);
  assert.equal(health.access, 'authenticated');
  console.log('OPS_AGENT_AUTH_PASS');
} finally {
  await new Promise((resolvePromise) => server.close(resolvePromise));
}
