/**
 * Star Double proof engine.
 *
 * Proofs are derived only from the current board, regions and quota. The
 * engine never reads solution/revealPath/canonicalPath.
 */

export const STAR_DOUBLE_PROOF_TECHNIQUE = Object.freeze({
  QUOTA_SATURATED: 'quota-saturated',
  ADJACENCY_EXCLUSION: 'adjacency-exclusion',
  REMAINING_CAPACITY: 'remaining-capacity',
  CONFINED_CAPACITY: 'confined-capacity',
  TWO_BY_TWO_CAPACITY: 'two-by-two-capacity',
  MULTI_UNIT_INTERSECTION: 'multi-unit-intersection',
  COMMON_CONFLICT: 'common-conflict',
});

const TECHNIQUE_PRIORITY = Object.freeze({
  [STAR_DOUBLE_PROOF_TECHNIQUE.QUOTA_SATURATED]: 10,
  [STAR_DOUBLE_PROOF_TECHNIQUE.ADJACENCY_EXCLUSION]: 20,
  [STAR_DOUBLE_PROOF_TECHNIQUE.REMAINING_CAPACITY]: 30,
  [STAR_DOUBLE_PROOF_TECHNIQUE.CONFINED_CAPACITY]: 40,
  [STAR_DOUBLE_PROOF_TECHNIQUE.TWO_BY_TWO_CAPACITY]: 50,
  [STAR_DOUBLE_PROOF_TECHNIQUE.MULTI_UNIT_INTERSECTION]: 60,
  [STAR_DOUBLE_PROOF_TECHNIQUE.COMMON_CONFLICT]: 70,
});

const UNIT_KIND_PRIORITY = Object.freeze({ row: 10, col: 20, region: 30, block: 40 });
const MULTI_UNIT_SEARCH_LIMIT = 20_000;
const COMMON_CONFLICT_CANDIDATE_LIMIT = 8;
const COMMON_CONFLICT_PARTITION_LIMIT = 128;

