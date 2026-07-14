import { test, expect } from '@playwright/test';
import { S } from './helpers/selectors.js';
import { goToLevel, goToStarLineLevels } from './helpers/navigation.js';
import { clearAllGameData } from './helpers/game-state.js';

test.describe('星线谜阵 (Star Line)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
    // Pre-mark tutorials as seen to prevent them blocking interactions
    await page.evaluate(() => {
      localStorage.setItem('cg_discovery_star_line_basic_v1', '1');
      localStorage.setItem('cg_discovery_star_line_double_star_v1', '1');
    });
    await goToStarLineLevels(page);
  });

  test('独立入口进入 Star Line 关卡页', async ({ page }) => {
    await expect(page.locator(S.puzzleBook.title)).toContainText('星线谜阵');
    const cta = page.locator(S.puzzleBook.cta);
    await expect(cta).toBeVisible();
    // 默认显示单星谜阵
    await expect(cta).toHaveAttribute('data-mode', 'starSingle');
    // ModeSwitcher 显示单星 / 双星两个 tab
    await expect(page.locator(S.modeSwitcher.modeCard('starSingle'))).toBeVisible();
    await expect(page.locator(S.modeSwitcher.modeCard('starDouble'))).toBeVisible();
    await expect(page.locator(S.modeSwitcher.section)).toBeVisible();
  });

  test('当前章节用星轨节点展示，未来章节仅摘要（单星 20 关）', async ({ page }) => {
    // 当前章节（入门）以星轨节点渲染
    await expect(page.locator('[data-testid="star-track"]').first()).toBeVisible();
    const nodes = page.locator(S.puzzleBook.anyTile);
    const count = await nodes.count();
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(10); // 只渲染当前章节，不逐格铺 20 个节点
    // 未来章节以摘要呈现（存在章节容器，但不逐格渲染其节点）
    await expect(page.locator(S.puzzleBook.chapter('star-single-basic'))).toBeVisible();
    await expect(page.locator('[data-testid="level-tile-easy-20"]')).toHaveCount(0);
  });

  test('全部完成显示星线专属完成横幅且无 CTA', async ({ page }) => {
    await page.evaluate(() => {
      const completed = {};
      for (let i = 1; i <= 20; i++) completed[`star-lv-${String(i).padStart(2, '0')}`] = 3;
      localStorage.setItem('cg_star_line_progress_v2', JSON.stringify({
        version: 1,
        games: {
          starSingle: { completed, unlockedThroughId: 'star-lv-20' },
          starDouble: { completed: {}, unlockedThroughId: 'star-lv-21' },
        },
      }));
    });
    await goToStarLineLevels(page);

    const banner = page.locator('[data-testid="level-complete-banner"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('星线谜阵已全部完成');
    await expect(page.locator(S.puzzleBook.cta)).toHaveCount(0);
  });

  test('进入第 1 关后存在 25 个 cell', async ({ page }) => {
    const firstTile = page.locator(S.puzzleBook.anyTile).first();
    await firstTile.click();

    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();
    const cells = page.locator('[data-testid^="star-line-cell-"]');
    await expect(cells).toHaveCount(25);
  });

  test('辅助高亮默认关闭，可手动开启和关闭', async ({ page }) => {
    await page.locator(S.puzzleBook.anyTile).first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    const assistToggle = page.locator('[data-testid="star-line-assist-toggle"]');
    const c0 = page.locator('[data-testid="star-line-cell-0"]');
    const unrelatedCell = page.locator('[data-testid="star-line-cell-24"]');

    await expect(assistToggle).toHaveAttribute('aria-pressed', 'false');
    await c0.hover();
    await expect(unrelatedCell).not.toHaveClass(/is-dimmed/);
    await expect(page.getByText(/行 \d+：/)).toHaveCount(0);
    await expect(page.getByText(/列 \d+：/)).toHaveCount(0);
    await expect(page.getByText(/星域 \d+：/)).toHaveCount(0);

    await assistToggle.click();
    await expect(assistToggle).toHaveAttribute('aria-pressed', 'true');
    await c0.hover();
    await expect(unrelatedCell).toHaveClass(/is-dimmed/);

    await assistToggle.click();
    await expect(assistToggle).toHaveAttribute('aria-pressed', 'false');
    await c0.hover();
    await expect(unrelatedCell).not.toHaveClass(/is-dimmed/);
    await expect(page.getByText(/行 \d+：/)).toHaveCount(0);
    await expect(page.getByText(/列 \d+：/)).toHaveCount(0);
    await expect(page.getByText(/星域 \d+：/)).toHaveCount(0);
  });

  test('局部规则反馈显示单星数量，并在清除后立即回退', async ({ page }) => {
    await page.locator(S.puzzleBook.anyTile).first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    const cell = page.locator('[data-testid="star-line-cell-1"]');
    // 点击放置星点，触发规则反馈
    await cell.click();
    await expect(page.locator('[data-testid="star-line-rule-row"]')).toHaveText('行 1/1');
    await expect(page.locator('[data-testid="star-line-rule-col"]')).toHaveText('列 1/1');
    await expect(page.locator('[data-testid="star-line-rule-region"]')).toHaveText('星域 1/1');

    // 切换到清除工具，清除后数量回退
    await page.getByRole('button', { name: '清除' }).click();
    await cell.click();
    await expect(page.locator('[data-testid="star-line-rule-row"]')).toHaveText('行 0/1');
    await expect(page.locator('[data-testid="star-line-rule-col"]')).toHaveText('列 0/1');
    await expect(page.locator('[data-testid="star-line-rule-region"]')).toHaveText('星域 0/1');
  });

  test('双星局部规则反馈区分 0/2、1/2、2/2，并在超额后显示冲突', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('cg_star_line_progress_v2', JSON.stringify({
        version: 1,
        games: {
          starSingle: { completed: {}, unlockedThroughId: 'star-lv-01' },
          starDouble: { completed: {}, unlockedThroughId: 'star-lv-30' },
        },
      }));
    });
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });

    const first = page.locator('[data-testid="star-line-cell-1"]');
    const second = page.locator('[data-testid="star-line-cell-3"]');
    const third = page.locator('[data-testid="star-line-cell-6"]');

    // 点击放置第一个星点
    await first.click();
    await expect(page.locator('[data-testid="star-line-rule-row"]')).toHaveText('行 1/2');
    await expect(page.locator('[data-testid="star-line-rule-col"]')).toHaveText('列 1/2');
    await expect(page.locator('[data-testid="star-line-rule-region"]')).toHaveText('星域 1/2');

    // 点击放置第二个星点
    await second.click();
    await expect(page.locator('[data-testid="star-line-rule-row"]')).toHaveText('行 2/2');
    await expect(page.locator('[data-testid="star-line-rule-col"]')).toHaveText('列 1/2');
    await expect(page.locator('[data-testid="star-line-rule-region"]')).toHaveText('星域 1/2');

    // 第三个星点导致同行冲突
    await third.click();
    await expect(page.locator('[data-testid="star-line-conflict-summary"]')).toHaveText('同行冲突');
    await expect(page.locator('[data-testid="star-line-rule-feedback"]')).toHaveCount(0);

    // 取消第三个星点，冲突消失
    await third.click();
    await expect(page.locator('[data-testid="star-line-conflict-summary"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="star-line-rule-row"]')).toHaveText('行 2/2');
  });

  test('多重冲突压缩为单行摘要，且状态区不覆盖工具栏', async ({ page }) => {
    await page.locator(S.puzzleBook.anyTile).first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    await page.locator('[data-testid="star-line-cell-2"]').click();
    await page.locator('[data-testid="star-line-cell-3"]').click();

    const summary = page.locator('[data-testid="star-line-conflict-summary"]');
    await expect(summary).toHaveText('同行 · 星域 · 相邻冲突');
    await expect(summary).toHaveCount(1);
    await expect(page.getByText('星位互相干扰')).toHaveCount(0);

    const statusBox = await page.locator('[data-testid="star-line-feedback"]').boundingBox();
    const toolbarBox = await page.locator('.starline-toolbar').boundingBox();
    expect(statusBox).not.toBeNull();
    expect(toolbarBox).not.toBeNull();
    expect(statusBox.y + statusBox.height).toBeLessThanOrEqual(toolbarBox.y);
  });

  test('放置星 / 排除 X / 清除工具可交互', async ({ page }) => {
    await page.locator(S.puzzleBook.anyTile).first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    // 默认选中放置工具，点击第一格放星
    const c0 = page.locator('[data-testid="star-line-cell-0"]');
    await c0.click();
    await expect(page.locator('[data-testid="star-line-star-0"]')).toBeVisible();

    // 切换到排除工具
    await page.locator('button:has-text("排除")').click();
    const c1 = page.locator('[data-testid="star-line-cell-1"]');
    await c1.click();
    await expect(page.locator('[data-testid="star-line-x-1"]')).toBeVisible();

    // 切换到清除工具，清除星
    await page.locator('button:has-text("清除")').click();
    await c0.click();
    await expect(page.locator('[data-testid="star-line-star-0"]')).not.toBeVisible();

    // 清除 X
    await c1.click();
    await expect(page.locator('[data-testid="star-line-x-1"]')).not.toBeVisible();
  });

  test('局内重置需要二次确认后才清空棋盘', async ({ page }) => {
    await page.locator(S.puzzleBook.anyTile).first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    // 放置星和 X
    await page.locator('[data-testid="star-line-cell-0"]').click();
    await page.locator('button:has-text("排除")').click();
    await page.locator('[data-testid="star-line-cell-1"]').click();
    await expect(page.locator('[data-testid="star-line-star-0"]')).toBeVisible();
    await expect(page.locator('[data-testid="star-line-x-1"]')).toBeVisible();

    // 第一次点击仅进入确认状态，棋盘保持不变
    await page.locator(S.game.restartButton).click();
    await expect(page.locator('[data-testid="restart-confirmation"]')).toHaveText('再次点击重新开始');
    await expect(page.locator('[data-testid="star-line-star-0"]')).toBeVisible();
    await expect(page.locator('[data-testid="star-line-x-1"]')).toBeVisible();

    // 第二次点击才真正重置
    await page.locator(S.game.restartButton).click();

    // 棋盘应为空
    await expect(page.locator('[data-testid="star-line-star-0"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="star-line-x-1"]')).not.toBeVisible();
  });

  test('有标记时返回可取消保留标记，放弃后清空当前棋盘', async ({ page }) => {
    await page.locator(S.puzzleBook.anyTile).first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    // 放置一颗星
    await page.locator('[data-testid="star-line-cell-0"]').click();
    await expect(page.locator('[data-testid="star-line-star-0"]')).toBeVisible();

    // 首次返回后取消，仍停留在本局且标记保留
    await page.locator(S.game.backButton).click();
    await expect(page.locator(S.exitPrompt.panel)).toBeVisible();
    await expect(page.locator(S.exitPrompt.panel)).toContainText('退出当前关卡？');
    await expect(page.locator(S.exitPrompt.panel)).toContainText('可以保存当前进度稍后继续');
    await expect(page.locator(S.exitPrompt.saveAndExit)).toBeVisible();
    await page.locator(S.exitPrompt.continueGame).click();
    await expect(page.locator(S.exitPrompt.panel)).not.toBeVisible();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();
    await expect(page.locator('[data-testid="star-line-star-0"]')).toBeVisible();

    // 再次返回并确认离开
    await page.locator(S.game.backButton).click();
    await expect(page.locator(S.exitPrompt.panel)).toBeVisible();
    await page.locator(S.exitPrompt.abandonAndExit).click();
    await expect(page.locator(S.puzzleBook.title)).toBeVisible();

    // 重新进入同一关
    await page.locator(S.puzzleBook.anyTile).first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    // 棋盘应为空，不残留上一盘状态
    await expect(page.locator('[data-testid="star-line-star-0"]')).not.toBeVisible();
  });

  test('空局返回不出现确认，直接回到关卡列表', async ({ page }) => {
    await page.locator(S.puzzleBook.anyTile).first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    await page.locator(S.game.backButton).click();

    await expect(page.locator(S.exitPrompt.panel)).not.toBeVisible();
    await expect(page.locator(S.puzzleBook.title)).toBeVisible();
  });

  test('通关后显示结算面板且不因重试再次弹出', async ({ page }) => {
    await page.locator(S.puzzleBook.anyTile).first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    // 按 star-easy-01 的唯一解放置星星: [1, 8, 10, 17, 24]
    const solution = [1, 8, 10, 17, 24];
    for (const idx of solution) {
      await page.locator(`[data-testid="star-line-cell-${idx}"]`).click();
      await expect(page.locator(`[data-testid="star-line-star-${idx}"]`)).toBeVisible();
    }

    // 棋盘容器应出现完成动画 class
    const boardContainer = page.locator('[data-testid="star-line-board-container"]');
    await expect(boardContainer).toHaveClass(/is-complete/);

    // 结算面板应在动画延迟后出现
    await expect(page.locator(S.win.panel)).toBeVisible({ timeout: 3000 });
    await expect(page.locator(S.win.panel)).toContainText('星线完成');

    // 点击重新挑战
    await page.locator(S.win.retryButton).click();

    // 结算面板应立即关闭
    await expect(page.locator(S.win.panel)).not.toBeVisible({ timeout: 1000 });

    // 棋盘应重置为空
    await expect(page.locator('[data-testid="star-line-star-1"]')).not.toBeVisible();

    // 等待超过动画延迟 + 结算触发时间，确认不会再次弹出结算面板
    await page.waitForTimeout(2000);
    await expect(page.locator(S.win.panel)).not.toBeVisible();
  });

  test('L3.1 星轨连接线：非连续完成不跨越未完成节点点亮', async ({ page }) => {
    // Lv1、Lv3 完成，Lv2 未完成 → 推荐 Lv2
    await page.evaluate(() => {
      localStorage.setItem('cg_star_line_progress_v2', JSON.stringify({
        version: 1,
        games: {
          starSingle: { completed: { 'star-lv-01': 3, 'star-lv-03': 3 }, unlockedThroughId: 'star-lv-06' },
          starDouble: { completed: {}, unlockedThroughId: 'star-lv-21' },
        },
      }));
    });
    await goToStarLineLevels(page);

    // 关卡 1 和 3 为已完成，关卡 2 为当前推荐关（解锁但未完成）
    const tiles = page.locator(S.puzzleBook.anyTile);
    await expect(tiles.nth(0)).toHaveAttribute('data-completed', 'true');
    await expect(tiles.nth(2)).toHaveAttribute('data-completed', 'true');
    await expect(tiles.nth(1)).toHaveAttribute('data-completed', 'false');
  });

  test('L3.1 星轨连接线：连续完成 1–5 仅点亮 0–3 段', async ({ page }) => {
    await page.evaluate(() => {
      const c = {};
      for (let i = 1; i <= 5; i++) c[`star-lv-${String(i).padStart(2, '0')}`] = 3;
      localStorage.setItem('cg_star_line_progress_v2', JSON.stringify({
        version: 1,
        games: {
          starSingle: { completed: c, unlockedThroughId: 'star-lv-07' },
          starDouble: { completed: {}, unlockedThroughId: 'star-lv-21' },
        },
      }));
    });
    await goToStarLineLevels(page);

    // 入门章节当前展开，直接断言星轨连接线。
    const starTrack = page.locator('[data-testid="star-track"]');
    await expect(starTrack).toBeVisible();
    for (const i of [0, 1, 2, 3]) {
      await expect(page.locator(`[data-testid="star-track-link-${i}"]`)).toHaveAttribute('data-lit', 'true');
    }
    await expect(page.locator('[data-testid="star-track-link-4"]')).toHaveAttribute('data-lit', 'false');
    await expect(page.locator('[data-testid^="star-track-link-"]')).toHaveCount(9);
  });

  test('L3.1 星轨连接线：整章完成后展开为可重玩状态', async ({ page }) => {
    // 入门 10 关全完成 → 当前推进到进阶；入门为已完成章节
    await page.evaluate(() => {
      const c = {};
      for (let i = 1; i <= 10; i++) c[`star-lv-${String(i).padStart(2, '0')}`] = 3;
      localStorage.setItem('cg_star_line_progress_v2', JSON.stringify({
        version: 1,
        games: {
          starSingle: { completed: c, unlockedThroughId: 'star-lv-13' },
          starDouble: { completed: {}, unlockedThroughId: 'star-lv-21' },
        },
      }));
    });
    await goToStarLineLevels(page);

    // 已完成章节在标题中显示”已完成”
    await expect(page.locator(S.puzzleBook.chapter('star-single-intro'))).toContainText('已完成');
    // 进阶章节为当前章节（含”继续” CTA）
    await expect(page.locator(S.puzzleBook.chapter('star-single-basic'))).toBeVisible();
  });

  test('L3.1 partial 章节折叠显示”展开关卡”（非”展开重玩”）', async ({ page }) => {
    // 全部解锁、无完成 → 入门为当前，入门MAX为 partial
    await page.evaluate(() => {
      localStorage.setItem('cg_star_line_progress_v2', JSON.stringify({
        version: 1,
        games: {
          starSingle: { completed: {}, unlockedThroughId: 'star-lv-20' },
          starDouble: { completed: {}, unlockedThroughId: 'star-lv-21' },
        },
      }));
    });
    await goToStarLineLevels(page);

    const toggle = page.locator(S.puzzleBook.chapterToggle('star-single-basic'));
    await expect(toggle).toContainText('展开关卡');
    await expect(toggle).not.toContainText('展开重玩');
    await toggle.click();
    await expect(toggle).toContainText('收起');
  });
});
