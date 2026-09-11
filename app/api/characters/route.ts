import { getDatabase } from '@/db';
import { assertSameOrigin, requireAccount } from '@/game/server/auth';
import { freshWorld } from '@/game/server/world';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const account = await requireAccount(request);
    const body = (await request.json()) as {
      name?: string;
      sex?: string;
      hairStyle?: number;
      hairColor?: number;
    };
    const name = body.name?.trim() ?? '';
    const hairStyle = Math.trunc(body.hairStyle ?? -1);
    const hairColor = Math.trunc(body.hairColor ?? -1);
    if (name.length < 4 || name.length > 24)
      return Response.json({ error: '角色名稱長度需為 4 至 24 個字元' }, { status: 400 });
    if (body.sex !== 'male' && body.sex !== 'female')
      return Response.json({ error: '請選擇角色性別' }, { status: 400 });
    if (hairStyle < 0 || hairStyle > 42 || hairColor < 0 || hairColor > 8)
      return Response.json({ error: '髮型或髮色超出固定資料範圍' }, { status: 400 });
    const count = await getDatabase()
      .prepare('SELECT COUNT(*) AS count FROM characters WHERE account_id = ?')
      .bind(account.id)
      .first<{ count: number }>();
    if ((count?.count ?? 0) >= 3)
      return Response.json({ error: '目前角色欄位已滿' }, { status: 409 });
    const id = crypto.randomUUID();
    const now = Date.now();
    const seed = new DataView(crypto.getRandomValues(new Uint32Array(1)).buffer).getUint32(0);
    const world = await freshWorld(request, seed);
    try {
      await getDatabase()
        .prepare(
          `INSERT INTO characters
           (id, account_id, name, sex, hair_style, hair_color, world_json,
            automation_running, simulated_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        )
        .bind(
          id,
          account.id,
          name,
          body.sex,
          hairStyle,
          hairColor,
          JSON.stringify(world),
          now,
          now,
        )
        .run();
    } catch {
      return Response.json({ error: '角色名稱已被使用' }, { status: 409 });
    }
    return Response.json({ id, name, sex: body.sex, hairStyle, hairColor });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: '建立角色失敗' }, { status: 500 });
  }
}
