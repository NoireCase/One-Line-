import {
  generateDoubleStarCandidate,
} from './star-double-generator.mjs';
import { analyzeDoubleStarCandidate } from './star-double-quality.mjs';
import {
  REGION_MOTIF_LIMITS,
  REGION_MOTIF_TYPE,
  detectRegionMotifWitnesses,
  generateRegionMotifVariants,
  revalidateRegionMotifWithSolver,
  validateRegionMotifCandidate,
  verifyRegionMotifVariant,
} from './star-double-region-motifs.mjs';

let passed = 0;
let failed = 0;
const TEST_FILTER = process.env.STAR_DOUBLE_MOTIF_TEST_FILTER;

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

function orthogonalNeighbors(cell, N) {
  const row = Math.floor(cell / N);
  const col = cell % N;
  return [[-1, 0], [0, -1], [0, 1], [1, 0]]
    .map(([dr, dc]) => [row + dr, col + dc])
    .filter(([nextRow, nextCol]) =>
      nextRow >= 0 && nextRow < N && nextCol >= 0 && nextCol < N)
    .map(([nextRow, nextCol]) => nextRow * N + nextCol);
}

function replayMoves(candidate, variant) {
  const regions = [...candidate.regions];
  for (const move of variant.moves) {
    assert(regions[move.cell] === move.fromRegion, 'move donor does not match state');
    assert(orthogonalNeighbors(move.cell, candidate.N)
      .some(neighbor => regions[neighbor] === move.toRegion),
    'move does not cross a shared region boundary');
    regions[move.cell] = move.toRegion;
  }
  assert(JSON.stringify(regions) === JSON.stringify(variant.mutatedRegions),
    'move replay does not reproduce mutated regions');
}

const source = generateDoubleStarCandidate(8, 20260723, 0, { maxAttempts: 500 });
assert(source, 'fixed motif test source could not be generated');
const sourceSnapshot = JSON.stringify(source);
const originalReport = analyzeDoubleStarCandidate(source);

console.log('\n═══ Region motif structural contract ═══');

test('source candidate is valid and motif search never mutates it', () => {
  const result = validateRegionMotifCandidate(source);
  assert(result.valid, result.errors.join('; '));
  generateRegionMotifVariants(
    source,
    REGION_MOTIF_TYPE.MULTI_UNIT_CONFINEMENT_MOTIF,
    { originalReport },
  );
  assert(JSON.stringify(source) === sourceSnapshot, 'source candidate was mutated');
});

test('structural witness detection is deterministic', () => {
  const first = detectRegionMotifWitnesses(
    source.regions,
    source.N,
    REGION_MOTIF_TYPE.MULTI_UNIT_CONFINEMENT_MOTIF,
  );
  const second = detectRegionMotifWitnesses(
    source.regions,
    source.N,
    REGION_MOTIF_TYPE.MULTI_UNIT_CONFINEMENT_MOTIF,
  );
  assert(JSON.stringify(first) === JSON.stringify(second), 'witness ordering changed');
});

test('invalid disconnected or wrong-quota region layouts are rejected', () => {
  const invalid = {
    ...source,
    regions: [...source.regions],
  };
  invalid.regions[source.solution[0]] = invalid.regions[source.solution[0]] === 0 ? 1 : 0;
  const result = validateRegionMotifCandidate(invalid, source.solution);
  assert(!result.valid, 'invalid motif candidate was accepted');
});

console.log('\n═══ Bounded deterministic search ═══');

const multiResult = generateRegionMotifVariants(
  source,
  REGION_MOTIF_TYPE.MULTI_UNIT_CONFINEMENT_MOTIF,
  { originalReport },
);
const pressuredResult = generateRegionMotifVariants(
  source,
  REGION_MOTIF_TYPE.PRESSURED_GROUP_MOTIF,
  { originalReport },
);

