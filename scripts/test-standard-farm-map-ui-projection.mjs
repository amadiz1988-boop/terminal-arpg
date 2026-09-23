import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { loadWorldMapTestCatalog } from './lib/world-map-test-catalog.mjs';

const root = process.cwd();
const dashboardRoot = join(root, 'ops', 'ro-stack', 'dashboard');
const publicRoot = join(root, 'public');
const registry = JSON.parse(
  await readFile(
    join(
      root,
      'ops',
      'ro-stack',
      'persistent-agent',
      'standard-farm-map-release-registry.json',
    ),
    'utf8',
  ),
);
const mapInfo = JSON.parse(
  await readFile(join(publicRoot, 'ro', 'data', 'map-info.json'), 'utf8'),
);
const { catalog } = await loadWorldMapTestCatalog(root,
  process.env.RO_RATHENA_ROOT ?? 'C:/Users/Administrator/source/ghost-island-rathena');
const appSource = await readFile(join(dashboardRoot, 'app.js'), 'utf8');
const dashboardSource = await readFile(
  join(root, 'ops', 'ro-stack', 'dashboard.mjs'),
  'utf8',
);

const standardRows = registry.maps.filter(
  (row) => row.farmSelectionAvailable === true,
);
const holdRows = registry.maps.filter(
  (row) => row.availabilityReason === 'SPECIAL_TRANSPORT_PENDING',
);
const unknownRows = registry.maps.filter(
  (row) =>
    row.farmable &&
    !row.farmSelectionAvailable &&
    row.availabilityReason !== 'SPECIAL_TRANSPORT_PENDING',
);
const nonFarmableRows = registry.maps.filter((row) => !row.farmable);

assert.equal(standardRows.length, 136);
assert.equal(holdRows.length, 24);
assert.equal(unknownRows.length, 161);
assert.equal(nonFarmableRows.length, 974);
for (const row of standardRows) {
  const summary = mapInfo.maps[row.map];
  assert.ok(summary, `missing map-info summary: ${row.map}`);
  if (row.map === 'thor_v03') {
    assert.equal(summary.farmSelectionAvailable, false);
    assert.equal(summary.availabilityReason, 'NO_ELIGIBLE_NORMAL_FARM_MONSTER');
    continue;
  }
  assert.equal(summary.farmSelectionAvailable, true, row.map);
  assert.equal(summary.availabilityReason, null, row.map);
  assert.equal(summary.routeClass, null, row.map);
  assert.ok(summary.levelRange, `missing monster level range: ${row.map}`);
  assert.ok(summary.combatMonsterCount > 0, `missing combat spawn: ${row.map}`);
  assert.ok(summary.category, `missing map category: ${row.map}`);
  await stat(join(publicRoot, 'ro', 'data', 'map-info', `${row.map}.json`));
  assert.ok(
    mapInfo.worldMap.regions.some((region) => region.mapIds.includes(row.map)),
    `missing world-map region: ${row.map}`,
  );
}
assert.equal(holdRows.filter((row) => row.farmSelectionAvailable).length, 0);
assert.equal(unknownRows.filter((row) => row.farmSelectionAvailable).length, 0);
assert.equal(nonFarmableRows.filter((row) => row.farmSelectionAvailable).length, 0);

for (const mapId of ['prt_fild05', 'prt_fild07', 'prt_fild08', 'pay_dun00']) {
  assert.equal(mapInfo.maps[mapId]?.farmSelectionAvailable, true, mapId);
}
assert.equal(mapInfo.maps.moc_fild20?.farmSelectionAvailable, false);
assert.equal(mapInfo.maps.iz_dun02?.farmSelectionAvailable, true);
assert.equal(mapInfo.maps.prontera?.farmSelectionAvailable, false);

