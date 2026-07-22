import { test, expect } from '@playwright/test';
import { createClassicLevel } from '../src/game/classic/createClassicLevel.js';
import { getHiddenLevel } from '../src/data/hiddenLevels.js';
import { createLevelConfig, resolveRules } from '../src/game/rules/levelConfig.js';
import { S } from './helpers/selectors.js';
import { clearAllGameData, getPathLength, getStorage } from './helpers/game-state.js';
import { dragCellToCell } from './helpers/game-simulation.js';
import { exitGame, goToLevel, goToPuzzleBook, openSettings, switchMode } from './helpers/navigation.js';

const CLASSIC_SAVE_KEY = 'cg_classic_v2_saved_game';
const DIAGONAL_SAVE_KEY = 'cg_diagonal_saved_game';
const HIDDEN_SAVE_KEY = 'cg_hidden_saved_game';
const STAR_SINGLE_SAVE_KEY = 'cg_star_line_single_saved_game';
const STAR_DOUBLE_SAVE_KEY = 'cg_star_line_double_saved_game';
const START_LEVEL_PROMPT = '[data-testid="start-level-prompt"]';
const CANCEL_START = '[data-testid="cancel-start-level-button"]';
const CONFIRM_START = '[data-testid="confirm-start-level-button"]';

const CLASSIC_LEVEL_ONE_SOLUTION = createClassicLevel(
  'easy',
  0,
  resolveRules(createLevelConfig('easy', 0, 'classic')),
  'classic'
).grid
  .map((cell, index) => ({ index, value: cell.val }))
  .sort((a, b) => a.value - b.value)
  .map(cell => cell.index);

function buildClassicSave(overrides = {}) {
  const level = createClassicLevel(
    'easy',
    0,
    resolveRules(createLevelConfig('easy', 0, 'classic')),
    'classic'
  );
  return {
    playMode: 'classic',
    diff: 'easy',
    levelIdx: 0,
    gridData: level.grid,
    path: [level.startIndex],
    hp: level.config.hp,
    timer: 0,
    score: 0,
    maxCombo: 0,
    savedAt: 1752710400000,
    ...overrides,
  };
}

function buildHiddenSave(overrides = {}) {
  const level = getHiddenLevel(0);
  const keyNumbers = new Set(level.keyNumbers);
  const gridData = Array.from({ length: level.N ** 2 }, (_, index) => {
    const val = level.path.indexOf(index) + 1;
    return {
      val,
      isHidden: !keyNumbers.has(val),
      isRevealed: false,
      isExcluded: false,
      isHinted: false,
    };
  });
  return {
    playMode: 'hidden',
    diff: 'easy',
    levelIdx: 0,
    gridData,
    path: [level.startIndex],
    hp: 10,
    timer: 0,
    score: 0,
    maxCombo: 0,
    savedAt: 1752710400000,
    ...overrides,
  };
}

async function prepareClassicSave(page) {
  await page.goto('/');
  await clearAllGameData(page);
  await page.evaluate(() => {
    localStorage.setItem('cg_classic_v2_progress', JSON.stringify({
      easy: [1, 0],
      medium: [],
      hard: [],
    }));
  });
  await goToLevel(page, { modeId: 'classic', levelKey: 'easy-0' });
  await dragCellToCell(page, CLASSIC_LEVEL_ONE_SOLUTION[0], CLASSIC_LEVEL_ONE_SOLUTION[1], {
    steps: 2,
    stepDelay: 0,
  });
  await expect.poll(() => getPathLength(page)).toBe(2);
  const firstMoveScore = Number.parseInt(await page.locator(S.game.score).textContent(), 10);
  await exitGame(page, 'save');
  return { firstMoveScore };
}

async function prepareStarSingleSave(page) {
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
  await goToLevel(page, { modeId: 'starSingle', levelKey: 'easy-0' });
  await page.locator('[data-testid="star-line-cell-1"]').dblclick();
  await expect(page.locator('[data-testid="star-line-star-1"]')).toBeVisible();
  await exitGame(page, 'save');
}

