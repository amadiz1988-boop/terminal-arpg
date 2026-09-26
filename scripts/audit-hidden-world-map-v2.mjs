// Offline source audit. It never changes the Player projection or game state.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { buildPlayerWorldMapProjection } from '../ops/ro-stack/persistent-agent/player-world-map-projection.mjs';
import { loadWorldMapTestCatalog } from './lib/world-map-test-catalog.mjs';
import { parseYamlRecords, rathenaFarmMonsterFlags } from './lib/ro-yaml-records.mjs';
import { collectScriptEvidence, loadActiveScripts, parseInstanceMaps,
  parseMapIndex, stripComments } from '../ops/ro-stack/persistent-agent/audit-world-map-inventory.mjs';

const root = resolve(import.meta.dirname, '..');
const native = process.env.RO_RATHENA_ROOT ?? 'C:/Users/Administrator/source/ghost-island-rathena';
const readNative = (path) => readFile(join(native, path), 'utf8');
const context = await loadWorldMapTestCatalog(root, native);
const savedPointSources = await Promise.all([
  'npc/kafras/kafras.txt', 'npc/re/kafras/kafras.txt',
].map(async (path) => ({ path, text: await readNative(path) })));
const projection = buildPlayerWorldMapProjection({ ...context, savedPointSources });
const hidden = [...new Set(context.mapInfo.worldMap.regions.flatMap((r) => r.mapIds))]
  .filter((id) => !projection.rows.has(id)).sort();
assert.equal(hidden.length, 105);

const indexRows = new Map(parseMapIndex(await readNative('db/map_index.txt'))
  .map((entry) => [entry.id, entry]));
const configured = new Set(), configuredSources = new Map();
const visitedConfigs = new Set();
async function loadMapConf(path) {
  if (visitedConfigs.has(path)) return;
  visitedConfigs.add(path);
  for (const [lineIndex, line] of stripComments(await readNative(path))
    .split(/\r?\n/).entries()) {
    const m = line.trim().match(/^(map|delmap|import):\s*(\S+)/);
    if (!m) continue;
    if (m[1] === 'import') await loadMapConf(m[2]);
    else if (m[1] === 'delmap') {
      if (m[2] === 'all') { configured.clear(); configuredSources.clear(); }
      else { configured.delete(m[2]); configuredSources.delete(m[2]); }
    } else { configured.add(m[2]); configuredSources.set(m[2], `${path}:${lineIndex + 1}`); }
  }
}
await loadMapConf('conf/maps_athena.conf');
await loadMapConf('conf/import/map_conf.txt');
const active = await loadActiveScripts(readNative);
const evidence = collectScriptEvidence(active.files, new Set(hidden));
const activeLines = new Map(active.files.map(({ path, text }) =>
  [path, stripComments(text).split(/\r?\n/)]));
