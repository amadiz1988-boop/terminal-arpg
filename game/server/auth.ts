import { getDatabase } from '@/db';

const SESSION_COOKIE = 'ro_session';
const SESSION_DAYS = 30;
export const PASSWORD_ITERATIONS = 600_000;

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return bytesToBase64(new Uint8Array(digest));
}

async function derivePassword(password: string, salt: Uint8Array, iterations: number) {
  const saltBuffer = new Uint8Array(salt).buffer;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBuffer, iterations },
    key,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}

export function normalizeUsername(username: string) {
  return username.normalize('NFKC').trim().toLocaleLowerCase('en-US');
}

export function validateCredentials(username: string, password: string) {
  const normalized = normalizeUsername(username);
  if (normalized.length < 4 || normalized.length > 24)
    return '帳號長度需為 4 至 24 個字元';
  if (password.length < 8 || password.length > 72)
    return '密碼長度需為 8 至 72 個字元';
  return null;
}

export async function makePasswordRecord(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return {
    hash: await derivePassword(password, salt, PASSWORD_ITERATIONS),
    salt: bytesToBase64(salt),
    iterations: PASSWORD_ITERATIONS,
  };
}

export async function verifyPassword(
  password: string,
  salt: string,
  iterations: number,
  expected: string,
) {
  const actual = await derivePassword(password, base64ToBytes(salt), iterations);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1)
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get('cookie') ?? '';
  for (const part of cookie.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return null;
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    throw new Response('來源驗證失敗', { status: 403 });
}

export async function createSession(accountId: string, request: Request) {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = bytesToBase64(tokenBytes)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
  const tokenHash = await sha256(token);
  const now = Date.now();
  const expiresAt = now + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await getDatabase()
    .prepare(
      'INSERT INTO sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    )
    .bind(tokenHash, accountId, now, expiresAt)
    .run();
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}${secure}`;
}

export async function authenticatedAccount(request: Request) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await getDatabase()
    .prepare(
      `SELECT accounts.id, accounts.username
       FROM sessions
       JOIN accounts ON accounts.id = sessions.account_id
       WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
    )
    .bind(tokenHash, Date.now())
    .first<{ id: string; username: string }>();
  return row ?? null;
}

export async function requireAccount(request: Request) {
  const account = await authenticatedAccount(request);
  if (!account) throw new Response('請先登入', { status: 401 });
  return account;
}

export async function deleteSession(request: Request) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (token)
    await getDatabase()
      .prepare('DELETE FROM sessions WHERE token_hash = ?')
      .bind(await sha256(token))
      .run();
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}
