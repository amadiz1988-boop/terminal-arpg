import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { decodeAct, decodeSpr } from './lib/ro-client-image.mjs';

const root = process.cwd();
const input = path.join(root, 'tmp', 'ro-pad-pets', '4_pd_tamadora');
const outputDir = path.join(root, 'ops', 'ro-stack', 'dashboard', 'assets', 'pets', 'tamadora');
const cell = 96;
const rawSize = 256;
const rawOrigin = rawSize / 2;
const actions = {
  idle: { group: 0, playback: 'loop', speed: 1 },
  walk: { group: 1, playback: 'loop', speed: 1 },
  happy: { group: 5, playback: 'once', speed: 1 },
  reaction: { group: 6, playback: 'once', speed: 1 },
};
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

function multiplyColor(rgba, color) {
  if (color.every((value) => value === 255)) return rgba;
  const output = Buffer.from(rgba);
  for (let i = 0; i < output.length; i += 4) {
    for (let c = 0; c < 4; c++) output[i + c] = Math.round(output[i + c] * color[c] / 255);
  }
  return output;
}

async function renderLayer(spr, layer) {
  if (layer.spriteIndex < 0) return null;
  const spriteIndex = layer.spriteType ? spr.indexedCount + layer.spriteIndex : layer.spriteIndex;
  const frame = spr.frames[spriteIndex];
  if (!frame) throw new Error(`Missing SPR frame ${spriteIndex}`);
  let image = sharp(multiplyColor(frame.rgba, layer.color), {
    raw: { width: frame.width, height: frame.height, channels: 4 },
  });
  if (layer.mirror !== (layer.scaleX < 0)) image = image.flop();
  if (layer.scaleY < 0) image = image.flip();
  const width = Math.max(1, Math.round(frame.width * Math.abs(layer.scaleX)));
  const height = Math.max(1, Math.round(frame.height * Math.abs(layer.scaleY)));
  if (width !== frame.width || height !== frame.height) image = image.resize(width, height, { kernel: 'nearest' });
  if (layer.rotation) image = image.rotate(layer.rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
  const rendered = await image.png().toBuffer({ resolveWithObject: true });
  return {
    input: rendered.data,
    left: Math.round(rawOrigin + layer.offsetX - rendered.info.width / 2),
    top: Math.round(rawOrigin + layer.offsetY - rendered.info.height / 2),
  };
}

async function renderFrame(spr, frame) {
  const layers = [];
  for (const layer of frame.layers) {
    const rendered = await renderLayer(spr, layer);
    if (rendered) {
      if (rendered.left < 0 || rendered.top < 0 || rendered.left >= rawSize || rendered.top >= rawSize)
        throw new Error('ACT layer outside raw canvas');
      layers.push(rendered);
    }
  }
  return sharp({
    create: { width: rawSize, height: rawSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite(layers).raw().toBuffer();
}

function boundsOf(pixels) {
  let left = rawSize;
  let top = rawSize;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < rawSize; y++) for (let x = 0; x < rawSize; x++) {
    if (!pixels[(y * rawSize + x) * 4 + 3]) continue;
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
  }
  if (right < left) throw new Error('Blank ACT frame');
  return { left, top, right, bottom };
}

const actBytes = fs.readFileSync(`${input}.act`);
const sprBytes = fs.readFileSync(`${input}.spr`);
const act = decodeAct(actBytes);
const spr = decodeSpr(sprBytes);
if (act.actions.length !== 56) throw new Error(`Unexpected action count ${act.actions.length}`);
const rendered = new Map();
const union = { left: rawSize, top: rawSize, right: -1, bottom: -1 };
for (const config of Object.values(actions)) {
  for (let direction = 0; direction < 8; direction++) {
    const action = act.actions[config.group * 8 + direction];
    if (!action?.frames?.length) throw new Error(`Missing group ${config.group} direction ${direction}`);
    for (let i = 0; i < action.frames.length; i++) {
      const pixels = await renderFrame(spr, action.frames[i]);
      rendered.set(`${config.group}:${direction}:${i}`, pixels);
      const b = boundsOf(pixels);
      union.left = Math.min(union.left, b.left);
      union.top = Math.min(union.top, b.top);
      union.right = Math.max(union.right, b.right);
      union.bottom = Math.max(union.bottom, b.bottom);
    }
  }
}
const width = union.right - union.left + 1;
const height = union.bottom - union.top + 1;
if (width > cell - 4 || height > cell - 4) throw new Error(`Frame union ${width}x${height} does not fit ${cell}px cell`);
const targetLeft = Math.floor((cell - width) / 2);
const targetTop = cell - 2 - height;
fs.mkdirSync(outputDir, { recursive: true });
const manifestAnimations = {};
const outputs = {};
for (const [name, config] of Object.entries(actions)) {
  const directional = act.actions.slice(config.group * 8, config.group * 8 + 8);
  const columns = Math.max(...directional.map((action) => action.frames.length));
  const tiles = [];
  for (let direction = 0; direction < 8; direction++) for (let frame = 0; frame < columns; frame++) {
    const sourceIndex = Math.min(frame, directional[direction].frames.length - 1);
    const pixels = rendered.get(`${config.group}:${direction}:${sourceIndex}`);
    const png = await sharp(pixels, { raw: { width: rawSize, height: rawSize, channels: 4 } })
      .extract({ left: union.left, top: union.top, width, height }).png().toBuffer();
    tiles.push({ input: png, left: frame * cell + targetLeft, top: direction * cell + targetTop });
  }
  const sheet = await sharp({
    create: { width: columns * cell, height: 8 * cell, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite(tiles).webp({ lossless: true }).toBuffer();
  const file = `${name}.webp`;
  fs.writeFileSync(path.join(outputDir, file), sheet);
  const delayMs = directional.map((action) => action.delay);
  manifestAnimations[name] = {
    file, actGroup: config.group, frames: columns,
    originalFrameCounts: directional.map((action) => action.frames.length),
    directionDelayMs: delayMs, frameDelayMs: delayMs[6],
    durationMs: Math.round(columns * delayMs[6] * config.speed), playback: config.playback,
  };
  outputs[name] = { width: columns * cell, height: 8 * cell, sha256: sha256(sheet) };
}
const manifest = {
  id: 'tamadora', displayName: 'たまドラ', zhNameStatus: 'UNVERIFIED',
  status: 'official-client-derived', category: 'JRO × Puzzle & Dragons', collaborationAsset: true,
  sourceGame: 'Ragnarok Online × Puzzle & Dragons / GungHo',
  sourceVersion: 'data0.grf sha256:913402ace1d3c67818b4f070650a07eb157a6d62df9e394d596d59b4c7e6678a',
  verifiedAt: new Date().toISOString().slice(0, 10), sourceStatus: 'original-client-extracted',
  source: {
    archive: 'C:/Program Files (x86)/Gravity/RagnarokOnline/data0.grf',
    archiveSha256: '913402ace1d3c67818b4f070650a07eb157a6d62df9e394d596d59b4c7e6678a',
    act: 'data/sprite/npc/4_pd_tamadora.act', spr: 'data/sprite/npc/4_pd_tamadora.spr',
    actSha256: sha256(actBytes), sprSha256: sha256(sprBytes),
  },
  originalMappings: { mob: 'PAD_TAMADORA (3306; commented reference)', npc: 'JT_4_PD_TAMADORA', egg: 'Tamadora_Egg (9080)' },
  logicalCell: { width: cell, height: cell },
  directions: ['front', 'front-left', 'left', 'back-left', 'back', 'back-right', 'right', 'front-right'],
  pivot: { x: cell / 2, y: cell - 2 },
  originalUnion: union, actVersion: act.version, sprVersion: spr.version,
  animations: manifestAnimations, outputs,
  mapping: { idle: 'ACT group 0', walk: 'ACT group 1', happy: 'ACT group 5 jump/performance', reaction: 'ACT group 6, retained as source art', run: 'walk playback accelerated', pant: 'idle fallback', sleep: 'idle still fallback; no verified dedicated sleep action' },
  implementationNotes: 'Client NPC art uses ACT composition and lossless WebP. Groups 2-4 duplicate group 0. Group 6 has direction-specific timing and remains unexposed. Original dedicated sleep action unverified. No item or egg icon was found in the three bounded client GRFs.',
  preprocessing: ['read-only GRF extraction', 'SPR palette/alpha decode', 'ACT layer composition', 'ACT mirror/scale/rotation/color', 'shared all-action bounds', 'lossless WebP'],
};
fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ outputDir, animations: manifestAnimations, union }, null, 2));