const staticSpawnsByMap = new Map(hidden.map((id) => [id, []]));
const unparsedStaticSpawns = new Map(hidden.map((id) => [id, []]));
for (const [path, lines] of activeLines) for (const [lineIndex, line] of lines.entries()) {
  const declaration = line.match(/^\s*([a-z0-9_@-]+)(?:,\d+,\d+(?:,\d+)*)?\s+(monster|boss_monster)\s+/);
  if (!declaration || !staticSpawnsByMap.has(declaration[1])) continue;
  const fields = line.trim().split(/\t+/);
  const source = `${path}:${lineIndex + 1}`;
  const numbers = fields[3]?.match(/^(\d+),(\d+)(?:,|$)/) ??
    line.slice(declaration[0].length).match(/\s(\d+),(\d+)(?:,|$)/);
  if (!numbers || Number(numbers[1]) <= 0 || Number(numbers[2]) <= 0) {
    unparsedStaticSpawns.get(declaration[1]).push(source);
    continue;
  }
  staticSpawnsByMap.get(declaration[1]).push({ mobId: Number(numbers[1]),
    count: Number(numbers[2]), source, kind: declaration[2],
    habitat: path.includes('/mobs/dungeons/') ? 'NORMAL_DUNGEON' :
      path.includes('/mobs/fields/') ? 'NORMAL_FIELD' : null });
}
const dynamicSpawns = new Map(hidden.map((id) => [id, []]));
for (const [path, lines] of activeLines) for (const [lineIndex, line] of lines.entries()) {
  const match = line.match(/\b(?:monster|areamonster|boss_monster)\s+"([a-z0-9_]+)"/);
  if (match && dynamicSpawns.has(match[1]))
    dynamicSpawns.get(match[1]).push(`${path}:${lineIndex + 1}`);
}
const instances = new Map();
for (const path of ['db/re/instance_db.yml', 'db/import/instance_db.yml']) {
  try {
    for (const [map, detail] of parseInstanceMaps(await readNative(path), path))
      instances.set(map, detail);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
const mobDb = new Map(parseYamlRecords(await readNative('db/re/mob_db.yml'))
  .map((mob) => [mob.Id, mob]));
const routeRegistry = new Map(JSON.parse(await readFile(join(root,
  'ops/ro-stack/persistent-agent/standard-farm-map-release-registry.json'),
  'utf8')).maps.map((entry) => [entry.map, entry]));
const sources = new Map(context.sourceIndex.maps.map((row) => [row.map, row]));
const roots = new Map(context.mapInfo.worldMap.regions.flatMap((region) =>
  region.mapIds.map((id) => [id, region])));
function safeLanding(map, references) {
  const cached = context.mapCache.get(map);
  if (!cached) return null;
  const cells = inflateSync(cached.compressed);
  if (cells.length !== cached.width * cached.height) return null;
  const portals = context.graph.get(map) ?? [];
  const staticNpcs = references.flatMap(({ kind, source }) => {
    if (kind === 'monster' || kind === 'boss_monster') return [];
    const [path, line] = source.split(':');
    const match = activeLines.get(path)?.[Number(line) - 1]
      ?.match(/^\s*[a-z0-9_]+,(\d+),(\d+),\d+\s+/);
    return match ? [{ x: Number(match[1]), y: Number(match[2]) }] : [];
  });
  const nearPortal = (x, y) => portals.some((p) =>
    Math.abs(x - p.x) <= Math.max(8, p.xs) &&
    Math.abs(y - p.y) <= Math.max(8, p.ys));
  const nearNpc = (x, y) => staticNpcs.some((p) =>
    Math.abs(x - p.x) <= 8 && Math.abs(y - p.y) <= 8);
  // Prefer the center and deterministic nearby cells. This proves a source-level
  // candidate, not successful live pc_setpos or absence of dynamic NPCs.
  const cx = Math.floor(cached.width / 2), cy = Math.floor(cached.height / 2);
  for (let radius = 0; radius <= Math.max(cached.width, cached.height); radius++)
    for (let y = Math.max(1, cy - radius); y <= Math.min(cached.height - 2, cy + radius); y++)
      for (let x = Math.max(1, cx - radius); x <= Math.min(cached.width - 2, cx + radius); x++)
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) === radius &&
            [0, 3].includes(cells[y * cached.width + x]) &&
            !nearPortal(x, y) && !nearNpc(x, y))
          return { x, y };
  return null;
}

