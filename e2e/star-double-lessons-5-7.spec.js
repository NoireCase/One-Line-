/**
 * Focused regressions for Star Double Lv.5 and Lv.7 lesson triggering.
 *
 * The transition cases intentionally keep the same mounted game view: this is
 * where a completed lesson runtime must not be applied to the next level.
 */
import { test, expect } from '@playwright/test';
import { clearAllGameData } from './helpers/game-state.js';
import { goToLevel } from './helpers/navigation.js';
import {
  completeLevelByHumanLogic,
  executeCurrentProof,
  executeLessonToAutonomous,
  getContract,
  readBridgeProof,
  readGuideAttributes,
  starredCells,
  tryClickGuide,
} from './helpers/proof-driver.js';

const DOUBLE_KEY = 'cg_star_line_double_guidance_v1';
const PROGRESS_KEY = 'cg_star_line_progress_v2';

function levelId(levelNumber) {
  return `star-double-tutorial-${String(levelNumber).padStart(2, '0')}`;
}

async function seedProgress(page, levelNumber) {
  await page.evaluate(({ key, unlockedThroughId }) => {
    localStorage.setItem(key, JSON.stringify({
      version: 1,
      games: {
        starSingle: { completed: {}, unlockedThroughId: 'star-lv-01' },
        starDouble: { completed: {}, unlockedThroughId },
      },
    }));
  }, {
    key: PROGRESS_KEY,
    unlockedThroughId: levelId(levelNumber),
  });
}

async function readLessonStorage(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}'), DOUBLE_KEY);
}

async function enterWithCleanLessonRecord(page, levelNumber) {
  await page.goto('/');
  await clearAllGameData(page);
  await seedProgress(page, levelNumber);
  await page.evaluate(key => localStorage.removeItem(key), DOUBLE_KEY);
  await page.reload();
  await goToLevel(page, {
    modeId: 'starDouble',
    levelKey: `easy-${levelNumber - 1}`,
  });
  await expect(page.locator('[data-testid="star-line-double-guide-card"]')).toBeVisible();
}

async function expectIntro(page, levelNumber, introCopy) {
  expect(getContract(levelId(levelNumber))).not.toBeNull();
  await expect(page.locator('[data-testid="star-line-guide-copy"]')).toContainText(introCopy);
  expect(await readGuideAttributes(page)).toMatchObject({ step: 1, type: 'explain' });
  expect(await readBridgeProof(page)).toBeNull();
  const stored = await readLessonStorage(page);
  expect(stored.completedLessons?.[levelId(levelNumber)]).not.toBe(true);
  expect(stored.replayLevelId ?? null).toBeNull();
}

async function executeUntilProofStep(page, targetStepId) {
  const actions = [];
  await tryClickGuide(page);
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const proof = await readBridgeProof(page);
    if (proof?.lessonStepId === targetStepId) return { actions, proof };
    const action = await executeCurrentProof(page);
    if (action) {
      actions.push(action);
      continue;
    }
    if (await tryClickGuide(page)) continue;
    throw new Error(`Lesson did not reach ${targetStepId}`);
  }
  throw new Error(`Lesson exceeded the action limit before ${targetStepId}`);
}

async function finishAutonomous(page, levelNumber) {
  const actions = await completeLevelByHumanLogic(page, levelNumber - 1);
  expect(actions.length).toBeGreaterThan(0);
  await expect(page.locator('[data-testid="win-title"]')).toContainText('星线完成');
  await expect.poll(async () => (
    (await readLessonStorage(page)).completedLessons?.[levelId(levelNumber)]
  )).toBe(true);
}

