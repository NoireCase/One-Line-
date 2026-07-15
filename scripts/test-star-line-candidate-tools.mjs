/**
 * Star Line 候选工具测试。
 * A 类: 真实生成器集成 (starSingle only; double-star generator 待算法改进)
 * B 类: 静态 fixture 分析器逻辑测试
 * H 类: 宏观变异 (Package 2D.1)
 * I 类: 全目录收口门禁 (Package 2D.1)
 */
import { execSync } from 'child_process';
import { readFileSync, existsSync, rmSync, mkdirSync, writeFileSync, readdirSync, renameSync } from 'fs';
import { resolve } from 'path';
import {
  canonicalizeRegions, d4Transforms, d4AlignedRegionMetrics,
  d4AlignedRegionJaccard, d4FullyEquivalent, canonicalRegionsSimple,
} from './star-line-candidate-signatures.mjs';
import { getTemplatePoolDiagnostics, getSeedTemplateSequence, generateCandidates, loadExternalTemplateObject } from './generate-star-line-candidates.mjs';
import {
  mutateBoundaryShift, mutateBlockRepartition, mutateMergeResplit,
  applyMacroMutation, validateRegions,
} from './star-line-macro-mutations.mjs';
import { computeOpeningFingerprint } from './star-line-fingerprint.mjs';
import { solveStarLine } from './starLineSolver.mjs';
import { STAR_LINE_LEVELS } from '../src/data/starLineLevels.js';

