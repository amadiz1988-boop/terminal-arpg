/**
 * Player configuration contract shared by the Dashboard server and browser.
 *
 * This file describes configuration only. It never starts an executor, writes
 * an OpenKore command, mutates rAthena state, or claims that a setting is live.
 * The field names intentionally follow the harvested OpenKore configuration
 * names where a direct mature equivalent exists.
 */

export const CONFIG_VERSION = 1;

export const SUPPLY_RULE_ACTIONS = Object.freeze([
  'default',
  'ignore',
  'discard',
  'sell',
  'store',
  'keep',
]);

export const PICKUP_FLAGS = Object.freeze({
  DROP: -1,
  SKIP: 0,
  PICKUP: 1,
  PRIORITY: 2,
});

export const COMBAT_PROFILES = Object.freeze([
  'MELEE_DAMAGE',
  'RANGED_DAMAGE',
  'SKILL_CAST',
  'HYBRID_DAMAGE',
  'HEAL_SUPPORT',
  'COMBAT_SUPPORT',
  'FOLLOW_SUPPORT',
  'PASSIVE_FOLLOW',
]);

export const FIXED_POLICY = Object.freeze({
  loot: Object.freeze({ autoLoot: true, autoStore: false }),
  butterflyWing: Object.freeze({
    itemId: 602,
    presenceBased: true,
    nonConsumable: true,
    weight: 0,
  }),
  flyWing: Object.freeze({
    itemId: 601,
    presenceBased: true,
    nonConsumable: true,
    weight: 0,
  }),
});

export const PROFILE_DEFINITIONS = Object.freeze({
  MELEE_DAMAGE: {
    label: '近戰普攻',
    attackMode: 2,
    useWeapon: true,
    needsAttackSkill: false,
    needsSupportSkill: false,
  },
  RANGED_DAMAGE: {
    label: '遠程普攻',
    attackMode: 2,
    useWeapon: true,
    needsAttackSkill: false,
    needsSupportSkill: false,
  },
  SKILL_CAST: {
    label: '純技能攻擊',
    attackMode: 2,
    useWeapon: false,
    needsAttackSkill: true,
    needsSupportSkill: false,
  },
  HYBRID_DAMAGE: {
    label: '普攻加技能',
    attackMode: 2,
    useWeapon: true,
    needsAttackSkill: false,
    needsSupportSkill: false,
  },
  HEAL_SUPPORT: {
    label: '治療支援',
    attackMode: -1,
    useWeapon: false,
    needsAttackSkill: false,
    needsSupportSkill: true,
  },
  COMBAT_SUPPORT: {
    label: '戰鬥支援',
    attackMode: -1,
    useWeapon: false,
    needsAttackSkill: false,
    needsSupportSkill: true,
  },
  FOLLOW_SUPPORT: {
    label: '跟隨支援',
    attackMode: -1,
    useWeapon: false,
    needsAttackSkill: false,
    needsSupportSkill: true,
  },
  PASSIVE_FOLLOW: {
    label: '被動跟隨',
    attackMode: -1,
    useWeapon: false,
    needsAttackSkill: false,
    needsSupportSkill: false,
  },
});

