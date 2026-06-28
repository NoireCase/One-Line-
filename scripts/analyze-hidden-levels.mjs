/**
 * Hidden 关卡质量分析工具
 * 用法：node scripts/analyze-hidden-levels.mjs
 * 支持 5x5 (Easy) 和 7x7 (Medium)
 */
import { HIDDEN_LEVELS_LIST } from '../src/data/hiddenLevels.js';

function toRC(idx, N) { return { r: Math.floor(idx / N), c: idx % N }; }

function analyzeLevel(level, index) {
  const { id, title, N, path, keyNumbers, startIndex, description, archetypeTags } = level;
  const L = N * N;
  const knToIdx = {};
  for (const kn of keyNumbers) knToIdx[kn] = path[kn - 1];

  const segments = [];
  let hasClosePair = false, hasLongSegment = false;
  let closePairCount = 0, longSegCount = 0;
  let minExtra = Infinity, maxExtra = -Infinity, maxSegLen = 0;

  for (let i = 0; i < keyNumbers.length - 1; i++) {
    const a = keyNumbers[i], b = keyNumbers[i + 1];
    const idxA = knToIdx[a], idxB = knToIdx[b];
    const ra = toRC(idxA, N), rb = toRC(idxB, N);
    const manhattan = Math.abs(ra.r - rb.r) + Math.abs(ra.c - rb.c);
    const moves = b - a;
    const extra = moves - manhattan;
    const closePair = manhattan <= 2 && moves >= 5;
    const longSeg = moves >= (N === 5 ? 8 : 9);

    if (closePair) { hasClosePair = true; closePairCount++; }
    if (longSeg) { hasLongSegment = true; longSegCount++; }
    if (extra < minExtra) minExtra = extra;
    if (extra > maxExtra) maxExtra = extra;
    if (moves > maxSegLen) maxSegLen = moves;

    segments.push({ a, b, moves, manhattan, extra, closePair, longSeg });
  }

  // Path regularity
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
  const regularityScore = turns - maxRun * 3;

  // For 7x7: snake = maxRun >= 8
  const isSnake = N === 5 ? (maxRun >= 4 && turns <= 13) : (maxRun >= 8 && turns <= 16);
  const isRegular = N === 5 ? (maxRun >= 4 || turns <= 14) : (maxRun >= 5 && turns <= 20);
  const isSpiral = turns > (N === 5 ? 18 : 30) && maxRun <= 3;

  const startRC = toRC(startIndex, N);
  const endIdx = path[L - 1];
  const endRC = toRC(endIdx, N);

  // closePair dominant: close pair count > 40% of segments
  const closePairDominant = closePairCount > segments.length * 0.4;
  // long segment dominant: long seg count > 40% of segments
  const longSegDominant = longSegCount > segments.length * 0.4;

  return {
    index: index + 1, id, title, N, keyNumbers, keyCount: keyNumbers.length,
    startRC: `(${startRC.r},${startRC.c})`, endRC: `(${endRC.r},${endRC.c})`,
    startIdx: startIndex, endIdx,
    segments, hasClosePair, hasLongSegment,
    closePairCount, longSegCount, closePairDominant, longSegDominant,
    minExtra, maxExtra, maxSegLen,
    turns, maxRun, regularityScore, isSnake, isRegular, isSpiral,
    description, archetypeTags: archetypeTags || []
  };
}

function getDirStr(path, N) {
  const dirs = [];
  for (let i = 1; i < path.length; i++) {
    const pr = Math.floor(path[i-1]/N), pc = path[i-1]%N;
    const cr = Math.floor(path[i]/N), cc = path[i]%N;
    if (cr < pr) dirs.push('U'); else if (cr > pr) dirs.push('D');
    else if (cc < pc) dirs.push('L'); else dirs.push('R');
  }
  return dirs.join('');
}

function dirSim(p1, p2, N) {
  const d1 = getDirStr(p1, N), d2 = getDirStr(p2, N);
  let s = 0;
  for (let i = 0; i < Math.min(d1.length, d2.length); i++) if (d1[i] === d2[i]) s++;
  return Math.round(s / Math.min(d1.length, d2.length) * 100);
}

function sharedSuffix(p1, p2) {
  let l = 0;
  for (let i = 1; i <= Math.min(p1.length, p2.length); i++) {
    if (p1[p1.length - i] === p2[p2.length - i]) l++; else break;
  }
  return l;
}

