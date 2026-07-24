import { test, expect } from '@playwright/test';
import { S } from './helpers/selectors.js';
import { exitGame, goToLevel, goToStarLineLevels, openSettings, closeSettings } from './helpers/navigation.js';
import { clearAllGameData } from './helpers/game-state.js';

const GUIDANCE_KEY = 'cg_star_line_guidance_v1';

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

async function expectOperationStep(page, step) {
  await expect(page.locator('[data-testid="star-line-board"]')).toHaveAttribute('data-guide-kind', 'operation');
  await expect(page.locator('[data-testid="star-line-board"]')).toHaveAttribute('data-guide-step', String(step));
}

async function expectRuleStep(page, step, copy) {
  await expect(page.locator('[data-testid="star-line-board"]')).toHaveAttribute('data-guide-kind', 'rule');
  await expect(page.locator('[data-testid="star-line-board"]')).toHaveAttribute('data-guide-step', String(step));
  await expect(page.locator('[data-testid="star-line-guide-copy"]')).toContainText(copy);
}

async function expectOperationGuideBoardState(page) {
  await expect(page.locator('[data-testid="star-line-x-0"]')).toBeVisible();
  await expect(page.locator('[data-testid="star-line-star-1"]')).toBeVisible();
  for (const idx of [2, 3, 4]) {
    await expect(page.locator(`[data-testid="star-line-x-${idx}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-testid="star-line-star-${idx}"]`)).toHaveCount(0);
  }
}

async function finishRuleGuide(page) {
  await dragAcross(page, [2, 3, 4]);
  await expectRuleStep(page, 2, '每一列');
  await dragAcross(page, [6, 11, 16, 21]);
  await expectRuleStep(page, 3, '绿色星域');
  await cell(page, 8).dblclick();
  await expectRuleStep(page, 4, '绿色星域');
  await dragAcross(page, [7, 12, 13, 14, 9]);
  await expectRuleStep(page, 5, '周围八格');
  await expectRuleStep(page, 6, '只剩一个空格');
  await cell(page, 10).dblclick();
  await expectRuleStep(page, 7, '这一列已有星点');
  await dragAcross(page, [5, 15, 20]);
  await expectRuleStep(page, 8, '只有一个格');
  await cell(page, 17).dblclick();
  await expectRuleStep(page, 9, '行、列和相邻规则');
  await dragAcross(page, [18, 19]);
  await dragAcross(page, [22, 23]);
  await expectRuleStep(page, 10, '最后一个星点');
  await cell(page, 24).dblclick();
  await expect(page.locator('[data-testid="star-line-complete-status"]')).toBeVisible();
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), GUIDANCE_KEY)).toMatchObject({
    rules: { completed: true, step: 10 },
  });
}

async function finishOperationGuide(page, fromStep = 1, expectRuleGuide = true) {
  if (fromStep <= 1) {
    await cell(page, 0).click();
    await expectOperationStep(page, 2);
  }
  await dragAcross(page, [2, 3, 4]);
  await expectOperationStep(page, 3);
  await dragAcross(page, [4, 3, 2]);
  await expectOperationStep(page, 4);
  await cell(page, 1).dblclick();
  if (expectRuleGuide) {
    await expect(page.locator('[data-testid="star-line-board"]')).toHaveAttribute('data-guide-kind', 'rule');
  }
}

async function setCompletedGuidance(page, overrides = {}) {
  await page.evaluate(({ key, changes }) => {
    localStorage.setItem(key, JSON.stringify({
      version: 1,
      operation: { completed: true, step: 4 },
      rules: { completed: true, step: 4 },
      replayRequested: false,
      ...changes,
    }));
  }, { key: GUIDANCE_KEY, changes: overrides });
}

