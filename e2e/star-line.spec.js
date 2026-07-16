import { test, expect } from '@playwright/test';
import { S } from './helpers/selectors.js';
import { goToLevel, goToStarLineLevels } from './helpers/navigation.js';
import { clearAllGameData } from './helpers/game-state.js';
import { getStarLineLevelByMode } from '../src/game/starLine/starLineRules.js';

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
      // 旧 20 关 (01-20) + 新增 40 关 (31-70)
      for (let i = 1; i <= 20; i++) completed[`star-lv-${String(i).padStart(2, '0')}`] = 3;
      for (let i = 31; i <= 70; i++) completed[`star-lv-${String(i).padStart(2, '0')}`] = 3;
      localStorage.setItem('cg_star_line_progress_v2', JSON.stringify({
        version: 1,
        games: {
          starSingle: { completed, unlockedThroughId: 'star-lv-70' },
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
    // 双击放置星点，触发规则反馈
    await cell.dblclick();
    await expect(page.locator('[data-testid="star-line-rule-row"]')).toHaveText('行 1/1');
    await expect(page.locator('[data-testid="star-line-rule-col"]')).toHaveText('列 1/1');
    await expect(page.locator('[data-testid="star-line-rule-region"]')).toHaveText('星域 1/1');

    // 单击已有星点清除，数量回退
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

    // 双击放置第一个星点
    await first.dblclick();
    await expect(page.locator('[data-testid="star-line-rule-row"]')).toHaveText('行 1/2');
    await expect(page.locator('[data-testid="star-line-rule-col"]')).toHaveText('列 1/2');
    await expect(page.locator('[data-testid="star-line-rule-region"]')).toHaveText('星域 1/2');

    // 双击放置第二个星点
    await second.dblclick();
    await expect(page.locator('[data-testid="star-line-rule-row"]')).toHaveText('行 2/2');
    await expect(page.locator('[data-testid="star-line-rule-col"]')).toHaveText('列 1/2');
    await expect(page.locator('[data-testid="star-line-rule-region"]')).toHaveText('星域 1/2');

    // 第三个星点导致同行冲突
    await third.dblclick();
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

    await page.locator('[data-testid="star-line-cell-2"]').dblclick();
    await page.locator('[data-testid="star-line-cell-3"]').dblclick();

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

  test('单击 X、双击星和单击清除可直接交互', async ({ page }) => {
    await page.locator(S.puzzleBook.anyTile).first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    // 双击第一格放星
    const c0 = page.locator('[data-testid="star-line-cell-0"]');
    await c0.dblclick();
    await expect(page.locator('[data-testid="star-line-star-0"]')).toBeVisible();

    // 单击第二格放 X
    const c1 = page.locator('[data-testid="star-line-cell-1"]');
    await c1.click();
    await expect(page.locator('[data-testid="star-line-x-1"]')).toBeVisible();

    // 单击已有标记直接清除
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
    await page.locator('[data-testid="star-line-cell-0"]').dblclick();
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
    await page.locator('[data-testid="star-line-cell-0"]').dblclick();
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
      await page.locator(`[data-testid="star-line-cell-${idx}"]`).dblclick();
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

  test('新增单星 Lv.21: 解锁 → 进入 → 保存恢复 → 完成 → 下一关 Lv.22', async ({ page }) => {
    // ── 1. 构造旧20关全完成 + 新关解锁 ──
    await page.evaluate(() => {
      const completed = {};
      // 旧 20 个单星关
      for (let i = 1; i <= 20; i++) completed[`star-lv-${String(i).padStart(2, '0')}`] = 3;
      localStorage.setItem('cg_star_line_progress_v2', JSON.stringify({
        version: 1,
        games: {
          starSingle: { completed, unlockedThroughId: 'star-lv-31' },
          starDouble: { completed: {}, unlockedThroughId: 'star-lv-21' },
        },
      }));
    });
    await goToStarLineLevels(page);

    // ── 2. 单星总数 30，Lv.21 可进入 ──
    const cta = page.locator(S.puzzleBook.cta);
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('data-mode', 'starSingle');
    // Level tile for Lv.21 (0-based index 20, key = easy-20)
    const lv21Tile = page.locator('[data-testid="level-tile-easy-20"]');
    // Expand basic chapter if needed
    if (!(await lv21Tile.isVisible().catch(() => false))) {
      const toggle = page.locator(S.puzzleBook.chapterToggle('star-single-basic'));
      if (await toggle.count()) await toggle.click();
    }
    await expect(lv21Tile).toBeVisible({ timeout: 5000 });
    await lv21Tile.click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible({ timeout: 8000 });

    // ── 3. 棋盘为 10×10，100 格 ──
    const cells = page.locator('[data-testid^="star-line-cell-"]');
    await expect(cells.first()).toBeVisible();
    const cellCount = await cells.count();
    expect(cellCount).toBe(100);

    // ── 4. 单星规则（quota=1）──
    // 放置第一颗星，规则反馈显示 1/1
    const firstStar = 6;
    await page.locator(`[data-testid="star-line-cell-${firstStar}"]`).dblclick();
    await expect(page.locator(`[data-testid="star-line-star-${firstStar}"]`)).toBeVisible();
    await expect(page.locator('[data-testid="star-line-rule-row"]')).toContainText('1/1');

    // 再放第二颗星
    const secondStar = 13;
    await page.locator(`[data-testid="star-line-cell-${secondStar}"]`).dblclick();
    await expect(page.locator(`[data-testid="star-line-star-${secondStar}"]`)).toBeVisible();

    // ── 5. 保存并退出 ──
    await page.locator(S.game.backButton).click();
    await expect(page.locator(S.exitPrompt.panel)).toBeVisible({ timeout: 3000 });
    await page.locator(S.exitPrompt.saveAndExit).click();
    await expect(page.locator(S.puzzleBook.title)).toBeVisible({ timeout: 5000 });

    // 验证保存数据对应 star-lv-31 (levelIdx=20 in starSingle list)
    const savedData = await page.evaluate(() => {
      const raw = localStorage.getItem('cg_star_line_single_saved_game');
      return raw ? JSON.parse(raw) : null;
    });
    expect(savedData).not.toBeNull();
    expect(savedData.playMode).toBe('starSingle');
    expect(savedData.diff).toBe('easy');
    // star-lv-31 is at index 20 in the starSingle filtered list (0-based)
    expect(savedData.levelIdx).toBe(20);

    // ── 6. 重新进入，恢复中间状态 ──
    await goToStarLineLevels(page);
    const lv21Again = page.locator('[data-testid="level-tile-easy-20"]');
    if (!(await lv21Again.isVisible().catch(() => false))) {
      const toggle = page.locator(S.puzzleBook.chapterToggle('star-single-basic'));
      if (await toggle.count()) await toggle.click();
    }
    await expect(lv21Again).toBeVisible({ timeout: 5000 });
    await lv21Again.click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible({ timeout: 8000 });

    // 确认之前的星点被恢复
    await expect(page.locator(`[data-testid="star-line-star-${firstStar}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="star-line-star-${secondStar}"]`)).toBeVisible();

    // ── 7. 补齐剩余星点完成 star-lv-31 ──
    // solution: [6,13,27,39,42,58,65,71,84,90]
    // 已放置: 6, 13 — 补放剩余的
    const remaining = [27,39,42,58,65,71,84,90];
    for (const idx of remaining) {
      await page.locator(`[data-testid="star-line-cell-${idx}"]`).dblclick();
      await expect(page.locator(`[data-testid="star-line-star-${idx}"]`)).toBeVisible();
    }

    // 完成动画
    await expect(page.locator('[data-testid="star-line-board-container"]')).toHaveClass(/is-complete/);
    // 胜利面板
    await expect(page.locator(S.win.panel)).toBeVisible({ timeout: 3000 });
    await expect(page.locator(S.win.panel)).toContainText('星线完成');

    // ── 9. 验证 progress 记录 star-lv-31，不包含 star-lv-32 ──
    const progress = await page.evaluate(() => {
      const raw = localStorage.getItem('cg_star_line_progress_v2');
      return raw ? JSON.parse(raw) : null;
    });
    expect(progress.games.starSingle.completed['star-lv-31']).toBeGreaterThan(0);
    expect(progress.games.starSingle.completed['star-lv-32']).toBeUndefined();

    // ── 10. 下一关进入 star-lv-32（玩家 Lv.22） ──
    await expect(page.locator(S.win.nextButton)).toBeVisible();
    await page.locator(S.win.nextButton).click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible({ timeout: 8000 });

    // 棋盘仍为 100 格（10×10）
    const cells2 = page.locator('[data-testid^="star-line-cell-"]');
    const cellCount2 = await cells2.count();
    expect(cellCount2).toBe(100);

    // ── 11. 双星进度不受影响 ──
    const dblProgress = await page.evaluate(() => {
      const raw = localStorage.getItem('cg_star_line_progress_v2');
      const p = raw ? JSON.parse(raw) : null;
      return p?.games?.starDouble?.completed || {};
    });
    expect(Object.keys(dblProgress).length).toBe(0);

    // ── 12. 未错误完成 star-lv-32 ──
    const finalProgress = await page.evaluate(() => {
      const raw = localStorage.getItem('cg_star_line_progress_v2');
      return raw ? JSON.parse(raw) : null;
    });
    expect(finalProgress.games.starSingle.completed['star-lv-32']).toBeUndefined();
  });

  test('单星后段边界：Lv.40→41、Lv.50→51、Lv.59→60 与终关无下一关', async ({ page }) => {
    async function setSingleProgressThrough(lastInternalId, unlockedThroughId) {
      await page.evaluate(({ lastInternalId: lastId, unlockedId }) => {
        const completed = { 'star-lv-21': 3 };
        for (let i = 1; i <= 20; i++) completed[`star-lv-${String(i).padStart(2, '0')}`] = 3;
        for (let i = 31; i <= Number(lastId.slice(-2)); i++) completed[`star-lv-${String(i).padStart(2, '0')}`] = 3;
        delete completed[lastId];
        localStorage.setItem('cg_star_line_progress_v2', JSON.stringify({
          version: 1,
          games: {
            starSingle: { completed, unlockedThroughId: unlockedId },
            starDouble: { completed: { 'star-lv-21': 3 }, unlockedThroughId: 'star-lv-21' },
          },
        }));
      }, { lastInternalId, unlockedId: unlockedThroughId });
    }

    async function completeSolution(solution) {
      for (const cell of solution) {
        await page.locator(`[data-testid="star-line-cell-${cell}"]`).dblclick();
        await expect(page.locator(`[data-testid="star-line-star-${cell}"]`)).toBeVisible();
      }
      await expect(page.locator('[data-testid="star-line-board-container"]')).toHaveClass(/is-complete/);
      await expect(page.locator(S.win.panel)).toBeVisible({ timeout: 3000 });
    }

    // 玩家 Lv.40 (internal star-lv-50) 完成后进入玩家 Lv.41 (star-lv-51)。
    await setSingleProgressThrough('star-lv-50', 'star-lv-50');
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-39' });
    await completeSolution([7,13,28,36,42,59,65,71,84,90]);
    await page.locator(S.win.nextButton).click();
    await expect(page.locator(S.game.modeLabel)).toContainText(/第\s*41\s*关/);
    let progress = await page.evaluate(() => JSON.parse(localStorage.getItem('cg_star_line_progress_v2')));
    expect(progress.games.starSingle.completed['star-lv-50']).toBeGreaterThan(0);
    expect(progress.games.starSingle.unlockedThroughId).toBe('star-lv-51');
    expect(progress.games.starDouble.completed['star-lv-21']).toBe(3);

    // 玩家 Lv.50 (star-lv-60) 完成后进入玩家 Lv.51 (star-lv-61)。
    await setSingleProgressThrough('star-lv-60', 'star-lv-60');
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-49' });
    await completeSolution([3,15,22,30,46,58,64,71,87,99]);
    await page.locator(S.win.nextButton).click();
    await expect(page.locator(S.game.modeLabel)).toContainText(/第\s*51\s*关/);
    progress = await page.evaluate(() => JSON.parse(localStorage.getItem('cg_star_line_progress_v2')));
    expect(progress.games.starSingle.completed['star-lv-60']).toBeGreaterThan(0);
    expect(progress.games.starSingle.unlockedThroughId).toBe('star-lv-61');
    expect(progress.games.starDouble.completed['star-lv-21']).toBe(3);

    // 玩家 Lv.59 (star-lv-69) 完成后进入 Lv.60，并在终关后停在单星完成状态。
    await setSingleProgressThrough('star-lv-69', 'star-lv-69');
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-58' });
    await completeSolution([2,10,25,38,41,53,69,77,84,96]);
    await page.locator(S.win.nextButton).click();
    await expect(page.locator(S.game.modeLabel)).toContainText(/第\s*60\s*关/);
    await completeSolution(getStarLineLevelByMode('starSingle', 59).solution);
    await expect(page.locator(S.win.nextButton)).toHaveCount(0);
    await expect(page.locator(S.win.backButton)).toBeVisible();
    progress = await page.evaluate(() => JSON.parse(localStorage.getItem('cg_star_line_progress_v2')));
    expect(progress.games.starSingle.completed['star-lv-70']).toBeGreaterThan(0);
    expect(progress.games.starSingle.unlockedThroughId).toBe('star-lv-70');
    expect(progress.games.starSingle.completed['star-lv-71']).toBeUndefined();
    expect(progress.games.starDouble.completed['star-lv-21']).toBe(3);
  });
});
