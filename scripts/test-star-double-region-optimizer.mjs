import assert from 'node:assert/strict';
import { generateDoubleStarCandidate } from './star-double-generator.mjs';
import {
  REGION_OPTIMIZER_CLASSIFICATION,
  REGION_OPTIMIZER_TIERS,
  applyOptimizerMove,
  buildStarDoubleMutationZone,
  classifyOptimizerState,
  compareOptimizerObjectives,
  locateStarDoubleStall,
  makeOptimizerObjective,
  makeOptimizerRegionStateSignatures,
  optimizeStarDoubleRegions,
  validateOptimizerMutation,
} from './star-double-region-optimizer.mjs';

let passed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

function rotate90(regions, N) {
  const rotated = new Array(regions.length);
  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      rotated[col * N + (N - 1 - row)] = regions[row * N + col];
    }
  }
  return rotated;
}

const candidate = generateDoubleStarCandidate(8, 20260723, 0, { maxAttempts: 500 });
assert.ok(candidate, 'fixed optimizer fixture candidate should generate');

const stall = locateStarDoubleStall({
  N: candidate.N,
  quota: 2,
  regions: candidate.regions,
  solution: candidate.solution,
});
const zone = buildStarDoubleMutationZone(candidate, stall);

test('stall locator exposes the deterministic first supported-rule stall', () => {
  assert.equal(stall.phase, 'opening');
  assert.equal(stall.stallWave, stall.analysis.deductionWaves.length);
  assert.ok(Array.isArray(stall.mostConstrainedUnits));
  assert.ok(stall.closestRuleStructures.remainingCapacity.length > 0);
});

test('mutation zone is deterministic and independent from solution input', () => {
  const withoutSolution = buildStarDoubleMutationZone({
    N: candidate.N,
    quota: 2,
    regions: candidate.regions,
  }, stall);
  const unrelatedSolution = buildStarDoubleMutationZone({
    N: candidate.N,
    quota: 2,
    regions: candidate.regions,
    solution: candidate.solution.map(cell => (cell + 1) % (candidate.N * candidate.N)),
  }, stall);
  assert.deepEqual(zone.cells, withoutSolution.cells);
  assert.deepEqual(zone.cells, unrelatedSolution.cells);
  assert.ok(zone.cells.length <= 18);
  assert.ok(zone.cells.length < candidate.N * candidate.N);
});

test('atomic move crosses one shared boundary and can replay exactly', () => {
  let valid = null;
  for (const cell of zone.cells) {
    if (candidate.solution.includes(cell)) continue;
    const fromRegion = candidate.regions[cell];
    const toRegion = [
      cell - candidate.N,
      cell - 1,
      cell + 1,
      cell + candidate.N,
    ].filter(neighbor => neighbor >= 0 && neighbor < candidate.regions.length)
      .map(neighbor => candidate.regions[neighbor])
      .find(region => region !== fromRegion);
    if (toRegion === undefined) continue;
    const state = applyOptimizerMove(
      { regions: candidate.regions, history: [] },
      { cell, fromRegion, toRegion },
    );
    const validation = validateOptimizerMutation(
      { ...candidate, regions: state.regions },
      candidate.regions,
      zone.cells,
      state.history,
    );
    if (validation.valid) {
      valid = { state, validation };
      break;
    }
  }
  assert.ok(valid, 'expected at least one legal local boundary move');
  assert.equal(valid.validation.valid, true);
  assert.notDeepEqual(valid.state.regions, candidate.regions);
});

test('moving a declared solution star is rejected', () => {
  const cell = candidate.solution.find(solutionCell => zone.cells.includes(solutionCell));
  assert.notEqual(cell, undefined, 'fixed zone should contain a solution star for this negative case');
  const fromRegion = candidate.regions[cell];
  const neighbor = [
    cell - candidate.N,
    cell - 1,
    cell + 1,
    cell + candidate.N,
  ].find(next => next >= 0
    && next < candidate.regions.length
    && candidate.regions[next] !== fromRegion);
  assert.notEqual(neighbor, undefined);
  const move = { cell, fromRegion, toRegion: candidate.regions[neighbor] };
  const state = applyOptimizerMove({ regions: candidate.regions, history: [] }, move);
  const validation = validateOptimizerMutation(
    { ...candidate, regions: state.regions },
    candidate.regions,
    zone.cells,
    state.history,
  );
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some(error => error.startsWith('solution-star-moved')));
  assert.ok(validation.errors.some(error => error.startsWith('region-solution-quota')
    || error.startsWith('move-breaks-solution-quota')));
});

test('mutation history rejects moves outside the fixed zone', () => {
  const cell = candidate.regions.findIndex((_, index) => !zone.cells.includes(index));
  const state = {
    regions: [...candidate.regions],
    history: [{ cell, fromRegion: candidate.regions[cell], toRegion: candidate.regions[cell] }],
  };
  const validation = validateOptimizerMutation(
    { ...candidate, regions: state.regions },
    candidate.regions,
    zone.cells,
    state.history,
  );
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some(error => error.startsWith('move-outside-zone')));
});

