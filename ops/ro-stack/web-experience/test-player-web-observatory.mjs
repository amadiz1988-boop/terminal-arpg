import assert from 'node:assert/strict';
import {
  ANOMALY_SCHEMA,
  buildObservatoryReport,
  createPlayerWebObservatory,
  EVENT_SCHEMA,
  METRIC_CATALOG,
  REPORT_SCHEMA,
} from './player-web-observatory.mjs';

let clock = Date.UTC(2026, 8, 21, 0, 0, 0);
const observatory = createPlayerWebObservatory({ now: () => clock, cooldownMs: 0 });
const base = (domain, metric, value, context = {}) => ({ kind: 'WEB_OBSERVABILITY', timestamp: clock++, sessionId: 'session_test', correlationId: `corr_${clock}`, route: '/game#hunt', domain, metric, value, unit: 'ms', visibility: 'visible', context });

assert.ok(METRIC_CATALOG.HTTP_API.includes('request_duration_ms'));
assert.ok(METRIC_CATALOG.SSE.includes('event_gap_ms'));
assert.ok(METRIC_CATALOG.MINIMAP.includes('snapshot_gap_ms'));
assert.ok(METRIC_CATALOG.BROWSER_RENDER_HEALTH.includes('frame_interval_ms'));
assert.ok(METRIC_CATALOG.MAIN_THREAD_UI_STALL.includes('long_task_ms'));
assert.ok(METRIC_CATALOG.JS_RUNTIME_ERRORS.includes('window_error'));
assert.equal(EVENT_SCHEMA.kind, 'WEB_OBSERVABILITY');
assert.equal(ANOMALY_SCHEMA.type, 'WEB_EXPERIENCE_ANOMALY');
assert.equal(REPORT_SCHEMA, 'WEB_EXPERIENCE_DIAGNOSTIC_REPORT_V1');

for (let index = 0; index < 12; index += 1) observatory.ingest(base('HTTP_API', 'request_duration_ms', 80));
const http1200 = observatory.ingest(base('HTTP_API', 'request_duration_ms', 1200));
assert.equal(http1200.ok, true);
assert.equal(http1200.severity, 'DEGRADED');
assert.equal(http1200.anomaly.reason, 'ABSOLUTE_GUARD');
const http2200 = observatory.ingest(base('HTTP_API', 'request_duration_ms', 2200));
assert.equal(http2200.severity, 'SEVERE');
assert.equal(http2200.anomaly.anomalyId, http1200.anomaly.anomalyId, 'same metric must dedupe');
assert.equal(http2200.anomaly.peakSeverity, 'SEVERE');

const sse1500 = observatory.ingest(base('SSE', 'event_gap_ms', 1500));
const minimap1200 = observatory.ingest(base('MINIMAP', 'snapshot_gap_ms', 1200));
const minimap2000 = observatory.ingest(base('MINIMAP', 'snapshot_gap_ms', 2000));
const longTask = observatory.ingest(base('MAIN_THREAD_UI_STALL', 'long_task_ms', 550));
const jsError = observatory.ingest(base('JS_RUNTIME_ERRORS', 'window_error', 1, { message: 'synthetic safe error', authorization: 'must-hide' }));
assert.equal(sse1500.severity, 'DEGRADED');
assert.equal(minimap1200.severity, 'DEGRADED');
assert.equal(minimap2000.severity, 'SEVERE');
assert.equal(longTask.ok, true);
assert.equal(longTask.severity, 'DEGRADED');
assert.equal(longTask.anomaly.reason, 'ABSOLUTE_GUARD_500');
assert.equal(jsError.event.context.authorization, '[REDACTED]');

const activeBeforeRecovery = observatory.snapshot();
assert.ok(activeBeforeRecovery.activeAnomalies.some((entry) => entry.domain === 'HTTP_API'));
assert.ok(activeBeforeRecovery.activeAnomalies.some((entry) => entry.domain === 'SSE'));
assert.ok(activeBeforeRecovery.activeAnomalies.some((entry) => entry.domain === 'MINIMAP'));
assert.ok(activeBeforeRecovery.counters.deduped >= 2);

observatory.ingest(base('HTTP_API', 'request_duration_ms', 70));
const recovered = observatory.snapshot();
assert.ok(recovered.recentAnomalies.some((entry) => entry.domain === 'HTTP_API' && entry.severity === 'RECOVERED'));
assert.ok(recovered.metrics.find((entry) => entry.domain === 'MINIMAP').gt1000 >= 2);
assert.ok(recovered.metrics.find((entry) => entry.domain === 'MINIMAP').gt2000 >= 1);
assert.ok(recovered.evidence.length <= 32);

const report = buildObservatoryReport(recovered, { production: 'synthetic-test', activeSessions: 1 });
assert.ok(report.startsWith('WEB_EXPERIENCE_DIAGNOSTIC_REPORT_V1'));
assert.ok(report.includes('ANOMALY SUMMARY'));
assert.ok(report.includes('MINIMAP'));
assert.ok(report.includes('HTTP'));
assert.ok(report.includes('SSE'));
assert.ok(report.includes('BROWSER'));
assert.ok(report.includes('RAW EVIDENCE'));
assert.ok(report.endsWith('END REPORT'));
assert.ok(report.length <= 40_000);
assert.doesNotMatch(report, /must-hide/);

console.log(JSON.stringify({ result: 'PLAYER_WEB_OBSERVATORY_SYNTHETIC_PASS', synthetic: { http1200: http1200.severity, http2200: http2200.severity, sse1500: sse1500.severity, minimap1200: minimap1200.severity, minimap2000: minimap2000.severity, longTask500Plus: longTask.severity, jsError: jsError.ok ? 'CAPTURED' : 'FAIL' }, anomalies: recovered.recentAnomalies.length + recovered.activeAnomalies.length, deduped: recovered.counters.deduped, reportBytes: Buffer.byteLength(report) }, null, 2));
