import {
  findAllProofs,
  getStarDoubleProofIdentity,
  STAR_DOUBLE_PROOF_TECHNIQUE as T,
} from './starLineDoubleLessonEngine.js';

function readCellState(cell) {
  if (cell?.isStarred) return 'S';
  if (cell?.isMarkedX) return 'X';
  return 'U';
}

function unitKind(unitKey) {
  return typeof unitKey === 'string' ? unitKey.split(':')[0] : null;
}

function unitCells(level, unitKey) {
  if (!level || typeof unitKey !== 'string') return [];
  const [kind, rawIndex] = unitKey.split(':');
  const index = Number(rawIndex);
  if (kind === 'row') {
    return Array.from({ length: level.N }, (_, col) => index * level.N + col);
  }
  if (kind === 'col') {
    return Array.from({ length: level.N }, (_, row) => row * level.N + index);
  }
  if (kind === 'region') {
    return level.regions.map((regionId, cell) => (regionId === index ? cell : -1))
      .filter(cell => cell >= 0);
  }
  return [];
}

function proofPrimaryUnit(proof) {
  const premises = proof?.premises || {};
  return premises.unit
    || premises.sourceUnit
    || premises.sourceUnits?.[0]
    || proof?.involvedUnits?.find(key => !key.startsWith('block:'))
    || null;
}

function proofMatchesPreviousConclusion(proof, previousConclusion) {
  if (!previousConclusion) return false;
  const identity = getStarDoubleProofIdentity(proof);
  if (previousConclusion.availableProofIdentitiesBefore?.includes(identity)) return false;
  const previousUnits = new Set(previousConclusion.involvedUnits || []);
  return proof.involvedUnits?.some(unit => previousUnits.has(unit));
}

function selectByPreference(proofs, selector) {
  const preferActions = selector.preferActions || [];
  if (preferActions.length === 0) return proofs[0] || null;
  for (const action of preferActions) {
    const match = proofs.find(proof => proof.action === action);
    if (match) return match;
  }
  return proofs[0] || null;
}

function cloneGridWithProofAction(gridData, proof, cellIndex) {
  if (!Array.isArray(gridData) || !gridData[cellIndex]) return null;
  const grid = gridData.map(cell => ({ ...cell }));
  const cell = grid[cellIndex];
  if (proof.action === 'place-star') {
    if (cell.isStarred || cell.isMarkedX) return null;
    grid[cellIndex] = { ...cell, isStarred: true, isMarkedX: false };
  } else if (proof.action === 'eliminate') {
    if (cell.isStarred || cell.isMarkedX) return null;
    grid[cellIndex] = { ...cell, isStarred: false, isMarkedX: true };
  } else {
    return null;
  }
  return grid;
}

function conclusionsEnabledByTarget({
  proof,
  target,
  proofsBefore,
  level,
  gridData,
}) {
  const nextGrid = cloneGridWithProofAction(gridData, proof, target);
  if (!nextGrid) return [];
  const identitiesBefore = new Set(proofsBefore.map(getStarDoubleProofIdentity));
  const sourceUnits = new Set(proof.involvedUnits || []);
  return findAllProofs(level, nextGrid).filter((nextProof) => {
    const isNewConclusion = !identitiesBefore.has(getStarDoubleProofIdentity(nextProof));
    const sharesAffectedUnit = nextProof.involvedUnits?.some(unit => sourceUnits.has(unit));
    return isNewConclusion && sharesAffectedUnit && nextProof.derivedTargets?.length > 0;
  });
}

function retainPropagationTargets(candidates, {
  proofs,
  level,
  gridData,
}) {
  if (!level || !Array.isArray(gridData)) return [];
  return candidates.flatMap((proof) => {
    const productiveTargets = proof.derivedTargets.filter(target => (
      conclusionsEnabledByTarget({
        proof,
        target,
        proofsBefore: proofs,
        level,
        gridData,
      }).length > 0
    ));
    if (productiveTargets.length === 0) return [];
    if (productiveTargets.length === proof.derivedTargets.length) return [proof];
    return [Object.freeze({
      ...proof,
      derivedTargets: Object.freeze(productiveTargets),
    })];
  });
}

