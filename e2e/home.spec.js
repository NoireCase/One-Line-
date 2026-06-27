import { test, expect } from '@playwright/test';
import { S } from './helpers/selectors.js';
import { goToHome, goToPuzzleBook } from './helpers/navigation.js';
import { clearAllGameData } from './helpers/game-state.js';

test.describe('首页', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
    await goToHome(page);
  });

  test('渲染首页标题和按钮', async ({ page }) => {
    await expect(page.locator(S.home.title)).toBeVisible();
    await expect(page.locator(S.home.startButton)).toBeVisible();
    await expect(page.locator(S.home.settingsButtonSecondary)).toBeVisible();
  });

  test('无存档时不显示继续解谜按钮', async ({ page }) => {
    await expect(page.locator(S.home.continueButton)).not.toBeVisible();
  });

  test('点击选择玩法进入谜题书', async ({ page }) => {
    await page.locator(S.home.startButton).click();
    await expect(page.locator(S.puzzleBook.title)).toBeVisible({ timeout: 5000 });
  });

  test('底部设置按钮可打开设置面板', async ({ page }) => {
    await page.locator(S.home.settingsButtonSecondary).click();
    await expect(page.locator(S.settings.panel)).toBeVisible({ timeout: 3000 });
  });

  test('从谜题书返回首页', async ({ page }) => {
    await goToPuzzleBook(page);
    await page.locator(S.puzzleBook.backButton).click();
    await expect(page.locator(S.home.title)).toBeVisible({ timeout: 3000 });
    await expect(page.locator(S.home.startButton)).toBeVisible();
  });
});
