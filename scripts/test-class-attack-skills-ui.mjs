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
const scenarios = [
  {
    username: 'jobtest_mage',
    handle: 'MG_FIREBOLT',
    skillName: '火箭術',
    englishName: 'Fire Bolt',
    level: 5,
    resource: '每次施放：SP 20',
    metric: 'sp',
    screenshot: 'tmp/attack-skill-mage-mobile.png',
  },
  {
    username: 'jobtest_archer',
    handle: 'AC_DOUBLE',
    skillName: '二連矢',
    englishName: 'Double Strafe',
    level: 5,
    resource: '每次施放：SP 12 · 裝備 弓 · 已裝備 箭矢 × 1',
    metric: 'ammo',
    screenshot: 'tmp/attack-skill-archer-mobile.png',
  },
  {
    username: 'jobtest_merchant',
    handle: 'MC_MAMMONITE',
    skillName: '金錢攻擊',
    englishName: 'Mammonite',
    level: 5,
    resource: '每次施放：SP 5 · Zeny 500',
    metric: 'zeny',
    screenshot: 'tmp/attack-skill-merchant-mobile.png',
  },
  {
    username: 'jobtest_thief',
    handle: 'TF_POISON',
    skillName: '施毒',
    englishName: 'Envenom',
    level: 5,
    resource: '每次施放：SP 12',
    metric: 'sp',
    screenshot: 'tmp/attack-skill-thief-mobile.png',
  },
];
const filter = String(process.env.RO_ATTACK_SKILL_SCENARIO ?? '').trim();
const selected = filter
  ? scenarios.filter((scenario) => scenario.handle === filter)
  : scenarios;
