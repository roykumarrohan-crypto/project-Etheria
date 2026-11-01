import { PLAYABLE_CLASSES } from '../data/classes';
import { CRAFTING_RECIPES, ITEMS } from '../data/itemsAndCrafting';
import { QUESTS } from '../data/questsAndDialogue';
import { REGIONS } from '../data/regions';
import {
  CharacterClassId,
  CharacterCustomization,
  CharacterStats,
  EquipmentSlot,
  FactionId,
  InventoryItem,
  ProfessionType,
  RegionId,
  SaveSlotData,
} from '../types/game';

export const MAX_LEVEL = 50;

export function xpRequiredForLevel(level: number): number {
  const clamped = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return Math.round(100 * Math.pow(clamped, 1.35));
}

export function computeCharacterStats(
  classId: CharacterClassId,
  level: number,
  equipment: Record<EquipmentSlot, InventoryItem | null>,
  skillRanks: Record<string, number>
): CharacterStats {
  const cls = PLAYABLE_CLASSES[classId];
  const lvlIndex = Math.max(0, level - 1);

  const stats: CharacterStats = {
    maxHp: cls.baseStats.maxHp + lvlIndex * 28,
    maxMana: cls.baseStats.maxMana + lvlIndex * 12,
    attack: cls.baseStats.attack + lvlIndex * 5,
    spellPower: cls.baseStats.spellPower + lvlIndex * 5,
    defense: cls.baseStats.defense + lvlIndex * 3,
    critChance: cls.baseStats.critChance,
    moveSpeed: cls.baseStats.moveSpeed,
  };

  // Add equipment bonuses + blacksmith upgrade multiplier (+12% per upgrade level)
  const slots: EquipmentSlot[] = ['weapon', 'armor', 'helmet', 'boots', 'accessory'];
  for (const slot of slots) {
    const equipped = equipment[slot];
    if (!equipped) continue;
    const itemDef = ITEMS[equipped.itemId];
    if (!itemDef || !itemDef.stats) continue;
    const upgradeMult = 1 + (equipped.upgradeLevel ?? 0) * 0.12;
    if (itemDef.stats.maxHp) stats.maxHp += Math.round(itemDef.stats.maxHp * upgradeMult);
    if (itemDef.stats.maxMana) stats.maxMana += Math.round(itemDef.stats.maxMana * upgradeMult);
    if (itemDef.stats.attack) stats.attack += Math.round(itemDef.stats.attack * upgradeMult);
    if (itemDef.stats.spellPower)
      stats.spellPower += Math.round(itemDef.stats.spellPower * upgradeMult);
    if (itemDef.stats.defense) stats.defense += Math.round(itemDef.stats.defense * upgradeMult);
    if (itemDef.stats.critChance) stats.critChance += itemDef.stats.critChance;
    if (itemDef.stats.moveSpeed) stats.moveSpeed += itemDef.stats.moveSpeed;
  }

  // Add skill tree bonuses
  for (const node of cls.skillTree) {
    const rank = Math.min(node.maxRank, Math.max(0, skillRanks[node.id] ?? 0));
    if (rank <= 0) continue;
    if (node.statBonus.maxHp) stats.maxHp += node.statBonus.maxHp * rank;
    if (node.statBonus.maxMana) stats.maxMana += node.statBonus.maxMana * rank;
    if (node.statBonus.attack) stats.attack += node.statBonus.attack * rank;
    if (node.statBonus.spellPower) stats.spellPower += node.statBonus.spellPower * rank;
    if (node.statBonus.defense) stats.defense += node.statBonus.defense * rank;
    if (node.statBonus.critChance) stats.critChance += node.statBonus.critChance * rank;
    if (node.statBonus.moveSpeed) stats.moveSpeed += node.statBonus.moveSpeed * rank;
  }

  stats.critChance = Math.min(85, Math.max(5, stats.critChance));
  stats.moveSpeed = Math.min(360, Math.max(150, stats.moveSpeed));

  return stats;
}

export function calculateCombatDamage(params: {
  attackerPower: number;
  defenderDefense: number;
  damageMultiplier: number;
  critChance: number;
  deterministicRoll?: number; // 0..1 for unit tests
}): { damage: number; isCrit: boolean } {
  const roll = params.deterministicRoll ?? Math.random();
  const isCrit = roll * 100 < params.critChance;
  const raw = params.attackerPower * params.damageMultiplier;
  const mitigation = 100 / (100 + Math.max(0, params.defenderDefense * 1.4));
  const critMult = isCrit ? 1.65 : 1.0;
  const finalDamage = Math.max(4, Math.round(raw * mitigation * critMult));
  return { damage: finalDamage, isCrit };
}

