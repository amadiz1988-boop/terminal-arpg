import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const pinned = '51de1ddfc4449ae5217f6886de702f87ca934030';
const openKore = resolve('.local/ro-stack/openkore');
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: openKore, encoding: 'utf8' }).trim(), pinned);

const census = await readFile('docs/openkore-reference/mature-capability-census-v1.md', 'utf8');
const predicates = await readFile('docs/openkore-reference/condition-key-census-v1.md', 'utf8');
const rows = census.split(/\r?\n/).filter((line) => /^\| [HCR]\d{2} /.test(line));
const statuses = ['ALIGNED', 'PARTIAL', 'MISSING', 'NOT_IMPLEMENTED', 'NOT_APPLICABLE', 'GI_EXPLICIT_OVERRIDE'];
const ids = new Set();
for (const row of rows) {
  const cells = row.split('|').slice(1, -1).map((cell) => cell.trim());
  assert.equal(cells.length, 7, `census field count: ${row}`);
  assert.ok(cells.every(Boolean), `census blank field: ${row}`);
  const id = cells[0].split(' ')[0];
  assert.ok(!ids.has(id), `duplicate capability: ${id}`);
  ids.add(id);
  assert.ok(statuses.includes(cells[5]), `unclassified capability: ${id}`);
  const sourceRefs = [...cells[1].matchAll(/`((?:src|control)\/[^`]+)`/g)]
    .map((match) => match[1].replace(/:\d.*$/, ''));
  if (sourceRefs.length === 0)
    assert.match(cells[1], /NO_MATURE_REFERENCE=YES/, `missing pinned source: ${id}`);
  for (const source of sourceRefs)
    await access(resolve(openKore, source));
  if (cells[5] === 'NOT_IMPLEMENTED')
    assert.match(cells[6], /Stage|milestone|gate|HOLD|later/i, `missing later-stage mapping: ${id}`);
}
assert.equal(rows.length, 59);
const predicateRows = predicates.split(/\r?\n/).filter((line) => /^\| (self|player|monster)\./.test(line));
assert.equal(predicateRows.length, 135);
const predicateKeys = predicateRows.map((line) => line.split('|')[1].trim());
assert.equal(new Set(predicateKeys).size, 135);
for (const row of predicateRows) {
  const cells = row.split('|').slice(1, -1).map((cell) => cell.trim());
  assert.equal(cells.length, 7);
  assert.ok(statuses.includes(cells[5]), `unclassified predicate: ${cells[0]}`);
}
console.log(`OPENKORE_CENSUS_SOURCE_PASS capabilities=${rows.length} predicates=${predicateRows.length}`);
if (process.argv.includes('--closure')) {
  const counts = Object.fromEntries(statuses.map((status) => [status, 0]));
  for (const row of rows)
    counts[row.split('|').slice(1, -1)[5].trim()]++;
  const outstanding = counts.PARTIAL + counts.MISSING;
  const discoveryComplete = /^DISCOVERY_COMPLETE = YES$/m.test(census);
  const behaviorParityComplete = /^BEHAVIOR_PARITY_COMPLETE = YES$/m.test(census);
  if (outstanding || !discoveryComplete || !behaviorParityComplete) {
    console.error(`OPENKORE_CENSUS_CLOSURE_BLOCKED partial=${counts.PARTIAL} missing=${counts.MISSING} discoveryComplete=${discoveryComplete} behaviorParityComplete=${behaviorParityComplete}`);
    process.exitCode = 2;
  } else {
    console.log(`OPENKORE_CENSUS_CLOSURE_PASS capabilities=${rows.length} predicates=${predicateRows.length}`);
  }
}
