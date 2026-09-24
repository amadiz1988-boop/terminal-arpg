(() => {
  'use strict';

  const STORAGE_KEY = 'ghost-island.supply-settings-v2.preview.v1';
  const PREVIEW_ITEMS = [
    { itemId: 501, name: '紅色藥水', category: 'consumable', current: 4, min: 5, target: 15, source: 'NPC', runtime: 'SUPPORTED_NOW', metadata: { nonConsumable: false, weight: 7 } },
    { itemId: 1750, name: '箭矢', category: 'ammo', current: 180, min: 200, target: 1000, source: '倉庫 → 商店', runtime: 'PREVIEW_ONLY', metadata: { nonConsumable: false, weight: 0.1 } },
    { itemId: 602, name: '蝴蝶翅膀', category: 'tool', current: 1, source: '系統自動取得', runtime: 'SUPPORTED_NOW', metadata: { nonConsumable: true, weight: 0 } },
    { itemId: 601, name: '蒼蠅翅膀', category: 'tool', current: 1, source: '系統自動取得', runtime: 'SUPPORTED_NOW', metadata: { nonConsumable: true, weight: 0 } },
  ];
  const LOOT_RULES = [
    { itemId: 909, name: '傑勒比結晶', action: 'sell', label: '一般戰利品', runtime: 'PREVIEW_ONLY' },
    { itemId: 1002, name: '鐵礦石', action: 'store', label: '材料', runtime: 'PREVIEW_ONLY' },
    { itemId: 4001, name: '瘋兔卡片', action: 'keep', label: '指定 item · 保留 1', runtime: 'PREVIEW_ONLY' },
  ];
  const ACTIONS = { sell: '販售', store: '存入倉庫', keep: '保留身上', ignore: '不拾取' };
  const $ = (selector) => document.querySelector(selector);
  const state = {
    items: PREVIEW_ITEMS.filter((item) => item.category !== 'tool').map((item) => ({ ...item })),
    tools: PREVIEW_ITEMS.filter((item) => item.category === 'tool').map((item) => ({ ...item })),
    loot: LOOT_RULES.map((rule) => ({ ...rule })),
    saved: false,
  };

  function loadLocalState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!parsed) return;
      if (Array.isArray(parsed.items)) state.items = parsed.items;
      if (Array.isArray(parsed.tools)) state.tools = parsed.tools;
      if (Array.isArray(parsed.loot)) state.loot = parsed.loot;
      if (Number.isFinite(parsed.weightTrigger)) $('#weightTrigger').value = String(parsed.weightTrigger);
      $('#supplyEnabled').checked = parsed.enabled !== false;
    } catch { /* isolated preview remains usable */ }
  }

  function itemIcon(item) {
    const slot = document.createElement('span');
    slot.className = 'item-icon-frame';
    slot.dataset.itemId = String(item.itemId);
    const resolved = window.roAssetResolver?.resolveItemAsset({ itemId: item.itemId });
    if (resolved?.asset?.webPath) {
      const image = document.createElement('img');
      image.src = resolved.asset.webPath;
      image.alt = '';
      image.width = 24;
      image.height = 24;
      image.onerror = () => image.remove();
      slot.append(image);
    }
    return slot;
  }

  function badge(text, kind = 'preview') {
    const element = document.createElement('span');
    element.className = `semantic-badge ${kind.toLowerCase()}`;
    element.textContent = text;
    return element;
  }

  function renderConsumables() {
    const root = $('#consumableRows');
    root.replaceChildren();
    for (const item of state.items) {
      const row = document.createElement('div');
      row.className = 'item-row';
      const identity = document.createElement('div');
      identity.className = 'item-identity';
      identity.append(itemIcon(item));
      const name = document.createElement('strong');
      name.textContent = item.name;
      const type = badge(item.category === 'ammo' ? '彈藥' : '消耗補給', item.category === 'ammo' ? 'preview' : 'supported');
      identity.append(name, type);
      const current = document.createElement('span');
      current.className = 'item-current';
      current.innerHTML = `目前 <b>${item.current}</b>`;
      const min = numberField('低於', item.min, 'min', item.itemId);
      const target = numberField('補到', item.target, 'target', item.itemId);
      const source = document.createElement('span');
      source.className = 'item-source';
      source.innerHTML = `<small>取得方式</small><b>${item.source}</b>`;
      const status = document.createElement('span');
      status.className = `item-status ${item.current < item.min ? 'warning' : 'ok'}`;
      status.textContent = item.current < item.min ? '不足' : '正常';
      if (item.runtime !== 'SUPPORTED_NOW') status.append(badge('PREVIEW_ONLY', 'preview'));
      row.append(identity, current, min, target, source, status);
      root.append(row);
    }
  }

  function numberField(label, value, key, itemId) {
    const wrap = document.createElement('label');
    wrap.className = 'number-field';
    wrap.innerHTML = `<span>${label}</span>`;
    const input = document.createElement('input');
    input.type = 'number'; input.min = '0'; input.value = String(value); input.inputMode = 'numeric';
    input.dataset.itemId = String(itemId); input.dataset.itemField = key;
    input.dataset.roPrimitive = 'RoInput';
    input.addEventListener('input', () => {
      const item = state.items.find((candidate) => candidate.itemId === itemId);
      if (item) { item[key] = Math.max(0, Math.trunc(Number(input.value) || 0)); renderJourney(); validate(); }
    });
    wrap.append(input);
    return wrap;
  }

  function renderTools() {
    const root = $('#toolRows'); root.replaceChildren();
    for (const item of state.tools) {
      const row = document.createElement('div'); row.className = 'tool-row';
      const identity = document.createElement('div'); identity.className = 'item-identity'; identity.append(itemIcon(item));
      const name = document.createElement('strong'); name.textContent = item.name; identity.append(name, badge('必要工具', 'supported'));
      const present = item.current >= 1;
      const status = document.createElement('span'); status.className = `presence-status ${present ? 'ok' : 'warning'}`; status.textContent = present ? '✓ 已持有' : '⚠ 缺少';
      const note = document.createElement('span'); note.className = 'presence-note'; note.textContent = present ? '持有即可' : '下一次補給取得至少一個';
      row.append(identity, status, note); root.append(row);
    }
  }

  function renderLoot() {
    const root = $('#lootRows'); root.replaceChildren();
    for (const rule of state.loot) {
      const row = document.createElement('div'); row.className = 'loot-row';
      const identity = document.createElement('div'); identity.className = 'item-identity'; identity.append(itemIcon(rule));
      const name = document.createElement('strong'); name.textContent = rule.name; identity.append(name, badge(rule.label, 'preview'));
      const select = document.createElement('select'); select.dataset.roPrimitive = 'RoSelect';
      for (const [value, text] of Object.entries(ACTIONS)) { const option = new Option(text, value); select.append(option); }
      select.value = rule.action; select.addEventListener('change', () => { rule.action = select.value; renderJourney(); });
      const stateText = document.createElement('span'); stateText.className = 'loot-state'; stateText.textContent = 'PREVIEW_ONLY';
      row.append(identity, select, stateText); root.append(row);
    }
  }

  function renderJourney() {
    const root = $('#journeyInventory'); root.replaceChildren();
    const lowItems = state.items.filter((item) => item.current < item.min);
    for (const item of [...state.items, ...state.tools]) {
      const row = document.createElement('div'); row.className = 'journey-item';
      row.append(itemIcon(item));
      const name = document.createElement('strong'); name.textContent = item.name; row.append(name);
      const detail = document.createElement('span');
      if (item.category === 'tool') detail.textContent = item.current >= 1 ? '✓ 已持有 · 持有即可' : '⚠ 缺少';
      else detail.textContent = `${item.current} / 最低 ${item.min} / 目標 ${item.target}`;
      row.append(detail); root.append(row);
    }
    $('#journeyState').textContent = lowItems.length ? '有待補項目' : '目前條件正常';
    $('#journeyState').className = lowItems.length ? 'status-warning' : 'status-ok';
    const plan = $('#journeyPlan'); plan.replaceChildren();
    const steps = lowItems.length ? ['中斷自動練功', '使用蝴蝶翅膀回城', '前往補給服務', ...lowItems.map((item) => item.itemId === 501 ? `購買${item.name} ${Math.max(0, item.target - item.current)} 個` : `由系統自動決定${item.name}取得方式`), '處理戰利品', '返回原練功地圖', '抵達後恢復自動練功'] : ['目前無需啟動補給旅程', '系統持續觀察 authoritative inventory'];
    for (const text of steps) { const li = document.createElement('li'); li.textContent = text; plan.append(li); }
  }

  function validate() {
    let valid = true;
    const weight = Number($('#weightTrigger').value);
    const weightError = $('#weightError');
    if (!Number.isInteger(weight) || weight < 40 || weight > 88) { weightError.textContent = '請輸入 40–88 的整數百分比。'; valid = false; } else weightError.textContent = '';
    for (const item of state.items) {
      if (!Number.isInteger(Number(item.min)) || item.min < 0 || !Number.isInteger(Number(item.target)) || item.target < item.min) valid = false;
    }
    return valid;
  }

  function persist() {
    const payload = { version: 1, source: 'PREVIEW_DATA', enabled: $('#supplyEnabled').checked, weightTrigger: Number($('#weightTrigger').value), items: state.items, tools: state.tools, loot: state.loot, savedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); state.saved = true;
    $('#saveNotice').textContent = '預覽設定已保存至此瀏覽器，Production 未變更。';
  }

  function openItemDialog() {
    const root = $('#itemChoices'); root.replaceChildren(); $('#dialogError').textContent = '';
    for (const item of PREVIEW_ITEMS) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'choice-row'; button.append(itemIcon(item));
      const name = document.createElement('strong'); name.textContent = item.name; button.append(name, badge(item.metadata.nonConsumable && item.metadata.weight === 0 ? '必要工具' : item.category === 'ammo' ? '彈藥' : '消耗補給', item.metadata.nonConsumable && item.metadata.weight === 0 ? 'supported' : 'preview'));
      button.addEventListener('click', () => addItem(item)); root.append(button);
    }
    $('#itemDialog').showModal();
  }

  function addItem(item) {
    if (state.items.some((candidate) => candidate.itemId === item.itemId) || state.tools.some((candidate) => candidate.itemId === item.itemId)) { $('#dialogError').textContent = '此道具已存在，請避免重複規則。'; return; }
    if (item.metadata.nonConsumable && item.metadata.weight === 0) state.tools.push({ ...item });
    else state.items.push({ ...item, min: item.min ?? 0, target: item.target ?? 1 });
    $('#itemDialog').close(); renderAll();
  }

  function renderAll() { renderConsumables(); renderTools(); renderLoot(); renderJourney(); validate(); }

  $('#weightTrigger').addEventListener('input', () => { renderJourney(); validate(); });
  $('#supplyEnabled').addEventListener('change', renderJourney);
  $('#addItem').addEventListener('click', openItemDialog);
  $('#resetPreview').addEventListener('click', () => { localStorage.removeItem(STORAGE_KEY); location.reload(); });
  $('#supplySettingsForm').addEventListener('submit', (event) => { event.preventDefault(); if (!validate()) { $('#saveNotice').textContent = '設定尚未保存，請先修正紅色提示。'; return; } persist(); });

  loadLocalState();
  renderAll();
  const assetLoad = window.roAssetResolver?.load();
  if (assetLoad?.then) assetLoad.then(renderAll).catch(() => renderAll());
})();
