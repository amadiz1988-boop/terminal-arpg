import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const autostart = read('../ops/ro-stack/player-web-autostart.ps1');
const service = read('../ops/ro-stack/player-web-service.ps1');
const tunnel = read('../ops/ro-stack/player-web-tunnel.ps1');
const watchdog = read('../ops/ro-stack/player-web-watchdog.ps1');

assert.match(autostart, /Terminal ARPG Player Web Self-Heal/);
assert.match(autostart, /New-ScheduledTaskTrigger -AtStartup/);
assert.match(autostart, /RepetitionInterval \(New-TimeSpan -Minutes 1\)/);
assert.match(autostart, /New-ScheduledTaskPrincipal -UserId 'SYSTEM'/);
assert.match(autostart, /MultipleInstances IgnoreNew/);
assert.match(autostart, /PLAYER_WEB_NODE_PATH/);
assert.match(autostart, /Invoke-Component 'player-web-service'/);
assert.match(autostart, /Invoke-Component 'player-web-tunnel'/);
assert.match(autostart, /Invoke-Component 'player-web-watchdog'/);

assert.match(service, /Global\\TerminalARPGPlayerWebServiceStart/);
assert.match(service, /127\.0\.0\.1:\$port\/api\/health/);
assert.match(service, /CommandLine -like '\*dashboard\.mjs\*'/);
assert.match(service, /RO_DASHBOARD_HOST = '127\.0\.0\.1'/);
assert.doesNotMatch(service, /internal\/health/);

assert.match(tunnel, /Global\\TerminalARPGPlayerWebTunnelStart/);
assert.match(tunnel, /mode -eq 'named'/);
assert.match(tunnel, /\/api\/health/);
assert.match(tunnel, /PLAYER_WEB_TUNNEL_DEGRADED/);
assert.match(tunnel, /CommandLine -like "\*\$\(\$state\.tunnelId\)\*"/);

assert.match(watchdog, /\$failureThreshold = 4/);
assert.match(watchdog, /Start-Sleep -Seconds 15/);
assert.match(watchdog, /PLAYER_WEB_SERVICE_OFFLINE/);
assert.match(watchdog, /PLAYER_WEB_TUNNEL_OFFLINE/);
assert.match(watchdog, /health \*>\&1/);
assert.match(watchdog, /recovered without restart/);

for (const file of [autostart, service, tunnel, watchdog]) {
  assert.doesNotMatch(file, /rathena|openkore|mariadb|login-server|char-server|map-server/i);
}

console.log('PLAYER_WEB_AUTOSTART_PASS');
