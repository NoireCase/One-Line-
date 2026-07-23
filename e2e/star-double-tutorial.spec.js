import { test, expect } from '@playwright/test';
import { clearAllGameData } from './helpers/game-state.js';
import { exitGame, goToLevel, openSettings } from './helpers/navigation.js';

const SINGLE_GUIDANCE_KEY = 'cg_star_line_guidance_v1';
const DOUBLE_GUIDANCE_KEY = 'cg_star_line_double_guidance_v1';
const OPENING_REGION = [6, 7, 13, 14, 15];
const DOUBLE_NEIGHBORS = [4, 5, 6, 12, 14, 20, 21, 22];
const PRACTICE_SCOPE = [0, 1, 2, 3, 8, 9, 10, 11];
const REMAINING_STARS = [1, 3, 15, 17, 19, 29, 31, 32, 34, 44, 46, 48, 50, 60, 62];
const FINAL_STEP = 5;

function cell(page, idx) {
  return page.locator(`[data-testid="star-line-cell-${idx}"]`);
}

async function expectDoubleStep(page, step, copy) {
  const board = page.locator('[data-testid="star-line-board"]');
  await expect(board).toHaveAttribute('data-guide-kind', 'double-rule');
  await expect(board).toHaveAttribute('data-guide-step', String(step), { timeout: 5000 });
  if (copy) await expect(page.locator('[data-testid="star-line-guide-copy"]')).toContainText(copy);
}

async function markCellsX(page, indexes) {
  for (const idx of indexes) {
    await cell(page, idx).click();
    await expect(cell(page, idx)).toHaveAttribute('data-cell-state', 'marked-x');
  }
}

async function setCompletedGuides(page) {
  await page.evaluate(({ singleKey, doubleKey, finalStep }) => {
    localStorage.setItem(singleKey, JSON.stringify({
      version: 1,
      operation: { completed: true, step: 4 },
      rules: { completed: true, step: 10 },
      replayRequested: false,
    }));
    localStorage.setItem(doubleKey, JSON.stringify({
      version: 3,
      completed: true,
      step: finalStep,
      replayRequested: false,
    }));
  }, { singleKey: SINGLE_GUIDANCE_KEY, doubleKey: DOUBLE_GUIDANCE_KEY, finalStep: FINAL_STEP });
}

async function expectGuideLayout(page, viewport) {
  await page.setViewportSize(viewport);
  const topbar = await page.locator('.game-topbar--starline').boundingBox();
  const card = await page.locator('[data-testid="star-line-double-guide-card"]').boundingBox();
  const board = await page.locator('[data-testid="star-line-board-container"]').boundingBox();
  const feedback = await page.locator('[data-testid="star-line-feedback"]').boundingBox();
  if (!topbar || !card || !board || !feedback) throw new Error('教学布局元素不可见');
  expect(topbar.y + topbar.height).toBeLessThanOrEqual(card.y);
  expect(card.y + card.height).toBeLessThanOrEqual(board.y);
  expect(board.y + board.height).toBeLessThanOrEqual(feedback.y);
  expect(feedback.y + feedback.height).toBeLessThanOrEqual(viewport.height);
}

