import { TRACE_RESULT } from './trace-schema.mjs';

export class BoundedTraceStore {
  constructor(options = {}) {
    this.maxTraces = Math.max(1, Number(options.maxTraces ?? 128));
    this.maxEventsPerTrace = Math.max(1, Number(options.maxEventsPerTrace ?? 64));
    this.ttlMs = Math.max(1, Number(options.ttlMs ?? 15 * 60_000));
    this.errorRetentionMs = Math.max(this.ttlMs, Number(options.errorRetentionMs ?? 60 * 60_000));
    this.now = options.now ?? (() => Date.now());
    this.traces = new Map();
  }

  prune() {
    const now = this.now();
    for (const [traceId, trace] of this.traces) {
      const completed = trace.completedAt ? Date.parse(trace.completedAt) : null;
      const parsedCreated = Date.parse(trace.startedAt);
      const created = Number.isFinite(parsedCreated) ? parsedCreated : now;
      const retention = trace.result === TRACE_RESULT.FAIL ? this.errorRetentionMs : this.ttlMs;
      if (now - Math.max(created, completed ?? created) > retention) this.traces.delete(traceId);
    }
    while (this.traces.size > this.maxTraces) this.traces.delete(this.traces.keys().next().value);
  }

  create(trace) {
    this.prune();
    this.traces.delete(trace.traceId);
    this.traces.set(trace.traceId, trace);
    this.prune();
    return trace;
  }

  append(traceId, event) {
    const trace = this.get(traceId);
    if (!trace) return null;
    trace.layers.push(event);
    if (trace.layers.length > this.maxEventsPerTrace)
      trace.layers.splice(0, trace.layers.length - this.maxEventsPerTrace);
    return event;
  }

  complete(traceId, values = {}) {
    const trace = this.get(traceId);
    if (!trace) return null;
    Object.assign(trace, values);
    return trace;
  }

  get(traceId) {
    this.prune();
    return this.traces.get(String(traceId)) ?? null;
  }

  listRecent(filters = {}) {
    this.prune();
    return [...this.traces.values()].reverse().filter((trace) => {
      if (filters.result && trace.result !== filters.result) return false;
      if (filters.actionKey && trace.actionKey !== filters.actionKey) return false;
      if (filters.charId != null && Number(trace.charId) !== Number(filters.charId)) return false;
      if (filters.layer && !trace.layers.some((event) => event.layer === filters.layer)) return false;
      if (filters.errorCode && !trace.layers.some((event) => event.errorCode === filters.errorCode)) return false;
      return true;
    });
  }
}
