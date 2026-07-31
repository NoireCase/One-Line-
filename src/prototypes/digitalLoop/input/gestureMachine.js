// P4B 数字环线 Spike · Pointer 手势状态机（纯逻辑，无 DOM / 无 React）
// 事件输入为 board-local 坐标点（宿主负责 viewport → board-local 转换）。
//
// 核心合同：
// 1. 一次 pointerdown → pointerup 只产生一个 undo step（一个 transaction）。
// 2. 同一 edge 在同一手势内最多修改一次（visited 去重）。
// 3. pointercancel / 窗口失焦必须回滚本次全部未提交变更。
// 4. 拖动由连续 pointermove 流驱动；禁止 click 合成拖动（由宿主保证不合成）。
// 5. 手势结果由数据坐标决定，不由 render 顺序决定。
//
// 点按语义（明确规则）：
// - 点按（down → up 无有效移动）在 add 模式且起点为 undecided 时添加单边 line；
// - 点按在 erase 模式时不产生变更（防止「点击已有 line 意外擦除」）；
// - 拖动（移动 ≥ DRAG_MOVE_THRESHOLD）从起点开始应用。

import { EDGE_STATES, applyModeToState, isValidEdgeState } from './edgeState.js';
import { hitTestEdge } from './hitTesting.js';

export const SCHEMES = Object.freeze({ a: 'a', b: 'b', c: 'c' });
export const TOOLS = Object.freeze({ line: 'line', excluded: 'excluded', erase: 'erase' });

// 判定「开始拖动」的移动阈值（viewBox 域像素，候选值）
export const DRAG_MOVE_THRESHOLD = 5;
// 方案 C 长按阈值（毫秒，候选值；不宣称最终冻结）
export const LONG_PRESS_MS = 450;

function createIdleGesture() {
  return {
    active: false,
    pointerId: null,
    startLocal: null,
    lastLocal: null,
    startKey: null,
    mode: null,
    moved: false,
    startApplied: false,
    visited: new Set(),
    changes: [],
  };
}

/**
 * 创建手势控制器。宿主通过回调接入状态与 undo。
 *
 * @param {object} opts
 * @param {object} opts.layout computeBoardLayout 输出（含 n）
 * @param {(key: string) => string} opts.getEdgeState
 * @param {(key: string, from: string, to: string) => void} opts.applyChange 立即应用单边变更
 * @param {(changes: Array, meta: object) => void} opts.onGestureCommit 手势结束，宿主 push undo
 * @param {() => void} opts.onGestureCancel 手势取消回滚完成，宿主清理 pending
 * @param {(key: string, pointerId: number) => void} opts.onLongPressArmed 宿主启动长按计时器（scheme c）
 * @param {() => void} opts.onLongPressCancelled 宿主取消长按计时器
 * @param {string} opts.scheme 'a' | 'b' | 'c'
 * @param {string} opts.tool 方案 B 当前工具
 */