// The form renderer consumes this descriptor. Keeping labels and paths here
// prevents a second browser-only schema from becoming authoritative.
export const CONFIG_FORM_SCHEMA = Object.freeze({
  supply: Object.freeze({
    title: '補給設定',
    fields: Object.freeze([
      { path: 'supply.enabled', label: '啟用自動補給', type: 'checkbox', group: '基本' },
      { path: 'supply.weightTriggerPercent', label: '負重觸發', type: 'number', min: 40, max: 88, group: '基本', matureKey: 'itemsMaxWeight_sellOrStore' },
      { path: 'supply.services.storage.enabled', label: '存倉', type: 'checkbox', group: '服務', matureKey: 'storageAuto' },
      { path: 'supply.services.withdraw.enabled', label: '提領', type: 'checkbox', group: '服務', matureKey: 'getAuto' },
      { path: 'supply.services.sell.enabled', label: '販售', type: 'checkbox', group: '服務', matureKey: 'sellAuto' },
      { path: 'supply.services.buy.enabled', label: '補給品採購', type: 'checkbox', group: '服務', matureKey: 'buyAuto' },
      { path: 'supply.services.buy.itemId', label: '採購道具 ID', type: 'number', min: 1, max: 1000000, group: '採購', matureKey: 'buyAuto' },
      { path: 'supply.services.buy.minAmount', label: '低於數量', type: 'number', min: 0, max: 30000, group: '採購', matureKey: 'buyAuto_minAmount' },
      { path: 'supply.services.buy.targetAmount', label: '補到數量', type: 'number', min: 0, max: 30000, group: '採購', matureKey: 'buyAuto_maxAmount' },
      { path: 'supply.services.buy.batchSize', label: '每批數量', type: 'number', min: 1, max: 30000, group: '採購', matureKey: 'buyAuto_batchSize' },
      { path: 'supply.services.buy.price', label: '單價', type: 'number', min: 0, max: 2000000000, group: '進階', matureKey: 'buyAuto_price', advanced: true },
      { path: 'supply.services.buy.zenyMinimum', label: '最低 Zeny', type: 'number', min: 0, max: 2000000000, group: '進階', matureKey: 'buyAuto_zeny', advanced: true },
      { path: 'supply.services.withdraw.itemId', label: '提領道具 ID', type: 'number', min: 1, max: 1000000, group: '提領', matureKey: 'getAuto', advanced: true },
      { path: 'supply.services.withdraw.minAmount', label: '提領低於數量', type: 'number', min: 0, max: 30000, group: '提領', matureKey: 'getAuto_minAmount', advanced: true },
      { path: 'supply.services.withdraw.targetAmount', label: '提領到數量', type: 'number', min: 0, max: 30000, group: '提領', matureKey: 'getAuto_maxAmount', advanced: true },
      { path: 'supply.services.withdraw.batchSize', label: '提領每批數量', type: 'number', min: 1, max: 30000, group: '提領', matureKey: 'getAuto_batchSize', advanced: true },
      { path: 'supply.tools.butterflyWing.required', label: '蝴蝶翅膀需存在', type: 'checkbox', group: '道具', fixed: true },
      { path: 'supply.tools.flyWing.enabled', label: '允許蒼蠅翅膀', type: 'checkbox', group: '道具', fixed: true },
      { path: 'supply.loot.autoLoot', label: '自動拾取', type: 'checkbox', group: '拾取', fixed: true },
      { path: 'supply.loot.autoStore', label: '自動存放拾取物', type: 'checkbox', group: '拾取', fixed: true },
    ]),
    arrays: Object.freeze([
      { path: 'supply.itemRules', title: '道具規則', kind: 'itemRule', advanced: false },
    ]),
  }),
  combat: Object.freeze({
    title: '戰鬥設定',
    fields: Object.freeze([
      { path: 'combat.profile', label: '戰鬥模式', type: 'select', options: COMBAT_PROFILES, group: '模式' },
      { path: 'combat.attack.mode', label: '攻擊模式', type: 'select', options: [-1, 0, 1, 2], group: '目標', matureKey: 'attackAuto' },
      { path: 'combat.attack.useWeapon', label: '使用武器普攻', type: 'checkbox', group: '目標', matureKey: 'attackUseWeapon' },
      { path: 'combat.attack.distance', label: '攻擊距離', type: 'number', min: 0, max: 30, group: '目標', matureKey: 'attackDistance' },
      { path: 'combat.attack.maxDistance', label: '最大攻擊距離', type: 'number', min: 0, max: 30, group: '目標', matureKey: 'attackMaxDistance' },
      { path: 'combat.attack.routeToLock', label: '返回鎖定地圖', type: 'checkbox', group: '目標', matureKey: 'attackAuto_routeToLock' },
      { path: 'combat.attack.checkLOS', label: '檢查視線', type: 'checkbox', group: '進階', matureKey: 'attackCheckLOS', advanced: true },
      { path: 'combat.attack.canSnipe', label: '允許遠距穿透', type: 'checkbox', group: '進階', matureKey: 'attackCanSnipe', advanced: true },
      { path: 'combat.attack.changeTarget', label: '允許改換目標', type: 'checkbox', group: '進階', matureKey: 'attackChangeTarget', advanced: true },
      { path: 'combat.travel.flyWing.enabled', label: '戰鬥中允許蒼蠅翅膀', type: 'checkbox', group: '生存', fixed: true },
      { path: 'combat.travel.teleport.hp', label: '低 HP 傳送條件', type: 'text', group: '生存', matureKey: 'teleportAuto_hp' },
      { path: 'combat.travel.teleport.sp', label: '低 SP 傳送條件', type: 'text', group: '生存', matureKey: 'teleportAuto_sp' },
      { path: 'combat.travel.teleport.lostTarget', label: '失去目標時傳送', type: 'checkbox', group: '生存', matureKey: 'teleportAuto_lostTarget' },
      { path: 'combat.travel.teleport.dropTarget', label: '放棄目標時傳送', type: 'checkbox', group: '生存', matureKey: 'teleportAuto_dropTarget' },
    ]),
    arrays: Object.freeze([
      { path: 'combat.skills.attackSlots', title: '攻擊技能', kind: 'attackSkill' },
      { path: 'combat.skills.selfSkills', title: '自身技能', kind: 'selfSkill' },
      { path: 'combat.skills.partySkills', title: '隊伍技能', kind: 'partySkill' },
    ]),
  }),
});

