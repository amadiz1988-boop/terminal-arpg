// Server Ops · Ops Console (frontend-only).
// Consumes the existing admin APIs; all sort/filter/search is local. Security is
// owned by the outer Cloudflare Access boundary.
import { characterHealthRank, compareCharacterHealth } from './server-ops-sort.mjs';
const TABS = [
  ['overview', '總覽'], ['servers', '伺服器'], ['characters', '角色'], ['connectivity', '連線'],
  ['web', 'Web 體驗'], ['resources', '系統資源'], ['events', '事件'],
];
const ORIGINS = ['PLAYER', 'ADMIN', 'SYSTEM', 'UNKNOWN'];
const ROLES = ['PRODUCTION', 'CANARY', 'TEST', 'UNKNOWN'];
const ORIGIN_LABELS = { PLAYER: '玩家建立', ADMIN: '管理建立', SYSTEM: '系統建立', UNKNOWN: '未分類' };
const ROLE_LABELS = { PRODUCTION: '正式', CANARY: 'Canary', TEST: '測試', UNKNOWN: '未分類' };
const CONTROL_MODES = ['玩家控制', '待機', '指定掛機', '移動中', '補給中', '返回掛機地', '恢復中', '任務中', '隔離'];
const HEALTH_RANK = { DOWN: 3, ERROR: 3, QUARANTINED: 3, FAILED: 3, DEGRADED: 2, STALE: 2, RECOVERING: 2, OFFLINE: 2, UNKNOWN: 1, HEALTHY: 0, LIVE: 0, ONLINE: 0, FRESH: 0, SUCCESS: 0 };
const PROCESS_ROLES = ['login', 'char', 'map', 'mysqld', 'dashboard'];

const state = {
  tab: (location.hash || '#overview').slice(1),
  status: null, health: null, characters: null, events: [],
  loading: 'loading', error: null, lastLoadedAt: null,
  search: '', busy: false, expanded: null,
  charActions: {},
  filters: { web: 'ALL', control: 'ALL', origin: 'ALL', role: 'ALL', map: 'ALL' },
  webOnlyFailures: false,
  sort: {
    servers: { key: 'health', dir: -1 }, characters: { key: 'health', dir: -1 },
    web: { key: 'health', dir: -1 }, resources: { key: 'health', dir: -1 },
  },
};
const el = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const dot = (s) => `<span class="dot ${esc(s)}" title="${esc(s)}"></span>`;
const badge = (s) => `<span class="badge ${esc(s)}">${esc(s)}</span>`;
function fmtBytes(n) {
  if (!Number.isFinite(Number(n)) || Number(n) <= 0) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB']; let v = Number(n), i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(1)} ${u[i]}`;
}
function fmtMs(ms) {
  const v = Number(ms); if (!Number.isFinite(v) || v <= 0) return '—';
  const s = Math.floor(v / 1000);
  if (s < 60) return `${s}s`; if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}
function fmtWhen(ts) { return ts ? new Date(ts).toLocaleTimeString() : '—'; }
function fmtAgo(ms) {
  const s = Math.floor(Number(ms) / 1000);
  if (!Number.isFinite(s) || s < 0) return '—';
  if (s < 60) return `${s} 秒前`;
  if (s < 3600) return `${Math.floor(s / 60)} 分鐘前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小時前`;
  return `${Math.floor(s / 86400)} 天前`;
}
function bar(percent, warn = 70, crit = 90) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  return `<span class="${p >= crit ? 'bar crit' : p >= warn ? 'bar warn' : 'bar'}"><i style="width:${p}%"></i></span> <span class="muted">${p}%</span>`;
}

// Job names come from the existing player mapping (dashboard/app.js `jobNames`) —
// single source, not duplicated here.
let jobNames = {};
async function loadJobNames() {
  try {
    const text = await (await fetch('/app.js')).text();
    const m = text.match(/const\s+jobNames\s*=\s*(\{[\s\S]*?\n\s*\})/);
    if (m) jobNames = Function(`"use strict";return (${m[1]})`)() ?? {};
  } catch { jobNames = {}; }
}
function jobName(classId) { const n = jobNames[Number(classId)]; return n || `未知職業 (#${classId})`; }

// Web presence from the low-frequency heartbeat; an unexpired session is NOT presence.
function webPresence(c) {
  const t = Number(c.lastWebActivityAt) || 0;
  if (!t) return { state: 'UNKNOWN', label: '—' };
  const idle = Date.now() - t;
  return idle <= 60_000 ? { state: 'ONLINE', label: '● Web 在線', idle } : { state: 'OFFLINE', label: `Web 離線 · ${fmtAgo(idle)}`, idle };
}
function controlMode(c) {
  const owner = String(c.controlOwner || '').toUpperCase();
  const mode = String(c.agentMode || '').toUpperCase();
  const phase = `${c.runtimePhase || ''} ${c.taskPhase || ''} ${c.runtimeState || ''}`.toUpperCase();
  const own = String(c.ownershipState || '').toUpperCase();
  if (own.includes('QUARANTIN') || phase.includes('QUARANTIN')) return { key: 'QUARANTINED', label: '隔離' };
  if (owner === 'PLAYER' || owner === 'WEB') return { key: 'PLAYER', label: '玩家控制' };
  if (phase.includes('SUPPLY') || phase.includes('SUPPLIES')) return { key: 'SUPPLY', label: '補給中' };
  if (phase.includes('RETURN')) return { key: 'RETURN', label: '返回掛機地' };
  if (phase.includes('RECOVER')) return { key: 'RECOVER', label: '恢復中' };
  if (phase.includes('QUEST')) return { key: 'QUEST', label: '任務中' };
  if (phase.includes('MOVE') || phase.includes('NAVIGAT')) return { key: 'MOVE', label: '移動中' };
  if (mode.includes('IDLE')) return { key: 'IDLE', label: '待機' };
  if (mode.includes('FARM') || phase.includes('FARM') || phase.includes('GRIND')) return { key: 'FARM', label: '指定掛機' };
  if (!c.resident && !mode) return { key: 'OFFLINE', label: '離線' };
  if (mode) return { key: 'OTHER', label: mode };
  return { key: 'UNKNOWN', label: '未知' };
}
function controlClass(key) { return key === 'QUARANTINED' ? 'DOWN' : key === 'PLAYER' ? 'RUNNING' : key === 'IDLE' ? 'UNKNOWN' : 'DEGRADED'; }

