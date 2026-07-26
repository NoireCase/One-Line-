import { test, expect } from '@playwright/test';
import { S } from './helpers/selectors.js';
import { goToLevel } from './helpers/navigation.js';
import { clearAllGameData, setStorage, readGridDataFromReactFiber, buildSolutionPath } from './helpers/game-state.js';
import { dragPath, dragCellToCell } from './helpers/game-simulation.js';

async function resetApp(page) {
  await page.goto('/');
  await clearAllGameData(page);
}

async function completeCurrentLevel(page) {
  const gridData = await readGridDataFromReactFiber(page);
  expect(gridData).toBeTruthy();
  const solution = buildSolutionPath(gridData);
  await dragPath(page, solution);
  await expect(page.locator(S.win.panel)).toBeVisible({ timeout: 5000 });
}

async function triggerClassicLose(page) {
  await setStorage(page, 'cg_classic_v2_progress', { easy: [1, 0], medium: [], hard: [] });
  await goToLevel(page, { modeId: 'classic', levelKey: 'easy-1' });
  // easy-1：从 cell 24 出发连到错误格 19，耗尽 3 点 HP
  for (let i = 0; i < 3; i += 1) {
    await dragCellToCell(page, 24, 19, { steps: 4, stepDelay: 10 });
  }
  await expect(page.locator(S.lose.panel)).toBeVisible({ timeout: 5000 });
}

test.describe('Motion & Feedback：结算面板与 Toast', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
  });

  test('失败面板真实进入，重开后完整退出 @critical', async ({ page }) => {
    await triggerClassicLose(page);
    const panel = page.locator(S.lose.panel);
    await expect(panel).toBeVisible();
    await expect(panel).not.toHaveClass(/animate-in/);

    await page.locator(S.lose.restartButton).click();
    await expect(panel).toHaveCount(0, { timeout: 3000 });
    await expect(page.locator(S.game.board)).toBeVisible({ timeout: 5000 });
  });

  test('购买弹窗真实进入与退出，Toast 退出后 DOM 消失 @critical', async ({ page }) => {
    await setStorage(page, 'cg_coins', '100');
    await setStorage(page, 'cg_items', { heal: 0, exclude: 0, hint: 0 });
    await goToLevel(page, { modeId: 'classic', levelKey: 'easy-0' });

    // 没有库存、金币足够 → 打开购买弹窗
    await page.getByRole('button', { name: '提示，购买需要 25 金币' }).click();
    const prompt = page.locator(S.purchase.prompt);
    await expect(prompt).toBeVisible({ timeout: 3000 });

    // 取消 → 退出后 DOM 消失
    await page.locator(S.purchase.cancelButton).click();
    await expect(prompt).toHaveCount(0, { timeout: 3000 });

    // 重新打开并确认 → 弹窗退出、Toast 进入
    await page.getByRole('button', { name: '提示，购买需要 25 金币' }).click();
    await expect(prompt).toBeVisible({ timeout: 3000 });
    await page.locator(S.purchase.confirmButton).click();
    await expect(prompt).toHaveCount(0, { timeout: 3000 });

    const toast = page.locator(S.game.toast);
    await expect(toast).toBeVisible({ timeout: 3000 });
    await expect(toast).toContainText('成功购买道具');
    // Toast 自动消失走真实 exit，最终 DOM 移除
    await expect(toast).toHaveCount(0, { timeout: 5000 });
  });

  test('reduced-motion 下面板与 Toast 仅保留 opacity，功能完整', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await triggerClassicLose(page);
    await expect(page.locator(S.lose.panel)).toBeVisible();
    await page.locator(S.lose.restartButton).click();
    await expect(page.locator(S.lose.panel)).toHaveCount(0, { timeout: 3000 });
    await expect(page.locator(S.game.board)).toBeVisible({ timeout: 5000 });
  });

  test('连续不同 Toast：第二条完整显示，不被旧事件清除，最终退出', async ({ page }) => {
    await setStorage(page, 'cg_coins', '100');
    await setStorage(page, 'cg_items', { heal: 0, exclude: 0, hint: 0 });
    await goToLevel(page, { modeId: 'classic', levelKey: 'easy-0' });

    // 第一条：满血使用恢复 → 立即提示（满血守卫先于购买，无库存也触发）
    await page.getByRole('button', { name: '恢复，购买需要 15 金币' }).click();
    const toast = page.locator(S.game.toast);
    await expect(toast).toBeVisible({ timeout: 3000 });
    await expect(toast).toContainText('生命值已满');

    // 紧接着第二条不同文案：购买提示
    await page.getByRole('button', { name: '提示，购买需要 25 金币' }).click();
    await page.locator(S.purchase.confirmButton).click();
    await expect(toast).toContainText('成功购买道具', { timeout: 3000 });

    // 第二条必须活过自己的展示窗口（不被第一条的退出/定时器清除）。
    // mode="wait" 下第二条可见时长约为 1800ms - 退出过渡 240ms，检查点取 900ms 安全区内。
    await page.waitForTimeout(900);
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('成功购买道具');
    // 最终正常退出并从 DOM 移除
    await expect(toast).toHaveCount(0, { timeout: 6000 });
  });

  test('连续相同 Toast：第二次作为独立事件重新进入', async ({ page }) => {
    await goToLevel(page, { modeId: 'classic', levelKey: 'easy-0' });

    const healButton = page.getByRole('button', { name: '恢复，剩余 3 次' });
    await healButton.click();
    const toast = page.locator(S.game.toast);
    await expect(toast).toBeVisible({ timeout: 3000 });
    const first = await toast.elementHandle();

    // 相同文案第二次触发：必须重新进入（DOM 元素被替换，而非合并）。
    // 等待旧元素退出（240ms）并新元素完成挂载后再取句柄。
    await page.waitForTimeout(400);
    await healButton.click();
    await page.waitForTimeout(700);
    const second = await toast.elementHandle();
    const sameNode = await page.evaluate(([a, b]) => a === b, [first, second]);
    expect(sameNode, '相同文案的第二次 Toast 应重新进入（新元素）').toBe(false);
    await expect(toast).toContainText('生命值已满');

    await expect(toast).toHaveCount(0, { timeout: 5000 });
  });
});

