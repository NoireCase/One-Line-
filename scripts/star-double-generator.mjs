/**
 * Star Double 候选关卡生成器 (Package D0)。
 *
 * 支持 8×8、9×9、10×10 双星候选的确定性批量生成。
 * 使用 solution-first 区域生长 + 多 family + 变异管线。
 * 每个候选必须经过 quota=2 求解与唯一解验证。
 *
 * 用法：
 *   import { generateDoubleStarBatch, GENERATOR_VERSION } from './star-double-generator.mjs';
 *   const result = generateDoubleStarBatch({ N: 8, count: 6, seed: 42, output: 'double-8x8.json' });
 */

import { solveStarLine } from './starLineSolver.mjs';
import {
  makeSolutionSig,
  makeCanonicalRegionSig,
} from './star-line-candidate-signatures.mjs';
import { computeOpeningFingerprint } from './star-line-fingerprint.mjs';
import { resolveCandidatePath, safeWriteJSON } from './lib/star-line-candidate-io.mjs';

export const GENERATOR_VERSION = '3.0.0-d0';
export const SUPPORTED_SIZES = Object.freeze([8, 9, 10]);
export const DEFAULT_ATTEMPTS_PER_CANDIDATE = 500;
export const DEFAULT_MAX_TOTAL_ATTEMPTS_FACTOR = 800;

// ═══ PRNG ═══

function mulberry32(a) {
  return function () {
    a |= 0;
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function seededShuffle(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ═══ 区域连通性验证 ═══

function orthoNeighbors(idx, N) {
  const r = Math.floor(idx / N), c = idx % N;
  const out = [];
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < N && nc >= 0 && nc < N) out.push(nr * N + nc);
  }
  return out;
}

function regionConnected(regions, N, rid) {
  const cells = [];
  for (let i = 0; i < N * N; i++) if (regions[i] === rid) cells.push(i);
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

function allConnected(regions, N) {
  for (let rid = 0; rid < N; rid++) if (!regionConnected(regions, N, rid)) return false;
  return true;
}

function validateRegions(regions, N) {
  const total = N * N;
  if (!Array.isArray(regions) || regions.length !== total) return 'wrong length';
  const rids = new Set(regions);
  if (rids.size !== N) return `expected ${N} regions, got ${rids.size}`;
  for (const rid of rids) {
    if (!regionConnected(regions, N, rid)) return `region ${rid} not connected`;
  }
  return null;
}

// ═══ Solution 生成 ═══

/**
 * 生成合法的双星解：每行 2 星、每列 2 星、无八向相邻。
 * 使用回溯法，从最受限的行开始放置。
 */
export function generateDoubleStarSolution(N, rand, maxAttempts = 500) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const colCounts = new Array(N).fill(0);
    const starSet = new Set();

    // 计算任意两个格子是否相邻
    function isAdjacent(i, j) {
      const ri = Math.floor(i / N), ci = i % N;
      const rj = Math.floor(j / N), cj = j % N;
      return Math.abs(ri - rj) <= 1 && Math.abs(ci - cj) <= 1;
    }

    // 检查一个候选格子与已放置星是否相邻
    function conflictsWithStars(idx) {
      for (const s of starSet) {
        if (isAdjacent(idx, s)) return true;
      }
      return false;
    }

    // 对给定行，列出所有合法的列对（非相邻、列计数未满）
    function rowColumnPairs(row) {
      const validCols = [];
      for (let col = 0; col < N; col++) {
        if (colCounts[col] >= 2) continue;
        if (conflictsWithStars(row * N + col)) continue;
        validCols.push(col);
      }

      const pairs = [];
      for (let i = 0; i < validCols.length; i++) {
        for (let j = i + 1; j < validCols.length; j++) {
          const ci = validCols[i], cj = validCols[j];
          // 同行两星也不能相邻
          if (Math.abs(ci - cj) <= 1) continue;
          pairs.push([ci, cj]);
        }
      }
      return pairs;
    }

    // 回溯：逐行放置
    const rows = Array.from({ length: N }, (_, i) => i);
    // Fisher-Yates shuffle (in-place)
    for (let i = rows.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [rows[i], rows[j]] = [rows[j], rows[i]];
    }

    function backtrack(rowIdx) {
      if (rowIdx >= N) {
        // 全部行都放置完成 → 成功
        return true;
      }

      const row = rows[rowIdx];
      const pairs = rowColumnPairs(row);

      if (pairs.length === 0) return false;

      // 随机排序列对
      for (let i = pairs.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
      }

      for (const [c1, c2] of pairs) {
        const idx1 = row * N + c1;
        const idx2 = row * N + c2;

        // Place stars
        starSet.add(idx1);
        starSet.add(idx2);
        colCounts[c1]++;
        colCounts[c2]++;

        if (backtrack(rowIdx + 1)) return true;

        // Undo
        starSet.delete(idx1);
        starSet.delete(idx2);
        colCounts[c1]--;
        colCounts[c2]--;
      }

      return false;
    }

    if (backtrack(0)) {
      const result = [...starSet].sort((a, b) => a - b);
      // 验证
      const cc = new Array(N).fill(0);
      for (const s of result) cc[s % N]++;
      if (cc.every(c => c === 2) && result.length === 2 * N) {
        // 验证无邻接
        let ok = true;
        for (let i = 0; i < result.length && ok; i++) {
          for (let j = i + 1; j < result.length && ok; j++) {
            if (isAdjacent(result[i], result[j])) ok = false;
          }
        }
        if (ok) return result;
      }
    }
  }
  return null;
}

