import { writeFileSync } from 'node:fs';
import { generateDoubleStarCandidate } from './star-double-generator.mjs';
import { analyzeDoubleStarCandidate } from './star-double-quality.mjs';
import {
  analyzeReasoningDuplicates,
  analyzeStarDoubleSequence,
} from './star-double-reasoning-fingerprint.mjs';
import {
  d4AlignedRegionMetrics,
} from './star-line-candidate-signatures.mjs';
import {
  REGION_MOTIF_LIMITS,
  REGION_MOTIF_TYPE,
  REGION_MOTIF_VERSION,
  generateRegionMotifVariants,
  verifyRegionMotifVariant,
} from './star-double-region-motifs.mjs';

export const D0_7_TRIAL_CONFIG = Object.freeze({
  seed: 20260723,
  maxAttemptsPerCandidate: 500,
  output: '/tmp/star-double-d0-7-paired-trial.json',
  maxSequenceSearchNodes: 50_000,
  strictSizeOrder: Object.freeze([8, 9, 8, 9, 10, 9, 8, 9, 9, 10]),
  sampleIndexes: Object.freeze({
    8: Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]),
    9: Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]),
    10: Object.freeze([0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17]),
  }),
});

function increment(map, key) {
  map[key] = (map[key] || 0) + 1;
}

function percentile(sorted, fraction) {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction));
  return Number(sorted[index].toFixed(4));
}

function distribution(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    min: percentile(sorted, 0),
    p25: percentile(sorted, 0.25),
    median: percentile(sorted, 0.5),
    p75: percentile(sorted, 0.75),
    max: percentile(sorted, 1),
  };
}

function average(values) {
  if (values.length === 0) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4));
}

function countPairMatch(analysis, match) {
  return analysis.pairs.filter(pair => pair.matches.includes(match)).length;
}

function reportEligibleByItself(report) {
  return report.solver?.status === 'unique'
    && report.declaredSolutionMatchesSolver === true
    && report.traceReplay?.ok === true
    && (report.humanLogic?.solutionConsistencyErrors || []).length === 0
    && report.humanLogic?.status === 'SOLVED_SUPPORTED_RULES';
}

function makeGreedySequenceEligiblePool(reports) {
  const accepted = [];
  const rejected = [];
  for (const report of [...reports].sort((a, b) => a.candidateId.localeCompare(b.candidateId))) {
    if (!reportEligibleByItself(report)) continue;
    const duplicate = analyzeReasoningDuplicates([...accepted, report]);
    const involvingCurrent = duplicate.pairs.filter(pair =>
      (pair.a === report.candidateId || pair.b === report.candidateId)
        && pair.decision === 'hard-reject');
    if (involvingCurrent.length > 0) {
      rejected.push({
        candidateId: report.candidateId,
        reasons: [...new Set(involvingCurrent.flatMap(pair => pair.matches))],
      });
      continue;
    }
    accepted.push(report);
  }
  return { accepted, rejected };
}

function searchSequence(reports, config, sizeOrder = null, targetLength = 10) {
  const sorted = [...reports].sort((a, b) =>
    a.N - b.N || a.candidateId.localeCompare(b.candidateId));
  const selected = [];
  const used = new Set();
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
      if (used.has(report.candidateId)) continue;
      nodes++;
      selected.push(report);
      used.add(report.candidateId);
      const duplicate = analyzeReasoningDuplicates(selected);
      const sequence = duplicate.hardRejectPairCount === 0
        ? analyzeStarDoubleSequence(selected)
        : { passed: false, violations: [] };
      if (duplicate.hardRejectPairCount > 0) increment(blockingViolations, 'hard-duplicate');
      for (const violation of sequence.violations || []) increment(blockingViolations, violation.rule);
      if (duplicate.hardRejectPairCount === 0 && sequence.passed && visit()) return true;
      selected.pop();
      used.delete(report.candidateId);
      if (limitReached) return false;
    }
    return false;
  }

  const found = visit();
  return {
    found,
    targetLength,
    nodes,
    searchLimit: config.maxSequenceSearchNodes,
    limitReached,
    candidateIds: found ? selected.map(report => report.candidateId) : [],
    sizeOrder: found ? selected.map(report => report.N) : [],
    maximumLength: found ? targetLength : best.length,
    bestCandidateIds: found ? selected.map(report => report.candidateId)
      : best.map(report => report.candidateId),
    bestSizeOrder: found ? selected.map(report => report.N) : best.map(report => report.N),
    gate: found ? analyzeStarDoubleSequence(selected) : null,
    blockingViolations,
  };
}

