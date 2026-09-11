import { readFile } from 'node:fs/promises';

const path =
  process.argv[2] ??
  'C:\\Program Files (x86)\\Gravity\\RagnarokOnline\\System\\iteminfo_new.lub';
const target = Number(process.argv[3] ?? 13415);
const bytes = await readFile(path);
let offset = 0;

function byte() {
  return bytes[offset++];
}
function uint32() {
  const value = bytes.readUInt32LE(offset);
  offset += 4;
  return value;
}
function number() {
  const value = bytes.readDoubleLE(offset);
  offset += 8;
  return value;
}
function string() {
  const size = uint32();
  if (!size) return null;
  const value = bytes.subarray(offset, offset + size - 1);
  offset += size;
  return value;
}
function text(value) {
  if (!value) return null;
  for (const encoding of ['utf-8', 'euc-kr', 'gbk']) {
    const decoded = new TextDecoder(encoding).decode(value);
    if (!decoded.includes('\ufffd')) return decoded;
  }
  return value.toString('hex');
}
function prototype(depth = 0) {
  const prototypeOffset = offset;
  string();
  uint32();
  uint32();
  offset += 4;
  const instructionCount = uint32();
  offset += instructionCount * 4;
  const constants = [];
  const constantCount = uint32();
  for (let index = 0; index < constantCount; index += 1) {
    const type = byte();
    if (type === 0) constants.push({ type: 'nil', value: null });
    else if (type === 1) constants.push({ type: 'boolean', value: Boolean(byte()) });
    else if (type === 3) constants.push({ type: 'number', value: number() });
    else if (type === 4) {
      const value = string();
      constants.push({
        type: 'string',
        value: text(value),
        hex: value?.toString('hex') ?? '',
      });
    } else
      throw new Error(
        `unknown Lua constant ${type} at ${offset - 1}; prototype ${prototypeOffset}; depth ${depth}; index ${index}/${constantCount}`,
      );
  }
  const matches = constants
    .map((constant, index) => ({ constant, index }))
    .filter(({ constant }) => constant.type === 'number' && constant.value === target);
  for (const match of matches) {
    console.log(
      JSON.stringify(
        {
          target,
          depth,
          constantIndex: match.index,
          nearby: constants.slice(Math.max(0, match.index - 20), match.index + 21),
        },
        null,
        2,
      ),
    );
  }
  const childCount = uint32();
  for (let index = 0; index < childCount; index += 1) prototype(depth + 1);
  const lineInfoCount = uint32();
  offset += lineInfoCount * 4;
  const localCount = uint32();
  for (let index = 0; index < localCount; index += 1) {
    string();
    offset += 8;
  }
  const upvalueCount = uint32();
  for (let index = 0; index < upvalueCount; index += 1) string();
}

if (bytes.toString('ascii', 1, 4) !== 'Lua' || bytes[4] !== 0x51)
  throw new Error('Only Lua 5.1 bytecode is supported');
offset = 12;
prototype();
