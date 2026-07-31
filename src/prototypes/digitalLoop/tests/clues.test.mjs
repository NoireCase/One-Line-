// P4B 数字环线 Spike · 第二层最小数字线索与联合完成测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  edgesAroundCell,
  countLineAroundCell,
  clueStatus,
  evaluateClues,
  CLUE_STATUS,
} from '../loopy/clueEvaluation.js';
import { evaluateCompletion } from '../loopy/evaluateCompletion.js';
import { diagnoseStructure, STRUCTURES } from '../graph/diagnoseStructure.js';
import { DIAGNOSTIC_BOARDS } from '../data/diagnosticBoards.js';

function blockLoopKeys(r, c) {
  return [
    `h:${r}:${c}`, `h:${r}:${c + 1}`,
    `h:${r + 2}:${c}`, `h:${r + 2}:${c + 1}`,
    `v:${r}:${c}`, `v:${r + 1}:${c}`,
    `v:${r}:${c + 2}`, `v:${r + 1}:${c + 2}`,
  ];
}

function withClues(n, entries) {
  const clues = Array.from({ length: n }, () => Array(n).fill(null));
  for (const { row, col, clue } of entries) clues[row][col] = clue;
  return clues;
}

test('格周边四条边读取（cell 0,0）', () => {
  assert.deepEqual(edgesAroundCell(0, 0, 5), ['h:0:0', 'h:1:0', 'v:0:0', 'v:0:1']);
});

test('少于：周边 line < 数字', () => {
  assert.equal(countLineAroundCell(2, 2, 5, new Set(['h:2:2'])), 1);
  assert.equal(clueStatus(2, 1), CLUE_STATUS.unmet);
});

test('等于：周边 line == 数字', () => {
  assert.equal(clueStatus(2, 2), CLUE_STATUS.satisfied);
});

test('超限：周边 line > 数字', () => {
  assert.equal(clueStatus(1, 2), CLUE_STATUS.over);
});

test('数字 0：周边 0 条 line 即满足', () => {
  assert.equal(clueStatus(0, 0), CLUE_STATUS.satisfied);
  assert.equal(clueStatus(0, 1), CLUE_STATUS.over);
});

test('evaluateClues 汇总三类状态', () => {
  const n = 5;
  const clues = withClues(n, [
    { row: 1, col: 1, clue: 2 },
    { row: 1, col: 2, clue: 1 },
    { row: 2, col: 2, clue: 1 },
  ]);
  // 环 (1,1)-(2,2) 块：格 (1,1)(1,2)(2,1)(2,2) 周边各 2 条
  const loop = blockLoopKeys(1, 1);
  const lineSet = new Set(loop);
  const result = evaluateClues(clues, lineSet, n);
  const byCell = Object.fromEntries(result.cells.map((c) => [`${c.row},${c.col}`, c]));
  assert.equal(byCell['1,1'].status, CLUE_STATUS.satisfied, '格 (1,1) 周边 2 条 = 2 满足');
  assert.equal(byCell['1,2'].status, CLUE_STATUS.over, '格 (1,2) 周边 2 条 > 1 超限');
  assert.equal(byCell['2,2'].status, CLUE_STATUS.over, '格 (2,2) 周边 2 条 > 1 超限');
  assert.equal(result.satisfied, 1);
  assert.equal(result.unmet, 0);
  assert.equal(result.over, 2);
});

test('完成：单环 + 全部线索满足', () => {
  const n = 5;
  const loop = blockLoopKeys(1, 1);
  const clues = withClues(n, [
    { row: 1, col: 1, clue: 2 },
    { row: 1, col: 2, clue: 2 },
    { row: 2, col: 1, clue: 2 },
    { row: 2, col: 2, clue: 2 },
  ]);
  const structure = diagnoseStructure(loop, n);
  const clueResult = evaluateClues(clues, new Set(loop), n);
  assert.equal(structure.structure, STRUCTURES.closedSingleLoop);
  const completion = evaluateCompletion(structure.structure, clueResult);
  assert.equal(completion.complete, true);
});

test('完成：无数字 + Closed Single Loop 不得完成（禁止空真）', () => {
  const n = 5;
  const loop = blockLoopKeys(1, 1);
  const structure = diagnoseStructure(loop, n);
  const clueResult = evaluateClues(Array.from({ length: n }, () => Array(n).fill(null)), new Set(loop), n);
  const completion = evaluateCompletion(structure.structure, clueResult);
  assert.equal(completion.complete, false, '无数字单环不得完成');
  assert.equal(completion.hasClues, false);
  assert.equal(completion.allCluesSatisfied, false);
  assert.ok(completion.reasons.some((reason) => reason.includes('no numeric clues')));
});

test('完成：无数字 + Open Chain 不得完成', () => {
  const structure = diagnoseStructure(['h:2:1', 'h:2:2'], 5);
  const clueResult = evaluateClues(Array.from({ length: 5 }, () => Array(5).fill(null)), new Set(), 5);
  const completion = evaluateCompletion(structure.structure, clueResult);
  assert.equal(completion.complete, false);
});

