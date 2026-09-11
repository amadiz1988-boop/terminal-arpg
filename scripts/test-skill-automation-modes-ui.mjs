import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = process.env.RO_DEMO_ORIGIN ?? 'http://127.0.0.1:8788';
const fixture = JSON.parse(
  await readFile('.local/ro-stack/multiplayer-test-v2-credentials.json', 'utf8'),
);
const scenarios = [
  {
    username: 'jobtest_swordman',
    handle: 'SM_MAGNUM',
    skillId: 7,
    expectedLevel: 5,
    skillName: '怒爆',
    controlLabel: '自動範圍攻擊',
    mode: 'attack',
    slot: 'attack',
    selfTarget: true,
    rawPattern: 'You use Magnum Break on yourself (Lv: 5)',
    localized: '[主動技能] 怒爆 Lv.5 · 以自身為中心施放',
    screenshot: 'tmp/skill-range-mobile.png',
  },
  {
    username: 'jobtest_acolyte',
    handle: 'AL_HEAL',
    skillId: 28,
    expectedLevel: 5,
    skillName: '治癒術',
    controlLabel: '自動恢復',
    mode: 'selfRecovery',
    slot: 'self',
    selfTarget: false,
    rawPattern: 'You use Heal on yourself (Gained:',
    localized: '[主動技能] 治癒術 · 自身恢復',
    screenshot: 'tmp/skill-recovery-mobile.png',
  },
  {
    username: 'jobtest_archer',
    handle: 'AC_CONCENTRATION',
    skillId: 45,
    expectedLevel: 10,
    skillName: '心神凝聚',
    controlLabel: '自動維持',
    mode: 'selfBuff',
    slot: 'buff',
    selfTarget: false,
    rawPattern: 'You use Improve Concentration on yourself (Lv: 10)',
    localized: '[輔助技能] 心神凝聚 Lv.10 · 自動維持狀態',
    screenshot: 'tmp/skill-buff-mobile.png',
  },
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const scenarioFilter = String(process.env.RO_SKILL_MODE_SCENARIO ?? '').trim();
const selectedScenarios = scenarioFilter
  ? scenarios.filter((scenario) => scenario.handle === scenarioFilter)
  : scenarios;
if (!selectedScenarios.length)
  throw new Error(`unknown skill mode scenario: ${scenarioFilter}`);

async function waitFor(read, predicate = Boolean, timeout = 35000) {
  const deadline = Date.now() + timeout;
  let value;
  while (Date.now() < deadline) {
    value = await read();
    if (predicate(value)) return value;
    await sleep(150);
  }
  throw new Error(`wait timed out: ${JSON.stringify(value)}`);
}

async function runScenario(scenario, index) {
  const profile = mkdtempSync(join(tmpdir(), 'ro-skill-mode-ui-'));
  const port = 19520 + index;
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
    const target = await fetch(
      `http://127.0.0.1:${port}/json/new?about:blank`,
      { method: 'PUT' },
    ).then((response) => response.json());
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
      evaluate("typeof document.querySelector('#loginForm')?.onsubmit === 'function'"),
    );
    await evaluate(`(() => {
      document.querySelector('#username').value=${JSON.stringify(scenario.username)};
      document.querySelector('#password').value=${JSON.stringify(fixture.password)};
      document.querySelector('#loginForm').requestSubmit();
    })()`);
    await waitFor(() =>
      evaluate("!document.querySelector('#characterSelectForm')?.classList.contains('hidden')"),
    );
    await evaluate("document.querySelector('#characterSelectForm').requestSubmit()");
    await waitFor(() =>
      evaluate("!document.querySelector('#game')?.classList.contains('hidden')"),
    );
    await evaluate(`fetch('/api/skill-automation', {
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({mode:${JSON.stringify(scenario.mode)},enabled:false})
    })`);
    await waitFor(
      () =>
        evaluate(
          `fetch('/api/events').then(r=>r.json()).then(v=>v.live?.skillAutomation?.${scenario.slot} ?? null)`,
        ),
      (value) => value === null,
    );
    const before = await waitFor(
      () =>
        evaluate(
          "fetch('/api/events').then(r=>r.json()).then(v=>({cursor:v.cursor,hp:v.live?.hp,sp:v.live?.sp,updatedAt:v.live?.updatedAt}))",
        ),
      (value) =>
        Date.now() - Number(value.updatedAt) < 5000 && Number(value.hp) > 0,
    );
    await evaluate("document.querySelector('[data-tab=skills]').click()");
    const rowText = await waitFor(
      () =>
        evaluate(
          `document.querySelector('[data-skill-automation-row="${scenario.handle}"]')?.closest('.skill-entry')?.textContent || ''`,
        ),
      (text) =>
        text.includes(scenario.skillName) && text.includes(scenario.controlLabel),
    );
    await evaluate(`(() => {
      const row=document.querySelector('[data-skill-automation-row="${scenario.handle}"]');
      const minimum=row.querySelector('[data-skill-auto-setting="minimumSp"]');
      if(minimum) minimum.value='20';
      const hp=row.querySelector('[data-skill-auto-setting="hpBelow"]');
      if(hp) hp.value='70';
      const toggle=row.querySelector('input[type="checkbox"]');
      toggle.checked=true;
      toggle.dispatchEvent(new Event('change',{bubbles:true}));
    })()`);
    const observed = await waitFor(
      () =>
        evaluate(`fetch('/api/events?cursor=${before.cursor}').then(r=>r.json()).then(v=>({
          lines:v.lines || [],hp:v.live?.hp,sp:v.live?.sp,
          automation:v.live?.skillAutomation?.${scenario.slot} ?? null
        }))`),
      (value) =>
        value.automation?.handle === scenario.handle &&
        value.lines.some((line) => line.includes(scenario.rawPattern)) &&
        Number(value.sp) < Number(before.sp),
      45000,
    );
    const localizedLog = await waitFor(
      () => evaluate("document.querySelector('#log')?.textContent || ''"),
      (text) => text.includes(scenario.localized),
    );
    await evaluate(`(() => {
      document.querySelector('[data-tab=skills]').click();
      document.querySelector('[data-skill-automation-row="${scenario.handle}"]')
        ?.scrollIntoView({block:'center'});
    })()`);
    const screenshot = await call('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    await writeFile(
      scenario.screenshot,
      Buffer.from(screenshot.result.data, 'base64'),
    );
    await waitFor(() =>
      evaluate(`(() => {
        const toggle=document.querySelector('[data-skill-automation-row="${scenario.handle}"] input[type="checkbox"]');
        return Boolean(toggle && toggle.checked && !toggle.disabled);
      })()`),
    );
    await evaluate(`(() => {
      const toggle=document.querySelector('[data-skill-automation-row="${scenario.handle}"] input[type="checkbox"]');
      toggle.checked=false;
      toggle.dispatchEvent(new Event('change',{bubbles:true}));
    })()`);
    const disabled = await waitFor(
      () =>
        evaluate(
          `fetch('/api/events').then(r=>r.json()).then(v=>v.live?.skillAutomation?.${scenario.slot} ?? null)`,
        ),
      (value) => value === null,
    );
    const rawLine = observed.lines.find((line) =>
      line.includes(scenario.rawPattern),
    );
    const pass =
      rowText.includes(scenario.controlLabel) &&
      observed.automation.handle === scenario.handle &&
      observed.automation.level === scenario.expectedLevel &&
      observed.automation.minimumSp === 20 &&
      observed.automation.selfTarget === scenario.selfTarget &&
      (scenario.mode !== 'selfRecovery' ||
        observed.automation.hpBelow === 70) &&
      localizedLog.includes(scenario.localized) &&
      rawLine &&
      Number(observed.sp) < Number(before.sp) &&
      disabled === null &&
      errors.length === 0;
    return {
      result: pass ? 'PASS' : 'FAIL',
      username: scenario.username,
      skill: observed.automation,
      rawLine,
      localized: scenario.localized,
      hpBefore: before.hp,
      hpAfter: observed.hp,
      spBefore: before.sp,
      spAfter: observed.sp,
      disabledAfterTest: disabled === null,
      screenshot: scenario.screenshot,
      errors,
    };
  } finally {
    if (evaluate) {
      await evaluate(`fetch('/api/skill-automation', {
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({mode:${JSON.stringify(scenario.mode)},enabled:false})
      }).catch(()=>{})`).catch(() => {});
    }
    socket?.close();
    browser.kill();
  }
}

const results = [];
for (let index = 0; index < selectedScenarios.length; index += 1)
  results.push(await runScenario(selectedScenarios[index], index));
const pass = results.every((result) => result.result === 'PASS');
console.log(
  JSON.stringify(
    {
      result: pass ? 'SKILL_AUTOMATION_MODES_UI_PASS' : 'SKILL_AUTOMATION_MODES_UI_FAIL',
      viewport: '390x844',
      results,
    },
    null,
    2,
  ),
);
if (!pass) throw new Error('skill automation modes UI validation failed');
