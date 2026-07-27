import { safeReadJsonStorage, safeSetStorageItem } from './safeStorage.js';

export const LEVEL_SELECT_CEREMONY_STORAGE_KEY = 'cg_level_select_completion_ceremony_v1';

const VALID_MODE_IDS = new Set([
  'classic',
  'hidden',
  'diagonal',
  'portalClassic',
  'starSingle',
  'starDouble',
]);

export function readPlayedLevelSelectCeremonies() {
  const raw = safeReadJsonStorage(LEVEL_SELECT_CEREMONY_STORAGE_KEY, []);
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter(modeId => VALID_MODE_IDS.has(modeId)));
}

export function hasPlayedLevelSelectCeremony(modeId) {
  return readPlayedLevelSelectCeremonies().has(modeId);
}

export function markLevelSelectCeremonyPlayed(modeId) {
  if (!VALID_MODE_IDS.has(modeId)) return false;
  const played = readPlayedLevelSelectCeremonies();
  played.add(modeId);
  return safeSetStorageItem(
    LEVEL_SELECT_CEREMONY_STORAGE_KEY,
    JSON.stringify(Array.from(played).sort()),
  );
}
