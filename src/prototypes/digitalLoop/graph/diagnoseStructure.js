// P4B 数字环线 Spike · 第一层：通用边图结构诊断（纯函数）
// 输出分类：Empty / Open Chain / Closed Single Loop / Branch / Multiple Loops / Invalid Edge Reference。
// 只统计 line 边；excluded 与 undecided 不参与。

import { buildVertexDegrees, collectLineKeys, connectedComponents, isClosedLoop } from './edgeGraph.js';

export const STRUCTURES = Object.freeze({
  empty: 'Empty',
  openChain: 'Open Chain',
  closedSingleLoop: 'Closed Single Loop',
  branch: 'Branch',
  multipleLoops: 'Multiple Loops',
  invalidEdgeReference: 'Invalid Edge Reference',
});

/**
 * 结构诊断主入口。
 * @param {string[]} rawLineKeys line 边 key 数组
 * @param {number} n 棋盘 N（N×N cell）
 * @returns { structure, detail }
 */
export function diagnoseStructure(rawLineKeys, n) {
  const { validKeys, invalid, duplicates } = collectLineKeys(rawLineKeys, n);

  if (invalid.length > 0 || duplicates.length > 0) {
    return {
      structure: STRUCTURES.invalidEdgeReference,
      detail: { invalid, duplicates, validKeys: validKeys.length },
    };
  }

  if (validKeys.length === 0) {
    return {
      structure: STRUCTURES.empty,
      detail: { edgeCount: 0, vertexCount: 0, maxDegree: 0, components: 0, loopCount: 0, chainCount: 0 },
    };
  }

  const degrees = buildVertexDegrees(validKeys);
  let maxDegree = 0;
  for (const count of degrees.values()) {
    if (count > maxDegree) maxDegree = count;
  }

  if (maxDegree >= 3) {
    return {
      structure: STRUCTURES.branch,
      detail: {
        edgeCount: validKeys.length,
        vertexCount: degrees.size,
        maxDegree,
        components: 0,
        loopCount: 0,
        chainCount: 0,
      },
    };
  }

  const { components } = connectedComponents(validKeys);
  let loopCount = 0;
  let chainCount = 0;
  for (const comp of components) {
    if (isClosedLoop(comp, degrees)) loopCount += 1;
    else chainCount += 1;
  }

  let structure;
  if (loopCount >= 2) {
    structure = STRUCTURES.multipleLoops;
  } else if (loopCount === 1 && chainCount === 0) {
    structure = STRUCTURES.closedSingleLoop;
  } else {
    // 环+链，或只有开放链：合同定义下归入 Open Chain，detail 说明结构组成
    structure = STRUCTURES.openChain;
  }

  return {
    structure,
    detail: {
      edgeCount: validKeys.length,
      vertexCount: degrees.size,
      maxDegree,
      components: components.length,
      loopCount,
      chainCount,
    },
  };
}
