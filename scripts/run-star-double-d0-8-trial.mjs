import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { generateDoubleStarCandidate } from './star-double-generator.mjs';
import {
  analyzeReasoningDuplicates,
  analyzeStarDoubleSequence,
  makeReasoningFingerprint,
} from './star-double-reasoning-fingerprint.mjs';
import {
  d4AlignedRegionMetrics,
  makeCanonicalRegionSig,
  makeCanonicalSolutionSig,
  makeRegionSig,
  makeSolutionSig,
} from './star-line-candidate-signatures.mjs';
import {
  REGION_OPTIMIZER_CLASSIFICATION,
  REGION_OPTIMIZER_TIERS,
  REGION_OPTIMIZER_VERSION,
  optimizeStarDoubleRegions,
} from './star-double-region-optimizer.mjs';

export const D0_8_TRIAL_CONFIG = Object.freeze({
  seed: 20260723,
  maxAttemptsPerCandidate: 500,
  output: '/tmp/star-double-d0-8-optimizer-trial.json',
  d0_5Baseline: '/tmp/star-double-d0-5-production-trial.json',
  d0_7Baseline: '/tmp/star-double-d0-7-paired-trial.json',
  maxSequenceSearchNodes: 50_000,
  strictSizeOrder: Object.freeze([8, 9, 8, 9, 10, 9, 8, 9, 9, 10]),
  relaxedSizeCounts: Object.freeze({ 8: 3, 9: 5, 10: 2 }),
  sampleIndexes: Object.freeze({
    8: Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]),
    9: Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]),
    10: Object.freeze([0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17]),
  }),
});

function increment(map, key, amount = 1) {
  map[key] = (map[key] || 0) + amount;
}

function average(values) {
  if (values.length === 0) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4));
}

function percentile(sorted, fraction) {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction));
  return Number(sorted[index].toFixed(4));
}

function distribution(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return {
    count: sorted.length,
    min: percentile(sorted, 0),
    p25: percentile(sorted, 0.25),
    median: percentile(sorted, 0.5),
    p75: percentile(sorted, 0.75),
    max: percentile(sorted, 1),
    average: average(sorted),
  };
}

function countPairMatch(analysis, match) {
  return analysis.pairs.filter(pair => pair.matches.includes(match)).length;
}

function resultToReport(result, candidate, optimized = true) {
  const regions = optimized ? result.optimizedRegions : result.originalRegions;
  const analysis = optimized ? result.optimizedAnalysis : result.originalAnalysis;
  const reasoningFingerprint = optimized
    ? result.reasoningFingerprint
    : makeReasoningFingerprint(analysis, candidate.N);
  const suffix = optimized ? 'optimized' : 'original';
  return {
    candidateId: `${candidate.candidateId}-${suffix}`,
    sourceCandidateId: candidate.candidateId,
    N: candidate.N,
    quota: 2,
    regions,
    solutionSignature: makeSolutionSig('starDouble', candidate.N, 2, candidate.solution),
    canonicalSolutionSignature:
      makeCanonicalSolutionSig('starDouble', candidate.N, 2, candidate.solution),
    exactRegionSignature: makeRegionSig('starDouble', candidate.N, 2, regions),
    canonicalRegionSignature: makeCanonicalRegionSig('starDouble', candidate.N, 2, regions),
    solver: { status: result.uniquenessResult?.status === 'UNIQUE' ? 'unique' : 'unknown' },
    declaredSolutionMatchesSolver: result.uniquenessResult?.status === 'UNIQUE',
    humanLogic: analysis,
    traceReplay: { ok: optimized ? result.optimizedSummary?.replayOk : true },
    reasoningFingerprint,
  };
}

function hardDuplicateFree(reports) {
  return analyzeReasoningDuplicates(reports).hardRejectPairCount === 0;
}

