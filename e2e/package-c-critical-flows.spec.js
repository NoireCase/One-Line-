import { test, expect } from '@playwright/test';
import { PORTAL_LEVELS } from '../src/data/portalLevels.js';
import { getHiddenLevel } from '../src/data/hiddenLevels.js';
import { STAR_LINE_LEVELS } from '../src/data/starLineLevels.js';
import { createClassicLevel } from '../src/game/classic/createClassicLevel.js';
import { createLevelConfig, resolveRules } from '../src/game/rules/levelConfig.js';
import { S } from './helpers/selectors.js';
import { clearAllGameData, getPathLength, getStorage } from './helpers/game-state.js';
import { dragCellToCell, dragPath } from './helpers/game-simulation.js';
import { goToLevel } from './helpers/navigation.js';

const PORTAL_PROGRESS_KEY = 'cg_portal_progress';
const HIDDEN_PROGRESS_KEY = 'cg_hidden_progress';
const STAR_LINE_PROGRESS_KEY = 'cg_star_line_progress_v2';

const PORTAL_LEVEL = PORTAL_LEVELS[0];
const HIDDEN_LEVEL = getHiddenLevel(0);
const STAR_DOUBLE_LEVELS = STAR_LINE_LEVELS.filter(level => level.gameId === 'starDouble');
const STAR_DOUBLE_FINAL_LEVEL = STAR_DOUBLE_LEVELS.at(-1);
const CLASSIC_LEVEL_ONE_SOLUTION = createClassicLevel(
  'easy',
  0,
  resolveRules(createLevelConfig('easy', 0, 'classic')),
  'classic'
).grid
  .map((cell, index) => ({ index, value: cell.val }))
  .sort((a, b) => a.value - b.value)
  .map(cell => cell.index);

async function prepareStarLineCatalog(page) {
  const completedDouble = Object.fromEntries(
    STAR_DOUBLE_LEVELS.slice(0, -1).map(level => [level.id, 3])
  );
  await page.evaluate(({ progressKey, finalLevelId, completed }) => {
    localStorage.setItem('cg_discovery_star_line_basic_v1', '1');
    localStorage.setItem('cg_discovery_star_line_double_star_v1', '1');
    localStorage.setItem(progressKey, JSON.stringify({
      version: 1,
      games: {
        starSingle: { completed: {}, unlockedThroughId: 'star-lv-01' },
        starDouble: { completed, unlockedThroughId: finalLevelId },
      },
    }));
  }, {
    progressKey: STAR_LINE_PROGRESS_KEY,
    finalLevelId: STAR_DOUBLE_FINAL_LEVEL.id,
    completed: completedDouble,
  });
}

