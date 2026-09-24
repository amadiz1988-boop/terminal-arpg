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
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, relative } from 'node:path';
import sharp from 'sharp';

const repo = process.cwd();
const client =
  process.env.RO_CLIENT_DIR ??
  'C:\\Program Files (x86)\\Gravity\\RagnarokOnline';
const grfcl = process.env.GRFCL_EXE;
const output = join(repo, 'public', 'ro', 'client');

if (!existsSync(join(client, 'Ragnarok.exe')))
  throw new Error(`找不到 RO 客戶端：${client}`);
if (!grfcl || !existsSync(grfcl))
  throw new Error('請以 GRFCL_EXE 指定唯讀 GRF 解包工具 GrfCL.exe');

const allItemResources = [
  ['Red_Herb', 'bba1b0a3c7e3baea'],
  ['Novice_Potion', 'bba1b0a3c6f7bcc7'],
  ['Green_Herb', 'c3cab7cfc7e3baea'],
  ['Apple', 'bbe7b0fa'],
  ['Carrot', 'b4e7b1d9'],
  ['Wing_Of_Fly', 'c6c4b8aec0c7b3afb0b3'],
  ['Unripe_Apple', 'b4fac0cdc0babbe7b0fa'],
  ['Rainbow_Carrot', 'b9abc1f6b0b3b4e7b1d9'],
  ['Clover', 'c5acb7ceb9f6'],
  ['Jellopy', 'c1a9b7cec7c7'],
  ['Fluff', 'bcd8c5d0'],
  ['Chrysalis', 'b9f8b5a5b1e2b2aec1fa'],
  ['Shell', 'b4dcb4dcc7d1b2aec1fa'],
  ['Sticky_Mucus', 'b2f6c0fbb2f6c0fbc7d1bed7c3bc'],
  ['Feather', 'baceb5e5b7afbfeec5d0'],
  ['Iron_Ore', 'c3b6b1a4bcae'],
  ['Phracon', 'c7c1b6f3c4dc'],
  ['Knife_', 'b3aac0ccc7c1'],
  ['Sword_', 'bcd2b5e5'],
  ['Club', 'c5acb7b4'],
  ['Club_', 'c5acb7b4'],
  ['Guard_', 'b0a1b5e5'],
  ['Novice_Guard', 'c3cabab8c0dabfebbdafb5e5'],
  ['Novice_Plate', 'c3cabab8c0dabfebc8e4b0a9'],
  ['Novice_Hood', 'c3cabab8c0dabfebb8c1c5e4'],
  ['Novice_Boots', 'c3cabab8c0dabfebbdb4c1ee'],
  ['Novice_Egg_Cap', 'c0e5bdc4bfebbecbb2aec1fa'],
  ['Cryptura_Academy_Hat', 'c5a9b8aec5f5b6f3c7d0bff8b8f0c0da'],
  ['Pierrot_Nose', 'b1a4b4ebc4da'],
  ['Poring_Card', 'c6f7b8b5c4abb5e5'],
  ['Lunatic_Card', 'b7e7b3aac6bdc4abb5e5'],
  ['Fabre_Card', 'c6c4baeab8a3c4abb5e5'],
  ['Pupa_Card', 'c7aac6c4c4abb5e5'],
  // The current official client has no separate Novice Poring card bitmap.
  // rAthena uses the regular Poring artwork for this custom starter card.
  ['Novice_Poring_Card', 'c6f7b8b5c4abb5e5'],
  ['N_Falchion', 'c6c8bdc3bfc2'],
  ['N_Mace', 'b8dec0ccbdba'],
  ['N_Rod', 'b7d4b5e5'],
  ['N_Composite_Bow', 'c4c4c6f7c1f6c6aebab8bfec'],
  ['N_Main_Gauche', 'b8c1b0edbdb4'],
  ['Arrow_Container', 'c8adbbecc5eb'],
  ['Fire_Arrow_Container', 'bad2c8adbbecc5eb'],
  ['Silver_Arrow_Container', 'c0bac8adbbecc5eb'],
  ['Warp_Free_Ticket', 'c4edc6f9'],
];
const requestedItemKeys = new Set(
  String(process.env.RO_IMPORT_ONLY_ITEMS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);
const extractedItemRoot = process.env.RO_IMPORT_EXTRACTED_ITEM_ROOT;
const itemResources = requestedItemKeys.size
  ? allItemResources.filter(([key]) => requestedItemKeys.has(key))
  : allItemResources;

const hash = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const walk = (root) =>
  readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
const cp949ToGrfCl = (hex) =>
  new TextDecoder('euc-kr').decode(Buffer.from(hex, 'hex'));
const inIconFolder = (path) =>
  dirname(path)
    .split(/[\\/]/)
    .some((part) => ['item', 'cardbmp'].includes(part.toLowerCase()));

mkdirSync(join(output, 'bgm'), { recursive: true });
mkdirSync(join(output, 'items'), { recursive: true });
mkdirSync(join(output, 'paperdoll'), { recursive: true });
mkdirSync(join(output, 'skin'), { recursive: true });

const work = mkdtempSync(join(tmpdir(), 'ro-client-import-'));
const imported = [];

try {
  for (const [key, sourceName, outputName] of [
    ['title', '01.mp3', '01-title.mp3'],
    ['payon_fields', '03.mp3', '03.mp3'],
    ['prontera_fields', '05.mp3', '05.mp3'],
    ['prontera', '08.mp3', '08-prontera.mp3'],
    ['prontera_church', '10.mp3', '10.mp3'],
    ['morocc', '11.mp3', '11.mp3'],
    ['prt_fild08', '12.mp3', '12-streamside.mp3'],
    ['geffen', '13.mp3', '13.mp3'],
    ['payon', '14.mp3', '14.mp3'],
    ['payon_dungeon', '20.mp3', '20.mp3'],
    ['pyramid', '22.mp3', '22.mp3'],
    ['morocc_field', '24.mp3', '24.mp3'],
    ['geffen_field', '25.mp3', '25.mp3'],
    ['izlude_academy', '26.mp3', '26.mp3'],
    ['training_ground', '30.mp3', '30.mp3'],
    ['mjolnir', '31.mp3', '31.mp3'],
    ['morocc_ruins_field', '37.mp3', '37.mp3'],
    ['morocc_ruins', '52.mp3', '52.mp3'],
    ['payon_guild', '66.mp3', '66.mp3'],
  ]) {
    const bgmSource = join(client, 'BGM', sourceName);
    const bgmTarget = join(output, 'bgm', outputName);
    copyFileSync(bgmSource, bgmTarget);
    imported.push({
      kind: 'bgm',
      key,
      source: `BGM/${sourceName}`,
      output: relative(repo, bgmTarget).replaceAll('\\', '/'),
      sha256: hash(bgmTarget),
    });
  }

  for (const name of ['btn_close.bmp', 'checkbox_0.bmp', 'checkbox_1.bmp']) {
    const source = join(client, 'skin', 'default', name);
    const target = join(output, 'skin', name);
    copyFileSync(source, target);
    imported.push({
      kind: 'skin',
      key: name.replace('.bmp', ''),
      source: `skin/default/${name}`,
      output: relative(repo, target).replaceAll('\\', '/'),
      sha256: hash(target),
    });
  }

  if (process.env.RO_IMPORT_SKIP_PAPERDOLLS === '1') {
    const previous = JSON.parse(
      readFileSync(join(output, 'manifest.json'), 'utf8'),
    );
    imported.push(
      ...previous.imported.filter((entry) => entry.kind === 'paperdoll'),
    );
  } else {
    const noviceRoot = join(work, 'novice');
    mkdirSync(noviceRoot, { recursive: true });
    execFileSync(
      grfcl,
      [
        '-breakOnExceptions',
        'true',
        '-open',
        join(client, 'data0.grf'),
        '-extractFiles',
        '*檬焊磊*',
        noviceRoot,
      ],
      { stdio: 'inherit' },
    );

    const noviceFiles = walk(noviceRoot);
    for (const [sex, directory, suffix] of [
      ['male', '巢', '巢'],
      ['female', '咯', '咯'],
    ]) {
      const act = noviceFiles.find((path) => {
        const parts = path.split(/[\\/]/);
        return (
          basename(path) === `檬焊磊_${suffix}.act` &&
          parts.at(-2) === directory &&
          parts.at(-3) === '个烹'
        );
      });
      if (!act) throw new Error(`找不到初心者 ${sex} ACT/SPR`);

      const gifRoot = join(work, `gif-${sex}`);
      mkdirSync(gifRoot, { recursive: true });
      execFileSync(
        grfcl,
        [
          '-breakOnExceptions',
          'true',
          '-gif',
          gifRoot,
          act,
          '0',
          '/uniform=True',
          '/ignore=True',
          '/scale=2',
          '/margin=4',
        ],
        { stdio: 'inherit' },
      );
      const gif = walk(gifRoot).find(
        (path) => extname(path).toLowerCase() === '.gif',
      );
      if (!gif) throw new Error(`無法轉出初心者 ${sex} 圖像`);

      const { data, info } = await sharp(gif)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      for (let pixel = 0; pixel < data.length; pixel += 4) {
        if (data[pixel] > 245 && data[pixel + 1] < 12 && data[pixel + 2] > 245)
          data[pixel + 3] = 0;
      }
      const target = join(output, 'paperdoll', `novice-${sex}.png`);
      await sharp(data, { raw: info }).png().toFile(target);
      imported.push({
        kind: 'paperdoll',
        key: `novice-${sex}`,
        source: `data0.grf:${relative(noviceRoot, act).replaceAll('\\', '/')}`,
        output: relative(repo, target).replaceAll('\\', '/'),
        sha256: hash(target),
      });
    }
  }

  if (requestedItemKeys.size) {
    const previous = JSON.parse(
      readFileSync(join(output, 'manifest.json'), 'utf8'),
    );
    imported.push(
      ...previous.imported.filter(
        (entry) => entry.kind === 'item' && !requestedItemKeys.has(entry.key),
      ),
    );
  }

  const itemRoot = extractedItemRoot || join(work, 'items');
  if (!extractedItemRoot) {
    mkdirSync(itemRoot, { recursive: true });
    const args = [
      '-breakOnExceptions',
      'true',
      '-encoding',
      '949',
      '-open',
      join(client, 'data.grf'),
    ];
    for (const [, resourceHex] of itemResources)
      args.push('-extractFiles', `*${cp949ToGrfCl(resourceHex)}.bmp`, itemRoot);
    execFileSync(grfcl, args, { stdio: 'inherit' });
  }

  const extractedItems = walk(itemRoot);
  for (const [key, resourceHex] of itemResources) {
    const fileName = `${cp949ToGrfCl(resourceHex)}.bmp`.toLowerCase();
    const source = extractedItems.find(
      (path) => basename(path).toLowerCase() === fileName && inIconFolder(path),
    );
    if (!source) throw new Error(`找不到道具圖示 ${key}`);
    const target = join(output, 'items', `${key}.bmp`);
    copyFileSync(source, target);
    imported.push({
      kind: 'item',
      key,
      source: `data.grf:${relative(itemRoot, source).replaceAll('\\', '/')}`,
      output: relative(repo, target).replaceAll('\\', '/'),
      sha256: hash(target),
    });
  }

  const archives = ['data.grf', 'data0.grf', 'event.grf'].map((name) => {
    const path = join(client, name);
    return { name, bytes: statSync(path).size, sha256: hash(path) };
  });
  writeFileSync(
    join(output, 'manifest.json'),
    `${JSON.stringify(
      {
        authorization: '使用者於 2026-09-10 聲明已取得官方客戶端內容授權',
        clientExecutable: {
          bytes: statSync(join(client, 'Ragnarok.exe')).size,
          sha256: hash(join(client, 'Ragnarok.exe')),
        },
        archives,
        imported,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`已匯入 ${imported.length} 個官方客戶端資產。`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
