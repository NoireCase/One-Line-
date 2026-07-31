// P4B 数字环线 Spike · Pointer 连续笔划状态机（纯逻辑，无 DOM / 无 React）
// 桌面最终输入（Line 优先于 X）：
//   左键（button 0）：line 通道 —— 起点 undecided/excluded → paint-line；起点 line → remove-line
//   右键（button 2）或 Shift+左键：X 通道 —— 起点 undecided → paint-excluded；起点 excluded → remove-excluded；起点 line 不启动
//
// 连续笔划模型：
//   pointerdown 确定通道与潜在操作 → 移动超过阈值（屏幕 CSS px）进入拖动 →
//   记录连续 Pointer 轨迹 → 按顺序对 A→B 线段采样 → 采样点统一 hit-testing →
//   相邻 Edge 约束（相同或共享顶点）→ 顶点按连续性 + 移动方向裁决 → 整个笔划一次提交。
//
// 核心合同：
// 1. 一次 pointerdown → pointerup = 一个 undo step。
// 2. 同一 Edge 同一手势只修改一次（visited 去重）。
// 3. pointercancel / blur / Esc 整体回滚，不入栈。
// 4. 拖动由真实 pointermove 流驱动；不合成 DOM click。
// 5. 结果由数据坐标决定，不由 render 顺序决定。
// 6. 点按 = 单 Edge 手势；无变化不入栈。

import { EDGE_STATES, applyModeToState, isValidEdgeState } from './edgeState.js';
import { hitTestEdge, hitTestEdgeDetailed } from './hitTesting.js';
import { parseEdgeKey, edgeEndpoints, vertexKey } from './edgeCoordinates.js';

// 点击/拖动阈值（屏幕 CSS 像素，候选值；缩放后手感不漂移）
export const DRAG_MOVE_THRESHOLD_CSS = 5;
// 轨迹采样步长（viewBox 域；小于 corridor 安全覆盖范围）
export const STROKE_SAMPLE_STEP_RATIO = 0.2; // 0.2 × cell

function createIdleGesture() {
  return {
    active: false,
    pointerId: null,
    button: null,
    channel: null, // 'line' | 'excluded'
    startLocal: null,
    startScreen: null,
    prevLocal: null,
    startKey: null,
    mode: null,
    moved: false,
    startApplied: false,
    visited: new Set(),
    changes: [],
    lastKey: null,
  };
}

// 两条 Edge 是否相同或共享顶点
function edgesConnected(keyA, keyB) {
  if (!keyA || !keyB) return false;
  if (keyA === keyB) return true;
  const edgeA = parseEdgeKey(keyA);
  const edgeB = parseEdgeKey(keyB);
  if (!edgeA || !edgeB) return false;
  const endpointsA = edgeEndpoints(edgeA).map(vertexKey);
  const endpointKeysA = new Set(endpointsA);
  return edgeEndpoints(edgeB).some((endpoint) => endpointKeysA.has(vertexKey(endpoint)));
}

// 线段采样（board-local 域）
function sampleSegment(prev, curr, step) {
  const dist = Math.hypot(curr.x - prev.x, curr.y - prev.y);
  if (dist < 1e-6) return [curr];
  const count = Math.max(1, Math.ceil(dist / step));
  const points = [];
  for (let i = 1; i <= count; i += 1) {
    const t = i / count;
    points.push({
      x: prev.x + (curr.x - prev.x) * t,
      y: prev.y + (curr.y - prev.y) * t,
    });
  }
  return points;
}

/**
 * 创建手势控制器。
 * @param {object} opts
 * @param {object} opts.layout computeBoardLayout 输出（含 n、cellSize）
 * @param {(key: string) => string} opts.getEdgeState
 * @param {(key: string, from: string, to: string) => void} opts.applyChange
 * @param {(changes: Array, meta: object) => void} opts.onGestureCommit
 * @param {() => void} opts.onGestureCancel
 * @param {(event: object) => void} opts.onStrokeDebug 可选：Stroke Debug 事件流
 */
