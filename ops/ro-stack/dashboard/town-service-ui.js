// Town service entry on the original RO minimap: Kafra Storage, Shop and
// Refinery. The minimap stays the only map engine; this module adds original
// client markers, a PLAYER_SERVICE_INTENT, and service surfaces that replace
// the minimap once the character stands inside the service zone.
// V1 is a local prototype: it only runs when town-service preview is enabled
// and its surfaces use isolated preview data (no server mutation).
import {
  TOWN_SERVICE_ICONS, SERVICE_INTENT_STATUS, advanceServiceIntent, closeServiceIntent,
  createServiceIntent, hasTownMinimapMarks, isTownServiceMap, markersForMap, serviceById, townForMap,
} from '/town-service-zones.mjs';
import { TOWN_SERVICE_PREVIEW } from '/town-service-fixtures.mjs';
import {
  KAFRA_ROTATION_STORAGE_KEY, KAFRA_THEME_STORAGE_KEY, kafraImageUrl, kafraThemes,
  resetKafraRotation, resolveKafraTheme, takeKafraImage,
} from '/kafra-themes.mjs';

const localHost = ['127.0.0.1', 'localhost'].includes(location.hostname);
const enabled = document.documentElement.dataset.townServicePreview === '1' ||
  (localHost && new URLSearchParams(location.search).get('townServicePreview') === '1');

const state = {
  intent: null,
  position: null,
  surface: null,
  kafraManifest: null,
  kafraTheme: null,
};
const $ = (selector, root = document) => root.querySelector(selector);
const create = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const repaint = () => window.requestMinimapPaint?.();
const zeny = (value) => `${Number(value).toLocaleString('en-US')} Zeny`;

function readJson(storage, key) {
  try { return JSON.parse(storage.getItem(key) ?? 'null'); } catch { return null; }
}

