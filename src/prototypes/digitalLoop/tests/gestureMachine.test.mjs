// P4B 数字环线 Spike · 手势状态机纯函数测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBoardLayout } from '../input/edgeGeometry.js';
import { edgeSegmentGeometry } from '../input/edgeGeometry.js';
import { EDGE_STATES } from '../input/edgeState.js';
import { createGestureController, SCHEMES, TOOLS } from '../input/gestureMachine.js';
import { EDGE_ORIENTATIONS } from '../input/edgeCoordinates.js';

const N = 5;
const layout = computeBoardLayout(N);

function edgeMidpoint(orientation, row, col) {
  const seg = edgeSegmentGeometry({ orientation, row, col }, layout);
  return { x: (seg.x1 + seg.x2) / 2, y: (seg.y1 + seg.y2) / 2 };
}

// 横边简写（测试用）
function h(r, c) {
  return { orientation: EDGE_ORIENTATIONS.horizontal, row: r, col: c };
}

function createHarness({ scheme = SCHEMES.a, tool = TOOLS.line, initial = {} } = {}) {
  const edges = new Map(Object.entries(initial));
  const transactions = [];
  const controller = createGestureController({
    layout,
    getEdgeState: (key) => edges.get(key) ?? EDGE_STATES.undecided,
    applyChange: (_key, _from, to) => { edges.set(_key, to); },
    onGestureCommit: (changes, meta) => transactions.push({ changes, meta }),
    onGestureCancel: () => {},
    onLongPressArmed: () => {},
    onLongPressCancelled: () => {},
    scheme,
    tool,
  });
  return { controller, edges, transactions };
}

function edgeKeyOf(edge) {
  return `${edge.orientation[0]}:${edge.row}:${edge.col}`;
}

// 拖动路径：从 a 点开始，依次经过各点（连续 move）
function drag(controller, pointerId, points, { button = 0 } = {}) {
  controller.handlePointerDown({ local: points[0], pointerId, button });
  for (const p of points.slice(1)) {
    controller.handlePointerMove({ local: p, pointerId });
  }
  controller.handlePointerUp({ pointerId });
}

test('添加模式：从 undecided 拖动画线', () => {
  const { controller, edges, transactions } = createHarness();
  const start = h(2, 1);
  const next = h(2, 2);
  drag(controller, 1, [edgeMidpoint(...[start.orientation, start.row, start.col]), edgeMidpoint(...[next.orientation, next.row, next.col])]);
  assert.equal(edges.get(edgeKeyOf(start)), EDGE_STATES.line);
  assert.equal(edges.get(edgeKeyOf(next)), EDGE_STATES.line);
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].changes.length, 2, '一次手势一个 transaction');
});

test('擦除模式：从 line 边开始拖动擦除', () => {
  const key = edgeKeyOf(h(2, 1));
  const { controller, edges, transactions } = createHarness({ initial: { [key]: EDGE_STATES.line } });
  const start = h(2, 1);
  const next = h(2, 2);
  drag(controller, 1, [edgeMidpoint(...[start.orientation, start.row, start.col]), edgeMidpoint(...[next.orientation, next.row, next.col])]);
  assert.equal(edges.get(key), EDGE_STATES.undecided);
  assert.equal(transactions.length, 1);
});

test('同一 edge 同一手势最多修改一次（回退不二次修改）', () => {
  const { controller, edges, transactions } = createHarness();
  const a = edgeMidpoint(...[h(2, 1).orientation, h(2, 1).row, h(2, 1).col]);
  const b = edgeMidpoint(...[h(2, 2).orientation, h(2, 2).row, h(2, 2).col]);
  const c = edgeMidpoint(...[h(2, 1).orientation, h(2, 1).row, h(2, 1).col]); // 回到起点附近
  drag(controller, 1, [a, b, c]);
  assert.equal(edges.get('h:2:1'), EDGE_STATES.line);
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].changes.filter((ch) => ch.key === 'h:2:1').length, 1, '起点只修改一次');
});

test('手势期间不自动切换模式：add 模式经过已有 line 不动', () => {
  const lineKey = 'h:2:2';
  const { controller, edges } = createHarness({ initial: { [lineKey]: EDGE_STATES.line } });
  drag(controller, 1, [
    edgeMidpoint(...[h(2, 1).orientation, h(2, 1).row, h(2, 1).col]),
    edgeMidpoint(...[h(2, 2).orientation, h(2, 2).row, h(2, 2).col]),
    edgeMidpoint(...[h(2, 3).orientation, h(2, 3).row, h(2, 3).col]),
  ]);
  assert.equal(edges.get(lineKey), EDGE_STATES.line, '已有 line 保持不变');
  assert.equal(edges.get('h:2:1'), EDGE_STATES.line);
  assert.equal(edges.get('h:2:3'), EDGE_STATES.line);
});

