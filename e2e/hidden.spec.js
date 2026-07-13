import { test, expect } from '@playwright/test';
import { goToPuzzleBook } from './helpers/navigation.js';

test.describe('Hidden / 极简线索', () => {

  test('H1. 极简线索模式入口存在', async ({ page }) => {
    await goToPuzzleBook(page);
    const hiddenModeEntry = page.locator('.mode-bookmarks-track').getByText('极简线索');
    await expect(hiddenModeEntry).toBeVisible();
  });

  test('H2. Hidden 显示 60 个关卡 (Easy 10 + Medium 20 + Hard 30)', async ({ page }) => {
    await goToPuzzleBook(page);
    await page.locator('[data-testid="mode-card-hidden"]').scrollIntoViewIfNeeded();
    await page.locator('[data-testid="mode-card-hidden"]').click({ force: true });
    await page.waitForTimeout(500);

    // Progress text should show 20 total (Easy 10 + Medium 10)
    const progressText = page.locator('[data-testid="level-progress-text"]');
    await expect(progressText).toContainText('60');
  });

  test('H3. Classic / Diagonal / Portal 入口不受影响', async ({ page }) => {
    await goToPuzzleBook(page);
    await expect(page.getByText('经典模式').first()).toBeVisible();
    await expect(page.getByText('八向连线').first()).toBeVisible();
  });
});
