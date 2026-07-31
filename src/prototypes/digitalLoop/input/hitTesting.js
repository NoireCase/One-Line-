// P4B 数字环线 Spike · Edge hit testing（纯函数）
// 命中与 Edge 状态无关（undecided / line / excluded 使用同一几何命中区域）；
// 不依赖 DOM 遍历顺序、不依赖 z-index、不依赖 DOM id、不依赖 event.target/offsetX。
//
// 模型：
// 1. 命中基于「点到有限 Edge segment 的距离」（垂直距离 + 端点范围判定），不是无限直线。
// 2. 不使用大面积圆形死区吞掉 Edge 两端：只有横边与竖边候选「几乎等距」时进入 ambiguity。
// 3. 选择距离最近的有限 Edge segment；若最近与次近距离差 < TIE_EPSILON，返回 ambiguous
//    （点击不提交错误 Edge；拖动由手势层结合上一 Edge 与移动方向裁决）。
// 4. 全部候选中，横边/竖边分别给出最近距离，供 Hit Debug 展示。

import { EDGE_ORIENTATIONS, edgeKey, isEdgeInBounds } from './edgeCoordinates.js';
import { edgeSegmentGeometry } from './edgeGeometry.js';

// 候选参数（P4B 实测用，不宣称已冻结）：
// corridor 半宽 = 0.32 × cell；ambiguity 距离差阈值 = 1.0（viewBox px）。
export const HIT_PARAMS = Object.freeze({
  corridorHalfWidthRatio: 0.32,
  tieEpsilon: 1.0,
});

function distToSegment(point, seg) {
  const dx = seg.x2 - seg.x1;
  const dy = seg.y2 - seg.y1;
  const lenSq = dx * dx + dy * dy;
  let t = 0;
  if (lenSq > 0) {
    t = ((point.x - seg.x1) * dx + (point.y - seg.y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
  }
  const px = seg.x1 + t * dx;
  const py = seg.y1 + t * dy;
  return Math.hypot(point.x - px, point.y - py);
}

function consider(point, edge, layout, best) {
  const seg = edgeSegmentGeometry(edge, layout);
  if (!seg) return;
  const dist = distToSegment(point, seg);
  const key = edgeKey(edge, layout.n);
  const candidate = { key, dist, edge, orientation: edge.orientation };
  if (!best.nearest || dist < best.nearest.dist - 1e-9) {
    best.second = best.nearest;
    best.nearest = candidate;
  } else if (!best.second || dist < best.second.dist - 1e-9) {
    best.second = candidate;
  }
  if (edge.orientation === EDGE_ORIENTATIONS.horizontal) {
    if (!best.nearestH || dist < best.nearestH.dist - 1e-9) {
      best.nearestH = candidate;
    }
  } else if (!best.nearestV || dist < best.nearestV.dist - 1e-9) {
    best.nearestV = candidate;
  }
}

/**
 * 详细命中：返回 { nearest, second, nearestH, nearestV, ambiguous }。
 * - nearest / second：距离最近与次近的候选（含超过 corridor 的候选，供歧义判断）
 * - nearestH / nearestV：横边与竖边各自最近的候选
 * - ambiguous：nearest 与 second 距离差 < tieEpsilon 且两者均在 corridor 内
 */
export function hitTestEdgeDetailed(point, layout) {
  if (!layout || !point) {
    return { nearest: null, second: null, nearestH: null, nearestV: null, ambiguous: false };
  }
  const { n, corridorHalfWidth } = layout;
  const best = { nearest: null, second: null, nearestH: null, nearestV: null };

  for (let row = 0; row <= n; row += 1) {
    for (let col = 0; col < n; col += 1) {
      const edge = { orientation: EDGE_ORIENTATIONS.horizontal, row, col };
      if (isEdgeInBounds(edge, n)) consider(point, edge, layout, best);
    }
  }
  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col <= n; col += 1) {
      const edge = { orientation: EDGE_ORIENTATIONS.vertical, row, col };
      if (isEdgeInBounds(edge, n)) consider(point, edge, layout, best);
    }
  }

  const nearest = best.nearest;
  const second = best.second;
  const ambiguous = !!(nearest && second
    && nearest.dist <= corridorHalfWidth
    && second.dist <= corridorHalfWidth
    && Math.abs(nearest.dist - second.dist) <= layout.tieEpsilon);
  return { ...best, ambiguous };
}

/**
 * 简化命中：返回命中的 Edge key；无命中或歧义返回 null。
 */
export function hitTestEdge(point, layout) {
  const detail = hitTestEdgeDetailed(point, layout);
  if (!detail.nearest) return null;
  if (detail.nearest.dist > layout.corridorHalfWidth) return null;
  if (detail.ambiguous) return null;
  return detail.nearest.key;
}
