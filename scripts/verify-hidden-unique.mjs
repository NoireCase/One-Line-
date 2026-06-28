/**
 * Hidden 关卡唯一解验证工具
 * 用法：node scripts/verify-hidden-unique.mjs
 * 支持 5x5 (Easy) 和 7x7 (Medium)
 */
import { HIDDEN_LEVELS_LIST } from '../src/data/hiddenLevels.js';

function toRC(idx, N) { return { r: Math.floor(idx / N), c: idx % N }; }
const ORTHO_DIRS = [[-1,0],[1,0],[0,-1],[0,1]];
function inBounds(r, c, N) { return r >= 0 && r < N && c >= 0 && c < N; }

let totalChecks = 0, passedChecks = 0;
const errors = [];

function chk(cond, msg) {
  totalChecks++;
  if (cond) passedChecks++;
  else errors.push(msg);
}

function validateStructure(level) {
  const { id, N, path, keyNumbers, startIndex, archetypeTags } = level;
  const label = `[${id}]`;
  const L = N * N;

  chk(N === 5 || N === 7, `${label} N=${N}, 期望 5 或 7`);
  chk(Array.isArray(path), `${label} path 是数组`);
  chk(path.length === L, `${label} path.length=${path.length}, 期望 ${L}`);
  chk(new Set(path).size === L, `${label} path 索引不重复`);
  chk(path.every(i => i >= 0 && i < L), `${label} path 索引在 0..${L-1}`);

  chk(Array.isArray(keyNumbers), `${label} keyNumbers 是数组`);
  const minKN = N === 5 ? 5 : 11, maxKN = N === 5 ? 6 : 15;
  chk(keyNumbers.length >= minKN && keyNumbers.length <= maxKN,
    `${label} keyNumbers 数量=${keyNumbers.length}, 建议 ${minKN}-${maxKN}`);
  chk(keyNumbers[0] === 1, `${label} 第一个关键数字应为 1`);
  chk(keyNumbers[keyNumbers.length - 1] === L, `${label} 最后一个关键数字应为 ${L}`);

  // archetypeTags for Medium
  if (N === 7) {
    chk(Array.isArray(archetypeTags) && archetypeTags.length >= 1,
      `${label} Medium 关卡必须标注 archetypeTags`);
  }

  const valToIdx = {};
  path.forEach((idx, i) => { valToIdx[i + 1] = idx; });

  for (const kn of keyNumbers) {
    chk(valToIdx[kn] !== undefined, `${label} 关键数字 ${kn} 在 path 中没有对应位置`);
  }

  // 四向连续
  for (let i = 0; i < path.length - 1; i++) {
    const a = toRC(path[i], N), b = toRC(path[i+1], N);
    const dr = Math.abs(a.r - b.r), dc = Math.abs(a.c - b.c);
    chk((dr === 1 && dc === 0) || (dr === 0 && dc === 1),
      `${label} path[${i}]→path[${i+1}] (${path[i]}→${path[i+1]}) 不是四向相邻`);
  }
  chk(startIndex === path[0], `${label} startIndex=${startIndex}, 期望 ${path[0]}`);
  return { valToIdx };
}

function validateSegmentLengths(level, valToIdx) {
  const { id, keyNumbers } = level;
  const label = `[${id}]`;
  for (let i = 0; i < keyNumbers.length - 1; i++) {
    const a = keyNumbers[i], b = keyNumbers[i+1];
    const idxA = valToIdx[a], idxB = valToIdx[b];
    const posA = level.path.indexOf(idxA), posB = level.path.indexOf(idxB);
    const actualMoves = posB - posA;
    chk(actualMoves === b - a,
      `${label} 段 ${a}→${b}: 移动次数=${actualMoves}, 期望 ${b-a}`);
  }
}

function solveUnique(level, valToIdx) {
  const { N, keyNumbers } = level;
  const L = N * N;
  const knToIdx = {};
  for (const kn of keyNumbers) knToIdx[kn] = valToIdx[kn];
  const knIdxToVal = {};
  for (const [kn, idx] of Object.entries(knToIdx)) knIdxToVal[idx] = parseInt(kn);

  const startIdx = knToIdx[1];
  const endKn = keyNumbers[keyNumbers.length - 1];
  const endIdx = knToIdx[endKn];

  const segments = [];
  for (let i = 0; i < keyNumbers.length - 1; i++) {
    segments.push({ endValue: keyNumbers[i+1], endIdx: knToIdx[keyNumbers[i+1]], requiredSteps: keyNumbers[i+1] - keyNumbers[i] });
  }

  let solutionCount = 0;
  const visited = new Array(L).fill(false);
  visited[startIdx] = true;

  function dfs(currentIdx, stepInSegment, segIdx, totalVisited) {
    if (totalVisited === L) {
      if (currentIdx === endIdx && segIdx === segments.length) {
        solutionCount++;
        return solutionCount > 1 ? 2 : 1;
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

      if (knIdxToVal[nextIdx] !== undefined) {
        if (segIdx < segments.length && segments[segIdx].endIdx === nextIdx) {
          if (nextStepInSeg === segments[segIdx].requiredSteps) {
            visited[nextIdx] = true;
            const result = dfs(nextIdx, 0, segIdx + 1, totalVisited + 1);
            visited[nextIdx] = false;
            if (result >= 2) return result;
          }
          continue;
        }
        continue;
      }

      if (segIdx < segments.length && nextStepInSeg > segments[segIdx].requiredSteps) {
        continue;
      }

      visited[nextIdx] = true;
      const result = dfs(nextIdx, nextStepInSeg, segIdx, totalVisited + 1);
      visited[nextIdx] = false;
      if (result >= 2) return result;
    }
    return solutionCount;
  }

  dfs(startIdx, 0, 0, 1);
  return { solutionCount };
}

// main
console.log('Hidden 关卡唯一解验证\n');

for (const level of HIDDEN_LEVELS_LIST) {
  console.log(`─── ${level.id} (${level.title}) N=${level.N} ───`);
  const { valToIdx } = validateStructure(level);
  validateSegmentLengths(level, valToIdx);

  console.log(`  搜索唯一解中...`);
  const startTime = Date.now();
  const { solutionCount } = solveUnique(level, valToIdx);
  const elapsed = Date.now() - startTime;

  if (solutionCount === 1) {
    console.log(`  ✅ 唯一解 (${elapsed}ms)`);
    passedChecks++;
    totalChecks++;
  } else if (solutionCount === 0) {
    console.log(`  ❌ 无解`);
    errors.push(`[${level.id}] 无解`);
  } else {
    console.log(`  ❌ 多解：${solutionCount} 条`);
    errors.push(`[${level.id}] 多解：${solutionCount} 条`);
    totalChecks++;
  }
  console.log('');
}

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
