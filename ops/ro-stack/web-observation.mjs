export const ObservationInterest = Object.freeze({
  IDLE_PAGE: 'IDLE_PAGE',
  COMBAT_PAGE: 'COMBAT_PAGE',
  QUEST_PAGE: 'QUEST_PAGE',
  INVENTORY_PAGE: 'INVENTORY_PAGE',
  SOCIAL_PAGE: 'SOCIAL_PAGE',
  OTHER_GAME_PAGE: 'OTHER_GAME_PAGE',
  HIDDEN: 'HIDDEN',
  NO_WEB: 'NO_WEB',
});

export const ObservationDomain = Object.freeze({
  COMBAT: 'combat',
  VITALS: 'vitals',
  STAT: 'stat',
  QUEST: 'quest',
  INVENTORY: 'inventory',
  OWNERSHIP: 'ownership',
  MAP: 'map',
  SOCIAL: 'social',
  JOURNAL: 'journal',
  EVENTS: 'events',
  FULL_STATE: 'fullState',
});

const interestPriority = Object.freeze({
  NO_WEB: 0,
  HIDDEN: 1,
  IDLE_PAGE: 2,
  OTHER_GAME_PAGE: 3,
  SOCIAL_PAGE: 4,
  INVENTORY_PAGE: 5,
  QUEST_PAGE: 6,
  COMBAT_PAGE: 7,
});

export const OBSERVATION_POLICY = Object.freeze({
  leaseMs: 30_000,
  markerRefreshMs: 10_000,
  maximumViewersPerCharacter: 8,
  projectionCacheMs: 60_000,
  authoritativeFallbackCacheMs: 1_000,
  requestCoalescingMs: 75,
  interests: Object.freeze({
    COMBAT_PAGE: Object.freeze({
      eventPollMs: 300,
      statePollMs: 5_000,
      socialPollMs: 1_000,
      statusExportMs: 300,
      commandPollMs: 250,
    }),
    QUEST_PAGE: Object.freeze({
      eventPollMs: 1_000,
      statePollMs: 5_000,
      socialPollMs: 1_000,
      statusExportMs: 1_000,
      commandPollMs: 500,
    }),
    INVENTORY_PAGE: Object.freeze({
      eventPollMs: 2_500,
      statePollMs: 5_000,
      socialPollMs: 1_000,
      statusExportMs: 2_000,
      commandPollMs: 100,
    }),
    SOCIAL_PAGE: Object.freeze({
      eventPollMs: 5_000,
      statePollMs: 5_000,
      socialPollMs: 750,
      statusExportMs: 2_000,
      commandPollMs: 500,
    }),
    OTHER_GAME_PAGE: Object.freeze({
      eventPollMs: 5_000,
      statePollMs: 5_000,
      socialPollMs: 1_000,
      statusExportMs: 2_000,
      commandPollMs: 500,
    }),
    IDLE_PAGE: Object.freeze({
      eventPollMs: 5_000,
      statePollMs: 10_000,
      socialPollMs: 2_500,
      statusExportMs: 5_000,
      commandPollMs: 1_000,
    }),
    HIDDEN: Object.freeze({
      eventPollMs: 15_000,
      statePollMs: 0,
      socialPollMs: 10_000,
      statusExportMs: 10_000,
      commandPollMs: 1_000,
    }),
    NO_WEB: Object.freeze({
      eventPollMs: 0,
      statePollMs: 0,
      socialPollMs: 0,
      statusExportMs: 30_000,
      commandPollMs: 1_000,
    }),
  }),
});

const domainsByInterest = Object.freeze({
  COMBAT_PAGE: Object.freeze([
    'combat',
    'vitals',
    'stat',
    'map',
    'events',
    'social',
  ]),
  QUEST_PAGE: Object.freeze([
    'vitals',
    'stat',
    'quest',
    'ownership',
    'map',
    'journal',
    'events',
    'social',
  ]),
  INVENTORY_PAGE: Object.freeze([
    'combat',
    'vitals',
    'stat',
    'inventory',
    'map',
    'events',
    'social',
  ]),
  SOCIAL_PAGE: Object.freeze(['vitals', 'stat', 'map', 'social']),
  OTHER_GAME_PAGE: Object.freeze(['vitals', 'stat', 'map', 'social']),
  IDLE_PAGE: Object.freeze(['vitals', 'stat', 'map']),
  HIDDEN: Object.freeze([]),
  NO_WEB: Object.freeze([]),
});

