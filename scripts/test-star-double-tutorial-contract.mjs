import { STAR_LINE_LEVELS } from '../src/data/starLineLevels.js';
import { STAR_LINE_DOUBLE_TUTORIAL_CONTRACT } from '../src/game/starLine/starLineDoubleTutorialContract.js';
import { resolveStarLineDoubleGuideStep } from '../src/hooks/useStarLineDoubleGuide.js';
import { analyzeStarDoubleHumanLogic, HUMAN_LOGIC_STATUS } from './star-double-human-logic.mjs';
import { solveStarLine } from './starLineSolver.mjs';

const CONTRACT = STAR_LINE_DOUBLE_TUTORIAL_CONTRACT;
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed += 1;
  } catch (error) {
    console.log(`  ✗ ${name}: ${error.message}`);
    failed += 1;
  }
}

function assert(condition, message = 'assertion failed') {
  if (!condition) throw new Error(message);
}

function deepEqual(actual, expected, message = 'values differ') {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\n  expected: ${JSON.stringify(expected)}\n  actual: ${JSON.stringify(actual)}`);
  }
}

function emptyGrid(N) {
  return Array.from({ length: N * N }, () => ({ isStarred: false, isMarkedX: false }));
}

const level = STAR_LINE_LEVELS.find(item => item.id === CONTRACT.levelId);
if (!level) {
  console.error(`  ✗ 找不到正式双星首关 ${CONTRACT.levelId}`);
  process.exit(1);
}

console.log('\n═══ Star Double 第一关教学契约 ═══');

test('教学只绑定正式双星第一关', () => {
  assert(level.id === 'star-lv-21');
  assert(level.gameId === 'starDouble');
  assert(!level.id.startsWith('star-review-'));
});

test('棋盘尺寸和 quota 与契约一致', () => {
  assert(level.N === CONTRACT.boardSize, `N=${level.N}`);
  assert(level.starsPerRow === CONTRACT.quota, `row quota=${level.starsPerRow}`);
  assert(level.starsPerCol === CONTRACT.quota, `col quota=${level.starsPerCol}`);
  assert(level.starsPerRegion === CONTRACT.quota, `region quota=${level.starsPerRegion}`);
});

test('容量星域严格匹配 5 格教学形状', () => {
  const regionId = level.regions[CONTRACT.forcedStar];
  const cells = level.regions
    .map((value, idx) => (value === regionId ? idx : -1))
    .filter(idx => idx >= 0);
  deepEqual(cells, CONTRACT.capacityRegion, 'capacity region mismatch');
});

test('容量块是一个 2×2，八向禁邻使其最多容纳 1 星', () => {
  deepEqual(CONTRACT.capacityBlock, [6, 7, 14, 15]);
  const rows = new Set(CONTRACT.capacityBlock.map(idx => Math.floor(idx / level.N)));
  const cols = new Set(CONTRACT.capacityBlock.map(idx => idx % level.N));
  assert(rows.size === 2 && cols.size === 2, 'capacity block is not 2×2');
  for (let i = 0; i < CONTRACT.capacityBlock.length; i += 1) {
    for (let j = i + 1; j < CONTRACT.capacityBlock.length; j += 1) {
      const a = CONTRACT.capacityBlock[i];
      const b = CONTRACT.capacityBlock[j];
      const rowDistance = Math.abs(Math.floor(a / level.N) - Math.floor(b / level.N));
      const colDistance = Math.abs((a % level.N) - (b % level.N));
      assert(Math.max(rowDistance, colDistance) <= 1, `${a} 与 ${b} 不相邻`);
    }
  }
});

test('强制星是容量星域中唯一不在 2×2 的格子', () => {
  deepEqual(
    CONTRACT.capacityRegion.filter(idx => !CONTRACT.capacityBlock.includes(idx)),
    [CONTRACT.forcedStar],
  );
  assert(level.solution.includes(CONTRACT.forcedStar), 'forced star missing from solution');
});

test('教学排除目标严格等于强制星八邻格', () => {
  const row = Math.floor(CONTRACT.forcedStar / level.N);
  const col = CONTRACT.forcedStar % level.N;
  const neighbors = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const nextRow = row + dr;
      const nextCol = col + dc;
      if (nextRow >= 0 && nextRow < level.N && nextCol >= 0 && nextCol < level.N) {
        neighbors.push(nextRow * level.N + nextCol);
      }
    }
  }
  deepEqual(neighbors.sort((a, b) => a - b), [...CONTRACT.adjacencyNeighbors].sort((a, b) => a - b));
  assert(CONTRACT.adjacencyNeighbors.every(idx => !level.solution.includes(idx)), '排除目标误删解中星点');
});

test('正式首关保持唯一解，且 solution 未被教学目标破坏', () => {
  const result = solveStarLine(level.N, level.regions, {
    starsPerRow: 2,
    starsPerCol: 2,
    starsPerRegion: 2,
  });
  assert(result.status === 'UNIQUE', `solver status=${result.status}`);
  deepEqual(result.solutions[0], level.solution, 'solver solution mismatch');
});

test('现有人类逻辑规则可从空盘完整解出正式首关', () => {
  const analysis = analyzeStarDoubleHumanLogic({
    N: level.N,
    quota: 2,
    regions: level.regions,
    solution: level.solution,
  });
  assert(analysis.status === HUMAN_LOGIC_STATUS.SOLVED_SUPPORTED_RULES, `status=${analysis.status}`);
  assert(analysis.canonicalPath.some(event => (
    event.action === 'place-star' && event.affectedCells.includes(CONTRACT.forcedStar)
  )), 'human logic trace does not prove forced tutorial star');
});

test('教学步骤按真实棋盘状态恢复', () => {
  const grid = emptyGrid(level.N);
  assert(resolveStarLineDoubleGuideStep(1, grid) === 1);
  assert(resolveStarLineDoubleGuideStep(2, grid) === 2);
  for (const idx of CONTRACT.adjacencyNeighbors) grid[idx].isMarkedX = true;
  assert(resolveStarLineDoubleGuideStep(2, grid) === 3);
  grid[CONTRACT.forcedStar].isStarred = true;
  assert(resolveStarLineDoubleGuideStep(3, grid) === 4);
});

console.log(`\n结果: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
