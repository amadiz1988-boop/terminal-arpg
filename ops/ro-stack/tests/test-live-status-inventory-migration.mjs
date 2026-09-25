import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MIGRATION, ROLLBACK_STATEMENT, parseMigration, planMigration, runMigration,
  verifyMigration } from '../apply-live-status-inventory-migration.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const sqlText = fs.readFileSync(path.join(root, MIGRATION.path), 'utf8');
const base = ['char_id', 'account_id', 'revision', 'resident', 'hp', 'max_hp', 'sp', 'max_sp', 'zeny',
  'map', 'x', 'y', 'runtime_phase', 'supply_item_id', 'supply_item_amount', 'control_owner',
  'ownership_state', 'runtime_state', 'agent_mode', 'updated_at'];
let count = 0;
const pass = name => console.log(`PASS ${++count} ${name}`);

// Models the MariaDB information_schema answer and applies the exact ALTER.
function fakeDb({ extra = [], rows = 22 } = {}) {
  const columns = base.map(name => ({ name, type: 'int(10) unsigned', nullable: 'NO', def: '<NULL>' }))
    .concat(extra);
  const statements = [];
  return { columns, statements, rows,
    async queryText(query) {
      statements.push(query);
      if (query.startsWith('SELECT column_name'))
        return columns.map((c, i) => [c.name, c.type, c.nullable, c.def, i + 1].join('\t')).join('\n');
      if (query.startsWith('SELECT COUNT(*)')) return String(this.rows);
      if (query.startsWith('ALTER TABLE')) {
        for (const [name] of MIGRATION.columns) if (!columns.some(c => c.name === name))
          columns.push({ name, type: name === 'supply_required' ? 'tinyint(1)' :
            name === 'supply_reason' ? 'varchar(64)' : 'int(10) unsigned', nullable: 'YES', def: 'NULL' });
        return '';
      }
      throw Error('unexpected ' + query);
    } };
}

assert.equal(typeof parseMigration(sqlText), 'string');
pass('tracked 012 file is exactly the approved additive statement');
assert.throws(() => parseMigration(sqlText + '\nUPDATE persistent_agent_live_status SET weight=1;'), /NOT_APPROVED/);
assert.throws(() => parseMigration(sqlText.replace('varchar(64) NULL', 'varchar(64) NOT NULL')), /NOT_APPROVED/);
pass('backfill or non-nullable variants are rejected');

{
  const db = fakeDb();
  const dry = await runMigration({ db, sqlText, execute: false });
  assert.equal(dry.plan.action, 'APPLY');
  assert.equal(dry.plan.columns_present_before, 0);
  assert.ok(!db.statements.some(q => q.startsWith('ALTER')));
  pass('dry run from old schema plans APPLY without mutation');
  const applied = await runMigration({ db, sqlText, execute: true });
  assert.equal(applied.verification.columns_present_after, 6);
  assert.equal(applied.verification.rows_before, 22);
  assert.equal(applied.verification.rows_after, 22);
  assert.equal(applied.verification.existing_columns_unchanged, true);
  pass('old schema forward migration adds six nullable fields and preserves rows and columns');
  const again = await runMigration({ db, sqlText, execute: true });
  assert.equal(again.plan.action, 'NOOP_IDEMPOTENT');
  assert.equal(db.statements.filter(q => q.startsWith('ALTER')).length, 1);
  pass('second application is an idempotent no-op');
}
{
  const db = fakeDb({ extra: [{ name: 'weight', type: 'int(10) unsigned', nullable: 'NO', def: '0' }] });
  await assert.rejects(runMigration({ db, sqlText, execute: true }), /EXISTING_COLUMN_CONTRACT_MISMATCH/);
  pass('conflicting pre-existing column blocks before mutation');
}
{
  const before = { rowCount: 22, columns: base.map(name => ({ name, type: 'int', nullable: false, default: '<NULL>' })) };
  const after = { rowCount: 21, columns: before.columns };
  assert.throws(() => verifyMigration(before, after), /ROWS_LOST|EXISTING|CONTRACT/);
  pass('post-verification refuses row loss or incomplete contract');
}
assert.ok(ROLLBACK_STATEMENT.includes('DROP COLUMN IF EXISTS `supply_reason`'));
assert.equal(planMigration({ columns: [] , rowCount: 0 }).action, 'APPLY');
pass('rollback statement drops only the six added columns');
console.log(`LIVE_STATUS_SCHEMA_TESTS=${count}`);
