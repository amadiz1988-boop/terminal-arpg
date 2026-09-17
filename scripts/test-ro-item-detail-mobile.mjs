/**
 * Mobile (390x844) acceptance for the original RO item description art.
 *
 * Real headless-Chrome run against the live dashboard entrypoint. Proves that
 * RoItemDetail renders the original client collection/ description art (not an
 * enlarged inventory icon) for the required item set, that the inventory icon
 * path differs from the description art path, that cards keep cardbmp art, and
 * that an item with no dedicated art gets only the bounded 48px icon fallback.
 *
 * Usage: node scripts/test-ro-item-detail-mobile.mjs
 * Exit 0 = PASS, Exit 1 = FAIL
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = process.env.RO_DEMO_ORIGIN ?? 'http://127.0.0.1:8788';
const fixture = JSON.parse(
  readFileSync('.local/ro-stack/multiplayer-test-v2-credentials.json', 'utf8'),
);

const REQUIRED_COLLECTION = [501, 1102, 2301];
const CARD_ITEM = 4001;
const REAL_FALLBACK = 909;

const profile = mkdtempSync(join(tmpdir(), 'ro-item-detail-mobile-'));
const port = 19489;
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
      throw new Error(response.result.exceptionDetails.text);
    return response.result.result.value;
  };
  const viewport = async (width, height, mobile) => {
    await call('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
    });
    await call('Emulation.setTouchEmulationEnabled', { enabled: mobile });
  };
  const screenshot = async (path) => {
    const result = await call('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    await writeFile(path, Buffer.from(result.result.data, 'base64'));
  };

  await call('Runtime.enable');
  await call('Page.enable');
  await call('Page.bringToFront');
  await viewport(390, 844, true);
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
  await waitFor(() => evaluate("Boolean(window.roAssetResolver && window.RoOriginalUiKit?.RoItemDetail)"));
  await waitFor(() => evaluate("Boolean(window.roAssetResolver.version?.())"));

  const inspect = async (itemId) => {
    const result = await evaluate(`(async () => {
      const resolver = window.roAssetResolver;
      let resolved = resolver.resolveItemAsset(${itemId});
      if (!resolved || resolved.diagnosticCode === 'MISSING_RO_ASSET')
        resolved = resolver.resolveEquipmentAsset(${itemId});
      const kit = window.RoOriginalUiKit;
      const model = kit.RoItemDetail.buildModel({ itemId: ${itemId} }, resolved ?? {});
      const panel = document.querySelector('#cardArtPreviewPanel');
      kit.RoItemDetail.render(panel, model);
      const image = document.querySelector('#cardArtPreviewImage');
      const artSource = model.dedicatedArt?.source ?? model.fallbackIcon?.source ?? null;
      let natural = null;
      if (artSource) {
        natural = await new Promise((resolve) => {
          const probe = new Image();
          probe.onload = () => resolve({ width: probe.naturalWidth, height: probe.naturalHeight });
          probe.onerror = () => resolve({ width: 0, height: 0 });
          probe.src = artSource;
        });
      }
      return {
        itemId: ${itemId},
        name: model.name,
        role: model.artRole,
        dedicatedRole: model.dedicatedArt?.role ?? null,
        fallbackRole: model.fallbackIcon?.role ?? null,
        artSource,
        renderedSrc: image?.getAttribute('src') ?? null,
        natural,
        iconWebPath: resolved?.icon?.webPath ?? null,
        collectionWebPath: resolved?.collectionArt?.webPath ?? null,
        badge: document.querySelector('#itemDetailArtBadge')?.textContent?.trim() ?? '',
        badgeHidden: document.querySelector('#itemDetailArtBadge')?.hidden ?? false,
        meta: document.querySelector('#cardArtPreviewMeta')?.textContent?.trim() ?? '',
        metaHidden: document.querySelector('#cardArtPreviewMeta')?.hidden ?? false,
        requirements: [...document.querySelectorAll('#itemDetailRequirements li')].map((line) => line.textContent),
        panelHidden: document.querySelector('#cardArtPreview')?.classList.contains('hidden') ?? true,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    })()`);
    return result;
  };

  const failures = [];
  const rows = [];

  for (const itemId of REQUIRED_COLLECTION) {
    const row = await inspect(itemId);
    rows.push(row);
    if (row.role !== 'collection-art') failures.push(`${itemId}: role=${row.role}`);
    if (!String(row.artSource ?? '').startsWith('/ro/client/collection/'))
      failures.push(`${itemId}: art not from collection family (${row.artSource})`);
    if (!row.iconWebPath || row.iconWebPath === row.collectionWebPath)
      failures.push(`${itemId}: icon path equals collection path`);
    if (!row.natural || row.natural.width <= 48 || row.natural.height <= 48)
      failures.push(`${itemId}: collection art did not render at real size`);
    if (row.renderedSrc !== row.artSource)
      failures.push(`${itemId}: rendered img src mismatch`);
    if (!row.badgeHidden || String(row.badge ?? '') !== '')
      failures.push(`${itemId}: internal provenance badge leaked into the player view (${row.badge})`);
    if (!row.metaHidden || String(row.meta ?? '') !== '')
      failures.push(`${itemId}: internal meta leaked into the player view (${row.meta})`);
    if (row.requirements.some((line) => /Item ID|原廠|目前無法裝備/.test(line)))
      failures.push(`${itemId}: internal requirement text leaked (${row.requirements.join('|')})`);
    if (row.overflow > 0) failures.push(`${itemId}: horizontal overflow ${row.overflow}`);
  }

  const card = await inspect(CARD_ITEM);
  rows.push(card);
  if (card.role !== 'card-art') failures.push(`${CARD_ITEM}: card role=${card.role}`);
  if (card.natural?.width !== 300 || card.natural?.height !== 400)
    failures.push(`${CARD_ITEM}: card art is not 300x400`);

  const fallback = await inspect(REAL_FALLBACK);
  rows.push(fallback);
  if (fallback.role !== null || fallback.fallbackRole !== 'item-icon')
    failures.push(`${REAL_FALLBACK}: missing bounded fallback (${fallback.role})`);
  if (!String(fallback.artSource ?? '').startsWith('/ro/client/items/'))
    failures.push(`${REAL_FALLBACK}: fallback is not the inventory icon`);
  if (fallback.natural && (fallback.natural.width > 48 || fallback.natural.height > 48))
    failures.push(`${REAL_FALLBACK}: fallback icon is upscaled`);

  // Observed beginner short sword: locate it in the served index and assert the
  // same rule (collection art if indexed, bounded fallback otherwise).
  const beginner = await evaluate(`(async () => {
    const payload = await fetch('/api/ro-assets', { cache: 'no-store' }).then((r) => r.json());
    const all = [...(payload.indexes?.items ?? []), ...(payload.indexes?.equipment ?? [])];
    const match = all.find((entry) => /初學者笨拙短劍|笨拙短劍/u.test(String(entry.canonicalZhHant ?? entry.zhHantName ?? '')));
    return match
      ? { itemId: match.itemId, name: match.canonicalZhHant ?? match.zhHantName, hasCollection: Boolean(match.collectionArt?.webPath) }
      : null;
  })()`);
  let beginnerRow = null;
  if (beginner?.itemId) {
    beginnerRow = await inspect(beginner.itemId);
    rows.push(beginnerRow);
    if (beginner.hasCollection) {
      if (beginnerRow.role !== 'collection-art')
        failures.push(`beginner(${beginner.itemId}): indexed collection art not used (${beginnerRow.role})`);
    } else if (beginnerRow.role !== null || beginnerRow.fallbackRole !== 'item-icon') {
      failures.push(`beginner(${beginner.itemId}): expected bounded fallback, got ${beginnerRow.role}`);
    }
  }

  await screenshot('docs/ro-item-detail-mobile-390x844.png');

  const report = { origin, viewport: '390x844', requiredCollection: REQUIRED_COLLECTION, card: CARD_ITEM, fallback: REAL_FALLBACK, beginner, rows };
  console.log(JSON.stringify(report, null, 2));
  if (failures.length) {
    console.log(`RO_ITEM_DETAIL_MOBILE_FAIL ${failures.length}`);
    for (const failure of failures) console.log(`  - ${failure}`);
    socket.close();
    process.exitCode = 1;
  } else {
    console.log('RO_ITEM_DETAIL_MOBILE_PASS');
    socket.close();
    process.exitCode = 0;
  }
} finally {
  browser.kill();
}
