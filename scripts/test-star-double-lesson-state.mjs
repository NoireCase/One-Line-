import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  findAllProofs,
  getStarDoubleBoardStateHash,
  getStarDoubleProofIdentity,
} from '../src/game/starLine/starLineDoubleLessonEngine.js';
import { getStarDoubleLessonContract } from '../src/game/starLine/starLineDoubleLessonContracts.js';
import {
  advanceStarDoubleLessonRuntime,
  createStarDoubleChainConclusion,
  createStarDoubleLessonObjective,
  createStarDoubleLessonRuntime,
  isStarDoubleLessonStepComplete,
  recordStarDoubleLessonAction,
  selectStarDoubleLessonProof,
} from '../src/game/starLine/starLineDoubleLessonState.js';
import { STAR_DOUBLE_TEACHING_LEVELS } from '../src/data/starDoubleTeachingLevels.js';

function makeGrid(level) {
  return level.regions.map(regionId => ({
    regionId,
    isStarred: false,
    isMarkedX: false,
  }));
}

function applyAction(gridData, proof, cell) {
  const current = gridData[cell];
  gridData[cell] = proof.action === 'place-star'
    ? { ...current, isStarred: true, isMarkedX: false }
    : { ...current, isStarred: false, isMarkedX: true };
}

const level = STAR_DOUBLE_TEACHING_LEVELS[8];
const contract = getStarDoubleLessonContract(level.id);
const gridData = makeGrid(level);
let runtime = advanceStarDoubleLessonRuntime(createStarDoubleLessonRuntime(level.id));
const chainEvidence = [];

for (const step of contract.steps.slice(1, 4)) {
  const proofsBefore = findAllProofs(level, gridData);
  const selected = selectStarDoubleLessonProof({
    step,
    proofs: proofsBefore,
    level,
    gridData,
    completedObjectives: runtime.completedObjectives,
    previousConclusion: runtime.previousConclusion,
  });
  assert(selected, `${step.id} must select a proof`);
  assert.equal(selected.derivedTargets.length, 1, `${step.id} must expose one conclusion`);
  if (step.proofSelector.dependsOnPreviousConclusion) {
    assert(
      !runtime.previousConclusion.availableProofIdentitiesBefore.includes(
        getStarDoubleProofIdentity(selected),
      ),
      `${step.id} proof existed before the prior action`,
    );
    assert(
      selected.involvedUnits.some(unit => runtime.previousConclusion.involvedUnits.includes(unit)),
      `${step.id} does not share an affected unit with the prior action`,
    );
  }

  const cell = selected.derivedTargets[0];
  runtime = recordStarDoubleLessonAction(runtime, {
    proof: selected,
    cellIndex: cell,
    availableProofIdentitiesBefore: proofsBefore.map(getStarDoubleProofIdentity),
  });
  const objective = runtime.objective || createStarDoubleLessonObjective(selected);
  assert.equal(isStarDoubleLessonStepComplete({
    step,
    objective,
    level,
    gridData,
    proofs: proofsBefore,
    acceptedActionInStep: runtime.acceptedActionInStep,
  }), false, `${step.id} completed before its action changed the board`);
  applyAction(gridData, selected, cell);
  const proofsAfter = findAllProofs(level, gridData);
  assert.equal(isStarDoubleLessonStepComplete({
    step,
    objective,
    level,
    gridData,
    proofs: proofsAfter,
    acceptedActionInStep: runtime.acceptedActionInStep,
  }), true, `${step.id} did not complete from its semantic predicate`);

  const conclusion = createStarDoubleChainConclusion(
    runtime,
    getStarDoubleBoardStateHash(gridData),
  );
  chainEvidence.push(conclusion);
  runtime = advanceStarDoubleLessonRuntime(runtime, { objective, conclusion });
}

assert.equal(chainEvidence.length, 3);
assert.equal(new Set(chainEvidence.map(item => item.boardStateHashAfter)).size, 3);
assert.deepEqual(
  chainEvidence.map(item => item.action),
  ['place-star', 'place-star', 'eliminate'],
);

const lv7 = STAR_DOUBLE_TEACHING_LEVELS[6];
const lv7Setup = getStarDoubleLessonContract(lv7.id).steps[1];
const lv7Grid = makeGrid(lv7);
assert.equal(isStarDoubleLessonStepComplete({
  step: lv7Setup,
  objective: null,
  level: lv7,
  gridData: lv7Grid,
  proofs: findAllProofs(lv7, lv7Grid),
  acceptedActionInStep: false,
}), false, 'setup may not auto-complete before a real action');

assert.equal(selectStarDoubleLessonProof({
  step: { proofSelector: { techniques: ['not-a-rule'] } },
  proofs: findAllProofs(level, makeGrid(level)),
  level,
  gridData: makeGrid(level),
}), null);

const boardSource = readFileSync(
  new URL('../src/components/game/StarLineBoard.jsx', import.meta.url),
  'utf8',
);
assert(!/stepProofActionsRef|nextProof|FIXED_ACTION/i.test(boardSource));
assert(/validatePlayerAction\(\s*proof/.test(boardSource));
assert(/const p = doubleRuleGuide\.activeProof/.test(boardSource));

console.log('Lesson state: semantic transitions, missing-proof blocking and 3-step propagation dependency passed.');
