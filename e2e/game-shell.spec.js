import { test, expect } from '@playwright/test';
import { goToLevel } from './helpers/navigation.js';
import { clearAllGameData } from './helpers/game-state.js';

async function waitForStablePageFrame(page) {
  const transition = page.locator('.game-shell.page-transition');
  await expect(transition).toBeVisible();

  await transition.evaluate(async element => {
    const animations = element.getAnimations();
    await Promise.all(animations.map(animation => animation.finished.catch(() => undefined)));
  });

  await expect.poll(async () => transition.evaluate(element => {
    const transform = getComputedStyle(element).transform;
    if (transform === 'none') return true;

    const matrix = new DOMMatrixReadOnly(transform);
    return Math.abs(matrix.m41) < 0.01 && Math.abs(matrix.m42) < 0.01;
  })).toBe(true);
}

function expectBoxInsideViewport(box, viewport, bottomInset = 0) {
  expect(box).not.toBeNull();
  expect(box.width).toBeGreaterThan(0);
  expect(box.height).toBeGreaterThan(0);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height - bottomInset);
}

test.describe('桌面游戏外壳', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
  });

  for (const mode of [
    { id: 'classic', levelKey: 'easy-0', label: 'Classic' },
    { id: 'portalClassic', levelKey: 'easy-0', label: 'Portal' },
  ]) {
    test(`${mode.label} 道具条在桌面端可见`, async ({ page }) => {
      await goToLevel(page, { modeId: mode.id, levelKey: mode.levelKey });
      if (mode.id === 'portalClassic') {
        const startChallenge = page.getByRole('button', { name: '开始挑战' });
        await expect(startChallenge).toBeVisible();
        await startChallenge.click();
      }
      await waitForStablePageFrame(page);

      const toolDock = page.locator('.game-tool-dock');
      await expect(toolDock).toHaveCount(1);
      await expect(toolDock).toBeVisible();

      const viewport = page.viewportSize();
      expect(viewport).not.toBeNull();

      const dockBox = await toolDock.boundingBox();
      expect(dockBox).not.toBeNull();
      expect(dockBox.width).toBeGreaterThan(0);
      expect(dockBox.height).toBeGreaterThan(0);

      for (const label of ['恢复', '排除', '提示']) {
        const button = toolDock.locator('button').filter({ hasText: label });
        await expect(button).toBeVisible();
        expectBoxInsideViewport(await button.boundingBox(), viewport, 8);

        const textLabel = button.locator(':scope > span').last();
        await expect(textLabel).toBeVisible();
        expectBoxInsideViewport(await textLabel.boundingBox(), viewport);

        const badge = button.locator('.game-tool-button__count, .game-tool-button__price');
        await expect(badge).toHaveCount(1);
        await expect(badge).toBeVisible();
        expectBoxInsideViewport(await badge.boundingBox(), viewport);
      }

      const pageGeometry = await page.evaluate(() => ({
        documentHeight: document.documentElement.scrollHeight,
        bodyHeight: document.body.scrollHeight,
        viewportHeight: window.innerHeight,
        scrollY: window.scrollY,
      }));
      expect(pageGeometry.documentHeight).toBeLessThanOrEqual(pageGeometry.viewportHeight);
      expect(pageGeometry.bodyHeight).toBeLessThanOrEqual(pageGeometry.viewportHeight);
      expect(pageGeometry.scrollY).toBe(0);
    });
  }
});
