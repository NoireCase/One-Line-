import { readFileSync } from 'node:fs';
import { STAR_DOUBLE_LEVELS } from '../src/game/starLine/starLineProgressV2.js';
import {
  d4AlignedRegionMetrics,
  makeCanonicalRegionSig,
  makeCanonicalSolutionSig,
  makeRegionSig,
  makeSolutionSig,
} from './star-line-candidate-signatures.mjs';
import {
  analyzeStarDoubleCatalogMetrics,
  normalizedReasoningTraceSimilarity,
  STAR_DOUBLE_ADJACENT_SIMILARITY_LIMITS,
} from './star-double-catalog-metrics.mjs';
import { analyzeDoubleStarCandidate } from './star-double-quality.mjs';
import { isQualifiedExpansionResult } from './generate-star-double-expansion-pool.mjs';

export const STAR_DOUBLE_EXPANSION_TARGETS = Object.freeze({ 8: 4, 9: 9, 10: 6 });

function analyzeLevel(level, options = {}) {
  const report = analyzeDoubleStarCandidate({ ...level, candidateId: level.id });
  const metrics = analyzeStarDoubleCatalogMetrics(level, report, options);
  const signatures = {
    exactRegion: makeRegionSig('starDouble', level.N, 2, level.regions),
    d4Region: makeCanonicalRegionSig('starDouble', level.N, 2, level.regions),
    exactSolution: makeSolutionSig('starDouble', level.N, 2, level.solution),
    d4Solution: makeCanonicalSolutionSig('starDouble', level.N, 2, level.solution),
    reasoningFingerprint: report.reasoningFingerprint?.experience?.normalizedFingerprint,
    exactTrace: report.reasoningFingerprint?.exact?.exactTraceHash,
  };
  return { level, report, metrics, signatures, checkpointEntry: options.checkpointEntry || null };
}

function makeSignatureMaps(analyzedLevels) {
  const maps = Object.fromEntries([
    'exactRegion',
    'd4Region',
    'exactSolution',
    'd4Solution',
    'reasoningFingerprint',
    'exactTrace',
  ].map(name => [name, new Map()]));
  for (const analyzed of analyzedLevels) {
    for (const [name, signature] of Object.entries(analyzed.signatures)) {
      if (signature) maps[name].set(signature, analyzed.level.id);
    }
  }
  return maps;
}

function hardDuplicateReasons(candidate, maps) {
  const reasons = [];
  const checks = [
    ['exactRegion', 'exact-region'],
    ['d4Region', 'd4-region'],
    ['reasoningFingerprint', 'normalized-reasoning-fingerprint'],
    ['exactTrace', 'exact-trace'],
  ];
  if (candidate.level.N > 8) {
    checks.push(['exactSolution', 'exact-solution'], ['d4Solution', 'd4-solution']);
  }
  for (const [signatureName, rule] of checks) {
    const owner = maps[signatureName].get(candidate.signatures[signatureName]);
    if (owner) reasons.push({ rule, owner });
  }
  return reasons;
}

function addSignatures(candidate, maps) {
  for (const [name, signature] of Object.entries(candidate.signatures)) {
    if (signature) maps[name].set(signature, candidate.level.id);
  }
}

function maximumSimilarities(candidate, comparisonLevels) {
  const sameSize = comparisonLevels.filter(item => item.level.N === candidate.level.N);
  let region = { score: 0, levelId: null };
  let trace = { score: 0, levelId: null };
  for (const comparison of sameSize) {
    const regionScore = d4AlignedRegionMetrics(
      candidate.level.regions,
      comparison.level.regions,
      candidate.level.N,
    ).similarity;
    const traceScore = normalizedReasoningTraceSimilarity(
      candidate.report.humanLogic,
      comparison.report.humanLogic,
    );
    if (regionScore > region.score) region = { score: regionScore, levelId: comparison.level.id };
    if (traceScore > trace.score) trace = { score: traceScore, levelId: comparison.level.id };
  }
  return { region, trace };
}

function diversityRank(candidate) {
  return Math.max(
    candidate.maximumSimilarities.region.score / STAR_DOUBLE_ADJACENT_SIMILARITY_LIMITS.region,
    candidate.maximumSimilarities.trace.score / STAR_DOUBLE_ADJACENT_SIMILARITY_LIMITS.trace,
  );
}

