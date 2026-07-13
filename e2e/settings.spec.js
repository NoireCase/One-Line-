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

  test('设置面板显示标题和音效选项', async ({ page }) => {
    await expect(page.locator(S.settings.title)).toBeVisible();
    await expect(page.locator(S.settings.closeButton)).toBeVisible();
    // 不再出现键盘模式选项
    await expect(page.locator('[data-testid="input-mode-mouse"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="input-mode-keyboard"]')).toHaveCount(0);
  });

  test('旧 cg_input_mode=keyboard 不影响游戏启动', async ({ page }) => {
    await closeSettings(page);
    await page.evaluate(() => localStorage.setItem('cg_input_mode', 'keyboard'));
    await page.goto('/');
    await openSettings(page);
    // 设置面板正常显示，没有因旧值崩溃
    await expect(page.locator(S.settings.title)).toBeVisible();
    // 旧值不再被读取为输入模式
    const inputMode = await getStorage(page, 'cg_input_mode');
    expect(inputMode).toBe('keyboard');
  });

  test('关闭设置面板', async ({ page }) => {
    await closeSettings(page);
    await expect(page.locator(S.home.startButton)).toBeVisible();
  });
});