test('line 手势不写入 excluded（add 模式经过 excluded 不动）', () => {
  const exKey = 'h:2:2';
  const { controller, edges } = createHarness({ initial: { [exKey]: EDGE_STATES.excluded } });
  drag(controller, 1, [
    edgeMidpoint(...[h(2, 1).orientation, h(2, 1).row, h(2, 1).col]),
    edgeMidpoint(...[h(2, 2).orientation, h(2, 2).row, h(2, 2).col]),
  ]);
  assert.equal(edges.get(exKey), EDGE_STATES.excluded, 'excluded 不被 line 手势改写');
});

test('方案 A secondary 点击 toggle excluded；excluded 不写 line', () => {
  const { controller, edges, transactions } = createHarness({ scheme: SCHEMES.a });
  const key = 'h:2:2';
  controller.handlePointerDown({ local: edgeMidpoint(...[h(2, 2).orientation, 2, 2]), pointerId: 1, button: 2 });
  controller.handlePointerUp({ pointerId: 1 });
  assert.equal(edges.get(key), EDGE_STATES.excluded);
  assert.equal(transactions.length, 1);
  // 再次 secondary → 取消回 undecided
  controller.handlePointerDown({ local: edgeMidpoint(...[h(2, 2).orientation, 2, 2]), pointerId: 1, button: 2 });
  controller.handlePointerUp({ pointerId: 1 });
  assert.equal(edges.get(key), EDGE_STATES.undecided);
  // 先把 h:2:3 画成 line，再验证 secondary 对 line 边无效
  controller.handlePointerDown({ local: edgeMidpoint(...[h(2, 3).orientation, 2, 3]), pointerId: 1, button: 0 });
  controller.handlePointerUp({ pointerId: 1 });
  assert.equal(edges.get('h:2:3'), EDGE_STATES.line);
  controller.handlePointerDown({ local: edgeMidpoint(...[h(2, 3).orientation, 2, 3]), pointerId: 1, button: 2 });
  controller.handlePointerUp({ pointerId: 1 });
  assert.equal(edges.get('h:2:3'), EDGE_STATES.line, 'line 不参与 excluded 切换');
});

test('点击 undecided → line；点击 line → undecided；各一个 undo step，Undo 可恢复', () => {
  const { controller, edges, transactions } = createHarness();

  // 点击 undecided → line（一次手势）
  controller.handlePointerDown({ local: edgeMidpoint(...[h(2, 1).orientation, 2, 1]), pointerId: 1, button: 0 });
  controller.handlePointerUp({ pointerId: 1 });
  assert.equal(edges.get('h:2:1'), EDGE_STATES.line);
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].changes.length, 1, '单边一次手势一个 transaction');

  // Undo → undecided
  const t1 = transactions.pop();
  for (const { key, from } of t1.changes) edges.set(key, from);
  assert.equal(edges.get('h:2:1'), EDGE_STATES.undecided, 'Undo 恢复添加');

  // 点击 line → undecided（擦除，一次手势）
  edges.set('h:2:1', EDGE_STATES.line);
  controller.handlePointerDown({ local: edgeMidpoint(...[h(2, 1).orientation, 2, 1]), pointerId: 1, button: 0 });
  controller.handlePointerUp({ pointerId: 1 });
  assert.equal(edges.get('h:2:1'), EDGE_STATES.undecided, '点击 line 擦除');
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].changes[0].from, EDGE_STATES.line, 'transaction 记录 from=line');

  // Undo → line
  const t2 = transactions.pop();
  for (const { key, from } of t2.changes) edges.set(key, from);
  assert.equal(edges.get('h:2:1'), EDGE_STATES.line, 'Undo 恢复擦除');
});

test('点击 excluded 主键不误写 line（excluded 起点不启动手势）', () => {
  const exKey = 'h:2:2';
  const { controller, edges, transactions } = createHarness({ initial: { [exKey]: EDGE_STATES.excluded } });
  controller.handlePointerDown({ local: edgeMidpoint(...[h(2, 2).orientation, 2, 2]), pointerId: 1, button: 0 });
  controller.handlePointerUp({ pointerId: 1 });
  assert.equal(edges.get(exKey), EDGE_STATES.excluded, 'excluded 不被主键改写');
  assert.equal(transactions.length, 0, '手势未启动不入栈');
});

