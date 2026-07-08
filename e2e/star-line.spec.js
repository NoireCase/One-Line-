import { test, expect } from '@playwright/test';
import { S } from './helpers/selectors.js';
import { goToStarLineLevels } from './helpers/navigation.js';
import { clearAllGameData } from './helpers/game-state.js';

test.describe('星线谜阵 (Star Line)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
    // Pre-mark tutorials as seen to prevent them blocking interactions
    await page.evaluate(() => {
      localStorage.setItem('cg_discovery_star_line_basic_v1', '1');
      localStorage.setItem('cg_discovery_star_line_double_star_v1', '1');
    });
    await goToStarLineLevels(page);
  });

  test('独立入口进入 Star Line 关卡页', async ({ page }) => {
    await expect(page.locator(S.puzzleBook.title)).toContainText('星线谜阵');
    await expect(page.locator(S.modeSwitcher.focusCardName)).toContainText('星线谜阵');
    await expect(page.locator(S.modeSwitcher.modeCard('starLine'))).not.toBeVisible();
  });

  test('显示 30 个 Star Line 关卡', async ({ page }) => {
    const tiles = page.locator(S.puzzleBook.levelGrid + ' > button');
    await expect(tiles).toHaveCount(30);
  });

  test('进入第 1 关后存在 25 个 cell', async ({ page }) => {
    const firstTile = page.locator(S.puzzleBook.levelGrid + ' > button').first();
    await firstTile.click();

    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();
    const cells = page.locator('[data-testid^="star-line-cell-"]');
    await expect(cells).toHaveCount(25);
  });

  test('辅助高亮默认关闭，可手动开启和关闭', async ({ page }) => {
    await page.locator(S.puzzleBook.levelGrid + ' > button').first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    const assistToggle = page.locator('[data-testid="star-line-assist-toggle"]');
    const c0 = page.locator('[data-testid="star-line-cell-0"]');
    const unrelatedCell = page.locator('[data-testid="star-line-cell-24"]');

    await expect(assistToggle).toHaveAttribute('aria-pressed', 'false');
    await c0.hover();
    await expect(unrelatedCell).not.toHaveClass(/is-dimmed/);
    await expect(page.getByText(/行 \d+：/)).toHaveCount(0);
    await expect(page.getByText(/列 \d+：/)).toHaveCount(0);
    await expect(page.getByText(/星域 \d+：/)).toHaveCount(0);

    await assistToggle.click();
    await expect(assistToggle).toHaveAttribute('aria-pressed', 'true');
    await c0.hover();
    await expect(unrelatedCell).toHaveClass(/is-dimmed/);

    await assistToggle.click();
    await expect(assistToggle).toHaveAttribute('aria-pressed', 'false');
    await c0.hover();
    await expect(unrelatedCell).not.toHaveClass(/is-dimmed/);
    await expect(page.getByText(/行 \d+：/)).toHaveCount(0);
    await expect(page.getByText(/列 \d+：/)).toHaveCount(0);
    await expect(page.getByText(/星域 \d+：/)).toHaveCount(0);
  });

  test('放置星 / 排除 X / 清除工具可交互', async ({ page }) => {
    await page.locator(S.puzzleBook.levelGrid + ' > button').first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    // 默认选中放置工具，点击第一格放星
    const c0 = page.locator('[data-testid="star-line-cell-0"]');
    await c0.click();
    await expect(page.locator('[data-testid="star-line-star-0"]')).toBeVisible();

    // 切换到排除工具
    await page.locator('button:has-text("排除")').click();
    const c1 = page.locator('[data-testid="star-line-cell-1"]');
    await c1.click();
    await expect(page.locator('[data-testid="star-line-x-1"]')).toBeVisible();

    // 切换到清除工具，清除星
    await page.locator('button:has-text("清除")').click();
    await c0.click();
    await expect(page.locator('[data-testid="star-line-star-0"]')).not.toBeVisible();

    // 清除 X
    await c1.click();
    await expect(page.locator('[data-testid="star-line-x-1"]')).not.toBeVisible();
  });

  test('局内重置清空棋盘', async ({ page }) => {
    await page.locator(S.puzzleBook.levelGrid + ' > button').first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    // 放置星和 X
    await page.locator('[data-testid="star-line-cell-0"]').click();
    await page.locator('button:has-text("排除")').click();
    await page.locator('[data-testid="star-line-cell-1"]').click();
    await expect(page.locator('[data-testid="star-line-star-0"]')).toBeVisible();
    await expect(page.locator('[data-testid="star-line-x-1"]')).toBeVisible();

    // 点击重置
    await page.locator(S.game.restartButton).click();

    // 棋盘应为空
    await expect(page.locator('[data-testid="star-line-star-0"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="star-line-x-1"]')).not.toBeVisible();
  });

  test('返回后重进同一关棋盘为空', async ({ page }) => {
    await page.locator(S.puzzleBook.levelGrid + ' > button').first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    // 放置一颗星
    await page.locator('[data-testid="star-line-cell-0"]').click();
    await expect(page.locator('[data-testid="star-line-star-0"]')).toBeVisible();

    // 返回关卡列表
    await page.locator(S.game.backButton).click();
    await expect(page.locator(S.puzzleBook.title)).toBeVisible();

    // 重新进入同一关
    await page.locator(S.puzzleBook.levelGrid + ' > button').first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    // 棋盘应为空，不残留上一盘状态
    await expect(page.locator('[data-testid="star-line-star-0"]')).not.toBeVisible();
  });

  test('通关后显示结算面板且不因重试再次弹出', async ({ page }) => {
    await page.locator(S.puzzleBook.levelGrid + ' > button').first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    // 按 star-easy-01 的唯一解放置星星: [1, 8, 10, 17, 24]
    const solution = [1, 8, 10, 17, 24];
    for (const idx of solution) {
      await page.locator(`[data-testid="star-line-cell-${idx}"]`).click();
      await expect(page.locator(`[data-testid="star-line-star-${idx}"]`)).toBeVisible();
    }

    // 棋盘容器应出现完成动画 class
    const boardContainer = page.locator('[data-testid="star-line-board-container"]');
    await expect(boardContainer).toHaveClass(/is-complete/);

    // 结算面板应在动画延迟后出现
    await expect(page.locator(S.win.panel)).toBeVisible({ timeout: 3000 });
    await expect(page.locator(S.win.panel)).toContainText('星线完成');

    // 点击重新挑战
    await page.locator(S.win.retryButton).click();

    // 结算面板应立即关闭
    await expect(page.locator(S.win.panel)).not.toBeVisible({ timeout: 1000 });

    // 棋盘应重置为空
    await expect(page.locator('[data-testid="star-line-star-1"]')).not.toBeVisible();

    // 等待超过动画延迟 + 结算触发时间，确认不会再次弹出结算面板
    await page.waitForTimeout(2000);
    await expect(page.locator(S.win.panel)).not.toBeVisible();
  });
});