function summarizeOriginals(reports) {
  const statuses = {};
  const opening = {};
  const dominant = {};
  for (const report of reports) {
    increment(statuses, report.humanLogic?.status || 'UNKNOWN');
    increment(opening, report.reasoningFingerprint?.experience?.openingTechnique || 'NONE');
    increment(dominant, report.reasoningFingerprint?.experience?.dominantTechnique || 'NONE');
  }
  return {
    sourceCandidates: reports.length,
    uniquePreserved: reports.filter(report => report.solver?.status === 'unique').length,
    eventTriggered: 0,
    propagationGain: 0,
    fullySolved: reports.filter(report =>
      report.humanLogic?.status === 'SOLVED_SUPPORTED_RULES').length,
    sequenceEligible: 0,
    averageCompletionRatio: average(reports.map(report => {
      const state = report.humanLogic?.finalState || [];
      return state.length === 0 ? 0 : state.filter(value => value !== 'U').length / state.length;
    })),
    averageDeductionWaves: average(reports.map(report =>
      report.humanLogic?.deductionWaves?.length || 0)),
    openingTechniqueDistribution: opening,
    dominantTechniqueDistribution: dominant,
    normalizedFingerprintCount: new Set(reports.map(report =>
      report.reasoningFingerprint?.experience?.normalizedFingerprint).filter(Boolean)).size,
    exactSolutionCount: new Set(reports.map(report => report.solutionSignature)).size,
    d4SolutionCount: new Set(reports.map(report => report.canonicalSolutionSignature)).size,
    exactRegionCount: new Set(reports.map(report => report.exactRegionSignature)).size,
    d4RegionCount: new Set(reports.map(report => report.canonicalRegionSignature)).size,
    humanStatusDistribution: statuses,
  };
}

function summarizeVariantGroup(entries, outcomes, sequenceEligibleIds) {
  const reports = entries.map(entry => entry.variant.report);
  const duplicate = analyzeReasoningDuplicates(reports);
  const opening = {};
  const dominant = {};
  for (const report of reports) {
    increment(opening, report.reasoningFingerprint?.experience?.openingTechnique || 'NONE');
    increment(dominant, report.reasoningFingerprint?.experience?.dominantTechnique || 'NONE');
  }
  const geometry = entries.map(entry => d4AlignedRegionMetrics(
    entry.variant.originalRegions,
    entry.variant.mutatedRegions,
    entry.variant.candidate.N,
  ).similarity);
  return {
    sourceCandidates: new Set(outcomes.map(outcome => outcome.candidateId)).size,
    motifSearchSuccessSources: new Set(entries.map(entry => entry.sourceCandidateId)).size,
    generatedVariants: entries.length,
    uniquePreserved: reports.filter(report => report.solver?.status === 'unique').length,
    eventTriggered: entries.filter(entry => entry.variant.eventTriggered).length,
    propagationGain: entries.filter(entry => entry.variant.propagationGain).length,
    fullySolved: entries.filter(entry => entry.variant.fullySolved).length,
    sequenceEligible: entries.filter(entry =>
      sequenceEligibleIds.has(entry.variant.report.candidateId)).length,
    averageCompletionRatioChange: average(entries.map(entry =>
      entry.variant.completionRatioGain)),
    averageDeductionWaveChange: average(entries.map(entry =>
      (entry.variant.report.humanLogic?.deductionWaves?.length || 0)
        - (entry.variant.originalTrace?.deductionWaves?.length || 0))),
    openingTechniqueDistribution: opening,
    dominantTechniqueDistribution: dominant,
    normalizedFingerprintCount: new Set(reports.map(report =>
      report.reasoningFingerprint?.experience?.normalizedFingerprint).filter(Boolean)).size,
    exactSolutionCount: new Set(reports.map(report => report.solutionSignature)).size,
    d4SolutionCount: new Set(reports.map(report => report.canonicalSolutionSignature)).size,
    exactRegionCount: new Set(reports.map(report => report.exactRegionSignature)).size,
    d4RegionCount: new Set(reports.map(report => report.canonicalRegionSignature)).size,
    exactRegionDuplicatePairs: countPairMatch(duplicate, 'exact-region'),
    d4RegionDuplicatePairs: countPairMatch(duplicate, 'd4-region'),
    regionGeometrySimilarityToSource: distribution(geometry),
    changedCellCountDistribution: distribution(entries.map(entry =>
      entry.variant.changedCells.length)),
    bypassedByBasicRule: outcomes.reduce((sum, outcome) =>
      sum + outcome.search.bypassedByBasicRule, 0),
    triggeredThenImmediatelyStalled: entries.filter(entry =>
      entry.variant.eventTriggered && !entry.variant.propagationGain).length,
    solverRejected: outcomes.reduce((sum, outcome) =>
      sum + outcome.search.solverRejected, 0),
    searchBudgetReachedSources: outcomes.filter(outcome =>
      outcome.search.budgetReached).length,
  };
}