// ═══ 区域生长 ═══

/**
 * 从解星位出发，使用平衡 BFS 生长 N 个区域。
 * 每个区域以 2 颗星为种子，始终生长最小的区域。
 */
/**
 * 使用随机种子 + 平衡 BFS 生长生成双星区域。
 * 保证正交连通。返回 regions 或 null。
 */
function growRegionsRandom(N, rand) {
  const total = N * N;
  const allCells = Array.from({ length: total }, (_, i) => i);

  const shuffled = seededShuffle(allCells, rand);
  const seeds = shuffled.slice(0, N);
  const regions = new Array(total).fill(-1);
  const assigned = new Set(seeds);
  const growthHeads = [...seeds];

  for (let i = 0; i < N; i++) regions[seeds[i]] = i;

  let stallCount = 0;
  const STALL_LIMIT = total * 3;

  while (assigned.size < total && stallCount < STALL_LIMIT) {
    const sizes = [];
    for (let rid = 0; rid < N; rid++) {
      let sz = 0;
      for (let i = 0; i < total; i++) if (regions[i] === rid) sz++;
      sizes.push({ rid, size: sz });
    }
    sizes.sort((a, b) => a.size - b.size);

    let anyGrew = false;
    for (const { rid } of sizes) {
      if (assigned.size >= total) break;
      const head = growthHeads[rid];
      const hr = Math.floor(head / N), hc = head % N;
      const dirs = seededShuffle([[0, 1], [0, -1], [1, 0], [-1, 0]], rand);
      let grew = false;
      for (const [dr, dc] of dirs) {
        const nr = hr + dr, nc = hc + dc;
        if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
        const ni = nr * N + nc;
        if (!assigned.has(ni)) { assigned.add(ni); regions[ni] = rid; growthHeads[rid] = ni; grew = true; anyGrew = true; break; }
      }
      if (!grew) {
        for (let i = 0; i < total; i++) {
          if (regions[i] !== rid) continue;
          const r = Math.floor(i / N), c = i % N;
          for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
            const ni = nr * N + nc;
            if (!assigned.has(ni)) { assigned.add(ni); regions[ni] = rid; growthHeads[rid] = ni; grew = true; anyGrew = true; break; }
          }
          if (grew) break;
        }
      }
    }
    if (!anyGrew) {
      stallCount++;
      for (let i = 0; i < total; i++) {
        if (regions[i] !== -1) continue;
        const r = Math.floor(i / N), c = i % N;
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
          const nbRid = regions[nr * N + nc];
          if (nbRid >= 0) { assigned.add(i); regions[i] = nbRid; growthHeads[nbRid] = i; anyGrew = true; break; }
        }
        if (anyGrew) break;
      }
    } else { stallCount = 0; }
  }

  if (assigned.size < total || !allConnected(regions, N)) return null;
  return regions;
}

