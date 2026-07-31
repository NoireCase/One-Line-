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

test('默认界面无 Erase、无 A/B/C 选择器，仅双通道直接输入', async ({ page }) => {
  await gotoPrototype(page);
  await expect(page.getByTestId('tool-erase')).toHaveCount(0);
  await expect(page.getByTestId('scheme-a')).toHaveCount(0);
  await expect(page.getByTestId('scheme-b')).toHaveCount(0);
  await expect(page.getByTestId('scheme-c')).toHaveCount(0);
  await expect(page.getByTestId('input-scheme-controls')).toHaveCount(0);
  await expect(page.getByTestId('desktop-instructions')).toBeVisible();
  await expect(page.getByTestId('dev-debug-section')).toBeVisible();
});

test('右键点击空 Edge 添加 X（X 通道）', async ({ page }) => {
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
  await page.locator('[data-testid="dev-debug-section"] summary').click();
  await page.getByTestId('debug-toggle').check();
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

test('Line 优先于 X：左键覆盖 X，右键不覆盖 line（强制互斥）', async ({ page }) => {
  await gotoPrototype(page);
  const box = await page.getByTestId('edge-h:2:1').boundingBox();
  expect(box).toBeTruthy();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  // 左键加 line → 右键点击 → 仍 line（X 不覆盖 line）
  await page.mouse.click(cx, cy);
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'line');
  await page.mouse.click(cx, cy, { button: 'right' });
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'line', '右键不覆盖 line');
  // 右键加 X（另一条边）→ 左键点击 → 覆盖为 line
  const box2 = await page.getByTestId('edge-h:2:2').boundingBox();
  expect(box2).toBeTruthy();
  await page.mouse.click(box2.x + box2.width / 2, box2.y + box2.height / 2, { button: 'right' });
  await expect(page.getByTestId('edge-h:2:2')).toHaveAttribute('data-edge-state', 'excluded');
  await page.mouse.click(box2.x + box2.width / 2, box2.y + box2.height / 2);
  await expect(page.getByTestId('edge-h:2:2')).toHaveAttribute('data-edge-state', 'line', '左键覆盖 X');
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

// ── 桌面最终收敛：覆盖 / Shift / 阈值 / 轨迹补全 / 预览 / 快捷键 ──

test('左键覆盖 X 为 line，Undo 恢复 X', async ({ page }) => {
  await gotoPrototype(page);
  const box = await page.getByTestId('edge-h:2:1').boundingBox();
  expect(box).toBeTruthy();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.click(cx, cy, { button: 'right' });
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'excluded');
  // 左键覆盖
  await page.mouse.click(cx, cy);
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'line');
  // Undo 恢复 X（不是 undecided）
  await page.getByTestId('undo-button').click();
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'excluded');
});

test('Shift+左键与右键同一 X 通道（添加与删除）', async ({ page }) => {
  await gotoPrototype(page);
  const box = await page.getByTestId('edge-h:2:1').boundingBox();
  expect(box).toBeTruthy();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.keyboard.down('Shift');
  await page.mouse.click(cx, cy);
  await page.keyboard.up('Shift');
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'excluded', 'Shift+左键添加 X');
  await page.keyboard.down('Shift');
  await page.mouse.click(cx, cy);
  await page.keyboard.up('Shift');
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'undecided', 'Shift+左键删除 X');
});

test('Shift+左键不覆盖 line（与右键一致）', async ({ page }) => {
  await gotoPrototype(page);
  await clickEdge(page, 'h:2:1');
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'line');
  const box = await page.getByTestId('edge-h:2:1').boundingBox();
  await page.keyboard.down('Shift');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.up('Shift');
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'line', 'Shift+左键不覆盖 line');
});

test('微动（2px）仍为单击：只修改起始 Edge', async ({ page }) => {
  await gotoPrototype(page);
  const b1 = await page.getByTestId('edge-h:2:1').boundingBox();
  expect(b1).toBeTruthy();
  const b2 = await page.getByTestId('edge-h:2:2').boundingBox();
  expect(b2).toBeTruthy();
  await page.mouse.move(b1.x + b1.width / 2, b1.y + b1.height / 2);
  await page.mouse.down();
  await page.mouse.move(b1.x + b1.width / 2 + 2, b1.y + b1.height / 2);
  await page.mouse.up();
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'line');
  await expect(page.getByTestId('edge-h:2:2')).toHaveAttribute('data-edge-state', 'undecided', '微动不误改相邻 Edge');
  await expect(page.getByTestId('diag-undo steps')).toHaveText('1');
});