export function selectStarDoubleLessonProof({
  step,
  proofs,
  level = null,
  gridData = null,
  completedObjectives = [],
  previousConclusion = null,
}) {
  const selector = step?.proofSelector;
  if (!selector || !Array.isArray(proofs)) return null;
  const techniques = new Set(selector.techniques || []);
  const actions = new Set(selector.actions || []);
  const completedIdentities = new Set(completedObjectives.map(item => item.identity));
  const previousUnitKinds = new Set(completedObjectives.map(item => item.unitKind).filter(Boolean));

  let candidates = proofs.filter(proof => (
    (techniques.size === 0 || techniques.has(proof.technique))
    && (actions.size === 0 || actions.has(proof.action))
    && proof.derivedTargets?.length > 0
  ));

  if (selector.excludeCompletedObjectives) {
    candidates = candidates.filter(proof => !completedIdentities.has(getStarDoubleProofIdentity(proof)));
  }
  if (selector.requireFullEightNeighbors) {
    candidates = candidates.filter(proof => (
      proof.premises?.fullNeighborSet?.length === 8
      && proof.derivedTargets.length === 8
    ));
  }
  if (selector.requireInteriorTarget && level?.N) {
    candidates = candidates.filter(proof => proof.derivedTargets.some((cell) => {
      const row = Math.floor(cell / level.N);
      const col = cell % level.N;
      return row > 0 && row < level.N - 1 && col > 0 && col < level.N - 1;
    })).map((proof) => {
      const interiorTargets = proof.derivedTargets.filter((cell) => {
        const row = Math.floor(cell / level.N);
        const col = cell % level.N;
        return row > 0 && row < level.N - 1 && col > 0 && col < level.N - 1;
      });
      return interiorTargets.length === proof.derivedTargets.length
        ? proof
        : Object.freeze({ ...proof, derivedTargets: Object.freeze(interiorTargets) });
    });
  }
  if (selector.requireExistingStarCount !== undefined) {
    candidates = candidates.filter(proof => (
      proof.premises?.existingStarCount === selector.requireExistingStarCount
    ));
  }
  if (selector.requireSupportingRuleCount) {
    candidates = candidates.filter(proof => (
      (proof.premises?.supportingRules || []).length >= selector.requireSupportingRuleCount
    ));
  }
  if (selector.requireMultipleSourceUnits) {
    candidates = candidates.filter(proof => (
      (proof.premises?.sourceUnits || []).length >= 2
      && (proof.premises?.targetUnits || []).length >= 2
    ));
  }
  if (selector.requireEvidencePair) {
    candidates = candidates.filter(proof => proof.evidenceCells?.length === 2);
  }
  if (selector.dependsOnPreviousConclusion) {
    candidates = candidates.filter(proof => proofMatchesPreviousConclusion(proof, previousConclusion));
  }
  if (selector.requiresNextConclusion) {
    candidates = retainPropagationTargets(candidates, {
      proofs,
      level,
      gridData,
    });
  }
  if (selector.preferDifferentUnitKind && previousUnitKinds.size > 0) {
    const different = candidates.filter(proof => !previousUnitKinds.has(unitKind(proofPrimaryUnit(proof))));
    if (different.length > 0) candidates = different;
  }

  const selected = selectByPreference(candidates, selector);
  if (!selected) return null;
  if (!selector.singleConclusion || selected.derivedTargets.length === 1) return selected;
  return Object.freeze({
    ...selected,
    derivedTargets: Object.freeze([selected.derivedTargets[0]]),
  });
}

export function createStarDoubleLessonObjective(proof) {
  if (!proof) return null;
  const primaryUnit = proofPrimaryUnit(proof);
  return Object.freeze({
    identity: getStarDoubleProofIdentity(proof),
    technique: proof.technique,
    action: proof.action,
    boardStateHash: proof.boardStateHash,
    premises: proof.premises,
    involvedUnits: Object.freeze([...(proof.involvedUnits || [])]),
    observationCells: Object.freeze([...(proof.observationCells || [])]),
    evidenceCells: Object.freeze([...(proof.evidenceCells || [])]),
    initialTargets: Object.freeze([...(proof.derivedTargets || [])]),
    primaryUnit,
    unitKind: unitKind(primaryUnit),
  });
}

function targetResolved(gridData, target, action) {
  const state = readCellState(gridData[target]);
  return action === 'place-star' ? state === 'S' : state === 'X';
}

function boardHasSaturatedUnit(level, gridData) {
  const quota = level.starsPerRow ?? 2;
  const keys = [
    ...Array.from({ length: level.N }, (_, index) => `row:${index}`),
    ...Array.from({ length: level.N }, (_, index) => `col:${index}`),
    ...[...new Set(level.regions)].map(index => `region:${index}`),
  ];
  return keys.some(key => (
    unitCells(level, key).filter(cell => readCellState(gridData[cell]) === 'S').length >= quota
  ));
}

function matchingProofExists(proofs, technique, predicate = null) {
  return proofs.some(proof => (
    proof.technique === technique
    && (!predicate || predicate(proof))
  ));
}

