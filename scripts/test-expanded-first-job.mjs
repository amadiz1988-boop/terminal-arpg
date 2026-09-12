import { readFile } from 'node:fs/promises';

const [npc, plugin, dashboard, app, skillTrees] = await Promise.all([
  readFile('ops/ro-stack/templates/terminal_academy_job_change.txt', 'utf8'),
  readFile(
    'ops/ro-stack/openkore-plugins/status-export/status-export.pl',
    'utf8',
  ),
  readFile('ops/ro-stack/dashboard.mjs', 'utf8'),
  readFile('ops/ro-stack/dashboard/app.js', 'utf8'),
  readFile('public/ro/data/skill-trees.json', 'utf8').then(JSON.parse),
]);

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`${label}: missing ${text}`);
}

const expandedJobs = [
  ['supernovice', 'Job_Super_Novice'],
  ['taekwon', 'Job_Taekwon'],
  ['gunslinger', 'Job_Gunslinger'],
  ['ninja', 'Job_Ninja'],
];

for (const [key, rathenaJob] of expandedJobs) {
  requireText(dashboard, `'${key}',`, `dashboard allowlist ${key}`);
  requireText(
    plugin,
    `${key} => ['iz_ac01', 60, 67],`,
    `OpenKore route ${key}`,
  );
  requireText(npc, `.@target$ == "${key}"`, `academy branch ${key}`);
  requireText(npc, `.@job = ${rathenaJob};`, `rAthena job ${key}`);
}

requireText(npc, 'BaseLevel < 45', 'Super Novice level gate');
requireText(
  npc,
  'terminal_supernovice_training = 1;',
  'Super Novice training state',
);
requireText(
  npc,
  'warp "prt_fild08",170,375;',
  'Super Novice low-level training warp',
);
requireText(npc, 'warp "moc_fild11",180,253;', 'Super Novice mid-level training warp');
requireText(npc, 'warp "pay_dun00",73,78;', 'Super Novice high-level training warp');
requireText(
  npc,
  'terminal_target_job$ == "supernovice" && BaseLevel < 45',
  'Super Novice task resume gate',
);
requireText(
  plugin,
  "if ($map =~ /^(?:prt_fild08|moc_fild11|pay_dun00)$/",
  'Super Novice field automation',
);
requireText(plugin, "'supernovice_ready'", 'Super Novice ready state');
requireText(npc, '.@reward = 13101;', 'Gunslinger weapon');
requireText(npc, 'getitem 13200,500;', 'Gunslinger ammunition');
requireText(npc, '.@minimum_base = 10; // Six Shooter [2]', 'Gunslinger equip level');
requireText(npc, '.@minimum_base = 12; // Asura [2]', 'Ninja equip level');
requireText(npc, 'OnExpandedRepair:', 'expanded-job recovery command');
requireText(plugin, 'process_expanded_onboarding_repair();', 'expanded-job automatic repair');
requireText(app, '達標後再次雙擊即可返回學院', 'task log instructions');
requireText(app, "quest.id === 'graduation'", 'Super Novice graduation task');
requireText(app, '`練功中 Base ${Number(character?.baseLevel)} / 45`', 'level progress');
requireText(app, "'可返回學院'", 'ready task state');
requireText(app, "4046: '跆拳'", 'Taekwon live class name');
requireText(dashboard, '23, 24, 25, 4046', 'expanded Eden live class ids');
for (const [jobId, expectedCount] of [
  [23, 51],
  [4046, 17],
  [24, 22],
  [25, 23],
]) {
  const skills = skillTrees.jobs[String(jobId)]?.skills ?? [];
  if (skills.length !== expectedCount)
    throw new Error(`skill tree count mismatch for ${jobId}: ${skills.length}`);
  if (skills.some((skill) => !Number.isInteger(skill.id)))
    throw new Error(`skill tree contains unresolved ids for ${jobId}`);
}

console.log(
  JSON.stringify(
    {
      result: 'EXPANDED_FIRST_JOB_FLOW_PASS',
      jobs: expandedJobs.map(([key]) => key),
      academy: 'iz_ac01,60,67',
      superNoviceTrainingMaps: ['prt_fild08', 'moc_fild11', 'pay_dun00'],
      superNoviceRequiredBaseLevel: 45,
    },
    null,
    2,
  ),
);