async function api(path, options) {
  const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', ...(options?.headers ?? {}) } });
  const text = await response.text();
  let body = null; try { body = JSON.parse(text); } catch { body = null; }
  return { status: response.status, ok: response.ok, body };
}

function computeHealth(status, chars) {
  const by = Object.fromEntries((status?.connectivity ?? []).map((c) => [c.component, c]));
  const web = status?.webExperience ?? { checks: [], readModel: {} };
  const webWorst = (web.checks ?? []).map((c) => (c.consecutiveFailures > 0 ? (c.status === 'DOWN' ? 'DOWN' : 'DEGRADED') : 'HEALTHY')).reduce((a, v) => (HEALTH_RANK[v] > HEALTH_RANK[a] ? v : a), 'HEALTHY');
  const lights = [
    ['Database', by.DATABASE?.applicationHealth ?? 'UNKNOWN'], ['Login', by.LOGIN?.applicationHealth ?? 'UNKNOWN'],
    ['Char', by.CHAR?.applicationHealth ?? 'UNKNOWN'], ['Map', by.MAP?.applicationHealth ?? 'UNKNOWN'],
    ['Persistent Agent', by.PERSISTENT_AGENT?.applicationHealth ?? 'UNKNOWN'], ['Dashboard', by.DASHBOARD?.applicationHealth ?? 'UNKNOWN'],
    ['Web Experience', webWorst],
  ];
  const overall = lights.some(([, v]) => v === 'DOWN') ? 'DOWN' : lights.some(([, v]) => v === 'DEGRADED') ? 'DEGRADED' : status?.overallHealth === 'HEALTHY' ? 'HEALTHY' : 'UNKNOWN';
  return { lights, overall, by, web, procs: status?.processes ?? {}, readModel: web.readModel ?? {}, chars: chars ?? [], status };
}
function computeAlerts(h) {
  const out = [];
  const rm = h.readModel ?? {};
  if (rm.liveState && rm.liveState !== 'LIVE') out.push({ sev: rm.liveState === 'OFFLINE' ? 'ERROR' : 'WARN', text: `Read model ${rm.liveState}${Number.isFinite(rm.readModelAgeMs) ? ` (${fmtAgo(rm.readModelAgeMs)})` : ''}` });
  for (const c of h.web.checks ?? []) if (c.consecutiveFailures > 0) out.push({ sev: c.status === 'DOWN' ? 'ERROR' : 'WARN', text: `Web experience: ${c.name} ×${c.consecutiveFailures}${c.lastError ? ` (${c.lastError})` : ''}` });
  for (const [n, v] of h.lights) if (v === 'DOWN') out.push({ sev: 'ERROR', text: `${n} DOWN` });
  for (const [n, v] of h.lights) if (v === 'DEGRADED') out.push({ sev: 'WARN', text: `${n} DEGRADED` });
  if (h.status?.snapshotStatus && h.status.snapshotStatus !== 'FRESH') out.push({ sev: 'WARN', text: `Metrics sampler ${h.status.snapshotStatus}` });
  const stalled = (h.chars ?? []).filter((c) => Number.isFinite(c.liveAgeMs) && c.liveAgeMs > 60_000).length;
  if (stalled > 0) out.push({ sev: 'WARN', text: `${stalled} character(s) with stale live data (>60s)` });
  const quarantined = (h.chars ?? []).filter((c) => controlMode(c).key === 'QUARANTINED').length;
  if (quarantined > 0) out.push({ sev: 'ERROR', text: `${quarantined} quarantined character(s)` });
  const mp = h.procs?.map;
  if (mp && Number(mp.privateBytes) > 900 * 1024 * 1024) out.push({ sev: 'WARN', text: `map-server private bytes high (${fmtBytes(mp.privateBytes)})` });
  return out;
}

/* ---------- top ---------- */
function renderTop() {
  const h = state.health;
  el('overall').innerHTML = `${dot(h ? h.overall : 'UNKNOWN')}<span class="lbl">Overall</span><span class="val">${esc(h ? h.overall : 'UNKNOWN')}</span>`;
  if (!h) { el('lights').innerHTML = ''; el('alerts').className = 'alerts'; return; }
  const p = h.procs ?? {};
  const fmt = (name, status, extra = '', tip = '') => `<div class="light"${tip ? ` title="${esc(tip)}"` : ''}>${dot(status)}<span class="lbl">${esc(name)}</span><span class="val">${esc(status)}</span>${extra ? ` <span class="muted">${extra}</span>` : ''}</div>`;
  const rows = [];
  rows.push(fmt('Database', h.by.DATABASE?.applicationHealth ?? 'UNKNOWN'));
  for (const [label, role] of [['Login', 'login'], ['Char', 'char'], ['Map', 'map']]) {
    const proc = p[role];
    rows.push(fmt(label, h.by[label.toUpperCase()]?.applicationHealth ?? 'UNKNOWN', proc ? `PID ${proc.pid} · ${fmtBytes(proc.workingSetBytes)} WS` : ''));
  }
  rows.push(fmt('Persistent Agent', h.by.PERSISTENT_AGENT?.applicationHealth ?? 'UNKNOWN', `資料更新：${Number.isFinite(h.readModel?.readModelAgeMs) ? fmtAgo(h.readModel.readModelAgeMs) : '—'}`, 'Process: map-server in-process\nApplication: Persistent Agent read-model\n資料新鮮度：距離 persistent_agent_live_status 最後更新時間（非網路延遲）'));
  rows.push(fmt('Dashboard', h.by.DASHBOARD?.applicationHealth ?? 'UNKNOWN', p.dashboard ? `PID ${p.dashboard.pid}` : ''));
  const wf = (h.web.checks ?? []).reduce((a, c) => a + (c.consecutiveFailures || 0), 0);
  rows.push(fmt('Web Experience', wf > 0 ? 'DEGRADED' : 'HEALTHY', `${(h.web.checks ?? []).length} checks`));
  el('lights').innerHTML = rows.join('');
  const alerts = computeAlerts(h);
  const strip = el('alerts');
  strip.className = alerts.length ? 'alerts on' : 'alerts';
  strip.innerHTML = alerts.map((a) => `<span class="alert ${a.sev}">${a.sev === 'ERROR' ? '⛔' : '⚠'} ${esc(a.text)}</span>`).join('');
  el('sampled').textContent = state.status?.sampledAt ? `sampled ${fmtWhen(state.status.sampledAt)} (+${fmtMs(state.status.ageMs)})` : '';
  el('search').style.display = ['characters', 'servers', 'resources'].includes(state.tab) ? '' : 'none';
}
function renderTabs() {
  el('tabs').innerHTML = TABS.map(([k, label]) => `<button role="tab" data-tab="${k}" aria-selected="${state.tab === k}">${label}</button>`).join('');
  el('tabs').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { state.tab = b.dataset.tab; location.hash = `#${state.tab}`; renderTabs(); renderTop(); render(); }));
}

