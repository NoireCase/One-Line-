/**
 * Portal Classic Candidate Core — 不依赖 src/ 的独立工具模块。
 * 供 generator / analyzer 共用。
 *
 * 棋盘坐标：index = r * N + c，r 和 c 从 0 开始。
 * 八向移动：上下左右 + 四个斜向。
 */

// ── 坐标工具 ──

export function toCoord(idx, N) {
  return { r: Math.floor(idx / N), c: idx % N };
}

export function toIdx(r, c, N) {
  return r * N + c;
}

export function inBounds(r, c, N) {
  return r >= 0 && r < N && c >= 0 && c < N;
}

// ── 八向邻居 ──

const ALL_DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

export function neighbors(idx, N) {
  const { r, c } = toCoord(idx, N);
  const result = [];
  for (const [dr, dc] of ALL_DIRS) {
    const nr = r + dr, nc = c + dc;
    if (inBounds(nr, nc, N)) result.push(toIdx(nr, nc, N));
  }
  return result;
}

// ── 移动合法性 ──

export function isAdjacent(a, b, N) {
  const ca = toCoord(a, N), cb = toCoord(b, N);
  const dr = Math.abs(ca.r - cb.r), dc = Math.abs(ca.c - cb.c);
  return (dr <= 1 && dc <= 1 && (dr + dc > 0));
}

export function isDiagonal(a, b, N) {
  const ca = toCoord(a, N), cb = toCoord(b, N);
  return Math.abs(ca.r - cb.r) === 1 && Math.abs(ca.c - cb.c) === 1;
}

// ── Crossing 检查（与 src/game/rules/movement.js hasPathCrossing 一致） ──

function getCrossingKeys(fromIdx, toIdx, N) {
  const a = toCoord(fromIdx, N), b = toCoord(toIdx, N);
  const dr = b.r - a.r, dc = b.c - a.c;
  if (Math.abs(dr) !== 1 || Math.abs(dc) !== 1) return [];
  return [
    `${a.r},${b.c}-${b.r},${a.c}`,
    `${b.r},${a.c}-${a.r},${b.c}`,
  ];
}

function getSegmentKeys(fromIdx, toIdx, N) {
  const a = toCoord(fromIdx, N), b = toCoord(toIdx, N);
  return [
    `${a.r},${a.c}-${b.r},${b.c}`,
    `${b.r},${b.c}-${a.r},${a.c}`,
  ];
}

export function hasPathCrossing(path, fromIdx, toIdx, N) {
  const crossingKeys = getCrossingKeys(fromIdx, toIdx, N);
  if (crossingKeys.length === 0) return false;
  for (let i = 0; i < path.length - 1; i++) {
    const segKeys = getSegmentKeys(path[i], path[i + 1], N);
    if (segKeys.some(k => crossingKeys.includes(k))) return true;
  }
  return false;
}

// ── 路径合法性检查 ──

/**
 * 检查一条完整路径（含 portal jump）。
 * portals 形如 [{ id, cells: [a, b] }, ...]。
 * 返回 { valid, errors, portalJumps }。
 */
export function validatePath(path, portals, N) {
  const errors = [];
  const boardSize = N * N;

  if (path.length !== boardSize) errors.push(`path.length=${path.length}, expected ${boardSize}`);
  const idxSet = new Set(path);
  if (idxSet.size !== path.length) errors.push('path has duplicate cells');
  for (const idx of path) {
    if (idx < 0 || idx >= boardSize) errors.push(`index ${idx} out of range [0, ${boardSize - 1}]`);
  }

  // 构建 portal 跳转映射
  const portalMap = new Map();
  for (const p of portals) {
    portalMap.set(p.cells[0], p.cells[1]);
    portalMap.set(p.cells[1], p.cells[0]);
  }

  const portalJumps = [];
  let moveOk = true, crossingOk = true;

  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i], to = path[i + 1];
    const isPortalJump = portalMap.has(from) && portalMap.get(from) === to;

    if (isPortalJump) {
      portalJumps.push({ step: i, from, to });
      continue;
    }

    if (!isAdjacent(from, to, N)) {
      if (moveOk) errors.push(`step ${i}: ${from}->${to} not adjacent (and not a portal jump)`);
      moveOk = false;
    }

    if (isDiagonal(from, to, N) && hasPathCrossing(path.slice(0, i + 1), from, to, N)) {
      if (crossingOk) errors.push(`step ${i}: ${from}->${to} crosses earlier path`);
      crossingOk = false;
    }
  }

  // 检查 portal 是否被使用
  for (const p of portals) {
    const [a, b] = p.cells;
    let used = false;
    for (const j of portalJumps) {
      if ((j.from === a && j.to === b) || (j.from === b && j.to === a)) {
        used = true;
        break;
      }
    }
    if (!used) errors.push(`Portal ${p.id} [${a},${b}] never used in path`);
  }

  return {
    valid: errors.length === 0,
    errors,
    portalJumps,
  };
}

