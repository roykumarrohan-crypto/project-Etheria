import { computeSaveChecksum, createInitialSaveState } from './rules';
import { CharacterClassId, CharacterCustomization, SaveSlotData } from '../types/game';

const SAVE_KEY_PREFIX = 'project_etheria_save_slot_';
const BACKUP_KEY_PREFIX = 'project_etheria_save_bak_';

export function saveToLocalSlot(slotId: number, data: SaveSlotData): boolean {
  try {
    const cleanCopy: Omit<SaveSlotData, 'checksum'> = {
      ...data,
      slotId,
      savedAt: new Date().toISOString(),
    };
    const withChecksum: SaveSlotData = {
      ...cleanCopy,
      checksum: computeSaveChecksum(cleanCopy),
    };
    const serialized = JSON.stringify(withChecksum);

    // Copy existing primary slot to backup before overwriting to prevent corruption
    const existing = localStorage.getItem(`${SAVE_KEY_PREFIX}${slotId}`);
    if (existing) {
      localStorage.setItem(`${BACKUP_KEY_PREFIX}${slotId}`, existing);
    }
    localStorage.setItem(`${SAVE_KEY_PREFIX}${slotId}`, serialized);
    return true;
  } catch {
    return false;
  }
}

export function loadFromLocalSlot(slotId: number): SaveSlotData | null {
  const tryParse = (raw: string | null): SaveSlotData | null => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as SaveSlotData;
      if (!parsed || !parsed.character || !parsed.inventory) return null;
      const expected = computeSaveChecksum(parsed);
      if (parsed.checksum && parsed.checksum !== expected) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  };

  const primary = tryParse(localStorage.getItem(`${SAVE_KEY_PREFIX}${slotId}`));
  if (primary) return primary;

  // Fallback to automatic .bak backup if primary is corrupted
  const backup = tryParse(localStorage.getItem(`${BACKUP_KEY_PREFIX}${slotId}`));
  if (backup) {
    localStorage.setItem(`${SAVE_KEY_PREFIX}${slotId}`, JSON.stringify(backup));
    return backup;
  }
  return null;
}

export function listAllSaveSlots(): (SaveSlotData | null)[] {
  return [1, 2, 3].map((slotId) => loadFromLocalSlot(slotId));
}

export function deleteSaveSlot(slotId: number): void {
  try {
    localStorage.removeItem(`${SAVE_KEY_PREFIX}${slotId}`);
    localStorage.removeItem(`${BACKUP_KEY_PREFIX}${slotId}`);
  } catch {
    // ignore
  }
}

export function ensureDefaultDemoSlot(): SaveSlotData {
  const existing = loadFromLocalSlot(1);
  if (existing) return existing;

  const defaultCustom: CharacterCustomization = {
    name: 'Aethelgard',
    hairColor: '#f59e0b',
    skinTone: '#e6bea5',
    cloakColor: '#b91c1c',
    origin: 'Highland Vanguard',
  };
  const initial = createInitialSaveState(1, 'warrior' as CharacterClassId, defaultCustom);
  saveToLocalSlot(1, initial);
  return initial;
}
