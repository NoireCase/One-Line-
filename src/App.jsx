import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Info, Star, CircleDollarSign, Ban, 
  Lightbulb, Lock, X, RotateCcw, Heart, FastForward, 
  Settings, ChevronLeft, ChevronRight, ShieldAlert, PlusCircle, CalendarDays
} from 'lucide-react';
import ModeSelectPage from './components/ModeSelectPage.jsx';
import {
  GAME_MODE_LIST,
  GAME_MODES,
  MOVEMENT_TYPES,
  PLAY_MODES,
  getGameModeConfig,
  getLevelsPerDiff,
  getSavedGameKey
} from './config/gameModes.js';

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
const LEVELS_PER_DIFF = GAME_MODES[PLAY_MODES.diagonal].levelCount;
const DAILY_STORAGE_KEY = 'dailyChallenge';
const DAILY_DIFF_ORDER = ['easy', 'medium', 'hard'];
const DIFF_LABELS = { easy: '简单', medium: '中等', hard: '困难' };
const MS_PER_DAY = 24 * 60 * 60 * 1000;
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
  [PLAY_MODES.classic]: { ...ORTHOGONAL_RULE, movement: GAME_MODES[PLAY_MODES.classic].movement },
  [PLAY_MODES.diagonal]: { ...DIAGONAL_RULE, movement: GAME_MODES[PLAY_MODES.diagonal].movement },
  [PLAY_MODES.portal]: { ...PORTAL_RULE, movement: GAME_MODES[PLAY_MODES.portal].movement }
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
    id: 'portal-alpha-easy-gate',
    name: 'Alpha 入口发现',
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
    name: 'Alpha 折返缺口',
    N: 5,
    targetSteps: 24,
    path: [18, 24, 19, 14, 9, 4, 3, 8, 5, 0, 1, 2, 7, 13, 12, 6, 10, 11, 15, 20, 16, 21, 17, 22, 23],
    portals: [
      { id: 'A', cells: [5, 8] }
    ],
    hiddenVals: [5, 14, 19, 24]
  },
  {
    id: 'portal-alpha-normal-cross',
    name: 'Alpha 双门换区',
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
    name: 'Alpha 远端回收',
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
    id: 'portal-alpha-hard-relay',
    name: 'Alpha 三段接力',
    N: 5,
    targetSteps: 24,
    path: [7, 1, 0, 19, 24, 23, 22, 21, 20, 15, 2, 3, 4, 9, 8, 17, 16, 10, 5, 11, 6, 12, 13, 18, 14],
    portals: [
      { id: 'A', cells: [8, 17] },
      { id: 'B', cells: [15, 2] },
      { id: 'C', cells: [19, 0] }
    ],
    hiddenVals: [6, 12, 18, 21, 24]
  }
];

const isPortalMode = (mode) => mode === PLAY_MODES.portal;

const getPortalLevel = (levelIdx) => PORTAL_LEVELS[levelIdx] || PORTAL_LEVELS[0];

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

const createLevelConfig = (difficulty, levelIdx, playMode = PLAY_MODES.diagonal) => ({
  id: `${playMode}-${difficulty}-${levelIdx + 1}`,
  difficulty,
  levelIdx,
  playMode,
  rules: RULE_BY_PLAY_MODE[playMode] || DIAGONAL_RULE,
  ...(isPortalMode(playMode) ? { portalLevel: getPortalLevel(levelIdx), targetSteps: getPortalLevel(levelIdx).targetSteps } : {})
});

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

const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDailyChallenge = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const dayNumber = Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
  const totalLevels = DAILY_DIFF_ORDER.length * LEVELS_PER_DIFF;
  const globalIndex = (dayNumber * 37 + 17) % totalLevels;
  const diff = DAILY_DIFF_ORDER[Math.floor(globalIndex / LEVELS_PER_DIFF)];
  const levelIdx = globalIndex % LEVELS_PER_DIFF;
  return { diff, levelIdx };
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