const rows = hidden.map((id) => {
  const e = evidence.get(id), summary = context.mapInfo.maps[id];
  const region = roots.get(id), source = sources.get(id);
  const route = routeRegistry.get(id);
  const mapExists = indexRows.has(id), loaded = configured.has(id);
  const cached = context.mapCache.has(id);
  const flags = new Set(e.flags.map((f) => f.value));
  const town = flags.has('town') || context.townFlagMaps.has(id);
  const restricted = ['nowarpto', 'restricted', 'gvg', 'battleground']
    .filter((flag) => flags.has(flag));
  const instance = instances.get(id) ?? null;
  const staticSpawns = staticSpawnsByMap.get(id).map((spawn) => {
    const mob = mobDb.get(spawn.mobId);
    const mobFlags = rathenaFarmMonsterFlags(mob);
    const [path] = spawn.source.split(':');
    const ordinary = spawn.kind === 'monster' && !path.endsWith('/championmobs.txt') &&
      !mobFlags.isBoss && !mobFlags.isResource &&
      mob?.Modes?.StatusImmune !== true && Number(mob?.Level) > 0;
    const nativeNormal = ordinary && /^npc\/re\/mobs\/(?:fields|dungeons)\//.test(path);
    return { ...spawn, ordinary, nativeNormal,
      boss: mobFlags.isBoss, resource: mobFlags.isResource,
      monsterName: mob?.Name ?? mob?.AegisName ?? null };
  });
  const ordinaryCount = staticSpawns.filter((s) => s.ordinary)
    .reduce((n, spawn) => n + spawn.count, 0);
  const nativeNormalCount = staticSpawns.filter((s) => s.nativeNormal)
    .reduce((n, spawn) => n + spawn.count, 0);
  const landing = safeLanding(id, e.references);
  const persistent = mapExists && loaded && cached && !instance;
  const special = Boolean(instance);
  const directStaticValid = persistent && !town && !special && !restricted.length &&
    nativeNormalCount > 0 && Boolean(landing);
  const navigationSupported = route?.routeClass === 'STANDARD' &&
    route?.farmSelectionAvailable === true && route?.standardRouteEdgeCount > 0;
  const navigationClass = route?.routeClass === 'STANDARD' ? 'STANDARD' :
    route?.routeClass === 'SPECIAL_TRANSPORT' ? 'SPECIAL_HOLD' :
    route?.routeClass === 'UNKNOWN' ? 'UNKNOWN' : 'UNSUPPORTED';
  return { id, displayName: summary.name, regionId: region.regionId,
    regionRoot: region.mapId, root: region.mapId === id,
    labelKind: region.labelKind, regionLabel: region.name,
    mapExists, loaded, cached, persistent, town, instance,
    projectCategory: summary.category, restricted,
    staticSpawns, ordinaryCount, nativeNormalCount,
    sourceIndexCount: source?.monsters?.length ?? 0,
    mapIndexSource: mapExists ? `db/map_index.txt:${indexRows.get(id).line}` : null,
    mapConfigSource: configuredSources.get(id) ?? null,
    landing, directStaticValid,
    navigationSupported, navigationClass,
    projectionReason: context.catalog.get(id)?.availabilityReason ?? null,
    unlocked: summary.unlocked, sourceEvidence: {
      flags: e.flags, references: e.references,
      spawnFiles: [...new Set(staticSpawns.map((s) => s.source))],
      dynamicSpawns: dynamicSpawns.get(id),
      unparsedStaticSpawns: unparsedStaticSpawns.get(id),
      instance: instance?.source ?? null,
    } };
});
const unparsed = rows.flatMap((row) => row.sourceEvidence.unparsedStaticSpawns);
assert.deepEqual(unparsed, [], `Unparsed permanent spawn declarations: ${unparsed.join(', ')}`);

