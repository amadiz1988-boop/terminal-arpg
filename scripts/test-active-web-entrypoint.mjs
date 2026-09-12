import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const vite = readFileSync('vite.config.ts', 'utf8');
const readme = readFileSync('README.md', 'utf8');
const agents = readFileSync('AGENTS.md', 'utf8');
const architecture = readFileSync('docs/ARCHITECTURE.md', 'utf8');
const currentStatus = readFileSync('docs/CURRENT_STATUS.md', 'utf8');
const todo = readFileSync('docs/TODO.md', 'utf8');
const legacyQa = readFileSync('scripts/ui-qa.mjs', 'utf8');

assert.match(pkg.scripts.dev, /dashboard-service\.ps1 start/);
assert.match(pkg.scripts.start, /dashboard-service\.ps1 start/);
for (const command of ['build', 'qa:ui', 'test:release'])
  assert.match(pkg.scripts[command], /legacy-web-disabled\.mjs/);
assert(!existsSync('.openai/hosting.json'));
assert(existsSync('archive/legacy-vinext-demo/hosting.json'));
assert.match(vite, /ALLOW_ARCHIVED_VINEXT_WEB/);
assert.match(readme, /127\.0\.0\.1:8788/);
assert.doesNotMatch(readme, /http:\/\/localhost:3000/);
assert.match(agents, /8788 Dashboard 為唯一玩家入口/);
assert.match(architecture, /rAthena 與 MariaDB 是角色、物品、任務與世界狀態的權威來源/);
assert.match(architecture, /封存的 Vinext／D1 原型/);
assert.match(currentStatus, /recovery\/2026-09-13-working-tree/);
assert.match(todo, /Dashboard 發布閘門/);
assert.doesNotMatch(legacyQa, /127\.0\.0\.1:3000/);

console.log('ACTIVE_WEB_ENTRYPOINT_PASS current=http://127.0.0.1:8788/');
