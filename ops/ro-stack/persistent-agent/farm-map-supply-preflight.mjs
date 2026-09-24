// A Web admission guard for a native supply decision. Native repeats this
// predicate before stopping a farm and again before charging for a teleport.
// Missing or stale read-model data must never be interpreted as "no supply".
export function farmMapSupplyPreflight(snapshot, { accountId, charId, revision,
  currentMap, maxAgeMs } = {}) {
  const validInteger = (value, minimum = 0) => Number.isSafeInteger(value) && value >= minimum;
  if (!snapshot || snapshot.accountId !== accountId || snapshot.charId !== charId ||
      !snapshot.resident || snapshot.revision !== revision ||
      snapshot.map !== currentMap || !validInteger(snapshot.ageMs) ||
      snapshot.ageMs > maxAgeMs ||
      !validInteger(snapshot.inventorySlots) ||
      !validInteger(snapshot.inventoryMaxSlots, 1) ||
      snapshot.inventorySlots > snapshot.inventoryMaxSlots ||
      !validInteger(snapshot.weight) || !validInteger(snapshot.maxWeight, 1) ||
      snapshot.weight > snapshot.maxWeight ||
      typeof snapshot.supplyRequired !== 'boolean')
    return { allowed: false, reason: 'SUPPLY_PREFLIGHT_UNAVAILABLE' };
  if (snapshot.supplyRequired)
    return { allowed: false, reason: 'SUPPLY_REQUIRED',
      supplyReason: snapshot.supplyReason || 'SUPPLY_REQUIRED' };
  return { allowed: true, reason: 'READY' };
}

export function farmSwitchReachedTarget({ currentMap, targetMap, mode }) {
  return currentMap === targetMap && mode === 'AUTO_FARM';
}

export function mayRetryFarmSwitch(intent, revision, now = Date.now()) {
  if (!intent || !Number.isSafeInteger(intent.attempts) || intent.attempts >= 3)
    return false;
  if (intent?.retryAfter > now) return false;
  return true;
}

// The Web can observe a paid-arrival receipt but cannot validate it. Native
// must recheck map, inventory, Zeny and cooldown before confirming a resume.
export function paidFarmSwitchResumeDecision({ intent, pending, command,
  live, revision } = {}) {
  if (intent?.kind !== 'world-map-farm' || intent.paidResumeAttempted === true ||
      !Number.isSafeInteger(revision) || revision < 0 ||
      pending?.stage !== 'BLOCKED' || pending.stageBeforeBlock !== 'ARRIVED_PAID' ||
      pending.reason !== 'SUPPLY_RESTART_RETRY_REQUIRED' ||
      pending.targetMap !== intent.targetMap ||
      !pending.commandId || command?.commandId !== pending.commandId ||
      command.status !== 'REJECTED' ||
      command.reasonCode !== 'SUPPLY_RESTART_RETRY_REQUIRED' ||
      live?.fresh !== true || live.map !== intent.targetMap ||
      live.resident !== true || live.revision !== revision)
    return { allowed: false, reason: 'SUPPLY_PAID_ARRIVAL_UNAVAILABLE' };
  return { allowed: true, reason: 'PAID_ARRIVAL_RECEIPT_OBSERVED' };
}