test.describe('Package B 存档替换确认', () => {
  test('B1.1 取消开始其他 One Line 关卡会保留原存档并可继续', async ({ page }) => {
    await prepareClassicSave(page);
    const rawSave = await page.evaluate(key => localStorage.getItem(key), CLASSIC_SAVE_KEY);

    await page.locator(S.puzzleBook.levelTile('easy-1')).click();
    await expect(page.locator(START_LEVEL_PROMPT)).toBeVisible();
    await page.locator(CANCEL_START).click();

    await expect(page.locator(S.puzzleBook.page)).toBeVisible();
    expect(await page.evaluate(key => localStorage.getItem(key), CLASSIC_SAVE_KEY)).toBe(rawSave);

    await page.locator(S.puzzleBook.levelTile('easy-0')).click();
    await expect(page.locator(START_LEVEL_PROMPT)).toHaveCount(0);
    await expect.poll(() => getPathLength(page)).toBe(2);
  });

  test('B1.2 确认开始其他 One Line 关卡只放弃当前模式存档', async ({ page }) => {
    await prepareClassicSave(page);
    const otherModeRaw = JSON.stringify({ sentinel: 'diagonal-save-must-survive' });
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
      key: DIAGONAL_SAVE_KEY,
      value: otherModeRaw,
    });

    await page.locator(S.puzzleBook.levelTile('easy-1')).click();
    await expect(page.locator(START_LEVEL_PROMPT)).toBeVisible();
    await page.locator(CONFIRM_START).click();

    await expect(page.locator(S.game.board)).toBeVisible();
    await expect(page.locator(S.game.modeLabel)).toContainText(/Lv\s*2/);
    expect(await page.evaluate(key => localStorage.getItem(key), CLASSIC_SAVE_KEY)).toBeNull();
    expect(await page.evaluate(key => localStorage.getItem(key), DIAGONAL_SAVE_KEY)).toBe(otherModeRaw);
  });

  test('B1.3 Star Single 使用独立槽：真实存档直读，其他关确认，Star Double 不受影响', async ({ page }) => {
    await prepareStarSingleSave(page);
    const singleRaw = await page.evaluate(key => localStorage.getItem(key), STAR_SINGLE_SAVE_KEY);
    const doubleRaw = JSON.stringify({ sentinel: 'double-save-must-survive' });
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
      key: STAR_DOUBLE_SAVE_KEY,
      value: doubleRaw,
    });

    await page.locator(S.puzzleBook.levelTile('easy-1')).click();
    await expect(page.locator(START_LEVEL_PROMPT)).toBeVisible();
    await page.locator(CANCEL_START).click();
    expect(await page.evaluate(key => localStorage.getItem(key), STAR_SINGLE_SAVE_KEY)).toBe(singleRaw);
    expect(await page.evaluate(key => localStorage.getItem(key), STAR_DOUBLE_SAVE_KEY)).toBe(doubleRaw);

    await page.locator(S.puzzleBook.levelTile('easy-0')).click();
    await expect(page.locator(START_LEVEL_PROMPT)).toHaveCount(0);
    await expect(page.locator('[data-testid="star-line-star-1"]')).toBeVisible();
    await exitGame(page, 'save');

    await page.locator(S.puzzleBook.levelTile('easy-1')).click();
    await expect(page.locator(START_LEVEL_PROMPT)).toBeVisible();
    await page.locator(CONFIRM_START).click();
    await expect(page.locator(S.game.modeLabel)).toContainText(/第\s*2\s*关/);
    expect(await page.evaluate(key => localStorage.getItem(key), STAR_SINGLE_SAVE_KEY)).toBeNull();
    expect(await page.evaluate(key => localStorage.getItem(key), STAR_DOUBLE_SAVE_KEY)).toBe(doubleRaw);
  });
});

