import { readFile } from 'node:fs/promises';

const plugin = await readFile(
  'ops/ro-stack/openkore-plugins/status-export/status-export.pl',
  'utf8',
);
const dashboard = await readFile('ops/ro-stack/dashboard.mjs', 'utf8');
const dashboardHtml = await readFile(
  'ops/ro-stack/dashboard/index.html',
  'utf8',
);

function requireText(text, label) {
  if (!plugin.includes(text)) throw new Error(`${label}: missing ${text}`);
}

requireText('sub write_supply_guard {', 'durable supply guard');
requireText('sub recover_interrupted_supply {', 'restart recovery');
requireText('recover_interrupted_supply();', 'startup recovery hook');
requireText('clear_supply_guard();', 'guard cleanup');
requireText("'supply_guard_write_failed'", 'fail-safe event');
requireText('sub guard_auto_supply_start {', 'task supply isolation');
requireText('eden_equipment_task_active() && !$eden_supply_active', 'task supply guard');
requireText('sub reserve_storage_zeny {', 'storage fee reserve');
requireText('number_or_zero($char->{zeny}) - $reserve', 'safe buying budget');
requireText('sub finish_supply_storage_cycle {', 'failed supply backoff');
requireText('$supply_retry_after = time + 300;', 'five minute retry delay');
if (!dashboard.includes('returnWeight: 75,'))
  throw new Error('default return weight must be 75 percent');
if (!/id="supplyWeight"[\s\S]*?value="75"/.test(dashboardHtml))
  throw new Error('supply form default must be 75 percent');

const guardWrite = plugin.indexOf('if (!write_supply_guard()) {');
const attackDisable = plugin.indexOf("configModify('attackAuto', 0, 1)", guardWrite);
if (guardWrite < 0 || attackDisable < 0 || guardWrite > attackDisable) {
  throw new Error('guard must be durable before disabling attack');
}

const supplyFunction = plugin.slice(plugin.indexOf('sub process_eden_supply {'));
const timeout = supplyFunction.indexOf('time - $eden_supply_started_at >= 180.0');
const busyQueue = supplyFunction.indexOf("AI::inQueue('sellAuto'");
if (timeout < 0 || busyQueue < 0 || timeout > busyQueue) {
  throw new Error('timeout must run before the busy AI queue check');
}

console.log(
  JSON.stringify(
    {
      result: 'SUPPLY_INTERRUPTION_RECOVERY_PASS',
      durableGuardBeforeAttackDisable: true,
      restartRecovery: true,
      timeoutPreemptsBusyQueue: true,
      taskSupplyIsolation: true,
      storageFeeReserved: true,
      failedCycleBackoff: true,
      defaultReturnWeight: 75,
    },
    null,
    2,
  ),
);
