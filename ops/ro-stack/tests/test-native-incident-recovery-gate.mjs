import assert from 'node:assert/strict';
import { INCIDENT, incidentRuntimeShape, validateIncidentRecovery }
  from '../native-incident-recovery-gate.mjs';

const tracked = { processes: [
  { name: 'login', id: 10 }, { name: 'char', id: 20 },
  { name: 'map', id: INCIDENT.mapPid },
] };
const runtime = { pass: false, counts: { login: 1, char: 1, map: 0 },
  pids: { login: 10, char: 20 }, dashboard_pid: 30, database_pid: 40,
  openkore_runtime_count: 0 };
const receipt = { artifacts: ['login', 'char', 'map'].map(name =>
  ({ path: `.local/ro-stack/rathena/${name}-server.exe`, sha256: 'A'.repeat(64) })) };
let count = 0;
const pass = label => console.log(`PASS ${++count} ${label}`);

assert.equal(incidentRuntimeShape(runtime, tracked, receipt), true);
pass('exact partial-runtime shape admits crashed map without inventing a resident PID');
for (const altered of [
  { ...runtime, pass: true },
  { ...runtime, counts: { ...runtime.counts, map: 1 } },
  { ...runtime, counts: { ...runtime.counts, login: 0 } },
  { ...runtime, openkore_runtime_count: 1 },
  { ...runtime, pids: { ...runtime.pids, map: 99 } },
]) assert.equal(incidentRuntimeShape(altered, tracked, receipt), false);
assert.equal(incidentRuntimeShape(runtime, { processes: tracked.processes.slice(0, 2) }, receipt), false);
assert.equal(incidentRuntimeShape(runtime, tracked, { artifacts: receipt.artifacts.slice(0, 2) }), false);
pass('extra map, missing dependency, OpenKore, stale track and missing binary fail closed');

assert.throws(() => validateIncidentRecovery({ root: 'unused', runtime, receipt,
  leaseId: 'unused', previousSha: INCIDENT.previousSha,
  candidateSha: 'other', reason: INCIDENT.reason,
  expectedConfigSha: INCIDENT.candidateConfigSha256 }), /INCIDENT_SCOPE_MISMATCH/);
assert.throws(() => validateIncidentRecovery({ root: 'unused', runtime, receipt,
  leaseId: 'unused', previousSha: INCIDENT.previousSha,
  candidateSha: INCIDENT.candidateSha, reason: 'other',
  expectedConfigSha: INCIDENT.candidateConfigSha256 }), /INCIDENT_SCOPE_MISMATCH/);
pass('candidate and reason cannot be widened to a generic incident bypass');
console.log(`NATIVE_INCIDENT_GATE_TESTS=${count}`);
