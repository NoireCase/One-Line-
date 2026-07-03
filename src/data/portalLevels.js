export const PORTAL_LEVELS = [
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
  },

  // ══════ Portal Classic — 5×5 Foundation (10 levels) ══════
  {
    id: 'portal-alpha-easy-cutback',
    name: '折返缺口',
    N: 5,
    targetSteps: 24,
    path: [18, 24, 19, 14, 9, 4, 3, 8, 5, 0, 1, 2, 7, 13, 12, 6, 10, 11, 15, 20, 16, 21, 17, 22, 23],
    portals: [
      { id: 'A', cells: [5, 8] }
    ],
    hiddenVals: [5, 14, 19, 24]
  },
  {
    id: 'portal-bridge',
    name: '远端桥接',
    N: 5,
    targetSteps: 24,
    path: [0, 1, 6, 5, 10, 11, 24, 23, 22, 21, 20, 15, 16, 17, 18, 19, 14, 13, 12, 7, 4, 3, 2, 8, 9],
    portals: [
      { id: 'A', cells: [11, 24] },
      { id: 'B', cells: [7, 4] }
    ],
    hiddenVals: [10, 14, 17, 23]
  },
  {
    id: 'portal-alpha-normal-cross',
    name: '双门换区',
    N: 5,
    targetSteps: 24,
    path: [11, 10, 5, 23, 24, 19, 14, 9, 4, 3, 2, 8, 13, 7, 1, 0, 6, 18, 12, 17, 22, 16, 21, 15, 20],
    portals: [
      { id: 'A', cells: [5, 23] },
      { id: 'B', cells: [18, 6] }
    ],
    hiddenVals: [7, 12, 15, 22]
  },
  {
    id: 'portal-alpha-normal-return',
    name: '远端回收',
    N: 5,
    targetSteps: 24,
    path: [9, 4, 3, 2, 15, 20, 21, 22, 16, 10, 5, 0, 1, 6, 11, 7, 8, 12, 24, 23, 17, 13, 18, 14, 19],
    portals: [
      { id: 'A', cells: [2, 15] },
      { id: 'B', cells: [24, 12] }
    ],
    hiddenVals: [8, 13, 16, 22]
  },
  {
    id: 'portal-loopback',
    name: '回环折返',
    N: 5,
    targetSteps: 24,
    path: [0, 5, 10, 11, 12, 7, 2, 3, 4, 9, 14, 13, 8, 1, 6, 15, 20, 21, 16, 17, 18, 19, 24, 23, 22],
    portals: [
      { id: 'A', cells: [8, 1] },
      { id: 'B', cells: [6, 15] }
    ],
    hiddenVals: [9, 11, 19, 24]
  },
  {
    id: 'portal-islands',
    name: '分区穿梭',
    N: 5,
    targetSteps: 24,
    path: [0, 1, 2, 3, 4, 9, 14, 19, 24, 23, 5, 10, 15, 20, 21, 22, 17, 12, 7, 6, 18, 13, 8, 11, 16],
    portals: [
      { id: 'A', cells: [23, 5] },
      { id: 'B', cells: [6, 18] },
      { id: 'C', cells: [8, 11] }
    ],
    hiddenVals: [8, 13, 18, 21]
  },
  {
    id: 'portal-alpha-hard-relay',
    name: '三段接力',
    N: 5,
    targetSteps: 24,
    path: [7, 1, 0, 19, 24, 23, 22, 21, 20, 15, 2, 3, 4, 9, 8, 17, 16, 10, 5, 11, 6, 12, 13, 18, 14],
    portals: [
      { id: 'A', cells: [8, 17] },
      { id: 'B', cells: [15, 2] },
      { id: 'C', cells: [19, 0] }
    ],
    hiddenVals: [6, 12, 18, 21, 24]
  },
  {
    id: 'portal-chain',
    name: '连续跳转',
    N: 5,
    targetSteps: 24,
    path: [20, 15, 2, 3, 4, 9, 14, 19, 0, 1, 6, 5, 10, 11, 16, 21, 22, 17, 8, 13, 18, 23, 24, 12, 7],
    portals: [
      { id: 'A', cells: [15, 2] },
      { id: 'B', cells: [19, 0] },
      { id: 'C', cells: [17, 8] },
      { id: 'D', cells: [24, 12] }
    ],
    hiddenVals: [6, 12, 16, 22]
  },
  {
    id: 'portal-easy-diag-recovery',
    name: '对角回收',
    N: 5,
    targetSteps: 24,
    path: [19, 24, 23, 22, 18, 14, 9, 4, 3, 8, 13, 17, 21, 20, 2, 1, 0, 6, 5, 11, 10, 15, 16, 12, 7],
    portals: [
      { id: 'A', cells: [20, 2] }
    ],
    hiddenVals: [2, 8, 13, 20, 24]
  },
  {
    id: 'portal-easy-double-bridge',
    name: '双桥跨越',
    N: 5,
    targetSteps: 24,
    path: [9, 4, 3, 2, 8, 14, 19, 24, 1, 0, 5, 6, 10, 21, 20, 16, 15, 11, 12, 17, 22, 23, 18, 13, 7],
    portals: [
      { id: 'A', cells: [10, 21] },
      { id: 'B', cells: [24, 1] }
    ],
    hiddenVals: [2, 6, 10, 15, 22]
  },

  // ══════ Portal Classic — Medium / Medium+ (7×7, 12 levels) ══════
  {
    id: 'portal-medium-seven-cross',
    name: '七阶跨区',
    N: 7,
    targetSteps: 48,
    path: [
      12, 6, 13, 20, 27, 19, 26, 34, 41, 48,
      47, 40, 42, 35, 36, 28, 21, 29, 5, 11,
      10, 18, 17, 24, 25, 33, 32, 39, 46, 45,
      38, 44, 43, 37, 31, 30, 22, 14, 7, 0,
      1, 2, 8, 15, 23, 16, 9, 3, 4
    ],
    portals: [
      { id: 'A', cells: [40, 42] },
      { id: 'B', cells: [29, 5] }
    ],
    hiddenVals: [5, 11, 20, 25, 30, 35, 40, 45]
  },
  {
    id: 'portal-medium-seven-base',
    name: '底部启程',
    N: 7,
    targetSteps: 48,
    path: [39,47,46,45,44,18,11,4,3,10,17,16,9,2,8,15,22,30,23,6,5,12,19,25,24,31,32,38,37,43,42,35,36,28,29,21,14,7,0,1,40,48,41,34,33,27,26,20,13],
    portals: [
      { id: 'A', cells: [1, 40] },
      { id: 'B', cells: [44, 18] },
      { id: 'C', cells: [23, 6] }
    ],
    hiddenVals: [4, 12, 17, 21, 30, 36, 42, 47]
  },
  {
    id: 'portal-medium-seven-relay',
    name: '三区折跃',
    N: 7,
    targetSteps: 48,
    path: [
      12, 6, 13, 20, 27, 19, 26, 34, 41, 48,
      47, 40, 42, 35, 36, 28, 21, 29, 3, 4,
      5, 11, 10, 18, 7, 0, 1, 2, 8, 15,
      23, 16, 9, 17, 24, 25, 33, 32, 39, 46,
      45, 38, 44, 43, 37, 31, 30, 22, 14
    ],
    portals: [
      { id: 'A', cells: [40, 42] },
      { id: 'B', cells: [29, 3] },
      { id: 'C', cells: [18, 7] }
    ],
    hiddenVals: [5, 11, 17, 23, 28, 34, 42, 47]
  },
  {
    id: 'portal-medium-seven-leap',
    name: '对角跃迁',
    N: 7,
    targetSteps: 48,
    path: [
      9, 1, 0, 7, 8, 14, 21, 15, 33, 39,
      38, 30, 23, 31, 32, 24, 35, 42, 43, 44,
      13, 6, 5, 4, 12, 19, 26, 25, 18, 17,
      11, 3, 2, 10, 16, 22, 28, 36, 29, 37,
      45, 46, 47, 48, 41, 40, 34, 27, 20
    ],
    portals: [
      { id: 'A', cells: [15, 33] },
      { id: 'B', cells: [24, 35] },
      { id: 'C', cells: [44, 13] }
    ],
    hiddenVals: [7, 13, 18, 23, 28, 33, 38, 45]
  },
  {
    id: 'portal-medium-seven-scatter',
    name: '空间散射',
    N: 7,
    targetSteps: 48,
    path: [12,6,13,20,27,7,0,1,2,46,45,38,44,43,42,35,36,28,21,29,37,11,10,18,17,24,25,19,26,34,41,48,47,40,33,32,39,31,30,22,14,8,15,23,16,9,3,4,5],
    portals: [
      { id: 'A', cells: [27, 7] },
      { id: 'B', cells: [2, 46] },
      { id: 'C', cells: [37, 11] }
    ],
    hiddenVals: [2, 7, 12, 23, 28, 33, 38, 44]
  },
  {
    id: 'portal-medium-seven-topleft',
    name: '左上散射',
    N: 7,
    targetSteps: 48,
    path: [9,1,2,3,4,30,37,44,45,38,31,32,39,46,40,33,26,18,25,42,43,36,29,23,24,17,16,10,11,5,6,13,12,20,19,27,34,41,48,47,8,0,7,14,15,21,22,28,35],
    portals: [
      { id: 'A', cells: [47, 8] },
      { id: 'B', cells: [4, 30] },
      { id: 'C', cells: [25, 42] }
    ],
    hiddenVals: [3, 8, 13, 18, 25, 30, 39, 45]
  },
  {
    id: 'portal-medium-seven-veil',
    name: '散射帷幕',
    N: 7,
    targetSteps: 48,
    path: [12,6,13,20,27,7,0,1,2,46,45,38,44,43,42,35,36,28,21,29,37,18,17,24,25,19,26,34,41,48,47,40,33,32,39,31,30,22,14,8,15,23,16,9,3,4,5,11,10],
    portals: [
      { id: 'A', cells: [27, 7] },
      { id: 'B', cells: [2, 46] },
      { id: 'C', cells: [37, 18] }
    ],
    hiddenVals: [2, 7, 12, 18, 23, 30, 35, 42]
  },
  {
    id: 'portal-medium-seven-reclaim',
    name: '纵深回收',
    N: 7,
    targetSteps: 48,
    path: [13,6,5,4,12,20,27,19,11,3,48,47,40,46,45,39,16,23,30,22,21,29,28,35,36,37,31,24,17,9,1,2,10,18,26,34,41,33,25,32,38,44,43,42,0,7,8,14,15],
    portals: [
      { id: 'A', cells: [42, 0] },
      { id: 'B', cells: [3, 48] },
      { id: 'C', cells: [39, 16] }
    ],
    hiddenVals: [6, 12, 18, 23, 29, 37, 42, 46]
  },
  {
    id: 'portal-medium-seven-center',
    name: '中心启程',
    N: 7,
    targetSteps: 48,
    path: [29,35,28,21,14,32,33,34,27,26,25,18,19,20,12,11,10,16,17,48,41,40,39,31,24,23,30,22,15,7,0,1,8,2,9,3,4,5,6,13,36,42,43,44,37,45,38,46,47],
    portals: [
      { id: 'A', cells: [13, 36] },
      { id: 'B', cells: [14, 32] },
      { id: 'C', cells: [17, 48] }
    ],
    hiddenVals: [7, 12, 18, 25, 30, 35, 42, 47]
  },
  {
    id: 'portal-medium-seven-dual-diag',
    name: '双大对角',
    N: 7,
    targetSteps: 48,
    path: [13,6,5,4,12,20,27,19,11,3,48,47,40,46,45,39,33,0,7,8,14,15,16,23,30,22,21,29,28,35,36,37,31,25,32,38,44,43,42,24,17,9,1,2,10,18,26,34,41],
    portals: [
      { id: 'A', cells: [42, 24] },
      { id: 'B', cells: [33, 0] },
      { id: 'C', cells: [3, 48] }
    ],
    hiddenVals: [6, 12, 24, 25, 29, 35, 41, 48]
  },
  {
    id: 'portal-medium-seven-longjump',
    name: '超长跳板',
    N: 7,
    targetSteps: 48,
    path: [4,5,6,13,20,42,35,28,36,37,29,21,11,3,10,2,1,0,7,14,22,30,38,39,33,26,32,8,15,9,17,16,23,24,31,25,18,12,19,27,34,41,48,47,40,46,45,44,43],
    portals: [
      { id: 'A', cells: [32, 8] },
      { id: 'B', cells: [21, 11] },
      { id: 'C', cells: [20, 42] }
    ],
    hiddenVals: [3, 8, 14, 20, 29, 38, 43, 48]
  },
  {
    id: 'portal-medium-seven-midscatter',
    name: '中段散射',
    N: 7,
    targetSteps: 48,
    path: [13,6,5,4,12,20,27,19,11,3,45,39,33,0,7,8,14,15,16,23,30,22,21,29,28,35,36,37,31,25,32,38,44,43,42,24,17,9,1,2,10,18,26,34,41,48,47,40,46],
    portals: [
      { id: 'A', cells: [42, 24] },
      { id: 'B', cells: [33, 0] },
      { id: 'C', cells: [3, 45] }
    ],
    hiddenVals: [6, 12, 19, 25, 30, 37, 42, 48]
  }
];