const selectorSource = appSource.slice(
  appSource.indexOf('function renderWorldMapNodes()'),
  appSource.indexOf('async function openWorldMap()'),
);
assert.match(selectorSource, /farmMapSelectionAvailable\(mapId/);
assert.match(selectorSource, /region\?\.mapIds/);
assert.doesNotMatch(
  selectorSource,
  /prt_fild05|prt_fild07|prt_fild08|pay_dun00/,
);
assert.match(dashboardSource, /farm_map_not_released/);
assert.match(dashboardSource, /\/api\/farm-map-availability/);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
};
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname === '/api/farm-map-availability') {
    response.writeHead(200, { 'content-type': contentTypes['.json'] });
    return response.end(JSON.stringify({
      maps: [...catalog.values()].filter((row) => row.kind === 'farm')
        .map((row) => ({ ...row,
          buttonState: row.farmSelectionAvailable ? 'AVAILABLE' : 'UNAVAILABLE_MAP',
          cost: row.farmSelectionAvailable ? 0 : null, cooldownSeconds: 60 })),
      towns: [...catalog.values()].filter((row) => row.kind === 'town')
        .map((row) => ({ ...row, buttonState: row.map === 'prontera'
          ? 'ALREADY_ON_TARGET_MAP' : 'AVAILABLE', cost: 0 })),
      player: { currentMap: 'prontera', savedTownSetupRequired: true }, cooldownSeconds: 60,
    }));
  }
  if (url.pathname === '/api/health') {
    response.writeHead(200, { 'content-type': contentTypes['.json'] });
    return response.end(JSON.stringify({ ok: true }));
  }
  if (url.pathname.startsWith('/api/')) {
    response.writeHead(401, { 'content-type': contentTypes['.json'] });
    return response.end(JSON.stringify({ error: 'not_authenticated' }));
  }
  const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const base = relative.startsWith('ro/') ? publicRoot : dashboardRoot;
  const target = normalize(join(base, relative));
  if (!target.startsWith(normalize(base))) {
    response.writeHead(404);
    return response.end();
  }
  try {
    const content = await readFile(target);
    response.writeHead(200, {
      'content-type': contentTypes[extname(target).toLowerCase()] ??
        'application/octet-stream',
      'cache-control': 'no-store',
    });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const origin = `http://127.0.0.1:${address.port}`;
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = mkdtempSync(join(tmpdir(), 'standard-farm-map-ui-'));
const debugPort = 19469;
const browser = spawn(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { windowsHide: true },
);

try {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if ((await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const target = await fetch(
    `http://127.0.0.1:${debugPort}/json/new?about:blank`,
    { method: 'PUT' },
  ).then((response) => response.json());
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  const errors = [];
  let requestId = 0;
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
    if (message.method === 'Runtime.exceptionThrown')
      errors.push(message.params?.exceptionDetails?.text ?? 'runtime error');
  };
  await new Promise((resolve) => {
    socket.onopen = resolve;
  });
  const call = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++requestId;
      pending.set(id, resolve);
      socket.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) =>
    (
      await call('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      })
    ).result.result.value;

  await call('Runtime.enable');
  await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', {
    width: 1024,
    height: 768,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await call('Page.navigate', { url: origin });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await evaluate("typeof openWorldMap === 'function'")) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const desktop = await evaluate(`(async()=>{
    document.querySelector('#auth').classList.add('hidden');
    document.querySelector('#game').classList.remove('hidden');
    lastState={grindTarget:{mapId:'moc_fild01'},derived:{map:'prontera'}};
    await openWorldMap();
    const regions=[...document.querySelectorAll('.world-map-region')];
    const shell=document.querySelector('.world-map-shell').getBoundingClientRect();
    return {
      visible:!document.querySelector('#worldMapOverlay').classList.contains('hidden'),
      status:document.querySelector('#worldMapStatus').textContent,
      regionCount:regions.length,
      selectableRegionCount:regions.filter(node=>node.dataset.mapSelectable==='true').length,
      standardCount:farmMapAvailabilityData.maps.filter(row=>row.farmSelectionAvailable && mapInfoData.maps[row.map]).length,
      standardReachable:farmMapAvailabilityData.maps.filter(row=>row.farmSelectionAvailable).every(row=>
        mapInfoData.maps[row.map] && mapInfoData.worldMap.regions.some(region=>region.mapIds.includes(row.map))),
      overlappedHitTargets:regions.map(node=>{
        node.scrollIntoView({behavior:'instant',block:'center',inline:'center'});
        const rect=node.getBoundingClientRect();
        let reachable=false;
        for(const fy of [.12,.3,.5,.7,.88])for(const fx of [.12,.3,.5,.7,.88]){
          const x=rect.left+rect.width*fx,y=rect.top+rect.height*fy;
          const hit=document.elementFromPoint(x,y);
          if(hit?.closest('.world-map-region')===node||
            (node.dataset.mapIds??'').split(' ').includes(hit?.closest('.world-map-town-label')?.dataset.mapId))
            reachable=true;
        }
        return {map:node.dataset.mapId,reachable};
      }).filter(row=>!row.reachable),
      shellRight:shell.right,
      overflow:document.documentElement.scrollWidth-innerWidth,
    };
  })()`);

  for (const { map } of desktop.overlappedHitTargets) {
    const point = await evaluate(`(()=>{
      const node=[...document.querySelectorAll('.world-map-region')]
        .find(candidate=>candidate.dataset.mapId===${JSON.stringify(map)});
      node?.scrollIntoView({behavior:'instant',block:'center',inline:'center'});
      const rect=node?.getBoundingClientRect();
      if(!rect)return null;
      const missed=[];
      for(const fy of [.12,.3,.5,.7,.88])for(const fx of [.12,.3,.5,.7,.88]){
        const x=Math.round(rect.left+rect.width*fx),
          y=Math.round(rect.top+rect.height*fy);
        const hit=document.elementFromPoint(x,y);
        if(hit?.closest('.world-map-region') || hit?.id==='worldMapNodes' ||
          hit?.closest('.world-map-town-label')){
          const bounds=document.querySelector('#worldMapNodes').getBoundingClientRect();
          const region=mapInfoData.worldMap.regions.find(row=>row.mapId===${JSON.stringify(map)});
          return {x,y,worldX:(x-bounds.left)/bounds.width*mapInfoData.worldMap.width,
            worldY:(y-bounds.top)/bounds.height*mapInfoData.worldMap.height,position:region?.position};
        }
        missed.push({x,y,hit:hit?.className??hit?.id});
      }
      return {missed};
    })()`);
    assert.ok(point && !point.missed, `No clickable overlap point: ${map} ${JSON.stringify(point)}`);
    await call('Input.dispatchMouseEvent', { type: 'mousePressed',
      x: point.x, y: point.y, button: 'left', clickCount: 1 });
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased',
      x: point.x, y: point.y, button: 'left', clickCount: 1 });
    const overlapResult = await evaluate(`(async()=>{
      for(let attempt=0;attempt<20 && selectedWorldMapId!==${JSON.stringify(map)} &&
        !document.querySelector('.world-map-overlap-choice[data-map-id=${JSON.stringify(map)}]');attempt++)
        await new Promise(resolve=>setTimeout(resolve,25));
      return {found:!!document.querySelector('.world-map-overlap-choice[data-map-id=${JSON.stringify(map)}]'),
        selected:selectedWorldMapId,
        choices:[...document.querySelectorAll('.world-map-overlap-choice')].map(button=>button.dataset.mapId),
        expected:mapInfoData.worldMap.regions.filter(region=>
          ${point.worldX}>=region.position.x1 && ${point.worldX}<=region.position.x2 &&
          ${point.worldY}>=region.position.y1 && ${point.worldY}<=region.position.y2)
          .map(region=>region.mapId)};
    })()`);
    assert.equal(overlapResult.found || overlapResult.selected === map, true,
      `Overlapping label unreachable: ${map} ${JSON.stringify({point,overlapResult})}`);
  }
  desktop.overlappedTargetsVerified = desktop.overlappedHitTargets.length;

  const inspectMap = async (mapId) =>
    await evaluate(`(async()=>{
      await selectWorldMap(${JSON.stringify(mapId)});
      const action=document.querySelector('#worldMapDetail .controls button');
      return {
        selected:selectedWorldMapId,
        detail:document.querySelector('#worldMapDetail').textContent,
        actionText:action?.textContent ?? null,
        actionDisabled:action?.disabled ?? null,
        related:[...document.querySelectorAll('#worldMapDetail .world-map-floor-button')].map(button=>({
          mapId:button.dataset.mapId,
          disabled:button.disabled,
          text:button.textContent,
        })),
      };
    })()`);

  const standardSamples = {};
  for (const mapId of [
    'prt_fild05',
    'prt_fild07',
    'prt_fild08',
    'pay_dun00',
    'mjo_dun01',
  ]) {
    standardSamples[mapId] = await inspectMap(mapId);
    assert.equal(standardSamples[mapId].selected, mapId);
    assert.equal(standardSamples[mapId].actionText, '設定為掛機地圖');
    assert.equal(standardSamples[mapId].actionDisabled, false, mapId);
    assert.match(standardSamples[mapId].detail, /主要掛機怪物：Lv\./);
  }
  const hold = await inspectMap('moc_fild20');
  assert.equal(hold.actionText, '尚未開放');
  assert.equal(hold.actionDisabled, true);
  const unknown = await inspectMap('iz_dun02');
  assert.equal(unknown.actionText, '設定為掛機地圖');
  assert.equal(unknown.actionDisabled, false);
  const town = await inspectMap('prontera');
  assert.equal(town.actionText, '此地圖沒有可掛機怪物');
  assert.equal(town.actionDisabled, true);
  const visibleRegions = await evaluate(`(async()=>{
    const red=[...document.querySelectorAll('.world-map-region')]
      .find(node=>node.dataset.mapId==='tha_t01');
    red.click();
    await new Promise(resolve=>setTimeout(resolve,50));
    const redSelected=selectedWorldMapId;
    const floorIds=[...document.querySelectorAll('#worldMapDetail .world-map-floor-button')]
      .map(button=>button.dataset.mapId);
    const floors=[];
    for(const id of floorIds){
      const button=[...document.querySelectorAll('#worldMapDetail .world-map-floor-button')]
        .find(candidate=>candidate.dataset.mapId===id);
      button.click();
      await new Promise(resolve=>setTimeout(resolve,15));
      floors.push({id,selected:selectedWorldMapId,
        reason:document.querySelector('#worldMapDetail .world-map-farm-note')?.textContent??''});
    }
    selectTownWorldMap('prontera');
    const townDetail=document.querySelector('#worldMapDetail').textContent;
    const townButtons=[...document.querySelectorAll('#worldMapDetail button')]
      .map(button=>({text:button.textContent,disabled:button.disabled}));
    return {redSelected,floors,townDetail,townButtons,
      liveTargets:[...document.querySelectorAll('.world-map-region')]
        .filter(node=>typeof document.querySelector('#worldMapCanvas').onclick==='function' &&
          node.tagName==='BUTTON').length};
  })()`);
  assert.equal(visibleRegions.redSelected, 'tha_t01');
  assert.equal(visibleRegions.floors.length, 12);
  assert.ok(visibleRegions.floors.every((row) => row.selected === row.id));
  assert.ok(visibleRegions.floors.every((row) => !/QUEST_ACCESS_REVIEW_REQUIRED/.test(row.reason)));
  assert.match(visibleRegions.townDetail, /類型：主城/);
  assert.ok(visibleRegions.townButtons.some((row) => row.text === '設為儲存主城' && !row.disabled));
  assert.equal(visibleRegions.liveTargets, 249);
  const overlapPoint = await evaluate(`(()=>{
    const node=document.querySelector('.world-map-region[data-map-id="hu_fild05"]');
    node.scrollIntoView({block:'center',inline:'center'});
    const rect=node.getBoundingClientRect();
    const x=rect.left+rect.width/2,y=rect.top+rect.height/2;
    const hit=document.elementFromPoint(x,y);
    return {x,y,hit:hit?.closest('.world-map-region')?.dataset.mapId??hit?.className};
  })()`);
  await call('Input.dispatchMouseEvent', { type: 'mousePressed',
    x: overlapPoint.x, y: overlapPoint.y, button: 'left', clickCount: 1 });
  await call('Input.dispatchMouseEvent', { type: 'mouseReleased',
    x: overlapPoint.x, y: overlapPoint.y, button: 'left', clickCount: 1 });
  const overlapChoice = await evaluate(`(async()=>{
    await new Promise(resolve=>setTimeout(resolve,50));
    const choice=document.querySelector('.world-map-overlap-choice[data-map-id="hu_fild05"]');
    choice?.click();
    await new Promise(resolve=>setTimeout(resolve,50));
    return {choiceFound:!!choice,selected:selectedWorldMapId,
      choices:[...document.querySelectorAll('.world-map-overlap-choice')].map(button=>button.dataset.mapId)};
  })()`);
  assert.equal(overlapChoice.choiceFound, true,
    JSON.stringify({ overlapPoint, overlapChoice }));
  assert.equal(overlapChoice.selected, 'hu_fild05');
  const regionIndex = await evaluate(`(async()=>{
    const details=document.querySelector('.world-map-region-index');
    details.open=true;
    const all=document.querySelectorAll('#worldMapRegionIndex button').length;
    const search=document.querySelector('#worldMapRegionSearch');
    search.value='prt_fild05';
    search.dispatchEvent(new Event('input',{bubbles:true}));
    const matches=[...document.querySelectorAll('#worldMapRegionIndex button')];
    matches[0]?.click();
    await new Promise(resolve=>setTimeout(resolve,30));
    return {all,matches:matches.map(button=>button.dataset.mapId),selected:selectedWorldMapId};
  })()`);
  assert.equal(regionIndex.all, 249);
  assert.deepEqual(regionIndex.matches, ['prt_fild05']);
  assert.equal(regionIndex.selected, 'prt_fild05');

  const persistence = await evaluate(`(async()=>{
    await selectWorldMap('prt_fild07');
    renderWorldMapNodes();
    const region=[...document.querySelectorAll('.world-map-region')]
      .find(node=>node.dataset.mapIds.split(' ').includes('prt_fild07'));
    return {selected:selectedWorldMapId,selectedRegion:region?.dataset.mapSelected};
  })()`);
  assert.deepEqual(persistence, {
    selected: 'prt_fild07',
    selectedRegion: 'true',
  });

  await call('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  const mobile = await evaluate(`(()=>{
    renderWorldMapNodes();
    const shell=document.querySelector('.world-map-shell').getBoundingClientRect();
    return {
      width:innerWidth,
      shellLeft:shell.left,
      shellRight:shell.right,
      overflow:document.documentElement.scrollWidth-innerWidth,
      status:document.querySelector('#worldMapStatus').textContent,
    };
  })()`);
  const mobileTargets = await evaluate(`(async()=>{
    const normal=document.querySelector('.world-map-region[data-map-id="prt_fild05"]');
    const red=document.querySelector('.world-map-region[data-map-id="tha_t01"]');
    const town=document.querySelector('.world-map-town-label[data-map-id="prontera"]');
    normal.click();
    const normalSelected=selectedWorldMapId;
    red.click();
    await new Promise(resolve=>setTimeout(resolve,30));
    const redSelected=selectedWorldMapId;
    const floor=document.querySelector('#worldMapDetail .world-map-floor-button');
    floor?.click();
    const floorSelected=selectedWorldMapId;
    town?.click();
    const panel=document.querySelector('#worldMapDetail').getBoundingClientRect();
    return {normalSelected,redSelected,floorSelected,townFound:!!town,
      townDetail:document.querySelector('#worldMapDetail').textContent,
      redTapWidth:getComputedStyle(red,'::after').width,
      panelWidth:panel.width,panelRight:panel.right};
  })()`);
  await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const redTouchPoint = await evaluate(`(()=>{
    selectWorldMap('prt_fild05');
    const red=document.querySelector('.world-map-region[data-map-id="tha_t01"]');
    red.scrollIntoView({block:'center',inline:'center'});
    const rect=red.getBoundingClientRect();
    return {x:rect.left+rect.width/2,y:rect.top+rect.height/2,
      hit:document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2)?.closest('.world-map-region')?.dataset.mapId??null};
  })()`);
  assert.equal(redTouchPoint.hit, 'tha_t01');
  await call('Input.dispatchTouchEvent', { type: 'touchStart',
    touchPoints: [{ x: redTouchPoint.x, y: redTouchPoint.y }] });
  await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const mobileTouchSelected = await evaluate('selectedWorldMapId');

  assert.equal(desktop.visible, true);
  assert.equal(desktop.regionCount, 249);
  assert.equal(desktop.standardCount, 251);
  assert.equal(desktop.standardReachable, true);
  assert.match(desktop.status, /251 張可掛機地圖/);
  assert.ok(desktop.shellRight <= 1024);
  assert.ok(desktop.overflow <= 0);
  assert.equal(mobile.width, 390);
  assert.ok(mobile.shellLeft >= 0);
  assert.ok(mobile.shellRight <= 390);
  assert.ok(mobile.overflow <= 0);
  assert.match(mobile.status, /251 張可掛機地圖/);
  assert.equal(mobileTargets.normalSelected, 'prt_fild05');
  assert.equal(mobileTargets.redSelected, 'tha_t01');
  assert.equal(mobileTargets.floorSelected, 'tha_t01');
  assert.equal(mobileTargets.townFound, true);
  assert.match(mobileTargets.townDetail, /類型：主城/);
  assert.ok(Number.parseFloat(mobileTargets.redTapWidth) >= 38);
  assert.ok(mobileTargets.panelWidth > 250 && mobileTargets.panelRight <= 390);
  assert.equal(mobileTouchSelected, 'tha_t01');
  assert.deepEqual(errors, []);
  socket.close();

  console.log(
    JSON.stringify(
      {
        result: 'STANDARD_FARM_MAP_UI_PROJECTION_PASS',
        standardMapsExposed: desktop.standardCount,
        selectableRegions: desktop.selectableRegionCount,
        standardSamples,
        hold,
        unknown,
        town,
        visibleRegions: { redSelected: visibleRegions.redSelected,
          floors: visibleRegions.floors.length, liveTargets: visibleRegions.liveTargets },
        mobileTargets,
        persistence,
        desktop,
        mobile,
      },
      null,
      2,
    ),
  );
} finally {
  browser.kill();
  await Promise.race([
    new Promise((resolve) => browser.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]);
  await new Promise((resolve) => server.close(resolve));
  try {
    rmSync(profile, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  } catch {}
}