function chooseRoute(originalReports, variants, strictSequence, relaxedSequence) {
  const propagation = variants.filter(entry => entry.variant.propagationGain);
  const solved = variants.filter(entry => entry.variant.fullySolved);
  const originalSolved = originalReports.filter(report =>
    report.humanLogic?.status === 'SOLVED_SUPPORTED_RULES').length;
  const solvedSizes = new Set(solved.map(entry => entry.variant.candidate.N));
  const stableMotifEvidence = Object.values(REGION_MOTIF_TYPE).some(type =>
    new Set(variants.filter(entry => entry.motifType === type)
      .map(entry => entry.variant.report.canonicalRegionSignature)).size >= 2);

  if (stableMotifEvidence
      && propagation.length > 0
      && solved.length > originalSolved
      && solvedSizes.size >= 2
      && (strictSequence.found || relaxedSequence.found)) {
    return {
      result: 'B-PASS',
      reason: 'motif 在多个结构中形成持续传播和跨尺寸完整解，并可组成十关序列。',
    };
  }
  if (variants.length > 0 && propagation.length > 0) {
    return {
      result: 'B-PARTIAL',
      reason: 'motif 能稳定制造入口并产生后续传播，但完整解或十关序列仍不足。',
    };
  }
  return {
    result: 'B-FAIL',
    reason: 'motif 基本无法形成持续传播，或只产生孤立排除。',
  };
}

