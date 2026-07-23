import { createHash } from 'node:crypto';
import {
  d4AlignedRegionMetrics,
  d4Transforms,
} from './star-line-candidate-signatures.mjs';

export const REASONING_FINGERPRINT_VERSION = 'star-double-reasoning-1.0.0';

const TECHNIQUE_PRIORITY = Object.freeze({
  QUOTA_SATURATED: 10,
  ADJACENCY_EXCLUSION: 20,
  REMAINING_CAPACITY: 30,
  CONFINED_CAPACITY: 40,
  TWO_BY_TWO_CAPACITY: 50,
  NONE: 99,
});

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sortTechniques(techniques) {
  return [...techniques].sort((a, b) =>
    (TECHNIQUE_PRIORITY[a] ?? 90) - (TECHNIQUE_PRIORITY[b] ?? 90)
      || a.localeCompare(b));
}

function waveTechniqueProfile(wave) {
  const counts = {};
  for (const event of wave.events || []) {
    counts[event.technique] = (counts[event.technique] || 0) + 1;
  }
  return sortTechniques(Object.keys(counts)).map(technique => `${technique}:${counts[technique]}`);
}

function dominantTechnique(events) {
  const counts = {};
  for (const event of events) counts[event.technique] = (counts[event.technique] || 0) + 1;
  const techniques = sortTechniques(Object.keys(counts));
  techniques.sort((a, b) =>
    counts[b] - counts[a]
      || (TECHNIQUE_PRIORITY[a] ?? 90) - (TECHNIQUE_PRIORITY[b] ?? 90)
      || a.localeCompare(b));
  return techniques[0] || 'NONE';
}

function absoluteLocation(cells, N) {
  if (!cells || cells.length === 0) return 'NONE';
  const labels = new Set();
  for (const cell of cells) {
    const rowBand = Math.min(2, Math.floor((Math.floor(cell / N) * 3) / N));
    const colBand = Math.min(2, Math.floor(((cell % N) * 3) / N));
    labels.add([
      ['TL', 'TC', 'TR'],
      ['ML', 'MC', 'MR'],
      ['BL', 'BC', 'BR'],
    ][rowBand][colBand]);
  }
  return [...labels].sort().join('+');
}

function d4CanonicalCells(cells, N) {
  if (!cells || cells.length === 0) return [];
  const cellSet = new Set(cells);
  let best = null;
  for (const map of d4Transforms(N)) {
    const transformed = [];
    for (let outputCell = 0; outputCell < map.length; outputCell++) {
      if (cellSet.has(map[outputCell])) transformed.push(outputCell);
    }
    const signature = transformed.join(',');
    if (best === null || signature < best.signature) best = { signature, cells: transformed };
  }
  return best?.cells || [];
}

function connectedComponents(cells, N) {
  const remaining = new Set(cells);
  let count = 0;
  while (remaining.size > 0) {
    count++;
    const first = remaining.values().next().value;
    remaining.delete(first);
    const queue = [first];
    while (queue.length > 0) {
      const cell = queue.shift();
      const row = Math.floor(cell / N);
      const col = cell % N;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = row + dr;
          const nc = col + dc;
          if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
          const neighbor = nr * N + nc;
          if (remaining.delete(neighbor)) queue.push(neighbor);
        }
      }
    }
  }
  return count;
}

function makeExactEvent(event) {
  return {
    id: event.id,
    ruleSetVersion: event.ruleSetVersion,
    technique: event.technique,
    supportingTechniques: event.supportingTechniques,
    action: event.action,
    affectedCells: event.affectedCells,
    sourceUnits: event.sourceUnits,
    witnessCells: event.witnessCells,
    prerequisiteEvents: event.prerequisiteEvents,
    propagationDepth: event.propagationDepth,
    proof: event.proof,
    proofs: event.proofs,
    inputStateHash: event.inputStateHash,
  };
}

