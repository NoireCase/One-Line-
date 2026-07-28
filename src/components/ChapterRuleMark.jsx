function ClassicRuleMark() {
  const route = 'M31 75c27 0 35-40 70-40 36 0 41 43 78 43 40 0 43-48 81-48 30 0 37 31 69 31 19 0 31-12 45-21';

  return (
    <>
      <defs>
        <linearGradient id="classic-route-gradient" x1="0" x2="1">
          <stop offset="0" stopColor="rgb(var(--level-accent))" />
          <stop offset=".58" stopColor="var(--level-accent-strong)" />
          <stop offset="1" stopColor="rgb(var(--level-accent))" />
        </linearGradient>
      </defs>
      <g className="rule-mark-layer rule-mark-layer-track">
        <path
          className="rule-mark-field-line is-upper"
          d="M8 24c66-19 109 14 172 0 64-14 124-9 232 12"
        />
        <path
          className="rule-mark-field-line is-lower"
          d="M8 91c70-13 117 11 181-3 66-15 131-8 223 6"
        />
        <path className="rule-mark-chapter-track" d={route} pathLength="1" />
        <path className="rule-mark-chapter-gutter" d={route} pathLength="1" />
      </g>
      <g className="rule-mark-layer rule-mark-layer-route">
        <path
          className="rule-mark-primary rule-mark-chapter-route"
          d={route}
          pathLength="1"
          stroke="url(#classic-route-gradient)"
        />
      </g>
      <g className="rule-mark-layer rule-mark-layer-direction">
        <path className="rule-mark-direction rule-mark-chapter-direction" d="m174 76 11-8-5 13" />
      </g>
      <g className="rule-mark-layer rule-mark-layer-terminals rule-mark-classic-start">
        <circle className="rule-mark-start-ring" cx="31" cy="75" r="7.5" />
        <circle className="rule-mark-terminal is-start" cx="31" cy="75" r="3" />
      </g>
      <g className="rule-mark-layer rule-mark-layer-terminals rule-mark-classic-end">
        <circle className="rule-mark-end-glow" cx="374" cy="40" r="17" />
        <circle className="rule-mark-end-ring" cx="374" cy="40" r="7.8" />
        <circle className="rule-mark-terminal is-end" cx="374" cy="40" r="3.7" />
      </g>
    </>
  );
}

