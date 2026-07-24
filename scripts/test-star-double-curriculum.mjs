import assert from 'node:assert/strict';
import {
  STAR_DOUBLE_CURRICULUM,
  STAR_DOUBLE_PLAYABLE_CURRICULUM,
  STAR_DOUBLE_SIZE_RANGES,
  STAR_DOUBLE_TEACHING_DIFFICULTY_EVIDENCE,
} from '../src/data/starDoubleCurriculum.js';
import { STAR_LINE_DOUBLE_TUTORIAL_CONTRACT } from '../src/game/starLine/starLineDoubleTutorialContract.js';
import {
  STAR_DOUBLE_LEVELS,
  STAR_DOUBLE_MODE_ID,
  findStarLineLevelById,
  getStarLineDisplayNumber,
} from '../src/game/starLine/starLineProgressV2.js';
import {
  d4AlignedRegionMetrics,
  makeCanonicalRegionSig,
  makeCanonicalSolutionSig,
  makeRegionSig,
  makeSolutionSig,
} from './star-line-candidate-signatures.mjs';
import { analyzeDoubleStarCandidate } from './star-double-quality.mjs';
import {
  HUMAN_LOGIC_STATUS,
} from './star-double-human-logic.mjs';
import {
  analyzeStarDoubleCatalogMetrics,
  normalizedReasoningTraceSimilarity,
  STAR_DOUBLE_ADJACENT_SIMILARITY_LIMITS,
} from './star-double-catalog-metrics.mjs';
import {
  STAR_DOUBLE_TEACHING_STAGES,
  analyzeStarDoubleTeachingDifficulty,
  normalizedTeachingTraceSimilarity,
} from './star-double-teaching-difficulty.mjs';

function connected(regions, N, regionId) {
  const remaining = new Set(regions
    .map((value, index) => (value === regionId ? index : -1))
    .filter(index => index >= 0));
  const first = remaining.values().next().value;
  if (first === undefined) return false;
  remaining.delete(first);
  const queue = [first];
  while (queue.length > 0) {
    const cell = queue.shift();
    const row = Math.floor(cell / N);
    const col = cell % N;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nextRow = row + dr;
      const nextCol = col + dc;
      if (nextRow < 0 || nextRow >= N || nextCol < 0 || nextCol >= N) continue;
      const next = nextRow * N + nextCol;
      if (remaining.delete(next)) queue.push(next);
    }
  }
  return remaining.size === 0;
}

assert.equal(STAR_DOUBLE_CURRICULUM.length, 60, '课程目录必须正好 60 槽');
assert.equal(STAR_DOUBLE_PLAYABLE_CURRICULUM.length, 60, 'playable 必须正好 60');
assert.equal(
  STAR_DOUBLE_CURRICULUM.filter(entry => entry.status === 'reserved').length,
  0,
  'reserved 必须为 0',
);
assert.deepEqual(
  STAR_DOUBLE_SIZE_RANGES.map(range => [range.boardSize, range.startSlot, range.endSlot]),
  [[8, 1, 30], [9, 31, 50], [10, 51, 60]],
);

const levelById = new Map(STAR_DOUBLE_LEVELS.map(level => [level.id, level]));
assert.equal(STAR_DOUBLE_LEVELS.length, 60);
assert.deepEqual(
  STAR_DOUBLE_LEVELS.map(level => level.id),
  STAR_DOUBLE_PLAYABLE_CURRICULUM.map(entry => entry.levelId),
  '运行时双星顺序必须来自课程目录',
);

const tutorials = STAR_DOUBLE_PLAYABLE_CURRICULUM.slice(0, 10);
assert(tutorials.every(entry => entry.source === 'tutorial-new' && entry.boardSize === 8));
assert.equal(STAR_LINE_DOUBLE_TUTORIAL_CONTRACT.levelId, tutorials[0].levelId);

const seenRegion = new Map();
const seenCanonicalRegion = new Map();
const seenLargeSolution = new Map();
const seenLargeCanonicalSolution = new Map();
const seenFingerprint = new Map();
const seenExactTrace = new Map();
const previousOpeningBySize = new Map();
const reports = [];

