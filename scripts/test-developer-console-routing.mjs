import assert from 'node:assert/strict';
import fs from 'node:fs';
import { capabilities } from '../ops/ro-stack/dev-console/registry.mjs';

const cases = [
  ['角色為什麼 QUARANTINED？', ['player quarantine', 'player inspect <charId>'], false],
  ['map 為什麼掛掉？', ['runtime health', 'incident latest', 'incident procdump'], false],
  ['Start Farm 為什麼沒打怪？', ['player inspect <charId>', 'events recent <charId>'], false],
  ['Production 現在跑哪個 Git SHA？', ['deployment state'], false],
  ['這個設定 Production 有沒有生效？', ['config diff', 'capabilities config'], false],
  ['恢復這個 quarantined 測試角色', ['action recover-quarantined <charId> --execute'], false],
  ['大地圖按鈕畫面正常嗎？', ['player inspect <charId>'], true],
  ['手機 390×844 有沒有跑版？', [], true],
  ['Quest 卡在哪一步？', ['capabilities quest', 'events recent <charId>'], false],
  ['Life Director 為什麼做出這個決定？', ['capabilities life'], false],
];
const commands = new Set(capabilities.map(row => row.command));
const governance = fs.readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf8');
assert(governance.includes('ghost-island-dev.mjs capabilities <domain> --json'));
assert(governance.includes('Browser evidence'));
for (const [prompt, expected, browser] of cases) {
  assert(prompt.length && typeof browser === 'boolean');
  for (const command of expected) assert(commands.has(command), `${prompt}: ${command}`);
  if (browser) assert(!expected.some(command => command.includes('action recover')));
}
assert(capabilities.find(row => row.id === 'life.director').current_status === 'NOT_IMPLEMENTED_PRODUCT');
console.log(`developer console routing fixtures: ${cases.length}/10 PASS (governance and registry only)`);
