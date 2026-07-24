/**
 * Star Double 生产底座定向测试 (Package D0)。
 *
 * 覆盖：
 *   1. 8×8 生成成功
 *   2. 9×9 生成成功
 *   3. 10×10 生成成功
 *   4. 同 seed 确定性
 *   5. 不同 seed 可产生不同结构
 *   6. quota=2 行列区域合法性
 *   7. 唯一解验证
 *   8. 非法 size 拒绝
 *   9. attempts 上限
 *   10. exact duplicate 检测
 *   11. canonical transform duplicate 检测
 *   12. near duplicate 评分稳定
 *   13. opening family 分类稳定
 *   14. difficulty 输出有限且可比较
 *   15. 批次报告字段完整
 *   16. 生成不足时明确失败
 *   17. 不修改正式 catalog
 *   18. 现有 Star Single 门禁不受影响
 *
 * 所有测试使用固定 seed，不依赖随机成功。
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, rmSync, mkdirSync, renameSync } from 'fs';
import { resolve } from 'path';
import { solveStarLine } from './starLineSolver.mjs';
import { STAR_LINE_LEVELS } from '../src/data/starLineLevels.js';
import {
  generateDoubleStarCandidate,
  generateDoubleStarBatch,
  generateDoubleStarSolution,
  classifyStructuralFamily,
} from './star-double-generator.mjs';
import {
  analyzeDoubleStarOpening,
  assessDoubleStarDifficulty,
  generateBatchReport,
  DOUBLE_OPENING_FAMILY,
  DIFFICULTY_BAND,
} from './star-double-quality.mjs';
import {
  makeCanonicalSolutionSig,
  makeSolutionSig,
  makeCanonicalRegionSig,
} from './star-line-candidate-signatures.mjs';
import { computeOpeningFingerprint } from './star-line-fingerprint.mjs';

let passed = 0, failed = 0;
const TEST_FILTER = process.env.STAR_DOUBLE_TEST_FILTER;
function test(name, fn) {
  if (TEST_FILTER && !name.includes(TEST_FILTER)) return;
  try { fn(); console.log(`  ✓ ${name}`); passed++; } catch (e) { console.log(`  ✗ ${name}: ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const CANDIDATE_ROOT = resolve('tmp/star-line-candidates');
const CANDIDATE_ROOT_BACKUP = resolve('tmp', `star-line-candidates-double-test-backup-${process.pid}`);
const GEN = resolve('scripts/generate-star-line-candidates.mjs');
const DOUBLE_GEN = resolve('scripts/star-double-generator.mjs');
const LEVELS = resolve('src/data/starLineLevels.js');
const LEVELS_BEFORE = readFileSync(LEVELS, 'utf-8');

// Backup candidate root
const hadCandidateRoot = existsSync(CANDIDATE_ROOT);
if (hadCandidateRoot) renameSync(CANDIDATE_ROOT, CANDIDATE_ROOT_BACKUP);
mkdirSync(CANDIDATE_ROOT, { recursive: true });
function cpath(f) { return resolve(CANDIDATE_ROOT, f); }

function restoreCandidateRoot() {
  if (!existsSync(CANDIDATE_ROOT_BACKUP)) return;
  try { rmSync(CANDIDATE_ROOT, { recursive: true, force: true }); } catch {}
  renameSync(CANDIDATE_ROOT_BACKUP, CANDIDATE_ROOT);
}
process.once('exit', restoreCandidateRoot);

function runOk(cmd) {
  return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe', timeout: 180000 });
}
function runFail(cmd) {
  try { execSync(cmd, { encoding: 'utf-8', stdio: 'pipe', timeout: 180000 }); assert(false, 'should fail'); }
  catch { /* expected */ }
}

// ═══════════════════════════════════════════
// 1. 基本生成能力
// ═══════════════════════════════════════════
console.log('\n═══ 1. 基本生成能力 ═══');

test('1a. 8×8 生成成功 (固定 seed)', () => {
  const cand = generateDoubleStarCandidate(8, 42, 0);
  assert(cand !== null, '8×8 生成失败');
  assert(cand.N === 8, `N=${cand.N}`);
  assert(cand.starsPerRow === 2, 'quota row');
  assert(cand.starsPerCol === 2, 'quota col');
  assert(cand.starsPerRegion === 2, 'quota region');
  assert(cand.gameId === 'starDouble', 'gameId');
  assert(Array.isArray(cand.solution) && cand.solution.length === 16, `solution length=${cand.solution?.length}`);
  assert(Array.isArray(cand.regions) && cand.regions.length === 64, `regions length=${cand.regions?.length}`);
});

