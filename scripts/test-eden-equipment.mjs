import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rathena = resolve(root, '..', '.tmp-rathena-full');
const openkore = resolve(root, '..', '.tmp-openkore-full');
const read = (path) => readFile(path, 'utf8');

const [
  activeScripts,
  edenScript,
  questDb,
  dashboard,
  client,
  plugin,
  instance,
  academyNpc,
] = await Promise.all([
  read(join(rathena, 'npc', 're', 'scripts_athena.conf')),
  read(join(rathena, 'npc', 're', 'quests', 'eden', 'eden_quests.txt')),
  read(join(rathena, 'db', 're', 'quest_db.yml')),
  read(join(root, 'ops', 'ro-stack', 'dashboard.mjs')),
  read(join(root, 'ops', 'ro-stack', 'dashboard', 'app.js')),
  read(
    join(
      root,
      'ops',
      'ro-stack',
      'openkore-plugins',
      'status-export',
      'status-export.pl',
    ),
  ),
  read(join(root, 'ops', 'ro-stack', 'openkore-instance.ps1')),
  read(
    join(
      root,
      'ops',
      'ro-stack',
      'templates',
      'terminal_academy_job_change.txt',
    ),
  ),
]);

assert.match(
  activeScripts,
  /^npc: npc\/re\/quests\/eden\/eden_quests\.txt$/m,
  'Renewal Eden equipment script must be active',
);
assert.doesNotMatch(
  activeScripts,
  /^npc: npc\/re\/quests\/eden\/eden_iro\.txt$/m,
  'iRO Eden variant must remain inactive',
);
for (const text of [
  'moc_para01,25,35,4\tscript\tInstructor Boya#para01',
  'moc_fild11,180,253,5\tscript\tTalking Dog#para03',
  'moc_para01,112,96,5\tscript\tAdministrator Michael',
  'setquest 7128;',
  'changequest 7128,7129;',
  'changequest 7129,7130;',
  'changequest 7130,7131;',
  'changequest 7131,7132;',
  'completequest 7132;',
  'getitem 5583,1;',
  'getitem 2560,1;',
  'getitem 2456,1;',
  'getitem 15009,1;',
  'pay_arche,41,136,3\tscript\tEden Member Karl#para05',
  'setquest 7138;',
  'changequest 7138,7139;',
  'changequest 7139,7140;',
  'changequest 7140,7141;',
  'completequest 7141;',
  'getitem 2457,1;',
  'getitem 15010,1;',
])
  assert.ok(edenScript.includes(text), `missing native Eden source: ${text}`);

for (const pattern of [
  /- Id: 7129[\s\S]*?Mob: CONDOR\s+Count: 10/,
  /- Id: 7130[\s\S]*?Mob: DESERT_WOLF_B\s+Count: 10/,
  /- Id: 7131[\s\S]*?Mob: SCORPION\s+Count: 5/,
  /- Id: 7139[\s\S]*?Mob: SKELETON\s+Count: 15/,
  /- Id: 7140[\s\S]*?Mob: POPORING\s+Count: 10/,
])
  assert.match(questDb, pattern);

for (const token of [
  '/api/eden/task',
  'queryEdenProgress',
  'claimTaskCommandLock',
  'not_available',
  'prerequisite_incomplete',
  'already_completed',
  'route_failed',
  'npc_failed',
  'target_unresolved',
  'inventory_full',
  'command_rejected',
  'equipmentRecord === 1',
  'equipment26: trainingStage >= 23',
  'equipment26',
  'allowedFirstJobIds',
])
  assert.ok(dashboard.includes(token), `dashboard contract missing: ${token}`);
for (const token of [
  'milestone.currentObjective',
  'milestone.progress',
  'milestone.nextAction',
  'milestone.canReport',
  'milestone.reward',
])
  assert.ok(client.includes(token), `quest log field missing: ${token}`);
for (const token of [
  "eden_equipment_hunt(7129, 1009, 'equipment_hunt_condor')",
  "eden_equipment_hunt(7130, 1107, 'equipment_hunt_wolf')",
  "eden_equipment_hunt(7131, 1001, 'equipment_hunt_scorpion')",
  'mob_goal',
  'mob_count',
  "set_eden_phase('equipment_complete')",
  "eden_equipment26_hunt(7139, 1076, 'equipment26_hunt_skeleton')",
  "eden_equipment26_hunt(7140, 1031, 'equipment26_hunt_poporing')",
  "Commands::run('move moc_para01 30 10 0')",
  'start_eden_equipment26_chain',
  'equip_eden_rewards',
  'process_eden_supply',
  "AI::queue('sellAuto')",
  'inventory_amount(501)',
  "$field->baseName eq 'moc_para01'",
  'eden_exit_step();',
  "return ['pay_dun00', 73, 78] if $level >= 26",
  'is_eden_eligible_job',
  '21, 23, 24, 25, 4046',
])
  assert.ok(plugin.includes(token), `OpenKore Eden bridge missing: ${token}`);