for (const entry of STAR_DOUBLE_PLAYABLE_CURRICULUM) {
  const level = levelById.get(entry.levelId);
  assert(level, `缺少关卡数据: ${entry.levelId}`);
  assert.equal(level.N, entry.boardSize, `${entry.levelId} 尺寸与 manifest 不一致`);
  assert.equal(new Set(level.regions).size, level.N, `${entry.levelId} 星域数量错误`);
  for (const regionId of new Set(level.regions)) {
    assert(connected(level.regions, level.N, regionId), `${entry.levelId} 星域 ${regionId} 不连通`);
  }

  const report = analyzeDoubleStarCandidate({ ...level, candidateId: level.id });
  reports.push(report);
  assert.equal(report.solver?.status, 'unique', `${level.id} 不是唯一解`);
  assert.equal(report.declaredSolutionMatchesSolver, true, `${level.id} 声明解不匹配`);
  assert.equal(
    report.humanLogic?.status,
    'SOLVED_SUPPORTED_RULES',
    `${level.id} 未被当前人类逻辑完整解出`,
  );
  assert.equal(report.traceReplay?.ok, true, `${level.id} trace 无法回放`);
  assert.equal(
    report.reasoningFingerprint?.experience?.normalizedFingerprint,
    entry.reasoningFingerprint,
    `${level.id} reasoning fingerprint 已漂移`,
  );

  const exactRegion = makeRegionSig('starDouble', level.N, 2, level.regions);
  const canonicalRegion = makeCanonicalRegionSig('starDouble', level.N, 2, level.regions);
  assert(!seenRegion.has(exactRegion), `${level.id} exact region 重复 ${seenRegion.get(exactRegion)}`);
  assert(
    !seenCanonicalRegion.has(canonicalRegion),
    `${level.id} D4 region 重复 ${seenCanonicalRegion.get(canonicalRegion)}`,
  );
  seenRegion.set(exactRegion, level.id);
  seenCanonicalRegion.set(canonicalRegion, level.id);

  const fingerprint = entry.reasoningFingerprint;
  assert(!seenFingerprint.has(fingerprint), `${level.id} 推理指纹重复 ${seenFingerprint.get(fingerprint)}`);
  seenFingerprint.set(fingerprint, level.id);
  const exactTraceHash = report.reasoningFingerprint?.exact?.exactTraceHash;
  assert(
    !seenExactTrace.has(exactTraceHash),
    `${level.id} 完整推理路径重复 ${seenExactTrace.get(exactTraceHash)}`,
  );
  seenExactTrace.set(exactTraceHash, level.id);

  if (level.N === 8) {
    const experience = report.reasoningFingerprint.experience;
    const openingExperience = [
      experience.openingTechnique,
      experience.openingD4CanonicalLocation,
      experience.firstStarDepth,
    ].join('|');
    assert.notEqual(
      openingExperience,
      previousOpeningBySize.get(level.N),
      `${level.id} 与相邻 8×8 关开局体验完全相同`,
    );
    previousOpeningBySize.set(level.N, openingExperience);
  }

  if (level.N > 8) {
    const exactSolution = makeSolutionSig('starDouble', level.N, 2, level.solution);
    const canonicalSolution = makeCanonicalSolutionSig('starDouble', level.N, 2, level.solution);
    assert(
      !seenLargeSolution.has(exactSolution),
      `${level.id} exact solution 重复 ${seenLargeSolution.get(exactSolution)}`,
    );
    assert(
      !seenLargeCanonicalSolution.has(canonicalSolution),
      `${level.id} D4 solution 重复 ${seenLargeCanonicalSolution.get(canonicalSolution)}`,
    );
    seenLargeSolution.set(exactSolution, level.id);
    seenLargeCanonicalSolution.set(canonicalSolution, level.id);
  }
}