// ---------- Kafra theme (系統設定 → 介面／主題 → 卡普拉主題) ----------
async function loadKafraManifest() {
  if (state.kafraManifest) return state.kafraManifest;
  const response = await fetch('/kafra-themes-manifest.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('kafra manifest unavailable');
  state.kafraManifest = await response.json();
  state.kafraTheme = resolveKafraTheme(state.kafraManifest, localStorage.getItem(KAFRA_THEME_STORAGE_KEY));
  return state.kafraManifest;
}

function selectKafraTheme(themeId) {
  const manifest = state.kafraManifest;
  const next = resolveKafraTheme(manifest, themeId);
  if (!next) return;
  state.kafraTheme = next;
  localStorage.setItem(KAFRA_THEME_STORAGE_KEY, next);
  sessionStorage.setItem(KAFRA_ROTATION_STORAGE_KEY, JSON.stringify(resetKafraRotation(next)));
  renderKafraThemeOptions();
}

function renderKafraThemeOptions() {
  const host = $('#kafraTheme');
  if (!host || !state.kafraManifest) return;
  host.replaceChildren(...kafraThemes(state.kafraManifest).map((theme) => {
    const option = create('button', 'kafra-theme-option');
    option.type = 'button';
    option.setAttribute('role', 'radio');
    option.dataset.kafraTheme = theme.id;
    const selected = theme.id === state.kafraTheme;
    option.setAttribute('aria-checked', String(selected));
    option.classList.toggle('selected', selected);
    const thumb = create('span', 'kafra-theme-thumb');
    const image = create('img');
    image.alt = '';
    image.loading = 'lazy';
    image.src = kafraImageUrl(state.kafraManifest, theme.id, theme.images[0]);
    thumb.append(image);
    const label = create('span', 'kafra-theme-label',
      theme.id === state.kafraManifest.defaultTheme ? `${theme.label}（預設）` : theme.label);
    const count = create('small', 'kafra-theme-count', `${theme.images.length} 張`);
    option.append(thumb, label, count);
    option.addEventListener('click', () => selectKafraTheme(theme.id));
    return option;
  }));
}

function nextKafraImage() {
  const manifest = state.kafraManifest;
  if (!manifest) return null;
  const pick = takeKafraImage(manifest, state.kafraTheme,
    readJson(sessionStorage, KAFRA_ROTATION_STORAGE_KEY));
  if (pick) sessionStorage.setItem(KAFRA_ROTATION_STORAGE_KEY, JSON.stringify(pick.rotation));
  return pick;
}

// ---------- Minimap markers ----------
function markerLayer() {
  const wrap = $('.map-window .minimap-wrap');
  if (!wrap) return null;
  let layer = $('.town-service-markers', wrap);
  if (!layer) {
    layer = create('div', 'town-service-markers');
    wrap.append(layer);
  }
  return layer;
}

function statusLine() {
  const wrap = $('.map-window .minimap-wrap');
  if (!wrap) return null;
  let line = $('.town-service-status', wrap);
  if (!line) {
    line = create('div', 'town-service-status');
    line.setAttribute('aria-live', 'polite');
    wrap.append(line);
  }
  return line;
}

function renderStatus() {
  const line = statusLine();
  if (!line) return;
  const layer = markerLayer();
  if (layer) {
    layer.dataset.intent = state.intent?.status ?? '';
    layer.dataset.intentService = state.intent?.serviceId ?? '';
  }
  const service = state.intent && serviceById(state.intent.serviceId);
  if (!service || state.intent.status !== SERVICE_INTENT_STATUS.NAVIGATING) {
    line.hidden = true;
    line.replaceChildren();
    return;
  }
  line.hidden = false;
  const cancel = create('button', 'town-service-cancel', '×');
  cancel.type = 'button';
  cancel.title = '取消前往';
  cancel.setAttribute('aria-label', '取消前往');
  cancel.addEventListener('click', cancelIntent);
  line.replaceChildren(create('span', '', `前往 ${service.npcName}・${service.serviceName}`), cancel);
}

function renderMarkers({ map, projected, canvas }) {
  const layer = markerLayer();
  if (!layer) return;
  const markers = !state.surface && hasTownMinimapMarks(map) ? markersForMap(map) : [];
  // Map canvas pixels to the layer using the canvas' painted box, so markers
  // stay on the same spot as everything drawn on the canvas.
  const canvasBox = canvas.getBoundingClientRect?.() ?? { left: 0, top: 0, width: 1, height: 1 };
  const layerBox = layer.getBoundingClientRect();
  const scaleX = canvasBox.width / (canvas.width || 1);
  const scaleY = canvasBox.height / (canvas.height || 1);
  const offsetX = canvasBox.left - layerBox.left;
  const offsetY = canvasBox.top - layerBox.top;
  const existing = new Map([...layer.children].map((node) => [node.dataset.key, node]));
  const keep = new Set();
  for (const marker of markers) {
    const key = `${marker.serviceId}:${marker.map}:${marker.x}:${marker.y}`;
    keep.add(key);
    let button = existing.get(key);
    if (!button) {
      button = create('button', 'town-service-marker');
      button.type = 'button';
      button.dataset.key = key;
      if (marker.serviceId) {
        button.dataset.serviceId = marker.serviceId;
        button.dataset.serviceType = marker.type;
      } else {
        // Original minimap mark without a player service: name only.
        button.classList.add('info-only');
      }
      button.setAttribute('aria-label', marker.label);
      const icon = create('img');
      icon.src = TOWN_SERVICE_ICONS[marker.icon];
      icon.alt = '';
      icon.draggable = false;
      icon.addEventListener('error', () => { button.dataset.iconStatus = 'missing'; icon.remove(); });
      button.append(icon, create('span', 'town-service-tooltip', marker.label));
      button.addEventListener('click', () => {
        if (marker.serviceId) startIntent(marker.serviceId);
      });
      layer.append(button);
    }
    const pixel = projected(marker.x, marker.y);
    button.style.left = `${offsetX + pixel.x * scaleX}px`;
    button.style.top = `${offsetY + pixel.y * scaleY}px`;
    button.classList.toggle('targeted', state.intent?.serviceId === marker.serviceId &&
      state.intent.status === SERVICE_INTENT_STATUS.NAVIGATING);
  }
  for (const [key, node] of existing) if (!keep.has(key)) node.remove();
}

// ---------- Intent ----------
function startIntent(serviceId) {
  const layer = markerLayer();
  if (!state.position) {
    if (layer) layer.dataset.intentError = 'NO_POSITION';
    return;
  }
  const service = serviceById(serviceId);
  try {
    state.intent = createServiceIntent(serviceId, state.position);
  } catch (error) {
    if (layer) layer.dataset.intentError = error.message;
    return;
  }
  if (layer) layer.dataset.intentError = '';
  renderStatus();
  const opened = advance();
  if (!opened) window.GhostIslandTownServiceNavigation?.navigate({
    service, route: service.route, exits: townForMap(state.position.map)?.exits ?? [] });
  repaint();
}

function cancelIntent() {
  window.GhostIslandTownServiceNavigation?.cancel?.();
  state.intent = closeServiceIntent(state.intent);
  renderStatus();
  repaint();
}

function advance() {
  if (!state.intent || state.intent.status !== SERVICE_INTENT_STATUS.NAVIGATING) return false;
  const next = advanceServiceIntent(state.intent, state.position);
  if (next === state.intent) return false;
  state.intent = next;
  renderStatus();
  window.GhostIslandTownServiceNavigation?.arrived?.();
  openSurface(serviceById(next.serviceId));
  return true;
}

// ---------- Service surfaces ----------
function surfaceHost() {
  return $('.map-window .minimap-wrap');
}

function closeSurface() {
  const wrap = surfaceHost();
  state.surface?.remove();
  state.surface = null;
  wrap?.classList.remove('town-service-open');
  state.intent = closeServiceIntent(state.intent);
  renderStatus();
  repaint();
}

function roWindow(title, subtitle) {
  const frame = create('section', 'window town-service-window');
  const bar = create('div', 'titlebar');
  bar.append(create('span', '', title), create('span', 'town-service-preview-tag', subtitle));
  const close = create('button', 'town-service-close', '×');
  close.type = 'button';
  close.title = '關閉';
  close.setAttribute('aria-label', '關閉');
  close.addEventListener('click', closeSurface);
  bar.append(close);
  frame.append(bar);
  return frame;
}

function itemIcon(item) {
  const holder = create('span', 'town-service-item-icon');
  const image = create('img');
  image.src = item.icon;
  image.alt = '';
  image.addEventListener('error', () => { holder.dataset.iconStatus = 'missing'; image.remove(); });
  holder.append(image);
  return holder;
}

function tabs(labels, onSelect) {
  const bar = create('div', 'ro-subtabs town-service-tabs');
  bar.setAttribute('role', 'tablist');
  labels.forEach(([id, label], index) => {
    const button = create('button', index === 0 ? 'active' : '', label);
    button.type = 'button';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(index === 0));
    button.addEventListener('click', () => {
      for (const other of bar.children) {
        other.classList.toggle('active', other === button);
        other.setAttribute('aria-selected', String(other === button));
      }
      onSelect(id);
    });
    bar.append(button);
  });
  return bar;
}

