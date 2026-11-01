export type CharacterClassId = 'warrior' | 'mage' | 'archer' | 'assassin' | 'paladin';

export type RegionId =
  | 'greenhaven'
  | 'whispering_woods'
  | 'silverwind_plains'
  | 'ashen_mountains'
  | 'shadowfen'
  | 'sunken_kingdom'
  | 'dragonfall'
  | 'voidlands';

export type ItemRarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

export type EquipmentSlot = 'weapon' | 'armor' | 'helmet' | 'boots' | 'accessory';

export type ItemCategory = EquipmentSlot | 'consumable' | 'material';

export type ProfessionType =
  | 'Mining'
  | 'Herbalism'
  | 'Fishing'
  | 'Blacksmithing'
  | 'Alchemy'
  | 'Cooking';

export type FactionId = 'silver_dawn' | 'shadow_pact' | 'emerald_circle';

export type GameState = 'title' | 'playing' | 'paused' | 'gameover';

export type ActivePanel =
  | 'none'
  | 'inventory'
  | 'skills'
  | 'quests'
  | 'map'
  | 'crafting'
  | 'studio'
  | 'merchant'
  | 'dungeon';

export interface CharacterCustomization {
  name: string;
  hairColor: string;
  skinTone: string;
  cloakColor: string;
  origin: 'Highland Vanguard' | 'Arcane Scholomance' | 'Verdant Outrider' | 'Twilight Guild';
}

export interface CharacterStats {
  maxHp: number;
  maxMana: number;
  attack: number;
  spellPower: number;
  defense: number;
  critChance: number; // 0 to 100
  moveSpeed: number;
}

export interface ClassAbility {
  id: string;
  key: '1' | '2' | '3' | '4';
  name: string;
  roleClue: string;
  description: string;
  manaCost: number;
  cooldown: number; // seconds
  damageMultiplier: number;
  range: number;
  aoeRadius?: number;
  healAmount?: number;
  buffDuration?: number;
  isProjectile?: boolean;
  color: string;
}

export interface SkillNode {
  id: string;
  name: string;
  tier: 1 | 2 | 3;
  maxRank: number;
  description: string;
  statBonus: Partial<CharacterStats>;
  requiredLevel: number;
}

export interface ClassDefinition {
  id: CharacterClassId;
  name: string;
  title: string;
  strengths: string;
  weaknesses: string;
  mechanicSummary: string;
  primaryColor: string;
  secondaryColor: string;
  baseStats: CharacterStats;
  abilities: ClassAbility[];
  skillTree: SkillNode[];
  startingEquipment: Record<EquipmentSlot, string>;
}

export interface ItemDefinition {
  id: string;
  name: string;
  category: ItemCategory;
  rarity: ItemRarity;
  levelReq: number;
  value: number; // gold value
  description: string;
  stats?: Partial<CharacterStats>;
  healHp?: number;
  restoreMana?: number;
  buffAttack?: number;
  iconType:
    | 'sword'
    | 'staff'
    | 'bow'
    | 'dagger'
    | 'hammer'
    | 'armor'
    | 'helmet'
    | 'boots'
    | 'ring'
    | 'potion_hp'
    | 'potion_mp'
    | 'food'
    | 'ore'
    | 'herb'
    | 'fish'
    | 'gem';
}

export interface InventoryItem {
  itemId: string;
  quantity: number;
  upgradeLevel?: number; // +0 to +10 for equipment
}

export interface CraftingRecipe {
  id: string;
  name: string;
  profession: 'Blacksmithing' | 'Alchemy' | 'Cooking';
  resultItemId: string;
  resultQty: number;
  requiredSkillLevel: number;
  ingredients: { itemId: string; count: number }[];
  goldCost: number;
}

export type EnemyPolicy = 'chaser' | 'kiter' | 'charger' | 'orbiter';

export type EnemyArchetype =
  | 'Goblin'
  | 'Orc'
  | 'Skeleton'
  | 'Wolf'
  | 'Giant Spider'
  | 'Bandit'
  | 'Undead Warrior'
  | 'Dark Mage'
  | 'Magical Beast'
  | 'Dragon';

