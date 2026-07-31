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

test('顶点邻接：内部 4 条、边中点 3 条、角点 2 条', () => {
  const n = 5;
  const center = edgesAtVertex({ row: 2, col: 2 }, n);
  assert.equal(center.length, 4);
  const edgeMid = edgesAtVertex({ row: 0, col: 2 }, n);
  assert.equal(edgeMid.length, 3);
  const corner = edgesAtVertex({ row: 0, col: 0 }, n);
  assert.equal(corner.length, 2);
  assert.deepEqual(corner.map(({ slot }) => slot).sort(), ['bottom', 'right']);
  assert.equal(vertexKey({ row: 2, col: 2 }), '2:2');
});
