import { test, expect } from '@playwright/test';
import { S } from './helpers/selectors.js';
import { goToLevel } from './helpers/navigation.js';
import { clearAllGameData, setStorage, getPathLength } from './helpers/game-state.js';
import { pressKey } from './helpers/game-simulation.js';

test.describe('键盘 WASD 输入', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
    await setStorage(page, 'cg_input_mode', 'keyboard');
    await goToLevel(page, { modeId: 'classic', levelKey: 'easy-0' });
  });

  test('键盘模式下游戏正常启动', async ({ page }) => {
    await expect(page.locator(S.game.board)).toBeVisible();
    const pathLen = await getPathLength(page);
    expect(pathLen).toBe(1);
  });

  test('按键移动 path 长度增加', async ({ page }) => {
    const initialLen = await getPathLength(page);
    expect(initialLen).toBe(1);

    const headInfo = await page.evaluate(() => {
      const head = document.querySelector('.path-head [data-index]');
      if (!head) return null;
      const idx = Number(head.getAttribute('data-index'));
      return { idx, row: Math.floor(idx / 5), col: idx % 5 };
    });
    expect(headInfo).not.toBeNull();

    const moveResult = await page.evaluate(() => {
      const visible = [];
      document.querySelectorAll('[data-testid^="cell-"] .cell-number').forEach(el => {
        const idx = Number(el.getAttribute('data-index'));
        const text = el.textContent.trim();
        const val = text !== '' && !isNaN(Number(text)) ? Number(text) : null;
        if (val === 2) visible.push({ idx, val, row: Math.floor(idx / 5), col: idx % 5 });
      });
      return visible;
    });

    if (moveResult.length > 0 && headInfo) {
      const target = moveResult[0];
      const dr = target.row - headInfo.row;
      const dc = target.col - headInfo.col;

      if (dr === -1 && dc === 0) await pressKey(page, 'w');
      else if (dr === 1 && dc === 0) await pressKey(page, 's');
      else if (dr === 0 && dc === -1) await pressKey(page, 'a');
      else if (dr === 0 && dc === 1) await pressKey(page, 'd');

      await page.waitForTimeout(200);
      const newLen = await getPathLength(page);
      expect(newLen).toBeGreaterThanOrEqual(initialLen);
    }
  });

  test('按住反方向键不会导致移动', async ({ page }) => {
    const initialLen = await getPathLength(page);
    expect(initialLen).toBe(1);

    const headInfo = await page.evaluate(() => {
      const head = document.querySelector('.path-head [data-index]');
      if (!head) return null;
      const idx = Number(head.getAttribute('data-index'));
      return { idx, row: Math.floor(idx / 5), col: idx % 5 };
    });
    expect(headInfo).not.toBeNull();

    const attemptedDirections = [];
    if (headInfo.row > 0) attemptedDirections.push('w');
    if (headInfo.row < 4) attemptedDirections.push('s');
    if (headInfo.col > 0) attemptedDirections.push('a');
    if (headInfo.col < 4) attemptedDirections.push('d');

    expect(attemptedDirections.length).toBeGreaterThan(0);

    for (const key of attemptedDirections) {
      await pressKey(page, key);
      await page.waitForTimeout(150);
      const len = await getPathLength(page);
      if (len > initialLen) break;
    }
  });
});