export function isStarDoubleLessonStepComplete({
  step,
  objective,
  level,
  gridData,
  proofs = [],
  acceptedActionInStep = false,
  boardComplete = false,
}) {
  const predicate = step?.completionPredicate;
  if (!predicate) return false;
  switch (predicate.type) {
    case 'manual-confirmation':
    case 'lesson-complete':
      return false;
    case 'board-complete':
      return boardComplete;
    case 'star-count-at-least':
      return acceptedActionInStep
        && gridData.filter(cell => readCellState(cell) === 'S').length >= predicate.count;
    case 'saturated-unit-exists':
      return acceptedActionInStep && boardHasSaturatedUnit(level, gridData);
    case 'forced-star-unit-ready':
      return acceptedActionInStep
        && matchingProofExists(proofs, T.REMAINING_CAPACITY);
    case 'second-star-proof-ready':
      return acceptedActionInStep
        && matchingProofExists(proofs, T.REMAINING_CAPACITY, proof => (
          proof.premises?.existingStarCount === 1
          && (proof.premises?.supportingRules || []).length >= 2
        ));
    case 'confined-capacity-ready':
      return acceptedActionInStep && matchingProofExists(proofs, T.CONFINED_CAPACITY);
    case 'multi-unit-intersection-ready':
      return acceptedActionInStep && matchingProofExists(proofs, T.MULTI_UNIT_INTERSECTION);
    case 'common-conflict-ready':
      return acceptedActionInStep
        && matchingProofExists(proofs, T.COMMON_CONFLICT, proof => proof.evidenceCells?.length === 2);
    case 'all-eight-neighbors-eliminated':
      return Boolean(objective?.premises?.fullNeighborSet?.length === 8)
        && objective.premises.fullNeighborSet.every(cell => readCellState(gridData[cell]) === 'X');
    case 'all-neighbors-eliminated':
      return Boolean(objective?.premises?.fullNeighborSet?.length)
        && objective.premises.fullNeighborSet.every(cell => readCellState(gridData[cell]) === 'X');
    case 'unit-cleared': {
      const cells = unitCells(level, objective?.primaryUnit);
      return cells.length > 0 && cells.every(cell => (
        readCellState(gridData[cell]) === 'S' || readCellState(gridData[cell]) === 'X'
      ));
    }
    case 'unit-quota-filled':
    case 'second-star-placed': {
      const cells = unitCells(level, objective?.primaryUnit);
      const quota = level.starsPerRow ?? 2;
      return cells.filter(cell => readCellState(gridData[cell]) === 'S').length === quota;
    }
    case 'proof-targets-resolved':
    case 'dependent-conclusion-applied':
      return Boolean(objective?.initialTargets?.length)
        && objective.initialTargets.every(target => targetResolved(gridData, target, objective.action));
    default:
      return false;
  }
}

export function createStarDoubleLessonRuntime(levelId) {
  return {
    levelId,
    stepIndex: 0,
    objective: null,
    completedObjectives: [],
    previousConclusion: null,
    acceptedActionInStep: false,
    lastAcceptedAction: null,
  };
}

export function advanceStarDoubleLessonRuntime(runtime, {
  objective = runtime.objective,
  conclusion = null,
} = {}) {
  const completedObjectives = objective
    ? [...runtime.completedObjectives, objective]
    : runtime.completedObjectives;
  return {
    ...runtime,
    stepIndex: runtime.stepIndex + 1,
    objective: null,
    completedObjectives,
    previousConclusion: conclusion || runtime.previousConclusion,
    acceptedActionInStep: false,
    lastAcceptedAction: null,
  };
}

export function recordStarDoubleLessonAction(runtime, {
  proof,
  cellIndex,
  availableProofIdentitiesBefore,
}) {
  return {
    ...runtime,
    objective: runtime.objective || createStarDoubleLessonObjective(proof),
    acceptedActionInStep: true,
    lastAcceptedAction: {
      cellIndex,
      action: proof.action,
      technique: proof.technique,
      boardStateHashBefore: proof.boardStateHash,
      proofIdentity: getStarDoubleProofIdentity(proof),
      involvedUnits: [...(proof.involvedUnits || [])],
      availableProofIdentitiesBefore: [...new Set(availableProofIdentitiesBefore || [])],
    },
  };
}

export function createStarDoubleChainConclusion(runtime, boardStateHashAfter) {
  if (!runtime.lastAcceptedAction) return null;
  return {
    ...runtime.lastAcceptedAction,
    boardStateHashAfter,
  };
}

export function getStarDoubleLessonActionCopy(proof) {
  if (!proof) return '当前没有可用的课程推理，输入已暂停。';
  return proof.action === 'place-star'
    ? '根据高亮的线索，在确定的位置放置星星。'
    : '根据高亮的线索，把不能放星的位置标成 X。';
}
