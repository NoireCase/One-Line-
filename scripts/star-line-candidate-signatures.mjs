/**
 * Star Line 候选关卡签名工具。
 *
 * 提供 exact solution signature、D4 对称归一化 canonical region signature、
 * 区域面积轮廓和 D4 对齐区域相似度。
 *
 * 供生成器和分析器共享，保证签名一致性。
 */

// ═══ D4 对称变换 ═══

/**
 * 对 N×N 棋盘应用八种 D4 变换，返回变换后的 cell index 映射。
 * 每种变换返回长度为 N*N 的数组，out[i] = 变换前的 cell index。
 */
export function d4Transforms(N) {
  const total = N * N;
  const last = N - 1;

  function make(fn) {
    const out = new Array(total);
    for (let i = 0; i < total; i++) {
      const r = Math.floor(i / N);
      const c = i % N;
      const [nr, nc] = fn(r, c);
      out[nr * N + nc] = i;
    }
    // 验证无重复
    const seen = new Set(out);
    if (seen.size !== total) throw new Error('D4 transform produced duplicates');
    return out;
  }

  return [
    make((r, c) => [r, c]),                     // identity
    make((r, c) => [c, last - r]),              // rot90
    make((r, c) => [last - r, last - c]),       // rot180
    make((r, c) => [last - c, r]),              // rot270
    make((r, c) => [last - r, c]),              // h-flip
    make((r, c) => [r, last - c]),              // v-flip
    make((r, c) => [c, r]),                     // main-diag
    make((r, c) => [last - c, last - r]),       // anti-diag
  ];
}

/**
 * 对 regions 数组应用 D4 变换映射后，重新规范 region label
 * （按首次出现顺序从 0 开始编号），返回规范后的 regions 和字符串签名。
 */
export function canonicalizeRegions(regions, N) {
  const transforms = d4Transforms(N);
  let bestSig = null;

  for (const map of transforms) {
    // 变换
    const transformed = new Array(N * N);
    for (let i = 0; i < N * N; i++) {
      transformed[i] = regions[map[i]];
    }

    // 规范 label
    const labelMap = new Map();
    let nextLabel = 0;
    const canonical = new Array(N * N);
    for (let i = 0; i < N * N; i++) {
      const rid = transformed[i];
      if (!labelMap.has(rid)) {
        labelMap.set(rid, nextLabel++);
      }
      canonical[i] = labelMap.get(rid);
    }

    const sig = canonical.join(',');
    if (bestSig === null || sig < bestSig) {
      bestSig = sig;
    }
  }

  return bestSig;
}

// ═══ Solution 签名 ═══

/**
 * exact solution signature: "gameId:N:quota:sorted-indices"
 */
export function makeSolutionSig(gameId, N, quota, sol) {
  return `${gameId}:${N}:${quota}:${[...sol].sort((a, b) => a - b).join(',')}`;
}

/**
 * D4 canonical solution signature: rotations/reflections share one signature.
 */
export function makeCanonicalSolutionSig(gameId, N, quota, sol) {
  const stars = new Set(sol);
  let best = null;
  for (const map of d4Transforms(N)) {
    const transformed = [];
    for (let outputCell = 0; outputCell < map.length; outputCell++) {
      if (stars.has(map[outputCell])) transformed.push(outputCell);
    }
    const signature = transformed.join(',');
    if (best === null || signature < best) best = signature;
  }
  return `${gameId}:${N}:${quota}:${best ?? ''}`;
}

/**
 * canonical region signature: "gameId:N:quota:canonical-string"
 */
export function makeCanonicalRegionSig(gameId, N, quota, regions) {
  const canon = canonicalizeRegions(regions, N);
  return `${gameId}:${N}:${quota}:${canon}`;
}

// ═══ 区域面积轮廓 ═══

/**
 * 返回排序后的区域面积数组（升序）。
 */
export function regionAreaProfile(regions) {
  const counts = {};
  for (const rid of regions) {
    counts[rid] = (counts[rid] || 0) + 1;
  }
  return Object.values(counts).sort((a, b) => a - b);
}

