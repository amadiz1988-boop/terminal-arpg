import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative } from 'node:path';
import sharp from 'sharp';
import { decodeSpr, decodeTga } from './lib/ro-client-image.mjs';

const repo = process.cwd();
const client =
  process.env.RO_CLIENT_DIR ??
  'C:\\Program Files (x86)\\Gravity\\RagnarokOnline';
const grfcl = process.env.GRFCL_EXE;
const extractedRoot = process.env.RO_DAMAGE_EXTRACTED_ROOT;
const output = join(repo, 'public', 'ro', 'client', 'damage');
const manifestPath = join(output, 'manifest.json');
const effectFolder = new TextDecoder('euc-kr').decode(
  Buffer.from('c0ccc6d1c6ae', 'hex'),
);
const numberName = new TextDecoder('euc-kr').decode(
  Buffer.from('bcfdc0da', 'hex'),
);
const hash = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const walk = (root) =>
  readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
const normalized = (path) => path.replaceAll('\\', '/').toLowerCase();
const tinted = (rgba, red, green, blue) => {
  const output = Buffer.from(rgba);
  for (let offset = 0; offset < output.length; offset += 4) {
    output[offset] = Math.round(output[offset] * red);
    output[offset + 1] = Math.round(output[offset + 1] * green);
    output[offset + 2] = Math.round(output[offset + 2] * blue);
  }
  return output;
};

if (!extractedRoot) {
  if (!existsSync(join(client, 'Ragnarok.exe')))
    throw new Error(`找不到 RO 客戶端：${client}`);
  if (!grfcl || !existsSync(grfcl))
    throw new Error('請以 GRFCL_EXE 指定唯讀 GRF 解包工具 GrfCL.exe');
}

mkdirSync(output, { recursive: true });
const work = extractedRoot ?? mkdtempSync(join(tmpdir(), 'ro-damage-import-'));

try {
  if (!extractedRoot) {
    for (const archiveName of ['data.grf', 'data0.grf']) {
      const archive = join(client, archiveName);
      if (!existsSync(archive)) continue;
      execFileSync(
        grfcl,
        [
          '-breakOnExceptions',
          'true',
          '-encoding',
          '949',
          '-open',
          archive,
          '-extractFiles',
          `*${numberName}.spr`,
          work,
          '-extractFiles',
          '*msg.spr',
          work,
          '-extractFiles',
          '*lens1.tga',
          work,
          '-extractFiles',
          '*lens2.tga',
          work,
          '-extractFiles',
          '*ef_hit2.wav',
          work,
        ],
        { stdio: 'inherit' },
      );
    }
  }

  const files = walk(work);
  const findSource = (name, folder) => {
    const matches = files.filter(
      (path) => basename(path).toLowerCase() === name.toLowerCase(),
    );
    return (
      matches.find((path) =>
        dirname(path)
          .split(/[\\/]/)
          .some((part) => part.toLowerCase() === folder.toLowerCase()),
      ) ?? matches[0]
    );
  };
  const numberSpr = findSource(`${numberName}.spr`, effectFolder);
  const messageSpr = findSource('msg.spr', effectFolder);
  const lens1 = findSource('lens1.tga', 'effect');
  const lens2 = findSource('lens2.tga', 'effect');
  const hitSound = findSource('ef_hit2.wav', 'effect');
  for (const [label, path] of [
    ['原廠傷害數字', numberSpr],
    ['原廠暴擊訊息', messageSpr],
    ['EF_HIT2 lens1', lens1],
    ['EF_HIT2 lens2', lens2],
  ])
    if (!path) throw new Error(`找不到 ${label}`);

  const imported = [];
  const numberFrames = decodeSpr(readFileSync(numberSpr)).frames;
  if (numberFrames.length < 10)
    throw new Error(`原廠傷害數字只有 ${numberFrames.length} 個畫格`);
  for (let digit = 0; digit <= 9; digit += 1) {
    const frame = numberFrames[digit];
    const target = join(output, `number-${digit}.png`);
    await sharp(frame.rgba, {
      raw: { width: frame.width, height: frame.height, channels: 4 },
    })
      .png()
      .toFile(target);
    imported.push({
      kind: 'damage-number',
      key: String(digit),
      source: `GRF:${normalized(relative(work, numberSpr))}#frame-${digit}`,
      output: normalized(relative(repo, target)),
      width: frame.width,
      height: frame.height,
      sha256: hash(target),
    });
    const criticalTarget = join(output, `critical-number-${digit}.png`);
    await sharp(tinted(frame.rgba, 0.9, 0.9, 0.15), {
      raw: { width: frame.width, height: frame.height, channels: 4 },
    })
      .png()
      .toFile(criticalTarget);
    imported.push({
      kind: 'critical-damage-number',
      key: String(digit),
      source: `GRF:${normalized(relative(work, numberSpr))}#frame-${digit}; RGB×(0.9,0.9,0.15)`,
      output: normalized(relative(repo, criticalTarget)),
      width: frame.width,
      height: frame.height,
      sha256: hash(criticalTarget),
    });
  }

  const messageFrames = decodeSpr(readFileSync(messageSpr)).frames;
  if (messageFrames.length < 4)
    throw new Error(`原廠 msg.spr 只有 ${messageFrames.length} 個畫格`);
  const critical = messageFrames[3];
  const criticalTarget = join(output, 'critical-bg.png');
  await sharp(tinted(critical.rgba, 0.66, 0.66, 0.66), {
    raw: { width: critical.width, height: critical.height, channels: 4 },
  })
    .png()
    .toFile(criticalTarget);
  imported.push({
    kind: 'damage-message',
    key: 'critbg',
    source: `GRF:${normalized(relative(work, messageSpr))}#frame-3; RGB×(0.66,0.66,0.66)`,
    output: normalized(relative(repo, criticalTarget)),
    width: critical.width,
    height: critical.height,
    sha256: hash(criticalTarget),
  });

  for (const [key, source] of [
    ['lens1', lens1],
    ['lens2', lens2],
  ]) {
    const image = decodeTga(readFileSync(source));
    const target = join(output, `${key}.png`);
    await sharp(image.rgba, {
      raw: { width: image.width, height: image.height, channels: 4 },
    })
      .png()
      .toFile(target);
    imported.push({
      kind: 'hit-effect',
      key,
      source: `GRF:${normalized(relative(work, source))}`,
      output: normalized(relative(repo, target)),
      width: image.width,
      height: image.height,
      sha256: hash(target),
    });
  }

  if (hitSound) {
    const target = join(output, 'ef_hit2.wav');
    copyFileSync(hitSound, target);
    imported.push({
      kind: 'hit-effect-audio',
      key: 'ef_hit2',
      source: `GRF:${normalized(relative(work, hitSound))}`,
      output: normalized(relative(repo, target)),
      sha256: hash(target),
    });
  }

  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        authorization: '使用者於 2026-09-10 聲明已取得官方客戶端內容授權',
        sourceVersion:
          '本機 Gravity RagnarokOnline 客戶端；SHA-256 見 public/ro/client/manifest.json',
        verifiedAt: new Date().toISOString(),
        sourceStatus: 'verified',
        implementationNotes:
          '숫자.spr 畫格 0-9 為傷害數字；msg.spr 畫格 3 為 critbg；lens1/lens2 為 EF_HIT2 八方向放射貼圖。',
        imported,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`RO_DAMAGE_ASSETS_IMPORTED=${imported.length}`);
} finally {
  if (!extractedRoot) rmSync(work, { recursive: true, force: true });
}
