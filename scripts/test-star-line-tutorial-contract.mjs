/**
 * Star Line 第一关教学契约测试 — 验证 star-lv-01 与新手教学的强绑定关系。
 *
 * 如果 star-lv-01 关卡数据发生任何变化，本测试将直接失败，
 * 并提示必须同步更新教学配置并重新进行人工验收。
 * 不允许自动更新哈希或增加宽泛豁免。
 */

import { STAR_LINE_LEVELS } from '../src/data/starLineLevels.js';
import { STAR_LINE_TUTORIAL_CONTRACT } from '../src/game/starLine/starLineTutorialContract.js';
import { resolveStarLineOperationStep, resolveStarLineRuleStep } from '../src/hooks/useStarLineGuide.js';
import { createHash } from 'crypto';

const CONTRACT = STAR_LINE_TUTORIAL_CONTRACT;

let passed = 0;
let failed = 0;

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
  if (!cond) throw new Error(msg || 'assertion failed');
}

function deepEqual(a, b, msg) {
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(`${msg || 'arrays differ'}\n  expected: ${sb}\n  actual: ${sa}`);
}

// ─── 1. 定位第一关 ───
const lv01 = STAR_LINE_LEVELS.find(l => l.id === CONTRACT.levelId);
if (!lv01) {
  console.log(`  ✗ 找不到关卡 ${CONTRACT.levelId}`);
  failed = 1;
  process.exit(1);
}

// ─── 2. 第一关身份 ───
test('第一关 ID 为 star-lv-01', () => {
  assert(lv01.id === 'star-lv-01');
});

test('第一关棋盘尺寸为 5×5', () => {
  assert(lv01.N === CONTRACT.boardSize, `N=${lv01.N}, expected ${CONTRACT.boardSize}`);
});

test('第一关 quota 为 1', () => {
  const q = lv01.starsPerRow ?? lv01.starsPerCol ?? lv01.starsPerRegion;
  assert(q === CONTRACT.quota, `quota=${q}, expected ${CONTRACT.quota}`);
});

test('第一关 gameId 为 starSingle', () => {
  assert(lv01.gameId === 'starSingle');
});

// ─── 3. 正确答案严格匹配 ───
test('solution 严格等于 [1, 8, 10, 17, 24]', () => {
  deepEqual(lv01.solution, CONTRACT.starOrder, 'solution mismatch');
});

// ─── 4. 绿色星域严格匹配 ───
const greenRegionId = lv01.regions[CONTRACT.rules.secondStar];
const greenRegionFromLevel = lv01.regions
  .map((r, idx) => (r === greenRegionId ? idx : -1))
  .filter(idx => idx !== -1);

test('绿色星域严格等于 [2, 3, 4, 7, 8, 9, 12, 13, 14]', () => {
  deepEqual(greenRegionFromLevel, CONTRACT.greenRegion, 'green region mismatch');
});

test('索引 8 属于绿色星域', () => {
  assert(greenRegionFromLevel.includes(CONTRACT.rules.secondStar),
    `index ${CONTRACT.rules.secondStar} not in green region ${JSON.stringify(greenRegionFromLevel)}`);
});

// ─── 5. 教学操作目标 ───
test('单击 X 目标: 索引 0', () => {
  assert(CONTRACT.operation.tapX === 0);
});

test('添加拖动路径: [2, 3, 4]', () => {
  deepEqual(CONTRACT.operation.addDragPath, [2, 3, 4]);
});

test('清除拖动路径: [4, 3, 2]', () => {
  deepEqual(CONTRACT.operation.clearDragPath, [4, 3, 2]);
});

test('放星顺序: [1, 8, 10, 17, 24]', () => {
  deepEqual(CONTRACT.starOrder, [1, 8, 10, 17, 24]);
});

// ─── 6. 教学排除目标 ───
test('第一行补 X: [0, 2, 3, 4]', () => {
  deepEqual(CONTRACT.rules.firstRowDoneX, [0, 2, 3, 4]);
});

