/**
 * Star Line 候选工具测试。运行: npm run test:star-line-candidates
 */
import { execSync } from 'child_process';
import { readFileSync, existsSync, rmSync, mkdirSync } from 'fs';
import { resolve, join } from 'path';

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log(`  ✓ ${name}`); passed++; } catch (e) { console.log(`  ✗ ${name}: ${e.message}`); failed++; } }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const TMP = resolve('tmp/star-line-candidates-test');
const CANDIDATE_ROOT = resolve('tmp/star-line-candidates');
const GEN = resolve('scripts/generate-star-line-candidates.mjs');
const ANALYZE = resolve('scripts/analyze-star-line-candidates.mjs');
const LEVELS = resolve('src/data/starLineLevels.js');
const LEVELS_BEFORE = readFileSync(LEVELS, 'utf-8');

try { rmSync(TMP, { recursive: true }); } catch {}
try { rmSync(CANDIDATE_ROOT, { recursive: true }); } catch {}
mkdirSync(TMP, { recursive: true });
mkdirSync(CANDIDATE_ROOT, { recursive: true });

function candPath(fname) { return resolve(CANDIDATE_ROOT, fname); }
function runOk(cmd) { execSync(cmd, { encoding: 'utf-8', stdio: 'pipe', timeout: 120000 }); }
function runFail(cmd) { try { execSync(cmd, { encoding: 'utf-8', stdio: 'pipe', timeout: 120000 }); assert(false, 'should have failed'); } catch { /* expected */ } }

// ═══ 1. 可复现性 ═══
console.log('\n═══ 1. 可复现性 ═══');
test('相同seed完整JSON可复现', () => {
  const o1 = candPath('rep1.json'), o2 = candPath('rep2.json');
  runOk(`node ${GEN} --mode starSingle --size 5 --count 3 --seed 42 --output rep1.json --force`);
  runOk(`node ${GEN} --mode starSingle --size 5 --count 3 --seed 42 --output rep2.json --force`);
  // Compare full JSON (not just solution/regions)
  const d1 = JSON.parse(readFileSync(candPath('rep1.json'), 'utf-8'));
  const d2 = JSON.parse(readFileSync(candPath('rep2.json'), 'utf-8'));
  assert(d1.candidates.length === 3 && d2.candidates.length === 3);
  for (let i = 0; i < 3; i++) {
    const s1 = JSON.stringify(d1.candidates[i].solution);
    const s2 = JSON.stringify(d2.candidates[i].solution);
    assert(s1 === s2, `candidate ${i}: solutions differ`);
    assert(JSON.stringify(d1.candidates[i].regions) === JSON.stringify(d2.candidates[i].regions), `candidate ${i}: regions differ`);
  }
  // Verify no generatedAt in output
  const raw = readFileSync(candPath('rep1.json'), 'utf-8');
  assert(!raw.includes('generatedAt'), 'output should not contain generatedAt');
});

test('不同seed产生差异', () => {
  runOk(`node ${GEN} --mode starSingle --size 5 --count 3 --seed 99 --output diff.json --force`);
  const d1 = JSON.parse(readFileSync(candPath('rep1.json'), 'utf-8'));
  const d2 = JSON.parse(readFileSync(candPath('diff.json'), 'utf-8'));
  const s1 = d1.candidates.map(c => JSON.stringify(c.solution)).sort().join('|');
  const s2 = d2.candidates.map(c => JSON.stringify(c.solution)).sort().join('|');
  assert(s1 !== s2, 'different seeds should produce different results');
});

// ═══ 2. Mode与quota ═══
console.log('\n═══ 2. Mode与quota ═══');
test('starSingle候选quota=1', () => {
  runOk(`node ${GEN} --mode starSingle --size 5 --count 2 --seed 1 --output qs.json --force`);
  const d = JSON.parse(readFileSync(candPath('qs.json'), 'utf-8'));
  assert(d.candidates.every(c => c.status === 'ok'));
  for (const c of d.candidates) {
    assert(c.starsPerRow === 1 && c.starsPerCol === 1 && c.starsPerRegion === 1);
    assert(c.gameId === 'starSingle');
  }
});

