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
 * 模式语义：
 * - 'add'：仅 undecided → line；其余状态保持不变
 * - 'erase'：仅 line → undecided；其余状态保持不变
 * - 'excluded-toggle'：undecided ↔ excluded（仅用于点按/长按等独立输入通道）
 * 任何模式都不得把 line 写成 excluded，也不得把 excluded 写成 line。
 */
export function applyModeToState(mode, currentState) {
  if (mode === 'add') {
    return currentState === EDGE_STATES.undecided ? EDGE_STATES.line : currentState;
  }
  if (mode === 'erase') {
    return currentState === EDGE_STATES.line ? EDGE_STATES.undecided : currentState;
  }
  if (mode === 'excluded-toggle') {
    if (currentState === EDGE_STATES.undecided) return EDGE_STATES.excluded;
    if (currentState === EDGE_STATES.excluded) return EDGE_STATES.undecided;
    return currentState; // line 不参与 excluded 切换
  }
  return currentState;
}
