import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const root = process.cwd();
const app = readFileSync(join(root, 'ops', 'ro-stack', 'dashboard', 'app.js'), 'utf8');
const importedMaps = [
  ...readFileSync(join(root, 'scripts', 'import-openkore-fields.mjs'), 'utf8').matchAll(
    /^  '([^']+)',$/gm,
  ),
].map((match) => match[1]);
const expected = new Map([
  ...['iz_int', 'iz_int01', 'iz_int02', 'iz_int03', 'iz_int04', 'izlude', 'izlude_a', 'izlude_b', 'izlude_c', 'izlude_d', 'izlude_in', 'iz_ac01', 'iz_ac01_a', 'iz_ac01_b', 'iz_ac01_c', 'iz_ac01_d', 'iz_ac02', 'iz_ac02_a', 'iz_ac02_b', 'iz_ac02_c', 'iz_ac02_d'].map((map) => [map, 26]),
  ...['int_land', 'int_land01', 'int_land02', 'int_land03', 'int_land04'].map((map) => [map, null]),
  ['new_1-3', 30], ['prontera', 8], ['prt_in', 8], ['prt_fild08', 12],
  ['prt_church', 10], ['prt_fild05', 12], ['mjolnir_09', 31], ['prt_fild00', 5],
  ['mjolnir_07', 31], ['mjolnir_06', 31], ['gef_fild00', 25], ['geffen', 13],
  ['geffen_in', 13], ['moc_fild01', 24], ['moc_fild11', 37], ['pay_fild04', 3],
  ['moc_fild02', 3], ['pay_gld', 66], ['payon', 14], ['pay_arche', 14],
  ['payon_in02', 14], ['pay_dun00', 20], ['morocc', 11], ['moc_para01', 11],
  ['moc_fild19', 37], ['moc_ruins', 52], ['moc_pryd01', 22], ['moc_prydb1', 22],
]);

for (const map of importedMaps)
  assert.ok(expected.has(map), `開放地圖缺少原廠 BGM 查核：${map}`);
for (const [map, track] of expected) {
  const escaped = map.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(
    app,
    new RegExp(`(?:'${escaped}'|${escaped}): ${track === null ? 'null' : `bgmTrack\\(${track}\\)`}`),
    `${map} 的 BGM 映射錯誤`,
  );
}
assert.ok(!app.includes("musicSources[context] ? context : 'title'"));

const manifest = JSON.parse(
  readFileSync(join(root, 'public', 'ro', 'client', 'manifest.json'), 'utf8'),
);
const bgmEntries = manifest.imported.filter((entry) => entry.kind === 'bgm');
const hashes = new Set(bgmEntries.map((entry) => entry.sha256));
for (const track of new Set([...expected.values()].filter(Boolean))) {
  const id = String(track).padStart(2, '0');
  const name = id === '01' ? '01-title.mp3' : id === '08' ? '08-prontera.mp3' : id === '12' ? '12-streamside.mp3' : `${id}.mp3`;
  const asset = join(root, 'public', 'ro', 'client', 'bgm', name);
  assert.ok(existsSync(asset), `缺少 BGM 資產：${name}`);
  const digest = createHash('sha256').update(readFileSync(asset)).digest('hex');
  assert.ok(hashes.has(digest), `manifest 未記錄 BGM：${basename(asset)}`);
}

const client = process.env.RO_CLIENT_DIR;
if (client) {
  for (const entry of bgmEntries) {
    const source = join(client, entry.source.replaceAll('/', '\\'));
    assert.ok(existsSync(source), `本機原廠來源遺失：${entry.source}`);
    assert.equal(
      createHash('sha256').update(readFileSync(source)).digest('hex'),
      entry.sha256,
      `${entry.source} 與公開素材不一致`,
    );
  }
}

const nameTablePath = process.env.RO_MP3NAMETABLE;
if (nameTablePath) {
  const official = new Map();
  for (const line of readFileSync(nameTablePath, 'latin1').split(/\r?\n/)) {
    if (line.startsWith('//')) continue;
    const match = line.match(/^([^#]+)\.rsw#bgm\\+(\d+)\.mp3#/i);
    if (match) official.set(match[1].toLowerCase(), Number(match[2]));
  }
  for (const [map, track] of expected) {
    if (track === null) {
      assert.ok(!official.has(map), `${map} 在原廠表中已有曲目，請補上映射`);
      continue;
    }
    assert.equal(official.get(map), track, `${map} 與原廠 mp3nametable 不一致`);
  }
}

console.log(
  `RO_MAP_BGM_PASS maps=${expected.size} imported_maps=${importedMaps.length} tracks=${new Set([...expected.values()].filter(Boolean)).size}`,
);