function searchSequence(reports, config, sizeOrder = null, targetCounts = null) {
  const sorted = [...reports].sort((a, b) =>
    a.N - b.N
      || (a.reasoningFingerprint?.experience?.normalizedFingerprint || '')
        .localeCompare(b.reasoningFingerprint?.experience?.normalizedFingerprint || '')
      || a.candidateId.localeCompare(b.candidateId));
  const targetLength = sizeOrder?.length
    ?? Object.values(targetCounts || {}).reduce((sum, count) => sum + count, 0);
  const selected = [];
  const used = new Set();
  const sizeCounts = {};
  let nodes = 0;
  let limitReached = false;
  let best = [];
  const blockingViolations = {};

  function visit() {
    if (selected.length > best.length) best = [...selected];
    if (selected.length === targetLength) return true;
    if (nodes >= config.maxSequenceSearchNodes) {
      limitReached = true;
      return false;
    }
    const requiredSize = sizeOrder ? sizeOrder[selected.length] : null;
    for (const report of sorted) {
      if (requiredSize !== null && report.N !== requiredSize) continue;
      if (targetCounts && (sizeCounts[report.N] || 0) >= (targetCounts[report.N] || 0)) {
        continue;
      }
      if (used.has(report.candidateId)) continue;
      nodes++;
      selected.push(report);
      used.add(report.candidateId);
      increment(sizeCounts, report.N);
      const duplicate = analyzeReasoningDuplicates(selected);
      const sequence = duplicate.hardRejectPairCount === 0
        ? analyzeStarDoubleSequence(selected)
        : { passed: false, violations: [] };
      if (duplicate.hardRejectPairCount > 0) increment(blockingViolations, 'hard-duplicate');
      for (const violation of sequence.violations || []) {
        increment(blockingViolations, violation.rule);
      }
      if (duplicate.hardRejectPairCount === 0 && sequence.passed && visit()) return true;
      selected.pop();
      used.delete(report.candidateId);
      sizeCounts[report.N]--;
      if (limitReached) return false;
    }
    return false;
  }

  const found = visit();
  const chosen = found ? selected : best;
  return {
    found,
    targetLength,
    nodes,
    searchLimit: config.maxSequenceSearchNodes,
    limitReached,
    candidateIds: found ? selected.map(report => report.candidateId) : [],
    sizeOrder: found ? selected.map(report => report.N) : [],
    maximumLength: chosen.length,
    bestCandidateIds: chosen.map(report => report.candidateId),
    bestSizeOrder: chosen.map(report => report.N),
    gate: found ? analyzeStarDoubleSequence(selected) : null,
    duplicateGate: found ? analyzeReasoningDuplicates(selected) : null,
    blockingViolations,
  };
}

function verifyFixedCandidates(candidates, config) {
  if (!existsSync(config.d0_5Baseline)) {
    return {
      available: false,
      passed: null,
      source: config.d0_5Baseline,
      reason: 'D0.5 /tmp artifact unavailable; deterministic IDs still come from fixed config.',
    };
  }
  const baseline = JSON.parse(readFileSync(config.d0_5Baseline, 'utf8'));
  const byId = new Map((baseline.candidates || []).map(entry => [entry.candidateId, entry]));
  const mismatches = [];
  for (const candidate of candidates) {
    const expected = byId.get(candidate.candidateId);
    if (!expected) {
      mismatches.push({ candidateId: candidate.candidateId, reason: 'missing-in-d0.5' });
      continue;
    }
    const checks = {
      solutionSignature:
        makeSolutionSig('starDouble', candidate.N, 2, candidate.solution),
      canonicalRegionSignature:
        makeCanonicalRegionSig('starDouble', candidate.N, 2, candidate.regions),
    };
    for (const [field, actual] of Object.entries(checks)) {
      if (expected[field] !== actual) {
        mismatches.push({
          candidateId: candidate.candidateId,
          field,
          expected: expected[field],
          actual,
        });
      }
    }
  }
  return {
    available: true,
    passed: mismatches.length === 0,
    source: config.d0_5Baseline,
    checkedCandidates: candidates.length,
    mismatches,
  };
}

