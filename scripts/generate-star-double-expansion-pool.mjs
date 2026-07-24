import {
  existsSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import {
  isMainThread,
  parentPort,
  Worker,
  workerData,
} from 'node:worker_threads';
import {
  GENERATOR_VERSION,
  generateDoubleStarCandidate,
} from './star-double-generator.mjs';
import {
  REGION_OPTIMIZER_CLASSIFICATION,
  REGION_OPTIMIZER_VERSION,
  optimizeStarDoubleRegions,
} from './star-double-region-optimizer.mjs';

export const STAR_DOUBLE_EXPANSION_CONFIG = Object.freeze({
  seed: 20260726,
  maxAttemptsPerCandidate: 500,
  checkpoint: '/tmp/star-double-60-expansion-checkpoint-20260726.json',
});

export const STAR_DOUBLE_EXPANSION_CHECKPOINT_VERSION =
  'star-double-expansion-checkpoint-1.0.0';

function checkpointKey(N, seed, index) {
  return N + ':' + seed + ':' + index;
}

function roundMs(value) {
  return Number(value.toFixed(1));
}

function makeEmptyCheckpoint(seed = STAR_DOUBLE_EXPANSION_CONFIG.seed) {
  const now = new Date().toISOString();
  return {
    version: STAR_DOUBLE_EXPANSION_CHECKPOINT_VERSION,
    seed,
    generatorVersion: GENERATOR_VERSION,
    optimizerVersion: REGION_OPTIMIZER_VERSION,
    createdAt: now,
    updatedAt: now,
    results: [],
    lastRun: null,
  };
}

function validateCheckpoint(checkpoint, expectedSeed) {
  if (checkpoint?.version !== STAR_DOUBLE_EXPANSION_CHECKPOINT_VERSION) {
    throw new Error('unsupported Star Double expansion checkpoint version');
  }
  if (checkpoint.seed !== expectedSeed) {
    throw new Error('checkpoint seed mismatch: ' + checkpoint.seed + ' !== ' + expectedSeed);
  }
  if (!Array.isArray(checkpoint.results)) {
    throw new Error('checkpoint results must be an array');
  }
  const seen = new Set();
  for (const result of checkpoint.results) {
    const key = checkpointKey(result.N, result.seed, result.index);
    if (seen.has(key)) throw new Error('duplicate checkpoint result: ' + key);
    seen.add(key);
  }
  return checkpoint;
}

export function loadExpansionCheckpoint(
  checkpointPath,
  expectedSeed = STAR_DOUBLE_EXPANSION_CONFIG.seed,
) {
  if (!existsSync(checkpointPath)) return makeEmptyCheckpoint(expectedSeed);
  return validateCheckpoint(
    JSON.parse(readFileSync(checkpointPath, 'utf8')),
    expectedSeed,
  );
}

export function writeExpansionCheckpointAtomic(checkpointPath, checkpoint) {
  const temporaryPath = join(
    dirname(checkpointPath),
    '.' + basename(checkpointPath) + '.' + process.pid + '.tmp',
  );
  const next = {
    ...checkpoint,
    updatedAt: new Date().toISOString(),
  };
  try {
    writeFileSync(temporaryPath, JSON.stringify(next, null, 2) + '\n');
    renameSync(temporaryPath, checkpointPath);
  } catch (error) {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    throw error;
  }
  return next;
}

export function addCheckpointResult(checkpoint, result, options = {}) {
  const key = checkpointKey(result.N, result.seed, result.index);
  const existingIndex = checkpoint.results.findIndex(entry =>
    checkpointKey(entry.N, entry.seed, entry.index) === key);
  if (existingIndex >= 0) {
    const existing = checkpoint.results[existingIndex];
    if (!options.retry || existing.status !== 'failed') {
      throw new Error('duplicate checkpoint result: ' + key);
    }
    checkpoint.results[existingIndex] = result;
    return 'replaced-failure';
  }
  checkpoint.results.push(result);
  checkpoint.results.sort((first, second) =>
    first.N - second.N || first.seed - second.seed || first.index - second.index);
  return 'added';
}

export function isQualifiedExpansionResult(result) {
  return result?.status === 'completed'
    && result.optimizerClassification === REGION_OPTIMIZER_CLASSIFICATION.FULLY_SOLVED
    && result.humanLogicStatus === 'SOLVED_SUPPORTED_RULES'
    && result.replay?.ok === true
    && result.uniqueness?.status === 'UNIQUE';
}

function makeFailureResult(task, elapsedMs, failureReason) {
  return {
    status: 'failed',
    failureReason,
    N: task.N,
    seed: task.seed,
    index: task.index,
    candidateId: 'star-double-' + task.N + 'x' + task.N + '-s' + task.seed + '-i' + task.index,
    generatorVersion: GENERATOR_VERSION,
    optimizerVersion: REGION_OPTIMIZER_VERSION,
    generatorFamily: null,
    structuralFamily: null,
    generationMetadata: null,
    originalRegions: null,
    regions: null,
    solution: null,
    movedCells: [],
    mutationHistory: [],
    optimizerClassification: null,
    optimizerFinalStatus: null,
    optimizerStopReason: null,
    uniqueness: null,
    humanLogicStatus: null,
    replay: { ok: false },
    signatures: {
      exactRegion: null,
      d4Region: null,
      exactSolution: null,
      d4Solution: null,
    },
    reasoningFingerprint: null,
    reasoningExperience: null,
    exactTraceHash: null,
    search: null,
    elapsedMs: roundMs(elapsedMs),
  };
}

function summarizeResult(task, candidate, result, elapsedMs) {
  const solution = result.uniquenessResult?.solutions?.[0] || candidate.solution;
  return {
    status: 'completed',
    failureReason: null,
    N: task.N,
    seed: task.seed,
    index: task.index,
    candidateId: candidate.candidateId,
    generatorVersion: candidate.generationMetadata?.generatorVersion || GENERATOR_VERSION,
    optimizerVersion: result.optimizerVersion || REGION_OPTIMIZER_VERSION,
    generatorFamily: candidate.generatorFamily,
    structuralFamily: candidate.structuralFamily,
    generationMetadata: candidate.generationMetadata,
    originalRegions: result.originalRegions,
    regions: result.optimizedRegions,
    solution,
    movedCells: result.movedCells,
    mutationHistory: result.mutationHistory,
    optimizerClassification: result.classification,
    optimizerFinalStatus: result.finalStatus,
    optimizerStopReason: result.stopReason,
    uniqueness: result.uniquenessResult,
    humanLogicStatus: result.optimizedAnalysis?.status || null,
    replay: {
      ok: result.optimizedSummary?.replayOk === true,
      solutionConsistencyErrorCount:
        result.optimizedSummary?.solutionConsistencyErrorCount ?? null,
    },
    signatures: {
      exactRegion: result.signatures?.exactRegion || null,
      d4Region: result.signatures?.d4Region || null,
      exactSolution: result.signatures?.exactSolution || null,
      d4Solution: result.signatures?.d4Solution || null,
    },
    reasoningFingerprint:
      result.reasoningFingerprint?.experience?.normalizedFingerprint || null,
    reasoningExperience: result.reasoningFingerprint?.experience || null,
    exactTraceHash: result.reasoningFingerprint?.exact?.exactTraceHash || null,
    search: result.search,
    elapsedMs: roundMs(elapsedMs),
  };
}

export function generateExpansionIndex(task) {
  const startedAt = performance.now();
  try {
    const candidate = generateDoubleStarCandidate(task.N, task.seed, task.index, {
      maxAttempts: task.maxAttempts,
    });
    if (!candidate) {
      return makeFailureResult(
        task,
        performance.now() - startedAt,
        'generator-attempt-limit',
      );
    }
    const result = optimizeStarDoubleRegions(candidate);
    return summarizeResult(task, candidate, result, performance.now() - startedAt);
  } catch (error) {
    return makeFailureResult(
      task,
      performance.now() - startedAt,
      'exception:' + (error?.stack || error?.message || String(error)),
    );
  }
}

class CandidateInterruptedError extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'CandidateInterruptedError';
  }
}

