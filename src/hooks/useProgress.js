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
} from '../game/starLine/starLineProgressV2.js';
import { safeSetStorageItem } from '../utils/safeStorage.js';

const readJson = (key, fallback, normalize = value => value) => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? normalize(JSON.parse(stored)) : fallback;
  } catch {
    return fallback;
  }
};

const readNumber = (key, fallback) => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? parseInt(stored) : fallback;
  } catch {
    return fallback;
  }
};

export default function useProgress() {
  const [progress, setProgress] = useState(() => (
    readJson(GAME_MODES[PLAY_MODES.classic].progressKey, { easy: [0], medium: [], hard: [] })
  ));
  const [highScores, setHighScores] = useState(() => (
    readJson(GAME_MODES[PLAY_MODES.classic].highScoresKey, { easy: [], medium: [], hard: [] })
  ));
  const [diagonalProgress, setDiagonalProgress] = useState(() => (
    readJson(GAME_MODES[PLAY_MODES.diagonal].progressKey, { easy: [0], medium: [], hard: [] })
  ));
  const [diagonalHighScores, setDiagonalHighScores] = useState(() => (
    readJson(GAME_MODES[PLAY_MODES.diagonal].highScoresKey, { easy: [], medium: [], hard: [] })
  ));
  const [portalProgress, setPortalProgress] = useState(() => (
    readJson(
      GAME_MODES[PLAY_MODES.portalClassic].progressKey,
      createDefaultPortalProgress(),
      value => normalizePortalProgress(value, PLAY_MODES.portalClassic)
    )
  ));
  const [portalBestSteps, setPortalBestSteps] = useState(() => (
    readJson(
      GAME_MODES[PLAY_MODES.portalClassic].highScoresKey,
      createDefaultPortalBestSteps(),
      value => normalizePortalBestSteps(value, PLAY_MODES.portalClassic)
    )
  ));
  const [hiddenProgress, setHiddenProgress] = useState(() => (
    readJson(GAME_MODES[PLAY_MODES.hidden].progressKey, { hidden: [] })
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
  const [initialProgressV2] = useState(() => loadProgressV2());
  const [starLineProgressV2, _setStarLineProgressV2] = useState(initialProgressV2.progress);
  const v2PersistGate = useRef(initialProgressV2.needsPersist);
  const setStarLineProgressV2 = useCallback((valueOrFn) => {
    v2PersistGate.current = true;
    _setStarLineProgressV2(valueOrFn);
  }, []);
  const [globalScore, setGlobalScore] = useState(() => readNumber('cg_global_score', 0));

  useEffect(() => {
    safeSetStorageItem(GAME_MODES[PLAY_MODES.classic].progressKey, JSON.stringify(progress));
    safeSetStorageItem(GAME_MODES[PLAY_MODES.classic].highScoresKey, JSON.stringify(highScores));
    safeSetStorageItem(GAME_MODES[PLAY_MODES.diagonal].progressKey, JSON.stringify(diagonalProgress));
    safeSetStorageItem(GAME_MODES[PLAY_MODES.diagonal].highScoresKey, JSON.stringify(diagonalHighScores));
    safeSetStorageItem(GAME_MODES[PLAY_MODES.hidden].progressKey, JSON.stringify(hiddenProgress));
    safeSetStorageItem(GAME_MODES[PLAY_MODES.portalClassic].progressKey, JSON.stringify(portalProgress));
    safeSetStorageItem(GAME_MODES[PLAY_MODES.portalClassic].highScoresKey, JSON.stringify(portalBestSteps));
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
    safeSetStorageItem('cg_global_score', globalScore.toString());
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
