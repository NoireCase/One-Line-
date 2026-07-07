/**
 * Star Line Solver Smoke Test。
 * 运行：node scripts/test-star-line-solver.mjs
 */
import { solveStarLine } from './starLineSolver.mjs';

let passed = 0;
let failed = 0;
const suiteStart = performance.now();
const RUN_SLOW_STAR_LINE_TESTS = process.env.STAR_LINE_SLOW_TESTS === '1';

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ── 辅助：验证 solution 满足全部约束 ──
function validateSolution(sol, N, regions, quota = 1) {
  const rows = new Array(N).fill(0);
  const cols = new Array(N).fill(0);
  const regs = new Array(N).fill(0);
  for (const idx of sol) {
    rows[Math.floor(idx / N)]++;
    cols[idx % N]++;
    regs[regions[idx]]++;
  }
  for (let i = 0; i < N; i++) {
    if (rows[i] !== quota) return `row ${i}: ${rows[i]} stars, expected ${quota}`;
    if (cols[i] !== quota) return `col ${i}: ${cols[i]} stars, expected ${quota}`;
    if (regs[i] !== quota) return `region ${i}: ${regs[i]} stars, expected ${quota}`;
  }
  for (let i = 0; i < sol.length; i++) {
    for (let j = i + 1; j < sol.length; j++) {
      const ra = Math.floor(sol[i] / N), ca = sol[i] % N;
      const rb = Math.floor(sol[j] / N), cb = sol[j] % N;
      if (Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1) {
        return `stars ${sol[i]}(${ra},${ca}) and ${sol[j]}(${rb},${cb}) adjacent`;
      }
    }
  }
  return null;
}

// ═══════════════════════════════════════════
// Test 1: MULTIPLE — 列区域，解不唯一
// ═══════════════════════════════════════════
console.log('\n── 1. MULTIPLE ──');
{
  const N = 5;
  const regions = Array.from({ length: N * N }, (_, i) => i % N); // 每列一个 region
  const result = solveStarLine(N, regions);
  test('状态为 MULTIPLE', () => assert(result.status === 'MULTIPLE', `expected MULTIPLE, got ${result.status}`));
  test('找到至少 2 个解', () => assert(result.solutions.length >= 2, `expected >= 2, got ${result.solutions.length}`));
  test('解满足约束', () => {
    for (const sol of result.solutions) {
      const err = validateSolution(sol, N, regions);
      assert(err === null, `solution ${JSON.stringify(sol)}: ${err}`);
    }
  });
  console.log(`  stats: ${result.stats.durationMs}ms, ${result.stats.placements} placements, ${result.stats.backtracks} backtracks`);
}

// ═══════════════════════════════════════════
// Test 2: NO_SOLUTION — region 0 仅 1 格，region 1 全部相邻
// ═══════════════════════════════════════════
console.log('\n── 2. NO_SOLUTION ──');
{
  const N = 5;
  // (0,0)=0 是 region 0 唯一格 → 星点必须在 0
  // region 1 的格 (0,1)=1, (1,0)=5, (1,1)=6 全是 0 的八向邻居
  const regions = [
    0, 1, 2, 2, 2,
    1, 1, 2, 2, 3,
    3, 3, 3, 4, 4,
    3, 3, 4, 4, 4,
    3, 4, 4, 4, 4,
  ];
  const result = solveStarLine(N, regions);
  test('状态为 NO_SOLUTION', () => assert(result.status === 'NO_SOLUTION', `expected NO_SOLUTION, got ${result.status}`));
  test('solutions 为空', () => assert(result.solutions.length === 0, `expected 0, got ${result.solutions.length}`));
  console.log(`  stats: ${result.stats.durationMs}ms`);
}

