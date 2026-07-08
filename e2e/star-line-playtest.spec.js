import { test, expect } from '@playwright/test';
import { S } from './helpers/selectors.js';
import { goToStarLineLevels } from './helpers/navigation.js';
import { clearAllGameData } from './helpers/game-state.js';

test.describe('星线谜阵 Playtest Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
    // Pre-mark tutorials as seen to prevent them blocking GM button
    await page.evaluate(() => {
      localStorage.setItem('cg_discovery_star_line_basic_v1', '1');
      localStorage.setItem('cg_discovery_star_line_double_star_v1', '1');
    });
    await goToStarLineLevels(page);
  });

  test('P1. Playtest 模式下顶部 GM 按钮可见', async ({ page }) => {
    await page.locator(S.puzzleBook.levelGrid + ' > button').first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    // GM button should be visible in HUD (dev mode)
    await expect(page.locator('[data-testid="star-line-gm-button"]')).toBeVisible();
  });

  test('P2. 点击 GM 按钮后右侧面板出现并可关闭', async ({ page }) => {
    await page.locator(S.puzzleBook.levelGrid + ' > button').first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    // Open panel
    await page.locator('[data-testid="star-line-gm-button"]').click();
    await expect(page.locator('[data-testid="star-line-gm-panel"]')).toBeVisible();

    // Close via X button
    await page.locator('[data-testid="star-line-gm-close"]').click();
    await expect(page.locator('[data-testid="star-line-gm-panel"]')).not.toBeVisible();
  });

  test('P3. 右侧面板显示关卡 metadata', async ({ page }) => {
    await page.locator(S.puzzleBook.levelGrid + ' > button').first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    // Open panel
    await page.locator('[data-testid="star-line-gm-button"]').click();
    await expect(page.locator('[data-testid="star-line-gm-panel"]')).toBeVisible();

    // Check metadata
    await expect(page.locator('[data-testid="playtest-info-n"]')).toContainText('5');
    await expect(page.locator('[data-testid="playtest-info-quota"]')).toContainText('1');
    await expect(page.locator('[data-testid="playtest-info-focus"]')).toBeVisible();
  });

  test('P4. 可以跳转到 Lv.30', async ({ page }) => {
    await page.locator(S.puzzleBook.levelGrid + ' > button').first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    // Open panel
    await page.locator('[data-testid="star-line-gm-button"]').click();

    // First unlock all
    await page.locator('[data-testid="playtest-unlock-all"]').click();

    // Jump to Lv.30
    await page.locator('[data-testid="playtest-jump-input"]').fill('30');
    await page.locator('[data-testid="playtest-jump-go"]').click();

    // Panel should auto-close after jump
    await expect(page.locator('[data-testid="star-line-gm-panel"]')).not.toBeVisible();

    // Should be on a 10×10 board (cell 99 exists)
    await expect(page.locator('[data-testid="star-line-cell-99"]')).toBeVisible();
  });

  test('P5. solution overlay 开关正常', async ({ page }) => {
    await page.locator(S.puzzleBook.levelGrid + ' > button').first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    // Open panel
    await page.locator('[data-testid="star-line-gm-button"]').click();

    // Toggle solution on
    await page.locator('[data-testid="playtest-toggle-solution"]').click();
    await expect(page.locator('[data-testid="playtest-solution-active"]')).toBeVisible();
    // Lv.1 solution dots should appear: [1,8,10,17,24]
    await expect(page.locator('[data-testid="star-line-solution-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="star-line-solution-8"]')).toBeVisible();

    // Toggle solution off
    await page.locator('[data-testid="playtest-toggle-solution"]').click();
    await expect(page.locator('[data-testid="star-line-solution-1"]')).not.toBeVisible();
  });

  test('P6. 底部 Playtest 折叠条不存在', async ({ page }) => {
    await page.locator(S.puzzleBook.levelGrid + ' > button').first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    // Old bottom panel should NOT exist
    await expect(page.locator('[data-testid="playtest-panel-toggle"]')).not.toBeVisible();
    // Old playtest-panel container should NOT exist
    await expect(page.locator('[data-testid="star-line-playtest-panel"]')).not.toBeVisible();
  });

  test('P7. SettingsPanel 中不出现 Playtest / GM / Dev Mode 开关', async ({ page }) => {
    // Navigate back to home to access settings
    await page.goto('/');
    await page.locator(S.home.settingsButtonSecondary).click();
    await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible();

    // No playtest mode toggle should exist
    await expect(page.locator('[data-testid="playtest-mode-toggle"]')).not.toBeVisible();

    // Close settings
    await page.locator('[data-testid="settings-close-button"]').click();
  });

  test('P8. localStorage 中不写入 cg_dev_mode', async ({ page }) => {
    await page.locator(S.puzzleBook.levelGrid + ' > button').first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    // Open and use the GM panel
    await page.locator('[data-testid="star-line-gm-button"]').click();
    await page.locator('[data-testid="playtest-toggle-solution"]').click();
    await page.locator('[data-testid="star-line-gm-close"]').click();

    // Check localStorage has no cg_dev_mode
    const devMode = await page.evaluate(() => localStorage.getItem('cg_dev_mode'));
    expect(devMode).toBeNull();
  });
});
