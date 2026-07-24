import { DEDUCTION_TECHNIQUE } from './star-double-human-logic.mjs';

export const STAR_DOUBLE_CATALOG_METRICS_VERSION = 'star-double-catalog-metrics-1.1.0';

export const STAR_DOUBLE_ADJACENT_SIMILARITY_LIMITS = Object.freeze({
  // Accepted 41-level baseline, 386 same-size pairs: p95 0.4777;
  // existing adjacent maximum 0.4737.
  region: 0.5,
  // Accepted baseline trace LCS p95 0.7500; adjacent maximum 0.7656.
  trace: 0.78,
});

const CROSS_UNIT_TECHNIQUES = new Set([
  DEDUCTION_TECHNIQUE.CONFINED_CAPACITY,
  DEDUCTION_TECHNIQUE.MULTI_UNIT_CONFINEMENT,
  DEDUCTION_TECHNIQUE.PRESSURED_GROUP_EXCLUSION,
]);

const INFORMATION_WEIGHTS = Object.freeze({
  [DEDUCTION_TECHNIQUE.TWO_BY_TWO_CAPACITY]: 0.15,
  [DEDUCTION_TECHNIQUE.ADJACENCY_EXCLUSION]: 0.6,
  [DEDUCTION_TECHNIQUE.QUOTA_SATURATED]: 0.8,
  [DEDUCTION_TECHNIQUE.REMAINING_CAPACITY]: 0.9,
  [DEDUCTION_TECHNIQUE.CONFINED_CAPACITY]: 1.25,
  [DEDUCTION_TECHNIQUE.MULTI_UNIT_CONFINEMENT]: 1.6,
  [DEDUCTION_TECHNIQUE.PRESSURED_GROUP_EXCLUSION]: 2,
});

// Mechanical 2×2 eliminations occupy most trace events, so the catalog's
// dominant technique uses concentration against the accepted baseline instead
// of raw event count. This keeps the label tied to the puzzle's distinguishing
// reasoning rather than board area.
const TYPICAL_INFORMATION_COUNTS = Object.freeze({
  [DEDUCTION_TECHNIQUE.ADJACENCY_EXCLUSION]: 3,
  [DEDUCTION_TECHNIQUE.QUOTA_SATURATED]: 8,
  [DEDUCTION_TECHNIQUE.REMAINING_CAPACITY]: 9,
  [DEDUCTION_TECHNIQUE.CONFINED_CAPACITY]: 10,
  [DEDUCTION_TECHNIQUE.MULTI_UNIT_CONFINEMENT]: 4,
  [DEDUCTION_TECHNIQUE.PRESSURED_GROUP_EXCLUSION]: 9,
});

const PLAYER_TECHNIQUE_NAMES = Object.freeze({
  [DEDUCTION_TECHNIQUE.TWO_BY_TWO_CAPACITY]: '2×2容量',
  [DEDUCTION_TECHNIQUE.ADJACENCY_EXCLUSION]: '八向不相邻',
  [DEDUCTION_TECHNIQUE.QUOTA_SATURATED]: '配额已满',
  [DEDUCTION_TECHNIQUE.REMAINING_CAPACITY]: '剩余位置收束',
  [DEDUCTION_TECHNIQUE.CONFINED_CAPACITY]: '星域形状限制',
  [DEDUCTION_TECHNIQUE.MULTI_UNIT_CONFINEMENT]: '行列星域联动',
  [DEDUCTION_TECHNIQUE.PRESSURED_GROUP_EXCLUSION]: '共同冲突排除',
  DOUBLE_STAR_RULES: '双星规则',
  PROPAGATION_CHAIN: '连续传播',
  COMBINED_BASICS: '基础逻辑综合',
});

const TUTORIAL_DOMINANT_TECHNIQUES = Object.freeze([
  'DOUBLE_STAR_RULES',
  DEDUCTION_TECHNIQUE.ADJACENCY_EXCLUSION,
  DEDUCTION_TECHNIQUE.QUOTA_SATURATED,
  DEDUCTION_TECHNIQUE.REMAINING_CAPACITY,
  DEDUCTION_TECHNIQUE.REMAINING_CAPACITY,
  DEDUCTION_TECHNIQUE.CONFINED_CAPACITY,
  DEDUCTION_TECHNIQUE.MULTI_UNIT_CONFINEMENT,
  DEDUCTION_TECHNIQUE.PRESSURED_GROUP_EXCLUSION,
  'PROPAGATION_CHAIN',
  'COMBINED_BASICS',
]);

