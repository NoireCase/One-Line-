import { test, expect } from '@playwright/test';
import { S } from './helpers/selectors.js';
import { clearAllGameData } from './helpers/game-state.js';
import { goToLevel } from './helpers/navigation.js';

test.describe('Production smoke', () => {
  test('production 首页可进入谜题书和普通关卡，且没有未捕获异常', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/');
    await expect(page.locator(S.home.view)).toBeVisible();
    await page.locator(S.home.startButton).click();
    await expect(page.locator(S.puzzleBook.page)).toBeVisible();
    await page.locator(S.puzzleBook.levelTile('easy-0')).click();
    await expect(page.locator(S.game.board)).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('production 默认不显示 Star Line GM 工具', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/');
    await page.locator(S.home.starLineButton).click();
    await expect(page.locator(S.puzzleBook.page)).toBeVisible();
    await page.locator(S.puzzleBook.levelTile('easy-0')).click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();
    await expect(page.locator('[data-testid="star-line-gm-button"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="star-line-gm-panel"]')).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test('production 不暴露 Star Double E2E proof bridge', async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
    await page.evaluate(() => localStorage.setItem('cg_star_line_progress_v2', JSON.stringify({
      version: 1,
      games: {
        starSingle: { completed: {}, unlockedThroughId: 'star-lv-01' },
        starDouble: {
          completed: {},
          unlockedThroughId: 'star-double-tutorial-02',
        },
      },
    })));
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-1' });
    await page.locator('[data-testid="star-line-double-guide-action"]').click();
    await expect(page.locator('[data-testid="star-line-double-guide-card"]'))
      .toHaveAttribute('data-proof-action', 'place-star');
    expect(await page.evaluate(() => (
      Object.prototype.hasOwnProperty.call(window, '__STAR_DOUBLE_E2E_PROOF__')
    ))).toBe(false);
  });
});
