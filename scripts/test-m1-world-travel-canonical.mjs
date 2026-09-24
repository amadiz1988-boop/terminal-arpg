import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const canonicalPath = 'docs/project-control/canonical-m1-world-travel-supply-ui-v1.md';
const decision = read(canonicalPath);

test('one M1 product authority and evidence links', () => {
  assert.match(decision, /STATUS = CANONICAL \/ ACTIVE/);
  assert.match(decision, /## CANONICAL_DECISION_MATRIX/);
  for (const path of [
    'docs/openkore-reference/m1-core-hunting-closure.md',
    'docs/openkore-reference/m1-world-map-supply-cutover-source.md',
    'docs/CURRENT_STATUS.md',
  ]) {
    assert.match(read(path), /canonical-m1-world-travel-supply-ui-v1\.md/, path);
  }
});

test('world movement keeps server authority and exact cost classes', () => {
  for (const label of ['FIELD → TOWN', 'TOWN → TOWN', 'TOWN → FIELD', 'FIELD → FIELD', 'SAME MAP']) {
    assert.ok(decision.includes(label), label);
  }
  assert.match(decision, /Lv\.66 以下免費；Lv\.67 起為目的地 `FARM_MAP_MIN_LEVEL × 10` Zeny/);
  assert.match(decision, /FIELD → TOWN[^\n]*\| 免費 \| 無 \|[^\n]*繞過既有世界傳送冷卻/);
  assert.match(decision, /WORLD_TELEPORT_AVAILABLE_AT = server_now \+ 30s/);
  assert.match(decision, /失敗交易不扣 Zeny、不啟動冷卻/);
  assert.match(decision, /AUTO_FARM_START\/RESUME/);
});

test('visible-root policy and retained city navigation supersede historical blockers', () => {
  assert.match(decision, /ROOT_VISIBLE=YES/);
  assert.match(decision, /OUT_OF_CURRENT_WORLD_MAP_SCOPE/);
  assert.match(decision, /CITY_LOCAL_NAVIGATION/);
  assert.match(decision, /PLAYER_WORLD_NAVIGATION_SETTINGS=NOT_APPLICABLE/);
  assert.match(decision, /ENABLED_UI_NO_OP_COUNT=0/);
  for (const old of ['NO_NAV_ROUTE', 'OLD_STANDARD_WHITELIST', 'QUEST_ACCESS_REVIEW_REQUIRED', '28\/136']) {
    assert.match(decision, new RegExp(old), old);
  }
  assert.match(read('docs/openkore-reference/m1-world-map-supply-cutover-source.md'), /HISTORICAL \/ SUPERSEDED_BY/);
});

test('M1 supply uses combat-continuity consumables and keeps storage/sell decision historical', () => {
  assert.match(decision, /M1_SUPPLY_STORAGE_SELL_AND_PREFLIGHT_V1 = HISTORICAL \/ SUPERSEDED/);
  assert.match(decision, /HISTORICAL \/ SUPERSEDED_BY = M1_NONCONSUMABLE_TRAVEL_AND_AMMO_OVERRIDE_V1/);
  assert.match(decision, /M1_NONCONSUMABLE_TRAVEL_AND_AMMO_OVERRIDE_V1 = CANONICAL \/ ACTIVE/);
  assert.match(decision, /^M1_SUPPLY_TRIGGER_MODEL = COMBAT_CONTINUITY_ITEMS_ONLY$/m);
  assert.match(decision, /^M1_WEIGHT_TRIGGER_SUPPLY = NO$/m);
  assert.match(decision, /^M1_INVENTORY_TRIGGER_SUPPLY = NO$/m);
  assert.match(decision, /^GLOBAL_AUTOSTORE = NO$/m);
  assert.match(decision, /^AUTO_STORAGE = OUTSIDE_M1$/m);
  assert.match(decision, /^AUTO_SELL = OUTSIDE_M1$/m);
  assert.match(decision, /PLAYER_FARM_MAP_CHANGE_PREFLIGHT = BEFORE_FARM_STOP_FEE_COOLDOWN_TELEPORT/);
  assert.match(decision, /蒼蠅翅膀、蝴蝶翅膀、箭矢、子彈均排除/);
  assert.match(decision, /缺少必要相容彈藥屬於合法性／可用性阻擋/);
  assert.match(decision, /不得自動觸發 M1 存倉或販售/);
  const routing = read('WORKSPACE_INDEX.md');
  assert.match(routing, /NATIVE_ACTIVE_WORKTREE: C:\\Users\\Administrator\\source\\ghost-island-rathena/);
  assert.match(routing, /WEB_ACTIVE_WORKTREE: C:\\Users\\Administrator\\\.codex\\/);
});
