(function () {
  'use strict';

  const canvas = document.querySelector('#minimap');
  const ctx = canvas.getContext('2d', { alpha: false });
  const LOOP_MS = 24000;
  const SNAPSHOT_MS = 240;
  const MAP = { width: 512, height: 512 };
  const SPRITE = { width: 96, height: 160, originX: 48, originY: 108 };
  const playerActions = { IDLE: 'stand', WALK: 'walk', ATTACK: 'attack', HIT: 'attack', DIE: 'sit' };
  const assetRoot = location.protocol === 'file:' ? '../../../../public/ro' : location.port === '8799' ? '/public/ro' : '/ro';
  const asset = {
    map: `${assetRoot}/client/maps/prt_fild08.png`,
    player: {
      stand: `${assetRoot}/client/showcase/body/novice-male-stand.png?v=33b65b976959670e&b=1`,
      walk: `${assetRoot}/client/showcase/body/novice-male-walk.png?v=57c007d6247a899e&b=1`,
      attack: `${assetRoot}/client/showcase/body/novice-male-attack.png?v=d31e434b86341654&b=1`,
      sit: `${assetRoot}/client/showcase/body/novice-male-sit.png?v=aa8ed6de92148b3e&b=1`,
    },
    monsters: [
      { key: 'poring', name: '波利', src: `${assetRoot}/client/monsters/poring.webp`, tint: '#ff9a9a' },
      { key: 'lunatic', name: '瘋兔', src: `${assetRoot}/client/monsters/lunatic.webp`, tint: '#ffcf78' },
      { key: 'fabre', name: '綠棉蟲', src: `${assetRoot}/client/monsters/fabre.webp`, tint: '#a8efaa' },
    ],
  };
  const images = { map: new Image(), player: {}, monsters: {} };
  images.map.src = asset.map;
  Object.entries(asset.player).forEach(([key, src]) => { images.player[key] = new Image(); images.player[key].src = src; });
  asset.monsters.forEach((entry) => { images.monsters[entry.key] = new Image(); images.monsters[entry.key].src = entry.src; });

  const dom = {
    start: document.querySelector('#startButton'), pause: document.querySelector('#pauseButton'), reset: document.querySelector('#resetButton'),
    latency: document.querySelector('#latencySelect'), scale: document.querySelector('#scaleSelect'), count: document.querySelector('#entityCountSelect'),
    status: document.querySelector('#stageStatus'), dot: document.querySelector('#statusDot'), fps: document.querySelector('#fpsValue'), frame: document.querySelector('#frameValue'),
    latencyValue: document.querySelector('#latencyValue'), revision: document.querySelector('#revisionValue'), action: document.querySelector('#actionValue'), target: document.querySelector('#targetValue'),
    authority: document.querySelector('#authorityValue'), eventClock: document.querySelector('#eventClock'), eventLog: document.querySelector('#eventLog'),
  };
  let running = false;
  let runStartedAt = 0;
  let pausedAt = 0;
  let pausedElapsed = 0;
  let lastFrameAt = 0;
  let lastSnapshotAt = -Infinity;
  let revision = 0;
  let snapshotQueue = [];
  let received = null;
  let tracks = new Map();
  let eventKeys = new Set();
  let damageFloats = [];
  let frameSamples = [];
  let currentElapsed = 0;
  let mapImageReady = false;
  const entityCount = () => Number(dom.count.value);

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function smoothstep(t) { return t * t * (3 - 2 * t); }
  function actionLabel(action) { return action === 'WALK' ? 'WALK' : action; }
  function phaseAt(t) {
    if (t < 1200) return 'SPAWN';
    if (t < 4700) return 'WALK_A';
    if (t < 5600) return 'TARGET_A';
    if (t < 7900) return 'ATTACK_A';
    if (t < 9000) return 'DEATH_A';
    if (t < 12400) return 'WALK_B';
    if (t < 13300) return 'MONSTER_HIT';
    if (t < 16100) return 'ATTACK_B';
    if (t < 17200) return 'DEATH_B';
    return 'IDLE';
  }
  function segment(t, start, end, from, to) { return from + (to - from) * smoothstep(clamp((t - start) / (end - start), 0, 1)); }
  function eventAt(t, id, type, label, target) { return { id, type, label, target: target || null, at: t }; }

  function makeEntities(t) {
    const action = phaseAt(t);
    const player = { id: 'player-001', entityType: 'PLAYER', map: 'prt_fild08', x: 184, y: 196, direction: 2, moveTargetX: null, moveTargetY: null, walkSpeed: 0.012, action: 'IDLE', targetId: null, hp: 1000, hpMax: 1000, revision, serverTimestamp: t };
    if (action === 'WALK_A' || action === 'TARGET_A' || action === 'ATTACK_A' || action === 'DEATH_A') { player.x = action === 'WALK_A' ? segment(t, 1200, 4700, 184, 262) : 262; player.y = action === 'WALK_A' ? segment(t, 1200, 4700, 196, 238) : 238; player.moveTargetX = 262; player.moveTargetY = 238; }
    if (action === 'WALK_B' || action === 'MONSTER_HIT' || action === 'ATTACK_B' || action === 'DEATH_B') { player.x = action === 'WALK_B' ? segment(t, 9000, 12400, 262, 346) : 346; player.y = action === 'WALK_B' ? segment(t, 9000, 12400, 238, 286) : 286; player.moveTargetX = 346; player.moveTargetY = 286; }
    player.action = action === 'WALK_A' || action === 'WALK_B' ? 'WALK' : action === 'ATTACK_A' || action === 'ATTACK_B' ? 'ATTACK' : action === 'MONSTER_HIT' ? 'HIT' : action === 'DEATH_A' || action === 'DEATH_B' ? 'DIE' : 'IDLE';
    player.targetId = action === 'SPAWN' || action === 'WALK_A' ? null : action === 'WALK_B' || action === 'IDLE' ? null : (action === 'DEATH_A' ? 'mob-a' : 'mob-b');
    if (action === 'MONSTER_HIT') player.hp = 920;
    const points = [[262, 238], [346, 286], [401, 191]];
    const types = ['poring', 'lunatic', 'fabre'];
    const monsters = [];
    const count = Math.max(1, entityCount() - 1);
    for (let i = 0; i < count; i += 1) {
      const base = points[i % points.length];
      const drift = i < 3 ? 0 : Math.sin(t / 1300 + i) * 24;
      const id = i === 0 ? 'mob-a' : i === 1 ? 'mob-b' : `mob-${i + 1}`;
      let x = base[0] + drift, y = base[1] + Math.cos(t / 1500 + i) * (i < 3 ? 0 : 18);
      let mobAction = 'IDLE', hp = 420, targetId = null;
      if (i === 0 && (action === 'WALK_A' || action === 'TARGET_A')) mobAction = 'IDLE';
      if (i === 0 && action === 'ATTACK_A') { mobAction = t > 7000 ? 'HIT' : 'ATTACK'; hp = t > 7000 ? 180 : 420; targetId = 'player-001'; }
      if (i === 0 && action === 'DEATH_A') { mobAction = 'DIE'; hp = 0; }
      if (i === 1 && action === 'MONSTER_HIT') { mobAction = 'ATTACK'; targetId = 'player-001'; }
      if (i === 1 && action === 'WALK_B') { mobAction = 'WALK'; x = segment(t, 9000, 12400, 346, 390); y = segment(t, 9000, 12400, 286, 306); }
      if (i === 1 && action === 'ATTACK_B') { mobAction = t > 14300 ? 'HIT' : 'ATTACK'; hp = t > 14300 ? 180 : 420; targetId = 'player-001'; }
      if (i === 1 && action === 'DEATH_B') { mobAction = 'DIE'; hp = 0; }
      if (i >= 3) mobAction = 'WALK';
      monsters.push({ id, entityType: 'MONSTER', key: types[i % types.length], name: asset.monsters[i % types.length].name, map: 'prt_fild08', x, y, direction: 6, moveTargetX: null, moveTargetY: null, walkSpeed: 0.009, action: mobAction, targetId, hp, hpMax: 420, revision, serverTimestamp: t });
    }
    return [player, ...monsters];
  }

  function authoritativeAt(t) {
    const entities = makeEntities(t);
    const phase = phaseAt(t);
    const events = [];
    if (phase === 'WALK_A') events.push(eventAt(t, 'walk-player-a', 'WALK', '玩家向波利移動', 'mob-a'));
    if (phase === 'TARGET_A') events.push(eventAt(t, 'target-a', 'TARGET', '鎖定 波利', 'mob-a'));
    if (phase === 'ATTACK_A') events.push(eventAt(t, 'attack-a', 'ATTACK', '玩家攻擊 波利', 'mob-a'));
    if (phase === 'MONSTER_HIT') events.push(eventAt(t, 'monster-hit-player', 'HIT', '瘋兔攻擊玩家', 'player-001'));
    if (phase === 'WALK_B') events.push(eventAt(t, 'retarget-b', 'TARGET', '重新鎖定 瘋兔', 'mob-b'));
    if (phase === 'ATTACK_B') events.push(eventAt(t, 'attack-b', 'ATTACK', '玩家攻擊 瘋兔', 'mob-b'));
    if (phase === 'IDLE') events.push(eventAt(t, 'idle', 'IDLE', '戰鬥循環完成，回到待機', null));
    return { map: 'prt_fild08', entityId: 'player-001', entities, events, revision, serverTimestamp: t };
  }

  function authoritativeEventsFor(t) {
    const events = [];
    // Keep each event eligible across several mock snapshots. This makes the
    // trace observable even when simulated latency skips the exact 240ms tick.
    const once = (time, id, type, label, target) => { if (t >= time && t < time + SNAPSHOT_MS * 12) events.push(eventAt(time, id, type, label, target)); };
    once(1200, 'walk-player-a', 'WALK', '玩家向波利移動', 'mob-a'); once(4700, 'target-a', 'TARGET', '鎖定 波利', 'mob-a'); once(5600, 'attack-a', 'ATTACK', '玩家攻擊 波利', 'mob-a'); once(7000, 'hit-a', 'HIT', '波利受到攻擊', 'mob-a'); once(8200, 'damage-a', 'DAMAGE', '傷害 124', 'mob-a'); once(9000, 'kill-a', 'KILL', '波利被擊倒', 'mob-a'); once(9000, 'death-a', 'DEATH', '波利死亡', 'mob-a'); once(9800, 'walk-monster-b', 'WALK', '瘋兔進入移動段', 'mob-b'); once(12400, 'retarget-b', 'TARGET', '重新鎖定 瘋兔', 'mob-b'); once(13300, 'monster-hit-player', 'HIT', '瘋兔攻擊玩家', 'player-001'); once(14000, 'damage-player', 'DAMAGE', '玩家受到 80 傷害', 'player-001'); once(14500, 'attack-b', 'ATTACK', '玩家攻擊 瘋兔', 'mob-b'); once(15300, 'damage-b', 'DAMAGE', '傷害 138', 'mob-b'); once(16100, 'kill-b', 'KILL', '瘋兔被擊倒', 'mob-b'); once(16100, 'death-b', 'DEATH', '瘋兔死亡', 'mob-b'); once(17200, 'idle', 'IDLE', '戰鬥循環完成，回到待機', null);
    return events;
  }

  function addEvent(event) {
    if (!event || eventKeys.has(event.id)) return;
    eventKeys.add(event.id);
    const li = document.createElement('li');
    li.textContent = `${(event.at / 1000).toFixed(1)}s  ${event.type} · ${event.label}`;
    dom.eventLog.prepend(li);
    while (dom.eventLog.children.length > 16) dom.eventLog.lastElementChild.remove();
    if (event.type === 'DAMAGE') damageFloats.push({ id: `${event.id}-${revision}`, text: event.label.replace(/[^0-9]/g, '') || '124', target: event.target, born: performance.now() });
  }

  function queueSnapshot(now, elapsed) {
    if (elapsed - lastSnapshotAt < SNAPSHOT_MS) return;
    lastSnapshotAt = elapsed;
    revision += 1;
    const snapshot = authoritativeAt(elapsed);
    snapshot.revision = revision;
    snapshot.events = authoritativeEventsFor(elapsed);
    const latency = Number(dom.latency.value);
    const jitter = [0, 70, -35, 110, -55][revision % 5];
    snapshotQueue.push({ deliverAt: now + Math.max(0, latency + jitter), snapshot });
  }

  function applySnapshots(now) {
    snapshotQueue.sort((a, b) => a.deliverAt - b.deliverAt);
    while (snapshotQueue.length && snapshotQueue[0].deliverAt <= now) {
      const entry = snapshotQueue.shift();
      received = entry.snapshot;
      dom.revision.textContent = String(received.revision);
      received.events.forEach(addEvent);
      received.entities.forEach((entity) => updateTrack(entity, now));
    }
  }

  function updateTrack(entity, now) {
    const previous = tracks.get(entity.id);
    const duration = previous && previous.toX !== entity.x || previous && previous.toY !== entity.y ? clamp(now - previous.receivedAt, 180, 700) : 0;
    const shown = previous ? sampleTrack(previous, now) : { x: entity.x, y: entity.y };
    tracks.set(entity.id, { fromX: shown.x, fromY: shown.y, toX: entity.x, toY: entity.y, since: now, until: now + duration, receivedAt: now, entity: { ...entity } });
  }
  function sampleTrack(track, now) {
    if (now < track.until) { const p = smoothstep((now - track.since) / Math.max(1, track.until - track.since)); return { x: track.fromX + (track.toX - track.fromX) * p, y: track.fromY + (track.toY - track.fromY) * p }; }
    return { x: track.toX, y: track.toY };
  }

  function project(x, y) {
    const pad = 28, sx = (canvas.width - pad * 2) / MAP.width, sy = (canvas.height - pad * 2) / MAP.height;
    return { x: pad + x * sx, y: canvas.height - pad - y * sy, scale: Math.min(sx, sy) };
  }
  function drawMap() {
    ctx.fillStyle = '#091727'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (images.map.complete && images.map.naturalWidth) { ctx.globalAlpha = .82; ctx.drawImage(images.map, 0, 0, canvas.width, canvas.height); ctx.globalAlpha = 1; }
    ctx.fillStyle = 'rgba(6, 16, 27, .33)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(171, 207, 236, .16)'; ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let y = 0; y <= canvas.height; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
  }
  function drawMarker(entity, now) {
    const position = project(entity.x, entity.y), scale = Number(dom.scale.value), isPlayer = entity.entityType === 'PLAYER';
    const target = received?.entities.find((entry) => entry.id === received.entityId)?.targetId;
    if (target === entity.id && entity.action !== 'DIE') { ctx.strokeStyle = '#ffd36c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(position.x, position.y, 22 * scale + 4, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = 'rgba(255,211,108,.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(position.x, position.y, 29 * scale + 4, 0, Math.PI * 2); ctx.stroke(); }
    ctx.save(); ctx.translate(position.x, position.y); const bob = entity.action === 'HIT' ? Math.sin(now / 35) * 3 : 0; ctx.translate(0, bob);
    if (isPlayer) drawPlayer(entity, now, scale); else drawMonster(entity, now, scale);
    ctx.restore();
    if (entity.hp < entity.hpMax && entity.action !== 'DIE') { const width = 42 * scale; ctx.fillStyle = 'rgba(10,16,25,.75)'; ctx.fillRect(position.x - width / 2, position.y - 32 * scale, width, 4); ctx.fillStyle = isPlayer ? '#71e0b2' : '#f47c7c'; ctx.fillRect(position.x - width / 2, position.y - 32 * scale, width * clamp(entity.hp / entity.hpMax, 0, 1), 4); }
    ctx.font = `${Math.max(10, 11 * scale)}px Segoe UI`; ctx.textAlign = 'center'; ctx.fillStyle = isPlayer ? '#baf4ff' : '#f7d3d3'; ctx.fillText(isPlayer ? 'PLAYER' : entity.name, position.x, position.y + 43 * scale);
  }
  function drawPlayer(entity, now, scale) {
    const action = playerActions[entity.action] || 'stand', image = images.player[action] || images.player.stand, columns = action === 'walk' ? 8 : action === 'attack' ? 6 : 3;
    const frame = Math.floor(now / (action === 'walk' ? 75 : 100)) % columns, sx = frame * SPRITE.width, sy = 0;
    ctx.globalAlpha = entity.action === 'DIE' ? clamp(1 - ((currentElapsed % 1100) / 1100), .25, 1) : 1;
    ctx.drawImage(image, sx, sy, SPRITE.width, SPRITE.height, -SPRITE.originX * scale, -SPRITE.originY * scale, SPRITE.width * scale, SPRITE.height * scale);
    if (entity.action === 'ATTACK') { ctx.strokeStyle = 'rgba(255,244,172,.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(18 * scale, -16 * scale, 13 * scale, -1.1, .85); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  function drawMonster(entity, now, scale) {
    const entry = asset.monsters.find((item) => item.key === entity.key) || asset.monsters[0], image = images.monsters[entry.key];
    const size = 72 * scale, pulse = entity.action === 'ATTACK' ? 1 + Math.sin(now / 75) * .08 : 1;
    ctx.globalAlpha = entity.action === 'DIE' ? clamp(1 - ((currentElapsed % 1100) / 1100), .15, 1) : 1;
    ctx.filter = entity.action === 'HIT' ? 'brightness(1.8) saturate(.75)' : 'none';
    if (image?.complete && image.naturalWidth) ctx.drawImage(image, -size * pulse / 2, -size * pulse, size * pulse, size * pulse);
    else { ctx.fillStyle = entry.tint; ctx.beginPath(); ctx.arc(0, -size * .5, size * .35, 0, Math.PI * 2); ctx.fill(); }
    ctx.filter = 'none'; ctx.globalAlpha = 1;
  }
  function drawDamages(now) {
    damageFloats = damageFloats.filter((entry) => now - entry.born < 1300);
    damageFloats.forEach((entry) => { const track = tracks.get(entry.target); if (!track) return; const position = project(...Object.values(sampleTrack(track, now))); const p = (now - entry.born) / 1300; ctx.save(); ctx.globalAlpha = 1 - p; ctx.font = `800 ${20 * Number(dom.scale.value)}px Segoe UI`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(38,25,34,.85)'; ctx.strokeText(entry.text, position.x + p * 16, position.y - 35 - p * 32); ctx.fillStyle = '#fff0a0'; ctx.fillText(entry.text, position.x + p * 16, position.y - 35 - p * 32); ctx.restore(); });
  }
  function render(now) {
    if (!lastFrameAt) lastFrameAt = now;
    const frameTime = now - lastFrameAt; lastFrameAt = now;
    frameSamples.push({ now, frameTime }); frameSamples = frameSamples.filter((entry) => now - entry.now < 1000);
    const elapsed = running ? ((now - runStartedAt) % LOOP_MS) : pausedElapsed; currentElapsed = elapsed;
    if (running) { queueSnapshot(now, elapsed); applySnapshots(now); }
    drawMap();
    tracks.forEach((track) => { const entity = track.entity; if (!entity) return; const sampled = sampleTrack(track, now); drawMarker({ ...entity, x: sampled.x, y: sampled.y }, now); });
    drawDamages(now);
    const fps = frameSamples.length; dom.fps.textContent = fps ? `${fps}` : '—'; dom.frame.textContent = frameTime ? `${frameTime.toFixed(1)}ms` : '—'; dom.latencyValue.textContent = `${dom.latency.value}ms`; dom.eventClock.textContent = `loop ${(elapsed / 1000).toFixed(1)}s`; dom.status.textContent = running ? `Running · ${phaseAt(elapsed)}` : 'Paused · ready'; dom.dot.classList.toggle('live', running); dom.action.textContent = actionLabel(received?.entities.find((entry) => entry.id === received.entityId)?.action || 'IDLE'); dom.target.textContent = received?.entities.find((entry) => entry.id === received.entityId)?.targetId || '—'; dom.authority.textContent = received ? `A:${received.revision} · R:independent` : 'separate';
    requestAnimationFrame(render);
  }
  function reset() { running = false; pausedAt = 0; pausedElapsed = 0; runStartedAt = 0; lastSnapshotAt = -Infinity; revision = 0; snapshotQueue = []; received = null; tracks = new Map(); eventKeys = new Set(); damageFloats = []; dom.eventLog.replaceChildren(); dom.revision.textContent = '0'; dom.action.textContent = 'IDLE'; dom.target.textContent = '—'; }
  dom.start.addEventListener('click', () => { if (!running) { const now = performance.now(); runStartedAt = now - pausedElapsed; running = true; dom.status.textContent = 'Running · SPAWN'; } });
  dom.pause.addEventListener('click', () => { if (running) { pausedElapsed = (performance.now() - runStartedAt) % LOOP_MS; running = false; } });
  dom.reset.addEventListener('click', () => reset());
  dom.latency.addEventListener('change', () => { dom.latencyValue.textContent = `${dom.latency.value}ms`; });
  dom.count.addEventListener('change', () => reset());
  images.map.addEventListener('load', () => { mapImageReady = true; });
  reset();
  requestAnimationFrame(render);
  window.minimapLiveCombat = { authoritativeAt, sampleTrack, project, getState: () => ({ running, revision, latency: Number(dom.latency.value), entityCount: entityCount(), elapsed: currentElapsed }) };
})();