if (!selected.length) throw new Error(`unknown scenario: ${filter}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(read, predicate = Boolean, timeout = 50000) {
  const deadline = Date.now() + timeout;
  let value;
  while (Date.now() < deadline) {
    value = await read();
    if (predicate(value)) return value;
    await sleep(100);
  }
  throw new Error(`wait timed out: ${JSON.stringify(value)}`);
}

async function runScenario(scenario, index) {
  const profile = mkdtempSync(join(tmpdir(), 'ro-class-attack-ui-'));
  const port = 19610 + index;
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
    const click = async (selector) => {
      const point = await waitFor(
        () =>
          evaluate(`(() => {
            const node=document.querySelector(${JSON.stringify(selector)});
            if(!node || node.disabled) return null;
            const rect=node.getBoundingClientRect();
            return rect.width>0 && rect.height>0
              ? {x:rect.left+rect.width/2,y:rect.top+rect.height/2}
              : null;
          })()`),
        Boolean,
      );
      await call('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: point.x,
        y: point.y,
        button: 'left',
        clickCount: 1,
      });
      await call('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: point.x,
        y: point.y,
        button: 'left',
        clickCount: 1,
      });
    };

    await call('Runtime.enable');
    await call('Page.enable');
    await call('Page.addScriptToEvaluateOnNewDocument', {
      source: `window.__combatSoundEvents=[];document.addEventListener('ro-combat-sound',event=>window.__combatSoundEvents.push(event.detail));`,
    });
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
      document.querySelector('#username').value=${JSON.stringify(scenario.username)};
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
      evaluate(
        "!document.querySelector('#game')?.classList.contains('hidden')",
      ),
    );
    await evaluate(`fetch('/api/skill-automation',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({mode:'attack',enabled:false})
    })`);
    await waitFor(
      () =>
        evaluate(
          "fetch('/api/events').then(r=>r.json()).then(v=>v.live?.skillAutomation?.attack ?? null)",
        ),
      (value) => value === null,
    );
    const before = await waitFor(
      () =>
        evaluate(`fetch('/api/events').then(r=>r.json()).then(v=>({
          cursor:v.cursor,sp:v.live?.sp,zeny:v.live?.zeny,
          ammo:(v.live?.inventory||[]).filter(i=>i.itemType===10).reduce((n,i)=>n+Number(i.amount),0),
          updatedAt:v.live?.updatedAt
        }))`),
      (value) => Date.now() - Number(value.updatedAt) < 5000,
    );
    await click('[data-tab="skills"]');
    const selector = `[data-skill-automation-row="${scenario.handle}"]`;
    const row = await waitFor(
      () =>
        evaluate(`(() => {
          const control=document.querySelector(${JSON.stringify(selector)});
          const entry=control?.closest('.skill-entry');
          const toggle=control?.querySelector('input[type="checkbox"]');
          const resource=control?.querySelector('[data-skill-resource]');
          if(!entry || !toggle || !resource) return null;
          const rect=entry.getBoundingClientRect();
          return {text:entry.textContent,resource:resource.textContent,toggleDisabled:toggle.disabled,
            width:rect.width,viewportWidth:document.documentElement.clientWidth,
            overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
        })()`),
      (value) =>
        value?.text.includes(scenario.skillName) &&
        value.resource === scenario.resource,
    );
    await evaluate(
      `document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`,
    );
    await click(`${selector} input[type="checkbox"]`);
    const observed = await waitFor(
      () =>
        evaluate(`fetch('/api/events?cursor=${before.cursor}').then(r=>r.json()).then(v=>({
          lines:v.lines||[],sp:v.live?.sp,zeny:v.live?.zeny,
          ammo:(v.live?.inventory||[]).filter(i=>i.itemType===10).reduce((n,i)=>n+Number(i.amount),0),
          automation:v.live?.skillAutomation?.attack??null
        }))`),
      (value) => {
        const metricChanged =
          scenario.metric === 'sp'
            ? Number(value.sp) < Number(before.sp)
            : scenario.metric === 'zeny'
              ? Number(value.zeny) < Number(before.zeny)
              : Number(value.ammo) < Number(before.ammo);
        return (
          value.automation?.handle === scenario.handle &&
          metricChanged &&
          value.lines.some((line) =>
            line.includes(`You use ${scenario.englishName}`),
          )
        );
      },
    );
    await click('[data-tab="hunt"]');
    await evaluate(`(() => {
      const combat=document.querySelector('.combat-window');
      window.scrollTo(0,combat.getBoundingClientRect().top+window.scrollY-52);
    })()`);
    const presentation = await waitFor(
      () =>
        evaluate(`(() => {
          const float=document.querySelector('.damage-float.segment,.damage-float.critical');
          const sounds=window.__combatSoundEvents.filter(event=>event.key==='attack'&&event.started);
          if(!float || !sounds.length) return null;
          return {floatEventId:float.dataset.combatEventId,sounds,
            synced:sounds.some(event=>event.combatEventId===float.dataset.combatEventId),
            log:document.querySelector('#log')?.textContent||''};
        })()`),
      (value) =>
        value?.synced &&
        value.log.includes(
          `[主動技能] ${scenario.skillName} Lv.${scenario.level}`,
        ),
    );
    await click('[data-tab="skills"]');
    await evaluate(
      `document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`,
    );
    const shot = await call('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    await writeFile(
      scenario.screenshot,
      Buffer.from(shot.result.data, 'base64'),
    );
    await click(`${selector} input[type="checkbox"]`);
    const disabled = await waitFor(
      () =>
        evaluate(
          "fetch('/api/events').then(r=>r.json()).then(v=>v.live?.skillAutomation?.attack ?? null)",
        ),
      (value) => value === null,
    );
    const metricChanged =
      scenario.metric === 'sp'
        ? Number(observed.sp) < Number(before.sp)
        : scenario.metric === 'zeny'
          ? Number(observed.zeny) < Number(before.zeny)
          : Number(observed.ammo) < Number(before.ammo);
    const pass =
      !row.toggleDisabled &&
      row.overflow === 0 &&
      observed.automation?.handle === scenario.handle &&
      Number(observed.automation?.level) === scenario.level &&
      metricChanged &&
      presentation.synced &&
      disabled === null &&
      errors.length === 0;
    return {
      result: pass ? 'PASS' : 'FAIL',
      username: scenario.username,
      handle: scenario.handle,
      resource: row.resource,
      rawLine: observed.lines.find((line) =>
        line.includes(`You use ${scenario.englishName}`),
      ),
      before,
      after: { sp: observed.sp, zeny: observed.zeny, ammo: observed.ammo },
      metricChanged,
      soundAndFloatSynced: presentation.synced,
      soundBackends: [
        ...new Set(presentation.sounds.map((entry) => entry.backend)),
      ],
      disabledAfterTest: disabled === null,
      screenshot: scenario.screenshot,
      errors,
    };
  } finally {
    if (evaluate)
      await evaluate(`fetch('/api/skill-automation',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({mode:'attack',enabled:false})
      }).catch(()=>{})`).catch(() => {});
    socket?.close();
    browser.kill();
  }
}

const results = [];
for (let index = 0; index < selected.length; index += 1)
  results.push(await runScenario(selected[index], index));
const pass = results.every((result) => result.result === 'PASS');
console.log(
  JSON.stringify(
    {
      result: pass
        ? 'CLASS_ATTACK_SKILLS_UI_PASS'
        : 'CLASS_ATTACK_SKILLS_UI_FAIL',
      viewport: '390x844',
      results,
    },
    null,
    2,
  ),
);
if (!pass) throw new Error('class attack skills UI validation failed');