// These extra service hubs have city, Kafra or service-NPC evidence in
// active rAthena files even where MF_TOWN was not set in the active flag lists.
const townServiceHubs = new Set([
  'dali', 'dali02', 'manuk', 'mid_camp', 'morocc', 'moscovia',
  'niflheim', 'splendide', 'xmas',
]);
const originalLabels = new Map([
  ['abyss_04', '深淵湖水地下洞穴 120~130'],
  ['alde_dun04', '艾爾帕蘭鐘塔 80~90'],
  ['c_tower4', '艾爾帕蘭鐘塔 80~90'],
  ['iz_dun05', '海底洞窟 50~60'],
  ['jupe_core', '優配擂斯 110~120'],
  ['juperos_02', '優配擂斯 110~120'],
  ['kh_dun01', '機械人形工廠 110~120'],
  ['kh_dun02', '機械人形工廠 110~120'],
  ['pay_dun04', '斐揚地下 60~70'],
  ['thor_v03', '托爾火山洞窟 130~140'],
  ['tur_dun05', '烏龜島 90~100'],
]);
for (const row of rows) {
  const actualTown = row.town || row.projectCategory === 'TOWN' ||
    townServiceHubs.has(row.id);
  const special = Boolean(row.instance);
  row.originalWorldMapLevelLabel = originalLabels.get(row.id) ?? null;
  row.shouldBePlayerFarmable = row.mapExists && row.loaded && row.cached &&
    !actualTown && !special && !row.restricted.length && row.ordinaryCount > 0;
  if (actualTown) row.primary = 'TOWN_NOT_FARM_MAP';
  else if (!row.mapExists || !row.loaded || !row.cached)
    row.primary = 'MAP_NOT_VALID_OR_LOADABLE';
  else if (special) row.primary = 'INSTANCE_DYNAMIC_EVENT_MAP';
  else if (row.sourceEvidence.dynamicSpawns.length > 0 &&
      row.ordinaryCount === 0 && row.staticSpawns.length === 0)
    row.primary = 'SCRIPT_ONLY_TEMPORARY_SPAWN';
  else if (row.staticSpawns.length && row.ordinaryCount === 0 &&
      row.staticSpawns.every((spawn) => spawn.boss ||
        spawn.source.includes('/championmobs.txt')))
    row.primary = 'BOSS_MVP_ONLY_MAP';
  else if (row.ordinaryCount > 0 && !row.restricted.length &&
      (row.sourceIndexCount === 0 || row.nativeNormalCount === 0))
    row.primary = 'SPAWN_SOURCE_PARSER_GAP';
  else if (row.directStaticValid)
    row.primary = 'PROJECTION_FALSE_NEGATIVE';
  else if (row.ordinaryCount > 0 && row.restricted.length)
    row.primary = 'OTHER_PROVEN_REASON';
  else row.primary = 'TRUE_NO_NORMAL_SPAWN';
  row.fixRequired = row.shouldBePlayerFarmable;
  row.rootChildMappingValid = row.regionRoot === row.id ||
    context.mapInfo.worldMap.regions.some((r) => r.mapId === row.regionRoot &&
      r.mapIds.includes(row.id));
}

const classes = [
  'TRUE_NO_NORMAL_SPAWN', 'TOWN_NOT_FARM_MAP', 'INSTANCE_DYNAMIC_EVENT_MAP',
  'TEST_GM_INTERNAL_MAP', 'BOSS_MVP_ONLY_MAP', 'SCRIPT_ONLY_TEMPORARY_SPAWN',
  'MAP_NOT_VALID_OR_LOADABLE', 'PROJECTION_FALSE_NEGATIVE',
  'MAP_ALIAS_ROOT_CHILD_MAPPING_GAP', 'SPAWN_SOURCE_PARSER_GAP',
  'VERSION_CONTENT_MISMATCH', 'OTHER_PROVEN_REASON',
];
assert.equal(rows.length, 105);
assert.equal(rows.filter((r) => !classes.includes(r.primary)).length, 0);
assert.equal(rows.filter((r) => !r.rootChildMappingValid).length, 0);
const counts = Object.fromEntries(classes.map((name) =>
  [name, rows.filter((r) => r.primary === name).length]));
assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), 105);
const originalLabelled = rows.filter((r) => r.originalWorldMapLevelLabel);
const falseNegatives = rows.filter((r) => r.directStaticValid &&
  r.shouldBePlayerFarmable);
