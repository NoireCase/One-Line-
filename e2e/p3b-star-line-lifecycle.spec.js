import { test, expect } from '@playwright/test';
import { S } from './helpers/selectors.js';
import { goToLevel, goToStarLineLevels, goToHome } from './helpers/navigation.js';
import { clearAllGameData, getStorage } from './helpers/game-state.js';

const SINGLE_SESSION_KEY = 'cg_star_line_single_saved_game';
const DOUBLE_SESSION_KEY = 'cg_star_line_double_saved_game';

function createV2Progress(unlockedThroughId = 'star-lv-20') {
  return {
    version: 1,
    games: {
      starSingle: { completed: {}, unlockedThroughId },
      starDouble: { completed: {}, unlockedThroughId: 'star-lv-30' },
    },
  };
}

async function prepareStarLine(page, extra = {}) {
  await page.goto('/');
  await clearAllGameData(page);
  await page.evaluate((data) => {
    localStorage.setItem('cg_discovery_star_line_basic_v1', '1');
    localStorage.setItem('cg_star_line_progress_v2', JSON.stringify(data.progress));
    for (const [key, value] of Object.entries(data.extra)) {
      if (value !== undefined) localStorage.setItem(key, value);
    }
  }, { progress: createV2Progress(), extra });
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
    await prepareStarLine(page);
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });

    const solution = [1, 8, 10, 17, 24];
    for (const index of solution.slice(0, -1)) {
      await page.locator(`[data-testid="star-line-cell-${index}"]`).dblclick();
    }
    await page.locator(`[data-testid="star-line-cell-${solution[4]}"]`).dblclick();

    await abandonStarLine(page);
    await page.waitForTimeout(2000);

    const progress = await getStorage(page, 'cg_star_line_progress_v2');
    expect(progress.games.starSingle.completed['star-lv-01']).toBeUndefined();
    expect(progress.games.starSingle.unlockedThroughId).toBe('star-lv-20');
  });

  test('P3B-02: 完成延迟内保存退出仍可恢复并正常结算', async ({ page }) => {
    await prepareStarLine(page);
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });

    const solution = [1, 8, 10, 17, 24];
    for (const index of solution.slice(0, -1)) {
      await page.locator(`[data-testid="star-line-cell-${index}"]`).dblclick();
    }
    await page.locator(`[data-testid="star-line-cell-${solution[4]}"]`).dblclick();

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
});
