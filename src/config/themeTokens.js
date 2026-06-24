export const T = {
  bg: {
    base: '#070B14',
    soft: '#0B1020',
  },
  board: {
    surface: 'rgba(15,23,42,0.65)',
    border: 'rgba(255,255,255,0.08)',
  },
  cell: {
    idle: 'rgba(255,255,255,0.04)',
    idleBorder: 'rgba(255,255,255,0.08)',
    hidden: 'rgba(255,255,255,0.06)',
    hiddenBorder: 'rgba(255,255,255,0.05)',
    path: 'rgba(45,212,191,0.14)',
    pathBorder: 'rgba(45,212,191,0.45)',
    head: 'rgba(103,232,249,0.20)',
    headBorder: 'rgba(103,232,249,0.80)',
    portal: 'rgba(139,92,246,0.16)',
    portalBorder: 'rgba(139,92,246,0.55)',
    portalActive: 'rgba(139,92,246,0.28)',
    portalActiveBorder: 'rgba(167,139,250,0.75)',
    hint: 'rgba(59,130,246,0.22)',
    hintBorder: 'rgba(96,165,250,0.70)',
    error: 'rgba(244,63,94,0.30)',
    errorBorder: 'rgba(251,113,133,0.70)',
  },
  path: {
    line: '#2DD4BF',
    glow: 'rgba(45,212,191,0.35)',
  },
  portal: {
    main: '#8B5CF6',
    glow: 'rgba(139,92,246,0.40)',
  },
  error: {
    main: '#F43F5E',
  },
  reward: {
    star: '#FBBF24',
  },
}

// Generate inline style for cell backgrounds
export function cellStyle(bgColor, borderColor, extra = {}) {
  return {
    background: bgColor,
    border: `1px solid ${borderColor}`,
    backdropFilter: 'blur(4px)',
    ...extra,
  }
}
