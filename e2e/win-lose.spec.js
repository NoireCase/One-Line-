import { test, expect } from '@playwright/test';
import { getHiddenLevel } from '../src/data/hiddenLevels.js';
import { S } from './helpers/selectors.js';
import { goToLevel } from './helpers/navigation.js';
import {
  clearAllGameData,
  setStorage,
  readGridDataFromReactFiber,
  buildSolutionPath,
} from './helpers/game-state.js';
import { dragPath, dragCellToCell } from './helpers/game-simulation.js';

function findWrongHiddenNeighbor(level, pathPosition) {
  const head = level.path[pathPosition];
  const next = level.path[pathPosition + 1];
  const visited = new Set(level.path.slice(0, pathPosition + 1));
  const keyNumbers = new Set(level.keyNumbers);
  const row = Math.floor(head / level.N);
  const col = head % level.N;

  for (const [candidateRow, candidateCol] of [
    [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1],
  ]) {
    if (candidateRow < 0 || candidateCol < 0 || candidateRow >= level.N || candidateCol >= level.N) continue;
    const index = candidateRow * level.N + candidateCol;
    const value = level.path.indexOf(index) + 1;
    if (index !== next && !visited.has(index) && !keyNumbers.has(value)) return index;
  }
  return null;
}

const CLASSIC_LOSS_CASE = {
  levelKey: 'easy-1',
  start: 24,
  wrong: 19,
  attempts: 3,
};

async function triggerClassicLoseByDepletingHP(page) {
  await setStorage(page, 'cg_classic_v2_progress', {
    easy: [1, 0],
    medium: [],
    hard: [],
  });
  await goToLevel(page, { modeId: 'classic', levelKey: CLASSIC_LOSS_CASE.levelKey });

  for (let remaining = CLASSIC_LOSS_CASE.attempts - 1; remaining >= 0; remaining -= 1) {
    await dragCellToCell(page, CLASSIC_LOSS_CASE.start, CLASSIC_LOSS_CASE.wrong, { steps: 4, stepDelay: 10 });
  }
}

async function triggerHiddenLoseByDepletingHP(page) {
  await goToLevel(page, { modeId: 'hidden', levelKey: 'easy-0' });
  const level = getHiddenLevel(0);
  const headIdx = level.path[1];
  const wrongCell = findWrongHiddenNeighbor(level, 1);
  expect(wrongCell, 'Hidden 第 1 关未提供可消耗 HP 的相邻错误格').not.toBeNull();

  await dragCellToCell(page, level.path[0], headIdx, { steps: 4, stepDelay: 10 });
  for (let remaining = 9; remaining >= 0; remaining -= 1) {
    await dragCellToCell(page, headIdx, wrongCell, { steps: 4, stepDelay: 10 });
    await expect(page.locator('[data-testid="hidden-attempts-hud"]')).toHaveText(`剩余尝试 ${remaining}`);
  }

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
    await completeCurrentLevel(page);
  });

  test('胜利面板显示星星评分', async ({ page }) => {
    await goToLevel(page, { modeId: 'classic', levelKey: 'easy-0' });
    await completeCurrentLevel(page);

    await expect(page.locator(S.win.stars)).toBeVisible({ timeout: 5000 });
    const starsLabel = await page.locator(S.win.stars).getAttribute('aria-label');
    expect(starsLabel).toMatch(/\d+ 星通关/);
  });

  test('胜利面板显示下一关和重试按钮', async ({ page }) => {
    await goToLevel(page, { modeId: 'classic', levelKey: 'easy-0' });
    await completeCurrentLevel(page);

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
    await completeCurrentLevel(page);

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

  test('Classic HP 耗尽后显示复活、重试和谜题书按钮，复活可继续', async ({ page }) => {
    await triggerClassicLoseByDepletingHP(page);
    await expect(page.locator(S.lose.panel)).toBeVisible({ timeout: 5000 });
    await expect(page.locator(S.lose.reviveButton)).toBeVisible({ timeout: 5000 });
    await expect(page.locator(S.lose.restartButton)).toBeVisible({ timeout: 3000 });
    await expect(page.locator(S.lose.backButton)).toBeVisible({ timeout: 3000 });
    await page.locator(S.lose.reviveButton).click();
    await expect(page.locator(S.lose.panel)).toHaveCount(0);
    await expect(page.locator(S.game.board)).toBeVisible();
  });

  test('Hidden HP 耗尽后不显示复活，重新挑战会恢复初始尝试次数', async ({ page }) => {
    await triggerHiddenLoseByDepletingHP(page);
    await expect(page.locator(S.lose.panel)).toBeVisible({ timeout: 5000 });
    await expect(page.locator(S.lose.reviveButton)).toHaveCount(0);
    await expect(page.locator(S.lose.restartButton)).toBeVisible({ timeout: 3000 });
    await expect(page.locator(S.lose.backButton)).toBeVisible({ timeout: 3000 });
    await page.locator(S.lose.restartButton).click();
    await expect(page.locator(S.game.board)).toBeVisible({ timeout: 5000 });
    await expect(page.locator(S.lose.panel)).toHaveCount(0);
    await expect(page.locator('[data-testid="hidden-attempts-hud"]')).toHaveText('剩余尝试 10');
  });

  test('Classic 失败面板可返回谜题书', async ({ page }) => {
    await triggerClassicLoseByDepletingHP(page);
    await expect(page.locator(S.lose.panel)).toBeVisible({ timeout: 5000 });
    await page.locator(S.lose.backButton).click();
    await expect(page.locator(S.puzzleBook.title)).toBeVisible({ timeout: 5000 });
  });
});
