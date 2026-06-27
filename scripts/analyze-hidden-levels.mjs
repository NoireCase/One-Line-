/**
 * Hidden 关卡质量分析工具
 * 用法：node scripts/analyze-hidden-levels.mjs
 *
 * 对每个 Hidden 关卡输出：
 * - 关键数字与段长
 * - 每段曼哈顿距离 / extra（绕行步数）
 * - close pair / 长段检测
 * - 起点位置
 * - 路径规律性评估
 */

import { HIDDEN_LEVELS_LIST } from '../src/data/hiddenLevels.js';

function toRC(idx, N) { return { r: Math.floor(idx / N), c: idx % N }; }

function analyzeLevel(level, index) {
  const { id, title, N, path, keyNumbers, startIndex } = level;
  const knToIdx = {};
  for (const kn of keyNumbers) knToIdx[kn] = path[kn - 1];

  const segments = [];
  let hasClosePair = false, hasLongSegment = false;
  let minExtra = Infinity, maxExtra = -Infinity;

  for (let i = 0; i < keyNumbers.length - 1; i++) {
    const a = keyNumbers[i], b = keyNumbers[i + 1];
    const idxA = knToIdx[a], idxB = knToIdx[b];
    const ra = toRC(idxA, N), rb = toRC(idxB, N);
    const manhattan = Math.abs(ra.r - rb.r) + Math.abs(ra.c - rb.c);
    const moves = b - a;
    const extra = moves - manhattan;
    const closePair = manhattan <= 2 && moves >= 5;
    const longSeg = moves >= 8;

    if (closePair) hasClosePair = true;
    if (longSeg) hasLongSegment = true;
    if (extra < minExtra) minExtra = extra;
    if (extra > maxExtra) maxExtra = extra;

    segments.push({ a, b, moves, manhattan, extra, closePair, longSeg });
  }

  // Path regularity check
  const dirs = [];
  let maxRun = 0, run = 1, turns = 0;
  for (let i = 1; i < path.length; i++) {
    const pr = Math.floor(path[i - 1] / N), pc = (path[i - 1] % N);
    const cr = Math.floor(path[i] / N), cc = path[i] % N;
    const dk = (cr - pr) + ',' + (cc - pc);
    dirs.push(dk);
    if (i > 1 && dirs[i - 1] === dirs[i - 2]) run++;
    else { if (run > maxRun) maxRun = run; run = 1; if (i > 1) turns++; }
  }
  if (run > maxRun) maxRun = run;

  // Heuristic regularity score: high turns + low maxRun = irregular
  const regularityScore = turns - maxRun * 3;
  const isRegular = maxRun >= 4 || turns <= 14;

  const startRC = toRC(startIndex, N);

  return {
    index: index + 1,
    id,
    title,
    keyNumbers,
    keyCount: keyNumbers.length,
    startRC: `(${startRC.r},${startRC.c})`,
    segments,
    hasClosePair,
    hasLongSegment,
    minExtra,
    maxExtra,
    turns,
    maxRun,
    regularityScore,
    isRegular,
    isSnakePattern: maxRun >= 4 && turns <= 13
  };
}

// ── main ──
console.log('Hidden 关卡质量分析报告\n');
console.log('| # | id | 关键数字 | 段数 | 段长 (moves) | extra | closePair | longSeg | 起点 | 规律风险 |');
console.log('|---|-----|---------|------|-------------|-------|-----------|---------|------|---------|');

for (let i = 0; i < HIDDEN_LEVELS_LIST.length; i++) {
  const a = analyzeLevel(HIDDEN_LEVELS_LIST[i], i);
  const segMoves = a.segments.map(s => s.moves).join('/');
  const segExtra = a.segments.map(s => s.extra).join('/');
  const risk = a.isSnakePattern ? '⚠️ 蛇形' : a.isRegular ? '⚠️ 规律' : '✅ 不规则';

  console.log(`| ${a.index} | ${a.id} | ${a.keyCount} 个 | ${a.segments.length} | ${segMoves} | ${segExtra} | ${a.hasClosePair ? '✅' : '—'} | ${a.hasLongSegment ? '✅' : '—'} | ${a.startRC} | ${risk} |`);
}

console.log('');
console.log('分段详情：');
for (let i = 0; i < HIDDEN_LEVELS_LIST.length; i++) {
  const a = analyzeLevel(HIDDEN_LEVELS_LIST[i], i);
  console.log(`\n─── #${a.index} ${a.id} (${a.title}) ───`);
  for (const s of a.segments) {
    const tags = [];
    if (s.closePair) tags.push('CLOSE');
    if (s.longSeg) tags.push('LONG');
    const tagStr = tags.length > 0 ? ' [' + tags.join(',') + ']' : '';
    console.log(`  ${s.a}→${s.b}: ${s.moves} 步, 曼哈顿=${s.manhattan}, extra=${s.extra}${tagStr}`);
  }
}

// Summary
const all = HIDDEN_LEVELS_LIST.map((l, i) => analyzeLevel(l, i));
const closeCount = all.filter(a => a.hasClosePair).length;
const longCount = all.filter(a => a.hasLongSegment).length;
const regularCount = all.filter(a => a.isSnakePattern || a.isRegular).length;

