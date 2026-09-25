import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { CONFIG_SECTIONS } from '../ops/ro-stack/dashboard/config-capabilities.mjs';
import { CONFIG_SETTING_TABS, settingTabForSection } from '../ops/ro-stack/dashboard/config-setting-tabs.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const html = await read('ops/ro-stack/dashboard/index.html');
const app = await read('ops/ro-stack/dashboard/app.js');

function panel(id) {
  const start = html.indexOf(`<section id="${id}" class="panel`);
  assert.ok(start >= 0, `panel ${id} exists`);
  const end = html.indexOf('<section id="', start + 20);
  return html.slice(start, end < 0 ? undefined : end);
}
const hunt = panel('hunt');
const system = panel('system');
const tabs = (block, name) => [...block.matchAll(/data-subtab="([^"]+)">([^<]+)</g)]
  .filter((match) => block.indexOf(`data-subtabs="${name}"`) >= 0).map((match) => match[2]);
const groupOrder = (block) => [...block.matchAll(/data-subtab-group="([^"]+)"/g)].map((match) => match[1]);

test('掛機 has 監控 and 設定 subtabs with 監控 selected by default', () => {
  assert.deepEqual(tabs(hunt, 'hunt'), ['監控', '設定']);
  assert.match(hunt, /class="active" data-subtab="monitor"/);
  assert.deepEqual([...new Set(groupOrder(hunt))], ['monitor', 'settings']);
});

test('monitor order is LOG, merged statistics, minimap last', () => {
  const log = hunt.indexOf('id="log"');
  const stats = hunt.indexOf('本次掛機統計');
  const map = hunt.indexOf('id="minimap"');
  const settings = hunt.indexOf('data-subtab-group="settings"');
  assert.ok(log > 0 && log < stats && stats < map && map < settings);
});

test('LOG header carries the three existing actions under new labels', () => {
  const bar = hunt.slice(hunt.indexOf('log-action-bar'), hunt.indexOf('id="log"'));
  const labels = [...bar.matchAll(/<button id="(start|stop|openWorldMap)"[^>]*>([^<]+)</g)]
    .map((match) => [match[1], match[2]]);
  assert.deepEqual(labels, [['start', '玩家狩獵'], ['stop', '角色自主'], ['openWorldMap', '彩虹橋']]);
  assert.match(app, /\$\('#start'\)\.textContent = '玩家狩獵'/);
  assert.match(app, /\$\('#stop'\)\.textContent = '角色自主'/);
  for (const old of ['自動戰鬥控制', '開始指定掛機', '停止掛機', '更換掛機地圖', '本次掛機拾取統計'])
    assert.equal(html.includes(old) || app.includes(`'${old}'`), false, old);
});

test('each monitoring statistic element appears exactly once', () => {
  for (const id of ['status', 'grindTargetSummary', 'duration', 'kills', 'baseExpGained', 'jobExpGained',
    'itemKinds', 'lootTotal', 'deaths', 'supplyStage', 'lootSummary', 'configEditor'])
    assert.equal(html.split(`id="${id}"`).length - 1, 1, id);
});

test('every farm setting section maps to exactly one setting tab; 戰鬥 and 補給 separate', () => {
  assert.deepEqual(CONFIG_SETTING_TABS.map((tab) => tab.label),
    ['掛機', '戰鬥', '技能', 'HP/SP', '補給', '移動／翅膀', '恢復', '進階']);
  const mapped = CONFIG_SETTING_TABS.flatMap((tab) => tab.sections);
  assert.deepEqual([...mapped].sort(), [...CONFIG_SECTIONS].sort());
  assert.equal(new Set(mapped).size, mapped.length);
  assert.notEqual(settingTabForSection('戰鬥'), settingTabForSection('補給'));
});

test('system settings split into categories; each window has one group', () => {
  assert.deepEqual(tabs(system, 'system'), ['聲音', '戰鬥顯示', '介面／主題', '寵物', '帳號', '伺服器']);
  const windows = [...system.matchAll(/<div class="window"[^>]*>/g)].map((match) => match[0]);
  assert.ok(windows.length >= 7);
  for (const window of windows) assert.match(window, /data-subtab-group="[^"]+"/, window);
  const groups = new Set(groupOrder(system));
  for (const id of ['sound', 'combat-display', 'interface', 'pet', 'account', 'server']) assert.ok(groups.has(id), id);
});
