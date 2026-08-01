// P4B 数字环线 Spike · 通用边图结构（纯函数）
// 只统计 line 边；undecided / excluded 不参与图结构。
// 输入：line edge key 数组；输出：顶点度数、连通分量、闭合性等。

import {
  parseEdgeKey,
  edgeEndpoints,
  vertexKey,
  isEdgeInBounds,
} from '../input/edgeCoordinates.js';

/**
 * 解析并校验 line key 列表。
 * 返回 { validKeys, invalid, duplicates }；非法/越界/重复计入对应数组。
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
    if (seen.has(raw)) {
      duplicates.push(raw);
      continue;
    }
    seen.add(raw);
    validKeys.push(raw);
  }
  return { validKeys, invalid, duplicates };
}

/**
 * 顶点度数表：Map<vertexKey, count>。
 * 只统计 line 边。
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
 * line 边构成的连通分量（顶点 union-find）。
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
 * 判断一个连通分量是否为闭合环：
 * 分量内所有顶点 degree = 2，且边数 ≥ 4，且边数 == 顶点数。
 */
export function isClosedLoop(component, degrees) {
  if (component.edgeCount < 4) return false;
  if (component.edgeCount !== component.vertices.length) return false;
  for (const vk of component.vertices) {
    if ((degrees.get(vk) || 0) !== 2) return false;
  }
  return true;
}