export function makeReasoningFingerprint(analysis, N) {
  const waves = analysis.deductionWaves || [];
  const path = analysis.canonicalPath || [];
  const exactCanonicalPath = path.map(makeExactEvent);
  const exactWaves = waves.map(wave => ({
    index: wave.index,
    inputStateHash: wave.inputStateHash,
    events: (wave.events || []).map(makeExactEvent),
    outputStateHash: wave.outputStateHash,
  }));
  const exact = {
    fingerprintVersion: REASONING_FINGERPRINT_VERSION,
    ruleSetVersion: analysis.ruleSetVersion,
    canonicalPath: exactCanonicalPath,
    exactTraceHash: sha256(stableJson(exactCanonicalPath)),
    deductionWaveHash: sha256(stableJson(exactWaves)),
  };

  const firstWaveWithEvents = waves.find(wave => (wave.events || []).length > 0) || null;
  const firstWaveEvents = firstWaveWithEvents?.events || [];
  const openingCells = [...new Set(firstWaveEvents.flatMap(event => event.affectedCells || []))]
    .sort((a, b) => a - b);
  const firstStarWaveIndex = waves.findIndex(wave =>
    (wave.events || []).some(event => event.action === 'place-star'));
  let deductionsBeforeFirstStar = 0;
  if (firstStarWaveIndex >= 0) {
    for (let index = 0; index < firstStarWaveIndex; index++) {
      deductionsBeforeFirstStar += (waves[index].events || []).length;
    }
  } else {
    deductionsBeforeFirstStar = path.length;
  }

  const techniqueSequence = waves.map(wave => waveTechniqueProfile(wave));
  const waveDominants = waves.map(wave => dominantTechnique(wave.events || []));
  let techniqueTransitionCount = 0;
  for (let index = 1; index < waveDominants.length; index++) {
    if (waveDominants[index] !== waveDominants[index - 1]) techniqueTransitionCount++;
  }

  const eliminationCount = path.filter(event => event.action === 'eliminate').length;
  const starCount = path.filter(event => event.action === 'place-star').length;
  let finishingTailProportion = 0;
  if (path.length > 0 && starCount > 0) {
    const target = Math.ceil(starCount * 0.8);
    let cumulativeStars = 0;
    let tailStartWave = waves.length - 1;
    for (let index = 0; index < waves.length; index++) {
      cumulativeStars += (waves[index].events || []).filter(event => event.action === 'place-star').length;
      if (cumulativeStars >= target) {
        tailStartWave = index;
        break;
      }
    }
    const tailEvents = waves.slice(tailStartWave)
      .reduce((total, wave) => total + (wave.events || []).length, 0);
    finishingTailProportion = Number((tailEvents / path.length).toFixed(3));
  }

  const experience = {
    fingerprintVersion: REASONING_FINGERPRINT_VERSION,
    ruleSetVersion: analysis.ruleSetVersion,
    boardSize: N,
    openingTechnique: dominantTechnique(firstWaveEvents),
    openingAbsoluteLocation: absoluteLocation(openingCells, N),
    openingD4CanonicalLocation: d4CanonicalCells(openingCells, N).join(',') || 'NONE',
    deductionsBeforeFirstStar,
    firstStarDepth: firstStarWaveIndex >= 0 ? firstStarWaveIndex : null,
    dominantTechnique: dominantTechnique(path),
    normalizedTechniqueSequence: techniqueSequence,
    techniqueTransitionCount,
    maximumPropagationDepth: waves.length > 0
      ? Math.max(...waves.map(wave => wave.index))
      : 0,
    independentOpeningCount: connectedComponents(openingCells, N),
    eliminationToStarRatio: starCount > 0
      ? Number((eliminationCount / starCount).toFixed(3))
      : null,
    finishingTailProportion,
    resultStatus: analysis.status,
  };
  const normalizedFingerprint = sha256(stableJson(experience));
  return {
    exact,
    experience: {
      ...experience,
      normalizedFingerprint,
    },
  };
}

function pairKey(a, b) {
  return [a.candidateId, b.candidateId].sort().join('::');
}

