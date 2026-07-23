import { STAR_LINE_LEVELS } from '../src/data/starLineLevels.js';
import {
  getEightNeighbors,
  resolveStarLineDoubleTutorialCells,
  STAR_LINE_DOUBLE_TUTORIAL_CONTRACT,
} from '../src/game/starLine/starLineDoubleTutorialContract.js';
import { resolveStarLineDoubleGuideStep } from '../src/hooks/useStarLineDoubleGuide.js';
import {
  analyzeStarDoubleHumanLogic,
  CELL_STATE,
  collectHumanLogicEvents,
  DEDUCTION_TECHNIQUE,
  HUMAN_LOGIC_STATUS,
} from './star-double-human-logic.mjs';
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

function toGrid(state) {
  return state.map(value => ({
    isStarred: value === CELL_STATE.STAR,
    isMarkedX: value === CELL_STATE.X,
  }));
}

const level = STAR_LINE_LEVELS.find(item => item.id === CONTRACT.levelId);
if (!level) {
  console.error(`  ✗ 找不到正式双星首关 ${CONTRACT.levelId}`);
  process.exit(1);
}

const puzzle = {
  N: level.N,
  quota: 2,
  regions: level.regions,
  solution: level.solution,
};

console.log('\n═══ Star Double 第一关完整教学契约 ═══');

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

test('教学包含 7 个逻辑阶段和 22 个确定步骤', () => {
  assert(CONTRACT.phaseCount === 7);
  assert(CONTRACT.steps.length === 22, `steps=${CONTRACT.steps.length}`);
  assert(new Set(CONTRACT.steps.map(step => step.phase)).size === CONTRACT.phaseCount);
});

test('容量星域严格匹配教学形状', () => {
  const regionId = level.regions[CONTRACT.forcedStar];
  const cells = level.regions
    .map((value, idx) => (value === regionId ? idx : -1))
    .filter(idx => idx >= 0);
  deepEqual(cells, CONTRACT.capacityRegion, 'capacity region mismatch');
});

test('容量块是一个 2×2，强制星是星域中唯一外部格', () => {
  const rows = new Set(CONTRACT.capacityBlock.map(idx => Math.floor(idx / level.N)));
  const cols = new Set(CONTRACT.capacityBlock.map(idx => idx % level.N));
  assert(rows.size === 2 && cols.size === 2, 'capacity block is not 2×2');
  deepEqual(
    CONTRACT.capacityRegion.filter(idx => !CONTRACT.capacityBlock.includes(idx)),
    [CONTRACT.forcedStar],
  );
  assert(level.solution.includes(CONTRACT.forcedStar), 'forced star missing from solution');
});

test('八邻格动态计算完整，并在边缘自动裁剪', () => {
  deepEqual(getEightNeighbors(CONTRACT.forcedStar, level.N), [4, 5, 6, 12, 14, 20, 21, 22]);
  deepEqual(getEightNeighbors(0, level.N), [1, 8, 9]);
  deepEqual(getEightNeighbors(7, level.N), [6, 14, 15]);
  deepEqual(getEightNeighbors(63, level.N), [54, 55, 62]);
  assert(getEightNeighbors(-1, level.N).length === 0);
});

test('八邻演示、允许操作格与实际 X 使用同一动态来源', () => {
  const step = CONTRACT.steps.find(item => item.id === 'adjacency-action');
  const targets = resolveStarLineDoubleTutorialCells(step, 'targets');
  const actions = resolveStarLineDoubleTutorialCells(step, 'actions');
  deepEqual(targets, actions);
  assert(actions.length === 8, `neighbors=${actions.length}`);
  assert(actions.every(idx => !level.solution.includes(idx)), '排除目标误删解中星点');
});

test('正式首关保持唯一解，solution 未被修改', () => {
  const result = solveStarLine(level.N, level.regions, {
    starsPerRow: 2,
    starsPerCol: 2,
    starsPerRegion: 2,
  });
  assert(result.status === 'UNIQUE', `solver status=${result.status}`);
  deepEqual(result.solutions[0], level.solution, 'solver solution mismatch');
});

test('现有人类逻辑规则可从空盘完整解出正式首关', () => {
  const analysis = analyzeStarDoubleHumanLogic(puzzle);
  assert(analysis.status === HUMAN_LOGIC_STATUS.SOLVED_SUPPORTED_RULES, `status=${analysis.status}`);
});

test('每个教学操作批次在当时盘面都有 deduction event 证明', () => {
  const state = new Array(level.N * level.N).fill(CELL_STATE.UNKNOWN);
  const usedTechniques = new Set();

  for (let index = 0; index < CONTRACT.steps.length; index += 1) {
    const step = CONTRACT.steps[index];
    if (step.type === 'explain') {
      assert(resolveStarLineDoubleGuideStep(index + 1, toGrid(state)) === index + 1,
        `${step.id} 说明步骤被自动推进`);
      continue;
    }

    const actionCells = resolveStarLineDoubleTutorialCells(step, 'actions');
    const expectedAction = step.type === 'place-stars' ? 'place-star' : 'eliminate';
    const collected = collectHumanLogicEvents(puzzle, state);
    assert(collected.status !== HUMAN_LOGIC_STATUS.CONTRADICTION, `${step.id} state contradiction`);

    for (const cell of actionCells) {
      const witnesses = collected.events.filter(event => (
        event.action === expectedAction && event.affectedCells.includes(cell)
      ));
      assert(witnesses.length > 0, `${step.id}: cell ${cell} has no ${expectedAction} proof`);
      witnesses.forEach(event => usedTechniques.add(event.technique));
      assert(state[cell] === CELL_STATE.UNKNOWN, `${step.id}: cell ${cell} was already assigned`);
      state[cell] = expectedAction === 'place-star' ? CELL_STATE.STAR : CELL_STATE.X;
    }

    const grid = toGrid(state);
    assert(resolveStarLineDoubleGuideStep(index + 1, grid) === index + 2,
      `${step.id} 完成后没有推进`);
  }

  deepEqual(
    state.map((value, idx) => (value === CELL_STATE.STAR ? idx : -1)).filter(idx => idx >= 0),
    [...level.solution].sort((a, b) => a - b),
    'tutorial stars do not equal solution',
  );
  assert(state.every(value => value !== CELL_STATE.UNKNOWN), 'tutorial leaves unknown cells');

  for (const technique of [
    DEDUCTION_TECHNIQUE.QUOTA_SATURATED,
    DEDUCTION_TECHNIQUE.ADJACENCY_EXCLUSION,
    DEDUCTION_TECHNIQUE.REMAINING_CAPACITY,
    DEDUCTION_TECHNIQUE.CONFINED_CAPACITY,
    DEDUCTION_TECHNIQUE.TWO_BY_TWO_CAPACITY,
    DEDUCTION_TECHNIQUE.MULTI_UNIT_CONFINEMENT,
    DEDUCTION_TECHNIQUE.PRESSURED_GROUP_EXCLUSION,
  ]) {
    assert(usedTechniques.has(technique), `tutorial does not exercise ${technique}`);
  }
});

test('空盘不会跳过第一条说明，完成记录前置状态不伪造胜利', () => {
  const grid = emptyGrid(level.N);
  assert(resolveStarLineDoubleGuideStep(1, grid) === 1);
  assert(grid.every(cell => !cell.isStarred && !cell.isMarkedX));
});

console.log(`\n结果: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
