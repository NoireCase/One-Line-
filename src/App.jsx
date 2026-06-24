import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Info, Star, CircleDollarSign, Ban, 
  Lightbulb, Lock, X, RotateCcw, Heart, FastForward, 
  Settings, ChevronLeft, ShieldAlert, PlusCircle
} from 'lucide-react';
import ModeSelectPage from './components/ModeSelectPage.jsx';
import WinPanel from './components/WinPanel.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import LosePanel from './components/LosePanel.jsx';
import RuleCard from './components/RuleCard.jsx';
import {
  GAME_MODE_LIST,
  GAME_MODES,
  MOVEMENT_TYPES,
  PLAY_MODES,
  getGameModeConfig,
  getLevelsPerDiff,
  getSavedGameKey,
  getClassicMovement,
  getClassicGridSize,
  getClassicTotalLevels
} from './config/gameModes.js';
import { findTriggeredDiscovery, getDiscoveredRules } from './config/ruleDiscoveries.js';

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

const getComboMultiplier = (count) => {
  if (count >= 16) return 3.0;
  if (count >= 10) return 2.0;
  if (count >= 5) return 1.5;
  if (count >= 2) return 1.2;
  return 1.0;
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

// --- 音效管理器 ---
class SoundManager {
  constructor() {
    this.ctx = null;
    this.sfxVolume = 100;
    this.musicVolume = 100; // 为后续音乐预留
  }
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  playTone(freq, type = 'sine', duration = 0.1, vol = 0.1) {
    if (!this.ctx) return;
    const actualVol = vol * (this.sfxVolume / 100);
    if (actualVol <= 0) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(actualVol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }
  playConnect(comboCount) {
    const pentatonicScale = [0, 2, 4, 7, 9];
    const index = (comboCount - 1) % 25; 
    const octave = Math.floor(index / 5);
    const semitones = pentatonicScale[index % 5] + octave * 12;
    const baseFreq = 261.63; 
    const freq = baseFreq * Math.pow(2, semitones / 12);
    this.playTone(freq, 'sine', 0.15, 0.1);
  }
  playSuccess() {
    this.playTone(523.25, 'triangle', 0.1, 0.1);
    setTimeout(() => this.playTone(659.25, 'triangle', 0.2, 0.1), 100);
  }
  playError() {
    this.playTone(150, 'sawtooth', 0.3, 0.2);
  }
  playReveal() {
    this.playTone(880, 'sine', 0.1, 0.1);
  }
}
const sound = new SoundManager();

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
  
  // 分数与连击 (Combo) 引擎
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [combo, setCombo] = useState(0);
  const [floatingScore, setFloatingScore] = useState(null);
  const [levelReport, setLevelReport] = useState(null);
  const [activePortal, setActivePortal] = useState(null);
  
  const strokeLengthRef = useRef(0);
  const currentStrokeScoreRef = useRef(0);

  // GM 模式与拖拽状态
  const [, setGmMode] = useState(false);
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
    localStorage.setItem('cg_music_vol', musicVol.toString());
    sound.sfxVolume = sfxVol;
    sound.musicVolume = musicVol;
  }, [sfxVol, musicVol]);

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
    let keys = '';
    const handleKeyDown = (e) => {
      keys += e.key.toLowerCase();
      if (keys.length > 9) keys = keys.slice(-9);
      if (keys === 'wangjiaqi') {
        setGmMode(true);
        setShowGmPanel(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (timerRunning && status === 'playing') {
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerRunning, status]);

  // 连线单笔结算引擎
  const settleCurrentStroke = useCallback(() => {
    if (strokeLengthRef.current > 0 && currentStrokeScoreRef.current > 0) {
      const multi = getComboMultiplier(strokeLengthRef.current);
      const finalScore = Math.floor(currentStrokeScoreRef.current * multi);
      
      scoreRef.current += finalScore;
      setScore(scoreRef.current);
      
      if (multi > 1.0) {
        setFloatingScore({ val: finalScore, id: Date.now() });
        setTimeout(() => setFloatingScore(null), 1200);
      }

      currentStrokeScoreRef.current = 0;
      strokeLengthRef.current = 0;
      setCombo(0);
    }
  }, []);

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      setIsDragging(false);
      lastProcessedRef.current = null;
      settleCurrentStroke(); 
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, [settleCurrentStroke]);

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
      setMaxCombo(0);
      setCombo(0);
      setLevelReport(null);
      setActivePortal(null);
      currentStrokeScoreRef.current = 0;
      strokeLengthRef.current = 0;
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
    setMaxCombo(0);
    setCombo(0);
    setLevelReport(null);
    setActivePortal(null);
    currentStrokeScoreRef.current = 0;
    strokeLengthRef.current = 0;
    lastProcessedRef.current = null;
  }, []);

  const startGame = (d, lvl, targetPlayMode = playMode) => {
    const discovery = findTriggeredDiscovery(targetPlayMode, d, lvl);
    if (discovery) {
      setRuleDiscovery({ discovery, d, lvl, targetPlayMode });
      return;
    }

    sound.init();
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
          setMaxCombo(saved.maxCombo || 0);
          
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
    sound.init();
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
    settleCurrentStroke();
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
      settleCurrentStroke();
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

      if (rules.portal) {
        setActivePortal(completingActivePortal ? null : createActivePortal(index, gridData));
      } else {
        // --- 分数与 Combo 累积 ---
        currentStrokeScoreRef.current += wasHidden ? 30 : 10;
        strokeLengthRef.current += 1;
        setCombo(strokeLengthRef.current);
        setMaxCombo(m => Math.max(m, strokeLengthRef.current));
      }

      sound.playConnect(rules.portal ? nextPath.length : strokeLengthRef.current);

      if (nextPath.length === N * N) {
        settleCurrentStroke(); 
        handleWin(nextPath);
      }
    } else {
      if (path.includes(index) || targetCell.isExcluded) return;

      if (!targetCell.isHidden || targetCell.isRevealed) {
        if (wrongFlash !== index) {
          setWrongFlash(index);
          setTimeout(() => setWrongFlash(null), 300);
        }
        return;
      }

      settleCurrentStroke(); 
      sound.playError();
      setWrongFlash(index);
      setTimeout(() => setWrongFlash(null), 300);
      
      setHp(h => {
        const newHp = h - 1;
        if (newHp <= 0) setStatus('lost');
        return newHp;
      });
    }
  };

  const handleWin = (completedPath = path) => {
    setStatus('won');
    sound.playSuccess();
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
      maxCombo
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
      settleCurrentStroke(); 
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
    if (!showGmPanel) return null;
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
            setTimeout(() => { settleCurrentStroke(); handleWin(fullPath); }, 500);
          }}>一键满星通关</button>
        </div>
      </div>
    );
  };

  const renderHeader = () => (
    <div className="flex justify-between items-center bg-slate-800 p-4 shadow-md sticky top-0 z-20">
      <div className="flex items-center gap-2">
        <button onClick={() => setView('home')} className="text-emerald-400 hover:text-emerald-300 transition"><ChevronLeft size={28} /></button>
        <span className="text-white font-bold text-lg tracking-wider">One Line</span>
      </div>
      <div className="flex items-center gap-4 text-white font-medium">
        <div className="flex items-center gap-1 bg-yellow-500/20 px-3 py-1 rounded-full text-yellow-400">
          <CircleDollarSign size={18} /> {coins}
        </div>
      </div>
    </div>
  );

  const renderViewContent = () => {
    if (view === 'home') {
      return (
        <div className="min-h-screen bg-slate-900 flex flex-col font-sans relative">
          
          <button onClick={() => setShowSettings(true)} className="absolute top-4 left-4 text-slate-600 hover:text-slate-300 transition p-2 z-30">
            <Settings size={24} />
          </button>

          {globalScore > 0 && <div className="absolute top-6 right-6 text-[11px] text-slate-600 font-mono z-30 bg-slate-800/50 px-2.5 py-1 rounded-full">积分 {globalScore}/5000</div>}

          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-8 relative">
            <div>
              <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 to-cyan-500 tracking-tighter drop-shadow-lg">One Line</h1>
              <p className="text-slate-500 text-sm mt-3 font-bold">观察、规划，完成一笔画</p>
            </div>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              {resumeGame && (
                <button
                  onClick={() => startGame(resumeGame.diff, resumeGame.levelIdx, resumeGame.playMode)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-white py-4 rounded-xl text-xl font-bold shadow-lg shadow-emerald-500/25 transition-transform active:scale-95 flex items-center justify-center gap-2"
                >
                  <Play fill="currentColor" /> 继续游戏
                </button>
              )}
              <button
                onClick={() => setView('mode')}
                className={`${resumeGame ? 'bg-slate-700 hover:bg-slate-600 py-3.5 text-lg' : 'bg-emerald-500 hover:bg-emerald-400 py-4 text-xl shadow-lg shadow-emerald-500/25'} text-white rounded-xl font-bold transition-transform active:scale-95 flex items-center justify-center gap-2`}
              >
                <Play fill="currentColor" /> 开始游戏
              </button>
              <div className="flex justify-center gap-5 pt-1">
                <button onClick={() => setView('tut')} className="text-slate-500 hover:text-slate-300 text-sm font-bold transition active:scale-95 flex items-center justify-center gap-1.5">
                  <Info size={18} /> 玩法说明
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
        <div className="min-h-screen bg-slate-900 flex flex-col font-sans">
          <div className="flex justify-between items-center bg-slate-800 p-4 shadow-md">
            <button onClick={() => setView('mode')} className="text-white"><ChevronLeft size={28} /></button>
            <div className="text-center">
              <h2 className="text-xl font-bold text-white">{currentMode.name}</h2>
              <p className="text-xs text-slate-400">完成 {modeCompletion.completed}/{modeCompletion.total}</p>
            </div>
            <div className="w-8"></div>
          </div>
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-md mx-auto grid grid-cols-4 gap-3">
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
                const statusLabel = isCompleted ? '已完成' : '可挑战';

                return (
                  <div key={`${entryDiff}-${entryLevelIdx}`}
                       onClick={() => { if(isUnlocked) startGame(entryDiff, entryLevelIdx, playMode); }}
                       className={`aspect-square rounded-xl flex flex-col items-center justify-between p-2.5 relative transition shadow-md border ${isUnlocked ? 'bg-slate-700 border-slate-600 cursor-pointer hover:bg-slate-600 active:scale-95' : 'bg-slate-800/70 border-slate-700 opacity-70'}`}>
                    {hasSave && <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" title="已保存进度"></div>}
                    {isUnlocked ? (
                      <>
                        <span className="text-slate-300 font-black text-lg mt-0.5">{displayLevelNumber}</span>
                        <span className={`text-[11px] font-black rounded-full px-2 py-0.5 ${isCompleted ? 'text-emerald-300 bg-emerald-500/10' : 'text-slate-300 bg-slate-800/80'}`}>
                          {statusLabel}
                        </span>
                        {hs > 0 && (
                          <span className="text-[10px] text-slate-400 font-mono leading-none">
                            {isPortalRun ? `${hs}步` : hs}
                          </span>
                        )}
                        <div className="flex gap-1 mb-0.5">
                          {[1, 2, 3].map(s => <Star key={s} size={13} className={s <= stars && stars > 0 ? "text-yellow-400 fill-yellow-400 filter drop-shadow-[0_0_4px_rgba(250,204,21,0.5)]" : "text-slate-600"} />)}
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center w-full gap-2">
                        <span className="text-slate-600 font-bold text-lg">{displayLevelNumber}</span>
                        <Lock className="text-slate-600" size={20} />
                        <span className="text-[11px] text-slate-600 font-bold">未解锁</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    if (view === 'tut') {
      return (
        <div className="min-h-screen bg-slate-900 flex flex-col font-sans text-white">
          {renderHeader()}
          <div className="flex-1 p-6 flex flex-col items-center pt-8 max-w-md mx-auto w-full text-center">
            <h2 className="text-2xl font-bold mb-6 text-emerald-400">玩法说明</h2>
            <div className="bg-slate-800 p-6 rounded-2xl w-full text-left space-y-4 shadow-lg leading-relaxed text-slate-200">
              <p><span className="text-emerald-400 font-bold">目标：</span>从数字 1 开始，按顺序连接所有方块。</p>
              <p><span className="text-emerald-400 font-bold">经典模式：</span>部分关卡只允许上下左右连接，部分关卡支持斜向连接。随着关卡推进，棋盘会从 5×5 扩展到 9×9。</p>
              <p><span className="text-emerald-400 font-bold">传送门谜题：</span>进入问号后，连接亮起的出口继续路线。</p>
              <p><span className="text-emerald-400 font-bold">路线：</span>不能交叉，也不能重复经过同一个格子。</p>
              <p><span className="text-emerald-400 font-bold">生命：</span>连接错误的隐藏节点会损失生命。</p>
            </div>
            {/* 规则图鉴 */}
            {(() => {
              const discovered = getDiscoveredRules();
              if (discovered.length > 0) {
                return (
                  <div className="w-full mt-8">
                    <h3 className="text-lg font-bold text-emerald-400 mb-4">规则图鉴</h3>
                    {discovered.map(rule => (
                      <div key={rule.id} className="bg-slate-800 p-5 rounded-2xl w-full text-left shadow-lg mb-3 border border-slate-700">
                        <h4 className="text-white font-black text-base mb-3">{rule.name}</h4>
                        <div className="flex justify-center mb-3">
                          {rule.id === 'diagonal' && (
                            <svg width="160" height="160" viewBox="0 0 220 220" className="overflow-visible">
                              <style>{`
                                @keyframes rl-phase1 { 0%,28% { opacity:1 } 29%,100% { opacity:0 } }
                                @keyframes rl-phase2 { 0%,28% { opacity:0 } 29%,61% { opacity:1 } 62%,100% { opacity:0 } }
                                @keyframes rl-phase3 { 0%,61% { opacity:0 } 62%,100% { opacity:1 } }
                                @keyframes rl-pulse { 0%,100% { r:5;fill:#34d399 } 50% { r:8;fill:#6ee7b7 } }
                              `}</style>
                              {[0,1,2].map(r => [0,1,2].map(c => (
                                <circle key={`${r}-${c}`} cx={40+c*70} cy={40+r*70} r={r===1&&c===1?7:5} fill={r===1&&c===1?'#34d399':'#475569'} className={r===1&&c===1?'rl-pulse':''} style={r===1&&c===1?{animation:'rl-pulse 1.5s ease-in-out infinite'}:{}} />
                              )))}
                              <g style={{animation:'rl-phase1 4.5s ease-in-out infinite'}}>
                                <line x1="110" y1="110" x2="110" y2="180" stroke="#34d399" strokeWidth="2.5" strokeDasharray="5 3" />
                                <text x="130" y="150" fill="#34d399" fontSize="14" fontWeight="bold">↓</text>
                              </g>
                              <g style={{animation:'rl-phase2 4.5s ease-in-out infinite'}}>
                                <line x1="110" y1="110" x2="180" y2="180" stroke="#facc15" strokeWidth="2.5" strokeDasharray="5 3" />
                                <text x="155" y="155" fill="#facc15" fontSize="14" fontWeight="bold">↘</text>
                              </g>
                              <g style={{animation:'rl-phase3 4.5s ease-in-out infinite'}}>
                                {[{l:'↖',dr:-1,dc:-1},{l:'↑',dr:-1,dc:0},{l:'↗',dr:-1,dc:1},{l:'←',dr:0,dc:-1},{l:'→',dr:0,dc:1},{l:'↙',dr:1,dc:-1},{l:'↓',dr:1,dc:0},{l:'↘',dr:1,dc:1}].map((d,i) => {
                                  const tx=110+d.dc*70, ty=110+d.dr*70;
                                  return <g key={i}><line x1="110" y1="110" x2={tx} y2={ty} stroke="#818cf8" strokeWidth="1.5" opacity="0.5" /><text x={(110+tx)/2} y={(110+ty)/2+3} fill="#818cf8" fontSize="12" fontWeight="bold" textAnchor="middle">{d.l}</text></g>;
                                })}
                              </g>
                            </svg>
                          )}
                        </div>
                        <p className="text-slate-400 text-sm leading-relaxed">{rule.description}</p>
                      </div>
                    ))}
                  </div>
                );
              }
              return null;
            })()}
            <button onClick={() => setView('home')} className="mt-6 bg-emerald-500 hover:bg-emerald-400 text-white w-full py-4 rounded-xl font-bold text-lg active:scale-95 transition">
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
        
        const isCurrentStroke = combo >= 2 && i >= (path.length - combo);
        let color = "#34d399";
        let wClass = N > 7 ? "4" : "6";
        let glowClass = "drop-shadow-md";

        if (isCurrentStroke) {
          if (combo >= 16) {
            color = "#fbbf24"; 
            wClass = N > 7 ? "6" : "8";
            glowClass = "drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]";
          } else if (combo >= 5) {
            wClass = N > 7 ? "6" : "8"; 
          }
        }

        lines.push({
          x1: `${(c1 + 0.5) * (100 / N)}%`, y1: `${(r1 + 0.5) * (100 / N)}%`,
          x2: `${(c2 + 0.5) * (100 / N)}%`, y2: `${(r2 + 0.5) * (100 / N)}%`,
          color, wClass, glowClass
        });
      }

      const formatTime = (secs) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
      };

      let comboInfo = null;
      if (combo >= 16) comboInfo = { text: 'Unstoppable!', color: 'from-yellow-300 to-amber-500', multi: 'x3.0' };
      else if (combo >= 10) comboInfo = { text: 'Excellent!', color: 'from-purple-400 to-pink-500', multi: 'x2.0' };
      else if (combo >= 5) comboInfo = { text: 'Great!', color: 'from-cyan-300 to-blue-500', multi: 'x1.5' };
      else if (combo >= 2) comboInfo = { text: 'Good!', color: 'from-emerald-300 to-green-500', multi: 'x1.2' };

      return (
        <div className="min-h-screen bg-slate-900 flex flex-col font-sans overflow-hidden relative">
          
          <div className="flex justify-between items-center px-4 py-3 bg-slate-800 text-white shadow-md z-10">
            <div className="flex items-center gap-3 w-28">
              <button onClick={() => {
                if (status === 'playing') {
                  if (path.length > 1) setShowExitPrompt(true);
                  else { setView('levels'); localStorage.removeItem(getSavedGameKey(playMode)); }
                } else setView('levels');
              }} className="active:scale-90 text-slate-300 hover:text-white transition p-1 bg-slate-700/50 rounded-lg"><ChevronLeft size={24} /></button>
              
              <button onClick={restartCurrentGame} title="重新开始"
                      className="active:scale-90 text-slate-300 hover:text-white transition p-1.5 bg-slate-700/50 rounded-lg"><RotateCcw size={20} /></button>
            </div>
            
            <div className="flex flex-1 items-center justify-center gap-4">
              <span className="text-slate-300 font-bold text-sm hidden sm:inline whitespace-nowrap">{currentMode.name} · Lv {displayLevelNumber}</span>
              <span className="text-slate-300 font-mono font-bold text-sm tracking-wider">{formatTime(timer)}</span>
              {portalRun ? (
                <span className="text-sm font-black text-violet-300 leading-none whitespace-nowrap">
                  {path.length - 1}/{targetSteps} 步
                </span>
              ) : (
                <span className="text-sm font-bold text-slate-400 leading-none whitespace-nowrap">
                  {score} <span className="text-[10px] font-bold text-slate-600 ml-0.5">分</span>
                </span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 w-28">
              <div className="flex items-center gap-1 text-slate-500 font-bold text-xs bg-slate-900/30 px-2 py-1.5 rounded">
                <CircleDollarSign size={14} /> {coins}
              </div>
              <div className="flex items-center gap-1 text-rose-400 font-bold text-xs bg-slate-900/50 px-2 py-1.5 rounded shadow-inner">
                <Heart size={14} fill="currentColor" /> {hp}
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
            
            {!portalRun && <div className={`absolute top-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300 ${combo >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-90 translate-y-4'}`}>
              {comboInfo && (
                <div className="flex flex-col items-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  <div className={`text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-r ${comboInfo.color}`}>
                    {combo} Combo!
                  </div>
                  <div className="text-white font-bold tracking-widest text-sm bg-slate-900/80 px-3 rounded-full mt-1 border border-slate-600 shadow-xl flex items-center gap-1">
                    {comboInfo.text} <span className="text-yellow-400">{comboInfo.multi} 倍</span>
                  </div>
                </div>
              )}
            </div>}

            {!portalRun && floatingScore && (
               <div key={floatingScore.id} className="absolute top-1/4 left-1/2 -translate-x-1/2 z-40 pointer-events-none animate-in fade-in slide-in-from-bottom-8 duration-700 fade-out drop-shadow-md text-emerald-300 font-black text-2xl">
                 +{floatingScore.val}
               </div>
            )}

            {firstLevelHintMode === playMode && levelIdx === 0 && status === 'playing' && (
              <div className="w-full max-w-md mb-4 bg-emerald-500/10 border border-emerald-400/30 rounded-2xl px-4 py-3 text-left text-sm text-slate-200 shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-emerald-300 font-black mb-1">提示</p>
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
              className="relative w-full max-w-md aspect-square bg-slate-800 rounded-xl p-1 shadow-2xl touch-none select-none transition-transform duration-75"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onContextMenu={e => e.preventDefault()}
            >
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" style={{ padding: '0.25rem' }}>
                {lines.map((l, i) => (
                  <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.color} strokeWidth={l.wClass} strokeLinecap="round" className={`transition-all duration-300 ${l.glowClass}`} />
                ))}
              </svg>

              <div className="w-full h-full" style={{ display: 'grid', gridTemplateColumns: `repeat(${N}, 1fr)`, gridTemplateRows: `repeat(${N}, 1fr)` }}>
                {gridData.map((cell, idx) => {
                  const inPath = path.includes(idx);
                  const posInPath = path.indexOf(idx);
                  const isHead = path[path.length - 1] === idx;
                  const isError = wrongFlash === idx;
                  
                  const isInCurrentStroke = inPath && combo >= 2 && posInPath >= (path.length - combo);
                  
                  let bgClass = "bg-slate-700/80";
                  let textClass = "text-transparent";
                  let content = "";
                  const portalId = cell.portalId;
                  const isPortalEntryActive = activePortal?.entryIndex === idx;
                  const isPortalExitActive = activePortal?.exitIndex === idx;

                  if (cell.isHidden && !cell.isRevealed) {
                    if (cell.isHinted) {
                      bgClass = "bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)] animate-pulse";
                      textClass = "text-white";
                      content = cell.val;
                    }
                  } else {
                    content = cell.val;
                    textClass = "text-white";
                    
                    if (inPath) {
                       if (portalId) {
                         bgClass = "bg-fuchsia-500 shadow-[0_0_16px_rgba(217,70,239,0.75)]";
                       } else if (isInCurrentStroke && combo >= 16) {
                         bgClass = "bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.8)]";
                         textClass = "text-slate-900"; 
                       } else {
                         bgClass = "bg-emerald-500 shadow-lg";
                       }
                    } else {
                       bgClass = portalId ? "bg-violet-600 shadow-[0_0_12px_rgba(124,58,237,0.65)]" : "bg-slate-600 shadow-md";
                    }
                  }

                  if (isError) bgClass = "bg-rose-500 animate-pulse";
                  if (portalId) {
                    content = inPath ? cell.val : "?";
                    textClass = "text-white";

                    if (inPath) {
                      bgClass = isPortalEntryActive ? "bg-fuchsia-500 shadow-[0_0_16px_rgba(217,70,239,0.75)]" : "bg-violet-700/90 shadow-md";
                    } else if (isPortalExitActive) {
                      bgClass = "bg-violet-400 animate-pulse shadow-[0_0_20px_rgba(196,181,253,0.95)]";
                    } else {
                      bgClass = "bg-slate-700/80 shadow-md border border-violet-500/40";
                    }
                  }
                  
                  return (
                    <div key={idx} className="p-0.5 md:p-1" data-index={idx}>
                      <div 
                        data-index={idx}
                        className={`w-full h-full flex items-center justify-center rounded-lg font-bold transition-all duration-200 
                          ${N === 5 ? 'text-3xl' : N === 7 ? 'text-2xl' : 'text-lg'}
                          ${bgClass} ${textClass} ${isHead ? 'ring-4 ring-emerald-300 ring-opacity-50 scale-105' : ''}
                          ${isPortalExitActive ? 'ring-4 ring-violet-200 ring-opacity-80 scale-105' : ''}
                          ${cell.isRevealed && inPath && !isInCurrentStroke ? 'scale-105' : ''}
                        `}
                      >
                        {cell.isExcluded ? <X className="text-rose-500 absolute" size={N > 7 ? 20 : 32} /> : content}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="mt-6 flex justify-between w-full max-w-md px-2 text-slate-400 font-medium">
              <div>路径长度: <span className="text-white text-lg">{path.length}</span> / {N * N}</div>
              {portalRun ? (
                <div className="text-violet-300">目标: {targetSteps} 步</div>
              ) : (
                <div className="text-purple-400">最大连击: {maxCombo}</div>
              )}
            </div>
          </div>

          <div className="bg-slate-900/95 border-t border-slate-800 flex justify-around items-center rounded-t-2xl shadow-[0_-4px_18px_rgba(0,0,0,0.25)] z-10 py-3 px-4">
            {[
              { id: 'heal', icon: PlusCircle, name: '恢复', desc: '恢复 1 点生命值', color: 'text-green-400' },
              { id: 'exclude', icon: Ban, name: '排除', desc: '排查出一个错误干扰', color: 'text-rose-400' },
              { id: 'hint', icon: Lightbulb, name: '提示', desc: '点亮下一步的数字', color: 'text-yellow-400' }
            ].map(item => (
              <button key={item.id} onClick={() => handleUseItem(item.id)} className="group flex flex-col items-center justify-center gap-1 active:scale-90 transition relative">
                <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none whitespace-nowrap z-10 border border-slate-700">
                  {item.desc}
                </div>
                <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shadow-inner relative">
                  <item.icon className={item.color} size={22} />
                  {items[item.id] > 0 ? (
                    <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-slate-900">{items[item.id]}</span>
                  ) : (
                    <span className="absolute -bottom-2 bg-slate-900 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-slate-700 flex items-center gap-0.5">
                      <CircleDollarSign size={10} /> {SHOP[item.id]}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-500 font-medium mt-1">{item.name}</span>
              </button>
            ))}
          </div>

          {purchasePrompt && (
            <div className="absolute inset-0 bg-slate-900/70 z-[70] flex items-center justify-center p-4">
              <div className="bg-slate-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-in zoom-in duration-300 border border-slate-700">
                <h2 className="text-2xl font-black text-yellow-400 mb-4 flex items-center justify-center gap-2">
                  <CircleDollarSign size={28} /> 购买道具
                </h2>
                <p className="text-slate-300 mb-8 leading-relaxed">
                  您即将花费 <span className="text-yellow-400 font-bold">{purchasePrompt.cost} 金币</span> <br/>
                  购买道具 <span className="text-emerald-400 font-bold">“{purchasePrompt.name}”</span><br/>
                  是否确认？
                </p>
                <div className="flex gap-4">
                  <button onClick={() => setPurchasePrompt(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 transition text-white py-3 rounded-xl font-bold">取消</button>
                  <button onClick={() => {
                    setCoins(c => c - purchasePrompt.cost);
                    setItems(p => ({ ...p, [purchasePrompt.type]: p[purchasePrompt.type] + 1 }));
                    showToast(`成功购买道具“${purchasePrompt.name}”！`);
                    setPurchasePrompt(null);
                  }} className="flex-1 bg-yellow-500 hover:bg-yellow-400 transition text-slate-900 py-3 rounded-xl font-bold shadow-[0_0_15px_rgba(234,179,8,0.4)]">确认购买</button>
                </div>
              </div>
            </div>
          )}
          {status !== 'playing' && (

            <div className="absolute inset-0 bg-slate-900/85 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
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
                <LosePanel coins={coins} onRevive={handleRevive} onRestart={restartCurrentGame} onBackToLevels={() => { setView('levels'); clearNormalSavedGame(); }} />
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
        <SettingsPanel sfxVol={sfxVol} onSfxVolChange={setSfxVol} onClose={() => setShowSettings(false)} />
      )}
      
      {toast && (
        <div className="fixed top-16 left-1/2 transform -translate-x-1/2 bg-slate-800/95 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl z-[99999] border border-slate-700 animate-in fade-in slide-in-from-top-4 flex items-center gap-3">
          <Info size={20} className="text-emerald-400" />
          <span className="font-bold text-sm tracking-wide">{toast}</span>
        </div>
      )}
    </>
  );
}
