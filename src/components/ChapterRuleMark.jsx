// ── 循序寻踪场景变体（已确认，冻结） ──
const CLASSIC_SCENE_VARIANTS = {
  wide: {
    viewBox: '0 0 1520 760',
    route: [
      'M150 436',
      'C210 436 232 322 300 318',
      'C368 314 392 432 456 438',
      'C512 443 528 362 570 358',
    ].join(' '),
    trail: 'M570 358C590 351 606 342 622 333',
    trailVector: { x1: 570, y1: 358, x2: 622, y2: 333 },
    waypoints: [
      [300, 318, 4.6],
      [456, 438, 4.6],
      [516, 396, 2.2],
    ],
    start: [150, 436],
    end: [570, 358],
    endSpark: [596, 312],
    flowLines: [
      'M-30 168C150 108 330 200 520 152 710 104 880 172 1080 122',
      'M-30 252C170 210 360 286 560 240 740 200 920 258 1120 214',
      'M-30 566C160 506 350 592 550 542 740 496 920 566 1140 516',
      'M-30 664C180 624 390 694 600 650 780 614 950 664 1170 634',
    ],
    particles: [
      [90, 120, 1.6], [210, 88, 1.9], [330, 140, 1.3], [470, 96, 1.6],
      [620, 130, 1.2], [760, 180, 1.4], [70, 300, 1.3], [140, 540, 1.5],
      [60, 640, 1.7], [240, 620, 1.3], [360, 680, 1.6], [520, 640, 1.2],
      [700, 600, 1.4], [860, 540, 1.2], [980, 420, 1.3], [1080, 300, 1.2],
      [560, 240, 1.2], [420, 520, 1.1], [240, 250, 1.2], [120, 420, 1.1],
    ],
    sparks: [
      [188, 206, 3.1, 'is-teal'],
      [946, 478, 2.5, 'is-teal'],
      [712, 122, 2.3, 'is-teal'],
    ],
    blur: 7,
  },
  tall: {
    viewBox: '0 0 390 732',
    route: [
      'M352 122',
      'C312 122 298 178 252 184',
      'C206 190 190 128 144 134',
      'C100 140 82 200 62 240',
      'C54 252 48 258 46 264',
    ].join(' '),
    trail: 'M46 264C41 320 39 400 36 470',
    trailVector: { x1: 46, y1: 264, x2: 36, y2: 470 },
    waypoints: [
      [252, 184, 4],
      [144, 134, 4],
      [204, 163, 2],
    ],
    start: [352, 122],
    end: [46, 264],
    endSpark: [80, 232],
    flowLines: [
      'M-20 64C80 34 180 84 280 52 330 36 370 44 410 30',
      'M-20 372C90 340 190 396 300 362 350 346 380 352 410 342',
      'M-20 556C100 520 210 580 320 544 360 530 390 536 410 528',
      'M-20 692C110 660 220 712 330 682 370 670 395 676 415 668',
    ],
    particles: [
      [28, 36, 1.4], [88, 98, 1.8], [160, 52, 1.2], [232, 88, 1.5],
      [318, 60, 1.2], [366, 150, 1.6], [24, 200, 1.3], [120, 236, 1.1],
      [200, 300, 1.4], [330, 270, 1.2], [370, 330, 1.5], [60, 420, 1.2],
      [150, 470, 1.5], [260, 440, 1.1], [350, 500, 1.3], [100, 560, 1.2],
      [210, 610, 1.4], [320, 590, 1.1], [40, 650, 1.3], [280, 680, 1.2],
      [360, 700, 1.4],
    ],
    sparks: [
      [96, 168, 2.6, 'is-teal'],
      [330, 420, 2.2, 'is-teal'],
    ],
    blur: 5,
  },
};

