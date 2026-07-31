import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Settings } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import GameToast from './components/GameToast.jsx';
import PuzzleBookPage from './components/PuzzleBookPage.jsx';
import GameView from './components/game/GameView.jsx';
import GmPanel from './components/GmPanel.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import RuleCard from './components/RuleCard.jsx';
import {
  HomePathMark,
  OneLinePathIcon,
  StarLineEntryIcon,
  StarLineMark,
} from './components/PuzzleMarks.jsx';
// P4B DEV-only 原型装配层（集中调用点；原型目录为可整体删除的叶子依赖）
import { DigitalLoopPrototypeHost } from './prototypes/digitalLoop/index.jsx';
import {
  ONE_LINE_MODE_LIST,
  STAR_LINE_MODE_LIST,
  PLAY_MODES,
  RUNTIME_BOARDS,
  RUNTIME_SESSIONS,
  getGameModeConfig,
  getLevelsPerDiff,
  getSavedGameKey,
  getFamilyId,
  getModeRuntime
} from './config/gameModes.js';
import { setSfxVolume } from './config/soundEngine.js';
import useRuleDiscovery from './hooks/useRuleDiscovery.js';
import useProgress from './hooks/useProgress.js';
import useInventory from './hooks/useInventory.js';
import useGameSession, { getSavedGameResume } from './hooks/useGameSession.js';
import useItemLogic from './hooks/useItemLogic.js';
import useLevelList from './hooks/useLevelList.js';
import usePathInteraction from './hooks/usePathInteraction.js';
import useGameResultFlow from './hooks/useGameResultFlow.js';
import { CONFIG } from './game/classic/createClassicLevel.js';
import { createLevelConfig } from './game/rules/levelConfig.js';
import { isStarLineMode, getStarLineLevelByMode, getStarLineLevelCount, createDefaultStarLineProgress } from './game/starLine/starLineRules.js';
import { buildStarLineSavePayload, isStarLineBoardActive } from './game/starLine/starLineSessionAdapter.js';
import { getStarLineCompletionTiming } from './game/starLine/starLineFeedbackTiming.js';
import {
  createDefaultProgressV2,
  getStarLineDisplayNumber,
  unlockThroughLevel,
} from './game/starLine/starLineProgressV2.js';
import useStarLineSession from './hooks/useStarLineSession.js';
import useStarLineInteraction from './hooks/useStarLineInteraction.js';
import useStarLineGuide from './hooks/useStarLineGuide.js';
import useStarLineDoubleGuide from './hooks/useStarLineDoubleGuide.js';
import { getNormalLevelLinearIndex } from './utils/levelNavigation.js';
import {
  safeReadFiniteNumber,
  safeRemoveStorageItem,
  safeSetStorageItem
} from './utils/safeStorage.js';
import {
  activateLevelSelectReplay,
  getModeReplayProgress,
  markLevelSelectReplayCompleted,
  readLevelSelectReplayProgress,
  setLevelSelectReplayPage,
} from './utils/levelSelectReplayStorage.js';
import { ONE_LINE_HOME_COPY, STAR_LINE_HOME_COPY } from './config/gameExplanations.js';

// 首页「继续解谜」的上下文描述：纯展示层推导，只读存档已有的
// playMode/diff/levelIdx，不触碰存档结构与恢复规则。
function describeResumeGame(saved) {
  if (!saved) return '';
  const familyId = getFamilyId(saved.playMode);
  const modeConfig = getGameModeConfig(saved.playMode);
  if (!familyId || !modeConfig) return '';

  const family = familyId === 'starLine' ? 'Star Line' : 'One Line';
  const modeName = modeConfig.name;
  const runtime = getModeRuntime(saved.playMode);
  let levelText;
  if (familyId === 'starLine') {
    const level = getStarLineLevelByMode(saved.playMode, saved.levelIdx);
    levelText = `第 ${getStarLineDisplayNumber(saved.playMode, level?.id)} 关`;
  } else if (runtime?.interactions.hidden || runtime?.interactions.portal) {
    levelText = `第 ${saved.levelIdx + 1} 关`;
  } else {
    levelText = `第 ${getNormalLevelLinearIndex(saved.playMode, saved.diff, saved.levelIdx) + 1} 关`;
  }
  return `${family} · ${modeName} · ${levelText}`;
}

function normalizeVolume(value) {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 100;
}

function HomeOneLineEntry({ resumeGame, onOpen }) {
  const [animationKey, setAnimationKey] = useState(0);

  return (
    <article
      className="home-family-card home-family-card-oneline"
      data-testid="home-one-line-card"
      onMouseEnter={() => setAnimationKey(key => key + 1)}
    >
      <div className="home-family-art home-family-art-oneline">
        <HomePathMark key={animationKey} animated={animationKey > 0} />
      </div>
      <div className="home-family-copy">
        <h2 className="home-family-title" data-testid="home-one-line-title">One Line</h2>
        <p className="home-family-subtitle">线序谜阵</p>
        <p className="home-family-description">
          {ONE_LINE_HOME_COPY}
        </p>
      </div>
      <button
        onClick={onOpen}
        className={`${resumeGame ? 'button-secondary' : 'button-primary'} home-family-button`}
        data-testid="home-start-button"
      >
        <OneLinePathIcon size={18} /> 进入 One Line
      </button>
    </article>
  );
}

function HomeStarLineEntry({ onOpen }) {
  const [animationKey, setAnimationKey] = useState(0);

  return (
    <article
      className="home-family-card home-family-card-starline"
      data-testid="home-star-line-card"
      onMouseEnter={() => setAnimationKey(key => key + 1)}
    >
      <div className="home-family-art home-family-art-starline">
        <StarLineMark key={animationKey} animated={animationKey > 0} />
      </div>
      <div className="home-family-copy">
        <h2 className="home-family-title" data-testid="home-star-line-title">Star Line</h2>
        <p className="home-family-subtitle">星线谜阵</p>
        <p className="home-family-description">
          {STAR_LINE_HOME_COPY}
        </p>
      </div>
      <button
        onClick={onOpen}
        className="button-secondary home-family-button home-family-button-starline"
        data-testid="home-star-line-button"
      >
        <StarLineEntryIcon size={18} /> 进入 Star Line
      </button>
    </article>
  );
}

