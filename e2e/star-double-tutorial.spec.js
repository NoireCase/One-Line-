import { test, expect } from '@playwright/test';
import { clearAllGameData } from './helpers/game-state.js';
import { exitGame, goToLevel, openSettings } from './helpers/navigation.js';

const SINGLE_GUIDANCE_KEY = 'cg_star_line_guidance_v1';
const DOUBLE_GUIDANCE_KEY = 'cg_star_line_double_guidance_v1';
const OPENING_REGION = [6, 7, 13, 14, 15];
const DOUBLE_NEIGHBORS = [4, 5, 6, 12, 14, 20, 21, 22];
const PRACTICE_SCOPE = [0, 1, 2, 3, 8, 9, 10, 11];
const REMAINING_STARS = [1, 3, 15, 17, 19, 29, 31, 32, 34, 44, 46, 48, 50, 60, 62];

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

async function enterAutonomousTutorial(page) {
  await page.locator('[data-testid="star-line-double-guide-action"]').click();
  await page.locator('[data-testid="star-line-double-guide-action"]').click();
  await cell(page, 13).dblclick();
  await markCellsX(page, DOUBLE_NEIGHBORS);
  await cell(page, 9).click();
  await expect(cell(page, 9)).toHaveAttribute('data-cell-state', 'marked-x');
  await expectDoubleStep(page, 6);
}

