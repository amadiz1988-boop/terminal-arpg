import { getDatabase } from '@/db';
import { assertSameOrigin, requireAccount } from '@/game/server/auth';
import { reconcileWorld } from '@/game/server/world';
import type { RoWorldState } from '@/game/ro/world/simulation';

type CharacterRow = {
  id: string;
  name: string;
  sex: string;
  hairStyle: number;
  hairColor: number;
  worldJson: string;
  automationRunning: number;
  simulatedAt: number;
};

async function ownedCharacter(request: Request, id: string) {
  const account = await requireAccount(request);
  return getDatabase()
    .prepare(
      `SELECT id, name, sex, hair_style AS hairStyle, hair_color AS hairColor,
              world_json AS worldJson,
              automation_running AS automationRunning,
              simulated_at AS simulatedAt
       FROM characters WHERE id = ? AND account_id = ?`,
    )
    .bind(id, account.id)
    .first<CharacterRow>();
}

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('characterId') ?? '';
    const character = await ownedCharacter(request, id);
    if (!character) return Response.json({ error: '找不到角色' }, { status: 404 });
    const now = Date.now();
    let world = JSON.parse(character.worldJson) as RoWorldState;
    if (character.automationRunning && now > character.simulatedAt)
      world = await reconcileWorld(request, world, now - character.simulatedAt);
    await getDatabase()
      .prepare('UPDATE characters SET world_json = ?, simulated_at = ? WHERE id = ?')
      .bind(JSON.stringify(world), now, character.id)
      .run();
    return Response.json({
      character: {
        id: character.id,
        name: character.name,
        sex: character.sex,
        hairStyle: character.hairStyle,
        hairColor: character.hairColor,
      },
      automationRunning: Boolean(character.automationRunning),
      world,
      simulatedAt: now,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: '讀取角色狀態失敗' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = (await request.json()) as { characterId?: string; running?: boolean };
    const character = await ownedCharacter(request, body.characterId ?? '');
    if (!character) return Response.json({ error: '找不到角色' }, { status: 404 });
    const now = Date.now();
    let world = JSON.parse(character.worldJson) as RoWorldState;
    if (character.automationRunning && now > character.simulatedAt)
      world = await reconcileWorld(request, world, now - character.simulatedAt);
    await getDatabase()
      .prepare(
        `UPDATE characters
         SET world_json = ?, automation_running = ?, simulated_at = ?
         WHERE id = ?`,
      )
      .bind(JSON.stringify(world), body.running ? 1 : 0, now, character.id)
      .run();
    return Response.json({ automationRunning: Boolean(body.running), world, simulatedAt: now });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: '更新掛機狀態失敗' }, { status: 500 });
  }
}
