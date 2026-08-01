// P4B 数字环线 Spike · 内存 undo 事务栈（纯逻辑）
// 一次手势 = 一个 transaction；无变化手势不入栈；pointercancel 不入栈。
// 不写 localStorage。

export const MAX_UNDO = 20;

export class UndoStack {
  constructor(limit = MAX_UNDO) {
    this.limit = limit;
    this.stack = [];
  }

  get size() {
    return this.stack.length;
  }

  /**
   * 压入一个 transaction（changes 数组）。空 transaction 返回 false。
   */
  push(transaction) {
    if (!transaction || transaction.length === 0) return false;
    this.stack.push(transaction);
    if (this.stack.length > this.limit) this.stack.shift();
    return true;
  }

  /**
   * 弹出最近一个 transaction；空栈返回 null。
   */
  pop() {
    return this.stack.length > 0 ? this.stack.pop() : null;
  }

  clear() {
    this.stack = [];
  }
}
