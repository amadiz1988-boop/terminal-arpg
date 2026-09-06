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
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
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
  await call('Page.enable');
  await call('Page.navigate', { url: 'http://127.0.0.1:3000/?fresh=1' });
  await new Promise((resolve) => setTimeout(resolve, 1800));
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate("document.querySelector('.class-card')?.click()");
  await new Promise((resolve) => setTimeout(resolve, 500));
  const before = await evaluate("({url:location.href,title:document.body.innerText.includes('人物能力與屬性狀態欄'),zeroStart:document.body.innerText.includes('Lv.1 從六圍各 1、剩餘 0 點開始'),statusPoint:[...document.querySelectorAll('.ro-derived div')].find(x=>x.innerText.includes('STATUS POINT'))?.innerText,oldTalent:document.body.innerText.includes('天賦 ·'),resourceTiles:document.querySelectorAll('.resource-tile').length,statRows:document.querySelectorAll('.ro-primary>div').length,derivedRows:document.querySelectorAll('.ro-derived>div').length,enabledPlus:document.querySelectorAll('.ro-primary button:not(:disabled)').length,overflow:document.documentElement.scrollWidth>innerWidth,dps:document.body.innerText.match(/DPS [0-9,]+/)?.[0],excerpt:document.body.innerText.slice(0,120)})");
  const after = await evaluate("({atk:[...document.querySelectorAll('.ro-derived div')].find(x=>x.innerText.startsWith('ATK'))?.innerText,def:[...document.querySelectorAll('.ro-derived div')].find(x=>x.innerText.startsWith('DEF'))?.innerText,resetDisabled:document.querySelector('.stat-reset')?.disabled})");
  console.log(JSON.stringify({ before, after }, null, 2));
  await call('Browser.close');
} finally {
  browser.unref();
}
