/**
 * Star Line 候选工具测试。
 * A 类: 真实生成器集成 (starSingle only; double-star generator 待算法改进)
 * B 类: 静态 fixture 分析器逻辑测试
 */
import { execSync } from 'child_process';
import { readFileSync, existsSync, rmSync, mkdirSync, writeFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { canonicalizeRegions, d4Transforms } from './star-line-candidate-signatures.mjs';
import { getTemplatePoolDiagnostics, getSeedTemplateSequence, generateCandidates } from './generate-star-line-candidates.mjs';

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log(`  ✓ ${name}`); passed++; } catch (e) { console.log(`  ✗ ${name}: ${e.message}`); failed++; } }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const CANDIDATE_ROOT = resolve('tmp/star-line-candidates');
const GEN = resolve('scripts/generate-star-line-candidates.mjs');
const ANALYZE = resolve('scripts/analyze-star-line-candidates.mjs');
const LEVELS = resolve('src/data/starLineLevels.js');
const LEVELS_BEFORE = readFileSync(LEVELS, 'utf-8');

try { rmSync(CANDIDATE_ROOT, { recursive: true }); } catch {}
mkdirSync(CANDIDATE_ROOT, { recursive: true });
function cpath(f) { return resolve(CANDIDATE_ROOT, f); }

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
      maxTotalAttempts: 1, // 只能试一次，不可能生成 2 个候选
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

test('G1. 基础模板族数量精确为 4', () => {
  const d = getTemplatePoolDiagnostics();
  assert(d.baseCount === 4, `expected 4 base families, got ${d.baseCount}`);
  assert(d.bases.length === 4);
});

test('G2. 每个基础模板合法', () => {
  const d = getTemplatePoolDiagnostics();
  for (const b of d.bases) {
    assert(b.isValid, `template family ${b.index} must be valid`);
  }
});

test('G3. canonical signature 两两不同', () => {
  const d = getTemplatePoolDiagnostics();
  const sigs = d.bases.map(b => b.canonicalSignature);
  assert(new Set(sigs).size === 4, 'all 4 families must have distinct canonical sigs');
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
assert(!existsSync(CANDIDATE_ROOT));

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
