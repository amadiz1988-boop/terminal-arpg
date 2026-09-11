import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const origin = process.env.RO_DEMO_ORIGIN ?? 'http://127.0.0.1:8788';
const fixture = JSON.parse(
  await readFile('.local/ro-stack/multiplayer-test-v2-credentials.json', 'utf8'),
);

const login = await fetch(`${origin}/api/account`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    username: 'gate2_01',
    password: fixture.password,
    sex: 'M',
  }),
});
if (!login.ok) throw new Error(`state latency login failed: ${login.status}`);
const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? '';

const timings = [];
for (let request = 0; request < 30; request += 1) {
  const started = performance.now();
  const response = await fetch(`${origin}/api/state`, { headers: { cookie } });
  const body = await response.json();
  timings.push(performance.now() - started);
  if (!response.ok || !body.account || !body.character)
    throw new Error('invalid state response');
}

timings.sort((a, b) => a - b);
const average = timings.reduce((sum, value) => sum + value, 0) / timings.length;
const p95 = timings[Math.ceil(timings.length * 0.95) - 1];
const maximum = timings.at(-1);

if (average > 100)
  throw new Error(`state API average ${average.toFixed(1)}ms exceeded 100ms`);
if (p95 > 150)
  throw new Error(`state API p95 ${p95.toFixed(1)}ms exceeded 150ms`);
if (maximum > 500)
  throw new Error(`state API max ${maximum.toFixed(1)}ms exceeded 500ms`);

console.log(
  JSON.stringify(
    {
      result: 'STATE_LATENCY_PASS',
      requests: timings.length,
      averageMs: Number(average.toFixed(1)),
      p95Ms: Number(p95.toFixed(1)),
      maxMs: Number(maximum.toFixed(1)),
    },
    null,
    2,
  ),
);
