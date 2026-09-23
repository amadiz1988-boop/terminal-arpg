(() => {
  const storageKey = 'ghost-island.ro-floor-theme.v1';
  const defaultTheme = 'prontera-stone';
  const themes = [
    [defaultTheme, '普隆德拉白色鵝卵石 (prt_city_bot01)'],
    ['prt-bot01', '紅灰格紋石板 (prt_bot01)'],
    ['prt-bot03', '紅色地毯 (prt_bot03)'],
    ['prt-bot04', '方形石板 (prt_bot04)'],
    ['prt-bot06', '木紋地板 (prt_bot06)'],
    ['prt-city-bot02', '城內方石 (prt_city_bot02)'],
    ['prt-city-bot03', '青苔方石 (prt_city_bot03)'],
    ['prt-city-bot04', '徽章石地 (prt_city_bot04)'],
    ['prt-city-bot05', '青苔鵝卵石 (prt_city_bot05)'],
    ['prt-pr-bottom01', '深色鵝卵石 (prt_pr_bottom01)'],
  ];
  const supportedThemes = new Set(themes.map(([id]) => id));

  let theme = defaultTheme;
  try {
    const stored = localStorage.getItem(storageKey);
    if (supportedThemes.has(stored)) theme = stored;
  } catch {}
  document.documentElement.dataset.roFloorTheme = theme;

  document.addEventListener('DOMContentLoaded', () => {
    const selector = document.getElementById('roFloorTheme');
    if (!selector) return;
    selector.replaceChildren(...themes.map(([id, label]) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = label;
      return option;
    }));
    selector.value = theme;
    const settings = selector.closest('.floor-theme-settings');
    if (settings && !settings.querySelector('.ro-floor-theme-preview')) {
      const preview = document.createElement('div');
      preview.className = 'ro-floor-theme-preview';
      preview.setAttribute('role', 'img');
      preview.setAttribute('aria-label', '目前所選地板圖樣預覽');
      settings.appendChild(preview);
    }
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