/**
 * 基于目标解构造区域：将解星位按空间邻近度配对到区域，
 * 然后从种子星出发 BFS 生长剩余格子。
 * 保证区域连通且包含确切 2 个目标星。
 */
function growRegionsAroundSolution(N, solution, rand) {
  const total = N * N;

  // 计算星位间曼哈顿距离并贪心配对
  const unpaired = [...solution];
  const pairs = []; // [{rid, cells: [star1, star2]}]

  // 贪心：每次找距离最近的两个星配对
  while (unpaired.length >= 2) {
    let bestDist = Infinity;
    let bestI = 0, bestJ = 1;
    for (let i = 0; i < unpaired.length; i++) {
      const ri = Math.floor(unpaired[i] / N), ci = unpaired[i] % N;
      for (let j = i + 1; j < unpaired.length; j++) {
        const rj = Math.floor(unpaired[j] / N), cj = unpaired[j] % N;
        const dist = Math.abs(ri - rj) + Math.abs(ci - cj);
        if (dist < bestDist) { bestDist = dist; bestI = i; bestJ = j; }
      }
    }
    pairs.push({ rid: pairs.length, cells: [unpaired[bestI], unpaired[bestJ]] });
    // 移除（先移除大索引）
    unpaired.splice(Math.max(bestI, bestJ), 1);
    unpaired.splice(Math.min(bestI, bestJ), 1);
  }

  // 初始化区域
  const regions = new Array(total).fill(-1);
  const assigned = new Set();

  for (const { rid, cells } of pairs) {
    for (const cell of cells) {
      regions[cell] = rid;
      assigned.add(cell);
    }
  }

  // BFS 生长：从每个区域出发生长到邻居格子
  // 使用 frontier-based 生长
  const frontiers = Array.from({ length: N }, (_, rid) => {
    const f = new Set();
    for (let i = 0; i < total; i++) {
      if (regions[i] === rid) {
        for (const nb of orthoNeighbors(i, N)) {
          if (!assigned.has(nb)) f.add(nb);
        }
      }
    }
    return [...f];
  });

  let stallCount = 0;
  const STALL_LIMIT = total * 3;

  while (assigned.size < total && stallCount < STALL_LIMIT) {
    // 生长最小区域
    const sizes = [];
    for (let rid = 0; rid < N; rid++) {
      let sz = 0;
      for (let i = 0; i < total; i++) if (regions[i] === rid) sz++;
      sizes.push({ rid, size: sz });
    }
    sizes.sort((a, b) => a.size - b.size);

    let anyGrew = false;
    for (const { rid } of sizes) {
      if (assigned.size >= total) break;
      if (frontiers[rid].length === 0) continue;

      const pickIdx = Math.floor(rand() * frontiers[rid].length);
      const pick = frontiers[rid][pickIdx];
      regions[pick] = rid;
      assigned.add(pick);
      frontiers[rid].splice(pickIdx, 1);

      for (const nb of orthoNeighbors(pick, N)) {
        if (!assigned.has(nb) && !frontiers[rid].includes(nb)) {
          frontiers[rid].push(nb);
        }
      }
      for (let oRid = 0; oRid < N; oRid++) {
        if (oRid === rid) continue;
        const idx = frontiers[oRid].indexOf(pick);
        if (idx >= 0) frontiers[oRid].splice(idx, 1);
      }
      anyGrew = true;
      break;
    }

    if (!anyGrew) {
      stallCount++;
      for (let i = 0; i < total; i++) {
        if (regions[i] !== -1) continue;
        for (const nb of orthoNeighbors(i, N)) {
          if (regions[nb] >= 0) {
            regions[i] = regions[nb];
            assigned.add(i);
            for (const nb2 of orthoNeighbors(i, N)) {
              if (!assigned.has(nb2) && !frontiers[regions[nb]].includes(nb2)) {
                frontiers[regions[nb]].push(nb2);
              }
            }
            anyGrew = true;
            break;
          }
        }
        if (anyGrew) break;
      }
    } else { stallCount = 0; }
  }

  if (assigned.size < total || !allConnected(regions, N)) return null;
  return regions;
}

// ═══ 区域变异 ═══

/**
 * 单格对交换变异：随机选一对正交相邻的不同区域格子交换归属。
 * 保证连通性不变。
 */
