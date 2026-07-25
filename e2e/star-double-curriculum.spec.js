/**
 * Star Double Lv.2–10 curriculum E2E.
 *
 * Guided/practice actions use the board's active-proof bridge one fresh target
 * at a time. Autonomous play is recomputed from DOM state with supported human
 * rules. No declared solution is read.
 */
import { test, expect } from '@playwright/test';
import { clearAllGameData } from './helpers/game-state.js';
import { goToLevel, openSettings } from './helpers/navigation.js';
import {
  cellState,
  completeLevelByHumanLogic,
  executeCurrentProof,
  executeLessonToAutonomous,
  getContract,
  markedXCells,
  placeStar,
  readBridgeFreezeStatus,
  readBridgeProof,
  readGuideAttributes,
  readGuideCopy,
  starredCells,
  tryClickGuide,
} from './helpers/proof-driver.js';
import {
  STAR_DOUBLE_LESSON_CONTRACTS,
  validateContractNoStaticAnswers,
} from '../src/game/starLine/starLineDoubleLessonContracts.js';

const DOUBLE_KEY = 'cg_star_line_double_guidance_v1';
const PROGRESS_KEY = 'cg_star_line_progress_v2';

async function seedProgress(page, index) {
  const levelId = `star-double-tutorial-${String(index + 1).padStart(2, '0')}`;
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: PROGRESS_KEY,
    value: {
      version: 1,
      games: {
        starSingle: { completed: {}, unlockedThroughId: 'star-lv-01' },
        starDouble: { completed: {}, unlockedThroughId: levelId },
      },
    },
  });
}

async function enterLevel(page, index) {
  await page.goto('/');
  await clearAllGameData(page);
  await seedProgress(page, index);
  await goToLevel(page, { modeId: 'starDouble', levelKey: `easy-${index}` });
  await expect(page.locator('[data-testid="star-line-double-guide-card"]'))
    .toBeVisible({ timeout: 5_000 });
}

async function expectLessonCompleted(page, levelId) {
  await expect.poll(() => page.evaluate(({ key, targetLevelId }) => {
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    return Boolean(value.completedLessons?.[targetLevelId]);
  }, { key: DOUBLE_KEY, targetLevelId: levelId })).toBe(true);
}

async function finishAutonomous(page, levelIndex) {
  const autonomousActions = await completeLevelByHumanLogic(page, levelIndex);
  expect(autonomousActions.length).toBeGreaterThan(0);
  await expect(page.locator('[data-testid="win-title"]')).toContainText('星线完成');
  const levelId = `star-double-tutorial-${String(levelIndex + 1).padStart(2, '0')}`;
  await expectLessonCompleted(page, levelId);
  return autonomousActions;
}

