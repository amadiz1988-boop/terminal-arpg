// Census of every hunting label on the original RO World Map
// (worldmap_mob.bmp, served as world-map.webp) against the Player projection.
// Original labels presume a map is farmable; a map stays closed only for an
// exclusion reason accepted by Project Control, otherwise it is escalated.
import assert from 'node:assert/strict';
import { access, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildPlayerWorldMapProjection } from '../ops/ro-stack/persistent-agent/player-world-map-projection.mjs';
import { loadWorldMapTestCatalog } from './lib/world-map-test-catalog.mjs';
import { detectWhiteLevelLabels } from './lib/world-map-level-labels.mjs';

const root = resolve(import.meta.dirname, '..');
const native = process.env.RO_RATHENA_ROOT ?? 'C:/Users/Administrator/source/ghost-island-rathena';
const image = join(root, 'public/ro/client/world-map/world-map.webp');
await access(image).catch(() => { throw new Error('PRIVATE_WORLD_MAP_IMAGE_REQUIRED ' + image); });

// White level numbers, transcribed per detected region from the bitmap.
const WHITE_LEVELS = {
  'region-1': 90,
  'region-2': 90,
  'region-9': 81,
  'region-10': 90,
  'region-12': 50,
  'region-13': 90,
  'region-20': 103,
  'region-21': 83,
  'region-22': 81,
  'region-28': 83,
  'region-31': 101,
  'region-32': 101,
  'region-33': 107,
  'region-34': 108,
  'region-35': 91,
  'region-36': 87,
  'region-38': 85,
  'region-39': 80,
  'region-40': 75,
  'region-41': 75,
  'region-45': 87,
  'region-50': 99,
  'region-51': 86,
  'region-52': 84,
  'region-54': 81,
  'region-55': 80,
  'region-56': 73,
  'region-57': 73,
  'region-69': 95,
  'region-72': 81,
  'region-73': 85,
  'region-77': 92,
  'region-80': 100,
  'region-82': 62,
  'region-83': 101,
  'region-89': 110,
  'region-90': 105,
  'region-92': 25,
  'region-93': 32,
  'region-94': 70,
  'region-95': 65,
  'region-96': 75,
  'region-108': 86,
  'region-109': 23,
  'region-110': 13,
  'region-111': 26,
  'region-112': 59,
  'region-113': 55,
  'region-114': 47,
  'region-115': 75,
  'region-120': 79,
  'region-121': 4,
  'region-123': 5,
  'region-124': 13,
  'region-125': 14,
  'region-126': 3,
  'region-127': 21,
  'region-128': 38,
  'region-140': 95,
  'region-142': 19,
  'region-143': 13,
  'region-144': 19,
  'region-145': 11,
  'region-147': 6,
  'region-156': 44,
  'region-157': 45,
  'region-158': 38,
  'region-159': 15,
  'region-160': 1,
  'region-174': 49,
  'region-175': 55,
  'region-176': 34,
  'region-177': 53,
  'region-178': 25,
  'region-179': 30,
  'region-184': 70,
  'region-191': 18,
  'region-192': 34,
  'region-195': 23,
  'region-199': 68,
  'region-200': 67,
  'region-201': 76,
  'region-203': 2,
  'region-208': 8,
  'region-209': 29,
  'region-210': 55,
  'region-211': 48,
  'region-212': 45,
  'region-216': 55,
  'region-217': 57,
  'region-222': 18,
  'region-224': 6,
  'region-226': 47,
  'region-227': 48,
  'region-228': 61,
  'region-229': 33,
  'region-230': 9,
  'region-231': 14,
  'region-238': 17,
  'region-239': 61,
  'region-242': 48,
  'region-243': 55,
  'region-244': 16,
  'region-245': 63,
};
// Red dungeon boxes. BOX_ON_REGION: the box is the region's rectangle.
// LEADER_LINE: the box's red line points into the listed regions.
const RED_LABELS = [
  { regions: 'region-4', name: '達那托斯之塔', level: '110~130', evidence: 'BOX_ON_REGION' },
  { regions: 'region-5', name: '深淵湖水地下洞穴', level: '120~130', evidence: 'BOX_ON_REGION' },
  { regions: 'region-6', name: '諾可羅德', level: '100~110', evidence: 'BOX_ON_REGION' },
  { regions: 'region-7', name: '優配擂斯', level: '110~120', evidence: 'BOX_ON_REGION' },
  { regions: 'region-24', name: '神殿聖域', level: '120~130', evidence: 'BOX_ON_REGION' },
  { regions: 'region-25', name: '冰洞', level: '100~110', evidence: 'BOX_ON_REGION' },
  { regions: 'region-26', name: '機械人形工廠', level: '110~120', evidence: 'BOX_ON_REGION' },
  { regions: 'region-23|region-42|region-43', name: '奧丁神殿', level: '120~130', evidence: 'LEADER_LINE' },
  { regions: 'region-98', name: '托爾火山洞窟', level: '130~140', evidence: 'LEADER_LINE' },
  { regions: 'region-87', name: '生體試驗研究所', level: '130~140', evidence: 'BOX_ON_REGION' },
  { regions: 'region-85', name: '礦山洞穴', level: '90~100', evidence: 'BOX_ON_REGION' },
  { regions: 'region-97', name: '妙勒尼廢棄礦場', level: '40~50', evidence: 'BOX_ON_REGION' },
  { regions: 'region-84', name: '艾爾帕蘭鐘塔', level: '80~90', evidence: 'BOX_ON_REGION' },
  { regions: 'region-117', name: '克雷斯特漢姆古城', level: '70~130', evidence: 'BOX_ON_REGION' },
  { regions: 'region-139', name: '吉芬地下密穴', level: '60~70', evidence: 'BOX_ON_REGION' },
  { regions: 'region-155', name: '海底洞窟', level: '50~60', evidence: 'BOX_ON_REGION' },
  { regions: 'region-163', name: '葛敏尼亞', level: '120~130', evidence: 'BOX_ON_REGION' },
  { regions: 'region-165', name: '樹木裡的異界通路', level: '100~110', evidence: 'BOX_ON_REGION' },
  { regions: 'region-171', name: '斐揚地下', level: '60~70', evidence: 'BOX_ON_REGION' },
  { regions: 'region-181', name: '獸人地下洞窟', level: '50~60', evidence: 'BOX_ON_REGION' },
  { regions: 'region-185', name: '無名島', level: '120~130', evidence: 'BOX_ON_REGION' },
  { regions: 'region-198', name: '普隆德拉地下水道', level: '20~30', evidence: 'BOX_ON_REGION' },
  { regions: 'region-194', name: '金字塔迷宮', level: '50~60', evidence: 'BOX_ON_REGION' },
  { regions: 'region-207', name: '史芬克斯密穴', level: '70~80', evidence: 'BOX_ON_REGION' },
  { regions: 'region-233', name: '西邊洞穴加露', level: '100~110', evidence: 'BOX_ON_REGION' },
  { regions: 'region-240', name: '北邊洞穴盧安達', level: '60~70', evidence: 'BOX_ON_REGION' },
  { regions: 'region-241', name: '東邊洞穴馬吾', level: '30~40', evidence: 'BOX_ON_REGION' },
  { regions: 'region-248', name: '螞蟻地獄密穴', level: '30~40', evidence: 'BOX_ON_REGION' },
  { regions: 'region-221', name: '沉沒之船', level: '40~50', evidence: 'BOX_ON_REGION' },
  { regions: 'region-249', name: '烏龜島', level: '90~100', evidence: 'BOX_ON_REGION' },
];

