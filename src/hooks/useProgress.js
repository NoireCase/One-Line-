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
  const [starLineProgress, setStarLineProgress] = useState(() => (
    readJson(
      GAME_MODES[PLAY_MODES.starLine].progressKey,
      createDefaultStarLineProgress()
    )
  ));

  // v2 progress (Package A: 单双星独立化基础层)
  const v2SaveEnabledRef = useRef(false);
  const [starLineProgressV2, _setStarLineProgressV2] = useState(() => {
    const { progress, shouldPersist } = loadProgressV2();
    v2SaveEnabledRef.current = shouldPersist;
    return progress;
  });
  const setStarLineProgressV2 = useCallback((valueOrFn) => {
    v2SaveEnabledRef.current = true;
    _setStarLineProgressV2(valueOrFn);
  }, []);
  const [globalScore, setGlobalScore] = useState(() => readNumber('cg_global_score', 0));

  useEffect(() => {
    localStorage.setItem(GAME_MODES[PLAY_MODES.classic].progressKey, JSON.stringify(progress));
    localStorage.setItem(GAME_MODES[PLAY_MODES.classic].highScoresKey, JSON.stringify(highScores));
    localStorage.setItem(GAME_MODES[PLAY_MODES.diagonal].progressKey, JSON.stringify(diagonalProgress));
    localStorage.setItem(GAME_MODES[PLAY_MODES.diagonal].highScoresKey, JSON.stringify(diagonalHighScores));
    localStorage.setItem(GAME_MODES[PLAY_MODES.hidden].progressKey, JSON.stringify(hiddenProgress));
    localStorage.setItem(GAME_MODES[PLAY_MODES.portalClassic].progressKey, JSON.stringify(portalProgress));
    localStorage.setItem(GAME_MODES[PLAY_MODES.portalClassic].highScoresKey, JSON.stringify(portalBestSteps));
    localStorage.setItem(GAME_MODES[PLAY_MODES.starLine].progressKey, JSON.stringify(starLineProgress));
    if (v2SaveEnabledRef.current) {
      localStorage.setItem(STAR_LINE_PROGRESS_V2_KEY, JSON.stringify(starLineProgressV2));
    }
    localStorage.setItem('cg_global_score', globalScore.toString());
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
