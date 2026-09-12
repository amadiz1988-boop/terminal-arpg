import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { decodeAct, decodeSpr } from './lib/ro-client-image.mjs';

const repo = process.cwd();
const normalizedBodyRoot = join(repo, 'tmp', 'ro-showcase-bodies');
const legacyBodyRoot = join(repo, 'tmp', 'data', 'sprite', '牢埃练', '个烹');
const bodyRoot =
  process.env.RO_BODY_SPRITE_ROOT ??
  (existsSync(join(normalizedBodyRoot, 'male', 'novice.act'))
    ? normalizedBodyRoot
    : legacyBodyRoot);
const hairRoot =
  process.env.RO_HAIR_SPRITE_ROOT ??
  join(tmpdir(), 'rohairall', 'data', 'sprite', '牢埃练', '赣府烹');
const headgearRoot =
  process.env.RO_HEADGEAR_SPRITE_ROOT ??
  join(repo, 'tmp', 'data', 'sprite', '厩技荤府');
const archerWeaponRoot =
  process.env.RO_ARCHER_WEAPON_SPRITE_ROOT ??
  join(repo, 'tmp', 'data', 'sprite', '牢埃练', '泵荐');
const clientSkinRoot =
  process.env.RO_CLIENT_SKIN_ROOT ??
  'C:\\Program Files (x86)\\Gravity\\RagnarokOnline\\skin\\default';
const outputRoot = join(repo, 'public', 'ro', 'client', 'showcase');
const frameWidth = 96;
const frameHeight = 160;
const originX = 48;
const originY = 108;
const groups = {
  stand: 0,
  walk: 8,
  sit: 16,
  attack: 40,
  bowAttack: 80,
};
const normalizedBodies = {
  novice: 'novice',
  swordsman: 'swordsman',
  mage: 'mage',
  archer: 'archer',
  acolyte: 'acolyte',
  merchant: 'merchant',
  thief: 'thief',
  taekwon: 'taekwon',
  supernovice: 'supernovice',
  gunslinger: 'gunslinger',
  ninja: 'ninja',
};
const legacyBodies = {
  novice: '檬焊磊',
  archer: '泵荐',
  gunslinger: '扒呈',
};
const normalizedBodyLayout = existsSync(join(bodyRoot, 'male', 'novice.act'));
const bodySexes = normalizedBodyLayout
  ? { male: 'male', female: 'female' }
  : { male: '巢', female: '咯' };
const bodies = normalizedBodyLayout ? normalizedBodies : legacyBodies;
const sexes = { male: '巢', female: '咯' };

const sourcePair = (actPath) => ({
  actPath,
  sprPath: actPath.replace(/\.act$/i, '.spr'),
});
const findAct = (root, name) => {
  const match = readdirSync(root, { withFileTypes: true }).find(
    (entry) =>
      entry.isFile() &&
      entry.name.toLowerCase() === `${name}.act`.toLowerCase(),
  );
  return match ? join(root, match.name) : null;
};