function readD0_7Comparison(config) {
  const documented = {
    sourceCandidates: 48,
    generatedVariants: 50,
    propagationGain: 31,
    fullySolvedVariants: 4,
    sequenceEligibleVariants: 3,
    normalizedFingerprints: 39,
    averageMovedCells: 2.04,
    fullySolvedSizeCoverage: [8],
    route: 'B-PARTIAL',
  };
  if (!existsSync(config.d0_7Baseline)) {
    return {
      source: 'documented-d0.7-baseline',
      available: false,
      ...documented,
    };
  }
  const baseline = JSON.parse(readFileSync(config.d0_7Baseline, 'utf8'));
  const variants = (baseline.pairedResults || [])
    .flatMap(outcome => outcome.variants || []);
  return {
    source: config.d0_7Baseline,
    available: true,
    sourceCandidates: baseline.input?.sourceCandidates ?? documented.sourceCandidates,
    generatedVariants: baseline.overall?.generatedVariants ?? variants.length,
    propagationGain:
      baseline.overall?.propagationGain ?? variants.filter(variant => variant.propagationGain).length,
    fullySolvedVariants:
      baseline.overall?.fullySolvedVariants ?? variants.filter(variant => variant.fullySolved).length,
    sequenceEligibleVariants:
      baseline.overall?.sequenceEligibleVariants
        ?? variants.filter(variant => variant.sequenceEligible).length,
    normalizedFingerprints:
      baseline.diversity?.allVariantNormalizedFingerprints ?? documented.normalizedFingerprints,
    averageMovedCells:
      average(variants.map(variant => variant.changedCells?.length || 0))
        ?? documented.averageMovedCells,
    fullySolvedSizeCoverage: [...new Set(variants
      .filter(variant => variant.fullySolved)
      .map(variant => variant.candidate?.N))]
      .sort((a, b) => a - b),
    route: baseline.routeConclusion?.result ?? documented.route,
  };
}