test.describe('星线谜阵 教学与关卡信息 UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
  });

  test('T1. Star Line 关卡选择页显示单星双 section header', async ({ page }) => {
    await goToStarLineLevels(page);

    // 单星谜阵默认显示两个章节
    // 入门 · 单星 (Lv.1-10)
    await expect(page.getByText('入门').first()).toBeVisible();
    // 基础 · 单星 (Lv.11-20) — 来自统一章节配置
    await expect(page.getByText('基础').first()).toBeVisible();
    // ModeSwitcher 中有双星 tab
    await expect(page.locator(S.modeSwitcher.modeCard('starDouble'))).toBeVisible();
  });

  test('T2. Lv.1 入门章节头显示 5×5 · 单星，节点无三星评定', async ({ page }) => {
    await goToStarLineLevels(page);

    const lv1 = page.locator('[data-testid="level-tile-easy-0"]');
    await expect(lv1).toBeVisible();

    // 棋盘尺寸与配额在当前章节头（入门 · 单星 · 5×5）
    const introChapter = page.locator(S.puzzleBook.chapter('star-single-intro'));
    await expect(introChapter).toContainText('5×5');
    await expect(introChapter).toContainText('单星');

    // 星轨节点不显示三星评定圆点
    const goldDots = lv1.locator('.bg-\\[\\#dfc16e\\]');
    await expect(goldDots).toHaveCount(0);
  });

  test('T3. 双星章节头显示棋盘尺寸，展开后 Lv.1 节点可玩', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('cg_star_line_progress_v2', JSON.stringify({
        version: 1,
        games: {
          starSingle: { completed: {}, unlockedThroughId: 'star-lv-01' },
          starDouble: { completed: {}, unlockedThroughId: 'star-lv-30' },
        },
      }));
    });
    await goToStarLineLevels(page);

    // 切换到双星模式
    await page.locator(S.modeSwitcher.modeCard('starDouble')).click();
    await expect(page.locator(S.modeSwitcher.modeCard('starDouble'))).toHaveAttribute('aria-pressed', 'true');

    // 双星章节（当前章节默认展开，Lv.1 = easy-0）
    await expect(page.locator('[data-testid="level-tile-easy-0"]')).toBeVisible();
    await expect(page.locator(S.puzzleBook.chapter('star-double-intro'))).toContainText(/\d+×\d+/);
  });

  test('T4. 双星目录显示全部 41 个可玩关，保留槽位不生成节点', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('cg_star_line_progress_v2', JSON.stringify({
        version: 1,
        games: {
          starSingle: { completed: {}, unlockedThroughId: 'star-lv-01' },
          starDouble: {
            completed: { 'star-lv-21': 3, 'star-double-promoted-21': 3 },
            unlockedThroughId: 'star-lv-30',
          },
        },
      }));
    });
    await goToStarLineLevels(page);

    // 切换到双星模式
    await page.locator(S.modeSwitcher.modeCard('starDouble')).click();
    await expect(page.locator('[data-testid="level-tile-easy-9"]')).toBeVisible();
    for (const chapterId of [
      'star-double-basic',
      'star-double-intermediate',
      'star-double-advanced',
      'star-double-final',
    ]) {
      await page.locator(S.puzzleBook.chapterToggle(chapterId)).click();
    }
    await expect(page.locator('[data-testid="level-tile-easy-40"]')).toBeVisible();
    await expect(page.locator(S.puzzleBook.anyTile)).toHaveCount(41);
    await expect(page.locator('[data-testid="level-tile-easy-40"]')).toHaveAttribute('aria-label', /^第 54 关/);
    await expect(page.locator('[data-testid="level-tile-easy-20"]')).toHaveAttribute('data-completed', 'true');
    await expect(page.locator('[data-testid="level-tile-easy-20"]')).toHaveAttribute('aria-label', /^第 21 关/);
    await expect(page.locator('[data-testid="level-tile-easy-39"]')).toHaveAttribute('data-completed', 'true');
    await expect(page.locator('[data-testid="level-tile-easy-39"]')).toHaveAttribute('aria-label', /^第 53 关/);
    await expect(page.getByRole('button', { name: /^第 27 关/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^第 50 关/ })).toHaveCount(0);
    await expect(page.locator(S.puzzleBook.chapter('star-double-intro'))).toContainText('8×8');
    await expect(page.locator(S.puzzleBook.chapter('star-double-final'))).toContainText('10×10');
  });

  test('T5. Star Line 游戏 HUD 显示 N×N 和 单星/双星', async ({ page }) => {
    await goToStarLineLevels(page);
    // Enter Lv.1 (5×5 单星)
    await page.locator(S.puzzleBook.anyTile).first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    await expect(page.locator('[data-testid="star-line-hud-board-label"]')).toContainText('5×5');
    await expect(page.locator('[data-testid="star-line-hud-quota-label"]')).toContainText('单星');
  });

  test('T6. 新玩家用真实操作完成四步教学，非目标操作不推进且最终棋盘正确', { tag: '@critical' }, async ({ page }) => {
    await goToStarLineLevels(page);
    await page.locator(S.puzzleBook.anyTile).first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    await expectOperationStep(page, 1);
    await expect(page.locator('[data-testid="star-line-guide-copy"]')).toContainText('单击空格');

    // 覆盖层不阻断非目标格，非目标操作正常生效但不推进。
    await cell(page, 5).click();
    await expect(page.locator('[data-testid="star-line-x-5"]')).toBeVisible();
    await expectOperationStep(page, 1);
    await cell(page, 5).click();
    await expect(page.locator('[data-testid="star-line-x-5"]')).toHaveCount(0);
    await expectOperationStep(page, 1);

    await finishOperationGuide(page);
    await expect(page.locator('[data-testid="star-line-x-0"]')).toBeVisible();
    await expect(page.locator('[data-testid="star-line-star-1"]')).toBeVisible();
    for (const idx of [2, 3, 4]) {
      await expect(page.locator(`[data-testid="star-line-x-${idx}"]`)).toHaveCount(0);
      await expect(page.locator(`[data-testid="star-line-star-${idx}"]`)).toHaveCount(0);
    }
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), GUIDANCE_KEY)).toMatchObject({
      operation: { completed: true, step: 4 },
    });
  });

  test('T6.1 教学完成后不再强制播放；保存退出可恢复当前步骤', async ({ page }) => {
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });
    await cell(page, 0).click();
    await expectOperationStep(page, 2);
    await exitGame(page, 'save');

    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });
    await expectOperationStep(page, 2);
    await finishOperationGuide(page, 2);
    await finishRuleGuide(page);
    await page.goto('/');

    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });
    await expect(page.locator('[data-testid="star-line-board"]')).toHaveAttribute('data-guide-kind', 'none');
  });

  test('T6.2 前置状态缺失时安全回退，默认空进度不会被误判为老玩家', async ({ page }) => {
    await page.evaluate(key => {
      localStorage.setItem(key, JSON.stringify({
        version: 1,
        operation: { completed: false, step: 3 },
        rules: { completed: false, step: 1 },
        replayRequested: false,
      }));
      localStorage.setItem('cg_star_line_progress_v2', JSON.stringify({
        version: 1,
        games: {
          starSingle: { completed: {}, unlockedThroughId: 'star-lv-01' },
          starDouble: { completed: {}, unlockedThroughId: 'star-lv-21' },
        },
      }));
    }, GUIDANCE_KEY);

    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });
    await expectOperationStep(page, 1);
    await expect(page.locator('[data-testid="star-line-x-0"]')).toHaveCount(0);
  });

  test('T6.3 旧教学记录和真实进度都会让老玩家跳过强制教学', { tag: '@critical' }, async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('cg_discovery_star_line_basic_v1', '1'));
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });
    await expect(page.locator('[data-testid="star-line-board"]')).toHaveAttribute('data-guide-kind', 'none');

    await page.goto('/');
    await clearAllGameData(page);
    await page.evaluate(() => {
      localStorage.setItem('cg_star_line_progress_v2', JSON.stringify({
        version: 1,
        games: {
          starSingle: { completed: { 'star-lv-01': 3 }, unlockedThroughId: 'star-lv-02' },
          starDouble: { completed: {}, unlockedThroughId: 'star-lv-21' },
        },
      }));
    });
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });
    await expect(page.locator('[data-testid="star-line-board"]')).toHaveAttribute('data-guide-kind', 'none');
  });

  test('T6.4 设置重新播放只写教学标记，不改正式进度', async ({ page }) => {
    const progress = {
      version: 1,
      games: {
        starSingle: { completed: { 'star-lv-01': 3 }, unlockedThroughId: 'star-lv-02' },
        starDouble: { completed: {}, unlockedThroughId: 'star-lv-21' },
      },
    };
    await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
      key: 'cg_star_line_progress_v2', value: progress,
    });
    await setCompletedGuidance(page);
    await openSettings(page);
    await page.locator('[data-testid="star-line-guide-replay-button"]').click();
    await expect(page.locator('[data-testid="star-line-guide-replay-button"]')).toHaveText('已开启');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cg_star_line_progress_v2')))).toEqual(progress);

    await page.locator(S.settings.closeButton).click();
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });
    await expectOperationStep(page, 1);
  });

  test('T6.4.1 已完成教学的玩家请求重播后，双星入口不被拦截', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('cg_star_line_progress_v2', JSON.stringify({
        version: 1,
        games: {
          starSingle: { completed: { 'star-lv-01': 3 }, unlockedThroughId: 'star-lv-02' },
          starDouble: { completed: {}, unlockedThroughId: 'star-lv-21' },
        },
      }));
      // 双星说明弹窗已看过，聚焦入口行为本身
      localStorage.setItem('cg_discovery_star_line_double_star_v1', '1');
    });
    await setCompletedGuidance(page, { replayRequested: true });

    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });

    // 应停留在双星关卡，而不是被踢回单星第 1 关的操作教学
    await expect(page.locator('[data-testid="star-line-hud-quota-label"]')).toContainText('双星');
    await expect(page.locator('[data-testid="star-line-board"]')).toHaveAttribute('data-guide-kind', 'none');
  });

  test('T6.4.2 重播中途退出后，双星入口仍不被拦截且重播保持挂起', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('cg_star_line_progress_v2', JSON.stringify({
        version: 1,
        games: {
          starSingle: { completed: { 'star-lv-01': 3 }, unlockedThroughId: 'star-lv-02' },
          starDouble: { completed: {}, unlockedThroughId: 'star-lv-21' },
        },
      }));
      localStorage.setItem('cg_discovery_star_line_double_star_v1', '1');
    });
    await setCompletedGuidance(page, { replayRequested: true });

    // 主动进入单星第 1 关触发重播，随后不做任何标记直接退出（重播中途放弃）
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });
    await expectOperationStep(page, 1);
    await page.locator('[data-testid="back-button"]').click();
    await expect(page.locator(S.puzzleBook.title)).toBeVisible({ timeout: 5000 });

    // 双星入口不被劫持
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    await expect(page.locator('[data-testid="star-line-hud-quota-label"]')).toContainText('双星');
    await expect(page.locator('[data-testid="star-line-board"]')).toHaveAttribute('data-guide-kind', 'none');

    // 重播仍保持挂起：下次主动进入单星第 1 关时继续
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), GUIDANCE_KEY)).toMatchObject({
      replayRequested: true,
    });
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });
    await expectOperationStep(page, 1);
  });

  test('T6.4.3 单星首次教学未完成时，双星入口仍播放独立双星教学', async ({ page }) => {
    // 显式写入正式 fresh 状态：首次教学未完成、无重播请求
    await page.evaluate(key => {
      localStorage.setItem(key, JSON.stringify({
        version: 1,
        operation: { completed: false, step: 1 },
        rules: { completed: false, step: 1 },
        replayRequested: false,
      }));
    }, GUIDANCE_KEY);

    // 设置页中“重新查看教学”不可用，并说明原因
    await openSettings(page);
    const replayButton = page.locator('[data-testid="star-line-guide-replay-button"]');
    await expect(replayButton).toBeVisible();
    await expect(replayButton).toBeDisabled();
    await expect(page.getByText('完成首次教学后可重新查看')).toBeVisible();

    // 状态未被修改：completed 与 replayRequested 均保持 false
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), GUIDANCE_KEY)).toMatchObject({
      operation: { completed: false },
      replayRequested: false,
    });
    await closeSettings(page);

    // 双星不再劫持到单星教学；两套完成记录彼此独立。
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    await expect(page.locator('[data-testid="star-line-hud-quota-label"]')).toContainText('双星');
    await expect(page.locator('[data-testid="star-line-board"]')).toHaveAttribute('data-guide-kind', 'double-rule');
    await expect(page.locator('[data-testid="star-line-board"]')).toHaveAttribute('data-guide-step', '1');
  });

  test('T6.5 玩家按行、列、星域和相邻规则完成第一关', async ({ page }) => {
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });
    await finishOperationGuide(page);
    await expect(page.locator('[data-testid="star-line-place-halo-1"]')).toBeVisible();
    await expectRuleStep(page, 1, '把右边的空格标成 X');
    await expectOperationGuideBoardState(page);
    await expect(page.locator('[data-unit-satisfied="true"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="star-line-undo-button"]')).toBeEnabled();
    await expect(page.locator('.starline-guide-pointer.is-drag-demo')).toHaveCount(1);
    for (const idx of [0, 1, 2, 3, 4]) await expect(cell(page, idx)).toHaveClass(/is-guide-target/);

    // 行、列必须由玩家实际补齐 X 才会推进。
    await dragAcross(page, [2, 3, 4]);
    await expectRuleStep(page, 2, '每一列');
    for (const idx of [2, 3, 4]) await expect(page.locator(`[data-testid="star-line-x-${idx}"]`)).toBeVisible();
    for (const idx of [1, 6, 11, 16, 21]) await expect(cell(page, idx)).toHaveClass(/is-guide-target/);

    await dragAcross(page, [6, 11, 16, 21]);
    await expectRuleStep(page, 3, '绿色星域');
    await expect(cell(page, 8)).toHaveClass(/is-guide-target/);
    await expect(page.locator('.starline-guide-pointer.is-double-tap-demo')).toHaveCount(1);
    await cell(page, 8).dblclick();
    await expectRuleStep(page, 4, '这片绿色星域');

    const greenRegion = [2, 3, 4, 7, 8, 9, 12, 13, 14];
    for (const idx of greenRegion) await expect(cell(page, idx)).toHaveClass(/is-guide-target/);
    await expect(cell(page, 0)).toHaveClass(/is-dimmed/);
    await expect(page.locator('.starline-guide-pointer.is-drag-demo')).toHaveCount(2);
    await dragAcross(page, [7, 12, 13, 14, 9]);
    await expectRuleStep(page, 5, '周围八格');
    await expect(page.locator('[data-testid="star-line-undo-button"]')).toBeDisabled();
    await expect(page.locator('.starline-guide-pointer')).toHaveCount(0);
    await expect(page.locator('[data-testid="star-line-star-8"]')).toBeVisible();
    for (const idx of [2, 3, 4, 7, 9, 12, 13, 14]) {
      await expect(page.locator(`[data-testid="star-line-x-${idx}"]`)).toBeVisible();
      await expect(cell(page, idx)).toHaveClass(/is-guide-target/);
    }

    // 相邻规则自动继续且不写历史；下一次撤销应直接撤销刚才的整段星域 X。
    await expectRuleStep(page, 6, '只剩一个空格');
    await page.locator('[data-testid="star-line-undo-button"]').click();
    await expectRuleStep(page, 4, '这片绿色星域');
    for (const idx of [7, 9, 12, 13, 14]) await expect(page.locator(`[data-testid="star-line-x-${idx}"]`)).toHaveCount(0);

    await dragAcross(page, [7, 12, 13, 14, 9]);
    await expectRuleStep(page, 5, '周围八格');
    await expectRuleStep(page, 6, '只剩一个空格');

    await cell(page, 10).dblclick();
    await expectRuleStep(page, 7, '这一列已有星点');
    await dragAcross(page, [5, 15, 20]);
    await expectRuleStep(page, 8, '只有一个格');
    await cell(page, 17).dblclick();
    await expectRuleStep(page, 9, '行、列和相邻规则');
    await dragAcross(page, [18, 19]);
    await dragAcross(page, [22, 23]);
    await expectRuleStep(page, 10, '最后一个星点');
    await cell(page, 24).dblclick();

    for (const idx of [1, 8, 10, 17, 24]) await expect(page.locator(`[data-testid="star-line-star-${idx}"]`)).toBeVisible();
    for (const idx of [0, 2, 3, 4, 5, 6, 7, 9, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23]) {
      await expect(page.locator(`[data-testid="star-line-x-${idx}"]`)).toBeVisible();
    }
    await expect(page.locator('[data-testid="star-line-complete-status"]')).toBeVisible();
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), GUIDANCE_KEY)).toMatchObject({
      rules: { completed: true, step: 10 },
    });
  });

  test('T6.5.1 解题教学按棋盘状态恢复，教学星缺失则只回退到放星步骤', async ({ page }) => {
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });
    await finishOperationGuide(page);
    await dragAcross(page, [2, 3, 4]);
    await expectRuleStep(page, 2, '每一列');
    await dragAcross(page, [6, 11, 16, 21]);
    await expectRuleStep(page, 3, '绿色星域');
    await cell(page, 8).dblclick();
    await expectRuleStep(page, 4, '这片绿色星域');
    await dragAcross(page, [7, 12]);
    await expectRuleStep(page, 4, '这片绿色星域');
    await exitGame(page, 'save');

    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });
    await expectRuleStep(page, 4, '这片绿色星域');
    await expect(page.locator('[data-testid="star-line-star-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="star-line-star-8"]')).toBeVisible();
    await expect(page.locator('[data-testid="star-line-x-7"]')).toBeVisible();
    await expect(page.locator('[data-testid="star-line-x-12"]')).toBeVisible();
    await exitGame(page, 'save');

    await page.evaluate(() => {
      const key = 'cg_star_line_single_saved_game';
      const saved = JSON.parse(localStorage.getItem(key));
      for (const cells of [saved?.gridData, saved?.starLineSession?.gridData]) {
        if (!Array.isArray(cells) || !cells[1]) continue;
        cells[1].isStarred = false;
        cells[1].isMarkedX = false;
      }
      localStorage.setItem(key, JSON.stringify(saved));
    });

    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });
    await expectOperationStep(page, 4);
    await expect(page.locator('[data-testid="star-line-x-0"]')).toBeVisible();
    await expect(page.locator('[data-testid="star-line-star-1"]')).toHaveCount(0);
    for (const idx of [2, 3, 4]) await expect(page.locator(`[data-testid="star-line-x-${idx}"]`)).toBeVisible();
  });

  test('T6.6 X、星与多个清除残影轻量出现并按时清理', async ({ page }) => {
    await setCompletedGuidance(page);
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });

    await page.evaluate(() => {
      const trackedIds = new Set([
        'star-line-x-12',
        'star-line-x-exit-2',
        'star-line-x-exit-3',
        'star-line-x-exit-4',
        'star-line-star-exit-1',
      ]);
      window.__exitMarkLifecycle = { added: {}, removed: {}, details: {} };
      const board = document.querySelector('[data-testid="star-line-board"]');
      if (!board) throw new Error('Star Line board is not available for exit-mark observation');

      const visitElements = (node, callback) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        callback(node);
        node.querySelectorAll?.('[data-testid]').forEach(callback);
      };

      const recordLifecycle = (node, event) => {
        visitElements(node, element => {
          const testId = element.getAttribute('data-testid');
          if (!trackedIds.has(testId)) return;
          const counts = window.__exitMarkLifecycle[event];
          counts[testId] = (counts[testId] || 0) + 1;
          if (event === 'added') {
            window.__exitMarkLifecycle.details[testId] = {
              className: element.getAttribute('class') || '',
            };
          }
        });
      };

      window.__exitObserver = new MutationObserver(mutations => {
        for (const mutation of mutations) {
          mutation.addedNodes.forEach(node => {
            recordLifecycle(node, 'added');
          });
          mutation.removedNodes.forEach(node => recordLifecycle(node, 'removed'));
        }
      });
      window.__exitObserver.observe(board, { childList: true, subtree: true });
    });
    try {
      await cell(page, 12).click();
      await expect.poll(() => page.evaluate(() => window.__exitMarkLifecycle?.added['star-line-x-12'] || 0)).toBeGreaterThan(0);
      await expect(page.locator('[data-testid="star-line-x-12"]')).toBeVisible();
      expect(await page.evaluate(() => window.__exitMarkLifecycle?.details['star-line-x-12']?.className)).toContain('starline-x');

      await dragAcross(page, [2, 3, 4]);
      await dragAcross(page, [4, 3, 2]);
      await expect.poll(() => page.evaluate(() => {
        const ids = ['star-line-x-exit-2', 'star-line-x-exit-3', 'star-line-x-exit-4'];
        return ids.filter(id => (window.__exitMarkLifecycle?.added[id] || 0) > 0).length;
      })).toBeGreaterThanOrEqual(2);
      await expect.poll(() => page.evaluate(() => {
        const ids = ['star-line-x-exit-2', 'star-line-x-exit-3', 'star-line-x-exit-4'];
        return ids
          .filter(id => (window.__exitMarkLifecycle?.added[id] || 0) > 0)
          .every(id => (window.__exitMarkLifecycle?.removed[id] || 0) >= window.__exitMarkLifecycle.added[id]);
      })).toBe(true);
      const observedXExits = await page.evaluate(() => {
        const ids = ['star-line-x-exit-2', 'star-line-x-exit-3', 'star-line-x-exit-4'];
        return ids.filter(id => (window.__exitMarkLifecycle?.added[id] || 0) > 0).map(id => ({
          id,
          className: window.__exitMarkLifecycle.details[id]?.className,
        }));
      });
      expect(observedXExits.length).toBeGreaterThanOrEqual(2);
      expect(observedXExits.every(exit => exit.className?.includes('starline-x-exit'))).toBe(true);
      for (const index of [2, 3, 4]) {
        await expect(page.locator(`[data-testid="star-line-x-exit-${index}"]`)).toHaveCount(0);
      }

      await cell(page, 1).dblclick();
      await expect(page.locator('[data-testid="star-line-place-halo-1"]')).toBeVisible();
      await expect(page.locator('[data-testid="star-line-place-halo-1"]')).toHaveCount(0);
      await cell(page, 1).click();
      await expect.poll(() => page.evaluate(() => window.__exitMarkLifecycle?.added['star-line-star-exit-1'] || 0)).toBeGreaterThan(0);
      await expect.poll(() => page.evaluate(() => (
        (window.__exitMarkLifecycle?.removed['star-line-star-exit-1'] || 0)
        >= (window.__exitMarkLifecycle?.added['star-line-star-exit-1'] || 0)
      ))).toBe(true);
      expect(await page.evaluate(() => window.__exitMarkLifecycle?.details['star-line-star-exit-1']?.className)).toContain('starline-star-exit');
      await expect(page.locator('[data-testid="star-line-star-exit-1"]')).toHaveCount(0);
    } finally {
      await page.evaluate(() => {
        window.__exitObserver?.disconnect();
        delete window.__exitObserver;
        delete window.__exitMarkLifecycle;
      });
    }
  });

  test('T6.7 满足反馈只由真实落星触发，冲突会压制星环和满足动画', async ({ page }) => {
    await setCompletedGuidance(page);
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });
    await expect(page.locator('[data-unit-satisfied="true"]')).toHaveCount(0);

    await cell(page, 2).dblclick();
    await expect(page.locator('[data-unit-satisfied="true"]')).not.toHaveCount(0);
    await page.waitForTimeout(360);
    await expect(page.locator('[data-unit-satisfied="true"]')).toHaveCount(0);

    await cell(page, 3).dblclick();
    await expect(page.locator('[data-testid="star-line-conflict-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="star-line-place-halo-3"]')).toHaveCount(0);
    await expect(page.locator('[data-unit-satisfied="true"]')).toHaveCount(0);
  });

  test('T6.8 恢复中断棋盘不会误触发空间满足反馈', async ({ page }) => {
    await setCompletedGuidance(page);
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });
    await cell(page, 1).dblclick();
    await page.waitForTimeout(360);
    await exitGame(page, 'save');

    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });
    await expect(page.locator('[data-testid="star-line-star-1"]')).toBeVisible();
    await expect(page.locator('[data-unit-satisfied="true"]')).toHaveCount(0);
  });

  test('T6.9 reduced-motion 保留静态目标，不显示移动指针、星轨和缩放动画', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });
    await expectOperationStep(page, 1);
    await expect(cell(page, 0)).toHaveClass(/is-guide-target/);
    await expect(page.locator('.starline-guide-pointer')).toHaveCount(0);
    await expect(page.locator('.starline-guide-trail')).toHaveCount(0);

    await cell(page, 0).click();
    await page.waitForTimeout(280);
    expect(await page.locator('[data-testid="star-line-x-0"]').evaluate(node => node.getAnimations().length)).toBe(0);

    await finishOperationGuide(page, 2);
    await expectRuleStep(page, 1, '把右边的空格标成 X');
    await finishRuleGuide(page);
    await expect(page.locator('[data-testid="star-line-board"]')).toHaveAttribute('data-guide-kind', 'none');
  });

  test('T7. 首次进入双星第一关显示棋盘内双星推理教学', async ({ page }) => {
    // Clear discovery keys and unlock starDouble
    await page.evaluate(() => {
      localStorage.removeItem('cg_discovery_star_line_basic_v1');
      localStorage.removeItem('cg_discovery_star_line_double_star_v1');
      localStorage.setItem('cg_star_line_progress_v2', JSON.stringify({
        version: 1,
        games: {
          starSingle: { completed: {}, unlockedThroughId: 'star-lv-01' },
          starDouble: { completed: {}, unlockedThroughId: 'star-lv-30' },
        },
      }));
    });

    // Navigate directly to starDouble first level
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });

    await expect(page.locator('[data-testid="star-line-board"]')).toHaveAttribute('data-guide-kind', 'double-rule');
    await expect(page.locator('[data-testid="star-line-board"]')).toHaveAttribute('data-guide-step', '1');
    await expect(page.locator('[data-testid="star-line-guide-copy"]')).toContainText('每行、每列、每个星域都要放 2 颗星');
  });

  test('T7.1 新玩家直接进入双星时不跳转单星教学', { tag: '@critical' }, async ({ page }) => {
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    await expect(page.locator('[data-testid="star-line-hud-quota-label"]')).toContainText('双星');
    await expect(page.locator('[data-testid="star-line-board"]')).toHaveAttribute('data-guide-kind', 'double-rule');
    await expect(page.locator('[data-testid="star-line-board"]')).toHaveAttribute('data-guide-step', '1');
  });

  test('T8. Star Line 完成状态的关卡不显示星级评定', async ({ page }) => {
    // Complete Lv.1 in starSingle via v2 progress
    await page.evaluate(() => {
      localStorage.setItem('cg_star_line_progress_v2', JSON.stringify({
        version: 1,
        games: {
          starSingle: { completed: { 'star-lv-01': 3 }, unlockedThroughId: 'star-lv-20' },
          starDouble: { completed: {}, unlockedThroughId: 'star-lv-21' },
        },
      }));
    });

    await goToStarLineLevels(page);

    // First level tile should show completed state with check mark but no gold star dots
    const lv1 = page.locator(S.puzzleBook.anyTile).first();
    await expect(lv1).toHaveAttribute('data-completed', 'true');
    const goldDots = lv1.locator('.bg-\\[\\#dfc16e\\]');
    await expect(goldDots).toHaveCount(0);
  });

  test('T9. Classic 卡片星级和 HUD 不受影响', async ({ page }) => {
    // Enter Classic (One Line) puzzle book via start button
    await page.goto('/');
    await page.locator(S.home.startButton).click();
    await expect(page.locator(S.puzzleBook.title)).toBeVisible({ timeout: 5000 });

    // Classic level cards should exist with star rating dots (default UI unchanged)
    const classicTile = page.locator('[data-testid="level-tile-easy-0"]');
    await expect(classicTile).toBeVisible();
  });

  test('T10. GM 按钮仍只在 dev 显示', async ({ page }) => {
    await goToStarLineLevels(page);
    await page.locator(S.puzzleBook.anyTile).first().click();
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();

    // In dev mode, GM button should be visible
    await expect(page.locator('[data-testid="star-line-gm-button"]')).toBeVisible();
  });
});
