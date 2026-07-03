import { useEffect, useState } from 'react';
import { GAME_MODES, PLAY_MODES } from '../config/gameModes.js';
import {
  createDefaultPortalBestSteps,
  createDefaultPortalProgress,
  normalizePortalBestSteps,
  normalizePortalProgress
} from '../game/portal/portalRules.js';

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
  const [globalScore, setGlobalScore] = useState(() => readNumber('cg_global_score', 0));

  useEffect(() => {
    localStorage.setItem(GAME_MODES[PLAY_MODES.classic].progressKey, JSON.stringify(progress));
    localStorage.setItem(GAME_MODES[PLAY_MODES.classic].highScoresKey, JSON.stringify(highScores));
    localStorage.setItem(GAME_MODES[PLAY_MODES.diagonal].progressKey, JSON.stringify(diagonalProgress));
    localStorage.setItem(GAME_MODES[PLAY_MODES.diagonal].highScoresKey, JSON.stringify(diagonalHighScores));
    localStorage.setItem(GAME_MODES[PLAY_MODES.hidden].progressKey, JSON.stringify(hiddenProgress));
    localStorage.setItem(GAME_MODES[PLAY_MODES.portalClassic].progressKey, JSON.stringify(portalProgress));
    localStorage.setItem(GAME_MODES[PLAY_MODES.portalClassic].highScoresKey, JSON.stringify(portalBestSteps));
    localStorage.setItem('cg_global_score', globalScore.toString());
  }, [
    progress, highScores, diagonalProgress, diagonalHighScores,
    hiddenProgress,
    portalProgress, portalBestSteps,
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
    globalScore,
    setGlobalScore
  };
}
