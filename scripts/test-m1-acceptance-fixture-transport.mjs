import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createM1AcceptanceFixtureTransport, fixtureTransportEnabled } from '../ops/ro-stack/test-fixture-command.mjs';

assert.equal(fixtureTransportEnabled('M1_ACCEPTANCE', {}), false);
assert.equal(fixtureTransportEnabled('GENERIC', {}), false);
assert.equal(fixtureTransportEnabled('M1_ACCEPTANCE', { RO_M1_ACCEPTANCE_FIXTURE_ENABLED: '1' }), true);
assert.equal(fixtureTransportEnabled('GENERIC', { RO_M1_ACCEPTANCE_FIXTURE_ENABLED: '1' }), false);
assert.equal(fixtureTransportEnabled('M1_ACCEPTANCE', { RO_TEST_FIXTURE_COMMANDS_ENABLED: '1' }), false);
assert.equal(fixtureTransportEnabled('GENERIC', { RO_TEST_FIXTURE_COMMANDS_ENABLED: '1' }), true);
assert.equal(fixtureTransportEnabled('UNKNOWN', { RO_M1_ACCEPTANCE_FIXTURE_ENABLED: '1', RO_TEST_FIXTURE_COMMANDS_ENABLED: '1' }), false);
const dashboardSource = await readFile(new URL('../ops/ro-stack/dashboard.mjs', import.meta.url), 'utf8');
const launcherSource = await readFile(new URL('../ops/ro-stack/dashboard-service.ps1', import.meta.url), 'utf8');
const configSource = await readFile(new URL('../ops/ro-stack/stack.config.psd1', import.meta.url), 'utf8');
assert.match(dashboardSource, /fixtureTransportEnabled\(\(isM1Submit \|\| m1ResultMatch\) \? 'M1_ACCEPTANCE' : 'GENERIC'\)/);
assert.match(configSource, /WebM1AcceptanceFixtureEnabled\s*=\s*\$false/);
assert.match(launcherSource, /RO_M1_ACCEPTANCE_FIXTURE_ENABLED=if\(\$stackConfig\.WebM1AcceptanceFixtureEnabled\)/);
assert.match(launcherSource, /RO_M1_ACCEPTANCE_FIXTURE_ENABLED=\$previousM1AcceptanceFixture/);
assert.match(launcherSource, /ValidateSet\('start','stop','health','probe'\)/);
assert.match(launcherSource, /lifecycle-audit\.log/);
assert.match(launcherSource, /web-experience-canary\.json/);
assert.match(launcherSource, /RedirectStandardInput \$stdin -RedirectStandardOutput \$stdout -RedirectStandardError \$stderr/);

const registry = JSON.parse(await readFile(new URL('../docs/project-control/canonical-test-fixtures.json', import.meta.url)));
const local = { context: 'ADMIN_TRANSPORT', actorAdminId: 'developer-admin',
  authMethod: 'LOCAL_ADMIN_TOKEN', sessionId: randomUUID() };
const cloud = { ...local, authMethod: 'CLOUDFLARE_ACCESS_EDGE' };
const request = { profile: 'M1_FLY_SUPPLY_V1' };

function fixture({ testFlag = 1, accountId = 2000163, event = 'PREREQUISITES_READY',
  auditFails = false, registryValue = registry } = {}) {
  const sqlLog = [], grants = [], audits = [];
  let queued = null, commandStatus = 'QUEUED';
  const sql = async statement => {
    sqlLog.push(statement);
    if (statement.includes('JOIN persistent_agent_state s'))
      return `${accountId}\t${testFlag}\t7`;
    if (statement.includes('INSERT IGNORE INTO persistent_agent_command')) {
      const id = statement.match(/VALUES \('([0-9a-f-]{36})'/)?.[1];
      const hash = statement.match(/'([0-9a-f]{64})',7,'QUEUED'/)?.[1];
      const payload = statement.match(/'prepare_m1_acceptance_fixture',\s*'([^']+)'/)?.[1];
      assert.ok(id && hash && payload);
      queued = { id, hash, payload: JSON.parse(payload) };
      return '';
    }
    if (statement.includes('FROM persistent_agent_command c'))
      return queued ? `${queued.id}\t150105\tprepare_m1_acceptance_fixture\t7\t${commandStatus}\t\t\t\t\t${queued.hash}\t${JSON.stringify(queued.payload)}` : '';
    if (statement.includes('FROM persistent_agent_rollout_event'))
      return `${event}\t2026-09-25 12:00:00.000`;
    throw Error('unexpected fixture SQL');
  };
  const transport = createM1AcceptanceFixtureTransport({ sql, escapeSql: String,
    audit: async value => { if (auditFails) throw Error('audit unavailable'); audits.push(value); },
    nativeGrant: async value => { grants.push(value); }, registry: registryValue });
  return { transport, grants, audits, sqlLog, get queued() { return queued; },
    set commandStatus(value) { commandStatus = value; } };
}

