import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  isMainThread,
  parentPort,
  Worker,
  workerData,
} from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import { analyzeDoubleStarCandidate } from './star-double-quality.mjs';
import {
  REGION_OPTIMIZER_CLASSIFICATION,
  REGION_OPTIMIZER_VERSION,
  optimizeStarDoubleRegions,
} from './star-double-region-optimizer.mjs';
import {
  createExpansionStopController,
  installExpansionSignalHandlers,
  writeExpansionCheckpointAtomic,
} from './generate-star-double-expansion-pool.mjs';
import {
  screenStarDoubleExpansion,
  STAR_DOUBLE_EXPANSION_TARGETS,
} from './star-double-expansion-selection.mjs';

export const STAR_DOUBLE_REPAIR_VERSION = 'star-double-candidate-repair-1.0.0';
export const STAR_DOUBLE_REPAIR_CHECKPOINT =
  '/tmp/star-double-60-expansion-repair-checkpoint.json';
export const STAR_DOUBLE_REPAIR_LIMITS = Object.freeze({
  perCandidateMs: 75_000,
  totalMs: 12 * 60_000,
  maxCandidates: Object.freeze({ 9: 6, 10: 8 }),
});

const SECOND_STAGE_TIERS = Object.freeze([
  Object.freeze({ tier: 1, maxMovedCells: 6, maxLegalStates: 120 }),
  Object.freeze({ tier: 2, maxMovedCells: 12, maxLegalStates: 240 }),
  Object.freeze({ tier: 3, maxMovedCells: 18, maxLegalStates: 360 }),
]);

function emptyRepairCheckpoint() {
  const now = new Date().toISOString();
  return {
    version: STAR_DOUBLE_REPAIR_VERSION,
    createdAt: now,
    updatedAt: now,
    optimizerVersion: REGION_OPTIMIZER_VERSION,
    results: [],
    lastRun: null,
  };
}

export function loadRepairCheckpoint(checkpointPath = STAR_DOUBLE_REPAIR_CHECKPOINT) {
  if (!existsSync(checkpointPath)) return emptyRepairCheckpoint();
  const checkpoint = JSON.parse(readFileSync(checkpointPath, 'utf8'));
  if (checkpoint.version !== STAR_DOUBLE_REPAIR_VERSION || !Array.isArray(checkpoint.results)) {
    throw new Error('invalid Star Double repair checkpoint');
  }
  const keys = checkpoint.results.map(result => result.sourceKey);
  if (new Set(keys).size !== keys.length) throw new Error('duplicate repair checkpoint key');
  return checkpoint;
}

function sourceKey(entry) {
  return entry.N + ':' + entry.seed + ':' + entry.index;
}

function classRank(classification) {
  if (classification === REGION_OPTIMIZER_CLASSIFICATION.PROPAGATION_GAIN) return 0;
  if (classification === REGION_OPTIMIZER_CLASSIFICATION.ENTRY_GAIN) return 1;
  return 2;
}

function analyzeNearMiss(entry) {
  const level = {
    id: entry.candidateId,
    N: entry.N,
    regions: entry.regions,
    solution: entry.solution,
    starsPerRow: 2,
    starsPerCol: 2,
    starsPerRegion: 2,
  };
  const report = analyzeDoubleStarCandidate({ ...level, candidateId: level.id });
  return {
    entry,
    status: report.humanLogic?.status,
    unknownCount: report.humanLogic?.summary?.finalUnknownCount ?? entry.N * entry.N,
    stallWave: report.humanLogic?.summary?.waveCount ?? 0,
    propagationWaves: report.humanLogic?.deductionWaves?.length ?? 0,
    eventCount: report.humanLogic?.canonicalPath?.length ?? 0,
  };
}

export function rankRepairCandidates(sourceCheckpoint, screening) {
  const selectedKeys = new Set(screening.selected.map(candidate =>
    sourceKey(candidate.checkpointEntry)));
  const alreadySolvedKeys = new Set(screening.eligible.map(candidate =>
    sourceKey(candidate.checkpointEntry)));
  const candidates = sourceCheckpoint.results
    .filter(entry => [9, 10].includes(entry.N) && entry.regions && entry.solution)
    .filter(entry => !selectedKeys.has(sourceKey(entry)) && !alreadySolvedKeys.has(sourceKey(entry)))
    .map(analyzeNearMiss)
    .filter(candidate => candidate.status !== 'SOLVED_SUPPORTED_RULES')
    .sort((first, second) =>
      first.entry.N - second.entry.N
        || first.unknownCount - second.unknownCount
        || second.stallWave - first.stallWave
        || second.propagationWaves - first.propagationWaves
        || classRank(first.entry.optimizerClassification)
          - classRank(second.entry.optimizerClassification)
        || second.eventCount - first.eventCount
        || first.entry.index - second.entry.index);
  return [9, 10].flatMap(N => candidates
    .filter(candidate => candidate.entry.N === N)
    .slice(0, STAR_DOUBLE_REPAIR_LIMITS.maxCandidates[N]));
}

