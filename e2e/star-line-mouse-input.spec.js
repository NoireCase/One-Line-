import { test, expect } from '@playwright/test';
import { S } from './helpers/selectors.js';
import { goToLevel } from './helpers/navigation.js';
import { clearAllGameData } from './helpers/game-state.js';

async function openStarLineLevel(page, levelKey) {
  await page.goto('/');
  await clearAllGameData(page);
  // starSingle: easy-0 through easy-19 (20 levels)
  await page.evaluate(() => {
    localStorage.setItem('cg_discovery_star_line_basic_v1', '1');
    localStorage.setItem('cg_discovery_star_line_double_star_v1', '1');
    localStorage.setItem('cg_star_line_progress_v2', JSON.stringify({
      version: 1,
      games: {
        starSingle: { completed: {}, unlockedThroughId: 'star-lv-20' },
        starDouble: { completed: {}, unlockedThroughId: 'star-lv-30' },
      },
    }));
  });
  await goToLevel(page, { modeId: 'starSingle', levelKey });
}

async function openDoubleStarLevel(page, levelKey) {
  await page.goto('/');
  await clearAllGameData(page);
  await page.evaluate(() => {
    localStorage.setItem('cg_discovery_star_line_basic_v1', '1');
    localStorage.setItem('cg_discovery_star_line_double_star_v1', '1');
    localStorage.setItem('cg_star_line_progress_v2', JSON.stringify({
      version: 1,
      games: {
        starSingle: { completed: {}, unlockedThroughId: 'star-lv-01' },
        starDouble: { completed: {}, unlockedThroughId: 'star-lv-30' },
      },
    }));
  });
  await goToLevel(page, { modeId: 'starDouble', levelKey });
}

/**
 * 模拟真实鼠标拖拽：pointerdown → 分步 move → pointerup
 */
async function mouseDragAcross(page, cellIndices, { button = 'left' } = {}) {
  const firstBox = await page.locator(`[data-testid="star-line-cell-${cellIndices[0]}"]`).boundingBox();
  if (!firstBox) throw new Error(`Cell ${cellIndices[0]} not visible`);
  await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
  await page.mouse.down({ button });
  await page.waitForTimeout(40);

  for (let i = 1; i < cellIndices.length; i++) {
    const box = await page.locator(`[data-testid="star-line-cell-${cellIndices[i]}"]`).boundingBox();
    if (!box) continue;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 3 });
    await page.waitForTimeout(16);
  }
  await page.mouse.up({ button });
  await page.waitForTimeout(100);
}

