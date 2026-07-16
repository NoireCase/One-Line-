/**
 * Star Line 工作台测试 (Package 2D.1)。
 *
 * 覆盖：导入/修改/导出后数据一致、dev-only 隔离、
 * 检查报告（覆盖/连通/Solver/全目录 D4 相似度/最小区域/开局指纹）、
 * 导出模板被 generator 读取、路径安全、指纹稳定、正式关卡数据不被修改。
 */
import { execSync } from 'child_process';
import { readFileSync, existsSync, rmSync, mkdirSync, renameSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { STAR_LINE_LEVELS } from '../src/data/starLineLevels.js';
import { loadExternalTemplateFile } from './generate-star-line-candidates.mjs';
import { canonicalRegionsSimple } from './star-line-candidate-signatures.mjs';
import { computeOpeningFingerprint } from './star-line-fingerprint.mjs';

let passed = 0, failed = 0;
const TEST_FILTER = process.env.STAR_LINE_WORKBENCH_TEST_FILTER;
function test(name, fn) {
  if (TEST_FILTER && !name.includes(TEST_FILTER)) return;
  try { fn(); console.log(`  ✓ ${name}`); passed++; } catch (e) { console.log(`  ✗ ${name}: ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const CANDIDATE_ROOT = resolve('tmp/star-line-candidates');
const CANDIDATE_ROOT_BACKUP = resolve('tmp', `star-line-workbench-test-backup-${process.pid}`);
const WB = resolve('scripts/star-line-workbench.mjs');
const LEVELS = resolve('src/data/starLineLevels.js');
const LEVELS_BEFORE = readFileSync(LEVELS, 'utf-8');

const hadCandidateRoot = existsSync(CANDIDATE_ROOT);
if (hadCandidateRoot) renameSync(CANDIDATE_ROOT, CANDIDATE_ROOT_BACKUP);
mkdirSync(CANDIDATE_ROOT, { recursive: true });
function cpath(f) { return resolve(CANDIDATE_ROOT, f); }
function spath(f) { return resolve(CANDIDATE_ROOT, 'workbench', f); }

function restoreCandidateRoot() {
  if (!existsSync(CANDIDATE_ROOT_BACKUP)) return;
  try { rmSync(CANDIDATE_ROOT, { recursive: true, force: true }); } catch { /* ignore */ }
  renameSync(CANDIDATE_ROOT_BACKUP, CANDIDATE_ROOT);
}
process.once('exit', restoreCandidateRoot);

function runOk(cmd) {
  return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe', timeout: 60000 });
}
function runFail(cmd) {
  try { execSync(cmd, { encoding: 'utf-8', stdio: 'pipe', timeout: 60000 }); assert(false, 'should fail'); }
  catch (e) { if (e.message === 'should fail') throw e; }
}
function inspectJson(session) {
  return JSON.parse(runOk(`node ${WB} inspect --session ${session} --json`));
}

const REF_LEVEL = STAR_LINE_LEVELS.find((l) => l.id === 'star-lv-31');
const SINGLE_10 = STAR_LINE_LEVELS.filter((l) => l.gameId === 'starSingle' && l.N === 10);

// ═══ W1. 导入 ═══
console.log('\n═══ W1. 导入 ═══');

test('W1a. 导入正式关卡后会话数据与关卡一致', () => {
  runOk(`node ${WB} import --level star-lv-31 --session w1.json --force`);
  const s = JSON.parse(readFileSync(spath('w1.json'), 'utf-8'));
  assert(s.kind === 'star-line-workbench-session');
  assert(s.N === REF_LEVEL.N, 'N 一致');
  assert(JSON.stringify(s.regions) === JSON.stringify(REF_LEVEL.regions), 'regions 一致');
  assert(JSON.stringify(s.declaredSolution) === JSON.stringify(REF_LEVEL.solution), 'solution 一致');
  assert(s.source.type === 'level' && s.source.ref === 'star-lv-31');
});

test('W1b. 导入不存在的关卡失败', () => {
  runFail(`node ${WB} import --level star-lv-999 --session w1b.json --force`);
  assert(!existsSync(spath('w1b.json')), '失败时不写会话');
});

test('W1c. 导入候选文件（按 candidateId）', () => {
  // 用生成器产出一个真实候选文件
  runOk(`node scripts/generate-star-line-candidates.mjs --mode starSingle --size 10 --count 1 --seed 42 --output w1c-cand.json --force`);
  const cand = JSON.parse(readFileSync(cpath('w1c-cand.json'), 'utf-8')).candidates[0];
  runOk(`node ${WB} import --candidate ${cpath('w1c-cand.json')} --id ${cand.candidateId} --session w1c.json --force`);
  const s = JSON.parse(readFileSync(spath('w1c.json'), 'utf-8'));
  assert(JSON.stringify(s.regions) === JSON.stringify(cand.regions), '候选 regions 一致');
  assert(JSON.stringify(s.declaredSolution) === JSON.stringify(cand.solution), '候选 solution 一致');
  assert(s.source.type === 'candidate');
});

test('W1d. 默认不覆盖已有会话，--force 才覆盖', () => {
  runFail(`node ${WB} import --level star-lv-31 --session w1.json`);
  runOk(`node ${WB} import --level star-lv-31 --session w1.json --force`);
});

// ═══ W2. 编辑 ═══
console.log('\n═══ W2. 编辑 ═══');

test('W2a. r,c=rid 与 idx=rid 两种格式修改后数据一致', () => {
  runOk(`node ${WB} import --level star-lv-31 --session w2.json --force`);
  const before = JSON.parse(readFileSync(spath('w2.json'), 'utf-8'));
  const N = before.N;
  // 找一个可安全改动的格子：直接改回原值验证写入路径（数据一致性检查）
  const rid00 = before.regions[0];
  runOk(`node ${WB} edit --session w2.json --set 0,0=${rid00} --set 0=${rid00}`);
  const after = JSON.parse(readFileSync(spath('w2.json'), 'utf-8'));
  assert(JSON.stringify(after.regions) === JSON.stringify(before.regions), '等值编辑不改变数据');
  // 真实修改
  const target = before.regions[1];
  runOk(`node ${WB} edit --session w2.json --set 0,0=${target === rid00 ? (rid00 + 1) % N : target}`);
  const changed = JSON.parse(readFileSync(spath('w2.json'), 'utf-8'));
  assert(changed.regions[0] !== rid00 || target === rid00, '编辑已生效');
});

test('W2b. 非法 --set 被拒绝', () => {
  runFail(`node ${WB} edit --session w2.json --set abc`);
  runFail(`node ${WB} edit --session w2.json --set 999=0`);
  runFail(`node ${WB} edit --session w2.json --set 0,0=99`);
});

// ═══ W3. inspect 检查报告 ═══
console.log('\n═══ W3. inspect 检查报告 ═══');

test('W3a. 正式关卡 inspect：覆盖/连通 OK + UNIQUE + declared 一致', () => {
  runOk(`node ${WB} import --level star-lv-31 --session w3.json --force`);
  const r = inspectJson('w3.json');
  assert(r.coverage.valid === true, '覆盖/连通 OK');
  assert(r.solver.status === 'UNIQUE', 'solver UNIQUE');
  assert(r.declaredSolutionMatchesSolver === true, 'declared 与 solver 一致');
});

test('W3b. 全目录 D4 相似度：正式关自身相似度为 1.0 且比对全部同尺寸单星', () => {
  const r = inspectJson('w3.json');
  assert(r.catalog.compared === SINGLE_10.length, `必须比对全部 ${SINGLE_10.length} 个 10×10 单星，实际 ${r.catalog.compared}`);
  assert(r.catalog.maxD4Similarity === 1.0, '自身相似度 1.0');
  assert(r.catalog.closestLevelId === 'star-lv-31', '最近关卡是自己');
});

test('W3c. 最小区域面积/数量/象限 与指纹 helper 一致', () => {
  const r = inspectJson('w3.json');
  const fp = computeOpeningFingerprint(REF_LEVEL.N, REF_LEVEL.regions, 1);
  assert(r.minRegion.area === fp.minRegionArea);
  assert(r.minRegion.count === fp.minRegionCount);
  assert(JSON.stringify(r.minRegion.quadrants) === JSON.stringify(fp.minRegionQuadrants));
  assert(r.openingFingerprint.fingerprint === fp.fingerprint, '指纹与 helper 一致');
});

test('W3d. 开局指纹稳定：两次 inspect 结果一致', () => {
  const r1 = inspectJson('w3.json');
  const r2 = inspectJson('w3.json');
  assert(r1.openingFingerprint.fingerprint === r2.openingFingerprint.fingerprint, '指纹稳定');
  assert(JSON.stringify(r1.openingFingerprint.initialForcedStars) === JSON.stringify(r2.openingFingerprint.initialForcedStars), '强制步稳定');
});

test('W3e. 破坏连通后 inspect 报告 INVALID', () => {
  runOk(`node ${WB} import --level star-lv-01 --session w3e.json --force`);
  // star-lv-01 5×5: 将角落格改成不相邻区域制造非连通/覆盖问题
  const s = JSON.parse(readFileSync(spath('w3e.json'), 'utf-8'));
  const farRid = s.regions[s.regions.length - 1];
  runOk(`node ${WB} edit --session w3e.json --set 0,0=${farRid}`);
  const r = inspectJson('w3e.json');
  assert(r.coverage.valid === false, '必须报告非法');
});

// ═══ W4. 导出 ═══
console.log('\n═══ W4. 导出 ═══');

test('W4a. 导入→修改→导出后数据一致（canonical 结构不变）', () => {
  runOk(`node ${WB} import --level star-lv-31 --session w4.json --force`);
  runOk(`node ${WB} export --session w4.json --output w4-template.json --force`);
  const t = JSON.parse(readFileSync(cpath('w4-template.json'), 'utf-8'));
  assert(t.kind === 'star-line-template');
  assert(t.N === REF_LEVEL.N);
  // 导出 regions 是会话 regions 的 canonical relabel，结构一致
  const sessionCanon = canonicalRegionsSimple(REF_LEVEL.regions).join(',');
  assert(t.regions.join(',') === sessionCanon, '导出 regions 与会话结构一致');
  assert(Array.isArray(t.solution) && t.solution.length === REF_LEVEL.N, '导出包含 solution');
  assert(typeof t.openingFingerprint === 'string' && t.openingFingerprint.startsWith('v1|'), '导出包含指纹');
});

test('W4b. 导出模板可被 generator 读取验证', () => {
  const t = loadExternalTemplateFile(cpath('w4-template.json'));
  assert(t.N === 10, 'generator 接受导出模板');
  assert(Array.isArray(t.solution) && t.solution.length === 10, 'generator 求解一致');
});

test('W4c. 非 UNIQUE 会话拒绝导出', () => {
  runOk(`node ${WB} import --level star-lv-01 --session w4c.json --force`);
  // 全部改成 region 0 以外仍保留 5 区不可行 → 直接改一格制造 NO_SOLUTION/MULTIPLE 或非法
  runOk(`node ${WB} edit --session w4c.json --set 0,0=1 --set 0,1=1`);
  const r = inspectJson('w4c.json');
  if (r.coverage.valid && r.solver.status === 'UNIQUE') {
    // 这种编辑组合仍 UNIQUE 的话，进一步破坏覆盖（region 0 清空）
    const s = JSON.parse(readFileSync(spath('w4c.json'), 'utf-8'));
    for (let i = 0; i < s.regions.length; i++) {
      if (s.regions[i] === 0) runOk(`node ${WB} edit --session w4c.json --set ${i}=1`);
    }
  }
  runFail(`node ${WB} export --session w4c.json --output w4c-template.json --force`);
  assert(!existsSync(cpath('w4c-template.json')), '拒绝导出时不写文件');
});

// ═══ W5. 隔离与安全 ═══
console.log('\n═══ W5. 隔离与安全 ═══');

test('W5a. dev-only 隔离：src/ 不引用工作台及生产工具脚本', () => {
  const offenders = [];
  const patterns = ['star-line-workbench', 'star-line-macro-mutations', 'star-line-fingerprint', 'star-line-candidate-signatures', 'generate-star-line-candidates', 'analyze-star-line-candidates'];
  function scan(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) { scan(full); continue; }
      if (!/\.(jsx?|mjs)$/.test(entry.name)) continue;
      const content = readFileSync(full, 'utf-8');
      for (const p of patterns) {
        if (content.includes(p)) offenders.push(`${full} → ${p}`);
      }
    }
  }
  scan(resolve('src'));
  assert(offenders.length === 0, `src/ 引用了开发工具: ${offenders.join('; ')}`);
});

test('W5b. 工作台不引用正式 UI 组件/hooks/存档模块', () => {
  const content = readFileSync(WB, 'utf-8');
  assert(!content.includes('src/components'), '不引用组件');
  assert(!content.includes('src/hooks'), '不引用 hooks');
  assert(!content.includes('localStorage'), '不触碰存档');
  assert(!content.includes('src/game/'), '不引用游戏运行时模块');
});

test('W5c. 会话路径安全：--session 不允许路径逃逸', () => {
  runFail(`node ${WB} import --level star-lv-31 --session ../evil.json --force`);
  runFail(`node ${WB} import --level star-lv-31 --session sub/evil.json --force`);
});

test('W5d. 导出路径安全：--output 不允许逃逸', () => {
  runFail(`node ${WB} export --session w4.json --output ../../src/data/evil.json --force`);
  runFail(`node ${WB} export --session w4.json --output /tmp/abs.json --force`);
});

test('W5e. starLineLevels.js 未被修改', () => {
  assert(readFileSync(LEVELS, 'utf-8') === LEVELS_BEFORE, 'starLineLevels.js 被修改!');
});

// ═══ Cleanup ═══
console.log('\n═══ Cleanup ═══');
rmSync(CANDIDATE_ROOT, { recursive: true });
restoreCandidateRoot();
assert(hadCandidateRoot ? existsSync(CANDIDATE_ROOT) : !existsSync(CANDIDATE_ROOT));

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
