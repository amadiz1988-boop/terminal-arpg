import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = process.env.RO_DEMO_ORIGIN ?? 'http://127.0.0.1:8788';
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = mkdtempSync(join(tmpdir(), 'ro-login-ui-'));
const debugPort = 19458;
const browser = spawn(
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

let debuggerReady = false;
for (let attempt = 0; attempt < 40; attempt += 1) {
  try {
    if ((await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok) {
      debuggerReady = true;
      break;
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 100));
}
if (!debuggerReady) throw new Error('Chrome debugging endpoint unavailable');

try {
  const target = await fetch(
    `http://127.0.0.1:${debugPort}/json/new?about:blank`,
    { method: 'PUT' },
  ).then((response) => response.json());
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  let requestId = 0;
  const pending = new Map();
  const errors = [];
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
    if (message.method === 'Runtime.exceptionThrown')
      errors.push(message.params?.exceptionDetails?.text ?? 'runtime error');
    if (message.method === 'Log.entryAdded' && message.params?.entry?.level === 'error')
      errors.push(message.params.entry.text);
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
    (await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result
      .result.value;
  const ready = async () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (await evaluate("document.querySelector('#loginServerStatus')?.textContent === '伺服器正常'"))
        return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('login UI did not become ready');
  };

  await call('Runtime.enable');
  await call('Log.enable');
  await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await call('Page.navigate', { url: origin });
  await ready();

  const backgrounds = new Set();
  for (let attempt = 0; attempt < 16; attempt += 1) {
    backgrounds.add(
      await evaluate(
        "[...document.querySelector('#auth').classList].find(x=>x.startsWith('login-background-'))",
      ),
    );
    if (backgrounds.size === 2) break;
    await call('Page.reload', { ignoreCache: true });
    await ready();
  }
  const layout = await evaluate(`(() => {
    const card = document.querySelector('#loginForm').getBoundingClientRect();
    const resources = performance.getEntriesByType('resource').map(x => new URL(x.name).origin);
    return {
      width: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      cardLeft: card.left,
      cardRight: card.right,
      cardHeight: card.height,
      server: document.querySelector('#loginServerStatus').textContent,
      title: document.querySelector('.server-picker-title').textContent,
      confirmation: document.querySelector('.login-actions button').textContent.trim(),
      duplicateLogoCount: document.querySelectorAll('.classic-logo').length,
      loginSexCount: document.querySelectorAll('#loginForm [name=sex]').length,
      createSexCount: document.querySelectorAll('#characterForm [name=createSex]').length,
      createJobCount: document.querySelectorAll('#characterForm [name=targetJob]').length,
      createJobValues: [...document.querySelectorAll('#characterForm [name=targetJob]')].map(
        (input) => input.value,
      ),
      defaultTargetJob: document.querySelector('#characterForm [name=targetJob]:checked')?.value,
      hairInputType: document.querySelector('#hair').type,
      hairColorInputType: document.querySelector('#hairColor').type,
      appearanceButtonCount: document.querySelectorAll('.appearance-stepper .skin-step').length,
      musicControlType: document.querySelector('#authMusicToggle').type,
      musicChecked: document.querySelector('#authMusicToggle').checked,
      musicCheckboxAsset: getComputedStyle(document.querySelector('#authMusicToggle')).backgroundImage,
      physicalMusicVolume: document.querySelector('#bgm').volume,
      crossOriginResources: resources.filter(x => x !== location.origin),
    };
  })()`);
  const femalePreview = await evaluate(`(() => {
    const female = document.querySelector('[name=createSex][value=F]');
    female.checked = true;
    female.dispatchEvent(new Event('change', { bubbles: true }));
    return document.querySelector('#createPaperdoll').getAttribute('src');
  })()`);
  const appearanceControls = await evaluate(`(() => {
    document.querySelector('#hairNext').click();
    document.querySelector('#hairColorPrev').click();
    return {
      hair: document.querySelector('#hair').value,
      hairLabel: document.querySelector('#hairValue').textContent,
      hairColor: document.querySelector('#hairColor').value,
      hairColorLabel: document.querySelector('#hairColorValue').textContent,
      paperdoll: document.querySelector('#createPaperdoll').getAttribute('src'),
      previousAsset: getComputedStyle(document.querySelector('#hairPrev')).backgroundImage,
      nextAsset: getComputedStyle(document.querySelector('#hairNext')).backgroundImage,
    };
  })()`);
  const screenshot = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  writeFileSync('tmp/login-ui-mobile.png', Buffer.from(screenshot.result.data, 'base64'));
  const missingCharacterRecovery = await evaluate(`(async () => {
    const originalFetch = window.fetch;
    window.fetch = async (input, options) => {
      const path = new URL(typeof input === 'string' ? input : input.url, location.href).pathname;
      if (path === '/api/session') return new Response(JSON.stringify({account:{username:'stale_session',sex:'F',characterName:'StaleCharacter'}}),{status:200,headers:{'content-type':'application/json'}});
      if (path === '/api/preferences') return new Response(JSON.stringify({preferences:{musicEnabled:true,soundEnabled:true,musicVolume:20,soundVolume:35}}),{status:200,headers:{'content-type':'application/json'}});
      if (path === '/api/state') return new Response(JSON.stringify({account:{username:'stale_session'},needsCharacter:true,world:{online:true}}),{status:200,headers:{'content-type':'application/json'}});
      return originalFetch(input, options);
    };
    try {
      await enter();
      return {
        characterFormVisible: !document.querySelector('#characterForm').classList.contains('hidden'),
        selectedSex: document.querySelector('[name=createSex]:checked')?.value,
        message: document.querySelector('#characterError').textContent,
      };
    } finally {
      window.fetch = originalFetch;
    }
  })()`);
  const pass =
    backgrounds.size === 2 &&
    layout.documentWidth <= layout.width &&
    layout.cardLeft >= 0 &&
    layout.cardRight <= layout.width &&
    layout.cardHeight <= 844 &&
    layout.server === '伺服器正常' &&
    layout.title === '選擇伺服器' &&
    layout.confirmation === '確定' &&
    layout.duplicateLogoCount === 0 &&
    layout.loginSexCount === 0 &&
    layout.createSexCount === 2 &&
    layout.createJobCount === 10 &&
    layout.createJobValues.join(',') ===
      'swordman,mage,archer,acolyte,merchant,thief,supernovice,taekwon,gunslinger,ninja' &&
    layout.defaultTargetJob === 'thief' &&
    layout.hairInputType === 'hidden' &&
    layout.hairColorInputType === 'hidden' &&
    layout.appearanceButtonCount === 4 &&
    layout.musicControlType === 'checkbox' &&
    layout.musicChecked === true &&
    layout.musicCheckboxAsset.includes('checkbox_1.png') &&
    Math.abs(layout.physicalMusicVolume - 0.1) < 0.001 &&
    femalePreview.includes('novice-female-hair-1.png') &&
    appearanceControls.hair === '2' &&
    appearanceControls.hairLabel === '2 / 42' &&
    appearanceControls.hairColor === '8' &&
    appearanceControls.hairColorLabel === '9 / 9' &&
    appearanceControls.paperdoll.includes('novice-female-hair-2.png') &&
    appearanceControls.previousAsset.includes('btn_back_a.png') &&
    appearanceControls.nextAsset.includes('btn_next_a.png') &&
    missingCharacterRecovery.characterFormVisible === true &&
    missingCharacterRecovery.selectedSex === 'F' &&
    missingCharacterRecovery.message === '請先建立角色' &&
    layout.crossOriginResources.length === 0 &&
    errors.length === 0;
  console.log(
    JSON.stringify(
      {
        result: pass ? 'LOGIN_UI_PASS' : 'LOGIN_UI_FAIL',
        backgrounds: [...backgrounds],
        mobile: layout,
        femalePreview,
        appearanceControls,
        missingCharacterRecovery,
        screenshot: 'tmp/login-ui-mobile.png',
        errors,
      },
      null,
      2,
    ),
  );
  if (!pass) throw new Error('login UI validation failed');
  await call('Browser.close');
} finally {
  browser.unref();
}
