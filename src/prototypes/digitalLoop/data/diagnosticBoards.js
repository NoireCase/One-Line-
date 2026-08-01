// P4B 数字环线 Spike · 诊断场景数据（diagnostic / scenario / fixture / prototype data）
// 这些不是正式关卡：不进入 src/data/，不参与任何正式目录、难度或结算体系。
// clues 为 n×n 二维数组，null 表示无线索格。

function emptyClues(n) {
  return Array.from({ length: n }, () => Array(n).fill(null));
}

function withClues(n, entries) {
  const clues = emptyClues(n);
  for (const { row, col, clue } of entries) clues[row][col] = clue;
  return clues;
}

// 2×2 格块环（块左上角 (r,c)）：8 条边，块内 4 格每格周边恰 2 条 line。
function blockLoopKeys(r, c) {
  return [
    `h:${r}:${c}`, `h:${r}:${c + 1}`,
    `h:${r + 2}:${c}`, `h:${r + 2}:${c + 1}`,
    `v:${r}:${c}`, `v:${r + 1}:${c}`,
    `v:${r}:${c + 2}`, `v:${r + 1}:${c + 2}`,
  ];
}

// N×N 棋盘外框环：20 条边（N=5）。
function outerFrameKeys(n) {
  const keys = [];
  for (let col = 0; col < n; col += 1) {
    keys.push(`h:0:${col}`);
    keys.push(`h:${n}:${col}`);
  }
  for (let row = 0; row < n; row += 1) {
    keys.push(`v:${row}:0`);
    keys.push(`v:${row}:${n}`);
  }
  return keys;
}

