(() => {
  // UI themes restyle the RO windows (title bar colour and soft art on the
  // right of window bodies). The page floor background is a separate setting.
  // Canonical rules: docs/project-control/ui-theme-system-v1.md
  const storageKey = 'ghost-island.ui-theme.v1';
  const rotationKey = 'ghost-island.ui-theme-rotation.v1';
  const DEFAULT_THEME = 'default';
  const ASSET_ROOT = '/assets/ui-themes';
  const FILES = { panel: 'panel.webp', thumb: 'thumb.webp' };
  const CSS_VARS = ['--ui-theme-panel', '--ui-theme-bar-top', '--ui-theme-bar-bottom',
    '--ui-theme-bar-border'];
  const deepFreeze = (value) => {
    Object.values(value).forEach((child) => child && typeof child === 'object' && deepFreeze(child));
    return Object.freeze(value);
  };
  const themes = deepFreeze([
    { id: DEFAULT_THEME, label: '預設', access: 'OPEN', entitlement: null, variants: [] },
    { id: 'heroine-roxy', label: '洛琪希', series: '無職轉生', access: 'OPEN', entitlement: null,
      titleBar: { top: '#7d86c8', bottom: '#3a3f86', border: '#2b2f66' },
      variants: [
        { key: 'roxy-01', versions: { panel: 'd3f87e81', thumb: 'db2bbb27' } },
        { key: 'roxy-02', versions: { panel: '0c772bd7', thumb: 'd70b487a' } },
      ] },
    { id: 'heroine-eris', label: '艾莉絲', series: '無職轉生', access: 'OPEN', entitlement: null,
      titleBar: { top: '#d9776a', bottom: '#9a2a24', border: '#6e1a16' },
      variants: [
        { key: 'eris-01', versions: { panel: 'c064c121', thumb: '5f7cc4c3' } },
        { key: 'eris-02', versions: { panel: '0f94fa2c', thumb: '5fc915ec' } },
        { key: 'eris-03', versions: { panel: 'e4528d29', thumb: '39409adf' } },
      ] },
    { id: 'heroine-sylphie', label: '西露菲', series: '無職轉生', access: 'OPEN', entitlement: null,
      titleBar: { top: '#9cb77a', bottom: '#4f6d33', border: '#3a5224' },
      variants: [
        { key: 'sylphie-01', versions: { panel: '1d98f7c5', thumb: '21cc8d4d' } },
        { key: 'sylphie-02', versions: { panel: '71b58d12', thumb: 'f735e5a2' } },
        { key: 'sylphie-03', versions: { panel: '77a7ef4f', thumb: 'ddb656e5' } },
        { key: 'sylphie-04', versions: { panel: 'f47b41f1', thumb: 'd224e902' } },
        { key: 'sylphie-05', versions: { panel: '17afd1fb', thumb: '5e551227' } },
        { key: 'sylphie-06', versions: { panel: 'fb662d03', thumb: '0c514397' } },
        { key: 'sylphie-07', versions: { panel: 'd213c0a0', thumb: '3f629a0f' } },
      ] },
    { id: 'heroine-red-dress', label: '妓神', series: '無職轉生', access: 'OPEN', entitlement: null,
      titleBar: { top: '#c77a8a', bottom: '#7c2438', border: '#5a1627' },
      variants: [
        { key: 'red-01', versions: { panel: 'e043b4bb', thumb: '12914d1a' } },
        { key: 'red-02', versions: { panel: '84505ec5', thumb: 'f89e2c22' } },
        { key: 'red-03', versions: { panel: '18c5f636', thumb: 'de749337' } },
        { key: 'red-04', versions: { panel: '1a06e35c', thumb: '932760c4' } },
      ] },
  ]);
  const byId = new Map(themes.map((theme) => [theme.id, theme]));
  const unavailable = new Set();
  let entitlements = new Set();

  const readJson = (key) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  };
  const writeJson = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  };
  const assetUrl = (theme, variant, kind) =>
    `${ASSET_ROOT}/${theme.id}/${variant.key}/${FILES[kind]}?v=${variant.versions[kind]}`;
  // OPEN themes are free for every player; other access tiers (for example a
  // future supporter reward) require a server-provided entitlement.
  const accessible = (theme, owned = entitlements) =>
    theme.access === 'OPEN' || (theme.entitlement != null && owned.has(theme.entitlement));
  const usableVariants = (theme) =>
    theme.variants.filter((variant) => !unavailable.has(`${theme.id}/${variant.key}`));
  const resolveTheme = (requested, owned = entitlements) => {
    const theme = byId.get(requested);
    return theme && accessible(theme, owned) &&
      (theme.id === DEFAULT_THEME || usableVariants(theme).length > 0) ? theme.id : DEFAULT_THEME;
  };
  // Themes with several images show the next one on every visit and every
  // page (tab) switch; the last shown image is remembered per theme.
  const pickVariant = (theme, advance) => {
    const usable = usableVariants(theme);
    const rotation = readJson(rotationKey);
    const last = usable.findIndex((variant) => variant.key === rotation[theme.id]);
    const next = usable[advance ? (last + 1) % usable.length : Math.max(last, 0)];
    rotation[theme.id] = next.key;
    writeJson(rotationKey, rotation);
    return next;
  };

  const root = document.documentElement;
  let selected = DEFAULT_THEME;
  let applied = { theme: DEFAULT_THEME, variant: null };
  const listeners = new Set();

  function paint(themeId, variant) {
    const theme = byId.get(themeId);
    applied = { theme: themeId, variant: variant?.key ?? null };
    root.dataset.uiTheme = themeId;
    if (!variant) {
      delete root.dataset.uiThemeVariant;
      CSS_VARS.forEach((name) => root.style.removeProperty(name));
    } else {
      root.dataset.uiThemeVariant = variant.key;
      root.style.setProperty('--ui-theme-panel', `url('${assetUrl(theme, variant, 'panel')}')`);
      root.style.setProperty('--ui-theme-bar-top', theme.titleBar.top);
      root.style.setProperty('--ui-theme-bar-bottom', theme.titleBar.bottom);
      root.style.setProperty('--ui-theme-bar-border', theme.titleBar.border);
    }
    listeners.forEach((listener) => listener());
  }

  function apply(requested, advance = false) {
    const id = resolveTheme(requested);
    if (id === DEFAULT_THEME) {
      paint(id, null);
      return id;
    }
    const theme = byId.get(id);
    const variant = pickVariant(theme, advance);
    paint(id, variant);
    if (typeof Image !== 'function') return id;
    // Missing private assets skip to another image, then to the default UI.
    const probe = new Image();
    probe.onerror = () => {
      unavailable.add(`${id}/${variant.key}`);
      if (applied.theme === id && applied.variant === variant.key) apply(selected);
    };
    probe.src = assetUrl(theme, variant, 'panel');
    return id;
  }

  function select(requested) {
    const id = resolveTheme(requested);
    selected = id;
    try {
      localStorage.setItem(storageKey, id);
    } catch {}
    return apply(id);
  }

  let activePage = null;
  function switchPage(page) {
    if (!page || page === activePage) return;
    const first = activePage === null;
    activePage = page;
    if (!first && applied.theme !== DEFAULT_THEME) apply(selected, true);
  }

  try {
    selected = localStorage.getItem(storageKey) ?? DEFAULT_THEME;
  } catch {}
  apply(selected, true);

  function card(className, label, title, thumb, onError, onClick) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = className;
    element.setAttribute('role', 'radio');
    element.title = title;
    const preview = document.createElement(thumb ? 'img' : 'span');
    preview.className = 'ui-theme-thumb';
    if (thumb) {
      preview.alt = '';
      preview.loading = 'lazy';
      preview.decoding = 'async';
      preview.src = thumb;
      preview.addEventListener('error', onError);
    }
    const text = document.createElement('span');
    text.className = 'ui-theme-label';
    text.textContent = label;
    element.append(preview, text);
    element.addEventListener('click', onClick);
    return element;
  }

  function renderSelector() {
    const container = document.getElementById('uiTheme');
    if (!container) return;
    const status = document.getElementById('uiThemeStatus');
    const themeCards = themes.filter((theme) => accessible(theme)).map((theme) => {
      const element = card('ui-theme-card', theme.label,
        theme.series ? `${theme.series}・${theme.label}` : '原本的 RO 視窗',
        theme.variants[0] && assetUrl(theme, theme.variants[0], 'thumb'),
        () => {
          theme.variants.forEach((variant) => unavailable.add(`${theme.id}/${variant.key}`));
          sync();
        },
        () => select(theme.id));
      element.dataset.themeId = theme.id;
      if (theme.titleBar) {
        element.style.setProperty('--ui-theme-card-top', theme.titleBar.top);
        element.style.setProperty('--ui-theme-card-bottom', theme.titleBar.bottom);
      }
      return element;
    });
    container.replaceChildren(...themeCards);
    function sync() {
      for (const element of themeCards) {
        const theme = byId.get(element.dataset.themeId);
        const checked = theme.id === applied.theme;
        element.disabled = theme.id !== DEFAULT_THEME && usableVariants(theme).length === 0;
        element.setAttribute('aria-checked', String(checked));
        element.classList.toggle('is-selected', checked);
      }
      if (status) {
        const missing = selected !== DEFAULT_THEME && applied.theme === DEFAULT_THEME;
        status.hidden = !missing;
        status.textContent = missing ? '此主題素材尚未安裝，已使用預設 UI。' : '';
      }
    }
    listeners.add(sync);
    sync();
  }

  function trackPages() {
    switchPage(document.querySelector('[data-tab].active')?.dataset.tab ?? 'hunt');
  }

  document.addEventListener('click', (event) => {
    const tab = event.target?.closest?.('[data-tab]');
    if (tab) switchPage(tab.dataset.tab);
  });
  document.addEventListener('DOMContentLoaded', () => {
    renderSelector();
    trackPages();
  });

  window.GhostIslandUiTheme = Object.freeze({
    storageKey, rotationKey, DEFAULT_THEME, themes,
    resolveTheme, accessible, assetUrl, select, switchPage,
    current: () => ({ ...applied }),
    setEntitlements(list) {
      entitlements = new Set(list ?? []);
      apply(selected);
    },
  });
})();