test('索引 1 所在列补 X: [6, 11, 16, 21]', () => {
  deepEqual(CONTRACT.rules.starColumnDoneX, [6, 11, 16, 21]);
});

test('绿色星域后续补 X: [2, 3, 4, 7, 9, 12, 13, 14]', () => {
  deepEqual(CONTRACT.rules.greenRegionDoneX, [2, 3, 4, 7, 9, 12, 13, 14]);
});

test('索引 8 的八邻格: [2, 3, 4, 7, 9, 12, 13, 14]', () => {
  // 从棋盘几何验证八邻格
  const N = 5;
  const idx = 8;
  const r = Math.floor(idx / N);
  const c = idx % N;
  const computed = [];
  for (let i = 0; i < N * N; i++) {
    const ri = Math.floor(i / N);
    const ci = i % N;
    if (i !== idx && Math.abs(ri - r) <= 1 && Math.abs(ci - c) <= 1) {
      computed.push(i);
    }
  }
  deepEqual(computed, CONTRACT.rules.adjacencyNeighbors, 'adjacency neighbors mismatch');
});

test('后续列排除: [5, 15, 20]', () => {
  deepEqual(CONTRACT.rules.thirdColumnDoneX, [5, 15, 20]);
});

test('后段排除: [18, 19, 22, 23]', () => {
  deepEqual(CONTRACT.rules.tailDoneX, [18, 19, 22, 23]);
});

// ─── 7. 内部一致性 ───
test('所有 X 集 + 星星集 = 完整 25 格棋盘，互不重叠', () => {
  const xSets = [
    [CONTRACT.operation.tapX],
    CONTRACT.operation.addDragPath,
    CONTRACT.rules.firstRowDoneX,
    CONTRACT.rules.starColumnDoneX,
    CONTRACT.rules.greenRegionDoneX,
    CONTRACT.rules.adjacencyNeighbors,
    CONTRACT.rules.thirdColumnDoneX,
    CONTRACT.rules.tailDoneX,
  ].flat();
  const xSet = new Set(xSets);
  const starSet = new Set(CONTRACT.starOrder);
  // X 和星不重叠
  for (const s of starSet) assert(!xSet.has(s), `index ${s} is both X and star`);
  // X ∪ 星 = all 25
  const all = new Set([...xSet, ...starSet]);
  assert(all.size === 25, `union size ${all.size}, expected 25`);
});

// ─── 8. 规范化 SHA-256 ───
test('内容哈希匹配固定期望值', () => {
  // 使用排序稳定的规范化数据，不对源码原始文本做哈希
  const payload = {
    id: lv01.id,
    N: lv01.N,
    quota: lv01.starsPerRow ?? lv01.starsPerCol ?? lv01.starsPerRegion,
    regions: lv01.regions.slice(),
    solution: lv01.solution.slice(),
  };
  const normalized = JSON.stringify(payload, Object.keys(payload).sort());
  const hash = createHash('sha256').update(normalized).digest('hex');

  // 当前正确哈希（如果关卡数据变化，测试直接失败，不允许自动更新）
  const EXPECTED_HASH = '82a7266b7a11fa2243d08e251cbfcf1f489a765e54226bf67cf5889a58cec1da';
  assert(hash === EXPECTED_HASH,
    `内容哈希不匹配!\n  actual: ${hash}\n  expected: ${EXPECTED_HASH}\n  star-lv-01 与新手教学强绑定，修改后必须同步更新教学配置并重新进行人工验收。`);
});

// ─── 9. 行为验证：resolveStarLineOperationStep ───
function makeCell(isStarred, isMarkedX) {
  return { isStarred: Boolean(isStarred), isMarkedX: Boolean(isMarkedX) };
}
function emptyGrid() {
  return Array.from({ length: 25 }, () => makeCell(false, false));
}

