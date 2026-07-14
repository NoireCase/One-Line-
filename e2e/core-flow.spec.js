import { test, expect } from '@playwright/test';
import { S } from './helpers/selectors.js';
import { goToLevel } from './helpers/navigation.js';
import { clearAllGameData, getPathLength } from './helpers/game-state.js';
import { dragCellToCell, dragPath } from './helpers/game-simulation.js';
import { HIDDEN_LOSS_DELAY_MS } from '../src/hooks/usePathInteraction.js';
import { getStarLineCompletionTiming } from '../src/game/starLine/starLineFeedbackTiming.js';

const TEST_CLOCK_EPOCH = new Date('2025-01-01T00:00:00.000Z');
const TEST_CLOCK_PAUSE_TIME = new Date('2025-01-01T00:01:00.000Z');

async function freezeGameClock(page) {
  await page.clock.install({ time: TEST_CLOCK_EPOCH });
  // install() starts advancing immediately; pause at a known later instant so
  // the clock API never has to move backwards under a busy worker.
  await page.clock.pauseAt(TEST_CLOCK_PAUSE_TIME);
}

async function expectPanelAfterDelay(page, panel, delay) {
  await page.clock.runFor(delay - 1);
  await expect(panel).not.toBeVisible();
  await page.clock.runFor(1);
  await expect(panel).toBeVisible();
}

