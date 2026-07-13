import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GAME_MODE_LIST,
  PLAY_MODES,
  getLevelsPerDiff,
  getSavedGameKey,
  isHiddenMode
} from '../config/gameModes.js';
import { CONFIG, createClassicLevel } from '../game/classic/createClassicLevel.js';
import { getCuratedLevel, buildCuratedGrid } from '../data/curatedLevels.js';
import { createLevelConfig, resolveRules } from '../game/rules/levelConfig.js';
import {
  createPortalGrid,
  deriveActivePortal,
  getPortalLevel,
  getPortalLevelIndexById,
  isPortalMode
} from '../game/portal/portalRules.js';
import { getHiddenLevelCount } from '../data/hiddenLevels.js';
import { resumeAudioContext } from '../config/soundEngine.js';

const LEVEL_SECTION_ORDER = ['easy', 'medium', 'hard'];

export const getSavedGameResume = () => {
  const savedGames = GAME_MODE_LIST.flatMap(mode => {
    try {
      const savedStr = localStorage.getItem(getSavedGameKey(mode.id));
      if (!savedStr) return [];

      const saved = JSON.parse(savedStr);
      const savedPlayMode = saved.playMode || mode.id;
      const normalizedSavedPlayMode = savedPlayMode === 'portal' && mode.id === PLAY_MODES.portalClassic
        ? mode.id
        : savedPlayMode;
      const savedLevelIdx = (
        isPortalMode(mode.id) && saved.portalLevelId
          ? getPortalLevelIndexById(saved.portalLevelId, mode.id)
          : saved.levelIdx
      );
      const isValidSave = (
        normalizedSavedPlayMode === mode.id
        && LEVEL_SECTION_ORDER.includes(saved.diff)
        && Number.isInteger(savedLevelIdx)
        && savedLevelIdx >= 0
        && savedLevelIdx < getLevelsPerDiff(mode.id)
        && Array.isArray(saved.gridData)
        && saved.gridData.length > 0
        && Array.isArray(saved.path)
        && saved.path.length > 0
        && saved.path.length < saved.gridData.length
        && saved.hp > 0
      );

      return isValidSave ? [{ ...saved, playMode: normalizedSavedPlayMode, levelIdx: savedLevelIdx }] : [];
    } catch {
      return [];
    }
  });

  return savedGames.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))[0] || null;
};