test.describe('Package B 异常存储降级', () => {
  test('B2.1 Storage 读写删除都抛 SecurityError 时仍可从首页进入关卡', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.addInitScript(() => {
      const fail = () => {
        throw new DOMException('Storage is blocked for this origin', 'SecurityError');
      };
      Object.defineProperty(Storage.prototype, 'getItem', { configurable: true, value: fail });
      Object.defineProperty(Storage.prototype, 'setItem', { configurable: true, value: fail });
      Object.defineProperty(Storage.prototype, 'removeItem', { configurable: true, value: fail });
    });

    await page.goto('/');
    await expect(page.locator(S.home.view)).toBeVisible();
    await page.locator(S.home.startButton).click();
    await expect(page.locator(S.puzzleBook.page)).toBeVisible();
    await page.locator(S.puzzleBook.levelTile('easy-0')).click();
    await expect(page.locator(S.game.board)).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('B2.2 非法 JSON、null 与错误形状进度都回退到默认解锁且不在初始化时改写', async ({ page }) => {
    const seeded = {
      cg_classic_v2_progress: '{not-json',
      cg_diagonal_progress: 'null',
      cg_hidden_progress: JSON.stringify({ unexpected: ['all-unlocked'] }),
    };
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/');
    await clearAllGameData(page);
    await page.evaluate(values => {
      for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
    }, seeded);
    await goToPuzzleBook(page);

    await expect(page.locator(S.puzzleBook.levelTile('easy-0'))).toHaveAttribute('data-locked', 'false');
    await expect(page.locator(S.puzzleBook.levelTile('easy-1'))).toHaveAttribute('data-locked', 'true');
    await switchMode(page, 'diagonal');
    await expect(page.locator(S.puzzleBook.levelTile('easy-1'))).toHaveAttribute('data-locked', 'true');
    await switchMode(page, 'hidden');
    await expect(page.locator(S.puzzleBook.levelTile('easy-1'))).toHaveAttribute('data-locked', 'true');

    expect(await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(seeded))).toEqual(seeded);
    expect(pageErrors).toEqual([]);
  });

  test('B2.3 非法金币、全局分数和音量显示有限默认值且不会写回 NaN', async ({ page }) => {
    const seeded = {
      cg_coins: '-50',
      cg_global_score: 'NaN',
      cg_sfx_vol: 'Infinity',
      cg_music_vol: '-10',
    };
    await page.goto('/');
    await clearAllGameData(page);
    await page.evaluate(values => {
      for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
    }, seeded);
    await page.reload();

    await openSettings(page);
    const volume = page.locator(S.settings.panel).locator('input[type="range"]');
    await expect(volume).toHaveValue('100');
    await expect(page.locator(S.settings.panel)).toContainText('100%');
    await page.locator(S.settings.closeButton).click();

    await goToLevel(page, { modeId: 'classic', levelKey: 'easy-0' });
    await expect(page.locator('.game-topbar__status.hud-surface')).toContainText('100');
    await expect(page.locator(S.game.view)).not.toContainText('NaN');
    expect(await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(seeded))).toEqual(seeded);
  });

  test('B2.4 同关损坏 One Line 存档在首页、书签和实际加载中都视为不存在', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    const damaged = buildClassicSave({ path: 'not-an-array' });
    const otherModeRaw = JSON.stringify({ sentinel: 'diagonal-slot-must-survive' });

    await page.goto('/');
    await clearAllGameData(page);
    await page.evaluate(({ damagedSave, otherSave }) => {
      localStorage.setItem('cg_classic_v2_saved_game', JSON.stringify(damagedSave));
      localStorage.setItem('cg_diagonal_saved_game', otherSave);
    }, { damagedSave: damaged, otherSave: otherModeRaw });
    await page.reload();

    await expect(page.locator(S.home.continueButton)).toHaveCount(0);
    await page.locator(S.home.startButton).click();
    const savedTile = page.locator(S.puzzleBook.levelTile('easy-0'));
    await expect(savedTile).toHaveAttribute('data-has-save', 'false');
    await savedTile.click();

    await expect(page.locator(S.game.board)).toBeVisible();
    await expect.poll(() => getPathLength(page)).toBe(1);
    expect(await page.evaluate(key => localStorage.getItem(key), CLASSIC_SAVE_KEY)).toBeNull();
    expect(await page.evaluate(key => localStorage.getItem(key), DIAGONAL_SAVE_KEY)).toBe(otherModeRaw);
    expect(pageErrors).toEqual([]);
  });

  test('B2.5 损坏存档不会触发弃档确认，其他已解锁关卡直接创建新局', async ({ page }) => {
    const damaged = buildClassicSave({ gridData: [] });
    await page.goto('/');
    await clearAllGameData(page);
    await page.evaluate(damagedSave => {
      localStorage.setItem('cg_classic_v2_progress', JSON.stringify({ easy: [3, 0] }));
      localStorage.setItem('cg_classic_v2_saved_game', JSON.stringify(damagedSave));
    }, damaged);
    await page.reload();

    await page.locator(S.home.startButton).click();
    await expect(page.locator(S.puzzleBook.levelTile('easy-0'))).toHaveAttribute('data-has-save', 'false');
    await page.locator(S.puzzleBook.levelTile('easy-1')).click();

    await expect(page.locator(START_LEVEL_PROMPT)).toHaveCount(0);
    await expect(page.locator(S.game.board)).toBeVisible();
    await expect(page.locator(S.game.modeLabel)).toContainText(/Lv\s*2/);
    expect(await page.evaluate(key => localStorage.getItem(key), CLASSIC_SAVE_KEY)).toBeNull();
  });

  test('B2.6 Hidden 0 HP 旧存档不显示恢复入口且点击同关获得正式初始 HP', async ({ page }) => {
    const deadSave = buildHiddenSave({ hp: 0 });
    await page.goto('/');
    await clearAllGameData(page);
    await page.evaluate(savedGame => {
      localStorage.setItem('cg_hidden_saved_game', JSON.stringify(savedGame));
    }, deadSave);
    await page.reload();

    await expect(page.locator(S.home.continueButton)).toHaveCount(0);
    await page.locator(S.home.startButton).click();
    await switchMode(page, 'hidden');
    const firstHiddenLevel = page.locator(S.puzzleBook.levelTile('easy-0'));
    await expect(firstHiddenLevel).toHaveAttribute('data-has-save', 'false');
    await firstHiddenLevel.click();

    await expect(page.locator('[data-testid="hidden-attempts-hud"]')).toHaveText('剩余尝试 10');
    await expect(page.locator(S.lose.panel)).toHaveCount(0);
    expect(await page.evaluate(key => localStorage.getItem(key), HIDDEN_SAVE_KEY)).toBeNull();
  });

  test('B2.7 缺少非核心统计字段的合法旧存档仍可 normalize 并恢复', async ({ page }) => {
    const legacySave = buildClassicSave({
      path: CLASSIC_LEVEL_ONE_SOLUTION.slice(0, 2),
    });
    delete legacySave.timer;
    delete legacySave.score;
    delete legacySave.maxCombo;
    delete legacySave.savedAt;

    await page.goto('/');
    await clearAllGameData(page);
    await page.evaluate(savedGame => {
      localStorage.setItem('cg_classic_v2_saved_game', JSON.stringify(savedGame));
    }, legacySave);
    await page.reload();

    await expect(page.locator(S.home.continueButton)).toBeVisible();
    await page.locator(S.home.continueButton).click();
    await expect.poll(() => getPathLength(page)).toBe(2);
    await expect(page.locator(S.game.score)).toContainText('0');
    expect(await getStorage(page, CLASSIC_SAVE_KEY)).not.toBeNull();
  });
});