// --- 主应用组件 ---
export default function App() {
  const prefersReducedMotion = useReducedMotion();
  const [view, setView] = useState('home');
  const [levelSelectEntrySource, setLevelSelectEntrySource] = useState(null);
  // 重玩进度与首次通关存档完全隔离；当前正在玩的重玩关只作为瞬时写入上下文。
  const [levelSelectReplayProgress, setLevelSelectReplayProgress] = useState(
    readLevelSelectReplayProgress,
  );
  const [activeReplayLevel, setActiveReplayLevel] = useState(null);
  const [resumeGame, setResumeGame] = useState(() => getSavedGameResume());
  const [pendingStarLineSession, setPendingStarLineSession] = useState(null);

  // 全局经济、进度与全局积分池系统
  const {
    coins,
    setCoins,
    items,
    setItems,
    purchasePrompt,
    hasItem,
    canAfford,
    consumeItem,
    spendCoinsForItem,
    openPurchasePrompt,
    closePurchasePrompt,
    buyPromptItem,
    reviveWithCoins
  } = useInventory();
  const {
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
  } = useProgress();
  const {
    guidance: starLineGuidance,
    actions: starLineGuidanceActions,
  } = useStarLineGuide(starLineProgressV2);
  const {
    guidance: starLineDoubleGuidance,
    actions: starLineDoubleGuidanceActions,
  } = useStarLineDoubleGuide();

  // 设置菜单与音量
  const [showSettings, setShowSettings] = useState(false);
  const [sfxVol, setSfxVol] = useState(() => normalizeVolume(safeReadFiniteNumber('cg_sfx_vol', 100)));
  const sfxVolumePersistGateRef = useRef(false);

  // 全局浮窗提示与二级确认框
  // Toast 以自增事件 ID 为身份：文案只负责显示；相同文案连续触发也是两个
  // 独立事件。自动清理只清除对应 ID，旧事件的定时器/退出不会吞掉新 Toast。
  const [toast, setToast] = useState(null); // { id, message, contextKey } | null
  const toastIdRef = useRef(0);
  const toastTimeoutRef = useRef(null);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [pendingLevelStart, setPendingLevelStart] = useState(null);
  // 一次性解锁反馈：仅在“通关 → 返回关卡页”的本次导航内存活，不落存档。
  const [newlyUnlocked, setNewlyUnlocked] = useState(null);
  // 首次完成整个子玩法的本次导航事件。只负责触发关卡页仪式，不写入业务进度。
  const [levelSelectCompletionEvent, setLevelSelectCompletionEvent] = useState(null);
  const levelSelectCompletionEventIdRef = useRef(0);
  const {
    ruleDiscovery,
    requestRuleDiscovery,
    completeRuleDiscovery,
    resetRuleDiscovery
  } = useRuleDiscovery();
  
  const {
    playMode,
    setPlayMode,
    diff,
    setDiff,
    levelIdx,
    setLevelIdx,
    sessionStartEpoch,
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
    restoredOneLineCompletion,
    clearRestoredOneLineCompletion,
    lastProcessedRef,
    completionTimeoutRef,
    connectedPulseTimeoutRef,
    hiddenLossTimeoutRef,
    hiddenLossPendingRef,
    startGame,
    restartCurrentGame,
    clearSavedGame,
    initDevCandidateGame,
    restartDevCandidateGame,
    markWon,
    markLost,
    handleSaveAndExit,
    handleAbandonAndExit
  } = useGameSession({
    requestRuleDiscovery,
    setResumeGame,
    setView,
    setShowExitPrompt,
    onStarLineSessionRestore: setPendingStarLineSession
  });

  const activeModeRuntime = getModeRuntime(playMode);
  const usesStarLineSession = activeModeRuntime?.session === RUNTIME_SESSIONS.starLine;
  const toastContextKey = `${view}:${playMode}:${diff}:${levelIdx}`;

  const clearToast = useCallback(() => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = null;
    setToast(null);
  }, []);

  const showToast = useCallback((msg) => {
    const id = ++toastIdRef.current;
    setToast({ id, message: msg, contextKey: toastContextKey });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      toastTimeoutRef.current = null;
      setToast(current => (current?.id === id ? null : current));
    }, 1800);
  }, [toastContextKey]);

  // 导航时旧 Toast 由 contextKey 立即隐藏；effect 只清理外部 timer，不同步 setState。
  useEffect(() => () => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = null;
  }, [toastContextKey]);

  const startPuzzleLevel = useCallback((entry) => {
    setLevelSelectEntrySource('game');
    startGame(entry.diff, entry.levelIdx, playMode);
  }, [playMode, startGame]);

  // 开发环境
  const isDev = import.meta.env.DEV;

  // Playtest mode: dev 环境自动启用，或 URL ?playtest=1
  const isPlaytestMode = isDev ||
    (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('playtest'));

  const [showGmPanel, setShowGmPanel] = useState(false);

  // Dev candidate playtest state (DEV only)
  const [activeDevCandidate, setActiveDevCandidate] = useState(null);
  const [devCandidates, setDevCandidates] = useState([]);
  const [devReviewMap, setDevReviewMap] = useState(() => {
    if (!isDev) return {};
    try {
      const raw = localStorage.getItem('cg_dev_candidate_reviews');
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });

  const isDevCandidate = isDev && activeDevCandidate !== null;

  const containerRef = useRef(null);

  const handleSfxVolumeChange = useCallback((value) => {
    sfxVolumePersistGateRef.current = true;
    setSfxVol(normalizeVolume(value));
  }, []);

  // 音量同步；只有玩家实际调整时才持久化，异常初始值不会在 mount 时写回。
  useEffect(() => {
    if (sfxVolumePersistGateRef.current && safeSetStorageItem('cg_sfx_vol', sfxVol.toString())) {
      sfxVolumePersistGateRef.current = false;
    }
    setSfxVolume(sfxVol);
  }, [sfxVol]);

  // 监听全局积分池实现自动印钞票
  useEffect(() => {
    if (globalScore >= 5000) {
      const addedCoins = Math.floor(globalScore / 5000) * 10;
      const remainder = globalScore % 5000;
      setCoins(c => c + addedCoins);
      setGlobalScore(remainder);
      setTimeout(() => {
        showToast(`💰 积分池大突破！已为您自动兑换 ${addedCoins} 枚金币。`);
      }, 600);
    }
  }, [globalScore, showToast, setCoins, setGlobalScore]);

  const handleRuleCardStart = () => {
    const pendingRuleDiscovery = completeRuleDiscovery();
    if (!pendingRuleDiscovery) return;
    const { discovery, d, lvl, targetPlayMode } = pendingRuleDiscovery;
    if (discovery.id === 'portalClassic') return; // game already initialized
    startGame(d, lvl, targetPlayMode);
  };

  const activeNormalProgress = playMode === PLAY_MODES.diagonal ? diagonalProgress : progress;
  const activePortalProgress = portalProgress;
  const activePortalBestSteps = portalBestSteps;

  const setActiveNormalProgress = useCallback((updater) => {
    if (playMode === PLAY_MODES.diagonal) {
      setDiagonalProgress(updater);
    } else {
      setProgress(updater);
    }
  }, [playMode, setDiagonalProgress, setProgress]);

  const setActiveNormalHighScores = useCallback((updater) => {
    if (playMode === PLAY_MODES.diagonal) {
      setDiagonalHighScores(updater);
    } else {
      setHighScores(updater);
    }
  }, [playMode, setDiagonalHighScores, setHighScores]);

  const setActivePortalProgress = useCallback((updater) => {
    setPortalProgress(updater);
  }, [setPortalProgress]);

  const setActivePortalBestSteps = useCallback((updater) => {
    setPortalBestSteps(updater);
  }, [setPortalBestSteps]);

  const { modeProgressSummaries, levels } = useLevelList({
    playMode,
    progressByMode: {
      [PLAY_MODES.classic]: progress,
      [PLAY_MODES.diagonal]: diagonalProgress,
      [PLAY_MODES.hidden]: hiddenProgress,
      [PLAY_MODES.starLine]: starLineProgress,
      [PLAY_MODES.starSingle]: starLineProgressV2,
      [PLAY_MODES.starDouble]: starLineProgressV2,
    },
    highScoresByMode: {
      [PLAY_MODES.classic]: highScores,
      [PLAY_MODES.diagonal]: diagonalHighScores,
      [PLAY_MODES.hidden]: { hidden: [] },
      [PLAY_MODES.starLine]: {}
    },
    portalProgressByMode: {
      [PLAY_MODES.portalClassic]: portalProgress
    },
    portalBestStepsByMode: {
      [PLAY_MODES.portalClassic]: portalBestSteps
    }
  });

  const markWonWithReplay = useCallback((options = {}) => {
    markWon(options);
    if (
      activeReplayLevel?.modeId !== playMode
      || !activeReplayLevel?.levelId
    ) {
      return;
    }
    const next = markLevelSelectReplayCompleted(
      playMode,
      activeReplayLevel.levelId,
      levels.map((level) => level.levelId),
    );
    setLevelSelectReplayProgress(next);
    setActiveReplayLevel(null);
  }, [activeReplayLevel, levels, markWon, playMode]);

  const {
    handleWin,
    handleLose,
    handleDevWin,
    handleDevLose,
    handleRevive,
    nextLevelTarget
  } = useGameResultFlow({
    playMode,
    diff,
    levelIdx,
    path,
    gridData,
    hp,
    timer,
    scoreRef,
    maxComboStreak,
    setHp,
    setStatus,
    setLevelReport,
    portalBestSteps: activePortalBestSteps,
    normalProgress: activeNormalProgress,
    portalProgress: activePortalProgress,
    hiddenProgress,
    starLineProgress,
    starLineProgressV2,
    setPortalProgress: setActivePortalProgress,
    setPortalBestSteps: setActivePortalBestSteps,
    setCoins,
    setGlobalScore,
    setProgress: setActiveNormalProgress,
    setHighScores: setActiveNormalHighScores,
    setHiddenProgress,
    setStarLineProgress,
    setStarLineProgressV2,
    reviveWithCoins,
    showToast,
    markWon: markWonWithReplay,
    markLost
  });

  const settledRestoredCompletionRef = useRef(null);
  useEffect(() => {
    if (!restoredOneLineCompletion || view !== 'game' || status !== 'playing') return;
    if (settledRestoredCompletionRef.current === restoredOneLineCompletion.id) return;

    settledRestoredCompletionRef.current = restoredOneLineCompletion.id;
    clearRestoredOneLineCompletion();
    // 恢复已完成存档只是补结算：完成时的胜利和弦在上一轮会话已播过，这里静音。
    handleWin(restoredOneLineCompletion.path, restoredOneLineCompletion.maxCombo, {
      silent: true,
      suppressModeCompletionEvent: true,
    });
  }, [
    clearRestoredOneLineCompletion,
    handleWin,
    restoredOneLineCompletion,
    status,
    view,
  ]);

  // Dev candidate win/lose wrappers (must be defined before usePathInteraction)
  const handleDevCandidateWin = useCallback((completedPath, finalMaxCombo) => {
    if (!activeDevCandidate) return;
    handleDevWin(completedPath, finalMaxCombo, activeDevCandidate);
  }, [activeDevCandidate, handleDevWin]);

  const handleDevCandidateLose = useCallback(() => {
    handleDevLose();
  }, [handleDevLose]);

  const {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp
  } = usePathInteraction({
    prefersReducedMotion,
    playMode,
    diff,
    levelIdx,
    gridData,
    setGridData,
    path,
    setPath,
    pendingVisualBreak,
    setPendingVisualBreak,
    setHp,
    timerRunning,
    setTimerRunning,
    status,
    isDragging,
    setIsDragging,
    wrongFlash,
    setWrongFlash,
    scoreRef,
    comboStreak,
    setComboStreak,
    maxComboStreak,
    setMaxComboStreak,
    setScore,
    setBreakPoints,
    setConnectionFeedback,
    setLastConnectedIndex,
    isPathCompleting,
    setIsPathCompleting,
    activePortal,
    setActivePortal,
    completionTimeoutRef,
    connectedPulseTimeoutRef,
    hiddenLossTimeoutRef,
    hiddenLossPendingRef,
    lastProcessedRef,
    containerRef,
    markLost: activeDevCandidate ? handleDevCandidateLose : handleLose,
    showToast,
    clearToast,
    onComplete: activeDevCandidate ? handleDevCandidateWin : handleWin
  });

  const { handleUseItem } = useItemLogic({
    diff,
    levelIdx,
    playMode,
    path,
    gridData,
    setGridData,
    hp,
    setHp,
    status,
    hasItem,
    canAfford,
    consumeItem,
    spendCoinsForItem,
    openPurchasePrompt,
    showToast
  });

  const handlePuzzleLevelSelect = useCallback((entry) => {
    const savedLevel = levels.find(level => level.hasSave) || null;
    if (savedLevel && savedLevel.key !== entry.key) {
      setPendingLevelStart(entry);
      return;
    }
    startPuzzleLevel(entry);
  }, [levels, startPuzzleLevel]);

  const handleConfirmStartLevel = useCallback(() => {
    if (!pendingLevelStart) return;
    const entry = pendingLevelStart;
    setPendingLevelStart(null);
    startPuzzleLevel(entry);
  }, [pendingLevelStart, startPuzzleLevel]);

  // ───── Star Line session lifecycle (P3B: useStarLineSession + adapter) ─────
  const starLineLevel = usesStarLineSession ? getStarLineLevelByMode(playMode, levelIdx) : null;
  const starLineTotalLevels = usesStarLineSession ? getStarLineLevelCount(playMode) : 0;
  const starLineCompletionTiming = getStarLineCompletionTiming(starLineLevel);

  const {
    initialGrid: starLineInitialGrid,
    leaveSession: leaveStarLineSession,
    resetKey: starLineResetKey,
    restart: restartStarLineSession,
    restoredGrid: restoredStarLineGrid,
    syncCompletion: syncStarLineCompletion,
  } = useStarLineSession({
    playMode,
    view,
    sessionStartEpoch,
    starLineLevel,
    pendingStarLineSession,
    setStatus,
    setLevelReport,
    onSessionRestore: setPendingStarLineSession,
  });

  const {
    gridData: starLineGridData,
    starLineState,
    cellActions: starLineCellActions,
    undoLast: starLineUndoLast,
    canUndo: starLineCanUndo,
    beginBatch: starLineBeginBatch,
    commitBatch: starLineCommitBatch,
    clearHistory: starLineClearHistory,
  } = useStarLineInteraction(starLineLevel, starLineInitialGrid, starLineResetKey);
  const isStarLineComplete = Boolean(starLineState?.isComplete);
  const isRestoredStarLineComplete = Boolean(restoredStarLineGrid && isStarLineComplete);

  // Detect Star Line win (with animation delay before WinPanel).
  // Timer、scheduled/committed guard 与 session token 全部由 useStarLineSession 持有。
  useEffect(() => {
    if (!isStarLineComplete) {
      syncStarLineCompletion({ isComplete: false });
      return;
    }
    if (status !== 'playing') return;

    const scheduled = syncStarLineCompletion({
      isComplete: true,
      delay: isRestoredStarLineComplete ? 0 : starLineCompletionTiming.winPanelDelay,
      onSettle: handleWin,
    });
    if (scheduled) {
      starLineClearHistory();
    }
  }, [
    handleWin,
    isRestoredStarLineComplete,
    isStarLineComplete,
    starLineClearHistory,
    starLineCompletionTiming.winPanelDelay,
    status,
    syncStarLineCompletion,
  ]);

  // P3B: handleCurrentSaveAndExit 使用 buildStarLineSavePayload 构造 Star Line 保存数据。
  const handleCurrentSaveAndExit = useCallback(() => {
    if (!usesStarLineSession || !starLineLevel) {
      handleSaveAndExit();
      return;
    }
    leaveStarLineSession();
    handleSaveAndExit(buildStarLineSavePayload(playMode, starLineLevel, starLineGridData));
  }, [
    handleSaveAndExit,
    leaveStarLineSession,
    playMode,
    starLineGridData,
    starLineLevel,
    usesStarLineSession,
  ]);

  // P3B: handleConfirmedRestart 使用 starLineSession.restart()（含清除持久化存档）。
  const handleConfirmedRestart = useCallback(() => {
    clearToast();
    if (usesStarLineSession) {
      restartStarLineSession();
      return;
    }
    restartCurrentGame();
  }, [clearToast, restartCurrentGame, restartStarLineSession, usesStarLineSession]);

  // ───── Star Line Playtest (dev mode) ─────
  const [playtestShowSolution, setPlaytestShowSolution] = useState(false);

  const playtestSolutionCells = starLineLevel?.solution ?? [];

  const handlePlaytestToggleSolution = useCallback(() => {
    setPlaytestShowSolution(s => !s);
  }, []);

  const handlePlaytestJumpToLevel = useCallback((targetIdx) => {
    if (!isStarLineMode(playMode)) return;
    const idx = Math.max(0, Math.min(getStarLineLevelCount(playMode) - 1, targetIdx));
    setLevelIdx(idx);
    setPlaytestShowSolution(false);
    restartStarLineSession();
  }, [playMode, restartStarLineSession, setLevelIdx]);

  const handlePlaytestUnlockAll = useCallback(() => {
    const total = getStarLineLevelCount(playMode);
    if (playMode === PLAY_MODES.starLine) {
      setStarLineProgress({ unlockedThrough: total - 1, completed: {} });
    } else {
      const lastLevel = getStarLineLevelByMode(playMode, total - 1);
      if (lastLevel) {
        setStarLineProgressV2(prev => unlockThroughLevel(prev, playMode, lastLevel.id));
      }
    }
    showToast(`🔓 已解锁全部 ${total} 关 Star Line`);
  }, [playMode, setStarLineProgress, setStarLineProgressV2, showToast]);

  const handlePlaytestClearProgress = useCallback(() => {
    if (playMode === PLAY_MODES.starLine) {
      safeRemoveStorageItem('cg_star_line_progress');
      safeRemoveStorageItem('cg_star_line_records');
      safeRemoveStorageItem('cg_star_line_saved_game');
      setStarLineProgress(createDefaultStarLineProgress());
    } else {
      safeRemoveStorageItem(getSavedGameKey(playMode));
      setStarLineProgressV2(createDefaultProgressV2());
    }
    restartStarLineSession();
    showToast('🗑️ Star Line 存档已清空');
  }, [playMode, restartStarLineSession, setStarLineProgress, setStarLineProgressV2, showToast]);

  const playtestActions = {
    onJumpToLevel: handlePlaytestJumpToLevel,
    onUnlockAll: handlePlaytestUnlockAll,
    onResetLevel: restartStarLineSession,
    onClearProgress: handlePlaytestClearProgress,
    onToggleSolution: handlePlaytestToggleSolution,
  };

  // ───── Dev Candidate Handlers (DEV only) ─────
  const exitDevCandidateGame = useCallback(() => {
    setActiveDevCandidate(null);
  }, []);

  const startDevCandidateGame = useCallback((candidate) => {
    if (!isDev) return;
    setLevelSelectEntrySource('game');
    setActiveDevCandidate(candidate);
    const mode = candidate.mode === 'diagonal' ? PLAY_MODES.diagonal : PLAY_MODES.classic;
    setPlayMode(mode);
    setDiff(candidate.diff);
    // Use a sentinel levelIdx so normal save/load doesn't interfere
    setLevelIdx(-1);
    initDevCandidateGame(candidate);
    setView('game');
  }, [isDev, setPlayMode, setDiff, setLevelIdx, initDevCandidateGame, setView]);

  const handleBack = useCallback(() => {
    // 退出正式游戏时清理 dev candidate 状态
    if (isDev) exitDevCandidateGame();
    if (status === 'playing') {
      const hasStarLineMarks = usesStarLineSession && isStarLineBoardActive(starLineGridData);
      if (hasStarLineMarks || (!usesStarLineSession && path.length > 1)) {
        setShowExitPrompt(true);
      } else {
        if (usesStarLineSession) leaveStarLineSession();
        clearSavedGame();
        setView('levels');
      }
    } else {
      if (usesStarLineSession) leaveStarLineSession();
      setView('levels');
    }
  }, [
    clearSavedGame,
    exitDevCandidateGame,
    isDev,
    leaveStarLineSession,
    path.length,
    setView,
    starLineGridData,
    status,
    usesStarLineSession,
  ]);

  const persistDevReviews = useCallback((map) => {
    try { localStorage.setItem('cg_dev_candidate_reviews', JSON.stringify(map)); } catch { /* noop */ }
  }, []);

  const markCandidateReviewed = useCallback((candidate, status) => {
    setDevReviewMap(prev => {
      const next = { ...prev };
      if (status) {
        next[candidate.seed] = status;
      } else {
        delete next[candidate.seed];
      }
      persistDevReviews(next);
      return next;
    });
  }, [persistDevReviews]);

  const candidateKeyFn = useCallback((c) => `${c.mode}:${c.diff}:${c.seed}:${c.virtualIdx}`, []);

  const getNextDevCandidate = useCallback((currentCandidate) => {
    if (!devCandidates.length) return null;
    const currentGroup = `${currentCandidate.mode}:${currentCandidate.diff}`;

    // Phase 1: search forward within same group
    const currentIdx = devCandidates.findIndex(c => candidateKeyFn(c) === candidateKeyFn(currentCandidate));
    for (let i = currentIdx + 1; i < devCandidates.length; i++) {
      const c = devCandidates[i];
      const cg = `${c.mode}:${c.diff}`;
      if (cg === currentGroup && !devReviewMap[c.seed]) return c;
    }

    // Phase 2: search other groups forward
    for (let i = 0; i < devCandidates.length; i++) {
      const c = devCandidates[i];
      const cg = `${c.mode}:${c.diff}`;
      if (cg !== currentGroup && !devReviewMap[c.seed]) return c;
    }

    // Phase 3: same group wrap-around
    for (let i = 0; i < currentIdx; i++) {
      const c = devCandidates[i];
      const cg = `${c.mode}:${c.diff}`;
      if (cg === currentGroup && !devReviewMap[c.seed]) return c;
    }

    // All reviewed
    return null;
  }, [devCandidates, devReviewMap, candidateKeyFn]);

  const copyCandidateJson = useCallback((candidate) => {
    try {
      navigator.clipboard.writeText(JSON.stringify(candidate, null, 2)).then(
        () => showToast('✅ 已复制候选 JSON'),
        () => showToast('❌ 复制失败')
      );
    } catch { showToast('❌ 剪贴板不可用'); }
  }, [showToast]);

  const copyApplyCommand = useCallback((candidate) => {
    const cmd = `npm run apply:level-candidates -- --mode ${candidate.mode} --diff ${candidate.diff} --keys ${candidate.key} --dry-run`;
    try {
      navigator.clipboard.writeText(cmd).then(
        () => showToast('✅ 已复制 apply 命令'),
        () => showToast('❌ 复制失败')
      );
    } catch { showToast('❌ 剪贴板不可用'); }
  }, [showToast]);

  const handleDevCandidateRestart = useCallback(() => {
    if (!activeDevCandidate) return;
    restartDevCandidateGame(activeDevCandidate);
  }, [activeDevCandidate, restartDevCandidateGame]);

  const handleDevCandidateNext = useCallback(() => {
    if (!activeDevCandidate) return;
    const next = getNextDevCandidate(activeDevCandidate);
    if (next) {
      startDevCandidateGame(next);
    } else {
      exitDevCandidateGame();
      setView('levels');
      setShowGmPanel(true);
      showToast('✅ 本批候选已审核完成');
    }
  }, [activeDevCandidate, getNextDevCandidate, startDevCandidateGame, exitDevCandidateGame, setView, showToast]);

  const handleDevCandidateBackToGm = useCallback(() => {
    // 不回清 activeDevCandidate，让 GM 面板能继续显示 dev 候选信息
    setView('levels');
    setShowGmPanel(true);
  }, [setView]);

  // ── Auxiliary dev review helpers ──
  const handleRevealAllHidden = useCallback(() => {
    if (!activeDevCandidate) return;
    setGridData(prev => prev.map(c => ({ ...c, isRevealed: true })));
    showToast('👁️ 全部暗牌已翻开');
  }, [activeDevCandidate, setGridData, showToast]);

  const handleRestoreHidden = useCallback(() => {
    if (!activeDevCandidate) return;
    setGridData(prev => prev.map(c => ({ ...c, isRevealed: false, isHinted: false, isExcluded: false })));
    showToast('🔒 暗牌已恢复为原始状态');
  }, [activeDevCandidate, setGridData, showToast]);

  const handleClearDevPath = useCallback(() => {
    if (!activeDevCandidate) return;
    setPath(prev => [prev[0]]);
    setTimer(0);
    showToast('🧹 路径已清空');
  }, [activeDevCandidate, setPath, setTimer, showToast]);

  const handleDevResetLevel = useCallback(() => {
    if (!activeDevCandidate) return;
    restartDevCandidateGame(activeDevCandidate);
    showToast('🔄 当前候选已重置');
  }, [activeDevCandidate, restartDevCandidateGame, showToast]);

  // Build dev label for HUD
  const devLabel = activeDevCandidate
    ? `CANDIDATE · ${activeDevCandidate.mode === 'diagonal' ? 'Diagonal' : 'Classic'} ${activeDevCandidate.diff} · seed ${activeDevCandidate.seed}`
    : '';

  // Bundle dev candidate actions for panels
  const devCandidateActions = isDev ? {
    markApproved: () => {
      if (!activeDevCandidate) return;
      markCandidateReviewed(activeDevCandidate, 'APPROVED');
      showToast(`✅ 已标记 APPROVED · seed ${activeDevCandidate.seed}，后续需通过 apply 脚本正式入库`);
    },
    markRejected: () => {
      if (!activeDevCandidate) return;
      markCandidateReviewed(activeDevCandidate, 'REJECTED');
      showToast(`⚠️ 已标记 REJECTED · seed ${activeDevCandidate.seed}`);
    },
    restart: handleDevCandidateRestart,
    nextCandidate: handleDevCandidateNext,
    backToGm: handleDevCandidateBackToGm,
    copyJson: () => activeDevCandidate && copyCandidateJson(activeDevCandidate),
    copyApplyCommand: () => activeDevCandidate && copyApplyCommand(activeDevCandidate),
    revealAllHidden: handleRevealAllHidden,
    restoreHidden: handleRestoreHidden,
    clearPath: handleClearDevPath,
    resetLevel: handleDevResetLevel
  } : {};

  const openOneLineLevels = useCallback(() => {
    setLevelSelectEntrySource('home');
    if (getFamilyId(playMode) === 'starLine') {
      setPlayMode(PLAY_MODES.classic);
      setDiff('easy');
      setLevelIdx(0);
    }
    setView('levels');
  }, [playMode, setPlayMode, setDiff, setLevelIdx]);

  const openStarLineLevels = useCallback(() => {
    setLevelSelectEntrySource('home');
    setPlayMode(PLAY_MODES.starSingle);
    setDiff('easy');
    setLevelIdx(0);
    setView('levels');
  }, [setPlayMode, setDiff, setLevelIdx]);

  const renderHomeContent = () => (
        <div className="app-shell page-transition flex flex-col font-sans relative overflow-hidden" data-testid="home-view">

          {/* 积分池数据与自动兑换逻辑保留，仅隐藏入口页角标展示 */}
          <button
            onClick={() => setShowSettings(true)}
            className="absolute right-4 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.07] bg-[#151b24]/75 text-slate-500 transition-colors hover:bg-[#1a222d] hover:text-slate-200 active:scale-[0.98]"
            aria-label="设置"
            title="设置"
            data-testid="home-settings-button-secondary"
          >
            <Settings size={16} />
          </button>

          <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
            <div className="home-family-shell w-full max-w-6xl">
              <div className="linebook-logo relative z-10 mb-6 text-center sm:mb-8">
                <h1 className="linebook-wordmark night-title text-5xl sm:text-6xl font-black tracking-normal" data-testid="home-title">Linebook</h1>
              </div>

              <div className="relative z-10 mx-auto mb-4 flex max-w-sm flex-col gap-3">
                {resumeGame && (
                  <button
                    onClick={() => {
                      setLevelSelectEntrySource('game');
                      startGame(resumeGame.diff, resumeGame.levelIdx, resumeGame.playMode);
                    }}
                    className="button-primary py-3 text-lg flex items-center justify-center gap-2"
                    data-testid="home-continue-button"
                  >
                    <Play fill="currentColor" size={19} />
                    <span className="flex flex-col items-center leading-tight">
                      <span>继续解谜</span>
                      <span className="text-xs font-semibold opacity-85 tracking-wide" data-testid="home-continue-context">{describeResumeGame(resumeGame)}</span>
                    </span>
                  </button>
                )}
              </div>

              <div className="home-family-grid relative z-10">
                <HomeOneLineEntry resumeGame={resumeGame} onOpen={openOneLineLevels} />
                <HomeStarLineEntry onOpen={openStarLineLevels} />
              </div>
            </div>
          </div>
        </div>
  );

  const renderViewContent = () => {
    if (view === 'home') return renderHomeContent();

    if (view === 'mode' || view === 'levels') {
      const playModeFamily = getFamilyId(playMode);
      if (
        !activeModeRuntime
        || (playModeFamily !== 'oneLine' && playModeFamily !== 'starLine')
      ) {
        return renderHomeContent();
      }
      const isStarLineCatalog = playModeFamily === 'starLine';
      const activeModeReplayProgress = getModeReplayProgress(
        levelSelectReplayProgress,
        playMode,
      );
      const activeModeSummary = modeProgressSummaries[playMode];
      const replayIsAvailable = (
        activeModeReplayProgress?.replayActive === true
        && activeModeSummary?.total > 0
        && activeModeSummary.completed >= activeModeSummary.total
      );

      return (
        <PuzzleBookPage
          modes={isStarLineCatalog ? STAR_LINE_MODE_LIST : ONE_LINE_MODE_LIST}
          activeMode={playMode}
          modeProgressSummaries={modeProgressSummaries}
          levels={levels}
          newlyUnlocked={newlyUnlocked}
          completionEvent={levelSelectCompletionEvent}
          prefersReducedMotion={prefersReducedMotion}
          entrySource={levelSelectEntrySource}
          onConsumeNewlyUnlocked={() => setNewlyUnlocked(null)}
          onConsumeCompletionEvent={() => setLevelSelectCompletionEvent(null)}
          headerLabel={playModeFamily === 'starLine' ? 'STAR LINE' : 'ONE LINE'}
          replayProgress={activeModeReplayProgress}
          onEnterReplay={(modeId) => {
            setLevelSelectReplayProgress(activateLevelSelectReplay(modeId));
          }}
          onReplayPageChange={(modeId, pageIndex) => {
            setLevelSelectReplayProgress(
              setLevelSelectReplayPage(modeId, pageIndex),
            );
          }}
          onBackHome={() => {
            setNewlyUnlocked(null);
            setView('home');
          }}
          onSelectMode={(selectedMode) => {
            setNewlyUnlocked(null);
            setPendingLevelStart(null);
            setPlayMode(selectedMode);
            setDiff('easy');
            setLevelIdx(0);
            setPendingStarLineSession(null);
          }}
          onSelectLevel={(selected) => {
            setNewlyUnlocked(null);
            if (replayIsAvailable) {
              setActiveReplayLevel({
                modeId: playMode,
                levelId: selected.levelId,
              });
            }
            handlePuzzleLevelSelect(selected);
          }}
        />
      );
    }

    if (view === 'game') {
      const isDev = isDevCandidate;
      const modeRuntime = isDev ? null : activeModeRuntime;
      if (!isDev && !modeRuntime) return renderHomeContent();

      const levelConfig = isDev
        ? createLevelConfig(activeDevCandidate.diff, 0, activeDevCandidate.mode === 'diagonal' ? PLAY_MODES.diagonal : PLAY_MODES.classic)
        : createLevelConfig(diff, levelIdx, playMode);
      const effectiveDiff = isDev ? activeDevCandidate.diff : diff;
      const config = CONFIG[effectiveDiff];
      const N = isDev ? activeDevCandidate.N : (levelConfig.hiddenLevel?.N || levelConfig.portalLevel?.N || levelConfig.starLineLevel?.N || config.N);
      const currentMode = isDev
        ? getGameModeConfig(activeDevCandidate.mode === 'diagonal' ? PLAY_MODES.diagonal : PLAY_MODES.classic)
        : getGameModeConfig(playMode);
      if (!currentMode) return renderHomeContent();

      const portalRun = modeRuntime?.interactions.portal ?? false;
      const isHiddenFlag = modeRuntime?.interactions.hidden ?? false;
      const isStarLineFlag = modeRuntime?.session === RUNTIME_SESSIONS.starLine;
      const displayLevelNumber = isDev ? null
        : isStarLineFlag ? getStarLineDisplayNumber(playMode, starLineLevel?.id)
        : isHiddenFlag ? levelIdx + 1
        : portalRun ? levelIdx + 1
        : getNormalLevelLinearIndex(playMode, diff, levelIdx) + 1;

      return (
        <GameView
          playMode={isDev ? (activeDevCandidate.mode === 'diagonal' ? PLAY_MODES.diagonal : PLAY_MODES.classic) : playMode}
          runtime={modeRuntime}
          levelIdx={isDev ? -1 : levelIdx}
          firstLevelHintMode={isDev ? null : firstLevelHintMode}
          status={status}
          path={path}
          N={N}
          isPathCompleting={isPathCompleting}
          prefersReducedMotion={prefersReducedMotion}
          currentModeName={isDev ? '' : currentMode.name}
          displayLevelNumber={displayLevelNumber}
          timer={timer}
          score={score}
          comboStreak={comboStreak}
          coins={coins}
          hp={hp}
          starLineLevel={starLineLevel}
          starLineTotalLevels={starLineTotalLevels}
          starLineState={starLineState}
          starLineInputKey={`${starLineLevel?.id ?? 'none'}:${starLineResetKey}`}
          starLineCellActions={starLineCellActions}
          starLineUndoLast={starLineUndoLast}
          starLineCanUndo={starLineCanUndo}
          starLineBeginBatch={starLineBeginBatch}
          starLineCommitBatch={starLineCommitBatch}
          starLineGuidance={starLineGuidance}
          starLineGuidanceActions={starLineGuidanceActions}
          starLineDoubleGuidance={starLineDoubleGuidance}
          starLineDoubleGuidanceActions={starLineDoubleGuidanceActions}
          gridData={modeRuntime?.board === RUNTIME_BOARDS.starLine ? starLineGridData : gridData}
          breakPoints={breakPoints}
          wrongFlash={wrongFlash}
          activePortal={activePortal}
          lastConnectedIndex={lastConnectedIndex}
          connectionFeedback={connectionFeedback}
          items={items}
          levelReport={levelReport}
          maxLevelCount={isDev ? 0 : getLevelsPerDiff(playMode)}
          hasNextLevel={isDev ? false : Boolean(nextLevelTarget)}
          showExitPrompt={isDev ? false : showExitPrompt}
          purchasePrompt={purchasePrompt}
          containerRef={containerRef}
          isDevCandidate={isDev}
          activeDevCandidate={isDev ? activeDevCandidate : null}
          devLabel={isDev ? devLabel : ''}
          devCandidateActions={isDev ? devCandidateActions : {}}
          onBack={isDev ? handleDevCandidateBackToGm : handleBack}
          onRestart={isDev ? handleDevCandidateRestart : handleConfirmedRestart}
          onNextLevel={() => {
            if (!nextLevelTarget) return;
            if (usesStarLineSession) leaveStarLineSession();
            const nextLevel = levels.find(level => (
              level.diff === nextLevelTarget.diff
              && level.levelIdx === nextLevelTarget.levelIdx
            ));
            if (nextLevel) {
              if (
                getModeReplayProgress(levelSelectReplayProgress, playMode)
                  ?.replayActive
              ) {
                setActiveReplayLevel({
                  modeId: playMode,
                  levelId: nextLevel.levelId,
                });
              }
            }
            startGame(nextLevelTarget.diff, nextLevelTarget.levelIdx, playMode);
          }}
          onWinBack={() => {
            if (usesStarLineSession) leaveStarLineSession();
            setNewlyUnlocked(levelReport?.unlockInfo ?? null);
            if (levelReport?.firstModeCompletion) {
              setLevelSelectCompletionEvent({
                id: ++levelSelectCompletionEventIdRef.current,
                modeId: levelReport.modeId,
                firstCompletion: true,
              });
            }
            setView('levels');
            clearSavedGame();
          }}
          onModeSelect={() => {
            if (usesStarLineSession) leaveStarLineSession();
            setNewlyUnlocked(levelReport?.unlockInfo ?? null);
            if (levelReport?.firstModeCompletion) {
              setLevelSelectCompletionEvent({
                id: ++levelSelectCompletionEventIdRef.current,
                modeId: levelReport.modeId,
                firstCompletion: true,
              });
            }
            resetRuleDiscovery();
            clearSavedGame();
            setView('levels');
          }}
          onUseItem={handleUseItem}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onSaveAndExit={handleCurrentSaveAndExit}
          onAbandonAndExit={() => {
            leaveStarLineSession();
            handleAbandonAndExit();
          }}
          onCloseExitPrompt={() => setShowExitPrompt(false)}
          closePurchasePrompt={closePurchasePrompt}
          buyPromptItem={buyPromptItem}
          showToast={showToast}
          onRevive={isDev ? undefined : handleRevive}
          onBackToLevels={isDev ? handleDevCandidateBackToGm : (() => {
            if (usesStarLineSession) leaveStarLineSession();
            setView('levels');
            clearSavedGame();
          })}
          // Dev candidate result handlers
          onDevWin={isDev ? handleDevCandidateWin : undefined}
          onDevLose={isDev ? handleDevCandidateLose : undefined}
          // ── Star Line Playtest Panel ──
          isPlaytestMode={isPlaytestMode}
          playtestActions={playtestActions}
          playtestShowSolution={playtestShowSolution}
          playtestSolutionCells={playtestSolutionCells}
        />
      );
    }
    return null;
  };

  // P4B 原型 host：仅 DEV/playtest 门槛 + 显式 ?prototype=digital-loop 时挂载。
  // 集中式单调用点；不进入 GAME_MODES / GAME_FAMILIES / 正式 registry。
  const prototypeParam = (typeof window !== 'undefined')
    ? new URLSearchParams(window.location.search).get('prototype')
    : null;
  const isPrototypeHostActive = prototypeParam === 'digital-loop' && isPlaytestMode;

  if (isPrototypeHostActive) {
    return <DigitalLoopPrototypeHost />;
  }

  return (
    <>

      {renderViewContent()}
      {isDev && (
        <GmPanel
          show={showGmPanel}
          onClose={() => setShowGmPanel(false)}
          view={view}
          showToast={showToast}
          playMode={playMode}
          diff={diff}
          levelIdx={levelIdx}
          status={status}
          path={path}
          gridData={gridData}
          hp={hp}
          score={score}
          timer={timer}
          comboStreak={comboStreak}
          maxComboStreak={maxComboStreak}
          coins={coins}
          items={items}
          setCoins={setCoins}
          setItems={setItems}
          setGridData={setGridData}
          setPath={setPath}
          setTimer={setTimer}
          handleWin={handleWin}
          handleLose={handleLose}
          handleRevive={handleRevive}
          restartCurrentGame={restartCurrentGame}
          clearSavedGame={clearSavedGame}
          startGame={startGame}
          progress={activeNormalProgress}
          portalProgress={activePortalProgress}
          setProgress={setActiveNormalProgress}
          setPortalProgress={setActivePortalProgress}
          setHiddenProgress={setHiddenProgress}
          onStartDevCandidate={startDevCandidateGame}
          devCandidates={devCandidates}
          setDevCandidates={setDevCandidates}
          devReviewMap={devReviewMap}
          onMarkCandidateReviewed={markCandidateReviewed}
          activeDevCandidate={activeDevCandidate}
        />
      )}
      {ruleDiscovery && (
        <RuleCard
          discovery={ruleDiscovery.discovery}
          onStart={handleRuleCardStart}
        />
      )}

      {/* 设置面板 */}
      {showSettings && (
        <SettingsPanel
          sfxVol={sfxVol}
          onSfxVolChange={handleSfxVolumeChange}
          starLineGuideCompleted={starLineGuidance.operation.completed}
          starLineGuideReplayRequested={starLineGuidance.replayRequested}
          starLineDoubleGuideCompleted={Object.keys(starLineDoubleGuidance.completedLessons || {}).length > 0}
          starLineDoubleGuideReplayRequested={Boolean(starLineDoubleGuidance.replayLevelId)}
          starLineDoubleCompletedLessons={starLineDoubleGuidance.completedLessons}
          starLineDoubleReplayLevelId={starLineDoubleGuidance.replayLevelId}
          onReplayStarLineGuide={() => {
            starLineGuidanceActions.requestReplay();
            showToast('下次进入单星第 1 关时播放操作教学');
          }}
          onReplayStarLineDoubleGuide={(levelId) => {
            const lessonNumber = Number(levelId?.match(/(\d+)$/)?.[1] || 1);
            starLineDoubleGuidanceActions.requestReplay(levelId);
            showToast(`下次进入双星第 ${lessonNumber} 关时播放推理教学`);
          }}
          showDevTools={isDev}
          onOpenDevTools={() => {
            setShowSettings(false);
            setShowGmPanel(true);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {pendingLevelStart && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4" data-testid="start-level-prompt">
          <div className="surface-panel w-full max-w-sm p-7 text-center">
            <h2 className="mb-3 text-xl font-bold text-slate-100">开始新关卡？</h2>
            <p className="mb-7 text-sm leading-relaxed text-slate-400">
              开始此关将放弃当前进行中的存档。
            </p>
            <div className="space-y-3">
              <button
                type="button"
                className="button-primary w-full py-3.5"
                data-testid="confirm-start-level-button"
                onClick={handleConfirmStartLevel}
              >
                放弃存档并开始
              </button>
              <button
                type="button"
                className="w-full py-2 text-sm font-bold text-slate-400 hover:text-white"
                data-testid="cancel-start-level-button"
                onClick={() => setPendingLevelStart(null)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
      
      <GameToast toast={toast?.contextKey === toastContextKey ? toast : null} />
    </>
  );
}
