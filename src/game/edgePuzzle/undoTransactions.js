// Production Edge Puzzle Foundation · 通用 transaction 工具（纯逻辑）
// change record：{ key, from, to }（before / after 状态，可逆）。
// 一次手势 = 一个 transaction；无变化手势不入栈；pointercancel 不入栈。
// 本包不建立正式 Session undo stack（仅提供通用工具供原型与后续 Runtime 复用）。

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
