import { readFile } from 'node:fs/promises';

const plugin = await readFile(
  'ops/ro-stack/openkore-plugins/status-export/status-export.pl',
  'utf8',
);

const required = [
  'my $defer = 0;',
  "elsif (!keys %{ $char->{skills} }) {",
  "$message = '等待技能資料同步';",
  'next if $defer;',
];
for (const text of required) {
  if (!plugin.includes(text)) throw new Error(`missing readiness guard: ${text}`);
}

const skillBranch = plugin.indexOf("} elsif ($action eq 'skill'");
const waitForSkills = plugin.indexOf("elsif (!keys %{ $char->{skills} })", skillBranch);
const rejectSkill = plugin.indexOf("$message = '此技能目前無法提升';", skillBranch);
const deferCommand = plugin.indexOf('next if $defer;', skillBranch);
const writeResult = plugin.indexOf('my $result_path = $path;', skillBranch);
if (
  skillBranch < 0 ||
  waitForSkills < 0 ||
  rejectSkill < 0 ||
  deferCommand < 0 ||
  writeResult < 0 ||
  waitForSkills > rejectSkill ||
  deferCommand > writeResult
) {
  throw new Error('skill command readiness order is unsafe');
}

console.log(
  JSON.stringify(
    {
      result: 'COMMAND_BRIDGE_READINESS_PASS',
      skillCommandsWaitForServerData: true,
      deferredCommandsRemainQueued: true,
    },
    null,
    2,
  ),
);
