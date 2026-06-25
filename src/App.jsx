import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Info, Star, CircleDollarSign, Ban, 
  Lightbulb, Lock, X, RotateCcw, Heart,
  Settings, ChevronLeft, ShieldAlert, PlusCircle
} from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'motion/react';
import { comboMilestonePulse } from './config/motionPresets.js';
import FloatingScore, { createFloatingScore } from './components/FloatingScore.jsx';
import GameToast from './components/GameToast.jsx';
import ModeSelectPage from './components/ModeSelectPage.jsx';
import WinPanel from './components/WinPanel.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import LosePanel from './components/LosePanel.jsx';
import RuleCard from './components/RuleCard.jsx';
import { HomePathMark } from './components/PuzzleMarks.jsx';
import {
  GAME_MODE_LIST,
  GAME_MODES,
  MOVEMENT_TYPES,
  PLAY_MODES,
  getGameModeConfig,
  getLevelsPerDiff,
  getSavedGameKey,
  getClassicMovement,
  getClassicGridSize
} from './config/gameModes.js';
import { findTriggeredDiscovery } from './config/ruleDiscoveries.js';
import { computeComboState, getComboMultiplier } from './config/comboEngine.js';
import { playComboTone, playErrorTone, resumeAudioContext, setSfxVolume } from './config/soundEngine.js';

// --- 伪随机数生成器 (用于固定关卡布局) ---
function mulberry32(a) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

// --- 常量配置 (移除了写死的星级积分阈值) ---
const CONFIG = {
  easy: { N: 5, hiddenMin: 8, hiddenMax: 10, hp: 3, coins: 10, times: [30, 60], maxGap: 2 },
  medium: { N: 7, hiddenMin: 20, hiddenMax: 25, hp: 5, coins: 20, times: [90, 180], maxGap: 3 },
  hard: { N: 9, hiddenMin: 40, hiddenMax: 45, hp: 10, coins: 40, times: [300, 600], maxGap: 4 }
};

const SHOP = { heal: 15, exclude: 15, hint: 25, revive: 30 };
const LEVEL_SECTION_ORDER = ['easy', 'medium', 'hard'];
const ORTHOGONAL_DIRECTIONS = [
  [-1, 0],
  [0, -1],
  [0, 1],
  [1, 0]
];
const DIAGONAL_DIRECTIONS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1]
];
const ALL_DIRECTIONS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1]
];
const ORTHOGONAL_RULE = {
  id: 'classic',
  movement: MOVEMENT_TYPES.orthogonal,
  bridge: false,
  portal: false,
  obstacle: false,
  oneWay: false,
  path: {
    requireSequential: true,
    requireFullBoard: true,
    allowCrossing: false
  },
  scoring: {
    specialRuleBonus: false
  }
};
const DIAGONAL_RULE = {
  ...ORTHOGONAL_RULE,
  id: 'diagonal',
  movement: MOVEMENT_TYPES.diagonal
};
const PORTAL_RULE = {
  ...DIAGONAL_RULE,
  id: 'portal',
  portal: true
};
const RULE_BY_PLAY_MODE = {
  [PLAY_MODES.classic]: { ...ORTHOGONAL_RULE, movement: MOVEMENT_TYPES.orthogonal },
  ['diagonal']: { ...DIAGONAL_RULE, movement: MOVEMENT_TYPES.diagonal },
  [PLAY_MODES.portal]: { ...PORTAL_RULE, movement: MOVEMENT_TYPES.diagonal }
};
const SCORE_CONFIG = {
  visibleStep: 10,
  hiddenStep: 30,
  hpBonus: 500,
  timeBonus: 15,
  comboBonus: 50,
  starThresholds: {
    two: 0.6,
    three: 0.9
  }
};

