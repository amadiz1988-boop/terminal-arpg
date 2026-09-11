import { readFile, writeFile } from 'node:fs/promises';

const [source, target] = process.argv.slice(2);
if (!source || !target)
  throw new Error('Usage: node build-openkore-renewal-portals.mjs <source> <target>');

const renewalIzlude = [
  'iz_int 27 30 iz_int 51 30',
  'iz_int 47 30 iz_int 22 30',
  'iz_int 56 15 int_land 85 107',
  'iz_int01 27 30 iz_int01 51 30',
  'iz_int01 47 30 iz_int01 22 30',
  'iz_int01 56 15 int_land01 85 107',
  'iz_int02 27 30 iz_int02 51 30',
  'iz_int02 47 30 iz_int02 22 30',
  'iz_int02 56 15 int_land02 85 107',
  'iz_int03 27 30 iz_int03 51 30',
  'iz_int03 47 30 iz_int03 22 30',
  'iz_int03 56 15 int_land03 85 107',
  'iz_int04 27 30 iz_int04 51 30',
  'iz_int04 47 30 iz_int04 22 30',
  'iz_int04 56 15 int_land04 85 107',
  'int_land 49 57 izlude 196 209 0 c r0 c r0 c r2 c',
  'int_land01 49 57 izlude_a 196 209 0 c r0 c r0 c r2 c',
  'int_land02 49 57 izlude_b 196 209 0 c r0 c r0 c r2 c',
  'int_land03 49 57 izlude_c 196 209 0 c r0 c r0 c r2 c',
  'int_land04 49 57 izlude_d 196 209 0 c r0 c r0 c r2 c',
  'prt_fild08 371 212 izlude 24 98',
  'izlude 20 98 prt_fild08 367 212',
  'izlude 110 182 izlude_in 65 87',
  'izlude 52 172 izlude_in 74 161',
  'izlude_in 116 46 izlude 128 98',
  'izlude_in 65 84 izlude 112 179',
  'izlude_in 74 158 izlude 52 168',
  'izlude_in 43 169 izlude_in 63 169',
  'izlude_in 87 169 izlude_in 111 169',
  'izlude_in 108 169 izlude_in 84 169',
  'izlude_in 148 127 izlude 210 161',
  'izlude_in 172 139 izlude_in 172 161',
  'izlude_in 172 158 izlude_in 172 136',
  'izlude_in 172 116 izlude_in 172 94',
  'izlude_in 171 97 izlude_in 172 119',
  'izlude 125 257 iz_ac01 99 29',
  'izlude 130 257 iz_ac01 99 29',
  'izlude_a 125 257 iz_ac01_a 99 29',
  'izlude_a 130 257 iz_ac01_a 99 29',
  'izlude_b 125 257 iz_ac01_b 99 29',
  'izlude_b 130 257 iz_ac01_b 99 29',
  'izlude_c 125 257 iz_ac01_c 99 29',
  'izlude_c 130 257 iz_ac01_c 99 29',
  'izlude_d 125 257 iz_ac01_d 99 29',
  'izlude_d 130 257 iz_ac01_d 99 29',
  'iz_ac01 100 24 izlude 127 253',
  'iz_ac01_a 100 24 izlude_a 127 253',
  'iz_ac01_b 100 24 izlude_b 127 253',
  'iz_ac01_c 100 24 izlude_c 127 253',
  'iz_ac01_d 100 24 izlude_d 127 253',
  'iz_ac01 78 25 iz_ac02 207 27',
  'iz_ac01 122 25 iz_ac02 207 27',
  'iz_ac02 198 27 iz_ac01 78 28',
  'iz_ac02 217 27 iz_ac01 122 28',
  'iz_ac01 45 80 new_1-3 95 171 0 c r0 c',
  'iz_ac01_a 45 80 new_1-3 95 171 0 c r0 c',
  'iz_ac01_b 45 80 new_1-3 95 171 0 c r0 c',
  'iz_ac01_c 45 80 new_1-3 95 171 0 c r0 c',
  'iz_ac01_d 45 80 new_1-3 95 171 0 c r0 c',
  'new_1-3 96 176 iz_ac01 49 73',
];
const renewalProntera = [
  'prt_fild08 170 378 prontera 156 26',
  'prontera 156 22 prt_fild08 170 375',
  'prontera 237 317 prt_church 100 60',
  'prt_church 100 56 prontera 234 314',
  'prt_church 109 81 prt_church 172 19',
  'prt_church 168 19 prt_church 105 81',
  'prt_church 31 19 prt_church 94 81',
  'prt_church 90 81 prt_church 27 19',
];
const renewalMageRoute = [
  'prontera 22 203 prt_fild05 367 205',
  'prt_fild05 373 205 prontera 26 203',
  'prt_fild05 292 385 mjolnir_09 305 33',
  'mjolnir_09 300 28 prt_fild05 292 382',
  'mjolnir_09 30 249 prt_fild00 380 249',
  'prt_fild00 383 249 mjolnir_09 33 248',
  'prt_fild00 159 383 mjolnir_07 156 19',
  'mjolnir_07 156 16 prt_fild00 159 380',
  'mjolnir_07 17 77 mjolnir_06 380 74',
  'mjolnir_06 383 74 mjolnir_07 20 77',
  'mjolnir_06 265 29 gef_fild00 267 379',
  'gef_fild00 267 382 mjolnir_06 265 32',
  'gef_fild00 40 199 geffen 213 119',
  'geffen 217 119 gef_fild00 46 199',
  'geffen 61 180 geffen_in 162 97',
  'geffen_in 163 94 geffen 65 176',
];
const renewalArcherRoute = [
  'prt_fild08 233 16 moc_fild01 238 378',
  'moc_fild01 239 382 prt_fild08 233 20',
  'moc_fild01 379 162 pay_fild04 20 165',
  'pay_fild04 17 165 moc_fild01 376 162',
  'pay_fild04 194 17 moc_fild02 350 336',
  'moc_fild02 350 339 pay_fild04 194 20',
  'moc_fild02 378 272 pay_gld 20 276',
  'pay_gld 16 276 moc_fild02 374 272',
  'pay_gld 374 149 payon 19 143',
  'payon 16 143 pay_gld 370 149',
  'payon 228 330 pay_arche 81 22',
  'pay_arche 81 18 payon 228 326',
  'pay_arche 145 165 payon_in02 64 60',
  'payon_in02 64 56 pay_arche 141 161',
];
const renewalThiefRoute = [
  'morocc 160 258 prontera 116 72 2000 1 c r2 c r0',
  'morocc 27 294 moc_ruins 156 42',
  'moc_ruins 159 39 morocc 30 290',
  'moc_ruins 54 161 moc_pryd01 192 9',
  'moc_pryd01 195 9 moc_ruins 60 161',
  'moc_pryd01 90 109 moc_prydb1 100 185',
  'moc_prydb1 100 191 moc_pryd01 90 105',
];
const replacementKeys = new Set(
  [...renewalMageRoute, ...renewalArcherRoute, ...renewalThiefRoute].map((line) =>
    line.split(/\s+/).slice(0, 4).join(' '),
  ),
);
const replacementKey = (line) =>
  line.trim().split(/\s+/).slice(0, 4).join(' ');
const sourceLines = (await readFile(source, 'utf8')).split(/\r?\n/);
if (sourceLines.length < 3000)
  throw new Error(`OpenKore tRO portal table is incomplete: ${sourceLines.length}`);
const output = sourceLines.filter(
  (line) =>
    !/^(iz_int(?:0[1-4])?|int_land(?:0[1-4])?|izlude(?:_[a-d])?|izlude_in|iz_ac0[12](?:_[a-d])?|new_1-3)\s/.test(line) &&
    !/^prt_fild08\s+\d+\s+\d+\s+izlude\s/.test(line) &&
    !/^prt_fild08\s+170\s+378\s+prontera\s/.test(line) &&
    !/^prontera\s+156\s+22\s+prt_fild08\s/.test(line) &&
    !/^prontera\s+237\s+317\s+prt_church\s/.test(line) &&
    !/^prt_church\s/.test(line) &&
    !replacementKeys.has(replacementKey(line)),
);
output.push(
  ...renewalIzlude,
  ...renewalProntera,
  ...renewalMageRoute,
  ...renewalArcherRoute,
  ...renewalThiefRoute,
);
await writeFile(target, `${output.join('\r\n')}\r\n`, 'utf8');
console.log(`Renewal portal table: ${output.length} entries`);
