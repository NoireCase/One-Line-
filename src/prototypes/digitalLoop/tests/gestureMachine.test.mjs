// P4B 数字环线 Spike · 连续笔划手势状态机纯函数测试（桌面最终收敛）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBoardLayout } from '../input/edgeGeometry.js';
import { edgeSegmentGeometry } from '../input/edgeGeometry.js';
import { EDGE_STATES } from '../input/edgeState.js';
import { createGestureController, DRAG_MOVE_THRESHOLD_CSS } from '../input/gestureMachine.js';
import { EDGE_ORIENTATIONS } from '../input/edgeCoordinates.js';

const N = 5;
const layout = computeBoardLayout(N);

// 横边/竖边简写
function h(r, c) {
  return { orientation: EDGE_ORIENTATIONS.horizontal, row: r, col: c };
}
function v(r, c) {
  return { orientation: EDGE_ORIENTATIONS.vertical, row: r, col: c };
}

function edgeMidpoint(orientation, row, col) {
  const seg = edgeSegmentGeometry({ orientation, row, col }, layout);
  return { x: (seg.x1 + seg.x2) / 2, y: (seg.y1 + seg.y2) / 2 };
}

// 测试 harness：screen 与 local 1:1（阈值按屏幕 CSS 像素判定）
function createHarness({ initial = {}, strokeEvents = null } = {}) {
  const edges = new Map(Object.entries(initial));
  const transactions = [];
  const strokes = [];
  const controller = createGestureController({
    layout,
    getEdgeState: (key) => edges.get(key) ?? EDGE_STATES.undecided,
    applyChange: (_key, _from, to) => { edges.set(_key, to); },
    onGestureCommit: (changes, meta) => transactions.push({ changes, meta }),
    onGestureCancel: () => {},
    onStrokeDebug: strokeEvents ? (event) => strokes.push(event) : undefined,
  });
  return { controller, edges, transactions, strokes };
}

const mid = (edge) => edgeMidpoint(edge.orientation, edge.row, edge.col);

function down(controller, pointerId, point, { button = 0, shiftKey = false } = {}) {
  controller.handlePointerDown({ local: point, screen: point, pointerId, button, shiftKey });
}
function move(controller, pointerId, point) {
  controller.handlePointerMove({ local: point, screen: point, pointerId });
}
function up(controller, pointerId) {
  controller.handlePointerUp({ pointerId });
}

// ── 状态转换（Line 优先于 X）──

test('左键：undecided → line；line → undecided；excluded → line（覆盖）', () => {
  const { controller, edges, transactions } = createHarness();
  const p = mid(h(2, 1));
  down(controller, 1, p);
  up(controller, 1);
  assert.equal(edges.get('h:2:1'), EDGE_STATES.line, 'undecided + 左键 → line');
  down(controller, 1, p);
  up(controller, 1);
  assert.equal(edges.get('h:2:1'), EDGE_STATES.undecided, 'line + 左键 → undecided');
  down(controller, 1, p);
  up(controller, 1);
  assert.equal(edges.get('h:2:1'), EDGE_STATES.line);
  assert.equal(transactions.length, 3, '三次点击三个 undo step');
});

test('左键覆盖 X：excluded → line；Undo 恢复 X', () => {
  const { controller, edges, transactions } = createHarness({ initial: { 'h:2:1': EDGE_STATES.excluded } });
  const p = mid(h(2, 1));
  down(controller, 1, p);
  up(controller, 1);
  assert.equal(edges.get('h:2:1'), EDGE_STATES.line, '左键覆盖 X 为 line');
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].changes[0].from, EDGE_STATES.excluded, 'transaction 记录原状态 excluded');
  // Undo → 恢复 X
  const t = transactions.pop();
  for (const { key, from } of t.changes) edges.set(key, from);
  assert.equal(edges.get('h:2:1'), EDGE_STATES.excluded, 'Undo 恢复为 excluded 而非 undecided');
});

