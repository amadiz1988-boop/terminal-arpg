// Exact, single-use admission for the 2026-09-26 crashed-map incident.
import fs from 'node:fs';
import path from 'node:path';
import { digest, readJson, boundedPath } from './legacy-production-baseline.mjs';

export const INCIDENT = Object.freeze({
  previousSha: '668bb9db42dd4bb9cf7651c5c1e40c95531ada35',
  candidateSha: 'f77df6251c1b5793a85ae2b313228f1e36a609a9',
  reason: 'M1_DEATH_RETURN_SESSION_LIFETIME_RECOVERY_V1',
  mapPid: 27496,
  dump: '.local/ro-stack/crash-capture/canonical-map-27496-20260926-093744/map-server.exe_260926_173842.dmp',
  dumpSha256: 'C43EAD8EE4954FDE606DD31F5D24676FF4C8FD73EBE94A74EA0193C91B5D9FCF',
  procdump: 'C:\\Users\\Administrator\\AppData\\Local\\Microsoft\\Sysinternals\\ProcDump-12.01\\procdump64.exe',
  procdumpSha256: 'D1FC99AE304BD1D2BF28ABEB62531DA959E2431916194981B88C958FD713A8E6',
  candidateConfigSha256: '4A7392E038F4394E5B5CE7F5EB6F3CFD4C1E835D46EEC582DC9EFA608AE6FCF2',
  productionConfigSha256: '4DA600DCF955D3510EE1289C0F28D257D1D5C1BAB03D90B9E28DCEC3789E73A0',
});
const need = (condition, code) => { if (!condition) throw Error(code); };
const equal = (a, b) => String(a ?? '').toUpperCase() === String(b ?? '').toUpperCase();

export function incidentRuntimeShape(runtime, tracked, receipt) {
  const rows = tracked?.processes ?? [];
  const entry = name => rows.find(row => row.name === name);
  const binary = name => receipt?.artifacts?.find(row => row.path?.endsWith(`/${name}-server.exe`));
  return runtime?.pass === false && runtime?.counts?.login === 1 &&
    runtime?.counts?.char === 1 && runtime?.counts?.map === 0 &&
    runtime?.pids?.login > 0 && runtime?.pids?.char > 0 &&
    !runtime?.pids?.map && runtime?.dashboard_pid > 0 && runtime?.database_pid > 0 &&
    runtime?.openkore_runtime_count === 0 &&
    entry('login')?.id === runtime.pids.login && entry('char')?.id === runtime.pids.char &&
    entry('map')?.id === INCIDENT.mapPid &&
    ['login', 'char', 'map'].every(name => !!binary(name));
}

export function validateIncidentRecovery({ root, runtime, receipt, leaseId,
  previousSha, candidateSha, reason, expectedConfigSha, candidateConfigFile }) {
  need(previousSha === INCIDENT.previousSha && candidateSha === INCIDENT.candidateSha &&
    reason === INCIDENT.reason && equal(expectedConfigSha, INCIDENT.candidateConfigSha256),
  'INCIDENT_SCOPE_MISMATCH');
  const local = boundedPath(root, '.local/ro-stack');
  const tracked = readJson(path.join(local, 'state.json'));
  need(incidentRuntimeShape(runtime, tracked, receipt), 'INCIDENT_RUNTIME_IDENTITY_CHANGED');
  for (const name of ['login', 'char', 'map']) {
    const artifact = receipt.artifacts.find(row => row.path.endsWith(`/${name}-server.exe`));
    const live = boundedPath(root, artifact.path);
    need(equal(digest(live), artifact.sha256), 'INCIDENT_BINARY_PREIMAGE_CHANGED');
    if (name !== 'map') {
      const actualPath = runtime.processes?.[name]?.executable_path;
      need(actualPath && path.resolve(actualPath).toLowerCase() === live.toLowerCase(),
        'INCIDENT_PROCESS_PATH_CHANGED');
    }
  }
  const dump = boundedPath(root, INCIDENT.dump);
  need(equal(digest(dump), INCIDENT.dumpSha256), 'INCIDENT_DUMP_CHANGED');
  const sidecar = readJson(path.join(local, 'procdump-attachment-state.json'));
  need(sidecar.procdumpAttachStatus === 'BLOCKED' && sidecar.procdumpAttachError === 'MAP_COUNT' &&
    sidecar.previous?.mapPid === INCIDENT.mapPid &&
    sidecar.previous?.procdumpAttachedPid === INCIDENT.mapPid &&
    sidecar.previous?.procdumpAttachStatus === 'ATTACHED' &&
    equal(digest(INCIDENT.procdump), INCIDENT.procdumpSha256),
  'INCIDENT_PROCDUMP_PRECONDITION_CHANGED');
  const migrationFile = path.join(local,
    `schema-migration-${leaseId}-013-persistent-agent-runtime-phase-width.json`);
  const migration = readJson(migrationFile);
  need(migration.lease_id === leaseId && migration.dry_run === false &&
    migration.after?.type === 'varchar(64)' &&
    migration.verification?.rows_preserved === true &&
    migration.verification?.columns_preserved === true,
  'INCIDENT_DB_MIGRATION_NOT_ADMITTED');
  const productionConfig = path.join(local, 'rathena/conf/persistent_agent_commands.json');
  need(equal(digest(productionConfig), INCIDENT.productionConfigSha256) &&
    equal(digest(candidateConfigFile), expectedConfigSha),
  'INCIDENT_COMMAND_CONTRACT_CHANGED');
  need(JSON.stringify(readJson(productionConfig)) === JSON.stringify(readJson(candidateConfigFile)),
    'INCIDENT_COMMAND_CONTRACT_SEMANTICS_CHANGED');
  return { incident: true, old_map_pid: INCIDENT.mapPid,
    incident_dump_sha256: INCIDENT.dumpSha256, migration_receipt_sha256: digest(migrationFile),
    candidate_config_sha256: expectedConfigSha,
    production_config_sha256: INCIDENT.productionConfigSha256,
    config_semantics_equal: true, procdump_ready: true };
}
