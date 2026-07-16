/**
 * Star Line 第一关教学契约 — 固定操作与规则教学目标索引。
 *
 * star-lv-01 与新手教学强绑定：教学文案、演示路径和推进判定
 * 都依赖这里列出的固定索引。本模块为纯数据定义，React 组件、
 * 教学 hook 与 scripts/test-star-line-tutorial-contract.mjs
 * 共同导入同一份定义，杜绝多源复制。
 *
 * 修改 star-lv-01 关卡数据或本契约时，必须同步更新教学配置
 * 并重新进行人工验收。
 */

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

export const STAR_LINE_TUTORIAL_CONTRACT = deepFreeze({
  levelId: 'star-lv-01',
  boardSize: 5,
  quota: 1,
  // 放星顺序 = 第一关唯一解（教学按此顺序引导玩家双击放星）
  starOrder: [1, 8, 10, 17, 24],
  // 教学文案中的"绿色星域"（索引 8 所在 region 的全部格子）
  greenRegion: [2, 3, 4, 7, 8, 9, 12, 13, 14],
  // 四步基础操作教学
  operation: {
    tapX: 0,
    addDragPath: [2, 3, 4],
    clearDragPath: [4, 3, 2],
    firstStar: 1,
  },
  // 规则教学（行 → 列 → 星域 → 相邻 → 完成第一关）
  rules: {
    firstRowHighlight: [0, 1, 2, 3, 4],
    firstRowDoneX: [0, 2, 3, 4],
    firstRowDemoPath: [2, 3, 4],
    starColumnHighlight: [1, 6, 11, 16, 21],
    starColumnDoneX: [6, 11, 16, 21],
    secondStar: 8,
    greenRegionDoneX: [2, 3, 4, 7, 9, 12, 13, 14],
    greenRegionDemoPaths: [[12, 13, 14], [7, 8, 9]],
    adjacencyHighlight: [2, 3, 4, 7, 8, 9, 12, 13, 14],
    adjacencyNeighbors: [2, 3, 4, 7, 9, 12, 13, 14],
    thirdStar: 10,
    thirdColumnHighlight: [0, 5, 10, 15, 20],
    thirdColumnDoneX: [5, 15, 20],
    thirdColumnDemoPath: [5, 10, 15, 20],
    fourthStar: 17,
    tailDoneX: [18, 19, 22, 23],
    tailDemoPaths: [[18, 19], [22, 23]],
    finalStar: 24,
  },
});