function HiddenRuleMark() {
  const routeLeft = 'M31 75c27 0 35-40 70-40 31 0 39 31 67 39 12 4 22 1 31-6';
  const routeRight = 'M229 51c9-14 18-21 31-21 30 0 37 31 69 31 19 0 31-12 45-21';

  return (
    <>
      <defs>
        <linearGradient id="hidden-route-left-gradient" x1="0" x2="1">
          <stop offset="0" stopColor="rgb(var(--level-accent))" />
          <stop offset=".66" stopColor="var(--level-accent-strong)" />
          <stop offset=".86" stopColor="rgb(var(--level-accent))" stopOpacity=".42" />
          <stop offset="1" stopColor="rgb(var(--level-accent))" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="hidden-route-right-gradient" x1="0" x2="1">
          <stop offset="0" stopColor="rgb(var(--level-accent))" stopOpacity="0" />
          <stop offset=".2" stopColor="rgb(var(--level-accent))" stopOpacity=".36" />
          <stop offset=".4" stopColor="var(--level-accent-strong)" />
          <stop offset="1" stopColor="rgb(var(--level-accent))" />
        </linearGradient>
        <linearGradient id="hidden-field-gradient" x1="0" x2="1">
          <stop offset="0" stopColor="rgb(var(--level-accent))" stopOpacity=".42" />
          <stop offset=".36" stopColor="rgb(var(--level-accent))" stopOpacity=".38" />
          <stop offset=".47" stopColor="rgb(var(--level-accent))" stopOpacity=".14" />
          <stop offset=".62" stopColor="rgb(var(--level-secondary))" stopOpacity=".12" />
          <stop offset=".72" stopColor="rgb(var(--level-accent))" stopOpacity=".34" />
          <stop offset="1" stopColor="rgb(var(--level-accent))" stopOpacity=".42" />
        </linearGradient>
        <linearGradient id="hidden-left-mask-gradient" x1="0" x2="1">
          <stop offset="0" stopColor="white" />
          <stop offset=".66" stopColor="white" />
          <stop offset=".86" stopColor="rgb(108 108 108)" />
          <stop offset="1" stopColor="black" />
        </linearGradient>
        <linearGradient id="hidden-right-mask-gradient" x1="0" x2="1">
          <stop offset="0" stopColor="black" />
          <stop offset=".2" stopColor="rgb(96 96 96)" />
          <stop offset=".42" stopColor="white" />
          <stop offset="1" stopColor="white" />
        </linearGradient>
        <mask id="hidden-left-fade" maskUnits="userSpaceOnUse" x="0" y="0" width="215" height="112">
          <rect width="215" height="112" fill="url(#hidden-left-mask-gradient)" />
        </mask>
        <mask id="hidden-right-fade" maskUnits="userSpaceOnUse" x="220" y="0" width="200" height="112">
          <rect x="220" width="200" height="112" fill="url(#hidden-right-mask-gradient)" />
        </mask>
        <filter id="hidden-haze-soften" x="-30%" y="-100%" width="160%" height="300%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      <g className="rule-mark-layer rule-mark-layer-track rule-mark-layer-hidden-field">
        <path
          className="rule-mark-field-line rule-mark-hidden-field is-upper"
          d="M8 24c59-17 103 9 162 0 68-10 132-7 242 13"
        />
        <path
          className="rule-mark-field-line rule-mark-hidden-field is-lower"
          d="M8 91c64-12 108 7 168-2 67-11 132-6 236 5"
        />
        <path
          className="rule-mark-chapter-track rule-mark-hidden-left-base"
          d={routeLeft}
          pathLength="1"
          mask="url(#hidden-left-fade)"
        />
        <path
          className="rule-mark-chapter-gutter rule-mark-hidden-left-base"
          d={routeLeft}
          pathLength="1"
          mask="url(#hidden-left-fade)"
        />
        <path
          className="rule-mark-chapter-track rule-mark-hidden-right-base"
          d={routeRight}
          pathLength="1"
          mask="url(#hidden-right-fade)"
        />
        <path
          className="rule-mark-chapter-gutter rule-mark-hidden-right-base"
          d={routeRight}
          pathLength="1"
          mask="url(#hidden-right-fade)"
        />
        <path
          className="rule-mark-hidden-haze"
          d="M164 60c21-11 43 8 67-1 17-7 31-5 45 1"
          filter="url(#hidden-haze-soften)"
        />
        <path className="rule-mark-hidden-echo is-upper" d="M173 64c16 8 28-8 46-11 12-2 21 3 32-4" pathLength="1" />
        <path className="rule-mark-hidden-echo is-middle" d="M177 72c15 5 28-8 45-7 13 1 21-3 31-9" pathLength="1" />
        <path className="rule-mark-hidden-echo is-lower" d="M181 80c15 2 26-7 42-4 12 2 20-4 29-12" pathLength="1" />
      </g>
      <g className="rule-mark-layer rule-mark-layer-route">
        <path
          className="rule-mark-primary rule-mark-chapter-route rule-mark-hidden-left-route"
          d={routeLeft}
          pathLength="1"
          stroke="url(#hidden-route-left-gradient)"
          mask="url(#hidden-left-fade)"
        />
        <path
          className="rule-mark-primary rule-mark-chapter-route rule-mark-hidden-right-route"
          d={routeRight}
          pathLength="1"
          stroke="url(#hidden-route-right-gradient)"
          mask="url(#hidden-right-fade)"
        />
      </g>
      <g className="rule-mark-layer rule-mark-layer-direction">
        <path className="rule-mark-direction rule-mark-chapter-direction" d="m317 59 11-7-5 12" />
      </g>
      <g className="rule-mark-layer rule-mark-layer-terminals rule-mark-hidden-start">
        <circle className="rule-mark-start-ring" cx="31" cy="75" r="7.5" />
        <circle className="rule-mark-terminal is-start" cx="31" cy="75" r="3" />
      </g>
      <g className="rule-mark-layer rule-mark-layer-terminals rule-mark-hidden-end">
        <circle className="rule-mark-end-glow" cx="374" cy="40" r="17" />
        <circle className="rule-mark-end-ring" cx="374" cy="40" r="7.8" />
        <circle className="rule-mark-terminal is-end" cx="374" cy="40" r="3.7" />
      </g>
      <circle className="rule-mark-hidden-head" cx="0" cy="0" r="3.6" />
    </>
  );
}

