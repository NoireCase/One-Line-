// P4B 数字环线 Spike · 原型聚焦浏览器测试（DEV-only）
import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const PROTOTYPE_URL = '/?prototype=digital-loop';

async function gotoPrototype(page) {
  await page.goto(PROTOTYPE_URL);
  await expect(page.getByTestId('digital-loop-prototype')).toBeVisible();
}

async function clickEdge(page, key) {
  const box = await page.getByTestId(`edge-${key}`).boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function dragAcross(page, keys) {
  const boxes = [];
  for (const key of keys) {
    const box = await page.getByTestId(`edge-${key}`).boundingBox();
    expect(box).toBeTruthy();
    boxes.push({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
  }
  await page.mouse.move(boxes[0].x, boxes[0].y);
  await page.mouse.down();
  for (const point of boxes.slice(1)) {
    await page.mouse.move(point.x, point.y, { steps: 8 });
  }
  await page.mouse.up();
}

test('DEV-only 入口可进入，正式默认入口不显示原型', async ({ page }) => {
  await gotoPrototype(page);
  await expect(page.getByTestId('digital-loop-board')).toBeVisible();

  await page.goto('/');
  await expect(page.getByTestId('digital-loop-prototype')).toHaveCount(0);
  // 正式首页照常渲染
  await expect(page.locator('[data-testid="home-view"]')).toBeVisible();
});

test('正式 GAME_MODES / 家族配置不包含原型，原型不注册假 mode', async () => {
  const gameModes = fs.readFileSync('src/config/gameModes.js', 'utf8');
  const appJsx = fs.readFileSync('src/App.jsx', 'utf8');
  const designSystem = fs.readFileSync('docs/game-family-design-system.md', 'utf8');
  expect(gameModes).not.toContain('digital-loop');
  expect(designSystem).not.toMatch(/GAME_MODES[^\n]*digital-loop/);
  // App 对原型只有集中调用点，且仅参数命中时挂载
  expect(appJsx.match(/DigitalLoopPrototypeHost/g)?.length ?? 0).toBeLessThanOrEqual(2);
});

test('场景切换更新棋盘与诊断信息', async ({ page }) => {
  await gotoPrototype(page);
  await page.getByTestId('scene-select').selectOption('pressure-11');
  await expect(page.getByTestId('diag-scene')).toHaveText('pressure-11');
  await expect(page.getByTestId('diag-board size')).toHaveText('11×11');
  await expect(page.getByTestId('diag-edge total')).toHaveText('264');
});

test('单 Edge 点击添加 line 并可 Undo', async ({ page }) => {
  await gotoPrototype(page);
  await clickEdge(page, 'h:2:1');
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'line');
  await page.getByTestId('undo-button').click();
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'undecided');
});

test('单击 line 擦除为单边手势，Undo 可恢复', async ({ page }) => {
  await gotoPrototype(page);
  await clickEdge(page, 'h:2:1');
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'line');
  // 单击已有 line → 擦除回 undecided（单边手势）
  await clickEdge(page, 'h:2:1');
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'undecided');
  await expect(page.getByTestId('diag-undo steps')).toHaveText('2');
  // 两次 Undo 分别回滚擦除与添加
  await page.getByTestId('undo-button').click();
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'line');
  await page.getByTestId('undo-button').click();
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'undecided');
});

test('连续拖动跨多边，一次 Undo 回滚完整手势', async ({ page }) => {
  await gotoPrototype(page);
  await dragAcross(page, ['h:2:1', 'h:2:2', 'h:2:3']);
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'line');
  await expect(page.getByTestId('edge-h:2:2')).toHaveAttribute('data-edge-state', 'line');
  await expect(page.getByTestId('edge-h:2:3')).toHaveAttribute('data-edge-state', 'line');
  await expect(page.getByTestId('diag-undo steps')).toHaveText('1');
  await page.getByTestId('undo-button').click();
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'undecided');
  await expect(page.getByTestId('edge-h:2:2')).toHaveAttribute('data-edge-state', 'undecided');
  await expect(page.getByTestId('edge-h:2:3')).toHaveAttribute('data-edge-state', 'undecided');
  await expect(page.getByTestId('diag-undo steps')).toHaveText('0');
});

