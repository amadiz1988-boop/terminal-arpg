import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { decodeAct, decodeSpr } from '../../../../scripts/lib/ro-client-image.mjs';
import { normalizeMonsterIndex, parseMobDbNames } from './normalize-monster-names.mjs';

const root = process.cwd();
const sourceRoot = process.env.RO_ASSET_MONSTER_SOURCE_DIR ?? path.join(root, 'tmp', 'ro-asset-index-monsters');
const outputRoot = path.join(root, 'public', 'ro', 'client', 'monsters');
const pilotMonsters = {
  poring: { mobId: 1002, aegisName: 'PORING', zhHantName: '波利', enName: 'Poring', level: 1, race: 'Plant', size: 'Medium', element: 'Water 1', rathenaLine: 136 },
  fabre: { mobId: 1007, aegisName: 'FABRE', zhHantName: '綠棉蟲', enName: 'Fabre', level: 6, race: 'Insect', size: 'Small', element: 'Earth 1', rathenaLine: 323 },
  pupa: { mobId: 1008, aegisName: 'PUPA', zhHantName: '蛹', enName: 'Pupa', level: 4, race: 'Insect', size: 'Small', element: 'Earth 1', rathenaLine: 374 },
  lunatic: { mobId: 1063, aegisName: 'LUNATIC', zhHantName: '瘋兔', enName: 'Lunatic', level: 3, race: 'Brute', size: 'Small', element: 'Neutral 3', rathenaLine: 3053 },
  green_plant: { mobId: 1080, aegisName: 'GREEN_PLANT', zhHantName: '綠草', enName: 'Green Plant', level: 1, race: 'Plant', size: 'Small', element: 'Earth 1', clientMappingLine: 567, rathenaLine: 3853 },
  yellow_plant: { mobId: 1081, aegisName: 'YELLOW_PLANT', zhHantName: '黃草', enName: 'Yellow Plant', level: 1, race: 'Plant', size: 'Small', element: 'Earth 1', clientMappingLine: 568, rathenaLine: 3906 },
  pecopeco_egg: { mobId: 1047, aegisName: 'PECOPECO_EGG', resourceName: 'peco_egg', zhHantName: '大嘴鳥蛋', enName: 'Peco Peco Egg', level: 7, race: 'Formless', size: 'Small', element: 'Neutral 3', clientMappingLine: 534, rathenaLine: 2255 },
  muka: { mobId: 1055, aegisName: 'MUKA', zhHantName: '摩卡', enName: 'Muka', level: 23, race: 'Plant', size: 'Large', element: 'Earth 1', clientMappingLine: 542, rathenaLine: 2658 },
  pecopeco: { mobId: 1019, aegisName: 'PECOPECO', zhHantName: '大嘴鳥', enName: 'Peco Peco', level: 25, race: 'Brute', size: 'Large', element: 'Fire 1', clientMappingLine: 506, rathenaLine: 904 },
  c5_pecopeco: { mobId: 2718, aegisName: 'C5_PECOPECO', resourceName: 'pecopeco', zhHantName: '狡猾大嘴鳥', enName: 'Elusive Peco Peco', level: 25, race: 'Brute', size: 'Large', element: 'Fire 1', clientMappingLine: 2455, rathenaLine: 69299 },
};
const definitionsPath = path.join(sourceRoot, 'definitions.json');
const monsters = fs.existsSync(definitionsPath)
  ? Object.fromEntries(JSON.parse(fs.readFileSync(definitionsPath, 'utf8').replace(/^\uFEFF/, '')).map((entry) => [entry.key, entry]))
  : pilotMonsters;
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

async function renderLayer(spr, layer, origin) {
  if (layer.spriteIndex < 0) return null;
  const index = layer.spriteType ? spr.indexedCount + layer.spriteIndex : layer.spriteIndex;
  const frame = spr.frames[index];
  if (!frame) return null;
  let image = sharp(frame.rgba, { raw: { width: frame.width, height: frame.height, channels: 4 } });
  if (layer.mirror !== (layer.scaleX < 0)) image = image.flop();
  if (layer.scaleY < 0) image = image.flip();
  const width = Math.max(1, Math.round(frame.width * Math.abs(layer.scaleX)));
  const height = Math.max(1, Math.round(frame.height * Math.abs(layer.scaleY)));
  if (width !== frame.width || height !== frame.height) image = image.resize(width, height, { kernel: 'nearest' });
  if (layer.rotation) image = image.rotate(layer.rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
  const rendered = await image.png().toBuffer({ resolveWithObject: true });
  return {
    input: rendered.data,
    left: Math.round(origin + layer.offsetX - rendered.info.width / 2),
    top: Math.round(origin + layer.offsetY - rendered.info.height / 2),
  };
}

async function buildMonster(id, definition) {
  const actBytes = fs.readFileSync(path.join(sourceRoot, `${id}.act`));
  const sprBytes = fs.readFileSync(path.join(sourceRoot, `${id}.spr`));
  const act = decodeAct(actBytes);
  const spr = decodeSpr(sprBytes);
  const action = act.actions[0];
  if (!action?.frames?.length) throw new Error(`${id} has no renderable ACT frame`);
  const canvas = 512;
  const origin = canvas / 2;
  const layers = [];
  for (const layer of action.frames[0].layers) {
    const rendered = await renderLayer(spr, layer, origin);
    if (rendered) layers.push(rendered);
  }
  const raw = await sharp({
    create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite(layers).png().toBuffer();
  const preview = await sharp(raw).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } }).resize(96, 96, {
    fit: 'contain',
    kernel: 'nearest',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  }).webp({ lossless: true }).toBuffer({ resolveWithObject: true });
  fs.mkdirSync(outputRoot, { recursive: true });
  const outputPath = path.join(outputRoot, `${id}.webp`);
  fs.writeFileSync(outputPath, preview.data);
  return {
    ...definition,
    source: {
      container: definition.actContainer ?? definition.sprContainer ?? 'data0.grf',
      act: `data/sprite/몬스터/${definition.resourceName ?? id}.act`,
      spr: `data/sprite/몬스터/${definition.resourceName ?? id}.spr`,
      actSha256: sha256(actBytes),
      sprSha256: sha256(sprBytes),
    },
    actVersion: act.version,
    sprVersion: spr.version,
    directionCount: Math.min(8, act.actions.length),
    idleFrameCounts: act.actions.slice(0, 8).map((candidate) => candidate.frames.length),
    idleFrameDelayMs: action.delay,
    output: {
      webPath: `/ro/client/monsters/${id}.webp`,
      width: preview.info.width,
      height: preview.info.height,
      sha256: sha256(preview.data),
    },
  };
}