/* ---------- tables ---------- */
function th(tableKey, key, label, extra = '') {
  const s = state.sort[tableKey];
  const arrow = s?.key === key ? `<span class="arrow">${s.dir < 0 ? '▼' : '▲'}</span>` : '';
  return `<th data-table="${tableKey}" data-key="${key}" class="${extra}">${esc(label)}${arrow}</th>`;
}
function wireSortHandlers() {
  document.querySelectorAll('th[data-table]').forEach((n) => n.addEventListener('click', () => {
    const t = n.dataset.table, k = n.dataset.key, s = state.sort[t];
    if (s.key === k) s.dir = -s.dir; else state.sort[t] = { key: k, dir: 1 };
    render();
  }));
}
function sortRows(tableKey, rows, valueOf, secondaryOf) {
  const s = state.sort[tableKey] ?? { key: null, dir: 1 };
  if (!s.key) return [...rows];
  return [...rows].sort((a, b) => {
    const va = valueOf(a, s.key), vb = valueOf(b, s.key);
    const cmp = typeof va === 'number' && typeof vb === 'number'
      ? va - vb
      : String(va ?? '').localeCompare(String(vb ?? ''), 'zh-Hant');
    if (cmp !== 0) return cmp * s.dir;
    // Stable secondary sort for equal primary keys (e.g. same health rank).
    return secondaryOf ? secondaryOf(a, b) : 0;
  });
}

/* ---------- views ---------- */
function renderOverview() {
  const h = state.health; if (!h) return '';
  const host = h.status?.hostMetrics, procs = h.procs;
  const wf = (h.web.checks ?? []).reduce((a, c) => a + (c.consecutiveFailures || 0), 0);
  const failed = (h.web.checks ?? []).filter((c) => c.consecutiveFailures > 0);
  const core = ['LOGIN', 'CHAR', 'MAP'].map((c) => h.by[c]?.applicationHealth ?? 'UNKNOWN');
  const residents = (h.chars ?? []).filter((c) => c.resident).length;
  const quarantined = (h.chars ?? []).filter((c) => controlMode(c).key === 'QUARANTINED').length;
  return `
    <h3>A · Health Summary</h3><div class="panel"><div class="kv">${h.lights.map(([n, v]) => `<div class="row"><span>${esc(n)}</span><span>${dot(v)} ${esc(v)}</span></div>`).join('')}</div></div>
    <h3>B · Active Alerts</h3>${computeAlerts(h).length ? `<div class="panel">${computeAlerts(h).map((a) => `<div class="row"><span class="badge ${a.sev === 'ERROR' ? 'DOWN' : 'DEGRADED'}">${esc(a.sev)}</span> <span>${esc(a.text)}</span></div>`).join('')}</div>` : '<div class="panel muted">No active alerts.</div>'}
    <h3>C · Server Resource Summary</h3><div class="panel"><div class="kv">
      <div class="row"><span>Host CPU</span><span>${bar(host?.cpuPercent ?? 0)}</span></div>
      <div class="row"><span>Host RAM</span><span>${host ? `${fmtBytes(host.memory.usedBytes)} / ${fmtBytes(host.memory.totalBytes)}` : '—'} ${bar(host?.memory?.usedPercent ?? 0)}</span></div>
      <div class="row"><span>map-server WS</span><span>${fmtBytes(procs.map?.workingSetBytes)}</span></div>
      <div class="row"><span>map-server Private</span><span>${fmtBytes(procs.map?.privateBytes)}</span></div>
      <div class="row"><span>Sampler</span><span>${badge(h.status?.snapshotStatus ?? 'UNKNOWN')} +${fmtMs(h.status?.ageMs)}</span></div>
    </div></div>
    <h3>D · Player / Agent counts</h3><div class="panel"><div class="kv">
      <div class="row"><span>Players Online</span><span>${Number.isFinite(h.onlinePlayers) ? h.onlinePlayers : '—'}</span></div>
      <div class="row"><span>Characters (roster)</span><span>${state.characters ? state.characters.length : '—'}</span></div>
      <div class="row"><span>Residents</span><span>${h.chars?.length ? residents : '—'}</span></div>
      <div class="row"><span>Quarantined</span><span>${h.chars?.length ? quarantined : '—'}</span></div>
    </div></div>
    <h3>E · Web Experience summary</h3><div class="panel"><div class="kv">
      <div class="row"><span>Checks</span><span>${(h.web.checks ?? []).length}</span></div>
      <div class="row"><span>Total failure streak</span><span>${wf}</span></div>
      <div class="row"><span>Read model</span><span>${badge(h.readModel?.liveState ?? 'UNKNOWN')} ${Number.isFinite(h.readModel?.readModelAgeMs) ? fmtAgo(h.readModel.readModelAgeMs) : ''}</span></div>
      <div class="row"><span>Core RO</span><span>${dot(core.includes('DOWN') ? 'DOWN' : core.includes('DEGRADED') ? 'DEGRADED' : 'HEALTHY')} ${core.join(' / ')}</span></div>
    </div></div>
    <h3>F · Recent errors</h3>${failed.length ? `<div class="panel">${failed.map((c) => `<div class="row"><span>${esc(c.name)}</span><span class="muted">${esc(c.lastError ?? '')}</span></div>`).join('')}</div>` : '<div class="panel muted">None.</div>'}`;
}

