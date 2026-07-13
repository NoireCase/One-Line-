import { test, expect } from '@playwright/test';
import { S } from './helpers/selectors.js';
import { goToLevel } from './helpers/navigation.js';
import { clearAllGameData } from './helpers/game-state.js';

async function openStarLineLevel(page, levelKey) {
  await page.goto('/');
  await clearAllGameData(page);
  // Level keys: easy-0 through easy-9 (Lv.1-10), easy-10 through easy-19 (Lv.11-20),
  // easy-20 through easy-26 (Lv.21-27), easy-27 through easy-29 (Lv.28-30)
  const levelNum = parseInt(levelKey.split('-')[1], 10);
  if (levelNum >= 20) {
    // Need unlock through at least level 29 for higher levels
    await page.evaluate((unlock) => {
      localStorage.setItem('cg_star_line_progress', JSON.stringify({ unlockedThrough: unlock, completed: {} }));
      localStorage.setItem('cg_discovery_star_line_basic_v1', '1');
      localStorage.setItem('cg_discovery_star_line_double_star_v1', '1');
    }, Math.max(levelNum, 29));
  } else {
    await page.evaluate(() => {
      localStorage.setItem('cg_discovery_star_line_basic_v1', '1');
      localStorage.setItem('cg_discovery_star_line_double_star_v1', '1');
    });
  }
  await goToLevel(page, { modeId: 'starLine', levelKey });
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

  test('Lv.21 鼠标操作正常', async ({ page }) => {
    await openStarLineLevel(page, 'easy-20');
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

  test('Lv.30 鼠标操作正常', async ({ page }) => {
    await openStarLineLevel(page, 'easy-29');
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
});
