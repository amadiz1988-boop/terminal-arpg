import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { resolveSkillAsset } from '../ops/ro-stack/ro-asset-resolver.mjs';

const root = process.cwd();
const tree = JSON.parse(fs.readFileSync('public/ro/data/skill-trees.json', 'utf8'));
const index = JSON.parse(fs.readFileSync('docs/ro-asset-index/skills.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('public/ro/client/skills/manifest.json', 'utf8'));
const skills = new Map(Object.values(tree.jobs).flatMap((job) =>
  job.skills.map((skill) => [skill.handle, skill])));
assert.equal(Object.keys(tree.jobs).length, 24);
assert.equal(index.entries.length, skills.size);
assert.equal(Object.keys(manifest).length, skills.size);
for (const record of index.entries) {
  const skill = skills.get(record.internalName);
  assert.equal(record.skillId, skill?.id, record.internalName);
  const asset = manifest[record.internalName];
  assert.equal(asset?.skillId, record.skillId);
  assert.equal(asset?.source, record.iconSource);
  assert.equal(asset?.webPath, record.icon);
  const iconPath = path.join(root, 'public', record.icon.slice(1));
  const png = fs.readFileSync(iconPath);
  assert.equal(crypto.createHash('sha256').update(png).digest('hex'), asset.outputSha256, record.internalName);
  assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a', record.internalName);
  assert.equal(png.readUInt32BE(16), 24, record.internalName);
  assert.equal(png.readUInt32BE(20), 24, record.internalName);
  assert.equal(resolveSkillAsset(record.skillId).assetStatus, 'ready', record.internalName);
}
assert.equal(resolveSkillAsset(318).name, '冷笑話');
assert.equal(manifest.BA_FROSTJOKER.clientResourceAlias, 'BA_FROSTJOKE');
assert.match(manifest.BA_FROSTJOKER.source, /ba_frostjoke\.bmp$/i);
console.log(`PASS: ${Object.keys(tree.jobs).length} jobs, ${skills.size} verified Client skill icons`);
