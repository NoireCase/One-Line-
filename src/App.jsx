import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, BookOpen, Settings } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import GameToast from './components/GameToast.jsx';
import PuzzleBookPage from './components/PuzzleBookPage.jsx';
import GameView from './components/game/GameView.jsx';
import GmPanel from './components/GmPanel.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import RuleCard from './components/RuleCard.jsx';
import { HomePathMark } from './components/PuzzleMarks.jsx';
import {
  GAME_MODE_LIST,
  PLAY_MODES,
  getGameModeConfig,
  getLevelsPerDiff
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
import { isPortalCollectMode, isPortalMode } from './game/portal/portalRules.js';
import { getNormalLevelLinearIndex } from './utils/levelNavigation.js';

// --- 主应用组件 ---
export default function App() {
  const prefersReducedMotion = useReducedMotion();
  const [view, setView] = useState('home');
  const [resumeGame, setResumeGame] = useState(() => getSavedGameResume());

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
    portalCollectProgress,
    setPortalCollectProgress,
    portalCollectBestSteps,
    setPortalCollectBestSteps,
    hiddenProgress,
    setHiddenProgress,
    globalScore,
    setGlobalScore
  } = useProgress();

  // 设置菜单与音量
  const [showSettings, setShowSettings] = useState(false);
  const [sfxVol, setSfxVol] = useState(100);
  const [musicVol, setMusicVol] = useState(100);

  // 全局浮窗提示与二级确认框
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const {
    ruleDiscovery,
    requestRuleDiscovery,
    completeRuleDiscovery,
    resetRuleDiscovery
  } = useRuleDiscovery();
  
  const showToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 1800);
  }, []);

  const {
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
    targetFlash,
    setTargetFlash,
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
    lastProcessedRef,
    completionTimeoutRef,
    connectedPulseTimeoutRef,
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
    setShowExitPrompt
  });

  // 输入模式
  const [inputMode, setInputMode] = useState(() => {
    try { return localStorage.getItem('cg_input_mode') || 'mouse'; }
    catch { return 'mouse'; }
  });

  // 开发环境
  const isDev = import.meta.env.DEV;
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

  // 初始化拦截与本地存储
  useEffect(() => {
    try {
      const sSfx = localStorage.getItem('cg_sfx_vol');
      if (sSfx !== null) setSfxVol(parseInt(sSfx));
      const sMus = localStorage.getItem('cg_music_vol');
      if (sMus !== null) setMusicVol(parseInt(sMus));
    } catch {
      // Ignore corrupted local save data and keep defaults.
    }
  }, []);

  // 音量同步保存
  useEffect(() => {
    localStorage.setItem('cg_sfx_vol', sfxVol.toString());
    localStorage.setItem('cg_input_mode', inputMode);
    localStorage.setItem('cg_music_vol', musicVol.toString());
    setSfxVolume(sfxVol);
  }, [sfxVol, musicVol, inputMode]);

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
    if (discovery.id === 'portalClassic' || discovery.id === 'portalCollect') return; // game already initialized
    startGame(d, lvl, targetPlayMode);
  };

  const activeNormalProgress = playMode === PLAY_MODES.diagonal ? diagonalProgress : progress;
  const activeNormalHighScores = playMode === PLAY_MODES.diagonal ? diagonalHighScores : highScores;
  const activePortalProgress = isPortalCollectMode(playMode) ? portalCollectProgress : portalProgress;
  const activePortalBestSteps = isPortalCollectMode(playMode) ? portalCollectBestSteps : portalBestSteps;

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
    if (isPortalCollectMode(playMode)) {
      setPortalCollectProgress(updater);
    } else {
      setPortalProgress(updater);
    }
  }, [playMode, setPortalCollectProgress, setPortalProgress]);

  const setActivePortalBestSteps = useCallback((updater) => {
    if (isPortalCollectMode(playMode)) {
      setPortalCollectBestSteps(updater);
    } else {
      setPortalBestSteps(updater);
    }
  }, [playMode, setPortalBestSteps, setPortalCollectBestSteps]);

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
    setPortalProgress: setActivePortalProgress,
    setPortalBestSteps: setActivePortalBestSteps,
    setCoins,
    setGlobalScore,
    setProgress: setActiveNormalProgress,
    setHighScores: setActiveNormalHighScores,
    setHiddenProgress,
    reviveWithCoins,
    showToast,
    markWon,
    markLost
  });

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
    inputMode,
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
    setTargetFlash,
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
    lastProcessedRef,
    containerRef,
    markLost: activeDevCandidate ? handleDevCandidateLose : handleLose,
    showToast,
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

  const { modeProgressSummaries, levels } = useLevelList({
    playMode,
    progressByMode: {
      [PLAY_MODES.classic]: progress,
      [PLAY_MODES.diagonal]: diagonalProgress,
      [PLAY_MODES.hidden]: hiddenProgress
    },
    highScoresByMode: {
      [PLAY_MODES.classic]: highScores,
      [PLAY_MODES.diagonal]: diagonalHighScores,
      [PLAY_MODES.hidden]: { hidden: [] }
    },
    portalProgressByMode: {
      [PLAY_MODES.portalClassic]: portalProgress,
      [PLAY_MODES.portalCollect]: portalCollectProgress
    },
    portalBestStepsByMode: {
      [PLAY_MODES.portalClassic]: portalBestSteps,
      [PLAY_MODES.portalCollect]: portalCollectBestSteps
    }
  });

  // ───── Dev Candidate Handlers (DEV only) ─────
  const exitDevCandidateGame = useCallback(() => {
    setActiveDevCandidate(null);
  }, []);

  const startDevCandidateGame = useCallback((candidate) => {
    if (!isDev) return;
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
      if (path.length > 1) {
        setShowExitPrompt(true);
      } else {
        clearSavedGame();
        setView('levels');
      }
    } else {
      setView('levels');
    }
  }, [isDev, status, path.length, clearSavedGame, setView, exitDevCandidateGame]);

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
    const cmd = `npm run apply:staged-levels -- --mode ${candidate.mode} --diff ${candidate.diff} --seeds ${candidate.seed} --dry-run true`;
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

  const renderViewContent = () => {
    if (view === 'home') {
      return (
        <div className="app-shell flex flex-col font-sans relative overflow-hidden" data-testid="home-view">

          {globalScore > 0 && <div className="absolute top-5 right-5 text-[11px] text-slate-600 font-mono z-30">积分 {globalScore}/5000</div>}

          <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
            <div className="world-frame max-w-lg w-full px-6 sm:px-8 pt-9 pb-8 text-center scale-105 sm:scale-110">
              <div className="relative z-10">
                <p className="text-[#8f8a7c] text-[10px] tracking-[0.32em] uppercase mb-2">A tiny path puzzle</p>
                <h1 className="night-title text-7xl font-black tracking-[-0.07em]" data-testid="home-title">One Line</h1>
                <p className="text-[#a49d8d] text-sm mt-3">在夜色里，找到那一条路</p>
              </div>

              <div className="relative z-10 max-w-xs mx-auto my-4">
                <HomePathMark />
              </div>

              <div className="relative z-10 flex flex-col gap-3">
                {resumeGame && (
                  <button
                    onClick={() => startGame(resumeGame.diff, resumeGame.levelIdx, resumeGame.playMode)}
                    className="button-primary py-3.5 text-lg flex items-center justify-center gap-2"
                    data-testid="home-continue-button"
                  >
                    <Play fill="currentColor" size={19} /> 继续解谜
                  </button>
                )}
                <button
                  onClick={() => setView('levels')}
                  className={`${resumeGame ? 'button-secondary py-3 text-base' : 'button-primary py-3.5 text-lg'} flex items-center justify-center gap-2`}
                  data-testid="home-start-button"
                >
                  <BookOpen size={19} /> 选择玩法
                </button>
              </div>

              <div className="relative z-10 mt-5">
                <button onClick={() => setShowSettings(true)} className="button-quiet text-sm font-medium flex items-center justify-center gap-1.5 mx-auto" data-testid="home-settings-button-secondary">
                  <Settings size={15} /> 设置
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (view === 'mode' || view === 'levels') {
      return (
        <PuzzleBookPage
          modes={GAME_MODE_LIST}
          activeMode={playMode}
          modeProgressSummaries={modeProgressSummaries}
          levels={levels}
          onBackHome={() => setView('home')}
          onSelectMode={(selectedMode) => {
            setPlayMode(selectedMode);
            setDiff('easy');
          }}
          onSelectLevel={(entry) => startGame(entry.diff, entry.levelIdx, playMode)}
        />
      );
    }

    if (view === 'game') {
      const isDev = isDevCandidate;
      const levelConfig = isDev
        ? createLevelConfig(activeDevCandidate.diff, 0, activeDevCandidate.mode === 'diagonal' ? PLAY_MODES.diagonal : PLAY_MODES.classic)
        : createLevelConfig(diff, levelIdx, playMode);
      const effectiveDiff = isDev ? activeDevCandidate.diff : diff;
      const config = CONFIG[effectiveDiff];
      const N = isDev ? activeDevCandidate.N : (levelConfig.portalLevel?.N || config.N);
      const currentMode = isDev
        ? getGameModeConfig(activeDevCandidate.mode === 'diagonal' ? PLAY_MODES.diagonal : PLAY_MODES.classic)
        : getGameModeConfig(playMode);
      const portalRun = isDev ? false : isPortalMode(playMode);
      const isPortal2Flag = isDev ? false : levelConfig.rules.id === 'portal2';
      const displayLevelNumber = isDev ? null : (portalRun ? levelIdx + 1 : getNormalLevelLinearIndex(playMode, diff, levelIdx) + 1);

      return (
        <GameView
          playMode={isDev ? (activeDevCandidate.mode === 'diagonal' ? PLAY_MODES.diagonal : PLAY_MODES.classic) : playMode}
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
          portalRun={portalRun}
          isPortal2={isPortal2Flag}
          gridData={gridData}
          breakPoints={breakPoints}
          wrongFlash={wrongFlash}
          targetFlash={targetFlash}
          activePortal={activePortal}
          lastConnectedIndex={lastConnectedIndex}
          connectionFeedback={connectionFeedback}
          portalExcellentSteps={isDev ? undefined : levelConfig.portalLevel?.excellentSteps}
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
          onRestart={isDev ? handleDevCandidateRestart : restartCurrentGame}
          onNextLevel={() => {
            if (nextLevelTarget) startGame(nextLevelTarget.diff, nextLevelTarget.levelIdx, playMode);
          }}
          onWinBack={() => { setView('levels'); clearSavedGame(); }}
          onModeSelect={() => { resetRuleDiscovery(); clearSavedGame(); setView('levels'); }}
          onUseItem={handleUseItem}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onSaveAndExit={handleSaveAndExit}
          onAbandonAndExit={handleAbandonAndExit}
          onCloseExitPrompt={() => setShowExitPrompt(false)}
          closePurchasePrompt={closePurchasePrompt}
          buyPromptItem={buyPromptItem}
          showToast={showToast}
          onRevive={isDev ? undefined : handleRevive}
          onBackToLevels={isDev ? handleDevCandidateBackToGm : (() => { setView('levels'); clearSavedGame(); })}
          // Dev candidate result handlers
          onDevWin={isDev ? handleDevCandidateWin : undefined}
          onDevLose={isDev ? handleDevCandidateLose : undefined}
        />
      );
    }
    return null;
  };

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
          onSfxVolChange={setSfxVol}
          inputMode={inputMode}
          onInputModeChange={setInputMode}
          showDevTools={isDev}
          onOpenDevTools={() => {
            setShowSettings(false);
            setShowGmPanel(true);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
      
      <GameToast toast={toast} onDone={() => setToast(null)} />
    </>
  );
}