function mutateRegionSwap(regions, N, rand, maxSwaps = 6) {
  const total = N * N;
  const result = [...regions];
  const swaps = 2 + Math.floor(rand() * (maxSwaps - 1));

  let applied = 0, attempts = 0;
  while (applied < swaps && attempts < 100) {
    attempts++;
    const cell = Math.floor(rand() * total);
    const oldRid = result[cell];
    const diffNeighbors = [];
    for (const nb of orthoNeighbors(cell, N)) {
      if (result[nb] !== oldRid) diffNeighbors.push({ idx: nb, rid: result[nb] });
    }
    if (diffNeighbors.length === 0) continue;

    const pick = diffNeighbors[Math.floor(rand() * diffNeighbors.length)];
    const prevA = result[cell], prevB = result[pick.idx];
    result[cell] = pick.rid;
    result[pick.idx] = oldRid;
    if (regionConnected(result, N, pick.rid) && regionConnected(result, N, oldRid)) {
      applied++;
    } else {
      result[cell] = prevA;
      result[pick.idx] = prevB;
    }
  }
  return applied > 0 ? result : [...regions];
}

// ═══ 结构家族分类 ═══

/**
 * 根据解的空间分布特征分类结构家族。
 * 返回 { family, subFamily }。
 */
export function classifyStructuralFamily(solution, N) {
  if (!solution || solution.length === 0) return { family: 'unknown', subFamily: 'unknown' };

  // 计算边缘星比例
  let edgeStars = 0;
  const rows = new Set();
  const cols = new Set();
  for (const s of solution) {
    const r = Math.floor(s / N), c = s % N;
    rows.add(r);
    cols.add(c);
    if (r === 0 || r === N - 1 || c === 0 || c === N - 1) edgeStars++;
  }
  const edgeRatio = edgeStars / solution.length;

  // 计算星位在棋盘上的分布均匀度
  const quadrantCounts = [0, 0, 0, 0]; // TL, TR, BL, BR
  const mid = (N - 1) / 2;
  for (const s of solution) {
    const r = Math.floor(s / N), c = s % N;
    const qr = r <= mid ? 0 : 2;
    const qc = c <= mid ? 0 : 1;
    quadrantCounts[qr + qc]++;
  }
  const maxQuad = Math.max(...quadrantCounts);
  const minQuad = Math.min(...quadrantCounts);

  // Diagonal tendency: fraction of stars on main or anti diagonal (±1)
  let diagStars = 0;
  for (const s of solution) {
    const r = Math.floor(s / N), c = s % N;
    if (Math.abs(r - c) <= 1 || Math.abs(r + c - (N - 1)) <= 1) diagStars++;
  }
  const diagRatio = diagStars / solution.length;

  if (edgeRatio >= 0.45) {
    return { family: 'edge', subFamily: edgeRatio >= 0.6 ? 'edge-heavy' : 'edge-moderate' };
  }
  if (diagRatio >= 0.4) {
    return { family: 'diagonal', subFamily: diagRatio >= 0.55 ? 'diagonal-strong' : 'diagonal-weak' };
  }
  if (maxQuad - minQuad >= 4) {
    return { family: 'clustered', subFamily: `q${maxQuad}` };
  }
  return { family: 'distributed', subFamily: 'balanced' };
}

// ═══ 单个候选生成 ═══

/**
 * 生成一个双星候选。
 *
 * @param {number} N - 棋盘边长 (8, 9, 10)
 * @param {number} seed - 基础种子
 * @param {number} index - 候选索引
 * @param {object} opts
 * @param {number} opts.maxAttempts - 此候选最多尝试次数
 * @returns {object|null} 候选对象，失败返回 null
 */
