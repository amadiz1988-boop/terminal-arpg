import { networkInterfaces } from 'node:os';
import { Socket } from 'node:net';
import { readFile } from 'node:fs/promises';

const origin = process.env.RO_DEMO_ORIGIN ?? 'http://127.0.0.1:8788';
const healthResponse = await fetch(`${origin}/api/health`);
const health = await healthResponse.json();
if (Object.keys(health).sort().join(',') !== 'ok')
  throw new Error('public health exposes internal topology');
for (const name of [
  'content-security-policy',
  'referrer-policy',
  'x-content-type-options',
  'x-frame-options',
]) {
  if (!healthResponse.headers.get(name))
    throw new Error(`missing security header: ${name}`);
}

const crossSite = await fetch(`${origin}/api/account`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    origin: 'https://attacker.invalid',
    'sec-fetch-site': 'cross-site',
  },
  body: '{}',
});
if (crossSite.status !== 403)
  throw new Error('cross-site mutation was accepted');

const oversized = await fetch(`${origin}/api/account`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'oversized', password: 'x'.repeat(9000) }),
});
if (oversized.status !== 413)
  throw new Error(`oversized account body returned ${oversized.status}`);

let rotatingIdentityStatus = 0;
let rotatingIdentityRetryAfter = null;
for (let index = 0; index < 41; index += 1) {
  const response = await fetch(`${origin}/api/account`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': '198.51.100.77',
      'cf-ray': `security-ip-${index}`,
    },
    body: JSON.stringify({
      username: `flood_${String(index).padStart(2, '0')}`,
      password: 'short',
    }),
  });
  rotatingIdentityStatus = response.status;
  rotatingIdentityRetryAfter = response.headers.get('retry-after');
}
if (rotatingIdentityStatus !== 429 || rotatingIdentityRetryAfter !== '300')
  throw new Error('rotating-account source flood bypassed the IP limiter');

let rotatingSourceStatus = 0;
let rotatingSourceRetryAfter = null;
for (let index = 0; index < 11; index += 1) {
  const response = await fetch(`${origin}/api/account`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': `198.51.100.${100 + index}`,
      'cf-ray': `security-account-${index}`,
    },
    body: JSON.stringify({ username: 'single_target', password: 'short' }),
  });
  rotatingSourceStatus = response.status;
  rotatingSourceRetryAfter = response.headers.get('retry-after');
}
if (rotatingSourceStatus !== 429 || rotatingSourceRetryAfter !== '300')
  throw new Error(
    'rotating-source account flood bypassed the identity limiter',
  );

const internalLoopback = await fetch(`${origin}/api/internal/health`);
const internal = await internalLoopback.json();
if (!internalLoopback.ok || !internal.services?.database)
  throw new Error('loopback maintenance health is unavailable');

const lanAddress = Object.values(networkInterfaces())
  .flat()
  .find((entry) => entry?.family === 'IPv4' && !entry.internal)?.address;
const originUrl = new URL(origin);
if (
  lanAddress &&
  ['127.0.0.1', 'localhost', '::1'].includes(originUrl.hostname)
) {
  const dashboardPort = Number(
    originUrl.port || (originUrl.protocol === 'https:' ? 443 : 80),
  );
  const lanReachable = await new Promise((resolve) => {
    const socket = new Socket();
    const finish = (reachable) => {
      socket.destroy();
      resolve(reachable);
    };
    socket.setTimeout(1000);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(dashboardPort, lanAddress);
  });
  if (lanReachable)
    throw new Error('dashboard is directly reachable through a LAN interface');
}

const fixture = JSON.parse(
  await readFile(
    '.local/ro-stack/multiplayer-test-v2-credentials.json',
    'utf8',
  ),
);
const login = await fetch(`${origin}/api/account`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    username: 'gate2_02',
    password: fixture.password,
    sex: 'F',
  }),
});
if (!login.ok) throw new Error(`security test login failed: ${login.status}`);
const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? '';
const injected = await fetch(`${origin}/api/item-action`, {
  method: 'POST',
  headers: { cookie, 'content-type': 'application/json' },
  body: JSON.stringify({
    action: '@item',
    command: '@item 512 999999',
    characterId: 1,
  }),
});
if (injected.status !== 400) throw new Error('raw command action was accepted');

console.log(
  JSON.stringify(
    {
      result: 'PLAYER_SECURITY_PASS',
      publicHealthFields: Object.keys(health),
      crossSiteStatus: crossSite.status,
      oversizedStatus: oversized.status,
      rotatingIdentityStatus,
      rotatingIdentityRetryAfter,
      rotatingSourceStatus,
      rotatingSourceRetryAfter,
      lanDirectReachable: lanAddress ? false : 'not_tested',
      rawCommandStatus: injected.status,
      csp: healthResponse.headers.get('content-security-policy'),
    },
    null,
    2,
  ),
);