test('exact and D4 region identities are separated for visited-state dedupe', () => {
  const original = makeOptimizerRegionStateSignatures(8, 2, candidate.regions);
  const rotated = makeOptimizerRegionStateSignatures(8, 2, rotate90(candidate.regions, 8));
  assert.notEqual(original.exact, rotated.exact);
  assert.equal(original.d4, rotated.d4);
});

test('tier budgets are the required 4/8/12 and 80/160/240 bounds', () => {
  assert.deepEqual(
    REGION_OPTIMIZER_TIERS.map(tier => [tier.maxMovedCells, tier.maxLegalStates]),
    [[4, 80], [8, 160], [12, 240]],
  );
});

test('lexicographic objective honors solved, phase, progress, moves, then structure', () => {
  const base = {
    status: 'UNIQUE_BUT_OUTSIDE_SUPPORTED_RULESET',
    uniqueSafeReplay: true,
    phaseRank: 1,
    starCount: 0,
    waveCount: 0,
    completionRatio: 0,
    safeDeductionCount: 0,
    independentOpeningCount: 0,
    movedCellCount: 1,
    regionSimilarityToOriginal: 0.99,
  };
  const later = { ...base, phaseRank: 2, movedCellCount: 4, regionSimilarityToOriginal: 0.8 };
  const solved = { ...base, status: 'SOLVED_SUPPORTED_RULES', movedCellCount: 12 };
  assert.equal(compareOptimizerObjectives(later, base), 1);
  assert.equal(compareOptimizerObjectives(solved, later), 1);
  assert.deepEqual(makeOptimizerObjective(base).slice(0, 3), [0, 1, 1]);
});

test('classification distinguishes invalid, non-unique, no gain, entry, propagation, solved', () => {
  const original = { phaseRank: 0 };
  assert.equal(classifyOptimizerState(original, { invalid: true }),
    REGION_OPTIMIZER_CLASSIFICATION.INVALID_MUTATION);
  assert.equal(classifyOptimizerState(original, { invalid: false, uniqueSafeReplay: false }),
    REGION_OPTIMIZER_CLASSIFICATION.NON_UNIQUE);
  const safe = {
    invalid: false,
    uniqueSafeReplay: true,
    status: 'UNIQUE_BUT_OUTSIDE_SUPPORTED_RULESET',
    phaseRank: 0,
    completionGain: 0,
    waveGain: 0,
    eventGain: 0,
    firstStarAppeared: false,
    mutationDependentDeductionCount: 0,
  };
  assert.equal(classifyOptimizerState(original, safe),
    REGION_OPTIMIZER_CLASSIFICATION.UNIQUE_NO_GAIN);
  assert.equal(classifyOptimizerState(original, { ...safe, eventGain: 1 }),
    REGION_OPTIMIZER_CLASSIFICATION.ENTRY_GAIN);
  assert.equal(classifyOptimizerState(original, { ...safe, waveGain: 2 }),
    REGION_OPTIMIZER_CLASSIFICATION.PROPAGATION_GAIN);
  assert.equal(classifyOptimizerState(original, {
    ...safe,
    status: 'SOLVED_SUPPORTED_RULES',
  }), REGION_OPTIMIZER_CLASSIFICATION.FULLY_SOLVED);
});

const limitedOptions = {
  tiers: [{ tier: 1, maxMovedCells: 2, maxLegalStates: 8 }],
  beamWidth: 3,
};
const first = optimizeStarDoubleRegions(candidate, limitedOptions);
const second = optimizeStarDoubleRegions(candidate, limitedOptions);

test('bounded real search is deterministic', () => {
  assert.deepEqual(first.optimizedRegions, second.optimizedRegions);
  assert.deepEqual(first.mutationHistory, second.mutationHistory);
  assert.deepEqual(first.objectiveHistory, second.objectiveHistory);
  assert.equal(first.finalStatus, second.finalStatus);
  assert.equal(first.search.legalStatesEvaluated, 8);
});

test('retained mutation remains connected, quota-safe, unique, and replayable', () => {
  const validation = validateOptimizerMutation(
    { ...candidate, regions: first.optimizedRegions },
    candidate.regions,
    first.zone.cells,
    first.mutationHistory,
  );
  assert.equal(validation.valid, true, validation.errors.join(', '));
  assert.equal(first.uniquenessResult.status, 'UNIQUE');
  assert.equal(first.optimizedSummary.replayOk, true);
  assert.equal(first.optimizedSummary.solutionConsistencyErrorCount, 0);
});

test('result records tier stop reason, objective history, and mutation dependence', () => {
  assert.ok(first.stopReason);
  assert.equal(first.search.tiers.length, 1);
  assert.ok(first.objectiveHistory.length >= 1);
  assert.ok(Number.isInteger(first.mutationDependence.mutationDependentDeductionCount));
  assert.ok(Object.values(REGION_OPTIMIZER_CLASSIFICATION).includes(first.finalStatus));
});

console.log(`\n${passed} Star Double region optimizer tests passed.`);
