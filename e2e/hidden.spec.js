import { test, expect } from '@playwright/test';
import { goToPuzzleBook, switchMode } from './helpers/navigation.js';
import { S } from './helpers/selectors.js';
import { getHiddenLevel } from '../src/data/hiddenLevels.js';

const HIDDEN_SAVE_KEY = 'cg_hidden_saved_game';
const HIDDEN_PROGRESS_KEY = 'cg_hidden_progress';

/** 按 initGame 的 Hidden 分支构造真实存档结构（第 2 关，已走 1 步）。 */
function buildHiddenLevel2Save() {
  const level = getHiddenLevel(1);
  const knSet = new Set(level.keyNumbers);
  const secondIndex = level.path[1];
  const gridData = [];
  for (let i = 0; i < level.N * level.N; i++) {
    const pathPos = level.path.indexOf(i);
    const val = pathPos >= 0 ? pathPos + 1 : 0;
    gridData.push({
      val,
      isHidden: !knSet.has(val),
      isRevealed: i === secondIndex,
      isExcluded: false,
      isHinted: false,
    });
  }
  return {
    playMode: 'hidden',
    diff: 'easy',
    levelIdx: 1,
    gridData,
    path: [level.startIndex, secondIndex],
    hp: 10,
    timer: 5,
    score: 0,
    maxCombo: 0,
    activePortal: null,
    savedAt: 1752710400000,
  };
}

test.describe('Hidden / 隐迹连线', () => {

  test('H1. 隐迹连线模式入口存在', { tag: '@critical' }, async ({ page }) => {
    await goToPuzzleBook(page);
    const hiddenModeEntry = page.locator('.mode-bookmarks-track').getByText('隐迹连线');
    await expect(hiddenModeEntry).toBeVisible();
  });

  test('H2. Hidden 显示 60 个关卡 (Easy 10 + Medium 20 + Hard 30)', async ({ page }) => {
    await goToPuzzleBook(page);
    await page.locator('[data-testid="mode-card-hidden"]').scrollIntoViewIfNeeded();
    await page.locator('[data-testid="mode-card-hidden"]').click({ force: true });
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="mode-card-hidden"]')).toContainText('0/60');
    await expect(page.locator('[data-testid="level-progress-text"]')).toHaveCount(0);
  });

  test('H3. Classic / Diagonal / Portal 入口不受影响', { tag: '@critical' }, async ({ page }) => {
    await goToPuzzleBook(page);
    await expect(page.getByText('经典模式').first()).toBeVisible();
    await expect(page.getByText('八向连线').first()).toBeVisible();
  });

  test('H4. Hidden 中断存档只标记真实关卡，选关页不误解锁也不删档', { tag: '@critical' }, async ({ page }) => {
    // 已完成第 1 关（解锁到第 2 关），并在第 2 关留下中断存档
    const save = buildHiddenLevel2Save();
    await page.goto('/');
    await page.evaluate(({ progressKey, saveKey, saveValue }) => {
      localStorage.setItem(progressKey, JSON.stringify({ hidden: [1] }));
      localStorage.setItem(saveKey, JSON.stringify(saveValue));
    }, { progressKey: HIDDEN_PROGRESS_KEY, saveKey: HIDDEN_SAVE_KEY, saveValue: save });

    await goToPuzzleBook(page);
    await switchMode(page, 'hidden');

    // 只有真实存档关（第 2 关）显示存档标记
    await expect(page.locator(S.puzzleBook.levelTile('easy-1'))).toHaveAttribute('data-has-save', 'true');
    await expect(page.locator(S.puzzleBook.levelTile('easy-0'))).toHaveAttribute('data-has-save', 'false');
    await expect(page.locator(S.puzzleBook.levelTile('easy-2'))).toHaveAttribute('data-has-save', 'false');

    // 未正常解锁的后续关保持锁定（进度只到第 2 关）
    await expect(page.locator(S.puzzleBook.levelTile('easy-2'))).toHaveAttribute('data-locked', 'true');
    await expect(page.locator(S.puzzleBook.levelTile('easy-5'))).toHaveAttribute('data-locked', 'true');

    // 打开选关页本身不得清除存档
    const savedAfterList = await page.evaluate(key => localStorage.getItem(key), HIDDEN_SAVE_KEY);
    expect(savedAfterList).not.toBeNull();

    // CTA 指向真实存档关并恢复它
    await expect(page.locator(S.puzzleBook.cta)).toHaveAttribute('data-cta-mode', 'save');
    await page.locator(S.puzzleBook.cta).click();
    await expect(page.locator(S.game.board)).toBeVisible({ timeout: 8000 });
    await expect(page.locator(S.game.modeLabel)).toContainText('第 2 关');
    // 恢复的是 2 格进度的存档，而不是新开局（新开局路径为 1）
    await expect(page.locator('[data-testid="hidden-path-hud"]')).toHaveText('路径 2 / 25');

    // 恢复存档不删除存档
    const savedAfterResume = await page.evaluate(key => localStorage.getItem(key), HIDDEN_SAVE_KEY);
    expect(savedAfterResume).not.toBeNull();
  });
});
