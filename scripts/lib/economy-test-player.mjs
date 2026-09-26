import { clone, defaultConfigRow } from '../../ops/ro-stack/dashboard/config-schema.mjs';

export const ECONOMY_TEST_ACCOUNT_ID = 2000163;
export const ECONOMY_TEST_CHAR_ID = 150105;
export const ECONOMY_STORE_ITEM_ID = 502;
export const ECONOMY_SELL_ITEM_ID = 503;

export function parseEconomyCli(args) {
  const options = { execute: false, json: false, charId: ECONOMY_TEST_CHAR_ID, timeoutMs: 300000 };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--execute') options.execute = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--char') options.charId = Number(args[++index]);
    else if (arg === '--timeout') options.timeoutMs = Number(args[++index]) * 1000;
    else throw new Error(`INVALID_OPTION:${arg}`);
  }
  if (options.charId !== ECONOMY_TEST_CHAR_ID) throw new Error('FIXTURE_IDENTITY_REQUIRED');
  if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 10000 || options.timeoutMs > 600000)
    throw new Error('TIMEOUT_OUT_OF_RANGE');
  return options;
}

export function economyPrecondition(eligibility, state, inventory) {
  if (!eligibility || !state || !inventory) return 'AUTHORITY_UNAVAILABLE';
  if (eligibility.charId !== ECONOMY_TEST_CHAR_ID ||
      eligibility.accountId !== ECONOMY_TEST_ACCOUNT_ID ||
      eligibility.groupId !== 0 || eligibility.isTest !== true)
    return 'FIXTURE_IDENTITY_MISMATCH';
  if (!eligibility.characterOnline || !state.resident ||
      eligibility.ownershipState !== 'SERVER_AGENT' ||
      eligibility.agentMode !== 'PERSISTENT_IDLE' || eligibility.activeCommandCount !== 0)
    return 'FIXTURE_NOT_IDLE';
  if (state.inventory[502] !== 0 || state.inventory[503] !== 0 ||
      state.storage[502] !== 0 || state.storage[503] !== 0)
    return 'FIXTURE_PREIMAGE_NOT_EMPTY';
  if (!Number.isSafeInteger(inventory.inventorySlots) || inventory.inventorySlots + 2 > inventory.inventoryMaxSlots)
    return 'INVENTORY_CAPACITY_UNAVAILABLE';
  return null;
}

export function economyTestConfig(current, inventorySlots) {
  const next = clone(current);
  next.supply.enabled = true;
  next.supply.inventorySlotTrigger = inventorySlots + 2;
  next.supply.services.storage.enabled = true;
  next.supply.services.sell.enabled = true;
  next.supply.services.buy.enabled = false;
  const rules = next.supply.itemRules;
  for (const row of rules) {
    row.storage = false;
    row.sell = false;
  }
  for (const [item, storage, sell] of [['502', true, false], ['503', false, true]]) {
    const row = rules.find(candidate => candidate.item === item) ??
      (() => { const added = defaultConfigRow('itemRule'); added.item = item; rules.push(added); return added; })();
    row.keepAmount = 0;
    row.storage = storage;
    row.sell = sell;
  }
  return next;
}

export function economyDeltas(before, after) {
  if (!before || !after) return { store: false, sell: false, reason: 'AUTHORITATIVE_STATE_MISSING' };
  const stored = before.inventory[502] - after.inventory[502];
  const storageGain = after.storage[502] - before.storage[502];
  const sold = before.inventory[503] - after.inventory[503];
  const zenyGain = after.zeny - before.zeny;
  return {
    store: stored === 1 && storageGain === 1,
    sell: sold === 1 && zenyGain > 0,
    storeQuantity: stored,
    storageQuantity: storageGain,
    sellQuantity: sold,
    zenyGain,
  };
}
