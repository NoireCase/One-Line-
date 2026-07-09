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
    <svg viewBox="0 0 180 86" className="w-full h-full" aria-hidden="true">
      <path d="M18 61 C40 61 38 24 64 24 S87 66 112 66 S132 29 162 29" className="mode-line mode-line-classic" />
      {[18, 64, 112, 162].map((cx, index) => (
        <circle key={cx} cx={cx} cy={[61, 24, 66, 29][index]} r="7" className="mode-node mode-node-classic" />
      ))}
    </svg>
  );
}

export function DiagonalPathMark() {
  return (
    <svg viewBox="0 0 180 86" className="w-full h-full" aria-hidden="true">
      <path d="M22 64 L58 28 L94 64 L130 28 L158 56" className="mode-line mode-line-diagonal" />
      {[
        [22, 64],
        [58, 28],
        [94, 64],
        [130, 28],
        [158, 56]
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="6.5" className="mode-node mode-node-diagonal" />
      ))}
    </svg>
  );
}

export function PortalPathMark() {
  return (
    <svg viewBox="0 0 180 86" className="w-full h-full" aria-hidden="true">
      <path d="M18 56 C42 56 42 31 64 31" className="mode-line mode-line-portal" />
      <path d="M116 56 C137 56 139 30 162 30" className="mode-line mode-line-portal" />
      <path d="M72 43 C84 57 96 57 108 43" className="portal-jump" />
      <ellipse cx="68" cy="40" rx="12" ry="22" className="portal-ring" />
      <ellipse cx="112" cy="40" rx="12" ry="22" className="portal-ring" />
      <circle cx="18" cy="56" r="6" className="mode-node mode-node-portal" />
      <circle cx="162" cy="30" r="6" className="mode-node mode-node-portal" />
    </svg>
  );
}

export function HiddenPathMark() {
  return (
    <svg viewBox="0 0 180 86" className="w-full h-full" aria-hidden="true">
      {/* 5 anchor nodes — scattered key points */}
      <circle cx="18" cy="68" r="7" className="mode-node mode-node-hidden" />
      <circle cx="66" cy="22" r="7" className="mode-node mode-node-hidden" />
      <circle cx="94" cy="62" r="7" className="mode-node mode-node-hidden" />
      <circle cx="134" cy="26" r="7" className="mode-node mode-node-hidden" />
      <circle cx="162" cy="58" r="7" className="mode-node mode-node-hidden" />
      {/* Dashed segments between anchors — implying unknown path */}
      <path d="M18 68 Q42 56 66 22" className="mode-line mode-line-hidden" />
      <path d="M66 22 Q82 42 94 62" className="mode-line mode-line-hidden" />
      <path d="M94 62 Q114 44 134 26" className="mode-line mode-line-hidden" />
      <path d="M134 26 Q148 44 162 58" className="mode-line mode-line-hidden" />
      {/* Faint dots at key number positions */}
      <text x="18" y="72" textAnchor="middle" className="sketch-number-hidden">1</text>
      <text x="162" y="62" textAnchor="middle" className="sketch-number-hidden">25</text>
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
