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
  await waitFor(() => evaluate("!document.querySelector('#chatInput').disabled"));
  const channelUi = await evaluate(`(() => {
    const buttons=[...document.querySelectorAll('#chatChannels [data-chat-channel]')];
    const sendChannel=document.querySelector('#chatSendChannel');
    document.querySelector('[data-chat-channel=all]').click();
    const allState={
      view:document.querySelector('#chatChannel').textContent,
      send:sendChannel.value,
      placeholder:document.querySelector('#chatInput').placeholder,
    };
    sendChannel.value='private';
    sendChannel.dispatchEvent(new Event('change',{bubbles:true}));
    const privateState={
      recipientVisible:!document.querySelector('#chatRecipientRow').classList.contains('hidden'),
      placeholder:document.querySelector('#chatInput').placeholder,
      voiceDisabled:document.querySelector('#voiceRecord').disabled,
    };
    sendChannel.value='public';
    sendChannel.dispatchEvent(new Event('change',{bubbles:true}));
    document.querySelector('#chatFilterToggle').click();
    const allVisibility=document.querySelector('[data-chat-visibility=all]');
    allVisibility.checked=false;
    allVisibility.dispatchEvent(new Event('change',{bubbles:true}));
    const allCanClose=document.querySelector('[data-chat-channel=all]').hidden;
    const visibleCount=buttons.filter((button)=>!button.hidden).length;
    const fold=document.querySelector('.social-window .window-fold-button');
    fold.click();
    const collapsed=document.querySelector('.social-window').classList.contains('window-collapsed');
    const collapsedIcon=getComputedStyle(fold).backgroundImage;
    fold.click();
    const expanded=!document.querySelector('.social-window').classList.contains('window-collapsed');
    const expandedIcon=getComputedStyle(fold).backgroundImage;
    const badgeRows=Object.keys(chatChannelBadges).map((channel)=>{
      const row=socialNode({
        at:Date.now(),
        type:'chat',
        channel,
        sender:'測試玩家',
        message:'測試訊息',
      });
      document.body.append(row);
      const badge=row.querySelector('.chat-channel-badge');
      const result={
        channel,
        label:badge?.textContent,
        background:getComputedStyle(badge).backgroundColor,
      };
      row.remove();
      return result;
    });
    const internalBefore=document.querySelectorAll('#chatFeed .chat-line').length;
    renderSocialDelta([{
      at:Date.now(),
      type:'chat',
      channel:'public',
      sender:'測試玩家',
      message:'@web_eden_return',
    }]);
    const internalFiltered=document.querySelectorAll('#chatFeed .chat-line').length===internalBefore;
    document.querySelector('.social-window').scrollIntoView();
    return {
      count:buttons.length,
      labels:buttons.map((button)=>button.textContent.trim()),
      pageWidth:document.documentElement.scrollWidth,
      viewportWidth:innerWidth,
      allState,
      privateState,
      publicVoiceEnabled:!document.querySelector('#voiceRecord').disabled,
      allCanClose,
      visibleCount,
      collapsed,
      expanded,
      collapsedIcon,
      expandedIcon,
      badgeRows,
      internalFiltered,
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
          label:audio.closest('.chat-line')?.querySelector('.chat-channel-badge')?.textContent,
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
  const expectedLabels={
    public:'一般',
    private:'密語',
    party:'隊伍',
    guild:'公會',
    clan:'家族',
    battleground:'戰場',
    map:'地圖',
    global:'全服',
    trade:'交易',
    support:'支援',
    ally:'同盟',
    system:'系統',
  };
  const expectedCustomColors={
    global:'rgb(255, 255, 255)',
    map:'rgb(255, 255, 144)',
    trade:'rgb(182, 255, 0)',
    support:'rgb(131, 207, 233)',
    ally:'rgb(40, 191, 0)',
  };
  const unexpectedErrors=errors.filter(
    (message)=>!message.includes('/ro/client/showcase/manifest.json'),
  );
  const pass =
    channelUi.count === 13 &&
    channelUi.pageWidth <= channelUi.viewportWidth &&
    channelUi.allState.view === '檢視：全部訊息' &&
    channelUi.allState.send === 'public' &&
    channelUi.allState.placeholder === '輸入一般頻道訊息' &&
    channelUi.privateState.recipientVisible &&
    channelUi.privateState.placeholder === '輸入密語內容' &&
    channelUi.privateState.voiceDisabled &&
    channelUi.publicVoiceEnabled &&
    channelUi.allCanClose &&
    channelUi.visibleCount >= 1 &&
    channelUi.collapsed &&
    channelUi.expanded &&
    channelUi.collapsedIcon.includes('chat_open.png') &&
    channelUi.expandedIcon.includes('chat_close.png') &&
    channelUi.badgeRows.every((row)=>expectedLabels[row.channel]===row.label) &&
    Object.entries(expectedCustomColors).every(([channel,color])=>
      channelUi.badgeRows.some((row)=>row.channel===channel && row.background===color)
    ) &&
    channelUi.internalFiltered &&
    voiceUi.responseOk &&
    voiceUi.byteLength > 128 &&
    voiceUi.controls &&
    voiceUi.channel === 'public' &&
    voiceUi.label === '一般' &&
    unexpectedErrors.length === 0;
  console.log(
    JSON.stringify(
      {
        result: pass ? 'CHAT_CHANNELS_UI_PASS' : 'CHAT_CHANNELS_UI_FAIL',
        viewport: '390x844',
        channelUi,
        voiceUi,
        screenshot: 'tmp/chat-channels-voice-mobile.png',
        errors:unexpectedErrors,
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