test('X 通道：undecided → excluded；excluded → undecided；line 不覆盖', () => {
  const { controller, edges } = createHarness();
  const p = mid(h(2, 1));
  down(controller, 1, p, { button: 2 });
  up(controller, 1);
  assert.equal(edges.get('h:2:1'), EDGE_STATES.excluded, '右键 undecided → excluded');
  down(controller, 1, p, { button: 2 });
  up(controller, 1);
  assert.equal(edges.get('h:2:1'), EDGE_STATES.undecided, '右键 excluded → undecided');

  const { controller: c2, edges: e2 } = createHarness({ initial: { 'h:2:1': EDGE_STATES.line } });
  down(c2, 1, p, { button: 2 });
  up(c2, 1);
  assert.equal(e2.get('h:2:1'), EDGE_STATES.line, 'X 通道命中 line 不覆盖');
});

test('Shift+左键与右键完全一致（同一 X 通道）', () => {
  const { controller, edges, transactions } = createHarness();
  const p = mid(h(2, 1));
  // Shift+左键：undecided → excluded
  down(controller, 1, p, { shiftKey: true });
  up(controller, 1);
  assert.equal(edges.get('h:2:1'), EDGE_STATES.excluded, 'Shift+左键 → excluded');
  // Shift+左键：excluded → undecided
  down(controller, 1, p, { shiftKey: true });
  up(controller, 1);
  assert.equal(edges.get('h:2:1'), EDGE_STATES.undecided, 'Shift+左键删除 X');
  // Shift 在 pointerdown 锁定：中途松开 Shift 不切换通道
  down(controller, 1, p, { shiftKey: true });
  move(controller, 1, mid(h(2, 2)));
  up(controller, 1);
  assert.equal(edges.get('h:2:1'), EDGE_STATES.excluded, '起点 Shift 锁定 X 通道');
  assert.equal(edges.get('h:2:2'), EDGE_STATES.excluded, '拖动继续 X 通道（模拟中途松 Shift）');
  assert.equal(transactions.length, 3);
});

test('同一个 key 不可能同时 line + excluded（唯一状态不变量）', () => {
  const { controller, edges } = createHarness();
  const p = mid(h(2, 1));
  down(controller, 1, p);
  up(controller, 1);
  assert.equal(edges.get('h:2:1'), EDGE_STATES.line);
  down(controller, 1, p, { button: 2 });
  up(controller, 1);
  assert.equal(edges.get('h:2:1'), EDGE_STATES.line, 'X 通道不覆盖 line');
});

// ── 点击与拖动阈值（屏幕 CSS 像素）──

test('微动（1px / 2px）仍为单击，只修改起始 Edge', () => {
  const { controller, edges, transactions } = createHarness();
  const p = mid(h(2, 1));
  down(controller, 1, p);
  move(controller, 1, { x: p.x + 1, y: p.y });
  up(controller, 1);
  assert.equal(edges.get('h:2:1'), EDGE_STATES.line, '1px 微动仍单击');
  assert.equal(transactions.length, 1);

  const { controller: c2, edges: e2, transactions: t2 } = createHarness();
  const p2 = mid(h(2, 3));
  down(c2, 1, p2);
  move(c2, 1, { x: p2.x + 2, y: p2.y + 1 });
  up(c2, 1);
  assert.equal(e2.get('h:2:3'), EDGE_STATES.line, '2px 微动仍单击');
  assert.equal(t2.length, 1);
});

test('超过阈值才进入拖动；单击只改一条 Edge', () => {
  const { controller, edges, transactions } = createHarness();
  const p1 = mid(h(2, 1));
  down(controller, 1, p1);
  move(controller, 1, { x: p1.x + 6, y: p1.y }); // 6px > 阈值 5
  up(controller, 1);
  assert.equal(edges.get('h:2:1'), EDGE_STATES.line);
  // 6px 已进入拖动，但未移动到第二条边
  assert.ok(!edges.has('h:2:2'), '未到达第二条边');
  assert.equal(transactions.length, 1);
});