test('两次独立点击产生两个独立 undo steps', () => {
  const { controller, edges, transactions } = createHarness();
  for (const col of [1, 2]) {
    controller.handlePointerDown({ local: edgeMidpoint(...[h(2, col).orientation, 2, col]), pointerId: 1, button: 0 });
    controller.handlePointerUp({ pointerId: 1 });
  }
  assert.equal(transactions.length, 2, '两次点击两个 undo steps');
  assert.equal(edges.get('h:2:1'), EDGE_STATES.line);
  assert.equal(edges.get('h:2:2'), EDGE_STATES.line);
  // 第一次 Undo 只回滚第二个手势
  const t = transactions.pop();
  for (const { key, from } of t.changes) edges.set(key, from);
  assert.equal(edges.get('h:2:2'), EDGE_STATES.undecided);
  assert.equal(edges.get('h:2:1'), EDGE_STATES.line, '第一个手势不受影响');
});

test('方案 B line 工具点按已有 line：无变化不入栈', () => {
  const lineKey = 'h:2:1';
  const { controller, transactions } = createHarness({ scheme: SCHEMES.b, tool: TOOLS.line, initial: { [lineKey]: EDGE_STATES.line } });
  controller.handlePointerDown({ local: edgeMidpoint(...[h(2, 1).orientation, 2, 1]), pointerId: 1, button: 0 });
  controller.handlePointerUp({ pointerId: 1 });
  assert.equal(transactions.length, 0, 'line 工具点按已有 line 无变化不入栈');
});

test('pointercancel：点按手势中取消（无 up）无残留不入栈', () => {
  const { controller, edges, transactions } = createHarness();
  controller.handlePointerDown({ local: edgeMidpoint(...[h(2, 1).orientation, 2, 1]), pointerId: 1, button: 0 });
  controller.handlePointerCancel({ pointerId: 1 });
  assert.ok(!edges.has('h:2:1'), '取消后无残留变更');
  assert.equal(transactions.length, 0, '取消不入栈');
});

test('pointercancel：拖动单边添加后回滚', () => {
  const { controller, edges, transactions } = createHarness();
  controller.handlePointerDown({ local: edgeMidpoint(...[h(2, 1).orientation, 2, 1]), pointerId: 1, button: 0 });
  controller.handlePointerMove({ local: edgeMidpoint(...[h(2, 2).orientation, 2, 2]), pointerId: 1 });
  controller.handlePointerCancel({ pointerId: 1 });
  assert.equal(edges.get('h:2:1'), EDGE_STATES.undecided, '起点添加预览被回滚');
  assert.equal(edges.get('h:2:2'), EDGE_STATES.undecided, '经过边添加预览被回滚');
  assert.equal(transactions.length, 0);
});

test('pointercancel：拖动单边擦除后回滚', () => {
  const lineKey = 'h:2:1';
  const { controller, edges, transactions } = createHarness({ initial: { [lineKey]: EDGE_STATES.line } });
  controller.handlePointerDown({ local: edgeMidpoint(...[h(2, 1).orientation, 2, 1]), pointerId: 1, button: 0 });
  controller.handlePointerMove({ local: edgeMidpoint(...[h(2, 2).orientation, 2, 2]), pointerId: 1 });
  controller.handlePointerCancel({ pointerId: 1 });
  assert.equal(edges.get(lineKey), EDGE_STATES.line, '擦除预览被回滚');
  assert.equal(transactions.length, 0);
});

test('pointercancel 回滚全部未提交变更', () => {
  const { controller, edges, transactions } = createHarness();
  const a = edgeMidpoint(...[h(2, 1).orientation, 2, 1]);
  const b = edgeMidpoint(...[h(2, 2).orientation, 2, 2]);
  controller.handlePointerDown({ local: a, pointerId: 1, button: 0 });
  controller.handlePointerMove({ local: b, pointerId: 1 });
  controller.handlePointerCancel({ pointerId: 1 });
  assert.equal(edges.get('h:2:1'), EDGE_STATES.undecided, '起点回滚');
  assert.equal(edges.get('h:2:2'), EDGE_STATES.undecided, '经过边回滚');
  assert.equal(transactions.length, 0, '取消不入栈');
});

test('窗口失焦等效 pointercancel 回滚', () => {
  const { controller, edges, transactions } = createHarness();
  controller.handlePointerDown({ local: edgeMidpoint(...[h(2, 1).orientation, 2, 1]), pointerId: 1, button: 0 });
  controller.handlePointerMove({ local: edgeMidpoint(...[h(2, 2).orientation, 2, 2]), pointerId: 1 });
  controller.handleWindowBlur();
  assert.equal(edges.get('h:2:1'), EDGE_STATES.undecided);
  assert.equal(transactions.length, 0);
});

