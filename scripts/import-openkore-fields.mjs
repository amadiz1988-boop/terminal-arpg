import { gunzipSync } from 'node:zlib';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const source = join(root, '.local', 'ro-stack', 'openkore', 'fields');
const output = join(root, 'public', 'ro', 'maps');
const fieldAliases = new Map([
  // Locked tRO resnametable: new_1-3.rsw#new_zone03.rsw.
  ['new_1-3', 'new_zone03'],
]);
const maps = [
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
  'new_1-3',
  'prontera',
  'prt_fild08',
  'izlude',
  'izlude_a',
  'izlude_b',
  'izlude_c',
  'izlude_d',
  'izlude_in',
  'iz_ac01',
  'iz_ac01_a',
  'iz_ac01_b',
  'iz_ac01_c',
  'iz_ac01_d',
  'iz_ac02',
  'iz_ac02_a',
  'iz_ac02_b',
  'iz_ac02_c',
  'iz_ac02_d',
  'prt_church',
  'prt_fild05',
  'mjolnir_09',
  'prt_fild00',
  'mjolnir_07',
  'mjolnir_06',
  'gef_fild00',
  'geffen',
  'geffen_in',
  'moc_fild01',
  'pay_fild04',
  'moc_fild02',
  'pay_gld',
  'payon',
  'pay_arche',
  'payon_in02',
  'morocc',
  'moc_fild19',
  'moc_ruins',
  'moc_pryd01',
  'moc_prydb1',
];
await mkdir(output, { recursive: true });

for (const map of maps) {
  const sourceMap = fieldAliases.get(map) ?? map;
  const compressed = await readFile(join(source, `${sourceMap}.fld2.gz`));
  const field = gunzipSync(compressed);
  if (field.length < 4) throw new Error(`${map}: FLD2 header is incomplete`);
  const width = field.readUInt16LE(0),
    height = field.readUInt16LE(2),
    expected = width * height + 4;
  if (!width || !height || field.length !== expected)
    throw new Error(
      `${map}: invalid FLD2 ${width}x${height}, expected ${expected}, got ${field.length}`,
    );
  await writeFile(join(output, `${map}.fld2.bin`), field);
  await writeFile(join(output, `${map}.fld2.gz`), compressed);
  console.log(`${map}: ${width}x${height}, ${field.length} bytes`);
}
