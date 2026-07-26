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

test.describe('首页', { tag: '@critical' }, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
    await goToHome(page);
  });

  test('渲染首页标题和两个玩法入口', async ({ page }) => {
    await expect(page.locator(S.home.title)).toBeVisible();
    await expect(page.locator(S.home.title)).toHaveText('Linebook');
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
    expect(homeText).not.toContain('请选择你的谜题');
    expect(homeText).not.toContain('经典模式 · 隐迹连线 · 八向连线 · 经典传送门');
  });

  test('hover 两个玩法卡片不会报错', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.locator(S.home.oneLineCard).hover();
    await page.waitForTimeout(120);
    await page.mouse.move(4, 4);
    await page.locator(S.home.starLineCard).hover();
    await page.waitForTimeout(120);

    expect(pageErrors).toEqual([]);
    await expect(page.locator(S.home.oneLineCard)).toBeVisible();
    await expect(page.locator(S.home.starLineCard)).toBeVisible();
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
    await expect(page.locator(S.puzzleBook.title)).toContainText('星线谜阵');
    await expect(page.locator(S.puzzleBook.cta)).toBeVisible();
    await expect(page.locator(S.modeSwitcher.modeCard('starLine'))).not.toBeVisible();
    await expect(page.locator(S.puzzleBook.anyTile).first()).toBeVisible();
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
