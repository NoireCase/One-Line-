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