test('完成：有数字 + 单环 + 全部满足', () => {
  const n = 5;
  const loop = blockLoopKeys(1, 1);
  const clues = withClues(n, [
    { row: 1, col: 1, clue: 2 },
    { row: 1, col: 2, clue: 2 },
    { row: 2, col: 1, clue: 2 },
    { row: 2, col: 2, clue: 2 },
  ]);
  const structure = diagnoseStructure(loop, n);
  const clueResult = evaluateClues(clues, new Set(loop), n);
  const completion = evaluateCompletion(structure.structure, clueResult);
  assert.equal(completion.hasClues, true);
  assert.equal(completion.allCluesSatisfied, true);
  assert.equal(completion.complete, true);
});

test('完成：有数字 + 单环 + 至少一条未满足不得完成', () => {
  const n = 5;
  const loop = blockLoopKeys(1, 1);
  const clues = withClues(n, [
    { row: 1, col: 1, clue: 2 },
    { row: 1, col: 2, clue: 2 },
    { row: 2, col: 1, clue: 2 },
    { row: 2, col: 2, clue: 3 }, // 超限
  ]);
  const structure = diagnoseStructure(loop, n);
  const clueResult = evaluateClues(clues, new Set(loop), n);
  const completion = evaluateCompletion(structure.structure, clueResult);
  assert.equal(completion.allCluesSatisfied, false);
  assert.equal(completion.complete, false);
});

test('完成：有数字 + 全部满足 + Multiple Loops 不得完成', () => {
  const n = 5;
  const loopA = blockLoopKeys(0, 0);
  const loopB = blockLoopKeys(3, 3);
  const clues = withClues(n, [
    { row: 0, col: 0, clue: 2 }, { row: 0, col: 1, clue: 2 },
    { row: 1, col: 0, clue: 2 }, { row: 1, col: 1, clue: 2 },
    { row: 3, col: 3, clue: 2 }, { row: 3, col: 4, clue: 2 },
    { row: 4, col: 3, clue: 2 }, { row: 4, col: 4, clue: 2 },
  ]);
  const structure = diagnoseStructure([...loopA, ...loopB], n);
  const clueResult = evaluateClues(clues, new Set([...loopA, ...loopB]), n);
  assert.equal(clueResult.over, 0);
  assert.equal(clueResult.unmet, 0);
  const completion = evaluateCompletion(structure.structure, clueResult);
  assert.equal(completion.allCluesSatisfied, true);
  assert.equal(completion.complete, false, '多环不得完成');
});

test('不得完成：单环但数字未满足', () => {
  const scene = DIAGNOSTIC_BOARDS.find((board) => board.id === 'single-loop-clue-unmet');
  const structure = diagnoseStructure(scene.lineKeys, scene.n);
  const clueResult = evaluateClues(scene.clues, new Set(scene.lineKeys), scene.n);
  assert.equal(structure.structure, STRUCTURES.closedSingleLoop);
  const completion = evaluateCompletion(structure.structure, clueResult);
  assert.equal(completion.complete, false);
  assert.ok(completion.reasons.some((reason) => reason.includes('not satisfied')));
});

test('不得完成：数字全满足但多环', () => {
  const scene = DIAGNOSTIC_BOARDS.find((board) => board.id === 'all-satisfied-two-loops');
  const structure = diagnoseStructure(scene.lineKeys, scene.n);
  const clueResult = evaluateClues(scene.clues, new Set(scene.lineKeys), scene.n);
  assert.equal(structure.structure, STRUCTURES.multipleLoops);
  assert.equal(clueResult.over, 0);
  assert.equal(clueResult.unmet, 0);
  const completion = evaluateCompletion(structure.structure, clueResult);
  assert.equal(completion.complete, false, '多环不得完成');
  assert.ok(completion.reasons.some((reason) => reason.includes('single closed loop')));
});

test('不得完成：数字超限冲突', () => {
  const scene = DIAGNOSTIC_BOARDS.find((board) => board.id === 'clue-over');
  const structure = diagnoseStructure(scene.lineKeys, scene.n);
  const clueResult = evaluateClues(scene.clues, new Set(scene.lineKeys), scene.n);
  assert.equal(clueResult.over, 1);
  assert.equal(evaluateCompletion(structure.structure, clueResult).complete, false);
});

test('场景 10 的线索设置全部满足（环内 4 格各 2 条）', () => {
  const scene = DIAGNOSTIC_BOARDS.find((board) => board.id === 'all-satisfied-two-loops');
  const clueResult = evaluateClues(scene.clues, new Set(scene.lineKeys), scene.n);
  assert.equal(clueResult.satisfied, clueResult.hasClueCount, '全部线索满足');
  assert.equal(clueResult.satisfied, 8);
});