export function screenStarDoubleExpansion(checkpoint) {
  const existing = STAR_DOUBLE_LEVELS.map((level, index) =>
    analyzeLevel(level, { tutorialNumber: index < 10 ? index + 1 : null }));
  const signatureMaps = makeSignatureMaps(existing);
  const eligible = [];
  const rejected = [];
  const qualifiedEntries = checkpoint.results
    .filter(isQualifiedExpansionResult)
    .sort((first, second) => first.N - second.N || first.index - second.index);

  for (const entry of qualifiedEntries) {
    const level = {
      id: entry.candidateId,
      name: entry.candidateId,
      N: entry.N,
      regions: entry.regions,
      solution: entry.solution,
      starsPerRow: 2,
      starsPerCol: 2,
      starsPerRegion: 2,
      gameId: 'starDouble',
    };
    const candidate = analyzeLevel(level, { checkpointEntry: entry });
    const validationReasons = [];
    if (candidate.report.solver?.status !== 'unique') validationReasons.push({ rule: 'unique' });
    if (!candidate.report.declaredSolutionMatchesSolver) {
      validationReasons.push({ rule: 'declared-solution' });
    }
    if (candidate.report.humanLogic?.status !== 'SOLVED_SUPPORTED_RULES') {
      validationReasons.push({ rule: 'human-logic' });
    }
    if (!candidate.report.traceReplay?.ok) validationReasons.push({ rule: 'trace-replay' });
    const duplicateReasons = hardDuplicateReasons(candidate, signatureMaps);
    const reasons = [...validationReasons, ...duplicateReasons];
    if (reasons.length > 0) {
      rejected.push({ candidate, reasons });
      continue;
    }
    candidate.maximumSimilarities = maximumSimilarities(candidate, existing);
    eligible.push(candidate);
    addSignatures(candidate, signatureMaps);
  }

  const selected = [];
  for (const N of [8, 9, 10]) {
    const sizeCandidates = eligible.filter(candidate => candidate.level.N === N)
      .sort((first, second) =>
        diversityRank(first) - diversityRank(second)
          || first.checkpointEntry.movedCells.length - second.checkpointEntry.movedCells.length
          || first.metrics.difficultyScore - second.metrics.difficultyScore
          || first.checkpointEntry.index - second.checkpointEntry.index);
    selected.push(...sizeCandidates.slice(0, STAR_DOUBLE_EXPANSION_TARGETS[N]));
  }
  return { existing, eligible, rejected, selected };
}

export function serializeExpansionScreening(screening) {
  const summarize = candidate => ({
    N: candidate.level.N,
    index: candidate.checkpointEntry.index,
    candidateId: candidate.level.id,
    difficultyScore: candidate.metrics.difficultyScore,
    reasoningWaves: candidate.metrics.reasoningWaves,
    openingSignature: candidate.metrics.openingSignature,
    openingFamily: candidate.metrics.openingFamily,
    dominantTechnique: candidate.metrics.dominantTechnique,
    keyTechniques: candidate.metrics.keyTechniques,
    reasoningFingerprint: candidate.metrics.reasoningFingerprint,
    exactTraceHash: candidate.metrics.exactTraceHash,
    movedCells: candidate.checkpointEntry.movedCells.length,
    maximumRegionSimilarity: candidate.maximumSimilarities,
    generationSeed: candidate.checkpointEntry.seed,
  });
  return {
    eligible: screening.eligible.map(summarize),
    selected: screening.selected.map(summarize),
    rejected: screening.rejected.map(({ candidate, reasons }) => ({
      N: candidate.level.N,
      index: candidate.checkpointEntry.index,
      candidateId: candidate.level.id,
      reasons,
    })),
    counts: Object.fromEntries([8, 9, 10].map(N => [N, {
      eligible: screening.eligible.filter(candidate => candidate.level.N === N).length,
      selected: screening.selected.filter(candidate => candidate.level.N === N).length,
      target: STAR_DOUBLE_EXPANSION_TARGETS[N],
    }])),
  };
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const checkpointPath = process.argv[2]
    || '/tmp/star-double-60-expansion-checkpoint-20260726.json';
  const checkpoint = JSON.parse(readFileSync(checkpointPath, 'utf8'));
  console.log(JSON.stringify(
    serializeExpansionScreening(screenStarDoubleExpansion(checkpoint)),
    null,
    2,
  ));
}