function percentile(sorted, fraction) {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction));
  return Number(sorted[index].toFixed(4));
}

export function analyzeReasoningDuplicates(reports) {
  const pairs = [];
  const geometryScores = [];
  const hardRejectPairs = new Set();
  const warningPairs = new Set();

  for (let i = 0; i < reports.length; i++) {
    for (let j = i + 1; j < reports.length; j++) {
      const a = reports[i];
      const b = reports[j];
      if (a.N !== b.N) continue;
      const matches = [];
      let decision = 'allow';
      const hard = reason => {
        matches.push(reason);
        decision = 'hard-reject';
        hardRejectPairs.add(pairKey(a, b));
      };
      const warning = reason => {
        matches.push(reason);
        if (decision !== 'hard-reject') decision = 'warning-manual-review';
        warningPairs.add(pairKey(a, b));
      };

      if (a.exactRegionSignature && a.exactRegionSignature === b.exactRegionSignature) {
        hard('exact-region');
      }
      if (a.canonicalRegionSignature
          && a.canonicalRegionSignature === b.canonicalRegionSignature) {
        hard('d4-region');
      }
      if (a.reasoningFingerprint?.experience?.normalizedFingerprint
          && a.reasoningFingerprint.experience.normalizedFingerprint
            === b.reasoningFingerprint?.experience?.normalizedFingerprint) {
        hard('exact-normalized-reasoning-fingerprint');
      }
      if (a.reasoningFingerprint?.exact?.exactTraceHash
          && a.reasoningFingerprint.exact.exactTraceHash
            === b.reasoningFingerprint?.exact?.exactTraceHash) {
        matches.push('exact-reasoning-trace');
      }

      if (a.solutionSignature && a.solutionSignature === b.solutionSignature) {
        if (a.N >= 9) hard('exact-solution');
        else warning('8x8-exact-solution-exception');
      }
      if (a.canonicalSolutionSignature
          && a.canonicalSolutionSignature === b.canonicalSolutionSignature) {
        if (a.N >= 9) hard('d4-solution');
        else warning('8x8-d4-solution-exception');
      }

      let regionGeometrySimilarity = null;
      if (Array.isArray(a.regions) && Array.isArray(b.regions)) {
        regionGeometrySimilarity = d4AlignedRegionMetrics(a.regions, b.regions, a.N).similarity;
        geometryScores.push(regionGeometrySimilarity);
      }
      if (matches.length > 0 || regionGeometrySimilarity !== null) {
        pairs.push({
          a: a.candidateId,
          b: b.candidateId,
          N: a.N,
          decision,
          matches,
          regionGeometrySimilarity,
        });
      }
    }
  }

  const sortedScores = geometryScores.sort((a, b) => a - b);
  return {
    policyVersion: REASONING_FINGERPRINT_VERSION,
    hardRejectPairCount: hardRejectPairs.size,
    warningPairCount: warningPairs.size,
    pairs,
    regionGeometrySimilarityDistribution: {
      count: sortedScores.length,
      min: percentile(sortedScores, 0),
      p25: percentile(sortedScores, 0.25),
      median: percentile(sortedScores, 0.5),
      p75: percentile(sortedScores, 0.75),
      max: percentile(sortedScores, 1),
    },
  };
}

function openingSequenceKey(report) {
  const experience = report.reasoningFingerprint?.experience;
  if (!experience) return 'NONE';
  return [
    experience.openingTechnique,
    experience.openingAbsoluteLocation,
    experience.firstStarDepth ?? 'NONE',
  ].join('|');
}

function dominantExperienceKey(report) {
  const experience = report.reasoningFingerprint?.experience;
  if (!experience) return 'NONE';
  return `${experience.openingTechnique}|${experience.dominantTechnique}`;
}