// ═══════════════════════════════════════════
// Test 3: UNIQUE — 稳定 fixture，BFS 区域生长 + Solver 验证
// ═══════════════════════════════════════════
console.log('\n── 3. UNIQUE ──');
{
  const N = 5;
  // 从合法星点 [3,7,11,14,22] 出发，经 BFS 区域生长 + 5000 次随机搜索
  // 找到的唯一解 fixture。Solver 确认 status=UNIQUE, solution=[4,7,10,18,21]。
  // 棋盘 region 布局：
  //   2 2 0 0 0
  //   2 2 1 1 0
  //   2 2 4 1 3
  //   2 2 4 3 3
  //   4 4 4 4 4
  const regions = [
    2, 2, 0, 0, 0,
    2, 2, 1, 1, 0,
    2, 2, 4, 1, 3,
    2, 2, 4, 3, 3,
    4, 4, 4, 4, 4,
  ];

  const result = solveStarLine(N, regions);
  test('状态为 UNIQUE', () => assert(result.status === 'UNIQUE', `expected UNIQUE, got ${result.status}`));
  test('恰好 1 个解', () => assert(result.solutions.length === 1, `expected 1, got ${result.solutions.length}`));

  const sol = result.solutions[0];
  test('解满足每行 1 星', () => {
    const rows = new Array(N).fill(0);
    for (const idx of sol) rows[Math.floor(idx / N)]++;
    assert(rows.every(c => c === 1), `rows: ${JSON.stringify(rows)}`);
  });
  test('解满足每列 1 星', () => {
    const cols = new Array(N).fill(0);
    for (const idx of sol) cols[idx % N]++;
    assert(cols.every(c => c === 1), `cols: ${JSON.stringify(cols)}`);
  });
  test('解满足每 region 1 星', () => {
    const regs = new Array(N).fill(0);
    for (const idx of sol) regs[regions[idx]]++;
    assert(regs.every(c => c === 1), `regions: ${JSON.stringify(regs)}`);
  });
  test('解满足八向不相邻', () => {
    for (let i = 0; i < sol.length; i++) {
      for (let j = i + 1; j < sol.length; j++) {
        const ra = Math.floor(sol[i] / N), ca = sol[i] % N;
        const rb = Math.floor(sol[j] / N), cb = sol[j] % N;
        assert(Math.abs(ra - rb) > 1 || Math.abs(ca - cb) > 1,
          `stars ${sol[i]}(${ra},${ca}) and ${sol[j]}(${rb},${cb}) adjacent`);
      }
    }
  });
  console.log(`  solution: ${JSON.stringify(sol)}`);
  console.log(`  stats: ${result.stats.durationMs}ms, ${result.stats.placements} placements, ${result.stats.backtracks} backtracks`);
}

// ═══════════════════════════════════════════
// Test 4: 8×8 性能测试
// ═══════════════════════════════════════════
console.log('\n── 4. 8×8 性能 ──');
{
  const N = 8;
  // 棋盘区域（简化：每列一个 region，验证不超时）
  const regions = Array.from({ length: N * N }, (_, i) => i % N);
  const start = performance.now();
  const result = solveStarLine(N, regions);
  const elapsed = performance.now() - start;
  test('8×8 在 2 秒内完成', () => assert(elapsed < 2000, `耗时 ${elapsed.toFixed(0)}ms`));
  test('返回合法状态', () => assert(['NO_SOLUTION', 'UNIQUE', 'MULTIPLE'].includes(result.status), `invalid status: ${result.status}`));
  test('返回解满足全部约束（含邻接）', () => {
    for (const sol of result.solutions) {
      const err = validateSolution(sol, N, regions);
      assert(err === null, `solution: ${err}`);
    }
  });
  console.log(`  status: ${result.status}, time: ${elapsed.toFixed(1)}ms, placements: ${result.stats.placements}, backtracks: ${result.stats.backtracks}`);
}

// ═══════════════════════════════════════════
// Test 5: Validator 集成 — 验证 Solver 返回值可被 Validator 使用
// ═══════════════════════════════════════════
console.log('\n── 5. Validator 集成 ──');
{
  // 模拟 validateStarLine 中调用 Solver 的模式
  const N = 5;
  const regions = Array.from({ length: N * N }, (_, i) => i % N);
  const result = solveStarLine(N, regions);

  test('返回对象包含 status', () => assert('status' in result, 'missing status'));
  test('返回对象包含 solutions', () => assert(Array.isArray(result.solutions), 'solutions not array'));
  test('返回对象包含 stats', () => assert('stats' in result, 'missing stats'));
  test('stats 包含 durationMs', () => assert(typeof result.stats.durationMs === 'number', 'durationMs not number'));
  test('stats 包含 placements', () => assert(typeof result.stats.placements === 'number', 'placements not number'));
  test('stats 包含 backtracks', () => assert(typeof result.stats.backtracks === 'number', 'backtracks not number'));

  // 验证 solutions 最多 2 个
  test('solutions 最多 2 个', () => assert(result.solutions.length <= 2, `expected <= 2, got ${result.solutions.length}`));

  // 验证 MULTIPLE 时 solutions 恰好 2 个
  if (result.status === 'MULTIPLE') {
    test('MULTIPLE 时 solutions 恰好 2 个', () => assert(result.solutions.length === 2, `expected 2, got ${result.solutions.length}`));
  }
}

