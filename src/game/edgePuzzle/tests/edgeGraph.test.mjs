// Production Edge Puzzle Foundation · 通用边图原语测试
// 只测通用图原语；不含数字环线分类（分类属于规则层）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectLineKeys,
  buildVertexDegrees,
  connectedComponents,
  isClosedLoop,
} from '../edgeGraph.js';
import { parseEdgeKey, edgeEndpoints, vertexKey } from '../edgeCoordinates.js';

test('collectLineKeys：合法、非法、重复分离；key 规范化去重', () => {
  const result = collectLineKeys(['h:2:1', 'h:02:1', 'v:99:0', 'x:0:0', 'h:2:2'], 5);
  assert.deepEqual(result.validKeys, ['h:2:1', 'h:2:2']);
  assert.deepEqual(result.invalid, ['v:99:0', 'x:0:0']);
  assert.deepEqual(result.duplicates, ['h:2:1'], '规范 key 去重（h:02:1 与 h:2:1 视为重复）');
});

test('collectLineKeys：空输入', () => {
  const result = collectLineKeys([], 5);
  assert.deepEqual(result, { validKeys: [], invalid: [], duplicates: [] });
});

test('buildVertexDegrees：单边两端 degree=1', () => {
  const degrees = buildVertexDegrees(['h:2:1']);
  assert.equal(degrees.get('2:1'), 1);
  assert.equal(degrees.get('2:2'), 1);
});

test('buildVertexDegrees：闭合环四顶点 degree=2', () => {
  const keys = ['h:1:1', 'v:1:1', 'h:2:1', 'v:1:2'];
  const degrees = buildVertexDegrees(keys);
  for (const vertex of ['1:1', '2:1', '2:2', '1:2']) {
    assert.equal(degrees.get(vertex), 2, `顶点 ${vertex} degree=2`);
  }
});

test('connectedComponents：两条连续横边同一分量', () => {
  const { components } = connectedComponents(['h:2:1', 'h:2:2']);
  assert.equal(components.length, 1);
  assert.equal(components[0].edgeCount, 2);
  assert.equal(components[0].vertices.length, 3);
});

test('connectedComponents：两个空间分离的环为两个分量', () => {
  const { components } = connectedComponents([
    'h:0:0', 'h:1:0', 'v:0:0', 'v:0:1',
    'h:3:3', 'h:4:3', 'v:3:3', 'v:3:4',
  ]);
  assert.equal(components.length, 2);
  assert.equal(components[0].edgeCount, 4);
  assert.equal(components[1].edgeCount, 4);
});

test('isClosedLoop：闭合环判定（通用图性质）', () => {
  const keys = ['h:1:1', 'v:1:1', 'h:2:1', 'v:1:2'];
  const { components } = connectedComponents(keys);
  const degrees = buildVertexDegrees(keys);
  assert.equal(components.length, 1);
  assert.equal(isClosedLoop(components[0], degrees), true, '四边闭合环');
});

test('isClosedLoop：开放链不是闭合环；8 字形共享顶点分量不是闭合环', () => {
  const chain = ['h:2:1', 'h:2:2'];
  const { components: chainComponents } = connectedComponents(chain);
  assert.equal(isClosedLoop(chainComponents[0], buildVertexDegrees(chain)), false);

  // 8 字形：共享顶点 degree=4，分量含 8 条边 7 个顶点 → 不是闭合环
  const figureEight = ['h:1:1', 'v:1:1', 'h:2:1', 'v:1:2', 'h:2:2', 'v:2:2', 'h:3:2', 'v:2:3'];
  const { components: figComponents } = connectedComponents(figureEight);
  assert.equal(figComponents.length, 1, '8 字形两环共享顶点 → 同一分量');
  assert.equal(figComponents[0].edgeCount, 8);
  assert.equal(figComponents[0].vertices.length, 7);
  assert.equal(isClosedLoop(figComponents[0], buildVertexDegrees(figureEight)), false, '共享顶点分量不是单一闭合环');
});

test('图原语与坐标模型一致：每个 key 的端点可独立推导', () => {
  const keys = ['h:2:1', 'v:1:2', 'h:3:2'];
  for (const key of keys) {
    const edge = parseEdgeKey(key);
    assert.ok(edge, `${key} 可解析`);
    const endpoints = edgeEndpoints(edge);
    assert.equal(endpoints.length, 2);
    for (const endpoint of endpoints) {
      assert.equal(typeof vertexKey(endpoint), 'string');
    }
  }
});
