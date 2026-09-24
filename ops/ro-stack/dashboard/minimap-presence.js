// UI5 minimap realtime presence helpers.
// Pure, dependency-free logic shared by the Dashboard minimap renderer and the
// Node verification script. It intentionally reuses the same rectangle-overlap
// idea already used for pet avoidance in pet-companion.js instead of pulling in
// a layout engine.
(function (root) {
  'use strict';

  var CJK_CHAR = /[\u1100-\u11ff\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]/;

  var MINIMAP_FRESHNESS_STALE_FLOOR_MS = 1500;
  var MINIMAP_PLAYER_STALE_FLOOR_MS = 2000;

  function estimateLabelWidth(text, fontSize) {
    var size = Number(fontSize) > 0 ? Number(fontSize) : 11;
    var units = 0;
    for (var index = 0; index < String(text == null ? '' : text).length; index += 1) {
      units += CJK_CHAR.test(String(text)[index]) ? 1 : 0.58;
    }
    return units * size;
  }

  // STATE_FRESHNESS = authoritative state age at receive time + elapsed local
  // time since receipt. The server owns `ageMs` (clock-skew free); the browser
  // only contributes its own monotonic elapsed time.
  function freshnessAgeMs(state, nowPerf) {
    if (!state || !Number.isFinite(Number(state.ageMs))) return null;
    var elapsed =
      Number.isFinite(Number(nowPerf)) && Number.isFinite(Number(state.atPerf))
        ? Number(nowPerf) - Number(state.atPerf)
        : 0;
    return Math.max(0, Number(state.ageMs) + Math.max(0, elapsed));
  }

  function freshnessStaleThresholdMs(statusIntervalMs) {
    var interval = Number(statusIntervalMs);
    if (!Number.isFinite(interval) || interval <= 0)
      return MINIMAP_FRESHNESS_STALE_FLOOR_MS;
    return Math.max(MINIMAP_FRESHNESS_STALE_FLOOR_MS, interval * 2.5 + 250);
  }

  function playerStaleThresholdMs(statusIntervalMs) {
    var interval = Number(statusIntervalMs);
    if (!Number.isFinite(interval) || interval <= 0)
      return MINIMAP_PLAYER_STALE_FLOOR_MS;
    return Math.max(MINIMAP_PLAYER_STALE_FLOOR_MS, interval * 3 + 500);
  }

  function formatFreshnessMs(ageMs) {
    var value = Math.max(0, Number(ageMs) || 0);
    if (value < 1000) return Math.round(value) + 'ms';
    return (value / 1000).toFixed(1) + 's';
  }

  function freshnessState(ageMs, statusIntervalMs) {
    if (!Number.isFinite(Number(ageMs))) return 'unknown';
    if (Number(ageMs) >= freshnessStaleThresholdMs(statusIntervalMs)) return 'stale';
    if (Number(ageMs) >= 1000) return 'slow';
    return 'live';
  }

  function maxPlayerLabels(viewportWidth) {
    var width = Number(viewportWidth);
    return Number.isFinite(width) && width > 0 && width <= 600 ? 3 : 8;
  }

  function overlaps(left, right) {
    return (
      left.x < right.x + right.w &&
      left.x + left.w > right.x &&
      left.y < right.y + right.h &&
      left.y + left.h > right.y
    );
  }

  // Bounded label placement: nearer players win; each label tries a small set of
  // fixed offsets and is dropped when it would leave the canvas or collide.
  // candidates: [{ key, x, y, text, distance, markerSize }]
  function placePlayerLabels(candidates, options) {
    var opts = options || {};
    var width = Number(opts.width) || 0;
    var height = Number(opts.height) || 0;
    var fontSize = Number(opts.fontSize) > 0 ? Number(opts.fontSize) : 11;
    var maxLabels = Math.max(0, Number(opts.maxLabels) || 0);
    var margin = Number(opts.margin) || 2;
    var ordered = (candidates || []).slice().sort(function (a, b) {
      return Number(a.distance) - Number(b.distance);
    });
    var placements = [];
    var taken = [];
    for (var index = 0; index < ordered.length; index += 1) {
      if (placements.length >= maxLabels) break;
      var candidate = ordered[index];
      var text = String(candidate.text == null ? '' : candidate.text).trim();
      if (!text) continue;
      var w = estimateLabelWidth(text, fontSize) + 6;
      var h = fontSize + 4;
      var gap = (Number(candidate.markerSize) || 6) / 2 + 3;
      var offsets = [
        [gap, -h / 2],
        [-gap - w, -h / 2],
        [-w / 2, -gap - h],
        [-w / 2, gap],
        [gap, -gap - h],
        [-gap - w, -gap - h],
        [gap, gap],
        [-gap - w, gap],
      ];
      var chosen = null;
      for (var offsetIndex = 0; offsetIndex < offsets.length; offsetIndex += 1) {
        var rect = {
          x: candidate.x + offsets[offsetIndex][0],
          y: candidate.y + offsets[offsetIndex][1],
          w: w,
          h: h,
        };
        if (
          rect.x < margin ||
          rect.y < margin ||
          rect.x + rect.w > width - margin ||
          rect.y + rect.h > height - margin
        )
          continue;
        var collides = false;
        for (var takenIndex = 0; takenIndex < taken.length; takenIndex += 1)
          if (overlaps(rect, taken[takenIndex])) {
            collides = true;
            break;
          }
        if (collides) continue;
        chosen = rect;
        break;
      }
      if (!chosen) continue;
      taken.push(chosen);
      placements.push({
        key: candidate.key,
        text: text,
        x: chosen.x,
        y: chosen.y,
        w: chosen.w,
        h: chosen.h,
        fontSize: fontSize,
      });
    }
    return placements;
  }

  root.minimapPresence = {
    estimateLabelWidth: estimateLabelWidth,
    freshnessAgeMs: freshnessAgeMs,
    freshnessStaleThresholdMs: freshnessStaleThresholdMs,
    playerStaleThresholdMs: playerStaleThresholdMs,
    formatFreshnessMs: formatFreshnessMs,
    freshnessState: freshnessState,
    maxPlayerLabels: maxPlayerLabels,
    overlaps: overlaps,
    placePlayerLabels: placePlayerLabels,
    MINIMAP_FRESHNESS_STALE_FLOOR_MS: MINIMAP_FRESHNESS_STALE_FLOOR_MS,
    MINIMAP_PLAYER_STALE_FLOOR_MS: MINIMAP_PLAYER_STALE_FLOOR_MS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
