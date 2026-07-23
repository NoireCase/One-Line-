/**
 * Star Double 第一关教学契约。
 *
 * 教学只示范基础规则，随后让玩家练习一次，再开放整盘自主解题。
 * actionCells 只用于验证操作；只有 revealAction 为 true 时才显示答案格。
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
    id: 'observe-opening-region',
    type: 'explain',
    copy: '看右上星域：右侧 2×2 最多只能放 1 颗星。',
    observationCells: [6, 7, 13, 14, 15],
    buttonLabel: '开始判断',
  },
  {
    id: 'find-opening-star',
    type: 'place-stars',
    copy: '这个星域需要 2 颗星，自己找出一定能放星的那一格。',
    observationCells: [6, 7, 13, 14, 15],
    actionCells: [13],
    revealAction: false,
  },
  {
    id: 'mark-eight-neighbors',
    type: 'eliminate',
    copy: '看刚放的星：把周围全部八格标成 X。',
    evidenceCells: [13],
    actionSource: 'forced-star-neighbors',
    revealAction: true,
    pointerSource: 'forced-star-neighbors',
    gesture: 'tap',
  },
  {
    id: 'independent-practice',
    type: 'eliminate',
    copy: '看左上两组 2×2：自己找出被挤掉的那一格并标 X。',
    observationCells: [0, 1, 2, 3, 8, 9, 10, 11],
    actionCells: [9],
    revealAction: false,
  },
  {
    id: 'independent-solve',
    type: 'autonomous',
    copy: '现在由你完成整关；卡住时可以逐级查看提示。',
  },
];

export const STAR_LINE_DOUBLE_TUTORIAL_CONTRACT = deepFreeze({
  levelId: 'star-lv-21',
  boardSize: 8,
  quota: 2,
  forcedStar: 13,
  capacityRegion: [6, 7, 13, 14, 15],
  capacityBlock: [6, 7, 14, 15],
  practiceCell: 9,
  practiceObservation: [0, 1, 2, 3, 8, 9, 10, 11],
  steps: STEPS,
});

export function resolveStarLineDoubleTutorialCells(step, kind) {
  if (!step) return [];
  const source = kind === 'actions'
    ? step.actionSource
    : kind === 'pointers'
      ? step.pointerSource
      : null;
  if (source === 'forced-star-neighbors') {
    return getEightNeighbors(
      STAR_LINE_DOUBLE_TUTORIAL_CONTRACT.forcedStar,
      STAR_LINE_DOUBLE_TUTORIAL_CONTRACT.boardSize,
    );
  }
  if (kind === 'actions') return [...(step.actionCells || [])];
  if (kind === 'observation') return [...(step.observationCells || [])];
  if (kind === 'evidence') return [...(step.evidenceCells || [])];
  if (kind === 'pointers') return [];
  return [];
}
