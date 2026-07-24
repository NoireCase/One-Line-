/**
 * Proof engine validation tests.
 * Run: node scripts/test-proof-engine.mjs
 */
import { findAllProofs, deriveTargets, validatePlayerAction, computeTeachingMetrics } from '../src/game/starLine/starLineDoubleLessonEngine.js';
import { STAR_DOUBLE_LESSON_CONTRACTS, validateContractNoStaticAnswers, isStarDoubleTeachingLevel, COURSE_TYPE } from '../src/game/starLine/starLineDoubleLessonContracts.js';
import { STAR_DOUBLE_TEACHING_LEVELS } from '../src/data/starDoubleTeachingLevels.js';
import { STAR_LINE_DOUBLE_TUTORIAL_CONTRACT } from '../src/game/starLine/starLineDoubleTutorialContract.js';

let passed = 0, failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error(`  FAIL: ${msg}`); }
}

function makeGrid(N, regions, stars = [], xs = []) {
  return Array.from({ length: N * N }, (_, i) => ({
    regionId: regions[i],
    isStarred: stars.includes(i),
    isMarkedX: xs.includes(i),
  }));
}

const lv1 = STAR_DOUBLE_TEACHING_LEVELS[0];
const N = 8;
const regions = lv1.regions;

console.log('=== 1. Proof does not read solution ===');

// Test: same board state, different solutions → same proofs
const gridA = makeGrid(N, regions, [13], []);
const proofsA = findAllProofs({ N, regions, starsPerRow: 2, solution: lv1.solution }, gridA);
const proofsB = findAllProofs({ N, regions, starsPerRow: 2, solution: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15] }, gridA);
assert(JSON.stringify(proofsA) === JSON.stringify(proofsB), 'proofs differ with different solutions (should be identical)');

// Test: proofs exist without solution field at all
const proofsNoSolution = findAllProofs({ N, regions, starsPerRow: 2 }, gridA);
assert(proofsNoSolution.length > 0, 'proofs should exist without solution field');

console.log('=== 2. boardStateHash changes invalidate stale proofs ===');

const gridEmpty = makeGrid(N, regions, [], []);
const proofsEmpty = findAllProofs({ N, regions, starsPerRow: 2 }, gridEmpty);
const hashEmpty = proofsEmpty.length > 0 ? proofsEmpty[0].boardStateHash : null;

// After placing a star, hash should change
const gridWithStar = makeGrid(N, regions, [4], []);
const proofsStar = findAllProofs({ N, regions, starsPerRow: 2 }, gridWithStar);
const adjProofs = proofsStar.filter(p => p.technique === 'adjacency-exclusion');
if (adjProofs.length > 0) {
  assert(adjProofs[0].boardStateHash !== hashEmpty, 'boardStateHash should change after placing star');
  // Verify the old hash doesn't match the new state
  assert(adjProofs[0].boardStateHash !== proofsEmpty[0]?.boardStateHash, 'hash must differ from empty board hash');
}

console.log('=== 3. Contract static answer field scan ===');

// Lv.2-10 contracts must not have forbidden fields
for (let i = 2; i <= 10; i++) {
  const id = `star-double-tutorial-${String(i).padStart(2, '0')}`;
  const violations = validateContractNoStaticAnswers(id);
  assert(violations.length === 0, `Lv.${i}: contract violations: ${violations.join('; ')}`);
}

// Lv.1 uses original contract - should still be the real one (not a copy)
const lv1Contract = STAR_DOUBLE_LESSON_CONTRACTS['star-double-tutorial-01'];
assert(lv1Contract === STAR_LINE_DOUBLE_TUTORIAL_CONTRACT, 'Lv.1 must use original contract, not a copy');

console.log('=== 4. deriveTargets dynamic computation ===');

const grid = makeGrid(N, regions, [13], []);
const proofs = findAllProofs({ N, regions, starsPerRow: 2 }, grid);
const adjP = proofs.find(p => p.technique === 'adjacency-exclusion');
if (adjP) {
  const targets = deriveTargets(adjP);
  assert(targets.targetCells.length > 0, 'deriveTargets should produce non-empty target cells');
  assert(targets.targetCells.every(c => c >= 0 && c < 64), 'target cells must be valid indices');
  assert(targets.observationCells.length > 0, 'observation cells must be non-empty');
  assert(targets.evidenceCells.length > 0, 'evidence cells must be non-empty');

  // Verify that targets change when board state changes
  const grid2 = makeGrid(N, regions, [22], []);
  const proofs2 = findAllProofs({ N, regions, starsPerRow: 2 }, grid2);
  const adjP2 = proofs2.find(p => p.technique === 'adjacency-exclusion');
  if (adjP2) {
    const targets2 = deriveTargets(adjP2);
    // Targets should differ because the star is at a different position
    assert(
      JSON.stringify(targets.targetCells.sort()) !== JSON.stringify(targets2.targetCells.sort()),
      'deriveTargets should produce different results for different board states'
    );
  }
}

