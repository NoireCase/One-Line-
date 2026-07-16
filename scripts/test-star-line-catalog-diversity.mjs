/**
 * Star Line 单星目录多样性回归测试 (Package 2D.2B)。
 *
 * 对正式 STAR_LINE_LEVELS 中的全部单星关卡做纯数据驱动检查
 * （不硬编码任何候选 ID 或关卡内容），防止后续关卡改动
 * 重新引入"数学不同、玩家体验相同"的重复谜题：
 *
 *   1. 单星关卡数量为 60
 *   2. exact solution 60/60 唯一
 *   3. canonical region (D4) 60/60 唯一
 *   4. 不存在 D4 区域+solution 完全等价的谜题对
 *   5. 任意两关（同尺寸）D4 相似度 < 0.90
 *   6. >0.80 高相似连通簇最大不超过 3 关
 *   7. 相邻玩家关卡 opening fingerprint 不重复
 */
import { STAR_LINE_LEVELS } from '../src/data/starLineLevels.js';
import { createHash } from 'crypto';
import {
  canonicalizeRegions, canonicalRegionsSimple,
  d4AlignedRegionJaccard, d4FullyEquivalent,
} from './star-line-candidate-signatures.mjs';
import { computeOpeningFingerprint } from './star-line-fingerprint.mjs';
import {
  analyzeDynamicOpening,
  compareDynamicOpenings,
  transformRegionsD4,
  validateDynamicOpeningTrace,
} from './star-line-dynamic-opening.mjs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; } catch (e) { console.log(`  ✗ ${name}: ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const singles = STAR_LINE_LEVELS.filter((l) => l.gameId === 'starSingle');

// 预计算（同尺寸两两 D4，只算一次供多个断言使用）
const info = singles.map((l) => ({
  id: l.id,
  N: l.N,
  playerLv: (() => { const n = parseInt(l.id.replace('star-lv-', ''), 10); return n <= 20 ? n : n - 10; })(),
  solutionKey: `${l.N}:` + [...l.solution].sort((a, b) => a - b).join(','),
  regionKey: `${l.N}:` + canonicalizeRegions(l.regions, l.N),
  canon: canonicalRegionsSimple(l.regions),
  fingerprint: computeOpeningFingerprint(l.N, l.regions, l.starsPerRow ?? 1).fingerprint,
  dynamic: analyzeDynamicOpening(l.N, l.regions, { quota: 1 }),
}));
const pairs = [];
for (let i = 0; i < singles.length; i++) {
  for (let j = i + 1; j < singles.length; j++) {
    if (singles[i].N !== singles[j].N) continue;
    const d4 = d4AlignedRegionJaccard(info[i].canon, info[j].canon, singles[i].N);
    if (d4 > 0.8) pairs.push({ i, j, d4 });
  }
}

console.log('═══ Star Line 单星目录多样性 ═══');

test('单星关卡数量为 60', () => {
  assert(singles.length === 60, `${singles.length} ≠ 60`);
});

test('exact solution 60/60 唯一', () => {
  const seen = new Map();
  for (const r of info) {
    assert(!seen.has(r.solutionKey), `solution 重复: ${seen.get(r.solutionKey)} ↔ ${r.id}`);
    seen.set(r.solutionKey, r.id);
  }
});

test('canonical region (D4) 60/60 唯一', () => {
  const seen = new Map();
  for (const r of info) {
    assert(!seen.has(r.regionKey), `region 重复: ${seen.get(r.regionKey)} ↔ ${r.id}`);
    seen.set(r.regionKey, r.id);
  }
});

test('无 D4 区域+solution 完全等价谜题', () => {
  for (const p of pairs) {
    if (p.d4 < 1) continue;
    const A = singles[p.i], B = singles[p.j];
    assert(!d4FullyEquivalent(A.regions, A.solution, B.regions, B.solution, A.N),
      `完全等价: ${A.id} ↔ ${B.id}`);
  }
});

test('任意两关 D4 相似度 < 0.90', () => {
  const bad = pairs.filter((p) => p.d4 >= 0.9);
  assert(bad.length === 0,
    bad.map((p) => `${singles[p.i].id}↔${singles[p.j].id}=${p.d4.toFixed(3)}`).join(', '));
});

