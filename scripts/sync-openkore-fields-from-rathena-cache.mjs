import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync, inflateSync } from 'node:zlib';

const defaultMaps = [
  'iz_int',
  'iz_int01',
  'iz_int02',
  'iz_int03',
  'iz_int04',
  'int_land',
  'int_land01',
  'int_land02',
  'int_land03',
  'int_land04',
  'izlude',
  'izlude_a',
  'izlude_b',
  'izlude_c',
  'izlude_d',
  'iz_ac01',
  'iz_ac01_a',
  'iz_ac01_b',
  'iz_ac01_c',
  'iz_ac01_d',
  'new_1-3',
];
const requestedMaps = process.argv.slice(2);
const mapNames = requestedMaps.length ? requestedMaps : defaultMaps;
const cachePaths = [
  '.local/ro-stack/rathena/db/import/map_cache.dat',
  '.local/ro-stack/rathena/db/re/map_cache.dat',
  '.local/ro-stack/rathena/db/map_cache.dat',
];
const fld2CellByGatType = Uint8Array.from([1, 0, 4, 5, 6, 10, 8]);

function parseCache(bytes) {
  const maps = new Map();
  const mapCount = bytes.readUInt16LE(4);
  let offset = 8;
  for (let index = 0; index < mapCount; index += 1) {
    const name = bytes
      .subarray(offset, offset + 12)
      .toString('ascii')
      .replace(/\0.*$/, '');
    const width = bytes.readInt16LE(offset + 12);
    const height = bytes.readInt16LE(offset + 14);
    const compressedLength = bytes.readInt32LE(offset + 16);
    const compressedStart = offset + 20;
    const compressedEnd = compressedStart + compressedLength;
    maps.set(name, {
      name,
      width,
      height,
      compressed: bytes.subarray(compressedStart, compressedEnd),
    });
    offset = compressedEnd;
  }
  return maps;
}

const caches = [];
for (const path of cachePaths) {
  caches.push({ path, maps: parseCache(await readFile(path)) });
}

for (const mapName of mapNames) {
  const source = caches.find(({ maps }) => maps.has(mapName));
  if (!source) throw new Error(`Map is absent from rAthena caches: ${mapName}`);
  const map = source.maps.get(mapName);
  const rawCells = inflateSync(map.compressed);
  if (rawCells.length !== map.width * map.height)
    throw new Error(`Decoded cell count is invalid for ${mapName}`);

  const fld2Cells = Buffer.alloc(rawCells.length);
  for (let index = 0; index < rawCells.length; index += 1) {
    const gatType = rawCells[index];
    fld2Cells[index] = fld2CellByGatType[gatType] ?? 0;
  }
  const fld2 = Buffer.alloc(4 + fld2Cells.length);
  fld2.writeUInt16LE(map.width, 0);
  fld2.writeUInt16LE(map.height, 2);
  fld2Cells.copy(fld2, 4);
  const compressedFld2 = gzipSync(fld2, { level: 9 });

  await writeFile(
    `.local/ro-stack/openkore/fields/${mapName}.fld2.gz`,
    compressedFld2,
  );
  await writeFile(`.local/ro-stack/openkore/fields/${mapName}.dist`, '');
  await writeFile(`.local/ro-stack/openkore/fields/${mapName}.weight`, '');
  await writeFile(`public/ro/maps/${mapName}.fld2.bin`, fld2);
  await writeFile(`public/ro/maps/${mapName}.fld2.gz`, compressedFld2);
  console.log(
    `${mapName}: ${map.width}x${map.height} from ${source.path}`,
  );
}
