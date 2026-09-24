import { actionLabel } from '../../../ops/ro-stack/web-experience/action-labels.mjs';

const definitions = [
  ['start_farm', 'automation_start', '掛機控制', 'mutation', '/api/automation', 'HTTP success plus authoritative AUTO_FARM', 'PA_STATE'],
  ['stop_farm', 'automation_stop', '掛機控制', 'mutation', '/api/automation', 'HTTP success plus authoritative persistent idle', 'PA_STATE'],
  ['change_farm_map', 'farm_map_switch', '地圖移動', 'mutation', '/api/grind-target', 'arrival plus farm target plus AUTO_FARM resume', 'PA_STATE'],
  ['use_fly_wing', 'use_item', '道具移動', 'mutation', '/api/item-action', 'accepted plus authoritative position change plus unchanged count', 'RATHENA_AUTHORITY'],
  ['use_butterfly_wing', 'use_item', '道具移動', 'mutation', '/api/item-action', 'accepted plus authoritative save-point return plus unchanged count', 'RATHENA_AUTHORITY'],
  ['inventory_load', 'inventory_open', '背包讀取', 'readOnly', '/api/state?view=full', 'inventory projection is available', 'RATHENA_AUTHORITY'],
  ['quest_open', 'quest_open', '任務讀取', 'readOnly', '/api/state?view=quest', 'quest projection is available', 'RATHENA_AUTHORITY'],
  ['character_enter', 'enter_game', '角色進入', 'readOnly', '/api/state?view=full', 'owned character state is available', 'RATHENA_AUTHORITY'],
  ['combat_log_load', 'combat_state_visible', '戰鬥紀錄', 'readOnly', '/api/events?interest=combat', 'bounded Event Ledger window is available', 'EVENT_LEDGER'],
  ['farm_stats_load', 'farm_stats_load', '掛機統計', 'readOnly', '/api/state?view=full', 'farm state projection is available', 'PA_STATE'],
  ['supply_return', 'supply_return', '補給流程', 'readOnly', '/api/state?view=full', 'supply pause, save-point return, service, route-back and combat resume', 'RECONCILE'],
];

export const ACTION_REGISTRY = Object.freeze(Object.fromEntries(definitions.map(([
  actionKey, labelKey, category, mutation, endpoint, successCondition, terminalLayer,
]) => [actionKey, Object.freeze({
  actionKey,
  zhTWLabel: labelKey === 'farm_stats_load' ? '載入掛機統計'
    : labelKey === 'supply_return' ? '補給返程'
      : actionLabel(labelKey),
  category,
  mutation,
  readOnly: mutation === 'readOnly',
  expectedEndpoint: endpoint,
  expectedSuccessCondition: successCondition,
  expectedTerminalLayer: terminalLayer,
  labelSource: labelKey,
})])));

export function getActionDefinition(actionKey) {
  return ACTION_REGISTRY[String(actionKey ?? '')] ?? null;
}

export function actionKeyForScenario(scenario) {
  const value = String(scenario ?? '');
  if (value === 'start-farm') return 'start_farm';
  if (value === 'stop-farm') return 'stop_farm';
  if (value === 'change-farm-map') return 'change_farm_map';
  if (value === 'use-fly-wing') return 'use_fly_wing';
  if (value === 'use-butterfly-wing') return 'use_butterfly_wing';
  if (value === 'supply-return') return 'supply_return';
  if (value === 'combat-cycle') return 'combat_log_load';
  return value.replace(/-/g, '_');
}

export function validateActionRegistry(registry = ACTION_REGISTRY) {
  const entries = Object.values(registry);
  const keys = entries.map((entry) => entry.actionKey);
  const labels = entries.map((entry) => entry.zhTWLabel);
  const required = ['actionKey', 'zhTWLabel', 'category', 'mutation', 'expectedEndpoint', 'expectedSuccessCondition', 'expectedTerminalLayer'];
  const errors = [];
  if (new Set(keys).size !== keys.length) errors.push('DUPLICATE_ACTION_KEY');
  for (const entry of entries) {
    for (const field of required) if (!entry[field]) errors.push(`${entry.actionKey}:${field}`);
  }
  if (new Set(labels).size !== labels.length && entries.length !== new Set(keys).size)
    errors.push('DUPLICATE_LABEL_WITH_DUPLICATE_KEY');
  return { ok: errors.length === 0, errors };
}
