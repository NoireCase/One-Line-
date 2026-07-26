import { test, expect } from '@playwright/test';
import { goToLevel } from './helpers/navigation.js';
import { clearAllGameData, getStorage, readGridDataFromReactFiber, buildSolutionPath } from './helpers/game-state.js';
import { dragCellToCell } from './helpers/game-simulation.js';

// ── 声音 spy：记录所有 oscillator 频率（不改动生产实现） ──
async function installSoundSpy(page) {
  await page.addInitScript(() => {
    // 跨导航保留日志（恢复存档等场景涉及 page.goto）
    window.__soundLog = window.__soundLog || [];
    const OrigAC = window.AudioContext || window.webkitAudioContext;
    if (!OrigAC) return;
    const origCreate = OrigAC.prototype.createOscillator;
    OrigAC.prototype.createOscillator = function patchedCreateOscillator() {
      const osc = origCreate.call(this);
      const originalSet = osc.frequency.setValueAtTime.bind(osc.frequency);
      osc.frequency.setValueAtTime = (value, time) => {
        window.__soundLog.push(value);
        return originalSet(value, time);
      };
      return osc;
    };
  });
}

async function soundLog(page) {
  return page.evaluate(() => window.__soundLog || []);
}

function countFreq(log, freq) {
  return log.filter(f => Math.abs(f - freq) < 0.01).length;
}

const FREQ = {
  starPlace: 523.25, // C5
  markX: 659.25,     // E5
  conflict: 164.81,  // E3
  undo: 392.0,       // G4（起点，末端滑至 D4）
  chimeC6: 1046.50,
};

// 完成音三音上行（C4-E4-G4）
const COMPLETE_NOTES = [261.63, 329.63, 392.0];

const CHIME = [523.25, 659.25, 783.99, 1046.50];

/** 统计完整胜利和弦（4 音连续子序列）出现次数。 */
function countChime(log) {
  let count = 0;
  for (let i = 0; i + CHIME.length <= log.length; i += 1) {
    if (CHIME.every((f, k) => Math.abs(log[i + k] - f) < 0.01)) count += 1;
  }
  return count;
}

// ── Star Line 辅助（与 star-line-mouse-input.spec.js 同模式） ──
async function openStarLineLevel(page, levelKey = 'easy-1') {
  await page.goto('/');
  await clearAllGameData(page);
  await page.evaluate(() => {
    localStorage.setItem('cg_discovery_star_line_basic_v1', '1');
    localStorage.setItem('cg_discovery_star_line_double_star_v1', '1');
    localStorage.setItem('cg_star_line_progress_v2', JSON.stringify({
      version: 1,
      games: {
        starSingle: { completed: {}, unlockedThroughId: 'star-lv-20' },
        starDouble: { completed: {}, unlockedThroughId: 'star-lv-30' },
      },
    }));
  });
  await goToLevel(page, { modeId: 'starSingle', levelKey });
}

function cell(page, idx) {
  return page.locator(`[data-testid="star-line-cell-${idx}"]`);
}
function xMark(page, idx) {
  return page.locator(`[data-testid="star-line-x-${idx}"]`);
}
function starMark(page, idx) {
  return page.locator(`[data-testid="star-line-star-${idx}"]`);
}

async function cellCenter(page, idx) {
  const box = await cell(page, idx).boundingBox();
  if (!box) throw new Error(`Cell ${idx} not visible`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function mouseDragAcross(page, cellIndices, { steps = 3, pause = 10 } = {}) {
  const first = await cellCenter(page, cellIndices[0]);
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const idx of cellIndices.slice(1)) {
    const point = await cellCenter(page, idx);
    await page.mouse.move(point.x, point.y, { steps });
    if (pause) await page.waitForTimeout(pause);
  }
  await page.mouse.up();
}

test.describe('Motion & Feedback：Star Line 操作反馈与声音', () => {
  test.beforeEach(async ({ page }) => {
    await installSoundSpy(page);
  });

  test('拖动标 X 每手势只播一次声音，一次撤销恢复整批', async ({ page }) => {
    await openStarLineLevel(page, 'easy-1');

    await mouseDragAcross(page, [1, 2, 3, 4]);
    for (const idx of [1, 2, 3, 4]) {
      await expect(xMark(page, idx)).toBeVisible();
    }
    let log = await soundLog(page);
    expect(countFreq(log, FREQ.markX), '拖动标 X 每手势只播一次').toBe(1);

    // 一次撤销 = 一批：四个 X 一起消失
    await page.locator('[data-testid="star-line-undo-button"]').click();
    for (const idx of [1, 2, 3, 4]) {
      await expect(xMark(page, idx)).toHaveCount(0);
    }
    log = await soundLog(page);
    expect(countFreq(log, FREQ.undo), '撤销每批播放一次').toBe(1);

    // 无可撤销内容时不播放声音
    await expect(page.locator('[data-testid="star-line-undo-button"]')).toBeDisabled();
    const before = (await soundLog(page)).length;
    await page.locator('[data-testid="star-line-undo-button"]').click({ force: true });
    expect((await soundLog(page)).length).toBe(before);
  });

  test('单击标 X、双击放星各播一次；冲突只在出现时播一次', async ({ page }) => {
    await openStarLineLevel(page, 'easy-1');

    // 单击标 X → 一次 markX
    await cell(page, 6).click();
    await expect(xMark(page, 6)).toBeVisible();
    let log = await soundLog(page);
    expect(countFreq(log, FREQ.markX)).toBe(1);

    // 同行放两颗星 → 放星音 ×2，冲突音恰好一次
    await cell(page, 0).dblclick();
    await expect(starMark(page, 0)).toBeVisible();
    await cell(page, 1).dblclick();
    await expect(starMark(page, 1)).toBeVisible();
    log = await soundLog(page);
    expect(countFreq(log, FREQ.starPlace)).toBe(2);
    expect(countFreq(log, FREQ.conflict), '冲突出现播放一次').toBe(1);

    // 冲突持续存在时继续操作不重播冲突音
    await cell(page, 10).click();
    await expect(xMark(page, 10)).toBeVisible();
    log = await soundLog(page);
    expect(countFreq(log, FREQ.conflict), '冲突持续时不重播').toBe(1);
  });

  test('reduced-motion 下撤销立即呈现最终状态，无 exit overlay 残留', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openStarLineLevel(page, 'easy-1');

    await mouseDragAcross(page, [1, 2, 3]);
    await page.locator('[data-testid="star-line-undo-button"]').click();
    for (const idx of [1, 2, 3]) {
      await expect(xMark(page, idx)).toHaveCount(0);
    }
    await expect(page.locator('.starline-x-exit')).toHaveCount(0);
    await expect(page.locator('.starline-star-exit')).toHaveCount(0);
  });

  test('Star Line 完成音只播放一次', async ({ page }) => {
    await openStarLineLevel(page, 'easy-1');
    // star-lv-02 solution: [0, 8, 11, 19, 22]
    for (const idx of [0, 8, 11, 19, 22]) {
      await cell(page, idx).dblclick();
      await expect(starMark(page, idx)).toBeVisible();
    }
    await expect(page.locator('[data-testid="win-panel"]')).toBeVisible({ timeout: 8000 });
    const log = await soundLog(page);
    for (const note of COMPLETE_NOTES) {
      expect(countFreq(log, note), `完成音音符 ${note}Hz 恰好一次`).toBe(1);
    }
    expect(countFreq(log, FREQ.chimeC6), 'Star Line 不使用 One Line 胜利和弦').toBe(0);
  });
});

