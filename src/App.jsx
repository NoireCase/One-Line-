import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Info, Settings } from 'lucide-react';
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
import { isPortalMode } from './game/portal/portalRules.js';
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
    portalProgress,
    setPortalProgress,
    portalBestSteps,
    setPortalBestSteps,
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
    lastProcessedRef,
    completionTimeoutRef,
    connectedPulseTimeoutRef,
    startGame,
    restartCurrentGame,
    clearSavedGame,
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
    if (discovery.id === 'portal') return; // game already initialized
    startGame(d, lvl, targetPlayMode);
  };
  const {
    handleWin,
    handleLose,
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
    portalBestSteps,
    setPortalProgress,
    setPortalBestSteps,
    setCoins,
    setGlobalScore,
    setProgress,
    setHighScores,
    reviveWithCoins,
    showToast,
    markWon,
    markLost
  });

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
    markLost: handleLose,
    onComplete: handleWin
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
    progress,
    portalProgress,
    highScores,
    portalBestSteps
  });

  const handleBack = useCallback(() => {
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
  }, [status, path.length, clearSavedGame, setView]);

  const renderViewContent = () => {
    if (view === 'home') {
      return (
        <div className="app-shell flex flex-col font-sans relative overflow-hidden">
          
          <button onClick={() => setShowSettings(true)} className="absolute top-4 left-4 z-30 button-quiet p-2.5">
            <Settings size={20} />
          </button>

          {globalScore > 0 && <div className="absolute top-5 right-5 text-[11px] text-slate-600 font-mono z-30">积分 {globalScore}/5000</div>}

          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="world-frame max-w-md w-full px-7 pt-8 pb-7 text-center">
              <div className="relative z-10">
                <p className="text-[#8f8a7c] text-[10px] tracking-[0.32em] uppercase mb-2">A tiny path puzzle</p>
                <h1 className="night-title text-6xl font-black tracking-[-0.07em]">One Line</h1>
                <p className="text-[#a49d8d] text-sm mt-3">在夜色里，找到那一条路</p>
              </div>

              <div className="relative z-10 max-w-xs mx-auto my-3">
                <HomePathMark />
              </div>

              <div className="relative z-10 flex flex-col gap-3">
                {resumeGame && (
                  <button
                    onClick={() => startGame(resumeGame.diff, resumeGame.levelIdx, resumeGame.playMode)}
                    className="button-primary py-3.5 text-lg flex items-center justify-center gap-2"
                  >
                    <Play fill="currentColor" size={19} /> 继续解谜
                  </button>
                )}
                <button
                  onClick={() => setView('levels')}
                  className={`${resumeGame ? 'button-secondary py-3 text-base' : 'button-primary py-3.5 text-lg'} flex items-center justify-center gap-2`}
                >
                  <Play fill="currentColor" size={19} /> 开始游戏
                </button>
              </div>

              <div className="relative z-10 mt-5">
                <button onClick={() => setView('levels')} className="button-quiet text-sm font-medium flex items-center justify-center gap-1.5 mx-auto">
                  <Info size={15} /> 选择玩法
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
      const levelConfig = createLevelConfig(diff, levelIdx, playMode);
      const config = CONFIG[diff];
      const N = levelConfig.portalLevel?.N || config.N;
      const currentMode = getGameModeConfig(playMode);
      const portalRun = isPortalMode(playMode);
      const isPortal2 = levelConfig.rules.id === 'portal2';
      const displayLevelNumber = portalRun ? levelIdx + 1 : getNormalLevelLinearIndex(playMode, diff, levelIdx) + 1;

      return (
        <GameView
          playMode={playMode}
          levelIdx={levelIdx}
          firstLevelHintMode={firstLevelHintMode}
          status={status}
          path={path}
          N={N}
          isPathCompleting={isPathCompleting}
          prefersReducedMotion={prefersReducedMotion}
          currentModeName={currentMode.name}
          displayLevelNumber={displayLevelNumber}
          timer={timer}
          score={score}
          comboStreak={comboStreak}
          coins={coins}
          hp={hp}
          portalRun={portalRun}
          isPortal2={isPortal2}
          gridData={gridData}
          breakPoints={breakPoints}
          wrongFlash={wrongFlash}
          activePortal={activePortal}
          lastConnectedIndex={lastConnectedIndex}
          connectionFeedback={connectionFeedback}
          items={items}
          levelReport={levelReport}
          maxLevelCount={getLevelsPerDiff(playMode)}
          hasNextLevel={Boolean(nextLevelTarget)}
          showExitPrompt={showExitPrompt}
          purchasePrompt={purchasePrompt}
          containerRef={containerRef}
          onBack={handleBack}
          onRestart={restartCurrentGame}
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
          onRevive={handleRevive}
          onBackToLevels={() => { setView('levels'); clearSavedGame(); }}
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
          progress={progress}
          portalProgress={portalProgress}
          setProgress={setProgress}
          setPortalProgress={setPortalProgress}
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
