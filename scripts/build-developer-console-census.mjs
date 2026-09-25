import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capabilities } from '../ops/ro-stack/dev-console/registry.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gaps = JSON.parse(fs.readFileSync(path.join(root, 'docs/project-control/developer-tooling-gap-register.json'), 'utf8'));
const known = new Set(gaps.gaps.map(row => row.id));
const statuses = new Set(['ALREADY_UNIFIED', 'EXISTS_BUT_SCATTERED', 'EXISTS_BROWSER_ONLY',
  'EXISTS_SCRIPT_ONLY', 'EXISTS_SOURCE_ONLY', 'MISSING_DIAGNOSTIC',
  'MISSING_DEVELOPER_ENTRYPOINT', 'NOT_IMPLEMENTED_PRODUCT', 'NOT_APPLICABLE']);
if (new Set(capabilities.map(row => row.id)).size !== capabilities.length ||
    capabilities.some(row => !statuses.has(row.current_status) || row.gap && !known.has(row.gap)))
  throw new Error('CAPABILITY_REGISTRY_INVALID');
const matrix = capabilities.map(row => ({
  CAPABILITY_ID: row.id, DOMAIN: row.domain, DESCRIPTION: row.description,
  CURRENT_TOOL: row.source, CURRENT_ENTRYPOINT: row.command,
  AUTHORITY: row.authority, READ_ONLY_OR_MUTATING: row.mode,
  BROWSER_REQUIRED: row.browser_required, DB_DIRECT: row.db_direct,
  AUDITABLE: row.mode === 'READ_ONLY' || row.audit_required,
  CURRENT_STATUS: row.current_status, REUSEABLE: row.reusable, GAP: row.gap,
  RECOMMENDED_CONSOLE_COMMAND: row.command,
}));
const output = path.join(root, 'docs/project-control/developer-console-capability-matrix.json');
fs.writeFileSync(output, JSON.stringify({ schema: 'developer-console-capability-matrix-v1',
  count: matrix.length, unclassified: 0, capabilities: matrix }, null, 2) + '\n');
console.log(`CAPABILITY_CENSUS=${matrix.length} UNCLASSIFIED_CAPABILITY=0`);