function ExistingRuleMark({ modeId }) {
  if (modeId === 'diagonal') {
    const route = 'M31 78 108 32 177 72 177 30 285 67 374 35';

    return (
      <>
        <g className="rule-mark-layer rule-mark-layer-track">
          <path className="rule-mark-diagonal-field" d="m57 34 12-12" />
          <path className="rule-mark-diagonal-field" d="M237 82V67" />
          <path className="rule-mark-diagonal-field" d="m316 24 12 12" />
          <path className="rule-mark-chapter-track" d={route} pathLength="1" />
          <path className="rule-mark-chapter-gutter" d={route} pathLength="1" />
        </g>
        <g className="rule-mark-layer rule-mark-layer-route">
          <path className="rule-mark-primary rule-mark-chapter-route" d={route} pathLength="1" />
        </g>
        <g className="rule-mark-layer rule-mark-layer-direction">
          <path className="rule-mark-direction rule-mark-chapter-direction" d="m322 53 13-2-7 12" />
        </g>
        <g className="rule-mark-layer rule-mark-layer-terminals rule-mark-diagonal-start">
          <circle className="rule-mark-start-ring" cx="31" cy="78" r="7.5" />
          <circle className="rule-mark-terminal is-start" cx="31" cy="78" r="3" />
        </g>
        <g className="rule-mark-layer rule-mark-layer-terminals rule-mark-diagonal-end">
          <circle className="rule-mark-end-glow" cx="374" cy="35" r="17" />
          <circle className="rule-mark-end-ring" cx="374" cy="35" r="7.8" />
          <circle className="rule-mark-terminal is-end" cx="374" cy="35" r="3.7" />
        </g>
      </>
    );
  }

  if (modeId === 'portalClassic') {
    return (
      <>
        <g className="rule-mark-layer rule-mark-layer-track">
          <path className="rule-mark-field-line is-upper" d="M8 24c70-17 119 8 171 1 31-4 53-4 82 1 42 8 83 2 151 10" />
          <path className="rule-mark-field-line is-lower" d="M8 91c63-11 116 7 170-1 31-5 55-4 84 1 42 7 88-3 150 3" />
          <path className="rule-mark-chapter-track" d="M31 75c34 0 48-27 80-27 19 0 31 8 47 8M258 56c21 0 31 5 48 5 28 0 40-11 68-21" />
          <path className="rule-mark-chapter-gutter" d="M31 75c34 0 48-27 80-27 19 0 31 8 47 8M258 56c21 0 31 5 48 5 28 0 40-11 68-21" />
        </g>
        <g className="rule-mark-layer rule-mark-layer-route">
          <path className="rule-mark-primary rule-mark-chapter-route rule-mark-portal-left-route" d="M31 75c34 0 48-27 80-27 19 0 31 8 47 8" pathLength="1" />
          <path className="rule-mark-primary rule-mark-chapter-route rule-mark-portal-right-route" d="M258 56c21 0 31 5 48 5 28 0 40-11 68-21" pathLength="1" />
          <ellipse className="rule-mark-portal is-entry" cx="168" cy="56" rx="10.5" ry="23" />
          <ellipse className="rule-mark-portal-highlight is-entry" cx="168" cy="56" rx="7.2" ry="19.5" />
          <ellipse className="rule-mark-portal is-exit" cx="248" cy="56" rx="10.5" ry="23" />
          <ellipse className="rule-mark-portal-highlight is-exit" cx="248" cy="56" rx="7.2" ry="19.5" />
          <path className="rule-mark-transfer is-upper" d="M181 48c18-10 36-10 54 0" pathLength="1" />
          <path className="rule-mark-transfer is-lower" d="M181 64c18 9 36 9 54 0" pathLength="1" />
        </g>
        <g className="rule-mark-layer rule-mark-layer-direction">
          <path className="rule-mark-direction rule-mark-chapter-direction" d="m302 57 11 4-10 6" />
        </g>
        <g className="rule-mark-layer rule-mark-layer-terminals rule-mark-portal-start">
          <circle className="rule-mark-start-ring" cx="31" cy="75" r="7.5" />
          <circle className="rule-mark-terminal is-start" cx="31" cy="75" r="3" />
        </g>
        <g className="rule-mark-layer rule-mark-layer-terminals rule-mark-portal-end">
          <circle className="rule-mark-end-glow" cx="374" cy="40" r="17" />
          <circle className="rule-mark-end-ring" cx="374" cy="40" r="7.8" />
          <circle className="rule-mark-terminal is-end" cx="374" cy="40" r="3.7" />
        </g>
      </>
    );
  }

  if (modeId === 'starSingle') {
    return (
      <>
        <ellipse className="rule-mark-orbit" cx="110" cy="34" rx="88" ry="25" />
        <path className="rule-mark-secondary" d="M22 34h48M150 34h48" />
        <circle className="rule-mark-core" cx="110" cy="34" r="9" />
        <circle className="rule-mark-core-ring" cx="110" cy="34" r="18" />
      </>
    );
  }

  return (
    <>
      <ellipse className="rule-mark-orbit" cx="110" cy="34" rx="88" ry="25" />
      <path className="rule-mark-pair" d="M83 34h54" />
      <circle className="rule-mark-core" cx="83" cy="34" r="8" />
      <circle className="rule-mark-core" cx="137" cy="34" r="8" />
      <circle className="rule-mark-core-ring" cx="83" cy="34" r="16" />
      <circle className="rule-mark-core-ring" cx="137" cy="34" r="16" />
    </>
  );
}

