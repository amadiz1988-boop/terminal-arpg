import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const sourcePath = 'ops/ro-stack/dashboard/app.js';
const source = await readFile(sourcePath, 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`missing function: ${name}`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unclosed function: ${name}`);
}

const context = {};
vm.createContext(context);
vm.runInContext(
  `${extractFunction('damageEvent')}\n${extractFunction('shouldRenderPlayerLog')}`,
  context,
);

const cases = [
  ['ATTACK without damage', 'You attack Monster Poring (1002)', false],
  ['ATTACK with zero damage', 'You attack Monster Poring (1002) (Dmg: 0)', false],
  ['HIT with authoritative damage', 'You attack Monster Poring (1002) (Dmg: 42)', true],
  ['CRITICAL with authoritative damage', 'You attack Monster Poring (1002) (Dmg: 42!)', true],
  ['KILL', 'Target Monster Poring (1002) died', true],
  ['LOOT_ACQUIRED', 'Item added to inventory: Jellopy (909) x 1', true],
];

const results = cases.map(([name, line, expected]) => ({
  name,
  expected,
  actual: context.shouldRenderPlayerLog(line),
}));
const spamRows = Array.from({ length: 100 }, () =>
  context.shouldRenderPlayerLog('You attack Monster Poring (1002)'),
).filter(Boolean).length;
const filterPathPresent = source.includes(
  'const playerLogLines = lines.filter(shouldRenderPlayerLog);',
);
const eventEvidencePreserved = source.includes(
  'eventLines.push(...lines);',
);
const pass =
  filterPathPresent &&
  eventEvidencePreserved &&
  spamRows === 0 &&
  results.every((result) => result.actual === result.expected);

console.log(
  JSON.stringify(
    { pass, results, attackOnlySpamRows: spamRows, filterPathPresent, eventEvidencePreserved },
    null,
    2,
  ),
);
if (!pass) process.exitCode = 1;