async function unlockDelayedHint(page) {
  const button = page.locator('[data-testid="star-line-double-guide-action"]');
  if (await button.isDisabled()) {
    await page.clock.runFor(10000);
  }
  await expect(button).toHaveText('查看提示');
  await expect(button).toBeEnabled();
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
      version: 5,
      completedLessons: { 'star-double-tutorial-01': true },
      replayLevelId: null,
    }));
  }, { singleKey: SINGLE_GUIDANCE_KEY, doubleKey: DOUBLE_GUIDANCE_KEY });
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
    await page.clock.install();
    await page.setViewportSize({ width: 1280, height: 720 });
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });

    await expectDoubleStep(page, 1, '每行、每列、每个星域都要放 2 颗星');
    await expect(page.locator('.starline-cell.is-guide-observation')).toHaveCount(0);
    await expect(page.locator('.starline-cell.is-guide-action')).toHaveCount(0);

    await page.waitForTimeout(3400);
    await expectDoubleStep(page, 1);
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), DOUBLE_GUIDANCE_KEY))
      .toMatchObject({ version: 5, completedLessons: {} });

    const guideButton = page.locator('[data-testid="star-line-double-guide-action"]');
    await expect(guideButton).toHaveText('继续');
    await guideButton.click();
    await expectDoubleStep(page, 2, '任意 2×2 内最多只能放 1 颗星');
    for (const idx of [6, 7, 14, 15]) {
      await expect(cell(page, idx)).toHaveClass(/is-guide-observation/);
    }
    await expect(cell(page, 13)).not.toHaveClass(/is-guide-observation/);
    await expect(page.locator('.starline-cell.is-guide-action')).toHaveCount(0);

    await expect(guideButton).toHaveText('开始判断');
    await guideButton.click();
    await expectDoubleStep(page, 3, '另一颗应该在哪里');

    // 提问只显示观察范围，不高亮或播放答案格。
    for (const idx of OPENING_REGION) {
      await expect(cell(page, idx)).toHaveClass(/is-guide-observation/);
    }
    await expect(page.locator('.starline-cell.is-guide-action')).toHaveCount(0);
    await expect(page.locator('.starline-guide-pointer')).toHaveCount(0);
    await cell(page, 7).dblclick();
    await expect(cell(page, 7)).toHaveAttribute('data-cell-state', 'empty');
    await cell(page, 13).dblclick();
    await expect(cell(page, 13)).toHaveAttribute('data-cell-state', 'starred');

    await expectDoubleStep(page, 4, '周围全部八格');
    await expect(page.locator('.starline-guide-pointer')).toHaveCount(8);
    for (const idx of DOUBLE_NEIGHBORS) {
      await expect(cell(page, idx)).toHaveClass(/is-guide-action/);
      await expect(page.locator(`[data-testid="star-line-guide-pointer-${idx}"]`)).toBeVisible();
    }
    await markCellsX(page, DOUBLE_NEIGHBORS);

    // 第二次练习仍只给范围，不显示答案。
    await expectDoubleStep(page, 5, '自己找出');
    for (const idx of PRACTICE_SCOPE) {
      await expect(cell(page, idx)).toHaveClass(/is-guide-observation/);
    }
    await expect(page.locator('.starline-cell.is-guide-action')).toHaveCount(0);
    await expect(page.locator('.starline-guide-pointer')).toHaveCount(0);
    await cell(page, 8).click();
    await expect(cell(page, 8)).toHaveAttribute('data-cell-state', 'empty');
    await cell(page, 9).click();
    await expect(cell(page, 9)).toHaveAttribute('data-cell-state', 'marked-x');

    await expectDoubleStep(page, 6, '先自己观察，10 秒后可查看提示');
    const xCountBeforeHints = await page.locator('.starline-cell.is-marked-x').count();
    const starCountBeforeHints = await page.locator('.starline-cell.is-starred').count();

    await expect(guideButton).toHaveText('10 秒后解锁');
    await unlockDelayedHint(page);
    await guideButton.click();
    await expect(page.locator('[data-testid="star-line-double-guide-card"]')).toHaveAttribute('data-hint-level', '1');
    await expect(page.locator('.starline-cell.is-guide-observation')).not.toHaveCount(0);
    await expect(page.locator('.starline-cell.is-guide-action')).toHaveCount(0);

    await expect(guideButton).toHaveText('查看提示');
    await guideButton.click();
    await expect(page.locator('[data-testid="star-line-double-guide-card"]')).toHaveAttribute('data-hint-level', '2');
    await expect(page.locator('.starline-cell.is-guide-evidence')).not.toHaveCount(0);
    await expect(page.locator('.starline-cell.is-guide-action')).toHaveCount(0);

    await expect(guideButton).toHaveText('查看提示');
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
      .toMatchObject({ version: 5, completedLessons: {} });

    await cell(page, REMAINING_STARS.at(-1)).dblclick();
    await expect(page.locator('[data-testid="win-panel"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="win-title"]')).toContainText('星线完成');
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), DOUBLE_GUIDANCE_KEY))
      .toMatchObject({ version: 5, replayLevelId: null });
    // Verify Lv.1 is marked complete
    const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), DOUBLE_GUIDANCE_KEY);
    expect(stored.completedLessons['star-double-tutorial-01']).toBe(true);
  });

  test('D1.1 自主判断提示按真实时间解锁，换步重置且正确操作立即取消', async ({ page }) => {
    await page.clock.install();
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    const button = page.locator('[data-testid="star-line-double-guide-action"]');
    const mask = page.locator('[data-testid="star-line-double-guide-countdown-mask"]');

    await button.click();
    await button.click();
    await expectDoubleStep(page, 3);
    await expect(button).toHaveText('10 秒后解锁');
    await expect(button).toBeDisabled();
    await expect(mask).toHaveCSS('height', /.+/);
    const lockedSize = await button.boundingBox();

    await page.clock.runFor(4100);
    await expect(button).toHaveText('6 秒后解锁');
    const partialMaskHeight = await mask.evaluate(element => parseFloat(element.style.height));
    expect(partialMaskHeight).toBeGreaterThan(50);
    expect(partialMaskHeight).toBeLessThan(70);

    // 重置棋盘后，同一步也从完整 10 秒重新开始。
    await page.locator('[data-testid="restart-button"]').click();
    const restartConfirmation = page.locator('[data-testid="restart-confirmation"]');
    if (await restartConfirmation.isVisible()) {
      await page.locator('[data-testid="restart-button"]').click();
    }
    await expectDoubleStep(page, 3);
    await expect(button).toHaveText('10 秒后解锁');
    await expect(mask).toHaveAttribute('style', /height: 100%/);

    // 正确操作会切换步骤并立即卸载当前倒计时。
    await cell(page, 13).dblclick();
    await expectDoubleStep(page, 4);
    await expect(button).toHaveCount(0);
    await page.clock.runFor(7000);
    await expect(button).toHaveCount(0);

    await markCellsX(page, DOUBLE_NEIGHBORS);
    await expectDoubleStep(page, 5);
    await expect(button).toHaveText('10 秒后解锁');
    await expect(button).toBeDisabled();
    await expect(mask).toHaveAttribute('style', /height: 100%/);

    await unlockDelayedHint(page);
    const unlockedSize = await button.boundingBox();
    expect(unlockedSize?.width).toBe(lockedSize?.width);
    expect(unlockedSize?.height).toBe(lockedSize?.height);
    await expect(mask).toHaveCount(0);

    const xCountBeforeHint = await page.locator('.starline-cell.is-marked-x').count();
    await button.click();
    await expect(page.locator('[data-testid="star-line-guide-copy"]'))
      .toContainText('每组最多容纳 1 颗星，因此有一格会同时受到挤压');
    for (const idx of PRACTICE_SCOPE) {
      await expect(cell(page, idx)).toHaveClass(/is-guide-evidence/);
    }
    await expect(page.locator('.starline-cell.is-guide-action')).toHaveCount(0);
    expect(await page.locator('.starline-cell.is-marked-x').count()).toBe(xCountBeforeHint);
    await expect(button).toHaveText('已查看提示');
    await expect(button).toBeDisabled();
  });

  test('D1.2 reduced-motion 保留数字倒计时但不播放遮罩下降', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.install();
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    const button = page.locator('[data-testid="star-line-double-guide-action"]');
    const mask = page.locator('[data-testid="star-line-double-guide-countdown-mask"]');

    await button.click();
    await button.click();
    await expectDoubleStep(page, 3);
    await page.clock.runFor(4100);
    await expect(button).toHaveText('6 秒后解锁');
    await expect(mask).toHaveAttribute('style', /height: 100%/);
    await page.clock.runFor(5900);
    await expect(button).toHaveText('查看提示');
    await expect(button).toBeEnabled();
    await expect(mask).toHaveCount(0);
  });

  test('D1.3 连续操作棋盘不会重置自主解题倒计时，解锁后保持可用', async ({ page }) => {
    await page.clock.install();
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    await enterAutonomousTutorial(page);
    const button = page.locator('[data-testid="star-line-double-guide-action"]');
    const copy = page.locator('[data-testid="star-line-guide-copy"]');
    const card = page.locator('[data-testid="star-line-double-guide-card"]');
    const deductionId = await card.getAttribute('data-deduction-id');
    const deductionBoardHash = await card.getAttribute('data-deduction-board-hash');
    const deductionTargets = new Set(
      (await card.getAttribute('data-deduction-targets'))
        .split(',')
        .filter(Boolean)
        .map(Number),
    );
    const unrelatedOperations = [
      { idx: 0, action: 'x' },
      { idx: 1, action: 'star' },
      { idx: 2, action: 'x' },
      { idx: 3, action: 'star' },
      { idx: 7, action: 'x' },
      { idx: 8, action: 'x' },
      { idx: 10, action: 'x' },
      { idx: 11, action: 'x' },
    ].filter(operation => !deductionTargets.has(operation.idx)).slice(0, 3);
    expect(unrelatedOperations).toHaveLength(3);

    const performUnrelatedOperation = async (operation) => {
      if (operation.action === 'star') await cell(page, operation.idx).dblclick();
      else await cell(page, operation.idx).click();
      await expect(cell(page, operation.idx)).toHaveAttribute(
        'data-cell-state',
        operation.action === 'star' ? 'starred' : 'marked-x',
      );
      await expect(card).toHaveAttribute('data-deduction-id', deductionId);
      await expect(card).toHaveAttribute('data-deduction-board-hash', deductionBoardHash);
    };

    await expect(button).toHaveText('10 秒后解锁');
    await expect(copy).toContainText('先自己观察，10 秒后可查看提示');
    await page.clock.runFor(3000);
    await expect(button).toHaveText('7 秒后解锁');

    await performUnrelatedOperation(unrelatedOperations[0]);
    await expect(button).toHaveText('7 秒后解锁');
    await expect(copy).toContainText('先自己观察，7 秒后可查看提示');

    await page.clock.runFor(2000);
    await expect(button).toHaveText('5 秒后解锁');
    await performUnrelatedOperation(unrelatedOperations[1]);
    await expect(button).toHaveText('5 秒后解锁');

    await page.clock.runFor(4000);
    await expect(button).toHaveText('1 秒后解锁');
    await performUnrelatedOperation(unrelatedOperations[2]);
    await expect(button).toHaveText('1 秒后解锁');

    await page.clock.runFor(1000);
    await expect(button).toHaveText('查看提示');
    await expect(button).toBeEnabled();
    await expect(copy).toContainText('提示已解锁');

    const postUnlockOperation = [
      { idx: 15, action: 'star' },
      { idx: 16, action: 'x' },
      { idx: 18, action: 'x' },
    ].find(operation => !deductionTargets.has(operation.idx));
    await performUnrelatedOperation(postUnlockOperation);
    await expect(button).toHaveText('查看提示');
    await expect(button).toBeEnabled();
  });

  test('D1.4 同一 deduction 只等待一次，完成后文案、高亮与倒计时同步换新', async ({ page }) => {
    await page.clock.install();
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    await enterAutonomousTutorial(page);
    const card = page.locator('[data-testid="star-line-double-guide-card"]');
    const button = page.locator('[data-testid="star-line-double-guide-action"]');
    const copy = page.locator('[data-testid="star-line-guide-copy"]');
    const oldDeductionId = await card.getAttribute('data-deduction-id');
    const oldBoardHash = await card.getAttribute('data-deduction-board-hash');

    await unlockDelayedHint(page);
    await button.click();
    await expect(card).toHaveAttribute('data-hint-level', '1');
    const oldHintText = await copy.textContent();
    await expect(button).toHaveText('查看提示');
    await button.click();
    await expect(card).toHaveAttribute('data-hint-level', '2');
    await expect(button).toHaveText('查看提示');
    await button.click();
    await expect(card).toHaveAttribute('data-hint-level', '3');

    const action = await card.getAttribute('data-deduction-action');
    const targets = (await card.getAttribute('data-deduction-targets'))
      .split(',')
      .filter(Boolean)
      .map(Number);
    expect(targets.length).toBeGreaterThan(0);
    for (const idx of targets) {
      if (action === 'place-stars') await cell(page, idx).dblclick();
      else await cell(page, idx).click();
    }

    await expect(card).not.toHaveAttribute('data-deduction-id', oldDeductionId);
    await expect(card).not.toHaveAttribute('data-deduction-board-hash', oldBoardHash);
    await expect(card).toHaveAttribute('data-hint-level', '0');
    await expect(copy).toContainText('先自己观察，10 秒后可查看提示');
    await expect(copy).not.toHaveText(oldHintText);
    await expect(page.locator('.starline-cell.is-guide-observation')).toHaveCount(0);
    await expect(page.locator('.starline-cell.is-guide-evidence')).toHaveCount(0);
    await expect(page.locator('.starline-cell.is-guide-action')).toHaveCount(0);
    await expect(button).toHaveText('10 秒后解锁');
    await expect(button).toBeDisabled();
  });

  test('D2. 提示卡在两种桌面尺寸均不遮挡 HUD、棋盘或状态栏', async ({ page }) => {
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    await expectGuideLayout(page, { width: 1280, height: 720 });
    await expectGuideLayout(page, { width: 1440, height: 900 });
  });

  test('D2.1 填满但未胜利时进入三级纠错，不再显示暂无提示', async ({ page }) => {
    await page.clock.install();
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    await enterAutonomousTutorial(page);

    for (let idx = 0; idx < 64; idx += 1) {
      if (await cell(page, idx).getAttribute('data-cell-state') === 'empty') {
        await cell(page, idx).click();
      }
    }
    await expect(page.locator('.starline-cell.is-empty')).toHaveCount(0);
    await expect(page.locator('[data-testid="win-panel"]')).toHaveCount(0);

    const card = page.locator('[data-testid="star-line-double-guide-card"]');
    const hintButton = page.locator('[data-testid="star-line-double-guide-action"]');
    await expect(card).toHaveAttribute('data-hint-mode', 'correction');
    await expect(hintButton).toHaveText('查看提示');
    await expect(hintButton).not.toHaveText('暂无提示');

    await expect(hintButton).toHaveText('查看提示');
    await hintButton.click();
    await expect(card).toHaveAttribute('data-hint-level', '1');
    await expect(page.locator('[data-testid="star-line-guide-copy"]')).toContainText('至少有一处标记错误');
    await expect(page.locator('.starline-cell.is-guide-observation')).toHaveCount(0);
    await expect(page.locator('.starline-cell.is-guide-action')).toHaveCount(0);

    await expect(hintButton).toHaveText('查看提示');
    await hintButton.click();
    await expect(card).toHaveAttribute('data-hint-level', '2');
    await expect(page.locator('[data-testid="star-line-guide-copy"]')).toContainText('行、列和星域');
    await expect(page.locator('.starline-cell.is-guide-observation')).not.toHaveCount(0);
    await expect(page.locator('.starline-cell.is-guide-action')).toHaveCount(0);

    await expect(hintButton).toHaveText('查看提示');
    await hintButton.click();
    await expect(card).toHaveAttribute('data-hint-level', '3');
    await expect(page.locator('[data-testid="star-line-guide-copy"]')).toContainText('撤销高亮格');
    await expect(page.locator('.starline-cell.is-guide-action')).toHaveCount(1);
    await expect(cell(page, 1)).toHaveClass(/is-guide-action/);
    await expect(cell(page, 1)).toHaveAttribute('data-cell-state', 'marked-x');

    const previousDeductionId = await card.getAttribute('data-deduction-id');
    const previousBoardHash = await card.getAttribute('data-deduction-board-hash');
    await cell(page, 1).click();
    await expect(cell(page, 1)).toHaveAttribute('data-cell-state', 'empty');
    await expect(card).not.toHaveAttribute('data-deduction-id', previousDeductionId);
    await expect(card).not.toHaveAttribute('data-deduction-board-hash', previousBoardHash);
    await expect(card).toHaveAttribute('data-hint-level', '0');
    await expect(card).toHaveAttribute('data-hint-mode', 'correction');
    await expect(page.locator('[data-testid="star-line-guide-copy"]'))
      .toContainText('先自己观察，10 秒后可查看提示');
    await expect(page.locator('[data-testid="star-line-guide-copy"]')).not.toContainText('撤销高亮格');
    await expect(page.locator('.starline-cell.is-guide-observation')).toHaveCount(0);
    await expect(page.locator('.starline-cell.is-guide-evidence')).toHaveCount(0);
    await expect(page.locator('.starline-cell.is-guide-action')).toHaveCount(0);
    await expect(hintButton).toHaveText('10 秒后解锁');
    await expect(hintButton).toBeDisabled();
  });

  test('D3. 中途保存后棋盘恢复，教学从开头重新开始', async ({ page }) => {
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    await page.locator('[data-testid="star-line-double-guide-action"]').click();
    await page.locator('[data-testid="star-line-double-guide-action"]').click();
    await cell(page, 13).dblclick();
    await expectDoubleStep(page, 4);
    await markCellsX(page, [4, 5, 6]);
    await exitGame(page, 'save');

    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    // Board marks are preserved
    await expect(cell(page, 13)).toHaveAttribute('data-cell-state', 'starred');
    for (const idx of [4, 5, 6]) {
      await expect(cell(page, idx)).toHaveAttribute('data-cell-state', 'marked-x');
    }
    // Teaching restarts from step 1 (session state)
    await expectDoubleStep(page, 1);
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), DOUBLE_GUIDANCE_KEY))
      .toMatchObject({ version: 5, completedLessons: {} });
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