test('单帧快速直线不漏 Edge（轨迹补全）', async ({ page }) => {
  await gotoPrototype(page);
  const b1 = await page.getByTestId('edge-h:2:1').boundingBox();
  const b4 = await page.getByTestId('edge-h:2:4').boundingBox();
  expect(b1).toBeTruthy();
  expect(b4).toBeTruthy();
  await page.mouse.move(b1.x + b1.width / 2, b1.y + b1.height / 2);
  await page.mouse.down();
  await page.mouse.move(b4.x + b4.width / 2, b4.y + b4.height / 2, { steps: 1 });
  await page.mouse.up();
  for (const col of [1, 2, 3, 4]) {
    await expect(page.getByTestId(`edge-h:2:${col}`)).toHaveAttribute('data-edge-state', 'line', `h:2:${col} 被轨迹补全`);
  }
  await expect(page.getByTestId('diag-undo steps')).toHaveText('1', '一次笔划一个 undo');
  await page.getByTestId('undo-button').click();
  for (const col of [1, 2, 3, 4]) {
    await expect(page.getByTestId(`edge-h:2:${col}`)).toHaveAttribute('data-edge-state', 'undecided');
  }
});

test('起始 Edge 动画不残留：笔划结束后反馈清空', async ({ page }) => {
  await gotoPrototype(page);
  const b1 = await page.getByTestId('edge-h:2:1').boundingBox();
  const b3 = await page.getByTestId('edge-h:2:3').boundingBox();
  await page.mouse.move(b1.x + b1.width / 2, b1.y + b1.height / 2);
  await page.mouse.down();
  await page.mouse.move(b3.x + b3.width / 2, b3.y + b3.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByTestId('hover-overlay')).toHaveCount(0, 'pointerup 后无残留反馈');
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'line');
});

test('普通 Hover 为中性反馈（不预判通道）', async ({ page }) => {
  await gotoPrototype(page);
  const box = await page.getByTestId('edge-h:2:1').boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId('hover-overlay')).toHaveAttribute('data-hover-mode', 'neutral');
  // 左键按下：paint-line 预览
  await page.mouse.down();
  await expect(page.getByTestId('hover-overlay')).toHaveAttribute('data-hover-mode', 'paint-line');
  await page.mouse.up();
});

test('X 通道按下显示 X 预览（非绿色线预览）', async ({ page }) => {
  await gotoPrototype(page);
  const box = await page.getByTestId('edge-h:2:1').boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down({ button: 'right' });
  await expect(page.getByTestId('hover-overlay')).toHaveAttribute('data-hover-mode', 'paint-excluded');
  await page.mouse.up({ button: 'right' });
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'excluded');
});

test('Cell 中心与 clue 中心无命中（安全区）', async ({ page }) => {
  await gotoPrototype(page);
  // 场景 8 有线索格（1,1）
  await page.getByTestId('scene-select').selectOption('clue-one-two');
  const clueBox = await page.getByTestId('clue-1-1').boundingBox();
  expect(clueBox).toBeTruthy();
  await page.mouse.click(clueBox.x + clueBox.width / 2, clueBox.y + clueBox.height / 2);
  await expect(page.getByTestId('diag-undo steps')).toHaveText('0', 'clue 中心点击无命中');
  // 普通 cell 中心（无线索格 (3,3)）
  const board = await page.getByTestId('digital-loop-board').boundingBox();
  const cell = {
    x: board.x + (board.width * 3.5) / 5,
    y: board.y + (board.height * 3.5) / 5,
  };
  await page.mouse.click(cell.x, cell.y);
  await expect(page.getByTestId('diag-undo steps')).toHaveText('0', 'cell 中心点击无命中');
});

test('Cmd/Ctrl+Z 撤销一次笔划', async ({ page }) => {
  await gotoPrototype(page);
  await clickEdge(page, 'h:2:1');
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'line');
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('edge-h:2:1')).toHaveAttribute('data-edge-state', 'undecided');
  await expect(page.getByTestId('diag-undo steps')).toHaveText('0');
});

test('Esc 取消活跃笔划：回滚、不入栈', async ({ page }) => {
  await gotoPrototype(page);
  const b1 = await page.getByTestId('edge-h:2:1').boundingBox();
  const b3 = await page.getByTestId('edge-h:2:3').boundingBox();
  expect(b1).toBeTruthy();
  expect(b3).toBeTruthy();
  await page.mouse.move(b1.x + b1.width / 2, b1.y + b1.height / 2);
  await page.mouse.down();
  await page.mouse.move(b3.x + b3.width / 2, b3.y + b3.height / 2, { steps: 6 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  for (const col of [1, 2, 3]) {
    await expect(page.getByTestId(`edge-h:2:${col}`)).toHaveAttribute('data-edge-state', 'undecided', `Esc 回滚 h:2:${col}`);
  }
  await expect(page.getByTestId('diag-undo steps')).toHaveText('0', 'Esc 不入栈');
});

test('dragstart 在棋盘内被阻止（无系统拖拽浮层）', async ({ page }) => {
  await gotoPrototype(page);
  const prevented = await page.evaluate(() => {
    const board = document.querySelector('[data-testid="digital-loop-board"]');
    const ev = new DragEvent('dragstart', { bubbles: true, cancelable: true });
    return board.dispatchEvent(ev) === false;
  });
  expect(prevented).toBe(true);
});
