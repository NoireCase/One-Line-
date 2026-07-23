import { writeFileSync } from 'node:fs';
import { generateDoubleStarCandidate } from './star-double-generator.mjs';
import {
  analyzeDoubleStarCandidate,
} from './star-double-quality.mjs';
import {
  analyzeReasoningDuplicates,
  analyzeStarDoubleSequence,
} from './star-double-reasoning-fingerprint.mjs';

export const D0_5_TRIAL_CONFIG = Object.freeze({
  seed: 20260723,
  output: '/tmp/star-double-d0-5-production-trial.json',
  maxSearchNodes: 50000,
  sizeOrder: [8, 9, 8, 9, 10, 9, 8, 9, 9, 10],
  sizes: Object.freeze({
    8: Object.freeze({ target: 40, candidateCallLimit: 80, maxAttemptsPerCall: 500 }),
    9: Object.freeze({ target: 50, candidateCallLimit: 100, maxAttemptsPerCall: 500 }),
    10: Object.freeze({ target: 30, candidateCallLimit: 60, maxAttemptsPerCall: 500 }),
  }),
});

function increment(map, key) {
  map[key] = (map[key] || 0) + 1;
}

function summarizeSize(N, generation, reports) {
  const humanStatusDistribution = {};
  const openingDistribution = {};
  const dominantTechniqueDistribution = {};
  for (const report of reports) {
    increment(humanStatusDistribution, report.humanLogic?.status || 'UNKNOWN');
    increment(openingDistribution,
      report.reasoningFingerprint?.experience?.openingTechnique || 'NONE');
    increment(dominantTechniqueDistribution,
      report.reasoningFingerprint?.experience?.dominantTechnique || 'NONE');
  }

  const exactSolutions = new Set(reports.map(report => report.solutionSignature));
  const d4Solutions = new Set(reports.map(report => report.canonicalSolutionSignature));
  const normalizedFingerprints = new Set(reports.map(report =>
    report.reasoningFingerprint?.experience?.normalizedFingerprint).filter(Boolean));
  const solved = reports.filter(report =>
    report.humanLogic?.status === 'SOLVED_SUPPORTED_RULES');
  const stalled = reports.filter(report =>
    report.humanLogic?.status === 'STALLED_SUPPORTED_RULES');
  const uniqueOutside = reports.filter(report =>
    report.humanLogic?.status === 'UNIQUE_BUT_OUTSIDE_SUPPORTED_RULESET');

  let repeatedExactSolutionOccurrences = 0;
  const exactCounts = {};
  for (const report of reports) increment(exactCounts, report.solutionSignature);
  for (const count of Object.values(exactCounts)) {
    if (count > 1) repeatedExactSolutionOccurrences += count - 1;
  }

  return {
    N,
    target: generation.target,
    candidateCalls: generation.candidateCalls,
    candidateCallLimit: generation.candidateCallLimit,
    maxAttemptsPerCall: generation.maxAttemptsPerCall,
    generatorAttempts: generation.generatorAttempts,
    generationFailures: generation.generationFailures,
    uniqueCandidates: reports.filter(report => report.solver?.status === 'unique').length,
    uniquePassRatePerCall: generation.candidateCalls > 0
      ? Number((reports.length / generation.candidateCalls).toFixed(4))
      : 0,
    solvedSupportedRules: solved.length,
    solvedSupportedRulesRate: reports.length > 0
      ? Number((solved.length / reports.length).toFixed(4))
      : 0,
    stalledSupportedRules: stalled.length,
    uniqueOutsideSupportedRuleSet: uniqueOutside.length,
    unsupportedOrStalledRate: reports.length > 0
      ? Number(((stalled.length + uniqueOutside.length) / reports.length).toFixed(4))
      : 0,
    humanStatusDistribution,
    openingDistribution,
    dominantTechniqueDistribution,
    exactSolutionCount: exactSolutions.size,
    d4SolutionCount: d4Solutions.size,
    normalizedReasoningFingerprintCount: normalizedFingerprints.size,
    repeatedExactSolutionOccurrences,
  };
}

function hardDuplicateFree(reports) {
  return analyzeReasoningDuplicates(reports).hardRejectPairCount === 0;
}

function findSequence(reports, config) {
  const eligibleBySize = new Map();
  for (const N of [8, 9, 10]) {
    eligibleBySize.set(N, reports
      .filter(report =>
        report.N === N && report.humanLogic?.status === 'SOLVED_SUPPORTED_RULES')
      .sort((a, b) => {
        const first = a.reasoningFingerprint?.experience?.normalizedFingerprint || '';
        const second = b.reasoningFingerprint?.experience?.normalizedFingerprint || '';
        return first.localeCompare(second) || a.candidateId.localeCompare(b.candidateId);
      }));
  }

  let searchNodes = 0;
  let limitReached = false;
  const selected = [];
  const selectedIds = new Set();

  function search(position) {
    if (position === config.sizeOrder.length) return true;
    if (searchNodes >= config.maxSearchNodes) {
      limitReached = true;
      return false;
    }
    const N = config.sizeOrder[position];
    for (const candidate of eligibleBySize.get(N) || []) {
      searchNodes++;
      if (selectedIds.has(candidate.candidateId)) continue;
      selected.push(candidate);
      selectedIds.add(candidate.candidateId);
      const duplicateFree = hardDuplicateFree(selected);
      const sequenceResult = duplicateFree
        ? analyzeStarDoubleSequence(selected)
        : { passed: false };
      if (duplicateFree && sequenceResult.passed && search(position + 1)) return true;
      selected.pop();
      selectedIds.delete(candidate.candidateId);
      if (limitReached) return false;
    }
    return false;
  }

  const found = search(0);
  const duplicateAnalysis = found ? analyzeReasoningDuplicates(selected) : null;
  return {
    found,
    searchNodes,
    searchLimit: config.maxSearchNodes,
    limitReached,
    sizeOrder: config.sizeOrder,
    candidateIds: found ? selected.map(report => report.candidateId) : [],
    sequenceGate: found ? analyzeStarDoubleSequence(selected) : null,
    manualReviewPairCount: duplicateAnalysis?.warningPairCount ?? null,
  };
}