test.describe('Package B 连击恢复语义', () => {
  test('B3 恢复后当前连击归零、历史最高保留且下一步不吃历史连击加成', async ({ page }) => {
    const { firstMoveScore } = await prepareClassicSave(page);
    const saved = await getStorage(page, CLASSIC_SAVE_KEY);
    saved.path = [CLASSIC_LEVEL_ONE_SOLUTION[0]];
    saved.score = 0;
    saved.maxCombo = 7;
    saved.gridData = saved.gridData.map((cell, index) => (
      index === CLASSIC_LEVEL_ONE_SOLUTION[1]
        ? { ...cell, isRevealed: false }
        : cell
    ));
    await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
      key: CLASSIC_SAVE_KEY,
      value: saved,
    });

    await page.locator(S.puzzleBook.levelTile('easy-0')).click();
    expect.soft(await page.locator('.combo-hud-value').count()).toBe(0);
    await dragCellToCell(page, CLASSIC_LEVEL_ONE_SOLUTION[0], CLASSIC_LEVEL_ONE_SOLUTION[1], {
      steps: 2,
      stepDelay: 0,
    });
    await expect(page.locator(S.game.score)).toContainText(String(firstMoveScore));

    await exitGame(page, 'save');
    expect((await getStorage(page, CLASSIC_SAVE_KEY)).maxCombo).toBe(7);
  });
});
