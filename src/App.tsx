/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DialogueModal } from './components/DialogueModal';
import { GameCanvas, GameCanvasCommandRef } from './components/GameCanvas';
import { HudOverlay } from './components/HudOverlay';
import { RpgPanels } from './components/RpgPanels';
import { TitleScreen } from './components/TitleScreen';
import { PLAYABLE_CLASSES } from './data/classes';
import { CRAFTING_RECIPES, ITEMS } from './data/itemsAndCrafting';
import { QUESTS } from './data/questsAndDialogue';
import { REGIONS } from './data/regions';
import { audio } from './systems/audio';
import {
  addItemToInventory,
  applyXpAndLevelUp,
  canCraftRecipe,
  computeCharacterStats,
  createInitialSaveState,
  removeItemFromInventory,
} from './systems/rules';
import {
  ensureDefaultDemoSlot,
  listAllSaveSlots,
  loadFromLocalSlot,
  saveToLocalSlot,
} from './systems/saveSystem';
import {
  ActivePanel,
  CharacterClassId,
  CharacterCustomization,
  EquipmentSlot,
  FactionId,
  GameState,
  RegionId,
  SaveSlotData,
} from './types/game';

export default function App() {
  const initialSave = useMemo(() => ensureDefaultDemoSlot(), []);
  const [saveSlots, setSaveSlots] = useState<(SaveSlotData | null)[]>(() =>
    listAllSaveSlots()
  );
  const [activeSlotId, setActiveSlotId] = useState<number>(1);
  const [saveData, setSaveData] = useState<SaveSlotData>(initialSave);

  const [selectedClass, setSelectedClass] = useState<CharacterClassId>(
    initialSave.character.classId
  );
  const [customization, setCustomization] = useState<CharacterCustomization>(
    initialSave.character.customization
  );

  // Support ?autostart=1 to boot directly into 'playing'
  const [gameState, setGameState] = useState<GameState>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('autostart') === '1' ? 'playing' : 'title';
  });

  const [activePanel, setActivePanel] = useState<ActivePanel>('none');
  const [activeNpcId, setActiveNpcId] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [nearbyInteractPrompt, setNearbyInteractPrompt] = useState<string | null>(
    null
  );
  const [activeBossStatus, setActiveBossStatus] = useState<{
    name: string;
    hp: number;
    maxHp: number;
    phaseName?: string;
  } | null>(null);
  const [abilityCooldowns, setAbilityCooldowns] = useState<number[]>([0, 0, 0, 0]);
  const [dodgeCooldown, setDodgeCooldown] = useState<number>(0);
  const [hpGhost, setHpGhost] = useState<number>(initialSave.character.hp);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [endgameModal, setEndgameModal] = useState<{
    mode: 'victory' | 'defeat';
    title: string;
    subtitle: string;
    metrics: { label: string; value: string }[];
  } | null>(null);

  const minimapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const commandRef = useRef<GameCanvasCommandRef | null>(null);

  const computedStats = useMemo(
    () =>
      computeCharacterStats(
        saveData.character.classId,
        saveData.character.level,
        saveData.equipment,
        saveData.character.skillRanks
      ),
    [
      saveData.character.classId,
      saveData.character.level,
      saveData.equipment,
      saveData.character.skillRanks,
    ]
  );

  // Sync document.body.dataset.state with gameState
  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  const showToast = useCallback((msg: string) => {
    setStatusBanner(msg);
  }, []);

  useEffect(() => {
    if (!statusBanner) return;
    const t = setTimeout(() => setStatusBanner(null), 3600);
    return () => clearTimeout(t);
  }, [statusBanner]);

  const handleStartGame = useCallback(
    (forceNew = false) => {
      const existingSlot = loadFromLocalSlot(activeSlotId);
      let nextSave: SaveSlotData;
      if (existingSlot && !forceNew) {
        nextSave = existingSlot;
      } else {
        nextSave = createInitialSaveState(activeSlotId, selectedClass, customization);
        saveToLocalSlot(activeSlotId, nextSave);
        setSaveSlots(listAllSaveSlots());
      }
      setSaveData(nextSave);
      setHpGhost(nextSave.character.hp);
      setEndgameModal(null);
      setActivePanel('none');
      setActiveNpcId(null);
      document.body.dataset.state = 'playing';
      setGameState('playing');
      audio.startAmbientMusic();
      showToast(`Entered ${REGIONS[nextSave.character.regionId].name}`);
    },
    [activeSlotId, selectedClass, customization, showToast]
  );

  // Title Screen Enter/Space & Gameplay Keyboard Shortcuts (I, K, J, M, C, O, Q, P, Escape)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      if (gameState === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleStartGame(false);
        }
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        if (activeNpcId) {
          setActiveNpcId(null);
          return;
        }
        if (activePanel !== 'none') {
          setActivePanel('none');
          return;
        }
        if (gameState === 'playing') {
          setGameState('paused');
        } else if (gameState === 'paused') {
          setGameState('playing');
        }
        return;
      }

      if (gameState !== 'playing') return;

      if (e.code === 'KeyI') {
        setActivePanel((p) => (p === 'inventory' ? 'none' : 'inventory'));
      } else if (e.code === 'KeyK') {
        setActivePanel((p) => (p === 'skills' ? 'none' : 'skills'));
      } else if (e.code === 'KeyJ') {
        setActivePanel((p) => (p === 'quests' ? 'none' : 'quests'));
      } else if (e.code === 'KeyM') {
        setActivePanel((p) => (p === 'map' ? 'none' : 'map'));
      } else if (e.code === 'KeyC') {
        setActivePanel((p) => (p === 'crafting' ? 'none' : 'crafting'));
      } else if (e.code === 'KeyO') {
        setActivePanel((p) => (p === 'studio' ? 'none' : 'studio'));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState, activePanel, activeNpcId, handleStartGame]);

  const handlePlayerSync = useCallback(
    (hp: number, mana: number, x: number, y: number) => {
      setSaveData((prev) => {
        if (
          Math.abs(prev.character.hp - hp) < 1 &&
          Math.abs(prev.character.mana - mana) < 1 &&
          Math.abs(prev.character.x - x) < 8 &&
          Math.abs(prev.character.y - y) < 8
        ) {
          return prev;
        }
        return {
          ...prev,
          character: {
            ...prev.character,
            hp: Math.round(hp),
            mana: Math.round(mana),
            x: Math.round(x),
            y: Math.round(y),
          },
        };
      });
      setHpGhost((prevGhost) => (hp < prevGhost ? prevGhost * 0.92 + hp * 0.08 : hp));
    },
    []
  );

  const handleDrinkPotion = useCallback(() => {
    setSaveData((prev) => {
      const hasGreater = prev.inventory.some((i) => i.itemId === 'pot_elixir_greater');
      const potId = hasGreater ? 'pot_elixir_greater' : 'pot_health_minor';
      const hasPot = prev.inventory.some((i) => i.itemId === potId);
      if (!hasPot) {
        showToast('No healing potions remaining in bag!');
        return prev;
      }
      const def = ITEMS[potId];
      const nextInv = removeItemFromInventory(prev.inventory, potId, 1);
      const nextHp = Math.min(
        computedStats.maxHp,
        prev.character.hp + (def.healHp ?? 120)
      );
      const nextMana = Math.min(
        computedStats.maxMana,
        prev.character.mana + (def.restoreMana ?? 0)
      );
      audio.playPotion();
      showToast(`Drank ${def.name} (+${def.healHp ?? 120} HP)`);
      return {
        ...prev,
        character: { ...prev.character, hp: nextHp, mana: nextMana },
        inventory: nextInv,
      };
    });
  }, [computedStats.maxHp, computedStats.maxMana, showToast]);

  // Bind Q key for drinking potions
  useEffect(() => {
    const onQ = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (gameState === 'playing' && e.code === 'KeyQ') {
        handleDrinkPotion();
      }
    };
    window.addEventListener('keydown', onQ);
    return () => window.removeEventListener('keydown', onQ);
  }, [gameState, handleDrinkPotion]);

  const handleEnemyDefeated = useCallback(
    (
      templateId: string,
      isBoss: boolean,
      xp: number,
      gold: number,
      lootItemIds: string[]
    ) => {
      setSaveData((prev) => {
        let nextInv = [...prev.inventory];
        for (const itemId of lootItemIds) {
          nextInv = addItemToInventory(nextInv, itemId, 1);
        }

        let totalXp = xp;
        let totalGold = prev.character.gold + gold;
        const nextQuests = { ...prev.quests };

        // Update active quest kill objectives
        for (const qProg of Object.values(nextQuests)) {
          if (qProg.status !== 'active') continue;
          const qDef = QUESTS[qProg.questId];
          if (!qDef || qDef.regionId !== prev.character.regionId) continue;

          let allComplete = true;
          const updatedCounts = { ...qProg.objectiveCounts };
          for (const obj of qDef.objectives) {
            if (obj.type === 'kill' || obj.type === 'boss') {
              updatedCounts[obj.id] = Math.min(
                obj.requiredCount,
                (updatedCounts[obj.id] ?? 0) + 1
              );
            }
            if ((updatedCounts[obj.id] ?? 0) < obj.requiredCount) {
              allComplete = false;
            }
          }

          nextQuests[qProg.questId] = {
            ...qProg,
            status: allComplete ? 'completed' : 'active',
            objectiveCounts: updatedCounts,
          };

          if (allComplete) {
            totalXp += qDef.xpReward;
            totalGold += qDef.goldReward;
            if (qDef.itemRewardId) {
              nextInv = addItemToInventory(nextInv, qDef.itemRewardId, 1);
            }
            if (qDef.nextQuestId && QUESTS[qDef.nextQuestId]) {
              nextQuests[qDef.nextQuestId] = {
                questId: qDef.nextQuestId,
                status: 'active',
                objectiveCounts: {},
              };
            }
            audio.playLevelUpOrQuest();
            showToast(`Quest Completed: ${qDef.title}! (+${qDef.xpReward} XP)`);
          }
        }

        const lvlRes = applyXpAndLevelUp(
          prev.character.level,
          prev.character.xp,
          totalXp,
          prev.character.skillPoints
        );

        const nextStats = computeCharacterStats(
          prev.character.classId,
          lvlRes.level,
          prev.equipment,
          prev.character.skillRanks
        );

        const nextCleared = [...prev.clearedDungeons];
        const currDngId = REGIONS[prev.character.regionId].dungeon.id;
        if (isBoss && !nextCleared.includes(currDngId)) {
          nextCleared.push(currDngId);
        }

        const updated: SaveSlotData = {
          ...prev,
          character: {
            ...prev.character,
            level: lvlRes.level,
            xp: lvlRes.xp,
            skillPoints: lvlRes.skillPoints,
            gold: totalGold,
            hp: lvlRes.leveledUp ? nextStats.maxHp : prev.character.hp,
            mana: lvlRes.leveledUp ? nextStats.maxMana : prev.character.mana,
          },
          inventory: nextInv,
          quests: nextQuests,
          clearedDungeons: nextCleared,
        };

        saveToLocalSlot(activeSlotId, updated);

        if (lvlRes.leveledUp) {
          audio.playLevelUpOrQuest();
          showToast(
            `Level Up! Reached Level ${lvlRes.level} (+2 Skill Points)`
          );
        } else if (lootItemIds.length > 0) {
          const dropNames = lootItemIds
            .map((id) => ITEMS[id]?.name ?? id)
            .join(', ');
          showToast(`Looted: ${dropNames} (+${gold}g)`);
        }

        if (isBoss && templateId === 'boss_void_emperor') {
          setEndgameModal({
            mode: 'victory',
            title: 'Victory: Sovereign of Etheria',
            subtitle:
              'Malakor, Sovereign of the Voidlands has fallen! All eight realms celebrate your triumph.',
            metrics: [
              { label: 'Hero Level', value: `Lv.${lvlRes.level}` },
              {
                label: 'Regions Discovered',
                value: `${updated.discoveredRegions.length}/8`,
              },
              { label: 'Gold Treasury', value: `${totalGold}g` },
            ],
          });
          setGameState('gameover');
        }

        return updated;
      });
    },
    [activeSlotId, showToast]
  );

  const handleResourceGathered = useCallback(
    (
      _nodeId: string,
      profession: 'Mining' | 'Herbalism' | 'Fishing',
      itemId: string,
      xp: number
    ) => {
      setSaveData((prev) => {
        const nextInv = addItemToInventory(prev.inventory, itemId, 1);
        const nextProfs = {
          ...prev.character.professions,
          [profession]: (prev.character.professions[profession] ?? 1) + 1,
        };

        // Check gather quests
        const nextQuests = { ...prev.quests };
        let bonusXp = 0;
        let bonusGold = 0;
        for (const qProg of Object.values(nextQuests)) {
          if (qProg.status !== 'active') continue;
          const qDef = QUESTS[qProg.questId];
          if (!qDef) continue;
          let allDone = true;
          const counts = { ...qProg.objectiveCounts };
          for (const obj of qDef.objectives) {
            if (obj.type === 'gather') {
              counts[obj.id] = Math.min(obj.requiredCount, (counts[obj.id] ?? 0) + 1);
            }
            if ((counts[obj.id] ?? 0) < obj.requiredCount) allDone = false;
          }
          nextQuests[qProg.questId] = {
            ...qProg,
            status: allDone ? 'completed' : 'active',
            objectiveCounts: counts,
          };
          if (allDone) {
            bonusXp += qDef.xpReward;
            bonusGold += qDef.goldReward;
          }
        }

        const lvlRes = applyXpAndLevelUp(
          prev.character.level,
          prev.character.xp,
          xp + bonusXp,
          prev.character.skillPoints
        );

        const updated: SaveSlotData = {
          ...prev,
          character: {
            ...prev.character,
            level: lvlRes.level,
            xp: lvlRes.xp,
            skillPoints: lvlRes.skillPoints,
            gold: prev.character.gold + bonusGold,
            professions: nextProfs,
          },
          inventory: nextInv,
          quests: nextQuests,
        };
        saveToLocalSlot(activeSlotId, updated);
        showToast(
          `Gathered ${ITEMS[itemId]?.name ?? itemId} (${profession} Lv.${nextProfs[profession]})`
        );
        return updated;
      });
    },
    [activeSlotId, showToast]
  );

  const handleHiddenChestClaimed = useCallback(
    (hiddenId: string, itemId: string, gold: number, name: string) => {
      setSaveData((prev) => {
        if (prev.discoveredHiddenLocations.includes(hiddenId)) return prev;
        const nextInv = addItemToInventory(prev.inventory, itemId, 1);
        const updated: SaveSlotData = {
          ...prev,
          character: {
            ...prev.character,
            gold: prev.character.gold + gold,
          },
          inventory: nextInv,
          discoveredHiddenLocations: [...prev.discoveredHiddenLocations, hiddenId],
        };
        saveToLocalSlot(activeSlotId, updated);
        showToast(
          `Discovered ${name}! Claimed ${ITEMS[itemId]?.name ?? itemId} & ${gold} Gold`
        );
        return updated;
      });
    },
    [activeSlotId, showToast]
  );

  const handleFastTravel = useCallback(
    (regionId: RegionId) => {
      setSaveData((prev) => {
        const nextDiscovered = prev.discoveredRegions.includes(regionId)
          ? prev.discoveredRegions
          : [...prev.discoveredRegions, regionId];
        const nextQuests = { ...prev.quests };
        for (const qDef of Object.values(QUESTS)) {
          if (qDef.regionId === regionId && !nextQuests[qDef.id]) {
            nextQuests[qDef.id] = {
              questId: qDef.id,
              status: 'active',
              objectiveCounts: {},
            };
          }
        }
        const updated: SaveSlotData = {
          ...prev,
          character: {
            ...prev.character,
            regionId,
            x: 560,
            y: 660,
          },
          discoveredRegions: nextDiscovered,
          quests: nextQuests,
        };
        saveToLocalSlot(activeSlotId, updated);
        return updated;
      });
      commandRef.current?.warpToRegionCenter(regionId);
      setActivePanel('none');
      showToast(`Traveled to ${REGIONS[regionId].name}`);
    },
    [activeSlotId, showToast]
  );

  const handleEnterDungeon = useCallback(
    (regionId: RegionId) => {
      handleFastTravel(regionId);
      setTimeout(() => {
        commandRef.current?.spawnDungeonBoss(regionId);
        showToast(`Entered Dungeon: ${REGIONS[regionId].dungeon.name}!`);
      }, 60);
    },
    [handleFastTravel, showToast]
  );

  const handleEquipOrUseItem = useCallback(
    (invIdx: number) => {
      setSaveData((prev) => {
        const target = prev.inventory[invIdx];
        if (!target) return prev;
        const def = ITEMS[target.itemId];
        if (!def) return prev;

        if (def.category === 'consumable') {
          const nextInv = [...prev.inventory];
          if (target.quantity > 1) {
            nextInv[invIdx] = { ...target, quantity: target.quantity - 1 };
          } else {
            nextInv.splice(invIdx, 1);
          }
          audio.playPotion();
          showToast(`Used ${def.name}`);
          return {
            ...prev,
            character: {
              ...prev.character,
              hp: Math.min(
                computedStats.maxHp,
                prev.character.hp + (def.healHp ?? 100)
              ),
              mana: Math.min(
                computedStats.maxMana,
                prev.character.mana + (def.restoreMana ?? 50)
              ),
            },
            inventory: nextInv,
          };
        }

        if (
          def.category === 'weapon' ||
          def.category === 'armor' ||
          def.category === 'helmet' ||
          def.category === 'boots' ||
          def.category === 'accessory'
        ) {
          const slot = def.category as EquipmentSlot;
          const prevEquipped = prev.equipment[slot];
          const nextInv = [...prev.inventory];
          nextInv.splice(invIdx, 1);
          if (prevEquipped) {
            nextInv.push(prevEquipped);
          }
          audio.playUiClick();
          showToast(`Equipped ${def.name}`);
          return {
            ...prev,
            equipment: {
              ...prev.equipment,
              [slot]: { itemId: target.itemId, quantity: 1, upgradeLevel: target.upgradeLevel ?? 0 },
            },
            inventory: nextInv,
          };
        }
        return prev;
      });
    },
    [computedStats.maxHp, computedStats.maxMana, showToast]
  );

  const handleUpgradeEquipped = useCallback(
    (slot: EquipmentSlot) => {
      setSaveData((prev) => {
        const eq = prev.equipment[slot];
        if (!eq) return prev;
        const upg = eq.upgradeLevel ?? 0;
        const cost = (upg + 1) * 45;
        if (prev.character.gold < cost || upg >= 10) return prev;
        audio.playLevelUpOrQuest();
        showToast(`Tempered ${ITEMS[eq.itemId]?.name} to +${upg + 1}!`);
        return {
          ...prev,
          character: {
            ...prev.character,
            gold: prev.character.gold - cost,
            professions: {
              ...prev.character.professions,
              Blacksmithing: (prev.character.professions.Blacksmithing ?? 1) + 1,
            },
          },
          equipment: {
            ...prev.equipment,
            [slot]: { ...eq, upgradeLevel: upg + 1 },
          },
        };
      });
    },
    [showToast]
  );

  const handleAllocateSkill = useCallback(
    (nodeId: string) => {
      setSaveData((prev) => {
        if (prev.character.skillPoints <= 0) return prev;
        const curRank = prev.character.skillRanks[nodeId] ?? 0;
        audio.playUiClick();
        return {
          ...prev,
          character: {
            ...prev.character,
            skillPoints: prev.character.skillPoints - 1,
            skillRanks: {
              ...prev.character.skillRanks,
              [nodeId]: curRank + 1,
            },
          },
        };
      });
    },
    []
  );

  const handleCraftRecipe = useCallback(
    (recipeId: string) => {
      setSaveData((prev) => {
        const recipe = CRAFTING_RECIPES.find((r) => r.id === recipeId);
        if (!recipe) return prev;
        const check = canCraftRecipe(
          recipeId,
          prev.inventory,
          prev.character.gold,
          prev.character.professions
        );
        if (!check.allowed) return prev;

        let nextInv = [...prev.inventory];
        for (const ing of recipe.ingredients) {
          nextInv = removeItemFromInventory(nextInv, ing.itemId, ing.count);
        }
        nextInv = addItemToInventory(nextInv, recipe.resultItemId, recipe.resultQty);

        audio.playPickupOrGather();
        showToast(
          `Crafted ${ITEMS[recipe.resultItemId]?.name} x${recipe.resultQty}!`
        );

        return {
          ...prev,
          character: {
            ...prev.character,
            gold: prev.character.gold - recipe.goldCost,
            professions: {
              ...prev.character.professions,
              [recipe.profession]:
                (prev.character.professions[recipe.profession] ?? 1) + 1,
            },
          },
          inventory: nextInv,
        };
      });
    },
    [showToast]
  );

  const activeNpc = useMemo(() => {
    if (!activeNpcId) return null;
    const reg = REGIONS[saveData.character.regionId];
    return reg.npcs.find((n) => n.id === activeNpcId) ?? null;
  }, [activeNpcId, saveData.character.regionId]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0b0e14] select-none">
      {/* 1. Isolated 60fps Non-Pixelated 2D Game Canvas */}
      <GameCanvas
        gameState={gameState}
        isModalOpen={
          activePanel !== 'none' ||
          activeNpcId !== null ||
          gameState === 'paused' ||
          gameState === 'gameover'
        }
        saveData={saveData}
        computedStats={computedStats}
        minimapCanvasRef={minimapCanvasRef}
        commandRef={commandRef}
        onPlayerSync={handlePlayerSync}
        onEnemyDefeated={handleEnemyDefeated}
        onResourceGathered={handleResourceGathered}
        onHiddenChestClaimed={handleHiddenChestClaimed}
        onOpenNpcDialogue={(npcId) => setActiveNpcId(npcId)}
        onRegionPortalCrossed={handleFastTravel}
        onNearbyPromptChange={(p) =>
          setNearbyInteractPrompt((prev) => (prev === p ? prev : p))
        }
        onBossStatusChange={(nextBoss) =>
          setActiveBossStatus((prev) => {
            if (!prev && !nextBoss) return prev;
            if (
              prev &&
              nextBoss &&
              prev.name === nextBoss.name &&
              Math.round(prev.hp) === Math.round(nextBoss.hp) &&
              prev.phaseName === nextBoss.phaseName
            ) {
              return prev;
            }
            return nextBoss;
          })
        }
        onAbilityCooldownsUpdate={(cds, dcd) => {
          const roundedCds = cds.map((c) => (c > 0.05 ? Math.ceil(c) : 0));
          const roundedDcd = dcd > 0.05 ? Math.ceil(dcd) : 0;
          setAbilityCooldowns((prev) =>
            prev.every((v, i) => v === roundedCds[i]) ? prev : roundedCds
          );
          setDodgeCooldown((prev) => (prev === roundedDcd ? prev : roundedDcd));
        }}
        onPlayerDefeated={({ regionName, enemiesSlain }) => {
          setEndgameModal({
            mode: 'defeat',
            title: 'Fallen in Battle',
            subtitle: `Your hero fell in ${regionName}, but the Sanctuary of Greenhaven restores your spirit.`,
            metrics: [
              { label: 'Region Reached', value: regionName },
              { label: 'Enemies Vanquished', value: `${enemiesSlain}` },
              { label: 'Hero Level', value: `Lv.${saveData.character.level}` },
            ],
          });
          setGameState('gameover');
        }}
      />

      {/* 2. Title Screen & Character Creator */}
      {gameState === 'title' && (
        <TitleScreen
          selectedClass={selectedClass}
          onSelectClass={setSelectedClass}
          customization={customization}
          onChangeCustomization={setCustomization}
          saveSlots={saveSlots}
          activeSlotId={activeSlotId}
          onSelectSlot={(slotId) => {
            setActiveSlotId(slotId);
            const loaded = loadFromLocalSlot(slotId);
            if (loaded) {
              setSelectedClass(loaded.character.classId);
              setCustomization(loaded.character.customization);
            }
          }}
          onStartNewOrContinue={handleStartGame}
          onOpenStudioModal={() => setActivePanel('studio')}
        />
      )}

      {/* 3. Active Playing Low-Occlusion HUD */}
      {gameState === 'playing' && (
        <HudOverlay
          saveData={saveData}
          computedStats={computedStats}
          hpGhost={hpGhost}
          abilityCooldowns={abilityCooldowns}
          dodgeCooldown={dodgeCooldown}
          activePanel={activePanel}
          onTogglePanel={(panel) => setActivePanel(panel)}
          onTriggerAbility={(idx) => commandRef.current?.triggerAbility(idx)}
          onTriggerDodge={() => commandRef.current?.triggerDodge()}
          onDrinkPotion={handleDrinkPotion}
          onInteractNearby={() => commandRef.current?.interactNearby()}
          nearbyInteractPrompt={nearbyInteractPrompt}
          activeBossStatus={activeBossStatus}
          isMuted={isMuted}
          onToggleMute={() => setIsMuted(audio.toggleMute())}
          onPauseGame={() => setGameState('paused')}
          statusBanner={statusBanner}
          minimapCanvasRef={minimapCanvasRef}
        />
      )}

      {/* 4. RPG Panels (Inventory, Skills, Quests, Continent Map, Crafting, Save/Godot 4 Studio) */}
      <RpgPanels
        activePanel={activePanel}
        onClose={() => setActivePanel('none')}
        saveData={saveData}
        computedStats={computedStats}
        onEquipOrUseItem={handleEquipOrUseItem}
        onUpgradeEquipped={handleUpgradeEquipped}
        onAllocateSkill={handleAllocateSkill}
        onFastTravel={handleFastTravel}
        onEnterDungeon={handleEnterDungeon}
        onCraftRecipe={handleCraftRecipe}
        saveSlots={saveSlots}
        onSaveToSlot={(slotId) => {
          saveToLocalSlot(slotId, saveData);
          setSaveSlots(listAllSaveSlots());
          showToast(`Saved progress to Slot ${slotId}`);
        }}
        onLoadFromSlot={(slotId) => {
          const loaded = loadFromLocalSlot(slotId);
          if (loaded) {
            setActiveSlotId(slotId);
            setSaveData(loaded);
            commandRef.current?.warpToRegionCenter(loaded.character.regionId);
            setActivePanel('none');
            showToast(`Loaded Save Slot ${slotId}`);
          }
        }}
        onUpdateSettings={(partial) => {
          setSaveData((prev) => {
            const nextSettings = { ...prev.settings, ...partial };
            audio.configure(nextSettings);
            const updated = { ...prev, settings: nextSettings };
            saveToLocalSlot(activeSlotId, updated);
            return updated;
          });
        }}
      />

      {/* 5. NPC Dialogue, Branching Narrative Choice & Merchant Shop Modal */}
      {activeNpc && gameState === 'playing' && (
        <DialogueModal
          npc={activeNpc}
          quests={saveData.quests}
          narrativeChoices={saveData.narrativeChoices}
          gold={saveData.character.gold}
          onAcceptQuest={(questId) => {
            setSaveData((prev) => ({
              ...prev,
              quests: {
                ...prev.quests,
                [questId]: {
                  questId,
                  status: 'active',
                  objectiveCounts: {},
                },
              },
            }));
            audio.playUiClick();
            showToast(`Accepted Quest: ${QUESTS[questId]?.title}`);
          }}
          onChooseBranch={(
            npcId,
            choiceId,
            faction: FactionId,
            repDelta,
            outcomeText,
            rewardGold,
            rewardItemId
          ) => {
            setSaveData((prev) => {
              let nextInv = prev.inventory;
              if (rewardItemId) {
                nextInv = addItemToInventory(nextInv, rewardItemId, 1);
              }
              const updated: SaveSlotData = {
                ...prev,
                character: {
                  ...prev.character,
                  gold: prev.character.gold + (rewardGold ?? 0),
                },
                inventory: nextInv,
                narrativeChoices: {
                  ...prev.narrativeChoices,
                  [npcId]: choiceId,
                },
                factionStanding: {
                  ...prev.factionStanding,
                  [faction]: (prev.factionStanding[faction] ?? 0) + repDelta,
                },
              };
              saveToLocalSlot(activeSlotId, updated);
              return updated;
            });
            audio.playLevelUpOrQuest();
            showToast(outcomeText);
          }}
          onBuyMerchantItem={(itemId) => {
            const def = ITEMS[itemId];
            if (!def || saveData.character.gold < def.value) return;
            setSaveData((prev) => ({
              ...prev,
              character: {
                ...prev.character,
                gold: prev.character.gold - def.value,
              },
              inventory: addItemToInventory(prev.inventory, itemId, 1),
            }));
            audio.playPickupOrGather();
            showToast(`Purchased ${def.name}`);
          }}
          onClose={() => setActiveNpcId(null)}
        />
      )}

      {/* 6. Pause Modal ('paused') */}
      {gameState === 'paused' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 pointer-events-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Game Paused"
        >
          <div className="w-full max-w-md bg-[#0e1420] border border-amber-500/45 rounded-xl p-6 shadow-2xl space-y-5 text-center">
            <h2 className="text-2xl font-bold text-amber-300">Expedition Paused</h2>
            <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums">
              <div className="bg-stone-900/90 border border-stone-800 rounded p-2.5">
                <div className="text-stone-400">LEVEL</div>
                <div className="text-sm font-bold text-stone-100 mt-0.5">
                  Lv.{saveData.character.level}
                </div>
              </div>
              <div className="bg-stone-900/90 border border-stone-800 rounded p-2.5">
                <div className="text-stone-400">REGION</div>
                <div className="text-sm font-bold text-amber-300 mt-0.5 truncate">
                  {REGIONS[saveData.character.regionId].name}
                </div>
              </div>
              <div className="bg-stone-900/90 border border-stone-800 rounded p-2.5">
                <div className="text-stone-400">GOLD</div>
                <div className="text-sm font-bold text-amber-300 mt-0.5">
                  {saveData.character.gold}g
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setGameState('playing')}
                className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm cursor-pointer"
              >
                Resume Expedition [Esc]
              </button>
              <button
                type="button"
                onClick={() => {
                  saveToLocalSlot(activeSlotId, saveData);
                  setSaveSlots(listAllSaveSlots());
                  showToast(`Saved to Slot ${activeSlotId}`);
                  setGameState('playing');
                }}
                className="w-full py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-300 font-semibold text-xs cursor-pointer"
              >
                Save Progress to Slot {activeSlotId}
              </button>
              <button
                type="button"
                onClick={() => {
                  setGameState('playing');
                  setActivePanel('studio');
                }}
                className="w-full py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs cursor-pointer"
              >
                Settings & Godot 4 Windows Build
              </button>
              <button
                type="button"
                onClick={() => {
                  saveToLocalSlot(activeSlotId, saveData);
                  setSaveSlots(listAllSaveSlots());
                  setGameState('title');
                }}
                className="w-full py-2.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 font-semibold text-xs cursor-pointer"
              >
                Return to Title Screen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Victory / Game Over Modal ('gameover') */}
      {gameState === 'gameover' && endgameModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 pointer-events-auto"
          role="dialog"
          aria-modal="true"
          aria-label={endgameModal.title}
        >
          <div className="w-full max-w-md bg-[#0e1420] border border-amber-500/50 rounded-xl p-6 shadow-2xl space-y-5 text-center">
            <h2 className="text-2xl font-bold text-amber-300">
              {endgameModal.title}
            </h2>
            <p className="text-xs text-stone-300 leading-relaxed">
              {endgameModal.subtitle}
            </p>
            <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums">
              {endgameModal.metrics.map((m) => (
                <div
                  key={m.label}
                  className="bg-stone-900/90 border border-stone-800 rounded p-2.5"
                >
                  <div className="text-[10px] text-stone-400 uppercase">{m.label}</div>
                  <div className="text-sm font-bold text-amber-200 mt-0.5">
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                data-start="true"
                onClick={() => {
                  setEndgameModal(null);
                  setGameState('playing');
                  commandRef.current?.warpToRegionCenter(saveData.character.regionId);
                }}
                className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm cursor-pointer"
              >
                {endgameModal.mode === 'victory'
                  ? 'Continue Exploring Etheria'
                  : 'Try Again at Region Sanctuary'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEndgameModal(null);
                  setGameState('title');
                }}
                className="w-full py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-300 text-xs font-semibold cursor-pointer"
              >
                Return to Title Screen
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
