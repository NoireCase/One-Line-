import { test, expect } from '@playwright/test';
import { clearAllGameData } from './helpers/game-state.js';
import { exitGame, goToLevel, openSettings } from './helpers/navigation.js';

const SINGLE_GUIDANCE_KEY = 'cg_star_line_guidance_v1';
const DOUBLE_GUIDANCE_KEY = 'cg_star_line_double_guidance_v1';
const DOUBLE_NEIGHBORS = [4, 5, 6, 12, 14, 20, 21, 22];
const FINAL_STEP = 22;

function cell(page, idx) {
  return page.locator(`[data-testid="star-line-cell-${idx}"]`);
}

async function expectDoubleStep(page, step, copy) {
  const board = page.locator('[data-testid="star-line-board"]');
  await expect(board).toHaveAttribute('data-guide-kind', 'double-rule');
  await expect(board).toHaveAttribute('data-guide-step', String(step), { timeout: 5000 });
  if (copy) await expect(page.locator('[data-testid="star-line-guide-copy"]')).toContainText(copy);
}

async function continueExplanation(page, step) {
  await expectDoubleStep(page, step);
  const action = page.locator('[data-testid="star-line-double-guide-action"]');
  await expect(action).toHaveText('继续');
  await action.click();
  await expectDoubleStep(page, step + 1);
}

async function runEliminationDemo(page, step, indexes) {
  await expectDoubleStep(page, step);
  const action = page.locator('[data-testid="star-line-double-guide-action"]');
  await expect(action).toHaveText('演示排除');
  await action.click();
  for (const idx of indexes) {
    await expect(cell(page, idx)).toHaveAttribute('data-cell-state', 'marked-x');
  }
  await expectDoubleStep(page, step + 1);
}

async function placeStars(page, step, indexes) {
  await expectDoubleStep(page, step);
  for (const idx of indexes) {
    await cell(page, idx).dblclick();
    await expect(cell(page, idx)).toHaveAttribute('data-cell-state', 'starred');
  }
  if (step < FINAL_STEP) await expectDoubleStep(page, step + 1);
}

async function setCompletedGuides(page) {
  await page.evaluate(({ singleKey, doubleKey, finalStep }) => {
    localStorage.setItem(singleKey, JSON.stringify({
      version: 1,
      operation: { completed: true, step: 4 },
      rules: { completed: true, step: 10 },
      replayRequested: false,
    }));
    localStorage.setItem(doubleKey, JSON.stringify({
      version: 2,
      completed: true,
      step: finalStep,
      replayRequested: false,
    }));
  }, { singleKey: SINGLE_GUIDANCE_KEY, doubleKey: DOUBLE_GUIDANCE_KEY, finalStep: FINAL_STEP });
}

async function expectGuideLayout(page, viewport) {
  await page.setViewportSize(viewport);
  const topbar = await page.locator('.game-topbar--starline').boundingBox();
  const card = await page.locator('[data-testid="star-line-double-guide-card"]').boundingBox();
  const board = await page.locator('[data-testid="star-line-board-container"]').boundingBox();
  const feedback = await page.locator('[data-testid="star-line-feedback"]').boundingBox();
  if (!topbar || !card || !board || !feedback) throw new Error('教学布局元素不可见');
  expect(topbar.y + topbar.height).toBeLessThanOrEqual(card.y);
  expect(card.y + card.height).toBeLessThanOrEqual(board.y);
  expect(board.y + board.height).toBeLessThanOrEqual(feedback.y);
  expect(card.y).toBeGreaterThanOrEqual(0);
  expect(feedback.y + feedback.height).toBeLessThanOrEqual(viewport.height);
}

