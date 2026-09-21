(function () {
  'use strict';

  const canvas = document.querySelector('#minimap');
  const ctx = canvas.getContext('2d', { alpha: false });
  const LOOP_MS = 24000;
  const SNAPSHOT_MS = 240;
  const MAP = { key: 'prt_fild08', width: 512, height: 512, sourceSize: '512x512' };
  const SPRITE = { width: 96, height: 160, originX: 48, originY: 108, directionCount: 8 };
  const PLAYER_BASE_SCALE = 0.36;
  const MONSTER_BASE_SCALE = 0.62;
  const DAMAGE_LIFE_MS = 1300;
  const EFFECT_LIFE_MS = 260;
  const HIT_RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
  const assetRoot = location.protocol === 'file:' ? '../../../../public/ro' : location.port === '8799' ? '/public/ro' : '/ro';
  const asset = {
    map: `${assetRoot}/client/maps/prt_fild08.png`,
    player: {
      stand: `${assetRoot}/client/showcase/body/novice-male-stand.png?v=33b65b976959670e&b=1`,
      walk: `${assetRoot}/client/showcase/body/novice-male-walk.png?v=57c007d6247a899e&b=1`,
      attack: `${assetRoot}/client/showcase/body/novice-male-attack.png?v=d31e434b86341654&b=1`,
    },
    monsters: [
      { key: 'poring', name: '波利', src: `${assetRoot}/client/monsters/poring.webp` },
      { key: 'lunatic', name: '瘋兔', src: `${assetRoot}/client/monsters/lunatic.webp` },
      { key: 'fabre', name: '綠棉蟲', src: `${assetRoot}/client/monsters/fabre.webp` },
    ],
    effects: {
      hitLens1: `${assetRoot}/client/damage/lens1.png`,
      criticalLens2: `${assetRoot}/client/damage/lens2.png`,
      criticalBackground: `${assetRoot}/client/damage/critical-bg.png`,
    },
    damage: {
      normal: (digit) => `${assetRoot}/client/damage/number-${digit}.png`,
      critical: (digit) => `${assetRoot}/client/damage/critical-number-${digit}.png`,
    },
    sounds: {
      ro: {
        attack: `${assetRoot}/client/sfx/official/_attack_sword.wav`,
        hit: `${assetRoot}/client/sfx/official/_hit_sword.wav`,
        critical: `${assetRoot}/client/damage/ef_hit2.wav`,
        playerHit: `${assetRoot}/client/sfx/official/damage_male.wav`,
        death: `${assetRoot}/client/sfx/official/poring_die.wav`,
        levelUp: `${assetRoot}/client/sfx/official/level_up.wav`,
      },
      current: {
        attack: `${assetRoot}/client/sfx/attack.wav`,
        hit: `${assetRoot}/client/sfx/hurt.wav`,
        critical: `${assetRoot}/client/sfx/hurt.wav`,
        playerHit: `${assetRoot}/client/sfx/hurt.wav`,
        death: `${assetRoot}/client/sfx/defeat.wav`,
        levelUp: `${assetRoot}/client/sfx/level_up.wav`,
      },
    },
  };
  const playerActions = {
    IDLE: { key: 'stand', columns: 3, delay: 100, loop: true, actionIndex: 0 },
    WALK: { key: 'walk', columns: 8, delay: 75, loop: true, actionIndex: 1 },
    ATTACK: { key: 'attack', columns: 6, delay: 100, loop: false, actionIndex: 2 },
  };
  const images = { map: new Image(), player: {}, monsters: {}, effects: {}, damage: { normal: {}, critical: {} } };
  images.map.src = asset.map;
  Object.entries(asset.player).forEach(([key, src]) => { images.player[key] = new Image(); images.player[key].src = src; });
  asset.monsters.forEach((entry) => { images.monsters[entry.key] = new Image(); images.monsters[entry.key].src = entry.src; });
  Object.entries(asset.effects).forEach(([key, src]) => { images.effects[key] = new Image(); images.effects[key].src = src; });
  for (let digit = 0; digit <= 9; digit += 1) {
    images.damage.normal[digit] = new Image(); images.damage.normal[digit].src = asset.damage.normal(digit);
    images.damage.critical[digit] = new Image(); images.damage.critical[digit].src = asset.damage.critical(digit);
  }

  const dom = {
    start: document.querySelector('#startButton'), pause: document.querySelector('#pauseButton'), reset: document.querySelector('#resetButton'),
    source: document.querySelector('#sourceSelect'), characterId: document.querySelector('#characterIdInput'), characterIdLabel: document.querySelector('#characterIdLabel'),
    playerScale: document.querySelector('#playerScaleSelect'), monsterScale: document.querySelector('#monsterScaleSelect'), sound: document.querySelector('#soundSelect'),
    otherPlayers: document.querySelector('#otherPlayersToggle'), playerNames: document.querySelector('#playerNamesToggle'), monsterNames: document.querySelector('#monsterNamesToggle'),
    latency: document.querySelector('#latencySelect'), count: document.querySelector('#entityCountSelect'),
    status: document.querySelector('#stageStatus'), dot: document.querySelector('#statusDot'), note: document.querySelector('#canvasNote'),
    fps: document.querySelector('#fpsValue'), frame: document.querySelector('#frameValue'), latencyValue: document.querySelector('#latencyValue'), revision: document.querySelector('#revisionValue'),
    action: document.querySelector('#actionValue'), target: document.querySelector('#targetValue'), liveStatus: document.querySelector('#liveStatusValue'), authority: document.querySelector('#authorityValue'),
    eventClock: document.querySelector('#eventClock'), eventLog: document.querySelector('#eventLog'), evidenceStatus: document.querySelector('#evidenceStatus'), evidenceMissing: document.querySelector('#evidenceMissing'),
  };
  let running = false;
  let runStartedAt = 0;
  let pausedElapsed = 0;
  let lastFrameAt = 0;
  let lastSnapshotAt = -Infinity;
  let revision = 0;
  let snapshotQueue = [];
  let received = null;
  let liveState = null;
  let tracks = new Map();
  let eventKeys = new Set();
  let damageFloats = [];
  let effects = [];
  let frameSamples = [];
  let currentElapsed = 0;
  let dataSource = 'preview';
  let liveAdapter = null;
  const audioCache = new Map();
  const playedAudioEvents = new Set();

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const smoothstep = (t) => t * t * (3 - 2 * t);
  const entityCount = () => Number(dom.count.value);
  const previewMode = () => dataSource === 'preview';

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
  function eventAt(t, id, type, label, target, extra = {}) { return { id, type, label, target: target || null, at: t, ...extra }; }
  function directionFor(dx, dy) {
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return 0;
    const angle = Math.atan2(dy, dx);
    return (Math.round(((angle + Math.PI) / (Math.PI * 2)) * 8) + 8) % 8;
  }
  function actionLabel(action) { return action === 'HIT' ? 'HIT / DAMAGE' : action; }

  function makeEntities(t) {
    const phase = phaseAt(t);
    const player = { id: 'player-001', entityType: 'PLAYER', map: MAP.key, x: 184, y: 196, direction: 2, action: 'IDLE', targetId: null, hp: 1000, hpMax: 1000, revision, serverTimestamp: t, name: 'Novice' };
    if (['WALK_A', 'TARGET_A', 'ATTACK_A', 'DEATH_A'].includes(phase)) { player.x = phase === 'WALK_A' ? segment(t, 1200, 4700, 184, 262) : 262; player.y = phase === 'WALK_A' ? segment(t, 1200, 4700, 196, 238) : 238; player.targetId = phase === 'TARGET_A' || phase === 'ATTACK_A' || phase === 'DEATH_A' ? 'mob-a' : null; }
    if (['WALK_B', 'MONSTER_HIT', 'ATTACK_B', 'DEATH_B'].includes(phase)) { player.x = phase === 'WALK_B' ? segment(t, 9000, 12400, 262, 346) : 346; player.y = phase === 'WALK_B' ? segment(t, 9000, 12400, 238, 286) : 286; player.targetId = phase === 'MONSTER_HIT' ? null : 'mob-b'; }
    player.action = phase === 'WALK_A' || phase === 'WALK_B' ? 'WALK' : phase === 'ATTACK_A' || phase === 'ATTACK_B' ? 'ATTACK' : phase === 'MONSTER_HIT' ? 'HIT' : phase === 'DEATH_A' || phase === 'DEATH_B' ? 'DIE' : 'IDLE';
    if (phase === 'MONSTER_HIT') player.hp = 920;
    const points = [[262, 238], [346, 286], [401, 191]];
    const types = ['poring', 'lunatic', 'fabre'];
    const monsters = [];
    for (let i = 0; i < Math.max(1, entityCount() - 1); i += 1) {
      const base = points[i % points.length];
      const drift = i < 3 ? 0 : Math.sin(t / 1300 + i) * 24;
      const id = i === 0 ? 'mob-a' : i === 1 ? 'mob-b' : `mob-${i + 1}`;
      let x = base[0] + drift, y = base[1] + Math.cos(t / 1500 + i) * (i < 3 ? 0 : 18);
      let mobAction = 'IDLE', hp = 420, targetId = null;
      if (i === 0 && phase === 'ATTACK_A') { mobAction = t > 7000 ? 'HIT' : 'ATTACK'; hp = t > 7000 ? 180 : 420; targetId = 'player-001'; }
      if (i === 0 && phase === 'DEATH_A') { mobAction = 'DIE'; hp = 0; }
      if (i === 1 && phase === 'WALK_B') { mobAction = 'WALK'; x = segment(t, 9000, 12400, 346, 390); y = segment(t, 9000, 12400, 286, 306); }
      if (i === 1 && phase === 'MONSTER_HIT') { mobAction = 'ATTACK'; targetId = 'player-001'; }
      if (i === 1 && phase === 'ATTACK_B') { mobAction = t > 14300 ? 'HIT' : 'ATTACK'; hp = t > 14300 ? 180 : 420; targetId = 'player-001'; }
      if (i === 1 && phase === 'DEATH_B') { mobAction = 'DIE'; hp = 0; }
      monsters.push({ id, entityType: 'MONSTER', key: types[i % types.length], name: asset.monsters[i % types.length].name, map: MAP.key, x, y, direction: directionFor(player.x - x, player.y - y), action: mobAction, targetId, hp, hpMax: 420, revision, serverTimestamp: t });
    }
    player.direction = directionFor((player.targetId ? (makeTargetPoint(player.targetId)[0] - player.x) : 1), (player.targetId ? (makeTargetPoint(player.targetId)[1] - player.y) : 0));
    return [player, ...monsters];
  }
  function makeTargetPoint(id) { return id === 'mob-a' ? [262, 238] : [346, 286]; }

  function authoritativeAt(t) {
    const entities = makeEntities(t);
    const phase = phaseAt(t);
    return { map: MAP.key, entityId: 'player-001', entities, events: [], revision, serverTimestamp: t };
  }
  function authoritativeEventsFor(t) {
    const events = [];
    const once = (time, id, type, label, target, extra = {}) => { if (t >= time && t < time + SNAPSHOT_MS * 12) events.push(eventAt(time, id, type, label, target, extra)); };
    once(1200, 'walk-player-a', 'WALK', '玩家向波利移動', 'mob-a');
    once(4700, 'target-a', 'TARGET', '鎖定 波利', 'mob-a');
    once(5600, 'attack-a', 'ATTACK', '玩家攻擊 波利', 'mob-a');
    once(7000, 'hit-a', 'HIT', '波利受到攻擊', 'mob-a', { damage: 124 });
    once(8200, 'damage-a', 'DAMAGE', '傷害 124', 'mob-a', { damage: 124 });
    once(9000, 'kill-a', 'KILL', '波利被擊倒', 'mob-a');
    once(9000, 'death-a', 'DEATH', '波利死亡', 'mob-a');
    once(9800, 'walk-monster-b', 'WALK', '瘋兔進入移動段', 'mob-b');
    once(12400, 'retarget-b', 'TARGET', '重新鎖定 瘋兔', 'mob-b');
    once(13300, 'monster-hit-player', 'HIT', '瘋兔攻擊玩家', 'player-001', { damage: 80 });
    once(14000, 'damage-player', 'DAMAGE', '玩家受到 80 傷害', 'player-001', { damage: 80 });
    once(14500, 'attack-b', 'ATTACK', '玩家攻擊 瘋兔', 'mob-b');
    once(15300, 'damage-b', 'DAMAGE', '暴擊 138', 'mob-b', { damage: 138, critical: true });
    once(16100, 'kill-b', 'KILL', '瘋兔被擊倒', 'mob-b');
    once(16100, 'death-b', 'DEATH', '瘋兔死亡', 'mob-b');
    once(17200, 'idle', 'IDLE', '戰鬥循環完成，回到待機', null);
    return events;
  }

  function queueSnapshot(now, elapsed) {
    if (elapsed - lastSnapshotAt < SNAPSHOT_MS) return;
    lastSnapshotAt = elapsed;
    revision += 1;
    const snapshot = authoritativeAt(elapsed);
    snapshot.revision = revision;
    snapshot.events = authoritativeEventsFor(elapsed);
    const jitter = [0, 70, -35, 110, -55][revision % 5];
    snapshotQueue.push({ deliverAt: now + Math.max(0, Number(dom.latency.value) + jitter), snapshot });
  }
  function updateTrack(entity, now) {
    const previous = tracks.get(entity.id);
    const moved = previous && (previous.toX !== entity.x || previous.toY !== entity.y);
    const duration = moved ? clamp(now - previous.receivedAt, 180, 700) : 0;
    const shown = previous ? sampleTrack(previous, now) : { x: entity.x, y: entity.y };
    tracks.set(entity.id, { fromX: shown.x, fromY: shown.y, toX: entity.x, toY: entity.y, since: now, until: now + duration, receivedAt: now, entity: { ...entity } });
  }
  function sampleTrack(track, now) {
    if (now < track.until) { const p = smoothstep((now - track.since) / Math.max(1, track.until - track.since)); return { x: track.fromX + (track.toX - track.fromX) * p, y: track.fromY + (track.toY - track.fromY) * p }; }
    return { x: track.toX, y: track.toY };
  }
  function applySnapshots(now) {
    snapshotQueue.sort((a, b) => a.deliverAt - b.deliverAt);
    while (snapshotQueue.length && snapshotQueue[0].deliverAt <= now) {
      const entry = snapshotQueue.shift(); received = entry.snapshot; dom.revision.textContent = String(received.revision); received.events.forEach(addEvent); received.entities.forEach((entity) => updateTrack(entity, now));
    }
  }

  function project(x, y) {
    const pad = 28;
    return { x: pad + x * ((canvas.width - pad * 2) / MAP.width), y: canvas.height - pad - y * ((canvas.height - pad * 2) / MAP.height) };
  }
  function drawMap() {
    ctx.fillStyle = '#091727'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const mapKey = previewMode() ? MAP.key : (received?.map ?? liveState?.map ?? null);
    if (mapKey === MAP.key && images.map.complete && images.map.naturalWidth) { ctx.globalAlpha = 0.86; ctx.drawImage(images.map, 0, 0, canvas.width, canvas.height); ctx.globalAlpha = 1; }
    else { ctx.fillStyle = '#18263b'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#d9e4f7'; ctx.textAlign = 'center'; ctx.font = '700 20px Segoe UI'; ctx.fillText(mapKey ? `原廠地圖素材未載入：${mapKey}` : 'LIVE_POSITION = NOT_AVAILABLE', canvas.width / 2, canvas.height / 2); }
    ctx.fillStyle = 'rgba(6, 16, 27, .25)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  function drawPlayer(entity, now, scale) {
    const action = playerActions[entity.action] || playerActions.IDLE;
    const image = images.player[action.key];
    if (!image?.complete || !image.naturalWidth) return;
    const frame = action.loop ? Math.floor(now / action.delay) % action.columns : Math.min(action.columns - 1, Math.floor(now / action.delay));
    const row = clamp(Number(entity.direction ?? 0), 0, SPRITE.directionCount - 1);
    ctx.drawImage(image, frame * SPRITE.width, row * SPRITE.height, SPRITE.width, SPRITE.height, -SPRITE.originX * PLAYER_BASE_SCALE * scale, -SPRITE.originY * PLAYER_BASE_SCALE * scale, SPRITE.width * PLAYER_BASE_SCALE * scale, SPRITE.height * PLAYER_BASE_SCALE * scale);
  }
  function drawMonster(entity, scale) {
    const image = images.monsters[entity.key];
    if (!image?.complete || !image.naturalWidth) return;
    const size = 96 * MONSTER_BASE_SCALE * scale;
    ctx.drawImage(image, -size / 2, -size, size, size);
  }
  function drawMarker(entity, now) {
    const position = project(entity.x, entity.y); const isPlayer = entity.entityType === 'PLAYER';
    const displayScale = Number(isPlayer ? dom.playerScale.value : dom.monsterScale.value);
    const target = received?.entities.find((entry) => entry.id === received.entityId)?.targetId;
    if (target === entity.id && entity.action !== 'DIE') { ctx.strokeStyle = '#ffd36c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(position.x, position.y, 21 * displayScale + 4, 0, Math.PI * 2); ctx.stroke(); }
    ctx.save(); ctx.translate(position.x, position.y);
    if (isPlayer) drawPlayer(entity, now, displayScale); else drawMonster(entity, displayScale);
    ctx.restore();
    const showName = isPlayer ? (dom.playerNames.checked || entity.id === (received?.entityId ?? 'player-001')) : dom.monsterNames.checked;
    if (showName) { ctx.font = '12px Segoe UI'; ctx.textAlign = 'center'; ctx.fillStyle = isPlayer ? '#baf4ff' : '#f7d3d3'; ctx.fillText(isPlayer ? (entity.name || 'PLAYER') : entity.name, position.x, position.y + 40); }
    if (entity.hp !== null && entity.hp !== undefined && entity.hp < entity.hpMax && entity.action !== 'DIE') { const width = 42 * displayScale; ctx.fillStyle = 'rgba(10,16,25,.75)'; ctx.fillRect(position.x - width / 2, position.y - 32 * displayScale, width, 4); ctx.fillStyle = isPlayer ? '#71e0b2' : '#f47c7c'; ctx.fillRect(position.x - width / 2, position.y - 32 * displayScale, width * clamp(entity.hp / entity.hpMax, 0, 1), 4); }
  }
  function drawBitmapNumber(text, critical, x, y, scale) {
    let cursor = x; const set = critical ? images.damage.critical : images.damage.normal;
    for (const digit of String(text)) { const image = set[digit]; if (!image?.complete || !image.naturalWidth) continue; const width = image.naturalWidth * scale; ctx.drawImage(image, cursor, y, width, image.naturalHeight * scale); cursor += width + scale; }
  }
  function drawDamages(now) {
    damageFloats = damageFloats.filter((entry) => now - entry.born < DAMAGE_LIFE_MS);
    damageFloats.forEach((entry) => { const track = tracks.get(entry.target); if (!track) return; const position = project(...Object.values(sampleTrack(track, now))); const p = clamp((now - entry.born) / DAMAGE_LIFE_MS, 0, 1); const scale = 1.8 * Number(dom.monsterScale.value); ctx.save(); ctx.globalAlpha = 1 - p; if (entry.critical && images.effects.criticalBackground.complete) ctx.drawImage(images.effects.criticalBackground, position.x - 35 * scale, position.y - 80 * scale, 70 * scale, 60 * scale); drawBitmapNumber(entry.text, entry.critical, position.x - String(entry.text).length * 6 * scale, position.y - 45 * scale - p * 35, scale); ctx.restore(); });
  }
  function drawEffects(now) {
    effects = effects.filter((entry) => now - entry.born < EFFECT_LIFE_MS);
    effects.forEach((entry) => {
      const track = tracks.get(entry.target); if (!track) return;
      const position = project(...Object.values(sampleTrack(track, now)));
      const age = now - entry.born;
      const image = entry.kind === 'critical' ? images.effects.criticalLens2 : images.effects.hitLens1;
      if (!image?.complete || !image.naturalWidth) return;
      const displayScale = Number(dom.playerScale.value);
      const rayWidth = 14 * displayScale * 0.42;
      const rayHeight = 14 * displayScale * 7.5;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.filter = 'brightness(1.65)';
      HIT_RAY_ANGLES.forEach((angle, index) => {
        const delay = index * 12;
        const localLife = clamp((age - delay) / (EFFECT_LIFE_MS - delay), 0, 1);
        if (localLife <= 0) return;
        const grow = 0.08 + localLife * 0.92;
        ctx.save();
        ctx.globalAlpha = (1 - localLife) * 0.9;
        ctx.translate(position.x, position.y);
        ctx.rotate((angle * Math.PI) / 180);
        ctx.drawImage(image, -rayWidth / 2, -rayHeight * grow, rayWidth, rayHeight * grow);
        ctx.restore();
      });
      ctx.restore();
    });
  }

  function soundSource(event) {
    const set = dom.sound.value;
    if (set === 'off') return null;
    const table = asset.sounds[set];
    return table?.[event] ?? null;
  }
  function playSound(event, id) {
    if (!previewMode() && event !== 'hit') return;
    const key = `${id ?? event}:${event}:${dom.sound.value}`;
    if (playedAudioEvents.has(key)) return;
    playedAudioEvents.add(key);
    const source = soundSource(event); if (!source) return;
    let audio = audioCache.get(source); if (!audio) { audio = new Audio(source); audio.preload = 'auto'; audioCache.set(source, audio); }
    audio.currentTime = 0; void audio.play().catch(() => {});
  }
  function addEvent(event) {
    if (!event || eventKeys.has(event.id)) return;
    eventKeys.add(event.id);
    const li = document.createElement('li'); li.textContent = `${event.at !== undefined ? `${(event.at / 1000).toFixed(1)}s  ` : ''}${event.type} · ${event.label}`; dom.eventLog.prepend(li); while (dom.eventLog.children.length > 20) dom.eventLog.lastElementChild.remove();
    const target = event.target || received?.entityId || null;
    if (event.type === 'ATTACK') playSound('attack', event.id);
    if (event.type === 'HIT') { playSound(event.critical ? 'critical' : 'hit', event.id); if (event.damage) { effects.push({ kind: event.critical ? 'critical' : 'hit', target, born: performance.now() }); damageFloats.push({ id: event.id, text: String(event.damage), target, critical: Boolean(event.critical), born: performance.now() }); } }
    if (event.type === 'DAMAGE') { if (event.damage) { effects.push({ kind: event.critical ? 'critical' : 'hit', target, born: performance.now() }); damageFloats.push({ id: event.id, text: String(event.damage), target, critical: Boolean(event.critical), born: performance.now() }); } playSound(event.critical ? 'critical' : 'hit', event.id); }
    if (event.type === 'DEATH') playSound('death', event.id);
  }

  function reset() {
    running = false; pausedElapsed = 0; runStartedAt = 0; lastSnapshotAt = -Infinity; revision = 0; snapshotQueue = []; received = null; tracks = new Map(); eventKeys = new Set(); damageFloats = []; effects = []; playedAudioEvents.clear(); dom.eventLog.replaceChildren(); dom.revision.textContent = '0'; dom.action.textContent = 'IDLE'; dom.target.textContent = '—';
    if (liveAdapter) liveAdapter.stop(); liveState = null; updateSourceUi();
  }
  function setLiveState(state) {
    liveState = state;
    dom.liveStatus.textContent = state?.status ?? 'LIVE_READ-ONLY';
    if (!state?.available) { received = null; dom.status.textContent = `LIVE READ-ONLY · ${state?.status ?? 'POSITION_DATA_UNAVAILABLE'}`; return; }
    const entities = [state.player, ...(dom.otherPlayers.checked ? state.players : []), ...state.monsters].filter(Boolean).map((entity) => ({ ...entity, action: entity.entityType === 'PLAYER' ? 'IDLE' : 'IDLE', targetId: entity.entityType === 'PLAYER' ? state.targetId : null, hpMax: entity.hpMax ?? entity.hp ?? 1 }));
    received = { map: state.map, entityId: state.player.id, entities, revision: state.revision ?? 0, events: [] };
    dom.revision.textContent = String(received.revision); entities.forEach((entity) => updateTrack(entity, performance.now()));
    for (const event of state.combatEvents ?? []) {
      const target = event.targetName || event.targetId || '即時事件';
      const label = {
        TARGET: `目標 ${target}`,
        ATTACK: `攻擊 ${target}`,
        HIT: `命中 ${target}`,
        KILL: `擊殺 ${target}`,
        DEATH: '玩家死亡',
        LOOT: event.raw || '取得戰利品',
        MAP_CHANGE: `地圖切換 ${event.map || state.map}`,
      }[event.type] || event.raw || event.type;
      addEvent({
        id: `live:${event.id}`,
        type: event.type,
        label,
        target: event.targetId || state.player.id,
        damage: event.damage,
        critical: Boolean(event.critical),
      });
    }
    dom.authority.textContent = 'LIVE authority · rAF';
  }
  function updateSourceUi() {
    const live = dataSource === 'live'; dom.characterIdLabel.classList.toggle('is-visible', live); dom.note.textContent = live ? 'READ-ONLY LIVE · authoritative projection' : 'RO ORIGINAL ASSET · SCENARIO PREVIEW'; dom.liveStatus.textContent = live ? 'LIVE READ-ONLY' : 'PREVIEW';
  }
  async function start() {
    if (dataSource === 'live') {
      if (!liveAdapter) liveAdapter = globalThis.minimapLiveReadonlyAdapter?.createLiveReadOnlyAdapter({ onState: setLiveState });
      if (!liveAdapter) { dom.status.textContent = 'LIVE READ-ONLY · adapter unavailable'; return; }
      if (!Number(dom.characterId.value)) { dom.status.textContent = 'LIVE READ-ONLY · 請輸入角色 ID'; return; }
      reset(); dataSource = 'live'; updateSourceUi(); running = true; await liveAdapter.start(Number(dom.characterId.value)); return;
    }
    if (!running) { const now = performance.now(); runStartedAt = now - pausedElapsed; running = true; dom.status.textContent = 'RO SCENARIO PREVIEW · SPAWN'; }
  }
  function previewEvent(kind) {
    if (!previewMode()) { dom.status.textContent = 'LIVE READ-ONLY · 預覽按鈕不會改動即時資料'; return; }
    const target = kind === 'player-hit' ? 'player-001' : 'mob-a'; const id = `manual-${kind}-${Date.now()}`; const labels = { 'normal-attack': '原廠普通攻擊預覽', critical: '原廠暴擊預覽', 'player-hit': '原廠玩家受擊預覽', 'monster-hit': '原廠怪物受擊預覽', 'monster-death': '怪物死亡：原廠死亡 ACT 未載入', 'level-up': '升級：原廠升級視覺資產未載入' };
    if (kind === 'monster-death' || kind === 'level-up') { addEvent(eventAt(currentElapsed, id, 'BLOCKED_NOT_PROVEN', labels[kind], target)); if (kind === 'level-up') playSound('levelUp', id); return; }
    if (!received) { received = authoritativeAt(currentElapsed); received.entities.forEach((entity) => updateTrack(entity, performance.now())); }
    if (kind === 'normal-attack') { addEvent(eventAt(currentElapsed, id, 'ATTACK', labels[kind], target)); playSound('attack', id); return; }
    const critical = kind === 'critical'; const damage = critical ? 188 : kind === 'player-hit' ? 80 : 124; addEvent(eventAt(currentElapsed, id, 'HIT', labels[kind], target, { damage, critical }));
  }
  function render(now) {
    if (!lastFrameAt) lastFrameAt = now;
    const frameTime = now - lastFrameAt; lastFrameAt = now; frameSamples.push({ now, frameTime }); frameSamples = frameSamples.filter((entry) => now - entry.now < 1000);
    const elapsed = previewMode() ? (running ? ((now - runStartedAt) % LOOP_MS) : pausedElapsed) : pausedElapsed; currentElapsed = elapsed;
    if (previewMode() && running) { queueSnapshot(now, elapsed); applySnapshots(now); }
    drawMap(); tracks.forEach((track) => { const entity = track.entity; if (entity) { const sampled = sampleTrack(track, now); drawMarker({ ...entity, x: sampled.x, y: sampled.y }, now); } }); drawEffects(now); drawDamages(now);
    const fps = frameSamples.length; dom.fps.textContent = fps ? String(fps) : '—'; dom.frame.textContent = frameTime ? `${frameTime.toFixed(1)}ms` : '—'; dom.latencyValue.textContent = `${dom.latency.value}ms`; dom.eventClock.textContent = `loop ${(elapsed / 1000).toFixed(1)}s`; dom.dot.classList.toggle('live', running);
    const player = received?.entities.find((entry) => entry.id === received.entityId); dom.action.textContent = actionLabel(player?.action || 'IDLE'); dom.target.textContent = player?.targetId || liveState?.targetId || '—'; if (previewMode()) { dom.status.textContent = running ? `RO SCENARIO PREVIEW · ${phaseAt(elapsed)}` : 'RO SCENARIO PREVIEW · 已就緒'; dom.authority.textContent = received ? `A:${received.revision} · rAF independent` : '預覽 authority separated'; }
    requestAnimationFrame(render);
  }

  dom.start.addEventListener('click', () => void start());
  dom.pause.addEventListener('click', () => { if (running && previewMode()) { pausedElapsed = (performance.now() - runStartedAt) % LOOP_MS; running = false; } });
  dom.reset.addEventListener('click', reset);
  dom.source.addEventListener('change', () => { dataSource = dom.source.value; reset(); updateSourceUi(); });
  dom.latency.addEventListener('change', () => { dom.latencyValue.textContent = `${dom.latency.value}ms`; });
  dom.count.addEventListener('change', reset);
  dom.otherPlayers.addEventListener('change', () => { if (liveState) setLiveState(liveState); });
  document.querySelectorAll('[data-preview]').forEach((button) => button.addEventListener('click', () => previewEvent(button.dataset.preview)));
  const missing = ['PLAYER_HIT_ACT', 'PLAYER_DIE_ACT', 'MONSTER_ACTION_ACT/SPR_WEB_FRAMES', 'MONSTER_DEATH_EFFECT', 'LEVEL_UP_VISUAL_EFFECT', 'ORIGINAL_FONT_BEHAVIOR_SCREENSHOT', 'LIVE_TARGET_POSITION', 'LIVE_AUTHORITATIVE_ATTACK_HIT_KILL_FOR_BROWSER'];
  dom.evidenceStatus.textContent = `BLOCKED_NOT_PROVEN · ${missing.length} 項`;
  dom.evidenceMissing.textContent = `RO_ORIGINAL_EVIDENCE_MISSING = ${missing.join('、')}`;
  reset(); dataSource = dom.source.value; updateSourceUi(); requestAnimationFrame(render);
  window.minimapLiveCombat = { authoritativeAt, sampleTrack, project, getState: () => ({ running, source: dataSource, revision, entityCount: entityCount(), elapsed: currentElapsed, live: liveState?.status ?? null }) };
})();
