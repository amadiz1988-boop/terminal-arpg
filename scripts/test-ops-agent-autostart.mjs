import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const autostart = readFileSync(
  new URL('../ops/ro-stack/ops-agent-autostart.ps1', import.meta.url),
  'utf8',
);
const service = readFileSync(
  new URL('../ops/ro-stack/ops-agent-service.ps1', import.meta.url),
  'utf8',
);
const tunnel = readFileSync(
  new URL('../ops/ro-stack/ops-agent-tunnel.ps1', import.meta.url),
  'utf8',
);
const watchdog = readFileSync(
  new URL('../ops/ro-stack/ops-agent-watchdog.ps1', import.meta.url),
  'utf8',
);

assert.match(autostart, /New-ScheduledTaskTrigger -AtStartup/);
assert.match(autostart, /RepetitionInterval \(New-TimeSpan -Minutes 1\)/);
assert.match(autostart, /New-ScheduledTaskPrincipal -UserId 'SYSTEM'/);
assert.match(autostart, /MultipleInstances IgnoreNew/);
assert.match(autostart, /Length -ge 1MB/);
assert.match(autostart, /Invoke-Component 'ops-agent'/);
assert.match(autostart, /Invoke-Component 'ops-agent-tunnel'/);
assert.match(autostart, /Invoke-Component 'ops-agent-watchdog'/);
assert.doesNotMatch(autostart, /rathena|openkore|dashboard-service|mariadb/i);
assert.match(service, /Join-Path \$effectiveRuntimeRoot 'ops-agent'/);
assert.match(watchdog, /Join-Path \$runtimeRoot 'ops-agent-watchdog'/);
assert.match(tunnel, /OPS_AGENT_CLOUDFLARED_PATH/);

console.log('OPS_AGENT_AUTOSTART_PASS');
