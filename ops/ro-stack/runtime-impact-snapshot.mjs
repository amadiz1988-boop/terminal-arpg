import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import mysql from 'mysql2/promise';

const UNAVAILABLE = 'UNAVAILABLE';
const MAX_IDS = 100;
const LIVE_MAX_AGE_MS = 15_000; // persistent-agent/web-canary.mjs

export function unavailableImpact(reason = 'SOURCE_UNAVAILABLE') {
  return {
    capturedAt: new Date().toISOString(), dbReachable: false, onlinePlayerCount: UNAVAILABLE,
    onlineCharacterCount: UNAVAILABLE, persistentAgentResidentCount: UNAVAILABLE,
    persistentAgentModeCounts: UNAVAILABLE, activeFarmCount: UNAVAILABLE,
    activeJourneyCount: UNAVAILABLE, activeQuestCount: UNAVAILABLE,
    affectedCharacterIds: UNAVAILABLE, affectedCharacterIdsTruncated: UNAVAILABLE,
    onlineSource: '`char`.online=1', paSource: 'persistent_agent_live_status',
    paFreshnessMaxAgeMs: LIVE_MAX_AGE_MS, unavailableReason: reason,
  };
}

function modeBucket(row) {
  const phase = String(row.runtime_phase ?? '').toUpperCase();
  const mode = String(row.agent_mode ?? '').toUpperCase();
  if (phase === 'RECOVERING' || phase === 'RESPAWNING') return 'RECOVERY';
  if (phase === 'DEAD') return 'DEAD';
  if (phase === 'SUPPLY') return 'SUPPLY';
  if (phase === 'NAVIGATING' || phase === 'RETURN_TO_FARM') return 'JOURNEY';
  if (mode === 'AUTO_FARM') return 'AUTO_FARM';
  if (mode === 'AUTO_QUEST') return 'QUEST';
  if (mode === 'NAVIGATING') return 'JOURNEY';
  if (mode === 'PERSISTENT_IDLE' || mode === 'IDLE') return 'IDLE';
  return mode || 'OTHER';
}

export function aggregateImpact(onlineCounts, onlineIds, paRows) {
  const result = unavailableImpact();
  result.dbReachable = true;
  result.onlinePlayerCount = Number(onlineCounts.online_players);
  result.onlineCharacterCount = Number(onlineCounts.online_characters);
  const stale = paRows.length > 1000 || paRows.some((row) =>
    row.age_ms === null || Number(row.age_ms) < 0 || Number(row.age_ms) > LIVE_MAX_AGE_MS);
  if (!stale) {
    const counts = { IDLE: 0, AUTO_FARM: 0, JOURNEY: 0, QUEST: 0, SUPPLY: 0, RECOVERY: 0 };
    for (const row of paRows) {
      const bucket = modeBucket(row);
      counts[bucket] = (counts[bucket] ?? 0) + 1;
    }
    result.persistentAgentResidentCount = paRows.length;
    result.persistentAgentModeCounts = counts;
    result.activeFarmCount = counts.AUTO_FARM;
    result.activeJourneyCount = counts.JOURNEY;
    result.activeQuestCount = counts.QUEST;
  } else {
    result.unavailableReason = 'PA_STALE_OR_LIMIT_EXCEEDED';
  }
  const ids = [...new Set([...onlineIds, ...paRows].map((row) => Number(row.char_id))
    .filter((value) => Number.isSafeInteger(value) && value > 0))].sort((a, b) => a - b);
  result.affectedCharacterIds = ids.slice(0, MAX_IDS);
  result.affectedCharacterIdsTruncated = ids.length > MAX_IDS || result.onlineCharacterCount > onlineIds.length || paRows.length > 1000;
  if (!stale) result.unavailableReason = null;
  return result;
}

export async function collectImpactSnapshot(query) {
  const result = unavailableImpact();
  let counts;
  let onlineIds;
  try {
    [[counts]] = await query('SELECT COUNT(*) AS online_characters, COUNT(DISTINCT account_id) AS online_players FROM `char` WHERE online=1');
    [onlineIds] = await query('SELECT char_id FROM `char` WHERE online=1 ORDER BY char_id LIMIT 101');
    result.dbReachable = true;
    result.onlinePlayerCount = Number(counts.online_players);
    result.onlineCharacterCount = Number(counts.online_characters);
    result.affectedCharacterIds = onlineIds.slice(0, MAX_IDS).map((row) => Number(row.char_id));
    result.affectedCharacterIdsTruncated = onlineIds.length > MAX_IDS || result.onlineCharacterCount > onlineIds.length;
    result.unavailableReason = null;
  } catch {
    return result;
  }
  try {
    const [paRows] = await query('SELECT char_id,agent_mode,runtime_phase,ROUND(TIMESTAMPDIFF(MICROSECOND,updated_at,CURRENT_TIMESTAMP(3))/1000) AS age_ms FROM persistent_agent_live_status WHERE resident=1 ORDER BY char_id LIMIT 1001');
    const aggregate = aggregateImpact(counts, onlineIds, paRows);
    return { ...aggregate, capturedAt: result.capturedAt };
  } catch {
    return { ...result, unavailableReason: 'PA_SOURCE_UNAVAILABLE' };
  }
}

async function main(runtimeRoot) {
  let connection;
  let attemptedConnect = false;
  try {
    const secrets = JSON.parse(await readFile(join(runtimeRoot, 'secrets.json'), 'utf8'));
    attemptedConnect = true;
    connection = await mysql.createConnection({
      host: process.env.RO_DB_HOST ?? '127.0.0.1', port: Number(process.env.RO_DB_PORT ?? 3307),
      user: process.env.RO_DB_USER ?? 'rathena_local',
      password: process.env.RO_DB_PASSWORD ?? secrets.databasePassword,
      database: process.env.RO_DB_NAME ?? 'ragnarok', connectTimeout: 1500,
    });
    console.log(JSON.stringify(await collectImpactSnapshot((sql) => connection.query(sql))));
  } catch {
    const result = unavailableImpact();
    if (!attemptedConnect) result.dbReachable = UNAVAILABLE;
    console.log(JSON.stringify(result));
  } finally {
    if (connection) await connection.end().catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main(process.argv[2]);
}
