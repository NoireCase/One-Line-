// P4B 数字环线 Spike · Pointer 手势状态机（纯逻辑，无 DOM / 无 React）
// 桌面双通道直接输入（本轮收敛）：
//   左键（button 0）：line 通道 —— 起点 undecided → add；起点 line → remove-line；起点 excluded 不启动
//   右键（button 2）：excluded 通道 —— 起点 undecided → add-excluded；起点 excluded → remove-excluded；起点 line 不启动
// 拖动中经过互斥状态一律跳过（不覆盖）。
//
// 核心合同：
// 1. 一次 pointerdown → pointerup 只产生一个 undo step（一个 transaction）。
// 2. 同一 edge 在同一手势内最多修改一次（visited 去重）。
// 3. pointercancel / 窗口失焦必须回滚本次全部未提交变更。
// 4. 拖动由连续 pointermove 流驱动；禁止 click 合成拖动（由宿主保证不合成）。
// 5. 手势结果由数据坐标决定，不由 render 顺序决定。
// 6. 点按 = 单 Edge 手势：按模式应用起点；无变化不入栈。

import { EDGE_STATES, applyModeToState, isValidEdgeState } from './edgeState.js';
import { hitTestEdge, hitTestEdgeDetailed } from './hitTesting.js';
import { parseEdgeKey, edgeEndpoints, vertexKey } from './edgeCoordinates.js';

export const SCHEMES = Object.freeze({ a: 'a', b: 'b', c: 'c' });
// 工具收敛：方案 B 只保留 Line / X 两个通道（独立 Erase 已取消）
export const TOOLS = Object.freeze({ line: 'line', excluded: 'excluded' });

// 判定「开始拖动」的移动阈值（viewBox 域像素，候选值）
export const DRAG_MOVE_THRESHOLD = 5;
// 方案 C 长按阈值（毫秒，候选值；移动端暂缓，本轮不测试）
export const LONG_PRESS_MS = 450;

function createIdleGesture() {
  return {
    active: false,
    pointerId: null,
    button: null,
    startLocal: null,
    lastLocal: null,
    startKey: null,
    mode: null,
    moved: false,
    startApplied: false,
    visited: new Set(),
    changes: [],
    lastKey: null,
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
 * @param {string} opts.tool 方案 B 当前工具（line | excluded）
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
    gesture.pointerId = null;
    gesture.button = null;
    gesture.visited = new Set();
    gesture.changes = [];
    gesture.moved = false;
    gesture.startKey = null;
    gesture.mode = null;
    gesture.startApplied = false;
    gesture.lastKey = null;
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

  // 左键通道模式：起点状态决定
  const lineModeFor = (state) => {
    if (state === EDGE_STATES.undecided) return 'add';
    if (state === EDGE_STATES.line) return 'remove-line';
    return null; // excluded 起点：左键不启动
  };

  // 右键通道模式：起点状态决定
  const excludedModeFor = (state) => {
    if (state === EDGE_STATES.undecided) return 'add-excluded';
    if (state === EDGE_STATES.excluded) return 'remove-excluded';
    return null; // line 起点：右键不启动
  };

  const startGesture = (pointerId, local, key, mode, button) => {
    gesture.active = true;
    gesture.pointerId = pointerId;
    gesture.button = button;
    gesture.startLocal = local;
    gesture.lastLocal = local;
    gesture.startKey = key;
    gesture.mode = mode;
    gesture.moved = false;
    gesture.startApplied = false;
    gesture.visited = new Set();
    gesture.changes = [];
    gesture.lastKey = key;
    // 起点占位：同一手势内起点只处理一次
    gesture.visited.add(key);
  };

  const handlePointerDown = ({ local, pointerId, button }) => {
    if (gesture.active) return; // 多指隔离：仅首指有效
    const key = hitTestEdge(local, layout);
    if (!key) return; // 未命中或歧义：不启动

    const current = getEdgeState(key);

    // 方案 B：X 工具为点按 toggle 通道（不进入拖动）
    if (scheme === SCHEMES.b && tool === TOOLS.excluded) {
      const change = toggleExcludedSingle(key);
      if (change) onGestureCommit([change], { source: 'tool-excluded-click' });
      return;
    }

    // 左键通道（button 0）：line 操作
    if (button === 0) {
      const mode = lineModeFor(current);
      if (!mode) return; // excluded 起点不启动（不覆盖为 line）
      startGesture(pointerId, local, key, mode, button);
      // 方案 C（移动端暂缓）：未移动时长按到期 toggle excluded
      if (scheme === SCHEMES.c && onLongPressArmed) {
        onLongPressArmed(key, pointerId);
      }
      return;
    }

    // 右键通道（button 2）：X 操作
    if (button === 2) {
      const mode = excludedModeFor(current);
      if (!mode) return; // line 起点不启动（不覆盖为 excluded）
      startGesture(pointerId, local, key, mode, button);
    }
  };

  // 拖动歧义裁决：在最近与次近候选中，选择与上一命中 Edge 共享端点的边
  const resolveAmbiguousKey = (detail) => {
    if (!gesture.lastKey) return null;
    const lastEdge = parseEdgeKey(gesture.lastKey);
    const lastEndpoints = edgeEndpoints(lastEdge);
    const lastVertexKeys = new Set(lastEndpoints.map(vertexKey));
    const candidates = [detail.nearest, detail.second].filter(Boolean);
    for (const candidate of candidates) {
      const edge = parseEdgeKey(candidate.key);
      const sharing = edgeEndpoints(edge).some((endpoint) => (
        lastVertexKeys.has(vertexKey(endpoint))
      ));
      if (sharing) return candidate.key;
    }
    return null;
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

    const detail = hitTestEdgeDetailed(local, layout);
    let key = null;
    if (detail.nearest && detail.nearest.dist <= layout.corridorHalfWidth) {
      if (detail.ambiguous) {
        key = resolveAmbiguousKey(detail);
      } else {
        key = detail.nearest.key;
      }
    }
    if (!key || gesture.visited.has(key)) return;
    gesture.visited.add(key);
    gesture.lastKey = key;

    const from = getEdgeState(key);
    const to = applyModeToState(gesture.mode, from);
    recordChange(key, from, to);
  };

  const applyStartEdge = () => {
    if (gesture.startApplied || !gesture.startKey) return;
    gesture.startApplied = true;
    const from = getEdgeState(gesture.startKey);
    const to = applyModeToState(gesture.mode, from);
    recordChange(gesture.startKey, from, to);
  };

  const handlePointerUp = ({ pointerId }) => {
    if (!gesture.active || gesture.pointerId !== pointerId) return;

    if (!gesture.moved) {
      // 点按 = 单 Edge 手势：按模式应用起点（add/remove-line、add/remove-excluded）
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
   * 方案 C 长按到期（宿主计时器触发；移动端暂缓，本轮不测试）。
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