const context = await loadWorldMapTestCatalog(root, native);
const regions = new Map(context.mapInfo.worldMap.regions.map((r) => [r.regionId, r]));
const detected = await detectWhiteLevelLabels(image, context.mapInfo.worldMap.regions);
assert.equal(detected.filter((l) => !l.regionId).length, 0, 'white label outside any region');
assert.deepEqual([...new Set(detected.map((l) => l.regionId))].sort(),
  Object.keys(WHITE_LEVELS).sort(), 'detected white labels differ from transcription');
assert.equal(detected.length, Object.keys(WHITE_LEVELS).length, 'two labels share a region');
for (const label of RED_LABELS) for (const id of label.regions.split('|')) {
  assert.ok(regions.has(id), id);
  if (label.evidence === 'BOX_ON_REGION') assert.equal(regions.get(id).labelKind, 'red', id);
}
// lou_dun01 is tagged red only because the 無名島 and 樹木裡的異界通路 boxes
// overlap its rectangle; every other red region carries its own box.
const redRegions = new Set(RED_LABELS.flatMap((l) => l.regions.split('|')));
const unmatchedRed = context.mapInfo.worldMap.regions
  .filter((r) => r.labelKind === 'red' && !redRegions.has(r.regionId)).map((r) => r.mapId);
