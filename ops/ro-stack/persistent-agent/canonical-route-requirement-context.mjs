// Stage 4 requirement context adapter.
//
// The adapter only normalizes authoritative observations. It never promotes
// missing, stale or unknown values to true. The weighted canonical solver is
// intentionally left unchanged; callers use evaluateRequirement before
// passing an edge to that solver.

export const ROUTE_REQUIREMENT_CONTEXT_SCHEMA_VERSION = 2;

export const REQUIREMENT_STATUS = Object.freeze({
  READY: 'READY',
  LOCKED_REQUIREMENT: 'LOCKED_REQUIREMENT',
  CONTEXT_UNAVAILABLE: 'CONTEXT_UNAVAILABLE',
});

const FRESHNESS = new Set(['FRESH', 'STALE', 'UNAVAILABLE', 'UNKNOWN']);
const DOMAIN_NAMES = Object.freeze([
  'quests', 'instances', 'events', 'scriptConditions', 'items', 'zeny',
  'savePoint', 'npcs', 'position', 'character', 'namedVariables',
]);

const NAMED_VARIABLE_SCOPES = new Set([
  'CHARACTER', 'ACCOUNT', 'ACCOUNT_GLOBAL', 'MAP_GLOBAL', 'INSTANCE',
]);

function text(value) {
  return String(value ?? '').trim();
}

function freshnessValue(value, fallback = 'UNKNOWN') {
  const normalized = text(value).toUpperCase();
  return FRESHNESS.has(normalized) ? normalized : fallback;
}

function normalizeFreshness(input) {
  if (typeof input === 'string') {
    const overall = freshnessValue(input);
    return {
      overall,
      domains: Object.fromEntries(DOMAIN_NAMES.map((name) => [name, overall])),
    };
  }
  const raw = input && typeof input === 'object' ? input : {};
  const overall = freshnessValue(raw.overall ?? raw.status);
  const domains = raw.domains && typeof raw.domains === 'object' ? raw.domains : {};
  return {
    overall,
    domains: Object.fromEntries(
      DOMAIN_NAMES.map((name) => [name, freshnessValue(domains[name], overall)]),
    ),
  };
}

function normalizeBooleanMap(value) {
  if (value instanceof Map) return Object.fromEntries(value.entries());
  if (Array.isArray(value)) {
    return Object.fromEntries(value.map((row) => [
      text(row?.id ?? row?.key ?? row?.name),
      row?.value ?? row?.state ?? row?.available,
    ]).filter(([key]) => key));
  }
  return value && typeof value === 'object' ? { ...value } : {};
}

function normalizeQuestMap(value) {
  if (Array.isArray(value)) {
    return Object.fromEntries(value.map((row) => {
      const key = row?.quest_id ?? row?.questId ?? row?.id;
      return [text(key), row?.state ?? row?.value ?? row?.status ?? row?.available];
    }).filter(([key]) => key));
  }
  return normalizeBooleanMap(value);
}

function normalizeItemMap(value) {
  if (Array.isArray(value)) {
    return Object.fromEntries(value.map((row) => {
      const key = row?.item_id ?? row?.itemId ?? row?.id;
      const amount = row?.amount ?? row?.quantity ?? row?.count;
      return [text(key), Number.isFinite(Number(amount)) ? Number(amount) : amount];
    }).filter(([key]) => key));
  }
  const normalized = normalizeBooleanMap(value);
  return Object.fromEntries(Object.entries(normalized).map(([key, amount]) => [
    key,
    Number.isFinite(Number(amount)) ? Number(amount) : amount,
  ]));
}

function normalizePosition(value) {
  if (!value || typeof value !== 'object') return null;
  const map = text(value.map ?? value.currentMap ?? value.mapId);
  const x = Number(value.x);
  const y = Number(value.y);
  if (!map) return null;
  return {
    map,
    ...(Number.isSafeInteger(x) ? { x } : {}),
    ...(Number.isSafeInteger(y) ? { y } : {}),
  };
}

function variableScope(value) {
  const scope = text(value).toUpperCase();
  return NAMED_VARIABLE_SCOPES.has(scope) ? scope : 'UNKNOWN';
}

function variableFreshness(value, fallback) {
  return freshnessValue(value, fallback);
}