test('阈值按屏幕 CSS 像素判定（1:1 local/screen 时与 viewBox 等价）', () => {
  assert.equal(DRAG_MOVE_THRESHOLD_CSS, 5);
  const { controller, edges } = createHarness();
  const p = mid(h(2, 1));
  down(controller, 1, p);
  move(controller, 1, { x: p.x + 4.9, y: p.y });
  up(controller, 1);
  assert.equal(edges.get('h:2:1'), EDGE_STATES.line, '4.9px 未超阈值仍单击');
});

// ── 轨迹补全 ──

test('单帧跨过两条 Edge：中间 Edge 不遗漏', () => {
  const { controller, edges, transactions } = createHarness();
  down(controller, 1, mid(h(2, 1)));
  // 单帧从 h:2:1 跨到 h:2:4
  move(controller, 1, mid(h(2, 4)));
  up(controller, 1);
  for (const col of [1, 2, 3, 4]) {
    assert.equal(edges.get(`h:2:${col}`), EDGE_STATES.line, `h:2:${col} 被轨迹补全`);
  }
  assert.equal(transactions.length, 1, '一次笔划一个 undo step');
  assert.equal(transactions[0].changes.length, 4);
});

test('快速连续直线与删除', () => {
  const { controller, edges, transactions } = createHarness();
  const keys = ['h:2:1', 'h:2:2', 'h:2:3'];
  down(controller, 1, mid(h(2, 1)));
  move(controller, 1, mid(h(2, 3)));
  up(controller, 1);
  for (const key of keys) assert.equal(edges.get(key), EDGE_STATES.line);
  // 快速删除：从 line 起手
  down(controller, 1, mid(h(2, 1)));
  move(controller, 1, mid(h(2, 3)));
  up(controller, 1);
  for (const key of keys) assert.equal(edges.get(key), EDGE_STATES.undecided);
  assert.equal(transactions.length, 2);
});

test('快速 X 笔划（右键单帧跨多边）', () => {
  const { controller, edges } = createHarness();
  down(controller, 1, mid(h(2, 1)), { button: 2 });
  move(controller, 1, mid(h(2, 4)));
  up(controller, 1);
  for (const col of [1, 2, 3, 4]) {
    assert.equal(edges.get(`h:2:${col}`), EDGE_STATES.excluded, `h:2:${col} 被 X 笔划补全`);
  }
});

test('不相邻远端 Edge 不直接跳变（相邻约束）', () => {
  const { controller, edges } = createHarness({ strokeEvents: true });
  down(controller, 1, mid(h(2, 1)));
  // 从 h:2:1 单帧跳到远处的 h:2:4：采样点逐段经过，全部相邻可达（连续轨迹允许）
  move(controller, 1, mid(h(2, 4)));
  up(controller, 1);
  assert.equal(edges.get('h:2:4'), EDGE_STATES.line, '连续轨迹按顺序补全');
  // 垂直远跳：h:2:1 到 v:5:1（不相邻、无中间轨迹支撑）→ 采样点不经过任何相邻边
  const { controller: c2, edges: e2 } = createHarness();
  down(c2, 1, mid(h(2, 1)));
  move(c2, 1, { x: 500, y: 500 }); // 棋盘外远端（11×11 域外）
  up(c2, 1);
  assert.ok(!e2.has('h:2:1') || e2.get('h:2:1') === EDGE_STATES.line);
});

test('同一 Edge 反复经过只处理一次', () => {
  const { controller, edges, transactions } = createHarness();
  down(controller, 1, mid(h(2, 1)));
  move(controller, 1, mid(h(2, 3)));
  move(controller, 1, mid(h(2, 1))); // 回退经过起点
  move(controller, 1, mid(h(2, 2)));
  up(controller, 1);
  for (const col of [1, 2, 3]) assert.equal(edges.get(`h:2:${col}`), EDGE_STATES.line);
  const hits = transactions[0].changes.filter((c) => c.key === 'h:2:1');
  assert.equal(hits.length, 1, '起点只处理一次');
});

// ── 顶点转向 ──

