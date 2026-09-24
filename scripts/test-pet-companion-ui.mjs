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
const profile = mkdtempSync(join(tmpdir(), 'ro-pet-companion-ui-'));
const port = 19691;
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
const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitFor(read, predicate = Boolean, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  let value;
  while (Date.now() < deadline) {
    value = await read();
    if (predicate(value)) return value;
    await sleep(100);
  }
  throw new Error(`wait timed out: ${JSON.stringify(value)}`);
}

let socket;
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
  await call('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
  });
  await call('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await call('Page.navigate', { url: origin });
  await waitFor(() =>
    evaluate(
      "typeof document.querySelector('#loginForm')?.onsubmit === 'function'",
    ),
  );
  await evaluate(`(() => {
    document.querySelector('#username').value='jobtest_thief';
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
  await waitFor(() =>
    evaluate("document.querySelector('.pet-companion')?.dataset.anchor"),
  );

  const readPet = () =>
    evaluate(`(() => {
      const pet=document.querySelector('.pet-companion');
      const rect=pet.getBoundingClientRect();
      return {anchor:pet.dataset.anchor,animation:pet.dataset.animation,
        resting:pet.dataset.resting,x:rect.x,y:rect.y,width:rect.width,height:rect.height,
        count:document.querySelectorAll('.pet-companion').length};
    })()`);
  const switchPanel = async (tab, anchor) => {
    const before = await readPet();
    await evaluate(`document.querySelector('[data-tab="${tab}"]').click()`);
    await sleep(40);
    const during = await readPet();
    const after = await waitFor(
      readPet,
      (value) => value.anchor === anchor && value.animation === 'idle',
      10_000,
    );
    return { before, during, after };
  };

  const status = await switchPanel('character', 'status');
  const skills = await switchPanel('skills', 'skills');
  const equipment = await switchPanel('equipment', 'equipment');
  const samePetAcrossPanels =
    status.after.count === 1 &&
    skills.after.count === 1 &&
    equipment.after.count === 1;
  const equipmentDidNotTeleport =
    equipment.during.animation === 'walk' ||
    equipment.during.animation === 'run' ||
    (Math.abs(equipment.during.x - equipment.after.x) < 1 &&
      Math.abs(equipment.before.x - equipment.after.x) < 80);

  await evaluate(`(() => {
    document.querySelector('[data-tab="hunt"]').click();
    const log=document.querySelector('#log');
    log.scrollIntoView({block:'center'});
    log.dispatchEvent(new WheelEvent('wheel',{deltaY:120,bubbles:true}));
  })()`);
  const logFollow = await waitFor(
    readPet,
    (value) => value.anchor === 'combat-log' && value.animation === 'idle',
    10_000,
  );

  await evaluate(`(() => {
    const log=document.querySelector('#log');
    log.scrollTop=0;
    log.dispatchEvent(new WheelEvent('wheel',{deltaY:900,bubbles:true}));
    log.scrollTop=log.scrollHeight;
  })()`);
  await sleep(40);
  const fastScrollRun = await readPet();
  const pant = await waitFor(
    readPet,
    (value) => value.animation === 'pant',
    10_000,
  );
  await waitFor(readPet, (value) => value.animation === 'idle', 5_000);

  const inactivity = await evaluate(`(() => {
    window.__petCompanionTest.setInactiveFor(31000);
    const resting=document.querySelector('.pet-companion').dataset.resting;
    window.__petCompanionTest.setInactiveFor(91000);
    const sleeping=document.querySelector('.pet-companion').dataset.animation;
    window.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
    const wake=document.querySelector('.pet-companion').dataset.animation;
    return {resting,sleeping,wake};
  })()`);
  await sleep(800);
  await evaluate("document.querySelector('.pet-companion').click()");
  const clickReaction = await evaluate(`({
    animation:document.querySelector('.pet-companion').dataset.animation,
    message:document.querySelector('.pet-reaction-message').textContent,
    visible:!document.querySelector('.pet-reaction-message').hidden
  })`);

  const originalControls = await evaluate(`({
    activePanel:document.querySelector('.panel.active')?.id,
    startPresent:!!document.querySelector('#start'),
    stopPresent:!!document.querySelector('#stop'),
    startEnabled:!document.querySelector('#start').disabled,
    stopEnabled:!document.querySelector('#stop').disabled,
    minimap:!!document.querySelector('#minimap'),
    logHasContent:document.querySelector('#log').textContent.length>0
  })`);
  const desktopShot = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile(
    'tmp/pet-companion-desktop.png',
    Buffer.from(desktopShot.result.data, 'base64'),
  );

  await call('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await evaluate(`(() => {
    document.querySelector('[data-tab="inventory"]').click();
    window.scrollTo(0,document.documentElement.scrollHeight);
  })()`);
  const mobile = await waitFor(
    () =>
      evaluate(`(() => {
        const pet=document.querySelector('.pet-companion');
        const rect=pet.getBoundingClientRect();
        const controls=[...document.querySelectorAll('button,input,select,textarea,.equip-slot')]
          .filter(element=>!element.closest('#petCompanion'))
          .map(element=>element.getBoundingClientRect())
          .filter(item=>item.width&&item.height&&item.bottom>0&&item.top<innerHeight);
        const overlap=controls.reduce((sum,item)=>sum+Math.max(0,Math.min(rect.right,item.right)-Math.max(rect.left,item.left))*Math.max(0,Math.min(rect.bottom,item.bottom)-Math.max(rect.top,item.top)),0);
        return {anchor:pet.dataset.anchor,animation:pet.dataset.animation,
          left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,
          width:document.documentElement.scrollWidth,viewport:innerWidth,overlap};
      })()`),
    (value) => value.anchor === 'inventory' && value.animation === 'idle',
    10_000,
  );
  const mobileShot = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile(
    'tmp/pet-companion-mobile.png',
    Buffer.from(mobileShot.result.data, 'base64'),
  );

  const pass =
    status.after.anchor === 'status' &&
    skills.after.anchor === 'skills' &&
    equipment.after.anchor === 'equipment' &&
    equipmentDidNotTeleport &&
    samePetAcrossPanels &&
    logFollow.anchor === 'combat-log' &&
    fastScrollRun.animation === 'run' &&
    pant.animation === 'pant' &&
    inactivity.resting === 'true' &&
    inactivity.sleeping === 'sleep' &&
    inactivity.wake === 'happy' &&
    clickReaction.animation === 'happy' &&
    clickReaction.visible &&
    originalControls.startPresent &&
    originalControls.stopPresent &&
    (originalControls.startEnabled || originalControls.stopEnabled) &&
    originalControls.minimap &&
    originalControls.logHasContent &&
    mobile.width <= mobile.viewport &&
    mobile.left >= 0 &&
    mobile.right <= 390 &&
    mobile.top >= 0 &&
    mobile.bottom <= 750 &&
    mobile.overlap === 0 &&
    errors.length === 0;
  console.log(
    JSON.stringify(
      {
        result: pass ? 'PET_COMPANION_UI_PASS' : 'PET_COMPANION_UI_FAIL',
        origin,
        status,
        skills,
        equipment,
        samePetAcrossPanels,
        equipmentDidNotTeleport,
        logFollow,
        fastScrollRun,
        pant,
        inactivity,
        clickReaction,
        originalControls,
        mobile,
        screenshots: [
          'tmp/pet-companion-desktop.png',
          'tmp/pet-companion-mobile.png',
        ],
        errors,
      },
      null,
      2,
    ),
  );
  if (!pass) process.exitCode = 1;
} finally {
  socket?.close();
  browser.kill();
}
