/**
 * localStorage 读写 + DOM 状态读取的辅助函数。
 * 所有函数通过 page.evaluate 在浏览器上下文中执行。
 */

/** 清除所有 cg_ 前缀的 localStorage 数据 */
export async function clearAllGameData(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      keys.push(localStorage.key(i));
    }
    keys.filter(k => k.startsWith('cg_')).forEach(k => localStorage.removeItem(k));
  });
}

/** 直接设置 localStorage 值 */
export async function setStorage(page, key, value) {
  await page.evaluate(
    ([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)),
    [key, value]
  );
}

/** 读取 localStorage 值（自动 JSON.parse，兼容纯字符串） */
export async function getStorage(page, key) {
  return page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    if (raw === null) return null;
    try { return JSON.parse(raw); } catch { return raw; }
  }, key);
}

/**
 * 获取当前游戏面板的可见数字信息。
 * 仅匹配 .cell-number span 元素（每个 cell 只有一个）。
 * @returns {{ index: number, val: number | null }[]}
 */
export async function getVisibleNumbers(page) {
  return page.evaluate(() => {
    const spans = document.querySelectorAll('.cell-number[data-index]');
    const result = [];
    spans.forEach(el => {
      const idx = Number(el.getAttribute('data-index'));
      const text = el.textContent.trim();
      const val = text !== '' && text !== '·' && !isNaN(Number(text)) ? Number(text) : null;
      result.push({ index: idx, val });
    });
    return result;
  });
}

/**
 * 获取当前路径长度（path-head + path-visited 的总数）。
 * 注意：head cell 同时有 path-visited 和 path-head class，需要排除重复。
 */
export async function getPathLength(page) {
  return page.evaluate(() => {
    const head = document.querySelector('.path-head');
    // 仅统计非 head 的 visited cell（head 本身也有 path-visited class）
    const visitedOnly = document.querySelectorAll('.path-visited:not(.path-head)');
    return head ? visitedOnly.length + 1 : 0;
  });
}

/**
 * 获取当前路径头部的 cell index。
 */
export async function getPathHeadIndex(page) {
  return page.evaluate(() => {
    const head = document.querySelector('.path-head [data-index]');
    return head ? Number(head.getAttribute('data-index')) : -1;
  });
}

/**
 * 获取棋盘上所有 cell 的 data-index 列表（去重）。
 */
export async function getBoardCellIndices(page) {
  return page.evaluate(() => {
    const cells = document.querySelectorAll('.cell-token[data-index]');
    return [...new Set(Array.from(cells).map(el => Number(el.getAttribute('data-index'))))];
  });
}

/**
 * 通过 React fiber 树读取 gridData（内部状态）。
 * 返回原始 gridData 数组，包含每个 cell 的 { val, isHidden, isRevealed, ... }。
 * React 19 使用 __reactContainer$xxx 存储 fiber 根节点。
 */
export async function readGridDataFromReactFiber(page) {
  return page.evaluate(() => {
    const rootEl = document.getElementById('root');
    // React 19: __reactContainer$xxx (不再是 __reactFiber$xxx)
    const containerKey = Object.keys(rootEl).find(k => k.startsWith('__reactContainer$'));
    if (!containerKey) return null;

    function findGridDataInHooks(fiber) {
      let state = fiber.memoizedState;
      while (state) {
        const val = state.memoizedState;
        if (Array.isArray(val) && val.length >= 25 && val[0] &&
            typeof val[0] === 'object' && 'val' in val[0] && 'isHidden' in val[0]) {
          return val;
        }
        state = state.next;
      }
      return null;
    }

    function walkFiber(fiber, depth) {
      if (!fiber || depth > 50) return null;

      const result = findGridDataInHooks(fiber);
      if (result) return result;

      return walkFiber(fiber.child, depth + 1) || walkFiber(fiber.sibling, depth + 1);
    }

    return walkFiber(rootEl[containerKey], 0);
  });
}

/**
 * 根据 gridData 计算完整解路径（按 val 排序的 cell index 序列）。
 */
export function buildSolutionPath(gridData) {
  return gridData
    .map((cell, idx) => ({ idx, val: cell.val }))
    .sort((a, b) => a.val - b.val)
    .map(c => c.idx);
}

/**
 * 从 HUD 读取当前显示的分数。
 */
export async function getDisplayedScore(page) {
  return page.evaluate(() => {
    const hud = document.querySelector('.hud-surface');
    if (!hud) return null;
    const text = hud.textContent;
    const match = text.match(/(\d+)\s*分/);
    return match ? Number(match[1]) : null;
  });
}
