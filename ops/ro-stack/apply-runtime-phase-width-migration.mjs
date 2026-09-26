#!/usr/bin/env node
// Lease-bound, forward-only admission for the reviewed 013 PA projection width.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inspectSchema } from './apply-live-status-inventory-migration.mjs';
import { windowsPowerShellEnv } from './legacy-production-baseline.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const production = 'c:\\users\\administrator\\ghost-island-production\\ro-stack';
export const MIGRATION = Object.freeze({
  id: '013-persistent-agent-runtime-phase-width',
  path: 'ops/ro-stack/sql/013-persistent-agent-runtime-phase-width.sql',
  sourceCheckpoint: '7e5a7fc2fdf719455bb3efaa51fea148fb64795e',
});
const STATEMENT = 'ALTER TABLE `persistent_agent_live_status` MODIFY COLUMN `runtime_phase` ' +
  "VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'IDLE';";
const need = (condition, code) => { if (!condition) throw Error(code); };
const sha = value => createHash('sha256').update(value).digest('hex').toUpperCase();
const git = (...args) => {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
  need(result.status === 0, `GIT_FAILED:${args[0]}`);
  return result.stdout.trim();
};

export function parseMigration(text) {
  const statement = String(text).split(/\r?\n/).filter(line => !/^\s*--/.test(line))
    .join(' ').replace(/\s+/g, ' ').trim();
  need(statement === STATEMENT, 'MIGRATION_STATEMENT_NOT_APPROVED');
  return statement;
}

export async function inspectPhase(db) {
  const line = String(await db.queryText(
    "SELECT COLUMN_TYPE,IS_NULLABLE,COALESCE(COLUMN_DEFAULT,'<NULL>'),CHARACTER_SET_NAME,COLLATION_NAME " +
    "FROM information_schema.columns WHERE table_schema=DATABASE() " +
    "AND table_name='persistent_agent_live_status' AND column_name='runtime_phase';")).trim();
  const [type, nullable, defaultValue, charset, collation] = line.split('\t');
  need(!!collation, 'RUNTIME_PHASE_COLUMN_MISSING');
  const schema = await inspectSchema(db);
  const rowsHash = sha(String(await db.queryText('SELECT * FROM persistent_agent_live_status ORDER BY char_id;')));
  return { type: type.toLowerCase(), nullable, defaultValue, charset, collation,
    columns: schema.columns, rowCount: schema.rowCount, rowsHash };
}

function contract(phase, width) {
  return phase.type === `varchar(${width})` && phase.nullable === 'NO' &&
    phase.defaultValue === "'IDLE'" && phase.charset === 'utf8mb4' &&
    phase.collation === 'utf8mb4_unicode_ci';
}

export function planMigration(before, receiptExists = false) {
  if (contract(before, 24)) {
    need(!receiptExists, 'MIGRATION_RECEIPT_SCHEMA_CONFLICT');
    return { action: 'APPLY', width_before: 24, width_after: 64 };
  }
  if (contract(before, 64)) {
    need(receiptExists, 'UNRECORDED_SCHEMA_CHANGE');
    return { action: 'NOOP_RECORDED', width_before: 64, width_after: 64 };
  }
  throw Error('RUNTIME_PHASE_PRECONDITION_MISMATCH');
}

export function verifyMigration(before, after) {
  need(contract(after, 64), 'RUNTIME_PHASE_POSTCONDITION_MISMATCH');
  need(before.rowCount === after.rowCount && before.rowsHash === after.rowsHash,
    'EXISTING_LIVE_STATUS_ROWS_CHANGED');
  const withoutPhase = state => state.columns.filter(c => c.name !== 'runtime_phase');
  need(JSON.stringify(withoutPhase(before)) === JSON.stringify(withoutPhase(after)),
    'OTHER_LIVE_STATUS_COLUMNS_CHANGED');
  return { rows_preserved: true, columns_preserved: true,
    rows_before: before.rowCount, rows_after: after.rowCount, rows_sha256: after.rowsHash };
}

export async function runMigration({ db, sqlText, execute, receiptExists = false }) {
  const statement = parseMigration(sqlText);
  const before = await inspectPhase(db);
  const plan = planMigration(before, receiptExists);
  if (!execute) return { dry_run: true, statement_sha256: sha(statement), plan, before };
  if (plan.action === 'APPLY') await db.queryText(statement);
  const after = await inspectPhase(db);
  return { dry_run: false, statement_sha256: sha(statement), plan, before, after,
    verification: verifyMigration(before, after) };
}

