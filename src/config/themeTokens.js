export const T = {
  bg: {
    base: '#080B11',
    soft: '#0D1219',
  },
  board: {
    surface: '#0D1219',
    border: 'rgba(255,255,255,0.07)',
  },
  cell: {
    idle: 'rgba(255,255,255,0.035)',
    idleBorder: 'rgba(255,255,255,0.07)',
    hidden: 'rgba(255,255,255,0.02)',
    hiddenBorder: 'rgba(255,255,255,0.045)',
    path: 'rgba(45,212,191,0.10)',
    pathBorder: 'rgba(45,212,191,0.32)',
    head: 'rgba(45,212,191,0.15)',
    headBorder: 'rgba(94,234,212,0.62)',
    portal: 'rgba(139,92,246,0.10)',
    portalBorder: 'rgba(139,92,246,0.34)',
    portalActive: 'rgba(139,92,246,0.18)',
    portalActiveBorder: 'rgba(167,139,250,0.58)',
    hint: 'rgba(59,130,246,0.14)',
    hintBorder: 'rgba(96,165,250,0.48)',
    error: 'rgba(244,63,94,0.18)',
    errorBorder: 'rgba(251,113,133,0.52)',
  },
  path: {
    line: '#46B8AA',
    glow: 'rgba(45,212,191,0.16)',
  },
  portal: {
    main: '#7C6BB3',
    glow: 'rgba(139,92,246,0.18)',
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
    ...extra,
  }
}
