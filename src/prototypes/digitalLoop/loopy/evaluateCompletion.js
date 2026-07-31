// P4B 数字环线 Spike · 联合完成判定（纯函数）
// 完成 = Closed Single Loop ∧ 全部数字线索满足。
// 只有单环但数字未满足、或数字全满足但存在多环/断链，都不得完成。

import { STRUCTURES } from '../graph/diagnoseStructure.js';

/**
 * 联合完成判定。
 * @param {string} structure 第一层结构分类（diagnoseStructure 输出）
 * @param {object} clueResult 第二层线索评估（evaluateClues 输出）
 * @returns { complete: boolean, reasons: string[] }
 */
export function evaluateCompletion(structure, clueResult) {
  const reasons = [];

  if (structure !== STRUCTURES.closedSingleLoop) {
    reasons.push(`structure is not a single closed loop (${structure})`);
  }
  if (clueResult.over > 0) {
    reasons.push(`${clueResult.over} clue(s) over limit`);
  }
  if (clueResult.unmet > 0) {
    reasons.push(`${clueResult.unmet} clue(s) not satisfied`);
  }

  const complete = reasons.length === 0;
  return {
    complete,
    reasons: complete ? ['single closed loop and all clues satisfied'] : reasons,
  };
}
