// Preview-only navigation driver for the town-service prototype. Moves a
// fixture character along an 8-way path on the loaded map field and feeds each
// step to the Dashboard's own renderMinimap(); portals switch maps. Loaded only
// by scripts/preview-town-service.mjs.
(() => {
  const STEP_MS = 45;
  // Preview fixture: Prontera centre, or ?previewAt=<map>,<x>,<y> for other towns.
  const START = (() => {
    const [map, x, y] = (new URLSearchParams(location.search).get('previewAt') ?? '').split(',');
    return /^[a-z0-9_]+$/.test(map ?? '') && Number.isInteger(+x) && Number.isInteger(+y)
      ? { map, x: +x, y: +y } : { map: 'prontera', x: 156, y: 191 };
  })();
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let live = null;
  let sequence = 0;
  let token = null;

  function emit(patch) {
    const now = Date.now();
    live = { monsters: [], players: [], npcs: [], portals: [], route: [], mapMonsterCount: 0,
      mapPlayerCount: 0, statusIntervalMs: 1000, ...live, ...patch, updatedAt: now,
      freshness: { authoritativeAt: now + (sequence += 1), ageMs: 0, maxAgeMs: 5000 } };
    renderMinimap(live);
  }

  async function mapReady(map) {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      if (mapFieldName === map && mapField) return true;
      await wait(50);
    }
    return false;
  }

  function walkable(x, y) {
    return x > 0 && y > 0 && x < mapField.width - 1 && y < mapField.height - 1 &&
      (mapField.cells[y * mapField.width + x] & 1) === 1;
  }

  function path(from, goal) {
    const key = (x, y) => y * mapField.width + x;
    const previous = new Map([[key(from.x, from.y), null]]);
    const queue = [[from.x, from.y]];
    for (let head = 0; head < queue.length; head += 1) {
      const [x, y] = queue[head];
      if (goal(x, y)) {
        const steps = [];
        for (let at = key(x, y); at !== null; at = previous.get(at))
          steps.push({ x: at % mapField.width, y: Math.floor(at / mapField.width) });
        return steps.reverse().slice(1);
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = x + dx, ny = y + dy, next = key(nx, ny);
        if (previous.has(next) || !walkable(nx, ny)) continue;
        if (dx && dy && (!walkable(x + dx, y) || !walkable(x, y + dy))) continue;
        previous.set(next, key(x, y));
        queue.push([nx, ny]);
      }
    }
    return null;
  }

  const near = (target, radius) => (x, y) =>
    Math.max(Math.abs(x - target.x), Math.abs(y - target.y)) <= radius;

  async function walk(steps, mine) {
    for (let index = 0; index < steps.length; index += 1) {
      if (token !== mine) return false;
      emit({ playerX: steps[index].x, playerY: steps[index].y,
        route: steps.slice(index + 1).filter((_, n) => n % 2 === 0) });
      await wait(STEP_MS);
    }
    return true;
  }

  // Follow the leg for the current map; when an interior room cannot reach
  // it, leave through that room's own door and plan again from town.
  async function navigate({ service, route, exits }) {
    const mine = {};
    token = mine;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (!(await mapReady(live.map)) || token !== mine) return;
      const leg = (route ?? []).find((entry) => entry.map === live.map);
      const here = { x: live.playerX, y: live.playerY };
      const steps = leg && path(here, leg.portal ? near(leg.to, 1) : near(service.zone, service.zone.radius));
      if (!steps) {
        const door = (exits ?? []).filter((entry) => entry.map === live.map)
          .map((entry) => ({ entry, steps: path(here, near(entry, 1)) }))
          .find((candidate) => candidate.steps);
        if (!door || !(await walk(door.steps, mine))) return;
        emit({ map: door.entry.exit.map, playerX: door.entry.exit.x, playerY: door.entry.exit.y, route: [] });
        continue;
      }
      if (!(await walk(steps, mine))) return;
      if (!leg.portal) return;
      emit({ map: leg.exit.map, playerX: leg.exit.x, playerY: leg.exit.y, route: [] });
    }
  }

  window.GhostIslandTownServiceNavigation = {
    navigate: (request) => { void navigate(request); },
    cancel: () => { token = null; emit({ route: [] }); },
    arrived: () => { token = null; emit({ route: [] }); },
  };
  window.__townServicePreview = {
    goTo: (map, x, y) => { token = null; emit({ map, playerX: x, playerY: y, route: [] }); },
    live: () => ({ ...live }),
  };

  async function boot() {
    for (let attempt = 0; attempt < 200 && typeof renderMinimap !== 'function'; attempt += 1) await wait(50);
    // The preview has no session; keep the game shell visible.
    const showGame = () => {
      document.getElementById('auth')?.classList.add('hidden');
      document.getElementById('game')?.classList.remove('hidden');
    };
    showGame();
    setInterval(showGame, 300);
    emit({ map: START.map, playerX: START.x, playerY: START.y });
    // Production receives a position frame every status interval; mirror it.
    setInterval(() => { if (token === null) emit({}); }, 1000);
  }
  void boot();
})();
