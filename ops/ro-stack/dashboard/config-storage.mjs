import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  assertCanonicalConfig,
  clone,
  defaultCanonicalConfig,
  migrateLegacyConfig,
} from './config-schema.mjs';

const accountIdPattern = /^[0-9]+$/;
const characterIdPattern = /^[0-9]+$/;

function identityPart(value, pattern, name) {
  const text = String(value ?? '');
  if (!pattern.test(text) || Number(text) <= 0) throw new Error(`invalid_${name}`);
  return text;
}

export function canonicalConfigPath(instancesRoot, accountId, characterId) {
  const account = identityPart(accountId, accountIdPattern, 'account');
  const character = identityPart(characterId, characterIdPattern, 'character');
  return join(instancesRoot, `player_${account}`, 'config', `character_${character}.json`);
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function atomicJsonWrite(path, value) {
  await mkdir(join(path, '..'), { recursive: true });
  const temp = `${path}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temp, path);
}

function legacyConfigPaths(instancesRoot, accountId) {
  const account = identityPart(accountId, accountIdPattern, 'account');
  const folder = join(instancesRoot, `player_${account}`);
  return {
    supply: join(folder, 'supply-cycle.json'),
    openKore: join(folder, 'control', 'config.txt'),
    itemsControl: join(folder, 'control', 'items_control.txt'),
    pickup: join(folder, 'control', 'pickupitems.txt'),
    monControl: join(folder, 'control', 'mon_control.txt'),
  };
}

async function readLegacy(instancesRoot, accountId) {
  const paths = legacyConfigPaths(instancesRoot, accountId);
  const [supply, configText, itemsControlText, pickupText, monControlText] = await Promise.all([
    readJson(paths.supply),
    readFile(paths.openKore, 'utf8').catch((error) => {
      if (error?.code === 'ENOENT') return '';
      throw error;
    }),
    ...['itemsControl', 'pickup', 'monControl'].map((key) => readFile(paths[key], 'utf8').catch((error) => {
      if (error?.code === 'ENOENT') return '';
      throw error;
    })),
  ]);
  return { supplyCycle: supply ?? {}, configText, itemsControlText, pickupText, monControlText, paths };
}

export async function loadCanonicalConfig({ instancesRoot, accountId, characterId, persistMigration = true }) {
  const path = canonicalConfigPath(instancesRoot, accountId, characterId);
  const existing = await readJson(path);
  if (existing) {
    assertCanonicalConfig(existing);
    return { config: existing, migration: existing.migration ?? null, source: 'canonical', path };
  }
  const legacy = await readLegacy(instancesRoot, accountId);
  const hasLegacy = Boolean(legacy.configText.trim()) || Object.keys(legacy.supplyCycle).length > 0;
  const migrated = hasLegacy
    ? migrateLegacyConfig({ ...legacy, source: 'legacy-openkore-web-v1' })
    : { config: defaultCanonicalConfig(0), migration: { source: 'default', sourceVersion: null, mappings: [], unmapped: [], policy: { fixedOverlays: ['loot.autoLoot=true', 'loot.autoStore=false', 'Butterfly/Fly presence based'] } } };
  const config = { ...migrated.config, migration: migrated.migration };
  assertCanonicalConfig(config);
  if (persistMigration && hasLegacy) await atomicJsonWrite(path, config);
  return { config, migration: migrated.migration, source: hasLegacy ? 'migrated' : 'default', path };
}

export async function saveCanonicalConfig({ instancesRoot, accountId, characterId, config, expectedRevision }) {
  const current = await loadCanonicalConfig({ instancesRoot, accountId, characterId, persistMigration: true });
  const expected = Number(expectedRevision);
  if (!Number.isInteger(expected) || expected < 0) {
    const error = new Error('config_revision_required');
    error.code = 'CONFIG_REVISION_REQUIRED';
    throw error;
  }
  if (expected !== Number(current.config.revision)) {
    const error = new Error('config_revision_conflict');
    error.code = 'CONFIG_REVISION_CONFLICT';
    error.current = current.config;
    throw error;
  }
  const next = clone(config);
  next.revision = expected + 1;
  assertCanonicalConfig(next);
  next.migration = current.migration ?? null;
  await atomicJsonWrite(current.path, next);
  return { config: next, migration: next.migration, source: 'canonical', path: current.path };
}

export { atomicJsonWrite, readLegacy };