assert.deepEqual(unmatchedRed, ['lou_dun01']);

const savedPointSources = await Promise.all(['npc/kafras/kafras.txt', 'npc/re/kafras/kafras.txt']
  .map(async (path) => ({ path, text: await readFile(join(native, path), 'utf8') })));
const projection = buildPlayerWorldMapProjection({ ...context, savedPointSources });
const hiddenRows = new Map(JSON.parse(execFileSync(process.execPath,
  [join(root, 'scripts/audit-hidden-world-map-v2.mjs')], { maxBuffer: 1 << 28 }).toString())
  .rows.map((row) => [row.id, row]));

const nativeSource = (await readFile(join(native, 'src/map/persistent_agent.cpp'), 'utf8')).split(/\r?\n/);
const nativeLine = (needle, after = 0) =>
  `src/map/persistent_agent.cpp:${nativeSource.findIndex((l, i) => i >= after && l.includes(needle)) + 1}`;
const teleportStart = nativeSource.findIndex((l) => l.startsWith('void process_world_map_teleport('));
const NATIVE = {
  pathRule: nativeLine('strstr(spawn->filepath, "npc/re/mobs/fields/")'),
  nowarpto: nativeLine('destination->getMapFlag(MF_NOWARPTO)', teleportStart),
  restricted: nativeLine('destination->getMapFlag(MF_RESTRICTED)', teleportStart),
  anchor: nativeLine('anchor_x = payload.at("anchorX")', teleportStart),
};

function classifyClosed(row) {
  const flagSource = (value) => row.sourceEvidence.flags.find((f) => f.value === value)?.source;
  if (!row.mapExists || !row.loaded || !row.cached)
    return { category: 'MAP_MISSING_OR_UNLOADABLE', acceptable: true,
      blocker: `index=${row.mapExists} loaded=${row.loaded} cache=${row.cached}`, owner: 'NONE' };
  if (row.instance)
    return { category: 'INSTANCE_DYNAMIC_EVENT_ONLY', acceptable: true, blocker: row.instance.source, owner: 'NONE' };
  if (row.ordinaryCount === 0) {
    const bossOnly = row.staticSpawns.length > 0;
    return { category: 'NO_PERSISTENT_COMBAT_CONTENT', acceptable: true, owner: 'NONE',
      blocker: bossOnly ? `only Boss-class or champion permanent spawns (${row.staticSpawns[0].source})`
        : row.sourceEvidence.dynamicSpawns.length ? `only script-created spawns (${row.sourceEvidence.dynamicSpawns[0]})`
          : 'no monster declaration in active Renewal scripts' };
  }
  if (row.restricted.includes('nowarpto'))
    return { category: 'MAP_MISSING_OR_UNLOADABLE', acceptable: true, owner: 'NONE',
      blocker: `rAthena mapflag nowarpto (${flagSource('nowarpto')}) denies direct warp entry; Native rejects at ${NATIVE.nowarpto}` };
  if (row.restricted.length)
    return { category: 'NATIVE_ADMISSION_RULE_BUG', acceptable: false, owner: 'Native',
      blocker: `mapflag ${row.restricted.join(',')} (${flagSource(row.restricted[0])}) rejected at ${NATIVE.restricted}; flag restricts items/skills and does not block entry`,
      fix: 'Admit restricted-zone maps to farm teleport, keeping zone item/skill rules' };
  if (row.nativeNormalCount === 0)
    return { category: 'NATIVE_ADMISSION_RULE_BUG', acceptable: false, owner: 'Native',
      blocker: `permanent ordinary spawns in ${row.staticSpawns.find((s) => s.ordinary).source.split(':')[0]} rejected by source-path rule at ${NATIVE.pathRule}`,
      fix: 'Admit ordinary permanent spawns from every active monster script, excluding boss/MVP/champion' };
  if (!row.landing)
    return { category: 'NATIVE_NO_AUTHORED_ARRIVAL', acceptable: false, owner: 'Native',
      blocker: `no portal or literal script warp enters the map; Native requires a caller anchor at ${NATIVE.anchor}`,
      fix: 'Accept a server-chosen random walkable landing (rAthena warp "map",0,0) when no authored arrival exists' };
  return { category: 'WEB_FALSE_NEGATIVE', acceptable: false, owner: 'A', blocker: row.projectionReason ?? 'HIDDEN' };
}