export function compareItemStats(
  candidateItemId: string,
  candidateUpgrade: number,
  currentEquipped: InventoryItem | null
): Partial<CharacterStats> {
  const candidateDef = ITEMS[candidateItemId];
  if (!candidateDef || !candidateDef.stats) return {};
  const candMult = 1 + candidateUpgrade * 0.12;
  const currDef = currentEquipped ? ITEMS[currentEquipped.itemId] : null;
  const currMult = currentEquipped ? 1 + (currentEquipped.upgradeLevel ?? 0) * 0.12 : 1;

  const keys: (keyof CharacterStats)[] = [
    'attack',
    'spellPower',
    'defense',
    'maxHp',
    'maxMana',
    'critChance',
    'moveSpeed',
  ];
  const diff: Partial<CharacterStats> = {};
  for (const key of keys) {
    const cVal = candidateDef.stats[key]
      ? key === 'critChance' || key === 'moveSpeed'
        ? candidateDef.stats[key]!
        : Math.round(candidateDef.stats[key]! * candMult)
      : 0;
    const eVal =
      currDef && currDef.stats && currDef.stats[key]
        ? key === 'critChance' || key === 'moveSpeed'
          ? currDef.stats[key]!
          : Math.round(currDef.stats[key]! * currMult)
        : 0;
    if (cVal !== eVal) {
      diff[key] = cVal - eVal;
    }
  }
  return diff;
}

export function addItemToInventory(
  inventory: InventoryItem[],
  itemId: string,
  quantity: number = 1,
  upgradeLevel: number = 0
): InventoryItem[] {
  const itemDef = ITEMS[itemId];
  if (!itemDef || quantity <= 0) return inventory;
  const next = inventory.map((i) => ({ ...i }));

  // Stack consumables and materials
  if (itemDef.category === 'consumable' || itemDef.category === 'material') {
    const existing = next.find((i) => i.itemId === itemId);
    if (existing) {
      existing.quantity += quantity;
      return next;
    }
  }

  next.push({ itemId, quantity, upgradeLevel });
  return next;
}

export function removeItemFromInventory(
  inventory: InventoryItem[],
  itemId: string,
  quantity: number = 1
): InventoryItem[] {
  const next: InventoryItem[] = [];
  let remainingToRemove = quantity;

  for (const slot of inventory) {
    if (slot.itemId === itemId && remainingToRemove > 0) {
      if (slot.quantity > remainingToRemove) {
        next.push({ ...slot, quantity: slot.quantity - remainingToRemove });
        remainingToRemove = 0;
      } else {
        remainingToRemove -= slot.quantity;
      }
    } else {
      next.push({ ...slot });
    }
  }
  return next;
}

export function canCraftRecipe(
  recipeId: string,
  inventory: InventoryItem[],
  gold: number,
  professions: Record<ProfessionType, number>
): { allowed: boolean; reason?: string } {
  const recipe = CRAFTING_RECIPES.find((r) => r.id === recipeId);
  if (!recipe) return { allowed: false, reason: 'Unknown recipe' };
  if (gold < recipe.goldCost) return { allowed: false, reason: 'Insufficient Gold' };
  if ((professions[recipe.profession] ?? 1) < recipe.requiredSkillLevel) {
    return {
      allowed: false,
      reason: `Requires ${recipe.profession} Lv.${recipe.requiredSkillLevel}`,
    };
  }
  for (const ing of recipe.ingredients) {
    const owned = inventory
      .filter((i) => i.itemId === ing.itemId)
      .reduce((sum, i) => sum + i.quantity, 0);
    if (owned < ing.count) {
      const itemName = ITEMS[ing.itemId]?.name ?? ing.itemId;
      return { allowed: false, reason: `Missing ${itemName} (${owned}/${ing.count})` };
    }
  }
  return { allowed: true };
}

export function computeSaveChecksum(data: Omit<SaveSlotData, 'checksum'>): string {
  const raw = `${data.slotId}:${data.character.classId}:${data.character.level}:${data.character.xp}:${data.character.gold}:${data.character.regionId}:${data.inventory.length}`;
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `eth_${(hash >>> 0).toString(16)}`;
}

