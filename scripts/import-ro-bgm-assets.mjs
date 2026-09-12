import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';

const repo = process.cwd();
const client =
  process.env.RO_CLIENT_DIR ??
  'C:\\Program Files (x86)\\Gravity\\RagnarokOnline';
const output = join(repo, 'public', 'ro', 'client');
const manifestPath = join(output, 'manifest.json');
const tracks = [
  ['title', '01', '01-title.mp3'],
  ['payon_fields', '03', '03.mp3'],
  ['prontera_fields', '05', '05.mp3'],
  ['prontera', '08', '08-prontera.mp3'],
  ['prontera_church', '10', '10.mp3'],
  ['morocc', '11', '11.mp3'],
  ['prt_fild08', '12', '12-streamside.mp3'],
  ['geffen', '13', '13.mp3'],
  ['payon', '14', '14.mp3'],
  ['payon_dungeon', '20', '20.mp3'],
  ['pyramid', '22', '22.mp3'],
  ['morocc_field', '24', '24.mp3'],
  ['geffen_field', '25', '25.mp3'],
  ['izlude_academy', '26', '26.mp3'],
  ['training_ground', '30', '30.mp3'],
  ['mjolnir', '31', '31.mp3'],
  ['morocc_ruins_field', '37', '37.mp3'],
  ['morocc_ruins', '52', '52.mp3'],
  ['payon_guild', '66', '66.mp3'],
];

if (!existsSync(join(client, 'Ragnarok.exe')))
  throw new Error(`找不到 RO 客戶端：${client}`);

const hash = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
mkdirSync(join(output, 'bgm'), { recursive: true });

const imported = tracks.map(([key, id, outputName]) => {
  const source = join(client, 'BGM', `${id}.mp3`);
  const target = join(output, 'bgm', outputName);
  if (!existsSync(source)) throw new Error(`原廠客戶端缺少 BGM/${id}.mp3`);
  copyFileSync(source, target);
  return {
    kind: 'bgm',
    key,
    source: `BGM/${id}.mp3`,
    output: relative(repo, target).replaceAll('\\', '/'),
    sha256: hash(target),
  };
});

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.clientExecutable = {
  bytes: statSync(join(client, 'Ragnarok.exe')).size,
  sha256: hash(join(client, 'Ragnarok.exe')),
};
manifest.imported = [
  ...manifest.imported.filter((entry) => entry.kind !== 'bgm'),
  ...imported,
];
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`RO_MAP_BGM_IMPORTED ${imported.length}`);
