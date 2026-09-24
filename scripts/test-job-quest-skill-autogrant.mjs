import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import yaml from 'js-yaml';

const root = '.local/ro-stack/rathena';
const [skillDbText, skillTreeText, globalFunctions, academy, dashboardTrees] =
  await Promise.all([
    readFile(`${root}/db/re/skill_db.yml`, 'utf8'),
    readFile(`${root}/db/re/skill_tree.yml`, 'utf8'),
    readFile(`${root}/npc/other/Global_Functions.txt`, 'utf8'),
    readFile('ops/ro-stack/templates/terminal_academy_job_change.txt', 'utf8'),
    readFile('public/ro/data/skill-trees.json', 'utf8').then(JSON.parse),
  ]);

const expected = new Map([
  [0, ['NV_FIRSTAID', 'NV_TRICKDEAD']],
  [1, ['SM_MOVINGRECOVERY', 'SM_FATALBLOW', 'SM_AUTOBERSERK']],
  [2, ['MG_ENERGYCOAT']],
  [3, ['AC_MAKINGARROW', 'AC_CHARGEARROW']],
  [4, ['AL_HOLYLIGHT']],
  [
    5,
    [
      'MC_CARTREVOLUTION',
      'MC_CHANGECART',
      'MC_LOUD',
      'ALL_BUYING_STORE',
      'MC_CARTDECORATE',
    ],
  ],
  [6, ['TF_SPRINKLESAND', 'TF_BACKSLIDING', 'TF_PICKSTONE', 'TF_THROWSTONE']],
  [7, ['KN_CHARGEATK']],
  [8, ['PR_REDEMPTIO']],
  [9, ['WZ_SIGHTBLASTER']],
  [10, ['BS_UNFAIRLYTRICK', 'BS_GREED']],
  [11, ['HT_PHANTASMIC']],
  [12, ['AS_SONICACCEL', 'AS_VENOMKNIFE']],
  [14, ['CR_SHRINK']],
  [15, ['MO_KITRANSLATION', 'MO_BALKYOUNG']],
  [
    16,
    [
      'SA_CREATECON',
      'SA_ELEMENTWATER',
      'SA_ELEMENTGROUND',
      'SA_ELEMENTFIRE',
      'SA_ELEMENTWIND',
    ],
  ],
  [17, ['RG_CLOSECONFINE']],
  [18, ['AM_BIOETHICS']],
  [19, ['BA_PANGVOICE']],
  [20, ['DC_WINKCHARM']],
  [23, ['ALL_BUYING_STORE', 'MC_CARTDECORATE']],
]);

const skillDb = yaml.load(skillDbText)?.Body ?? [];
const byHandle = new Map(skillDb.map((skill) => [skill.Name, skill]));
const expectedHandles = new Set([...expected.values()].flat());
assert.equal(
  expectedHandles.size,
  38,
  'expected player Quest Skill count changed',
);

for (const handle of expectedHandles) {
  const skill = byHandle.get(handle);
  assert.ok(skill, `missing skill database entry: ${handle}`);
  assert.equal(
    skill.Flags?.IsQuest,
    true,
    `${handle} is no longer marked IsQuest`,
  );
  assert.match(
    globalFunctions,
    new RegExp(`skill "${handle}",1,SKILL_PERM(?:_GRANT)?;`),
  );
}

assert.doesNotMatch(globalFunctions, /skill "ALL_INCCARRY"/);
assert.doesNotMatch(globalFunctions, /skill "MA_CHARGEARROW"/);
assert.match(
  globalFunctions,
  /function\s+script\s+F_TerminalGrantJobQuestSkills/,
);
assert.match(globalFunctions, /switch \(BaseJob\)/);
assert.match(academy, /OnPCLoginEvent:[\s\S]*?F_TerminalGrantJobQuestSkills/);

const parsedTree = yaml.load(skillTreeText)?.Body ?? [];
const playerTreeQuestHandles = new Set();
for (const job of parsedTree) {
  for (const skill of job.Tree ?? []) {
    if (byHandle.get(skill.Name)?.Flags?.IsQuest === true)
      playerTreeQuestHandles.add(skill.Name);
  }
}
assert.deepEqual(
  [...playerTreeQuestHandles].sort(),
  [...expectedHandles].sort(),
  'Renewal player skill-tree Quest Skill inventory changed',
);

for (const [jobId, handles] of expected) {
  const dashboardJob = dashboardTrees.jobs[String(jobId)];
  assert.ok(dashboardJob, `Dashboard missing job ${jobId}`);
  const dashboardByHandle = new Map(
    dashboardJob.skills.map((skill) => [skill.handle, skill]),
  );
  for (const handle of handles) {
    assert.equal(
      dashboardByHandle.get(handle)?.quest,
      true,
      `${jobId} missing ${handle}`,
    );
  }
  if (jobId !== 0)
    assert.equal(
      dashboardByHandle.has('NV_TRICKDEAD'),
      false,
      `${jobId} inherited Play Dead`,
    );
}

console.log(
  'PASS: 38 player Quest Skills are covered; server-only and mercenary skills are excluded.',
);
