// P4B 数字环线 Spike · 三态 Edge State（纯函数）
// 数据语义与视觉表现分离：视觉是渲染选择，状态是数据。

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
 * 桌面最终四模式（Line 优先于 X）：
 * - 'paint-line'：undecided / excluded → line；line 保持（左键可从 X 起手直接覆盖）
 * - 'remove-line'：仅 line → undecided；其余保持（不删除 X）
 * - 'paint-excluded'：仅 undecided → excluded；line 跳过
 * - 'remove-excluded'：仅 excluded → undecided；line 跳过
 * 强制互斥：任何模式都不得把 line 写成 excluded；X 不允许覆盖 line。
 * 任意时刻一条 Edge 只有一个状态；Undo 恢复手势前的真实状态。
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