function normalizeNamedVariable(scopeInput, keyInput, valueInput, meta = {}, defaults = {}) {
  const scope = variableScope(scopeInput);
  const key = text(keyInput);
  if (!key) return null;
  return {
    scope,
    key,
    value: valueInput,
    authority: text(meta.authority) || 'UNKNOWN',
    revision: meta.revision ?? defaults.revision ?? null,
    freshness: variableFreshness(meta.freshness, defaults.freshness ?? 'UNKNOWN'),
  };
}

function normalizeNamedVariables(value, { revision = null, freshness = 'UNKNOWN' } = {}) {
  const rows = [];
  if (Array.isArray(value)) {
    for (const row of value) {
      const normalized = normalizeNamedVariable(
        row?.scope,
        row?.key ?? row?.name,
        row?.value,
        row,
        { revision, freshness },
      );
      if (normalized) rows.push(normalized);
    }
  } else if (value && typeof value === 'object') {
    for (const [scopeKey, scopeValue] of Object.entries(value)) {
      if (scopeValue && typeof scopeValue === 'object' && !Array.isArray(scopeValue)) {
        for (const [key, raw] of Object.entries(scopeValue)) {
          const meta = raw && typeof raw === 'object' && Object.hasOwn(raw, 'value')
            ? raw
            : { value: raw };
          const normalized = normalizeNamedVariable(scopeKey, key, meta.value, meta, { revision, freshness });
          if (normalized) rows.push(normalized);
        }
      }
    }
  }
  return Object.fromEntries(rows.map((row) => [`${row.scope}:${row.key}`, row]));
}

function normalizeCharacter(value) {
  const character = value && typeof value === 'object' ? { ...value } : {};
  const classId = character.classId ?? character.class ?? character.job;
  const baseLevel = character.baseLevel ?? character.level;
  if (classId !== undefined && classId !== null) {
    character.classId = classId;
    character.job = character.job ?? classId;
  }
  if (baseLevel !== undefined && baseLevel !== null) {
    character.baseLevel = baseLevel;
    character.level = baseLevel;
  }
  return character;
}

function domainFreshness(context, domain) {
  return context?.freshness?.domains?.[domain] ?? 'UNKNOWN';
}

function valuePresent(value) {
  return value !== undefined && value !== null;
}

function requirementEntries(requirements) {
  if (!requirements || typeof requirements !== 'object') return [];
  return Object.entries(requirements).filter(([key, value]) => (
    value !== undefined && value !== null && key !== 'authority' && key !== 'normalizationStatus'
  ));
}

function unknownScriptRequirement(requirement) {
  if (Array.isArray(requirement?.authoritativePredicates)) {
    return {
      allOf: requirement.authoritativePredicates.map((predicate) => unknownScriptRequirement({ authoritativePredicate: predicate })),
    };
  }
  const predicate = requirement?.authoritativePredicate ?? requirement?.scriptPredicate;
  if (!predicate || typeof predicate !== 'object') {
    return { ...requirement, scriptCondition: 'QUEST_OR_JOB_SCRIPT', authority: 'UNKNOWN' };
  }
  const kind = text(predicate.type ?? predicate.kind).toLowerCase();
  if (kind === 'quest' && valuePresent(predicate.id ?? predicate.questId)) {
    const normalized = {
      quest: text(predicate.id ?? predicate.questId),
    };
    if (valuePresent(predicate.state)) normalized.questState = predicate.state;
    return normalized;
  }
  if (kind === 'job' && valuePresent(predicate.id ?? predicate.jobId)) {
    return { job: text(predicate.id ?? predicate.jobId) };
  }
  if (kind === 'item' && valuePresent(predicate.id ?? predicate.itemId)) {
    return {
      item: text(predicate.id ?? predicate.itemId),
      itemCount: Number(predicate.count ?? predicate.amount ?? 1),
    };
  }
  if (kind === 'zeny' && valuePresent(predicate.minimum ?? predicate.amount)) {
    return { zeny: Number(predicate.minimum ?? predicate.amount) };
  }
  if (kind === 'class' && valuePresent(predicate.id ?? predicate.classId ?? predicate.value)) {
    return { classId: predicate.id ?? predicate.classId ?? predicate.value };
  }
  if (kind === 'character' && text(predicate.field).toLowerCase() === 'baselevel' && valuePresent(predicate.minimum)) {
    return { level: Number(predicate.minimum) };
  }
  if (kind === 'character' && text(predicate.field).toLowerCase() === 'joblevel' && valuePresent(predicate.minimum)) {
    return { jobLevel: Number(predicate.minimum) };
  }
  if (kind === 'named_variable' || kind === 'variable') {
    return { namedVariable: {
      scope: predicate.scope,
      key: predicate.key ?? predicate.name,
      op: predicate.op ?? predicate.operator ?? 'eq',
      value: predicate.value,
    } };
  }
  return { ...requirement, scriptCondition: 'QUEST_OR_JOB_SCRIPT', authority: 'UNKNOWN' };
}

