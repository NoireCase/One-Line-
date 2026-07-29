import { test, expect } from '@playwright/test';
import { PORTAL_LEVELS } from '../src/data/portalLevels.js';
import { getHiddenLevel } from '../src/data/hiddenLevels.js';
import {
  STAR_DOUBLE_LEVELS,
  STAR_SINGLE_LEVELS,
} from '../src/game/starLine/starLineProgressV2.js';
import {
  LEVEL_SELECT_REPLAY_STORAGE_KEY,
  LEVEL_SELECT_REPLAY_STORAGE_VERSION,
} from '../src/utils/levelSelectReplayStorage.js';
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
        completed: Object.fromEntries(
          STAR_SINGLE_LEVELS.map(level => [level.id, 3]),
        ),
        unlockedThroughId: STAR_SINGLE_LEVELS.at(-1).id,
      },
      starDouble: {
        completed: Object.fromEntries(
          STAR_DOUBLE_LEVELS.map(level => [level.id, 3]),
        ),
        unlockedThroughId: STAR_DOUBLE_LEVELS.at(-1).id,
      },
    },
  },
};

const replayMark = family => (
  `[data-testid^="level-replay-mark-${family}-"]`
);

async function seedCompletedModes(page) {
  await page.evaluate((progress) => {
    localStorage.setItem(
      'cg_classic_v2_progress',
      JSON.stringify(progress.classic),
    );
    localStorage.setItem(
      'cg_diagonal_progress',
      JSON.stringify(progress.diagonal),
    );
    localStorage.setItem(
      'cg_hidden_progress',
      JSON.stringify(progress.hidden),
    );
    localStorage.setItem(
      'cg_portal_progress',
      JSON.stringify(progress.portal),
    );
    localStorage.setItem(
      'cg_star_line_progress_v2',
      JSON.stringify(progress.starLine),
    );
  }, allModeProgress);
}

