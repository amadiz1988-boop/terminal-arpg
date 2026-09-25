import { execFileSync } from 'node:child_process';
import { open, stat } from 'node:fs/promises';
import { basename, join, normalize, resolve, sep } from 'node:path';

const LOG_WINDOW_LIMIT = 1024 * 1024;
const sleep = ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms));

export function nativeCombatFact(line, charId) {
  const text = String(line ?? '');
  if (!new RegExp(`\\bcid=${Number(charId)}\\b`).test(text)) return null;
  if (text.includes('TEST_FIXTURE_LIFE_EXCLUDED')) return { kind: 'LIFE_EXCLUDED' };
  if (text.includes('AUTO_FARM_STARTED')) return { kind: 'START' };
  const target = text.match(/AUTO_FARM_TARGET\s+cid=\d+\s+target=(\d+)/);
  if (target) return { kind: 'TARGET', targetId: Number(target[1]) };
  const attack = text.match(/AUTO_FARM_ATTACK\s+cid=\d+\s+target=(\d+)/);
  if (attack) return { kind: 'ATTACK', targetId: Number(attack[1]) };
  const hit = text.match(/AUTO_FARM_HIT\s+cid=\d+\s+target=(\d+)\s+hp=(\d+)->(\d+)\s+damage=(\d+)/);
  if (hit) return {
    kind: 'HIT', targetId: Number(hit[1]), hpBefore: Number(hit[2]),
    hpAfter: Number(hit[3]), damage: Number(hit[4]),
  };
  return null;
}

export function nativeCombatProgress(lines, charId) {
  const facts = lines.map(line => nativeCombatFact(line, charId)).filter(Boolean);
  const lifeExcluded = facts.some(fact => fact.kind === 'LIFE_EXCLUDED');
  const lastStart = facts.findLastIndex(fact => fact.kind === 'START');
  const sessionFacts = lastStart < 0 ? [] : facts.slice(lastStart);
  const targets = new Set(sessionFacts.filter(fact => fact.kind === 'TARGET').map(fact => fact.targetId));
  const attacks = new Set(sessionFacts.filter(fact => fact.kind === 'ATTACK').map(fact => fact.targetId));
  const hit = sessionFacts.find(fact => fact.kind === 'HIT' &&
    targets.has(fact.targetId) && attacks.has(fact.targetId) &&
    fact.hpBefore > fact.hpAfter && fact.damage === fact.hpBefore - fact.hpAfter) ?? null;
  return { lifeExcluded, started: lastStart >= 0, targets, attacks, hit };
}

export async function nativeCombatContext(root, charId) {
  const cli = join(root, 'ops', 'ro-stack', 'ghost-island-dev.mjs');
  let report;
  try {
    report = JSON.parse(execFileSync(process.execPath,
      [cli, 'runtime', 'logs', 'map', '--char', String(charId), '--json'],
      { cwd: root, encoding: 'utf8', timeout: 10_000, maxBuffer: 8 * 1024 * 1024 }));
  } catch {
    return null;
  }
  if (report?.STATUS !== 'OK' || report?.AUTHORITY !== 'canonical runtime logs' ||
      report?.RESULT?.service !== 'map' || String(report?.RESULT?.charId) !== String(charId))
    return null;
  const lines = report.RESULT.lines;
  const file = report.RESULT.source?.find(value => /-map\.out\.log$/i.test(String(value)));
  if (!Array.isArray(lines) || !file || !report.SOURCE?.includes(file)) return null;
  const normalized = normalize(resolve(file));
  const expectedSegment = `${sep}.local${sep}ro-stack${sep}logs${sep}`;
  if (!normalized.includes(expectedSegment) || !/^\d{8}-\d{6}-map\.out\.log$/i.test(basename(normalized)))
    return null;
  const size = (await stat(normalized)).size;
  let progress = nativeCombatProgress(lines, charId);
  if (!progress.lifeExcluded || !progress.started) {
    // The bounded diagnostic tail can rotate the attach marker out while the
    // current map process remains alive. Check only the first MiB of that same
    // canonical log, never a different runtime or historical fixture record.
    const handle = await open(normalized, 'r');
    try {
      const buffer = Buffer.alloc(Math.min(size, LOG_WINDOW_LIMIT));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      const prefix = nativeCombatProgress(
        buffer.toString('utf8', 0, bytesRead).split(/\r?\n/), charId);
      progress.lifeExcluded ||= prefix.lifeExcluded;
      if (!progress.started && size <= LOG_WINDOW_LIMIT)
        progress = { ...prefix, lifeExcluded: progress.lifeExcluded };
    } finally {
      await handle.close();
    }
  }
  return { ...progress, file: normalized, offset: size };
}

export async function observeNativeCombat(context, charId, timeoutMs) {
  const started = Date.now();
  const targets = new Set(context.targets);
  const attacks = new Set(context.attacks);
  let startedSeen = context.started;
  let offset = context.offset;
  let carry = '';
  let hit = null;
  let reason = null;
  const handle = await open(context.file, 'r');
  try {
    while (Date.now() - started <= timeoutMs) {
      const current = await handle.stat();
      if (current.size < offset) { reason = 'NATIVE_LOG_ROTATED'; break; }
      const remaining = current.size - offset;
      if (remaining > LOG_WINDOW_LIMIT) { reason = 'NATIVE_LOG_WINDOW_OVERFLOW'; break; }
      if (remaining > 0) {
        const buffer = Buffer.alloc(remaining);
        const { bytesRead } = await handle.read(buffer, 0, remaining, offset);
        offset += bytesRead;
        const parts = (carry + buffer.toString('utf8', 0, bytesRead)).split(/\r?\n/);
        carry = parts.pop() ?? '';
        for (const line of parts) {
          const fact = nativeCombatFact(line, charId);
          if (!fact) continue;
          if (fact.kind === 'START') { startedSeen = true; targets.clear(); attacks.clear(); }
          if (fact.kind === 'TARGET') targets.add(fact.targetId);
          if (fact.kind === 'ATTACK') attacks.add(fact.targetId);
          if (fact.kind === 'HIT' && startedSeen && targets.has(fact.targetId) &&
              attacks.has(fact.targetId) && fact.hpBefore > fact.hpAfter &&
              fact.damage === fact.hpBefore - fact.hpAfter) {
            hit = fact;
            break;
          }
        }
      }
      if (hit) break;
      await sleep(Math.min(500, Math.max(100, timeoutMs / 40)));
    }
  } finally {
    await handle.close();
  }
  if (!hit && !reason)
    reason = !startedSeen ? 'AUTO_FARM_START_NOT_OBSERVED'
      : targets.size === 0 ? 'TARGET_NOT_OBSERVED'
        : attacks.size === 0 ? 'ATTACK_NOT_OBSERVED' : 'AUTHORITATIVE_HIT_TIMEOUT';
  return { ok: Boolean(hit), reason, hit, started: startedSeen,
    targetObserved: targets.size > 0, attackObserved: attacks.size > 0,
    source: context.file, durationMs: Date.now() - started };
}