export function normalizeRequirementPredicates(requirements = {}) {
  if (!requirements || typeof requirements !== 'object') return {};
  if (Array.isArray(requirements.authoritativePredicates)) {
    return {
      ...requirements,
      allOf: requirements.authoritativePredicates.map((predicate) => unknownScriptRequirement({ authoritativePredicate: predicate })),
      authoritativePredicates: undefined,
    };
  }
  if (requirements.scriptCondition === 'QUEST_OR_JOB_SCRIPT') {
    return unknownScriptRequirement(requirements);
  }
  return { ...requirements };
}

export function createRouteRequirementContext(input = {}) {
  const freshness = normalizeFreshness(input.freshness);
  const namedVariableFreshness = domainFreshness({ freshness }, 'namedVariables');
  const context = {
    schemaVersion: ROUTE_REQUIREMENT_CONTEXT_SCHEMA_VERSION,
    characterId: input.characterId ?? null,
    revision: input.revision ?? null,
    observedAt: input.observedAt ?? null,
    freshness,
    quests: normalizeQuestMap(input.quests),
    instances: normalizeBooleanMap(input.instances),
    events: normalizeBooleanMap(input.events),
    scriptConditions: normalizeBooleanMap(input.scriptConditions),
    items: normalizeItemMap(input.items),
    zeny: Number.isFinite(Number(input.zeny)) ? Number(input.zeny) : null,
    savePoint: text(input.savePoint) || null,
    npcs: normalizeBooleanMap(input.npcs),
    position: normalizePosition(input.position),
    character: normalizeCharacter(input.character),
    characterAuthority: input.characterAuthority && typeof input.characterAuthority === 'object'
      ? { ...input.characterAuthority }
      : {},
    namedVariables: normalizeNamedVariables(input.namedVariables ?? input.scriptVariables, {
      revision: input.revision,
      freshness: namedVariableFreshness,
    }),
  };
  return Object.freeze(context);
}

export function createRouteRequirementContextFromReadModel({
  characterId,
  revision,
  observedAt,
  freshness,
  liveStatus,
  liveCharacter,
  liveInventory,
  liveQuest,
  liveNamedVariables,
  namedVariables,
  savePoint,
  npcs,
  instances,
  events,
  scriptConditions,
} = {}) {
  const status = liveStatus && typeof liveStatus === 'object' ? liveStatus : {};
  const character = liveCharacter && typeof liveCharacter === 'object' ? liveCharacter : {};
  const inventoryRows = Array.isArray(liveInventory)
    ? liveInventory
    : (liveInventory?.items ?? liveInventory?.rows ?? []);
  const questRows = Array.isArray(liveQuest)
    ? liveQuest
    : (liveQuest?.quests ?? liveQuest?.rows ?? []);
  return createRouteRequirementContext({
    characterId: characterId ?? status.characterId ?? character.characterId,
    revision: revision ?? status.revision ?? character.revision,
    observedAt: observedAt ?? status.observedAt ?? character.observedAt,
    freshness,
    quests: questRows,
    instances,
    events,
    scriptConditions,
    items: inventoryRows,
    zeny: status.zeny ?? character.zeny,
    savePoint: savePoint ?? status.savePoint ?? character.savePoint,
    npcs,
    position: {
      map: status.map ?? status.currentMap ?? character.map,
      x: status.x ?? character.x,
      y: status.y ?? character.y,
    },
    characterAuthority: {
      classId: 'rAthena:pc_readparam(Class)',
      baseLevel: 'rAthena:pc_readparam(BaseLevel)',
      jobLevel: 'rAthena:pc_readparam(JobLevel)',
      ...(character.characterAuthority ?? {}),
    },
    namedVariables: liveNamedVariables ?? namedVariables ?? character.namedVariables,
    character: {
      classId: character.classId ?? character.job,
      baseLevel: character.baseLevel ?? character.level,
      jobLevel: character.jobLevel,
    },
  });
}

