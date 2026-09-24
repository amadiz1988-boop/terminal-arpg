import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveJobName, JOB_MAPPING_SOURCE } from '../ops/ro-stack/job-name-resolver.mjs';

const dashboard = readFileSync('ops/ro-stack/dashboard.mjs', 'utf8');
const admin = readFileSync('ops/ro-stack/dashboard/admin/server-ops.js', 'utf8');
const matrix = readFileSync('docs/CHARACTER_ADMIN_FIELD_MATRIX.md', 'utf8');

assert.equal(resolveJobName(0), '初心者');
assert.equal(resolveJobName(1), '劍士');
assert.equal(resolveJobName(6), '盜賊');
assert.equal(resolveJobName(7), '騎士');
assert.equal(resolveJobName(12), '刺客');
assert.equal(resolveJobName(14), '十字軍');
assert.equal(resolveJobName(17), '流氓');
assert.equal(resolveJobName(999), null);
assert.equal(JOB_MAPPING_SOURCE, 'public/ro/data/skill-trees.json:jobs');

for (const eventType of ['MAP_CHANGED', 'MONSTER_TARGET', 'MONSTER_ATTACK', 'MONSTER_HIT', 'MONSTER_KILL', 'LOOT_ACQUIRED', 'PLAYER_DEATH'])
  assert.match(dashboard, new RegExp(`'${eventType}'`));
assert.match(dashboard, /persistent_life_event/);
assert.match(dashboard, /activitySourceStatus/);
assert.match(dashboard, /adminFreshness/);
assert.doesNotMatch(dashboard.slice(dashboard.indexOf('async function listAdminCharacters'), dashboard.indexOf('// --- ADMIN character agent controls')), /status\.json|worker\.running/);
assert.match(admin, /c\.freshness === 'STALE'/);

for (const marker of ['data-filter="job"', 'data-filter="freshness"', 'data-filter="farmSource"', 'data-filter="activity"', 'data-clear-character-filters', "'lastMovement'", "'lastCombat'", "'updatedAt'"])
  assert.match(admin, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
for (const translated of ['資料過期', '目前離線', '自動掛機', '最近恢復', '角色來源', 'PA 事件紀錄'])
  assert.match(admin, new RegExp(translated));

for (const field of ['角色 ID', '職業', 'Last Movement', 'Last Combat', 'Last Recovery', 'Quest summary', 'Inventory state', 'Equipment state'])
  assert.match(matrix, new RegExp(field));

console.log(JSON.stringify({ result: 'CHARACTER_ADMIN_DATA_SOURCE_TEST_PASS', jobMappingSource: JOB_MAPPING_SOURCE }));
