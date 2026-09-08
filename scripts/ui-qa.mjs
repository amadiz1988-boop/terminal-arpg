import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = mkdtempSync(join(tmpdir(), 'terminal-arpg-ui-'));
const debugPort = 19456;
const browser = spawn(chrome, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true });
for (let attempt = 0; attempt < 20; attempt += 1) {
  try {
    const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
    if (response.ok) break;
  } catch { /* Chrome is still starting. */ }
  await new Promise((resolve) => setTimeout(resolve, 150));
}

try {
  const tab = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' }).then((response) => response.json());
  const socket = new WebSocket(tab.webSocketDebuggerUrl);
  let requestId = 0;
  const pending = new Map();
  const browserErrors = [];
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') browserErrors.push({text:message.params?.exceptionDetails?.text ?? 'Runtime exception',url:message.params?.exceptionDetails?.url});
    if (message.method === 'Log.entryAdded' && message.params?.entry?.level === 'error') browserErrors.push({text:message.params.entry.text,url:message.params.entry.url});
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  };
  await new Promise((resolve) => { socket.onopen = resolve; });
  const call = (method, params = {}) => new Promise((resolve) => {
    const id = ++requestId;
    pending.set(id, resolve);
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => (await call('Runtime.evaluate', { expression, returnByValue: true })).result.result.value;
  const waitUntil = async (expression, attempts = 40) => {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try { if (await evaluate(expression)) return true; } catch { /* Navigation context is not ready yet. */ }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return false;
  };
  const observeCombat = async (attempts = 3000) => {
    let sawProjectile=false,sawCyclone=false,sawHurt=false,sawEngaged=false,maxMonsterDots=0;
    for (let attempt = 0; attempt < attempts && (!sawCyclone||!sawHurt||!sawEngaged||maxMonsterDots<5); attempt += 1) {
      try { const pulse=await evaluate("({projectile:Boolean(document.querySelector('.combat-vector')),cyclone:Boolean(document.querySelector('.cyclone-shape')),hurt:Boolean(document.querySelector('.field-map .player-marker.hurt')),engaged:Boolean(document.querySelector('.monster-marker.engaged')),monsterDots:document.querySelectorAll('.monster-marker').length})");sawProjectile ||= pulse.projectile;sawCyclone ||= pulse.cyclone;sawHurt ||= pulse.hurt;sawEngaged ||= pulse.engaged;maxMonsterDots=Math.max(maxMonsterDots,pulse.monsterDots); } catch { /* Animation frame replaced during observation. */ }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    return {sawProjectile,sawCyclone,sawHurt,sawEngaged,maxMonsterDots};
  };

  await call('Runtime.enable');
  await call('Log.enable');
  await call('Page.enable');
  const qaUrl = new URL(process.env.QA_URL ?? 'http://127.0.0.1:3000/?fresh=1');
  qaUrl.searchParams.set('qaSpeed','32');
  await call('Page.navigate', { url: qaUrl.href });
  if (!await waitUntil("document.body?.innerText.includes('TERMINAL ARPG')")) throw new Error('Site did not become ready');
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate("document.querySelector('.class-card')?.click()");
  if (!await waitUntil("document.body?.innerText.includes('人物能力與屬性狀態欄')")) throw new Error('Character screen did not become ready');
  const before = await evaluate("({url:location.href,title:document.body.innerText.includes('人物能力與屬性狀態欄'),zeroStart:document.body.innerText.includes('Lv.1 從六圍各 1、剩餘 0 點開始'),directT1:document.body.innerText.includes('啟動 T1 刷圖'),legacyTutorial:document.body.innerText.includes('新手遠征')||document.body.innerText.includes('執行任務'),fieldMonsters:Number(document.querySelector('.map-population b')?.innerText.match(/\\/(\\d+)/)?.[1]??0),statusPoint:[...document.querySelectorAll('.ro-derived div')].find(x=>x.innerText.includes('STATUS POINT'))?.innerText,oldTalent:document.body.innerText.includes('天賦 ·'),resourceTiles:document.querySelectorAll('.resource-tile').length,statRows:document.querySelectorAll('.ro-primary>div').length,derivedRows:document.querySelectorAll('.ro-derived>div').length,enabledPlus:document.querySelectorAll('.ro-primary button:not(:disabled)').length,overflow:document.documentElement.scrollWidth>innerWidth,dps:document.body.innerText.match(/DPS [0-9,]+/)?.[0],excerpt:document.body.innerText.slice(0,120)})");
  const after = await evaluate("({atk:[...document.querySelectorAll('.ro-derived div')].find(x=>x.innerText.startsWith('ATK'))?.innerText,def:[...document.querySelectorAll('.ro-derived div')].find(x=>x.innerText.startsWith('DEF'))?.innerText,resetDisabled:document.querySelector('.stat-reset')?.disabled})");
  await evaluate("[...document.querySelectorAll('button')].find(x=>x.innerText.includes('啟動 T1 刷圖'))?.click()");
  const combatObservation=await observeCombat();
  await waitUntil("Boolean(document.querySelector('.upgrade-alert button')&&document.querySelector('.log-drop')&&document.querySelector('.log-currency'))",60);
  const mapVisual=await evaluate("({playerMarker:document.querySelectorAll('.field-map .player-marker').length,legacyTrail:document.querySelectorAll('.field-map .trail').length,moveTiming:getComputedStyle(document.querySelector('.player-marker')).transitionTimingFunction,moveDuration:getComputedStyle(document.querySelector('.player-marker')).transitionDuration,zoomBefore:document.querySelector('.field-map')?.style.width,zoomButtons:document.querySelectorAll('.map-zoom button').length})");
  await evaluate("[...document.querySelectorAll('.map-zoom button')].at(-1)?.click()");
  mapVisual.zoomAfter=await evaluate("document.querySelector('.field-map')?.style.width");
  Object.assign(mapVisual,combatObservation);
  const upgradeVisible = await evaluate("Boolean(document.querySelector('.upgrade-alert button'))");
  if(upgradeVisible){await evaluate("document.querySelector('.upgrade-alert button').click()");await new Promise((resolve)=>setTimeout(resolve,500));}
  const skillChoiceVisible=await evaluate("Boolean(document.querySelector('.skill-choice-alert'))");
  const offeredSkill=skillChoiceVisible?await evaluate("document.querySelector('.skill-choice-alert b')?.innerText"):null;
  if(skillChoiceVisible){await evaluate("document.querySelector('.skill-choice-actions button:last-child')?.click()");await new Promise((resolve)=>setTimeout(resolve,300));}
  const skillChoice={visible:skillChoiceVisible,offeredSkill,socketLogs:await evaluate("[...document.querySelectorAll('.log-line')].filter(x=>/\\[SOCKET\\]/.test(x.innerText)).length"),activeSkill:await evaluate("document.querySelector('.character-hud small')?.innerText")};
  const combat = await evaluate("({kills:Number(document.body.innerText.match(/本圖擊殺 (\\d+)\\//)?.[1]??0),xp:Number([...document.querySelectorAll('.metric-tile')].find(x=>x.innerText.includes('經驗'))?.innerText.match(/\\d+/)?.[0]??0),expLogs:[...document.querySelectorAll('.log-line')].filter(x=>/\\[EXP\\]/.test(x.innerText)).length,dropLogs:[...document.querySelectorAll('.log-line')].filter(x=>/\\[DROP\\]/.test(x.innerText)).length,currencyLogs:[...document.querySelectorAll('.log-line')].filter(x=>/\\[CURRENCY\\]/.test(x.innerText)).length,chainLogs:[...document.querySelectorAll('.log-line')].filter(x=>/\\[CHAIN\\]/.test(x.innerText)).length,powerLogs:[...document.querySelectorAll('.log-line')].filter(x=>/\\[POWER\\]/.test(x.innerText)).length,lootLedger:document.querySelector('.map-loot-ledger')?.innerText})");
  combat.errors=browserErrors;combat.upgradeVisible=upgradeVisible;
  const smokeSkillShape=async(classIndex,selector)=>{
    const smokeUrl=new URL(qaUrl);smokeUrl.searchParams.set('fresh','1');smokeUrl.searchParams.set('smoke',String(classIndex));
    await call('Page.navigate',{url:smokeUrl.href});
    if(!await waitUntil("document.body?.innerText.includes('TERMINAL ARPG')"))return false;
    await evaluate(`document.querySelectorAll('.class-card')[${classIndex}]?.click()`);
    if(!await waitUntil("document.body?.innerText.includes('啟動 T1 刷圖')"))return false;
    await evaluate("[...document.querySelectorAll('button')].find(x=>x.innerText.includes('啟動 T1 刷圖'))?.click()");
    return waitUntil(`Boolean(document.querySelector('${selector}'))`,80);
  };
  const skillShapes={winterOrb:await smokeSkillShape(1,'.combat-vector.winter-orb'),penanceBrand:await smokeSkillShape(2,'.brand-vector')};
  const pass=before.title&&before.zeroStart&&before.directT1&&!before.legacyTutorial&&before.fieldMonsters>=400&&before.fieldMonsters<=600&&before.statusPoint?.includes('0')&&!before.oldTalent&&before.resourceTiles===0&&before.statRows===6&&before.derivedRows===9&&before.enabledPlus===0&&!before.overflow&&after.atk&&after.def&&after.resetDisabled&&combat.kills>=4&&combat.xp>0&&combat.expLogs>0&&combat.dropLogs>0&&combat.currencyLogs>0&&combat.upgradeVisible&&combat.powerLogs>0&&/拾取 [1-9]/.test(combat.lootLedger??'')&&/通貨 [1-9]/.test(combat.lootLedger??'')&&mapVisual.playerMarker===1&&mapVisual.legacyTrail===0&&mapVisual.moveTiming.includes('linear')&&mapVisual.moveDuration!=='0s'&&mapVisual.zoomBefore==='150%'&&mapVisual.zoomAfter==='200%'&&mapVisual.zoomButtons===2&&mapVisual.sawCyclone&&mapVisual.sawHurt&&mapVisual.sawEngaged&&mapVisual.maxMonsterDots>=5&&skillShapes.winterOrb&&skillShapes.penanceBrand&&combat.errors.length===0;
  console.log(JSON.stringify({ before, after, combat, mapVisual, skillChoice, skillShapes, pass }, null, 2));
  if(!pass)throw new Error('UI release gate failed');
  await call('Browser.close');
} finally {
  browser.unref();
}
