import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = process.env.RO_DEMO_ORIGIN ?? 'http://127.0.0.1:8788';
const fixture = JSON.parse(
  await readFile('.local/ro-stack/multiplayer-test-v2-credentials.json', 'utf8'),
);
const profile = mkdtempSync(join(tmpdir(), 'ro-combat-equipment-ui-'));
const port = 19482;
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
async function waitFor(read, predicate = Boolean, timeout = 30000) {
  const deadline = Date.now() + timeout;
  let value;
  while (Date.now() < deadline) {
    value = await read();
    if (predicate(value)) return value;
    await sleep(120);
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
  let requestId = 0;
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
    if (message.method === 'Runtime.exceptionThrown')
      errors.push(message.params?.exceptionDetails?.text ?? 'runtime error');
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
  const evaluate = async (expression) =>
    (
      await call('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      })
    ).result.result.value;

  await call('Runtime.enable');
  await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await call('Page.navigate', { url: origin });
  await waitFor(() => evaluate("typeof document.querySelector('#loginForm')?.onsubmit === 'function'"));
  await evaluate(`(() => {
    document.querySelector('#username').value='jobtest_thief';
    document.querySelector('#password').value=${JSON.stringify(fixture.password)};
    document.querySelector('#loginForm').requestSubmit();
  })()`);
  await waitFor(() => evaluate("!document.querySelector('#characterSelectForm')?.classList.contains('hidden')"));
  await evaluate("document.querySelector('#characterSelectForm').requestSubmit()");
  await waitFor(() => evaluate("!document.querySelector('#game')?.classList.contains('hidden')"));

  const combatText = await waitFor(
    () => evaluate("document.querySelector('#log')?.textContent || ''"),
    (text) => text.includes('[被動技能] 二刀連擊觸發') && /\[HP \d+% · SP \d+%\]/.test(text),
    45000,
  );
  await evaluate("document.querySelector('[data-tab=equipment]').click()");
  const equipment = await waitFor(
    () =>
      evaluate(`(() => ({
        text: document.querySelector('#equipmentInventoryList')?.textContent || '',
        blocked: [...document.querySelectorAll('#equipmentInventoryList .inventory-item')]
          .find((item) => item.dataset.blockedReason)?.dataset.blockedReason || ''
      }))()`),
    (value) => value.blocked === '限定初心者／超級初心者使用',
  );
  const blockedNotice = await evaluate(`(() => {
    const item=[...document.querySelectorAll('#equipmentInventoryList .inventory-item')]
      .find((entry)=>entry.dataset.blockedReason);
    item.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
    return document.querySelector('#equipmentItemNotice').textContent.trim();
  })()`);
  await evaluate(
    "document.querySelector('#equipmentInventoryList').scrollIntoView({block:'start'})",
  );
  const equipmentScreenshot = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile(
    'tmp/novice-equipment-restriction-mobile.png',
    Buffer.from(equipmentScreenshot.result.data, 'base64'),
  );
  await evaluate("document.querySelector('[data-tab=skills]').click()");
  const passiveBadge = await waitFor(
    () =>
      evaluate(`([...document.querySelectorAll('#skillList .skill-entry')]
        .find((entry)=>entry.textContent.includes('TF_DOUBLE'))
        ?.querySelector('.skill-passive-state')?.textContent || '')`),
    (value) => value.includes('戰鬥 Log 顯示'),
  );
  await evaluate("document.querySelector('[data-tab=hunt]').click();document.querySelector('#log').scrollIntoView({block:'start'})");
  const screenshot = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile(
    'tmp/combat-passive-hp-sp-mobile.png',
    Buffer.from(screenshot.result.data, 'base64'),
  );

  const pass =
    combatText.includes('[被動技能] 二刀連擊觸發') &&
    /\[HP \d+% · SP \d+%\]/.test(combatText) &&
    equipment.blocked === '限定初心者／超級初心者使用' &&
    blockedNotice === '限定初心者／超級初心者使用' &&
    passiveBadge.includes('戰鬥 Log 顯示') &&
    errors.length === 0;
  console.log(
    JSON.stringify(
      {
        result: pass ? 'COMBAT_EQUIPMENT_UI_PASS' : 'COMBAT_EQUIPMENT_UI_FAIL',
        viewport: '390x844',
        hpSpLabeled: /\[HP \d+% · SP \d+%\]/.test(combatText),
        doubleAttackVisible: combatText.includes('[被動技能] 二刀連擊觸發'),
        equipmentRestriction: equipment.blocked,
        blockedNotice,
        passiveBadge,
        screenshots: [
          'tmp/combat-passive-hp-sp-mobile.png',
          'tmp/novice-equipment-restriction-mobile.png',
        ],
        errors,
      },
      null,
      2,
    ),
  );
  if (!pass) throw new Error('combat and equipment UI validation failed');
  await call('Browser.close');
} finally {
  browser.kill();
}
