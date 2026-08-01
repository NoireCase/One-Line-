// P4B 数字环线 Spike · 联合完成判定（纯函数）
// 完成 = Closed Single Loop ∧ 至少一个数字线索 ∧ 全部数字线索满足。
// 无数字场景不得完成（禁止用空集 every() 的空真推导出完成）。

import { STRUCTURES } from '../graph/diagnoseStructure.js';

/**
 * 联合完成判定。
 * @param {string} structure 第一层结构分类（diagnoseStructure 输出）
 * @param {object} clueResult 第二层线索评估（evaluateClues 输出，含 hasClueCount）
 * @returns { complete: boolean, hasClues: boolean, allCluesSatisfied: boolean, reasons: string[] }
 */
export function evaluateCompletion(structure, clueResult) {
  const hasClues = clueResult.hasClueCount > 0;
  const allCluesSatisfied = hasClues
    && clueResult.over === 0
    && clueResult.unmet === 0;
  const reasons = [];

  if (structure !== STRUCTURES.closedSingleLoop) {
    reasons.push(`structure is not a single closed loop (${structure})`);
  }
  if (!hasClues) {
    reasons.push('no numeric clues present (completion requires at least one clue)');
  }
  if (hasClues && clueResult.over > 0) {
    reasons.push(`${clueResult.over} clue(s) over limit`);
  }
  if (hasClues && clueResult.unmet > 0) {
    reasons.push(`${clueResult.unmet} clue(s) not satisfied`);
  }

  const complete = reasons.length === 0;
  return {
    hasClues,
    allCluesSatisfied,
    complete,
    reasons: complete ? ['single closed loop and all clues satisfied'] : reasons,
  };
}
