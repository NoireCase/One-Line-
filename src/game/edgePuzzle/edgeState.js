// Production Edge Puzzle Foundation · 三态 Edge State（纯函数）
// 供数字环线与未来方格版对称分区复用；数据语义与视觉表现分离。
// 无 React / DOM / 数字线索 / completion / storage。

export const EDGE_STATES = Object.freeze({
  undecided: 'undecided',
  line: 'line',
  excluded: 'excluded',
});

export function isValidEdgeState(state) {
  return state === EDGE_STATES.undecided
    || state === EDGE_STATES.line
    || state === EDGE_STATES.excluded;
}

/**
 * 按手势模式应用单边状态转换（返回目标状态；不做任何修改）。
 * 冻结规则（P4B 桌面实测后合同，Line 优先于 X）：
 *
 * | 当前状态 | line 通道 | excluded 通道 |
 * | --- | --- | --- |
 * | undecided | line | excluded |
 * | line | undecided | line（保持） |
 * | excluded | line（覆盖） | undecided |
 *
 * 四模式：
 * - 'paint-line'：undecided / excluded → line；line 保持（左键可从 X 起手直接覆盖）
 * - 'remove-line'：仅 line → undecided；其余保持（不删除 X）
 * - 'paint-excluded'：仅 undecided → excluded；line 跳过
 * - 'remove-excluded'：仅 excluded → undecided；line 跳过
 * 强制互斥：任何模式都不得把 line 写成 excluded；X 不允许覆盖 line。
 */
export function applyModeToState(mode, currentState) {
  switch (mode) {
    case 'paint-line':
      if (currentState === EDGE_STATES.line) return EDGE_STATES.line;
      if (currentState === EDGE_STATES.undecided || currentState === EDGE_STATES.excluded) {
        return EDGE_STATES.line;
      }
      return currentState;
    case 'remove-line':
      return currentState === EDGE_STATES.line ? EDGE_STATES.undecided : currentState;
    case 'paint-excluded':
      return currentState === EDGE_STATES.undecided ? EDGE_STATES.excluded : currentState;
    case 'remove-excluded':
      return currentState === EDGE_STATES.excluded ? EDGE_STATES.undecided : currentState;
    default:
      return currentState;
  }
}