export function createInitialSaveState(
  slotId: number,
  classId: CharacterClassId,
  customization: CharacterCustomization
): SaveSlotData {
  const cls = PLAYABLE_CLASSES[classId];
  const equipment: Record<EquipmentSlot, InventoryItem | null> = {
    weapon: { itemId: cls.startingEquipment.weapon, quantity: 1, upgradeLevel: 0 },
    armor: { itemId: cls.startingEquipment.armor, quantity: 1, upgradeLevel: 0 },
    helmet: { itemId: cls.startingEquipment.helmet, quantity: 1, upgradeLevel: 0 },
    boots: { itemId: cls.startingEquipment.boots, quantity: 1, upgradeLevel: 0 },
    accessory: { itemId: cls.startingEquipment.accessory, quantity: 1, upgradeLevel: 0 },
  };

  const initialStats = computeCharacterStats(classId, 1, equipment, {});

  const baseData: Omit<SaveSlotData, 'checksum'> = {
    slotId,
    savedAt: new Date().toISOString(),
    character: {
      classId,
      customization,
      level: 1,
      xp: 0,
      gold: 150,
      hp: initialStats.maxHp,
      mana: initialStats.maxMana,
      regionId: 'greenhaven',
      x: 560,
      y: 660,
      skillRanks: {},
      skillPoints: 2,
      professions: {
        Mining: 1,
        Herbalism: 1,
        Fishing: 1,
        Blacksmithing: 1,
        Alchemy: 1,
        Cooking: 1,
      },
    },
    inventory: [
      { itemId: 'pot_health_minor', quantity: 4 },
      { itemId: 'pot_mana_minor', quantity: 3 },
      { itemId: 'food_roast_salmon', quantity: 2 },
      { itemId: 'mat_copper_ore', quantity: 2 },
      { itemId: 'mat_sunleaf_herb', quantity: 2 },
    ],
    equipment,
    quests: {
      q_main_1_greenhaven: {
        questId: 'q_main_1_greenhaven',
        status: 'active',
        objectiveCounts: { obj_kill_goblins: 0 },
      },
      q_side_greenhaven_herbs: {
        questId: 'q_side_greenhaven_herbs',
        status: 'active',
        objectiveCounts: { obj_gather_gh: 0 },
      },
    },
    discoveredRegions: ['greenhaven', 'whispering_woods'],
    discoveredHiddenLocations: [],
    clearedDungeons: [],
    narrativeChoices: {},
    factionStanding: {
      silver_dawn: 10,
      shadow_pact: 10,
      emerald_circle: 10,
    },
    settings: {
      masterVolume: 0.75,
      musicEnabled: true,
      sfxEnabled: true,
      weatherEnabled: true,
      lowSpecMode: false,
    },
  };

  return {
    ...baseData,
    checksum: computeSaveChecksum(baseData),
  };
}

export function applyXpAndLevelUp(
  currentLevel: number,
  currentXp: number,
  gainedXp: number,
  currentSkillPoints: number
): { level: number; xp: number; skillPoints: number; leveledUp: boolean } {
  let level = currentLevel;
  let xp = currentXp + Math.max(0, gainedXp);
  let skillPoints = currentSkillPoints;
  let leveledUp = false;

  while (level < MAX_LEVEL) {
    const needed = xpRequiredForLevel(level);
    if (xp >= needed) {
      xp -= needed;
      level += 1;
      skillPoints += 2;
      leveledUp = true;
    } else {
      break;
    }
  }

  if (level >= MAX_LEVEL) {
    level = MAX_LEVEL;
    xp = 0;
  }

  return { level, xp, skillPoints, leveledUp };
}

export function evaluateWorldEndingSummary(
  factionStanding: Record<FactionId, number>,
  clearedDungeons: string[],
  discoveredRegions: RegionId[]
): { dominantFaction: FactionId; title: string; summary: string } {
  const entries = Object.entries(factionStanding) as [FactionId, number][];
  entries.sort((a, b) => b[1] - a[1]);
  const dominantFaction = entries[0][0];

  const regionCount = discoveredRegions.length;
  const totalRegions = Object.keys(REGIONS).length;
  const questTotal = Object.keys(QUESTS).length;

  if (dominantFaction === 'silver_dawn') {
    return {
      dominantFaction,
      title: 'Age of the Radiant Dawn',
      summary: `With ${regionCount}/${totalRegions} regions charted and ${clearedDungeons.length} dungeons conquered across ${questTotal} chronicles, the Order of the Silver Dawn seals the Void Rift under a golden covenant.`,
    };
  }
  if (dominantFaction === 'shadow_pact') {
    return {
      dominantFaction,
      title: 'Ascendancy of the Astral Veil',
      summary: `With ${regionCount}/${totalRegions} regions charted and ${clearedDungeons.length} dungeons conquered, the Shadow Pact harnesses the Voidlands singularity to crown an immortal sovereign.`,
    };
  }
  return {
    dominantFaction: 'emerald_circle',
    title: 'Harmony of the World-Bough',
    summary: `With ${regionCount}/${totalRegions} regions charted and ${clearedDungeons.length} dungeons conquered, the Emerald Circle restores the primal ley-lines across all eight biomes of Etheria.`,
  };
}
