import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const watchdog = await fs.readFile(path.join(root, 'ops', 'ro-stack', 'demo-watchdog.ps1'), 'utf8');
const runbook = await fs.readFile(path.join(root, 'docs', 'FRIENDS_ALPHA_RUNBOOK.md'), 'utf8');

assert.match(watchdog, /ValidateSet\('start','stop','health','pause','resume','run'\)/);
assert.match(watchdog, /\$maintenancePath=Join-Path \$runtime 'maintenance\.lock'/);
assert.match(watchdog, /\$roCheckIntervalSeconds=30/);
assert.match(watchdog, /\$roFailureThreshold=2/);
assert.match(watchdog, /\$roRecoveryCooldownSeconds=120/);
assert.match(watchdog, /& \$roStackScript health/);
assert.match(watchdog, /& \$roStackScript stop/);
assert.match(watchdog, /& \$roStackScript start/);
assert.match(watchdog, /if\(\$roHealthy\) \{/);
assert.match(watchdog, /rAthena recovery completed/);
assert.match(watchdog, /rAthena recovery failed/);
assert.match(watchdog, /RO_RECOVERY_PAUSED/);
assert.match(watchdog, /RO_RECOVERY_ACTIVE/);
assert.match(runbook, /rAthena 每 30 秒檢查一次/);
assert.match(runbook, /demo-watchdog\.ps1 pause/);
assert.match(runbook, /最後一個參數改為 `resume`/);

console.log('DEMO_WATCHDOG_RECOVERY_PASS');