export function readAuthoritativeNamedVariable(context, scope, key) {
  const normalizedScope = variableScope(scope);
  const normalizedKey = text(key);
  const value = context?.namedVariables?.[`${normalizedScope}:${normalizedKey}`];
  if (!value || value.scope === 'UNKNOWN' || value.authority === 'UNKNOWN') {
    return { status: REQUIREMENT_STATUS.CONTEXT_UNAVAILABLE, reason: 'named_variable_authority_unknown', domain: 'namedVariables', authority: 'UNKNOWN' };
  }
  if (value.freshness !== 'FRESH') {
    return { status: REQUIREMENT_STATUS.CONTEXT_UNAVAILABLE, reason: 'named_variable_not_fresh', domain: 'namedVariables', authority: value.authority };
  }
  return { status: REQUIREMENT_STATUS.READY, value: value.value, variable: value, authority: value.authority };
}

function unavailable(domain, reason = 'authoritative_context_not_fresh') {
  return {
    status: REQUIREMENT_STATUS.CONTEXT_UNAVAILABLE,
    reason,
    domain,
    authority: 'UNKNOWN',
  };
}

function locked(reason, domain, authority = 'UNKNOWN') {
  return { status: REQUIREMENT_STATUS.LOCKED_REQUIREMENT, reason, domain, authority };
}

function checkBooleanDomain(context, domain, key) {
  if (domainFreshness(context, domain) !== 'FRESH') return unavailable(domain);
  const value = context?.[domain]?.[key];
  if (value === true || value === 1 || value === '1' || value === 'ACTIVE' || value === 'COMPLETE') return null;
  if (value === false || value === 0 || value === '0' || value === 'INACTIVE' || value === 'LOCKED') {
    return locked(`${domain}_predicate_false`, domain, 'AUTHORITATIVE');
  }
  return locked(`${domain}_predicate_unproven`, domain);
}

