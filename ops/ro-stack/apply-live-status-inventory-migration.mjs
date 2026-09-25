#!/usr/bin/env node
// M1_INVENTORY_MAINTENANCE_V1 governed schema step. Applies only the tracked
// additive 012 migration to persistent_agent_live_status under the active F
// lease. Six nullable columns; no backfill; old and new Native both coexist.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const governanceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const canonicalProduction = 'c:\\users\\administrator\\ghost-island-production\\ro-stack';
export const MIGRATION = Object.freeze({
  id: '012-m1-supply-live-preflight',
  path: 'ops/ro-stack/sql/012-m1-supply-live-preflight.sql',
  table: 'persistent_agent_live_status',
  columns: Object.freeze([
    ['inventory_slots', /^int(\(\d+\))? unsigned$/],
    ['inventory_max_slots', /^int(\(\d+\))? unsigned$/],
    ['weight', /^int(\(\d+\))? unsigned$/],
    ['max_weight', /^int(\(\d+\))? unsigned$/],
    ['supply_required', /^tinyint\(1\)$/],
    ['supply_reason', /^varchar\(64\)$/],
  ]),
});
const EXPECTED_STATEMENT = 'ALTER TABLE `persistent_agent_live_status` ' +
  'ADD COLUMN IF NOT EXISTS `inventory_slots` int unsigned NULL, ' +
  'ADD COLUMN IF NOT EXISTS `inventory_max_slots` int unsigned NULL, ' +
  'ADD COLUMN IF NOT EXISTS `weight` int unsigned NULL, ' +
  'ADD COLUMN IF NOT EXISTS `max_weight` int unsigned NULL, ' +
  'ADD COLUMN IF NOT EXISTS `supply_required` tinyint(1) NULL, ' +
  'ADD COLUMN IF NOT EXISTS `supply_reason` varchar(64) NULL;';
export const ROLLBACK_STATEMENT = 'ALTER TABLE `persistent_agent_live_status` ' +
  MIGRATION.columns.map(([name]) => `DROP COLUMN IF EXISTS \`${name}\``).join(', ') + ';';
const need = (ok, code) => { if (!ok) throw Error(code); };
const sha = value => createHash('sha256').update(value).digest('hex').toUpperCase();

// The file must be exactly the reviewed additive statement plus comments.
export function parseMigration(text) {
  const statement = String(text).split(/\r?\n/).filter(line => !/^\s*--/.test(line))
    .join(' ').replace(/\s+/g, ' ').trim();
  need(statement === EXPECTED_STATEMENT, 'MIGRATION_STATEMENT_NOT_APPROVED');
  return statement;
}

export async function inspectSchema(db) {
  const rows = String(await db.queryText(
    "SELECT column_name,column_type,is_nullable,COALESCE(column_default,'<NULL>'),ordinal_position " +
    "FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='persistent_agent_live_status' " +
    'ORDER BY ordinal_position;')).split(/\r?\n/).filter(Boolean).map(line => {
    const [name, type, nullable, def, position] = line.split('\t');
    return { name, type: String(type).toLowerCase(), nullable: nullable === 'YES', default: def, position: Number(position) };
  });
  need(rows.length > 0, 'LIVE_STATUS_TABLE_MISSING');
  const rowCount = Number(String(await db.queryText('SELECT COUNT(*) FROM persistent_agent_live_status;')).trim());
  need(Number.isSafeInteger(rowCount) && rowCount >= 0, 'LIVE_STATUS_ROW_COUNT_UNAVAILABLE');
  return { columns: rows, rowCount };
}

const added = new Set(MIGRATION.columns.map(([name]) => name));
function contractColumns(schema) {
  return MIGRATION.columns.map(([name, type]) => {
    const row = schema.columns.find(column => column.name === name);
    return { name, present: !!row, valid: !!row && type.test(row.type) && row.nullable && row.default === '<NULL>' };
  });
}

export function planMigration(schema) {
  const contract = contractColumns(schema);
  const present = contract.filter(item => item.present);
  need(present.every(item => item.valid), 'EXISTING_COLUMN_CONTRACT_MISMATCH');
  return { columns_present_before: present.length,
    action: present.length === contract.length ? 'NOOP_IDEMPOTENT' : 'APPLY' };
}

