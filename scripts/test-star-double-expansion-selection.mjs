import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { STAR_DOUBLE_EXPANSION_LEVELS } from '../src/data/starDoubleExpansionLevels.js';
import { analyzeDoubleStarCandidate } from './star-double-quality.mjs';
import {
  analyzeStarDoubleCatalogMetrics,
  normalizedReasoningTraceSimilarity,
  STAR_DOUBLE_ADJACENT_SIMILARITY_LIMITS,
  STAR_DOUBLE_CATALOG_METRICS_VERSION,
} from './star-double-catalog-metrics.mjs';
import {
  screenStarDoubleExpansion,
  serializeExpansionScreening,
} from './star-double-expansion-selection.mjs';
import {
  isRepairTargetFilled,
  loadRepairCheckpoint,
  STAR_DOUBLE_REPAIR_VERSION,
} from './star-double-candidate-repair.mjs';

const level = STAR_DOUBLE_EXPANSION_LEVELS[0];
const report = analyzeDoubleStarCandidate({ ...level, candidateId: level.id });
const first = analyzeStarDoubleCatalogMetrics(level, report);
const second = analyzeStarDoubleCatalogMetrics(level, report);
assert.deepEqual(first, second, '目录指标必须确定');
assert.equal(first.version, STAR_DOUBLE_CATALOG_METRICS_VERSION);
assert.equal(first.openingFamily.split('|').length, 4, 'opening family 必须包含位置形态');
assert.equal(normalizedReasoningTraceSimilarity(report.humanLogic, report.humanLogic), 1);
assert.deepEqual(STAR_DOUBLE_ADJACENT_SIMILARITY_LIMITS, { region: 0.5, trace: 0.78 });
const filledNine = { selected: Array.from({ length: 9 }, () => ({ level: { N: 9 } })) };
assert.equal(isRepairTargetFilled(filledNine, 9), true);
assert.equal(isRepairTargetFilled(filledNine, 10), false);

const duplicateProbe = {
  status: 'completed',
  failureReason: null,
  N: level.N,
  seed: level.generationSeed,
  index: 999,
  candidateId: 'star-double-duplicate-probe',
  regions: [...level.regions],
  solution: [...level.solution],
  movedCells: [],
  optimizerClassification: 'FULLY_SOLVED',
  humanLogicStatus: 'SOLVED_SUPPORTED_RULES',
  replay: { ok: true },
  uniqueness: { status: 'UNIQUE' },
};
const screening = screenStarDoubleExpansion({ results: [duplicateProbe] });
const serialized = serializeExpansionScreening(screening);
assert.equal(serialized.eligible.length, 0);
assert.equal(serialized.rejected.length, 1);
assert(serialized.rejected[0].reasons.some(reason => reason.rule === 'exact-region'));
assert(serialized.rejected[0].reasons.some(reason => reason.rule === 'd4-region'));

const tempRoot = mkdtempSync(join(tmpdir(), 'star-double-repair-test-'));
try {
  const missing = loadRepairCheckpoint(join(tempRoot, 'missing.json'));
  assert.equal(missing.version, STAR_DOUBLE_REPAIR_VERSION);
  const invalidPath = join(tempRoot, 'duplicate.json');
  writeFileSync(invalidPath, JSON.stringify({
    version: STAR_DOUBLE_REPAIR_VERSION,
    results: [{ sourceKey: '9:1:0' }, { sourceKey: '9:1:0' }],
  }));
  assert.throws(() => loadRepairCheckpoint(invalidPath), /duplicate repair checkpoint key/);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({
  metricsVersion: first.version,
  openingFamily: first.openingFamily,
  duplicateRules: serialized.rejected[0].reasons.map(reason => reason.rule),
  thresholds: STAR_DOUBLE_ADJACENT_SIMILARITY_LIMITS,
}, null, 2));
