/**
 * 鼠标拖拽 + 键盘模拟的辅助函数。
 */

/**
 * 模拟鼠标拖拽从一个 cell 到另一个 cell。
 * 使用分步移动模拟真实鼠标轨迹，触发 pointermove 事件链。
 */
export async function dragCellToCell(page, fromIndex, toIndex, { steps = 8, stepDelay = 16 } = {}) {
  const fromCell = page.locator(`[data-index="${fromIndex}"]`).first();
  const toCell = page.locator(`[data-index="${toIndex}"]`).first();

  const fromBox = await fromCell.boundingBox();
  const toBox = await toCell.boundingBox();
  if (!fromBox || !toBox) throw new Error(`Cell bounds not found: ${fromIndex} -> ${toIndex}`);

  const fromX = fromBox.x + fromBox.width / 2;
  const fromY = fromBox.y + fromBox.height / 2;
  const toX = toBox.x + toBox.width / 2;
  const toY = toBox.y + toBox.height / 2;

  // pointerdown 在起始 cell
  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  await page.waitForTimeout(80);

  // 分步移动到目标 cell
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      fromX + (toX - fromX) * (i / steps),
      fromY + (toY - fromY) * (i / steps),
      { steps: 1 }
    );
    await page.waitForTimeout(stepDelay);
  }

  await page.mouse.up();
  await page.waitForTimeout(100);
}

/**
 * 从当前 path head（或指定起始 index）开始画线，依次拖拽经过整个路径。
 * 用于测试时先 pointerdown 开工，然后依次连接后续 cell。
 *
 * @param {import('@playwright/test').Page} page
 * @param {number[]} pathIndices - 完整的 cell 索引序列（包含起点）
 */
export async function dragPath(page, pathIndices) {
  if (pathIndices.length < 2) return;

  // pointerdown 在起点
  const first = pathIndices[0];
  const firstCell = page.locator(`[data-index="${first}"]`).first();
  const firstBox = await firstCell.boundingBox();
  if (!firstBox) throw new Error(`Start cell not found: ${first}`);

  await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(80);

  // 依次移动到每个后续 cell
  for (let i = 1; i < pathIndices.length; i++) {
    const targetCell = page.locator(`[data-index="${pathIndices[i]}"]`).first();
    const targetBox = await targetCell.boundingBox();
    if (!targetBox) continue;

    const tx = targetBox.x + targetBox.width / 2;
    const ty = targetBox.y + targetBox.height / 2;
    await page.mouse.move(tx, ty, { steps: 4 });
    await page.waitForTimeout(60);
  }

  await page.mouse.up();
  await page.waitForTimeout(200);
}

/**
 * 按下一个键并保持一段时间后松开。
 * @param {import('@playwright/test').Page} page
 * @param {string} key - 如 'w', 'a', 's', 'd', 'KeyW' 等
 * @param {number} duration - 按住时长 ms，默认 60
 */
export async function pressKey(page, key, duration = 60) {
  await page.keyboard.down(key);
  await page.waitForTimeout(duration);
  await page.keyboard.up(key);
}

/**
 * 模拟键盘连续移动序列。
 * @param {import('@playwright/test').Page} page
 * @param {string[]} keys - 按键序列，如 ['w', 'w', 'd', 'd']
 * @param {number} interval - 两次按键之间的间隔 ms，默认 100（>50ms debounce）
 */
export async function pressKeySequence(page, keys, interval = 100) {
  for (const key of keys) {
    await pressKey(page, key, 60);
    await page.waitForTimeout(interval);
  }
}

/**
 * 快速点击一个 cell（pointerdown + pointerup，不拖拽）。
 * 用于测试回溯（点击前一个 cell）或错误点击。
 */
export async function tapCell(page, cellIndex) {
  const cell = page.locator(`[data-index="${cellIndex}"]`).first();
  const box = await cell.boundingBox();
  if (!box) throw new Error(`Cell not found: ${cellIndex}`);

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.waitForTimeout(30);
  await page.mouse.up();
  await page.waitForTimeout(100);
}
