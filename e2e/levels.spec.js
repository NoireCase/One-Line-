import { test, expect } from '@playwright/test';
import { S } from './helpers/selectors.js';
import {
  goToPuzzleBook,
  goToStarLineLevels,
  switchMode,
} from './helpers/navigation.js';
import { clearAllGameData } from './helpers/game-state.js';
import { buildBrowserClassicSave } from './helpers/classic-level-fixture.js';
import {
  STAR_SINGLE_LEVELS,
} from '../src/game/starLine/starLineProgressV2.js';
import { PORTAL_LEVELS } from '../src/data/portalLevels.js';

const classicCompleteProgress = () => ({
  easy: Array(10).fill(3),
  medium: Array(20).fill(3),
  hard: Array(30).fill(3),
});

const starSingleProgress = ({
  completedThrough = 0,
  unlockedThrough = 1,
  complete = false,
} = {}) => {
  const completed = {};
  const completedCount = complete ? STAR_SINGLE_LEVELS.length : completedThrough;
  for (let index = 0; index < completedCount; index += 1) {
    completed[STAR_SINGLE_LEVELS[index].id] = 3;
  }
  return {
    version: 1,
    games: {
      starSingle: {
        completed,
        unlockedThroughId: STAR_SINGLE_LEVELS[
          Math.min(unlockedThrough - 1, STAR_SINGLE_LEVELS.length - 1)
        ].id,
      },
      starDouble: {
        completed: {},
        unlockedThroughId: 'star-lv-21',
      },
    },
  };
};