// ═══════════════════════════════════════════
// Test 6: 边界 — 非法 region 结构不崩溃
// ═══════════════════════════════════════════
console.log('\n── 6. 边界 ──');
{
  const N = 5;
  // 全在 region 0，region 1-4 缺失，属于非法/不可解结构
  const emptyRegions = new Array(25).fill(0);
  const result = solveStarLine(N, emptyRegions);
  test('全部格在同一 region 不崩溃', () => assert(result !== null && result !== undefined, 'returned null/undefined'));
  test('非法 region 结构返回 NO_SOLUTION', () => assert(result.status === 'NO_SOLUTION', `expected NO_SOLUTION, got ${result.status}`));
  test('非法 region 结构 solutions 为空', () => assert(result.solutions.length === 0, `expected 0, got ${result.solutions.length}`));
  console.log(`  status: ${result.status}`);
}

// ═══════════════════════════════════════════
// Test 7: 多星 — 10×10 二星正例 (列区域，solver 已确认可行)
// ═══════════════════════════════════════════
console.log('\n── 7. 10×10 二星正例 ──');
{
  const N = 10;
  const quota = 2;
  const regions = Array.from({ length: N * N }, (_, i) => i % N);
  const result = solveStarLine(N, regions, { starsPerRow: quota, starsPerCol: quota, starsPerRegion: quota, noAdjacent: true });
  test('二星正例不返回 NO_SOLUTION', () => assert(result.status !== 'NO_SOLUTION', `status: ${result.status}`));
  test('二星正例返回 UNIQUE 或 MULTIPLE', () => assert(['UNIQUE', 'MULTIPLE'].includes(result.status), `status: ${result.status}`));
  test('二星正例解满足全部约束（含邻接）', () => {
    for (const sol of result.solutions) {
      const err = validateSolution(sol, N, regions, quota);
      assert(err === null, `solution: ${err}`);
    }
  });
  console.log(`  status: ${result.status}, ${result.solutions.length} sol, ${result.stats.durationMs}ms, ${result.stats.backtracks} bt`);
}

// ═══════════════════════════════════════════
// Test 8: 多星 — 12×12 三星手动性能正例（默认跳过）
// ═══════════════════════════════════════════
console.log('\n── 8. 12×12 三星手动正例 ──');
if (RUN_SLOW_STAR_LINE_TESTS) {
  const N = 12;
  const quota = 3;
  const regions = Array.from({ length: N * N }, (_, i) => i % N);
  const start = performance.now();
  const result = solveStarLine(N, regions, { starsPerRow: quota, starsPerCol: quota, starsPerRegion: quota, noAdjacent: true });
  const elapsed = performance.now() - start;
  test('三星正例不返回 NO_SOLUTION', () => assert(result.status !== 'NO_SOLUTION', `status: ${result.status}`));
  test('三星正例返回 UNIQUE 或 MULTIPLE', () => assert(['UNIQUE', 'MULTIPLE'].includes(result.status), `status: ${result.status}`));
  test('三星正例在 300 秒内完成', () => assert(elapsed < 300000, `耗时 ${elapsed.toFixed(0)}ms`));
  if (result.solutions.length > 0) {
    test('三星正例解满足全部约束（含邻接）', () => {
      for (const sol of result.solutions) {
        const err = validateSolution(sol, N, regions, quota);
        assert(err === null, `solution: ${err}`);
      }
    });
  }
  console.log(`  status: ${result.status}, ${result.solutions.length} sol, ${elapsed.toFixed(0)}ms, ${result.stats.backtracks} bt`);
} else {
  console.log('  skipped: 设置 STAR_LINE_SLOW_TESTS=1 才运行；12×12 三星是极限密度性能测试，不进入默认 smoke。');
}

