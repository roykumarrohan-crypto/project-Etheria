import React from 'react';
import { QUESTS } from '../data/questsAndDialogue';
import { ITEMS } from '../data/itemsAndCrafting';
import {
  FactionId,
  NpcDefinition,
  QuestProgress,
} from '../types/game';
import { ItemSvgIcon } from './SvgIcons';

interface DialogueModalProps {
  npc: NpcDefinition;
  quests: Record<string, QuestProgress>;
  narrativeChoices: Record<string, string>;
  gold: number;
  onAcceptQuest: (questId: string) => void;
  onChooseBranch: (
    npcId: string,
    choiceId: string,
    faction: FactionId,
    repDelta: number,
    outcomeText: string,
    rewardGold?: number,
    rewardItemId?: string
  ) => void;
  onBuyMerchantItem: (itemId: string) => void;
  onClose: () => void;
}

const FACTION_LABELS: Record<FactionId, { name: string; color: string }> = {
  silver_dawn: { name: 'Order of the Silver Dawn', color: 'text-amber-300' },
  shadow_pact: { name: 'The Shadow Pact', color: 'text-purple-300' },
  emerald_circle: { name: 'The Emerald Circle', color: 'text-emerald-300' },
};

export const DialogueModal: React.FC<DialogueModalProps> = ({
  npc,
  quests,
  narrativeChoices,
  gold,
  onAcceptQuest,
  onChooseBranch,
  onBuyMerchantItem,
  onClose,
}) => {
  const chosenBranchId = narrativeChoices[npc.id];
  const chosenBranch = npc.branchingChoices?.find((c) => c.id === chosenBranchId);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/70 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Dialogue with ${npc.name}`}
    >
      <div className="w-full max-w-2xl bg-[#0e1420] border border-amber-500/40 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[86vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#141c2c] border-b border-stone-800">
          <div>
            <h2 className="text-lg font-bold text-amber-300">{npc.name}</h2>
            <p className="text-xs text-stone-400">{npc.role}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-xs font-medium text-stone-200 cursor-pointer"
          >
            Close [Esc]
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* NPC Greeting Prose */}
          <div className="bg-stone-950/90 border border-stone-800 rounded-lg p-4">
            <p className="text-sm text-stone-200 leading-relaxed">
              “{npc.dialogueGreeting}”
            </p>
          </div>

          {/* Quests Offered by this NPC */}
          {npc.questIds.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold text-amber-300">
                Available Chronicles & Quests
              </h3>
              {npc.questIds.map((qid) => {
                const qDef = QUESTS[qid];
                if (!qDef) return null;
                const progress = quests[qid];
                return (
                  <div
                    key={qid}
                    className="bg-stone-900/90 border border-stone-800 rounded-lg p-3.5 flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-stone-100">
                        {qDef.title}{' '}
                        <span className="text-xs font-normal text-stone-400">
                          · Recommended Lv.{qDef.level}
                        </span>
                      </div>
                      <p className="text-xs text-stone-300">{qDef.description}</p>
                      <div className="text-xs text-amber-300/90 tabular-nums">
                        Rewards: {qDef.xpReward} XP · {qDef.goldReward} Gold
                        {qDef.itemRewardId && ITEMS[qDef.itemRewardId]
                          ? ` · ${ITEMS[qDef.itemRewardId].name}`
                          : ''}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {!progress ? (
                        <button
                          type="button"
                          onClick={() => onAcceptQuest(qid)}
                          className="px-3.5 py-2 rounded bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs whitespace-nowrap cursor-pointer"
                        >
                          Accept Quest
                        </button>
                      ) : (
                        <span className="text-xs font-medium text-emerald-400 whitespace-nowrap">
                          {progress.status === 'completed' ? 'Completed' : 'In Progress'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Dynamic Narrative Branching Choices */}
          {npc.branchingChoices && npc.branchingChoices.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold text-amber-300">
                Branching Fate Decision (Permanent World Alignment)
              </h3>
              {chosenBranch ? (
                <div className="bg-amber-950/30 border border-amber-500/40 rounded-lg p-4 space-y-1.5">
                  <div className="text-xs font-semibold text-amber-300">
                    Chosen Path: {chosenBranch.prompt}
                  </div>
                  <p className="text-xs text-stone-200 leading-relaxed">
                    {chosenBranch.outcomeText}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {npc.branchingChoices.map((choice) => {
                    const fac = FACTION_LABELS[choice.faction];
                    return (
                      <button
                        key={choice.id}
                        type="button"
                        onClick={() =>
                          onChooseBranch(
                            npc.id,
                            choice.id,
                            choice.faction,
                            choice.reputationDelta,
                            choice.outcomeText,
                            choice.rewardGold,
                            choice.rewardItemId
                          )
                        }
                        className="w-full text-left bg-stone-900 hover:bg-stone-800/90 border border-stone-700 hover:border-amber-400/70 rounded-lg p-3.5 transition-colors cursor-pointer"
                      >
                        <div className="text-xs font-semibold text-stone-100">
                          {choice.prompt}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-stone-400 tabular-nums">
                          <span className={fac.color}>{fac.name}</span>
                          <span>·</span>
                          <span>+{choice.reputationDelta} Reputation</span>
                          {choice.rewardGold && (
                            <>
                              <span>·</span>
                              <span className="text-amber-300">+{choice.rewardGold} Gold</span>
                            </>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Merchant Shop Inventory */}
          {npc.isMerchant && npc.merchantItems && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-amber-300">
                  Merchant Wares
                </h3>
                <span className="text-xs text-amber-300 font-mono tabular-nums">
                  Your Purse: {gold} Gold
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {npc.merchantItems.map((itemId) => {
                  const item = ITEMS[itemId];
                  if (!item) return null;
                  const canAfford = gold >= item.value;
                  return (
                    <div
                      key={itemId}
                      className="flex items-center justify-between gap-3 bg-stone-900/90 border border-stone-800 rounded-lg p-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ItemSvgIcon iconType={item.iconType} className="w-6 h-6 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-stone-100 truncate">
                            {item.name}
                          </div>
                          <div className="text-[11px] text-stone-400 truncate">
                            {item.description}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => onBuyMerchantItem(itemId)}
                        className={`px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap shrink-0 tabular-nums cursor-pointer ${
                          canAfford
                            ? 'bg-amber-500 hover:bg-amber-400 text-stone-950'
                            : 'bg-stone-800 text-stone-500 cursor-not-allowed'
                        }`}
                      >
                        Buy · {item.value}g
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
