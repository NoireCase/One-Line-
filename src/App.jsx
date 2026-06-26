import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Info, X, Settings, ShieldAlert } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import GameToast from './components/GameToast.jsx';
import PuzzleBookPage from './components/PuzzleBookPage.jsx';
import GameView from './components/game/GameView.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import RuleCard from './components/RuleCard.jsx';
import { HomePathMark } from './components/PuzzleMarks.jsx';
import {
  GAME_MODE_LIST,
  getGameModeConfig,
  getLevelsPerDiff,
  getSavedGameKey
} from './config/gameModes.js';
import { setSfxVolume } from './config/soundEngine.js';
import useRuleDiscovery from './hooks/useRuleDiscovery.js';
import useProgress from './hooks/useProgress.js';
import useInventory, { SHOP } from './hooks/useInventory.js';
import useGameSession, { getSavedGameResume } from './hooks/useGameSession.js';
import usePathInteraction from './hooks/usePathInteraction.js';
import useGameResultFlow from './hooks/useGameResultFlow.js';
import { CONFIG } from './game/classic/createClassicLevel.js';
import {
  getAllowedDirections,
  getCellIndex,
  isInsideBoard
} from './game/rules/movement.js';
import { createLevelConfig, resolveRules } from './game/rules/levelConfig.js';
import {
  getPortalBestSteps,
  getPortalLevel,
  getPortalLevelCount,
  getPortalStars,
  isPortalMode
} from './game/portal/portalRules.js';

const LEVEL_SECTION_ORDER = ['easy', 'medium', 'hard'];
const getLevelSections = (playMode) => {
  if (isPortalMode(playMode)) {
    return [{
      diff: 'easy',
      levelCount: getPortalLevelCount(),
      startLevelNumber: 1
    }];
  }
  const sections = [
    { diff: 'easy', levelCount: 10, startLevelNumber: 1 },
    { diff: 'medium', levelCount: 15, startLevelNumber: 11 },
    { diff: 'hard', levelCount: 20, startLevelNumber: 26 }
  ];
  return sections;
};

const getNormalLevelLinearIndex = (playMode, diff, levelIdx) => {
  if (isPortalMode(playMode)) return -1;
  const sectionOffsets = { easy: 0, medium: 10, hard: 25 };
  return (sectionOffsets[diff] || 0) + levelIdx;
};

const getNormalUnlockedThroughIndex = (playMode, modeProgress) => {
  let farthestCompletedIndex = -1;
  LEVEL_SECTION_ORDER.forEach(currentDiff => {
    (modeProgress[currentDiff] || []).forEach((stars, currentLevelIdx) => {
      if (stars > 0) {
        farthestCompletedIndex = Math.max(
          farthestCompletedIndex,
          getNormalLevelLinearIndex(playMode, currentDiff, currentLevelIdx)
        );
      }
    });
  });
  return Math.min(farthestCompletedIndex + 1, 44);
};

