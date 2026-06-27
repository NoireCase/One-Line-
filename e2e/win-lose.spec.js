import { test, expect } from '@playwright/test';
import { S } from './helpers/selectors.js';
import { goToLevel } from './helpers/navigation.js';
import {
  clearAllGameData,
  readGridDataFromReactFiber,
  buildSolutionPath,
} from './helpers/game-state.js';
import { dragPath, dragCellToCell } from './helpers/game-simulation.js';

function findWrongHiddenAdjacent(gridData, solution) {
  const headIdx = solution[0];
  const N = Math.round(Math.sqrt(gridData.length));
  const pathSet = new Set(solution.slice(0, 1));
  const nextVal = 2;

  for (let i = 0; i < gridData.length; i++) {
    if (pathSet.has(i)) continue;
    const cell = gridData[i];
    if (!cell.isHidden) continue;
    if (cell.val === nextVal) continue;

    const r1 = Math.floor(headIdx / N), c1 = headIdx % N;
    const r2 = Math.floor(i / N), c2 = i % N;
    if (Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1) {
      return i;
    }
  }
  return null;
}

async function triggerLoseByDepletingHP(page) {
  await goToLevel(page, { modeId: 'classic', levelKey: 'easy-0' });

  const gridData = await readGridDataFromReactFiber(page);
  if (!gridData) return false;
  const solution = buildSolutionPath(gridData);
  const headIdx = solution[0];

  const wrongCell = findWrongHiddenAdjacent(gridData, solution);
  if (wrongCell === null) return false;

  for (let i = 0; i < 3; i++) {
    await dragCellToCell(page, headIdx, wrongCell, { steps: 4, stepDelay: 10 });
    await page.waitForTimeout(500);
  }

  return true;
}

test.describe('胜利面板', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
  });

  test('完成全部路径后显示胜利面板', async ({ page }) => {
    await goToLevel(page, { modeId: 'classic', levelKey: 'easy-0' });

    const gridData = await readGridDataFromReactFiber(page);
    if (!gridData) return;

    const solution = buildSolutionPath(gridData);
    await dragPath(page, solution);
    await page.waitForTimeout(1500);

    await expect(page.locator(S.win.panel)).toBeVisible({ timeout: 5000 });
  });

  test('胜利面板显示星星评分', async ({ page }) => {
    await goToLevel(page, { modeId: 'classic', levelKey: 'easy-0' });

    const gridData = await readGridDataFromReactFiber(page);
    if (!gridData) return;

    const solution = buildSolutionPath(gridData);
    await dragPath(page, solution);
    await page.waitForTimeout(1500);

    await expect(page.locator(S.win.stars)).toBeVisible({ timeout: 5000 });
    const starsLabel = await page.locator(S.win.stars).getAttribute('aria-label');
    expect(starsLabel).toMatch(/\d+ 星通关/);
  });

  test('胜利面板显示下一关和重试按钮', async ({ page }) => {
    await goToLevel(page, { modeId: 'classic', levelKey: 'easy-0' });

    const gridData = await readGridDataFromReactFiber(page);
    if (!gridData) return;

    const solution = buildSolutionPath(gridData);
    await dragPath(page, solution);
    await page.waitForTimeout(1500);

    await expect(page.locator(S.win.nextButton)).toBeVisible({ timeout: 5000 });
    await expect(page.locator(S.win.retryButton)).toBeVisible({ timeout: 3000 });
  });

  test('点击下一关进入第二关', async ({ page }) => {
    await goToLevel(page, { modeId: 'classic', levelKey: 'easy-0' });

    const gridData = await readGridDataFromReactFiber(page);
    if (!gridData) return;

    const solution = buildSolutionPath(gridData);
    await dragPath(page, solution);
    await page.waitForTimeout(1500);

    await page.locator(S.win.nextButton).click();
    await expect(page.locator(S.game.board)).toBeVisible({ timeout: 8000 });
    await expect(page.locator(S.game.modeLabel)).toContainText(/Lv\s*2/);
  });
});

test.describe('失败面板', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
  });

  test('HP 耗尽后显示失败面板', async ({ page }) => {
    const triggered = await triggerLoseByDepletingHP(page);
    if (!triggered) return;

    await expect(page.locator(S.lose.panel)).toBeVisible({ timeout: 5000 });
  });

  test('失败面板显示复活和重试按钮', async ({ page }) => {
    const triggered = await triggerLoseByDepletingHP(page);
    if (!triggered) return;

    await expect(page.locator(S.lose.reviveButton)).toBeVisible({ timeout: 5000 });
    await expect(page.locator(S.lose.restartButton)).toBeVisible({ timeout: 3000 });
    await expect(page.locator(S.lose.backButton)).toBeVisible({ timeout: 3000 });
  });

  test('点击重新开始回到新游戏', async ({ page }) => {
    const triggered = await triggerLoseByDepletingHP(page);
    if (!triggered) return;

    await page.locator(S.lose.restartButton).click();
    await expect(page.locator(S.game.board)).toBeVisible({ timeout: 5000 });
  });

  test('点击谜题书返回关卡列表', async ({ page }) => {
    const triggered = await triggerLoseByDepletingHP(page);
    if (!triggered) return;

    await page.locator(S.lose.backButton).click();
    await expect(page.locator(S.puzzleBook.title)).toBeVisible({ timeout: 5000 });
  });
});
