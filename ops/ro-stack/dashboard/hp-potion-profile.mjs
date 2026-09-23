// Pinned OpenKore processAutoItemUse/checkSelfCondition M1 HP subset. This
// only converts persisted character intent; rAthena remains item authority.
const supportedConditionKeys = new Set(['hp', 'timeout']);

export function resolveHpPotionProfile(config) {
  const rows = config?.combat?.itemUse;
  if (!Array.isArray(rows)) return { ok: false, reason: 'HP_POTION_CONFIG_INVALID' };
  const rules = [];
  for (const [index, row] of rows.entries()) {
    if (row?.disabled === true) continue;
    if (!row || typeof row !== 'object' || rules.length >= 8)
      return { ok: false, reason: 'HP_POTION_RULES_UNSUPPORTED', index };
    const itemText = String(row.item ?? '').trim();
    const itemId = Number(itemText);
    if (!/^\d+$/.test(itemText) || !Number.isSafeInteger(itemId) || itemId < 1 || itemId > 4294967295)
      return { ok: false, reason: 'HP_POTION_ITEM_ID_UNSUPPORTED', index };
    const condition = row.conditions;
    if (!condition || typeof condition !== 'object')
      return { ok: false, reason: 'HP_POTION_CONDITION_REQUIRED', index };
    for (const [key, value] of Object.entries(condition)) {
      if (supportedConditionKeys.has(key)) continue;
      if (value !== '' && value !== false && value !== 0 && value !== null && value !== undefined)
        return { ok: false, reason: 'HP_POTION_CONDITION_UNSUPPORTED', index, key };
    }
    const hpMatch = /^<\s*(\d{1,3})%$/.exec(String(condition.hp ?? '').trim());
    const belowPercent = Number(hpMatch?.[1]);
    if (!hpMatch || belowPercent < 1 || belowPercent > 100)
      return { ok: false, reason: 'HP_POTION_HP_CONDITION_UNSUPPORTED', index };
    const timeoutSeconds = Number(condition.timeout ?? 0);
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds < 0 || timeoutSeconds > 3600000)
      return { ok: false, reason: 'HP_POTION_TIMEOUT_INVALID', index };
    rules.push({ itemId, belowPercent, timeoutMs: Math.round(timeoutSeconds * 1000) });
  }
  return { ok: true, rules };
}