// ── Portal cell 验证 ──

export function validatePortals(portals, N) {
  const errors = [];
  const boardSize = N * N;
  const ids = new Set();
  const allCells = [];

  for (const p of portals) {
    if (!p.id || ids.has(p.id)) { errors.push(`duplicate portal id: ${p.id}`); continue; }
    ids.add(p.id);
    if (!Array.isArray(p.cells) || p.cells.length !== 2) { errors.push(`Portal ${p.id}: cells must be [a, b]`); continue; }
    const [a, b] = p.cells;
    if (a === b) errors.push(`Portal ${p.id}: cells identical (${a})`);
    if (a < 0 || a >= boardSize || b < 0 || b >= boardSize) errors.push(`Portal ${p.id}: cell out of range [0, ${boardSize - 1}]`);
    if (isAdjacent(a, b, N)) errors.push(`Portal ${p.id}: cells ${a},${b} are adjacent — portal jump would be trivial`);
    allCells.push(a, b);
  }

  if (new Set(allCells).size !== allCells.length) errors.push('portal cells overlap across groups');

  return { valid: errors.length === 0, errors };
}

// ── HiddenVals 建议 ──

export function suggestHiddenVals(path, portals, count) {
  const N = Math.round(Math.sqrt(path.length));
  const portalCells = new Set(portals.flatMap(p => p.cells));
  const portalMap = new Map();
  for (const p of portals) {
    portalMap.set(p.cells[0], p.cells[1]);
    portalMap.set(p.cells[1], p.cells[0]);
  }

  const scores = new Map();
  const addScore = (pathIndex, points) => {
    if (pathIndex <= 0 || pathIndex >= path.length - 1) return;
    const cell = path[pathIndex];
    if (portalCells.has(cell)) return;
    scores.set(pathIndex, (scores.get(pathIndex) || 0) + points);
  };

  const zoneOf = (idx) => {
    const { r, c } = toCoord(idx, N);
    const size = Math.ceil(N / 3);
    return `${Math.floor(r / size)},${Math.floor(c / size)}`;
  };

  const jumpSteps = [];
  for (let i = 0; i < path.length - 1; i++) {
    if (portalMap.get(path[i]) === path[i + 1]) jumpSteps.push(i);
  }

  for (const step of jumpSteps) {
    addScore(step - 1, 10);
    addScore(step + 2, 10);
    addScore(step - 2, 4);
    addScore(step + 3, 4);
  }

  for (let i = 1; i < path.length - 1; i++) {
    const prev = toCoord(path[i - 1], N);
    const curr = toCoord(path[i], N);
    const next = toCoord(path[i + 1], N);
    const dr1 = curr.r - prev.r, dc1 = curr.c - prev.c;
    const dr2 = next.r - curr.r, dc2 = next.c - curr.c;
    const isPortalEdge = Math.abs(dr1) > 1 || Math.abs(dc1) > 1 || Math.abs(dr2) > 1 || Math.abs(dc2) > 1;
    if (!isPortalEdge && (dr1 !== dr2 || dc1 !== dc2)) addScore(i, 5);
  }

  for (let i = 0; i < path.length - 1; i++) {
    if (zoneOf(path[i]) !== zoneOf(path[i + 1])) {
      addScore(i, 3);
      addScore(i + 1, 3);
    }
  }

  const segmentCuts = [0, ...jumpSteps.map(step => step + 1), path.length - 1]
    .filter((step, idx, arr) => idx === 0 || step > arr[idx - 1]);
  for (let i = 0; i < segmentCuts.length - 1; i++) {
    const mid = Math.floor((segmentCuts[i] + segmentCuts[i + 1]) / 2);
    addScore(mid, 4);
  }

  for (let i = 0; i < path.length; i++) {
    if (i === 0 || i === path.length - 1) continue;
    if (!portalCells.has(path[i])) {
      scores.set(i, (scores.get(i) || 0) + 1 + ((i * 7) % 5) / 10);
    }
  }

  const ranked = [...scores.entries()]
    .map(([pathIndex, score]) => ({ pathIndex, val: pathIndex + 1, score }))
    .sort((a, b) => b.score - a.score || a.val - b.val);

  const selected = [];
  const selectedSet = new Set();
  for (const minGap of [4, 3, 2, 1, 0]) {
    for (const item of ranked) {
      if (selected.length >= count) break;
      if (selectedSet.has(item.val)) continue;
      const farEnough = selected.every(v => Math.abs(v - item.val) > minGap);
      if (!farEnough) continue;
      selected.push(item.val);
      selectedSet.add(item.val);
    }
    if (selected.length >= count) break;
  }

  return selected.sort((a, b) => a - b);
}

// ── 控制台棋盘 ──

