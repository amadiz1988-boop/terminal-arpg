const stateLabels = {
  healthy: '正常',
  degraded: '降級',
  unreachable: '無法連線',
  stopped: '已停止',
  starting: '啟動中',
  stopping: '停止中',
  quarantined: '已隔離',
  unknown: '證據不足',
};

const serviceLabels = {
  'ops-agent': '管理監控服務',
  dashboard: '玩家 Dashboard',
  'cloudflare-tunnel': 'Cloudflare 公開入口',
  mariadb: 'MariaDB',
  'login-server': '登入伺服器',
  'char-server': '角色伺服器',
  'map-server': '地圖伺服器',
};

const nodes = Object.fromEntries(
  [
    'healthBanner',
    'overallStatus',
    'refreshButton',
    'healthyCount',
    'issueCount',
    'characterCount',
    'characterIssueCount',
    'serviceObservedAt',
    'serviceList',
    'characterSearch',
    'characterEmpty',
    'characterList',
    'incidentEmpty',
    'incidentList',
    'incidentDetail',
    'lastUpdated',
  ].map((id) => [id, document.getElementById(id)]),
);

let characters = [];

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function formatTime(value) {
  if (!value) return '無資料';
  const date = new Date(value);
  return Number.isFinite(date.valueOf())
    ? new Intl.DateTimeFormat('zh-TW', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(date)
    : '無資料';
}

async function getJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path} HTTP ${response.status}`);
  return await response.json();
}

function stateBadge(state) {
  const badge = element('span', 'state-badge', stateLabels[state] ?? state);
  badge.dataset.state = state;
  return badge;
}

function renderServices(services) {
  nodes.serviceList.replaceChildren();
  for (const service of services) {
    const card = element('article', 'service-card');
    card.dataset.state = service.state;
    const row = element('div', 'card-row');
    row.append(
      element('span', 'card-title', serviceLabels[service.serviceId] ?? service.serviceId),
      stateBadge(service.state),
    );
    const meta = element('div', 'meta');
    meta.append(
      element('span', '', service.pid ? `PID ${service.pid}` : 'PID 無資料'),
      element('span', '', service.port ? `Port ${service.port}` : '無固定 Port'),
      element('span', '', `心跳 ${formatTime(service.lastHeartbeatAt)}`),
    );
    card.append(row, meta);
    if (service.lastErrorCode) {
      card.append(element('p', 'reason', `原因：${service.lastErrorCode}`));
    }
    const details = document.createElement('details');
    details.append(element('summary', '', `檢查證據 ${service.evidence.length} 項`));
    const list = element('ul', 'evidence-list');
    for (const item of service.evidence) {
      list.append(
        element(
          'li',
          '',
          `${item.status.toUpperCase()} · ${item.type} · ${item.summary ?? '無摘要'}`,
        ),
      );
    }
    details.append(list);
    card.append(details);
    nodes.serviceList.append(card);
  }
}

function renderCharacters() {
  const query = nodes.characterSearch.value.trim().toLowerCase();
  const visible = characters
    .filter((character) =>
      [character.accountId, character.characterId, character.map, character.provider]
        .filter((value) => value != null)
        .some((value) => String(value).toLowerCase().includes(query)),
    )
    .sort((left, right) =>
      Number(right.lastErrorCode != null) - Number(left.lastErrorCode != null) ||
      left.accountId - right.accountId,
    );
  nodes.characterList.replaceChildren();
  nodes.characterEmpty.classList.toggle('hidden', visible.length > 0);
  for (const character of visible) {
    const card = element('article', 'character-card');
    card.dataset.issue = String(character.lastErrorCode != null);
    const row = element('div', 'card-row');
    row.append(
      element('span', 'character-id', `角色 #${character.characterId}`),
      stateBadge(character.lastErrorCode ? 'degraded' : 'healthy'),
    );
    const meta = element('div', 'meta');
    meta.append(
      element('span', '', `帳號 ${character.accountId}`),
      element('span', '', `執行器 ${character.provider}`),
      element('span', 'character-map', character.map ?? '地圖無資料'),
      element('span', '', `心跳 ${formatTime(character.lastHeartbeatAt)}`),
    );
    card.append(row, meta);
    if (character.lastErrorCode) {
      card.append(element('p', 'reason', `原因：${character.lastErrorCode}`));
    }
    nodes.characterList.append(card);
  }
}

