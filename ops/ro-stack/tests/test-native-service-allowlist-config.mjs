import assert from 'node:assert/strict';
import { exactServiceAllowlistPatch, POLICY } from '../native-service-allowlist-config.mjs';

const old = Buffer.from([
  '@{',
  "  PersistentAgentServiceMapAllowlist = @('prt_fild05')",
  "  PersistentAgentServiceNpcAllowlist = @('Tool Dealer#Extended_Prt')",
  '  PersistentAgentM1SupplyEnabled = $true',
  '  WebM1AcceptanceFixtureEnabled = $true',
  '  WebNativeSupplyPolicyEnabled = $true',
  '  OtherSetting = 42',
  '}', '',
].join('\n'));
const source = Buffer.from([
  '@{',
  "  PersistentAgentServiceMapAllowlist = @('prt_fild05','izlude_in')",
  "  PersistentAgentServiceNpcAllowlist = @('Tool Dealer#Extended_Prt','Tool Dealer#iz')",
  '  PersistentAgentM1SupplyEnabled = $false',
  '  WebM1AcceptanceFixtureEnabled = $false',
  '  WebNativeSupplyPolicyEnabled = $false',
  '  OtherSetting = 42',
  '}', '',
].join('\n'));
const patch = exactServiceAllowlistPatch(old, source);
assert.equal(patch.changes.length, 2);
assert.deepEqual(patch.changes.map(row => row.key), POLICY.keys);
assert.match(patch.bytes.toString(), /'Tool Dealer#iz'/);
assert.match(patch.bytes.toString(), /PersistentAgentM1SupplyEnabled = \$true/);
assert.match(patch.bytes.toString(), /OtherSetting = 42/);
assert.equal(patch.unrelatedChanges, 0);
const unrelated = Buffer.from(source.toString().replace('OtherSetting = 42', 'OtherSetting = 43'));
assert.throws(() => exactServiceAllowlistPatch(old, unrelated), /UNCLASSIFIED_CONFIG_VARIANCE/);
const missing = Buffer.from(old.toString().replace('PersistentAgentServiceNpcAllowlist', 'MissingNpcAllowlist'));
assert.throws(() => exactServiceAllowlistPatch(missing, source), /UNCLASSIFIED_CONFIG_VARIANCE|ALLOWLIST_KEY_MISSING/);
console.log('NATIVE_SERVICE_ALLOWLIST_CONFIG_PASS cases=8');