function summarizeSize(N, entries, sequenceEligibleIds) {
  const phaseDistribution = {};
  const classificationDistribution = {};
  const stopReasons = {};
  const tierEntries = {};
  const openingDistribution = {};
  const dominantDistribution = {};
  for (const entry of entries) {
    increment(phaseDistribution, entry.result.stall.phase);
    increment(classificationDistribution, entry.result.classification);
    increment(stopReasons, entry.result.stopReason);
    for (const tier of entry.result.search.tiers) {
      if (tier.entered) increment(tierEntries, `tier-${tier.tier}`);
    }
    increment(
      openingDistribution,
      entry.result.reasoningFingerprint?.experience?.openingTechnique || 'NONE',
    );
    increment(
      dominantDistribution,
      entry.result.reasoningFingerprint?.experience?.dominantTechnique || 'NONE',
    );
  }
  const reports = entries.map(entry => entry.report);
  const duplicate = analyzeReasoningDuplicates(reports);
  const moved = entries.map(entry => entry.result.movedCells.length);
  const geometry = entries.map(entry => d4AlignedRegionMetrics(
    entry.result.originalRegions,
    entry.result.optimizedRegions,
    N,
  ).similarity);
  const firstStarAppeared = entries.filter(entry =>
    entry.result.optimizedSummary.firstStarAppeared).length;
  const newlySolved = entries.filter(entry =>
    entry.result.optimizedAnalysis.status === 'SOLVED_SUPPORTED_RULES'
      && entry.result.originalAnalysis.status !== 'SOLVED_SUPPORTED_RULES').length;
  return {
    N,
    sourceCandidates: entries.length,
    originalStallPhaseDistribution: phaseDistribution,
    averageMutationZoneSize: average(entries.map(entry => entry.result.zone.cells.length)),
    tierEntryCounts: tierEntries,
    legalStatesEvaluated: entries.reduce((sum, entry) =>
      sum + entry.result.search.legalStatesEvaluated, 0),
    attemptedMutations: entries.reduce((sum, entry) =>
      sum + entry.result.search.attemptedMutations, 0),
    solverCalls: entries.reduce((sum, entry) => sum + entry.result.search.solverCalls, 0),
    analyzerCalls: entries.reduce((sum, entry) => sum + entry.result.search.analyzerCalls, 0),
    runtimeMs: Number(entries.reduce((sum, entry) =>
      sum + entry.result.search.durationMs, 0).toFixed(3)),
    classificationDistribution,
    invalidMutationStates: entries.reduce((sum, entry) =>
      sum + entry.result.search.classificationCounts.INVALID_MUTATION, 0),
    nonUniqueStates: entries.reduce((sum, entry) =>
      sum + entry.result.search.classificationCounts.NON_UNIQUE, 0),
    uniqueNoGainStates: entries.reduce((sum, entry) =>
      sum + entry.result.search.classificationCounts.UNIQUE_NO_GAIN, 0),
    entryGainStates: entries.reduce((sum, entry) =>
      sum + entry.result.search.classificationCounts.ENTRY_GAIN, 0),
    propagationGainStates: entries.reduce((sum, entry) =>
      sum + entry.result.search.classificationCounts.PROPAGATION_GAIN, 0),
    fullySolvedStates: entries.reduce((sum, entry) =>
      sum + entry.result.search.classificationCounts.FULLY_SOLVED, 0),
    retainedPropagationGain: entries.filter(entry =>
      entry.result.classification === REGION_OPTIMIZER_CLASSIFICATION.PROPAGATION_GAIN).length,
    retainedFullySolved: entries.filter(entry =>
      entry.result.optimizedAnalysis.status === 'SOLVED_SUPPORTED_RULES').length,
    newlySolved,
    sequenceEligible: entries.filter(entry => sequenceEligibleIds.has(entry.report.candidateId)).length,
    movedCellCount: distribution(moved),
    completionRatioChange: distribution(entries.map(entry =>
      entry.result.optimizedSummary.completionGain)),
    deductionWaveChange: distribution(entries.map(entry =>
      entry.result.optimizedSummary.waveGain)),
    firstStarAppearedCount: firstStarAppeared,
    firstStarAppearedRatio: entries.length > 0
      ? Number((firstStarAppeared / entries.length).toFixed(4))
      : 0,
    mutationDependentDeductionCount: distribution(entries.map(entry =>
      entry.result.mutationDependence.mutationDependentDeductionCount)),
    immediateStallCount: entries.filter(entry =>
      entry.result.mutationDependence.immediateStall).length,
    normalizedFingerprintCount: new Set(reports.map(report =>
      report.reasoningFingerprint?.experience?.normalizedFingerprint).filter(Boolean)).size,
    exactSolutionCount: new Set(reports.map(report => report.solutionSignature)).size,
    d4SolutionCount: new Set(reports.map(report => report.canonicalSolutionSignature)).size,
    exactRegionCount: new Set(reports.map(report => report.exactRegionSignature)).size,
    d4RegionCount: new Set(reports.map(report => report.canonicalRegionSignature)).size,
    exactRegionDuplicatePairs: countPairMatch(duplicate, 'exact-region'),
    d4RegionDuplicatePairs: countPairMatch(duplicate, 'd4-region'),
    normalizedFingerprintDuplicatePairs:
      countPairMatch(duplicate, 'exact-normalized-reasoning-fingerprint'),
    geometrySimilarityToSource: distribution(geometry),
    openingTechniqueDistribution: openingDistribution,
    dominantTechniqueDistribution: dominantDistribution,
    stopReasonDistribution: stopReasons,
  };
}