const catalogMetrics = STAR_DOUBLE_PLAYABLE_CURRICULUM.map((entry, index) => {
  const level = STAR_DOUBLE_LEVELS[index];
  const metrics = analyzeStarDoubleCatalogMetrics(level, reports[index], {
    tutorialNumber: entry.source === 'tutorial-new' ? entry.slot : null,
  });
  assert.equal(entry.openingSignature, metrics.openingSignature, `${level.id} opening signature 已漂移`);
  assert.equal(entry.openingFamily, metrics.openingFamily, `${level.id} opening family 已漂移`);
  assert.equal(entry.dominantTechnique, metrics.dominantTechnique, `${level.id} dominant technique 已漂移`);
  assert.equal(entry.exactTraceHash, metrics.exactTraceHash, `${level.id} exact trace 已漂移`);
  if (entry.source !== 'tutorial-new') {
    assert.equal(entry.difficultyScore, metrics.difficultyScore, `${level.id} 难度分已漂移`);
  }
  return metrics;
});

for (let index = 1; index < STAR_DOUBLE_PLAYABLE_CURRICULUM.length; index += 1) {
  const previousEntry = STAR_DOUBLE_PLAYABLE_CURRICULUM[index - 1];
  const entry = STAR_DOUBLE_PLAYABLE_CURRICULUM[index];
  assert.notEqual(
    entry.openingSignature, previousEntry.openingSignature,
    `${entry.levelId} 与相邻关 opening signature 相同`,
  );
  const recentFamilies = STAR_DOUBLE_PLAYABLE_CURRICULUM
    .slice(Math.max(0, index - 4), index + 1)
    .map(item => item.openingFamily);
  assert(
    recentFamilies.filter(family => family === entry.openingFamily).length <= 2,
    `${entry.levelId} 的 opening family 在连续五关内超过两次`,
  );
  if (index >= 2) {
    const dominants = catalogMetrics.slice(index - 2, index + 1)
      .map(metrics => metrics.dominantTechnique);
    assert(new Set(dominants).size > 1, `${entry.levelId} 形成连续三关相同主要技巧`);
  }
  if (entry.boardSize === previousEntry.boardSize) {
    const regionSimilarity = d4AlignedRegionMetrics(
      STAR_DOUBLE_LEVELS[index - 1].regions, STAR_DOUBLE_LEVELS[index].regions, entry.boardSize,
    ).similarity;
    const traceSimilarity = normalizedReasoningTraceSimilarity(
      reports[index - 1].humanLogic, reports[index].humanLogic,
    );
    assert(
      regionSimilarity <= STAR_DOUBLE_ADJACENT_SIMILARITY_LIMITS.region,
      `${entry.levelId} 相邻 region similarity ${regionSimilarity} 超限`,
    );
    assert(
      traceSimilarity <= STAR_DOUBLE_ADJACENT_SIMILARITY_LIMITS.trace,
      `${entry.levelId} 相邻 trace similarity ${traceSimilarity} 超限`,
    );
  }
}

const sizes = STAR_DOUBLE_CURRICULUM.map(entry => entry.boardSize);
assert(sizes.every((size, index) => index === 0 || size >= sizes[index - 1]), '尺寸序列不得回退');
for (const range of STAR_DOUBLE_SIZE_RANGES) {
  const entries = STAR_DOUBLE_CURRICULUM.slice(range.startSlot - 1, range.endSlot);
  assert(entries.every(entry => entry.boardSize === range.boardSize));
  const firstReserved = entries.findIndex(entry => entry.status === 'reserved');
  if (firstReserved >= 0) {
    assert(entries.slice(firstReserved).every(entry => entry.status === 'reserved'));
  }
}

for (const boardSize of [8, 9, 10]) {
  const entries = STAR_DOUBLE_PLAYABLE_CURRICULUM.filter(entry =>
    entry.boardSize === boardSize && entry.source !== 'tutorial-new');
  for (let index = 1; index < entries.length; index += 1) {
    assert(
      entries[index].difficultyScore + 1 >= entries[index - 1].difficultyScore,
      `${boardSize}×${boardSize} 难度明显倒退`,
    );
  }
}

