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
 * 在谜题书切换模式。
 * @param {'classic'|'diagonal'|'hidden'|'portalClassic'} modeId
 */
export async function switchMode(page, modeId) {
  const card = page.locator(S.modeSwitcher.modeCard(modeId));
  await expect(card).toBeVisible({ timeout: 3000 });
  await card.click();
  await page.waitForTimeout(300);
}

/**
 * 进入指定模式的指定关卡。
 */
export async function goToLevel(page, { modeId, levelKey } = {}) {
  if (modeId === 'starLine') {
    await goToStarLineLevels(page);
  } else {
    await goToPuzzleBook(page);
  }

  if (modeId && modeId !== 'starLine') {
    await switchMode(page, modeId);
  }

  const tile = page.locator(S.puzzleBook.levelTile(levelKey));
  await expect(tile).toBeVisible({ timeout: 5000 });
  await tile.click();

  // 等待游戏面板出现
  if (modeId === 'starLine') {
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