function round(value, digits = 3) {
  return Number(value.toFixed(digits));
}

function depthBand(depth) {
  if (depth === null || depth === undefined || depth < 0) return 'no-star';
  if (depth === 0) return 'opening-star';
  if (depth <= 2) return 'early-star';
  if (depth <= 4) return 'mid-star';
  return 'delayed-star';
}

function openingCountBand(count) {
  if (count <= 2) return 'narrow';
  if (count <= 6) return 'focused';
  if (count <= 12) return 'broad';
  if (count <= 22) return 'wide';
  return 'expansive';
}

function openingLocationBand(location, boardSize) {
  const cells = Array.isArray(location)
    ? location
    : String(location ?? '').split(',').filter(Boolean).map(Number);
  if (cells.length === 0) return 'none';
  const rows = cells.map(cell => Math.floor(cell / boardSize));
  const cols = cells.map(cell => cell % boardSize);
  const centerRow = rows.reduce((sum, row) => sum + row, 0) / rows.length / (boardSize - 1);
  const centerCol = cols.reduce((sum, col) => sum + col, 0) / cols.length / (boardSize - 1);
  const edgeDistance = Math.min(centerRow, 1 - centerRow, centerCol, 1 - centerCol);
  const zone = edgeDistance <= 0.2 ? 'edge' : edgeDistance <= 0.34 ? 'inner' : 'center';
  const rowSpan = Math.max(...rows) - Math.min(...rows);
  const colSpan = Math.max(...cols) - Math.min(...cols);
  const normalizedSpan = (rowSpan + colSpan) / (2 * (boardSize - 1));
  const spread = normalizedSpan <= 0.28
    ? 'compact'
    : normalizedSpan <= 0.58 ? 'mixed' : 'spread';
  return `${zone}-${spread}`;
}

function longestDependencyChain(canonicalPath) {
  const eventById = new Map(canonicalPath.map(event => [event.id, event]));
  const memo = new Map();
  const visiting = new Set();
  function visit(event) {
    if (memo.has(event.id)) return memo.get(event.id);
    if (visiting.has(event.id)) throw new Error('deduction dependency cycle: ' + event.id);
    visiting.add(event.id);
    const prerequisiteDepth = Math.max(0, ...(event.prerequisiteEvents || []).map(eventId => {
      const prerequisite = eventById.get(eventId);
      return prerequisite ? visit(prerequisite) : 0;
    }));
    visiting.delete(event.id);
    const depth = prerequisiteDepth + 1;
    memo.set(event.id, depth);
    return depth;
  }
  return canonicalPath.length > 0 ? Math.max(...canonicalPath.map(visit)) : 0;
}

function techniqueCounts(canonicalPath) {
  const counts = {};
  for (const event of canonicalPath) {
    counts[event.technique] = (counts[event.technique] || 0) + 1;
  }
  return counts;
}

function weightedDominantTechnique(counts) {
  return Object.keys(TYPICAL_INFORMATION_COUNTS)
    .filter(technique => counts[technique] > 0)
    .sort((first, second) => {
    const difference = (counts[second] / TYPICAL_INFORMATION_COUNTS[second])
      - (counts[first] / TYPICAL_INFORMATION_COUNTS[first]);
    return difference || second.localeCompare(first);
  })[0] || 'NONE';
}

function scoreCatalogDifficulty(evidence, boardSize) {
  const sizeBase = { 8: 94, 9: 101, 10: 109 }[boardSize];
  if (!sizeBase) throw new Error('unsupported Star Double board size: ' + boardSize);
  return round(sizeBase
    + evidence.reasoningWaves * 1.7
    + Math.max(0, evidence.firstStarDepth) * 0.7
    + (1 - evidence.forcedMoveRatio) * 4
    + evidence.longestPropagationChain * 0.25
    + evidence.crossUnitReasoningCount * 0.12
    + evidence.techniqueTransitionCount * 0.8
    - Math.min(16, evidence.openingDirectConclusionCount) * 0.12
    - evidence.finishingTailProportion * 3, 1);
}