/**
 * 区域面积轮廓签名：排序面积的 join 字符串。
 */
export function areaProfileSignature(regions) {
  return regionAreaProfile(regions).join(',');
}

// ═══ 区域形状指标 ═══

/**
 * 返回区域的轻量形状指标：
 * - area: 格子数
 * - perimeter: 与其他区域正交邻接的边数
 * - articulationRisk: 是否存在单格宽连接（简化：检查所有格子的正交邻接中同区格少于2个）
 */
export function regionShapeMetrics(regions, N) {
  const total = N * N;
  const ridSet = new Set(regions);
  const results = [];

  for (const rid of ridSet) {
    const cells = [];
    for (let i = 0; i < total; i++) {
      if (regions[i] === rid) cells.push(i);
    }
    const area = cells.length;

    // 周长：与其他区域正交邻接的边数
    const cellSet = new Set(cells);
    let perimeter = 0;
    for (const cell of cells) {
      const r = Math.floor(cell / N), c = cell % N;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= N || nc < 0 || nc >= N) { perimeter++; continue; }
        const ni = nr * N + nc;
        if (!cellSet.has(ni)) perimeter++;
      }
    }

    // 简单 articulation 风险：检查是否有格子在区域中只有 ≤1 个同区正交邻格
    let thinCells = 0;
    for (const cell of cells) {
      const r = Math.floor(cell / N), c = cell % N;
      let sameRegionNeighbors = 0;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
        if (regions[nr * N + nc] === rid) sameRegionNeighbors++;
      }
      if (sameRegionNeighbors <= 1) thinCells++;
    }

    results.push({ rid, area, perimeter, thinCells, articulationRisk: thinCells > 0 });
  }

  return results;
}

// ═══ D4 对齐相似度 ═══

/**
 * 在 D4 对齐后计算 Jaccard 区域对相似度。
 * 尝试八种变换，返回最高相似度。
 */
export function d4AlignedRegionJaccard(regA, regB, N) {
  if (regA.length !== regB.length) return 0;
  const transforms = d4Transforms(N);
  let best = 0;

  for (const map of transforms) {
    // 将 regB 按映射变换
    const transformed = new Array(N * N);
    for (let i = 0; i < N * N; i++) {
      transformed[i] = regB[map[i]];
    }

    // 重新规范 label 后比较 pair Jaccard
    const sim = _regionPairJaccard(regA, _canonicalRelabel(transformed));
    if (sim > best) best = sim;
  }

  return best;
}

/**
 * 返回最高 D4 对齐相似度以及该对齐下的最小格子差异数。
 *
 * 格子差异会在每种几何对齐后，按区域重叠最大的一对一标签映射计算，
 * 因此不会把同一结构的不同 region id 误判为差异。
 */
export function d4AlignedRegionMetrics(regA, regB, N) {
  if (regA.length !== regB.length) {
    return { similarity: 0, differingCells: Math.max(regA.length, regB.length), transformIndex: -1 };
  }

  const transforms = d4Transforms(N);
  let best = { similarity: -1, differingCells: Infinity, transformIndex: -1 };

  for (let transformIndex = 0; transformIndex < transforms.length; transformIndex++) {
    const map = transforms[transformIndex];
    const transformed = new Array(N * N);
    for (let i = 0; i < N * N; i++) transformed[i] = regB[map[i]];

    const similarity = _regionPairJaccard(regA, _canonicalRelabel(transformed));
    const differingCells = regA.length - _maxRegionOverlap(regA, transformed);
    if (
      similarity > best.similarity
      || (similarity === best.similarity && differingCells < best.differingCells)
    ) {
      best = { similarity, differingCells, transformIndex };
    }
  }

  return best;
}

