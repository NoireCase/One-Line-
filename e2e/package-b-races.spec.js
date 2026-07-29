import { test, expect } from '@playwright/test';
import { getHiddenLevel } from '../src/data/hiddenLevels.js';
import { getStarLineCompletionTiming } from '../src/game/starLine/starLineFeedbackTiming.js';
import { HIDDEN_LOSS_DELAY_MS } from '../src/hooks/usePathInteraction.js';
import { S } from './helpers/selectors.js';
import { clearAllGameData, getPathLength, getStorage } from './helpers/game-state.js';
import { dragCellToCell, dragPath } from './helpers/game-simulation.js';
import { goToLevel } from './helpers/navigation.js';
import { getBrowserClassicSolution } from './helpers/classic-level-fixture.js';

const STAR_SINGLE_SAVE_KEY = 'cg_star_line_single_saved_game';
const CLASSIC_SAVE_KEY = 'cg_classic_v2_saved_game';
const HIDDEN_SAVE_KEY = 'cg_hidden_saved_game';
const TEST_CLOCK_EPOCH = new Date('2025-01-01T00:00:00.000Z');
const TEST_CLOCK_PAUSE_TIME = new Date('2025-01-01T00:01:00.000Z');

async function freezeGameClock(page) {
  await page.clock.install({ time: TEST_CLOCK_EPOCH });
  await page.clock.pauseAt(TEST_CLOCK_PAUSE_TIME);
}

async function prepareStarLine(page) {
  await page.goto('/');
  await clearAllGameData(page);
  await page.evaluate(() => {
    localStorage.setItem('cg_discovery_star_line_basic_v1', '1');
    localStorage.setItem('cg_discovery_star_line_double_star_v1', '1');
    localStorage.setItem('cg_star_line_progress_v2', JSON.stringify({
      version: 1,
      games: {
        starSingle: { completed: {}, unlockedThroughId: 'star-lv-20' },
        starDouble: { completed: {}, unlockedThroughId: 'star-lv-30' },
      },
    }));
  });
}

async function dragInstantly(page, fromLocator, toLocator) {
  const from = await fromLocator.boundingBox();
  const to = await toLocator.boundingBox();
  expect(from).not.toBeNull();
  expect(to).not.toBeNull();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 2 });
  await page.mouse.up();
}

function findWrongHiddenNeighbor(level, pathPosition) {
  const head = level.path[pathPosition];
  const next = level.path[pathPosition + 1];
  const visited = new Set(level.path.slice(0, pathPosition + 1));
  const keyNumbers = new Set(level.keyNumbers);
  const row = Math.floor(head / level.N);
  const col = head % level.N;
  const candidates = [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ];
  for (const [candidateRow, candidateCol] of candidates) {
    if (candidateRow < 0 || candidateCol < 0 || candidateRow >= level.N || candidateCol >= level.N) continue;
    const index = candidateRow * level.N + candidateCol;
    const value = level.path.indexOf(index) + 1;
    if (index !== next && !visited.has(index) && !keyNumbers.has(value)) return index;
  }
  throw new Error('Hidden level does not expose a wrong hidden neighbor for the race test');
}

