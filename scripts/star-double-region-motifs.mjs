import { solveStarLine } from './starLineSolver.mjs';
import { analyzeDoubleStarCandidate } from './star-double-quality.mjs';

export const REGION_MOTIF_VERSION = 'star-double-region-motif-0.1.0';

export const REGION_MOTIF_TYPE = Object.freeze({
  MULTI_UNIT_CONFINEMENT_MOTIF: 'MULTI_UNIT_CONFINEMENT_MOTIF',
  PRESSURED_GROUP_MOTIF: 'PRESSURED_GROUP_MOTIF',
});

export const REGION_MOTIF_LIMITS = Object.freeze({
  maxChangedCells: 4,
  maxVariantsPerMotif: 2,
  maxStatesExaminedPerMotif: 800,
  maxQueuedStatesPerMotif: 4_000,
  maxSolverChecksPerMotif: 24,
  pressuredCandidateCount: 8,
  pressuredGroupSize: 4,
});

const TECHNIQUE_BY_MOTIF = Object.freeze({
  [REGION_MOTIF_TYPE.MULTI_UNIT_CONFINEMENT_MOTIF]: 'MULTI_UNIT_CONFINEMENT',
  [REGION_MOTIF_TYPE.PRESSURED_GROUP_MOTIF]: 'PRESSURED_GROUP_EXCLUSION',
});

function orthogonalNeighbors(cell, N) {
  const row = Math.floor(cell / N);
  const col = cell % N;
  const neighbors = [];
  for (const [dr, dc] of [[-1, 0], [0, -1], [0, 1], [1, 0]]) {
    const nextRow = row + dr;
    const nextCol = col + dc;
    if (nextRow >= 0 && nextRow < N && nextCol >= 0 && nextCol < N) {
      neighbors.push(nextRow * N + nextCol);
    }
  }
  return neighbors.sort((a, b) => a - b);
}

function cellsConflict(first, second, N) {
  const firstRow = Math.floor(first / N);
  const firstCol = first % N;
  const secondRow = Math.floor(second / N);
  const secondCol = second % N;
  return Math.abs(firstRow - secondRow) <= 1
    && Math.abs(firstCol - secondCol) <= 1;
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
  if (first.length !== second.length) return false;
  const orderedFirst = [...first].sort((a, b) => a - b);
  const orderedSecond = [...second].sort((a, b) => a - b);
  return orderedFirst.every((cell, index) => cell === orderedSecond[index]);
}

export function validateRegionMotifCandidate(candidate, originalSolution = candidate?.solution) {
  const errors = [];
  const { N, regions } = candidate || {};
  if (!Number.isInteger(N) || N < 2) errors.push('invalid-board-size');
  if (!Array.isArray(regions) || regions.length !== N * N) errors.push('invalid-region-length');
  if (!Array.isArray(originalSolution) || originalSolution.length !== N * 2) {
    errors.push('invalid-solution-length');
  }
  if (errors.length > 0) return { valid: false, errors };

  const regionIds = [...new Set(regions)].sort((a, b) => a - b);
  if (regionIds.length !== N) errors.push('region-count-changed');
  for (const regionId of regionIds) {
    if (!isConnected(regions, N, regionId)) errors.push(`region-not-connected:${regionId}`);
  }

  const solutionSet = new Set(originalSolution);
  for (const regionId of regionIds) {
    const starCount = regions.reduce((count, value, cell) =>
      count + (value === regionId && solutionSet.has(cell) ? 1 : 0), 0);
    if (starCount !== 2) errors.push(`region-solution-quota:${regionId}:${starCount}`);
  }

  return { valid: errors.length === 0, errors };
}

function unitCells(N, kind, index) {
  if (kind === 'row') {
    return Array.from({ length: N }, (_, col) => index * N + col);
  }
  return Array.from({ length: N }, (_, row) => row * N + index);
}

