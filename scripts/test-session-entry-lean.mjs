import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dashboard = await readFile('ops/ro-stack/dashboard.mjs', 'utf8');
const app = await readFile('ops/ro-stack/dashboard/app.js', 'utf8');

assert.match(dashboard, /const entryView = sessionView === 'entry';/);
assert.ok(dashboard.includes('...(entryView ? {} : { equipment })'));
assert.match(dashboard, /combatSse: entryView \? null/);
assert.match(app, /api\('\/api\/session\?view=entry'/);
assert.match(app, /async function hydrateCharacterSelectionEquipment\(charId\)/);
assert.match(app, /api\('\/api\/session\?view=equipment'/);

console.log('SESSION_ENTRY_LEAN_PASS checks=6');