export function runExpansionIndexWorker(task, options = {}) {
  const signal = options.signal;
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), {
      workerData: { kind: 'star-double-expansion-index', task },
    });
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abort);
      callback(value);
    };
    const abort = () => {
      worker.terminate();
      finish(reject, new CandidateInterruptedError(signal?.reason || 'interrupted'));
    };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    worker.once('message', result => finish(resolve, result));
    worker.once('error', error => finish(reject, error));
    worker.once('exit', code => {
      if (!settled && code !== 0) {
        finish(reject, new Error('expansion worker exited with code ' + code));
      }
    });
  });
}

export function createExpansionStopController() {
  const controller = new AbortController();
  let reason = null;
  return {
    signal: controller.signal,
    get reason() { return reason; },
    requestStop(nextReason) {
      if (controller.signal.aborted) return false;
      reason = nextReason;
      controller.abort(nextReason);
      return true;
    },
  };
}

export function installExpansionSignalHandlers(stopController) {
  const onSigint = () => stopController.requestStop('SIGINT');
  const onSigterm = () => stopController.requestStop('SIGTERM');
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);
  return () => {
    process.removeListener('SIGINT', onSigint);
    process.removeListener('SIGTERM', onSigterm);
  };
}

function completedResultMap(checkpoint) {
  return new Map(checkpoint.results.map(result => [
    checkpointKey(result.N, result.seed, result.index),
    result,
  ]));
}

