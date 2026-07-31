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

test('A/B/C 方案切换与方案 B 工具栏', async ({ page }) => {
  await gotoPrototype(page);
  // 默认方案 A
  await expect(page.getByTestId('scheme-a')).toBeVisible();
  await page.getByTestId('scheme-b').click();
  await expect(page.getByTestId('toolbar-b')).toBeVisible();
  await expect(page.getByTestId('tool-line')).toBeVisible();
  await expect(page.getByTestId('tool-excluded')).toBeVisible();
  await expect(page.getByTestId('tool-erase')).toBeVisible();
  await page.getByTestId('scheme-c').click();
  await expect(page.getByTestId('toolbar-b')).toHaveCount(0);
});

test('方案 B excluded 工具点按标记 excluded', async ({ page }) => {
  await gotoPrototype(page);
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
  await page.getByTestId('scheme-b').click();
  const after = await page.evaluate(() => Object.keys(localStorage));
  expect(after).toEqual(before);
});

test('完成只显示诊断状态，不触发正式完成流程', async ({ page }) => {
  await gotoPrototype(page);
  // 场景 6：无数字单环，初始即结构完成
  await page.getByTestId('scene-select').selectOption('single-loop-no-clue');
  await expect(page.getByTestId('completion-banner')).toBeVisible();
  // 无正式 WinPanel / 奖励文案
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