// --- 结算面板独立组件 (支持动画滚动) ---
const WinPanel = ({ report, levelIdx, maxLevelCount, onBack, onNext, onRetry, isDailyChallenge = false }) => {
  const {
    completionScore = 0,
    timeBonus = 0,
    lifeBonus = 0,
    comboBonus = 0,
    ruleBonus = 0,
    totalScore = 0,
    coinReward = 0,
    sMax = 1
  } = report;
  const isPortalReport = report.isPortal;
  const [total, setTotal] = useState(0);
  const [animating, setAnimating] = useState(true);

  const step1 = completionScore;
  const step2 = step1 + timeBonus;
  const step3 = step2 + lifeBonus;
  const step4 = step3 + comboBonus;
  const step5 = step4 + ruleBonus;

  useEffect(() => {
    let startTime = performance.now();
    // 动画时长大幅增加至 4.5 秒，保证玩家能看清每一行
    const duration = 4500; 
    let animFrame;

    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // 使用更平缓的曲线，让跳分有均匀攀升感
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      setTotal(Math.floor(easeProgress * totalScore));

      if (progress < 1) {
        animFrame = requestAnimationFrame(tick);
      } else {
        setTotal(totalScore);
        setAnimating(false);
      }
    };
    animFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrame);
  }, [totalScore]);

  const renderRowVal = (target, offsetStart, offsetEnd) => {
    if (total <= offsetStart) return 0;
    if (total >= offsetEnd) return target;
    return total - offsetStart;
  };

  if (isPortalReport) {
    return (
      <div className="bg-slate-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-[0_0_40px_rgba(0,0,0,0.5)] transform animate-in zoom-in duration-300 border border-violet-500/40">
        <h2 className="text-3xl font-black text-violet-300 mb-2 drop-shadow-md">Portal 通关！</h2>

        <div className="flex justify-center gap-2 mb-6 h-12 items-center">
          {[1, 2, 3].map(s => (
            <div key={s} className="relative w-10 h-10 flex items-center justify-center">
              <Star size={36} className="text-slate-700 absolute" />
              {s <= report.stars && (
                <Star size={36} className="absolute text-yellow-400 fill-yellow-400 animate-star-drop drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]" />
              )}
            </div>
          ))}
        </div>

        <div className="bg-slate-900/60 rounded-2xl p-5 mb-6 text-sm text-slate-300 space-y-3 shadow-inner border border-slate-800 text-left">
          <div className="flex justify-between items-center">
            <span>当前步数</span>
            <span className="font-mono font-black text-violet-300">{report.steps}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>路径长度</span>
            <span className="font-mono font-bold text-white">{report.pathLength}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>3星目标</span>
            <span className="font-mono font-bold text-emerald-300">{report.targetSteps} 步</span>
          </div>
          <div className="flex justify-between items-center border-t border-slate-700 pt-3">
            <span>最佳步数</span>
            <span className="font-mono font-black text-yellow-300">{report.bestSteps} 步</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onBack} className="flex-[1] bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-bold active:scale-95 transition text-sm">返回</button>
          <button onClick={onRetry} className="flex-[1] bg-slate-600 hover:bg-slate-500 text-white py-3 rounded-xl font-bold active:scale-95 transition flex justify-center items-center gap-1 text-sm">
            <RotateCcw size={16} /> 重玩
          </button>
          {levelIdx + 1 < maxLevelCount && (
            <button onClick={onNext} className="flex-[1.5] bg-violet-500 hover:bg-violet-400 text-white py-3 rounded-xl font-bold active:scale-95 transition flex justify-center items-center gap-1 shadow-[0_0_15px_rgba(139,92,246,0.4)] text-sm">
              下一关 <FastForward size={16} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // 动态评定星级，随分数暴涨逐步亮起，绑定 S_max 比例
  let currentStars = 1;
  if (total >= sMax * 0.9) currentStars = 3;
  else if (total >= sMax * 0.6) currentStars = 2;

  return (
    <div className="bg-slate-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-[0_0_40px_rgba(0,0,0,0.5)] transform animate-in zoom-in duration-300 border border-slate-700">
      <h2 className="text-3xl font-black text-emerald-400 mb-2 drop-shadow-md">{isDailyChallenge ? '今日挑战完成！' : '完美过关！'}</h2>
      
      {/* 动态落星区 */}
      <div className="flex justify-center gap-2 mb-6 h-12 items-center">
        {[1, 2, 3].map(s => {
           const isActive = s <= currentStars;
           return (
             <div key={s} className="relative w-10 h-10 flex items-center justify-center">
               <Star size={36} className="text-slate-700 absolute" />
               {isActive && (
                 <Star size={36} className="absolute text-yellow-400 fill-yellow-400 animate-star-drop drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]" />
               )}
             </div>
           )
        })}
      </div>

      {/* 计分板流水 */}
      <div className="bg-slate-900/60 rounded-2xl p-5 mb-6 text-sm text-slate-300 space-y-3 shadow-inner border border-slate-800 text-left relative overflow-hidden">
         {total > 0 && (
            <div className="flex justify-between items-center animate-in fade-in slide-in-from-left-4">
              <span>完成分</span>
              <span className="font-mono font-bold text-white">{renderRowVal(completionScore, 0, step1)}</span>
            </div>
         )}
         {total > step1 && (
            <div className="flex justify-between items-center animate-in fade-in slide-in-from-left-4">
              <span>时间加成</span>
              <span className="font-mono text-yellow-400">+{renderRowVal(timeBonus, step1, step2)}</span>
            </div>
         )}
         {total > step2 && (
            <div className="flex justify-between items-center animate-in fade-in slide-in-from-left-4">
              <span>生命加成</span>
              <span className="font-mono text-rose-400">+{renderRowVal(lifeBonus, step2, step3)}</span>
            </div>
         )}
         {total > step3 && (
            <div className="flex justify-between items-center animate-in fade-in slide-in-from-left-4">
              <span>连击加成</span>
              <span className="font-mono text-purple-400">+{renderRowVal(comboBonus, step3, step4)}</span>
            </div>
         )}
         <div className="flex justify-between items-center border-b border-slate-700 pb-3 animate-in fade-in slide-in-from-left-4">
           <span>规则加成</span>
           <span className="font-mono text-cyan-300">{ruleBonus > 0 ? `+${renderRowVal(ruleBonus, step4, step5)}` : '暂未启用'}</span>
         </div>
          
         <div className="flex justify-between items-center text-lg font-black pt-1">
           <span className="text-white tracking-widest">总分</span> 
           <span className="font-mono text-emerald-400 text-2xl drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]">{total}</span>
         </div>
      </div>

      {isDailyChallenge ? (
        <div className="flex justify-center gap-4 mb-6">
          <div className={`bg-emerald-500/15 text-emerald-300 px-5 py-2.5 rounded-full font-bold text-lg border border-emerald-500/30 transition-opacity duration-500 ${animating ? 'opacity-0' : 'opacity-100'}`}>
            今日记录已保存
          </div>
        </div>
      ) : (
        <div className="flex justify-center gap-4 mb-6">
          <div className={`bg-yellow-500/20 text-yellow-400 px-5 py-2.5 rounded-full font-bold flex items-center gap-2 text-lg border border-yellow-500/30 transition-opacity duration-500 ${animating ? 'opacity-0' : 'opacity-100'}`}>
            <CircleDollarSign size={20} /> 奖励 +{coinReward} 金币
          </div>
        </div>
      )}
      
      {/* 操作按钮区 */}
      <div className={`flex gap-3 transition-opacity duration-500 ${animating ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <button onClick={onBack} className="flex-[1] bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-bold active:scale-95 transition text-sm">返回</button>
        <button onClick={onRetry} className="flex-[1] bg-slate-600 hover:bg-slate-500 text-white py-3 rounded-xl font-bold active:scale-95 transition flex justify-center items-center gap-1 text-sm">
          <RotateCcw size={16} /> {isDailyChallenge ? '再次挑战' : '重玩'}
        </button>
        {!isDailyChallenge && levelIdx + 1 < maxLevelCount && (
          <button onClick={onNext} className="flex-[1.5] bg-emerald-500 hover:bg-emerald-400 text-white py-3 rounded-xl font-bold active:scale-95 transition flex justify-center items-center gap-1 shadow-[0_0_15px_rgba(16,185,129,0.4)] text-sm">
            下一关 <FastForward size={16} />
          </button>
        )}
      </div>
    </div>
  );
};


// --- 主应用组件 ---
export default function App() {
  const [view, setView] = useState('home');
  const [playMode, setPlayMode] = useState(PLAY_MODES.diagonal);
  const [diff, setDiff] = useState('easy');
  const [levelIdx, setLevelIdx] = useState(0);
  const [gameMode, setGameMode] = useState('normal');
  const [todayKey, setTodayKey] = useState(() => getLocalDateKey());
  const [dailyRunDateKey, setDailyRunDateKey] = useState(null);

  // 全局经济、进度与全局积分池系统
  const [coins, setCoins] = useState(100);
  const [items, setItems] = useState({ heal: 3, exclude: 3, hint: 3 });
  const [progress, setProgress] = useState({ easy: [0], medium: [0], hard: [0] });
  const [highScores, setHighScores] = useState({ easy: [], medium: [], hard: [] });
  const [classicProgress, setClassicProgress] = useState({ easy: [0], medium: [0], hard: [0] });
  const [classicHighScores, setClassicHighScores] = useState({ easy: [], medium: [], hard: [] });
  const [portalProgress, setPortalProgress] = useState({ easy: [0], medium: [0], hard: [0] });
  const [portalBestSteps, setPortalBestSteps] = useState({ easy: [], medium: [], hard: [] });
  const [globalScore, setGlobalScore] = useState(0);
  const [dailyChallenge, setDailyChallenge] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(DAILY_STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  });

  // 设置菜单与音量
  const [showSettings, setShowSettings] = useState(false);
  const [sfxVol, setSfxVol] = useState(100);
  const [musicVol, setMusicVol] = useState(100);

  // 全局浮窗提示与二级确认框
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);
  const [purchasePrompt, setPurchasePrompt] = useState(null);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  
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
      const sProg = localStorage.getItem(GAME_MODES[PLAY_MODES.diagonal].progressKey);
      if (sProg) setProgress(JSON.parse(sProg));
      const sHighScores = localStorage.getItem(GAME_MODES[PLAY_MODES.diagonal].highScoresKey);
      if (sHighScores) setHighScores(JSON.parse(sHighScores));
      const sClassicProg = localStorage.getItem(GAME_MODES[PLAY_MODES.classic].progressKey);
      if (sClassicProg) setClassicProgress(JSON.parse(sClassicProg));
      const sClassicHighScores = localStorage.getItem(GAME_MODES[PLAY_MODES.classic].highScoresKey);
      if (sClassicHighScores) setClassicHighScores(JSON.parse(sClassicHighScores));
      const sPortalProg = localStorage.getItem(GAME_MODES[PLAY_MODES.portal].progressKey);
      if (sPortalProg) setPortalProgress(JSON.parse(sPortalProg));
      const sPortalBestSteps = localStorage.getItem(GAME_MODES[PLAY_MODES.portal].highScoresKey);
      if (sPortalBestSteps) setPortalBestSteps(JSON.parse(sPortalBestSteps));
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

  useEffect(() => {
    const timerId = setInterval(() => {
      setTodayKey(getLocalDateKey());
    }, 60000);
    return () => clearInterval(timerId);
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
    localStorage.setItem(GAME_MODES[PLAY_MODES.diagonal].progressKey, JSON.stringify(progress));
    localStorage.setItem(GAME_MODES[PLAY_MODES.diagonal].highScoresKey, JSON.stringify(highScores));
    localStorage.setItem(GAME_MODES[PLAY_MODES.classic].progressKey, JSON.stringify(classicProgress));
    localStorage.setItem(GAME_MODES[PLAY_MODES.classic].highScoresKey, JSON.stringify(classicHighScores));
    localStorage.setItem(GAME_MODES[PLAY_MODES.portal].progressKey, JSON.stringify(portalProgress));
    localStorage.setItem(GAME_MODES[PLAY_MODES.portal].highScoresKey, JSON.stringify(portalBestSteps));
    localStorage.setItem('cg_global_score', globalScore.toString());
  }, [coins, items, progress, highScores, classicProgress, classicHighScores, portalProgress, portalBestSteps, globalScore]);

  useEffect(() => {
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(dailyChallenge));
  }, [dailyChallenge]);

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
    const { clearSavedGame = true, targetPlayMode = PLAY_MODES.diagonal } = options;
    if (clearSavedGame) localStorage.removeItem(getSavedGameKey(targetPlayMode));
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

    const config = CONFIG[targetDiff];
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
    sound.init();
    setGameMode('normal');
    setDailyRunDateKey(null);
    setPlayMode(targetPlayMode);
    setDiff(d);
    setLevelIdx(lvl);
    
    const savedStr = localStorage.getItem(getSavedGameKey(targetPlayMode));
    if (savedStr) {
      try {
        const saved = JSON.parse(savedStr);
        if (saved.diff === d && saved.levelIdx === lvl && (saved.playMode || PLAY_MODES.diagonal) === targetPlayMode) {
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

  const startDailyChallenge = () => {
    const challenge = getDailyChallenge(todayKey);
    sound.init();
    setGameMode('daily');
    setPlayMode(PLAY_MODES.diagonal);
    setDailyRunDateKey(todayKey);
    setDiff(challenge.diff);
    setLevelIdx(challenge.levelIdx);
    initGame(challenge.diff, challenge.levelIdx, { clearSavedGame: false, targetPlayMode: PLAY_MODES.diagonal });
    setView('game');
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
    if (gameMode === 'normal') localStorage.removeItem(getSavedGameKey(playMode));

    const config = CONFIG[diff];
    const levelConfig = createLevelConfig(diff, levelIdx, playMode);
    const isDailyChallenge = gameMode === 'daily';

    if (levelConfig.portalLevel && !isDailyChallenge) {
      const steps = completedPath.length - 1;
      const pathLength = completedPath.length;
      const stars = calculatePortalStars(steps, levelConfig.targetSteps);
      const currentBestSteps = portalBestSteps[diff]?.[levelIdx] || 0;
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
        let newDiffProg = [...prev[diff]];
        if (!newDiffProg[levelIdx] || newDiffProg[levelIdx] < stars) newDiffProg[levelIdx] = stars;
        if (levelIdx + 1 < getLevelsPerDiff(playMode) && newDiffProg.length === levelIdx + 1) newDiffProg.push(0);
        return { ...prev, [diff]: newDiffProg };
      });

      setPortalBestSteps(prev => {
        let newDiffSteps = [...(prev[diff] || [])];
        const current = newDiffSteps[levelIdx] || 0;
        if (!current || steps < current) {
          newDiffSteps[levelIdx] = steps;
        }
        return { ...prev, [diff]: newDiffSteps };
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

    const coinReward = isDailyChallenge ? 0 : config.coins + (scoreReport.stars * 5);
    const finalLevelScore = scoreReport.totalLevelScore;
    const stars = scoreReport.stars;

    setLevelReport({
      ...scoreReport,
      coinReward
    });

    if (isDailyChallenge) {
      const recordDate = dailyRunDateKey || todayKey;
      setDailyChallenge(prev => {
        const current = prev[recordDate] || {};
        return {
          ...prev,
          [recordDate]: {
            completed: true,
            bestScore: Math.max(current.bestScore || 0, finalLevelScore),
            stars: Math.max(current.stars || 0, stars)
          }
        };
      });
      return;
    }

    setCoins(c => c + coinReward);
    setGlobalScore(prev => prev + finalLevelScore);

    const updateProgress = playMode === PLAY_MODES.classic ? setClassicProgress : setProgress;
    const updateHighScores = playMode === PLAY_MODES.classic ? setClassicHighScores : setHighScores;
    const maxLevelCount = getLevelsPerDiff(playMode);

    updateProgress(prev => {
      let newDiffProg = [...prev[diff]];
      if (!newDiffProg[levelIdx] || newDiffProg[levelIdx] < stars) newDiffProg[levelIdx] = stars;
      if (levelIdx + 1 < maxLevelCount && newDiffProg.length === levelIdx + 1) newDiffProg.push(0);
      return { ...prev, [diff]: newDiffProg };
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
    if (gameMode === 'daily') {
      showToast('每日挑战不使用道具。');
      return;
    }
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
    if (gameMode === 'daily') {
      showToast('每日挑战不可复活，请重新挑战。');
      return;
    }

    if (coins >= SHOP.revive) {
      setCoins(c => c - SHOP.revive);
      setHp(CONFIG[diff].hp);
      setStatus('playing');
    } else {
      showToast('金币不足无法复活！');
    }
  };

  const getGameExitView = () => gameMode === 'daily' ? 'daily' : 'levels';
  const clearNormalSavedGame = () => {
    if (gameMode === 'normal') localStorage.removeItem(getSavedGameKey(playMode));
  };
  const restartCurrentGame = () => {
    initGame(diff, levelIdx, { clearSavedGame: gameMode === 'normal', targetPlayMode: playMode });
  };

  const handleSaveAndExit = () => {
    if (gameMode === 'daily') {
      setShowExitPrompt(false);
      setView('daily');
      return;
    }

    const saveData = { playMode, diff, levelIdx, gridData, path, hp, timer, score: scoreRef.current, maxCombo, activePortal };
    localStorage.setItem(getSavedGameKey(playMode), JSON.stringify(saveData));
    setShowExitPrompt(false);
    setView('levels');
  };

  const handleAbandonAndExit = () => {
    clearNormalSavedGame();
    setShowExitPrompt(false);
    setView(getGameExitView());
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
        <span className="text-white font-bold text-lg tracking-wider">CleverGrid</span>
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
          
          <button onClick={() => setShowSettings(true)} className="absolute top-4 left-4 text-slate-400 hover:text-white transition p-3 bg-slate-800/80 rounded-full shadow-lg z-30">
            <Settings size={24} />
          </button>

          {globalScore > 0 && <div className="absolute top-6 right-6 text-xs text-slate-500 font-mono z-30 bg-slate-800/80 px-3 py-1.5 rounded-full shadow-lg">Score: {globalScore}/5000</div>}

          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-10 relative">
            <div>
              <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 to-cyan-500 tracking-tighter drop-shadow-lg mb-2">CleverGrid</h1>
              <p className="text-slate-400 text-lg">智力一笔画解谜</p>
            </div>
            <div className="flex flex-col gap-4 w-full max-w-xs">
              <button onClick={() => setView('mode')} className="bg-emerald-500 hover:bg-emerald-400 text-white py-4 rounded-2xl text-xl font-bold shadow-lg shadow-emerald-500/30 transition-transform active:scale-95 flex items-center justify-center gap-2">
                <Play fill="currentColor" /> 开始游戏
              </button>
              <button onClick={() => setView('daily')} className="bg-cyan-500 hover:bg-cyan-400 text-white py-4 rounded-2xl text-xl font-bold shadow-lg shadow-cyan-500/25 transition-transform active:scale-95 flex items-center justify-center gap-2">
                <CalendarDays /> 每日挑战
              </button>
              <button onClick={() => setView('tut')} className="bg-slate-700 hover:bg-slate-600 text-white py-4 rounded-2xl text-lg font-bold shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2">
                <Info /> 游戏说明
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (view === 'mode') {
      return (
        <ModeSelectPage
          modes={GAME_MODE_LIST}
          onBackHome={() => setView('home')}
          onSelectMode={(selectedMode) => {
            setPlayMode(selectedMode);
            if (isPortalMode(selectedMode)) {
              setDiff('easy');
              setView('levels');
            } else {
              setView('diff');
            }
          }}
        />
      );
    }

    if (view === 'daily') {
      const todayChallenge = getDailyChallenge(todayKey);
      const dailyMode = getGameModeConfig(PLAY_MODES.diagonal);
      const record = dailyChallenge[todayKey];
      const completed = Boolean(record?.completed);
      const bestScore = record?.bestScore || 0;
      const bestStars = record?.stars || 0;

      return (
        <div className="min-h-screen bg-slate-900 flex flex-col font-sans text-white">
          {renderHeader()}
          <div className="flex-1 p-6 flex flex-col items-center justify-center">
            <div className="w-full max-w-sm bg-slate-800 rounded-3xl p-7 shadow-2xl border border-slate-700">
              <div className="flex items-center justify-center gap-3 text-cyan-300 mb-4">
                <CalendarDays size={28} />
                <h2 className="text-3xl font-black">今日挑战</h2>
              </div>

              <div className="text-center text-slate-300 font-mono text-lg mb-8">{todayKey}</div>
              <div className="bg-slate-900/50 rounded-2xl px-4 py-3 text-center text-slate-200 font-bold mb-6 border border-slate-700">
                今日关卡：<span className="text-cyan-300">{dailyMode.name} · {DIFF_LABELS[todayChallenge.diff]} · 关卡 {todayChallenge.levelIdx + 1}</span>
              </div>

              <div className="space-y-5 text-lg">
                <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                  <span className="text-slate-400">状态</span>
                  <span className={completed ? 'text-emerald-400 font-bold' : 'text-slate-200 font-bold'}>
                    {completed ? '已完成' : '未完成'}
                  </span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                  <span className="text-slate-400">{completed ? '今日最佳分数' : '最佳成绩'}</span>
                  <span className="text-emerald-400 font-mono font-black">
                    {completed && bestScore > 0 ? bestScore : '----'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">{completed ? '今日最佳星级' : '最佳星级'}</span>
                  {completed ? (
                    <div className="flex gap-1">
                      {[1, 2, 3].map(s => (
                        <Star key={s} size={20} className={s <= bestStars ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'} />
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400 font-mono font-black">----</span>
                  )}
                </div>
              </div>

              {completed && (
                <p className="mt-6 text-center text-sm text-cyan-200 bg-cyan-500/10 border border-cyan-500/20 rounded-xl px-4 py-3">
                  可再次挑战刷新纪录
                </p>
              )}

              <button onClick={startDailyChallenge} className="mt-9 w-full bg-cyan-500 hover:bg-cyan-400 text-white py-4 rounded-2xl text-xl font-bold shadow-lg shadow-cyan-500/25 transition-transform active:scale-95 flex items-center justify-center gap-2">
                <Play fill="currentColor" /> {completed ? '再次挑战' : '开始挑战'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (view === 'diff') {
      const currentMode = getGameModeConfig(playMode);

      return (
        <div className="min-h-screen bg-slate-900 flex flex-col font-sans">
          <div className="flex justify-between items-center bg-slate-800 p-4 shadow-md">
            <button onClick={() => setView('mode')} className="text-white"><ChevronLeft size={28} /></button>
            <h2 className="text-xl font-bold text-white">{currentMode.name} 模式</h2>
            <div className="w-8"></div>
          </div>
          <div className="flex-1 p-6 flex flex-col gap-6 max-w-md mx-auto w-full pt-12">
            <h2 className="text-2xl font-bold text-white mb-1 text-center">选择难度</h2>
            <p className="text-slate-400 text-sm text-center mb-3">{currentMode.description}</p>
            {[
              { id: 'easy', name: '简单', desc: '5x5 棋盘，适合新手', color: 'from-green-400 to-emerald-600' },
              { id: 'medium', name: '中等', desc: '7x7 棋盘，进阶挑战', color: 'from-blue-400 to-indigo-600' },
              { id: 'hard', name: '困难', desc: '9x9 棋盘，烧脑极限', color: 'from-rose-400 to-red-600' }
            ].map(d => (
              <div key={d.id} onClick={() => { setDiff(d.id); setView('levels'); }} 
                   className={`cursor-pointer rounded-2xl p-6 bg-gradient-to-br ${d.color} shadow-lg transform transition active:scale-95 text-white flex justify-between items-center`}>
                <div>
                  <h3 className="text-2xl font-black">{d.name}</h3>
                  <p className="opacity-90 mt-1">{d.desc}</p>
                </div>
                <ChevronRight size={32} opacity={0.8} />
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (view === 'levels') {
      const diffText = isPortalMode(playMode) ? 'MVP 测试关卡' : { easy: '简单', medium: '中等', hard: '困难' }[diff];
      const currentMode = getGameModeConfig(playMode);
      const modeProgress = isPortalMode(playMode) ? portalProgress : playMode === PLAY_MODES.classic ? classicProgress : progress;
      const modeHighScores = isPortalMode(playMode) ? portalBestSteps : playMode === PLAY_MODES.classic ? classicHighScores : highScores;
      const levelCount = getLevelsPerDiff(playMode);
      
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
            <button onClick={() => setView(isPortalMode(playMode) ? 'mode' : 'diff')} className="text-white"><ChevronLeft size={28} /></button>
            <div className="text-center">
              <h2 className="text-xl font-bold text-white">{currentMode.name} 模式</h2>
              <p className="text-xs text-slate-400">{diffText} · {currentMode.description}</p>
            </div>
            <div className="w-8"></div>
          </div>
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="grid grid-cols-4 gap-4 max-w-md mx-auto">
              {Array.from({ length: levelCount }).map((_, i) => {
                const stars = modeProgress[diff][i];
                const isUnlocked = typeof stars === 'number';
                const savedPlayMode = savedLevelInfo?.playMode || PLAY_MODES.diagonal;
                const hasSave = savedLevelInfo && savedPlayMode === playMode && savedLevelInfo.diff === diff && savedLevelInfo.levelIdx === i;
                const hs = modeHighScores[diff][i] || 0;
                
                return (
                  <div key={i} 
                       onClick={() => { if(isUnlocked) startGame(diff, i, playMode); }}
                       className={`aspect-square rounded-2xl flex flex-col items-center justify-between p-3 relative transition shadow-md ${isUnlocked ? 'bg-slate-700 cursor-pointer hover:bg-slate-600 active:scale-95' : 'bg-slate-800/50 opacity-50'}`}>
                    {hasSave && <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" title="已保存进度"></div>}
                    {isUnlocked ? (
                      <>
                        <span className="text-slate-400 font-bold text-sm mt-1">关卡 {i + 1}</span>
                        {hs > 0 ? (
                          <span className={`text-emerald-400 font-mono font-black drop-shadow-md leading-none ${isPortalMode(playMode) ? 'text-lg' : 'text-2xl'}`}>
                            {isPortalMode(playMode) ? `${hs}步` : hs}
                          </span>
                        ) : (
                           <span className="text-slate-500 font-mono font-bold text-xl leading-none">-</span>
                        )}
                        <div className="flex gap-1 mb-1">
                          {[1, 2, 3].map(s => <Star key={s} size={14} className={s <= stars && stars > 0 ? "text-yellow-400 fill-yellow-400 filter drop-shadow-[0_0_4px_rgba(250,204,21,0.5)]" : "text-slate-600"} />)}
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex items-center justify-center w-full"><Lock className="text-slate-500" size={28} /></div>
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
            <h2 className="text-2xl font-bold mb-6 text-emerald-400">游戏说明</h2>
            <div className="bg-slate-800 p-6 rounded-2xl w-full text-left space-y-4 shadow-lg leading-relaxed text-slate-200">
              <p><span className="text-emerald-400 font-bold">目标：</span>从数字 1 开始，按住并拖动以递增顺序（1→2→3...）连接所有方块。</p>
              <p><span className="text-emerald-400 font-bold">规则：</span>支持横、竖、斜向连线。线路不可交叉，不可重复经过同一个格子。</p>
              <p><span className="text-emerald-400 font-bold">隐藏：</span>部分数字被隐藏，你需要通过逻辑推理找出正确的下一步。猜错将扣除生命值。</p>
            </div>
            <button onClick={() => setView('home')} className="mt-10 bg-emerald-500 hover:bg-emerald-400 text-white w-full py-4 rounded-xl font-bold text-lg active:scale-95 transition">
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
                  if (gameMode === 'daily') {
                    setView('daily');
                  } else if (path.length > 1) setShowExitPrompt(true);
                  else { setView('levels'); localStorage.removeItem(getSavedGameKey(playMode)); }
                } else setView(getGameExitView());
              }} className="active:scale-90 text-slate-300 hover:text-white transition p-1 bg-slate-700/50 rounded-lg"><ChevronLeft size={24} /></button>
              
              <button onClick={restartCurrentGame} title="重新开始"
                      className="active:scale-90 text-slate-300 hover:text-white transition p-1.5 bg-slate-700/50 rounded-lg"><RotateCcw size={20} /></button>
            </div>
            
            <div className="flex flex-1 items-center justify-center gap-4">
              <span className="text-slate-300 font-bold text-sm hidden sm:inline whitespace-nowrap">{gameMode === 'daily' ? '每日挑战' : `${currentMode.name} · 关卡 ${levelIdx + 1}`}</span>
              <span className="text-slate-500 text-xs hidden md:inline whitespace-nowrap">{currentMode.description}</span>
              <span className="text-slate-300 font-mono font-bold text-sm tracking-wider">{formatTime(timer)}</span>
              {portalRun ? (
                <span className="text-sm font-black text-violet-300 leading-none whitespace-nowrap">
                  {path.length - 1}/{targetSteps} 步
                </span>
              ) : (
                <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 leading-none whitespace-nowrap">
                  {score} <span className="text-[10px] font-bold text-emerald-500 ml-0.5">PTS</span>
                </span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 w-28">
              <div className="flex items-center gap-1 text-yellow-400 font-bold text-xs bg-slate-900/50 px-2 py-1.5 rounded shadow-inner">
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
            <div className="mt-2 text-xs text-slate-500 font-bold">
              {currentMode.name}：{currentMode.description}
            </div>
          </div>

          {gameMode === 'normal' && (
            <div className="bg-slate-800 flex justify-around items-center rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.3)] z-10 py-6 px-4">
              {[
                { id: 'heal', icon: PlusCircle, name: '恢复', desc: '恢复 1 点生命值', color: 'text-green-400' },
                { id: 'exclude', icon: Ban, name: '排除', desc: '排查出一个错误干扰', color: 'text-rose-400' },
                { id: 'hint', icon: Lightbulb, name: '提示', desc: '点亮下一步的数字', color: 'text-yellow-400' }
              ].map(item => (
                <button key={item.id} onClick={() => handleUseItem(item.id)} className="group flex flex-col items-center justify-center gap-1 active:scale-90 transition relative">
                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none whitespace-nowrap z-10 border border-slate-700">
                    {item.desc}
                  </div>
                  <div className={`w-14 h-14 rounded-2xl bg-slate-700 flex items-center justify-center shadow-inner relative`}>
                    <item.icon className={item.color} size={28} />
                    {items[item.id] > 0 ? (
                      <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full border-2 border-slate-800">{items[item.id]}</span>
                    ) : (
                      <span className="absolute -bottom-2 bg-slate-900 text-yellow-500 text-xs font-bold px-2 py-0.5 rounded-full border border-slate-700 flex items-center gap-0.5">
                        <CircleDollarSign size={10} /> {SHOP[item.id]}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 font-medium mt-1">{item.name}</span>
                </button>
              ))}
            </div>
          )}

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

          {showExitPrompt && (
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <div className="bg-slate-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-in zoom-in duration-300">
                <h2 className="text-2xl font-black text-white mb-4">暂停游戏</h2>
                <p className="text-slate-300 mb-8">退出将中断当前挑战，<br/>是否保存当前关卡的进度？</p>
                <div className="flex gap-4">
                  <button onClick={handleAbandonAndExit} className="flex-1 bg-slate-700 hover:bg-rose-600 transition text-white py-3 rounded-xl font-bold">放弃进度</button>
                  <button onClick={handleSaveAndExit} className="flex-1 bg-emerald-500 hover:bg-emerald-400 transition text-white py-3 rounded-xl font-bold">保存退出</button>
                </div>
                <button onClick={() => setShowExitPrompt(false)} className="mt-6 text-slate-400 hover:text-white text-sm">取消并继续游戏</button>
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
                   onBack={() => { setView(getGameExitView()); clearNormalSavedGame(); }}
                   onNext={() => startGame(diff, levelIdx + 1, playMode)}
                   onRetry={restartCurrentGame}
                   isDailyChallenge={gameMode === 'daily'}
                />
              ) : (
                <div className="bg-slate-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-[0_0_40px_rgba(0,0,0,0.5)] transform animate-in zoom-in duration-300 border border-slate-700">
                  <h2 className="text-3xl font-black text-rose-500 mb-6">挑战失败</h2>
                  <div className="flex justify-center mb-8 relative">
                     <Heart size={72} className="text-slate-700" />
                     <X size={40} className="text-rose-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                  </div>
                  <div className="flex flex-col gap-4">
                    {gameMode === 'normal' && (
                      <button onClick={handleRevive} className="w-full bg-yellow-500 hover:bg-yellow-400 text-slate-900 py-4 rounded-xl font-bold active:scale-95 transition flex justify-center items-center gap-2 text-lg shadow-[0_0_15px_rgba(234,179,8,0.3)]">
                        <CircleDollarSign size={24} /> 满血复活 (30金币)
                      </button>
                    )}
                    <div className="flex gap-3 mt-2">
                      <button onClick={() => { setView(getGameExitView()); clearNormalSavedGame(); }} className="flex-[1] bg-slate-700 text-white py-3 rounded-xl font-bold active:scale-95 transition text-sm">返回</button>
                      <button onClick={restartCurrentGame} className="flex-[1.5] bg-slate-600 text-white py-3 rounded-xl font-bold active:scale-95 transition flex justify-center items-center gap-1 text-sm"><RotateCcw size={16} /> 重新开始</button>
                    </div>
                  </div>
                </div>
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
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes star-drop {
          0% { transform: scale(3) translateY(-30px) rotate(15deg); opacity: 0; filter: blur(4px); }
          50% { transform: scale(0.9) translateY(5px) rotate(-5deg); opacity: 1; filter: blur(0); }
          100% { transform: scale(1) translateY(0) rotate(0); opacity: 1; }
        }
        .animate-star-drop { animation: star-drop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
      `}} />

      {renderViewContent()}
      {renderGmPanel()}

      {/* 设置面板 */}
      {showSettings && (
        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in duration-300 border border-slate-700">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-white flex items-center gap-2"><Settings className="text-emerald-400" /> 游戏设置</h2>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white p-2 bg-slate-700/50 rounded-full transition active:scale-90"><X size={20} /></button>
            </div>
            
            <div className="space-y-8">
              <div>
                <div className="flex justify-between text-sm font-bold text-slate-300 mb-4">
                  <span>🔊 音效音量</span>
                  <span className="text-emerald-400 font-mono">{sfxVol}%</span>
                </div>
                <input type="range" min="0" max="100" value={sfxVol} onChange={e => setSfxVol(Number(e.target.value))} 
                       className="w-full accent-emerald-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
              </div>
              <div>
                <div className="flex justify-between text-sm font-bold text-slate-300 mb-4">
                  <span>🎵 音乐音量 (敬请期待)</span>
                  <span className="text-emerald-400 font-mono">{musicVol}%</span>
                </div>
                <input type="range" min="0" max="100" value={musicVol} onChange={e => setMusicVol(Number(e.target.value))} 
                       className="w-full accent-emerald-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>
            
            <button onClick={() => setShowSettings(false)} className="w-full mt-10 bg-emerald-500 hover:bg-emerald-400 text-white py-3.5 rounded-xl font-bold active:scale-95 transition shadow-lg shadow-emerald-500/20">
              确认
            </button>
          </div>
        </div>
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
