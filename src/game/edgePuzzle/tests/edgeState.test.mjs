// Production Edge Puzzle Foundation · 三态 Edge State 纯函数测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EDGE_STATES, isValidEdgeState, applyModeToState } from '../edgeState.js';

test('三态互斥：undecided / line / excluded 唯一且互不相等', () => {
  const states = new Set(Object.values(EDGE_STATES));
  assert.equal(states.size, 3);
  assert.equal(EDGE_STATES.undecided, 'undecided');
  assert.equal(EDGE_STATES.line, 'line');
  assert.equal(EDGE_STATES.excluded, 'excluded');
});

test('isValidEdgeState：仅接受三态', () => {
  assert.equal(isValidEdgeState(EDGE_STATES.undecided), true);
  assert.equal(isValidEdgeState(EDGE_STATES.line), true);
  assert.equal(isValidEdgeState(EDGE_STATES.excluded), true);
  assert.equal(isValidEdgeState('other'), false);
  assert.equal(isValidEdgeState(null), false);
  assert.equal(isValidEdgeState(undefined), false);
});

// 冻结规则矩阵（P4B 桌面实测后合同，Line 优先于 X）：
// | 当前状态 | line 通道 | excluded 通道 |
// | undecided | line | excluded |
// | line | undecided | line（保持） |
// | excluded | line（覆盖） | undecided |
test('冻结矩阵：line 通道', () => {
  assert.equal(applyModeToState('paint-line', EDGE_STATES.undecided), EDGE_STATES.line);
  assert.equal(applyModeToState('remove-line', EDGE_STATES.line), EDGE_STATES.undecided);
  assert.equal(applyModeToState('paint-line', EDGE_STATES.excluded), EDGE_STATES.line, 'line 可以覆盖 X');
});

test('冻结矩阵：excluded 通道', () => {
  assert.equal(applyModeToState('paint-excluded', EDGE_STATES.undecided), EDGE_STATES.excluded);
  assert.equal(applyModeToState('paint-excluded', EDGE_STATES.line), EDGE_STATES.line, 'X 不覆盖 line');
  assert.equal(applyModeToState('remove-excluded', EDGE_STATES.excluded), EDGE_STATES.undecided);
});

test('remove-line 不删除 X；remove-excluded 不删除 line', () => {
  assert.equal(applyModeToState('remove-line', EDGE_STATES.excluded), EDGE_STATES.excluded);
  assert.equal(applyModeToState('remove-excluded', EDGE_STATES.line), EDGE_STATES.line);
  assert.equal(applyModeToState('remove-line', EDGE_STATES.undecided), EDGE_STATES.undecided);
  assert.equal(applyModeToState('remove-excluded', EDGE_STATES.undecided), EDGE_STATES.undecided);
});

test('未知模式返回原状态（幂等安全）', () => {
  assert.equal(applyModeToState('unknown', EDGE_STATES.line), EDGE_STATES.line);
  assert.equal(applyModeToState(null, EDGE_STATES.undecided), EDGE_STATES.undecided);
});

test('状态转换可逆：paint 后 remove 恢复原状态', () => {
  assert.equal(
    applyModeToState('remove-excluded', applyModeToState('paint-excluded', EDGE_STATES.undecided)),
    EDGE_STATES.undecided,
  );
  assert.equal(
    applyModeToState('remove-line', applyModeToState('paint-line', EDGE_STATES.undecided)),
    EDGE_STATES.undecided,
  );
  // 覆盖路径：excluded → line → undecided（覆盖后的撤销语义由 transaction 的 from 保证）
  assert.equal(
    applyModeToState('remove-line', applyModeToState('paint-line', EDGE_STATES.excluded)),
    EDGE_STATES.undecided,
  );
});
