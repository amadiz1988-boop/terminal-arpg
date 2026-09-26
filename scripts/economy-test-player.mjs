#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { fixedDbRead } from '../ops/ro-stack/dev-console/providers.mjs';
import { ECONOMY_TEST_CONFIG_FIXTURE } from '../ops/ro-stack/support-session.mjs';
import {
  ECONOMY_TEST_CHAR_ID, parseEconomyCli, economyPrecondition,
  economyTestConfig, economyDeltas, stopEconomyFarm,
} from './lib/economy-test-player.mjs';

const sleep = ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms));
const record = kind => fixedDbRead(kind, ECONOMY_TEST_CHAR_ID).records[0] ?? null;
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const withoutRevision = value => { const copy = structuredClone(value); delete copy.revision; return copy; };

export async function runEconomyTestPlayer(args, io = {}) {
  const options = parseEconomyCli(args);
  const startedAt = Date.now();
  let deadline = startedAt + options.timeoutMs;
  const traceId = `economy-test-player-${randomUUID()}`;
  const origin = io.origin ?? process.env.SYNTHETIC_PLAYER_ORIGIN ?? 'http://127.0.0.1:8788';
  const token = io.token ?? process.env.RO_LOCAL_ADMIN_TOKEN;
  let cookie = '';
  let savedConfig = null;
  let appliedConfig = null;
  let fixturePrepared = false;
  let farmStarted = false;
  const result = { scenario: 'economy-test-player', traceId, charId: ECONOMY_TEST_CHAR_ID,
    execute: options.execute, status: 'BLOCKED', firstBrokenTransition: null,
    checkpoints: [], preimage: null, postimage: null, cleanup: null };
  const mark = (name, details = null) => result.checkpoints.push({ name, at: new Date().toISOString(), details });
  const remaining = () => Math.max(0, deadline - Date.now());
  const bounded = async (condition, label, interval = 1500) => {
    while (remaining() > 0) {
      const value = await condition();
      if (value) return value;
      await sleep(Math.min(interval, remaining()));
    }
    throw new Error(`${label}_TIMEOUT`);
  };
  const request = async (path, { method = 'GET', body, admin = false } = {}) => {
    const headers = { accept: 'application/json', 'x-scenario-trace-id': traceId };
    if (body) headers['content-type'] = 'application/json';
    if (admin) headers['x-ro-local-admin-token'] = token;
    else if (cookie) headers.cookie = cookie;
    const response = await fetch(`${origin}${path}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(Math.min(10000, Math.max(1000, remaining()))),
    });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 200) }; }
    if ((!admin || path === '/api/admin/support-sessions') && response.headers.get('set-cookie'))
      cookie = response.headers.get('set-cookie').split(';')[0];
    if (!response.ok) throw new Error(`${method} ${path} HTTP_${response.status}:${data?.error ?? 'UNKNOWN'}`);
    return data;
  };
  const fixture = async profile => {
    const submitted = await request('/api/admin/test-fixture/m1-acceptance', {
      method: 'POST', admin: true, body: { profile },
    });
    const settled = await bounded(async () => {
      const state = await request(`/api/admin/test-fixture/m1-acceptance/${submitted.requestId}`, { admin: true });
      if (state.state === 'REJECTED' || state.state === 'FAILED')
        throw new Error(`FIXTURE_${profile}_${state.reason ?? state.state}`);
      return state.state === 'CONFIRMED' ? state : null;
    }, `FIXTURE_${profile}`);
    mark(profile, { requestId: submitted.requestId, nativeEvent: settled.nativeEvent });
    return settled;
  };
  const putConfig = async config => request('/api/config', { method: 'PUT', body: {
    config, expectedRevision: config.revision, economyTestFixture: ECONOMY_TEST_CONFIG_FIXTURE,
  } });
  const configNow = async () => (await request('/api/config')).config;
  const mode = async () => record('economyEligibility')?.agentMode;
  try {
    const eligibility = record('economyEligibility');
    const preimage = record('economyState');
    const inventory = record('liveInventory');
    result.preimage = { eligibility, economy: preimage, inventory };
    const invalid = economyPrecondition(eligibility, preimage, inventory);
    if (invalid) throw new Error(invalid);
    mark('PRECONDITION_VALID');
    if (!options.execute) {
      result.status = 'PASS';
      mark('DRY_RUN_NO_MUTATION');
      return result;
    }
    if (!token) throw new Error('LOCAL_ADMIN_TOKEN_REQUIRED');
    const session = await request('/api/admin/support-sessions', { method: 'POST', admin: true,
      body: { effectiveCharId: ECONOMY_TEST_CHAR_ID, mode: 'PLAYER_ACTIONS',
        reason: `bounded economy test ${traceId}`, ttlMinutes: 10 } });
    cookie = session?.supportSession ? cookie : '';
    if (!cookie) throw new Error('SUPPORT_SESSION_COOKIE_MISSING');
    mark('AUTHENTICATED_GROUP0_SUPPORT_SESSION', {
      accountId: session.supportSession?.effectiveAccountId,
      charId: session.supportSession?.effectiveCharId });
    savedConfig = await configNow();
    const testConfig = economyTestConfig(savedConfig, inventory.inventorySlots);
    const configured = await putConfig(testConfig);
    appliedConfig = configured.config;
    mark('CANONICAL_CONFIG_SAVED', { revision: appliedConfig.revision,
      execution: configured.execution });
    if (configured.execution?.reason) throw new Error(`CONFIG_EXECUTION_${configured.execution.reason}`);
    fixturePrepared = true;
    await fixture('M1_ECONOMY_SETUP_V1');
    const prepared = await bounded(() => {
      const state = record('economyState');
      return state?.inventory?.[502] === 1 && state?.inventory?.[503] === 1 ? state : null;
    }, 'FIXTURE_PREPARED');
    mark('FIXTURE_PREPARED', { economy: prepared });
    farmStarted = true;
    const started = await request('/api/automation', { method: 'POST', body: { action: 'start' } });
    mark('START_FARM_DISPATCHED', { commandId: started?.command?.commandId,
      executor: started?.executor });
    mark('AWAIT_AUTHORITATIVE_STORE_SELL');
    const after = await bounded(() => {
      const state = record('economyState');
      const delta = economyDeltas(prepared, state);
      if (delta.store && delta.sell) return { state, delta };
      return null;
    }, 'STORE_SELL_AUTHORITY', 2000);
    result.postimage = after.state;
    result.store = { result: 'PASS', inventoryDelta: after.delta.storeQuantity,
      storageDelta: after.delta.storageQuantity };
    result.sell = { result: 'PASS', inventoryDelta: after.delta.sellQuantity,
      zenyDelta: after.delta.zenyGain };
    mark('AUTHORITATIVE_STORE_AND_SELL', after.delta);
    result.status = 'PASS';
  } catch (error) {
    result.reason = String(error?.message ?? error);
    result.firstBrokenTransition = result.checkpoints.at(-1)?.name ?? 'PRECONDITION';
    result.status = result.checkpoints.some(entry => entry.name === 'PRECONDITION_VALID') ? 'FAIL' : 'BLOCKED';
    if (fixturePrepared) {
      result.postimage = record('economyState');
      const delta = economyDeltas({ inventory: { 502: 1, 503: 1 }, storage: { 502: 0 },
        zeny: result.preimage.economy.zeny }, result.postimage);
      result.store = { result: delta.store ? 'PASS' : 'FAIL', inventoryDelta: delta.storeQuantity,
        storageDelta: delta.storageQuantity };
      result.sell = { result: delta.sell ? 'PASS' : 'FAIL', inventoryDelta: delta.sellQuantity,
        zenyDelta: delta.zenyGain };
    }
  } finally {
    if (options.execute && (farmStarted || fixturePrepared || appliedConfig)) {
      // A timed-out observation must never consume the time reserved for
      // stopping the player and restoring its exact fixture preimage.
      deadline = Date.now() + 120000;
      result.cleanup = { result: 'PENDING' };
      try {
        if (farmStarted) await stopEconomyFarm({ mode,
          dispatch: () => request('/api/automation', { method: 'POST', body: { action: 'stop' } }),
          commandStatus: async commandId => fixedDbRead('commands', ECONOMY_TEST_CHAR_ID)
            .records.find(row => row.commandId === commandId),
          remaining, sleep,
          onAttempt: commandId => mark('STOP_FARM_DISPATCHED', { commandId }),
        });
        if (appliedConfig && savedConfig) {
          const current = await configNow();
          if (!same(withoutRevision(current), withoutRevision(appliedConfig)))
            throw new Error('CONFIG_CHANGED_EXTERNALLY');
          const restored = structuredClone(savedConfig);
          restored.revision = current.revision;
          const response = await putConfig(restored);
          mark('CONFIG_RESTORED', { revision: response.config.revision });
        }
        if (fixturePrepared) await fixture('M1_ECONOMY_CLEANUP_V1');
        const state = record('economyState');
        const original = result.preimage?.economy;
        if (!original || !state || !same(state.inventory, original.inventory) ||
            !same(state.storage, original.storage) || state.zeny !== original.zeny)
          throw new Error('FIXTURE_POSTIMAGE_MISMATCH');
        result.cleanup = { result: 'PASS', economy: state };
      } catch (error) {
        result.cleanup = { result: 'FAIL', reason: String(error?.message ?? error),
          economy: record('economyState') };
        result.status = 'FAIL';
        result.firstBrokenTransition ??= 'CLEANUP';
      }
    }
    result.durationMs = Date.now() - startedAt;
  }
  return result;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  let output;
  let options;
  try {
    options = parseEconomyCli(process.argv.slice(2));
    output = await runEconomyTestPlayer(process.argv.slice(2));
  } catch (error) {
    output = { scenario: 'economy-test-player', status: 'BLOCKED', reason: String(error?.message ?? error) };
  }
  if (options?.json) console.log(JSON.stringify(output));
  else console.log(JSON.stringify(output, null, 2));
  process.exitCode = output.status === 'PASS' ? 0 : output.status === 'BLOCKED' ? 2 : 1;
}
