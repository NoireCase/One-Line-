import React from 'react';

/**
 * One Line 按钮图标：内联折线 + 首尾节点，表达“按序连成一条路径”。
 * 采用 currentColor，与 Star Line 按钮的 lucide 图标同级（24 视口 / stroke 2 / 圆角）。
 */
export function OneLinePathIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 15 L9 8 L14 13 L20 6" />
      <circle cx="4" cy="15" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="20" cy="6" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function HomePathMark({ animated = false } = {}) {
  const nodes = [
    [56, 118, 1],
    [108, 60, 2],
    [160, 104, 3],
    [212, 52, 4],
    [264, 100, 5]
  ];
  // 整条 1→5 路线（底路）+ 4 段拆分（供逐段点亮动画）
  const fullPath = 'M56 118 C86 118 82 60 108 60 C136 60 132 104 160 104 C190 104 186 52 212 52 C240 52 236 100 264 100';
  const segments = [
    'M56 118 C86 118 82 60 108 60',
    'M108 60 C136 60 132 104 160 104',
    'M160 104 C190 104 186 52 212 52',
    'M212 52 C240 52 236 100 264 100'
  ];
  return (
    <svg viewBox="0 0 320 170" className="oneline-home-mark w-full h-auto" aria-hidden="true">
      {/* 柔光晕 —— 提供视觉中心与体积感（animated 时渐显） */}
      <ellipse cx="160" cy="88" rx="118" ry="56" className={`sketch-halo${animated ? ' oneline-animated-halo' : ''}`} />
      {/* 棋盘点阵底纹 —— 呼应“一笔连完整个棋盘”，弱化处理不抢路径 */}
      {Array.from({ length: 6 }).flatMap((_, col) =>
        Array.from({ length: 4 }).map((_, row) => (
          <circle
            key={`grid-${col}-${row}`}
            cx={40 + col * 48}
            cy={44 + row * 30}
            r="1.7"
            className="sketch-grid-dot"
          />
        ))
      )}
      {/* 未点亮底路 */}
      <path d={fullPath} className={`oneline-track${animated ? ' oneline-animated-track' : ''}`} />
      {/* 亮线段：animated 时 1→5 逐段依次绘制，否则整条静止呈现 */}
      {segments.map((d, i) => (
        <path
          key={`seg-${i}`}
          d={d}
          pathLength="1"
          className={`sketch-path${animated ? ' oneline-animated-line' : ''}`}
          style={animated ? { '--seg-delay': `${320 + i * 150}ms` } : undefined}
        />
      ))}
      {/* 节点（animated 时逐个点亮）；起点 / 终点环（animated 时收尾脉冲） */}
      {nodes.map(([cx, cy, value], i) => {
        const isStart = value === 1;
        const isEnd = value === 5;
        return (
          <g key={value}>
            {isStart && (
              <circle
                cx={cx}
                cy={cy}
                r="18"
                className={`sketch-start-ring${animated ? ' oneline-animated-ring' : ''}`}
                style={animated ? { '--ring-delay': '300ms' } : undefined}
              />
            )}
            {isEnd && (
              <circle
                cx={cx}
                cy={cy}
                r="18.5"
                className={`sketch-end-ring${animated ? ' oneline-animated-ring' : ''}`}
                style={animated ? { '--ring-delay': '1250ms' } : undefined}
              />
            )}
            <circle
              cx={cx}
              cy={cy}
              r="13"
              className={`sketch-node${animated ? ' oneline-animated-node' : ''}${isStart ? ' sketch-node-start' : ''}${isEnd ? ' sketch-node-end' : ''}`}
              style={animated ? { '--node-delay': `${240 + i * 210}ms` } : undefined}
            />
            <text x={cx} y={cy + 4} textAnchor="middle" className="sketch-number">{value}</text>
          </g>
        );
      })}
      <circle cx="286" cy="42" r="2" className="night-star" />
      <circle cx="40" cy="38" r="1.5" className="night-star" />
      <circle cx="160" cy="16" r="1.4" className="night-star" />
      <path d="M292 132 l4 7 l7 4 l-7 4 l-4 7 l-4-7 l-7-4 l7-4 z" className="night-spark" />
    </svg>
  );
}

