import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const DEFAULT_CONFIG = Object.freeze({
  enabled: false,
  percentage: 0,
  canaryCharacterIds: [],
});

// SERVER_AGENT combat events are projected through native Event Ledger polling.
// The text-log SSE stream would hide those events for agent-owned characters.
export function gateCombatSseForServerAgent(state, serverAgentControlled) {
  if (!state || !serverAgentControlled) return state;
  return { ...state, eligible: false, transport: 'polling' };
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0));
}

function booleanValue(value) {
  return /^(?:1|true|yes|on)$/i.test(String(value ?? '').trim());
}

function stableBucket(characterId) {
  const digest = createHash('sha256').update(String(characterId)).digest();
  return digest.readUInt32BE(0) % 100;
}

function normalizedConfig(value = {}) {
  return {
    enabled: Boolean(value.enabled),
    percentage: clamp(Math.floor(value.percentage), 0, 100),
    canaryCharacterIds: [...new Set(value.canaryCharacterIds ?? [])]
      .map(Number)
      .filter(Number.isInteger),
  };
}

export class CombatSseRollout {
  constructor({ configPath, clock = Date.now, cacheMs = 1_000 } = {}) {
    this.configPath = configPath;
    this.clock = clock;
    this.cacheMs = cacheMs;
    this.cached = null;
  }

  environmentDefault() {
    return normalizedConfig({
      enabled: booleanValue(process.env.COMBAT_SSE_ENABLED),
      percentage: process.env.COMBAT_SSE_ROLLOUT_PERCENT ?? 0,
      canaryCharacterIds: String(process.env.COMBAT_SSE_CANARY_CHARACTER_IDS ?? '')
        .split(',')
        .filter(Boolean),
    });
  }

