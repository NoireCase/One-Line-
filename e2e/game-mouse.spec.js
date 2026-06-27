import { test, expect } from '@playwright/test';
import { S } from './helpers/selectors.js';
import { goToLevel } from './helpers/navigation.js';
import {
  clearAllGameData,
  getPathLength,
  getPathHeadIndex,
  readGridDataFromReactFiber,
  buildSolutionPath,
} from './helpers/game-state.js';
import { dragCellToCell, dragPath, tapCell } from './helpers/game-simulation.js';

test.describe('鼠标拖拽画线', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
    await goToLevel(page, { modeId: 'classic', levelKey: 'easy-0' });
  });

  test('游戏面板渲染正确数量 cell', async ({ page }) => {
    await expect(page.locator(S.game.board)).toBeVisible();
    // 使用 cell-token data-testid 计数（每个 cell 唯一）
    const cells = page.locator('[data-testid^="cell-"]');
    const count = await cells.count();
    expect(count).toBe(25); // easy 5x5
  });

  test('起始 cell 有路径头标记', async ({ page }) => {
    const headCell = page.locator('.path-head');
    await expect(headCell).toBeVisible();

    const pathLen = await getPathLength(page);
    expect(pathLen).toBe(1);
  });

  test('拖拽到相邻的正确 cell 增加路径长度', async ({ page }) => {
    const gridData = await readGridDataFromReactFiber(page);
    expect(gridData).not.toBeNull();

    const solution = buildSolutionPath(gridData);
    const headIdx = await getPathHeadIndex(page);
    expect(headIdx).toBe(solution[0]);

    const nextIdx = solution[1];
    await dragCellToCell(page, headIdx, nextIdx, { steps: 6, stepDelay: 20 });

    await page.waitForTimeout(200);
    const pathLen = await getPathLength(page);
    expect(pathLen).toBe(2);
  });

  test('连接多个连续 cell', async ({ page }) => {
    const gridData = await readGridDataFromReactFiber(page);
    const solution = buildSolutionPath(gridData);
    const segment = solution.slice(0, 5);
    await dragPath(page, segment);

    await page.waitForTimeout(300);
    const pathLen = await getPathLength(page);
    expect(pathLen).toBe(5);
  });

  test('点击错误的 cell 不增加路径长度', async ({ page }) => {
    const gridData = await readGridDataFromReactFiber(page);
    const solution = buildSolutionPath(gridData);
    const headIdx = solution[0];
    const validNext = solution[1];

    const farIdx = solution.find(idx => idx !== headIdx && idx !== validNext);
    if (farIdx !== undefined) {
      const initialLen = await getPathLength(page);
      await tapCell(page, farIdx);
      await page.waitForTimeout(300);

      const pathLen = await getPathLength(page);
      expect(pathLen).toBe(initialLen);
    }
  });
});
