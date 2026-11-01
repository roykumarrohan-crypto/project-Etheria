import React, { useState } from 'react';
import { PLAYABLE_CLASSES } from '../data/classes';
import { REGIONS } from '../data/regions';
import {
  CharacterClassId,
  CharacterCustomization,
  SaveSlotData,
} from '../types/game';
import { ClassEmblemIcon, ProjectEtheriaTitleLockup } from './SvgIcons';

interface TitleScreenProps {
  selectedClass: CharacterClassId;
  onSelectClass: (c: CharacterClassId) => void;
  customization: CharacterCustomization;
  onChangeCustomization: (c: CharacterCustomization) => void;
  saveSlots: (SaveSlotData | null)[];
  activeSlotId: number;
  onSelectSlot: (slotId: number) => void;
  onStartNewOrContinue: (forceNew?: boolean) => void;
  onOpenStudioModal: () => void;
}

const HAIR_COLORS = [
  { label: 'Sunfire Gold', hex: '#f59e0b' },
  { label: 'Raven Obsidian', hex: '#1e293b' },
  { label: 'Astral Silver', hex: '#e2e8f0' },
  { label: 'Crimson Ember', hex: '#dc2626' },
  { label: 'Starweaver Azure', hex: '#38bdf8' },
];

const CLOAK_COLORS = [
  { label: 'Royal Crimson', hex: '#b91c1c' },
  { label: 'Emerald Warden', hex: '#047857' },
  { label: 'Astral Sapphire', hex: '#1d4ed8' },
  { label: 'Shadow Violet', hex: '#6d28d9' },
  { label: 'Templar Gold', hex: '#b45309' },
];

const ORIGINS: CharacterCustomization['origin'][] = [
  'Highland Vanguard',
  'Arcane Scholomance',
  'Verdant Outrider',
  'Twilight Guild',
];

