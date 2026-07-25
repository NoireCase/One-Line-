/**
 * Star Double proof-driven E2E driver.
 *
 * Guided and practice actions come only from the board's read-only E2E
 * bridge. Autonomous completion uses the human-logic analyzer from the
 * current DOM state. Neither path reads a declared solution.
 */
import {
  analyzeStarDoubleHumanLogic,
  HUMAN_LOGIC_STATUS,
} from '../../scripts/star-double-human-logic.mjs';
import { getStarDoubleLessonContract } from '../../src/game/starLine/starLineDoubleLessonContracts.js';
import { STAR_DOUBLE_TEACHING_LEVELS } from '../../src/data/starDoubleTeachingLevels.js';

const SINGLE_TAP_COMMIT_MS = 340;
const MAX_LESSON_ACTIONS = 80;
const MAX_AUTONOMOUS_ACTIONS = 96;

function cell(page, index) {
  return page.locator(`[data-testid="star-line-cell-${index}"]`);
}

async function cellCenter(page, index) {
  const box = await cell(page, index).boundingBox();
  if (!box) throw new Error(`Star Double cell ${index} is not visible`);
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

async function pointerTap(page, index) {
  const point = await cellCenter(page, index);
  await page.mouse.click(point.x, point.y);
}

/** Uses the production pointer chain: two taps inside the double-tap window. */
export async function placeStar(page, index) {
  await page.evaluate((cellIndex) => {
    const board = document.querySelector('[data-testid="star-line-board"]');
    const target = document.querySelector(`[data-testid="star-line-cell-${cellIndex}"]`);
    if (!board || !target) throw new Error(`Star Double cell ${cellIndex} is not available`);
    const rect = target.getBoundingClientRect();
    const init = {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      clientX: rect.x + rect.width / 2,
      clientY: rect.y + rect.height / 2,
    };
    board.dispatchEvent(new PointerEvent('pointerdown', { ...init, buttons: 1 }));
    board.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
    board.dispatchEvent(new PointerEvent('pointerdown', { ...init, buttons: 1 }));
    board.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
  }, index);
  await page.waitForTimeout(140);
}

/** Uses one production pointer tap and waits for the pending X to commit. */
export async function markX(page, index) {
  await pointerTap(page, index);
  await page.waitForTimeout(SINGLE_TAP_COMMIT_MS);
}

export async function readBridgeProof(page) {
  return page.evaluate(() => {
    const proof = window.__STAR_DOUBLE_E2E_PROOF__;
    if (!proof) return null;
    return {
      levelId: proof.levelId,
      lessonStep: proof.lessonStep,
      lessonStepId: proof.lessonStepId,
      phase: proof.phase,
      technique: proof.technique,
      expectedAction: proof.expectedAction,
      observationCells: [...proof.observationCells],
      evidenceCells: [...proof.evidenceCells],
      derivedTargets: [...proof.derivedTargets],
      boardStateHash: proof.boardStateHash,
    };
  });
}

export async function readBridgeFreezeStatus(page) {
  return page.evaluate(() => {
    const proof = window.__STAR_DOUBLE_E2E_PROOF__;
    return proof ? {
      object: Object.isFrozen(proof),
      observationCells: Object.isFrozen(proof.observationCells),
      evidenceCells: Object.isFrozen(proof.evidenceCells),
      derivedTargets: Object.isFrozen(proof.derivedTargets),
      hasForbiddenFields: [
        'solution',
        'canonicalPath',
        'setter',
        'setCell',
      ].some(key => key in proof),
    } : null;
  });
}

export async function readBoardState(page) {
  return page.evaluate(() => (
    [...document.querySelectorAll('[data-testid^="star-line-cell-"]')]
      .map((element) => {
        const index = Number(element.getAttribute('data-testid')?.split('-').at(-1));
        const state = element.getAttribute('data-cell-state');
        return {
          index,
          isStarred: state === 'starred',
          isMarkedX: state === 'marked-x',
        };
      })
      .sort((first, second) => first.index - second.index)
      .map(({ isStarred, isMarkedX }) => ({ isStarred, isMarkedX }))
  ));
}

export async function readGuideCopy(page) {
  return page.locator('[data-testid="star-line-guide-copy"]').textContent();
}

export async function readGuideAttributes(page) {
  return page.evaluate(() => {
    const card = document.querySelector('[data-testid="star-line-double-guide-card"]');
    if (!card) return null;
    return {
      step: Number(card.getAttribute('data-guide-step') || 0),
      type: card.getAttribute('data-guide-type') || '',
      proofAction: card.getAttribute('data-proof-action') || '',
      proofTechnique: card.getAttribute('data-proof-technique') || '',
      proofHash: card.getAttribute('data-proof-hash') || '',
    };
  });
}

export function getTeachingLevel(index) {
  const level = STAR_DOUBLE_TEACHING_LEVELS[index];
  if (!level) return null;
  return Object.freeze({
    id: level.id,
    N: level.N,
    regions: Object.freeze([...level.regions]),
  });
}

export function getContract(levelId) {
  return getStarDoubleLessonContract(levelId);
}

export async function verifyActionHint(page, expectedAction) {
  const hint = await page.locator('[data-testid="star-line-proof-action-hint"]').textContent();
  if (expectedAction === 'eliminate') {
    return hint.includes('标 X') || hint.includes('标成 X');
  }
  if (expectedAction === 'place-star') {
    return hint.includes('放置星星');
  }
  return false;
}

export async function tryClickGuide(page) {
  const button = page.locator('[data-testid="star-line-double-guide-action"]');
  const visible = await button.isVisible({ timeout: 400 }).catch(() => false);
  if (!visible || await button.isDisabled()) return false;
  const text = (await button.textContent()) || '';
  if (text.includes('查看提示') || text.includes('已查看')) return false;
  await button.click();
  await page.waitForTimeout(120);
  return true;
}

export async function skipToInteractive(page) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (!(await tryClickGuide(page))) return;
  }
}

