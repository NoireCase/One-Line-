/**
 * Proof-driven E2E helper — reads proof data from E2E bridge or computes from engine.
 * Uses the real board's activeProof when bridge is available (E2E mode).
 * Falls back to test-side computation when bridge not present.
 * Never reads solution. Never writes localStorage directly.
 */
import { findAllProofs } from '../../src/game/starLine/starLineDoubleLessonEngine.js';
import { getStarDoubleLessonContract } from '../../src/game/starLine/starLineDoubleLessonContracts.js';
import { STAR_DOUBLE_TEACHING_LEVELS } from '../../src/data/starDoubleTeachingLevels.js';

// ═══ E2E Bridge (reads board's actual activeProof) ═══

/** Read the current active proof from the E2E bridge (board's own proof engine output) */
export async function readBridgeProof(page) {
  return page.evaluate(() => {
    const bp = window.__STAR_DOUBLE_E2E_PROOF__;
    if (!bp || !bp.derivedTargets?.length) return null;
    return {
      action: bp.expectedAction,
      derivedTargets: [...bp.derivedTargets],
      technique: bp.technique,
      observationCells: bp.observationCells || [],
      evidenceCells: bp.evidenceCells || [],
      boardStateHash: bp.boardStateHash,
      lessonStep: bp.lessonStep,
      phase: bp.phase,
      levelId: bp.levelId,
    };
  });
}

// ═══ 浏览器端 DOM helpers ═══

function cell(page, idx) {
  return page.locator(`[data-testid="star-line-cell-${idx}"]`);
}

/** Read the current board state (isStarred/isMarkedX per cell) from the DOM */
export async function readBoardState(page) {
  return page.evaluate(() => {
    const cells = document.querySelectorAll('[data-testid^="star-line-cell-"]');
    const result = [];
    cells.forEach(c => {
      const state = c.getAttribute('data-cell-state');
      result.push({
        isStarred: state === 'starred',
        isMarkedX: state === 'marked-x',
      });
    });
    return result;
  });
}

/** Read current guide copy text */
export async function readGuideCopy(page) {
  const el = page.locator('[data-testid="star-line-guide-copy"]');
  return el.textContent();
}

/** Read guide card data attributes */
export async function readGuideAttributes(page) {
  return page.evaluate(() => {
    const card = document.querySelector('[data-testid="star-line-double-guide-card"]');
    if (!card) return null;
    return {
      step: parseInt(card.getAttribute('data-guide-step') || '0', 10),
      type: card.getAttribute('data-guide-type') || '',
      hintLevel: parseInt(card.getAttribute('data-hint-level') || '0', 10),
      deductionId: card.getAttribute('data-deduction-id') || '',
      boardHash: card.getAttribute('data-deduction-board-hash') || '',
      hintMode: card.getAttribute('data-hint-mode') || '',
    };
  });
}

// ═══ 测试侧 Proof 计算 ═══

/** Get the teaching level by index (0 = Lv.1, ..., 9 = Lv.10) */
export function getTeachingLevel(index) {
  return STAR_DOUBLE_TEACHING_LEVELS[index];
}

/** Get lesson contract by levelId */
export function getContract(levelId) {
  return getStarDoubleLessonContract(levelId);
}

/**
 * Compute the matching proof for the current teaching step.
 * Uses the SAME findAllProofs engine as the product board.
 * Returns { action, derivedTargets, technique, observationCells, evidenceCells } or null.
 */
export function findMatchingProof(levelIndex, gridData, stepIndex) {
  const level = STAR_DOUBLE_TEACHING_LEVELS[levelIndex];
  if (!level) return null;

  const contract = getStarDoubleLessonContract(level.id);
  if (!contract?.steps) return null;

  const step = contract.steps[stepIndex];
  if (!step) return null;

  // Compute all proofs from current board state
  const allProofs = findAllProofs(
    { N: level.N, regions: level.regions, starsPerRow: 2 },
    gridData
  );

  if (allProofs.length === 0) return null;

  // Prefer proof matching step's technique, then expectedAction, then any
  let proof = null;
  if (step.technique) {
    proof = allProofs.find(p => p.technique === step.technique);
  }
  if (!proof && step.expectedAction) {
    proof = allProofs.find(p => p.action === step.expectedAction);
  }
  if (!proof) {
    proof = allProofs[0];
  }

  return {
    action: proof.action,
    derivedTargets: [...proof.derivedTargets],
    technique: proof.technique,
    observationCells: proof.observationCells || [],
    evidenceCells: proof.evidenceCells || [],
    boardStateHash: proof.boardStateHash || '',
  };
}