// ── 循序寻踪舞台场景（已确认，冻结） ──
function ClassicRuleMark({ variant = 'wide' }) {
  const scene = CLASSIC_SCENE_VARIANTS[variant] || CLASSIC_SCENE_VARIANTS.wide;
  const id = `classic-scene-${variant}`;
  const [startX, startY] = scene.start;
  const [endX, endY] = scene.end;
  const [sparkX, sparkY] = scene.endSpark;

  return (
    <>
      <defs>
        <linearGradient id={`${id}-route`} x1="0" x2="1">
          <stop offset="0" stopColor="#55d6c1" />
          <stop offset=".5" stopColor="#a6f0e2" />
          <stop offset="1" stopColor="#70dfca" />
        </linearGradient>
        <linearGradient id={`${id}-flow-fade`} x1="0" x2="1">
          <stop offset="0" stopColor="#55d6c1" stopOpacity="0" />
          <stop offset=".12" stopColor="#55d6c1" stopOpacity="1" />
          <stop offset=".8" stopColor="#55d6c1" stopOpacity="1" />
          <stop offset=".98" stopColor="#55d6c1" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          id={`${id}-trail-fade`}
          gradientUnits="userSpaceOnUse"
          x1={scene.trailVector.x1}
          y1={scene.trailVector.y1}
          x2={scene.trailVector.x2}
          y2={scene.trailVector.y2}
        >
          <stop offset="0" stopColor="#e8c66a" stopOpacity="0" />
          <stop offset=".25" stopColor="#e8c66a" stopOpacity=".3" />
          <stop offset=".6" stopColor="#e8c66a" stopOpacity=".16" />
          <stop offset="1" stopColor="#e8c66a" stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}-soften`} x="-30%" y="-120%" width="160%" height="340%">
          <feGaussianBlur stdDeviation={scene.blur} />
        </filter>
      </defs>
      <g className="rule-mark-layer classic-scene-flow-lines">
        {scene.flowLines.map((d, index) => (
          <path key={index} d={d} stroke={`url(#${id}-flow-fade)`} />
        ))}
      </g>
      <g className="rule-mark-layer classic-scene-particles">
        {scene.particles.map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
        ))}
        {scene.sparks.map(([cx, cy, r, tone]) => (
          <path
            key={`${cx}-${cy}`}
            className={`classic-scene-spark ${tone}`}
            d={`m${cx} ${cy - r * 2} ${r} ${r * 2} ${r * 2} ${r}-${r * 2} ${r}-${r} ${r * 2}-${r}-${r * 2}-${r * 2}-${r} ${r}-${r * 2} ${r * 2}-${r}Z`}
          />
        ))}
      </g>
      <g className="rule-mark-layer rule-mark-layer-track">
        <path className="rule-mark-classic-aura" d={scene.route} pathLength="1" filter={`url(#${id}-soften)`} />
        <path className="rule-mark-chapter-track" d={scene.route} pathLength="1" />
        <path className="rule-mark-chapter-gutter" d={scene.route} pathLength="1" />
        <path className="classic-scene-trail" d={scene.trail} stroke={`url(#${id}-trail-fade)`} />
      </g>
      <g className="rule-mark-layer rule-mark-layer-route">
        <path
          className="rule-mark-primary rule-mark-chapter-route"
          d={scene.route}
          pathLength="1"
          stroke={`url(#${id}-route)`}
        />
      </g>
      <g className="rule-mark-layer classic-scene-waypoints">
        {scene.waypoints.map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} className={r < 3 ? 'is-minor' : undefined} cx={cx} cy={cy} r={r} />
        ))}
      </g>
      <g className="rule-mark-layer rule-mark-layer-terminals rule-mark-classic-start">
        <circle className="rule-mark-classic-halo" cx={startX} cy={startY} r="21" />
        <circle className="rule-mark-start-ring" cx={startX} cy={startY} r="11" />
        <circle className="rule-mark-terminal is-start" cx={startX} cy={startY} r="4.4" />
      </g>
      <g className="rule-mark-layer rule-mark-layer-terminals rule-mark-classic-end">
        <circle className="rule-mark-end-glow" cx={endX} cy={endY} r="26" />
        <circle className="rule-mark-end-ring" cx={endX} cy={endY} r="12" />
        <circle className="rule-mark-terminal is-end" cx={endX} cy={endY} r="5" />
        <path
          className="classic-scene-spark is-gold"
          d={`m${sparkX} ${sparkY - 7} 2.4 5.6 5.6 2.4-5.6 2.4-2.4 5.6-2.4-5.6-5.6-2.4 5.6-2.4Z`}
        />
      </g>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 隐迹寻踪 — 原 SVG（从 HEAD fc219b3 恢复，仅做 ID 参数化）