export async function executeProofTarget(page, proof, index) {
  if (proof.expectedAction === 'place-star') {
    await placeStar(page, index);
  } else if (proof.expectedAction === 'eliminate') {
    await markX(page, index);
  } else {
    throw new Error(`Unsupported proof action: ${proof.expectedAction}`);
  }
}

/**
 * Executes exactly one target from one fresh bridge snapshot, then waits for
 * the board hash or lesson step to change before returning.
 */
export async function executeCurrentProof(page) {
  const proof = await readBridgeProof(page);
  if (!proof?.derivedTargets?.length) return null;
  if (!(await verifyActionHint(page, proof.expectedAction))) {
    throw new Error(`Guide copy does not explain action ${proof.expectedAction}`);
  }

  const target = proof.derivedTargets[0];
  const expectedState = proof.expectedAction === 'place-star' ? 'starred' : 'marked-x';
  await executeProofTarget(page, proof, target);
  await page.waitForFunction(({ target, expectedState }) => (
    document.querySelector(`[data-testid="star-line-cell-${target}"]`)
      ?.getAttribute('data-cell-state') === expectedState
  ), { target, expectedState }, { timeout: 5_000 });
  const actualState = await cellState(page, target);
  if (actualState !== expectedState) {
    throw new Error(`Proof action ${proof.expectedAction}@${target} produced ${actualState}`);
  }

  await page.waitForFunction(({ boardStateHash, lessonStep }) => {
    const next = window.__STAR_DOUBLE_E2E_PROOF__;
    if (!next) return true;
    return next.boardStateHash !== boardStateHash || next.lessonStep !== lessonStep;
  }, {
    boardStateHash: proof.boardStateHash,
    lessonStep: proof.lessonStep,
  });
  const nextProof = await readBridgeProof(page);
  if (nextProof?.boardStateHash === proof.boardStateHash) {
    throw new Error(`Proof driver observed a repeated board hash: ${proof.boardStateHash}`);
  }
  return {
    ...proof,
    executedTarget: target,
    nextBoardStateHash: nextProof?.boardStateHash || null,
    nextLessonStep: nextProof?.lessonStep || null,
  };
}

