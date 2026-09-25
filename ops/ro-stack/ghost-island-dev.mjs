#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capabilities } from './dev-console/registry.mjs';
import * as provider from './dev-console/providers.mjs';
import { runDeveloperAdminAction } from './developer-admin-action.mjs';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const errors = new Set(['NOT_FOUND', 'STALE', 'NOT_AUTHORIZED', 'NOT_ELIGIBLE',
  'AUTHORITY_UNAVAILABLE', 'RUNTIME_UNHEALTHY', 'ACTION_REJECTED', 'TOOLING_MISSING', 'UNKNOWN']);
const help = () => ({
  usage: 'node ops/ro-stack/ghost-island-dev.mjs <command> [--json]',
  discovery: ['help', 'capabilities [domain]'],
  diagnostics: ['runtime health|processes|identity|logs <login|char|map|dashboard> [--char <id>]',
    'deployment state|receipt', 'player inspect <charId>|fleet|quarantine|commands <charId>',
    'events recent <charId>', 'incident procdump|latest', 'config diff'],
  action: ['action recover-quarantined <charId> --preflight',
    'action recover-quarantined <charId> --execute'],
});
const classify = error => {
  if (errors.has(error?.code)) return error.code;
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError' ||
      ['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND'].includes(error?.cause?.code)) return 'AUTHORITY_UNAVAILABLE';
  return 'UNKNOWN';
};
const envelope = (status, authority, target, source, result, extra = {}) => ({
  STATUS: status, AUTHORITY: authority, TIMESTAMP: new Date().toISOString(),
  TARGET: target, SOURCE: source, FRESHNESS: extra.freshness ?? 'SAMPLED_NOW', RESULT: result,
  ...Object.fromEntries(Object.entries(extra).filter(([key]) => key !== 'freshness')),
});
const accepted = (args, count) => args.length === count;
const invalid = () => { const error = new Error('invalid_arguments'); error.code = 'NOT_ELIGIBLE'; throw error; };

export async function runConsole(raw, deps = {}) {
  const args = raw.filter(arg => arg !== '--json');
  const [domain, command, target] = args;
  try {
    if (!domain || domain === 'help') {
      if (domain && !accepted(args, 1)) invalid();
      return envelope('OK', 'console registry', 'help', 'ghost-island-dev', help());
    }
    if (domain === 'capabilities') {
      if (args.length > 2) invalid();
      const filtered = command ? capabilities.filter(item => item.domain === command) : capabilities;
      if (command && !filtered.length) invalid();
      return envelope('OK', 'console registry', command ?? 'all', 'dev-console/registry.mjs', filtered);
    }
    let result, authority, source, freshness = 'SAMPLED_NOW';
    const options = deps.providers ?? {};
    if (domain === 'runtime' && command === 'health' && accepted(args, 2)) {
      result = await provider.runtimeHealth(options); authority = 'canonical runtime';
      if (!result.healthy) return envelope('RUNTIME_UNHEALTHY', authority, 'runtime', result.source, result);
    } else if (domain === 'runtime' && command === 'processes' && accepted(args, 2)) {
      result = provider.runtimeProcesses(options); authority = 'canonical runtime';
    } else if (domain === 'runtime' && command === 'identity' && accepted(args, 2)) {
      result = provider.runtimeIdentity(options); authority = 'Windows process and canonical runtime';
      if (!result.allMatched) return envelope('STALE', authority, 'runtime', result.source, result);
    } else if (domain === 'runtime' && command === 'logs' &&
      (accepted(args, 3) || (accepted(args, 5) && args[3] === '--char'))) {
      result = provider.runtimeLogs(target, { ...options, charId: args[4] ?? null }); authority = 'canonical runtime logs';
    } else if (domain === 'deployment' && command === 'state' && accepted(args, 2)) {
      result = provider.deploymentState(options); authority = 'Production governance records';
    } else if (domain === 'deployment' && command === 'receipt' && accepted(args, 2)) {
      result = provider.deploymentReceipt(options); authority = 'Production receipt';
    } else if (domain === 'player' && command === 'inspect' && accepted(args, 3)) {
      result = await provider.playerInspect(target, options); authority = 'Dashboard Admin read model';
      freshness = result.freshness ?? 'UNKNOWN';
    } else if (domain === 'player' && command === 'fleet' && accepted(args, 2)) {
      result = await provider.playerFleet(options); authority = 'Dashboard Admin read model';
      if (!result.complete) return envelope('STALE', authority, 'fleet', result.source, result, { freshness: 'PARTIAL_ROSTER_200' });
    } else if (domain === 'player' && command === 'quarantine' && accepted(args, 2)) {
      result = await provider.playerQuarantine(options); authority = 'Dashboard Admin read model';
      if (!result.complete) return envelope('STALE', authority, 'quarantine', result.source, result, { freshness: 'PARTIAL_ROSTER_200' });
    } else if (domain === 'player' && command === 'commands' && accepted(args, 3)) {
      result = provider.fixedDbRead('commands', target, options); authority = 'Native command ledger';
    } else if (domain === 'events' && command === 'recent' && accepted(args, 3)) {
      result = provider.fixedDbRead('events', target, options); authority = 'Event Ledger';
    } else if (domain === 'incident' && command === 'procdump' && accepted(args, 2)) {
      result = provider.procdumpState(options); authority = 'runtime sentinel';
    } else if (domain === 'incident' && command === 'latest' && accepted(args, 2)) {
      result = provider.latestIncident(options); authority = 'runtime incident observer';
    } else if (domain === 'config' && command === 'diff' && accepted(args, 2)) {
      result = provider.configDiff({ ...options, sourceRoot }); authority = 'source and Production config files';
    } else if (domain === 'action' && command === 'recover-quarantined' && accepted(args, 4) &&
      ['--preflight', '--execute'].includes(args[3])) {
      // All authorization, admission, audit and Native confirmation stay in the existing path.
      const action = deps.action ?? runDeveloperAdminAction;
      result = await action(['recover_quarantined_to_idle', '--char-id', target,
        ...(args[3] === '--preflight' ? ['--preflight'] : [])]);
      const ok = ['READ_ONLY_PREFLIGHT', 'CONFIRMED'].includes(result.result);
      return envelope(ok ? 'OK' : 'ACTION_REJECTED', 'Dashboard Admin → Native', target,
        'ops/ro-stack/developer-admin-action.mjs', result, {
          REQUEST_ID: result.requestId ?? null, PRECHECK: args[3] === '--preflight' ? 'ROSTER_ONLY' : 'REQUESTED_CANONICAL_ADMISSION',
          ACTION: 'recover_quarantined_to_idle', CONFIRMATION: result.result,
          AUDIT_REF: result.commandId ?? result.requestId ?? null,
          freshness: result.timestamp ?? 'SAMPLED_NOW',
        });
    } else invalid();
    source = result.source;
    return envelope('OK', authority, target ?? command ?? domain, source, result, { freshness });
  } catch (error) {
    const code = classify(error);
    return envelope(code, 'UNRESOLVED', target ?? command ?? domain ?? 'help',
      'ghost-island-dev', { error: code, detail: errors.has(error?.code) ? error.message : 'unclassified_failure' });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = await runConsole(process.argv.slice(2));
  if (process.argv.includes('--json')) console.log(JSON.stringify(output));
  else for (const [key, value] of Object.entries(output))
    console.log(`${key} = ${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}`);
  if (!['OK'].includes(output.STATUS)) process.exitCode = 1;
}
