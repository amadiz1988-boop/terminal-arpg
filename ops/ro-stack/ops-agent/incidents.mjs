import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

import {
  IncidentTrigger,
  OPS_API_VERSION,
  ServiceState,
  assertIncidentSnapshot,
} from './contracts.mjs';

const INCIDENT_ID = /^incident-[A-Za-z0-9_.-]{8,80}$/;
const sensitivePatterns = [
  /(authorization\s*[:=]\s*)(?:bearer\s+)?[^\s,;]+/gi,
  /((?:password|passwd|pwd|token|cookie|session|secret|dsn)\s*[:=]\s*)[^\s,;]+/gi,
  /(mysql:\/\/[^:\s/]+:)[^@\s/]+@/gi,
];

export function redactText(value) {
  let result = String(value);
  for (const pattern of sensitivePatterns) result = result.replace(pattern, '$1[REDACTED]');
  return result.slice(0, 512);
}

function redactSnapshot(snapshot) {
  const normalized = assertIncidentSnapshot({ ...snapshot, redacted: true });
  return {
    ...normalized,
    services: normalized.services.map((service) => ({
      ...service,
      evidence: service.evidence.map((entry) => ({
        ...entry,
        summary: entry.summary == null ? null : redactText(entry.summary),
      })),
    })),
  };
}

function incidentId(now) {
  const stamp = new Date(now).toISOString().replace(/[-:.TZ]/g, '');
  return `incident-${stamp}-${randomUUID().slice(0, 8)}`;
}

async function readIncidentFile(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

export function createIncidentStore({
  directory,
  maximumEntries = 100,
  maximumAgeMs = 30 * 24 * 60 * 60 * 1000,
  now = Date.now,
} = {}) {
  if (!directory) throw new TypeError('Incident directory is required');

  async function entries() {
    try {
      return (await readdir(directory, { withFileTypes: true }))
        .filter(
          (entry) =>
            entry.isFile() &&
            entry.name.endsWith('.json') &&
            INCIDENT_ID.test(entry.name.slice(0, -5)),
        )
        .map((entry) => entry.name)
        .sort()
        .reverse();
    } catch (error) {
      if (error?.code === 'ENOENT') return [];
      throw error;
    }
  }

  async function enforceRetention() {
    const files = await entries();
    const cutoff = now() - maximumAgeMs;
    await Promise.all(
      files.map(async (file, index) => {
        const path = join(directory, file);
        const snapshot = await readIncidentFile(path);
        const expired = !snapshot || Date.parse(snapshot.createdAt) < cutoff;
        if (index >= maximumEntries || expired) {
          await rm(path, { force: true });
        }
      }),
    );
  }

  async function write({ services, characters, trigger = IncidentTrigger.HEALTH_TRANSITION }) {
    const timestamp = now();
    const snapshot = redactSnapshot({
      schemaVersion: OPS_API_VERSION,
      snapshotId: incidentId(timestamp),
      createdAt: new Date(timestamp).toISOString(),
      trigger,
      redacted: true,
      services,
      characters,
    });
    await mkdir(directory, { recursive: true });
    const path = join(directory, `${snapshot.snapshotId}.json`);
    const temporary = `${path}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
    await rename(temporary, path);
    await enforceRetention();
    return snapshot;
  }

  async function list() {
    const files = await entries();
    const snapshots = (
      await Promise.all(files.map((file) => readIncidentFile(join(directory, file))))
    ).filter(Boolean);
    return snapshots.map((snapshot) => ({
      snapshotId: snapshot.snapshotId,
      createdAt: snapshot.createdAt,
      trigger: snapshot.trigger,
      serviceIssueCount: snapshot.services.filter(
        (service) => service.state !== ServiceState.HEALTHY,
      ).length,
      characterIssueCount: snapshot.characters.filter(
        (character) => character.lastErrorCode != null,
      ).length,
    }));
  }

  async function read(snapshotId) {
    if (!INCIDENT_ID.test(snapshotId)) return null;
    const snapshot = await readIncidentFile(join(directory, `${snapshotId}.json`));
    return snapshot ? redactSnapshot(snapshot) : null;
  }

  return Object.freeze({ write, list, read, enforceRetention });
}

function incidentSignature(services, characters) {
  const serviceIssues = services
    .filter((service) => service.state !== ServiceState.HEALTHY)
    .map((service) => `${service.serviceId}:${service.state}:${service.lastErrorCode ?? ''}`)
    .sort();
  const characterIssues = characters
    .filter((character) => character.lastErrorCode != null)
    .map(
      (character) =>
        `${character.accountId}:${character.characterId}:${character.lastErrorCode}`,
    )
    .sort();
  return JSON.stringify({ serviceIssues, characterIssues });
}

export function createIncidentMonitor({
  collect,
  store,
  intervalMs = 15000,
} = {}) {
  if (typeof collect !== 'function' || !store) {
    throw new TypeError('Incident monitor dependencies are required');
  }
  let lastSignature = null;
  let lastHadIssues = false;
  let timer = null;
  let running = false;

  async function tick() {
    if (running) return null;
    running = true;
    try {
      const { services, characters } = await collect();
      const signature = incidentSignature(services, characters);
      const hasIssues =
        services.some((service) => service.state !== ServiceState.HEALTHY) ||
        characters.some((character) => character.lastErrorCode != null);
      const changed = signature !== lastSignature;
      const shouldWrite = changed && (hasIssues || lastHadIssues);
      lastSignature = signature;
      lastHadIssues = hasIssues;
      return shouldWrite
        ? await store.write({ services, characters })
        : null;
    } finally {
      running = false;
    }
  }

  function start() {
    if (timer) return;
    void tick().catch(() => {});
    timer = setInterval(() => void tick().catch(() => {}), intervalMs);
    timer.unref?.();
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return Object.freeze({ tick, start, stop });
}

export const __test = Object.freeze({ incidentSignature, redactSnapshot });