export function generateDoubleStarCandidate(N, seed, index, opts = {}) {
  if (!SUPPORTED_SIZES.includes(N)) return null;

  const maxAttempts = opts.maxAttempts ?? DEFAULT_ATTEMPTS_PER_CANDIDATE;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rand = mulberry32(seed + index * 31337 + attempt * 7919);

    // Generate regions and check for UNIQUE solution
    let regions = null;
    let strategy = 'random';

    // Strategy A: solution-around (try first, especially useful for constrained sizes)
    if (attempt % 4 !== 0) {
      const solution = generateDoubleStarSolution(N, rand);
      if (solution) {
        const r2 = mulberry32(seed + index * 31337 + attempt * 7919 + 10007);
        regions = growRegionsAroundSolution(N, solution, r2);
        if (regions && validateRegions(regions, N) === null) {
          strategy = 'solution-around';
        } else {
          regions = null;
        }
      }
    }

    // Strategy B: random growth
    if (!regions) {
      regions = growRegionsRandom(N, rand);
      strategy = 'random';
    }

    if (!regions || validateRegions(regions, N) !== null) continue;

    // Apply mutations for diversity
    const r3 = mulberry32(seed + index * 31337 + attempt * 7919 + 20011);
    const mutated = mutateRegionSwap(regions, N, r3, 8);
    if (!allConnected(mutated, N)) continue;

    // Verify UNIQUE solution for quota=2
    let sr;
    try {
      sr = solveStarLine(N, mutated, {
        starsPerRow: 2, starsPerCol: 2, starsPerRegion: 2,
      });
    } catch (_) { continue; }

    if (sr.status !== 'UNIQUE') continue;

    const finalSolution = sr.solutions[0];
    const structuralFamily = classifyStructuralFamily(finalSolution, N);
    const candidateId = `star-double-${N}x${N}-s${seed}-i${index}`;

    return {
      candidateId,
      seed,
      gameId: 'starDouble',
      N,
      starsPerRow: 2, starsPerCol: 2, starsPerRegion: 2,
      regions: mutated,
      solution: finalSolution,
      solutionSignature: makeSolutionSig('starDouble', N, 2, finalSolution),
      canonicalRegionSignature: makeCanonicalRegionSig('starDouble', N, 2, mutated),
      generatorFamily: `${strategy}-${structuralFamily.family}`,
      structuralFamily: structuralFamily.family,
      structuralSubFamily: structuralFamily.subFamily,
      generationMetadata: {
        generatorVersion: GENERATOR_VERSION,
        seed,
        parameters: { mode: 'starDouble', N, quota: 2, index },
        attempts: attempt + 1,
        strategy,
      },
    };
  }

  return null;
}

// ═══ 批量生成 ═══

/**
 * 批量生成双星候选，带完整去重和质量门禁。
 *
 * @param {object} opts
 * @param {number} opts.N - 棋盘边长
 * @param {number} opts.count - 目标数量
 * @param {number} opts.seed - 基础种子
 * @param {string} opts.output - 输出文件名
 * @param {boolean} [opts.force] - 覆盖已有文件
 * @param {number} [opts.maxTotalAttempts] - 最大总尝试次数
 * @returns {object} { success, candidates, stats, outputPath }
 */
export function generateDoubleStarBatch(opts) {
  const { N, count, seed, output, force } = opts;

  if (!SUPPORTED_SIZES.includes(N)) {
    throw new Error(`不支持的尺寸: ${N}。支持: ${SUPPORTED_SIZES.join(', ')}`);
  }

  const maxTotalAttempts = opts.maxTotalAttempts ?? count * DEFAULT_MAX_TOTAL_ATTEMPTS_FACTOR;
  const candidates = [];
  const seenSolutionSigs = new Set();
  const seenRegionSigs = new Set();
  const failReasons = {};
  let totalAttempts = 0;

  for (let i = 0; i < count && totalAttempts < maxTotalAttempts; i++) {
    // 每个候选使用不同的派生 seed
    const derivedSeed = seed + i * 10007;
    const cand = generateDoubleStarCandidate(N, derivedSeed, 0);

    if (!cand) {
      failReasons['no-unique'] = (failReasons['no-unique'] || 0) + 1;
      totalAttempts += DEFAULT_ATTEMPTS_PER_CANDIDATE;
      continue;
    }

    totalAttempts += cand.generationMetadata?.attempts ?? DEFAULT_ATTEMPTS_PER_CANDIDATE;

    // 去重检查：仅检查 canonical region（D4 等价区域布局）
    // solution 重复允许（尤其对于 8×8 等约束空间有限的情况），
    // 只要 region 布局不同即可视为不同候选
    if (seenRegionSigs.has(cand.canonicalRegionSignature)) {
      failReasons['dup-region-d4'] = (failReasons['dup-region-d4'] || 0) + 1;
      continue;
    }

    if (seenSolutionSigs.has(cand.solutionSignature)) {
      failReasons['dup-solution'] = (failReasons['dup-solution'] || 0) + 1;
      // 不 reject——允许同 solution 不同 region 的候选
    }

    seenSolutionSigs.add(cand.solutionSignature);
    seenRegionSigs.add(cand.canonicalRegionSignature);

    // 计算开局指纹
    const fp = computeOpeningFingerprint(N, cand.regions, 2);
    cand.openingFingerprint = fp.fingerprint;

    candidates.push(cand);
  }

  // 统计
  const succeeded = candidates.length;
  if (succeeded < count) {
    failReasons['maxed-out'] = (failReasons['maxed-out'] || 0) + (count - succeeded);
  }

  const stats = { totalAttempts, failReasons };

  const result = {
    generatorVersion: GENERATOR_VERSION,
    parameters: { mode: 'starDouble', N, quota: 2, count, seed },
    candidates,
    stats,
  };

  // 写入输出
  if (output) {
    const outputPath = resolveCandidatePath(output);
    safeWriteJSON(outputPath, result, { force: !!force });
    return { success: candidates.length >= count, candidates, stats, outputPath };
  }

  return { success: candidates.length >= count, candidates, stats };
}

