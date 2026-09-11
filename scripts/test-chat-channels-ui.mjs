import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = process.env.RO_DEMO_ORIGIN ?? 'http://127.0.0.1:8788';
const fixture = JSON.parse(
  await readFile('.local/ro-stack/multiplayer-test-v2-credentials.json', 'utf8'),
);
const profile = mkdtempSync(join(tmpdir(), 'ro-chat-channel-ui-'));
const port = 19472;
const browser = spawn(
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { windowsHide: true },
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(read, predicate = Boolean, timeout = 15000) {
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
  const target = await fetch(
    `http://127.0.0.1:${port}/json/new?about:blank`,
    { method: 'PUT' },
  ).then((response) => response.json());
  const socket = new WebSocket(target.webSocketDebuggerUrl);
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
    if (
      message.method === 'Log.entryAdded' &&
      message.params?.entry?.level === 'error'
    )
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
    evaluate(
      "!document.querySelector('#characterSelectForm')?.classList.contains('hidden')",
    ),
  );
  await evaluate("document.querySelector('#characterSelectForm').requestSubmit()");
  await waitFor(() =>
    evaluate("!document.querySelector('#game')?.classList.contains('hidden')"),
  );
  const running = await evaluate(
    "document.querySelector('#status')?.textContent.includes('掛機中')",
  );
  if (!running) {
    await evaluate("document.querySelector('#start').click()");
    await waitFor(
      () => evaluate("document.querySelector('#status')?.textContent"),
      (value) => /掛機中|執行中/.test(value),
      45000,
    );
  }
  const channelUi = await evaluate(`(() => {
    const buttons=[...document.querySelectorAll('[data-chat-channel]')];
    document.querySelector('[data-chat-channel=private]').click();
    const privateState={
      recipientVisible:!document.querySelector('#chatRecipientRow').classList.contains('hidden'),
      placeholder:document.querySelector('#chatInput').placeholder,
      voiceDisabled:document.querySelector('#voiceRecord').disabled,
    };
    document.querySelector('[data-chat-channel=public]').click();
    document.querySelector('.social-window').scrollIntoView();
    return {
      count:buttons.length,
      labels:buttons.map((button)=>button.textContent.trim()),
      pageWidth:document.documentElement.scrollWidth,
      viewportWidth:innerWidth,
      privateState,
      publicVoiceEnabled:!document.querySelector('#voiceRecord').disabled,
    };
  })()`);
  const baselineVoiceId = await evaluate(
    "document.querySelector('#voiceRecord').dataset.lastVoiceId || ''",
  );
  await evaluate("document.querySelector('#voiceRecord').click()", true);
  await waitFor(() =>
    evaluate("document.querySelector('#voiceRecord').classList.contains('recording')"),
  );
  await sleep(1300);
  await evaluate("document.querySelector('#voiceRecord').click()");
  await waitFor(
    () => evaluate("document.querySelector('#voiceRecord').dataset.lastVoiceId || ''"),
    (value) => Boolean(value && value !== baselineVoiceId),
    20000,
  );
  const uploadedVoiceId = await evaluate(
    "document.querySelector('#voiceRecord').dataset.lastVoiceId",
  );
  const voiceUi = await waitFor(
    () =>
      evaluate(`(async()=>{
        const expected=${JSON.stringify(`/api/social/voice/${uploadedVoiceId}`)};
        const audio=[...document.querySelectorAll('#chatFeed audio')].find((entry)=>new URL(entry.src).pathname===expected);
        if(!audio)return null;
        const response=await fetch(audio.src);
        const data=await response.arrayBuffer();
        return {
          source:new URL(audio.src).pathname,
          responseOk:response.ok,
          contentType:response.headers.get('content-type'),
          byteLength:data.byteLength,
          controls:audio.controls,
          channel:audio.closest('.chat-line')?.dataset.chatChannel,
        };
      })()`, true),
    (value) => value?.responseOk && value.byteLength > 128,
    20000,
  );
  const screenshot = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile(
    'tmp/chat-channels-voice-mobile.png',
    Buffer.from(screenshot.result.data, 'base64'),
  );
  const pass =
    channelUi.count === 13 &&
    channelUi.pageWidth <= channelUi.viewportWidth &&
    channelUi.privateState.recipientVisible &&
    channelUi.privateState.placeholder === '輸入密語內容' &&
    channelUi.privateState.voiceDisabled &&
    channelUi.publicVoiceEnabled &&
    voiceUi.responseOk &&
    voiceUi.byteLength > 128 &&
    voiceUi.controls &&
    voiceUi.channel === 'public' &&
    errors.length === 0;
  console.log(
    JSON.stringify(
      {
        result: pass ? 'CHAT_CHANNELS_UI_PASS' : 'CHAT_CHANNELS_UI_FAIL',
        viewport: '390x844',
        channelUi,
        voiceUi,
        screenshot: 'tmp/chat-channels-voice-mobile.png',
        errors,
      },
      null,
      2,
    ),
  );
  if (!pass) throw new Error('chat channel UI validation failed');
  await call('Browser.close');
} finally {
  browser.kill();
}
