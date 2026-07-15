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
import {
  canonicalizeRegions, canonicalRegionsSimple,
  d4AlignedRegionJaccard, d4FullyEquivalent,
} from './star-line-candidate-signatures.mjs';
import { computeOpeningFingerprint } from './star-line-fingerprint.mjs';

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

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
