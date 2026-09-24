(() => {
  'use strict';
  const MAX_QUEUE = 64;
  const FLUSH_MS = 5000;
  const sessionKey = 'ghost-island.rum-session-id';
  const sessionId = (() => {
    try { const saved = sessionStorage.getItem(sessionKey); if (saved) return saved; } catch {}
    const value = `session_${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`.slice(0, 96);
    try { sessionStorage.setItem(sessionKey, value); } catch {}
    return value;
  })();
  const queue = [];
  const recentErrors = new Map();
  let flushTimer = null;
  let frameRunning = false;
  let frameLast = 0;
  let frameSamples = [];
  const percentile = (values, ratio) => { const sorted = values.slice().sort((a, b) => a - b); return sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)] : null; };
  const route = () => `${location.pathname}${location.hash}`.slice(0, 160);
  const visibility = () => document.visibilityState === 'hidden' ? 'hidden' : 'visible';
  const correlationId = () => `corr_${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`.slice(0, 96);
  function eligible() { return globalThis.__webExperienceTelemetryConfig?.enabled === true && globalThis.__webExperienceTelemetryConfig?.eligible === true; }
  function flush() {
    flushTimer = null;
    if (!queue.length || !eligible()) return;
    const events = queue.splice(0, queue.length);
    fetch('/api/web-experience/telemetry', { method: 'POST', cache: 'no-store', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ events }) }).catch(() => {});
  }
  function record(domain, metric, value, unit = 'ms', context = {}) {
    if (!eligible() || !Number.isFinite(Number(value)) || Number(value) < 0) return;
    queue.push({ kind: 'WEB_OBSERVABILITY', timestamp: Date.now(), sessionId, correlationId: correlationId(), route: route(), domain, metric, value: Number(value), unit, visibility: visibility(), context });
    if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
    if (queue.length >= 12) flush();
    else if (flushTimer === null) flushTimer = setTimeout(flush, FLUSH_MS);
  }
  globalThis.playerWebObservability = Object.freeze({ record });
  function flushFrames() {
    if (!frameSamples.length) return;
    const samples = frameSamples; frameSamples = [];
    record('BROWSER_RENDER_HEALTH', 'frame_interval_ms', percentile(samples, 0.5), 'ms', { p95: percentile(samples, 0.95), p99: percentile(samples, 0.99), max: Math.max(...samples), count: samples.length });
  }
  function frame(now) {
    if (!frameRunning) return;
    if (visibility() === 'visible' && frameLast > 0) {
      const gap = now - frameLast;
      if (gap > 20) frameSamples.push(gap);
      if (gap >= 500) record('BROWSER_RENDER_HEALTH', 'long_frame_count', 1, 'count', { gapMs: gap });
    }
    frameLast = now;
    requestAnimationFrame(frame);
  }
  function installPerformanceObservers() {
    if (typeof PerformanceObserver !== 'function') return;
    try { new PerformanceObserver((list) => list.getEntries().forEach((entry) => { if (visibility() === 'visible') record('MAIN_THREAD_UI_STALL', 'long_task_ms', entry.duration, 'ms', { name: entry.name }); })).observe({ type: 'longtask', buffered: true }); } catch {}
    try { new PerformanceObserver((list) => list.getEntries().forEach((entry) => { const resource = new URL(entry.name).pathname; const domain = resource.startsWith('/api/') ? 'HTTP_API' : 'ASSET_LOADING'; const metric = domain === 'HTTP_API' ? 'request_duration_ms' : 'resource_load_ms'; record(domain, metric, entry.duration, 'ms', { resource, status: entry.responseStatus ?? null, bytes: entry.transferSize ?? null }); })).observe({ type: 'resource', buffered: true }); } catch {}
    try { new PerformanceObserver((list) => list.getEntries().forEach((entry) => record('CORE_WEB_VITALS', 'lcp_ms', entry.startTime))).observe({ type: 'largest-contentful-paint', buffered: true }); } catch {}
    try { new PerformanceObserver((list) => list.getEntries().forEach((entry) => record('CORE_WEB_VITALS', 'cls', entry.value, 'score'))).observe({ type: 'layout-shift', buffered: true }); } catch {}
  }
  addEventListener('error', (event) => {
    const message = String(event.message ?? 'window_error').slice(0, 160); const key = `${route()}|${message}`; const at = Date.now();
    if (at - Number(recentErrors.get(key) ?? 0) < 60_000) return; recentErrors.set(key, at);
    record('JS_RUNTIME_ERRORS', 'window_error', 1, 'count', { message, source: String(event.filename ?? '').slice(-160), line: Number(event.lineno) || null, column: Number(event.colno) || null });
  });
  addEventListener('unhandledrejection', (event) => record('JS_RUNTIME_ERRORS', 'unhandled_rejection', 1, 'count', { message: String(event.reason?.message ?? event.reason ?? 'unhandled rejection').slice(0, 160) }));
  addEventListener('pagehide', () => { flushFrames(); flush(); }, { capture: true });
  addEventListener('visibilitychange', () => { if (visibility() === 'hidden') { flushFrames(); flush(); } });
  frameRunning = true; requestAnimationFrame(frame); setInterval(flushFrames, FLUSH_MS); installPerformanceObservers();
  const navigation = performance.getEntriesByType('navigation')[0];
  if (navigation) record('ROUTE_NAVIGATION', 'route_complete_ms', navigation.loadEventEnd || navigation.duration, 'ms');
})();
