import assert from 'node:assert/strict';
import {
  createDashboardDatabase,
  formatMysqlResult,
  isRetryableDatabaseError,
} from '../ops/ro-stack/dashboard-db.mjs';

assert.equal(formatMysqlResult([[1, 'two', null]]), '1\ttwo\tNULL');
assert.equal(formatMysqlResult([[[1]], [['two']]]), '1\ntwo');
assert.equal(isRetryableDatabaseError({ code: 'ECONNRESET' }), true);
assert.equal(isRetryableDatabaseError({ code: 'ER_DUP_ENTRY' }), false);

const database = createDashboardDatabase({
  host: '127.0.0.1',
  port: 3307,
  user: 'test',
  password: 'test',
  database: 'test',
  poolSize: 100,
  queueLimit: 1_000,
  connectTimeoutMs: 99_999,
});
assert.deepEqual(database.config, {
  connectionLimit: 16,
  queueLimit: 256,
  connectTimeout: 15_000,
  idleTimeout: 60_000,
});
await database.close();
await database.close();

console.log('DASHBOARD_DB_POOL_PASS checks=7');
