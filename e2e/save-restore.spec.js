import { test, expect } from '@playwright/test';
import { S } from './helpers/selectors.js';
import { goToLevel, exitGame, goToHome } from './helpers/navigation.js';
import {
  clearAllGameData,
  getPathLength,
  getStorage,
  readGridDataFromReactFiber,
  buildSolutionPath,
} from './helpers/game-state.js';
import { dragPath } from './helpers/game-simulation.js';

test.describe('存档恢复', { tag: '@critical' }, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
  });

  test('保存并退出后 localStorage 有存档', async ({ page }) => {
    await goToLevel(page, { modeId: 'classic', levelKey: 'easy-0' });

    const gridData = await readGridDataFromReactFiber(page);
    const solution = buildSolutionPath(gridData);
    await dragPath(page, solution.slice(0, 3));
    await page.waitForTimeout(200);

    const pathLenBefore = await getPathLength(page);
    expect(pathLenBefore).toBe(3);

    await exitGame(page, 'save');

    const savedGame = await getStorage(page, 'cg_classic_v2_saved_game');
    expect(savedGame).not.toBeNull();
    expect(savedGame).toHaveProperty('playMode');
    expect(savedGame).toHaveProperty('diff');
    expect(savedGame).toHaveProperty('levelIdx');
    expect(savedGame).toHaveProperty('path');
    expect(savedGame).toHaveProperty('gridData');
    expect(savedGame.path.length).toBe(3);
  });

  test('保存后返回首页出现继续解谜按钮', async ({ page }) => {
    await goToLevel(page, { modeId: 'classic', levelKey: 'easy-0' });

    const gridData = await readGridDataFromReactFiber(page);
    const solution = buildSolutionPath(gridData);
    await dragPath(page, solution.slice(0, 3));

    await exitGame(page, 'save');

    // 返回首页
    await page.locator(S.puzzleBook.backButton).click();
    await goToHome(page);
    await expect(page.locator(S.home.continueButton)).toBeVisible();
  });

  test('放弃退出不保存存档', async ({ page }) => {
    await goToLevel(page, { modeId: 'classic', levelKey: 'easy-0' });

    const gridData = await readGridDataFromReactFiber(page);
    const solution = buildSolutionPath(gridData);
    await dragPath(page, solution.slice(0, 3));

    await exitGame(page, 'abandon');

    const savedGame = await getStorage(page, 'cg_classic_v2_saved_game');
    expect(savedGame).toBeNull();
  });

  test('点击继续解谜恢复游戏', async ({ page }) => {
    await goToLevel(page, { modeId: 'classic', levelKey: 'easy-0' });

    const gridData = await readGridDataFromReactFiber(page);
    const solution = buildSolutionPath(gridData);
    await dragPath(page, solution.slice(0, 3));

    const pathLenBefore = await getPathLength(page);
    expect(pathLenBefore).toBe(3);

    await exitGame(page, 'save');

    // 返回首页继续
    await page.locator(S.puzzleBook.backButton).click();
    await goToHome(page);
    await expect(page.locator(S.home.continueButton)).toBeVisible();

    await page.locator(S.home.continueButton).click();
    await expect(page.locator(S.game.board)).toBeVisible({ timeout: 8000 });

    const pathLen = await getPathLength(page);
    expect(pathLen).toBe(3);
  });

  test('游戏中途保存并恢复包含正确状态', async ({ page }) => {
    await goToLevel(page, { modeId: 'classic', levelKey: 'easy-0' });

    const gridData = await readGridDataFromReactFiber(page);
    const solution = buildSolutionPath(gridData);
    await dragPath(page, solution.slice(0, 3));

    const modeLabel = await page.locator(S.game.modeLabel).textContent();
    expect(modeLabel).toContain('经典模式');
    expect(modeLabel).toContain('Lv 1');

    await exitGame(page, 'save');

    const savedGame = await getStorage(page, 'cg_classic_v2_saved_game');
    expect(savedGame.playMode).toBe('classic');
    expect(savedGame.diff).toBe('easy');
    expect(savedGame.levelIdx).toBe(0);
    expect(savedGame.hp).toBe(3);
  });
});
