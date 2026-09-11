import { spawn, execFile } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const origin = process.env.RO_DEMO_ORIGIN ?? 'http://127.0.0.1:8788';
const controlOrigin = 'http://127.0.0.1:8788';
const suffix = Date.now().toString(36);
const username = `jobtest_recover_${suffix}`.slice(0, 23);
const password = 'Recovery!2026';
const characterName = `Recover${suffix}`.slice(0, 24);
const registrationSource = '198.51.100.221';
let accountId = 0;
let charId = 0;
let apiCookie = '';

const secrets = JSON.parse(
  await readFile('.local/ro-stack/secrets.json', 'utf8'),
);
const mariaFolder = (await readdir('C:\\Program Files'))
  .filter((name) => name.startsWith('MariaDB '))
  .sort()
  .reverse()[0];
if (!mariaFolder) throw new Error('MariaDB client unavailable');
const maria = join('C:\\Program Files', mariaFolder, 'bin', 'mariadb.exe');
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
      maxBuffer: 1024 * 1024,
    },
  );
  return stdout.trim();
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${controlOrigin}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      origin: controlOrigin,
      ...(apiCookie ? { cookie: apiCookie } : {}),
      ...options.headers,
    },
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${path}: unexpected ${response.status} response`);
  }
  const cookie = response.headers.get('set-cookie');
  if (cookie) apiCookie = cookie.split(';')[0];
  if (!response.ok)
    throw new Error(`${path}: ${body.error ?? response.status}`);
  return body;
}

const registrationSourceHash = createHmac('sha256', secrets.databasePassword)
  .update(registrationSource)
  .digest('hex');

async function cleanup() {
  if (apiCookie && charId)
    await apiRequest('/api/automation', {
      method: 'POST',
      body: JSON.stringify({ action: 'stop' }),
    }).catch(() => {});
  await sql(
    `DELETE FROM web_registration_events WHERE client_hash='${registrationSourceHash}';`,
  );
  if (!accountId) return;
  if (charId) {
    const charTables = await sql(
      "SELECT DISTINCT c.table_name FROM information_schema.columns c JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name WHERE c.table_schema='ragnarok' AND c.column_name='char_id' AND t.table_type='BASE TABLE' ORDER BY c.table_name;",
    );
    for (const table of charTables.split(/\r?\n/).filter(Boolean)) {
      if (table === 'char') continue;
      await sql(`DELETE FROM \`${table}\` WHERE char_id=${charId};`);
    }
  }
  const accountTables = await sql(
    "SELECT DISTINCT c.table_name FROM information_schema.columns c JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name WHERE c.table_schema='ragnarok' AND c.column_name='account_id' AND t.table_type='BASE TABLE' ORDER BY c.table_name;",
  );
  for (const table of accountTables.split(/\r?\n/).filter(Boolean)) {
    if (table === 'char' || table === 'login') continue;
    await sql(`DELETE FROM \`${table}\` WHERE account_id=${accountId};`);
  }
  if (charId) await sql(`DELETE FROM \`char\` WHERE char_id=${charId};`);
  await sql(`DELETE FROM login WHERE account_id=${accountId};`);
}

const login = await apiRequest('/api/account', {
  method: 'POST',
  headers: {
    'cf-connecting-ip': registrationSource,
    'cf-ray': `onboarding-recovery-${suffix}`,
  },
  body: JSON.stringify({ username, password, sex: 'M' }),
});
accountId = Number(login.account.accountId);
await apiRequest('/api/characters', {
  method: 'POST',
  body: JSON.stringify({
    name: characterName,
    hair: 7,
    hairColor: 2,
    sex: 'M',
    targetJob: 'thief',
  }),
});
charId = Number(
  await sql(
    `SELECT char_id FROM \`char\` WHERE account_id=${accountId} AND char_num=0 LIMIT 1;`,
  ),
);
await apiRequest('/api/automation', {
  method: 'POST',
  body: JSON.stringify({ action: 'stop' }),
});
for (let attempt = 0; attempt < 40; attempt += 1) {
  const online = Number(
    await sql(`SELECT online FROM \`char\` WHERE char_id=${charId};`),
  );
  if (!online) break;
  await new Promise((resolve) => setTimeout(resolve, 250));
}
await sql(`DELETE FROM quest WHERE char_id=${charId};
DELETE FROM char_reg_num WHERE char_id=${charId} AND \`key\`='terminal_academy_graduated';
UPDATE \`char\` SET class=0,last_map='prt_fild08',last_x=170,last_y=375,save_map='prt_fild08',save_x=170,save_y=375,online=0 WHERE char_id=${charId};`);
const credentials = [username, password];
const before = (
  await sql(
    `SELECT c.name,c.class,c.job_level,c.last_map,COALESCE(g.value,0),(SELECT COUNT(*) FROM quest q WHERE q.char_id=c.char_id AND q.quest_id IN (21001,7471,21008,7472,7473,4269)) FROM \`char\` c LEFT JOIN char_reg_num g ON g.char_id=c.char_id AND g.\`key\`='terminal_academy_graduated' AND g.\`index\`=0 WHERE c.account_id=${accountId} AND c.char_num=0 LIMIT 1;`,
  )
).split('\t');

