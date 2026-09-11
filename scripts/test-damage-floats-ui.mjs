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
const profile = mkdtempSync(join(tmpdir(), 'ro-damage-floats-ui-'));
const port = 19542;
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
async function waitFor(read, predicate = Boolean, timeout = 45000, delay = 50) {
  const deadline = Date.now() + timeout;
  let value;
  while (Date.now() < deadline) {
    value = await read();
    if (predicate(value)) return value;
    await sleep(delay);
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
  await call('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => {
      window.__mediaPlayCalls=[];
      window.__combatSoundEvents=[];
      document.addEventListener('ro-combat-sound',event=>{
        window.__combatSoundEvents.push({...event.detail,at:performance.now()});
      });
      const original=HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play=function(){
        const record={src:this.src,muted:this.muted,volume:this.volume,resolved:null,at:performance.now()};
        window.__mediaPlayCalls.push(record);
        const result=original.call(this);
        if(result?.then) result.then(()=>{record.resolved=true;},error=>{record.resolved=false;record.error=String(error);});
        return result;
      };
    })()`,
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
  await evaluate(`(() => {
    if (!currentRunning && !document.querySelector('#start').disabled)
      document.querySelector('#start').click();
  })()`);
  await waitFor(() => evaluate('currentRunning === true'), Boolean, 45000, 100);
  await evaluate(`fetch('/api/preferences', {
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({damageFloatsEnabled:true,damageFloatScale:50,damageFloatOpacity:100,damageFloatWeight:800,damageFloatFont:'classic',damageFloatPositionX:72,damageFloatPositionY:72,damageFloatArc:100})
  })`);
  await evaluate('loadAccountAudio()');
  await evaluate("document.querySelector('[data-tab=system]').click()");
  await waitFor(() =>
    evaluate("Boolean(document.querySelector('#damageFloatScale'))"),
  );
  const initialPreference = await waitFor(
    () =>
      evaluate(
        "fetch('/api/preferences').then(r=>r.json()).then(v=>v.preferences)",
      ),
    (value) =>
      value.damageFloatScale === 50 &&
      value.damageFloatPositionX === 72 &&
      value.damageFloatPositionY === 72 &&
      value.damageFloatArc === 100,
  );
  await evaluate(`(() => {
    const soundToggle=document.querySelector('#soundToggle');
    if(!soundToggle.checked){soundToggle.checked=true;soundToggle.dispatchEvent(new Event('change',{bubbles:true}));}
    const soundVolume=document.querySelector('#soundVolume');
    soundVolume.value='35';
    soundVolume.dispatchEvent(new Event('input',{bubbles:true}));
    const toggle=document.querySelector('#damageFloatToggle');
    if(!toggle.checked){toggle.checked=true;toggle.dispatchEvent(new Event('change',{bubbles:true}));}
    const slider=document.querySelector('#damageFloatScale');
    slider.value='80';
    slider.dispatchEvent(new Event('input',{bubbles:true}));
    const opacity=document.querySelector('#damageFloatOpacity');
    opacity.value='65';
    opacity.dispatchEvent(new Event('input',{bubbles:true}));
    const weight=document.querySelector('#damageFloatWeight');
    weight.value='600';
    weight.dispatchEvent(new Event('change',{bubbles:true}));
    const font=document.querySelector('#damageFloatFont');
    font.value='consolas';
    font.dispatchEvent(new Event('change',{bubbles:true}));
    const positionX=document.querySelector('#damageFloatPositionX');
    positionX.value='35';
    positionX.dispatchEvent(new Event('input',{bubbles:true}));
    const positionY=document.querySelector('#damageFloatPositionY');
    positionY.value='55';
    positionY.dispatchEvent(new Event('input',{bubbles:true}));
    const arc=document.querySelector('#damageFloatArc');
    arc.value='140';
    arc.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('#damageFloatPreview').scrollIntoView({block:'center'});
  })()`);
  await call('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: 2,
    y: 2,
    button: 'left',
    clickCount: 1,
  });
  await call('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: 2,
    y: 2,
    button: 'left',
    clickCount: 1,
  });
  await sleep(500);
  await evaluate('window.__mediaPlayCalls=[]');
  const preference = await waitFor(
    () =>
      evaluate(
        "fetch('/api/preferences').then(r=>r.json()).then(v=>v.preferences)",
      ),
    (value) =>
      value.damageFloatsEnabled &&
      value.damageFloatScale === 80 &&
      value.damageFloatOpacity === 65 &&
      value.damageFloatWeight === 600 &&
      value.damageFloatFont === 'consolas' &&
      value.damageFloatPositionX === 35 &&
      value.damageFloatPositionY === 55 &&
      value.damageFloatArc === 140,
  );
  const settingsScreenshot = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile(
    'tmp/damage-visual-settings-mobile.png',
    Buffer.from(settingsScreenshot.result.data, 'base64'),
  );
  await evaluate(`(() => {
    document.querySelector('[data-tab=hunt]').click();
    const combat=document.querySelector('.combat-window');
    window.scrollTo(0,combat.getBoundingClientRect().top+window.scrollY-52);
  })()`);
  const combatViewport = await waitFor(
    () =>
      evaluate(`(() => {
        const rect=document.querySelector('.combat-window').getBoundingClientRect();
        return {top:rect.top,bottom:rect.bottom,height:innerHeight,scrollY};
      })()`),
    (value) =>
      value.scrollY > 0 && value.top < value.height && value.bottom > 0,
  );
  await evaluate(
    `renderEventDelta(['[100/100] You attack Monster Poring (1002) (Dmg: 169*2) (Delay: 340ms)'],false)`,
  );
  const firstDamage = await waitFor(
    () =>
      evaluate(`(() => {
        const node=document.querySelector('.damage-float.segment,.damage-float.critical,.damage-float.miss');
        if(!node) return null;
        const rect=node.getBoundingClientRect();
        const combat=document.querySelector('.combat-window').getBoundingClientRect();
        return {kind:node.dataset.damageKind,combatEventId:node.dataset.combatEventId,hitIndex:Number(node.dataset.hitIndex),x:rect.x,y:rect.y,scrollY,combatTop:combat.top,combatBottom:combat.bottom};
      })()`),
    Boolean,
    45000,
    25,
  );
  if (firstDamage.y < 0 || firstDamage.y > 844) {
    await evaluate(`(() => {
      const combat=document.querySelector('.combat-window');
      window.scrollTo(0,combat.getBoundingClientRect().top+window.scrollY-52);
    })()`);
  }
  const segment = await waitFor(
    () =>
      evaluate(`(() => {
        const node=document.querySelector('.damage-float.segment');
        if(!node) return null;
        const rect=node.getBoundingClientRect();
        if(rect.bottom<0 || rect.top>innerHeight) return null;
        window.__damageFloatTestNode=node;
        return {text:node.textContent,x:rect.x,y:rect.y,font:getComputedStyle(node).fontSize};
      })()`),
    Boolean,
    45000,
    25,
  );
  await sleep(280);
  const moved = await evaluate(`(() => {
    const node=window.__damageFloatTestNode;
    if(!node?.isConnected) return null;
    const rect=node.getBoundingClientRect();
    return {x:rect.x,y:rect.y};
  })()`);
  const total = await waitFor(
    () =>
      evaluate(`(() => {
        const node=document.querySelector('.damage-float.total');
        if(!node) return null;
        const rect=node.getBoundingClientRect();
        return rect.bottom>=0 && rect.top<=innerHeight
          ? {text:node.textContent,font:getComputedStyle(node).fontSize,y:rect.y}
          : null;
      })()`),
    Boolean,
    45000,
    25,
  );
  const totalScreenshot = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile(
    'tmp/damage-floats-total-mobile.png',
    Buffer.from(totalScreenshot.result.data, 'base64'),
  );
  const attackAudio = await waitFor(
    () =>
      evaluate(`window.__combatSoundEvents
        .filter(entry=>entry.key==='daggerHit')
        .map(entry=>({combatEventId:entry.combatEventId,hitIndex:entry.hitIndex,backend:entry.backend,volume:entry.volume,started:entry.started}))`),
    (entries) => entries.some((entry) => entry.started === true),
  );
  const soundSyncedToFloat = attackAudio.some(
    (entry) =>
      entry.started === true &&
      entry.combatEventId === firstDamage.combatEventId &&
      Number(entry.hitIndex) === Number(firstDamage.hitIndex),
  );
  await evaluate(`(() => {
    window.__combatSoundEvents=[];
    renderEventDelta(['[100/100] You attack Monster Poring (1002) (Dmg: 12*2) (Delay: 340ms)'],false);
  })()`);
  const doubleAttackAudio = await waitFor(
    () =>
      evaluate(`window.__combatSoundEvents.map(entry=>({
        key:entry.key,combatEventId:entry.combatEventId,hitIndex:entry.hitIndex,
        backend:entry.backend,volume:entry.volume,started:entry.started,at:entry.at
      }))`),
    (entries) => {
      const eventIds = entries
        .filter((entry) => entry.key === 'daggerAttack' && entry.started)
        .map((entry) => entry.combatEventId);
      return eventIds.some(
        (combatEventId) =>
          entries.filter(
            (entry) =>
              entry.combatEventId === combatEventId &&
              entry.key === 'daggerHit' &&
              entry.started,
          ).length >= 2 &&
          entries.filter(
            (entry) =>
              entry.combatEventId === combatEventId &&
              entry.key === 'poringDamage' &&
              entry.started,
          ).length >= 2,
      );
    },
  );
  const doubleAttackEventId = doubleAttackAudio.find(
      (entry) => entry.key === 'daggerAttack' && entry.started,
    ).combatEventId,
    doubleDaggerHits = doubleAttackAudio.filter(
      (entry) =>
        entry.combatEventId === doubleAttackEventId &&
        entry.key === 'daggerHit' &&
        entry.started,
    ),
    doublePoringHits = doubleAttackAudio.filter(
      (entry) =>
        entry.combatEventId === doubleAttackEventId &&
        entry.key === 'poringDamage' &&
        entry.started,
    ),
    doubleAttackIntervals = {
      dagger: doubleDaggerHits[1].at - doubleDaggerHits[0].at,
      poring: doublePoringHits[1].at - doublePoringHits[0].at,
    },
    doubleAttackEventIds = new Set(
      [...doubleDaggerHits, ...doublePoringHits].map(
        (entry) => entry.combatEventId,
      ),
    );
  const combatTimingSource = await evaluate(
    "fetch('/app.js?v=r045-official-combat-audio').then(response=>response.text()).then(source=>source.includes(\"passiveProcName(line) === '二刀連擊' ? 347 : 75\"))",
  );
  await evaluate(`(() => {
    window.__combatSoundEvents=[];
    renderEventDelta([
      '[100/100] Monster Fabre (1007) attacks you (Dmg: 8)',
      '[100/100] Target Monster Poring (1002) died'
    ],false);
  })()`);
  const monsterCombatAudio = await waitFor(
    () =>
      evaluate(`window.__combatSoundEvents.map(entry=>({
        key:entry.key,backend:entry.backend,started:entry.started
      }))`),
    (entries) =>
      entries.some((entry) => entry.key === 'fabreAttack' && entry.started) &&
      entries.some(
        (entry) => /^playerDamage/.test(entry.key) && entry.started,
      ) &&
      entries.some((entry) => entry.key === 'poringDie' && entry.started),
  );
  await evaluate(`(() => {
    window.__combatSoundEvents=[];
    document.querySelector('[data-tab=system]').click();
    document.querySelector('[data-tab=hunt]').click();
    renderEventDelta([
      '[100/100] You use Red Potion',
      '[100/100] You use Fly Wing',
      '[100/100] Item Jellopy picked up',
      '[100/100] You gained 10 Zeny',
      '[100/100] Base Level up'
    ],false);
  })()`);
  const interfaceAudio = await waitFor(
    () =>
      evaluate(`window.__combatSoundEvents.map(entry=>({
        key:entry.key,backend:entry.backend,started:entry.started
      }))`),
    (entries) =>
      entries.some((entry) => entry.key === 'uiTab' && entry.started) &&
      entries.some(
        (entry) => entry.key === 'itemDrinkPotion' && entry.started,
      ) &&
      entries.some((entry) => entry.key === 'flyWing' && entry.started) &&
      entries.some((entry) => entry.key === 'itemPickup' && entry.started) &&
      entries.some((entry) => entry.key === 'getCoin' && entry.started) &&
      entries.some((entry) => entry.key === 'levelUp' && entry.started),
  );
  // A natural critical is rare. Exercise that rendering branch only after a
  // real combat hit and its paired sound have both been observed.
  await evaluate(
    `renderEventDelta(['[100/100] You attack Monster CriticalProbe (999) (Dmg: 259!) (Delay: 340ms)'],false)`,
  );
  const critical = await waitFor(
    () =>
      evaluate(`(() => {
        const node=document.querySelector('.damage-float.critical');
        if(!node) return null;
        const rect=node.getBoundingClientRect();
        if(rect.bottom<0 || rect.top>innerHeight) return null;
        const style=getComputedStyle(node,'::before');
        return {text:node.textContent,font:getComputedStyle(node).fontSize,background:style.backgroundImage,clipPath:style.clipPath,y:rect.y};
      })()`),
    Boolean,
    45000,
    25,
  );
  const screenshot = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile(
    'tmp/damage-floats-mobile.png',
    Buffer.from(screenshot.result.data, 'base64'),
  );
  await evaluate(`(() => {
    document.querySelector('[data-tab=system]').click();
    const scale=document.querySelector('#damageFloatScale');
    scale.value='1000';
    scale.dispatchEvent(new Event('input',{bubbles:true}));
    const positionX=document.querySelector('#damageFloatPositionX');
    positionX.value='50';
    positionX.dispatchEvent(new Event('input',{bubbles:true}));
    const positionY=document.querySelector('#damageFloatPositionY');
    positionY.value='50';
    positionY.dispatchEvent(new Event('input',{bubbles:true}));
    const arc=document.querySelector('#damageFloatArc');
    arc.value='50';
    arc.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('#damageFloatPreview').scrollIntoView({block:'center'});
  })()`);
  await waitFor(
    () =>
      evaluate(
        "fetch('/api/preferences').then(r=>r.json()).then(v=>v.preferences)",
      ),
    (value) =>
      value.damageFloatScale === 1000 &&
      value.damageFloatPositionX === 50 &&
      value.damageFloatPositionY === 50 &&
      value.damageFloatArc === 50,
  );
  await sleep(250);
  const maxPreviewScreenshot = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile(
    'tmp/damage-visual-max-preview-mobile.png',
    Buffer.from(maxPreviewScreenshot.result.data, 'base64'),
  );
  await evaluate(`(() => {
    document.querySelector('[data-tab=hunt]').click();
    const combat=document.querySelector('.combat-window');
    window.scrollTo(0,combat.getBoundingClientRect().top+window.scrollY-52);
    renderEventDelta(['[100/100] You attack Monster MaximumProbe (999) (Dmg: 60) (Delay: 340ms)'],false);
  })()`);
  const maximumSizeVisibility = await waitFor(
    () =>
      evaluate(`(() => {
        const nodes=[...document.querySelectorAll('.damage-float.segment')];
        const node=nodes.reverse().find(entry=>entry.textContent==='60');
        if(!node) return null;
        const rect=node.getBoundingClientRect();
        const combat=document.querySelector('.damage-float-layer').getBoundingClientRect();
        const visibleWidth=Math.max(0,Math.min(rect.right,combat.right)-Math.max(rect.left,combat.left));
        const visibleHeight=Math.max(0,Math.min(rect.bottom,combat.bottom)-Math.max(rect.top,combat.top));
        return {font:getComputedStyle(node).fontSize,rect:{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height},combat:{left:combat.left,top:combat.top,right:combat.right,bottom:combat.bottom},visibleRatio:rect.width&&rect.height?(visibleWidth*visibleHeight)/(rect.width*rect.height):0};
      })()`),
    (value) => value?.font === '280px' && value.visibleRatio >= 0.8,
  );
  const layer = await evaluate(`(() => {
    const node=document.querySelector('#damageFloatLayer');
    const style=getComputedStyle(node);
    const preview=document.querySelector('#damageFloatPreview');
    const sample=preview.querySelector('.damage-preview.segment');
    const criticalSample=preview.querySelector('.damage-preview.critical');
    const reference=preview.querySelector('.damage-preview-reference');
    const markers=[...preview.querySelectorAll('.damage-preview-marker')];
    return {
      pointerEvents:style.pointerEvents,
      overflow:style.overflow,
      fontSizeVariable:node.style.getPropertyValue('--damage-float-size'),
      opacityVariable:node.style.getPropertyValue('--damage-float-opacity'),
      weightVariable:node.style.getPropertyValue('--damage-float-weight'),
      familyVariable:node.style.getPropertyValue('--damage-float-family'),
      sliderMaximum:document.querySelector('#damageFloatScale').max,
      positionXValue:document.querySelector('#damageFloatPositionXValue').textContent,
      positionYValue:document.querySelector('#damageFloatPositionYValue').textContent,
      arcValue:document.querySelector('#damageFloatArcValue').textContent,
      previewFont:getComputedStyle(sample).fontSize,
      previewOpacity:getComputedStyle(sample).opacity,
      previewOpacityVariable:preview.style.getPropertyValue('--damage-float-opacity'),
      previewWeight:getComputedStyle(sample).fontWeight,
      previewFamily:getComputedStyle(sample).fontFamily,
      previewCriticalBackground:getComputedStyle(criticalSample,'::before').backgroundImage,
      previewOverflow:getComputedStyle(preview).overflow,
      markerCount:markers.length,
      pathPoints:document.querySelector('#damagePreviewPathLine').getAttribute('points'),
      referenceFont:getComputedStyle(reference).fontSize,
      activeCount:node.childElementCount,
      viewportWidth:document.documentElement.scrollWidth,
      clientWidth:document.documentElement.clientWidth
    };
  })()`);
  const arcMoved =
    moved &&
    (Math.abs(Number(moved.x) - Number(segment.x)) > 5 ||
      Math.abs(Number(moved.y) - Number(segment.y)) > 5);
  const pass =
    initialPreference.damageFloatScale === 50 &&
    initialPreference.damageFloatOpacity === 100 &&
    initialPreference.damageFloatPositionX === 72 &&
    initialPreference.damageFloatPositionY === 72 &&
    initialPreference.damageFloatArc === 100 &&
    preference.damageFloatScale === 80 &&
    preference.damageFloatOpacity === 65 &&
    preference.damageFloatWeight === 600 &&
    preference.damageFloatFont === 'consolas' &&
    preference.damageFloatPositionX === 35 &&
    preference.damageFloatPositionY === 55 &&
    preference.damageFloatArc === 140 &&
    segment.font === '22.4px' &&
    Number(segment.text) > 0 &&
    arcMoved &&
    Number(total.text) > 0 &&
    Number(critical.text) > 0 &&
    critical.background !== 'none' &&
    critical.clipPath !== 'none' &&
    attackAudio.some(
      (entry) => entry.started === true && Number(entry.volume) === 0.35,
    ) &&
    soundSyncedToFloat &&
    doubleAttackAudio.filter(
      (entry) =>
        entry.combatEventId === doubleAttackEventId &&
        entry.key === 'daggerAttack' &&
        entry.started,
    ).length === 1 &&
    doubleDaggerHits.length === 2 &&
    doublePoringHits.length === 2 &&
    doubleDaggerHits.map((entry) => Number(entry.hitIndex)).join(',') ===
      '0,1' &&
    doublePoringHits.map((entry) => Number(entry.hitIndex)).join(',') ===
      '0,1' &&
    doubleAttackEventIds.size === 1 &&
    combatTimingSource === true &&
    doubleAttackIntervals.dagger >= 60 &&
    doubleAttackIntervals.dagger <= 500 &&
    doubleAttackIntervals.poring >= 60 &&
    doubleAttackIntervals.poring <= 500 &&
    monsterCombatAudio.some(
      (entry) => entry.key === 'fabreAttack' && entry.started,
    ) &&
    monsterCombatAudio.some(
      (entry) => /^playerDamage/.test(entry.key) && entry.started,
    ) &&
    monsterCombatAudio.some(
      (entry) => entry.key === 'poringDie' && entry.started,
    ) &&
    interfaceAudio.some((entry) => entry.key === 'uiTab' && entry.started) &&
    interfaceAudio.some(
      (entry) => entry.key === 'itemDrinkPotion' && entry.started,
    ) &&
    interfaceAudio.some((entry) => entry.key === 'flyWing' && entry.started) &&
    interfaceAudio.some(
      (entry) => entry.key === 'itemPickup' && entry.started,
    ) &&
    interfaceAudio.some((entry) => entry.key === 'getCoin' && entry.started) &&
    interfaceAudio.some((entry) => entry.key === 'levelUp' && entry.started) &&
    layer.pointerEvents === 'none' &&
    layer.fontSizeVariable === '280px' &&
    layer.opacityVariable === '0.65' &&
    layer.weightVariable === '600' &&
    layer.familyVariable.includes('Consolas') &&
    layer.sliderMaximum === '1000' &&
    layer.positionXValue === '50%' &&
    layer.positionYValue === '50%' &&
    layer.arcValue === '50%' &&
    layer.previewFont === '280px' &&
    layer.previewOpacityVariable === '0.65' &&
    layer.previewWeight === '600' &&
    layer.previewFamily.includes('Consolas') &&
    layer.previewCriticalBackground !== 'none' &&
    layer.previewOverflow === 'hidden' &&
    layer.markerCount === 3 &&
    layer.pathPoints.split(' ').length === 3 &&
    layer.referenceFont === '280px' &&
    maximumSizeVisibility.visibleRatio >= 0.8 &&
    layer.activeCount <= 18 &&
    layer.viewportWidth === layer.clientWidth &&
    errors.length === 0;
  console.log(
    JSON.stringify(
      {
        result: pass ? 'DAMAGE_FLOATS_UI_PASS' : 'DAMAGE_FLOATS_UI_FAIL',
        viewport: '390x844',
        combatViewport,
        firstDamage,
        initialPreference,
        preference,
        segment,
        moved,
        arcMoved,
        total,
        critical,
        attackAudio,
        soundSyncedToFloat,
        doubleAttackAudio,
        doubleAttackIntervals,
        combatTimingSource,
        monsterCombatAudio,
        interfaceAudio,
        layer,
        maximumSizeVisibility,
        screenshots: [
          'tmp/damage-visual-settings-mobile.png',
          'tmp/damage-floats-total-mobile.png',
          'tmp/damage-floats-mobile.png',
          'tmp/damage-visual-max-preview-mobile.png',
        ],
        errors,
      },
      null,
      2,
    ),
  );
  if (!pass) throw new Error('damage floats UI validation failed');
} finally {
  if (evaluate) {
    await evaluate(`fetch('/api/preferences', {
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({damageFloatsEnabled:true,damageFloatScale:50,damageFloatOpacity:100,damageFloatWeight:800,damageFloatFont:'classic',damageFloatPositionX:72,damageFloatPositionY:72,damageFloatArc:100})
    }).catch(()=>{})`).catch(() => {});
  }
  socket?.close();
  browser.kill();
}
