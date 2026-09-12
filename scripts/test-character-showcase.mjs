import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { decodeAct } from './lib/ro-client-image.mjs';

const repo = process.cwd();
const root = join(repo, 'public', 'ro', 'client', 'showcase');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const app = readFileSync(
  join(repo, 'ops', 'ro-stack', 'dashboard', 'app.js'),
  'utf8',
);
const html = readFileSync(
  join(repo, 'ops', 'ro-stack', 'dashboard', 'index.html'),
  'utf8',
);

assert.equal(manifest.frameWidth, 96);
assert.equal(manifest.frameHeight, 160);
const showcaseJobs = [
  'novice',
  'swordsman',
  'mage',
  'archer',
  'acolyte',
  'merchant',
  'thief',
  'taekwon',
  'supernovice',
  'gunslinger',
  'ninja',
];
assert.deepEqual(
  Object.keys(manifest.body).sort(),
  showcaseJobs.flatMap((job) => [`${job}-female`, `${job}-male`]).sort(),
);
assert.equal(Object.keys(manifest.hair).length, 84);

async function assertActionSet(actions, names) {
  for (const actionName of names) {
    const action = actions[actionName];
    assert(action, `缺少 ${actionName}`);
    assert.equal(action.frameCounts.length, 8);
    assert.equal(action.anchors.length, 8);
    assert.deepEqual(
      action.anchors.map((anchors) => anchors.length),
      action.frameCounts,
    );
    for (const source of [action.src, action.backSrc].filter(Boolean)) {
      const path = join(repo, 'public', source.replace(/^\//, ''));
      assert(existsSync(path), `缺少 ${source}`);
      const metadata = await sharp(path).metadata();
      assert.equal(metadata.width, action.columns * manifest.frameWidth);
      assert.equal(metadata.height, 8 * manifest.frameHeight);
    }
  }
}

for (const collection of [manifest.body, manifest.hair]) {
  for (const actions of Object.values(collection)) {
    await assertActionSet(actions, [
      'stand',
      'walk',
      'sit',
      'attack',
      'bowAttack',
    ]);
  }
}
for (const job of showcaseJobs) {
  for (const sex of ['male', 'female']) {
    const source = manifest.body[`${job}-${sex}`].stand.src;
    const stats = await sharp(
      join(repo, 'public', source.replace(/^\//, '')),
    )
      .ensureAlpha()
      .stats();
    assert(stats.channels[3].max > 0, `${job}-${sex} 站立圖層不得為空`);
  }
}
for (const actions of Object.values(manifest.equipment.headTop[5583]))
  await assertActionSet(actions, ['stand', 'walk', 'sit', 'bowAttack']);
for (const actions of Object.values(manifest.equipment.weapon.bow))
  await assertActionSet(actions, ['stand', 'walk', 'sit', 'bowAttack']);
const edenHatStats = await sharp(
  join(
    repo,
    'public',
    manifest.equipment.headTop[5583].male.stand.frontSrc.replace(/^\//, ''),
  ),
)
  .ensureAlpha()
  .stats();
const bowStats = await sharp(
  join(
    repo,
    'public',
    manifest.equipment.weapon.bow['archer-male'].bowAttack.frontSrc.replace(
      /^\//,
      '',
    ),
  ),
)
  .ensureAlpha()
  .stats();
assert(edenHatStats.channels[3].max > 0, '伊甸園帽圖層不得為空');
assert(bowStats.channels[3].max > 0, '弓攻擊圖層不得為空');
for (const source of Object.values(manifest.controls)) {
  const path = join(repo, 'public', source.replace(/^\//, ''));
  assert(existsSync(path), `缺少 ${source}`);
  const metadata = await sharp(path).metadata();
  assert.equal(metadata.width, 14);
  assert.equal(metadata.height, 14);
}

const archerAct = decodeAct(
  readFileSync(
    join(repo, 'tmp', 'ro-showcase-bodies', 'male', 'archer.act'),
  ),
);
assert.equal(archerAct.actions.length, 104);
assert.equal(archerAct.actions.slice(0, 8).length, 8);
assert.equal(archerAct.actions.slice(8, 16).length, 8);
assert.equal(archerAct.actions.slice(16, 24).length, 8);
assert.equal(archerAct.actions.slice(40, 48).length, 8);

assert.match(html, /id="paperdollHairBackLayer"/);
assert.match(html, /id="paperdollBodyLayer"/);
assert.match(html, /id="paperdollHairFrontLayer"/);
assert.match(html, /id="paperdollEquipmentVisible"/);
assert.match(html, /id="paperdollRotateLeft"/);
assert.match(html, /id="paperdollRotateRight"/);
assert.match(html, /左右拖曳角色可查看八個方向/);
assert.equal((html.match(/paperdoll-equipment-layer/g) ?? []).length, 4);
assert.equal((html.match(/data-showcase-action=/g) ?? []).length, 4);
assert.match(
  app,
  /const cycle = \['stand', 'sit', 'stand', 'walk', 'attack'\]/,
);
assert.match(app, /setPointerCapture/);
assert.match(app, /const showcaseCycleDuration = 10000/);
assert.match(app, /const showcaseManualPauseDuration = 60000/);
assert.match(app, /\['attack', 1200\]/);
assert.match(app, /\(rank - 1\) \* 900/);
assert.match(app, /setupRankingCardRotation/);
assert.match(app, /rotateRankingCard/);
assert.match(app, /layerAnchorOffset/);
assert.match(app, /#paperdollRotateLeft/);
assert.match(app, /#paperdollRotateRight/);
assert.match(app, /\['stand', 'sit'\]\.includes\(characterShowcase\.action\)/);
assert.match(app, /preloadCharacterShowcase/);
assert.match(app, /ro-showcase-equipment-visible/);
assert.match(app, /\(characterShowcase\.direction \+ step \+ 8\) % 8/);
for (const [classId, job] of [
  [0, 'novice'],
  [1, 'swordsman'],
  [2, 'mage'],
  [3, 'archer'],
  [4, 'acolyte'],
  [5, 'merchant'],
  [6, 'thief'],
  [21, 'taekwon'],
  [23, 'supernovice'],
  [24, 'gunslinger'],
  [25, 'ninja'],
])
  assert.match(app, new RegExp(`${classId}: '${job}'`));

console.log(
  '角色展示台測試通過：11 個開放職業的男女紙娃娃、固定站坐、十秒輪播、一分鐘手動暫停、預載旋轉與裝備外觀均已接線。',
);
