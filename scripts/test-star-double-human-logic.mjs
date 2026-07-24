import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CELL_STATE,
  DEDUCTION_TECHNIQUE,
  HUMAN_LOGIC_SEARCH_LIMITS,
  HUMAN_LOGIC_STATUS,
  analyzeStarDoubleHumanLogic,
  collectHumanLogicEvents,
  detectDeductionEventConflicts,
  replayHumanLogicTrace,
} from './star-double-human-logic.mjs';
import { STAR_LINE_LEVELS } from '../src/data/starLineLevels.js';

let passed = 0;
let failed = 0;
const TEST_FILTER = process.env.STAR_DOUBLE_HUMAN_LOGIC_TEST_FILTER;

function assert(condition, message = 'assertion failed') {
  if (!condition) throw new Error(message);
}

function test(name, fn) {
  if (TEST_FILTER && !name.includes(TEST_FILTER)) return;
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${error.message}`);
  }
}

function idx(cell, N) {
  return Array.isArray(cell) ? cell[0] * N + cell[1] : cell;
}

const fixturePath = resolve('scripts/fixtures/star-double-human-logic.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));

function puzzleFromCase(item) {
  const layout = fixture.regionLayouts[item.layout];
  return {
    N: layout.N,
    quota: 2,
    regions: layout.regions,
    initialState: item.state,
  };
}

function eventMatches(event, expected, N) {
  return event.technique === expected.technique
    && event.action === expected.action
    && event.affectedCells.includes(idx(expected.cell, N));
}

console.log('\n═══ Stage A: fixture rule coverage ═══');

for (const item of fixture.ruleCases) {
  test(item.id, () => {
    const puzzle = puzzleFromCase(item);
    const result = collectHumanLogicEvents(puzzle);
    const expected = item.expect || item.reject;
    const found = result.events.some(event => eventMatches(event, expected, puzzle.N));
    if (item.expect) assert(found, `expected ${expected.technique} on ${expected.cell}`);
    else assert(!found, `unexpected ${expected.technique} on ${expected.cell}`);
  });
}

test('each deduction rule has at least two positive and one negative fixture', () => {
  for (const technique of Object.values(DEDUCTION_TECHNIQUE)) {
    const positives = fixture.ruleCases.filter(item => item.expect?.technique === technique);
    const negatives = fixture.ruleCases.filter(item => item.reject?.technique === technique);
    assert(positives.length >= 2, `${technique} needs two positive fixtures`);
    assert(negatives.length >= 1, `${technique} needs one negative fixture`);
  }
});

console.log('\n═══ Stage A: proof and event contract ═══');

test('events contain proof, dependencies, depth and input hash', () => {
  const item = fixture.ruleCases.find(entry => entry.id === 'confined-region-to-row-positive');
  const puzzle = puzzleFromCase(item);
  const result = collectHumanLogicEvents(puzzle);
  const event = result.events.find(candidate => eventMatches(candidate, item.expect, puzzle.N));
  for (const key of [
    'id', 'ruleSetVersion', 'technique', 'action', 'affectedCells', 'sourceUnits',
    'witnessCells', 'prerequisiteEvents', 'propagationDepth', 'proof', 'inputStateHash',
  ]) {
    assert(event[key] !== undefined, `event missing ${key}`);
  }
  const confinedProof = event.proofs.find(proof => proof.type === 'confined-capacity');
  assert(confinedProof, 'missing confined-capacity proof');
  assert(confinedProof.sourceRemainingQuota === confinedProof.targetRemainingQuota,
    'confined proof must preserve equal remaining quota');
  assert(confinedProof.sourceCandidatesContainedByTarget === true,
    'confined proof must record containment');
  assert(!('confidence' in event), 'confidence must not replace proof');
});

test('two-by-two proof records capacity and block cover', () => {
  const item = fixture.ruleCases.find(entry => entry.id === 'two-by-two-row-positive');
  const puzzle = puzzleFromCase(item);
  const result = collectHumanLogicEvents(puzzle);
  const event = result.events.find(candidate => eventMatches(candidate, item.expect, puzzle.N));
  assert(event.proofs.some(proof => proof.type === 'two-by-two-capacity'), 'missing 2x2 proof');
  const proof = event.proofs.find(candidate => candidate.type === 'two-by-two-capacity');
  assert(proof.blockCapacity === 1, '2x2 capacity must be 1');
  assert(proof.coverProofs.length > 0, '2x2 cover proof missing');
});

function formalPuzzle(levelId, includeSolution = true) {
  const level = STAR_LINE_LEVELS.find(candidate => candidate.id === levelId);
  assert(level, `missing formal level ${levelId}`);
  return {
    N: level.N,
    quota: 2,
    regions: level.regions,
    ...(includeSolution ? { solution: level.solution } : {}),
  };
}

function proofFor(result, technique, cell = null) {
  const event = result.events.find(candidate =>
    (candidate.technique === technique
      || candidate.supportingTechniques?.includes(technique))
    && (cell === null || candidate.affectedCells.includes(cell)));
  return {
    event,
    proof: event?.proof?.type === technique.toLowerCase()
      ? event.proof
      : event?.proofs?.find(candidate =>
        candidate.type === (technique === DEDUCTION_TECHNIQUE.MULTI_UNIT_CONFINEMENT
          ? 'multi-unit-confinement'
          : 'pressured-group-exclusion')),
  };
}

test('multi-unit proof records strict two-by-two containment and capacity equality', () => {
  const result = collectHumanLogicEvents(formalPuzzle('star-lv-22', false));
  const { event, proof } = proofFor(
    result,
    DEDUCTION_TECHNIQUE.MULTI_UNIT_CONFINEMENT,
    53,
  );
  assert(event?.technique === DEDUCTION_TECHNIQUE.MULTI_UNIT_CONFINEMENT,
    'formal multi-unit event missing');
  assert(proof.sourceUnits.length === 2 && proof.targetUnits.length === 2,
    'multi-unit proof must be two source units against two target units');
  assert(proof.sourceUnitKind !== proof.targetUnitKind, 'source and target kinds must differ');
  assert(proof.sourceRemainingQuota.length === 2, 'source quota proof missing');
  assert(proof.targetRemainingQuota.length === 2, 'target quota proof missing');
  assert(proof.sourceCandidates.length > 0, 'source candidate union missing');
  assert(proof.targetExternalCandidates.includes(53), 'external candidate proof missing');
  assert(proof.containmentWitness.length === proof.sourceCandidates.length,
    'containment witness must cover every source candidate');
  assert(proof.capacityEquality.equal === true, 'capacity equality missing');
  assert(proof.capacityEquality.sourceRemainingQuotaTotal
    === proof.capacityEquality.targetRemainingQuotaTotal, 'capacity totals differ');
});

test('pressured-group proof records two bounded cliques and target conflicts', () => {
  const result = collectHumanLogicEvents(formalPuzzle('star-lv-24', false));
  const { event, proof } = proofFor(
    result,
    DEDUCTION_TECHNIQUE.PRESSURED_GROUP_EXCLUSION,
    66,
  );
  assert(event?.technique === DEDUCTION_TECHNIQUE.PRESSURED_GROUP_EXCLUSION,
    'formal pressured-group event missing');
  assert(proof.remainingQuota === 2, 'pressured rule must be quota 2');
  assert(proof.groupA.length <= HUMAN_LOGIC_SEARCH_LIMITS.pressuredGroupSize,
    'group A exceeds bound');
  assert(proof.groupB.length <= HUMAN_LOGIC_SEARCH_LIMITS.pressuredGroupSize,
    'group B exceeds bound');
  assert(proof.candidateSet.length
    === proof.groupA.length + proof.groupB.length, 'cover does not partition candidates');
  assert(proof.groupInternalConflictProof.groupA.length
    === proof.groupA.length * (proof.groupA.length - 1) / 2, 'group A proof incomplete');
  assert(proof.groupInternalConflictProof.groupB.length
    === proof.groupB.length * (proof.groupB.length - 1) / 2, 'group B proof incomplete');
  assert(proof.targetCell === 66, 'target cell missing');
  const targetGroup = proof[proof.targetGroup];
  assert(proof.targetCellConflictProof.length === targetGroup.length,
    'target conflict proof must cover the selected group');
  const forced = result.events.find(event =>
    event.technique === DEDUCTION_TECHNIQUE.PRESSURED_GROUP_EXCLUSION
      && event.action === 'place-star');
  assert(forced?.proof.conclusion === 'forced-singleton-star',
    'singleton forced-group conclusion missing');
  assert(forced.proof.forcedStarCell === forced.affectedCells[0],
    'forced-star witness does not match affected cell');
});

test('new-rule discovery is identical with and without a known solution', () => {
  for (const levelId of ['star-lv-22', 'star-lv-24']) {
    const withoutSolution = collectHumanLogicEvents(formalPuzzle(levelId, false));
    const withSolution = collectHumanLogicEvents(formalPuzzle(levelId, true));
    assert(JSON.stringify(withoutSolution.events) === JSON.stringify(withSolution.events),
      `${levelId} event discovery depends on solution`);
    assert(JSON.stringify(withoutSolution.searchDiagnostics)
      === JSON.stringify(withSolution.searchDiagnostics),
    `${levelId} search depends on solution`);
  }
});

test('new-rule event IDs, canonical proofs and ordering are byte-stable', () => {
  for (const levelId of ['star-lv-22', 'star-lv-24']) {
    const first = collectHumanLogicEvents(formalPuzzle(levelId, false));
    const second = collectHumanLogicEvents(formalPuzzle(levelId, false));
    assert(JSON.stringify(first) === JSON.stringify(second), `${levelId} collection changed`);
  }
});

test('multiple multi-unit proofs retain one stable canonical proof', () => {
  const layout = fixture.regionLayouts.frame5;
  const puzzle = { N: 5, quota: 2, regions: layout.regions };
  const first = collectHumanLogicEvents(puzzle);
  const second = collectHumanLogicEvents(puzzle);
  const { event, proof } = proofFor(first, DEDUCTION_TECHNIQUE.MULTI_UNIT_CONFINEMENT, 6);
  assert(event, 'multi-unit multi-proof event missing');
  assert(proof.alternativeProofCount >= 1, 'expected alternative multi-unit proofs');
  assert(event.proofs.filter(candidate => candidate.type === 'multi-unit-confinement').length === 1,
    'collector should retain one canonical multi-unit proof');
  assert(JSON.stringify(proof)
    === JSON.stringify(proofFor(second, DEDUCTION_TECHNIQUE.MULTI_UNIT_CONFINEMENT, 6).proof),
  'canonical multi-unit proof changed');
});

test('multiple pressured covers retain one stable canonical proof', () => {
  const first = collectHumanLogicEvents(formalPuzzle('star-lv-24', false));
  const second = collectHumanLogicEvents(formalPuzzle('star-lv-24', false));
  const { event, proof } = proofFor(
    first,
    DEDUCTION_TECHNIQUE.PRESSURED_GROUP_EXCLUSION,
    66,
  );
  assert(proof.alternativeProofCount >= 1, 'expected alternative pressured covers');
  assert(event.proofs.filter(candidate => candidate.type === 'pressured-group-exclusion').length === 1,
    'collector should retain one canonical pressured proof');
  assert(JSON.stringify(proof) === JSON.stringify(proofFor(
    second,
    DEDUCTION_TECHNIQUE.PRESSURED_GROUP_EXCLUSION,
    66,
  ).proof), 'canonical pressured proof changed');
});

test('fixed search bounds reject oversized pressured sets and cap multi-unit combinations', () => {
  const rows9 = fixture.regionLayouts.rows9;
  const pressured = collectHumanLogicEvents({ N: 9, quota: 2, regions: rows9.regions });
  assert(pressured.searchDiagnostics.pressuredGroupExclusion.unitsSkippedByCandidateLimit > 0,
    'oversized pressured candidate sets were not bounded');
  assert(!pressured.events.some(event =>
    event.technique === DEDUCTION_TECHNIQUE.PRESSURED_GROUP_EXCLUSION),
  'oversized pressured candidate set produced an event');

  const N = 12;
  const regions = Array.from({ length: N * N }, (_, cell) => Math.floor(cell / N));
  const multi = collectHumanLogicEvents({ N, quota: 2, regions });
  assert(multi.searchDiagnostics.multiUnitConfinement.searchLimitReached === true,
    'multi-unit search did not stop at its fixed limit');
  assert(multi.searchDiagnostics.multiUnitConfinement.evaluatedCombinations
    === HUMAN_LOGIC_SEARCH_LIMITS.multiUnitCombinationPairs,
  'multi-unit search exceeded or stopped before its budget');
});

test('same action on one cell merges duplicate proofs', () => {
  const layout = fixture.regionLayouts.rows4;
  const result = collectHumanLogicEvents({
    N: 4,
    quota: 2,
    regions: layout.regions,
    initialState: { stars: [[0,0],[0,2]] },
  });
  const event = result.events.find(candidate =>
    candidate.action === 'eliminate' && candidate.affectedCells[0] === 1);
  assert(event, 'expected merged elimination event');
  assert(event.proofs.length >= 2, 'expected alternative proofs to be retained');
  assert(new Set(event.affectedCells).size === event.affectedCells.length, 'affected cells duplicated');
});

test('event conflicts are detected before application', () => {
  const item = fixture.eventConflictCases[0];
  const conflicts = detectDeductionEventConflicts(item.events);
  assert(conflicts.length === 1 && conflicts[0].cell === item.expectedCell,
    'conflict not detected');
});

console.log('\n═══ Stage A: contradiction and invalid input ═══');

for (const item of fixture.contradictionCases) {
  test(item.id, () => {
    const analysis = analyzeStarDoubleHumanLogic(puzzleFromCase(item));
    assert(analysis.status === HUMAN_LOGIC_STATUS.CONTRADICTION,
      `expected CONTRADICTION, got ${analysis.status}`);
    assert(analysis.contradictions.some(entry => entry.type === item.expectedType),
      `missing contradiction ${item.expectedType}`);
  });
}

for (const item of fixture.contradictionNegativeCases) {
  test(item.id, () => {
    const result = collectHumanLogicEvents(puzzleFromCase(item));
    assert(result.contradictions.length === 0, 'unexpected STATE_CONTRADICTION');
  });
}

for (const item of fixture.invalidInputCases) {
  test(item.id, () => {
    const puzzle = item.puzzle || puzzleFromCase(item);
    const result = analyzeStarDoubleHumanLogic(puzzle);
    assert(result.status === HUMAN_LOGIC_STATUS.INVALID_INPUT, `got ${result.status}`);
  });
}

test('clean unsupported state reports STALLED, not guessing', () => {
  const layout = fixture.regionLayouts.rows5;
  const result = analyzeStarDoubleHumanLogic({
    N: 5,
    quota: 2,
    regions: layout.regions,
  });
  assert(result.status === HUMAN_LOGIC_STATUS.STALLED_SUPPORTED_RULES, `got ${result.status}`);
  assert(result.reason === 'no-supported-deduction', 'stalled reason must describe analyzer boundary');
});

test('known UNIQUE unsupported state is classified separately', () => {
  const layout = fixture.regionLayouts.rows5;
  const result = analyzeStarDoubleHumanLogic({
    N: 5,
    quota: 2,
    regions: layout.regions,
  }, { solverStatus: 'UNIQUE' });
  assert(result.status === HUMAN_LOGIC_STATUS.UNIQUE_BUT_OUTSIDE_SUPPORTED_RULESET, `got ${result.status}`);
});

test('allowed technique set limits propagation without changing default rules', () => {
  const puzzle = formalPuzzle('star-double-tutorial-01', true);
  const allowedTechniques = [
    DEDUCTION_TECHNIQUE.QUOTA_SATURATED,
    DEDUCTION_TECHNIQUE.ADJACENCY_EXCLUSION,
    DEDUCTION_TECHNIQUE.REMAINING_CAPACITY,
    DEDUCTION_TECHNIQUE.TWO_BY_TWO_CAPACITY,
  ];
  const result = analyzeStarDoubleHumanLogic(
    puzzle,
    { solverStatus: 'UNIQUE', allowedTechniques },
  );
  assert(result.status === HUMAN_LOGIC_STATUS.SOLVED_SUPPORTED_RULES, `got ${result.status}`);
  assert(result.canonicalPath.every(event => allowedTechniques.includes(event.technique)),
    'restricted analysis emitted an untaught technique');
});

console.log('\n═══ Stage A: propagation, determinism and replay ═══');

const propagationLevel = STAR_LINE_LEVELS.find(level => level.id === 'star-lv-26');
const propagationPuzzle = {
  N: propagationLevel.N,
  quota: 2,
  regions: propagationLevel.regions,
  solution: propagationLevel.solution,
  initialState: {
    stars: propagationLevel.solution.slice(0, 3),
  },
};

test('multiple rules propagate across waves', () => {
  const result = analyzeStarDoubleHumanLogic(
    propagationPuzzle,
    { maxWaves: 64, solverStatus: 'UNIQUE' },
  );
  const techniques = new Set(result.canonicalPath.map(event => event.technique));
  assert(techniques.has(DEDUCTION_TECHNIQUE.REMAINING_CAPACITY), 'missing remaining capacity');
  assert(techniques.has(DEDUCTION_TECHNIQUE.ADJACENCY_EXCLUSION), 'missing adjacency propagation');
  assert(techniques.has(DEDUCTION_TECHNIQUE.CONFINED_CAPACITY), 'missing confined propagation');
  assert(result.deductionWaves.length > 2, 'expected multiple deduction waves');
  assert(result.status === HUMAN_LOGIC_STATUS.SOLVED_SUPPORTED_RULES, `got ${result.status}`);
});

test('same-layer legal events are retained as a wave', () => {
  const item = fixture.ruleCases.find(entry => entry.id === 'two-by-two-row-positive');
  const result = analyzeStarDoubleHumanLogic(puzzleFromCase(item), { maxWaves: 1 });
  assert(result.deductionWaves[0]?.events.length > 1, 'expected multiple same-wave events');
});

test('analysis is byte-stable for the same input', () => {
  const first = analyzeStarDoubleHumanLogic(propagationPuzzle, { maxWaves: 64, solverStatus: 'UNIQUE' });
  const second = analyzeStarDoubleHumanLogic(propagationPuzzle, { maxWaves: 64, solverStatus: 'UNIQUE' });
  assert(JSON.stringify(first) === JSON.stringify(second), 'analysis output is not deterministic');
});

test('trace replay reproduces final state and hash', () => {
  const analysis = analyzeStarDoubleHumanLogic(
    propagationPuzzle,
    { maxWaves: 64, solverStatus: 'UNIQUE' },
  );
  const replay = replayHumanLogicTrace(propagationPuzzle, analysis);
  assert(replay.ok, replay.errors.join('; '));
  assert(replay.finalStateHash === analysis.finalStateHash, 'final hash differs');
  assert(JSON.stringify(replay.finalState) === JSON.stringify(analysis.finalState), 'final state differs');
});

test('every deduction remains consistent with the known solution', () => {
  const analysis = analyzeStarDoubleHumanLogic(
    propagationPuzzle,
    { maxWaves: 64, solverStatus: 'UNIQUE' },
  );
  const solution = new Set(propagationPuzzle.solution);
  assert(analysis.solutionConsistencyErrors.length === 0, 'unexpected solution consistency error');
  for (const event of analysis.canonicalPath) {
    for (const cell of event.affectedCells) {
      if (event.action === 'place-star') assert(solution.has(cell), `placed non-solution star ${cell}`);
      if (event.action === 'eliminate') assert(!solution.has(cell), `eliminated solution star ${cell}`);
    }
  }
});

test('formal new-rule traces are safe, deterministic and replayable', () => {
  for (const levelId of ['star-lv-22', 'star-lv-24']) {
    const puzzle = formalPuzzle(levelId, true);
    const first = analyzeStarDoubleHumanLogic(puzzle, { solverStatus: 'UNIQUE' });
    const second = analyzeStarDoubleHumanLogic(puzzle, { solverStatus: 'UNIQUE' });
    const newEvents = first.canonicalPath.filter(event =>
      event.technique === DEDUCTION_TECHNIQUE.MULTI_UNIT_CONFINEMENT
      || event.technique === DEDUCTION_TECHNIQUE.PRESSURED_GROUP_EXCLUSION);
    assert(newEvents.length > 0, `${levelId} did not use a new rule`);
    assert(first.status !== HUMAN_LOGIC_STATUS.CONTRADICTION,
      `${levelId} produced a contradiction`);
    assert(first.solutionConsistencyErrors.length === 0,
      `${levelId} produced an unsafe event`);
    assert(JSON.stringify(first.deductionWaves) === JSON.stringify(second.deductionWaves),
      `${levelId} waves changed`);
    const replay = replayHumanLogicTrace(puzzle, first);
    assert(replay.ok, `${levelId}: ${replay.errors.join('; ')}`);
  }
});

test('full valid state reports SOLVED_SUPPORTED_RULES', () => {
  const N = 8;
  const solution = [1,3,13,15,17,19,29,31,32,34,44,46,48,50,60,62];
  const solutionSet = new Set(solution);
  const regions = [
    0,0,0,1,1,1,1,3,0,0,0,1,1,2,2,3,0,0,0,1,2,2,2,3,4,4,5,1,2,2,3,3,
    4,4,5,5,2,6,7,3,4,4,5,5,6,6,7,7,4,5,5,6,6,6,7,7,4,4,5,6,6,7,7,7,
  ];
  const state = Array.from({ length: N * N }, (_, cell) =>
    solutionSet.has(cell) ? CELL_STATE.STAR : CELL_STATE.X);
  const analysis = analyzeStarDoubleHumanLogic({ N, quota: 2, regions, initialState: state, solution });
  assert(analysis.status === HUMAN_LOGIC_STATUS.SOLVED_SUPPORTED_RULES, `got ${analysis.status}`);
  assert(replayHumanLogicTrace({ N, quota: 2, regions, initialState: state, solution }, analysis).ok,
    'solved trace should replay');
});

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
