export default function StarDoubleStageMark({
  animationCycle = 0,
  prefersReducedMotion = false,
  testId = 'star-double-stage-mark',
}) {
  const isAnimating = animationCycle > 0 && !prefersReducedMotion;
  const ambientLineId = `star-double-stage-ambient-line-${animationCycle}`;
  const ambientFieldId = `star-double-stage-ambient-field-${animationCycle}`;
  const sharedFieldId = `star-double-stage-shared-field-${animationCycle}`;
  const sharedBloomId = `star-double-stage-shared-bloom-${animationCycle}`;

  return (
    <svg
      key={`star-double-stage:${animationCycle}`}
      viewBox="0 0 1520 760"
      preserveAspectRatio="xMidYMid slice"
      className={`star-double-stage-mark${isAnimating ? ' is-chapter-animating' : ''}`}
      data-mode="starDouble"
      data-animation-cycle={animationCycle}
      data-motion-policy={isAnimating ? 'animated' : 'static'}
      data-testid={testId}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={ambientLineId} x1="0" x2="1">
          <stop offset="0" stopColor="#B65784" stopOpacity=".12" />
          <stop offset=".09" stopColor="#D478A4" stopOpacity=".58" />
          <stop offset=".38" stopColor="#D478A4" stopOpacity=".7" />
          <stop offset=".64" stopColor="#B45C88" stopOpacity=".36" />
          <stop offset=".82" stopColor="#955070" stopOpacity=".1" />
          <stop offset="1" stopColor="#71425A" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={ambientFieldId}>
          <stop offset="0" stopColor="#B35D87" stopOpacity=".04" />
          <stop offset=".46" stopColor="#8D456A" stopOpacity=".016" />
          <stop offset="1" stopColor="#582B47" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={sharedFieldId}>
          <stop offset="0" stopColor="#F7E7F0" stopOpacity=".235" />
          <stop offset=".17" stopColor="#E4A7C3" stopOpacity=".13" />
          <stop offset=".45" stopColor="#B75D8C" stopOpacity=".062" />
          <stop offset=".72" stopColor="#7D3F62" stopOpacity=".022" />
          <stop offset="1" stopColor="#4B263B" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={sharedBloomId}>
          <stop offset="0" stopColor="#FFF3F8" stopOpacity=".21" />
          <stop offset=".24" stopColor="#F2C1D7" stopOpacity=".13" />
          <stop offset=".64" stopColor="#C45B8E" stopOpacity=".04" />
          <stop offset="1" stopColor="#C45B8E" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse
        className="star-double-stage-ambient-field"
        cx="430"
        cy="365"
        rx="630"
        ry="345"
        fill={`url(#${ambientFieldId})`}
        stroke="none"
      />

      <g className="star-double-stage-ambient-lines" fill="none" strokeLinecap="round">
        <path
          d="M-70 130C125 72 320 95 505 152C690 208 815 117 1005 100C1190 83 1325 178 1590 126"
          stroke={`url(#${ambientLineId})`}
          strokeWidth="1.12"
        />
        <path
          d="M-70 252C105 188 292 200 482 264C674 329 820 240 1008 230C1190 220 1368 314 1590 258"
          stroke={`url(#${ambientLineId})`}
          strokeWidth="1.38"
        />
        <path
          d="M-70 407C118 338 302 356 494 422C680 486 822 390 1022 388C1220 386 1382 484 1590 430"
          stroke={`url(#${ambientLineId})`}
          strokeWidth="1.22"
        />
        <path
          d="M-70 535C126 474 305 516 510 582C710 647 864 552 1055 540C1248 528 1395 626 1590 572"
          stroke={`url(#${ambientLineId})`}
          strokeWidth=".98"
          opacity=".74"
        />
      </g>

      <ellipse
        className="star-double-stage-shared-field"
        cx="307"
        cy="365"
        rx="500"
        ry="370"
        fill={`url(#${sharedFieldId})`}
        stroke="none"
      />
      <ellipse
        className="star-double-stage-shared-bloom"
        cx="307"
        cy="365"
        rx="285"
        ry="215"
        fill={`url(#${sharedBloomId})`}
        stroke="none"
      />

      <g className="star-double-stage-dust" fill="rgba(242,215,228,.6)" stroke="none">
        <circle cx="112" cy="86" r="1.5" />
        <circle cx="218" cy="176" r="1.8" />
        <circle cx="395" cy="98" r="1.9" />
        <circle cx="548" cy="188" r="1.2" />
        <circle cx="694" cy="132" r="1.35" />
        <circle cx="842" cy="182" r="1.05" />
        <circle cx="1016" cy="114" r="1.45" />
        <circle cx="1188" cy="228" r="1" />
        <circle cx="1370" cy="126" r=".9" />
        <circle cx="94" cy="440" r="1.15" />
        <circle cx="214" cy="582" r="1.35" />
        <circle cx="354" cy="648" r="1.6" />
        <circle cx="520" cy="610" r="1.15" />
        <circle cx="668" cy="588" r="1.8" />
        <circle cx="824" cy="654" r="1.05" />
        <circle cx="982" cy="606" r="1.25" />
        <circle cx="1180" cy="652" r=".9" />
        <circle cx="1388" cy="574" r="1.1" />
      </g>
      <g className="star-double-stage-glints" fill="none" stroke="rgba(247,213,229,.62)" strokeWidth=".8">
        <path d="m124 276 3.5 7.2 7.2 3.5-7.2 3.5-3.5 7.2-3.5-7.2-7.2-3.5 7.2-3.5Z" />
        <path d="m542 137 3 6.1 6.1 3-6.1 3-3 6.1-3-6.1-6.1-3 6.1-3Z" />
        <path d="m1016 624 2.4 4.9 4.9 2.4-4.9 2.4-2.4 4.9-2.4-4.9-4.9-2.4 4.9-2.4Z" opacity=".52" />
      </g>

      <g className="star-double-stage-foreground" transform="translate(-108 0)">
        <g className="star-double-stage-node-halos" stroke="none">
          <circle cx="190" cy="240" r="17" />
          <circle cx="270" cy="280" r="15" />
          <circle cx="220" cy="420" r="16" />
          <circle className="is-shared" cx="405" cy="265" r="18" />
          <circle className="is-shared" cx="420" cy="465" r="18" />
          <circle cx="585" cy="290" r="15" />
          <circle cx="680" cy="240" r="17" />
          <circle cx="620" cy="500" r="17" />
        </g>

        <g className="rule-mark-layer rule-mark-star-network-nodes star-double-stage-nodes">
          <circle className="rule-mark-star-node is-stage-peripheral" cx="190" cy="240" r="8" />
          <circle className="rule-mark-star-node" cx="270" cy="280" r="7.4" />
          <circle className="rule-mark-star-node" cx="220" cy="420" r="7.2" />
          <circle className="rule-mark-star-node is-shared" cx="405" cy="265" r="8" />
          <circle className="rule-mark-star-node is-shared" cx="420" cy="465" r="7.8" />
          <circle className="rule-mark-star-node" cx="585" cy="290" r="7.4" />
          <circle className="rule-mark-star-node is-stage-peripheral" cx="680" cy="240" r="8" />
          <circle className="rule-mark-star-node is-stage-peripheral" cx="620" cy="500" r="7.8" />
        </g>

        <g className="rule-mark-layer rule-mark-star-double-relations is-first star-double-stage-left-relations">
          <path className="rule-mark-star-relationship is-one" d="M190 240 270 280" pathLength="1" />
          <path className="rule-mark-star-relationship is-one" d="M270 280 405 265" pathLength="1" />
          <path className="rule-mark-star-relationship is-two" d="M270 280 330 350" pathLength="1" />
          <path className="rule-mark-star-relationship is-two" d="M220 420 330 350" pathLength="1" />
        </g>

        <g className="rule-mark-layer rule-mark-star-double-relations is-second star-double-stage-right-relations">
          <path className="rule-mark-star-relationship is-one" d="M500 385 585 290" pathLength="1" />
          <path className="rule-mark-star-relationship is-one" d="M420 465 620 500" pathLength="1" />
          <path className="rule-mark-star-relationship is-two" d="M585 290 680 240" pathLength="1" />
          <path className="rule-mark-star-relationship is-two" d="M500 385 620 500" pathLength="1" />
        </g>

        <g className="rule-mark-layer rule-mark-star-double-shared-relations star-double-stage-shared-relations">
          <path className="rule-mark-star-shared-link is-first" d="M405 265 330 350" pathLength="1" />
          <path className="rule-mark-star-shared-link is-first" d="M405 265 500 385" pathLength="1" />
          <path className="rule-mark-star-shared-link is-second" d="M330 350 420 465" pathLength="1" />
          <path className="rule-mark-star-shared-link is-second" d="M420 465 500 385" pathLength="1" />
        </g>

        <g className="rule-mark-layer rule-mark-star-double-core is-first">
          <circle className="rule-mark-star-core-glow" cx="330" cy="350" r="58" />
          <path
            className="rule-mark-star-core"
            d="m330 323 7.8 19.2 19.2 7.8-19.2 7.8-7.8 19.2-7.8-19.2-19.2-7.8 19.2-7.8Z"
          />
        </g>
        <g className="rule-mark-layer rule-mark-star-double-core is-second">
          <circle className="rule-mark-star-core-glow" cx="500" cy="385" r="58" />
          <path
            className="rule-mark-star-core"
            d="m500 358 7.8 19.2 19.2 7.8-19.2 7.8-7.8 19.2-7.8-19.2-19.2-7.8 19.2-7.8Z"
          />
        </g>
      </g>
    </svg>
  );
}