test.describe('Star Double Lv.5/Lv.7 lesson trigger regressions', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('Lv.5 清空教学记录后从 INTRO 开始', async ({ page }) => {
    await enterWithCleanLessonRecord(page, 5);
    await expectIntro(page, 5, '寻找第二颗');
  });

  test('Lv.5 完成 Guided、Transfer 后进入 Autonomous，胜利后才写完成', async ({ page }) => {
    test.setTimeout(180_000);
    await enterWithCleanLessonRecord(page, 5);
    const contract = getContract(levelId(5));
    const guidedContract = contract.steps.find(step => step.id === 'lv5-guided');
    const transferContract = contract.steps.find(step => step.id === 'lv5-practice');
    expect(guidedContract.proofSelector).toMatchObject({
      requireExistingStarCount: 1,
      requireSupportingRuleCount: 2,
    });
    expect(transferContract.proofSelector).toMatchObject({
      requireExistingStarCount: 1,
      requireSupportingRuleCount: 2,
      preferDifferentUnitKind: true,
    });

    const guidedStart = await executeUntilProofStep(page, 'lv5-guided');
    expect(guidedStart.proof).toMatchObject({
      phase: 'guided',
      technique: 'remaining-capacity',
      expectedAction: 'place-star',
    });
    expect((await starredCells(page)).length).toBeGreaterThanOrEqual(1);

    const remainingActions = await executeLessonToAutonomous(page);
    const lessonActions = [...guidedStart.actions, ...remainingActions];
    expect(lessonActions.some(action => action.lessonStepId === 'lv5-guided')).toBe(true);
    expect(lessonActions.some(action => (
      action.lessonStepId === 'lv5-practice'
      && action.phase === 'transfer-practice'
    ))).toBe(true);
    expect(await readGuideAttributes(page)).toMatchObject({ type: 'autonomous' });
    expect((await readLessonStorage(page)).completedLessons?.[levelId(5)]).not.toBe(true);

    await finishAutonomous(page, 5);
    expect(contract.steps.at(-1)).toMatchObject({ phase: 'summary', type: 'summary' });
  });

  test('Lv.7 清空教学记录后从 INTRO 开始', async ({ page }) => {
    await enterWithCleanLessonRecord(page, 7);
    await expectIntro(page, 7, '交叉');
  });

  test('Lv.7 完成 Guided、Transfer 后进入 Autonomous，Transfer 不显示目标', async ({ page }) => {
    test.setTimeout(180_000);
    await enterWithCleanLessonRecord(page, 7);
    const contract = getContract(levelId(7));
    expect(contract.steps.find(step => step.id === 'lv7-guided').proofSelector)
      .toMatchObject({ requireMultipleSourceUnits: true });
    expect(contract.steps.find(step => step.id === 'lv7-practice').proofSelector)
      .toMatchObject({ requireMultipleSourceUnits: true });

    const guidedStart = await executeUntilProofStep(page, 'lv7-guided');
    expect(guidedStart.proof).toMatchObject({
      phase: 'guided',
      technique: 'multi-unit-intersection',
      expectedAction: 'eliminate',
    });
    expect(guidedStart.proof.observationCells.length).toBeGreaterThan(0);

    const practiceStart = await executeUntilProofStep(page, 'lv7-practice');
    expect(practiceStart.proof).toMatchObject({
      phase: 'transfer-practice',
      technique: 'multi-unit-intersection',
      expectedAction: 'eliminate',
    });
    expect(practiceStart.proof.derivedTargets.length).toBeGreaterThan(0);
    await expect(page.locator('.is-guide-action')).toHaveCount(0);

    const remainingActions = await executeLessonToAutonomous(page);
    expect(remainingActions.some(action => action.lessonStepId === 'lv7-practice')).toBe(true);
    expect(await readGuideAttributes(page)).toMatchObject({ type: 'autonomous' });
    expect((await readLessonStorage(page)).completedLessons?.[levelId(7)]).not.toBe(true);

    await finishAutonomous(page, 7);
    expect(contract.steps.at(-1)).toMatchObject({ phase: 'summary', type: 'summary' });
  });

  test('Lv.4、Lv.6、Lv.8 的 INTRO 触发保持正常', async ({ page }) => {
    for (const adjacent of [
      { levelNumber: 4, intro: '还缺的星数' },
      { levelNumber: 6, intro: '局部' },
      { levelNumber: 8, intro: '两者冲突' },
    ]) {
      await enterWithCleanLessonRecord(page, adjacent.levelNumber);
      await expectIntro(page, adjacent.levelNumber, adjacent.intro);
    }
  });

  test('completedLessons 只跳过对应已完成课程', async ({ page }) => {
    await page.goto('/');
    await clearAllGameData(page);
    await seedProgress(page, 7);
    await page.evaluate(({ key, completedLevelId }) => {
      localStorage.setItem(key, JSON.stringify({
        version: 5,
        completedLessons: { [completedLevelId]: true },
        replayLevelId: null,
      }));
    }, { key: DOUBLE_KEY, completedLevelId: levelId(5) });
    await page.reload();

    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-6' });
    await expectIntro(page, 7, '交叉');

    await page.goto('/');
    await goToLevel(page, { modeId: 'starDouble', levelKey: 'easy-4' });
    await expect(page.locator('[data-testid="star-line-board"]')).toBeVisible();
    await expect(page.locator('[data-testid="star-line-double-guide-card"]')).toHaveCount(0);
    const stored = await readLessonStorage(page);
    expect(stored.completedLessons).toEqual({ [levelId(5)]: true });
  });

  test('Lv.4→5 与 Lv.6→7 切关不会沿用上一课 SUMMARY', async ({ page }) => {
    test.setTimeout(360_000);
    for (const transition of [
      { fromLevel: 4, toLevel: 5, intro: '寻找第二颗' },
      { fromLevel: 6, toLevel: 7, intro: '交叉' },
    ]) {
      await enterWithCleanLessonRecord(page, transition.fromLevel);
      await executeLessonToAutonomous(page);
      await finishAutonomous(page, transition.fromLevel);
      expect((await readLessonStorage(page)).completedLessons?.[levelId(transition.toLevel)])
        .not.toBe(true);

      await page.locator('[data-testid="win-next-button"]').click();
      await expectIntro(page, transition.toLevel, transition.intro);
      await page.waitForTimeout(250);
      expect((await readLessonStorage(page)).completedLessons?.[levelId(transition.toLevel)])
        .not.toBe(true);
    }
  });
});