test('Reset 恢复场景初始状态', async ({ page }) => {
  await gotoPrototype(page);
  await clickEdge(page, 'h:3:1');
  await expect(page.getByTestId('edge-h:3:1')).toHaveAttribute('data-edge-state', 'line');
  await page.getByTestId('reset-button').click();
  await expect(page.getByTestId('edge-h:3:1')).toHaveAttribute('data-edge-state', 'undecided');
  await expect(page.getByTestId('diag-undo steps')).toHaveText('0');
});

test('默认界面不显示独立 Erase 工具', async ({ page }) => {
  await gotoPrototype(page);
  await expect(page.getByTestId('tool-erase')).toHaveCount(0);
  await expect(page.getByTestId('desktop-instructions')).toBeVisible();
  // 方案区折叠在 DEV Debug 内，不占据主操作区
  await expect(page.getByTestId('input-scheme-controls')).toBeHidden();
});

test('DEV Debug 内 A/B/C 历史比较：方案 B 只剩 Line / X', async ({ page }) => {
  await gotoPrototype(page);
  await page.locator('[data-testid="hit-debug-section"] summary').click();
  await expect(page.getByTestId('input-scheme-controls')).toBeVisible();
  await page.getByTestId('scheme-b').click();
  await expect(page.getByTestId('toolbar-b')).toBeVisible();
  await expect(page.getByTestId('tool-line')).toBeVisible();
  await expect(page.getByTestId('tool-excluded')).toBeVisible();
  await expect(page.getByTestId('tool-erase')).toHaveCount(0);
  await page.getByTestId('scheme-c').click();
  await expect(page.getByTestId('toolbar-b')).toHaveCount(0);
  // 回到默认方案 A
  await page.getByTestId('scheme-a').click();
});

test('方案 B X 工具点按标记 excluded', async ({ page }) => {
  await gotoPrototype(page);
  await page.locator('[data-testid="hit-debug-section"] summary').click();
  await page.getByTestId('scheme-b').click();
  await page.getByTestId('tool-excluded').click();
  await clickEdge(page, 'h:2:1');
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'excluded');
  await page.getByTestId('undo-button').click();
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'undecided');
});

test('方案 A secondary 键 toggle excluded（鼠标右键）', async ({ page }) => {
  await gotoPrototype(page);
  const box = await page.getByTestId('edge-h:2:1').boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'excluded');
});

test('窗口失焦等效 pointercancel：拖动中无残留', async ({ page }) => {
  await gotoPrototype(page);
  const box1 = await page.getByTestId('edge-h:2:1').boundingBox();
  const box3 = await page.getByTestId('edge-h:2:3').boundingBox();
  expect(box1).toBeTruthy();
  expect(box3).toBeTruthy();
  await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2);
  await page.mouse.down();
  await page.mouse.move(box3.x + box3.width / 2, box3.y + box3.height / 2, { steps: 8 });
  // 未释放即失焦 → 手势整体回滚
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.mouse.up();
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'undecided');
  await expect(page.getByTestId('edge-h:2:2')).toHaveAttribute('data-edge-state', 'undecided');
  await expect(page.getByTestId('edge-h:2:3')).toHaveAttribute('data-edge-state', 'undecided');
  await expect(page.getByTestId('diag-undo steps')).toHaveText('0');
});

test('390×844 视口：无页面纵向滚动', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoPrototype(page);
  const scrollInfo = await page.evaluate(() => ({
    scrollY: window.scrollY,
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
  }));
  expect(scrollInfo.scrollY).toBe(0);
  expect(scrollInfo.scrollHeight).toBeLessThanOrEqual(scrollInfo.innerHeight + 1);
  // 基础输入仍可用
  await clickEdge(page, 'h:2:1');
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'line');
});

test('原型不写入任何正式 localStorage key', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await gotoPrototype(page);
  const before = await page.evaluate(() => Object.keys(localStorage));
  await clickEdge(page, 'h:2:1');
  await page.getByTestId('undo-button').click();
  await page.getByTestId('scene-select').selectOption('pressure-11');
  await page.locator('[data-testid="hit-debug-section"] summary').click();
  await page.getByTestId('scheme-b').click();
  const after = await page.evaluate(() => Object.keys(localStorage));
  expect(after).toEqual(before);
});

