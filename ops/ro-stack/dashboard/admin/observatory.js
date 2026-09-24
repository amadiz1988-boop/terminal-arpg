'use strict';

const BASE = '/api/admin/web-experience';
let mode   = 'live';        // 'live' | 'synthetic'
let window_ = '1h';
let liveData = null;
let synthData = null;
let observatoryData = null;

const categoryLabels = {
  CHARACTER: '角色', AUTOMATION: '自動化', MAP: '地圖',
  QUEST: '任務', INVENTORY: '道具欄', SYSTEM: '系統',
  COMBAT: '戰鬥', UNKNOWN: '未知',
};
const statusOrder = { RED: 1, YELLOW: 2, GREEN: 3, GRAY: 4 };

function esc(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function dur(ms) {
  if (ms == null || !Number.isFinite(Number(ms))) return '尚無資料';
  const n = Number(ms);
  if (n < 1000) return n.toFixed(0) + 'ms';
  return (n / 1000).toFixed(2) + 's';
}
function pct(v) {
  if (v == null) return '尚無資料';
  return (Number(v) * 100).toFixed(1) + '%';
}
function pill(status) {
  return `<span class="s-pill s-${esc(status)}">${esc(status)}</span>`;
}
function freshnessLabel(state) {
  return {
    HEALTHY: 'HEALTHY · 新鮮',
    WARNING: 'WARNING · 新鮮但警戒',
    ERROR: 'ERROR · 新鮮但異常',
    STALE: 'STALE · 資料過期',
    NO_DATA: 'NO_DATA · 尚無資料',
  }[state] ?? 'NO_DATA · 尚無資料';
}
function freshnessPill(state) {
  const tone = state === 'HEALTHY' ? 'GREEN' : state === 'NO_DATA' ? '' : state === 'ERROR' ? 'RED' : 'YELLOW';
  const css = state === 'STALE' ? 's-GRAY' : `s-${tone}`;
  return `<span class="s-pill ${css}">${esc(freshnessLabel(state))}</span>`;
}
function age(ms) {
  if (ms == null || !Number.isFinite(Number(ms))) return '尚無資料';
  const n = Number(ms);
  if (n < 1000) return n.toFixed(0) + 'ms 前';
  if (n < 60000) return (n / 1000).toFixed(1) + 's 前';
  if (n < 3600000) return (n / 60000).toFixed(1) + 'min 前';
  return (n / 3600000).toFixed(1) + 'h 前';
}
function trendLabel(t) {
  if (!t) return '—';
  return { IMPROVING: '↑ 改善', STABLE: '→ 穩定', REGRESSING: '↓ 回歸', INSUFFICIENT_DATA: '尚無資料' }[t] || t;
}
function sortActions(actions) {
  return [...actions].sort((a, b) => {
    const sd = (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4);
    if (sd) return sd;
    return (b.painScore ?? -1) - (a.painScore ?? -1);
  });
}

/* ── Mode / window controls ── */
function setMode(m) {
  mode = m;
  document.getElementById('btnLive').classList.toggle('active', m === 'live');
  document.getElementById('btnSynth').classList.toggle('active', m === 'synthetic');
  const badge = document.getElementById('sourceBadge');
  if (m === 'live') {
    badge.className = 'obs-source-badge live';
    badge.textContent = 'LIVE · 真實生產遙測';
  } else {
    badge.className = 'obs-source-badge synth';
    badge.textContent = 'SYNTHETIC · 模擬資料';
  }
  render();
}
function setWindow(w) {
  window_ = w;
  document.getElementById('btn1h').classList.toggle('active', w === '1h');
  document.getElementById('btn24h').classList.toggle('active', w === '24h');
  liveData = null; synthData = null;
  void loadAndRender();
}

/* ── Data loading ── */
async function fetchSummary(source) {
  const url = `${BASE}/summary?window=${window_}&source=${source}`;
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function loadAndRender() {
  const content = document.getElementById('obsContent');
  content.innerHTML = '<div class="obs-loading">載入中…</div>';
  try {
    const observatoryResponse = await fetch(`${BASE}/observatory`, { credentials: 'same-origin' });
    observatoryData = observatoryResponse.ok ? await observatoryResponse.json() : null;
    // Always try live first to check availability
    try {
      liveData = await fetchSummary('live');
    } catch {
      // Server may not support source param — fallback to no source param
      try {
        const res = await fetch(`${BASE}/summary?window=${window_}`, { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        liveData = await res.json();
      } catch {
        liveData = null;
      }
    }
    if (mode === 'synthetic' && !synthData) {
      try {
        const res = await fetch(`${BASE}/summary?window=${window_}&source=synthetic`, { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        synthData = await res.json();
      } catch { synthData = liveData; }
    }
    render();
  } catch (err) {
    content.innerHTML = `<div class="obs-error">載入失敗：${esc(err.message)}（需要管理後台存取權限）</div>`;
  }
}

/* ── Rendering ── */
function render() {
  const data = mode === 'live' ? liveData : (synthData ?? liveData);
  if (!data) {
    document.getElementById('obsContent').innerHTML = '<div class="obs-loading">尚無資料</div>';
    return;
  }
  // Filter actions by source for LIVE mode — never color LIVE with synthetic evidence
  const actions = sortActions(data.actions ?? []);
  const liveActions = mode === 'live'
    ? actions.map(a => {
        // If action has no live telemetry, force GRAY
        if (a.dataSource === 'SYNTHETIC' || (a.sampleCount != null && a.sampleCount === 0 && a.status !== 'GRAY')) {
          return { ...a, status: 'GRAY' };
        }
        return a;
      })
    : actions;

  document.getElementById('obsContent').innerHTML = [
    renderOverallHealth(data, liveActions),
    renderTopProblems(liveActions),
    renderCategoryHealth(liveActions),
    renderFreshness(data),
    renderDeployment(data, liveActions),
    renderObservatory(observatoryData),
  ].join('');
}

function renderObservatory(data) {
  if (!data) return `<div class="obs-panel"><div class="obs-panel-body obs-muted">Observatory 尚無資料。</div></div>`;
  const metrics = data.metrics ?? [];
  const by = (domain, metric) => metrics.find((entry) => entry.domain === domain && (!metric || entry.metric === metric)) ?? {};
  const cards = [
    ['GLOBAL STATUS', data.status], ['ACTIVE BROWSER SESSIONS', data.activeSessions ?? 'NOT_MEASURABLE'],
    ['ANOMALIES LAST 15M', (data.activeAnomalies?.length ?? 0) + (data.recentAnomalies?.length ?? 0)],
    ['SEVERE LAST 15M', [...(data.activeAnomalies ?? []), ...(data.recentAnomalies ?? [])].filter((entry) => entry.severity === 'SEVERE').length],
    ['P95 API LATENCY', dur(by('HTTP_API', 'request_duration_ms').p95)],
    ['P95 MINIMAP GAP', dur(by('MINIMAP', 'snapshot_gap_ms').p95)],
    ['P95 FRAME TIME', dur(by('BROWSER_RENDER_HEALTH', 'frame_interval_ms').p95)],
    ['JS ERRORS LAST 15M', by('JS_RUNTIME_ERRORS').count ?? 0],
    ['SSE RECONNECTS LAST 15M', by('SSE', 'reconnect_count').count ?? 0],
  ];
  const anomalies = [...(data.activeAnomalies ?? []), ...(data.recentAnomalies ?? [])];
  const rows = anomalies.map((entry) => `<details class="obs-problem-card p-${entry.severity === 'SEVERE' ? 'RED' : 'YELLOW'}"><summary>${pill(entry.severity)} ${esc(entry.domain)} · ${esc(entry.metric)} · ${dur(entry.observed)}</summary><div class="obs-problem-meta"><span><small>ANOMALY_ID</small>${esc(entry.anomalyId)}</span><span><small>ROUTE</small>${esc(entry.route)}</span><span><small>START</small>${esc(new Date(entry.startTime).toLocaleString())}</span><span><small>END</small>${entry.endTime ? esc(new Date(entry.endTime).toLocaleString()) : 'ACTIVE'}</span><span><small>BASELINE P50/P95/P99</small>${dur(entry.baselineP50)} / ${dur(entry.baselineP95)} / ${dur(entry.baselineP99)}</span><span><small>FIRST SLOW LAYER</small>${esc(entry.domain === 'MAIN_THREAD_UI_STALL' ? 'BROWSER_MAIN_THREAD' : entry.domain === 'HTTP_API' ? 'SERVER_OR_TRANSPORT' : 'UNKNOWN')}</span><span><small>RECOVERY</small>${esc(entry.recovery ?? 'ACTIVE')}</span></div><pre>${esc(JSON.stringify((entry.evidence ?? []).slice(-8), null, 2))}</pre></details>`).join('');
  return `<div class="obs-panel"><div class="obs-panel-head"><div><p class="obs-eyebrow">WEB EXPERIENCE</p><h2>全域觀測與異常</h2></div>${pill(data.status)}</div><div class="obs-panel-body"><div class="obs-health-grid">${cards.map(([label, val]) => `<div class="obs-hm"><small>${esc(label)}</small><strong>${esc(val)}</strong></div>`).join('')}</div></div></div><div class="obs-panel"><div class="obs-panel-head"><div><p class="obs-eyebrow">INCIDENT TIMELINE</p><h2>目前與近期異常</h2></div></div><div class="obs-panel-body">${rows || '<p class="obs-muted">目前沒有異常證據。</p>'}</div></div>`;
}

function download(name, type, content) {
  const href = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a'); anchor.href = href; anchor.download = name; anchor.click(); URL.revokeObjectURL(href);
}
async function copyReport() { if (observatoryData?.report) await navigator.clipboard.writeText(observatoryData.report); }
function downloadReportMarkdown() { if (observatoryData?.report) download('web-experience-diagnostic.md', 'text/markdown;charset=utf-8', observatoryData.report); }
function downloadReportJson() { if (observatoryData) download('web-experience-diagnostic.json', 'application/json;charset=utf-8', JSON.stringify(observatoryData, null, 2)); }

function renderOverallHealth(data, actions) {
  const counts = { RED: 0, YELLOW: 0, GREEN: 0, GRAY: 0 };
  let affectedMax = null, regressing = 0, worstP95 = null, observedCount = 0;
  for (const a of actions) {
    counts[a.status] = (counts[a.status] || 0) + 1;
    const actionCount = a.metrics?.count ?? 0;
    observedCount += actionCount;
    if (actionCount > 0 && Number.isFinite(a.metrics?.affectedUsers))
      affectedMax = Math.max(affectedMax ?? 0, a.metrics.affectedUsers);
    if (a.trend?.trend === 'REGRESSING') regressing++;
    if (Number.isFinite(a.metrics?.p95)) worstP95 = Math.max(worstP95 ?? 0, a.metrics.p95);
  }
  // Overall status: worst non-GRAY
  const overall = data.overallStatus ?? (
    counts.RED ? 'RED' : counts.YELLOW ? 'YELLOW' : counts.GREEN ? 'GREEN' : 'GRAY'
  );
  const metrics = [
    ['RED 問題', counts.RED, 'RED'],
    ['YELLOW 警告', counts.YELLOW, 'YELLOW'],
    ['GREEN 正常', counts.GREEN, 'GREEN'],
    ['尚無資料', counts.GRAY, ''],
    ['受影響玩家', affectedMax ?? '尚無資料', ''],
    ['已觀測事件', observedCount, ''],
    ['回歸操作', regressing, ''],
    ['最差 p95', dur(worstP95), ''],
    ['最近觀測', data.lastObservedAt ? age(data.freshness?.ageMs) : '尚無資料', ''],
  ];
  return `<div class="obs-panel">
    <div class="obs-panel-head">
      <div><p class="obs-eyebrow">PRIMARY SIGNAL</p><h2>整體健康度</h2></div>
      ${pill(overall)} ${freshnessPill(data.overallFreshnessState)}
    </div>
    <div class="obs-panel-body">
      <div class="obs-health-grid">
        ${metrics.map(([label, val, tone]) =>
          `<div class="obs-hm${tone ? ' t-' + tone : ''}"><small>${esc(label)}</small><strong>${esc(val)}</strong></div>`
        ).join('')}
      </div>
    </div>
  </div>`;
}

function renderTopProblems(actions) {
  const problems = actions.filter(a => a.status === 'RED' || a.status === 'YELLOW').slice(0, 5);
  const items = problems.length
    ? problems.map(a => {
        const hint = a.rootCauseHints?.[0]
          ? `<div class="obs-problem-hint">💡 ${esc(a.rootCauseHints[0])}</div>` : '';
        return `<li class="obs-problem-card p-${esc(a.status)}">
          <div class="obs-problem-top">
            ${pill(a.status)}
            <span class="obs-problem-name">${esc(a.displayName ?? a.actionId)}</span>
          </div>
          <div class="obs-problem-meta">
            <span><small>類別</small>${esc(categoryLabels[a.category] ?? a.category)}</span>
            <span><small>Pain Score</small>${esc(a.painScore ?? '—')}</span>
            <span><small>p95</small>${dur(a.metrics?.p95)}</span>
            <span><small>受影響</small>${esc(a.metrics?.affectedUsers ?? '—')} 人</span>
            <span><small>趨勢</small>${esc(trendLabel(a.trend?.trend))}</span>
            ${a.lastDeployment ? `<span><small>版本關聯</small>DEPLOYMENT_CORRELATED</span>` : ''}
            ${Number.isFinite(a.metrics?.errorRate) ? `<span><small>錯誤率</small>${pct(a.metrics.errorRate)}</span>` : ''}
            ${Number.isFinite(a.metrics?.staleRate) ? `<span><small>過期率</small>${pct(a.metrics.staleRate)}</span>` : ''}
          </div>
          ${hint}
        </li>`;
      }).join('')
    : '<li class="obs-muted">目前沒有 RED / YELLOW 問題。</li>';

  return `<div class="obs-panel">
    <div class="obs-panel-head">
      <div><p class="obs-eyebrow">RED FIRST</p><h2>主要問題</h2></div>
    </div>
    <div class="obs-panel-body">
      <ol class="obs-problems">${items}</ol>
    </div>
  </div>`;
}

function renderCategoryHealth(actions) {
  const cats = {};
  for (const a of actions) {
    const c = a.category ?? 'UNKNOWN';
    if (!cats[c]) cats[c] = { RED: 0, YELLOW: 0, GREEN: 0, GRAY: 0 };
    cats[c][a.status] = (cats[c][a.status] || 0) + 1;
  }
  const cards = Object.entries(cats).map(([cat, counts]) => {
    const badges = Object.entries(counts).filter(([, n]) => n > 0)
      .map(([s, n]) => `${pill(s)} <span class="obs-muted">${n}</span>`).join(' ');
    return `<div class="obs-cat-card">
      <strong>${esc(categoryLabels[cat] ?? cat)}</strong>
      <div class="obs-cat-counts">${badges}</div>
    </div>`;
  });
  const body = cards.length ? `<div class="obs-cat-grid">${cards.join('')}</div>` : '<p class="obs-muted">尚無資料</p>';
  return `<div class="obs-panel">
    <div class="obs-panel-head">
      <div><p class="obs-eyebrow">CATEGORY</p><h2>分類健康度</h2></div>
    </div>
    <div class="obs-panel-body">${body}</div>
  </div>`;
}

function renderFreshness(data) {
  const domains = data.freshnessDomains ?? [];
  const cards = domains.length
    ? domains.map(d => {
        const f = d.freshness ?? {};
        const hasData = [f.p50, f.p95, f.p99].some(v => Number.isFinite(Number(v)));
        const detail = hasData
          ? `p50 ${dur(f.p50)} · p95 ${dur(f.p95)} · p99 ${dur(f.p99)}`
          : '⚪ 尚無資料';
        const meta = `${freshnessPill(d.freshnessState)} <span class="obs-muted">最近觀測 ${d.lastObservedAt ? age(d.ageMs) : '尚無資料'}</span>`;
        return `<div class="obs-fresh-card">
          <strong>${esc(d.displayName ?? d.domain ?? d)}</strong>
          <span>${detail}</span>
          <span>${meta}</span>
        </div>`;
      }).join('')
    : '<p class="obs-muted">尚無狀態新鮮度資料。</p>';
  return `<div class="obs-panel">
    <div class="obs-panel-head">
      <div><p class="obs-eyebrow">KPI</p><h2>狀態新鮮度</h2></div>
      ${freshnessPill(data.overallFreshnessState ?? data.freshness?.state)}
    </div>
    <div class="obs-panel-body">
      <div class="obs-fresh-grid">${cards}</div>
    </div>
  </div>`;
}

function renderDeployment(data, actions) {
  const dep = data.deployment ?? {};
  const regressing = actions.filter(a => a.trend?.trend === 'REGRESSING').length;
  const correlated = actions.filter(a => a.status === 'RED' && a.lastDeployment).length;
  const status = data.telemetryStatus ?? {};
  const latestTelemetryAt = status.latestTelemetryAt ?? data.lastObservedAt ?? null;
  const rows = [
    ['目前版本', dep.deploymentId || '尚無資料'],
    ['最近部署', dep.deployedAt || '尚無資料'],
    ['部署來源', dep.deployedAtSource || '尚無資料'],
    ['來源類型', dep.provenanceMode || dep.provenanceType || '尚無資料'],
    ['最新遙測時間', latestTelemetryAt || '尚無資料'],
    ['遙測新鮮度', freshnessLabel(status.enabled === false ? 'NO_DATA' : (data.overallFreshnessState ?? data.freshness?.state))],
    ['回歸操作', `${regressing} 項`],
    ['部署關聯', correlated ? 'DEPLOYMENT_CORRELATED_REGRESSION' : '—'],
    ['Telemetry 狀態', status.healthy === false ? (status.state ?? 'DEGRADED') : status.healthy ? 'HEALTHY' : '尚無資料'],
    ['資料窗口', window_],
  ];
  return `<div class="obs-panel">
    <div class="obs-panel-head">
      <div><p class="obs-eyebrow">DEPLOYMENT / REGRESSION</p><h2>部署 / 回歸</h2></div>
    </div>
    <div class="obs-panel-body">
      <div class="obs-dep-grid">
        ${rows.map(([k, v]) => `<div class="obs-dep-item"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}
      </div>
    </div>
  </div>`;
}

/* ── Controls wiring & bootstrap ── */
document.getElementById('btnLive').addEventListener('click', () => setMode('live'));
document.getElementById('btnSynth').addEventListener('click', () => setMode('synthetic'));
document.getElementById('btn1h').addEventListener('click', () => setWindow('1h'));
document.getElementById('btn24h').addEventListener('click', () => setWindow('24h'));
document.getElementById('copyReport').addEventListener('click', copyReport);
document.getElementById('downloadMarkdown').addEventListener('click', downloadReportMarkdown);
document.getElementById('downloadJson').addEventListener('click', downloadReportJson);
void loadAndRender();
