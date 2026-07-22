import { test, expect } from '@playwright/test';
import { S } from './helpers/selectors.js';

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
});