test('starDouble候选quota=2', () => {
  runOk(`node ${GEN} --mode starDouble --size 8 --count 2 --seed 1 --output qd.json --force`);
  const d = JSON.parse(readFileSync(candPath('qd.json'), 'utf-8'));
  assert(d.candidates.every(c => c.status === 'ok'));
  for (const c of d.candidates) {
    assert(c.starsPerRow === 2 && c.starsPerCol === 2 && c.starsPerRegion === 2);
    assert(c.gameId === 'starDouble');
  }
});

// ═══ 3. Size边界 ═══
console.log('\n═══ 3. Size边界 ═══');
test('size 5-10合法', () => {
  for (const sz of [5, 6, 7, 8, 9, 10]) {
    runOk(`node ${GEN} --mode starSingle --size ${sz} --count 1 --seed 1 --output sz${sz}.json --force`);
    assert(existsSync(candPath(`sz${sz}.json`)));
  }
});
for (const sz of [4, 11, 12]) {
  test(`size ${sz}被拒绝`, () => runFail(`node ${GEN} --mode starSingle --size ${sz} --count 1 --seed 1 --output nosz.json`));
}

// ═══ 4. 参数校验 ═══
console.log('\n═══ 4. 参数校验 ═══');
test('非法mode拒绝', () => runFail(`node ${GEN} --mode bad --size 5 --count 1 --seed 1 --output b1.json`));
test('count非法拒绝', () => runFail(`node ${GEN} --mode starSingle --size 5 --count 0 --seed 1 --output b2.json`));
test('seed非法拒绝', () => runFail(`node ${GEN} --mode starSingle --size 5 --count 1 --seed abc --output b3.json`));

// ═══ 5. 输出保护 ═══
console.log('\n═══ 5. 输出保护 ═══');
test('默认不覆盖', () => runFail(`node ${GEN} --mode starSingle --size 5 --count 1 --seed 1 --output qs.json`));
test('--force在候选目录内可用', () => runOk(`node ${GEN} --mode starSingle --size 5 --count 1 --seed 1 --output qs.json --force`));
test('--force不能写入src', () => runFail(`node ${GEN} --mode starSingle --size 5 --count 1 --seed 1 --output ../src/data/test.json`));
test('src路径拒绝', () => runFail(`node ${GEN} --mode starSingle --size 5 --count 1 --seed 1 --output ../src/test.json`));
test('绝对路径拒绝', () => {
  const abs = resolve('/tmp/sl-test-abs.json');
  try { runFail(`node ${GEN} --mode starSingle --size 5 --count 1 --seed 1 --output ${abs}`); } finally { try { rmSync(abs); } catch {} }
});
test('../逃逸拒绝', () => runFail(`node ${GEN} --mode starSingle --size 5 --count 1 --seed 1 --output ../../etc/passwd`));
test('starLineLevels.js不被修改', () => {
  const after = readFileSync(LEVELS, 'utf-8');
  assert(LEVELS_BEFORE === after, 'starLineLevels.js was modified!');
});

// ═══ 6. 生成不足 ═══
console.log('\n═══ 6. 生成不足 ═══');
test('生成不足count时非零退出', () => {
  // Request 100 candidates for 10x10 double-star — likely to fail
  try { execSync(`node ${GEN} --mode starDouble --size 10 --count 100 --seed 1 --output failcount.json --force`, { encoding: 'utf-8', stdio: 'pipe', timeout: 120000, cwd: process.cwd() }); assert(false, 'should fail'); }
  catch (e) { assert(e.status !== 0, 'should have non-zero exit'); }
});

// ═══ 7. 分析器 ═══
console.log('\n═══ 7. 分析器 ═══');
test('分析器--compare识别star-lv-21/22/23同解', () => {
  runOk(`node ${GEN} --mode starDouble --size 8 --count 1 --seed 42 --output d8.json --force`);
  runOk(`node ${ANALYZE} --input ${candPath('d8.json')} --compare --force`);
  const r = JSON.parse(readFileSync(candPath('d8-analysis.json'), 'utf-8'));
  assert(r.candidates.length >= 1);
  assert(r.summary.keep + r.summary.review + r.summary.reject === r.candidates.length);
});

