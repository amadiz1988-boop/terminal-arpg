import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';

const read = (path) => readFileSync(path, 'utf8');
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const web = 'ops/ro-stack/dashboard';
const app = read(`${web}/app.js`);
const html = read(`${web}/index.html`);
const css = read(`${web}/styles.css`);
const server = read('ops/ro-stack/dashboard.mjs');
const floorScript = read(`${web}/ro-floor-theme.js`);
const floorCss = read(`${web}/ro-floor-theme.css`);
const floorIndex = JSON.parse(read('docs/ro-floor-theme-asset-index.json'));
const layouts = JSON.parse(read(`${web}/skill-tree-layouts.json`));
const skillAssets = JSON.parse(read(`${web}/skill-ui-assets.json`));
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks += 1; };

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
check(ids.length === new Set(ids).size, 'DOM ids are unique after source integration');
for (const match of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="\/([^"?]+\.(?:js|css))(?:\?[^\"]*)?"/g))
  check(existsSync(`${web}/${match[1]}`), `missing entrypoint asset ${match[1]}`);
for (const id of [
  'skillList', 'skillResetState', 'skillNotice', 'characterResetConfirm',
  'worldMapStatus', 'worldMapSavedTown', 'roFloorTheme', 'quickAudio',
  'configEditor', 'discordLoginButton', 'discordRequiredGate',
  'discordRequiredLink', 'discordRequiredMessage',
]) check(ids.includes(id), `missing UI control ${id}`);
check(html.includes('src="/config-editor.js?v=config-v1"'),
  'M1 character configuration editor module');
check(!ids.includes('supplyForm') && !ids.includes('supplyWeight'),
  'superseded Supply fields are unavailable in the Player UI');
check(app.includes('mountCharacterConfigEditor(state.character?.charId ?? state.account?.characterId)'),
  'character configuration editor mounts for the current character');
check(app.includes("if (!$('#supplyForm')) return"),
  'Supply projection handles the canonical editor surface');
check(app.includes("if ($('#supplyForm')) $('#supplyForm').onsubmit"),
  'legacy Supply form binding is optional');
check(server.includes("url.pathname === '/api/config' && request.method === 'GET'") &&
  server.includes("url.pathname === '/api/config' && request.method === 'PUT'"),
  'M1 character configuration API is routed');
check(server.includes('function requestBody(request, maximum = 8192)') &&
  server.includes('await requestBody(request, 262144)'),
  'M1 character configuration accepts its bounded payload size');
check(server.includes('if (await discordRouteHandler(url, request, response)) return'),
  'M1 Discord auth router is present');
check(server.includes('const discord = await discordAccountAuth.view(account)') &&
  server.includes('discord.accessGate &&'),
  'M1 Discord account view and access gate are retained');
check(server.includes('CREATE TABLE IF NOT EXISTS account_external_identity') &&
  server.includes('CREATE TABLE IF NOT EXISTS web_oauth_state'),
  'M1 Discord identity and OAuth state tables are initialized');
check(app.includes('syncDiscordUi(session.discord)') &&
  app.includes("$('#discordLinkButton')?.addEventListener('click'") &&
  app.includes("$('#discordUnlinkButton')?.addEventListener('click'"),
  'M1 Discord Player controls remain wired');
check(css.includes('.discord-login-button') && css.includes('.discord-account-settings'),
  'M1 Discord controls retain their layout');
check(layouts.columns === 7 && Object.keys(layouts.jobs).length === 79,
  'original skill-tree layout contract');
check(Boolean(skillAssets.emptySlot?.dataUrl?.startsWith('data:image/png;base64,')),
  'original empty skill slot asset');
for (const path of ['/ro/data/skill-trees.json', '/skill-tree-layouts.json', '/skill-ui-assets.json'])
  check(app.includes(`fetch('${path}'`), `skill loader missing ${path}`);
for (const marker of ['skill-tree-sections', 'skill-tree-node', 'skill-tree-controls', 'skillDetailDialog'])
  check(app.includes(marker), `skill control missing ${marker}`);
check(server.includes("const base = isPublic ? publicRoot : webRoot"),
  'dashboard serves Web JSON from its source directory');