async function seedReplayProgress(page, modes) {
  await page.evaluate(([key, version, replayModes]) => {
    localStorage.setItem(key, JSON.stringify({
      version,
      modes: replayModes,
    }));
  }, [
    LEVEL_SELECT_REPLAY_STORAGE_KEY,
    LEVEL_SELECT_REPLAY_STORAGE_VERSION,
    modes,
  ]);
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

async function expectFreshReplay(page, family, pageCount) {
  const firstTile = page.locator(S.puzzleBook.levelTile('easy-0'));
  await expect(page.locator('[data-state="recommended"]')).toHaveCount(1);
  await expect(firstTile).toHaveAttribute('data-state', 'recommended');
  await expect(firstTile).toHaveAttribute('data-completed', 'true');
  await expect(page.locator('[data-state="completed"]')).toHaveCount(9);
  await expect(page.locator('[data-state="replayed"]')).toHaveCount(0);
  await expect(page.locator(replayMark(family))).toHaveCount(1);
  await expect(page.locator('[data-testid^="level-current-star-"]'))
    .toHaveCount(0);
  await expect(page.locator(S.puzzleBook.progressText))
    .toHaveText(`1 / ${pageCount}`);
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

async function readSvgGeometry(locator) {
  return locator.evaluate(svg => (
    [...svg.querySelectorAll('path,circle')].map(node => ({
      tag: node.tagName,
      d: node.getAttribute('d'),
      cx: node.getAttribute('cx'),
      cy: node.getAttribute('cy'),
      r: node.getAttribute('r'),
    }))
  ));
}

test.describe('全玩法三层关卡状态与持久化重玩', () => {
  test('正常推进只显示当前金星；整体通关恢复整组金色卡片', async ({ page }) => {
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
    await expect(page.locator('[data-testid^="level-current-star-"]'))
      .toHaveCount(1);
    await expect(page.locator(replayMark('oneLine'))).toHaveCount(0);
    await expect(page.locator(replayMark('starLine'))).toHaveCount(0);

    await page.locator(S.puzzleBook.backButton).click();
    await seedCompletedModes(page);
    await goToPuzzleBook(page);
    const browser = page.locator(S.puzzleBook.levelGridWrap);
    await expect(browser).toHaveAttribute('data-completion-view', 'sealed');
    await expect(browser.locator('.level-seal-line')).toHaveClass(/is-visible/);
    await expect(page.locator('[data-state="sealed"]')).toHaveCount(10);
    await expect(page.locator(S.puzzleBook.progressText)).toHaveText('已通关');
    await expect(page.locator(S.puzzleBook.replayHint)).toHaveText('点击重玩');
    await expect(page.locator('[data-testid^="level-current-star-"]'))
      .toHaveCount(0);
    await expect(page.locator(replayMark('oneLine'))).toHaveCount(0);
    await expect(page.locator(replayMark('starLine'))).toHaveCount(0);
  });

  test('六玩法按玩法族复用首页真实 SVG，且两族几何不混用', async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
    await seedCompletedModes(page);
    const homeOneLineGeometry = await readSvgGeometry(
      page.locator(`${S.home.startButton} svg`),
    );
    const homeStarLineGeometry = await readSvgGeometry(
      page.locator(`${S.home.starLineButton} svg`),
    );

    await goToPuzzleBook(page);
    for (const modeId of ['classic', 'hidden', 'diagonal', 'portalClassic']) {
      if (modeId !== 'classic') await switchMode(page, modeId);
      await enterReplay(page);
      await expectFreshReplay(
        page,
        'oneLine',
        modeId === 'portalClassic' ? 3 : 6,
      );
      await expect(page.locator(replayMark('starLine'))).toHaveCount(0);
      expect(await readSvgGeometry(page.locator(replayMark('oneLine')).first()))
        .toEqual(homeOneLineGeometry);
    }

    await page.locator(S.puzzleBook.backButton).click();
    await goToStarLineLevels(page);
    for (const modeId of ['starSingle', 'starDouble']) {
      if (modeId !== 'starSingle') await switchMode(page, modeId);
      await enterReplay(page);
      await expectFreshReplay(page, 'starLine', 6);
      await expect(page.locator(replayMark('oneLine'))).toHaveCount(0);
      expect(await readSvgGeometry(page.locator(replayMark('starLine')).first()))
        .toEqual(homeStarLineGeometry);
    }
    expect(homeOneLineGeometry).not.toEqual(homeStarLineGeometry);
  });

  test('真实重玩通关写入独立记录、推进最早空洞且不重复发奖', async ({ page }) => {
    await openCompletedClassic(page);
    await enterReplay(page);

    const coinsBefore = await page.evaluate(() => localStorage.getItem('cg_coins'));
    await completeClassicLevel(page, {
      key: 'easy-0',
      diff: 'easy',
      levelIdx: 0,
    });

    const first = page.locator(S.puzzleBook.levelTile('easy-0'));
    const second = page.locator(S.puzzleBook.levelTile('easy-1'));
    await expect(first).toHaveAttribute('data-state', 'replayed');
    await expect(second).toHaveAttribute('data-state', 'recommended');
    await expect(first.locator(replayMark('oneLine'))).toHaveCount(1);
    await expect(second.locator(replayMark('oneLine'))).toHaveCount(1);
    await expect(page.locator('[data-testid^="level-current-star-"]'))
      .toHaveCount(0);

    const replay = await page.evaluate(
      key => JSON.parse(localStorage.getItem(key)),
      LEVEL_SELECT_REPLAY_STORAGE_KEY,
    );
    expect(replay.modes.classic.replayCompletedLevelIds)
      .toEqual(['classic:easy:0']);
    expect(await page.evaluate(() => localStorage.getItem('cg_coins')))
      .toBe(coinsBefore);
    expect(await page.evaluate(() => JSON.parse(
      localStorage.getItem('cg_classic_v2_progress'),
    ))).toEqual(classicCompleteProgress());
  });

  test('跨玩法、首页往返、刷新与跨玩法族均恢复独立进度', async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
    await seedCompletedModes(page);
    await seedReplayProgress(page, {
      classic: {
        replayActive: true,
        replayCompletedLevelIds: ['classic:easy:0', 'classic:easy:1'],
        lastReplayPage: 0,
      },
      hidden: {
        replayActive: true,
        replayCompletedLevelIds: [
          getHiddenLevel(0).id,
          getHiddenLevel(1).id,
        ],
        lastReplayPage: 0,
      },
      starSingle: {
        replayActive: true,
        replayCompletedLevelIds: STAR_SINGLE_LEVELS
          .slice(0, 3)
          .map(level => level.id),
        lastReplayPage: 0,
      },
    });
    await page.reload();
    await goToPuzzleBook(page);

    await expect(page.locator(S.puzzleBook.levelTile('easy-0')))
      .toHaveAttribute('data-state', 'replayed');
    await expect(page.locator(S.puzzleBook.levelTile('easy-1')))
      .toHaveAttribute('data-state', 'replayed');
    await expect(page.locator(S.puzzleBook.levelTile('easy-2')))
      .toHaveAttribute('data-state', 'recommended');
    await expect(page.locator(replayMark('oneLine'))).toHaveCount(3);

    await switchMode(page, 'hidden');
    await expect(page.locator(S.puzzleBook.levelTile('easy-2')))
      .toHaveAttribute('data-state', 'recommended');
    await switchMode(page, 'classic');
    await expect(page.locator(S.puzzleBook.levelTile('easy-2')))
      .toHaveAttribute('data-state', 'recommended');

    await page.locator(S.puzzleBook.backButton).click();
    await goToPuzzleBook(page);
    await expect(page.locator(S.puzzleBook.levelTile('easy-2')))
      .toHaveAttribute('data-state', 'recommended');

    await page.reload();
    await goToPuzzleBook(page);
    await expect(page.locator(S.puzzleBook.levelTile('easy-2')))
      .toHaveAttribute('data-state', 'recommended');

    await page.locator(S.puzzleBook.backButton).click();
    await goToStarLineLevels(page);
    await expect(page.locator(S.puzzleBook.levelTile('easy-0')))
      .toHaveAttribute('data-state', 'replayed');
    await expect(page.locator(S.puzzleBook.levelTile('easy-2')))
      .toHaveAttribute('data-state', 'replayed');
    await expect(page.locator(S.puzzleBook.levelTile('easy-3')))
      .toHaveAttribute('data-state', 'recommended');
    await expect(page.locator(replayMark('starLine'))).toHaveCount(4);
    await expect(page.locator(replayMark('oneLine'))).toHaveCount(0);

    await switchMode(page, 'starDouble');
    await expect(page.locator(S.puzzleBook.levelGridWrap))
      .toHaveAttribute('data-completion-view', 'sealed');
    await switchMode(page, 'starSingle');
    await expect(page.locator(S.puzzleBook.levelTile('easy-3')))
      .toHaveAttribute('data-state', 'recommended');

    const stored = await page.evaluate(
      key => JSON.parse(localStorage.getItem(key)),
      LEVEL_SELECT_REPLAY_STORAGE_KEY,
    );
    expect(Object.keys(stored.modes).sort())
      .toEqual(['classic', 'hidden', 'starSingle']);
  });

  test('跨页指针和全部二次通关均稳定恢复，不循环回第一页', async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
    await seedCompletedModes(page);
    await seedReplayProgress(page, {
      classic: {
        replayActive: true,
        replayCompletedLevelIds: Array.from(
          { length: 10 },
          (_, index) => `classic:easy:${index}`,
        ),
        lastReplayPage: 1,
      },
      starSingle: {
        replayActive: true,
        replayCompletedLevelIds: STAR_SINGLE_LEVELS.map(level => level.id),
        lastReplayPage: 5,
      },
    });
    await page.reload();
    await goToPuzzleBook(page);

    const browser = page.locator(S.puzzleBook.levelGridWrap);
    await expect(browser).toHaveAttribute('data-page', '2');
    await expect(browser).toHaveAttribute('data-window-start', '11');
    await expect(page.locator(S.puzzleBook.levelTile('medium-0')))
      .toHaveAttribute('data-state', 'recommended');
    await expect(page.locator(S.puzzleBook.difficultyName)).toHaveText('中等');

    await page.locator(S.puzzleBook.backButton).click();
    await goToStarLineLevels(page);
    await expect(page.locator(S.puzzleBook.levelGridWrap))
      .toHaveAttribute('data-page', '6');
    await expect(page.locator('[data-state="recommended"]')).toHaveCount(0);
    await expect(page.locator('[data-state="replayed"]')).toHaveCount(10);
    await expect(page.locator(replayMark('starLine'))).toHaveCount(10);
    await expect(page.locator(S.puzzleBook.progressText)).toHaveText('6 / 6');
    await expect(page.locator(S.puzzleBook.rightArrow)).toBeDisabled();
  });
});