export function ClassicPathMark() {
  return (
    <svg viewBox="0 0 180 86" className="mode-mark mode-mark-classic w-full h-full" aria-hidden="true">
      <path d="M18 60 C38 60 40 25 64 25 S92 64 116 64 S139 27 162 27" className="mode-line mode-line-classic" />
      {[[18,60,'1'],[64,25,'2'],[116,64,'3'],[162,27,'4']].map(([cx, cy, n]) => (
        <g key={n}>
          <circle cx={cx} cy={cy} r="8" className="mode-node mode-node-classic" />
          <text x={cx} y={cy + 3} textAnchor="middle" className="mode-node-label">{n}</text>
        </g>
      ))}
    </svg>
  );
}

export function DiagonalPathMark() {
  return (
    <svg viewBox="0 0 180 86" className="mode-mark mode-mark-diagonal w-full h-full" aria-hidden="true">
      <path d="M24 64 L65 23 L106 64 L153 17" className="mode-line mode-line-diagonal" />
      <path d="M24 22 L65 63 M106 22 L153 63" className="diagonal-guide" />
      {[[24,64],[65,23],[106,64],[153,17]].map(([cx, cy]) => (
        <rect key={`${cx}-${cy}`} x={cx - 6} y={cy - 6} width="12" height="12" rx="2.5" className="mode-node mode-node-diagonal" />
      ))}
    </svg>
  );
}

export function PortalPathMark() {
  return (
    <svg viewBox="0 0 180 86" className="mode-mark mode-mark-portal w-full h-full" aria-hidden="true">
      <path d="M16 58 C36 58 42 42 58 42" className="mode-line mode-line-portal" />
      <path d="M122 42 C139 42 143 25 164 25" className="mode-line mode-line-portal" />
      <path d="M71 26 C83 13 97 13 109 26" className="portal-jump" />
      <ellipse cx="65" cy="42" rx="10" ry="24" className="portal-ring" />
      <ellipse cx="115" cy="42" rx="10" ry="24" className="portal-ring" />
      <circle cx="16" cy="58" r="6" className="mode-node mode-node-portal" />
      <circle cx="164" cy="25" r="6" className="mode-node mode-node-portal" />
    </svg>
  );
}

export function HiddenPathMark() {
  return (
    <svg viewBox="0 0 180 86" className="mode-mark mode-mark-hidden w-full h-full" aria-hidden="true">
      <path d="M18 62 C42 62 39 22 66 22" className="mode-line mode-line-hidden-visible" />
      <path d="M66 22 C91 22 91 64 116 64" className="mode-line mode-line-hidden" />
      <path d="M116 64 C140 64 140 27 163 27" className="mode-line mode-line-hidden-visible" />
      <rect x="70" y="11" width="42" height="64" rx="14" className="hidden-veil" />
      {[[18,62,'1'],[66,22,'?'],[116,64,'?'],[163,27,'9']].map(([cx, cy, n]) => (
        <g key={`${cx}-${n}`}>
          <circle cx={cx} cy={cy} r="8" className="mode-node mode-node-hidden" />
          <text x={cx} y={cy + 3} textAnchor="middle" className="sketch-number-hidden">{n}</text>
        </g>
      ))}
    </svg>
  );
}

export function StarSingleMark() {
  return (
    <svg viewBox="0 0 180 86" className="mode-mark mode-mark-star-single w-full h-full" aria-hidden="true">
      <rect x="28" y="15" width="124" height="56" rx="13" className="star-mode-field star-mode-field-single" />
      <path d="M69 15 V71 M111 15 V71 M28 43 H152" className="star-mode-grid" />
      <path d="M90 27 l4.3 8.7 9.7 1.4-7 6.8 1.7 9.6-8.7-4.6-8.7 4.6 1.7-9.6-7-6.8 9.7-1.4z" className="star-mode-star star-mode-star-single" />
      <circle cx="90" cy="43" r="20" className="star-mode-orbit star-mode-orbit-single" />
    </svg>
  );
}