const destinations = new Map();
for (const [regionId, level] of Object.entries(WHITE_LEVELS))
  for (const map of regions.get(regionId).mapIds)
    destinations.set(map, { label: `Lv ${level}`, kind: 'WHITE', regionId });
for (const label of RED_LABELS) for (const regionId of label.regions.split('|'))
  for (const map of regions.get(regionId).mapIds)
    destinations.set(map, { label: `${label.name} ${label.level}`, kind: 'RED', regionId });

const rows = [...destinations].map(([map, origin]) => {
  const summary = context.mapInfo.maps[map];
  const projected = projection.rows.get(map);
  const region = regions.get(origin.regionId);
  const base = { map, name: summary?.name ?? map, ...origin, root: region.mapId,
    floor: region.mapId === map ? 'ROOT' : 'CHILD' };
  if (projected?.kind === 'farm')
    return { ...base, open: true, exists: true, persistent: true, count: projected.normalMonsterCount,
      direct: true, town: false, category: 'PLAYER_FARMABLE', acceptable: null, blocker: '', owner: '', fix: '' };
  const hidden = hiddenRows.get(map);
  assert.ok(hidden, `closed labeled map missing from hidden audit: ${map}`);
  return { ...base, open: false, exists: hidden.mapExists, persistent: hidden.persistent,
    count: hidden.ordinaryCount, direct: hidden.directStaticValid, town: hidden.town, ...classifyClosed(hidden) };
}).sort((a, b) => Number(a.regionId.slice(7)) - Number(b.regionId.slice(7)) || a.map.localeCompare(b.map));

const closed = rows.filter((r) => !r.open);
const summary = {
  labels: Object.keys(WHITE_LEVELS).length + RED_LABELS.length,
  whiteLabels: Object.keys(WHITE_LEVELS).length, redLabels: RED_LABELS.length,
  destinations: rows.length, open: rows.filter((r) => r.open).length,
  closedAcceptable: closed.filter((r) => r.acceptable).length,
  closedUnacceptable: closed.filter((r) => !r.acceptable).length,
  webOwnedUnacceptable: closed.filter((r) => !r.acceptable && r.owner === 'A').length,
  nativeOwnedUnacceptable: closed.filter((r) => !r.acceptable && r.owner === 'Native').length,
  playerVisibleFarmMaps: [...projection.rows.values()].filter((r) => r.kind === 'farm').length,
  hiddenMaps: projection.hiddenMapCount,
};
assert.equal(summary.webOwnedUnacceptable, 0, 'Web-owned false negative remains');
assert.equal(summary.open + summary.closedAcceptable + summary.closedUnacceptable, summary.destinations);

// All permanent ordinary-spawn maps rejected only by the Native source-path
// rule, labeled or not.
const pathRejected = [...hiddenRows.values()].filter((r) => r.ordinaryCount > 0 &&
  r.nativeNormalCount === 0 && !r.restricted.length && !r.town).map((r) => ({
  map: r.id, labeled: destinations.has(r.id), count: r.ordinaryCount,
  source: r.staticSpawns.find((s) => s.ordinary).source }));

const yes = (v) => (v === null ? '' : v ? 'YES' : 'NO');
const cell = (v) => String(v ?? '').replaceAll('|', '\\|');
const table = (headers, data) => [`| ${headers.join(' | ')} |`,
  `| ${headers.map(() => '---').join(' | ')} |`,
  ...data.map((d) => `| ${d.map(cell).join(' | ')} |`)];