function chooseRoute(entries, strictSequence, relaxedSequence) {
  const newlySolved = entries.filter(entry =>
    entry.result.optimizedAnalysis.status === 'SOLVED_SUPPORTED_RULES'
      && entry.result.originalAnalysis.status !== 'SOLVED_SUPPORTED_RULES');
  const solvedReports = entries.filter(entry =>
    entry.result.optimizedAnalysis.status === 'SOLVED_SUPPORTED_RULES');
  const solvedSizes = new Set(solvedReports.map(entry => entry.candidate.N));
  const propagationOrSolved = entries.filter(entry =>
    [
      REGION_OPTIMIZER_CLASSIFICATION.PROPAGATION_GAIN,
      REGION_OPTIMIZER_CLASSIFICATION.FULLY_SOLVED,
    ].includes(entry.result.classification));
  const fingerprints = new Set(solvedReports.map(entry =>
    entry.report.reasoningFingerprint?.experience?.normalizedFingerprint).filter(Boolean));

  if (strictSequence.found
      && solvedReports.length >= 10
      && solvedSizes.size === 3
      && fingerprints.size >= 10) {
    return {
      result: 'OPTIMIZER_PASS',
      reason: '固定预算下可组成通过现有 duplicate 与 sequence 门禁的 3/5/2 十关序列。',
    };
  }
  if (propagationOrSolved.length > 0
      && (
        newlySolved.length > 0
        || entries.some(entry => entry.result.optimizedSummary.completionGain >= 0.2)
        || relaxedSequence.maximumLength > 0
      )) {
    return {
      result: 'OPTIMIZER_PARTIAL',
      reason: '固定预算内存在可复核的传播或完整解增益，但跨尺寸供给或十关序列仍不足。',
    };
  }
  return {
    result: 'OPTIMIZER_FAIL',
    reason: '固定预算内没有形成实质传播/完整解增益，局部 region optimizer 不能改善生产路线。',
  };
}