test.describe('Motion & Feedback：解锁反馈', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
  });

  test('首通显示“下一关已开启”徽标，返回关卡页新节点点亮一次', async ({ page }) => {
    await goToLevel(page, { modeId: 'classic', levelKey: 'easy-0' });
    await completeCurrentLevel(page);

    const badge = page.locator(S.unlock.badge);
    await expect(badge).toBeVisible({ timeout: 3000 });
    await expect(badge).toHaveAttribute('data-unlock-type', 'next-level');
    await expect(badge).toContainText('第 2 关已开启');

    // 返回谜题书：仅新解锁节点点亮，且只播一次
    await page.locator(S.win.backButton).click();
    await expect(page.locator(S.puzzleBook.page)).toBeVisible({ timeout: 5000 });
    const newTile = page.locator(S.puzzleBook.levelTile('easy-1'));
    await expect(newTile).toHaveAttribute('data-newly-unlocked', 'true');
    await expect(page.locator(S.puzzleBook.levelTile('easy-0'))).toHaveAttribute('data-newly-unlocked', 'false');
    // 一次性：播放结束后标记被消费，不会因章节重开而重播
    await expect(newTile).toHaveAttribute('data-newly-unlocked', 'false', { timeout: 4000 });
  });

  test('重玩已完成关卡不显示解锁徽标', async ({ page }) => {
    await setStorage(page, 'cg_classic_v2_progress', { easy: [3, 0], medium: [], hard: [] });
    await goToLevel(page, { modeId: 'classic', levelKey: 'easy-0' });
    await completeCurrentLevel(page);
    await expect(page.locator(S.win.panel)).toBeVisible();
    await expect(page.locator(S.unlock.badge)).toHaveCount(0);
  });

  test('跨章节首通显示“新章节已开启”', async ({ page }) => {
    await setStorage(page, 'cg_classic_v2_progress', {
      easy: [1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
      medium: [],
      hard: [],
    });
    await goToLevel(page, { modeId: 'classic', levelKey: 'easy-9' });
    await completeCurrentLevel(page);

    const badge = page.locator(S.unlock.badge);
    await expect(badge).toBeVisible({ timeout: 3000 });
    await expect(badge).toHaveAttribute('data-unlock-type', 'new-chapter');
    await expect(badge).toContainText('新章节已开启');
  });
});
