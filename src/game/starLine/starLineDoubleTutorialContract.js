/**
 * Star Double 第一关教学契约。
 *
 * 教学只绑定正式关卡 star-lv-21。右上星域需要 2 颗星，其中
 * 4 个候选格落在同一 2×2 内、最多容纳 1 颗，因此剩余格 13
 * 必须是星。玩家先标记它的八邻格，再亲手放下这颗确定星。
 */

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

export const STAR_LINE_DOUBLE_TUTORIAL_CONTRACT = deepFreeze({
  levelId: 'star-lv-21',
  boardSize: 8,
  quota: 2,
  capacityRegion: [6, 7, 13, 14, 15],
  capacityBlock: [6, 7, 14, 15],
  forcedStar: 13,
  adjacencyNeighbors: [4, 5, 6, 12, 14, 20, 21, 22],
  adjacencyDemoPaths: [[4, 5, 6], [20, 21, 22]],
});