function renderServers() {
  const procs = state.health?.procs ?? {};
  const ports = { login: 6901, char: 6122, map: 5122, mysqld: 3307, dashboard: 8788 };
  const connByRole = { login: 'LOGIN', char: 'CHAR', map: 'MAP', mysqld: 'DATABASE', dashboard: 'DASHBOARD' };
  let rows = PROCESS_ROLES.map((role) => ({ role, p: procs[role], health: state.health?.by?.[connByRole[role]]?.applicationHealth ?? (procs[role] ? 'HEALTHY' : 'DOWN') }));
  const q = state.search.trim().toLowerCase();
  if (q) rows = rows.filter((r) => r.role.includes(q) || String(r.p?.pid ?? '').includes(q));
  rows = sortRows('servers', rows, (r, k) => (k === 'health' ? HEALTH_RANK[r.health] ?? 0 : k === 'name' ? r.role : Number(r.p?.[k] ?? 0)));
  const lifecycle = state.status?.lifecycleState ?? 'UNKNOWN';
  const body = rows.map((r) => r.p
    ? `<tr><td>${dot(r.health)}</td><td>${esc(r.p.name)}</td><td class="num">${r.p.pid}</td><td class="num">${ports[r.role] ?? ''}</td><td class="num">${r.p.cpuPercent}%</td><td class="num">${fmtBytes(r.p.workingSetBytes)}</td><td class="num">${fmtBytes(r.p.privateBytes)}</td><td class="num">${r.p.threadCount}</td><td class="num">${r.p.handleCount}</td><td class="num">${fmtMs(r.p.uptimeMs)}</td></tr>`
    : `<tr class="abnormal"><td>${dot('DOWN')}</td><td>${esc(r.role)}</td><td colspan="8" class="muted">DOWN</td></tr>`).join('');
  return `<h3>Server Controls</h3><div class="panel">
      <div class="row"><span class="muted">Current state</span> <span>${badge(lifecycle)}</span></div>
      <div class="toolbar" style="margin-top:8px">
        ${lifecycle !== 'RUNNING' ? `<button class="action" data-lifecycle="start"${state.busy ? ' disabled' : ''}>Start</button>` : ''}
        <button class="action danger" data-lifecycle="restart"${state.busy ? ' disabled' : ''}>Restart</button>
        <button class="action danger" data-lifecycle="stop"${state.busy ? ' disabled' : ''}>Stop</button>
        ${state.busy ? `<span class="muted">${esc(state.busyLabel ?? 'WORKING…')}</span>` : ''}
      </div>
      <div class="muted">Stop/Restart control login/char/map only — MariaDB and the Dashboard control plane stay up.</div>
    </div>
    <h3>Processes</h3><div class="table-wrap"><table class="grid"><thead><tr>
      ${th('servers', 'health', 'Health')}${th('servers', 'name', 'Process')}${th('servers', 'pid', 'PID', 'num')}${th('servers', 'port', 'Port', 'num')}${th('servers', 'cpuPercent', 'CPU', 'num')}${th('servers', 'workingSetBytes', 'Working Set', 'num')}${th('servers', 'privateBytes', 'Private Bytes', 'num')}${th('servers', 'threadCount', 'Threads', 'num')}${th('servers', 'handleCount', 'Handles', 'num')}${th('servers', 'uptimeMs', 'Uptime', 'num')}
    </tr></thead><tbody>${body || '<tr><td colspan="10" class="empty">No processes</td></tr>'}</tbody></table></div>`;
}