const profile = mkdtempSync(join(tmpdir(), 'ro-onboarding-recovery-ui-'));
const port = 19543;
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
async function waitFor(read, predicate = Boolean, timeout = 45_000) {
  const deadline = Date.now() + timeout;
  let value;
  while (Date.now() < deadline) {
    value = await read();
    if (predicate(value)) return value;
    await sleep(100);
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
      message.method === 'Network.responseReceived' &&
      Number(message.params?.response?.status) >= 400
    )
      failedResources.push({
        status: Number(message.params.response.status),
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
  await call('Network.enable');
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
      "typeof document.querySelector('#loginForm')?.onsubmit === 'function'",
    ),
  );
  await evaluate(`(() => {
    document.querySelector('#username').value=${JSON.stringify(credentials[0])};
    document.querySelector('#password').value=${JSON.stringify(credentials[1])};
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
  await evaluate("document.querySelector('[data-tab=quests]').click()");
  const initial = await waitFor(
    () =>
      evaluate(`fetch('/api/state').then(r=>r.json()).then(state => ({
        character:document.querySelector('#name')?.textContent || '',
        button:document.querySelector('#questResume')?.textContent || '',
        disabled:Boolean(document.querySelector('#questResume')?.disabled),
        firstQuest:document.querySelector('#questList .quest-entry')?.textContent || '',
        notice:document.querySelector('#questNotice')?.textContent || '',
        map:state.character?.map || '',
        running:Boolean(state.running)
      }))`),
    (value) =>
      value?.character === before[0] &&
      value.button.includes('逃離沉船') &&
      !value.disabled,
  );
  await evaluate("document.querySelector('#questResume').click()");
  const recovered = await waitFor(
    () =>
      evaluate(`fetch('/api/state').then(r=>r.json()).then(state => ({
        map:state.character?.map || '',
        phase:state.derived?.onboarding?.phase || '',
        active:Boolean(state.derived?.onboarding?.active),
        quests:state.onboarding?.quests || [],
        graduated:Boolean(state.onboarding?.graduated),
        taskText:(state.derived?.taskEvents || []).map(event=>event.title+' '+event.detail).join(' ')
      }))`),
    (value) =>
      /^(?:iz_int(?:0[1-4])?|int_land(?:0[1-4])?)$/.test(value?.map) &&
      value.active &&
      value.taskText.includes('恢復新生訓練'),
    60_000,
  );
  await evaluate(`(() => {
    document.querySelector('[data-tab=quests]').click();
    document.querySelector('#quests').scrollIntoView({block:'start'});
  })()`);
  await sleep(500);
  const visual = await evaluate(`(() => ({
    button:document.querySelector('#questResume')?.textContent || '',
    disabled:Boolean(document.querySelector('#questResume')?.disabled),
    log:document.querySelector('#questDetail')?.textContent || '',
    pageWidth:document.documentElement.scrollWidth,
    viewportWidth:innerWidth
  }))()`);
  const screenshot = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile(
    'tmp/onboarding-recovery-mobile.png',
    Buffer.from(screenshot.result.data, 'base64'),
  );
  await apiRequest('/api/automation', {
    method: 'POST',
    body: JSON.stringify({ action: 'stop' }),
  });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const online = Number(
      await sql(`SELECT online FROM \`char\` WHERE char_id=${charId};`),
    );
    if (!online) break;
    await sleep(250);
  }
  const rewardsBefore = Number(
    await sql(
      `SELECT COALESCE(SUM(amount),0) FROM inventory WHERE char_id=${charId};`,
    ),
  );
  await sql(`UPDATE \`char\` SET class=6,online=0 WHERE char_id=${charId};
INSERT INTO char_reg_num (char_id,\`key\`,\`index\`,value) VALUES (${charId},'terminal_academy_graduated',0,1) ON DUPLICATE KEY UPDATE value=1;`);
  const completionGate = await evaluate(`fetch('/api/onboarding/resume', {
    method:'POST'
  }).then(async response => ({status:response.status,body:await response.json()}))`);
  const rewardsAfter = Number(
    await sql(
      `SELECT COALESCE(SUM(amount),0) FROM inventory WHERE char_id=${charId};`,
    ),
  );
  const unexpectedFailedResources = failedResources.filter(
    (entry) =>
      !(entry.status === 400 && entry.url.endsWith('/api/onboarding/resume')),
  );
  const pass =
    initial.map === 'prt_fild08' &&
    !initial.running &&
    recovered.active &&
    !recovered.graduated &&
    visual.log.includes('恢復新生訓練') &&
    visual.pageWidth <= visual.viewportWidth &&
    completionGate.status === 400 &&
    completionGate.body?.error?.includes('新生訓練已結束') &&
    rewardsAfter === rewardsBefore &&
    unexpectedFailedResources.length === 0 &&
    errors.length === 0;
  console.log(
    JSON.stringify(
      {
        result: pass
          ? 'ONBOARDING_RECOVERY_UI_PASS'
          : 'ONBOARDING_RECOVERY_UI_FAIL',
        viewport: '390x844',
        accountId,
        initial,
        recovered,
        visual,
        completionGate: {
          ...completionGate,
          rewardsBefore,
          rewardsAfter,
        },
        screenshot: 'tmp/onboarding-recovery-mobile.png',
        failedResources,
        unexpectedFailedResources,
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
  await cleanup();
}