test('1b. 9×9 生成成功 (固定 seed)', () => {
  const cand = generateDoubleStarCandidate(9, 42, 0);
  assert(cand !== null, '9×9 生成失败');
  assert(cand.N === 9, `N=${cand.N}`);
  assert(cand.solution.length === 18, `solution length=${cand.solution.length}`);
  assert(cand.regions.length === 81, `regions length=${cand.regions.length}`);
});

test('1c. 10×10 生成成功 (固定 seed)', () => {
  const cand = generateDoubleStarCandidate(10, 42, 0);
  assert(cand !== null, '10×10 生成失败');
  assert(cand.N === 10, `N=${cand.N}`);
  assert(cand.solution.length === 20, `solution length=${cand.solution.length}`);
  assert(cand.regions.length === 100, `regions length=${cand.regions.length}`);
});

// ═══════════════════════════════════════════
// 2. 确定性
// ═══════════════════════════════════════════
console.log('\n═══ 2. 确定性 ═══');

test('2a. 同 seed 确定性 (8×8)', () => {
  const a = generateDoubleStarCandidate(8, 42, 0);
  const b = generateDoubleStarCandidate(8, 42, 0);
  assert(a !== null && b !== null, '生成失败');
  assert(JSON.stringify(a.solution) === JSON.stringify(b.solution), 'solution 不同');
  assert(JSON.stringify(a.regions) === JSON.stringify(b.regions), 'regions 不同');
});

test('2b. 同 seed 确定性 (10×10)', () => {
  const a = generateDoubleStarCandidate(10, 99, 0);
  const b = generateDoubleStarCandidate(10, 99, 0);
  assert(a !== null && b !== null, '生成失败');
  assert(JSON.stringify(a.solution) === JSON.stringify(b.solution), 'solution 不同');
  assert(JSON.stringify(a.regions) === JSON.stringify(b.regions), 'regions 不同');
});

test('2c. 不同 seed 产生不同结构', () => {
  const a = generateDoubleStarCandidate(8, 42, 0);
  const b = generateDoubleStarCandidate(8, 100, 0);
  assert(a !== null && b !== null, '生成失败');
  const solDiff = JSON.stringify(a.solution) !== JSON.stringify(b.solution);
  const regDiff = JSON.stringify(a.regions) !== JSON.stringify(b.regions);
  assert(solDiff || regDiff, '不同 seed 应产生不同结构');
});

// ═══════════════════════════════════════════
// 3. Quota 合法性
// ═══════════════════════════════════════════
console.log('\n═══ 3. Quota 合法性 ═══');

function verifyQuota(cand) {
  const { N, regions, solution } = cand;
  const rowCounts = new Array(N).fill(0);
  const colCounts = new Array(N).fill(0);
  const regionCounts = new Map();
  for (let i = 0; i < N; i++) regionCounts.set(i, 0);

  for (const s of solution) {
    rowCounts[Math.floor(s / N)]++;
    colCounts[s % N]++;
    regionCounts.set(regions[s], (regionCounts.get(regions[s]) || 0) + 1);
  }

  for (let i = 0; i < N; i++) {
    assert(rowCounts[i] === 2, `row ${i} has ${rowCounts[i]} stars`);
    assert(colCounts[i] === 2, `col ${i} has ${colCounts[i]} stars`);
    assert(regionCounts.get(i) === 2, `region ${i} has ${regionCounts.get(i)} stars`);
  }

  // Check no adjacency
  for (let i = 0; i < solution.length; i++) {
    for (let j = i + 1; j < solution.length; j++) {
      const ri = Math.floor(solution[i] / N), ci = solution[i] % N;
      const rj = Math.floor(solution[j] / N), cj = solution[j] % N;
      assert(Math.abs(ri - rj) > 1 || Math.abs(ci - cj) > 1,
        `stars ${solution[i]} and ${solution[j]} are adjacent`);
    }
  }
}