const commonLiveFields = Object.freeze([
  'updatedAt',
  'lastCombatAt',
  'name',
  'jobId',
  'baseLevel',
  'jobLevel',
  'baseExp',
  'jobExp',
  'baseExpMax',
  'jobExpMax',
  'zeny',
  'hp',
  'maxHp',
  'sp',
  'maxSp',
  'weight',
  'maxWeight',
  'statusPoint',
  'skillPoint',
  'str',
  'strBonus',
  'agi',
  'agiBonus',
  'vit',
  'vitBonus',
  'int',
  'intBonus',
  'dex',
  'dexBonus',
  'luk',
  'lukBonus',
  'map',
  'mapWidth',
  'mapHeight',
  'playerX',
  'playerY',
  'webViewMode',
  'webInterest',
  'statusIntervalMs',
  'domainRevisions',
]);

const headlessLiveFields = Object.freeze([
  'updatedAt',
  'webViewMode',
  'webInterest',
  'statusIntervalMs',
  'domainRevisions',
]);

const liveFieldsByDomain = Object.freeze({
  stat: Object.freeze([
    'statusPoint',
    'str',
    'agi',
    'vit',
    'int',
    'dex',
    'luk',
  ]),
  combat: Object.freeze([
    'attack',
    'attackBonus',
    'matkMin',
    'matkMax',
    'def',
    'defBonus',
    'mdef',
    'mdefBonus',
    'hit',
    'flee',
    'fleeBonus',
    'critical',
    'aspd',
    'monsters',
    'players',
    'supplyCycle',
  ]),
  events: Object.freeze(['taskEvents']),
  inventory: Object.freeze([
    'inventory',
    'skills',
    'skillAutomation',
    'basicSkillLevel',
    'basicSkillUpgradable',
  ]),
  quest: Object.freeze([
    'questMissions',
    'questRuntimeAgent',
    'edenJourney',
    'onboarding',
    'npcDialog',
    'jobRoute',
    'grindHubTransition',
  ]),
});

export function normalizeObservationInterest(value) {
  const normalized = String(value ?? '').toUpperCase();
  return Object.hasOwn(interestPriority, normalized)
    ? normalized
    : ObservationInterest.IDLE_PAGE;
}

export function domainsForInterest(interest) {
  return domainsByInterest[normalizeObservationInterest(interest)] ?? [];
}

export function observationPolicyFor(interest) {
  return OBSERVATION_POLICY.interests[normalizeObservationInterest(interest)];
}

export function revisionKeyForInterest(snapshot, interest) {
  const revisions = snapshot?.domainRevisions ?? {};
  return domainsForInterest(interest)
    .map((domain) => {
      const advertisedDomains = Array.isArray(snapshot?.includedDomains)
          ? snapshot.includedDomains
          : null,
        fields = liveFieldsByDomain[domain] ?? [],
        available = advertisedDomains
          ? advertisedDomains.includes(domain)
          : fields.some((field) => snapshot?.[field] !== undefined);
      return `${domain}:${Number(revisions[domain] ?? 0)}:${available ? 'ready' : 'absent'}`;
    })
    .join('|') || `headless:${Number(snapshot?.updatedAt ?? 0)}`;
}

export function aggregateViewerInterests(viewers) {
  const normalized = [...viewers].map((viewer) =>
    normalizeObservationInterest(viewer.interest ?? viewer),
  );
  if (!normalized.length)
    return {
      highestInterest: ObservationInterest.NO_WEB,
      domains: [],
      viewerCount: 0,
      visibleViewerCount: 0,
    };
  const highestInterest = normalized.reduce((highest, interest) =>
    interestPriority[interest] > interestPriority[highest] ? interest : highest,
  );
  return {
    highestInterest,
    domains: [...new Set(normalized.flatMap(domainsForInterest))],
    viewerCount: normalized.length,
    visibleViewerCount: normalized.filter(
      (interest) => interest !== ObservationInterest.HIDDEN,
    ).length,
  };
}

export function legacyObservationMode(interest) {
  const normalized = normalizeObservationInterest(interest);
  if (normalized === ObservationInterest.NO_WEB) return 'none';
  if (normalized === ObservationInterest.HIDDEN) return 'hidden';
  if (normalized === ObservationInterest.COMBAT_PAGE) return 'high';
  return 'low';
}

export class CharacterViewerRegistry {
  constructor({
    leaseMs = OBSERVATION_POLICY.leaseMs,
    maximumViewers = OBSERVATION_POLICY.maximumViewersPerCharacter,
    clock = Date.now,
  } = {}) {
    this.leaseMs = leaseMs;
    this.maximumViewers = maximumViewers;
    this.clock = clock;
    this.characters = new Map();
  }

