import { execFile, spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const origin = process.env.RO_DEMO_ORIGIN ?? 'http://127.0.0.1:8788';
const uiMode = process.argv.includes('--ui');
const requestedJob =
  process.argv.find((argument) => argument.startsWith('--job='))?.slice(6) ??
  'swordman';
const jobSpecs = {
  swordman: {
    username: 'jobtest_swordman',
    characterName: 'JobTestSwordman',
    displayName: '劍士',
    jobId: 1,
    rewardId: 13415,
    rewardKey: 'N_Falchion',
    expectedSkillHandles: ['SM_SWORD', 'SM_BASH'],
    application: /want to be a Swordman/i,
  },
  acolyte: {
    username: 'jobtest_acolyte',
    characterName: 'JobTestAcolyte',
    displayName: '服事',
    jobId: 4,
    rewardId: 1545,
    rewardKey: 'N_Mace',
    expectedSkillHandles: ['AL_DP', 'AL_HEAL'],
    application: /Change your job to acolyte/i,
  },
  mage: {
    username: 'jobtest_mage',
    characterName: 'JobTestMage',
    displayName: '魔法師',
    jobId: 2,
    rewardId: 1639,
    rewardKey: 'N_Rod',
    expectedSkillHandles: ['MG_SRECOVERY', 'MG_SIGHT'],
    application: /^I want to be a Mage$/i,
    routeTimeout: 600_000,
  },
  archer: {
    username: 'jobtest_archer',
    characterName: 'JobTestArcher',
    displayName: '弓箭手',
    jobId: 3,
    rewardId: 1742,
    rewardKey: 'N_Composite_Bow',
    extraRewardIds: [12004, 12008, 12009],
    expectedSkillHandles: ['AC_OWL', 'AC_DOUBLE'],
    application: /^I want to be an Archer\.$/i,
    routeTimeout: 600_000,
  },
  thief: {
    username: 'jobtest_thief',
    characterName: 'JobTestThief',
    displayName: '盜賊',
    jobId: 6,
    rewardId: 13041,
    rewardKey: 'Knife_',
    expectedSkillHandles: ['TF_DOUBLE', 'TF_MISS'],
    routeTimeout: 600_000,
  },
  merchant: {
    username: 'jobtest_merchant',
    characterName: 'JobTestMerchant',
    displayName: '商人',
    jobId: 5,
    rewardId: 1381,
    rewardKey: 'N_Battle_Axe',
    expectedSkillHandles: ['MC_INCCARRY', 'MC_DISCOUNT'],
    routeTimeout: 600_000,
  },
};
const job = jobSpecs[requestedJob];
if (!job) throw new Error(`unsupported first job: ${requestedJob}`);
const { username, characterName } = job;
const fixture = JSON.parse(
  await readFile('.local/ro-stack/multiplayer-test-v2-credentials.json', 'utf8'),
);
const secrets = JSON.parse(
  await readFile('.local/ro-stack/secrets.json', 'utf8'),
);
const mariaFolder = (await readdir('C:\\Program Files'))
  .filter((name) => name.startsWith('MariaDB '))
  .sort()
  .reverse()[0];
if (!mariaFolder) throw new Error('MariaDB client unavailable');
const maria = join('C:\\Program Files', mariaFolder, 'bin', 'mariadb.exe');
const session = { cookie: '' };
let uiBrowser = null;
process.on('exit', () => uiBrowser?.kill());

async function sql(statement) {
  const { stdout } = await execFileAsync(
    maria,
    [
      '--ssl=OFF',
      '--protocol=tcp',
      '-h',
      '127.0.0.1',
      '-P',
      '3307',
      '-u',
      'rathena_local',
      '-N',
      '-B',
      'ragnarok',
      '--execute',
      statement,
    ],
    {
      env: { ...process.env, MYSQL_PWD: secrets.databasePassword },
      windowsHide: true,
    },
  );
  return stdout.trim();
}

async function request(path, options = {}) {
  const response = await fetch(`${origin}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      origin,
      ...(session.cookie ? { cookie: session.cookie } : {}),
      ...options.headers,
    },
  });
  const body = await response.json();
  const cookie = response.headers.get('set-cookie');
  if (cookie) session.cookie = cookie.split(';')[0];
  if (!response.ok)
    throw new Error(`${path}: ${body.error ?? response.status}`);
  return body;
}

async function waitFor(read, predicate, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  let value;
  while (Date.now() < deadline) {
    value = await read();
    if (predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`timed out waiting for server state: ${JSON.stringify(value)}`);
}

async function jobAction(body) {
  return await request('/api/job-change', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function live() {
  return (await request('/api/events')).live;
}

async function openJobUi() {
  const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const profile = mkdtempSync(join(tmpdir(), 'ro-first-job-ui-'));
  const debugPort = 19460 + job.jobId;
  uiBrowser = spawn(
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
  await waitFor(
    async () => {
      try {
        return (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok;
      } catch {
        return false;
      }
    },
    Boolean,
    8_000,
  );
  const target = await fetch(
    `http://127.0.0.1:${debugPort}/json/new?about:blank`,
    { method: 'PUT' },
  ).then((response) => response.json());
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  const errors = [];
  const failedResources = [];
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
    if (
      message.method === 'Network.responseReceived' &&
      Number(message.params?.response?.status) >= 400
    )
      failedResources.push({
        status: message.params.response.status,
        url: message.params.response.url,
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
  const evaluate = async (expression) =>
    (
      await call('Runtime.evaluate', {
        expression,
        awaitPromise: true,
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
  await waitFor(
    () =>
      evaluate(
        "typeof document.querySelector('#loginForm')?.onsubmit === 'function' && document.querySelector('#loginServerStatus')?.textContent === '伺服器正常'",
      ),
    Boolean,
    10_000,
  );
  await evaluate(`(() => {
    const username=document.querySelector('#username');
    const password=document.querySelector('#password');
    username.value=${JSON.stringify(username)};
    password.value=${JSON.stringify(fixture.password)};
    username.dispatchEvent(new Event('input',{bubbles:true}));
    password.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('#loginForm').requestSubmit();
    return true;
  })()`);
  await waitFor(
    () =>
      evaluate(
        "!document.querySelector('#characterSelectForm')?.classList.contains('hidden')",
      ),
    Boolean,
    10_000,
  );
  await evaluate("document.querySelector('#characterSelectForm').requestSubmit()");
  await waitFor(
    () =>
      evaluate("!document.querySelector('#game')?.classList.contains('hidden')"),
    Boolean,
    10_000,
  );
  await evaluate(
    "document.querySelector('[data-tab=skills]').click();document.querySelector('.job-change-window').scrollIntoView()",
  );
  const click = async (selector) => {
    await waitFor(
      () =>
        evaluate(`(() => {
          const button=document.querySelector(${JSON.stringify(selector)});
          if(!button || button.disabled) return false;
          button.click();
          return true;
        })()`),
      Boolean,
      8_000,
    );
  };
  return { call, evaluate, errors, failedResources, click };
}

const login = await request('/api/account', {
  method: 'POST',
  body: JSON.stringify({ username, password: fixture.password, sex: 'M' }),
});
let state = await request('/api/state');
if (state.needsCharacter) {
  await request('/api/characters', {
    method: 'POST',
    body: JSON.stringify({ name: characterName, hair: 7, hairColor: 2, sex: 'M', targetJob: requestedJob }),
  });
  state = await request('/api/state');
}

await request('/api/automation', {
  method: 'POST',
  body: JSON.stringify({ action: 'stop' }),
});
await waitFor(
  () => request('/api/state'),
  (current) => !current.running && !current.character?.online,
  20_000,
);

const accountId = Number(login.account.accountId);
if (!Number.isInteger(accountId)) throw new Error('test account id unavailable');
const charId = Number(
  await sql(
    `SELECT char_id FROM \`char\` WHERE account_id=${accountId} AND char_num=0 LIMIT 1;`,
  ),
);
if (!Number.isInteger(charId)) throw new Error('test character id unavailable');
const rewardIds = [job.rewardId, ...(job.extraRewardIds ?? [])];
await sql(`UPDATE \`char\` SET class=0,base_level=80,job_level=10,job_exp=0,skill_point=0,zeny=100000,str=1,agi=50,vit=99,\`int\`=1,dex=50,luk=1,max_hp=10000,hp=10000,max_sp=1000,sp=1000,status_point=0,last_map='prt_fild08',last_x=170,last_y=374,online=0 WHERE char_id=${charId};
DELETE FROM skill WHERE char_id=${charId};
INSERT INTO skill (char_id,id,lv,flag) VALUES (${charId},1,9,0);
DELETE FROM char_reg_num WHERE char_id=${charId} AND \`key\`='q_job_thief';
DELETE FROM char_reg_num WHERE char_id=${charId} AND \`key\`='terminal_academy_graduated';
DELETE FROM char_reg_str WHERE char_id=${charId} AND \`key\`='terminal_target_job$';
DELETE FROM inventory WHERE char_id=${charId} AND nameid IN (${[...rewardIds, 7060].join(',')});
INSERT INTO inventory (char_id,nameid,amount,equip,identify) VALUES (${charId},7060,30,0,1);`);
await request('/api/job-target', {
  method: 'POST',
  body: JSON.stringify({ job: requestedJob }),
});

await request('/api/automation', {
  method: 'POST',
  body: JSON.stringify({ action: 'start' }),
});
let current = await waitFor(
  live,
  (snapshot) =>
    Number(snapshot?.jobId) === 0 &&
    Number(snapshot?.jobLevel) === 10 &&
    Number(snapshot?.basicSkillLevel) === 9,
  45_000,
);
const ui = uiMode ? await openJobUi() : null;
const routeTransitions = [];
let previousRouteMap = '';

if (ui) await ui.click(`[data-job-route="${requestedJob}"]`);
else await jobAction({ action: 'route', job: requestedJob });
current = await waitFor(
  live,
  (snapshot) => {
    if (snapshot?.map && snapshot.map !== previousRouteMap) {
      routeTransitions.push(snapshot.map);
      previousRouteMap = snapshot.map;
    }
    return snapshot?.jobRoute?.arrived;
  },
  job.routeTimeout ?? 240_000,
);
if (!routeTransitions.includes('izlude') || !routeTransitions.includes('iz_ac01'))
  throw new Error(`Academy route incomplete: ${routeTransitions.join(' -> ')}`);
if (routeTransitions.some((map) => ['geffen_in', 'payon_in02', 'prt_church', 'alberta_in', 'moc_prydb1'].includes(map)))
  throw new Error(`Legacy guild route was used: ${routeTransitions.join(' -> ')}`);
if (ui) await ui.click('#jobTalk');
else await jobAction({ action: 'talk', job: requestedJob });
current = await waitFor(
  live,
  (snapshot) => snapshot?.npcDialog?.active && snapshot.npcDialog.stage === 'next',
);
const dialogSteps = [current.npcDialog.message];
for (let step = 0; step < 2; step += 1) {
  if (ui) await ui.click('[data-npc-action="next"]');
  else await jobAction({ action: 'next' });
  current = await waitFor(
    live,
    (snapshot) => snapshot?.npcDialog?.active && snapshot.npcDialog.stage === (step === 0 ? 'next' : 'select'),
  );
  dialogSteps.push(current.npcDialog.message);
}
const graduationChoice = current.npcDialog.responses.findIndex((response) =>
  /^Complete graduation\.$/i.test(response),
);
if (graduationChoice < 0) throw new Error('Academy graduation choice unavailable');
if (ui) await ui.click(`[data-npc-choice="${graduationChoice + 1}"]`);
else await jobAction({ action: 'select', choice: graduationChoice + 1 });
current = await waitFor(
  live,
  (snapshot) =>
    Number(snapshot?.jobId) === job.jobId &&
    rewardIds.every((rewardId) =>
      snapshot.inventory?.some((item) => Number(item.itemId) === rewardId),
    ),
  20_000,
);
const resultAtGuild = {
  jobId: current.jobId,
  jobLevel: current.jobLevel,
  basicSkillLevel: current.basicSkillLevel,
  receivedReward: current.inventory.some(
    (item) => Number(item.itemId) === job.rewardId,
  ),
  rewardId: job.rewardId,
  rewardKey: job.rewardKey,
  receivedRewardIds: rewardIds.filter((rewardId) =>
    current.inventory.some((item) => Number(item.itemId) === rewardId),
  ),
  kafraTickets: Number(
    current.inventory.find((item) => Number(item.itemId) === 7060)?.amount ?? 0,
  ),
};

let uiEvidence = null;
if (ui) {
  await waitFor(
    () =>
      ui.evaluate(
        `document.querySelector('#jobChangeState')?.textContent.includes(${JSON.stringify(`已轉職：${job.displayName}`)}) && document.querySelector('#jobName')?.textContent === ${JSON.stringify(job.displayName)} && document.querySelector('#jobLevel')?.textContent === '1'`,
      ),
    Boolean,
  );
  await waitFor(
    () =>
      ui.evaluate(
        `(() => { const text=document.querySelector('#skillList')?.textContent ?? ''; return ${JSON.stringify(job.expectedSkillHandles)}.every((handle) => text.includes(handle)); })()`,
      ),
    Boolean,
  );
  const visibleSkillHandles = await ui.evaluate(
    "[...document.querySelectorAll('#skillList .skill-entry small')].map((node) => node.textContent.split(' · ')[0])",
  );
  const screenshot = await ui.call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile(
    `tmp/first-job-change-${requestedJob}-mobile.png`,
    Buffer.from(screenshot.result.data, 'base64'),
  );
  await ui.click('[data-tab="inventory"]');
  await ui.click('[data-inventory="equipment"]');
  const rewardIconSelector = `#inventoryList .inventory-item img[src$="/${job.rewardKey}.png"]`;
  await waitFor(
    () =>
      ui.evaluate(
        `(() => { const image=document.querySelector(${JSON.stringify(rewardIconSelector)}); return Boolean(image?.complete && image.naturalWidth > 0); })()`,
      ),
    Boolean,
  );
  const rewardScreenshot = await ui.call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile(
    `tmp/first-job-change-${requestedJob}-reward-mobile.png`,
    Buffer.from(rewardScreenshot.result.data, 'base64'),
  );
  uiEvidence = {
    jobState: await ui.evaluate(
      "document.querySelector('#jobChangeState')?.textContent",
    ),
    headerJob: await ui.evaluate("document.querySelector('#jobName')?.textContent"),
    headerJobLevel: await ui.evaluate(
      "document.querySelector('#jobLevel')?.textContent",
    ),
    headerLocation: await ui.evaluate(
      "document.querySelector('#location')?.textContent",
    ),
    routePanelVisible: await ui.evaluate(
      "!document.querySelector('#jobRoutePanel')?.classList.contains('hidden')",
    ),
    visibleSkillHandles,
    screenshot: `tmp/first-job-change-${requestedJob}-mobile.png`,
    rewardIconLoaded: await ui.evaluate(
      `(() => { const image=document.querySelector(${JSON.stringify(rewardIconSelector)}); return Boolean(image?.complete && image.naturalWidth > 0); })()`,
    ),
    rewardScreenshot: `tmp/first-job-change-${requestedJob}-reward-mobile.png`,
    errors: ui.errors.filter(
      (message) => !message.startsWith('Failed to load resource:'),
    ),
    failedResources: [
      ...new Map(
        ui.failedResources.map((resource) => [resource.url, resource]),
      ).values(),
    ],
  };
  if (uiEvidence.errors.length || uiEvidence.failedResources.length)
    throw new Error(`browser errors: ${JSON.stringify(uiEvidence)}`);
  await ui.click('[data-tab="skills"]');
  await ui.click('#jobResume');
} else await jobAction({ action: 'resume' });
current = await waitFor(
  live,
  (snapshot) =>
    snapshot?.map === 'prt_fild08' &&
    !snapshot?.jobRoute &&
    snapshot.inventory?.some((item) => Number(item.itemId) === 7060),
  job.routeTimeout ?? 240_000,
);
const resumedMap = current.map;
const remainingKafraTickets = Number(
  current.inventory.find((item) => Number(item.itemId) === 7060)?.amount ?? 0,
);
if (requestedJob === 'archer' && remainingKafraTickets !== 28)
  throw new Error(`Kafra ticket consumption mismatch: ${remainingKafraTickets}`);
await request('/api/automation', {
  method: 'POST',
  body: JSON.stringify({ action: 'stop' }),
});
await waitFor(
  () => request('/api/state'),
  (snapshot) => !snapshot.running && !snapshot.character?.online,
  20_000,
);
if (ui) await ui.call('Browser.close');

console.log(
  JSON.stringify(
    {
      result: 'FIRST_JOB_CHANGE_PASS',
      account: username,
      character: characterName,
      route: requestedJob,
      routeTransitions,
      dialogSteps,
      atGuild: resultAtGuild,
      resumedMap,
      remainingKafraTickets,
      resumedJobId: current.jobId,
      testWorkerStopped: true,
      ui: uiEvidence,
    },
    null,
    2,
  ),
);
