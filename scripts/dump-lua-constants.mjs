import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) throw new Error('用法：node scripts/dump-lua-constants.mjs <Lua 5.1 byte碼>');
const textEncoding = process.argv[3] ?? 'utf8';
const decoder = new TextDecoder(textEncoding);

const bytes = readFileSync(file);
let offset = 0;
const take = (length) => {
  const value = bytes.subarray(offset, offset + length);
  offset += length;
  return value;
};
const byte = () => bytes[offset++];

if (take(4).toString('binary') !== '\x1bLua') throw new Error('不是 Lua byte碼');
const version = byte();
const format = byte();
const littleEndian = byte() === 1;
const intSize = byte();
const sizeTSize = byte();
const instructionSize = byte();
const numberSize = byte();
byte();

if (version !== 0x51 || format !== 0 || !littleEndian)
  throw new Error('目前只支援標準 little-endian Lua 5.1 byte碼');
if (intSize !== 4 || instructionSize !== 4 || numberSize !== 8)
  throw new Error('不支援的 Lua 5.1 數值尺寸');

const unsigned = (size) => {
  let value = 0n;
  for (let index = 0; index < size; index += 1)
    value |= BigInt(byte()) << BigInt(index * 8);
  return Number(value);
};
const integer = () => unsigned(intSize);
const luaString = () => {
  const length = unsigned(sizeTSize);
  if (!length) return null;
  return take(length - 1).toString('latin1') + (byte(), '');
};
const luaNumber = () => {
  const value = bytes.readDoubleLE(offset);
  offset += 8;
  return value;
};

const constants = [];
function prototype(path) {
  luaString();
  integer();
  integer();
  take(4);
  take(integer() * instructionSize);

  const constantCount = integer();
  for (let index = 0; index < constantCount; index += 1) {
    const type = byte();
    let value = null;
    if (type === 1) value = byte() === 1;
    else if (type === 3) value = luaNumber();
    else if (type === 4) value = luaString();
    else if (type !== 0) throw new Error(`未知常數型別 ${type}`);
    constants.push({ path, index, type, value });
  }

  const childCount = integer();
  for (let index = 0; index < childCount; index += 1)
    prototype(`${path}.${index}`);

  take(integer() * intSize);
  const localCount = integer();
  for (let index = 0; index < localCount; index += 1) {
    luaString();
    integer();
    integer();
  }
  const upvalueCount = integer();
  for (let index = 0; index < upvalueCount; index += 1) luaString();
}

prototype('0');
for (const constant of constants) {
  if (constant.type === 4) {
    const raw = Buffer.from(constant.value, 'latin1');
    constant.value = decoder.decode(raw);
    constant.hex = raw.toString('hex');
  }
  process.stdout.write(`${JSON.stringify(constant)}\n`);
}