  update(characterId, viewerId, interest) {
    const key = Number(characterId);
    const now = this.clock();
    let viewers = this.prune(key, now) ?? new Map();
    const normalizedInterest = normalizeObservationInterest(interest);
    if (normalizedInterest === ObservationInterest.NO_WEB) {
      viewers.delete(viewerId);
    } else {
      if (!viewers.has(viewerId) && viewers.size >= this.maximumViewers) {
        const oldest = [...viewers.entries()].sort(
          (left, right) => left[1].seenAt - right[1].seenAt,
        )[0];
        if (oldest) viewers.delete(oldest[0]);
      }
      viewers.set(viewerId, { interest: normalizedInterest, seenAt: now });
    }
    if (viewers.size) this.characters.set(key, viewers);
    else this.characters.delete(key);
    return this.demand(key, now);
  }

  prune(characterId, now = this.clock()) {
    const key = Number(characterId);
    const viewers = this.characters.get(key);
    if (!viewers) return null;
    for (const [viewerId, viewer] of viewers)
      if (now - viewer.seenAt >= this.leaseMs) viewers.delete(viewerId);
    if (!viewers.size) {
      this.characters.delete(key);
      return null;
    }
    return viewers;
  }

  demand(characterId, now = this.clock()) {
    const viewers = this.prune(characterId, now);
    return aggregateViewerInterests(viewers?.values() ?? []);
  }

  cleanup(now = this.clock()) {
    const removed = [];
    for (const characterId of [...this.characters.keys()])
      if (!this.prune(characterId, now)) removed.push(characterId);
    return removed;
  }

  summary() {
    const demands = [];
    for (const characterId of [...this.characters.keys()])
      demands.push({ characterId, ...this.demand(characterId) });
    return demands;
  }
}

export class DomainRevisionTracker {
  constructor() {
    this.characters = new Map();
  }

  observe(characterId, signals) {
    const key = Number(characterId);
    const domains = this.characters.get(key) ?? new Map();
    for (const [domain, fingerprint] of Object.entries(signals ?? {})) {
      if (fingerprint === undefined) continue;
      const previous = domains.get(domain);
      if (!previous || previous.fingerprint !== fingerprint)
        domains.set(domain, {
          fingerprint,
          revision: Number(previous?.revision ?? 0) + 1,
        });
    }
    this.characters.set(key, domains);
    return Object.fromEntries(
      [...domains].map(([domain, state]) => [domain, state.revision]),
    );
  }

  remove(characterId) {
    this.characters.delete(Number(characterId));
  }
}

export class CharacterProjectionCache {
  constructor({ clock = Date.now } = {}) {
    this.clock = clock;
    this.cache = new Map();
    this.pending = new Map();
    this.latestByScope = new Map();
    this.metrics = {
      hits: 0,
      misses: 0,
      coalesced: 0,
      builds: 0,
    };
  }

  key({ characterId, domain, revision = 0, variant = 'default' }) {
    return `${Number(characterId)}:${domain}:${revision}:${variant}`;
  }

  scope({ characterId, domain, variant = 'default' }) {
    return `${Number(characterId)}:${domain}:${variant}`;
  }

  async getOrBuild(descriptor, builder) {
    const key = this.key(descriptor);
    const scope = this.scope(descriptor);
    const priorKey = this.latestByScope.get(scope);
    if (priorKey && priorKey !== key) this.cache.delete(priorKey);
    this.latestByScope.set(scope, key);
    const now = this.clock();
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > now) {
      this.metrics.hits += 1;
      return cached.value;
    }
    const pending = this.pending.get(key);
    if (pending) {
      this.metrics.coalesced += 1;
      return await pending;
    }
    this.metrics.misses += 1;
    const task = Promise.resolve().then(builder);
    this.pending.set(key, task);
    try {
      const value = await task;
      this.metrics.builds += 1;
      if (this.latestByScope.get(scope) === key)
        this.cache.set(key, {
          value,
          scope,
          expiresAt: this.clock() + Number(descriptor.ttlMs ?? 0),
        });
      return value;
    } finally {
      if (this.pending.get(key) === task) this.pending.delete(key);
    }
  }

  invalidateCharacter(characterId) {
    const prefix = `${Number(characterId)}:`;
    for (const key of this.cache.keys())
      if (key.startsWith(prefix)) this.cache.delete(key);
    for (const [scope, key] of this.latestByScope)
      if (key.startsWith(prefix)) this.latestByScope.delete(scope);
  }

  prune() {
    const now = this.clock();
    for (const [key, entry] of this.cache)
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
        if (this.latestByScope.get(entry.scope) === key)
          this.latestByScope.delete(entry.scope);
      }
  }

  summary() {
    const total = this.metrics.hits + this.metrics.misses;
    return {
      ...this.metrics,
      entries: this.cache.size,
      pending: this.pending.size,
      hitRate: total ? this.metrics.hits / total : 0,
    };
  }
}

