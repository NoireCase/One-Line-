// P4B 数字环线 Spike · 几何命中纯函数测试（桌面收敛模型）
// 模型：点到有限线段距离 + corridor + ambiguity（横竖候选几乎等距）。
// 无大面积圆形死区；Edge 大部分可见长度均可命中。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBoardLayout, toBoardLocal } from '../input/edgeGeometry.js';
import { hitTestEdge, hitTestEdgeDetailed } from '../input/hitTesting.js';
import { EDGE_ORIENTATIONS } from '../input/edgeCoordinates.js';

const layout = computeBoardLayout(5);
const { cellSize, originX, originY, boardSize } = layout;

const at = (x, y) => ({ x, y });

// 横边 h:(row,col) 上按比例位置（board-local）
function pointOnH(row, col, ratio) {
  return at(
    originX + (col + ratio) * cellSize,
    originY + row * cellSize,
  );
}
// 竖边 v:(row,col) 上按比例位置
function pointOnV(row, col, ratio) {
  return at(
    originX + col * cellSize,
    originY + (row + ratio) * cellSize,
  );
}

test('横边 10% / 25% / 50% / 75% / 90% 位置均可命中', () => {
  for (const ratio of [0.1, 0.25, 0.5, 0.75, 0.9]) {
    assert.equal(hitTestEdge(pointOnH(2, 1, ratio), layout), 'h:2:1', `h:2:1 @${ratio * 100}%`);
  }
});

test('竖边 10% / 25% / 50% / 75% / 90% 位置均可命中', () => {
  for (const ratio of [0.1, 0.25, 0.5, 0.75, 0.9]) {
    assert.equal(hitTestEdge(pointOnV(2, 1, ratio), layout), 'v:2:1', `v:2:1 @${ratio * 100}%`);
  }
});

test('精确顶点为歧义（不提交错误 Edge）', () => {
  const detail = hitTestEdgeDetailed(at(originX + 2 * cellSize, originY + 2 * cellSize), layout);
  assert.equal(detail.ambiguous, true, '四边等距 → ambiguous');
  assert.equal(hitTestEdge(at(originX + 2 * cellSize, originY + 2 * cellSize), layout), null);
});

test('顶点附近但更接近横边 → 命中横边', () => {
  // 点 (105, 102)：距 h:2:2 为 2，距 v:2:2 为 5 → 无歧义，命中横边
  assert.equal(hitTestEdge(at(originX + 2 * cellSize + 5, originY + 2 * cellSize + 2), layout), 'h:2:2');
});

test('顶点附近但更接近竖边 → 命中竖边', () => {
  // 点 (102, 105)：距 v:2:2 为 2，距 h:2:2 为 5 → 无歧义，命中竖边
  assert.equal(hitTestEdge(at(originX + 2 * cellSize + 2, originY + 2 * cellSize + 5), layout), 'v:2:2');
});

test('外边界边可命中（棋盘外缘走廊）', () => {
  assert.equal(hitTestEdge(at(originX + 0.5 * cellSize, originY - 10), layout), 'h:0:0');
  assert.equal(hitTestEdge(at(originX - 10, originY + 0.5 * cellSize), layout), 'v:0:0');
});

test('board padding 之外不命中', () => {
  assert.equal(hitTestEdge(at(5, 5), layout), null);
  assert.equal(hitTestEdge(at(originX + 2 * cellSize, -8), layout), null, '上方远离外边界');
});

test('cell 中心附近（远离所有边）不命中', () => {
  assert.equal(hitTestEdge(at(originX + 1.5 * cellSize, originY + 1.5 * cellSize), layout), null);
});

test('安全区：clue 中心（= cell 中心）不命中', () => {
  // clue 渲染在 cell 中心；该位置距四边 20px > corridor 12.8
  const center = at(originX + 2.5 * cellSize, originY + 2.5 * cellSize);
  assert.equal(hitTestEdge(center, layout), null);
});

test('安全区：两条平行 Edge 正中间无随机吸附', () => {
  // 距 h:2:1 与 h:3:1 各 20px 的点
  const between = at(originX + 1.5 * cellSize, originY + 2.5 * cellSize);
  assert.equal(hitTestEdge(between, layout), null);
});

test('安全区：corridor 不覆盖格子中心大面积区域', () => {
  // corridor 半宽 12.8 < 半 cell 20：格中心有稳定安全区
  assert.ok(layout.corridorHalfWidth < cellSize / 2);
  // 距边 15px 的点（> corridor）不命中
  const nearEdge = at(originX + 1.5 * cellSize, originY + 2 * cellSize + 15);
  assert.equal(hitTestEdge(nearEdge, layout), null);
});

test('hitTestEdgeDetailed 提供最近横边/竖边与距离', () => {
  const detail = hitTestEdgeDetailed(pointOnH(2, 1, 0.5), layout);
  assert.equal(detail.nearestH.key, 'h:2:1');
  assert.ok(detail.nearestH.dist < 0.01);
  assert.ok(detail.nearestV.dist > 0);
  assert.equal(detail.ambiguous, false);
});

test('10×10 与 11×11 棋盘命中一致', () => {
  const l10 = computeBoardLayout(10);
  const l11 = computeBoardLayout(11);
  assert.equal(hitTestEdge(pointOnH(5, 4, 0.5), l10), 'h:5:4');
  assert.equal(hitTestEdge(pointOnH(5, 4, 0.9), l10), 'h:5:4');
  assert.equal(hitTestEdge(pointOnV(6, 7, 0.25), l10), 'v:6:7');
  assert.equal(hitTestEdge(pointOnH(8, 9, 0.5), l11), 'h:8:9');
  assert.equal(hitTestEdge(pointOnV(3, 10, 0.75), l11), 'v:3:10');
  // 11×11 右下角顶点歧义
  const corner = at(originX + 11 * cellSize, originY + 11 * cellSize);
  assert.equal(hitTestEdge(corner, l11), null);
  assert.equal(hitTestEdgeDetailed(corner, l11).ambiguous, true);
});

test('viewport 缩放后 board-local 转换命中一致（390×844 与 1440×900 视口）', () => {
  const narrowRect = { left: 10, top: 20, width: 340, height: 340 };
  const wideRect = { left: 100, top: 50, width: 900, height: 900 };
  const target = pointOnH(2, 1, 0.5);
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
  const p = pointOnH(2, 1, 0.1);
  assert.equal(hitTestEdge(p, layout), hitTestEdge(p, layout));
  assert.equal(hitTestEdge(p, layout), 'h:2:1');
});

test('orientation 辅助常量可用（装饰图层不改变命中）', () => {
  // 命中函数不接受任何视觉/状态参数：横竖边同一几何判定
  assert.equal(EDGE_ORIENTATIONS.horizontal, 'horizontal');
  assert.equal(EDGE_ORIENTATIONS.vertical, 'vertical');
});
