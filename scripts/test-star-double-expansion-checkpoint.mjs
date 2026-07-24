import assert from 'node:assert/strict';
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  addCheckpointResult,
  createExpansionStopController,
  loadExpansionCheckpoint,
  parseExpansionArgs,
  runExpansionGeneration,
  writeExpansionCheckpointAtomic,
} from './generate-star-double-expansion-pool.mjs';

const SEED = 20260726;

function makeResult(index, options = {}) {
  const failed = options.failed === true;
  const qualified = options.qualified !== false && !failed;
  return {
    status: failed ? 'failed' : 'completed',
    failureReason: failed ? 'fixture-failure' : null,
    N: 9,
    seed: SEED,
    index,
    candidateId: 'fixture-' + index,
    generatorVersion: 'fixture-generator',
    optimizerVersion: 'fixture-optimizer',
    regions: failed ? null : [index],
    solution: failed ? null : [index],
    mutationHistory: [],
    optimizerClassification: qualified ? 'FULLY_SOLVED' : 'ENTRY_GAIN',
    humanLogicStatus: qualified ? 'SOLVED_SUPPORTED_RULES' : 'STALLED_SUPPORTED_RULES',
    replay: { ok: qualified },
    uniqueness: { status: qualified ? 'UNIQUE' : 'UNKNOWN' },
    signatures: {},
    reasoningFingerprint: qualified ? 'fingerprint-' + index : null,
    exactTraceHash: qualified ? 'trace-' + index : null,
    elapsedMs: 1,
  };
}

function runOptions(checkpointPath, indexes, overrides = {}) {
  return {
    N: 9,
    seed: SEED,
    indexes,
    maxAttempts: 1,
    targetQualified: null,
    wallClockMs: Infinity,
    retry: false,
    checkpointPath,
    ...overrides,
  };
}

const testDirectory = mkdtempSync(join(tmpdir(), 'star-double-checkpoint-test-'));
try {
  const checkpointPath = join(testDirectory, 'incremental.json');
  const persistedCounts = [];
  let calls = 0;
  const firstRun = await runExpansionGeneration(
    runOptions(checkpointPath, [0, 1]),
    {
      candidateRunner: async task => {
        calls++;
        return makeResult(task.index);
      },
      onAfterPersist: ({ checkpointPath: persistedPath }) => {
        persistedCounts.push(JSON.parse(readFileSync(persistedPath, 'utf8')).results.length);
      },
    },
  );
  assert.deepEqual(persistedCounts, [1, 2], '每个 index 后必须立即持久化');
  assert.equal(firstRun.checkpoint.results.length, 2);
  assert.equal(firstRun.summary.reason, 'indexes-complete');
  assert.equal(
    readdirSync(testDirectory).some(name => name.endsWith('.tmp')),
    false,
    '原子写入不得遗留临时文件',
  );

  const resumed = await runExpansionGeneration(
    runOptions(checkpointPath, [0, 1]),
    { candidateRunner: async () => { calls++; return makeResult(99); } },
  );
  assert.equal(calls, 2, 'resume 必须跳过已完成 index');
  assert.deepEqual(resumed.summary.skippedCompleted, [0, 1]);

  const duplicateCheckpoint = loadExpansionCheckpoint(checkpointPath, SEED);
  assert.throws(
    () => addCheckpointResult(duplicateCheckpoint, makeResult(0)),
    /duplicate checkpoint result/,
  );

  const retryPath = join(testDirectory, 'retry.json');
  const retryCheckpoint = loadExpansionCheckpoint(retryPath, SEED);
  addCheckpointResult(retryCheckpoint, makeResult(2, { failed: true }));
  writeExpansionCheckpointAtomic(retryPath, retryCheckpoint);
  let retryCalls = 0;
  const skippedFailure = await runExpansionGeneration(
    runOptions(retryPath, [2]),
    { candidateRunner: async () => { retryCalls++; return makeResult(2); } },
  );
  assert.equal(retryCalls, 0, '失败 index 默认也必须视为已完成');
  assert.deepEqual(skippedFailure.summary.skippedCompleted, [2]);
  const retried = await runExpansionGeneration(
    runOptions(retryPath, [2], { retry: true }),
    { candidateRunner: async () => { retryCalls++; return makeResult(2); } },
  );
  assert.equal(retryCalls, 1, '显式 retry 才能重跑失败 index');
  assert.equal(retried.checkpoint.results.length, 1, 'retry 不得制造重复 key');
  assert.equal(retried.checkpoint.results[0].status, 'completed');

  const interruptPath = join(testDirectory, 'interrupt.json');
  const interruptController = createExpansionStopController();
  const interrupted = await runExpansionGeneration(
    runOptions(interruptPath, [3, 4, 5]),
    {
      stopController: interruptController,
      candidateRunner: async task => makeResult(task.index),
      onAfterPersist: ({ result, stopController }) => {
        if (result.index === 3) stopController.requestStop('SIGINT');
      },
    },
  );
  assert.equal(interrupted.summary.reason, 'SIGINT');
  assert.deepEqual(interrupted.checkpoint.results.map(result => result.index), [3]);
  assert.equal(JSON.parse(readFileSync(interruptPath, 'utf8')).results.length, 1);

  const wallClockPath = join(testDirectory, 'wall-clock.json');
  const wallClock = await runExpansionGeneration(
    runOptions(wallClockPath, [6], { wallClockMs: 20 }),
    {
      candidateRunner: (_task, { signal }) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('fixture abort')), { once: true });
      }),
    },
  );
  assert.equal(wallClock.summary.reason, 'wall-clock-limit');
  assert.equal(wallClock.checkpoint.results.length, 0, '中断中的 index 不得写入半成品');

  const parsed = parseExpansionArgs([
    '--size=9',
    '--indexes=9,10,10,11',
    '--target-qualified=3',
    '--wall-clock-minutes=20',
    '--retry',
  ]);
  assert.deepEqual(parsed.indexes, [9, 10, 11]);
  assert.equal(parsed.targetQualified, 3);
  assert.equal(parsed.wallClockMs, 1_200_000);
  assert.equal(parsed.retry, true);

  console.log(JSON.stringify({
    incrementalSnapshots: persistedCounts,
    resumeSkipped: resumed.summary.skippedCompleted,
    retryReplacedWithoutDuplicate: true,
    interruptedAfterIndexes: interrupted.checkpoint.results.map(result => result.index),
    wallClockProtected: true,
  }, null, 2));
} finally {
  rmSync(testDirectory, { recursive: true, force: true });
}
