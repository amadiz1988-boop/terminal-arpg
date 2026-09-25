import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const source = await read('ops/ro-stack/dashboard/ui-theme.js');
const css = await read('ops/ro-stack/dashboard/ui-theme.css');
const floorCss = await read('ops/ro-stack/dashboard/ro-floor-theme.css');
const html = await read('ops/ro-stack/dashboard/index.html');
const manifest = JSON.parse(await read('docs/project-control/ui-themes-manifest-v1.json'));
const KEY = 'ghost-island.ui-theme.v1';

function boot(stored, { imageFails = () => false, storage: shared } = {}) {
  const storage = shared ?? new Map(stored == null ? [] : [[KEY, stored]]);
  const style = new Map();
  const probes = [];
  const listeners = {};
  const root = { dataset: {}, style: {
    setProperty: (name, value) => style.set(name, value), removeProperty: (name) => style.delete(name),
  } };
  class Image {
    set src(value) {
      probes.push(value);
      if (imageFails(value)) this.onerror?.();
    }
  }
  const window = {};
  runInNewContext(source, {
    window, Image, document: {
      documentElement: root,
      addEventListener: (type, listener) => { listeners[type] = listener; },
      querySelector: () => ({ dataset: { tab: 'hunt' } }),
      getElementById: () => null,
    },
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
  });
  const clickTab = (tab) => listeners.click({ target: { closest: () => ({ dataset: { tab } }) } });
  listeners.DOMContentLoaded?.();
  return { api: window.GhostIslandUiTheme, root, style, storage, probes, clickTab };
}

test('default UI is preserved until the player chooses a theme', () => {
  const fresh = boot(null);
  assert.equal(fresh.root.dataset.uiTheme, 'default');
  assert.equal(fresh.style.size, 0);
  assert.equal(fresh.probes.length, 0);
  assert.equal(boot('unknown-theme').root.dataset.uiTheme, 'default');
});

test('a chosen theme persists and sets title bar colours plus window art', () => {
  const session = boot(null);
  session.api.select('heroine-eris');
  assert.equal(session.storage.get(KEY), 'heroine-eris');
  assert.match(session.style.get('--ui-theme-panel'), /\/assets\/ui-themes\/heroine-eris\/eris-0\d\/panel\.webp\?v=[0-9a-f]{8}/);
  const eris = manifest.themes.find((theme) => theme.id === 'heroine-eris');
  assert.equal(session.style.get('--ui-theme-bar-top'), eris.title_bar.top);
  assert.equal(session.style.get('--ui-theme-bar-bottom'), eris.title_bar.bottom);
  assert.equal(boot('heroine-eris').root.dataset.uiTheme, 'heroine-eris');
  session.api.select('default');
  assert.equal(session.style.size, 0);
});

test('missing private assets skip one image, then fall back to the default UI', () => {
  const skipped = boot('heroine-roxy', { imageFails: (url) => url.includes('/roxy-01/') });
  assert.equal(skipped.root.dataset.uiThemeVariant, 'roxy-02');
  const missing = boot('heroine-roxy', { imageFails: () => true });
  assert.equal(missing.root.dataset.uiTheme, 'default');
  assert.equal(missing.style.size, 0);
});

test('every visit shows the next image of the theme', () => {
  const storage = new Map([[KEY, 'heroine-sylphie']]);
  const shown = Array.from({ length: 8 }, () => boot(null, { storage }).root.dataset.uiThemeVariant);
  assert.deepEqual(shown, ['sylphie-01', 'sylphie-02', 'sylphie-03', 'sylphie-04',
    'sylphie-05', 'sylphie-06', 'sylphie-07', 'sylphie-01']);
});

test('every page switch shows the next image; reopening the same tab does not', () => {
  const session = boot('heroine-eris');
  assert.equal(session.root.dataset.uiThemeVariant, 'eris-01');
  session.clickTab('system');
  assert.equal(session.root.dataset.uiThemeVariant, 'eris-02');
  session.clickTab('system');
  assert.equal(session.root.dataset.uiThemeVariant, 'eris-02');
  session.clickTab('hunt');
  session.clickTab('quests');
  assert.equal(session.root.dataset.uiThemeVariant, 'eris-01');
  const plain = boot(null);
  plain.clickTab('system');
  assert.equal(plain.root.dataset.uiTheme, 'default');
  assert.equal(plain.probes.length, 0);
});

