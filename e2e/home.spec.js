import { test, expect } from '@playwright/test';
import { S } from './helpers/selectors.js';
import { goToHome, goToPuzzleBook, goToStarLineLevels } from './helpers/navigation.js';
import { clearAllGameData } from './helpers/game-state.js';

const FORBIDDEN_HOME_COPY = [
  '开发中',
  '早期样板关',
  '当前开放',
  '体验初始样板',
  '用于验证',
  '100 关全新挑战',
];

test.describe('首页', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
    await goToHome(page);
  });

  test('渲染首页标题和两个玩法入口', async ({ page }) => {
    await expect(page.locator(S.home.title)).toBeVisible();
    await expect(page.locator(S.home.title)).toHaveText('Puzzle Book');
    await expect(page.locator(S.home.oneLineCard)).toBeVisible();
    await expect(page.locator(S.home.oneLineTitle)).toHaveText('One Line');
    await expect(page.locator(S.home.starLineCard)).toBeVisible();
    await expect(page.locator(S.home.starLineTitle)).toHaveText('Star Line');
    await expect(page.locator(S.home.starLineCard)).toContainText('星线谜阵');
    await expect(page.locator(S.home.startButton)).toBeVisible();
    await expect(page.locator(S.home.startButton)).toContainText('进入 One Line');
    await expect(page.locator(S.home.starLineButton)).toBeVisible();
    await expect(page.locator(S.home.starLineButton)).toContainText('进入 Star Line');
    await expect(page.locator(S.home.settingsButtonSecondary)).toBeVisible();
  });

  test('首页入口不显示开发状态文案', async ({ page }) => {
    const homeText = await page.locator(S.home.view).innerText();
    for (const forbiddenCopy of FORBIDDEN_HOME_COPY) {
      expect(homeText).not.toContain(forbiddenCopy);
    }
  });

  test('无存档时不显示继续解谜按钮', async ({ page }) => {
    await expect(page.locator(S.home.continueButton)).not.toBeVisible();
  });

  test('点击 One Line 进入 One Line 玩法体系', async ({ page }) => {
    await page.locator(S.home.startButton).click();
    await expect(page.locator(S.puzzleBook.title)).toBeVisible({ timeout: 5000 });
    await expect(page.locator(S.modeSwitcher.modeCard('classic'))).toBeVisible();
    await expect(page.locator(S.modeSwitcher.modeCard('diagonal'))).toBeVisible();
    await expect(page.locator(S.modeSwitcher.modeCard('hidden'))).toBeVisible();
    await expect(page.locator(S.modeSwitcher.modeCard('portalClassic'))).toBeVisible();
    await expect(page.locator(S.modeSwitcher.modeCard('starLine'))).not.toBeVisible();
  });

  test('点击 Star Line 进入 Star Line 玩法体系', async ({ page }) => {
    await goToStarLineLevels(page);
    await expect(page.locator(S.modeSwitcher.focusCardName)).toContainText('星线谜阵');
    await expect(page.locator(S.modeSwitcher.modeCard('starLine'))).not.toBeVisible();
    await expect(page.locator(S.puzzleBook.levelGrid + ' > button').first()).toBeVisible();
  });

  test('右上角设置按钮可打开设置面板', async ({ page }) => {
    await page.locator(S.home.settingsButtonSecondary).click();
    await expect(page.locator(S.settings.panel)).toBeVisible({ timeout: 3000 });
  });

  test('从谜题书返回首页', async ({ page }) => {
    await goToPuzzleBook(page);
    await page.locator(S.puzzleBook.backButton).click();
    await expect(page.locator(S.home.title)).toBeVisible({ timeout: 3000 });
    await expect(page.locator(S.home.startButton)).toBeVisible();
    await expect(page.locator(S.home.starLineButton)).toBeVisible();
  });
});
