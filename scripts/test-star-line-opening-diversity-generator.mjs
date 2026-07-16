/** Star Line 开局多样性定向生成器固定测试。 */
import { STAR_LINE_LEVELS } from '../src/data/starLineLevels.js';
import {
  generateLegalSingleStarSolution,
  generateOpeningDiversityBatch,
  mulberry32,
  OPENING_DIVERSITY_STRATEGIES,
  OPENING_DIVERSITY_TARGETS,
  validateSingleStarSolution,
} from './generate-star-line-opening-diversity.mjs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (error) { console.log(`  ✗ ${name}: ${error.message}`); failed++; }
}
function assert(condition, message = 'assertion failed') { if (!condition) throw new Error(message); }
function sameSolution(a, b) { return [...a].sort((x, y) => x - y).join(',') === [...b].sort((x, y) => x - y).join(','); }

console.log('\n═══ Star Line 开局多样性生成器固定测试 ═══');

test('1. 答案生成先满足单星行列与不相邻规则', () => {
  const solution = generateLegalSingleStarSolution(8, mulberry32(8801));
  assert(validateSingleStarSolution(8, solution) === null, validateSingleStarSolution(8, solution));
});

const answerGrowth = generateOpeningDiversityBatch({
  N: 5,
  seed: 4915,
  strategy: OPENING_DIVERSITY_STRATEGIES.ANSWER_GROWTH,
  target: OPENING_DIVERSITY_TARGETS.LINE_LOCK_1,
  count: 1,
  maxStructures: 20,
});

test('2. 策略 A 稳定产出唯一解的行列 singleton 开局', () => {
  assert(answerGrowth.candidates.length === 1, JSON.stringify(answerGrowth.stats));
  const candidate = answerGrowth.candidates[0];
  assert(candidate.dynamicOpening.status === 'FIRST_STAR', candidate.dynamicOpening.status);
  assert(candidate.dynamicOpening.openingFamily.endsWith('TO_LINE_SINGLETON'), candidate.dynamicOpening.openingFamily);
  assert(candidate.solverStats && candidate.solution.length === candidate.N, '缺少唯一解结果');
});

const reconstructionBases = STAR_LINE_LEVELS.filter((level) => level.gameId === 'starSingle' && level.N === 10);
const reconstruction = generateOpeningDiversityBatch({
  N: 10,
  seed: 4701,
  strategy: OPENING_DIVERSITY_STRATEGIES.CONTROLLED_RECONSTRUCTION,
  target: OPENING_DIVERSITY_TARGETS.LINE_LOCK_1,
  count: 1,
  maxStructures: 40,
  baseLevels: reconstructionBases,
});

test('3. 策略 B 保留原答案并通过行列锁目标', () => {
  assert(reconstruction.candidates.length === 1, JSON.stringify(reconstruction.stats));
  const candidate = reconstruction.candidates[0];
  const source = reconstructionBases.find((level) => level.id === candidate.sourceLevelId);
  assert(source && sameSolution(candidate.solution, source.solution), '受控重构改变了原答案');
  assert(candidate.dynamicOpening.openingFamily.endsWith('TO_LINE_SINGLETON'), candidate.dynamicOpening.openingFamily);
  assert(candidate.dynamicOpening.causalSpineTypes.filter((type) => type === 'LINE_LOCK_REGION').length === 1,
    `spine=${candidate.dynamicOpening.causalSpineTypes}`);
});

test('4. 批次预算、dynamic exact 与危险状态门禁生效', () => {
  const candidates = [...answerGrowth.candidates, ...reconstruction.candidates];
  assert(answerGrowth.stats.baseValidStructures <= 20 && reconstruction.stats.baseValidStructures <= 40, '超过结构预算');
  assert(new Set(candidates.map((candidate) => candidate.dynamicOpening.exactDynamicSignature)).size === candidates.length,
    '批次间 fixture exact 重复');
  assert(!candidates.some((candidate) => ['SHORT_CONTRADICTION', 'OPENING_DEPTH_CAP'].includes(candidate.dynamicOpening.status)),
    '出现危险 dynamic 状态');
});

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
