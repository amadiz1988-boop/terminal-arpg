const entries = [
  ['AUTH_FAILED', 'API', 'AUTH', '驗證失敗'],
  ['OWNERSHIP_MISMATCH', 'OWNERSHIP', 'VALIDATION', '角色不屬於目前登入帳號'],
  ['INVALID_RUNTIME_STATE', 'CONTROLLER', 'PRECONDITION', '目前 runtime 狀態不符合操作前提'],
  ['SUPPLY_ROUTE_UNAVAILABLE', 'CONTROLLER', 'PRECONDITION', '補給路線不可用'],
  ['RELOCATION_UNSUPPORTED', 'CONTROLLER', 'PLANNING', '目的地不支援合法移動'],
  ['COMMAND_DISPATCH_FAILED', 'COMMAND_DISPATCH', 'DISPATCH', '命令未能送出'],
  ['NATIVE_REJECTED', 'NATIVE_ACCEPT', 'ACK', 'Native 拒絕命令'],
  ['STATE_TRANSITION_TIMEOUT', 'PA_STATE', 'CONVERGE', '權威狀態在期限內未收斂'],
  ['AUTHORITATIVE_POSITION_UNCHANGED', 'RATHENA_AUTHORITY', 'VERIFY', '權威位置未改變'],
  ['EVENT_NOT_OBSERVED', 'EVENT_LEDGER', 'OBSERVE', '期限內未觀察到必要事件'],
  ['RECONCILIATION_FAILED', 'RECONCILE', 'VERIFY', '狀態重整失敗'],
  ['COMMAND_NOT_CREATED', 'COMMAND_DISPATCH', 'CREATE', '未建立命令'],
  ['INVALID_PRECONDITION', 'CONTROLLER', 'PRECONDITION', '操作前提不成立'],
  ['TRACE_PROPAGATION_GAP', 'RECONCILE', 'CORRELATE', 'trace 尚未跨所有 production layer 持續傳遞'],
  ['UNKNOWN_ERROR', 'API', 'UNKNOWN', '未分類錯誤'],
];

export const ERROR_TAXONOMY = Object.freeze(Object.fromEntries(entries.map(([code, layer, stage, publicMessage]) => [
  code, Object.freeze({ code, layer, stage, publicMessage }),
])));

const aliases = new Map([
  ['supply_route_unavailable', 'SUPPLY_ROUTE_UNAVAILABLE'],
  ['farm_target_unresolved', 'INVALID_PRECONDITION'],
  ['farm_map_not_farmable', 'INVALID_PRECONDITION'],
  ['agent_position_unavailable', 'RECONCILIATION_FAILED'],
  ['legacy_openkore_migration_required', 'INVALID_RUNTIME_STATE'],
  ['invalid_transition', 'INVALID_RUNTIME_STATE'],
  ['stale_revision', 'RECONCILIATION_FAILED'],
  ['ownership_conflict', 'OWNERSHIP_MISMATCH'],
  ['command_rejected', 'NATIVE_REJECTED'],
  ['command_not_created', 'COMMAND_NOT_CREATED'],
  ['command_pending_coordinator', 'COMMAND_DISPATCH_FAILED'],
  ['native_result_timeout', 'STATE_TRANSITION_TIMEOUT'],
  ['state_transition_timeout', 'STATE_TRANSITION_TIMEOUT'],
  ['position_unchanged', 'AUTHORITATIVE_POSITION_UNCHANGED'],
  ['event_not_observed', 'EVENT_NOT_OBSERVED'],
]);

export function errorDescriptor(errorCode) {
  return ERROR_TAXONOMY[String(errorCode ?? '').toUpperCase()] ?? ERROR_TAXONOMY.UNKNOWN_ERROR;
}

export function classifyError(value, fallback = 'UNKNOWN_ERROR') {
  const raw = String(value ?? '').trim();
  if (!raw) return errorDescriptor(fallback);
  const upper = raw.toUpperCase();
  if (ERROR_TAXONOMY[upper]) return ERROR_TAXONOMY[upper];
  const normalized = raw.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const alias = aliases.get(normalized);
  if (alias) return ERROR_TAXONOMY[alias];
  if (/HTTP[_ ]?401|AUTH/.test(upper)) return ERROR_TAXONOMY.AUTH_FAILED;
  if (/OWNERSHIP|CHARACTER_OWNERSHIP/.test(upper)) return ERROR_TAXONOMY.OWNERSHIP_MISMATCH;
  if (/SUPPLY_ROUTE/.test(upper)) return ERROR_TAXONOMY.SUPPLY_ROUTE_UNAVAILABLE;
  if (/DRY[_ ]?RUN|PRECONDITION/.test(upper)) return ERROR_TAXONOMY.INVALID_PRECONDITION;
  if (/NO[_ ]?ROUTE|UNSUPPORTED|ROUTE_UNAVAILABLE/.test(upper)) return ERROR_TAXONOMY.RELOCATION_UNSUPPORTED;
  if (/TIMEOUT|TIMED[_ ]?OUT/.test(upper)) return ERROR_TAXONOMY.STATE_TRANSITION_TIMEOUT;
  if (/POSITION.*UNCHANGED|NO[_ ]?POSITION[_ ]?CHANGE/.test(upper)) return ERROR_TAXONOMY.AUTHORITATIVE_POSITION_UNCHANGED;
  if (/EVENT.*(MISSING|NOT|UNOBSERVED)|NOT[_ ]?OBSERVED/.test(upper)) return ERROR_TAXONOMY.EVENT_NOT_OBSERVED;
  if (/COMMAND.*(REJECT|FAIL)|DISPATCH/.test(upper)) return ERROR_TAXONOMY.COMMAND_DISPATCH_FAILED;
  return ERROR_TAXONOMY.UNKNOWN_ERROR;
}
