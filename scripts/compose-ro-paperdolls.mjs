import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, relative } from 'node:path';
import sharp from 'sharp';

const repo = process.cwd();
const hairGifRoot = process.env.RO_HAIR_GIF_DIR;
const outputRoot = join(repo, 'public', 'ro', 'client', 'paperdoll');
const manifestPath = join(repo, 'public', 'ro', 'client', 'manifest.json');

if (!hairGifRoot || !existsSync(hairGifRoot))
  throw new Error('請以 RO_HAIR_GIF_DIR 指定 GrfCL 髮型 GIF 輸出目錄');

const hash = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');

async function transparentPng(path) {
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let pixel = 0; pixel < data.length; pixel += 4) {
    if (
      data[pixel] > 245 &&
      data[pixel + 1] < 12 &&
      data[pixel + 2] > 245
    )
      data[pixel + 3] = 0;
  }
  return {
    buffer: await sharp(data, { raw: info }).png().toBuffer(),
    width: info.width,
    height: info.height,
  };
}

mkdirSync(outputRoot, { recursive: true });
const generated = [];
for (const sex of ['male', 'female']) {
  const bodyPath = join(outputRoot, `novice-${sex}.png`);
  if (!existsSync(bodyPath)) throw new Error(`找不到 ${sex} 初心者身體圖`);
  const body = await transparentPng(bodyPath);
  const sourceDir = join(hairGifRoot, sex);
  const gifs = readdirSync(sourceDir)
    .filter((name) => /^\d+_.+\.gif$/i.test(name))
    .sort((left, right) => Number.parseInt(left) - Number.parseInt(right));

  for (const gifName of gifs) {
    const style = Number.parseInt(gifName, 10);
    const hair = await transparentPng(join(sourceDir, gifName));
    const canvasWidth = Math.max(64, hair.width + 12, body.width + 12);
    const canvasHeight = Math.max(110, hair.height + 4, body.height + 28);
    const target = join(outputRoot, `novice-${sex}-hair-${style}.png`);
    await sharp({
      create: {
        width: canvasWidth,
        height: canvasHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: hair.buffer,
          left: Math.round((canvasWidth - hair.width) / 2),
          top: 2,
        },
        {
          input: body.buffer,
          left: Math.round((canvasWidth - body.width) / 2),
          top: 26,
        },
      ])
      .png()
      .toFile(target);
    generated.push({
      kind: 'paperdoll',
      key: `novice-${sex}-hair-${style}`,
      source: `data0.grf:human/head/${sex}/${basename(gifName, '.gif')}.act+spr`,
      output: relative(repo, target).replaceAll('\\', '/'),
      sha256: hash(target),
    });
  }
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.imported = manifest.imported.filter(
  (entry) => !/^novice-(male|female)-hair-\d+$/.test(entry.key),
);
manifest.imported.push(...generated);
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`已產生 ${generated.length} 張含髮型的初心者紙娃娃。`);