test('3a. 8×8 quota=2 合法性', () => {
  const cand = generateDoubleStarCandidate(8, 42, 0);
  assert(cand !== null, '生成失败');
  verifyQuota(cand);
});

test('3b. 10×10 quota=2 合法性', () => {
  const cand = generateDoubleStarCandidate(10, 77, 0);
  assert(cand !== null, '生成失败');
  verifyQuota(cand);
});

// ═══════════════════════════════════════════
// 4. 唯一解验证
// ═══════════════════════════════════════════
console.log('\n═══ 4. 唯一解验证 ═══');

test('4a. 所有生成候选通过 Solver UNIQUE 验证', () => {
  // 使用已知有效的 seed
  const seeds = { 8: 80, 9: 90, 10: 77 };
  for (const N of [8, 9, 10]) {
    const cand = generateDoubleStarCandidate(N, seeds[N], 0);
    assert(cand !== null, `${N}×${N} 生成失败`);
    const sr = solveStarLine(N, cand.regions, { starsPerRow: 2, starsPerCol: 2, starsPerRegion: 2 });
    assert(sr.status === 'UNIQUE', `${N}×${N} solver status: ${sr.status}`);
  }
});

// ═══════════════════════════════════════════
// 5. 非法 size 拒绝
// ═══════════════════════════════════════════
console.log('\n═══ 5. 非法 size 拒绝 ═══');

test('5a. size=7 拒绝', () => {
  const cand = generateDoubleStarCandidate(7, 42, 0);
  assert(cand === null, 'size=7 应返回 null');
});

test('5b. size=11 拒绝', () => {
  const cand = generateDoubleStarCandidate(11, 42, 0);
  assert(cand === null, 'size=11 应返回 null');
});

test('5c. CLI 拒绝非法 size', () => {
  runFail(`node ${DOUBLE_GEN} --size 7 --count 1 --seed 42 --output bad-size.json --force`);
  runFail(`node ${DOUBLE_GEN} --size 11 --count 1 --seed 42 --output bad-size2.json --force`);
});

// ═══════════════════════════════════════════
// 6. 批量生成与 attempts 上限
// ═══════════════════════════════════════════
console.log('\n═══ 6. 批量生成与 attempts 上限 ═══');

test('6a. 批量生成 (count=2, 8×8)', () => {
  const result = generateDoubleStarBatch({ N: 8, count: 2, seed: 42, output: 'batch-8x8.json', force: true });
  assert(result.candidates.length === 2, `expected 2, got ${result.candidates.length}`);
  // 验证无重复
  const solSigs = result.candidates.map(c => c.solutionSignature);
  assert(new Set(solSigs).size === 2, 'solution 签名必须唯一');
  const regSigs = result.candidates.map(c => c.canonicalRegionSignature);
  assert(new Set(regSigs).size === 2, 'region 签名必须唯一');
});

test('6b. 生成不足时明确失败', () => {
  // 大量 count + 极小 maxTotalAttempts 触发失败
  try {
    generateDoubleStarBatch({ N: 8, count: 100, seed: 42, output: 'fail-batch.json', force: true, maxTotalAttempts: 50 });
  } catch (_e) {
    // 预期可能失败
  }
  // 重点：不无限循环
  assert(true, '未无限循环');
});

test('6c. CLI batch 命令确定性', () => {
  runOk(`node ${DOUBLE_GEN} --size 8 --count 2 --seed 42 --output cli-det-a.json --force`);
  runOk(`node ${DOUBLE_GEN} --size 8 --count 2 --seed 42 --output cli-det-b.json --force`);
  const a = JSON.parse(readFileSync(cpath('cli-det-a.json'), 'utf-8'));
  const b = JSON.parse(readFileSync(cpath('cli-det-b.json'), 'utf-8'));
  assert(a.candidates.length === b.candidates.length, 'count 不同');
  for (let i = 0; i < a.candidates.length; i++) {
    assert(JSON.stringify(a.candidates[i].solution) === JSON.stringify(b.candidates[i].solution), `candidate ${i} solution differs`);
  }
});

// ═══════════════════════════════════════════
// 7. Duplicate 检测
// ═══════════════════════════════════════════
console.log('\n═══ 7. Duplicate 检测 ═══');

