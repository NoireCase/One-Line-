import { createHash } from 'node:crypto';

export const HUMAN_LOGIC_RULE_SET_VERSION = 'star-double-basic-1.0.0';

export const CELL_STATE = Object.freeze({
  UNKNOWN: 'U',
  STAR: 'S',
  X: 'X',
});

export const DEDUCTION_TECHNIQUE = Object.freeze({
  QUOTA_SATURATED: 'QUOTA_SATURATED',
  ADJACENCY_EXCLUSION: 'ADJACENCY_EXCLUSION',
  REMAINING_CAPACITY: 'REMAINING_CAPACITY',
  CONFINED_CAPACITY: 'CONFINED_CAPACITY',
  TWO_BY_TWO_CAPACITY: 'TWO_BY_TWO_CAPACITY',
});

export const HUMAN_LOGIC_STATUS = Object.freeze({
  SOLVED_SUPPORTED_RULES: 'SOLVED_SUPPORTED_RULES',
  STALLED_SUPPORTED_RULES: 'STALLED_SUPPORTED_RULES',
  CONTRADICTION: 'CONTRADICTION',
  INVALID_INPUT: 'INVALID_INPUT',
  TRACE_LIMIT_REACHED: 'TRACE_LIMIT_REACHED',
  UNIQUE_BUT_OUTSIDE_SUPPORTED_RULESET: 'UNIQUE_BUT_OUTSIDE_SUPPORTED_RULESET',
});

const TECHNIQUE_PRIORITY = Object.freeze({
  [DEDUCTION_TECHNIQUE.QUOTA_SATURATED]: 10,
  [DEDUCTION_TECHNIQUE.ADJACENCY_EXCLUSION]: 20,
  [DEDUCTION_TECHNIQUE.REMAINING_CAPACITY]: 30,
  [DEDUCTION_TECHNIQUE.CONFINED_CAPACITY]: 40,
  [DEDUCTION_TECHNIQUE.TWO_BY_TWO_CAPACITY]: 50,
});

const UNIT_KIND_PRIORITY = Object.freeze({ row: 10, col: 20, region: 30, block: 40 });

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function toIndex(cell, N) {
  if (Number.isInteger(cell)) return cell;
  if (Array.isArray(cell) && cell.length === 2
      && Number.isInteger(cell[0]) && Number.isInteger(cell[1])) {
    return cell[0] * N + cell[1];
  }
  return Number.NaN;
}

function canonicalizeRegionLabels(regions) {
  const labels = new Map();
  let next = 0;
  return regions.map((label) => {
    if (!labels.has(label)) labels.set(label, next++);
    return labels.get(label);
  });
}

function orthogonalNeighbors(idx, N) {
  const row = Math.floor(idx / N);
  const col = idx % N;
  const out = [];
  for (const [dr, dc] of [[-1, 0], [0, -1], [0, 1], [1, 0]]) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr >= 0 && nr < N && nc >= 0 && nc < N) out.push(nr * N + nc);
  }
  return out.sort((a, b) => a - b);
}

function eightNeighbors(idx, N) {
  const row = Math.floor(idx / N);
  const col = idx % N;
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < N && nc >= 0 && nc < N) out.push(nr * N + nc);
    }
  }
  return out.sort((a, b) => a - b);
}

