import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MIGRATION, parseMigration, planMigration, runMigration,
  verifyMigration } from '../apply-runtime-phase-width-migration.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const sqlText = fs.readFileSync(path.join(root, MIGRATION.path), 'utf8');
let count = 0;
const pass = message => console.log(`PASS ${++count} ${message}`);

function fakeDb(width = 24) {
  const state = { width, rows: '1\t2\tIDLE\n2\t3\tAUTO_FARM', alterCount: 0 };
  const db = { state, async queryText(query) {
    if (query.startsWith('SELECT COLUMN_TYPE'))
      return `varchar(${state.width})\tNO\t'IDLE'\tutf8mb4\tutf8mb4_unicode_ci`;
    if (query.startsWith('SELECT column_name')) return [
      'char_id\tint(10) unsigned\tNO\t<NULL>\t1',
      'runtime_phase\tvarchar(' + state.width + ")\tNO\t'IDLE'\t2",
      'account_id\tint(10) unsigned\tNO\t<NULL>\t3',
    ].join('\n');
    if (query.startsWith('SELECT COUNT(*)')) return '2';
    if (query.startsWith('SELECT *')) return state.rows;
    if (query.startsWith('ALTER TABLE')) { state.width = 64; state.alterCount++; return ''; }
    throw Error('UNEXPECTED_QUERY');
  } };
  return db;
}

assert.equal(parseMigration(sqlText).startsWith('ALTER TABLE'), true);
assert.throws(() => parseMigration(sqlText + '\nDELETE FROM persistent_agent_live_status;'),
  /MIGRATION_STATEMENT_NOT_APPROVED/);
pass('tracked 013 statement exactness rejects an extra write');

{
  const db = fakeDb();
  const result = await runMigration({ db, sqlText, execute: false });
  assert.equal(result.plan.action, 'APPLY');
  assert.equal(db.state.alterCount, 0);
  pass('default dry run does not mutate');
  const applied = await runMigration({ db, sqlText, execute: true });
  assert.equal(db.state.alterCount, 1);
  assert.equal(applied.verification.rows_preserved, true);
  assert.equal(applied.verification.rows_before, 2);
  pass('explicit apply widens and preserves rows');
  const again = await runMigration({ db, sqlText, execute: true, receiptExists: true });
  assert.equal(again.plan.action, 'NOOP_RECORDED');
  assert.equal(db.state.alterCount, 1);
  pass('recorded migration is an idempotent no-op');
}

assert.throws(() => planMigration({ type: 'varchar(32)', nullable: 'NO',
  defaultValue: "'IDLE'", charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
/RUNTIME_PHASE_PRECONDITION_MISMATCH/);
assert.throws(() => planMigration({ type: 'varchar(64)', nullable: 'NO',
  defaultValue: "'IDLE'", charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
/UNRECORDED_SCHEMA_CHANGE/);
pass('unknown and unrecorded schema states fail closed');

{
  const db = fakeDb();
  const before = await runMigration({ db, sqlText, execute: false });
  await db.queryText(parseMigration(sqlText));
  const after = await runMigration({ db, sqlText, execute: false, receiptExists: true });
  assert.throws(() => verifyMigration(before.before,
    { ...after.before, rowsHash: 'changed' }), /ROWS_CHANGED/);
  assert.throws(() => verifyMigration(before.before,
    { ...after.before, columns: [...after.before.columns, { name: 'unexpected' }] }),
  /OTHER_LIVE_STATUS_COLUMNS_CHANGED/);
  pass('postcheck rejects row or unrelated-column drift');
}

console.log(`RUNTIME_PHASE_MIGRATION_TESTS=${count}`);
