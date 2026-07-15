/**
 * Star Line 宏观变异模块 (Package 2D.1)。
 *
 * 在现有单格变异外提供三种结构级变异，解决"数学不同、玩家体验相同"的根因：
 *   1. mutateBoundaryShift    — 连续 2–4 格边界转移
 *   2. mutateBlockRepartition — 局部 3×3 / 4×4 窗口区域重划（锚点导向受控生长，
 *                                非普通 BFS/Voronoi/无方向随机重画）
 *   3. mutateMergeResplit     — 相邻区域合并后围绕原有目标星重新切分
 *
 * applyMacroMutation 管线保证每一步：
 *   - 区域完整覆盖 + 正交连通
 *   - Solver 验证 UNIQUE（非 UNIQUE 立即回退该步）
 * 并且最终结果：
 *   - 与父模板 D4 相似度 ≤ maxParentSimilarity（明显下降）
 *   - 开局指纹与父模板不同
 */
import { solveStarLine } from './starLineSolver.mjs';
import { d4AlignedRegionJaccard } from './star-line-candidate-signatures.mjs';
import { computeOpeningFingerprint } from './star-line-fingerprint.mjs';

const ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]];

function orthoNeighbors(idx, N) {
  const r = Math.floor(idx / N), c = idx % N;
  const out = [];
  for (const [dr, dc] of ORTHO) {
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < N && nc >= 0 && nc < N) out.push(nr * N + nc);
  }
  return out;
}

function regionCellsOf(regions, rid) {
  const cells = [];
  for (let i = 0; i < regions.length; i++) if (regions[i] === rid) cells.push(i);
  return cells;
}

function regionConnected(regions, N, rid) {
  const cells = regionCellsOf(regions, rid);
  if (cells.length === 0) return false;
  const vis = new Set([cells[0]]), q = [cells[0]];
  while (q.length) {
    const cur = q.shift();
    for (const nb of orthoNeighbors(cur, N)) {
      if (regions[nb] === rid && !vis.has(nb)) { vis.add(nb); q.push(nb); }
    }
  }
  return vis.size === cells.length;
}

/**
 * 校验区域完整覆盖 + 全部正交连通。
 * 返回 null 表示合法，否则返回错误描述。
 */
export function validateRegions(regions, N) {
  const total = N * N;
  if (!Array.isArray(regions) || regions.length !== total) return 'wrong length';
  const rids = new Set(regions);
  if (rids.size !== N) return `expected ${N} regions, got ${rids.size}`;
  for (const rid of rids) {
    if (!regionConnected(regions, N, rid)) return `region ${rid} not connected`;
  }
  return null;
}

function seededPick(arr, rand) {
  return arr[Math.floor(rand() * arr.length)];
}

// ═══ 操作 1：连续 2–4 格边界转移 ═══

/**
 * 从区域 B 沿 A/B 边界选取连续（正交相连）的 2–4 格整体转移给相邻区域 A。
 * 保持 A、B 均连通、非空。失败返回 null。
 */
export function mutateBoundaryShift(regions, N, rand) {
  const total = N * N;

  for (let attempt = 0; attempt < 20; attempt++) {
    const start = Math.floor(rand() * total);
    const fromRid = regions[start];
    const diffRids = [...new Set(
      orthoNeighbors(start, N).map((nb) => regions[nb]).filter((rid) => rid !== fromRid)
    )];
    if (diffRids.length === 0) continue;
    const toRid = seededPick(diffRids, rand);

    // 沿 from/to 边界生长连续 run：run 内格子属于 fromRid 且与 toRid 相邻
    const targetLen = 2 + Math.floor(rand() * 3); // 2..4
    const run = new Set([start]);
    while (run.size < targetLen) {
      const frontier = [];
      for (const cell of run) {
        for (const nb of orthoNeighbors(cell, N)) {
          if (run.has(nb) || regions[nb] !== fromRid) continue;
          const touchesTo = orthoNeighbors(nb, N).some((n2) => regions[n2] === toRid);
          if (touchesTo) frontier.push(nb);
        }
      }
      if (frontier.length === 0) break;
      run.add(seededPick(frontier, rand));
    }
    if (run.size < 2) continue;

    const next = [...regions];
    for (const cell of run) next[cell] = toRid;

    // fromRid 必须仍非空且连通；toRid 必须连通
    if (regionCellsOf(next, fromRid).length === 0) continue;
    if (!regionConnected(next, N, fromRid)) continue;
    if (!regionConnected(next, N, toRid)) continue;
    return next;
  }
  return null;
}

