/**
 * Star Line 候选工具测试。
 * 运行: node scripts/test-star-line-candidate-tools.mjs
 */
import { execSync } from 'child_process';
import { readFileSync, existsSync, rmSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { STAR_LINE_LEVELS } from '../src/data/starLineLevels.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}: ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const TMP = resolve('tmp/star-line-candidates-test');
const GEN = resolve('scripts/generate-star-line-candidates.mjs');
const ANALYZE = resolve('scripts/analyze-star-line-candidates.mjs');

// Setup
try { rmSync(TMP, { recursive: true }); } catch {}
mkdirSync(TMP, { recursive: true });

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
  } catch (e) {
    throw new Error(`command failed: ${cmd}\n${e.stderr || e.stdout || e.message}`);
  }
}

// ═══ 1. 可复现性 ═══
console.log('\n═══ 1. 可复现性 ═══');

test('相同 seed 产生相同候选', () => {
  const out1 = resolve(TMP, 'repro1.json');
  const out2 = resolve(TMP, 'repro2.json');
  run(`node ${GEN} --mode starSingle --size 5 --count 3 --seed 42 --output ${out1} --force`);
  run(`node ${GEN} --mode starSingle --size 5 --count 3 --seed 42 --output ${out2} --force`);
  const d1 = JSON.parse(readFileSync(out1, 'utf-8'));
  const d2 = JSON.parse(readFileSync(out2, 'utf-8'));
  // Compare ignoring generatedAt
  for (let i = 0; i < d1.candidates.length; i++) {
    assert(d1.candidates[i].solution.join(',') === d2.candidates[i].solution.join(','),
      `candidate ${i}: solutions differ`);
    assert(d1.candidates[i].regions.join(',') === d2.candidates[i].regions.join(','),
      `candidate ${i}: regions differ`);
  }
});

test('不同 seed 产生不同候选', () => {
  const out1 = resolve(TMP, 'diff1.json');
  const out2 = resolve(TMP, 'diff2.json');
  run(`node ${GEN} --mode starSingle --size 5 --count 5 --seed 42 --output ${out1} --force`);
  run(`node ${GEN} --mode starSingle --size 5 --count 5 --seed 99 --output ${out2} --force`);
  const d1 = JSON.parse(readFileSync(out1, 'utf-8'));
  const d2 = JSON.parse(readFileSync(out2, 'utf-8'));
  const sols1 = d1.candidates.filter(c => c.status === 'ok').map(c => c.solution.join(',')).sort();
  const sols2 = d2.candidates.filter(c => c.status === 'ok').map(c => c.solution.join(',')).sort();
  assert(sols1.join('|') !== sols2.join('|'), 'different seeds produced identical results');
});

// ═══ 2. Mode 与 quota ═══
console.log('\n═══ 2. Mode 与 quota ═══');

test('starSingle 候选 quota=1', () => {
  const out = resolve(TMP, 'qs1.json');
  run(`node ${GEN} --mode starSingle --size 5 --count 2 --seed 1 --output ${out} --force`);
  const d = JSON.parse(readFileSync(out, 'utf-8'));
  for (const c of d.candidates) {
    if (c.status === 'ok') {
      assert(c.starsPerRow === 1 && c.starsPerCol === 1 && c.starsPerRegion === 1);
      assert(c.gameId === 'starSingle');
    }
  }
});

test('starDouble 候选 quota=2', () => {
  const out = resolve(TMP, 'qd2.json');
  run(`node ${GEN} --mode starDouble --size 8 --count 2 --seed 1 --output ${out} --force`);
  const d = JSON.parse(readFileSync(out, 'utf-8'));
  for (const c of d.candidates) {
    if (c.status === 'ok') {
      assert(c.starsPerRow === 2 && c.starsCol === 2 && c.starsPerRegion === 2);
      assert(c.gameId === 'starDouble');
    }
  }
});

// ═══ 3. Size 边界 ═══
console.log('\n═══ 3. Size 边界 ═══');

test('size 5 合法', () => {
  const out = resolve(TMP, 'sz5.json');
  run(`node ${GEN} --mode starSingle --size 5 --count 1 --seed 1 --output ${out} --force`);
  assert(existsSync(out));
});

test('size 10 合法', () => {
  const out = resolve(TMP, 'sz10.json');
  run(`node ${GEN} --mode starSingle --size 10 --count 1 --seed 1 --output ${out} --force`);
  assert(existsSync(out));
});

test('size 4 被拒绝', () => {
  const out = resolve(TMP, 'sz4.json');
  try { run(`node ${GEN} --mode starSingle --size 4 --count 1 --seed 1 --output ${out}`); assert(false, 'should have thrown'); }
  catch (e) { assert(e.message.includes('5-10'), e.message); }
});

