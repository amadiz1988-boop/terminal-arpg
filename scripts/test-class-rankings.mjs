import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = process.env.RO_DEMO_ORIGIN ?? 'http://127.0.0.1:8788';
const fixture = JSON.parse(
  await readFile('.local/ro-stack/multiplayer-test-v2-credentials.json', 'utf8'),
);
const profile = mkdtempSync(join(tmpdir(), 'ro-ranking-ui-'));
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
  let requestId = 0;
  const errors = [];
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
      errors.push(
        [message.params.entry.text, message.params.entry.url]
          .filter(Boolean)
          .join(' '),
      );
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
    username.value='gate2_03';
    password.value=${JSON.stringify(fixture.password)};
    username.dispatchEvent(new Event('input',{bubbles:true}));
    password.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('#loginForm').requestSubmit();
  })()`);
  await waitFor(() =>
    evaluate("!document.querySelector('#characterSelectForm')?.classList.contains('hidden')"),
  );
  await evaluate("document.querySelector('#characterSelectForm').requestSubmit()");
  await waitFor(() =>
    evaluate("!document.querySelector('#game')?.classList.contains('hidden')"),
  );
  await evaluate("document.querySelector('[data-tab=rankings]').click()");
  await waitFor(
    () => evaluate("document.querySelector('#rankingStatus')?.textContent"),
    (value) => /共 \d+ 名/.test(value),
  );
  const apiCheck = await evaluate(`(async()=>{
    const first=await fetch('/api/rankings?classId=3').then(async response=>({
      status:response.status,
      body:await response.json(),
    }));
    const second=await fetch('/api/rankings?classId=3').then(response=>response.json());
    const invalid=await fetch('/api/rankings?classId=999');
    return {
      status:first.status,
      count:first.body.ranking.entries.length,
      generatedAt:first.body.ranking.generatedAt,
      cachedAt:second.ranking.generatedAt,
      invalidStatus:invalid.status,
      entryKeys:first.body.ranking.entries[0]
        ? Object.keys(first.body.ranking.entries[0]).sort()
        : [],
      appearanceKeys:first.body.ranking.entries[0]
        ? Object.keys(first.body.ranking.entries[0].appearance).sort()
        : [],
    };
  })()`, true);
  const uiCheck = await evaluate(`(async()=>{
    await loadCharacterShowcase();
    const supportedJobs=${JSON.stringify([0, 1, 2, 3, 4, 5, 6, 21, 23, 24, 25, 4046])}.every(classId=>{
      const key=showcaseJobKeys[classId];
      return ['male','female'].every(sex=>Boolean(characterShowcase.manifest.body[key+'-'+sex]?.stand));
    });
    rankingState.entries=Array.from({length:12},(_,index)=>({
      rank:index+1,
      name:'排行測試'+String(index+1),
      classId:3,
      baseLevel:100-index,
      jobLevel:50-index,
      appearance:{sex:index%2?'F':'M',hair:(index%42)+1,hairColor:0,clothesColor:0,body:0},
    }));
    rankingState.generatedAt=Date.now();
    renderRanking();
    const first=document.querySelector('.ranking-card.rank-1');
    paintRankingCharacter(first,rankingState.entries[0],'walk',0);
    const start=first.querySelector('.ranking-body-layer').style.backgroundPosition;
    paintRankingCharacter(first,rankingState.entries[0],'walk',200);
    const moved=first.querySelector('.ranking-body-layer').style.backgroundPosition;
    const viewport=first.querySelector('.ranking-character-viewport');
    const directionStart=first.dataset.direction;
    viewport.dispatchEvent(new PointerEvent('pointerdown',{pointerId:7,clientX:100,bubbles:true}));
    viewport.dispatchEvent(new PointerEvent('pointermove',{pointerId:7,clientX:125,bubbles:true,cancelable:true}));
    viewport.dispatchEvent(new PointerEvent('pointerup',{pointerId:7,clientX:125,bubbles:true}));
    const directionAfterDrag=first.dataset.direction;
    for(let index=0;index<7;index+=1)
      viewport.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
    paintRankingCharacter(first,rankingState.entries[0],'attack',200);
    const bodyAttack=characterShowcase.manifest.body['archer-male'].attack;
    const hairAttack=characterShowcase.manifest.hair['male-1'].attack;
    const expectedAnchor=layerAnchorOffset(hairAttack,bodyAttack,0,2);
    const equipmentDirectionStart=characterShowcase.direction;
    document.querySelector('#paperdollRotateRight').click();
    const equipmentDirectionAfterClick=characterShowcase.direction;
    for(let index=0;index<7;index+=1)
      document.querySelector('#paperdollRotateRight').click();
    return {
      jobs:document.querySelectorAll('#rankingJob option').length,
      cards:document.querySelectorAll('.ranking-card').length,
      animated:document.querySelectorAll('.ranking-card.animated').length,
      compact:document.querySelectorAll('.ranking-card.compact').length,
      rows:document.querySelectorAll('#rankingRows tr').length,
      action:first.dataset.action,
      frameChanged:start!==moved,
      directionStart,
      directionAfterDrag,
      directionAfterEightSteps:first.dataset.direction,
      rotationLabel:viewport.getAttribute('aria-label'),
      hairAnchorTransform:first.querySelector('.ranking-hair-front-layer').style.transform,
      expectedHairAnchorTransform:'translate('+expectedAnchor.x+'px, '+expectedAnchor.y+'px)',
      equipmentDirectionStart,
      equipmentDirectionAfterClick,
      equipmentDirectionAfterEightClicks:characterShowcase.direction,
      tabIndex:viewport.tabIndex,
      touchAction:getComputedStyle(viewport).touchAction,
      supportedJobs,
      unavailable:document.querySelectorAll('.ranking-card.ranking-appearance-unavailable').length,
      pageWidth:document.documentElement.scrollWidth,
      viewportWidth:innerWidth,
    };
  })()`, true);
  const screenshot = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile(
    'tmp/class-rankings-mobile.png',
    Buffer.from(screenshot.result.data, 'base64'),
  );
  await evaluate(`(() => {
    document.querySelector('[data-tab=equipment]').click();
    document.querySelector('[data-showcase-action=attack]').click();
  })()`);
  await sleep(250);
  const equipmentScreenshot = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile(
    'tmp/equipment-paperdoll-mobile.png',
    Buffer.from(equipmentScreenshot.result.data, 'base64'),
  );
  assert.equal(apiCheck.status, 200);
  assert(apiCheck.count <= 100);
  assert.equal(apiCheck.cachedAt, apiCheck.generatedAt);
  assert.equal(apiCheck.invalidStatus, 400);
  if (apiCheck.entryKeys.length)
    assert.deepEqual(apiCheck.entryKeys, [
      'appearance',
      'baseLevel',
      'classId',
      'jobLevel',
      'name',
      'rank',
    ]);
  if (apiCheck.appearanceKeys.length)
    assert.deepEqual(apiCheck.appearanceKeys, [
      'body',
      'clothesColor',
      'hair',
      'hairColor',
      'sex',
    ]);
  assert.equal(
    uiCheck.hairAnchorTransform,
    uiCheck.expectedHairAnchorTransform,
  );
  assert.notEqual(uiCheck.expectedHairAnchorTransform, 'translate(0px, 0px)');
  assert.deepEqual(uiCheck, {
    jobs: 12,
    cards: 10,
    animated: 3,
    compact: 7,
    rows: 2,
    action: 'attack',
    frameChanged: true,
    directionStart: '0',
    directionAfterDrag: '1',
    directionAfterEightSteps: '0',
    rotationLabel: '排行測試1的角色外觀，正面，可左右拖曳旋轉',
    hairAnchorTransform: uiCheck.expectedHairAnchorTransform,
    expectedHairAnchorTransform: uiCheck.expectedHairAnchorTransform,
    equipmentDirectionStart: 0,
    equipmentDirectionAfterClick: 1,
    equipmentDirectionAfterEightClicks: 0,
    tabIndex: 0,
    touchAction: 'pan-y',
    supportedJobs: true,
    unavailable: 0,
    pageWidth: 390,
    viewportWidth: 390,
  });
  const unexpectedErrors = errors.filter(
    (message) => !message.includes('/api/rankings?classId=999'),
  );
  assert.deepEqual(unexpectedErrors, []);
  console.log(
    JSON.stringify(
      {
        result: 'CLASS_RANKINGS_PASS',
        viewport: '390x844',
        apiCheck,
        uiCheck,
        screenshot: 'tmp/class-rankings-mobile.png',
        equipmentScreenshot: 'tmp/equipment-paperdoll-mobile.png',
      },
      null,
      2,
    ),
  );
  await call('Browser.close');
} finally {
  browser.kill();
}
