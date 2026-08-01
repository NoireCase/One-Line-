// Production Edge Puzzle Foundation · 通用边图原语（纯函数）
// 只提供通用图原语：Edge → Vertex、degree、连通分量、引用合法性、key 规范化、图遍历辅助。
// 不含任何数字环线规则分类（Open Chain / Closed Single Loop / Multiple Loops /
// Loopy completion / 数字线索）——这些留在数字环线规则层。

import {
  parseEdgeKey,
  edgeKey,
  edgeEndpoints,
  vertexKey,
  isEdgeInBounds,
} from './edgeCoordinates.js';

/**
 * 解析并校验 line key 列表。
 * 返回 { validKeys, invalid, duplicates }；非法/越界/重复计入对应数组。
 * 合法 key 统一规范化为规范形式；去重基于规范化 key。
 */
export function collectLineKeys(rawLineKeys, n) {
  const validKeys = [];
  const invalid = [];
  const duplicates = [];
  const seen = new Set();
  for (const raw of rawLineKeys || []) {
    const edge = parseEdgeKey(raw);
    if (!edge || !isEdgeInBounds(edge, n)) {
      invalid.push(raw);
      continue;
    }
    const key = edgeKey(edge, n);
    if (seen.has(key)) {
      duplicates.push(key);
      continue;
    }
    seen.add(key);
    validKeys.push(key);
  }
  return { validKeys, invalid, duplicates };
}

/**
 * 顶点度数表：Map<vertexKey, count>。
 */
export function buildVertexDegrees(lineKeys) {
  const degrees = new Map();
  for (const key of lineKeys) {
    const edge = parseEdgeKey(key);
    if (!edge) continue;
    for (const endpoint of edgeEndpoints(edge)) {
      const vk = vertexKey(endpoint);
      degrees.set(vk, (degrees.get(vk) || 0) + 1);
    }
  }
  return degrees;
}

/**
 * 边构成的连通分量（顶点 union-find）。
 * 返回 { components: [{ vertices, edgeKeys, edgeCount }], edgeToComponent: Map }
 * 按顶点集合表达分量；每条边连接其两个端点。
 */
export function connectedComponents(lineKeys) {
  const parent = new Map();
  const find = (vk) => {
    if (!parent.has(vk)) parent.set(vk, vk);
    let root = vk;
    while (parent.get(root) !== root) root = parent.get(root);
    // 路径压缩
    let cur = vk;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur);
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  const edgeKeys = [];
  for (const key of lineKeys) {
    const edge = parseEdgeKey(key);
    if (!edge) continue;
    const [a, b] = edgeEndpoints(edge);
    const va = vertexKey(a);
    const vb = vertexKey(b);
    union(va, vb);
    edgeKeys.push({ key, va, vb });
  }

  const byRoot = new Map();
  for (const { key, va, vb } of edgeKeys) {
    const root = find(va);
    if (!byRoot.has(root)) byRoot.set(root, { vertices: new Set(), edgeKeys: [], edgeCount: 0 });
    const comp = byRoot.get(root);
    comp.vertices.add(va);
    comp.vertices.add(vb);
    comp.edgeKeys.push(key);
    comp.edgeCount += 1;
  }

  const components = [...byRoot.values()].map((c) => ({
    vertices: [...c.vertices],
    edgeKeys: c.edgeKeys,
    edgeCount: c.edgeCount,
  }));
  return { components, edgeToComponent: byRoot };
}

/**
 * 图遍历辅助：判断一个连通分量是否为闭合环
 * （分量内所有顶点 degree = 2，且边数 ≥ 4，且边数 == 顶点数）。
 * 这是通用图性质判断；如何分类（单环 / 多环 / 环+链）由规则层决定。
 */
export function isClosedLoop(component, degrees) {
  if (component.edgeCount < 4) return false;
  if (component.edgeCount !== component.vertices.length) return false;
  for (const vk of component.vertices) {
    if ((degrees.get(vk) || 0) !== 2) return false;
  }
  return true;
}