export default function useGameSession({
  requestRuleDiscovery,
  setResumeGame,
  setView,
  setShowExitPrompt
}) {
  const [playMode, setPlayMode] = useState(PLAY_MODES.classic);
  const [diff, setDiff] = useState('easy');
  const [levelIdx, setLevelIdx] = useState(0);
  const [firstLevelHintMode, setFirstLevelHintMode] = useState(null);
  const seenFirstLevelHintRef = useRef({});

  const [gridData, setGridData] = useState([]);
  const [path, setPath] = useState([]);
  const [breakPoints, setBreakPoints] = useState(new Set());
  const [pendingVisualBreak, setPendingVisualBreak] = useState(false);
  const [hp, setHp] = useState(5);
  const [timer, setTimer] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [status, setStatus] = useState('playing');
  const [isDragging, setIsDragging] = useState(false);
  const [wrongFlash, setWrongFlash] = useState(null);

  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [comboStreak, setComboStreak] = useState(0);
  const [maxComboStreak, setMaxComboStreak] = useState(0);
  const [connectionFeedback, setConnectionFeedback] = useState(null);
  const [lastConnectedIndex, setLastConnectedIndex] = useState(null);
  const [isPathCompleting, setIsPathCompleting] = useState(false);
  const [levelReport, setLevelReport] = useState(null);
  const [activePortal, setActivePortal] = useState(null);

  const timerRef = useRef(null);
  const lastProcessedRef = useRef(null);
  const completionTimeoutRef = useRef(null);
  const connectedPulseTimeoutRef = useRef(null);
  const hiddenLossTimeoutRef = useRef(null);
  const hiddenLossPendingRef = useRef(false);

  const maxCombo = maxComboStreak;

  const refreshResumeGame = useCallback(() => {
    setResumeGame(getSavedGameResume());
  }, [setResumeGame]);

  useEffect(() => () => {
    if (completionTimeoutRef.current) clearTimeout(completionTimeoutRef.current);
    if (connectedPulseTimeoutRef.current) clearTimeout(connectedPulseTimeoutRef.current);
    if (hiddenLossTimeoutRef.current) clearTimeout(hiddenLossTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (timerRunning && status === 'playing') {
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerRunning, status]);

  useEffect(() => {
    if (!firstLevelHintMode || status !== 'playing') return;
    const timer = setTimeout(() => setFirstLevelHintMode(null), 6000);
    return () => clearTimeout(timer);
  }, [firstLevelHintMode, status]);

  const resetTransientState = useCallback(() => {
    if (completionTimeoutRef.current) {
      clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }
    if (connectedPulseTimeoutRef.current) clearTimeout(connectedPulseTimeoutRef.current);
    if (hiddenLossTimeoutRef.current) {
      clearTimeout(hiddenLossTimeoutRef.current);
      hiddenLossTimeoutRef.current = null;
    }
    hiddenLossPendingRef.current = false;
    setIsPathCompleting(false);
    setConnectionFeedback(null);
    setLastConnectedIndex(null);
    setBreakPoints(new Set());
    setPendingVisualBreak(false);
    setWrongFlash(null);
    setIsDragging(false);
    setLevelReport(null);
    setActivePortal(null);
    lastProcessedRef.current = null;
  }, []);

  const resetScoreState = useCallback((nextScore = 0, nextCombo = 0) => {
    scoreRef.current = nextScore;
    setScore(nextScore);
    setComboStreak(nextCombo);
    setMaxComboStreak(nextCombo);
  }, []);

  const initGame = useCallback((targetDiff, targetLevel, options = {}) => {
    const { clearSavedGame = true, targetPlayMode = PLAY_MODES.classic } = options;

    resetTransientState();
    if (clearSavedGame) {
      localStorage.removeItem(getSavedGameKey(targetPlayMode));
      refreshResumeGame();
    }

    const levelConfig = createLevelConfig(targetDiff, targetLevel, targetPlayMode);
    const rules = resolveRules(levelConfig);
    const portalLevel = levelConfig.portalLevel;
    const hiddenLevel = levelConfig.hiddenLevel;

    if (hiddenLevel) {
      // Hidden / 极简线索：仅显示关键数字，其余全部隐藏
      const N = hiddenLevel.N;
      const knSet = new Set(hiddenLevel.keyNumbers);
      const grid = [];
      for (let i = 0; i < N * N; i++) {
        const pathPos = hiddenLevel.path.indexOf(i);
        const val = pathPos >= 0 ? pathPos + 1 : 0;
        grid.push({
          val,
          isHidden: !knSet.has(val),
          isRevealed: false,
          isExcluded: false,
          isHinted: false
        });
      }
      setGridData(grid);
      setPath([hiddenLevel.startIndex]);
      setHp(N < 7 ? 10 : 15); // Easy 5×5: 10 HP, Medium 7×7: 15 HP
      setTimer(0);
      setTimerRunning(false);
      setStatus('playing');
      resetScoreState();
      return;
    }

    if (portalLevel) {
      const newGrid = createPortalGrid(portalLevel);
      setGridData(newGrid);
      setPath([portalLevel.path[0]]);
      setHp(CONFIG.easy.hp);
      setTimer(0);
      setTimerRunning(false);
      setStatus('playing');
      resetScoreState();
      return;
    }

    // Check for curated (apply --write) levels before procedural generation
    const curated = getCuratedLevel(targetPlayMode, targetDiff, targetLevel);
    if (curated) {
      const curatedResult = buildCuratedGrid(curated);
      setGridData(curatedResult.grid);
      setPath([curatedResult.startIndex]);
      setHp(curatedResult.config.hp);
      setTimer(0);
      setTimerRunning(false);
      setStatus('playing');
      resetScoreState();
      return;
    }

    const classicLevel = createClassicLevel(targetDiff, targetLevel, rules, targetPlayMode);
    setGridData(classicLevel.grid);
    setPath([classicLevel.startIndex]);
    setHp(classicLevel.config.hp);
    setTimer(0);
    setTimerRunning(false);
    setStatus('playing');
    resetScoreState();
  }, [refreshResumeGame, resetScoreState, resetTransientState]);

  const loadSavedGame = useCallback((saved) => {
    resetTransientState();
    setGridData(saved.gridData);
    setPath(saved.path);
    setHp(saved.hp);
    setTimer(saved.timer);
    setActivePortal(saved.activePortal || deriveActivePortal(saved.gridData || [], saved.path || []));

    const savedScore = saved.score || 0;
    const savedCombo = saved.maxCombo || 0;
    resetScoreState(savedScore, savedCombo > 0 ? savedCombo : 0);

    setTimerRunning(false);
    setStatus('playing');
  }, [resetScoreState, resetTransientState]);

  const initDevCandidateGame = useCallback((candidate) => {
    resetTransientState();

    // Initialize grid from candidate data — reset isRevealed for all cells
    const initGrid = candidate.grid.map(cell => ({
      ...cell,
      isRevealed: false,
      isHinted: false,
      isExcluded: false
    }));

    setGridData(initGrid);
    setPath([candidate.path[0]]);
    setHp(10);
    setTimer(0);
    setTimerRunning(false);
    setStatus('playing');
    resetScoreState(0, 0);
    setActivePortal(null);
  }, [resetScoreState, resetTransientState]);

  const restartDevCandidateGame = useCallback((candidate) => {
    initDevCandidateGame(candidate);
  }, [initDevCandidateGame]);

  const startGame = useCallback((d, lvl, targetPlayMode = playMode) => {
    const discovery = requestRuleDiscovery(targetPlayMode, d, lvl);
    if (discovery) {
      if (discovery.id === 'portalClassic') {
        resumeAudioContext();
        setPlayMode(targetPlayMode);
        setDiff(d);
        setLevelIdx(lvl);
        setView('game');
        initGame(d, lvl, { clearSavedGame: true, targetPlayMode });
      }
      return;
    }

    resumeAudioContext();
    setPlayMode(targetPlayMode);
    setDiff(d);
    setLevelIdx(lvl);

    const shouldShowFirstLevelHint = !isPortalMode(targetPlayMode) && lvl === 0 && !seenFirstLevelHintRef.current[targetPlayMode];
    setFirstLevelHintMode(shouldShowFirstLevelHint ? targetPlayMode : null);
    if (shouldShowFirstLevelHint) seenFirstLevelHintRef.current[targetPlayMode] = true;

    const savedStr = localStorage.getItem(getSavedGameKey(targetPlayMode));
    if (savedStr) {
      try {
        const saved = JSON.parse(savedStr);
        const savedPlayMode = saved.playMode || targetPlayMode;
        const normalizedSavedPlayMode = savedPlayMode === 'portal' && targetPlayMode === PLAY_MODES.portalClassic
          ? targetPlayMode
          : savedPlayMode;
        const targetPortalLevelId = isPortalMode(targetPlayMode) ? getPortalLevel(lvl, targetPlayMode).id : null;
        const savedPortalLevelMatches = !isPortalMode(targetPlayMode) || (saved.portalLevelId ? saved.portalLevelId === targetPortalLevelId : saved.levelIdx === lvl);
        if (saved.diff === d && normalizedSavedPlayMode === targetPlayMode && savedPortalLevelMatches && (isPortalMode(targetPlayMode) || saved.levelIdx === lvl)) {
          loadSavedGame(saved);
          setView('game');
          return;
        }
      } catch {
        // Ignore corrupted saved game data and start a fresh run.
      }
    }

    initGame(d, lvl, { targetPlayMode });
    setView('game');
  }, [initGame, loadSavedGame, playMode, requestRuleDiscovery, setView]);

  const restartCurrentGame = useCallback(() => {
    initGame(diff, levelIdx, { clearSavedGame: true, targetPlayMode: playMode });
  }, [diff, initGame, levelIdx, playMode]);

  const clearSavedGame = useCallback(() => {
    localStorage.removeItem(getSavedGameKey(playMode));
    refreshResumeGame();
  }, [playMode, refreshResumeGame]);

  const markWon = useCallback((options = {}) => {
    const { skipStorageClear = false } = options;
    setIsPathCompleting(false);
    setStatus('won');
    if (!skipStorageClear) {
      localStorage.removeItem(getSavedGameKey(playMode));
      refreshResumeGame();
    }
  }, [playMode, refreshResumeGame]);

  const markLost = useCallback(() => {
    setStatus('lost');
  }, []);

  const handleSaveAndExit = useCallback(() => {
    const saveData = {
      playMode,
      diff,
      levelIdx,
      ...(isPortalMode(playMode) ? { portalLevelId: getPortalLevel(levelIdx, playMode).id } : {}),
      gridData,
      path,
      hp,
      timer,
      score: scoreRef.current,
      maxCombo,
      activePortal,
      savedAt: Date.now()
    };
    localStorage.setItem(getSavedGameKey(playMode), JSON.stringify(saveData));
    setResumeGame({ ...saveData });
    setShowExitPrompt(false);
    setView('levels');
  }, [playMode, diff, levelIdx, gridData, path, hp, timer, scoreRef, maxCombo, activePortal, setResumeGame, setShowExitPrompt, setView]);

  const handleAbandonAndExit = useCallback(() => {
    clearSavedGame();
    setShowExitPrompt(false);
    setView('levels');
  }, [clearSavedGame, setShowExitPrompt, setView]);

  return {
    playMode,
    setPlayMode,
    diff,
    setDiff,
    levelIdx,
    setLevelIdx,
    firstLevelHintMode,
    gridData,
    setGridData,
    path,
    setPath,
    breakPoints,
    setBreakPoints,
    pendingVisualBreak,
    setPendingVisualBreak,
    hp,
    setHp,
    timer,
    setTimer,
    timerRunning,
    setTimerRunning,
    status,
    setStatus,
    isDragging,
    setIsDragging,
    wrongFlash,
    setWrongFlash,
    score,
    setScore,
    scoreRef,
    comboStreak,
    setComboStreak,
    maxComboStreak,
    setMaxComboStreak,
    maxCombo,
    connectionFeedback,
    setConnectionFeedback,
    lastConnectedIndex,
    setLastConnectedIndex,
    isPathCompleting,
    setIsPathCompleting,
    levelReport,
    setLevelReport,
    activePortal,
    setActivePortal,
    lastProcessedRef,
    completionTimeoutRef,
    connectedPulseTimeoutRef,
    hiddenLossTimeoutRef,
    hiddenLossPendingRef,
    initGame,
    startGame,
    restartCurrentGame,
    clearSavedGame,
    initDevCandidateGame,
    restartDevCandidateGame,
    markWon,
    markLost,
    handleSaveAndExit,
    handleAbandonAndExit
  };
}
