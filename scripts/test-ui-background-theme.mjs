import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const source = await read('ops/ro-stack/dashboard/ui-background-theme.js');
const css = await read('ops/ro-stack/dashboard/ui-background-theme.css');
const html = await read('ops/ro-stack/dashboard/index.html');
const manifest = JSON.parse(await read('docs/project-control/ui-background-themes-manifest-v1.json'));

function boot(stored, { imageFails = false } = {}) {
  const storage = new Map(stored == null ? [] : [['ghost-island.ui-background-theme.v1', stored]]);
  const style = new Map();
  const probes = [];
  const root = { dataset: {}, style: {
    setProperty: (name, value) => style.set(name, value), removeProperty: (name) => style.delete(name),
  } };
  class Image {
    set src(value) {
      probes.push(value);
      if (imageFails) this.onerror?.();
    }
  }
  const window = {};
  runInNewContext(source, {
    window, Image, document: { documentElement: root, addEventListener() {} },
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
  });
  return { api: window.GhostIslandUiBackgroundTheme, root, style, storage, probes };
}

test('default theme is preserved until the player chooses another theme', () => {
  const fresh = boot(null);
  assert.equal(fresh.root.dataset.uiBgTheme, 'default');
  assert.equal(fresh.style.size, 0);
  assert.equal(fresh.probes.length, 0);
  assert.equal(fresh.storage.size, 0);
  assert.equal(boot('unknown-theme').root.dataset.uiBgTheme, 'default');
});

test('choosing a heroine theme persists it and applies versioned global variables', () => {
  const session = boot(null);
  session.api.select('heroine-eris');
  assert.equal(session.storage.get(session.api.storageKey), 'heroine-eris');
  assert.equal(session.root.dataset.uiBgTheme, 'heroine-eris');
  assert.match(session.style.get('--ui-bg-wide'), /\/assets\/ui-themes\/heroine-eris\/background-wide\.webp\?v=[0-9a-f]{8}/);
  const reloaded = boot('heroine-eris');
  assert.equal(reloaded.root.dataset.uiBgTheme, 'heroine-eris');
  reloaded.api.select('default');
  assert.equal(reloaded.style.size, 0);
});

test('missing private assets fall back to the current theme', () => {
  const session = boot('heroine-roxy', { imageFails: true });
  assert.equal(session.probes.length, 1);
  assert.equal(session.root.dataset.uiBgTheme, 'default');
  assert.equal(session.style.size, 0);
});

test('non-open access tiers require an entitlement', () => {
  const { api } = boot(null);
  const supporter = { id: 'x', access: 'SUPPORTER', entitlement: 'ui-theme:x' };
  assert.equal(api.accessible(supporter, new Set()), false);
  assert.equal(api.accessible(supporter, new Set(['ui-theme:x'])), true);
  assert.ok(api.themes.every((theme) => theme.access === 'OPEN'));
});

test('page policy allows safe downgrade through one global hook', () => {
  const { api, root } = boot(null);
  assert.equal(api.pageLevel('system'), 'full');
  assert.equal(api.pageLevel('hunt'), 'soft');
  assert.equal(api.pageLevel('world-map'), 'bar-only');
  api.setPage('hunt');
  assert.equal(root.dataset.uiBgLevel, 'soft');
});

test('registry matches the asset manifest and asset hashes', () => {
  const { api } = boot(null);
  const heroines = api.themes.filter((theme) => theme.id !== 'default');
  assert.deepEqual([...heroines.map((theme) => theme.id)], manifest.themes.map((theme) => theme.id));
  for (const theme of manifest.themes) {
    const entry = heroines.find((item) => item.id === theme.id);
    assert.equal(entry.label, theme.heroine);
    for (const kind of ['wide', 'tall', 'thumb'])
      assert.equal(entry.versions[kind], theme.outputs[kind].sha256.slice(0, 8));
    assert.match(theme.source.sha256, /^[0-9a-f]{64}$/);
  }
});

test('image layer stays behind content and never restyles windows or controls', () => {
  const layer = css.slice(css.indexOf('body::before {'), css.indexOf('}', css.indexOf('body::before {')));
  assert.match(layer, /z-index: -1/);
  assert.match(layer, /pointer-events: none/);
  assert.match(layer, /position: fixed/);
  const selectors = css.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+(?=\{)/g).join(',');
  assert.doesNotMatch(selectors, /\.window\b|\.panel\b|\bbutton\b|\binput\b|\bselect\b|\.tabs\b/);
  assert.match(css, /#game \.titlebar[\s\S]*rgb\(155 176 201 \/ 86%\)/);
});

test('settings page and every page load the theme hook; private assets stay out of Git', () => {
  assert.match(html, /<script src="\/ui-background-theme\.js/);
  assert.match(html, /<link rel="stylesheet" href="\/ui-background-theme\.css/);
  assert.match(html, /id="uiBackgroundTheme"[^>]*role="radiogroup"/);
  const cwd = new URL('.', root);
  assert.equal(manifest.public_git_binary, false);
  execFileSync('git', ['check-ignore', '-q', 'ops/ro-stack/dashboard/assets/ui-themes/heroine-roxy/thumb.webp'], { cwd });
  assert.equal(execFileSync('git', ['ls-files', 'ops/ro-stack/dashboard/assets/ui-themes'], { cwd, encoding: 'utf8' }), '');
});