// ═══ 操作 2：局部 3×3 / 4×4 区域重划 ═══

/**
 * 选取 3×3 或 4×4 窗口，把窗口内格子围绕既有区域锚点重新生长分配。
 * 只允许分配给窗口内原有区域（保持区域集合不变），
 * 生长仅从既有同区格推进（锚点导向），保证连通不变式。
 * 失败返回 null。
 */
export function mutateBlockRepartition(regions, N, rand) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const k = 3 + Math.floor(rand() * 2); // 3 或 4
    if (k > N) continue;
    const r0 = Math.floor(rand() * (N - k + 1));
    const c0 = Math.floor(rand() * (N - k + 1));
    const window = [];
    for (let dr = 0; dr < k; dr++) {
      for (let dc = 0; dc < k; dc++) window.push((r0 + dr) * N + (c0 + dc));
    }
    const windowSet = new Set(window);
    const windowRids = new Set(window.map((i) => regions[i]));

    const next = [...regions];
    const unassigned = new Set(window);
    for (const cell of window) next[cell] = -1;

    // 完全位于窗口内的区域：保留原格中随机一格作为种子
    for (const rid of windowRids) {
      const outside = regionCellsOf(regions, rid).filter((i) => !windowSet.has(i));
      if (outside.length === 0) {
        const inside = regionCellsOf(regions, rid).filter((i) => windowSet.has(i));
        const seedCell = seededPick(inside, rand);
        next[seedCell] = rid;
        unassigned.delete(seedCell);
      }
    }

    // 锚点导向生长：未分配格必须与某个已确定的窗口内原有区域格正交相邻
    let stalled = false;
    while (unassigned.size > 0 && !stalled) {
      const frontier = [];
      for (const cell of unassigned) {
        const adjRids = [...new Set(
          orthoNeighbors(cell, N)
            .map((nb) => next[nb])
            .filter((rid) => rid !== -1 && windowRids.has(rid))
        )];
        if (adjRids.length > 0) frontier.push({ cell, adjRids });
      }
      if (frontier.length === 0) { stalled = true; break; }
      const pick = frontier[Math.floor(rand() * frontier.length)];
      next[pick.cell] = seededPick(pick.adjRids, rand);
      unassigned.delete(pick.cell);
    }
    if (stalled) continue;

    // 覆盖 + 每个窗口区域非空 + 全部连通
    for (const rid of windowRids) {
      if (regionCellsOf(next, rid).length === 0) { stalled = true; break; }
    }
    if (stalled) continue;
    if (validateRegions(next, N) !== null) continue;
    if (next.every((rid, i) => rid === regions[i])) continue; // 无变化
    return next;
  }
  return null;
}

// ═══ 操作 3：相邻区域合并后围绕目标星重新切分 ═══

/**
 * 选一对相邻区域 A/B，合并其格子后，以当前解中 A、B 内的目标星为种子
 * 双路受控生长重新切分为两个新区域（沿用原 label）。
 * targetStars：当前 regions 的一组解（星位数组）。失败返回 null。
 */
