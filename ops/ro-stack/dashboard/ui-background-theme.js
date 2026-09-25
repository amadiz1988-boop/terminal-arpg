(() => {
  // UI background themes are an atmosphere layer behind the existing RO UI.
  // Canonical rules: docs/project-control/ui-background-theme-system-v1.md
  const storageKey = 'ghost-island.ui-background-theme.v1';
  const DEFAULT_THEME = 'default';
  const ASSET_ROOT = '/assets/ui-themes';
  const LEVELS = ['full', 'soft', 'bar-only'];
  // Per-page safe downgrade. Pages not listed use the default level.
  const pagePolicy = Object.freeze({ default: 'full', hunt: 'soft', 'world-map': 'bar-only' });
  const themes = Object.freeze([
    { id: DEFAULT_THEME, label: '目前主題', access: 'OPEN', entitlement: null },
    { id: 'heroine-roxy', label: '洛琪希', series: '無職轉生', access: 'OPEN', entitlement: null,
      tint: '#4f6b58', versions: { wide: '7cbdd040', tall: '145f9552', thumb: 'db2bbb27' } },
    { id: 'heroine-eris', label: '艾莉絲', series: '無職轉生', access: 'OPEN', entitlement: null,
      tint: '#4a3a36', versions: { wide: '7960a6b5', tall: '4f7a8003', thumb: '5f7cc4c3' } },
    { id: 'heroine-sylphie', label: '西露菲', series: '無職轉生', access: 'OPEN', entitlement: null,
      tint: '#5d7250', versions: { wide: '065b80c5', tall: 'aabc3b2c', thumb: '21cc8d4d' } },
    { id: 'heroine-red-dress', label: '紅衣短髮女', series: '無職轉生', access: 'OPEN',
      entitlement: null, tint: '#6d4a4f',
      versions: { wide: '76919336', tall: 'f34ff160', thumb: '12914d1a' } },
  ].map(Object.freeze));
  const byId = new Map(themes.map((theme) => [theme.id, theme]));
  const unavailable = new Set();
  let entitlements = new Set();

  const assetUrl = (theme, kind) => {
    const file = { wide: 'background-wide.webp', tall: 'background-tall.webp',
      thumb: 'thumb.webp' }[kind];
    return `${ASSET_ROOT}/${theme.id}/${file}?v=${theme.versions[kind]}`;
  };
  // OPEN themes are free for every player; other access tiers (for example a
  // future supporter reward) require a server-provided entitlement.
  const accessible = (theme, owned = entitlements) =>
    theme.access === 'OPEN' || (theme.entitlement != null && owned.has(theme.entitlement));
  const resolveTheme = (requested, owned = entitlements) => {
    const theme = byId.get(requested);
    return theme && accessible(theme, owned) && !unavailable.has(theme.id)
      ? theme.id : DEFAULT_THEME;
  };
  const pageLevel = (page) => {
    const level = pagePolicy[page] ?? pagePolicy.default;
    return LEVELS.includes(level) ? level : 'full';
  };

  const root = document.documentElement;
  let selected = DEFAULT_THEME;
  let applied = DEFAULT_THEME;
  const listeners = new Set();

  function paint(id) {
    const theme = byId.get(id);
    applied = id;
    root.dataset.uiBgTheme = id;
    if (id === DEFAULT_THEME) {
      for (const name of ['--ui-bg-wide', '--ui-bg-tall', '--ui-bg-tint'])
        root.style.removeProperty(name);
    } else {
      root.style.setProperty('--ui-bg-wide', `url('${assetUrl(theme, 'wide')}')`);
      root.style.setProperty('--ui-bg-tall', `url('${assetUrl(theme, 'tall')}')`);
      root.style.setProperty('--ui-bg-tint', theme.tint);
    }
    listeners.forEach((listener) => listener());
  }

  function apply(requested) {
    const id = resolveTheme(requested);
    paint(id);
    if (id === DEFAULT_THEME || typeof Image !== 'function') return id;
    // Missing private assets fall back to the current theme instead of a broken layer.
    const probe = new Image();
    probe.onerror = () => {
      unavailable.add(id);
      if (applied === id) paint(DEFAULT_THEME);
    };
    probe.src = assetUrl(byId.get(id), 'wide');
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

  function setPage(page) {
    root.dataset.uiBgPage = page;
    root.dataset.uiBgLevel = pageLevel(page);
  }

  try {
    selected = localStorage.getItem(storageKey) ?? DEFAULT_THEME;
  } catch {}
  apply(selected);
  setPage('default');

  function renderSelector() {
    const container = document.getElementById('uiBackgroundTheme');
    if (!container) return;
    const status = document.getElementById('uiBackgroundThemeStatus');
    const cards = themes.filter((theme) => accessible(theme)).map((theme) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'ui-background-theme-card';
      card.dataset.themeId = theme.id;
      card.setAttribute('role', 'radio');
      card.title = theme.series ? `${theme.series}・${theme.label}` : theme.label;
      const preview = document.createElement(theme.id === DEFAULT_THEME ? 'span' : 'img');
      preview.className = 'ui-background-theme-thumb';
      if (theme.id !== DEFAULT_THEME) {
        preview.alt = '';
        preview.loading = 'lazy';
        preview.decoding = 'async';
        preview.src = assetUrl(theme, 'thumb');
        preview.addEventListener('error', () => {
          unavailable.add(theme.id);
          sync();
        });
      }
      const label = document.createElement('span');
      label.className = 'ui-background-theme-label';
      label.textContent = theme.label;
      card.append(preview, label);
      card.addEventListener('click', () => select(theme.id));
      return card;
    });
    container.replaceChildren(...cards);
    function sync() {
      for (const card of cards) {
        const id = card.dataset.themeId;
        const missing = unavailable.has(id);
        card.disabled = missing;
        card.setAttribute('aria-checked', String(id === applied));
        card.classList.toggle('is-selected', id === applied);
      }
      if (status) {
        const missing = unavailable.has(selected) && selected !== DEFAULT_THEME;
        status.hidden = !missing;
        status.textContent = missing ? '此主題素材尚未安裝，已使用目前主題。' : '';
      }
    }
    listeners.add(sync);
    sync();
  }

  function trackPages() {
    const activeTab = document.querySelector('[data-tab].active');
    if (activeTab) setPage(activeTab.dataset.tab);
    document.addEventListener('click', (event) => {
      const tab = event.target?.closest?.('[data-tab]');
      if (tab) setPage(tab.dataset.tab);
    });
    if (typeof MutationObserver === 'function' && document.body) {
      new MutationObserver(() => {
        if (document.body.classList.contains('world-map-open')) setPage('world-map');
        else if (root.dataset.uiBgPage === 'world-map')
          setPage(document.querySelector('[data-tab].active')?.dataset.tab ?? 'default');
      }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderSelector();
    trackPages();
  });

  window.GhostIslandUiBackgroundTheme = Object.freeze({
    storageKey, DEFAULT_THEME, themes, pagePolicy, resolveTheme, pageLevel, accessible,
    assetUrl, select, setPage,
    current: () => applied,
    setEntitlements(list) {
      entitlements = new Set(list ?? []);
      apply(selected);
    },
  });
})();