const clone = (value) => JSON.parse(JSON.stringify(value));
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const text = (value) => typeof value === 'string' && value.length <= 240;

export function defaultCanonicalConfig(revision = 0) {
  return {
    version: CONFIG_VERSION,
    revision,
    supply: {
      enabled: false,
      weightTriggerPercent: 75,
      services: {
        storage: { enabled: true },
        withdraw: { enabled: false, itemId: 501, minAmount: 0, targetAmount: 100, batchSize: 100 },
        sell: { enabled: true },
        buy: { enabled: true, itemId: 501, minAmount: 20, targetAmount: 100, batchSize: 100, price: 10, zenyMinimum: 10 },
      },
      itemRules: [],
      tools: {
        butterflyWing: { ...clone(FIXED_POLICY.butterflyWing), required: true },
        flyWing: { ...clone(FIXED_POLICY.flyWing), enabled: true },
      },
      loot: clone(FIXED_POLICY.loot),
    },
    combat: {
      profile: 'MELEE_DAMAGE',
      attack: { mode: 2, useWeapon: true, distance: 1, maxDistance: 1, routeToLock: true, checkLOS: true, canSnipe: false, changeTarget: true },
      skills: { attackSlots: [], selfSkills: [], partySkills: [] },
      conditions: { hp: '', sp: '' },
      travel: { flyWing: { ...clone(FIXED_POLICY.flyWing), enabled: true }, teleport: { hp: '10%', sp: '', lostTarget: false, dropTarget: false, maxTries: 3 } },
      loot: clone(FIXED_POLICY.loot),
    },
  };
}

function error(path, message) {
  return { path, message };
}

function checkFixed(errors, config) {
  if (config.supply.loot.autoLoot !== true) errors.push(error('supply.loot.autoLoot', '政策固定為自動拾取'));
  if (config.supply.loot.autoStore !== false) errors.push(error('supply.loot.autoStore', '政策固定為不自動存放拾取物'));
  if (config.combat.loot.autoLoot !== true) errors.push(error('combat.loot.autoLoot', '政策固定為自動拾取'));
  if (config.combat.loot.autoStore !== false) errors.push(error('combat.loot.autoStore', '政策固定為不自動存放拾取物'));
  for (const [path, expectedItemId] of [['supply.tools.butterflyWing', 602], ['supply.tools.flyWing', 601], ['combat.travel.flyWing', 601]]) {
    const tool = path.split('.').reduce((node, key) => node?.[key], config);
    if (!tool || tool.itemId !== expectedItemId || tool.presenceBased !== true || tool.nonConsumable !== true || tool.weight !== 0)
      errors.push(error(path, '傳送翅膀必須使用存在性、不可消耗、重量 0 的固定政策'));
  }
  if (typeof config.supply.tools.butterflyWing.required !== 'boolean') errors.push(error('supply.tools.butterflyWing.required', '蝴蝶翅膀需存在必須是布林值'));
  if (typeof config.supply.tools.flyWing.enabled !== 'boolean') errors.push(error('supply.tools.flyWing.enabled', '蒼蠅翅膀開關必須是布林值'));
  if (typeof config.combat.travel.flyWing.enabled !== 'boolean') errors.push(error('combat.travel.flyWing.enabled', '戰鬥蒼蠅翅膀開關必須是布林值'));
}

function checkSkill(errors, path, value, kind) {
  if (!isRecord(value) || !text(value.skill) || !value.skill.trim()) errors.push(error(path, '技能名稱必須存在'));
  for (const field of ['level']) if (!integer(value[field], 1, 10)) errors.push(error(`${path}.${field}`, '技能等級必須為 1 至 10'));
  for (const field of ['maxCastTime', 'minCastTime']) if (!integer(value[field], 0, 3600000)) errors.push(error(`${path}.${field}`, '施法時間必須為非負整數毫秒'));
  if (kind === 'attackSkill' && (!integer(value.dist, 0, 30) || !integer(value.maxDist, 0, 30))) errors.push(error(path, '攻擊技能距離必須為 0 至 30'));
  if (kind === 'partySkill' && (!integer(value.dist, 0, 30) || !integer(value.maxDist, 0, 30))) errors.push(error(path, '隊伍技能距離必須為 0 至 30'));
  if (value.conditions && !isRecord(value.conditions)) errors.push(error(`${path}.conditions`, '技能條件格式錯誤'));
}

