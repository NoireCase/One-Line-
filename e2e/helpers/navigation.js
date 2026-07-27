import { expect } from '@playwright/test';
import { S } from './selectors.js';
import {
  STAR_SINGLE_MODE_ID,
  STAR_DOUBLE_MODE_ID,
  findChapterForLevel,
} from '../../src/game/starLine/starLineMetadata.js';

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
  await expect(page.locator(S.puzzleBook.title)).toHaveText('STAR LINE', { timeout: 5000 });
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
  if (modeId === 'starSingle') {
    const chapter = findChapterForLevel(STAR_SINGLE_MODE_ID, lv);
    return chapter?.chapterId || 'star-single-intro';
  }
  if (modeId === 'starDouble') {
    const chapter = findChapterForLevel(STAR_DOUBLE_MODE_ID, lv);
    return chapter?.chapterId || 'star-double-intro';
  }
  return diff;
}

/**
 * 进入指定模式的指定关卡。V3.1 先定位难度，再通过网格方向键按五关窗口浏览。
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

  const gridWrap = page.locator(S.puzzleBook.levelGridWrap);
  await expect(gridWrap).toBeVisible({ timeout: 5000 });

  // 完整玩法默认 sealed。通用导航 helper 代表测试明确要进入关卡，因此先走真实重玩确认。
  if (await gridWrap.getAttribute('data-completion-view') === 'sealed') {
    await gridWrap.click({ position: { x: 4, y: 4 } });
    await expect(page.locator(S.puzzleBook.replayDialog)).toBeVisible();
    await page.locator(S.puzzleBook.replayConfirm).click();
    await expect(gridWrap).toHaveAttribute('data-completion-view', 'replay');
  }

  const [, idxText] = String(levelKey).split('-');
  const localIndex = Number(idxText);
  let targetDifficultyIndex = 0;
  if (modeId === 'classic' || modeId === 'diagonal') {
    const diff = String(levelKey).split('-')[0];
    targetDifficultyIndex = { easy: 0, medium: 1, hard: 2 }[diff] ?? 0;
  } else if (modeId === 'hidden') {
    targetDifficultyIndex = localIndex < 10 ? 0 : localIndex < 30 ? 1 : 2;
  } else if (modeId === 'starSingle' || modeId === 'starDouble') {
    const mode = modeId === 'starSingle' ? STAR_SINGLE_MODE_ID : STAR_DOUBLE_MODE_ID;
    const chapterId = findChapterForLevel(mode, localIndex + 1)?.chapterId;
    const chapterOrder = ['intro', 'basic', 'intermediate', 'advanced', 'final'];
    targetDifficultyIndex = Math.max(
      0,
      chapterOrder.findIndex(part => chapterId?.endsWith(part)),
    );
  }

  const leftArrow = page.locator(S.puzzleBook.leftArrow);
  for (let attempt = 0; attempt < 6 && await leftArrow.isVisible(); attempt += 1) {
    await leftArrow.click();
  }
  const rightArrow = page.locator(S.puzzleBook.rightArrow);
  for (let index = 0; index < targetDifficultyIndex; index += 1) {
    await expect(rightArrow).toBeVisible();
    await rightArrow.click();
  }

  const tile = page.locator(S.puzzleBook.levelTile(levelKey));
  for (let attempt = 0; attempt < 12 && !(await tile.isVisible().catch(() => false)); attempt += 1) {
    await gridWrap.press('ArrowDown');
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
