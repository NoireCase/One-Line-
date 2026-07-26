import { test, expect } from '@playwright/test';
import { S } from './helpers/selectors.js';
import { goToPuzzleBook, switchMode, goToLevel, resolveChapterKey } from './helpers/navigation.js';
import { clearAllGameData } from './helpers/game-state.js';
import { buildBrowserClassicSave } from './helpers/classic-level-fixture.js';

test.describe('关卡列表', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
    await goToPuzzleBook(page);
  });

  test('谜题书显示四个模式入口', { tag: '@critical' }, async ({ page }) => {
    await expect(page.locator(S.puzzleBook.title)).toBeVisible();
    await expect(page.locator(S.modeSwitcher.modeCard('classic'))).toBeVisible();
    await expect(page.locator(S.modeSwitcher.modeCard('diagonal'))).toBeVisible();
    await expect(page.locator(S.modeSwitcher.modeCard('hidden'))).toBeVisible();
    await expect(page.locator(S.modeSwitcher.modeCard('portalClassic'))).toBeVisible();
    await expect(page.locator(S.modeSwitcher.modeCard('starLine'))).not.toBeVisible();
  });

  test('经典模式仅在玩法切换中显示简洁进度', async ({ page }) => {
    await expect(page.locator(S.puzzleBook.progressText)).toHaveCount(0);
    await expect(page.locator(S.modeSwitcher.modeCard('classic'))).toContainText(/0\s*\/\s*\d+/);

    const tiles = page.locator(S.puzzleBook.anyTile);
    const count = await tiles.count();
    expect(count).toBeGreaterThanOrEqual(10);
  });

  test('首关为推荐关卡且后续锁定', { tag: '@critical' }, async ({ page }) => {
    const firstTile = page.locator(S.puzzleBook.levelTile('easy-0'));
    await expect(firstTile).toBeEnabled();
    // 全新玩家：首关是唯一推荐目标，显示“下一关”
    await expect(firstTile).toHaveAttribute('data-recommended', 'true');
    await expect(firstTile.locator('text=下一关')).toBeVisible();

    // 后续关卡应有锁定的
    const lockedTiles = page.locator('[data-testid^="level-tile-"][data-locked="true"]');
    const lockedCount = await lockedTiles.count();
    expect(lockedCount).toBeGreaterThan(0);
  });

  test('切换到八向连线模式', async ({ page }) => {
    await switchMode(page, 'diagonal');
    await expect(page.locator(S.modeSwitcher.modeCard('diagonal'))).toContainText(/0\s*\/\s*\d+/);
    const tiles = page.locator(S.puzzleBook.anyTile);
    await expect(tiles.first()).toBeVisible({ timeout: 3000 });
  });

  test('切换到经典传送门模式', async ({ page }) => {
    await switchMode(page, 'portalClassic');
    const tiles = page.locator(S.puzzleBook.anyTile);
    const count = await tiles.count();
    expect(count).toBeGreaterThanOrEqual(8);
  });

  test('L3 主 CTA 为单行按钮，位于当前章节头，携带模式 data-mode', { tag: '@critical' }, async ({ page }) => {
    const cta = page.locator(S.puzzleBook.cta);
    await expect(cta).toBeVisible();
    expect(await cta.evaluate(el => el.tagName)).toBe('BUTTON');
    // CTA 携带模式 data-mode（模式配色）
    await expect(cta).toHaveAttribute('data-mode', 'classic');
    // CTA 位于当前章节（easy）头部
    await expect(page.locator(`${S.puzzleBook.chapter('easy')} ${S.puzzleBook.cta}`)).toHaveCount(1);
    // 不再存在独立摘要框 / 底部预览条 / 旧两行结构
    await expect(page.locator('[data-testid="level-summary"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="level-preview"]')).toHaveCount(0);
    await expect(cta.locator('.cta-sub')).toHaveCount(0);
  });

  test('L2 切换玩法后 CTA data-mode 同步变化', async ({ page }) => {
    await expect(page.locator(S.puzzleBook.cta)).toHaveAttribute('data-mode', 'classic');
    await switchMode(page, 'diagonal');
    await expect(page.locator(S.puzzleBook.cta)).toHaveAttribute('data-mode', 'diagonal');
    await switchMode(page, 'portalClassic');
    await expect(page.locator(S.puzzleBook.cta)).toHaveAttribute('data-mode', 'portalClassic');
  });

  test('L2 全部完成：不渲染主 CTA，仅保留完成横幅', async ({ page }) => {
    // Classic 关卡数固定：easy 10 / medium 20 / hard 30（不改关卡数据）
    await page.evaluate(() => {
      localStorage.setItem('cg_classic_v2_progress', JSON.stringify({
        easy: Array(10).fill(3), medium: Array(20).fill(3), hard: Array(30).fill(3),
      }));
    });
    await goToPuzzleBook(page);

    // 不渲染 CTA，也不渲染独立完成面板
    await expect(page.locator(S.puzzleBook.cta)).toHaveCount(0);
    await expect(page.locator('[data-testid="level-complete-status"]')).toHaveCount(0);
    await expect(page.locator(S.puzzleBook.progressText)).toHaveCount(0);
    await expect(page.locator('[data-testid="level-complete-banner"]')).toBeVisible();
  });

  test('L3 有存档：CTA 与存档关保留续玩语义', { tag: '@critical' }, async ({ page }) => {
    const { savedGame: save } = await buildBrowserClassicSave(page, {
      levelIdx: 5,
      timer: 20,
    });
    await page.evaluate((savedGame) => {
      localStorage.setItem('cg_classic_v2_progress', JSON.stringify({ easy: Array(5).fill(3) }));
      localStorage.setItem('cg_classic_v2_saved_game', JSON.stringify(savedGame));
    }, save);
    await goToPuzzleBook(page);

    const cta = page.locator(S.puzzleBook.cta);
    await expect(cta).toContainText('继续存档');

    const savedTile = page.locator(S.puzzleBook.levelTile('easy-5'));
    await expect(savedTile).toHaveAttribute('data-recommended', 'true');
    await expect(savedTile).toHaveAttribute('data-has-save', 'true');
    await expect(savedTile.locator('text=继续')).toBeVisible();
    await expect(savedTile.locator('text=下一关')).toHaveCount(0);
  });

  test('L3 当前章节默认展开，已完成过去章节默认折叠为摘要', async ({ page }) => {
    // easy 全部完成 → 当前章节为 medium
    await page.evaluate(() => localStorage.setItem('cg_classic_v2_progress', JSON.stringify({ easy: Array(10).fill(3) })));
    await goToPuzzleBook(page);

    // 当前章节 medium 展开：medium 关卡可见
    await expect(page.locator(S.puzzleBook.levelTile('medium-0'))).toBeVisible();
    // 过去章节 easy 折叠：easy 关卡不可见，且折叠按钮 aria-expanded=false
    await expect(page.locator(S.puzzleBook.levelTile('easy-0'))).toHaveCount(0);
    const easyToggle = page.locator(S.puzzleBook.chapterToggle('easy'));
    await expect(easyToggle).toBeVisible();
    await expect(easyToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(easyToggle).toHaveAttribute('aria-controls', /level-chapter-body-easy/);
    // 未来章节 hard 完全锁定：仅摘要，不逐格渲染
    await expect(page.locator(S.puzzleBook.chapter('hard'))).toBeVisible();
    await expect(page.locator(S.puzzleBook.levelTile('hard-0'))).toHaveCount(0);
    // 推荐关卡唯一
    await expect(page.locator('[data-testid^="level-tile-"][data-recommended="true"]')).toHaveCount(1);
  });

  test('L3 展开已完成章节可重玩，aria-expanded 切换', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('cg_classic_v2_progress', JSON.stringify({ easy: Array(10).fill(3) })));
    await goToPuzzleBook(page);

    const easyToggle = page.locator(S.puzzleBook.chapterToggle('easy'));
    await expect(easyToggle).toHaveAttribute('aria-expanded', 'false');
    await easyToggle.click();
    await expect(easyToggle).toHaveAttribute('aria-expanded', 'true');
    // 展开后已完成关卡可直接点击重玩
    const done = page.locator(S.puzzleBook.levelTile('easy-0'));
    await expect(done).toBeVisible();
    await expect(done).toBeEnabled();
    await expect(done).toHaveAttribute('data-completed', 'true');
  });

  test('L3 One Line 当前章节使用 8 列横向矩形卡片', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goToPuzzleBook(page);
    const grid = page.locator('[data-testid="level-grid-easy"]');
    await expect(grid).toBeVisible();
    const cols = await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length);
    expect(cols).toBe(8);
    // 卡片为横向矩形（宽 > 高）
    const box = await page.locator(S.puzzleBook.levelTile('easy-0')).boundingBox();
    expect(box.width).toBeGreaterThan(box.height);
  });

  test('L3.1 completed 章节折叠显示“展开重玩”，aria-controls 目标常存并随展开切换 hidden', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('cg_classic_v2_progress', JSON.stringify({ easy: Array(10).fill(3) })));
    await goToPuzzleBook(page);

    const toggle = page.locator(S.puzzleBook.chapterToggle('easy'));
    await expect(toggle).toContainText('展开重玩');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    // aria-controls 目标始终存在，折叠时 hidden
    const region = page.locator('#level-chapter-body-easy');
    await expect(region).toHaveCount(1);
    await expect(region).toBeHidden();

    await toggle.click();
    await expect(toggle).toContainText('收起');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(region).toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(region).toBeHidden();
  });

  test('L3.1 locked 章节为静态摘要，无 aria-expanded 与展开文案', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('cg_classic_v2_progress', JSON.stringify({ easy: Array(10).fill(3) })));
    await goToPuzzleBook(page);

    const hardChapter = page.locator(S.puzzleBook.chapter('hard'));
    await expect(hardChapter).toBeVisible();
    await expect(page.locator(S.puzzleBook.chapterToggle('hard'))).toHaveCount(0);
    await expect(hardChapter.locator('[aria-expanded]')).toHaveCount(0);
  });

  test('L3.1 ModeSwitcher 使用 group 语义 + aria-pressed，键盘可激活', async ({ page }) => {
    const group = page.locator('[data-testid="mode-switcher"] [role="group"]');
    await expect(group).toHaveCount(1);
    // 不再使用 tab / tablist / aria-selected
    await expect(page.locator('[data-testid="mode-switcher"] [role="tab"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="mode-switcher"] [role="tablist"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="mode-switcher"] [aria-selected]')).toHaveCount(0);
    await expect(page.locator(S.modeSwitcher.modeCard('classic'))).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(S.modeSwitcher.modeCard('diagonal'))).toHaveAttribute('aria-pressed', 'false');
    // 键盘 Enter 激活切换（原生按钮行为）
    await page.locator(S.modeSwitcher.modeCard('diagonal')).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator(S.modeSwitcher.modeCard('diagonal'))).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(S.modeSwitcher.modeCard('classic'))).toHaveAttribute('aria-pressed', 'false');
  });

  test('L3.1 resolveChapterKey 覆盖五种模式章节映射', () => {
    expect(resolveChapterKey('classic', 'easy-3')).toBe('easy');
    expect(resolveChapterKey('classic', 'medium-0')).toBe('medium');
    expect(resolveChapterKey('classic', 'hard-5')).toBe('hard');
    expect(resolveChapterKey('diagonal', 'medium-2')).toBe('medium');
    expect(resolveChapterKey('portalClassic', 'easy-0')).toBe('portal');
    expect(resolveChapterKey('hidden', 'easy-0')).toBe('hidden-easy');
    expect(resolveChapterKey('hidden', 'easy-15')).toBe('hidden-medium');
    expect(resolveChapterKey('hidden', 'easy-40')).toBe('hidden-hard');
    expect(resolveChapterKey('starLine', 'easy-0')).toBe('star-intro');
    expect(resolveChapterKey('starLine', 'easy-14')).toBe('star-intro-max');
    expect(resolveChapterKey('starLine', 'easy-24')).toBe('star-double');
    expect(resolveChapterKey('starLine', 'easy-29')).toBe('star-double-max');
  });

  test('L3.1 goToLevel 真实展开进入 Star Line 双星折叠章节', async ({ page }) => {
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
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();
  });

  test('L3.1 全部完成后展开已完成章节并真实点击重玩进入游戏', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('cg_classic_v2_progress', JSON.stringify({
      easy: Array(10).fill(3), medium: Array(20).fill(3), hard: Array(30).fill(3),
    })));
    await goToPuzzleBook(page);

    await page.locator(S.puzzleBook.chapterToggle('easy')).click();
    await page.locator(S.puzzleBook.levelTile('easy-0')).click();
    await expect(page.locator(S.game.board)).toBeVisible({ timeout: 8000 });
  });

});