export function StarDoubleMark() {
  return (
    <svg viewBox="0 0 180 86" className="mode-mark mode-mark-star-double w-full h-full" aria-hidden="true">
      <path d="M27 20 H153 V66 H27 Z M90 20 V66" className="star-mode-field star-mode-field-double" />
      <path d="M67 27 l3.6 7.2 8 1.2-5.8 5.6 1.4 8-7.2-3.8-7.2 3.8 1.4-8-5.8-5.6 8-1.2z" className="star-mode-star star-mode-star-double" />
      <path d="M113 37 l3.6 7.2 8 1.2-5.8 5.6 1.4 8-7.2-3.8-7.2 3.8 1.4-8-5.8-5.6 8-1.2z" className="star-mode-star star-mode-star-double" />
      <path d="M78 35 C88 27 99 30 105 42" className="star-mode-pair-link" />
    </svg>
  );
}

export function RewardTrail() {
  return (
    <svg viewBox="0 0 220 42" className="w-full h-10" aria-hidden="true">
      <path d="M14 24 C52 5 74 37 108 20 S164 10 206 23" className="reward-trail" />
      <circle cx="14" cy="24" r="4" className="reward-dot" />
      <circle cx="108" cy="20" r="4" className="reward-dot" />
      <circle cx="206" cy="23" r="4" className="reward-dot" />
    </svg>
  );
}

export function StarLineMark({ animated = false } = {}) {
  const nodes = [
    [34, 24],
    [84, 20],
    [126, 34],
    [148, 62],
    [72, 66]
  ];
  const lines = [
    'M34 24 L84 20',
    'M84 20 L126 34',
    'M126 34 L148 62',
    'M72 66 L148 62',
    'M34 24 L72 66',
    'M72 66 L84 20'
  ];

  return (
    <svg viewBox="0 0 180 86" className={`w-full h-full ${animated ? 'starline-home-mark' : ''}`} aria-hidden="true">
      <g className={animated ? 'starline-network' : ''}>
        <path d="M34 24 L84 20 L126 34 L148 62 L72 66 Z" className={`starline-field ${animated ? 'starline-animated-field' : ''}`} />
        {lines.map((d, index) => (
          <path
            key={d}
            d={d}
            pathLength="1"
            className={`mode-line mode-line-starline ${animated ? 'starline-animated-line' : ''}`}
            style={{ '--line-delay': `${360 + index * 95}ms` }}
          />
        ))}
      </g>
      {nodes.map(([cx, cy], index) => (
        <g key={`${cx}-${cy}`}>
          <circle
            cx={cx}
            cy={cy}
            r={index === 1 ? 7 : 6.5}
            className={`mode-node mode-node-starline ${animated ? 'starline-animated-node' : ''}`}
            style={{ '--node-delay': `${220 + index * 90}ms` }}
          />
          {index === 1 || index === 3 ? (
            <circle
              cx={cx}
              cy={cy}
              r="2.4"
              className={`starline-pin ${animated ? 'starline-animated-pin' : ''}`}
              style={{ '--pin-delay': `${980 + (index === 3 ? 150 : 0)}ms` }}
            />
          ) : null}
        </g>
      ))}
    </svg>
  );
}

export function BrokenTrail() {
  return (
    <svg viewBox="0 0 220 54" className="w-full h-12" aria-hidden="true">
      <path d="M18 30 C48 13 67 40 91 27" className="broken-trail" />
      <path d="M130 28 C157 10 178 36 204 22" className="broken-trail" />
      <circle cx="18" cy="30" r="4" className="broken-dot" />
      <circle cx="204" cy="22" r="4" className="broken-dot" />
      <path d="M106 20 l7 7 l-7 7 M121 20 l-7 7 l7 7" className="broken-mark" />
    </svg>
  );
}
