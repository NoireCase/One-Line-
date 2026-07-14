import { test, expect } from '@playwright/test';
import { S } from './helpers/selectors.js';
import { exitGame, goToLevel, goToStarLineLevels } from './helpers/navigation.js';
import { clearAllGameData, getStorage } from './helpers/game-state.js';

const V2_KEY = 'cg_star_line_progress_v2';
const V1_KEY = 'cg_star_line_progress';
const SINGLE_SESSION_KEY = 'cg_star_line_single_saved_game';
const DOUBLE_SESSION_KEY = 'cg_star_line_double_saved_game';
const LEGACY_SESSION_KEY = 'cg_star_line_saved_game';

function createV2Progress() {
  return {
    version: 1,
    games: {
      starSingle: { completed: {}, unlockedThroughId: 'star-lv-20' },
      starDouble: { completed: {}, unlockedThroughId: 'star-lv-30' },
    },
  };
}

async function prepareStarLine(page, extraStorage = {}) {
  await page.goto('/');
  await clearAllGameData(page);
  await page.evaluate((data) => {
    localStorage.setItem('cg_discovery_star_line_basic_v1', '1');
    localStorage.setItem('cg_discovery_star_line_double_star_v1', '1');
    localStorage.setItem('cg_star_line_progress_v2', JSON.stringify(data.progress));
    for (const [key, value] of Object.entries(data.extra)) {
      localStorage.setItem(key, value);
    }
  }, { progress: createV2Progress(), extra: extraStorage });
}

async function completeStarLineLevel(page, solution) {
  for (const index of solution) {
    await page.locator(`[data-testid="star-line-cell-${index}"]`).click();
  }
  await expect(page.locator(S.win.panel)).toBeVisible({ timeout: 5000 });
}

async function getRawStorage(page, key) {
  return page.evaluate(storageKey => localStorage.getItem(storageKey), key);
}

