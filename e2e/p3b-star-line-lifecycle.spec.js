import { test, expect } from '@playwright/test';
import { getStarLineCompletionTiming } from '../src/game/starLine/starLineFeedbackTiming.js';
import { S } from './helpers/selectors.js';
import {
  goToLevel,
  goToStarLineLevels,
  goToHome,
  switchMode,
} from './helpers/navigation.js';
import { clearAllGameData, getStorage } from './helpers/game-state.js';

const SINGLE_SESSION_KEY = 'cg_star_line_single_saved_game';
const DOUBLE_SESSION_KEY = 'cg_star_line_double_saved_game';
const CLASSIC_SESSION_KEY = 'cg_classic_v2_saved_game';
const SINGLE_SETTLE_DELAY = getStarLineCompletionTiming({ starsPerRow: 1 }).winPanelDelay;
const TEST_CLOCK_EPOCH = new Date('2025-01-01T00:00:00.000Z');
const TEST_CLOCK_PAUSE_TIME = new Date('2025-01-01T00:01:00.000Z');
const STAR_SINGLE_SOLUTION = [1, 8, 10, 17, 24];

function createV2Progress(unlockedThroughId = 'star-lv-20') {
  return {
    version: 1,
    games: {
      starSingle: { completed: {}, unlockedThroughId },
      starDouble: { completed: {}, unlockedThroughId: 'star-lv-30' },
    },
  };
}

async function prepareStarLine(page, {
  extra = {},
  progress = createV2Progress(),
} = {}) {
  await page.goto('/');
  await clearAllGameData(page);
  await page.evaluate((data) => {
    localStorage.setItem('cg_discovery_star_line_basic_v1', '1');
    localStorage.setItem('cg_discovery_star_line_double_star_v1', '1');
    localStorage.setItem('cg_coins', '100');
    localStorage.setItem('cg_global_score', '0');
    localStorage.setItem('cg_star_line_progress_v2', JSON.stringify(data.progress));
    for (const [key, value] of Object.entries(data.extra)) {
      if (value !== undefined) localStorage.setItem(key, value);
    }
  }, { progress, extra });
}

async function getSavedGame(page, key) {
  return page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  }, key);
}

// Star Line cell 的 X 标记通过 CSS class is-marked-x 检测
function cellXLocator(page, index) {
  return page.locator(`[data-testid="star-line-cell-${index}"].is-marked-x`);
}

async function freezeGameClock(page) {
  await page.clock.install({ time: TEST_CLOCK_EPOCH });
  await page.clock.pauseAt(TEST_CLOCK_PAUSE_TIME);
}

async function placeStarSingleSolution(page, indexes = STAR_SINGLE_SOLUTION) {
  for (const index of indexes) {
    await page.locator(`[data-testid="star-line-cell-${index}"]`).dblclick();
  }
}

async function enterClassicFromStarCatalog(page) {
  await page.locator(S.puzzleBook.backButton).click();
  await expect(page.locator(S.home.view)).toBeVisible();
  await page.locator(S.home.startButton).click();
  await expect(page.locator(S.puzzleBook.title)).toHaveText('ONE LINE');
  await page.locator(S.puzzleBook.levelTile('easy-0')).click();
  await expect(page.locator(S.game.board)).toBeVisible();
}

// 在 Star Line 游戏中保存并退出
async function saveAndExitStarLine(page) {
  await page.locator('[data-testid="back-button"]').click();
  await expect(page.locator('[data-testid="exit-prompt"]')).toBeVisible({ timeout: 3000 });
  await page.locator(S.exitPrompt.saveAndExit).click();
  await expect(page.locator('[data-testid="puzzle-book-title"]')).toBeVisible({ timeout: 5000 });
}

