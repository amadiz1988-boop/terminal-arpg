import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadOpsAgentConfig } from '../ops/ro-stack/ops-agent/config.mjs';
import {
  EvidenceStatus,
  EvidenceType,
  OPS_API_VERSION,
  ReasonCode,
  ServiceProvider,
  ServiceState,
} from '../ops/ro-stack/ops-agent/contracts.mjs';
import { createIncidentStore } from '../ops/ro-stack/ops-agent/incidents.mjs';
import { createOpsAgentServer } from '../ops/ro-stack/ops-agent/server.mjs';

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const root = await mkdtemp(join(tmpdir(), 'ops-mobile-ui-'));
const profile = await mkdtemp(join(tmpdir(), 'ops-mobile-chrome-'));
const runtimeRoot = join(root, '.local', 'ro-stack');
const observedAt = Date.parse('2026-09-13T10:00:00+08:00');

const sleep = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

async function freePort() {
  const server = net.createServer();
  await new Promise((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
  const port = server.address().port;
  await new Promise((resolvePromise) => server.close(resolvePromise));
  return port;
}

async function waitFor(read, predicate = Boolean, timeout = 15000) {
  const deadline = Date.now() + timeout;
  let value;
  while (Date.now() < deadline) {
    value = await read();
    if (predicate(value)) return value;
    await sleep(100);
  }
  throw new Error(`wait timed out: ${JSON.stringify(value)}`);
}

async function json(path, value) {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, JSON.stringify(value), 'utf8');
}

function incidentService() {
  const timestamp = new Date(observedAt).toISOString();
  return {
    schemaVersion: OPS_API_VERSION,
    serviceId: 'dashboard',
    provider: ServiceProvider.WINDOWS_NATIVE,
    state: ServiceState.UNREACHABLE,
    pid: null,
    port: 8788,
    startedAt: null,
    lastHeartbeatAt: null,
    restartCount: 0,
    lastExitCode: null,
    lastErrorCode: ReasonCode.HEALTHCHECK_FAILED,
    evidence: [
      {
        type: EvidenceType.HTTP,
        status: EvidenceStatus.FAIL,
        checkedAt: timestamp,
        reasonCode: ReasonCode.HEALTHCHECK_FAILED,
        summary: 'health endpoint unavailable',
      },
    ],
  };
}

let browser;
let server;
try {
  await mkdir(join(root, 'ops', 'ro-stack'), { recursive: true });
  await writeFile(
    join(root, 'ops', 'ro-stack', 'stack.config.psd1'),
    "@{\n MariaDbPort=3307\n LoginPort=6901\n CharacterPort=6122\n MapPort=5122\n}\n",
    'utf8',
  );
  await json(join(runtimeRoot, 'state.json'), {
    processes: [
      { name: 'login', id: 101, path: 'login-server.exe', stdout: 'login.log' },
      { name: 'char', id: 102, path: 'char-server.exe', stdout: 'char.log' },
      { name: 'map', id: 103, path: 'map-server.exe', stdout: 'map.log' },
    ],
  });
  await json(join(runtimeRoot, 'dashboard', 'state.json'), { pid: 104 });
  await json(join(runtimeRoot, 'dashboard', 'tunnel-state.json'), {
    pid: 105,
    publicUrl: 'https://example.test',
  });
  await json(join(runtimeRoot, 'instances', 'player_2000001', 'status.json'), {
    name: 'MobileFixture',
    map: 'prt_fild08',
    updatedAt: observedAt - 1000,
  });

  const config = await loadOpsAgentConfig({
    projectRoot: root,
    runtimeRoot,
    port: 0,
  });
  const collectorOptions = {
    now: () => observedAt,
    probeHttp: async () => ({ ok: true, status: 200 }),
    probeProcess: async (tracked) => ({
      state: 'running',
      pid: Number(tracked?.pid ?? tracked?.id),
      name: 'fixture.exe',
      startedAt: new Date(observedAt - 60000).toISOString(),
    }),
    probeTcp: async () => ({ ok: true }),
    queryMariaDb: async (_config, sql) =>
      sql === 'SELECT 1;'
        ? '1'
        : '2000001\t1500001\tMobileFixture\tOPENKORE\tOPENKORE\t\t0\t',
    tailContains: async () => true,
  };
  const incidentStore = createIncidentStore({
    directory: join(runtimeRoot, 'ops-agent', 'incidents'),
    now: () => observedAt,
  });
  await incidentStore.write({ services: [incidentService()], characters: [] });
  server = createOpsAgentServer(config, { collectorOptions, incidentStore });
  await new Promise((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));

  const debugPort = await freePort();
  browser = spawn(
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
  await waitFor(async () => {
    try {
      return (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok;
    } catch {
      return false;
    }
  });
  const target = await fetch(
    `http://127.0.0.1:${debugPort}/json/new?about:blank`,
    { method: 'PUT' },
  ).then((response) => response.json());
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  const runtimeErrors = [];
  let requestId = 0;
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
    if (message.method === 'Runtime.exceptionThrown') {
      runtimeErrors.push(message.params?.exceptionDetails?.text ?? 'runtime error');
    }
    if (
      message.method === 'Log.entryAdded' &&
      message.params?.entry?.level === 'error'
    ) {
      runtimeErrors.push(message.params.entry.text);
    }
  };
  await new Promise((resolvePromise) => {
    socket.onopen = resolvePromise;
  });
  const call = (method, params = {}) =>
    new Promise((resolvePromise) => {
      const id = ++requestId;
      pending.set(id, resolvePromise);
      socket.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) =>
    (
      await call('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      })
    ).result.result.value;
  await call('Runtime.enable');
  await call('Log.enable');
  await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await call('Page.navigate', {
    url: `http://127.0.0.1:${server.address().port}/`,
  });
  await waitFor(
    () => evaluate("document.querySelectorAll('.service-card').length"),
    (value) => value === 7,
  );
  const result = await evaluate(`(() => ({
    title: document.querySelector('h1')?.textContent,
    readonly: document.querySelector('.readonly-badge')?.textContent,
    serviceCount: document.querySelectorAll('.service-card').length,
    characterCount: document.querySelectorAll('.character-card').length,
    incidentCount: document.querySelectorAll('.incident-button').length,
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
    refreshHeight: document.querySelector('#refreshButton').getBoundingClientRect().height,
    forbiddenControls: [...document.querySelectorAll('button')].filter((button) => /啟動|停止|重啟|kill|claim|release/i.test(button.textContent)).length,
  }))()`);
  assert.equal(result.title, '伺服器管理後台');
  assert.equal(result.readonly, '唯讀監控');
  assert.equal(result.serviceCount, 7);
  assert.equal(result.characterCount, 1);
  assert.equal(result.incidentCount, 1);
  assert.ok(result.pageWidth <= result.viewportWidth);
  assert.ok(result.refreshHeight >= 44);
  assert.equal(result.forbiddenControls, 0);
  await evaluate("document.querySelector('.incident-button').click()");
  await waitFor(
    () => evaluate("document.querySelector('#incidentDetail')?.textContent"),
    (value) => value.includes('玩家 Dashboard'),
  );
  assert.deepEqual(runtimeErrors, []);
  socket.close();
  console.log('OPS_AGENT_MOBILE_UI_PASS');
} finally {
  if (browser && browser.exitCode == null) {
    const exited = new Promise((resolvePromise) =>
      browser.once('exit', resolvePromise),
    );
    browser.kill();
    await Promise.race([exited, sleep(3000)]);
  }
  if (server) await new Promise((resolvePromise) => server.close(resolvePromise));
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(profile, { recursive: true, force: true });
      break;
    } catch (error) {
      if (error?.code !== 'EBUSY' || attempt === 4) throw error;
      await sleep(200);
    }
  }
  await rm(root, { recursive: true, force: true });
}
