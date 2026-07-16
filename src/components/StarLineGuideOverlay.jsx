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
  demoPaths = [],
  pointerTarget,
  gesture = 'tap',
  showDemo = true,
  prefersReducedMotion = false,
}) {
  if (!targetCells?.length) return null;

  const paths = demoPaths.length > 0
    ? demoPaths.filter(item => item.length > 1)
    : path.length > 1 ? [path] : [];
  const demonstrations = paths.length > 0
    ? paths.map((item, index) => ({
        start: cellCenter(item[0], boardSize),
        end: cellCenter(item[item.length - 1], boardSize),
        delay: index * 650,
      }))
    : [{
        start: cellCenter(pointerTarget ?? targetCells[0], boardSize),
        end: null,
        delay: 0,
      }];

  return (
    <div className="starline-guide-overlay" aria-hidden="true" data-testid="star-line-guide-overlay">
      {!prefersReducedMotion && paths.length > 0 && (
        <svg className="starline-guide-trail" viewBox="0 0 100 100" preserveAspectRatio="none">
          {demonstrations.map(({ start, end }, index) => (
            <line key={index} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
          ))}
        </svg>
      )}
      {showDemo && !prefersReducedMotion && demonstrations.map(({ start, end, delay }, index) => (
        <span
          key={index}
          className={`starline-guide-pointer ${gesture === 'drag' ? 'is-drag-demo' : gesture === 'double-tap' ? 'is-double-tap-demo' : 'is-tap-demo'}`}
          style={{
            '--sl-guide-x': `${start.x}%`,
            '--sl-guide-y': `${start.y}%`,
            '--sl-guide-end-x': end ? `${end.x}%` : `${start.x}%`,
            '--sl-guide-end-y': end ? `${end.y}%` : `${start.y}%`,
            '--sl-guide-delay': `${delay}ms`,
          }}
        >
          <MousePointer2 size={22} strokeWidth={1.8} />
          <Sparkles className="starline-guide-pointer__spark" size={12} />
        </span>
      ))}
    </div>
  );
}