assert.doesNotMatch(
  plugin,
  /\$action eq 'eden_join'[\s\S]{0,180}\$char->\{jobID\}\) < 1/,
  'Eden enrollment must not reject expanded first jobs with the old 1..6 gate',
);
assert.doesNotMatch(
  plugin,
  /if \(\$map eq 'prontera'\) \{\s*set_eden_phase\('route_officer'\);/,
  'Eden route must not alternate between walking and teleport phases every tick',
);
for (const token of [
  'pendingTaskEvents',
  'taskCommandPendingUntil',
  '任務指令已送出',
  '目前正在執行任務，完成後會自動恢復掛機。',
])
  assert.ok(client.includes(token), `Eden task feedback missing: ${token}`);
assert.match(
  plugin,
  /sendTalkCancel\(\$talk\{ID\}\)[\s\S]*equip_eden_rewards\(\)/,
);
assert.match(
  plugin,
  /sub process_job_resume \{[\s\S]*?if \(time - \$job_resume_started_at >= 600\.0\)[\s\S]*?fail_job_resume\('route_timeout'\)/,
);
assert.match(plugin, /\$job_resume_recovery_attempts >= 4[\s\S]*?fail_job_resume\('route_stuck'\)/);
assert.match(plugin, /time - \$last_job_resume_retry >= 8\.0[\s\S]*?eden_return_to_hunt_step\(\)/);
assert.doesNotMatch(plugin, /last_job_resume_retry >= \(\$field->baseName eq 'moc_para01' \? 0\.45 : 1\.5\)/);
assert.match(plugin, /sub eden_return_kafra_destination \{[\s\S]*?return 4 if \$map =~ \/\^pay_\//);
assert.match(
  plugin,
  /sub eden_return_to_hunt_step \{[\s\S]*?number_or_zero\(\$char->\{lv\}\) <= 40[\s\S]*?nearby_npc_at\('moc_para01', 35, 23, 5\)[\s\S]*?sendTalk\(\$npc->\{ID\}\)/,
);
assert.match(plugin, /\$eden_return_kafra_attempts >= 2[\s\S]*?fail_job_resume\('eden_kafra_failed'\)/);
assert.doesNotMatch(
  plugin,
  /sub process_job_resume \{[\s\S]*?if \(\$field->baseName eq 'moc_para01'\) \{\s*Commands::run\('move moc_para01 30 10 0'\)/,
);
for (const token of [
  'OnPCLoadMapEvent:',
  '.@map$ == "prt_fild08" && BaseLevel < 12',
  '.@save_map$ = "prontera";',
  '.@save_x = 150;',
  '.@save_y = 33;',
  '.@map$ == "moc_fild11" && BaseLevel >= 12 && BaseLevel < 26',
  '.@save_map$ = "morocc";',
  '.@save_x = 156;',
  '.@save_y = 46;',
  '.@map$ == "pay_dun00" && BaseLevel >= 26',
  '.@save_map$ = "pay_arche";',
  '.@save_x = 49;',
  '.@save_y = 144;',
  'savepoint .@save_map$,.@save_x,.@save_y,1,1;',
  'prt_fild08\tmapflag\tloadevent',
  'moc_fild11\tmapflag\tloadevent',
  'pay_dun00\tmapflag\tloadevent',
])
  assert.ok(
    academyNpc.includes(token),
    `recommended-map save point missing: ${token}`,
  );
assert.doesNotMatch(plugin, /\@item\b|\@quest\b/);
for (const token of [
  "Set-ConfigValue $configPath 'teleportAuto_idle' '1'",
  "Set-ConfigValue $configPath 'teleportAuto_item1' '601'",
  "Set-ConfigValue $configPath 'teleportAuto_item2' '602'",
  "Ensure-ConfigBlockBefore $configPath 'useSelf_item 569'",
  "Ensure-ConfigBlock $configPath 'useSelf_item 501'",
  "Ensure-ConfigBlock $configPath 'buyAuto 601'",
  "Ensure-ConfigBlock $configPath 'buyAuto 602'",
  "Set-BuyAutoValue $configPath 501 'zeny' '>= 10'",
  "Set-BuyAutoValue $configPath 601 'zeny' '>= 250'",
  "Set-BuyAutoValue $configPath 602 'zeny' '>= 1000'",
])
  assert.ok(
    instance.includes(token),
    `OpenKore supply default missing: ${token}`,
  );
assert.match(
  instance,
  /Ensure-ConfigBlockBefore \$configPath 'useSelf_item 569'[\s\S]*?\) 'useSelf_item 501'/,
  'Novice Potion must be inserted before Red Potion',
);

assert.ok(
  client.includes('statHoldInterval'),
  'stat hold acceleration missing',
);
assert.match(client, /Math\.max\(65, 220 - elapsedMs \* 0\.04\)/);
assert.ok(dashboard.includes("? 'pay_dun00'"));

const temporary = await mkdtemp(join(tmpdir(), 'eden-renewal-portals-'));
try {
  const outputPath = join(temporary, 'portals.txt');
  execFileSync(
    process.execPath,
    [
      join(root, 'scripts', 'build-openkore-renewal-portals.mjs'),
      join(openkore, 'tables', 'tRO', 'portals.txt'),
      outputPath,
    ],
    { stdio: 'pipe' },
  );
  const portals = await read(outputPath);
  assert.doesNotMatch(portals, /^moc_fild11 189 360 moc_fild20 /m);
  assert.match(portals, /^moc_fild11 26 161 moc_fild12 /m);
} finally {
  await rm(temporary, { recursive: true, force: true });
}

console.log('EDEN_EQUIPMENT_SOURCE_AND_BRIDGE_PASS');
