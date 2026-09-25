(() => {
  // Second-level tabs inside a main panel (掛機 監控/設定, 系統設定 categories).
  // A bar [data-subtabs] switches its sibling [data-subtab-group] elements.
  function select(bar, name) {
    const panel = bar.parentElement;
    for (const button of bar.querySelectorAll('[data-subtab]')) {
      const active = button.dataset.subtab === name;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    }
    for (const group of panel.querySelectorAll(':scope > [data-subtab-group]'))
      group.hidden = group.dataset.subtabGroup !== name;
    bar.dataset.activeSubtab = name;
  }

  function reset(bar) {
    const first = bar.querySelector('[data-subtab]');
    if (first) select(bar, first.dataset.subtab);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const bars = [...document.querySelectorAll('[data-subtabs]')];
    for (const bar of bars) {
      reset(bar);
      bar.addEventListener('click', (event) => {
        const button = event.target.closest('[data-subtab]');
        if (button && bar.contains(button)) select(bar, button.dataset.subtab);
      });
    }
    // Entering 掛機 from the main navigation always opens 監控.
    document.querySelector('[data-tab="hunt"]')?.addEventListener('click', () => {
      const bar = document.querySelector('[data-subtabs="hunt"]');
      if (bar) reset(bar);
    });
  });

  window.GhostIslandPanelSubtabs = Object.freeze({ select });
})();