const manifest = {};
for (const [id, definition] of Object.entries(monsters)) manifest[id] = await buildMonster(id, definition);
fs.writeFileSync(path.join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const indexPath = path.join(root, 'docs', 'ro-asset-index', 'monsters.json');
const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
const byMobId = new Map((index.entries ?? []).map((entry) => [Number(entry.mobId), entry]));
for (const [resourceName, built] of Object.entries(manifest)) {
  const existing = byMobId.get(Number(built.mobId)) ?? {};
  byMobId.set(Number(built.mobId), {
    ...existing,
    mobId: built.mobId,
    aegisName: built.aegisName,
    internalName: built.aegisName,
    zhHantName: built.zhHantName,
    canonicalZhHant: built.zhHantName,
    enName: built.enName,
    aliases: [...new Set([built.enName, built.aegisName, built.zhHantName])],
    translationStatus: 'verified-zh-hant',
    spriteClass: built.aegisName,
    level: built.level,
    race: built.race,
    size: built.size,
    element: built.element,
    directionCount: built.directionCount,
    idleFrameCounts: built.idleFrameCounts,
    frameTimingMs: built.idleFrameDelayMs,
    assetStatus: 'ready',
    verificationGrade: 'A',
    sprite: {
      sourceType: 'client',
      container: built.source.container,
      actPath: built.source.act,
      sprPath: built.source.spr,
      actSha256: built.source.actSha256,
      sprSha256: built.source.sprSha256,
    },
    thumbnail: {
      webPath: built.output.webPath,
      webSha256: built.output.sha256,
      width: built.output.width,
      height: built.output.height,
      conversion: 'ACT/SPR first idle frame to lossless WebP',
      verified: true,
    },
    provenance: [
      { tier: 1, sourceType: 'client-navigation', sourcePath: 'public/ro/data/monster-names-tw.json', verifiedAt: new Date().toISOString().slice(0, 10) },
      ...(built.clientMappingLine ? [{ tier: 1, sourceType: 'official-client-jobname', sourcePath: `data.grf:data/luafiles514/lua files/datainfo/jobname.lub:${built.clientMappingLine}`, verifiedAt: new Date().toISOString().slice(0, 10) }] : []),
      { tier: 2, sourceType: 'rathena', sourcePath: `.local/ro-stack/rathena/db/re/mob_db.yml${built.rathenaLine ? `:${built.rathenaLine}` : ''}`, verifiedAt: new Date().toISOString().slice(0, 10) },
    ],
  });
}
index.updatedAt = new Date().toISOString().slice(0, 10);
index.entries = [...byMobId.values()].sort((a, b) => a.mobId - b.mobId);
const mobDbPath = path.join(root, '.local', 'ro-stack', 'rathena', 'db', 're', 'mob_db.yml');
const namesTwPath = path.join(root, 'public', 'ro', 'data', 'monster-names-tw.json');
if (fs.existsSync(mobDbPath) && fs.existsSync(namesTwPath)) {
  const verifiedAt = new Date().toISOString().slice(0, 10);
  normalizeMonsterIndex(
    index,
    parseMobDbNames(fs.readFileSync(mobDbPath, 'utf8')),
    JSON.parse(fs.readFileSync(namesTwPath, 'utf8')).names,
    [
      { tier: 1, sourceType: 'client-navigation', sourcePath: 'public/ro/data/monster-names-tw.json', verifiedAt },
      { tier: 2, sourceType: 'rathena', sourcePath: '.local/ro-stack/rathena/db/re/mob_db.yml', verifiedAt },
    ],
  );
}
fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
console.log(JSON.stringify({
  result: 'RO_MONSTER_ASSET_INDEX_BUILT',
  monsters: Object.keys(manifest).length,
  indexEntries: index.entries.length,
}, null, 2));
