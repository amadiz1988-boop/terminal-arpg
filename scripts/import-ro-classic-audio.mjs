import { createHash } from 'node:crypto';
import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, readSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { inflateSync } from 'node:zlib';

const repo = process.cwd();
const client = process.env.RO_CLIENT_DIR ?? 'C:\\Program Files (x86)\\Gravity\\RagnarokOnline';
const output = join(repo, 'public', 'ro', 'client', 'bgm');
const uiOutput = join(repo, 'public', 'ro', 'client', 'ui');
const sfxOutput = join(repo, 'public', 'ro', 'client', 'sfx');
const manifestPath = join(repo, 'public', 'ro', 'client', 'manifest.json');
const loginReference = process.env.RO_LOGIN_REFERENCE ?? 'C:\\Users\\ADMINI~1\\AppData\\Local\\Temp\\codex-clipboard-79d046bf-11ba-4703-8657-5e0dc47033f5.png';
const tracks = [
  { key: 'title', source: '01.mp3', output: '01-title.mp3' },
  { key: 'prontera', source: '08.mp3', output: '08-prontera.mp3' },
  { key: 'prt_fild08', source: '12.mp3', output: '12-streamside.mp3' },
];
const effects = [
  { key: 'attack', offset: 2039549090, compressed: 25112, size: 26352 },
  { key: 'hurt', offset: 2039319072, compressed: 10545, size: 11196 },
  { key: 'defeat', offset: 2039329617, compressed: 22590, size: 24484 },
];
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

mkdirSync(output, { recursive: true });
mkdirSync(uiOutput, { recursive: true });
mkdirSync(sfxOutput, { recursive: true });
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.imported = manifest.imported.filter((entry) => entry.kind !== 'bgm');
for (const track of tracks) {
  const source = join(client, 'BGM', track.source);
  if (!existsSync(source)) throw new Error(`找不到官方 BGM：${source}`);
  const target = join(output, track.output);
  copyFileSync(source, target);
  manifest.imported.push({
    kind: 'bgm', key: track.key, source: `BGM/${track.source}`,
    output: relative(repo, target).replaceAll('\\', '/'), sha256: hash(target),
  });
}
const grfPath = join(client, 'data.grf');
const grf = openSync(grfPath, 'r');
try {
  manifest.imported = manifest.imported.filter((entry) => entry.kind !== 'sfx');
  for (const effect of effects) {
    const compressed = Buffer.alloc(effect.compressed);
    readSync(grf, compressed, 0, compressed.length, effect.offset + 46);
    const audio = inflateSync(compressed);
    if (audio.length !== effect.size || audio.subarray(0, 4).toString('ascii') !== 'RIFF')
      throw new Error(`官方音效驗證失敗：${effect.key}`);
    const target = join(sfxOutput, `${effect.key}.wav`);
    writeFileSync(target, audio);
    manifest.imported.push({
      kind: 'sfx', key: effect.key, source: `data.grf@${effect.offset}`,
      output: relative(repo, target).replaceAll('\\', '/'), sha256: hash(target),
    });
  }
} finally {
  closeSync(grf);
}
if (existsSync(loginReference)) {
  const target = join(uiOutput, 'ragnarok-title-reference.png');
  copyFileSync(loginReference, target);
  manifest.imported = manifest.imported.filter((entry) => entry.key !== 'ragnarok-title-reference');
  manifest.imported.push({
    kind: 'user-authorized-reference', key: 'ragnarok-title-reference',
    source: 'user-supplied-login-reference', output: relative(repo, target).replaceAll('\\', '/'),
    sha256: hash(target),
  });
}
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`已匯入 ${tracks.length} 首經典版情境 BGM。`);
