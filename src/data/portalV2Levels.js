export const PORTAL_V2_LEVELS = [
  // ══════ Portal Collect (version: 2) ══════
  {
    id: 'portal2-showcase-fold',
    name: '初入传送门',
    version: 2,
    N: 7,
    start: 0,
    exit: 48,
    targets: [2, 12, 16, 30, 43],
    portals: [
      { id: 'A', cells: [20, 28] }
    ],
    obstacles: [21, 22, 23, 24, 25, 26, 27],
    targetSteps: 23,
    excellentSteps: 18
  },
  {
    id: 'portal2-showcase-choice',
    name: '先后取舍',
    version: 2,
    N: 7,
    start: 0,
    exit: 48,
    targets: [2, 13, 15, 30, 40, 43],
    portals: [
      { id: 'A', cells: [18, 32] }
    ],
    obstacles: [21, 22, 23, 24, 25, 26, 27],
    targetSteps: 27,
    excellentSteps: 22
  }
];