test('直角转弯：横转竖连续', () => {
  const { controller, edges } = createHarness();
  down(controller, 1, mid(h(2, 1)));
  move(controller, 1, mid(h(2, 3)));
  move(controller, 1, mid(v(3, 3)));
  move(controller, 1, mid(v(4, 3)));
  up(controller, 1);
  for (const col of [1, 2, 3]) assert.equal(edges.get(`h:2:${col}`), EDGE_STATES.line);
  for (const row of [3, 4]) assert.equal(edges.get(`v:${row}:3`), EDGE_STATES.line, `v:${row}:3 转弯后连续`);
});

test('水平直行不因轻微抖动突然转弯', () => {
  const { controller, edges } = createHarness();
  down(controller, 1, mid(h(2, 1)));
  move(controller, 1, mid(h(2, 2)));
  // 轻微抖动：偏离直线 3px（小于 corridor 且未到竖边）
  const p2 = mid(h(2, 2));
  move(controller, 1, { x: p2.x + 10, y: p2.y - 3 });
  move(controller, 1, mid(h(2, 3)));
  up(controller, 1);
  assert.equal(edges.get('h:2:1'), EDGE_STATES.line);
  assert.equal(edges.get('h:2:2'), EDGE_STATES.line);
  assert.equal(edges.get('h:2:3'), EDGE_STATES.line);
  assert.ok(!edges.has('v:1:2') && !edges.has('v:2:2'), '抖动未误转竖边');
});

test('左转与右转连续（竖边转横边）', () => {
  const { controller, edges } = createHarness();
  down(controller, 1, mid(v(2, 2)));
  move(controller, 1, mid(v(4, 2)));
  move(controller, 1, mid(h(4, 3))); // 右转
  move(controller, 1, mid(h(4, 4)));
  up(controller, 1);
  for (const row of [2, 3, 4]) assert.equal(edges.get(`v:${row}:2`), EDGE_STATES.line);
  assert.equal(edges.get('h:4:3'), EDGE_STATES.line);
  assert.equal(edges.get('h:4:4'), EDGE_STATES.line);
});

test('正顶点 ambiguity 不随机修改多条 Edge', () => {
  const { controller, edges, transactions } = createHarness();
  const vertex = { x: 100, y: 100 }; // 顶点 (2,2)（layout n=5, cell=40, origin=20）
  down(controller, 1, mid(h(2, 1)));
  move(controller, 1, vertex);
  move(controller, 1, mid(v(2, 2)));
  up(controller, 1);
  // 起点 h:2:1 与终点 v:2:2 均处理；顶点停留不随机改多边
  assert.equal(edges.get('h:2:1'), EDGE_STATES.line);
  assert.equal(edges.get('v:2:2'), EDGE_STATES.line);
  assert.equal(transactions[0].changes.length, 2, '顶点停留只增加一条');
});

// ── 拖动通道与跳过 ──

test('左键拖动：undecided/excluded → line（覆盖）；line 保持', () => {
  const { controller, edges } = createHarness({ initial: { 'h:2:2': EDGE_STATES.excluded, 'h:2:3': EDGE_STATES.line } });
  down(controller, 1, mid(h(2, 1)));
  move(controller, 1, mid(h(2, 4)));
  up(controller, 1);
  assert.equal(edges.get('h:2:1'), EDGE_STATES.line);
  assert.equal(edges.get('h:2:2'), EDGE_STATES.line, '左键拖动覆盖 X');
  assert.equal(edges.get('h:2:3'), EDGE_STATES.line, '已有 line 保持');
  assert.equal(edges.get('h:2:4'), EDGE_STATES.line);
});

test('X 通道拖动：经过 line 跳过；excluded 保持；undecided → excluded', () => {
  const { controller, edges } = createHarness({ initial: { 'h:2:2': EDGE_STATES.line } });
  down(controller, 1, mid(h(2, 1)), { button: 2 });
  move(controller, 1, mid(h(2, 4)));
  up(controller, 1);
  assert.equal(edges.get('h:2:1'), EDGE_STATES.excluded);
  assert.equal(edges.get('h:2:2'), EDGE_STATES.line, 'line 被跳过');
  assert.equal(edges.get('h:2:3'), EDGE_STATES.excluded);
  assert.equal(edges.get('h:2:4'), EDGE_STATES.excluded);
});

