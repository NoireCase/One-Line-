// P4B 数字环线 Spike · 第二层：最小 Loopy 数字线索判定（纯函数）
// 只做线索状态汇总，不求解、不判唯一解、不判难度。

import { EDGE_ORIENTATIONS, edgeKey } from '../input/edgeCoordinates.js';

export const CLUE_STATUS = Object.freeze({
  unmet: 'unmet',        // 少于数字：未完成或仍可继续
  satisfied: 'satisfied', // 等于数字：当前满足
  over: 'over',          // 大于数字：冲突
});

/**
 * 某一格周边的四条边 key（上横边、下横边、左竖边、右竖边）。
 * 格 (row, col)：
 *   上边 h:(row, col)、下边 h:(row+1, col)
 *   左边 v:(row, col)、右边 v:(row, col+1)
 */
export function edgesAroundCell(row, col, n) {
  return [
    edgeKey({ orientation: EDGE_ORIENTATIONS.horizontal, row, col }, n),
    edgeKey({ orientation: EDGE_ORIENTATIONS.horizontal, row: row + 1, col }, n),
    edgeKey({ orientation: EDGE_ORIENTATIONS.vertical, row, col }, n),
    edgeKey({ orientation: EDGE_ORIENTATIONS.vertical, row, col: col + 1 }, n),
  ];
}

/**
 * 统计某格周边 line 数量。
 * @param {Set<string>} lineKeySet line 边 key 集合
 */
export function countLineAroundCell(row, col, n, lineKeySet) {
  let count = 0;
  for (const key of edgesAroundCell(row, col, n)) {
    if (lineKeySet.has(key)) count += 1;
  }
  return count;
}

/**
 * 求线索格的当前状态。
 * @param {number|null} clue 格内数字；null 表示无线索
 * @param {number} lineCount 周边 line 数量
 */
export function clueStatus(clue, lineCount) {
  if (clue === null || clue === undefined) return null;
  if (lineCount < clue) return CLUE_STATUS.unmet;
  if (lineCount === clue) return CLUE_STATUS.satisfied;
  return CLUE_STATUS.over;
}

/**
 * 评估全部数字线索。
 * @param {Array<Array<number|null>>} clues n×n 二维数组
 * @param {Set<string>} lineKeySet
 * @returns { cells: [{ row, col, clue, lineCount, status }], satisfied, unmet, over, hasClueCount }
 */
export function evaluateClues(clues, lineKeySet, n) {
  const cells = [];
  let satisfied = 0;
  let unmet = 0;
  let over = 0;
  let hasClueCount = 0;
  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col < n; col += 1) {
      const clue = clues?.[row]?.[col] ?? null;
      if (clue === null) continue;
      hasClueCount += 1;
      const lineCount = countLineAroundCell(row, col, n, lineKeySet);
      const status = clueStatus(clue, lineCount);
      cells.push({ row, col, clue, lineCount, status });
      if (status === CLUE_STATUS.satisfied) satisfied += 1;
      else if (status === CLUE_STATUS.over) over += 1;
      else unmet += 1;
    }
  }
  return { cells, satisfied, unmet, over, hasClueCount };
}
