import { expect } from '@playwright/test';

export async function openDevCandidatePanel(page) {
  await page.locator('[data-testid="home-settings-button-secondary"]').click();
  await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible();

  const gmButton = page.getByRole('button', { name: /GM 控制台/ });
  await expect(gmButton).toBeVisible();
  await gmButton.click();

  await expect(page.getByText('GM Console', { exact: true })).toBeVisible();
  await expect(page.getByText('Dev 试玩关卡').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /试玩/ }).first()).toBeVisible();
}

export async function startFirstDevCandidate(page) {
  await openDevCandidatePanel(page);
  await page.getByRole('button', { name: /试玩/ }).first().click();
  await expect(page.locator('[data-testid="mode-label"]')).toContainText('CANDIDATE');
  await expect(page.getByText('候选审核', { exact: true })).toBeVisible();
}
