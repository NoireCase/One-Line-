import { useCallback, useEffect, useRef, useState } from 'react';
import { GAME_MODES, PLAY_MODES } from '../config/gameModes.js';
import {
  createDefaultPortalBestSteps,
  createDefaultPortalProgress,
  normalizePortalBestSteps,
  normalizePortalProgress
} from '../game/portal/portalRules.js';
import { createDefaultStarLineProgress } from '../game/starLine/starLineRules.js';
import {
  loadProgressV2,
  STAR_LINE_PROGRESS_V2_KEY,
  upgradeCatalogBoundary,
} from '../game/starLine/starLineProgressV2.js';
import { STAR_SINGLE_MODE_ID, STAR_DOUBLE_MODE_ID } from '../game/starLine/starLineMetadata.js';
import {
  safeReadFiniteNumber,
  safeReadJsonStorage,
  safeSetStorageItem
} from '../utils/safeStorage.js';

const createDefaultNormalProgress = () => ({ easy: [0], medium: [], hard: [] });
const createDefaultNormalScores = () => ({ easy: [], medium: [], hard: [] });
const createDefaultHiddenProgress = () => ({ hidden: [] });

const normalizeNormalSections = (value, fallback) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  return {
    easy: Array.isArray(value.easy) ? value.easy : fallback.easy,
    medium: Array.isArray(value.medium) ? value.medium : fallback.medium,
    hard: Array.isArray(value.hard) ? value.hard : fallback.hard,
  };
};

const normalizeHiddenProgress = (value, fallback) => (
  value && typeof value === 'object' && !Array.isArray(value) && Array.isArray(value.hidden)
    ? { hidden: value.hidden }
    : fallback
);

const readJson = (key, fallback, normalize = value => value) => {
  try {
    return normalize(safeReadJsonStorage(key, fallback), fallback);
  } catch {
    return fallback;
  }
};

const readNumber = (key, fallback) => {
  const stored = safeReadFiniteNumber(key, fallback);
  return stored >= 0 ? Math.trunc(stored) : fallback;
};

function useGatedState(initializer) {
  const [value, setValueState] = useState(initializer);
  const persistGate = useRef(false);
  const setValue = useCallback((valueOrFn) => {
    persistGate.current = true;
    setValueState(valueOrFn);
  }, []);
  return [value, setValue, persistGate];
}