test('>0.80 高相似连通簇 ≤ 3 关', () => {
  const parent = new Map();
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  for (const p of pairs) {
    for (const v of [p.i, p.j]) if (!parent.has(v)) parent.set(v, v);
    const a = find(p.i), b = find(p.j);
    if (a !== b) parent.set(a, b);
  }
  const sizes = new Map();
  for (const v of parent.keys()) { const r = find(v); sizes.set(r, (sizes.get(r) || 0) + 1); }
  const max = Math.max(0, ...sizes.values());
  assert(max <= 3, `最大连通簇 ${max} > 3`);
});

test('相邻玩家关卡 opening fingerprint 不重复', () => {
  const ordered = [...info].sort((a, b) => a.playerLv - b.playerLv);
  for (let i = 0; i + 1 < ordered.length; i++) {
    if (ordered[i + 1].playerLv - ordered[i].playerLv !== 1) continue;
    assert(ordered[i].fingerprint !== ordered[i + 1].fingerprint,
      `相邻同指纹: ${ordered[i].id} ~ ${ordered[i + 1].id}`);
  }
});

test('dynamic exact signature 60/60 唯一', () => {
  const seen = new Map();
  for (const r of info) {
    const signature = r.dynamic.exactDynamicSignature;
    assert(!seen.has(signature), `dynamic exact 重复: ${seen.get(signature)} ↔ ${r.id}`);
    seen.set(signature, r.id);
  }
});

test('dynamic opening 无 SHORT_CONTRADICTION', () => {
  const bad = info.filter((r) => r.dynamic.status === 'SHORT_CONTRADICTION');
  assert(bad.length === 0, bad.map((r) => r.id).join(', '));
});

test('dynamic trace 与全部 D4 变换稳定', () => {
  for (let i = 0; i < singles.length; i++) {
    const level = singles[i], expected = info[i].dynamic.exactDynamicSignature;
    assert(info[i].dynamic.d4Validation.valid, `${level.id}: D4 内部 trace 校验失败`);
    for (const transform of ['rotate90', 'mirrorVertical']) {
      const transformed = transformRegionsD4(level.regions, level.N, transform);
      const actual = analyzeDynamicOpening(level.N, transformed, { quota: 1 }).exactDynamicSignature;
      assert(actual === expected, `${level.id}: ${transform} 后 exact 变化`);
    }
  }
});

test('dynamic trace 不受 region id 重排影响', () => {
  for (let i = 0; i < singles.length; i++) {
    const level = singles[i];
    const relabeled = level.regions.map((rid) => 1000 - rid * 19);
    const actual = analyzeDynamicOpening(level.N, relabeled, { quota: 1 });
    assert(actual.exactDynamicSignature === info[i].dynamic.exactDynamicSignature,
      `${level.id}: region id 重排后 exact 变化`);
  }
});

test('dynamic trace 不受扫描顺序影响', () => {
  for (let i = 0; i < singles.length; i++) {
    const level = singles[i];
    const reversed = analyzeDynamicOpening(level.N, level.regions, { quota: 1, scanOrder: 'reverse' });
    assert(reversed.exactDynamicSignature === info[i].dynamic.exactDynamicSignature,
      `${level.id}: reverse scan 后 exact 变化`);
    assert(JSON.stringify(reversed.events) === JSON.stringify(info[i].dynamic.events),
      `${level.id}: reverse scan 后事件变化`);
  }
});

test('全部 dynamic trace 可按层回放', () => {
  for (let i = 0; i < singles.length; i++) {
    const level = singles[i], dynamic = info[i].dynamic;
    assert(dynamic.traceValidation.valid, `${level.id}: ${dynamic.traceValidation.errors.join('; ')}`);
    const replay = validateDynamicOpeningTrace(level.N, level.regions, dynamic, { quota: 1 });
    assert(replay.valid, `${level.id}: ${replay.errors.join('; ')}`);
  }
});

test('默认首星模式在首星层后停止', () => {
  for (const r of info) {
    if (r.dynamic.status !== 'FIRST_STAR') continue;
    assert(r.dynamic.layers.at(-1).index === r.dynamic.firstStarLayer,
      `${r.id}: 首星层 ${r.dynamic.firstStarLayer} 后仍有传播`);
  }
});

