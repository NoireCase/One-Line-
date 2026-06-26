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
  PLAY_MODES,
  getGameModeConfig,
  getLevelsPerDiff,
  getSavedGameKey
} from './config/gameModes.js';
import { findTriggeredDiscovery } from './config/ruleDiscoveries.js';
import { computeComboState, getComboMultiplier } from './config/comboEngine.js';
import { playComboTone, playErrorTone, playVictoryChime, resumeAudioContext, setSfxVolume } from './config/soundEngine.js';
import { CONFIG, createClassicLevel } from './game/classic/createClassicLevel.js';
import { calculateLevelScoreReport } from './game/scoring/scoreEngine.js';
import {
  canMoveBetween,
  getAllowedDirections,
  getCellIndex,
  hasPathCrossing,
  isInsideBoard
} from './game/rules/movement.js';
import { isPathComplete } from './game/rules/pathCompletion.js';
import { createLevelConfig, resolveRules } from './game/rules/levelConfig.js';
import {
  calculatePortalStars,
  createActivePortal,
  createDefaultPortalBestSteps,
  createDefaultPortalProgress,
  createPortalGrid,
  deriveActivePortal,
  getPortalBestSteps,
  getPortalLevel,
  getPortalLevelCount,
  getPortalLevelIndexById,
  getPortalStars,
  isPortalMode,
  normalizePortalBestSteps,
  normalizePortalBestStepsDiff,
  normalizePortalProgress,
  normalizePortalProgressDiff
} from './game/portal/portalRules.js';

const SHOP = { heal: 15, exclude: 15, hint: 25, revive: 30 };
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