function timeoutRepairResult(task, reason, elapsedMs) {
  return {
    status: 'failed',
    failureReason: reason,
    sourceKey: sourceKey(task.source),
    sourceCandidateId: task.source.candidateId,
    N: task.source.N,
    seed: task.source.seed,
    index: task.source.index,
    candidateId: task.source.candidateId + '-repair',
    repairVersion: STAR_DOUBLE_REPAIR_VERSION,
    optimizerVersion: REGION_OPTIMIZER_VERSION,
    regions: null,
    solution: null,
    movedCells: [],
    mutationHistory: [],
    optimizerClassification: null,
    uniqueness: null,
    humanLogicStatus: null,
    replay: { ok: false },
    signatures: {},
    reasoningFingerprint: null,
    exactTraceHash: null,
    elapsedMs: Number(elapsedMs.toFixed(1)),
  };
}

export function repairCandidate(task) {
  const startedAt = performance.now();
  try {
    const source = task.source;
    const candidate = {
      candidateId: source.candidateId + '-repair',
      N: source.N,
      quota: 2,
      starsPerRow: 2,
      starsPerCol: 2,
      starsPerRegion: 2,
      regions: source.regions,
      solution: source.solution,
    };
    const result = optimizeStarDoubleRegions(candidate, {
      tiers: SECOND_STAGE_TIERS,
      beamWidth: 16,
      zone: { maxCells: Math.min(source.N * source.N, source.N * 3 + 2) },
    });
    return {
      status: 'completed',
      failureReason: null,
      sourceKey: sourceKey(source),
      sourceCandidateId: source.candidateId,
      N: source.N,
      seed: source.seed,
      index: source.index,
      candidateId: candidate.candidateId,
      repairVersion: STAR_DOUBLE_REPAIR_VERSION,
      generatorVersion: source.generatorVersion,
      optimizerVersion: result.optimizerVersion,
      generatorFamily: source.generatorFamily,
      structuralFamily: source.structuralFamily,
      generationMetadata: source.generationMetadata,
      repairMetadata: {
        startedFromOptimizedRegions: true,
        tiers: SECOND_STAGE_TIERS,
        beamWidth: 16,
        zoneMaxCells: source.N * 3 + 2,
      },
      originalRegions: source.regions,
      regions: result.optimizedRegions,
      solution: result.uniquenessResult?.solutions?.[0] || source.solution,
      sourceMutationHistory: source.mutationHistory,
      movedCells: result.movedCells,
      mutationHistory: result.mutationHistory,
      optimizerClassification: result.classification,
      optimizerFinalStatus: result.finalStatus,
      optimizerStopReason: result.stopReason,
      uniqueness: result.uniquenessResult,
      humanLogicStatus: result.optimizedAnalysis?.status || null,
      replay: { ok: result.optimizedSummary?.replayOk === true },
      signatures: result.signatures,
      reasoningFingerprint:
        result.reasoningFingerprint?.experience?.normalizedFingerprint || null,
      reasoningExperience: result.reasoningFingerprint?.experience || null,
      exactTraceHash: result.reasoningFingerprint?.exact?.exactTraceHash || null,
      search: result.search,
      elapsedMs: Number((performance.now() - startedAt).toFixed(1)),
    };
  } catch (error) {
    return timeoutRepairResult(
      task,
      'exception:' + (error?.stack || error?.message || String(error)),
      performance.now() - startedAt,
    );
  }
}

function runRepairWorker(task, timeoutMs, signal) {
  return new Promise(resolve => {
    const startedAt = performance.now();
    const worker = new Worker(new URL(import.meta.url), {
      workerData: { kind: 'star-double-repair', task },
    });
    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      resolve(result);
    };
    const abort = () => {
      worker.terminate();
      finish(timeoutRepairResult(task, signal?.reason || 'interrupted', performance.now() - startedAt));
    };
    const timer = setTimeout(() => {
      worker.terminate();
      finish(timeoutRepairResult(task, 'per-candidate-wall-clock-limit', performance.now() - startedAt));
    }, timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    worker.once('message', finish);
    worker.once('error', error => finish(timeoutRepairResult(
      task,
      'worker-exception:' + (error?.stack || error),
      performance.now() - startedAt,
    )));
  });
}

