/**
 * Star Line Solver — Star Battle 1★ 唯一解验证。
 *
 * 规则：
 *   每行 1 星、每列 1 星、每个 region 1 星、星点不能八向相邻。
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

function applyStarConstraints(idx, starred, forbidden, N, regions, rowCells, colCells, regionCells, neighbors, noAdjacent) {
  starred[idx] = true;
  const row = Math.floor(idx / N);
  const col = idx % N;
  const rid = regions[idx];

  for (const cell of rowCells[row]) {
    if (cell !== idx && !starred[cell]) forbidden[cell] = true;
  }
  for (const cell of colCells[col]) {
    if (cell !== idx && !starred[cell]) forbidden[cell] = true;
  }
  for (const cell of regionCells[rid]) {
    if (cell !== idx && !starred[cell]) forbidden[cell] = true;
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

  // ── 约束传播 ──
  function propagate(starred, forbidden) {
    let changed = true;
    const forced = [];

    while (changed) {
      changed = false;
      stats.propagations++;

      // 检查每一行
      for (let r = 0; r < N; r++) {
        const placed = rowCells[r].filter((i) => starred[i]).length;
        const needed = starsPerRow - placed;
        if (needed < 0) return { ok: false, forced: [] };
        if (needed === 0) continue;

        const available = rowCells[r].filter((i) => !starred[i] && !forbidden[i]);
        if (available.length < needed) return { ok: false, forced: [] };
        if (available.length === needed) {
          for (const idx of available) {
            if (!starred[idx]) {
              applyStarConstraints(idx, starred, forbidden, N, regions, rowCells, colCells, regionCells, neighbors, noAdjacent);
              forced.push(idx);
              changed = true;
            }
          }
        }
      }

      // 检查每一列
      for (let c = 0; c < N; c++) {
        const placed = colCells[c].filter((i) => starred[i]).length;
        const needed = starsPerCol - placed;
        if (needed < 0) return { ok: false, forced: [] };
        if (needed === 0) continue;

        const available = colCells[c].filter((i) => !starred[i] && !forbidden[i]);
        if (available.length < needed) return { ok: false, forced: [] };
        if (available.length === needed) {
          for (const idx of available) {
            if (!starred[idx]) {
              applyStarConstraints(idx, starred, forbidden, N, regions, rowCells, colCells, regionCells, neighbors, noAdjacent);
              forced.push(idx);
              changed = true;
            }
          }
        }
      }

      // 检查每个 region
      for (let rid = 0; rid < N; rid++) {
        const placed = regionCells[rid].filter((i) => starred[i]).length;
        const needed = starsPerRegion - placed;
        if (needed < 0) return { ok: false, forced: [] };
        if (needed === 0) continue;

        const available = regionCells[rid].filter((i) => !starred[i] && !forbidden[i]);
        if (available.length < needed) return { ok: false, forced: [] };
        if (available.length === needed) {
          for (const idx of available) {
            if (!starred[idx]) {
              applyStarConstraints(idx, starred, forbidden, N, regions, rowCells, colCells, regionCells, neighbors, noAdjacent);
              forced.push(idx);
              changed = true;
            }
          }
        }
      }
    }

    return { ok: true, forced };
  }

  // ── 递归回溯 ──
  function backtrack(starred, forbidden) {
    if (stopped) return;

    const propResult = propagate(starred, forbidden);
    if (!propResult.ok) {
      stats.backtracks++;
      return;
    }

    const totalPlaced = starred.filter(Boolean).length;
    const totalNeeded = N * starsPerRow;
    if (totalPlaced === totalNeeded) {
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
      const placed = rowCells[r].filter((i) => starred[i]).length;
      if (placed >= starsPerRow) continue;
      const available = rowCells[r].filter((i) => !starred[i] && !forbidden[i]);
      if (available.length > 0 && available.length < bestCandCount) {
        bestCandCount = available.length;
        bestGroup = { candidates: available };
      }
    }

    for (let c = 0; c < N; c++) {
      const placed = colCells[c].filter((i) => starred[i]).length;
      if (placed >= starsPerCol) continue;
      const available = colCells[c].filter((i) => !starred[i] && !forbidden[i]);
      if (available.length > 0 && available.length < bestCandCount) {
        bestCandCount = available.length;
        bestGroup = { candidates: available };
      }
    }

    for (let rid = 0; rid < N; rid++) {
      const placed = regionCells[rid].filter((i) => starred[i]).length;
      if (placed >= starsPerRegion) continue;
      const available = regionCells[rid].filter((i) => !starred[i] && !forbidden[i]);
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
      stats.placements++;

      applyStarConstraints(cand, newStarred, newForbidden, N, regions, rowCells, colCells, regionCells, neighbors, noAdjacent);

      backtrack(newStarred, newForbidden);
    }
  }

  const initialStarred = new Array(total).fill(false);
  const initialForbidden = new Array(total).fill(false);
  backtrack(initialStarred, initialForbidden);

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
