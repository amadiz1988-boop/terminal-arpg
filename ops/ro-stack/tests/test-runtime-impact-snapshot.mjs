import assert from 'node:assert/strict';
import { aggregateImpact, collectImpactSnapshot } from '../runtime-impact-snapshot.mjs';

let count = 0;
function check(label, actual, expected) { assert.deepEqual(actual, expected, label); count += 1; }
const counts = { online_characters: 3, online_players: 2 };
const online = [{ char_id: 10 }, { char_id: 11 }, { char_id: 12 }];
const pa = [
  { char_id: 10, agent_mode: 'PERSISTENT_IDLE', runtime_phase: 'IDLE', age_ms: 100 },
  { char_id: 11, agent_mode: 'AUTO_FARM', runtime_phase: 'RUNNING', age_ms: 200 },
  { char_id: 12, agent_mode: 'NAVIGATING', runtime_phase: 'RUNNING', age_ms: 300 },
  { char_id: 13, agent_mode: 'AUTO_QUEST', runtime_phase: 'RUNNING', age_ms: 400 },
  { char_id: 14, agent_mode: 'AUTO_FARM', runtime_phase: 'SUPPLY', age_ms: 500 },
  { char_id: 15, agent_mode: 'AUTO_FARM', runtime_phase: 'RECOVERING', age_ms: 600 },
];
const result = aggregateImpact(counts, online, pa);
check('authoritative online counts', [result.onlinePlayerCount, result.onlineCharacterCount], [2, 3]);
check('PA resident count', result.persistentAgentResidentCount, 6);
check('PA mode counts', result.persistentAgentModeCounts, { IDLE: 1, AUTO_FARM: 1, JOURNEY: 1, QUEST: 1, SUPPLY: 1, RECOVERY: 1 });
check('active counts', [result.activeFarmCount, result.activeJourneyCount, result.activeQuestCount], [1, 1, 1]);
check('character IDs', result.affectedCharacterIds, [10, 11, 12, 13, 14, 15]);
const stale = aggregateImpact(counts, online, [{ ...pa[0], age_ms: 15_001 }]);
check('stale PA is unavailable', stale.persistentAgentResidentCount, 'UNAVAILABLE');
check('stale PA mode counts unavailable', stale.persistentAgentModeCounts, 'UNAVAILABLE');
let queries = 0;
const partial = await collectImpactSnapshot(async () => {
  queries += 1;
  if (queries === 1) return [[counts]];
  if (queries === 2) return [online];
  throw new Error('PA_DOWN');
});
check('partial source keeps online count', partial.onlineCharacterCount, 3);
check('partial source PA unavailable', partial.activeFarmCount, 'UNAVAILABLE');
check('partial source DB reached', partial.dbReachable, true);
const failed = await collectImpactSnapshot(async () => { throw new Error('DB_DOWN'); });
check('DB failure not zero', failed.onlineCharacterCount, 'UNAVAILABLE');
check('DB failure reported', failed.dbReachable, false);
console.log(`RUNTIME_IMPACT_TEST_PASS count=${count}`);