const doc = [
  '# World Map Original Hunting Label Census V1', '',
  'Every hunting label on the original RO World Map, reconciled against current canonical rAthena and the Player projection. Generated by `scripts/audit-original-hunting-labels.mjs`.', '',
  '- White labels: bold level numbers detected on the bitmap (`scripts/lib/world-map-level-labels.mjs`), one per World Map region; values transcribed per region and re-verified against detection on every run.',
  '- Red labels: dungeon boxes read from the bitmap and matched to the region whose rectangle is the box, or to the regions its leader line points into.',
  '- A label presumes every map in its region is Player farmable. A closed map needs an accepted exclusion reason; anything else is escalated to its owner.',
  '- Navigation, allowlists and parser coverage are not eligibility inputs. Farm travel is authoritative direct teleport.', '',
  '## Counts', '',
  `- ORIGINAL_HUNTING_LABEL_TOTAL = ${summary.labels} (white ${summary.whiteLabels}, red ${summary.redLabels})`,
  `- LABELED_DESTINATION_MAPS = ${summary.destinations}`,
  `- ORIGINAL_LABELLED_PLAYER_FARMABLE_COUNT = ${summary.open}`,
  `- ORIGINAL_LABELLED_CLOSED_ACCEPTABLE_REASON_COUNT = ${summary.closedAcceptable}`,
  `- ORIGINAL_LABELLED_CLOSED_UNACCEPTABLE_REASON_COUNT = ${summary.closedUnacceptable} (Web-owned ${summary.webOwnedUnacceptable}, Native-owned ${summary.nativeOwnedUnacceptable})`,
  `- PLAYER_VISIBLE_FARM_MAP_COUNT = ${summary.playerVisibleFarmMaps}; HIDDEN_MAP_COUNT = ${summary.hiddenMaps}`,
  '- `lou_dun01` carries a red tag only because two neighbouring boxes overlap its rectangle; it has no label of its own.', '',
  '## Closed labeled maps', '',
  ...table(['ORIGINAL_LABEL', 'MAP_ID', 'DISPLAY_NAME', 'CURRENT_PLAYER_VISIBLE', 'RATHENA_MAP_EXISTS',
    'RATHENA_PERSISTENT', 'PERMANENT_NORMAL_MONSTER_COUNT', 'DIRECT_TELEPORT_DESTINATION_VALID',
    'CURRENT_BLOCKER', 'BLOCKER_CATEGORY', 'ACCEPTABLE_EXCLUSION_REASON', 'FIX_REQUIRED', 'OWNER', 'REOPEN_CONDITION'],
  closed.map((r) => [r.label, r.map, r.name, 'NO', yes(r.exists), yes(r.persistent), r.count, yes(r.direct),
    r.blocker, r.category, yes(r.acceptable), yes(!r.acceptable), r.owner,
    r.acceptable ? 'rAthena source changes the proven condition' : r.fix])),
  '', '## Native source-path rejected maps', '',
  ...table(['MAP_ID', 'ORIGINAL_HUNTING_LABEL', 'PERMANENT_NORMAL_SPAWN', 'SPAWN_SOURCE', 'CURRENT_NATIVE_REJECTION',
    'ACCEPTABLE_EXCLUSION_REASON', 'CLASSIFICATION', 'OWNER'],
  pathRejected.map((r) => [r.map, yes(r.labeled), r.count, r.source, NATIVE.pathRule, 'NO',
    'NATIVE_ADMISSION_RULE_BUG', 'Native'])),
  '', '## All labeled destinations', '',
  ...table(['ORIGINAL_LABEL', 'LABEL_TYPE', 'REGION', 'ROOT', 'FLOOR', 'MAP_ID', 'DISPLAY_NAME',
    'CURRENT_PLAYER_VISIBLE', 'STATUS'],
  rows.map((r) => [r.label, r.kind, r.regionId, r.root, r.floor, r.map, r.name, yes(r.open), r.category])),
];
if (process.argv.includes('--write'))
  await writeFile(join(root, 'docs/project-control/world-map-original-hunting-label-census-v1.md'), `${doc.join('\n')}\n`);
console.log(JSON.stringify({ summary, closed: closed.map((r) => [r.map, r.category, r.owner]),
  pathRejected: pathRejected.map((r) => r.map) }));