const promoted = STAR_DOUBLE_LEVELS.filter(level => level.source === 'promoted-candidate');
assert.equal(promoted.length, 21, '21 个候选必须全部正式化');
assert.equal(new Set(promoted.map(level => level.promotedFrom)).size, 21);
assert(promoted.every(level => !level.id.includes('review') && !level.name.includes('候选')));

const expansion = STAR_DOUBLE_LEVELS.filter(level => level.source === 'generated-expansion');
assert.equal(expansion.length, 19, '必须冻结 19 个扩展关');
assert.deepEqual(
  expansion.map(level => level.id).sort(),
  Array.from({ length: 19 }, (_, index) =>
    `star-double-expansion-${String(index + 1).padStart(2, '0')}`),
);
assert(expansion.every(level =>
  Number.isInteger(level.generationSeed) && Number.isInteger(level.generationIndex)));

for (const entry of STAR_DOUBLE_CURRICULUM.filter(item => item.status === 'reserved')) {
  assert.equal(entry.levelId, null);
  assert.equal(findStarLineLevelById(STAR_DOUBLE_MODE_ID, entry.levelId), null);
}

for (const entry of STAR_DOUBLE_PLAYABLE_CURRICULUM) {
  assert.equal(getStarLineDisplayNumber(STAR_DOUBLE_MODE_ID, entry.levelId), entry.slot);
}

const forbiddenPlayerTerms = /MULTI_UNIT|PRESSURED_GROUP|CONFINED_CAPACITY|候选组|总配额|容量传播/i;
for (const level of STAR_DOUBLE_LEVELS.slice(0, 10)) {
  assert(!forbiddenPlayerTerms.test(JSON.stringify({
    teachingFocus: level.teachingFocus,
    playerTechniqueTags: level.playerTechniqueTags,
    completionSummary: level.completionSummary,
  })));
}
assert(STAR_LINE_DOUBLE_TUTORIAL_CONTRACT.steps.every(step =>
  !step.autoApply && !step.autoPlaceStar && !step.autoEliminate));

const expectedTeachingFocus = [
  '认识双星规则',
  '星星周围排除',
  '配额已经满足',
  '剩余位置等于剩余星数',
  '已有一颗，寻找第二颗',
  '区域形状锁定',
  '行列与星域交叉',
  '两个位置必有一星',
  '连续传播',
  '基础逻辑综合',
];
assert.deepEqual(
  STAR_DOUBLE_LEVELS.slice(0, 10).map(level => level.teachingFocus),
  expectedTeachingFocus,
  '前十课必须按固定顺序每关新增一个主要思路',
);

const teachingDifficulty = STAR_DOUBLE_LEVELS.slice(0, 10).map((level, index) => {
  const result = analyzeStarDoubleTeachingDifficulty(level, index + 1);
  assert.equal(
    result.resultStatus,
    HUMAN_LOGIC_STATUS.SOLVED_SUPPORTED_RULES,
    `${level.id} 需要尚未教学的规则`,
  );
  const { analysis, ...actualEvidence } = result;
  const { changeReason, ...storedEvidence } = STAR_DOUBLE_TEACHING_DIFFICULTY_EVIDENCE[index];
  assert(changeReason.length > 0, `${level.id} 缺少与上一关相比的难度变化说明`);
  assert.deepEqual(
    actualEvidence,
    {
      version: 'star-double-teaching-difficulty-1.0.0',
      resultStatus: HUMAN_LOGIC_STATUS.SOLVED_SUPPORTED_RULES,
      ...storedEvidence,
      revealedActionCellCount: index === 0 ? 8 : 0,
    },
    `${level.id} 难度证据已漂移`,
  );
  assert.equal(tutorials[index].difficultyScore, result.difficultyScore);
  assert.equal(tutorials[index].humanTraceLength, result.humanTraceLength);
  assert.equal(tutorials[index].deductionWaveCount, result.deductionWaveCount);
  return result;
});

