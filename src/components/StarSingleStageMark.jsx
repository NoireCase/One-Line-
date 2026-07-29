export default function StarSingleStageMark({
  animationCycle = 0,
  prefersReducedMotion = false,
  testId = 'star-single-stage-mark',
}) {
  const isAnimating = animationCycle > 0 && !prefersReducedMotion;
  const ambientLineId = `star-single-stage-ambient-line-${animationCycle}`;
  const ambientFieldId = `star-single-stage-ambient-field-${animationCycle}`;
  const coreFieldId = `star-single-stage-core-field-${animationCycle}`;
  const coreBloomId = `star-single-stage-core-bloom-${animationCycle}`;

  return (
    <svg
      key={`star-single-stage:${animationCycle}`}
      viewBox="0 0 1520 760"
      preserveAspectRatio="xMidYMid slice"
      className={`star-single-stage-mark${isAnimating ? ' is-chapter-animating' : ''}`}
      data-mode="starSingle"
      data-animation-cycle={animationCycle}
      data-motion-policy={isAnimating ? 'animated' : 'static'}
      data-testid={testId}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={ambientLineId} x1="0" x2="1">
          <stop offset="0" stopColor="#8B72D9" stopOpacity=".135" />
          <stop offset=".09" stopColor="#A087F0" stopOpacity=".65" />
          <stop offset=".38" stopColor="#A087F0" stopOpacity=".78" />
          <stop offset=".64" stopColor="#8971D1" stopOpacity=".4" />
          <stop offset=".82" stopColor="#7E6ABD" stopOpacity=".11" />
          <stop offset="1" stopColor="#665793" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={ambientFieldId}>
          <stop offset="0" stopColor="#9479DC" stopOpacity=".045" />
          <stop offset=".46" stopColor="#7359B6" stopOpacity=".018" />
          <stop offset="1" stopColor="#4A367E" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={coreFieldId}>
          <stop offset="0" stopColor="#F0E9FF" stopOpacity=".31" />
          <stop offset=".17" stopColor="#C6AEF7" stopOpacity=".145" />
          <stop offset=".44" stopColor="#9274DA" stopOpacity=".07" />
          <stop offset=".72" stopColor="#674DA4" stopOpacity=".024" />
          <stop offset="1" stopColor="#3B2A68" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={coreBloomId}>
          <stop offset="0" stopColor="#F8F3FF" stopOpacity=".26" />
          <stop offset=".24" stopColor="#D7C5FF" stopOpacity=".15" />
          <stop offset=".64" stopColor="#9479DE" stopOpacity=".048" />
          <stop offset="1" stopColor="#8B72D9" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse
        className="star-single-stage-ambient-field"
        cx="430"
        cy="360"
        rx="620"
        ry="340"
        fill={`url(#${ambientFieldId})`}
        stroke="none"
      />

      <g className="star-single-stage-ambient-lines" fill="none" strokeLinecap="round">
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
          opacity=".76"
        />
      </g>

      <ellipse
        className="star-single-stage-core-field"
        cx="380"
        cy="355"
        rx="470"
        ry="360"
        fill={`url(#${coreFieldId})`}
        stroke="none"
      />
      <ellipse
        className="star-single-stage-core-bloom"
        cx="380"
        cy="355"
        rx="220"
        ry="198"
        fill={`url(#${coreBloomId})`}
        stroke="none"
      />

      <g className="star-single-stage-dust" fill="rgba(226,216,255,.68)" stroke="none">
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
      <g className="star-single-stage-glints" fill="none" stroke="rgba(222,211,255,.68)" strokeWidth=".8">
        <path d="m124 276 3.5 7.2 7.2 3.5-7.2 3.5-3.5 7.2-3.5-7.2-7.2-3.5 7.2-3.5Z" />
        <path d="m542 137 3 6.1 6.1 3-6.1 3-3 6.1-3-6.1-6.1-3 6.1-3Z" />
        <path d="m1016 624 2.4 4.9 4.9 2.4-4.9 2.4-2.4 4.9-2.4-4.9-4.9-2.4 4.9-2.4Z" opacity=".55" />
      </g>

      <g className="star-single-stage-node-halos" stroke="none">
        <circle cx="270" cy="180" r="17" />
        <circle cx="314" cy="280" r="15" />
        <circle cx="230" cy="375" r="16" />
        <circle cx="450" cy="330" r="15" />
        <circle cx="540" cy="280" r="17" />
        <circle cx="462" cy="465" r="15" />
        <circle cx="515" cy="445" r="16" />
        <circle cx="615" cy="505" r="17" />
      </g>

      <g className="rule-mark-layer rule-mark-star-network-nodes star-single-stage-nodes">
        <circle className="rule-mark-star-node is-stage-peripheral" cx="270" cy="180" r="8.4" />
        <circle className="rule-mark-star-node" cx="314" cy="280" r="7.5" />
        <circle className="rule-mark-star-node" cx="230" cy="375" r="7.2" />
        <circle className="rule-mark-star-node" cx="450" cy="330" r="7.2" />
        <circle className="rule-mark-star-node is-stage-peripheral" cx="540" cy="280" r="8" />
        <circle className="rule-mark-star-node" cx="462" cy="465" r="7.1" />
        <circle className="rule-mark-star-node" cx="515" cy="445" r="7.5" />
        <circle className="rule-mark-star-node is-stage-peripheral" cx="615" cy="505" r="7.6" />
      </g>

      <g className="rule-mark-layer star-single-stage-outer-relations">
        <path className="rule-mark-star-relationship is-one" d="M270 180 314 280" pathLength="1" />
        <path className="rule-mark-star-relationship is-one" d="M314 280 230 375" pathLength="1" />
        <path className="rule-mark-star-relationship is-two" d="M314 280 450 330" pathLength="1" />
        <path className="rule-mark-star-relationship is-two" d="M450 330 540 280" pathLength="1" />
        <path className="rule-mark-star-relationship is-three" d="M462 465 515 445" pathLength="1" />
        <path className="rule-mark-star-relationship is-three" d="M515 445 615 505" pathLength="1" />
      </g>

      <g className="rule-mark-layer star-single-stage-core-relations">
        <path className="rule-mark-star-core-link is-left" d="M230 375 380 355" pathLength="1" />
        <path className="rule-mark-star-core-link is-left" d="M314 280 380 355" pathLength="1" />
        <path className="rule-mark-star-core-link is-right" d="M380 355 450 330" pathLength="1" />
        <path className="rule-mark-star-core-link is-right" d="M380 355 462 465" pathLength="1" />
      </g>

      <g className="rule-mark-layer rule-mark-star-single-core">
        <circle className="rule-mark-star-core-glow" cx="380" cy="355" r="62" />
        <path
          className="rule-mark-star-core"
          d="m380 325 8.5 21.5 21.5 8.5-21.5 8.5-8.5 21.5-8.5-21.5-21.5-8.5 21.5-8.5Z"
        />
      </g>
    </svg>
  );
}
