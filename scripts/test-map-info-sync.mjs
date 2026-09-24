import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = process.env.RO_DEMO_ORIGIN ?? 'http://127.0.0.1:8788';
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = mkdtempSync(join(tmpdir(), 'ro-map-info-'));
const debugPort = 19464;
const appSource = await readFile('ops/ro-stack/dashboard/app.js', 'utf8');
const index = JSON.parse(await readFile('public/ro/data/map-info.json', 'utf8'));
const detailFiles = (await readdir('public/ro/data/map-info')).filter((name) =>
  name.endsWith('.json'),
);

assert.ok(Object.keys(index.maps).length >= 53);
assert.equal(detailFiles.length, Object.keys(index.maps).length);
assert.equal(index.maps.moc_fild11.totalMonsters, 318);
assert.equal(index.maps.pay_dun00.totalMonsters, 125);
assert.doesNotMatch(appSource, /Object\.values\(mapInfoData\?\.maps/);
assert.match(appSource, /syncMapInfoToLive\(live\)/);

const browser = spawn(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { windowsHide: true },
);

try {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if ((await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const target = await fetch(
    `http://127.0.0.1:${debugPort}/json/new?about:blank`,
    { method: 'PUT' },
  ).then((response) => response.json());
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  const errors = [];
  const requests = [];
  let requestId = 0;
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
    if (message.method === 'Runtime.exceptionThrown')
      errors.push(message.params?.exceptionDetails?.text ?? 'runtime error');
    if (message.method === 'Network.responseReceived') {
      const url = message.params?.response?.url ?? '';
      if (url.includes('/ro/data/map-info/')) requests.push(url);
    }
  };
  await new Promise((resolve) => {
    socket.onopen = resolve;
  });
  const call = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++requestId;
      pending.set(id, resolve);
      socket.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression, awaitPromise = false) =>
    (
      await call('Runtime.evaluate', {
        expression,
        awaitPromise,
        returnByValue: true,
      })
    ).result.result.value;

  await call('Runtime.enable');
  await call('Network.enable');
  await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await call('Page.navigate', { url: origin });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await evaluate("typeof loadMapInfo === 'function'")) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const first = await evaluate(`(async()=>{
    document.querySelector('#auth').classList.add('hidden');
    document.querySelector('#game').classList.remove('hidden');
    document.querySelectorAll('.panel').forEach(node=>node.classList.remove('active'));
    document.querySelector('#mapInfo').classList.add('active');
    await loadMapInfo('moc_fild11');
    return {
      title:document.querySelector('#mapInfoTitle').textContent,
      total:document.querySelector('#mapInfoTotal').textContent,
      monsters:document.querySelectorAll('#mapMonsterList .monster-entry').length,
    };
  })()`, true);
  await evaluate(`renderMinimap({
    map:'pay_dun00',playerX:73,playerY:78,hp:100,
    monsters:[],players:[],mapPlayerCount:1
  })`);
  let second = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    second = await evaluate(`({
      title:document.querySelector('#mapInfoTitle').textContent,
      total:document.querySelector('#mapInfoTotal').textContent,
      monsters:document.querySelectorAll('#mapMonsterList .monster-entry').length,
      source:document.querySelector('#mapInfoSource').textContent,
      width:document.querySelector('#mapInfo .window').getBoundingClientRect().right,
    })`);
    if (second.title === '斐揚洞穴 1樓' && second.monsters === 7) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  assert.deepEqual(first, {
    title: '蘇克拉特沙漠 11',
    total: '4 種／318 隻',
    monsters: 4,
  });
  assert.equal(second.title, '斐揚洞穴 1樓');
  assert.equal(second.total, '7 種／125 隻');
  assert.equal(second.monsters, 7);
  assert.match(second.source, /rAthena Renewal/);
  assert.ok(second.width <= 390);
  assert.ok(requests.some((url) => url.endsWith('/moc_fild11.json')));
  assert.ok(requests.some((url) => url.endsWith('/pay_dun00.json')));
  assert.deepEqual(errors, []);
  socket.close();
  console.log(
    JSON.stringify({ result: 'MAP_INFO_SYNC_PASS', first, second, requests }, null, 2),
  );
} finally {
  browser.kill();
  await Promise.race([
    new Promise((resolve) => browser.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]);
  try {
    rmSync(profile, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  } catch {}
}