export async function executeLessonToAutonomous(page) {
  await skipToInteractive(page);
  const actions = [];
  for (let attempt = 0; attempt < MAX_LESSON_ACTIONS; attempt += 1) {
    const attributes = await readGuideAttributes(page);
    if (attributes?.type === 'autonomous') return actions;
    const action = await executeCurrentProof(page);
    if (action) {
      actions.push(action);
      continue;
    }
    await page.waitForTimeout(100);
    const nextAttributes = await readGuideAttributes(page);
    if (nextAttributes?.type === 'autonomous') return actions;
    if (await tryClickGuide(page)) continue;
    throw new Error(`Lesson stalled at step ${nextAttributes?.step}/${nextAttributes?.type}`);
  }
  throw new Error(`Lesson exceeded ${MAX_LESSON_ACTIONS} proof actions`);
}

function initialStateFromGrid(gridData) {
  return gridData.map(cellData => (
    cellData.isStarred ? 'S' : cellData.isMarkedX ? 'X' : 'U'
  ));
}

/** Completes autonomous play from DOM state using only supported human rules. */
export async function completeLevelByHumanLogic(page, levelIndex) {
  const level = getTeachingLevel(levelIndex);
  if (!level) throw new Error(`Unknown teaching level index ${levelIndex}`);
  const actionLog = [];
  for (let attempt = 0; attempt < MAX_AUTONOMOUS_ACTIONS; attempt += 1) {
    if (await page.locator('[data-testid="win-panel"]').isVisible().catch(() => false)) {
      return actionLog;
    }
    const gridData = await readBoardState(page);
    const analysis = analyzeStarDoubleHumanLogic({
      N: level.N,
      quota: 2,
      regions: level.regions,
      initialState: initialStateFromGrid(gridData),
    }, { solverStatus: 'UNIQUE' });
    const event = analysis.canonicalPath?.[0];
    if (!event?.affectedCells?.length) {
      if (analysis.status === HUMAN_LOGIC_STATUS.SOLVED_SUPPORTED_RULES) {
        await page.locator('[data-testid="win-panel"]').waitFor({ timeout: 10_000 });
        return actionLog;
      }
      throw new Error(`Human logic stalled: ${analysis.status}/${analysis.reason || 'no event'}`);
    }
    const target = event.affectedCells[0];
    const proof = {
      expectedAction: event.action,
    };
    await executeProofTarget(page, proof, target);
    const expectedState = event.action === 'place-star' ? 'starred' : 'marked-x';
    await page.waitForFunction(({ target, expectedState }) => (
      document.querySelector(`[data-testid="star-line-cell-${target}"]`)
        ?.getAttribute('data-cell-state') === expectedState
    ), { target, expectedState }, { timeout: 5_000 });
    actionLog.push({
      action: event.action,
      target,
      technique: event.technique,
    });
  }
  throw new Error(`Autonomous play exceeded ${MAX_AUTONOMOUS_ACTIONS} actions`);
}

export async function cellState(page, index) {
  return cell(page, index).getAttribute('data-cell-state');
}

export async function starredCells(page) {
  return page.evaluate(() => (
    [...document.querySelectorAll('[data-cell-state="starred"]')]
      .map(element => Number(element.getAttribute('data-testid')?.split('-').at(-1)))
      .filter(Number.isInteger)
  ));
}

export async function markedXCells(page) {
  return page.evaluate(() => (
    [...document.querySelectorAll('[data-cell-state="marked-x"]')]
      .map(element => Number(element.getAttribute('data-testid')?.split('-').at(-1)))
      .filter(Number.isInteger)
  ));
}
