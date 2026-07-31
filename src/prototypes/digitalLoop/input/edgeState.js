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
 * 模式语义（桌面双通道直接输入）：
 * - 'add'：仅 undecided → line（左键加线）
 * - 'remove-line'：仅 line → undecided（左键删线）
 * - 'add-excluded'：仅 undecided → excluded（右键加 X）
 * - 'remove-excluded'：仅 excluded → undecided（右键删 X）
 * - 'excluded-toggle'：undecided ↔ excluded（方案 B X 工具点按通道）
 * 强制互斥：任何模式都不得把 line 写成 excluded，也不得把 excluded 写成 line。
 * 状态转换只能经过 原状态 → undecided → 新状态。
 */
export function applyModeToState(mode, currentState) {
  switch (mode) {
    case 'add':
      return currentState === EDGE_STATES.undecided ? EDGE_STATES.line : currentState;
    case 'remove-line':
      return currentState === EDGE_STATES.line ? EDGE_STATES.undecided : currentState;
    case 'add-excluded':
      return currentState === EDGE_STATES.undecided ? EDGE_STATES.excluded : currentState;
    case 'remove-excluded':
      return currentState === EDGE_STATES.excluded ? EDGE_STATES.undecided : currentState;
    case 'excluded-toggle':
      if (currentState === EDGE_STATES.undecided) return EDGE_STATES.excluded;
      if (currentState === EDGE_STATES.excluded) return EDGE_STATES.undecided;
      return currentState; // line 不参与 excluded 切换
    default:
      return currentState;
  }
}