function webState(c) { return webPresence(c).state; }
// Single source of truth for the rendered Health dot. The sort ranks THIS key
// (see server-ops-sort.mjs) so the visible colour group and the sort group can
// never disagree.
function charHealthKey(c) {
  if (controlMode(c).key === 'QUARANTINED') return 'DOWN';
  if (Number.isFinite(c.liveAgeMs) && c.liveAgeMs > 60_000) return 'DEGRADED';
  return c.resident ? 'HEALTHY' : 'OFFLINE';
}
function characterHealthRow(c) {
  return { health: charHealthKey(c), charId: c.charId, name: c.name };
}
function agentStatusBadge(ca) {
  if (!ca || !ca.status || ca.status === 'idle') return '<span class="muted">待機</span>';
  const cls = ca.status === 'confirmed' ? 'HEALTHY' : ca.status === 'failed' ? 'DOWN' : 'DEGRADED';
  return `<span class="badge ${cls}">${esc(ca.message || ca.status)}</span>`;
}
function filteredCharacters() {
  const q = state.search.trim().toLowerCase();
  return (state.characters ?? []).filter((c) => {
    if (q) {
      const hay = [c.name, c.accountName, c.accountId, c.charId, c.map, c.characterOrigin, c.characterRole, webState(c), controlMode(c).label, jobName(c.classId), c.classId].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    const f = state.filters;
    if (f.web !== 'ALL' && webState(c) !== f.web) return false;
    if (f.control !== 'ALL' && controlMode(c).label !== f.control) return false;
    if (f.origin !== 'ALL' && c.characterOrigin !== f.origin) return false;
    if (f.role !== 'ALL' && c.characterRole !== f.role) return false;
    if (f.map !== 'ALL' && c.map !== f.map) return false;
    return true;
  });
}
function renderCharacters() {
  const maps = [...new Set((state.characters ?? []).map((c) => c.map).filter(Boolean))].sort();
  const opts = (list, cur) => list.map((v) => `<option${v === cur ? ' selected' : ''}>${esc(v)}</option>`).join('');
  const filterBar = `<div class="toolbar">
    <label>Web</label><select data-filter="web">${opts(['ALL', 'ONLINE', 'OFFLINE'], state.filters.web)}</select>
    <label>控制模式</label><select data-filter="control">${opts(['ALL', ...CONTROL_MODES], state.filters.control)}</select>
    <label>Origin</label><select data-filter="origin">${opts(['ALL', ...ORIGINS], state.filters.origin)}</select>
    <label>Role</label><select data-filter="role">${opts(['ALL', ...ROLES], state.filters.role)}</select>
    <label>Map</label><select data-filter="map">${opts(['ALL', ...maps], state.filters.map)}</select>
    <span class="count">${filteredCharacters().length} / ${(state.characters ?? []).length}</span>
  </div>`;
  const rows = sortRows('characters', filteredCharacters(), (c, k) => {
    if (k === 'health') return characterHealthRank(charHealthKey(c));
    if (k === 'account') return c.accountName || '';
    if (k === 'name') return c.name ?? '';
    if (k === 'job') return jobName(c.classId);
    if (k === 'level') return c.baseLevel;
    if (k === 'map') return c.map ?? '';
    if (k === 'web') return Number(c.lastWebActivityAt ?? 0);
    if (k === 'control') return controlMode(c).label;
    if (k === 'origin') return ORIGIN_LABELS[c.characterOrigin] ?? '未分類';
    if (k === 'role') return ROLE_LABELS[c.characterRole] ?? '未分類';
    return '';
  }, (a, b) => compareCharacterHealth(characterHealthRow(a), characterHealthRow(b), 1));
  const body = rows.map((c) => {
    const expanded = state.expanded === c.charId;
    const wp = webPresence(c), cm = controlMode(c);
    const ca = state.charActions[c.charId] ?? { status: 'idle' };
    const agentBusy = ca.status === 'activating' || ca.status === 'starting';
    const main = `<tr class="clickable" data-char-row="${c.charId}">
      <td>${dot(charHealthKey(c))}</td>
      <td>${esc(c.accountName || '—')}</td><td>${esc(c.name)}</td><td>${esc(jobName(c.classId))}</td><td class="num">${c.baseLevel} / ${c.jobLevel}</td><td>${esc(c.map)}</td>
      <td title="${esc(wp.idle ? fmtAgo(wp.idle) : '')}">${esc(wp.label)}</td>
      <td><span class="badge ${controlClass(cm.key)}">${esc(cm.label)}</span></td>
      <td class="muted">—</td><td class="muted">—</td>
      <td>${esc(ORIGIN_LABELS[c.characterOrigin] ?? '未分類')}</td><td>${esc(ROLE_LABELS[c.characterRole] ?? '未分類')}</td>
      <td>${expanded ? '<button class="link" data-toggle>收起</button>' : '<button class="link" data-toggle>展開</button>'}</td>
    </tr>`;
    if (!expanded) return main;
    const detail = `<tr class="drawer"><td colspan="13"><div class="kv">
      <div class="row"><span>AID</span><span>${c.accountId}</span></div>
      <div class="row"><span>CID</span><span>${c.charId}</span></div>
      <div class="row"><span>Job ID</span><span>${c.classId}</span></div>
      <div class="row"><span>HP / SP</span><span>${c.maxHp ? `${c.hp} / ${c.maxHp}` : '—'} · ${c.maxSp ? `${c.sp} / ${c.maxSp}` : '—'}</span></div>
      <div class="row"><span>Map / X / Y</span><span>${esc(c.map)} ${c.x || c.y ? `/ ${c.x} / ${c.y}` : ''}</span></div>
      <div class="row"><span>control_owner</span><span>${esc(c.controlOwner || '—')}</span></div>
      <div class="row"><span>agent_mode</span><span>${esc(c.agentMode || '—')}</span></div>
      <div class="row"><span>phase (runtime / task)</span><span>${esc(c.runtimePhase || '—')} / ${esc(c.taskPhase || '—')}</span></div>
      <div class="row"><span>ownership_state</span><span>${esc(c.ownershipState || '—')}</span></div>
      <div class="row"><span>角色在線狀態</span><span>${c.online ? '線上（遊戲中）' : '離線'}</span></div>
      <div class="row"><span>SERVER_AGENT resident</span><span>${c.resident ? 'YES' : 'NO'}</span></div>
      <div class="row"><span>read-model age</span><span>${Number.isFinite(c.liveAgeMs) ? fmtAgo(c.liveAgeMs) : '—'}</span></div>
      <div class="row"><span>Admin 角色自主 / 掛機</span>
        <span><button class="action" data-agent-autonomy="${c.charId}"${agentBusy ? ' disabled' : ''}>啟動角色自主</button>
        <button class="action" data-agent-farm="${c.charId}"${agentBusy ? ' disabled' : ''}>啟動掛機</button>
        ${agentBusy ? `<span class="muted">${esc(ca.status === 'activating' ? '啟用中…' : '啟動掛機中…')}</span>` : ''}</span></div>
      <div class="row"><span>Admin 執行狀態</span><span>${agentStatusBadge(ca)}</span></div>
      <div class="row"><span>目前 automation mode</span><span>${esc(cm.label)}${c.agentMode ? ` · ${esc(c.agentMode)}` : ''}</span></div>
      <div class="row"><span>最後 command 結果</span><span>${ca.command ? `<span class="mono">${esc(ca.command)}</span>` : '<span class="muted">—</span>'}</span></div>
      <div class="row"><span>last move</span><span class="muted">— (LAST_MOVE_NATIVE_FIELD_REQUIRED)</span></div>
      <div class="row"><span>last combat</span><span class="muted">— (LAST_COMBAT_NATIVE_FIELD_REQUIRED)</span></div>
      <div class="row"><span>last transition</span><span class="muted">— (no API field)</span></div>
      <div class="row"><span>last error</span><span>${esc(c.lastErrorCode || '—')}</span></div>
      <div class="row"><span>Web 活動</span><span>${esc(wp.label)}${c.lastWebLoginAt ? ` · 登入 ${fmtAgo(Date.now() - c.lastWebLoginAt)}` : ''}</span></div>
      <div class="row"><span>Origin / Role 修改</span>
        <span><select data-origin-edit>${ORIGINS.map((o) => `<option value="${o}"${o === c.characterOrigin ? ' selected' : ''}>${ORIGIN_LABELS[o]}</option>`).join('')}</select>
        <select data-role-edit>${ROLES.map((o) => `<option value="${o}"${o === c.characterRole ? ' selected' : ''}>${ROLE_LABELS[o]}</option>`).join('')}</select>
        <button class="action" data-save-meta="${c.charId}">儲存</button></span></div>
    </div></td></tr>`;
    return main + detail;
  }).join('');
  return `${filterBar}<div class="table-wrap"><table class="grid"><thead><tr>
    ${th('characters', 'health', 'Health')}${th('characters', 'account', '帳號')}${th('characters', 'name', '角色名稱')}${th('characters', 'job', '職業')}${th('characters', 'level', 'Base / Job', 'num')}${th('characters', 'map', '地圖')}${th('characters', 'web', 'Web')}${th('characters', 'control', '控制模式')}<th class="no-sort muted">最後移動</th><th class="no-sort muted">最後戰鬥</th>${th('characters', 'origin', 'Origin')}${th('characters', 'role', 'Role')}<th class="no-sort">Actions</th>
  </tr></thead><tbody>${body || '<tr><td colspan="13" class="empty">No characters match filters</td></tr>'}</tbody></table></div>`;
}

function renderConnectivity() {
  const rows = state.health?.by ?? {};
  const cell = (v) => (v === undefined ? '<span class="muted">—</span>' : dot(v));
  const body = ['DATABASE', 'LOGIN', 'CHAR', 'MAP', 'PERSISTENT_AGENT', 'DASHBOARD'].map((c) => {
    const e = rows[c];
    if (!e) return `<tr><td>${esc(c)}</td><td class="muted">—</td><td class="muted">—</td><td class="muted">—</td></tr>`;
    const network = c === 'PERSISTENT_AGENT' ? '<span class="muted">—</span>' : cell(e.networkHealth);
    return `<tr title="last check: ${esc(fmtWhen(state.status?.sampledAt))}"><td>${esc(c)}</td><td>${cell(e.processHealth)}</td><td>${network}</td><td>${cell(e.applicationHealth)}</td></tr>`;
  }).join('');
  return `<h3>Connectivity Matrix</h3><div class="table-wrap"><table class="grid matrix"><thead><tr><th>Component</th><th>Process</th><th>Network</th><th>Application</th></tr></thead><tbody>${body}</tbody></table></div>`;
}
function renderWeb() {
  let checks = [...(state.health?.web.checks ?? [])];
  if (state.webOnlyFailures) checks = checks.filter((c) => c.consecutiveFailures > 0);
  checks = sortRows('web', checks, (c, k) => (k === 'health' ? (c.consecutiveFailures > 0 ? (c.status === 'DOWN' ? 3 : 2) : 0) : k === 'name' ? c.name : k === 'latencyMs' ? Number(c.latencyMs ?? 0) : k === 'consecutiveFailures' ? c.consecutiveFailures ?? 0 : Number(c.lastSuccessAt ?? 0)));
  const body = checks.map((c) => `<tr class="${c.consecutiveFailures > 0 ? 'abnormal' : ''}"><td>${esc(c.name)}</td><td>${dot(c.status)} ${esc(c.status)}</td><td class="num">${c.httpStatus ?? '—'}</td><td class="num">${c.latencyMs ?? '—'} ms</td><td>${fmtWhen(c.lastSuccessAt)}</td><td>${fmtWhen(c.lastFailureAt)}</td><td class="num">${c.consecutiveFailures ?? 0}</td><td class="muted">${esc(c.lastError ?? '')}</td></tr>`).join('');
  const rm = state.health?.readModel ?? {};
  return `<h3>Web Experience</h3>
    <div class="toolbar"><label><input type="checkbox" id="webfail" ${state.webOnlyFailures ? 'checked' : ''}/> 只看異常</label><span class="count">read model: ${badge(rm.liveState ?? 'UNKNOWN')} ${Number.isFinite(rm.readModelAgeMs) ? fmtAgo(rm.readModelAgeMs) : ''}</span></div>
    <div class="table-wrap"><table class="grid"><thead><tr>
      ${th('web', 'name', 'Check')}${th('web', 'health', 'Health')}${th('web', 'httpStatus', 'HTTP', 'num')}${th('web', 'latencyMs', 'Latency', 'num')}${th('web', 'lastSuccessAt', 'Last success')}${th('web', 'lastFailureAt', 'Last failure')}${th('web', 'consecutiveFailures', 'Failures', 'num')}<th class="no-sort">Last error</th>
    </tr></thead><tbody>${body || '<tr><td colspan="8" class="empty">No checks</td></tr>'}</tbody></table></div>`;
}
function renderResources() {
  const host = state.status?.hostMetrics, procs = state.health?.procs ?? {};
  let rows = PROCESS_ROLES.map((role) => ({ role, p: procs[role] }));
  const q = state.search.trim().toLowerCase();
  if (q) rows = rows.filter((r) => r.role.includes(q) || String(r.p?.pid ?? '').includes(q));
  rows = sortRows('resources', rows, (r, k) => (k === 'health' ? (r.p ? 0 : 3) : k === 'name' ? r.role : Number(r.p?.[k] ?? 0)));
  const body = rows.map((r) => r.p
    ? `<tr><td>${dot('HEALTHY')}</td><td>${esc(r.role)}</td><td class="num">${r.p.pid}</td><td class="num">${r.p.cpuPercent}%</td><td class="num">${fmtBytes(r.p.workingSetBytes)}</td><td class="num">${fmtBytes(r.p.privateBytes)}</td><td class="num">${fmtBytes(r.p.workingSetPrivateBytes)}</td><td class="num">${fmtBytes(r.p.virtualBytes)}</td><td class="num">${r.p.threadCount}</td><td class="num">${r.p.handleCount}</td><td class="num">${fmtMs(r.p.uptimeMs)}</td></tr>`
    : `<tr class="abnormal"><td>${dot('DOWN')}</td><td>${esc(r.role)}</td><td colspan="9" class="muted">DOWN</td></tr>`).join('');
  return `<h3>Host</h3><div class="panel"><div class="kv">
      <div class="row"><span>CPU</span><span>${bar(host?.cpuPercent ?? 0)}</span></div>
      <div class="row"><span>RAM used</span><span>${host ? fmtBytes(host.memory.usedBytes) : '—'} ${bar(host?.memory?.usedPercent ?? 0)}</span></div>
      <div class="row"><span>RAM available</span><span>${host ? fmtBytes(host.memory.availableBytes) : '—'}</span></div>
      <div class="row"><span>RAM total</span><span>${host ? fmtBytes(host.memory.totalBytes) : '—'}</span></div>
    </div></div>
    <h3>Process metrics <span class="muted">(Working Set = 實體常駐；Private Bytes = 私人 commit)</span></h3>
    <div class="table-wrap"><table class="grid"><thead><tr>
      ${th('resources', 'health', 'Health')}${th('resources', 'name', 'Process')}${th('resources', 'pid', 'PID', 'num')}${th('resources', 'cpuPercent', 'CPU', 'num')}${th('resources', 'workingSetBytes', 'Working Set', 'num')}${th('resources', 'privateBytes', 'Private Bytes', 'num')}${th('resources', 'workingSetPrivateBytes', 'WS Private', 'num')}${th('resources', 'virtualBytes', 'Virtual', 'num')}${th('resources', 'threadCount', 'Threads', 'num')}${th('resources', 'handleCount', 'Handles', 'num')}${th('resources', 'uptimeMs', 'Uptime', 'num')}
    </tr></thead><tbody>${body}</tbody></table></div>`;
}
function renderEvents() {
  const events = [...state.events].sort((a, b) => b.at - a.at);
  const sev = state.eventsFilter?.sev ?? 'ALL', comp = state.eventsFilter?.comp ?? 'ALL', range = state.eventsFilter?.range ?? 'ALL';
  const span = range === '1h' ? 3600e3 : range === '24h' ? 86400e3 : null;
  const comps = ['ALL', ...new Set(events.map((e) => e.component))];
  const rows = events.filter((e) => (sev === 'ALL' || e.severity === sev) && (comp === 'ALL' || e.component === comp) && (!span || Date.now() - e.at <= span));
  const body = rows.map((e) => `<tr><td>${fmtWhen(e.at)}</td><td>${badge(e.severity)}</td><td>${esc(e.component)}</td><td>${esc(e.message)}</td></tr>`).join('');
  return `<h3>Events <span class="muted">(session-local; no server event store)</span></h3>
    <div class="toolbar">
      <label>Severity</label><select id="evsev">${['ALL', 'INFO', 'WARN', 'ERROR'].map((v) => `<option${v === sev ? ' selected' : ''}>${v}</option>`).join('')}</select>
      <label>Component</label><select id="evcomp">${comps.map((v) => `<option${v === comp ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>
      <label>Range</label><select id="evrange">${['ALL', '24h', '1h'].map((v) => `<option${v === range ? ' selected' : ''}>${v}</option>`).join('')}</select>
      <span class="count">${rows.length} events</span>
    </div>
    ${rows.length ? `<div class="table-wrap"><table class="grid"><thead><tr><th>Time</th><th>Severity</th><th>Component</th><th>Message</th></tr></thead><tbody>${body}</tbody></table></div>` : '<div class="panel empty">目前沒有可靠事件（EMPTY STATE）。</div>'}`;
}

/* ---------- render ---------- */
function renderLoading() { el('view').innerHTML = `<div class="panel"><div class="skeleton" style="width:40%"></div><div class="skeleton" style="width:75%"></div><div class="skeleton" style="width:60%"></div><div class="skeleton" style="width:85%"></div></div>`; }
function renderError() {
  const e = state.error ?? {};
  el('view').innerHTML = `<div class="errorbox"><div>載入失敗 <span class="muted">HTTP ${esc(e.status ?? '—')}</span></div><div class="muted">${esc(e.message ?? '')}</div><button class="action" id="retry">Retry</button></div>`;
  el('retry')?.addEventListener('click', () => refresh(true));
}
function render() {
  if (state.loading === 'loading' && !state.status) return renderLoading();
  if (state.loading === 'error' && !state.status) return renderError();
  const views = { overview: renderOverview, servers: renderServers, characters: renderCharacters, connectivity: renderConnectivity, web: renderWeb, resources: renderResources, events: renderEvents };
  el('view').innerHTML = (views[state.tab] ?? renderOverview)();
  wireSortHandlers(); wireViewHandlers();
}
function wireViewHandlers() {
  document.querySelectorAll('[data-lifecycle]').forEach((b) => b.addEventListener('click', () => confirmLifecycle(b.dataset.lifecycle)));
  document.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const id = Number(ev.target.closest('tr')?.dataset.charRow);
    state.expanded = state.expanded === id ? null : id; render();
  }));
  document.querySelectorAll('[data-char-row]').forEach((row) => row.addEventListener('click', (ev) => {
    if (ev.target.closest('button,select,option,input')) return;
    const id = Number(row.dataset.charRow);
    state.expanded = state.expanded === id ? null : id; render();
  }));
  document.querySelectorAll('[data-save-meta]').forEach((b) => b.addEventListener('click', async (ev) => {
    const row = ev.target.closest('tr'); const charId = Number(b.dataset.saveMeta);
    const characterOrigin = row.querySelector('[data-origin-edit]').value;
    const characterRole = row.querySelector('[data-role-edit]').value;
    const r = await api(`/api/admin/characters/${charId}/meta`, { method: 'POST', body: JSON.stringify({ characterOrigin, characterRole }) });
    pushEvent(r.ok ? 'INFO' : 'ERROR', 'character-meta', r.ok ? `#${charId} → ${r.body.characterOrigin}/${r.body.characterRole}` : `#${charId} failed ${r.body?.error ?? r.status}`);
    await loadCharacters(); render();
  }));
  document.querySelectorAll('[data-agent-autonomy]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    runAdminAutonomy(Number(b.dataset.agentAutonomy));
  }));
  document.querySelectorAll('[data-agent-farm]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    runAdminFarm(Number(b.dataset.agentFarm));
  }));
  document.querySelectorAll('[data-filter]').forEach((s) => s.addEventListener('change', () => { state.filters[s.dataset.filter] = s.value; render(); }));
  const wf = el('webfail'); if (wf) wf.addEventListener('change', () => { state.webOnlyFailures = wf.checked; render(); });
  const evs = el('evsev'), evc = el('evcomp'), evr = el('evrange');
  if (evs) evs.addEventListener('change', () => { state.eventsFilter = { ...(state.eventsFilter ?? {}), sev: evs.value }; render(); });
  if (evc) evc.addEventListener('change', () => { state.eventsFilter = { ...(state.eventsFilter ?? {}), comp: evc.value }; render(); });
  if (evr) evr.addEventListener('change', () => { state.eventsFilter = { ...(state.eventsFilter ?? {}), range: evr.value }; render(); });
}
function pushEvent(severity, component, message) { state.events.push({ at: Date.now(), severity, component, message }); if (state.events.length > 500) state.events.shift(); }

