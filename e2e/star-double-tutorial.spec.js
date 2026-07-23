import { test, expect } from '@playwright/test';
import { clearAllGameData } from './helpers/game-state.js';
import { exitGame, goToLevel, openSettings } from './helpers/navigation.js';

const SINGLE_GUIDANCE_KEY = 'cg_star_line_guidance_v1';
const DOUBLE_GUIDANCE_KEY = 'cg_star_line_double_guidance_v1';
const DOUBLE_NEIGHBORS = [4, 5, 6, 12, 14, 20, 21, 22];

function cell(page, idx) {
  return page.locator(`[data-testid="star-line-cell-${idx}"]`);
}

async function cellCenter(page, idx) {
  const box = await cell(page, idx).boundingBox();
  if (!box) throw new Error(`Cell ${idx} not visible`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function dragAcross(page, indexes) {
  const start = await cellCenter(page, indexes[0]);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (const idx of indexes.slice(1)) {
    const point = await cellCenter(page, idx);
    await page.mouse.move(point.x, point.y, { steps: 4 });
  }
  await page.mouse.up();
}

async function expectDoubleStep(page, step, copy) {
  const board = page.locator('[data-testid="star-line-board"]');
  await expect(board).toHaveAttribute('data-guide-kind', 'double-rule');
  await expect(board).toHaveAttribute('data-guide-step', String(step), { timeout: 5000 });
  if (copy) await expect(page.locator('[data-testid="star-line-guide-copy"]')).toContainText(copy);
}

async function markForcedStarNeighbors(page) {
  await dragAcross(page, [4, 5, 6]);
  await cell(page, 12).click();
  await expect(page.locator('[data-testid="star-line-x-12"]')).toBeVisible();
  await cell(page, 14).click();
  await expect(page.locator('[data-testid="star-line-x-14"]')).toBeVisible();
  await dragAcross(page, [20, 21, 22]);
}

async function setCompletedGuides(page) {
  await page.evaluate(({ singleKey, doubleKey }) => {
    localStorage.setItem(singleKey, JSON.stringify({
      version: 1,
      operation: { completed: true, step: 4 },
      rules: { completed: true, step: 10 },
      replayRequested: false,
    }));
    localStorage.setItem(doubleKey, JSON.stringify({
      version: 1,
      completed: true,
      step: 3,
      replayRequested: false,
    }));
  }, { singleKey: SINGLE_GUIDANCE_KEY, doubleKey: DOUBLE_GUIDANCE_KEY });
}

test.describe('Star Double 第一关独立教学', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
  });

  test('D1. 玩家完成真实双星容量链，错误操作受限，结束后可继续解题且不再强制播放', { tag: '@critical' }, async ({ page }) => {
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });

    await expectDoubleStep(page, 1, '右侧 2×2 最多放 1 颗');
    for (const idx of [6, 7, 13, 14, 15]) {
      await expect(cell(page, idx)).toHaveClass(/is-guide-target/);
    }

    await expectDoubleStep(page, 2, '先单击或拖动周围八格');
    await cell(page, 0).dblclick();
    await expect(cell(page, 0)).toHaveAttribute('data-cell-state', 'empty');

    await markForcedStarNeighbors(page);
    for (const idx of DOUBLE_NEIGHBORS) {
      await expect(page.locator(`[data-testid="star-line-x-${idx}"]`)).toBeVisible();
    }

    await expectDoubleStep(page, 3, '放下这颗有依据的星');
    await cell(page, 13).dblclick();
    await expect(page.locator('[data-testid="star-line-star-13"]')).toBeVisible();
    await expect(page.locator('[data-testid="star-line-board"]')).toHaveAttribute('data-guide-kind', 'none');
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), DOUBLE_GUIDANCE_KEY)).toMatchObject({
      completed: true,
      step: 3,
      replayRequested: false,
    });

    // 教学只带出第一颗确定星；之后立刻回到正常解题。
    await cell(page, 15).dblclick();
    await expect(page.locator('[data-testid="star-line-star-15"]')).toBeVisible();
    await exitGame(page, 'abandon');

    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    await expect(page.locator('[data-testid="star-line-board"]')).toHaveAttribute('data-guide-kind', 'none');

    // 双星完成记录不替代单星教学记录。
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });
    await expect(page.locator('[data-testid="star-line-board"]')).toHaveAttribute('data-guide-kind', 'operation');
  });

  test('D2. 中途保存后按棋盘状态恢复，完成记录与正式进度分离', async ({ page }) => {
    const progress = {
      version: 1,
      games: {
        starSingle: { completed: {}, unlockedThroughId: 'star-lv-01' },
        starDouble: { completed: {}, unlockedThroughId: 'star-lv-21' },
      },
    };
    await page.evaluate(value => {
      localStorage.setItem('cg_star_line_progress_v2', JSON.stringify(value));
    }, progress);

    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    await expectDoubleStep(page, 2);
    await dragAcross(page, [4, 5, 6]);
    await exitGame(page, 'save');

    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    await expectDoubleStep(page, 2);
    for (const idx of [4, 5, 6]) {
      await expect(page.locator(`[data-testid="star-line-x-${idx}"]`)).toBeVisible();
    }
    await cell(page, 12).click();
    await expect(page.locator('[data-testid="star-line-x-12"]')).toBeVisible();
    await cell(page, 14).click();
    await expect(page.locator('[data-testid="star-line-x-14"]')).toBeVisible();
    await dragAcross(page, [20, 21, 22]);
    await expectDoubleStep(page, 3);
    await cell(page, 13).dblclick();

    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cg_star_line_progress_v2')))).toEqual(progress);
  });

  test('D3. 设置可单独重播双星教学，不改单星教学或正式进度', async ({ page }) => {
    const progress = {
      version: 1,
      games: {
        starSingle: { completed: { 'star-lv-01': 3 }, unlockedThroughId: 'star-lv-02' },
        starDouble: { completed: {}, unlockedThroughId: 'star-lv-21' },
      },
    };
    await page.evaluate(value => {
      localStorage.setItem('cg_star_line_progress_v2', JSON.stringify(value));
    }, progress);
    await setCompletedGuides(page);
    const singleBefore = await page.evaluate(key => localStorage.getItem(key), SINGLE_GUIDANCE_KEY);

    await openSettings(page);
    const replay = page.locator('[data-testid="star-line-double-guide-replay-button"]');
    await expect(replay).toBeEnabled();
    await replay.click();
    await expect(replay).toHaveText('已开启');
    expect(await page.evaluate(key => localStorage.getItem(key), SINGLE_GUIDANCE_KEY)).toBe(singleBefore);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cg_star_line_progress_v2')))).toEqual(progress);

    await page.locator('[data-testid="settings-close-button"]').click();
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    await expectDoubleStep(page, 1);
  });

});
