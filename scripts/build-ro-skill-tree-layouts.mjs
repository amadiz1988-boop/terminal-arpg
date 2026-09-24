import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const source = process.argv[2];
const destination =
  process.argv[3] ?? 'ops/ro-stack/dashboard/skill-tree-layouts.json';
const expectedHash =
  '40d199be7b2cf734dbb78064c36b4c1bc88505e7890afeeb855b1eca20a437f8';
if (!source) throw new Error('Provide an extracted SkillTreeView.lub path');
const bytes = await readFile(source);
const hash = createHash('sha256').update(bytes).digest('hex');
if (hash !== expectedHash) throw new Error(`Unreviewed Client layout: ${hash}`);
if (bytes.toString('binary', 0, 4) !== '\x1bLua' || bytes[4] !== 0x51)
  throw new Error('Expected Lua 5.1 bytecode');
if (
  bytes[6] !== 1 ||
  bytes[7] !== 4 ||
  bytes[8] !== 4 ||
  bytes[9] !== 4 ||
  bytes[10] !== 8
)
  throw new Error('Unexpected Lua bytecode sizes');
let offset = 12;
const u32 = () => {
  const value = bytes.readUInt32LE(offset);
  offset += 4;
  return value;
};
const luaString = () => {
  const size = u32();
  if (!size) return null;
  const value = bytes.subarray(offset, offset + size - 1).toString('latin1');
  offset += size;
  return value;
};
function prototype() {
  luaString();
  u32();
  u32();
  offset += 4;
  const instructions = Array.from({ length: u32() }, u32);
  const constants = Array.from({ length: u32() }, () => {
    const type = bytes[offset++];
    if (type === 0) return null;
    if (type === 1) return bytes[offset++] !== 0;
    if (type === 3) {
      const value = bytes.readDoubleLE(offset);
      offset += 8;
      return value;
    }
    if (type === 4) return luaString();
    throw new Error(`Unsupported Lua constant ${type}`);
  });
  const children = Array.from({ length: u32() }, prototype);
  const lineCount = u32();
  offset += lineCount * 4;
  for (let count = u32(); count; count--) {
    luaString();
    offset += 8;
  }
  for (let count = u32(); count; count--) luaString();
  return { instructions, constants, children };
}
const program = prototype();
if (offset !== bytes.length || program.children.length)
  throw new Error('Unexpected Lua prototype structure');

// Evaluate only the literal table-building instructions. Later calls rename
// Client tabs and are intentionally outside the layout extraction boundary.
const globals = Object.create(null);
globals.JOBID = new Proxy(Object.create(null), {
  get: (_, key) => String(key),
});
globals.SKID = new Proxy(Object.create(null), { get: (_, key) => String(key) });
const registers = [];
const rk = (value) =>
  value >= 256 ? program.constants[value - 256] : registers[value];
for (const instruction of program.instructions) {
  const opcode = instruction & 63;
  const a = (instruction >>> 6) & 255;
  const b = (instruction >>> 23) & 511;
  const c = (instruction >>> 14) & 511;
  const bx = instruction >>> 14;
  if (opcode === 28 || opcode === 30) break;
  if (opcode === 1) registers[a] = program.constants[bx];
  else if (opcode === 5) registers[a] = globals[program.constants[bx]];
  else if (opcode === 6) registers[a] = registers[b]?.[rk(c)];
  else if (opcode === 7) globals[program.constants[bx]] = registers[a];
  else if (opcode === 9) registers[a][rk(b)] = rk(c);
  else if (opcode === 10) registers[a] = Object.create(null);
  else throw new Error(`Unsupported layout instruction ${opcode}`);
}
const jobs = globals.SKILL_TREEVIEW_FOR_JOB;
if (
  Object.keys(jobs ?? {}).length !== 79 ||
  jobs.JT_ARCHER?.[2] !== 'AC_DOUBLE' ||
  jobs.JT_ARCHER?.[17] !== 'AC_CONCENTRATION' ||
  jobs.JT_HUNTER?.[0] !== 'HT_BEASTBANE'
)
  throw new Error('Client layout validation failed');
const result = {
  columns: 7,
  sourceArchive: 'data.grf',
  sourcePath: 'data\\luafiles514\\lua files\\skillinfoz\\skilltreeview.lub',
  sourceSha256: hash,
  jobs,
};
await writeFile(destination, `${JSON.stringify(result, null, 2)}\n`);
console.log(
  `Wrote ${Object.keys(jobs).length} original Client skill layouts to ${destination}`,
);
