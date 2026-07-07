/**
 * Star Line Solver — Star Battle 多星唯一解验证（可配置 quota）。
 *
 * 规则：
 *   每行 starsPerRow 星、每列 starsPerCol 星、每个 region starsPerRegion 星、
 *   星点不能八向相邻。
 *
 * 用法：
 *   import { solveStarLine } from './starLineSolver.mjs';
 *   const result = solveStarLine(N, regions);
 *
 * 输入：
 *   N        - 棋盘边长 (5/6/7/8)
 *   regions  - 扁平数组 regions[idx] = regionId (0..N-1)
 *   options  - 可选 { starsPerRow: 1, starsPerCol: 1, starsPerRegion: 1, noAdjacent: true }
 *
 * 输出：
 *   { status: 'NO_SOLUTION' | 'UNIQUE' | 'MULTIPLE',
 *     solutions: [...],
 *     stats: { placements, propagations, backtracks, durationMs } }
 */

// ── 坐标工具 ──

function toCoord(idx, N) {
  return { r: Math.floor(idx / N), c: idx % N };
}

function toIdx(r, c, N) {
  return r * N + c;
}

function inBounds(r, c, N) {
  return r >= 0 && r < N && c >= 0 && c < N;
}

// ── 预计算 ──

function precompute(N, regions) {
  const total = N * N;

  const rowCells = Array.from({ length: N }, (_, r) =>
    Array.from({ length: N }, (_, c) => r * N + c)
  );

  const colCells = Array.from({ length: N }, (_, c) =>
    Array.from({ length: N }, (_, r) => r * N + c)
  );

  const regionCells = Array.from({ length: N }, () => []);
  for (let i = 0; i < total; i++) {
    regionCells[regions[i]].push(i);
  }

  const neighbors = Array.from({ length: total }, (_, i) => {
    const { r, c } = toCoord(i, N);
    const result = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (inBounds(nr, nc, N)) result.push(toIdx(nr, nc, N));
      }
    }
    return result;
  });

  return { total, rowCells, colCells, regionCells, neighbors };
}

// ── 放置星点并禁用冲突格 ──
// 副作用：修改 starred[idx] = true，修改 forbidden 中同行/同列/同 region/八向邻居。

function applyStarConstraints(idx, starred, forbidden, N, regions, rowCells, colCells, regionCells, neighbors, noAdjacent, rowCounts, colCounts, regionCounts, starsPerRow, starsPerCol, starsPerRegion) {
  starred[idx] = true;
  const row = Math.floor(idx / N);
  const col = idx % N;
  const rid = regions[idx];

  // 增量计数：仅在达到 quota 时才禁止同行/列/region 剩余格
  rowCounts[row]++;
  if (rowCounts[row] >= starsPerRow) {
    for (const cell of rowCells[row]) {
      if (!starred[cell]) forbidden[cell] = true;
    }
  }

  colCounts[col]++;
  if (colCounts[col] >= starsPerCol) {
    for (const cell of colCells[col]) {
      if (!starred[cell]) forbidden[cell] = true;
    }
  }

  regionCounts[rid]++;
  if (regionCounts[rid] >= starsPerRegion) {
    for (const cell of regionCells[rid]) {
      if (!starred[cell]) forbidden[cell] = true;
    }
  }

  if (noAdjacent) {
    for (const nb of neighbors[idx]) {
      if (!starred[nb]) forbidden[nb] = true;
    }
  }
}

// ── Solver 主逻辑 ──