function assertIncidentRuntime(productionRoot) {
  const script = path.join(root, 'ops/ro-stack/native-runtime-adapter.ps1');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass',
    '-File', script, '-Action', 'snapshot', '-ProductionRoot', productionRoot],
  { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 30000, env: windowsPowerShellEnv() });
  need(result.status === 0, 'RUNTIME_SNAPSHOT_FAILED');
  const snapshot = JSON.parse(result.stdout.trim());
  need(snapshot.counts?.login === 1 && snapshot.counts?.char === 1 &&
    snapshot.counts?.map === 0 && snapshot.dashboard_pid > 0 &&
    snapshot.database_pid > 0 && snapshot.openkore_runtime_count === 0,
  'INCIDENT_RUNTIME_PRECONDITION_CHANGED');
  return { counts: snapshot.counts, dashboard_pid: snapshot.dashboard_pid,
    database_pid: snapshot.database_pid, openkore_runtime_count: 0 };
}

async function main() {
  const argv = process.argv.slice(2);
  const args = Object.fromEntries(argv.flatMap((item, i) => item.startsWith('--') ?
    [[item.slice(2), argv[i + 1]]] : []));
  const productionRoot = fs.realpathSync(args['production-root'] || '.');
  need(productionRoot.toLowerCase() === production, 'CANONICAL_PRODUCTION_ROOT_REQUIRED');
  need(['dry-run', 'apply'].includes(args.action) && args.owner && args.lease, 'ARGUMENTS_REQUIRED');
  need(args.action === 'dry-run' || args.execute === 'true', 'EXPLICIT_EXECUTE_REQUIRED');
  need(git('status', '--porcelain=v1', '--untracked-files=all') === '', 'GOVERNANCE_SOURCE_DIRTY');
  const governanceSha = git('rev-parse', 'HEAD');
  const mainTip = git('ls-remote', '--exit-code', 'origin', 'refs/heads/main').split(/\s/)[0];
  git('fetch', '--no-tags', '--no-write-fetch-head', 'origin', 'refs/heads/main');
  git('merge-base', '--is-ancestor', governanceSha, mainTip);
  need(git('rev-parse', `${governanceSha}:${MIGRATION.path}`) ===
    git('rev-parse', `${MIGRATION.sourceCheckpoint}:${MIGRATION.path}`),
  'MIGRATION_CHECKPOINT_BLOB_MISMATCH');
  const local = path.join(productionRoot, '.local/ro-stack');
  const lease = JSON.parse(fs.readFileSync(path.join(local, 'production-deployment-lease/lease.json'), 'utf8'));
  const pending = JSON.parse(fs.readFileSync(path.join(local, 'first-github-first-promotion.pending.json'), 'utf8'));
  need(lease.status === 'ACTIVE' && lease.lease_id === args.lease &&
    lease.owner_task_id === args.owner && pending.lease_id === args.lease &&
    pending.owner_task_id === args.owner, 'ACTIVE_LEASE_IDENTITY_MISMATCH');
  const runtime = assertIncidentRuntime(productionRoot);
  const receiptFile = path.join(local, `schema-migration-${args.lease}-${MIGRATION.id}.json`);
  const receiptExists = fs.existsSync(receiptFile);
  const sqlText = git('show', `${governanceSha}:${MIGRATION.path}`);
  const secrets = JSON.parse(fs.readFileSync(path.join(local, 'secrets.json'), 'utf8'));
  const { createDashboardDatabase } = await import('./dashboard-db.mjs');
  const db = createDashboardDatabase({ host: '127.0.0.1', port: 3307,
    user: 'rathena_local', password: secrets.databasePassword, database: 'ragnarok', poolSize: 1 });
  try {
    const result = await runMigration({ db, sqlText, execute: args.action === 'apply', receiptExists });
    const receipt = { schema_version: 'runtime-phase-width-migration-v1', migration: MIGRATION.id,
      migration_path: MIGRATION.path, source_checkpoint: MIGRATION.sourceCheckpoint,
      governance_sha: governanceSha, lease_id: args.lease, lease_owner: args.owner,
      rollback_policy: 'FORWARD_ONLY_NO_SHRINK', runtime, ...result,
      measured_at: new Date().toISOString() };
    if (args.action === 'apply' && !receiptExists) {
      fs.writeFileSync(receiptFile, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
      receipt.receipt_path = receiptFile;
      receipt.receipt_sha256 = sha(fs.readFileSync(receiptFile));
    }
    console.log(JSON.stringify(receipt, null, 2));
  } finally { await db.close(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch(error => { console.log(JSON.stringify({ result: 'FAIL', error: error.message })); process.exitCode = 1; });