console.log(`\n═══════════════════════`);
console.log(`总计：${all.length} 关`);
console.log(`含 close pair：${closeCount}/${all.length}`);
console.log(`含 long segment：${longCount}/${all.length}`);
console.log(`规律风险：${regularCount}/${all.length}`);
console.log(`平均 turns：${(all.reduce((s, a) => s + a.turns, 0) / all.length).toFixed(1)}`);
console.log(`平均 maxRun：${(all.reduce((s, a) => s + a.maxRun, 0) / all.length).toFixed(1)}`);

// ── 玩家感知相似度分析 ──
console.log(`\n══════ 玩家感知相似度 ══════`);

// Start/end position distribution
const startCount = {};
const endCount = {};
for (const a of all) {
  startCount[a.startRC] = (startCount[a.startRC] || 0) + 1;
  const endIdx = HIDDEN_LEVELS_LIST[a.index-1].path[24];
  const endRC = `(${Math.floor(endIdx/5)},${endIdx%5})`;
  endCount[endRC] = (endCount[endRC] || 0) + 1;
}

console.log(`\n起点分布：`);
for (const [rc, cnt] of Object.entries(startCount).sort((a,b)=>b[1]-a[1])) {
  const warn = cnt >= 3 ? ' ⚠️ 过度集中' : cnt >= 2 ? ' ⚠️ 偏多' : '';
  console.log(`  ${rc}: ${cnt} 关${warn}`);
}

console.log(`\n终点分布：`);
for (const [rc, cnt] of Object.entries(endCount).sort((a,b)=>b[1]-a[1])) {
  const warn = cnt >= 4 ? ' ⚠️ 过度集中' : cnt >= 3 ? ' ⚠️ 偏多' : '';
  console.log(`  ${rc}: ${cnt} 关${warn}`);
}

// Pairwise direction similarity
function getDirStrCmp(path) {
  const dirs = [];
  const NN = 5;
  for (let i = 1; i < path.length; i++) {
    const pr = Math.floor(path[i-1]/NN), pc = path[i-1]%NN;
    const cr = Math.floor(path[i]/NN), cc = path[i]%NN;
    if (cr < pr) dirs.push('U'); else if (cr > pr) dirs.push('D');
    else if (cc < pc) dirs.push('L'); else dirs.push('R');
  }
  return dirs.join('');
}

function dirSimCmp(p1, p2) {
  const d1 = getDirStrCmp(p1), d2 = getDirStrCmp(p2);
  let s = 0;
  for (let i = 0; i < Math.min(d1.length, d2.length); i++) if (d1[i] === d2[i]) s++;
  return Math.round(s / Math.min(d1.length, d2.length) * 100);
}

function sharedSuffixCmp(p1, p2) {
  let l = 0;
  for (let i = 1; i <= Math.min(p1.length, p2.length); i++) {
    if (p1[p1.length - i] === p2[p2.length - i]) l++; else break;
  }
  return l;
}

console.log(`\n高度相似 pair（dirSim >= 80% 或 sharedSuffix >= 10）：`);
let warnings = 0;
for (let i = 0; i < all.length; i++) {
  for (let j = i + 1; j < all.length; j++) {
    const ds = dirSimCmp(HIDDEN_LEVELS_LIST[i].path, HIDDEN_LEVELS_LIST[j].path);
    const ss = sharedSuffixCmp(HIDDEN_LEVELS_LIST[i].path, HIDDEN_LEVELS_LIST[j].path);
    if (ds >= 80 || ss >= 10) {
      const tag = ds >= 80 ? `dirSim=${ds}%` : '';
      const stag = ss >= 10 ? `sharedSuffix=${ss}` : '';
      console.log(`  ⚠️  ${HIDDEN_LEVELS_LIST[i].id} ↔ ${HIDDEN_LEVELS_LIST[j].id}: ${[tag, stag].filter(Boolean).join(', ')}`);
      warnings++;
    }
  }
}
if (warnings === 0) console.log('  ✅ 无高度相似 pair');

// Close pair concentration
const closePairTotal = all.reduce((s, a) => s + a.segments.filter(seg => seg.closePair).length, 0);
console.log(`\nClose pair 总计：${closePairTotal} 段`);
console.log(`Close pair 覆盖率：${closeCount}/${all.length} 关`);

// Run-length profile clustering
const runProfiles = {};
for (const a of all) {
  const runs = [];
  let r = 1;
  const dirs = getDirStrCmp(HIDDEN_LEVELS_LIST[a.index-1].path);
  for (let i = 1; i < dirs.length; i++) {
    if (dirs[i] === dirs[i-1]) r++; else { runs.push(r); r = 1; }
  }
  runs.push(r);
  const profile = runs.sort((a,b)=>a-b).join(',');
  if (!runProfiles[profile]) runProfiles[profile] = [];
  runProfiles[profile].push(a.id);
}

const crowdedProfiles = Object.entries(runProfiles).filter(([,ids]) => ids.length >= 3);
if (crowdedProfiles.length > 0) {
  console.log(`\n⚠️  Run-length profile 过度集中：`);
  for (const [profile, ids] of crowdedProfiles) {
    console.log(`  profile=[${profile}]: ${ids.join(', ')} (${ids.length} 关)`);
  }
}