export function runD0_7PairedTrial(config = D0_7_TRIAL_CONFIG) {
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

  const originalReports = candidates.map(candidate => analyzeDoubleStarCandidate(candidate));
  const originalById = new Map(originalReports.map(report => [report.candidateId, report]));
  const outcomes = [];
  const variantEntries = [];
  for (const candidate of candidates) {
    for (const motifType of Object.values(REGION_MOTIF_TYPE)) {
      const outcome = generateRegionMotifVariants(candidate, motifType, {
        originalReport: originalById.get(candidate.candidateId),
      });
      outcomes.push(outcome);
      for (const variant of outcome.variants) {
        const verification = verifyRegionMotifVariant(variant);
        variantEntries.push({
          sourceCandidateId: candidate.candidateId,
          N: candidate.N,
          motifType,
          verification,
          variant,
        });
      }
    }
  }

  const allReports = [
    ...originalReports,
    ...variantEntries.map(entry => entry.variant.report),
  ];
  const eligiblePool = makeGreedySequenceEligiblePool(allReports);
  const sequenceEligibleIds = new Set(eligiblePool.accepted.map(report => report.candidateId));
  for (const entry of variantEntries) {
    entry.variant.sequenceEligible = sequenceEligibleIds.has(entry.variant.report.candidateId);
  }

  const strictSequence = searchSequence(
    eligiblePool.accepted,
    config,
    config.strictSizeOrder,
    10,
  );
  const relaxedSequence = searchSequence(eligiblePool.accepted, config, null, 10);

  const paired = {};
  for (const N of [8, 9, 10]) {
    const originals = originalReports.filter(report => report.N === N);
    paired[N] = {
      original: summarizeOriginals(originals),
    };
    for (const motifType of Object.values(REGION_MOTIF_TYPE)) {
      const groupOutcomes = outcomes.filter(outcome =>
        outcome.motifType === motifType
          && originalById.get(outcome.candidateId)?.N === N);
      const entries = variantEntries.filter(entry =>
        entry.N === N && entry.motifType === motifType);
      paired[N][motifType] =
        summarizeVariantGroup(entries, groupOutcomes, sequenceEligibleIds);
    }
  }

  const eligibleSizeCounts = {};
  const eligibleOpening = {};
  const eligibleDominant = {};
  for (const report of eligiblePool.accepted) {
    increment(eligibleSizeCounts, report.N);
    increment(eligibleOpening,
      report.reasoningFingerprint?.experience?.openingTechnique || 'NONE');
    increment(eligibleDominant,
      report.reasoningFingerprint?.experience?.dominantTechnique || 'NONE');
  }
  const targetCounts = { 8: 3, 9: 5, 10: 2 };
  const missingBySize = Object.fromEntries([8, 9, 10].map(N => [
    N,
    Math.max(0, targetCounts[N] - (eligibleSizeCounts[N] || 0)),
  ]));

  const eightVariants = variantEntries.filter(entry => entry.N === 8);
  const eightReports = eightVariants.map(entry => entry.variant.report);
  const eightExact = new Set(eightReports.map(report => report.solutionSignature));
  const eightD4 = new Set(eightReports.map(report => report.canonicalSolutionSignature));

  const routeConclusion =
    chooseRoute(originalReports, variantEntries, strictSequence, relaxedSequence);
  const result = {
    trialVersion: 'star-double-d0.7-paired-1.0.0',
    motifVersion: REGION_MOTIF_VERSION,
    config,
    motifLimits: REGION_MOTIF_LIMITS,
    input: {
      sourceCandidates: candidates.length,
      bySize: { 8: 16, 9: 16, 10: 16 },
      theoreticalVariantLimit: candidates.length
        * Object.keys(REGION_MOTIF_TYPE).length
        * REGION_MOTIF_LIMITS.maxVariantsPerMotif,
    },
    paired,
    overall: {
      generatedVariants: variantEntries.length,
      verifiedVariants: variantEntries.filter(entry => entry.verification.valid).length,
      eventTriggered: variantEntries.filter(entry => entry.variant.eventTriggered).length,
      propagationGain: variantEntries.filter(entry => entry.variant.propagationGain).length,
      fullySolvedOriginal: originalReports.filter(report =>
        report.humanLogic?.status === 'SOLVED_SUPPORTED_RULES').length,
      fullySolvedVariants: variantEntries.filter(entry => entry.variant.fullySolved).length,
      sequenceEligibleVariants: variantEntries.filter(entry =>
        entry.variant.sequenceEligible).length,
      motifTypeDistribution: Object.fromEntries(Object.values(REGION_MOTIF_TYPE).map(type => [
        type,
        variantEntries.filter(entry => entry.motifType === type).length,
      ])),
    },
    diversity: {
      allVariantNormalizedFingerprints: new Set(variantEntries.map(entry =>
        entry.variant.normalizedReasoningFingerprint).filter(Boolean)).size,
      allVariantExactSolutions: new Set(variantEntries.map(entry =>
        entry.variant.report.solutionSignature)).size,
      allVariantD4Solutions: new Set(variantEntries.map(entry =>
        entry.variant.report.canonicalSolutionSignature)).size,
      allVariantExactRegions: new Set(variantEntries.map(entry =>
        entry.variant.report.exactRegionSignature)).size,
      allVariantD4Regions: new Set(variantEntries.map(entry =>
        entry.variant.report.canonicalRegionSignature)).size,
      duplicateAnalysis: analyzeReasoningDuplicates(
        variantEntries.map(entry => entry.variant.report),
      ),
    },
    eightByEight: {
      variants: eightVariants.length,
      fullySolved: eightVariants.filter(entry => entry.variant.fullySolved).length,
      exactSolutionCount: eightExact.size,
      d4SolutionCount: eightD4.size,
      repeatedExactSolutionOccurrences: Math.max(0, eightReports.length - eightExact.size),
      repeatedD4SolutionOccurrences: Math.max(0, eightReports.length - eightD4.size),
      conclusion: 'motif 只改变 region，不会增加 8×8 answer pattern；同解变体不计为新答案多样性。',
    },
    sequence: {
      sequenceEligiblePoolSize: eligiblePool.accepted.length,
      duplicateRejected: eligiblePool.rejected,
      eligibleSizeCounts,
      missingBySize,
      openingTechniqueDistribution: eligibleOpening,
      dominantTechniqueDistribution: eligibleDominant,
      strictThreeFiveTwo: strictSequence,
      relaxedSizeRatio: relaxedSequence,
    },
    routeConclusion,
    pairedResults: outcomes.map(outcome => ({
      candidateId: outcome.candidateId,
      motifType: outcome.motifType,
      intendedTechnique: outcome.intendedTechnique,
      limits: outcome.limits,
      search: outcome.search,
      variants: outcome.variants,
    })),
  };

  writeFileSync(config.output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return result;
}

function compactSummary(result) {
  return {
    trialVersion: result.trialVersion,
    config: result.config,
    input: result.input,
    paired: result.paired,
    overall: result.overall,
    diversity: {
      allVariantNormalizedFingerprints: result.diversity.allVariantNormalizedFingerprints,
      allVariantExactSolutions: result.diversity.allVariantExactSolutions,
      allVariantD4Solutions: result.diversity.allVariantD4Solutions,
      allVariantExactRegions: result.diversity.allVariantExactRegions,
      allVariantD4Regions: result.diversity.allVariantD4Regions,
      duplicateSummary: {
        hardRejectPairCount: result.diversity.duplicateAnalysis.hardRejectPairCount,
        warningPairCount: result.diversity.duplicateAnalysis.warningPairCount,
        regionGeometrySimilarityDistribution:
          result.diversity.duplicateAnalysis.regionGeometrySimilarityDistribution,
      },
    },
    eightByEight: result.eightByEight,
    sequence: result.sequence,
    routeConclusion: result.routeConclusion,
    output: result.config.output,
  };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(compactSummary(runD0_7PairedTrial()), null, 2));
}
