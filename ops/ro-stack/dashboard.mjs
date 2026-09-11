import {
  createHmac,
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { closeSync, openSync } from 'node:fs';
import {
  appendFile,
  mkdir,
  readFile,
  readdir,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import {
  dirname,
  extname,
  isAbsolute,
  join,
  normalize,
  relative,
} from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const scryptAsync = promisify(scrypt);
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const runtime = join(root, '.local', 'ro-stack');
const instancesRoot = join(runtime, 'instances');
const voiceRoot = join(runtime, 'social-voice');
const webRoot = join(dirname(fileURLToPath(import.meta.url)), 'dashboard');
const publicRoot = join(root, 'public');
const skillTreePath = join(publicRoot, 'ro', 'data', 'skill-trees.json');
const twroItemTablePath = join(
  runtime,
  'openkore',
  'tables',
  'twRO',
  'items.txt',
);
const port = Number(process.env.RO_DASHBOARD_PORT ?? 8788);
const host = process.env.RO_DASHBOARD_HOST ?? '127.0.0.1';
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.bmp': 'image/bmp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.json': 'application/json; charset=utf-8',
};
const accountPattern = /^[a-zA-Z0-9_]{4,23}$/;
const passwordPattern = /^[a-zA-Z0-9!@#$%^&*_.-]{8,32}$/;
const characterPattern = /^[\p{L}\p{N}_]{2,24}$/u;
const automatedTestAccountPattern = /^(?:jobtest_|gate2_)/i;
const openKoreAmmoItemTypes = Object.freeze({
  Arrow: 10,
  Bullet: 16,
  Shuriken: 17,
  Cannonball: 19,
});
let databaseQueue = Promise.resolve();
let accountQueue = Promise.resolve();
let pendingAccountRequests = 0;
const loginClientAttempts = new Map();
const loginIdentityAttempts = new Map();
const sessionCache = new Map();
const socialRateLimits = new Map();
const preferenceCache = new Map();
const statusSnapshotCache = new Map();
let publicHealthCache = { at: 0, value: null, pending: null };
const mutationMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const securityHeaders = Object.freeze({
  'content-security-policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'cross-origin-resource-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(self), geolocation=()',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
});

async function loadTwroItemNames() {
  try {
    const source = await readFile(twroItemTablePath, 'utf8');
    return new Map(
      source
        .split(/\r?\n/)
        .map((line) => line.match(/^(\d+)#(.+)#$/))
        .filter(Boolean)
        .map((match) => [Number(match[1]), match[2].trim()]),
    );
  } catch {
    return new Map();
  }
}

const twroItemNames = await loadTwroItemNames();

async function loadSkillAutomationDefinitions() {
  const data = JSON.parse(await readFile(skillTreePath, 'utf8'));
  return new Map(
    Object.entries(data.jobs ?? {}).flatMap(([jobId, job]) =>
      (job.skills ?? [])
        .filter((skill) => skill.automationMode)
        .map((skill) => [`${jobId}:${skill.id}`, skill]),
    ),
  );
}

const skillAutomationDefinitions = await loadSkillAutomationDefinitions();

function localizedItemName(itemId, fallback) {
  return twroItemNames.get(Number(itemId)) || fallback || `道具 #${itemId}`;
}

class HttpError extends Error {
  constructor(statusCode, message, retryAfter = 0) {
    super(message);
    this.statusCode = statusCode;
    this.retryAfter = retryAfter;
  }
}

const secrets = JSON.parse(
  await readFile(join(runtime, 'secrets.json'), 'utf8'),
);
const mariaFolder = (await readdir('C:\\Program Files'))
  .filter((name) => name.startsWith('MariaDB '))
  .sort()
  .reverse()[0];
if (!mariaFolder) throw new Error('MariaDB client unavailable');
const maria = join('C:\\Program Files', mariaFolder, 'bin', 'mariadb.exe');

function escapeSql(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll("'", "''");
}
async function executeSql(statement) {
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
async function sql(statement) {
  if (/^\s*SELECT\b/i.test(statement)) return await executeSql(statement);
  const task = databaseQueue.then(() => executeSql(statement));
  databaseQueue = task.catch(() => {});
  return await task;
}

await sql(`CREATE TABLE IF NOT EXISTS web_sessions (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  account_id INT UNSIGNED NOT NULL,
  created_at BIGINT UNSIGNED NOT NULL,
  expires_at BIGINT UNSIGNED NOT NULL,
  INDEX account_idx (account_id), INDEX expiry_idx (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
await sql(`CREATE TABLE IF NOT EXISTS web_automation (
  account_id INT UNSIGNED NOT NULL PRIMARY KEY,
  desired_running TINYINT(1) UNSIGNED NOT NULL DEFAULT 0,
  updated_at BIGINT UNSIGNED NOT NULL,
  INDEX desired_idx (desired_running)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
await sql(`CREATE TABLE IF NOT EXISTS web_accounts (
  account_id INT UNSIGNED NOT NULL PRIMARY KEY,
  password_salt CHAR(32) NOT NULL,
  password_hash CHAR(128) NOT NULL,
  migrated_at BIGINT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
await sql(`CREATE TABLE IF NOT EXISTS web_account_flags (
  account_id INT UNSIGNED NOT NULL PRIMARY KEY,
  is_test TINYINT(1) UNSIGNED NOT NULL DEFAULT 0,
  updated_at BIGINT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
await sql(`CREATE TABLE IF NOT EXISTS web_rate_limit_locks (
  limit_name VARCHAR(32) NOT NULL PRIMARY KEY,
  touched_at BIGINT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
await sql(`CREATE TABLE IF NOT EXISTS web_registration_events (
  event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_hash CHAR(64) NOT NULL,
  created_at BIGINT UNSIGNED NOT NULL,
  INDEX client_time_idx (client_hash,created_at),
  INDEX created_idx (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
await sql(`INSERT IGNORE INTO web_rate_limit_locks (limit_name,touched_at)
VALUES ('registration',${Date.now()});`);
await sql(`INSERT IGNORE INTO web_account_flags (account_id,is_test,updated_at)
SELECT account_id,1,${Date.now()} FROM login
WHERE userid REGEXP '^(jobtest_|gate2_)';`);
await sql(`CREATE TABLE IF NOT EXISTS web_preferences (
  account_id INT UNSIGNED NOT NULL PRIMARY KEY,
  music_enabled TINYINT(1) UNSIGNED NOT NULL DEFAULT 1,
  sound_enabled TINYINT(1) UNSIGNED NOT NULL DEFAULT 1,
  music_volume TINYINT UNSIGNED NOT NULL DEFAULT 20,
  sound_volume TINYINT UNSIGNED NOT NULL DEFAULT 35,
  damage_floats_enabled TINYINT(1) UNSIGNED NOT NULL DEFAULT 1,
  damage_float_size TINYINT UNSIGNED NOT NULL DEFAULT 14,
  damage_float_scale SMALLINT UNSIGNED NOT NULL DEFAULT 50,
  damage_float_opacity TINYINT UNSIGNED NOT NULL DEFAULT 100,
  damage_float_weight SMALLINT UNSIGNED NOT NULL DEFAULT 800,
  damage_float_font VARCHAR(16) NOT NULL DEFAULT 'classic',
  damage_float_position_x TINYINT UNSIGNED NOT NULL DEFAULT 72,
  damage_float_position_y TINYINT UNSIGNED NOT NULL DEFAULT 72,
  damage_float_arc SMALLINT UNSIGNED NOT NULL DEFAULT 100,
  updated_at BIGINT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
await sql(`ALTER TABLE web_preferences
  ADD COLUMN IF NOT EXISTS damage_floats_enabled TINYINT(1) UNSIGNED NOT NULL DEFAULT 1 AFTER sound_volume,
  ADD COLUMN IF NOT EXISTS damage_float_size TINYINT UNSIGNED NOT NULL DEFAULT 14 AFTER damage_floats_enabled,
  ADD COLUMN IF NOT EXISTS damage_float_scale SMALLINT UNSIGNED NOT NULL DEFAULT 50 AFTER damage_float_size,
  ADD COLUMN IF NOT EXISTS damage_float_opacity TINYINT UNSIGNED NOT NULL DEFAULT 100 AFTER damage_float_scale,
  ADD COLUMN IF NOT EXISTS damage_float_weight SMALLINT UNSIGNED NOT NULL DEFAULT 800 AFTER damage_float_opacity,
  ADD COLUMN IF NOT EXISTS damage_float_font VARCHAR(16) NOT NULL DEFAULT 'classic' AFTER damage_float_weight,
  ADD COLUMN IF NOT EXISTS damage_float_position_x TINYINT UNSIGNED NOT NULL DEFAULT 72 AFTER damage_float_font,
  ADD COLUMN IF NOT EXISTS damage_float_position_y TINYINT UNSIGNED NOT NULL DEFAULT 72 AFTER damage_float_position_x,
  ADD COLUMN IF NOT EXISTS damage_float_arc SMALLINT UNSIGNED NOT NULL DEFAULT 100 AFTER damage_float_position_y;`);
await sql(`CREATE TABLE IF NOT EXISTS web_character_grants (
  char_id INT UNSIGNED NOT NULL,
  grant_key VARCHAR(64) NOT NULL,
  granted_at BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (char_id,grant_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
await sql(`CREATE TABLE IF NOT EXISTS web_voice_messages (
  voice_id CHAR(36) NOT NULL PRIMARY KEY,
  account_id INT UNSIGNED NOT NULL,
  char_id INT UNSIGNED NOT NULL,
  map_name VARCHAR(32) NOT NULL,
  mime_type VARCHAR(32) NOT NULL,
  file_ext VARCHAR(8) NOT NULL,
  byte_size INT UNSIGNED NOT NULL,
  duration_ms INT UNSIGNED NOT NULL,
  created_at BIGINT UNSIGNED NOT NULL,
  INDEX created_idx (created_at), INDEX account_idx (account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
await mkdir(voiceRoot, { recursive: true });
await sql(`START TRANSACTION;
INSERT INTO inventory (char_id,nameid,amount,equip,identify)
SELECT c.char_id,7060,30,0,1
FROM \`char\` c
JOIN web_accounts w ON w.account_id=c.account_id
LEFT JOIN web_character_grants g ON g.char_id=c.char_id AND g.grant_key='renewal_novice_kafra_tickets'
WHERE c.char_num=0 AND g.char_id IS NULL;
INSERT IGNORE INTO web_character_grants (char_id,grant_key,granted_at)
SELECT c.char_id,'renewal_novice_kafra_tickets',${Date.now()}
FROM \`char\` c JOIN web_accounts w ON w.account_id=c.account_id
WHERE c.char_num=0;
COMMIT;`);
await sql(
  `UPDATE web_preferences SET music_volume=20,sound_volume=35 WHERE music_volume=40 AND sound_volume=70;`,
);

function cookie(request, name) {
  return (
    request.headers.cookie?.match(
      new RegExp(`(?:^|;\\s*)${name}=([^;]+)`),
    )?.[1] ?? ''
  );
}
function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}
async function webPasswordDigest(password, salt) {
  return Buffer.from(await scryptAsync(password, Buffer.from(salt, 'hex'), 64));
}
async function createWebPassword(accountId, password) {
  const salt = randomBytes(16).toString('hex'),
    digest = await webPasswordDigest(password, salt);
  await sql(
    `INSERT INTO web_accounts (account_id,password_salt,password_hash,migrated_at) VALUES (${Number(accountId)},'${salt}','${digest.toString('hex')}',${Date.now()}) ON DUPLICATE KEY UPDATE password_salt=VALUES(password_salt),password_hash=VALUES(password_hash),migrated_at=VALUES(migrated_at);`,
  );
}
function internalGamePassword() {
  return `Ro_${randomBytes(8).toString('hex')}`;
}
function clientAddress(request) {
  const peer = String(request.socket.remoteAddress ?? 'unknown');
  const forwarded = String(request.headers['cf-connecting-ip'] ?? '').trim();
  const fromLocalProxy =
    peer === '127.0.0.1' || peer === '::1' || peer === '::ffff:127.0.0.1';
  return fromLocalProxy && forwarded && request.headers['cf-ray']
    ? forwarded
    : peer;
}
function consumeRateLimit(store, key, windowMs, maximum, now = Date.now()) {
  const recent = (store.get(key) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= maximum) {
    store.set(key, recent);
    return false;
  }
  recent.push(now);
  store.set(key, recent);
  if (store.size > 10000) {
    for (const [storedKey, attempts] of store) {
      if (!attempts.some((time) => now - time < windowMs))
        store.delete(storedKey);
    }
  }
  return true;
}
function allowLogin(request, username) {
  const client = clientAddress(request);
  const now = Date.now();
  return (
    consumeRateLimit(loginClientAttempts, client, 300000, 40, now) &&
    consumeRateLimit(
      loginIdentityAttempts,
      String(username).toLowerCase(),
      300000,
      10,
      now,
    )
  );
}
function registrationClientHash(client) {
  return createHmac('sha256', secrets.databasePassword)
    .update(String(client))
    .digest('hex');
}
async function assertRegistrationAllowed(client) {
  const now = Date.now();
  const clientHash = registrationClientHash(client);
  const output = await sql(`START TRANSACTION;
SELECT touched_at INTO @registration_gate_lock
FROM web_rate_limit_locks
WHERE limit_name='registration'
FOR UPDATE;
DELETE FROM web_registration_events WHERE created_at<${now - 86400000};
INSERT INTO web_registration_events (client_hash,created_at)
SELECT '${clientHash}',${now}
WHERE
  (SELECT COUNT(*) FROM web_registration_events WHERE client_hash='${clientHash}' AND created_at>=${now - 3600000})<8
  AND
  (SELECT COUNT(*) FROM web_registration_events WHERE created_at>=${now - 600000})<30;
SET @registration_accepted=ROW_COUNT();
UPDATE web_rate_limit_locks SET touched_at=${now} WHERE limit_name='registration';
SELECT @registration_accepted,
  (SELECT COUNT(*) FROM web_registration_events WHERE client_hash='${clientHash}' AND created_at>=${now - 3600000}),
  (SELECT COUNT(*) FROM web_registration_events WHERE created_at>=${now - 600000});
COMMIT;`);
  const [accepted, clientCount] = output.split('\t').map(Number);
  if (accepted === 1) return;
  throw new HttpError(
    429,
    '新帳號建立過於頻繁，請稍後再試',
    clientCount >= 8 ? 3600 : 600,
  );
}
function instanceId(accountId) {
  return `player_${accountId}`;
}
function json(response, status, body, headers = {}) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...securityHeaders,
    ...headers,
  });
  response.end(JSON.stringify(body));
}

function requestOrigin(request) {
  const configured = String(process.env.RO_PUBLIC_ORIGIN ?? '').trim();
  if (configured) return configured.replace(/\/$/, '');
  const forwarded = String(request.headers['x-forwarded-proto'] ?? '')
    .split(',')[0]
    .trim();
  const protocol = forwarded === 'https' ? 'https' : 'http';
  return `${protocol}://${request.headers.host ?? 'localhost'}`;
}
function mutationOriginAllowed(request) {
  if (!mutationMethods.has(request.method ?? 'GET')) return true;
  const fetchSite = String(request.headers['sec-fetch-site'] ?? '');
  if (fetchSite && !['same-origin', 'none'].includes(fetchSite)) return false;
  const origin = String(request.headers.origin ?? '').replace(/\/$/, '');
  return !origin || origin === requestOrigin(request);
}
function loopbackRequest(request) {
  const address = String(request.socket.remoteAddress ?? '');
  return (
    address === '127.0.0.1' ||
    address === '::1' ||
    address === '::ffff:127.0.0.1'
  );
}
function publicErrorMessage(error) {
  const message = error instanceof Error ? error.message : '';
  const allowed = [
    '帳號需為',
    '密碼需為',
    '帳號目前',
    '帳號或密碼錯誤',
    '此測試帳號',
    '角色名稱需為',
    '角色名稱已被使用',
    '無效的道具操作',
    '遊戲伺服器尚未同步此道具',
    '此道具無法使用',
    '此裝備目前',
    '此裝備尚未鑑定',
    '限定初心者／超級初心者使用',
    '無效的能力值',
    '找不到角色',
    '能力值已達',
    '能力點數不足',
    '角色資料仍在同步',
    '角色目前不在線上',
    '訊息內容不得為空白',
    '訊息最多 80 個字',
    '訊息包含不允許的控制字元',
    '一般頻道不接受指令字首',
    '訊息發送過快',
    '密語對象',
    '此頻道',
    '語音',
    '無效的表情',
    '無效的社交操作',
    '技能點數不足',
    '角色尚未習得此技能',
    '技能自動化類型不符',
    '技能需要',
    'Zeny 不足',
    '基本技能目前無法提升',
    '角色已經是伊甸園成員',
    '請先完成一轉',
    '請先完成新生訓練',
    '角色連線逾時',
    '新生訓練已結束',
    '登入嘗試過多',
    '新帳號建立過於頻繁',
    '帳號服務忙碌',
    '請求內容過大',
    'JSON 格式錯誤',
  ];
  return allowed.some((prefix) => message.startsWith(prefix))
    ? message
    : '伺服器操作失敗';
}
function requestBody(request) {
  return new Promise((resolve, reject) => {
    const maximum = 8192;
    const declared = Number(request.headers['content-length'] ?? 0);
    if (declared > maximum) {
      reject(new HttpError(413, '請求內容過大'));
      request.resume();
      return;
    }
    const chunks = [];
    let total = 0;
    let settled = false;
    request.on('data', (chunk) => {
      if (settled) return;
      total += chunk.length;
      if (total > maximum) {
        settled = true;
        reject(new HttpError(413, '請求內容過大'));
        request.pause();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (settled) return;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new HttpError(400, 'JSON 格式錯誤'));
      }
    });
    request.on('error', reject);
  });
}

function requestBinary(request, maxBytes) {
  return new Promise((resolve, reject) => {
    const declared = Number(request.headers['content-length'] ?? 0);
    if (declared > maxBytes) {
      reject(new Error('語音檔案超過 1 MB'));
      request.resume();
      return;
    }
    const chunks = [];
    let total = 0;
    request.on('data', (chunk) => {
      total += chunk.length;
      if (total <= maxBytes) chunks.push(chunk);
    });
    request.on('end', () => {
      if (total > maxBytes) reject(new Error('語音檔案超過 1 MB'));
      else resolve(Buffer.concat(chunks));
    });
    request.on('error', reject);
  });
}

async function sessionAccount(request) {
  const token = cookie(request, 'ro_session');
  if (!token) return null;
  const now = Date.now(),
    hash = tokenHash(token),
    cached = sessionCache.get(hash);
  if (cached && cached.expiresAt > now) return cached.account;
  const output =
    await sql(`SELECT l.account_id,l.userid,l.sex,c.char_id,c.name,c.char_num,c.hair,c.hair_color,s.expires_at,j.value
    FROM web_sessions s JOIN login l ON l.account_id=s.account_id
    LEFT JOIN \`char\` c ON c.account_id=l.account_id AND c.char_num=0
    LEFT JOIN char_reg_str j ON j.char_id=c.char_id AND j.\`key\`='terminal_target_job$' AND j.\`index\`=0
    WHERE s.token_hash='${hash}' AND s.expires_at>${now} LIMIT 1;`);
  if (!output) return null;
  const row = output.split('\t');
  const account = {
    accountId: Number(row[0]),
    username: row[1],
    sex: row[2],
    characterId: row[3] ? Number(row[3]) : null,
    characterName: row[4] || null,
    characterSlot: Number(row[5] ?? 0),
    hair: Number(row[6] ?? 0),
    hairColor: Number(row[7] ?? 0),
    targetJob: row[9] && row[9] !== 'NULL' ? row[9] : null,
  };
  sessionCache.set(hash, { account, expiresAt: Number(row[8]) });
  return account;
}

async function loginOrRegister(username, password, sex, registrationClient) {
  if (!accountPattern.test(username))
    throw new Error('帳號需為 4 至 23 個英文字母、數字或底線');
  if (!passwordPattern.test(password))
    throw new Error('密碼需為 8 至 32 個英數字或常用符號');
  const safeUser = escapeSql(username),
    safeSex = sex === 'F' ? 'F' : 'M';
  let output = await sql(
    `SELECT l.account_id,l.user_pass,l.sex,l.state,w.password_salt,w.password_hash FROM login l LEFT JOIN web_accounts w ON w.account_id=l.account_id WHERE l.userid='${safeUser}' LIMIT 2;`,
  );
  let registered = false;
  if (!output) {
    await assertRegistrationAllowed(registrationClient);
    const gamePassword = internalGamePassword();
    await sql(
      `INSERT INTO login (userid,user_pass,sex,email,character_slots) VALUES ('${safeUser}','${gamePassword}','${safeSex}','${safeUser}@local.invalid',3);`,
    );
    output = await sql(
      `SELECT l.account_id,l.user_pass,l.sex,l.state,w.password_salt,w.password_hash FROM login l LEFT JOIN web_accounts w ON w.account_id=l.account_id WHERE l.userid='${safeUser}' ORDER BY l.account_id DESC LIMIT 1;`,
    );
    await createWebPassword(Number(output.split('\t')[0]), password);
    registered = true;
  }
  const row = output.split('\t');
  await sql(
    `INSERT IGNORE INTO web_account_flags (account_id,is_test,updated_at) VALUES (${Number(row[0])},${automatedTestAccountPattern.test(username) ? 1 : 0},${Date.now()});`,
  );
  if (Number(row[3] ?? 0) !== 0) throw new Error('帳號目前無法登入');
  if (registered) {
    // The password was accepted while the account was created above.
  } else if (row[4] && row[4] !== 'NULL' && row[5] && row[5] !== 'NULL') {
    const stored = Buffer.from(row[5], 'hex'),
      supplied = await webPasswordDigest(password, row[4]);
    if (stored.length !== supplied.length || !timingSafeEqual(stored, supplied))
      throw new Error('帳號或密碼錯誤');
  } else {
    const stored = Buffer.from(row[1] ?? ''),
      supplied = Buffer.from(password);
    if (stored.length !== supplied.length || !timingSafeEqual(stored, supplied))
      throw new Error('帳號或密碼錯誤');
    const gamePassword = internalGamePassword();
    await createWebPassword(Number(row[0]), password);
    await sql(
      `UPDATE login SET user_pass='${gamePassword}' WHERE account_id=${Number(row[0])};`,
    );
  }
  const token = randomBytes(32).toString('hex'),
    now = Date.now(),
    expires = now + 7 * 86400000;
  await sql(
    `DELETE FROM web_sessions WHERE expires_at<=${now}; INSERT INTO web_sessions (token_hash,account_id,created_at,expires_at) VALUES ('${tokenHash(token)}',${Number(row[0])},${now},${expires});`,
  );
  return {
    account: { accountId: Number(row[0]), username, sex: row[2] },
    token,
    registered,
  };
}
async function serializedLoginOrRegister(
  username,
  password,
  sex,
  registrationClient,
) {
  if (pendingAccountRequests >= 12)
    throw new HttpError(429, '帳號服務忙碌，請稍後再試', 10);
  pendingAccountRequests += 1;
  const task = accountQueue.then(() =>
    loginOrRegister(username, password, sex, registrationClient),
  );
  accountQueue = task.catch(() => {});
  try {
    return await task;
  } finally {
    pendingAccountRequests -= 1;
  }
}

async function createCharacter(account, name, hair, hairColor, sex, targetJob) {
  if (account.characterId) throw new Error('此測試帳號已有角色');
  if (!characterPattern.test(name))
    throw new Error('角色名稱需為 2 至 24 個中英文、數字或底線');
  if (!allowedFirstJobs.has(targetJob)) throw new Error('請選擇一轉志願職業');
  const exists = await sql(
    `SELECT char_id FROM \`char\` WHERE name='${escapeSql(name)}' LIMIT 1;`,
  );
  if (exists) throw new Error('角色名稱已被使用');
  const safeSex = sex === 'F' ? 'F' : 'M';
  const start = renewalStartPoints[randomInt(renewalStartPoints.length)];
  await sql(`UPDATE login SET sex='${safeSex}' WHERE account_id=${account.accountId};
    INSERT INTO \`char\` (account_id,char_num,name,class,base_level,job_level,str,agi,vit,\`int\`,dex,luk,max_hp,hp,max_sp,sp,status_point,skill_point,hair,hair_color,last_map,last_x,last_y,save_map,save_x,save_y,sex)
    VALUES (${account.accountId},0,'${escapeSql(name)}',0,1,1,1,1,1,1,1,1,40,40,11,11,0,0,${Math.max(1, Math.min(42, Number(hair) || 1))},${Math.max(0, Math.min(8, Number(hairColor) || 0))},'${start.map}',${start.x},${start.y},'${start.map}',${start.x},${start.y},'${safeSex}');`);
  await sql(`INSERT INTO inventory (char_id,nameid,amount,equip,identify)
    SELECT char_id,1201,1,2,1 FROM \`char\` WHERE account_id=${account.accountId} AND char_num=0;
    INSERT INTO inventory (char_id,nameid,amount,equip,identify)
    SELECT char_id,2301,1,16,1 FROM \`char\` WHERE account_id=${account.accountId} AND char_num=0;
    INSERT INTO inventory (char_id,nameid,amount,equip,identify)
    SELECT char_id,23484,1,0,1 FROM \`char\` WHERE account_id=${account.accountId} AND char_num=0;
    INSERT INTO inventory (char_id,nameid,amount,equip,identify)
    SELECT char_id,7060,30,0,1 FROM \`char\` WHERE account_id=${account.accountId} AND char_num=0;
    INSERT IGNORE INTO web_character_grants (char_id,grant_key,granted_at)
    SELECT char_id,'renewal_novice_kafra_tickets',${Date.now()} FROM \`char\` WHERE account_id=${account.accountId} AND char_num=0;
    INSERT INTO char_reg_str (char_id,\`key\`,\`index\`,value)
    SELECT char_id,'terminal_target_job$',0,'${escapeSql(targetJob)}' FROM \`char\` WHERE account_id=${account.accountId} AND char_num=0
    ON DUPLICATE KEY UPDATE value=VALUES(value);`);
  return true;
}

async function accountCredentials(accountId) {
  const output = await sql(
    `SELECT userid,user_pass FROM login WHERE account_id=${Number(accountId)} LIMIT 1;`,
  );
  const row = output.split('\t');
  return { username: row[0], password: row[1] };
}

async function currentLog(id) {
  const folder = join(instancesRoot, id),
    statePath = join(folder, 'state.json');
  try {
    const state = JSON.parse(await readFile(statePath, 'utf8'));
    process.kill(Number(state.pid), 0);
    return {
      running: true,
      startedAt: Number(state.startedAt),
      text: await readFile(state.stdout, 'utf8'),
    };
  } catch {
    const logs = join(folder, 'logs'),
      files = (await readdir(logs).catch(() => [])).filter((name) =>
        name.endsWith('.out.log'),
      );
    const ranked = await Promise.all(
      files.map(async (name) => ({
        name,
        time: (await stat(join(logs, name))).mtimeMs,
      })),
    );
    ranked.sort((a, b) => b.time - a.time);
    return {
      running: false,
      startedAt: ranked[0]?.time ?? null,
      text: ranked[0] ? await readFile(join(logs, ranked[0].name), 'utf8') : '',
    };
  }
}
async function currentStatusSnapshot(id) {
  const path = join(instancesRoot, id, 'status.json');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const snapshot = JSON.parse(await readFile(path, 'utf8'));
      if (Date.now() - Number(snapshot.updatedAt) >= 5000) return null;
      statusSnapshotCache.set(id, snapshot);
      return snapshot;
    } catch {
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
  const cached = statusSnapshotCache.get(id);
  return cached && Date.now() - Number(cached.updatedAt) < 5000 ? cached : null;
}

function relevantLogLines(text) {
  return text
    .split(/\r?\n/)
    .filter((line) =>
      /Map Change|You attack|You use|attacks you|attacking Monster|gained|You are now (?:job )?level|Item Appeared|added to inventory|died|respawn|random route|Moving to|Auto-(?:storaging|selling|buying|storage|sell|buy)|Storage opened|Storage closed|Sold:|Bought:|storage/.test(
        line,
      ),
    );
}
function parseLog(text) {
  const lines = relevantLogLines(text);
  const loot = new Map();
  let baseExpGained = 0,
    jobExpGained = 0;
  for (const line of lines) {
    const m = line.match(/Item added to inventory: (.+?) \(\d+\) x (\d+)/);
    if (m) loot.set(m[1], (loot.get(m[1]) ?? 0) + Number(m[2]));
    const exp = line.match(/You have gained (\d+)\/(\d+)/);
    if (exp) {
      baseExpGained += Number(exp[1]);
      jobExpGained += Number(exp[2]);
    }
  }
  return {
    lines: lines.slice(-220),
    visitedTargetMap: /Map Change: prt_fild08/.test(text),
    kills: (text.match(/You have gained \d+\/\d+/g) ?? []).filter(
      (line) => line !== 'You have gained 0/0',
    ).length,
    items: [...loot.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount),
    deaths: (text.match(/You have died/g) ?? []).length,
    baseExpGained,
    jobExpGained,
  };
}

async function queryCharacter(accountId) {
  const output = await sql(
    `SELECT c.char_id,c.name,c.class,c.sex,c.hair,c.hair_color,c.base_level,c.job_level,c.base_exp,c.job_exp,c.zeny,c.str,c.agi,c.vit,c.\`int\`,c.dex,c.luk,c.hp,c.max_hp,c.sp,c.max_sp,c.status_point,c.skill_point,c.last_map,c.last_x,c.last_y,c.online,j.value FROM \`char\` c LEFT JOIN char_reg_str j ON j.char_id=c.char_id AND j.\`key\`='terminal_target_job$' AND j.\`index\`=0 WHERE c.account_id=${Number(accountId)} AND c.char_num=0 LIMIT 1;`,
  );
  if (!output) return null;
  const row = output.split('\t'),
    n = (i) => Number(row[i] ?? 0);
  return {
    charId: n(0),
    name: row[1],
    classId: n(2),
    sex: row[3],
    hair: n(4),
    hairColor: n(5),
    baseLevel: n(6),
    jobLevel: n(7),
    baseExp: n(8),
    jobExp: n(9),
    zeny: n(10),
    str: n(11),
    agi: n(12),
    vit: n(13),
    int: n(14),
    dex: n(15),
    luk: n(16),
    hp: n(17),
    maxHp: n(18),
    sp: n(19),
    maxSp: n(20),
    statusPoint: n(21),
    skillPoint: n(22),
    map: row[23],
    x: n(24),
    y: n(25),
    online: row[26] === '1',
    targetJob: row[27] && row[27] !== 'NULL' ? row[27] : null,
  };
}

const renewalNoviceQuests = Object.freeze([
  { id: 21001, title: '逃離沉船', place: '沉船船艙' },
  { id: 7471, title: '初次相遇', place: '漂流島' },
  { id: 21008, title: '第一次戰鬥', place: '漂流島' },
  { id: 7472, title: '新世界的第一步', place: '伊斯魯得島' },
  { id: 7473, title: '清涼飲料', place: '伊斯魯得島' },
  { id: 4269, title: '新生學院報到', place: '克里圖拉學院' },
]);

async function queryOnboardingProgress(charId) {
  const [questOutput, graduationOutput] = await Promise.all([
    sql(
      `SELECT quest_id,state,count1,count2,count3 FROM quest WHERE char_id=${Number(charId)} AND quest_id IN (${renewalNoviceQuests.map((quest) => quest.id).join(',')});`,
    ),
    sql(
      `SELECT value FROM char_reg_num WHERE char_id=${Number(charId)} AND \`key\`='terminal_academy_graduated' AND \`index\`=0 LIMIT 1;`,
    ),
  ]);
  const rows = new Map(
    questOutput
      ? questOutput.split(/\r?\n/).map((line) => {
          const [id, state, count1, count2, count3] = line
            .split('\t')
            .map(Number);
          return [id, { state, counts: [count1, count2, count3] }];
        })
      : [],
  );
  const quests = renewalNoviceQuests.map((quest) => {
    const row = rows.get(quest.id);
    return {
      ...quest,
      status: row?.state === 2 ? 'complete' : row ? 'active' : 'locked',
      counts: row?.counts ?? [0, 0, 0],
    };
  });
  quests.push({
    id: 'graduation',
    title: '一轉結業',
    place: '克里圖拉學院',
    status: Number(graduationOutput || 0) > 0 ? 'complete' : 'locked',
    counts: [0, 0, 0],
  });
  const activeIndex = quests.findIndex((quest) => quest.status === 'active');
  const nextIndex = quests.findIndex((quest) => quest.status === 'locked');
  const graduated = Number(graduationOutput || 0) > 0;
  return {
    source: '遊戲伺服器任務資料',
    quests,
    currentIndex: activeIndex >= 0 ? activeIndex : nextIndex,
    complete: quests.every((quest) => quest.status === 'complete'),
    graduated,
  };
}

const edenMilestones = Object.freeze([
  { id: 'member', title: '加入伊甸園', minimumLevel: 1 },
  { id: 'equipment12', title: 'Lv.12 裝備訓練', minimumLevel: 12 },
  { id: 'equipment26', title: 'Lv.26 裝備訓練', minimumLevel: 26 },
  { id: 'equipment40', title: 'Lv.40 裝備訓練', minimumLevel: 40 },
]);

async function queryEdenProgress(charId, baseLevel = 0) {
  const [markOutput, progressOutput] = await Promise.all([
    sql(
      `SELECT COALESCE(SUM(amount),0) FROM inventory WHERE char_id=${Number(charId)} AND nameid IN (6219,22508);`,
    ),
    sql(
      `SELECT value FROM char_reg_num WHERE char_id=${Number(charId)} AND \`key\`='para_suv01' AND \`index\`=0 LIMIT 1;`,
    ),
  ]);
  const member = Number(markOutput || 0) > 0;
  const trainingStage = Number(progressOutput || 0);
  const completionStages = Object.freeze({
    member: member,
    equipment12: trainingStage >= 12,
    equipment26: trainingStage >= 23,
    equipment40: trainingStage >= 38,
  });
  const milestones = edenMilestones.map((milestone) => ({
    ...milestone,
    status: completionStages[milestone.id]
      ? 'complete'
      : member && Number(baseLevel) >= milestone.minimumLevel
        ? 'available'
        : 'locked',
  }));
  return {
    source: '遊戲伺服器伊甸園資料',
    member,
    trainingStage,
    milestones,
  };
}

const equipmentCatalog = {
  1201: { aegisName: 'Knife_', name: '短劍 [3]' },
  1202: { aegisName: 'Knife_', name: '短劍 [4]' },
  1243: { aegisName: 'Knife_', name: '初學者笨拙短劍' },
  1381: { aegisName: 'N_Battle_Axe', name: '新手專用戰斧' },
  1545: { aegisName: 'N_Mace', name: '新手專用鐵錘' },
  1639: { aegisName: 'N_Rod', name: '新手專用手杖 [3]' },
  1742: { aegisName: 'N_Composite_Bow', name: '新手專用坎普茲弓 [3]' },
  2101: { aegisName: 'Guard_', name: '鐵盾' },
  2102: { aegisName: 'Guard_', name: '鐵盾 [1]' },
  2112: { aegisName: 'Novice_Guard', name: '新手鐵盾' },
  2301: { aegisName: null, name: '棉襯衫' },
  2302: { aegisName: null, name: '棉襯衫 [1]' },
  2352: { aegisName: 'Novice_Plate', name: '新手忍服' },
  2414: { aegisName: 'Novice_Boots', name: '新手便鞋' },
  2510: { aegisName: 'Novice_Hood', name: '新手斗篷' },
  5055: { aegisName: 'Novice_Egg_Cap', name: '新手蛋殼帽' },
  18730: { aegisName: 'Cryptura_Academy_Hat', name: '克里圖拉學院帽' },
  13041: { aegisName: 'Knife_', name: '新手專用笨拙短劍' },
  13415: { aegisName: 'N_Falchion', name: '新手專用圓月刀' },
};
const inventoryCatalog = {
  507: { aegisName: 'Red_Herb', name: '紅色藥草', category: 'consumable' },
  511: { aegisName: 'Green_Herb', name: '綠色藥草', category: 'consumable' },
  512: { aegisName: 'Apple', name: '蘋果', category: 'consumable' },
  569: { aegisName: 'Novice_Potion', name: '新手藥水', category: 'consumable' },
  515: { aegisName: 'Carrot', name: '紅蘿蔔', category: 'consumable' },
  601: { aegisName: 'Wing_Of_Fly', name: '蒼蠅翅膀', category: 'consumable' },
  705: { aegisName: 'Clover', name: '三葉幸運草', category: 'etc' },
  909: { aegisName: 'Jellopy', name: '傑勒比結晶', category: 'etc' },
  914: { aegisName: 'Fluff', name: '柔毛', category: 'etc' },
  915: { aegisName: 'Chrysalis', name: '蛹殼', category: 'etc' },
  924: { aegisName: 'Powder_Of_Butterfly', name: '蝴蝶粉末', category: 'etc' },
  935: { aegisName: 'Shell', name: '硬殼', category: 'etc' },
  938: { aegisName: 'Sticky_Mucus', name: '黏稠液體', category: 'etc' },
  949: { aegisName: 'Feather', name: '羽毛', category: 'etc' },
  1002: { aegisName: 'Iron_Ore', name: '鐵礦石', category: 'etc' },
  1010: { aegisName: 'Phracon', name: '強化武器金屬-級數一', category: 'etc' },
  1201: { aegisName: 'Knife_', name: '短劍 [3]', category: 'equipment' },
  1202: { aegisName: 'Knife_', name: '短劍 [4]', category: 'equipment' },
  1243: {
    aegisName: 'Knife_',
    name: '初學者笨拙短劍',
    category: 'equipment',
  },
  1381: {
    aegisName: 'N_Battle_Axe',
    name: '新手專用戰斧',
    category: 'equipment',
  },
  1545: { aegisName: 'N_Mace', name: '新手專用鐵錘', category: 'equipment' },
  1639: { aegisName: 'N_Rod', name: '新手專用手杖 [3]', category: 'equipment' },
  1742: {
    aegisName: 'N_Composite_Bow',
    name: '新手專用坎普茲弓 [3]',
    category: 'equipment',
  },
  2101: { aegisName: 'Guard_', name: '鐵盾', category: 'equipment' },
  2102: { aegisName: 'Guard_', name: '鐵盾 [1]', category: 'equipment' },
  2112: { aegisName: 'Novice_Guard', name: '新手鐵盾', category: 'equipment' },
  2301: { aegisName: null, name: '棉襯衫', category: 'equipment' },
  2302: { aegisName: null, name: '棉襯衫 [1]', category: 'equipment' },
  2352: { aegisName: 'Novice_Plate', name: '新手忍服', category: 'equipment' },
  2414: { aegisName: 'Novice_Boots', name: '新手便鞋', category: 'equipment' },
  2510: { aegisName: 'Novice_Hood', name: '新手斗篷', category: 'equipment' },
  5055: {
    aegisName: 'Novice_Egg_Cap',
    name: '新手蛋殼帽',
    category: 'equipment',
  },
  6593: {
    aegisName: 'Cryptura_Hair_Coupon',
    name: '克里圖拉髮型券',
    category: 'etc',
  },
  18730: {
    aegisName: 'Cryptura_Academy_Hat',
    name: '克里圖拉學院帽',
    category: 'equipment',
  },
  7060: {
    aegisName: 'Warp_Free_Ticket',
    name: '卡普拉傳送點 免費利用券',
    category: 'etc',
  },
  12004: {
    aegisName: 'Arrow_Container',
    name: '箭矢筒',
    category: 'consumable',
  },
  12008: {
    aegisName: 'Fire_Arrow_Container',
    name: '火箭矢筒',
    category: 'consumable',
  },
  12009: {
    aegisName: 'Silver_Arrow_Container',
    name: '銀箭矢筒',
    category: 'consumable',
  },
  13041: {
    aegisName: 'Knife_',
    name: '新手專用笨拙短劍',
    category: 'equipment',
  },
  13415: {
    aegisName: 'N_Falchion',
    name: '新手專用圓月刀',
    category: 'equipment',
  },
  4006: { aegisName: 'Lunatic_Card', name: '瘋兔卡片', category: 'card' },
};
const noviceOnlyEquipmentIds = new Set([1243, 2112, 2352, 2414, 2510, 5055]);
const noviceEquipmentJobIds = new Set([0, 23, 4190]);
function equipmentRestriction(itemId, jobId, identified = true) {
  if (!identified) return '此裝備尚未鑑定';
  if (
    noviceOnlyEquipmentIds.has(Number(itemId)) &&
    !noviceEquipmentJobIds.has(Number(jobId))
  )
    return '限定初心者／超級初心者使用';
  return '';
}
const equipSlots = [
  [1, 'headLow'],
  [2, 'rightHand'],
  [4, 'garment'],
  [8, 'accessoryRight'],
  [16, 'armor'],
  [32, 'leftHand'],
  [64, 'shoes'],
  [128, 'accessoryLeft'],
  [256, 'headTop'],
  [512, 'headMid'],
];
function equipmentSlot(mask) {
  return (
    equipSlots.find(([bit]) => (Number(mask) & bit) !== 0)?.[1] ?? 'unknown'
  );
}
async function queryEquipment(charId) {
  const output = await sql(
    `SELECT nameid,equip,amount,refine FROM inventory WHERE char_id=${Number(charId)} AND equip<>0 ORDER BY equip,nameid;`,
  );
  if (!output) return [];
  return output.split(/\r?\n/).map((line) => {
    const row = line.split('\t'),
      itemId = Number(row[0]),
      known = equipmentCatalog[itemId];
    return {
      itemId,
      equipMask: Number(row[1]),
      slot: equipmentSlot(row[1]),
      amount: Number(row[2]),
      refine: Number(row[3]),
      aegisName: known?.aegisName ?? null,
      name: localizedItemName(itemId, known?.name),
    };
  });
}
async function queryInventory(charId) {
  const output = await sql(
    `SELECT nameid,amount,equip,identify,refine FROM inventory WHERE char_id=${Number(charId)} ORDER BY nameid;`,
  );
  if (!output) return [];
  return output.split(/\r?\n/).map((line) => {
    const row = line.split('\t'),
      itemId = Number(row[0]),
      known = inventoryCatalog[itemId] ?? equipmentCatalog[itemId];
    return {
      itemId,
      amount: Number(row[1]),
      equipped: Number(row[2]) !== 0,
      identified: row[3] === '1',
      refine: Number(row[4]),
      aegisName: known?.aegisName ?? null,
      name: localizedItemName(itemId, known?.name),
      category: known?.category ?? 'etc',
    };
  });
}

function mergeLiveInventory(items, derived, jobId = 0) {
  const liveItems = derived?.inventory ?? [];
  if (!liveItems.length)
    return items.map((item) => {
      const equipRestriction = equipmentRestriction(
        item.itemId,
        jobId,
        item.identified,
      );
      return {
        ...item,
        binId: null,
        usable: false,
        equippable: item.category === 'equipment',
        canEquip: item.category === 'equipment' && !equipRestriction,
        equipRestriction,
        mergeable: item.category === 'card',
      };
    });
  const stored = [...items];
  return liveItems.map((live) => {
    const index = stored.findIndex((item) => item.itemId === live.itemId),
      fallback = index >= 0 ? stored.splice(index, 1)[0] : null,
      known = inventoryCatalog[live.itemId] ?? equipmentCatalog[live.itemId],
      category =
        known?.category ??
        (live.mergeable
          ? 'card'
          : live.equippable
            ? 'equipment'
            : live.usable
              ? 'consumable'
              : 'etc');
    const identified = live.identified ?? fallback?.identified ?? true,
      equipRestriction = equipmentRestriction(live.itemId, jobId, identified);
    return {
      itemId: Number(live.itemId),
      itemKey: String(live.itemKey ?? ''),
      amount: Number(live.amount),
      equipped: Boolean(live.equipped),
      equipMask: Number(live.equipMask ?? 0),
      equipTarget: Number(live.equipTarget ?? 0),
      itemType: Number(live.itemType ?? -1),
      weaponType: String(live.weaponType ?? ''),
      identified,
      refine: Number(live.refine ?? fallback?.refine ?? 0),
      aegisName: known?.aegisName ?? fallback?.aegisName ?? null,
      name: localizedItemName(
        live.itemId,
        known?.name ?? live.name ?? fallback?.name,
      ),
      category,
      binId: Number(live.binId),
      usable: Boolean(live.usable),
      equippable: Boolean(live.equippable),
      canEquip: Boolean(live.equippable) && !equipRestriction,
      equipRestriction,
      mergeable: Boolean(live.mergeable),
    };
  });
}

function liveEquipment(items) {
  return items
    .filter((item) => item.equipped && item.category === 'equipment')
    .map((item) => ({
      binId: item.binId,
      itemKey: item.itemKey,
      itemId: item.itemId,
      equipMask: item.equipMask,
      equipTarget: item.equipTarget,
      slot: equipmentSlot(item.equipMask || item.equipTarget),
      amount: item.amount,
      refine: item.refine,
      aegisName: item.aegisName,
      name: item.name,
    }));
}

async function queueItemAction(account, input) {
  const action = String(input.action ?? ''),
    binId = Number(input.binId),
    requestedItemKey = String(input.itemKey ?? ''),
    allowed = new Set(['use', 'equip', 'unequip', 'card']);
  if (
    !allowed.has(action) ||
    (!/^[a-f0-9]+$/i.test(requestedItemKey) &&
      (!Number.isInteger(binId) || binId < 0))
  )
    throw new Error('無效的道具操作');
  const id = instanceId(account.accountId),
    snapshot = await currentStatusSnapshot(id),
    item = snapshot?.inventory?.find((entry) =>
      /^[a-f0-9]+$/i.test(requestedItemKey)
        ? entry.itemKey === requestedItemKey
        : entry.binId === binId,
    );
  if (!item) throw new Error('遊戲伺服器尚未同步此道具');
  const itemArgument = /^[a-f0-9]+$/i.test(String(item.itemKey ?? ''))
    ? `id:${item.itemKey}`
    : String(item.binId);
  if (action === 'card') {
    const targetBinId = Number(input.targetBinId),
      requestedTargetKey = String(input.targetItemKey ?? ''),
      target = snapshot?.inventory?.find((entry) =>
        /^[a-f0-9]+$/i.test(requestedTargetKey)
          ? entry.itemKey === requestedTargetKey
          : entry.binId === targetBinId,
      );
    if (!item.mergeable || !target?.equippable)
      throw new Error('卡片或裝備狀態不符');
    const targetArgument = /^[a-f0-9]+$/i.test(String(target.itemKey ?? ''))
      ? `id:${target.itemKey}`
      : String(target.binId);
    return await queueCharacterCommand(
      account,
      'card',
      `${itemArgument},${targetArgument}`,
    );
  }
  if (action === 'use' && !item.usable) throw new Error('此道具無法使用');
  const equipRestriction = equipmentRestriction(
    item.itemId,
    snapshot.jobId,
    item.identified,
  );
  if (action === 'equip' && equipRestriction) throw new Error(equipRestriction);
  if (action === 'equip' && (!item.equippable || item.equipped))
    throw new Error('此裝備目前無法穿上');
  if (action === 'unequip' && !item.equipped)
    throw new Error('此裝備目前未穿戴');
  const commandId = randomUUID(),
    commandDir = join(instancesRoot, id, 'commands');
  await mkdir(commandDir, { recursive: true });
  await writeFile(
    join(commandDir, `${commandId}.cmd`),
    `${action}\n${itemArgument}\n`,
    { encoding: 'utf8', flag: 'wx' },
  );
  return { commandId, accepted: true };
}

const allowedEmotionIds = new Set([
  0, 1, 2, 3, 4, 5, 7, 9, 10, 12, 14, 15, 16, 17, 20, 21, 23, 26, 28, 29, 30,
  33, 36, 45, 46,
]);
const allowedSocialChannels = new Set([
  'public',
  'private',
  'party',
  'guild',
  'clan',
  'battleground',
  'map',
  'global',
  'trade',
  'support',
  'ally',
]);
const socialTargetPattern = /^[\p{L}\p{N}_ ]{2,24}$/u;
const allowedFirstJobs = new Set([
  'swordman',
  'mage',
  'archer',
  'acolyte',
  'merchant',
  'thief',
]);
const renewalStartPoints = Object.freeze([
  { map: 'iz_int', x: 18, y: 26 },
  { map: 'iz_int01', x: 18, y: 26 },
  { map: 'iz_int02', x: 18, y: 26 },
  { map: 'iz_int03', x: 18, y: 26 },
  { map: 'iz_int04', x: 18, y: 26 },
]);
async function saveFirstJobTarget(account, job) {
  if (!account.characterId) throw new Error('請先建立角色');
  if (!allowedFirstJobs.has(job)) throw new Error('無效的一轉職業');
  const output = await sql(
    `SELECT c.class,COALESCE(j.value,'') FROM \`char\` c LEFT JOIN char_reg_str j ON j.char_id=c.char_id AND j.\`key\`='terminal_target_job$' AND j.\`index\`=0 WHERE c.char_id=${Number(account.characterId)} LIMIT 1;`,
  );
  if (!output) throw new Error('角色資料不存在');
  const [classId, selected = ''] = output.split('\t');
  if (Number(classId) !== 0) throw new Error('角色已完成一轉');
  if (selected && selected !== job) throw new Error('一轉志願已鎖定');
  await sql(
    `INSERT INTO char_reg_str (char_id,\`key\`,\`index\`,value) VALUES (${Number(account.characterId)},'terminal_target_job$',0,'${escapeSql(job)}') ON DUPLICATE KEY UPDATE value=VALUES(value);`,
  );
  return job;
}
function enforceSocialRateLimit(accountId, action) {
  const key = `${accountId}:${action}`,
    now = Date.now(),
    previous = socialRateLimits.get(key) ?? 0,
    wait = action === 'voice' ? 3000 : action.startsWith('chat') ? 800 : 1100;
  if (now - previous < wait) throw new Error('訊息發送過快');
  socialRateLimits.set(key, now);
}
async function queueSocialAction(account, input) {
  const id = instanceId(account.accountId),
    snapshot = await currentStatusSnapshot(id),
    session = await currentLog(id);
  if (!session.running || !snapshot) throw new Error('角色目前不在線上');
  const action = String(input.action ?? '');
  let argument = '';
  if (action === 'chat') {
    const channel = String(input.channel ?? 'public'),
      message = String(input.message ?? '').trim();
    if (!allowedSocialChannels.has(channel)) throw new Error('此頻道無法使用');
    if (!message) throw new Error('訊息內容不得為空白');
    if (Array.from(message).length > 80) throw new Error('訊息最多 80 個字');
    if (/[\u0000-\u001f\u007f]/u.test(message))
      throw new Error('訊息包含不允許的控制字元');
    if (/^[@/]/u.test(message)) throw new Error('一般頻道不接受指令字首');
    if (channel === 'private') {
      const target = String(input.target ?? '').trim();
      if (!socialTargetPattern.test(target))
        throw new Error('密語對象格式不符');
      argument = `${target}\t${message}`;
    } else argument = message;
    enforceSocialRateLimit(account.accountId, `chat_${channel}`);
    return await queueCharacterCommand(account, `social_${channel}`, argument);
  } else if (action === 'emotion') {
    const emotionId = Number(input.emotionId);
    if (!Number.isInteger(emotionId) || !allowedEmotionIds.has(emotionId))
      throw new Error('無效的表情');
    argument = String(emotionId);
  } else {
    throw new Error('無效的社交操作');
  }
  enforceSocialRateLimit(account.accountId, action);
  return await queueCharacterCommand(account, `social_${action}`, argument);
}

const voiceTypes = new Map([
  ['audio/webm', 'webm'],
  ['audio/ogg', 'ogg'],
  ['audio/mp4', 'm4a'],
  ['audio/aac', 'aac'],
]);
async function appendSocialEvent(id, entry) {
  await appendFile(
    join(instancesRoot, id, 'social.jsonl'),
    `${JSON.stringify(entry)}\n`,
    'utf8',
  );
}
async function queueVoiceMessage(account, request) {
  const id = instanceId(account.accountId),
    [snapshot, session] = await Promise.all([
      currentStatusSnapshot(id),
      currentLog(id),
    ]);
  if (!session.running || !snapshot) throw new Error('角色目前不在線上');
  const contentType = String(request.headers['content-type'] ?? '')
      .split(';')[0]
      .trim()
      .toLowerCase(),
    extension = voiceTypes.get(contentType),
    durationMs = Number(request.headers['x-ro-voice-duration'] ?? 0);
  if (!extension) throw new Error('語音格式不支援');
  if (!Number.isFinite(durationMs) || durationMs < 250 || durationMs > 30000)
    throw new Error('語音長度需介於 0.25 至 30 秒');
  enforceSocialRateLimit(account.accountId, 'voice');
  const data = await requestBinary(request, 1024 * 1024);
  if (data.length < 128) throw new Error('語音內容為空白');
  const voiceId = randomUUID(),
    createdAt = Date.now(),
    target = join(voiceRoot, `${voiceId}.${extension}`);
  await writeFile(target, data, { flag: 'wx' });
  try {
    await sql(`INSERT INTO web_voice_messages (voice_id,account_id,char_id,map_name,mime_type,file_ext,byte_size,duration_ms,created_at)
      VALUES ('${voiceId}',${account.accountId},${account.characterId},'${escapeSql(snapshot.map)}','${escapeSql(contentType)}','${extension}',${data.length},${Math.round(durationMs)},${createdAt});`);
  } catch (error) {
    await unlink(target).catch(() => {});
    throw error;
  }
  const event = {
    at: createdAt,
    type: 'voice',
    channel: 'public',
    sender: snapshot.name || account.characterName,
    message: '語音訊息',
    map: snapshot.map,
    voiceId,
    mime: contentType,
    durationMs: Math.round(durationMs),
  };
  const folders = (
    await readdir(instancesRoot, { withFileTypes: true })
  ).filter((entry) => entry.isDirectory() && entry.name.startsWith('player_'));
  const recipients = new Set([id]);
  await Promise.all(
    folders.map(async (folder) => {
      const recipient = await currentStatusSnapshot(folder.name);
      if (recipient?.map === snapshot.map) recipients.add(folder.name);
    }),
  );
  await Promise.all(
    [...recipients].map((recipient) => appendSocialEvent(recipient, event)),
  );
  return { accepted: true, voiceId, recipients: recipients.size };
}

async function queueJobChangeAction(account, input) {
  const action = String(input.action ?? ''),
    job = String(input.job ?? ''),
    id = instanceId(account.accountId),
    snapshot = await currentStatusSnapshot(id);
  if (!snapshot) throw new Error('角色目前不在線上');
  if (action === 'route' || action === 'talk') {
    if (!allowedFirstJobs.has(job)) throw new Error('無效的一轉職業');
    if (!account.targetJob || account.targetJob !== job)
      throw new Error('只能進行創角時選定的職業訓練');
    if (
      Number(snapshot.jobId) !== 0 ||
      Number(snapshot.jobLevel) < 10 ||
      Number(snapshot.basicSkillLevel) < 9
    )
      throw new Error('角色尚未符合一轉資格');
    return await queueCharacterCommand(
      account,
      action === 'route' ? 'job_route' : 'job_talk',
      job,
    );
  }
  if (action === 'next')
    return await queueCharacterCommand(account, 'npc_next', '1');
  if (action === 'select') {
    const choice = Number(input.choice);
    if (!Number.isInteger(choice) || choice < 1 || choice > 20)
      throw new Error('無效的 NPC 選項');
    return await queueCharacterCommand(account, 'npc_select', String(choice));
  }
  if (action === 'close')
    return await queueCharacterCommand(account, 'npc_close', '1');
  if (action === 'resume')
    return await queueCharacterCommand(account, 'job_resume', '1');
  throw new Error('無效的轉職操作');
}
async function queueOnboardingResume(account) {
  if (!account.characterId) throw new Error('請先建立角色');
  const [character, progress] = await Promise.all([
    queryCharacter(account.accountId),
    queryOnboardingProgress(account.characterId),
  ]);
  if (!character) throw new Error('找不到角色');
  if (Number(character.classId) !== 0 || progress.graduated)
    throw new Error('新生訓練已結束，無法再次傳送或領取獎勵');

  await setAutomationIntent(account.accountId, true);
  const id = instanceId(account.accountId);
  const session = await currentLog(id);
  if (!session.running) await startWorker(account);

  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    const [live, worker] = await Promise.all([
      currentStatusSnapshot(id),
      currentLog(id),
    ]);
    if (worker.running && live) {
      if (Number(live.jobId) !== 0) throw new Error('新生訓練已結束');
      return await queueCharacterCommand(account, 'onboarding_resume', '1');
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('角色連線逾時，請再試一次');
}
async function queueEdenEnrollment(account) {
  if (!account.characterId) throw new Error('請先建立角色');
  const character = await queryCharacter(account.accountId);
  if (!character) throw new Error('找不到角色');
  if (Number(character.classId) < 1 || Number(character.classId) > 6)
    throw new Error('請先完成一轉，再加入伊甸園');
  const progress = await queryEdenProgress(
    account.characterId,
    character.baseLevel,
  );
  if (progress.member) throw new Error('角色已經是伊甸園成員');

  await setAutomationIntent(account.accountId, true);
  const id = instanceId(account.accountId);
  const session = await currentLog(id);
  if (!session.running) await startWorker(account);

  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    const [live, worker] = await Promise.all([
      currentStatusSnapshot(id),
      currentLog(id),
    ]);
    if (worker.running && live) {
      if (Number(live.jobId) < 1 || Number(live.jobId) > 6)
        throw new Error('請先完成一轉，再加入伊甸園');
      return await queueCharacterCommand(account, 'eden_join', '1');
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('角色連線逾時，請再試一次');
}
async function readSocialEvents(id, fallbackSender = '') {
  let text = '';
  try {
    text = await readFile(join(instancesRoot, id, 'social.jsonl'), 'utf8');
  } catch {
    return [];
  }
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        const entry = JSON.parse(line);
        if (/^\?+$/u.test(entry?.sender ?? '') && fallbackSender)
          entry.sender = fallbackSender;
        return entry;
      } catch {
        return null;
      }
    })
    .filter(
      (entry) =>
        entry &&
        Number.isFinite(entry.at) &&
        ['chat', 'emotion', 'voice', 'system', 'error'].includes(entry.type) &&
        typeof entry.sender === 'string' &&
        (entry.type !== 'emotion' || entry.sender !== '未知角色') &&
        typeof entry.message === 'string',
    );
}

const baseStats = new Set(['str', 'agi', 'vit', 'int', 'dex', 'luk']);
function statusPointCost(value) {
  return value < 100
    ? 2 + Math.floor((value - 1) / 10)
    : 16 + 4 * Math.floor((value - 100) / 5);
}
function spentStatusPoints(character) {
  let total = 0;
  for (const statName of baseStats)
    for (let value = 1; value < Number(character[statName]); value++)
      total += statusPointCost(value);
  return total;
}
async function queueCharacterCommand(account, action, argument) {
  const commandId = randomUUID(),
    commandDir = join(instancesRoot, instanceId(account.accountId), 'commands');
  await mkdir(commandDir, { recursive: true });
  await writeFile(
    join(commandDir, `${commandId}.cmd`),
    `${action}\n${argument}\n`,
    { encoding: 'utf8', flag: 'wx' },
  );
  return { commandId, accepted: true };
}

const supplyCycleDefaults = Object.freeze({
  enabled: false,
  returnWeight: 68,
  store: true,
  sell: true,
  buy: true,
  redPotionMin: 20,
  redPotionMax: 100,
  rules: [],
});
const supplyRuleActions = new Set([
  'default',
  'ignore',
  'discard',
  'sell',
  'store',
  'keep',
]);
function normalizeSupplyCycle(input = {}) {
  const returnWeight = Math.trunc(Number(input.returnWeight)),
    redPotionMin = Math.trunc(Number(input.redPotionMin)),
    redPotionMax = Math.trunc(Number(input.redPotionMax)),
    rules = Array.isArray(input.rules)
      ? input.rules
          .slice(0, 100)
          .map((rule) => ({
            itemId: Math.trunc(Number(rule?.itemId)),
            action: String(rule?.action ?? 'default'),
          }))
          .filter(
            (rule) =>
              rule.itemId > 0 &&
              rule.itemId !== 501 &&
              rule.itemId <= 1_000_000 &&
              supplyRuleActions.has(rule.action),
          )
      : [];
  const normalized = {
    enabled: Boolean(input.enabled),
    returnWeight: Number.isInteger(returnWeight)
      ? Math.min(88, Math.max(40, returnWeight))
      : supplyCycleDefaults.returnWeight,
    store: input.store !== false,
    sell: input.sell !== false,
    buy: input.buy !== false,
    redPotionMin: Number.isInteger(redPotionMin)
      ? Math.min(500, Math.max(0, redPotionMin))
      : supplyCycleDefaults.redPotionMin,
    redPotionMax: Number.isInteger(redPotionMax)
      ? Math.min(1_000, Math.max(0, redPotionMax))
      : supplyCycleDefaults.redPotionMax,
    rules: [...new Map(rules.map((rule) => [rule.itemId, rule])).values()],
  };
  normalized.redPotionMax = Math.max(
    normalized.redPotionMin,
    normalized.redPotionMax,
  );
  if (
    normalized.enabled &&
    !normalized.store &&
    !normalized.sell &&
    !normalized.buy
  )
    throw new Error('請至少啟用存倉、販售或補給其中一項');
  return normalized;
}
function replaceConfigLine(text, name, value) {
  const pattern = new RegExp(`^${name}\\s+.*$`, 'm'),
    line = `${name} ${value}`;
  return pattern.test(text)
    ? text.replace(pattern, line)
    : `${text.trimEnd()}\n${line}\n`;
}
async function readSupplyCycle(account) {
  const target = join(
    instancesRoot,
    instanceId(account.accountId),
    'supply-cycle.json',
  );
  try {
    return normalizeSupplyCycle(JSON.parse(await readFile(target, 'utf8')));
  } catch {
    return { ...supplyCycleDefaults, rules: [] };
  }
}
async function saveSupplyCycle(account, input) {
  const settings = normalizeSupplyCycle(input),
    id = await ensureWorker(account),
    folder = join(instancesRoot, id),
    control = join(folder, 'control'),
    configPath = join(control, 'config.txt'),
    pickupPath = join(control, 'pickupitems.txt'),
    itemControlPath = join(control, 'items_control.txt');
  let config = await readFile(configPath, 'utf8');
  for (const [name, value] of [
    ['itemsTakeAuto', 2],
    ['itemsMaxWeight', 89],
    ['itemsMaxWeight_sellOrStore', settings.returnWeight],
    ['storageAuto', settings.enabled && settings.store ? 1 : 0],
    ['storageAuto_npc', 'prontera 151 29'],
    ['storageAuto_npc_type', 1],
    ['storageAuto_keepOpen', 0],
    ['relogAfterStorage', 0],
    ['minStorageZeny', 40],
    ['sellAuto', settings.enabled && settings.sell ? 1 : 0],
    ['sellAuto_npc', 'prt_in 126 76'],
    ['sellAuto_npc_steps', 's'],
  ])
    config = replaceConfigLine(config, name, value);
  const buyBlock = `buyAuto 501 {
\tnpc prt_in 126 76
\tnpc_steps b
\tisMarket 0
\tstandpoint
\tdistance 3
\tprice
\tminAmount ${settings.redPotionMin}
\tmaxAmount ${settings.redPotionMax}
\tbatchSize ${settings.redPotionMax}
\tonlyIdentified 0
\tzeny
\tminDistance
\tmaxDistance
\tdisabled ${settings.enabled && settings.buy ? 0 : 1}
\tdcOnEmpty 0
}`;
  config = config.replace(
    /^buyAuto(?:\s+[^\r\n{]+)?\s*\{[\s\S]*?^\}/m,
    buyBlock,
  );
  await writeFile(configPath, config, 'utf8');

  const pickupLines = [
    '# Managed by the player supply-cycle settings.',
    'all 1',
  ];
  for (const rule of settings.rules) {
    if (rule.action === 'ignore') pickupLines.push(`${rule.itemId} 0`);
    if (rule.action === 'discard') pickupLines.push(`${rule.itemId} -1`);
  }
  await writeFile(pickupPath, `${pickupLines.join('\n')}\n`, 'utf8');

  const managedStart = '# BEGIN PLAYER SUPPLY RULES',
    managedEnd = '# END PLAYER SUPPLY RULES';
  let itemControl = await readFile(itemControlPath, 'utf8');
  itemControl = replaceConfigLine(
    itemControl,
    '501',
    `${settings.redPotionMax} 0 0 # Red Potion`,
  );
  itemControl = itemControl.replace(
    new RegExp(`${managedStart}[\\s\\S]*?${managedEnd}\\s*`, 'g'),
    '',
  );
  const itemLines = [managedStart];
  for (const rule of settings.rules) {
    if (rule.action === 'sell') itemLines.push(`${rule.itemId} 0 0 1`);
    if (rule.action === 'store') itemLines.push(`${rule.itemId} 0 1 0`);
    if (rule.action === 'keep') itemLines.push(`${rule.itemId} 30000 0 0`);
  }
  itemLines.push(managedEnd);
  await writeFile(
    itemControlPath,
    `${itemControl.trimEnd()}\n\n${itemLines.join('\n')}\n`,
    'utf8',
  );
  await writeFile(
    join(folder, 'supply-cycle.json'),
    `${JSON.stringify(settings, null, 2)}\n`,
    'utf8',
  );
  await queueCharacterCommand(account, 'supply_cycle_reload', '1');
  return settings;
}
async function allocateStatusPoint(account, statName) {
  if (!baseStats.has(statName)) throw new Error('無效的能力值');
  const snapshot = await currentStatusSnapshot(instanceId(account.accountId));
  if (snapshot) {
    const current = Number(snapshot[statName]),
      available = Number(snapshot.statusPoint),
      cost = statusPointCost(current);
    if (current >= 130) throw new Error('能力值已達目前上限');
    if (available < cost) throw new Error('能力點數不足');
    await queueCharacterCommand(account, 'stat', statName);
    return null;
  }
  const character = await queryCharacter(account.accountId);
  if (!character) throw new Error('找不到角色');
  const current = Number(character[statName]),
    cost = statusPointCost(current);
  if (current >= 130) throw new Error('能力值已達目前上限');
  if (character.statusPoint < cost) throw new Error('能力點數不足');
  if (character.online) throw new Error('角色狀態尚未同步');
  const column = statName === 'int' ? '`int`' : statName;
  await sql(
    `UPDATE \`char\` SET ${column}=${column}+1,status_point=status_point-${cost} WHERE char_id=${character.charId} AND online=0 AND status_point>=${cost};`,
  );
  return await queryCharacter(account.accountId);
}
async function resetStatusPoints(account) {
  const snapshot = await currentStatusSnapshot(instanceId(account.accountId));
  if (!snapshot) throw new Error('角色目前不在線上');
  return await queueCharacterCommand(account, 'reset_stats', '1');
}

async function queueSkillAutomation(account, input) {
  const mode = String(input.mode ?? ''),
    enabled = input.enabled === true;
  if (!['attack', 'selfRecovery', 'selfBuff'].includes(mode))
    throw new Error('無效的技能自動化類型');
  if (!enabled) {
    const action =
      mode === 'attack'
        ? 'skill_auto_attack'
        : mode === 'selfRecovery'
          ? 'skill_auto_self'
          : 'skill_auto_buff';
    return await queueCharacterCommand(account, action, 'off');
  }
  const snapshot = await currentStatusSnapshot(instanceId(account.accountId));
  if (!snapshot) throw new Error('角色目前不在線上');
  const skillId = Number(input.skillId),
    definition = skillAutomationDefinitions.get(
      `${Number(snapshot.jobId)}:${skillId}`,
    ),
    live = snapshot.skills?.find((skill) => Number(skill.id) === skillId);
  if (!definition || !live || Number(live.level) < 1)
    throw new Error('角色尚未習得此技能');
  const resolvedMode =
    definition.automationMode === 'selfRecovery'
      ? 'selfRecovery'
      : definition.automationMode === 'selfBuff'
        ? 'selfBuff'
        : definition.automationMode
          ? 'attack'
          : '';
  if (resolvedMode !== mode) throw new Error('技能自動化類型不符');
  const level = Math.min(
      Number(live.level),
      Math.max(1, Math.trunc(Number(input.level) || Number(live.level))),
    ),
    minimumSp = Number.isFinite(Number(input.minimumSp))
      ? Math.trunc(Number(input.minimumSp))
      : 20;
  if (minimumSp < 0 || minimumSp > 95)
    throw new Error('最低 SP 必須介於 0% 至 95%');
  if (mode === 'attack') {
    const resources = definition.resources ?? {},
      zenyCost = Number(resources.zenyCostByLevel?.[level - 1] ?? 0),
      requiredWeapons = Array.isArray(resources.weapons)
        ? resources.weapons
        : [],
      requiredAmmo = Array.isArray(resources.ammo) ? resources.ammo : [],
      ammoAmount = Math.max(0, Number(resources.ammoAmount) || 0),
      inventory = Array.isArray(snapshot.inventory) ? snapshot.inventory : [];
    if (zenyCost > Number(snapshot.zeny ?? 0))
      throw new Error(`Zeny 不足，此技能每次需要 ${zenyCost}`);
    const equippedWeapon = requiredWeapons.length
      ? inventory.find(
          (item) =>
            item.equipped && requiredWeapons.includes(String(item.weaponType)),
        )
      : null;
    if (requiredWeapons.length && !equippedWeapon)
      throw new Error(`技能需要裝備 ${requiredWeapons.join('／')}`);
    const ammoTypes = requiredAmmo
        .map((name) => openKoreAmmoItemTypes[name])
        .filter(Number.isInteger),
      equippedAmmo = ammoTypes.length
        ? inventory.find(
            (item) =>
              item.equipped &&
              ammoTypes.includes(Number(item.itemType)) &&
              Number(item.amount) >= ammoAmount,
          )
        : null;
    if (requiredAmmo.length && !equippedAmmo)
      throw new Error(
        `技能需要已裝備 ${requiredAmmo.join('／')} × ${ammoAmount}`,
      );
    return await queueCharacterCommand(
      account,
      'skill_auto_attack',
      `${definition.handle},${level},${minimumSp},${definition.automationMode === 'attackSelf' ? 1 : 0},${zenyCost},${requiredWeapons.join('+')},${Number(equippedAmmo?.itemId ?? 0)},${ammoAmount}`,
    );
  }
  if (mode === 'selfBuff') {
    if (!/^EFST_[A-Z0-9_]+$/.test(definition.automationStatus ?? ''))
      throw new Error('技能狀態來源不完整');
    return await queueCharacterCommand(
      account,
      'skill_auto_buff',
      `${definition.handle},${level},${minimumSp},${definition.automationStatus}`,
    );
  }
  const hpBelow = Number.isFinite(Number(input.hpBelow))
    ? Math.trunc(Number(input.hpBelow))
    : 70;
  if (hpBelow < 5 || hpBelow > 95)
    throw new Error('恢復門檻必須介於 5% 至 95%');
  return await queueCharacterCommand(
    account,
    'skill_auto_self',
    `${definition.handle},${level},${minimumSp},${hpBelow}`,
  );
}

async function testPort(portNumber) {
  return await new Promise((resolve) =>
    import('node:net').then(({ createConnection }) => {
      const socket = createConnection({ host: '127.0.0.1', port: portNumber });
      const done = (v) => {
        socket.destroy();
        resolve(v);
      };
      socket.setTimeout(500, () => done(false));
      socket.once('connect', () => done(true));
      socket.once('error', () => done(false));
    }),
  );
}
async function serviceHealth() {
  const [database, login, character, map] = await Promise.all(
    [3307, 6901, 6122, 5122].map(testPort),
  );
  const online = Number(
    await sql('SELECT COUNT(*) FROM `char` WHERE online=1;').catch(() => 0),
  );
  return { database, login, character, map, onlinePlayers: online };
}
async function publicWorldHealth() {
  const now = Date.now();
  if (publicHealthCache.value && now - publicHealthCache.at < 1000)
    return publicHealthCache.value;
  if (publicHealthCache.pending) return await publicHealthCache.pending;
  publicHealthCache.pending = serviceHealth().then((services) => ({
    online:
      services.database && services.login && services.character && services.map,
    onlinePlayers: services.onlinePlayers,
  }));
  try {
    const value = await publicHealthCache.pending;
    publicHealthCache = { at: Date.now(), value, pending: null };
    return value;
  } catch (error) {
    publicHealthCache.pending = null;
    throw error;
  }
}

async function ensureWorker(account) {
  const id = instanceId(account.accountId),
    folder = join(instancesRoot, id);
  const credentials = await accountCredentials(account.accountId);
  await execFileAsync(
    'powershell.exe',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      join(root, 'ops', 'ro-stack', 'openkore-instance.ps1'),
      'create',
      '-InstanceId',
      id,
      '-Username',
      credentials.username,
      '-Password',
      credentials.password,
      '-CharacterSlot',
      '0',
      '-LockMap',
      'prt_fild08',
    ],
    { cwd: root, windowsHide: true },
  );
  return id;
}
async function startWorker(account) {
  const id = await ensureWorker(account);
  if ((await currentLog(id)).running) return;
  const { spawn } = await import('node:child_process'),
    folder = join(instancesRoot, id),
    openkore = join(runtime, 'openkore'),
    logs = join(folder, 'logs'),
    commands = join(folder, 'commands');
  await mkdir(logs, { recursive: true });
  await mkdir(commands, { recursive: true });
  const stamp = new Date()
      .toISOString()
      .replaceAll(/[-:TZ.]/g, '')
      .slice(0, 14),
    stdout = join(logs, `${stamp}.out.log`),
    stderr = join(logs, `${stamp}.err.log`),
    tables = `${join(folder, 'tables')};${join(openkore, 'tables')}`;
  const outFd = openSync(stdout, 'a'),
    errFd = openSync(stderr, 'a'),
    plugins = join(root, 'ops', 'ro-stack', 'openkore-plugins');
  const child = spawn(
    join(openkore, 'start.exe'),
    [
      `--control=${join(folder, 'control')}`,
      `--tables=${tables}`,
      `--plugins=${plugins}`,
      '--interface=Headless',
    ],
    {
      cwd: openkore,
      windowsHide: true,
      detached: true,
      stdio: ['ignore', outFd, errFd],
      env: {
        ...process.env,
        RO_STATUS_SNAPSHOT: join(folder, 'status.json'),
        RO_COMMAND_DIR: commands,
        RO_SOCIAL_LOG: join(folder, 'social.jsonl'),
      },
    },
  );
  closeSync(outFd);
  closeSync(errFd);
  child.unref();
  await writeFile(
    join(folder, 'state.json'),
    JSON.stringify(
      { pid: child.pid, stdout, stderr, startedAt: Date.now() },
      null,
      2,
    ),
  );
}
async function stopWorker(account) {
  const id = instanceId(account.accountId),
    statePath = join(instancesRoot, id, 'state.json');
  try {
    const state = JSON.parse(await readFile(statePath, 'utf8'));
    process.kill(Number(state.pid));
  } catch {}
  await unlink(statePath).catch(() => {});
}
async function setAutomationIntent(accountId, desired) {
  await sql(
    `INSERT INTO web_automation (account_id,desired_running,updated_at) VALUES (${Number(accountId)},${desired ? 1 : 0},${Date.now()}) ON DUPLICATE KEY UPDATE desired_running=VALUES(desired_running),updated_at=VALUES(updated_at);`,
  );
}
const defaultPreferences = Object.freeze({
  musicEnabled: true,
  soundEnabled: true,
  musicVolume: 20,
  soundVolume: 35,
  damageFloatsEnabled: true,
  damageFloatSize: 14,
  damageFloatScale: 50,
  damageFloatOpacity: 100,
  damageFloatWeight: 800,
  damageFloatFont: 'classic',
  damageFloatPositionX: 72,
  damageFloatPositionY: 72,
  damageFloatArc: 100,
});
const preferenceVolume = (value, fallback) =>
  Number.isFinite(Number(value))
    ? Math.max(0, Math.min(100, Math.round(Number(value))))
    : fallback;
const preferenceDamageSize = (value, fallback) =>
  Number.isFinite(Number(value))
    ? Math.max(10, Math.min(28, Math.round(Number(value))))
    : fallback;
const preferenceRange = (value, fallback, minimum, maximum) =>
  Number.isFinite(Number(value))
    ? Math.max(minimum, Math.min(maximum, Math.round(Number(value))))
    : fallback;
const damageFloatFonts = new Set([
  'classic',
  'traditional',
  'arial',
  'consolas',
  'system',
]);
async function queryPreferences(accountId) {
  const cached = preferenceCache.get(Number(accountId));
  if (cached && Date.now() - cached.at < 60000) return { ...cached.value };
  const output = await sql(
    `SELECT music_enabled,sound_enabled,music_volume,sound_volume,damage_floats_enabled,damage_float_size,damage_float_scale,damage_float_opacity,damage_float_weight,damage_float_font,damage_float_position_x,damage_float_position_y,damage_float_arc FROM web_preferences WHERE account_id=${Number(accountId)} LIMIT 1;`,
  );
  if (!output) {
    const value = { ...defaultPreferences };
    preferenceCache.set(Number(accountId), { at: Date.now(), value });
    return value;
  }
  const row = output.split('\t');
  const value = {
    musicEnabled: row[0] === '1',
    soundEnabled: row[1] === '1',
    musicVolume: Number(row[2]),
    soundVolume: Number(row[3]),
    damageFloatsEnabled: row[4] === '1',
    damageFloatSize: Number(row[5]),
    damageFloatScale: Number(row[6]),
    damageFloatOpacity: Number(row[7]),
    damageFloatWeight: Number(row[8]),
    damageFloatFont: damageFloatFonts.has(row[9]) ? row[9] : 'classic',
    damageFloatPositionX: Number(row[10]),
    damageFloatPositionY: Number(row[11]),
    damageFloatArc: Number(row[12]),
  };
  preferenceCache.set(Number(accountId), { at: Date.now(), value });
  return { ...value };
}
async function savePreferences(accountId, input) {
  const current = await queryPreferences(accountId),
    next = {
      musicEnabled:
        typeof input.musicEnabled === 'boolean'
          ? input.musicEnabled
          : current.musicEnabled,
      soundEnabled:
        typeof input.soundEnabled === 'boolean'
          ? input.soundEnabled
          : current.soundEnabled,
      musicVolume: preferenceVolume(input.musicVolume, current.musicVolume),
      soundVolume: preferenceVolume(input.soundVolume, current.soundVolume),
      damageFloatsEnabled:
        typeof input.damageFloatsEnabled === 'boolean'
          ? input.damageFloatsEnabled
          : current.damageFloatsEnabled,
      damageFloatSize: preferenceDamageSize(
        input.damageFloatSize,
        current.damageFloatSize,
      ),
      damageFloatScale: preferenceRange(
        input.damageFloatScale,
        current.damageFloatScale,
        10,
        1000,
      ),
      damageFloatOpacity: preferenceRange(
        input.damageFloatOpacity,
        current.damageFloatOpacity,
        10,
        100,
      ),
      damageFloatWeight: [400, 500, 600, 700, 800, 900].includes(
        Number(input.damageFloatWeight),
      )
        ? Number(input.damageFloatWeight)
        : current.damageFloatWeight,
      damageFloatFont: damageFloatFonts.has(String(input.damageFloatFont))
        ? String(input.damageFloatFont)
        : current.damageFloatFont,
      damageFloatPositionX: preferenceRange(
        input.damageFloatPositionX,
        current.damageFloatPositionX,
        0,
        100,
      ),
      damageFloatPositionY: preferenceRange(
        input.damageFloatPositionY,
        current.damageFloatPositionY,
        0,
        100,
      ),
      damageFloatArc: preferenceRange(
        input.damageFloatArc,
        current.damageFloatArc,
        0,
        200,
      ),
    };
  await sql(
    `INSERT INTO web_preferences (account_id,music_enabled,sound_enabled,music_volume,sound_volume,damage_floats_enabled,damage_float_size,damage_float_scale,damage_float_opacity,damage_float_weight,damage_float_font,damage_float_position_x,damage_float_position_y,damage_float_arc,updated_at) VALUES (${Number(accountId)},${next.musicEnabled ? 1 : 0},${next.soundEnabled ? 1 : 0},${next.musicVolume},${next.soundVolume},${next.damageFloatsEnabled ? 1 : 0},${next.damageFloatSize},${next.damageFloatScale},${next.damageFloatOpacity},${next.damageFloatWeight},'${next.damageFloatFont}',${next.damageFloatPositionX},${next.damageFloatPositionY},${next.damageFloatArc},${Date.now()}) ON DUPLICATE KEY UPDATE music_enabled=VALUES(music_enabled),sound_enabled=VALUES(sound_enabled),music_volume=VALUES(music_volume),sound_volume=VALUES(sound_volume),damage_floats_enabled=VALUES(damage_floats_enabled),damage_float_size=VALUES(damage_float_size),damage_float_scale=VALUES(damage_float_scale),damage_float_opacity=VALUES(damage_float_opacity),damage_float_weight=VALUES(damage_float_weight),damage_float_font=VALUES(damage_float_font),damage_float_position_x=VALUES(damage_float_position_x),damage_float_position_y=VALUES(damage_float_position_y),damage_float_arc=VALUES(damage_float_arc),updated_at=VALUES(updated_at);`,
  );
  preferenceCache.set(Number(accountId), { at: Date.now(), value: next });
  return next;
}
async function restoreAutomationWorkers() {
  const output = await sql(
    `SELECT a.account_id FROM web_automation a JOIN login l ON l.account_id=a.account_id JOIN \`char\` c ON c.account_id=a.account_id AND c.char_num=0 WHERE a.desired_running=1 AND l.state=0;`,
  );
  const accountIds = output
    ? output.split(/\r?\n/).map(Number).filter(Number.isFinite)
    : [];
  for (const accountId of accountIds) {
    try {
      await startWorker({ accountId });
    } catch (error) {
      console.error(
        `Unable to restore player_${accountId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
  if (accountIds.length)
    console.log(`Restored ${accountIds.length} automation worker(s).`);
}

function safeTarget(base, pathname) {
  const target = normalize(join(base, pathname));
  const rel = relative(base, target);
  return !rel.startsWith('..') && !isAbsolute(rel) ? target : null;
}
async function serveFile(pathname, response) {
  const isPublic = pathname.startsWith('/ro/'),
    base = isPublic ? publicRoot : webRoot,
    requested = isPublic
      ? pathname.slice(1)
      : pathname === '/'
        ? 'index.html'
        : pathname.slice(1),
    target = safeTarget(base, requested);
  if (!target) return false;
  try {
    const content = await readFile(target);
    response.writeHead(200, {
      'content-type':
        mime[extname(target).toLowerCase()] ?? 'application/octet-stream',
      'cache-control':
        isPublic && !pathname.includes('/maps/')
          ? 'public, max-age=3600'
          : 'no-store',
      ...securityHeaders,
    });
    response.end(content);
    return true;
  } catch {
    return false;
  }
}
async function serveVoice(voiceId, response) {
  if (!/^[a-f0-9-]{36}$/i.test(voiceId)) return false;
  const output = await sql(
    `SELECT mime_type,file_ext FROM web_voice_messages WHERE voice_id='${escapeSql(voiceId)}' LIMIT 1;`,
  );
  if (!output) return false;
  const [mimeType, extension] = output.split('\t');
  if (!voiceTypes.has(mimeType) || voiceTypes.get(mimeType) !== extension)
    return false;
  try {
    const content = await readFile(join(voiceRoot, `${voiceId}.${extension}`));
    response.writeHead(200, {
      'content-type': mimeType,
      'content-length': content.length,
      'cache-control': 'private, max-age=3600',
      'content-disposition': 'inline',
      ...securityHeaders,
    });
    response.end(content);
    return true;
  } catch {
    return false;
  }
}
function sessionCookie(token, request) {
  const secure =
    request.headers['cf-connecting-ip'] ||
    String(request.headers['x-forwarded-proto'] ?? '')
      .split(',')[0]
      .trim() === 'https';
  return `ro_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secure ? '; Secure' : ''}`;
}

createServer(async (request, response) => {
  try {
    const url = new URL(
      request.url ?? '/',
      `http://${request.headers.host ?? 'localhost'}`,
    );
    if (!url.pathname.startsWith('/api/')) {
      if (await serveFile(url.pathname, response)) return;
      return json(response, 404, { error: 'not_found' });
    }
    if (!mutationOriginAllowed(request))
      return json(response, 403, { error: '拒絕跨站操作' });
    if (url.pathname === '/api/account' && request.method === 'POST') {
      const body = await requestBody(request),
        username = String(body.username ?? '').trim();
      if (!allowLogin(request, username))
        return json(
          response,
          429,
          { error: '登入嘗試過多，請五分鐘後再試' },
          { 'retry-after': '300' },
        );
      const result = await serializedLoginOrRegister(
        username,
        String(body.password ?? ''),
        body.sex,
        clientAddress(request),
      );
      return json(
        response,
        200,
        { account: result.account, registered: result.registered },
        { 'set-cookie': sessionCookie(result.token, request) },
      );
    }
    if (url.pathname === '/api/account' && request.method === 'DELETE') {
      const token = cookie(request, 'ro_session');
      if (token) {
        const hash = tokenHash(token);
        sessionCache.delete(hash);
        await sql(`DELETE FROM web_sessions WHERE token_hash='${hash}';`);
      }
      return json(
        response,
        200,
        { ok: true },
        {
          'set-cookie':
            'ro_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0',
        },
      );
    }
    if (url.pathname === '/api/health')
      return json(response, 200, { ok: (await publicWorldHealth()).online });
    if (url.pathname === '/api/internal/health') {
      if (!loopbackRequest(request))
        return json(response, 404, { error: 'not_found' });
      return json(response, 200, { services: await serviceHealth() });
    }
    const account = await sessionAccount(request);
    if (url.pathname === '/api/session')
      return json(response, 200, {
        account: account
          ? {
              accountId: account.accountId,
              username: account.username,
              sex: account.sex,
              characterName: account.characterName,
            }
          : null,
      });
    if (!account) return json(response, 401, { error: '請先登入' });
    if (url.pathname === '/api/preferences' && request.method === 'GET')
      return json(response, 200, {
        preferences: await queryPreferences(account.accountId),
      });
    if (url.pathname === '/api/preferences' && request.method === 'POST') {
      const body = await requestBody(request);
      return json(response, 200, {
        preferences: await savePreferences(account.accountId, body),
      });
    }
    if (url.pathname === '/api/characters' && request.method === 'POST') {
      const body = await requestBody(request);
      await createCharacter(
        account,
        String(body.name ?? '').trim(),
        body.hair,
        body.hairColor,
        body.sex,
        String(body.targetJob ?? ''),
      );
      const token = cookie(request, 'ro_session');
      if (token) sessionCache.delete(tokenHash(token));
      const refreshed = await sessionAccount(request);
      if (refreshed?.characterId) {
        await setAutomationIntent(refreshed.accountId, true);
        await startWorker(refreshed);
      }
      return json(response, 200, { characterName: refreshed?.characterName });
    }
    if (url.pathname === '/api/job-target' && request.method === 'POST') {
      const body = await requestBody(request);
      const targetJob = await saveFirstJobTarget(
        account,
        String(body.job ?? ''),
      );
      const token = cookie(request, 'ro_session');
      if (token) sessionCache.delete(tokenHash(token));
      return json(response, 200, { targetJob });
    }
    if (url.pathname === '/api/state') {
      if (!account.characterId)
        return json(response, 200, {
          account: { username: account.username },
          needsCharacter: true,
          world: await publicWorldHealth(),
        });
      const id = instanceId(account.accountId),
        [session, derived, world, onboarding, edenProgress, supplyCycle] =
          await Promise.all([
          currentLog(id),
          currentStatusSnapshot(id),
          publicWorldHealth(),
          queryOnboardingProgress(account.characterId),
          queryEdenProgress(account.characterId),
          readSupplyCycle(account),
        ]),
        storedCharacter = derived
          ? null
          : await queryCharacter(account.accountId),
        [equipment, inventory] = derived
          ? [[], []]
          : await Promise.all([
              storedCharacter ? queryEquipment(storedCharacter.charId) : [],
              storedCharacter ? queryInventory(storedCharacter.charId) : [],
            ]),
        parsed = parseLog(session.text),
        liveBase = Number(
          [...session.text.matchAll(/You are now level (\d+)/g)].at(-1)?.[1] ??
            0,
        ),
        liveJob = Number(
          [...session.text.matchAll(/You are now job level (\d+)/g)].at(
            -1,
          )?.[1] ?? 0,
        ),
        mergedInventory = mergeLiveInventory(
          inventory,
          derived,
          Number(derived?.jobId ?? storedCharacter?.classId ?? 0),
        ),
        currentEquipment = derived ? liveEquipment(mergedInventory) : equipment,
        character = derived
          ? {
              charId: account.characterId,
              name: derived.name || account.characterName,
              classId: Number(derived.jobId ?? 0),
              sex: account.sex,
              hair: account.hair,
              hairColor: account.hairColor,
              targetJob: account.targetJob,
              baseLevel: Number(derived.baseLevel ?? liveBase),
              jobLevel: Number(derived.jobLevel ?? liveJob),
              baseExp: Number(derived.baseExp ?? 0),
              jobExp: Number(derived.jobExp ?? 0),
              zeny: Number(derived.zeny ?? 0),
              str: Number(derived.str ?? 0),
              agi: Number(derived.agi ?? 0),
              vit: Number(derived.vit ?? 0),
              int: Number(derived.int ?? 0),
              dex: Number(derived.dex ?? 0),
              luk: Number(derived.luk ?? 0),
              hp: Number(derived.hp ?? 0),
              maxHp: Number(derived.maxHp ?? 0),
              sp: Number(derived.sp ?? 0),
              maxSp: Number(derived.maxSp ?? 0),
              statusPoint: Number(derived.statusPoint ?? 0),
              skillPoint: Number(derived.skillPoint ?? 0),
              map: derived.map,
              x: Number(derived.playerX ?? 0),
              y: Number(derived.playerY ?? 0),
              online: true,
            }
          : storedCharacter
            ? {
                ...storedCharacter,
                baseLevel: Math.max(storedCharacter.baseLevel, liveBase),
                jobLevel: Math.max(storedCharacter.jobLevel, liveJob),
              }
            : null;
      const eden = {
        ...edenProgress,
        journey: derived?.edenJourney ?? null,
        milestones: edenProgress.milestones.map((milestone) => ({
          ...milestone,
          status:
            milestone.status === 'complete'
              ? 'complete'
              : edenProgress.member &&
                  Number(character?.baseLevel ?? 0) >= milestone.minimumLevel
                ? 'available'
                : 'locked',
        })),
      };
      return json(response, 200, {
        account: { username: account.username },
        running: session.running,
        startedAt: session.startedAt,
        character,
        equipment: currentEquipment,
        inventory: mergedInventory,
        derived,
        onboarding,
        eden,
        supplyCycle,
        world,
        ...parsed,
      });
    }
    if (url.pathname === '/api/events') {
      const id = instanceId(account.accountId),
        [session, live] = await Promise.all([
          currentLog(id),
          currentStatusSnapshot(id),
        ]),
        lines = relevantLogLines(session.text),
        requested = url.searchParams.has('cursor')
          ? Number(url.searchParams.get('cursor'))
          : null,
        valid =
          Number.isInteger(requested) &&
          requested >= 0 &&
          requested <= lines.length &&
          lines.length - requested <= 500,
        start = valid ? requested : Math.max(0, lines.length - 220);
      return json(response, 200, {
        cursor: lines.length,
        reset: !valid,
        lines: lines.slice(start),
        live,
      });
    }
    if (url.pathname === '/api/social' && request.method === 'GET') {
      const events = await readSocialEvents(
          instanceId(account.accountId),
          account.characterName,
        ),
        requested = url.searchParams.has('cursor')
          ? Number(url.searchParams.get('cursor'))
          : null,
        valid =
          Number.isInteger(requested) &&
          requested >= 0 &&
          requested <= events.length &&
          events.length - requested <= 300,
        start = valid ? requested : Math.max(0, events.length - 120);
      return json(response, 200, {
        cursor: events.length,
        reset: !valid,
        events: events.slice(start),
      });
    }
    if (url.pathname === '/api/social' && request.method === 'POST') {
      if (!account.characterId)
        return json(response, 409, { error: '請先建立角色' });
      const body = await requestBody(request);
      return json(response, 202, await queueSocialAction(account, body));
    }
    if (url.pathname === '/api/social/voice' && request.method === 'POST') {
      if (!account.characterId)
        return json(response, 409, { error: '請先建立角色' });
      return json(response, 201, await queueVoiceMessage(account, request));
    }
    if (
      url.pathname.startsWith('/api/social/voice/') &&
      request.method === 'GET'
    ) {
      const voiceId = url.pathname.slice('/api/social/voice/'.length);
      if (await serveVoice(voiceId, response)) return;
      return json(response, 404, { error: '語音訊息不存在' });
    }
    if (url.pathname === '/api/status-point' && request.method === 'POST') {
      const body = await requestBody(request);
      return json(response, 200, {
        character: await allocateStatusPoint(account, String(body.stat ?? '')),
      });
    }
    if (url.pathname === '/api/skill-point' && request.method === 'POST') {
      const body = await requestBody(request),
        skillId = Number(body.skillId),
        snapshot = await currentStatusSnapshot(instanceId(account.accountId));
      if (!snapshot || Number(snapshot.skillPoint) < 1)
        throw new Error('技能點數不足');
      const skill = snapshot.skills?.find(
        (entry) => Number(entry.id) === skillId,
      );
      if (!skill || Number(skill.upgradable) !== 1)
        throw new Error('此技能目前無法提升');
      return json(
        response,
        202,
        await queueCharacterCommand(account, 'skill', String(skillId)),
      );
    }
    if (url.pathname === '/api/skill-automation' && request.method === 'POST') {
      const body = await requestBody(request);
      return json(response, 202, await queueSkillAutomation(account, body));
    }
    if (url.pathname === '/api/supply-cycle' && request.method === 'POST') {
      if (!account.characterId)
        return json(response, 409, { error: '請先建立角色' });
      const body = await requestBody(request);
      return json(response, 200, {
        supplyCycle: await saveSupplyCycle(account, body),
      });
    }
    if (url.pathname === '/api/job-change' && request.method === 'POST') {
      if (!account.characterId)
        return json(response, 409, { error: '請先建立角色' });
      const body = await requestBody(request);
      return json(response, 202, await queueJobChangeAction(account, body));
    }
    if (url.pathname === '/api/onboarding/resume' && request.method === 'POST')
      return json(response, 202, await queueOnboardingResume(account));
    if (url.pathname === '/api/eden/enroll' && request.method === 'POST')
      return json(response, 202, await queueEdenEnrollment(account));
    if (url.pathname === '/api/status-reset' && request.method === 'POST')
      return json(response, 202, await resetStatusPoints(account));
    if (url.pathname === '/api/item-action' && request.method === 'POST') {
      if (!account.characterId)
        return json(response, 409, { error: '請先建立角色' });
      const body = await requestBody(request);
      return json(response, 202, await queueItemAction(account, body));
    }
    if (url.pathname === '/api/automation' && request.method === 'POST') {
      if (!account.characterId)
        return json(response, 409, { error: '請先建立角色' });
      const body = await requestBody(request);
      if (body.action === 'start') {
        await setAutomationIntent(account.accountId, true);
        await startWorker(account);
      } else if (body.action === 'stop') {
        await setAutomationIntent(account.accountId, false);
        await stopWorker(account);
      } else return json(response, 400, { error: '無效操作' });
      return json(response, 200, { ok: true, action: body.action });
    }
    return json(response, 404, { error: 'not_found' });
  } catch (error) {
    console.error('Dashboard request failed:', error);
    const status = Number(error?.statusCode) || 400;
    const headers = Number(error?.retryAfter)
      ? { 'retry-after': String(error.retryAfter) }
      : {};
    return json(
      response,
      status,
      { error: publicErrorMessage(error) },
      headers,
    );
  }
}).listen(port, host, async () => {
  console.log(`RO multiplayer dashboard listening on http://${host}:${port}`);
  await restoreAutomationWorkers();
});
