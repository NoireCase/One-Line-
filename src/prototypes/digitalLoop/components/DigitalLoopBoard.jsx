// P4B 数字环线 Spike · 诊断棋盘渲染（原型级界面，不做正式美术）
// 渲染与命中共用同一 viewBox 几何；数据语义与视觉表现分离。
// 所有装饰图层（line / X / hover / debug / clue / vertex）一律 pointer-events: none，
// 统一由棋盘根容器处理 Pointer Events；命中只依赖 clientX/Y + root rect + board geometry。

import { EDGE_ORIENTATIONS } from '../input/edgeCoordinates.js';
import { EDGE_STATES } from '../input/edgeState.js';
import { edgeSegmentGeometry, vertexPoint } from '../input/edgeGeometry.js';

const LINE_COLOR = '#34d399';        // 原型 line 标记（中性，不冻结）
const EXCLUDED_COLOR = '#94a3b8';    // 原型 excluded 标记（中性）
const GRID_COLOR = '#475569';        // undecided 基础边
const CLUE_COLOR = '#e2e8f0';
const HOVER_LINE = 'rgba(52, 211, 153, 0.55)';     // 左键通道：undecided → 将添加 line
const HOVER_ERASE = 'rgba(148, 163, 184, 0.55)';   // 将删除 line
const HOVER_BLOCKED = 'rgba(248, 113, 113, 0.4)';  // 互斥状态不可覆盖
const HOVER_X = 'rgba(129, 140, 248, 0.55)';       // 右键通道：将添加 X
const HOVER_X_ERASE = 'rgba(148, 163, 184, 0.55)'; // 将删除 X
const AMBIGUITY_COLOR = '#fbbf24';
const DEBUG_H = '#facc15';
const DEBUG_V = '#60a5fa';

/**
 * 渲染棋盘。
 * props：
 * - layout / edges / clues / allEdgeKeys / svgRef：同前
 * - onPointer* / onContextMenu：原始 React PointerEvent
 * - hover：{ key, ambiguous } | null（与 pointerdown 同一 hit 事实源）
 * - pressChannel：'line' | 'excluded' | null（当前按下的操作通道，用于预览色）
 * - debugMode：是否开启 Hit Debug 可视化
 * - debugInfo：{ nearestH, nearestV, ambiguous, selectedKey } | null
 * - tracePoints：board-local 轨迹点数组（最近 N 个）
 */
