(() => {
  const storageKey = 'ghost-island.ro-floor-theme.v1';
  const defaultTheme = 'prontera-stone';
  const supportedThemes = new Set([
    defaultTheme,
    'field-grass',
    'morocc-sand',
    'legacy-green',
  ]);

  let theme = defaultTheme;
  try {
    const stored = localStorage.getItem(storageKey);
    if (supportedThemes.has(stored)) theme = stored;
  } catch {}
  document.documentElement.dataset.roFloorTheme = theme;

  document.addEventListener('DOMContentLoaded', () => {
    const selector = document.getElementById('roFloorTheme');
    if (!selector) return;
    selector.value = theme;
    selector.addEventListener('change', () => {
      const selected = selector.value;
      if (!supportedThemes.has(selected)) return;
      document.documentElement.dataset.roFloorTheme = selected;
      try {
        localStorage.setItem(storageKey, selected);
      } catch {}
    });
  });
})();
