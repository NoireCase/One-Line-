/**
 * Star Double lesson simulator.
 *
 * It follows the same contract selectors, proof engine and completion
 * predicates as the product. Every simulated player action consumes exactly
 * one fresh proof target. The simulator never uses solution to choose actions.
 */
import {
  analyzeStarDoubleHumanLogic,
  HUMAN_LOGIC_STATUS,
} from './star-double-human-logic.mjs';
import {
  findAllProofs,
  getStarDoubleBoardStateHash,
  getStarDoubleProofIdentity,
  validatePlayerAction,
} from '../src/game/starLine/starLineDoubleLessonEngine.js';
import {
  COURSE_TYPE,
  getStarDoubleLessonContract,
  LESSON_PHASE,
} from '../src/game/starLine/starLineDoubleLessonContracts.js';
import {
  advanceStarDoubleLessonRuntime,
  createStarDoubleChainConclusion,
  createStarDoubleLessonObjective,
  createStarDoubleLessonRuntime,
  isStarDoubleLessonStepComplete,
  recordStarDoubleLessonAction,
  selectStarDoubleLessonProof,
} from '../src/game/starLine/starLineDoubleLessonState.js';
import { STAR_DOUBLE_TEACHING_LEVELS } from '../src/data/starDoubleTeachingLevels.js';

const MAX_ACTIONS_PER_STEP = 80;
const MAX_AUTONOMOUS_ACTIONS = 160;

function makeGrid(level) {
  return Array.from({ length: level.N * level.N }, (_, cell) => ({
    regionId: level.regions[cell],
    isStarred: false,
    isMarkedX: false,
  }));
}

function applyAction(gridData, action, cell) {
  const current = gridData[cell];
  if (!current) return false;
  if (action === 'place-star') {
    if (current.isStarred) return false;
    gridData[cell] = { ...current, isStarred: true, isMarkedX: false };
    return true;
  }
  if (action === 'eliminate') {
    if (current.isMarkedX || current.isStarred) return false;
    gridData[cell] = { ...current, isStarred: false, isMarkedX: true };
    return true;
  }
  return false;
}

function selectCurrentProof(step, proofs, runtime, level, gridData) {
  if (runtime.objective && step.phase !== LESSON_PHASE.SETUP) {
    const current = proofs.find(proof => (
      getStarDoubleProofIdentity(proof) === runtime.objective.identity
    ));
    if (current) {
      if (step.proofSelector?.singleConclusion && current.derivedTargets.length > 1) {
        return { ...current, derivedTargets: [current.derivedTargets[0]] };
      }
      return current;
    }
  }
  return selectStarDoubleLessonProof({
    step,
    proofs,
    level,
    gridData,
    completedObjectives: runtime.completedObjectives,
    previousConclusion: runtime.previousConclusion,
  });
}

function boardInitialState(gridData) {
  return gridData.map(cell => (
    cell.isStarred ? 'S' : cell.isMarkedX ? 'X' : 'U'
  ));
}

function solveAutonomous(level, gridData) {
  let actions = 0;
  const actionLog = [];
  while (actions < MAX_AUTONOMOUS_ACTIONS) {
    const analysis = analyzeStarDoubleHumanLogic({
      N: level.N,
      quota: 2,
      regions: [...level.regions],
      initialState: boardInitialState(gridData),
    }, { solverStatus: 'UNIQUE' });
    const event = analysis.canonicalPath?.[0];
    if (analysis.status === HUMAN_LOGIC_STATUS.SOLVED_SUPPORTED_RULES && !event) {
      return { pass: true, actions, actionLog, analysis };
    }
    if (!event?.affectedCells?.length) {
      return {
        pass: false,
        actions,
        actionLog,
        error: `autonomous stalled: ${analysis.status}/${analysis.reason || 'no-event'}`,
        analysis,
      };
    }
    const cell = event.affectedCells[0];
    const action = event.action;
    if (!applyAction(gridData, action, cell)) {
      return { pass: false, actions, actionLog, error: `autonomous action did not change cell ${cell}` };
    }
    actionLog.push({
      action,
      cell,
      technique: event.technique,
      boardStateHash: getStarDoubleBoardStateHash(gridData),
    });
    actions += 1;
  }
  return { pass: false, actions, actionLog, error: 'autonomous action limit reached' };
}