const valid = fixture();
const submitted = await valid.transport.submit(request, local);
assert.equal(submitted.status, 202);
assert.equal(submitted.body.targetCharId, 150105);
assert.deepEqual(Object.keys(valid.queued.payload).sort(), ['adminSessionId', 'targetCharId', 'profile'].sort());
assert.equal(valid.queued.payload.targetCharId, 150105);
assert.equal(valid.queued.payload.profile, 'M1_FLY_SUPPLY_V1');
assert.equal(valid.grants[0].createdFrom, 'M1_FLY_SUPPLY_V1');
assert.equal(valid.grants[0].adminAuthMethod, 'LOCAL_ADMIN_TOKEN');
assert.equal(valid.audits[0].eventType, 'M1_FIXTURE_REQUEST');
assert.equal(valid.audits[0].charId, 150105);
assert.equal(valid.audits[0].commandId, submitted.body.requestId);
assert.equal(valid.queued.payload.profile, 'M1_FLY_SUPPLY_V1');
assert.ok(valid.sqlLog.some(row => row.includes("'prepare_m1_acceptance_fixture'")));
assert.equal((await valid.transport.submit(request, cloud)).status, 403);
assert.equal((await valid.transport.submit(request, { ...local, context: 'PLAYER_SESSION', authMethod: 'PLAYER_COOKIE' })).status, 403);
assert.equal((await valid.transport.submit({ ...request, targetCharId: 1 }, local)).status, 422);
assert.equal((await valid.transport.submit({ ...request, targetCharId: 150106 }, local)).status, 422);
assert.equal((await valid.transport.submit({ ...request, targetCharId: 150094 }, local)).status, 422);
assert.equal((await valid.transport.submit({ ...request, command: 'warp' }, local)).status, 422);
assert.equal((await valid.transport.submit({ ...request, arguments: 'prontera' }, local)).status, 422);
assert.equal((await valid.transport.submit({ ...request, itemId: 501 }, local)).status, 422);
assert.equal((await valid.transport.submit({ ...request, zeny: 999999 }, local)).status, 422);
assert.equal((await valid.transport.submit({ profile: 'OTHER' }, local)).status, 422);
assert.equal((await fixture({ testFlag: 0 }).transport.submit(request, local)).status, 403);
assert.equal((await fixture({ accountId: 2000164 }).transport.submit(request, local)).status, 403);
assert.equal((await fixture({ registryValue: { identities: [] } }).transport.submit(request, local)).status, 403);
const noAudit = fixture({ auditFails: true });
await assert.rejects(noAudit.transport.submit(request, local), /audit unavailable/);
assert.equal(noAudit.grants.length, 0);
assert.equal(noAudit.queued, null);
valid.commandStatus = 'CONFIRMED';
assert.equal((await valid.transport.result(valid.queued.id, local)).body.state, 'CONFIRMED');
assert.equal((await valid.transport.result(valid.queued.id, local)).body.profile, 'M1_FLY_SUPPLY_V1');
assert.equal((await valid.transport.result(valid.queued.id, cloud)).status, 403);
const noNativeEvent = fixture({ event: 'PENDING' });
await noNativeEvent.transport.submit(request, local);
noNativeEvent.commandStatus = 'CONFIRMED';
const inconsistent = await noNativeEvent.transport.result(noNativeEvent.queued.id, local);
assert.equal(inconsistent.body.state, 'FAILED');
assert.equal(inconsistent.body.reason, 'NATIVE_RESULT_MISSING');
for (const profile of ['M1_ECONOMY_SETUP_V1', 'M1_ECONOMY_CLEANUP_V1']) {
  const sample = fixture({ event: profile.endsWith('CLEANUP_V1') ? 'CLEANED' : 'PREREQUISITES_READY' });
  const response = await sample.transport.submit({ profile }, local);
  assert.equal(response.status, 202);
  assert.equal(sample.grants[0].createdFrom, profile);
  assert.equal(sample.queued.payload.profile, profile);
  sample.commandStatus = 'CONFIRMED';
  const result = await sample.transport.result(sample.queued.id, local);
  assert.equal(result.body.state, 'CONFIRMED');
  assert.equal(result.body.profile, profile);
  assert.equal((await sample.transport.submit({ profile, itemId: 999 }, local)).status, 422);
  assert.equal((await sample.transport.submit({ profile, zeny: 999 }, local)).status, 422);
}
console.log('M1_ACCEPTANCE_FIXTURE_TRANSPORT_TEST_PASS');