/* ---------- admin character agent controls ---------- */
// idle → activating → starting → confirmed / failed. While a character is
// activating/starting its buttons render disabled, so a double click cannot
// dispatch a second command; the server also holds a per-character lock.
function setCharAction(charId, patch) {
  const prev = state.charActions[charId] ?? {};
  state.charActions[charId] = {
    ...prev,
    ...patch,
    command: patch.command !== undefined ? patch.command : (prev.command ?? null),
    at: Date.now(),
  };
}
async function refreshCharacters() {
  await loadCharacters();
  if (state.status) state.health = computeHealth(state.status, state.characters);
  renderTop();
  render();
}
async function runAdminAutonomy(charId) {
  setCharAction(charId, { status: 'activating', message: '啟用 SERVER_AGENT…' });
  render();
  const r = await api(`/api/admin/characters/${charId}/agent/autonomy`, { method: 'POST' });
  const body = r.body ?? {};
  if (r.ok && body.ok) setCharAction(charId, { status: 'confirmed', message: '角色自主已啟動', command: body.command?.commandId ?? null });
  else setCharAction(charId, { status: 'failed', message: body.blocker ?? body.error ?? `HTTP ${r.status}` });
  pushEvent(r.ok ? 'INFO' : 'ERROR', 'admin-autonomy', `#${charId} ${body.blocker ?? body.phase ?? body.error ?? r.status}`);
  await refreshCharacters();
}
async function runAdminFarm(charId) {
  setCharAction(charId, { status: 'activating', message: '啟用 SERVER_AGENT…' });
  render();
  const activation = await api(`/api/admin/characters/${charId}/agent/autonomy`, { method: 'POST' });
  if (!activation.ok || !activation.body?.ok) {
    const blocker = activation.body?.blocker ?? activation.body?.error ?? `HTTP ${activation.status}`;
    setCharAction(charId, { status: 'failed', message: blocker });
    pushEvent('ERROR', 'admin-farm', `#${charId} activation failed: ${blocker}`);
    await refreshCharacters();
    return;
  }
  setCharAction(charId, { status: 'starting', message: '派送 start_farm…' });
  render();
  const r = await api(`/api/admin/characters/${charId}/agent/farm`, { method: 'POST' });
  const body = r.body ?? {};
  if (r.ok && body.ok) setCharAction(charId, { status: 'confirmed', message: body.alreadyFarming ? '已在掛機' : '掛機已啟動', command: body.command?.commandId ?? null });
  else setCharAction(charId, { status: 'failed', message: body.blocker ?? body.error ?? `HTTP ${r.status}` });
  pushEvent(r.ok ? 'INFO' : 'ERROR', 'admin-farm', `#${charId} ${body.blocker ?? body.phase ?? body.error ?? r.status}`);
  await refreshCharacters();
}

