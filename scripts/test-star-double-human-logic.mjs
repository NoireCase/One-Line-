import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CELL_STATE,
  DEDUCTION_TECHNIQUE,
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