const farmableChildren = falseNegatives.filter((r) => !r.root);
const rootsWithFarmableChildren = new Set(farmableChildren.map((r) => r.regionRoot));
const summary = {
  hiddenInput: hidden.length, audited: rows.length, unclassified: 0,
  classes: counts, originalLabelledHidden: originalLabelled.length,
  originalLabelledFalseNegative: originalLabelled.filter((r) =>
    r.shouldBePlayerFarmable && r.directStaticValid).length,
  rootWithFarmableChild: rootsWithFarmableChildren.size,
  farmableChildHidden: farmableChildren.length,
  rootChildFalseNegative: farmableChildren.length,
  allowlistOnlyHidden: falseNegatives.filter((r) =>
    r.sourceIndexCount > 0 && r.projectionReason === 'MAP_NOT_RELEASED').length,
  currentNoSafeLandingFalseNegatives: falseNegatives.filter((r) =>
    r.projectionReason === 'NO_SAFE_LANDING').length,
  falseNegativeTotal: falseNegatives.length,
  falseNegativeRootCauseGroups: {
    PROJECTION_LOGIC: falseNegatives.filter((r) =>
      r.primary === 'PROJECTION_FALSE_NEGATIVE').length,
    SPAWN_PARSER: falseNegatives.filter((r) =>
      r.primary === 'SPAWN_SOURCE_PARSER_GAP').length,
    ALLOWLIST: 0, MAP_ALIAS: 0, ROOT_CHILD: 0,
    DIRECT_TELEPORT_MAP_VALIDATION: 0, OTHER: 0,
  },
  crossLayerNativeAdmissionGap: rows.filter((r) =>
    r.primary === 'SPAWN_SOURCE_PARSER_GAP' && !r.directStaticValid).length,
  mapOnlySyntaxParserGap: rows.filter((r) =>
    r.primary === 'SPAWN_SOURCE_PARSER_GAP' && r.directStaticValid).length,
  navigationUnsupportedFalseNegatives: falseNegatives.filter((r) =>
    !r.navigationSupported).length,
  noEvidenceClassifiedNotFarmable: rows.filter((row) =>
    row.primary === 'TRUE_NO_NORMAL_SPAWN' && row.ordinaryCount > 0).length +
    unparsed.length,
  activeScriptCount: active.files.length,
};
assert.equal(rows.filter((row) => row.primary === 'TRUE_NO_NORMAL_SPAWN' &&
  row.ordinaryCount > 0).length, 0);
assert.equal(rows.filter((row) => row.directStaticValid &&
  (!row.shouldBePlayerFarmable || row.restricted.length > 0 || !row.landing)).length, 0);
assert.equal(Object.values(summary.falseNegativeRootCauseGroups)
  .reduce((a, b) => a + b, 0), summary.falseNegativeTotal);
assert.equal(summary.noEvidenceClassifiedNotFarmable, 0);

function sourceEvidence(row) {
  const spawns = row.staticSpawns.filter((s) => s.ordinary);
  const firstSpawn = spawns[0]?.source ?? row.staticSpawns[0]?.source;
  const flag = row.sourceEvidence.flags.find((f) =>
    row.restricted.includes(f.value))?.source;
  const rolePattern = row.primary === 'TOWN_NOT_FARM_MAP'
    ? /\/cities\/|\/warps\/cities\/|\/kafras\/|\/instances\//
    : /\/instances\/|\/quests\//;
  const role = row.sourceEvidence.references.find((r) =>
    rolePattern.test(r.source))?.source;
  return [row.mapIndexSource, row.mapConfigSource,
    row.cached ? 'rAthena-map-cache:present' : 'rAthena-map-cache:absent',
    firstSpawn ?? 'active-Renewal-scripts:0-static-spawns', flag,
    row.sourceEvidence.instance, row.sourceEvidence.dynamicSpawns[0], role,
    `catalog:${row.projectionReason ?? 'HIDDEN'}`].filter(Boolean).join('; ');
}
const yes = (value) => value ? 'YES' : 'NO';
const escapeCell = (value) => String(value ?? '—').replaceAll('|', '\\|');
const matrixHeaders = [
  'MAP_ID', 'DISPLAY_NAME', 'PRIMARY_CLASSIFICATION',
  'ORIGINAL_WORLDMAP_LEVEL_LABEL', 'MAP_EXISTS', 'MAP_PERSISTENT',
  'LEGAL_PERMANENT_NORMAL_MONSTER_SPAWN_COUNT', 'BOSS_MVP_ONLY',
  'INSTANCE_DYNAMIC_EVENT', 'TOWN', 'DIRECT_TELEPORT_DESTINATION_VALID',
  'NAVIGATION_SUPPORTED', 'NAVIGATION_CLASSIFICATION',
  'ROOT_CHILD_MAPPING_VALID', 'CURRENT_PLAYER_PROJECTION',
  'SHOULD_BE_PLAYER_FARMABLE', 'FIX_REQUIRED', 'EVIDENCE',
];
const matrix = rows.map((row) => [row.id, row.displayName, row.primary,
  row.originalWorldMapLevelLabel ?? 'NOT_VERIFIED_ON_BITMAP', yes(row.mapExists),
  yes(row.persistent), row.ordinaryCount,
  yes(row.primary === 'BOSS_MVP_ONLY_MAP'),
  yes(row.primary === 'INSTANCE_DYNAMIC_EVENT_MAP'),
  yes(row.primary === 'TOWN_NOT_FARM_MAP'),
  yes(row.directStaticValid), yes(row.navigationSupported), row.navigationClass,
  yes(row.rootChildMappingValid), 'HIDDEN',
  yes(row.shouldBePlayerFarmable), yes(row.fixRequired), sourceEvidence(row)]);
