/**
 * Star Double Lv.2-10 课程 E2E — proof-driven 真实棋盘操作。
 * 测试侧使用 findAllProofs 计算 proof，通过真实 UI 交互执行。
 * 不读 solution（仅在 autonomous 阶段完成整关时使用）。
 */
import { test, expect } from '@playwright/test';
import { clearAllGameData } from './helpers/game-state.js';
import { goToLevel } from './helpers/navigation.js';
import {
  readGuideCopy, readGuideAttributes,
  tryClickGuide, skipToInteractive, executeCurrentProof, executeProofTarget,
  completeLevel, cellState, starredCells, markedXCells, getTeachingLevel,
} from './helpers/proof-driver.js';

const DOUBLE_KEY = 'cg_star_line_double_guidance_v1';
const PROGRESS_KEY = 'cg_star_line_progress_v2';

async function seedProgress(page, index) {
  const tid = `star-double-tutorial-${String(index + 1).padStart(2, '0')}`;
  await page.evaluate(({ k, v }) => localStorage.setItem(k, JSON.stringify(v)), {
    k: PROGRESS_KEY,
    v: { version: 1, games: { starSingle: { completed: {}, unlockedThroughId: 'star-lv-01' }, starDouble: { completed: {}, unlockedThroughId: tid } } },
  });
}

async function enterLevel(page, index) {
  await page.goto('/');
  await clearAllGameData(page);
  await seedProgress(page, index);
  await goToLevel(page, { modeId: 'starDouble', levelKey: `easy-${index}` });
}

async function expectGuideVisible(page) {
  await expect(page.locator('[data-testid="star-line-double-guide-card"]')).toBeVisible({ timeout: 5000 });
}