export function solveStarLine(N, regions, options = {}) {
  const {
    starsPerRow = 1,
    starsPerCol = 1,
    starsPerRegion = 1,
    noAdjacent = true,
  } = options;

  const startTime = performance.now();
  const { total, rowCells, colCells, regionCells, neighbors } = precompute(N, regions);

  const stats = { placements: 0, propagations: 0, backtracks: 0 };
  const allSolutions = [];
  let stopped = false;

  const normalize = (stars) => [...stars].sort((a, b) => a - b);

  function canPlaceStar(idx, starred, forbidden, rowCounts, colCounts, regionCounts) {
    if (starred[idx] || forbidden[idx]) return false;

    const row = Math.floor(idx / N);
    const col = idx % N;
    const rid = regions[idx];
    if (rowCounts[row] >= starsPerRow) return false;
    if (colCounts[col] >= starsPerCol) return false;
    if (regionCounts[rid] >= starsPerRegion) return false;

    if (noAdjacent) {
      for (const nb of neighbors[idx]) {
        if (starred[nb]) return false;
      }
    }

    return true;
  }

  function placeStar(idx, starred, forbidden, rowCounts, colCounts, regionCounts) {
    if (!canPlaceStar(idx, starred, forbidden, rowCounts, colCounts, regionCounts)) {
      return false;
    }

    applyStarConstraints(idx, starred, forbidden, N, regions, rowCells, colCells, regionCells, neighbors, noAdjacent, rowCounts, colCounts, regionCounts, starsPerRow, starsPerCol, starsPerRegion);
    return true;
  }

  function isSolvedState(starred, rowCounts, colCounts, regionCounts) {
    const totalPlaced = starred.filter(Boolean).length;
    if (totalPlaced !== N * starsPerRow) return false;

    for (let r = 0; r < N; r++) {
      if (rowCounts[r] !== starsPerRow) return false;
    }
    for (let c = 0; c < N; c++) {
      if (colCounts[c] !== starsPerCol) return false;
    }
    for (let rid = 0; rid < N; rid++) {
      if (regionCounts[rid] !== starsPerRegion) return false;
    }

    if (noAdjacent) {
      for (let idx = 0; idx < total; idx++) {
        if (!starred[idx]) continue;
        for (const nb of neighbors[idx]) {
          if (nb > idx && starred[nb]) return false;
        }
      }
    }

    return true;
  }

  // ── 约束传播 ──
  function propagate(starred, forbidden, rowCounts, colCounts, regionCounts) {
    let changed = true;
    const forced = [];

    while (changed) {
      changed = false;
      stats.propagations++;

      // 检查每一行
      for (let r = 0; r < N; r++) {
        const placed = rowCounts[r];
        const needed = starsPerRow - placed;
        if (needed < 0) return { ok: false, forced: [] };
        if (needed === 0) continue;

        const available = rowCells[r].filter((i) => canPlaceStar(i, starred, forbidden, rowCounts, colCounts, regionCounts));
        if (available.length < needed) return { ok: false, forced: [] };
        if (available.length === needed) {
          for (const idx of available) {
            if (!placeStar(idx, starred, forbidden, rowCounts, colCounts, regionCounts)) return { ok: false, forced: [] };
            forced.push(idx);
            changed = true;
          }
        }
      }

      // 检查每一列
      for (let c = 0; c < N; c++) {
        const placed = colCounts[c];
        const needed = starsPerCol - placed;
        if (needed < 0) return { ok: false, forced: [] };
        if (needed === 0) continue;

        const available = colCells[c].filter((i) => canPlaceStar(i, starred, forbidden, rowCounts, colCounts, regionCounts));
        if (available.length < needed) return { ok: false, forced: [] };
        if (available.length === needed) {
          for (const idx of available) {
            if (!placeStar(idx, starred, forbidden, rowCounts, colCounts, regionCounts)) return { ok: false, forced: [] };
            forced.push(idx);
            changed = true;
          }
        }
      }

      // 检查每个 region
      for (let rid = 0; rid < N; rid++) {
        const placed = regionCounts[rid];
        const needed = starsPerRegion - placed;
        if (needed < 0) return { ok: false, forced: [] };
        if (needed === 0) continue;

        const available = regionCells[rid].filter((i) => canPlaceStar(i, starred, forbidden, rowCounts, colCounts, regionCounts));
        if (available.length < needed) return { ok: false, forced: [] };
        if (available.length === needed) {
          for (const idx of available) {
            if (!placeStar(idx, starred, forbidden, rowCounts, colCounts, regionCounts)) return { ok: false, forced: [] };
            forced.push(idx);
            changed = true;
          }
        }
      }
    }

    return { ok: true, forced };
  }

  // ── 递归回溯 ──
  function backtrack(starred, forbidden, rowCounts, colCounts, regionCounts) {
    if (stopped) return;

    const propResult = propagate(starred, forbidden, rowCounts, colCounts, regionCounts);
    if (!propResult.ok) {
      stats.backtracks++;
      return;
    }

    const totalPlaced = starred.filter(Boolean).length;
    const totalNeeded = N * starsPerRow;
    if (totalPlaced === totalNeeded) {
      if (!isSolvedState(starred, rowCounts, colCounts, regionCounts)) {
        stats.backtracks++;
        return;
      }
      const solution = [];
      for (let i = 0; i < total; i++) {
        if (starred[i]) solution.push(i);
      }
      allSolutions.push(normalize(solution));
      if (allSolutions.length >= 2) {
        stopped = true;
      }
      return;
    }

    if (totalPlaced > totalNeeded) {
      stats.backtracks++;
      return;
    }

    // MRV：找剩余候选最少的行/列/region
    let bestGroup = null;
    let bestCandCount = Infinity;

    for (let r = 0; r < N; r++) {
      const placed = rowCounts[r];
      if (placed >= starsPerRow) continue;
      const available = rowCells[r].filter((i) => canPlaceStar(i, starred, forbidden, rowCounts, colCounts, regionCounts));
      if (available.length > 0 && available.length < bestCandCount) {
        bestCandCount = available.length;
        bestGroup = { candidates: available };
      }
    }

    for (let c = 0; c < N; c++) {
      const placed = colCounts[c];
      if (placed >= starsPerCol) continue;
      const available = colCells[c].filter((i) => canPlaceStar(i, starred, forbidden, rowCounts, colCounts, regionCounts));
      if (available.length > 0 && available.length < bestCandCount) {
        bestCandCount = available.length;
        bestGroup = { candidates: available };
      }
    }

    for (let rid = 0; rid < N; rid++) {
      const placed = regionCounts[rid];
      if (placed >= starsPerRegion) continue;
      const available = regionCells[rid].filter((i) => canPlaceStar(i, starred, forbidden, rowCounts, colCounts, regionCounts));
      if (available.length > 0 && available.length < bestCandCount) {
        bestCandCount = available.length;
        bestGroup = { candidates: available };
      }
    }

    if (!bestGroup) {
      let allSatisfied = true;
      for (let r = 0; r < N; r++) {
        if (rowCells[r].filter((i) => starred[i]).length !== starsPerRow) { allSatisfied = false; break; }
      }
      if (allSatisfied) {
        for (let c = 0; c < N; c++) {
          if (colCells[c].filter((i) => starred[i]).length !== starsPerCol) { allSatisfied = false; break; }
        }
      }
      if (allSatisfied) {
        for (let rid = 0; rid < N; rid++) {
          if (regionCells[rid].filter((i) => starred[i]).length !== starsPerRegion) { allSatisfied = false; break; }
        }
      }
      if (!allSatisfied) stats.backtracks++;
      return;
    }

    for (const cand of bestGroup.candidates) {
      if (stopped) return;

      const newStarred = [...starred];
      const newForbidden = [...forbidden];
      const newRowCounts = [...rowCounts];
      const newColCounts = [...colCounts];
      const newRegionCounts = [...regionCounts];

      if (!placeStar(cand, newStarred, newForbidden, newRowCounts, newColCounts, newRegionCounts)) {
        stats.backtracks++;
        continue;
      }
      stats.placements++;

      backtrack(newStarred, newForbidden, newRowCounts, newColCounts, newRegionCounts);
    }
  }

  const initialStarred = new Array(total).fill(false);
  const initialForbidden = new Array(total).fill(false);
  const initialRowCounts = new Array(N).fill(0);
  const initialColCounts = new Array(N).fill(0);
  const initialRegionCounts = new Array(N).fill(0);
  backtrack(initialStarred, initialForbidden, initialRowCounts, initialColCounts, initialRegionCounts);

  const durationMs = Math.round((performance.now() - startTime) * 1000) / 1000;

  let status = 'NO_SOLUTION';
  if (allSolutions.length === 1) status = 'UNIQUE';
  else if (allSolutions.length >= 2) status = 'MULTIPLE';

  return {
    status,
    solutions: allSolutions.slice(0, 2),
    stats: { ...stats, durationMs },
  };
}
