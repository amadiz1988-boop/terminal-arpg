import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, extname, join, relative } from 'node:path';

const root = process.cwd();
const itemFolder = join(root, 'public', 'ro', 'client', 'items');
const manifestPath = join(root, 'public', 'ro', 'client', 'manifest.json');
const files = (await readdir(itemFolder)).filter((name) => extname(name).toLowerCase() === '.bmp');
const derived = [];

execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'scripts', 'convert-bmp-transparent.ps1'), '-AssetFolder', itemFolder], { stdio: 'inherit' });

for (const name of files) {
  const source = join(itemFolder, name);
  const target = join(itemFolder, `${basename(name, '.bmp')}.png`);
  const bytes = await readFile(target);
  derived.push({
    kind: 'item-icon-png',
    key: basename(name, '.bmp'),
    source: relative(root, source).replaceAll('\\', '/'),
    output: relative(root, target).replaceAll('\\', '/'),
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.derived = [...(manifest.derived ?? []).filter((entry) => entry.kind !== 'item-icon-png'), ...derived];
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`已轉換 ${derived.length} 個透明 PNG 道具圖示。`);
