import { closeSync, openSync, readSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const archive =
  process.argv[2] ??
  'C:\\Program Files (x86)\\Gravity\\RagnarokOnline\\data.grf';
const filter = new RegExp(process.argv[3] ?? '\\.(wav|act|spr)$', 'i');
const fd = openSync(archive, 'r');

function readAt(length, position) {
  const buffer = Buffer.alloc(length);
  const count = readSync(fd, buffer, 0, length, position);
  if (count !== length) throw new Error('GRF 讀取不足：' + position);
  return buffer;
}

try {
  const header = readAt(46, 0);
  const signature = header.subarray(0, 15).toString('ascii').split('\0')[0];
  if (!['Master of Magic', 'Event Horizon'].includes(signature))
    throw new Error('GRF 標頭不符');
  const version = header.readUInt32LE(42);
  const tablePosition =
    46 + header.readUInt32LE(30) + (version >= 0x300 ? 4 : 0);
  const tableHeader = readAt(8, tablePosition);
  const compressedSize = tableHeader.readUInt32LE(0);
  const uncompressedSize = tableHeader.readUInt32LE(4);
  const table = inflateSync(readAt(compressedSize, tablePosition + 8));
  if (table.length !== uncompressedSize) throw new Error('GRF 索引長度不符');
  const decoder = new TextDecoder('euc-kr');
  let offset = 0;
  let count = 0;
  while (offset < table.length) {
    const end = table.indexOf(0, offset);
    if (end < 0 || end + 18 > table.length) break;
    const nameBytes = table.subarray(offset, end);
    const name = decoder.decode(nameBytes);
    offset = end + 1;
    const compressed = table.readUInt32LE(offset);
    const aligned = table.readUInt32LE(offset + 4);
    const size = table.readUInt32LE(offset + 8);
    const type = table[offset + 12];
    const dataOffset = table.readUInt32LE(offset + 13);
    offset += 17;
    if (filter.test(name)) {
      process.stdout.write(
        name +
          '\t' +
          compressed +
          '\t' +
          aligned +
          '\t' +
          size +
          '\t' +
          type +
          '\t' +
          dataOffset +
          (process.env.RO_GRF_SHOW_HEX === '1'
            ? '\t' + Buffer.from(nameBytes).toString('hex')
            : '') +
          '\n',
      );
      count += 1;
    }
  }
  process.stderr.write('GRF_INDEX_MATCHES=' + count + '\n');
} finally {
  closeSync(fd);
}