export function validateCanonicalConfig(config) {
  const errors = [];
  if (!isRecord(config)) return [error('$', '設定必須是物件')];
  if (config.version !== CONFIG_VERSION) errors.push(error('version', `只支援設定版本 ${CONFIG_VERSION}`));
  if (!integer(config.revision, 0, Number.MAX_SAFE_INTEGER)) errors.push(error('revision', 'revision 必須為非負整數'));
  if (!isRecord(config.supply) || !isRecord(config.combat)) return [...errors, error('$', '供給與戰鬥設定必須同時存在')];
  if (typeof config.supply.enabled !== 'boolean') errors.push(error('supply.enabled', '必須是布林值'));
  if (!integer(config.supply.weightTriggerPercent, 40, 88)) errors.push(error('supply.weightTriggerPercent', '負重觸發必須為 40 至 88'));
  for (const path of ['supply.services.storage', 'supply.services.withdraw', 'supply.services.sell', 'supply.services.buy']) {
    const service = path.split('.').reduce((node, key) => node?.[key], config);
    if (!isRecord(service) || typeof service.enabled !== 'boolean') errors.push(error(path, '服務必須包含 enabled'));
  }
  for (const serviceName of ['buy', 'withdraw']) {
    const service = config.supply.services?.[serviceName];
    if (isRecord(service)) {
      const prefix = `supply.services.${serviceName}`;
      if (!integer(service.itemId, 1, 1000000)) errors.push(error(`${prefix}.itemId`, '道具 ID 無效'));
      for (const field of ['minAmount', 'targetAmount', 'batchSize']) if (!integer(service[field], field === 'batchSize' ? 1 : 0, 30000)) errors.push(error(`${prefix}.${field}`, '數量必須在合法範圍'));
      if (service.targetAmount < service.minAmount) errors.push(error(`${prefix}.targetAmount`, '目標數量不可低於觸發數量'));
      if (serviceName === 'buy') for (const field of ['price', 'zenyMinimum']) if (!integer(service[field], 0, 2000000000)) errors.push(error(`${prefix}.${field}`, '金額無效'));
    }
  }
  if (!Array.isArray(config.supply.itemRules) || config.supply.itemRules.length > 300) errors.push(error('supply.itemRules', '道具規則必須是 300 筆以內陣列'));
  for (const [index, rule] of (config.supply.itemRules ?? []).entries()) {
    if (!isRecord(rule) || !integer(rule.itemId, 1, 1000000)) errors.push(error(`supply.itemRules[${index}]`, '道具 ID 無效'));
    if (![...Object.values(PICKUP_FLAGS)].includes(rule.pickup)) errors.push(error(`supply.itemRules[${index}].pickup`, '拾取旗標無效'));
    for (const field of ['storage', 'sell', 'cartAdd', 'cartGet']) if (![0, 1].includes(rule[field])) errors.push(error(`supply.itemRules[${index}].${field}`, '道具控制旗標必須為 0 或 1'));
  }
  if (!COMBAT_PROFILES.includes(config.combat.profile)) errors.push(error('combat.profile', '戰鬥模式無效'));
  const attack = config.combat.attack;
  if (!isRecord(attack) || ![-1, 0, 1, 2].includes(attack.mode)) errors.push(error('combat.attack.mode', 'attackAuto 模式必須為 -1、0、1 或 2'));
  if (isRecord(attack)) {
    if (typeof attack.useWeapon !== 'boolean') errors.push(error('combat.attack.useWeapon', 'attackUseWeapon 必須是布林值'));
    for (const field of ['distance', 'maxDistance']) if (!integer(attack[field], 0, 30)) errors.push(error(`combat.attack.${field}`, '距離必須為 0 至 30'));
    for (const field of ['routeToLock', 'checkLOS', 'canSnipe', 'changeTarget']) if (typeof attack[field] !== 'boolean') errors.push(error(`combat.attack.${field}`, '必須是布林值'));
  }
  for (const [kind, values] of [['attackSkill', config.combat.skills?.attackSlots], ['selfSkill', config.combat.skills?.selfSkills], ['partySkill', config.combat.skills?.partySkills]]) {
    if (!Array.isArray(values) || values.length > 100) errors.push(error(`combat.skills.${kind}`, '技能設定必須是 100 筆以內陣列'));
    for (const [index, value] of (values ?? []).entries()) checkSkill(errors, `combat.skills.${kind}[${index}]`, value, kind);
  }
  if (!isRecord(config.combat.travel?.teleport) || !integer(config.combat.travel.teleport.maxTries, 0, 99)) errors.push(error('combat.travel.teleport', '傳送設定無效'));
  checkFixed(errors, config);
  return errors;
}

