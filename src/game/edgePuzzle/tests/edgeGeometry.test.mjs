// Production Edge Puzzle Foundation · Board geometry 纯函数测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeBoardLayout,
  edgeSegmentGeometry,
  vertexPoint,
  toBoardLocal,
  displayCellSizePx,
  CELL_SIZE,
  BOARD_PADDING,
  HIT_PARAMS,
} from '../edgeGeometry.js';
import { EDGE_ORIENTATIONS } from '../edgeCoordinates.js';

test('computeBoardLayout：默认参数与几何推导', () => {
  const layout = computeBoardLayout(5);
  assert.equal(layout.n, 5);
  assert.equal(layout.cellSize, CELL_SIZE);
  assert.equal(layout.padding, BOARD_PADDING);
  assert.equal(layout.boardSize, 5 * CELL_SIZE + BOARD_PADDING * 2);
  assert.equal(layout.originX, BOARD_PADDING);
  assert.equal(layout.originY, BOARD_PADDING);
  assert.equal(layout.corridorHalfWidth, HIT_PARAMS.corridorHalfWidthRatio * CELL_SIZE);
  assert.equal(layout.tieEpsilon, HIT_PARAMS.tieEpsilon);
});

test('computeBoardLayout：非法 n 返回 null；参数可覆盖', () => {
  assert.equal(computeBoardLayout(0), null);
  assert.equal(computeBoardLayout(-1), null);
  assert.equal(computeBoardLayout(1.5), null);
  const layout = computeBoardLayout(3, { cellSize: 50, padding: 10 });
  assert.equal(layout.cellSize, 50);
  assert.equal(layout.padding, 10);
  assert.equal(layout.boardSize, 3 * 50 + 20);
});

test('命中参数单一来源：hitTesting 依赖 layout 注入（无重复定义）', () => {
  // HIT_PARAMS 只存在于 edgeGeometry；layout 携带 corridor/tieEpsilon 供 hitTesting 使用。
  const layout = computeBoardLayout(5);
  assert.equal(layout.corridorHalfWidth, 12.8);
  assert.equal(layout.tieEpsilon, 1.0);
  assert.equal(HIT_PARAMS.corridorHalfWidthRatio, 0.32);
  assert.equal(HIT_PARAMS.tieEpsilon, 1.0);
});

test('edgeSegmentGeometry：横边与竖边端点', () => {
  const layout = computeBoardLayout(5);
  const h = edgeSegmentGeometry({ orientation: EDGE_ORIENTATIONS.horizontal, row: 2, col: 1 }, layout);
  assert.deepEqual(h, { x1: 60, y1: 100, x2: 100, y2: 100 });
  const v = edgeSegmentGeometry({ orientation: EDGE_ORIENTATIONS.vertical, row: 2, col: 3 }, layout);
  assert.deepEqual(v, { x1: 140, y1: 100, x2: 140, y2: 140 });
});

test('edgeSegmentGeometry：非法边返回 null', () => {
  const layout = computeBoardLayout(5);
  assert.equal(edgeSegmentGeometry({ orientation: EDGE_ORIENTATIONS.horizontal, row: 6, col: 0 }, layout), null);
  assert.equal(edgeSegmentGeometry(null, layout), null);
});

test('vertexPoint：顶点位置与越界', () => {
  const layout = computeBoardLayout(5);
  assert.deepEqual(vertexPoint({ row: 2, col: 2 }, layout), { x: 100, y: 100 });
  assert.deepEqual(vertexPoint({ row: 0, col: 0 }, layout), { x: 20, y: 20 });
  assert.equal(vertexPoint({ row: 6, col: 0 }, layout), null);
  assert.equal(vertexPoint(null, layout), null);
});

test('toBoardLocal：viewport → viewBox 换算', () => {
  const layout = computeBoardLayout(5);
  const rect = { left: 10, top: 20, width: 480, height: 480 };
  const local = toBoardLocal({ x: 250, y: 260 }, rect, layout);
  assert.deepEqual(local, { x: 120, y: 120 });
});

test('displayCellSizePx：缩放后 cell 像素', () => {
  const layout = computeBoardLayout(5); // boardSize = 240
  assert.equal(displayCellSizePx({ width: 480 }, layout), 80, '2× 缩放 → cell 80px');
  assert.equal(displayCellSizePx({ width: 240 }, layout), 40, '1× 缩放 → cell 40px');
  assert.equal(displayCellSizePx({ width: 0 }, layout), null);
});
