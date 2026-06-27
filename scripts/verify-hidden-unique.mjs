/**
 * Hidden 关卡唯一解验证工具
 * 用法：node scripts/verify-hidden-unique.mjs
 *
 * 对每个 Hidden 关卡执行：
 * 1. 结构校验（N、path、keyNumbers）
 * 2. 移动次数校验（关键数字之间 b-a 次移动）
 * 3. 唯一解校验（仅给定 keyNumbers，搜索所有合法路径）
 */

import { HIDDEN_LEVELS_LIST } from '../src/data/hiddenLevels.js';

// ── helpers ──
function toRC(idx, N) { return { r: Math.floor(idx / N), c: idx % N }; }

const ORTHO_DIRS = [[-1,0],[1,0],[0,-1],[0,1]];

function inBounds(r, c, N) { return r >= 0 && r < N && c >= 0 && c < N; }

let totalChecks = 0;
let passedChecks = 0;
const errors = [];

function chk(cond, msg) {
  totalChecks++;
  if (cond) { passedChecks++; } else { errors.push(msg); }
}

// ── 1. 结构校验 ──
function validateStructure(level) {
  const { id, N, path, keyNumbers, startIndex } = level;
  const label = `[${id}]`;

  chk(N === 5, `${label} N=${N}, 期望 5`);
  chk(Array.isArray(path), `${label} path 是数组`);
  chk(path.length === 25, `${label} path.length=${path.length}, 期望 25`);
  chk(new Set(path).size === 25, `${label} path 索引不重复`);
  chk(path.every(i => i >= 0 && i < 25), `${label} path 索引在 0..24`);

  chk(Array.isArray(keyNumbers), `${label} keyNumbers 是数组`);
  chk(keyNumbers.length >= 5 && keyNumbers.length <= 6, `${label} keyNumbers 数量=${keyNumbers.length}, 建议 5-6`);
  chk(keyNumbers[0] === 1, `${label} 第一个关键数字应为 1`);
  chk(keyNumbers[keyNumbers.length - 1] === 25, `${label} 最后一个关键数字应为 25`);

  // 验证 keyNumbers 位置与 path 一致
  const valToIdx = {};
  path.forEach((idx, i) => { valToIdx[i + 1] = idx; });

  for (const kn of keyNumbers) {
    const expectedIdx = valToIdx[kn];
    chk(expectedIdx !== undefined, `${label} 关键数字 ${kn} 在 path 中没有对应位置`);
  }

  // 验证四向连续
  for (let i = 0; i < path.length - 1; i++) {
    const a = toRC(path[i], N), b = toRC(path[i+1], N);
    const dr = Math.abs(a.r - b.r), dc = Math.abs(a.c - b.c);
    chk((dr === 1 && dc === 0) || (dr === 0 && dc === 1),
      `${label} path[${i}]→path[${i+1}] (${path[i]}→${path[i+1]}) 不是四向相邻`);
  }

  chk(startIndex === path[0], `${label} startIndex=${startIndex}, 期望 ${path[0]}`);

  return { valToIdx };
}

// ── 2. 移动次数校验 ──
function validateSegmentLengths(level, valToIdx) {
  const { id, keyNumbers } = level;
  const label = `[${id}]`;

  for (let i = 0; i < keyNumbers.length - 1; i++) {
    const a = keyNumbers[i], b = keyNumbers[i+1];
    const idxA = valToIdx[a], idxB = valToIdx[b];
    const expectedMoves = b - a;

    // 计算从 idxA 到 idxB 在 path 中的移动次数
    const posA = level.path.indexOf(idxA);
    const posB = level.path.indexOf(idxB);
    const actualMoves = posB - posA;

    chk(actualMoves === expectedMoves,
      `${label} 段 ${a}→${b}: 移动次数=${actualMoves}, 期望 ${expectedMoves} (b-a=${b-a})`);
  }
}

