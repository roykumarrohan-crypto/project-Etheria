import React, { useState } from 'react';
import { PLAYABLE_CLASSES } from '../data/classes';
import {
  CRAFTING_RECIPES,
  ITEMS,
  RARITY_COLORS,
} from '../data/itemsAndCrafting';
import { QUESTS } from '../data/questsAndDialogue';
import { REGION_LIST, REGIONS } from '../data/regions';
import {
  GODOT_PROJECT_FILES,
  HARDWARE_COMPATIBILITY_REPORT,
  MILESTONE_CHECKLIST,
} from '../data/godotExportBundle';
import {
  canCraftRecipe,
  compareItemStats,
  evaluateWorldEndingSummary,
} from '../systems/rules';
import {
  ActivePanel,
  CharacterStats,
  EquipmentSlot,
  ProfessionType,
  RegionId,
  SaveSlotData,
} from '../types/game';
import { ItemSvgIcon } from './SvgIcons';

interface RpgPanelsProps {
  activePanel: ActivePanel;
  onClose: () => void;
  saveData: SaveSlotData;
  computedStats: CharacterStats;
  onEquipOrUseItem: (invIndex: number) => void;
  onUpgradeEquipped: (slot: EquipmentSlot) => void;
  onAllocateSkill: (nodeId: string) => void;
  onFastTravel: (regionId: RegionId) => void;
  onEnterDungeon: (regionId: RegionId) => void;
  onCraftRecipe: (recipeId: string) => void;
  saveSlots: (SaveSlotData | null)[];
  onSaveToSlot: (slotId: number) => void;
  onLoadFromSlot: (slotId: number) => void;
  onUpdateSettings: (partial: Partial<SaveSlotData['settings']>) => void;
}

