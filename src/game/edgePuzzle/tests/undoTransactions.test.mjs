// Production Edge Puzzle Foundation · 通用 transaction 工具测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UndoStack, MAX_UNDO } from '../undoTransactions.js';

test('push / pop 往返：transaction 记录 before/after 状态（可逆）', () => {
  const stack = new UndoStack();
  const tx = [{ key: 'h:2:1', from: 'undecided', to: 'line' }];
  assert.equal(stack.push(tx), true);
  assert.equal(stack.size, 1);
  const popped = stack.pop();
  assert.deepEqual(popped, tx);
  assert.equal(stack.size, 0);
});

test('空 transaction 不入栈', () => {
  const stack = new UndoStack();
  assert.equal(stack.push(null), false);
  assert.equal(stack.push([]), false);
  assert.equal(stack.size, 0);
});

test('空栈 pop 返回 null', () => {
  const stack = new UndoStack();
  assert.equal(stack.pop(), null);
});

test('clear 清空栈', () => {
  const stack = new UndoStack();
  stack.push([{ key: 'h:2:1', from: 'undecided', to: 'line' }]);
  stack.push([{ key: 'h:2:2', from: 'undecided', to: 'line' }]);
  stack.clear();
  assert.equal(stack.size, 0);
  assert.equal(stack.pop(), null);
});

test('容量上限：超出后丢弃最旧 transaction', () => {
  const stack = new UndoStack(2);
  stack.push([{ key: 'a', from: 'undecided', to: 'line' }]);
  stack.push([{ key: 'b', from: 'undecided', to: 'line' }]);
  stack.push([{ key: 'c', from: 'undecided', to: 'line' }]);
  assert.equal(stack.size, 2);
  const newest = stack.pop();
  assert.equal(newest[0].key, 'c');
  const next = stack.pop();
  assert.equal(next[0].key, 'b');
  assert.equal(stack.pop(), null, '最旧的 a 已被丢弃');
});

test('默认上限 MAX_UNDO = 20', () => {
  const stack = new UndoStack();
  for (let i = 0; i < 25; i += 1) {
    stack.push([{ key: `h:0:${i % 5}`, from: 'undecided', to: 'line' }]);
  }
  assert.equal(stack.size, MAX_UNDO);
});

test('transaction 可逆：按 from 恢复即可还原状态', () => {
  const stack = new UndoStack();
  stack.push([{ key: 'h:2:1', from: 'excluded', to: 'line' }]); // 左键覆盖 X
  const tx = stack.pop();
  for (const { key, from } of tx) {
    assert.equal(key, 'h:2:1');
    assert.equal(from, 'excluded', 'Undo 恢复被覆盖前的 excluded');
  }
});