const PORTAL_LEVELS = [
  {
    id: 'portal-alpha-easy-gate',
    name: '入口发现',
    N: 5,
    targetSteps: 24,
    path: [7, 2, 1, 0, 5, 6, 10, 15, 20, 21, 22, 16, 11, 24, 23, 19, 14, 18, 17, 12, 13, 9, 4, 8, 3],
    portals: [
      { id: 'A', cells: [24, 11] }
    ],
    hiddenVals: [6, 11, 18, 22]
  },
  {
    id: 'portal-alpha-easy-cutback',
    name: '折返缺口',
    N: 5,
    targetSteps: 24,
    path: [18, 24, 19, 14, 9, 4, 3, 8, 5, 0, 1, 2, 7, 13, 12, 6, 10, 11, 15, 20, 16, 21, 17, 22, 23],
    portals: [
      { id: 'A', cells: [5, 8] }
    ],
    hiddenVals: [5, 14, 19, 24]
  },
  {
    id: 'portal-bridge',
    name: '远端桥接',
    N: 5,
    targetSteps: 24,
    path: [0, 1, 6, 5, 10, 11, 24, 23, 22, 21, 20, 15, 16, 17, 18, 19, 14, 13, 12, 7, 4, 3, 2, 8, 9],
    portals: [
      { id: 'A', cells: [11, 24] },
      { id: 'B', cells: [7, 4] }
    ],
    hiddenVals: [10, 14, 17, 23]
  },
  {
    id: 'portal-alpha-normal-cross',
    name: '双门换区',
    N: 5,
    targetSteps: 24,
    path: [11, 10, 5, 23, 24, 19, 14, 9, 4, 3, 2, 8, 13, 7, 1, 0, 6, 18, 12, 17, 22, 16, 21, 15, 20],
    portals: [
      { id: 'A', cells: [5, 23] },
      { id: 'B', cells: [18, 6] }
    ],
    hiddenVals: [7, 12, 15, 22]
  },
  {
    id: 'portal-alpha-normal-return',
    name: '远端回收',
    N: 5,
    targetSteps: 24,
    path: [9, 4, 3, 2, 15, 20, 21, 22, 16, 10, 5, 0, 1, 6, 11, 7, 8, 12, 24, 23, 17, 13, 18, 14, 19],
    portals: [
      { id: 'A', cells: [2, 15] },
      { id: 'B', cells: [24, 12] }
    ],
    hiddenVals: [8, 13, 16, 22]
  },
  {
    id: 'portal-loopback',
    name: '回环折返',
    N: 5,
    targetSteps: 24,
    path: [0, 5, 10, 11, 12, 7, 2, 3, 4, 9, 14, 13, 8, 1, 6, 15, 20, 21, 16, 17, 18, 19, 24, 23, 22],
    portals: [
      { id: 'A', cells: [8, 1] },
      { id: 'B', cells: [6, 15] }
    ],
    hiddenVals: [9, 11, 19, 24]
  },
  {
    id: 'portal-islands',
    name: '分区穿梭',
    N: 5,
    targetSteps: 24,
    path: [0, 1, 2, 3, 4, 9, 14, 19, 24, 23, 5, 10, 15, 20, 21, 22, 17, 12, 7, 6, 18, 13, 8, 11, 16],
    portals: [
      { id: 'A', cells: [23, 5] },
      { id: 'B', cells: [6, 18] },
      { id: 'C', cells: [8, 11] }
    ],
    hiddenVals: [8, 13, 18, 21]
  },
  {
    id: 'portal-alpha-hard-relay',
    name: '三段接力',
    N: 5,
    targetSteps: 24,
    path: [7, 1, 0, 19, 24, 23, 22, 21, 20, 15, 2, 3, 4, 9, 8, 17, 16, 10, 5, 11, 6, 12, 13, 18, 14],
    portals: [
      { id: 'A', cells: [8, 17] },
      { id: 'B', cells: [15, 2] },
      { id: 'C', cells: [19, 0] }
    ],
    hiddenVals: [6, 12, 18, 21, 24]
  },
  {
    id: 'portal-chain',
    name: '连续跳转',
    N: 5,
    targetSteps: 24,
    path: [20, 15, 2, 3, 4, 9, 14, 19, 0, 1, 6, 5, 10, 11, 16, 21, 22, 17, 8, 13, 18, 23, 24, 12, 7],
    portals: [
      { id: 'A', cells: [15, 2] },
      { id: 'B', cells: [19, 0] },
      { id: 'C', cells: [17, 8] },
      { id: 'D', cells: [24, 12] }
    ],
    hiddenVals: [6, 12, 16, 22]
  }
];

const isPortalMode = (mode) => mode === PLAY_MODES.portal;

const getPortalLevel = (levelIdx) => PORTAL_LEVELS[levelIdx] || PORTAL_LEVELS[0];
const createDefaultPortalProgress = () => ({ easy: { unlockedIndex: 0, starsById: {} }, medium: { unlockedIndex: 0, starsById: {} }, hard: { unlockedIndex: 0, starsById: {} } });
const createDefaultPortalBestSteps = () => ({ easy: {}, medium: {}, hard: {} });

const normalizePortalProgressDiff = (value) => {
  if (Array.isArray(value)) {
    const starsById = {};
    value.forEach((stars, idx) => {
      const levelId = PORTAL_LEVELS[idx]?.id;
      if (levelId && stars > 0) starsById[levelId] = stars;
    });
    return { unlockedIndex: Math.max(value.length - 1, 0), starsById };
  }

  if (value && typeof value === 'object') {
    return {
      unlockedIndex: typeof value.unlockedIndex === 'number' ? value.unlockedIndex : 0,
      starsById: value.starsById && typeof value.starsById === 'object' && !Array.isArray(value.starsById) ? value.starsById : {}
    };
  }

  return { unlockedIndex: 0, starsById: {} };
};

const normalizePortalProgress = (saved) => {
  const defaults = createDefaultPortalProgress();
  return {
    easy: normalizePortalProgressDiff(saved?.easy ?? defaults.easy),
    medium: normalizePortalProgressDiff(saved?.medium ?? defaults.medium),
    hard: normalizePortalProgressDiff(saved?.hard ?? defaults.hard)
  };
};

const normalizePortalBestStepsDiff = (value) => {
  if (Array.isArray(value)) {
    return value.reduce((stepsById, steps, idx) => {
      const levelId = PORTAL_LEVELS[idx]?.id;
      if (levelId && steps > 0) stepsById[levelId] = steps;
      return stepsById;
    }, {});
  }

  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
};

const normalizePortalBestSteps = (saved) => ({
  easy: normalizePortalBestStepsDiff(saved?.easy),
  medium: normalizePortalBestStepsDiff(saved?.medium),
  hard: normalizePortalBestStepsDiff(saved?.hard)
});

const getPortalStars = (portalProgress, difficulty, levelIdx) => {
  const levelId = getPortalLevel(levelIdx).id;
  return portalProgress[difficulty]?.starsById?.[levelId] || 0;
};

const getPortalBestSteps = (portalBestSteps, difficulty, levelIdx) => {
  const levelId = getPortalLevel(levelIdx).id;
  return portalBestSteps[difficulty]?.[levelId] || 0;
};

