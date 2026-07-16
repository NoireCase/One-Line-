import { MousePointer2, Sparkles } from 'lucide-react';

function cellCenter(idx, boardSize) {
  return {
    x: ((idx % boardSize) + 0.5) * (100 / boardSize),
    y: (Math.floor(idx / boardSize) + 0.5) * (100 / boardSize),
  };
}

export default function StarLineGuideOverlay({
  boardSize,
  targetCells,
  path = [],
  pointerTarget,
  showDemo = true,
  prefersReducedMotion = false,
}) {
  if (!targetCells?.length) return null;

  const pointer = cellCenter(pointerTarget ?? targetCells[0], boardSize);
  const start = path.length > 1 ? cellCenter(path[0], boardSize) : null;
  const end = path.length > 1 ? cellCenter(path[path.length - 1], boardSize) : null;

  return (
    <div className="starline-guide-overlay" aria-hidden="true" data-testid="star-line-guide-overlay">
      {!prefersReducedMotion && start && end && (
        <svg className="starline-guide-trail" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
        </svg>
      )}
      {showDemo && !prefersReducedMotion && (
        <span
          className={`starline-guide-pointer ${path.length > 1 ? 'is-drag-demo' : 'is-tap-demo'}`}
          style={{
            '--sl-guide-x': `${pointer.x}%`,
            '--sl-guide-y': `${pointer.y}%`,
            '--sl-guide-end-x': end ? `${end.x}%` : `${pointer.x}%`,
            '--sl-guide-end-y': end ? `${end.y}%` : `${pointer.y}%`,
          }}
        >
          <MousePointer2 size={22} strokeWidth={1.8} />
          <Sparkles className="starline-guide-pointer__spark" size={12} />
        </span>
      )}
    </div>
  );
}