test.describe('Star Double 第一关思考式教学', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
  });

  test('D1. 演示一次、玩家练习、自主解题与三级提示走到真实胜利', { tag: '@critical' }, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });

    await expectDoubleStep(page, 1, '右侧 2×2 最多只能放 1 颗星');
    for (const idx of OPENING_REGION) {
      await expect(cell(page, idx)).toHaveClass(/is-guide-observation/);
    }
    await expect(page.locator('.starline-cell.is-guide-action')).toHaveCount(0);

    await page.waitForTimeout(3400);
    await expectDoubleStep(page, 1);
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), DOUBLE_GUIDANCE_KEY))
      .toMatchObject({ version: 3, completed: false, step: 1 });

    const guideButton = page.locator('[data-testid="star-line-double-guide-action"]');
    await expect(guideButton).toHaveText('开始判断');
    await guideButton.click();
    await expectDoubleStep(page, 2, '自己找出');

    // 提问只显示观察范围，不高亮或播放答案格。
    await expect(page.locator('.starline-cell.is-guide-action')).toHaveCount(0);
    await expect(page.locator('.starline-guide-pointer')).toHaveCount(0);
    await cell(page, 7).dblclick();
    await expect(cell(page, 7)).toHaveAttribute('data-cell-state', 'empty');
    await cell(page, 13).dblclick();
    await expect(cell(page, 13)).toHaveAttribute('data-cell-state', 'starred');

    await expectDoubleStep(page, 3, '周围全部八格');
    await expect(page.locator('.starline-guide-pointer')).toHaveCount(8);
    for (const idx of DOUBLE_NEIGHBORS) {
      await expect(cell(page, idx)).toHaveClass(/is-guide-action/);
      await expect(page.locator(`[data-testid="star-line-guide-pointer-${idx}"]`)).toBeVisible();
    }
    await markCellsX(page, DOUBLE_NEIGHBORS);

    // 第二次练习仍只给范围，不显示答案。
    await expectDoubleStep(page, 4, '自己找出');
    for (const idx of PRACTICE_SCOPE) {
      await expect(cell(page, idx)).toHaveClass(/is-guide-observation/);
    }
    await expect(page.locator('.starline-cell.is-guide-action')).toHaveCount(0);
    await expect(page.locator('.starline-guide-pointer')).toHaveCount(0);
    await cell(page, 8).click();
    await expect(cell(page, 8)).toHaveAttribute('data-cell-state', 'empty');
    await cell(page, 9).click();
    await expect(cell(page, 9)).toHaveAttribute('data-cell-state', 'marked-x');

    await expectDoubleStep(page, 5, '现在由你完成整关');
    const xCountBeforeHints = await page.locator('.starline-cell.is-marked-x').count();
    const starCountBeforeHints = await page.locator('.starline-cell.is-starred').count();

    await expect(guideButton).toHaveText('提示 1/3');
    await guideButton.click();
    await expect(page.locator('[data-testid="star-line-double-guide-card"]')).toHaveAttribute('data-hint-level', '1');
    await expect(page.locator('.starline-cell.is-guide-observation')).not.toHaveCount(0);
    await expect(page.locator('.starline-cell.is-guide-action')).toHaveCount(0);

    await expect(guideButton).toHaveText('提示 2/3');
    await guideButton.click();
    await expect(page.locator('[data-testid="star-line-double-guide-card"]')).toHaveAttribute('data-hint-level', '2');
    await expect(page.locator('.starline-cell.is-guide-evidence')).not.toHaveCount(0);
    await expect(page.locator('.starline-cell.is-guide-action')).toHaveCount(0);

    await expect(guideButton).toHaveText('提示 3/3');
    await guideButton.click();
    await expect(page.locator('[data-testid="star-line-double-guide-card"]')).toHaveAttribute('data-hint-level', '3');
    await expect(page.locator('.starline-cell.is-guide-action')).not.toHaveCount(0);
    expect(await page.locator('.starline-cell.is-marked-x').count()).toBe(xCountBeforeHints);
    expect(await page.locator('.starline-cell.is-starred').count()).toBe(starCountBeforeHints);

    // 自主阶段不限制普通输入，也不会自动画 X 或放星。
    for (const idx of REMAINING_STARS.slice(0, -1)) {
      await cell(page, idx).dblclick();
      await expect(cell(page, idx)).toHaveAttribute('data-cell-state', 'starred');
    }
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), DOUBLE_GUIDANCE_KEY))
      .toMatchObject({ completed: false, step: 5 });

    await cell(page, REMAINING_STARS.at(-1)).dblclick();
    await expect(page.locator('[data-testid="win-panel"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="win-title"]')).toContainText('星线完成');
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), DOUBLE_GUIDANCE_KEY))
      .toMatchObject({ version: 3, completed: true, step: 5, replayRequested: false });
  });

  test('D2. 提示卡在两种桌面尺寸均不遮挡 HUD、棋盘或状态栏', async ({ page }) => {
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    await expectGuideLayout(page, { width: 1280, height: 720 });
    await expectGuideLayout(page, { width: 1440, height: 900 });
  });

  test('D3. 中途保存后恢复当前练习，胜利前不写完成记录', async ({ page }) => {
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    await page.locator('[data-testid="star-line-double-guide-action"]').click();
    await cell(page, 13).dblclick();
    await expectDoubleStep(page, 3);
    await markCellsX(page, [4, 5, 6]);
    await exitGame(page, 'save');

    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    await expectDoubleStep(page, 3);
    for (const idx of [4, 5, 6]) {
      await expect(cell(page, idx)).toHaveAttribute('data-cell-state', 'marked-x');
    }
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), DOUBLE_GUIDANCE_KEY))
      .toMatchObject({ completed: false, step: 3 });
  });

  test('D4. 设置可单独重播双星教学，单星记录与正式进度不受影响', async ({ page }) => {
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