export function createGestureController({
  layout,
  getEdgeState,
  applyChange,
  onGestureCommit,
  onGestureCancel,
  onLongPressArmed,
  onLongPressCancelled,
  scheme = SCHEMES.a,
  tool = TOOLS.line,
}) {
  const gesture = createIdleGesture();

  const setScheme = (next) => { scheme = next; };
  const setTool = (next) => { tool = next; };

  const reset = () => {
    gesture.active = false;
    gesture.visited = new Set();
    gesture.changes = [];
    gesture.moved = false;
    gesture.startKey = null;
    gesture.mode = null;
    gesture.startApplied = false;
    gesture.pointerId = null;
  };

  const recordChange = (key, from, to) => {
    if (to === from) return false;
    gesture.changes.push({ key, from, to });
    applyChange(key, from, to);
    return true;
  };

  const toggleExcludedSingle = (key) => {
    if (!key) return null;
    const from = getEdgeState(key);
    const to = applyModeToState('excluded-toggle', from);
    if (to === from) return null;
    applyChange(key, from, to);
    return { key, from, to };
  };

  const startGesture = (pointerId, local, key, mode) => {
    gesture.active = true;
    gesture.pointerId = pointerId;
    gesture.startLocal = local;
    gesture.lastLocal = local;
    gesture.startKey = key;
    gesture.mode = mode;
    gesture.moved = false;
    gesture.startApplied = false;
    gesture.visited = new Set();
    gesture.changes = [];
    // 起点占位：同一手势内起点只处理一次（回退经过起点不二次修改）
    gesture.visited.add(key);
  };

  // 拖动开始时应用起点边（mode 决定结果）
  const applyStartEdge = () => {
    if (gesture.startApplied || !gesture.startKey) return;
    gesture.startApplied = true;
    const from = getEdgeState(gesture.startKey);
    const to = applyModeToState(gesture.mode, from);
    recordChange(gesture.startKey, from, to);
  };

  const handlePointerDown = ({ local, pointerId, button }) => {
    if (gesture.active) return; // 多指隔离：仅首指有效
    const key = hitTestEdge(local, layout);
    if (!key) return; // 死区或未命中：不启动

    // 方案 A：secondary 键独立通道（toggle excluded，不进入拖动）
    if (scheme === SCHEMES.a && button === 2) {
      const change = toggleExcludedSingle(key);
      if (change) onGestureCommit([change], { source: 'secondary-click' });
      return;
    }

    // 方案 B：工具决定模式；excluded 工具为点按通道
    if (scheme === SCHEMES.b) {
      if (tool === TOOLS.excluded) {
        const change = toggleExcludedSingle(key);
        if (change) onGestureCommit([change], { source: 'tool-excluded-click' });
        return;
      }
      const mode = tool === TOOLS.erase ? 'erase' : 'add';
      startGesture(pointerId, local, key, mode);
      return;
    }

    // 方案 A 主键 / 方案 C：起始 edge 决定模式
    const current = getEdgeState(key);
    let mode = null;
    if (current === EDGE_STATES.undecided) mode = 'add';
    else if (current === EDGE_STATES.line) mode = 'erase';
    else return; // excluded 起点：不启动主键拖动（P4B 待测项，见 PROTOTYPE.md）

    startGesture(pointerId, local, key, mode);

    // 方案 C：启动长按计时（未移动时到期 → toggle excluded）
    if (scheme === SCHEMES.c && onLongPressArmed) {
      onLongPressArmed(key, pointerId);
    }
  };

  const handlePointerMove = ({ local, pointerId }) => {
    if (!gesture.active || gesture.pointerId !== pointerId) return;
    gesture.lastLocal = local;

    const movedBy = Math.hypot(
      local.x - gesture.startLocal.x,
      local.y - gesture.startLocal.y,
    );
    if (movedBy >= DRAG_MOVE_THRESHOLD && !gesture.moved) {
      gesture.moved = true;
      if (scheme === SCHEMES.c && onLongPressCancelled) onLongPressCancelled();
      applyStartEdge(); // 拖动开始：应用起点
    }
    if (!gesture.moved) return;

    const key = hitTestEdge(local, layout);
    if (!key || gesture.visited.has(key)) return;
    gesture.visited.add(key);

    const from = getEdgeState(key);
    const to = applyModeToState(gesture.mode, from);
    recordChange(key, from, to);
  };

  const handlePointerUp = ({ pointerId }) => {
    if (!gesture.active || gesture.pointerId !== pointerId) return;

    if (!gesture.moved) {
      // 点按 = 单 Edge 手势：按模式应用起点（add: undecided→line；erase: line→undecided）。
      // 无变化（add 模式点按已有 line、erase 模式点按 undecided）不入栈。
      const from = getEdgeState(gesture.startKey);
      const to = applyModeToState(gesture.mode, from);
      const changed = recordChange(gesture.startKey, from, to);
      if (changed) {
        const clickChanges = gesture.changes;
        reset();
        onGestureCommit(clickChanges, { source: 'click' });
        return;
      }
      reset();
      return;
    }

    const changes = gesture.changes;
    reset();
    if (changes.length > 0) {
      onGestureCommit(changes, { source: 'drag' });
    }
  };

  const rollback = () => {
    const changes = gesture.changes;
    for (let i = changes.length - 1; i >= 0; i -= 1) {
      const { key, from, to } = changes[i];
      applyChange(key, to, from); // 反向回滚
    }
    reset();
    if (changes.length > 0 && onGestureCancel) onGestureCancel();
  };

  const handlePointerCancel = ({ pointerId }) => {
    if (!gesture.active || gesture.pointerId !== pointerId) return;
    if (gesture.changes.length > 0) rollback();
    else reset();
  };

  const handleWindowBlur = () => {
    if (!gesture.active) return;
    if (gesture.changes.length > 0) rollback();
    else reset();
  };

  /**
   * 方案 C 长按到期（宿主计时器触发）。
   * 未移动且起点为 undecided → toggle excluded 为单次手势（一个 undo step）。
   */
  const handleLongPressExpired = ({ pointerId }) => {
    if (!gesture.active || gesture.pointerId !== pointerId) return;
    if (gesture.moved) return;
    const change = toggleExcludedSingle(gesture.startKey);
    reset();
    if (change) onGestureCommit([change], { source: 'long-press' });
  };

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleWindowBlur,
    handleLongPressExpired,
    setScheme,
    setTool,
    getScheme: () => scheme,
    getTool: () => tool,
    isGestureActive: () => gesture.active,
  };
}

export { EDGE_STATES, isValidEdgeState };