test('操作步骤推进: 空棋盘 → 单击 X → 拖动 X → 双击放星', () => {
  const grid = emptyGrid();
  assert(resolveStarLineOperationStep(1, grid) === 1, 'step 1: should be 1 on empty');

  grid[CONTRACT.operation.tapX] = makeCell(false, true);
  assert(resolveStarLineOperationStep(1, grid) === 2, 'step 2: after tap X');

  CONTRACT.operation.addDragPath.forEach(i => { grid[i] = makeCell(false, true); });
  assert(resolveStarLineOperationStep(2, grid) === 3, 'step 3: after add drag');

  grid[CONTRACT.operation.firstStar] = makeCell(true, false);
  // storedStep >= 4 时检查 star；实际游戏中到第 4 步才检查放星
  assert(resolveStarLineOperationStep(4, grid) === 5, 'step 5: after double-tap star');
});

test('操作步骤: 第 3 步清除拖动后回退到第 2 步', () => {
  const grid = emptyGrid();
  grid[CONTRACT.operation.tapX] = makeCell(false, true);
  grid[CONTRACT.operation.addDragPath[0]] = makeCell(false, true);
  assert(resolveStarLineOperationStep(2, grid) === 2, 'should be step 2 when drag incomplete');
});

// ─── 10. 行为验证：resolveStarLineRuleStep ───
test('规则步骤推进: 行 → 列 → 星域 → 相邻 → 完成', () => {
  const grid = emptyGrid();
  // 操作教学结束后状态: X 在 0（单击），X 在 2/3/4 被清除，star 在 1
  grid[CONTRACT.operation.firstStar] = makeCell(true, false);
  grid[CONTRACT.operation.tapX] = makeCell(false, true);
  // 2、3、4 是空白的（操作 step 3 清除拖动已将它们清掉）

  assert(resolveStarLineRuleStep(0, grid) === 1, 'rule step 1: row X not complete');

  CONTRACT.rules.firstRowDoneX.forEach(i => { grid[i] = makeCell(false, true); });
  assert(resolveStarLineRuleStep(1, grid) === 2, 'rule step 2: column X not complete');

  CONTRACT.rules.starColumnDoneX.forEach(i => { grid[i] = makeCell(false, true); });
  assert(resolveStarLineRuleStep(2, grid) === 3, 'rule step 3: star 8 not placed');

  grid[CONTRACT.rules.secondStar] = makeCell(true, false);
  assert(resolveStarLineRuleStep(3, grid) === 4, 'rule step 4: green region X not complete');

  CONTRACT.rules.greenRegionDoneX.forEach(i => { grid[i] = makeCell(false, true); });
  assert(resolveStarLineRuleStep(4, grid) === 5, 'rule step 5: adjacency showcase');

  assert(resolveStarLineRuleStep(5, grid) === 5, 'rule step 5: stays at 5 while stored <= 5');
  assert(resolveStarLineRuleStep(6, grid) === 6, 'rule step 6: star 10 not placed');

  grid[CONTRACT.rules.thirdStar] = makeCell(true, false);
  assert(resolveStarLineRuleStep(6, grid) === 7, 'rule step 7: third column X not complete');

  CONTRACT.rules.thirdColumnDoneX.forEach(i => { grid[i] = makeCell(false, true); });
  assert(resolveStarLineRuleStep(7, grid) === 8, 'rule step 8: star 17 not placed');

  grid[CONTRACT.rules.fourthStar] = makeCell(true, false);
  assert(resolveStarLineRuleStep(8, grid) === 9, 'rule step 9: tail X not complete');

  CONTRACT.rules.tailDoneX.forEach(i => { grid[i] = makeCell(false, true); });
  assert(resolveStarLineRuleStep(9, grid) === 10, 'rule step 10: final star not placed');

  grid[CONTRACT.rules.finalStar] = makeCell(true, false);
  assert(resolveStarLineRuleStep(10, grid) === 11, 'rule step 11: complete');
});

test('教学星缺失时回退到放星步骤 (step 0)', () => {
  const grid = emptyGrid();
  assert(resolveStarLineRuleStep(0, grid) === 0, 'should return 0 when star 1 missing');
});

// ─── 结果 ───
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