export const RpgPanels: React.FC<RpgPanelsProps> = ({
  activePanel,
  onClose,
  saveData,
  computedStats,
  onEquipOrUseItem,
  onUpgradeEquipped,
  onAllocateSkill,
  onFastTravel,
  onEnterDungeon,
  onCraftRecipe,
  saveSlots,
  onSaveToSlot,
  onLoadFromSlot,
  onUpdateSettings,
}) => {
  const [selectedGodotFileIdx, setSelectedGodotFileIdx] = useState(0);

  if (activePanel === 'none') return null;

  const { character, inventory, equipment, quests, discoveredRegions } = saveData;
  const cls = PLAYABLE_CLASSES[character.classId];

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/70 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`RPG Panel: ${activePanel}`}
    >
      <div className="w-full max-w-4xl bg-[#0e1420] border border-amber-500/45 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[86vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#141c2c] border-b border-stone-800">
          <h2 className="text-lg font-bold text-amber-300 tracking-wide">
            {activePanel === 'inventory' && 'Inventory, Equipment & Blacksmith Tempering'}
            {activePanel === 'skills' && `${cls.name} Class Abilities & Skill Tree`}
            {activePanel === 'quests' && 'Quest Journal, Factions & Branching Chronicle'}
            {activePanel === 'map' && 'Continent Map of Etheria (Eight Interconnected Regions)'}
            {activePanel === 'crafting' && 'Gathering Professions & Crafting Workbenches'}
            {activePanel === 'studio' &&
              'Local Offline Saves, Low-Spec Settings & Godot 4 Windows Build'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-xs font-semibold text-stone-200 cursor-pointer"
          >
            Close [Esc]
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* 1. INVENTORY & EQUIPMENT */}
          {activePanel === 'inventory' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 5 cols: Equipped Gear & Blacksmith Upgrade */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-amber-300">
                    Equipped Gear & Tempering
                  </h3>
                  <span className="text-xs font-mono text-amber-300 tabular-nums">
                    {character.gold} Gold
                  </span>
                </div>

                {(['weapon', 'armor', 'helmet', 'boots', 'accessory'] as EquipmentSlot[]).map(
                  (slot) => {
                    const eq = equipment[slot];
                    const def = eq ? ITEMS[eq.itemId] : null;
                    const rar = def ? RARITY_COLORS[def.rarity] : RARITY_COLORS.Common;
                    const upg = eq?.upgradeLevel ?? 0;
                    const upgCost = (upg + 1) * 45;
                    return (
                      <div
                        key={slot}
                        className={`p-3 rounded-lg border ${rar.border} ${rar.bg} flex items-center justify-between gap-3`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {def && (
                            <ItemSvgIcon iconType={def.iconType} className="w-6 h-6 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="text-[10px] uppercase text-stone-400">{slot}</div>
                            <div className={`text-xs font-semibold truncate ${rar.text}`}>
                              {def ? `${def.name} ${upg > 0 ? `+${upg}` : ''}` : 'Empty Slot'}
                            </div>
                            {def && def.stats && (
                              <div className="text-[11px] text-stone-300 tabular-nums">
                                {Object.entries(def.stats)
                                  .map(([k, v]) => `${k}: +${v}`)
                                  .join(' · ')}
                              </div>
                            )}
                          </div>
                        </div>

                        {eq && upg < 10 && (
                          <button
                            type="button"
                            disabled={character.gold < upgCost}
                            onClick={() => onUpgradeEquipped(slot)}
                            className={`px-2.5 py-1.5 rounded text-[11px] font-semibold whitespace-nowrap shrink-0 tabular-nums cursor-pointer ${
                              character.gold >= upgCost
                                ? 'bg-amber-500 hover:bg-amber-400 text-stone-950'
                                : 'bg-stone-800 text-stone-500 cursor-not-allowed'
                            }`}
                          >
                            Temper +{upg + 1} ({upgCost}g)
                          </button>
                        )}
                      </div>
                    );
                  }
                )}
              </div>

              {/* Right 7 cols: 24-Slot Inventory Grid with Comparison Readouts */}
              <div className="lg:col-span-7 space-y-3">
                <h3 className="text-xs font-semibold text-amber-300">
                  Backpack Grid ({inventory.length} / 24 Slots)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {inventory.map((slotItem, idx) => {
                    const def = ITEMS[slotItem.itemId];
                    if (!def) return null;
                    const rar = RARITY_COLORS[def.rarity];
                    const isEquip =
                      def.category === 'weapon' ||
                      def.category === 'armor' ||
                      def.category === 'helmet' ||
                      def.category === 'boots' ||
                      def.category === 'accessory';
                    const diff = isEquip
                      ? compareItemStats(
                          def.id,
                          slotItem.upgradeLevel ?? 0,
                          equipment[def.category as EquipmentSlot]
                        )
                      : {};

                    return (
                      <div
                        key={`${slotItem.itemId}-${idx}`}
                        className={`p-3 rounded-lg border ${rar.border} ${rar.bg} flex flex-col justify-between gap-2`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <ItemSvgIcon iconType={def.iconType} className="w-6 h-6 shrink-0" />
                            <div className="min-w-0">
                              <div className={`text-xs font-bold truncate ${rar.text}`}>
                                {def.name}{' '}
                                {slotItem.upgradeLevel ? `+${slotItem.upgradeLevel}` : ''}
                              </div>
                              <div className="text-[10px] text-stone-400">
                                {def.rarity} · {def.category} · x{slotItem.quantity}
                              </div>
                            </div>
                          </div>
                        </div>

                        <p className="text-[11px] text-stone-300">{def.description}</p>

                        {isEquip && Object.keys(diff).length > 0 && (
                          <div className="text-[10px] font-mono tabular-nums flex flex-wrap gap-2">
                            {Object.entries(diff).map(([k, val]) => (
                              <span
                                key={k}
                                className={
                                  (val ?? 0) > 0 ? 'text-emerald-400' : 'text-red-400'
                                }
                              >
                                {k}: {(val ?? 0) > 0 ? `+${val}` : val}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex justify-end">
                          {(isEquip || def.category === 'consumable') && (
                            <button
                              type="button"
                              onClick={() => onEquipOrUseItem(idx)}
                              className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs cursor-pointer"
                            >
                              {isEquip ? 'Equip Item' : 'Use Consumable'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 2. CLASS ABILITIES & SKILL TREE */}
          {activePanel === 'skills' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 bg-stone-900/90 border border-stone-800 rounded-lg p-4">
                <div>
                  <div className="text-sm font-bold text-amber-300">
                    {cls.name} — {cls.title}
                  </div>
                  <div className="text-xs text-stone-300 mt-0.5">
                    Level {character.level} / 50 · Unspent Skill Points:{' '}
                    <strong className="text-amber-400 font-mono">
                      {character.skillPoints}
                    </strong>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 text-xs font-mono tabular-nums text-stone-200">
                  <span>HP: {computedStats.maxHp}</span>
                  <span>·</span>
                  <span>MP: {computedStats.maxMana}</span>
                  <span>·</span>
                  <span>ATK: {computedStats.attack}</span>
                  <span>·</span>
                  <span>SPL: {computedStats.spellPower}</span>
                  <span>·</span>
                  <span>DEF: {computedStats.defense}</span>
                  <span>·</span>
                  <span>CRIT: {computedStats.critChance}%</span>
                  <span>·</span>
                  <span>SPD: {computedStats.moveSpeed}</span>
                </div>
              </div>

              {/* Passive Skill Tree Nodes */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold text-amber-300">
                  Class Mastery Skill Tree
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {cls.skillTree.map((node) => {
                    const rank = character.skillRanks[node.id] ?? 0;
                    const canUpgrade =
                      character.skillPoints > 0 &&
                      rank < node.maxRank &&
                      character.level >= node.requiredLevel;
                    return (
                      <div
                        key={node.id}
                        className="bg-stone-900/90 border border-stone-800 rounded-lg p-4 flex items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-stone-100">
                            Tier {node.tier}: {node.name}{' '}
                            <span className="text-amber-300 font-mono tabular-nums">
                              ({rank}/{node.maxRank})
                            </span>
                          </div>
                          <p className="text-xs text-stone-300">{node.description}</p>
                          <div className="text-[11px] text-stone-400">
                            Requires Hero Level {node.requiredLevel}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={!canUpgrade}
                          onClick={() => onAllocateSkill(node.id)}
                          className={`px-3 py-2 rounded text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                            canUpgrade
                              ? 'bg-amber-500 hover:bg-amber-400 text-stone-950'
                              : 'bg-stone-800 text-stone-500 cursor-not-allowed'
                          }`}
                        >
                          {rank >= node.maxRank ? 'Maxed' : 'Train (+1 SP)'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active Class Abilities Breakdown */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold text-amber-300">
                  Active Combat Abilities (Keys 1–4)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {cls.abilities.map((ab) => (
                    <div
                      key={ab.id}
                      className="bg-stone-950/90 border border-stone-800 rounded-lg p-3.5 space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-amber-300">
                          [{ab.key}] {ab.name}
                        </span>
                        <span className="text-sky-300 font-mono tabular-nums">
                          {ab.manaCost} MP · {ab.cooldown}s CD
                        </span>
                      </div>
                      <div className="text-[11px] text-emerald-400">{ab.roleClue}</div>
                      <p className="text-xs text-stone-300">{ab.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 3. QUEST JOURNAL & DYNAMIC BRANCHING CHRONICLE */}
          {activePanel === 'quests' && (
            <div className="space-y-6">
              {/* Faction Standing & World Ending Forecast */}
              {(() => {
                const ending = evaluateWorldEndingSummary(
                  saveData.factionStanding,
                  saveData.clearedDungeons,
                  saveData.discoveredRegions
                );
                return (
                  <div className="bg-stone-900/90 border border-amber-500/35 rounded-lg p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-amber-300">
                        Dynamic Narrative Alignment: {ending.title}
                      </span>
                      <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
                        <span className="text-amber-300">
                          Silver Dawn: {saveData.factionStanding.silver_dawn}
                        </span>
                        <span>·</span>
                        <span className="text-purple-300">
                          Shadow Pact: {saveData.factionStanding.shadow_pact}
                        </span>
                        <span>·</span>
                        <span className="text-emerald-300">
                          Emerald Circle: {saveData.factionStanding.emerald_circle}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-stone-300 leading-relaxed">{ending.summary}</p>
                  </div>
                );
              })()}

              {/* Quest List */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-amber-300">
                  Active & Completed Chronicles
                </h3>
                {Object.values(QUESTS).map((qDef) => {
                  const prog = quests[qDef.id];
                  const status = prog ? prog.status : 'locked';
                  return (
                    <div
                      key={qDef.id}
                      className="bg-stone-950/90 border border-stone-800 rounded-lg p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-bold text-stone-100">
                          {qDef.title}{' '}
                          <span className="text-xs font-normal text-stone-400">
                            · {REGIONS[qDef.regionId].name} (Lv.{qDef.level})
                          </span>
                        </div>
                        <span
                          className={`text-xs font-semibold ${
                            status === 'completed'
                              ? 'text-emerald-400'
                              : status === 'active'
                              ? 'text-amber-300'
                              : 'text-stone-500'
                          }`}
                        >
                          {status === 'completed'
                            ? 'Completed'
                            : status === 'active'
                            ? 'Active'
                            : 'Available in Region'}
                        </span>
                      </div>
                      <p className="text-xs text-stone-300">{qDef.description}</p>
                      {prog && (
                        <div className="space-y-1 pt-1">
                          {qDef.objectives.map((obj) => {
                            const count = prog.objectiveCounts[obj.id] ?? 0;
                            return (
                              <div
                                key={obj.id}
                                className="text-xs text-amber-200 font-mono tabular-nums"
                              >
                                • {obj.description}: {count} / {obj.requiredCount}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. CONTINENT WORLD MAP & 8 INTERCONNECTED REGIONS */}
          {activePanel === 'map' && (
            <div className="space-y-5">
              {/* Interactive Illustrated Vector Cartography Map of Etheria */}
              <div className="relative w-full h-72 rounded-xl border border-amber-500/40 bg-[#0b1520] overflow-hidden shadow-inner">
                <svg viewBox="0 0 1000 420" className="w-full h-full">
                  <defs>
                    <radialGradient id="continentLand" cx="50%" cy="50%" r="55%">
                      <stop offset="0%" stopColor="#2c3e2e" />
                      <stop offset="65%" stopColor="#1e2923" />
                      <stop offset="100%" stopColor="#0f1e2e" />
                    </radialGradient>
                  </defs>
                  {/* Continent Landmass Silhouette */}
                  <path
                    d="M90,290 Q140,120 260,110 T480,95 T720,140 T910,95 Q940,220 840,310 T560,365 T240,340 Z"
                    fill="url(#continentLand)"
                    stroke="#d97706"
                    strokeOpacity="0.45"
                    strokeWidth="2.5"
                  />
                  {/* Inter-region travel lines */}
                  {REGION_LIST.map((r) =>
                    r.connectedRegions.map((conn) => {
                      const target = REGIONS[conn.regionId];
                      return (
                        <line
                          key={`${r.id}-${target.id}`}
                          x1={r.mapCoords.x * 10}
                          y1={r.mapCoords.y * 4.2}
                          x2={target.mapCoords.x * 10}
                          y2={target.mapCoords.y * 4.2}
                          stroke="#fbbf24"
                          strokeOpacity="0.35"
                          strokeDasharray="6 4"
                          strokeWidth="2"
                        />
                      );
                    })
                  )}
                </svg>

                {/* Region Pins */}
                {REGION_LIST.map((reg) => {
                  const isDiscovered = discoveredRegions.includes(reg.id);
                  const isCurrent = character.regionId === reg.id;
                  return (
                    <button
                      key={reg.id}
                      type="button"
                      onClick={() => onFastTravel(reg.id)}
                      style={{
                        left: `${reg.mapCoords.x}%`,
                        top: `${reg.mapCoords.y}%`,
                      }}
                      className={` -translate-x-1/2 -translate-y-1/2 absolute px-2.5 py-1 rounded-md border text-xs font-semibold transition-transform hover:scale-105 cursor-pointer whitespace-nowrap ${
                        isCurrent
                          ? 'bg-amber-500 text-stone-950 border-white shadow-lg'
                          : isDiscovered
                          ? 'bg-stone-900/95 text-amber-200 border-amber-400/60'
                          : 'bg-stone-950/85 text-stone-400 border-stone-700'
                      }`}
                    >
                      {reg.index}. {reg.name} {isCurrent ? '(Here)' : ''}
                    </button>
                  );
                })}
              </div>

              {/* 8 Regions Grid with Fast Travel & Dungeon Entry */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {REGION_LIST.map((reg) => {
                  const isDiscovered = discoveredRegions.includes(reg.id);
                  const isCurrent = character.regionId === reg.id;
                  const dungeonCleared = saveData.clearedDungeons.includes(reg.dungeon.id);
                  return (
                    <div
                      key={reg.id}
                      className="bg-stone-900/90 border border-stone-800 rounded-lg p-3.5 flex flex-col justify-between gap-2.5"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-300">
                            {reg.index}. {reg.name} · Lv.{reg.levelRange[0]}–{reg.levelRange[1]}
                          </span>
                          <span className="text-[11px] text-stone-400">
                            {isDiscovered ? 'Discovered' : 'Undiscovered Frontier'}
                          </span>
                        </div>
                        <p className="text-xs text-stone-300 mt-1">{reg.description}</p>
                        <div className="text-[11px] text-stone-400 mt-1">
                          Dungeon: <strong className="text-stone-200">{reg.dungeon.name}</strong>{' '}
                          {dungeonCleared ? '(Conquered)' : `(Lv.${reg.dungeon.recommendedLevel})`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onFastTravel(reg.id)}
                          className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs cursor-pointer"
                        >
                          {isCurrent ? 'In Region' : 'Travel to Region'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onEnterDungeon(reg.id)}
                          className="px-3 py-1.5 rounded bg-red-900/80 hover:bg-red-800 text-amber-200 border border-red-500/40 font-semibold text-xs cursor-pointer"
                        >
                          Challenge Dungeon Boss
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. PROFESSIONS & CRAFTING */}
          {activePanel === 'crafting' && (
            <div className="space-y-6">
              {/* 6 Profession Skill Ranks */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                {(
                  [
                    'Mining',
                    'Herbalism',
                    'Fishing',
                    'Blacksmithing',
                    'Alchemy',
                    'Cooking',
                  ] as ProfessionType[]
                ).map((prof) => (
                  <div
                    key={prof}
                    className="bg-stone-900/90 border border-stone-800 rounded-lg p-3 text-center"
                  >
                    <div className="text-xs font-semibold text-amber-300">{prof}</div>
                    <div className="text-sm font-bold text-stone-100 font-mono tabular-nums mt-0.5">
                      Lv.{character.professions[prof] ?? 1}
                    </div>
                  </div>
                ))}
              </div>

              {/* Crafting Recipes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {CRAFTING_RECIPES.map((rcp) => {
                  const check = canCraftRecipe(
                    rcp.id,
                    inventory,
                    character.gold,
                    character.professions
                  );
                  const outItem = ITEMS[rcp.resultItemId];
                  return (
                    <div
                      key={rcp.id}
                      className="bg-stone-950/90 border border-stone-800 rounded-lg p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          {outItem && (
                            <ItemSvgIcon iconType={outItem.iconType} className="w-6 h-6" />
                          )}
                          <div>
                            <div className="text-xs font-bold text-stone-100">
                              {rcp.name} (x{rcp.resultQty})
                            </div>
                            <div className="text-[11px] text-amber-300">
                              {rcp.profession} Lv.{rcp.requiredSkillLevel} · Cost: {rcp.goldCost}g
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={!check.allowed}
                          onClick={() => onCraftRecipe(rcp.id)}
                          className={`px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap cursor-pointer ${
                            check.allowed
                              ? 'bg-amber-500 hover:bg-amber-400 text-stone-950'
                              : 'bg-stone-800 text-stone-500 cursor-not-allowed'
                          }`}
                        >
                          {check.allowed ? 'Craft Item' : check.reason}
                        </button>
                      </div>

                      <div className="text-xs text-stone-400">
                        Ingredients:{' '}
                        {rcp.ingredients
                          .map((ing) => `${ITEMS[ing.itemId]?.name ?? ing.itemId} x${ing.count}`)
                          .join(' · ')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 6. LOCAL SAVES, LOW-SPEC SETTINGS & GODOT 4 / WINDOWS BUILD STUDIO */}
          {activePanel === 'studio' && (
            <div className="space-y-6">
              {/* 3 Local Offline Save Slots */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold text-amber-300">
                  Local Offline Save Slots (Atomic Checksum & .bak Recovery)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[1, 2, 3].map((slotId) => {
                    const slot = saveSlots[slotId - 1];
                    return (
                      <div
                        key={slotId}
                        className="bg-stone-900/90 border border-stone-800 rounded-lg p-3.5 space-y-2"
                      >
                        <div className="text-xs font-bold text-amber-300">
                          Save Slot {slotId}
                        </div>
                        {slot ? (
                          <div className="text-xs text-stone-300 space-y-0.5 tabular-nums">
                            <div>
                              {slot.character.customization.name} · Lv.{slot.character.level}{' '}
                              {PLAYABLE_CLASSES[slot.character.classId].name}
                            </div>
                            <div className="text-stone-400">
                              {REGIONS[slot.character.regionId].name} · {slot.character.gold}g
                            </div>
                            <div className="text-[10px] text-stone-500 font-mono">
                              CRC: {slot.checksum}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-stone-500">Empty Slot</div>
                        )}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => onSaveToSlot(slotId)}
                            className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs cursor-pointer"
                          >
                            Save Here
                          </button>
                          {slot && (
                            <>
                              <button
                                type="button"
                                onClick={() => onLoadFromSlot(slotId)}
                                className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs cursor-pointer"
                              >
                                Load
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  downloadFile(
                                    `project_etheria_slot_${slotId}.json`,
                                    JSON.stringify(slot, null, 2)
                                  )
                                }
                                className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-amber-300 text-xs cursor-pointer"
                              >
                                Export .json
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Performance & Audio Settings */}
              <div className="bg-stone-900/90 border border-stone-800 rounded-lg p-4 space-y-3">
                <h3 className="text-xs font-semibold text-amber-300">
                  Audio & Intel HD Graphics 2000 Performance Settings
                </h3>
                <div className="flex flex-wrap items-center gap-6 text-xs text-stone-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveData.settings.lowSpecMode}
                      onChange={(e) =>
                        onUpdateSettings({ lowSpecMode: e.target.checked })
                      }
                    />
                    <span>Intel HD 2000 30 FPS Low-Spec Mode</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveData.settings.weatherEnabled}
                      onChange={(e) =>
                        onUpdateSettings({ weatherEnabled: e.target.checked })
                      }
                    />
                    <span>Atmospheric Weather Particles</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveData.settings.sfxEnabled}
                      onChange={(e) =>
                        onUpdateSettings({ sfxEnabled: e.target.checked })
                      }
                    />
                    <span>Combat & World Sound Effects</span>
                  </label>
                </div>
              </div>

              {/* Hardware Compatibility Verification & Godot 4 / Windows Build Exporter */}
              <div className="bg-stone-950/90 border border-amber-500/35 rounded-lg p-4 space-y-3">
                <div className="text-xs font-bold text-amber-300">
                  Target Hardware Audit: {HARDWARE_COMPATIBILITY_REPORT.targetCpu} ·{' '}
                  {HARDWARE_COMPATIBILITY_REPORT.targetGpu}
                </div>
                <p className="text-xs text-stone-300 leading-relaxed">
                  {HARDWARE_COMPATIBILITY_REPORT.verificationFinding}
                </p>
                <p className="text-xs text-emerald-400 leading-relaxed">
                  {HARDWARE_COMPATIBILITY_REPORT.solutionImplemented}
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {GODOT_PROJECT_FILES.map((gf, i) => (
                    <button
                      key={gf.path}
                      type="button"
                      onClick={() => setSelectedGodotFileIdx(i)}
                      className={`px-2.5 py-1 rounded text-xs font-mono cursor-pointer ${
                        selectedGodotFileIdx === i
                          ? 'bg-amber-500 text-stone-950 font-semibold'
                          : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                      }`}
                    >
                      {gf.path}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const file = GODOT_PROJECT_FILES[selectedGodotFileIdx];
                      downloadFile(file.path.replace(/\//g, '_'), file.content);
                    }}
                    className="ml-auto px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs cursor-pointer"
                  >
                    Download File
                  </button>
                </div>

                <pre className="p-3 rounded bg-black/80 border border-stone-800 text-[11px] font-mono text-stone-300 overflow-x-auto max-h-48">
                  {GODOT_PROJECT_FILES[selectedGodotFileIdx].content}
                </pre>
              </div>

              {/* 10-Milestone Engineering Verification Checklist */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-amber-300">
                  10-Milestone Development Checklist
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {MILESTONE_CHECKLIST.map((m) => (
                    <div
                      key={m.id}
                      className="bg-stone-900/80 border border-stone-800 rounded p-2.5 text-xs"
                    >
                      <div className="font-semibold text-emerald-400">
                        ✓ {m.title}
                      </div>
                      <div className="text-stone-400 text-[11px] mt-0.5">
                        {m.details}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
