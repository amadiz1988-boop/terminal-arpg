import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = process.env.RO_DEMO_ORIGIN ?? 'http://127.0.0.1:8788';
const fixture = JSON.parse(
  await readFile(
    '.local/ro-stack/multiplayer-test-v2-credentials.json',
    'utf8',
  ),
);
const profile = mkdtempSync(join(tmpdir(), 'ro-supply-cycle-ui-'));
const port = 19640;
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
async function waitFor(read, predicate = Boolean, timeout = 240_000) {
  const deadline = Date.now() + timeout;
  let value;
  while (Date.now() < deadline) {
    value = await read();
    if (predicate(value)) return value;
    await sleep(150);
  }
  throw new Error(`wait timed out: ${JSON.stringify(value)}`);
}

let socket;
let evaluate;
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
  socket = new WebSocket(target.webSocketDebuggerUrl);
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
  evaluate = async (expression) =>
    (
      await call('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      })
    ).result.result.value;
  const click = async (selector) => {
    const point = await waitFor(
      () =>
        evaluate(`(() => {
          const node=document.querySelector(${JSON.stringify(selector)});
          if(!node || node.disabled) return null;
          const rect=node.getBoundingClientRect();
          return rect.width>0&&rect.height>0?{x:rect.left+rect.width/2,y:rect.top+rect.height/2}:null;
        })()`),
      Boolean,
      50_000,
    );
    for (const type of ['mousePressed', 'mouseReleased'])
      await call('Input.dispatchMouseEvent', {
        type,
        x: point.x,
        y: point.y,
        button: 'left',
        clickCount: 1,
      });
  };

  await call('Runtime.enable');
  await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await call('Page.navigate', { url: origin });
  await waitFor(() =>
    evaluate(
      "typeof document.querySelector('#loginForm')?.onsubmit === 'function'",
    ),
  );
  await evaluate(`(() => {
    document.querySelector('#username').value='jobtest_merchant';
    document.querySelector('#password').value=${JSON.stringify(fixture.password)};
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
  const before = await waitFor(
    () =>
      evaluate(`fetch('/api/events').then(r=>r.json()).then(v=>({
        cursor:v.cursor,weight:v.live?.weight,maxWeight:v.live?.maxWeight,
        map:v.live?.map,updatedAt:v.live?.updatedAt
      }))`),
    (value) => Date.now() - Number(value.updatedAt) < 5_000,
  );
  await waitFor(() =>
    evaluate(
      'Boolean(document.querySelector(\'[data-supply-item-id="909"]\'))',
    ),
  );
  await evaluate(`(() => {
    const form=document.querySelector('#supplyForm');
    form.scrollIntoView({block:'start'});
    document.querySelector('#supplyEnabled').checked=true;
    document.querySelector('#supplyWeight').value='40';
    document.querySelector('#supplyStore').checked=true;
    document.querySelector('#supplySell').checked=true;
    document.querySelector('#supplyBuy').checked=true;
    document.querySelector('#redPotionMin').value='99';
    document.querySelector('#redPotionMax').value='100';
    const jellopy=document.querySelector('[data-supply-item-id="909"]');
    if(jellopy) jellopy.value='sell';
  })()`);
  await click('#saveSupply');
  const applied = await waitFor(
    () =>
      evaluate(`fetch('/api/state').then(r=>r.json()).then(v=>({
        notice:document.querySelector('#supplyNotice')?.textContent||'',
        settings:v.supplyCycle,live:v.derived?.supplyCycle,
        width:document.documentElement.scrollWidth,viewport:innerWidth
      }))`),
    (value) => value.settings?.enabled && value.live?.enabled,
    60_000,
  );
  const instanceConfigs = await import('node:fs/promises').then(({ readdir }) =>
    readdir('.local/ro-stack/instances', { withFileTypes: true }),
  );
  let buyGuard = null;
  for (const entry of instanceConfigs) {
    if (!entry.isDirectory()) continue;
    const config = await readFile(
      join('.local/ro-stack/instances', entry.name, 'control', 'config.txt'),
      'utf8',
    ).catch(() => '');
    if (!/^username jobtest_merchant$/m.test(config)) continue;
    const block = config.match(/^buyAuto\s+501\s*\{[\s\S]*?^\}/m)?.[0] ?? '';
    buyGuard = {
      price: /^\s*price 10$/m.test(block),
      zeny: /^\s*zeny >= 10$/m.test(block),
    };
    break;
  }

  const observedStages = [];
  const completed = await waitFor(
    async () => {
      const value =
        await evaluate(`fetch('/api/events?cursor=${before.cursor}').then(r=>r.json()).then(v=>({
        lines:v.lines||[],map:v.live?.map,weight:v.live?.weight,
        maxWeight:v.live?.maxWeight,stage:v.live?.supplyCycle?.stage||'',
        redPotions:(v.live?.inventory||[]).filter(i=>Number(i.itemId)===501)
          .reduce((total,i)=>total+Number(i.amount||0),0)
      }))`);
      if (value.stage && observedStages.at(-1) !== value.stage)
        observedStages.push(value.stage);
      return value;
    },
    (value) => {
      const text = value.lines.join('\n');
      return (
        /Auto-storaging due to itemsMaxWeight/.test(text) &&
        /Auto-storage sequence completed/.test(text) &&
        /Auto-sell sequence completed/.test(text) &&
        /Auto-buy sequence completed/.test(text) &&
        value.map === 'prt_fild08' &&
        Number(value.redPotions) >= 99 &&
        Number(value.redPotions) <= 100 &&
        Number(value.weight) / Number(value.maxWeight) < 0.4
      );
    },
  );
  await evaluate(
    "document.querySelector('#supplyForm').scrollIntoView({block:'start'})",
  );
  await sleep(400);
  const screenshot = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile(
    'tmp/supply-cycle-mobile.png',
    Buffer.from(screenshot.result.data, 'base64'),
  );
  const sellStage = observedStages.indexOf('sellAuto'),
    buyStage = observedStages.indexOf('buyAuto'),
    storageStage = observedStages.indexOf('storageAuto'),
    orderedSupplyStages =
      sellStage >= 0 && buyStage > sellStage && storageStage > buyStage;
  const pass =
    before.map === 'prt_fild08' &&
    Number(before.weight) / Number(before.maxWeight) >= 0.4 &&
    applied.notice.includes('設定已生效') &&
    applied.settings.rules.some(
      (rule) => Number(rule.itemId) === 909 && rule.action === 'sell',
    ) &&
    applied.width <= applied.viewport &&
    buyGuard?.price === true &&
    buyGuard?.zeny === true &&
    orderedSupplyStages &&
    completed.map === 'prt_fild08' &&
    errors.length === 0;
  console.log(
    JSON.stringify(
      {
        result: pass ? 'SUPPLY_CYCLE_UI_PASS' : 'SUPPLY_CYCLE_UI_FAIL',
        viewport: '390x844',
        before,
        applied,
        buyGuard,
        observedStages,
        orderedSupplyStages,
        after: {
          map: completed.map,
          weight: completed.weight,
          maxWeight: completed.maxWeight,
          redPotions: completed.redPotions,
        },
        evidence: completed.lines.filter((line) =>
          /Auto-(?:storaging|storage|sell|buy)/.test(line),
        ),
        screenshot: 'tmp/supply-cycle-mobile.png',
        errors,
      },
      null,
      2,
    ),
  );
  if (!pass) process.exitCode = 1;
} finally {
  if (evaluate)
    await evaluate(`fetch('/api/supply-cycle',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({...${JSON.stringify({
        enabled: false,
        returnWeight: 75,
        store: true,
        sell: true,
        buy: true,
        redPotionMin: 20,
        redPotionMax: 100,
        rules: [],
      })}})
    }).catch(()=>{})`).catch(() => {});
  socket?.close();
  browser.kill();
}
