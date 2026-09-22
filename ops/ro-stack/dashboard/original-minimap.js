(function attachOriginalMinimap(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.roOriginalMinimap = api;
})(typeof globalThis === 'object' ? globalThis : this, function buildApi(root) {
  'use strict';

  const FALLBACK_REASONS = Object.freeze({
    MISSING: 'ORIGINAL_ASSET_MISSING',
    INVALID: 'ORIGINAL_ASSET_INVALID',
    LOAD_FAILED: 'ORIGINAL_ASSET_LOAD_FAILED',
  });

  function fitRect(containerWidth, containerHeight, sourceWidth, sourceHeight) {
    const width = Math.max(1, Number(containerWidth) || 1);
    const height = Math.max(1, Number(containerHeight) || 1);
    const naturalWidth = Math.max(1, Number(sourceWidth) || 1);
    const naturalHeight = Math.max(1, Number(sourceHeight) || 1);
    const scale = Math.min(width / naturalWidth, height / naturalHeight);
    const drawWidth = naturalWidth * scale;
    const drawHeight = naturalHeight * scale;
    return {
      x: (width - drawWidth) / 2,
      y: (height - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    };
  }

  function viewportRect(baseRect, map, player, zoom = 1, canvas = {}) {
    const factor = Math.min(8, Math.max(1, Number(zoom) || 1));
    if (factor === 1) return { ...baseRect };
    const width = baseRect.width * factor;
    const height = baseRect.height * factor;
    const mapWidth = Math.max(1, Number(map?.width) || 1);
    const mapHeight = Math.max(1, Number(map?.height) || 1);
    const playerX = Math.min(mapWidth, Math.max(0, Number(player?.x) || 0));
    const playerY = Math.min(mapHeight, Math.max(0, Number(player?.y) || 0));
    const canvasWidth = Math.max(1, Number(canvas.width) || baseRect.width);
    const canvasHeight = Math.max(1, Number(canvas.height) || baseRect.height);
    let x = canvasWidth / 2 - (playerX / mapWidth) * width;
    let y = canvasHeight / 2 - ((mapHeight - playerY) / mapHeight) * height;
    x = width <= canvasWidth ? (canvasWidth - width) / 2 : Math.min(0, Math.max(canvasWidth - width, x));
    y = height <= canvasHeight ? (canvasHeight - height) / 2 : Math.min(0, Math.max(canvasHeight - height, y));
    return { x, y, width, height };
  }

  function worldMapCoordinate(position, map, rect) {
    const mapWidth = Math.max(1, Number(map?.width) || 1);
    const mapHeight = Math.max(1, Number(map?.height) || 1);
    const x = Number(position?.x);
    const y = Number(position?.y);
    return {
      x: rect.x + (Number.isFinite(x) ? x : 0) * (rect.width / mapWidth),
      y:
        rect.y +
        (mapHeight - (Number.isFinite(y) ? y : 0)) *
          (rect.height / mapHeight),
    };
  }

  function createManager(options = {}) {
    const manifestUrl = options.manifestUrl ?? '/ro/client/minimaps/manifest.json';
    const assetRoot = String(options.assetRoot ?? '').replace(/\/$/, '');
    const fetchImpl = options.fetchImpl ?? root.fetch?.bind(root);
    const ImageClass = options.ImageClass ?? root.Image;
    const onChange = options.onChange ?? (() => {});
    let manifest = null;
    let manifestPromise = null;
    let mode = 'auto';
    let zoom = 1;
    const records = new Map();

    async function loadManifest() {
      if (manifest) return manifest;
      if (!manifestPromise) {
        manifestPromise = fetchImpl(manifestUrl, { cache: 'default' })
          .then((response) => {
            if (!response.ok) throw new Error(`manifest ${response.status}`);
            return response.json();
          })
          .then((value) => {
            manifest = value;
            return value;
          });
      }
      return manifestPromise;
    }

    function entryFor(map) {
      return manifest?.entries?.find((entry) => entry.map === map) ?? null;
    }

    async function load(map) {
      if (!map) return null;
      if (records.has(map)) return records.get(map).promise;
      const record = {
        map,
        status: 'LOADING',
        reason: null,
        entry: null,
        image: null,
      };
      record.promise = (async () => {
        try {
          await loadManifest();
          record.entry = entryFor(map);
          if (
            !record.entry ||
            record.entry.availability !== 'AVAILABLE' ||
            !record.entry.webAsset
          ) {
            record.status = 'FALLBACK';
            record.reason = FALLBACK_REASONS.MISSING;
            return record;
          }
          if (!ImageClass) throw new Error('Image constructor unavailable');
          record.image = await new Promise((resolve, reject) => {
            const image = new ImageClass();
            image.decoding = 'async';
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('image load failed'));
            image.src = assetRoot
              ? `${assetRoot}/${record.entry.webAsset.split('/').pop()}`
              : record.entry.webAsset;
          });
          if (
            Number(record.image.naturalWidth || record.image.width) !==
              Number(record.entry.width) ||
            Number(record.image.naturalHeight || record.image.height) !==
              Number(record.entry.height)
          ) {
            record.status = 'FALLBACK';
            record.reason = FALLBACK_REASONS.INVALID;
            record.image = null;
            return record;
          }
          record.status = 'READY';
          return record;
        } catch {
          record.status = 'FALLBACK';
          record.reason = record.entry
            ? FALLBACK_REASONS.LOAD_FAILED
            : FALLBACK_REASONS.MISSING;
          record.image = null;
          return record;
        } finally {
          onChange(record);
        }
      })();
      records.set(map, record);
      return record.promise;
    }

    function state(map) {
      const record = records.get(map) ?? null;
      if (mode === 'collision')
        return {
          mode: 'COLLISION_MAP',
          reason: 'DEBUG_COLLISION_MODE',
          entry: record?.entry ?? entryFor(map),
          image: null,
        };
      if (record?.status === 'READY' && record.image)
        return {
          mode: 'RO_ORIGINAL',
          reason: null,
          entry: record.entry,
          image: record.image,
        };
      return {
        mode: 'COLLISION_MAP',
        reason: record?.reason ?? FALLBACK_REASONS.MISSING,
        entry: record?.entry ?? entryFor(map),
        image: null,
      };
    }

    function setMode(nextMode) {
      if (!['auto', 'original', 'collision'].includes(nextMode))
        throw new Error('Unsupported minimap mode');
      mode = nextMode;
      onChange({ type: 'mode', mode });
      return mode;
    }

    function setZoom(nextZoom) {
      zoom = Math.min(8, Math.max(1, Number(nextZoom) || 1));
      onChange({ type: 'zoom', zoom });
      return zoom;
    }

    return {
      load,
      loadManifest,
      state,
      setMode,
      setZoom,
      getMode: () => mode,
      getZoom: () => zoom,
      entryFor,
    };
  }

  return Object.freeze({
    FALLBACK_REASONS,
    fitRect,
    viewportRect,
    worldMapCoordinate,
    createManager,
  });
});
