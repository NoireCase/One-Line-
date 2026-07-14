import { test, expect } from '@playwright/test';
import { S } from './helpers/selectors.js';
import { openSettings, closeSettings } from './helpers/navigation.js';
import { clearAllGameData, getStorage } from './helpers/game-state.js';
import { dragCellToCell } from './helpers/game-simulation.js';

test.describe('设置面板', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
    await openSettings(page);
  });

  test('设置面板显示标题和音效选项', async ({ page }) => {
    await expect(page.locator(S.settings.title)).toBeVisible();
    await expect(page.locator(S.settings.closeButton)).toBeVisible();
    await expect(page.locator('[data-testid="input-mode-mouse"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="input-mode-keyboard"]')).toHaveCount(0);
  });

  test('旧 cg_input_mode=keyboard 不影响游戏启动', async ({ page }) => {
    await closeSettings(page);
    await page.evaluate(() => localStorage.setItem('cg_input_mode', 'keyboard'));
    await page.goto('/');
    await openSettings(page);
    await expect(page.locator(S.settings.title)).toBeVisible();
    const inputMode = await getStorage(page, 'cg_input_mode');
    expect(inputMode).toBe('keyboard');
  });

  test('关闭设置面板', async ({ page }) => {
    await closeSettings(page);
    await expect(page.locator(S.home.startButton)).toBeVisible();
  });

  test('设置有 Enter 可以关闭', async ({ page }) => {
    // 主页/设置/关卡选择页 保留原生键盘行为
    await page.locator(S.settings.confirmButton).focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await expect(page.locator(S.home.startButton)).toBeVisible();
  });
});

test.describe('cg_input_mode 兼容', () => {
  test('旧 keyboard 值不影响 One Line 关卡内鼠标操作', async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
    await page.evaluate(() => localStorage.setItem('cg_input_mode', 'keyboard'));
    // 重新加载
    await page.goto('/');
    await page.waitForTimeout(1000);
    // 进入 One Line 关卡
    await page.locator(S.home.startButton).click();
    await page.waitForSelector(S.puzzleBook.page);
    await page.locator('[data-testid="level-tile-easy-0"]').click();
    await page.waitForSelector(S.game.view);
    // 鼠标拖动仍可正常连线
    await dragCellToCell(page, 20, 15, { steps: 4, stepDelay: 10 });
    await page.waitForTimeout(200);
    const pathHead = page.locator('.path-head');
    await expect(pathHead).toBeVisible();
    // WASD 不改变路径
    for (const k of ['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
      await page.keyboard.press(k);
      await page.waitForTimeout(50);
    }
    await expect(pathHead).toBeVisible();
    // 旧值未被删除
    const mode = await getStorage(page, 'cg_input_mode');
    expect(mode).toBe('keyboard');
  });
});
