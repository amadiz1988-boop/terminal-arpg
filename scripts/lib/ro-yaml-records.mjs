// The existing rAthena map-info parser, shared with the World Map teleport
// source index. This narrow reader tolerates upstream duplicate YAML keys.
export function parseYamlRecords(text, includeDrops = false) {
  const records = [];
  let record = null;
  let drop = null;
  let section = '';
  for (const raw of text.split(/\r?\n/)) {
    let match = raw.match(/^  - Id: (\d+)\s*$/);
    if (match) {
      record = { Id: Number(match[1]), Drops: [] };
      records.push(record);
      drop = null;
      section = '';
      continue;
    }
    if (!record || /^\s*#/.test(raw)) continue;
    match = raw.match(/^    ([A-Za-z][A-Za-z0-9]*):\s*(.*?)\s*$/);
    if (match) {
      if (match[1] === 'Drops') {
        drop = null;
        section = 'Drops';
        continue;
      }
      if (match[1] === 'Modes') {
        record.Modes = {};
        section = 'Modes';
        continue;
      }
      record[match[1]] = /^\d+$/.test(match[2]) ? Number(match[2]) : match[2];
      drop = null;
      section = '';
      continue;
    }
    match = raw.match(/^      ([A-Za-z][A-Za-z0-9]*):\s*(true|false)\s*$/);
    if (match && section === 'Modes') {
      record.Modes[match[1]] = match[2] === 'true';
      continue;
    }
    if (!includeDrops) continue;
    match = raw.match(/^      - Item:\s*(\S+)\s*$/);
    if (match) {
      drop = { Item: match[1] };
      record.Drops.push(drop);
      continue;
    }
    match = raw.match(/^        Rate:\s*(\d+)\s*$/);
    if (match && drop) drop.Rate = Number(match[1]);
  }
  return records;
}

export function rathenaFarmMonsterFlags(mob) {
  const isMvp = Number(mob?.MvpExp ?? 0) > 0;
  const isBoss = isMvp || mob?.Class === 'Boss';
  const isResource = mob?.Modes?.IgnoreMagic === true &&
    mob?.Modes?.IgnoreMelee === true &&
    mob?.Modes?.IgnoreMisc === true &&
    mob?.Modes?.IgnoreRanged === true;
  return { isMvp, isBoss, isResource };
}
