import { test, expect } from '@playwright/test';
import { clearAllGameData } from './helpers/game-state.js';
import { goToPuzzleBook } from './helpers/navigation.js';
import { S } from './helpers/selectors.js';

const pageNumbers = page => (
  page.locator(`${S.puzzleBook.levelGrid} .level-tile-number`).allTextContents()
);

async function dragHorizontally(page, locator, fromRatio, toRatio) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('关卡分页区域不可见');
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * fromRatio, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * toRatio, y, { steps: 12 });
  await page.mouse.up();
}

test.describe('关卡选择页统一分页与横向手势', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
    await goToPuzzleBook(page);
  });

  test('60 关按十关分页，按钮一次一页且章节信息同步', { tag: '@level-select-pagination' }, async ({ page }) => {
    const browser = page.locator(S.puzzleBook.levelGridWrap);
    const left = page.locator(S.puzzleBook.leftArrow);
    const right = page.locator(S.puzzleBook.rightArrow);

    await expect(browser).toHaveAttribute('data-page-count', '6');
    await expect(page.locator(S.puzzleBook.progressText)).toHaveText('1 / 6');
    await expect(page.locator(S.puzzleBook.difficultyName)).toHaveText('简单');
    expect(await pageNumbers(page)).toEqual(
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    );
    await expect(left).toBeDisabled();

    await right.click();
    await expect(page.locator(S.puzzleBook.progressText)).toHaveText('2 / 6');
    await expect(page.locator(S.puzzleBook.difficultyName)).toHaveText('中等');
    expect(await pageNumbers(page)).toEqual(
      ['11', '12', '13', '14', '15', '16', '17', '18', '19', '20'],
    );

    for (let targetPage = 3; targetPage <= 6; targetPage += 1) {
      await right.click();
      await expect(browser).toHaveAttribute('data-page', String(targetPage));
    }
    await expect(page.locator(S.puzzleBook.progressText)).toHaveText('6 / 6');
    await expect(right).toBeDisabled();

    await browser.dispatchEvent('wheel', {
      deltaX: 90,
      deltaY: 2,
      deltaMode: 0,
    });
    await expect(browser).toHaveAttribute('data-page', '6');
    await dragHorizontally(page, browser, 0.85, 0.1);
    await expect(browser).toHaveAttribute('data-page', '6');
  });

  test('连续横向 wheel 与惯性只翻一页，新手势可再翻一页', { tag: '@level-select-pagination' }, async ({ page }) => {
    const browser = page.locator(S.puzzleBook.levelGridWrap);

    await browser.dispatchEvent('wheel', {
      deltaX: 60,
      deltaY: 3,
      deltaMode: 0,
    });
    for (let index = 0; index < 8; index += 1) {
      await page.waitForTimeout(40);
      await browser.dispatchEvent('wheel', {
        deltaX: 24,
        deltaY: 2,
        deltaMode: 0,
      });
    }
    await expect(browser).toHaveAttribute('data-page', '2');

    await page.waitForTimeout(320);
    await browser.dispatchEvent('wheel', {
      deltaX: 60,
      deltaY: 2,
      deltaMode: 0,
    });
    await expect(browser).toHaveAttribute('data-page', '3');
  });

  test('纵向 wheel 与带较大纵向偏移的 wheel 不翻页', { tag: '@level-select-pagination' }, async ({ page }) => {
    const browser = page.locator(S.puzzleBook.levelGridWrap);

    await browser.dispatchEvent('wheel', {
      deltaX: 0,
      deltaY: 180,
      deltaMode: 0,
    });
    await browser.dispatchEvent('wheel', {
      deltaX: 60,
      deltaY: 50,
      deltaMode: 0,
    });
    await expect(browser).toHaveAttribute('data-page', '1');
    await expect(page.locator(S.puzzleBook.progressText)).toHaveText('1 / 6');
  });

  test('鼠标长拖只翻一页，松开后重新拖动可继续翻页', { tag: '@level-select-pagination' }, async ({ page }) => {
    const browser = page.locator(S.puzzleBook.levelGridWrap);

    await dragHorizontally(page, browser, 0.9, 0.08);
    await expect(browser).toHaveAttribute('data-page', '2');
    await page.waitForTimeout(280);
    await dragHorizontally(page, browser, 0.9, 0.08);
    await expect(browser).toHaveAttribute('data-page', '3');
  });
});