export function projectLiveSnapshot(snapshot, interest) {
  if (!snapshot) return null;
  const normalizedInterest = normalizeObservationInterest(interest);
  const projection = {};
  const baseFields = [
    ObservationInterest.HIDDEN,
    ObservationInterest.NO_WEB,
  ].includes(normalizedInterest)
    ? headlessLiveFields
    : commonLiveFields;
  for (const field of baseFields)
    if (snapshot[field] !== undefined) projection[field] = snapshot[field];
  for (const domain of domainsForInterest(normalizedInterest))
    for (const field of liveFieldsByDomain[domain] ?? [])
      if (snapshot[field] !== undefined) projection[field] = snapshot[field];
  return projection;
}

// Authoritative minimap-state freshness. `updatedAt` is written by the
// controller/exporter process on the Dashboard host, so serverNow - updatedAt is
// a clock-skew-free STATE_FRESHNESS value. The browser only adds elapsed local
// time since it received the payload, which keeps the number honest for remote
// viewers instead of measuring HTTP round-trip latency.
export function liveStateFreshness(snapshot, now = Date.now()) {
  const authoritativeAt = Number(snapshot?.updatedAt);
  if (!Number.isFinite(authoritativeAt) || authoritativeAt <= 0) return null;
  return {
    authoritativeAt,
    serverNow: now,
    ageMs: Math.max(0, Math.round(now - authoritativeAt)),
  };
}

export function withLiveFreshness(live, snapshot, now = Date.now()) {
  if (!live) return live ?? null;
  const freshness = liveStateFreshness(snapshot, now);
  return freshness ? { ...live, freshness } : live;
}

