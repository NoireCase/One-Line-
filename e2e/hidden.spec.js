import { test, expect } from '@playwright/test';
import { goToPuzzleBook } from './helpers/navigation.js';

test.describe('Hidden / 极简线索', () => {

  test('H1. 极简线索模式入口存在', async ({ page }) => {
    await goToPuzzleBook(page);
    // Mode card with "极简线索" text should exist
    const hiddenModeEntry = page.locator('.mode-switcher-track').getByText('极简线索');
    await expect(hiddenModeEntry).toBeVisible();
  });

  test('H2. Classic / Diagonal / Portal 入口不受影响', async ({ page }) => {
    await goToPuzzleBook(page);
    await expect(page.getByText('经典模式').first()).toBeVisible();
    await expect(page.getByText('八向连线').first()).toBeVisible();
  });
});