test.describe('关卡选择页 V3.1', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
    await goToPuzzleBook(page);
  });

  test('家族品牌、轻量玩法切换和旧结构移除', { tag: '@critical' }, async ({ page }) => {
    await expect(page.locator(S.puzzleBook.title)).toHaveText('ONE LINE');
    for (const modeId of ['classic', 'hidden', 'diagonal', 'portalClassic']) {
      await expect(page.locator(S.modeSwitcher.modeCard(modeId))).toBeVisible();
    }
    await expect(page.locator(S.puzzleBook.cta)).toHaveCount(0);
    await expect(page.locator('[data-testid^="level-chapter-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="star-track"]')).toHaveCount(0);
  });

  test('五列两行十关窗口是第一主体且页面零滚动', { tag: '@critical' }, async ({ page }) => {
    const grid = page.locator(S.puzzleBook.levelGrid);
    await expect(grid).toBeVisible();
    await expect(page.locator(S.puzzleBook.anyTile)).toHaveCount(10);
    const geometry = await grid.evaluate(element => {
      const style = getComputedStyle(element);
      const firstTile = element.querySelector('button');
      const tileBox = firstTile.getBoundingClientRect();
      return {
        columns: style.gridTemplateColumns.split(' ').filter(Boolean).length,
        rows: style.gridTemplateRows.split(' ').filter(Boolean).length,
        tileRatio: tileBox.width / tileBox.height,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
      };
    });
    expect(geometry.columns).toBe(5);
    expect(geometry.rows).toBe(2);
    expect(geometry.tileRatio).toBeCloseTo(1, 1);
    expect(geometry.scrollWidth).toBe(geometry.clientWidth);
    expect(geometry.scrollHeight).toBe(geometry.clientHeight);
  });

  test('首关为唯一推荐关、可稳定点击，锁定关不可进入', { tag: '@level-select-focused' }, async ({ page }) => {
    const first = page.locator(S.puzzleBook.levelTile('easy-0'));
    await expect(first).toHaveAttribute('data-state', 'recommended');
    await expect(first).toHaveAttribute('aria-current', 'step');
    await expect(page.locator('[data-state="recommended"]')).toHaveCount(1);
    await expect(page.locator(S.puzzleBook.levelTile('easy-1'))).toBeDisabled();
    await expect(page.locator(S.puzzleBook.progressText)).toHaveText(
      '0 / 10',
    );
    await first.click();
    await expect(page.locator(S.game.board)).toBeVisible();
    await expect(page.locator(S.game.modeLabel)).toContainText('Lv 1');
  });

  test('存档关优先成为推荐目标并恢复正确关卡', { tag: '@level-select-focused' }, async ({ page }) => {
    const { savedGame } = await buildBrowserClassicSave(page, {
      levelIdx: 5,
      timer: 20,
    });
    await page.evaluate(({ save }) => {
      localStorage.setItem('cg_classic_v2_progress', JSON.stringify({
        easy: Array(5).fill(3),
      }));
      localStorage.setItem('cg_classic_v2_saved_game', JSON.stringify(save));
    }, { save: savedGame });
    await goToPuzzleBook(page);

    const savedTile = page.locator(S.puzzleBook.levelTile('easy-5'));
    await expect(savedTile).toBeVisible();
    await expect(savedTile).toHaveAttribute('data-state', 'recommended');
    await expect(savedTile).toHaveAttribute('data-has-save', 'true');
    expect(await page.evaluate(() => localStorage.getItem('cg_classic_v2_saved_game')))
      .not.toBeNull();
    await savedTile.click();
    await expect(page.locator(S.game.board)).toBeVisible();
    await expect(page.locator(S.game.modeLabel)).toContainText('Lv 6');
  });

  test('经典难度箭头切换 10 / 20 / 30 区段并更新局部进度', { tag: '@level-select-focused' }, async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('cg_classic_v2_progress', JSON.stringify({
        easy: Array(10).fill(3),
        medium: [3, 3],
      }));
    });
    await goToPuzzleBook(page);

    await expect(page.locator(S.puzzleBook.difficultyName)).toHaveText('中等');
    await expect(page.locator(S.puzzleBook.progressText)).toHaveText(
      '2 / 20',
    );
    await page.locator(S.puzzleBook.leftArrow).click();
    await expect(page.locator(S.puzzleBook.difficultyName)).toHaveText('简单');
    await page.locator(S.puzzleBook.rightArrow).click();
    await page.locator(S.puzzleBook.rightArrow).click();
    await expect(page.locator(S.puzzleBook.difficultyName)).toHaveText('困难');
  });

  test('Hidden、Diagonal 可切换并进入各自正确关卡', { tag: '@level-select-focused' }, async ({ page }) => {
    await switchMode(page, 'hidden');
    await expect(page.locator(S.puzzleBook.difficultyName)).toHaveText('简单');
    await expect(page.locator(S.puzzleBook.levelTile('easy-0')))
      .toHaveAttribute('data-motif', 'hidden');
    await page.locator(S.puzzleBook.levelTile('easy-0')).click();
    await expect(page.locator(S.game.modeLabel)).toContainText('隐迹连线');
    await page.locator(S.game.backButton).click();
    await expect(page.locator(S.puzzleBook.levelGridWrap)).toBeVisible();
    await expect(page.locator(S.modeSwitcher.modeCard('hidden')))
      .toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(S.exitPrompt.abandonAndExit)).toHaveCount(0);

    await switchMode(page, 'diagonal');
    await expect(page.locator(S.puzzleBook.levelTile('easy-0')))
      .toHaveAttribute('data-motif', 'diagonal');
    await expect(page.locator(S.puzzleBook.levelGridWrap))
      .toHaveAttribute('data-completion-view', 'normal');
    await page.locator(S.puzzleBook.levelTile('easy-0')).click();
    await expect(page.locator(S.game.modeLabel)).toContainText('八向连线');
    await page.locator(S.game.backButton).click();
    await expect(page.locator(S.puzzleBook.levelGridWrap)).toBeVisible();
    await expect(page.locator(S.modeSwitcher.modeCard('diagonal')))
      .toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(S.exitPrompt.abandonAndExit)).toHaveCount(0);
  });

  test('Portal 为单段：无难度箭头、锚点稳定且关卡可进入', { tag: '@level-select-focused' }, async ({ page }) => {
    const classicGridBox = await page.locator(S.puzzleBook.levelGrid).boundingBox();
    await switchMode(page, 'portalClassic');
    await expect(page.locator(S.puzzleBook.difficultyName)).toHaveText('');
    await expect(page.locator(S.puzzleBook.leftArrow)).toBeHidden();
    await expect(page.locator(S.puzzleBook.rightArrow)).toBeHidden();
    const portalGridBox = await page.locator(S.puzzleBook.levelGrid).boundingBox();
    expect(Math.abs(portalGridBox.y - classicGridBox.y)).toBeLessThanOrEqual(3);
    await expect(page.locator(S.puzzleBook.anyTile)).toHaveCount(10);
    await page.locator(S.puzzleBook.levelTile('easy-0')).click();
    await expect(page.locator(S.game.board)).toBeVisible();
    await expect(page.locator(S.game.modeLabel)).toContainText('经典传送门');
  });

  test('已解锁 Portal 使用五关窗口浏览，未放开锁定边界', { tag: '@level-select-focused' }, async ({ page }) => {
    await page.evaluate((levels) => {
      localStorage.setItem('cg_portal_progress', JSON.stringify({
        easy: {
          unlockedIndex: 15,
          starsById: Object.fromEntries(
            levels.slice(0, 15).map(level => [level.id, 3]),
          ),
        },
      }));
    }, PORTAL_LEVELS);
    await goToPuzzleBook(page);
    await switchMode(page, 'portalClassic');
    const browser = page.locator(S.puzzleBook.levelGridWrap);
    await expect(browser).toHaveAttribute('data-window-start', '16');
    await browser.press('ArrowUp');
    await expect(browser).toHaveAttribute('data-window-start', '11');
    await browser.press('ArrowDown');
    await expect(browser).toHaveAttribute('data-window-start', '16');
    await browser.press('ArrowDown');
    await expect(browser).toHaveAttribute('data-window-start', '16');
  });

  test('12关难度使用稳定尾窗 1–10 → 3–12', async ({ page }) => {
    await page.evaluate((progress) => {
      localStorage.setItem('cg_star_line_progress_v2', JSON.stringify(progress));
    }, starSingleProgress({ completedThrough: 40, unlockedThrough: 52 }));
    await goToStarLineLevels(page);

    await expect(page.locator(S.puzzleBook.difficultyName)).toHaveText('高难');
    const browser = page.locator(S.puzzleBook.levelGridWrap);
    await expect(browser).toHaveAttribute('data-window-start', '1');
    await browser.press('ArrowDown');
    await expect(browser).toHaveAttribute('data-window-start', '3');
    await expect(page.locator(S.puzzleBook.levelTile('easy-51'))).toBeVisible();
  });

  test('15关未完成末窗继续下滚时保持窗口并提示推荐关', async ({ page }) => {
    await page.evaluate((progress) => {
      localStorage.setItem('cg_star_line_progress_v2', JSON.stringify(progress));
    }, starSingleProgress({ completedThrough: 18, unlockedThrough: 19 }));
    await goToStarLineLevels(page);

    await expect(page.locator(S.puzzleBook.difficultyName)).toHaveText('基础');
    const browser = page.locator(S.puzzleBook.levelGridWrap);
    await expect(browser).toHaveAttribute('data-window-start', '6');
    await browser.press('ArrowDown');
    await expect(browser).toHaveAttribute('data-window-start', '6');
    await expect(page.locator(S.puzzleBook.levelTile('easy-18'))).toHaveClass(/is-pulsing/);
  });

  test('老完成存档直接 sealed，不补播仪式', async ({ page }) => {
    await page.evaluate(progress => {
      localStorage.setItem('cg_classic_v2_progress', JSON.stringify(progress));
    }, classicCompleteProgress());
    await goToPuzzleBook(page);

    await expect(page.locator(S.puzzleBook.levelGridWrap))
      .toHaveAttribute('data-completion-view', 'sealed');
    await expect(page.locator(S.puzzleBook.progressText)).toHaveText('已通关');
    await expect(page.locator(S.puzzleBook.leftArrow)).toBeHidden();
    await expect(page.locator(S.puzzleBook.rightArrow)).toBeHidden();
    await expect(page.locator('[data-state="gold"]')).toHaveCount(10);
    const played = await page.evaluate(() => (
      JSON.parse(localStorage.getItem('cg_level_select_completion_ceremony_v1'))
    ));
    expect(played).toContain('classic');
  });

  test('老完成存档 sealed 打开确认，取消后保持 sealed', { tag: '@level-select-focused' }, async ({ page }) => {
    await page.evaluate(progress => {
      localStorage.setItem('cg_classic_v2_progress', JSON.stringify(progress));
    }, classicCompleteProgress());
    await goToPuzzleBook(page);

    const first = page.locator(S.puzzleBook.levelTile('easy-0'));
    await first.focus();
    await first.click();
    const dialog = page.locator(S.puzzleBook.replayDialog);
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('经典模式已通关');
    await expect(dialog).toContainText(
      '进入重玩模式后，可自由选择任意已完成关卡。通关记录不会清除。',
    );
    await expect(page.locator(S.puzzleBook.replayConfirm)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(first).toBeFocused();
    await expect(page.locator(S.puzzleBook.levelGridWrap))
      .toHaveAttribute('data-completion-view', 'sealed');
  });

  test('确认进入 replay 后可浏览并重玩后续难度且不清记录', { tag: '@level-select-focused' }, async ({ page }) => {
    await page.evaluate(progress => {
      localStorage.setItem('cg_classic_v2_progress', JSON.stringify(progress));
    }, classicCompleteProgress());
    await goToPuzzleBook(page);

    await page.locator(S.puzzleBook.levelGridWrap).click({ position: { x: 4, y: 4 } });
    await page.locator(S.puzzleBook.replayConfirm).click();
    const browser = page.locator(S.puzzleBook.levelGridWrap);
    await expect(browser).toHaveAttribute('data-completion-view', 'replay');
    await expect(browser).toHaveAttribute('data-window-start', '1');
    await expect(page.locator(S.puzzleBook.rightArrow)).toBeVisible();
    await expect(page.locator(S.puzzleBook.progressText)).toHaveText(
      '10 / 10',
    );
    await expect(page.locator(S.game.board)).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(
      localStorage.getItem('cg_classic_v2_progress'),
    ))).toEqual(classicCompleteProgress());
    await page.locator(S.puzzleBook.rightArrow).click();
    await expect(page.locator(S.puzzleBook.difficultyName)).toHaveText('中等');
    await browser.press('ArrowDown');
    await browser.press('ArrowDown');
    const laterLevel = page.locator(S.puzzleBook.levelTile('medium-10'));
    await expect(laterLevel).toBeVisible();
    await laterLevel.click();
    await expect(page.locator(S.game.board)).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(
      localStorage.getItem('cg_classic_v2_progress'),
    ))).toEqual(classicCompleteProgress());
  });

  test('Star Single replay 与 Star Double 隔离，重新进入恢复 sealed', { tag: '@level-select-focused' }, async ({ page }) => {
    await page.evaluate((progress) => {
      localStorage.setItem('cg_star_line_progress_v2', JSON.stringify(progress));
    }, starSingleProgress({ complete: true, unlockedThrough: 60 }));
    await goToStarLineLevels(page);

    await page.locator(S.puzzleBook.levelGridWrap).click({ position: { x: 4, y: 4 } });
    await page.locator(S.puzzleBook.replayConfirm).click();
    await expect(page.locator(S.puzzleBook.levelGridWrap))
      .toHaveAttribute('data-completion-view', 'replay');

    await switchMode(page, 'starDouble');
    await expect(page.locator(S.puzzleBook.levelGridWrap))
      .toHaveAttribute('data-completion-view', 'normal');
    await expect(page.locator('[data-state="gold"]')).toHaveCount(0);
    await expect(page.locator(S.puzzleBook.progressText)).not.toHaveText('已通关');

    await switchMode(page, 'starSingle');
    await expect(page.locator(S.puzzleBook.levelGridWrap))
      .toHaveAttribute('data-completion-view', 'replay');

    await page.locator(S.puzzleBook.backButton).click();
    await goToStarLineLevels(page);
    await expect(page.locator(S.puzzleBook.levelGridWrap))
      .toHaveAttribute('data-completion-view', 'sealed');
  });

  test('ModeSwitcher 使用按钮 group 语义且键盘可切换', async ({ page }) => {
    const group = page.locator('[data-testid="mode-switcher"] [role="group"]');
    await expect(group).toHaveCount(1);
    await expect(page.locator('[data-testid="mode-switcher"] [role="tab"]')).toHaveCount(0);
    const diagonal = page.locator(S.modeSwitcher.modeCard('diagonal'));
    await diagonal.focus();
    await page.keyboard.press('Enter');
    await expect(diagonal).toHaveAttribute('aria-pressed', 'true');
  });
});