// ── 3. 唯一解校验 ──
// BFS/DFS solver：仅给定 keyNumbers 和其棋盘位置，搜索所有满足约束的完整路径
function solveUnique(level, valToIdx) {
  const { N, keyNumbers } = level;
  const totalCells = N * N;

  // key number → cell index mapping
  const knToIdx = {};
  for (const kn of keyNumbers) {
    knToIdx[kn] = valToIdx[kn];
  }

  const knIdxToVal = {};
  for (const [kn, idx] of Object.entries(knToIdx)) {
    knIdxToVal[idx] = parseInt(kn);
  }

  const startIdx = knToIdx[1];
  const endKn = keyNumbers[keyNumbers.length - 1];
  const endIdx = knToIdx[endKn];

  // Build segment constraints: [{ endKn, endIdx, requiredSteps }]
  const segments = [];
  for (let i = 0; i < keyNumbers.length - 1; i++) {
    const a = keyNumbers[i], b = keyNumbers[i+1];
    segments.push({
      endValue: b,
      endIdx: knToIdx[b],
      requiredSteps: b - a
    });
  }

  let solutionCount = 0;
  let firstSolution = null;
  const visited = new Array(totalCells).fill(false);
  visited[startIdx] = true;

  // DFS: currentIdx, stepInSegment, segmentIndex, totalVisited
  function dfs(currentIdx, stepInSegment, segIdx, totalVisited) {
    // If we've visited all cells
    if (totalVisited === totalCells) {
      // Must be at the final key number
      if (currentIdx === endIdx && segIdx === segments.length) {
        solutionCount++;
        if (!firstSolution) firstSolution = [...visited];
        return solutionCount > 1 ? 2 : 1; // early exit if >1 solution
      }
      return solutionCount;
    }

    const { r, c } = toRC(currentIdx, N);

    for (const [dr, dc] of ORTHO_DIRS) {
      const nr = r + dr, nc = c + dc;
      if (!inBounds(nr, nc, N)) continue;
      const nextIdx = nr * N + nc;
      if (visited[nextIdx]) continue;

      const nextStepInSeg = stepInSegment + 1;

      // Check if nextIdx is a key number
      if (knIdxToVal[nextIdx] !== undefined) {
        // Must be the expected next key number in sequence
        if (segIdx < segments.length && segments[segIdx].endIdx === nextIdx) {
          // Must have exactly the right number of steps
          if (nextStepInSeg === segments[segIdx].requiredSteps) {
            visited[nextIdx] = true;
            const result = dfs(nextIdx, 0, segIdx + 1, totalVisited + 1);
            visited[nextIdx] = false;
            if (result >= 2) return result;
          }
          // If wrong step count, this path is invalid — don't continue
          continue;
        }
        // Hit a key number out of sequence — invalid
        continue;
      }

      // Regular cell — continue
      // But check: if nextStepInSeg >= requiredSteps for current segment, we're stuck
      if (segIdx < segments.length && nextStepInSeg >= segments[segIdx].requiredSteps) {
        // Can't reach the target in time, but we're not at a key cell
        // This is OK if we eventually reach it; but if we've exceeded, skip
        if (nextStepInSeg > segments[segIdx].requiredSteps) {
          continue;
        }
      }

      visited[nextIdx] = true;
      const result = dfs(nextIdx, nextStepInSeg, segIdx, totalVisited + 1);
      visited[nextIdx] = false;
      if (result >= 2) return result;
    }
    return solutionCount;
  }

  dfs(startIdx, 0, 0, 1);

  return { solutionCount, firstSolution };
}

// ── main ──
console.log('Hidden 关卡唯一解验证\n');

for (const level of HIDDEN_LEVELS_LIST) {
  console.log(`─── ${level.id} (${level.title}) ───`);

  const { valToIdx } = validateStructure(level);
  validateSegmentLengths(level, valToIdx);

  // 唯一解搜索
  console.log(`  搜索唯一解中...`);
  const startTime = Date.now();
  const { solutionCount } = solveUnique(level, valToIdx);
  const elapsed = Date.now() - startTime;

  if (solutionCount === 1) {
    console.log(`  ✅ 唯一解 (耗时 ${elapsed}ms)`);
    passedChecks++;
    totalChecks++;
  } else if (solutionCount === 0) {
    console.log(`  ❌ 无解`);
    errors.push(`[${level.id}] 无解：给定关键数字下不存在满足所有约束的完整路径`);
  } else {
    console.log(`  ❌ 多解：找到 ${solutionCount} 条路径`);
    errors.push(`[${level.id}] 多解：找到 ${solutionCount} 条满足约束的完整路径`);
    totalChecks++;
  }
  console.log('');
}

// ── 总结 ──
console.log('═══════════════════════════');
console.log(`总计：${passedChecks}/${totalChecks} 通过`);

if (errors.length > 0) {
  console.log(`\n❌ ${errors.length} 个错误：`);
  errors.forEach(e => console.log(`   - ${e}`));
  process.exit(1);
} else {
  console.log('✅ 所有 Hidden 关卡验证通过');
  process.exit(0);
}
