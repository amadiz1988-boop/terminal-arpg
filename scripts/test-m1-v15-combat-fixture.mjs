import assert from 'node:assert/strict';
import { test } from 'node:test';
import { statCost, profileBudget, legalEquipRecord } from './m1-v15-combat-fixture.mjs';

test('Renewal stat cost matches the Lv170 fixed profile budget', () => {
  assert.equal(statCost(1), 0);
  assert.equal(statCost(80), 431);
  assert.equal(statCost(90), 530);
  assert.deepEqual(profileBudget({ str: 80, agi: 90, vit: 90, int: 20,
    dex: 90, luk: 20 }, 3124), { total: 3124, spent: 2115, remaining: 1009 });
  assert.throws(() => statCost(100), /STAT_CAP_INVALID/);
  assert.throws(() => profileBudget({ str: 99 }, 1), /STAT_BUDGET_EXCEEDED/);
});

test('selected equipment must be a legal ordinary job/level/slot record', () => {
  const sword = { Id: 13438, AegisName: 'Magical_Blade', Type: 'Weapon',
    Jobs: { SuperNovice: true }, EquipLevelMin: 105,
    Locations: { Right_Hand: true } };
  const armor = { Id: 15185, AegisName: 'Para_Team_Armor160', Type: 'Armor',
    EquipLevelMin: 160, Locations: { Armor: true } };
  assert.equal(legalEquipRecord(sword,
    { id: 13438, aegis: 'Magical_Blade', slot: 'rightHand' }), true);
  assert.equal(legalEquipRecord(armor,
    { id: 15185, aegis: 'Para_Team_Armor160', slot: 'armor' }), true);
  assert.equal(legalEquipRecord({ ...sword, Jobs: { All: true, SuperNovice: false } },
    { id: 13438, aegis: 'Magical_Blade', slot: 'rightHand' }), false);
  assert.equal(legalEquipRecord({ ...armor, EquipLevelMin: 171 },
    { id: 15185, aegis: 'Para_Team_Armor160', slot: 'armor' }), false);
  assert.equal(legalEquipRecord({ ...armor, Locations: { Shoes: true } },
    { id: 15185, aegis: 'Para_Team_Armor160', slot: 'armor' }), false);
});