function detectMultiUnitWitnesses(regions, N) {
  const witnesses = [];
  for (const sourceKind of ['row', 'col']) {
    for (let first = 0; first < N; first++) {
      for (let second = first + 1; second < N; second++) {
        const sourceCells = [
          ...unitCells(N, sourceKind, first),
          ...unitCells(N, sourceKind, second),
        ].sort((a, b) => a - b);
        const targetRegions = [...new Set(sourceCells.map(cell => regions[cell]))]
          .sort((a, b) => a - b);
        if (targetRegions.length !== 2) continue;
        const sourceSet = new Set(sourceCells);
        const externalCells = [];
        for (let cell = 0; cell < regions.length; cell++) {
          if (targetRegions.includes(regions[cell]) && !sourceSet.has(cell)) {
            externalCells.push(cell);
          }
        }
        for (const targetCell of externalCells) {
          witnesses.push({
            technique: 'MULTI_UNIT_CONFINEMENT',
            action: 'eliminate',
            targetCell,
            sourceUnits: [`${sourceKind}:${first}`, `${sourceKind}:${second}`],
            targetUnits: targetRegions.map(regionId => `region:${regionId}`),
            sourceCells,
            targetExternalCells: externalCells,
          });
        }
      }
    }
  }
  return witnesses.sort((a, b) =>
    a.targetCell - b.targetCell
      || a.sourceUnits.join(',').localeCompare(b.sourceUnits.join(',')));
}

function cliqueConflictProof(cells, N) {
  const conflicts = [];
  for (let first = 0; first < cells.length; first++) {
    for (let second = first + 1; second < cells.length; second++) {
      if (!cellsConflict(cells[first], cells[second], N)) return null;
      conflicts.push([cells[first], cells[second]]);
    }
  }
  return conflicts;
}