function metricDifferenceCount(a, b) {
  const first = a.reasoningFingerprint?.experience || {};
  const second = b.reasoningFingerprint?.experience || {};
  return [
    first.openingTechnique !== second.openingTechnique,
    first.openingAbsoluteLocation !== second.openingAbsoluteLocation,
    first.firstStarDepth !== second.firstStarDepth,
  ].filter(Boolean).length;
}

export function analyzeStarDoubleSequence(reports) {
  const violations = [];
  const add = (rule, indexes, detail) => violations.push({ rule, indexes, detail });

  for (let index = 1; index < reports.length; index++) {
    if (openingSequenceKey(reports[index]) === openingSequenceKey(reports[index - 1])) {
      add('adjacent-opening-fingerprint', [index - 1, index], openingSequenceKey(reports[index]));
    }
    const stalled = new Set(['STALLED_SUPPORTED_RULES', 'UNIQUE_BUT_OUTSIDE_SUPPORTED_RULESET']);
    const firstStatus = reports[index - 1].humanLogic?.status;
    const secondStatus = reports[index].humanLogic?.status;
    if (stalled.has(firstStatus) && stalled.has(secondStatus)) {
      add('consecutive-unsupported-logic', [index - 1, index], `${firstStatus},${secondStatus}`);
    }
  }

  let sameDominantStart = 0;
  let sameSizeStart = 0;
  for (let index = 1; index <= reports.length; index++) {
    if (index === reports.length
        || reports[index].reasoningFingerprint?.experience?.dominantTechnique
          !== reports[sameDominantStart].reasoningFingerprint?.experience?.dominantTechnique) {
      if (index - sameDominantStart > 2) {
        add('dominant-technique-run', [sameDominantStart, index - 1],
          reports[sameDominantStart].reasoningFingerprint?.experience?.dominantTechnique);
      }
      sameDominantStart = index;
    }
    if (index === reports.length || reports[index].N !== reports[sameSizeStart].N) {
      if (index - sameSizeStart > 2) {
        add('board-size-run', [sameSizeStart, index - 1], reports[sameSizeStart].N);
      }
      sameSizeStart = index;
    }
  }

  for (let start = 0; start + 4 <= reports.length; start++) {
    const experiences = new Set(reports.slice(start, start + 4).map(dominantExperienceKey));
    if (experiences.size < 3) {
      add('four-level-experience-diversity', [start, start + 3], `${experiences.size} distinct`);
    }
  }

  const signatureFields = [
    ['solutionSignature', 'exact-solution-spacing'],
    ['canonicalSolutionSignature', 'd4-solution-spacing'],
  ];
  for (const [field, rule] of signatureFields) {
    const positions = new Map();
    for (let index = 0; index < reports.length; index++) {
      const signature = reports[index][field];
      if (!signature) continue;
      if (!positions.has(signature)) positions.set(signature, []);
      positions.get(signature).push(index);
    }
    for (const [signature, indexes] of positions) {
      if (indexes.length < 2) continue;
      const N = reports[indexes[0]].N;
      if (N >= 9) {
        add(rule, indexes, '9x9/10x10 duplicates are not permitted');
        continue;
      }
      if (indexes.length > 2) add('8x8-solution-count', indexes, 'maximum is 2');
      for (let pair = 1; pair < indexes.length; pair++) {
        const first = indexes[pair - 1];
        const second = indexes[pair];
        if (second - first < 3) add('8x8-solution-spacing', [first, second], signature);
        const firstFp = reports[first].reasoningFingerprint?.experience?.normalizedFingerprint;
        const secondFp = reports[second].reasoningFingerprint?.experience?.normalizedFingerprint;
        if (firstFp && firstFp === secondFp) {
          add('8x8-normalized-reasoning-repeat', [first, second], signature);
        }
        if (metricDifferenceCount(reports[first], reports[second]) < 2) {
          add('8x8-experience-difference', [first, second], 'fewer than two opening fields differ');
        }
      }
    }
  }

  return {
    policyVersion: REASONING_FINGERPRINT_VERSION,
    passed: violations.length === 0,
    violations,
  };
}
