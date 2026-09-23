// Shared normalization for the canonical OpenKore twRO map-name table.
//
// Used by both build-ro-map-info.mjs (map panel data) and
// build-ro-map-names.mjs (the web-served canonical map-name index consumed by
// resolveMapDisplayName). Keep this the single parsing path so the canonical
// zh-TW names never fork into a second handwritten dictionary.
export function parseTwroMapNames(text) {
  const values = new Map();
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const match = line.match(/^\s*([^.#\s]+)\.rsw#\s*(.*?)\s*#/);
    if (match && !values.has(match[1])) values.set(match[1], match[2]);
  }
  return values;
}
