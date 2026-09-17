import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = process.env.RO_DEMO_ORIGIN ?? 'https://play.g8land.com';
const username = process.env.RO_SHOWCASE_TEST_USER ?? 'jobtest_thief';
const fixture = JSON.parse(
  await readFile('.local/ro-stack/multiplayer-test-v2-credentials.json', 'utf8'),
);
const profile = mkdtempSync(join(tmpdir(), 'ro-showcase-versioning-'));
const port = 19491;
const browser = spawn(
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { windowsHide: true },
);

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
async function waitFor(read, predicate = Boolean, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  let value;
  while (Date.now() < deadline) {
    value = await read();
    if (predicate(value)) return value;
    await sleep(80);
  }
  throw new Error(`wait timed out: ${JSON.stringify(value)}`);
}

try {
  await waitFor(async () => {
    try {
      return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok;
    } catch {
      return false;
    }
  });
  const target = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {
    method: 'PUT',
  }).then((response) => response.json());
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  const browserErrors = [];
  let requestId = 0;
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
    if (message.method === 'Runtime.exceptionThrown')
      browserErrors.push(message.params?.exceptionDetails?.text ?? 'runtime error');
  };
  await new Promise((resolve) => { socket.onopen = resolve; });
  const call = (method, params = {}) => new Promise((resolve) => {
    const id = ++requestId;
    pending.set(id, resolve);
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const response = await call('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (response.result.exceptionDetails)
      throw new Error(response.result.exceptionDetails.text);
    return response.result.result.value;
  };

  await call('Runtime.enable');
  await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  const startedAt = performance.now();
  await call('Page.navigate', { url: `${origin}/?showcase-versioning-test=1` });
  await waitFor(() => evaluate("typeof document.querySelector('#loginForm')?.onsubmit === 'function'"));
  await evaluate(`(() => {
    document.querySelector('#username').value=${JSON.stringify(username)};
    document.querySelector('#password').value=${JSON.stringify(fixture.password)};
    document.querySelector('#loginForm').requestSubmit();
  })()`);
  await waitFor(() => evaluate("!document.querySelector('#characterSelectForm')?.classList.contains('hidden')"));
  await evaluate("document.querySelector('#characterSelectForm').requestSubmit()");
  await waitFor(() => evaluate("!document.querySelector('#game')?.classList.contains('hidden')"));
  await evaluate("document.querySelector('[data-tab=equipment]').click()");
  await waitFor(() => evaluate("Boolean(characterShowcase?.manifest?.assetVersioning)"));
  await evaluate(`(async () => {
    characterShowcase.character = {
      ...(characterShowcase.character ?? {}),
      classId: 1,
      sex: 'F',
      hair: 1,
    };
    characterShowcase.equipment = [{ itemId: 5583, viewId: 465, slot: 'headTop' }];
    characterShowcase.loadedSignature = '';
    await preloadCharacterShowcase();
    selectShowcaseAction('attack');
  })()`);
  const result = await waitFor(
    () => evaluate(`(() => ({
      body: document.querySelector('#paperdollBodyLayer')?.style.backgroundImage ?? '',
      hair: document.querySelector('#paperdollHairFrontLayer')?.style.backgroundImage ?? '',
      hat: document.querySelector('#paperdollHeadFrontLayer')?.style.backgroundImage ?? '',
      viewportWidth: innerWidth,
      overflow: document.documentElement.scrollWidth - innerWidth,
      hydration: document.querySelector('#game')?.dataset.hydrationState ?? '',
    }))()`),
    (value) => value.body.includes('?v=') && value.hair.includes('?v=') && value.hat.includes('?v='),
    60_000,
  );
  assert.match(result.body, /swordsman-female-attack\.png\?v=[a-f0-9]{16}&b=\d+/i);
  assert.match(result.hair, /female-1-front-attack\.png\?v=[a-f0-9]{16}&b=\d+/i);
  assert.match(result.hat, /view-465-headTop-female-front-attack\.png\?v=[a-f0-9]{16}&b=\d+/i);
  assert.equal(result.viewportWidth, 390);
  assert(result.overflow <= 0, `mobile horizontal overflow: ${result.overflow}`);
  assert.deepEqual(browserErrors, []);
  console.log(JSON.stringify({
    status: 'RO_SHOWCASE_VERSIONING_UI_PASS',
    origin,
    elapsedMs: Number((performance.now() - startedAt).toFixed(1)),
    ...result,
  }, null, 2));
  socket.close();
} finally {
  browser.kill();
}