/**
 * Check if the current UI copy is consistent with the proof's action type.
 * Returns true if the copy contains action hints matching the expected action.
 */
export async function verifyActionHint(page, expectedAction) {
  const copy = await readGuideCopy(page);
  if (expectedAction === 'eliminate') {
    return copy.includes('标 X') || copy.includes('排除') || copy.includes('标成 X');
  }
  if (expectedAction === 'place-star') {
    return copy.includes('放星') || copy.includes('双击') || copy.includes('确定');
  }
  return true; // No action-specific check
}

/**
 * Run one proof-driven interaction cycle.
 * Prefers E2E bridge (board's actual activeProof). Falls back to test-side computation.
 */
export async function executeCurrentProof(page, lvIdx) {
  // Try bridge first (board's own proof engine output)
  const bridge = await readBridgeProof(page);
  if (bridge && bridge.derivedTargets.length > 0) {
    const count = await executeAllTargets(page, bridge);
    await waitForBoard(page);
    return { ...bridge, executedCount: count, source: 'bridge' };
  }

  // Fallback: test-side computation
  const board = await readBoardState(page);
  const attrs = await readGuideAttributes(page);
  if (!attrs || attrs.step <= 0) return null;

  const proofInfo = findMatchingProof(lvIdx, board, attrs.step - 1);
  if (!proofInfo || proofInfo.derivedTargets.length === 0) return null;

  const count = await executeAllTargets(page, proofInfo);
  await waitForBoard(page);
  return { ...proofInfo, executedCount: count, source: 'fallback' };
}

// ═══ 浏览器交互 ═══

/** Click the guide button if it's an explain/setup type (not a delayed hint) */
export async function tryClickGuide(page) {
  const btn = page.locator('[data-testid="star-line-double-guide-action"]');
  const visible = await btn.isVisible({ timeout: 400 }).catch(() => false);
  if (!visible) return false;
  const text = (await btn.textContent()) || '';
  // Don't click delayed-hint buttons
  if (text.includes('秒后解锁') || text.includes('查看提示') || text.includes('已查看')) return false;
  await btn.click();
  await page.waitForTimeout(250);
  return true;
}

/** Click through all explain/setup buttons */
export async function skipToInteractive(page) {
  for (let i = 0; i < 6; i++) { if (!(await tryClickGuide(page))) break; }
}

/** Double-click to place a star */
export async function placeStar(page, idx) {
  await cell(page, idx).dblclick();
  await page.waitForTimeout(120);
}

/** Click to mark X */
export async function markX(page, idx) {
  await cell(page, idx).click();
  await page.waitForTimeout(80);
}

/** Execute the matching proof's action on ONE target cell */
export async function executeProofTarget(page, proofInfo, cellIdx) {
  if (proofInfo.action === 'place-star') {
    await placeStar(page, cellIdx);
  } else if (proofInfo.action === 'eliminate') {
    await markX(page, cellIdx);
  }
}

/** Execute ALL derived targets of the current proof */
export async function executeAllTargets(page, proofInfo) {
  if (!proofInfo || proofInfo.derivedTargets.length === 0) return 0;
  for (const target of proofInfo.derivedTargets) {
    await executeProofTarget(page, proofInfo, target);
  }
  return proofInfo.derivedTargets.length;
}

/** Read cell state from DOM */
export async function cellState(page, idx) {
  return cell(page, idx).getAttribute('data-cell-state');
}

/** Get all starred cell indices */
export async function starredCells(page) {
  return page.evaluate(() => {
    const cells = document.querySelectorAll('[data-cell-state="starred"]');
    return [...cells].map(c => {
      const t = c.getAttribute('data-testid');
      return t ? parseInt(t.replace('star-line-cell-', ''), 10) : -1;
    }).filter(i => i >= 0);
  });
}

/** Get all marked-X cell indices */
export async function markedXCells(page) {
  return page.evaluate(() => {
    const cells = document.querySelectorAll('[data-cell-state="marked-x"]');
    return [...cells].map(c => {
      const t = c.getAttribute('data-testid');
      return t ? parseInt(t.replace('star-line-cell-', ''), 10) : -1;
    }).filter(i => i >= 0);
  });
}

/** Complete a level by placing all solution stars (autonomous phase only — no validation) */
export async function completeLevel(page, solution) {
  for (const s of solution) {
    if (await cellState(page, s) === 'starred') continue;
    await placeStar(page, s);
  }
  await page.locator('[data-testid="win-panel"]').waitFor({ timeout: 20000 });
  return true;
}

/** Wait for board state to stabilize */
export async function waitForBoard(page) {
  await page.waitForTimeout(300);
}
