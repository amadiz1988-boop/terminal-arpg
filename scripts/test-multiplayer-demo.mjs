import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const origin = process.env.RO_DEMO_ORIGIN ?? 'http://127.0.0.1:8788';
const requestedCount = Math.max(
  3,
  Math.min(10, Number(process.env.RO_PLAYER_COUNT ?? 3)),
);
const fixtureFolder = join(process.cwd(), '.local', 'ro-stack');
const fixturePath = join(fixtureFolder, 'multiplayer-test-v2-credentials.json');
await mkdir(fixtureFolder, { recursive: true });
let fixture;
try {
  fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
} catch {
  fixture = { password: `Gate_${randomBytes(8).toString('hex')}` };
  await writeFile(fixturePath, JSON.stringify(fixture, null, 2));
}
const players = Array.from({ length: requestedCount }, (_, offset) => {
  const index = offset + 1,
    suffix = String(index).padStart(2, '0');
  return {
    username: `gate2_${suffix}`,
    password: fixture.password,
    sex: index % 2 ? 'M' : 'F',
    name: `GateTwoNovice${suffix}`,
  };
});

async function request(path, options = {}, session = null) {
  const response = await fetch(`${origin}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(session?.cookie ? { cookie: session.cookie } : {}),
      ...options.headers,
    },
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(`${path}: ${body.error ?? response.status}`);
  const setCookie = response.headers.get('set-cookie');
  if (session && setCookie) session.cookie = setCookie.split(';')[0];
  return body;
}

const sessions = await Promise.all(
  players.map(async (player) => {
    const session = { player, cookie: '' };
    await request(
      '/api/account',
      { method: 'POST', body: JSON.stringify(player) },
      session,
    );
    const preferences = await request('/api/preferences', {}, session);
    if (
      typeof preferences.preferences?.musicEnabled !== 'boolean' ||
      typeof preferences.preferences?.soundEnabled !== 'boolean'
    )
      throw new Error(`${player.username}: audio preferences are unavailable`);
    await request(
      '/api/preferences',
      {
        method: 'POST',
        body: JSON.stringify({
          musicEnabled: true,
          soundEnabled: true,
          musicVolume: 20,
          soundVolume: 35,
        }),
      },
      session,
    );
    let state = await request('/api/state', {}, session);
    if (state.needsCharacter) {
      await request(
        '/api/characters',
        {
          method: 'POST',
          body: JSON.stringify({ name: player.name, hair: 1, hairColor: 2 }),
        },
        session,
      );
    }
    await request(
      '/api/automation',
      { method: 'POST', body: JSON.stringify({ action: 'start' }) },
      session,
    );
    return session;
  }),
);

const deadline = Date.now() + 90_000;
let states = [];
do {
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  states = await Promise.all(
    sessions.map((session) => request('/api/state', {}, session)),
  );
  if (
    states.every(
      (state) =>
        state.running &&
        state.character?.online &&
        state.kills >= 1 &&
        state.visitedTargetMap &&
        state.lines.some((line) => line.includes('You attack Monster')) &&
        state.lines.some((line) => line.includes('You have gained')),
    )
  )
    break;
} while (Date.now() < deadline);

try {
  for (const [index, state] of states.entries()) {
    if (!state.running)
      throw new Error(`${players[index].username}: worker is not running`);
    if (!state.character?.online)
      throw new Error(`${players[index].username}: character is not online`);
    if (!state.lines.some((line) => line.includes('You attack Monster')))
      throw new Error(`${players[index].username}: no real attack event`);
    if (
      !state.lines.some((line) => line.includes('You have gained')) ||
      state.kills < 1
    )
      throw new Error(`${players[index].username}: no real kill and EXP event`);
    if (!state.visitedTargetMap)
      throw new Error(
        `${players[index].username}: character did not reach the shared field`,
      );
    if (
      state.character.sex !== players[index].sex ||
      !Number.isInteger(state.character.hair) ||
      !Number.isInteger(state.character.hairColor)
    )
      throw new Error(
        `${players[index].username}: paper doll appearance is not sourced from rAthena`,
      );
    const liveEquipped = state.inventory?.filter(
      (item) => item.category === 'equipment' && item.equipped,
    ) ?? [];
    if (
      state.equipment?.length !== liveEquipped.length ||
      !state.equipment.every((equipped) =>
        liveEquipped.some(
          (item) =>
            item.binId === equipped.binId && item.itemId === equipped.itemId,
        ),
      )
    )
      throw new Error(
        `${players[index].username}: paper doll equipment differs from live OpenKore inventory`,
      );
    if (
      !state.inventory?.some(
        (item) => item.itemId === 1201 && item.category === 'equipment',
      )
    )
      throw new Error(
        `${players[index].username}: categorized inventory is unavailable`,
      );
    if (
      !state.derived ||
      !Number.isFinite(state.derived.attack) ||
      !Number.isFinite(state.derived.hit) ||
      !Number.isFinite(state.derived.aspd)
    )
      throw new Error(
        `${players[index].username}: authoritative OpenKore derived status is unavailable`,
      );
    const events = await request('/api/events', {}, sessions[index]);
    if (
      !Number.isInteger(events.cursor) ||
      !events.lines.some((line) => line.includes('You attack Monster'))
    )
      throw new Error(
        `${players[index].username}: incremental combat event endpoint is unavailable`,
      );
  }
  if ((states[0].world.onlinePlayers ?? 0) < requestedCount)
    throw new Error(
      `Fewer than ${requestedCount} characters are online in the shared world`,
    );
  console.log(
    JSON.stringify(
      {
        result: 'MULTIPLAYER_DEMO_PASS',
        onlinePlayers: states[0].world.onlinePlayers,
        players: states.map((state) => ({
          account: state.account.username,
          character: state.character.name,
          baseLevel: state.character.baseLevel,
          jobLevel: state.character.jobLevel,
          map: state.character.map,
          kills: state.kills,
          itemKinds: state.items.length,
        })),
      },
      null,
      2,
    ),
  );
} finally {
  if (process.env.RO_STOP_EXTRA === '1' && sessions.length > 3)
    await Promise.all(
      sessions
        .slice(3)
        .map((session) =>
          request(
            '/api/automation',
            { method: 'POST', body: JSON.stringify({ action: 'stop' }) },
            session,
          ).catch(() => null),
        ),
    );
}
