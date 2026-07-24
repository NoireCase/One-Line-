/**
 * Lesson simulator: validates that a candidate level supports the teaching flow.
 * Uses human logic engine for topicRequired/bypass checks.
 * Uses browser-compatible proof engine for runtime validation.
 *
 * Usage: node scripts/simulate-teaching-lesson.mjs <levelId> [--regions regionJson] [--solution solJson]
 */
import { analyzeStarDoubleHumanLogic, DEDUCTION_TECHNIQUE as T, HUMAN_LOGIC_STATUS as S } from './star-double-human-logic.mjs';
import { findAllProofs, filterProofsByTechnique } from '../src/game/starLine/starLineDoubleLessonEngine.js';
import { getStarDoubleLessonContract, COURSE_TYPE } from '../src/game/starLine/starLineDoubleLessonContracts.js';
import { STAR_DOUBLE_TEACHING_LEVELS } from '../src/data/starDoubleTeachingLevels.js';
import { readFileSync, existsSync } from 'node:fs';

function idx(c) { return Array.isArray(c) ? c[0] * 8 + c[1] : c; }

const ALL_BASIC = [T.QUOTA_SATURATED, T.ADJACENCY_EXCLUSION, T.REMAINING_CAPACITY, T.TWO_BY_TWO_CAPACITY];
const ALL_RULES = [...ALL_BASIC, T.CONFINED_CAPACITY, T.MULTI_UNIT_CONFINEMENT, T.PRESSURED_GROUP_EXCLUSION];

function gridDataFromState(state, regions) {
  return state.split('').map((s, i) => ({
    regionId: regions[i], isStarred: s === 'S', isMarkedX: s === 'X',
  }));
}

function stateFromGridData(gd) {
  return gd.map(c => c.isStarred ? 'S' : c.isMarkedX ? 'X' : 'U').join('');
}