test.describe('Package B 延迟结算与输入竞态', { tag: '@critical' }, () => {
  test('B04A Star Line 完成态保存后恢复仍会合法结算', async ({ page }) => {
    await prepareStarLine(page);
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });

    for (const index of [1, 8, 10, 17]) {
      await page.locator(`[data-testid="star-line-cell-${index}"]`).dblclick();
    }
    await freezeGameClock(page);
    await page.locator('[data-testid="star-line-cell-24"]').dblclick();
    await expect(page.locator('[data-testid="star-line-board-container"]')).toHaveClass(/is-complete/);

    await page.locator(S.game.backButton).click();
    await expect(page.locator(S.exitPrompt.panel)).toBeVisible();
    await page.locator(S.exitPrompt.saveAndExit).click();
    await expect(page.locator(S.puzzleBook.page)).toBeVisible();

    const saved = await getStorage(page, STAR_SINGLE_SAVE_KEY);
    expect(saved.starLineSession.gridData.filter(cell => cell.isStarred)).toHaveLength(5);

    await page.locator(S.puzzleBook.levelTile('easy-0')).click();
    await expect(page.locator('[data-testid="star-line-board-container"]')).toHaveClass(/is-complete/);
    await page.clock.runFor(getStarLineCompletionTiming({ starsPerRow: 1 }).winPanelDelay);
    await expect(page.locator(S.win.panel)).toBeVisible();
  });

  test('B04B Hidden HP 归零时不能保存为普通中断局', async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
    await goToLevel(page, { modeId: 'hidden', levelKey: 'easy-0' });

    const level = getHiddenLevel(0);
    const head = level.path[1];
    const wrong = findWrongHiddenNeighbor(level, 1);
    await dragCellToCell(page, level.path[0], head, { steps: 2, stepDelay: 0 });
    await expect(page.locator('[data-testid="hidden-path-hud"]')).toHaveText('路径 2 / 25');

    for (let remaining = 9; remaining >= 1; remaining -= 1) {
      await dragCellToCell(page, head, wrong, { steps: 2, stepDelay: 0 });
      await expect(page.locator('[data-testid="hidden-attempts-hud"]')).toHaveText(`剩余尝试 ${remaining}`);
    }

    await freezeGameClock(page);
    await dragInstantly(page, page.locator(S.game.cell(head)), page.locator(S.game.cell(wrong)));
    await expect(page.locator('[data-testid="hidden-attempts-hud"]')).toHaveText('剩余尝试 0');

    await page.locator(S.game.backButton).click();
    await expect(page.locator(S.exitPrompt.panel)).toBeVisible();
    await page.locator(S.exitPrompt.saveAndExit).click();

    expect.soft(await getStorage(page, HIDDEN_SAVE_KEY)).toBeNull();
    await expect(page.locator(S.lose.panel)).toBeVisible();
    await page.clock.runFor(HIDDEN_LOSS_DELAY_MS);
    await expect(page.locator(S.lose.panel)).toBeVisible();
  });

  test('B04C One Line 完整路径存档恢复后自动且只结算一次', { tag: '@level-select-focused' }, async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
    await page.evaluate(() => localStorage.setItem('cg_coins', '100'));
    await goToLevel(page, { modeId: 'classic', levelKey: 'easy-0' });
    const classicSolution = await getBrowserClassicSolution(page);

    await dragPath(page, classicSolution.slice(0, -1));
    await expect.poll(() => getPathLength(page)).toBe(24);
    await freezeGameClock(page);
    await dragInstantly(
      page,
      page.locator(S.game.cell(classicSolution.at(-2))),
      page.locator(S.game.cell(classicSolution.at(-1)))
    );

    await page.locator(S.game.backButton).click();
    await expect(page.locator(S.exitPrompt.panel)).toBeVisible();
    await page.locator(S.exitPrompt.saveAndExit).click();
    await expect(page.locator(S.puzzleBook.page)).toBeVisible();

    const rawBeforeDelay = await page.evaluate(key => localStorage.getItem(key), CLASSIC_SAVE_KEY);
    expect(JSON.parse(rawBeforeDelay).path).toHaveLength(25);
    await page.clock.runFor(900);
    expect(await page.evaluate(key => localStorage.getItem(key), CLASSIC_SAVE_KEY)).toBe(rawBeforeDelay);
    await expect(page.locator(S.win.panel)).toHaveCount(0);

    await page.locator(S.puzzleBook.backButton).click();
    await expect(page.locator(S.home.continueButton)).toBeVisible();
    await page.locator(S.home.continueButton).click();

    await expect(page.locator(S.win.panel)).toBeVisible();
    await expect(page.locator(S.win.panel)).toHaveCount(1);
    await expect.poll(() => page.evaluate(key => localStorage.getItem(key), CLASSIC_SAVE_KEY)).toBeNull();
    await expect.poll(() => page.evaluate(() => Number(localStorage.getItem('cg_coins')))).toBeGreaterThan(100);
    await expect.poll(() => page.evaluate(() => {
      const progress = JSON.parse(localStorage.getItem('cg_classic_v2_progress') || '{}');
      return progress.easy?.[0] || 0;
    })).toBeGreaterThan(0);

    const coinsAfterWin = await page.evaluate(() => localStorage.getItem('cg_coins'));
    const progressAfterWin = await page.evaluate(() => localStorage.getItem('cg_classic_v2_progress'));
    await page.clock.runFor(900);
    await expect(page.locator(S.win.panel)).toHaveCount(1);

    await page.locator(S.win.backButton).click();
    await expect(page.locator(S.puzzleBook.levelTile('easy-0'))).toHaveAttribute('data-completed', 'true');
    await page.locator(S.puzzleBook.levelTile('easy-0')).click();
    await expect.poll(() => getPathLength(page)).toBe(1);
    await page.clock.runFor(900);
    await expect(page.locator(S.win.panel)).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('cg_coins'))).toBe(coinsAfterWin);
    expect(await page.evaluate(() => localStorage.getItem('cg_classic_v2_progress'))).toBe(progressAfterWin);
  });

  test('B05 退出确认会取消 Star Line 待定单击且不会保存后台落子', async ({ page }) => {
    await prepareStarLine(page);
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });
    await page.locator('[data-testid="star-line-cell-1"]').dblclick();
    await expect(page.locator('[data-testid="star-line-star-1"]')).toBeVisible();

    await freezeGameClock(page);
    await page.locator('[data-testid="star-line-cell-0"]').click();
    await expect(page.locator('[data-testid="star-line-board"]')).toHaveAttribute('data-input-state', 'pending');
    await page.locator(S.game.backButton).click();
    await expect(page.locator(S.exitPrompt.panel)).toBeVisible();

    await page.clock.runFor(275);
    expect.soft(await page.locator('[data-testid="star-line-x-0"]').count()).toBe(0);
    await page.locator(S.exitPrompt.saveAndExit).click();

    const saved = await getStorage(page, STAR_SINGLE_SAVE_KEY);
    expect(saved.starLineSession.gridData[0].isMarkedX).not.toBe(true);
    expect(saved.starLineSession.gridData[1].isStarred).toBe(true);
  });
});
