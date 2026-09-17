/**
 * Diagnostic probe: paperdoll headgear attachment across the animation cycle.
 *
 * Runs the real showcase renderer in headless Chrome at 390x844. For each
 * (job, headgear view) it renders every walk/attack frame in every direction,
 * draws the exact frame rectangles the renderer chose onto a canvas, and
 * measures the headgear crown relative to the body crown. A large frame-to-frame
 * change is the visible "headgear jumps off the head" defect.
 *
 * Usage: node scripts/probe-ro-paperdoll-sync.mjs
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = process.env.RO_DEMO_ORIGIN ?? 'http://127.0.0.1:8788';
const fixture = JSON.parse(
  readFileSync('.local/ro-stack/multiplayer-test-v2-credentials.json', 'utf8'),
);

const profile = mkdtempSync(join(tmpdir(), 'ro-paperdoll-probe-'));
const port = 19490;
const browser = spawn(
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { windowsHide: true },
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(read, predicate = Boolean, timeout = 25_000) {
  const deadline = Date.now() + timeout;
  let value;
  while (Date.now() < deadline) {
    value = await read();
    if (predicate(value)) return value;
    await sleep(60);
  }
  throw new Error(`wait timed out: ${JSON.stringify(value)}`);
}

try {
  await waitFor(async () => {
    try {
      return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok;
    } catch {
      return false;
    }
  });
  const target = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {
    method: 'PUT',
  }).then((response) => response.json());
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let requestId = 0;
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
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
  const evaluate = async (expression) => {
    const response = await call('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (response.result.exceptionDetails)
      throw new Error(JSON.stringify(response.result.exceptionDetails));
    return response.result.result.value;
  };

  await call('Runtime.enable');
  await call('Page.enable');
  await call('Page.bringToFront');
  await call('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await call('Page.navigate', { url: origin });
  await waitFor(() =>
    evaluate("typeof document.querySelector('#loginForm')?.onsubmit === 'function'"),
  );
  await evaluate(`(() => {
    document.querySelector('#username').value='jobtest_archer';
    document.querySelector('#password').value=${JSON.stringify(fixture.password)};
    document.querySelector('#loginForm').requestSubmit();
  })()`);
  await waitFor(() =>
    evaluate("!document.querySelector('#characterSelectForm')?.classList.contains('hidden')"),
  );
  await evaluate("document.querySelector('#characterSelectForm').requestSubmit()");
  await waitFor(() => evaluate("!document.querySelector('#game')?.classList.contains('hidden')"));

  const combos = await evaluate(`(async () => {
    await loadCharacterShowcase();

    const layerIds = {
      body: 'paperdollBodyLayer',
      hairFront: 'paperdollHairFrontLayer',
      headBack: 'paperdollHeadBackLayer',
      headFront: 'paperdollHeadFrontLayer',
    };
    const parseTranslate = (value) => {
      const match = /translate\\((-?[\\d.]+)px,\\s*(-?[\\d.]+)px\\)/.exec(value || '');
      return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: 0, y: 0 };
    };
    const parseBg = (value) => {
      const match = /(-?[\\d.]+)px\\s+(-?[\\d.]+)px/.exec(value || '');
      return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: 0, y: 0 };
    };
    const images = new Map();
    const loadImage = (src) =>
      new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = src;
      });

    const measure = (image, sx, sy, sw, sh, tx, ty) => {
      if (!image) return null;
      const canvas = document.createElement('canvas');
      canvas.width = 240;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, sx, sy, sw, sh, 72 + tx, 100 + ty, sw, sh);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let minY = 1e9;
      for (let y = 0; y < canvas.height; y++)
        for (let x = 0; x < canvas.width; x++)
          if (data[(y * canvas.width + x) * 4 + 3] > 8) { minY = y; break; }
      if (minY > 1e8) return null;
      let minX = 1e9, maxX = -1e9, count = 0, sumY = 0;
      for (let y = minY; y <= Math.min(canvas.height - 1, minY + 4); y++) {
        for (let x = 0; x < canvas.width; x++) {
          if (data[(y * canvas.width + x) * 4 + 3] > 8) {
            count += 1;
            sumY += y;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
          }
        }
      }
      if (!count) return null;
      return { cx: (minX + maxX) / 2, cy: sumY / count, topY: minY };
    };

    async function setup(classId, sex, viewId) {
      characterShowcase.character = { name: 'probe', classId, sex, hair: 1 };
      characterShowcase.equipment = [{ slot: 'headTop', itemId: 0, viewId }];
      characterShowcase.loadedSignature = '';
      characterShowcase.assetsReady = false;
      characterShowcase.direction = 0;
      await preloadCharacterShowcase();
      return characterShowcase.assetsReady;
    }

    async function sample(action, frame, direction) {
      characterShowcase.action = action;
      characterShowcase.direction = direction;
      const layers = currentShowcaseLayers();
      const bodyAsset = showcaseAsset(layers.body, action);
      const delay = Math.max(25, Number(bodyAsset?.delay ?? 100));
      characterShowcase.actionStartedAt = performance.now() - frame * delay;
      renderCharacterShowcase(performance.now());
      const read = {};
      for (const [name, id] of Object.entries(layerIds)) {
        const el = document.getElementById(id);
        read[name] = {
          bg: parseBg(el?.style.backgroundPosition),
          transform: parseTranslate(el?.style.transform),
          image: (el?.style.backgroundImage || '').replace(/^url\\("?/, '').replace(/"?\\)$/, ''),
        };
      }
      const out = {};
      for (const [name, info] of Object.entries(read)) {
        const key = info.image;
        if (key && !images.has(key)) images.set(key, await loadImage(key));
        out[name] = measure(images.get(key), -info.bg.x, -info.bg.y, 96, 160, info.transform.x, info.transform.y);
      }
      return out;
    }

    const jobs = ${JSON.stringify(
      process.env.RO_PROBE_JOBS
        ? JSON.parse(process.env.RO_PROBE_JOBS)
        : [
            { classId: 0, sex: 'F' },
            { classId: 1, sex: 'M' },
            { classId: 3, sex: 'F' },
            { classId: 21, sex: 'M' },
          ],
    )};
    const views = ${JSON.stringify(
      process.env.RO_PROBE_VIEWS ? JSON.parse(process.env.RO_PROBE_VIEWS) : [465, 2, 872, 101, 51, 139],
    )};
    const out = [];
    for (const job of jobs) {
      for (const view of views) {
        const ready = await setup(job.classId, job.sex, view);
        if (!ready) {
          out.push({ ...job, view, error: 'not-ready' });
          continue;
        }
        const perAction = {};
        for (const action of ['stand', 'walk', 'attack']) {
          let dxRange = 0;
          let dyRange = 0;
          const results = [];
          for (let direction = 0; direction < 8; direction++) {
            const bodyAsset = showcaseAsset(currentShowcaseLayers().body, action);
            const count = action === 'stand' ? 1 : Math.max(1, Number(bodyAsset?.frameCounts?.[direction] ?? 1));
            const offsets = [];
            for (let frame = 0; frame < count; frame++) {
              const row = await sample(action, frame, direction);
              if (row.body && row.headFront)
                offsets.push({
                  frame,
                  dx: Number((row.headFront.cx - row.body.cx).toFixed(2)),
                  dy: Number((row.headFront.cy - row.body.cy).toFixed(2)),
                  hairDx: row.hairFront ? Number((row.headFront.cx - row.hairFront.cx).toFixed(2)) : null,
                  hairDy: row.hairFront ? Number((row.headFront.cy - row.hairFront.cy).toFixed(2)) : null,
                  bodyCx: row.body.cx,
                  bodyCy: row.body.cy,
                  hatCx: row.headFront.cx,
                  hatCy: row.headFront.cy,
                  hairCx: row.hairFront?.cx ?? null,
                  hairCy: row.hairFront?.cy ?? null,
                  bodyTopY: row.body.topY,
                  hatTopY: row.headFront.topY,
                });
            }
            if (offsets.length > 1) {
              let jump = 0;
              let hairJump = 0;
              for (let i = 1; i < offsets.length; i++) {
                const value = Math.hypot(offsets[i].dx - offsets[i - 1].dx, offsets[i].dy - offsets[i - 1].dy);
                if (value > jump) jump = value;
                if (offsets[i].hairDx !== null && offsets[i - 1].hairDx !== null) {
                  const hairValue = Math.hypot(
                    offsets[i].hairDx - offsets[i - 1].hairDx,
                    offsets[i].hairDy - offsets[i - 1].hairDy,
                  );
                  if (hairValue > hairJump) hairJump = hairValue;
                }
              }
              const hairOffsets = offsets.filter((entry) => entry.hairDx !== null);
              const hairDxs = hairOffsets.map((entry) => entry.hairDx);
              const hairDys = hairOffsets.map((entry) => entry.hairDy);
              const dxs = offsets.map((entry) => entry.dx);
              const dys = offsets.map((entry) => entry.dy);
              dxRange = Math.max(dxRange, Math.max(...dxs) - Math.min(...dxs));
              dyRange = Math.max(dyRange, Math.max(...dys) - Math.min(...dys));
              results.push({
                direction,
                jump,
                hairJump,
                offsets,
                hairCount: hairOffsets.length,
                hairDxRange: hairDxs.length ? Math.max(...hairDxs) - Math.min(...hairDxs) : null,
                hairDyRange: hairDys.length ? Math.max(...hairDys) - Math.min(...hairDys) : null,
              });
            }
          }
          const byBody = results.slice().sort((a, b) => b.jump - a.jump)[0] ?? { jump: 0, direction: null, offsets: null };
          const hairCandidates = results.filter((entry) => entry.hairCount > 1);
          const byHair = hairCandidates.slice().sort((a, b) => b.hairJump - a.hairJump)[0] ?? null;
          perAction[action] = {
            maxCrownJump: Number(byBody.jump.toFixed(1)),
            worstDirection: byBody.direction,
            crownDxRange: Number(dxRange.toFixed(1)),
            crownDyRange: Number(dyRange.toFixed(1)),
            hairMaxJump: byHair ? Number(byHair.hairJump.toFixed(1)) : null,
            hairDirection: byHair?.direction ?? null,
            hairDxRange: byHair ? Number(byHair.hairDxRange.toFixed(1)) : null,
            hairDyRange: byHair ? Number(byHair.hairDyRange.toFixed(1)) : null,
            hairOffsets: byHair?.offsets ?? null,
            offsets: byBody.offsets,
          };
        }
        out.push({ ...job, view, perAction });
      }
    }
    return out;
  })()`);

  const walkRanked = combos
    .filter((combo) => combo.perAction?.walk)
    .sort((a, b) => b.perAction.walk.maxCrownJump - a.perAction.walk.maxCrownJump)
    .slice(0, 12)
    .map((combo) => ({
      job: combo.classId,
      sex: combo.sex,
      view: combo.view,
      walkJump: combo.perAction.walk.maxCrownJump,
      walkDir: combo.perAction.walk.worstDirection,
      walkDx: combo.perAction.walk.crownDxRange,
      walkDy: combo.perAction.walk.crownDyRange,
      attackJump: combo.perAction.attack?.maxCrownJump ?? null,
    }));

  const details = combos.map((combo) => ({
    job: combo.classId,
    sex: combo.sex,
    view: combo.view,
    walk: combo.perAction?.walk,
    attack: combo.perAction?.attack,
  }));
  console.log(JSON.stringify({ result: 'PAPERDOLL_SYNC_SWEEP', comboCount: combos.length, walkRanked, details, problems: combos.filter((combo) => combo.error) }, null, 2));
  socket.close();
} finally {
  browser.kill();
}