function combinedScreening(sourceCheckpoint, repairCheckpoint) {
  return screenStarDoubleExpansion({
    results: [...sourceCheckpoint.results, ...repairCheckpoint.results],
  });
}

export function isRepairTargetFilled(screening, N) {
  return screening.selected.filter(candidate => candidate.level.N === N).length
    >= STAR_DOUBLE_EXPANSION_TARGETS[N];
}

function targetReached(screening) {
  return [9, 10].every(N => isRepairTargetFilled(screening, N));
}

export async function runCandidateRepair(options = {}) {
  const sourceCheckpoint = JSON.parse(readFileSync(options.sourceCheckpoint, 'utf8'));
  let repairCheckpoint = loadRepairCheckpoint(options.repairCheckpoint);
  const initialScreening = combinedScreening(sourceCheckpoint, repairCheckpoint);
  const ranked = rankRepairCandidates(sourceCheckpoint, initialScreening);
  const completedKeys = new Set(repairCheckpoint.results.map(result => result.sourceKey));
  const stopController = options.stopController || createExpansionStopController();
  const startedAt = performance.now();
  const executed = [];
  let reason = 'candidates-exhausted';
  for (const candidate of ranked) {
    if (completedKeys.has(sourceKey(candidate.entry))) continue;
    const screening = combinedScreening(sourceCheckpoint, repairCheckpoint);
    if (isRepairTargetFilled(screening, candidate.entry.N)) continue;

    if (targetReached(screening)) {
      reason = 'targets-reached';
      break;
    }
    const elapsedMs = performance.now() - startedAt;
    const remainingMs = options.totalMs - elapsedMs;
    if (remainingMs <= 0) {
      reason = 'stage-wall-clock-limit';
      break;
    }
    const task = { source: candidate.entry };
    const result = await runRepairWorker(
      task,
      Math.min(options.perCandidateMs, remainingMs),
      stopController.signal,
    );
    repairCheckpoint.results.push(result);
    completedKeys.add(result.sourceKey);
    executed.push({ N: result.N, index: result.index, status: result.optimizerClassification || result.failureReason });
    repairCheckpoint = writeExpansionCheckpointAtomic(options.repairCheckpoint, repairCheckpoint);
    console.log(
      'repair ' + result.N + 'x' + result.N + ' index ' + result.index + ': '
        + (result.optimizerClassification || result.failureReason)
        + ' (' + result.elapsedMs + 'ms), checkpoint saved',
    );
    if (stopController.signal.aborted) {
      reason = stopController.signal.reason || 'interrupted';
      break;
    }
  }
  const finalScreening = combinedScreening(sourceCheckpoint, repairCheckpoint);
  if (targetReached(finalScreening)) reason = 'targets-reached';
  repairCheckpoint.lastRun = {
    reason,
    executed,
    elapsedMs: Number((performance.now() - startedAt).toFixed(1)),
    selectedCounts: Object.fromEntries([8, 9, 10].map(N => [
      N,
      finalScreening.selected.filter(candidate => candidate.level.N === N).length,
    ])),
  };
  repairCheckpoint = writeExpansionCheckpointAtomic(options.repairCheckpoint, repairCheckpoint);
  return { repairCheckpoint, screening: finalScreening };
}

async function runCli() {
  const sourceCheckpoint = process.argv[2]
    || '/tmp/star-double-60-expansion-checkpoint-20260726.json';
  const repairCheckpoint = process.argv[3] || STAR_DOUBLE_REPAIR_CHECKPOINT;
  const stopController = createExpansionStopController();
  const removeHandlers = installExpansionSignalHandlers(stopController);
  try {
    const result = await runCandidateRepair({
      sourceCheckpoint,
      repairCheckpoint,
      perCandidateMs: STAR_DOUBLE_REPAIR_LIMITS.perCandidateMs,
      totalMs: STAR_DOUBLE_REPAIR_LIMITS.totalMs,
      stopController,
    });
    console.log(JSON.stringify(result.repairCheckpoint.lastRun, null, 2));
  } finally {
    removeHandlers();
  }
}

if (!isMainThread && workerData?.kind === 'star-double-repair') {
  parentPort.postMessage(repairCandidate(workerData.task));
} else if (isMainThread
    && process.argv[1]
    && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}
