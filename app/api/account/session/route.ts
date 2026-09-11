import { getDatabase } from '@/db';
import {
  assertSameOrigin,
  authenticatedAccount,
  createSession,
  deleteSession,
  makePasswordRecord,
  normalizeUsername,
  validateCredentials,
  verifyPassword,
} from '@/game/server/auth';

export async function GET(request: Request) {
  const account = await authenticatedAccount(request);
  if (!account) return Response.json({ account: null });
  const characters = await getDatabase()
    .prepare(
      `SELECT id, name, sex, hair_style AS hairStyle, hair_color AS hairColor,
              automation_running AS automationRunning
       FROM characters WHERE account_id = ? ORDER BY created_at`,
    )
    .bind(account.id)
    .all();
  return Response.json({ account, characters: characters.results });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = (await request.json()) as { username?: string; password?: string };
    const username = body.username?.trim() ?? '';
    const password = body.password ?? '';
    const invalid = validateCredentials(username, password);
    if (invalid) return Response.json({ error: invalid }, { status: 400 });
    const normalized = normalizeUsername(username);
    const database = getDatabase();
    let account = await database
      .prepare(
        `SELECT id, username, password_hash AS passwordHash,
                password_salt AS passwordSalt,
                password_iterations AS passwordIterations
         FROM accounts WHERE username_normalized = ?`,
      )
      .bind(normalized)
      .first<{
        id: string;
        username: string;
        passwordHash: string;
        passwordSalt: string;
        passwordIterations: number;
      }>();
    let registered = false;
    if (!account) {
      const id = crypto.randomUUID();
      const record = await makePasswordRecord(password);
      try {
        await database
          .prepare(
            `INSERT INTO accounts
             (id, username, username_normalized, password_hash, password_salt,
              password_iterations, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            id,
            username,
            normalized,
            record.hash,
            record.salt,
            record.iterations,
            Date.now(),
          )
          .run();
        account = {
          id,
          username,
          passwordHash: record.hash,
          passwordSalt: record.salt,
          passwordIterations: record.iterations,
        };
        registered = true;
      } catch {
        account = await database
          .prepare(
            `SELECT id, username, password_hash AS passwordHash,
                    password_salt AS passwordSalt,
                    password_iterations AS passwordIterations
             FROM accounts WHERE username_normalized = ?`,
          )
          .bind(normalized)
          .first<typeof account>();
      }
    }
    if (
      !account ||
      !(await verifyPassword(
        password,
        account.passwordSalt,
        account.passwordIterations,
        account.passwordHash,
      ))
    )
      return Response.json({ error: '帳號或密碼錯誤' }, { status: 401 });
    const response = Response.json({
      account: { id: account.id, username: account.username },
      registered,
    });
    response.headers.append('Set-Cookie', await createSession(account.id, request));
    return response;
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: '登入服務暫時無法使用' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const response = Response.json({ ok: true });
    response.headers.append('Set-Cookie', await deleteSession(request));
    return response;
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: '登出失敗' }, { status: 500 });
  }
}
