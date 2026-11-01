import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addItemToInventory,
  applyXpAndLevelUp,
  calculateCombatDamage,
  canCraftRecipe,
  compareItemStats,
  computeCharacterStats,
  computeSaveChecksum,
  createInitialSaveState,
  evaluateWorldEndingSummary,
  MAX_LEVEL,
  removeItemFromInventory,
  xpRequiredForLevel,
} from './rules';
import { PLAYABLE_CLASSES } from '../data/classes';
import { REGION_LIST } from '../data/regions';

test('all 5 playable classes and 8 open-world regions are defined', () => {
  const classKeys = Object.keys(PLAYABLE_CLASSES);
  assert.deepEqual(classKeys.sort(), ['archer', 'assassin', 'mage', 'paladin', 'warrior']);
  assert.equal(REGION_LIST.length, 8);
  assert.equal(REGION_LIST[0].id, 'greenhaven');
  assert.equal(REGION_LIST[7].id, 'voidlands');
});

test('XP progression levels up and grants skill points up to level 50 cap', () => {
  const req1 = xpRequiredForLevel(1);
  assert.equal(req1, 100);

  const res = applyXpAndLevelUp(1, 0, 120, 2);
  assert.equal(res.level, 2);
  assert.equal(res.xp, 20);
  assert.equal(res.skillPoints, 4);
  assert.equal(res.leveledUp, true);

  const capped = applyXpAndLevelUp(MAX_LEVEL, 0, 99999, 10);
  assert.equal(capped.level, MAX_LEVEL);
  assert.equal(capped.xp, 0);
});

test('character stats scale with level, equipment upgrades, and skill tree ranks', () => {
  const save = createInitialSaveState(1, 'warrior', {
    name: 'Aethelgard',
    hairColor: '#f59e0b',
    skinTone: '#e6bea5',
    cloakColor: '#b91c1c',
    origin: 'Highland Vanguard',
  });

  const base = computeCharacterStats('warrior', 1, save.equipment, {});
  const upgradedEquip = {
    ...save.equipment,
    weapon: { itemId: 'wpn_iron_greatsword', quantity: 1, upgradeLevel: 5 },
  };
  const withSkills = computeCharacterStats('warrior', 5, upgradedEquip, { war_sk_1: 3 });

  assert.ok(withSkills.maxHp > base.maxHp);
  assert.ok(withSkills.attack > base.attack);
  assert.ok(withSkills.defense > base.defense);
});

test('combat damage calculation applies armor mitigation and critical strikes', () => {
  const normalHit = calculateCombatDamage({
    attackerPower: 50,
    defenderDefense: 20,
    damageMultiplier: 1.5,
    critChance: 20,
    deterministicRoll: 0.5, // non-crit
  });

  const critHit = calculateCombatDamage({
    attackerPower: 50,
    defenderDefense: 20,
    damageMultiplier: 1.5,
    critChance: 20,
    deterministicRoll: 0.05, // crit
  });

  assert.equal(normalHit.isCrit, false);
  assert.equal(critHit.isCrit, true);
  assert.ok(critHit.damage > normalHit.damage);
});

test('inventory stacking, removal, and crafting recipe validation work accurately', () => {
  let inv = addItemToInventory([], 'mat_sunleaf_herb', 2);
  inv = addItemToInventory(inv, 'mat_sunleaf_herb', 3);
  assert.equal(inv.length, 1);
  assert.equal(inv[0].quantity, 5);

  const craftCheck = canCraftRecipe('rcp_health_pot', inv, 50, {
    Mining: 1,
    Herbalism: 1,
    Fishing: 1,
    Blacksmithing: 1,
    Alchemy: 1,
    Cooking: 1,
  });
  assert.equal(craftCheck.allowed, true);

  inv = removeItemFromInventory(inv, 'mat_sunleaf_herb', 4);
  assert.equal(inv[0].quantity, 1);

  const failCheck = canCraftRecipe('rcp_health_pot', inv, 50, {
    Mining: 1,
    Herbalism: 1,
    Fishing: 1,
    Blacksmithing: 1,
    Alchemy: 1,
    Cooking: 1,
  });
  assert.equal(failCheck.allowed, false);
});

test('equipment comparison and save checksum verification work deterministically', () => {
  const diff = compareItemStats('wpn_silverwind_blade', 0, {
    itemId: 'wpn_iron_greatsword',
    quantity: 1,
    upgradeLevel: 0,
  });
  assert.ok((diff.attack ?? 0) > 0);

  const save = createInitialSaveState(1, 'mage', {
    name: 'Lyra',
    hairColor: '#38bdf8',
    skinTone: '#f3d8c7',
    cloakColor: '#1d4ed8',
    origin: 'Arcane Scholomance',
  });
  assert.equal(save.checksum, computeSaveChecksum(save));

  const ending = evaluateWorldEndingSummary(
    { silver_dawn: 20, shadow_pact: 65, emerald_circle: 30 },
    ['dng_greenhaven_keep'],
    ['greenhaven', 'whispering_woods']
  );
  assert.equal(ending.dominantFaction, 'shadow_pact');
});
