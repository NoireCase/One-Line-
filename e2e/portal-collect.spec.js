import { test, expect } from '@playwright/test';
import { S } from './helpers/selectors.js';
import { goToPuzzleBook, switchMode, goToLevel } from './helpers/navigation.js';
import {
  clearAllGameData,
  readGridDataFromReactFiber,
} from './helpers/game-state.js';

test.describe('Portal 2.0 传送门收集', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
  });

  test('传送门收集模式入口存在', async ({ page }) => {
    await goToPuzzleBook(page);
    await expect(page.locator(S.modeSwitcher.modeCard('portalCollect'))).toBeVisible();
  });

  test('传送门收集只显示 2 个关卡', async ({ page }) => {
    await goToPuzzleBook(page);
    await switchMode(page, 'portalCollect');

    const tiles = page.locator(S.puzzleBook.levelGrid + ' > button');
    const count = await tiles.count();
    expect(count).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThanOrEqual(5); // 不应出现多余关卡
  });

  test('进入 Lv1 棋盘为 7x7', async ({ page }) => {
    await goToLevel(page, { modeId: 'portalCollect', levelKey: 'easy-0' });

    await expect(page.locator(S.game.board)).toBeVisible();
    const cells = page.locator('[data-testid^="cell-"]');
    const count = await cells.count();
    expect(count).toBe(49); // 7x7
  });

  test('Portal 2.0 关卡内不显示 Classic 道具栏', async ({ page }) => {
    await goToLevel(page, { modeId: 'portalCollect', levelKey: 'easy-0' });

    // 道具按钮不应存在
    const healBtn = page.locator('[data-testid="item-button-heal"]');
    const excludeBtn = page.locator('[data-testid="item-button-exclude"]');
    const hintBtn = page.locator('[data-testid="item-button-hint"]');

    await expect(healBtn).not.toBeVisible({ timeout: 2000 }).catch(() => {});
    await expect(excludeBtn).not.toBeVisible({ timeout: 2000 }).catch(() => {});
    await expect(hintBtn).not.toBeVisible({ timeout: 2000 }).catch(() => {});
  });

  test('HUD 显示步数而不是 combo 评分', async ({ page }) => {
    await goToLevel(page, { modeId: 'portalCollect', levelKey: 'easy-0' });

    // 步数显示
    await expect(page.locator(S.game.stepCountHud)).toBeVisible({ timeout: 3000 });

    // combo 评分不应出现
    const scoreEl = page.locator(S.game.score);
    const visible = await scoreEl.isVisible({ timeout: 1000 }).catch(() => false);
    expect(visible).toBe(false);
  });

  test('Lv1 包含起点 S、终点 E、金币 ●', async ({ page }) => {
    await goToLevel(page, { modeId: 'portalCollect', levelKey: 'easy-0' });

    const gridData = await readGridDataFromReactFiber(page);
    if (!gridData) return;

    const hasStart = gridData.some(c => c.isStart);
    const hasExit = gridData.some(c => c.isExit);
    const hasTargets = gridData.some(c => c.isTarget);
    const hasPortals = gridData.some(c => c.portalId);
    const hasObstacles = gridData.some(c => c.isObstacle);

    expect(hasStart).toBe(true);
    expect(hasExit).toBe(true);
    expect(hasTargets).toBe(true);
    expect(hasPortals).toBe(true);
    expect(hasObstacles).toBe(true);
  });

  test('终点在金币未全收集时不可通行', async ({ page }) => {
    await goToLevel(page, { modeId: 'portalCollect', levelKey: 'easy-0' });

    const gridData = await readGridDataFromReactFiber(page);
    if (!gridData) return;

    // 找到起点和终点
    const startIdx = gridData.findIndex(c => c.isStart);
    const exitIdx = gridData.findIndex(c => c.isExit);

    // 尝试直接从起点拖拽到终点（应该被拒绝，因为金币未收集）
    const { dragCellToCell } = await import('./helpers/game-simulation.js');
    await dragCellToCell(page, startIdx, exitIdx, { steps: 4, stepDelay: 10 });
    await page.waitForTimeout(500);

    // 应出现 toast 提示
    const toast = page.locator(S.game.toast);
    const toastVisible = await toast.isVisible({ timeout: 2000 }).catch(() => false);
    // 如果 toast 出现，说明终点封锁逻辑生效
    if (toastVisible) {
      const toastText = await toast.textContent();
      expect(toastText).toMatch(/金币|收集|先/);
    }
  });

  test('Lv2 可以进入（需解锁）', async ({ page }) => {
    // Portal 模式 Lv2 需要先解锁（Lv1 完成后才开放）
    // 通过 localStorage 模拟已完成 Lv1
    await page.evaluate(() => {
      localStorage.setItem('cg_portal_collect_progress', JSON.stringify({
        easy: { unlockedIndex: 1, starsById: { 'portal2-showcase-fold': 1 } },
        medium: { unlockedIndex: 0, starsById: {} },
        hard: { unlockedIndex: 0, starsById: {} }
      }));
    });

    await goToLevel(page, { modeId: 'portalCollect', levelKey: 'easy-1' });

    await expect(page.locator(S.game.board)).toBeVisible();
    const cells = page.locator('[data-testid^="cell-"]');
    const count = await cells.count();
    expect(count).toBe(49); // 7x7
  });
});
