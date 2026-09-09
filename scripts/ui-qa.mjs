import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = mkdtempSync(join(tmpdir(), 'ro-idle-ui-'));
const debugPort = 19456;
const browser = spawn(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { windowsHide: true },
);

for (let attempt = 0; attempt < 30; attempt += 1) {
  try {
    if ((await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok) break;
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 150));
}

try {
  const tab = await fetch(
    `http://127.0.0.1:${debugPort}/json/new?about:blank`,
    { method: 'PUT' },
  ).then((response) => response.json());
  const socket = new WebSocket(tab.webSocketDebuggerUrl);
  let requestId = 0;
  const pending = new Map();
  const errors = [];
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown')
      errors.push(
        message.params?.exceptionDetails?.text ?? 'Runtime exception',
      );
    if (
      message.method === 'Log.entryAdded' &&
      message.params?.entry?.level === 'error'
    )
      errors.push(message.params.entry.text);
    if (message.method === 'Network.loadingFailed')
      errors.push(
        `${message.params?.errorText} ${message.params?.blockedReason ?? ''}`,
      );
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
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
    (await call('Runtime.evaluate', { expression, returnByValue: true })).result
      .result.value;
  const waitUntil = async (expression, attempts = 80) => {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        if (await evaluate(expression)) return true;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return false;
  };

  await call('Runtime.enable');
  await call('Log.enable');
  await call('Page.enable');
  await call('Network.enable');
  await call('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await call('Page.navigate', {
    url: process.env.QA_URL ?? 'http://127.0.0.1:3000/',
  });
  if (
    !(await waitUntil(
      "document.body?.innerText.includes('基本資訊') && Boolean(document.querySelector('.field-canvas'))",
    ))
  ) {
    console.log(
      JSON.stringify(
        {
          body: await evaluate('document.body?.innerText'),
          href: await evaluate('location.href'),
          errors,
        },
        null,
        2,
      ),
    );
    throw new Error('RO interface did not load');
  }
  if (
    !(await waitUntil(
      "document.querySelectorAll('.event-player_hit').length >= 3",
      160,
    ))
  )
    throw new Error('Step combat did not become visible');
  if (
    !(await waitUntil(
      "Boolean(document.querySelector('.event-death') && document.querySelector('.event-pickup'))",
      220,
    ))
  )
    throw new Error('Death or pickup did not become visible');
  const beforePause = await evaluate(
    "document.querySelectorAll('.event-player_hit,.event-player_miss,.event-move,.event-pickup').length",
  );
  await evaluate("document.querySelector('.control-window button').click()");
  await new Promise((resolve) => setTimeout(resolve, 650));
  const afterPause = await evaluate(
    "document.querySelectorAll('.event-player_hit,.event-player_miss,.event-move,.event-pickup').length",
  );
  await evaluate(
    "[...document.querySelectorAll('.ro-tabs button')].find(x=>x.innerText==='地圖情報')?.click()",
  );
  const mapInfo = await evaluate(
    "document.body.innerText.includes('波利')&&document.body.innerText.includes('瘋兔')&&document.body.innerText.includes('綠棉蟲')&&document.body.innerText.includes('蛹')&&document.body.innerText.includes('小波利')&&document.body.innerText.includes('掉落物')",
  );
  await evaluate(
    "[...document.querySelectorAll('.ro-tabs button')].find(x=>x.innerText==='技能')?.click()",
  );
  const skills = await evaluate(
    "document.body.innerText.includes('基本技能')&&document.body.innerText.includes('緊急治療')&&document.body.innerText.includes('剩餘技能點')",
  );
  await evaluate(
    "[...document.querySelectorAll('.ro-tabs button')].find(x=>x.innerText==='還原進度')?.click()",
  );
  const progress = await evaluate(
    "document.body.innerText.includes('世界地圖與怪物')&&document.body.innerText.includes('多人社交與伺服器')&&document.querySelector('.progress-panel meter')!==null",
  );
  const report = await evaluate(
    "({title:document.title,canvas:document.querySelector('.field-canvas').width,attack:document.querySelectorAll('.event-player_hit').length,death:document.querySelectorAll('.event-death').length,pickup:document.querySelectorAll('.event-pickup').length,baseExp:document.body.innerText.match(/人物經驗 ([0-9,]+)/)?.[1],jobExp:document.body.innerText.match(/職業經驗 ([0-9,]+)/)?.[1],pickedItems:document.body.innerText.includes('拾取物品'),englishItem:/\b(Jellopy|Sticky Mucus|Fly Wing|Poring Card)\b/.test(document.body.innerText),qaControlsAbsent:!document.body.innerText.includes('四倍測試')&&!document.body.innerText.includes('重新開始')&&!document.body.innerText.includes('4x'),stoppedWorld:document.body.innerText.includes('世界與怪物仍持續運作'),overflow:document.documentElement.scrollWidth>innerWidth})",
  );
  report.playerStopped = beforePause === afterPause;
  report.mapInfo = mapInfo;
  report.skills = skills;
  report.progress = progress;
  report.errors = errors;
  report.pass =
    report.canvas === 720 &&
    report.attack >= 3 &&
    report.death >= 1 &&
    report.pickup >= 1 &&
    Number(report.baseExp?.replaceAll(',', '')) > 0 &&
    Number(report.jobExp?.replaceAll(',', '')) > 0 &&
    report.mapInfo &&
    report.skills &&
    report.progress &&
    report.pickedItems &&
    !report.englishItem &&
    report.qaControlsAbsent &&
    report.stoppedWorld &&
    report.playerStopped &&
    !report.overflow &&
    errors.length === 0;
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) throw new Error('RO UI release gate failed');
  await call('Browser.close');
} finally {
  browser.unref();
}