test('无数字单环不显示 COMPLETE：仅结构诊断', async ({ page }) => {
  await gotoPrototype(page);
  // 场景 6：无数字单环，结构 Closed Single Loop，但不得判定完成
  await page.getByTestId('scene-select').selectOption('single-loop-no-clue');
  await expect(page.getByTestId('diag-structure')).toHaveText('Closed Single Loop');
  await expect(page.getByTestId('diag-has clues')).toHaveText('no');
  await expect(page.getByTestId('diag-completion')).toHaveText('not complete');
  await expect(page.getByTestId('no-clue-note')).toBeVisible();
  await expect(page.getByTestId('completion-banner')).toHaveCount(0);
  // 无正式 WinPanel / 奖励文案 / 完成流程
  await expect(page.locator('[data-testid*="win"], [data-testid*="Win"], [data-testid*="win-panel"]')).toHaveCount(0);
  await expect(page.getByTestId('digital-loop-prototype')).toBeVisible();
});

test('结构诊断在浏览器端显示（分支场景）', async ({ page }) => {
  await gotoPrototype(page);
  await page.getByTestId('scene-select').selectOption('branch-create');
  await expect(page.getByTestId('diag-structure')).toHaveText('Branch');
  await page.getByTestId('scene-select').selectOption('two-loops');
  await expect(page.getByTestId('diag-structure')).toHaveText('Multiple Loops');
});

// ── 桌面双通道输入（本轮收敛）──

async function clickEdgeAtRatio(page, key, ratio) {
  const box = await page.getByTestId(`edge-${key}`).boundingBox();
  expect(box).toBeTruthy();
  // 横边取横向比例、竖边取纵向比例（box 宽/高对应边方向）
  const isVertical = key.startsWith('v:');
  const x = box.x + (isVertical ? box.width / 2 : box.width * ratio);
  const y = box.y + (isVertical ? box.height * ratio : box.height / 2);
  await page.mouse.click(x, y);
}

test('右键点击空 Edge 添加 X，再点击 X 删除 X', async ({ page }) => {
  await gotoPrototype(page);
  const box = await page.getByTestId('edge-h:2:1').boundingBox();
  expect(box).toBeTruthy();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.click(cx, cy, { button: 'right' });
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'excluded');
  await page.mouse.click(cx, cy, { button: 'right' });
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'undecided');
});

test('左键不能覆盖 X；右键不能覆盖 line（强制互斥）', async ({ page }) => {
  await gotoPrototype(page);
  const box = await page.getByTestId('edge-h:2:1').boundingBox();
  expect(box).toBeTruthy();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  // 右键加 X → 左键点击 → 仍 excluded
  await page.mouse.click(cx, cy, { button: 'right' });
  await page.mouse.click(cx, cy);
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'excluded', '左键不覆盖 X');
  // 左键加 line → 右键点击 → 仍 line
  await page.getByTestId('undo-button').click();
  await page.mouse.click(cx, cy);
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'line');
  await page.mouse.click(cx, cy, { button: 'right' });
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'line', '右键不覆盖 line');
});

test('线和 X 不同时渲染（唯一状态不变量）', async ({ page }) => {
  await gotoPrototype(page);
  await clickEdge(page, 'h:2:1');
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'line');
  // 同一 key 只有一个元素且状态唯一
  const count = await page.getByTestId('edge-h:2:1').count();
  expect(count).toBe(1);
  // 左键不能覆盖为 excluded
  const box = await page.getByTestId('edge-h:2:1').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'line');
});

test('Edge 10% / 90% 位置可命中（无明显死区）', async ({ page }) => {
  await gotoPrototype(page);
  await clickEdgeAtRatio(page, 'h:2:1', 0.1);
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'line');
  await page.getByTestId('undo-button').click();
  await clickEdgeAtRatio(page, 'h:2:1', 0.9);
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'line');
  await page.getByTestId('undo-button').click();
  await clickEdgeAtRatio(page, 'v:2:1', 0.1);
  await expect(page.getByTestId('edge-v:2:1')).toHaveAttribute('data-edge-state', 'line');
  await page.getByTestId('undo-button').click();
  await clickEdgeAtRatio(page, 'v:2:1', 0.9);
  await expect(page.getByTestId('edge-v:2:1')).toHaveAttribute('data-edge-state', 'line');
});