function validateRegionConnectivity(regions, N) {
  for (let rid = 0; rid < N; rid++) {
    const cells = [];
    for (let idx = 0; idx < regions.length; idx++) {
      if (regions[idx] === rid) cells.push(idx);
    }
    if (cells.length === 0) return `region ${rid} is empty`;
    const visited = new Set([cells[0]]);
    const queue = [cells[0]];
    while (queue.length > 0) {
      const current = queue.shift();
      for (const neighbor of orthogonalNeighbors(current, N)) {
        if (regions[neighbor] === rid && !visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    if (visited.size !== cells.length) return `region ${rid} is not orthogonally connected`;
  }
  return null;
}

function normalizeInitialState(initialState, N) {
  const total = N * N;
  if (initialState === undefined || initialState === null) {
    return { state: new Array(total).fill(CELL_STATE.UNKNOWN), error: null };
  }

  if (Array.isArray(initialState)) {
    if (initialState.length !== total) {
      return { state: null, error: `initialState must contain ${total} cells` };
    }
    const state = initialState.map(value => String(value).toUpperCase());
    if (state.some(value => !Object.values(CELL_STATE).includes(value))) {
      return { state: null, error: 'initialState contains an unsupported cell value' };
    }
    return { state, error: null };
  }

  if (typeof initialState !== 'object') {
    return { state: null, error: 'initialState must be an array or { stars, x } object' };
  }

  const state = new Array(total).fill(CELL_STATE.UNKNOWN);
  const assignments = [
    [initialState.stars || [], CELL_STATE.STAR],
    [initialState.x || initialState.eliminated || [], CELL_STATE.X],
  ];
  for (const [cells, value] of assignments) {
    if (!Array.isArray(cells)) return { state: null, error: 'initialState stars/x must be arrays' };
    for (const cell of cells) {
      const idx = toIndex(cell, N);
      if (!Number.isInteger(idx) || idx < 0 || idx >= total) {
        return { state: null, error: `initialState cell is out of range: ${stableJson(cell)}` };
      }
      if (state[idx] !== CELL_STATE.UNKNOWN && state[idx] !== value) {
        return { state: null, error: `initialState assigns conflicting values to cell ${idx}` };
      }
      state[idx] = value;
    }
  }
  return { state, error: null };
}

function buildContext(puzzle) {
  const N = puzzle?.N;
  const quota = puzzle?.quota ?? puzzle?.starsPerRow ?? 2;
  if (!Number.isInteger(N) || N < 2) {
    return { error: 'N must be an integer of at least 2' };
  }
  if (!Number.isInteger(quota) || quota < 1 || quota > N) {
    return { error: 'quota must be an integer between 1 and N' };
  }
  if (!Array.isArray(puzzle.regions) || puzzle.regions.length !== N * N) {
    return { error: `regions must contain exactly ${N * N} cells` };
  }

  const regions = canonicalizeRegionLabels(puzzle.regions);
  if (new Set(regions).size !== N) {
    return { error: `expected ${N} regions, got ${new Set(regions).size}` };
  }
  const connectivityError = validateRegionConnectivity(regions, N);
  if (connectivityError) return { error: connectivityError };

  const initial = normalizeInitialState(puzzle.initialState, N);
  if (initial.error) return { error: initial.error };

  const rowCells = Array.from({ length: N }, (_, row) =>
    Array.from({ length: N }, (_, col) => row * N + col));
  const colCells = Array.from({ length: N }, (_, col) =>
    Array.from({ length: N }, (_, row) => row * N + col));
  const regionCells = Array.from({ length: N }, () => []);
  for (let idx = 0; idx < regions.length; idx++) regionCells[regions[idx]].push(idx);

  const units = [
    ...rowCells.map((cells, index) => ({ kind: 'row', index, key: `row:${index}`, cells })),
    ...colCells.map((cells, index) => ({ kind: 'col', index, key: `col:${index}`, cells })),
    ...regionCells.map((cells, index) => ({ kind: 'region', index, key: `region:${index}`, cells })),
  ];
  const cellUnits = Array.from({ length: N * N }, () => []);
  for (const unit of units) {
    for (const cell of unit.cells) cellUnits[cell].push(unit);
  }

  const blocks = [];
  for (let row = 0; row < N - 1; row++) {
    for (let col = 0; col < N - 1; col++) {
      const index = row * (N - 1) + col;
      blocks.push({
        kind: 'block',
        index,
        key: `block:${row}:${col}`,
        row,
        col,
        cells: [
          row * N + col,
          row * N + col + 1,
          (row + 1) * N + col,
          (row + 1) * N + col + 1,
        ].sort((a, b) => a - b),
      });
    }
  }

  const neighbors = Array.from({ length: N * N }, (_, idx) => eightNeighbors(idx, N));
  const solution = Array.isArray(puzzle.solution)
    ? new Set(puzzle.solution.map(cell => toIndex(cell, N)))
    : null;
  if (solution && [...solution].some(idx => !Number.isInteger(idx) || idx < 0 || idx >= N * N)) {
    return { error: 'solution contains an out-of-range cell' };
  }

  return {
    error: null,
    N,
    quota,
    regions,
    initialState: initial.state,
    rowCells,
    colCells,
    regionCells,
    units,
    cellUnits,
    blocks,
    neighbors,
    solution,
  };
}

function stateHash(context, state) {
  return sha256([
    HUMAN_LOGIC_RULE_SET_VERSION,
    context.N,
    context.quota,
    context.regions.join(','),
    state.join(''),
  ].join('|'));
}

function unitStats(context, state, unit) {
  const stars = unit.cells.filter(cell => state[cell] === CELL_STATE.STAR);
  const unknown = unit.cells.filter(cell => state[cell] === CELL_STATE.UNKNOWN);
  const candidates = unknown.filter(cell => isCandidate(context, state, cell));
  return {
    stars,
    unknown,
    candidates,
    remainingQuota: context.quota - stars.length,
  };
}

function isCandidate(context, state, cell) {
  if (state[cell] !== CELL_STATE.UNKNOWN) return false;
  if (context.neighbors[cell].some(neighbor => state[neighbor] === CELL_STATE.STAR)) return false;
  for (const unit of context.cellUnits[cell]) {
    const starCount = unit.cells.filter(idx => state[idx] === CELL_STATE.STAR).length;
    if (starCount >= context.quota) return false;
  }
  return true;
}

function makeRawEvent({
  technique,
  action,
  cell,
  sourceUnits,
  witnessCells,
  proof,
}) {
  return {
    technique,
    action,
    affectedCells: [cell],
    sourceUnits: [...new Set(sourceUnits || [])].sort(),
    witnessCells: [...new Set(witnessCells || [])].sort((a, b) => a - b),
    proof,
  };
}

function collectQuotaSaturated(context, state) {
  const events = [];
  for (const unit of context.units) {
    const stats = unitStats(context, state, unit);
    if (stats.stars.length !== context.quota) continue;
    for (const cell of stats.unknown) {
      events.push(makeRawEvent({
        technique: DEDUCTION_TECHNIQUE.QUOTA_SATURATED,
        action: 'eliminate',
        cell,
        sourceUnits: [unit.key],
        witnessCells: stats.stars,
        proof: {
          type: 'quota-saturated',
          unit: unit.key,
          quota: context.quota,
          existingStarCount: stats.stars.length,
          remainingQuota: 0,
        },
      }));
    }
  }
  return events;
}

function collectAdjacencyExclusions(context, state) {
  const events = [];
  for (let star = 0; star < state.length; star++) {
    if (state[star] !== CELL_STATE.STAR) continue;
    for (const cell of context.neighbors[star]) {
      if (state[cell] !== CELL_STATE.UNKNOWN) continue;
      events.push(makeRawEvent({
        technique: DEDUCTION_TECHNIQUE.ADJACENCY_EXCLUSION,
        action: 'eliminate',
        cell,
        sourceUnits: context.cellUnits[star].map(unit => unit.key),
        witnessCells: [star],
        proof: {
          type: 'eight-neighbor-exclusion',
          starCell: star,
          neighborCell: cell,
          maxChebyshevDistance: 1,
        },
      }));
    }
  }
  return events;
}

function collectRemainingCapacity(context, state) {
  const events = [];
  for (const unit of context.units) {
    const stats = unitStats(context, state, unit);
    if (stats.remainingQuota <= 0 || stats.candidates.length !== stats.remainingQuota) continue;
    for (const cell of stats.candidates) {
      events.push(makeRawEvent({
        technique: DEDUCTION_TECHNIQUE.REMAINING_CAPACITY,
        action: 'place-star',
        cell,
        sourceUnits: [unit.key],
        witnessCells: [...stats.stars, ...stats.candidates],
        proof: {
          type: 'remaining-capacity',
          unit: unit.key,
          quota: context.quota,
          existingStarCount: stats.stars.length,
          remainingQuota: stats.remainingQuota,
          candidateCount: stats.candidates.length,
          candidateCells: stats.candidates,
        },
      }));
    }
  }
  return events;
}

function collectConfinedCapacity(context, state) {
  const events = [];
  const statsByKey = new Map(context.units.map(unit => [unit.key, unitStats(context, state, unit)]));
  for (const source of context.units) {
    const sourceStats = statsByKey.get(source.key);
    if (sourceStats.remainingQuota <= 0 || sourceStats.candidates.length === 0) continue;
    for (const target of context.units) {
      if (source.key === target.key) continue;
      const targetStats = statsByKey.get(target.key);
      if (sourceStats.remainingQuota !== targetStats.remainingQuota) continue;
      const targetCellSet = new Set(target.cells);
      if (!sourceStats.candidates.every(cell => targetCellSet.has(cell))) continue;
      const sourceCandidateSet = new Set(sourceStats.candidates);
      const eliminations = targetStats.candidates.filter(cell => !sourceCandidateSet.has(cell));
      for (const cell of eliminations) {
        events.push(makeRawEvent({
          technique: DEDUCTION_TECHNIQUE.CONFINED_CAPACITY,
          action: 'eliminate',
          cell,
          sourceUnits: [source.key, target.key],
          witnessCells: sourceStats.candidates,
          proof: {
            type: 'confined-capacity',
            sourceUnit: source.key,
            targetUnit: target.key,
            quota: context.quota,
            sourceExistingStarCount: sourceStats.stars.length,
            targetExistingStarCount: targetStats.stars.length,
            sourceRemainingQuota: sourceStats.remainingQuota,
            targetRemainingQuota: targetStats.remainingQuota,
            sourceCandidateCount: sourceStats.candidates.length,
            sourceCandidateCells: sourceStats.candidates,
            sourceCandidatesContainedByTarget: true,
            eliminatedTargetCell: cell,
          },
        }));
      }
    }
  }
  return events;
}

function disjointCells(a, b) {
  const set = new Set(a);
  return b.every(cell => !set.has(cell));
}

function collectTwoByTwoCapacity(context, state) {
  const events = [];
  for (const source of context.units) {
    const stats = unitStats(context, state, source);
    const needed = stats.remainingQuota;
    if (needed < 1 || needed > 2 || stats.candidates.length === 0) continue;
    const sourceCandidates = new Set(stats.candidates);
    const eligibleBlocks = context.blocks.filter((block) => {
      const blockStars = block.cells.filter(cell => state[cell] === CELL_STATE.STAR);
      if (blockStars.length !== 0) return false;
      return block.cells.some(cell => sourceCandidates.has(cell));
    });

    const covers = [];
    if (needed === 1) {
      for (const block of eligibleBlocks) {
        if (stats.candidates.every(cell => block.cells.includes(cell))) covers.push([block]);
      }
    } else {
      for (let i = 0; i < eligibleBlocks.length; i++) {
        for (let j = i + 1; j < eligibleBlocks.length; j++) {
          const first = eligibleBlocks[i];
          const second = eligibleBlocks[j];
          if (!disjointCells(first.cells, second.cells)) continue;
          const union = new Set([...first.cells, ...second.cells]);
          if (stats.candidates.every(cell => union.has(cell))) covers.push([first, second]);
        }
      }
    }
    if (covers.length === 0) continue;

    const proofByCell = new Map();
    for (const cover of covers) {
      for (const block of cover) {
        for (const cell of block.cells) {
          if (!isCandidate(context, state, cell) || sourceCandidates.has(cell)) continue;
          if (!proofByCell.has(cell)) proofByCell.set(cell, []);
          proofByCell.get(cell).push({
            blocks: cover.map(item => item.key),
            occupiedBlock: block.key,
          });
        }
      }
    }

    for (const [cell, coverProofs] of proofByCell) {
      events.push(makeRawEvent({
        technique: DEDUCTION_TECHNIQUE.TWO_BY_TWO_CAPACITY,
        action: 'eliminate',
        cell,
        sourceUnits: [source.key, ...new Set(coverProofs.flatMap(item => item.blocks))],
        witnessCells: stats.candidates,
        proof: {
          type: 'two-by-two-capacity',
          sourceUnit: source.key,
          quota: context.quota,
          sourceExistingStarCount: stats.stars.length,
          sourceRemainingQuota: needed,
          sourceCandidateCount: stats.candidates.length,
          sourceCandidateCells: stats.candidates,
          blockCapacity: 1,
          disjointBlockCoverCount: covers.length,
          coverProofs,
          eliminatedCell: cell,
        },
      }));
    }
  }
  return events;
}

function unitKeySortValue(key) {
  const [kind, ...rest] = key.split(':');
  return [UNIT_KIND_PRIORITY[kind] ?? 99, ...rest.map(value => Number(value))];
}

function compareArrays(a, b) {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const av = a[i] ?? -1;
    const bv = b[i] ?? -1;
    if (av !== bv) return av < bv ? -1 : 1;
  }
  return 0;
}

function compareRawEvents(a, b) {
  const techniqueDiff = TECHNIQUE_PRIORITY[a.technique] - TECHNIQUE_PRIORITY[b.technique];
  if (techniqueDiff !== 0) return techniqueDiff;
  const unitDiff = compareArrays(
    unitKeySortValue(a.sourceUnits[0] || 'unknown:99'),
    unitKeySortValue(b.sourceUnits[0] || 'unknown:99'),
  );
  if (unitDiff !== 0) return unitDiff;
  const actionDiff = a.action.localeCompare(b.action);
  if (actionDiff !== 0) return actionDiff;
  return compareArrays(a.affectedCells, b.affectedCells);
}

function dependencyIds(rawEvent, context, provenance) {
  const ids = new Set();
  const relevantCells = new Set(rawEvent.witnessCells);
  for (const unitKey of rawEvent.sourceUnits) {
    const unit = context.units.find(item => item.key === unitKey);
    if (unit) for (const cell of unit.cells) relevantCells.add(cell);
  }
  for (const cell of relevantCells) {
    for (const id of provenance[cell] || []) ids.add(id);
  }
  return [...ids].sort();
}

function mergeAndFinalizeEvents(rawEvents, context, provenance, waveIndex, inputStateHash, idStart) {
  const sorted = [...rawEvents].sort(compareRawEvents);
  const merged = new Map();
  for (const event of sorted) {
    const key = `${event.action}:${event.affectedCells.join(',')}`;
    if (!merged.has(key)) {
      merged.set(key, {
        ...event,
        supportingTechniques: [event.technique],
        proofs: [event.proof],
      });
      continue;
    }
    const target = merged.get(key);
    if (!target.supportingTechniques.includes(event.technique)) {
      target.supportingTechniques.push(event.technique);
    }
    target.proofs.push(event.proof);
    target.sourceUnits = [...new Set([...target.sourceUnits, ...event.sourceUnits])].sort();
    target.witnessCells = [...new Set([...target.witnessCells, ...event.witnessCells])].sort((a, b) => a - b);
  }

  const events = [...merged.values()].sort(compareRawEvents);
  for (let index = 0; index < events.length; index++) {
    const event = events[index];
    event.id = `d${String(idStart + index + 1).padStart(5, '0')}`;
    event.ruleSetVersion = HUMAN_LOGIC_RULE_SET_VERSION;
    event.prerequisiteEvents = dependencyIds(event, context, provenance);
    event.propagationDepth = waveIndex;
    event.inputStateHash = inputStateHash;
    event.supportingTechniques.sort((a, b) => TECHNIQUE_PRIORITY[a] - TECHNIQUE_PRIORITY[b]);
    event.proofs.sort((a, b) => stableJson(a).localeCompare(stableJson(b)));
    event.proof = event.proofs[0];
  }
  return events;
}

export function detectDeductionEventConflicts(events) {
  const actionsByCell = new Map();
  for (const event of events) {
    for (const cell of event.affectedCells || []) {
      if (!actionsByCell.has(cell)) actionsByCell.set(cell, new Set());
      actionsByCell.get(cell).add(event.action);
    }
  }
  const conflicts = [];
  for (const [cell, actions] of actionsByCell) {
    if (actions.size > 1) conflicts.push({ cell, actions: [...actions].sort() });
  }
  return conflicts.sort((a, b) => a.cell - b.cell);
}

function findStateContradictions(context, state) {
  const contradictions = [];
  for (const unit of context.units) {
    const stats = unitStats(context, state, unit);
    if (stats.stars.length > context.quota) {
      contradictions.push({
        type: 'unit-star-overflow',
        unit: unit.key,
        quota: context.quota,
        starCount: stats.stars.length,
      });
    }
    if (stats.stars.length + stats.candidates.length < context.quota) {
      contradictions.push({
        type: 'unit-candidate-shortage',
        unit: unit.key,
        quota: context.quota,
        starCount: stats.stars.length,
        candidateCount: stats.candidates.length,
      });
    }
  }
  for (let cell = 0; cell < state.length; cell++) {
    if (state[cell] !== CELL_STATE.STAR) continue;
    for (const neighbor of context.neighbors[cell]) {
      if (neighbor > cell && state[neighbor] === CELL_STATE.STAR) {
        contradictions.push({ type: 'adjacent-stars', cells: [cell, neighbor] });
      }
    }
  }
  return contradictions;
}

function collectRawEvents(context, state) {
  return [
    ...collectQuotaSaturated(context, state),
    ...collectAdjacencyExclusions(context, state),
    ...collectRemainingCapacity(context, state),
    ...collectConfinedCapacity(context, state),
    ...collectTwoByTwoCapacity(context, state),
  ];
}

export function collectHumanLogicEvents(puzzle, stateOverride = null) {
  const context = buildContext(puzzle);
  if (context.error) return { status: HUMAN_LOGIC_STATUS.INVALID_INPUT, errors: [context.error], events: [] };
  let state = context.initialState;
  if (stateOverride !== null) {
    const normalized = normalizeInitialState(stateOverride, context.N);
    if (normalized.error) {
      return { status: HUMAN_LOGIC_STATUS.INVALID_INPUT, errors: [normalized.error], events: [] };
    }
    state = normalized.state;
  }
  const contradictions = findStateContradictions(context, state);
  const provenance = Array.from({ length: state.length }, () => []);
  const inputStateHash = stateHash(context, state);
  const events = mergeAndFinalizeEvents(
    collectRawEvents(context, state),
    context,
    provenance,
    0,
    inputStateHash,
    0,
  );
  return {
    status: contradictions.length > 0 ? HUMAN_LOGIC_STATUS.CONTRADICTION : null,
    contradictions,
    events,
    inputStateHash,
  };
}

function isSolved(context, state) {
  if (findStateContradictions(context, state).length > 0) return false;
  return context.units.every(unit =>
    unit.cells.filter(cell => state[cell] === CELL_STATE.STAR).length === context.quota);
}

function applyEvents(context, state, provenance, events) {
  const next = [...state];
  const nextProvenance = provenance.map(ids => [...ids]);
  const solutionErrors = [];
  for (const event of events) {
    for (const cell of event.affectedCells) {
      if (next[cell] !== CELL_STATE.UNKNOWN) continue;
      if (event.action === 'place-star') {
        if (context.solution && !context.solution.has(cell)) {
          solutionErrors.push({ eventId: event.id, action: event.action, cell });
        }
        next[cell] = CELL_STATE.STAR;
      } else if (event.action === 'eliminate') {
        if (context.solution && context.solution.has(cell)) {
          solutionErrors.push({ eventId: event.id, action: event.action, cell });
        }
        next[cell] = CELL_STATE.X;
      }
      nextProvenance[cell] = [event.id];
    }
  }
  return { state: next, provenance: nextProvenance, solutionErrors };
}

export function analyzeStarDoubleHumanLogic(puzzle, options = {}) {
  const context = buildContext(puzzle);
  if (context.error) {
    return {
      ruleSetVersion: HUMAN_LOGIC_RULE_SET_VERSION,
      status: HUMAN_LOGIC_STATUS.INVALID_INPUT,
      errors: [context.error],
      canonicalPath: [],
      deductionWaves: [],
      contradictions: [],
    };
  }

  const maxWaves = options.maxWaves ?? 256;
  const solverStatus = options.solverStatus ?? puzzle.solverStatus ?? null;
  let state = [...context.initialState];
  let provenance = Array.from({ length: state.length }, () => []);
  const initialStateHash = stateHash(context, state);
  const seenHashes = new Set([initialStateHash]);
  const canonicalPath = [];
  const deductionWaves = [];
  const solutionConsistencyErrors = [];
  let eventCount = 0;

  for (let waveIndex = 0; waveIndex < maxWaves; waveIndex++) {
    const contradictions = findStateContradictions(context, state);
    if (contradictions.length > 0) {
      return {
        ruleSetVersion: HUMAN_LOGIC_RULE_SET_VERSION,
        status: HUMAN_LOGIC_STATUS.CONTRADICTION,
        reason: 'state-contradiction',
        initialStateHash,
        finalStateHash: stateHash(context, state),
        finalState: state,
        canonicalPath,
        deductionWaves,
        contradictions,
        solutionConsistencyErrors,
      };
    }

    if (isSolved(context, state)) {
      return {
        ruleSetVersion: HUMAN_LOGIC_RULE_SET_VERSION,
        status: HUMAN_LOGIC_STATUS.SOLVED_SUPPORTED_RULES,
        initialStateHash,
        finalStateHash: stateHash(context, state),
        finalState: state,
        canonicalPath,
        deductionWaves,
        contradictions: [],
        solutionConsistencyErrors,
        summary: summarizeTrace(context, state, canonicalPath, deductionWaves),
      };
    }

    const inputStateHash = stateHash(context, state);
    const events = mergeAndFinalizeEvents(
      collectRawEvents(context, state),
      context,
      provenance,
      waveIndex,
      inputStateHash,
      eventCount,
    );
    if (events.length === 0) {
      const status = solverStatus === 'UNIQUE'
        ? HUMAN_LOGIC_STATUS.UNIQUE_BUT_OUTSIDE_SUPPORTED_RULESET
        : HUMAN_LOGIC_STATUS.STALLED_SUPPORTED_RULES;
      return {
        ruleSetVersion: HUMAN_LOGIC_RULE_SET_VERSION,
        status,
        reason: solverStatus === 'UNIQUE'
          ? 'unique-solution-requires-unsupported-logic'
          : 'no-supported-deduction',
        initialStateHash,
        finalStateHash: inputStateHash,
        finalState: state,
        canonicalPath,
        deductionWaves,
        contradictions: [],
        solutionConsistencyErrors,
        summary: summarizeTrace(context, state, canonicalPath, deductionWaves),
      };
    }

    const eventConflicts = detectDeductionEventConflicts(events);
    if (eventConflicts.length > 0) {
      return {
        ruleSetVersion: HUMAN_LOGIC_RULE_SET_VERSION,
        status: HUMAN_LOGIC_STATUS.CONTRADICTION,
        reason: 'event-conflict',
        initialStateHash,
        finalStateHash: inputStateHash,
        finalState: state,
        canonicalPath,
        deductionWaves,
        contradictions: eventConflicts.map(conflict => ({ type: 'event-conflict', ...conflict })),
        solutionConsistencyErrors,
      };
    }

    const unknownBefore = state.filter(value => value === CELL_STATE.UNKNOWN).length;
    const applied = applyEvents(context, state, provenance, events);
    solutionConsistencyErrors.push(...applied.solutionErrors);
    if (applied.solutionErrors.length > 0) {
      return {
        ruleSetVersion: HUMAN_LOGIC_RULE_SET_VERSION,
        status: HUMAN_LOGIC_STATUS.CONTRADICTION,
        reason: 'solution-consistency',
        initialStateHash,
        finalStateHash: inputStateHash,
        finalState: state,
        canonicalPath,
        deductionWaves,
        contradictions: applied.solutionErrors.map(error => ({ type: 'solution-consistency', ...error })),
        solutionConsistencyErrors,
      };
    }

    const outputStateHash = stateHash(context, applied.state);
    const unknownAfter = applied.state.filter(value => value === CELL_STATE.UNKNOWN).length;
    if (unknownAfter >= unknownBefore || outputStateHash === inputStateHash || seenHashes.has(outputStateHash)) {
      return {
        ruleSetVersion: HUMAN_LOGIC_RULE_SET_VERSION,
        status: HUMAN_LOGIC_STATUS.CONTRADICTION,
        reason: 'non-monotonic-or-looping-trace',
        initialStateHash,
        finalStateHash: inputStateHash,
        finalState: state,
        canonicalPath,
        deductionWaves,
        contradictions: [{ type: 'non-monotonic-or-looping-trace', unknownBefore, unknownAfter }],
        solutionConsistencyErrors,
      };
    }

    deductionWaves.push({
      index: waveIndex,
      inputStateHash,
      events,
      outputStateHash,
    });
    canonicalPath.push(...events);
    eventCount += events.length;
    state = applied.state;
    provenance = applied.provenance;
    seenHashes.add(outputStateHash);
  }

  return {
    ruleSetVersion: HUMAN_LOGIC_RULE_SET_VERSION,
    status: HUMAN_LOGIC_STATUS.TRACE_LIMIT_REACHED,
    reason: 'wave-limit',
    initialStateHash,
    finalStateHash: stateHash(context, state),
    finalState: state,
    canonicalPath,
    deductionWaves,
    contradictions: [],
    solutionConsistencyErrors,
    summary: summarizeTrace(context, state, canonicalPath, deductionWaves),
  };
}

function summarizeTrace(context, state, canonicalPath, deductionWaves) {
  const techniqueCounts = {};
  let placedStars = 0;
  let eliminated = 0;
  for (const event of canonicalPath) {
    techniqueCounts[event.technique] = (techniqueCounts[event.technique] || 0) + 1;
    if (event.action === 'place-star') placedStars++;
    if (event.action === 'eliminate') eliminated++;
  }
  return {
    boardSize: context.N,
    quota: context.quota,
    waveCount: deductionWaves.length,
    eventCount: canonicalPath.length,
    placedStarDeductions: placedStars,
    eliminationDeductions: eliminated,
    techniqueCounts,
    finalStarCount: state.filter(value => value === CELL_STATE.STAR).length,
    finalUnknownCount: state.filter(value => value === CELL_STATE.UNKNOWN).length,
  };
}

export function replayHumanLogicTrace(puzzle, analysis) {
  const context = buildContext(puzzle);
  if (context.error) return { ok: false, errors: [context.error], finalState: null };
  const errors = [];
  let state = [...context.initialState];
  let provenance = Array.from({ length: state.length }, () => []);

  if (stateHash(context, state) !== analysis.initialStateHash) {
    errors.push('initial state hash does not match trace');
  }

  for (const wave of analysis.deductionWaves || []) {
    const currentHash = stateHash(context, state);
    if (currentHash !== wave.inputStateHash) {
      errors.push(`wave ${wave.index} input hash mismatch`);
      break;
    }
    const conflicts = detectDeductionEventConflicts(wave.events || []);
    if (conflicts.length > 0) {
      errors.push(`wave ${wave.index} contains conflicting events`);
      break;
    }
    for (const event of wave.events || []) {
      if (event.inputStateHash !== wave.inputStateHash) {
        errors.push(`event ${event.id} input hash mismatch`);
      }
      for (const cell of event.affectedCells || []) {
        if (state[cell] !== CELL_STATE.UNKNOWN) {
          errors.push(`event ${event.id} targets non-UNKNOWN cell ${cell}`);
        }
      }
    }
    if (errors.length > 0) break;
    const applied = applyEvents(context, state, provenance, wave.events || []);
    if (applied.solutionErrors.length > 0) {
      errors.push(`wave ${wave.index} conflicts with known solution`);
      break;
    }
    state = applied.state;
    provenance = applied.provenance;
    const outputHash = stateHash(context, state);
    if (outputHash !== wave.outputStateHash) {
      errors.push(`wave ${wave.index} output hash mismatch`);
      break;
    }
  }

  const finalStateHash = stateHash(context, state);
  if (finalStateHash !== analysis.finalStateHash) errors.push('final state hash does not match trace');
  if (analysis.finalState && stableJson(state) !== stableJson(analysis.finalState)) {
    errors.push('final state does not match analysis result');
  }
  return { ok: errors.length === 0, errors, finalState: state, finalStateHash };
}
