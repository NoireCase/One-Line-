// P4B 数字环线 Spike · 诊断棋盘渲染（原型级界面，不做正式美术）
// 渲染与命中共用同一 viewBox 几何；数据语义与视觉表现分离。

import { EDGE_ORIENTATIONS } from '../input/edgeCoordinates.js';
import { EDGE_STATES } from '../input/edgeState.js';
import { edgeSegmentGeometry, vertexPoint } from '../input/edgeGeometry.js';

const LINE_COLOR = '#34d399';        // 原型 line 标记（中性，不冻结）
const EXCLUDED_COLOR = '#94a3b8';    // 原型 excluded 标记（中性）
const GRID_COLOR = '#475569';        // undecided 基础边
const CLUE_COLOR = '#e2e8f0';

/**
 * 渲染棋盘。
 * props：
 * - layout：computeBoardLayout 输出
 * - edges：{ key: state } 全部边状态
 * - clues：n×n 数组（null = 无线索）
 * - allEdgeKeys：listAllEdgeKeys(layout.n)
 * - onPointerDown/Move/Up/Cancel：原始 React PointerEvent
 * - onContextMenu 阻止（方案 A secondary 需要）
 * - svgRef
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
}) {
  const { n, cellSize, boardSize } = layout;
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

    // undecided：基础网格边
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
      <rect
        x={0} y={0} width={boardSize} height={boardSize}
        rx={6}
        fill="#0f172a"
      />
      {allEdgeKeys.map(renderEdge)}
      {Array.from({ length: n }, (_, row) => (
        Array.from({ length: n }, (_, col) => renderClue(row, col))
      ))}
    </svg>
  );
}
