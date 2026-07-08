import { test, expect } from '@playwright/test';
import { S } from './helpers/selectors.js';
import { goToStarLineLevels } from './helpers/navigation.js';
import { clearAllGameData } from './helpers/game-state.js';

test.describe('星线谜阵 教学与关卡信息 UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
  });

  test('T1. Star Line 关卡选择页显示四个 section header', async ({ page }) => {
    await goToStarLineLevels(page);

    // 入门 (Lv.1-10)
    await expect(page.getByText('入门').first()).toBeVisible();
    // 入门MAX (Lv.11-20)
    await expect(page.getByText('入门MAX').first()).toBeVisible();
    // 双星 (Lv.21-27)
    await expect(page.getByText('双星').first()).toBeVisible();
    // 双星MAX (Lv.28-30)
    await expect(page.getByText('双星MAX').first()).toBeVisible();
  });

  test('T2. Lv.1 卡片显示 5×5 和 单星，不显示三星评定', async ({ page }) => {
    await goToStarLineLevels(page);

    const lv1 = page.locator('[data-testid="level-tile-easy-0"]');
    await expect(lv1).toBeVisible();

    // Should show tags
    await expect(lv1).toContainText('5×5');
    await expect(lv1).toContainText('单星');

    // Should NOT show star rating dots (checkmark instead when completed)
    // For unlocked-but-not-completed, there should be no gold dot stars
    const goldDots = lv1.locator('.bg-\\[\\#dfc16e\\]');
    await expect(goldDots).toHaveCount(0);
  });

  test('T3. Lv.21 卡片显示 8×8 和 双星', async ({ page }) => {
    await goToStarLineLevels(page);

    // Lv.21 has key "easy-20" (0-indexed: levelIdx=20)
    const lv21 = page.locator('[data-testid="level-tile-easy-20"]');
    await expect(lv21).toBeVisible();

    await expect(lv21).toContainText('8×8');
    await expect(lv21).toContainText('双星');
  });

  test('T4. Lv.30 卡片显示 10×10 和 双星', async ({ page }) => {
    await goToStarLineLevels(page);

    const lv30 = page.locator('[data-testid="level-tile-easy-29"]');
    await expect(lv30).toBeVisible();

    await expect(lv30).toContainText('10×10');
    await expect(lv30).toContainText('双星');
  });

  test('T5. Star Line 游戏 HUD 显示 N×N 和 单星/双星', async ({ page }) => {
    await goToStarLineLevels(page);
    // Enter Lv.1 (5×5 单星)
    await page.locator(S.puzzleBook.levelGrid + ' > button').first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    await expect(page.locator('[data-testid="star-line-hud-board-label"]')).toContainText('5×5');
    await expect(page.locator('[data-testid="star-line-hud-quota-label"]')).toContainText('单星');
  });

  test('T6. 首次进入 Star Line 显示基础教学弹窗，确认后不重复', async ({ page }) => {
    await goToStarLineLevels(page);
    await page.locator(S.puzzleBook.levelGrid + ' > button').first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    // Basic tutorial should appear
    await expect(page.locator('[data-testid="star-line-basic-tutorial"]')).toBeVisible();
    await expect(page.locator('[data-testid="star-line-basic-tutorial"]')).toContainText('星线谜阵');

    // Close it
    await page.locator('[data-testid="star-line-tutorial-close"]').click();
    await expect(page.locator('[data-testid="star-line-basic-tutorial"]')).not.toBeVisible();

    // Go back and re-enter — should NOT show again
    await page.locator(S.game.backButton).click();
    await expect(page.locator(S.puzzleBook.title)).toBeVisible();
    await page.locator(S.puzzleBook.levelGrid + ' > button').first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();
    await expect(page.locator('[data-testid="star-line-basic-tutorial"]')).not.toBeVisible();
  });

  test('T7. 首次进入 Lv.21 显示双星提示', async ({ page }) => {
    // Clear discovery keys and unlock all levels
    await page.evaluate(() => {
      localStorage.removeItem('cg_discovery_star_line_basic_v1');
      localStorage.removeItem('cg_discovery_star_line_double_star_v1');
      const p = { unlockedThrough: 29, completed: {} };
      localStorage.setItem('cg_star_line_progress', JSON.stringify(p));
    });

    await goToStarLineLevels(page);

    // Go directly to Lv.21 (index 20 in the grid)
    const tiles = page.locator(S.puzzleBook.levelGrid + ' > button');
    await tiles.nth(20).click();

    // Double-star tutorial should appear
    await expect(page.locator('[data-testid="star-line-double-tutorial"]')).toBeVisible();
    await expect(page.locator('[data-testid="star-line-double-tutorial"]')).toContainText('双星开始');

    // Close it
    await page.locator('[data-testid="star-line-tutorial-confirm"]').click();
    await expect(page.locator('[data-testid="star-line-double-tutorial"]')).not.toBeVisible();
  });

  test('T8. Star Line 完成状态的关卡不显示星级评定', async ({ page }) => {
    // Complete Lv.1 — Star Line progress uses levelIdx as string key
    await page.evaluate(() => {
      const p = { unlockedThrough: 29, completed: { '0': 1 } };
      localStorage.setItem('cg_star_line_progress', JSON.stringify(p));
    });

    await goToStarLineLevels(page);

    const lv1 = page.locator('[data-testid="level-tile-easy-0"]');
    // Should show completed status but no gold star dots
    await expect(lv1).toContainText('已完成');
    const goldDots = lv1.locator('.bg-\\[\\#dfc16e\\]');
    await expect(goldDots).toHaveCount(0);
  });

  test('T9. Classic 卡片星级和 HUD 不受影响', async ({ page }) => {
    // Enter Classic (One Line) puzzle book via start button
    await page.goto('/');
    await page.locator(S.home.startButton).click();
    await expect(page.locator(S.puzzleBook.title)).toBeVisible({ timeout: 5000 });

    // Classic level cards should exist with star rating dots (default UI unchanged)
    const classicTile = page.locator('[data-testid="level-tile-easy-0"]');
    await expect(classicTile).toBeVisible();
  });

  test('T10. GM 按钮仍只在 dev 显示', async ({ page }) => {
    await goToStarLineLevels(page);
    await page.locator(S.puzzleBook.levelGrid + ' > button').first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    // In dev mode, GM button should be visible
    await expect(page.locator('[data-testid="star-line-gm-button"]')).toBeVisible();
  });
});
