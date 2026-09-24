(() => {
  const api = globalThis.roOriginalMinimap;
  const canvas = document.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const status = document.querySelector('#status');
  const maps = ['prontera', 'prt_fild05', 'prt_fild08', 'pay_dun00', '__missing__'];
  const dimensions = {
    prontera: { width: 312, height: 392 },
    prt_fild05: { width: 400, height: 400 },
    prt_fild08: { width: 400, height: 400 },
    pay_dun00: { width: 200, height: 200 },
    __missing__: { width: 200, height: 200 },
  };
  const manager = api.createManager({
    manifestUrl: '/public/ro/client/minimaps/manifest.json',
    assetRoot: '/public/ro/client/minimaps',
  });
  let mapName = 'prt_fild08';

  if (new URLSearchParams(location.search).has('mobile')) document.body.classList.add('mobile');

  function dot(point, color, radius = 6) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#101010';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function collision(rect, map) {
    ctx.fillStyle = '#111';
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.fillStyle = '#777';
    for (let y = 0; y < map.height; y += 12) {
      for (let x = (y / 12) % 2 ? 0 : 12; x < map.width; x += 24) {
        const a = api.worldMapCoordinate({ x, y }, map, rect);
        const b = api.worldMapCoordinate({ x: x + 10, y: y + 8 }, map, rect);
        ctx.fillRect(a.x, b.y, Math.max(2, b.x - a.x), Math.max(2, a.y - b.y));
      }
    }
  }

  function render() {
    const map = dimensions[mapName];
    const state = manager.state(mapName);
    const source = state.image;
    const sourceWidth = source?.naturalWidth || map.width;
    const sourceHeight = source?.naturalHeight || map.height;
    const fitted = api.fitRect(canvas.width, canvas.height, sourceWidth, sourceHeight);
    const zoom = manager.getZoom();
    const rect = api.viewportRect(fitted, map, { x: map.width / 2, y: map.height / 2 }, zoom, canvas);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (state.mode === 'RO_ORIGINAL') ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height);
    else collision(rect, map);

    const points = {
      player: { x: map.width * 0.52, y: map.height * 0.48 },
      monster: { x: map.width * 0.63, y: map.height * 0.55 },
      npc: { x: map.width * 0.4, y: map.height * 0.6 },
      portal: { x: map.width * 0.82, y: map.height * 0.2 },
    };
    const route = [
      { x: map.width * 0.12, y: map.height * 0.15 },
      { x: map.width * 0.28, y: map.height * 0.35 },
      points.player,
    ].map((point) => api.worldMapCoordinate(point, map, rect));
    ctx.beginPath();
    route.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.strokeStyle = '#79e66d';
    ctx.lineWidth = 3;
    ctx.stroke();
    dot(api.worldMapCoordinate(points.player, map, rect), '#45a3ff', 7);
    dot(api.worldMapCoordinate(points.monster, map, rect), '#ff5a52');
    dot(api.worldMapCoordinate(points.npc, map, rect), '#ffd34d');
    dot(api.worldMapCoordinate(points.portal, map, rect), '#d777ff');
    status.textContent = `map=${mapName} background=${state.mode} fallback=${state.reason || 'NONE'} zoom=${zoom}x`;
    canvas.dataset.backgroundMode = state.mode;
    canvas.dataset.fallbackReason = state.reason || '';
  }

  async function select(nextMap) {
    mapName = nextMap;
    await manager.load(mapName);
    render();
  }

  for (const name of maps) {
    const button = document.createElement('button');
    button.textContent = name;
    button.addEventListener('click', () => select(name));
    document.querySelector('#maps').append(button);
  }
  document.querySelector('#original').addEventListener('click', () => { manager.setMode('auto'); select(mapName); });
  document.querySelector('#collision').addEventListener('click', () => { manager.setMode('collision'); render(); });
  document.querySelector('#zoomIn').addEventListener('click', () => { manager.setZoom(manager.getZoom() * 2); render(); });
  document.querySelector('#zoomOut').addEventListener('click', () => { manager.setZoom(manager.getZoom() / 2); render(); });
  canvas.addEventListener('wheel', (event) => { event.preventDefault(); manager.setZoom(manager.getZoom() * (event.deltaY < 0 ? 2 : 0.5)); render(); }, { passive: false });
  select(mapName);
})();
