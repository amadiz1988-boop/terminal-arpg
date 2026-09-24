import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const decision = readFileSync(
  new URL('../docs/project-control/canonical-m1-world-travel-supply-ui-v1.md', import.meta.url),
  'utf8',
);

test('travel wings and arrow/bullet ammo are explicit nonconsumable overrides', () => {
  assert.match(decision, /### NON-CONSUMABLE TRAVEL \/ AMMO OVERRIDES/);
  assert.match(decision, /CLASSIFICATION = GI_EXPLICIT_OVERRIDE/);
  for (const resource of ['FLY_WING', 'BUTTERFLY_WING', 'BULLET', 'ARROW']) {
    assert.match(decision, new RegExp(`^${resource}_CONSUMPTION = NO$`, 'm'));
  }
  assert.match(decision, /四類非消耗資源均不適用數量耗盡補給門檻/);
  assert.match(decision, /缺少必要相容彈藥時，保留安全的戰鬥資源阻擋狀態與掛機父意圖/);
});
