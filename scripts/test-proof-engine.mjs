import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  deriveTargets,
  findAllProofs,
  getStarDoubleBoardStateHash,
  getStarDoubleProofIdentity,
  STAR_DOUBLE_PROOF_TECHNIQUE,
  validatePlayerAction,
  verifyStarDoubleProof,
} from '../src/game/starLine/starLineDoubleLessonEngine.js';
import {
  STAR_DOUBLE_LESSON_CONTRACTS,
  validateContractNoStaticAnswers,
} from '../src/game/starLine/starLineDoubleLessonContracts.js';
import { STAR_DOUBLE_TEACHING_LEVELS } from '../src/data/starDoubleTeachingLevels.js';
import { STAR_LINE_DOUBLE_TUTORIAL_CONTRACT } from '../src/game/starLine/starLineDoubleTutorialContract.js';
import { simulateLesson } from './simulate-teaching-lesson.mjs';

function makeGrid(level) {
  return level.regions.map(regionId => ({
    regionId,
    isStarred: false,
    isMarkedX: false,
  }));
}

function applyAction(gridData, action, cell) {
  const current = gridData[cell];
  if (action === 'place-star') {
    gridData[cell] = { ...current, isStarred: true, isMarkedX: false };
  } else {
    gridData[cell] = { ...current, isStarred: false, isMarkedX: true };
  }
}

const proofSource = readFileSync(
  new URL('../src/game/starLine/starLineDoubleLessonEngine.js', import.meta.url),
  'utf8',
);
assert(!/from\s+['"].*(human-logic|solver|solution)/i.test(proofSource));
assert(!/level\??\.solution|level\[['"]solution['"]\]/.test(proofSource));
assert(!/\.canonicalPath|\[['"]canonicalPath['"]\]/.test(proofSource));

const baseLevel = STAR_DOUBLE_TEACHING_LEVELS[1];
const emptyGrid = makeGrid(baseLevel);
const fakeSolutionA = [...baseLevel.solution];
const fakeSolutionB = Array.from({ length: 16 }, (_, index) => index);
const proofsA = findAllProofs({ ...baseLevel, solution: fakeSolutionA }, emptyGrid);
const proofsB = findAllProofs({ ...baseLevel, solution: fakeSolutionB }, emptyGrid);
assert.deepEqual(proofsA, proofsB, 'changing a fake solution must not change proofs');
assert(proofsA.length > 0, 'proofs must exist without answer-driven setup');

const proof = proofsA[0];
assert(verifyStarDoubleProof(baseLevel, emptyGrid, proof), 'independent verifier rejected proof');
const targets = deriveTargets(proof);
assert(targets.targetCells.length > 0);
assert(targets.observationCells.length > 0);
assert(targets.evidenceCells.length > 0);

const changedGrid = emptyGrid.map(cell => ({ ...cell }));
applyAction(changedGrid, proof.action, proof.derivedTargets[0]);
const changedHash = getStarDoubleBoardStateHash(changedGrid);
assert.notEqual(changedHash, proof.boardStateHash);
assert.equal(verifyStarDoubleProof(baseLevel, changedGrid, proof), false);
assert.equal(
  validatePlayerAction(proof, proof.derivedTargets[0], proof.action, changedHash).valid,
  false,
  'stale proof must not validate against a changed board',
);
assert.equal(
  validatePlayerAction({ ...proof, derivedTargets: [] }, 0, proof.action, proof.boardStateHash).valid,
  false,
  'empty-target proof must never be actionable',
);
assert.equal(
  validatePlayerAction(proof, proof.derivedTargets[0], proof.action, proof.boardStateHash).valid,
  true,
);
assert.equal(
  validatePlayerAction(proof, proof.derivedTargets[0], proof.action === 'place-star' ? 'eliminate' : 'place-star', proof.boardStateHash).valid,
  false,
);

assert.strictEqual(
  STAR_DOUBLE_LESSON_CONTRACTS['star-double-tutorial-01'],
  STAR_LINE_DOUBLE_TUTORIAL_CONTRACT,
  'Lv.1 must keep the approved contract object',
);
for (let lessonNumber = 2; lessonNumber <= 10; lessonNumber += 1) {
  const levelId = `star-double-tutorial-${String(lessonNumber).padStart(2, '0')}`;
  assert.deepEqual(validateContractNoStaticAnswers(levelId), []);
  for (const step of STAR_DOUBLE_LESSON_CONTRACTS[levelId].steps) {
    assert.equal(step.targetVisibility, 'hidden');
    if (step.expectedAction === 'dynamic') assert(step.proofSelector);
  }
}

const verifiedTechniques = new Set();
for (let lessonIndex = 1; lessonIndex <= 7; lessonIndex += 1) {
  const level = STAR_DOUBLE_TEACHING_LEVELS[lessonIndex];
  const simulation = simulateLesson(level, level.id);
  assert.equal(simulation.pass, true, `${level.id} simulation failed`);
  const gridData = makeGrid(level);
  for (const action of simulation.actionLog) {
    if (action.proofIdentity) {
      const currentProof = findAllProofs(level, gridData).find(candidate => (
        getStarDoubleProofIdentity(candidate) === action.proofIdentity
        && candidate.action === action.action
        && candidate.derivedTargets.includes(action.cell)
      ));
      assert(currentProof, `${level.id} could not replay proof ${action.proofIdentity}`);
      assert.equal(currentProof.boardStateHash, action.boardStateHashBefore);
      assert(verifyStarDoubleProof(level, gridData, currentProof));
      verifiedTechniques.add(currentProof.technique);
    }
    applyAction(gridData, action.action, action.cell);
    assert.equal(getStarDoubleBoardStateHash(gridData), action.boardStateHashAfter || action.boardStateHash);
  }
}
assert.deepEqual(
  verifiedTechniques,
  new Set(Object.values(STAR_DOUBLE_PROOF_TECHNIQUE)),
  'the curriculum must exercise and independently verify every proof technique',
);

console.log(`Proof engine: ${verifiedTechniques.size} techniques verified; stale, empty and answer-independence gates passed.`);
