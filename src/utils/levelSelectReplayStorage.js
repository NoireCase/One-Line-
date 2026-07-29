import {
  safeReadJsonStorage,
  safeRemoveStorageItem,
  safeSetStorageItem,
} from './safeStorage.js';
import { REPLAY_MODE_IDS } from '../config/replayVisualFamily.js';

export const LEVEL_SELECT_REPLAY_STORAGE_KEY = 'cg_level_select_replay_v1';
export const LEVEL_SELECT_REPLAY_STORAGE_VERSION = 1;

const VALID_MODE_IDS = new Set(REPLAY_MODE_IDS);

function normalizeCompletedLevelIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value.filter(levelId => typeof levelId === 'string' && levelId.length > 0),
  )];
}

function normalizePage(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

export function createDefaultLevelSelectReplayProgress() {
  return {
    version: LEVEL_SELECT_REPLAY_STORAGE_VERSION,
    modes: {},
  };
}

export function normalizeLevelSelectReplayProgress(value) {
  const normalized = createDefaultLevelSelectReplayProgress();
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return normalized;
  }

  const rawModes = value.modes;
  if (!rawModes || typeof rawModes !== 'object' || Array.isArray(rawModes)) {
    return normalized;
  }

  for (const [modeId, rawMode] of Object.entries(rawModes)) {
    if (
      !VALID_MODE_IDS.has(modeId)
      || !rawMode
      || typeof rawMode !== 'object'
      || Array.isArray(rawMode)
      || rawMode.replayActive !== true
    ) {
      continue;
    }
    normalized.modes[modeId] = {
      replayActive: true,
      replayCompletedLevelIds: normalizeCompletedLevelIds(
        rawMode.replayCompletedLevelIds,
      ),
      lastReplayPage: normalizePage(rawMode.lastReplayPage),
    };
  }

  return normalized;
}

export function readLevelSelectReplayProgress() {
  return normalizeLevelSelectReplayProgress(
    safeReadJsonStorage(LEVEL_SELECT_REPLAY_STORAGE_KEY, null),
  );
}

function updateLevelSelectReplayProgress(update) {
  const current = readLevelSelectReplayProgress();
  const next = normalizeLevelSelectReplayProgress(update(current));
  safeSetStorageItem(
    LEVEL_SELECT_REPLAY_STORAGE_KEY,
    JSON.stringify(next),
  );
  return next;
}

export function getModeReplayProgress(progress, modeId) {
  return normalizeLevelSelectReplayProgress(progress).modes[modeId] || null;
}

export function activateLevelSelectReplay(modeId) {
  if (!VALID_MODE_IDS.has(modeId)) return readLevelSelectReplayProgress();
  return updateLevelSelectReplayProgress(current => {
    const existing = current.modes[modeId];
    return {
      ...current,
      modes: {
        ...current.modes,
        [modeId]: existing || {
          replayActive: true,
          replayCompletedLevelIds: [],
          lastReplayPage: 0,
        },
      },
    };
  });
}

export function markLevelSelectReplayCompleted(
  modeId,
  completedLevelId,
  orderedLevelIds,
) {
  if (
    !VALID_MODE_IDS.has(modeId)
    || typeof completedLevelId !== 'string'
    || !completedLevelId
  ) {
    return readLevelSelectReplayProgress();
  }

  const canonicalLevelIds = Array.isArray(orderedLevelIds)
    ? orderedLevelIds.filter(levelId => typeof levelId === 'string' && levelId)
    : [];
  if (
    canonicalLevelIds.length > 0
    && !canonicalLevelIds.includes(completedLevelId)
  ) {
    return readLevelSelectReplayProgress();
  }
  return updateLevelSelectReplayProgress(current => {
    const existing = current.modes[modeId];
    if (!existing?.replayActive) return current;

    const validLevelIds = new Set(canonicalLevelIds);
    const completed = new Set(
      existing.replayCompletedLevelIds.filter(levelId => (
        validLevelIds.size === 0 || validLevelIds.has(levelId)
      )),
    );
    completed.add(completedLevelId);
    const nextRecommendedIndex = canonicalLevelIds.findIndex(
      levelId => !completed.has(levelId),
    );
    const lastReplayPage = nextRecommendedIndex >= 0
      ? Math.floor(nextRecommendedIndex / 10)
      : Math.max(0, Math.ceil(canonicalLevelIds.length / 10) - 1);

    return {
      ...current,
      modes: {
        ...current.modes,
        [modeId]: {
          replayActive: true,
          replayCompletedLevelIds: [...completed],
          lastReplayPage,
        },
      },
    };
  });
}

export function setLevelSelectReplayPage(modeId, pageIndex) {
  if (!VALID_MODE_IDS.has(modeId)) return readLevelSelectReplayProgress();
  return updateLevelSelectReplayProgress(current => {
    const existing = current.modes[modeId];
    if (!existing?.replayActive) return current;
    return {
      ...current,
      modes: {
        ...current.modes,
        [modeId]: {
          ...existing,
          lastReplayPage: normalizePage(pageIndex),
        },
      },
    };
  });
}

export function clearLevelSelectReplayProgress() {
  return safeRemoveStorageItem(LEVEL_SELECT_REPLAY_STORAGE_KEY);
}