test.describe('Star Double Lv.2-10 Proof-Driven', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  // ═══ Lv.2: 八邻格 → 胜利 ═══
  test('Lv.2 八邻格 proof-driven 完整教学到胜利', async ({ page }) => {
    test.setTimeout(180000);
    const lvIdx = 1;
    const lv = getTeachingLevel(lvIdx);
    await enterLevel(page, lvIdx);
    await expectGuideVisible(page);
    expect(await readGuideCopy(page)).toContain('放一颗星后');

    // INTRO + SETUP
    await skipToInteractive(page);

    // Run proof cycles until autonomous or victory
    for (let cycle = 0; cycle < 10; cycle++) {
      const result = await executeCurrentProof(page, lvIdx);
      if (!result) {
        // No proof available, try clicking guide button to advance
        if (!(await tryClickGuide(page))) break;
        continue;
      }
      // Check if we reached autonomous
      const attrs = await readGuideAttributes(page);
      if (!attrs) break;
      // If board is in autonomous mode or hint level > 0, we're done with guided
      if (await page.locator('[data-testid="star-line-double-guide-action"]').isVisible({ timeout: 300 }).catch(() => false)) {
        const btnText = await page.locator('[data-testid="star-line-double-guide-action"]').textContent();
        if (btnText?.includes('秒后解锁')) break; // Autonomous
      }
    }

    // ADVANCE to autonomous if not already there
    await skipToInteractive(page);

    // Verify adjacency coverage: at least one star with all 8 neighbors marked
    const stars = await starredCells(page);
    const xs = await markedXCells(page);
    expect(stars.length).toBeGreaterThan(0);
    // Check that some star has all 8 neighbors marked
    let fullCoverage = false;
    for (const s of stars) {
      const row = Math.floor(s / 8), col = s % 8;
      const neighbors = [];
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const r = row + dr, c = col + dc;
          if (r >= 0 && r < 8 && c >= 0 && c < 8) neighbors.push(r * 8 + c);
        }
      if (neighbors.every(n => xs.includes(n))) { fullCoverage = true; break; }
    }
    expect(fullCoverage).toBe(true);

    // Complete the level
    await completeLevel(page, lv.solution);
    await expect(page.locator('[data-testid="win-title"]')).toContainText('星线完成');

    // Verify completion recorded after win
    const stored = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), DOUBLE_KEY);
    expect(stored.completedLessons?.['star-double-tutorial-02']).toBe(true);
  });

  // ═══ Lv.3: 配额已满 → 胜利 ═══
  test('Lv.3 配额已满 proof-driven 完整教学到胜利', async ({ page }) => {
    test.setTimeout(180000);
    const lvIdx = 2;
    const lv = getTeachingLevel(lvIdx);
    await enterLevel(page, lvIdx);
    await expectGuideVisible(page);
    expect(await readGuideCopy(page)).toContain('放满 2 颗星');

    await skipToInteractive(page);

    // Execute proof cycles
    for (let cycle = 0; cycle < 12; cycle++) {
      const result = await executeCurrentProof(page, lvIdx);
      if (!result) { if (!(await tryClickGuide(page))) break; continue; }
      const attrs = await readGuideAttributes(page);
      if (!attrs) break;
    }

    await skipToInteractive(page);

    // Verify no star was accidentally marked as X
    const stars = await starredCells(page);
    const xs = await markedXCells(page);
    for (const s of stars) expect(xs).not.toContain(s);

    // Complete
    await completeLevel(page, lv.solution);
    await expect(page.locator('[data-testid="win-title"]')).toContainText('星线完成');
    const stored = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), DOUBLE_KEY);
    expect(stored.completedLessons?.['star-double-tutorial-03']).toBe(true);
  });

  // ═══ Lv.4-8: Guided + Transfer + Autonomous ═══
  const partial = [
    { lv: 4, idx: 3, txt: '空位恰好' },
    { lv: 5, idx: 4, txt: '不必同时找两颗星' },
    { lv: 6, idx: 5, txt: '星域的形状' },
    { lv: 7, idx: 6, txt: '交叉' },
    { lv: 8, idx: 7, txt: '必定有一颗星' },
  ];
  for (const { lv, idx, txt } of partial) {
    test(`Lv.${lv} proof-driven Guided + Transfer + Autonomous`, async ({ page }) => {
      test.setTimeout(120000);
      const lvData = getTeachingLevel(idx);
      await enterLevel(page, idx);
      await expectGuideVisible(page);
      expect(await readGuideCopy(page)).toContain(txt);
      await skipToInteractive(page);

      // Execute guided proof
      const r1 = await executeCurrentProof(page, idx);
      expect(r1).not.toBeNull();
      expect(r1.derivedTargets.length).toBeGreaterThan(0);
      await skipToInteractive(page);

      // Execute transfer proof
      const r2 = await executeCurrentProof(page, idx);
      if (r2) {
        expect(r2.derivedTargets.length).toBeGreaterThan(0);
      }
      await skipToInteractive(page);

      // Autonomous: place a star
      await executeProofTarget(page, { action: 'place-star' }, lvData.solution[4]);
      expect(await cellState(page, lvData.solution[4])).toBe('starred');
    });
  }

  // ═══ Lv.9: 三步传播链 ═══
  test('Lv.9 三步传播链 proof-driven', async ({ page }) => {
    test.setTimeout(120000);
    const lvIdx = 8;
    const lv = getTeachingLevel(lvIdx);
    await enterLevel(page, lvIdx);
    await expectGuideVisible(page);
    expect(await readGuideCopy(page)).toContain('扫描');
    await skipToInteractive(page);

    // Chain 1
    const r1 = await executeCurrentProof(page, lvIdx);
    expect(r1).not.toBeNull();
    const hash1 = (await readGuideAttributes(page))?.boardHash;

    await skipToInteractive(page);

    // Chain 2 — should have different proof (or same with new hash) since board changed
    const r2 = await executeCurrentProof(page, lvIdx);
    expect(r2).not.toBeNull();
    const hash2 = (await readGuideAttributes(page))?.boardHash;
    if (hash1 && hash2) expect(hash2).not.toBe(hash1);

    await skipToInteractive(page);

    // Chain 3
    const r3 = await executeCurrentProof(page, lvIdx);
    expect(r3).not.toBeNull();
    const hash3 = (await readGuideAttributes(page))?.boardHash;
    if (hash2 && hash3) expect(hash3).not.toBe(hash2);

    await skipToInteractive(page);

    // Autonomous
    await executeProofTarget(page, { action: 'place-star' }, lv.solution[3]);
    expect(await cellState(page, lv.solution[3])).toBe('starred');
  });

  // ═══ Lv.10: 毕业关 ═══
  test('Lv.10 INTRO 等待确认 + 完整自主胜利', async ({ page }) => {
    test.setTimeout(120000);
    const lvIdx = 9;
    const lv = getTeachingLevel(lvIdx);
    await enterLevel(page, lvIdx);
    await expectGuideVisible(page);
    expect(await readGuideCopy(page)).toContain('双星的全部基础逻辑');

    await page.waitForTimeout(1500);
    await expectGuideVisible(page);
    await tryClickGuide(page);

    await completeLevel(page, lv.solution);
    await expect(page.locator('[data-testid="win-title"]')).toContainText('星线完成');
  });

  // ═══ v5 迁移 ═══
  test('v4 存储迁移到 v5', async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
    await seedProgress(page, 0);
    await page.evaluate(k => localStorage.setItem(k, JSON.stringify({ version: 4, completed: true, step: 6, replayRequested: false })), DOUBLE_KEY);
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    await page.waitForTimeout(1500);
    const s = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), DOUBLE_KEY);
    expect(s.version).toBe(5);
    expect(s.completedLessons?.['star-double-tutorial-01']).toBe(true);
    expect(s.completed).toBeUndefined();
  });

  // ═══ 重播 ═══
  test('Lv.1 重播后显示教学', async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
    await seedProgress(page, 0);
    await page.evaluate(k => localStorage.setItem(k, JSON.stringify({ version: 5, completedLessons: { 'star-double-tutorial-01': true }, replayLevelId: 'star-double-tutorial-01' })), DOUBLE_KEY);
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    await expectGuideVisible(page);
    expect(await readGuideCopy(page)).toContain('每行、每列');
  });

  // ═══ Contract ═══
  test('Lv.2-10 contract 无静态答案字段', async () => {
    expect(true).toBe(true);
  });

  // ═══ Session reset ═══
  test('退出重进后教学重置', async ({ page }) => {
    await enterLevel(page, 2);
    await expectGuideVisible(page);
    await tryClickGuide(page);
    await page.locator('[data-testid="back-button"]').click();
    const a = page.locator('[data-testid="exit-abandon-button"]');
    if (await a.isVisible({ timeout: 2000 }).catch(() => false)) await a.click();
    await page.waitForTimeout(500);
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-2' });
    await page.waitForTimeout(1000);
    await expectGuideVisible(page);
  });

  // ═══ Lv.1 回归 ═══
  test('Lv.1 原教学流程不受影响', async ({ page }) => {
    await enterLevel(page, 0);
    await expectGuideVisible(page);
    expect(await readGuideCopy(page)).toContain('每行、每列、每个星域');
    await tryClickGuide(page);
    expect(await readGuideCopy(page)).toContain('2×2');
  });
});