test.describe('Star Double Lv.2–10 proof-driven curriculum', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('Lv.2 完成八邻格 Guided、Transfer 和整关', async ({ page }) => {
    test.setTimeout(180_000);
    await enterLevel(page, 1);
    await expect(page.locator('[data-testid="star-line-guide-copy"]')).toContainText('完整八邻格');
    expect(await readBridgeProof(page)).toBeNull();
    await tryClickGuide(page);

    const initialProof = await readBridgeProof(page);
    expect(initialProof?.expectedAction).toBe('place-star');
    expect(await readBridgeFreezeStatus(page)).toEqual({
      object: true,
      observationCells: true,
      evidenceCells: true,
      derivedTargets: true,
      hasForbiddenFields: false,
    });

    const wrongTarget = Array.from({ length: 64 }, (_, index) => index)
      .find(index => !initialProof.derivedTargets.includes(index));
    await placeStar(page, wrongTarget);
    expect(await cellState(page, wrongTarget)).toBe('empty');
    await expect(page.locator('[data-testid="star-line-feedback-message"]'))
      .toContainText('不能由当前高亮线索推出');
    expect((await readBridgeProof(page))?.boardStateHash).toBe(initialProof.boardStateHash);

    const lessonActions = await executeLessonToAutonomous(page);
    const guidedTargets = lessonActions
      .filter(action => action.lessonStepId === 'lv2-guided')
      .map(action => action.executedTarget);
    expect(new Set(guidedTargets).size).toBe(8);
    const guidedStar = lessonActions.find(action => action.lessonStepId === 'lv2-guided')
      ?.evidenceCells?.[0];
    const deltas = guidedTargets.map(target => [
      Math.floor(target / 8) - Math.floor(guidedStar / 8),
      target % 8 - guidedStar % 8,
    ]);
    expect(new Set(deltas.map(delta => delta.join(',')))).toEqual(new Set([
      '-1,-1', '-1,0', '-1,1',
      '0,-1', '0,1',
      '1,-1', '1,0', '1,1',
    ]));
    expect(lessonActions.some(action => action.lessonStepId === 'lv2-practice')).toBe(true);
    await finishAutonomous(page, 1);
  });

  test('Lv.3 真实形成满额单位并排除剩余位置', async ({ page }) => {
    test.setTimeout(180_000);
    await enterLevel(page, 2);
    await expect(page.locator('[data-testid="star-line-guide-copy"]')).toContainText('已经有两颗星');
    const lessonActions = await executeLessonToAutonomous(page);
    expect(lessonActions.filter(action => action.lessonStepId === 'lv3-setup')).toHaveLength(2);
    expect(lessonActions.some(action => (
      action.lessonStepId === 'lv3-guided'
      && action.technique === 'quota-saturated'
      && action.expectedAction === 'eliminate'
    ))).toBe(true);
    const stars = await starredCells(page);
    const marked = await markedXCells(page);
    expect(stars.every(index => !marked.includes(index))).toBe(true);
    await finishAutonomous(page, 2);
  });

  const transferCases = [
    { level: 4, index: 3, intro: '还缺的星数', technique: 'remaining-capacity' },
    { level: 5, index: 4, intro: '寻找第二颗', technique: 'remaining-capacity' },
    { level: 6, index: 5, intro: '局部', technique: 'confined-capacity' },
    { level: 7, index: 6, intro: '交叉', technique: 'multi-unit-intersection' },
    { level: 8, index: 7, intro: '两者冲突', technique: 'common-conflict' },
  ];

  for (const curriculumCase of transferCases) {
    test(`Lv.${curriculumCase.level} 完成 Guided、Transfer 和 Autonomous`, async ({ page }) => {
      test.setTimeout(180_000);
      await enterLevel(page, curriculumCase.index);
      expect(await readGuideCopy(page)).toContain(curriculumCase.intro);
      const lessonActions = await executeLessonToAutonomous(page);
      const topicActions = lessonActions.filter(action => (
        action.technique === curriculumCase.technique
      ));
      expect(topicActions.length).toBeGreaterThanOrEqual(2);
      expect(topicActions.some(action => action.phase === 'guided')).toBe(true);
      expect(topicActions.some(action => action.phase === 'transfer-practice')).toBe(true);
      await expect(page.locator('.is-guide-action')).toHaveCount(0);
      await finishAutonomous(page, curriculumCase.index);
    });
  }

  test('Lv.9 玩家真实执行三步依赖传播链', async ({ page }) => {
    test.setTimeout(180_000);
    await enterLevel(page, 8);
    await expect(page.locator('[data-testid="star-line-guide-copy"]')).toContainText('重新扫描');
    const chainActions = await executeLessonToAutonomous(page);
    expect(chainActions).toHaveLength(3);
    expect(chainActions.map(action => action.lessonStepId)).toEqual([
      'lv9-chain1',
      'lv9-chain2',
      'lv9-chain3',
    ]);
    expect(chainActions.map(action => action.technique)).toEqual([
      'two-by-two-capacity',
      'remaining-capacity',
      'quota-saturated',
    ]);
    expect(new Set(chainActions.map(action => action.boardStateHash)).size).toBe(3);
    expect(new Set(chainActions.map(action => action.executedTarget)).size).toBe(3);
    expect((await readGuideAttributes(page))?.type).toBe('autonomous');
    await finishAutonomous(page, 8);
  });

  test('Lv.10 INTRO 等待点击且整关只使用自主逻辑', async ({ page }) => {
    test.setTimeout(180_000);
    await enterLevel(page, 9);
    await expect(page.locator('[data-testid="star-line-guide-copy"]')).toContainText('不增加新规则');
    const before = await readGuideAttributes(page);
    expect(before?.type).toBe('explain');
    expect(await readBridgeProof(page)).toBeNull();
    await page.waitForTimeout(1_200);
    expect((await readGuideAttributes(page))?.step).toBe(before.step);
    await tryClickGuide(page);
    expect((await readGuideAttributes(page))?.type).toBe('autonomous');
    await finishAutonomous(page, 9);
  });

  test('v4 双星教学存储迁移到 v5 且保留 Lv.1 完成状态', async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
    await seedProgress(page, 0);
    await page.evaluate(key => localStorage.setItem(key, JSON.stringify({
      version: 4,
      completed: true,
      step: 6,
      replayRequested: false,
    })), DOUBLE_KEY);
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-0' });
    await expect.poll(() => page.evaluate(key => (
      JSON.parse(localStorage.getItem(key) || 'null')
    ), DOUBLE_KEY)).toMatchObject({
      version: 5,
      completedLessons: { 'star-double-tutorial-01': true },
    });
    const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), DOUBLE_KEY);
    expect(stored.completed).toBeUndefined();
  });

  test('设置中可选择已完成的 Lv.1–10 课程重播', async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
    await page.evaluate(key => localStorage.setItem(key, JSON.stringify({
      version: 5,
      completedLessons: {
        'star-double-tutorial-01': true,
        'star-double-tutorial-04': true,
      },
      replayLevelId: null,
    })), DOUBLE_KEY);
    await page.reload();
    await openSettings(page);
    const select = page.locator('[data-testid="star-line-double-guide-replay-select"]');
    await select.selectOption('4');
    await page.locator('[data-testid="star-line-double-guide-replay-button"]').click();
    await expect.poll(() => page.evaluate(key => (
      JSON.parse(localStorage.getItem(key) || '{}').replayLevelId
    ), DOUBLE_KEY)).toBe('star-double-tutorial-04');
  });

  test('Lv.2–10 合同没有静态答案字段且动作来自 selector', async () => {
    for (let lessonNumber = 2; lessonNumber <= 10; lessonNumber += 1) {
      const levelId = `star-double-tutorial-${String(lessonNumber).padStart(2, '0')}`;
      const contract = getContract(levelId);
      expect(contract).toBe(STAR_DOUBLE_LESSON_CONTRACTS[levelId]);
      expect(validateContractNoStaticAnswers(levelId)).toEqual([]);
      for (const step of contract.steps) {
        if (step.expectedAction === 'dynamic') {
          expect(step.proofSelector).not.toBeNull();
        }
      }
    }
  });

  test('退出重进后课程会从 INTRO 重新开始', async ({ page }) => {
    await enterLevel(page, 2);
    await tryClickGuide(page);
    await executeCurrentProof(page);
    expect((await readGuideAttributes(page))?.step).toBeGreaterThanOrEqual(2);
    await page.locator('[data-testid="back-button"]').click();
    const abandon = page.locator('[data-testid="exit-abandon-button"]');
    if (await abandon.isVisible({ timeout: 2_000 }).catch(() => false)) await abandon.click();
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-2' });
    await expect(page.locator('[data-testid="star-line-double-guide-card"]')).toBeVisible();
    expect((await readGuideAttributes(page))?.step).toBe(1);
    expect((await readGuideAttributes(page))?.type).toBe('explain');
  });

  test('Lv.1 已验收教学入口保持原流程', async ({ page }) => {
    await enterLevel(page, 0);
    await expect(page.locator('[data-testid="star-line-guide-copy"]'))
      .toContainText('每行、每列、每个星域');
    await tryClickGuide(page);
    await expect(page.locator('[data-testid="star-line-guide-copy"]')).toContainText('2×2');
  });
});
