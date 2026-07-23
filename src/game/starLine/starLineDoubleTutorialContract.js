/**
 * Star Double 第一关完整教学契约。
 *
 * 每个操作批次都对应 star-lv-21 在当前盘面状态下可成立的
 * human-logic deduction event。说明步骤只负责讲解；玩家操作或
 * “演示排除”完成后，教学才会进入下一步。
 */

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

export function getEightNeighbors(cell, boardSize) {
  if (!Number.isInteger(cell) || !Number.isInteger(boardSize)
      || boardSize < 1 || cell < 0 || cell >= boardSize * boardSize) {
    return [];
  }

  const row = Math.floor(cell / boardSize);
  const col = cell % boardSize;
  const neighbors = [];
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) continue;
      const nextRow = row + rowOffset;
      const nextCol = col + colOffset;
      if (nextRow >= 0 && nextRow < boardSize && nextCol >= 0 && nextCol < boardSize) {
        neighbors.push(nextRow * boardSize + nextCol);
      }
    }
  }
  return neighbors.sort((a, b) => a - b);
}

const STEPS = [
  {
    id: 'quota-explanation',
    phase: 'foundation',
    type: 'explain',
    copy: '看任一行、列或星域：每组都必须恰好放 2 颗星。',
    targets: [0, 1, 2, 3, 4, 5, 6, 7],
  },
  {
    id: 'opening-capacity-explanation',
    phase: 'foundation',
    type: 'explain',
    copy: '看右上星域：右侧 2×2 最多放 1 星，所以左下格必为星。',
    targets: [6, 7, 13, 14, 15],
  },
  {
    id: 'opening-star',
    phase: 'foundation',
    type: 'place-stars',
    copy: '双击高亮格，放下这颗由容量确定的星。',
    targets: [13],
    actionCells: [13],
    gesture: 'double-tap',
  },
  {
    id: 'adjacency-explanation',
    phase: 'adjacency',
    type: 'explain',
    copy: '看这颗星周围：八个相邻格都不能再放星。',
    targetSource: 'forced-star-neighbors',
  },
  {
    id: 'adjacency-action',
    phase: 'adjacency',
    type: 'eliminate',
    copy: '看星周围：这些格相邻不能放星，单击全部标成 X。',
    targetSource: 'forced-star-neighbors',
    actionSource: 'forced-star-neighbors',
    pointerSource: 'forced-star-neighbors',
    gesture: 'tap',
  },
  {
    id: 'opening-propagation-explanation',
    phase: 'opening-propagation',
    type: 'explain',
    copy: '看上方几组：2×2 容量继续排除这些候选格。',
    targets: [8, 9, 10, 16, 26, 28],
  },
  {
    id: 'opening-propagation-demo',
    phase: 'opening-propagation',
    type: 'demo-eliminate',
    copy: '看高亮格：它们都由 2×2 容量排除，点击演示标记。',
    targets: [8, 9, 10, 16, 26, 28],
    actionCells: [8, 9, 10, 16, 26, 28],
  },
  {
    id: 'pressured-opening-explanation',
    phase: 'pressured-group',
    type: 'explain',
    copy: '看左侧星域：两组相邻候选各最多 1 星，单格因此被锁定。',
    targets: [17, 24, 25, 35, 37, 43, 45, 51, 53, 59, 61],
  },
  {
    id: 'pressured-opening-demo',
    phase: 'pressured-group',
    type: 'demo-eliminate',
    copy: '看高亮格：分组容量已占满，点击演示排除其余候选。',
    targets: [24, 25, 35, 37, 43, 45, 51, 53, 59, 61],
    actionCells: [24, 25, 35, 37, 43, 45, 51, 53, 59, 61],
  },
  {
    id: 'pressured-opening-star',
    phase: 'pressured-group',
    type: 'place-stars',
    copy: '双击高亮格：两组容量都已占满，它必须是星。',
    targets: [17],
    actionCells: [17],
    gesture: 'double-tap',
  },
  {
    id: 'multi-unit-explanation',
    phase: 'multi-unit',
    type: 'explain',
    copy: '看中部行与星域：总配额相等，外侧候选可以排除。',
    targets: [2, 18, 29, 30, 36, 38, 39, 41, 54, 55],
  },
  {
    id: 'multi-unit-demo',
    phase: 'multi-unit',
    type: 'demo-eliminate',
    copy: '看高亮格：行列与星域共同排除它们，点击演示标记。',
    targets: [2, 18, 30, 36, 38, 39, 41, 54, 55],
    actionCells: [2, 18, 30, 36, 38, 39, 41, 54, 55],
  },
  {
    id: 'remaining-capacity-star',
    phase: 'multi-unit',
    type: 'place-stars',
    copy: '看第 4 行：只剩足够容纳两星的位置，双击高亮格。',
    targets: [29],
    actionCells: [29],
    gesture: 'double-tap',
  },
  {
    id: 'midgame-explanation',
    phase: 'convergence',
    type: 'explain',
    copy: '看中下部：行、列与星域的剩余容量开始连续传播。',
    targets: [27, 32, 33, 34, 40, 42, 44, 46, 47, 49, 52, 57, 60, 62, 63],
  },
  {
    id: 'midgame-demo',
    phase: 'convergence',
    type: 'demo-eliminate',
    copy: '看高亮格：容量被限制在交叠单位内，点击演示排除。',
    targets: [27, 33, 40, 42, 47, 49, 52, 57, 63],
    actionCells: [27, 33, 40, 42, 47, 49, 52, 57, 63],
  },
  {
    id: 'midgame-stars',
    phase: 'convergence',
    type: 'place-stars',
    copy: '看高亮格：这一轮容量已确定，双击全部放星。',
    targets: [32, 34, 44, 46, 60, 62],
    actionCells: [32, 34, 44, 46, 60, 62],
    gesture: 'double-tap',
  },
  {
    id: 'saturation-explanation',
    phase: 'convergence',
    type: 'explain',
    copy: '看已满配额的行列：其余格排除，剩余容量锁定下一组星。',
    targets: [0, 1, 3, 11, 19, 23, 31, 48, 50, 56, 58],
  },
  {
    id: 'saturation-demo',
    phase: 'convergence',
    type: 'demo-eliminate',
    copy: '看高亮格：配额已满或被限制，点击演示排除。',
    targets: [0, 11, 23, 56, 58],
    actionCells: [0, 11, 23, 56, 58],
  },
  {
    id: 'convergence-stars',
    phase: 'convergence',
    type: 'place-stars',
    copy: '看高亮格：剩余容量已经锁定，双击全部放星。',
    targets: [1, 3, 19, 31, 48, 50],
    actionCells: [1, 3, 19, 31, 48, 50],
    gesture: 'double-tap',
  },
  {
    id: 'final-explanation',
    phase: 'finish',
    type: 'explain',
    copy: '看最后一行：配额排除最后候选，星域只剩一格。',
    targets: [7, 15],
  },
  {
    id: 'final-demo',
    phase: 'finish',
    type: 'demo-eliminate',
    copy: '看高亮格：这一列已满 2 星，点击演示排除。',
    targets: [7],
    actionCells: [7],
  },
  {
    id: 'final-star',
    phase: 'finish',
    type: 'place-stars',
    copy: '看最后高亮格：星域只剩它，双击完成谜阵。',
    targets: [15],
    actionCells: [15],
    gesture: 'double-tap',
  },
];

export const STAR_LINE_DOUBLE_TUTORIAL_CONTRACT = deepFreeze({
  levelId: 'star-lv-21',
  boardSize: 8,
  quota: 2,
  forcedStar: 13,
  capacityRegion: [6, 7, 13, 14, 15],
  capacityBlock: [6, 7, 14, 15],
  phaseCount: 7,
  steps: STEPS,
});

export function resolveStarLineDoubleTutorialCells(step, kind = 'targets') {
  if (!step) return [];
  const source = kind === 'actions' ? step.actionSource : step.targetSource;
  if (source === 'forced-star-neighbors') {
    return getEightNeighbors(
      STAR_LINE_DOUBLE_TUTORIAL_CONTRACT.forcedStar,
      STAR_LINE_DOUBLE_TUTORIAL_CONTRACT.boardSize,
    );
  }
  return [...(kind === 'actions' ? step.actionCells || [] : step.targets || [])];
}