export default function ChapterRuleMark({
  modeId,
  animationCycle = 0,
  prefersReducedMotion = false,
}) {
  const usesFullIdentityGeometry = [
    'classic',
    'hidden',
    'diagonal',
    'portalClassic',
  ].includes(modeId);
  const usesChapterAnimation = usesFullIdentityGeometry;
  const usesClassicGeometry = modeId === 'classic' || ![
    'hidden',
    'diagonal',
    'portalClassic',
    'starSingle',
    'starDouble',
  ].includes(modeId);
  const isAnimating = usesChapterAnimation && animationCycle > 0 && !prefersReducedMotion;

  return (
    <svg
      key={`${modeId}:${animationCycle}`}
      viewBox={usesFullIdentityGeometry ? '0 0 420 112' : '0 0 220 68'}
      className={isAnimating ? 'is-chapter-animating' : undefined}
      data-mode={modeId}
      data-animation-cycle={animationCycle}
      data-motion-policy={isAnimating ? 'animated' : 'static'}
      data-testid="chapter-rule-mark"
      aria-hidden="true"
    >
      {usesClassicGeometry && <ClassicRuleMark />}
      {modeId === 'hidden' && <HiddenRuleMark />}
      {!usesClassicGeometry && modeId !== 'hidden' && <ExistingRuleMark modeId={modeId} />}
    </svg>
  );
}
