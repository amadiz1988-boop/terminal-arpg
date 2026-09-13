import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export const SESSION_COOKIE = 'ghost_ops_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const FAILURE_WINDOW_MS = 10 * 60 * 1000;
const FAILURE_LIMIT = 5;
const PASSWORD_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function derivePassword(password, salt) {
  return scryptSync(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
}

function sign(value, secret) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separator = entry.indexOf('=');
        if (separator < 0) return [entry, ''];
        return [entry.slice(0, separator), entry.slice(separator + 1)];
      }),
  );
}

function validateCredentialRecord(value) {
  if (
    value?.version !== 1 ||
    typeof value.username !== 'string' ||
    !value.username ||
    typeof value.passwordSalt !== 'string' ||
    typeof value.passwordHash !== 'string' ||
    typeof value.sessionSecret !== 'string'
  ) {
    throw new Error('Ops Agent credential file is invalid');
  }
  for (const field of ['passwordSalt', 'passwordHash', 'sessionSecret']) {
    if (Buffer.from(value[field], 'base64').length < 16) {
      throw new Error('Ops Agent credential file is invalid');
    }
  }
  return Object.freeze(value);
}

export function generatePassword(length = 24) {
  const bytes = randomBytes(length);
  return [...bytes]
    .map((value) => PASSWORD_ALPHABET[value % PASSWORD_ALPHABET.length])
    .join('');
}

export function createCredentialRecord({
  username = 'admin',
  password = generatePassword(),
  now = Date.now,
} = {}) {
  const salt = randomBytes(24);
  const sessionSecret = randomBytes(48);
  return {
    password,
    record: {
      version: 1,
      username,
      passwordSalt: salt.toString('base64'),
      passwordHash: derivePassword(password, salt).toString('base64'),
      sessionSecret: sessionSecret.toString('base64'),
      createdAt: new Date(now()).toISOString(),
    },
  };
}

export async function writeCredentialRecord(path, record) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  await rename(temporary, path);
}

export async function loadCredentialRecord(path) {
  const value = JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
  return validateCredentialRecord(value);
}

export function createAuthService(record, options = {}) {
  const credentials = validateCredentialRecord(record);
  const now = options.now ?? Date.now;
  const sessionTtlMs = options.sessionTtlMs ?? SESSION_TTL_MS;
  const failureWindowMs = options.failureWindowMs ?? FAILURE_WINDOW_MS;
  const failureLimit = options.failureLimit ?? FAILURE_LIMIT;
  const globalFailureLimit = options.globalFailureLimit ?? 30;
  const failures = new Map();
  const secret = Buffer.from(credentials.sessionSecret, 'base64');
  const expectedHash = Buffer.from(credentials.passwordHash, 'base64');
  const salt = Buffer.from(credentials.passwordSalt, 'base64');

  function prune(key) {
    const cutoff = now() - failureWindowMs;
    const attempts = (failures.get(key) ?? []).filter((value) => value > cutoff);
    if (attempts.length) failures.set(key, attempts);
    else failures.delete(key);
    return attempts;
  }

  function isRateLimited(key) {
    return (
      prune(key).length >= failureLimit ||
      prune('__all__').length >= globalFailureLimit
    );
  }

  function authenticate(username, password, key = 'unknown') {
    if (isRateLimited(key)) return { ok: false, rateLimited: true };
    const suppliedHash = derivePassword(String(password ?? ''), salt);
    const valid =
      safeEqual(String(username ?? ''), credentials.username) &&
      safeEqual(suppliedHash, expectedHash);
    if (!valid) {
      const failedAt = now();
      failures.set(key, [...prune(key), failedAt]);
      failures.set('__all__', [...prune('__all__'), failedAt]);
      return { ok: false, rateLimited: isRateLimited(key) };
    }
    failures.delete(key);
    return { ok: true, rateLimited: false };
  }

  function issueSession() {
    const payload = Buffer.from(
      JSON.stringify({
        username: credentials.username,
        issuedAt: now(),
        expiresAt: now() + sessionTtlMs,
        nonce: randomBytes(12).toString('base64url'),
      }),
    ).toString('base64url');
    return `${payload}.${sign(payload, secret)}`;
  }

  function verifySession(cookieHeader) {
    const token = parseCookies(cookieHeader)[SESSION_COOKIE];
    if (!token) return false;
    const separator = token.lastIndexOf('.');
    if (separator < 0) return false;
    const payload = token.slice(0, separator);
    const signature = token.slice(separator + 1);
    if (!safeEqual(signature, sign(payload, secret))) return false;
    try {
      const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      return (
        value.username === credentials.username &&
        Number.isFinite(value.expiresAt) &&
        value.expiresAt > now()
      );
    } catch {
      return false;
    }
  }

  return Object.freeze({
    username: credentials.username,
    authenticate,
    issueSession,
    verifySession,
  });
}

export function sessionCookie(token, request, maxAgeSeconds = 12 * 60 * 60) {
  const forwardedProto = String(request.headers['x-forwarded-proto'] ?? '');
  const secure = forwardedProto
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .includes('https');
  return [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    secure ? 'Secure' : null,
    `Max-Age=${maxAgeSeconds}`,
  ]
    .filter(Boolean)
    .join('; ');
}

export function clearSessionCookie(request) {
  return sessionCookie('', request, 0);
}