// ═══════════════════════════════════════════
// Test: forced-adjacent 回归 — 强制候选互相相邻必须判无解
// ═══════════════════════════════════════════
console.log('\n── FAdj. forced-adjacent 回归 ──');
{
  // 2×2 且 quota=2 时，每行都被迫放满两个相邻格。
  // 这是最小化的 forced placement 邻接陷阱，不能产出违法 solution。
  const N = 2;
  const quota = 2;
  const regions = Array.from({ length: N * N }, (_, i) => i % N);
  const result = solveStarLine(N, regions, { starsPerRow: quota, starsPerCol: quota, starsPerRegion: quota, noAdjacent: true });
  test('强制邻接布局返回 NO_SOLUTION', () => assert(result.status === 'NO_SOLUTION', `expected NO_SOLUTION, got ${result.status}`));
  test('强制邻接布局不返回任何违法解', () => assert(result.solutions.length === 0, `expected 0 solutions, got ${result.solutions.length}`));
  console.log(`  status: ${result.status}, ${result.stats.durationMs}ms, ${result.stats.backtracks} bt`);
}

// ═══════════════════════════════════════════
// Test 9: 多星 — N=7 二星负例（邻接约束下数学不可行）
// ═══════════════════════════════════════════
console.log('\n── 9. N=7 二星负例 (impossible) ──');
{
  const N = 7;
  const quota = 2;
  const regions = Array.from({ length: N * N }, (_, i) => i % N);
  const result = solveStarLine(N, regions, { starsPerRow: quota, starsPerCol: quota, starsPerRegion: quota, noAdjacent: true });
  test('N=7 二星+邻接 → 应为 NO_SOLUTION', () => assert(result.status === 'NO_SOLUTION', `expected NO_SOLUTION, got ${result.status}`));
  console.log(`  status: ${result.status}, ${result.stats.durationMs}ms, ${result.stats.backtracks} bt`);
}

// ═══════════════════════════════════════════
// Test 10: 多星 — 10×10 二星性能
// ═══════════════════════════════════════════
console.log('\n── 10. 10×10 二星性能 ──');
{
  const N = 10;
  const quota = 2;
  const regions = Array.from({ length: N * N }, (_, i) => i % N);
  const start = performance.now();
  const result = solveStarLine(N, regions, { starsPerRow: quota, starsPerCol: quota, starsPerRegion: quota, noAdjacent: true });
  const elapsed = performance.now() - start;
  test('10×10 二星在 30 秒内完成', () => assert(elapsed < 30000, `耗时 ${elapsed.toFixed(0)}ms`));
  test('10×10 二星性能解满足全部约束（含邻接）', () => {
    for (const sol of result.solutions) {
      const err = validateSolution(sol, N, regions, quota);
      assert(err === null, `solution: ${err}`);
    }
  });
  console.log(`  status: ${result.status}, ${result.solutions.length} sol, ${elapsed.toFixed(0)}ms, ${result.stats.backtracks} bt`);
}

// ═══════════════════════════════════════════
// Test 11: 多星 — 12×12 二星性能
// ═══════════════════════════════════════════
console.log('\n── 11. 12×12 二星性能 ──');
{
  const N = 12;
  const quota = 2;
  const regions = Array.from({ length: N * N }, (_, i) => i % N);
  const start = performance.now();
  const result = solveStarLine(N, regions, { starsPerRow: quota, starsPerCol: quota, starsPerRegion: quota, noAdjacent: true });
  const elapsed = performance.now() - start;
  test('12×12 二星在 60 秒内完成', () => assert(elapsed < 60000, `耗时 ${elapsed.toFixed(0)}ms`));
  test('12×12 二星返回 UNIQUE 或 MULTIPLE', () => assert(['UNIQUE', 'MULTIPLE'].includes(result.status), `status: ${result.status}`));
  test('12×12 二星解满足全部约束（含邻接）', () => {
    for (const sol of result.solutions) {
      const err = validateSolution(sol, N, regions, quota);
      assert(err === null, `solution: ${err}`);
    }
  });
  console.log(`  status: ${result.status}, ${result.solutions.length} sol, ${elapsed.toFixed(0)}ms, ${result.stats.backtracks} bt`);
}

// ═══════════════════════════════════════════
const suiteElapsed = performance.now() - suiteStart;
console.log(`\n═══════════════════════════════════`);
console.log(`  ${passed} passed, ${failed} failed`);
console.log(`  total: ${suiteElapsed.toFixed(0)}ms`);
console.log(`═══════════════════════════════════`);

process.exit(failed > 0 ? 1 : 0);