const storageCategories = Object.freeze([
  ['item', '消耗'], ['cash', '商城'], ['armor', '防具'], ['weapon', '武器'],
  ['costume', '服飾'], ['throwable', '投擲'], ['card', '卡片'], ['etc', '其他'],
]);

function storageCategory(item) {
  if (item.tab !== 'equip') return item.tab;
  return [1102, 1201].includes(item.itemId) ? 'weapon' : 'armor';
}

function bindDoubleActivate(button, activate) {
  let lastTouch = 0;
  let lastActivation = 0;
  const fire = () => {
    const now = Date.now();
    if (now - lastActivation < 500) return;
    lastActivation = now;
    activate();
  };
  button.addEventListener('dblclick', fire);
  button.addEventListener('pointerup', (event) => {
    if (event.pointerType !== 'touch') return;
    const now = Date.now();
    if (now - lastTouch < 450) { lastTouch = 0; fire(); }
    else lastTouch = now;
  });
  button.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') fire();
  });
}

function quantityDialog(scene, verb, item, onConfirm) {
  $('.town-service-quantity', scene)?.remove();
  const overlay = create('div', 'town-service-quantity');
  const form = create('form', 'window town-service-quantity-window');
  form.setAttribute('role', 'dialog');
  form.setAttribute('aria-modal', 'true');
  form.setAttribute('aria-label', `${verb}${item.name}`);
  form.append(create('div', 'titlebar', `${verb}道具`));
  const body = create('div', 'town-service-quantity-body');
  body.append(itemIcon(item), create('span', '', item.name));
  const input = create('input');
  input.type = 'number';
  input.min = '1';
  input.max = String(item.amount);
  input.value = String(item.amount);
  input.inputMode = 'numeric';
  input.setAttribute('aria-label', '數量');
  body.append(input);
  const actions = create('div', 'town-service-quantity-actions');
  const cancel = create('button', '', '取消');
  cancel.type = 'button';
  cancel.addEventListener('click', () => overlay.remove());
  const confirm = create('button', 'primary', '確定');
  confirm.type = 'submit';
  actions.append(cancel, confirm);
  form.append(body, actions);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const count = Number(input.value);
    if (!Number.isInteger(count) || count < 1 || count > item.amount) {
      input.setCustomValidity(`請輸入 1 到 ${item.amount} 之間的數量`);
      input.reportValidity();
      return;
    }
    onConfirm(count);
    overlay.remove();
  });
  input.addEventListener('input', () => input.setCustomValidity(''));
  overlay.append(form);
  scene.append(overlay);
  input.focus();
}