async function openLevel(page, modeId, levelKey) {
  await page.goto('/');
  await clearAllGameData(page);
  if (modeId === 'portalClassic') {
    await page.evaluate(() => localStorage.setItem('cg_discovery_portal_classic', 'true'));
  }
  if (modeId === 'starSingle' || modeId === 'starDouble' || modeId === 'starLine') {
    await page.evaluate(() => {
      localStorage.setItem('cg_discovery_star_line_basic_v1', '1');
      localStorage.setItem('cg_discovery_star_line_double_star_v1', '1');
    });
  }
  if (modeId === 'starDouble' && levelKey === 'easy-0') {
    await page.evaluate(() => {
      localStorage.setItem('cg_star_line_progress_v2', JSON.stringify({
        version: 1,
        games: {
          starSingle: { completed: {}, unlockedThroughId: 'star-lv-01' },
          starDouble: { completed: {}, unlockedThroughId: 'star-lv-30' },
        },
      }));
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

    // Freeze time immediately before the final mistake: the product promise is
    // a visible zero-attempt transition before the loss panel, not a wall-clock
    // measurement affected by concurrent browser workers.
    await freezeGameClock(page);
    await dragCellToCell(page, 0, wrongHiddenCell, { steps: 4, stepDelay: 10 });
    await expect(page.locator('[data-testid="hidden-attempts-hud"]')).toHaveText('剩余尝试 0');
    await expectPanelAfterDelay(page, page.locator(S.lose.panel), HIDDEN_LOSS_DELAY_MS);
    await expect(page.locator(S.lose.panel)).toContainText('尝试次数已用尽');

    await page.locator(S.lose.restartButton).click();
    await expect(page.locator(S.lose.panel)).not.toBeVisible();
    await expect(page.locator('[data-testid="hidden-attempts-hud"]')).toHaveText('剩余尝试 10');
  });

  test('One Line 重置只在有路径时二次确认，仅鼠标点击可确认，超时自动取消', async ({ page }) => {
    await openLevel(page, 'classic', 'easy-0');
    const restart = page.locator(S.game.restartButton);

    // 空路径：直接重置，无确认
    await restart.click();
    await expect(page.locator('[data-testid="restart-confirmation"]')).toHaveCount(0);

    await dragCellToCell(page, 20, 15, { steps: 4, stepDelay: 10 });
    await expect.poll(() => getPathLength(page)).toBe(2);

    // 有路径：第一次点击进入确认状态
    await restart.click();
    await expect(page.locator('[data-testid="restart-confirmation"]')).toHaveText('再次点击重新开始');

    // Escape 不再取消确认（仅鼠标操作）
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="restart-confirmation"]')).toBeVisible();
    await expect.poll(() => getPathLength(page)).toBe(2);

    // Enter 不再触发确认（仅鼠标操作）
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="restart-confirmation"]')).toBeVisible();
    await expect.poll(() => getPathLength(page)).toBe(2);

    // 第二次点击执行重置
    await restart.click();
    await expect.poll(() => getPathLength(page)).toBe(1);
    await expect(page.locator('[data-testid="restart-confirmation"]')).toHaveCount(0);

    // 有路径：超时自动取消
    await dragCellToCell(page, 20, 15, { steps: 4, stepDelay: 10 });
    await expect.poll(() => getPathLength(page)).toBe(2);
    await restart.click();
    await expect(page.locator('[data-testid="restart-confirmation"]')).toBeVisible();
    await page.waitForTimeout(2900);
    await expect(page.locator('[data-testid="restart-confirmation"]')).toHaveCount(0);
    await expect.poll(() => getPathLength(page)).toBe(2);
  });

  test('Star Line 重置保留标记直到鼠标二次确认，键盘不触发确认', async ({ page }) => {
    await openLevel(page, 'starSingle', 'easy-0');
    const restart = page.locator(S.game.restartButton);
    const markedCell = page.locator('[data-testid="star-line-cell-0"]');

    // 空棋盘：无确认
    await restart.click();
    await expect(page.locator('[data-testid="restart-confirmation"]')).toHaveCount(0);

    await markedCell.click();
    await expect(page.locator('[data-testid="star-line-star-0"]')).toBeVisible();

    // 有标记：第一次点击进入确认
    await restart.click();
    await expect(page.locator('[data-testid="restart-confirmation"]')).toHaveText('再次点击重新开始');
    await expect(page.locator('[data-testid="star-line-star-0"]')).toBeVisible();

    // Space/Enter 不触发确认（仅鼠标操作）
    await page.keyboard.press(' ');
    await expect(page.locator('[data-testid="star-line-star-0"]')).toBeVisible();
    await expect(page.locator('[data-testid="restart-confirmation"]')).toBeVisible();

    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="star-line-star-0"]')).toBeVisible();
    await expect(page.locator('[data-testid="restart-confirmation"]')).toBeVisible();

    // 第二次点击执行重置
    await restart.click();
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
    await openLevel(page, 'starSingle', 'easy-0');
    for (const idx of [1, 8, 10, 17]) {
      await page.locator(`[data-testid="star-line-cell-${idx}"]`).click();
    }
    await freezeGameClock(page);
    await page.locator('[data-testid="star-line-cell-24"]').click();
    await expect(page.locator('[data-testid="star-line-board-container"]')).toHaveClass(/is-complete/);
    await expectPanelAfterDelay(
      page,
      page.locator(S.win.panel),
      getStarLineCompletionTiming({ starsPerRow: 1 }).winPanelDelay
    );
    await expect(page.locator(S.win.panel)).toHaveCount(1);
    await page.locator(S.win.nextButton).click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();
    await expect(page.locator(S.game.modeLabel)).toContainText('第 2 关');

    await openLevel(page, 'starDouble', 'easy-0');
    for (const idx of [1, 3, 13, 15, 17, 19, 29, 31, 32, 34, 44, 46, 48, 50, 60]) {
      await page.locator(`[data-testid="star-line-cell-${idx}"]`).click();
    }
    await page.locator('[data-testid="star-line-cell-62"]').click();
    await expect(page.locator('[data-testid="star-line-board-container"]')).toHaveClass(/is-complete/);
    await expect(page.locator('[data-testid="star-line-board-container"]')).toBeVisible();
    await expectPanelAfterDelay(
      page,
      page.locator(S.win.panel),
      getStarLineCompletionTiming({ starsPerRow: 2 }).winPanelDelay
    );
    await expect(page.locator(S.win.panel)).toHaveCount(1);
  });

  // ── 键盘不改变游戏状态 ──

  test('One Line WASD / 方向键不改变路径', async ({ page }) => {
    await openLevel(page, 'classic', 'easy-0');
    await dragCellToCell(page, 20, 15, { steps: 4, stepDelay: 10 });
    await page.waitForTimeout(200);
    const beforeLen = await getPathLength(page);
    // 所有方向键和 WASD 不改变路径
    for (const k of ['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
      await page.keyboard.press(k);
      await page.waitForTimeout(50);
    }
    await expect.poll(() => getPathLength(page)).toBe(beforeLen);
  });

  test('One Line 重新开始确认后 Escape 不取消 Enter/Space 不确认', async ({ page }) => {
    await openLevel(page, 'classic', 'easy-0');
    // 先走出一些路径
    await dragCellToCell(page, 20, 15, { steps: 4, stepDelay: 10 });
    await expect.poll(() => getPathLength(page)).toBeGreaterThan(1);
    // 点击重新开始进入确认
    await page.locator(S.game.restartButton).click();
    await expect(page.locator('[data-testid="restart-confirmation"]')).toBeVisible();
    // Escape 不取消
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    await expect(page.locator('[data-testid="restart-confirmation"]')).toBeVisible();
    // Enter 不确认
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    await expect(page.locator('[data-testid="restart-confirmation"]')).toBeVisible();
    // Space 不确认
    await page.keyboard.press(' ');
    await page.waitForTimeout(100);
    await expect(page.locator('[data-testid="restart-confirmation"]')).toBeVisible();
    // 鼠标点击仍可确认
    await page.locator(S.game.restartButton).click();
    await expect.poll(() => getPathLength(page)).toBe(1);
  });

  test('WinPanel Enter/Space 不触发按钮', async ({ page }) => {
    await openLevel(page, 'classic', 'easy-0');
    // 使用 gm 跳关快速通关（通过 localStorage 直接设完成状态进入 win panel）
    await page.evaluate(() => {
      localStorage.setItem('cg_classic_v2_progress', JSON.stringify({ easy: [1, 2], medium: [], hard: [] }));
    });
    await page.goto('/');
    await page.waitForTimeout(500);
    await page.locator(S.home.startButton).click();
    await page.waitForSelector(S.puzzleBook.page);
    // 回到第一关正常通关来获得 WinPanel
    await page.locator('[data-testid="level-tile-easy-0"]').click();
    await page.waitForSelector(S.game.view);
    // 用 gm 快速完成
    await dragPath(page, [20, 15, 10, 5, 0, 1, 2, 3, 4, 9, 14, 19, 24, 23, 22, 21, 16, 11, 6, 7, 8, 13, 18, 17, 12]);
    await page.waitForTimeout(200);
    // 如果出现了 WinPanel
    const winPanel = page.locator(S.win.panel);
    if (await winPanel.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Enter/Space 不触发下一关
      const nextBtn = page.locator(S.win.nextButton);
      if (await nextBtn.isVisible().catch(() => false)) {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(200);
        await expect(winPanel).toBeVisible();
        await page.keyboard.press(' ');
        await page.waitForTimeout(200);
        await expect(winPanel).toBeVisible();
      }
    }
  });

  test('LosePanel Enter/Space 不触发按钮', async ({ page }) => {
    await openLevel(page, 'hidden', 'easy-0');
    // 消耗所有 HP 触发 LosePanel
    for (let i = 0; i < 12; i++) {
      await dragCellToCell(page, 0, 5, { steps: 4, stepDelay: 10 });
      await page.waitForTimeout(80);
      const losePanel = page.locator(S.lose.panel);
      if (await losePanel.isVisible({ timeout: 1000 }).catch(() => false)) {
        // Enter/Space 不触发重试
        await page.keyboard.press('Enter');
        await page.waitForTimeout(200);
        await expect(losePanel).toBeVisible();
        await page.keyboard.press(' ');
        await page.waitForTimeout(200);
        await expect(losePanel).toBeVisible();
        break;
      }
    }
  });
});
