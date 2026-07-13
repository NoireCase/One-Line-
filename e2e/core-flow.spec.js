import { test, expect } from '@playwright/test';
import { S } from './helpers/selectors.js';
import { goToLevel } from './helpers/navigation.js';
import { clearAllGameData, getPathLength } from './helpers/game-state.js';
import { dragCellToCell, dragPath } from './helpers/game-simulation.js';

async function openLevel(page, modeId, levelKey) {
  await page.goto('/');
  await clearAllGameData(page);
  if (modeId === 'portalClassic') {
    await page.evaluate(() => localStorage.setItem('cg_discovery_portal_classic', 'true'));
  }
  if (modeId === 'starLine') {
    await page.evaluate(() => {
      localStorage.setItem('cg_discovery_star_line_basic_v1', '1');
      localStorage.setItem('cg_discovery_star_line_double_star_v1', '1');
    });
  }
  if (modeId === 'starLine' && levelKey === 'easy-20') {
    await page.evaluate(() => {
      localStorage.setItem('cg_star_line_progress', JSON.stringify({ unlockedThrough: 29, completed: {} }));
    });
  }
  await goToLevel(page, { modeId, levelKey });
}

test.describe('v0.22 核心流程一致性', () => {
  test('Hidden 显示剩余尝试，最后一次错误保留反馈后才进入失败面板，重试会恢复', async ({ page }) => {
    await openLevel(page, 'hidden', 'easy-0');

    const wrongHiddenCell = 5;
    await expect(page.locator('[data-testid="hidden-attempts-hud"]')).toHaveText('剩余尝试 10');

    await dragCellToCell(page, 0, wrongHiddenCell, { steps: 4, stepDelay: 10 });
    await expect(page.locator('[data-testid="hidden-attempts-hud"]')).toHaveText('剩余尝试 9');
    await page.locator(S.game.restartButton).click();
    await expect(page.locator('[data-testid="hidden-attempts-hud"]')).toHaveText('剩余尝试 10');

    for (let remaining = 9; remaining >= 1; remaining -= 1) {
      await dragCellToCell(page, 0, wrongHiddenCell, { steps: 4, stepDelay: 10 });
      await expect(page.locator('[data-testid="hidden-attempts-hud"]')).toHaveText(`剩余尝试 ${remaining}`);
    }

    await dragCellToCell(page, 0, wrongHiddenCell, { steps: 4, stepDelay: 10 });
    await expect(page.locator('[data-testid="hidden-attempts-hud"]')).toHaveText('剩余尝试 0');

    await page.waitForTimeout(250);
    await expect(page.locator(S.lose.panel)).not.toBeVisible();
    await expect(page.locator(S.lose.panel)).toBeVisible({ timeout: 700 });
    await expect(page.locator(S.lose.panel)).toContainText('尝试次数已用尽');

    await page.locator(S.lose.restartButton).click();
    await expect(page.locator(S.lose.panel)).not.toBeVisible();
    await expect(page.locator('[data-testid="hidden-attempts-hud"]')).toHaveText('剩余尝试 10');
  });

  test('One Line 重置只在有路径时二次确认，并支持 Escape、Enter 与超时取消', async ({ page }) => {
    await openLevel(page, 'classic', 'easy-0');
    const restart = page.locator(S.game.restartButton);

    await restart.click();
    await expect(page.locator('[data-testid="restart-confirmation"]')).toHaveCount(0);

    await dragCellToCell(page, 20, 15, { steps: 4, stepDelay: 10 });
    await expect.poll(() => getPathLength(page)).toBe(2);

    await restart.click();
    await expect(page.locator('[data-testid="restart-confirmation"]')).toHaveText('再次点击重新开始');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="restart-confirmation"]')).toHaveCount(0);
    await expect.poll(() => getPathLength(page)).toBe(2);

    await restart.click();
    await expect(page.locator('[data-testid="restart-confirmation"]')).toBeVisible();
    await page.locator(S.game.backButton).click();
    await expect(page.locator(S.exitPrompt.panel)).toBeVisible();
    await page.locator(S.exitPrompt.abandonAndExit).click();
    await expect(page.locator(S.puzzleBook.page)).toBeVisible();
    await expect(page.locator('[data-testid="restart-confirmation"]')).toHaveCount(0);

    await goToLevel(page, { modeId: 'classic', levelKey: 'easy-0' });
    const restartedLevel = page.locator(S.game.restartButton);
    await dragCellToCell(page, 20, 15, { steps: 4, stepDelay: 10 });
    await expect.poll(() => getPathLength(page)).toBe(2);
    await restartedLevel.click();
    await page.waitForTimeout(2900);
    await expect(page.locator('[data-testid="restart-confirmation"]')).toHaveCount(0);
    await expect.poll(() => getPathLength(page)).toBe(2);

    await restartedLevel.focus();
    await restartedLevel.press('Enter');
    await expect(page.locator('[data-testid="restart-confirmation"]')).toHaveText('再次点击重新开始');
    await restartedLevel.press('Enter');
    await expect.poll(() => getPathLength(page)).toBe(1);
  });

  test('Star Line 重置保留标记直到二次确认，并支持 Space 确认', async ({ page }) => {
    await openLevel(page, 'starLine', 'easy-0');
    const restart = page.locator(S.game.restartButton);
    const markedCell = page.locator('[data-testid="star-line-cell-0"]');

    await restart.click();
    await expect(page.locator('[data-testid="restart-confirmation"]')).toHaveCount(0);

    await markedCell.click();
    await expect(page.locator('[data-testid="star-line-star-0"]')).toBeVisible();
    await restart.click();
    await expect(page.locator('[data-testid="restart-confirmation"]')).toHaveText('再次点击重新开始');
    await expect(page.locator('[data-testid="star-line-star-0"]')).toBeVisible();

    await restart.focus();
    await restart.press(' ');
    await expect(page.locator('[data-testid="star-line-star-0"]')).not.toBeVisible();
  });

  test('One Line 提示保留玩家操作，显示下一步说明并提前表达次数或成本', async ({ page }) => {
    await openLevel(page, 'portalClassic', 'easy-0');
    await dragPath(page, [18, 24, 19, 14]);
    await expect.poll(() => getPathLength(page)).toBe(4);

    const hint = page.getByRole('button', { name: '提示，剩余 3 次' });
    await hint.click();
    await expect(page.locator(S.game.toast)).toHaveText('已标出下一格，请从当前路径末端继续');
    await expect(page.locator(S.game.cell(9))).toContainText('5');
    await expect.poll(() => getPathLength(page)).toBe(4);
    await expect(page.getByRole('button', { name: '提示，剩余 2 次' })).toBeVisible();

    await page.locator(S.game.restartButton).click();
    await page.locator(S.game.restartButton).click();
    await expect(page.locator(S.game.toast)).toHaveCount(0);

    await page.goto('/');
    await clearAllGameData(page);
    await page.evaluate(() => {
      localStorage.setItem('cg_items', JSON.stringify({ heal: 3, exclude: 3, hint: 0 }));
      localStorage.setItem('cg_discovery_portal_classic', 'true');
    });
    await goToLevel(page, { modeId: 'portalClassic', levelKey: 'easy-0' });
    await expect(page.getByRole('button', { name: '提示，购买需要 25 金币' })).toBeVisible();
  });

  test('Hidden 不出现答案型提示，Portal 非法出口给出短原因且合法出口清除提示', async ({ page }) => {
    await openLevel(page, 'hidden', 'easy-0');
    await expect(page.getByRole('button', { name: /提示/ })).toHaveCount(0);

    await openLevel(page, 'portalClassic', 'easy-0');
    await dragPath(page, [18, 24, 19, 14, 9, 4, 3, 8]);
    await expect.poll(() => getPathLength(page)).toBe(8);

    await dragCellToCell(page, 8, 7, { steps: 4, stepDelay: 10 });
    await expect(page.locator(S.game.toast)).toHaveText('请从对应传送门出口继续');
    await expect.poll(() => getPathLength(page)).toBe(8);

    await dragCellToCell(page, 8, 5, { steps: 4, stepDelay: 10 });
    await expect.poll(() => getPathLength(page)).toBe(9);
    await expect(page.locator(S.game.toast)).toHaveCount(0);
  });

  test('Star Line 单星与双星都在各自结算窗口内显示一次 WinPanel', async ({ page }) => {
    await openLevel(page, 'starLine', 'easy-0');
    for (const idx of [1, 8, 10, 17, 24]) {
      await page.locator(`[data-testid="star-line-cell-${idx}"]`).click();
    }
    await expect(page.locator('[data-testid="star-line-board-container"]')).toHaveClass(/is-complete/);
    await page.waitForTimeout(700);
    await expect(page.locator(S.win.panel)).not.toBeVisible();
    await expect(page.locator(S.win.panel)).toBeVisible({ timeout: 700 });
    await expect(page.locator(S.win.panel)).toHaveCount(1);
    await page.locator(S.win.nextButton).click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();
    await expect(page.locator(S.game.modeLabel)).toContainText('第 2 关');

    await openLevel(page, 'starLine', 'easy-20');
    for (const idx of [1, 3, 13, 15, 17, 19, 29, 31, 32, 34, 44, 46, 48, 50, 60, 62]) {
      await page.locator(`[data-testid="star-line-cell-${idx}"]`).click();
    }
    await expect(page.locator('[data-testid="star-line-board-container"]')).toHaveClass(/is-complete/);
    await page.waitForTimeout(900);
    await expect(page.locator('[data-testid="star-line-board-container"]')).toBeVisible();
    await expect(page.locator(S.win.panel)).not.toBeVisible();
    await expect(page.locator(S.win.panel)).toBeVisible({ timeout: 900 });
    await expect(page.locator(S.win.panel)).toHaveCount(1);
  });
});
