// P4B 数字环线 Spike · Board geometry（纯函数）
// 几何全部定义在 viewBox 坐标域（0..boardSize），由渲染层按容器缩放。
// 命中与渲染共用同一布局，保证「缩放后的命中一致性」。

import { EDGE_ORIENTATIONS, isEdgeInBounds } from './edgeCoordinates.js';

export const CELL_SIZE = 40;        // viewBox 域 cell 边长（像素单位，候选值）
export const BOARD_PADDING = 20;    // 棋盘四周留白（viewBox 域）

// 命中参数（候选值，P4B 实测用；不宣称已冻结）：
// 走廊半宽 = 0.32 × cell；死区半径 = 0.38 × cell。
export const HIT_PARAMS = Object.freeze({
  corridorHalfWidthRatio: 0.32,
  deadZoneRadiusRatio: 0.38,
});

/**
 * 计算棋盘布局。返回：
 * {
 *   n, cellSize, padding, boardSize,
 *   originX, originY,            // 棋盘 (0,0) cell 左上角在 viewBox 中的位置
 *   corridorHalfWidth, deadZoneRadius,  // 当前候选像素值（viewBox 域）
 * }
 */
export function computeBoardLayout(n, {
  cellSize = CELL_SIZE,
  padding = BOARD_PADDING,
} = {}) {
  if (!Number.isInteger(n) || n <= 0) return null;
  return {
    n,
    cellSize,
    padding,
    boardSize: n * cellSize + padding * 2,
    originX: padding,
    originY: padding,
    corridorHalfWidth: HIT_PARAMS.corridorHalfWidthRatio * cellSize,
    deadZoneRadius: HIT_PARAMS.deadZoneRadiusRatio * cellSize,
  };
}

/**
 * 边在 viewBox 坐标域的线段几何：{ x1, y1, x2, y2 }。
 * 横边：y = padding + row*cell；x 从 padding + col*cell 到 padding + (col+1)*cell。
 * 竖边：x = padding + col*cell；y 从 padding + row*cell 到 padding + (row+1)*cell。
 * 非法边返回 null。
 */
export function edgeSegmentGeometry(edge, layout) {
  if (!layout || !edge || !isEdgeInBounds(edge, layout.n)) return null;
  const { cellSize, originX, originY } = layout;
  if (edge.orientation === EDGE_ORIENTATIONS.horizontal) {
    return {
      x1: originX + edge.col * cellSize,
      y1: originY + edge.row * cellSize,
      x2: originX + (edge.col + 1) * cellSize,
      y2: originY + edge.row * cellSize,
    };
  }
  return {
    x1: originX + edge.col * cellSize,
    y1: originY + edge.row * cellSize,
    x2: originX + edge.col * cellSize,
    y2: originY + (edge.row + 1) * cellSize,
  };
}

/**
 * 顶点在 viewBox 坐标域的位置：{ x, y }。
 * 棋盘外顶点（row/col 越界）返回 null。
 */
export function vertexPoint(vertex, layout) {
  if (!layout || !vertex) return null;
  const { n, cellSize, originX, originY } = layout;
  const { row, col } = vertex;
  if (row < 0 || row > n || col < 0 || col > n) return null;
  return { x: originX + col * cellSize, y: originY + row * cellSize };
}

/**
 * viewport 像素 → viewBox 坐标域。
 * svgRect：SVG 元素的 getBoundingClientRect()。
 */
export function toBoardLocal(point, svgRect, layout) {
  if (!svgRect || !layout || svgRect.width <= 0 || svgRect.height <= 0) return null;
  return {
    x: (point.x - svgRect.left) * layout.boardSize / svgRect.width,
    y: (point.y - svgRect.top) * layout.boardSize / svgRect.height,
  };
}

/**
 * 计算 svgRect 上实际显示的 cell 像素边长（供诊断面板与记录）。
 */
export function displayCellSizePx(svgRect, layout) {
  if (!svgRect || !layout || svgRect.width <= 0) return null;
  return layout.cellSize * svgRect.width / layout.boardSize;
}