const getLevelSections = (playMode) => {
  if (isPortalMode(playMode)) {
    return [{
      diff: 'easy',
      levelCount: 9,
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
    return levelIdx + 1 < 9 ? { diff, levelIdx: levelIdx + 1 } : null;
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
          ? PORTAL_LEVELS.findIndex(level => level.id === saved.portalLevelId)
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
    const total = 9;
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

const getPortalMap = (level) => {
  const portalMap = {};
  level.portals.forEach(portal => {
    portal.cells.forEach(cellIndex => {
      portalMap[cellIndex] = portal.id;
    });
  });
  return portalMap;
};

const getPortalExitIndex = (index, gridData) => {
  const portalId = gridData[index]?.portalId;
  if (!portalId) return null;
  return gridData.findIndex((cell, cellIndex) => cellIndex !== index && cell.portalId === portalId);
};

const createActivePortal = (entryIndex, gridData) => {
  const portalId = gridData[entryIndex]?.portalId;
  if (!portalId) return null;
  const exitIndex = getPortalExitIndex(entryIndex, gridData);
  if (exitIndex < 0) return null;
  return { portalId, entryIndex, exitIndex };
};

const deriveActivePortal = (gridData, path) => {
  const entryIndex = path[path.length - 1];
  const activePortal = createActivePortal(entryIndex, gridData);
  if (!activePortal || path.includes(activePortal.exitIndex)) return null;
  const exitCell = gridData[activePortal.exitIndex];
  return exitCell?.val === path.length + 1 ? activePortal : null;
};

const calculatePortalStars = (steps, targetSteps) => {
  if (steps <= targetSteps) return 3;
  if (steps <= targetSteps + 2) return 2;
  return 1;
};

const createLevelConfig = (difficulty, levelIdx, playMode = PLAY_MODES.classic) => {
  if (isPortalMode(playMode)) {
    return {
      id: `${playMode}-${difficulty}-${levelIdx + 1}`,
      difficulty,
      levelIdx,
      playMode,
      rules: PORTAL_RULE,
      portalLevel: getPortalLevel(levelIdx),
      targetSteps: getPortalLevel(levelIdx).targetSteps
    };
  }
  const movement = getClassicMovement(difficulty, levelIdx);
  const baseRules = movement === MOVEMENT_TYPES.orthogonal
    ? RULE_BY_PLAY_MODE[PLAY_MODES.classic]
    : RULE_BY_PLAY_MODE['diagonal'];
  const rules = { ...baseRules, movement };
  return {
    id: `classic-${difficulty}-${levelIdx + 1}`,
    difficulty,
    levelIdx,
    playMode,
    rules
  };
};

const resolveRules = (levelConfig) => levelConfig?.rules || DIAGONAL_RULE;

const getAllowedDirections = (rules) => {
  return rules.movement === MOVEMENT_TYPES.diagonal ? ALL_DIRECTIONS : ORTHOGONAL_DIRECTIONS;
};

const getCellPosition = (index, N) => ({
  r: Math.floor(index / N),
  c: index % N
});

const getCellIndex = (r, c, N) => r * N + c;

const isInsideBoard = (r, c, N) => r >= 0 && r < N && c >= 0 && c < N;

const isDiagonalDelta = (dr, dc) => Math.abs(dr) === 1 && Math.abs(dc) === 1;

const canMoveBetween = (fromIndex, toIndex, N, rules) => {
  const from = getCellPosition(fromIndex, N);
  const to = getCellPosition(toIndex, N);
  const dr = to.r - from.r;
  const dc = to.c - from.c;

  if (dr === 0 && dc === 0) return false;
  if (Math.abs(dr) > 1 || Math.abs(dc) > 1) return false;
  if (isDiagonalDelta(dr, dc) && rules.movement !== MOVEMENT_TYPES.diagonal) return false;
  return true;
};

const getCrossingKeys = (fromIndex, toIndex, N) => {
  const from = getCellPosition(fromIndex, N);
  const to = getCellPosition(toIndex, N);
  const dr = to.r - from.r;
  const dc = to.c - from.c;

  if (!isDiagonalDelta(dr, dc)) return [];

  const crossA = `${from.r},${to.c}-${to.r},${from.c}`;
  const crossB = `${to.r},${from.c}-${from.r},${to.c}`;
  return [crossA, crossB];
};

const getSegmentKeys = (fromIndex, toIndex, N) => {
  const from = getCellPosition(fromIndex, N);
  const to = getCellPosition(toIndex, N);
  return [
    `${from.r},${from.c}-${to.r},${to.c}`,
    `${to.r},${to.c}-${from.r},${from.c}`
  ];
};

const hasPathCrossing = (path, fromIndex, toIndex, N, rules) => {
  if (rules.path.allowCrossing) return false;

  const crossingKeys = getCrossingKeys(fromIndex, toIndex, N);
  if (crossingKeys.length === 0) return false;

  for (let i = 0; i < path.length - 1; i++) {
    const segmentKeys = getSegmentKeys(path[i], path[i + 1], N);
    if (segmentKeys.some(key => crossingKeys.includes(key))) return true;
  }

  return false;
};

const getMinMoveDistance = (fromIndex, toIndex, N, rules) => {
  const from = getCellPosition(fromIndex, N);
  const to = getCellPosition(toIndex, N);
  const rowDistance = Math.abs(from.r - to.r);
  const colDistance = Math.abs(from.c - to.c);
  return rules.movement === MOVEMENT_TYPES.diagonal ? Math.max(rowDistance, colDistance) : rowDistance + colDistance;
};

const calculateLevelScoreReport = ({ config, gridData, baseScore, hp, timer, maxCombo }) => {
  const L = config.N * config.N;
  const hiddenCount = gridData.filter(c => c.isHidden).length;
  const maxSteps = L - 1;

  const rawBaseScore = hiddenCount * SCORE_CONFIG.hiddenStep + (maxSteps - hiddenCount) * SCORE_CONFIG.visibleStep;
  const maxBaseScore = Math.floor(rawBaseScore * getComboMultiplier(maxSteps));
  const maxHpBonus = config.hp * SCORE_CONFIG.hpBonus;
  const maxTimeBonus = config.times[1] * SCORE_CONFIG.timeBonus;
  const maxMcBonus = maxSteps * SCORE_CONFIG.comboBonus;
  const sMax = maxBaseScore + maxHpBonus + maxTimeBonus + maxMcBonus;

  const timeBonus = Math.max(0, (config.times[1] - timer) * SCORE_CONFIG.timeBonus);
  const lifeBonus = hp * SCORE_CONFIG.hpBonus;
  const comboBonus = maxCombo * SCORE_CONFIG.comboBonus;
  const ruleBonus = 0;
  const totalScore = baseScore + lifeBonus + timeBonus + comboBonus + ruleBonus;

  let stars = 1;
  if (totalScore >= sMax * SCORE_CONFIG.starThresholds.three) stars = 3;
  else if (totalScore >= sMax * SCORE_CONFIG.starThresholds.two) stars = 2;

  return {
    completionScore: baseScore,
    timeBonus,
    lifeBonus,
    comboBonus,
    ruleBonus,
    totalScore,
    sMax,
    stars,
    base: baseScore,
    hpBonus: lifeBonus,
    mcBonus: comboBonus,
    totalLevelScore: totalScore
  };
};

// --- 算法核心：生成有效路径 ---
const generatePathDFS = (N, rand, rules) => {
  const L = N * N;
  let path = [];
  let visited = new Array(L).fill(false);
  let blockedCrossings = new Set();
  let attempts = 0;

  const getNeighbors = (r, c) => {
    let neighbors = [];
    for (let [dr, dc] of getAllowedDirections(rules)) {
      let nr = r + dr, nc = c + dc;
      if (isInsideBoard(nr, nc, N) && !visited[getCellIndex(nr, nc, N)]) {
        const segmentKeys = getSegmentKeys(getCellIndex(r, c, N), getCellIndex(nr, nc, N), N);
        if (!rules.path.allowCrossing && segmentKeys.some(key => blockedCrossings.has(key))) continue;
        neighbors.push([nr, nc]);
      }
    }
    return neighbors;
  };

  const countFree = (r, c) => {
    visited[r * N + c] = true;
    let count = getNeighbors(r, c).length;
    visited[r * N + c] = false;
    return count;
  };

  const dfs = (r, c) => {
    attempts++;
    if (attempts > 5000) return false; 
    path.push(r * N + c);
    visited[r * N + c] = true;
    if (path.length === L) return true;

    let neighbors = getNeighbors(r, c);
    neighbors.sort((a, b) => {
      let degA = countFree(a[0], a[1]);
      let degB = countFree(b[0], b[1]);
      if (degA === degB) return rand() - 0.5;
      return degA - degB;
    });

    for (let [nr, nc] of neighbors) {
      const crossingKeys = rules.path.allowCrossing ? [] : getCrossingKeys(getCellIndex(r, c, N), getCellIndex(nr, nc, N), N);
      crossingKeys.forEach(key => blockedCrossings.add(key));
      if (dfs(nr, nc)) return true;
      crossingKeys.forEach(key => blockedCrossings.delete(key));
    }
    path.pop();
    visited[r * N + c] = false;
    return false;
  };

  for (let i = 0; i < 10; i++) {
    attempts = 0;
    path = [];
    visited.fill(false);
    blockedCrossings.clear();
    let sr = Math.floor(rand() * N);
    let sc = Math.floor(rand() * N);
    if (dfs(sr, sc)) return path;
  }
  
  path = [];
  for (let r = 0; r < N; r++) {
    if (r % 2 === 0) for (let c = 0; c < N; c++) path.push(r * N + c);
    else for (let c = N - 1; c >= 0; c--) path.push(r * N + c);
  }
  return path;
};
// --- 主应用组件 ---
export default function App() {
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
    toastTimeoutRef.current = setTimeout(() => setToast(null), 2500);
  }, []);

  // 游戏内核心状态
  const [gridData, setGridData] = useState([]);
  const [path, setPath] = useState([]);
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
  const [floatingScores, setFloatingScores] = useState([]);
  const [levelReport, setLevelReport] = useState(null);
  const [activePortal, setActivePortal] = useState(null);
  
  // 兼容旧 savedGame 中的 maxCombo 字段
  const maxCombo = maxComboStreak;
  // 开发环境 GM 工具与拖拽状态
  const isDev = import.meta.env.DEV;
  const [showGmPanel, setShowGmPanel] = useState(false);
  const [gmPos, setGmPos] = useState({ x: 20, y: 80 });
  const gmDragRef = useRef({ isDragging: false, startX: 0, startY: 0, initialX: 0, initialY: 0 });

  const containerRef = useRef(null);
  const timerRef = useRef(null);
  const lastProcessedRef = useRef(null);

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
    const handleGlobalPointerUp = () => {
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
    if (clearSavedGame) {
      localStorage.removeItem(getSavedGameKey(targetPlayMode));
      setResumeGame(getSavedGameResume());
    }
    const levelConfig = createLevelConfig(targetDiff, targetLevel, targetPlayMode);
    const rules = resolveRules(levelConfig);
    const portalLevel = levelConfig.portalLevel;

    if (portalLevel) {
      const portalMap = getPortalMap(portalLevel);
      const hiddenVals = new Set(portalLevel.hiddenVals);
      const newGrid = new Array(portalLevel.N * portalLevel.N);

      for (let i = 0; i < newGrid.length; i++) {
        const val = portalLevel.path.indexOf(i) + 1;
        const portalId = portalMap[i] || null;
        newGrid[i] = {
          val,
          isHidden: hiddenVals.has(val) && !portalId,
          isRevealed: false,
          isExcluded: false,
          isHinted: false,
          portalId
        };
      }

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
      setLevelReport(null);
      setActivePortal(null);
      lastProcessedRef.current = null;
      return;
    }

    const seedStr = targetDiff + targetLevel.toString();
    let seed = 0;
    for (let i = 0; i < seedStr.length; i++) {
      seed = (seed << 5) - seed + seedStr.charCodeAt(i);
      seed |= 0;
    }
    const rand = mulberry32(seed + 88888);

    let gridSize = CONFIG[targetDiff].N;
    if (targetPlayMode === PLAY_MODES.classic) {
      gridSize = getClassicGridSize(targetDiff);
    }
    const config = { ...CONFIG[targetDiff], N: gridSize };
    const rawPath = generatePathDFS(config.N, rand, rules);
    const L = config.N * config.N;

    let revealed = new Array(L).fill(0);
    for (let i = 0; i < L; i++) revealed[rawPath[i]] = i + 1;

    let pool = [];
    for (let i = 2; i < L; i++) pool.push(i);
    pool.sort(() => rand() - 0.5);

    let targetHiddenCount = Math.floor(rand() * (config.hiddenMax - config.hiddenMin + 1)) + config.hiddenMin;
    let actualHiddenCount = 0;
    let hiddenVals = new Set();

    const checkUnique = (revArray) => {
      let solutionsFound = 0;
      let visited = new Array(L).fill(false);
      let blockedCrossings = new Set();
      
      let valToIdx = new Array(L + 1).fill(-1);
      for(let i = 0; i < L; i++) if (revArray[i] !== 0) valToIdx[revArray[i]] = i;
      
      let nextRevealedVal = new Array(L + 1).fill(-1);
      let lastRev = L;
      for(let v = L; v >= 1; v--) {
        if (valToIdx[v] !== -1) lastRev = v;
        nextRevealedVal[v] = lastRev;
      }

      let timeout = Date.now() + 15;

      const dfs = (idx, currentVal) => {
        if (Date.now() > timeout) return 2;
        if (currentVal === L) return ++solutionsFound;

        let r = Math.floor(idx / config.N), c = idx % config.N;
        let nextVal = nextRevealedVal[currentVal + 1];
        if (nextVal !== -1) {
            let nextIdx = valToIdx[nextVal];
            if (getMinMoveDistance(idx, nextIdx, config.N, rules) > nextVal - currentVal) return solutionsFound;
        }

        for (let [dr, dc] of getAllowedDirections(rules)) {
          let nr = r + dr, nc = c + dc;
          if (isInsideBoard(nr, nc, config.N)) {
            let nidx = getCellIndex(nr, nc, config.N);
            if (!visited[nidx]) {
              let cellVal = revArray[nidx];
              if (cellVal === currentVal + 1 || (cellVal === 0 && valToIdx[currentVal + 1] === -1)) {
                const segmentKeys = getSegmentKeys(idx, nidx, config.N);
                if (!rules.path.allowCrossing && segmentKeys.some(key => blockedCrossings.has(key))) continue;
                const crossingKeys = rules.path.allowCrossing ? [] : getCrossingKeys(idx, nidx, config.N);
                crossingKeys.forEach(key => blockedCrossings.add(key));
                visited[nidx] = true;
                let res = dfs(nidx, currentVal + 1);
                visited[nidx] = false;
                crossingKeys.forEach(key => blockedCrossings.delete(key));
                if (res >= 2) return res;
              }
            }
          }
        }
        return solutionsFound;
      };
      
      visited[valToIdx[1]] = true;
      return dfs(valToIdx[1], 1) === 1;
    };

    for (let val of pool) {
      if (actualHiddenCount >= targetHiddenCount) break;
      let prevRev = val - 1;
      while (prevRev > 1 && hiddenVals.has(prevRev)) prevRev--;
      let nextRev = val + 1;
      while (nextRev < L && hiddenVals.has(nextRev)) nextRev++;

      if (nextRev - prevRev - 1 > config.maxGap) continue;

      let boardIdx = rawPath[val - 1];
      revealed[boardIdx] = 0;
      if (checkUnique(revealed)) {
        actualHiddenCount++;
        hiddenVals.add(val);
      } else {
        revealed[boardIdx] = val;
      }
    }

    let newGrid = new Array(L);
    for (let i = 0; i < L; i++) {
      let val = rawPath.indexOf(i) + 1;
      newGrid[i] = { val, isHidden: hiddenVals.has(val), isRevealed: false, isExcluded: false, isHinted: false };
    }

    setGridData(newGrid);
    setPath([rawPath[0]]);
    setHp(config.hp);
    setTimer(0);
    setTimerRunning(false);
    setStatus('playing');
    setWrongFlash(null);
    setIsDragging(false);
    
    scoreRef.current = 0;
    setScore(0);
    setComboStreak(0);
    setMaxComboStreak(0);
    setLevelReport(null);
    setActivePortal(null);
    lastProcessedRef.current = null;
  }, []);

  const startGame = (d, lvl, targetPlayMode = playMode) => {
    const discovery = findTriggeredDiscovery(targetPlayMode, d, lvl);
    if (discovery) {
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
    setIsDragging(false);
    lastProcessedRef.current = null;
  };

  const processCellInteraction = (index) => {
    const currentTip = path[path.length - 1];
    const levelConfig = createLevelConfig(diff, levelIdx, playMode);
    const N = levelConfig.portalLevel?.N || CONFIG[diff].N;
    const rules = resolveRules(levelConfig);
    if (index === currentTip) return;

    if (path.length > 1 && index === path[path.length - 2]) {
      const nextPath = path.slice(0, -1);
      setPath(nextPath);
      setActivePortal(rules.portal ? deriveActivePortal(gridData, nextPath) : null);
      return;
    }

    const portalExitRequired = rules.portal && activePortal?.entryIndex === currentTip && !path.includes(activePortal.exitIndex);
    const completingActivePortal = portalExitRequired && index === activePortal.exitIndex;

    if (portalExitRequired && !completingActivePortal) {
      if (wrongFlash !== activePortal.exitIndex) {
        setWrongFlash(activePortal.exitIndex);
        setTimeout(() => setWrongFlash(null), 300);
      }
      return;
    }

    if (!completingActivePortal) {
      if (!canMoveBetween(currentTip, index, N, rules)) return;
      if (hasPathCrossing(path, currentTip, index, N, rules)) return;
    }

    const nextVal = path.length + 1;
    const targetCell = gridData[index];

    if (targetCell.val === nextVal) {
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

      if (rules.portal) {
        setActivePortal(completingActivePortal ? null : createActivePortal(index, gridData));
      } else {
        const multi = getComboMultiplier(newStreak);
        const basePoints = wasHidden ? 30 : 10;
        const earnedPoints = Math.floor(basePoints * multi);
        scoreRef.current += earnedPoints;
        setScore(scoreRef.current);

        if (multi > 1.0) {
          const gridN = CONFIG[diff].N;
          const fs = createFloatingScore(earnedPoints, index, gridN);
          setFloatingScores(prev => [...prev.slice(-5), fs]);
          setTimeout(() => {
            setFloatingScores(prev => prev.filter(s => s.id !== fs.id));
          }, 1000);
        }
      }

      playComboTone(newStreak);
      if (nextPath.length === N * N) {
        handleWin(nextPath, newMax);
      }
    } else {
      if (path.includes(index) || targetCell.isExcluded) return;

      if (!targetCell.isHidden || targetCell.isRevealed) {
        if (wrongFlash !== index) {
          setWrongFlash(index);
          setTimeout(() => setWrongFlash(null), 300);
        }
        const { streak: fStreak } = computeComboState(comboStreak, maxComboStreak, 'failure');
        setComboStreak(fStreak);
        return;
      }

      playErrorTone();
      setWrongFlash(index);
      setTimeout(() => setWrongFlash(null), 300);
      
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
                    <Play fill="currentColor" size={19} /> 继续这条线
                  </button>
                )}
                <button
                  onClick={() => setView('mode')}
                  className={`${resumeGame ? 'button-secondary py-3 text-base' : 'button-primary py-3.5 text-lg'} flex items-center justify-center gap-2`}
                >
                  <Play fill="currentColor" size={19} /> 开始一段谜题
                </button>
              </div>

              <div className="relative z-10 mt-5">
                <button onClick={() => setView('tut')} className="button-quiet text-sm font-medium flex items-center justify-center gap-1.5 mx-auto">
                  <Info size={15} /> 翻开玩法页
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (view === 'mode') {
      const modeProgressSummaries = GAME_MODE_LIST.reduce((summaries, mode) => ({
        ...summaries,
        [mode.id]: getModeCompletion({
          playMode: mode.id,
          progress,
          portalProgress
        })
      }), {});

      return (
        <ModeSelectPage
          modes={GAME_MODE_LIST}
          modeProgressSummaries={modeProgressSummaries}
          onBackHome={() => setView('home')}
          onSelectMode={(selectedMode) => {
            setPlayMode(selectedMode);
            setDiff('easy');
            setView('levels');
          }}
        />
      );
    }

    if (view === 'levels') {
      const currentMode = getGameModeConfig(playMode);
      const modeProgress = isPortalMode(playMode) ? portalProgress : progress;
      const modeHighScores = isPortalMode(playMode) ? portalBestSteps : highScores;
      const levelSections = getLevelSections(playMode);
      const normalUnlockedThroughIndex = isPortalMode(playMode)
        ? -1
        : getNormalUnlockedThroughIndex(playMode, modeProgress);
      const modeCompletion = getModeCompletion({
        playMode,
        progress,
        portalProgress
      });
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

      return (
        <div className="app-shell flex flex-col font-sans">
          <div className="flex items-center px-4 py-4 border-b border-white/[0.05]">
            <button onClick={() => setView('mode')} className="button-quiet p-1"><ChevronLeft size={22} /></button>
            <div className="flex-1 text-center">
              <h2 className="text-sm font-semibold text-slate-300 tracking-wide">{currentMode.name}</h2>
            </div>
            <div className="w-8"></div>
          </div>

          <div className="px-5 pt-5 pb-3">
            <div className="max-w-md mx-auto">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[#797468] text-[10px] tracking-[0.2em] uppercase">Puzzle book</p>
                  <h3 className="text-[#ded4c1] font-bold mt-0.5">谜题书</h3>
                </div>
                <span className="text-xs font-semibold text-[#8f8879]">已解开 {modeCompletion.completed} / {modeCompletion.total}</span>
              </div>
              <div className="progress-track">
                <div
                  className={`${isPortalMode(playMode) ? 'progress-portal' : 'progress-classic'} transition-all duration-500`}
                  style={{ width: `${modeCompletion.total > 0 ? Math.round((modeCompletion.completed / modeCompletion.total) * 100) : 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex-1 p-5 pt-3 overflow-y-auto">
            <div className="puzzle-book max-w-md mx-auto">
              <div className="mb-4 flex items-center gap-3 text-xs text-[#777164]">
                <span className="w-8 border-t border-dashed border-[#777164]/35" />
                <span>沿着留下的足迹，翻开下一块谜题</span>
                <span className="flex-1 border-t border-dashed border-[#777164]/20" />
              </div>
              <div className="grid grid-cols-4 gap-3">
              {levelEntries.map(entry => {
                const isPortalRun = isPortalMode(playMode);
                const entryDiff = entry.diff;
                const entryLevelIdx = entry.levelIdx;
                const displayLevelNumber = entry.displayLevelNumber;
                const stars = isPortalRun ? getPortalStars(portalProgress, entryDiff, entryLevelIdx) : modeProgress[entryDiff]?.[entryLevelIdx];
                const savedPlayMode = savedLevelInfo?.playMode || playMode;
                const savedPortalLevelMatches = !isPortalRun || (savedLevelInfo?.portalLevelId ? savedLevelInfo.portalLevelId === getPortalLevel(entryLevelIdx).id : savedLevelInfo?.levelIdx === entryLevelIdx);
                const hasSave = savedLevelInfo && savedPlayMode === playMode && savedLevelInfo.diff === entryDiff && savedPortalLevelMatches && (isPortalRun || savedLevelInfo.levelIdx === entryLevelIdx);
                const linearLevelIndex = isPortalRun ? -1 : getNormalLevelLinearIndex(playMode, entryDiff, entryLevelIdx);
                const isUnlocked = isPortalRun
                  ? entryLevelIdx <= (portalProgress[entryDiff]?.unlockedIndex ?? 0)
                  : linearLevelIndex <= normalUnlockedThroughIndex || hasSave;
                const hs = isPortalRun ? getPortalBestSteps(portalBestSteps, entryDiff, entryLevelIdx) : modeHighScores[entryDiff]?.[entryLevelIdx] || 0;
                const isCompleted = stars > 0;
                const isCurrent = isUnlocked && !isCompleted;

                return (
                  <div key={`${entryDiff}-${entryLevelIdx}`}
                       onClick={() => { if(isUnlocked) startGame(entryDiff, entryLevelIdx, playMode); }}
                       className={`level-tile aspect-square flex flex-col items-center justify-between p-2.5 relative rounded-[18px] transition-colors ${
                         !isUnlocked
                           ? 'bg-white/[0.018] border border-white/[0.035] opacity-45 cursor-not-allowed'
                           : isCurrent
                           ? 'level-current bg-[#17302c] border border-[#5e9589]/75 cursor-pointer hover:bg-[#1a3832] active:scale-[0.98] transition-transform'
                           : 'bg-[#161720] border border-[#3c3a47]/65 cursor-pointer hover:bg-[#1a1b25] active:scale-[0.98] transition-transform'
                       }`}>
                    {hasSave && <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-teal-500 rounded-full" title="已保存进度"></div>}
                    {isUnlocked ? (
                      <>
                        <span className={`font-black text-lg mt-0.5 ${isCompleted ? 'text-[#c8c0b0]' : 'text-[#f0e6d1]'}`}>{displayLevelNumber}</span>
                        <span className={`text-[10px] font-medium ${isCompleted ? 'text-[#777164]' : 'text-[#a8d0c5]'}`}>
                          {isCompleted ? '已走过' : '下一块谜题'}
                        </span>
                        {hs > 0 && (
                          <span className="text-[10px] text-slate-500 font-mono leading-none">
                            {isPortalRun ? `${hs}步` : hs}
                          </span>
                        )}
                        <div className="flex gap-1 mb-0.5">
                          {[1, 2, 3].map(s => <Star key={s} size={12} className={s <= stars && stars > 0 ? "text-[#d4b86d] fill-[#d4b86d]" : isCompleted ? "text-[#4b4750]" : "text-[#34323b]"} />)}
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center w-full gap-1">
                        <span className="text-slate-500 font-black text-lg">{displayLevelNumber}</span>
                        <Lock className="text-slate-500" size={16} />
                        <span className="text-[10px] text-slate-500 font-bold">未解锁</span>
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (view === 'tut') {
      return (
        <div className="app-shell flex flex-col font-sans">
          <div className="flex items-center px-4 py-4 border-b border-white/[0.05]">
            <button onClick={() => setView('home')} className="button-quiet p-1"><ChevronLeft size={22} /></button>
            <span className="flex-1 text-center text-slate-300 font-semibold text-sm tracking-[0.16em]">ONE LINE</span>
            <div className="w-8"></div>
          </div>

          <div className="flex-1 p-5 flex flex-col gap-5 max-w-md mx-auto w-full pt-2">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-100">玩法说明</h2>
              <p className="text-slate-500 text-sm mt-1.5">用一条线连接所有方块。</p>
            </div>

            <div className="surface-muted p-4">
              <h3 className="text-sm font-semibold text-teal-300/80 mb-1.5">目标</h3>
              <p className="text-slate-300 text-sm leading-relaxed">从数字 1 开始，按顺序连接所有方块。</p>
            </div>

            <div className="surface-muted p-4">
              <h3 className="text-sm font-semibold text-teal-300/80 mb-1.5">路线</h3>
              <p className="text-slate-300 text-sm leading-relaxed">路线不能交叉，也不能重复经过同一个格子。</p>
            </div>

            <div className="surface-muted p-4">
              <h3 className="text-sm font-semibold text-teal-300/80 mb-1.5">特殊规则</h3>
              <p className="text-slate-300 text-sm leading-relaxed">隐藏数字需要通过路径推理；传送门会连接不同区域；连错隐藏节点会损失生命。</p>
            </div>

            <button onClick={() => setView('home')} className="button-primary w-full py-3.5">
              我明白了
            </button>
          </div>
        </div>
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
        const u = path[i], v = path[i + 1];
        const r1 = Math.floor(u / N), c1 = u % N;
        const r2 = Math.floor(v / N), c2 = v % N;
        const isPortalJump = gridData[u]?.portalId && gridData[u]?.portalId === gridData[v]?.portalId;
        if (isPortalJump) continue;
        
        const isLastSegment = i === path.length - 2;
        let wClass = N > 7 ? "4" : "6";

        lines.push({
          x1: `${(c1 + 0.5) * (100 / N)}%`, y1: `${(r1 + 0.5) * (100 / N)}%`,
          x2: `${(c2 + 0.5) * (100 / N)}%`, y2: `${(r2 + 0.5) * (100 / N)}%`,
          wClass, isLastSegment
        });
      }

      const formatTime = (secs) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
      };


      function getCellClass(cell, idx, inPath, isHead, isError, portalId, isPortalEntryActive, isPortalExitActive, comboStreak) {
        if (isError) return "bg-rose-500/18 border border-rose-400/55 rounded-md";
        if (isHead) {
          if (comboStreak >= 7) return "bg-teal-500/18 border-2 border-teal-300/80 rounded-md";
          if (comboStreak >= 3) return "bg-teal-500/14 border-2 border-teal-400/65 rounded-md";
          return "bg-teal-500/10 border-2 border-teal-400/45 rounded-md";
        }
        if (portalId && (isPortalEntryActive || isPortalExitActive)) {
          return "portal-token bg-violet-500/18 border border-violet-300/60 rounded-md";
        }
        if (portalId && inPath) return "portal-token bg-violet-500/16 border border-violet-400/45 rounded-md";
        if (portalId) return "portal-token bg-violet-500/9 border border-violet-400/30 rounded-md";
        if (cell.isHidden && !cell.isRevealed && cell.isHinted) return "bg-blue-500/14 border border-blue-400/45 rounded-md";
        if (cell.isHidden && !cell.isRevealed) return "bg-white/[0.02] border border-white/[0.04] rounded-md";
        if (inPath) return "bg-teal-500/10 border border-teal-400/30 rounded-md";
        return "bg-white/[0.035] border border-white/[0.07] rounded-md";
      }

      function getCellContent(cell, inPath, portalId) {
        if (portalId) return inPath ? cell.val : "?";
        if (cell.isExcluded) return null;
        if (cell.isHidden && !cell.isRevealed) return cell.isHinted ? cell.val : "";
        return cell.val;
      }

      function getCellTextClass(cell, inPath, portalId) {
        if (cell.isExcluded) return "text-rose-500";
        if (cell.isHidden && !cell.isRevealed) return cell.isHinted ? "text-white" : "text-transparent";
        if (portalId) return "text-white";
        return "text-white";
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
                  <Motion.div key={comboStreak} className="text-xs font-bold text-teal-300/80 whitespace-nowrap"
                    {...(comboStreak === 5 || comboStreak === 10 || comboStreak === 15 || comboStreak === 20 ? comboMilestonePulse : {})}>
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

            {firstLevelHintMode === playMode && levelIdx === 0 && status === 'playing' && (
              <div className="surface-muted w-full max-w-md mb-3 px-4 py-2.5 text-left text-xs text-slate-400">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-teal-300/80 font-semibold mb-1">提示</p>
                    <p className="leading-relaxed">
                      从 1 开始按顺序连接。看不到的数字，用路径位置来推理。
                    </p>
                  </div>
                  <button onClick={() => setFirstLevelHintMode(null)} className="text-slate-400 hover:text-white transition p-1 -mt-1 -mr-1" aria-label="关闭提示">
                    <X size={18} />
                  </button>
                </div>
              </div>
            )}

            <div 
              ref={containerRef}
className="board-sketch relative w-full max-w-md aspect-square mx-2 p-1.5 touch-none select-none border border-[#454252]/70"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onContextMenu={e => e.preventDefault()}
            >
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ padding: '0.25rem' }}>
                {lines.map((l, i) => (
                  <React.Fragment key={i}>
                    {/* subtle path depth */}
                    <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                      stroke="#182d2a" strokeWidth={Number(l.wClass) + 5} strokeLinecap="round"
                      opacity="0.62"
                    />
                    {/* chalk-like double stroke */}
                    <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                      stroke="#689c92" strokeWidth={Number(l.wClass) + 1} strokeLinecap="round"
                      strokeDasharray={comboStreak >= 5 ? '6 4' : 'none'}
                      className={`transition-all duration-200 ${l.isLastSegment ? 'animate-drawIn' : ''} ${comboStreak >= 5 ? 'animate-flow' : ''}`}
                    />
                    <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                      stroke="#b5d1c8" strokeWidth={Math.max(Number(l.wClass) - 3, 1)} strokeLinecap="round"
                      opacity="0.14"
                      transform="translate(0.7 -0.5)"
                    />
                  </React.Fragment>
                ))}
              </svg>

              <div className="w-full h-full" style={{ display: 'grid', gridTemplateColumns: `repeat(${N}, 1fr)`, gridTemplateRows: `repeat(${N}, 1fr)` }}>
                {gridData.map((cell, idx) => {
                  const inPath = path.includes(idx);
                  const isHead = path[path.length - 1] === idx;
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
                        className={`cell-token relative z-10 w-full h-full flex items-center justify-center font-bold
                          ${N === 5 ? 'text-3xl' : N === 7 ? 'text-2xl' : 'text-lg'}
                          ${bgClass} ${textClass}
                          ${isHead ? 'path-head' : ''}
                          ${isPortalExitActive ? 'ring-2 ring-violet-300/50 scale-[1.03]' : ''}
                        `}
                      >
                        {cell.isExcluded ? <X className="text-rose-500 absolute" size={N > 7 ? 20 : 32} /> : content}
                      </div>
                    </Motion.div>
                  );
                })}
              </div>
              {!portalRun && floatingScores.length > 0 && (
                <FloatingScore
                  scores={floatingScores}
                  onComplete={(id) => {
                    setFloatingScores(prev => prev.filter(s => s.id !== id));
                  }}
                />
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
          <div className="flex justify-center gap-2.5 z-10 py-2 px-4">
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
                <div className="item-token w-12 h-12 flex items-center justify-center relative bg-[#171821] border border-[#4a4651]/60">
                  <item.icon className={item.color} size={20} />
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
                   onModeSelect={() => { clearNormalSavedGame(); setView('mode'); }}
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
