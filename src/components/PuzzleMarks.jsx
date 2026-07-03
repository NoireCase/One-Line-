import React from 'react';

export function HomePathMark() {
  return (
    <svg viewBox="0 0 320 170" className="w-full h-auto" aria-hidden="true">
      <path
        d="M24 113 C52 113 48 55 86 55 C119 55 112 134 151 134 C190 134 176 35 220 35 C258 35 252 105 296 105"
        className="sketch-path-shadow"
      />
      <path
        d="M24 113 C52 113 48 55 86 55 C119 55 112 134 151 134 C190 134 176 35 220 35 C258 35 252 105 296 105"
        className="sketch-path"
      />
      {[
        [24, 113, 1],
        [86, 55, 2],
        [151, 134, 3],
        [220, 35, 4],
        [296, 105, 5]
      ].map(([cx, cy, value]) => (
        <g key={value}>
          <circle cx={cx} cy={cy} r="13" className="sketch-node" />
          <text x={cx} y={cy + 4} textAnchor="middle" className="sketch-number">{value}</text>
        </g>
      ))}
      <circle cx="270" cy="45" r="2" className="night-star" />
      <circle cx="46" cy="40" r="1.5" className="night-star" />
      <circle cx="185" cy="18" r="1.4" className="night-star" />
      <path d="M282 135 l4 7 l7 4 l-7 4 l-4 7 l-4-7 l-7-4 l7-4 z" className="night-spark" />
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
