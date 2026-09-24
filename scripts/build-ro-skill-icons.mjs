import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Writable } from 'node:stream';
import sharp from 'sharp';
import { openGrf } from './ro-grf.mjs';

const root = process.cwd();
const archivePath = path.join(process.env.RO_CLIENT_DIR ?? 'C:\\Program Files (x86)\\Gravity\\RagnarokOnline', 'data.grf');
const treePath = path.join(root, 'public/ro/data/skill-trees.json');
const outputRoot = path.join(root, 'public/ro/client/skills');
const indexPath = path.join(root, 'docs/ro-asset-index/skills.json');
const manifestPath = path.join(outputRoot, 'manifest.json');
const expectedArchiveSha256 = '1c7d68f70714937abbd3741a6b3aea34a7ed9da63428941d5df453efacd1c0ad';
const sourceAliases = new Map([
  // Client skillinfolist.lub and pinned twRO skillnametable both use BA_FROSTJOKE.
  ['BA_FROSTJOKER', 'BA_FROSTJOKE'],
]);
const localizedAliases = new Map([['BA_FROSTJOKER', '冷笑話']]);
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

function decodeBmp(bitmap) {
  if (bitmap.toString('ascii', 0, 2) !== 'BM') throw new Error('Client icon is not BMP');
  const pixelOffset = bitmap.readUInt32LE(10);
  const dibSize = bitmap.readUInt32LE(14);
  const width = bitmap.readInt32LE(18);
  const signedHeight = bitmap.readInt32LE(22);
  const height = Math.abs(signedHeight);
  const bits = bitmap.readUInt16LE(28);
  const compression = bitmap.readUInt32LE(30);
  if (width !== 24 || height !== 24 || ![8, 24].includes(bits) || compression !== 0) {
    throw new Error(`Unexpected Client icon format ${width}x${height}/${bits}/${compression}`);
  }
  const stride = Math.ceil((width * bits / 8) / 4) * 4;
  const paletteStart = 14 + dibSize;
  const colors = bits === 8 ? bitmap.readUInt32LE(46) || 256 : 0;
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceY = signedHeight > 0 ? height - y - 1 : y;
    for (let x = 0; x < width; x += 1) {
      const source = pixelOffset + sourceY * stride + x * (bits === 8 ? 1 : 3);
      const palette = bits === 8 ? paletteStart + bitmap[source] * 4 : source;
      if (bits === 8 && bitmap[source] >= colors) throw new Error('Invalid Client icon palette');
      const blue = bitmap[palette];
      const green = bitmap[palette + 1];
      const red = bitmap[palette + 2];
      const target = (y * width + x) * 4;
      rgba[target] = red;
      rgba[target + 1] = green;
      rgba[target + 2] = blue;
      rgba[target + 3] = red > 245 && green < 12 && blue > 245 ? 0 : 255;
    }
  }
  return rgba;
}

const archiveHash = crypto.createHash('sha256');
await pipeline(fs.createReadStream(archivePath), new Writable({
  write(chunk, _encoding, done) { archiveHash.update(chunk); done(); },
}));
const archiveSha256 = archiveHash.digest('hex');
if (archiveSha256 !== expectedArchiveSha256) throw new Error(`Client archive changed: ${archiveSha256}`);
const tree = JSON.parse(fs.readFileSync(treePath, 'utf8'));
const index = fs.existsSync(indexPath)
  ? JSON.parse(fs.readFileSync(indexPath, 'utf8'))
  : { schemaVersion: 1, kind: 'skill', entries: [] };
const manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
const known = new Map(index.entries.map((entry) => [entry.internalName, entry]));
const skills = new Map();
for (const job of Object.values(tree.jobs)) {
  for (const skill of job.skills) {
    const previous = skills.get(skill.handle);
    if (previous && previous.id !== skill.id) throw new Error(`Conflicting skill ID: ${skill.handle}`);
    if (!previous) skills.set(skill.handle, { ...skill, job });
  }
}
const grf = openGrf(archivePath);
let created = 0;
try {
  const icons = new Map();
  for (const entry of grf.entries.values()) {
    if (!/[\\/]item[\\/][^\\/]+\.bmp$/i.test(entry.name)) continue;
    const basename = entry.name.split(/[\\/]/).at(-1).toLowerCase();
    const candidates = icons.get(basename) ?? [];
    candidates.push(entry);
    icons.set(basename, candidates);
  }
  fs.mkdirSync(outputRoot, { recursive: true });
  for (const skill of skills.values()) {
    const alias = sourceAliases.get(skill.handle) ?? skill.handle;
    const candidates = icons.get(`${alias.toLowerCase()}.bmp`) ?? [];
    if (candidates.length !== 1) throw new Error(`Client icon identity unresolved: ${skill.handle} (${candidates.length})`);
    const source = candidates[0];
    const bmp = grf.read(source);
    const sourceHash = sha256(bmp);
    const fileName = `${skill.handle}.png`;
    const outputPath = path.join(outputRoot, fileName);
    const webPath = `/ro/client/skills/${fileName}`;
    const sourcePath = `data.grf:data\\texture\\유저인터페이스\\item\\${alias.toLowerCase()}.bmp`;
    let png;
    if (fs.existsSync(outputPath)) {
      png = fs.readFileSync(outputPath);
      if (manifest[skill.handle]?.sourceSha256 !== sourceHash ||
          manifest[skill.handle]?.outputSha256 !== sha256(png)) {
        throw new Error(`Existing Client icon provenance mismatch: ${skill.handle}`);
      }
    } else {
      png = await sharp(decodeBmp(bmp), { raw: { width: 24, height: 24, channels: 4 } }).png().toBuffer();
      fs.writeFileSync(outputPath, png);
      created += 1;
    }
    manifest[skill.handle] = {
      skillId: skill.id, source: sourcePath, sourceSha256: sourceHash,
      webPath, outputSha256: sha256(png), width: 24, height: 24, alpha: true,
      ...(alias !== skill.handle ? { clientResourceAlias: alias } : {}),
    };
    if (known.has(skill.handle)) continue;
    const name = localizedAliases.get(skill.handle) ?? skill.name;
    const record = {
      skillId: skill.id,
      internalName: skill.handle,
      aegisName: skill.handle,
      zhHantName: name,
      canonicalZhHant: name,
      enName: skill.englishName || skill.handle,
      aliases: [...new Set([String(skill.id), skill.handle, alias, name])],
      maxLevel: skill.maxLevel,
      job: { id: skill.job.id, key: skill.job.key, zhHantName: skill.job.name },
      icon: webPath,
      iconSource: sourcePath,
      translationStatus: 'verified-zh-hant',
      assetStatus: 'ready',
      verificationGrade: 'B',
      provenance: [
        {
          tier: 1, sourceType: 'official-client-grf', sourcePath,
          sha256: sourceHash, archiveSha256, sourceWidth: 24, sourceHeight: 24,
          conversion: 'BMP to PNG with magenta key transparency', webSha256: sha256(png),
          verifiedAt: '2026-09-24',
        },
        { tier: 2, sourceType: 'rathena-skill-tree', sourcePath: 'db/re/skill_tree.yml', verifiedAt: '2026-09-24' },
        { tier: 3, sourceType: 'openkore-twro', sourcePath: 'tables/twRO/skillnametable.txt', verifiedAt: '2026-09-24' },
      ],
      ...(alias !== skill.handle ? { clientResourceAlias: alias } : {}),
    };
    index.entries.push(record);
    known.set(skill.handle, record);
  }
} finally {
  grf.close();
}
if (known.size !== skills.size || Object.keys(manifest).length !== skills.size) {
  throw new Error(`Incomplete icon coverage: ${known.size}/${Object.keys(manifest).length}/${skills.size}`);
}
index.entries.sort((a, b) => a.skillId - b.skillId);
index.updatedAt = '2026-09-24';
index.researchStatus = 'WEB READY';
index.coverage = { jobs: Object.keys(tree.jobs).length, skills: skills.size, originalIcons: skills.size, zhHantNames: skills.size };
fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
fs.writeFileSync(manifestPath, `${JSON.stringify(Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))), null, 2)}\n`);
console.log(`RO_SKILL_ICONS_BUILT jobs=${Object.keys(tree.jobs).length} skills=${skills.size} new=${created}`);