export function verifyMigration(before, after) {
  const base = schema => schema.columns.filter(column => !added.has(column.name))
    .map(({ name, type, nullable, default: def }) => ({ name, type, nullable, default: def }));
  need(JSON.stringify(base(before)) === JSON.stringify(base(after)), 'EXISTING_LIVE_STATUS_COLUMNS_CHANGED');
  need(after.rowCount >= before.rowCount, 'EXISTING_LIVE_STATUS_ROWS_LOST');
  need(contractColumns(after).every(item => item.present && item.valid), 'SIX_FIELD_CONTRACT_INCOMPLETE');
  return { columns_present_after: MIGRATION.columns.length, existing_columns_unchanged: true,
    rows_before: before.rowCount, rows_after: after.rowCount };
}

export async function runMigration({ db, sqlText, execute }) {
  const statement = parseMigration(sqlText);
  const before = await inspectSchema(db);
  const plan = planMigration(before);
  if (!execute) return { dry_run: true, statement_sha256: sha(statement), plan, before };
  if (plan.action === 'APPLY') await db.queryText(statement);
  const after = await inspectSchema(db);
  return { dry_run: false, statement_sha256: sha(statement), plan, before, after,
    verification: verifyMigration(before, after) };
}

const git = (...args) => {
  const r = spawnSync('git', args, { cwd: governanceRoot, encoding: 'utf8', windowsHide: true });
  need(r.status === 0, 'GIT_FAILED:' + args[0]);
  return r.stdout.trim();
};

async function main() {
  const argv = process.argv.slice(2);
  const args = Object.fromEntries(argv.flatMap((item, i) => item.startsWith('--') ? [[item.slice(2), argv[i + 1]]] : []));
  const root = fs.realpathSync(args['production-root'] || '.');
  need(root.toLowerCase() === canonicalProduction, 'CANONICAL_PRODUCTION_ROOT_REQUIRED');
  need(['dry-run', 'apply'].includes(args.action) && args.owner && args.lease, 'ARGUMENTS_REQUIRED');
  need(args.action === 'dry-run' || args.execute === 'true', 'EXPLICIT_EXECUTE_REQUIRED');
  need(git('status', '--porcelain=v1', '--untracked-files=all') === '', 'GOVERNANCE_SOURCE_DIRTY');
  const governanceSha = git('rev-parse', 'HEAD');
  const tip = git('ls-remote', '--exit-code', 'origin', 'refs/heads/main').split(/\s/)[0];
  git('fetch', '--no-tags', '--no-write-fetch-head', 'origin', 'refs/heads/main');
  git('merge-base', '--is-ancestor', governanceSha, tip);
  const local = path.join(root, '.local/ro-stack');
  const lease = JSON.parse(fs.readFileSync(path.join(local, 'production-deployment-lease/lease.json'), 'utf8'));
  need(lease.status === 'ACTIVE' && lease.lease_id === args.lease && lease.owner_task_id === args.owner,
    'ACTIVE_LEASE_IDENTITY_MISMATCH');
  // The clean governance checkout guarantees the tracked blob is the input.
  const sqlText = git('show', `${governanceSha}:${MIGRATION.path}`);
  const secrets = JSON.parse(fs.readFileSync(path.join(local, 'secrets.json'), 'utf8'));
  const { createDashboardDatabase } = await import('./dashboard-db.mjs');
  const db = createDashboardDatabase({ host: '127.0.0.1', port: 3307, user: 'rathena_local',
    password: secrets.databasePassword, database: 'ragnarok', poolSize: 1 });
  try {
    const result = await runMigration({ db, sqlText, execute: args.action === 'apply' });
    const receipt = { schema_version: 'live-status-schema-migration-v1', migration: MIGRATION.id,
      migration_path: MIGRATION.path, governance_sha: governanceSha, lease_id: args.lease,
      lease_owner: args.owner, fabricated_backfill: false, rollback_statement: ROLLBACK_STATEMENT,
      rollback_order: ['restore previous Native candidate and verify health',
        'drop the six columns only when no running Native writes them', 'verify original schema'],
      ...result, measured_at: new Date().toISOString() };
    if (args.action === 'apply') {
      const file = path.join(local, `schema-migration-${args.lease}-${MIGRATION.id}.json`);
      need(!fs.existsSync(file) || result.plan.action === 'NOOP_IDEMPOTENT', 'MIGRATION_RECEIPT_EXISTS');
      if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
      receipt.receipt_path = file;
      receipt.receipt_sha256 = sha(fs.readFileSync(file));
    }
    console.log(JSON.stringify(receipt, null, 2));
  } finally {
    await db.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch(error => { console.log(JSON.stringify({ result: 'FAIL', error: error.message })); process.exitCode = 1; });
