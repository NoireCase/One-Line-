import { test, expect } from '@playwright/test';
import { openDevCandidatePanel, startFirstDevCandidate } from './helpers/dev-candidate.js';

const BASE = '/';

test.describe('Batch Eval + Apply — 批次评估与入库校验', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    await page.evaluate(() => {
      localStorage.removeItem('cg_dev_candidate_reviews');
      localStorage.removeItem('cg_classic_v2_progress');
      localStorage.removeItem('cg_coins');
    });
  });

  // ═══ C1: Candidate metadata ═══
  test('C1. 候选元数据包含 similarityScore + archetypeTag', async ({ page }) => {
    await openDevCandidatePanel(page);

    const body = await page.textContent('body');

    const hasSimScore = /S\d+/.test(body);
    console.log('Has similarity score (S##):', hasSimScore);

    const archTags = ['边缘', '中扫', '角扫', '长直', '折返', '分区', '紧凑', '密转', '行列', '锚稀', '锚密', '斜织', '斜交', '均衡', '?'];
    const hasArchTag = archTags.some(t => body.includes(t));
    console.log('Has archetype tag:', hasArchTag);

    expect(hasSimScore).toBe(true);
    expect(hasArchTag).toBe(true);
    expect(body).toMatch(/共\s*4\s*个候选/);
  });

  // ═══ C2: APPROVED 按钮可见性 ═══
  test('C2. APPROVED 候选时显示复制 apply 按钮', async ({ page }) => {
    await page.goto(BASE);
    // 打开 GM 获取第一个可见候选的 seed
    await openDevCandidatePanel(page);

    // 从候选卡片中动态提取第一个可见 seed（格式: s212 后跟棋盘尺寸 7×7）
    const cardText = await page.textContent('body');
    const seedMatch = cardText.match(/s(\d+)\s*\d+×\d+/);
    if (!seedMatch) throw new Error('未找到候选 seed');
    const seed = seedMatch[1];
    console.log('Dynamic seed:', seed);

    // 写入 APPROVED 并刷新
    await page.evaluate((s) => {
      localStorage.setItem('cg_dev_candidate_reviews', JSON.stringify({ [s]: 'APPROVED' }));
    }, seed);
    await page.reload();

    // 重新打开 GM
    await openDevCandidatePanel(page);

    const applyBtn = page.getByRole('button', { name: '复制已通过 apply 命令' });
    await expect(applyBtn).toBeVisible();

    await page.evaluate(() => localStorage.removeItem('cg_dev_candidate_reviews'));
  });

  // ═══ C3: 右侧面板显示 archetype + similarity ═══
  test('C3. 右侧审核面板显示相似度和结构类型', async ({ page }) => {
    await startFirstDevCandidate(page);

    const panel = await page.textContent('body');
    const hasArch = /UNKNOWN|EDGE_SWEEP|CENTER_SWEEP|CORNER_SWEEP|LONG_RUN_MIXED|COMPACT_ROUTE|TURN_DENSE|ROW_COL_SWEEP|ANCHOR_SPARSE|ANCHOR_DENSE|DIAGONAL_WEAVE|DIAGONAL_CROSS|BALANCED_WEAVE|BALANCED_PATH/.test(panel);
    const hasSim = /相似度/.test(panel);
    const hasStruct = /结构类型/.test(panel);

    console.log('Panel — archetype:', hasArch, '| 相似度:', hasSim, '| 结构类型:', hasStruct);
    expect(hasArch).toBe(true);
    expect(hasSim).toBe(true);
    expect(hasStruct).toBe(true);
  });

  // ═══ C4: 正式游戏不显示 dev UI ═══
  test('C4. 正式游戏不显示 dev candidate 入口', async ({ page }) => {
    await page.click('[data-testid="home-start-button"]');

    const firstLevel = page.locator('[data-testid^="level-tile-"]').first();
    await expect(firstLevel).toBeVisible();
    await firstLevel.click();

    const hud = await page.locator('[data-testid="mode-label"]').textContent().catch(() => '');
    console.log('Normal game HUD:', hud);
    expect(hud).not.toContain('DEV');
    expect(hud).not.toContain('CANDIDATE');
    expect(hud).toContain('Lv');
  });

});
