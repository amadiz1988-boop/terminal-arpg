import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = process.env.RO_DEMO_ORIGIN ?? 'http://127.0.0.1:8788';
const uiAccount = process.env.RO_UI_ACCOUNT ?? 'gate2_03';
const fixture = JSON.parse(
  await readFile('.local/ro-stack/multiplayer-test-v2-credentials.json', 'utf8'),
);
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = mkdtempSync(join(tmpdir(), 'ro-social-ui-'));
const debugPort = 19459;
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

for (let attempt = 0; attempt < 50; attempt += 1) {
  try {
    if ((await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok) break;
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 100));
}

try {
  const target = await fetch(
    `http://127.0.0.1:${debugPort}/json/new?about:blank`,
    { method: 'PUT' },
  ).then((response) => response.json());
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  const errors = [];
  const socialRequests = [];
  let requestId = 0;
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
    if (
      message.method === 'Network.responseReceived' &&
      message.params?.response?.url?.includes('/api/social')
    )
      socialRequests.push({
        url: message.params.response.url,
        status: message.params.response.status,
        mimeType: message.params.response.mimeType,
      });
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
  await call('Network.enable');
  await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await call('Page.navigate', { url: origin });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (
      await evaluate(
        "typeof document.querySelector('#loginForm')?.onsubmit === 'function' && document.querySelector('#loginServerStatus')?.textContent === '伺服器正常'",
      )
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const uiMessage = `介面實測 ${Date.now()}`;
  await evaluate(`(() => {
    const username=document.querySelector('#username');
    const password=document.querySelector('#password');
    username.value=${JSON.stringify(uiAccount)};
    password.value=${JSON.stringify(fixture.password)};
    username.dispatchEvent(new Event('input',{bubbles:true}));
    password.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('#loginForm').requestSubmit();
    return true;
  })()`);
  let characterSelectionShown = false,
    characterSelection = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    characterSelectionShown = await evaluate(
      "!document.querySelector('#characterSelectForm')?.classList.contains('hidden') && document.querySelector('#selectCharacterName')?.textContent.length > 0 && document.querySelector('#selectPaperdoll')?.complete && document.querySelector('#selectPaperdoll')?.naturalWidth > 0",
    );
    if (characterSelectionShown) {
      characterSelection = await evaluate(`(() => {
        const form=document.querySelector('#characterSelectForm');
        const rect=form.getBoundingClientRect();
        return {
          title:form.querySelector('.titlebar span')?.textContent,
          character:document.querySelector('#selectCharacterName')?.textContent,
          meta:document.querySelector('#selectCharacterMeta')?.textContent,
          paperdoll:new URL(document.querySelector('#selectPaperdoll').src).pathname,
          slots:form.querySelectorAll('.character-slot').length,
          enter:document.querySelector('#selectEnter')?.textContent,
          fullyVisible:rect.left>=0&&rect.right<=innerWidth&&rect.top>=0&&rect.bottom<=innerHeight,
        };
      })()`);
      const selectionShot = await call('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
      });
      await writeFile(
        'tmp/character-selection-mobile.png',
        Buffer.from(selectionShot.result.data, 'base64'),
      );
      await evaluate("document.querySelector('#characterSelectForm').requestSubmit()", true);
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  let loggedIn = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (
      await evaluate(
        "!document.querySelector('#game')?.classList.contains('hidden') && document.querySelector('#accountName')?.textContent.includes('帳號：')",
      )
    ) {
      loggedIn = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!loggedIn) {
    const loginState = await evaluate(`({
      authError:document.querySelector('#authError')?.textContent ?? 'unknown login error',
      gameHidden:document.querySelector('#game')?.classList.contains('hidden'),
      authHidden:document.querySelector('#auth')?.classList.contains('hidden'),
      characterHidden:document.querySelector('#characterForm')?.classList.contains('hidden'),
      accountName:document.querySelector('#accountName')?.textContent ?? '',
      status:document.querySelector('#status')?.textContent ?? '',
    })`);
    throw new Error(`browser login failed: ${JSON.stringify(loginState)}`);
  }
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await evaluate("!document.querySelector('#chatInput').disabled")) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const chatImmediate = await evaluate(`(() => {
    const input=document.querySelector('#chatInput');
    input.value=${JSON.stringify(uiMessage)};
    input.dispatchEvent(new Event('input',{bubbles:true}));
    const started=performance.now();
    document.querySelector('#chatForm').requestSubmit();
    return {
      latencyMs:performance.now()-started,
      inputCleared:input.value==='',
      pendingVisible:[...document.querySelectorAll('#chatFeed .chat-line.pending')].some(node=>node.textContent.includes(${JSON.stringify(uiMessage)})),
    };
  })()`);
  let chatConfirmed = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    chatConfirmed = await evaluate(`document.querySelector('#chatFeed').textContent.includes(${JSON.stringify(uiMessage)}) && ![...document.querySelectorAll('#chatFeed .chat-line.pending')].some(node=>node.textContent.includes(${JSON.stringify(uiMessage)}))`);
    if (chatConfirmed) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const chatDiagnostic = await evaluate(`({
    status:document.querySelector('#chatStatus').textContent,
    pending:[...document.querySelectorAll('#chatFeed .chat-line.pending')].map(node=>({text:node.textContent,commandId:node.dataset.commandId})),
  })`);
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const terrainPixels = await evaluate(`(() => {
      const canvas=document.querySelector('#minimap');
      const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      let count=0;
      for(let i=0;i<data.length;i+=4)
        if(data[i]>75 && data[i+1]>85 && data[i+2]>75) count++;
      return count;
    })()`);
    if (terrainPixels > 500) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await evaluate(
    "document.querySelector('[data-tab=hunt]').click();document.querySelector('.map-window').scrollIntoView()",
  );
  await new Promise((resolve) => setTimeout(resolve, 150));
  const mapShot = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile(
    'tmp/minimap-mobile.png',
    Buffer.from(mapShot.result.data, 'base64'),
  );
  await call('Emulation.setDeviceMetricsOverride', {
    width: 720,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await new Promise((resolve) => setTimeout(resolve, 250));
  await evaluate("document.querySelector('.map-window').scrollIntoView()");
  const desktopMap = await evaluate(`(() => {
    const wrap=document.querySelector('.minimap-wrap').getBoundingClientRect();
    const canvas=document.querySelector('#minimap').getBoundingClientRect();
    return {
      viewport:innerWidth,
      wrapWidth:wrap.width,
      canvasWidth:canvas.width,
      canvasHeight:canvas.height,
      rightGap:wrap.right-canvas.right,
      aspectMatches:Boolean(mapField) && Math.abs(canvas.height/canvas.width-mapField.height/mapField.width)<0.01,
    };
  })()`);
  const desktopMapShot = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile(
    'tmp/minimap-desktop.png',
    Buffer.from(desktopMapShot.result.data, 'base64'),
  );
  await call('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 150));
  await evaluate(`(() => {
    window.__sfxPlayCount={attack:0,hurt:0,defeat:0};
    for(const [key,audio] of Object.entries(combatAudio))
      audio.addEventListener('play',()=>window.__sfxPlayCount[key]++);
    return true;
  })()`);
  await call('Input.dispatchMouseEvent', {
    type: 'mousePressed', x: 8, y: 8, button: 'left', clickCount: 1,
  });
  await call('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: 8, y: 8, button: 'left', clickCount: 1,
  });
  const liveMotion = await evaluate(`(async()=>{
    const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const seen=new Map();
    const deadline=Date.now()+12000;
    while(Date.now()<deadline){
      for(const [key,track] of minimapTracks){
        const target=track.toX+','+track.toY;
        const previous=seen.get(key);
        seen.set(key,target);
        if(previous && previous!==target && track.until>performance.now()){
          await sleep(70);
          const sample=sampleMinimapTrack(minimapTracks.get(key),performance.now());
          const active=minimapTracks.get(key);
          const between=active && performance.now()<active.until &&
            (Math.abs(sample.x-active.toX)>0.001 || Math.abs(sample.y-active.toY)>0.001);
          if(between)return {observed:true,key,duration:active.until-active.since,x:sample.x,y:sample.y,toX:active.toX,toY:active.toY};
        }
      }
      await sleep(25);
    }
    return {observed:false};
  })()`, true);
  let sfxState;
  for(let attempt=0;attempt<80;attempt++){
    sfxState=await evaluate(`({counts:window.__sfxPlayCount,unlocked:Object.fromEntries(Object.entries(combatAudio).map(([k,a])=>[k,a.dataset.unlocked==='1']))})`);
    if(Object.values(sfxState.counts).some(count=>count>0))break;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  await evaluate("document.querySelector('[data-tab=character]').click()");
  await evaluate("document.querySelector('#emotionToggle').click()");
  const smoothing = await evaluate(`(async()=>{
    const start=performance.now();
    updateMinimapTrack('__qa__',10,10,start);
    updateMinimapTrack('__qa__',11,10,start+1);
    const track=minimapTracks.get('__qa__');
    const middle=sampleMinimapTrack(track,start+131);
    minimapTracks.delete('__qa__');
    return {duration:track.until-track.since,middleX:middle.x};
  })()`, true);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const loaded = await evaluate(
      "document.querySelector('#paperdollBody')?.complete && document.querySelector('#paperdollBody')?.naturalWidth > 0",
    );
    if (loaded) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const layout = await evaluate(`(() => {
    const basic = document.querySelector('.basic').closest('.window');
    const chat = document.querySelector('.social-window');
    const feed = document.querySelector('#chatFeed');
    const rect = chat.getBoundingClientRect();
    const canvas=document.querySelector('#minimap');
    const paperdoll=document.querySelector('#paperdollBody');
    const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    let terrainPixels=0;
    for(let i=0;i<pixels.length;i+=4)
      if(pixels[i]>75 && pixels[i+1]>85 && pixels[i+2]>75) terrainPixels++;
    return {
      width: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      chatAfterBasic: basic.nextElementSibling === chat,
      chatVisibleOnAbilityTab: getComputedStyle(chat).display !== 'none',
      abilityTabActive: document.querySelector('#character').classList.contains('active'),
      chatTop: rect.top,
      chatWidth: rect.width,
      messageCount: feed.querySelectorAll('.chat-line').length,
      hasTraditionalChinese: feed.textContent.includes(${JSON.stringify(uiMessage)}),
      emotionButtons: document.querySelectorAll('#emotionPalette [data-emotion-id]').length,
      emotionVisible: !document.querySelector('#emotionPalette').classList.contains('hidden'),
      inputMaxLength: document.querySelector('#chatInput').maxLength,
      basicSkill: document.querySelector('#basicSkillLevel').textContent,
      basicSkillButtonEnabled: !document.querySelector('#addBasicSkill').disabled,
      terrainPixels,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      mapWidth: mapField?.width ?? 0,
      mapHeight: mapField?.height ?? 0,
      aspectMatches: Boolean(mapField) && Math.abs(canvas.height/canvas.width-mapField.height/mapField.width)<0.01,
      mapStatus: document.querySelector('#mapPosition').textContent,
      mapLegend: {
        monsterCount: Number(document.querySelector('#mapMonsterCount')?.textContent ?? -1),
        playerCount: Number(document.querySelector('#mapPlayerCount')?.textContent ?? -1),
        mapMonsterTotal: Number(
          mapInfoData?.maps?.[minimapLive?.map]?.totalMonsters ?? -1,
        ),
        mapPlayerTotal: Number(minimapLive?.mapPlayerCount ?? -1),
        staticLabels: document.querySelector('.map-legend')?.textContent ?? '',
      },
      paperdollHasHair:/novice-(male|female)-hair-\\d+\\.png$/.test(new URL(paperdoll.src).pathname) && paperdoll.complete && paperdoll.naturalWidth>0,
      paperdollSource:new URL(paperdoll.src).pathname,
    };
  })()`);
  const audioUi = await evaluate(`(() => {
    const buttons=[...document.querySelectorAll('.tabs button')];
    const buttonRects=buttons.map(button=>({
      name:button.textContent.trim(),
      left:button.getBoundingClientRect().left,
      right:button.getBoundingClientRect().right,
      top:button.getBoundingClientRect().top,
      bottom:button.getBoundingClientRect().bottom,
    }));
    scrollTo(0,0);
    const quick=document.querySelector('#quickAudio');
    const quickRect=quick.getBoundingClientRect();
    quick.click();
    const panel=document.querySelector('#system');
    const music=document.querySelector('#musicVolume');
    const sound=document.querySelector('#soundVolume');
    const original=Number(sound.value);
    const probe=original===34?35:34;
    sound.value=String(probe);
    sound.dispatchEvent(new Event('input',{bubbles:true}));
    const soundUpdated=document.querySelector('#soundValue').textContent===probe+'%';
    sound.value=String(original);
    sound.dispatchEvent(new Event('input',{bubbles:true}));
    return {
      allTabsVisible:buttonRects.every(rect=>rect.left>=0&&rect.right<=innerWidth&&rect.top>=0&&rect.bottom<=innerHeight),
      tabRows:new Set(buttonRects.map(rect=>Math.round(rect.top))).size,
      quickVisible:quickRect.left>=0&&quickRect.right<=innerWidth&&quickRect.top>=0&&quickRect.bottom<=innerHeight,
      quickActivatedSystem:document.querySelector('[data-tab=system]').classList.contains('active'),
      systemVisible:getComputedStyle(panel).display!=='none',
      musicVisible:music.getBoundingClientRect().width>0,
      soundVisible:sound.getBoundingClientRect().width>0,
      soundUpdated,
      buttonRects,
    };
  })()`);
  const audioShot = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile('tmp/audio-ui-mobile.png', Buffer.from(audioShot.result.data, 'base64'));
  await evaluate("document.querySelector('[data-tab=mapInfo]').click()");
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const loaded = await evaluate(
      "document.querySelectorAll('#mapMonsterList .monster-entry').length === 10 && document.querySelectorAll('#mapMonsterList .drop-entry').length === 80",
    );
    if (loaded) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const mapInfoUi = await evaluate(`(() => {
    const monsters=[...document.querySelectorAll('#mapMonsterList .monster-entry')];
    const drops=[...document.querySelectorAll('#mapMonsterList .drop-entry')];
    monsters[0].open=true;
    const cardDrop=drops.find(node=>node.textContent.includes('卡片'));
    if(cardDrop)cardDrop.open=true;
    const icons=[...document.querySelectorAll('#mapMonsterList .drop-entry img')];
    return {
      title:document.querySelector('#mapInfoTitle')?.textContent,
      total:document.querySelector('#mapInfoTotal')?.textContent,
      source:document.querySelector('#mapInfoSource')?.textContent,
      monsterCount:monsters.length,
      dropCount:drops.length,
      names:monsters.map(node=>node.querySelector('.monster-summary-name')?.textContent ?? node.querySelector('summary b')?.textContent),
      descriptions:drops.filter(node=>node.querySelector('.drop-description')?.textContent.trim().length>0).length,
      iconsLoaded:icons.filter(icon=>icon.complete&&icon.naturalWidth>0).length,
      iconCount:icons.length,
      cardExpanded:Boolean(cardDrop?.open),
    };
  })()`);
  const mapInfoShot = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile('tmp/map-info-mobile.png', Buffer.from(mapInfoShot.result.data, 'base64'));
  await evaluate("document.querySelector('[data-tab=skills]').click()");
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (await evaluate("document.querySelectorAll('#skillList .skill-entry').length === 4"))
      break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const skillUi = await evaluate(`(() => {
    const entries=[...document.querySelectorAll('#skillList .skill-entry')];
    const firstDescription=entries[0]?.querySelector('.skill-description');
    if(firstDescription)firstDescription.open=true;
    return {
      count:entries.length,
      names:entries.map(entry=>entry.querySelector('b')?.textContent),
      handles:entries.map(entry=>entry.querySelector('small')?.textContent.split(' · ')[0]),
      descriptionCount:entries.filter(entry=>entry.querySelector('.skill-description p')?.textContent.trim().length>0).length,
      firstDescriptionOpen:Boolean(firstDescription?.open),
      basicLevel:document.querySelector('#basicSkillLevel')?.textContent,
      jobState:document.querySelector('#jobChangeState')?.textContent,
      jobChoices:document.querySelectorAll('[data-job-route]').length,
      enabledJobChoices:[...document.querySelectorAll('[data-job-route]')].filter(button=>!button.disabled).length,
    };
  })()`);
  const skillShot = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile('tmp/skill-ui-mobile.png', Buffer.from(skillShot.result.data, 'base64'));
  await evaluate("document.querySelector('.job-change-window').scrollIntoView()");
  const jobChangeShot = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile('tmp/job-change-mobile.png', Buffer.from(jobChangeShot.result.data, 'base64'));
  await evaluate("document.querySelector('[data-tab=character]').click()");
  await evaluate('scrollTo(0,0)');
  const shot = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile('tmp/social-ui-mobile.png', Buffer.from(shot.result.data, 'base64'));
  const interactions = await evaluate(`(async()=>{
    const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const waitFor=async(predicate,timeout=9000)=>{
      const deadline=Date.now()+timeout;
      while(Date.now()<deadline){if(predicate())return true;await sleep(60)}
      return false;
    };
    document.querySelector('[data-tab=character]').click();
    const statButton=document.querySelector('[data-stat=str]');
    const statStarted=performance.now();
    statButton.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
    statButton.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));
    const statConfirmed=await waitFor(()=>document.querySelector('#statNotice').textContent.includes('伺服器已確認能力配點'));
    const statMs=Math.round(performance.now()-statStarted);
    const resetButton=document.querySelector('#resetStats');
    const resetStarted=performance.now();
    resetButton.click();
    resetButton.click();
    const resetConfirmed=await waitFor(()=>document.querySelector('#statNotice').textContent.includes('能力值已重置，掛機持續進行'));
    const resetMs=Math.round(performance.now()-resetStarted);
    const runningAfterReset=document.querySelector('#status').textContent.includes('掛機中');

    document.querySelector('[data-tab=skills]').click();
    const skillButton=document.querySelector('#addBasicSkill');
    const skillBefore=Number(document.querySelector('#basicSkillLevel').textContent.replace(/\\D/g,''));
    let skillConfirmed=true,skillMs=0,skillSkippedAtMax=false;
    if(skillButton.disabled){skillSkippedAtMax=skillBefore>=9}else{
      const skillStarted=performance.now();
      skillButton.click();
      skillConfirmed=await waitFor(()=>Number(document.querySelector('#basicSkillLevel').textContent.replace(/\\D/g,''))>skillBefore);
      skillMs=Math.round(performance.now()-skillStarted);
    }

    document.querySelector('[data-tab=equipment]').click();
    let equipped=document.querySelector('.equip-slot.equipped[data-bin-id]');
    let unequipConfirmed=false,equipConfirmed=false,unequipMs=0,equipMs=0,itemAckMs=0;
    if(!equipped){
      const initialCandidate=document.querySelector('#equipmentInventoryList .inventory-item[data-action=\"equip\"]');
      if(initialCandidate){
        initialCandidate.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
        await waitFor(()=>document.querySelector('#equipmentItemNotice').textContent.includes('伺服器已確認穿上裝備'));
        equipped=document.querySelector('.equip-slot.equipped[data-bin-id]');
      }
    }
    if(equipped){
      const binId=equipped.dataset.binId;
      const unequipStarted=performance.now();
      equipped.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
      await waitFor(()=>document.querySelector('#equipmentItemNotice').textContent.includes('指令已送出'),1000);
      itemAckMs=Math.round(performance.now()-unequipStarted);
      unequipConfirmed=await waitFor(()=>document.querySelector('#equipmentItemNotice').textContent.includes('伺服器已確認卸下裝備'));
      unequipMs=Math.round(performance.now()-unequipStarted);
      const candidate=[...document.querySelectorAll('#equipmentInventoryList .inventory-item')].find(node=>node.dataset.binId===binId && node.dataset.action==='equip');
      if(candidate){
        const equipStarted=performance.now();
        candidate.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
        equipConfirmed=await waitFor(()=>document.querySelector('#equipmentItemNotice').textContent.includes('伺服器已確認穿上裝備'));
        equipMs=Math.round(performance.now()-equipStarted);
      }
    }
    document.querySelector('[data-tab=skills]').click();
    const jobStarted=performance.now();
    document.querySelector('[data-job-route=swordman]').click();
    const jobRouteVisible=await waitFor(()=>!document.querySelector('#jobRoutePanel').classList.contains('hidden'));
    const jobRouteMs=Math.round(performance.now()-jobStarted);
    document.querySelector('#jobResume').click();
    const jobResumeConfirmed=await waitFor(()=>document.querySelector('#jobRoutePanel').classList.contains('hidden'));
    return {statConfirmed,statMs,resetConfirmed,resetMs,runningAfterReset,skillConfirmed,skillMs,skillSkippedAtMax,itemAckMs,unequipConfirmed,unequipMs,equipConfirmed,equipMs,jobRouteVisible,jobRouteMs,jobResumeConfirmed};
  })()`, true);
  const pass =
    layout.documentWidth <= layout.width &&
    layout.chatAfterBasic &&
    layout.chatVisibleOnAbilityTab &&
    layout.abilityTabActive &&
    layout.chatWidth <= layout.width &&
    layout.messageCount > 0 &&
    layout.hasTraditionalChinese &&
    chatImmediate.inputCleared &&
    chatImmediate.pendingVisible &&
    chatImmediate.latencyMs < 50 &&
    chatConfirmed &&
    layout.emotionButtons === 25 &&
    layout.emotionVisible &&
    layout.inputMaxLength === 80 &&
    (layout.basicSkillButtonEnabled || layout.basicSkill === 'Lv.9') &&
    layout.terrainPixels > 500 &&
    layout.aspectMatches &&
    layout.paperdollHasHair &&
    characterSelectionShown &&
    characterSelection?.title === '角色選擇' &&
    characterSelection?.slots === 3 &&
    characterSelection?.fullyVisible &&
    audioUi.allTabsVisible &&
    audioUi.tabRows === 2 &&
    audioUi.quickVisible &&
    audioUi.quickActivatedSystem &&
    audioUi.systemVisible &&
    audioUi.musicVisible &&
    audioUi.soundVisible &&
    audioUi.soundUpdated &&
    mapInfoUi.title === '普隆德拉原野 08' &&
    mapInfoUi.total === '10 種／276 隻' &&
    mapInfoUi.monsterCount === 10 &&
    mapInfoUi.dropCount === 80 &&
    mapInfoUi.descriptions === 80 &&
    mapInfoUi.iconsLoaded === mapInfoUi.iconCount &&
    mapInfoUi.cardExpanded &&
    skillUi.count === 4 &&
    skillUi.descriptionCount === 4 &&
    skillUi.firstDescriptionOpen &&
    skillUi.handles.includes('NV_BASIC') &&
    skillUi.jobState === '可以轉職' &&
    skillUi.jobChoices === 6 &&
    skillUi.enabledJobChoices === 6 &&
    smoothing.duration >= 150 &&
    smoothing.middleX > 10 &&
    smoothing.middleX < 11 &&
    desktopMap.canvasWidth >= desktopMap.wrapWidth - 13 &&
    desktopMap.aspectMatches &&
    desktopMap.rightGap <= 7 &&
    layout.mapLegend.monsterCount === layout.mapLegend.mapMonsterTotal &&
    layout.mapLegend.playerCount === layout.mapLegend.mapPlayerTotal &&
    layout.mapLegend.staticLabels.includes('你') &&
    layout.mapLegend.staticLabels.includes('交戰') &&
    (liveMotion.observed || (smoothing.duration >= 260 && smoothing.middleX > 10 && smoothing.middleX < 11)) &&
    Object.values(sfxState.counts).some((count) => count > 0) &&
    interactions.statConfirmed &&
    interactions.statMs < 800 &&
    interactions.resetConfirmed &&
    interactions.resetMs < 800 &&
    interactions.runningAfterReset &&
    interactions.skillConfirmed &&
    interactions.unequipConfirmed &&
    interactions.equipConfirmed &&
    interactions.itemAckMs > 0 &&
    interactions.itemAckMs < 500 &&
    interactions.jobRouteVisible &&
    interactions.jobRouteMs < 1000 &&
    interactions.jobResumeConfirmed &&
    !layout.mapStatus.includes('失敗') &&
    errors.length === 0;
  console.log(
    JSON.stringify(
      {
        result: pass ? 'SOCIAL_UI_PASS' : 'SOCIAL_UI_FAIL',
    mobile: layout,
    characterSelectionShown,
    characterSelection,
        audioUi,
        mapInfoUi,
        skillUi,
        chatImmediate,
        chatConfirmed,
        chatDiagnostic,
        socialRequests,
        smoothing,
        liveMotion,
        sfxState,
        desktopMap,
        interactions,
        screenshot: 'tmp/social-ui-mobile.png',
        audioScreenshot: 'tmp/audio-ui-mobile.png',
        mapInfoScreenshot: 'tmp/map-info-mobile.png',
        skillScreenshot: 'tmp/skill-ui-mobile.png',
        jobChangeScreenshot: 'tmp/job-change-mobile.png',
        minimapScreenshot: 'tmp/minimap-mobile.png',
    minimapDesktopScreenshot: 'tmp/minimap-desktop.png',
    characterSelectionScreenshot: 'tmp/character-selection-mobile.png',
        errors,
      },
      null,
      2,
    ),
  );
  if (!pass) throw new Error('social UI validation failed');
  await call('Browser.close');
} finally {
  browser.unref();
}
process.exit(0);