/* ---------- lifecycle ---------- */
function confirmLifecycle(action) {
  const online = Number.isFinite(state.health?.onlinePlayers) ? state.health.onlinePlayers : '—';
  const title = action === 'restart' ? 'Restart game server?' : action === 'stop' ? 'Stop game server?' : 'Start game server?';
  const box = el('modal').querySelector('.box');
  box.innerHTML = `<h4>${esc(title)}</h4><div class="muted">目前 onlinePlayers = ${esc(online)}</div>
    <div class="muted">${action === 'start' ? 'Start login/char/map via ro-stack.ps1.' : 'This stops login/char/map only. MariaDB and the Dashboard stay up.'}</div>
    <div class="actions"><button class="action" data-cancel>取消</button><button class="action danger" data-confirm>${esc(action.toUpperCase())}</button></div>`;
  el('modal').classList.add('on');
  box.querySelector('[data-cancel]').addEventListener('click', () => el('modal').classList.remove('on'));
  box.querySelector('[data-confirm]').addEventListener('click', async () => { el('modal').classList.remove('on'); await runLifecycle(action); });
}
async function runLifecycle(action) {
  state.busy = true; state.busyLabel = `${action.toUpperCase()}ING…`; render();
  const r = await api(`/api/admin/server/${action}`, { method: 'POST' });
  state.busy = false;
  pushEvent(r.ok ? 'INFO' : 'ERROR', `lifecycle:${action}`, r.body?.state ?? (r.ok ? 'SUCCESS' : 'FAILED'));
  await refresh(true);
}