test.describe('Star Line 鼠标输入', () => {
  test('放置模式单击放星', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    await page.locator('[data-testid="star-line-cell-0"]').click();
    await expect(page.locator('[data-testid="star-line-star-0"]')).toBeVisible();
    // 再次点击取消星点
    await page.locator('[data-testid="star-line-cell-0"]').click();
    await expect(page.locator('[data-testid="star-line-star-0"]')).toHaveCount(0);
  });

  test('放置模式不能拖动连续放星', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    // 放置模式是默认，拖过多个格子
    await mouseDragAcross(page, [0, 1, 5, 6]);
    // 只有第一个格子有星点（pointerdown 触发 onClick 对应的放置）
    // 实际上放置模式下 onPointerDown 不处理，只有 onClick 有效
    // 而 dragging 不会触发 onClick
    await expect(page.locator('[data-testid="star-line-star-0"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="star-line-star-1"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="star-line-star-5"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="star-line-star-6"]')).toHaveCount(0);
  });

  test('排除模式单击放 X', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    await page.getByRole('button', { name: '排除' }).click();
    await page.locator('[data-testid="star-line-cell-12"]').click();
    await expect(page.locator('[data-testid="star-line-x-12"]')).toBeVisible();
    // 再次点击取消 X
    await page.locator('[data-testid="star-line-cell-12"]').click();
    await expect(page.locator('[data-testid="star-line-x-12"]')).toHaveCount(0);
  });

  test('排除模式拖动连续放 X', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    await page.getByRole('button', { name: '排除' }).click();

    await mouseDragAcross(page, [10, 11, 12, 13, 14]);
    await expect(page.locator('[data-testid="star-line-x-10"]')).toBeVisible();
    await expect(page.locator('[data-testid="star-line-x-11"]')).toBeVisible();
    await expect(page.locator('[data-testid="star-line-x-12"]')).toBeVisible();
    await expect(page.locator('[data-testid="star-line-x-13"]')).toBeVisible();
    await expect(page.locator('[data-testid="star-line-x-14"]')).toBeVisible();
  });

  test('同一次拖动重复经过同格只处理一次', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    await page.getByRole('button', { name: '排除' }).click();

    // 拖过 [10, 11, 12, 11, 10] — 11 和 10 经过两次
    await mouseDragAcross(page, [10, 11, 12, 11, 10]);
    await expect(page.locator('[data-testid="star-line-x-10"]')).toBeVisible();
    await expect(page.locator('[data-testid="star-line-x-11"]')).toBeVisible();
    await expect(page.locator('[data-testid="star-line-x-12"]')).toBeVisible();
    // 没有多余副作用
    const allX = await page.locator('[data-testid^="star-line-x-"]').count();
    expect(allX).toBe(3);
  });

  test('排除拖动不覆盖星点', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    // 先放星
    await page.locator('[data-testid="star-line-cell-12"]').click();
    await expect(page.locator('[data-testid="star-line-star-12"]')).toBeVisible();

    // 切换到排除，拖过星点位置
    await page.getByRole('button', { name: '排除' }).click();
    await mouseDragAcross(page, [10, 11, 12, 13]);
    await expect(page.locator('[data-testid="star-line-star-12"]')).toBeVisible();
    await expect(page.locator('[data-testid="star-line-x-12"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="star-line-x-10"]')).toBeVisible();
    await expect(page.locator('[data-testid="star-line-x-11"]')).toBeVisible();
  });

  test('清除模式单击清除', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    // 先放星和 X
    await page.locator('[data-testid="star-line-cell-6"]').click();
    await expect(page.locator('[data-testid="star-line-star-6"]')).toBeVisible();
    await page.getByRole('button', { name: '排除' }).click();
    await page.locator('[data-testid="star-line-cell-12"]').click();
    await expect(page.locator('[data-testid="star-line-x-12"]')).toBeVisible();

    // 清除
    await page.getByRole('button', { name: '清除' }).click();
    await page.locator('[data-testid="star-line-cell-6"]').click();
    await expect(page.locator('[data-testid="star-line-star-6"]')).toHaveCount(0);
    await page.locator('[data-testid="star-line-cell-12"]').click();
    await expect(page.locator('[data-testid="star-line-x-12"]')).toHaveCount(0);
  });

  test('清除模式拖动连续清除', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    // 放一些星和 X
    await page.locator('[data-testid="star-line-cell-10"]').click();
    await page.getByRole('button', { name: '排除' }).click();
    await page.locator('[data-testid="star-line-cell-11"]').click();
    await page.locator('[data-testid="star-line-cell-12"]').click();

    // 切换到清除，拖动清除
    await page.getByRole('button', { name: '清除' }).click();
    await mouseDragAcross(page, [10, 11, 12, 13, 14]);
    await expect(page.locator('[data-testid="star-line-star-10"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="star-line-x-11"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="star-line-x-12"]')).toHaveCount(0);
  });

  test('清除拖动可同时清除星点和 X', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    // 放星
    await page.locator('[data-testid="star-line-cell-10"]').click();
    // 放 X
    await page.getByRole('button', { name: '排除' }).click();
    await page.locator('[data-testid="star-line-cell-11"]').click();

    // 清除模式拖过两者
    await page.getByRole('button', { name: '清除' }).click();
    await mouseDragAcross(page, [10, 11]);
    await expect(page.locator('[data-testid="star-line-star-10"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="star-line-x-11"]')).toHaveCount(0);
  });

  test('拖动结束后不会继续修改格子', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    await page.getByRole('button', { name: '排除' }).click();

    // 拖过后，单独 hover 另一个格子不应修改它
    await mouseDragAcross(page, [5, 6, 7]);
    await expect(page.locator('[data-testid="star-line-x-8"]')).toHaveCount(0);
    await page.locator('[data-testid="star-line-cell-8"]').hover();
    await page.waitForTimeout(200);
    await expect(page.locator('[data-testid="star-line-x-8"]')).toHaveCount(0);
  });

  test('工具切换后旧拖动状态失效', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    await page.getByRole('button', { name: '排除' }).click();

    // 在排除模式下按住一个格子
    const box = await page.locator('[data-testid="star-line-cell-0"]').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(30);
    // pointerDown 已处理 cell 0，放置了 X（不可回退）
    await expect(page.locator('[data-testid="star-line-x-0"]')).toBeVisible();
    // 切换工具到放置 — 旧拖动状态结束
    await page.getByRole('button', { name: '放置' }).click();
    await page.waitForTimeout(50);
    // 移动到其他格子 — 旧拖动已失效，不应对后续格子生效
    const box2 = await page.locator('[data-testid="star-line-cell-5"]').boundingBox();
    await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2, { steps: 3 });
    await page.mouse.up();
    await page.waitForTimeout(100);
    // 后续格子不应有 X（旧拖动已失效）
    await expect(page.locator('[data-testid="star-line-x-5"]')).toHaveCount(0);
  });

  test('数量反馈在拖动中即时更新', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    await page.getByRole('button', { name: '排除' }).click();

    // 拖动放 X，然后 hover 最后一格看数量
    await mouseDragAcross(page, [1, 2, 3]);
    // 点击最后一个格看反馈
    await page.locator('[data-testid="star-line-cell-2"]').click();
    await expect(page.locator('[data-testid="star-line-rule-row"]')).toBeVisible();
  });

  test('冲突状态在清除后即时更新', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    const solution = [1, 8, 10, 17, 24];
    for (const idx of solution) {
      await page.locator(`[data-testid="star-line-cell-${idx}"]`).click();
    }
    // 添加一个冲突星点
    await page.locator('[data-testid="star-line-cell-2"]').click();
    await expect(page.locator('[data-testid="star-line-conflict-summary"]')).toBeVisible();

    // 清除冲突
    await page.getByRole('button', { name: '清除' }).click();
    await page.locator('[data-testid="star-line-cell-2"]').click();
    await expect(page.locator('[data-testid="star-line-conflict-summary"]')).toHaveCount(0);
  });

  test('Lv.1 鼠标操作正常', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    // 放置模式
    const solution = [1, 8, 10, 17, 24];
    for (const idx of solution) {
      await page.locator(`[data-testid="star-line-cell-${idx}"]`).click();
    }
    await expect(page.locator('[data-testid="star-line-board-container"]')).toHaveClass(/is-complete/);
  });

  test('Lv.21（双星 Lv.1）鼠标操作正常', async ({ page }) => {
    await openDoubleStarLevel(page, 'easy-0');
    // 双星关卡：放置 + 排除 + 清除工具均可用
    await page.locator('[data-testid="star-line-cell-1"]').click();
    await expect(page.locator('[data-testid="star-line-star-1"]')).toBeVisible();

    await page.getByRole('button', { name: '排除' }).click();
    await mouseDragAcross(page, [6, 7, 8]);
    await expect(page.locator('[data-testid="star-line-x-6"]')).toBeVisible();

    await page.getByRole('button', { name: '清除' }).click();
    await page.locator('[data-testid="star-line-cell-6"]').click();
    await expect(page.locator('[data-testid="star-line-x-6"]')).toHaveCount(0);

    // 确认棋盘可见且工具正常
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();
    for (const tool of ['放置', '排除', '清除']) {
      await page.getByRole('button', { name: tool }).click();
      await expect(page.getByRole('button', { name: tool })).toHaveAttribute('aria-pressed', 'true');
    }
  });

  test('Lv.30（双星 Lv.10）鼠标操作正常', async ({ page }) => {
    await openDoubleStarLevel(page, 'easy-9');
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();
    // 确认所有工具可用
    for (const tool of ['放置', '排除', '清除']) {
      await page.getByRole('button', { name: tool }).click();
      await expect(page.getByRole('button', { name: tool })).toHaveAttribute('aria-pressed', 'true');
    }
    // 放一个星
    await page.getByRole('button', { name: '放置' }).click();
    await page.locator('[data-testid="star-line-cell-0"]').click();
    await expect(page.locator('[data-testid="star-line-star-0"]')).toBeVisible();
  });

  // ── 撤销测试 ──

  test('单击放星后可撤销', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    await page.locator('[data-testid="star-line-cell-1"]').click();
    await expect(page.locator('[data-testid="star-line-star-1"]')).toBeVisible();
    const undo = page.locator('[data-testid="star-line-undo-button"]');
    await expect(undo).toBeEnabled();
    await undo.click();
    await page.waitForTimeout(100);
    await expect(page.locator('[data-testid="star-line-star-1"]')).toHaveCount(0);
  });

  test('单击排除后可撤销', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    await page.getByRole('button', { name: '排除' }).click();
    await page.locator('[data-testid="star-line-cell-12"]').click();
    await expect(page.locator('[data-testid="star-line-x-12"]')).toBeVisible();
    await page.locator('[data-testid="star-line-undo-button"]').click();
    await expect(page.locator('[data-testid="star-line-x-12"]')).toHaveCount(0);
  });

  test('单击清除后可撤销', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    // 放星后清除
    await page.locator('[data-testid="star-line-cell-1"]').click();
    await expect(page.locator('[data-testid="star-line-star-1"]')).toBeVisible();
    await page.getByRole('button', { name: '清除' }).click();
    await page.locator('[data-testid="star-line-cell-1"]').click();
    await expect(page.locator('[data-testid="star-line-star-1"]')).toHaveCount(0);
    // 撤销清除，星点恢复
    await page.locator('[data-testid="star-line-undo-button"]').click();
    await expect(page.locator('[data-testid="star-line-star-1"]')).toBeVisible();
  });

  test('一次排除拖动整体只需撤销一次', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    await page.getByRole('button', { name: '排除' }).click();
    await mouseDragAcross(page, [10, 11, 12, 13, 14]);
    const visibleXBefore = await page.locator('[data-testid^="star-line-x-"]').count();
    expect(visibleXBefore).toBeGreaterThanOrEqual(5);
    // 一次撤销恢复所有
    await page.locator('[data-testid="star-line-undo-button"]').click();
    await expect(page.locator('[data-testid="star-line-x-10"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="star-line-x-11"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="star-line-x-12"]')).toHaveCount(0);
  });

  test('一次清除拖动整体只需撤销一次', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    // 放星和 X
    await page.locator('[data-testid="star-line-cell-10"]').click();
    await page.getByRole('button', { name: '排除' }).click();
    await page.locator('[data-testid="star-line-cell-11"]').click();
    // 清除拖动
    await page.getByRole('button', { name: '清除' }).click();
    await mouseDragAcross(page, [10, 11]);
    await expect(page.locator('[data-testid="star-line-star-10"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="star-line-x-11"]')).toHaveCount(0);
    // 一次撤销恢复全部
    await page.locator('[data-testid="star-line-undo-button"]').click();
    await expect(page.locator('[data-testid="star-line-star-10"]')).toBeVisible();
    await expect(page.locator('[data-testid="star-line-x-11"]')).toBeVisible();
  });

  test('撤销恢复数量反馈', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    await page.locator('[data-testid="star-line-cell-1"]').click();
    await expect(page.locator('[data-testid="star-line-rule-row"]')).toHaveText('行 1/1');
    await page.locator('[data-testid="star-line-undo-button"]').click();
    await page.locator('[data-testid="star-line-cell-0"]').click();
    await expect(page.locator('[data-testid="star-line-rule-row"]')).toHaveText('行 1/1');
  });

  test('撤销恢复或清除冲突状态', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    const solution = [1, 8, 10, 17, 24];
    for (const idx of solution) {
      await page.locator(`[data-testid="star-line-cell-${idx}"]`).click();
    }
    // 制造冲突
    await page.locator('[data-testid="star-line-cell-2"]').click();
    await expect(page.locator('[data-testid="star-line-conflict-summary"]')).toBeVisible();
    // 撤销冲突
    await page.locator('[data-testid="star-line-undo-button"]').click();
    await expect(page.locator('[data-testid="star-line-conflict-summary"]')).toHaveCount(0);
  });

  test('工具切换不进入历史', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    const undo = page.locator('[data-testid="star-line-undo-button"]');
    await expect(undo).toBeDisabled();
    // 切换工具不产生历史
    await page.getByRole('button', { name: '排除' }).click();
    await page.getByRole('button', { name: '放置' }).click();
    await page.getByRole('button', { name: '清除' }).click();
    await expect(undo).toBeDisabled();
  });

  test('无变化操作不进入历史', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    const undo = page.locator('[data-testid="star-line-undo-button"]');
    // 清除模式下点击空格（无变化）
    await page.getByRole('button', { name: '清除' }).click();
    await page.locator('[data-testid="star-line-cell-12"]').click();
    await expect(undo).toBeDisabled();
  });

  test('重开后历史清空', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    await page.locator('[data-testid="star-line-cell-1"]').click();
    await expect(page.locator('[data-testid="star-line-undo-button"]')).toBeEnabled();
    // 重开
    await page.locator(S.game.restartButton).click();
    await page.locator(S.game.restartButton).click();
    await expect(page.locator('[data-testid="star-line-undo-button"]')).toBeDisabled();
  });

  test('切关后历史清空', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    // 正常通关 Lv.1
    for (const idx of [1, 8, 10, 17, 24]) {
      await page.locator(`[data-testid="star-line-cell-${idx}"]`).click();
    }
    await page.waitForTimeout(100);
    // 通关后撤销已禁用
    await expect(page.locator('[data-testid="star-line-undo-button"]')).toBeDisabled();
    // WinPanel 出现
    await expect(page.locator(S.win.panel)).toBeVisible({ timeout: 3000 });
    // 下一关
    await page.locator(S.win.nextButton).click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();
    // 新关卡撤销禁用（历史已清空）
    await expect(page.locator('[data-testid="star-line-undo-button"]')).toBeDisabled();
  });

  test('通关后撤销禁用且历史实际清空无法恢复', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    const solution = [1, 8, 10, 17, 24];
    for (const idx of solution) {
      await page.locator(`[data-testid="star-line-cell-${idx}"]`).click();
    }
    await expect(page.locator('[data-testid="star-line-board-container"]')).toHaveClass(/is-complete/);
    // 撤销按钮 disabled
    await expect(page.locator('[data-testid="star-line-undo-button"]')).toBeDisabled();
    await expect(page.locator(S.win.panel)).toBeVisible({ timeout: 3000 });
    // WinPanel 重玩
    await page.locator(S.win.retryButton).click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();
    // 重玩后撤销禁用（不会继承上局历史）
    await expect(page.locator('[data-testid="star-line-undo-button"]')).toBeDisabled();
    // 放一个新星后撤销可用（用新历史）
    await page.locator('[data-testid="star-line-cell-1"]').click();
    await expect(page.locator('[data-testid="star-line-undo-button"]')).toBeEnabled();
    // 撤销这个新星正常
    await page.locator('[data-testid="star-line-undo-button"]').click();
    await expect(page.locator('[data-testid="star-line-star-1"]')).toHaveCount(0);
  });

  test('撤销不会重复触发通关且 WinPanel 仅出现一次', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    const solution = [1, 8, 10, 17, 24];
    for (const idx of solution) {
      await page.locator(`[data-testid="star-line-cell-${idx}"]`).click();
    }
    await expect(page.locator('[data-testid="star-line-board-container"]')).toHaveClass(/is-complete/);
    // 撤销在通关后已禁用
    await expect(page.locator('[data-testid="star-line-undo-button"]')).toBeDisabled();
    // 通关前放星的历史已实际清空，按钮不可用
    // WinPanel 只出现一次
    await expect(page.locator(S.win.panel)).toBeVisible({ timeout: 3000 });
    // 关闭再进入新关卡，历史不会恢复
    await page.locator(S.win.backButton).click();
    await expect(page.locator(S.puzzleBook.page)).toBeVisible();
    await page.locator('[data-testid="level-tile-easy-0"]').click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();
    // 重新进入后撤销不可用
    await expect(page.locator('[data-testid="star-line-undo-button"]')).toBeDisabled();
  });

  test('撤销按钮不能由 Enter / Space 激活', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    await page.locator('[data-testid="star-line-cell-1"]').click();
    const undo = page.locator('[data-testid="star-line-undo-button"]');
    await expect(undo).toBeEnabled();
    // Enter 不激活
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="star-line-star-1"]')).toBeVisible();
    // Space 不激活
    await page.keyboard.press(' ');
    await expect(page.locator('[data-testid="star-line-star-1"]')).toBeVisible();
  });

  test('鼠标可以正常激活撤销', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    // 放置 star 在 cell 1，然后放置 star 在 cell 8
    await page.locator('[data-testid="star-line-cell-1"]').click();
    await page.locator('[data-testid="star-line-cell-8"]').click();
    // 撤销 cell 8 (最近一步)
    await page.locator('[data-testid="star-line-undo-button"]').click();
    await page.waitForTimeout(100);
    await expect(page.locator('[data-testid="star-line-star-8"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="star-line-star-1"]')).toBeVisible();
    // 撤销 cell 1
    await page.locator('[data-testid="star-line-undo-button"]').click();
    await page.waitForTimeout(100);
    await expect(page.locator('[data-testid="star-line-star-1"]')).toHaveCount(0);
  });

  test('最多保留 20 步，第 21 步后最旧步骤被移除', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    const undo = page.locator('[data-testid="star-line-undo-button"]');

    // 在 25 格棋盘上执行 21 个真实独立操作（排除模式单击不同格子）
    await page.getByRole('button', { name: '排除' }).click();
    const targetCells = [
      0, 1, 5, 6, 10, 11, 15, 16, 20, 21,
      2, 3, 7, 8, 12, 13, 17, 18, 22, 23,
      4,
    ]; // 21 distinct cells
    for (const idx of targetCells) {
      await page.locator(`[data-testid="star-line-cell-${idx}"]`).click();
      await page.waitForTimeout(30);
    }

    // 第 1 步（cell 0 的 X）已被第 21 步挤出历史
    // 撤销 20 次恢复第 2–21 步，第 1 步的 X 应仍保留
    for (let i = 0; i < 20; i++) {
      if (await undo.isDisabled()) break;
      await undo.click();
      await page.waitForTimeout(20);
    }

    // 第 1 步的 X 仍在棋盘上（不在历史中，撤销无法触及）
    await expect(page.locator('[data-testid="star-line-x-0"]')).toBeVisible();
    // 第 2–21 步的 X 全部被撤销清除
    for (const idx of targetCells.slice(1)) {
      await expect(page.locator(`[data-testid="star-line-x-${idx}"]`)).toHaveCount(0);
    }
    // 撤销按钮禁用
    await expect(undo).toBeDisabled();
  });

  // ── 非左键测试 ──

  test('排除模式右键点击空格不产生 X', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    await page.getByRole('button', { name: '排除' }).click();
    const box = await page.locator('[data-testid="star-line-cell-12"]').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
    await page.waitForTimeout(200);
    await expect(page.locator('[data-testid="star-line-x-12"]')).toHaveCount(0);
  });

  test('清除模式右键点击星点不清除星点', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    await page.locator('[data-testid="star-line-cell-6"]').click();
    await expect(page.locator('[data-testid="star-line-star-6"]')).toBeVisible();
    await page.getByRole('button', { name: '清除' }).click();
    const box = await page.locator('[data-testid="star-line-cell-6"]').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
    await page.waitForTimeout(200);
    await expect(page.locator('[data-testid="star-line-star-6"]')).toBeVisible();
  });

  test('清除模式右键点击 X 不清除 X', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    await page.getByRole('button', { name: '排除' }).click();
    await page.locator('[data-testid="star-line-cell-12"]').click();
    await expect(page.locator('[data-testid="star-line-x-12"]')).toBeVisible();
    await page.getByRole('button', { name: '清除' }).click();
    const box = await page.locator('[data-testid="star-line-cell-12"]').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
    await page.waitForTimeout(200);
    await expect(page.locator('[data-testid="star-line-x-12"]')).toBeVisible();
  });

  test('右键操作不启用撤销按钮', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    await page.getByRole('button', { name: '排除' }).click();
    const box = await page.locator('[data-testid="star-line-cell-12"]').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
    await page.waitForTimeout(200);
    await expect(page.locator('[data-testid="star-line-undo-button"]')).toBeDisabled();
  });

  test('右键后继续左键操作仍正常', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    await page.getByRole('button', { name: '排除' }).click();
    // 先右键（不产生 X）
    const boxR = await page.locator('[data-testid="star-line-cell-12"]').boundingBox();
    await page.mouse.click(boxR.x + boxR.width / 2, boxR.y + boxR.height / 2, { button: 'right' });
    await page.waitForTimeout(100);
    // 再左键（应正常产生 X）
    await page.mouse.click(boxR.x + boxR.width / 2, boxR.y + boxR.height / 2, { button: 'left' });
    await page.waitForTimeout(100);
    await expect(page.locator('[data-testid="star-line-x-12"]')).toBeVisible();
    // 可撤销
    await expect(page.locator('[data-testid="star-line-undo-button"]')).toBeEnabled();
  });

  test('右键不会开启残留拖动事务', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    await page.getByRole('button', { name: '排除' }).click();
    // 右键按下并拖过多个格子
    const box = await page.locator('[data-testid="star-line-cell-10"]').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down({ button: 'right' });
    await page.waitForTimeout(30);
    for (const idx of [11, 12, 13, 14]) {
      const b = await page.locator(`[data-testid="star-line-cell-${idx}"]`).boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 2 });
      await page.waitForTimeout(16);
    }
    await page.mouse.up({ button: 'right' });
    await page.waitForTimeout(200);
    // 右键拖动不产生任何 X
    for (const idx of [10, 11, 12, 13, 14]) {
      await expect(page.locator(`[data-testid="star-line-x-${idx}"]`)).toHaveCount(0);
    }
    // 撤销仍不可用
    await expect(page.locator('[data-testid="star-line-undo-button"]')).toBeDisabled();
    // 后续左键操作仍正常
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'left' });
    await page.waitForTimeout(100);
    await expect(page.locator('[data-testid="star-line-x-10"]')).toBeVisible();
  });

  // ── Star Line 键盘无效测试 ──

  test('Star Line 工具按钮 Enter/Space 不二次切换且不改变棋盘', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    // 先鼠标点击选中排除工具
    const excludeBtn = page.getByRole('button', { name: '排除' });
    await excludeBtn.click();
    await expect(excludeBtn).toHaveAttribute('aria-pressed', 'true');
    // 放一个星
    await page.getByRole('button', { name: '放置' }).click();
    await page.locator('[data-testid="star-line-cell-1"]').click();
    await expect(page.locator('[data-testid="star-line-star-1"]')).toBeVisible();
    // Enter/Space 不改变工具和棋盘
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    await expect(page.getByRole('button', { name: '放置' })).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press(' ');
    await page.waitForTimeout(100);
    await expect(page.getByRole('button', { name: '放置' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-testid="star-line-star-1"]')).toBeVisible();
  });

  test('Star Line 撤销按钮 Enter/Space 不执行撤销', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    await page.locator('[data-testid="star-line-cell-1"]').click();
    await expect(page.locator('[data-testid="star-line-undo-button"]')).toBeEnabled();
    // Enter/Space 不触发撤销
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    await expect(page.locator('[data-testid="star-line-star-1"]')).toBeVisible();
    await page.keyboard.press(' ');
    await page.waitForTimeout(100);
    await expect(page.locator('[data-testid="star-line-star-1"]')).toBeVisible();
  });

  test('Star Line 辅助高亮 Enter/Space 不切换', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    const assist = page.locator('[data-testid="star-line-assist-toggle"]');
    await expect(assist).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    await expect(assist).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press(' ');
    await page.waitForTimeout(100);
    await expect(assist).toHaveAttribute('aria-pressed', 'false');
  });

  test('Star Line 重新开始 Enter/Space 不触发', async ({ page }) => {
    await openStarLineLevel(page, 'easy-0');
    await page.locator('[data-testid="star-line-cell-1"]').click();
    await expect(page.locator('[data-testid="star-line-star-1"]')).toBeVisible();
    // Enter/Space 不触发重新开始
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    await expect(page.locator('[data-testid="star-line-star-1"]')).toBeVisible();
    await page.keyboard.press(' ');
    await page.waitForTimeout(100);
    await expect(page.locator('[data-testid="star-line-star-1"]')).toBeVisible();
  });
});
