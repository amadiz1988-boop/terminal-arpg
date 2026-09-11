import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = process.env.RO_DEMO_ORIGIN ?? 'http://127.0.0.1:8788';
const fixture = JSON.parse(
  await readFile('.local/ro-stack/multiplayer-test-v2-credentials.json', 'utf8'),
);
const profile = mkdtempSync(join(tmpdir(), 'ro-skill-automation-ui-'));
const port = 19483;
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
    document.querySelector('#username').value='jobtest_swordman';
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
    method:'POST', headers:{'content-type':'application/json'},
    body:JSON.stringify({mode:'attack',enabled:false})
  })`);
  await waitFor(
    () => evaluate("fetch('/api/events').then(r=>r.json()).then(v=>v.live?.skillAutomation?.attack ?? null)"),
    (value) => value === null,
  );
  const before = await waitFor(
    () =>
      evaluate(
        "fetch('/api/events').then(r=>r.json()).then(v=>({sp:v.live?.sp,cursor:v.cursor,updatedAt:v.live?.updatedAt}))",
      ),
    (value) =>
      Number.isFinite(Number(value.sp)) &&
      Number.isFinite(Number(value.updatedAt)) &&
      Date.now() - Number(value.updatedAt) < 5000,
  );

  await evaluate("document.querySelector('[data-tab=skills]').click()");
  const row = await waitFor(
    () =>
      evaluate(`(() => ({
        rowText: document.querySelector('[data-skill-automation-row="SM_BASH"]')?.parentElement?.textContent || '',
        listText: document.querySelector('#skillList')?.textContent || '',
        skillNotice: document.querySelector('#skillNotice')?.textContent || '',
        selectError: document.querySelector('#characterSelectError')?.textContent || ''
      }))()`),
    (value) =>
      value.rowText.includes('狂擊') && value.rowText.includes('自動攻擊'),
    45000,
  );
  await evaluate(`(() => {
    const description=document.querySelector('[data-skill-automation-row="SM_BASH"]')
      ?.closest('.skill-entry')?.querySelector('.skill-description');
    description?.querySelector('summary')?.click();
    return description?.open ?? false;
  })()`);
  await sleep(2200);
  const skillDescription = await evaluate(`(() => {
    const description=document.querySelector('[data-skill-automation-row="SM_BASH"]')
      ?.closest('.skill-entry')?.querySelector('.skill-description');
    return {
      open: description?.open ?? false,
      text: description?.querySelector('p')?.textContent || ''
    };
  })()`);
  await evaluate("document.querySelector('[data-tab=mapInfo]').click()");
  await waitFor(
    () => evaluate("document.querySelectorAll('#mapMonsterList .monster-entry').length"),
    (count) => Number(count) > 0,
  );
  await evaluate(`(() => {
    const monster=document.querySelector('#mapMonsterList .monster-entry');
    monster.querySelector(':scope > summary').click();
    const drop=monster.querySelector('.drop-entry');
    drop?.querySelector(':scope > summary')?.click();
  })()`);
  await evaluate("document.querySelector('[data-tab=mapInfo]').click()");
  await sleep(500);
  const mapDisclosures = await evaluate(`(() => {
    const monster=document.querySelector('#mapMonsterList .monster-entry');
    const drop=monster?.querySelector('.drop-entry');
    return {monsterOpen:monster?.open ?? false,dropOpen:drop?.open ?? false};
  })()`);
  await evaluate("document.querySelector('[data-tab=skills]').click()");
  await evaluate(`(() => {
    const toggle=document.querySelector('[data-skill-automation-row="SM_BASH"] input[type="checkbox"]');
    toggle.checked=true;
    toggle.dispatchEvent(new Event('change',{bubbles:true}));
  })()`);
  const live = await waitFor(
    () =>
      evaluate("fetch('/api/events').then(r=>r.json()).then(v=>v.live ?? null)"),
    (value) => value?.skillAutomation?.attack?.handle === 'SM_BASH',
  );
  const cast = await waitFor(
    () =>
      evaluate(`fetch('/api/events?cursor=${before.cursor}').then(r=>r.json()).then(v=>({
        lines:v.lines || [], sp:v.live?.sp, hp:v.live?.hp,
        automation:v.live?.skillAutomation?.attack ?? null
      }))`),
    (value) => {
      const skillSp = value.lines
        .filter((line) => /You use Bash \(Lv: 5\)/i.test(line))
        .map((line) => Number(line.match(/^\[\s*\d+\/\s*(\d+)\]/)?.[1]))
        .filter(Number.isFinite);
      return (
        value.automation?.handle === 'SM_BASH' &&
        skillSp.length >= 1 &&
        Number(value.sp) < Number(before.sp)
      );
    },
    45000,
  );
  const notice = await waitFor(
    () => evaluate("document.querySelector('#skillNotice')?.textContent.trim() || ''"),
    (text) => text.includes('掛機技能已生效'),
  );
  await evaluate(
    "document.querySelector('[data-skill-automation-row=\"SM_BASH\"]')?.scrollIntoView({block:'center'})",
  );
  const skillScreenshot = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile(
    'tmp/skill-automation-mobile.png',
    Buffer.from(skillScreenshot.result.data, 'base64'),
  );
  await evaluate("document.querySelector('[data-tab=hunt]').click();document.querySelector('#log').scrollIntoView({block:'center'})");
  const localizedCast = await waitFor(
    () => evaluate("document.querySelector('#log')?.textContent || ''"),
    (text) => text.includes('[主動技能] 狂擊 Lv.5'),
  );
  await evaluate(`(() => {
    const row=[...document.querySelectorAll('#log .event')]
      .reverse().find((entry)=>entry.textContent.includes('[主動技能] 狂擊 Lv.5'));
    row.scrollIntoView({block:'center'});
  })()`);
  const combatScreenshot = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile(
    'tmp/skill-automation-combat-mobile.png',
    Buffer.from(combatScreenshot.result.data, 'base64'),
  );

  await evaluate(`fetch('/api/skill-automation', {
    method:'POST', headers:{'content-type':'application/json'},
    body:JSON.stringify({mode:'attack',enabled:false})
  })`);
  const disabled = await waitFor(
    () => evaluate("fetch('/api/events').then(r=>r.json()).then(v=>v.live?.skillAutomation?.attack ?? null)"),
    (value) => value === null,
  );
  const skillSp = cast.lines
    .filter((line) => /You use Bash \(Lv: 5\)/i.test(line))
    .map((line) => Number(line.match(/^\[\s*\d+\/\s*(\d+)\]/)?.[1]))
    .filter(Number.isFinite);
  const pass =
    row.rowText.includes('狂擊') &&
    skillDescription.open &&
    skillDescription.text.length > 0 &&
    mapDisclosures.monsterOpen &&
    mapDisclosures.dropOpen &&
    live.skillAutomation.attack.level === 5 &&
    skillSp.length >= 1 &&
    Number(cast.sp) < Number(before.sp) &&
    localizedCast.includes('[主動技能] 狂擊 Lv.5') &&
    notice.includes('角色保持在線') &&
    disabled === null &&
    errors.length === 0;
  console.log(
    JSON.stringify(
      {
        result: pass ? 'SKILL_AUTOMATION_UI_PASS' : 'SKILL_AUTOMATION_UI_FAIL',
        viewport: '390x844',
        skill: live.skillAutomation.attack,
        skillDescriptionPersisted: skillDescription,
        mapDisclosuresPersisted: mapDisclosures,
        spBefore: before.sp,
        spAfter: cast.sp,
        skillSpPercentages: skillSp,
        castLine: cast.lines.find((line) => /Bash|狂擊/i.test(line)),
        localizedCastVisible: localizedCast.includes('[主動技能] 狂擊 Lv.5'),
        notice,
        remainedOnline: Number(cast.hp) > 0,
        disabledAfterTest: disabled === null,
        screenshots: [
          'tmp/skill-automation-mobile.png',
          'tmp/skill-automation-combat-mobile.png',
        ],
        errors,
      },
      null,
      2,
    ),
  );
  if (!pass) throw new Error('skill automation UI validation failed');
} finally {
  if (evaluate) {
    await evaluate(`(async()=>{
      await fetch('/api/skill-automation', {
        method:'POST', headers:{'content-type':'application/json'},
        body:JSON.stringify({mode:'attack',enabled:false})
      }).catch(()=>{});
      const deadline=Date.now()+5000;
      while(Date.now()<deadline){
        const live=await fetch('/api/events').then(r=>r.json()).then(v=>v.live).catch(()=>null);
        if(live && !live.skillAutomation?.attack) return true;
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      return false;
    })()`).catch(() => {});
  }
  socket?.close();
  browser.kill();
}
