import assert from 'node:assert/strict';
import {
  STAR_DOUBLE_CURRICULUM,
  STAR_DOUBLE_PLAYABLE_CURRICULUM,
  STAR_DOUBLE_SIZE_RANGES,
} from '../src/data/starDoubleCurriculum.js';
import { STAR_LINE_DOUBLE_TUTORIAL_CONTRACT } from '../src/game/starLine/starLineDoubleTutorialContract.js';
import {
  STAR_DOUBLE_LEVELS,
  STAR_DOUBLE_MODE_ID,
  findStarLineLevelById,
  getStarLineDisplayNumber,
} from '../src/game/starLine/starLineProgressV2.js';
import {
  makeCanonicalRegionSig,
  makeCanonicalSolutionSig,
  makeRegionSig,
  makeSolutionSig,
} from './star-line-candidate-signatures.mjs';
import { analyzeDoubleStarCandidate } from './star-double-quality.mjs';
import {
  DEDUCTION_TECHNIQUE,
  HUMAN_LOGIC_STATUS,
  analyzeStarDoubleHumanLogic,
} from './star-double-human-logic.mjs';

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
assert.equal(STAR_DOUBLE_PLAYABLE_CURRICULUM.length, 41, 'playable 必须正好 41');
assert.equal(
  STAR_DOUBLE_CURRICULUM.filter(entry => entry.status === 'reserved').length,
  19,
  'reserved 必须正好 19',
);
assert.deepEqual(
  STAR_DOUBLE_SIZE_RANGES.map(range => [range.boardSize, range.startSlot, range.endSlot]),
  [[8, 1, 30], [9, 31, 50], [10, 51, 60]],
);

const levelById = new Map(STAR_DOUBLE_LEVELS.map(level => [level.id, level]));
assert.equal(STAR_DOUBLE_LEVELS.length, 41);
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
      entries[index].difficultyScore + 0.1 >= entries[index - 1].difficultyScore,
      `${boardSize}×${boardSize} 难度明显倒退`,
    );
  }
}

const promoted = STAR_DOUBLE_LEVELS.filter(level => level.source === 'promoted-candidate');
assert.equal(promoted.length, 21, '21 个候选必须全部正式化');
assert.equal(new Set(promoted.map(level => level.promotedFrom)).size, 21);
assert(promoted.every(level => !level.id.includes('review') && !level.name.includes('候选')));

for (const entry of STAR_DOUBLE_CURRICULUM.filter(item => item.status === 'reserved')) {
  assert.equal(entry.levelId, null);
  assert.equal(findStarLineLevelById(STAR_DOUBLE_MODE_ID, entry.levelId), null);
}

for (const entry of STAR_DOUBLE_PLAYABLE_CURRICULUM) {
  assert.equal(getStarLineDisplayNumber(STAR_DOUBLE_MODE_ID, entry.levelId), entry.slot);
}

const forbiddenPlayerTerms = /MULTI_UNIT|PRESSURED_GROUP|候选组|总配额|容量传播/i;
for (const level of STAR_DOUBLE_LEVELS.slice(0, 10)) {
  assert(!forbiddenPlayerTerms.test(JSON.stringify(level.playerTechniqueTags || [])));
}

const basicTechniques = [
  DEDUCTION_TECHNIQUE.QUOTA_SATURATED,
  DEDUCTION_TECHNIQUE.ADJACENCY_EXCLUSION,
  DEDUCTION_TECHNIQUE.REMAINING_CAPACITY,
  DEDUCTION_TECHNIQUE.TWO_BY_TWO_CAPACITY,
];
const taughtTechniqueSets = STAR_DOUBLE_LEVELS.slice(0, 10).map((_, index) => {
  const techniques = [...basicTechniques];
  if (index >= 5) techniques.push(DEDUCTION_TECHNIQUE.CONFINED_CAPACITY);
  if (index >= 6) techniques.push(DEDUCTION_TECHNIQUE.MULTI_UNIT_CONFINEMENT);
  if (index >= 7) techniques.push(DEDUCTION_TECHNIQUE.PRESSURED_GROUP_EXCLUSION);
  return techniques;
});
assert.equal(
  new Set(STAR_DOUBLE_LEVELS.slice(0, 10).map(level => level.teachingFocus)).size,
  10,
  '前十课教学重点必须各自独立',
);
STAR_DOUBLE_LEVELS.slice(0, 10).forEach((level, index) => {
  const restricted = analyzeStarDoubleHumanLogic(
    { ...level, quota: 2 },
    {
      solverStatus: 'UNIQUE',
      allowedTechniques: taughtTechniqueSets[index],
    },
  );
  assert.equal(
    restricted.status,
    HUMAN_LOGIC_STATUS.SOLVED_SUPPORTED_RULES,
    `${level.id} 需要尚未教学的规则`,
  );
});

console.log(JSON.stringify({
  slots: STAR_DOUBLE_CURRICULUM.length,
  playable: STAR_DOUBLE_PLAYABLE_CURRICULUM.length,
  reserved: 19,
  sources: Object.fromEntries(['tutorial-new', 'existing-official', 'promoted-candidate']
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
}, null, 2));