const getModeCompletion = ({ playMode, progress: modeProgress, portalProgress: pp }) => {
  if (isPortalMode(playMode)) {
    const total = getPortalLevelCount();
    let completed = 0;
    if (pp.easy && pp.easy.starsById) {
      Object.values(pp.easy.starsById).forEach(stars => { if (stars > 0) completed++; });
    }
    return { completed, total };
  }
  let completed = 0;
  LEVEL_SECTION_ORDER.forEach(diff => {
    (modeProgress[diff] || []).forEach(stars => { if (stars > 0) completed++; });
  });
  return { completed, total: 45 };
};

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
    startGame,
    restartCurrentGame,
    clearSavedGame,
    markWon,
    markLost
  } = useGameSession({
    requestRuleDiscovery,
    setResumeGame,
    setView
  });

  // 输入模式
  const [inputMode, setInputMode] = useState(() => {
    try { return localStorage.getItem('cg_input_mode') || 'mouse'; }
    catch { return 'mouse'; }
  });

  // 开发环境 GM 工具与拖拽状态
  const isDev = import.meta.env.DEV;
  const [showGmPanel, setShowGmPanel] = useState(false);
  const [gmPos, setGmPos] = useState({ x: 20, y: 80 });
  const gmDragRef = useRef({ isDragging: false, startX: 0, startY: 0, initialX: 0, initialY: 0 });

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

  const executeItemLogic = (type, useInventory) => {
    let success = false;
    const N = CONFIG[diff].N;
    const rules = resolveRules(createLevelConfig(diff, levelIdx, playMode));
    const tip = path[path.length - 1];
    const nextVal = path.length + 1;

    if (type === 'heal') {
      setHp(h => Math.min(h + 1, CONFIG[diff].hp));
      showToast('生命值已恢复 1 点！');
      success = true;
    } else if (type === 'exclude') {
      const r = Math.floor(tip / N), c = tip % N;
      let candidates = [];
      for (let [dr, dc] of getAllowedDirections(rules)) {
        let nr = r + dr, nc = c + dc;
        if (isInsideBoard(nr, nc, N)) {
          let idx = getCellIndex(nr, nc, N);
          let cell = gridData[idx];
          if (cell.isHidden && !cell.isRevealed && !cell.isExcluded && cell.val !== nextVal && !path.includes(idx)) {
            candidates.push(idx);
          }
        }
      }
      if (candidates.length > 0) {
        const target = candidates[Math.floor(Math.random() * candidates.length)];
        setGridData(prev => {
          let nd = [...prev];
          nd[target] = { ...nd[target], isExcluded: true };
          return nd;
        });
        success = true;
      } else {
        showToast('周围没有可排除的未知错误格子！');
      }
    } else if (type === 'hint') {
      let targetIdx = gridData.findIndex(c => c.val === nextVal);
      if (targetIdx !== -1) {
        setGridData(prev => {
          let nd = [...prev];
          nd[targetIdx] = { ...nd[targetIdx], isHinted: true };
          return nd;
        });
        success = true;
      }
    }

    if (success) {
      if (useInventory) {
        consumeItem(type);
      } else {
        spendCoinsForItem(type);
        showToast(`已花费 ${SHOP[type]} 金币购买并使用道具！`);
      }
    }
  };

  const handleUseItem = (type) => {
    if (status !== 'playing') return;
    const cost = SHOP[type];
    const useInventory = hasItem(type);
    
    const nextVal = path.length + 1;
    if (type === 'heal' && hp >= CONFIG[diff].hp) {
      showToast('生命值已满，无需恢复！');
      return;
    }
    if (type === 'hint') {
      let targetIdx = gridData.findIndex(c => c.val === nextVal);
      if (targetIdx !== -1) {
        let cell = gridData[targetIdx];
        if (!cell.isHidden || cell.isRevealed) {
          showToast('下一个数字已出现，请在棋盘上寻找！');
          return;
        }
        if (cell.isHinted) {
          showToast('已为您提示下一个数字，请勿重复使用道具！');
          return;
        }
      }
    }

    if (!useInventory && !canAfford(cost)) {
      showToast('您的金币或道具不足！');
      return;
    }

    if (!useInventory) {
      openPurchasePrompt(type);
      return;
    }

    executeItemLogic(type, true);
  };

  const handleSaveAndExit = () => {
    const saveData = {
      playMode,
      diff,
      levelIdx,
      ...(isPortalMode(playMode) ? { portalLevelId: getPortalLevel(levelIdx).id } : {}),
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
  };

  const handleAbandonAndExit = () => {
    clearSavedGame();
    setShowExitPrompt(false);
    setView('levels');
  };

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

  // --- 全局 GM 浮窗系统 ---
  const onGmPointerDown = (e) => {
    gmDragRef.current.isDragging = true;
    gmDragRef.current.startX = e.clientX;
    gmDragRef.current.startY = e.clientY;
    gmDragRef.current.initialX = gmPos.x;
    gmDragRef.current.initialY = gmPos.y;
    e.target.setPointerCapture(e.pointerId);
  };
  
  const onGmPointerMove = (e) => {
    if (!gmDragRef.current.isDragging) return;
    setGmPos({
      x: gmDragRef.current.initialX + (e.clientX - gmDragRef.current.startX),
      y: gmDragRef.current.initialY + (e.clientY - gmDragRef.current.startY)
    });
  };
  
  const onGmPointerUp = (e) => {
    gmDragRef.current.isDragging = false;
    e.target.releasePointerCapture(e.pointerId);
  };

  const renderGmPanel = () => {
    if (!isDev || !showGmPanel) return null;
    return (
      <div 
        className="fixed bg-slate-900 border-2 border-emerald-500 rounded-xl p-3 shadow-2xl z-[9998] text-white cursor-move w-64 select-none opacity-95"
        style={{ left: gmPos.x, top: gmPos.y, touchAction: 'none' }}
        onPointerDown={onGmPointerDown}
        onPointerMove={onGmPointerMove}
        onPointerUp={onGmPointerUp}
        onPointerCancel={onGmPointerUp}
      >
        <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2 pointer-events-none">
          <h3 className="font-bold flex items-center gap-1 text-emerald-400 text-sm"><ShieldAlert size={16} /> GM 控制台</h3>
          <button onClick={() => setShowGmPanel(false)} className="pointer-events-auto active:scale-90 hover:bg-slate-800 p-1 rounded-md"><X size={16} /></button>
        </div>
        <div className="grid grid-cols-2 gap-2 pointer-events-auto">
          <button className="bg-slate-800 hover:bg-slate-700 p-2 rounded-lg text-xs active:scale-95 transition" onClick={() => setCoins(c => c + 99999)}>+99999 金币</button>
          <button className="bg-slate-800 hover:bg-slate-700 p-2 rounded-lg text-xs active:scale-95 transition" onClick={() => setItems({heal: 999, exclude: 999, hint: 999})}>道具 999</button>
          <button className="bg-slate-800 hover:bg-slate-700 p-2 rounded-lg text-xs active:scale-95 transition" onClick={() => {
            if (view !== 'game') { showToast('请在关卡内使用！'); return; }
            let n = [...gridData]; n.forEach(c => c.isRevealed = true);
            setGridData(n);
          }}>显示全图暗牌</button>
          <button className="bg-slate-800 hover:bg-slate-700 p-2 rounded-lg text-xs active:scale-95 transition" onClick={() => {
            if (view !== 'game') { showToast('请在关卡内使用！'); return; }
            let fullPath = [];
            let sorted = [...gridData].map((v, i) => ({v: v.val, i})).sort((a,b)=>a.v-b.v);
            sorted.forEach(x => fullPath.push(x.i));
            setPath(fullPath); setTimer(0);
            setTimeout(() => { handleWin(fullPath, maxComboStreak); }, 500);
          }}>一键通关</button>
        </div>
      </div>
    );
  };

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
      const modeProgressSummaries = GAME_MODE_LIST.reduce((summaries, mode) => ({
        ...summaries,
        [mode.id]: getModeCompletion({
          playMode: mode.id,
          progress,
          portalProgress
        })
      }), {});
      const modeProgress = isPortalMode(playMode) ? portalProgress : progress;
      const modeHighScores = isPortalMode(playMode) ? portalBestSteps : highScores;
      const levelSections = getLevelSections(playMode);
      const normalUnlockedThroughIndex = isPortalMode(playMode)
        ? -1
        : getNormalUnlockedThroughIndex(playMode, modeProgress);
      const levelEntries = levelSections.flatMap(section => (
        Array.from({ length: section.levelCount }).map((_, i) => ({
          diff: section.diff,
          levelIdx: i,
          displayLevelNumber: section.startLevelNumber + i
        }))
      ));
      
      const savedStr = localStorage.getItem(getSavedGameKey(playMode));
      let savedLevelInfo = null;
      if (savedStr) {
        try { savedLevelInfo = JSON.parse(savedStr); } catch {
          // Ignore corrupted saved game data.
        }
      }

      const levels = levelEntries.map(entry => {
        const portalModeSelected = isPortalMode(playMode);
        const stars = portalModeSelected
          ? getPortalStars(portalProgress, entry.diff, entry.levelIdx)
          : modeProgress[entry.diff]?.[entry.levelIdx] || 0;
        const savedPlayMode = savedLevelInfo?.playMode || playMode;
        const savedPortalLevelMatches = !portalModeSelected || (
          savedLevelInfo?.portalLevelId
            ? savedLevelInfo.portalLevelId === getPortalLevel(entry.levelIdx).id
            : savedLevelInfo?.levelIdx === entry.levelIdx
        );
        const hasSave = Boolean(
          savedLevelInfo
          && savedPlayMode === playMode
          && savedLevelInfo.diff === entry.diff
          && savedPortalLevelMatches
          && (portalModeSelected || savedLevelInfo.levelIdx === entry.levelIdx)
        );
        const linearLevelIndex = portalModeSelected
          ? -1
          : getNormalLevelLinearIndex(playMode, entry.diff, entry.levelIdx);
        const isUnlocked = portalModeSelected
          ? entry.levelIdx <= (portalProgress[entry.diff]?.unlockedIndex ?? 0)
          : linearLevelIndex <= normalUnlockedThroughIndex || hasSave;
        const bestResult = portalModeSelected
          ? getPortalBestSteps(portalBestSteps, entry.diff, entry.levelIdx)
          : modeHighScores[entry.diff]?.[entry.levelIdx] || 0;
        const isCompleted = stars > 0;

        return {
          ...entry,
          key: `${entry.diff}-${entry.levelIdx}`,
          stars,
          hasSave,
          isUnlocked,
          isCompleted,
          isCurrent: isUnlocked && !isCompleted,
          scoreLabel: bestResult > 0 ? (portalModeSelected ? `${bestResult}步` : `${bestResult}`) : '',
        };
      });

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
      const targetSteps = levelConfig.targetSteps;
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
          targetSteps={targetSteps}
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
      {renderGmPanel()}
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