function previewBagWindow(items, onActivate, hint = () => '雙擊存入倉庫') {
  const frame = roWindow('道具欄', '預覽');
  frame.classList.add('town-service-bag-window');
  const grid = create('div', 'town-service-bag-grid');
  const render = () => {
    grid.replaceChildren(...items.map((item) => {
      const slot = create('button', 'town-service-slot');
      slot.type = 'button';
      slot.title = `${item.refine ? `+${item.refine} ` : ''}${item.name} ×${item.amount}`;
      slot.setAttribute('aria-label', `背包 ${item.name} ${item.amount} 個，${hint(item)}`);
      slot.append(itemIcon(item), create('b', '', item.amount > 1 ? String(item.amount) : ''));
      if (onActivate) bindDoubleActivate(slot, () => onActivate(item));
      return slot;
    }));
  };
  const foot = create('div', 'town-service-foot', `道具 ${items.length} 種`);
  frame.append(grid, foot);
  render();
  return { frame, render };
}

function storageSurface(service) {
  const scene = create('div', 'town-service-scene kafra-scene');
  const pick = nextKafraImage();
  if (pick) {
    const backdrop = create('img', 'kafra-backdrop');
    backdrop.src = pick.url;
    backdrop.alt = '';
    scene.append(backdrop);
    const art = create('img', 'kafra-art');
    art.src = pick.url;
    art.alt = '';
    art.dataset.kafraTheme = pick.theme;
    art.dataset.kafraIndex = String(pick.index + 1);
    scene.dataset.kafraImage = `${pick.theme}/${pick.image.file}`;
    scene.append(art);
  }
  const frame = roWindow('倉庫', service.npcName);
  frame.classList.add('town-service-storage-window');
  const storage = TOWN_SERVICE_PREVIEW.storage.map((item) => ({ ...item }));
  const bag = TOWN_SERVICE_PREVIEW.bag.map((item) => ({ ...item }));
  let category = 'item';
  const body = create('div', 'town-service-storage-body');
  const categoryTabs = create('div', 'town-service-storage-tabs');
  categoryTabs.setAttribute('role', 'tablist');
  const list = create('div', 'town-service-storage-list');
  const foot = create('div', 'town-service-foot');
  const count = create('span');
  const notice = create('p', 'town-service-notice');
  foot.append(count);
  const transfer = (from, to, item, amount, verb) => {
    if (!from.includes(item) || amount > item.amount) return;
    const target = to.find((candidate) => candidate.itemId === item.itemId && candidate.refine === item.refine);
    if (to === storage && !target && storage.length >= TOWN_SERVICE_PREVIEW.storageCapacity) {
      notice.textContent = '倉庫已滿。';
      return;
    }
    if (target) target.amount += amount;
    else to.push({ ...item, amount });
    item.amount -= amount;
    if (item.amount === 0) from.splice(from.indexOf(item), 1);
    notice.textContent = `預覽：${verb} ${item.name} ×${amount}，未送出伺服器。`;
    render();
  };
  const bagWindow = previewBagWindow(bag, (item) => {
    const move = (amount) => transfer(bag, storage, item, amount, '存入');
    if (item.amount > 1) quantityDialog(scene, '存入', item, move);
    else move(1);
  });
  const render = () => {
    const selected = storageCategories.findIndex(([id]) => id === category) + 1;
    categoryTabs.style.backgroundImage = `url('/ro/client/town-service/tab_item_0${selected}.png')`;
    for (const tab of categoryTabs.children) {
      tab.setAttribute('aria-selected', String(tab.dataset.category === category));
    }
    const filtered = storage.filter((item) => storageCategory(item) === category);
    list.replaceChildren(...filtered.map((item) => {
      const row = create('button', 'town-service-storage-row');
      row.type = 'button';
      row.title = `雙擊取出 ${item.name}`;
      row.append(itemIcon(item), create('span', 'town-service-storage-name',
        `${item.refine ? `+${item.refine} ` : ''}${item.name}`),
        create('b', '', item.amount > 1 ? String(item.amount) : ''));
      bindDoubleActivate(row, () => {
        const move = (amount) => transfer(storage, bag, item, amount, '取出');
        if (item.amount > 1) quantityDialog(scene, '取出', item, move);
        else move(1);
      });
      return row;
    }));
    if (!filtered.length) list.append(create('span', 'town-service-empty', '此分類沒有道具'));
    count.textContent = `數量 ${storage.length} / ${TOWN_SERVICE_PREVIEW.storageCapacity}`;
    bagWindow.render();
  };
  storageCategories.forEach(([id, label], index) => {
    const tab = create('button');
    tab.type = 'button';
    tab.dataset.category = id;
    tab.title = label;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-label', label);
    tab.style.top = `${index * 12.5}%`;
    tab.addEventListener('click', () => { category = id; render(); });
    categoryTabs.append(tab);
  });
  body.append(categoryTabs, list);
  frame.append(body, foot, notice);
  render();
  scene.append(frame, bagWindow.frame);
  return scene;
}

