(() => {
  'use strict';
  const refreshAfterMs = 60000;
  const loggedMissing = new Set();
  let state = { version: '', checkedAt: 0, indexes: {}, lookups: {}, npcsByMap: new Map() };
  let loading = null;
  let legacyItemIcons = new Set();

  const normalize = (value) => String(value ?? '').trim().toLocaleLowerCase('zh-Hant');
  const normalizeLooseItemName = (value) => normalize(value).replace(/[\s_'’-]+/gu, '');
  const aliases = (entry) => [
    entry.itemId, entry.skillId, entry.mobId, entry.npcId, entry.navigationId,
    entry.classId, entry.viewId, entry.npcKey, entry.mapId, entry.key,
    entry.aegisName, entry.internalName, entry.scriptName, entry.zhHantName,
    entry.canonicalZhHant, entry.enName, ...(entry.aliases ?? []),
  ].filter((value) => value !== null && value !== undefined);
  function rebuild(payload) {
    const lookups = {};
    for (const [kind, entries] of Object.entries(payload.indexes ?? {})) {
      const lookup = new Map();
      for (const entry of entries) for (const value of aliases(entry)) {
        const key = normalize(value);
        if (key && !lookup.has(key)) lookup.set(key, entry);
      }
      lookups[kind] = lookup;
    }
    const npcsByMap = new Map();
    for (const npc of payload.indexes?.npcs ?? []) {
      const list = npcsByMap.get(npc.map) ?? [];
      list.push(npc);
      npcsByMap.set(npc.map, list);
    }
    state = { version: payload.version, checkedAt: Date.now(), indexes: payload.indexes, lookups, npcsByMap };
  }
  async function load(force = false) {
    if (!force && state.version && Date.now() - state.checkedAt < refreshAfterMs) return state.version;
    if (loading) return loading;
    loading = fetch('/api/ro-assets', {
      cache: 'no-store',
      headers: state.version ? { 'if-none-match': `"${state.version}"` } : {},
    }).then(async (response) => {
      if (response.status === 304) {
        state.checkedAt = Date.now();
        return state.version;
      }
      if (!response.ok) throw new Error('RO 原廠資產索引讀取失敗');
      rebuild(await response.json());
      return state.version;
    }).finally(() => { loading = null; });
    return loading;
  }
  function missing(kind, query) {
    const key = `${kind}:${normalize(typeof query === 'object' ? JSON.stringify(query) : query)}`;
    if (!loggedMissing.has(key)) {
      loggedMissing.add(key);
      console.debug('MISSING_RO_ASSET', { kind, query });
    }
    return { kind, query, name: null, asset: null, assetStatus: 'missing', translationStatus: 'missing', verificationGrade: 'X', diagnosticCode: 'MISSING_RO_ASSET' };
  }
  function find(kind, query) {
    if (query && typeof query === 'object') {
      const priority = [
        'itemId', 'skillId', 'mobId', 'npcId', 'mapId', 'classId', 'viewId',
        'key', 'npcKey', 'aegisName', 'internalName', 'scriptName', 'name',
        'zhHantName', 'canonicalZhHant', 'enName',
      ];
      for (const value of priority.map((key) => query[key])) {
        const found = find(kind, value);
        if (found) return found;
      }
      return null;
    }
    return state.lookups[kind]?.get(normalize(query)) ?? null;
  }
  function assetFor(kind, entry) {
    let asset = null;
    if (kind === 'items' || kind === 'equipment') asset = entry.icon;
    if (kind === 'skills') asset = entry.icon;
    if (kind === 'monsters') asset = entry.thumbnail ?? entry.sprite;
    if (kind === 'npcs') asset = entry.sprite;
    if (kind === 'maps') asset = entry.miniMap ?? entry.worldMap;
    if (kind === 'paperDoll') asset = entry.body;
    return typeof asset === 'string' ? { webPath: asset } : asset ?? null;
  }
  function resolve(kind, query) {
    const entry = find(kind, query);
    if (!entry) return missing(kind, query);
    const assetStatus = entry.assetStatus ?? 'missing';
    return { ...entry, kind, name: entry.canonicalZhHant ?? entry.zhHantName ?? entry.enName ?? null, asset: assetFor(kind, entry), diagnosticCode: assetStatus === 'missing' ? 'MISSING_RO_ASSET' : null };
  }
  function resolveMonsterDisplayName(query) {
    return resolve('monsters', query)?.name ?? null;
  }
  function resolveItem(query) {
    const runtimeName = typeof query === 'object'
      ? String(query.name ?? '').trim()
      : String(query ?? '').trim();
    const slotMatch = runtimeName.match(/^(.*?)\s+\[(\d+)\]\s*$/u);
    const baseName = slotMatch?.[1]?.trim() ?? runtimeName;
    const requestedSlots = slotMatch ? Number(slotMatch[2]) : null;
    let indexed = find('items', query) ?? find('equipment', query);
    if (!indexed && baseName) {
      const normalizedBase = normalize(baseName);
      const looseBase = normalizeLooseItemName(baseName);
      const candidates = [...(state.indexes.items ?? []), ...(state.indexes.equipment ?? [])]
        .filter((entry) => aliases(entry).some((value) =>
          normalize(value) === normalizedBase || normalizeLooseItemName(value) === looseBase));
      indexed = requestedSlots === null
        ? candidates[0]
        : candidates.find((entry) => Number(entry.slots ?? 0) === requestedSlots) ?? candidates[0];
    }
    if (indexed) {
      const kind = state.indexes.items?.includes(indexed) ? 'items' : 'equipment';
      let resolved = resolve(kind, indexed.itemId);
      if (resolved.translationStatus === 'english-fallback' && /[\u3400-\u9fff]/u.test(runtimeName)) {
        resolved = { ...resolved, name: runtimeName, translationStatus: 'runtime-zh-hant', fallback: false };
      }
      return requestedSlots === null
        ? resolved
        : { ...resolved, name: `${resolved.name} [${requestedSlots}]` };
    }
    const aegisName = typeof query === 'object' ? query.aegisName : query;
    if (legacyItemIcons.has(aegisName)) return {
      kind: 'items', query, name: typeof query === 'object' ? query.name ?? null : null,
      aegisName, asset: { webPath: `/ro/client/items/${encodeURIComponent(aegisName)}.png` },
      assetStatus: 'ready', translationStatus: 'runtime-name', verificationGrade: 'D', diagnosticCode: null,
    };
    return missing('items', query);
  }
  function resolvePaperDoll(characterState, manifest) {
    const character = characterState?.character ?? characterState;
    const equipment = characterState?.equipment ?? [];
    if (!character || !manifest) return { layers: [], missing: ['character-or-manifest'], source: null, verification: 'X' };
    const sex = character.sex === 'F' ? 'female' : 'male';
    const jobs = { 0: 'novice', 1: 'swordsman', 2: 'mage', 3: 'archer', 4: 'acolyte', 5: 'merchant', 6: 'thief', 21: 'taekwon', 4046: 'taekwon', 23: 'supernovice', 24: 'gunslinger', 25: 'ninja' };
    const job = jobs[Number(character.classId)];
    const hair = Math.max(1, Math.min(42, Number(character.hair) || 1));
    const equipmentAt = (bit, slots, excluded = []) => equipment.find((item) =>
      !excluded.includes(item)
      && ((Number(item.equipMask ?? item.equipTarget) & bit) !== 0 || slots.includes(item.slot)));
    const headTop = equipmentAt(256, ['headTop']);
    const headMid = equipmentAt(512, ['headMid'], [headTop]);
    const headLow = equipmentAt(1, ['headLow', 'headLower'], [headTop, headMid]);
    const rightHand = equipment.find((item) => item.slot === 'rightHand');
    const leftHand = equipment.find((item) => item.slot === 'leftHand');
    const weapon = rightHand ? resolve('equipment', rightHand) : null;
    const shield = leftHand ? resolve('equipment', leftHand) : null;
    const weaponType = normalize(rightHand?.weaponType ?? weapon?.weaponType);
    const weaponKey = weapon?.paperDollAsset?.key
      ?? ({ bow: 'bow', dagger: 'dagger', '1hsword': 'sword', '2hsword': 'twoHandSword', '1hspear': 'spear', '2hspear': 'twoHandSpear', '1haxe': 'axe', '2haxe': 'twoHandAxe', mace: 'club', staff: 'rod', revolver: 'revolver' })[weaponType]
      ?? null;
    const weaponFallbackKey = weapon?.paperDollAsset?.fallbackKey ?? null;
    const shieldKey = shield?.paperDollAsset?.key
      ?? ({ 1: 'guard', 2: 'buckler', 3: 'shield', 4: 'mirrorShield' })[Number(leftHand?.viewId ?? shield?.viewId)]
      ?? null;
    const headgearAsset = (item, slot) => {
      if (!item) return null;
      const resolved = resolve('equipment', item);
      const viewId = Number(item.viewId ?? resolved?.paperDollAsset?.viewId ?? resolved?.viewId);
      const byView = manifest.equipment?.headgearByView?.[String(viewId)];
      if (byView?.slot === slot && byView?.[sex]) return byView[sex];
      return manifest.equipment?.[slot]?.[String(item.itemId)]?.[sex] ?? null;
    };
    const layers = {
      body: manifest.body?.[`${job}-${sex}`] ?? null,
      hair: manifest.hair?.[`${sex}-${hair}`] ?? null,
      head: headgearAsset(headTop, 'headTop'),
      headTop: headgearAsset(headTop, 'headTop'),
      headMid: headgearAsset(headMid, 'headMid'),
      headLow: headgearAsset(headLow, 'headLow'),
      weapon: weaponKey
        ? manifest.equipment?.weapon?.[weaponKey]?.[`${job}-${sex}`]
          ?? manifest.equipment?.weapon?.[weaponFallbackKey]?.[`${job}-${sex}`]
          ?? null
        : null,
      shield: shieldKey ? manifest.equipment?.shield?.[shieldKey]?.[`${job}-${sex}`] ?? null : null,
      garment: null, costume: null,
    };
    return {
      layers,
      layerOrder: manifest.layerOrder ?? ['headTopBack', 'headMidBack', 'headLowBack', 'weaponBack', 'hairBack', 'shieldBack', 'body', 'garment', 'shieldFront', 'weaponFront', 'hairFront', 'headLowFront', 'headMidFront', 'headTopFront', 'costume'],
      missing: Object.entries(layers).filter(([, value]) => !value).map(([key]) => key),
      source: '/ro/client/showcase/manifest.json', verification: 'A',
    };
  }

  window.roAssetResolver = Object.freeze({
    load, reload: () => load(true), version: () => state.version,
    registerItemManifest(keys) { legacyItemIcons = new Set(keys ?? []); },
    resolveItemAsset: resolveItem,
    resolveEquipmentAsset: (query) => resolve('equipment', query),
    resolveSkillAsset: (query) => resolve('skills', query),
    resolveMonsterAsset: (query) => resolve('monsters', query),
    resolveMonsterDisplayName,
    resolveNpcAsset: (query) => resolve('npcs', query),
    resolveNpcAssetsForMap: (mapId) =>
      (state.npcsByMap.get(mapId) ?? []).map((npc) => resolve('npcs', npc.npcId)),
    resolveMapAsset: (query) => resolve('maps', query),
    resolvePaperDoll,
  });
})();
