import {
  analyzeReasoningDuplicates,
  analyzeStarDoubleSequence,
  makeReasoningFingerprint,
} from './star-double-reasoning-fingerprint.mjs';

let passed = 0;
let failed = 0;

function assert(condition, message = 'assertion failed') {
  if (!condition) throw new Error(message);
}

function test(name, fn) {
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

function event(id, technique, action, cell, depth = 0) {
  return {
    id,
    ruleSetVersion: 'test-rules',
    technique,
    supportingTechniques: [technique],
    action,
    affectedCells: [cell],
    sourceUnits: ['row:0'],
    witnessCells: [cell],
    prerequisiteEvents: [],
    propagationDepth: depth,
    proof: { type: technique.toLowerCase(), cell },
    proofs: [{ type: technique.toLowerCase(), cell }],
    inputStateHash: `input-${depth}`,
  };
}

function analysis(waves, status = 'SOLVED_SUPPORTED_RULES') {
  return {
    ruleSetVersion: 'test-rules',
    status,
    canonicalPath: waves.flatMap(wave => wave.events),
    deductionWaves: waves,
  };
}

function wave(index, events) {
  return {
    index,
    inputStateHash: `input-${index}`,
    events,
    outputStateHash: `output-${index}`,
  };
}

console.log('\n═══ Reasoning fingerprint ═══');

test('exact trace and wave hashes are deterministic', () => {
  const input = analysis([
    wave(0, [
      event('d00001', 'CONFINED_CAPACITY', 'eliminate', 0),
      event('d00002', 'TWO_BY_TWO_CAPACITY', 'eliminate', 3),
    ]),
    wave(1, [event('d00003', 'REMAINING_CAPACITY', 'place-star', 5, 1)]),
  ]);
  const first = makeReasoningFingerprint(input, 4);
  const second = makeReasoningFingerprint(input, 4);
  assert(first.exact.exactTraceHash === second.exact.exactTraceHash, 'trace hash changed');
  assert(first.exact.deductionWaveHash === second.exact.deductionWaveHash, 'wave hash changed');
});

test('same-wave order and event IDs do not change experience fingerprint', () => {
  const first = analysis([
    wave(0, [
      event('d00001', 'CONFINED_CAPACITY', 'eliminate', 0),
      event('d00002', 'TWO_BY_TWO_CAPACITY', 'eliminate', 3),
    ]),
  ], 'UNIQUE_BUT_OUTSIDE_SUPPORTED_RULESET');
  const second = analysis([
    wave(0, [
      event('other-99', 'TWO_BY_TWO_CAPACITY', 'eliminate', 3),
      event('other-12', 'CONFINED_CAPACITY', 'eliminate', 0),
    ]),
  ], 'UNIQUE_BUT_OUTSIDE_SUPPORTED_RULESET');
  const a = makeReasoningFingerprint(first, 4);
  const b = makeReasoningFingerprint(second, 4);
  assert(a.experience.normalizedFingerprint === b.experience.normalizedFingerprint,
    'experience fingerprint depends on event order/ID');
  assert(a.exact.exactTraceHash !== b.exact.exactTraceHash,
    'debug trace should preserve exact differences');
});

test('absolute and D4 opening locations remain distinct fields', () => {
  const topLeft = makeReasoningFingerprint(
    analysis([wave(0, [event('a', 'CONFINED_CAPACITY', 'eliminate', 0)])]),
    4,
  );
  const topRight = makeReasoningFingerprint(
    analysis([wave(0, [event('b', 'CONFINED_CAPACITY', 'eliminate', 3)])]),
    4,
  );
  assert(topLeft.experience.openingAbsoluteLocation
    !== topRight.experience.openingAbsoluteLocation, 'absolute locations collapsed');
  assert(topLeft.experience.openingD4CanonicalLocation
    === topRight.experience.openingD4CanonicalLocation, 'D4 locations should match');
});

test('experience fields include depth, transitions, ratio and tail', () => {
  const result = makeReasoningFingerprint(analysis([
    wave(0, [event('a', 'CONFINED_CAPACITY', 'eliminate', 0)]),
    wave(1, [event('b', 'REMAINING_CAPACITY', 'place-star', 5, 1)]),
    wave(2, [event('c', 'QUOTA_SATURATED', 'eliminate', 6, 2)]),
  ]), 4);
  const experience = result.experience;
  assert(experience.deductionsBeforeFirstStar === 1, 'wrong deductionsBeforeFirstStar');
  assert(experience.firstStarDepth === 1, 'wrong firstStarDepth');
  assert(experience.techniqueTransitionCount === 2, 'wrong transition count');
  assert(experience.maximumPropagationDepth === 2, 'wrong maximum depth');
  assert(experience.eliminationToStarRatio === 2, 'wrong elimination ratio');
  assert(typeof experience.finishingTailProportion === 'number', 'missing finishing tail');
});

console.log('\n═══ Duplicate policy ═══');

function report(id, N, overrides = {}) {
  return {
    candidateId: id,
    N,
    solutionSignature: `${N}:solution:${id}`,
    canonicalSolutionSignature: `${N}:d4:${id}`,
    exactRegionSignature: `${N}:region:${id}`,
    canonicalRegionSignature: `${N}:d4region:${id}`,
    regions: N === 4 ? [0,0,1,1,0,0,1,1,2,2,3,3,2,2,3,3] : null,
    reasoningFingerprint: {
      exact: { exactTraceHash: `trace-${id}` },
      experience: {
        normalizedFingerprint: `fp-${id}`,
        openingTechnique: 'CONFINED_CAPACITY',
        openingAbsoluteLocation: 'TL',
        firstStarDepth: 1,
        dominantTechnique: 'CONFINED_CAPACITY',
      },
    },
    humanLogic: { status: 'SOLVED_SUPPORTED_RULES' },
    ...overrides,
  };
}

test('exact normalized reasoning fingerprint is a hard reject', () => {
  const first = report('a', 9);
  const second = report('b', 9, {
    reasoningFingerprint: {
      exact: { exactTraceHash: 'different-trace' },
      experience: {
        ...first.reasoningFingerprint.experience,
        normalizedFingerprint: 'fp-a',
      },
    },
  });
  const result = analyzeReasoningDuplicates([first, second]);
  assert(result.pairs.some(pair =>
    pair.decision === 'hard-reject'
      && pair.matches.includes('exact-normalized-reasoning-fingerprint')),
  'normalized fingerprint did not reject');
});

test('9x9 exact/D4 solution duplicates reject; 8x8 warns', () => {
  const nineA = report('9a', 9);
  const nineB = report('9b', 9, {
    solutionSignature: nineA.solutionSignature,
    canonicalSolutionSignature: nineA.canonicalSolutionSignature,
  });
  const eightA = report('8a', 8);
  const eightB = report('8b', 8, {
    solutionSignature: eightA.solutionSignature,
    canonicalSolutionSignature: eightA.canonicalSolutionSignature,
  });
  const result = analyzeReasoningDuplicates([nineA, nineB, eightA, eightB]);
  const ninePair = result.pairs.find(pair => pair.a === '9a' && pair.b === '9b');
  const eightPair = result.pairs.find(pair => pair.a === '8a' && pair.b === '8b');
  assert(ninePair.decision === 'hard-reject', '9x9 duplicate did not reject');
  assert(eightPair.decision === 'warning-manual-review', '8x8 duplicate did not warn');
});

test('region similarity is reported as a distribution, not a permanent threshold', () => {
  const first = report('a', 4);
  const second = report('b', 4);
  const result = analyzeReasoningDuplicates([first, second]);
  assert(result.regionGeometrySimilarityDistribution.count === 1, 'missing similarity sample');
  assert(result.regionGeometrySimilarityDistribution.max === 1, 'unexpected identical geometry score');
});

console.log('\n═══ Sequence gates ═══');

test('sequence catches adjacent opening, long runs and 4-level concentration', () => {
  const reports = Array.from({ length: 4 }, (_, index) => report(`s${index}`, 9));
  const result = analyzeStarDoubleSequence(reports);
  const rules = new Set(result.violations.map(item => item.rule));
  assert(rules.has('adjacent-opening-fingerprint'), 'missing adjacent opening gate');
  assert(rules.has('dominant-technique-run'), 'missing dominant run gate');
  assert(rules.has('board-size-run'), 'missing size run gate');
  assert(rules.has('four-level-experience-diversity'), 'missing four-level diversity gate');
});

test('8x8 repeated solution enforces count, spacing and experience difference', () => {
  const first = report('a', 8);
  const second = report('b', 9);
  const third = report('c', 8, {
    solutionSignature: first.solutionSignature,
    canonicalSolutionSignature: first.canonicalSolutionSignature,
    reasoningFingerprint: first.reasoningFingerprint,
  });
  const result = analyzeStarDoubleSequence([first, second, third]);
  const rules = new Set(result.violations.map(item => item.rule));
  assert(rules.has('8x8-solution-spacing'), 'missing 8x8 spacing gate');
  assert(rules.has('8x8-normalized-reasoning-repeat'), 'missing 8x8 fingerprint gate');
  assert(rules.has('8x8-experience-difference'), 'missing 8x8 experience gate');
});

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