test('多指隔离：第二指 down 被忽略', () => {
  const { controller, edges, transactions } = createHarness();
  controller.handlePointerDown({ local: edgeMidpoint(...[h(2, 1).orientation, 2, 1]), pointerId: 1, button: 0 });
  controller.handlePointerDown({ local: edgeMidpoint(...[h(2, 2).orientation, 2, 2]), pointerId: 2, button: 0 });
  controller.handlePointerMove({ local: edgeMidpoint(...[h(2, 2).orientation, 2, 2]), pointerId: 1 });
  controller.handlePointerUp({ pointerId: 1 });
  assert.equal(edges.get('h:2:2'), EDGE_STATES.line, '仅首指生效');
  assert.equal(transactions.length, 1);
});

test('方案 B：工具决定模式（line / erase / excluded 点击）', () => {
  const lineKey = 'h:2:2';
  const harness = createHarness({ scheme: SCHEMES.b, tool: TOOLS.line, initial: { [lineKey]: EDGE_STATES.line } });
  // line 工具：拖动 undecided → line；已有 line 不动
  drag(harness.controller, 1, [
    edgeMidpoint(...[h(2, 1).orientation, 2, 1]),
    edgeMidpoint(...[h(2, 2).orientation, 2, 2]),
  ]);
  assert.equal(harness.edges.get('h:2:1'), EDGE_STATES.line);
  assert.equal(harness.edges.get(lineKey), EDGE_STATES.line, 'line 工具不擦除已有 line');

  const harness2 = createHarness({ scheme: SCHEMES.b, tool: TOOLS.erase, initial: { [lineKey]: EDGE_STATES.line } });
  drag(harness2.controller, 1, [
    edgeMidpoint(...[h(2, 2).orientation, 2, 2]),
    edgeMidpoint(...[h(2, 3).orientation, 2, 3]),
  ]);
  assert.equal(harness2.edges.get(lineKey), EDGE_STATES.undecided, 'erase 工具擦除 line');

  const harness3 = createHarness({ scheme: SCHEMES.b, tool: TOOLS.excluded });
  harness3.controller.handlePointerDown({ local: edgeMidpoint(...[h(2, 1).orientation, 2, 1]), pointerId: 1, button: 0 });
  harness3.controller.handlePointerUp({ pointerId: 1 });
  assert.equal(harness3.edges.get('h:2:1'), EDGE_STATES.excluded, 'excluded 工具点按 toggle');
});

test('方案 C：长按 toggle excluded，移动后长按失效', () => {
  const harness = createHarness({ scheme: SCHEMES.c });
  const key = 'h:2:1';
  harness.controller.handlePointerDown({ local: edgeMidpoint(...[h(2, 1).orientation, 2, 1]), pointerId: 1, button: 0 });
  harness.controller.handleLongPressExpired({ pointerId: 1 });
  assert.equal(harness.edges.get(key), EDGE_STATES.excluded, '长按 toggle excluded');
  assert.equal(harness.transactions.length, 1, '长按为一次手势一个 undo');

  // 移动后长按失效：不产生 excluded
  const harness2 = createHarness({ scheme: SCHEMES.c });
  harness2.controller.handlePointerDown({ local: edgeMidpoint(...[h(2, 1).orientation, 2, 1]), pointerId: 1, button: 0 });
  harness2.controller.handlePointerMove({ local: edgeMidpoint(...[h(2, 2).orientation, 2, 2]), pointerId: 1 });
  harness2.controller.handleLongPressExpired({ pointerId: 1 });
  assert.equal(harness2.edges.get('h:2:1'), EDGE_STATES.line, '长按不触发 line 拖动，且移动后长按取消');
  harness2.controller.handlePointerUp({ pointerId: 1 });
  assert.equal(harness2.transactions.length, 1);
});

test('excluded 边作为主键起点时不启动手势（P4B 待测项）', () => {
  const exKey = 'h:2:2';
  const { controller, edges } = createHarness({ initial: { [exKey]: EDGE_STATES.excluded } });
  drag(controller, 1, [
    edgeMidpoint(...[h(2, 2).orientation, 2, 2]),
    edgeMidpoint(...[h(2, 3).orientation, 2, 3]),
  ]);
  assert.equal(edges.get(exKey), EDGE_STATES.excluded);
  assert.ok(!edges.has('h:2:3'), '手势未启动，后续边未被修改');
});