function canonicalCliqueCovers(candidates, N) {
  if (candidates.length < 2 || candidates.length > REGION_MOTIF_LIMITS.pressuredCandidateCount) {
    return [];
  }
  const rest = candidates.slice(1);
  const covers = [];
  for (let mask = 0; mask < 2 ** rest.length; mask++) {
    const groupA = [candidates[0]];
    const groupB = [];
    for (let bit = 0; bit < rest.length; bit++) {
      if ((mask & (1 << bit)) !== 0) groupA.push(rest[bit]);
      else groupB.push(rest[bit]);
    }
    if (groupB.length === 0
        || groupA.length > REGION_MOTIF_LIMITS.pressuredGroupSize
        || groupB.length > REGION_MOTIF_LIMITS.pressuredGroupSize) {
      continue;
    }
    const groupAConflicts = cliqueConflictProof(groupA, N);
    const groupBConflicts = cliqueConflictProof(groupB, N);
    if (!groupAConflicts || !groupBConflicts) continue;
    covers.push({ groupA, groupB, groupAConflicts, groupBConflicts });
  }
  return covers.sort((a, b) =>
    JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function detectPressuredGroupWitnesses(regions, N) {
  const witnesses = [];
  const regionIds = [...new Set(regions)].sort((a, b) => a - b);
  for (const regionId of regionIds) {
    const candidateSet = [];
    for (let cell = 0; cell < regions.length; cell++) {
      if (regions[cell] === regionId) candidateSet.push(cell);
    }
    const covers = canonicalCliqueCovers(candidateSet, N);
    for (const cover of covers) {
      for (const [group, groupName] of [
        [cover.groupA, 'groupA'],
        [cover.groupB, 'groupB'],
      ]) {
        for (let targetCell = 0; targetCell < regions.length; targetCell++) {
          if (regions[targetCell] === regionId) continue;
          if (!group.every(cell => cellsConflict(cell, targetCell, N))) continue;
          witnesses.push({
            technique: 'PRESSURED_GROUP_EXCLUSION',
            action: 'eliminate',
            targetCell,
            sourceUnit: `region:${regionId}`,
            candidateSet,
            groupA: cover.groupA,
            groupB: cover.groupB,
            groupInternalConflictProof: {
              groupA: cover.groupAConflicts,
              groupB: cover.groupBConflicts,
            },
            targetGroup: groupName,
          });
        }
      }
    }
  }
  const unique = new Map();
  for (const witness of witnesses) {
    const key = `${witness.targetCell}:${witness.sourceUnit}`;
    if (!unique.has(key)) unique.set(key, witness);
  }
  return [...unique.values()].sort((a, b) =>
    a.targetCell - b.targetCell
      || a.sourceUnit.localeCompare(b.sourceUnit));
}

export function detectRegionMotifWitnesses(regions, N, motifType) {
  if (motifType === REGION_MOTIF_TYPE.MULTI_UNIT_CONFINEMENT_MOTIF) {
    return detectMultiUnitWitnesses(regions, N);
  }
  if (motifType === REGION_MOTIF_TYPE.PRESSURED_GROUP_MOTIF) {
    return detectPressuredGroupWitnesses(regions, N);
  }
  throw new Error(`unsupported motif type: ${motifType}`);
}

function eventSignature(event) {
  return `${event.technique}:${event.action}:${(event.affectedCells || []).join(',')}`;
}

function completionRatio(report) {
  const state = report.humanLogic?.finalState || [];
  if (state.length === 0) return 0;
  return state.filter(value => value !== 'U').length / state.length;
}

function countDependentEvents(analysis, intendedEvent) {
  const dependentIds = new Set([intendedEvent.id]);
  let count = 0;
  for (const event of analysis.canonicalPath || []) {
    if (event.id === intendedEvent.id) continue;
    if ((event.prerequisiteEvents || []).some(id => dependentIds.has(id))) {
      dependentIds.add(event.id);
      count++;
    }
  }
  return count;
}

function playerProof(event) {
  const proof = event.proof || {};
  if (event.technique === 'MULTI_UNIT_CONFINEMENT') {
    return `两组单位都还需要 ${proof.capacityEquality?.sourceRemainingQuotaTotal ?? 4} 颗星，`
      + `而来源单位的所有候选都落在目标区域中，所以目标区域的格 ${event.affectedCells[0]} 可以排除。`;
  }
  const targetGroup = proof[proof.targetGroup] || [];
  return `这个单位还需要 2 颗星，候选被分成两个各最多容纳一颗星的冲突组；`
    + `格 ${event.affectedCells[0]} 与组 ${targetGroup.join(',')} 的所有候选冲突，所以可以排除。`;
}

function changedCellList(originalRegions, mutatedRegions) {
  const changed = [];
  for (let cell = 0; cell < originalRegions.length; cell++) {
    if (originalRegions[cell] !== mutatedRegions[cell]) {
      changed.push({
        cell,
        fromRegion: originalRegions[cell],
        toRegion: mutatedRegions[cell],
      });
    }
  }
  return changed;
}

function legalBoundaryMoves(state, originalRegions, solutionSet, N) {
  const moves = [];
  const modifiedSet = new Set(state.modifiedCells);
  for (let cell = 0; cell < state.regions.length; cell++) {
    if (solutionSet.has(cell) || modifiedSet.has(cell)) continue;
    if (modifiedSet.size > 0
        && !orthogonalNeighbors(cell, N).some(neighbor => modifiedSet.has(neighbor))) {
      continue;
    }
    const donor = state.regions[cell];
    const receivers = [...new Set(orthogonalNeighbors(cell, N)
      .map(neighbor => state.regions[neighbor])
      .filter(regionId => regionId !== donor))]
      .sort((a, b) => a - b);
    for (const receiver of receivers) {
      const nextRegions = [...state.regions];
      nextRegions[cell] = receiver;
      if (!isConnected(nextRegions, N, donor) || !isConnected(nextRegions, N, receiver)) continue;
      const changed = changedCellList(originalRegions, nextRegions);
      if (changed.length === 0 || changed.length > REGION_MOTIF_LIMITS.maxChangedCells) continue;
      moves.push({
        cell,
        fromRegion: donor,
        toRegion: receiver,
        regions: nextRegions,
        modifiedCells: changed.map(item => item.cell),
      });
    }
  }
  return moves.sort((a, b) =>
    a.cell - b.cell || a.toRegion - b.toRegion || a.fromRegion - b.fromRegion);
}

function actualIntendedEvent(report, technique, witnesses, originalSignatures) {
  const witnessCells = new Set(witnesses.map(witness => witness.targetCell));
  for (const wave of report.humanLogic?.deductionWaves || []) {
    if (wave.index > 1) break;
    for (const event of wave.events || []) {
      if (event.action !== 'eliminate'
          || !witnessCells.has(event.affectedCells?.[0])
          || originalSignatures.has(eventSignature(event))) {
        continue;
      }
      if (event.technique === technique) return { event, wave: wave.index, bypassed: false };
      if (event.supportingTechniques?.includes(technique)) {
        return { event, wave: wave.index, bypassed: true };
      }
    }
  }
  return null;
}

export function generateRegionMotifVariants(candidate, motifType, options = {}) {
  const technique = TECHNIQUE_BY_MOTIF[motifType];
  if (!technique) throw new Error(`unsupported motif type: ${motifType}`);

  const limits = {
    ...REGION_MOTIF_LIMITS,
    ...options.limits,
  };
  const baseValidation = validateRegionMotifCandidate(candidate);
  if (!baseValidation.valid) {
    return {
      motifVersion: REGION_MOTIF_VERSION,
      motifType,
      candidateId: candidate.candidateId,
      variants: [],
      search: { stopped: 'invalid-source', errors: baseValidation.errors },
    };
  }

  const originalReport = options.originalReport || analyzeDoubleStarCandidate(candidate);
  const originalSignatures = new Set((originalReport.humanLogic?.canonicalPath || [])
    .map(eventSignature));
  const solutionSet = new Set(candidate.solution);
  const queue = [{
    regions: [...candidate.regions],
    modifiedCells: [],
    moves: [],
  }];
  const seen = new Set([candidate.regions.join(',')]);
  const variants = [];
  const seenVariantRegions = new Set();
  const search = {
    statesExamined: 0,
    statesQueued: 1,
    solverChecks: 0,
    structuralWitnessStates: 0,
    uniquePreserved: 0,
    invalidLegality: 0,
    solverRejected: 0,
    declaredSolutionMismatch: 0,
    intendedEventMissing: 0,
    bypassedByBasicRule: 0,
    duplicateVariantRegion: 0,
    budgetReached: false,
  };

  let queueIndex = 0;
  while (queueIndex < queue.length
      && search.statesExamined < limits.maxStatesExaminedPerMotif
      && variants.length < limits.maxVariantsPerMotif) {
    const state = queue[queueIndex++];
    if (state.modifiedCells.length >= limits.maxChangedCells) continue;
    const moves = legalBoundaryMoves(state, candidate.regions, solutionSet, candidate.N);
    for (const move of moves) {
      if (search.statesExamined >= limits.maxStatesExaminedPerMotif
          || variants.length >= limits.maxVariantsPerMotif) break;
      const regionKey = move.regions.join(',');
      if (seen.has(regionKey)) continue;
      seen.add(regionKey);
      search.statesExamined++;

      const nextState = {
        regions: move.regions,
        modifiedCells: move.modifiedCells,
        moves: [...state.moves, {
          cell: move.cell,
          fromRegion: move.fromRegion,
          toRegion: move.toRegion,
        }],
      };
      const witnesses = detectRegionMotifWitnesses(move.regions, candidate.N, motifType)
        .filter(witness => !originalSignatures.has(
          `${technique}:eliminate:${witness.targetCell}`,
        ));
      if (witnesses.length > 0) {
        search.structuralWitnessStates++;
        if (search.solverChecks < limits.maxSolverChecksPerMotif) {
          search.solverChecks++;
          const mutatedCandidate = {
            ...candidate,
            candidateId: `${candidate.candidateId}-${motifType.toLowerCase()}-${search.solverChecks}`,
            regions: move.regions,
            solution: [...candidate.solution],
            motif: {
              version: REGION_MOTIF_VERSION,
              type: motifType,
              sourceCandidateId: candidate.candidateId,
            },
          };
          const legality = validateRegionMotifCandidate(mutatedCandidate, candidate.solution);
          if (!legality.valid) {
            search.invalidLegality++;
          } else {
            const report = analyzeDoubleStarCandidate(mutatedCandidate);
            if (report.solver?.status !== 'unique') {
              search.solverRejected++;
            } else if (!report.declaredSolutionMatchesSolver
                || !sameCellSet(candidate.solution, mutatedCandidate.solution)) {
              search.declaredSolutionMismatch++;
            } else {
              search.uniquePreserved++;
              const intended = actualIntendedEvent(
                report,
                technique,
                witnesses,
                originalSignatures,
              );
              if (!intended) {
                search.intendedEventMissing++;
              } else if (intended.bypassed) {
                search.bypassedByBasicRule++;
              } else if (seenVariantRegions.has(report.canonicalRegionSignature)) {
                search.duplicateVariantRegion++;
              } else {
                seenVariantRegions.add(report.canonicalRegionSignature);
                const intendedWitness = witnesses.find(witness =>
                  witness.targetCell === intended.event.affectedCells[0]) || witnesses[0];
                const dependentDeductionCount =
                  countDependentEvents(report.humanLogic, intended.event);
                variants.push({
                  candidate: mutatedCandidate,
                  report,
                  originalRegions: [...candidate.regions],
                  mutatedRegions: [...move.regions],
                  changedCells: changedCellList(candidate.regions, move.regions),
                  moves: nextState.moves,
                  intendedTechnique: technique,
                  intendedWitness,
                  intendedEvent: intended.event,
                  intendedEventWave: intended.wave,
                  intendedEventUsedInPropagation: dependentDeductionCount > 0,
                  deductionsDependingOnIntendedEvent: dependentDeductionCount,
                  eventTriggered: true,
                  propagationGain: dependentDeductionCount > 0,
                  fullySolved:
                    report.humanLogic?.status === 'SOLVED_SUPPORTED_RULES',
                  originalCompletionRatio: completionRatio(originalReport),
                  mutatedCompletionRatio: completionRatio(report),
                  completionRatioGain:
                    Number((completionRatio(report) - completionRatio(originalReport)).toFixed(4)),
                  originalTrace: originalReport.humanLogic,
                  mutatedTrace: report.humanLogic,
                  normalizedReasoningFingerprint:
                    report.reasoningFingerprint?.experience?.normalizedFingerprint,
                  playerProof: playerProof(intended.event),
                });
              }
            }
          }
        }
      }

      if (nextState.modifiedCells.length < limits.maxChangedCells
          && queue.length < limits.maxQueuedStatesPerMotif) {
        queue.push(nextState);
        search.statesQueued++;
      }
    }
  }

  search.budgetReached = search.statesExamined >= limits.maxStatesExaminedPerMotif
    || search.solverChecks >= limits.maxSolverChecksPerMotif
    || queue.length >= limits.maxQueuedStatesPerMotif;
  search.stopped = variants.length >= limits.maxVariantsPerMotif
    ? 'variant-limit'
    : search.budgetReached
      ? 'search-budget'
      : 'search-exhausted';

  return {
    motifVersion: REGION_MOTIF_VERSION,
    motifType,
    intendedTechnique: technique,
    candidateId: candidate.candidateId,
    limits,
    variants,
    search,
  };
}

export function verifyRegionMotifVariant(variant) {
  const errors = [];
  const legality = validateRegionMotifCandidate(
    variant.candidate,
    variant.candidate.solution,
  );
  errors.push(...legality.errors);
  if (variant.changedCells.length > REGION_MOTIF_LIMITS.maxChangedCells) {
    errors.push('changed-cell-limit');
  }
  if (variant.intendedEventWave > 1) errors.push('intended-event-too-late');
  if (!variant.eventTriggered) errors.push('intended-event-not-triggered');
  if (variant.report.solver?.status !== 'unique') errors.push('solver-not-unique');
  if (!variant.report.declaredSolutionMatchesSolver) errors.push('declared-solution-mismatch');
  if (variant.report.traceReplay?.ok !== true) errors.push('trace-replay-failed');
  if ((variant.report.humanLogic?.solutionConsistencyErrors || []).length > 0) {
    errors.push('unsafe-deduction');
  }
  return { valid: errors.length === 0, errors };
}

export function revalidateRegionMotifWithSolver(candidate) {
  const result = solveStarLine(candidate.N, candidate.regions, {
    starsPerRow: 2,
    starsPerCol: 2,
    starsPerRegion: 2,
  });
  return {
    status: result.status,
    solution: result.solutions?.[0] || null,
    declaredSolutionMatches:
      result.status === 'UNIQUE' && sameCellSet(candidate.solution, result.solutions[0]),
  };
}
