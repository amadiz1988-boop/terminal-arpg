import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const layouts = JSON.parse(
  readFileSync('ops/ro-stack/dashboard/skill-tree-layouts.json'),
);
const skills = JSON.parse(readFileSync('public/ro/data/skill-trees.json')).jobs;
const provenance = JSON.parse(
  readFileSync('docs/ro-ui-skill-asset-index.json'),
);
const uiAssets = JSON.parse(
  readFileSync('ops/ro-stack/dashboard/skill-ui-assets.json'),
);
assert.equal(layouts.columns, 7);
assert.equal(Object.keys(layouts.jobs).length, 79);
assert.equal(layouts.sourceSha256, provenance.layout.sourceSha256);
assert.equal(layouts.jobs.JT_ARCHER[2], 'AC_DOUBLE');
assert.equal(layouts.jobs.JT_ARCHER[17], 'AC_CONCENTRATION');
assert.equal(layouts.jobs.JT_HUNTER[0], 'HT_BEASTBANE');
assert.equal(layouts.jobs.JT_HUNTER[29], 'HT_CLAYMORETRAP');

const first = {
  1: 'SWORDMAN',
  2: 'MAGICIAN',
  3: 'ARCHER',
  4: 'ACOLYTE',
  5: 'MERCHANT',
  6: 'THIEF',
};
const advanced = {
  7: [1, 'KNIGHT'],
  8: [4, 'PRIEST'],
  9: [2, 'WIZARD'],
  10: [5, 'BLACKSMITH'],
  11: [3, 'HUNTER'],
  12: [6, 'ASSASSIN'],
  14: [1, 'CRUSADER'],
  15: [4, 'MONK'],
  16: [2, 'SAGE'],
  17: [6, 'ROGUE'],
  18: [5, 'ALCHEMIST'],
  19: [3, 'BARD'],
  20: [3, 'DANCER'],
};
const expanded = {
  23: 'SUPERNOVICE',
  24: 'GUNSLINGER',
  25: 'NINJA',
  4046: 'TAEKWON',
};
const expectedExtras = new Set([
  'WE_CALLBABY',
  'ALL_BUYING_STORE',
  'MC_CARTDECORATE',
  'BA_FROSTJOKER',
]);
let plotted = 0;
for (const [id, job] of Object.entries(skills)) {
  const keys =
    id === '0'
      ? ['NOVICE']
      : first[id]
        ? ['NOVICE', first[id]]
        : advanced[id]
          ? ['NOVICE', first[advanced[id][0]], advanced[id][1]]
          : expanded[id]
            ? [expanded[id]]
            : [];
  assert.ok(keys.length, `No tree mapping for ${job.name} (${id})`);
  const positions = new Map();
  for (const key of keys) {
    const original = layouts.jobs[`JT_${key}`];
    assert.ok(original, `Missing Client layout JT_${key}`);
    for (const [position, handle] of Object.entries(original)) {
      assert.ok(Number.isInteger(Number(position)) && Number(position) >= 0);
      if (
        job.skills.some((skill) => skill.handle === handle) &&
        !positions.has(handle)
      )
        positions.set(handle, Number(position));
    }
  }
  for (const skill of job.skills) {
    if (positions.has(skill.handle)) plotted++;
    else
      assert.ok(
        expectedExtras.has(skill.handle),
        `${job.name}: unexpected missing Client slot ${skill.handle}`,
      );
    for (const required of skill.requires)
      assert.ok(
        job.skills.some((entry) => entry.handle === required.handle),
        `${job.name}: ${skill.handle} prerequisite ${required.handle} missing`,
      );
  }
}
for (const asset of provenance.assets) {
  const bytes =
    asset.id === 'skill-empty-slot'
      ? Buffer.from(uiAssets.emptySlot.dataUrl.split(',')[1], 'base64')
      : readFileSync(asset.webOutput);
  const hash = createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash, asset.webOutputSha256, asset.id);
  assert.equal(asset.width, 24);
  assert.equal(asset.height, 24);
}
console.log(
  `PASS: ${Object.keys(skills).length} playable jobs, ${plotted} original-position skill placements, ${provenance.assets.length} original image hashes`,
);