/** 最大化 A/B region label 的一对一重叠数（N=10，位掩码 DP 足够小）。 */
function _maxRegionOverlap(regA, regB) {
  const labelsA = [...new Set(regA)];
  const labelsB = [...new Set(regB)];
  if (labelsA.length !== labelsB.length) return 0;

  const indexA = new Map(labelsA.map((label, index) => [label, index]));
  const indexB = new Map(labelsB.map((label, index) => [label, index]));
  const overlap = Array.from({ length: labelsA.length }, () => Array(labelsB.length).fill(0));
  for (let i = 0; i < regA.length; i++) {
    overlap[indexA.get(regA[i])][indexB.get(regB[i])]++;
  }

  const memo = new Map();
  function visit(row, usedMask) {
    if (row === overlap.length) return 0;
    const key = `${row}:${usedMask}`;
    if (memo.has(key)) return memo.get(key);
    let best = 0;
    for (let col = 0; col < overlap.length; col++) {
      if (usedMask & (1 << col)) continue;
      best = Math.max(best, overlap[row][col] + visit(row + 1, usedMask | (1 << col)));
    }
    memo.set(key, best);
    return best;
  }

  return visit(0, 0);
}

function _canonicalRelabel(regions) {
  const labelMap = new Map();
  let next = 0;
  const result = new Array(regions.length);
  for (let i = 0; i < regions.length; i++) {
    const rid = regions[i];
    if (!labelMap.has(rid)) labelMap.set(rid, next++);
    result[i] = labelMap.get(rid);
  }
  return result;
}

function _regionPairJaccard(regA, regB) {
  if (regA.length !== regB.length) return 0;
  function pairs(r) {
    const groups = {};
    for (let i = 0; i < r.length; i++) {
      const g = r[i];
      if (!groups[g]) groups[g] = [];
      groups[g].push(i);
    }
    const s = new Set();
    for (const cells of Object.values(groups)) {
      for (let a = 0; a < cells.length; a++)
        for (let b = a + 1; b < cells.length; b++)
          s.add(`${Math.min(cells[a], cells[b])},${Math.max(cells[a], cells[b])}`);
    }
    return s;
  }
  const pa = pairs(regA), pb = pairs(regB);
  let inter = 0;
  for (const p of pa) { if (pb.has(p)) inter++; }
  const union = new Set([...pa, ...pb]).size;
  return union === 0 ? 0 : inter / union;
}

/**
 * D4 区域与 solution 同时等价检测。
 * 存在某个 D4 变换使得 regB 结构与 regA 等价（canonical relabel 相同）
 * 且 solB 变换后与 solA 的星位集合完全一致时返回 true。
 * 用于"数学不同、玩家体验相同"的直接 reject 门禁。
 */
export function d4FullyEquivalent(regA, solA, regB, solB, N) {
  if (regA.length !== regB.length) return false;
  if (!Array.isArray(solA) || !Array.isArray(solB) || solA.length !== solB.length) return false;

  const canonA = _canonicalRelabel(regA).join(',');
  const solASet = new Set(solA);
  const transforms = d4Transforms(N);

  for (const map of transforms) {
    // map: out[i] = 变换前 cell index → 变换后位置 i 的区域取自 regB[map[i]]
    const transformedRegions = new Array(N * N);
    for (let i = 0; i < N * N; i++) transformedRegions[i] = regB[map[i]];
    if (_canonicalRelabel(transformedRegions).join(',') !== canonA) continue;

    // solution 同步变换：原 cell j 落到满足 map[i] === j 的位置 i
    const inverse = new Array(N * N);
    for (let i = 0; i < N * N; i++) inverse[map[i]] = i;
    const transformedSol = solB.map((idx) => inverse[idx]);
    if (transformedSol.every((idx) => solASet.has(idx))) return true;
  }

  return false;
}

// ═══ 旧版兼容（非 D4 签名，供现有分析器过渡） ═══

/**
 * Canonicalize regions: remap labels in row-major order to 0,1,2...
 */
export function canonicalRegionsSimple(regions) {
  return _canonicalRelabel(regions);
}

/** regionSignature (旧版，非 D4): gameId:N:quota:canonical-region-grid */
export function makeRegionSig(gameId, N, quota, regions) {
  const can = canonicalRegionsSimple(regions);
  return `${gameId}:${N}:${quota}:${can.join(',')}`;
}