const originalSounds = {
  uiOriginalButton: ['ui_button_original.wav', '9750cba0bccc3785731f721ffb05e86cc95f420758152c9caac0fd495b86ad38'],
  uiOriginalCancel: ['ui_cancel_original.wav', '3c26b38001616deec19d998874bf8a998fed255e9e31608403a7fdda5f749330'],
};
for (const [key, [filename, expectedHash]] of Object.entries(originalSounds)) {
  check(app.includes(`${key}: \`\${officialCombatSoundRoot}/${filename}\``),
    `original sound mapping missing ${key}`);
  check(hash(`public/ro/client/sfx/official/${filename}`) === expectedHash,
    `original sound hash changed ${filename}`);
  check(app.includes(`playCombatSound('${key}'`), `original sound hook missing ${key}`);
}
check(app.includes("'uiOriginalButton', 'uiOriginalCancel'"),
  'original sounds share the central UI audio preload');
check(app.includes("detail.key === 'uiOriginalButton' || detail.key === 'uiOriginalCancel'"),
  'original sound playback accounting retained');
check(app.includes("$('#quickAudio').onclick = () => setAudio({ muted: !audioPrefs.muted })"),
  'mute control still updates shared audio preferences');
check(app.includes('audioPrefs.soundEnabled && !audioPrefs.muted'),
  'button and travel sounds use shared mute state');
check(!/new Audio\([^\n]*(?:ui_button_original|ui_cancel_original)/.test(app),
  'no per-button audio player was added');
check(app.includes("if (!button || button.disabled || button.matches('[data-tab]')) return"),
  'one delegated button path excludes tab sound duplication');
check(app.includes("if (button.matches('[data-inventory]')) return"),
  'one delegated button path excludes inventory sound duplication');
for (const key of ['readyPortal', 'portal', 'warp', 'flyWing'])
  check(app.includes(key), `M1 travel cue missing ${key}`);

const expectedThemes = new Set([
  'prontera-stone', 'prt-bot01', 'prt-bot03', 'prt-bot04', 'prt-bot06',
  'prt-city-bot02', 'prt-city-bot03', 'prt-city-bot04', 'prt-city-bot05',
  'prt-pr-bottom01', 'field-grass', 'morocc-sand', 'legacy-green',
]);
const themeIds = new Set([...floorScript.matchAll(/\['([a-z0-9-]+)',\s*'/g)]
  .map((match) => match[1]));
themeIds.add('prontera-stone');
check(themeIds.size === expectedThemes.size && [...expectedThemes].every((id) => themeIds.has(id)),
  'accepted Production and M1 floor choices remain available');
check(floorScript.includes('ro-floor-theme-preview') && floorCss.includes('.ro-floor-theme-preview'),
  'accepted floor preview remains available');
for (const id of expectedThemes) {
  if (id === 'legacy-green') continue;
  const entry = floorIndex.assets.find((asset) => asset.id === id);
  check(Boolean(entry?.webOutput), `floor provenance missing ${id}`);
  check(existsSync(entry.webOutput) && hash(entry.webOutput) === entry.webOutputSha256,
    `floor asset missing or changed ${id}`);
}

const browserSources = [html, css, floorCss, app,
  read(`${web}/pet-sprite-source.js`)];
const staticPaths = new Set();
for (const source of browserSources) {
  for (const match of source.matchAll(/\/((?:assets|ro)\/[A-Za-z0-9_./-]+\.(?:png|bmp|jpg|webp|wav|mp3|json))/g)) {
    const url = match[1];
    staticPaths.add(url.startsWith('assets/') ? `${web}/${url}` : `public/${url}`);
  }
}
for (const path of staticPaths) check(existsSync(path), `broken static asset reference ${path}`);
for (const path of ['minimap-presence.js', 'mission-interaction-stage.js',
  'npc-visual-manifest.js', 'pet-companion-settings.js', 'pet-showcase.js',
  'pet-sprite-source.js']) check(existsSync(`${web}/${path}`), `deferred Web module missing ${path}`);

const visited = new Set();
const visitImports = (path) => {
  const absolute = resolve(path);
  if (visited.has(absolute)) return;
  visited.add(absolute);
  const source = read(absolute);
  for (const match of source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
    const child = resolve(dirname(absolute), match[1]);
    check(existsSync(child), `missing local import ${relative('.', child)}`);
    visitImports(child);
  }
};
visitImports('ops/ro-stack/dashboard.mjs');
check(server.includes("'/api/admin/support-sessions'"), 'accepted support session route');
check(server.includes('adminQuarantineRecoveryTransport.submit(context)'),
  'M1 Admin quarantine recovery route');
check(server.includes("url.pathname.startsWith('/api/admin/') && !adminRecoveryTransportContext(request)"),
  'Cloudflare Admin host boundary');

console.log(`WEB_FULL_PRODUCTION_SUPERSET_SOURCE_PASS checks=${checks} staticAssets=${staticPaths.size} importFiles=${visited.size} themes=${themeIds.size}`);
