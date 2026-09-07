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

  await call('Runtime.enable');
  await call('Log.enable');
  await call('Page.enable');
  const qaUrl = process.env.QA_URL ?? 'http://127.0.0.1:3000/?fresh=1';
  await call('Page.navigate', { url: qaUrl });
  await new Promise((resolve) => setTimeout(resolve, 1800));
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate("document.querySelector('.class-card')?.click()");
  await new Promise((resolve) => setTimeout(resolve, 500));
  const before = await evaluate("({url:location.href,title:document.body.innerText.includes('人物能力與屬性狀態欄'),zeroStart:document.body.innerText.includes('Lv.1 從六圍各 1、剩餘 0 點開始'),statusPoint:[...document.querySelectorAll('.ro-derived div')].find(x=>x.innerText.includes('STATUS POINT'))?.innerText,oldTalent:document.body.innerText.includes('天賦 ·'),resourceTiles:document.querySelectorAll('.resource-tile').length,statRows:document.querySelectorAll('.ro-primary>div').length,derivedRows:document.querySelectorAll('.ro-derived>div').length,enabledPlus:document.querySelectorAll('.ro-primary button:not(:disabled)').length,overflow:document.documentElement.scrollWidth>innerWidth,dps:document.body.innerText.match(/DPS [0-9,]+/)?.[0],excerpt:document.body.innerText.slice(0,120)})");
  const after = await evaluate("({atk:[...document.querySelectorAll('.ro-derived div')].find(x=>x.innerText.startsWith('ATK'))?.innerText,def:[...document.querySelectorAll('.ro-derived div')].find(x=>x.innerText.startsWith('DEF'))?.innerText,resetDisabled:document.querySelector('.stat-reset')?.disabled})");
  await evaluate("[...document.querySelectorAll('button')].find(x=>x.innerText.includes('執行任務'))?.click()");
  await new Promise((resolve) => setTimeout(resolve, 18000));
  const combat = await evaluate("({kills:Number(document.body.innerText.match(/本圖擊殺 (\\d+)\\//)?.[1]??0),xp:Number([...document.querySelectorAll('.metric-tile')].find(x=>x.innerText.includes('經驗'))?.innerText.match(/\\d+/)?.[0]??0),expLogs:[...document.querySelectorAll('.log-line')].filter(x=>/\\[EXP\\]/.test(x.innerText)).length,dropLogs:[...document.querySelectorAll('.log-line')].filter(x=>/\\[DROP\\]/.test(x.innerText)).length,currencyLogs:[...document.querySelectorAll('.log-line')].filter(x=>/\\[CURRENCY\\]/.test(x.innerText)).length})");
  combat.errors=browserErrors;
  const pass=before.title&&before.zeroStart&&before.statusPoint?.includes('0')&&!before.oldTalent&&before.resourceTiles===0&&before.statRows===6&&before.derivedRows===9&&before.enabledPlus===0&&!before.overflow&&after.atk&&after.def&&after.resetDisabled&&combat.kills>0&&combat.xp>0&&combat.expLogs>0&&combat.dropLogs>0&&combat.currencyLogs>0&&combat.errors.length===0;
  console.log(JSON.stringify({ before, after, combat, pass }, null, 2));
  if(!pass)throw new Error('UI release gate failed');
  await call('Browser.close');
} finally {
  browser.unref();
}
