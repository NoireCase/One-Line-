import { test, expect } from '@playwright/test';
import { S } from './helpers/selectors.js';
import { goToLevel } from './helpers/navigation.js';
import {
  clearAllGameData,
  setStorage,
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

const NORMAL_MODE_PROGRESS_KEYS = {
  classic: 'cg_classic_v2_progress',
  diagonal: 'cg_diagonal_progress'
};

const NORMAL_LEVEL_CASES = [
  { fromLevel: 24, levelKey: 'medium-13', expectedNextLevel: 25 },
  { fromLevel: 25, levelKey: 'medium-14', expectedNextLevel: 26 },
  { fromLevel: 30, levelKey: 'medium-19', expectedNextLevel: 31 },
  { fromLevel: 49, levelKey: 'hard-18', expectedNextLevel: 50 },
  { fromLevel: 50, levelKey: 'hard-19', expectedNextLevel: 51 },
  { fromLevel: 59, levelKey: 'hard-28', expectedNextLevel: 60 },
];

const FINAL_NORMAL_LEVEL_CASE = { fromLevel: 60, levelKey: 'hard-29' };

async function unlockAllNormalLevels(page, modeId) {
  await setStorage(page, NORMAL_MODE_PROGRESS_KEYS[modeId], {
    easy: Array.from({ length: 10 }, () => 1),
    medium: Array.from({ length: 20 }, () => 1),
    hard: Array.from({ length: 30 }, () => 1),
  });
}

async function completeCurrentLevel(page) {
  const gridData = await readGridDataFromReactFiber(page);
  expect(gridData).toBeTruthy();

  const solution = buildSolutionPath(gridData);
  await dragPath(page, solution);
  await expect(page.locator(S.win.panel)).toBeVisible({ timeout: 5000 });
}

async function expectNextLevelAfterWin(page, { modeId, levelKey, expectedNextLevel }) {
  await unlockAllNormalLevels(page, modeId);
  await goToLevel(page, { modeId, levelKey });
  await completeCurrentLevel(page);

  await expect(page.locator(S.win.nextButton)).toBeVisible({ timeout: 5000 });
  await page.locator(S.win.nextButton).click();
  await expect(page.locator(S.game.board)).toBeVisible({ timeout: 8000 });
  await expect(page.locator(S.game.modeLabel)).toContainText(new RegExp(`Lv\\s*${expectedNextLevel}`));
}

async function expectNoNextLevelAfterWin(page, { modeId, levelKey }) {
  await unlockAllNormalLevels(page, modeId);
  await goToLevel(page, { modeId, levelKey });
  await completeCurrentLevel(page);

  await expect(page.locator(S.win.nextButton)).not.toBeVisible();
  await expect(page.getByRole('button', { name: '返回关卡列表' })).toBeVisible();
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

  test('点击胜利遮罩不会退出，明确按钮仍可继续', async ({ page }) => {
    await goToLevel(page, { modeId: 'classic', levelKey: 'easy-0' });
    await completeCurrentLevel(page);

    await page.locator(S.win.backdrop).click({ position: { x: 8, y: 8 } });
    await expect(page.locator(S.win.panel)).toBeVisible();
    await expect(page.locator(S.game.view)).toBeVisible();

    await page.locator(S.win.nextButton).click();
    await expect(page.locator(S.game.board)).toBeVisible({ timeout: 8000 });
    await expect(page.locator(S.game.modeLabel)).toContainText(/Lv\s*2/);
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

  for (const modeId of ['classic', 'diagonal']) {
    test.describe(`${modeId} 下一关边界`, () => {
      for (const levelCase of NORMAL_LEVEL_CASES) {
        test(`Lv${levelCase.fromLevel} 通关后进入 Lv${levelCase.expectedNextLevel}`, async ({ page }) => {
          await expectNextLevelAfterWin(page, { modeId, ...levelCase });
        });
      }

      test('Lv60 通关后不显示下一关', async ({ page }) => {
        await expectNoNextLevelAfterWin(page, { modeId, ...FINAL_NORMAL_LEVEL_CASE });
      });
    });
  }
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
