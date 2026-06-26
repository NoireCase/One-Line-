import { PLAY_MODES, getClassicGridSize } from '../../config/gameModes.js';
import {
  getAllowedDirections,
  getCellIndex,
  getCrossingKeys,
  getMinMoveDistance,
  getSegmentKeys,
  isInsideBoard
} from '../rules/movement.js';

export const CONFIG = {
  easy: { N: 5, hiddenMin: 8, hiddenMax: 10, hp: 3, coins: 10, times: [30, 60], maxGap: 2 },
  medium: { N: 7, hiddenMin: 20, hiddenMax: 25, hp: 5, coins: 20, times: [90, 180], maxGap: 3 },
  hard: { N: 9, hiddenMin: 40, hiddenMax: 45, hp: 10, coins: 40, times: [300, 600], maxGap: 4 }
};

function mulberry32(a) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const createSeed = (targetDiff, targetLevel) => {
  const seedStr = targetDiff + targetLevel.toString();
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed << 5) - seed + seedStr.charCodeAt(i);
    seed |= 0;
  }
  return seed + 88888;
};

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

export const createClassicLevel = (targetDiff, targetLevel, rules, targetPlayMode = PLAY_MODES.classic) => {
  const rand = mulberry32(createSeed(targetDiff, targetLevel));

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
    for (let i = 0; i < L; i++) if (revArray[i] !== 0) valToIdx[revArray[i]] = i;

    let nextRevealedVal = new Array(L + 1).fill(-1);
    let lastRev = L;
    for (let v = L; v >= 1; v--) {
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

  let grid = new Array(L);
  for (let i = 0; i < L; i++) {
    let val = rawPath.indexOf(i) + 1;
    grid[i] = { val, isHidden: hiddenVals.has(val), isRevealed: false, isExcluded: false, isHinted: false };
  }

  return {
    config,
    grid,
    startIndex: rawPath[0]
  };
};