export function runD0_8OptimizerTrial(config = D0_8_TRIAL_CONFIG) {
  const startedAt = performance.now();
  const candidates = [];
  for (const N of [8, 9, 10]) {
    for (const index of config.sampleIndexes[N]) {
      const candidate = generateDoubleStarCandidate(N, config.seed, index, {
        maxAttempts: config.maxAttemptsPerCandidate,
      });
      if (!candidate) throw new Error(`fixed candidate missing: ${N}x${N} index ${index}`);
      candidates.push(candidate);
    }
  }
  const fixedCandidateVerification = verifyFixedCandidates(candidates, config);
  if (fixedCandidateVerification.passed === false) {
    throw new Error(`fixed candidate verification failed: ${
      JSON.stringify(fixedCandidateVerification.mismatches.slice(0, 3))}`);
  }

  const entries = [];
  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index];
    console.error(
      `[D0.8 ${index + 1}/${candidates.length}] ${candidate.candidateId}`,
    );
    const result = optimizeStarDoubleRegions(candidate);
    const report = resultToReport(result, candidate, true);
    entries.push({ candidate, result, report });
  }

  const solvedReports = entries
    .filter(entry => entry.result.optimizedAnalysis.status === 'SOLVED_SUPPORTED_RULES')
    .map(entry => entry.report);
  const eligible = [];
  const duplicateRejected = [];
  for (const report of [...solvedReports].sort((a, b) => a.candidateId.localeCompare(b.candidateId))) {
    const duplicate = analyzeReasoningDuplicates([...eligible, report]);
    const involvingCurrent = duplicate.pairs.filter(pair =>
      (pair.a === report.candidateId || pair.b === report.candidateId)
        && pair.decision === 'hard-reject');
    if (involvingCurrent.length > 0) {
      duplicateRejected.push({
        candidateId: report.candidateId,
        reasons: [...new Set(involvingCurrent.flatMap(pair => pair.matches))],
      });
    } else {
      eligible.push(report);
    }
  }
  const sequenceEligibleIds = new Set(eligible.map(report => report.candidateId));
  const strictSequence = searchSequence(
    eligible,
    config,
    config.strictSizeOrder,
    null,
  );
  const relaxedSequence = searchSequence(
    eligible,
    config,
    null,
    config.relaxedSizeCounts,
  );

  const bySize = Object.fromEntries([8, 9, 10].map(N => [
    N,
    summarizeSize(
      N,
      entries.filter(entry => entry.candidate.N === N),
      sequenceEligibleIds,
    ),
  ]));
  const reports = entries.map(entry => entry.report);
  const duplicateAnalysis = analyzeReasoningDuplicates(reports);
  const d0_7 = readD0_7Comparison(config);
  const optimizedSolved = entries.filter(entry =>
    entry.result.optimizedAnalysis.status === 'SOLVED_SUPPORTED_RULES');
  const d0_8Metrics = {
    sourceCandidates: entries.length,
    retainedPropagationGain: entries.filter(entry =>
      entry.result.classification === REGION_OPTIMIZER_CLASSIFICATION.PROPAGATION_GAIN).length,
    fullySolvedRetained: optimizedSolved.length,
    newlySolved: optimizedSolved.filter(entry =>
      entry.result.originalAnalysis.status !== 'SOLVED_SUPPORTED_RULES').length,
    sequenceEligible: eligible.length,
    normalizedFingerprints: new Set(reports.map(report =>
      report.reasoningFingerprint?.experience?.normalizedFingerprint).filter(Boolean)).size,
    averageMovedCells: average(entries.map(entry => entry.result.movedCells.length)),
    fullySolvedSizeCoverage: [...new Set(optimizedSolved.map(entry => entry.candidate.N))]
      .sort((a, b) => a - b),
  };
  const routeConclusion = chooseRoute(entries, strictSequence, relaxedSequence);
  const result = {
    trialVersion: 'star-double-d0.8-optimizer-1.0.0',
    optimizerVersion: REGION_OPTIMIZER_VERSION,
    config,
    optimizerTiers: REGION_OPTIMIZER_TIERS,
    input: {
      sourceCandidates: candidates.length,
      bySize: { 8: 16, 9: 16, 10: 16 },
      fixedCandidateVerification,
      generatedOnce: true,
    },
    bySize,
    overall: {
      retainedClassificationDistribution: Object.fromEntries(
        Object.values(REGION_OPTIMIZER_CLASSIFICATION).map(classification => [
          classification,
          entries.filter(entry => entry.result.classification === classification).length,
        ]),
      ),
      originalSolved: entries.filter(entry =>
        entry.result.originalAnalysis.status === 'SOLVED_SUPPORTED_RULES').length,
      optimizedSolved: optimizedSolved.length,
      newlySolved: d0_8Metrics.newlySolved,
      retainedPropagationGain: d0_8Metrics.retainedPropagationGain,
      firstStarAppeared: entries.filter(entry =>
        entry.result.optimizedSummary.firstStarAppeared).length,
      averageCompletionRatioChange: average(entries.map(entry =>
        entry.result.optimizedSummary.completionGain)),
      averageDeductionWaveChange: average(entries.map(entry =>
        entry.result.optimizedSummary.waveGain)),
      averageMovedCells: d0_8Metrics.averageMovedCells,
      maximumMovedCells: Math.max(...entries.map(entry => entry.result.movedCells.length)),
      legalStatesEvaluated: entries.reduce((sum, entry) =>
        sum + entry.result.search.legalStatesEvaluated, 0),
      solverCalls: entries.reduce((sum, entry) =>
        sum + entry.result.search.solverCalls, 0),
      analyzerCalls: entries.reduce((sum, entry) =>
        sum + entry.result.search.analyzerCalls, 0),
      optimizerRuntimeMs: Number(entries.reduce((sum, entry) =>
        sum + entry.result.search.durationMs, 0).toFixed(3)),
      wallClockRuntimeMs: Number((performance.now() - startedAt).toFixed(3)),
    },
    diversity: {
      normalizedFingerprintCount: d0_8Metrics.normalizedFingerprints,
      exactSolutionCount: new Set(reports.map(report => report.solutionSignature)).size,
      d4SolutionCount: new Set(reports.map(report => report.canonicalSolutionSignature)).size,
      exactRegionCount: new Set(reports.map(report => report.exactRegionSignature)).size,
      d4RegionCount: new Set(reports.map(report => report.canonicalRegionSignature)).size,
      exactRegionDuplicatePairs: countPairMatch(duplicateAnalysis, 'exact-region'),
      d4RegionDuplicatePairs: countPairMatch(duplicateAnalysis, 'd4-region'),
      normalizedFingerprintDuplicatePairs:
        countPairMatch(duplicateAnalysis, 'exact-normalized-reasoning-fingerprint'),
      duplicateAnalysis,
      regionGeometrySimilarityToSource: distribution(entries.map(entry =>
        d4AlignedRegionMetrics(
          entry.result.originalRegions,
          entry.result.optimizedRegions,
          entry.candidate.N,
        ).similarity)),
    },
    sequence: {
      solvedPoolSize: solvedReports.length,
      sequenceEligiblePoolSize: eligible.length,
      duplicateRejected,
      eligibleSizeCounts: Object.fromEntries([8, 9, 10].map(N => [
        N,
        eligible.filter(report => report.N === N).length,
      ])),
      strictThreeFiveTwo: strictSequence,
      relaxedThreeFiveTwoRatio: relaxedSequence,
    },
    comparisonWithD0_7: {
      d0_7,
      d0_8: d0_8Metrics,
      deltas: {
        fullySolved: d0_8Metrics.fullySolvedRetained - d0_7.fullySolvedVariants,
        sequenceEligible: eligible.length - d0_7.sequenceEligibleVariants,
        normalizedFingerprints:
          d0_8Metrics.normalizedFingerprints - d0_7.normalizedFingerprints,
        averageMovedCells:
          Number((d0_8Metrics.averageMovedCells - d0_7.averageMovedCells).toFixed(4)),
      },
    },
    routeConclusion,
    results: entries.map(entry => ({
      candidate: {
        candidateId: entry.candidate.candidateId,
        seed: entry.candidate.seed,
        N: entry.candidate.N,
        generatorFamily: entry.candidate.generatorFamily,
        structuralFamily: entry.candidate.structuralFamily,
        solution: entry.candidate.solution,
        originalExactSolutionSignature:
          makeSolutionSig('starDouble', entry.candidate.N, 2, entry.candidate.solution),
        originalD4SolutionSignature:
          makeCanonicalSolutionSig('starDouble', entry.candidate.N, 2, entry.candidate.solution),
        originalExactRegionSignature:
          makeRegionSig('starDouble', entry.candidate.N, 2, entry.candidate.regions),
        originalD4RegionSignature:
          makeCanonicalRegionSig('starDouble', entry.candidate.N, 2, entry.candidate.regions),
      },
      report: entry.report,
      optimizerResult: entry.result,
      sequenceEligible: sequenceEligibleIds.has(entry.report.candidateId),
    })),
  };
  writeFileSync(config.output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return result;
}