export function normalizedReasoningTraceSimilarity(firstAnalysis, secondAnalysis) {
  const first = (firstAnalysis?.canonicalPath || []).map(event => event.technique + ':' + event.action);
  const second = (secondAnalysis?.canonicalPath || []).map(event => event.technique + ':' + event.action);
  if (first.length === 0 && second.length === 0) return 1;
  if (first.length === 0 || second.length === 0) return 0;
  let previous = new Uint16Array(second.length + 1);
  for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
    const current = new Uint16Array(second.length + 1);
    for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
      current[secondIndex] = first[firstIndex - 1] === second[secondIndex - 1]
        ? previous[secondIndex - 1] + 1
        : Math.max(previous[secondIndex], current[secondIndex - 1]);
    }
    previous = current;
  }
  return round(previous[second.length] / Math.max(first.length, second.length));
}

export function analyzeStarDoubleCatalogMetrics(level, report, options = {}) {
  const analysis = report?.humanLogic;
  const fingerprint = report?.reasoningFingerprint;
  const experience = fingerprint?.experience;
  if (!analysis || !experience) {
    throw new Error('missing human-logic report for ' + (level?.id || 'unknown-level'));
  }
  const canonicalPath = analysis.canonicalPath || [];
  const waves = analysis.deductionWaves || [];
  const counts = techniqueCounts(canonicalPath);
  const starWaves = waves.filter(wave =>
    (wave.events || []).some(event => event.action === 'place-star')).length;
  const firstWaveEventCount = (waves.find(wave => (wave.events || []).length > 0)?.events || []).length;
  const tutorialNumber = options.tutorialNumber ?? null;
  const dominantTechnique = tutorialNumber
    ? TUTORIAL_DOMINANT_TECHNIQUES[tutorialNumber - 1]
    : weightedDominantTechnique(counts);
  const evidence = {
    humanTraceLength: canonicalPath.length,
    reasoningWaves: waves.length,
    firstStarDepth: experience.firstStarDepth ?? -1,
    forcedMoveRatio: waves.length > 0 ? round(starWaves / waves.length) : 0,
    longestPropagationChain: longestDependencyChain(canonicalPath),
    crossUnitReasoningCount: canonicalPath.filter(event => CROSS_UNIT_TECHNIQUES.has(event.technique)).length,
    techniqueTransitionCount: experience.techniqueTransitionCount,
    openingDirectConclusionCount: firstWaveEventCount,
    finishingTailProportion: experience.finishingTailProportion,
  };
  const openingSignature = [
    experience.openingTechnique,
    experience.openingD4CanonicalLocation,
    experience.firstStarDepth,
  ].join('|');
  const openingFamily = [
    experience.openingTechnique,
    depthBand(experience.firstStarDepth),
    openingCountBand(firstWaveEventCount),
    openingLocationBand(experience.openingD4CanonicalLocation, level.N),
  ].join('|');
  return {
    version: STAR_DOUBLE_CATALOG_METRICS_VERSION,
    ...evidence,
    difficultyScore: scoreCatalogDifficulty(evidence, level.N),
    openingSignature,
    openingFamily,
    legacyOpeningFamily: report.openingAnalysis?.openingFamily || null,
    rawEventDominantTechnique: experience.dominantTechnique,
    dominantTechnique,
    dominantTechniquePlayerName: PLAYER_TECHNIQUE_NAMES[dominantTechnique] || dominantTechnique,
    actualTechniqueCounts: counts,
    keyTechniques: Object.keys(counts).sort((first, second) =>
      (counts[second] * (INFORMATION_WEIGHTS[second] ?? 1))
        - (counts[first] * (INFORMATION_WEIGHTS[first] ?? 1))
        || second.localeCompare(first)).slice(0, 4),
    reasoningFingerprint: experience.normalizedFingerprint,
    exactTraceHash: fingerprint.exact?.exactTraceHash || null,
  };
}