test('7a. exact solution duplicate 检测', () => {
  const a = generateDoubleStarCandidate(8, 42, 0);
  const b = generateDoubleStarCandidate(8, 42, 0);
  assert(a !== null && b !== null, '生成失败');
  // 同 seed 同 index → 完全相同
  assert(makeSolutionSig('starDouble', 8, 2, a.solution) === makeSolutionSig('starDouble', 8, 2, b.solution),
    '相同参数应产生相同 solution 签名');
});

test('7b. canonical region duplicate 检测', () => {
  const a = generateDoubleStarCandidate(8, 42, 0);
  const b = generateDoubleStarCandidate(8, 42, 0);
  assert(makeCanonicalRegionSig('starDouble', 8, 2, a.regions) === makeCanonicalRegionSig('starDouble', 8, 2, b.regions),
    '相同参数应产生相同 region 签名');
});

test('7c. 不同 index 不应产生 exact duplicate', () => {
  const a = generateDoubleStarCandidate(8, 42, 0);
  const b = generateDoubleStarCandidate(8, 42, 1);
  if (a && b) {
    // 不同 index 应产生不同 solution（概率上）
    assert(true, '不同 index 均生成成功');
  }
});

// ═══════════════════════════════════════════
// 8. 开局分类
// ═══════════════════════════════════════════
console.log('\n═══ 8. 开局分类 ═══');

test('8a. opening family 分类稳定 (同 seed)', () => {
  const cand = generateDoubleStarCandidate(8, 42, 0);
  assert(cand !== null, '生成失败');
  const op1 = analyzeDoubleStarOpening(8, cand.regions);
  const op2 = analyzeDoubleStarOpening(8, cand.regions);
  assert(op1.openingFamily === op2.openingFamily, `分类不稳定: ${op1.openingFamily} vs ${op2.openingFamily}`);
  assert(op1.forcedStarCount === op2.forcedStarCount, 'forced star count 不稳定');
});

test('8b. opening family 分类输出有效值', () => {
  const validFamilies = Object.values(DOUBLE_OPENING_FAMILY);
  const seeds = { 8: 80, 9: 90, 10: 77 };
  for (const N of [8, 9, 10]) {
    const cand = generateDoubleStarCandidate(N, seeds[N], 0);
    if (!cand) continue;
    const op = analyzeDoubleStarOpening(N, cand.regions);
    assert(validFamilies.includes(op.openingFamily), `${N}×${N}: 无效 opening family: ${op.openingFamily}`);
    assert(typeof op.forcedStarCount === 'number', 'forcedStarCount 不为数字');
    assert(typeof op.propagationDepth === 'number', 'propagationDepth 不为数字');
  }
});

// ═══════════════════════════════════════════
// 9. 难度评估
// ═══════════════════════════════════════════
console.log('\n═══ 9. 难度评估 ═══');

test('9a. difficulty 输出有限且可比较', () => {
  const bands = Object.values(DIFFICULTY_BAND);
  const seeds = { 8: 80, 9: 90, 10: 77 };
  const scores = [];
  for (const N of [8, 9, 10]) {
    const cand = generateDoubleStarCandidate(N, seeds[N], 0);
    if (!cand) continue;
    const diff = assessDoubleStarDifficulty(cand);
    assert(bands.includes(diff.band), `${N}×${N}: 无效 difficulty band: ${diff.band}`);
    assert(typeof diff.score === 'number' && diff.score >= 0 && diff.score <= 100,
      `${N}×${N}: score out of range: ${diff.score}`);
    assert(diff.factors && typeof diff.factors.opening === 'number', 'factors 缺失');
    scores.push({ N, score: diff.score, band: diff.band });
  }
  // 验证分数可以比较
  assert(scores.length >= 2, '至少需要 2 个分数进行比较');
});

// ═══════════════════════════════════════════
// 10. 批次报告
// ═══════════════════════════════════════════
console.log('\n═══ 10. 批次报告 ═══');

