(function (root) {
  'use strict';

  const finite = (value) => Number.isFinite(Number(value));
  const numberOrNull = (value) => (finite(value) ? Number(value) : null);

  function normalizePosition(payload) {
    const source = payload?.live ?? payload;
    const map = String(source?.map ?? '').trim();
    const x = numberOrNull(source?.x ?? source?.playerX);
    const y = numberOrNull(source?.y ?? source?.playerY);
    if (!map || x === null || y === null)
      return { available: false, reason: 'POSITION_DATA_UNAVAILABLE' };
    return {
      available: true,
      map,
      x,
      y,
      revision: numberOrNull(source?.revision ?? source?.domainRevisions?.live),
      authoritativeAt: numberOrNull(
        source?.updatedAt ?? source?.freshness?.authoritativeAt,
      ),
      freshnessAgeMs: numberOrNull(source?.freshness?.ageMs),
      statusIntervalMs: numberOrNull(source?.statusIntervalMs),
    };
  }

  function normalizeEntity(entity, entityType) {
    if (!entity || entity.id === undefined) return null;
    const x = numberOrNull(entity.x), y = numberOrNull(entity.y);
    if (x === null || y === null) return null;
    return {
      id: String(entity.id),
      entityType,
      x,
      y,
      name: String(entity.name ?? '').trim() || null,
      mobId: numberOrNull(entity.mobId),
      hp: numberOrNull(entity.hp),
      hpMax: numberOrNull(entity.hpMax ?? entity.maxHp),
    };
  }

  function normalizeLiveSnapshot(payload) {
    const source = payload?.live ?? payload;
    const position = normalizePosition(source);
    if (!position.available) return position;
    const playerId = String(
      payload?.characterId ?? source?.characterId ?? 'player',
    );
    const player = {
      id: playerId,
      entityType: 'PLAYER',
      x: position.x,
      y: position.y,
      name: String(source?.name ?? '').trim() || null,
      hp: numberOrNull(source?.hp),
      hpMax: numberOrNull(source?.maxHp),
    };
    const monsters = Array.isArray(source?.monsters)
      ? source.monsters
          .map((entity) => normalizeEntity(entity, 'MONSTER'))
          .filter(Boolean)
    : [];
    const players = Array.isArray(source?.players)
      ? source.players
          .map((entity) => normalizeEntity(entity, 'PLAYER'))
          .filter(Boolean)
      : [];
    return {
      available: true,
      map: position.map,
      player,
      monsters,
      players,
      revision: position.revision,
      authoritativeAt: position.authoritativeAt,
      freshnessAgeMs: position.freshnessAgeMs,
      statusIntervalMs: position.statusIntervalMs,
      targetId: null,
      targetSource: null,
    };
  }

  function parseTarget(line) {
    const match = String(line).match(
      /Monster\s+(.+?)\s+\((\d+)\)/,
    );
    return match
      ? { targetName: match[1].trim(), targetId: match[2] }
      : { targetName: null, targetId: null };
  }

  function normalizeCombatLine(line, source, sequence = 0) {
    const raw = String(line ?? '').trim();
    if (!raw) return null;
    const target = parseTarget(raw);
    let type = null;
    let damage = null;
    let targetId = target.targetId;
    if (/^You are now attacking Monster /i.test(raw)) type = 'TARGET';
    else if (/^You attack Monster /i.test(raw)) {
      const damageMatch = raw.match(/\(Dmg:\s*([^)]+)\)/i);
      if (damageMatch && finite(damageMatch[1])) {
        type = 'HIT';
        damage = Math.trunc(Number(damageMatch[1]));
      } else type = 'ATTACK';
    } else if (/^Target Monster .+ died$/i.test(raw)) type = 'KILL';
    else if (/^Map Change:\s*/i.test(raw)) type = 'MAP_CHANGE';
    else if (/^Item added to inventory:/i.test(raw)) type = 'LOOT';
    else if (/^(?:You have died|玩家死亡)/i.test(raw)) type = 'DEATH';
    if (!type) return null;
    if (type === 'MAP_CHANGE') {
      const map = raw.replace(/^Map Change:\s*/i, '').trim();
      return { id: `${source}:${sequence}:${raw}`, type, raw, map, source };
    }
    if (type === 'LOOT') targetId = null;
    return {
      id: `${source}:${sequence}:${raw}`,
      type,
      raw,
      targetId,
      targetName: target.targetName,
      damage,
      source,
    };
  }

  function normalizeCombatLines(lines, source = 'read-only') {
    return (Array.isArray(lines) ? lines : [])
      .map((line, index) =>
        normalizeCombatLine(line, source, index),
      )
      .filter(Boolean);
  }

  function mergePresentationState(previous, payload) {
    const live = normalizeLiveSnapshot(payload);
    if (!live.available) return previous ?? live;
    return {
      ...(previous ?? {}),
      ...live,
      combatEvents: previous?.combatEvents ?? [],
    };
  }

  function createLiveReadOnlyAdapter(options = {}) {
    const fetchImpl = options.fetchImpl ?? root.fetch?.bind(root);
    const EventSourceImpl = options.EventSourceImpl ?? root.EventSource;
    const viewerId = options.viewerId ??
      (root.crypto?.randomUUID ? root.crypto.randomUUID() : `poc-${Date.now()}`);
    const positionIntervalMs = 500;
    const eventIntervalMs = 300;
    let characterId = null;
    let positionTimer = null;
    let eventTimer = null;
    let positionInFlight = false;
    let eventInFlight = false;
    let cursor = null;
    let stream = null;
    let state = { status: 'LOADING', source: 'LIVE_READ_ONLY', combatEvents: [] };
    const stats = { positionRequests: 0, eventRequests: 0, sseConnections: 0 };

    const emit = () => options.onState?.(state);
    const fail = (status, error) => {
      state = { ...state, status, error: String(error?.message ?? error ?? status) };
      emit();
    };
    const request = async (url) => {
      if (typeof fetchImpl !== 'function') throw new Error('FETCH_UNAVAILABLE');
      const response = await fetchImpl(url, {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (response.status === 401 || response.status === 403)
        throw Object.assign(new Error('AUTH_REQUIRED'), { code: 'AUTH_REQUIRED' });
      if (!response.ok)
        throw new Error(`HTTP_${response.status}`);
      return await response.json();
    };

    function applyLive(payload) {
      const next = mergePresentationState(state, payload);
      if (!next.available) {
        fail('LIVE_SOURCE_UNAVAILABLE', next.reason);
        return;
      }
      state = { ...next, status: 'READY', source: 'LIVE_READ_ONLY' };
      if (state.freshnessAgeMs !== null && state.statusIntervalMs !== null &&
          state.freshnessAgeMs > Math.max(2_000, state.statusIntervalMs * 3))
        state = { ...state, status: 'STALE_POSITION' };
      emit();
    }

    function applyEvents(lines, source) {
      const events = normalizeCombatLines(lines, source);
      if (!events.length) return;
      let next = [...(state.combatEvents ?? [])];
      for (const event of events) {
        if (next.some((entry) => entry.id === event.id)) continue;
        next.push(event);
        if (event.type === 'TARGET')
          state = { ...state, targetId: event.targetId, targetSource: source };
        if (event.type === 'MAP_CHANGE' && event.map)
          state = { ...state, map: event.map, targetId: null };
      }
      state = { ...state, combatEvents: next.slice(-80), status: 'READY' };
      emit();
    }

    async function pollPosition() {
      if (!characterId || positionInFlight) return;
      positionInFlight = true;
      stats.positionRequests += 1;
      try {
        applyLive(await request(`/api/live-position?characterId=${encodeURIComponent(characterId)}`));
      } catch (error) {
        fail(error?.code === 'AUTH_REQUIRED' ? 'AUTH_REQUIRED' : 'LIVE_SOURCE_UNAVAILABLE', error);
      } finally {
        positionInFlight = false;
      }
    }

    async function pollEvents() {
      if (!characterId || eventInFlight) return;
      eventInFlight = true;
      stats.eventRequests += 1;
      try {
        const params = new URLSearchParams({
          viewer: viewerId,
          interest: 'COMBAT_PAGE',
          view: 'high',
        });
        if (Number.isInteger(cursor)) params.set('cursor', String(cursor));
        const payload = await request(`/api/events?${params}`);
        if (payload.reset) state = { ...state, combatEvents: [] };
        cursor = Number(payload.cursor ?? cursor ?? 0);
        applyLive(payload.live);
        applyEvents(payload.lines, 'Dashboard /api/events');
      } catch (error) {
        fail(error?.code === 'AUTH_REQUIRED' ? 'AUTH_REQUIRED' : 'COMBAT_STREAM_DISCONNECTED', error);
      } finally {
        eventInFlight = false;
      }
    }

    function startSse(combatStream) {
      if (!EventSourceImpl || !combatStream?.eligible) return false;
      const params = new URLSearchParams({
        viewer: viewerId,
        interest: 'COMBAT_PAGE',
        cursor: String(cursor ?? 0),
        revision: String(combatStream.combatRevision ?? 0),
      });
      stream = new EventSourceImpl(`${combatStream.endpoint ?? '/api/combat-stream'}?${params}`);
      stats.sseConnections += 1;
      stream.addEventListener('combat_delta', (event) => {
        try {
          const payload = JSON.parse(event.data);
          cursor = Number(payload.cursor ?? cursor ?? 0);
          applyLive(payload.live);
          applyEvents(payload.lines, 'Dashboard /api/combat-stream');
        } catch (error) {
          fail('COMBAT_STREAM_DISCONNECTED', error);
        }
      });
      stream.onerror = () => fail('COMBAT_STREAM_DISCONNECTED', 'SSE_ERROR');
      return true;
    }

    async function start(id) {
      characterId = Number(id);
      if (!Number.isSafeInteger(characterId) || characterId <= 0) {
        fail('LIVE_SOURCE_UNAVAILABLE', 'CHARACTER_ID_REQUIRED');
        return;
      }
      state = { status: 'LOADING', source: 'LIVE_READ_ONLY', combatEvents: [] };
      emit();
      try {
        const snapshot = await request('/api/combat-snapshot');
        cursor = Number(snapshot.cursor ?? 0);
        applyLive(snapshot.live);
        if (!startSse(snapshot.combatStream)) void pollEvents();
        await pollPosition();
      } catch (error) {
        fail(error?.code === 'AUTH_REQUIRED' ? 'AUTH_REQUIRED' : 'LIVE_SOURCE_UNAVAILABLE', error);
      }
      positionTimer = setInterval(() => void pollPosition(), positionIntervalMs);
      if (!stream) eventTimer = setInterval(() => void pollEvents(), eventIntervalMs);
    }

    function stop() {
      if (positionTimer !== null) clearInterval(positionTimer);
      if (eventTimer !== null) clearInterval(eventTimer);
      positionTimer = null;
      eventTimer = null;
      if (stream) stream.close();
      stream = null;
    }

    return { start, stop, getState: () => state, getStats: () => ({ ...stats }) };
  }

  root.minimapLiveReadonlyAdapter = {
    normalizePosition,
    normalizeLiveSnapshot,
    normalizeCombatLine,
    normalizeCombatLines,
    mergePresentationState,
    createLiveReadOnlyAdapter,
  };
})(globalThis);