test.describe('Star Line 进度与中断存档隔离', () => {
  test('单双星通关只写 v2，旧进度字符串保持完全不变', async ({ page }) => {
    const legacyRaw = JSON.stringify({ unlockedThrough: 7, completed: { 0: 2, 7: 3 } });
    await prepareStarLine(page, { [V1_KEY]: legacyRaw });

    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });
    await completeStarLineLevel(page, [1, 8, 10, 17, 24]);
    await expect.poll(() => getStorage(page, V2_KEY)).toMatchObject({
      games: { starSingle: { completed: { 'star-lv-01': 3 } } },
    });
    expect(await getRawStorage(page, V1_KEY)).toBe(legacyRaw);

    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    await completeStarLineLevel(page, [1, 3, 13, 15, 17, 19, 29, 31, 32, 34, 44, 46, 48, 50, 60, 62]);
    await expect.poll(() => getStorage(page, V2_KEY)).toMatchObject({
      games: {
        starSingle: { completed: { 'star-lv-01': 3 } },
        starDouble: { completed: { 'star-lv-21': 3 } },
      },
    });
    expect(await getRawStorage(page, V1_KEY)).toBe(legacyRaw);
  });

  test('旧进度不存在时，单双星正式流程也不会创建它', async ({ page }) => {
    await prepareStarLine(page);
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });
    await completeStarLineLevel(page, [1, 8, 10, 17, 24]);
    expect(await getRawStorage(page, V1_KEY)).toBeNull();

    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    await completeStarLineLevel(page, [1, 3, 13, 15, 17, 19, 29, 31, 32, 34, 44, 46, 48, 50, 60, 62]);
    expect(await getRawStorage(page, V1_KEY)).toBeNull();
  });

  for (const [modeId, solution, completedId] of [
    ['starSingle', [1, 8, 10, 17, 24], 'star-lv-01'],
    ['starDouble', [1, 3, 13, 15, 17, 19, 29, 31, 32, 34, 44, 46, 48, 50, 60, 62], 'star-lv-21'],
  ]) {
    test(`${modeId} v2 写入失败不会崩溃，恢复后可再次保存`, async ({ page }) => {
      const legacyRaw = JSON.stringify({ unlockedThrough: 0, completed: { 0: 1 } });
      await prepareStarLine(page, { [V1_KEY]: legacyRaw });
      await goToLevel(page, { modeId, levelKey: 'easy-0' });

      await page.evaluate(() => {
        const originalSetItem = Storage.prototype.setItem;
        window.__starLineStorageFailure = true;
        Storage.prototype.setItem = function setItemWithV2Failure(key, value) {
          if (key === 'cg_star_line_progress_v2' && window.__starLineStorageFailure) {
            throw new Error('storage disabled');
          }
          return originalSetItem.call(this, key, value);
        };
      });
      await completeStarLineLevel(page, solution);
      expect(await getRawStorage(page, V1_KEY)).toBe(legacyRaw);
      expect((await getStorage(page, V2_KEY)).games[modeId].completed[completedId]).toBeUndefined();

      await page.reload();
      await goToLevel(page, { modeId, levelKey: 'easy-0' });
      await completeStarLineLevel(page, solution);
      await expect.poll(() => getStorage(page, V2_KEY)).toMatchObject({
        games: { [modeId]: { completed: { [completedId]: 3 } } },
      });
      expect(await getRawStorage(page, V1_KEY)).toBe(legacyRaw);
    });
  }

  test('单星和双星中断局可同时保存，并且只恢复各自的棋盘', async ({ page }) => {
    await prepareStarLine(page);

    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });
    await page.locator('[data-testid="star-line-cell-1"]').click();
    await exitGame(page, 'save');
    const singleSave = await getRawStorage(page, SINGLE_SESSION_KEY);
    expect(singleSave).not.toBeNull();

    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    expect(await getRawStorage(page, SINGLE_SESSION_KEY)).toBe(singleSave);
    await page.locator('[data-testid="star-line-cell-3"]').click();
    await exitGame(page, 'save');
    const doubleSave = await getRawStorage(page, DOUBLE_SESSION_KEY);
    expect(doubleSave).not.toBeNull();
    expect(await getRawStorage(page, SINGLE_SESSION_KEY)).toBe(singleSave);

    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });
    await expect(page.locator('[data-testid="star-line-star-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="star-line-star-3"]')).not.toBeVisible();

    await page.locator(S.game.backButton).click();
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    await expect(page.locator('[data-testid="star-line-star-3"]')).toBeVisible();
    expect(await getRawStorage(page, DOUBLE_SESSION_KEY)).toBe(doubleSave);
  });

  test('清理双星中断局不会删除单星中断局', async ({ page }) => {
    await prepareStarLine(page);
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });
    await page.locator('[data-testid="star-line-cell-1"]').click();
    await exitGame(page, 'save');
    const singleSave = await getRawStorage(page, SINGLE_SESSION_KEY);

    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    await page.locator('[data-testid="star-line-cell-3"]').click();
    await exitGame(page, 'abandon');
    expect(await getRawStorage(page, DOUBLE_SESSION_KEY)).toBeNull();
    expect(await getRawStorage(page, SINGLE_SESSION_KEY)).toBe(singleSave);
  });

  test('清理单星中断局不会删除双星中断局', async ({ page }) => {
    await prepareStarLine(page);
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    await page.locator('[data-testid="star-line-cell-3"]').click();
    await exitGame(page, 'save');
    const doubleSave = await getRawStorage(page, DOUBLE_SESSION_KEY);

    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });
    await page.locator('[data-testid="star-line-cell-1"]').click();
    await exitGame(page, 'abandon');
    expect(await getRawStorage(page, SINGLE_SESSION_KEY)).toBeNull();
    expect(await getRawStorage(page, DOUBLE_SESSION_KEY)).toBe(doubleSave);
  });

  test('可识别的旧共享中断局只复制到正确的新 key，原 key 不变', async ({ page }) => {
    const legacyRaw = JSON.stringify({
      mode: 'starLine',
      levelId: 'star-lv-21',
      diff: 'easy',
      gridData: [{ regionId: 0 }],
      path: [0],
      hp: 5,
      savedAt: 1,
    });
    await prepareStarLine(page, { [LEGACY_SESSION_KEY]: legacyRaw });
    await page.reload();

    expect(await getRawStorage(page, LEGACY_SESSION_KEY)).toBe(legacyRaw);
    await expect.poll(() => getStorage(page, DOUBLE_SESSION_KEY)).toMatchObject({
      playMode: 'starDouble', levelIdx: 0, levelId: 'star-lv-21',
    });
    expect(await getRawStorage(page, SINGLE_SESSION_KEY)).toBeNull();
  });

  test('归属不明确的旧共享中断局保持原样且不迁移', async ({ page }) => {
    const legacyRaw = JSON.stringify({ playMode: 'starLine', levelIdx: 1.5 });
    await prepareStarLine(page, { [LEGACY_SESSION_KEY]: legacyRaw });
    await page.reload();

    expect(await getRawStorage(page, LEGACY_SESSION_KEY)).toBe(legacyRaw);
    expect(await getRawStorage(page, SINGLE_SESSION_KEY)).toBeNull();
    expect(await getRawStorage(page, DOUBLE_SESSION_KEY)).toBeNull();
  });

  test('玩法 tab 切换后从目标玩法的第 1 关进入，不复用旧 levelIdx', async ({ page }) => {
    await prepareStarLine(page);
    await goToStarLineLevels(page);
    await page.locator(S.puzzleBook.levelTile('easy-9')).click();
    await expect(page.locator(S.game.modeLabel)).toContainText(/第\s*10\s*关/);
    await page.locator('[data-testid="star-line-cell-1"]').click();
    await expect(page.locator('[data-testid="star-line-undo-button"]')).toBeEnabled();
    await exitGame(page, 'abandon');

    await page.locator(S.modeSwitcher.modeCard('starDouble')).click();
    await expect(page.locator(S.modeSwitcher.modeCard('starDouble'))).toHaveAttribute('aria-pressed', 'true');
    await page.locator(S.puzzleBook.levelTile('easy-0')).click();
    await expect(page.locator(S.game.modeLabel)).toContainText(/第\s*1\s*关/);
    await expect(page.locator('[data-testid="star-line-undo-button"]')).toBeDisabled();

    await page.locator('[data-testid="star-line-cell-3"]').click();
    await expect(page.locator('[data-testid="star-line-undo-button"]')).toBeEnabled();
    await exitGame(page, 'abandon');
    await page.locator(S.modeSwitcher.modeCard('starSingle')).click();
    await expect(page.locator(S.modeSwitcher.modeCard('starSingle'))).toHaveAttribute('aria-pressed', 'true');
    await page.locator(S.puzzleBook.levelTile('easy-0')).click();
    await expect(page.locator(S.game.modeLabel)).toContainText(/第\s*1\s*关/);
    await expect(page.locator('[data-testid="star-line-undo-button"]')).toBeDisabled();
  });
});