test('size 11 被拒绝', () => {
  const out = resolve(TMP, 'sz11.json');
  try { run(`node ${GEN} --mode starSingle --size 11 --count 1 --seed 1 --output ${out}`); assert(false, 'should have thrown'); }
  catch (e) { assert(e.message.includes('5-10'), e.message); }
});

// ═══ 4. 输出保护 ═══
console.log('\n═══ 4. 输出保护 ═══');

test('默认不覆盖已有输出', () => {
  const out = resolve(TMP, 'no-overwrite.json');
  run(`node ${GEN} --mode starSingle --size 5 --count 1 --seed 1 --output ${out} --force`);
  try { run(`node ${GEN} --mode starSingle --size 5 --count 1 --seed 1 --output ${out}`); assert(false, 'should have thrown'); }
  catch (e) { assert(e.message.includes('已存在'), e.message); }
});

test('不修改正式关卡文件', () => {
  const LEVELS = resolve('src/data/starLineLevels.js');
  const before = readFileSync(LEVELS, 'utf-8');
  // Run generator — it should not touch starLineLevels.js
  const out = resolve(TMP, 'no-touch.json');
  run(`node ${GEN} --mode starSingle --size 5 --count 1 --seed 1 --output ${out} --force`);
  const after = readFileSync(LEVELS, 'utf-8');
  assert(before === after, 'starLineLevels.js was modified by candidate generator');
});

// ═══ 5. 分析器基础能力 ═══
console.log('\n═══ 5. 分析器基础能力 ═══');

test('分析器处理单个候选文件', () => {
  const out = resolve(TMP, 'analyze-in.json');
  run(`node ${GEN} --mode starSingle --size 5 --count 2 --seed 42 --output ${out} --force`);
  const result = run(`node ${ANALYZE} --input ${out}`);
  assert(result.includes('Summary:'), 'should contain summary');
  assert(existsSync(resolve(TMP, 'analyze-in-analysis.json')), 'should create JSON report');
  assert(existsSync(resolve(TMP, 'analyze-in-analysis.md')), 'should create MD report');
});

test('JSON 与 Markdown 来自同一分析结果', () => {
  // Verify JSON and MD have same candidate count
  const jsonPath = resolve(TMP, 'analyze-in-analysis.json');
  const mdPath = resolve(TMP, 'analyze-in-analysis.md');
  const json = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  const md = readFileSync(mdPath, 'utf-8');
  assert(md.includes(`Total candidates: ${json.candidates.length}`));
});

test('唯一解候选正确报告', () => {
  const jsonPath = resolve(TMP, 'analyze-in-analysis.json');
  const json = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  const okCands = json.candidates.filter(c => c.solver?.status === 'unique');
  assert(okCands.length > 0, 'should have unique-solution candidates');
  for (const c of okCands) {
    assert(c.conclusion === 'keep' || c.conclusion === 'review');
  }
});

test('solutionSignature 与 regionSignature 稳定', () => {
  const out = resolve(TMP, 'sig1.json');
  run(`node ${GEN} --mode starSingle --size 5 --count 1 --seed 42 --output ${out} --force`);
  // Analyze twice
  run(`node ${ANALYZE} --input ${out}`);
  const j1 = JSON.parse(readFileSync(resolve(TMP, 'sig1-analysis.json'), 'utf-8'));
  run(`node ${ANALYZE} --input ${out}`);
  const j2 = JSON.parse(readFileSync(resolve(TMP, 'sig1-analysis.json'), 'utf-8'));
  assert(j1.candidates[0].solutionSignature === j2.candidates[0].solutionSignature);
  assert(j1.candidates[0].regionsSignature === j2.candidates[0].regionsSignature);
});

// ═══ 6. 双星 Lv.1–3 同解识别 ═══
console.log('\n═══ 6. 双星 Lv.1–3 同解识别 ═══');

test('star-lv-21 至 23 被识别为相同 solution 布局', () => {
  // lv21, lv22, lv23 all have the same solution signature
  const lv21 = STAR_LINE_LEVELS[20]; // star-lv-21
  const lv22 = STAR_LINE_LEVELS[21]; // star-lv-22
  const lv23 = STAR_LINE_LEVELS[22]; // star-lv-23
  const sig21 = [...lv21.solution].sort((a,b)=>a-b).join(',');
  const sig22 = [...lv22.solution].sort((a,b)=>a-b).join(',');
  const sig23 = [...lv23.solution].sort((a,b)=>a-b).join(',');
  assert(sig21 === sig22, 'lv21 and lv22 should have identical solution signature');
  assert(sig22 === sig23, 'lv22 and lv23 should have identical solution signature');
});

// ═══ Summary ═══
console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
