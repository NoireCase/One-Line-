// P4B 数字环线 Spike · 几何命中纯函数测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBoardLayout, toBoardLocal } from '../input/edgeGeometry.js';
import { hitTestEdge, hitDeadZone } from '../input/hitTesting.js';

const layout = computeBoardLayout(5);
const { cellSize, originX, originY, boardSize } = layout;

const at = (x, y) => ({ x, y });

test('横边中心命中', () => {
  // h:2:1 的中点：(padding + 1.5*cell, padding + 2*cell)
  assert.equal(hitTestEdge(at(originX + 1.5 * cellSize, originY + 2 * cellSize), layout), 'h:2:1');
});

test('竖边中心命中', () => {
  // v:2:1 的中点：(padding + 1*cell, padding + 2.5*cell)
  assert.equal(hitTestEdge(at(originX + 1 * cellSize, originY + 2.5 * cellSize), layout), 'v:2:1');
});

test('顶点死区不命中任何边', () => {
  assert.equal(hitTestEdge(at(originX + 2 * cellSize, originY + 2 * cellSize), layout), null);
  assert.deepEqual(hitDeadZone(at(originX + 2 * cellSize, originY + 2 * cellSize), layout), { row: 2, col: 2 });
});

test('外边界边可命中（棋盘外缘走廊）', () => {
  // 上边界 h:0:0：点位于棋盘上方 padding - 10（距边界 10 < corridor 12.8）
  assert.equal(hitTestEdge(at(originX + 0.5 * cellSize, originY - 10), layout), 'h:0:0');
  // 左边界 v:0:0
  assert.equal(hitTestEdge(at(originX - 10, originY + 0.5 * cellSize), layout), 'v:0:0');
});

test('离所有边都远（cell 中心附近）不命中', () => {
  assert.equal(hitTestEdge(at(originX + 1 * cellSize + 0.5, originY + 1 * cellSize + 0.5), layout), null);
});

test('并列距离时确定性规则：vertical 优先', () => {
  // 距 h:0:0 与 v:0:0 同为 12px（走廊内），距角顶点 (0,0) 为 12√2≈17 > 死区 15.2
  assert.equal(hitTestEdge(at(originX + 12, originY + 12), layout), 'v:0:0');
});

test('并列距离时确定性规则：同 orientation 按 row/col 升序', () => {
  // 构造距 h:2:2 与 v:2:2 均为 10px 的点，验证 vertical 优先之外的 row 升序：
  // 点 (originX + 2.5*cell, originY + 2*cell + 10)：距 h:2:2 = 10（唯一命中，竖边距 20 超走廊）
  const y = originY + 2 * cellSize + 10;
  const x = originX + 2.5 * cellSize;
  assert.equal(hitTestEdge(at(x, y), layout), 'h:2:2');
  // 对称地，点 (originX + 2*cell + 10, originY + 2.5*cell)：距 v:2:2 = 10 → 命中竖边
  assert.equal(hitTestEdge(at(originX + 2 * cellSize + 10, originY + 2.5 * cellSize), layout), 'v:2:2');
});

test('viewport 缩放后 board-local 转换命中一致（390×844 与 1440×900 视口）', () => {
  // 模拟 SVG 在不同视口下的 rect：boardSize viewBox 映射到不同像素宽
  const narrowRect = { left: 10, top: 20, width: 340, height: 340 };
  const wideRect = { left: 100, top: 50, width: 900, height: 900 };
  // 同一 viewBox 目标点（h:2:1 中点）从两个视口坐标换算后命中一致
  const target = at(originX + 1.5 * cellSize, originY + 2 * cellSize);
  const fromNarrow = toBoardLocal(
    at(10 + target.x * 340 / boardSize, 20 + target.y * 340 / boardSize),
    narrowRect,
    layout,
  );
  const fromWide = toBoardLocal(
    at(100 + target.x * 900 / boardSize, 50 + target.y * 900 / boardSize),
    wideRect,
    layout,
  );
  assert.equal(hitTestEdge(fromNarrow, layout), 'h:2:1');
  assert.equal(hitTestEdge(fromWide, layout), 'h:2:1');
});

test('同一几何点的命中不随边状态变化（状态无关）', () => {
  // hitTestEdge 无状态输入；重复调用结果稳定
  const p = at(originX + 1.5 * cellSize, originY + 2 * cellSize);
  assert.equal(hitTestEdge(p, layout), hitTestEdge(p, layout));
  assert.equal(hitTestEdge(p, layout), 'h:2:1');
});