function sharedPrefix(p1, p2) {
  let l = 0;
  for (let i = 0; i < Math.min(p1.length, p2.length); i++) {
    if (p1[i] === p2[i]) l++; else break;
  }
  return l;
}

// ── Main ──
console.log('Hidden 关卡质量分析报告\n');

const all = HIDDEN_LEVELS_LIST.map((l, i) => analyzeLevel(l, i));

// Group by N
const easy5 = all.filter(a => a.N === 5);
const medium7 = all.filter(a => a.N === 7);

// Basic table
console.log('| # | id | N | 关键数字 | 段数 | 段长 | extra | close | long | 起点 | 终点 | 风险 |');
console.log('|---|-----|---|---------|------|------|-------|-------|------|------|------|------|');

for (const a of all) {
  const segMoves = a.segments.map(s => s.moves).join('/');
  const segExtra = a.segments.map(s => s.extra).join('/');
  const risk = a.isSnake ? '⚠️ 蛇形' : a.isSpiral ? '⚠️ 螺旋' : a.isRegular ? '⚠️ 规律' : '✅';
  console.log(`| ${a.index} | ${a.id} | ${a.N} | ${a.keyCount} | ${a.segments.length} | ${segMoves} | ${segExtra} | ${a.hasClosePair ? '✓' : '—'} | ${a.hasLongSegment ? '✓' : '—'} | ${a.startRC} | ${a.endRC} | ${risk} |`);
}

// Segment details
console.log('\n分段详情：');
for (const a of all) {
  console.log(`\n─── #${a.index} ${a.id} (${a.title}) N=${a.N} ───`);
  if (a.archetypeTags.length > 0) console.log(`  archetype: [${a.archetypeTags.join(', ')}]`);
  for (const s of a.segments) {
    const tags = [];
    if (s.closePair) tags.push('CLOSE');
    if (s.longSeg) tags.push('LONG');
    const tagStr = tags.length > 0 ? ' [' + tags.join(',') + ']' : '';
    console.log(`  ${s.a}→${s.b}: ${s.moves}步 MD=${s.manhattan} extra=${s.extra}${tagStr}`);
  }
}

// Summary
console.log('\n══════ 总体统计 ══════');
console.log(`总计：${all.length} 关 (Easy 5×5: ${easy5.length}, Medium 7×7: ${medium7.length})`);

const closeAll = all.filter(a => a.hasClosePair).length;
const longAll = all.filter(a => a.hasLongSegment).length;
console.log(`含 close pair：${closeAll}/${all.length}`);
console.log(`含 long segment：${longAll}/${all.length}`);
console.log(`规律风险：${all.filter(a => a.isSnake || a.isRegular).length}/${all.length}`);

// Medium-specific quality
if (medium7.length > 0) {
  console.log('\n─── Medium 7×7 质量指标 ───');
  const closeDominant = medium7.filter(a => a.closePairDominant).length;
  const longDominant = medium7.filter(a => a.longSegDominant).length;
  console.log(`close pair 主导关 (占比>40%段)：${closeDominant}/${medium7.length} ${closeDominant > medium7.length * 0.4 ? '⚠️' : '✅'}`);
  console.log(`long segment 主导关 (占比>40%段)：${longDominant}/${medium7.length} ${longDominant > medium7.length * 0.4 ? '⚠️' : '✅'}`);
  console.log(`平均 maxSegLen：${(medium7.reduce((s,a)=>s+a.maxSegLen,0)/medium7.length).toFixed(1)}`);
  console.log(`平均 extra：${(medium7.reduce((s,a)=>s+a.maxExtra,0)/medium7.length).toFixed(1)}`);

  // Archetype coverage
  const archetypeCounts = {};
  for (const a of medium7) {
    for (const tag of a.archetypeTags) {
      archetypeCounts[tag] = (archetypeCounts[tag] || 0) + 1;
    }
  }
  console.log('\narchetype 覆盖：');
  for (const [tag, cnt] of Object.entries(archetypeCounts).sort((a,b) => b[1]-a[1])) {
    console.log(`  ${tag}: ${cnt} 关`);
  }
}

// Start/end distribution
const startCount = {}, endCount = {};
for (const a of all) {
  startCount[a.startRC] = (startCount[a.startRC] || 0) + 1;
  endCount[a.endRC] = (endCount[a.endRC] || 0) + 1;
}

