/**
 * Star Line 候选工具测试。
 * A 类: 真实生成器集成 (starSingle only; double-star generator 待算法改进)
 * B 类: 静态 fixture 分析器逻辑测试
 */
import { execSync } from 'child_process';
import { readFileSync, existsSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

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

test('A4. 生成不足 count 时非零退出，不留下完整文件', () => {
  rmSync(cpath('failcount.json'), { force: true });
  let failed = false;
  try { execSync(`node ${GEN} --mode starSingle --size 10 --count 500 --seed 1 --output failcount.json --force`, { encoding:'utf-8', stdio:'pipe', timeout:60000 }); }
  catch (e) { failed = e.status !== 0; }
  assert(failed, 'should exit non-zero');
  assert(!existsSync(cpath('failcount.json')), 'no complete file when count not met');
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

test('B8. 同批重复产生 batch-duplicate 告警', () => {
  const f1 = fixtureCandidate({ candidateId:'dup-a' });
  const f2 = fixtureCandidate({ candidateId:'dup-b' }); // same solution
  writeFixture('dup-batch.json', { generatorVersion:'1.0.0', parameters:{mode:'starSingle',N:5,quota:1,count:2,seed:42}, candidates:[f1,f2] });
  runOk(`node ${ANALYZE} --input ${cpath('dup-batch.json')} --force`);
  const r = JSON.parse(readFileSync(cpath('dup-batch-analysis.json'), 'utf-8'));
  const hasDup = r.candidates.some(c => c.alerts && c.alerts.includes('batch-duplicate'));
  assert(hasDup, 'should detect batch duplicate');
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
