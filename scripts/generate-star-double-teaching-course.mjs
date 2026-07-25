/**
 * Deterministic, bounded generator for Star Double teaching Lv.2–9.
 *
 * It derives candidates from diverse formal 8×8 catalog layouts. One source
 * region is peeled to a three-cell corridor whose two end cells are legal
 * stars. This creates an early proof-driven placement while retaining the
 * source layout's broader reasoning character.
 *
 * Usage:
 *   node scripts/generate-star-double-teaching-course.mjs --level 2 [--resume]
 */
import { existsSync, readFileSync } from 'node:fs';
import { solveStarLine } from './starLineSolver.mjs';
import {
  analyzeStarDoubleHumanLogic,
  HUMAN_LOGIC_STATUS,
} from './star-double-human-logic.mjs';
import { simulateLesson } from './simulate-teaching-lesson.mjs';
import {
  d4AlignedRegionMetrics,
  makeCanonicalRegionSig,
} from './star-line-candidate-signatures.mjs';
import { computeOpeningFingerprint } from './star-line-fingerprint.mjs';
import { resolveCandidatePath, safeWriteJSON } from './lib/star-line-candidate-io.mjs';
import { STAR_LINE_LEVELS } from '../src/data/starLineLevels.js';
import { STAR_DOUBLE_TEACHING_LEVELS } from '../src/data/starDoubleTeachingLevels.js';
import { analyzeDoubleStarCandidate } from './star-double-quality.mjs';
import {
  analyzeStarDoubleCatalogMetrics,
  normalizedReasoningTraceSimilarity,
  STAR_DOUBLE_ADJACENT_SIMILARITY_LIMITS,
} from './star-double-catalog-metrics.mjs';
import {
  analyzeStarDoubleTeachingDifficulty,
  normalizedTeachingTraceSimilarity,
  STAR_DOUBLE_TEACHING_STAGES,
} from './star-double-teaching-difficulty.mjs';

const N = 8;
const QUOTA = 2;
const LEVEL_IDS = Object.freeze(Object.fromEntries(Array.from(
  { length: 8 },
  (_, index) => [index + 2, `star-double-tutorial-${String(index + 2).padStart(2, '0')}`],
)));
const FIXED_TEACHING_LEVELS = new Set([1, 6, 8, 10]);
const MAX_ATTEMPTS = 4_000;
const MAX_LEVEL_MS = 10 * 60 * 1_000;
const BASE_SEED = 20260725;