const teachingScores = teachingDifficulty.map(evidence => evidence.difficultyScore);
for (const stage of STAR_DOUBLE_TEACHING_STAGES) {
  const stageScores = teachingScores.slice(stage.startLevel - 1, stage.endLevel);
  assert(
    stageScores.every((score, index) => index === 0 || score >= stageScores[index - 1]),
    `${stage.id} 阶段内难度下降`,
  );
}
const stageAverages = STAR_DOUBLE_TEACHING_STAGES.map(stage => {
  const stageScores = teachingScores.slice(stage.startLevel - 1, stage.endLevel);
  return stageScores.reduce((sum, score) => sum + score, 0) / stageScores.length;
});
assert(
  stageAverages.every((average, index) => index === 0 || average > stageAverages[index - 1]),
  '四个教学阶段的整体难度必须逐段提升',
);
for (let index = 0; index < teachingScores.length - 2; index += 1) {
  assert(
    teachingScores[index] <= Math.max(teachingScores[index + 1], teachingScores[index + 2]),
    `Lv.${index + 1} 出现高于后两关的异常尖峰`,
  );
}
const firstPostTutorialScore = Math.min(
  ...STAR_DOUBLE_PLAYABLE_CURRICULUM.slice(10, 13).map(entry => entry.difficultyScore),
);
assert(teachingScores[9] > teachingScores[8], 'Lv.10 必须高于 Lv.9');
assert(teachingScores[9] <= firstPostTutorialScore, 'Lv.10 不得高于 Lv.11–13 最简单的一关');

const priorTechniques = new Set(teachingDifficulty.slice(0, 9)
  .flatMap(evidence => Object.keys(evidence.actualTechniqueCounts)));
assert(
  Object.keys(teachingDifficulty[9].actualTechniqueCounts)
    .every(technique => priorTechniques.has(technique)),
  'Lv.10 不得新增推理规则',
);

const teachingLevels = STAR_DOUBLE_LEVELS.slice(0, 10);
let maximumTeachingTraceSimilarity = { similarity: -1, levels: [] };
let maximumTeachingRegionSimilarity = { similarity: -1, levels: [] };
for (let first = 0; first < teachingLevels.length; first += 1) {
  for (let second = first + 1; second < teachingLevels.length; second += 1) {
    const traceSimilarity = normalizedTeachingTraceSimilarity(
      teachingDifficulty[first].analysis,
      teachingDifficulty[second].analysis,
    );
    if (traceSimilarity > maximumTeachingTraceSimilarity.similarity) {
      maximumTeachingTraceSimilarity = {
        similarity: traceSimilarity,
        levels: [first + 1, second + 1],
      };
    }
    assert(traceSimilarity < 0.95, `Lv.${first + 1}/Lv.${second + 1} 完整 trace 明显重复`);

    const regionSimilarity = d4AlignedRegionMetrics(
      teachingLevels[first].regions,
      teachingLevels[second].regions,
      8,
    ).similarity;
    if (regionSimilarity > maximumTeachingRegionSimilarity.similarity) {
      maximumTeachingRegionSimilarity = {
        similarity: regionSimilarity,
        levels: [first + 1, second + 1],
      };
    }
  }
}

console.log(JSON.stringify({
  slots: STAR_DOUBLE_CURRICULUM.length,
  playable: STAR_DOUBLE_PLAYABLE_CURRICULUM.length,
  reserved: 0,
  sources: Object.fromEntries(['tutorial-new', 'existing-official', 'promoted-candidate', 'generated-expansion']
    .map(source => [source, STAR_DOUBLE_PLAYABLE_CURRICULUM.filter(entry => entry.source === source).length])),
  sizes: Object.fromEntries([8, 9, 10].map(size => [
    size,
    {
      playable: STAR_DOUBLE_PLAYABLE_CURRICULUM.filter(entry => entry.boardSize === size).length,
      reserved: STAR_DOUBLE_CURRICULUM.filter(
        entry => entry.boardSize === size && entry.status === 'reserved',
      ).length,
    },
  ])),
  verifiedReports: reports.length,
  teachingDifficulty: {
    scores: teachingScores,
    stageAverages: stageAverages.map(average => Number(average.toFixed(1))),
    maximumTraceSimilarity: maximumTeachingTraceSimilarity,
    maximumRegionSimilarity: maximumTeachingRegionSimilarity,
  },
}, null, 2));
