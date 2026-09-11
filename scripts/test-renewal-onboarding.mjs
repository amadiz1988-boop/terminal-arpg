import { execFile } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const origin = process.env.RO_DEMO_ORIGIN ?? 'http://127.0.0.1:8788';
const suffix = Date.now().toString(36);
const username = `jobtest_ob_${suffix}`.slice(0, 23);
const characterName = `OnbThief${suffix}`.slice(0, 24);
const password = 'Onboarding!2026';
const registrationSource = '198.51.100.220';
const session = { cookie: '' };
const phases = [];
const taskEventTypes = new Set();
let sawNpcDialogEvent = false;
let sawExpRequirements = false;
let accountId = 0;
let charId = 0;
let completed = false;
let sawTrainingLevelFour = false;
let naturalCombatVerified = false;
let accelerationSent = false;

const secrets = JSON.parse(
  await readFile('.local/ro-stack/secrets.json', 'utf8'),
);
const mariaFolder = (await readdir('C:\\Program Files'))
  .filter((name) => name.startsWith('MariaDB '))
  .sort()
  .reverse()[0];
if (!mariaFolder) throw new Error('MariaDB client unavailable');
const maria = join('C:\\Program Files', mariaFolder, 'bin', 'mariadb.exe');
const registrationSourceHash = createHmac('sha256', secrets.databasePassword)
  .update(registrationSource)
  .digest('hex');

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

async function stopWorker() {
  if (!session.cookie || !charId) return;
  try {
    await request('/api/automation', {
      method: 'POST',
      body: JSON.stringify({ action: 'stop' }),
    });
  } catch {}
}