async function transformLayer(frame, layer) {
  if (!frame || layer.spriteIndex < 0) return null;
  let image = sharp(frame.rgba, {
    raw: { width: frame.width, height: frame.height, channels: 4 },
  });
  if (layer.mirror) image = image.flop();
  const width = Math.max(1, Math.round(frame.width * Math.abs(layer.scaleX)));
  const height = Math.max(1, Math.round(frame.height * Math.abs(layer.scaleY)));
  if (width !== frame.width || height !== frame.height)
    image = image.resize(width, height, { kernel: 'nearest' });
  if (layer.rotation)
    image = image.rotate(layer.rotation, {
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  const rendered = await image.png().toBuffer({ resolveWithObject: true });
  return {
    input: rendered.data,
    left: Math.round(originX + layer.offsetX - rendered.info.width / 2),
    top: Math.round(originY + layer.offsetY - rendered.info.height / 2),
  };
}

async function renderFrame(spr, frame, part = 'full') {
  const composites = [];
  const marker = frame.layers.findIndex((layer) => layer.spriteIndex < 0);
  const layers = frame.layers.filter((layer, index) => {
    if (layer.spriteIndex < 0 || part === 'full') return layer.spriteIndex >= 0;
    if (part === 'back') return marker >= 0 && index < marker;
    return marker < 0 || index > marker;
  });
  for (const layer of layers) {
    const absoluteIndex = layer.spriteType
      ? spr.indexedCount + layer.spriteIndex
      : layer.spriteIndex;
    const rendered = await transformLayer(spr.frames[absoluteIndex], layer);
    if (rendered) composites.push(rendered);
  }
  return sharp({
    create: {
      width: frameWidth,
      height: frameHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

async function buildSheet(
  pair,
  targetDir,
  targetKey,
  actionName,
  baseAction,
  part = 'full',
) {
  const act = decodeAct(readFileSync(pair.actPath));
  const spr = decodeSpr(readFileSync(pair.sprPath));
  const directions = act.actions.slice(baseAction, baseAction + 8);
  if (directions.length !== 8)
    throw new Error(`${targetKey} 缺少 ${actionName} 八方向動作`);
  const frameCounts = directions.map((action) => action.frames.length);
  const columns = Math.max(...frameCounts);
  const tiles = [];
  for (let direction = 0; direction < 8; direction += 1) {
    for (let frame = 0; frame < frameCounts[direction]; frame += 1) {
      tiles.push({
        input: await renderFrame(
          spr,
          directions[direction].frames[frame],
          part,
        ),
        left: frame * frameWidth,
        top: direction * frameHeight,
      });
    }
  }
  mkdirSync(targetDir, { recursive: true });
  const fileName = `${targetKey}${part === 'full' ? '' : `-${part}`}-${actionName}.png`;
  await sharp({
    create: {
      width: columns * frameWidth,
      height: 8 * frameHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(tiles)
    .png()
    .toFile(join(targetDir, fileName));
  return {
    src: `/ro/client/showcase/${basename(targetDir)}/${fileName}`,
    frameCounts,
    columns,
    delay: directions[0].delay,
    anchors: directions.map((action) =>
      action.frames.map((frame) => frame.anchors?.[0] ?? null),
    ),
  };
}

async function importControlArrow(sourceName, targetName) {
  const source = join(clientSkinRoot, sourceName);
  if (!existsSync(source)) throw new Error(`找不到官方旋轉箭頭：${source}`);
  const bitmap = readFileSync(source);
  if (bitmap.toString('ascii', 0, 2) !== 'BM')
    throw new Error(`旋轉箭頭 BMP 標頭不符：${source}`);
  const pixelOffset = bitmap.readUInt32LE(10);
  const dibSize = bitmap.readUInt32LE(14);
  const width = bitmap.readInt32LE(18);
  const signedHeight = bitmap.readInt32LE(22);
  const height = Math.abs(signedHeight);
  const bitsPerPixel = bitmap.readUInt16LE(28);
  const compression = bitmap.readUInt32LE(30);
  if (bitsPerPixel !== 8 || compression !== 0 || width <= 0 || !height)
    throw new Error(`不支援的旋轉箭頭 BMP：${source}`);
  const colorCount = bitmap.readUInt32LE(46) || 256;
  const paletteStart = 14 + dibSize;
  const rowStride = Math.ceil(width / 4) * 4;
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceY = signedHeight > 0 ? height - y - 1 : y;
    for (let x = 0; x < width; x += 1) {
      const paletteIndex = bitmap[pixelOffset + sourceY * rowStride + x];
      if (paletteIndex >= colorCount) continue;
      const paletteOffset = paletteStart + paletteIndex * 4;
      const blue = bitmap[paletteOffset];
      const green = bitmap[paletteOffset + 1];
      const red = bitmap[paletteOffset + 2];
      const target = (y * width + x) * 4;
      rgba[target] = red;
      rgba[target + 1] = green;
      rgba[target + 2] = blue;
      rgba[target + 3] = red > 245 && green < 12 && blue > 245 ? 0 : 255;
    }
  }
  const targetDir = join(outputRoot, 'ui');
  mkdirSync(targetDir, { recursive: true });
  await sharp(rgba, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toFile(join(targetDir, targetName));
  return `/ro/client/showcase/ui/${targetName}`;
}

if (!existsSync(bodyRoot)) throw new Error(`找不到身體素材：${bodyRoot}`);
if (!existsSync(hairRoot)) throw new Error(`找不到髮型素材：${hairRoot}`);
if (!existsSync(headgearRoot))
  throw new Error(`找不到頭飾素材：${headgearRoot}`);
if (!existsSync(archerWeaponRoot))
  throw new Error(`找不到弓箭手武器素材：${archerWeaponRoot}`);

rmSync(outputRoot, { recursive: true, force: true });
const manifest = {
  frameWidth,
  frameHeight,
  originX,
  originY,
  body: {},
  hair: {},
  equipment: { headTop: { 5583: {} }, weapon: { bow: {} } },
  controls: {},
};

async function buildSplitActions(pair, targetDir, key) {
  const output = {};
  for (const [actionName, actionIndex] of Object.entries(groups)) {
    const back = await buildSheet(
      pair,
      targetDir,
      key,
      actionName,
      actionIndex,
      'back',
    );
    const front = await buildSheet(
      pair,
      targetDir,
      key,
      actionName,
      actionIndex,
      'front',
    );
    output[actionName] = {
      ...front,
      backSrc: back.src,
      frontSrc: front.src,
    };
  }
  return output;
}
for (const [job, sourceName] of Object.entries(bodies)) {
  for (const [sex, suffix] of Object.entries(bodySexes)) {
    const actPath = findAct(
      join(bodyRoot, suffix),
      normalizedBodyLayout ? sourceName : `${sourceName}_${suffix}`,
    );
    if (!actPath) throw new Error(`找不到 ${job} ${sex} ACT/SPR`);
    const key = `${job}-${sex}`;
    manifest.body[key] = {};
    for (const [actionName, actionIndex] of Object.entries(groups))
      manifest.body[key][actionName] = await buildSheet(
        sourcePair(actPath),
        join(outputRoot, 'body'),
        key,
        actionName,
        actionIndex,
      );
  }
}

for (const [sex, suffix] of Object.entries(sexes)) {
  const sexRoot = join(hairRoot, suffix);
  for (let style = 1; style <= 42; style += 1) {
    const actPath = findAct(sexRoot, `${style}_${suffix}`);
    if (!actPath) throw new Error(`找不到 ${sex} 髮型 ${style}`);
    const key = `${sex}-${style}`;
    manifest.hair[key] = await buildSplitActions(
      sourcePair(actPath),
      join(outputRoot, 'hair'),
      key,
    );
  }
}

for (const [sex, suffix] of Object.entries(sexes)) {
  const headAct = findAct(join(headgearRoot, suffix), `${suffix}_欺饭捞靛葛磊`);
  if (!headAct) throw new Error(`找不到 ${sex} 伊甸園帽外觀`);
  manifest.equipment.headTop[5583][sex] = await buildSplitActions(
    sourcePair(headAct),
    join(outputRoot, 'equipment'),
    `eden-hat-${sex}`,
  );

  const bowAct = findAct(archerWeaponRoot, `泵荐_${suffix}_劝`);
  if (!bowAct) throw new Error(`找不到 ${sex} 弓箭手弓外觀`);
  manifest.equipment.weapon.bow[`archer-${sex}`] = await buildSplitActions(
    sourcePair(bowAct),
    join(outputRoot, 'equipment'),
    `archer-${sex}-bow`,
  );
}

manifest.controls.rotateLeft = await importControlArrow(
  'sysbox_arr_l.bmp',
  'rotate-left.png',
);
manifest.controls.rotateRight = await importControlArrow(
  'sysbox_arr_r.bmp',
  'rotate-right.png',
);

mkdirSync(outputRoot, { recursive: true });
writeFileSync(
  join(outputRoot, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(
  `角色展示台完成：${Object.keys(manifest.body).length} 組身體、${Object.keys(manifest.hair).length} 組髮型、4 組裝備外觀。`,
);