const getSavedGameResume = () => {
  const savedGames = GAME_MODE_LIST.flatMap(mode => {
    try {
      const savedStr = localStorage.getItem(getSavedGameKey(mode.id));
      if (!savedStr) return [];

      const saved = JSON.parse(savedStr);
      const savedPlayMode = saved.playMode || mode.id;
      const savedLevelIdx = (
        isPortalMode(mode.id) && saved.portalLevelId
          ? getPortalLevelIndexById(saved.portalLevelId)
          : saved.levelIdx
      );
      const isValidSave = (
        savedPlayMode === mode.id
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

      return isValidSave ? [{ ...saved, playMode: savedPlayMode, levelIdx: savedLevelIdx }] : [];
    } catch {
      return [];
    }
  });

  return savedGames.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))[0] || null;
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
  const [playMode, setPlayMode] = useState(PLAY_MODES.classic);
  const [diff, setDiff] = useState('easy');
  const [levelIdx, setLevelIdx] = useState(0);
  const [resumeGame, setResumeGame] = useState(() => getSavedGameResume());
  const [firstLevelHintMode, setFirstLevelHintMode] = useState(null);
  const seenFirstLevelHintRef = useRef({});

  // 全局经济、进度与全局积分池系统
  const [coins, setCoins] = useState(100);
  const [items, setItems] = useState({ heal: 3, exclude: 3, hint: 3 });
  const [progress, setProgress] = useState({ easy: [0], medium: [], hard: [] });
  const [highScores, setHighScores] = useState({ easy: [], medium: [], hard: [] });
  const [portalProgress, setPortalProgress] = useState(() => createDefaultPortalProgress());
  const [portalBestSteps, setPortalBestSteps] = useState(() => createDefaultPortalBestSteps());
  const [globalScore, setGlobalScore] = useState(0);

  // 设置菜单与音量
  const [showSettings, setShowSettings] = useState(false);
  const [sfxVol, setSfxVol] = useState(100);
  const [musicVol, setMusicVol] = useState(100);

  // 全局浮窗提示与二级确认框
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);
  const [purchasePrompt, setPurchasePrompt] = useState(null);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [ruleDiscovery, setRuleDiscovery] = useState(null);
  
  const showToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 1800);
  }, []);

  // 游戏内核心状态
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
  // 输入模式
  const [inputMode, setInputMode] = useState(() => {
    try { return localStorage.getItem('cg_input_mode') || 'mouse'; }
    catch { return 'mouse'; }
  });

  // 分数与连击 (Combo) 引擎 —— 纯 path 推导
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [comboStreak, setComboStreak] = useState(0);
  const [maxComboStreak, setMaxComboStreak] = useState(0);
  const [connectionFeedback, setConnectionFeedback] = useState(null);
  const [lastConnectedIndex, setLastConnectedIndex] = useState(null);
  const [isPathCompleting, setIsPathCompleting] = useState(false);
  const [levelReport, setLevelReport] = useState(null);
  const [activePortal, setActivePortal] = useState(null);
  
  // 兼容旧 savedGame 中的 maxCombo 字段
  const maxCombo = maxComboStreak;
  // 开发环境 GM 工具与拖拽状态
  const isDev = import.meta.env.DEV;
  const [showGmPanel, setShowGmPanel] = useState(false);
  const [gmPos, setGmPos] = useState({ x: 20, y: 80 });
  const gmDragRef = useRef({ isDragging: false, startX: 0, startY: 0, initialX: 0, initialY: 0 });

  const isDraggingRef = useRef(false);
  const containerRef = useRef(null);
  const timerRef = useRef(null);
  const lastProcessedRef = useRef(null);
  const completionTimeoutRef = useRef(null);
  const feedbackIdRef = useRef(0);
  const connectedPulseTimeoutRef = useRef(null);

  useEffect(() => () => {
    if (completionTimeoutRef.current) clearTimeout(completionTimeoutRef.current);
    if (connectedPulseTimeoutRef.current) clearTimeout(connectedPulseTimeoutRef.current);
  }, []);

  // 初始化拦截与本地存储
  useEffect(() => {
    try {
      const sCoins = localStorage.getItem('cg_coins');
      if (sCoins) setCoins(parseInt(sCoins));
      const sItems = localStorage.getItem('cg_items');
      if (sItems) setItems(JSON.parse(sItems));
      const sProg = localStorage.getItem(GAME_MODES[PLAY_MODES.classic].progressKey);
      if (sProg) setProgress(JSON.parse(sProg));
      const sHighScores = localStorage.getItem(GAME_MODES[PLAY_MODES.classic].highScoresKey);
      if (sHighScores) setHighScores(JSON.parse(sHighScores));
      const sPortalProg = localStorage.getItem(GAME_MODES[PLAY_MODES.portal].progressKey);
      if (sPortalProg) setPortalProgress(normalizePortalProgress(JSON.parse(sPortalProg)));
      const sPortalBestSteps = localStorage.getItem(GAME_MODES[PLAY_MODES.portal].highScoresKey);
      if (sPortalBestSteps) setPortalBestSteps(normalizePortalBestSteps(JSON.parse(sPortalBestSteps)));
      const sScore = localStorage.getItem('cg_global_score');
      if (sScore) setGlobalScore(parseInt(sScore));

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

  useEffect(() => {
    localStorage.setItem('cg_coins', coins.toString());
    localStorage.setItem('cg_items', JSON.stringify(items));
    localStorage.setItem(GAME_MODES[PLAY_MODES.classic].progressKey, JSON.stringify(progress));
    localStorage.setItem(GAME_MODES[PLAY_MODES.classic].highScoresKey, JSON.stringify(highScores));
    localStorage.setItem(GAME_MODES[PLAY_MODES.portal].progressKey, JSON.stringify(portalProgress));
    localStorage.setItem(GAME_MODES[PLAY_MODES.portal].highScoresKey, JSON.stringify(portalBestSteps));
    localStorage.setItem('cg_global_score', globalScore.toString());
  }, [coins, items, progress, highScores, portalProgress, portalBestSteps, globalScore]);

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
  }, [globalScore, showToast]);

  useEffect(() => {
    if (timerRunning && status === 'playing') {
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerRunning, status]);

  // WASD 键盘模式 —— 8方向即时移动（50ms 防抖合并组合键）
  useEffect(() => {
    if (inputMode !== 'keyboard' || status !== 'playing') return;

    let active = { up: false, down: false, left: false, right: false };
    let moveTimer = null;

    const resolveDirection = () => {
      const v = active.up && !active.down ? 'up' : !active.up && active.down ? 'down' : null;
      const h = active.left && !active.right ? 'left' : !active.left && active.right ? 'right' : null;
      if (v === 'up' && h === 'left') return [-1, -1];
      if (v === 'up' && h === 'right') return [-1, 1];
      if (v === 'down' && h === 'left') return [1, -1];
      if (v === 'down' && h === 'right') return [1, 1];
      if (v === 'up') return [-1, 0];
      if (v === 'down') return [1, 0];
      if (h === 'left') return [0, -1];
      if (h === 'right') return [0, 1];
      return null;
    };

    const attemptMove = (dir) => {
      if (!dir) return;
      const currentPath = pathRef.current;
      const head = currentPath[currentPath.length - 1];
      if (head == null) return;
      const currentDiff = diffRef.current;
      const currentLevelIdx = levelIdxRef.current;
      const currentPlayMode = playModeRef.current;
      const levelConfig = createLevelConfig(currentDiff, currentLevelIdx, currentPlayMode);
      const N = levelConfig.portalLevel?.N || CONFIG[currentDiff]?.N || 5;
      const row = Math.floor(head / N);
      const col = head % N;
      const nr = row + dir[0];
      const nc = col + dir[1];
      if (nr < 0 || nr >= N || nc < 0 || nc >= N) return;
      const targetIdx = nr * N + nc;
      // 键盘不允许回退到上一格（回退是鼠标专用交互）
      if (currentPath.length > 1 && targetIdx === currentPath[currentPath.length - 2]) return;
      processCellInteractionRef.current(targetIdx);
    };

    const scheduleMove = () => {
      if (moveTimer) clearTimeout(moveTimer);
      const dir = resolveDirection();
      if (!dir) return;
      moveTimer = setTimeout(() => {
        moveTimer = null;
        const finalDir = resolveDirection();
        if (finalDir) attemptMove(finalDir);
      }, 50);
    };

    const handleKeyDown = (e) => {
      if (e.repeat) return;
      switch (e.key) {
        case 'w': case 'W': active.up = true; e.preventDefault(); break;
        case 'a': case 'A': active.left = true; e.preventDefault(); break;
        case 's': case 'S': active.down = true; e.preventDefault(); break;
        case 'd': case 'D': active.right = true; e.preventDefault(); break;
        default: return;
      }
      if (active.up && active.down) { active.up = false; active.down = false; }
      if (active.left && active.right) { active.left = false; active.right = false; }
      scheduleMove();
    };

    const handleKeyUp = (e) => {
      switch (e.key) {
        case 'w': case 'W': active.up = false; break;
        case 'a': case 'A': active.left = false; break;
        case 's': case 'S': active.down = false; break;
        case 'd': case 'D': active.right = false; break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (moveTimer) clearTimeout(moveTimer);
    };
  }, [inputMode, status]);
  // Combo 由 path 事件驱动，不再依赖 stroke 结算

  useEffect(() => {
    if (!firstLevelHintMode || status !== 'playing') return;
    const timer = setTimeout(() => setFirstLevelHintMode(null), 6000);
    return () => clearTimeout(timer);
  }, [firstLevelHintMode, status]);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (isDraggingRef.current) {
        setPendingVisualBreak(true);
      }
      setIsDragging(false);
      lastProcessedRef.current = null;
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, []);

  const initGame = useCallback((targetDiff, targetLevel, options = {}) => {
    const { clearSavedGame = true, targetPlayMode = PLAY_MODES.classic } = options;
    if (completionTimeoutRef.current) {
      clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }
    if (connectedPulseTimeoutRef.current) clearTimeout(connectedPulseTimeoutRef.current);
    setIsPathCompleting(false);
    setConnectionFeedback(null);
    setLastConnectedIndex(null);
    if (clearSavedGame) {
      localStorage.removeItem(getSavedGameKey(targetPlayMode));
      setResumeGame(getSavedGameResume());
    }
    const levelConfig = createLevelConfig(targetDiff, targetLevel, targetPlayMode);
    const rules = resolveRules(levelConfig);
    const portalLevel = levelConfig.portalLevel;

    if (portalLevel) {
      const newGrid = createPortalGrid(portalLevel);
      setGridData(newGrid);
      setPath([portalLevel.path[0]]);
      setHp(CONFIG.easy.hp);
      setTimer(0);
      setTimerRunning(false);
      setStatus('playing');
      setWrongFlash(null);
      setIsDragging(false);

      scoreRef.current = 0;
      setScore(0);
      setComboStreak(0);
      setMaxComboStreak(0);
      setConnectionFeedback(null);
      setLastConnectedIndex(null);
      setBreakPoints(new Set());
      setPendingVisualBreak(false);
      setLevelReport(null);
      setActivePortal(null);
      lastProcessedRef.current = null;
      return;
    }

    const classicLevel = createClassicLevel(targetDiff, targetLevel, rules, targetPlayMode);
    setGridData(classicLevel.grid);
    setPath([classicLevel.startIndex]);
    setHp(classicLevel.config.hp);
    setTimer(0);
    setTimerRunning(false);
    setStatus('playing');
    setWrongFlash(null);
    setIsDragging(false);
    
    scoreRef.current = 0;
    setScore(0);
    setComboStreak(0);
    setMaxComboStreak(0);
    setConnectionFeedback(null);
    setLastConnectedIndex(null);
    setBreakPoints(new Set());
    setPendingVisualBreak(false);
    setLevelReport(null);
    setActivePortal(null);
    lastProcessedRef.current = null;
  }, []);

  const startGame = (d, lvl, targetPlayMode = playMode) => {
    const discovery = findTriggeredDiscovery(targetPlayMode, d, lvl);
    if (discovery) {
      if (discovery.id === 'portal') {
        resumeAudioContext();
        setPlayMode(targetPlayMode);
        setDiff(d);
        setLevelIdx(lvl);
        setView('game');
        initGame(d, lvl, { clearSavedGame: true, targetPlayMode });
      }
      setRuleDiscovery({ discovery, d, lvl, targetPlayMode });
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
        const targetPortalLevelId = isPortalMode(targetPlayMode) ? getPortalLevel(lvl).id : null;
        const savedPortalLevelMatches = !isPortalMode(targetPlayMode) || (saved.portalLevelId ? saved.portalLevelId === targetPortalLevelId : saved.levelIdx === lvl);
        if (saved.diff === d && savedPlayMode === targetPlayMode && savedPortalLevelMatches && (isPortalMode(targetPlayMode) || saved.levelIdx === lvl)) {
          if (completionTimeoutRef.current) {
            clearTimeout(completionTimeoutRef.current);
            completionTimeoutRef.current = null;
          }
          setIsPathCompleting(false);
          setConnectionFeedback(null);
          setLastConnectedIndex(null);
          setBreakPoints(new Set());
          setPendingVisualBreak(false);
          setGridData(saved.gridData);
          setPath(saved.path);
          setHp(saved.hp);
          setTimer(saved.timer);
          setActivePortal(saved.activePortal || deriveActivePortal(saved.gridData || [], saved.path || []));
          
          scoreRef.current = saved.score || 0;
          setScore(saved.score || 0);
          const savedCombo = saved.maxCombo || 0;
          setComboStreak(savedCombo > 0 ? savedCombo : 0);
          setMaxComboStreak(savedCombo > 0 ? savedCombo : 0);
          
          setTimerRunning(false); 
          setStatus('playing');
          setWrongFlash(null);
          setIsDragging(false);
          lastProcessedRef.current = null;
          setView('game');
          return;
        }
      } catch {
        // Ignore corrupted saved game data and start a fresh run.
      }
    }

    initGame(d, lvl, { targetPlayMode });
    setView('game');
  };

  const handleRuleCardStart = () => {
    if (!ruleDiscovery) return;
    const { discovery, d, lvl, targetPlayMode } = ruleDiscovery;
    localStorage.setItem(discovery.storageKey, "true");
    setRuleDiscovery(null);
    if (discovery.id === 'portal') return; // game already initialized
    startGame(d, lvl, targetPlayMode);
  };
  const getCellIndexFromEvent = (e) => {
    const touch = e.touches ? e.touches[0] : e;
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (el) {
      const idxStr = el.getAttribute('data-index');
      if (idxStr != null) {
        const rect = el.getBoundingClientRect();
        const dist = Math.sqrt((touch.clientX - (rect.left + rect.width / 2)) ** 2 + (touch.clientY - (rect.top + rect.height / 2)) ** 2);
        if (dist < Math.min(rect.width, rect.height) * 0.45) return Number(idxStr);
      }
    }
    return null;
  };

  const handlePointerDown = (e) => {
    if (status !== 'playing') return;
    resumeAudioContext();
    const idx = getCellIndexFromEvent(e);
    if (idx !== null && idx === path[path.length - 1]) {
      e.target.releasePointerCapture?.(e.pointerId);
      setWrongFlash(null);
      setIsDragging(true);
      lastProcessedRef.current = idx;
    }
  };

  const handlePointerMove = (e) => {
    if (!isDragging || status !== 'playing') return;
    const idx = getCellIndexFromEvent(e);
    if (idx !== null && idx !== lastProcessedRef.current) {
      processCellInteraction(idx);
      lastProcessedRef.current = idx;
    }
  };

  const handlePointerUp = () => {
    if (isDragging && path.length > 0) {
      setPendingVisualBreak(true);
    }
    setIsDragging(false);
    lastProcessedRef.current = null;
  };

  const processCellInteraction = (index) => {
    if (isPathCompleting) return;
    const currentTip = path[path.length - 1];
    const levelConfig = createLevelConfig(diff, levelIdx, playMode);
    const N = levelConfig.portalLevel?.N || CONFIG[diff].N;
    const rules = resolveRules(levelConfig);
    if (index === currentTip) return;

    if (path.includes(index)) return;

    const portalExitRequired = rules.portal && activePortal?.entryIndex === currentTip && !path.includes(activePortal.exitIndex);
    const completingActivePortal = portalExitRequired && index === activePortal.exitIndex;

    if (portalExitRequired && !completingActivePortal) {
      return;
    }

    if (!completingActivePortal) {
      if (!canMoveBetween(currentTip, index, N, rules)) return;
      if (hasPathCrossing(path, currentTip, index, N, rules)) return;
    }

    const nextVal = path.length + 1;
    const targetCell = gridData[index];

    if (targetCell.val === nextVal) {
      if (pendingVisualBreak) {
        setBreakPoints(prev => new Set([...prev, path.length]));
        setPendingVisualBreak(false);
      }
      if (!timerRunning) setTimerRunning(true);
      const nextPath = [...path, index];
      setPath(nextPath);

      let wasHidden = targetCell.isHidden && !targetCell.isRevealed;

      setGridData(prev => {
        let nd = [...prev];
        nd[index] = { ...nd[index], isRevealed: true, isExcluded: false };
        return nd;
      });

      // --- 分数与 Combo 累积（纯 path 驱动，在 if/else 之前计算）---
      const { streak: newStreak, max: newMax } = computeComboState(comboStreak, maxComboStreak, 'success');
      setComboStreak(newStreak);
      setMaxComboStreak(newMax);

      setLastConnectedIndex(index);
      if (connectedPulseTimeoutRef.current) clearTimeout(connectedPulseTimeoutRef.current);
      connectedPulseTimeoutRef.current = setTimeout(() => setLastConnectedIndex(null), 320);

      const feedbackId = `connection-${++feedbackIdRef.current}`;
      const feedbackRow = Math.floor(index / N);
      const feedbackCol = index % N;
      setConnectionFeedback({
        id: feedbackId,
        label: '+1',
        milestone: false,
        style: {
          left: `${((feedbackCol + 0.5) / N) * 100}%`,
          top: `${((feedbackRow + 0.24) / N) * 100}%`
        }
      });
      setTimeout(() => {
        setConnectionFeedback(current => current?.id === feedbackId ? null : current);
      }, prefersReducedMotion ? 260 : 620);

      if (rules.portal) {
        setActivePortal(completingActivePortal ? null : createActivePortal(index, gridData));
      } else {
        const multi = getComboMultiplier(newStreak);
        const basePoints = wasHidden ? 30 : 10;
        const earnedPoints = Math.floor(basePoints * multi);
        scoreRef.current += earnedPoints;
        setScore(scoreRef.current);

      }

      playComboTone(newStreak);
      if (isPathComplete(nextPath, N)) {
        playVictoryChime();
        setIsDragging(false);
        setIsPathCompleting(true);
        completionTimeoutRef.current = setTimeout(() => {
          completionTimeoutRef.current = null;
          handleWin(nextPath, newMax);
        }, prefersReducedMotion ? 140 : 900);
      }
    } else {
      if (path.includes(index) || targetCell.isExcluded) return;

      if (!targetCell.isHidden || targetCell.isRevealed) {
        if (wrongFlash !== index) {
          setWrongFlash(index);
          setTimeout(() => setWrongFlash(null), 300);
        }
        setBreakPoints(prev => new Set([...prev, path.length]));
        const { streak: fStreak } = computeComboState(comboStreak, maxComboStreak, 'failure');
        setComboStreak(fStreak);
        return;
      }

      playErrorTone();
      setWrongFlash(index);
      setTimeout(() => setWrongFlash(null), 300);
      setBreakPoints(prev => new Set([...prev, path.length]));

      const { streak: fStreak2 } = computeComboState(comboStreak, maxComboStreak, 'failure');
      setComboStreak(fStreak2);

      setHp(h => {
        const newHp = h - 1;
        if (newHp <= 0) setStatus('lost');
        return newHp;
      });
    }
  };

  // WASD refs（在 processCellInteraction 定义之后赋值，确保引用最新）
  const pathRef = useRef(path);
  pathRef.current = path;
  const diffRef = useRef(diff);
  diffRef.current = diff;
  const levelIdxRef = useRef(levelIdx);
  levelIdxRef.current = levelIdx;
  const playModeRef = useRef(playMode);
  playModeRef.current = playMode;
  const processCellInteractionRef = useRef(processCellInteraction);
  processCellInteractionRef.current = processCellInteraction;

  const handleWin = (completedPath = path, finalMaxCombo = maxComboStreak) => {
    setIsPathCompleting(false);
    setStatus('won');
    playComboTone(999);
    localStorage.removeItem(getSavedGameKey(playMode));
    setResumeGame(getSavedGameResume());

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
        setItems(p => ({ ...p, [type]: p[type] - 1 }));
      } else {
        setCoins(c => c - SHOP[type]);
        showToast(`已花费 ${SHOP[type]} 金币购买并使用道具！`);
      }
    }
  };

  const handleUseItem = (type) => {
    if (status !== 'playing') return;
    const cost = SHOP[type];
    const useInventory = items[type] > 0;
    
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

    if (!useInventory && coins < cost) {
      showToast('您的金币或道具不足！');
      return;
    }

    if (!useInventory) {
      const itemNames = { heal: '恢复', exclude: '排除', hint: '提示' };
      setPurchasePrompt({ type, cost, name: itemNames[type] });
      return;
    }

    executeItemLogic(type, true);
  };

  const handleRevive = () => {
    if (coins >= SHOP.revive) {
      setCoins(c => c - SHOP.revive);
      setHp(CONFIG[diff].hp);
      setStatus('playing');
    } else {
      showToast('金币不足无法复活！');
    }
  };

  const clearNormalSavedGame = () => {
    localStorage.removeItem(getSavedGameKey(playMode));
    setResumeGame(getSavedGameResume());
  };
  const restartCurrentGame = () => {
    initGame(diff, levelIdx, { clearSavedGame: true, targetPlayMode: playMode });
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
    clearNormalSavedGame();
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
                  <button onClick={() => setPurchasePrompt(null)} className="button-secondary flex-1 py-3">取消</button>
                  <button onClick={() => {
                    setCoins(c => c - purchasePrompt.cost);
                    setItems(p => ({ ...p, [purchasePrompt.type]: p[purchasePrompt.type] + 1 }));
                    showToast(`成功购买道具“${purchasePrompt.name}”！`);
                    setPurchasePrompt(null);
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
                   onBack={() => { setView('levels'); clearNormalSavedGame(); }}
                   onNext={() => {
                     if (nextLevelTarget) startGame(nextLevelTarget.diff, nextLevelTarget.levelIdx, playMode);
                   }}
                   onRetry={restartCurrentGame}
                   onModeSelect={() => { setRuleDiscovery(null); clearNormalSavedGame(); setView('levels'); }}
                />
              ) : (
                <LosePanel onRevive={handleRevive} onRestart={restartCurrentGame} onBackToLevels={() => { setView('levels'); clearNormalSavedGame(); }} />
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
