import { expect } from '@playwright/test';
import { S } from './selectors.js';

/**
 * 导航到首页并等待加载完成。
 */
export async function goToHome(page) {
  await page.goto('/');
  await expect(page.locator(S.home.startButton)).toBeVisible({ timeout: 10000 });
  await expect(page.locator(S.home.starLineButton)).toBeVisible({ timeout: 10000 });
}

/**
 * 从首页进入 One Line 谜题书（关卡选择页）。
 */
export async function goToPuzzleBook(page) {
  await goToHome(page);
  await page.locator(S.home.startButton).click();
  await expect(page.locator(S.puzzleBook.title)).toBeVisible({ timeout: 5000 });
}

/**
 * 从首页进入 Star Line 关卡选择页。
 */
export async function goToStarLineLevels(page) {
  await goToHome(page);
  await page.locator(S.home.starLineButton).click();
  await expect(page.locator(S.puzzleBook.title)).toContainText('星线谜阵', { timeout: 5000 });
}

/**
 * 在谜题书切换模式。等待目标模式按钮 aria-pressed=true，不使用固定延时。
 * @param {'classic'|'diagonal'|'hidden'|'portalClassic'|'starSingle'|'starDouble'} modeId
 */
export async function switchMode(page, modeId) {
  const card = page.locator(S.modeSwitcher.modeCard(modeId));
  await expect(card).toBeVisible({ timeout: 3000 });
  await card.click();
  await expect(card).toHaveAttribute('aria-pressed', 'true', { timeout: 3000 });
}

/**
 * 由 modeId + levelKey 解析目标关卡所属章节 key（集中、可测，覆盖五种模式）。
 * levelKey 形如 `${diff}-${idx}`；章节按各模式实际章节定义划分。
 */
export function resolveChapterKey(modeId, levelKey) {
  const [diff, idxStr] = String(levelKey).split('-');
  const lv = Number(idxStr) + 1; // 显示关卡号（1-based）
  if (modeId === 'classic' || modeId === 'diagonal') return diff; // easy / medium / hard
  if (modeId === 'portalClassic') return 'portal';
  if (modeId === 'hidden') return lv <= 10 ? 'hidden-easy' : lv <= 30 ? 'hidden-medium' : 'hidden-hard';
  if (modeId === 'starLine') return lv <= 10 ? 'star-intro' : lv <= 20 ? 'star-intro-max' : lv <= 27 ? 'star-double' : 'star-double-max';
  if (modeId === 'starSingle') return lv <= 10 ? 'star-single-intro' : 'star-single-adv';
  if (modeId === 'starDouble') return 'star-double-all';
  return diff;
}

/**
 * 进入指定模式的指定关卡。若目标关卡所在章节默认折叠，通过真实点击章节折叠按钮展开后再进入。
 */
export async function goToLevel(page, { modeId, levelKey } = {}) {
  const isStarFamily = modeId === 'starLine' || modeId === 'starSingle' || modeId === 'starDouble';

  if (isStarFamily) {
    await goToStarLineLevels(page);
    // After entering via starLineButton, the default is starSingle.
    // Switch to target mode if different.
    if (modeId === 'starDouble') {
      await switchMode(page, 'starDouble');
    }
    // starSingle is the default — no switch needed
  } else {
    await goToPuzzleBook(page);
  }

  if (modeId && !isStarFamily && modeId !== 'starLine') {
    await switchMode(page, modeId);
  }

  const tile = page.locator(S.puzzleBook.levelTile(levelKey));
  // 章节手风琴下，目标关卡所在章节可能默认折叠 —— 若不可见则展开对应章节（真实点击）
  if (!(await tile.isVisible().catch(() => false))) {
    const chapterKey = resolveChapterKey(modeId, levelKey);
    const toggle = page.locator(S.puzzleBook.chapterToggle(chapterKey));
    if (await toggle.count()) {
      await toggle.click();
    }
  }
  await expect(tile).toBeVisible({ timeout: 5000 });
  await tile.click();

  // 等待游戏面板出现
  if (isStarFamily) {
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible({ timeout: 8000 });
  } else {
    await expect(page.locator(S.game.board)).toBeVisible({ timeout: 8000 });
  }
}

/**
 * 退出游戏。先点击返回按钮，然后在退出确认弹窗中选择。
 * @param {'save'|'abandon'} action
 */
export async function exitGame(page, action = 'abandon') {
  await page.locator(S.game.backButton).click();

  if (action === 'save') {
    await expect(page.locator(S.exitPrompt.saveAndExit)).toBeVisible({ timeout: 3000 });
    await page.locator(S.exitPrompt.saveAndExit).click();
  } else if (action === 'abandon') {
    await expect(page.locator(S.exitPrompt.abandonAndExit)).toBeVisible({ timeout: 3000 });
    await page.locator(S.exitPrompt.abandonAndExit).click();
  }
}

/**
 * 打开设置面板。
 */
export async function openSettings(page) {
  await goToHome(page);
  await page.locator(S.home.settingsButtonSecondary).click();
  await expect(page.locator(S.settings.panel)).toBeVisible({ timeout: 3000 });
}

/**
 * 关闭设置面板。
 */
export async function closeSettings(page) {
  await page.locator(S.settings.closeButton).click();
  await expect(page.locator(S.settings.panel)).not.toBeVisible({ timeout: 3000 });
}