export function simulateLesson(puzzle, levelId, options = {}) {
  const contract = getStarDoubleLessonContract(levelId);
  if (!contract) return { pass: false, reason: 'no contract' };

  const N = puzzle.N;
  const regions = puzzle.regions;
  const solution = puzzle.solution;
  const evidence = {
    levelId, courseType: contract.courseType,
    steps: [], metrics: {}, errors: [],
  };

  // Start with empty board
  let gridData = Array.from({ length: N * N }, (_, i) => ({
    regionId: regions[i], isStarred: false, isMarkedX: false,
  }));

  let currentChainStep = 0;

  for (const step of contract.steps) {
    const stepResult = { stepId: step.id, type: step.type, phase: step.phase };

    if (step.type === 'explain' || step.type === 'autonomous' || step.type === 'summary') {
      // These don't involve board actions - just record phase transition
      stepResult.ok = true;
      evidence.steps.push(stepResult);
      continue;
    }

    // Compute ALL proofs from current board state
    const allProofs = findAllProofs({ N, regions, starsPerRow: 2 }, gridData);

    // Filter proofs: for setup, use prerequisite rules; for guided/practice, prefer topic technique
    let relevantProofs;
    if (step.phase === 'setup') {
      const prereqTechs = step.prerequisiteRules || [];
      relevantProofs = allProofs.filter(p => prereqTechs.some(t =>
        p.technique === t || t.includes(p.technique)
      ));
    } else {
      // guided/practice: prefer the step's technique, fall back to any
      relevantProofs = step.technique
        ? allProofs.filter(p => p.technique === step.technique)
        : allProofs;
    }

    // Fallback: if no topic-specific proofs, allow any proof
    if (relevantProofs.length === 0 && step.phase !== 'setup') {
      relevantProofs = allProofs;
    }

    stepResult.availableProofs = relevantProofs.length;
    stepResult.proofTechniques = [...new Set(relevantProofs.map(p => p.technique))];

    if (relevantProofs.length === 0) {
      stepResult.ok = false;
      stepResult.error = `no proofs available for step "${step.id}" (board has ${gridData.filter(c => c.isStarred).length} stars, ${gridData.filter(c => c.isMarkedX).length} Xs)`;
      evidence.steps.push(stepResult);
      evidence.errors.push(stepResult.error);
      continue;
    }

    // Pick the best proof: prefer topic technique for guided, any for setup
    const preferred = relevantProofs.find(p => p.technique === step.technique);
    const proof = preferred || relevantProofs[0];
    stepResult.proofTechnique = proof.technique;
    stepResult.derivedTargets = proof.derivedTargets;
    stepResult.observationCells = proof.observationCells;
    stepResult.evidenceCells = proof.evidenceCells;

    // Simulate player action: apply the proof's action to all targets
    for (const target of proof.derivedTargets) {
      if (proof.action === 'place-star') {
        gridData[target].isStarred = true;
      } else if (proof.action === 'eliminate') {
        gridData[target].isMarkedX = true;
      }
    }
    stepResult.appliedTargets = proof.derivedTargets;
    stepResult.ok = true;

    // Check chain dependencies
    if (step.chainStep) {
      if (step.dependsOnChainStep && step.dependsOnChainStep !== currentChainStep) {
        stepResult.chainError = `depends on chain step ${step.dependsOnChainStep} but current is ${currentChainStep}`;
      }
      currentChainStep = step.chainStep;
    }

    evidence.steps.push(stepResult);
  }

  // ── Compute metrics ──

  // Topic requirement: solve with only prerequisite rules
  const prereqTechs = {
    'adjacency-exclusion': [T.QUOTA_SATURATED, T.REMAINING_CAPACITY, T.TWO_BY_TWO_CAPACITY],
    'quota-saturated': [T.ADJACENCY_EXCLUSION, T.REMAINING_CAPACITY, T.TWO_BY_TWO_CAPACITY],
    'remaining-capacity': [T.QUOTA_SATURATED, T.ADJACENCY_EXCLUSION, T.TWO_BY_TWO_CAPACITY],
    'confined-capacity': ALL_BASIC,
    'cross-unit-confinement': [...ALL_BASIC, T.CONFINED_CAPACITY],
    'shared-conflict-exclusion': [...ALL_BASIC, T.CONFINED_CAPACITY],
  };

  const topicTech = contract.newRule;
  const prereqOnly = prereqTechs[topicTech] || ALL_BASIC;
  const prereqAnalysis = analyzeStarDoubleHumanLogic(
    { N, quota: 2, regions, solution },
    { solverStatus: 'UNIQUE', allowedTechniques: prereqOnly },
  );
  const fullAnalysis = analyzeStarDoubleHumanLogic(
    { N, quota: 2, regions, solution },
    { solverStatus: 'UNIQUE' },
  );
  const bypassAnalysis = topicTech
    ? analyzeStarDoubleHumanLogic(
        { N, quota: 2, regions, solution },
        { solverStatus: 'UNIQUE', allowedTechniques: prereqOnly },
      )
    : null;

  evidence.metrics = {
    prereqStatus: prereqAnalysis.status,
    fullStatus: fullAnalysis.status,
    actualTopicRequired: prereqAnalysis.status !== S.SOLVED_SUPPORTED_RULES,
    autonomousReachable: fullAnalysis.status === S.SOLVED_SUPPORTED_RULES,
    bypassBy2x2: bypassAnalysis?.status === S.SOLVED_SUPPORTED_RULES || false,
    firstTopicEvent: fullAnalysis.canonicalPath?.findIndex(e =>
      topicTech && (e.technique === topicTech || e.supportingTechniques?.includes(topicTech))
    ) ?? -1,
    topicEventCount: fullAnalysis.canonicalPath?.filter(e =>
      topicTech && (e.technique === topicTech || e.supportingTechniques?.includes(topicTech))
    ).length ?? 0,
    guidedStepCount: evidence.steps.filter(s => s.phase === 'guided' && s.ok).length,
    practiceStepCount: evidence.steps.filter(s => s.phase === 'practice' && s.ok).length,
  };

  // Apply course-type-specific gates
  const gates = contract.gates || {};
  evidence.gateResults = {};

  if (contract.courseType === COURSE_TYPE.RULE) {
    evidence.gateResults.topicRequired = { pass: evidence.metrics.actualTopicRequired, value: evidence.metrics.actualTopicRequired };
    evidence.gateResults.autonomousReachable = { pass: evidence.metrics.autonomousReachable, value: evidence.metrics.autonomousReachable };
  }

  if (contract.courseType === COURSE_TYPE.EQUIVALENT_CONCEPT) {
    const adjSteps = evidence.steps.filter(s => s.proofTechnique === 'adjacency-exclusion');
    evidence.gateResults.fullNeighborCoverage = {
      pass: adjSteps.length >= 2,
      value: adjSteps.length,
    };
  }

  if (contract.courseType === COURSE_TYPE.STRATEGY && contract.strategyPattern === 'PROPAGATION_CHAIN') {
    evidence.gateResults.propagationChain = {
      pass: currentChainStep >= 3,
      value: currentChainStep,
    };
  }

  evidence.gateResults.guidedPractice = {
    pass: evidence.metrics.guidedStepCount >= 1 && evidence.metrics.practiceStepCount >= 1,
    guided: evidence.metrics.guidedStepCount,
    practice: evidence.metrics.practiceStepCount,
  };

  // Overall pass
  const allGatesPass = Object.values(evidence.gateResults).every(g => g.pass);
  const noErrors = evidence.errors.length === 0;
  evidence.pass = allGatesPass && noErrors;

  return evidence;
}

// ═══ CLI ═══

function main() {
  const args = process.argv.slice(2);
  const levelId = args[0];
  if (!levelId) {
    console.error('Usage: node simulate-teaching-lesson.mjs <levelId>');
    process.exit(1);
  }

  // Find level
  const lvIdx = STAR_DOUBLE_TEACHING_LEVELS.findIndex(l => l.id === levelId);
  if (lvIdx < 0) {
    console.error(`Level ${levelId} not found`);
    process.exit(1);
  }

  const lv = STAR_DOUBLE_TEACHING_LEVELS[lvIdx];
  const puzzle = { N: lv.N, regions: [...lv.regions], solution: [...lv.solution] };

  const result = simulateLesson(puzzle, levelId);
  console.log(JSON.stringify({
    levelId,
    pass: result.pass,
    courseType: result.courseType,
    steps: result.steps.map(s => ({
      id: s.stepId,
      type: s.type,
      ok: s.ok,
      technique: s.proofTechnique,
      targets: s.derivedTargets?.length,
    })),
    metrics: result.metrics,
    gates: result.gateResults,
    errors: result.errors,
  }, null, 2));
}

const isMain = process.argv[1] && (process.argv[1].endsWith('simulate-teaching-lesson.mjs') || process.argv[1].includes('simulate-teaching-lesson'));
if (isMain) main();
