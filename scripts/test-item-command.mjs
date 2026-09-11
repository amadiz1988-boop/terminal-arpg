import { readFile } from 'node:fs/promises';

const origin = process.env.RO_DEMO_ORIGIN ?? 'http://127.0.0.1:8788';
const fixture = JSON.parse(await readFile('.local/ro-stack/multiplayer-test-v2-credentials.json', 'utf8'));
const login = await fetch(`${origin}/api/account`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'gate2_02', password: fixture.password, sex: 'F' }),
});
if (!login.ok) throw new Error(`item command login failed: ${login.status}`);
const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? '';
const api = async (path, options = {}) => {
  const response = await fetch(`${origin}${path}`, { ...options, headers: { cookie, ...options.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? `request failed: ${response.status}`);
  return body;
};

const waitForEquipment = async (itemId, binId, equipped) => {
  for (let elapsed = 150; elapsed <= 5000; elapsed += 150) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const events = await api('/api/events');
    const item = events.live?.inventory?.find((candidate) => candidate.itemId === itemId && candidate.binId === binId);
    if (item?.equipped === equipped) return elapsed;
  }
  throw new Error(`equipment state ${equipped} was not confirmed within 5000ms`);
};

const initialState = await api('/api/state');
const item = initialState.inventory.find((candidate) => candidate.equipped && candidate.equippable && Number.isInteger(candidate.binId));
if (!item) throw new Error('no live equipment is available for the command bridge test');
const firstAction = item.equipped ? 'unequip' : 'equip';
const restoredAction = item.equipped ? 'equip' : 'unequip';
const post = (action) => api('/api/item-action', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ action, binId: item.binId }),
});

await post(firstAction);
const firstConfirmedMs = await waitForEquipment(item.itemId, item.binId, !item.equipped);
await post(restoredAction);
const restoredMs = await waitForEquipment(item.itemId, item.binId, item.equipped);

console.log(JSON.stringify({
  result: 'ITEM_COMMAND_BRIDGE_PASS',
  itemId: item.itemId,
  binId: item.binId,
  firstAction,
  firstConfirmedMs,
  restoredAction,
  restoredMs,
  restored: true,
}, null, 2));