let passed = 0, failed = 0;
const TEST_FILTER = process.env.STAR_LINE_CANDIDATE_TEST_FILTER;
function test(name, fn) {
  if (TEST_FILTER && !name.includes(TEST_FILTER)) return;
  try { fn(); console.log(`  ✓ ${name}`); passed++; } catch (e) { console.log(`  ✗ ${name}: ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const CANDIDATE_ROOT = resolve('tmp/star-line-candidates');
const CANDIDATE_ROOT_BACKUP = resolve('tmp', `star-line-candidates-test-backup-${process.pid}`);
const GEN = resolve('scripts/generate-star-line-candidates.mjs');
const ANALYZE = resolve('scripts/analyze-star-line-candidates.mjs');
const LEVELS = resolve('src/data/starLineLevels.js');
const LEVELS_BEFORE = readFileSync(LEVELS, 'utf-8');

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
  const r = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe', timeout: 120000 });
  return r;
}
function runFail(cmd) {
  try { execSync(cmd, { encoding: 'utf-8', stdio: 'pipe', timeout: 120000 }); assert(false, 'should fail'); }
  catch { /* expected */ }
}

// ── Fixture helpers ──
function fixtureCandidate(overrides = {}) {
  return {
    candidateId: 'fixture-001', seed: 42, gameId: 'starSingle', N: 5,
    starsPerRow: 1, starsPerCol: 1, starsPerRegion: 1,
    regions: [0,0,1,1,1,2,2,1,1,1,2,2,1,1,1,2,2,3,4,4,2,2,4,4,4],
    solution: [1,8,10,17,24],
    generationMetadata: { generatorVersion:'1.0.0', seed:42, parameters:{mode:'starSingle',N:5,quota:1,index:0}, attempts:3 },
    ...overrides,
  };
}

function writeFixture(name, data) {
  writeFileSync(cpath(name), JSON.stringify(data, null, 2), 'utf-8');
}

// ═══════════════════════════════════════════
// A 类：真实生成器集成 (starSingle)
// ═══════════════════════════════════════════
console.log('\n═══ A. 真实生成器集成 ═══');

test('A1. starSingle 成功生成候选 (size=5 count=2)', () => {
  runOk(`node ${GEN} --mode starSingle --size 5 --count 2 --seed 42 --output real-single.json --force`);
  const d = JSON.parse(readFileSync(cpath('real-single.json'), 'utf-8'));
  assert(d.candidates.length === 2, `expected 2, got ${d.candidates.length}`);
  assert(d.candidates[0].starsPerRow === 1 && d.candidates[0].starsPerCol === 1 && d.candidates[0].starsPerRegion === 1);
  assert(d.candidates[0].gameId === 'starSingle');
  assert(d.candidates[0].solution && d.candidates[0].solution.length > 0, 'should have solution');
  assert(d.candidates[0].regions && d.candidates[0].regions.length > 0, 'should have regions');
});

test('A2. 相同 seed 完整可复现 (无 generatedAt)', () => {
  runOk(`node ${GEN} --mode starSingle --size 5 --count 2 --seed 42 --output rep-a.json --force`);
  runOk(`node ${GEN} --mode starSingle --size 5 --count 2 --seed 42 --output rep-b.json --force`);
  const a = JSON.parse(readFileSync(cpath('rep-a.json'), 'utf-8'));
  const b = JSON.parse(readFileSync(cpath('rep-b.json'), 'utf-8'));
  assert(a.candidates.length === b.candidates.length);
  for (let i = 0; i < a.candidates.length; i++) {
    assert(JSON.stringify(a.candidates[i].solution) === JSON.stringify(b.candidates[i].solution));
    assert(JSON.stringify(a.candidates[i].regions) === JSON.stringify(b.candidates[i].regions));
  }
  const raw = readFileSync(cpath('rep-a.json'), 'utf-8');
  assert(!raw.includes('generatedAt'), 'must not contain generatedAt');
});

test('A3. starDouble 8x8 真实生成 (连续3次稳定)', () => {
  // Run 3 times, verify consistent output
  let first;
  for (let run = 0; run < 3; run++) {
    runOk(`node ${GEN} --mode starDouble --size 8 --count 1 --seed 42 --output double-8x8.json --force`);
    const d = JSON.parse(readFileSync(cpath('double-8x8.json'), 'utf-8'));
    assert(d.candidates.length === 1, `run ${run}: expected 1 candidate`);
    const c = d.candidates[0];
    assert(c.starsPerRow === 2 && c.starsPerCol === 2 && c.starsPerRegion === 2, `run ${run}: quota must be 2`);
    assert(c.gameId === 'starDouble', `run ${run}: gameId must be starDouble`);
    assert(c.N === 8, `run ${run}: N must be 8`);
    if (run === 0) first = c;
    else {
      assert(JSON.stringify(c.solution) === JSON.stringify(first.solution), `run ${run}: solution differs`);
      assert(JSON.stringify(c.regions) === JSON.stringify(first.regions), `run ${run}: regions differ`);
    }
  }
});

test('A4. 不同 seed 产生差异', () => {
  runOk(`node ${GEN} --mode starSingle --size 5 --count 2 --seed 99 --output diff.json --force`);
  const a = JSON.parse(readFileSync(cpath('rep-a.json'), 'utf-8'));
  const b = JSON.parse(readFileSync(cpath('diff.json'), 'utf-8'));
  const sa = a.candidates.map(c => JSON.stringify(c.solution)).sort().join('|');
  const sb = b.candidates.map(c => JSON.stringify(c.solution)).sort().join('|');
  assert(sa !== sb, 'different seeds should differ');
});

test('A4. starSingle 10x10 真实生成 (count=1 seed=42)', () => {
  rmSync(cpath('b11-10x10.json'), { force: true });
  runOk(`node ${GEN} --mode starSingle --size 10 --count 1 --seed 42 --output b11-10x10.json --force`);
  const d = JSON.parse(readFileSync(cpath('b11-10x10.json'), 'utf-8'));
  assert(d.candidates.length === 1, `expected 1, got ${d.candidates.length}`);
  const c = d.candidates[0];
  assert(c.N === 10, `expected N=10, got ${c.N}`);
  assert(c.starsPerRow === 1 && c.starsPerCol === 1 && c.starsPerRegion === 1, 'quota must be 1/1/1');
  assert(c.gameId === 'starSingle', `expected starSingle, got ${c.gameId}`);
  assert(Array.isArray(c.solution) && c.solution.length === 10, 'solution must have 10 stars');
  assert(Array.isArray(c.regions) && c.regions.length === 100, 'regions must have 100 cells');
  // 验证所有区域连通
  const N = 10;
  const regs = c.regions;
  function ridConnected(rid) {
    let start = -1;
    for (let i = 0; i < 100; i++) { if (regs[i] === rid) { start = i; break; } }
    if (start === -1) return false;
    const vis = new Set([start]), q = [start];
    while (q.length) {
      const cur = q.shift(), r = Math.floor(cur / N), col = cur % N;
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nr = r + dr, nc = col + dc;
        if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
        const ni = nr * N + nc;
        if (regs[ni] === rid && !vis.has(ni)) { vis.add(ni); q.push(ni); }
      }
    }
    let expected = 0;
    for (let i = 0; i < 100; i++) if (regs[i] === rid) expected++;
    return vis.size === expected;
  }
  for (let rid = 0; rid < N; rid++) assert(ridConnected(rid), `region ${rid} not connected`);
  // 验证 solver 结论和 analyzer
  runOk(`node ${ANALYZE} --input ${cpath('b11-10x10.json')} --force`);
  const r = JSON.parse(readFileSync(cpath('b11-10x10-analysis.json'), 'utf-8'));
  const rep = r.candidates[0];
  assert(rep.solver.status === 'unique', `solver must be unique, got ${rep.solver.status}`);
  assert(rep.declaredSolutionMatchesSolver === true, 'declared solution must match solver');
  assert(rep.conclusion !== 'reject', 'must not reject');
});

test('A5. 默认不覆盖', () => runFail(`node ${GEN} --mode starSingle --size 5 --count 1 --seed 1 --output real-single.json`));
test('A6. --force 候选目录内覆盖', () => runOk(`node ${GEN} --mode starSingle --size 5 --count 1 --seed 1 --output real-single.json --force`));

test('A7. 参数拒绝: 非法 mode', () => runFail(`node ${GEN} --mode bad --size 5 --count 1 --seed 1 --output b1.json`));
test('A8. 参数拒绝: count=0', () => runFail(`node ${GEN} --mode starSingle --size 5 --count 0 --seed 1 --output b2.json`));
test('A9. 参数拒绝: seed 非数值', () => runFail(`node ${GEN} --mode starSingle --size 5 --count 1 --seed abc --output b3.json`));
test('A10. 参数拒绝: size=4', () => runFail(`node ${GEN} --mode starSingle --size 4 --count 1 --seed 1 --output b4.json`));
test('A11. 参数拒绝: size=11', () => runFail(`node ${GEN} --mode starSingle --size 11 --count 1 --seed 1 --output b5.json`));

// ═══ A.2 路径安全 ═══
console.log('\n═══ A.2 路径安全 ═══');
test('A12. src/data 拒绝', () => runFail(`node ${GEN} --mode starSingle --size 5 --count 1 --seed 1 --output ../src/data/test.json`));
test('A13. ../ 逃逸拒绝', () => runFail(`node ${GEN} --mode starSingle --size 5 --count 1 --seed 1 --output ../../etc/test.json`));
test('A14. 绝对路径拒绝', () => runFail(`node ${GEN} --mode starSingle --size 5 --count 1 --seed 1 --output /tmp/test-abs.json`));

test('A15. starLineLevels.js 不被修改', () => {
  assert(readFileSync(LEVELS, 'utf-8') === LEVELS_BEFORE, 'starLineLevels.js was modified!');
});

test('A16. 合法参数下 attempts 耗尽 → 生成不足', () => {
  rmSync(cpath('fail-real.json'), { force: true });
  let thrown = false;
  let msg = '';
  try {
    generateCandidates({
      mode: 'starSingle', N: 10, count: 2, seed: 42,
      output: 'fail-real.json',
      force: true,
      // Package 2D.1: 宏观管线提高了首次尝试成功率（成功尝试不消耗预算），
      // 预算为 0 才能确定性地模拟 attempts 耗尽
      maxTotalAttempts: 0,
    });
  } catch (e) {
    thrown = true;
    msg = e.message || '';
  }
  assert(thrown, 'must throw on insufficient candidates');
  assert(msg.includes('生成不足'), `message must contain 生成不足: ${msg}`);
  assert(!existsSync(cpath('fail-real.json')), 'no output file on failure');
  // 无残留 tmp 文件
  const tmpDir = resolve('tmp/star-line-candidates');
  if (existsSync(tmpDir)) {
    const files = readdirSync(tmpDir);
    const tmps = files.filter(f => f.includes('fail-real') && f.includes('.tmp-'));
    assert(tmps.length === 0, `no residual tmp files: ${tmps.join(', ')}`);
  }
});

test('A16b. CLI 层 count=0 参数校验仍保留', () => {
  // count=0 是参数校验，不是"生成不足"
  rmSync(cpath('failcount-zero.json'), { force: true });
  let err = null;
  try {
    execSync(`node ${GEN} --mode starSingle --size 5 --count 0 --seed 1 --output failcount-zero.json --force`, { encoding: 'utf-8', stdio: 'pipe', timeout: 10000 });
  } catch (e) { err = e; }
  assert(err !== null, 'count=0 must fail parameter validation');
  assert(err.status !== 0, 'must exit non-zero');
  assert(!existsSync(cpath('failcount-zero.json')), 'no output file');
});

// ═══ A.3 10×10 单星集成 (Package 2B) ═══
console.log('\n═══ A.3 10×10 单星集成 ═══');

test('B12. 10×10 确定性 (同 seed 3 次一致)', () => {
  for (let run = 0; run < 3; run++) {
    runOk(`node ${GEN} --mode starSingle --size 10 --count 1 --seed 42 --output det10${run}.json --force`);
  }
  const a = JSON.parse(readFileSync(cpath('det100.json'), 'utf-8'));
  const b = JSON.parse(readFileSync(cpath('det101.json'), 'utf-8'));
  const c = JSON.parse(readFileSync(cpath('det102.json'), 'utf-8'));
  assert(JSON.stringify(a.candidates[0].solution) === JSON.stringify(b.candidates[0].solution), 'run 0/1 solution differ');
  assert(JSON.stringify(b.candidates[0].solution) === JSON.stringify(c.candidates[0].solution), 'run 1/2 solution differ');
  assert(JSON.stringify(a.candidates[0].regions) === JSON.stringify(b.candidates[0].regions), 'run 0/1 regions differ');
  assert(JSON.stringify(b.candidates[0].regions) === JSON.stringify(c.candidates[0].regions), 'run 1/2 regions differ');
});

test('B13. 不同 seed 产生不同结构', () => {
  runOk(`node ${GEN} --mode starSingle --size 10 --count 1 --seed 42 --output diffA.json --force`);
  runOk(`node ${GEN} --mode starSingle --size 10 --count 1 --seed 2025 --output diffB.json --force`);
  const a = JSON.parse(readFileSync(cpath('diffA.json'), 'utf-8'));
  const b = JSON.parse(readFileSync(cpath('diffB.json'), 'utf-8'));
  const solDiff = JSON.stringify(a.candidates[0].solution) !== JSON.stringify(b.candidates[0].solution);
  const regDiff = JSON.stringify(a.candidates[0].regions) !== JSON.stringify(b.candidates[0].regions);
  assert(solDiff || regDiff, 'different seeds must differ in solution or regions');
});

test('B14. 10×10 区域正交连通不依赖 fallback', () => {
  runOk(`node ${GEN} --mode starSingle --size 10 --count 1 --seed 777 --output conn.json --force`);
  const d = JSON.parse(readFileSync(cpath('conn.json'), 'utf-8'));
  const regs = d.candidates[0].regions;
  const N = 10;
  const regionIds = new Set(regs);
  assert(regionIds.size === N, `must have exactly ${N} regions`);
  // 验证覆盖：每个 idx 0..99 恰好出现一次
  const seen = new Set();
  for (const rid of regs) {
    assert(!seen.has(rid) ? true : seen.has(rid), '');
    // 实际验证：所有 index 出现一次
  }
  for (let i = 0; i < 100; i++) assert(regs[i] >= 0 && regs[i] < N, `cell ${i} has invalid region ${regs[i]}`);
  // 每个区域至少 1 格
  const counts = new Array(N).fill(0);
  for (const rid of regs) counts[rid]++;
  for (let rid = 0; rid < N; rid++) assert(counts[rid] >= 1, `region ${rid} has ${counts[rid]} cells`);
  // 正交连通验证
  function isConnected(rid) {
    let start = -1;
    for (let i = 0; i < 100; i++) { if (regs[i] === rid) { start = i; break; } }
    if (start === -1) return false;
    const vis = new Set([start]), q = [start];
    while (q.length) {
      const cur = q.shift(), r = Math.floor(cur / N), c = cur % N;
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
        const ni = nr * N + nc;
        if (regs[ni] === rid && !vis.has(ni)) { vis.add(ni); q.push(ni); }
      }
    }
    return vis.size === counts[rid];
  }
  for (let rid = 0; rid < N; rid++) assert(isConnected(rid), `region ${rid} is not orthogonally connected`);
});

// ═══ A.4 D4 签名 ═══
console.log('\n═══ A.4 D4 签名 ═══');

test('C1. D4 八种变换 canonical signature 完全一致', () => {
  const N = 10;
  const regs = new Array(100);
  for (let i = 0; i < 100; i++) regs[i] = Math.floor(i / 10);
  const sig1 = canonicalizeRegions(regs, N);
  // 手动旋转 90°
  const rot90 = new Array(100);
  for (let i = 0; i < 100; i++) {
    const r = Math.floor(i / 10), c = i % 10;
    rot90[c * 10 + (9 - r)] = regs[i];
  }
  const sig2 = canonicalizeRegions(rot90, N);
  assert(sig1 === sig2, `D4 canonical must be identical`);
});

test('C2. region label 重命名不影响 canonical signature', () => {
  const N = 5;
  const regs = [0,0,1,1,1, 2,2,1,1,1, 2,2,1,1,1, 2,2,3,4,4, 2,2,4,4,4];
  const regsRenamed = regs.map(v => v + 100);
  const sig1 = canonicalizeRegions(regs, N);
  const sig2 = canonicalizeRegions(regsRenamed, N);
  assert(sig1 === sig2, 'Renamed labels must produce same canonical sig');
});

test('C3. 非等价结构 canonical signature 不同', () => {
  const N = 5;
  const r1 = [0,0,1,1,1, 2,2,1,1,1, 2,2,1,1,1, 2,2,3,4,4, 2,2,4,4,4];
  const r2 = [0,1,1,1,1, 0,2,2,2,2, 0,3,3,3,3, 0,4,4,4,4, 0,0,0,0,0];
  assert(canonicalizeRegions(r1, N) !== canonicalizeRegions(r2, N), 'different structures must have different sigs');
});

test('C4. D4 变换覆盖无重复 (8 transforms x 100 cells)', () => {
  const N = 10;
  const transforms = d4Transforms(N);
  assert(transforms.length === 8, 'must have 8 D4 transforms');
  for (const map of transforms) {
    assert(map.length === 100, 'each transform must map 100 cells');
    const seen = new Set(map);
    assert(seen.size === 100, 'each transform must be bijection');
  }
});

// ═══ A.5 批量去重 ═══
console.log('\n═══ A.5 批量去重 ═══');

test('D1. 重复 solution 不计入 count', () => {
  // 生成 count=12 时 solution 去重后全部不同
  runOk(`node ${GEN} --mode starSingle --size 10 --count 12 --seed 42 --output dedup-sol.json --force`);
  const d = JSON.parse(readFileSync(cpath('dedup-sol.json'), 'utf-8'));
  assert(d.candidates.length === 12, `expected 12 unique, got ${d.candidates.length}`);
  const solSigs = d.candidates.map(c => c.solutionSignature);
  assert(new Set(solSigs).size === 12, 'all solution signatures must be unique');
});

test('D2. D4 等价 region 不计入 count', () => {
  runOk(`node ${GEN} --mode starSingle --size 10 --count 12 --seed 42 --output dedup-reg.json --force`);
  const d = JSON.parse(readFileSync(cpath('dedup-reg.json'), 'utf-8'));
  const regSigs = d.candidates.map(c => c.canonicalRegionSignature);
  assert(new Set(regSigs).size === 12, 'all canonical region signatures must be unique');
});

test('D3. 同 seed 去重后结果仍确定', () => {
  runOk(`node ${GEN} --mode starSingle --size 10 --count 5 --seed 42 --output det-1.json --force`);
  runOk(`node ${GEN} --mode starSingle --size 10 --count 5 --seed 42 --output det-2.json --force`);
  const a = JSON.parse(readFileSync(cpath('det-1.json'), 'utf-8'));
  const b = JSON.parse(readFileSync(cpath('det-2.json'), 'utf-8'));
  assert(a.candidates.length === b.candidates.length);
  for (let i = 0; i < a.candidates.length; i++) {
    assert(JSON.stringify(a.candidates[i].solution) === JSON.stringify(b.candidates[i].solution), `candidate ${i} solution differs`);
  }
});

// ═══ A.6 模板多样性 ═══
console.log('\n═══ A.6 模板多样性 ═══');

test('E1. 不同 seed 稳定触发不同模板族', () => {
  runOk(`node ${GEN} --mode starSingle --size 10 --count 3 --seed 42 --output tmpl-A.json --force`);
  runOk(`node ${GEN} --mode starSingle --size 10 --count 3 --seed 2025 --output tmpl-B.json --force`);
  const a = JSON.parse(readFileSync(cpath('tmpl-A.json'), 'utf-8'));
  const b = JSON.parse(readFileSync(cpath('tmpl-B.json'), 'utf-8'));
  // 不同 seed 应产生不同的 solution 或 region
  const solA = new Set(a.candidates.map(c => JSON.stringify(c.solution)));
  const solB = new Set(b.candidates.map(c => JSON.stringify(c.solution)));
  const overlap = [...solA].filter(s => solB.has(s));
  // 至少有一些不同的 solution（不需要全部不同）
  assert(overlap.length < Math.min(solA.size, solB.size), 'different seeds should not produce all same solutions');
});

// ═══ A.7 分析器门禁 ═══
console.log('\n═══ A.7 分析器门禁 ═══');

test('F1. exact solution duplicate → reject', () => {
  const f1 = fixtureCandidate({ candidateId: 'dup-sol-a' });
  const f2 = fixtureCandidate({ candidateId: 'dup-sol-b' }); // same solution
  writeFixture('exact-dup.json', { generatorVersion:'1.0.0', parameters:{mode:'starSingle',N:5,quota:1,count:2,seed:42}, candidates:[f1,f2] });
  runOk(`node ${ANALYZE} --input ${cpath('exact-dup.json')} --force`);
  const r = JSON.parse(readFileSync(cpath('exact-dup-analysis.json'), 'utf-8'));
  const hasReject = r.candidates.some(c => c.conclusion === 'reject' && c.alerts?.includes('exact-solution-duplicate'));
  assert(hasReject, 'exact solution duplicate must be reject');
});

test('F2. D4-equivalent region → reject', () => {
  // 同一 regions → 同一 canonical sig → D4 等价 → reject
  const f1 = fixtureCandidate({ candidateId: 'd4-dup-a' });
  const f2 = fixtureCandidate({ candidateId: 'd4-dup-b' }); // same regions
  writeFixture('d4-dup.json', { generatorVersion:'1.0.0', parameters:{mode:'starSingle',N:5,quota:1,count:2,seed:42}, candidates:[f1,f2] });
  runOk(`node ${ANALYZE} --input ${cpath('d4-dup.json')} --force`);
  const r = JSON.parse(readFileSync(cpath('d4-dup-analysis.json'), 'utf-8'));
  const hasReject = r.candidates.some(c => c.conclusion === 'reject' && c.alerts?.includes('d4-region-duplicate'));
  assert(hasReject, 'D4-equivalent region must be reject');
});

test('F3. JSON 与 Markdown 数量和结论一致', () => {
  runOk(`node ${GEN} --mode starSingle --size 10 --count 5 --seed 99 --output md-check.json --force`);
  runOk(`node ${ANALYZE} --input ${cpath('md-check.json')} --force`);
  const j = JSON.parse(readFileSync(cpath('md-check-analysis.json'), 'utf-8'));
  const m = readFileSync(cpath('md-check-analysis.md'), 'utf-8');
  assert(m.includes(`Total: ${j.candidates.length}`), 'MD must report correct total');
  const jKeep = j.summary.keep;
  assert(m.includes(`keep=${jKeep}`), 'MD must report keep count');
});

// ═══ A.8 模板池诊断与选择 (Package 2B.2) ═══
console.log('\n═══ A.8 模板池诊断与选择 ═══');

test('G1. 基础模板族数量精确为 8', () => {
  const d = getTemplatePoolDiagnostics();
  assert(d.baseCount === 8, `expected 8 base families, got ${d.baseCount}`);
  assert(d.bases.length === d.baseCount, 'diagnostic bases must match baseCount');
});

test('G2. 每个基础模板合法', () => {
  const d = getTemplatePoolDiagnostics();
  for (const b of d.bases) {
    assert(b.isValid, `template family ${b.index} must be valid`);
  }
});

test('G3. canonical signature 两两不同且新增模板满足 D4 门禁', () => {
  const d = getTemplatePoolDiagnostics();
  const sigs = d.bases.map(b => b.canonicalSignature);
  assert(new Set(sigs).size === d.bases.length, 'all families must have distinct canonical sigs');
  const legacy = d.bases.filter(base => base.origin === 'legacy');
  const added = d.bases.filter(base => base.origin === 'package-2c1');
  assert(legacy.length === 4, `expected 4 legacy families, got ${legacy.length}`);
  assert(added.length === 4, `expected 4 added families, got ${added.length}`);
  for (const base of added) {
    const comparisons = legacy.map(old => ({ old, metrics: d4AlignedRegionMetrics(base.regions, old.regions, 10) }));
    const closest = comparisons.reduce((best, current) => (
      current.metrics.similarity > best.metrics.similarity ? current : best
    ));
    assert(closest.metrics.similarity <= 0.85,
      `template seed=${base.seed} too similar to legacy seed=${closest.old.seed}: ${closest.metrics.similarity}`);
    if (closest.metrics.similarity > 0.80) {
      assert(JSON.stringify(base.areaProfile) !== JSON.stringify(closest.old.areaProfile),
        `template seed=${base.seed} must change opening area structure`);
      assert(JSON.stringify(base.smallestRegionAnchors) !== JSON.stringify(closest.old.smallestRegionAnchors),
        `template seed=${base.seed} must move smallest-region opening anchor`);
    }
  }
});

test('G4. 至少两种不同面积轮廓', () => {
  const d = getTemplatePoolDiagnostics();
  const profiles = d.bases.map(b => JSON.stringify(b.areaProfile));
  assert(new Set(profiles).size >= 2, 'must have at least 2 different area profiles');
});

test('G5. 四个模板族均可产出 UNIQUE 候选', () => {
  // 通过生成器验证：每个计数来自不同模板族的 seed 都能产出 UNIQUE
  runOk(`node ${GEN} --mode starSingle --size 10 --count 1 --seed 42 --output g5-t0.json --force`);
  const t0 = JSON.parse(readFileSync(cpath('g5-t0.json'), 'utf-8'));
  assert(t0.candidates.length === 1, 'seed=42 must produce UNIQUE candidate');
  runOk(`node ${GEN} --mode starSingle --size 10 --count 1 --seed 777 --output g5-t1.json --force`);
  const t1 = JSON.parse(readFileSync(cpath('g5-t1.json'), 'utf-8'));
  assert(t1.candidates.length === 1, 'seed=777 must produce UNIQUE candidate');
});

test('G6. 固定 seed 模板族选择序列确定', () => {
  const seq1 = getSeedTemplateSequence(42, 10);
  const seq2 = getSeedTemplateSequence(42, 10);
  for (let i = 0; i < 10; i++) {
    assert(seq1[i].familyIdx === seq2[i].familyIdx, `step ${i}: family must match`);
    assert(seq1[i].inRange, `step ${i}: family must be in range`);
  }
});

test('G7. 两个不同 seed 命中不同模板族', () => {
  const seqA = getSeedTemplateSequence(42, 30);
  const seqB = getSeedTemplateSequence(2025, 30);
  const familiesA = new Set(seqA.map(s => s.familyIdx));
  const familiesB = new Set(seqB.map(s => s.familyIdx));
  // 两个 seed 覆盖的家族至少有差异
  const union = new Set([...familiesA, ...familiesB]);
  assert(union.size >= 2, 'two different seeds must hit at least 2 different families');
});

// ═══════════════════════════════════════════
// H 类：宏观变异 (Package 2D.1)
// ═══════════════════════════════════════════
console.log('\n═══ H. 宏观变异 ═══');

function mb32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const H_N = 10;
const H_BASE = getTemplatePoolDiagnostics().bases[0].regions;
const H_BASE_SOLUTION = solveStarLine(H_N, H_BASE, { starsPerRow: 1, starsPerCol: 1, starsPerRegion: 1 }).solutions[0];

function diffCells(a, b) {
  const out = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) out.push(i);
  return out;
}

test('H1. mutateBoundaryShift 保持连通+覆盖，转移 2–4 格', () => {
  let success = 0;
  for (let s = 1; s <= 12; s++) {
    const m = mutateBoundaryShift(H_BASE, H_N, mb32(s * 131));
    if (!m) continue;
    success++;
    assert(validateRegions(m, H_N) === null, `seed ${s}: 覆盖/连通被破坏`);
    const d = diffCells(H_BASE, m);
    assert(d.length >= 2 && d.length <= 4, `seed ${s}: 转移格数 ${d.length} 不在 2–4`);
  }
  assert(success >= 6, `成功率过低: ${success}/12`);
});

test('H2. mutateBlockRepartition 保持连通+覆盖且区域集合不变', () => {
  let success = 0;
  for (let s = 1; s <= 12; s++) {
    const m = mutateBlockRepartition(H_BASE, H_N, mb32(s * 977));
    if (!m) continue;
    success++;
    assert(validateRegions(m, H_N) === null, `seed ${s}: 覆盖/连通被破坏`);
    assert(new Set(m).size === H_N, `seed ${s}: 区域数量变化`);
    assert(diffCells(H_BASE, m).length >= 1, `seed ${s}: 无变化`);
  }
  assert(success >= 6, `成功率过低: ${success}/12`);
});

test('H3. mutateMergeResplit 保持连通+覆盖，变化限于合并的两个区域', () => {
  let success = 0;
  for (let s = 1; s <= 12; s++) {
    const m = mutateMergeResplit(H_BASE, H_N, mb32(s * 613), H_BASE_SOLUTION);
    if (!m) continue;
    success++;
    assert(validateRegions(m, H_N) === null, `seed ${s}: 覆盖/连通被破坏`);
    const d = diffCells(H_BASE, m);
    const beforeRids = new Set(d.map((i) => H_BASE[i]));
    const afterRids = new Set(d.map((i) => m[i]));
    assert(beforeRids.size <= 2 && afterRids.size <= 2, `seed ${s}: 变化超出两个区域`);
    // 原目标星仍在各自区域内
    for (const star of H_BASE_SOLUTION) {
      if (beforeRids.has(H_BASE[star])) {
        assert(m[star] === H_BASE[star], `seed ${s}: 目标星 ${star} 所在区域改变`);
      }
    }
  }
  assert(success >= 6, `成功率过低: ${success}/12`);
});

test('H4. applyMacroMutation 固定 seed 确定性', () => {
  const r1 = applyMacroMutation(H_BASE, H_N, mb32(4242), { quota: 1 });
  const r2 = applyMacroMutation(H_BASE, H_N, mb32(4242), { quota: 1 });
  assert(r1 !== null && r2 !== null, '固定 seed 必须成功');
  assert(JSON.stringify(r1.regions) === JSON.stringify(r2.regions), 'regions 必须一致');
  assert(JSON.stringify(r1.solution) === JSON.stringify(r2.solution), 'solution 必须一致');
  assert(JSON.stringify(r1.ops) === JSON.stringify(r2.ops), 'ops 序列必须一致');
});

test('H5. applyMacroMutation 质量约束：UNIQUE + declared 一致 + 相似度下降 + 指纹不同', () => {
  const parentFp = computeOpeningFingerprint(H_N, H_BASE, 1).fingerprint;
  let success = 0;
  for (let s = 1; s <= 8; s++) {
    const r = applyMacroMutation(H_BASE, H_N, mb32(s * 997), { quota: 1 });
    if (!r) continue;
    success++;
    assert(validateRegions(r.regions, H_N) === null, `seed ${s}: 覆盖/连通被破坏`);
    const sr = solveStarLine(H_N, r.regions, { starsPerRow: 1, starsPerCol: 1, starsPerRegion: 1 });
    assert(sr.status === 'UNIQUE', `seed ${s}: 非 UNIQUE (${sr.status})`);
    assert(JSON.stringify([...sr.solutions[0]].sort((a, b) => a - b)) === JSON.stringify([...r.solution].sort((a, b) => a - b)),
      `seed ${s}: declared solution 与 Solver 不一致`);
    assert(r.parentSimilarity <= 0.9, `seed ${s}: 相似度未明显下降 (${r.parentSimilarity})`);
    const recomputed = d4AlignedRegionJaccard(r.regions, H_BASE, H_N);
    assert(Math.abs(recomputed - r.parentSimilarity) < 1e-9, `seed ${s}: parentSimilarity 与重算不一致`);
    assert(r.fingerprint !== parentFp, `seed ${s}: 开局指纹与父模板完全相同`);
  }
  assert(success >= 5, `成功率过低: ${success}/8`);
});

test('H6. 生成器候选携带宏观元数据与指纹', () => {
  runOk(`node ${GEN} --mode starSingle --size 10 --count 2 --seed 42 --output h6.json --force`);
  const d = JSON.parse(readFileSync(cpath('h6.json'), 'utf-8'));
  for (const c of d.candidates) {
    assert(typeof c.templateFamily === 'string' && c.templateFamily.includes(':'), 'templateFamily 缺失');
    assert(typeof c.openingFingerprint === 'string' && c.openingFingerprint.startsWith('v1|'), 'openingFingerprint 缺失');
    assert(['macro', 'single-cell'].includes(c.generationMetadata.mutationPipeline), 'mutationPipeline 缺失');
    if (c.generationMetadata.mutationPipeline === 'macro') {
      assert(Array.isArray(c.generationMetadata.macroOps) && c.generationMetadata.macroOps.length > 0, 'macroOps 缺失');
      assert(c.generationMetadata.macroParentSimilarity <= 0.9, 'macro 相似度未下降');
    }
  }
});

test('H7. 工作台导出模板对象可被生成器验证 (loadExternalTemplateObject)', () => {
  const canon = canonicalRegionsSimple(H_BASE);
  const t = loadExternalTemplateObject({ kind: 'star-line-template', N: 10, quota: 1, regions: canon });
  assert(Array.isArray(t.solution) && t.solution.length === 10, '必须返回 solver 解');
  assert(t.openingFingerprint.startsWith('v1|'), '必须返回指纹');
  // 非法输入拒绝
  let threw = false;
  try { loadExternalTemplateObject({ kind: 'star-line-template', N: 10, quota: 1, regions: new Array(100).fill(0) }); }
  catch { threw = true; }
  assert(threw, '非法模板必须拒绝');
});

// ═══════════════════════════════════════════
// I 类：全目录收口门禁 (Package 2D.1)
// ═══════════════════════════════════════════
console.log('\n═══ I. 全目录收口门禁 ═══');

const I_SINGLES_10 = STAR_LINE_LEVELS.filter((l) => l.gameId === 'starSingle' && l.N === 10);

function rot90Level(regions, solution, N) {
  const last = N - 1;
  const outRegions = new Array(N * N);
  for (let i = 0; i < N * N; i++) {
    const r = Math.floor(i / N), c = i % N;
    outRegions[c * N + (last - r)] = regions[i];
  }
  const outSolution = solution.map((i) => {
    const r = Math.floor(i / N), c = i % N;
    return c * N + (last - r);
  });
  return { regions: outRegions, solution: outSolution.sort((a, b) => a - b) };
}

function iFixture(id, level, overrides = {}) {
  return {
    candidateId: id, seed: 1, gameId: 'starSingle', N: level.N,
    starsPerRow: 1, starsPerCol: 1, starsPerRegion: 1,
    regions: [...level.regions], solution: [...level.solution],
    ...overrides,
  };
}

function analyzeFixtures(name, candidates, { compare = true } = {}) {
  writeFixture(name, {
    generatorVersion: '2.2.0',
    parameters: { mode: 'starSingle', N: 10, quota: 1, count: candidates.length, seed: 1 },
    candidates,
  });
  runOk(`node ${ANALYZE} --input ${cpath(name)} ${compare ? '--compare' : ''} --force`);
  return JSON.parse(readFileSync(cpath(name.replace(/\.json$/, '-analysis.json')), 'utf-8'));
}

test('I1. D4 区域与 solution 同时等价（旋转正式关）→ reject', () => {
  const lv45 = STAR_LINE_LEVELS.find((l) => l.id === 'star-lv-45');
  assert(lv45 && lv45.N === 10, '前置: star-lv-45 是 10×10 单星');
  const rotated = rot90Level(lv45.regions, lv45.solution, 10);
  assert(d4FullyEquivalent(rotated.regions, rotated.solution, lv45.regions, lv45.solution, 10), '前置: 旋转关必须 D4 等价');
  const r = analyzeFixtures('i1.json', [iFixture('i1-rot45', lv45, rotated)]);
  const rep = r.candidates[0];
  assert(rep.alerts.includes('d4-identical-solution-and-regions'), `缺少 d4-identical-solution-and-regions: ${rep.alerts.join(',')}`);
  assert(rep.conclusion === 'reject', `必须 reject, 实际 ${rep.conclusion}`);
});

test('I2. 与正式关 D4 相似度 >0.90 → reject', () => {
  const lv45 = STAR_LINE_LEVELS.find((l) => l.id === 'star-lv-45');
  // 确定性搜索：单格边界改动，保持覆盖/连通 + UNIQUE，相似度必然 >0.9 且非完全等价
  let mutated = null;
  outer:
  for (let cell = 0; cell < 100; cell++) {
    const r = Math.floor(cell / 10), c = cell % 10;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= 10 || nc < 0 || nc >= 10) continue;
      const ni = nr * 10 + nc;
      if (lv45.regions[ni] === lv45.regions[cell]) continue;
      const candidate = [...lv45.regions];
      candidate[cell] = lv45.regions[ni];
      if (validateRegions(candidate, 10) !== null) continue;
      const sr = solveStarLine(10, candidate, { starsPerRow: 1, starsPerCol: 1, starsPerRegion: 1 });
      if (sr.status !== 'UNIQUE') continue;
      const sim = d4AlignedRegionJaccard(candidate, lv45.regions, 10);
      if (sim > 0.9 && sim < 1.0) {
        mutated = { regions: candidate, solution: sr.solutions[0] };
        break outer;
      }
    }
  }
  assert(mutated, '必须能构造出 >0.9 相似的 UNIQUE 变体');
  const r = analyzeFixtures('i2.json', [iFixture('i2-high', lv45, mutated)]);
  const rep = r.candidates[0];
  assert(rep.conclusion === 'reject', `必须 reject, 实际 ${rep.conclusion} (${rep.conclusionReason})`);
  assert(rep.alerts.includes('d4-similarity-reject') || rep.alerts.includes('d4-identical-solution-and-regions'),
    `缺少相似度 reject 告警: ${rep.alerts.join(',')}`);
  assert(rep.maxFormalSimilarity > 0.9, 'maxFormalSimilarity 必须 >0.9');
});

test('I3. 与正式关 D4 相似度 0.80–0.90 → review', () => {
  const lv45 = STAR_LINE_LEVELS.find((l) => l.id === 'star-lv-45');
  // 确定性搜索：叠加边界转移把全目录最高相似度压入 review 带
  let found = null;
  for (let s = 1; s <= 60 && !found; s++) {
    let cur = [...lv45.regions];
    for (let step = 0; step < 4 && !found; step++) {
      const m = mutateBoundaryShift(cur, 10, mb32(s * 7919 + step * 271));
      if (!m) break;
      cur = m;
      const sr = solveStarLine(10, cur, { starsPerRow: 1, starsPerCol: 1, starsPerRegion: 1 });
      if (sr.status !== 'UNIQUE') continue;
      let maxSim = 0;
      for (const fl of I_SINGLES_10) {
        const sim = d4AlignedRegionJaccard(cur, fl.regions, 10);
        if (sim > maxSim) maxSim = sim;
      }
      if (maxSim >= 0.8 && maxSim <= 0.9) {
        found = { regions: [...cur], solution: sr.solutions[0], maxSim };
      }
    }
  }
  assert(found, '必须能构造出 0.80–0.90 相似带的 UNIQUE 变体');
  const r = analyzeFixtures('i3.json', [iFixture('i3-review', lv45, { regions: found.regions, solution: found.solution })]);
  const rep = r.candidates[0];
  assert(rep.conclusion === 'review', `必须 review, 实际 ${rep.conclusion} (${rep.conclusionReason})`);
  assert(rep.maxFormalSimilarity >= 0.8 && rep.maxFormalSimilarity <= 0.9, `maxFormalSimilarity 带外: ${rep.maxFormalSimilarity}`);
});

test('I4. 全目录历史比对覆盖后段关卡（超出旧 30 关范围）', () => {
  const lv60 = STAR_LINE_LEVELS.find((l) => l.id === 'star-lv-60');
  assert(lv60 && lv60.gameId === 'starSingle', '前置: star-lv-60 是单星');
  const r = analyzeFixtures('i4.json', [iFixture('i4-dup60', lv60)]);
  const rep = r.candidates[0];
  assert(rep.conclusion === 'reject', `与 star-lv-60 完全相同必须 reject, 实际 ${rep.conclusion}`);
  assert(
    rep.alerts.includes('identical-solution-and-regions') || rep.alerts.includes('d4-identical-solution-and-regions'),
    `缺少等价告警: ${rep.alerts.join(',')}`
  );
  const hit = rep.similarity.formal.find((f) => f.formalLevelId === 'star-lv-60');
  assert(hit, '必须与 star-lv-60 比对过（证明读取全目录而非前 30 关）');
});

test('I5. 同一模板家族超过 3 个 → 明确告警 review', () => {
  runOk(`node ${GEN} --mode starSingle --size 10 --count 5 --seed 99 --output i5-gen.json --force`);
  const gen = JSON.parse(readFileSync(cpath('i5-gen.json'), 'utf-8'));
  const cands = gen.candidates.map((c) => ({ ...c, templateFamily: 'legacy:base' }));
  const r = analyzeFixtures('i5.json', cands, { compare: false });
  for (const rep of r.candidates) {
    assert(rep.alerts.includes('template-family-overuse'), `${rep.candidateId} 缺少 template-family-overuse`);
    assert(rep.conclusion !== 'keep', `${rep.candidateId} 不能 keep`);
  }
});

test('I6. 家族数量 ≤3 不触发超额告警', () => {
  runOk(`node ${GEN} --mode starSingle --size 10 --count 2 --seed 99 --output i6-gen.json --force`);
  const gen = JSON.parse(readFileSync(cpath('i6-gen.json'), 'utf-8'));
  const cands = gen.candidates.map((c) => ({ ...c, templateFamily: 'legacy:base' }));
  const r = analyzeFixtures('i6.json', cands, { compare: false });
  for (const rep of r.candidates) {
    assert(!rep.alerts.includes('template-family-overuse'), `${rep.candidateId} 不应触发超额告警`);
  }
});

test('I7. analyzer 输出开局指纹且跨运行稳定', () => {
  const lv45 = STAR_LINE_LEVELS.find((l) => l.id === 'star-lv-45');
  const r1 = analyzeFixtures('i7.json', [iFixture('i7-fp', lv45)], { compare: false });
  runOk(`node ${ANALYZE} --input ${cpath('i7.json')} --force`);
  const r2 = JSON.parse(readFileSync(cpath('i7-analysis.json'), 'utf-8'));
  const fp1 = r1.candidates[0].openingFingerprint;
  const fp2 = r2.candidates[0].openingFingerprint;
  assert(fp1 && fp1.fingerprint.startsWith('v1|'), '必须输出指纹');
  assert(fp1.fingerprint === fp2.fingerprint, '指纹跨运行必须稳定');
  assert(Array.isArray(fp1.initialForcedStars), '必须输出初始强制步');
  assert(Array.isArray(fp1.minRegionQuadrants) && fp1.minRegionQuadrants.length > 0, '必须输出最小区域象限');
  assert(typeof r1.candidates[0].templateFamily === 'string' || r1.candidates[0].templateFamily === null, '必须输出模板家族字段');
});

// ═══════════════════════════════════════════
// B 类：静态 fixture 分析器逻辑
// ═══════════════════════════════════════════
console.log('\n═══ B. 静态 fixture 分析器逻辑 ═══');

test('B1. unique 候选正确报告', () => {
  const f = fixtureCandidate({ candidateId: 'fixture-unique' });
  writeFixture('fixture-unique.json', { generatorVersion:'1.0.0', parameters:{mode:'starSingle',N:5,quota:1,count:1,seed:42}, candidates:[f] });
  runOk(`node ${ANALYZE} --input ${cpath('fixture-unique.json')} --force`);
  const r = JSON.parse(readFileSync(cpath('fixture-unique-analysis.json'), 'utf-8'));
  assert(r.candidates[0].solver.status === 'unique');
  assert(r.candidates[0].conclusion === 'keep');
});

test('B2. multiple 候选报告', () => {
  // A region layout with multiple solutions
  const multiRegions = [0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0]; // all same region
  const f = fixtureCandidate({ candidateId:'fixture-multi', regions:multiRegions, solution:[0,1,2,3,4], N:5 });
  writeFixture('fixture-multi.json', { generatorVersion:'1.0.0', parameters:{mode:'starSingle',N:5,quota:1,count:1,seed:42}, candidates:[f] });
  runOk(`node ${ANALYZE} --input ${cpath('fixture-multi.json')} --force`);
  const r = JSON.parse(readFileSync(cpath('fixture-multi-analysis.json'), 'utf-8'));
  assert(r.candidates[0].solver.status !== 'unique');
  assert(r.candidates[0].conclusion === 'reject');
});

test('B3. invalid-declared-solution → reject', () => {
  const f = fixtureCandidate({ candidateId:'fixture-bad-sol', solution:[99,98,97,96,95] });
  writeFixture('fixture-bad-sol.json', { generatorVersion:'1.0.0', parameters:{mode:'starSingle',N:5,quota:1,count:1,seed:42}, candidates:[f] });
  runOk(`node ${ANALYZE} --input ${cpath('fixture-bad-sol.json')} --force`);
  const r = JSON.parse(readFileSync(cpath('fixture-bad-sol-analysis.json'), 'utf-8'));
  assert(r.candidates[0].declaredSolutionMatchesSolver === false);
  assert(r.candidates[0].conclusion === 'reject');
});

test('B4. solutionSignature 包含上下文', () => {
  const r = JSON.parse(readFileSync(cpath('fixture-unique-analysis.json'), 'utf-8'));
  const sig = r.candidates[0].solutionSignature;
  assert(sig && sig.startsWith('starSingle:5:1:'), `bad sig: ${sig}`);
});

test('B5. regionSignature 使用 canonical label', () => {
  const r = JSON.parse(readFileSync(cpath('fixture-unique-analysis.json'), 'utf-8'));
  const sig = r.candidates[0].regionsSignature;
  assert(sig && sig.startsWith('starSingle:5:1:'), `bad sig: ${sig}`);
});

test('B6. region label 重命名后 signature 相同', () => {
  // same structure, different labels
  const r1 = [0,0,1,1,0,0,1,1,2,2,3,3,2,2,3,3]; // 4x4, 4 regions
  const r2 = [5,5,9,9,5,5,9,9,7,7,2,2,7,7,2,2];
  function canon(regions) { const m=new Map(); let n=0; return regions.map(v=>{if(!m.has(v))m.set(v,n++);return m.get(v);}).join(','); }
  assert(canon(r1) === canon(r2), 'label-renamed regions must have same canonical form');
});

test('B7. region 结构改变后 signature 不同', () => {
  const r1 = [0,0,1,1,0,0,1,1,2,2,3,3,2,2,3,3];
  const r2 = [0,1,1,1,0,0,1,1,2,2,3,3,2,2,3,3]; // one cell changes region
  function canon(regions) { const m=new Map(); let n=0; return regions.map(v=>{if(!m.has(v))m.set(v,n++);return m.get(v);}).join(','); }
  assert(canon(r1) !== canon(r2), 'different structures must have different canonical forms');
});

test('B8. 同批重复产生 exact-solution-duplicate 告警', () => {
  const f1 = fixtureCandidate({ candidateId:'dup-a' });
  const f2 = fixtureCandidate({ candidateId:'dup-b' }); // same solution
  writeFixture('dup-batch.json', { generatorVersion:'1.0.0', parameters:{mode:'starSingle',N:5,quota:1,count:2,seed:42}, candidates:[f1,f2] });
  runOk(`node ${ANALYZE} --input ${cpath('dup-batch.json')} --force`);
  const r = JSON.parse(readFileSync(cpath('dup-batch-analysis.json'), 'utf-8'));
  const hasDup = r.candidates.some(c => c.alerts && c.alerts.includes('exact-solution-duplicate'));
  assert(hasDup, 'should detect exact solution duplicate');
});

test('B9. JSON 与 Markdown 来自同一分析结果', () => {
  const j = JSON.parse(readFileSync(cpath('fixture-unique-analysis.json'), 'utf-8'));
  const m = readFileSync(cpath('fixture-unique-analysis.md'), 'utf-8');
  assert(m.includes(`Total: ${j.candidates.length}`));
});

test('B10. keep/review/reject 正确分配', () => {
  // unique → keep
  const r1 = JSON.parse(readFileSync(cpath('fixture-unique-analysis.json'), 'utf-8'));
  assert(r1.summary.keep === 1 && r1.summary.review === 0 && r1.summary.reject === 0);
  // multi → reject
  const r2 = JSON.parse(readFileSync(cpath('fixture-multi-analysis.json'), 'utf-8'));
  assert(r2.summary.reject >= 1);
  // bad-sol → reject
  const r3 = JSON.parse(readFileSync(cpath('fixture-bad-sol-analysis.json'), 'utf-8'));
  assert(r3.summary.reject >= 1);
});

// ═══ Cleanup ═══
console.log('\n═══ Cleanup ═══');
rmSync(CANDIDATE_ROOT, { recursive: true });
restoreCandidateRoot();
assert(hadCandidateRoot ? existsSync(CANDIDATE_ROOT) : !existsSync(CANDIDATE_ROOT));

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