test.describe('Motion & Feedback：HUD 与完成音', () => {
  test.beforeEach(async ({ page }) => {
    await installSoundSpy(page);
    await page.goto('/');
    await clearAllGameData(page);
  });

  test('分数与生命立即准确更新，pulse 不产生重复数值元素', async ({ page }) => {
    await goToLevel(page, { modeId: 'classic', levelKey: 'easy-0' });
    const score = page.locator('[data-testid="score"]');

    const gridData = await readGridDataFromReactFiber(page);
    const solution = buildSolutionPath(gridData);

    // 连接前两格 → 分数立即大于 0，且始终只有一个分数元素
    await dragCellToCell(page, solution[0], solution[1], { steps: 4, stepDelay: 10 });
    await expect(score).toHaveCount(1);
    const scoreAfterOne = Number(await score.innerText().then(t => t.replace('分', '')));
    expect(scoreAfterOne).toBeGreaterThan(0);

    await dragCellToCell(page, solution[1], solution[2], { steps: 4, stepDelay: 10 });
    await expect(score).toHaveCount(1);
    const scoreAfterTwo = Number(await score.innerText().then(t => t.replace('分', '')));
    expect(scoreAfterTwo).toBeGreaterThan(scoreAfterOne);
  });

  test('One Line 完成只保留一套完成音（胜利和弦结尾，无额外高音）', async ({ page }) => {
    await goToLevel(page, { modeId: 'classic', levelKey: 'easy-0' });
    const gridData = await readGridDataFromReactFiber(page);
    const solution = buildSolutionPath(gridData);
    // 复用 dragPath 的逐格拖动
    for (let i = 0; i < solution.length - 1; i += 1) {
      await dragCellToCell(page, solution[i], solution[i + 1], { steps: 2, stepDelay: 5 });
    }
    await expect(page.locator('[data-testid="win-panel"]')).toBeVisible({ timeout: 8000 });
    const log = await soundLog(page);
    expect(log.slice(-4), '完成时只播放一次胜利和弦').toEqual(CHIME);
  });

  test('One Line 完成后立即保存退出并恢复：完成音合计恰好一次，结算不重复', async ({ page }) => {
    await goToLevel(page, { modeId: 'classic', levelKey: 'easy-0' });
    const gridData = await readGridDataFromReactFiber(page);
    const solution = buildSolutionPath(gridData);
    for (let i = 0; i < solution.length - 1; i += 1) {
      await dragCellToCell(page, solution[i], solution[i + 1], { steps: 2, stepDelay: 5 });
    }

    // 在 900ms 结算延迟内立即保存退出（先取导航前声音日志：goto 后 window 重建）
    const logBeforeExit = await soundLog(page);
    await page.locator('[data-testid="back-button"]').click();
    await page.locator('[data-testid="save-and-exit-button"]').click();

    // 恢复完整存档：补结算必须静音，且 WinPanel 正常出现
    await page.goto('/');
    await page.locator('[data-testid="home-continue-button"]').click();
    await expect(page.locator('[data-testid="win-panel"]')).toBeVisible({ timeout: 8000 });

    // 整个完成事件合计恰好一套完成音（完成当下已播放，恢复结算静音）
    const log = [...logBeforeExit, ...(await soundLog(page))];
    expect(countChime(log), '完成音合计恰好一次').toBe(1);

    // 结算恰好一次：奖励不重复、进度已写、存档已清
    expect(Number(await getStorage(page, 'cg_coins'))).toBe(125);
    const progress = await getStorage(page, 'cg_classic_v2_progress');
    expect(progress.easy[0]).toBeGreaterThan(0);
    expect(await getStorage(page, 'cg_classic_v2_saved_game')).toBeNull();
  });
});
