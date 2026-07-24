import { performance } from 'node:perf_hooks';
import {
  CELL_STATE,
  HUMAN_LOGIC_STATUS,
  analyzeStarDoubleHumanLogic,
  replayHumanLogicTrace,
} from './star-double-human-logic.mjs';
import { makeReasoningFingerprint } from './star-double-reasoning-fingerprint.mjs';
import {
  d4AlignedRegionMetrics,
  makeCanonicalRegionSig,
  makeCanonicalSolutionSig,
  makeRegionSig,
  makeSolutionSig,
} from './star-line-candidate-signatures.mjs';
import { solveStarLine } from './starLineSolver.mjs';

export const REGION_OPTIMIZER_VERSION = 'star-double-region-optimizer-0.1.0';

export const REGION_OPTIMIZER_CLASSIFICATION = Object.freeze({
  INVALID_MUTATION: 'INVALID_MUTATION',
  NON_UNIQUE: 'NON_UNIQUE',
  UNIQUE_NO_GAIN: 'UNIQUE_NO_GAIN',
  ENTRY_GAIN: 'ENTRY_GAIN',
  PROPAGATION_GAIN: 'PROPAGATION_GAIN',
  FULLY_SOLVED: 'FULLY_SOLVED',
  SEQUENCE_ELIGIBLE: 'SEQUENCE_ELIGIBLE',
});

export const REGION_OPTIMIZER_TIERS = Object.freeze([
  Object.freeze({ tier: 1, maxMovedCells: 4, maxLegalStates: 80 }),
  Object.freeze({ tier: 2, maxMovedCells: 8, maxLegalStates: 160 }),
  Object.freeze({ tier: 3, maxMovedCells: 12, maxLegalStates: 240 }),
]);

export const REGION_OPTIMIZER_ZONE_LIMITS = Object.freeze({
  8: 18,
  9: 22,
  10: 26,
});

const PHASE_RANK = Object.freeze({
  opening: 0,
  early: 1,
  mid: 2,
  late: 3,
  solved: 4,
});

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function canonicalizeLabels(regions) {
  const labels = new Map();
  let next = 0;
  return regions.map((label) => {
    if (!labels.has(label)) labels.set(label, next++);
    return labels.get(label);
  });
}

function orthogonalNeighbors(cell, N) {
  const row = Math.floor(cell / N);
  const col = cell % N;
  const out = [];
  for (const [dr, dc] of [[-1, 0], [0, -1], [0, 1], [1, 0]]) {
    const nextRow = row + dr;
    const nextCol = col + dc;
    if (nextRow >= 0 && nextRow < N && nextCol >= 0 && nextCol < N) {
      out.push(nextRow * N + nextCol);
    }
  }
  return out.sort((a, b) => a - b);
}

function eightNeighbors(cell, N) {
  const row = Math.floor(cell / N);
  const col = cell % N;
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nextRow = row + dr;
      const nextCol = col + dc;
      if (nextRow >= 0 && nextRow < N && nextCol >= 0 && nextCol < N) {
        out.push(nextRow * N + nextCol);
      }
    }
  }
  return out.sort((a, b) => a - b);
}

function unitCells(N, regions, key) {
  const [kind, rawIndex] = key.split(':');
  const index = Number(rawIndex);
  if (kind === 'row') {
    return Array.from({ length: N }, (_, col) => index * N + col);
  }
  if (kind === 'col') {
    return Array.from({ length: N }, (_, row) => row * N + index);
  }
  if (kind === 'region') {
    const cells = [];
    for (let cell = 0; cell < regions.length; cell++) {
      if (regions[cell] === index) cells.push(cell);
    }
    return cells;
  }
  return [];
}

function allUnitKeys(N) {
  return ['row', 'col', 'region']
    .flatMap(kind => Array.from({ length: N }, (_, index) => `${kind}:${index}`));
}