export interface EnemyTemplate {
  id: string;
  name: string;
  archetype: EnemyArchetype;
  level: number;
  maxHp: number;
  attack: number;
  defense: number;
  moveSpeed: number;
  detectionRange: number;
  attackRange: number;
  policy: EnemyPolicy;
  xpReward: number;
  goldReward: [number, number];
  isBoss?: boolean;
  bossPhases?: {
    phaseName: string;
    hpThreshold: number; // e.g. 0.65, 0.30
    specialPattern: 'nova_ring' | 'line_charge' | 'summon_adds' | 'void_beam';
  }[];
  color: string;
  accentColor: string;
  radius: number;
  lootTable: { itemId: string; chance: number }[];
}

export interface ResourceNodeTemplate {
  id: string;
  name: string;
  profession: 'Mining' | 'Herbalism' | 'Fishing';
  itemId: string;
  xpReward: number;
  color: string;
  x: number;
  y: number;
}

export interface NpcDefinition {
  id: string;
  name: string;
  role: string;
  regionId: RegionId;
  x: number;
  y: number;
  color: string;
  isMerchant?: boolean;
  merchantItems?: string[];
  dialogueGreeting: string;
  questIds: string[];
  branchingChoices?: {
    id: string;
    prompt: string;
    faction: FactionId;
    reputationDelta: number;
    outcomeText: string;
    rewardItemId?: string;
    rewardGold?: number;
  }[];
}

export interface DungeonDefinition {
  id: string;
  name: string;
  regionId: RegionId;
  recommendedLevel: number;
  description: string;
  bossTemplateId: string;
  x: number;
  y: number;
  rewardItemId: string;
}

export interface RegionDefinition {
  id: RegionId;
  index: number;
  name: string;
  subtitle: string;
  levelRange: [number, number];
  description: string;
  groundColor: string;
  secondaryGroundColor: string;
  waterColor: string;
  foliageColor: string;
  weatherType: 'clear_fireflies' | 'forest_spores' | 'wind_petals' | 'ash_embers' | 'fen_mist' | 'coral_bubbles' | 'dragon_cinders' | 'void_motes';
  connectedRegions: { regionId: RegionId; direction: 'north' | 'south' | 'east' | 'west'; x: number; y: number }[];
  npcs: NpcDefinition[];
  enemyTemplateIds: string[];
  bossTemplateId: string;
  dungeon: DungeonDefinition;
  resources: ResourceNodeTemplate[];
  hiddenLocation: {
    id: string;
    name: string;
    x: number;
    y: number;
    loreText: string;
    treasureItemId: string;
    goldReward: number;
  };
  mapCoords: { x: number; y: number }; // 0-100 percentage on continent map
}

export interface QuestObjective {
  id: string;
  description: string;
  type: 'kill' | 'gather' | 'visit_region' | 'boss' | 'choice';
  targetId: string;
  requiredCount: number;
}

export interface QuestDefinition {
  id: string;
  title: string;
  regionId: RegionId;
  isMainStory: boolean;
  level: number;
  giverNpcId: string;
  description: string;
  objectives: QuestObjective[];
  xpReward: number;
  goldReward: number;
  itemRewardId?: string;
  nextQuestId?: string;
}

export interface QuestProgress {
  questId: string;
  status: 'active' | 'completed';
  objectiveCounts: Record<string, number>;
}

export interface SaveSlotData {
  slotId: number;
  savedAt: string;
  checksum: string;
  character: {
    classId: CharacterClassId;
    customization: CharacterCustomization;
    level: number;
    xp: number;
    gold: number;
    hp: number;
    mana: number;
    regionId: RegionId;
    x: number;
    y: number;
    skillRanks: Record<string, number>;
    skillPoints: number;
    professions: Record<ProfessionType, number>;
  };
  inventory: InventoryItem[];
  equipment: Record<EquipmentSlot, InventoryItem | null>;
  quests: Record<string, QuestProgress>;
  discoveredRegions: RegionId[];
  discoveredHiddenLocations: string[];
  clearedDungeons: string[];
  narrativeChoices: Record<string, string>;
  factionStanding: Record<FactionId, number>;
  settings: {
    masterVolume: number;
    musicEnabled: boolean;
    sfxEnabled: boolean;
    weatherEnabled: boolean;
    lowSpecMode: boolean; // Intel HD 2000 30 FPS compatibility mode
  };
}