function chooseRoute(sizeSummaries, sequenceTrial, reports) {
  if (sequenceTrial.found) {
    return {
      route: 'A',
      label: '现有 generator + 人类逻辑筛选足够进入 D1',
      evidence: '固定候选池可组成通过自动序列门禁的 10 关；8x8 warning 仍需人工复核。',
    };
  }

  const targetTotal = Object.values(sizeSummaries).reduce((sum, item) => sum + item.target, 0);
  const uniqueTotal = Object.values(sizeSummaries)
    .reduce((sum, item) => sum + item.uniqueCandidates, 0);
  const solved = reports.filter(report =>
    report.humanLogic?.status === 'SOLVED_SUPPORTED_RULES');
  const solvedFingerprints = new Set(solved.map(report =>
    report.reasoningFingerprint?.experience?.normalizedFingerprint).filter(Boolean));

  if (uniqueTotal < targetTotal * 0.6) {
    return {
      route: 'D',
      label: '需要重构 generator',
      evidence: '固定预算内 UNIQUE 候选产出不足目标的 60%，候选供给本身是首要瓶颈。',
    };
  }
  if (solved.length >= 10 && solvedFingerprints.size < 10) {
    return {
      route: 'C',
      label: '需要人工母题 + 自动变异',
      evidence: '基础规则可解候选数量够，但归一化体验指纹不足以支持 10 个独立体验。',
    };
  }
  return {
    route: 'B',
    label: '需要局部 region fragment / motif',
    evidence: 'UNIQUE 候选供给正常，但基础安全规则可完整求解的候选不足，优先补局部可证明逻辑链。',
  };
}

export function runFixedProductionTrial(config = D0_5_TRIAL_CONFIG) {
  const reports = [];
  const generationBySize = {};

  for (const N of [8, 9, 10]) {
    const sizeConfig = config.sizes[N];
    const generation = {
      target: sizeConfig.target,
      candidateCalls: 0,
      candidateCallLimit: sizeConfig.candidateCallLimit,
      maxAttemptsPerCall: sizeConfig.maxAttemptsPerCall,
      generatorAttempts: 0,
      generationFailures: 0,
    };
    for (let index = 0;
      index < sizeConfig.candidateCallLimit
        && reports.filter(report => report.N === N).length < sizeConfig.target;
      index++) {
      generation.candidateCalls++;
      const candidate = generateDoubleStarCandidate(N, config.seed, index, {
        maxAttempts: sizeConfig.maxAttemptsPerCall,
      });
      if (!candidate) {
        generation.generatorAttempts += sizeConfig.maxAttemptsPerCall;
        generation.generationFailures++;
        continue;
      }
      generation.generatorAttempts += candidate.generationMetadata?.attempts
        ?? sizeConfig.maxAttemptsPerCall;
      reports.push(analyzeDoubleStarCandidate(candidate));
    }
    generationBySize[N] = generation;
  }

  const sizeSummaries = {};
  for (const N of [8, 9, 10]) {
    sizeSummaries[N] = summarizeSize(
      N,
      generationBySize[N],
      reports.filter(report => report.N === N),
    );
  }

  const duplicateAnalysis = analyzeReasoningDuplicates(reports);
  const sequenceTrial = findSequence(reports, config);
  const routeConclusion = chooseRoute(sizeSummaries, sequenceTrial, reports);

  const result = {
    trialVersion: 'star-double-d0.5-fixed-1.0.0',
    config,
    sizes: sizeSummaries,
    duplicateSummary: {
      hardRejectPairCount: duplicateAnalysis.hardRejectPairCount,
      warningPairCount: duplicateAnalysis.warningPairCount,
      regionGeometrySimilarityDistribution:
        duplicateAnalysis.regionGeometrySimilarityDistribution,
    },
    sequenceTrial,
    routeConclusion,
    candidates: reports.map(report => ({
      candidateId: report.candidateId,
      seed: report.seed,
      N: report.N,
      generatorFamily: report.generatorFamily,
      structuralFamily: report.structuralFamily?.family,
      solutionSignature: report.solutionSignature,
      canonicalSolutionSignature: report.canonicalSolutionSignature,
      exactRegionSignature: report.exactRegionSignature,
      canonicalRegionSignature: report.canonicalRegionSignature,
      solverStatus: report.solver?.status,
      humanLogicStatus: report.humanLogic?.status,
      humanLogicSummary: report.humanLogic?.summary,
      exactTraceHash: report.reasoningFingerprint?.exact?.exactTraceHash,
      deductionWaveHash: report.reasoningFingerprint?.exact?.deductionWaveHash,
      reasoningExperience: report.reasoningFingerprint?.experience,
    })),
  };
  writeFileSync(config.output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return result;
}

function printSummary(result) {
  console.log(JSON.stringify({
    config: result.config,
    sizes: result.sizes,
    duplicateSummary: result.duplicateSummary,
    sequenceTrial: result.sequenceTrial,
    routeConclusion: result.routeConclusion,
    output: result.config.output,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  printSummary(runFixedProductionTrial());
}