// 在 Star Line 游戏中放弃并退出
async function abandonStarLine(page) {
  await page.locator('[data-testid="back-button"]').click();
  await expect(page.locator('[data-testid="exit-prompt"]')).toBeVisible({ timeout: 3000 });
  await page.locator(S.exitPrompt.abandonAndExit).click();
  await expect(page.locator('[data-testid="puzzle-book-title"]')).toBeVisible({ timeout: 5000 });
}

test.describe('P3B Star Line 生命周期保护', () => {
  test('P3B-01: 完成延迟内放弃退出不触发结算', async ({ page }) => {
    await prepareStarLine(page, { progress: createV2Progress('star-lv-01') });
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });

    await placeStarSingleSolution(page, STAR_SINGLE_SOLUTION.slice(0, -1));
    await freezeGameClock(page);
    await placeStarSingleSolution(page, STAR_SINGLE_SOLUTION.slice(-1));
    await expect(page.locator('[data-testid="star-line-board-container"]')).toHaveClass(/is-complete/);

    await abandonStarLine(page);
    await page.clock.runFor(SINGLE_SETTLE_DELAY + 100);

    const progress = await getStorage(page, 'cg_star_line_progress_v2');
    expect(progress.games.starSingle.completed['star-lv-01']).toBeUndefined();
    expect(progress.games.starSingle.unlockedThroughId).toBe('star-lv-01');
    expect(await getStorage(page, 'cg_coins')).toBe(100);
    await expect(page.locator(S.win.panel)).toHaveCount(0);
    await expect(page.locator(S.puzzleBook.levelTile('easy-0'))).not.toHaveAttribute('data-completed', 'true');
  });

  test('P3B-02: 完成延迟内保存退出仍可恢复并正常结算', async ({ page }) => {
    await prepareStarLine(page);
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });

    await placeStarSingleSolution(page);

    await saveAndExitStarLine(page);
    await goToHome(page);
    await expect(page.locator('[data-testid="home-continue-button"]')).toBeVisible({ timeout: 3000 });
    await page.locator('[data-testid="home-continue-button"]').click();
    await expect(page.locator(S.win.panel)).toBeVisible({ timeout: 5000 });

    const progress = await getStorage(page, 'cg_star_line_progress_v2');
    expect(progress.games.starSingle.completed['star-lv-01']).toBeDefined();
  });

  test('P3B-03: 重开后刷新不会恢复旧存档', async ({ page }) => {
    await prepareStarLine(page);
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });

    await page.locator('[data-testid="star-line-cell-0"]').click();
    await page.locator('[data-testid="star-line-cell-1"]').click();
    await expect(cellXLocator(page, 0)).toBeVisible({ timeout: 3000 });

    await saveAndExitStarLine(page);
    let saved = await getSavedGame(page, SINGLE_SESSION_KEY);
    expect(saved).not.toBeNull();

    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });
    await expect(cellXLocator(page, 0)).toBeVisible({ timeout: 3000 });

    await page.locator('[data-testid="restart-button"]').click();
    await expect(page.locator('[data-testid="restart-confirmation"]')).toBeVisible({ timeout: 2000 });
    await page.locator('[data-testid="restart-button"]').click();
    await page.waitForTimeout(500);
    await expect(cellXLocator(page, 0)).not.toBeVisible();

    saved = await getSavedGame(page, SINGLE_SESSION_KEY);
    expect(saved).toBeNull();

    await page.reload();
    await page.waitForTimeout(500);
    await goToStarLineLevels(page);
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });
    await page.waitForTimeout(500);
    await expect(cellXLocator(page, 0)).not.toBeVisible();
  });

  test('P3B-04: 单星重开不影响双星存档', async ({ page }) => {
    await prepareStarLine(page);

    // 创建单星存档
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });
    await page.locator('[data-testid="star-line-cell-2"]').click();
    await expect(cellXLocator(page, 2)).toBeVisible({ timeout: 3000 });
    await saveAndExitStarLine(page);
    expect(await getSavedGame(page, SINGLE_SESSION_KEY)).not.toBeNull();

    // 直接写入双星模拟存档（不经过 UI，避免教学干扰）
    await page.evaluate((key) => {
      localStorage.setItem(key, JSON.stringify({ playMode: 'starDouble', diff: 'easy', levelIdx: 0, savedAt: Date.now() }));
    }, DOUBLE_SESSION_KEY);
    expect(await getSavedGame(page, DOUBLE_SESSION_KEY)).not.toBeNull();

    // 进入单星并重开
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });
    await page.locator('[data-testid="restart-button"]').click();
    await expect(page.locator('[data-testid="restart-confirmation"]')).toBeVisible({ timeout: 2000 });
    await page.locator('[data-testid="restart-button"]').click();
    await page.waitForTimeout(500);

    // 单星存档应被清除
    expect(await getSavedGame(page, SINGLE_SESSION_KEY)).toBeNull();

    // 双星存档应仍然存在
    expect(await getSavedGame(page, DOUBLE_SESSION_KEY)).not.toBeNull();
  });

  test('P3B-05: settle delay 内切换到 One Line 不结算旧 Star Line session', async ({ page }) => {
    await prepareStarLine(page, { progress: createV2Progress('star-lv-01') });
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });

    await placeStarSingleSolution(page, STAR_SINGLE_SOLUTION.slice(0, -1));
    await freezeGameClock(page);
    await placeStarSingleSolution(page, STAR_SINGLE_SOLUTION.slice(-1));
    await expect(page.locator('[data-testid="star-line-board-container"]')).toHaveClass(/is-complete/);

    await abandonStarLine(page);
    await enterClassicFromStarCatalog(page);
    await page.clock.runFor(SINGLE_SETTLE_DELAY + 100);

    const progress = await getStorage(page, 'cg_star_line_progress_v2');
    expect(progress.games.starSingle.completed['star-lv-01']).toBeUndefined();
    expect(progress.games.starSingle.unlockedThroughId).toBe('star-lv-01');
    expect(await getStorage(page, 'cg_coins')).toBe(100);
    await expect(page.locator(S.game.board)).toBeVisible();
    await expect(page.locator(S.win.panel)).toHaveCount(0);
  });

  test('P3B-06: Star Single settle 切到 Star Double 不污染新 session', async ({ page }) => {
    await prepareStarLine(page, { progress: createV2Progress('star-lv-01') });
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });

    await placeStarSingleSolution(page, STAR_SINGLE_SOLUTION.slice(0, -1));
    await freezeGameClock(page);
    await placeStarSingleSolution(page, STAR_SINGLE_SOLUTION.slice(-1));
    await expect(page.locator('[data-testid="star-line-board-container"]')).toHaveClass(/is-complete/);

    await abandonStarLine(page);
    await switchMode(page, 'starDouble');
    await page.locator(S.puzzleBook.levelTile('easy-0')).click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();
    await page.clock.runFor(SINGLE_SETTLE_DELAY + 100);

    const progress = await getStorage(page, 'cg_star_line_progress_v2');
    expect(progress.games.starSingle.completed['star-lv-01']).toBeUndefined();
    expect(progress.games.starDouble.completed['star-lv-01']).toBeUndefined();
    expect(await getStorage(page, 'cg_coins')).toBe(100);
    expect(await getSavedGame(page, SINGLE_SESSION_KEY)).toBeNull();
    expect(await getSavedGame(page, DOUBLE_SESSION_KEY)).toBeNull();
    await expect(page.locator('[data-testid="star-line-board-container"]')).not.toHaveClass(/is-complete/);
    await expect(page.locator(S.win.panel)).toHaveCount(0);
  });

  test('P3B-07: 已进入队列的旧 callback 无法越过 session token', async ({ page }) => {
    await prepareStarLine(page, { progress: createV2Progress('star-lv-01') });
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });

    await placeStarSingleSolution(page, STAR_SINGLE_SOLUTION.slice(0, -1));
    await freezeGameClock(page);
    // 故意让 clearTimeout 失效：旧 callback 仍会执行，测试必须依靠 token guard 通过。
    await page.evaluate(() => {
      window.clearTimeout = () => {};
    });
    await placeStarSingleSolution(page, STAR_SINGLE_SOLUTION.slice(-1));
    await expect(page.locator('[data-testid="star-line-board-container"]')).toHaveClass(/is-complete/);

    await page.locator('[data-testid="restart-button"]').click();
    await expect(page.locator('[data-testid="restart-confirmation"]')).toBeVisible();
    await page.locator('[data-testid="restart-button"]').click();
    await expect(page.locator('[data-testid="star-line-board-container"]')).not.toHaveClass(/is-complete/);

    await page.clock.runFor(SINGLE_SETTLE_DELAY + 100);
    let progress = await getStorage(page, 'cg_star_line_progress_v2');
    expect(progress.games.starSingle.completed['star-lv-01']).toBeUndefined();
    expect(await getStorage(page, 'cg_coins')).toBe(100);
    await expect(page.locator(S.win.panel)).toHaveCount(0);

    await placeStarSingleSolution(page);
    await page.clock.runFor(SINGLE_SETTLE_DELAY);
    await expect(page.locator(S.win.panel)).toBeVisible();

    progress = await getStorage(page, 'cg_star_line_progress_v2');
    expect(progress.games.starSingle.completed['star-lv-01']).toBeDefined();
    expect(progress.games.starSingle.unlockedThroughId).not.toBe('star-lv-01');
    const progressAfterSessionB = await page.evaluate(
      () => localStorage.getItem('cg_star_line_progress_v2'),
    );
    expect(await getStorage(page, 'cg_coins')).toBe(100);

    await page.clock.runFor(SINGLE_SETTLE_DELAY + 100);
    expect(await page.evaluate(
      () => localStorage.getItem('cg_star_line_progress_v2'),
    )).toBe(progressAfterSessionB);
    expect(await getStorage(page, 'cg_coins')).toBe(100);
    await expect(page.locator(S.win.panel)).toHaveCount(1);
  });

  test('P3B-08: unknown saved mode fail-closed 且保留其他有效存档', async ({ page }) => {
    await prepareStarLine(page);
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });

    await page.locator('[data-testid="star-line-cell-0"]').click();
    await page.locator('[data-testid="star-line-cell-1"]').click();
    await expect(cellXLocator(page, 0)).toBeVisible();
    await saveAndExitStarLine(page);
    await page.locator(S.puzzleBook.backButton).click();
    await expect(page.locator(S.home.view)).toBeVisible();

    const invalidClassicSession = JSON.stringify({
      playMode: 'futureUnknownMode',
      diff: 'easy',
      levelIdx: 0,
      path: [0],
      savedAt: Date.now() + 1000,
    });
    await page.evaluate(([key, value]) => {
      localStorage.setItem(key, value);
    }, [CLASSIC_SESSION_KEY, invalidClassicSession]);

    await page.reload();
    await expect(page.locator(S.home.view)).toBeVisible();
    await expect(page.locator(S.home.continueButton)).toBeVisible();
    await expect(page.locator('[data-testid="home-continue-context"]')).toContainText('Star Line');
    expect(await page.evaluate((key) => localStorage.getItem(key), CLASSIC_SESSION_KEY)).toBe(invalidClassicSession);

    await page.locator(S.home.continueButton).click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();
    await expect(page.locator(S.game.board)).toHaveCount(0);
    await expect(cellXLocator(page, 0)).toBeVisible();
    expect(await getSavedGame(page, SINGLE_SESSION_KEY)).not.toBeNull();
    expect(await page.evaluate((key) => localStorage.getItem(key), CLASSIC_SESSION_KEY)).toBe(invalidClassicSession);
    expect(await getStorage(page, 'cg_classic_v2_progress')).toBeNull();
  });
});
