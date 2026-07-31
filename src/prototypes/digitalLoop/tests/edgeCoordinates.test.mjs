// P4B 数字环线 Spike · 坐标与 key 纯函数测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EDGE_ORIENTATIONS,
  edgeKey,
  parseEdgeKey,
  isEdgeInBounds,
  edgeEndpoints,
  vertexKey,
  edgesAtVertex,
  edgeCount,
  listAllEdgeKeys,
  resolveEdgeKeys,
} from '../input/edgeCoordinates.js';

test('横边合法范围：row ∈ [0,n]，col ∈ [0,n-1]', () => {
  assert.ok(isEdgeInBounds({ orientation: EDGE_ORIENTATIONS.horizontal, row: 0, col: 0 }, 5));
  assert.ok(isEdgeInBounds({ orientation: EDGE_ORIENTATIONS.horizontal, row: 5, col: 4 }, 5));
  assert.ok(!isEdgeInBounds({ orientation: EDGE_ORIENTATIONS.horizontal, row: 6, col: 0 }, 5));
  assert.ok(!isEdgeInBounds({ orientation: EDGE_ORIENTATIONS.horizontal, row: 0, col: 5 }, 5));
  assert.ok(!isEdgeInBounds({ orientation: EDGE_ORIENTATIONS.horizontal, row: -1, col: 0 }, 5));
});

test('竖边合法范围：row ∈ [0,n-1]，col ∈ [0,n]', () => {
  assert.ok(isEdgeInBounds({ orientation: EDGE_ORIENTATIONS.vertical, row: 0, col: 0 }, 5));
  assert.ok(isEdgeInBounds({ orientation: EDGE_ORIENTATIONS.vertical, row: 4, col: 5 }, 5));
  assert.ok(!isEdgeInBounds({ orientation: EDGE_ORIENTATIONS.vertical, row: 5, col: 0 }, 5));
  assert.ok(!isEdgeInBounds({ orientation: EDGE_ORIENTATIONS.vertical, row: 0, col: 6 }, 5));
});

test('边界边可命中（上/下/左/右外边界）', () => {
  assert.ok(isEdgeInBounds({ orientation: EDGE_ORIENTATIONS.horizontal, row: 0, col: 2 }, 5), '上边界');
  assert.ok(isEdgeInBounds({ orientation: EDGE_ORIENTATIONS.horizontal, row: 5, col: 2 }, 5), '下边界');
  assert.ok(isEdgeInBounds({ orientation: EDGE_ORIENTATIONS.vertical, row: 2, col: 0 }, 5), '左边界');
  assert.ok(isEdgeInBounds({ orientation: EDGE_ORIENTATIONS.vertical, row: 2, col: 5 }, 5), '右边界');
});

test('非法 orientation 拒绝', () => {
  assert.equal(isEdgeInBounds({ orientation: 'diagonal', row: 0, col: 0 }, 5), false);
  assert.equal(edgeKey({ orientation: 'diagonal', row: 0, col: 0 }, 5), null);
  assert.equal(edgeKey({ orientation: null, row: 0, col: 0 }, 5), null);
});

test('越界拒绝', () => {
  assert.equal(isEdgeInBounds({ orientation: EDGE_ORIENTATIONS.horizontal, row: 6, col: 0 }, 5), false);
  assert.equal(isEdgeInBounds({ orientation: EDGE_ORIENTATIONS.vertical, row: 0, col: 6 }, 5), false);
  assert.equal(edgeKey({ orientation: EDGE_ORIENTATIONS.horizontal, row: 6, col: 0 }, 5), null);
  assert.equal(edgeKey({ orientation: EDGE_ORIENTATIONS.horizontal, row: 0, col: 0.5 }, 5), null);
});

test('key 生成与 parse 往返', () => {
  const edge = { orientation: EDGE_ORIENTATIONS.horizontal, row: 2, col: 3 };
  const key = edgeKey(edge, 5);
  assert.equal(key, 'h:2:3');
  assert.deepEqual(parseEdgeKey(key), edge);
  assert.equal(edgeKey({ orientation: EDGE_ORIENTATIONS.vertical, row: 1, col: 4 }, 5), 'v:1:4');
  assert.deepEqual(parseEdgeKey('v:1:4'), { orientation: EDGE_ORIENTATIONS.vertical, row: 1, col: 4 });
});