test('the red dress theme is labelled 妓神 and no image picker is shown', () => {
  const { api } = boot(null);
  assert.equal(api.themes.find((theme) => theme.id === 'heroine-red-dress').label, '妓神');
  assert.doesNotMatch(html, /uiThemeVariants/);
  assert.doesNotMatch(source, /selectVariant|ui-theme-variant\.v1/);
});

test('non-open access tiers require an entitlement', () => {
  const { api } = boot(null);
  const supporter = { id: 'x', access: 'SUPPORTER', entitlement: 'ui-theme:x' };
  assert.equal(api.accessible(supporter, new Set()), false);
  assert.equal(api.accessible(supporter, new Set(['ui-theme:x'])), true);
  assert.ok(api.themes.every((theme) => theme.access === 'OPEN'));
});

test('registry uses all 16 manifest images with matching hashes and colours', () => {
  const { api } = boot(null);
  const heroines = api.themes.filter((theme) => theme.id !== 'default');
  assert.deepEqual([...heroines.map((theme) => theme.id)], manifest.themes.map((theme) => theme.id));
  let count = 0;
  for (const theme of manifest.themes) {
    const entry = heroines.find((item) => item.id === theme.id);
    assert.equal(entry.label, theme.heroine);
    assert.equal(entry.titleBar.bottom, theme.title_bar.bottom);
    assert.deepEqual([...entry.variants.map((variant) => variant.key)], theme.variants.map((variant) => variant.key));
    for (const variant of theme.variants) {
      const registered = entry.variants.find((item) => item.key === variant.key);
      for (const kind of ['panel', 'thumb'])
        assert.equal(registered.versions[kind], variant.outputs[kind].sha256.slice(0, 8));
      count++;
    }
  }
  const sources = new Set(manifest.themes.flatMap((theme) => theme.variants.map((variant) => variant.source.sha256)));
  assert.equal(sources.size, count);
  assert.equal(count, 16);
});

test('theme only styles the listed windows and leaves the page floor alone', () => {
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = rules.match(/[^{}]+(?=\{)/g).map((selector) => selector.trim());
  assert.ok(selectors.every((selector) => !/^body\b|^\.auth\b|::before|::after/.test(selector)));
  assert.doesNotMatch(rules, /ro-floor|--ro-floor/);
  for (const surface of ["#game > .window[data-pet-anchor='character-summary']", '#game > .social-window',
    '#hunt > .window:not(.map-window, .combat-window)', '#system > .window', '.combat-window .console'])
    assert.ok(rules.includes(surface), surface);
  assert.match(rules, /#game \.titlebar \{\s*background: linear-gradient\(var\(--ui-theme-bar-top\), var\(--ui-theme-bar-bottom\)\)/);
  assert.match(floorCss, /body,\s*\.auth \{/);
});

test('text stays on a strong veil: left side at least 90% opaque', () => {
  const veils = [...css.matchAll(/linear-gradient\(90deg, rgb\(([\d ]+) \/ (\d+)%\) 0%, rgb\([\d ]+ \/ (\d+)%\)/g)];
  assert.ok(veils.length >= 4);
  for (const [, , start, middle] of veils) {
    assert.ok(Number(start) >= 94);
    assert.ok(Number(middle) >= 90);
  }
});

test('UI theme has its own settings window, separate from the floor setting', () => {
  assert.match(html, /<script src="\/ui-theme\.js/);
  assert.match(html, /<link rel="stylesheet" href="\/ui-theme\.css/);
  const themeWindow = html.indexOf('<span>UI 主題</span>');
  const floorWindow = html.indexOf('<span>背景設定</span>');
  assert.ok(themeWindow > 0 && floorWindow > themeWindow);
  const between = html.slice(themeWindow, floorWindow);
  assert.match(between, /id="uiTheme"[^>]*role="radiogroup"/);
  assert.doesNotMatch(between, /roFloorTheme/);
});

test('private assets stay out of Git', () => {
  const cwd = new URL('.', root);
  assert.equal(manifest.public_git_binary, false);
  execFileSync('git', ['check-ignore', '-q', 'ops/ro-stack/dashboard/assets/ui-themes/heroine-roxy/roxy-01/panel.webp'], { cwd });
  assert.equal(execFileSync('git', ['ls-files', 'ops/ro-stack/dashboard/assets/ui-themes'], { cwd, encoding: 'utf8' }), '');
});
