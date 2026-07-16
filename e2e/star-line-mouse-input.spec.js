import { test, expect } from '@playwright/test';
import { goToLevel } from './helpers/navigation.js';
import { clearAllGameData } from './helpers/game-state.js';

async function openStarLineLevel(page, levelKey = 'easy-0') {
  await page.goto('/');
  await clearAllGameData(page);
  await page.evaluate(() => {
    localStorage.setItem('cg_discovery_star_line_basic_v1', '1');
    localStorage.setItem('cg_discovery_star_line_double_star_v1', '1');
    localStorage.setItem('cg_star_line_progress_v2', JSON.stringify({
      version: 1,
      games: {
        starSingle: { completed: {}, unlockedThroughId: 'star-lv-20' },
        starDouble: { completed: {}, unlockedThroughId: 'star-lv-30' },
      },
    }));
  });
  await goToLevel(page, { modeId: 'starSingle', levelKey });
}

function cell(page, idx) {
  return page.locator(`[data-testid="star-line-cell-${idx}"]`);
}

function xMark(page, idx) {
  return page.locator(`[data-testid="star-line-x-${idx}"]`);
}

function starMark(page, idx) {
  return page.locator(`[data-testid="star-line-star-${idx}"]`);
}

async function cellCenter(page, idx) {
  const box = await cell(page, idx).boundingBox();
  if (!box) throw new Error(`Cell ${idx} not visible`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function mouseDragAcross(page, cellIndices, { steps = 3, pause = 10 } = {}) {
  const first = await cellCenter(page, cellIndices[0]);
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const idx of cellIndices.slice(1)) {
    const point = await cellCenter(page, idx);
    await page.mouse.move(point.x, point.y, { steps });
    if (pause) await page.waitForTimeout(pause);
  }
  await page.mouse.up();
}

test.describe('Star Line 直接输入', () => {
  test.beforeEach(async ({ page }) => {
    await openStarLineLevel(page);
  });

  test('工具切换已移除，辅助高亮与撤销保留', async ({ page }) => {
    await expect(page.getByRole('button', { name: '放置' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '排除' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '清除' })).toHaveCount(0);
    await expect(page.locator('[data-testid="star-line-assist-toggle"]')).toBeVisible();
    await expect(page.locator('[data-testid="star-line-undo-button"]')).toBeVisible();
  });

  test('空白格单击添加 X，已有 X 单击清除，且各占一步撤销', async ({ page }) => {
    const undo = page.locator('[data-testid="star-line-undo-button"]');
    await cell(page, 12).click();
    await expect(xMark(page, 12)).toBeVisible();

    await cell(page, 12).click();
    await expect(xMark(page, 12)).toHaveCount(0);
    await undo.click();
    await expect(xMark(page, 12)).toBeVisible();
    await undo.click();
    await expect(xMark(page, 12)).toHaveCount(0);
    await expect(undo).toBeDisabled();
  });

  test('已有星单击清除，并可一步撤销恢复', async ({ page }) => {
    await cell(page, 6).dblclick();
    await expect(starMark(page, 6)).toBeVisible();
    await cell(page, 6).click();
    await expect(starMark(page, 6)).toHaveCount(0);
    await expect(xMark(page, 6)).toHaveCount(0);
    await page.locator('[data-testid="star-line-undo-button"]').click();
    await expect(starMark(page, 6)).toBeVisible();
  });

  test('空白格双击直接放星，过程中 X 从未进入 DOM', async ({ page }) => {
    await cell(page, 7).evaluate((element) => {
      window.__starLineXSeenDuringDoubleClick = false;
      const observer = new MutationObserver(() => {
        if (element.querySelector('[data-testid^="star-line-x-"]')) {
          window.__starLineXSeenDuringDoubleClick = true;
        }
      });
      observer.observe(element, { childList: true, subtree: true });
      window.__starLineDoubleClickObserver = observer;
    });

    await cell(page, 7).dblclick();
    await expect(starMark(page, 7)).toBeVisible();
    expect(await page.evaluate(() => window.__starLineXSeenDuringDoubleClick)).toBe(false);
    await page.evaluate(() => window.__starLineDoubleClickObserver?.disconnect());
  });

  test('空白格双击只产生一个撤销步骤', async ({ page }) => {
    const undo = page.locator('[data-testid="star-line-undo-button"]');
    await cell(page, 8).dblclick();
    await expect(starMark(page, 8)).toBeVisible();
    await undo.click();
    await expect(starMark(page, 8)).toHaveCount(0);
    await expect(xMark(page, 8)).toHaveCount(0);
    await expect(undo).toBeDisabled();
  });

  test('已有 X 双击直接改为星，且转换只占一个撤销步骤', async ({ page }) => {
    const undo = page.locator('[data-testid="star-line-undo-button"]');
    await cell(page, 9).click();
    await expect(xMark(page, 9)).toBeVisible();
    await cell(page, 9).dblclick();
    await expect(starMark(page, 9)).toBeVisible();
    await expect(xMark(page, 9)).toHaveCount(0);
    await undo.click();
    await expect(xMark(page, 9)).toBeVisible();
    await expect(starMark(page, 9)).toHaveCount(0);
  });

  test('已有星双击不变且不产生历史', async ({ page }) => {
    const undo = page.locator('[data-testid="star-line-undo-button"]');
    await cell(page, 10).dblclick();
    await expect(starMark(page, 10)).toBeVisible();
    await cell(page, 10).dblclick();
    await expect(starMark(page, 10)).toBeVisible();
    await undo.click();
    await expect(starMark(page, 10)).toHaveCount(0);
    await expect(undo).toBeDisabled();
  });

  test('小幅移动仍按单击处理', async ({ page }) => {
    const start = await cellCenter(page, 0);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 3, start.y + 2);
    await page.mouse.up();
    await expect(xMark(page, 0)).toBeVisible();
    await expect(xMark(page, 1)).toHaveCount(0);
  });

  test('拖动空白格连续添加 X，并包含起点', async ({ page }) => {
    await mouseDragAcross(page, [10, 11, 12, 13, 14]);
    for (const idx of [10, 11, 12, 13, 14]) {
      await expect(xMark(page, idx)).toBeVisible();
    }
  });

  test('从已有 X 起拖会锁定连续清除模式，整段只占一步撤销', async ({ page }) => {
    const undo = page.locator('[data-testid="star-line-undo-button"]');
    await mouseDragAcross(page, [10, 11, 12, 13, 14]);
    for (const idx of [10, 11, 12, 13, 14]) await expect(xMark(page, idx)).toBeVisible();

    await mouseDragAcross(page, [10, 11, 12, 13, 14]);
    for (const idx of [10, 11, 12, 13, 14]) await expect(xMark(page, idx)).toHaveCount(0);
    await page.waitForTimeout(350);
    for (const idx of [10, 11, 12, 13, 14]) await expect(xMark(page, idx)).toHaveCount(0);

    await undo.click();
    for (const idx of [10, 11, 12, 13, 14]) await expect(xMark(page, idx)).toBeVisible();
    await undo.click();
    for (const idx of [10, 11, 12, 13, 14]) await expect(xMark(page, idx)).toHaveCount(0);
    await expect(undo).toBeDisabled();
  });

  test('从星起拖不添加或清除任何标记，也不触发延迟单击', async ({ page }) => {
    await cell(page, 10).dblclick();
    await expect(starMark(page, 10)).toBeVisible();
    await cell(page, 11).click();
    await expect(xMark(page, 11)).toBeVisible();
    await mouseDragAcross(page, [10, 11, 12]);
    await expect(starMark(page, 10)).toBeVisible();
    await expect(xMark(page, 11)).toBeVisible();
    await expect(xMark(page, 12)).toHaveCount(0);
    await page.waitForTimeout(350);
    await expect(starMark(page, 10)).toBeVisible();
    await expect(xMark(page, 11)).toBeVisible();
    await expect(xMark(page, 12)).toHaveCount(0);
  });

  test('添加模式经过已有 X 和星时保持添加模式且不反复切换', async ({ page }) => {
    await cell(page, 11).click();
    await expect(xMark(page, 11)).toBeVisible();
    await cell(page, 12).dblclick();
    await expect(starMark(page, 12)).toBeVisible();

    await mouseDragAcross(page, [10, 11, 12, 13, 11, 10]);
    await expect(xMark(page, 10)).toBeVisible();
    await expect(xMark(page, 11)).toBeVisible();
    await expect(starMark(page, 12)).toBeVisible();
    await expect(xMark(page, 12)).toHaveCount(0);
    await expect(xMark(page, 13)).toBeVisible();
    expect(await page.locator('[data-testid^="star-line-x-"]').count()).toBe(3);
  });

  test('清除模式经过空白后仍继续清除后续 X，绕回时不会重新添加', async ({ page }) => {
    for (const idx of [10, 11, 13, 14]) await cell(page, idx).click();
    for (const idx of [10, 11, 13, 14]) await expect(xMark(page, idx)).toBeVisible();
    await expect(xMark(page, 12)).toHaveCount(0);

    await mouseDragAcross(page, [10, 11, 12, 13, 14, 13, 10]);
    for (const idx of [10, 11, 12, 13, 14]) await expect(xMark(page, idx)).toHaveCount(0);
  });

  test('清除模式经过星时跳过星，并继续清除后续 X', async ({ page }) => {
    for (const idx of [10, 11, 14]) await cell(page, idx).click();
    await expect(xMark(page, 14)).toBeVisible();
    await cell(page, 12).dblclick();
    await expect(starMark(page, 12)).toBeVisible();

    await mouseDragAcross(page, [10, 11, 12, 13, 14]);
    for (const idx of [10, 11, 13, 14]) await expect(xMark(page, idx)).toHaveCount(0);
    await expect(starMark(page, 12)).toBeVisible();
    await expect(xMark(page, 12)).toHaveCount(0);

    await page.locator('[data-testid="star-line-undo-button"]').click();
    for (const idx of [10, 11, 14]) await expect(xMark(page, idx)).toBeVisible();
    await expect(xMark(page, 13)).toHaveCount(0);
    await expect(starMark(page, 12)).toBeVisible();
  });

  test('从 X 轻微移动未超过阈值时只按单击清除一个 X', async ({ page }) => {
    await cell(page, 10).click();
    await cell(page, 11).click();
    await expect(xMark(page, 10)).toBeVisible();
    await expect(xMark(page, 11)).toBeVisible();

    const start = await cellCenter(page, 10);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 3, start.y + 2);
    await page.mouse.up();
    await expect(xMark(page, 10)).toHaveCount(0);
    await expect(xMark(page, 11)).toBeVisible();
  });

  for (const { name, start, end, expected } of [
    { name: '横向', start: 0, end: 4, expected: [0, 1, 2, 3, 4] },
    { name: '纵向', start: 0, end: 20, expected: [0, 5, 10, 15, 20] },
    { name: '斜向', start: 0, end: 24, expected: [0, 6, 12, 18, 24] },
  ]) {
    test(`快速${name}拖动可以补齐路径`, async ({ page }) => {
      const from = await cellCenter(page, start);
      const to = await cellCenter(page, end);
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 1 });
      await page.mouse.up();
      for (const idx of expected) await expect(xMark(page, idx)).toBeVisible();
      expect(await page.locator('[data-testid^="star-line-x-"]:not([data-testid^="star-line-x-exit-"])').count()).toBe(expected.length);
    });
  }

  for (const { name, start, end, expected } of [
    { name: '横向', start: 0, end: 4, expected: [0, 1, 2, 3, 4] },
    { name: '纵向', start: 0, end: 20, expected: [0, 5, 10, 15, 20] },
    { name: '斜向', start: 0, end: 24, expected: [0, 6, 12, 18, 24] },
  ]) {
    test(`快速${name}清除不漏 X 且不清除旁边格`, async ({ page }) => {
      const from = await cellCenter(page, start);
      const to = await cellCenter(page, end);
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 1 });
      await page.mouse.up();
      for (const idx of expected) await expect(xMark(page, idx)).toBeVisible();
      expect(await page.locator('[data-testid^="star-line-x-"]:not([data-testid^="star-line-x-exit-"])').count()).toBe(expected.length);

      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 1 });
      await page.mouse.up();
      for (const idx of expected) await expect(xMark(page, idx)).toHaveCount(0);
      expect(await page.locator('[data-testid^="star-line-x-"]:not([data-testid^="star-line-x-exit-"])').count()).toBe(0);
    });
  }

  test('拖出棋盘后返回可以继续同一次拖动', async ({ page }) => {
    const board = await page.locator('[data-testid="star-line-board"]').boundingBox();
    const start = await cellCenter(page, 10);
    const end = await cellCenter(page, 14);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(board.x - 30, start.y, { steps: 2 });
    await page.mouse.move(end.x, end.y, { steps: 1 });
    await page.mouse.up();
    for (const idx of [10, 11, 12, 13, 14]) await expect(xMark(page, idx)).toBeVisible();
  });

  test('清除拖出棋盘后返回会继续原来的清除模式', async ({ page }) => {
    await mouseDragAcross(page, [10, 11, 12, 13, 14]);
    for (const idx of [10, 11, 12, 13, 14]) await expect(xMark(page, idx)).toBeVisible();

    const board = await page.locator('[data-testid="star-line-board"]').boundingBox();
    const start = await cellCenter(page, 10);
    const end = await cellCenter(page, 14);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(board.x - 30, start.y, { steps: 2 });
    await page.mouse.move(end.x, end.y, { steps: 1 });
    await page.mouse.up();
    for (const idx of [10, 11, 12, 13, 14]) await expect(xMark(page, idx)).toHaveCount(0);
  });

  test('一整段拖动只需一次撤销', async ({ page }) => {
    const undo = page.locator('[data-testid="star-line-undo-button"]');
    await mouseDragAcross(page, [5, 6, 7, 8, 9]);
    await undo.click();
    for (const idx of [5, 6, 7, 8, 9]) await expect(xMark(page, idx)).toHaveCount(0);
    await expect(undo).toBeDisabled();
  });

  test('只经过已有星的拖动不产生空历史', async ({ page }) => {
    const undo = page.locator('[data-testid="star-line-undo-button"]');
    await cell(page, 12).dblclick();
    await expect(starMark(page, 12)).toBeVisible();
    const center = await cellCenter(page, 12);
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x + 8, center.y);
    await page.mouse.up();
    await undo.click();
    await expect(starMark(page, 12)).toHaveCount(0);
    await expect(undo).toBeDisabled();
  });

  test('pointer cancel 后不残留拖动状态', async ({ page }) => {
    await page.locator('[data-testid="star-line-board"]').evaluate((board) => {
      board.addEventListener('pointerdown', event => {
        window.__starLinePointerId = event.pointerId;
      }, { capture: true, once: true });
    });
    const start = await cellCenter(page, 10);
    const next = await cellCenter(page, 11);
    const afterCancel = await cellCenter(page, 12);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(next.x, next.y);
    await page.evaluate(() => {
      document.querySelector('[data-testid="star-line-board"]').dispatchEvent(new PointerEvent('pointercancel', {
        bubbles: true,
        pointerId: window.__starLinePointerId,
        isPrimary: true,
      }));
    });
    await page.mouse.move(afterCancel.x, afterCancel.y);
    await page.mouse.up();
    await expect(xMark(page, 10)).toBeVisible();
    await expect(xMark(page, 11)).toBeVisible();
    await expect(xMark(page, 12)).toHaveCount(0);
  });

  test('页面失焦后不残留拖动状态', async ({ page }) => {
    const start = await cellCenter(page, 15);
    const next = await cellCenter(page, 16);
    const afterBlur = await cellCenter(page, 17);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(next.x, next.y);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.mouse.move(afterBlur.x, afterBlur.y);
    await page.mouse.up();
    await expect(xMark(page, 15)).toBeVisible();
    await expect(xMark(page, 16)).toBeVisible();
    await expect(xMark(page, 17)).toHaveCount(0);
  });

  test('清除拖动在页面失焦后结束且不继续清除', async ({ page }) => {
    await mouseDragAcross(page, [15, 16, 17]);
    for (const idx of [15, 16, 17]) await expect(xMark(page, idx)).toBeVisible();

    const start = await cellCenter(page, 15);
    const next = await cellCenter(page, 16);
    const afterBlur = await cellCenter(page, 17);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(next.x, next.y);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.mouse.move(afterBlur.x, afterBlur.y);
    await page.mouse.up();
    await expect(xMark(page, 15)).toHaveCount(0);
    await expect(xMark(page, 16)).toHaveCount(0);
    await expect(xMark(page, 17)).toBeVisible();
  });

  test('右键不修改格子也不产生历史', async ({ page }) => {
    const point = await cellCenter(page, 12);
    await page.mouse.click(point.x, point.y, { button: 'right' });
    await expect(xMark(page, 12)).toHaveCount(0);
    await expect(starMark(page, 12)).toHaveCount(0);
    await expect(page.locator('[data-testid="star-line-undo-button"]')).toBeDisabled();
  });

  test('连续单击不同格子会立即提交前一格且顺序正确', async ({ page }) => {
    await cell(page, 0).click();
    await cell(page, 1).click();
    expect(await xMark(page, 0).count()).toBe(1);
    await cell(page, 2).click();
    expect(await xMark(page, 1).count()).toBe(1);
    await expect(xMark(page, 2)).toBeVisible();
    expect(await page.locator('[data-testid^="star-line-x-"]').count()).toBe(3);
  });

  test('最多保留 20 个正式操作步骤', async ({ page }) => {
    const undo = page.locator('[data-testid="star-line-undo-button"]');
    const indexes = [
      0, 1, 5, 6, 10, 11, 15, 16, 20, 21,
      2, 3, 7, 8, 12, 13, 17, 18, 22, 23, 4,
    ];
    for (const idx of indexes) await cell(page, idx).click();
    await expect(xMark(page, 4)).toBeVisible();

    for (let count = 0; count < 20; count++) await undo.click();
    await expect(xMark(page, 0)).toBeVisible();
    for (const idx of indexes.slice(1)) await expect(xMark(page, idx)).toHaveCount(0);
    await expect(undo).toBeDisabled();
  });
});
