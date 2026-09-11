import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = process.env.RO_DEMO_ORIGIN ?? 'http://127.0.0.1:8788';
const fixture = JSON.parse(
  await readFile('.local/ro-stack/multiplayer-test-v2-credentials.json', 'utf8'),
);
const profile = mkdtempSync(join(tmpdir(), 'ro-foldable-windows-ui-'));
const port = 19642;
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
async function waitFor(read, predicate = Boolean, timeout = 30_000) {
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
  const result = await evaluate(`(() => {
    const titlebars=[...document.querySelectorAll('#game .window > .titlebar')];
    const panelChecks=[];
    for (const panel of document.querySelectorAll('#game .panel')) {
      document.querySelector('[data-tab="'+panel.id+'"]')?.click();
      for (const win of panel.querySelectorAll(':scope > .window')) {
        const button=win.querySelector(':scope > .titlebar > .window-fold-button');
        if (!button) continue;
        button.click();
        const collapsed=win.classList.contains('window-collapsed') &&
          button.getAttribute('aria-expanded')==='false' &&
          [...win.children].filter(el=>!el.classList.contains('titlebar'))
            .every(el=>getComputedStyle(el).display==='none');
        button.click();
        const expanded=!win.classList.contains('window-collapsed') &&
          button.getAttribute('aria-expanded')==='true';
        panelChecks.push({panel:panel.id,title:win.querySelector('.titlebar span')?.textContent,collapsed,expanded});
      }
    }
    document.querySelector('[data-tab="hunt"]')?.click();
    document.querySelector('#game > .window .window-fold-button')?.click();
    return {
      titlebars:titlebars.length,
      buttons:document.querySelectorAll('#game .window-fold-button').length,
      panelChecks,
      officialAssets:[...document.querySelectorAll('.window-fold-button')].every(button=>
        getComputedStyle(button).backgroundImage.includes('/ro/client/skin/default/scroll0')),
      width:document.documentElement.scrollWidth,
      viewport:innerWidth
    };
  })()`);
  const exposure = await evaluate(`Promise.all([
    fetch(document.querySelector('script[src]')?.src).then(r=>r.text()),
    fetch('/api/state').then(r=>r.text()),
    fetch('/ro/data/map-info.json').then(r=>r.text()),
    fetch('/ro/data/skill-trees.json').then(r=>r.text())
  ]).then(parts=>({
    title:document.title,
    body:document.body.innerText,
    publicPayload:parts.join('\\n'),
    exposureParts:{app:/rAthena|OpenKore/i.test(parts[0]),state:/rAthena|OpenKore/i.test(parts[1]),map:/rAthena|OpenKore/i.test(parts[2]),skills:/rAthena|OpenKore/i.test(parts[3])},
    exposureContexts:parts[1].match(/.{0,30}(?:rAthena|OpenKore).{0,60}/gi)?.slice(0,5) ?? []
  }))`);
  const screenshot = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile(
    'tmp/foldable-windows-mobile.png',
    Buffer.from(screenshot.result.data, 'base64'),
  );
  const pass =
    result.titlebars > 0 &&
    result.buttons === result.titlebars &&
    result.panelChecks.length > 0 &&
    result.panelChecks.every((entry) => entry.collapsed && entry.expanded) &&
    result.officialAssets &&
    !/rAthena|OpenKore/i.test(
      `${exposure.title}\n${exposure.body}\n${exposure.publicPayload}`,
    ) &&
    result.width <= result.viewport &&
    errors.length === 0;
  console.log(
    JSON.stringify(
      {
        result: pass ? 'FOLDABLE_WINDOWS_UI_PASS' : 'FOLDABLE_WINDOWS_UI_FAIL',
        origin,
        viewport: '390x844',
        ...result,
        implementationNamesExposed: /rAthena|OpenKore/i.test(
          `${exposure.title}\n${exposure.body}\n${exposure.publicPayload}`,
        ),
        exposureParts: exposure.exposureParts,
        exposureContexts: exposure.exposureContexts,
        screenshot: 'tmp/foldable-windows-mobile.png',
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