test.describe('Star Double 第一关完整教学', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
  });

  test('D1. 说明等待继续、八邻完整一致，并按真实推理走到胜利', { tag: '@critical' }, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });

    await expectDoubleStep(page, 1, '每组都必须恰好放 2 颗星');
    await expectGuideLayout(page, { width: 1280, height: 720 });

    // 旧实现会在 3.2 秒后自动跳过；现在说明与动画结束都不能推进。
    await page.waitForTimeout(3400);
    await expectDoubleStep(page, 1);
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), DOUBLE_GUIDANCE_KEY))
      .toMatchObject({ version: 2, completed: false, step: 1 });

    await continueExplanation(page, 1);
    await continueExplanation(page, 2);
    await placeStars(page, 3, [13]);

    await expectDoubleStep(page, 4, '八个相邻格都不能再放星');
    await continueExplanation(page, 4);
    await expectDoubleStep(page, 5);

    // 动画、高亮、允许操作格和最终 X 全部来自同一动态八邻集合。
    await expect(page.locator('.starline-guide-pointer')).toHaveCount(8);
    for (const idx of DOUBLE_NEIGHBORS) {
      await expect(page.locator(`[data-testid="star-line-guide-pointer-${idx}"]`)).toBeVisible();
      await expect(cell(page, idx)).toHaveClass(/is-guide-target/);
    }
    await cell(page, 0).click();
    await expect(cell(page, 0)).toHaveAttribute('data-cell-state', 'empty');
    for (const idx of DOUBLE_NEIGHBORS) {
      await cell(page, idx).click();
      await expect(cell(page, idx)).toHaveAttribute('data-cell-state', 'marked-x');
    }
    await expectDoubleStep(page, 6);

    await continueExplanation(page, 6);
    await runEliminationDemo(page, 7, [8, 9, 10, 16, 26, 28]);
    await continueExplanation(page, 8);
    await runEliminationDemo(page, 9, [24, 25, 35, 37, 43, 45, 51, 53, 59, 61]);
    await placeStars(page, 10, [17]);
    await continueExplanation(page, 11);
    await runEliminationDemo(page, 12, [2, 18, 30, 36, 38, 39, 41, 54, 55]);
    await placeStars(page, 13, [29]);
    await continueExplanation(page, 14);
    await runEliminationDemo(page, 15, [27, 33, 40, 42, 47, 49, 52, 57, 63]);
    await placeStars(page, 16, [32, 34, 44, 46, 60, 62]);
    await continueExplanation(page, 17);
    await runEliminationDemo(page, 18, [0, 11, 23, 56, 58]);
    await placeStars(page, 19, [1, 3, 19, 31, 48, 50]);
    await continueExplanation(page, 20);
    await runEliminationDemo(page, 21, [7]);

    await expectDoubleStep(page, 22, '星域只剩它');
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), DOUBLE_GUIDANCE_KEY))
      .toMatchObject({ completed: false, step: 22 });

    await cell(page, 15).dblclick();
    await expect(page.locator('[data-testid="win-panel"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="win-title"]')).toContainText('星线完成');
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), DOUBLE_GUIDANCE_KEY))
      .toMatchObject({ version: 2, completed: true, step: 22, replayRequested: false });
  });

  test('D2. 固定提示卡在两种桌面尺寸均不遮挡标题、棋盘或状态栏', async ({ page }) => {
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    await expectGuideLayout(page, { width: 1280, height: 720 });
    await expectGuideLayout(page, { width: 1440, height: 900 });
  });

  test('D3. 中途保存后恢复当前操作，完成记录仍为未完成', async ({ page }) => {
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    await continueExplanation(page, 1);
    await continueExplanation(page, 2);
    await placeStars(page, 3, [13]);
    await continueExplanation(page, 4);
    for (const idx of [4, 5, 6]) {
      await cell(page, idx).click();
      await expect(cell(page, idx)).toHaveAttribute('data-cell-state', 'marked-x');
    }
    await exitGame(page, 'save');

    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    await expectDoubleStep(page, 5);
    for (const idx of [4, 5, 6]) {
      await expect(cell(page, idx)).toHaveAttribute('data-cell-state', 'marked-x');
    }
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), DOUBLE_GUIDANCE_KEY))
      .toMatchObject({ completed: false, step: 5 });
  });

  test('D4. 设置可单独重播双星完整教学，单星记录不受影响', async ({ page }) => {
    const progress = {
      version: 1,
      games: {
        starSingle: { completed: { 'star-lv-01': 3 }, unlockedThroughId: 'star-lv-02' },
        starDouble: { completed: {}, unlockedThroughId: 'star-lv-21' },
      },
    };
    await page.evaluate(value => {
      localStorage.setItem('cg_star_line_progress_v2', JSON.stringify(value));
    }, progress);
    await setCompletedGuides(page);
    const singleBefore = await page.evaluate(key => localStorage.getItem(key), SINGLE_GUIDANCE_KEY);

    await openSettings(page);
    const replay = page.locator('[data-testid="star-line-double-guide-replay-button"]');
    await expect(replay).toBeEnabled();
    await replay.click();
    await expect(replay).toHaveText('已开启');
    expect(await page.evaluate(key => localStorage.getItem(key), SINGLE_GUIDANCE_KEY)).toBe(singleBefore);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cg_star_line_progress_v2')))).toEqual(progress);

    await page.locator('[data-testid="settings-close-button"]').click();
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    await expectDoubleStep(page, 1);
  });
});