export const TitleScreen: React.FC<TitleScreenProps> = ({
  selectedClass,
  onSelectClass,
  customization,
  onChangeCustomization,
  saveSlots,
  activeSlotId,
  onSelectSlot,
  onStartNewOrContinue,
  onOpenStudioModal,
}) => {
  const [showCreatorDrawer, setShowCreatorDrawer] = useState(false);
  const currentClass = PLAYABLE_CLASSES[selectedClass];
  const activeSave = saveSlots[activeSlotId - 1];

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-6 lg:p-10">
      {/* Asymmetric Left Scrim for 35-40% Calm Negative Space over the Live World Canvas Tour */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, rgba(8,11,18,0.94) 0%, rgba(8,11,18,0.82) 38%, rgba(8,11,18,0.22) 72%, rgba(8,11,18,0.45) 100%)',
        }}
      />

      {/* Top Row: Custom SVG Title Lockup & Right Save Slot / Architecture Trigger */}
      <div className="flex flex-col lg:flex-row items-start justify-between gap-6">
        <div className="pointer-events-auto max-w-xl">
          <ProjectEtheriaTitleLockup />
        </div>

        {/* Save Slots & Godot 4 / Windows Build Inspector Trigger */}
        <div className="pointer-events-auto flex items-center gap-3 bg-[#0d121d]/90 border border-amber-500/30 rounded-lg p-2.5 shadow-xl">
          <div className="flex items-center gap-1.5" role="group" aria-label="Save Slots">
            {[1, 2, 3].map((slotNum) => {
              const slotData = saveSlots[slotNum - 1];
              const isSelected = activeSlotId === slotNum;
              return (
                <button
                  key={slotNum}
                  type="button"
                  onClick={() => onSelectSlot(slotNum)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-stone-950 font-semibold'
                      : 'bg-stone-900/90 text-stone-300 hover:bg-stone-800'
                  }`}
                >
                  Slot {slotNum}{' '}
                  {slotData
                    ? `· Lv.${slotData.character.level} ${PLAYABLE_CLASSES[slotData.character.classId].name}`
                    : '· Empty'}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onOpenStudioModal}
            className="px-3 py-1.5 rounded text-xs font-medium bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-500/30 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Godot 4 & Windows Build
          </button>
        </div>
      </div>

      {/* Main Left-Third Focal Column: Class Selection, Character Customization, and Primary Start CTA */}
      <div className="pointer-events-auto w-full max-w-[540px] bg-[#0d121d]/92 border border-amber-500/35 rounded-xl p-5 shadow-2xl space-y-4">
        {/* Five Playable Classes Selector */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-amber-300/90">
              Choose Class (Level Cap 50)
            </span>
            <span className="text-xs text-stone-400">
              {currentClass.title}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Character Class">
            {(Object.keys(PLAYABLE_CLASSES) as CharacterClassId[]).map((cid) => {
              const cls = PLAYABLE_CLASSES[cid];
              const active = selectedClass === cid;
              return (
                <button
                  key={cid}
                  type="button"
                  onClick={() => onSelectClass(cid)}
                  className={`flex flex-col items-center justify-center py-2 px-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                    active
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-md'
                      : 'bg-stone-900/80 border-stone-800 text-stone-400 hover:text-stone-200 hover:border-stone-700'
                  }`}
                >
                  <ClassEmblemIcon classId={cid} className="w-5 h-5 mb-1" />
                  <span className="whitespace-nowrap">{cls.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Class Strengths, Weaknesses & Core Stats */}
        <div className="bg-stone-950/80 border border-stone-800/90 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-stone-100">
              {currentClass.name} — {currentClass.mechanicSummary}
            </span>
          </div>
          <p className="text-xs text-stone-300 leading-relaxed">
            <strong className="text-emerald-400 font-medium">Strengths:</strong>{' '}
            {currentClass.strengths}
          </p>
          <p className="text-xs text-stone-400 leading-relaxed">
            <strong className="text-amber-400 font-medium">Tactics:</strong>{' '}
            {currentClass.weaknesses}
          </p>
          <div className="pt-1.5 flex items-center gap-4 text-xs text-stone-300 tabular-nums border-t border-stone-800/80">
            <span>HP {currentClass.baseStats.maxHp}</span>
            <span>·</span>
            <span>MP {currentClass.baseStats.maxMana}</span>
            <span>·</span>
            <span>ATK {currentClass.baseStats.attack}</span>
            <span>·</span>
            <span>SPL {currentClass.baseStats.spellPower}</span>
            <span>·</span>
            <span>DEF {currentClass.baseStats.defense}</span>
            <span>·</span>
            <span>CRIT {currentClass.baseStats.critChance}%</span>
          </div>
        </div>

        {/* Toggleable Character Appearance & Name Customization */}
        {showCreatorDrawer && (
          <div className="bg-stone-950/90 border border-stone-800 rounded-lg p-3.5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-xs text-stone-300">
                Character Name
                <input
                  type="text"
                  value={customization.name}
                  maxLength={20}
                  onChange={(e) =>
                    onChangeCustomization({ ...customization, name: e.target.value })
                  }
                  className="mt-1 w-full px-2.5 py-1.5 rounded bg-stone-900 border border-stone-700 text-stone-100 text-xs focus:outline-none focus:border-amber-400"
                />
              </label>
              <label className="block text-xs text-stone-300">
                Origin Background
                <select
                  value={customization.origin}
                  onChange={(e) =>
                    onChangeCustomization({
                      ...customization,
                      origin: e.target.value as CharacterCustomization['origin'],
                    })
                  }
                  className="mt-1 w-full px-2.5 py-1.5 rounded bg-stone-900 border border-stone-700 text-stone-100 text-xs focus:outline-none focus:border-amber-400"
                >
                  {ORIGINS.map((org) => (
                    <option key={org} value={org}>
                      {org}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="block text-xs text-stone-400 mb-1">Hair Tint</span>
                <div className="flex items-center gap-1.5">
                  {HAIR_COLORS.map((hc) => (
                    <button
                      key={hc.hex}
                      type="button"
                      aria-label={`Hair ${hc.label}`}
                      onClick={() =>
                        onChangeCustomization({ ...customization, hairColor: hc.hex })
                      }
                      className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                        customization.hairColor === hc.hex
                          ? 'border-white scale-110'
                          : 'border-stone-700'
                      }`}
                      style={{ backgroundColor: hc.hex }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <span className="block text-xs text-stone-400 mb-1">Cloak Heraldry</span>
                <div className="flex items-center gap-1.5">
                  {CLOAK_COLORS.map((cc) => (
                    <button
                      key={cc.hex}
                      type="button"
                      aria-label={`Cloak ${cc.label}`}
                      onClick={() =>
                        onChangeCustomization({ ...customization, cloakColor: cc.hex })
                      }
                      className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                        customization.cloakColor === cc.hex
                          ? 'border-white scale-110'
                          : 'border-stone-700'
                      }`}
                      style={{ backgroundColor: cc.hex }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Primary Menu Actions (<= 3 actions total per game craft rules) */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onStartNewOrContinue(false);
            }}
            className="flex-1 py-2.5 px-5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-sm tracking-wide shadow-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            {activeSave
              ? `Enter Etheria (${activeSave.character.customization.name} · ${REGIONS[activeSave.character.regionId].name})`
              : `Enter Etheria as ${currentClass.name}`}
          </button>

          <button
            type="button"
            onClick={() => setShowCreatorDrawer((prev) => !prev)}
            className="py-2.5 px-3.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
          >
            {showCreatorDrawer ? 'Hide Customize' : 'Customize Hero'}
          </button>

          {activeSave && (
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onStartNewOrContinue(true);
              }}
              className="py-2.5 px-3.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-amber-300 border border-amber-500/30 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
            >
              New Hero in Slot {activeSlotId}
            </button>
          )}
        </div>
      </div>

      {/* Flat Borderless Single-Line Control Hint at Bottom Safe Margin */}
      <div className="text-xs text-stone-300/90 hud-text-shadow tracking-wide">
        WASD Move · LMB Basic Attack · 1–4 Class Abilities · Space Dodge · Q Potion · E Interact/Gather · M World Map · Esc Pause
      </div>
    </div>
  );
};