export function coalesceCombatEvents(lines, latestTimestamp = Date.now()) {
  const delta = {
    eventCount: lines.length,
    damageTotal: 0,
    hitCount: 0,
    incomingDamageTotal: 0,
    incomingHitCount: 0,
    healTotal: 0,
    hpDelta: 0,
    kills: 0,
    lootSummary: {},
    latestTimestamp,
  };
  let deathSignals = 0,
    experienceSignals = 0;
  for (const line of lines) {
    const outgoing = line.match(/You (?:attack|use).*?\(Dmg:\s*(\d+)/i);
    if (outgoing) {
      delta.damageTotal += Number(outgoing[1]);
      delta.hitCount += 1;
    }
    const incoming = line.match(/Monster .* attacks you \(Dmg:\s*(\d+)/i);
    if (incoming) {
      const damage = Number(incoming[1]);
      delta.incomingDamageTotal += damage;
      delta.incomingHitCount += 1;
      delta.hpDelta -= damage;
    }
    const heal = line.match(/(?:heal(?:ed)?|恢復|治癒)[^\d]*(\d+)/i);
    if (heal) {
      const amount = Number(heal[1]);
      delta.healTotal += amount;
      delta.hpDelta += amount;
    }
    if (/Target Monster .+ died/.test(line)) deathSignals += 1;
    if (/You have gained \d+\/\d+/.test(line)) experienceSignals += 1;
    const loot = line.match(/Item added to inventory: (.+?) \(\d+\) x (\d+)/);
    if (loot)
      delta.lootSummary[loot[1]] =
        Number(delta.lootSummary[loot[1]] ?? 0) + Number(loot[2]);
  }
  delta.kills = Math.max(deathSignals, experienceSignals);
  return delta;
}

export function coalesceCombatEventLines(lines) {
  const output = [],
    uniqueOther = new Set(),
    loot = new Map();
  let baseExp = 0,
    jobExp = 0,
    sawDeathSignal = false;
  for (const line of lines) {
    if (
      /You (?:attack|use).*?\(Dmg:|Monster .* attacks you|Target Monster .+ died|You have died|You are now (?:job )?level|Map Change:/i.test(
        line,
      )
    ) {
      output.push(line);
      if (/Target Monster .+ died/.test(line)) sawDeathSignal = true;
      continue;
    }
    const experience = line.match(/You have gained (\d+)\/(\d+)/);
    if (experience) {
      baseExp += Number(experience[1]);
      jobExp += Number(experience[2]);
      continue;
    }
    const item = line.match(/Item added to inventory: (.+?) \((\d+)\) x (\d+)/);
    if (item) {
      const key = `${item[1]}\u0000${item[2]}`;
      loot.set(key, Number(loot.get(key) ?? 0) + Number(item[3]));
      continue;
    }
    if (!uniqueOther.has(line)) {
      uniqueOther.add(line);
      output.push(line);
    }
  }
  if (!sawDeathSignal && (baseExp || jobExp))
    output.push(`You have gained ${baseExp}/${jobExp} Exp`);
  for (const [key, amount] of loot) {
    const [name, itemId] = key.split('\u0000');
    output.push(`Item added to inventory: ${name} (${itemId}) x ${amount}`);
  }
  return output;
}

export function publicObservationPolicy() {
  return OBSERVATION_POLICY;
}

// Native SERVER_AGENT Event Ledger vocabulary. The map-server Persistent Agent
// persists these factual transitions to `persistent_life_event`. Web converts
// them into the combat-terminal line grammar the last-good renderer already
// understands; no second combat table and no OpenKore text log is involved.
export const NATIVE_COMBAT_EVENT_TYPES = Object.freeze([
  'MONSTER_TARGET',
  'MONSTER_ATTACK',
  'MONSTER_HIT',
  'MONSTER_KILL',
  'LOOT_ACQUIRED',
  'MAP_CHANGED',
  'NPC_INTERACTION',
  'SESSION_STARTED',
  'SESSION_ENDED',
]);

export function parseLifeEventFacts(facts) {
  if (facts && typeof facts === 'object') return facts;
  try {
    const parsed = JSON.parse(String(facts ?? ''));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function monsterLineFields(event) {
  const facts = parseLifeEventFacts(event.facts);
  const mobId = Number(facts.mobId);
  const entityId = Number(facts.entityId ?? facts.targetId ?? facts.mobId);
  const known = Number.isSafeInteger(mobId) && mobId > 0;
  const name =
    String(event.mobName ?? '').trim() ||
    (known ? `Monster #${mobId}` : 'Unknown');
  const suffix =
    Number.isSafeInteger(entityId) && entityId > 0 ? ` (${entityId})` : '';
  return { facts, name, suffix };
}

// Translate one native ledger fact into the combat-terminal line grammar the
// existing (last-good) renderer already understands. MONSTER_HIT keeps the
// entity identity in the id slot so the existing damage-float/sound path works.
export function nativeLifeEventLine(event = {}) {
  const type = String(event.eventType ?? '');
  const facts = parseLifeEventFacts(event.facts);
  switch (type) {
    case 'MONSTER_TARGET': {
      const { name, suffix } = monsterLineFields(event);
      return `You are now attacking Monster ${name}${suffix}`;
    }
    case 'MONSTER_ATTACK': {
      const { name, suffix } = monsterLineFields(event);
      return `You attack Monster ${name}${suffix}`;
    }
    case 'MONSTER_HIT': {
      const { name, suffix } = monsterLineFields(event);
      const damage = Number(facts.damage);
      return `You attack Monster ${name}${suffix} (Dmg: ${
        Number.isFinite(damage) ? Math.trunc(damage) : 0
      })`;
    }
    case 'MONSTER_KILL': {
      const { name, suffix } = monsterLineFields(event);
      return `Target Monster ${name}${suffix} died`;
    }
    case 'LOOT_ACQUIRED': {
      const itemId = Number(facts.itemId);
      const amount = Math.max(1, Number(facts.amount ?? 1));
      const name =
        String(event.itemName ?? '').trim() ||
        (Number.isSafeInteger(itemId) && itemId > 0
          ? `Item #${itemId}`
          : 'Unknown');
      return `Item added to inventory: ${name} (${itemId}) x ${amount}`;
    }
    case 'MAP_CHANGED':
      return `Map Change: ${String(event.map ?? facts.map ?? '').trim() || 'unknown'}`;
    case 'NPC_INTERACTION':
      return `NPC Interaction: ${String(facts.npc ?? 'npc')}${facts.cancelled ? ' (cancelled)' : ''}`;
    case 'SESSION_STARTED':
      return 'Server Agent session started';
    case 'SESSION_ENDED':
      return 'Server Agent session ended';
    default:
      return null;
  }
}
