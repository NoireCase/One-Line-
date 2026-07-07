import { test, expect } from '@playwright/test';
import { S } from './helpers/selectors.js';
import { goToPuzzleBook, switchMode } from './helpers/navigation.js';
import { clearAllGameData } from './helpers/game-state.js';

test.describe('关卡列表', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
    await goToPuzzleBook(page);
  });

  test('谜题书显示四个模式入口', async ({ page }) => {
    await expect(page.locator(S.puzzleBook.title)).toBeVisible();
    await expect(page.locator(S.modeSwitcher.modeCard('classic'))).toBeVisible();
    await expect(page.locator(S.modeSwitcher.modeCard('diagonal'))).toBeVisible();
    await expect(page.locator(S.modeSwitcher.modeCard('hidden'))).toBeVisible();
    await expect(page.locator(S.modeSwitcher.modeCard('portalClassic'))).toBeVisible();
    await expect(page.locator(S.modeSwitcher.modeCard('starLine'))).not.toBeVisible();
  });

  test('经典模式显示关卡总数和进度', async ({ page }) => {
    // Total includes generated + curated levels (currently 45 + 1 = 46)
    await expect(page.locator(S.puzzleBook.progressText)).toContainText(/完成 0 \/ \d+/);

    const tiles = page.locator(S.puzzleBook.levelGrid + ' > button');
    const count = await tiles.count();
    expect(count).toBeGreaterThanOrEqual(10);
  });

  test('首关可挑战后续锁定', async ({ page }) => {
    const firstTile = page.locator(S.puzzleBook.levelTile('easy-0'));
    await expect(firstTile).toBeEnabled();
    await expect(firstTile.locator('text=可挑战')).toBeVisible();

    // 后续关卡应有锁定的
    const lockedTiles = page.locator('.level-locked');
    const lockedCount = await lockedTiles.count();
    expect(lockedCount).toBeGreaterThan(0);
  });

  test('切换到八向连线模式', async ({ page }) => {
    await switchMode(page, 'diagonal');
    await expect(page.locator(S.puzzleBook.progressText)).toContainText(/完成 0 \/ \d+/);
    const tiles = page.locator(S.puzzleBook.levelGrid + ' > button');
    await expect(tiles.first()).toBeVisible({ timeout: 3000 });
  });

  test('切换到经典传送门模式', async ({ page }) => {
    await switchMode(page, 'portalClassic');
    const tiles = page.locator(S.puzzleBook.levelGrid + ' > button');
    const count = await tiles.count();
    expect(count).toBeGreaterThanOrEqual(8);
  });

});