test('点击 X 图形中心可命中（装饰图层不拦截事件）', async ({ page }) => {
  await gotoPrototype(page);
  // 主方案：右键加 X，然后点击 X 中心删除
  const box = await page.getByTestId('edge-h:2:1').boundingBox();
  expect(box).toBeTruthy();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.click(cx, cy, { button: 'right' });
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'excluded');
  // 点击 X 图形中心（同一点）→ 删除 X
  await page.mouse.click(cx, cy, { button: 'right' });
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'undecided');
});

test('Hover Edge 与 pointerdown Edge 一致（同一 hit 事实源）', async ({ page }) => {
  await gotoPrototype(page);
  const box = await page.getByTestId('edge-h:2:1').boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId('hover-overlay')).toHaveAttribute('data-hover-key', 'h:2:1');
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'line', 'hover 与点击一致');
});

test('右键拖动连续添加 X，一次 Undo 全回滚', async ({ page }) => {
  await gotoPrototype(page);
  const box1 = await page.getByTestId('edge-h:2:1').boundingBox();
  const box3 = await page.getByTestId('edge-h:2:3').boundingBox();
  expect(box1).toBeTruthy();
  expect(box3).toBeTruthy();
  await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(box3.x + box3.width / 2, box3.y + box3.height / 2, { steps: 8 });
  await page.mouse.up({ button: 'right' });
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'excluded');
  await expect(page.getByTestId('edge-h:2:2')).toHaveAttribute('data-edge-state', 'excluded');
  await expect(page.getByTestId('edge-h:2:3')).toHaveAttribute('data-edge-state', 'excluded');
  await expect(page.getByTestId('diag-undo steps')).toHaveText('1');
  await page.getByTestId('undo-button').click();
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'undecided');
  await expect(page.getByTestId('edge-h:2:2')).toHaveAttribute('data-edge-state', 'undecided');
  await expect(page.getByTestId('edge-h:2:3')).toHaveAttribute('data-edge-state', 'undecided');
});

test('直角转弯拖动连续（横边 → 竖边）', async ({ page }) => {
  await gotoPrototype(page);
  const boxes = {};
  for (const key of ['h:2:1', 'h:2:2', 'v:2:2', 'v:3:2']) {
    const box = await page.getByTestId(`edge-${key}`).boundingBox();
    expect(box).toBeTruthy();
    boxes[key] = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }
  await page.mouse.move(boxes['h:2:1'].x, boxes['h:2:1'].y);
  await page.mouse.down();
  await page.mouse.move(boxes['h:2:2'].x, boxes['h:2:2'].y, { steps: 6 });
  await page.mouse.move(boxes['v:2:2'].x, boxes['v:2:2'].y, { steps: 6 });
  await page.mouse.move(boxes['v:3:2'].x, boxes['v:3:2'].y, { steps: 6 });
  await page.mouse.up();
  for (const key of ['h:2:1', 'h:2:2', 'v:2:2', 'v:3:2']) {
    await expect(page.getByTestId(`edge-${key}`)).toHaveAttribute('data-edge-state', 'line');
  }
  await expect(page.getByTestId('diag-undo steps')).toHaveText('1');
});

test('5×5、10×10、11×11 均可操作', async ({ page }) => {
  await gotoPrototype(page);
  for (const sceneId of ['pressure-10', 'pressure-11']) {
    await page.getByTestId('scene-select').selectOption(sceneId);
    // h:0:0 在压力场景中为初始 undecided（避开场景初始 lineKeys）
    await clickEdge(page, 'h:0:0');
    await expect(page.getByTestId('edge-h:0:0')).toHaveAttribute('data-edge-state', 'line');
    await page.getByTestId('reset-button').click();
  }
});

test('context menu 不在棋盘弹出（preventDefault 生效）', async ({ page }) => {
  await gotoPrototype(page);
  const prevented = await page.evaluate(() => {
    const board = document.querySelector('[data-testid="digital-loop-board"]');
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    return board.dispatchEvent(ev) === false;
  });
  expect(prevented).toBe(true);
});
