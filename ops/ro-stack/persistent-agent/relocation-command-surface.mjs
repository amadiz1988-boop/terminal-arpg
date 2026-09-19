// SERVER_AGENT relocation -> EXISTING command contract binding (PURE).
//
// CP-R2.1: binds relocation-executor stages to the already-deployed 28-action
// contract. It adds NO new command, NO travel engine, NO Kafra engine, NO
// item-use command and NO NPC/dialog engine.
//
// Existing actions used (exact names from conf/persistent_agent_commands.json):
//   start_navigation, talk_to_npc, dialog_next, dialog_select, dialog_close,
//   use_item, start_farm
//
// Menu indices and the Kafra NPC identity are CONTENT DATA supplied by the
// caller; they are never guessed or hardcoded here. If they are missing the
// binding fails closed.

export const EXISTING_ACTION = Object.freeze({
  START_NAVIGATION: 'start_navigation',
  TALK_TO_NPC: 'talk_to_npc',
  DIALOG_NEXT: 'dialog_next',
  DIALOG_SELECT: 'dialog_select',
  DIALOG_CLOSE: 'dialog_close',
  USE_ITEM: 'use_item',
  START_FARM: 'start_farm',
});

const FORBIDDEN = /service_transport|openkore|\.cmd\b|\.result\b|db_teleport|zeny|7060/i;

function navigationRoute(step) {
  return step.route;
}

// Expand one plan step into the ordered list of existing commands to emit.
// Returns { commands } or { missing } when required content data is absent.
export function existingCommandsForStep(step, context = {}) {
  const kafra = context.kafra ?? null;
  const base = { targetMap: step.targetMap };
  switch (step.kind) {
    case 'DIRECT_TO_HUB':
    case 'DIRECT_TO_TARGET':
      return { commands: [{ action: EXISTING_ACTION.START_NAVIGATION,
        payload: { route: navigationRoute(step) } }] };
    case 'KAFRA_SAVE':
      if (!kafra?.npcName || !Number.isInteger(kafra.saveMenuIndex))
        return { missing: 'kafra_save_content' };
      return { commands: [
        { action: EXISTING_ACTION.TALK_TO_NPC,
          payload: { npcName: kafra.npcName, targetMap: step.npcMap, goal: 'save' } },
        { action: EXISTING_ACTION.DIALOG_SELECT, payload: { index: kafra.saveMenuIndex } },
        { action: EXISTING_ACTION.DIALOG_CLOSE, payload: {} },
      ] };
    case 'CLOSE_NPC':
      return { commands: [{ action: EXISTING_ACTION.DIALOG_CLOSE, payload: {} }] };
    case 'BUTTERFLY_WING':
      return { commands: [{ action: EXISTING_ACTION.USE_ITEM,
        payload: { itemId: step.itemId } }] };
    case 'KAFRA_DIALOG_TRANSFER':
      if (!kafra?.npcName || !Number.isInteger(kafra.transportMenuIndex) ||
        !Number.isInteger(kafra.cityMenuIndex))
        return { missing: 'kafra_transfer_content' };
      return { commands: [
        { action: EXISTING_ACTION.TALK_TO_NPC,
          payload: { npcName: kafra.npcName, targetMap: step.npcMap, goal: 'transport' } },
        { action: EXISTING_ACTION.DIALOG_NEXT, payload: {} },
        { action: EXISTING_ACTION.DIALOG_SELECT, payload: { index: kafra.transportMenuIndex } },
        { action: EXISTING_ACTION.DIALOG_NEXT, payload: {} },
        { action: EXISTING_ACTION.DIALOG_SELECT, payload: { index: kafra.cityMenuIndex } },
        { action: EXISTING_ACTION.DIALOG_CLOSE, payload: {} },
      ] };
    case 'START_FARM':
      return { commands: [{ action: EXISTING_ACTION.START_FARM, payload: {
        targetMap: step.targetMap, mobId: step.mobId,
        lootEnabled: true, survivalEnabled: true, deathRecoveryEnabled: true } }] };
    case 'VERIFY_SAVEPOINT':
    case 'VERIFY_SERVICE_ARRIVAL':
      return { commands: [] }; // observation-only
    default:
      return { missing: 'unknown_step' };
  }
}

// Full ordered command list for a plan (used by reconcile dispatch and tests).
export function existingCommandsForPlan(plan, context = {}) {
  if (!plan || plan.policy === 'UNREACHABLE')
    return { reason: plan?.reason ?? 'farm_target_invalid', commands: [] };
  const commands = [];
  for (const step of plan.steps) {
    const expanded = existingCommandsForStep(step, context);
    if (expanded.missing)
      return { reason: 'kafra_dialog_failed', missing: expanded.missing, commands };
    commands.push(...expanded.commands);
  }
  if (FORBIDDEN.test(JSON.stringify(commands)))
    return { reason: 'invalid_command_surface', commands: [] };
  return { commands };
}