/* ---------- data ---------- */
async function loadStatus() { const r = await api('/api/admin/server/status'); if (!r.ok) throw Object.assign(new Error(r.body?.error ?? 'server status failed'), { status: r.status }); state.status = r.body; }
async function loadInternalHealth() { try { const r = await api('/api/internal/health'); if (r.ok && r.body) state.onlinePlayers = r.body.onlinePlayers; } catch {} }
async function loadCharacters() { const r = await api('/api/admin/characters'); if (!r.ok) throw Object.assign(new Error(r.body?.error ?? 'characters failed'), { status: r.status }); state.characters = r.body?.characters ?? []; }
async function refresh(force = false) {
  if (state.busy && !force) return;
  if (!state.status) { state.loading = 'loading'; render(); }
  try {
    await Promise.all([loadStatus(), loadInternalHealth(), state.characters === null ? loadCharacters() : Promise.resolve()]);
    state.health = computeHealth(state.status, state.characters);
    if (Number.isFinite(state.onlinePlayers)) state.health.onlinePlayers = state.onlinePlayers;
    state.loading = 'ok'; state.error = null; state.lastLoadedAt = Date.now();
    renderTop(); render();
  } catch (error) {
    state.loading = 'error'; state.error = { status: error.status ?? '—', message: error.message };
    renderTop(); render();
  }
}

/* ---------- boot ---------- */
el('search').addEventListener('input', () => { state.search = el('search').value; render(); });
window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if (TABS.some(([k]) => k === t)) { state.tab = t; renderTabs(); renderTop(); render(); } });
if (!TABS.some(([k]) => k === state.tab)) state.tab = 'overview';
renderTabs(); renderLoading();
(async () => { await loadJobNames(); refresh(true); })();
setInterval(() => { if (!state.busy) refresh(); }, 10_000);