test('multi-unit motif finds a new early intended deduction', () => {
  assert(multiResult.variants.length > 0, 'fixed source produced no multi-unit variant');
  const variant = multiResult.variants[0];
  assert(variant.intendedTechnique === 'MULTI_UNIT_CONFINEMENT', 'wrong intended technique');
  assert(variant.eventTriggered, 'intended event did not trigger');
  assert(variant.intendedEventWave <= 1, 'intended event is too late');
  assert(variant.originalTrace.canonicalPath.every(event =>
    `${event.technique}:${event.action}:${event.affectedCells.join(',')}`
      !== `${variant.intendedTechnique}:eliminate:${variant.intendedEvent.affectedCells[0]}`),
  'the same deduction already existed before mutation');
});

test('pressured motif records isolated events separately from propagation gain', () => {
  assert(pressuredResult.variants.length > 0, 'fixed source produced no pressured variant');
  assert(pressuredResult.variants.some(variant =>
    variant.eventTriggered && !variant.propagationGain),
  'isolated event was incorrectly counted as propagation gain');
});

test('same search input produces byte-stable regions, proof and search counters', () => {
  const repeated = generateRegionMotifVariants(
    source,
    REGION_MOTIF_TYPE.MULTI_UNIT_CONFINEMENT_MOTIF,
    { originalReport },
  );
  const compact = result => ({
    search: result.search,
    variants: result.variants.map(variant => ({
      regions: variant.mutatedRegions,
      changes: variant.changedCells,
      proof: variant.intendedEvent.proof,
      wave: variant.intendedEventWave,
    })),
  });
  assert(JSON.stringify(compact(multiResult)) === JSON.stringify(compact(repeated)),
    'motif search is not deterministic');
});

test('fixed state and solver budgets stop search without expanding limits', () => {
  const limited = generateRegionMotifVariants(
    source,
    REGION_MOTIF_TYPE.MULTI_UNIT_CONFINEMENT_MOTIF,
    {
      originalReport,
      limits: {
        maxStatesExaminedPerMotif: 10,
        maxQueuedStatesPerMotif: 20,
        maxSolverChecksPerMotif: 0,
      },
    },
  );
  assert(limited.variants.length === 0, 'zero solver budget produced a variant');
  assert(limited.search.statesExamined === 10, 'state budget was not enforced');
  assert(limited.search.solverChecks === 0, 'solver budget was bypassed');
  assert(limited.search.budgetReached, 'budget stop was not reported');
});

console.log('\n═══ Variant legality and trace ═══');

for (const [label, result] of [
  ['multi-unit', multiResult],
  ['pressured-group', pressuredResult],
]) {
  test(`${label} variants preserve all mutation boundaries`, () => {
    assert(result.variants.length <= REGION_MOTIF_LIMITS.maxVariantsPerMotif,
      'variant count exceeds per-motif limit');
    for (const variant of result.variants) {
      assert(variant.changedCells.length > 0
        && variant.changedCells.length <= REGION_MOTIF_LIMITS.maxChangedCells,
      'changed-cell limit violated');
      assert(variant.changedCells.every(change => !source.solution.includes(change.cell)),
        'solution star region was moved');
      assert(new Set(variant.mutatedRegions).size === source.N, 'region count changed');
      assert(variant.candidate.motif.type === result.motifType, 'multiple motifs were stacked');
      replayMoves(source, variant);
    }
  });

  test(`${label} variants remain unique with the declared solution`, () => {
    for (const variant of result.variants) {
      const solver = revalidateRegionMotifWithSolver(variant.candidate);
      assert(solver.status === 'UNIQUE', `solver status ${solver.status}`);
      assert(solver.declaredSolutionMatches, 'solver solution changed');
      assert(variant.report.declaredSolutionMatchesSolver, 'quality report solution mismatch');
    }
  });

  test(`${label} variants have safe replayable intended traces`, () => {
    for (const variant of result.variants) {
      const verification = verifyRegionMotifVariant(variant);
      assert(verification.valid, verification.errors.join('; '));
      assert(variant.report.traceReplay.ok, 'trace replay failed');
      assert(variant.report.humanLogic.solutionConsistencyErrors.length === 0,
        'unsafe deduction detected');
      assert(typeof variant.playerProof === 'string' && variant.playerProof.length > 20,
        'player-readable proof missing');
    }
  });
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
