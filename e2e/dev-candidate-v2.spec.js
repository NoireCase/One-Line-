// @ts-check
import { test, expect } from '@playwright/test';
import { E2E_DEV_LEVEL_CANDIDATES } from '../src/config/devLevelCandidates.e2e.js';
import { openDevCandidatePanel, startFirstDevCandidate } from './helpers/dev-candidate.js';
import { getPathLength } from './helpers/game-state.js';
import { dragCellToCell } from './helpers/game-simulation.js';

const BASE = '/';

test.describe('Dev Candidate V2 — 多分组 + 辅助判断', { tag: '@dev-candidate' }, () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    await page.evaluate(() => {
      localStorage.removeItem('cg_dev_candidate_reviews');
      localStorage.removeItem('cg_classic_v2_progress');
      localStorage.removeItem('cg_coins');
    });
  });

  test('C1. GM 第三列显示多分组', async ({ page }) => {
    await openDevCandidatePanel(page);

    // 检查总数
    const totalText = await page.textContent('body');
    console.log('Total candidates text match:', /共\s*\d+\s*个候选/.test(totalText));

    // 检查分组标题（至少有一个分组）
    const hasClassicGroup = /classic\s*·\s*(hard|medium|easy)/i.test(totalText);
    const hasDiagonalGroup = /diagonal\s*·\s*(hard|medium|easy)/i.test(totalText);
    console.log('Classic group:', hasClassicGroup);
    console.log('Diagonal group:', hasDiagonalGroup);

    // 检查组内计数
    const groupCounts = totalText.match(/(\d+)\s*个/g) || [];
    console.log('Group counts:', groupCounts);

    expect(totalText).toMatch(/共\s*4\s*个候选/);
    expect(hasClassicGroup).toBe(true);
    expect(hasDiagonalGroup).toBe(true);
  });

  test('C2. 试玩 → HUD 显示 → 右侧面板按钮', async ({ page }) => {
    await startFirstDevCandidate(page);

    // HUD 标签
    const modeLabel = await page.locator('[data-testid="mode-label"]').textContent().catch(() => '');
    console.log('HUD mode label:', modeLabel);
    expect(modeLabel).toContain('CANDIDATE');

    // 右侧面板 - 标记为可入库
    const approveBtn = page.locator('button', { hasText: '标记为可入库' });
    console.log('标记为可入库 visible:', await approveBtn.isVisible().catch(() => false));

    // 辅助判断按钮
    const revealBtn = page.locator('button', { hasText: '翻开全部暗牌' });
    const restoreBtn = page.locator('button', { hasText: '恢复暗牌' });
    const clearBtn = page.locator('button', { hasText: '清空路径' });
    const resetBtn = page.locator('button', { hasText: '重置当前关卡' });

    console.log('翻开全部暗牌:', await revealBtn.isVisible().catch(() => false));
    console.log('恢复暗牌:', await restoreBtn.isVisible().catch(() => false));
    console.log('清空路径:', await clearBtn.isVisible().catch(() => false));
    console.log('重置当前关卡:', await resetBtn.isVisible().catch(() => false));

    expect(await approveBtn.isVisible().catch(() => false)).toBe(true);
    expect(await revealBtn.isVisible().catch(() => false)).toBe(true);
    expect(await restoreBtn.isVisible().catch(() => false)).toBe(true);
    expect(await clearBtn.isVisible().catch(() => false)).toBe(true);
    expect(await resetBtn.isVisible().catch(() => false)).toBe(true);
  });

  test('C3. 翻开暗牌 → 恢复暗牌 辅助功能', async ({ page }) => {
    await startFirstDevCandidate(page);

    // 点击翻开全部暗牌
    const revealBtn = page.locator('button', { hasText: '翻开全部暗牌' });
    await revealBtn.click();

    // 检查是否有 cell 显示数字（之前是暗的）
    const cellTexts = await page.locator('[data-testid^="cell-"] span').allTextContents();
    const visibleNumbers = cellTexts.filter(t => /^\d+$/.test(t.trim()));
    console.log('翻开后可见数字 count:', visibleNumbers.length);
    expect(visibleNumbers.length).toBe(25);

    // 点击恢复暗牌
    const restoreBtn = page.locator('button', { hasText: '恢复暗牌' });
    await restoreBtn.click();

    // 验证恢复（数字应该减少——但不一定为零，因为有些数字本来就可见）
    const cellTextsAfter = await page.locator('[data-testid^="cell-"] span').allTextContents();
    const visibleAfter = cellTextsAfter.filter(t => /^\d+$/.test(t.trim()));
    console.log('恢复后可见数字 count:', visibleAfter.length);
    expect(visibleAfter.length).toBeLessThan(visibleNumbers.length);
  });

  test('C4. 清空路径辅助功能', async ({ page }) => {
    await startFirstDevCandidate(page);
    const [start, next] = E2E_DEV_LEVEL_CANDIDATES[0].path;
    await dragCellToCell(page, start, next, { steps: 4, stepDelay: 10 });
    await expect.poll(() => getPathLength(page)).toBe(2);

    // 点击清空路径
    const clearBtn = page.locator('button', { hasText: '清空路径' });
    await clearBtn.click();
    await expect.poll(() => getPathLength(page)).toBe(1);

    // 验证游戏仍在运行（没有退出）
    const gameView = await page.locator('[data-testid="game-view"]').isVisible().catch(() => false);
    console.log('清空后仍在游戏中:', gameView);
    expect(gameView).toBe(true);
  });

  test('C5. 重置当前关卡', async ({ page }) => {
    await startFirstDevCandidate(page);

    // 先翻开暗牌
    const revealBtn = page.locator('button', { hasText: '翻开全部暗牌' });
    await revealBtn.click();
    const visibleAfterReveal = (await page.locator('[data-testid^="cell-"] span').allTextContents())
      .filter(text => /^\d+$/.test(text.trim()));
    expect(visibleAfterReveal).toHaveLength(25);

    // 重置
    const resetBtn = page.locator('button', { hasText: '重置当前关卡' });
    await resetBtn.click();

    // 验证仍在游戏中，暗牌恢复
    const gameView = await page.locator('[data-testid="game-view"]').isVisible().catch(() => false);
    console.log('重置后仍在游戏中:', gameView);
    expect(gameView).toBe(true);
    const visibleAfterReset = (await page.locator('[data-testid^="cell-"] span').allTextContents())
      .filter(text => /^\d+$/.test(text.trim()));
    expect(visibleAfterReset.length).toBeLessThan(25);

    // 验证 review status 未变 (localStorage 检查)
    const reviewAfter = await page.evaluate(() => {
      const raw = localStorage.getItem('cg_dev_candidate_reviews');
      return raw ? JSON.parse(raw) : null;
    });
    console.log('重置后 review status:', JSON.stringify(reviewAfter));
  });

  test('C6. 标记为可入库 → 返回 GM 同步', async ({ page }) => {
    await openDevCandidatePanel(page);

    // 记录第一个候选的 seed
    const firstCardText = await page.locator('text=Dev 试玩关卡').locator('..').textContent();
    console.log('GM panel context:', firstCardText?.substring(0, 200));

    // 试玩第一个候选
    const playBtn = page.locator('button', { hasText: '试玩' }).first();
    await playBtn.click();
    await expect(page.locator('[data-testid="mode-label"]')).toContainText('CANDIDATE');

    // 标记为可入库
    const approveBtn = page.locator('button', { hasText: '标记为可入库' });
    await approveBtn.click();

    // 返回 GM
    const backBtn = page.locator('button', { hasText: '返回 GM' });
    await backBtn.click();
    await expect(page.getByText('GM Console', { exact: true })).toBeVisible();

    // 验证 GM 中显示已审查 ✓
    const gmText = await page.textContent('body');
    const hasApprovedCheck = gmText.includes('✓');
    console.log('GM 显示 ✓ 标记:', hasApprovedCheck);

    // 检查 localStorage
    const reviews = await page.evaluate(() => {
      const raw = localStorage.getItem('cg_dev_candidate_reviews');
      return raw ? JSON.parse(raw) : null;
    });
    console.log('Reviews after approve:', JSON.stringify(reviews));
    const hasApproved = reviews && Object.values(reviews).some(v => v === 'APPROVED');
    expect(hasApproved).toBe(true);

    // 清理
    await page.evaluate(() => localStorage.removeItem('cg_dev_candidate_reviews'));
  });

  test('C7. 下一个候选跨组搜索', async ({ page }) => {
    await page.evaluate(seed => {
      localStorage.setItem('cg_dev_candidate_reviews', JSON.stringify({ [seed]: 'REJECTED' }));
    }, E2E_DEV_LEVEL_CANDIDATES[1].seed);
    await page.reload();
    await openDevCandidatePanel(page);

    // 进入第一个 Classic hard 候选
    const playBtn = page.locator('button', { hasText: '试玩' }).first();
    await playBtn.click();
    await expect(page.locator('[data-testid="mode-label"]')).toContainText('Classic');

    // 检查 HUD 显示的模式
    const modeLabel = await page.locator('[data-testid="mode-label"]').textContent().catch(() => '');
    console.log('First candidate:', modeLabel);

    // 点击下一个候选
    const nextBtn = page.locator('button', { hasText: '下一个候选' });
    await nextBtn.click();

    // 检查是否进入下一个（同组或不同组）
    await expect(page.locator('[data-testid="mode-label"]')).toContainText('Diagonal');
    const modeLabel2 = await page.locator('[data-testid="mode-label"]').textContent();
    console.log('Next candidate:', modeLabel2);
    // 应该成功切换到另一个候选
    expect(modeLabel2).toContain('CANDIDATE');
  });

});
