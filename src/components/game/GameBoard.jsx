import { useMemo } from 'react';
import { motion as Motion } from 'motion/react';
import { X } from 'lucide-react';
import { getCellClass, getCellContent, getCellTextClass } from '../../game/display/cellStyle.js';

export default function GameBoard({
  gridData,
  path,
  N,
  breakPoints,
  isPathCompleting,
  wrongFlash,
  targetFlash,
  comboStreak,
  activePortal,
  lastConnectedIndex,
  connectionFeedback,
  isPortal2,
  prefersReducedMotion,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  containerRef
}) {
  const lines = useMemo(() => {
    const result = [];
    for (let i = 0; i < path.length - 1; i++) {
      if (breakPoints.has(i + 1)) continue;
      const u = path[i], v = path[i + 1];
      const r1 = Math.floor(u / N), c1 = u % N;
      const r2 = Math.floor(v / N), c2 = v % N;
      const isPortalJump = gridData[u]?.portalId && gridData[u]?.portalId === gridData[v]?.portalId;
      if (isPortalJump) continue;

      const isLastSegment = (i + 1 === path.length - 1) || breakPoints.has(i + 2);
      const wClass = N > 7 ? "4" : "6";

      result.push({
        x1: `${(c1 + 0.5) * (100 / N)}%`, y1: `${(r1 + 0.5) * (100 / N)}%`,
        x2: `${(c2 + 0.5) * (100 / N)}%`, y2: `${(r2 + 0.5) * (100 / N)}%`,
        wClass, isLastSegment
      });
    }
    return result;
  }, [path, N, breakPoints, gridData]);

  const headIndex = path[path.length - 1];
  const headRow = Math.floor(headIndex / N);
  const headCol = headIndex % N;
  const headPoint = {
    x: `${(headCol + 0.5) * (100 / N)}%`,
    y: `${(headRow + 0.5) * (100 / N)}%`
  };

  return (
    <div
      ref={containerRef}
      className={`board-sketch relative w-full max-w-md aspect-square mx-2 p-2 touch-none select-none border ${isPathCompleting ? 'board-completing' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={e => e.preventDefault()}
    >
      <svg className="game-path-layer absolute inset-0 w-full h-full pointer-events-none z-[15]" style={{ padding: '0.25rem' }}>
        {lines.map((l, i) => (
          <g key={i}>
            <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke="#112a27" strokeWidth={Number(l.wClass) + 10} strokeLinecap="round"
              opacity="0.55"
              className="path-line-depth"
            />
            <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke="#9bdccd" strokeWidth={Number(l.wClass) + 2.5} strokeLinecap="round"
              pathLength="1"
              className={`path-line-main ${l.isLastSegment ? 'path-line-new' : ''}`}
            />
            <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke="#edf8f5" strokeWidth={Math.max(Number(l.wClass) - 2, 1.8)} strokeLinecap="round"
              opacity="0.40"
              transform="translate(0.7 -0.5)"
              className="path-line-highlight"
            />
            {isPathCompleting && (
              <line
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
                stroke="#f3ddb0"
                strokeWidth={Number(l.wClass) + 4}
                strokeLinecap="round"
                pathLength="1"
                className="path-completion-trace"
                style={{
                  animationDelay: `${100 + Math.round((i / Math.max(lines.length, 1)) * 560)}ms`
                }}
              />
            )}
          </g>
        ))}
        {!isPathCompleting && [...breakPoints].map(bp => {
          if (bp <= 0 || bp >= path.length) return null;
          const ci = path[bp];
          const cr = Math.floor(ci / N);
          const cc = ci % N;
          const isHead = bp === path.length - 1;
          if (isHead) return null;
          return (
            <circle
              key={`seg-start-${bp}`}
              cx={`${(cc + 0.5) * (100 / N)}%`}
              cy={`${(cr + 0.5) * (100 / N)}%`}
              r={N > 7 ? 2.2 : 3.0}
              fill="none"
              stroke="#8cccb9"
              strokeWidth="1.2"
              opacity="0.45"
            />
          );
        })}
        {isPathCompleting && (
          <g className="path-completion-finish" style={{ animationDelay: '700ms' }}>
            <circle cx={headPoint.x} cy={headPoint.y} r={N > 7 ? 7 : 10} className="path-finish-ring" />
            <circle cx={headPoint.x} cy={headPoint.y} r={N > 7 ? 2.5 : 3.5} className="path-finish-dot" />
          </g>
        )}
      </svg>

      <div className="w-full h-full" style={{ display: 'grid', gridTemplateColumns: `repeat(${N}, 1fr)`, gridTemplateRows: `repeat(${N}, 1fr)` }}>
        {gridData.map((cell, idx) => {
          const inPath = path.includes(idx);
          const isCompleteState = isPathCompleting || path.length === N * N;
          const isHead = !isCompleteState && path[path.length - 1] === idx;
          const isError = wrongFlash === idx;
          const isTargetFlash = targetFlash?.includes(idx);
          const portalId = cell.portalId;
          const isPortalEntryActive = activePortal?.entryIndex === idx;
          const isPortalExitActive = activePortal?.exitIndex === idx;

          const bgClass = getCellClass(cell, inPath, isHead, isError, portalId, isPortalEntryActive, isPortalExitActive, comboStreak, isTargetFlash);
          const textClass = getCellTextClass(cell, portalId, isPortal2);
          const content = getCellContent(cell, inPath, portalId, isPortal2);

          return (
            <Motion.div
              key={idx}
              className="p-0.5 md:p-1"
              data-index={idx}
              whileTap={{ scale: 0.9, transition: { duration: 0.08 } }}
              animate={isError ? { x: [0, -4, 4, -2, 2, 0] } : {}}
              transition={isError ? { duration: 0.3 } : {}}
            >
              <div
                data-index={idx}
                className={`cell-token relative w-full h-full flex items-center justify-center font-bold
                  ${N === 5 ? 'text-3xl' : N === 7 ? 'text-2xl' : 'text-lg'}
                  ${bgClass} ${textClass}
                  ${inPath ? 'path-visited' : ''}
                  ${isHead ? 'path-head' : ''}
                  ${lastConnectedIndex === idx ? 'connection-pop' : ''}
                  ${isPortalExitActive ? 'ring-2 ring-violet-300/50 scale-[1.03]' : ''}
                `}
              >
                {cell.isExcluded
                  ? <X data-index={idx} className="cell-number text-rose-500 absolute" size={N > 7 ? 20 : 32} />
                  : <span data-index={idx} className="cell-number">{content}</span>}
              </div>
            </Motion.div>
          );
        })}
      </div>
      {connectionFeedback && (
        <Motion.div
          key={connectionFeedback.id}
          className={`connection-float pointer-events-none absolute z-50 ${connectionFeedback.milestone ? 'connection-float-milestone' : ''}`}
          style={connectionFeedback.style}
          initial={prefersReducedMotion ? { opacity: 0.9 } : { opacity: 0, y: 5, scale: 0.68 }}
          animate={prefersReducedMotion ? { opacity: 0.9 } : { opacity: [0, 1, 1, 0], y: [5, -4, -22, -38], scale: [0.68, 1.24, 1.08, 0.98] }}
          transition={{ duration: prefersReducedMotion ? 0.2 : 0.58, ease: [0.2, 0.75, 0.25, 1] }}
        >
          {connectionFeedback.label}
        </Motion.div>
      )}
    </div>
  );
}