console.log('\n起点分布：');
for (const [rc, cnt] of Object.entries(startCount).sort((a,b) => b[1]-a[1])) {
  const warn = cnt >= 4 ? ' ⚠️ 过度集中' : cnt >= 3 ? ' ⚠️ 偏多' : '';
  console.log(`  ${rc}: ${cnt} 关${warn}`);
}

console.log('\n终点分布：');
for (const [rc, cnt] of Object.entries(endCount).sort((a,b) => b[1]-a[1])) {
  const warn = cnt >= 5 ? ' ⚠️ 过度集中' : cnt >= 4 ? ' ⚠️ 偏多' : '';
  console.log(`  ${rc}: ${cnt} 关${warn}`);
}

// Pairwise similarity
console.log('\n─── 相似度分析 ───');
let simWarnings = 0;
for (let i = 0; i < all.length; i++) {
  for (let j = i + 1; j < all.length; j++) {
    const ds = dirSim(HIDDEN_LEVELS_LIST[i].path, HIDDEN_LEVELS_LIST[j].path, all[i].N);
    const ss = sharedSuffix(HIDDEN_LEVELS_LIST[i].path, HIDDEN_LEVELS_LIST[j].path);
    const sp = sharedPrefix(HIDDEN_LEVELS_LIST[i].path, HIDDEN_LEVELS_LIST[j].path);
    const threshold = all[i].N === 7 ? 12 : 10;
    if (ds >= 80 || ss >= threshold || sp >= threshold) {
      const tags = [];
      if (ds >= 80) tags.push(`dirSim=${ds}%`);
      if (ss >= threshold) tags.push(`sharedSuffix=${ss}`);
      if (sp >= threshold) tags.push(`sharedPrefix=${sp}`);
      console.log(`  ⚠️ ${all[i].id} ↔ ${all[j].id}: ${tags.join(', ')}`);
      simWarnings++;
    }
  }
}
if (simWarnings === 0) console.log('  ✅ 无高度相似 pair');

// Run-length profile clustering
const runProfiles = {};
for (const a of all) {
  const runs = [], dirs = getDirStr(HIDDEN_LEVELS_LIST[a.index-1].path, a.N);
  let r = 1;
  for (let i = 1; i < dirs.length; i++) {
    if (dirs[i] === dirs[i-1]) r++; else { runs.push(r); r = 1; }
  }
  runs.push(r);
  runs.sort((a,b) => a-b);
  const profile = runs.join(',');
  if (!runProfiles[profile]) runProfiles[profile] = [];
  runProfiles[profile].push(a.id);
}

const crowdedProfiles = Object.entries(runProfiles).filter(([,ids]) => ids.length >= 3);
if (crowdedProfiles.length > 0) {
  console.log('\n⚠️ Run-length profile 过度集中：');
  for (const [profile, ids] of crowdedProfiles) {
    console.log(`  profile=[${profile}]: ${ids.join(', ')} (${ids.length} 关)`);
  }
}

// Warnings summary
console.log('\n═══ Warnings ═══');
const warnings = [];
for (const a of all) {
  if (a.isSnake) warnings.push(`${a.id}: 蛇形路径`);
  else if (a.isSpiral) warnings.push(`${a.id}: 螺旋形路径`);
  else if (a.isRegular) warnings.push(`${a.id}: 路径过于规律 (turns=${a.turns}, maxRun=${a.maxRun})`);
  if (a.closePairDominant) warnings.push(`${a.id}: close pair 主导 (${a.closePairCount}/${a.segments.length} 段)`);
  if (a.longSegDominant) warnings.push(`${a.id}: long segment 主导 (${a.longSegCount}/${a.segments.length} 段)`);
}
for (const [rc, cnt] of Object.entries(startCount)) {
  if (cnt >= 4) warnings.push(`起点 ${rc} 过度集中 (${cnt} 关)`);
}
for (const [rc, cnt] of Object.entries(endCount)) {
  if (cnt >= 5) warnings.push(`终点 ${rc} 过度集中 (${cnt} 关)`);
}

if (warnings.length === 0) {
  console.log('✅ 无警告');
} else {
  for (const w of warnings) console.log(`  ⚠️ ${w}`);
}