export function renderBoard(path, portals, N) {
  const portalMap = new Map();
  for (const p of portals) {
    portalMap.set(p.cells[0], p.id);
    portalMap.set(p.cells[1], p.id);
  }

  const posMap = new Map();
  path.forEach((cell, i) => posMap.set(cell, i + 1));

  const lines = [];
  for (let r = 0; r < N; r++) {
    let line = '';
    for (let c = 0; c < N; c++) {
      const idx = r * N + c;
      const val = posMap.get(idx) || '?';
      const pid = portalMap.get(idx);
      const marker = pid ? `[${pid}]` : '   ';
      line += `${marker}${String(val).padStart(3)} `;
    }
    lines.push(line);
  }
  return lines.join('\n');
}

// ── 路径方向分析 ──

export function analyzeDirections(path, N) {
  const dirs = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = toCoord(path[i], N), b = toCoord(path[i + 1], N);
    dirs.push({ dr: b.r - a.r, dc: b.c - a.c });
  }
  return dirs;
}

export function countConsecutiveSameDir(dirs) {
  let maxRun = 0, run = 0;
  let prevKey = '';
  for (const d of dirs) {
    const key = `${d.dr},${d.dc}`;
    if (key === prevKey) { run++; maxRun = Math.max(maxRun, run); }
    else { run = 1; prevKey = key; }
  }
  return maxRun;
}

export function countRowSweeps(dirs) {
  let count = 0;
  for (let i = 0; i < dirs.length - 2; i++) {
    // 3 consecutive same-row moves
    if (dirs[i].dr === 0 && dirs[i+1].dr === 0 && dirs[i+2].dr === 0 &&
        Math.sign(dirs[i].dc) === Math.sign(dirs[i+1].dc) &&
        Math.sign(dirs[i+1].dc) === Math.sign(dirs[i+2].dc)) {
      count++;
    }
  }
  return count;
}

export function countColSweeps(dirs) {
  let count = 0;
  for (let i = 0; i < dirs.length - 2; i++) {
    if (dirs[i].dc === 0 && dirs[i+1].dc === 0 && dirs[i+2].dc === 0 &&
        Math.sign(dirs[i].dr) === Math.sign(dirs[i+1].dr) &&
        Math.sign(dirs[i+1].dr) === Math.sign(dirs[i+2].dr)) {
      count++;
    }
  }
  return count;
}

// ── Portal neighbor 检查（"相邻双问号"） ──

export function checkPortalNeighborConflicts(path, portals, N) {
  const allPortalCells = new Set(portals.flatMap(p => p.cells));
  const issues = [];

  for (let i = 0; i < path.length; i++) {
    const cell = path[i];
    if (allPortalCells.has(cell)) continue; // skip portal cells themselves
    const visited = new Set(path.slice(0, i + 1));
    const nbrs = neighbors(cell, N);
    const portalNbrs = nbrs.filter(n => allPortalCells.has(n) && !visited.has(n));
    if (portalNbrs.length >= 2) {
      issues.push({
        step: i,
        cell,
        portalNeighbors: portalNbrs,
        message: `step ${i}: cell ${cell} has ${portalNbrs.length} unvisited portal neighbors [${portalNbrs}]`,
      });
    }
  }

  return issues;
}

// ── Portal cell 聚集检测 ──

export function checkPortalClustering(portals, N) {
  const allCells = portals.flatMap(p => p.cells);
  let minDist = Infinity, maxDist = 0;
  const pairs = [];

  for (let i = 0; i < allCells.length; i++) {
    for (let j = i + 1; j < allCells.length; j++) {
      const a = toCoord(allCells[i], N), b = toCoord(allCells[j], N);
      const dist = Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
      minDist = Math.min(minDist, dist);
      maxDist = Math.max(maxDist, dist);
      pairs.push({ a: allCells[i], b: allCells[j], dist });
    }
  }

  return { minDist, maxDist, pairs, allCells };
}

// ── 区域覆盖分布 ──

export function analyzeRegionCoverage(path, N) {
  // 将 7×7 棋盘分为 3×3=9 个区域（边界对齐）
  const zones = 3;
  const rowsPerZone = Math.ceil(N / zones);
  const colsPerZone = Math.ceil(N / zones);
  const coverage = [];

  for (let zr = 0; zr < zones; zr++) {
    for (let zc = 0; zc < zones; zc++) {
      const cells = [];
      for (let r = zr * rowsPerZone; r < Math.min((zr + 1) * rowsPerZone, N); r++) {
        for (let c = zc * colsPerZone; c < Math.min((zc + 1) * colsPerZone, N); c++) {
          cells.push(r * N + c);
        }
      }
      const visited = cells.map(idx => path.indexOf(idx)).filter(p => p >= 0);
      coverage.push({
        zone: `${zr},${zc}`,
        total: cells.length,
        visitOrder: visited,
        firstVisit: Math.min(...visited),
        lastVisit: Math.max(...visited),
      });
    }
  }

  return coverage;
}