async function cleanup() {
  await stopWorker();
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

try {
  const login = await request('/api/account', {
    method: 'POST',
    headers: {
      'cf-connecting-ip': registrationSource,
      'cf-ray': `renewal-onboarding-${suffix}`,
    },
    body: JSON.stringify({ username, password, sex: 'M' }),
  });
  accountId = Number(login.account.accountId);
  if (!login.registered || !Number.isInteger(accountId))
    throw new Error('fresh onboarding account was not created');

  await sql(`UPDATE login SET group_id=99 WHERE account_id=${accountId};`);

  await request('/api/characters', {
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
  if (!Number.isInteger(charId)) throw new Error('fresh character unavailable');

  const deadline =
    Date.now() + Number(process.env.RO_ONBOARDING_TIMEOUT_MS ?? 900000);
  let lastKey = '';
  let snapshot = null;
  while (Date.now() < deadline) {
    const events = await request('/api/events');
    snapshot = events.live;
    if (snapshot) {
      for (const taskEvent of snapshot.taskEvents ?? []) {
        taskEventTypes.add(taskEvent.type);
        if (taskEvent.type === 'dialog' && taskEvent.detail)
          sawNpcDialogEvent = true;
      }
      if (Number(snapshot.baseExpMax) > 0 && Number(snapshot.jobExpMax) > 0)
        sawExpRequirements = true;
      if (
        snapshot.onboarding?.phase === 'academy_training' &&
        Number(snapshot.jobLevel) === 4
      )
        sawTrainingLevelFour = true;
      if (sawTrainingLevelFour && Number(snapshot.jobLevel) >= 5)
        naturalCombatVerified = true;
      if (
        process.env.RO_ACCELERATE_ONBOARDING === '1' &&
        naturalCombatVerified &&
        !accelerationSent
      ) {
        const commandDir = `.local/ro-stack/instances/player_${accountId}/commands`;
        await mkdir(commandDir, { recursive: true });
        await writeFile(
          join(commandDir, `${randomUUID()}.cmd`),
          'test_onboarding_accelerate\n10\n',
          { encoding: 'utf8', flag: 'wx' },
        );
        accelerationSent = true;
      }
      const key = [
        snapshot.map,
        snapshot.onboarding?.phase,
        snapshot.jobId,
        snapshot.jobLevel,
        snapshot.basicSkillLevel,
      ].join('|');
      if (key !== lastKey) {
        const entry = {
          at: new Date().toISOString(),
          map: snapshot.map,
          phase: snapshot.onboarding?.phase ?? '',
          jobId: Number(snapshot.jobId ?? 0),
          jobLevel: Number(snapshot.jobLevel ?? 0),
          basicSkillLevel: Number(snapshot.basicSkillLevel ?? 0),
        };
        phases.push(entry);
        console.log(`ONBOARDING_PROGRESS ${JSON.stringify(entry)}`);
        lastKey = key;
      }
      if (
        Number(snapshot.jobId) === 6 &&
        snapshot.onboarding?.completed === true &&
        snapshot.onboarding?.phase === 'awaiting_map' &&
        snapshot.map === 'prt_fild08'
      ) {
        completed = true;
        break;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (!completed)
    throw new Error(
      `Renewal onboarding timed out: ${JSON.stringify(phases.at(-1) ?? null)}`,
    );

  if (!taskEventTypes.has('action') || !taskEventTypes.has('map'))
    throw new Error(
      `task action log did not expose route phases and map changes: ${[...taskEventTypes].join(',')}`,
    );
  if (!sawNpcDialogEvent)
    throw new Error('task action log did not expose NPC dialog');
  if (!sawExpRequirements)
    throw new Error('OpenKore did not expose Base and Job EXP requirements');
  if (!naturalCombatVerified)
    throw new Error(
      'natural onboarding combat and Job EXP gain were not verified',
    );
  const autoEquippedIds = new Set(
    (snapshot.inventory ?? [])
      .filter((item) => item.equipped)
      .map((item) => Number(item.itemId)),
  );
  if (!autoEquippedIds.has(13041) || !autoEquippedIds.has(18730))
    throw new Error(
      `onboarding rewards were not auto-equipped: ${[...autoEquippedIds].join(',')}`,
    );

  let playerUiValidation = null;
  if (process.env.RO_VALIDATE_UI === '1') {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ['scripts/test-onboarding-task-ui.mjs'],
      {
        env: {
          ...process.env,
          RO_DEMO_ORIGIN: origin,
          RO_TEST_ACCOUNT_USERNAME: username,
          RO_TEST_ACCOUNT_PASSWORD: password,
        },
        windowsHide: true,
        maxBuffer: 4 * 1024 * 1024,
      },
    );
    if (stderr.trim()) console.error(stderr.trim());
    const uiOutput = stdout.trim();
    if (!uiOutput.includes('ONBOARDING_TASK_UI_PASS'))
      throw new Error(`mobile player UI validation failed: ${stdout.trim()}`);
    playerUiValidation = JSON.parse(
      uiOutput.slice(uiOutput.indexOf('{'), uiOutput.lastIndexOf('}') + 1),
    );
  }

  await stopWorker();
  let persistedCharacter = '';
  const persistenceDeadline = Date.now() + 10_000;
  while (Date.now() < persistenceDeadline) {
    persistedCharacter = await sql(
      `SELECT class,job_level,last_map FROM \`char\` WHERE char_id=${charId};`,
    );
    if (/^6\t1\tprt_fild08\b/.test(persistedCharacter)) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!/^6\t1\tprt_fild08\b/.test(persistedCharacter))
    throw new Error(
      `graduated character was not persisted in Izlude: ${persistedCharacter}`,
    );

  const logDirectory = `.local/ro-stack/instances/player_${accountId}/logs`;
  const outputLogs = (await readdir(logDirectory))
    .filter((name) => name.endsWith('.out.log'))
    .sort();
  const sessionOutput = await readFile(
    join(logDirectory, outputLogs.at(-1)),
    'utf8',
  );
  if (sessionOutput.includes('You have died'))
    throw new Error('onboarding test character died during the clean run');

  const requiredPhases = [
    'ship_wounded',
    'ship_exit',
    'island_captain',
    'island_lumin',
    'island_lumber',
    'island_sailor',
    'sail_izlude',
    'izlude_captain',
    'izlude_hun_intro',
    'izlude_hun_drink',
    'izlude_hun_finish',
    'academy_route',
    'academy_registration',
    'academy_pet_intro',
    'academy_training_route',
    'academy_training',
    'academy_return',
    'academy_graduation',
    'academy_exit',
    'returning_hunt',
    'awaiting_map',
  ];
  const observedPhases = new Set(phases.map((entry) => entry.phase));
  const missingPhases = requiredPhases.filter(
    (phase) => !observedPhases.has(phase),
  );
  if (missingPhases.length)
    throw new Error(`missing onboarding phases: ${missingPhases.join(', ')}`);

  const persistedProgress = await sql(
    `SELECT COALESCE(MAX(value),0) FROM char_reg_num WHERE char_id=${charId} AND \`key\`='terminal_academy_graduated';
SELECT GROUP_CONCAT(CONCAT(quest_id,':',state) ORDER BY quest_id) FROM quest WHERE char_id=${charId} AND quest_id IN (21001,7471,21008,7472,7473,4269);`,
  );
  const dbEvidence = [persistedCharacter, ...persistedProgress.split(/\r?\n/)];
  if (dbEvidence[1] !== '1')
    throw new Error(`graduation flag missing: ${JSON.stringify(dbEvidence)}`);
  if (
    ![21001, 7471, 21008, 7472, 7473, 4269].every((questId) =>
      dbEvidence[2]?.includes(`${questId}:2`),
    )
  )
    throw new Error(
      `completed Renewal quests missing: ${JSON.stringify(dbEvidence)}`,
    );
  console.log(
    JSON.stringify(
      {
        result: 'RENEWAL_ONBOARDING_PASS',
        targetJob: 'thief',
        phases,
        final: {
          map: snapshot.map,
          jobId: Number(snapshot.jobId),
          jobLevel: Number(snapshot.jobLevel),
          basicSkillLevel: Number(snapshot.basicSkillLevel),
          onboarding: snapshot.onboarding,
        },
        dbEvidence,
        taskEventTypes: [...taskEventTypes],
        expRequirementsObserved: sawExpRequirements,
        naturalCombatVerified,
        acceleratedAfterNaturalCombat: accelerationSent,
        autoEquippedIds: [...autoEquippedIds],
        playerUiValidation,
        testAccountExcludedFromRanking: true,
      },
      null,
      2,
    ),
  );
} finally {
  if (completed || process.env.RO_KEEP_FAILED_ONBOARDING !== '1')
    await cleanup();
}
