import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Info, CircleDollarSign, Ban,
  Lightbulb, X, RotateCcw, Heart,
  Settings, ChevronLeft, ShieldAlert, PlusCircle
} from 'lucide-react';
import { motion as Motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { comboMilestonePulse } from './config/motionPresets.js';
import GameToast from './components/GameToast.jsx';
import PuzzleBookPage from './components/PuzzleBookPage.jsx';
import WinPanel from './components/WinPanel.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import LosePanel from './components/LosePanel.jsx';
import RuleCard from './components/RuleCard.jsx';
import { HomePathMark } from './components/PuzzleMarks.jsx';
import {
  GAME_MODE_LIST,
  GAME_MODES,
  getGameModeConfig,
  getLevelsPerDiff,
  getSavedGameKey
} from './config/gameModes.js';
import { playComboTone, setSfxVolume } from './config/soundEngine.js';
import useRuleDiscovery from './hooks/useRuleDiscovery.js';
import useProgress from './hooks/useProgress.js';
import useInventory, { SHOP } from './hooks/useInventory.js';
import useGameSession, { getSavedGameResume } from './hooks/useGameSession.js';
import usePathInteraction from './hooks/usePathInteraction.js';
import { CONFIG } from './game/classic/createClassicLevel.js';
import { calculateLevelScoreReport } from './game/scoring/scoreEngine.js';
import {
  getAllowedDirections,
  getCellIndex,
  isInsideBoard
} from './game/rules/movement.js';
import { createLevelConfig, resolveRules } from './game/rules/levelConfig.js';
import {
  calculatePortalStars,
  getPortalBestSteps,
  getPortalLevel,
  getPortalLevelCount,
  getPortalStars,
  isPortalMode,
  normalizePortalBestStepsDiff,
  normalizePortalProgressDiff
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

const getNextLevelTarget = (playMode, diff, levelIdx) => {
  if (isPortalMode(playMode)) {
    return levelIdx + 1 < getPortalLevelCount() ? { diff, levelIdx: levelIdx + 1 } : null;
  }
  const sections = [
    { diff: 'easy', count: 10 },
    { diff: 'medium', count: 15 },
    { diff: 'hard', count: 20 }
  ];
  const section = sections.find(s => s.diff === diff);
  const sectionCount = section ? section.count : 10;
  if (levelIdx + 1 < sectionCount) {
    return { diff, levelIdx: levelIdx + 1 };
  }
  const idx = LEVEL_SECTION_ORDER.indexOf(diff);
  const nextDiff = LEVEL_SECTION_ORDER[idx + 1];
  return nextDiff ? { diff: nextDiff, levelIdx: 0 } : null;
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
  const handleWin = (completedPath = path, finalMaxCombo = maxComboStreak) => {
    markWon();
    playComboTone(999);

    const config = CONFIG[diff];
    const levelConfig = createLevelConfig(diff, levelIdx, playMode);

    if (levelConfig.portalLevel) {
      const levelId = levelConfig.portalLevel.id;
      const steps = completedPath.length - 1;
      const pathLength = completedPath.length;
      const stars = calculatePortalStars(steps, levelConfig.targetSteps);
      const currentBestSteps = portalBestSteps[diff]?.[levelId] || 0;
      const bestSteps = currentBestSteps > 0 ? Math.min(currentBestSteps, steps) : steps;

      setLevelReport({
        isPortal: true,
        steps,
        pathLength,
        bestSteps,
        targetSteps: levelConfig.targetSteps,
        stars,
        coinReward: 0
      });

      setPortalProgress(prev => {
        const currentDiff = normalizePortalProgressDiff(prev[diff]);
        const currentStars = currentDiff.starsById[levelId] || 0;
        return {
          ...prev,
          [diff]: {
            unlockedIndex: levelIdx + 1 < getLevelsPerDiff(playMode) ? Math.max(currentDiff.unlockedIndex, levelIdx + 1) : currentDiff.unlockedIndex,
            starsById: {
              ...currentDiff.starsById,
              [levelId]: Math.max(currentStars, stars)
            }
          }
        };
      });

      setPortalBestSteps(prev => {
        const currentDiff = normalizePortalBestStepsDiff(prev[diff]);
        const current = currentDiff[levelId] || 0;
        return {
          ...prev,
          [diff]: {
            ...currentDiff,
            [levelId]: !current || steps < current ? steps : current
          }
        };
      });
      return;
    }

    const scoreReport = calculateLevelScoreReport({
      config,
      gridData,
      baseScore: scoreRef.current,
      hp,
      timer,
      maxCombo: finalMaxCombo
    });

    const coinReward = config.coins + (scoreReport.stars * 5);
    const finalLevelScore = scoreReport.totalLevelScore;
    const stars = scoreReport.stars;

    setLevelReport({
      ...scoreReport,
      coinReward
    });

    setCoins(c => c + coinReward);
    setGlobalScore(prev => prev + finalLevelScore);

    const updateProgress = setProgress;
    const updateHighScores = setHighScores;
    const nextLevelTarget = getNextLevelTarget(playMode, diff, levelIdx);

    updateProgress(prev => {
      const nextProgress = {
        ...prev,
        [diff]: [...(prev[diff] || [])]
      };
      const newDiffProg = nextProgress[diff];
      if (!newDiffProg[levelIdx] || newDiffProg[levelIdx] < stars) newDiffProg[levelIdx] = stars;

      if (nextLevelTarget) {
        const nextDiffProgress = [...(nextProgress[nextLevelTarget.diff] || [])];
        if (typeof nextDiffProgress[nextLevelTarget.levelIdx] !== 'number') {
          nextDiffProgress[nextLevelTarget.levelIdx] = 0;
        }
        nextProgress[nextLevelTarget.diff] = nextDiffProgress;
      }

      return nextProgress;
    });

    updateHighScores(prev => {
      let newDiffScores = [...(prev[diff] || [])];
      const currentHS = newDiffScores[levelIdx] || 0;
      if (finalLevelScore > currentHS) {
        newDiffScores[levelIdx] = finalLevelScore;
      }
      return { ...prev, [diff]: newDiffScores };
    });
  };

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
    markLost,
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

  const handleRevive = () => {
    if (reviveWithCoins()) {
      setHp(CONFIG[diff].hp);
      setStatus('playing');
    } else {
      showToast('金币不足无法复活！');
    }
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
      const nextLevelTarget = getNextLevelTarget(playMode, diff, levelIdx);
      const displayLevelNumber = portalRun ? levelIdx + 1 : getNormalLevelLinearIndex(playMode, diff, levelIdx) + 1;

      const lines = [];
      for (let i = 0; i < path.length - 1; i++) {
        if (breakPoints.has(i + 1)) continue;
        const u = path[i], v = path[i + 1];
        const r1 = Math.floor(u / N), c1 = u % N;
        const r2 = Math.floor(v / N), c2 = v % N;
        const isPortalJump = gridData[u]?.portalId && gridData[u]?.portalId === gridData[v]?.portalId;
        if (isPortalJump) continue;

        const isLastSegment = (i + 1 === path.length - 1) || breakPoints.has(i + 2);
        let wClass = N > 7 ? "4" : "6";

        lines.push({
          x1: `${(c1 + 0.5) * (100 / N)}%`, y1: `${(r1 + 0.5) * (100 / N)}%`,
          x2: `${(c2 + 0.5) * (100 / N)}%`, y2: `${(r2 + 0.5) * (100 / N)}%`,
          wClass, isLastSegment
        });
      }
      const headIndex = path[path.length - 1];
      const headRow = Math.floor(headIndex / N);
      const headCol = headIndex % N;
      const headPoint = {
        x: `${(headCol + 0.5) * (100 / N)}%`,
        y: `${(headRow + 0.5) * (100 / N)}%`
      };

      const formatTime = (secs) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
      };


      function getCellClass(cell, idx, inPath, isHead, isError, portalId, isPortalEntryActive, isPortalExitActive, comboStreak) {
        if (isError) return "bg-rose-500/25 border border-rose-300/75 rounded-md";
        if (isHead) {
          if (comboStreak >= 7) return "bg-[#224740] border-2 border-[#b7e7dc] rounded-md";
          if (comboStreak >= 3) return "bg-[#1e3e38] border-2 border-[#9bd8ca] rounded-md";
          return "bg-[#1b3631] border-2 border-[#8acabc] rounded-md";
        }
        if (portalId && (isPortalEntryActive || isPortalExitActive)) {
          return "portal-token bg-violet-500/25 border border-violet-200/75 rounded-md";
        }
        if (portalId && inPath) return "portal-token bg-violet-500/12 border border-violet-300/35 rounded-md";
        if (portalId) return "portal-token bg-violet-500/12 border border-violet-300/40 rounded-md";
        if (cell.isHidden && !cell.isRevealed && cell.isHinted) return "bg-blue-500/20 border border-blue-300/60 rounded-md";
        if (cell.isHidden && !cell.isRevealed) return "bg-[#191f2a] border border-[#424b5a]/65 rounded-md";
        if (inPath) return "bg-[#1c2328]/45 border border-[#54746d]/25 rounded-md";
        return "bg-[#242b38] border border-[#566173]/80 rounded-md";
      }

      function getCellContent(cell, inPath, portalId) {
        if (portalId) return inPath ? cell.val : "?";
        if (cell.isExcluded) return null;
        if (cell.isHidden && !cell.isRevealed) return cell.isHinted ? cell.val : "";
        return cell.val;
      }

      function getCellTextClass(cell, inPath, portalId) {
        if (cell.isExcluded) return "text-rose-500";
        if (cell.isHidden && !cell.isRevealed) return cell.isHinted ? "text-[#f7edda]" : "text-transparent";
        if (portalId) return "text-[#f7edda]";
        return "text-[#f7edda]";
      }
      return (
        <div className="app-shell flex flex-col font-sans overflow-hidden relative" >
          

          {/* HUD */}
          <div className="flex items-center justify-between px-4 pt-4 pb-0 z-10 pointer-events-none">
            <div className="hud-surface flex items-center gap-1 px-1.5 py-1 pointer-events-auto">
              <button onClick={() => { if (status === 'playing') { if (path.length > 1) setShowExitPrompt(true); else { setView('levels'); localStorage.removeItem(getSavedGameKey(playMode)); } } else setView('levels'); }}
                className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:text-white active:scale-90"><ChevronLeft size={16} /></button>
              <button onClick={restartCurrentGame} title="重新开始"
                className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:text-white active:scale-90"><RotateCcw size={14} /></button>
            </div>
            <div className="hud-surface flex items-center gap-3 px-4 py-2 pointer-events-auto">
              <span className="text-slate-400 font-semibold text-[11px] whitespace-nowrap">{currentMode.name} · Lv {displayLevelNumber}</span>
              <span className="text-slate-300 font-mono font-semibold text-xs">{formatTime(timer)}</span>
              {portalRun ? (
                <span className="text-xs font-semibold text-violet-300/80 whitespace-nowrap">{path.length - 1}/{targetSteps}</span>
              ) : (
                <span className="text-xs font-bold text-slate-300 whitespace-nowrap">{score}<span className="text-[9px] text-slate-500 ml-0.5">分</span></span>
              )}
              {comboStreak >= 2 && (
                <AnimatePresence mode="wait">
                  <Motion.div
                    key={comboStreak}
                    className="combo-hud-value text-xs font-black text-[#9de0d0] whitespace-nowrap"
                    initial={prefersReducedMotion ? false : { scale: 0.88, opacity: 0.62 }}
                    animate={prefersReducedMotion ? {} : (
                      comboStreak === 5 || comboStreak === 10 || comboStreak === 20
                        ? comboMilestonePulse.animate
                        : { scale: [0.92, 1.12, 1], opacity: [0.65, 1, 1] }
                    )}
                    transition={prefersReducedMotion ? { duration: 0 } : (
                      comboStreak === 5 || comboStreak === 10 || comboStreak === 20
                        ? comboMilestonePulse.transition
                        : { duration: 0.24, ease: 'easeOut' }
                    )}
                  >
                    ×{comboStreak}
                  </Motion.div>
                </AnimatePresence>
              )}
            </div>
            <div className="hud-surface flex items-center gap-2.5 px-3 py-2 pointer-events-auto">
              <div className="flex items-center gap-1 text-amber-400/70 font-semibold text-xs"><CircleDollarSign size={13} />{coins}</div>
              <div className="flex items-center gap-1 text-rose-300/80 font-semibold text-xs"><Heart size={13} fill="currentColor" />{hp}</div>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-4 pt-2 relative">

            <AnimatePresence>
              {firstLevelHintMode === playMode && levelIdx === 0 && status === 'playing' && (
                <Motion.div
                  className="w-full max-w-md mb-2 text-center"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.28 }}
                >
                  <span className="text-[11px] text-slate-500/80 tracking-wide">
                    从 1 开始按顺序连接，用路径位置推理隐藏数字
                  </span>
                </Motion.div>
              )}
            </AnimatePresence>

            <div 
              ref={containerRef}
              className={`board-sketch relative w-full max-w-md aspect-square mx-2 p-2 touch-none select-none border ${isPathCompleting ? 'board-completing' : ''}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onContextMenu={e => e.preventDefault()}
            >
              <svg className="game-path-layer absolute inset-0 w-full h-full pointer-events-none z-[15]" style={{ padding: '0.25rem' }}>
                {lines.map((l, i) => (
                  <React.Fragment key={i}>
                    <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                      stroke="#112a27" strokeWidth={Number(l.wClass) + 10} strokeLinecap="round"
                      opacity="0.55"
                      className="path-line-depth"
                    />
                    <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                      stroke="#9bdccd" strokeWidth={Number(l.wClass) + 2.5} strokeLinecap="round"
                      pathLength="1"
                      className={`path-line-main ${l.isLastSegment ? 'path-line-new' : ''}`}
                    />
                    <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                      stroke="#edf8f5" strokeWidth={Math.max(Number(l.wClass) - 2, 1.8)} strokeLinecap="round"
                      opacity="0.40"
                      transform="translate(0.7 -0.5)"
                      className="path-line-highlight"
                    />
                    {isPathCompleting && (
                      <line
                        x1={l.x1}
                        y1={l.y1}
                        x2={l.x2}
                        y2={l.y2}
                        stroke="#f3ddb0"
                        strokeWidth={Number(l.wClass) + 4}
                        strokeLinecap="round"
                        pathLength="1"
                        className="path-completion-trace"
                        style={{
                          animationDelay: `${100 + Math.round((i / Math.max(lines.length, 1)) * 560)}ms`
                        }}
                      />
                    )}
                  </React.Fragment>
                ))}
                {!isPathCompleting && [...breakPoints].map(bp => {
                  if (bp <= 0 || bp >= path.length) return null;
                  const ci = path[bp];
                  const cr = Math.floor(ci / N);
                  const cc = ci % N;
                  const isHead = bp === path.length - 1;
                  if (isHead) return null;
                  return (
                    <circle
                      key={`seg-start-${bp}`}
                      cx={`${(cc + 0.5) * (100 / N)}%`}
                      cy={`${(cr + 0.5) * (100 / N)}%`}
                      r={N > 7 ? 2.2 : 3.0}
                      fill="none"
                      stroke="#8cccb9"
                      strokeWidth="1.2"
                      opacity="0.45"
                    />
                  );
                })}
                {isPathCompleting && (
                  <g className="path-completion-finish" style={{ animationDelay: '700ms' }}>
                    <circle cx={headPoint.x} cy={headPoint.y} r={N > 7 ? 7 : 10} className="path-finish-ring" />
                    <circle cx={headPoint.x} cy={headPoint.y} r={N > 7 ? 2.5 : 3.5} className="path-finish-dot" />
                  </g>
                )}
              </svg>

              <div className="w-full h-full" style={{ display: 'grid', gridTemplateColumns: `repeat(${N}, 1fr)`, gridTemplateRows: `repeat(${N}, 1fr)` }}>
                {gridData.map((cell, idx) => {
                  const inPath = path.includes(idx);
                  const isCompleteState = status === 'won' || isPathCompleting || path.length === N * N;
                  const isHead = !isCompleteState && path[path.length - 1] === idx;
                  const isError = wrongFlash === idx;
                  const portalId = cell.portalId;
                  const isPortalEntryActive = activePortal?.entryIndex === idx;
                  const isPortalExitActive = activePortal?.exitIndex === idx;

                  const bgClass = getCellClass(cell, idx, inPath, isHead, isError, portalId, isPortalEntryActive, isPortalExitActive, comboStreak);
                  const textClass = getCellTextClass(cell, inPath, portalId);
                  const content = getCellContent(cell, inPath, portalId);

                  return (
                    <Motion.div
                      key={idx}
                      className="p-0.5 md:p-1"
                      data-index={idx}
                      whileTap={{ scale: 0.9, transition: { duration: 0.08 } }}
                      animate={isError ? { x: [0, -4, 4, -2, 2, 0] } : {}}
                      transition={isError ? { duration: 0.3 } : {}}
                    >
                      <div
                        data-index={idx}
                        className={`cell-token relative w-full h-full flex items-center justify-center font-bold
                          ${N === 5 ? 'text-3xl' : N === 7 ? 'text-2xl' : 'text-lg'}
                          ${bgClass} ${textClass}
                          ${inPath ? 'path-visited' : ''}
                          ${isHead ? 'path-head' : ''}
                          ${lastConnectedIndex === idx ? 'connection-pop' : ''}
                          ${isPortalExitActive ? 'ring-2 ring-violet-300/50 scale-[1.03]' : ''}
                        `}
                      >
                        {cell.isExcluded
                          ? <X data-index={idx} className="cell-number text-rose-500 absolute" size={N > 7 ? 20 : 32} />
                          : <span data-index={idx} className="cell-number">{content}</span>}
                      </div>
                    </Motion.div>
                  );
                })}
              </div>
              {connectionFeedback && (
                <Motion.div
                  key={connectionFeedback.id}
                  className={`connection-float pointer-events-none absolute z-50 ${connectionFeedback.milestone ? 'connection-float-milestone' : ''}`}
                  style={connectionFeedback.style}
                  initial={prefersReducedMotion ? { opacity: 0.9 } : { opacity: 0, y: 5, scale: 0.68 }}
                  animate={prefersReducedMotion ? { opacity: 0.9 } : { opacity: [0, 1, 1, 0], y: [5, -4, -22, -38], scale: [0.68, 1.24, 1.08, 0.98] }}
                  transition={{ duration: prefersReducedMotion ? 0.2 : 0.58, ease: [0.2, 0.75, 0.25, 1] }}
                >
                  {connectionFeedback.label}
                </Motion.div>
              )}
            </div>
            
            <div className="mt-6 flex justify-between w-full max-w-md px-2 text-slate-500 font-medium text-xs">
              <div>路径长度: <span className="text-slate-300 text-lg font-semibold">{path.length}</span> / {N * N}</div>
              {portalRun ? (
                <div className="text-violet-300/70 font-semibold">目标: {targetSteps} 步</div>
              ) : (
                <div className="text-slate-400">步数: {path.length} / {N * N}</div>
              )}
            </div>
          </div>

          {/* Item Dock */}
          <div className="flex justify-center gap-4 z-10 pt-2 pb-4 px-4">
            {[
              { id: 'heal', icon: PlusCircle, name: '恢复', desc: '恢复 1 点生命值', color: 'text-[#80b789]' },
              { id: 'exclude', icon: Ban, name: '排除', desc: '排查出一个错误干扰', color: 'text-[#c08386]' },
              { id: 'hint', icon: Lightbulb, name: '提示', desc: '点亮下一步的数字', color: 'text-[#d0b66e]' }
            ].map(item => (
              <button key={item.id} onClick={() => handleUseItem(item.id)}
                      className="group flex flex-col items-center gap-1 relative transition-transform active:scale-90">
                <div className="absolute -top-9 opacity-0 group-hover:opacity-100 bg-[#151b24] text-slate-200 text-[10px] px-2 py-1 rounded pointer-events-none whitespace-nowrap z-10 border border-white/[0.08] transition-opacity">
                  {item.desc}
                </div>
                <div className="item-token w-14 h-14 flex items-center justify-center relative bg-[#212430] border border-[#666170]/75">
                  <item.icon className={item.color} size={22} />
                  {items[item.id] > 0 ? (
                    <span className="absolute -top-1.5 -right-1.5 bg-teal-700 text-teal-50 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{items[item.id]}</span>
                  ) : (
                    <span className="absolute -bottom-1 bg-slate-900 text-slate-500 text-[10px] font-bold px-1 py-0 rounded-full border border-slate-700 flex items-center gap-0.5">
                      <CircleDollarSign size={9} /> {SHOP[item.id]}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-[#827b6e] font-medium">{item.name}</span>
              </button>
            ))}
          </div>

          {purchasePrompt && (
            <div className="absolute inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
              <div className="surface-panel p-7 max-w-sm w-full text-center animate-in zoom-in duration-200">
                <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center justify-center gap-2">
                  <CircleDollarSign size={28} /> 购买道具
                </h2>
                <p className="text-slate-300 mb-8 leading-relaxed">
                  您即将花费 <span className="text-yellow-400 font-bold">{purchasePrompt.cost} 金币</span> <br/>
                  购买道具 <span className="text-teal-300 font-bold">“{purchasePrompt.name}”</span><br/>
                  是否确认？
                </p>
                <div className="flex gap-4">
                  <button onClick={closePurchasePrompt} className="button-secondary flex-1 py-3">取消</button>
                  <button onClick={() => {
                    const purchased = buyPromptItem();
                    if (purchased) showToast(`成功购买道具“${purchased.name}”！`);
                  }} className="flex-1 bg-amber-500 hover:bg-amber-400 transition-colors text-slate-950 py-3 rounded-xl font-bold active:scale-[0.98]">确认购买</button>
                </div>
              </div>
            </div>
          )}
          {showExitPrompt && (
            <div className="absolute inset-0 bg-black/80 z-[75] flex items-center justify-center p-4">
              <div className="surface-panel p-7 max-w-sm w-full text-center">
                <h2 className="text-xl font-bold text-slate-100 mb-3">退出当前关卡？</h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-7">
                  可以保存当前进度稍后继续，或放弃本局返回关卡列表。
                </p>
                <div className="space-y-3">
                  <button onClick={handleSaveAndExit} className="button-primary w-full py-3.5">
                    保存并退出
                  </button>
                  <button onClick={handleAbandonAndExit} className="w-full bg-rose-950/35 hover:bg-rose-950/50 text-rose-300/90 border border-rose-800/40 py-3 rounded-xl font-bold active:scale-[0.98] transition-colors">
                    放弃并退出
                  </button>
                  <button onClick={() => setShowExitPrompt(false)} className="w-full text-slate-400 hover:text-white py-2 text-sm font-bold">
                    继续游戏
                  </button>
                </div>
              </div>
            </div>
          )}
          {status !== 'playing' && (

            <div className="absolute inset-0 bg-black/80 z-[80] flex items-center justify-center p-4">
              {status === 'won' && levelReport ? (
                <WinPanel 
                   report={levelReport} 
                   levelIdx={levelIdx} 
                   maxLevelCount={getLevelsPerDiff(playMode)}
                   hasNextLevel={Boolean(nextLevelTarget)}
                   onBack={() => { setView('levels'); clearSavedGame(); }}
                   onNext={() => {
                     if (nextLevelTarget) startGame(nextLevelTarget.diff, nextLevelTarget.levelIdx, playMode);
                   }}
                   onRetry={restartCurrentGame}
                   onModeSelect={() => { resetRuleDiscovery(); clearSavedGame(); setView('levels'); }}
                />
              ) : (
                <LosePanel onRevive={handleRevive} onRestart={restartCurrentGame} onBackToLevels={() => { setView('levels'); clearSavedGame(); }} />
              )}
            </div>
          )}
        </div>
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
