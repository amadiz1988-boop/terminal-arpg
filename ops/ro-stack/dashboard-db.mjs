import mysql from 'mysql2/promise';

const RETRYABLE_ERRORS = new Set([
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
]);

function boundedPositiveInteger(value, fallback, maximum) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? Math.min(parsed, maximum)
    : fallback;
}

function fieldText(value) {
  if (value === null || value === undefined) return 'NULL';
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  return String(value);
}

function rowText(row) {
  return row.map(fieldText).join('\t');
}

function resultSets(result) {
  if (!Array.isArray(result) || result.length === 0) return [];
  if (Array.isArray(result[0]) && Array.isArray(result[0][0])) return result;
  return [result];
}

export function formatMysqlResult(result) {
  return resultSets(result)
    .flatMap((rows) =>
      Array.isArray(rows)
        ? rows.filter((row) => Array.isArray(row)).map(rowText)
        : [],
    )
    .join('\n');
}

export function isRetryableDatabaseError(error) {
  return RETRYABLE_ERRORS.has(String(error?.code ?? ''));
}

export function createDashboardDatabase({
  host,
  port,
  user,
  password,
  database,
  poolSize = 8,
  queueLimit = 64,
  connectTimeoutMs = 2_500,
  idleTimeoutMs = 60_000,
}) {
  const connectionLimit = boundedPositiveInteger(poolSize, 8, 16);
  const boundedQueueLimit = boundedPositiveInteger(queueLimit, 64, 256);
  const connectTimeout = boundedPositiveInteger(connectTimeoutMs, 2_500, 15_000);
  const idleTimeout = boundedPositiveInteger(idleTimeoutMs, 60_000, 300_000);
  let closed = false;

  const pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    charset: 'utf8mb4',
    connectTimeout,
    connectionLimit,
    queueLimit: boundedQueueLimit,
    waitForConnections: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    maxIdle: connectionLimit,
    idleTimeout,
    multipleStatements: true,
    rowsAsArray: true,
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
  });

  async function queryText(statement) {
    if (closed) throw new Error('DB_POOL_CLOSED');
    if (typeof statement !== 'string' || statement.length > 1_048_576)
      throw new Error('DB_STATEMENT_INVALID');

    const readOnly = /^\s*(SELECT|SHOW|DESCRIBE|EXPLAIN|WITH)\b/i.test(statement);
    const attempts = readOnly ? 2 : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const [result] = await pool.query(statement);
        return formatMysqlResult(result);
      } catch (error) {
        if (
          attempt + 1 >= attempts ||
          !isRetryableDatabaseError(error)
        )
          throw error;
      }
    }
    throw new Error('DB_QUERY_RETRY_EXHAUSTED');
  }

  async function close() {
    if (closed) return;
    closed = true;
    await pool.end();
  }

  return Object.freeze({
    pool,
    queryText,
    close,
    config: Object.freeze({
      connectionLimit,
      queueLimit: boundedQueueLimit,
      connectTimeout,
      idleTimeout,
    }),
  });
}