test('parse 拒绝非法格式', () => {
  assert.equal(parseEdgeKey(null), null);
  assert.equal(parseEdgeKey(''), null);
  assert.equal(parseEdgeKey('x:1:1'), null);
  assert.equal(parseEdgeKey('h:1'), null);
  assert.equal(parseEdgeKey('h:a:1'), null);
  assert.equal(parseEdgeKey('h:1:1:1'), null);
});

test('端点：横边 (r,c)-(r,c+1)，竖边 (r,c)-(r+1,c)', () => {
  assert.deepEqual(
    edgeEndpoints({ orientation: EDGE_ORIENTATIONS.horizontal, row: 2, col: 3 }),
    [{ row: 2, col: 3 }, { row: 2, col: 4 }],
  );
  assert.deepEqual(
    edgeEndpoints({ orientation: EDGE_ORIENTATIONS.vertical, row: 2, col: 3 }),
    [{ row: 2, col: 3 }, { row: 3, col: 3 }],
  );
});

test('重复 edge 在装配层被拒绝', () => {
  const result = resolveEdgeKeys(['h:2:1', 'h:2:1', 'h:2:2'], 5);
  assert.deepEqual(result.keys, ['h:2:1', 'h:2:2']);
  assert.deepEqual(result.duplicates, ['h:2:1']);
  assert.deepEqual(result.invalid, []);
});

test('resolveEdgeKeys 拒绝非法与越界', () => {
  const result = resolveEdgeKeys(['h:2:1', 'v:99:0', 'x:0:0'], 5);
  assert.deepEqual(result.keys, ['h:2:1']);
  assert.deepEqual(result.invalid, ['v:99:0', 'x:0:0']);
});

test('10×10 共 220 条边；11×11 共 264 条边', () => {
  assert.equal(edgeCount(10), 220);
  assert.equal(edgeCount(11), 264);
  assert.equal(listAllEdgeKeys(10).length, 220);
  assert.equal(listAllEdgeKeys(11).length, 264);
  assert.equal(new Set(listAllEdgeKeys(11)).size, 264, 'keys 唯一');
});

// 独立几何事实：一条边是否经过给定顶点（用 edgeEndpoints 独立推导，不依赖被测函数）
function edgePassesThrough(edge, vertex) {
  return edgeEndpoints(edge).some((endpoint) => (
    endpoint.row === vertex.row && endpoint.col === vertex.col
  ));
}

// 断言 edgesAtVertex 结果：集合精确匹配 expectedKeys，且每条边确实经过顶点
function assertVertexEdges(vertex, n, expectedKeys) {
  const result = edgesAtVertex(vertex, n);
  const keys = result.map(({ key }) => key).sort();
  assert.deepEqual(keys, [...expectedKeys].sort(), `顶点 (${vertex.row},${vertex.col}) 的相邻边`);
  for (const item of result) {
    assert.ok(
      edgePassesThrough(item.edge, vertex),
      `${item.key} 的端点应包含顶点 (${vertex.row},${vertex.col})`,
    );
  }
}

test('顶点邻接（冻结公式）：内部顶点 (2,3)', () => {
  assertVertexEdges({ row: 2, col: 3 }, 5, ['h:2:2', 'h:2:3', 'v:1:3', 'v:2:3']);
});

test('顶点邻接：左上角 (0,0)', () => {
  assertVertexEdges({ row: 0, col: 0 }, 5, ['h:0:0', 'v:0:0']);
});

test('顶点邻接：上边界非角点 (0,2)', () => {
  assertVertexEdges({ row: 0, col: 2 }, 5, ['h:0:1', 'h:0:2', 'v:0:2']);
});

test('顶点邻接：左边界非角点 (2,0)', () => {
  assertVertexEdges({ row: 2, col: 0 }, 5, ['h:2:0', 'v:1:0', 'v:2:0']);
});

test('顶点邻接：右下角 (N,N)', () => {
  assertVertexEdges({ row: 5, col: 5 }, 5, ['h:5:4', 'v:4:5']);
});

test('顶点邻接：非法顶点返回空', () => {
  assert.deepEqual(edgesAtVertex({ row: 2, col: 2.5 }, 5), []);
  assert.deepEqual(edgesAtVertex(null, 5), []);
});

test('vertexKey 稳定生成', () => {
  assert.equal(vertexKey({ row: 2, col: 2 }), '2:2');
});