function qualifiedCount(checkpoint, N, seed) {
  return checkpoint.results.filter(result =>
    result.N === N && result.seed === seed && isQualifiedExpansionResult(result)).length;
}

function makeRunSummary(options, checkpoint, state, reason, elapsedMs) {
  return {
    reason,
    N: options.N,
    seed: options.seed,
    requestedIndexes: options.indexes,
    completedThisRun: state.completedThisRun,
    failedThisRun: state.failedThisRun,
    skippedCompleted: state.skippedCompleted,
    qualifiedForSize: qualifiedCount(checkpoint, options.N, options.seed),
    elapsedMs: roundMs(elapsedMs),
    finishedAt: new Date().toISOString(),
  };
}

export async function runExpansionGeneration(options, dependencies = {}) {
  const candidateRunner = dependencies.candidateRunner || runExpansionIndexWorker;
  const stopController = dependencies.stopController || createExpansionStopController();
  const checkpointPath = options.checkpointPath || STAR_DOUBLE_EXPANSION_CONFIG.checkpoint;
  let checkpoint = loadExpansionCheckpoint(checkpointPath, options.seed);
  const state = {
    completedThisRun: [],
    failedThisRun: [],
    skippedCompleted: [],
  };
  const startedAt = performance.now();
  const wallClockMs = Number.isFinite(options.wallClockMs)
    ? Math.max(0, options.wallClockMs)
    : Infinity;
  let wallClockTimer = null;
  if (Number.isFinite(wallClockMs)) {
    wallClockTimer = setTimeout(
      () => stopController.requestStop('wall-clock-limit'),
      wallClockMs,
    );
  }
  let stopReason = 'indexes-complete';
  try {
    const existingByKey = completedResultMap(checkpoint);
    for (const index of options.indexes) {
      if (stopController.signal.aborted) {
        stopReason = stopController.reason || 'interrupted';
        break;
      }
      if (options.targetQualified !== null
          && qualifiedCount(checkpoint, options.N, options.seed) >= options.targetQualified) {
        stopReason = 'target-qualified-reached';
        break;
      }
      const key = checkpointKey(options.N, options.seed, index);
      const existing = existingByKey.get(key);
      if (existing && !(options.retry && existing.status === 'failed')) {
        state.skippedCompleted.push(index);
        continue;
      }
      const task = {
        N: options.N,
        seed: options.seed,
        index,
        maxAttempts: options.maxAttempts,
      };
      let result;
      try {
        result = await candidateRunner(task, { signal: stopController.signal });
      } catch (error) {
        if (error instanceof CandidateInterruptedError || stopController.signal.aborted) {
          stopReason = stopController.reason || 'interrupted';
          break;
        }
        result = makeFailureResult(task, 0, 'worker-exception:' + (error?.stack || error));
      }
      addCheckpointResult(checkpoint, result, { retry: options.retry });
      existingByKey.set(key, result);
      checkpoint = writeExpansionCheckpointAtomic(checkpointPath, checkpoint);
      if (result.status === 'completed') state.completedThisRun.push(index);
      else state.failedThisRun.push(index);
      await dependencies.onAfterPersist?.({
        checkpoint,
        result,
        stopController,
        checkpointPath,
      });
      console.log(
        options.N + 'x' + options.N + ' index ' + index + ': '
          + (result.optimizerClassification || result.failureReason)
          + ' (' + result.elapsedMs + 'ms), checkpoint saved',
      );
    }
    if (stopController.signal.aborted && stopReason === 'indexes-complete') {
      stopReason = stopController.reason || 'interrupted';
    }
  } finally {
    if (wallClockTimer) clearTimeout(wallClockTimer);
    checkpoint.lastRun = makeRunSummary(
      options,
      checkpoint,
      state,
      stopReason,
      performance.now() - startedAt,
    );
    checkpoint = writeExpansionCheckpointAtomic(checkpointPath, checkpoint);
  }
  return { checkpoint, summary: checkpoint.lastRun, checkpointPath };
}