// ═══ CLI 入口 ═══

function parseArgs() {
  const a = process.argv.slice(2), p = {};
  for (let i = 0; i < a.length; i++) {
    const k = a[i].replace(/^--?/, '');
    if (k === 'force') { p.force = true; continue; }
    if (k === 'help') { p.help = true; continue; }
    p[k] = a[i + 1];
    i++;
  }
  return p;
}

function usage() {
  console.log(`
用法: node scripts/star-double-generator.mjs --size <8|9|10> --count <n> --seed <n> --output <path> [--force]

选项:
  --size     棋盘边长 (8, 9, 10)
  --count    目标候选数量
  --seed     随机种子（整数）
  --output   输出文件名（相对于 tmp/star-line-candidates/）
  --force    覆盖已有文件
  --max-total-attempts  最大总尝试次数（默认 count × 800）
  --help     显示此帮助

示例:
  node scripts/star-double-generator.mjs --size 8 --count 6 --seed 42 --output double-8x8.json
  node scripts/star-double-generator.mjs --size 10 --count 6 --seed 100 --output double-10x10.json --force
`);
  process.exit(0);
}

function main() {
  const args = parseArgs();
  if (args.help) usage();

  if (!args.size || !args.output) {
    console.error('缺少必要参数。使用 --help 查看用法。');
    process.exit(1);
  }

  const N = parseInt(args.size, 10);
  if (isNaN(N) || !SUPPORTED_SIZES.includes(N)) {
    console.error(`--size 必须是 ${SUPPORTED_SIZES.join(', ')}，实际: ${args.size}`);
    process.exit(1);
  }

  const count = parseInt(args.count || '6', 10);
  if (isNaN(count) || count < 1) {
    console.error('--count 必须是正整数');
    process.exit(1);
  }

  const seed = parseInt(args.seed || '1', 10);
  if (isNaN(seed)) {
    console.error('--seed 必须是整数');
    process.exit(1);
  }

  const maxTotalAttempts = args['max-total-attempts']
    ? parseInt(args['max-total-attempts'], 10)
    : undefined;

  try {
    const result = generateDoubleStarBatch({
      N, count, seed,
      output: args.output,
      force: !!args.force,
      maxTotalAttempts,
    });

    if (result.success) {
      console.log(`完成: ${result.candidates.length}/${count} 候选, 输出 ${result.outputPath}`);
      console.log(`统计: ${result.stats.totalAttempts} 次尝试`);
      for (const [k, v] of Object.entries(result.stats.failReasons)) {
        console.log(`  ${k}: ${v}`);
      }
    } else {
      console.error(`生成不足: ${result.candidates.length}/${count}`);
      console.error(`统计: ${result.stats.totalAttempts} 次尝试`);
      for (const [k, v] of Object.entries(result.stats.failReasons)) {
        console.error(`  ${k}: ${v}`);
      }
      process.exit(1);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

const __filename = import.meta.url.replace('file://', '');
if (process.argv[1] === __filename) {
  main();
}