const dynamicFamilyCounts = new Map();
const dynamicClusterCounts = new Map();
for (const r of info) {
  const family = r.dynamic.openingFamily;
  dynamicFamilyCounts.set(family, (dynamicFamilyCounts.get(family) || 0) + 1);
  const cluster = r.dynamic.openingCluster;
  dynamicClusterCounts.set(cluster, (dynamicClusterCounts.get(cluster) || 0) + 1);
}
const noBasicLevels = info.filter((r) => r.dynamic.status === 'NO_BASIC_OPENING');
const depthCapLevels = info.filter((r) => r.dynamic.status === 'OPENING_DEPTH_CAP');
const nearPairs = [];
for (let i = 0; i < info.length; i++) {
  for (let j = i + 1; j < info.length; j++) {
    if (compareDynamicOpenings(info[i].dynamic, info[j].dynamic).nearDuplicate) {
      nearPairs.push(`${info[i].id}↔${info[j].id}`);
    }
  }
}

test('连续区域锁定 family 不超过工具接入前基线 12', () => {
  const count = dynamicFamilyCounts.get('REGION_LOCK_CHAIN_2PLUS_TO_REGION_SINGLETON') || 0;
  assert(count <= 12, `${count} > 工具接入前基线 12`);
});

test('NO_BASIC_OPENING / OPENING_DEPTH_CAP 不超过当前基线', () => {
  assert(noBasicLevels.length <= 7, `NO_BASIC_OPENING ${noBasicLevels.length} > 7`);
  assert(depthCapLevels.length === 0, `OPENING_DEPTH_CAP: ${depthCapLevels.map((r) => r.id).join(', ')}`);
});

