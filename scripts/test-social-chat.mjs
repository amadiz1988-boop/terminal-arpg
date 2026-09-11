import { readFile } from 'node:fs/promises';

const origin = process.env.RO_DEMO_ORIGIN ?? 'http://127.0.0.1:8788';
const fixture = JSON.parse(
  await readFile('.local/ro-stack/multiplayer-test-v2-credentials.json', 'utf8'),
);
const players = [
  { username: 'gate2_01', name: 'GateTwoNovice01' },
  { username: 'gate2_02', name: 'GateTwoNovice02' },
];

async function request(path, options = {}, session = null, expected = 200) {
  const response = await fetch(`${origin}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(session?.cookie ? { cookie: session.cookie } : {}),
      ...options.headers,
    },
  });
  const body = await response.json();
  const cookie = response.headers.get('set-cookie');
  if (session && cookie) session.cookie = cookie.split(';')[0];
  if (response.status !== expected)
    throw new Error(
      `${path}: expected ${expected}, got ${response.status} ${body.error ?? ''}`,
    );
  return body;
}

const sessions = await Promise.all(
  players.map(async (player) => {
    const session = { cookie: '', player };
    await request(
      '/api/account',
      {
        method: 'POST',
        body: JSON.stringify({
          username: player.username,
          password: fixture.password,
          sex: 'M',
        }),
      },
      session,
    );
    return session;
  }),
);

for (const session of sessions)
  await request(
    '/api/automation',
    { method: 'POST', body: JSON.stringify({ action: 'stop' }) },
    session,
  );
await new Promise((resolve) => setTimeout(resolve, 800));
for (const session of sessions)
  await request(
    '/api/automation',
    { method: 'POST', body: JSON.stringify({ action: 'start' }) },
    session,
  );
const restartedAt = Date.now();

const onlineDeadline = Date.now() + 45_000;
while (Date.now() < onlineDeadline) {
  const states = await Promise.all(
    sessions.map((session) => request('/api/state', {}, session)),
  );
  if (
    states.every(
      (state) =>
        state.running &&
        state.character?.online &&
        state.derived?.updatedAt >= restartedAt &&
        state.derived?.map === 'prt_fild08',
    )
  )
    break;
  await new Promise((resolve) => setTimeout(resolve, 500));
}
const finalStates = await Promise.all(
  sessions.map((session) => request('/api/state', {}, session)),
);
if (!finalStates.every((state) => state.character?.online))
  throw new Error('social test characters did not enter the game');

const baselines = await Promise.all(
  sessions.map((session) => request('/api/social', {}, session)),
);
const message = `你好 RO ${Date.now()}`;
await request(
  '/api/social',
  {
    method: 'POST',
    body: JSON.stringify({ action: 'chat', message }),
  },
  sessions[0],
  202,
);

async function waitFor(session, startCursor, predicate, label) {
  let cursor = startCursor;
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    const result = await request(`/api/social?cursor=${cursor}`, {}, session);
    cursor = result.cursor;
    const match = result.events.find(predicate);
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 180));
  }
  throw new Error(`timed out waiting for ${label}`);
}

const speakerChat = await waitFor(
  sessions[0],
  baselines[0].cursor,
  (entry) =>
    entry.type === 'chat' &&
    entry.sender === players[0].name &&
    entry.message === message,
  'speaker server echo',
);

await new Promise((resolve) => setTimeout(resolve, 850));
const privateBaselines = await Promise.all(
  sessions.map((session) => request('/api/social', {}, session)),
);
const privateMessage = `密語實測 ${Date.now()}`;
await request(
  '/api/social',
  {
    method: 'POST',
    body: JSON.stringify({
      action: 'chat',
      channel: 'private',
      target: players[1].name,
      message: privateMessage,
    }),
  },
  sessions[0],
  202,
);
const [sentPrivate, receivedPrivate] = await Promise.all([
  waitFor(
    sessions[0],
    privateBaselines[0].cursor,
    (entry) =>
      entry.type === 'chat' &&
      entry.channel === 'private' &&
      entry.target === players[1].name &&
      entry.message === privateMessage,
    'sent private message echo',
  ),
  waitFor(
    sessions[1],
    privateBaselines[1].cursor,
    (entry) =>
      entry.type === 'chat' &&
      entry.channel === 'private' &&
      entry.sender === players[0].name &&
      entry.message === privateMessage,
    'received private message',
  ),
]);

await new Promise((resolve) => setTimeout(resolve, 850));
const mapBaselines = await Promise.all(
  sessions.map((session) => request('/api/social', {}, session)),
);
const mapMessage = `地圖頻道實測 ${Date.now()}`;
await request(
  '/api/social',
  {
    method: 'POST',
    body: JSON.stringify({ action: 'chat', channel: 'map', message: mapMessage }),
  },
  sessions[0],
  202,
);
const mapChannelEcho = await waitFor(
  sessions[0],
  mapBaselines[0].cursor,
  (entry) =>
    entry.type === 'chat' &&
    entry.channel === 'map' &&
    entry.sender === players[0].name &&
    entry.message === mapMessage,
  'rAthena map channel echo',
);
const customChannelEchoes = [mapChannelEcho];
for (const channel of ['global', 'trade', 'support']) {
  const baseline = await request('/api/social', {}, sessions[0]);
  const channelMessage = `${channel} 頻道實測 ${Date.now()}`;
  await request(
    '/api/social',
    {
      method: 'POST',
      body: JSON.stringify({
        action: 'chat',
        channel,
        message: channelMessage,
      }),
    },
    sessions[0],
    202,
  );
  customChannelEchoes.push(
    await waitFor(
      sessions[0],
      baseline.cursor,
      (entry) =>
        entry.type === 'chat' &&
        entry.channel === channel &&
        entry.sender === players[0].name &&
        entry.message === channelMessage,
      `rAthena ${channel} channel echo`,
    ),
  );
}
const unavailableChannelErrors = [];
for (const channel of ['party', 'guild', 'clan', 'ally']) {
  const baseline = await request('/api/social', {}, sessions[0]);
  await request(
    '/api/social',
    {
      method: 'POST',
      body: JSON.stringify({
        action: 'chat',
        channel,
        message: `${channel} 無成員資格測試`,
      }),
    },
    sessions[0],
    202,
  );
  unavailableChannelErrors.push(
    await waitFor(
      sessions[0],
      baseline.cursor,
      (entry) => entry.type === 'error' && entry.channel === channel,
      `${channel} membership rejection`,
    ),
  );
}

let skillState = await request('/api/state', {}, sessions[0]);
while ((skillState.derived?.basicSkillLevel ?? 0) < 2) {
  await request(
    '/api/skill-point',
    { method: 'POST', body: JSON.stringify({ skillId: 1 }) },
    sessions[0],
    202,
  );
  const expected = (skillState.derived?.basicSkillLevel ?? 0) + 1;
  const deadline = Date.now() + 8_000;
  do {
    await new Promise((resolve) => setTimeout(resolve, 180));
    skillState = await request('/api/state', {}, sessions[0]);
    if ((skillState.derived?.basicSkillLevel ?? 0) >= expected) break;
  } while (Date.now() < deadline);
  if ((skillState.derived?.basicSkillLevel ?? 0) < expected)
    throw new Error('basic skill point was not confirmed by rAthena');
}

await new Promise((resolve) => setTimeout(resolve, 850));
const emotionBaselines = await Promise.all(
  sessions.map((session) => request('/api/social', {}, session)),
);
await request(
  '/api/social',
  {
    method: 'POST',
    body: JSON.stringify({ action: 'emotion', emotionId: 3 }),
  },
  sessions[0],
  202,
);
const speakerEmotion = await waitFor(
  sessions[0],
  emotionBaselines[0].cursor,
  (entry) =>
    entry.type === 'emotion' &&
    entry.sender === players[0].name &&
    entry.message === '*Heart*',
  'speaker RO emotion echo',
);

await request(
  '/api/social',
  {
    method: 'POST',
    body: JSON.stringify({ action: '@item', message: '@item 512 999999' }),
  },
  sessions[0],
  400,
);
await request(
  '/api/social',
  {
    method: 'POST',
    body: JSON.stringify({ action: 'chat', message: '第一行\n@item 512 999999' }),
  },
  sessions[0],
  400,
);
await request(
  '/api/social',
  {
    method: 'POST',
    body: JSON.stringify({ action: 'emotion', emotionId: 999 }),
  },
  sessions[0],
  400,
);

console.log(
  JSON.stringify(
    {
      result: 'SOCIAL_CHAT_PASS',
      speakerEcho: speakerChat,
      sentPrivate,
      receivedPrivate,
      mapChannelEcho,
      customChannelEchoes,
      unavailableChannelErrors,
      speakerEmotion,
      basicSkillLevel: skillState.derived.basicSkillLevel,
      deliveryScope: 'rAthena AREA_CHAT_WOC',
      security: {
        rawActionRejected: true,
        multilineRejected: true,
        unknownEmotionRejected: true,
      },
    },
    null,
    2,
  ),
);
process.exit(0);