export default function useProgress() {
  const [progress, setProgress, progressPersistGate] = useGatedState(() => (
    readJson(
      GAME_MODES[PLAY_MODES.classic].progressKey,
      createDefaultNormalProgress(),
      normalizeNormalSections
    )
  ));
  const [highScores, setHighScores, highScoresPersistGate] = useGatedState(() => (
    readJson(
      GAME_MODES[PLAY_MODES.classic].highScoresKey,
      createDefaultNormalScores(),
      normalizeNormalSections
    )
  ));
  const [diagonalProgress, setDiagonalProgress, diagonalProgressPersistGate] = useGatedState(() => (
    readJson(
      GAME_MODES[PLAY_MODES.diagonal].progressKey,
      createDefaultNormalProgress(),
      normalizeNormalSections
    )
  ));
  const [diagonalHighScores, setDiagonalHighScores, diagonalHighScoresPersistGate] = useGatedState(() => (
    readJson(
      GAME_MODES[PLAY_MODES.diagonal].highScoresKey,
      createDefaultNormalScores(),
      normalizeNormalSections
    )
  ));
  const [portalProgress, setPortalProgress, portalProgressPersistGate] = useGatedState(() => (
    readJson(
      GAME_MODES[PLAY_MODES.portalClassic].progressKey,
      createDefaultPortalProgress(),
      value => normalizePortalProgress(value, PLAY_MODES.portalClassic)
    )
  ));
  const [portalBestSteps, setPortalBestSteps, portalBestStepsPersistGate] = useGatedState(() => (
    readJson(
      GAME_MODES[PLAY_MODES.portalClassic].highScoresKey,
      createDefaultPortalBestSteps(),
      value => normalizePortalBestSteps(value, PLAY_MODES.portalClassic)
    )
  ));
  const [hiddenProgress, setHiddenProgress, hiddenProgressPersistGate] = useGatedState(() => (
    readJson(
      GAME_MODES[PLAY_MODES.hidden].progressKey,
      createDefaultHiddenProgress(),
      normalizeHiddenProgress
    )
  ));
  const [starLineProgress, setStoredStarLineProgress] = useState(() => (
    readJson(
      GAME_MODES[PLAY_MODES.starLine].progressKey,
      createDefaultStarLineProgress()
    )
  ));

  // The legacy key remains a starLine-only store. Formal split modes never
  // call this setter, so opening or completing them cannot rewrite v1 data.
  const legacyStarLinePersistGate = useRef(false);
  const setStarLineProgress = useCallback((valueOrFn) => {
    legacyStarLinePersistGate.current = true;
    setStoredStarLineProgress(valueOrFn);
  }, []);

  // V2 progress is the canonical store for starSingle / starDouble. Loading
  // is read-only; a successful post-mount persistence is the first write.
  const [initialProgressV2] = useState(() => {
    const loaded = loadProgressV2();
    // Catalog boundary upgrade: if old final level fully completed and new
    // levels exist in the catalog, advance the unlock cursor. No-op when
    // the current catalog has no new levels (e.g. no star-lv-31/71 yet).
    const upgradedSingle = upgradeCatalogBoundary(
      loaded.progress, STAR_SINGLE_MODE_ID, 'star-lv-20', 'star-lv-31'
    );
    const upgradedDouble = upgradeCatalogBoundary(
      upgradedSingle.progress, STAR_DOUBLE_MODE_ID, 'star-lv-30', 'star-lv-71'
    );
    const anyUpgrade = upgradedSingle.upgraded || upgradedDouble.upgraded;
    return {
      ...loaded,
      progress: anyUpgrade ? upgradedDouble.progress : loaded.progress,
      needsPersist: loaded.needsPersist || anyUpgrade,
    };
  });
  const [starLineProgressV2, _setStarLineProgressV2] = useState(initialProgressV2.progress);
  const v2PersistGate = useRef(initialProgressV2.needsPersist);
  const setStarLineProgressV2 = useCallback((valueOrFn) => {
    v2PersistGate.current = true;
    _setStarLineProgressV2(valueOrFn);
  }, []);
  const [globalScore, setGlobalScore, globalScorePersistGate] = useGatedState(() => readNumber('cg_global_score', 0));

  useEffect(() => {
    if (progressPersistGate.current && safeSetStorageItem(GAME_MODES[PLAY_MODES.classic].progressKey, JSON.stringify(progress))) {
      progressPersistGate.current = false;
    }
    if (highScoresPersistGate.current && safeSetStorageItem(GAME_MODES[PLAY_MODES.classic].highScoresKey, JSON.stringify(highScores))) {
      highScoresPersistGate.current = false;
    }
    if (diagonalProgressPersistGate.current && safeSetStorageItem(GAME_MODES[PLAY_MODES.diagonal].progressKey, JSON.stringify(diagonalProgress))) {
      diagonalProgressPersistGate.current = false;
    }
    if (diagonalHighScoresPersistGate.current && safeSetStorageItem(GAME_MODES[PLAY_MODES.diagonal].highScoresKey, JSON.stringify(diagonalHighScores))) {
      diagonalHighScoresPersistGate.current = false;
    }
    if (hiddenProgressPersistGate.current && safeSetStorageItem(GAME_MODES[PLAY_MODES.hidden].progressKey, JSON.stringify(hiddenProgress))) {
      hiddenProgressPersistGate.current = false;
    }
    if (portalProgressPersistGate.current && safeSetStorageItem(GAME_MODES[PLAY_MODES.portalClassic].progressKey, JSON.stringify(portalProgress))) {
      portalProgressPersistGate.current = false;
    }
    if (portalBestStepsPersistGate.current && safeSetStorageItem(GAME_MODES[PLAY_MODES.portalClassic].highScoresKey, JSON.stringify(portalBestSteps))) {
      portalBestStepsPersistGate.current = false;
    }
    if (legacyStarLinePersistGate.current) {
      if (safeSetStorageItem(GAME_MODES[PLAY_MODES.starLine].progressKey, JSON.stringify(starLineProgress))) {
        legacyStarLinePersistGate.current = false;
      }
    }
    if (v2PersistGate.current) {
      if (safeSetStorageItem(STAR_LINE_PROGRESS_V2_KEY, JSON.stringify(starLineProgressV2))) {
        v2PersistGate.current = false;
      }
    }
    if (globalScorePersistGate.current && safeSetStorageItem('cg_global_score', globalScore.toString())) {
      globalScorePersistGate.current = false;
    }
  }, [
    progress, highScores, diagonalProgress, diagonalHighScores,
    hiddenProgress,
    portalProgress, portalBestSteps,
    starLineProgress,
    starLineProgressV2,
    globalScore
  ]);

  return {
    progress,
    setProgress,
    highScores,
    setHighScores,
    diagonalProgress,
    setDiagonalProgress,
    diagonalHighScores,
    setDiagonalHighScores,
    portalProgress,
    setPortalProgress,
    portalBestSteps,
    setPortalBestSteps,
    hiddenProgress,
    setHiddenProgress,
    starLineProgress,
    setStarLineProgress,
    starLineProgressV2,
    setStarLineProgressV2,
    globalScore,
    setGlobalScore
  };
}
