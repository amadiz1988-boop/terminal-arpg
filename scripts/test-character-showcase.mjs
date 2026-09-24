import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
assert.equal(manifest.assetVersioning?.strategy, 'per-file-sha256-query');
assert.equal(manifest.assetVersioning?.hashPrefixLength, 16);
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
      assert.match(source, /\?v=[a-f0-9]{16}&b=\d+$/i, `${source} 需包含內容版本與建置世代`);
      const sourcePath = source.split('?', 1)[0];
      const path = join(repo, 'public', sourcePath.replace(/^\//, ''));
      assert(existsSync(path), `缺少 ${source}`);
      const metadata = await sharp(path).metadata();
      assert.equal(metadata.width, action.columns * manifest.frameWidth);
      assert.equal(metadata.height, 8 * manifest.frameHeight);
      const actualHash = createHash('sha256').update(readFileSync(path)).digest('hex');
      assert.equal(
        new URL(source, 'https://showcase.invalid').searchParams.get('v'),
        actualHash.slice(0, 16),
        `${source} 內容版本 hash`,
      );
      if (source === action.src && action.outputSha256)
        assert.equal(actualHash, action.outputSha256, `${source} 輸出 hash`);
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
      join(repo, 'public', source.split('?', 1)[0].replace(/^\//, '')),
    )
      .ensureAlpha()
      .stats();
    assert(stats.channels[3].max > 0, `${job}-${sex} 站立圖層不得為空`);
  }
}
for (const actions of Object.values(manifest.equipment.headTop[5583]))
  await assertActionSet(actions, ['stand', 'walk', 'sit', 'bowAttack']);
for (const actions of Object.values(manifest.equipment.headTop[2254]))
  await assertActionSet(actions, ['stand', 'walk', 'sit', 'attack', 'bowAttack']);
for (const actions of Object.values(manifest.equipment.headLow[2270]))
  await assertActionSet(actions, ['stand', 'walk', 'sit', 'attack', 'bowAttack']);
assert.equal(Object.keys(manifest.equipment.headgearByView).length, 28);
for (const entry of Object.values(manifest.equipment.headgearByView)) {
  assert(['headTop', 'headMid', 'headLow'].includes(entry.slot));
  for (const sex of ['male', 'female'])
    await assertActionSet(entry[sex], ['stand', 'walk', 'sit', 'attack', 'bowAttack']);
}
assert.deepEqual(
  manifest.equipment.headTop[5015],
  manifest.equipment.headTop[5055],
  '共用 View 101 的兩個 ItemID 必須使用相同原廠紙娃娃資產',
);
assert.deepEqual(
  manifest.equipment.headTop[2207],
  {
    male: manifest.equipment.headgearByView[4].male,
    female: manifest.equipment.headgearByView[4].female,
  },
  '未穿戴的花朵頭飾仍須由 View ID 索引覆蓋',
);
for (const actions of Object.values(manifest.equipment.weapon.bow))
  await assertActionSet(actions, ['stand', 'walk', 'sit', 'bowAttack']);
for (const weaponType of [
  'dagger', 'sword', 'twoHandSword', 'spear', 'twoHandSpear', 'axe',
  'twoHandAxe', 'club', 'rod', 'revolver', 'item1117', 'item1361',
  'item1460', 'item1461', 'item1613',
]) {
  assert(Object.keys(manifest.equipment.weapon[weaponType]).length > 0);
  for (const actions of Object.values(manifest.equipment.weapon[weaponType]))
    await assertActionSet(actions, ['stand', 'walk', 'sit', 'attack']);
}
assert.equal(Object.keys(manifest.equipment.shield.guard).length, 22);
for (const [shieldType, expectedPairs] of Object.entries({ guard: 22, buckler: 12, shield: 2, mirrorShield: 2 })) {
  assert.equal(Object.keys(manifest.equipment.shield[shieldType]).length, expectedPairs);
  for (const actions of Object.values(manifest.equipment.shield[shieldType]))
    await assertActionSet(actions, ['stand', 'walk', 'sit', 'attack']);
}
const edenHatStats = await sharp(
  join(
    repo,
    'public',
    manifest.equipment.headTop[5583].male.stand.frontSrc.split('?', 1)[0].replace(/^\//, ''),
  ),
)
  .ensureAlpha()
  .stats();
const bowStats = await sharp(
  join(
    repo,
    'public',
    manifest.equipment.weapon.bow['archer-male'].bowAttack.frontSrc.split('?', 1)[0].replace(
      /^\//,
      '',
    ),
  ),
)
  .ensureAlpha()
  .stats();
assert(edenHatStats.channels[3].max > 0, '伊甸園帽圖層不得為空');
assert(bowStats.channels[3].max > 0, '弓攻擊圖層不得為空');
const xiaomeiqinBody = manifest.body['swordsman-female'].attack;
const xiaomeiqinHair = manifest.hair['female-1'].attack;
const xiaomeiqinHat = manifest.equipment.headgearByView[465].female.attack;
assert.deepEqual(xiaomeiqinHat.frameCounts, xiaomeiqinBody.frameCounts);
assert.deepEqual(xiaomeiqinHat.frameCounts, xiaomeiqinHair.frameCounts);
assert.deepEqual(xiaomeiqinHat.anchors, xiaomeiqinBody.anchors);
assert.deepEqual(xiaomeiqinHat.anchors, xiaomeiqinHair.anchors);
assert.equal(xiaomeiqinHat.delay, xiaomeiqinBody.delay);
for (const [slot, itemId, name] of [['headTop', 2254, '天使髮圈'], ['headLow', 2270, '草葉']]) {
  for (const sex of ['male', 'female']) {
    const action = manifest.equipment[slot][itemId][sex].walk;
    const source = action.frontSrc ?? action.src;
    const stats = await sharp(join(repo, 'public', source.split('?', 1)[0].replace(/^\//, '')))
      .ensureAlpha()
      .stats();
    assert(stats.channels[3].max > 0, `${name} ${sex} 移動圖層不得為空`);
  }
}
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
assert.equal(archerAct.actions.slice(32, 40).length, 8);

assert.match(html, /id="paperdollHairBackLayer"/);
assert.match(html, /id="paperdollShieldBackLayer"/);
assert.match(html, /id="paperdollBodyLayer"/);
assert.match(html, /id="paperdollShieldFrontLayer"/);
assert.match(html, /id="paperdollHairFrontLayer"/);
assert.match(html, /id="paperdollHeadMidBackLayer"/);
assert.match(html, /id="paperdollHeadLowBackLayer"/);
assert.match(html, /id="paperdollHeadLowFrontLayer"/);
assert.match(html, /id="paperdollHeadMidFrontLayer"/);
assert.match(html, /id="paperdollEquipmentVisible"/);
assert.match(html, /id="paperdollRotateLeft"/);
assert.match(html, /id="paperdollRotateRight"/);
assert.match(html, /左右拖曳角色可查看八個方向/);
assert.equal((html.match(/paperdoll-equipment-layer/g) ?? []).length, 10);
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
assert.match(app, /\[1, 'headLow'\]/);
assert.match(app, /\[4, 'garment'\]/);
assert.match(app, /ranking-head-low-front-layer/);
assert.match(app, /ranking-head-mid-front-layer/);
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
