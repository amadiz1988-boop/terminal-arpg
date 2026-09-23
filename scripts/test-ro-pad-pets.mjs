import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { decodeAct, decodeSpr } from './lib/ro-client-image.mjs';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative));
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(read('ops/ro-stack/dashboard/assets/pets/tamadora/manifest.json'));
const census = JSON.parse(read('docs/ro-asset-index/jro-pad-pet-census.json'));
const act = decodeAct(read('tmp/ro-pad-pets/4_pd_tamadora.act'));
const spr = decodeSpr(read('tmp/ro-pad-pets/4_pd_tamadora.spr'));
assert.equal(manifest.id, 'tamadora');
assert.equal(manifest.collaborationAsset, true);
assert.equal(manifest.source.actSha256, hash(read('tmp/ro-pad-pets/4_pd_tamadora.act')));
assert.equal(manifest.source.sprSha256, hash(read('tmp/ro-pad-pets/4_pd_tamadora.spr')));
assert.equal(manifest.source.act, 'data/sprite/npc/4_pd_tamadora.act');
assert.equal(act.actions.length, 56);
assert.equal(spr.frames.length, 58);
assert.equal(census.petCandidates.length, 7);
assert.equal(census.petCandidates.filter((candidate) => candidate.webConvertible).length, 1);
assert.ok(census.petCandidates.every((candidate) => candidate.status === 'WEB_READY' || candidate.status === 'ASSET_INCOMPLETE'));

for (const [name, animation] of Object.entries(manifest.animations)) {
  const bytes = read(`ops/ro-stack/dashboard/assets/pets/tamadora/${animation.file}`);
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.width, animation.frames * manifest.logicalCell.width);
  assert.equal(metadata.height, 8 * manifest.logicalCell.height);
  assert.equal(metadata.hasAlpha, true);
  assert.equal(manifest.outputs[name].sha256, hash(bytes));
  assert.equal(animation.originalFrameCounts.length, 8);
  assert.equal(animation.directionDelayMs.length, 8);
  for (let direction = 0; direction < 8; direction++) {
    assert.equal(animation.originalFrameCounts[direction], act.actions[animation.actGroup * 8 + direction].frames.length);
    assert.equal(animation.directionDelayMs[direction], act.actions[animation.actGroup * 8 + direction].delay);
  }
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let direction = 0; direction < 8; direction++) for (let frame = 0; frame < animation.frames; frame++) {
    const x0 = frame * manifest.logicalCell.width;
    const y0 = direction * manifest.logicalCell.height;
    let visible = 0;
    for (let y = y0; y < y0 + manifest.logicalCell.height; y++) for (let x = x0; x < x0 + manifest.logicalCell.width; x++) {
      if (data[(y * info.width + x) * 4 + 3]) visible++;
    }
    assert.ok(visible > 20, `blank ${name} direction ${direction} frame ${frame}`);
    for (let y = y0; y < y0 + manifest.logicalCell.height; y++) {
      assert.equal(data[(y * info.width + x0) * 4 + 3], 0, `left clipping ${name}`);
      assert.equal(data[(y * info.width + x0 + manifest.logicalCell.width - 1) * 4 + 3], 0, `right clipping ${name}`);
    }
    for (let x = x0; x < x0 + manifest.logicalCell.width; x++) {
      assert.equal(data[(y0 * info.width + x) * 4 + 3], 0, `top clipping ${name}`);
      assert.equal(data[((y0 + manifest.logicalCell.height - 1) * info.width + x) * 4 + 3], 0, `bottom clipping ${name}`);
    }
  }
}

console.log('RO_PAD_PET_ASSET_PASS 7 candidates, 1 web-ready, 4 Tamadora animations');
