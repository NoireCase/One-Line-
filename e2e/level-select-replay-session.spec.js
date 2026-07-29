import { test, expect } from '@playwright/test';
import { S } from './helpers/selectors.js';
import {
  goToPuzzleBook,
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

async function openCompletedClassic(page) {
  await page.goto('/');
  await clearAllGameData(page);
  await page.evaluate(progress => {
    localStorage.setItem('cg_classic_v2_progress', JSON.stringify(progress));
  }, classicCompleteProgress());
  await goToPuzzleBook(page);
}

async function enterReplay(page) {
  await page.locator(S.puzzleBook.replayEntry).click();
  await expect(page.locator(S.puzzleBook.replayDialog)).toBeVisible();
  await page.locator(S.puzzleBook.replayConfirm).click();
  await expect(page.locator(S.puzzleBook.levelGridWrap))
    .toHaveAttribute('data-completion-view', 'replay');
}

test.describe('已通关视觉与重玩会话', () => {
  test('sealed 使用普通深色卡片、轻量完成框和双层重玩入口', async ({ page }) => {
    await openCompletedClassic(page);

    const browser = page.locator(S.puzzleBook.levelGridWrap);
    await expect(browser).toHaveAttribute('data-completion-view', 'sealed');
    await expect(browser.locator('.level-seal-line')).toHaveClass(/is-visible/);
    await expect(page.locator('[data-state="sealed"]')).toHaveCount(10);
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

  test('确认重玩后恢复分页与弱金卡片', async ({ page }) => {
    await openCompletedClassic(page);
    await enterReplay(page);

    await expect(page.locator('[data-state="gold"]')).toHaveCount(10);
    await expect(page.locator('[data-state="sealed"]')).toHaveCount(0);
    await expect(page.locator(S.puzzleBook.replayEntry)).toHaveCount(0);
    await expect(page.locator(S.puzzleBook.progressText)).toHaveText('1 / 6');
    await expect(page.locator(S.puzzleBook.rightArrow)).toBeVisible();
    await expect(page.locator(S.puzzleBook.rightArrow)).toBeEnabled();
  });

  test('重玩完成后保持 replay、原分页和既有奖励', async ({ page }) => {
    await openCompletedClassic(page);
    await enterReplay(page);

    const browser = page.locator(S.puzzleBook.levelGridWrap);
    for (let pageStep = 0; pageStep < 3; pageStep += 1) {
      await page.locator(S.puzzleBook.rightArrow).click();
    }
    await expect(browser).toHaveAttribute('data-page', '4');
    await expect(browser).toHaveAttribute('data-window-start', '31');
    await expect(page.locator(S.puzzleBook.difficultyName)).toHaveText('困难');

    const coinsBefore = await page.evaluate(() => localStorage.getItem('cg_coins'));
    await page.locator(S.puzzleBook.levelTile('hard-3')).click();
    await expect(page.locator(S.game.board)).toBeVisible();
    const solution = await getBrowserClassicSolution(page, {
      diff: 'hard',
      levelIdx: 3,
      playMode: 'classic',
    });
    await dragPath(page, solution);
    await expect(page.locator(S.win.panel)).toBeVisible({ timeout: 10000 });
    await page.locator(S.win.backButton).click();

    await expect(browser).toHaveAttribute('data-completion-view', 'replay');
    await expect(browser).toHaveAttribute('data-page', '4');
    await expect(browser).toHaveAttribute('data-window-start', '31');
    await expect(page.locator(S.puzzleBook.progressText)).toHaveText('4 / 6');
    await expect(page.locator(S.puzzleBook.difficultyName)).toHaveText('困难');
    await expect(page.locator(S.puzzleBook.replayDialog)).toHaveCount(0);
    await expect(page.locator(S.puzzleBook.replayEntry)).toHaveCount(0);
    await expect(page.locator(S.puzzleBook.levelTile('hard-4'))).toBeEnabled();
    expect(await page.evaluate(() => localStorage.getItem('cg_coins'))).toBe(coinsBefore);
    expect(await page.evaluate(() => JSON.parse(
      localStorage.getItem('cg_classic_v2_progress'),
    ))).toEqual(classicCompleteProgress());
  });

  test('切换玩法、离开谜题书与刷新都会退出 replay', async ({ page }) => {
    await openCompletedClassic(page);
    await enterReplay(page);

    await switchMode(page, 'hidden');
    await expect(page.locator(S.puzzleBook.levelGridWrap))
      .toHaveAttribute('data-completion-view', 'normal');
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

  test('未全部通关玩法不显示完成框或重玩入口', async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
    await goToPuzzleBook(page);

    await expect(page.locator(S.puzzleBook.levelGridWrap))
      .toHaveAttribute('data-completion-view', 'normal');
    await expect(page.locator('.level-seal-line.is-visible')).toHaveCount(0);
    await expect(page.locator(S.puzzleBook.replayEntry)).toHaveCount(0);
    await expect(page.locator(S.puzzleBook.replayHint)).toHaveCount(0);
  });
});