console.log('\n── Dynamic opening 基线报告（非产品 reject 阈值）──');
for (const [cluster, count] of [...dynamicClusterCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
  console.log(`  cluster ${String(count).padStart(2)}  ${cluster}`);
}
for (const [family, count] of [...dynamicFamilyCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
  console.log(`  ${String(count).padStart(2)}  ${family}`);
}
console.log(`  NO_BASIC_OPENING: ${noBasicLevels.map((r) => r.id).join(', ') || '—'}`);
console.log(`  OPENING_DEPTH_CAP: ${depthCapLevels.map((r) => r.id).join(', ') || '—'}`);
console.log(`  near duplicate pairs（报告）: ${nearPairs.length}`);

const orderedDynamic = [...info].sort((a, b) => a.playerLv - b.playerLv);
const isComparableBasicOpening = (entry) => entry.dynamic.status === 'FIRST_STAR';
const familySpacingWarnings = [];
for (let i = 0; i + 1 < orderedDynamic.length; i++) {
  if (!isComparableBasicOpening(orderedDynamic[i]) || !isComparableBasicOpening(orderedDynamic[i + 1])) continue;
  if (orderedDynamic[i].dynamic.openingFamily === orderedDynamic[i + 1].dynamic.openingFamily) {
    familySpacingWarnings.push(`Lv.${orderedDynamic[i].playerLv}↔Lv.${orderedDynamic[i + 1].playerLv}:${orderedDynamic[i].dynamic.openingFamily}`);
  }
}
let densestWindow = null;
for (let start = 0; start + 10 <= orderedDynamic.length; start++) {
  const counts = new Map();
  for (const r of orderedDynamic.slice(start, start + 10).filter(isComparableBasicOpening)) {
    counts.set(r.dynamic.openingFamily, (counts.get(r.dynamic.openingFamily) || 0) + 1);
  }
  for (const [family, count] of counts) {
    if (!densestWindow || count > densestWindow.count) {
      densestWindow = { from: orderedDynamic[start].playerLv, to: orderedDynamic[start + 9].playerLv, family, count };
    }
  }
}
console.log(`  相邻同 family（报告）: ${familySpacingWarnings.length}`);
console.log(`  最密连续 10 关（报告）: Lv.${densestWindow.from}–${densestWindow.to} ${densestWindow.family} ×${densestWindow.count}`);

test('openingCluster 已接入且不回退工具接入前基线', () => {
  const region = dynamicClusterCounts.get('REGION_SINGLETON_OPENING') || 0;
  const nonRegion = (dynamicClusterCounts.get('LINE_SINGLETON_OPENING') || 0)
    + (dynamicClusterCounts.get('MIXED_OR_PARALLEL_OPENING') || 0)
    + (dynamicClusterCounts.get('OTHER_OPENING') || 0);
  assert(region <= 52, `REGION_SINGLETON_OPENING ${region} > 工具接入前基线 52`);
  assert(nonRegion >= 1, `非区域 singleton 开局 ${nonRegion} < 工具接入前基线 1`);
  assert((dynamicClusterCounts.get('NO_BASIC_OPENING') || 0) === 7,
    `NO_BASIC_OPENING=${dynamicClusterCounts.get('NO_BASIC_OPENING') || 0}，应保持 7`);
});

test('三个 region-singleton 子 family 不超过工具接入前基线', () => {
  const baselines = new Map([
    ['DIRECT_TO_REGION_SINGLETON', 21],
    ['REGION_LOCK_CHAIN_1_TO_REGION_SINGLETON', 19],
    ['REGION_LOCK_CHAIN_2PLUS_TO_REGION_SINGLETON', 12],
  ]);
  for (const [family, baseline] of baselines) {
    const count = dynamicFamilyCounts.get(family) || 0;
    assert(count <= baseline, `${family}=${count} > 工具接入前基线 ${baseline}`);
  }
});

const fourWindowViolations = [];
const tenWindowViolations = [];
for (let start = 0; start + 4 <= orderedDynamic.length; start++) {
  const window = orderedDynamic.slice(start, start + 4);
  if (window[0].playerLv === 6 && window[3].playerLv === 9) continue;
  const comparable = window.filter(isComparableBasicOpening);
  if (comparable.length < 4) continue;
  if (new Set(comparable.map((r) => r.dynamic.openingFamily)).size === 1) {
    fourWindowViolations.push(`Lv.${window[0].playerLv}–${window[3].playerLv}:${comparable[0].dynamic.openingFamily}`);
  }
}
for (let start = 0; start + 10 <= orderedDynamic.length; start++) {
  const window = orderedDynamic.slice(start, start + 10), counts = new Map();
  for (const r of window.filter(isComparableBasicOpening)) {
    counts.set(r.dynamic.openingFamily, (counts.get(r.dynamic.openingFamily) || 0) + 1);
  }
  for (const [family, count] of counts) {
    if (count > 4) tenWindowViolations.push(`Lv.${window[0].playerLv}–${window[9].playerLv}:${family}=${count}`);
  }
}

console.log(`  连续 4 关 family 违规窗口（报告）: ${fourWindowViolations.length}`);
console.log(`  连续 10 关 family 违规窗口（报告）: ${tenWindowViolations.length}`);

test('连续 4 关可比较基础开局不劣于工具接入前基线', () => {
  assert(fourWindowViolations.length <= 3,
    `${fourWindowViolations.length} > 工具接入前基线 3: ${fourWindowViolations.join(', ')}`);
});

test('连续 10 关可比较基础开局不劣于工具接入前基线', () => {
  assert(tenWindowViolations.length <= 25,
    `${tenWindowViolations.length} > 工具接入前基线 25: ${tenWindowViolations.join(', ')}`);
});

test('NO_BASIC_OPENING 不参与连续 family 比较', () => {
  assert(noBasicLevels.every((entry) => !isComparableBasicOpening(entry)), 'NO_BASIC_OPENING 被误纳入比较');
  assert(info.some(isComparableBasicOpening), '缺少可比较基础开局 fixture');
});

const preservedHashes = new Map(Object.entries({
  'star-lv-03': '15a1b322a60ca1007668e918e3a036916ef72c96d0ed9d43da8d73e99d438930',
  'star-lv-06': 'cd92a37023d8c7c96b249489425c53e5d0eba6bc250dd2029e42d9cd50516cd7',
  'star-lv-07': 'c5b076b91292f741220e276ac58f563a557f80bb8419b6c523ca0f75ab965de2',
  'star-lv-08': '94d8cf8b242a1bdf527bf2a73e2870bcf0a1a3d715a202ae0d7801db6dc56a3e',
  'star-lv-09': 'b3c16bf45b640b039031ac1758d6a12fd80cedc781a7a4fc56d10e0d47f240a0',
  'star-lv-15': 'a8088b93f6cc9f85afadcbc513ba658889147081f32642c28cde95bda6d89b93',
  'star-lv-44': '653b93a37c516d0345c401ae75ebfb655b0682b878a56e540a998153dd8a7584',
}));

test('7 个保留关卡数据完全不变', () => {
  for (const [id, expected] of preservedHashes) {
    const level = STAR_LINE_LEVELS.find((entry) => entry.id === id);
    const payload = JSON.stringify({ regions: level.regions, solution: level.solution, revealPath: level.revealPath });
    const actual = createHash('sha256').update(payload).digest('hex');
    assert(actual === expected, `${id} 数据变化`);
  }
});

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
