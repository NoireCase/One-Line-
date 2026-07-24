import { STAR_LINE_LEVELS } from '../src/data/starLineLevels.js';
import { findStarLineDoubleBasicHint } from '../src/game/starLine/starLineDoubleBasicHints.js';
import {
  getEightNeighbors,
  resolveStarLineDoubleTutorialCells,
  STAR_LINE_DOUBLE_TUTORIAL_CONTRACT,
} from '../src/game/starLine/starLineDoubleTutorialContract.js';
import { resolveStarLineDoubleGuideStep } from '../src/hooks/useStarLineDoubleGuide.js';
import {
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

function stateToGrid(state) {
  return state.map(value => ({
    isStarred: value === CELL_STATE.STAR,
    isMarkedX: value === CELL_STATE.X,
  }));
}

function isBasicHumanLogicEvent(event) {
  const techniques = new Set(event.supportingTechniques || [event.technique]);
  return techniques.has(DEDUCTION_TECHNIQUE.QUOTA_SATURATED)
    || techniques.has(DEDUCTION_TECHNIQUE.ADJACENCY_EXCLUSION)
    || techniques.has(DEDUCTION_TECHNIQUE.REMAINING_CAPACITY)
    || event.proofs?.some(proof => proof.type === 'two-by-two-capacity');
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

console.log('\n═══ Star Double 第一关基础教学契约 ═══');

test('教学只绑定正式双星第一关，尺寸和 quota 保持不变', () => {
  assert(level.id === 'star-double-tutorial-01');
  assert(level.gameId === 'starDouble');
  assert(level.N === CONTRACT.boardSize);
  assert(level.starsPerRow === CONTRACT.quota);
  assert(level.starsPerCol === CONTRACT.quota);
  assert(level.starsPerRegion === CONTRACT.quota);
});

test('正式首关保持唯一解', () => {
  const result = solveStarLine(level.N, level.regions, {
    starsPerRow: 2,
    starsPerCol: 2,
    starsPerRegion: 2,
  });
  assert(result.status === 'UNIQUE', `solver status=${result.status}`);
  deepEqual(result.solutions[0], level.solution, 'solver solution mismatch');
});

test('当前首关只用基础规则传播即可从空盘完整解出', () => {
  const state = new Array(level.N * level.N).fill(CELL_STATE.UNKNOWN);
  let waves = 0;
  while (waves < 100) {
    const result = collectHumanLogicEvents(puzzle, state);
    assert(result.status !== HUMAN_LOGIC_STATUS.CONTRADICTION, `contradiction at wave ${waves}`);
    const events = result.events.filter(isBasicHumanLogicEvent);
    let changed = 0;
    for (const event of events) {
      for (const cell of event.affectedCells) {
        if (state[cell] !== CELL_STATE.UNKNOWN) continue;
        state[cell] = event.action === 'place-star' ? CELL_STATE.STAR : CELL_STATE.X;
        changed += 1;
      }
    }
    if (changed === 0) break;
    waves += 1;
  }
  assert(state.every(value => value !== CELL_STATE.UNKNOWN), 'basic rules stalled before full solve');
  deepEqual(
    state.map((value, idx) => (value === CELL_STATE.STAR ? idx : -1)).filter(idx => idx >= 0),
    [...level.solution].sort((a, b) => a - b),
    'basic-rule stars do not match solution',
  );
});

test('第一步只介绍完整双星规则，等待点击且不进入推理', () => {
  const step = CONTRACT.steps[0];
  assert(step.copy === '每行、每列、每个星域都要放 2 颗星；星星仍然不能上下、左右或斜向相邻。');
  assert(resolveStarLineDoubleTutorialCells(step, 'observation').length === 0);
  assert(resolveStarLineDoubleTutorialCells(step, 'actions').length === 0);
  assert(step.type === 'explain');
});

test('第二步只解释 2×2 容量并只高亮右侧 2×2', () => {
  const step = CONTRACT.steps[1];
  assert(step.copy === '因为星星不能八向相邻，所以任意 2×2 内最多只能放 1 颗星。');
  deepEqual(resolveStarLineDoubleTutorialCells(step, 'observation'), CONTRACT.capacityBlock);
  assert(!resolveStarLineDoubleTutorialCells(step, 'observation').includes(CONTRACT.forcedStar));
  assert(resolveStarLineDoubleTutorialCells(step, 'actions').length === 0);
  assert(step.type === 'explain');
});

test('第一颗星由 5 格星域和 2×2 容量证明，提问不公开目标', () => {
  const regionId = level.regions[CONTRACT.forcedStar];
  const regionCells = level.regions
    .map((value, idx) => (value === regionId ? idx : -1))
    .filter(idx => idx >= 0);
  deepEqual(regionCells, CONTRACT.capacityRegion);
  deepEqual(
    CONTRACT.capacityRegion.filter(cell => !CONTRACT.capacityBlock.includes(cell)),
    [CONTRACT.forcedStar],
  );
  const step = CONTRACT.steps[2];
  assert(step.copy === '这个星域需要 2 颗星，右侧 2×2 最多放 1 颗，另一颗应该在哪里？');
  assert(step.revealAction === false);
  deepEqual(resolveStarLineDoubleTutorialCells(step, 'actions'), [CONTRACT.forcedStar]);
  deepEqual(step.delayedHint.evidenceCells, CONTRACT.capacityBlock);
  assert(!step.delayedHint.evidenceCells.includes(CONTRACT.forcedStar));
  assert(level.solution.includes(CONTRACT.forcedStar));
});

test('八邻格动态计算完整，演示、高亮和操作使用同一来源', () => {
  const expected = [4, 5, 6, 12, 14, 20, 21, 22];
  deepEqual(getEightNeighbors(CONTRACT.forcedStar, level.N), expected);
  deepEqual(getEightNeighbors(0, level.N), [1, 8, 9]);
  deepEqual(getEightNeighbors(63, level.N), [54, 55, 62]);
  const step = CONTRACT.steps[3];
  deepEqual(resolveStarLineDoubleTutorialCells(step, 'actions'), expected);
  deepEqual(resolveStarLineDoubleTutorialCells(step, 'pointers'), expected);
  assert(step.revealAction === true);
});

test('独立练习只给观察范围，目标 X 有真实 2×2 证明', () => {
  const state = new Array(level.N * level.N).fill(CELL_STATE.UNKNOWN);
  state[CONTRACT.forcedStar] = CELL_STATE.STAR;
  getEightNeighbors(CONTRACT.forcedStar, level.N).forEach(cell => {
    state[cell] = CELL_STATE.X;
  });
  const result = collectHumanLogicEvents(puzzle, state);
  const practiceProof = result.events.find(event => (
    event.action === 'eliminate'
    && event.affectedCells.includes(CONTRACT.practiceCell)
    && event.proofs?.some(proof => proof.type === 'two-by-two-capacity')
  ));
  assert(practiceProof, 'practice cell has no basic 2×2 proof');
  const step = CONTRACT.steps[4];
  assert(step.revealAction === false);
  deepEqual(resolveStarLineDoubleTutorialCells(step, 'observation'), CONTRACT.practiceObservation);
  deepEqual(resolveStarLineDoubleTutorialCells(step, 'actions'), [CONTRACT.practiceCell]);
  deepEqual(step.delayedHint.evidenceCells, CONTRACT.practiceObservation);
  assert(step.delayedHint.copy === '每组最多容纳 1 颗星，因此有一格会同时受到挤压。');
});

test('自主阶段的运行时提示只用基础规则，并能带到完整解', () => {
  const grid = emptyGrid(level.N);
  grid[CONTRACT.forcedStar].isStarred = true;
  getEightNeighbors(CONTRACT.forcedStar, level.N).forEach(cell => {
    grid[cell].isMarkedX = true;
  });
  grid[CONTRACT.practiceCell].isMarkedX = true;

  const seenRules = new Set();
  const seenCopies = [];
  for (let step = 0; step < 100; step += 1) {
    const hint = findStarLineDoubleBasicHint(level, grid);
    if (!hint) break;
    seenRules.add(hint.rule);
    seenCopies.push(hint.tier1Copy, hint.tier2Copy, hint.tier3Copy);
    for (const cell of hint.targetCells) {
      grid[cell] = {
        ...grid[cell],
        isStarred: hint.action === 'place-stars',
        isMarkedX: hint.action === 'eliminate',
      };
    }
  }

  deepEqual(
    grid.map((cell, idx) => (cell.isStarred ? idx : -1)).filter(idx => idx >= 0),
    [...level.solution].sort((a, b) => a - b),
    'tiered hints did not reach solution',
  );
  assert(seenRules.size >= 3, `hint rules=${[...seenRules].join(',')}`);
  assert([...seenRules].every(rule => (
    ['two-by-two', 'adjacency', 'quota-saturated', 'remaining-capacity'].includes(rule)
  )), 'advanced hint rule exposed');
  const banned = ['候选组', '总配额相等', '连续传播', 'multi-unit', 'pressured-group'];
  assert(banned.every(term => seenCopies.every(copy => !copy.includes(term))), 'solver wording leaked');
});

test('无 UNKNOWN 且未胜利时进入纠错模式并指出应撤销的标记', () => {
  const grid = Array.from({ length: level.N * level.N }, () => ({
    isStarred: false,
    isMarkedX: true,
  }));
  grid[CONTRACT.forcedStar] = { isStarred: true, isMarkedX: false };

  const correction = findStarLineDoubleBasicHint(level, grid);
  assert(correction?.mode === 'correction', `mode=${correction?.mode}`);
  assert(correction.action === 'clear');
  deepEqual(correction.targetCells, [1]);
  assert(correction.observationCells.includes(1));
  assert(correction.observationCells.length > level.N, 'related row/col/region not included');
  assert(correction.tier1Copy.includes('标记错误'));
  assert(correction.tier2Copy.includes('行、列和星域'));
  assert(correction.tier3Copy.includes('撤销'));

  grid[1] = { isStarred: false, isMarkedX: false };
  const nextCorrection = findStarLineDoubleBasicHint(level, grid);
  assert(nextCorrection?.mode === 'correction', 'correction stopped while invalid marks remain');
  deepEqual(nextCorrection.targetCells, [3]);
});

test('说明不自动跳过，操作完成后才推进到自主阶段', () => {
  const grid = emptyGrid(level.N);
  assert(resolveStarLineDoubleGuideStep(1, grid) === 1);
  assert(resolveStarLineDoubleGuideStep(2, grid) === 2);
  assert(resolveStarLineDoubleGuideStep(3, grid) === 3);
  grid[CONTRACT.forcedStar].isStarred = true;
  assert(resolveStarLineDoubleGuideStep(3, grid) === 4);
  getEightNeighbors(CONTRACT.forcedStar, level.N).forEach(cell => {
    grid[cell].isMarkedX = true;
  });
  assert(resolveStarLineDoubleGuideStep(4, grid) === 5);
  grid[CONTRACT.practiceCell].isMarkedX = true;
  assert(resolveStarLineDoubleGuideStep(5, grid) === 6);
  assert(resolveStarLineDoubleGuideStep(6, grid) === 6);
});

test('契约中不存在自动批量操作步骤或高级术语', () => {
  assert(CONTRACT.steps.every(step => step.type !== 'demo-eliminate'));
  const copy = CONTRACT.steps.map(step => step.copy).join(' ');
  for (const term of ['候选组', '总配额相等', '连续传播', 'multi-unit', 'pressured-group']) {
    assert(!copy.includes(term), `copy contains ${term}`);
  }
});

console.log(`\n结果: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
