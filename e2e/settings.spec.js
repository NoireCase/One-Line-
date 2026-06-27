import { test, expect } from '@playwright/test';
import { S } from './helpers/selectors.js';
import { openSettings, closeSettings } from './helpers/navigation.js';
import { clearAllGameData, getStorage } from './helpers/game-state.js';

test.describe('设置面板', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
    await openSettings(page);
  });

  test('设置面板显示标题和选项', async ({ page }) => {
    await expect(page.locator(S.settings.title)).toBeVisible();
    await expect(page.locator(S.settings.mouseMode)).toBeVisible();
    await expect(page.locator(S.settings.keyboardMode)).toBeVisible();
    await expect(page.locator(S.settings.closeButton)).toBeVisible();
  });

  test('默认选中拖拽模式', async ({ page }) => {
    await expect(page.locator(S.settings.mouseMode)).toHaveClass(/border-teal-700/);
  });

  test('切换到键盘模式并验证 localStorage 更新', async ({ page }) => {
    await page.locator(S.settings.keyboardMode).click();
    await expect(page.locator(S.settings.keyboardMode)).toHaveClass(/border-teal-700/);

    const inputMode = await getStorage(page, 'cg_input_mode');
    expect(inputMode).toBe('keyboard');
  });

  test('切换回拖拽模式', async ({ page }) => {
    await page.locator(S.settings.keyboardMode).click();
    await page.locator(S.settings.mouseMode).click();
    await expect(page.locator(S.settings.mouseMode)).toHaveClass(/border-teal-700/);

    const inputMode = await getStorage(page, 'cg_input_mode');
    expect(inputMode).toBe('mouse');
  });

  test('关闭设置面板', async ({ page }) => {
    await closeSettings(page);
    await expect(page.locator(S.home.startButton)).toBeVisible();
  });
});
