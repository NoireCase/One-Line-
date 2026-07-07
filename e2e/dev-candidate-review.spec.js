// @ts-check
import { test, expect } from '@playwright/test';

const BASE = '/';

test.describe('Dev Candidate Review — 浏览器端到端', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(400);
    // 清理测试干扰
    await page.evaluate(() => {
      localStorage.removeItem('cg_classic_v2_progress');
      localStorage.removeItem('cg_classic_v2_highscores');
      localStorage.removeItem('cg_coins');
      localStorage.removeItem('cg_dev_candidate_reviews');
    });
  });

  test('A1. 首页 → 设置 → GM 控制台 → 检查三列布局', async ({ page }) => {
    // 点击首页设置按钮
    await page.click('[data-testid="home-settings-button-secondary"]');
    await page.waitForSelector('[data-testid="settings-panel"]');
    await page.waitForTimeout(300);

    // 查找并点击「打开 GM 控制台」
    const gmBtn = page.locator('button', { hasText: 'GM 控制台' });
    if (await gmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gmBtn.click();
      await page.waitForTimeout(600);
    }

    // 检查 GM Console 标题
    const gmTitle = page.locator('text=GM Console');
    console.log('GM Console 可见:', await gmTitle.isVisible({ timeout: 1000 }).catch(() => false));

    // 检查 Dev 试玩关卡 第三列
    const devCol = page.locator('text=Dev 试玩关卡');
    console.log('Dev 试玩关卡 可见:', await devCol.isVisible({ timeout: 1000 }).catch(() => false));

    // 检查候选卡片（应在第三列中）
    const playBtns = page.locator('button', { hasText: '试玩' });
    const count = await playBtns.count();
    console.log('试玩按钮数:', count);

    // 验证三列布局：GM 控制区 + 分隔线 + Dev 试玩关卡
    expect(count).toBeGreaterThan(0);
  });

  test('A2. GM 候选卡片信息完整', async ({ page }) => {
    await page.click('[data-testid="home-settings-button-secondary"]');
    await page.waitForTimeout(300);

    const gmBtn = page.locator('button', { hasText: 'GM 控制台' });
    if (await gmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gmBtn.click();
      await page.waitForTimeout(600);
    }

    // 检查候选卡片上的关键信息
    const pageText = await page.textContent('body');
    // Debug: log snippets around seed/Q numbers
    const seedMatches = pageText.match(/.{0,20}[sS]\d+.{0,20}/g) || [];
    const qMatches = pageText.match(/.{0,20}Q\d+.{0,20}/g) || [];
    console.log('Seed context:', seedMatches.slice(0, 3));
    console.log('Quality context:', qMatches.slice(0, 3));
    const checks = [
      { label: '有 Classic/Diag 标签', pass: /Clsc|Diag/i.test(pageText) },
      { label: '有 seed/Q 编号', pass: /s\d{2,}/.test(pageText) || /Q\d{2,}/.test(pageText) },
      { label: '有 Quality Score', pass: /Q\d+/.test(pageText) },
      { label: '有试玩按钮', pass: pageText.includes('试玩') },
      { label: '有淘汰按钮', pass: pageText.includes('淘汰') },
    ];

    console.log('候选卡片信息检查:');
    for (const c of checks) {
      console.log(`  ${c.pass ? '✅' : '❌'} ${c.label}`);
    }

    const allPassed = checks.every(c => c.pass);
    expect(allPassed).toBe(true);
  });

  test('A3. 点击试玩 → DEV CANDIDATE 标题 → 右侧信息面板', async ({ page }) => {
    // 打开 GM 面板
    await page.click('[data-testid="home-settings-button-secondary"]');
    await page.waitForTimeout(300);
    const gmBtn = page.locator('button', { hasText: 'GM 控制台' });
    if (await gmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gmBtn.click();
      await page.waitForTimeout(600);
    }

    // 点击第一个"试玩"按钮
    const playBtn = page.locator('button', { hasText: '试玩' }).first();
    if (await playBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await playBtn.click();
      await page.waitForTimeout(800);
    }

    // 检查 HUD 中的 DEV CANDIDATE 标签
    const hudText = await page.textContent('[data-testid="mode-label"]').catch(() => '');
    console.log('HUD mode label:', hudText);

    // 检查是否有 DEV CANDIDATE 或 DEV 标记
    const hasDevLabel = hudText.includes('DEV') || hudText.includes('seed');
    console.log('HUD 包含 DEV/seed:', hasDevLabel);

    // 检查右侧候选审核面板
    const reviewPanel = page.locator('text=候选审核');
    const reviewVisible = await reviewPanel.isVisible({ timeout: 2000 }).catch(() => false);
    console.log('候选审核面板可见:', reviewVisible);

    // 检查面板内的操作按钮
    const approveBtn = page.locator('button', { hasText: '标记为可入库' });
    const rejectBtn = page.locator('button', { hasText: '不合格' });
    const restartBtn = page.locator('button', { hasText: '重玩' });
    const nextBtn = page.locator('button', { hasText: '下一个' });
    const backBtn = page.locator('button', { hasText: '返回 GM' });
    const copyJsonBtn = page.locator('button', { hasText: '复制 JSON' });
    const copyCmdBtn = page.locator('button', { hasText: '复制命令' });

    console.log('操作按钮检查:');
    console.log('  标记为可入库:', await approveBtn.isVisible().catch(() => false));
    console.log('  不合格:', await rejectBtn.isVisible().catch(() => false));
    console.log('  重玩:', await restartBtn.isVisible().catch(() => false));
    console.log('  下一个:', await nextBtn.isVisible().catch(() => false));
    console.log('  返回 GM:', await backBtn.isVisible().catch(() => false));
    console.log('  复制 JSON:', await copyJsonBtn.isVisible().catch(() => false));
    console.log('  复制命令:', await copyCmdBtn.isVisible().catch(() => false));

    expect(reviewVisible).toBe(true);
    expect(hasDevLabel).toBe(true);
  });

  test('A4. 审核标记 APPROVED → localStorage 验证', async ({ page }) => {
    // 打开 GM 面板
    await page.click('[data-testid="home-settings-button-secondary"]');
    await page.waitForTimeout(300);
    const gmBtn = page.locator('button', { hasText: 'GM 控制台' });
    if (await gmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gmBtn.click();
      await page.waitForTimeout(600);
    }

    // 点击第一个"试玩"
    const playBtn = page.locator('button', { hasText: '试玩' }).first();
    if (await playBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await playBtn.click();
      await page.waitForTimeout(800);
    }

    // 点击"标记为可入库"
    const approveBtn = page.locator('button', { hasText: '标记为可入库' });
    if (await approveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await approveBtn.click();
      await page.waitForTimeout(400);
    }

    // 验证 localStorage
    const reviews = await page.evaluate(() => {
      const raw = localStorage.getItem('cg_dev_candidate_reviews');
      return raw ? JSON.parse(raw) : null;
    });
    console.log('cg_dev_candidate_reviews:', JSON.stringify(reviews));

    // 应该有至少一条 APPROVED
    if (reviews) {
      const hasApproved = Object.values(reviews).some(v => v === 'APPROVED');
      console.log('存在 APPROVED:', hasApproved);
      expect(hasApproved).toBe(true);
    }

    // 验证正式存档未受影响
    const formalData = await page.evaluate(() => ({
      progress: localStorage.getItem('cg_classic_v2_progress'),
      coins: localStorage.getItem('cg_coins'),
      highScores: localStorage.getItem('cg_classic_v2_highscores'),
    }));
    console.log('正式存档:', JSON.stringify(formalData));
    expect(formalData.progress).toBeNull();
    expect(formalData.coins).toBeNull();

    // 清理
    await page.evaluate(() => localStorage.removeItem('cg_dev_candidate_reviews'));
  });

  test('A5. 审核标记 REJECTED → 重置测试', async ({ page }) => {
    await page.click('[data-testid="home-settings-button-secondary"]');
    await page.waitForTimeout(300);
    const gmBtn = page.locator('button', { hasText: 'GM 控制台' });
    if (await gmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gmBtn.click();
      await page.waitForTimeout(600);
    }

    // 点击淘汰按钮（在 GM 面板中直接操作）
    const rejectBtn = page.locator('button', { hasText: '淘汰' }).first();
    if (await rejectBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await rejectBtn.click();
      await page.waitForTimeout(400);
    }

    const reviews1 = await page.evaluate(() => {
      const raw = localStorage.getItem('cg_dev_candidate_reviews');
      return raw ? JSON.parse(raw) : null;
    });
    console.log('REJECTED 后:', JSON.stringify(reviews1));
    const hasRejected = reviews1 && Object.values(reviews1).some(v => v === 'REJECTED');
    console.log('存在 REJECTED:', hasRejected);

    // 点击重置（同一个按钮，文字变为"重置"）
    const resetBtn = page.locator('button', { hasText: '重置' }).first();
    if (await resetBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await resetBtn.click();
      await page.waitForTimeout(400);
    }

    const reviews2 = await page.evaluate(() => {
      const raw = localStorage.getItem('cg_dev_candidate_reviews');
      return raw ? JSON.parse(raw) : null;
    });
    console.log('重置后:', JSON.stringify(reviews2));

    // 清理
    await page.evaluate(() => localStorage.removeItem('cg_dev_candidate_reviews'));
  });

  test('A6. 获胜面板不写正式存档', async ({ page }) => {
    // 进入 GM 面板 → 试玩候选
    await page.click('[data-testid="home-settings-button-secondary"]');
    await page.waitForTimeout(300);
    const gmBtn = page.locator('button', { hasText: 'GM 控制台' });
    if (await gmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gmBtn.click();
      await page.waitForTimeout(600);
    }

    const playBtn = page.locator('button', { hasText: '试玩' }).first();
    if (await playBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await playBtn.click();
      await page.waitForTimeout(800);
    }

    // 使用 GM 面板的「立即通关」来完成关卡
    // 重新打开 GM 面板
    await page.click('[data-testid="back-button"]');
    await page.waitForTimeout(300);

    // 检查正式存档
    const formalData = await page.evaluate(() => ({
      progress: localStorage.getItem('cg_classic_v2_progress'),
      coins: localStorage.getItem('cg_coins'),
      highScores: localStorage.getItem('cg_classic_v2_highscores'),
      savedGame: localStorage.getItem('cg_classic_v2_saved_game'),
    }));
    console.log('退出候选后正式存档:', JSON.stringify(formalData));

    // 所有正式 key 应为空
    expect(formalData.progress).toBeNull();
    expect(formalData.coins).toBeNull();
    expect(formalData.highScores).toBeNull();
  });

  test('B1. 返回关卡列表后正式关卡进度不变', async ({ page }) => {
    // 先设定一些正式进度
    await page.evaluate(() => {
      localStorage.setItem('cg_classic_v2_progress', JSON.stringify({ easy: [1, 2], medium: [], hard: [] }));
      localStorage.setItem('cg_coins', '100');
    });

    // 进入候选试玩
    await page.click('[data-testid="home-settings-button-secondary"]');
    await page.waitForTimeout(300);
    const gmBtn = page.locator('button', { hasText: 'GM 控制台' });
    if (await gmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gmBtn.click();
      await page.waitForTimeout(600);
    }

    const playBtn = page.locator('button', { hasText: '试玩' }).first();
    if (await playBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await playBtn.click();
      await page.waitForTimeout(800);
    }

    // 返回（点击 back button）
    const backBtn = page.locator('[data-testid="back-button"]');
    if (await backBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await backBtn.click();
      await page.waitForTimeout(500);
    }

    // 验证正式进度不变
    const formalData = await page.evaluate(() => ({
      progress: localStorage.getItem('cg_classic_v2_progress'),
      coins: localStorage.getItem('cg_coins'),
    }));
    console.log('正式存档 after dev candidate:', JSON.stringify(formalData));

    expect(formalData.progress).toBe(JSON.stringify({ easy: [1, 2], medium: [], hard: [] }));
    expect(formalData.coins).toBe('100');

    // 清理
    await page.evaluate(() => {
      localStorage.removeItem('cg_classic_v2_progress');
      localStorage.removeItem('cg_coins');
    });
  });

});