function sortedUnique(cells) {
  return [...new Set(cells || [])].sort((a, b) => a - b);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => (
      `${JSON.stringify(key)}:${stableJson(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}

function eightNeighbors(idx, N) {
  const row = Math.floor(idx / N);
  const col = idx % N;
  const cells = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const nextRow = row + dr;
      const nextCol = col + dc;
      if (nextRow >= 0 && nextRow < N && nextCol >= 0 && nextCol < N) {
        cells.push(nextRow * N + nextCol);
      }
    }
  }
  return cells.sort((a, b) => a - b);
}

function readState(gridData) {
  return gridData.map(cell => (
    cell?.isStarred ? 'S' : cell?.isMarkedX ? 'X' : 'U'
  ));
}

function hashState(state) {
  const signature = state.join('');
  let hash = 2166136261;
  for (let index = 0; index < signature.length; index += 1) {
    hash ^= signature.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function getStarDoubleBoardStateHash(gridData) {
  return hashState(readState(gridData));
}

function buildContext(level, gridData) {
  const N = level.N || level.boardSize || 8;
  const regions = level.regions;
  const quota = level.starsPerRow ?? level.starsPerCol ?? level.starsPerRegion ?? 2;
  const state = readState(gridData);
  const rows = Array.from({ length: N }, (_, index) => ({
    kind: 'row',
    index,
    key: `row:${index}`,
    cells: Array.from({ length: N }, (_, col) => index * N + col),
  }));
  const cols = Array.from({ length: N }, (_, index) => ({
    kind: 'col',
    index,
    key: `col:${index}`,
    cells: Array.from({ length: N }, (_, row) => row * N + index),
  }));
  const regionIds = sortedUnique(regions);
  const regionUnits = regionIds.map(index => ({
    kind: 'region',
    index,
    key: `region:${index}`,
    cells: regions.map((regionId, cell) => (regionId === index ? cell : -1))
      .filter(cell => cell >= 0),
  }));
  const units = [...rows, ...cols, ...regionUnits];
  const cellUnits = Array.from({ length: N * N }, () => []);
  for (const unit of units) {
    for (const cell of unit.cells) cellUnits[cell].push(unit);
  }
  const blocks = [];
  for (let row = 0; row < N - 1; row += 1) {
    for (let col = 0; col < N - 1; col += 1) {
      blocks.push({
        kind: 'block',
        key: `block:${row}:${col}`,
        cells: [row * N + col, row * N + col + 1, (row + 1) * N + col, (row + 1) * N + col + 1],
      });
    }
  }
  const neighbors = Array.from({ length: N * N }, (_, cell) => eightNeighbors(cell, N));
  return {
    N,
    regions,
    quota,
    state,
    boardStateHash: hashState(state),
    units,
    cellUnits,
    blocks,
    neighbors,
  };
}

function isCandidate(context, cell) {
  if (context.state[cell] !== 'U') return false;
  if (context.neighbors[cell].some(neighbor => context.state[neighbor] === 'S')) return false;
  return context.cellUnits[cell].every(unit => (
    unit.cells.filter(index => context.state[index] === 'S').length < context.quota
  ));
}

function unitStats(context, unit) {
  const stars = unit.cells.filter(cell => context.state[cell] === 'S');
  const unknown = unit.cells.filter(cell => context.state[cell] === 'U');
  const candidates = unknown.filter(cell => isCandidate(context, cell));
  return {
    stars,
    unknown,
    candidates,
    remaining: context.quota - stars.length,
  };
}

function createProof(context, proof) {
  return {
    ...proof,
    involvedUnits: [...new Set(proof.involvedUnits || [])],
    observationCells: sortedUnique(proof.observationCells),
    evidenceCells: sortedUnique(proof.evidenceCells),
    derivedTargets: sortedUnique(proof.derivedTargets),
    boardStateHash: context.boardStateHash,
  };
}

function findAdjacencyProofs(context) {
  const proofs = [];
  for (let star = 0; star < context.state.length; star += 1) {
    if (context.state[star] !== 'S') continue;
    const fullNeighborSet = context.neighbors[star];
    const targets = fullNeighborSet.filter(cell => context.state[cell] === 'U');
    if (targets.length === 0) continue;
    proofs.push(createProof(context, {
      technique: STAR_DOUBLE_PROOF_TECHNIQUE.ADJACENCY_EXCLUSION,
      action: 'eliminate',
      premises: {
        starCell: star,
        maxChebyshevDistance: 1,
        fullNeighborSet,
      },
      involvedUnits: context.cellUnits[star].map(unit => unit.key),
      observationCells: [star, ...fullNeighborSet],
      evidenceCells: [star],
      derivedTargets: targets,
    }));
  }
  return proofs;
}

function findQuotaProofs(context) {
  const proofs = [];
  for (const unit of context.units) {
    const stats = unitStats(context, unit);
    if (stats.stars.length !== context.quota || stats.unknown.length === 0) continue;
    proofs.push(createProof(context, {
      technique: STAR_DOUBLE_PROOF_TECHNIQUE.QUOTA_SATURATED,
      action: 'eliminate',
      premises: {
        unit: unit.key,
        starCells: stats.stars,
        starCount: stats.stars.length,
        quota: context.quota,
      },
      involvedUnits: [unit.key],
      observationCells: unit.cells,
      evidenceCells: stats.stars,
      derivedTargets: stats.unknown,
    }));
  }
  return proofs;
}

function findRemainingProofs(context) {
  const proofs = [];
  for (const unit of context.units) {
    const stats = unitStats(context, unit);
    if (stats.remaining <= 0 || stats.candidates.length !== stats.remaining) continue;
    const excludedByKnownRules = stats.unknown.filter(cell => !stats.candidates.includes(cell));
    const adjacencyExcluded = excludedByKnownRules.filter(cell => (
      context.neighbors[cell].some(neighbor => context.state[neighbor] === 'S')
    ));
    const saturatedUnitExcluded = excludedByKnownRules.filter(cell => (
      context.cellUnits[cell].some(candidateUnit => (
        candidateUnit.cells.filter(index => context.state[index] === 'S').length >= context.quota
      ))
    ));
    const supportingRules = [
      ...(stats.stars.length > 0 ? ['one-star-quota'] : []),
      ...(adjacencyExcluded.length > 0 ? [STAR_DOUBLE_PROOF_TECHNIQUE.ADJACENCY_EXCLUSION] : []),
      ...(saturatedUnitExcluded.length > 0 ? [STAR_DOUBLE_PROOF_TECHNIQUE.QUOTA_SATURATED] : []),
      ...(unit.cells.some(cell => context.state[cell] === 'X') ? ['established-eliminations'] : []),
    ];
    proofs.push(createProof(context, {
      technique: STAR_DOUBLE_PROOF_TECHNIQUE.REMAINING_CAPACITY,
      action: 'place-star',
      premises: {
        unit: unit.key,
        quota: context.quota,
        existingStarCount: stats.stars.length,
        existingStarCells: stats.stars,
        remaining: stats.remaining,
        candidateCount: stats.candidates.length,
        candidateCells: stats.candidates,
        excludedByKnownRules,
        supportingRules: sortedUnique(supportingRules),
      },
      involvedUnits: [unit.key],
      observationCells: unit.cells,
      evidenceCells: [...stats.stars, ...excludedByKnownRules],
      derivedTargets: stats.candidates,
    }));
  }
  return proofs;
}

function cellsConflict(context, first, second) {
  return context.neighbors[first].includes(second);
}

function groupHasCapacityOne(context, cells) {
  if (cells.length === 0) return false;
  for (let first = 0; first < cells.length; first += 1) {
    for (let second = first + 1; second < cells.length; second += 1) {
      if (!cellsConflict(context, cells[first], cells[second])) return false;
    }
  }
  return true;
}

function findCapacityPartitions(context, candidates) {
  if (candidates.length < 2 || candidates.length > COMMON_CONFLICT_CANDIDATE_LIMIT) return [];
  const firstCell = candidates[0];
  const rest = candidates.slice(1);
  const partitions = [];
  const count = Math.min(2 ** rest.length, COMMON_CONFLICT_PARTITION_LIMIT);
  for (let mask = 0; mask < count; mask += 1) {
    const groupA = [firstCell];
    const groupB = [];
    for (let bit = 0; bit < rest.length; bit += 1) {
      if ((mask & (1 << bit)) !== 0) groupA.push(rest[bit]);
      else groupB.push(rest[bit]);
    }
    if (groupB.length === 0) continue;
    if (!groupHasCapacityOne(context, groupA) || !groupHasCapacityOne(context, groupB)) continue;
    partitions.push({ groupA: sortedUnique(groupA), groupB: sortedUnique(groupB) });
  }
  return partitions.sort((a, b) => stableJson(a).localeCompare(stableJson(b)));
}

function findTwoByTwoProofs(context) {
  const proofs = [];
  for (const unit of context.units) {
    const stats = unitStats(context, unit);
    if (stats.remaining < 1 || stats.remaining > 2 || stats.candidates.length === 0) continue;
    const candidateSet = new Set(stats.candidates);
    const eligibleBlocks = context.blocks.filter(block => (
      block.cells.every(cell => context.state[cell] !== 'S')
      && block.cells.some(cell => candidateSet.has(cell))
    ));

    const covers = [];
    if (stats.remaining === 1) {
      for (const block of eligibleBlocks) {
        if (stats.candidates.every(cell => block.cells.includes(cell))) covers.push([block]);
      }
    } else {
      for (let first = 0; first < eligibleBlocks.length; first += 1) {
        for (let second = first + 1; second < eligibleBlocks.length; second += 1) {
          const a = eligibleBlocks[first];
          const b = eligibleBlocks[second];
          if (a.cells.some(cell => b.cells.includes(cell))) continue;
          const union = new Set([...a.cells, ...b.cells]);
          if (stats.candidates.every(cell => union.has(cell))) covers.push([a, b]);
        }
      }
    }

    for (const cover of covers) {
      for (const block of cover) {
        const targets = block.cells.filter(cell => isCandidate(context, cell) && !candidateSet.has(cell));
        if (targets.length === 0) continue;
        proofs.push(createProof(context, {
          technique: STAR_DOUBLE_PROOF_TECHNIQUE.TWO_BY_TWO_CAPACITY,
          action: 'eliminate',
          premises: {
            sourceUnit: unit.key,
            quota: context.quota,
            sourceExistingStarCount: stats.stars.length,
            sourceRemainingQuota: stats.remaining,
            sourceCandidateCells: stats.candidates,
            blockCapacity: 1,
            coveringBlocks: cover.map(item => item.key),
            occupiedBlock: block.key,
          },
          involvedUnits: [unit.key, ...cover.map(item => item.key)],
          observationCells: [...unit.cells, ...cover.flatMap(item => item.cells)],
          evidenceCells: stats.candidates,
          derivedTargets: targets,
        }));
      }
    }

    // A unit needing two stars can be split into two groups that each fit at
    // most one star. A singleton group is therefore a forced star. This is the
    // place-star form of the 2×2 capacity lesson taught in Lv.1.
    if (stats.remaining === 2) {
      for (const partition of findCapacityPartitions(context, stats.candidates)) {
        for (const group of [partition.groupA, partition.groupB]) {
          if (group.length !== 1) continue;
          proofs.push(createProof(context, {
            technique: STAR_DOUBLE_PROOF_TECHNIQUE.TWO_BY_TWO_CAPACITY,
            action: 'place-star',
            premises: {
              sourceUnit: unit.key,
              quota: context.quota,
              sourceExistingStarCount: stats.stars.length,
              sourceRemainingQuota: 2,
              sourceCandidateCells: stats.candidates,
              capacityGroups: [partition.groupA, partition.groupB],
              forcedSingleton: group[0],
              groupCapacity: 1,
            },
            involvedUnits: [unit.key],
            observationCells: unit.cells,
            evidenceCells: stats.candidates.filter(cell => cell !== group[0]),
            derivedTargets: group,
          }));
        }
      }
    }
  }
  return proofs;
}

function findConfinedProofs(context) {
  const proofs = [];
  const statsByKey = new Map(context.units.map(unit => [unit.key, unitStats(context, unit)]));
  for (const source of context.units) {
    const sourceStats = statsByKey.get(source.key);
    if (sourceStats.remaining <= 0 || sourceStats.candidates.length === 0) continue;
    for (const target of context.units) {
      if (source.key === target.key || source.kind === target.kind) continue;
      const targetStats = statsByKey.get(target.key);
      if (sourceStats.remaining !== targetStats.remaining) continue;
      if (!sourceStats.candidates.every(cell => target.cells.includes(cell))) continue;
      const sourceCandidates = new Set(sourceStats.candidates);
      const targets = targetStats.candidates.filter(cell => !sourceCandidates.has(cell));
      if (targets.length === 0) continue;
      proofs.push(createProof(context, {
        technique: STAR_DOUBLE_PROOF_TECHNIQUE.CONFINED_CAPACITY,
        action: 'eliminate',
        premises: {
          sourceUnit: source.key,
          targetUnit: target.key,
          sourceRemainingQuota: sourceStats.remaining,
          targetRemainingQuota: targetStats.remaining,
          sourceCandidateCells: sourceStats.candidates,
          sourceCandidatesContainedByTarget: true,
        },
        involvedUnits: [source.key, target.key],
        observationCells: [...source.cells, ...target.cells],
        evidenceCells: sourceStats.candidates,
        derivedTargets: targets,
      }));
    }
  }
  return proofs;
}

function unitPairs(units) {
  const pairs = [];
  for (let first = 0; first < units.length; first += 1) {
    for (let second = first + 1; second < units.length; second += 1) {
      pairs.push([units[first], units[second]]);
    }
  }
  return pairs;
}

function findMultiUnitProofs(context) {
  const proofs = [];
  const statsByKey = new Map(context.units.map(unit => [unit.key, unitStats(context, unit)]));
  const byKind = new Map(['row', 'col', 'region'].map(kind => [
    kind,
    context.units.filter(unit => unit.kind === kind),
  ]));
  let evaluated = 0;

  outer:
  for (const sourceKind of ['row', 'col', 'region']) {
    for (const targetKind of ['row', 'col', 'region']) {
      if (sourceKind === targetKind) continue;
      for (const sourceUnits of unitPairs(byKind.get(sourceKind))) {
        const sourceStats = sourceUnits.map(unit => statsByKey.get(unit.key));
        if (sourceStats.some(stats => stats.remaining <= 0 || stats.candidates.length === 0)) continue;
        const sourceCandidates = sortedUnique(sourceStats.flatMap(stats => stats.candidates));
        const sourceRemaining = sourceStats.reduce((sum, stats) => sum + stats.remaining, 0);
        for (const targetUnits of unitPairs(byKind.get(targetKind))) {
          evaluated += 1;
          if (evaluated > MULTI_UNIT_SEARCH_LIMIT) break outer;
          const targetStats = targetUnits.map(unit => statsByKey.get(unit.key));
          if (targetStats.some(stats => stats.remaining <= 0)) continue;
          const targetRemaining = targetStats.reduce((sum, stats) => sum + stats.remaining, 0);
          if (sourceRemaining !== targetRemaining) continue;
          const targetCellUnion = new Set(targetUnits.flatMap(unit => unit.cells));
          if (!sourceCandidates.every(cell => targetCellUnion.has(cell))) continue;
          const sourceCandidateSet = new Set(sourceCandidates);
          const targetCandidates = sortedUnique(targetStats.flatMap(stats => stats.candidates));
          const targets = targetCandidates.filter(cell => !sourceCandidateSet.has(cell));
          if (targets.length === 0) continue;
          proofs.push(createProof(context, {
            technique: STAR_DOUBLE_PROOF_TECHNIQUE.MULTI_UNIT_INTERSECTION,
            action: 'eliminate',
            premises: {
              sourceUnits: sourceUnits.map(unit => unit.key),
              targetUnits: targetUnits.map(unit => unit.key),
              sourceCandidateCells: sourceCandidates,
              sourceRemainingQuotaTotal: sourceRemaining,
              targetRemainingQuotaTotal: targetRemaining,
              capacityEqual: true,
            },
            involvedUnits: [...sourceUnits, ...targetUnits].map(unit => unit.key),
            observationCells: [...sourceUnits, ...targetUnits].flatMap(unit => unit.cells),
            evidenceCells: sourceCandidates,
            derivedTargets: targets,
          }));
        }
      }
    }
  }
  return proofs;
}

function findCommonConflictProofs(context) {
  const proofs = [];
  const globalCandidates = context.state
    .map((_, cell) => (isCandidate(context, cell) ? cell : -1))
    .filter(cell => cell >= 0);

  for (const unit of context.units) {
    const stats = unitStats(context, unit);
    const evidenceGroups = [];
    if (stats.remaining === 1 && stats.candidates.length === 2) {
      evidenceGroups.push(stats.candidates);
    }
    if (stats.remaining === 2) {
      for (const partition of findCapacityPartitions(context, stats.candidates)) {
        for (const group of [partition.groupA, partition.groupB]) {
          if (group.length === 2) evidenceGroups.push(group);
        }
      }
    }

    for (const evidenceGroup of evidenceGroups) {
      const targets = globalCandidates.filter(target => (
        !unit.cells.includes(target)
        && evidenceGroup.every(evidence => cellsConflict(context, target, evidence))
      ));
      if (targets.length === 0) continue;
      proofs.push(createProof(context, {
        technique: STAR_DOUBLE_PROOF_TECHNIQUE.COMMON_CONFLICT,
        action: 'eliminate',
        premises: {
          sourceUnit: unit.key,
          remainingQuota: stats.remaining,
          candidateSet: stats.candidates,
          mustContainOneStar: evidenceGroup,
          targetConflictsWithEveryEvidenceCell: true,
        },
        involvedUnits: [unit.key],
        observationCells: [...unit.cells, ...targets],
        evidenceCells: evidenceGroup,
        derivedTargets: targets,
      }));
    }
  }
  return proofs;
}

const PROOF_FINDERS = Object.freeze([
  findQuotaProofs,
  findAdjacencyProofs,
  findRemainingProofs,
  findConfinedProofs,
  findTwoByTwoProofs,
  findMultiUnitProofs,
  findCommonConflictProofs,
]);

function unitKeySortValue(key) {
  const [kind, ...rest] = key.split(':');
  return [UNIT_KIND_PRIORITY[kind] ?? 99, ...rest.map(value => Number(value))];
}

function compareArrays(first, second) {
  const length = Math.max(first.length, second.length);
  for (let index = 0; index < length; index += 1) {
    const a = first[index] ?? -1;
    const b = second[index] ?? -1;
    if (a !== b) return a < b ? -1 : 1;
  }
  return 0;
}

export function getStarDoubleProofIdentity(proof) {
  if (!proof) return '';
  const premises = proof.premises || {};
  let focus;
  switch (proof.technique) {
    case STAR_DOUBLE_PROOF_TECHNIQUE.ADJACENCY_EXCLUSION:
      focus = { starCell: premises.starCell };
      break;
    case STAR_DOUBLE_PROOF_TECHNIQUE.QUOTA_SATURATED:
    case STAR_DOUBLE_PROOF_TECHNIQUE.REMAINING_CAPACITY:
      focus = { unit: premises.unit };
      break;
    case STAR_DOUBLE_PROOF_TECHNIQUE.TWO_BY_TWO_CAPACITY:
      focus = {
        sourceUnit: premises.sourceUnit,
        coveringBlocks: premises.coveringBlocks,
        forcedSingleton: premises.forcedSingleton,
      };
      break;
    case STAR_DOUBLE_PROOF_TECHNIQUE.CONFINED_CAPACITY:
      focus = { sourceUnit: premises.sourceUnit, targetUnit: premises.targetUnit };
      break;
    case STAR_DOUBLE_PROOF_TECHNIQUE.MULTI_UNIT_INTERSECTION:
      focus = { sourceUnits: premises.sourceUnits, targetUnits: premises.targetUnits };
      break;
    case STAR_DOUBLE_PROOF_TECHNIQUE.COMMON_CONFLICT:
      focus = { sourceUnit: premises.sourceUnit, mustContainOneStar: premises.mustContainOneStar };
      break;
    default:
      focus = { involvedUnits: proof.involvedUnits };
  }
  return `${proof.technique}:${proof.action}:${stableJson(focus)}`;
}

function compareProofs(first, second) {
  return (TECHNIQUE_PRIORITY[first.technique] ?? 99) - (TECHNIQUE_PRIORITY[second.technique] ?? 99)
    || compareArrays(
      first.involvedUnits.flatMap(unitKeySortValue),
      second.involvedUnits.flatMap(unitKeySortValue),
    )
    || getStarDoubleProofIdentity(first).localeCompare(getStarDoubleProofIdentity(second))
    || compareArrays(first.derivedTargets, second.derivedTargets);
}

export function findAllProofs(level, gridData, allowedTechniques = null) {
  if (!level || !Array.isArray(level.regions) || !Array.isArray(gridData)) return [];
  const context = buildContext(level, gridData);
  const allowed = allowedTechniques ? new Set(allowedTechniques) : null;
  const proofs = PROOF_FINDERS.flatMap(finder => finder(context))
    .filter(proof => proof.derivedTargets.length > 0)
    .filter(proof => !allowed || allowed.has(proof.technique));
  const seen = new Set();
  return proofs
    .sort(compareProofs)
    .filter((proof) => {
      const key = `${getStarDoubleProofIdentity(proof)}:${proof.derivedTargets.join(',')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function deriveTargets(proof) {
  return {
    observationCells: proof?.observationCells || [],
    evidenceCells: proof?.evidenceCells || [],
    targetCells: proof?.derivedTargets || [],
    action: proof?.action || null,
    technique: proof?.technique || null,
  };
}

export function validatePlayerAction(proof, cellIndex, action, currentBoardStateHash = null) {
  if (!proof) return { valid: false, reason: '当前没有可用的推理线索。' };
  if (!Array.isArray(proof.derivedTargets) || proof.derivedTargets.length === 0) {
    return { valid: false, reason: '当前推理没有可操作的位置。' };
  }
  if (typeof currentBoardStateHash === 'string'
      && currentBoardStateHash.length > 0
      && proof.boardStateHash !== currentBoardStateHash) {
    return { valid: false, reason: '棋盘已经变化，请根据新线索重新判断。' };
  }
  if (proof.action !== action) {
    return {
      valid: false,
      reason: proof.action === 'place-star'
        ? '这一步要放置星星，不是标 X。'
        : '这一步要标 X，不是放星。',
    };
  }
  if (!proof.derivedTargets.includes(cellIndex)) {
    return { valid: false, reason: '这个位置不能由当前高亮线索推出。' };
  }
  return { valid: true };
}

export function verifyStarDoubleProof(level, gridData, proof) {
  if (!proof || proof.boardStateHash !== getStarDoubleBoardStateHash(gridData)) return false;
  const identity = getStarDoubleProofIdentity(proof);
  return findAllProofs(level, gridData, [proof.technique]).some(candidate => (
    getStarDoubleProofIdentity(candidate) === identity
    && candidate.action === proof.action
    && proof.derivedTargets.every(target => candidate.derivedTargets.includes(target))
  ));
}

export function filterProofsByTechnique(proofs, technique) {
  return proofs.filter(proof => proof.technique === technique);
}

export function filterProofsByUnit(proofs, unitKey) {
  return proofs.filter(proof => proof.involvedUnits?.includes(unitKey));
}

export function computeTeachingMetrics(level, gridData) {
  const proofs = findAllProofs(level, gridData);
  return {
    availableProofCount: proofs.length,
    techniquesAvailable: [...new Set(proofs.map(proof => proof.technique))],
    byTechnique: Object.fromEntries(Object.values(STAR_DOUBLE_PROOF_TECHNIQUE).map(technique => [
      technique,
      proofs.filter(proof => proof.technique === technique).length,
    ])),
  };
}

export function validateSetupAction(proofs, cellIndex, action, prerequisiteTechniques) {
  const matchingProof = proofs.find(proof => (
    proof.derivedTargets.includes(cellIndex)
    && proof.action === action
    && prerequisiteTechniques.includes(proof.technique)
  ));
  if (!matchingProof) return { valid: false, reason: '这个操作不能由已学规则推出。' };
  return { valid: true, proof: matchingProof };
}