const nativeHead = execFileSync('git', ['-C', native, 'rev-parse', 'HEAD'],
  { encoding: 'utf8' }).trim();
const nativeCoreHash = createHash('sha256').update(await readFile(join(native,
  'src/map/persistent_agent.cpp'))).digest('hex');
const lines = [
  '# World Map Hidden Map Classification Audit V2', '',
  'Read-only classification of the 105 destinations hidden by the checked-in Player projection.',
  '',
  `- Web checkpoint: e8a5e4d9fa908fe11474a1f8e9053c6ac7c3a68a`,
  `- Native HEAD: ${nativeHead}`,
  `- Native persistent_agent.cpp SHA256: ${nativeCoreHash}`,
  `- Active Renewal scripts inspected: ${active.files.length}`,
  '- Evidence: `db/map_index.txt`, `conf/maps_athena.conf`, `conf/import/map_conf.txt`, all active imports from `npc/re/scripts_main.conf`, `db/re/mob_db.yml`, `db/re/map_cache.dat`, active map flags, `src/map/persistent_agent.cpp:4673` and `:8783`.',
  '- A normal spawn is a persistent ordinary monster declaration in a loaded script. Boss, MVP, champion, resource, script-created encounter and town spawns are separate. Native currently admits only `npc/re/mobs/fields/` and `npc/re/mobs/dungeons/` in `world_map_farm_min_level`.',
  '- `DIRECT_TELEPORT_DESTINATION_VALID` is source-level map eligibility: loaded/indexed/cached, admissible Native spawn and flags, plus a map-cache passable landing candidate clear of static NPC/portal positions. It does not assert a live command succeeded for a particular character, level, cooldown, Zeny or dynamic NPC occupancy.',
  '- `ORIGINAL_WORLDMAP_LEVEL_LABEL` is filled only for labels visually matched to the private original `worldmap_mob.bmp` / `world-map.webp` and a matching dungeon family. A red label describes a dungeon group, not an individual floor. Eleven hidden rows are confirmed matches. The bitmap has other white monster labels without a proven map-ID mapping, so the exhaustive labelled-hidden total remains unknown. Unmatched rows remain `NOT_VERIFIED_ON_BITMAP`; bitmap is corroboration, not spawn authority.',
  '- Current navigation capability is diagnostic. It does not change `SHOULD_BE_PLAYER_FARMABLE`.',
  '', '## Counts', '',
  `- TOTAL_HIDDEN_INPUT = ${summary.hiddenInput}; TOTAL_AUDITED = ${summary.audited}; UNCLASSIFIED_MAP_COUNT = ${summary.unclassified}`,
  ...classes.map((name) => `- ${name}_COUNT = ${counts[name]}`),
  '- CLASSIFICATION_TOTAL_CHECK = PASS',
  `- ORIGINAL_LABELLED_HIDDEN_COUNT = >=${summary.originalLabelledHidden} CONFIRMED; exhaustive total = UNKNOWN`,
  `- ORIGINAL_LABELLED_FALSE_NEGATIVE_COUNT = >=${summary.originalLabelledFalseNegative} CONFIRMED; exhaustive total = UNKNOWN`,
  '- ORIGINAL_LABELLED_HIDDEN_SUBSET_TRACED = PARTIAL; unambiguous dungeon-group matches only.',
  `- ROOT_WITH_FARMABLE_CHILD_COUNT = ${summary.rootWithFarmableChild}; FARMABLE_CHILD_HIDDEN_COUNT = ${summary.farmableChildHidden}; ROOT_CHILD_FALSE_NEGATIVE_COUNT = ${summary.rootChildFalseNegative}`,
  `- ALLOWLIST_ONLY_HIDDEN_COUNT = ${summary.allowlistOnlyHidden}`,
  `- FALSE_NEGATIVE_TOTAL = ${summary.falseNegativeTotal}; CURRENT_NO_SAFE_LANDING_FALSE_NEGATIVES = ${summary.currentNoSafeLandingFalseNegatives}`,
  `- FALSE_NEGATIVE_ROOT_CAUSE_GROUPS = ${JSON.stringify(summary.falseNegativeRootCauseGroups)}`,
  `- CROSS_LAYER_NATIVE_ADMISSION_GAP = ${summary.crossLayerNativeAdmissionGap}`,
  `- MAP_ONLY_SYNTAX_PARSER_GAP = ${summary.mapOnlySyntaxParserGap}`,
  `- NAVIGATION_UNSUPPORTED_BUT_STATICALLY_FARMABLE = ${summary.navigationUnsupportedFalseNegatives}; MAPS_HIDDEN_ONLY_DUE_TO_NAVIGATION_AFTER_CORRECTED_CLASSIFICATION = 0`,
  '- NO_EVIDENCE_CLASSIFIED_AS_NOT_FARMABLE_COUNT = 0; all no-spawn classifications used the active Renewal script scan.',
  '', '## Original labelled hidden subset', '',
  '| MAP_ID | BITMAP GROUP LABEL | NORMAL SPAWN COUNT | DIRECT TELEPORT SOURCE VALID | CLASS | SHOULD FARM |',
  '| --- | --- | ---: | --- | --- | --- |',
  ...originalLabelled.map((row) => `| ${row.id} | ${row.originalWorldMapLevelLabel} | ${row.ordinaryCount} | ${yes(row.directStaticValid)} | ${row.primary} | ${yes(row.shouldBePlayerFarmable)} |`),
  '', '## Matrix', '',
  `| ${matrixHeaders.join(' | ')} |`,
  `| ${matrixHeaders.map(() => '---').join(' | ')} |`,
  ...matrix.map((cells) => `| ${cells.map(escapeCell).join(' | ')} |`),
  '', '## Interpretation', '',
  '- `PROJECTION_FALSE_NEGATIVE`: current catalog derives landing from inbound portal graph, then Player projection requires its landing and `summary.unlocked`. Sixteen source-valid maps are suppressed by that Web gate despite source-level direct teleport candidates. Do not expose them before controller/Native acceptance and Browser testing.',
  '- `SPAWN_SOURCE_PARSER_GAP`: the existing Web inventory parser omits eight destinations with map-only monster syntax, including Brasilis, episode fields and Morocc Volcano. Native accepts those eight normal spawn files. Five further maps have active permanent ordinary mobs in Lasagna/Verus file families missed by the Web index; the current Native filepath predicate also rejects those five. Keep the two subgroups separate.',
  '- `OTHER_PROVEN_REASON`: active `nowarpto` / `restricted` flags make the Native farm teleport reject even when ordinary mobs spawn. No flag is silently bypassed.',
  '- No current Player projection, Native source, original bitmap, runtime, Production or player state was changed by this audit.',
];
if (process.argv.includes('--write-report')) {
  const target = join(root,
    'docs/project-control/world-map-hidden-map-classification-audit-v2.md');
  await writeFile(target, `${lines.join('\n')}\n`);
}
console.log(JSON.stringify({ summary, rows: process.argv.includes('--summary') ? undefined : rows },
  null, 2));