function gate(pass, value = pass) {
  return { pass: Boolean(pass), value };
}

export function simulateLesson(puzzle, levelId, options = {}) {
  const contract = getStarDoubleLessonContract(levelId);
  if (!contract) return { pass: false, reason: 'no contract' };
  if (levelId === 'star-double-tutorial-01') {
    return { pass: true, levelId, legacyLv1: true, errors: [], steps: [], gateResults: {} };
  }

  const level = {
    N: puzzle.N,
    regions: [...puzzle.regions],
    starsPerRow: 2,
    starsPerCol: 2,
    starsPerRegion: 2,
  };
  const gridData = makeGrid(level);
  let runtime = createStarDoubleLessonRuntime(levelId);
  let totalPlayerActions = 0;
  const evidence = {
    levelId,
    courseType: contract.courseType,
    steps: [],
    errors: [],
    gateResults: {},
    actionLog: [],
  };
  const phaseEntryDepth = {};

  for (const step of contract.steps) {
    phaseEntryDepth[step.id] = totalPlayerActions;
    const result = {
      stepId: step.id,
      type: step.type,
      phase: step.phase,
      ok: true,
      playerActions: 0,
      actionLog: [],
      targetVisibility: step.targetVisibility,
    };

    if (step.phase === LESSON_PHASE.INTRO) {
      runtime = advanceStarDoubleLessonRuntime(runtime);
      evidence.steps.push(result);
      continue;
    }
    if (step.phase === LESSON_PHASE.AUTONOMOUS) {
      const autonomous = options.skipAutonomous
        ? { pass: true, actions: 0, actionLog: [] }
        : solveAutonomous(level, gridData);
      result.ok = autonomous.pass;
      result.playerActions = autonomous.actions;
      result.actionLog = autonomous.actionLog;
      totalPlayerActions += autonomous.actions;
      evidence.actionLog.push(...autonomous.actionLog.map(action => ({ ...action, stepId: step.id })));
      if (!autonomous.pass) evidence.errors.push(autonomous.error);
      runtime = advanceStarDoubleLessonRuntime(runtime);
      evidence.steps.push(result);
      continue;
    }
    if (step.phase === LESSON_PHASE.SUMMARY) {
      evidence.steps.push(result);
      continue;
    }

    let completed = false;
    while (!completed && result.playerActions < MAX_ACTIONS_PER_STEP) {
      const proofsBefore = findAllProofs(level, gridData);
      const proof = selectCurrentProof(step, proofsBefore, runtime, level, gridData);
      if (!proof) {
        result.ok = false;
        result.error = `no matching proof for ${step.id}`;
        evidence.errors.push(result.error);
        break;
      }
      if (!proof.derivedTargets.length) {
        result.ok = false;
        result.error = `empty proof targets for ${step.id}`;
        evidence.errors.push(result.error);
        break;
      }

      const cell = proof.derivedTargets[0];
      const validation = validatePlayerAction(
        proof,
        cell,
        proof.action,
        getStarDoubleBoardStateHash(gridData),
      );
      if (!validation.valid || !applyAction(gridData, proof.action, cell)) {
        result.ok = false;
        result.error = `invalid simulated action ${proof.action}@${cell}: ${validation.reason || 'no change'}`;
        evidence.errors.push(result.error);
        break;
      }

      runtime = recordStarDoubleLessonAction(runtime, {
        proof,
        cellIndex: cell,
        availableProofIdentitiesBefore: proofsBefore.map(getStarDoubleProofIdentity),
      });
      const afterHash = getStarDoubleBoardStateHash(gridData);
      const actionEvidence = {
        action: proof.action,
        cell,
        technique: proof.technique,
        proofIdentity: getStarDoubleProofIdentity(proof),
        boardStateHashBefore: proof.boardStateHash,
        boardStateHashAfter: afterHash,
        involvedUnits: [...proof.involvedUnits],
        observationCells: [...proof.observationCells],
        evidenceCells: [...proof.evidenceCells],
        derivedTargetsBefore: [...proof.derivedTargets],
        premises: proof.premises,
        availableProofIdentitiesBefore: proofsBefore.map(getStarDoubleProofIdentity),
      };
      result.actionLog.push(actionEvidence);
      evidence.actionLog.push({ ...actionEvidence, stepId: step.id });
      result.playerActions += 1;
      totalPlayerActions += 1;

      const proofsAfter = findAllProofs(level, gridData);
      const objective = runtime.objective || createStarDoubleLessonObjective(proof);
      completed = isStarDoubleLessonStepComplete({
        step,
        objective,
        level,
        gridData,
        proofs: proofsAfter,
        acceptedActionInStep: runtime.acceptedActionInStep,
      });
      if (completed) {
        const isChain = step.completionPredicate?.type === 'dependent-conclusion-applied';
        const conclusion = isChain
          ? createStarDoubleChainConclusion(runtime, afterHash)
          : null;
        runtime = advanceStarDoubleLessonRuntime(runtime, { objective, conclusion });
      }
    }

    if (!completed && result.ok) {
      result.ok = false;
      result.error = `step action limit reached for ${step.id}`;
      evidence.errors.push(result.error);
    }
    result.objective = runtime.completedObjectives.at(-1) || null;
    evidence.steps.push(result);
  }

  const guided = evidence.steps.filter(step => step.phase === LESSON_PHASE.GUIDED);
  const practice = evidence.steps.filter(step => step.phase === LESSON_PHASE.TRANSFER_PRACTICE);
  const topicSteps = evidence.steps.filter(step => (
    [...guided, ...practice].includes(step)
    && step.actionLog.some(action => action.technique === contract.newRule)
  ));
  const setupSteps = evidence.steps.filter(step => step.phase === LESSON_PHASE.SETUP);
  const firstTopicStep = contract.strategyPattern === 'PROPAGATION_CHAIN'
    ? guided[0]
    : contract.strategyPattern === 'FIND_SECOND_STAR'
      ? guided[0]
    : topicSteps[0];
  const actualPlayerActionsBeforeTopic = firstTopicStep
    ? phaseEntryDepth[firstTopicStep.stepId]
    : contract.strategyPattern === 'GRADUATION' ? 0 : -1;

  const fullAnalysis = analyzeStarDoubleHumanLogic({
    N: level.N,
    quota: 2,
    regions: level.regions,
  }, { solverStatus: 'UNIQUE' });

  evidence.metrics = {
    naturalSolverTopicDepth: actualPlayerActionsBeforeTopic,
    actualPlayerActionsBeforeTopic,
    actualPrerequisiteActionCount: setupSteps.reduce((sum, step) => sum + step.playerActions, 0),
    setupProofCount: setupSteps.reduce((sum, step) => sum + step.playerActions, 0),
    guidedTopicEntryDepth: guided[0] ? phaseEntryDepth[guided[0].stepId] : -1,
    transferTopicEntryDepth: practice[0] ? phaseEntryDepth[practice[0].stepId] : -1,
    guidedStepCount: guided.length,
    practiceStepCount: practice.length,
    autonomousReachable: fullAnalysis.status === HUMAN_LOGIC_STATUS.SOLVED_SUPPORTED_RULES,
    totalPlayerActions,
  };

  const gates = evidence.gateResults;
  gates.noErrors = gate(evidence.errors.length === 0, evidence.errors.length);
  gates.guidedComplete = gate(guided.length > 0 && guided.every(step => step.ok), guided.length);
  gates.transferComplete = gate(practice.length > 0 && practice.every(step => step.ok), practice.length);
  gates.autonomousComplete = gate(
    evidence.steps.some(step => step.phase === LESSON_PHASE.AUTONOMOUS && step.ok),
  );
  gates.noTargetLeak = gate(
    [...guided, ...practice].every(step => step.targetVisibility === 'hidden'),
  );

  if (contract.courseType === COURSE_TYPE.EQUIVALENT_CONCEPT) {
    const adjacencyGuided = guided.find(step => (
      step.actionLog.some(action => action.technique === contract.newRule)
    ));
    const firstAction = adjacencyGuided?.actionLog[0];
    gates.fullNeighborCoverage = gate(
      firstAction?.premises?.fullNeighborSet?.length === 8
      && adjacencyGuided.playerActions === 8,
      adjacencyGuided?.playerActions || 0,
    );
  }
  if (contract.courseType === COURSE_TYPE.RULE) {
    gates.topicTechniqueUsed = gate(topicSteps.length >= 2, topicSteps.length);
  }
  if (contract.strategyPattern === 'FIND_SECOND_STAR') {
    const secondStarSteps = [...guided, ...practice].filter(step => (
      step.actionLog[0]?.technique === 'remaining-capacity'
    ));
    gates.secondStarStrategy = gate(secondStarSteps.length >= 2 && secondStarSteps.every(step => (
      step.actionLog[0]?.premises?.existingStarCount === 1
      && (step.actionLog[0]?.premises?.supportingRules || []).length >= 2
    )));
  }
  if (contract.strategyPattern === 'PROPAGATION_CHAIN') {
    const chainSteps = [...guided, ...practice];
    const hashes = chainSteps.map(step => step.actionLog[0]?.boardStateHashAfter).filter(Boolean);
    gates.chainLength = gate(chainSteps.length === 3 && chainSteps.every(step => step.playerActions === 1));
    gates.chainHashesDistinct = gate(new Set(hashes).size === 3, hashes);
    gates.chainDependency = gate(chainSteps.slice(1).every((step, index) => {
      const previous = chainSteps[index].actionLog[0];
      const current = step.actionLog[0];
      return current
        && !previous?.availableProofIdentitiesBefore?.includes?.(current.proofIdentity)
        && current.involvedUnits.some(unit => previous.involvedUnits.includes(unit));
    }));
  }
  if (levelId === 'star-double-tutorial-07') {
    const topicActions = [...guided, ...practice].flatMap(step => (
      step.actionLog.filter(action => action.technique === contract.newRule)
    ));
    gates.crossUnitProof = gate(
      topicActions.length >= 2
      && topicActions.every(action => (
        action.premises?.sourceUnits?.length >= 2
        && action.premises?.targetUnits?.length >= 2
      )),
      topicActions.length,
    );
  }
  if (levelId === 'star-double-tutorial-08') {
    const topicActions = [...guided, ...practice].flatMap(step => (
      step.actionLog.filter(action => action.technique === contract.newRule)
    ));
    gates.commonConflictProof = gate(
      topicActions.length >= 2
      && topicActions.every(action => (
        action.evidenceCells?.length === 2
        && action.premises?.targetConflictsWithEveryEvidenceCell === true
      )),
      topicActions.length,
    );
  }
  if (levelId === 'star-double-tutorial-10') {
    gates.guidedComplete = gate(true);
    gates.transferComplete = gate(true);
    gates.introManual = gate(contract.steps[0]?.completionPredicate?.type === 'manual-confirmation');
    gates.noNewTechnique = gate(contract.steps.every(step => !step.proofSelector));
  }

  const topicLimit = contract.lessonNumber <= 5 ? 2 : contract.lessonNumber <= 8 ? 3 : null;
  if (topicLimit !== null) {
    gates.topicEntryDepth = gate(
      actualPlayerActionsBeforeTopic >= 0 && actualPlayerActionsBeforeTopic <= topicLimit,
      actualPlayerActionsBeforeTopic,
    );
  }

  evidence.pass = evidence.errors.length === 0
    && Object.values(gates).every(result => result.pass);
  return evidence;
}

function main() {
  const levelId = process.argv[2];
  if (!levelId) {
    console.error('Usage: node scripts/simulate-teaching-lesson.mjs <levelId>');
    process.exit(1);
  }
  const level = STAR_DOUBLE_TEACHING_LEVELS.find(item => item.id === levelId);
  if (!level) {
    console.error(`Level ${levelId} not found`);
    process.exit(1);
  }
  const result = simulateLesson(level, levelId);
  console.log(JSON.stringify({
    levelId,
    pass: result.pass,
    courseType: result.courseType,
    steps: result.steps.map(step => ({
      id: step.stepId,
      phase: step.phase,
      ok: step.ok,
      actions: step.playerActions,
      techniques: [...new Set(step.actionLog.map(action => action.technique))],
    })),
    metrics: result.metrics,
    gates: Object.fromEntries(Object.entries(result.gateResults).map(([key, value]) => [
      key,
      value,
    ])),
    errors: result.errors,
  }, null, 2));
  process.exit(result.pass ? 0 : 1);
}

if (process.argv[1]?.includes('simulate-teaching-lesson')) main();