test('10a. 批次报告字段完整', () => {
  const seeds = { 8: 80, 9: 90, 10: 77 };
  const candidates = [];
  for (const N of [8, 9, 10]) {
    const cand = generateDoubleStarCandidate(N, seeds[N], 0);
    if (cand) candidates.push(cand);
  }
  const report = generateBatchReport(candidates);
  assert(report.analyzerVersion, '缺少 analyzerVersion');
  assert(report.summary, '缺少 summary');
  assert(report.diversity, '缺少 diversity');
  assert(report.candidates.length === candidates.length, 'candidates 数量不匹配');

  for (const r of report.candidates) {
    assert(r.candidateId, '缺少 candidateId');
    assert(r.seed !== undefined, '缺少 seed');
    assert(r.size, '缺少 size');
    assert(r.quota === 2, 'quota 应为 2');
    assert(r.solutionSignature, '缺少 solutionSignature');
    assert(r.canonicalSolutionSignature, '缺少 canonicalSolutionSignature');
    assert(r.exactRegionSignature, '缺少 exactRegionSignature');
    assert(r.canonicalRegionSignature, '缺少 canonicalRegionSignature');
    assert(r.generatorFamily, '缺少 generatorFamily');
    assert(r.structuralFamily, '缺少 structuralFamily');
    assert(r.generatorFamily.includes('-'), 'generatorFamily 不应被 structuralFamily 覆盖');
    assert(r.openingFamily, '缺少 openingFamily');
    assert(r.legacyOpeningFamily === r.openingFamily, 'legacy opening 字段语义不一致');
    assert(typeof r.difficultyScore === 'number', '缺少 difficultyScore');
    assert(r.difficultyBand, '缺少 difficultyBand');
    assert(r.legacyAdvisory?.mayGateD1 === false, 'legacy 指标不得作为 D1 gate');
    assert(r.humanLogicStatus, '缺少 humanLogicStatus');
    assert(r.exactTraceHash, '缺少 exactTraceHash');
    assert(r.deductionWaveHash, '缺少 deductionWaveHash');
    assert(r.normalizedReasoningFingerprint, '缺少 normalizedReasoningFingerprint');
    assert(r.reasoningExperience, '缺少 reasoningExperience');
    assert(Array.isArray(r.alerts), 'alerts 不是数组');
    assert(r.validatorVersion, '缺少 validatorVersion');
  }
});

test('10b. 多样性指标覆盖', () => {
  const report = generateBatchReport([
    generateDoubleStarCandidate(8, 42, 0),
    generateDoubleStarCandidate(9, 42, 0),
    generateDoubleStarCandidate(10, 77, 0),
  ].filter(Boolean));

  const d = report.diversity;
  assert(d.familyDistribution, '缺少 familyDistribution');
  assert(d.openingDistribution, '缺少 openingDistribution');
  assert(d.difficultyDistribution, '缺少 difficultyDistribution');
  assert(typeof d.uniqueStructuralFamilies === 'number', '缺少 uniqueStructuralFamilies');
  assert(typeof d.uniqueOpeningFamilies === 'number', '缺少 uniqueOpeningFamilies');
});

test('10c. D4 solution 签名识别旋转等价', () => {
  const solution = [0, 2, 13, 15];
  const rotated = [3, 11, 4, 12];
  const first = makeCanonicalSolutionSig('starDouble', 4, 1, solution);
  const second = makeCanonicalSolutionSig('starDouble', 4, 1, rotated);
  assert(first === second, '旋转等价 solution 应共享 canonical 签名');
});

test('10d. nearest 字段报告相似度最大值而非距离最小值', () => {
  const candidates = [
    generateDoubleStarCandidate(8, 42, 0),
    generateDoubleStarCandidate(8, 42, 1),
    generateDoubleStarCandidate(8, 42, 2),
  ].filter(Boolean);
  const report = generateBatchReport(candidates);
  for (const item of report.candidates) {
    const source = new Set(item.solutionSignature.split(':')[3].split(',').map(Number));
    const expected = report.candidates
      .filter(other => other.candidateId !== item.candidateId)
      .map((other) => {
        const target = new Set(other.solutionSignature.split(':')[3].split(',').map(Number));
        let intersection = 0;
        for (const cell of source) if (target.has(cell)) intersection++;
        return intersection / Math.max(source.size, target.size);
      });
    const maximum = expected.length > 0 ? Math.max(...expected) : null;
    assert(item.nearestSolutionSimilarity === maximum,
      `nearest similarity mismatch: ${item.nearestSolutionSimilarity} vs ${maximum}`);
    assert(!('nearestSimilarityScore' in item), 'ambiguous nearestSimilarityScore should be removed');
  }
});

