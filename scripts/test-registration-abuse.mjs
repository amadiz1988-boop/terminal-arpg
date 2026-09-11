import { execFile } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const origin = process.env.RO_DEMO_ORIGIN ?? 'http://127.0.0.1:8788';
const secondaryOrigin = process.env.RO_SECONDARY_DEMO_ORIGIN ?? '';
const prefix = `gate2_r${Date.now().toString(36)}`.slice(0, 19);
const password = 'DdosGate!2026';
const source = '198.51.100.210';
const secrets = JSON.parse(
  await readFile('.local/ro-stack/secrets.json', 'utf8'),
);
const mariaFolder = (await readdir('C:\\Program Files'))
  .filter((name) => name.startsWith('MariaDB '))
  .sort()
  .reverse()[0];
const maria = `C:\\Program Files\\${mariaFolder}\\bin\\mariadb.exe`;
const sourceHash = createHmac('sha256', secrets.databasePassword)
  .update(source)
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
    },
  );
  return stdout.trim();
}

const results = [];
try {
  for (let index = 0; index < 9; index += 1) {
    const response = await fetch(`${origin}/api/account`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'cf-connecting-ip': source,
        'cf-ray': `registration-gate-${index}`,
      },
      body: JSON.stringify({
        username: `${prefix}${index}`,
        password,
        sex: index % 2 ? 'F' : 'M',
      }),
    });
    results.push({
      index,
      status: response.status,
      retryAfter: response.headers.get('retry-after'),
      body: await response.json(),
    });
  }
  if (
    results
      .slice(0, 8)
      .some((result) => result.status !== 200 || !result.body.registered)
  )
    throw new Error(
      'allowed registration window did not create eight accounts',
    );
  if (results[8].status !== 429 || results[8].retryAfter !== '3600')
    throw new Error('ninth same-source registration was not rate limited');
  const persistentEvents = await sql(
    `SELECT COUNT(*) FROM web_registration_events WHERE client_hash='${sourceHash}';`,
  );
  if (persistentEvents !== '8')
    throw new Error(
      `expected eight persistent registration events, received ${persistentEvents}`,
    );
  if (secondaryOrigin) {
    const secondary = await fetch(`${secondaryOrigin}/api/account`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'cf-connecting-ip': source,
        'cf-ray': 'registration-gate-secondary',
      },
      body: JSON.stringify({
        username: `${prefix}x`,
        password,
        sex: 'M',
      }),
    });
    if (
      secondary.status !== 429 ||
      secondary.headers.get('retry-after') !== '3600'
    )
      throw new Error(
        'secondary dashboard did not share the persistent registration limit',
      );
  }
} finally {
  const ids = await sql(
    `SELECT GROUP_CONCAT(account_id) FROM login WHERE userid LIKE '${prefix}%';`,
  );
  if (ids) {
    await sql(`START TRANSACTION;
      DELETE FROM web_sessions WHERE account_id IN (${ids});
      DELETE FROM web_preferences WHERE account_id IN (${ids});
      DELETE FROM web_account_flags WHERE account_id IN (${ids});
      DELETE FROM web_accounts WHERE account_id IN (${ids});
      DELETE FROM login WHERE account_id IN (${ids});
      COMMIT;`);
  }
  await sql(
    `DELETE FROM web_registration_events WHERE client_hash='${sourceHash}';`,
  );
}

const remaining = await sql(
  `SELECT COUNT(*) FROM login WHERE userid LIKE '${prefix}%';`,
);
if (remaining !== '0')
  throw new Error('registration abuse fixtures were not cleaned');

console.log(
  JSON.stringify(
    {
      result: 'REGISTRATION_ABUSE_PASS',
      accepted: results.slice(0, 8).map((entry) => entry.status),
      limitedStatus: results[8].status,
      retryAfter: results[8].retryAfter,
      persistentEvents: 8,
      secondaryProcessSharedLimit: Boolean(secondaryOrigin),
      remainingFixtures: Number(remaining),
    },
    null,
    2,
  ),
);
