import {
  analyzeStarDoubleHumanLogic,
  DEDUCTION_TECHNIQUE,
} from './star-double-human-logic.mjs';
import {
  resolveStarLineDoubleTutorialCells,
  STAR_LINE_DOUBLE_TUTORIAL_CONTRACT,
} from '../src/game/starLine/starLineDoubleTutorialContract.js';

export const STAR_DOUBLE_TEACHING_DIFFICULTY_VERSION = 'star-double-teaching-difficulty-1.0.0';

export const STAR_DOUBLE_TEACHING_STAGES = Object.freeze([
  Object.freeze({ id: 'rules-and-direct', startLevel: 1, endLevel: 3, scoreBase: 50 }),
  Object.freeze({ id: 'independent-basics', startLevel: 4, endLevel: 6, scoreBase: 65 }),
  Object.freeze({ id: 'linked-reasoning', startLevel: 7, endLevel: 9, scoreBase: 80 }),
  Object.freeze({ id: 'graduation', startLevel: 10, endLevel: 10, scoreBase: 88 }),
]);

const BASIC_TECHNIQUES = Object.freeze([
  DEDUCTION_TECHNIQUE.QUOTA_SATURATED,
  DEDUCTION_TECHNIQUE.ADJACENCY_EXCLUSION,
  DEDUCTION_TECHNIQUE.REMAINING_CAPACITY,
  DEDUCTION_TECHNIQUE.TWO_BY_TWO_CAPACITY,
]);

const CROSS_UNIT_TECHNIQUES = new Set([
  DEDUCTION_TECHNIQUE.CONFINED_CAPACITY,
  DEDUCTION_TECHNIQUE.MULTI_UNIT_CONFINEMENT,
  DEDUCTION_TECHNIQUE.PRESSURED_GROUP_EXCLUSION,
]);

function round(value, digits = 3) {
  return Number(value.toFixed(digits));
}

function stageForLesson(lessonNumber) {
  return STAR_DOUBLE_TEACHING_STAGES.find(
    stage => lessonNumber >= stage.startLevel && lessonNumber <= stage.endLevel,
  ) || null;
}

export function getAllowedTeachingTechniques(lessonNumber) {
  const techniques = [...BASIC_TECHNIQUES];
  if (lessonNumber >= 6) techniques.push(DEDUCTION_TECHNIQUE.CONFINED_CAPACITY);
  if (lessonNumber >= 7) techniques.push(DEDUCTION_TECHNIQUE.MULTI_UNIT_CONFINEMENT);
  if (lessonNumber >= 8) techniques.push(DEDUCTION_TECHNIQUE.PRESSURED_GROUP_EXCLUSION);
  return techniques;
}

function longestDependencyChain(canonicalPath) {
  const eventById = new Map(canonicalPath.map(event => [event.id, event]));
  const memo = new Map();
  const visiting = new Set();

  function visit(event) {
    if (memo.has(event.id)) return memo.get(event.id);
    if (visiting.has(event.id)) throw new Error(`deduction dependency cycle: ${event.id}`);
    visiting.add(event.id);
    const prerequisiteDepth = Math.max(
      0,
      ...(event.prerequisiteEvents || []).map(eventId => {
        const prerequisite = eventById.get(eventId);
        return prerequisite ? visit(prerequisite) : 0;
      }),
    );
    visiting.delete(event.id);
    const depth = prerequisiteDepth + 1;
    memo.set(event.id, depth);
    return depth;
  }

  return canonicalPath.length > 0 ? Math.max(...canonicalPath.map(visit)) : 0;
}

function revealedActionCells(levelId) {
  if (levelId !== STAR_LINE_DOUBLE_TUTORIAL_CONTRACT.levelId) return [];
  return [...new Set(STAR_LINE_DOUBLE_TUTORIAL_CONTRACT.steps.flatMap(step => (
    step.revealAction
      ? resolveStarLineDoubleTutorialCells(step, 'actions')
      : []
  )))].sort((a, b) => a - b);
}

function scoreTeachingDifficulty(evidence, lessonNumber) {
  const stage = stageForLesson(lessonNumber);
  if (!stage) throw new Error(`unsupported Star Double teaching lesson: ${lessonNumber}`);
  const positionInStage = lessonNumber - stage.startLevel;

  // The score combines editorial teaching load with replayable trace evidence.
  // Stage/position represents how much prior knowledge the lesson asks the player
  // to combine; the remaining terms are measured directly from the restricted trace.
  return round(
    stage.scoreBase
      + positionInStage * 3
      + evidence.deductionWaveCount * 0.5
      + evidence.firstStarDepth * 0.4
      + evidence.longestPropagationChain * 0.5
      + evidence.crossUnitReasoningCount * 0.2
      + (1 - evidence.forcedMoveRatio) * 5
      + evidence.independentBeforeHintRatio * 3,
    1,
  );
}

export function analyzeStarDoubleTeachingDifficulty(level, lessonNumber) {
  const analysis = analyzeStarDoubleHumanLogic(
    { ...level, quota: 2 },
    {
      solverStatus: 'UNIQUE',
      allowedTechniques: getAllowedTeachingTechniques(lessonNumber),
    },
  );
  const canonicalPath = analysis.canonicalPath || [];
  const deductionWaves = analysis.deductionWaves || [];
  const actualTechniqueCounts = {};
  for (const event of canonicalPath) {
    actualTechniqueCounts[event.technique] = (actualTechniqueCounts[event.technique] || 0) + 1;
  }
  const starWaves = deductionWaves.filter(wave =>
    (wave.events || []).some(event => event.action === 'place-star')).length;
  const revealedCells = revealedActionCells(level.id);
  const traceLength = canonicalPath.length;
  const evidence = {
    version: STAR_DOUBLE_TEACHING_DIFFICULTY_VERSION,
    resultStatus: analysis.status,
    actualTechniqueCounts,
    humanTraceLength: traceLength,
    deductionWaveCount: deductionWaves.length,
    firstStarDepth: deductionWaves.findIndex(wave =>
      (wave.events || []).some(event => event.action === 'place-star')),
    forcedMoveRatio: deductionWaves.length > 0
      ? round(starWaves / deductionWaves.length)
      : 0,
    longestPropagationChain: longestDependencyChain(canonicalPath),
    crossUnitReasoningCount: canonicalPath.filter(event =>
      CROSS_UNIT_TECHNIQUES.has(event.technique)).length,
    independentBeforeHintRatio: traceLength > 0
      ? round((traceLength - revealedCells.length) / traceLength)
      : 0,
    revealedActionCellCount: revealedCells.length,
  };

  return {
    ...evidence,
    difficultyScore: scoreTeachingDifficulty(evidence, lessonNumber),
    analysis,
  };
}

function traceTokens(analysis) {
  return (analysis?.canonicalPath || []).map(event => `${event.technique}:${event.action}`);
}

export function normalizedTeachingTraceSimilarity(firstAnalysis, secondAnalysis) {
  const first = traceTokens(firstAnalysis);
  const second = traceTokens(secondAnalysis);
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