async function showIncident(snapshotId) {
  nodes.incidentDetail.classList.remove('hidden');
  nodes.incidentDetail.replaceChildren(element('p', '', '正在讀取事故詳情…'));
  try {
    const incident = await getJson(`/api/v1/incidents/${encodeURIComponent(snapshotId)}`);
    const title = element('h3', '', `事故快照 ${formatTime(incident.createdAt)}`);
    const issues = [
      ...incident.services
        .filter((service) => service.state !== 'healthy')
        .map(
          (service) =>
            `${serviceLabels[service.serviceId] ?? service.serviceId}：${stateLabels[service.state] ?? service.state} · ${service.lastErrorCode ?? '無錯誤碼'}`,
        ),
      ...incident.characters
        .filter((character) => character.lastErrorCode)
        .map(
          (character) =>
            `角色 #${character.characterId}：${character.lastErrorCode}`,
        ),
    ];
    const list = element('ul', 'evidence-list');
    for (const issue of issues) list.append(element('li', '', issue));
    nodes.incidentDetail.replaceChildren(title, list);
    nodes.incidentDetail.scrollIntoView({ block: 'nearest' });
  } catch {
    nodes.incidentDetail.replaceChildren(
      element('p', 'reason', '事故詳情讀取失敗，請重新更新。'),
    );
  }
}

function renderIncidents(incidents) {
  nodes.incidentList.replaceChildren();
  nodes.incidentEmpty.classList.toggle('hidden', incidents.length > 0);
  for (const incident of incidents) {
    const button = element('button', 'incident-button');
    button.type = 'button';
    button.append(
      element('strong', '', formatTime(incident.createdAt)),
      element('span', '', incident.trigger),
      element(
        'span',
        'incident-count',
        `${incident.serviceIssueCount + incident.characterIssueCount} 項警示`,
      ),
    );
    button.addEventListener('click', () => showIncident(incident.snapshotId));
    nodes.incidentList.append(button);
  }
}

async function refresh() {
  nodes.refreshButton.disabled = true;
  nodes.overallStatus.textContent = '正在更新服務證據';
  try {
    const [evidence, incidentResponse] = await Promise.all([
      getJson('/api/v1/evidence'),
      getJson('/api/v1/incidents'),
    ]);
    const healthy = evidence.summary.serviceCounts.healthy ?? 0;
    const issueCount = evidence.services.length - healthy;
    const characterIssues = evidence.characters.filter(
      (character) => character.lastErrorCode,
    ).length;
    nodes.healthyCount.textContent = String(healthy);
    nodes.issueCount.textContent = String(issueCount);
    nodes.characterCount.textContent = String(evidence.characters.length);
    nodes.characterIssueCount.textContent = String(characterIssues);
    nodes.healthBanner.dataset.state = issueCount ? 'issue' : 'healthy';
    nodes.overallStatus.textContent = issueCount
      ? `${issueCount} 個服務需要注意`
      : '所有已查核服務正常';
    nodes.serviceObservedAt.textContent = formatTime(evidence.observedAt);
    nodes.lastUpdated.textContent = formatTime(evidence.observedAt);
    characters = evidence.characters;
    renderServices(evidence.services);
    renderCharacters();
    renderIncidents(incidentResponse.incidents);
  } catch {
    nodes.healthBanner.dataset.state = 'issue';
    nodes.overallStatus.textContent = '管理資料讀取失敗';
  } finally {
    nodes.refreshButton.disabled = false;
  }
}

nodes.refreshButton.addEventListener('click', refresh);
nodes.characterSearch.addEventListener('input', renderCharacters);
await refresh();
setInterval(refresh, 15000);