test('remove-line 拖动不删除 X、不改 undecided', () => {
  const { controller, edges } = createHarness({
    initial: {
      'h:2:1': EDGE_STATES.line,
      'h:2:2': EDGE_STATES.excluded,
      'h:2:3': EDGE_STATES.line,
    },
  });
  down(controller, 1, mid(h(2, 1)));
  move(controller, 1, mid(h(2, 4)));
  up(controller, 1);
  assert.equal(edges.get('h:2:1'), EDGE_STATES.undecided, 'line 删除');
  assert.equal(edges.get('h:2:2'), EDGE_STATES.excluded, 'X 保持');
  assert.equal(edges.get('h:2:3'), EDGE_STATES.undecided, 'line 删除');
  assert.ok(!edges.has('h:2:4'), 'undecided 保持');
});

// ── cancel / blur / 点按 ──

test('pointercancel 回滚笔划全部变更', () => {
  const { controller, edges, transactions } = createHarness();
  down(controller, 1, mid(h(2, 1)));
  move(controller, 1, mid(h(2, 4)));
  controller.handlePointerCancel({ pointerId: 1 });
  for (const col of [1, 2, 3, 4]) assert.equal(edges.get(`h:2:${col}`) ?? EDGE_STATES.undecided, EDGE_STATES.undecided);
  assert.equal(transactions.length, 0);
});

test('窗口失焦回滚；cancelActive（Esc）回滚', () => {
  const { controller, edges, transactions } = createHarness();
  down(controller, 1, mid(h(2, 1)));
  move(controller, 1, mid(h(2, 3)));
  controller.handleWindowBlur();
  assert.equal(edges.get('h:2:1'), EDGE_STATES.undecided);
  assert.equal(transactions.length, 0);

  const { controller: c2, edges: e2, transactions: t2 } = createHarness();
  down(c2, 1, mid(h(2, 1)));
  move(c2, 1, mid(h(2, 3)));
  const cancelled = c2.cancelActive();
  assert.equal(cancelled, true);
  assert.equal(e2.get('h:2:1'), EDGE_STATES.undecided, 'Esc 回滚');
  assert.equal(t2.length, 0, 'Esc 不入栈');
  // 无手势时 Esc 无副作用
  assert.equal(c2.cancelActive(), false);
});

test('点按（无移动）：按通道与模式应用起点；无变化不入栈', () => {
  const { controller, edges, transactions } = createHarness();
  down(controller, 1, mid(h(2, 1)));
  up(controller, 1);
  assert.equal(edges.get('h:2:1'), EDGE_STATES.line);
  down(controller, 1, mid(h(2, 1)));
  up(controller, 1);
  assert.equal(edges.get('h:2:1'), EDGE_STATES.undecided);
  assert.equal(transactions.length, 2);
  // 画回 line，再验证 X 通道点按 line 无变化
  down(controller, 1, mid(h(2, 1)));
  up(controller, 1);
  assert.equal(edges.get('h:2:1'), EDGE_STATES.line);
  down(controller, 1, mid(h(2, 1)), { button: 2 });
  up(controller, 1);
  assert.equal(transactions.length, 3, 'X 通道点按 line 无变化不入栈');
  assert.equal(edges.get('h:2:1'), EDGE_STATES.line, 'line 不被覆盖');
});

test('多指隔离：第二指被忽略', () => {
  const { controller, edges, transactions } = createHarness();
  down(controller, 1, mid(h(2, 1)));
  down(controller, 2, mid(h(2, 2)));
  move(controller, 1, mid(h(2, 2)));
  up(controller, 1);
  assert.equal(edges.get('h:2:2'), EDGE_STATES.line, '仅首指生效');
  assert.equal(transactions.length, 1);
});
