(() => {
  // UI background themes are an atmosphere layer behind the existing RO UI.
  // Canonical rules: docs/project-control/ui-background-theme-system-v1.md
  const storageKey = 'ghost-island.ui-background-theme.v1';
  const variantKey = 'ghost-island.ui-background-theme-variant.v1';
  const rotationKey = 'ghost-island.ui-background-theme-rotation.v1';
  const DEFAULT_THEME = 'default';
  const AUTO = 'auto';
  const ASSET_ROOT = '/assets/ui-themes';
  const FILES = { wide: 'background-wide.webp', tall: 'background-tall.webp', thumb: 'thumb.webp' };
  const LEVELS = ['full', 'soft', 'bar-only'];
  // Per-page safe downgrade. Pages not listed use the default level.
  const pagePolicy = Object.freeze({ default: 'full', hunt: 'soft', 'world-map': 'bar-only' });
  const deepFreeze = (value) => {
    Object.values(value).forEach((child) => child && typeof child === 'object' && deepFreeze(child));
    return Object.freeze(value);
  };
  const themes = deepFreeze([
    { id: DEFAULT_THEME, label: '目前主題', access: 'OPEN', entitlement: null, variants: [] },
    { id: 'heroine-roxy', label: '洛琪希', series: '無職轉生', access: 'OPEN', entitlement: null,
      tint: '#3f4f5e', variants: [
        { key: 'roxy-01', versions: { wide: '7cbdd040', tall: '731d7fc9', thumb: 'db2bbb27' } },
        { key: 'roxy-02', versions: { wide: '1bcef72b', tall: 'c6135013', thumb: 'd70b487a' } },
      ] },
    { id: 'heroine-eris', label: '艾莉絲', series: '無職轉生', access: 'OPEN', entitlement: null,
      tint: '#4a3a36', variants: [
        { key: 'eris-01', versions: { wide: '7960a6b5', tall: 'addec35e', thumb: '5f7cc4c3' } },
        { key: 'eris-02', versions: { wide: 'fa9e9229', tall: 'da978adb', thumb: '5fc915ec' } },
        { key: 'eris-03', versions: { wide: '472c3e4d', tall: '98262e31', thumb: '39409adf' } },
      ] },
    { id: 'heroine-sylphie', label: '西露菲', series: '無職轉生', access: 'OPEN', entitlement: null,
      tint: '#5d7250', variants: [
        { key: 'sylphie-01', versions: { wide: '065b80c5', tall: '54a5b0fb', thumb: '21cc8d4d' } },
        { key: 'sylphie-02', versions: { wide: '31f5f082', tall: 'e2d07281', thumb: 'f735e5a2' } },
        { key: 'sylphie-03', versions: { wide: 'e05cf573', tall: '89e33b76', thumb: 'ddb656e5' } },
        { key: 'sylphie-04', versions: { wide: '73e1eb79', tall: '4848b1d9', thumb: 'd224e902' } },
        { key: 'sylphie-05', versions: { wide: '80e98776', tall: '75ba65d4', thumb: '5e551227' } },
        { key: 'sylphie-06', versions: { wide: '0121631e', tall: '9cab633d', thumb: '0c514397' } },
        { key: 'sylphie-07', versions: { wide: '9fe61c71', tall: 'f5d5a990', thumb: '3f629a0f' } },
      ] },
    { id: 'heroine-red-dress', label: '紅衣短髮女', series: '無職轉生', access: 'OPEN', entitlement: null,
      tint: '#6d4a4f', variants: [
        { key: 'red-01', versions: { wide: '76919336', tall: 'c7c66725', thumb: '12914d1a' } },
        { key: 'red-02', versions: { wide: 'f0cf8d0b', tall: 'caf7225a', thumb: 'f89e2c22' } },
        { key: 'red-03', versions: { wide: 'acd9b1f8', tall: '6ee0f77d', thumb: 'de749337' } },
        { key: 'red-04', versions: { wide: '80f17acb', tall: '08ef9617', thumb: '932760c4' } },
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
  const variantPreference = (themeId) => {
    const preference = readJson(variantKey)[themeId];
    const theme = byId.get(themeId);
    return theme?.variants.some((variant) => variant.key === preference) ? preference : AUTO;
  };
  // AUTO shows the next image of the theme on every visit; a pinned key stays fixed.
  const pickVariant = (theme, advance) => {
    const usable = usableVariants(theme);
    const pinned = usable.find((variant) => variant.key === variantPreference(theme.id));
    if (pinned) return pinned;
    const rotation = readJson(rotationKey);
    const last = usable.findIndex((variant) => variant.key === rotation[theme.id]);
    const next = usable[advance ? (last + 1) % usable.length : Math.max(last, 0)];
    rotation[theme.id] = next.key;
    writeJson(rotationKey, rotation);
    return next;
  };
  const pageLevel = (page) => {
    const level = pagePolicy[page] ?? pagePolicy.default;
    return LEVELS.includes(level) ? level : 'full';
  };

  const root = document.documentElement;
  let selected = DEFAULT_THEME;
  let applied = { theme: DEFAULT_THEME, variant: null };
  const listeners = new Set();

  function paint(themeId, variant) {
    const theme = byId.get(themeId);
    applied = { theme: themeId, variant: variant?.key ?? null };
    root.dataset.uiBgTheme = themeId;
    if (!variant) {
      delete root.dataset.uiBgVariant;
      for (const name of ['--ui-bg-wide', '--ui-bg-tall', '--ui-bg-tint'])
        root.style.removeProperty(name);
    } else {
      root.dataset.uiBgVariant = variant.key;
      root.style.setProperty('--ui-bg-wide', `url('${assetUrl(theme, variant, 'wide')}')`);
      root.style.setProperty('--ui-bg-tall', `url('${assetUrl(theme, variant, 'tall')}')`);
      root.style.setProperty('--ui-bg-tint', theme.tint);
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
    // Missing private assets skip to another image, then to the current theme.
    const probe = new Image();
    probe.onerror = () => {
      unavailable.add(`${id}/${variant.key}`);
      if (applied.theme === id && applied.variant === variant.key) apply(selected);
    };
    probe.src = assetUrl(theme, variant, 'wide');
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

  function selectVariant(themeId, key) {
    const preferences = readJson(variantKey);
    preferences[themeId] = key;
    writeJson(variantKey, preferences);
    if (key !== AUTO) {
      const rotation = readJson(rotationKey);
      rotation[themeId] = key;
      writeJson(rotationKey, rotation);
    }
    return select(themeId);
  }

  function setPage(page) {
    root.dataset.uiBgPage = page;
    root.dataset.uiBgLevel = pageLevel(page);
  }

  try {
    selected = localStorage.getItem(storageKey) ?? DEFAULT_THEME;
  } catch {}
  apply(selected, true);
  setPage('default');

  function card(className, label, title, thumb, onError, onClick) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = className;
    element.setAttribute('role', 'radio');
    element.title = title;
    const preview = document.createElement(thumb ? 'img' : 'span');
    preview.className = 'ui-background-theme-thumb';
    if (thumb) {
      preview.alt = '';
      preview.loading = 'lazy';
      preview.decoding = 'async';
      preview.src = thumb;
      preview.addEventListener('error', onError);
    }
    const text = document.createElement('span');
    text.className = 'ui-background-theme-label';
    text.textContent = label;
    element.append(preview, text);
    element.addEventListener('click', onClick);
    return element;
  }

  function renderSelector() {
    const container = document.getElementById('uiBackgroundTheme');
    if (!container) return;
    const variantsContainer = document.getElementById('uiBackgroundThemeVariants');
    const status = document.getElementById('uiBackgroundThemeStatus');
    const themeCards = themes.filter((theme) => accessible(theme)).map((theme) => {
      const element = card('ui-background-theme-card', theme.label,
        theme.series ? `${theme.series}・${theme.label}` : theme.label,
        theme.variants[0] && assetUrl(theme, theme.variants[0], 'thumb'),
        () => {
          theme.variants.forEach((variant) => unavailable.add(`${theme.id}/${variant.key}`));
          sync();
        },
        () => select(theme.id));
      element.dataset.themeId = theme.id;
      return element;
    });
    container.replaceChildren(...themeCards);
    let renderedVariantsFor = null;
    function renderVariants() {
      if (!variantsContainer || renderedVariantsFor === applied.theme) return;
      renderedVariantsFor = applied.theme;
      const theme = byId.get(applied.theme);
      variantsContainer.hidden = !theme || theme.id === DEFAULT_THEME;
      if (variantsContainer.hidden) {
        variantsContainer.replaceChildren();
        return;
      }
      const auto = card('ui-background-theme-card ui-background-theme-variant', '輪換',
        '每次進入遊戲換一張', null, null, () => selectVariant(theme.id, AUTO));
      auto.dataset.variantKey = AUTO;
      const mosaic = theme.variants.slice(0, 4);
      const tiles = auto.querySelector('.ui-background-theme-thumb');
      tiles.classList.add('is-rotate');
      tiles.style.backgroundImage = mosaic
        .map((variant) => `url('${assetUrl(theme, variant, 'thumb')}')`).join(',');
      tiles.style.backgroundPosition = ['0 0', '100% 0', '0 100%', '100% 100%']
        .slice(0, mosaic.length).join(',');
      const variantCards = theme.variants.map((variant, index) => {
        const element = card('ui-background-theme-card ui-background-theme-variant',
          String(index + 1), `${theme.label} ${index + 1}`, assetUrl(theme, variant, 'thumb'),
          () => {
            unavailable.add(`${theme.id}/${variant.key}`);
            sync();
          },
          () => selectVariant(theme.id, variant.key));
        element.dataset.variantKey = variant.key;
        return element;
      });
      variantsContainer.replaceChildren(auto, ...variantCards);
    }
    function sync() {
      for (const element of themeCards) {
        const theme = byId.get(element.dataset.themeId);
        const checked = theme.id === applied.theme;
        element.disabled = theme.id !== DEFAULT_THEME && usableVariants(theme).length === 0;
        element.setAttribute('aria-checked', String(checked));
        element.classList.toggle('is-selected', checked);
      }
      renderVariants();
      const preference = variantPreference(applied.theme);
      for (const element of variantsContainer?.children ?? []) {
        const key = element.dataset.variantKey;
        const checked = key === preference;
        element.disabled = key !== AUTO && unavailable.has(`${applied.theme}/${key}`);
        element.setAttribute('aria-checked', String(checked));
        element.classList.toggle('is-selected', checked);
        element.classList.toggle('is-showing', key === applied.variant);
      }
      if (status) {
        const missing = selected !== DEFAULT_THEME && applied.theme === DEFAULT_THEME;
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
    storageKey, variantKey, rotationKey, DEFAULT_THEME, AUTO, themes, pagePolicy,
    resolveTheme, pageLevel, accessible, assetUrl, select, selectVariant, setPage,
    current: () => ({ ...applied }),
    setEntitlements(list) {
      entitlements = new Set(list ?? []);
      apply(selected);
    },
  });
})();