test.describe('Package C 关键真实玩家流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
  });

  test('Portal 从正式入口穿过传送门通关、写入进度并解锁下一关', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('cg_discovery_portal_classic', 'true'));
    await goToLevel(page, { modeId: 'portalClassic', levelKey: 'easy-0' });

    const [firstPortalCell, secondPortalCell] = PORTAL_LEVEL.portals[0].cells;
    const firstPosition = PORTAL_LEVEL.path.indexOf(firstPortalCell);
    const secondPosition = PORTAL_LEVEL.path.indexOf(secondPortalCell);
    const [portalEntry, portalExit, entryPosition] = firstPosition < secondPosition
      ? [firstPortalCell, secondPortalCell, firstPosition]
      : [secondPortalCell, firstPortalCell, secondPosition];
    expect(entryPosition).toBeGreaterThan(0);
    expect(PORTAL_LEVEL.path[entryPosition + 1]).toBe(portalExit);

    await dragPath(page, PORTAL_LEVEL.path.slice(0, entryPosition + 1));
    await expect.poll(() => getPathLength(page)).toBe(entryPosition + 1);
    await expect(page.locator(S.game.cell(portalExit))).toHaveClass(/ring-2/);

    // Portal Classic requires a real, manual connection from the active entry
    // to its paired exit. The exit is not added to the path automatically.
    await dragCellToCell(page, portalEntry, portalExit, { steps: 4, stepDelay: 10 });
    await expect.poll(() => getPathLength(page)).toBe(entryPosition + 2);
    await dragPath(page, PORTAL_LEVEL.path.slice(entryPosition + 1));
    await expect(page.locator(S.win.panel)).toBeVisible();

    const progress = await getStorage(page, PORTAL_PROGRESS_KEY);
    expect(progress.easy.starsById[PORTAL_LEVEL.id]).toBeGreaterThan(0);
    expect(progress.easy.unlockedIndex).toBeGreaterThanOrEqual(1);

    await page.locator(S.win.backButton).click();
    await expect(page.locator(S.puzzleBook.levelTile('easy-0'))).toHaveAttribute('data-completed', 'true');
    await expect(page.locator(S.puzzleBook.levelTile('easy-1'))).toHaveAttribute('data-locked', 'false');
  });

  test('Hidden 从正式入口完成真实路径、写入进度并解锁下一关', async ({ page }) => {
    await goToLevel(page, { modeId: 'hidden', levelKey: 'easy-0' });
    await dragPath(page, HIDDEN_LEVEL.path);
    await expect(page.locator(S.win.panel)).toBeVisible();

    const progress = await getStorage(page, HIDDEN_PROGRESS_KEY);
    expect(progress.hidden[0]).toBeGreaterThan(0);

    await page.locator(S.win.backButton).click();
    await expect(page.locator(S.puzzleBook.levelTile('easy-0'))).toHaveAttribute('data-completed', 'true');
    await expect(page.locator(S.puzzleBook.levelTile('easy-1'))).toHaveAttribute('data-locked', 'false');
  });

  test('Star Double 终关完成后不生成下一关且进度保持独立', async ({ page }) => {
    await prepareStarLineCatalog(page);
    await goToLevel(page, { modeId: 'starDouble', levelKey: `easy-${STAR_DOUBLE_LEVELS.length - 1}` });

    for (const index of STAR_DOUBLE_FINAL_LEVEL.solution) {
      await page.locator(`[data-testid="star-line-cell-${index}"]`).dblclick();
    }
    await expect(page.locator(S.win.panel)).toBeVisible();
    await expect(page.locator(S.win.nextButton)).toHaveCount(0);

    const progress = await getStorage(page, STAR_LINE_PROGRESS_KEY);
    expect(progress.games.starDouble.completed[STAR_DOUBLE_FINAL_LEVEL.id]).toBeGreaterThan(0);
    expect(progress.games.starDouble.unlockedThroughId).toBe(STAR_DOUBLE_FINAL_LEVEL.id);
    expect(progress.games.starSingle.completed[STAR_DOUBLE_FINAL_LEVEL.id]).toBeUndefined();
    expect(Object.keys(progress.games.starDouble.completed).every(id => (
      STAR_DOUBLE_LEVELS.some(level => level.id === id)
    ))).toBe(true);

    await page.locator(S.win.backButton).click();
    await expect(page.locator(S.puzzleBook.progressText)).toContainText('已完成 10 / 10');
    await expect(page.locator('[data-testid="level-complete-banner"]')).toBeVisible();
    const chapterToggle = page.locator(S.puzzleBook.chapterToggle('star-double-intro'));
    await expect(chapterToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(chapterToggle).toContainText('展开重玩');
    await chapterToggle.click();
    await expect(chapterToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator(S.puzzleBook.levelTile(`easy-${STAR_DOUBLE_LEVELS.length - 1}`))).toHaveAttribute('data-completed', 'true');
  });

  test('Classic 游戏中刷新安全回到正式入口，不保留损坏路径且可继续操作', async ({ page }) => {
    await goToLevel(page, { modeId: 'classic', levelKey: 'easy-0' });
    await dragPath(page, CLASSIC_LEVEL_ONE_SOLUTION.slice(0, 4));
    await expect.poll(() => getPathLength(page)).toBe(4);
    expect(await getStorage(page, 'cg_diagonal_progress')).toBeNull();

    await page.reload();
    await expect(page.locator(S.home.view)).toBeVisible();
    await goToLevel(page, { modeId: 'classic', levelKey: 'easy-0' });
    await expect.poll(() => getPathLength(page)).toBe(1);
    expect(await getStorage(page, 'cg_diagonal_progress')).toBeNull();

    await dragCellToCell(page, CLASSIC_LEVEL_ONE_SOLUTION[0], CLASSIC_LEVEL_ONE_SOLUTION[1], {
      steps: 2,
      stepDelay: 0,
    });
    await expect.poll(() => getPathLength(page)).toBe(2);
  });
});
