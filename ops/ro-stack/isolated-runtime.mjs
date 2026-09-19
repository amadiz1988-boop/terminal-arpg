// Isolated test runtime safety for the Web Dashboard.
//
// First principle: cloning production DATA must never clone production
// EXECUTION INTENT. A cloned database, a copied openkore instance directory or
// a copied state.json may legitimately contain production-derived automation
// state, but that state is fixture data, not permission to launch OpenKore.
//
// This module is the single, pure decision surface for that boundary so the
// Dashboard and the deterministic tests share exactly one implementation.
//
// Runtime mode:
//   production    (default) - every existing behaviour, unchanged
//   isolated-test           - RO_RUNTIME_MODE=isolated-test
//
// In isolated-test mode:
//   - production-derived web_automation.desired_running is never auto-resumed
//   - copied instance state.json is never consulted for recovery
//   - a worker start requires an explicit fixture allowlist AND an isolated
//     instance root AND an approved isolated test database
//   - failure is a hard rejection (ISOLATED_WORKER_START_REJECTED), never a
//     silent fallback

import { resolve } from 'node:path';

export const ISOLATED_TEST_MODE = 'isolated-test';
export const PRODUCTION_RUNTIME_MODE = 'production';
export const ISOLATED_WORKER_START_REJECTED = 'ISOLATED_WORKER_START_REJECTED';

// Approved isolated databases follow the repository's existing fixture naming
// convention (e.g. test_persistent_life, test_pr12_quest_journal). The
// production database "ragnarok" can never satisfy this.
const APPROVED_ISOLATED_DATABASE = /^test_[a-z0-9_]*$/i;

export function normalizeRuntimeMode(value) {
  const mode = String(value ?? '')
    .trim()
    .toLowerCase();
  return mode === ISOLATED_TEST_MODE ? ISOLATED_TEST_MODE : PRODUCTION_RUNTIME_MODE;
}

export function isIsolatedTestMode(value) {
  return normalizeRuntimeMode(value) === ISOLATED_TEST_MODE;
}

// Comma separated positive integer IDs. Anything malformed is dropped rather
// than widened: an unparseable allowlist must never become a wildcard.
export function parseIdentityAllowlist(value) {
  const entries = new Set();
  for (const token of String(value ?? '').split(',')) {
    const trimmed = token.trim();
    if (!/^\d+$/.test(trimmed)) continue;
    const id = Number(trimmed);
    if (Number.isSafeInteger(id) && id > 0) entries.add(id);
  }
  return entries;
}

export function isApprovedIsolatedDatabaseName(value) {
  return APPROVED_ISOLATED_DATABASE.test(String(value ?? '').trim());
}

function samePath(left, right) {
  if (!left || !right) return false;
  const normalize = (value) =>
    resolve(String(value))
      .replace(/\\/g, '/')
      .replace(/\/+$/, '')
      .toLowerCase();
  return normalize(left) === normalize(right);
}

export function isIdentityAuthorized({
  accountId,
  characterId,
  accountAllowlist,
  characterAllowlist,
}) {
  const aid = Number(accountId);
  const cid = Number(characterId);
  const accountOk =
    Number.isSafeInteger(aid) &&
    aid > 0 &&
    accountAllowlist instanceof Set &&
    accountAllowlist.has(aid);
  const characterOk =
    Number.isSafeInteger(cid) &&
    cid > 0 &&
    characterAllowlist instanceof Set &&
    characterAllowlist.has(cid);
  return accountOk || characterOk;
}

// Returns null when the launch is allowed, or a rejection descriptor when it
// must fail fast. Production mode always returns null: no behaviour change.
export function isolatedWorkerStartRejection({
  runtimeMode,
  databaseName,
  instanceRoot,
  defaultInstanceRoot,
  accountId,
  characterId,
  accountAllowlist,
  characterAllowlist,
} = {}) {
  if (!isIsolatedTestMode(runtimeMode)) {
    // Safety net: a dashboard pointed at an approved isolated test database must
    // never launch production-derived workers, even when RO_RUNTIME_MODE was
    // forgotten. Fail fast instead of silently falling back. The production
    // database is never an approved isolated test database, so production
    // behaviour is untouched.
    if (isApprovedIsolatedDatabaseName(databaseName))
      return {
        code: ISOLATED_WORKER_START_REJECTED,
        reason: `database "${String(databaseName ?? '')}" is an isolated test database but RO_RUNTIME_MODE=isolated-test is not set; refusing to launch a worker from production-derived intent`,
      };
    return null;
  }
  if (!isApprovedIsolatedDatabaseName(databaseName))
    return {
      code: ISOLATED_WORKER_START_REJECTED,
      reason: `database "${String(databaseName ?? '')}" is not an approved isolated test database (expected test_*)`,
    };
  if (!String(instanceRoot ?? '').trim())
    return {
      code: ISOLATED_WORKER_START_REJECTED,
      reason: 'RO_INSTANCE_ROOT is required in isolated-test mode',
    };
  if (samePath(instanceRoot, defaultInstanceRoot))
    return {
      code: ISOLATED_WORKER_START_REJECTED,
      reason:
        'instance root resolves to the production runtime instances directory',
    };
  if (
    !isIdentityAuthorized({
      accountId,
      characterId,
      accountAllowlist,
      characterAllowlist,
    })
  )
    return {
      code: ISOLATED_WORKER_START_REJECTED,
      reason: `account ${String(accountId ?? '')}/character ${String(characterId ?? '')} is not in the isolated automation allowlist`,
    };
  return null;
}

// Automation recovery (boot restore + 30s reconcile) is disabled entirely in
// isolated-test mode. Production-derived desired_running rows are not intent.
export function automationRecoveryCandidates(candidates, { runtimeMode } = {}) {
  if (isIsolatedTestMode(runtimeMode)) return [];
  return Array.isArray(candidates) ? candidates : [];
}