  async read({ force = false } = {}) {
    const now = this.clock();
    if (!force && this.cached && now - this.cached.at < this.cacheMs)
      return this.cached.value;
    let value = this.environmentDefault();
    if (this.configPath) {
      try {
        const local = JSON.parse(await readFile(this.configPath, 'utf8'));
        value = normalizedConfig({ ...value, ...local });
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    this.cached = { at: now, value };
    return value;
  }

  async state(characterId) {
    const config = await this.read();
    const id = Number(characterId);
    const canary = config.canaryCharacterIds.includes(id);
    const eligible =
      config.enabled &&
      Number.isInteger(id) &&
      (canary || stableBucket(id) < config.percentage);
    return {
      enabled: config.enabled,
      eligible,
      percentage: config.percentage,
      canary,
      transport: eligible ? 'sse' : 'polling',
    };
  }
}

export function encodeSseEvent({ event, id, data, retry }) {
  const lines = [];
  if (Number.isFinite(retry)) lines.push(`retry: ${Math.max(1_000, retry)}`);
  if (id) lines.push(`id: ${id}`);
  if (event) lines.push(`event: ${event}`);
  const body = JSON.stringify(data ?? null);
  for (const line of body.split(/\r?\n/)) lines.push(`data: ${line}`);
  return `${lines.join('\n')}\n\n`;
}

function eventCursorFromId(eventId) {
  const match = String(eventId ?? '').match(/^[^:]+:(\d+)$/);
  return match ? Number(match[1]) : null;
}

function mergeQueuedCombat(left, right, maxLines) {
  const lines = [...(left.data.lines ?? []), ...(right.data.lines ?? [])];
  if (lines.length > maxLines) return null;
  return {
    ...right,
    data: {
      ...right.data,
      fromCursor: left.data.fromCursor,
      fromCombatRevision: left.data.fromCombatRevision,
      lines,
      coalescedFrames:
        Number(left.data.coalescedFrames ?? 1) +
        Number(right.data.coalescedFrames ?? 1),
    },
  };
}

export class CombatSseBroker {
  constructor({
    loadFrame,
    tickMs = 200,
    heartbeatMs = 20_000,
    resumeWindowMs = 30_000,
    maximumQueueEvents = 16,
    maximumQueueBytes = 64 * 1024,
    maximumLinesPerFrame = 100,
    reconnectWindowMs = 10_000,
    maximumReconnectsPerWindow = 8,
    maximumViewersPerCharacter = 8,
    clock = Date.now,
  } = {}) {
    if (typeof loadFrame !== 'function') throw new TypeError('loadFrame required');
    this.loadFrame = loadFrame;
    this.tickMs = tickMs;
    this.heartbeatMs = heartbeatMs;
    this.resumeWindowMs = resumeWindowMs;
    this.maximumQueueEvents = maximumQueueEvents;
    this.maximumQueueBytes = maximumQueueBytes;
    this.maximumLinesPerFrame = maximumLinesPerFrame;
    this.reconnectWindowMs = reconnectWindowMs;
    this.maximumReconnectsPerWindow = maximumReconnectsPerWindow;
    this.maximumViewersPerCharacter = maximumViewersPerCharacter;
    this.clock = clock;
    this.hubs = new Map();
    this.reconnects = new Map();
    this.lastReconnectPruneAt = 0;
    this.metrics = {
      connectionsAccepted: 0,
      connectionsRejected: 0,
      reconnectRateLimited: 0,
      eventsProduced: 0,
      eventsTransmitted: 0,
      bytesTransmitted: 0,
      framesCoalesced: 0,
      slowViewerDisconnects: 0,
      resnapshotRequired: 0,
      producerErrors: 0,
    };
  }

  reconnectAllowed(key) {
    const now = this.clock();
    this.pruneReconnects(now);
    const recent = (this.reconnects.get(key) ?? []).filter(
      (at) => now - at < this.reconnectWindowMs,
    );
    if (recent.length >= this.maximumReconnectsPerWindow) {
      this.reconnects.set(key, recent);
      this.metrics.reconnectRateLimited += 1;
      return false;
    }
    recent.push(now);
    this.reconnects.set(key, recent);
    return true;
  }

  pruneReconnects(now = this.clock()) {
    if (now - this.lastReconnectPruneAt < this.reconnectWindowMs) return;
    this.lastReconnectPruneAt = now;
    for (const [key, attempts] of this.reconnects) {
      const recent = attempts.filter((at) => now - at < this.reconnectWindowMs);
      if (recent.length) this.reconnects.set(key, recent);
      else this.reconnects.delete(key);
    }
  }

  hubFor({ characterId, accountId, instanceId, cursor, combatRevision }) {
    const key = Number(characterId);
    let hub = this.hubs.get(key);
    if (!hub) {
      hub = {
        characterId: key,
        accountId: Number(accountId),
        instanceId,
        cursor: Number.isInteger(cursor) ? cursor : 0,
        combatRevision: Number(combatRevision ?? 0),
        sequence: 0,
        viewers: new Map(),
        ring: [],
        ticking: false,
        timer: null,
        cleanupTimer: null,
        lastActivityAt: this.clock(),
        lastHeartbeatAt: 0,
      };
      this.hubs.set(key, hub);
    }
    if (hub.cleanupTimer) {
      clearTimeout(hub.cleanupTimer);
      hub.cleanupTimer = null;
    }
    return hub;
  }

  async subscribe({
    request,
    response,
    accountId,
    characterId,
    instanceId,
    viewerId,
    cursor,
    combatRevision,
    lastEventId,
    headers = {},
  }) {
    const reconnectKey = `${Number(accountId)}:${viewerId}`;
    if (!this.reconnectAllowed(reconnectKey)) {
      this.metrics.connectionsRejected += 1;
      response.writeHead(429, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'retry-after': '10',
        ...headers,
      });
      response.end(JSON.stringify({ error: 'combat_stream_rate_limited' }));
      return false;
    }
    const hub = this.hubFor({
      characterId,
      accountId,
      instanceId,
      cursor,
      combatRevision,
    });
    if (
      !hub.viewers.size &&
      !lastEventId &&
      Number.isInteger(cursor)
    ) {
      hub.cursor = cursor;
      hub.combatRevision = Number(combatRevision ?? hub.combatRevision);
      hub.ring = [];
    }
    const existing = hub.viewers.get(viewerId);
    if (!existing && hub.viewers.size >= this.maximumViewersPerCharacter) {
      this.metrics.connectionsRejected += 1;
      response.writeHead(429, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'retry-after': '10',
        ...headers,
      });
      response.end(JSON.stringify({ error: 'combat_stream_viewer_limit' }));
      return false;
    }
    if (existing) {
      existing.response.end();
      this.disconnectViewer(hub, existing, 'replaced');
    }
    response.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-store',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
      ...headers,
    });
    response.write(`retry: 15000\n: connected\n\n`);
    const viewer = {
      id: viewerId,
      response,
      queue: [],
      queueBytes: 0,
      blocked: false,
      closed: false,
      lastEventId: String(lastEventId ?? ''),
      cursor: Number.isInteger(cursor) ? cursor : hub.cursor,
      combatRevision: Number(combatRevision ?? hub.combatRevision),
      connectedAt: this.clock(),
      hub,
    };
    hub.viewers.set(viewerId, viewer);
    this.metrics.connectionsAccepted += 1;
    const close = () => this.disconnectViewer(hub, viewer, 'closed');
    response.once?.('close', close);
    response.once?.('error', close);
    response.on?.('drain', () => this.flushViewer(hub, viewer));

    if (viewer.lastEventId) {
      const sequence = eventCursorFromId(viewer.lastEventId);
      const index = hub.ring.findIndex((frame) => frame.sequence === sequence);
      if (index >= 0) {
        for (const frame of hub.ring.slice(index + 1))
          this.deliverFrame(hub, viewer, frame);
      } else if (hub.ring.length) {
        this.requireResnapshot(hub, viewer, 'resume_window_expired');
        return false;
      }
    } else if (viewer.cursor !== hub.cursor && hub.ring.length) {
      const replay = hub.ring.filter((frame) => frame.data.cursor > viewer.cursor);
      if (!replay.length || replay[0].data.fromCursor !== viewer.cursor) {
        this.requireResnapshot(hub, viewer, 'cursor_gap');
        return false;
      }
      for (const frame of replay) this.deliverFrame(hub, viewer, frame);
    }
    const ready = encodeSseEvent({
      event: 'ready',
      data: {
        characterId: Number(characterId),
        combatRevision: hub.combatRevision,
        eventId: null,
        timestamp: this.clock(),
        eventType: 'ready',
        cursor: hub.cursor,
      },
    });
    this.writeRaw(viewer, ready);
    this.schedule(hub, 0);
    return true;
  }

  schedule(hub, delay = this.tickMs) {
    if (hub.timer || !hub.viewers.size) return;
    hub.timer = setTimeout(() => {
      hub.timer = null;
      void this.tick(hub);
    }, delay);
    hub.timer.unref?.();
  }

  async tick(hub) {
    if (hub.ticking || !hub.viewers.size) return;
    hub.ticking = true;
    try {
      const frame = await this.loadFrame({
        accountId: hub.accountId,
        characterId: hub.characterId,
        instanceId: hub.instanceId,
        cursor: hub.cursor,
        combatRevision: hub.combatRevision,
      });
      if (frame?.reset) {
        for (const viewer of [...hub.viewers.values()])
          this.requireResnapshot(hub, viewer, frame.reason ?? 'event_gap');
        return;
      }
      const nextCursor = Number(frame?.cursor ?? hub.cursor);
      const nextRevision = Number(frame?.combatRevision ?? hub.combatRevision);
      const changed =
        nextCursor !== hub.cursor ||
        nextRevision !== hub.combatRevision ||
        Boolean(frame?.targetChanged);
      if (changed) {
        const previousCursor = hub.cursor;
        const previousRevision = hub.combatRevision;
        hub.cursor = nextCursor;
        hub.combatRevision = nextRevision;
        hub.sequence += 1;
        const eventId = `${hub.characterId}:${hub.sequence}`;
        const data = {
          characterId: hub.characterId,
          combatRevision: nextRevision,
          fromCombatRevision: previousRevision,
          eventId,
          timestamp: Number(frame.timestamp ?? this.clock()),
          eventType: 'combat_delta',
          fromCursor: previousCursor,
          cursor: nextCursor,
          lines: frame.lines ?? [],
          combatDelta: frame.combatDelta ?? null,
          live: frame.live ?? null,
        };
        const produced = {
          event: 'combat_delta',
          id: eventId,
          sequence: hub.sequence,
          data,
        };
        produced.encoded = encodeSseEvent(produced);
        produced.bytes = Buffer.byteLength(produced.encoded);
        hub.ring.push(produced);
        while (
          hub.ring.length > 128 ||
          (hub.ring.length &&
            this.clock() - hub.ring[0].data.timestamp > this.resumeWindowMs)
        )
          hub.ring.shift();
        this.metrics.eventsProduced += 1;
        for (const viewer of hub.viewers.values())
          this.deliverFrame(hub, viewer, produced);
        hub.lastActivityAt = this.clock();
      } else if (this.clock() - hub.lastHeartbeatAt >= this.heartbeatMs) {
        const heartbeat = `: heartbeat ${this.clock()}\n\n`;
        for (const viewer of hub.viewers.values())
          this.writeRaw(viewer, heartbeat);
        hub.lastHeartbeatAt = this.clock();
      }
    } catch {
      this.metrics.producerErrors += 1;
    } finally {
      hub.ticking = false;
      this.schedule(hub);
    }
  }

  writeRaw(viewer, encoded) {
    if (viewer.closed) return false;
    try {
      viewer.response.observationPayloadBytes =
        Number(viewer.response.observationPayloadBytes ?? 0) +
        Buffer.byteLength(encoded);
      const accepted = viewer.response.write(encoded);
      if (!accepted) viewer.blocked = true;
      return accepted;
    } catch {
      this.disconnectViewer(viewer.hub, viewer, 'write_failed');
      return false;
    }
  }

  deliverFrame(hub, viewer, frame) {
    if (viewer.closed) return;
    if (!viewer.blocked && !viewer.queue.length) {
      this.writeRaw(viewer, frame.encoded);
      viewer.lastEventId = frame.id;
      viewer.cursor = frame.data.cursor;
      viewer.combatRevision = frame.data.combatRevision;
      this.metrics.eventsTransmitted += 1;
      this.metrics.bytesTransmitted += frame.bytes;
      return;
    }
    const last = viewer.queue.at(-1);
    if (last?.event === 'combat_delta' && frame.event === 'combat_delta') {
      const merged = mergeQueuedCombat(
        last,
        frame,
        this.maximumLinesPerFrame,
      );
      if (merged) {
        merged.encoded = encodeSseEvent(merged);
        merged.bytes = Buffer.byteLength(merged.encoded);
        viewer.queueBytes += merged.bytes - last.bytes;
        viewer.queue[viewer.queue.length - 1] = merged;
        this.metrics.framesCoalesced += 1;
      } else {
        this.requireResnapshot(hub, viewer, 'slow_viewer_line_limit');
        return;
      }
    } else {
      viewer.queue.push(frame);
      viewer.queueBytes += frame.bytes;
    }
    if (
      viewer.queue.length > this.maximumQueueEvents ||
      viewer.queueBytes > this.maximumQueueBytes
    )
      this.requireResnapshot(hub, viewer, 'slow_viewer_backpressure');
  }

  flushViewer(hub, viewer) {
    if (viewer.closed) return;
    viewer.blocked = false;
    while (!viewer.blocked && viewer.queue.length) {
      const frame = viewer.queue.shift();
      viewer.queueBytes -= frame.bytes;
      this.writeRaw(viewer, frame.encoded);
      viewer.lastEventId = frame.id;
      viewer.cursor = frame.data.cursor;
      viewer.combatRevision = frame.data.combatRevision;
      this.metrics.eventsTransmitted += 1;
      this.metrics.bytesTransmitted += frame.bytes;
    }
  }

  requireResnapshot(hub, viewer, reason) {
    if (viewer.closed) return;
    this.metrics.resnapshotRequired += 1;
    if (/slow_viewer/.test(reason)) this.metrics.slowViewerDisconnects += 1;
    if (!viewer.blocked)
      this.writeRaw(
        viewer,
        encodeSseEvent({
          event: 'resnapshot_required',
          data: {
            characterId: hub.characterId,
            combatRevision: hub.combatRevision,
            eventId: viewer.lastEventId || null,
            timestamp: this.clock(),
            eventType: 'resnapshot_required',
            reason,
            cursor: hub.cursor,
          },
        }),
      );
    viewer.response.end();
    this.disconnectViewer(hub, viewer, reason);
  }

  disconnectViewer(hub, viewer) {
    if (viewer.closed) return;
    viewer.closed = true;
    hub.viewers.delete(viewer.id);
    if (!hub.viewers.size) {
      if (hub.timer) clearTimeout(hub.timer);
      hub.timer = null;
      hub.cleanupTimer = setTimeout(() => {
        if (!hub.viewers.size) this.hubs.delete(hub.characterId);
      }, this.resumeWindowMs);
      hub.cleanupTimer.unref?.();
    }
  }

  disconnect(characterId, viewerId) {
    const hub = this.hubs.get(Number(characterId));
    const viewer = hub?.viewers.get(String(viewerId));
    if (!hub || !viewer) return false;
    viewer.response.end();
    this.disconnectViewer(hub, viewer, 'interest_inactive');
    return true;
  }

  summary() {
    this.pruneReconnects();
    const hubs = [...this.hubs.values()];
    const viewers = hubs.flatMap((hub) => [...hub.viewers.values()]);
    return {
      ...this.metrics,
      hubs: hubs.length,
      activeProducers: hubs.filter((hub) => hub.viewers.size > 0).length,
      viewers: viewers.length,
      queuedEvents: viewers.reduce(
        (total, viewer) => total + viewer.queue.length,
        0,
      ),
      queuedBytes: viewers.reduce(
        (total, viewer) => total + viewer.queueBytes,
        0,
      ),
      reconnectKeys: this.reconnects.size,
      tickMs: this.tickMs,
      heartbeatMs: this.heartbeatMs,
      resumeWindowMs: this.resumeWindowMs,
      maximumQueueEvents: this.maximumQueueEvents,
      maximumQueueBytes: this.maximumQueueBytes,
      maximumViewersPerCharacter: this.maximumViewersPerCharacter,
    };
  }
}