export default function DigitalLoopBoard({
  layout,
  edges,
  clues,
  allEdgeKeys,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onContextMenu,
  svgRef,
  hover,
  pressChannel,
  debugMode,
  debugInfo,
  tracePoints,
}) {
  const { n, cellSize, boardSize, corridorHalfWidth } = layout;
  const lineStroke = Math.max(3, cellSize * 0.14);
  const gridStroke = Math.max(1, cellSize * 0.05);
  const excludedStroke = Math.max(1.5, cellSize * 0.06);

  const renderEdge = (key) => {
    const [orientation, row, col] = key.split(':').map((part, idx) => (
      idx === 0 ? part : Number(part)
    ));
    const edge = {
      orientation: orientation === 'h' ? EDGE_ORIENTATIONS.horizontal : EDGE_ORIENTATIONS.vertical,
      row,
      col,
    };
    const seg = edgeSegmentGeometry(edge, layout);
    if (!seg) return null;
    const state = edges[key] ?? EDGE_STATES.undecided;

    if (state === EDGE_STATES.line) {
      return (
        <line
          key={key}
          data-testid={`edge-${key}`}
          data-edge-state="line"
          x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
          stroke={LINE_COLOR}
          strokeWidth={lineStroke}
          strokeLinecap="round"
        />
      );
    }

    if (state === EDGE_STATES.excluded) {
      const mx = (seg.x1 + seg.x2) / 2;
      const my = (seg.y1 + seg.y2) / 2;
      const half = cellSize * 0.18;
      return (
        <g key={key} data-testid={`edge-${key}`} data-edge-state="excluded">
          <line
            x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
            stroke={EXCLUDED_COLOR}
            strokeWidth={excludedStroke}
            strokeDasharray={`${cellSize * 0.12} ${cellSize * 0.1}`}
            opacity={0.7}
          />
          {/* 中性 × 标记：原型表达，不冻结正式美术 */}
          <line
            x1={mx - half} y1={my - half} x2={mx + half} y2={my + half}
            stroke={EXCLUDED_COLOR} strokeWidth={excludedStroke} opacity={0.85}
          />
          <line
            x1={mx - half} y1={my + half} x2={mx + half} y2={my - half}
            stroke={EXCLUDED_COLOR} strokeWidth={excludedStroke} opacity={0.85}
          />
        </g>
      );
    }

    return (
      <line
        key={key}
        data-testid={`edge-${key}`}
        data-edge-state="undecided"
        x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
        stroke={GRID_COLOR}
        strokeWidth={gridStroke}
        opacity={0.55}
      />
    );
  };

  const renderClue = (row, col) => {
    const clue = clues?.[row]?.[col] ?? null;
    if (clue === null) return null;
    const vp = vertexPoint({ row, col }, layout);
    return (
      <text
        key={`clue-${row}-${col}`}
        data-testid={`clue-${row}-${col}`}
        x={vp.x + cellSize / 2}
        y={vp.y + cellSize / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={CLUE_COLOR}
        fontSize={cellSize * 0.5}
        fontWeight={600}
      >
        {clue}
      </text>
    );
  };

  // ── Hover 反馈（DEV 原型反馈，不冻结正式视觉）──
  const renderHover = () => {
    if (!hover || !hover.key) return null;
    const state = edges[hover.key] ?? EDGE_STATES.undecided;
    const [orientation, row, col] = hover.key.split(':').map((part, idx) => (
      idx === 0 ? part : Number(part)
    ));
    const seg = edgeSegmentGeometry({
      orientation: orientation === 'h' ? EDGE_ORIENTATIONS.horizontal : EDGE_ORIENTATIONS.vertical,
      row,
      col,
    }, layout);
    if (!seg) return null;

    let color;
    if (pressChannel === 'excluded') {
      color = state === EDGE_STATES.undecided ? HOVER_X
        : state === EDGE_STATES.excluded ? HOVER_X_ERASE
          : HOVER_BLOCKED;
    } else {
      color = state === EDGE_STATES.undecided ? HOVER_LINE
        : state === EDGE_STATES.line ? HOVER_ERASE
          : HOVER_BLOCKED;
    }

    // corridor 条带：沿边的实际命中走廊
    const dx = seg.x2 - seg.x1;
    const dy = seg.y2 - seg.y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len * corridorHalfWidth;
    const ny = dx / len * corridorHalfWidth;

    return (
      <g key="hover" data-testid="hover-overlay" data-hover-key={hover.key} pointerEvents="none">
        <polygon
          points={[
            `${seg.x1 + nx},${seg.y1 + ny}`,
            `${seg.x2 + nx},${seg.y2 + ny}`,
            `${seg.x2 - nx},${seg.y2 - ny}`,
            `${seg.x1 - nx},${seg.y1 - ny}`,
          ].join(' ')}
          fill={color}
          opacity={0.35}
        />
        <line
          x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
          stroke={color}
          strokeWidth={Math.max(2, cellSize * 0.1)}
          strokeLinecap="round"
        />
        {hover.ambiguous && (
          <circle
            cx={(seg.x1 + seg.x2) / 2}
            cy={(seg.y1 + seg.y2) / 2}
            r={cellSize * 0.22}
            fill="none"
            stroke={AMBIGUITY_COLOR}
            strokeWidth={2}
          />
        )}
      </g>
    );
  };

  // ── Hit Debug 可视化（DEV-only）──
  const renderDebug = () => {
    if (!debugMode) return null;
    const layers = [];
    if (debugInfo?.nearestH) {
      const seg = edgeSegmentGeometry(debugInfo.nearestH.edge, layout);
      if (seg) {
        layers.push(
          <line key="dbg-h" x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
            stroke={DEBUG_H} strokeWidth={2} opacity={0.8} strokeDasharray="6 4" />,
        );
      }
    }
    if (debugInfo?.nearestV) {
      const seg = edgeSegmentGeometry(debugInfo.nearestV.edge, layout);
      if (seg) {
        layers.push(
          <line key="dbg-v" x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
            stroke={DEBUG_V} strokeWidth={2} opacity={0.8} strokeDasharray="6 4" />,
        );
      }
    }
    if (debugInfo?.ambiguous) {
      layers.push(
        <circle key="dbg-amb" cx={debugInfo.pointX} cy={debugInfo.pointY}
          r={cellSize * 0.28} fill={AMBIGUITY_COLOR} opacity={0.35} />,
      );
    }
    if (tracePoints && tracePoints.length >= 2) {
      layers.push(
        <polyline key="dbg-trace" points={tracePoints.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none" stroke="#f472b6" strokeWidth={1.5} opacity={0.7} />,
      );
    }
    return <g key="hit-debug" pointerEvents="none">{layers}</g>;
  };

  return (
    <svg
      ref={svgRef}
      data-testid="digital-loop-board"
      viewBox={`0 0 ${boardSize} ${boardSize}`}
      className="w-full h-auto select-none touch-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onContextMenu={onContextMenu}
      style={{ touchAction: 'none' }}
    >
      {/* 装饰图层一律不接管事件：命中只由棋盘根容器处理 */}
      <style>{`[data-testid="digital-loop-board"] * { pointer-events: none; }`}</style>
      <rect
        x={0} y={0} width={boardSize} height={boardSize}
        rx={6}
        fill="#0f172a"
      />
      {allEdgeKeys.map(renderEdge)}
      {Array.from({ length: n }, (_, row) => (
        Array.from({ length: n }, (_, col) => renderClue(row, col))
      ))}
      {renderHover()}
      {renderDebug()}
    </svg>
  );
}
