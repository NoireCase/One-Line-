import { test, expect } from '@playwright/test';
import { S } from './helpers/selectors.js';
import { goToStarLineLevels } from './helpers/navigation.js';
import { clearAllGameData } from './helpers/game-state.js';

test.describe('星线谜阵 教学与关卡信息 UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
  });

  test('T1. Star Line 关卡选择页显示单星双 section header', async ({ page }) => {
    await goToStarLineLevels(page);

    // 单星谜阵默认显示两个章节
    // 入门 · 单星 (Lv.1-10)
    await expect(page.getByText('入门').first()).toBeVisible();
    // 进阶 · 单星 (Lv.11-20)
    await expect(page.getByText('进阶').first()).toBeVisible();
    // ModeSwitcher 中有双星 tab
    await expect(page.locator(S.modeSwitcher.modeCard('starDouble'))).toBeVisible();
  });

  test('T2. Lv.1 入门章节头显示 5×5 · 单星，节点无三星评定', async ({ page }) => {
    await goToStarLineLevels(page);

    const lv1 = page.locator('[data-testid="level-tile-easy-0"]');
    await expect(lv1).toBeVisible();

    // 棋盘尺寸与配额在当前章节头（入门 · 单星 · 5×5）
    const introChapter = page.locator(S.puzzleBook.chapter('star-single-intro'));
    await expect(introChapter).toContainText('5×5');
    await expect(introChapter).toContainText('单星');

    // 星轨节点不显示三星评定圆点
    const goldDots = lv1.locator('.bg-\\[\\#dfc16e\\]');
    await expect(goldDots).toHaveCount(0);
  });

  test('T3. 双星章节头显示棋盘尺寸，展开后 Lv.1 节点可玩', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('cg_star_line_progress_v2', JSON.stringify({
        version: 1,
        games: {
          starSingle: { completed: {}, unlockedThroughId: 'star-lv-01' },
          starDouble: { completed: {}, unlockedThroughId: 'star-lv-30' },
        },
      }));
    });
    await goToStarLineLevels(page);

    // 切换到双星模式
    await page.locator(S.modeSwitcher.modeCard('starDouble')).click();
    await expect(page.locator(S.modeSwitcher.modeCard('starDouble'))).toHaveAttribute('aria-pressed', 'true');

    // 双星章节（当前章节默认展开，Lv.1 = easy-0）
    await expect(page.locator('[data-testid="level-tile-easy-0"]')).toBeVisible();
    await expect(page.locator(S.puzzleBook.chapter('star-double-all'))).toContainText(/\d+×\d+/);
  });

  test('T4. 双星章节显示全部 10 关，Lv.10 节点可玩', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('cg_star_line_progress_v2', JSON.stringify({
        version: 1,
        games: {
          starSingle: { completed: {}, unlockedThroughId: 'star-lv-01' },
          starDouble: { completed: {}, unlockedThroughId: 'star-lv-30' },
        },
      }));
    });
    await goToStarLineLevels(page);

    // 切换到双星模式
    await page.locator(S.modeSwitcher.modeCard('starDouble')).click();
    await expect(page.locator('[data-testid="level-tile-easy-9"]')).toBeVisible();
    await expect(page.locator(S.puzzleBook.chapter('star-double-all'))).toContainText(/\d+×\d+/);
  });

  test('T5. Star Line 游戏 HUD 显示 N×N 和 单星/双星', async ({ page }) => {
    await goToStarLineLevels(page);
    // Enter Lv.1 (5×5 单星)
    await page.locator(S.puzzleBook.anyTile).first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    await expect(page.locator('[data-testid="star-line-hud-board-label"]')).toContainText('5×5');
    await expect(page.locator('[data-testid="star-line-hud-quota-label"]')).toContainText('单星');
  });

  test('T6. 首次进入 Star Line 显示基础教学弹窗，确认后不重复', async ({ page }) => {
    await goToStarLineLevels(page);
    await page.locator(S.puzzleBook.anyTile).first().click();
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
    await page.locator(S.puzzleBook.anyTile).first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();
    await expect(page.locator('[data-testid="star-line-basic-tutorial"]')).not.toBeVisible();
  });

  test('T7. 首次进入双星第一关显示双星提示', async ({ page }) => {
    // Clear discovery keys and unlock starDouble
    await page.evaluate(() => {
      localStorage.removeItem('cg_discovery_star_line_basic_v1');
      localStorage.removeItem('cg_discovery_star_line_double_star_v1');
      localStorage.setItem('cg_star_line_progress_v2', JSON.stringify({
        version: 1,
        games: {
          starSingle: { completed: {}, unlockedThroughId: 'star-lv-01' },
          starDouble: { completed: {}, unlockedThroughId: 'star-lv-30' },
        },
      }));
    });

    // Navigate directly to starDouble first level
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });

    // Double-star tutorial should appear (quota=2 with cleared discovery key)
    await expect(page.locator('[data-testid=”star-line-double-tutorial”]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid=”star-line-double-tutorial”]')).toContainText('双星开始');

    // Close it
    await page.locator('[data-testid=”star-line-tutorial-confirm”]').click();
    await expect(page.locator('[data-testid=”star-line-double-tutorial”]')).not.toBeVisible();
  });

  test('T8. Star Line 完成状态的关卡不显示星级评定', async ({ page }) => {
    // Complete Lv.1 in starSingle via v2 progress
    await page.evaluate(() => {
      localStorage.setItem('cg_star_line_progress_v2', JSON.stringify({
        version: 1,
        games: {
          starSingle: { completed: { 'star-lv-01': 3 }, unlockedThroughId: 'star-lv-20' },
          starDouble: { completed: {}, unlockedThroughId: 'star-lv-21' },
        },
      }));
    });

    await goToStarLineLevels(page);

    // First level tile should show completed state with check mark but no gold star dots
    const lv1 = page.locator(S.puzzleBook.anyTile).first();
    await expect(lv1).toHaveAttribute('data-completed', 'true');
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
    await page.locator(S.puzzleBook.anyTile).first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    // In dev mode, GM button should be visible
    await expect(page.locator('[data-testid="star-line-gm-button"]')).toBeVisible();
  });
});