// ══════════════════════════════════════════════════════════════════════════════
function HiddenRuleMark({ idPrefix }) {
  const routeLeft = 'M31 75c27 0 35-40 70-40 31 0 39 31 67 39 12 4 22 1 31-6';
  const routeRight = 'M229 51c9-14 18-21 31-21 30 0 37 31 69 31 19 0 31-12 45-21';
  const p = idPrefix || 'hidden';

  return (
    <>
      <defs>
        <linearGradient id={`${p}-route-left-gradient`} x1="0" x2="1">
          <stop offset="0" stopColor="rgb(var(--level-accent))" />
          <stop offset=".66" stopColor="var(--level-accent-strong)" />
          <stop offset=".86" stopColor="rgb(var(--level-accent))" stopOpacity=".42" />
          <stop offset="1" stopColor="rgb(var(--level-accent))" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${p}-route-right-gradient`} x1="0" x2="1">
          <stop offset="0" stopColor="rgb(var(--level-accent))" stopOpacity="0" />
          <stop offset=".2" stopColor="rgb(var(--level-accent))" stopOpacity=".36" />
          <stop offset=".4" stopColor="var(--level-accent-strong)" />
          <stop offset="1" stopColor="rgb(var(--level-accent))" />
        </linearGradient>
        <linearGradient id={`${p}-field-gradient`} x1="0" x2="1">
          <stop offset="0" stopColor="rgb(var(--level-accent))" stopOpacity=".42" />
          <stop offset=".36" stopColor="rgb(var(--level-accent))" stopOpacity=".38" />
          <stop offset=".47" stopColor="rgb(var(--level-accent))" stopOpacity=".14" />
          <stop offset=".62" stopColor="rgb(var(--level-secondary))" stopOpacity=".12" />
          <stop offset=".72" stopColor="rgb(var(--level-accent))" stopOpacity=".34" />
          <stop offset="1" stopColor="rgb(var(--level-accent))" stopOpacity=".42" />
        </linearGradient>
        <linearGradient id={`${p}-left-mask-gradient`} x1="0" x2="1">
          <stop offset="0" stopColor="white" />
          <stop offset=".66" stopColor="white" />
          <stop offset=".86" stopColor="rgb(108 108 108)" />
          <stop offset="1" stopColor="black" />
        </linearGradient>
        <linearGradient id={`${p}-right-mask-gradient`} x1="0" x2="1">
          <stop offset="0" stopColor="black" />
          <stop offset=".2" stopColor="rgb(96 96 96)" />
          <stop offset=".42" stopColor="white" />
          <stop offset="1" stopColor="white" />
        </linearGradient>
        <mask id={`${p}-left-fade`} maskUnits="userSpaceOnUse" x="0" y="0" width="215" height="112">
          <rect width="215" height="112" fill={`url(#${p}-left-mask-gradient)`} />
        </mask>
        <mask id={`${p}-right-fade`} maskUnits="userSpaceOnUse" x="220" y="0" width="200" height="112">
          <rect x="220" width="200" height="112" fill={`url(#${p}-right-mask-gradient)`} />
        </mask>
        <filter id={`${p}-haze-soften`} x="-30%" y="-100%" width="160%" height="300%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      <g className="rule-mark-layer rule-mark-layer-track rule-mark-layer-hidden-field">
        <path
          className="rule-mark-field-line rule-mark-hidden-field is-upper"
          d="M8 24c59-17 103 9 162 0 68-10 132-7 242 13"
          stroke={`url(#${p}-field-gradient)`}
        />
        <path
          className="rule-mark-field-line rule-mark-hidden-field is-lower"
          d="M8 91c64-12 108 7 168-2 67-11 132-6 236 5"
          stroke={`url(#${p}-field-gradient)`}
        />
        <path
          className="rule-mark-chapter-track rule-mark-hidden-left-base"
          d={routeLeft}
          pathLength="1"
          mask={`url(#${p}-left-fade)`}
        />
        <path
          className="rule-mark-chapter-gutter rule-mark-hidden-left-base"
          d={routeLeft}
          pathLength="1"
          mask={`url(#${p}-left-fade)`}
        />
        <path
          className="rule-mark-chapter-track rule-mark-hidden-right-base"
          d={routeRight}
          pathLength="1"
          mask={`url(#${p}-right-fade)`}
        />
        <path
          className="rule-mark-chapter-gutter rule-mark-hidden-right-base"
          d={routeRight}
          pathLength="1"
          mask={`url(#${p}-right-fade)`}
        />
        <path
          className="rule-mark-hidden-haze"
          d="M164 60c21-11 43 8 67-1 17-7 31-5 45 1"
          filter={`url(#${p}-haze-soften)`}
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
          stroke={`url(#${p}-route-left-gradient)`}
          mask={`url(#${p}-left-fade)`}
        />
        <path
          className="rule-mark-primary rule-mark-chapter-route rule-mark-hidden-right-route"
          d={routeRight}
          pathLength="1"
          stroke={`url(#${p}-route-right-gradient)`}
          mask={`url(#${p}-right-fade)`}
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

// ══════════════════════════════════════════════════════════════════════════════
// 八向寻踪 — 原 SVG（从 HEAD fc219b3 恢复，仅做 ID 参数化）
// ══════════════════════════════════════════════════════════════════════════════
function DiagonalRuleMark({ idPrefix }) {
  const route = 'M31 78 108 32 177 72 177 30 285 67 374 35';
  const p = idPrefix || 'diagonal';

  return (
    <>
      <defs>
        <linearGradient id={`${p}-route-gradient`} x1="0" x2="1">
          <stop offset="0" stopColor="rgb(var(--level-accent))" />
          <stop offset=".58" stopColor="var(--level-accent-strong)" />
          <stop offset="1" stopColor="rgb(var(--level-accent))" />
        </linearGradient>
      </defs>
      <g className="rule-mark-layer rule-mark-layer-track">
        <path className="rule-mark-diagonal-field" d="m57 34 12-12" />
        <path className="rule-mark-diagonal-field" d="M237 82V67" />
        <path className="rule-mark-diagonal-field" d="m316 24 12 12" />
        <path className="rule-mark-chapter-track" d={route} pathLength="1" />
        <path className="rule-mark-chapter-gutter" d={route} pathLength="1" />
      </g>
      <g className="rule-mark-layer rule-mark-layer-route">
        <path
          className="rule-mark-primary rule-mark-chapter-route"
          d={route}
          pathLength="1"
          stroke={`url(#${p}-route-gradient)`}
        />
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

// ══════════════════════════════════════════════════════════════════════════════
// 跃迁寻踪 — 原 SVG（从 HEAD fc219b3 恢复，仅做 ID 参数化）
// ══════════════════════════════════════════════════════════════════════════════
function PortalRuleMark({ idPrefix }) {
  const p = idPrefix || 'portal';

  return (
    <>
      <defs>
        <linearGradient id={`${p}-left-route-gradient`} x1="0" x2="1">
          <stop offset="0" stopColor="rgb(var(--level-accent))" />
          <stop offset=".58" stopColor="var(--level-accent-strong)" />
          <stop offset="1" stopColor="rgb(var(--level-accent))" />
        </linearGradient>
        <linearGradient id={`${p}-right-route-gradient`} x1="0" x2="1">
          <stop offset="0" stopColor="rgb(var(--level-accent))" />
          <stop offset=".5" stopColor="var(--level-accent-strong)" />
          <stop offset="1" stopColor="rgb(var(--level-accent))" />
        </linearGradient>
      </defs>
      <g className="rule-mark-layer rule-mark-layer-track">
        <path className="rule-mark-field-line is-upper" d="M8 24c70-17 119 8 171 1 31-4 53-4 82 1 42 8 83 2 151 10" />
        <path className="rule-mark-field-line is-lower" d="M8 91c63-11 116 7 170-1 31-5 55-4 84 1 42 7 88-3 150 3" />
      </g>
      <g className="rule-mark-layer rule-mark-layer-route">
        <path
          className="rule-mark-primary rule-mark-chapter-route rule-mark-portal-left-route"
          d="M31 75c34 0 48-27 80-27 19 0 31 8 47 8"
          pathLength="1"
          stroke={`url(#${p}-left-route-gradient)`}
        />
        <path
          className="rule-mark-primary rule-mark-chapter-route rule-mark-portal-right-route"
          d="M258 56c21 0 31 5 48 5 28 0 40-11 68-21"
          pathLength="1"
          stroke={`url(#${p}-right-route-gradient)`}
        />
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

// ══════════════════════════════════════════════════════════════════════════════
// 单星谜阵 — 原 SVG（从 HEAD fc219b3 恢复，仅做 ID 参数化）
// ══════════════════════════════════════════════════════════════════════════════
function StarSingleRuleMark({ idPrefix }) {
  const p = idPrefix || 'star-single';

  return (
    <>
      <defs>
        <linearGradient id={`${p}-core-glow-gradient`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgb(var(--level-terminal-gold))" stopOpacity=".14" />
          <stop offset="1" stopColor="rgb(var(--level-terminal-gold))" stopOpacity=".04" />
        </linearGradient>
      </defs>
      <g className="rule-mark-layer rule-mark-star-network-nodes">
        <circle className="rule-mark-star-node is-muted" cx="60" cy="33" r="4.2" />
        <circle className="rule-mark-star-node" cx="84" cy="82" r="4.8" />
        <circle className="rule-mark-star-node" cx="159" cy="56" r="5.2" />
        <circle className="rule-mark-star-node" cx="318" cy="35" r="5.2" />
        <circle className="rule-mark-star-node is-muted" cx="358" cy="78" r="4.2" />
      </g>
      <g className="rule-mark-layer rule-mark-star-single-relations">
        <path
          className="rule-mark-star-relationship is-one"
          d="M60 33 159 56"
          pathLength="1"
        />
        <path
          className="rule-mark-star-relationship is-two"
          d="M84 82 159 56"
          pathLength="1"
        />
        <path
          className="rule-mark-star-relationship is-three"
          d="M318 35 358 78"
          pathLength="1"
        />
      </g>
      <g className="rule-mark-layer rule-mark-star-single-core-relations">
        <path
          className="rule-mark-star-core-link is-left"
          d="M159 56 235 51"
          pathLength="1"
        />
        <path
          className="rule-mark-star-core-link is-right"
          d="M235 51 318 35"
          pathLength="1"
        />
      </g>
      <g className="rule-mark-layer rule-mark-star-single-core">
        <circle className="rule-mark-star-core-glow" cx="235" cy="51" r="22" />
        <path
          className="rule-mark-star-core"
          d="m235 38 4 9 9 4-9 4-4 9-4-9-9-4 9-4Z"
        />
      </g>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 双星谜阵 — 原 SVG（从 HEAD fc219b3 恢复，仅做 ID 参数化）
// ══════════════════════════════════════════════════════════════════════════════
function StarDoubleRuleMark({ idPrefix }) {
  const p = idPrefix || 'star-double';

  return (
    <>
      <defs>
        <linearGradient id={`${p}-core-glow-gradient`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgb(var(--level-terminal-gold))" stopOpacity=".14" />
          <stop offset="1" stopColor="rgb(var(--level-terminal-gold))" stopOpacity=".04" />
        </linearGradient>
      </defs>
      <g className="rule-mark-layer rule-mark-star-network-nodes">
        <circle className="rule-mark-star-node is-muted" cx="55" cy="46" r="4.2" />
        <circle className="rule-mark-star-node" cx="104" cy="82" r="4.8" />
        <circle className="rule-mark-star-node is-shared" cx="221" cy="55" r="5.4" />
        <circle className="rule-mark-star-node" cx="334" cy="30" r="4.8" />
        <circle className="rule-mark-star-node is-muted" cx="374" cy="78" r="4.2" />
      </g>
      <g className="rule-mark-layer rule-mark-star-double-relations is-first">
        <path
          className="rule-mark-star-relationship is-one"
          d="M55 46 168 38"
          pathLength="1"
        />
        <path
          className="rule-mark-star-relationship is-two"
          d="M104 82 168 38"
          pathLength="1"
        />
      </g>
      <g className="rule-mark-layer rule-mark-star-double-relations is-second">
        <path
          className="rule-mark-star-relationship is-one"
          d="M278 72 334 30"
          pathLength="1"
        />
        <path
          className="rule-mark-star-relationship is-two"
          d="M278 72 374 78"
          pathLength="1"
        />
      </g>
      <g className="rule-mark-layer rule-mark-star-double-shared-relations">
        <path
          className="rule-mark-star-shared-link is-first"
          d="M168 38 221 55"
          pathLength="1"
        />
        <path
          className="rule-mark-star-shared-link is-second"
          d="M221 55 278 72"
          pathLength="1"
        />
      </g>
      <g className="rule-mark-layer rule-mark-star-double-core is-first">
        <circle className="rule-mark-star-core-glow" cx="168" cy="38" r="20" />
        <path
          className="rule-mark-star-core"
          d="m168 26 3.6 8.4 8.4 3.6-8.4 3.6-3.6 8.4-3.6-8.4-8.4-3.6 8.4-3.6Z"
        />
      </g>
      <g className="rule-mark-layer rule-mark-star-double-core is-second">
        <circle className="rule-mark-star-core-glow" cx="278" cy="72" r="20" />
        <path
          className="rule-mark-star-core"
          d="m278 60 3.6 8.4 8.4 3.6-8.4 3.6-3.6 8.4-3.6-8.4-8.4-3.6 8.4-3.6Z"
        />
      </g>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 旧版兼容标记（非六玩法模式使用原 classic 几何）
// ══════════════════════════════════════════════════════════════════════════════
function LegacyClassicRuleMark() {
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
        <path className="rule-mark-field-line is-upper" d="M8 24c66-19 109 14 172 0 64-14 124-9 232 12" />
        <path className="rule-mark-field-line is-lower" d="M8 91c70-13 117 11 181-3 66-15 131-8 223 6" />
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

// ══════════════════════════════════════════════════════════════════════════════
// 主导出组件
// ══════════════════════════════════════════════════════════════════════════════
export default function ChapterRuleMark({
  modeId,
  variant = 'wide',
  testId = 'chapter-rule-mark',
  animationCycle = 0,
  prefersReducedMotion = false,
}) {
  const STAGE_MODES = [
    'classic',
    'hidden',
    'diagonal',
    'portalClassic',
    'starSingle',
    'starDouble',
  ];
  const usesChapterAnimation = STAGE_MODES.includes(modeId);
  const usesClassicGeometry = modeId === 'classic' || ![
    'hidden',
    'diagonal',
    'portalClassic',
    'starSingle',
    'starDouble',
  ].includes(modeId);
  const isAnimating = usesChapterAnimation && animationCycle > 0 && !prefersReducedMotion;

  const isSceneVariant = variant === 'wide' || variant === 'tall';
  const idPrefix = `${modeId}-${variant}`;

  // ── 舞台场景模式（variant = 'wide' | 'tall'） ──
  if (isSceneVariant) {
    // 循序寻踪：使用已确认的 CLASSIC_SCENE_VARIANTS + ClassicRuleMark
    if (modeId === 'classic') {
      const scene = CLASSIC_SCENE_VARIANTS[variant] || CLASSIC_SCENE_VARIANTS.wide;
      return (
        <svg
          key={`${modeId}:${variant}:${animationCycle}`}
          viewBox={scene.viewBox}
          preserveAspectRatio="xMidYMid slice"
          className={isAnimating ? 'is-chapter-animating' : undefined}
          data-mode={modeId}
          data-animation-cycle={animationCycle}
          data-motion-policy={isAnimating ? 'animated' : 'static'}
          data-testid={testId}
          aria-hidden="true"
        >
          <ClassicRuleMark variant={variant} />
        </svg>
      );
    }

    // 其余五个玩法：渲染原身份标记 SVG，viewBox 保持 0 0 420 112
    // CSS 负责将 SVG 约束到舞台左侧并在右缘渐隐
    return (
      <svg
        key={`${modeId}:${variant}:${animationCycle}`}
        viewBox="0 0 420 112"
        preserveAspectRatio="xMinYMid meet"
        className={isAnimating ? 'is-chapter-animating' : undefined}
        data-mode={modeId}
        data-animation-cycle={animationCycle}
        data-motion-policy={isAnimating ? 'animated' : 'static'}
        data-testid={testId}
        aria-hidden="true"
      >
        {modeId === 'hidden' && <HiddenRuleMark idPrefix={idPrefix} />}
        {modeId === 'diagonal' && <DiagonalRuleMark idPrefix={idPrefix} />}
        {modeId === 'portalClassic' && <PortalRuleMark idPrefix={idPrefix} />}
        {modeId === 'starSingle' && <StarSingleRuleMark idPrefix={idPrefix} />}
        {modeId === 'starDouble' && <StarDoubleRuleMark idPrefix={idPrefix} />}
      </svg>
    );
  }

  // ── 身份标记模式（旧布局，variant 非 wide/tall） ──
  return (
    <svg
      key={`${modeId}:${animationCycle}`}
      viewBox={STAGE_MODES.includes(modeId) ? '0 0 420 112' : '0 0 220 68'}
      className={isAnimating ? 'is-chapter-animating' : undefined}
      data-mode={modeId}
      data-animation-cycle={animationCycle}
      data-motion-policy={isAnimating ? 'animated' : 'static'}
      data-testid="chapter-rule-mark"
      aria-hidden="true"
    >
      {usesClassicGeometry && <LegacyClassicRuleMark />}
      {modeId === 'hidden' && <HiddenRuleMark idPrefix="hidden-id" />}
      {!usesClassicGeometry && !['hidden', 'starSingle', 'starDouble'].includes(modeId) && modeId === 'diagonal' && (
        <DiagonalRuleMark idPrefix="diagonal-id" />
      )}
      {!usesClassicGeometry && !['hidden', 'starSingle', 'starDouble'].includes(modeId) && modeId === 'portalClassic' && (
        <PortalRuleMark idPrefix="portal-id" />
      )}
      {modeId === 'starSingle' && <StarSingleRuleMark idPrefix="star-single-id" />}
      {modeId === 'starDouble' && <StarDoubleRuleMark idPrefix="star-double-id" />}
    </svg>
  );
}