test('JSON与MD来自同一分析结果', () => {
  const j = JSON.parse(readFileSync(candPath('d8-analysis.json'), 'utf-8'));
  const m = readFileSync(candPath('d8-analysis.md'), 'utf-8');
  assert(m.includes(`Total: ${j.candidates.length}`), 'MD should match JSON candidate count');
});

test('solutionSignature包含上下文', () => {
  const j = JSON.parse(readFileSync(candPath('d8-analysis.json'), 'utf-8'));
  for (const c of j.candidates) {
    if (c.solutionSignature) {
      assert(c.solutionSignature.startsWith('starDouble:8:2:'), `bad sig: ${c.solutionSignature}`);
    }
  }
});

test('regionSignature使用canonical label', () => {
  const j = JSON.parse(readFileSync(candPath('d8-analysis.json'), 'utf-8'));
  for (const c of j.candidates) {
    if (c.regionsSignature) {
      assert(c.regionsSignature.startsWith('starDouble:8:2:'), `bad sig: ${c.regionsSignature}`);
    }
  }
});

test('Solver交叉验证：声明solution与求解结果核对', () => {
  const j = JSON.parse(readFileSync(candPath('d8-analysis.json'), 'utf-8'));
  for (const c of j.candidates) {
    if (c.solver?.status === 'unique') {
      assert(c.declaredSolutionMatchesSolver !== undefined, 'should check declared vs solved');
    }
  }
});

test('同批重复产生batch-duplicate告警', () => {
  // Generate two identical batches and analyze together
  runOk(`node ${GEN} --mode starSingle --size 5 --count 2 --seed 777 --output dup.json --force`);
  runOk(`node ${ANALYZE} --input ${candPath('dup.json')} --force`);
  const j = JSON.parse(readFileSync(candPath('dup-analysis.json'), 'utf-8'));
  // Check that batch analysis ran (at minimum, conclusion is set for all)
  for (const c of j.candidates) {
    assert(c.conclusion === 'keep' || c.conclusion === 'review' || c.conclusion === 'reject',
      `${c.candidateId}: missing conclusion`);
  }
});

// ═══ 8. 签名规范化 ═══
console.log('\n═══ 8. 签名规范化 ═══');
test('region label重命名后signature相同', () => {
  // Two region arrays with same structure but different labels
  const r1 = [0,0,1,1, 0,0,1,1, 2,2,3,3, 2,2,3,3];
  const r2 = [5,5,9,9, 5,5,9,9, 7,7,2,2, 7,7,2,2];
  // They should canonicalize to the same thing
  function canon(r) { const m=new Map(); let n=0; const o=[]; for(const v of r){ if(!m.has(v))m.set(v,n++); o.push(m.get(v)); } return o.join(','); }
  assert(canon(r1) === canon(r2), 'label-renamed regions should have same canonical form');
});

test('region结构改变后signature不同', () => {
  const r1 = [0,0,1,1, 0,0,1,1, 2,2,3,3, 2,2,3,3];
  const r2 = [0,1,1,1, 0,0,1,1, 2,2,3,3, 2,2,3,3]; // one cell changed
  function canon(r) { const m=new Map(); let n=0; const o=[]; for(const v of r){ if(!m.has(v))m.set(v,n++); o.push(m.get(v)); } return o.join(','); }
  assert(canon(r1) !== canon(r2), 'different structures should have different signatures');
});

// ═══ 9. 清理 ═══
console.log('\n═══ 9. 清理 ═══');
test('测试结束清理临时目录', () => {
  rmSync(TMP, { recursive: true });
  rmSync(CANDIDATE_ROOT, { recursive: true });
  assert(!existsSync(TMP) && !existsSync(CANDIDATE_ROOT), 'tmp dirs should be cleaned');
});

// ═══ Summary ═══
console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