export function createGestureController({
  layout,
  getEdgeState,
  applyChange,
  onGestureCommit,
  onGestureCancel,
  onStrokeDebug,
}) {
  const gesture = createIdleGesture();
  const strokeStep = Math.max(2, layout.cellSize * STROKE_SAMPLE_STEP_RATIO);

  const emitStroke = (event) => {
    if (onStrokeDebug) onStrokeDebug(event);
  };

  const reset = () => {
    gesture.active = false;
    gesture.pointerId = null;
    gesture.button = null;
    gesture.channel = null;
    gesture.visited = new Set();
    gesture.changes = [];
    gesture.moved = false;
    gesture.startKey = null;
    gesture.mode = null;
    gesture.startApplied = false;
    gesture.lastKey = null;
    gesture.prevLocal = null;
  };

  const recordChange = (key, from, to) => {
    if (to === from) return false;
    gesture.changes.push({ key, from, to });
    applyChange(key, from, to);
    return true;
  };

  // 通道模式：起点状态决定（Line 优先于 X）
  const lineModeFor = (state) => {
    if (state === EDGE_STATES.undecided || state === EDGE_STATES.excluded) return 'paint-line';
    if (state === EDGE_STATES.line) return 'remove-line';
    return null;
  };
  const excludedModeFor = (state) => {
    if (state === EDGE_STATES.undecided) return 'paint-excluded';
    if (state === EDGE_STATES.excluded) return 'remove-excluded';
    return null; // line 起点：X 手势不启动（不覆盖 line）
  };

  const startGesture = (pointerId, local, screen, key, mode, channel, button) => {
    gesture.active = true;
    gesture.pointerId = pointerId;
    gesture.button = button;
    gesture.channel = channel;
    gesture.startLocal = local;
    gesture.startScreen = screen;
    gesture.prevLocal = local;
    gesture.startKey = key;
    gesture.mode = mode;
    gesture.moved = false;
    gesture.startApplied = false;
    gesture.visited = new Set();
    gesture.changes = [];
    gesture.lastKey = key;
    gesture.visited.add(key); // 起点占位：同手势只处理一次
  };

  const handlePointerDown = ({ local, screen, pointerId, button, shiftKey }) => {
    if (gesture.active) return; // 多指隔离
    const key = hitTestEdge(local, layout);
    if (!key) return; // 未命中或歧义：不启动

    const current = getEdgeState(key);
    // 通道锁定：右键 或 Shift+左键 = X 通道；左键 = line 通道
    const channel = button === 2 || (button === 0 && shiftKey) ? 'excluded' : 'line';
    const mode = channel === 'excluded' ? excludedModeFor(current) : lineModeFor(current);
    if (!mode) return; // line 起点遇 X 通道不启动

    startGesture(pointerId, local, screen, key, mode, channel, button);
    emitStroke({ type: 'down', key, channel, mode, screen, local });
  };

  // 顶点候选裁决：共享顶点优先 → 移动方向一致 → 距离近
  const pickCandidate = (detail, moveDir, prevKey) => {
    if (!detail.nearest) return null;
    if (detail.nearest.dist > layout.corridorHalfWidth) return null;

    const candidates = [detail.nearest];
    if (detail.second && detail.second.dist <= layout.corridorHalfWidth) {
      candidates.push(detail.second);
    }

    const connected = candidates.filter((c) => edgesConnected(prevKey, c.key));
    const pool = connected.length > 0 ? connected : candidates;

    if (pool.length === 1) return pool[0].key;

    // 多个候选：与移动方向更一致者优先（边方向与移动方向点积）
    let best = pool[0];
    let bestScore = -Infinity;
    for (const candidate of pool) {
      const edge = parseEdgeKey(candidate.key);
      const [a, b] = edgeEndpoints(edge);
      const ex = b.col - a.col;
      const ey = b.row - a.row;
      const len = Math.hypot(ex, ey) || 1;
      const score = (ex * moveDir.x + ey * moveDir.y) / len;
      if (score > bestScore + 1e-9 || (Math.abs(score - bestScore) <= 1e-9 && candidate.dist < best.dist)) {
        best = candidate;
        bestScore = score;
      }
    }
    return best.key;
  };

  const handlePointerMove = ({ local, screen, pointerId }) => {
    if (!gesture.active || gesture.pointerId !== pointerId) return;

    // 阈值用屏幕 CSS 像素（缩放后手感不漂移）
    const movedBy = gesture.startScreen
      ? Math.hypot(screen.x - gesture.startScreen.x, screen.y - gesture.startScreen.y)
      : 0;
    if (movedBy >= DRAG_MOVE_THRESHOLD_CSS && !gesture.moved) {
      gesture.moved = true;
      applyStartEdge();
      emitStroke({ type: 'drag-start', thresholdCss: DRAG_MOVE_THRESHOLD_CSS });
    }
    if (!gesture.moved) return;

    // 轨迹补全：A→B 线段有序采样
    const prev = gesture.prevLocal || gesture.startLocal;
    const points = sampleSegment(prev, local, strokeStep);
    for (const point of points) {
      const detail = hitTestEdgeDetailed(point, layout);
      const moveDir = {
        x: point.x - prev.x,
        y: point.y - prev.y,
      };
      const key = pickCandidate(detail, moveDir, gesture.lastKey);
      if (!key) {
        emitStroke({
          type: 'rejected',
          local: point,
          candidates: [detail.nearest, detail.second]
            .filter(Boolean)
            .filter((c) => c.dist <= layout.corridorHalfWidth)
            .map((c) => c.key),
        });
        continue;
      }
      if (gesture.visited.has(key)) continue;
      gesture.visited.add(key);
      gesture.lastKey = key;

      const from = getEdgeState(key);
      const to = applyModeToState(gesture.mode, from);
      const changed = recordChange(key, from, to);
      emitStroke({ type: 'hit', key, from, to, changed, local: point, moveDir });
    }
    gesture.prevLocal = local;
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
      // 点按 = 单 Edge 手势（按模式应用起点）
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
      onGestureCommit(changes, { source: 'stroke' });
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
   * Esc / 外部取消：等价 pointercancel（不要求 pointerId 匹配）。
   * 回滚全部未提交变更、清理状态。
   */
  const cancelActive = () => {
    if (!gesture.active) return false;
    if (gesture.changes.length > 0) rollback();
    else reset();
    return true;
  };

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleWindowBlur,
    cancelActive,
    isGestureActive: () => gesture.active,
    getActivePointerId: () => (gesture.active ? gesture.pointerId : null),
    getActiveChannel: () => (gesture.active ? gesture.channel : null),
  };
}

export { EDGE_STATES, isValidEdgeState };
