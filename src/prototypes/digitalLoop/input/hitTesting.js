// P4B 数字环线 Spike · Edge hit testing（纯函数）
// 命中与 Edge 状态无关（undecided / line / excluded 使用同一几何命中区域）；
// 不依赖 DOM 遍历顺序、不依赖 z-index、不依赖 DOM id。
// 规则：先排除顶点死区，再在全部边中选「点到线段距离最近」者；
// 并列距离时按确定性规则（vertical 优先，其次 row、col 升序）裁决。

import {
  EDGE_ORIENTATIONS,
  edgeKey,
  isEdgeInBounds,
} from './edgeCoordinates.js';
import { edgeSegmentGeometry, vertexPoint } from './edgeGeometry.js';

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

/**
 * 判定点是否落在顶点死区内。
 * 返回命中的顶点 { row, col }，否则 null。
 * 死区：距最近顶点 < deadZoneRadius。
 */
export function hitDeadZone(point, layout) {
  const { n, deadZoneRadius, cellSize, originX, originY } = layout;
  const col = Math.round((point.x - originX) / cellSize);
  const row = Math.round((point.y - originY) / cellSize);
  if (row < 0 || row > n || col < 0 || col > n) return null;
  const vp = vertexPoint({ row, col }, layout);
  const dist = Math.hypot(point.x - vp.x, point.y - vp.y);
  if (dist < deadZoneRadius) return { row, col };
  return null;
}

/**
 * 主命中：给定 board-local 点，返回命中的边 key（含死区判定），否则 null。
 * 并列距离裁决：distance 最小者胜出；相等时 vertical 优先于 horizontal；
 * 再相等时 row 小者优先，仍相等时 col 小者优先。
 */
export function hitTestEdge(point, layout) {
  if (!layout || !point) return null;
  if (hitDeadZone(point, layout)) return null;

  const { n, corridorHalfWidth } = layout;
  let best = null;

  const consider = (edge) => {
    const seg = edgeSegmentGeometry(edge, layout);
    if (!seg) return;
    const dist = distToSegment(point, seg);
    if (dist > corridorHalfWidth) return;
    const key = edgeKey(edge, n);
    const parsed = key ? key.split(':') : null;
    const candidate = {
      key,
      dist,
      orientation: edge.orientation,
      row: edge.row,
      col: edge.col,
      // 确定性排序键：vertical 优先；随后 row、col 升序
      sortRow: parsed ? Number(parsed[1]) : edge.row,
      sortCol: parsed ? Number(parsed[2]) : edge.col,
      vFirst: edge.orientation === EDGE_ORIENTATIONS.vertical ? 0 : 1,
    };
    if (!best
      || candidate.dist < best.dist - 1e-9
      || (Math.abs(candidate.dist - best.dist) <= 1e-9 && (
        candidate.vFirst < best.vFirst
        || (candidate.vFirst === best.vFirst && candidate.sortRow < best.sortRow)
        || (candidate.vFirst === best.vFirst && candidate.sortRow === best.sortRow
          && candidate.sortCol < best.sortCol)
      ))) {
      best = candidate;
    }
  };

  // 横边：row ∈ [0, n]，col ∈ [0, n-1]
  for (let row = 0; row <= n; row += 1) {
    for (let col = 0; col < n; col += 1) {
      const edge = { orientation: EDGE_ORIENTATIONS.horizontal, row, col };
      if (isEdgeInBounds(edge, n)) consider(edge);
    }
  }
  // 竖边：row ∈ [0, n-1]，col ∈ [0, n]
  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col <= n; col += 1) {
      const edge = { orientation: EDGE_ORIENTATIONS.vertical, row, col };
      if (isEdgeInBounds(edge, n)) consider(edge);
    }
  }

  return best ? best.key : null;
}
