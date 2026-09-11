import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = process.env.RO_DEMO_ORIGIN ?? 'http://127.0.0.1:8788';
const fixture = JSON.parse(
  await readFile('.local/ro-stack/multiplayer-test-v2-credentials.json', 'utf8'),
);
const profile = mkdtempSync(join(tmpdir(), 'ro-eden-enrollment-ui-'));
const port = 19641;
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
async function waitFor(read, predicate = Boolean, timeout = 360_000) {
  const deadline = Date.now() + timeout;
  let value;
  while (Date.now() < deadline) {
    value = await read();
    if (predicate(value)) return value;
    await sleep(200);
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
    document.querySelector('#username').value='jobtest_thief';
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
  await waitFor(
    () => evaluate("fetch('/api/state').then(r=>r.json())"),
    (state) => state.character?.name === 'JobTestThief' && state.eden,
  );
  const observedPhases = new Set();
  await evaluate(`(() => {
    document.querySelector('[data-tab="quests"]').click();
    const row=document.querySelector('#edenMilestones .eden-milestone');
    row.scrollIntoView({block:'center'});
    row.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
  })()`);
  await waitFor(
    async () => {
      const state = await evaluate("fetch('/api/state').then(r=>r.json())");
      const phase = state.derived?.edenJourney?.phase;
      if (phase) observedPhases.add(phase);
      return state;
    },
    (state) =>
      state.running &&
      Number(state.derived?.baseExpMax) > 0 &&
      Number(state.derived?.jobExpMax) > 0,
  );
  await sleep(300);
  const expUi = await evaluate(`(() => {
    scrollTo(0,0);
    const baseTrack=document.querySelector('#baseBar').parentElement.getBoundingClientRect();
    const jobTrack=document.querySelector('#jobBar').parentElement.getBoundingClientRect();
    return {
      baseText:document.querySelector('#baseExp').textContent,
      jobText:document.querySelector('#jobExp').textContent,
      basePercent:document.querySelector('#baseBar').getBoundingClientRect().width/baseTrack.width*100,
      jobPercent:document.querySelector('#jobBar').getBoundingClientRect().width/jobTrack.width*100,
      baseTargetPercent:parseFloat(document.querySelector('#baseBar').style.width),
      jobTargetPercent:parseFloat(document.querySelector('#jobBar').style.width),
      baseDisplayedPercent:parseFloat(document.querySelector('#baseExp').textContent.match(/([\\d.]+)%/)?.[1]),
      jobDisplayedPercent:parseFloat(document.querySelector('#jobExp').textContent.match(/([\\d.]+)%/)?.[1]),
      baseTextFits:document.querySelector('#baseExp').scrollWidth<=document.querySelector('#baseExp').clientWidth,
      jobTextFits:document.querySelector('#jobExp').scrollWidth<=document.querySelector('#jobExp').clientWidth,
      basePosition:getComputedStyle(document.querySelector('#baseExp')).position,
      jobPosition:getComputedStyle(document.querySelector('#jobExp')).position
    };
  })()`);
  const statusScreenshot = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile(
    'tmp/status-exp-mobile.png',
    Buffer.from(statusScreenshot.result.data, 'base64'),
  );
  const completed = await waitFor(
    async () => {
      const state = await evaluate("fetch('/api/state').then(r=>r.json())");
      const phase = state.derived?.edenJourney?.phase;
      if (phase) observedPhases.add(phase);
      return state;
    },
    (state) => {
      const mark = (state.inventory ?? []).find((item) =>
        [6219, 22508].includes(Number(item.itemId)),
      );
      return (
        Boolean(mark) &&
        state.derived?.map === 'prt_fild08' &&
        state.derived?.edenJourney?.phase === 'complete' &&
        state.running
      );
    },
  );
  const duplicate = await evaluate(`fetch('/api/eden/enroll',{method:'POST'})
    .then(async r=>({status:r.status,body:await r.json()}))`);
  await evaluate("document.querySelector('#edenMilestones').scrollIntoView({block:'start'})");
  await sleep(500);
  const screenshot = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile(
    'tmp/eden-enrollment-mobile.png',
    Buffer.from(screenshot.result.data, 'base64'),
  );
  const layout = await evaluate(`({
    width:document.documentElement.scrollWidth,
    viewport:innerWidth,
    title:document.querySelector('#edenSummary')?.textContent,
    notice:document.querySelector('#edenNotice')?.textContent,
    milestone:document.querySelector('.eden-milestone')?.textContent
  })`);
  const events = completed.derived?.taskEvents ?? [];
  const pass =
    observedPhases.has('route_officer') &&
    observedPhases.has('enter_headquarters') &&
    observedPhases.has('register_member') &&
    observedPhases.has('returning_hunt') &&
    observedPhases.has('complete') &&
    duplicate.status === 400 &&
    /已經是伊甸園成員/.test(duplicate.body?.error ?? '') &&
    Math.abs(expUi.baseTargetPercent - expUi.baseDisplayedPercent) < 0.11 &&
    Math.abs(expUi.jobTargetPercent - expUi.jobDisplayedPercent) < 0.11 &&
    expUi.basePosition === 'absolute' &&
    expUi.jobPosition === 'absolute' &&
    expUi.baseTextFits &&
    expUi.jobTextFits &&
    /\/.+%/.test(expUi.baseText) &&
    /\/.+%/.test(expUi.jobText) &&
    layout.width <= layout.viewport &&
    errors.length === 0;
  console.log(
    JSON.stringify(
      {
        result: pass ? 'EDEN_ENROLLMENT_UI_PASS' : 'EDEN_ENROLLMENT_UI_FAIL',
        origin,
        viewport: '390x844',
        observedPhases: [...observedPhases],
        character: completed.character,
        eden: completed.eden,
        expUi,
        layout,
        taskEvents: events.slice(-14),
        duplicate,
        screenshot: 'tmp/eden-enrollment-mobile.png',
        statusScreenshot: 'tmp/status-exp-mobile.png',
        errors,
      },
      null,
      2,
    ),
  );
  if (!pass) process.exitCode = 1;
} finally {
  if (evaluate)
    await evaluate(`fetch('/api/automation',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({action:'stop'})
    }).catch(()=>{})`).catch(() => {});
  socket?.close();
  browser.kill();
}