function isConnected(regions, N, regionId) {
  const cells = [];
  for (let cell = 0; cell < regions.length; cell++) {
    if (regions[cell] === regionId) cells.push(cell);
  }
  if (cells.length === 0) return false;
  const visited = new Set([cells[0]]);
  const queue = [cells[0]];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const neighbor of orthogonalNeighbors(current, N)) {
      if (regions[neighbor] === regionId && !visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return visited.size === cells.length;
}

function sameCellSet(first, second) {
  if (!Array.isArray(first) || !Array.isArray(second) || first.length !== second.length) {
    return false;
  }
  const orderedFirst = [...first].sort((a, b) => a - b);
  const orderedSecond = [...second].sort((a, b) => a - b);
  return orderedFirst.every((cell, index) => cell === orderedSecond[index]);
}

function eventSignature(event) {
  return stableJson({
    technique: event.technique,
    action: event.action,
    affectedCells: [...(event.affectedCells || [])].sort((a, b) => a - b),
    sourceUnits: [...(event.sourceUnits || [])].sort(),
    witnessCells: [...(event.witnessCells || [])].sort((a, b) => a - b),
  });
}

function completionRatio(analysis, total) {
  if (!Array.isArray(analysis?.finalState) || analysis.finalState.length !== total) return 0;
  return analysis.finalState.filter(value => value !== CELL_STATE.UNKNOWN).length / total;
}

export function classifyStallPhase(analysis, total) {
  if (analysis?.status === HUMAN_LOGIC_STATUS.SOLVED_SUPPORTED_RULES) return 'solved';
  const ratio = completionRatio(analysis, total);
  if ((analysis?.canonicalPath || []).length === 0 || ratio < 0.05) return 'opening';
  if (ratio < 0.25) return 'early';
  if (ratio < 0.75) return 'mid';
  return 'late';
}

function buildUnitStats(N, quota, regions, state) {
  return allUnitKeys(N).map((key) => {
    const cells = unitCells(N, regions, key);
    const stars = cells.filter(cell => state[cell] === CELL_STATE.STAR);
    const candidates = cells.filter(cell => state[cell] === CELL_STATE.UNKNOWN);
    const remainingQuota = quota - stars.length;
    return {
      key,
      cells,
      stars,
      candidates,
      remainingQuota,
      candidateCount: candidates.length,
      slack: candidates.length - remainingQuota,
    };
  });
}

function closestRuleStructures(N, quota, regions, state, unitStats) {
  const statsByKey = new Map(unitStats.map(stats => [stats.key, stats]));
  const remainingCapacity = unitStats
    .filter(stats => stats.remainingQuota > 0)
    .map(stats => ({
      unit: stats.key,
      cells: stats.candidates,
      distance: stats.slack,
      remainingQuota: stats.remainingQuota,
      candidateCount: stats.candidateCount,
    }))
    .sort((a, b) => a.distance - b.distance || a.unit.localeCompare(b.unit))
    .slice(0, 8);

  const confinement = [];
  for (const source of unitStats) {
    if (source.remainingQuota <= 0 || source.candidates.length === 0) continue;
    const sourceSet = new Set(source.candidates);
    for (const target of unitStats) {
      if (source.key === target.key || target.remainingQuota <= 0) continue;
      const contained = source.candidates.every(cell => target.cells.includes(cell));
      if (!contained) continue;
      const outside = target.candidates.filter(cell => !sourceSet.has(cell));
      confinement.push({
        sourceUnit: source.key,
        targetUnit: target.key,
        cells: [...source.candidates, ...outside],
        distance: Math.abs(source.remainingQuota - target.remainingQuota) + outside.length,
        sourceRemainingQuota: source.remainingQuota,
        targetRemainingQuota: target.remainingQuota,
        outsideCandidateCount: outside.length,
      });
    }
  }
  confinement.sort((a, b) =>
    a.distance - b.distance
      || a.sourceUnit.localeCompare(b.sourceUnit)
      || a.targetUnit.localeCompare(b.targetUnit));

  const multiUnit = [];
  for (const kind of ['row', 'col']) {
    for (let first = 0; first < N; first++) {
      for (let second = first + 1; second < N; second++) {
        const firstStats = statsByKey.get(`${kind}:${first}`);
        const secondStats = statsByKey.get(`${kind}:${second}`);
        const candidates = [...firstStats.candidates, ...secondStats.candidates];
        const targetRegions = [...new Set(candidates.map(cell => regions[cell]))].sort((a, b) => a - b);
        const remaining = firstStats.remainingQuota + secondStats.remainingQuota;
        multiUnit.push({
          sourceUnits: [firstStats.key, secondStats.key],
          targetUnits: targetRegions.map(region => `region:${region}`),
          cells: candidates,
          distance: Math.abs(targetRegions.length * quota - remaining)
            + Math.max(0, targetRegions.length - 2),
          sourceRemainingQuota: remaining,
          targetRegionCount: targetRegions.length,
        });
      }
    }
  }
  multiUnit.sort((a, b) =>
    a.distance - b.distance || a.sourceUnits.join(',').localeCompare(b.sourceUnits.join(',')));

  const twoByTwo = [];
  for (let row = 0; row < N - 1; row++) {
    for (let col = 0; col < N - 1; col++) {
      const cells = [
        row * N + col,
        row * N + col + 1,
        (row + 1) * N + col,
        (row + 1) * N + col + 1,
      ];
      const stars = cells.filter(cell => state[cell] === CELL_STATE.STAR).length;
      const unknown = cells.filter(cell => state[cell] === CELL_STATE.UNKNOWN);
      twoByTwo.push({
        block: `block:${row}:${col}`,
        cells,
        distance: stars > 0 ? 0 : Math.max(0, unknown.length - 2),
        starCount: stars,
        unknownCount: unknown.length,
      });
    }
  }
  twoByTwo.sort((a, b) => a.distance - b.distance || a.block.localeCompare(b.block));

  const pressuredGroups = unitStats
    .filter(stats => stats.remainingQuota > 0 && stats.candidateCount <= 8)
    .map(stats => ({
      unit: stats.key,
      cells: stats.candidates,
      distance: Math.max(0, stats.candidateCount - stats.remainingQuota * 2),
      remainingQuota: stats.remainingQuota,
      candidateCount: stats.candidateCount,
    }))
    .sort((a, b) => a.distance - b.distance || a.unit.localeCompare(b.unit))
    .slice(0, 8);

  return {
    remainingCapacity,
    confinement: confinement.slice(0, 8),
    multiUnit: multiUnit.slice(0, 8),
    twoByTwo: twoByTwo.slice(0, 8),
    pressuredGroups,
  };
}

/**
 * 定位第一次由受支持规则传播后出现的停滞。此函数故意不接受也不读取 solution。
 */
export function locateStarDoubleStall(puzzle, options = {}) {
  const N = puzzle?.N;
  const quota = puzzle?.quota ?? puzzle?.starsPerRow ?? 2;
  const regions = Array.isArray(puzzle?.regions) ? canonicalizeLabels(puzzle.regions) : puzzle?.regions;
  const analyzer = options.analyzer || analyzeStarDoubleHumanLogic;
  const analysis = options.analysis || analyzer({ N, quota, regions }, {
    solverStatus: options.solverStatus || null,
  });
  const state = Array.isArray(analysis.finalState)
    ? analysis.finalState
    : new Array(Number.isInteger(N) ? N * N : 0).fill(CELL_STATE.UNKNOWN);
  const unitStats = Number.isInteger(N) && Array.isArray(regions)
    ? buildUnitStats(N, quota, regions, state)
    : [];
  const mostConstrainedUnits = unitStats
    .filter(stats => stats.remainingQuota > 0)
    .sort((a, b) =>
      a.slack - b.slack
        || a.candidateCount - b.candidateCount
        || a.key.localeCompare(b.key))
    .slice(0, 8);
  const lastWave = (analysis.deductionWaves || []).at(-1) || null;
  const lastEvents = lastWave?.events || [];
  const lastEvent = lastEvents.at(-1) || (analysis.canonicalPath || []).at(-1) || null;
  const phase = classifyStallPhase(analysis, Number.isInteger(N) ? N * N : 0);

  return {
    status: analysis.status,
    phase,
    completionRatio: completionRatio(analysis, Number.isInteger(N) ? N * N : 0),
    stallWave: (analysis.deductionWaves || []).length,
    lastWaveIndex: lastWave?.index ?? null,
    lastEvent,
    lastWaveEvents: lastEvents,
    finalState: state,
    finalStateHash: analysis.finalStateHash || null,
    mostConstrainedUnits,
    closestRuleStructures: Number.isInteger(N) && Array.isArray(regions)
      ? closestRuleStructures(N, quota, regions, state, unitStats)
      : {},
    analysis,
  };
}

function manhattanDistance(first, second, N) {
  return Math.abs(Math.floor(first / N) - Math.floor(second / N))
    + Math.abs((first % N) - (second % N));
}

/**
 * 从停滞证据构造固定局部边界区。区域只依据 trace/state/regions，不使用 solution。
 */
export function buildStarDoubleMutationZone(puzzle, stall, options = {}) {
  const N = puzzle.N;
  const regions = canonicalizeLabels(puzzle.regions);
  const maxCells = options.maxCells
    ?? REGION_OPTIMIZER_ZONE_LIMITS[N]
    ?? Math.max(12, Math.round(N * 2.5));
  const score = new Map();
  const reasons = new Map();
  const focusCells = new Set();
  const finalState = stall.finalState || new Array(N * N).fill(CELL_STATE.UNKNOWN);

  function add(cell, points, reason, focus = false) {
    if (!Number.isInteger(cell) || cell < 0 || cell >= N * N) return;
    score.set(cell, (score.get(cell) || 0) + points);
    if (!reasons.has(cell)) reasons.set(cell, new Set());
    reasons.get(cell).add(reason);
    if (focus) focusCells.add(cell);
  }

  for (const event of stall.lastWaveEvents || []) {
    for (const cell of event.affectedCells || []) add(cell, 1_000, 'last-wave-affected', true);
    for (const cell of event.witnessCells || []) add(cell, 900, 'last-wave-witness', true);
    for (const key of event.sourceUnits || []) {
      for (const cell of unitCells(N, regions, key)) add(cell, 500, 'last-wave-source-unit');
    }
  }

  for (let index = 0; index < (stall.mostConstrainedUnits || []).length; index++) {
    const unit = stall.mostConstrainedUnits[index];
    const points = 420 - index * 20;
    for (const cell of unit.cells || []) add(cell, points, 'constrained-unit');
    for (const cell of unit.candidates || []) add(cell, 120, 'constrained-candidate', true);
  }

  const structureWeights = {
    confinement: 330,
    multiUnit: 300,
    pressuredGroups: 280,
    twoByTwo: 220,
    remainingCapacity: 180,
  };
  for (const [kind, points] of Object.entries(structureWeights)) {
    for (const structure of (stall.closestRuleStructures?.[kind] || []).slice(0, 3)) {
      for (const cell of structure.cells || []) add(cell, points, `near-${kind}`, true);
    }
  }

  const boundaryCells = [];
  for (let cell = 0; cell < regions.length; cell++) {
    const crossRegionNeighbors = orthogonalNeighbors(cell, N)
      .filter(neighbor => regions[neighbor] !== regions[cell]);
    if (crossRegionNeighbors.length === 0) continue;
    boundaryCells.push(cell);
    add(cell, crossRegionNeighbors.length * 25, 'shared-boundary');
    if (finalState[cell] === CELL_STATE.UNKNOWN) add(cell, 90, 'stalled-unknown');
    const unknownNeighbors = eightNeighbors(cell, N)
      .filter(neighbor => finalState[neighbor] === CELL_STATE.UNKNOWN).length;
    add(cell, unknownNeighbors * 5, 'unknown-concentration');
  }

  const focus = [...focusCells].sort((a, b) => a - b);
  const ranked = boundaryCells.map((cell) => {
    const distance = focus.length > 0
      ? Math.min(...focus.map(target => manhattanDistance(cell, target, N)))
      : N * 2;
    return {
      cell,
      score: (score.get(cell) || 0) - distance * 7,
      distanceToFocus: distance,
      reasons: [...(reasons.get(cell) || [])].sort(),
      fromRegion: regions[cell],
      adjacentRegions: [...new Set(orthogonalNeighbors(cell, N)
        .map(neighbor => regions[neighbor])
        .filter(region => region !== regions[cell]))].sort((a, b) => a - b),
    };
  }).sort((a, b) =>
    b.score - a.score
      || a.distanceToFocus - b.distanceToFocus
      || a.cell - b.cell);

  return {
    maxCells,
    cells: ranked.slice(0, maxCells).map(entry => entry.cell),
    rankedCells: ranked.slice(0, maxCells),
    boundaryCellCount: boundaryCells.length,
    focusCells: focus,
    sourcePhase: stall.phase,
    sourceStateHash: stall.finalStateHash,
  };
}

function validatePuzzleSolution(N, quota, regions, solution) {
  const errors = [];
  if (!Number.isInteger(N) || N < 2) errors.push('invalid-board-size');
  if (!Array.isArray(regions) || regions.length !== N * N) errors.push('invalid-region-length');
  if (!Array.isArray(solution) || solution.length !== N * quota) errors.push('invalid-solution-length');
  if (errors.length > 0) return errors;

  const solutionSet = new Set(solution);
  if (solutionSet.size !== solution.length
      || [...solutionSet].some(cell => !Number.isInteger(cell) || cell < 0 || cell >= N * N)) {
    errors.push('invalid-solution-cells');
    return errors;
  }
  for (let row = 0; row < N; row++) {
    const count = solution.filter(cell => Math.floor(cell / N) === row).length;
    if (count !== quota) errors.push(`solution-row-quota:${row}:${count}`);
  }
  for (let col = 0; col < N; col++) {
    const count = solution.filter(cell => cell % N === col).length;
    if (count !== quota) errors.push(`solution-col-quota:${col}:${count}`);
  }
  for (const cell of solution) {
    for (const neighbor of eightNeighbors(cell, N)) {
      if (neighbor > cell && solutionSet.has(neighbor)) {
        errors.push(`solution-adjacency:${cell}:${neighbor}`);
      }
    }
  }
  return errors;
}

export function validateOptimizerMutation(candidate, originalRegions, zoneCells, history = []) {
  const N = candidate?.N;
  const quota = candidate?.quota ?? candidate?.starsPerRow ?? 2;
  const regions = candidate?.regions;
  const solution = candidate?.solution;
  const errors = validatePuzzleSolution(N, quota, regions, solution);
  if (!Array.isArray(originalRegions) || originalRegions.length !== N * N) {
    errors.push('invalid-original-regions');
  }
  if (!Array.isArray(zoneCells)) errors.push('invalid-zone');
  if (errors.length > 0) return { valid: false, errors };

  const originalIds = [...new Set(originalRegions)].sort((a, b) => a - b);
  const currentIds = [...new Set(regions)].sort((a, b) => a - b);
  if (stableJson(originalIds) !== stableJson(currentIds) || currentIds.length !== N) {
    errors.push('region-count-changed');
  }
  const solutionSet = new Set(solution);
  for (const regionId of currentIds) {
    if (!isConnected(regions, N, regionId)) errors.push(`region-not-connected:${regionId}`);
    const starCount = solution.filter(cell => regions[cell] === regionId).length;
    if (starCount !== quota) errors.push(`region-solution-quota:${regionId}:${starCount}`);
  }

  const zoneSet = new Set(zoneCells);
  const replay = [...originalRegions];
  const moved = new Set();
  for (let index = 0; index < history.length; index++) {
    const move = history[index];
    if (!zoneSet.has(move.cell)) errors.push(`move-outside-zone:${index}:${move.cell}`);
    if (solutionSet.has(move.cell)) errors.push(`solution-star-moved:${index}:${move.cell}`);
    if (moved.has(move.cell)) errors.push(`cell-moved-more-than-once:${index}:${move.cell}`);
    moved.add(move.cell);
    if (replay[move.cell] !== move.fromRegion) errors.push(`move-from-mismatch:${index}`);
    const receivers = orthogonalNeighbors(move.cell, N)
      .filter(neighbor => replay[neighbor] === move.toRegion);
    if (receivers.length === 0) errors.push(`move-not-across-shared-boundary:${index}`);
    replay[move.cell] = move.toRegion;
    for (const regionId of [move.fromRegion, move.toRegion]) {
      if (!isConnected(replay, N, regionId)) {
        errors.push(`move-breaks-connectivity:${index}:${regionId}`);
      }
      const starCount = solution.filter(cell => replay[cell] === regionId).length;
      if (starCount !== quota) errors.push(`move-breaks-solution-quota:${index}:${regionId}`);
    }
  }
  if (stableJson(replay) !== stableJson(regions)) errors.push('mutation-history-replay-mismatch');
  for (let cell = 0; cell < regions.length; cell++) {
    if (regions[cell] !== originalRegions[cell] && !moved.has(cell)) {
      errors.push(`unrecorded-region-change:${cell}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

function enumerateBoundaryMoves(state, N, zoneCells) {
  const moved = new Set(state.history.map(move => move.cell));
  const moves = [];
  for (const cell of zoneCells) {
    if (moved.has(cell)) continue;
    const fromRegion = state.regions[cell];
    const toRegions = [...new Set(orthogonalNeighbors(cell, N)
      .map(neighbor => state.regions[neighbor])
      .filter(region => region !== fromRegion))]
      .sort((a, b) => a - b);
    for (const toRegion of toRegions) {
      moves.push({ cell, fromRegion, toRegion });
    }
  }
  return moves.sort((a, b) =>
    zoneCells.indexOf(a.cell) - zoneCells.indexOf(b.cell)
      || a.cell - b.cell
      || a.fromRegion - b.fromRegion
      || a.toRegion - b.toRegion);
}

export function applyOptimizerMove(state, move) {
  const regions = [...state.regions];
  regions[move.cell] = move.toRegion;
  return {
    regions,
    history: [...state.history, { ...move }],
  };
}

export function makeOptimizerRegionStateSignatures(N, quota, regions) {
  return {
    exact: makeRegionSig('starDouble', N, quota, regions),
    d4: makeCanonicalRegionSig('starDouble', N, quota, regions),
  };
}

function summarizeAnalysis(analysis, fingerprint, N, originalSummary = null, regions = null,
    originalRegions = null, history = []) {
  const total = N * N;
  const path = analysis?.canonicalPath || [];
  const waves = analysis?.deductionWaves || [];
  const phase = classifyStallPhase(analysis, total);
  const firstStarWave = waves.findIndex(wave =>
    (wave.events || []).some(event => event.action === 'place-star'));
  const starCount = analysis?.summary?.finalStarCount
    ?? (analysis?.finalState || []).filter(value => value === CELL_STATE.STAR).length;
  const summary = {
    status: analysis?.status || 'UNKNOWN',
    phase,
    phaseRank: PHASE_RANK[phase] ?? -1,
    completionRatio: completionRatio(analysis, total),
    waveCount: waves.length,
    eventCount: path.length,
    starCount,
    firstStarWave: firstStarWave >= 0 ? firstStarWave : null,
    safeDeductionCount: path.length,
    independentOpeningCount: fingerprint?.experience?.independentOpeningCount || 0,
    dominantTechnique: fingerprint?.experience?.dominantTechnique || 'NONE',
    normalizedReasoningFingerprint:
      fingerprint?.experience?.normalizedFingerprint || null,
    exactTraceHash: fingerprint?.exact?.exactTraceHash || null,
    replayOk: null,
    solutionConsistencyErrorCount: (analysis?.solutionConsistencyErrors || []).length,
    movedCellCount: new Set(history.map(move => move.cell)).size,
    regionSimilarityToOriginal: regions && originalRegions
      ? d4AlignedRegionMetrics(originalRegions, regions, N).similarity
      : 1,
  };

  if (originalSummary) {
    summary.completionGain = Number(
      (summary.completionRatio - originalSummary.completionRatio).toFixed(4),
    );
    summary.waveGain = summary.waveCount - originalSummary.waveCount;
    summary.eventGain = summary.eventCount - originalSummary.eventCount;
    summary.starGain = summary.starCount - originalSummary.starCount;
    summary.phaseGain = summary.phaseRank - originalSummary.phaseRank;
    summary.firstStarAppeared =
      originalSummary.firstStarWave === null && summary.firstStarWave !== null;
  } else {
    summary.completionGain = 0;
    summary.waveGain = 0;
    summary.eventGain = 0;
    summary.starGain = 0;
    summary.phaseGain = 0;
    summary.firstStarAppeared = false;
  }
  return summary;
}

function mutationDependentDeductions(originalAnalysis, optimizedAnalysis, history) {
  const originalSignatures = new Set((originalAnalysis?.canonicalPath || []).map(eventSignature));
  const movedCells = new Set(history.map(move => move.cell));
  const changedRegionUnits = new Set(history.flatMap(move =>
    [`region:${move.fromRegion}`, `region:${move.toRegion}`]));
  const candidateEvents = optimizedAnalysis?.canonicalPath || [];
  const newEvents = candidateEvents.filter(event => !originalSignatures.has(eventSignature(event)));
  const dependent = new Set();

  for (const event of newEvents) {
    const touchesCell = [...(event.affectedCells || []), ...(event.witnessCells || [])]
      .some(cell => movedCells.has(cell));
    const touchesRegion = (event.sourceUnits || []).some(unit => changedRegionUnits.has(unit));
    if (touchesCell || touchesRegion) dependent.add(event.id);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const event of newEvents) {
      if (dependent.has(event.id)) continue;
      if ((event.prerequisiteEvents || []).some(id => dependent.has(id))) {
        dependent.add(event.id);
        changed = true;
      }
    }
  }
  const dependentEvents = candidateEvents.filter(event => dependent.has(event.id));
  const waves = new Set(dependentEvents.map(event => event.propagationDepth));
  return {
    newDeductionCount: newEvents.length,
    mutationDependentDeductionCount: dependentEvents.length,
    mutationDependentEventIds: dependentEvents.map(event => event.id),
    mutationDependentWaveCount: waves.size,
    immediateStall: newEvents.length === 0,
  };
}

export function classifyOptimizerState(originalSummary, candidateSummary) {
  if (candidateSummary.invalid) return REGION_OPTIMIZER_CLASSIFICATION.INVALID_MUTATION;
  if (!candidateSummary.uniqueSafeReplay) return REGION_OPTIMIZER_CLASSIFICATION.NON_UNIQUE;
  if (candidateSummary.status === HUMAN_LOGIC_STATUS.SOLVED_SUPPORTED_RULES) {
    return REGION_OPTIMIZER_CLASSIFICATION.FULLY_SOLVED;
  }
  if (candidateSummary.completionGain >= 0.2 || candidateSummary.waveGain >= 2) {
    return REGION_OPTIMIZER_CLASSIFICATION.PROPAGATION_GAIN;
  }
  if (candidateSummary.firstStarAppeared
      || candidateSummary.phaseRank > originalSummary.phaseRank
      || candidateSummary.mutationDependentDeductionCount > 0
      || candidateSummary.eventGain > 0) {
    return REGION_OPTIMIZER_CLASSIFICATION.ENTRY_GAIN;
  }
  return REGION_OPTIMIZER_CLASSIFICATION.UNIQUE_NO_GAIN;
}

export function makeOptimizerObjective(summary) {
  return [
    summary.status === HUMAN_LOGIC_STATUS.SOLVED_SUPPORTED_RULES ? 1 : 0,
    summary.uniqueSafeReplay ? 1 : 0,
    summary.phaseRank ?? -1,
    summary.starCount ?? 0,
    summary.waveCount ?? 0,
    summary.completionRatio ?? 0,
    summary.safeDeductionCount ?? 0,
    summary.independentOpeningCount ?? 0,
    -(summary.movedCellCount ?? 0),
    summary.regionSimilarityToOriginal ?? 0,
  ];
}

export function compareOptimizerObjectives(first, second) {
  const firstVector = Array.isArray(first) ? first : makeOptimizerObjective(first);
  const secondVector = Array.isArray(second) ? second : makeOptimizerObjective(second);
  const length = Math.max(firstVector.length, secondVector.length);
  for (let index = 0; index < length; index++) {
    const difference = (firstVector[index] ?? 0) - (secondVector[index] ?? 0);
    if (Math.abs(difference) > 1e-12) return difference > 0 ? 1 : -1;
  }
  return 0;
}

function isSignificantImprovement(original, candidate) {
  return candidate.completionGain >= 0.2
    || candidate.waveGain >= 2
    || candidate.firstStarAppeared
    || (
      original.phaseRank <= PHASE_RANK.early
      && candidate.phaseRank >= PHASE_RANK.mid
    )
    || candidate.mutationDependentDeductionCount >= 8;
}

function isNoticeableImprovement(original, candidate) {
  return isSignificantImprovement(original, candidate)
    || candidate.phaseRank > original.phaseRank
    || candidate.eventGain > 0
    || candidate.completionGain >= 0.02;
}

function makeSolverOptions(quota) {
  return {
    starsPerRow: quota,
    starsPerCol: quota,
    starsPerRegion: quota,
  };
}

function evaluateUniqueCandidate(candidate, originalSummary, originalAnalysis, originalRegions,
    history, dependencies, solverResult = null) {
  const { solver, analyzer, fingerprintMaker, replay } = dependencies;
  const quota = candidate.quota ?? candidate.starsPerRow ?? 2;
  const uniqueness = solverResult || solver(candidate.N, candidate.regions, makeSolverOptions(quota));
  if (uniqueness.status !== 'UNIQUE') {
    return {
      uniquenessResult: uniqueness,
      summary: {
        invalid: false,
        uniqueSafeReplay: false,
        status: uniqueness.status,
      },
      classification: REGION_OPTIMIZER_CLASSIFICATION.NON_UNIQUE,
    };
  }
  const solvedSolution = uniqueness.solutions?.[0] || [];
  if (!sameCellSet(candidate.solution, solvedSolution)) {
    return {
      uniquenessResult: uniqueness,
      summary: {
        invalid: false,
        uniqueSafeReplay: false,
        status: 'DECLARED_SOLUTION_MISMATCH',
      },
      classification: REGION_OPTIMIZER_CLASSIFICATION.NON_UNIQUE,
    };
  }
  const analysis = analyzer({
    N: candidate.N,
    quota,
    regions: candidate.regions,
    solution: solvedSolution,
  }, { solverStatus: uniqueness.status });
  const traceReplay = replay({
    N: candidate.N,
    quota,
    regions: candidate.regions,
    solution: solvedSolution,
  }, analysis);
  const fingerprint = fingerprintMaker(analysis, candidate.N);
  const summary = summarizeAnalysis(
    analysis,
    fingerprint,
    candidate.N,
    originalSummary,
    candidate.regions,
    originalRegions,
    history,
  );
  summary.replayOk = traceReplay.ok;
  summary.uniqueSafeReplay = traceReplay.ok
    && (analysis.solutionConsistencyErrors || []).length === 0
    && ![
      HUMAN_LOGIC_STATUS.CONTRADICTION,
      HUMAN_LOGIC_STATUS.INVALID_INPUT,
      HUMAN_LOGIC_STATUS.TRACE_LIMIT_REACHED,
    ].includes(analysis.status);
  const dependence = mutationDependentDeductions(originalAnalysis, analysis, history);
  Object.assign(summary, dependence);
  const classification = originalSummary
    ? classifyOptimizerState(originalSummary, summary)
    : (
      summary.status === HUMAN_LOGIC_STATUS.SOLVED_SUPPORTED_RULES
        ? REGION_OPTIMIZER_CLASSIFICATION.FULLY_SOLVED
        : REGION_OPTIMIZER_CLASSIFICATION.UNIQUE_NO_GAIN
    );
  return {
    uniquenessResult: uniqueness,
    analysis,
    traceReplay,
    reasoningFingerprint: fingerprint,
    summary,
    classification,
  };
}

function emptyClassificationCounts() {
  return Object.fromEntries(Object.values(REGION_OPTIMIZER_CLASSIFICATION)
    .map(classification => [classification, 0]));
}

/**
 * 停滞驱动的 bounded region optimizer。搜索排序不读取 solution；
 * solution 只在 mutation 已生成后进入合法性与 solver/trace 安全复核。
 */
export function optimizeStarDoubleRegions(candidate, options = {}) {
  const startedAt = performance.now();
  const quota = candidate?.quota ?? candidate?.starsPerRow ?? 2;
  const originalRegions = Array.isArray(candidate?.regions)
    ? canonicalizeLabels(candidate.regions)
    : candidate?.regions;
  const normalizedCandidate = {
    ...candidate,
    quota,
    regions: originalRegions,
    solution: Array.isArray(candidate?.solution) ? [...candidate.solution] : candidate?.solution,
  };
  const dependencies = {
    solver: options.solver || solveStarLine,
    analyzer: options.analyzer || analyzeStarDoubleHumanLogic,
    replay: options.replay || replayHumanLogicTrace,
    fingerprintMaker: options.fingerprintMaker || makeReasoningFingerprint,
  };
  const tiers = options.tiers || REGION_OPTIMIZER_TIERS;
  const sourceErrors = validatePuzzleSolution(
    normalizedCandidate.N,
    quota,
    normalizedCandidate.regions,
    normalizedCandidate.solution,
  );
  if (sourceErrors.length > 0) {
    return {
      optimizerVersion: REGION_OPTIMIZER_VERSION,
      candidateId: candidate?.candidateId || 'unknown',
      originalRegions,
      optimizedRegions: originalRegions,
      movedCells: [],
      mutationHistory: [],
      objectiveHistory: [],
      finalStatus: REGION_OPTIMIZER_CLASSIFICATION.INVALID_MUTATION,
      classification: REGION_OPTIMIZER_CLASSIFICATION.INVALID_MUTATION,
      stopReason: 'invalid-source',
      errors: sourceErrors,
    };
  }

  const stall = locateStarDoubleStall({
    N: normalizedCandidate.N,
    quota,
    regions: normalizedCandidate.regions,
  }, { analyzer: dependencies.analyzer });
  const zone = buildStarDoubleMutationZone({
    N: normalizedCandidate.N,
    quota,
    regions: normalizedCandidate.regions,
  }, stall, options.zone);

  const originalSolver = dependencies.solver(
    normalizedCandidate.N,
    normalizedCandidate.regions,
    makeSolverOptions(quota),
  );
  const originalEvaluation = evaluateUniqueCandidate(
    normalizedCandidate,
    null,
    stall.analysis,
    originalRegions,
    [],
    dependencies,
    originalSolver,
  );
  if (!originalEvaluation.analysis || !originalEvaluation.summary.uniqueSafeReplay) {
    return {
      optimizerVersion: REGION_OPTIMIZER_VERSION,
      candidateId: candidate?.candidateId || 'unknown',
      originalAnalysis: stall.analysis,
      optimizedAnalysis: stall.analysis,
      originalRegions,
      optimizedRegions: originalRegions,
      movedCells: [],
      mutationHistory: [],
      objectiveHistory: [],
      uniquenessResult: originalSolver,
      reasoningFingerprint: originalEvaluation.reasoningFingerprint || null,
      zone,
      stall: { ...stall, analysis: undefined },
      finalStatus: REGION_OPTIMIZER_CLASSIFICATION.NON_UNIQUE,
      classification: REGION_OPTIMIZER_CLASSIFICATION.NON_UNIQUE,
      stopReason: 'invalid-or-non-unique-source',
      errors: originalEvaluation.traceReplay?.errors || [],
    };
  }

  const originalSummary = summarizeAnalysis(
    originalEvaluation.analysis,
    originalEvaluation.reasoningFingerprint,
    normalizedCandidate.N,
    null,
    originalRegions,
    originalRegions,
    [],
  );
  originalSummary.replayOk = originalEvaluation.traceReplay.ok;
  originalSummary.uniqueSafeReplay = true;
  Object.assign(originalSummary, {
    newDeductionCount: 0,
    mutationDependentDeductionCount: 0,
    mutationDependentEventIds: [],
    mutationDependentWaveCount: 0,
    immediateStall: originalSummary.eventCount === 0,
  });

  let best = {
    regions: [...originalRegions],
    history: [],
    evaluation: {
      ...originalEvaluation,
      summary: originalSummary,
      classification: REGION_OPTIMIZER_CLASSIFICATION.UNIQUE_NO_GAIN,
    },
  };
  const objectiveHistory = [{
    tier: 0,
    depth: 0,
    classification: best.evaluation.classification,
    objective: makeOptimizerObjective(originalSummary),
    summary: originalSummary,
    mutationHistory: [],
  }];
  const visitedExact = new Set([
    makeRegionSig('starDouble', normalizedCandidate.N, quota, originalRegions),
  ]);
  const visitedCanonical = new Set([
    makeCanonicalRegionSig('starDouble', normalizedCandidate.N, quota, originalRegions),
  ]);
  const search = {
    solverCalls: 1,
    analyzerCalls: 2,
    replayCalls: 1,
    attemptedMutations: 0,
    legalStatesEvaluated: 0,
    exactDuplicateStates: 0,
    d4DuplicateStates: 0,
    invalidMutations: 0,
    invalidReasonCounts: {},
    classificationCounts: emptyClassificationCounts(),
    tiers: [],
  };
  const rejectedSamples = [];
  let frontier = [{ regions: [...originalRegions], history: [], evaluation: best.evaluation }];
  let previousDepth = 0;
  let stopReason = 'tier-budget-exhausted';

  for (const tier of tiers) {
    const tierStats = {
      tier: tier.tier,
      maxMovedCells: tier.maxMovedCells,
      maxLegalStates: tier.maxLegalStates,
      entered: true,
      legalStatesEvaluated: 0,
      attemptedMutations: 0,
      invalidMutations: 0,
      exactDuplicateStates: 0,
      d4DuplicateStates: 0,
      solverCalls: 0,
      analyzerCalls: 0,
      classificationCounts: emptyClassificationCounts(),
      bestObjectiveBefore: makeOptimizerObjective(best.evaluation.summary),
      bestObjectiveAfter: null,
      stopReason: null,
    };
    const depthCount = tier.maxMovedCells - previousDepth;
    const perDepthBudget = Math.max(1, Math.ceil(tier.maxLegalStates / depthCount));
    const beamWidth = options.beamWidth || 12;

    for (let depth = previousDepth + 1; depth <= tier.maxMovedCells; depth++) {
      if (frontier.length === 0 || tierStats.legalStatesEvaluated >= tier.maxLegalStates) break;
      const nextStates = [];
      let depthLegalStates = 0;
      const orderedFrontier = [...frontier].sort((a, b) =>
        compareOptimizerObjectives(b.evaluation.summary, a.evaluation.summary)
          || stableJson(a.history).localeCompare(stableJson(b.history)));

      candidateLoop:
      for (const state of orderedFrontier) {
        for (const move of enumerateBoundaryMoves(state, normalizedCandidate.N, zone.cells)) {
          if (depthLegalStates >= perDepthBudget
              || tierStats.legalStatesEvaluated >= tier.maxLegalStates) {
            break candidateLoop;
          }
          search.attemptedMutations++;
          tierStats.attemptedMutations++;
          const next = applyOptimizerMove(state, move);
          const exactSignature = makeRegionSig(
            'starDouble',
            normalizedCandidate.N,
            quota,
            next.regions,
          );
          if (visitedExact.has(exactSignature)) {
            search.exactDuplicateStates++;
            tierStats.exactDuplicateStates++;
            continue;
          }
          visitedExact.add(exactSignature);
          const canonicalSignature = makeCanonicalRegionSig(
            'starDouble',
            normalizedCandidate.N,
            quota,
            next.regions,
          );
          if (visitedCanonical.has(canonicalSignature)) {
            search.d4DuplicateStates++;
            tierStats.d4DuplicateStates++;
            continue;
          }
          visitedCanonical.add(canonicalSignature);

          const mutatedCandidate = {
            ...normalizedCandidate,
            candidateId: `${normalizedCandidate.candidateId || 'candidate'}-optimizer-t${tier.tier}-d${depth}`,
            regions: next.regions,
          };
          const legality = validateOptimizerMutation(
            mutatedCandidate,
            originalRegions,
            zone.cells,
            next.history,
          );
          if (!legality.valid) {
            search.invalidMutations++;
            tierStats.invalidMutations++;
            search.classificationCounts[REGION_OPTIMIZER_CLASSIFICATION.INVALID_MUTATION]++;
            tierStats.classificationCounts[REGION_OPTIMIZER_CLASSIFICATION.INVALID_MUTATION]++;
            for (const error of legality.errors) {
              const reason = error.split(':')[0];
              search.invalidReasonCounts[reason] = (search.invalidReasonCounts[reason] || 0) + 1;
            }
            if (rejectedSamples.length < 12) {
              rejectedSamples.push({
                classification: REGION_OPTIMIZER_CLASSIFICATION.INVALID_MUTATION,
                history: next.history,
                errors: legality.errors,
              });
            }
            continue;
          }

          depthLegalStates++;
          tierStats.legalStatesEvaluated++;
          search.legalStatesEvaluated++;
          search.solverCalls++;
          tierStats.solverCalls++;
          const evaluation = evaluateUniqueCandidate(
            mutatedCandidate,
            originalSummary,
            originalEvaluation.analysis,
            originalRegions,
            next.history,
            dependencies,
          );
          search.classificationCounts[evaluation.classification]++;
          tierStats.classificationCounts[evaluation.classification]++;
          if (evaluation.analysis) {
            search.analyzerCalls++;
            search.replayCalls++;
            tierStats.analyzerCalls++;
          }
          if (evaluation.classification === REGION_OPTIMIZER_CLASSIFICATION.NON_UNIQUE) {
            if (rejectedSamples.length < 12) {
              rejectedSamples.push({
                classification: evaluation.classification,
                history: next.history,
                solverStatus: evaluation.uniquenessResult?.status,
              });
            }
            continue;
          }

          const evaluatedState = { ...next, evaluation };
          nextStates.push(evaluatedState);
          if (compareOptimizerObjectives(evaluation.summary, best.evaluation.summary) > 0) {
            best = evaluatedState;
            objectiveHistory.push({
              tier: tier.tier,
              depth,
              classification: evaluation.classification,
              objective: makeOptimizerObjective(evaluation.summary),
              summary: evaluation.summary,
              mutationHistory: next.history,
            });
          }
          if (evaluation.classification === REGION_OPTIMIZER_CLASSIFICATION.FULLY_SOLVED) {
            stopReason = 'fully-solved';
            break candidateLoop;
          }
        }
      }

      frontier = nextStates
        .sort((a, b) =>
          compareOptimizerObjectives(b.evaluation.summary, a.evaluation.summary)
            || stableJson(a.history).localeCompare(stableJson(b.history)))
        .slice(0, beamWidth);
      if (stopReason === 'fully-solved') break;
    }

    tierStats.bestObjectiveAfter = makeOptimizerObjective(best.evaluation.summary);
    if (stopReason === 'fully-solved') {
      tierStats.stopReason = stopReason;
      search.tiers.push(tierStats);
      break;
    }
    if (tier.tier === 1 && !isNoticeableImprovement(originalSummary, best.evaluation.summary)) {
      stopReason = 'tier-1-no-noticeable-improvement';
      tierStats.stopReason = stopReason;
      search.tiers.push(tierStats);
      break;
    }
    if (tier.tier === 2 && !isSignificantImprovement(originalSummary, best.evaluation.summary)) {
      stopReason = 'tier-2-no-significant-improvement';
      tierStats.stopReason = stopReason;
      search.tiers.push(tierStats);
      break;
    }
    tierStats.stopReason = 'continue';
    search.tiers.push(tierStats);
    previousDepth = tier.maxMovedCells;
    if (frontier.length === 0) {
      stopReason = 'search-frontier-exhausted';
      break;
    }
  }

  const bestEvaluation = best.evaluation;
  const isFullySolved =
    bestEvaluation.classification === REGION_OPTIMIZER_CLASSIFICATION.FULLY_SOLVED;
  const sequenceEligible = isFullySolved
    && bestEvaluation.summary.uniqueSafeReplay
    && Boolean(bestEvaluation.reasoningFingerprint?.experience?.normalizedFingerprint)
    && Boolean(makeRegionSig('starDouble', normalizedCandidate.N, quota, best.regions))
    && Boolean(makeCanonicalRegionSig('starDouble', normalizedCandidate.N, quota, best.regions));
  if (sequenceEligible) {
    search.classificationCounts[REGION_OPTIMIZER_CLASSIFICATION.SEQUENCE_ELIGIBLE]++;
  }
  const finalStatus = sequenceEligible
    ? REGION_OPTIMIZER_CLASSIFICATION.SEQUENCE_ELIGIBLE
    : bestEvaluation.classification;
  const movedCells = [...new Set(best.history.map(move => move.cell))].sort((a, b) => a - b);
  const optimizedSolution = bestEvaluation.uniquenessResult?.solutions?.[0]
    || normalizedCandidate.solution;

  return {
    optimizerVersion: REGION_OPTIMIZER_VERSION,
    candidateId: normalizedCandidate.candidateId || 'unknown',
    originalAnalysis: originalEvaluation.analysis,
    optimizedAnalysis: bestEvaluation.analysis || originalEvaluation.analysis,
    originalSummary,
    optimizedSummary: bestEvaluation.summary,
    originalRegions: [...originalRegions],
    optimizedRegions: [...best.regions],
    movedCells,
    mutationHistory: best.history,
    objectiveHistory,
    uniquenessResult: bestEvaluation.uniquenessResult || originalSolver,
    reasoningFingerprint:
      bestEvaluation.reasoningFingerprint || originalEvaluation.reasoningFingerprint,
    signatures: {
      exactSolution: makeSolutionSig(
        'starDouble',
        normalizedCandidate.N,
        quota,
        optimizedSolution,
      ),
      d4Solution: makeCanonicalSolutionSig(
        'starDouble',
        normalizedCandidate.N,
        quota,
        optimizedSolution,
      ),
      exactRegion: makeRegionSig(
        'starDouble',
        normalizedCandidate.N,
        quota,
        best.regions,
      ),
      d4Region: makeCanonicalRegionSig(
        'starDouble',
        normalizedCandidate.N,
        quota,
        best.regions,
      ),
    },
    mutationDependence: {
      newDeductionCount: bestEvaluation.summary.newDeductionCount,
      mutationDependentDeductionCount:
        bestEvaluation.summary.mutationDependentDeductionCount,
      mutationDependentEventIds: bestEvaluation.summary.mutationDependentEventIds,
      mutationDependentWaveCount: bestEvaluation.summary.mutationDependentWaveCount,
      immediateStall: bestEvaluation.summary.immediateStall,
    },
    classification: bestEvaluation.classification,
    finalStatus,
    sequenceEligible,
    stopReason,
    stall: {
      status: stall.status,
      phase: stall.phase,
      completionRatio: stall.completionRatio,
      stallWave: stall.stallWave,
      lastWaveIndex: stall.lastWaveIndex,
      lastEvent: stall.lastEvent,
      mostConstrainedUnits: stall.mostConstrainedUnits,
      closestRuleStructures: stall.closestRuleStructures,
      finalStateHash: stall.finalStateHash,
    },
    zone,
    search: {
      ...search,
      visitedExactStates: visitedExact.size,
      visitedD4States: visitedCanonical.size,
      rejectedSamples,
      durationMs: Number((performance.now() - startedAt).toFixed(3)),
    },
  };
}
