import { test, expect } from '@playwright/test';
import { PORTAL_LEVELS } from '../src/data/portalLevels.js';
import {
  STAR_DOUBLE_LEVELS,
  STAR_SINGLE_LEVELS,
} from '../src/game/starLine/starLineProgressV2.js';
import { S } from './helpers/selectors.js';
import {
  goToPuzzleBook,
  goToStarLineLevels,
  switchMode,
} from './helpers/navigation.js';
import { clearAllGameData } from './helpers/game-state.js';
import { getBrowserClassicSolution } from './helpers/classic-level-fixture.js';
import { dragPath } from './helpers/game-simulation.js';

const classicCompleteProgress = () => ({
  easy: Array(10).fill(3),
  medium: Array(20).fill(3),
  hard: Array(30).fill(3),
});

const allModeProgress = {
  classic: classicCompleteProgress(),
  diagonal: classicCompleteProgress(),
  hidden: { hidden: Array(60).fill(3) },
  portal: {
    easy: {
      unlockedIndex: PORTAL_LEVELS.length - 1,
      starsById: Object.fromEntries(PORTAL_LEVELS.map(level => [level.id, 3])),
    },
  },
  starLine: {
    version: 1,
    games: {
      starSingle: {
        completed: Object.fromEntries(STAR_SINGLE_LEVELS.map(level => [level.id, 3])),
        unlockedThroughId: STAR_SINGLE_LEVELS.at(-1).id,
      },
      starDouble: {
        completed: Object.fromEntries(STAR_DOUBLE_LEVELS.map(level => [level.id, 3])),
        unlockedThroughId: STAR_DOUBLE_LEVELS.at(-1).id,
      },
    },
  },
};

async function seedCompletedModes(page) {
  await page.evaluate((progress) => {
    localStorage.setItem('cg_classic_v2_progress', JSON.stringify(progress.classic));
    localStorage.setItem('cg_diagonal_progress', JSON.stringify(progress.diagonal));
    localStorage.setItem('cg_hidden_progress', JSON.stringify(progress.hidden));
    localStorage.setItem('cg_portal_progress', JSON.stringify(progress.portal));
    localStorage.setItem('cg_star_line_progress_v2', JSON.stringify(progress.starLine));
  }, allModeProgress);
}

async function openCompletedClassic(page) {
  await page.goto('/');
  await clearAllGameData(page);
  await seedCompletedModes(page);
  await goToPuzzleBook(page);
}

async function enterReplay(page) {
  await page.locator(S.puzzleBook.replayEntry).click();
  await expect(page.locator(S.puzzleBook.replayDialog)).toBeVisible();
  await page.locator(S.puzzleBook.replayConfirm).click();
  await expect(page.locator(S.puzzleBook.levelGridWrap))
    .toHaveAttribute('data-completion-view', 'replay');
}

async function expectReplayFirstPage(page, pageCount) {
  const firstTile = page.locator(S.puzzleBook.levelTile('easy-0'));
  await expect(page.locator('[data-state="recommended"]')).toHaveCount(1);
  await expect(firstTile).toHaveAttribute('data-state', 'recommended');
  await expect(firstTile).toHaveAttribute('data-completed', 'true');
  await expect(page.locator('[data-state="completed"]')).toHaveCount(9);
  await expect(page.locator('[data-state="gold"]')).toHaveCount(0);
  await expect(page.locator('[data-testid^="level-completion-mark-"]')).toHaveCount(10);
  await expect(page.locator(S.puzzleBook.progressText)).toHaveText(`1 / ${pageCount}`);
}

async function completeClassicLevel(page, { key, diff, levelIdx }) {
  await page.locator(S.puzzleBook.levelTile(key)).click();
  await expect(page.locator(S.game.board)).toBeVisible();
  const solution = await getBrowserClassicSolution(page, {
    diff,
    levelIdx,
    playMode: 'classic',
  });
  await dragPath(page, solution);
  await expect(page.locator(S.win.panel)).toBeVisible({ timeout: 10000 });
  await page.locator(S.win.backButton).click();
  await expect(page.locator(S.puzzleBook.levelGridWrap))
    .toHaveAttribute('data-completion-view', 'replay');
}

