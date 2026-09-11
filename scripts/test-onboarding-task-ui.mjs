import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = process.env.RO_DEMO_ORIGIN ?? 'http://127.0.0.1:8788';
const username = process.env.RO_TEST_ACCOUNT_USERNAME;
const password = process.env.RO_TEST_ACCOUNT_PASSWORD;
if (!username || !password)
  throw new Error('Set RO_TEST_ACCOUNT_USERNAME and RO_TEST_ACCOUNT_PASSWORD');

const profile = mkdtempSync(join(tmpdir(), 'ro-onboarding-task-ui-'));
const port = 19476;
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(read, predicate = Boolean, timeout = 20000) {
  const deadline = Date.now() + timeout;
  let value;
  while (Date.now() < deadline) {
    value = await read();
    if (predicate(value)) return value;
    await sleep(100);
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
  const errors = [];
  const failedResources = [];
  let requestId = 0;
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
    if (message.method === 'Runtime.exceptionThrown')
      errors.push(message.params?.exceptionDetails?.text ?? 'runtime error');
    if (
      message.method === 'Log.entryAdded' &&
      message.params?.entry?.level === 'error'
    )
      errors.push(message.params.entry.text);
    if (
      message.method === 'Network.responseReceived' &&
      Number(message.params?.response?.status) >= 400
    )
      failedResources.push({
        status: Number(message.params.response.status),
        url: message.params.response.url,
      });
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
  await call('Log.enable');
  await call('Page.enable');
  await call('Network.enable');
  await call('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await call('Page.navigate', { url: origin });
  await waitFor(() =>
    evaluate(
      "typeof document.querySelector('#loginForm')?.onsubmit === 'function' && document.querySelector('#loginServerStatus')?.textContent === '伺服器正常'",
    ),
  );
  await evaluate(`(() => {
    const username=document.querySelector('#username');
    const password=document.querySelector('#password');
    username.value=${JSON.stringify(username)};
    password.value=${JSON.stringify(password)};
    username.dispatchEvent(new Event('input',{bubbles:true}));
    password.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('#loginForm').requestSubmit();
  })()`);
  await waitFor(() =>
    evaluate(
      "!document.querySelector('#characterSelectForm')?.classList.contains('hidden')",
    ),
  );
  await evaluate(
    "document.querySelector('#characterSelectForm').requestSubmit()",
  );
  await waitFor(() =>
    evaluate("!document.querySelector('#game')?.classList.contains('hidden')"),
  );
  await evaluate("document.querySelector('[data-tab=quests]').click()");
  const result = await waitFor(
    () =>
      evaluate(`(() => {
        const rows=[...document.querySelectorAll('#questDetail .task-log-entry')];
        const detail=document.querySelector('#questDetail');
        const text=detail?.textContent || '';
        return {
          rowCount:rows.length,
          types:[...new Set(rows.map((row)=>[...row.classList].find((name)=>name!=='task-log-entry')))].filter(Boolean),
          text,
          baseExp:document.querySelector('#baseExp')?.textContent || '',
          jobExp:document.querySelector('#jobExp')?.textContent || '',
          pageWidth:document.documentElement.scrollWidth,
          viewportWidth:innerWidth,
          backgroundColor:getComputedStyle(detail).backgroundColor,
          fontFamily:getComputedStyle(detail).fontFamily,
        };
      })()`),
    (value) => value?.rowCount > 2 && value.baseExp.includes('尚差'),
    30000,
  );
  await evaluate(
    "document.querySelector('#quests').scrollIntoView({block:'start'})",
  );
  const taskScreenshot = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile(
    'tmp/onboarding-task-log-mobile.png',
    Buffer.from(taskScreenshot.result.data, 'base64'),
  );
  await evaluate("document.querySelector('[data-tab=equipment]').click()");
  const equipmentText = await waitFor(
    () =>
      evaluate(
        "document.querySelector('#equipmentInventoryList')?.textContent?.replace(/\\s+/g,' ').trim() || ''",
      ),
    (value) => value.includes('新手專用笨拙短劍'),
    10000,
  );
  const localizedRewards = ['新手專用笨拙短劍', '克里圖拉學院帽', '棉襯衫'];
  const englishRewardPattern =
    /\b(?:Novice|Cryptura|Academy|Knife|Plate|Hood|Boots|Guard|Club)\b/i;
  const equipmentScreenshot = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile(
    'tmp/onboarding-equipment-mobile.png',
    Buffer.from(equipmentScreenshot.result.data, 'base64'),
  );
  const expPattern = /^\d[\d,]* \/ \d[\d,]* EXP · \d+\.\d{2}% · 尚差 \d[\d,]*$/;
  const pass =
    result.rowCount > 2 &&
    result.types.includes('action') &&
    result.types.includes('dialog') &&
    expPattern.test(result.baseExp) &&
    expPattern.test(result.jobExp) &&
    !/你攻擊|攻擊你|Dmg:|Delay:/.test(result.text) &&
    !result.text.includes('�') &&
    !/Shall we|All right|Welcome to|Congratulations|Your selected vocation/.test(
      result.text,
    ) &&
    result.text.includes('普隆德拉原野 08') &&
    result.backgroundColor === 'rgb(3, 6, 3)' &&
    /Consolas/.test(result.fontFamily) &&
    result.pageWidth <= result.viewportWidth &&
    localizedRewards.every((name) => equipmentText.includes(name)) &&
    !englishRewardPattern.test(equipmentText) &&
    failedResources.length === 0 &&
    errors.length === 0;
  console.log(
    JSON.stringify(
      {
        result: pass ? 'ONBOARDING_TASK_UI_PASS' : 'ONBOARDING_TASK_UI_FAIL',
        viewport: '390x844',
        evidence: result,
        equipmentLocalization: {
          expected: localizedRewards,
          text: equipmentText,
          unexpectedEnglish: englishRewardPattern.test(equipmentText),
        },
        screenshots: [
          'tmp/onboarding-task-log-mobile.png',
          'tmp/onboarding-equipment-mobile.png',
        ],
        failedResources,
        errors,
      },
      null,
      2,
    ),
  );
  if (!pass) process.exitCode = 1;
} finally {
  browser.kill();
}