console.log('=== 5. SETUP step real operability ===');

// All Lv.2-9 contracts: SETUP steps must have prerequisiteRules
for (let i = 2; i <= 9; i++) {
  const id = `star-double-tutorial-${String(i).padStart(2, '0')}`;
  const contract = STAR_DOUBLE_LESSON_CONTRACTS[id];
  if (!contract) continue;
  const setupSteps = contract.steps.filter(s => s.type === 'setup');
  for (const step of setupSteps) {
    // expectedAction null = adaptive (accepts any proof from prerequisiteRules)
    assert(step.prerequisiteRules?.length > 0 || step.expectedAction !== undefined, `${id}/${step.id}: SETUP must have prerequisiteRules or expectedAction`);
    assert(step.hintTiers?.length > 0, `${id}/${step.id}: SETUP must have hintTiers`);
    assert(!step.actionCells, `${id}/${step.id}: SETUP must not have static actionCells`);
    assert(!step.targetCells, `${id}/${step.id}: SETUP must not have static targetCells`);
  }
}

console.log('=== 6. Empty target interactive step rejection ===');

// Guided/practice steps must not have empty targets at runtime
for (let i = 2; i <= 9; i++) {
  const id = `star-double-tutorial-${String(i).padStart(2, '0')}`;
  const contract = STAR_DOUBLE_LESSON_CONTRACTS[id];
  if (!contract) continue;
  const interactiveSteps = contract.steps.filter(s =>
    s.type === 'guided' || s.type === 'practice'
  );
  for (const step of interactiveSteps) {
    assert(!step.actionCells, `${id}/${step.id}: must not have static actionCells`);
    // Chain steps with null technique/action = free-form (accepts any proof)
    assert(step.technique || step.expectedAction || step.chainStep, `${id}/${step.id}: must have technique, expectedAction, or be a chain step`);
  }
}

console.log('=== 7. Course type consistency ===');

const courseTypes = {
  'star-double-tutorial-02': COURSE_TYPE.EQUIVALENT_CONCEPT,
  'star-double-tutorial-03': COURSE_TYPE.RULE,
  'star-double-tutorial-04': COURSE_TYPE.RULE,
  'star-double-tutorial-05': COURSE_TYPE.STRATEGY,
  'star-double-tutorial-06': COURSE_TYPE.RULE,
  'star-double-tutorial-07': COURSE_TYPE.RULE,
  'star-double-tutorial-08': COURSE_TYPE.RULE,
  'star-double-tutorial-09': COURSE_TYPE.STRATEGY,
  'star-double-tutorial-10': COURSE_TYPE.STRATEGY,
};

for (const [id, expected] of Object.entries(courseTypes)) {
  const c = STAR_DOUBLE_LESSON_CONTRACTS[id];
  assert(c?.courseType === expected, `${id}: expected courseType=${expected}, got ${c?.courseType}`);
}

// Verify isStarDoubleTeachingLevel
assert(isStarDoubleTeachingLevel('star-double-tutorial-01'), 'Lv.1 should be teaching level');
assert(isStarDoubleTeachingLevel('star-double-tutorial-10'), 'Lv.10 should be teaching level');
assert(!isStarDoubleTeachingLevel('star-double-tutorial-11'), 'Lv.11 should not exist');

console.log('=== 8. validatePlayerAction ===');

const proof = { technique: 'adjacency-exclusion', action: 'eliminate', derivedTargets: [3, 5, 11, 12, 13] };
assert(validatePlayerAction(proof, 3, 'eliminate', []).valid, 'valid action should pass');
assert(!validatePlayerAction(proof, 3, 'place-star', []).valid, 'wrong action type should fail');
assert(!validatePlayerAction(proof, 99, 'eliminate', []).valid, 'wrong cell should fail');
assert(!validatePlayerAction(null, 3, 'eliminate', []).valid, 'null proof should fail');

console.log('=== 9. computeTeachingMetrics ===');

const metrics = computeTeachingMetrics({ N: 8, regions, starsPerRow: 2 }, grid);
assert(metrics.availableProofCount > 0, 'should have available proofs');
assert(metrics.techniquesAvailable.length > 0, 'should have techniques available');

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
