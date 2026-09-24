import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';

const indexRoot = new URL('../../docs/ro-asset-index/', import.meta.url);
const indexFiles = Object.freeze({
  items: 'items.json', equipment: 'equipment.json', skills: 'skills.json',
  monsters: 'monsters.json', npcs: 'npcs.json', maps: 'maps.json',
  paperDoll: 'paper-doll.json',
});
const refreshIntervalMs = 5000;
let cache = null;
let lastCheckedAt = 0;

function normalized(value) {
  return String(value ?? '').trim().toLocaleLowerCase('zh-Hant');
}
function normalizedLooseItemName(value) {
  return normalized(value).replace(/[\s_'’-]+/gu, '');
}
function valuesFor(entry) {
  return [
    entry.itemId, entry.skillId, entry.mobId, entry.npcId, entry.navigationId,
    entry.classId, entry.viewId, entry.npcKey, entry.mapId, entry.key,
    entry.aegisName, entry.internalName, entry.scriptName, entry.zhHantName,
    entry.canonicalZhHant, entry.enName, ...(entry.aliases ?? []),
  ].filter((value) => value !== null && value !== undefined);
}
function signature() {
  return Object.values(indexFiles).map((name) => {
    const info = statSync(new URL(name, indexRoot));
    return `${name}:${info.size}:${info.mtimeMs}`;
  }).join('|');
}
function loadIndexes(force = false) {
  const now = Date.now();
  if (!force && cache && now - lastCheckedAt < refreshIntervalMs) return cache;
  lastCheckedAt = now;
  const sourceSignature = signature();
  if (!force && cache?.sourceSignature === sourceSignature) return cache;
  const indexes = {};
  const lookups = {};
  for (const [kind, name] of Object.entries(indexFiles)) {
    const payload = JSON.parse(readFileSync(new URL(name, indexRoot), 'utf8'));
    const entries = payload.entries ?? [];
    const lookup = new Map();
    for (const entry of entries) {
      for (const value of valuesFor(entry)) {
        const key = normalized(value);
        if (key && !lookup.has(key)) lookup.set(key, entry);
      }
    }
    indexes[kind] = entries;
    lookups[kind] = lookup;
  }
  cache = Object.freeze({
    sourceSignature,
    version: createHash('sha256').update(sourceSignature).digest('hex').slice(0, 16),
    loadedAt: new Date().toISOString(),
    indexes: Object.freeze(indexes),
    lookups: Object.freeze(lookups),
  });
  return cache;
}
function findEntry(kind, query) {
  if (query && typeof query === 'object') {
    const priority = [
      'itemId', 'skillId', 'mobId', 'npcId', 'mapId', 'classId', 'viewId',
      'key', 'npcKey', 'aegisName', 'internalName', 'scriptName', 'name',
      'zhHantName', 'canonicalZhHant', 'enName',
    ];
    for (const value of priority.map((key) => query[key])) {
      const match = findEntry(kind, value);
      if (match) return match;
    }
    return null;
  }
  return loadIndexes().lookups[kind].get(normalized(query)) ?? null;
}
function assetFor(kind, entry) {
  let asset = null;
  if (kind === 'items' || kind === 'equipment') asset = entry.icon ?? null;
  if (kind === 'skills') asset = entry.icon ?? null;
  if (kind === 'monsters') asset = entry.thumbnail ?? entry.sprite ?? null;
  if (kind === 'npcs') asset = entry.sprite ?? null;
  if (kind === 'maps') asset = entry.miniMap ?? entry.worldMap ?? null;
  if (kind === 'paperDoll') asset = entry.body ?? null;
  return typeof asset === 'string' ? { webPath: asset } : asset;
}
function missing(kind, query) {
  return {
    kind, query, name: null, asset: null, source: null, fallback: true,
    translationStatus: 'missing', assetStatus: 'missing', verificationGrade: 'X',
    verification: 'X', diagnosticCode: 'MISSING_RO_ASSET',
  };
}
function resolve(kind, query) {
  const entry = findEntry(kind, query);
  if (!entry) return missing(kind, query);
  const translationStatus = entry.translationStatus ?? 'missing';
  const assetStatus = entry.assetStatus ?? 'missing';
  return {
    ...entry, kind,
    name: entry.canonicalZhHant ?? entry.zhHantName ?? entry.enName ?? null,
    asset: assetFor(kind, entry), source: entry.provenance?.[0] ?? null,
    fallback: translationStatus === 'english-fallback' || assetStatus !== 'ready',
    translationStatus, assetStatus, verification: entry.verificationGrade ?? 'X',
    diagnosticCode: assetStatus === 'missing' ? 'MISSING_RO_ASSET' : null,
  };
}

export function resolveItemAsset(query) {
  const runtimeName = query && typeof query === 'object'
    ? String(query.name ?? '').trim()
    : String(query ?? '').trim();
  const slotMatch = runtimeName.match(/^(.*?)\s+\[(\d+)\]\s*$/u);
  const baseName = slotMatch?.[1]?.trim() ?? runtimeName;
  const requestedSlots = slotMatch ? Number(slotMatch[2]) : null;
  let kind = findEntry('items', query) ? 'items' : findEntry('equipment', query) ? 'equipment' : null;
  let entry = kind ? findEntry(kind, query) : null;
  if (!entry && baseName) {
    const normalizedBase = normalized(baseName);
    const looseBase = normalizedLooseItemName(baseName);
    const state = loadIndexes();
    const candidates = ['items', 'equipment'].flatMap((candidateKind) =>
      state.indexes[candidateKind]
        .filter((candidate) => valuesFor(candidate).some((value) =>
          normalized(value) === normalizedBase || normalizedLooseItemName(value) === looseBase))
        .map((candidate) => ({ kind: candidateKind, entry: candidate })));
    const selected = requestedSlots === null
      ? candidates[0]
      : candidates.find(({ entry: candidate }) => Number(candidate.slots ?? 0) === requestedSlots)
        ?? candidates[0];
    kind = selected?.kind ?? null;
    entry = selected?.entry ?? null;
  }
  let result = entry ? resolve(kind, entry.itemId) : missing('items', query);
  if (result.translationStatus === 'english-fallback' && /[\u3400-\u9fff]/u.test(runtimeName)) {
    result = { ...result, name: runtimeName, translationStatus: 'runtime-zh-hant', fallback: false };
  }
  return requestedSlots === null || !result.name
    ? result
    : { ...result, name: `${result.name} [${requestedSlots}]` };
}
export const resolveEquipmentAsset = (query) => resolve('equipment', query);
export const resolveSkillAsset = (query) => resolve('skills', query);
export const resolveMonsterAsset = (query) => resolve('monsters', query);
export function resolveMonsterDisplayName(query) {
  return resolve('monsters', query)?.name ?? null;
}
export const resolveNpcAsset = (query) => resolve('npcs', query);
export const resolveMapAsset = (query) => resolve('maps', query);
export const resolvePaperDollAsset = (query) => resolve('paperDoll', query);
export function reloadRoAssetIndexes() { return loadIndexes(true).version; }
export function getRoAssetIndexVersion() { return loadIndexes().version; }
export function getRoAssetIndexSnapshot() {
  const state = loadIndexes();
  return { version: state.version, loadedAt: state.loadedAt, indexes: state.indexes };
}
function publicValue(value) {
  if (Array.isArray(value)) return value.map(publicValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => ![
      'provenance', 'iconSource', 'sourcePath', 'sourceSha256', 'actSha256',
      'sprSha256', 'outputSha256', 'container', 'conversion', 'verifiedAt',
    ].includes(key))
    .map(([key, nested]) => [key, publicValue(nested)]));
}
export function getRoAssetPublicSnapshot() {
  const state = loadIndexes();
  return {
    version: state.version,
    indexes: Object.fromEntries(Object.entries(state.indexes)
      .map(([kind, entries]) => [kind, entries.map(publicValue)])),
  };
}
export const roAssetIndexes = new Proxy({}, {
  get(_target, property) { return loadIndexes().indexes[property]; },
  ownKeys() { return Reflect.ownKeys(loadIndexes().indexes); },
  getOwnPropertyDescriptor() { return { enumerable: true, configurable: true }; },
});
