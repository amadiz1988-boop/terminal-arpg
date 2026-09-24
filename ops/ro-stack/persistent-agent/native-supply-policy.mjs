// Convert one character's saved configuration into the bounded native policy.
// Names are deliberately excluded: item identity must be a numeric rAthena ID.
export function nativeSupplyPolicy(config) {
  const supply = config?.supply;
  const enabled = supply?.enabled;
  const storageEnabled = supply?.services?.storage?.enabled;
  const sellEnabled = supply?.services?.sell?.enabled;
  const buyEnabled = supply?.services?.buy?.enabled;
  const weightTriggerPercent = supply?.weightTriggerPercent;
  const inventorySlotTrigger = supply?.inventorySlotTrigger;
  if ([enabled, storageEnabled, sellEnabled, buyEnabled].some((value) => typeof value !== 'boolean') ||
      !Number.isSafeInteger(weightTriggerPercent) || weightTriggerPercent < 1 ||
      weightTriggerPercent > 89 || !Number.isSafeInteger(inventorySlotTrigger) ||
      inventorySlotTrigger < 1 || inventorySlotTrigger > 1000)
    throw new Error('SUPPLY_POLICY_UNAVAILABLE');
  const rows = Array.isArray(supply?.itemRules) ? supply.itemRules : [];
  if (rows.length > 256) throw new Error('SUPPLY_POLICY_UNAVAILABLE');
  const all = rows.find((row) => row.item === 'all') ??
    { item: 'all', keepAmount: 0, storage: true, sell: false };
  const itemRules = [all, ...rows.filter((row) => row.item !== 'all')]
    .map((row) => {
      const itemId = row.item === 'all' ? 0 : Number(row.item);
      const keepAmount = Number(row.keepAmount);
      if (!Number.isSafeInteger(itemId) || itemId < 0 || itemId > 1_000_000 ||
          !Number.isSafeInteger(keepAmount) || keepAmount < 0 ||
          keepAmount > 30_000 || typeof row.storage !== 'boolean' ||
          typeof row.sell !== 'boolean')
        throw new Error('SUPPLY_POLICY_UNAVAILABLE');
      return { itemId, keepAmount, storage: row.storage, sell: row.sell };
    });
  if (new Set(itemRules.map((row) => row.itemId)).size !== itemRules.length)
    throw new Error('SUPPLY_POLICY_UNAVAILABLE');
  const buyRules = (supply.services?.buy?.rules ?? [])
    .filter((row) => row.disabled !== true)
    .map((row) => {
      const itemId = Number(row.item);
      const minAmount = Number(row.minAmount);
      const maxAmount = Number(row.maxAmount);
      if (!Number.isSafeInteger(itemId) || itemId <= 0 || itemId > 1_000_000 ||
          !Number.isSafeInteger(minAmount) || minAmount < 0 ||
          !Number.isSafeInteger(maxAmount) || maxAmount === 0 || maxAmount < minAmount ||
          maxAmount > 30_000)
        throw new Error('SUPPLY_POLICY_UNAVAILABLE');
      return { itemId, minAmount, maxAmount };
    });
  if (buyRules.length > 32) throw new Error('SUPPLY_POLICY_UNAVAILABLE');
  if (new Set(buyRules.map((row) => row.itemId)).size !== buyRules.length)
    throw new Error('SUPPLY_POLICY_UNAVAILABLE');
  return { enabled, storageEnabled, sellEnabled, buyEnabled,
    weightTriggerPercent, inventorySlotTrigger, itemRules, buyRules };
}
