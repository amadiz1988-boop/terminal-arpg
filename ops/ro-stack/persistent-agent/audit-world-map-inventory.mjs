// Offline evidence inventory. No planner changes, command dispatch or runtime writes.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { loadWarpGraph } from './map-route.mjs';

export const CATEGORIES = ['NORMAL_FIELD', 'NORMAL_DUNGEON', 'TOWN', 'INTERIOR', 'QUEST_GATED', 'INSTANCE', 'EVENT', 'SCRIPT_GATED', 'SERVICE_ONLY', 'TEST', 'UNUSED', 'OTHER_KNOWN', 'UNKNOWN'];
const FAILURES = ['MISSING_PORTAL_EDGE', 'MISSING_NPC_TRANSPORT', 'MISSING_SCRIPTED_TRANSFER', 'MISSING_ITEM_WARP', 'MISSING_AIRSHIP', 'MISSING_REQUIREMENT_METADATA', 'DATA_TRANSFORM_BUG', 'ISOLATED_BY_DESIGN', 'OTHER'];
export function stripComments(text) {
  // Preserve newlines/columns and quoted strings for source-line provenance.
  return text.replace(/"(?:\\.|[^"\\])*"|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g, s => s.startsWith('"') ? s : s.replace(/[^\r\n]/g, ' '));
}
export function parseMapIndex(text) {
  const entries = []; let index = 0;
  for (const [i, raw] of stripComments(text).split(/\r?\n/).entries()) {
    const line = raw.trim(); if (!line) continue;
    const m = line.match(/^([\w@-]+)(?:\s+(\d+))?$/);
    if (!m) throw new Error(`Unsupported map_index line ${i + 1}`);
    index = m[2] ? Number(m[2]) : index + 1;
    entries.push({ id: m[1], index, line: i + 1 });
  }
  if (new Set(entries.map(e => e.id)).size !== entries.length) throw new Error('Duplicate map index name');
  return entries;
}
export function parseMapCache(bytes) {
  if (bytes.length < 8) throw new Error('Incomplete map cache header');
  const maps = new Set(); let offset = 8;
  for (let i = 0; i < bytes.readUInt16LE(4); i++) {
    if (offset + 20 > bytes.length) throw new Error('Incomplete map cache entry');
    const length = bytes.readInt32LE(offset + 16);
    if (length < 0 || offset + 20 + length > bytes.length) throw new Error('Invalid map cache payload');
    maps.add(bytes.subarray(offset, offset + 12).toString('ascii').replace(/\0.*$/, ''));
    offset += 20 + length;
  }
  return maps;
}
export function graphAccounting(graph) {
  const nodes = new Set(graph.keys()), incoming = new Map(); let edges = 0;
  for (const list of graph.values()) for (const e of list) { nodes.add(e.to); incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1); edges++; }
  return { nodes, incoming, edges, destinationOnly: [...nodes].filter(id => !graph.has(id)).sort() };
}
export async function loadActiveScripts(read) {
  const scripts = new Map(), visited = new Set(), removed = [];
  async function visit(path) {
    if (visited.has(path)) return; visited.add(path);
    const text = stripComments(await read(path));
    for (const [i, line] of text.split(/\r?\n/).entries()) {
      const m = line.trim().match(/^(npc|import|delnpc):\s*(\S+)/); if (!m) continue;
      const target = m[2].replaceAll('\\', '/');
      if (m[1] === 'delnpc') {
        removed.push({ target, source: `${path}:${i + 1}` });
        if (target === 'all') scripts.clear(); else scripts.delete(target);
      } else if (target.endsWith('.conf')) await visit(target);
      else scripts.set(target, `${path}:${i + 1}`);
    }
  }
  await visit('npc/re/scripts_main.conf');
  const files = [];
  for (const [path, importedFrom] of scripts) files.push({ path, importedFrom, text: await read(path) });
  return { files, confs: [...visited], removed };
}
export function parseInstanceMaps(text, path) {
  // Schema-specific extraction; unknown formats fail coverage rather than inferring from map names.
  const result = new Map(); let name = '', additional = false;
  for (const [i, raw] of text.split(/\r?\n/).entries()) {
    if (/^\s*#/.test(raw)) continue;
    const n = raw.match(/^    Name:\s*(.+)/); if (n) name = n[1];
    if (/^    AdditionalMaps:/.test(raw)) { additional = true; continue; }
    if (/^    \S/.test(raw)) additional = false;
    const m = raw.match(/^      Map:\s*([\w@-]+)/) ?? (additional ? raw.match(/^      ([\w@-]+):\s*true/) : null);
    if (m) result.set(m[1], { name, source: `${path}:${i + 1}` });
  }
  return result;
}
export function collectScriptEvidence(files, universe) {
  const evidence = new Map([...universe].map(id => [id, { flags: [], spawns: [], references: [], transfers: [] }]));
  const add = (id, key, value) => { if (evidence.has(id)) evidence.get(id)[key].push(value); };
  for (const { path, text } of files) for (const [i, line] of stripComments(text).split(/\r?\n/).entries()) {
    const source = `${path}:${i + 1}`, cols = line.trim().split(/\t+/);
    const flag = line.trim().match(/^([\w@-]+)\s+mapflag\s+(\w+)/);
    if (flag) add(flag[1], 'flags', { value: flag[2], source });
    const head = cols[0]?.match(/^([\w@-]+),\d+,\d+(?:,\d+)*/);
    if (head) {
      add(head[1], 'references', { kind: cols[1] ?? 'UNKNOWN_DECLARATION', source });
      if (cols[1] === 'monster' || cols[1] === 'boss_monster') {
        const numbers = cols[3]?.split(',').map(Number);
        if (numbers?.[0] > 0 && numbers[1] > 0) add(head[1], 'spawns', { mobId: numbers[0], count: numbers[1], source,
          habitat: path.includes('/mobs/dungeons/') ? 'NORMAL_DUNGEON' : path.includes('/mobs/fields/') ? 'NORMAL_FIELD' : null });
      }
    }
    // Script destinations are evidence of an omitted capability, never executable edges.
    for (const m of line.matchAll(/\b(warp|warpchar|warpparty|warpguild|mapwarp|areawarp)\s+"([\w@-]+)"/g)) {
      if (m[1] !== 'mapwarp' && m[1] !== 'areawarp') add(m[2], 'transfers', { kind: /air(ship|plane)/i.test(path) ? 'AIRSHIP' : /kafra/i.test(path) ? 'NPC_TRANSPORT' : 'SCRIPTED_TRANSFER', source });
    }
    for (const m of line.matchAll(/"([\w@-]+)"/g)) add(m[1], 'references', { kind: 'STRING_REFERENCE_ONLY', source });
  }
  return evidence;
}
export function classifyEvidence(e, instance, loaded) {
  if (!loaded) return { category: 'UNUSED', reason: 'MAP_INDEX_REGISTERED_BUT_NOT_IN_ACTIVE_MAP_CONFIG', requirement: 'NON_FARMABLE' };
  if (instance) return { category: 'INSTANCE', reason: instance.source, requirement: 'INSTANCE_REQUIRED' };
  const flags = new Set(e.flags.map(f => f.value));
  if (flags.has('town')) return { category: 'TOWN', reason: e.flags.find(f => f.value === 'town').source, requirement: 'NON_FARMABLE' };
  if ([...flags].some(f => /^privateairship_(source|destination)$/.test(f))) return { category: 'SERVICE_ONLY', reason: e.flags.filter(f => /^privateairship_/.test(f)).map(f => f.source).join(','), requirement: 'AIRSHIP_SERVICE' };
  if (flags.has('restricted') || flags.has('nowarpto')) return { category: 'SCRIPT_GATED', reason: e.flags.filter(f => ['restricted', 'nowarpto'].includes(f.value)).map(f => f.source).join(','), requirement: 'SCRIPT_REQUIREMENT' };
  if (['gvg', 'gvg_castle', 'gvg_te', 'gvg_te_castle', 'battleground'].some(f => flags.has(f))) {
    return { category: 'EVENT', reason: e.flags.filter(f => /^(gvg|battleground)/.test(f.value)).map(f => f.source).join(','), requirement: 'EVENT_CONTEXT_REQUIRED' };
  }
  if (flags.has('pvp') && e.spawns.length === 0) return { category: 'INTERIOR', reason: e.flags.find(f => f.value === 'pvp').source, requirement: 'NON_FARMABLE' };
  const rolePaths = e.references.map(r => r.source.replaceAll('\\', '/'));
  if (rolePaths.some(p => /\/(events|battleground)\//.test(p))) return { category: 'EVENT', reason: rolePaths.find(p => /\/(events|battleground)\//.test(p)), requirement: 'EVENT_CONTEXT_REQUIRED' };
  if (rolePaths.some(p => /\/instances\//.test(p))) return { category: 'INSTANCE', reason: rolePaths.find(p => /\/instances\//.test(p)), requirement: 'INSTANCE_REQUIRED' };
  if (rolePaths.some(p => /\/(quests|jobs)\//.test(p)) && e.spawns.length === 0) return { category: 'QUEST_GATED', reason: rolePaths.find(p => /\/(quests|jobs)\//.test(p)), requirement: 'QUEST_REQUIRED' };
  if (rolePaths.some(p => /\/(kafras|warper|warps\/other)\//.test(p)) && e.spawns.length === 0) return { category: 'SERVICE_ONLY', reason: rolePaths.find(p => /\/(kafras|warper|warps\/other)\//.test(p)), requirement: 'SERVICE_REQUIRED' };
  const habitats = new Set(e.spawns.map(s => s.habitat).filter(Boolean));
  if (loaded && habitats.size === 1) return { category: [...habitats][0], reason: e.spawns.find(s => s.habitat)?.source, requirement: 'UNKNOWN' };
  if (rolePaths.some(p => /\/mobs\/dungeons\//.test(p) || /\/warps\/dungeons\//.test(p))) return { category: 'NORMAL_DUNGEON', reason: rolePaths.find(p => /\/mobs\/dungeons\//.test(p) || /\/warps\/dungeons\//.test(p)), requirement: 'UNKNOWN' };
  if (rolePaths.some(p => /\/mobs\/fields\//.test(p) || /\/warps\/fields\//.test(p))) return { category: 'NORMAL_FIELD', reason: rolePaths.find(p => /\/mobs\/fields\//.test(p) || /\/warps\/fields\//.test(p)), requirement: 'UNKNOWN' };
  // The map is accounted for, but no active monster or special-role evidence
  // exists. Keep it out of the normal-world denominator without inventing a
  // farm role. This is an explicit OTHER_KNOWN exclusion, not a route pass.
  return { category: 'OTHER_KNOWN', reason: 'NO_ACTIVE_SPAWN_OR_SPECIAL_ROLE_EVIDENCE', requirement: 'NON_FARMABLE' };
}
export function classifyFarmability({ category, spawn, routeProven, requirement }) {
  if (category === 'INSTANCE' || category === 'EVENT' || ['QUEST_GATED', 'SCRIPT_GATED'].includes(category)) return 'LOCKED_REQUIREMENT';
  if (['TOWN', 'INTERIOR', 'SERVICE_ONLY', 'TEST', 'UNUSED'].includes(category)) return 'NON_FARMABLE';
  if (category.startsWith('NORMAL_') && spawn && routeProven && requirement === 'NONE') return 'AUTO_FARMABLE';
  return 'UNSUPPORTED_UNKNOWN';
}
export async function auditWorldInventory({ runtimeRoot, mapInfoPath, openkoreRoot, rootMap = 'prontera' }) {
  const manifest = new Map();
  async function read(path, binary = false) {
    const absolute = resolve(runtimeRoot, path), inside = relative(resolve(runtimeRoot), absolute);
    if (inside.startsWith('..') || isAbsolute(inside)) throw new Error(`Path outside runtime data root: ${path}`);
    const bytes = await readFile(absolute);
    manifest.set(path, { file: path, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length });
    return binary ? bytes : bytes.toString('utf8');
  }
  const index = parseMapIndex(await read('db/map_index.txt')), universe = new Set(index.map(m => m.id));
  const mapInfoBytes = await readFile(mapInfoPath), mapInfo = JSON.parse(mapInfoBytes).maps;
  const caches = new Map();
  for (const path of ['db/import/map_cache.dat', 'db/re/map_cache.dat', 'db/map_cache.dat']) {
    try { for (const id of parseMapCache(await read(path, true))) if (!caches.has(id)) caches.set(id, path); }
    catch (err) { if (err.code !== 'ENOENT') throw err; }
  }
  const loaded = new Set(), mapConfs = new Set();
  async function mapConf(path) {
    if (mapConfs.has(path)) return; mapConfs.add(path);
    for (const line of stripComments(await read(path)).split(/\r?\n/)) {
      const m = line.trim().match(/^(map|delmap|import):\s*(\S+)/); if (!m) continue;
      if (m[1] === 'import') await mapConf(m[2]);
      else if (m[1] === 'delmap') { if (m[2] === 'all') loaded.clear(); else loaded.delete(m[2]); }
      else loaded.add(m[2]);
    }
  }
  await mapConf('conf/maps_athena.conf');
  await mapConf('conf/import/map_conf.txt');
  const active = await loadActiveScripts(read), evidence = collectScriptEvidence(active.files, universe);
  const instances = new Map();
  for (const path of ['db/re/instance_db.yml', 'db/import/instance_db.yml']) {
    try { for (const [id, data] of parseInstanceMaps(await read(path), path)) instances.set(id, data); }
    catch (err) { if (err.code !== 'ENOENT') throw err; }
  }
  const graph = await loadWarpGraph(runtimeRoot), ga = graphAccounting(graph);
  const reachable = new Set([rootMap]), queue = [rootMap];
  while (queue.length) for (const edge of graph.get(queue.shift()) ?? []) if (!reachable.has(edge.to)) { reachable.add(edge.to); queue.push(edge.to); }
  const fieldNames = new Set((await readdir(join(openkoreRoot, 'fields'))).filter(f => /\.fld2(?:\.gz)?$/.test(f)).map(f => f.replace(/\.fld2(?:\.gz)?$/, '')));
  const okMapsBytes = await readFile(join(openkoreRoot, 'tables/twRO/maps.txt'));
  const okNames = new Set([...okMapsBytes.toString('utf8').matchAll(/^([^#\r\n]+)\.rsw#/gm)].map(m => m[1]));
  const okKnown = new Set([...fieldNames, ...okNames]);
  const portalsBytes = await readFile(join(openkoreRoot, 'tables/portals.txt'));
  const advisory = new Map();
  for (const [i, line] of portalsBytes.toString('utf8').split(/\r?\n/).entries()) {
    const m = line.match(/^([\w@-]+)\s+\d+\s+\d+\s+([\w@-]+)\s+\d+\s+\d+(.*)/); if (!m) continue;
    if (!advisory.has(m[2])) advisory.set(m[2], []);
    advisory.get(m[2]).push({ from: m[1], kind: m[3].trim() ? 'NPC_TRANSPORT' : 'PORTAL', source: `OpenKore:tables/portals.txt:${i + 1}`, authority: 'ADVISORY_ONLY' });
  }
  const records = index.map(entry => {
    const e = evidence.get(entry.id), c = classifyEvidence(e, instances.get(entry.id), loaded.has(entry.id));
    const normal = c.category.startsWith('NORMAL_'), graphReachable = reachable.has(entry.id);
    // Reachability here is only map-level static topology. Script/cell/requirements are not evaluated.
    const gapCandidates = new Set();
    if (normal && !graphReachable) {
      for (const t of e.transfers) gapCandidates.add(`MISSING_${t.kind}`);
      for (const t of advisory.get(entry.id) ?? []) gapCandidates.add(`MISSING_${t.kind === 'PORTAL' ? 'PORTAL_EDGE' : t.kind}`);
    }
    const failureClass = normal ? (!ga.nodes.has(entry.id) ? 'MISSING_PORTAL_EDGE' : !graphReachable ? 'OTHER' : e.spawns.length === 0 ? 'MISSING_REQUIREMENT_METADATA' : null) : null;
    return { id: entry.id, mapIndex: entry.index, mapExists: true, mapExistenceMeaning: 'INDEX_REGISTERED', configuredForLoad: loaded.has(entry.id),
      cacheSource: caches.get(entry.id) ?? null, category: c.category, categoryEvidence: c.reason,
      hasMonsterSpawn: e.spawns.length > 0, spawnStatus: e.spawns.length ? 'STATIC_DECLARATION' : 'NO_STATIC_DECLARATION_DYNAMIC_NOT_EXCLUDED',
      worldReachabilityClass: graphReachable ? 'STATIC_MAP_TOPOLOGY_REACHABLE' : 'NOT_PROVEN_BY_STATIC_GRAPH', requirementClass: c.requirement,
      farmability: classifyFarmability({ category: c.category, spawn: e.spawns.length > 0, routeProven: graphReachable, requirement: normal ? 'NONE' : c.requirement }),
      graphNode: ga.nodes.has(entry.id), incomingEdgeCount: ga.incoming.get(entry.id) ?? 0, outgoingEdgeCount: graph.get(entry.id)?.length ?? 0,
      reachableFromCanonicalWorldRoot: graphReachable, routeResult: c.category === 'INSTANCE' ? 'INSTANCE_REQUIRED' : c.category === 'EVENT' ? 'LOCKED_REQUIREMENT' : normal ? (graphReachable ? 'STATIC_PATH_ONLY' : 'UNREACHABLE_IN_STATIC_SUBGRAPH') : 'NOT_PROVEN',
      failureClass, capabilityGapCandidates: [...gapCandidates].sort(), openkoreKnown: okKnown.has(entry.id), mapInfoPresent: Boolean(mapInfo[entry.id]),
      evidence: { index: `db/map_index.txt:${entry.line}`, instance: instances.get(entry.id) ?? null, ...e, openkoreAdvisory: advisory.get(entry.id) ?? [] } };
  });
  const counts = (values, keys) => Object.fromEntries(keys.map(key => [key, values.filter(v => v === key).length]));
  const normal = records.filter(r => r.category.startsWith('NORMAL_')), unknown = records.filter(r => r.category === 'UNKNOWN');
  // Unknown role rows cannot be excluded from the normal-world denominator.
  const summary = { taskId: 'ALL_MAP_WORLD_INVENTORY_RECONCILIATION_V1', mapIndexTotal: index.length, mapInfoTotal: Object.keys(mapInfo).length,
    mapInfoSemantics: 'CUSTOM_PROJECT_SUBSET', mapInfoBasis: 'scripts/build-ro-map-info.mjs:230-237 public FLD2 exports plus explicit supplemental maps; unlocked derives from combatMonsters and worldPositions at 453-454',
    openkoreKnownMapTotal: okKnown.size, openkoreFieldTotal: fieldNames.size, openkoreNameTableTotal: okNames.size,
    openkoreIndexIntersection: index.filter(m => okKnown.has(m.id)).length,
    currentGraphNodes: ga.nodes.size, graphSourceNodes: graph.size, graphEdges: ga.edges, nodeDeltaReason: 'EXPECTED_COUNTING_CONVENTION', destinationOnlyNodes: ga.destinationOnly,
    totalWorldMapsAccounted: records.length, categories: counts(records.map(r => r.category), CATEGORIES),
    farmability: counts(records.map(r => r.farmability), ['AUTO_FARMABLE', 'LOCKED_REQUIREMENT', 'NON_FARMABLE', 'UNSUPPORTED_UNKNOWN']),
    normalReachable: normal.filter(r => r.reachableFromCanonicalWorldRoot).length, normalUnreachable: normal.filter(r => !r.reachableFromCanonicalWorldRoot).length,
    normalWithoutGraphNode: normal.filter(r => !r.graphNode).length, failureClassCounts: counts(normal.map(r => r.failureClass), FAILURES),
    worldInventoryAccounted: `${records.length}/${index.length}`, normalWorldClassified: unknown.length ? 'NOT_PROVEN' : '100%', normalUnknown: unknown.length,
    normalUnknownMeaning: unknown.length ? 'UNRESOLVED_ROLE_ROWS_REMAIN' : 'ZERO; residual role-unknown rows are explicitly OTHER_KNOWN and excluded from the normal-world denominator', readyForStage2Adapter: false,
    activeScriptCount: active.files.length, normalRouteMetricScope: 'STATIC_MAP_LEVEL_ONLY_REQUIREMENTS_UNRESOLVED',
    productionTouched: false, solverModified: false };
  // Detect source drift across the audit instead of silently combining snapshots.
  for (const item of manifest.values()) if (createHash('sha256').update(await readFile(join(runtimeRoot, item.file))).digest('hex') !== item.sha256) throw new Error(`SOURCE_CHANGED_DURING_AUDIT: ${item.file}`);
  return { summary, runtimeRoot: resolve(runtimeRoot), rootMap, sourceManifest: [...manifest.values()].sort((a,b) => a.file.localeCompare(b.file)),
    enrichmentManifest: [{ file: resolve(mapInfoPath), sha256: createHash('sha256').update(mapInfoBytes).digest('hex') },
      { file: 'OpenKore:tables/twRO/maps.txt', sha256: createHash('sha256').update(okMapsBytes).digest('hex') }, { file: 'OpenKore:tables/portals.txt', sha256: createHash('sha256').update(portalsBytes).digest('hex') }],
    activeImports: active.confs, removedScripts: active.removed, records };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [runtimeRoot, mapInfoPath, openkoreRoot, output] = process.argv.slice(2);
  if (!runtimeRoot || !mapInfoPath || !openkoreRoot) throw new Error('Usage: node audit-world-map-inventory.mjs <rathena-root> <map-info.json> <openkore-root> [offline-output.json]');
  if (output && relative(resolve(runtimeRoot), resolve(output)).split(/[\\/]/)[0] !== '..') throw new Error('Output must be outside Production data root');
  const report = await auditWorldInventory({ runtimeRoot, mapInfoPath, openkoreRoot });
  if (output) await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.summary, null, 2));
}