test.describe('全玩法重玩状态与进度定位', () => {
  test('sealed 保持普通深色卡片、轻量完成框和双层重玩入口', async ({ page }) => {
    await openCompletedClassic(page);

    const browser = page.locator(S.puzzleBook.levelGridWrap);
    await expect(browser).toHaveAttribute('data-completion-view', 'sealed');
    await expect(browser.locator('.level-seal-line')).toHaveClass(/is-visible/);
    await expect(page.locator('[data-state="sealed"]')).toHaveCount(10);
    await expect(page.locator('[data-testid^="level-completion-mark-"]')).toHaveCount(0);
    await expect(page.locator('[data-state="gold"]')).toHaveCount(0);
    await expect(page.locator(S.puzzleBook.progressText)).toHaveText('已通关');
    await expect(page.locator(S.puzzleBook.replayHint)).toHaveText('点击重玩');
    await expect(page.locator(S.puzzleBook.replayEntry)).toHaveCSS('cursor', 'pointer');

    await page.locator(S.puzzleBook.replayEntry).focus();
    await expect(page.locator(S.puzzleBook.replayEntry)).toBeFocused();
    await page.locator(S.puzzleBook.replayEntry).click();
    await expect(page.locator(S.puzzleBook.replayDialog)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator(S.puzzleBook.replayEntry)).toBeFocused();
  });

  test('六种玩法统一使用推荐关、普通完成卡和卡内完成标记', async ({ page }) => {
    await openCompletedClassic(page);

    for (const modeId of ['classic', 'hidden', 'diagonal', 'portalClassic']) {
      if (modeId !== 'classic') await switchMode(page, modeId);
      await expect(page.locator(S.puzzleBook.levelGridWrap))
        .toHaveAttribute('data-completion-view', 'sealed');
      await enterReplay(page);
      await expectReplayFirstPage(page, modeId === 'portalClassic' ? 3 : 6);
    }

    await page.locator(S.puzzleBook.backButton).click();
    await goToStarLineLevels(page);
    for (const modeId of ['starSingle', 'starDouble']) {
      if (modeId !== 'starSingle') await switchMode(page, modeId);
      await expect(page.locator(S.puzzleBook.levelGridWrap))
        .toHaveAttribute('data-completion-view', 'sealed');
      await enterReplay(page);
      await expectReplayFirstPage(page, 6);
    }
  });

  test('重玩第 1 关返回后推荐第 2 关且不重复发奖', async ({ page }) => {
    await openCompletedClassic(page);
    await enterReplay(page);

    const coinsBefore = await page.evaluate(() => localStorage.getItem('cg_coins'));
    await completeClassicLevel(page, { key: 'easy-0', diff: 'easy', levelIdx: 0 });

    await expect(page.locator(S.puzzleBook.levelTile('easy-1')))
      .toHaveAttribute('data-state', 'recommended');
    await expect(page.locator(S.puzzleBook.levelTile('easy-0')))
      .toHaveAttribute('data-state', 'completed');
    await expect(page.locator(S.puzzleBook.progressText)).toHaveText('1 / 6');
    await expect(page.locator(S.puzzleBook.replayDialog)).toHaveCount(0);
    await expect(page.locator(S.puzzleBook.replayEntry)).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('cg_coins'))).toBe(coinsBefore);
    expect(await page.evaluate(() => JSON.parse(
      localStorage.getItem('cg_classic_v2_progress'),
    ))).toEqual(classicCompleteProgress());
  });

  test('重玩第 10 关返回后自动定位第 2 页并推荐第 11 关', async ({ page }) => {
    await openCompletedClassic(page);
    await enterReplay(page);
    await completeClassicLevel(page, { key: 'easy-9', diff: 'easy', levelIdx: 9 });

    const browser = page.locator(S.puzzleBook.levelGridWrap);
    await expect(browser).toHaveAttribute('data-page', '2');
    await expect(browser).toHaveAttribute('data-window-start', '11');
    await expect(page.locator(S.puzzleBook.levelTile('medium-0')))
      .toHaveAttribute('data-state', 'recommended');
    await expect(page.locator(S.puzzleBook.progressText)).toHaveText('2 / 6');
    await expect(page.locator(S.puzzleBook.difficultyName)).toHaveText('中等');
  });

  test('重玩末关返回后停留末页并继续推荐末关', async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
    await seedCompletedModes(page);
    await goToStarLineLevels(page);
    await enterReplay(page);
    const right = page.locator(S.puzzleBook.rightArrow);
    for (let targetPage = 2; targetPage <= 6; targetPage += 1) {
      await right.click();
      await expect(page.locator(S.puzzleBook.levelGridWrap))
        .toHaveAttribute('data-page', String(targetPage));
    }
    const finalIndex = STAR_SINGLE_LEVELS.length - 1;
    await page.locator(S.puzzleBook.levelTile(`easy-${finalIndex}`)).click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();
    for (const cellIndex of STAR_SINGLE_LEVELS[finalIndex].solution) {
      await page.locator(`[data-testid="star-line-cell-${cellIndex}"]`).dblclick();
    }
    await expect(page.locator(S.win.panel)).toBeVisible({ timeout: 10000 });
    await page.locator(S.win.backButton).click();

    const browser = page.locator(S.puzzleBook.levelGridWrap);
    await expect(browser).toHaveAttribute('data-page', '6');
    await expect(browser).toHaveAttribute('data-window-start', '51');
    await expect(page.locator(S.puzzleBook.levelTile(`easy-${finalIndex}`)))
      .toHaveAttribute('data-state', 'recommended');
    await expect(page.locator(S.puzzleBook.progressText)).toHaveText('6 / 6');
    await expect(page.locator(S.puzzleBook.rightArrow)).toBeDisabled();
  });

  test('切换玩法、离开谜题书与刷新都会退出 replay', async ({ page }) => {
    await openCompletedClassic(page);
    await enterReplay(page);

    await switchMode(page, 'hidden');
    await expect(page.locator(S.puzzleBook.levelGridWrap))
      .toHaveAttribute('data-completion-view', 'sealed');
    await switchMode(page, 'classic');
    await expect(page.locator(S.puzzleBook.levelGridWrap))
      .toHaveAttribute('data-completion-view', 'sealed');

    await enterReplay(page);
    await page.locator(S.puzzleBook.backButton).click();
    await goToPuzzleBook(page);
    await expect(page.locator(S.puzzleBook.levelGridWrap))
      .toHaveAttribute('data-completion-view', 'sealed');

    await enterReplay(page);
    await page.reload();
    await expect(page.locator(S.home.view)).toBeVisible();
    await goToPuzzleBook(page);
    await expect(page.locator(S.puzzleBook.levelGridWrap))
      .toHaveAttribute('data-completion-view', 'sealed');
  });

  test('普通未全部通关玩法不显示完成框或重玩入口，并复用完成标记', async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
    await page.evaluate(() => {
      localStorage.setItem('cg_classic_v2_progress', JSON.stringify({
        easy: [3, 0],
        medium: [],
        hard: [],
      }));
    });
    await goToPuzzleBook(page);

    await expect(page.locator(S.puzzleBook.levelGridWrap))
      .toHaveAttribute('data-completion-view', 'normal');
    await expect(page.locator('.level-seal-line.is-visible')).toHaveCount(0);
    await expect(page.locator(S.puzzleBook.replayEntry)).toHaveCount(0);
    await expect(page.locator(S.puzzleBook.replayHint)).toHaveCount(0);
    await expect(page.locator(S.puzzleBook.levelTile('easy-0')))
      .toHaveAttribute('data-state', 'completed');
    await expect(page.locator('[data-testid="level-completion-mark-easy-0"]'))
      .toHaveCount(1);
    await expect(page.locator(S.puzzleBook.levelTile('easy-1')))
      .toHaveAttribute('data-state', 'recommended');
  });
});