export const DIAGNOSTIC_BOARDS = [
  {
    id: 'single-click-undo',
    name: '1 · 单边点击与撤销',
    description: '点击单边添加 line；Undo 一次回滚单边；连续点击产生独立 undo step。',
    n: 5,
    clues: null,
    lineKeys: [],
    excludedKeys: [],
  },
  {
    id: 'straight-drag',
    name: '2 · 连续直线拖动',
    description: '从 undecided 边开始拖动画一条直线；同边同手势只修改一次。',
    n: 5,
    clues: null,
    lineKeys: [],
    excludedKeys: [],
  },
  {
    id: 'corner-drag',
    name: '3 · 直角转弯拖动',
    description: '横边→竖边拐弯；验证顶点死区与交汇处归属。',
    n: 5,
    clues: null,
    lineKeys: [],
    excludedKeys: [],
  },
  {
    id: 'branch-create',
    name: '4 · 创建分支',
    description: '初始三线汇聚一个顶点（degree=3），结构诊断报告 Branch。',
    n: 5,
    clues: null,
    lineKeys: ['h:2:1', 'h:2:2', 'v:1:2'],
    excludedKeys: [],
  },
  {
    id: 'two-loops',
    name: '5 · 两个独立环',
    description: '初始两个闭合方环，结构诊断报告 Multiple Loops；擦除部分线可观察环+断链。',
    n: 7,
    clues: null,
    lineKeys: [
      ...blockLoopKeys(1, 1),
      ...blockLoopKeys(4, 4),
    ],
    excludedKeys: [],
  },
  {
    id: 'single-loop-no-clue',
    name: '6 · 无数字单环结构',
    description: '初始完整外框单环、无线索；无数字线索，本场景仅验证结构，不得判定完成。',
    n: 5,
    clues: emptyClues(5),
    lineKeys: outerFrameKeys(5),
    excludedKeys: [],
  },
  {
    id: 'clue-zero-excluded',
    name: '7 · 数字 0 与 excluded',
    description: '中心格线索 0；两邻边初始 excluded；需要把四边全部排除后线索满足。X/excluded 只是玩家的排除标记，不参与线索计数（线索只统计 line 边）。',
    n: 5,
    clues: withClues(5, [{ row: 2, col: 2, clue: 0 }]),
    lineKeys: [],
    excludedKeys: ['h:2:2', 'v:2:2'],
  },
  {
    id: 'clue-one-two',
    name: '8 · 数字 1 与 2 局部线索',
    description: '三格线索 1/2/1；观察少于、等于、超限三种线索状态。',
    n: 5,
    clues: withClues(5, [
      { row: 1, col: 1, clue: 1 },
      { row: 1, col: 2, clue: 2 },
      { row: 2, col: 2, clue: 1 },
    ]),
    lineKeys: [],
    excludedKeys: [],
  },
  {
    id: 'clue-over',
    name: '9 · 数字周边超限冲突',
    description: '中心格线索 1，但初始已有两条邻边为 line，立即 over 冲突。',
    n: 5,
    clues: withClues(5, [{ row: 2, col: 2, clue: 1 }]),
    lineKeys: ['h:2:2', 'v:2:2'],
    excludedKeys: [],
  },
  {
    id: 'all-satisfied-two-loops',
    name: '10 · 数字全满足但双环',
    description: '两个环的 8 格线索全部满足，但结构为 Multiple Loops，不得完成。',
    n: 7,
    clues: withClues(7, [
      { row: 1, col: 1, clue: 2 }, { row: 1, col: 2, clue: 2 },
      { row: 2, col: 1, clue: 2 }, { row: 2, col: 2, clue: 2 },
      { row: 4, col: 4, clue: 2 }, { row: 4, col: 5, clue: 2 },
      { row: 5, col: 4, clue: 2 }, { row: 5, col: 5, clue: 2 },
    ]),
    lineKeys: [
      ...blockLoopKeys(1, 1),
      ...blockLoopKeys(4, 4),
    ],
    excludedKeys: [],
  },
  {
    id: 'single-loop-clue-unmet',
    name: '11 · 单环成立但线索未满足',
    description: '外框单环成立，但中心格线索 1 周边 0 条 line，不得完成。',
    n: 5,
    clues: withClues(5, [{ row: 2, col: 2, clue: 1 }]),
    lineKeys: outerFrameKeys(5),
    excludedKeys: [],
  },
  {
    id: 'pressure-10',
    name: '12 · 10×10 压力棋盘',
    description: '10×10（220 条边）：一个闭合环 + 一条开放链 + 线索；验证密集命中与性能。',
    n: 10,
    clues: withClues(10, [
      { row: 2, col: 2, clue: 2 }, { row: 2, col: 3, clue: 2 },
      { row: 3, col: 2, clue: 2 }, { row: 3, col: 3, clue: 2 },
      { row: 6, col: 3, clue: 1 },
    ]),
    lineKeys: [
      ...blockLoopKeys(2, 2),
      'h:6:2', 'h:6:3', 'h:6:4',
    ],
    excludedKeys: [],
  },
  {
    id: 'pressure-11',
    name: '13 · 11×11 压力棋盘',
    description: '11×11（264 条边）：最大边数棋盘；验证密集命中、性能与 390×844 视口。',
    n: 11,
    clues: withClues(11, [
      { row: 3, col: 3, clue: 2 }, { row: 3, col: 4, clue: 2 },
      { row: 4, col: 3, clue: 2 }, { row: 4, col: 4, clue: 2 },
      { row: 7, col: 4, clue: 2 },
    ]),
    lineKeys: [
      ...blockLoopKeys(3, 3),
      'h:7:2', 'h:7:3', 'h:7:4', 'h:7:5', 'h:7:6',
      'v:8:4', 'v:9:4',
    ],
    excludedKeys: [],
  },
  {
    id: 'single-loop-clue-ok',
    name: '14 · 单环且数字满足（完成正例）',
    description: '初始 1×1 环 + 中心格数字 4（四边全 line 满足）：Closed Single Loop ∧ 有数字 ∧ 全部满足 → 显示完成状态。',
    n: 3,
    clues: withClues(3, [{ row: 1, col: 1, clue: 4 }]),
    lineKeys: ['h:1:1', 'v:1:1', 'h:2:1', 'v:1:2'],
    excludedKeys: [],
  },
];