export function mutateMergeResplit(regions, N, rand, targetStars) {
  if (!Array.isArray(targetStars) || targetStars.length === 0) return null;

  for (let attempt = 0; attempt < 12; attempt++) {
    // 随机选相邻区域对
    const start = Math.floor(rand() * regions.length);
    const ridA = regions[start];
    const adjRids = [...new Set(
      regionCellsOf(regions, ridA)
        .flatMap((cell) => orthoNeighbors(cell, N).map((nb) => regions[nb]))
        .filter((rid) => rid !== ridA)
    )];
    if (adjRids.length === 0) continue;
    const ridB = seededPick(adjRids, rand);

    const starsA = targetStars.filter((idx) => regions[idx] === ridA);
    const starsB = targetStars.filter((idx) => regions[idx] === ridB);
    if (starsA.length === 0 || starsB.length === 0) continue;

    const merged = new Set([...regionCellsOf(regions, ridA), ...regionCellsOf(regions, ridB)]);
    const next = [...regions];
    const unassigned = new Set(merged);

    // 以目标星为种子
    for (const idx of starsA) { next[idx] = ridA; unassigned.delete(idx); }
    for (const idx of starsB) { next[idx] = ridB; unassigned.delete(idx); }

    // 双路受控生长：每步随机选一个与已分配格相邻的未分配格
    let stalled = false;
    while (unassigned.size > 0 && !stalled) {
      const frontier = [];
      for (const cell of unassigned) {
        const adjOwn = [...new Set(
          orthoNeighbors(cell, N)
            .filter((nb) => merged.has(nb) && !unassigned.has(nb))
            .map((nb) => next[nb])
        )];
        if (adjOwn.length > 0) frontier.push({ cell, adjOwn });
      }
      if (frontier.length === 0) { stalled = true; break; }
      const pick = frontier[Math.floor(rand() * frontier.length)];
      next[pick.cell] = seededPick(pick.adjOwn, rand);
      unassigned.delete(pick.cell);
    }
    if (stalled) continue;

    if (!regionConnected(next, N, ridA) || !regionConnected(next, N, ridB)) continue;
    if (next.every((rid, i) => rid === regions[i])) continue; // 无变化
    return next;
  }
  return null;
}

// ═══ 宏观变异管线 ═══

const OP_TABLE = [
  { name: 'boundary-shift', fn: (regions, N, rand) => mutateBoundaryShift(regions, N, rand) },
  { name: 'block-repartition', fn: (regions, N, rand) => mutateBlockRepartition(regions, N, rand) },
  { name: 'merge-resplit', fn: (regions, N, rand, sol) => mutateMergeResplit(regions, N, rand, sol) },
];

/**
 * 宏观变异管线。
 * 从父模板出发反复叠加宏观操作，每个被接受的步骤都必须：
 * 覆盖完整 + 全区连通 + Solver UNIQUE（否则回退该步）。
 * 直到与父模板 D4 相似度 ≤ maxParentSimilarity 且开局指纹与父模板不同。
 *
 * 成功返回 { regions, solution, ops, parentSimilarity, fingerprint }（solution 即 Solver 解），
 * maxRounds 内不达标返回 null（调用方回退到旧生成路径）。
 */
export function applyMacroMutation(baseRegions, N, rand, opts = {}) {
  const {
    quota = 1,
    maxParentSimilarity = 0.9,
    maxRounds = 14,
  } = opts;
  const solverOpts = { starsPerRow: quota, starsPerCol: quota, starsPerRegion: quota };

  if (validateRegions(baseRegions, N) !== null) return null;

  let parentSolve;
  try { parentSolve = solveStarLine(N, baseRegions, solverOpts); }
  catch { return null; }
  if (!parentSolve.solutions || parentSolve.solutions.length === 0) return null;

  const parentFingerprint = computeOpeningFingerprint(N, baseRegions, quota).fingerprint;

  let current = [...baseRegions];
  let currentSolution = parentSolve.solutions[0];
  const ops = [];

  for (let round = 0; round < maxRounds; round++) {
    const op = OP_TABLE[Math.floor(rand() * OP_TABLE.length)];
    const mutated = op.fn(current, N, rand, currentSolution);
    if (!mutated) continue;

    // 不变式：覆盖 + 连通
    if (validateRegions(mutated, N) !== null) continue;

    // 每次变异必须经 Solver 验证 UNIQUE，否则回退该步
    let sr;
    try { sr = solveStarLine(N, mutated, solverOpts); }
    catch { continue; }
    if (sr.status !== 'UNIQUE') continue;

    current = mutated;
    currentSolution = sr.solutions[0];
    ops.push(op.name);

    // 接受判定：与父模板 D4 相似度明显下降 + 开局指纹不同
    const parentSimilarity = d4AlignedRegionJaccard(current, baseRegions, N);
    if (parentSimilarity > maxParentSimilarity) continue;
    const fingerprint = computeOpeningFingerprint(N, current, quota).fingerprint;
    if (fingerprint === parentFingerprint) continue;

    return {
      regions: current,
      solution: currentSolution,
      ops: [...ops],
      parentSimilarity,
      fingerprint,
    };
  }

  return null;
}