function mulberry32(seed) {
  return function random() {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function neighbors4(cell) {
  const row = Math.floor(cell / N);
  const col = cell % N;
  return [[-1, 0], [1, 0], [0, -1], [0, 1]].flatMap(([dr, dc]) => {
    const nextRow = row + dr;
    const nextCol = col + dc;
    return nextRow >= 0 && nextRow < N && nextCol >= 0 && nextCol < N
      ? [nextRow * N + nextCol]
      : [];
  });
}

function regionConnected(regions, regionId, omittedCell = null) {
  const cells = regions.flatMap((value, cell) => (
    value === regionId && cell !== omittedCell ? [cell] : []
  ));
  if (cells.length === 0) return false;
  const remaining = new Set(cells);
  const queue = [cells[0]];
  remaining.delete(cells[0]);
  while (queue.length > 0) {
    for (const neighbor of neighbors4(queue.shift())) {
      if (remaining.delete(neighbor)) queue.push(neighbor);
    }
  }
  return remaining.size === 0;
}

function exactRegionSignature(regions) {
  const labels = new Map();
  let next = 0;
  return regions.map((label) => {
    if (!labels.has(label)) labels.set(label, next++);
    return labels.get(label);
  }).join(',');
}

function traceFingerprint(analysis) {
  return (analysis.canonicalPath || []).map(event => (
    `${event.technique}:${event.action}:${event.sourceUnits?.map(unit => unit.split(':')[0]).join('+') || '-'}`
  )).join('|');
}

function sourceCorridors(level) {
  const stars = new Set(level.solution);
  return [...new Set(level.regions)].flatMap((regionId) => {
    const regionStars = level.regions.flatMap((value, cell) => (
      value === regionId && stars.has(cell) ? [cell] : []
    ));
    if (regionStars.length !== QUOTA) return [];
    const [first, second] = regionStars;
    const firstRow = Math.floor(first / N);
    const firstCol = first % N;
    const secondRow = Math.floor(second / N);
    const secondCol = second % N;
    const straightDistanceTwo = (
      (firstRow === secondRow && Math.abs(firstCol - secondCol) === 2)
      || (firstCol === secondCol && Math.abs(firstRow - secondRow) === 2)
    );
    if (!straightDistanceTwo) return [];
    const middle = (first + second) / 2;
    return level.regions[middle] === regionId
      ? [{ regionId, corridor: [first, middle, second].sort((a, b) => a - b) }]
      : [];
  });
}

function peelOneCorridor(regions, corridorOption, random, protectedRegionIds) {
  const keep = new Set(corridorOption.corridor);
  while (regions.some((regionId, cell) => (
    regionId === corridorOption.regionId && !keep.has(cell)
  ))) {
    const movable = regions.flatMap((regionId, cell) => {
      if (regionId !== corridorOption.regionId || keep.has(cell)) return [];
      const receivers = [...new Set(neighbors4(cell)
        .map(neighbor => regions[neighbor])
        .filter(nextRegion => !protectedRegionIds.has(nextRegion)))];
      if (receivers.length === 0
          || !regionConnected(regions, corridorOption.regionId, cell)) return [];
      return [{ cell, receivers, order: random() }];
    }).sort((first, second) => first.order - second.order);
    if (movable.length === 0) return false;
    const choice = movable[0];
    const receiver = choice.receivers[Math.floor(random() * choice.receivers.length)];
    regions[choice.cell] = receiver;
  }
  return true;
}

function peelCorridors(level, option, seed) {
  const random = mulberry32(seed);
  const regions = [...level.regions];
  const protectedRegionIds = new Set(
    option.corridors.map(corridor => corridor.regionId),
  );
  for (const corridorOption of option.corridors) {
    if (!peelOneCorridor(regions, corridorOption, random, protectedRegionIds)) return null;
  }
  return regions;
}

function isInterior(cell) {
  const row = Math.floor(cell / N);
  const col = cell % N;
  return row > 0 && row < N - 1 && col > 0 && col < N - 1;
}

function sourceOptions(lessonNumber) {
  const levels = STAR_LINE_LEVELS
    .filter(level => (
      level.gameId === 'starDouble'
      && level.N === N
      && !level.id.startsWith('star-double-tutorial-')
    ));
  if (lessonNumber !== 3) {
    return levels.flatMap(level => (
      sourceCorridors(level).map(corridor => ({ level, corridors: [corridor] }))
    ));
  }
  return levels.flatMap((level) => {
    const corridors = sourceCorridors(level).filter(option => (
      option.corridor.filter(cell => level.solution.includes(cell)).some(isInterior)
    ));
    return corridors.flatMap((first, firstIndex) => (
      corridors.slice(firstIndex + 1).map(second => ({
        level,
        corridors: [first, second],
      }))
    ));
  });
}

function loadAcceptedTeachingLevel(lessonNumber) {
  const acceptedPath = resolveCandidatePath(
    `star-double-teaching-final-lv${lessonNumber}-diverse-accepted.json`,
  );
  if (!existsSync(acceptedPath)) return null;
  const accepted = JSON.parse(readFileSync(acceptedPath, 'utf8'));
  return {
    ...STAR_DOUBLE_TEACHING_LEVELS[lessonNumber - 1],
    regions: accepted.regions,
    solution: accepted.solution,
  };
}

function plannedTeachingLevel(lessonNumber) {
  return loadAcceptedTeachingLevel(lessonNumber)
    || (FIXED_TEACHING_LEVELS.has(lessonNumber)
      ? STAR_DOUBLE_TEACHING_LEVELS[lessonNumber - 1]
      : null);
}

function existingSignatures(excludedLevelId) {
  const levels = STAR_LINE_LEVELS.filter(level => (
    level.gameId === 'starDouble' && level.N === N && level.id !== excludedLevelId
  ));
  return {
    exact: new Set(levels.map(level => exactRegionSignature(level.regions))),
    d4: new Set(levels.map(level => makeCanonicalRegionSig('starDouble', N, QUOTA, level.regions))),
    opening: new Set(levels.map(level => computeOpeningFingerprint(N, level.regions, QUOTA).fingerprint)),
    trace: new Set(levels.map((level) => {
      const analysis = analyzeStarDoubleHumanLogic({
        N,
        quota: QUOTA,
        regions: level.regions,
      }, { solverStatus: 'UNIQUE' });
      return traceFingerprint(analysis);
    })),
  };
}

function stageForLesson(lessonNumber) {
  return STAR_DOUBLE_TEACHING_STAGES.find(stage => (
    lessonNumber >= stage.startLevel && lessonNumber <= stage.endLevel
  ));
}

function candidateDiversity({
  candidate,
  lessonNumber,
  report,
  teaching,
}) {
  const failures = [];
  const previous = plannedTeachingLevel(lessonNumber - 1);
  const next = plannedTeachingLevel(lessonNumber + 1);
  for (const [label, neighbor] of [['previous', previous], ['next', next]]) {
    if (!neighbor) continue;
    const neighborReport = analyzeDoubleStarCandidate({ ...neighbor, candidateId: neighbor.id });
    const regionSimilarity = d4AlignedRegionMetrics(
      candidate.regions,
      neighbor.regions,
      N,
    ).similarity;
    const traceSimilarity = normalizedReasoningTraceSimilarity(
      report.humanLogic,
      neighborReport.humanLogic,
    );
    if (regionSimilarity > STAR_DOUBLE_ADJACENT_SIMILARITY_LIMITS.region) {
      failures.push(`${label}-region-similarity:${regionSimilarity}`);
    }
    if (traceSimilarity > STAR_DOUBLE_ADJACENT_SIMILARITY_LIMITS.trace) {
      failures.push(`${label}-trace-similarity:${traceSimilarity}`);
    }
    const candidateMetrics = analyzeStarDoubleCatalogMetrics(candidate, report, { tutorialNumber: lessonNumber });
    const neighborLessonNumber = Number(neighbor.id.match(/(\d+)$/)?.[1]);
    const neighborMetrics = analyzeStarDoubleCatalogMetrics(neighbor, neighborReport, {
      tutorialNumber: neighborLessonNumber,
    });
    if (candidateMetrics.openingSignature === neighborMetrics.openingSignature) {
      failures.push(`${label}-opening-signature`);
    }
  }

  for (let otherLesson = 1; otherLesson <= 10; otherLesson += 1) {
    if (otherLesson === lessonNumber) continue;
    const other = plannedTeachingLevel(otherLesson);
    if (!other) continue;
    const otherTeaching = analyzeStarDoubleTeachingDifficulty(other, otherLesson);
    const similarity = normalizedTeachingTraceSimilarity(teaching.analysis, otherTeaching.analysis);
    if (similarity >= 0.95) failures.push(`teaching-trace-lv${otherLesson}:${similarity}`);
  }

  const stage = stageForLesson(lessonNumber);
  const previousInStage = lessonNumber > stage.startLevel
    ? plannedTeachingLevel(lessonNumber - 1)
    : null;
  const nextInStage = lessonNumber < stage.endLevel
    ? plannedTeachingLevel(lessonNumber + 1)
    : null;
  if (previousInStage) {
    const previousDifficulty = analyzeStarDoubleTeachingDifficulty(
      previousInStage,
      lessonNumber - 1,
    ).difficultyScore;
    if (teaching.difficultyScore < previousDifficulty) {
      failures.push(`difficulty-below-previous:${teaching.difficultyScore}<${previousDifficulty}`);
    }
  }
  if (nextInStage) {
    const nextDifficulty = analyzeStarDoubleTeachingDifficulty(
      nextInStage,
      lessonNumber + 1,
    ).difficultyScore;
    if (teaching.difficultyScore > nextDifficulty) {
      failures.push(`difficulty-above-next:${teaching.difficultyScore}>${nextDifficulty}`);
    }
  }
  return failures;
}

function main() {
  const args = process.argv.slice(2);
  const levelFlag = args.indexOf('--level');
  const lessonNumber = Number(args[levelFlag + 1]);
  if (levelFlag < 0 || !LEVEL_IDS[lessonNumber]) {
    console.error('Usage: node scripts/generate-star-double-teaching-course.mjs --level <2-9> [--resume]');
    process.exit(1);
  }
  if (FIXED_TEACHING_LEVELS.has(lessonNumber)) {
    console.log(`Lv.${lessonNumber}: current layout already passes the formal curriculum`);
    return;
  }

  const levelId = LEVEL_IDS[lessonNumber];
  const checkpointPath = resolveCandidatePath(
    `star-double-teaching-final-lv${lessonNumber}-diverse-checkpoint.json`,
  );
  const acceptedPath = resolveCandidatePath(
    `star-double-teaching-final-lv${lessonNumber}-diverse-accepted.json`,
  );
  if (existsSync(acceptedPath)) {
    console.log(`Lv.${lessonNumber}: diverse accepted candidate already exists`);
    return;
  }

  const resume = args.includes('--resume');
  const checkpoint = resume && existsSync(checkpointPath)
    ? JSON.parse(readFileSync(checkpointPath, 'utf8'))
    : null;
  const startAttempt = checkpoint?.nextAttempt || 0;
  const seen = new Set(checkpoint?.seen || []);
  const existing = existingSignatures(levelId);
  const options = sourceOptions(lessonNumber);
  if (options.length === 0) {
    console.error(`Lv.${lessonNumber}: no catalog source corridors satisfy the lesson entry`);
    process.exit(1);
  }
  const startedAt = Date.now();
  let best = checkpoint?.best || null;

  for (let attempt = startAttempt; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (Date.now() - startedAt > MAX_LEVEL_MS) break;
    const option = options[attempt % options.length];
    const seed = BASE_SEED + lessonNumber * 100_003 + attempt * 7_919;
    const regions = peelCorridors(option.level, option, seed);
    if (!regions) continue;
    const exact = exactRegionSignature(regions);
    const d4 = makeCanonicalRegionSig('starDouble', N, QUOTA, regions);
    if (seen.has(d4) || existing.exact.has(exact) || existing.d4.has(d4)) continue;
    seen.add(d4);

    const solved = solveStarLine(N, regions, {
      starsPerRow: QUOTA,
      starsPerCol: QUOTA,
      starsPerRegion: QUOTA,
    });
    if (solved.status !== 'UNIQUE') continue;
    if (JSON.stringify(solved.solutions[0]) !== JSON.stringify(option.level.solution)) continue;

    const candidate = {
      ...STAR_DOUBLE_TEACHING_LEVELS[lessonNumber - 1],
      N,
      regions,
      solution: solved.solutions[0],
    };
    const analysis = analyzeStarDoubleHumanLogic({
      N,
      quota: QUOTA,
      regions,
    }, { solverStatus: 'UNIQUE' });
    if (analysis.status !== HUMAN_LOGIC_STATUS.SOLVED_SUPPORTED_RULES) continue;
    const opening = computeOpeningFingerprint(N, regions, QUOTA);
    const trace = traceFingerprint(analysis);
    if (existing.opening.has(opening.fingerprint) || existing.trace.has(trace)) continue;

    const simulation = simulateLesson(candidate, levelId);
    const teaching = analyzeStarDoubleTeachingDifficulty(candidate, lessonNumber);
    const report = analyzeDoubleStarCandidate({ ...candidate, candidateId: levelId });
    const diversityFailures = candidateDiversity({
      candidate,
      lessonNumber,
      report,
      teaching,
    });
    const score = Object.values(simulation.gateResults || {}).filter(result => result.pass).length
      - (simulation.errors?.length || 0) * 2
      - diversityFailures.length * 3;
    if (!best || score > best.score) {
      best = {
        score,
        seed,
        attempt,
        sourceLevelId: option.level.id,
        metrics: simulation.metrics,
        diversityFailures,
      };
    }

    safeWriteJSON(checkpointPath, {
      levelId,
      lessonNumber,
      nextAttempt: attempt + 1,
      seen: [...seen].slice(-2_000),
      best,
    }, { force: true });
    if (!simulation.pass
        || teaching.resultStatus !== HUMAN_LOGIC_STATUS.SOLVED_SUPPORTED_RULES
        || report.traceReplay?.ok !== true
        || diversityFailures.length > 0) {
      continue;
    }

    const catalog = analyzeStarDoubleCatalogMetrics(candidate, report, { tutorialNumber: lessonNumber });
    safeWriteJSON(acceptedPath, {
      levelId,
      lessonNumber,
      seed,
      attempt,
      sourceLevelId: option.level.id,
      sourceRegionIds: option.corridors.map(corridor => corridor.regionId),
      corridors: option.corridors.map(corridor => corridor.corridor),
      regions,
      solution: solved.solutions[0],
      exactRegionSignature: exact,
      canonicalRegionSignature: d4,
      openingFingerprint: opening.fingerprint,
      normalizedTraceFingerprint: trace,
      solverStats: solved.stats,
      simulation,
      catalog,
      teaching: {
        ...teaching,
        analysis: undefined,
      },
    }, { force: true });
    console.log(`Lv.${lessonNumber}: accepted seed ${seed} at attempt ${attempt} from ${option.level.id}`);
    console.log(JSON.stringify({
      metrics: simulation.metrics,
      catalog: {
        openingSignature: catalog.openingSignature,
        difficultyScore: catalog.difficultyScore,
      },
      teachingDifficulty: teaching.difficultyScore,
    }));
    return;
  }

  safeWriteJSON(checkpointPath, {
    levelId,
    lessonNumber,
    nextAttempt: Math.min(MAX_ATTEMPTS, startAttempt + MAX_ATTEMPTS),
    seen: [...seen].slice(-2_000),
    best,
    exhausted: true,
  }, { force: true });
  console.error(`Lv.${lessonNumber}: no accepted candidate within budget`);
  console.error(JSON.stringify(best));
  process.exit(1);
}

main();