function shopSurface(service) {
  const scene = create('div', 'town-service-scene shop-scene');
  const frame = roWindow('商店', service.npcName);
  const list = create('div', 'town-service-trade-list');
  const total = create('b');
  const notice = create('p', 'town-service-notice');
  let mode = 'buy';
  const quantities = new Map();
  const bag = TOWN_SERVICE_PREVIEW.bag.map((item) => ({ ...item }));
  const rows = () => (mode === 'buy' ? TOWN_SERVICE_PREVIEW.shop : TOWN_SERVICE_PREVIEW.sellable);
  const update = () => {
    const sum = rows().reduce((acc, item) => acc + (quantities.get(item.itemId) ?? 0) * item.price, 0);
    total.textContent = zeny(sum);
  };
  const render = () => {
    quantities.clear();
    notice.textContent = '';
    list.replaceChildren(...rows().map((item) => {
      const row = create('label', 'town-service-trade-row');
      const qty = create('input');
      qty.type = 'number';
      qty.dataset.itemId = String(item.itemId);
      qty.min = '0';
      qty.max = String(mode === 'buy' ? 99 : item.amount);
      qty.value = '0';
      qty.inputMode = 'numeric';
      qty.setAttribute('aria-label', `${item.name} 數量`);
      qty.addEventListener('input', () => {
        const value = Math.max(0, Math.min(Number(qty.max), Math.floor(Number(qty.value) || 0)));
        quantities.set(item.itemId, value);
        update();
      });
      const detail = create('span', 'town-service-trade-name', item.name);
      const owned = mode === 'sell' ? create('small', '', `持有 ${item.amount}`) : null;
      row.append(itemIcon(item), detail, ...(owned ? [owned] : []),
        create('span', 'town-service-price', zeny(item.price)), qty);
      return row;
    }));
    update();
  };
  const foot = create('div', 'town-service-foot');
  const confirm = create('button', 'primary', '確定');
  confirm.type = 'button';
  confirm.addEventListener('click', () => { notice.textContent = '預覽模式：交易尚未連接伺服器。'; });
  const wallet = create('span', '', `持有 ${zeny(TOWN_SERVICE_PREVIEW.zeny)}`);
  const sum = create('span', 'town-service-total', '合計 ');
  sum.append(total);
  foot.append(wallet, sum, confirm);
  frame.append(tabs([['buy', '購買'], ['sell', '販賣']], (id) => {
    mode = id;
    render();
    bagWindow.render();
  }), list, foot, notice);
  render();
  const bagWindow = previewBagWindow(bag, (item) => {
    if (mode !== 'sell') return;
    const sellable = TOWN_SERVICE_PREVIEW.sellable.find((entry) => entry.itemId === item.itemId);
    if (!sellable) return;
    quantityDialog(scene, '販賣', item, (amount) => {
      const qty = list.querySelector(`input[data-item-id="${item.itemId}"]`);
      if (!qty) return;
      qty.value = String(Math.min(amount, sellable.amount));
      qty.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }, (item) => mode === 'sell' && TOWN_SERVICE_PREVIEW.sellable.some((entry) => entry.itemId === item.itemId)
    ? '雙擊選擇販賣數量' : '道具預覽');
  scene.append(frame, bagWindow.frame);
  return scene;
}

function refineSurface(service) {
  const scene = create('div', 'town-service-scene refine-scene');
  const frame = roWindow('精煉', service.npcName);
  const body = create('div', 'town-service-refine');
  const list = create('div', 'town-service-refine-list');
  const board = create('div', 'town-service-refine-board');
  const background = create('img', 'refine-bg');
  background.alt = '';
  const plate = create('span', 'refine-plate');
  const slot = create('span', 'refine-slot');
  const material = create('span', 'refine-material');
  const button = create('button', 'refine-button');
  button.type = 'button';
  const cost = create('span', 'refine-cost');
  button.append(cost);
  const notice = create('p', 'town-service-notice');
  board.append(background, plate, slot, material, button);
  let selected = null;
  const paint = () => {
    background.src = selected
      ? `/ro/client/town-service/${selected.kind === 'weapon' ? 'bg_refininga_ready_00' : 'bg_refiningb_ready_00'}.png`
      : '/ro/client/town-service/bg_refining_wait_00.png';
    plate.textContent = selected ? `+${selected.refine} ${selected.name}` : '';
    slot.replaceChildren(...(selected ? [itemIcon(selected)] : []));
    material.replaceChildren(...(selected ? [itemIcon(selected.material)] : []));
    material.title = selected ? selected.material.name : '';
    button.disabled = !selected;
    button.dataset.state = selected ? 'normal' : 'disable';
    cost.textContent = selected ? Number(selected.cost).toLocaleString('en-US') : '';
    for (const row of list.children) row.classList.toggle('selected', row.dataset.itemId === String(selected?.itemId));
  };
  for (const item of TOWN_SERVICE_PREVIEW.refine) {
    const row = create('button', 'town-service-refine-row');
    row.type = 'button';
    row.dataset.itemId = String(item.itemId);
    row.append(itemIcon(item), create('span', '', `+${item.refine} ${item.name}`));
    row.addEventListener('click', () => { selected = item; notice.textContent = ''; paint(); });
    list.append(row);
  }
  button.addEventListener('pointerdown', () => { if (!button.disabled) button.dataset.state = 'press'; });
  button.addEventListener('pointerup', () => { if (!button.disabled) button.dataset.state = 'normal'; });
  button.addEventListener('pointerleave', () => { if (!button.disabled) button.dataset.state = 'normal'; });
  button.addEventListener('click', () => { notice.textContent = '預覽模式：精煉尚未連接伺服器。'; });
  body.append(list, board);
  frame.append(body, notice);
  paint();
  scene.append(frame);
  return scene;
}

function openSurface(service) {
  const wrap = surfaceHost();
  if (!wrap || !service) return;
  state.surface?.remove();
  const builders = { KAFRA_STORAGE: storageSurface, SHOP: shopSurface, REFINERY: refineSurface };
  const surface = create('div', 'town-service-surface');
  surface.dataset.serviceId = service.id;
  surface.dataset.serviceType = service.type;
  surface.append(builders[service.type](service));
  wrap.classList.add('town-service-open');
  wrap.append(surface);
  state.surface = surface;
  surface.scrollIntoView({ block: 'nearest' });
}

// ---------- Minimap hook (called by app.js paintMinimap) ----------
function paintMinimap({ map, projected, canvas, self }) {
  if (!enabled) return;
  state.position = map && self ? { map, x: Math.round(self.x), y: Math.round(self.y) } : null;
  const layer = markerLayer();
  if (layer) layer.dataset.position = state.position ? `${map}:${state.position.x},${state.position.y}` : '';
  renderMarkers({ map, projected, canvas });
  if (state.position && !state.surface) queueMicrotask(advance);
}

function isTownIdleMap(map) {
  return isTownServiceMap(map);
}

window.GhostIslandTownService = Object.freeze({
  enabled,
  paintMinimap,
  isTownServiceMap: isTownIdleMap,
  state: () => ({
    intent: state.intent ? { ...state.intent } : null,
    position: state.position ? { ...state.position } : null,
    surface: state.surface?.dataset.serviceType ?? null,
    kafraTheme: state.kafraTheme,
    kafraImage: state.surface?.querySelector('.kafra-scene')?.dataset.kafraImage ?? null,
  }),
});

if (enabled) {
  document.documentElement.classList.add('town-service-enabled');
  for (const node of document.querySelectorAll('.town-service-gated')) node.classList.add('town-service-live');
  loadKafraManifest().then(renderKafraThemeOptions).catch(() => {});
}