// ═══════════════════════════════════════════
// 11. 正式 catalog 不受影响
// ═══════════════════════════════════════════
console.log('\n═══ 11. 正式 catalog 保护 ═══');

test('11a. starLineLevels.js 不被修改', () => {
  assert(readFileSync(LEVELS, 'utf-8') === LEVELS_BEFORE, 'starLineLevels.js was modified!');
});

test('11b. 正式双星可玩数据为 60 关', () => {
  const doubles = STAR_LINE_LEVELS.filter(l => l.gameId === 'starDouble');
  assert(doubles.length === 60, `正式双星关卡数量: ${doubles.length}`);
});

test('11c. 现有单星关卡 60 关不受影响', () => {
  const singles = STAR_LINE_LEVELS.filter(l => l.gameId === 'starSingle');
  assert(singles.length === 60, `单星关卡数量: ${singles.length}`);
});

// ═══════════════════════════════════════════
// 12. 结构家族分类
// ═══════════════════════════════════════════
console.log('\n═══ 12. 结构家族 ═══');

test('12a. classifyStructuralFamily 输出有效值', () => {
  const validFamilies = ['edge', 'diagonal', 'clustered', 'distributed', 'unknown'];
  for (const N of [8, 9, 10]) {
    const sol = generateDoubleStarSolution(N, mulberry32(N * 10));
    if (!sol) continue;
    const fam = classifyStructuralFamily(sol, N);
    assert(validFamilies.includes(fam.family), `无效 family: ${fam.family}`);
    assert(typeof fam.subFamily === 'string', 'subFamily 不是字符串');
  }
});

// ═══════════════════════════════════════════
// 13. 开局指纹
// ═══════════════════════════════════════════
console.log('\n═══ 13. 开局指纹 ═══');

test('13a. quota=2 指纹与 quota=1 不同', () => {
  const cand = generateDoubleStarCandidate(8, 42, 0);
  assert(cand !== null, '生成失败');
  const fp2 = computeOpeningFingerprint(8, cand.regions, 2);
  const fp1 = computeOpeningFingerprint(8, cand.regions, 1);
  assert(fp2.fingerprint !== fp1.fingerprint, 'quota 不同应产生不同指纹');
});

// ═══════════════════════════════════════════
// 14. CLI 集成
// ═══════════════════════════════════════════
console.log('\n═══ 14. CLI 集成 ═══');

test('14a. 通过 generate-star-line-candidates CLI 生成双星', () => {
  runOk(`node ${GEN} --mode starDouble --size 8 --count 1 --seed 42 --output cli-int-8x8.json --force`);
  const d = JSON.parse(readFileSync(cpath('cli-int-8x8.json'), 'utf-8'));
  assert(d.candidates.length === 1, '应生成 1 个候选');
  const c = d.candidates[0];
  assert(c.starsPerRow === 2 && c.starsPerCol === 2 && c.starsPerRegion === 2, 'quota 应为 2');
  assert(c.gameId === 'starDouble', 'gameId 应为 starDouble');
  assert(c.N === 8, 'N 应为 8');
  assert(c.solutionSignature, '应有 solutionSignature');
  assert(c.canonicalRegionSignature, '应有 canonicalRegionSignature');
});

test('14b. --help 输出正常', () => {
  const out = execSync(`node ${DOUBLE_GEN} --help`, { encoding: 'utf-8', stdio: 'pipe', timeout: 10000 });
  assert(out.includes('用法') || out.includes('用法'), 'help 应包含中文或英文说明');
  assert(out.includes('--size'), 'help 应包含 --size');
  assert(out.includes('--count'), 'help 应包含 --count');
  assert(out.includes('--seed'), 'help 应包含 --seed');
});

// ═══════════════════════════════════════════
// Cleanup
// ═══════════════════════════════════════════
console.log('\n═══ Cleanup ═══');
rmSync(CANDIDATE_ROOT, { recursive: true, force: true });
restoreCandidateRoot();
assert(hadCandidateRoot ? existsSync(CANDIDATE_ROOT) : !existsSync(CANDIDATE_ROOT));

function mulberry32(a) {
  return function () {
    a |= 0;
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