function compactSummary(result) {
  return {
    trialVersion: result.trialVersion,
    optimizerVersion: result.optimizerVersion,
    config: result.config,
    input: result.input,
    bySize: result.bySize,
    overall: result.overall,
    diversity: {
      normalizedFingerprintCount: result.diversity.normalizedFingerprintCount,
      exactSolutionCount: result.diversity.exactSolutionCount,
      d4SolutionCount: result.diversity.d4SolutionCount,
      exactRegionCount: result.diversity.exactRegionCount,
      d4RegionCount: result.diversity.d4RegionCount,
      exactRegionDuplicatePairs: result.diversity.exactRegionDuplicatePairs,
      d4RegionDuplicatePairs: result.diversity.d4RegionDuplicatePairs,
      normalizedFingerprintDuplicatePairs:
        result.diversity.normalizedFingerprintDuplicatePairs,
      hardRejectPairCount: result.diversity.duplicateAnalysis.hardRejectPairCount,
      warningPairCount: result.diversity.duplicateAnalysis.warningPairCount,
      regionGeometrySimilarityToSource:
        result.diversity.regionGeometrySimilarityToSource,
    },
    sequence: result.sequence,
    comparisonWithD0_7: result.comparisonWithD0_7,
    routeConclusion: result.routeConclusion,
    output: result.config.output,
  };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(compactSummary(runD0_8OptimizerTrial()), null, 2));
}
