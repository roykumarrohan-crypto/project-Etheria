import React from 'react';
import { PLAYABLE_CLASSES } from '../data/classes';
import { REGIONS } from '../data/regions';
import { QUESTS } from '../data/questsAndDialogue';
import { xpRequiredForLevel } from '../systems/rules';
import {
  ActivePanel,
  CharacterStats,
  SaveSlotData,
} from '../types/game';
import { ClassEmblemIcon } from './SvgIcons';

interface HudOverlayProps {
  saveData: SaveSlotData;
  computedStats: CharacterStats;
  hpGhost: number;
  abilityCooldowns: number[];
  dodgeCooldown: number;
  activePanel: ActivePanel;
  onTogglePanel: (panel: ActivePanel) => void;
  onTriggerAbility: (index: number) => void;
  onTriggerDodge: () => void;
  onDrinkPotion: () => void;
  onInteractNearby: () => void;
  nearbyInteractPrompt: string | null;
  activeBossStatus: { name: string; hp: number; maxHp: number; phaseName?: string } | null;
  isMuted: boolean;
  onToggleMute: () => void;
  onPauseGame: () => void;
  statusBanner: string | null;
  minimapCanvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export const HudOverlay: React.FC<HudOverlayProps> = ({
  saveData,
  computedStats,
  hpGhost,
  abilityCooldowns,
  dodgeCooldown,
  activePanel,
  onTogglePanel,
  onTriggerAbility,
  onTriggerDodge,
  onDrinkPotion,
  onInteractNearby,
  nearbyInteractPrompt,
  activeBossStatus,
  isMuted,
  onToggleMute,
  onPauseGame,
  statusBanner,
  minimapCanvasRef,
}) => {
  const { character, inventory, quests } = saveData;
  const cls = PLAYABLE_CLASSES[character.classId];
  const region = REGIONS[character.regionId];
  const xpReq = xpRequiredForLevel(character.level);
  const hpPct = Math.max(0, Math.min(100, (character.hp / computedStats.maxHp) * 100));
  const ghostPct = Math.max(hpPct, Math.min(100, (hpGhost / computedStats.maxHp) * 100));
  const manaPct = Math.max(0, Math.min(100, (character.mana / computedStats.maxMana) * 100));
  const xpPct = Math.max(0, Math.min(100, (character.xp / xpReq) * 100));

  const potionCount = inventory
    .filter((i) => i.itemId === 'pot_health_minor' || i.itemId === 'pot_elixir_greater')
    .reduce((sum, i) => sum + i.quantity, 0);

  const activeQuestList = Object.values(quests).filter((q) => q.status === 'active');

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3.5 select-none">
      {/* Critical Low-HP Peripheral Screen Vignette */}
      {hpPct < 30 && (
        <div
          className="fixed inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            boxShadow: 'inset 0 0 90px 28px rgba(185, 28, 28, 0.55)',
          }}
        />
      )}

      {/* Top Row: Cluster 1 (Hero Vitality & Level) — Center Boss Bar / Toast — Cluster 2 (Minimap & Utility Buttons) */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left Perimeter Cluster: Character Portrait, HP/Mana Bars with Ghost Drain, XP */}
        <div className="pointer-events-auto bg-[#0d121d]/92 border border-amber-500/40 rounded-lg p-3 shadow-xl w-72 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-stone-900 border border-amber-400/50 flex items-center justify-center shrink-0">
                <ClassEmblemIcon classId={character.classId} className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-amber-200 truncate">
                  {character.customization.name}
                </div>
                <div className="text-[11px] text-stone-300 tabular-nums">
                  Lv.{character.level} {cls.name} · {character.gold} Gold
                </div>
              </div>
            </div>
            {character.skillPoints > 0 && (
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onTogglePanel('skills');
                }}
                className="px-2 py-0.5 rounded bg-amber-500 text-stone-950 font-bold text-[10px] whitespace-nowrap cursor-pointer"
              >
                +{character.skillPoints} SP
              </button>
            )}
          </div>

          {/* Health Bar with Delayed Ghost Drain Bar */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-between text-[10px] font-semibold tracking-wider">
              <span className="text-red-300">HP</span>
              <span className="font-mono tabular-nums text-stone-100">
                {Math.round(character.hp)} / {computedStats.maxHp}
              </span>
            </div>
            <div className="relative h-3 w-full rounded bg-stone-950 border border-stone-800 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-amber-300/60"
                style={{ width: `${ghostPct}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 bg-red-600"
                style={{ width: `${hpPct}%` }}
              />
            </div>
          </div>

          {/* Mana Bar */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-between text-[10px] font-semibold tracking-wider">
              <span className="text-sky-300">MANA</span>
              <span className="font-mono tabular-nums text-stone-100">
                {Math.round(character.mana)} / {computedStats.maxMana}
              </span>
            </div>
            <div className="relative h-2.5 w-full rounded bg-stone-950 border border-stone-800 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-sky-500"
                style={{ width: `${manaPct}%` }}
              />
            </div>
          </div>

          {/* XP Progress Bar */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-between text-[10px] text-stone-400 tabular-nums">
              <span>XP</span>
              <span>
                {Math.round(character.xp)} / {xpReq}
              </span>
            </div>
            <div className="h-1.5 w-full rounded bg-stone-950 overflow-hidden">
              <div
                className="h-full bg-amber-400"
                style={{ width: `${xpPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Center Top: Active Boss Encounter Health Bar & Live Event Banner */}
        <div className="flex flex-col items-center gap-2 max-w-md w-full">
          {activeBossStatus && (
            <div className="w-full bg-[#160b10]/95 border border-red-500/60 rounded-lg px-4 py-2 shadow-2xl">
              <div className="flex items-center justify-between text-xs font-bold text-amber-200">
                <span>{activeBossStatus.name}</span>
                <span className="font-mono tabular-nums text-red-300">
                  {Math.round(activeBossStatus.hp)} / {activeBossStatus.maxHp}
                </span>
              </div>
              {activeBossStatus.phaseName && (
                <div className="text-[11px] text-amber-400 font-medium">
                  Phase: {activeBossStatus.phaseName}
                </div>
              )}
              <div className="mt-1 h-2.5 w-full rounded bg-stone-950 border border-red-900 overflow-hidden">
                <div
                  className="h-full bg-red-600 transition-all duration-100"
                  style={{
                    width: `${Math.max(0, Math.min(100, (activeBossStatus.hp / activeBossStatus.maxHp) * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}

          {statusBanner && (
            <div className="px-4 py-1.5 rounded-lg bg-[#0d121d]/95 border border-amber-400/50 text-xs font-semibold text-amber-200 shadow-lg text-center">
              {statusBanner}
            </div>
          )}
        </div>

        {/* Top-Right Perimeter Cluster: Region Minimap, Active Quest Tracker & Utility Icon Buttons */}
        <div className="flex flex-col items-end gap-2">
          <div className="pointer-events-auto bg-[#0d121d]/92 border border-amber-500/40 rounded-lg p-2.5 shadow-xl flex flex-col items-end gap-2">
            <div className="flex items-center justify-between w-full gap-3">
              <div>
                <div className="text-xs font-bold text-amber-300">{region.name}</div>
                <div className="text-[10px] text-stone-400 tabular-nums">
                  Region {region.index}/8 · Lv.{region.levelRange[0]}–{region.levelRange[1]}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onToggleMute();
                  }}
                  className="w-7 h-7 rounded bg-stone-900 hover:bg-stone-800 border border-stone-700 flex items-center justify-center text-stone-200 text-xs cursor-pointer"
                >
                  {isMuted ? '🔇' : '🔊'}
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Pause Game"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onPauseGame();
                  }}
                  className="px-2 h-7 rounded bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 text-xs font-semibold cursor-pointer"
                >
                  Pause [P]
                </button>
              </div>
            </div>

            {/* Live Navigable Region Minimap Canvas */}
            <canvas
              ref={minimapCanvasRef}
              width={164}
              height={104}
              className="rounded border border-stone-700 bg-stone-950"
            />

            {/* Compact Active Quest Objective Readout */}
            {activeQuestList.length > 0 && (
              <div className="w-44 text-left border-t border-stone-800 pt-1.5">
                <div className="text-[10px] font-semibold text-amber-300 truncate">
                  { QUESTS[activeQuestList[0].questId]?.title }
                </div>
                {QUESTS[activeQuestList[0].questId]?.objectives.map((obj) => {
                  const cur = activeQuestList[0].objectiveCounts[obj.id] ?? 0;
                  return (
                    <div
                      key={obj.id}
                      className="text-[10px] text-stone-300 flex items-center justify-between gap-1 tabular-nums"
                    >
                      <span className="truncate">{obj.description}</span>
                      <span className="text-amber-300 shrink-0">
                        {cur}/{obj.requiredCount}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Action Bar (Abilities 1-4, Dodge, Potion, Interact) & RPG Drawer Navigation */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left Quick Prompt for Nearby NPC / Resource / Portal */}
        <div className="w-56">
          {nearbyInteractPrompt && (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onInteractNearby();
              }}
              className="pointer-events-auto px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-lg cursor-pointer whitespace-nowrap"
            >
              [E] {nearbyInteractPrompt}
            </button>
          )}
        </div>

        {/* Center Bottom: Class Ability Dock (1-4 + Dodge [Space] + Potion [Q]) */}
        <div className="pointer-events-auto flex items-center gap-2 bg-[#0d121d]/95 border border-amber-500/40 rounded-xl p-2 shadow-2xl">
          {cls.abilities.map((ab, idx) => {
            const cd = abilityCooldowns[idx] ?? 0;
            const onCd = cd > 0.05;
            const enoughMana = character.mana >= ab.manaCost;
            return (
              <button
                key={ab.id}
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onTriggerAbility(idx);
                }}
                className={`relative flex flex-col items-start justify-between w-28 h-14 p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                  onCd || !enoughMana
                    ? 'bg-stone-950/90 border-stone-800 text-stone-500'
                    : 'bg-stone-900/95 hover:bg-stone-800 border-amber-500/40 text-stone-100'
                }`}
              >
                <div className="flex items-center justify-between w-full text-[10px] font-mono tabular-nums">
                  <span className="px-1 rounded bg-stone-800 text-amber-300 font-bold">
                    [{ab.key}]
                  </span>
                  <span className="text-sky-300">{ab.manaCost} MP</span>
                </div>
                <div className="text-[11px] font-semibold truncate w-full">
                  {ab.name}
                </div>
                {onCd && (
                  <div className="absolute inset-0 bg-black/75 rounded-lg flex items-center justify-center font-mono text-xs font-bold text-amber-300 tabular-nums">
                    {Math.ceil(cd)}s
                  </div>
                )}
              </button>
            );
          })}

          {/* Dodge Button [Space] */}
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onTriggerDodge();
            }}
            className="relative flex flex-col items-start justify-between w-22 h-14 p-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-left cursor-pointer"
          >
            <span className="text-[10px] font-mono text-amber-300 font-bold">[Space]</span>
            <span className="text-[11px] font-semibold text-stone-100">Dodge</span>
            {dodgeCooldown > 0.05 && (
              <div className="absolute inset-0 bg-black/75 rounded-lg flex items-center justify-center font-mono text-xs font-bold text-amber-300 tabular-nums">
                {Math.ceil(dodgeCooldown)}s
              </div>
            )}
          </button>

          {/* Healing Potion [Q] */}
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onDrinkPotion();
            }}
            className="flex flex-col items-start justify-between w-22 h-14 p-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-red-500/40 text-left cursor-pointer"
          >
            <div className="flex items-center justify-between w-full text-[10px] font-mono tabular-nums">
              <span className="text-red-300 font-bold">[Q]</span>
              <span className="text-stone-300">x{potionCount}</span>
            </div>
            <span className="text-[11px] font-semibold text-stone-100">Potion</span>
          </button>
        </div>

        {/* Bottom-Right Perimeter Dock: RPG System Modals */}
        <div
          className="pointer-events-auto flex items-center gap-1.5 bg-[#0d121d]/95 border border-amber-500/40 rounded-xl p-1.5 shadow-xl"
          role="toolbar"
          aria-label="RPG Systems"
        >
          {(
            [
              { id: 'inventory', label: 'Bag [I]' },
              { id: 'skills', label: 'Skills [K]' },
              { id: 'quests', label: 'Quests [J]' },
              { id: 'map', label: 'Map [M]' },
              { id: 'crafting', label: 'Craft [C]' },
              { id: 'studio', label: 'Saves & Build [O]' },
            ] as { id: ActivePanel; label: string }[]
          ).map((btn) => {
            const isOpen = activePanel === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onTogglePanel(isOpen ? 'none' : btn.id);
                }}
                className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isOpen
                    ? 'bg-amber-500 text-stone-950'
                    : 'bg-stone-900 hover:bg-stone-800 text-stone-200'
                }`}
              >
                {btn.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
