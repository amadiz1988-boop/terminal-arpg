import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const FIRST_PROMOTION = 'FIRST_GITHUB_FIRST_PROMOTION';
export const LEGACY_MODE = 'LEGACY_PRE_GITHUB_FIRST';
export const UNKNOWN_SHA = 'UNRESOLVED_LEGACY';
export const consumedPath = '.local/ro-stack/github-first-bootstrap-consumed.json';
export const pendingPath = '.local/ro-stack/first-github-first-promotion.pending.json';
export const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();
// Governance JSON is UTF-8 without BOM. Invalid bytes throw instead of becoming
// U+FFFD; a retained BOM makes JSON.parse fail, matching the PowerShell reader.
const strictUtf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
export const decodeGovernanceJson = bytes => JSON.parse(strictUtf8.decode(bytes));
export const readJson = file => decodeGovernanceJson(fs.readFileSync(file));
export function boundedPath(root, relative) {
  if (typeof relative !== 'string' || /[\\:\x00-\x1f]/.test(relative) || path.isAbsolute(relative) ||
      relative.split('/').some(x => !x || x === '.' || x === '..')) throw Error('INVALID_BASELINE_PATH');
  let cursor = path.resolve(root);
  if (fs.lstatSync(cursor).isSymbolicLink()) throw Error('BASELINE_REPARSE_ROOT');
  for (const part of relative.split('/')) {
    cursor = path.join(cursor, part);
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) throw Error('BASELINE_REPARSE_PATH');
  }
  return cursor;
}
export function legacyIdentity(state) {
  return state?.schema_version === 2 && state.baseline_mode === LEGACY_MODE &&
    state.historical_provenance === 'UNRESOLVED' &&
    state.current_web_git_sha === UNKNOWN_SHA && state.current_native_git_sha === UNKNOWN_SHA &&
    state.legacy_bootstrap_available === true && /^LEGACY_BOOTSTRAP_[a-f0-9]{16}$/.test(state.current_deploy_id || '');
}
export function verifyLegacyBaseline(root, state) {
  try {
    if (!legacyIdentity(state) || fs.existsSync(boundedPath(root, consumedPath))) return { pass: false, rollbackReady: false };
    const pinned = (file, sha) => /^[A-Fa-f0-9]{64}$/.test(sha || '') && digest(boundedPath(root, file)) === sha.toUpperCase();
    if (!pinned(state.current_web_artifact_manifest, state.current_web_manifest_sha256) ||
        !pinned(state.accepted_capability_manifest, state.accepted_capability_manifest_sha256)) return { pass: false, rollbackReady: false };
    const manifest = readJson(boundedPath(root, state.current_web_artifact_manifest));
    const capabilities = readJson(boundedPath(root, state.accepted_capability_manifest));
    if (!manifest.files?.length || !state.native_binaries?.length || !capabilities.capabilities?.length ||
        JSON.stringify(capabilities.capabilities.map(x => x.id).sort()) !== JSON.stringify([...state.accepted_capabilities].sort())) return { pass: false, rollbackReady: false };
    const entries = [...manifest.files, ...state.native_binaries];
    if (new Set(entries.map(x => x.path.toLowerCase())).size !== entries.length) return { pass: false, rollbackReady: false };
    const pass = entries.every(x => pinned(x.path, x.sha256));
    const rollback = state.legacy_rollback;
    const rollbackReady = !!rollback && pinned(rollback.web_manifest, state.current_web_manifest_sha256) &&
      entries.every(x => pinned(`${rollback.root}/${x.path}`, x.sha256));
    return { pass, rollbackReady, files: manifest.files, capabilityCount: capabilities.capabilities.length };
  } catch { return { pass: false, rollbackReady: false }; }
}
export function firstPromotionEvidence(evidence, web, native) {
  return evidence?.web_git_sha === web && evidence.native_git_sha === native &&
    ['web_regression', 'native_build', 'native_regression', 'procdump_gate', 'runtime_health_gate']
      .every(key => evidence[key]?.pass === true && typeof evidence[key]?.evidence === 'string' && evidence[key].evidence.length > 0);
}
export function transitionedState(state, receipt, receiptPath) {
  return { schema_version: 2, baseline_mode: 'GITHUB_FIRST', historical_provenance: 'GITHUB_FIRST_RECEIPT',
    current_deploy_id: receipt.deploy_id, current_web_git_sha: receipt.web_git_sha,
    current_native_git_sha: receipt.native_git_sha, last_deploy_receipt: receiptPath,
    production_drift: 'CLOSED', accepted_capabilities: receipt.accepted_capabilities || [],
    legacy_bootstrap_available: false, legacy_bootstrap_origin: state.legacy_bootstrap_origin || state.current_deploy_id };
}
