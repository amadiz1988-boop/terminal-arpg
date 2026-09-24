import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const programs = [
 'ops/ro-stack/tests/test-production-promotion-governance.mjs',
 'scripts/test-web-full-production-superset.mjs',
 'scripts/test-world-map-supply-cutover.mjs',
 'scripts/test-world-map-teleport-presentation.mjs',
 'scripts/test-auto-farm-same-map-start.mjs',
 'scripts/test-ro-skill-tree-layouts.mjs',
 'scripts/test-ro-skill-icons.mjs',
 'scripts/test-server-ops-admin-control.mjs',
 'ops/ro-stack/tests/test-admin-quarantine-recovery.mjs',
 'scripts/test-active-web-entrypoint.mjs',
 'scripts/test-world-map-teleport.mjs',
 'scripts/test-supply-service-route-controller.mjs',
 'scripts/test-farm-map-supply-synthetic.mjs',
 'scripts/test-m1-attack-skill-profile.mjs',
 'scripts/test-web-runtime-asset-materialization.mjs',
];
let failures = 0;
for (const program of programs) {
 const result = spawnSync(process.execPath, [program], { cwd: root, encoding: 'utf8', timeout: 120000, windowsHide: true });
 console.log(JSON.stringify({ program, exitCode: result.status }));
 if (result.status !== 0) { failures++; console.error(result.stdout, result.stderr); }
}
console.log(JSON.stringify({ scope: 'OFFLINE_SOURCE_ONLY', programs: programs.length, failures }));
process.exitCode = failures ? 1 : 0;