export function assertCanonicalConfig(config) {
  const errors = validateCanonicalConfig(config);
  if (errors.length) {
    const exception = new Error('設定驗證失敗');
    exception.code = 'CONFIG_VALIDATION_FAILED';
    exception.details = errors;
    throw exception;
  }
  return config;
}

function scalar(textValue, key) {
  const match = String(textValue ?? '').match(new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\t ]+([^\\r\\n]*)$`, 'm'));
  return match ? match[1].trim() : undefined;
}

function numberScalar(textValue, key) {
  const value = scalar(textValue, key);
  return value === undefined || value === '' ? undefined : Number(value);
}

function boolScalar(textValue, key) {
  const value = numberScalar(textValue, key);
  return value === undefined ? undefined : value !== 0;
}

function condition(value) {
  return value === undefined || value === '' ? '' : String(value).trim();
}

function parseRepeatedBlocks(configText, blockName) {
  const values = [];
  const pattern = new RegExp(`${blockName}(?:[\\t ]+([^\\s{]+))?[\\t ]*\\{([\\s\\S]*?)^\\}`, 'gm');
  let match;
  while ((match = pattern.exec(String(configText ?? '')))) {
    const block = {};
    for (const line of match[2].split(/\r?\n/)) {
      const pair = line.trim().match(/^([^\s#]+)(?:\s+(.+?))?\s*(?:#.*)?$/);
      if (pair) block[pair[1]] = pair[2]?.trim() ?? '';
    }
    values.push({ name: match[1] ?? '', block });
  }
  return values;
}

function itemRuleFromLegacy(itemId, action) {
  const rule = { itemId, pickup: PICKUP_FLAGS.PICKUP, storage: 0, sell: 0, cartAdd: 0, cartGet: 0, legacyAction: action };
  if (action === 'ignore') rule.pickup = PICKUP_FLAGS.SKIP;
  if (action === 'discard') rule.pickup = PICKUP_FLAGS.DROP;
  if (action === 'sell') rule.sell = 1;
  if (action === 'store') rule.storage = 1;
  return rule;
}

function profileFor(attack, skills) {
  if (attack.mode === -1) {
    if ((skills.selfSkills ?? []).some((skill) => /heal|recovery/i.test(skill.skill))) return 'HEAL_SUPPORT';
    return (skills.partySkills ?? []).length ? 'COMBAT_SUPPORT' : 'PASSIVE_FOLLOW';
  }
  if (!attack.useWeapon && skills.attackSlots.length) return 'SKILL_CAST';
  return skills.attackSlots.length ? 'HYBRID_DAMAGE' : 'MELEE_DAMAGE';
}

function skillFromCurrent(slot = {}, kind) {
  const base = {
    skill: String(slot.handle ?? slot.skill ?? '').trim(),
    level: Number(slot.level ?? slot.lv ?? 1),
    maxCastTime: Number(slot.maxCastTime ?? 0),
    minCastTime: Number(slot.minCastTime ?? 0),
    conditions: {},
  };
  if (slot.minimumSp !== undefined) base.conditions.sp = `> ${Number(slot.minimumSp)}%`;
  if (slot.hpBelow !== undefined) base.conditions.hp = `< ${Number(slot.hpBelow)}%`;
  if (slot.sp !== undefined) base.conditions.sp = String(slot.sp).trim();
  if (slot.hp !== undefined) base.conditions.hp = String(slot.hp).trim();
  if (isRecord(slot.conditions)) {
    if (slot.conditions.sp !== undefined) base.conditions.sp = String(slot.conditions.sp).trim();
    if (slot.conditions.hp !== undefined) base.conditions.hp = String(slot.conditions.hp).trim();
  }
  if (kind !== 'selfSkill') {
    base.dist = Number(slot.dist ?? slot.range ?? 1);
    base.maxDist = Number(slot.maxDist ?? slot.range ?? (kind === 'partySkill' ? 8 : 1));
  }
  if (kind === 'attackSkill') Object.assign(base, { maxAttempts: Number(slot.maxAttempts ?? 0), maxUses: Number(slot.maxUses ?? 0), monsters: String(slot.monsters ?? ''), notMonsters: String(slot.notMonsters ?? ''), previousDamage: String(slot.previousDamage ?? ''), isSelfSkill: Number(slot.isSelfSkill ?? 0), isStartSkill: Number(slot.isStartSkill ?? 0) });
  if (kind === 'partySkill') Object.assign(base, { target: String(slot.target ?? ''), notPartyOnly: Number(slot.notPartyOnly ?? 0), isSelfSkill: Number(slot.isSelfSkill ?? 0), noSmartHeal: Number(slot.noSmartHeal ?? 0) });
  if (kind === 'selfSkill') Object.assign(base, { smartEncore: Number(slot.smartEncore ?? 0), noSmartHeal: Number(slot.noSmartHeal ?? 0) });
  return base;
}

export function migrateLegacyConfig({ supplyCycle = {}, configText = '', skillAutomation = {}, source = 'legacy' } = {}) {
  const config = defaultCanonicalConfig(0);
  const mappings = [];
  const unmapped = [];
  const supply = config.supply;
  const add = (legacy, canonical, disposition, reason) => mappings.push({ legacy, canonical, disposition, reason });
  if (supplyCycle.enabled !== undefined) {
    supply.enabled = supplyCycle.enabled === true;
    add('supply-cycle.json.enabled', 'supply.enabled', 'MIGRATE', '保留原補給循環開關');
  }
  if (supplyCycle.returnWeight !== undefined) { supply.weightTriggerPercent = Number(supplyCycle.returnWeight); add('supply-cycle.json.returnWeight', 'supply.weightTriggerPercent', 'MIGRATE', '保留原 Web 負重門檻'); }
  for (const service of ['store', 'sell', 'buy']) if (supplyCycle[service] !== undefined) { supply.services[{ store: 'storage', sell: 'sell', buy: 'buy' }[service]].enabled = supplyCycle[service] !== false; add(`supply-cycle.json.${service}`, `supply.services.${service === 'store' ? 'storage' : service}.enabled`, 'MIGRATE', '保留原服務開關'); }
  if (isRecord(supplyCycle.withdraw)) {
    supply.services.withdraw = { ...supply.services.withdraw, ...supplyCycle.withdraw, enabled: supplyCycle.withdraw.enabled !== false };
    add('supply-cycle.json.withdraw', 'supply.services.withdraw', 'ADAPT', '保留 getAuto 提領的數量與開關欄位');
  }
  if (supplyCycle.redPotionMin !== undefined) supply.services.buy.minAmount = Number(supplyCycle.redPotionMin);
  if (supplyCycle.redPotionMax !== undefined) { supply.services.buy.targetAmount = Number(supplyCycle.redPotionMax); supply.services.buy.batchSize = Math.max(1, Number(supplyCycle.redPotionMax)); }
  if (supplyCycle.redPotionMin !== undefined || supplyCycle.redPotionMax !== undefined) add('supply-cycle.json.redPotionMin/redPotionMax', 'supply.services.buy.minAmount/targetAmount/batchSize', 'ADAPT', '對應 buyAuto 數量欄位');
  for (const rule of Array.isArray(supplyCycle.rules) ? supplyCycle.rules : []) {
    const itemId = Number(rule?.itemId);
    if (Number.isSafeInteger(itemId) && itemId > 0 && itemId !== 601 && itemId !== 602) supply.itemRules.push(itemRuleFromLegacy(itemId, String(rule.action ?? 'default')));
  }
  if (Array.isArray(supplyCycle.rules) && supplyCycle.rules.length) add('supply-cycle.json.rules[]', 'supply.itemRules[]', 'ADAPT', '保留原規則並改用成熟 pickup/items_control 旗標');
  const attack = config.combat.attack;
  const attackMode = numberScalar(configText, 'attackAuto');
  const useWeapon = boolScalar(configText, 'attackUseWeapon');
  if (attackMode !== undefined && [-1, 0, 1, 2].includes(attackMode)) { attack.mode = attackMode; add('config.txt attackAuto', 'combat.attack.mode', 'MIGRATE', '保留成熟攻擊模式'); }
  if (useWeapon !== undefined) { attack.useWeapon = useWeapon; add('config.txt attackUseWeapon', 'combat.attack.useWeapon', 'MIGRATE', '保留獨立武器開關'); }
  for (const [key, path, target] of [['attackDistance', 'distance', 'combat.attack.distance'], ['attackMaxDistance', 'maxDistance', 'combat.attack.maxDistance']]) { const value = numberScalar(configText, key); if (Number.isInteger(value)) { attack[path] = value; add(`config.txt ${key}`, target, 'MIGRATE', '保留成熟距離欄位'); } }
  for (const [key, field] of [['attackAuto_routeToLock', 'routeToLock'], ['attackCheckLOS', 'checkLOS'], ['attackCanSnipe', 'canSnipe'], ['attackChangeTarget', 'changeTarget']]) { const value = boolScalar(configText, key); if (value !== undefined) { attack[field] = value; add(`config.txt ${key}`, `combat.attack.${field}`, 'MIGRATE', '保留成熟布林欄位'); } }
  const hp = scalar(configText, 'teleportAuto_hp'); const sp = scalar(configText, 'teleportAuto_sp');
  if (hp !== undefined) config.combat.travel.teleport.hp = condition(hp);
  if (sp !== undefined) config.combat.travel.teleport.sp = condition(sp);
  for (const [key, field] of [['teleportAuto_lostTarget', 'lostTarget'], ['teleportAuto_dropTarget', 'dropTarget']]) { const value = boolScalar(configText, key); if (value !== undefined) config.combat.travel.teleport[field] = value; }
  if (hp !== undefined || sp !== undefined) add('config.txt teleportAuto_hp/sp', 'combat.travel.teleport.hp/sp', 'MIGRATE', '保留 checkSelfCondition 字串語意');
  const itemsTake = numberScalar(configText, 'itemsTakeAuto');
  if (itemsTake !== undefined) add('config.txt itemsTakeAuto', 'supply.loot.autoLoot', 'KEEP', '固定政策已是自動拾取');
  const attackBlocks = parseRepeatedBlocks(configText, 'attackSkillSlot');
  for (const entry of attackBlocks) {
    const skill = entry.name || entry.block.skill;
    if (skill) config.combat.skills.attackSlots.push(skillFromCurrent({ ...entry.block, skill }, 'attackSkill'));
    else unmapped.push('config.txt attackSkillSlot block without a skill name');
  }
  const selfBlocks = parseRepeatedBlocks(configText, 'useSelf_skill');
  for (const entry of selfBlocks) {
    const skill = entry.name || entry.block.skill;
    if (skill) config.combat.skills.selfSkills.push(skillFromCurrent({ ...entry.block, skill }, 'selfSkill'));
    else unmapped.push('config.txt useSelf_skill block without a skill name');
  }
  const partyBlocks = parseRepeatedBlocks(configText, 'partySkill');
  for (const entry of partyBlocks) {
    const skill = entry.name || entry.block.skill;
    if (skill) config.combat.skills.partySkills.push(skillFromCurrent({ ...entry.block, skill }, 'partySkill'));
    else unmapped.push('config.txt partySkill block without a skill name');
  }
  const flattenedSkills = new Map();
  for (const line of String(configText ?? '').split(/\r?\n/)) {
    const match = line.match(/^\s*(attackSkillSlot|useSelf_skill|partySkill)_(\d+)(?:_([^\s]+))?\s+(.+?)\s*$/);
    if (!match) continue;
    const kind = match[1] === 'attackSkillSlot' ? 'attackSkill' : match[1] === 'useSelf_skill' ? 'selfSkill' : 'partySkill';
    const index = Number(match[2]);
    const current = flattenedSkills.get(`${kind}:${index}`) ?? {};
    if (!match[3]) current.skill = match[4].trim();
    else current[match[3]] = match[4].trim();
    flattenedSkills.set(`${kind}:${index}`, current);
  }
  for (const [key, slot] of flattenedSkills) {
    const [kind] = key.split(':');
    if (kind === 'attackSkill') config.combat.skills.attackSlots.push(skillFromCurrent(slot, kind));
    if (kind === 'selfSkill') config.combat.skills.selfSkills.push(skillFromCurrent(slot, kind));
    if (kind === 'partySkill') config.combat.skills.partySkills.push(skillFromCurrent(slot, kind));
  }
  if (attackBlocks.length || selfBlocks.length || partyBlocks.length) add('config.txt repeated skill blocks', 'combat.skills.*[]', 'ADAPT', '保留重複技能編輯能力與成熟欄位');
  if (skillAutomation.attack) { config.combat.skills.attackSlots.push(skillFromCurrent(skillAutomation.attack, 'attackSkill')); add('live skillAutomation.attack', 'combat.skills.attackSlots[]', 'ADAPT', '保存既有 Web 技能設定'); }
  if (skillAutomation.self) { config.combat.skills.selfSkills.push(skillFromCurrent(skillAutomation.self, 'selfSkill')); add('live skillAutomation.self', 'combat.skills.selfSkills[]', 'ADAPT', '保存既有 Web 技能設定'); }
  if (skillAutomation.buff) { config.combat.skills.partySkills.push(skillFromCurrent(skillAutomation.buff, 'partySkill')); add('live skillAutomation.buff', 'combat.skills.partySkills[]', 'ADAPT', '保存既有 Web 技能設定'); }
  if (skillAutomation.attack || skillAutomation.self || skillAutomation.buff) add('live skillAutomation', 'combat.skills.*[]', 'REMOVE_DUPLICATE', '合併舊版技能表，避免相同技能在兩個編輯入口重複保存');
  config.combat.profile = profileFor(config.combat.attack, config.combat.skills);
  if (config.combat.attack.mode === -1 && config.combat.attack.useWeapon) config.combat.attack.useWeapon = false;
  config.supply.loot = clone(FIXED_POLICY.loot);
  config.combat.loot = clone(FIXED_POLICY.loot);
  const migration = { source, sourceVersion: 'legacy-openkore-web-v1', mappings, unmapped, policy: { fixedOverlays: ['loot.autoLoot=true', 'loot.autoStore=false', 'Butterfly/Fly presence based'] } };
  assertCanonicalConfig(config);
  return { config, migration };
}

export function canonicalToOpenKorePreview(config) {
  assertCanonicalConfig(config);
  const lines = [
    `attackAuto ${config.combat.attack.mode}`,
    `attackUseWeapon ${config.combat.attack.useWeapon ? 1 : 0}`,
    `attackDistance ${config.combat.attack.distance}`,
    `attackMaxDistance ${config.combat.attack.maxDistance}`,
    `attackAuto_routeToLock ${config.combat.attack.routeToLock ? 1 : 0}`,
    `attackCheckLOS ${config.combat.attack.checkLOS ? 1 : 0}`,
    `attackCanSnipe ${config.combat.attack.canSnipe ? 1 : 0}`,
    `attackChangeTarget ${config.combat.attack.changeTarget ? 1 : 0}`,
    `teleportAuto_hp ${config.combat.travel.teleport.hp}`,
    `teleportAuto_sp ${config.combat.travel.teleport.sp}`,
    `teleportAuto_lostTarget ${config.combat.travel.teleport.lostTarget ? 1 : 0}`,
    `teleportAuto_dropTarget ${config.combat.travel.teleport.dropTarget ? 1 : 0}`,
    `itemsTakeAuto 2`,
    `itemsMaxWeight_sellOrStore ${config.supply.weightTriggerPercent}`,
    `storageAuto ${config.supply.enabled && config.supply.services.storage.enabled ? 1 : 0}`,
    `getAuto ${config.supply.enabled && config.supply.services.withdraw.enabled ? 1 : 0}`,
    `sellAuto ${config.supply.enabled && config.supply.services.sell.enabled ? 1 : 0}`,
  ];
  return {
    configText: `${lines.join('\n')}\n`,
    pickupitems: ['all 1', '601 1 # Permanent Fly Wing', '602 1 # Permanent Butterfly Wing', ...config.supply.itemRules.map((rule) => `${rule.itemId} ${rule.pickup}`)].join('\n') + '\n',
    itemsControl: config.supply.itemRules.map((rule) => `${rule.itemId} 0 ${rule.storage} ${rule.sell} ${rule.cartAdd} ${rule.cartGet}`).join('\n') + (config.supply.itemRules.length ? '\n' : ''),
    applied: false,
    capability: 'CONFIG_ONLY_ADAPTER_PREVIEW',
  };
}

export function applyProfileTemplate(config, profile) {
  if (!COMBAT_PROFILES.includes(profile)) throw new Error(`未知戰鬥模式：${profile}`);
  const next = clone(config);
  next.combat.profile = profile;
  next.combat.attack.mode = PROFILE_DEFINITIONS[profile].attackMode;
  next.combat.attack.useWeapon = PROFILE_DEFINITIONS[profile].useWeapon;
  return next;
}

export { clone };
