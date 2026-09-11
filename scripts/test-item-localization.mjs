import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const sourcePath = join(
  root,
  '.local',
  'ro-stack',
  'openkore',
  'tables',
  'twRO',
  'items.txt',
);
const source = await readFile(sourcePath, 'utf8');
const names = new Map(
  source
    .split(/\r?\n/)
    .map((line) => line.match(/^(\d+)#(.+)#$/))
    .filter(Boolean)
    .map((match) => [Number(match[1]), match[2].trim()]),
);

const onboardingRewardIds = [
  569, 1243, 1381, 1545, 1639, 1742, 2112, 2301, 2352, 2414, 2510, 5055, 6593,
  7060, 12004, 12008, 12009, 13041, 13415, 18730,
];
const missing = onboardingRewardIds.filter((id) => !names.has(id));
const withoutChinese = onboardingRewardIds
  .map((id) => ({ id, name: names.get(id) ?? '' }))
  .filter(({ name }) => !/\p{Script=Han}/u.test(name));
const dashboard = await readFile(
  join(root, 'ops', 'ro-stack', 'dashboard.mjs'),
  'utf8',
);
const integrationCount = dashboard.match(/localizedItemName\(/g)?.length ?? 0;
const pass =
  names.size > 1000 &&
  missing.length === 0 &&
  withoutChinese.length === 0 &&
  integrationCount >= 4;

console.log(
  JSON.stringify(
    {
      result: pass
        ? 'TWRO_ITEM_LOCALIZATION_PASS'
        : 'TWRO_ITEM_LOCALIZATION_FAIL',
      source: '.local/ro-stack/openkore/tables/twRO/items.txt',
      sourceItemCount: names.size,
      checkedRewardIds: onboardingRewardIds,
      missing,
      withoutChinese,
      integrationCount,
    },
    null,
    2,
  ),
);

if (!pass) process.exitCode = 1;
