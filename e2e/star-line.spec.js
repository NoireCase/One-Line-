import { test, expect } from '@playwright/test';
import { S } from './helpers/selectors.js';
import { goToStarLineLevels } from './helpers/navigation.js';
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
    // Star Line CTA 使用 Star 模式配色（data-mode），不是通用金色
    await expect(cta).toHaveAttribute('data-mode', 'starLine');
    await expect(page.locator(S.modeSwitcher.modeCard('starLine'))).not.toBeVisible();
    // 单玩法目录不渲染 ModeSwitcher
    await expect(page.locator(S.modeSwitcher.section)).toHaveCount(0);
  });

  test('当前章节用星轨节点展示，未来章节仅摘要（不逐格铺 30）', async ({ page }) => {
    // 当前章节（入门）以星轨节点渲染
    await expect(page.locator('[data-testid="star-track"]').first()).toBeVisible();
    const nodes = page.locator(S.puzzleBook.anyTile);
    const count = await nodes.count();
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(10); // 只渲染当前章节，不逐格铺 30 个节点
    // 未来章节以摘要呈现（存在章节容器，但不逐格渲染其节点）
    await expect(page.locator(S.puzzleBook.chapter('star-double'))).toBeVisible();
    await expect(page.locator('[data-testid="level-tile-easy-20"]')).toHaveCount(0);
  });

  test('全部完成显示星线专属完成横幅且无 CTA', async ({ page }) => {
    await page.evaluate(() => {
      const completed = {};
      for (let i = 0; i < 30; i++) completed[String(i)] = 1;
      localStorage.setItem('cg_star_line_progress', JSON.stringify({ unlockedThrough: 29, completed }));
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

  test('局内重置清空棋盘', async ({ page }) => {
    await page.locator(S.puzzleBook.anyTile).first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    // 放置星和 X
    await page.locator('[data-testid="star-line-cell-0"]').click();
    await page.locator('button:has-text("排除")').click();
    await page.locator('[data-testid="star-line-cell-1"]').click();
    await expect(page.locator('[data-testid="star-line-star-0"]')).toBeVisible();
    await expect(page.locator('[data-testid="star-line-x-1"]')).toBeVisible();

    // 点击重置
    await page.locator(S.game.restartButton).click();

    // 棋盘应为空
    await expect(page.locator('[data-testid="star-line-star-0"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="star-line-x-1"]')).not.toBeVisible();
  });

  test('有标记时返回需确认，取消保留标记，确认后退出', async ({ page }) => {
    await page.locator(S.puzzleBook.anyTile).first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    // 放置一颗星
    await page.locator('[data-testid="star-line-cell-0"]').click();
    await expect(page.locator('[data-testid="star-line-star-0"]')).toBeVisible();

    // 首次返回后取消，仍停留在本局且标记保留
    await page.locator(S.game.backButton).click();
    await expect(page.locator(S.exitPrompt.panel)).toBeVisible();
    await expect(page.locator(S.exitPrompt.panel)).toContainText('当前星阵还未完成');
    await expect(page.locator(S.exitPrompt.panel)).toContainText('离开会丢失本局标记');
    await expect(page.locator(S.exitPrompt.saveAndExit)).not.toBeVisible();
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
    // Lv1、Lv3 完成，Lv2 未完成 → 推荐 Lv2，当前章节=入门（渲染 1-10）
    await page.evaluate(() => {
      localStorage.setItem('cg_star_line_progress', JSON.stringify({ unlockedThrough: 5, completed: { '0': 1, '2': 1 } }));
    });
    await goToStarLineLevels(page);

    // 节点本身状态正确
    await expect(page.locator('[data-testid="level-tile-easy-0"]')).toHaveAttribute('data-completed', 'true');
    await expect(page.locator('[data-testid="level-tile-easy-2"]')).toHaveAttribute('data-completed', 'true');
    // 1→2、2→3 两段均不点亮（因 Lv2 未完成）
    await expect(page.locator('[data-testid="star-track-link-0"]')).toHaveAttribute('data-lit', 'false');
    await expect(page.locator('[data-testid="star-track-link-1"]')).toHaveAttribute('data-lit', 'false');
  });

  test('L3.1 星轨连接线：连续完成 1–5 仅点亮 0–3 段', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('cg_star_line_progress', JSON.stringify({ unlockedThrough: 6, completed: { '0': 1, '1': 1, '2': 1, '3': 1, '4': 1 } }));
    });
    await goToStarLineLevels(page);

    for (const i of [0, 1, 2, 3]) {
      await expect(page.locator(`[data-testid="star-track-link-${i}"]`)).toHaveAttribute('data-lit', 'true');
    }
    // 第 5 关与第 6 关之间不点亮（Lv6 未完成）
    await expect(page.locator('[data-testid="star-track-link-4"]')).toHaveAttribute('data-lit', 'false');
    // 入门章节共 10 节点 → 9 段连接线
    await expect(page.locator('[data-testid^="star-track-link-"]')).toHaveCount(9);
  });

  test('L3.1 星轨连接线：整章完成后展开，所有段点亮', async ({ page }) => {
    // 入门 10 关全完成 → 当前推进到入门MAX；入门为已完成章节，展开后查看星轨
    await page.evaluate(() => {
      const completed = {};
      for (let i = 0; i < 10; i++) completed[String(i)] = 1;
      localStorage.setItem('cg_star_line_progress', JSON.stringify({ unlockedThrough: 12, completed }));
    });
    await goToStarLineLevels(page);

    await page.locator(S.puzzleBook.chapterToggle('star-intro')).click();
    // 作用域限定在“入门”章节内（页面可能同时存在当前章节的另一条星轨）
    const introBody = page.locator('#level-chapter-body-star-intro');
    const links = introBody.locator('[data-testid^="star-track-link-"]');
    await expect(links).toHaveCount(9);
    await expect(introBody.locator('[data-testid^="star-track-link-"][data-lit="false"]')).toHaveCount(0);
    await expect(introBody.locator('[data-testid^="star-track-link-"][data-lit="true"]')).toHaveCount(9);
  });

  test('L3.1 partial 章节折叠显示“展开关卡”（非“展开重玩”）', async ({ page }) => {
    // 全部解锁、无完成 → 入门为当前，入门MAX/双星等为 partial
    await page.evaluate(() => {
      localStorage.setItem('cg_star_line_progress', JSON.stringify({ unlockedThrough: 29, completed: {} }));
    });
    await goToStarLineLevels(page);

    const toggle = page.locator(S.puzzleBook.chapterToggle('star-intro-max'));
    await expect(toggle).toContainText('展开关卡');
    await expect(toggle).not.toContainText('展开重玩');
    await toggle.click();
    await expect(toggle).toContainText('收起');
  });
});