function parseNumberOption(argv, name, fallback = null) {
  const prefix = '--' + name + '=';
  const argument = argv.find(value => value.startsWith(prefix));
  return argument ? Number(argument.slice(prefix.length)) : fallback;
}

export function parseExpansionArgs(argv) {
  const N = parseNumberOption(argv, 'size');
  const seed = parseNumberOption(argv, 'seed', STAR_DOUBLE_EXPANSION_CONFIG.seed);
  const maxAttempts = parseNumberOption(
    argv,
    'max-attempts',
    STAR_DOUBLE_EXPANSION_CONFIG.maxAttemptsPerCandidate,
  );
  const targetQualified = parseNumberOption(argv, 'target-qualified');
  const wallClockMinutes = parseNumberOption(argv, 'wall-clock-minutes');
  const wallClockMsOption = parseNumberOption(argv, 'wall-clock-ms');
  const indexArgument = argv.find(value => value.startsWith('--indexes='));
  const checkpointArgument = argv.find(value => value.startsWith('--checkpoint='));
  if (![8, 9, 10].includes(N)) throw new Error('--size must be 8, 9, or 10');
  if (!indexArgument) throw new Error('--indexes is required');
  const indexes = [...new Set(indexArgument.slice('--indexes='.length)
    .split(',').filter(Boolean).map(Number))];
  if (indexes.length === 0 || indexes.some(index => !Number.isInteger(index) || index < 0)) {
    throw new Error('--indexes must contain non-negative integers');
  }
  const wallClockMs = wallClockMsOption ?? (
    wallClockMinutes === null ? Infinity : wallClockMinutes * 60_000
  );
  if (!(wallClockMs >= 0)) throw new Error('wall-clock limit must be non-negative');
  if (targetQualified !== null
      && (!Number.isInteger(targetQualified) || targetQualified < 1)) {
    throw new Error('--target-qualified must be a positive integer');
  }
  return {
    N,
    seed,
    indexes,
    maxAttempts,
    targetQualified,
    wallClockMs,
    retry: argv.includes('--retry'),
    checkpointPath: checkpointArgument
      ? checkpointArgument.slice('--checkpoint='.length)
      : STAR_DOUBLE_EXPANSION_CONFIG.checkpoint,
  };
}

async function runCli() {
  const options = parseExpansionArgs(process.argv.slice(2));
  const stopController = createExpansionStopController();
  const removeSignalHandlers = installExpansionSignalHandlers(stopController);
  try {
    const result = await runExpansionGeneration(options, { stopController });
    console.log(JSON.stringify({
      checkpoint: result.checkpointPath,
      ...result.summary,
    }, null, 2));
    if (['SIGINT', 'SIGTERM'].includes(result.summary.reason)) {
      process.exitCode = result.summary.reason === 'SIGINT' ? 130 : 143;
    }
  } finally {
    removeSignalHandlers();
  }
}

if (!isMainThread && workerData?.kind === 'star-double-expansion-index') {
  parentPort.postMessage(generateExpansionIndex(workerData.task));
} else if (isMainThread
    && process.argv[1]
    && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}