export function evaluateRequirement(requirements, context) {
  const normalized = normalizeRequirementPredicates(requirements);
  const entries = requirementEntries(normalized);
  if (Array.isArray(normalized.allOf)) {
    for (const child of normalized.allOf) {
      const result = evaluateRequirement(child, context);
      if (result.status !== REQUIREMENT_STATUS.READY) return result;
    }
  }
  if (!entries.length) return { status: REQUIREMENT_STATUS.READY, reason: null, authority: 'NONE' };

  if (normalized.scriptCondition === 'QUEST_OR_JOB_SCRIPT' || normalized.authority === 'UNKNOWN') {
    return locked('script_requirement_authority_unknown', 'scriptConditions');
  }
  if (normalized.quest !== undefined) {
    const key = text(typeof normalized.quest === 'object' ? normalized.quest.id : normalized.quest);
    const failure = checkBooleanDomain(context, 'quests', key);
    if (failure) return failure;
    const expected = normalized.questState ?? (typeof normalized.quest === 'object' ? normalized.quest.state : undefined);
    if (expected !== undefined && context.quests[key] !== expected) {
      return locked('quest_state_mismatch', 'quests', 'AUTHORITATIVE');
    }
  }
  if (normalized.instance !== undefined) {
    const failure = checkBooleanDomain(context, 'instances', text(normalized.instance));
    if (failure) return failure;
  }
  if (normalized.event !== undefined) {
    const failure = checkBooleanDomain(context, 'events', text(normalized.event));
    if (failure) return failure;
  }
  if (normalized.scriptCondition !== undefined) {
    const failure = checkBooleanDomain(context, 'scriptConditions', text(normalized.scriptCondition));
    if (failure) return failure;
  }
  if (normalized.namedVariable !== undefined) {
    const variable = normalized.namedVariable;
    if (!variable || typeof variable !== 'object' || !variable.scope || !variable.key) {
      return locked('named_variable_identity_unknown', 'namedVariables');
    }
    const observed = readAuthoritativeNamedVariable(context, variable.scope, variable.key);
    if (observed.status !== REQUIREMENT_STATUS.READY) return observed;
    const op = text(variable.op ?? variable.operator ?? 'eq').toLowerCase();
    const expected = variable.value;
    const actual = observed.value;
    const numeric = Number.isFinite(Number(actual)) && Number.isFinite(Number(expected));
    const left = numeric ? Number(actual) : actual;
    const right = numeric ? Number(expected) : expected;
    const matches = op === 'eq' || op === '==' ? left === right
      : op === 'ne' || op === '!=' ? left !== right
        : op === 'gte' || op === '>=' ? left >= right
          : op === 'gt' || op === '>' ? left > right
            : op === 'lte' || op === '<=' ? left <= right
              : op === 'lt' || op === '<' ? left < right
                : false;
    if (!matches) return locked('named_variable_predicate_false', 'namedVariables', observed.authority);
  }
  if (normalized.npcAvailable === false) return locked('npc_unavailable', 'npcs', 'AUTHORITATIVE');
  if (normalized.npc !== undefined) {
    const failure = checkBooleanDomain(context, 'npcs', text(normalized.npc));
    if (failure) return failure;
  }
  if (normalized.savePoint !== undefined) {
    if (domainFreshness(context, 'savePoint') !== 'FRESH') return unavailable('savePoint');
    if (context.savePoint !== text(normalized.savePoint)) return locked('savepoint_mismatch', 'savePoint', 'AUTHORITATIVE');
  }
  if (normalized.item !== undefined) {
    if (domainFreshness(context, 'items') !== 'FRESH') return unavailable('items');
    const required = Number(normalized.itemCount ?? 1);
    const actual = Number(context.items?.[text(normalized.item)] ?? 0);
    if (!Number.isFinite(actual) || actual < required) return locked('item_required', 'items', 'AUTHORITATIVE');
  }
  if (normalized.zeny !== undefined) {
    if (domainFreshness(context, 'zeny') !== 'FRESH') return unavailable('zeny');
    if (!Number.isFinite(context.zeny) || context.zeny < Number(normalized.zeny)) return locked('zeny_required', 'zeny', 'AUTHORITATIVE');
  }
  if (normalized.ticket !== undefined) {
    const ticketId = typeof normalized.ticket === 'string' ? normalized.ticket : normalized.ticketId;
    if (!ticketId) return locked('ticket_identity_unknown', 'items');
    if (domainFreshness(context, 'items') !== 'FRESH') return unavailable('items');
    if (Number(context.items?.[text(ticketId)] ?? 0) < Number(normalized.ticketCount ?? 1)) {
      return locked('ticket_required', 'items', 'AUTHORITATIVE');
    }
  }
  if (normalized.level !== undefined || normalized.jobLevel !== undefined || normalized.job !== undefined || normalized.classId !== undefined) {
    if (domainFreshness(context, 'character') !== 'FRESH') return unavailable('character');
    if (normalized.level !== undefined && (!Number.isFinite(Number(context.character?.baseLevel ?? context.character?.level)) || Number(context.character?.baseLevel ?? context.character?.level) < Number(normalized.level))) return locked('base_level_required', 'character', 'AUTHORITATIVE');
    if (normalized.jobLevel !== undefined && (!Number.isFinite(Number(context.character?.jobLevel)) || Number(context.character?.jobLevel) < Number(normalized.jobLevel))) return locked('job_level_required', 'character', 'AUTHORITATIVE');
    if (normalized.job !== undefined && text(context.character?.job) !== text(normalized.job)) return locked('job_required', 'character', 'AUTHORITATIVE');
    if (normalized.classId !== undefined && String(context.character?.classId ?? '') !== String(normalized.classId)) return locked('class_required', 'character', 'AUTHORITATIVE');
  }
  const supported = new Set([
    'quest', 'questState', 'instance', 'event', 'scriptCondition', 'npcAvailable', 'npc',
    'savePoint', 'item', 'itemCount', 'zeny', 'ticket', 'ticketId', 'ticketCount',
    'level', 'jobLevel', 'job', 'classId', 'namedVariable', 'allOf',
    'authority', 'normalizationStatus', 'requirementAuthority', 'authoritativePredicates',
  ]);
  const unknownKey = entries.find(([key]) => !supported.has(key));
  if (unknownKey) return locked(`unsupported_requirement:${unknownKey[0]}`, 'scriptConditions');
  return { status: REQUIREMENT_STATUS.READY, reason: null, authority: 'AUTHORITATIVE' };
}

export function contextStatus(context) {
  return context?.freshness?.overall === 'FRESH'
    ? 'FRESH'
    : 'CONTEXT_UNAVAILABLE';
}

export function solverOptionsFromContext(context) {
  return {
    quests: context?.quests ?? {},
    instances: context?.instances ?? {},
    events: context?.events ?? {},
    scriptConditions: context?.scriptConditions ?? {},
    items: context?.items ?? {},
    zeny: context?.zeny ?? 0,
    savePoint: context?.savePoint ?? null,
    npcs: context?.npcs ?? {},
  };
}
