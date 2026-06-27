/**
 * Classic / Diagonal 关卡质量评分器。
 * 运行：node scripts/score-level-quality.mjs  或  npm run score:levels
 */

import { writeFileSync, mkdirSync } from 'fs';
import { createClassicLevel } from '../src/game/classic/createClassicLevel.js';
import { CLASSIC_STRUCTURE } from '../src/config/gameModes.js';
import { MOVEMENT_TYPES } from '../src/config/gameModes.js';

const MODES = ['classic', 'diagonal'];

// ── helpers ──

function toCoord(idx, N) { return { r: Math.floor(idx / N), c: idx % N }; }
function avg(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// 从 grid 重建路径（val 按路径顺序赋值）
function getPath(grid) {
  return grid.map((c, i) => ({ i, val: c.val }))
    .sort((a, b) => a.val - b.val).map(v => v.i);
}

// 计算路径移动方向
function getDirections(path, N) {
  const dirs = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = toCoord(path[i], N), b = toCoord(path[i + 1], N);
    const dr = b.r - a.r, dc = b.c - a.c;
    const isDiag = Math.abs(dr) === 1 && Math.abs(dc) === 1;
    dirs.push({ dr, dc, isDiag, idx: i });
  }
  return dirs;
}

// ── metrics ──

function computeMetrics(grid, path, N, dirs) {
  const hiddenCount = grid.filter(c => c.isHidden).length;
  const hiddenVals = new Set(grid.filter(c => c.isHidden).map(c => c.val));

  // hidden streak
  let maxHiddenStreak = 0, streak = 0;
  for (let v = 1; v <= N * N; v++) {
    if (hiddenVals.has(v)) { streak++; maxHiddenStreak = Math.max(maxHiddenStreak, streak); }
    else { streak = 0; }
  }
  const hiddenRatio = hiddenCount / (N * N);

  // turns & direction changes
  let turnCount = 0;
  const runLengths = [];
  let runLen = 1;
  for (let i = 1; i < dirs.length; i++) {
    if (dirs[i].dr !== dirs[i - 1].dr || dirs[i].dc !== dirs[i - 1].dc) {
      turnCount++;
      runLengths.push(runLen);
      runLen = 1;
    } else {
      runLen++;
    }
  }
  runLengths.push(runLen);
  const maxStraightRun = runLengths.length > 0 ? Math.max(...runLengths) : 0;
  const avgStraightRun = avg(runLengths);
  const turnRate = path.length > 0 ? turnCount / (path.length - 1) : 0;
  const dirChangeRate = dirs.length > 0 ? turnCount / dirs.length : 0;

  // diagonal
  const diagCount = dirs.filter(d => d.isDiag).length;
  const diagRatio = dirs.length > 0 ? diagCount / dirs.length : 0;
  let maxDiagRun = 0, diagRun = 0;
  for (const d of dirs) {
    if (d.isDiag) { diagRun++; maxDiagRun = Math.max(maxDiagRun, diagRun); }
    else { diagRun = 0; }
  }

  // snake detection: dominant direction bias
  let directionBias = 0;
  const horizCount = dirs.filter(d => d.dr === 0 && d.dc !== 0).length;
  const vertCount = dirs.filter(d => d.dc === 0 && d.dr !== 0).length;
  const orthoTotal = horizCount + vertCount;
  if (orthoTotal > 0) {
    directionBias = Math.max(horizCount, vertCount) / orthoTotal;
  }

  // 主方向一致性
  const dirKeys = dirs.map(d => `${d.dr},${d.dc}`);
  const dirFreq = {};
  dirKeys.forEach(k => { dirFreq[k] = (dirFreq[k] || 0) + 1; });
  const maxDirFreq = Math.max(...Object.values(dirFreq));
  const dominantDirRatio = dirs.length > 0 ? maxDirFreq / dirs.length : 0;

  // 可见锚点间距
  const visiblePositions = [];
  for (let v = 1; v <= N * N; v++) {
    if (!hiddenVals.has(v)) visiblePositions.push(v);
  }
  let maxAnchorGap = 0;
  for (let i = 1; i < visiblePositions.length; i++) {
    maxAnchorGap = Math.max(maxAnchorGap, visiblePositions[i] - visiblePositions[i - 1]);
  }

  return {
    hiddenCount, hiddenRatio, maxHiddenStreak,
    turnCount, maxStraightRun, avgStraightRun: Math.round(avgStraightRun * 10) / 10,
    turnRate: Math.round(turnRate * 1000) / 1000,
    dirChangeRate: Math.round(dirChangeRate * 1000) / 1000,
    diagCount, diagRatio: Math.round(diagRatio * 1000) / 1000,
    maxDiagRun, directionBias: Math.round(directionBias * 1000) / 1000,
    dominantDirRatio: Math.round(dominantDirRatio * 1000) / 1000,
    maxAnchorGap
  };
}

// ── penalties ──

function computePenalties(m, mode, N) {
  const p = {};
  const reasons = [];

  // snakePenalty — dominant direction + row/col fill pattern
  const biasPenalty = clamp((m.directionBias - 0.55) * 60, 0, 30);
  const dominantPenalty = clamp((m.dominantDirRatio - 0.25) * 80, 0, 25);
  p.snakePenalty = Math.round(clamp(biasPenalty + dominantPenalty, 0, 50));

  if (p.snakePenalty >= 25) reasons.push('SNAKE_PATTERN_HIGH');

  // longRunPenalty
  const runRatio = m.maxStraightRun / N;
  p.longRunPenalty = Math.round(clamp((runRatio - 0.5) * 40, 0, 25));
  if (m.maxStraightRun >= N) reasons.push('LONG_STRAIGHT_RUN');

  // monotonyPenalty
  const monotonyScore = (m.turnRate < 0.2 ? 15 : 0) + (m.dominantDirRatio > 0.35 ? 10 : 0);
  p.monotonyPenalty = clamp(monotonyScore, 0, 25);

  if (p.monotonyPenalty >= 15) reasons.push('MONOTONOUS_PATH');

  // chaosPenalty
  let chaosScore = 0;
  if (m.turnRate > 0.7) chaosScore += 12;
  if (m.maxStraightRun <= 2 && N > 5) chaosScore += 8;
  if (m.dirChangeRate > 0.65) chaosScore += 8;
  p.chaosPenalty = clamp(chaosScore, 0, 28);

  if (p.chaosPenalty >= 15) reasons.push('CHAOTIC_PATH');

  // turnBalancePenalty
  const idealTurnRate = N === 5 ? 0.4 : N === 7 ? 0.45 : 0.48;
  const turnDeviation = Math.abs(m.turnRate - idealTurnRate);
  p.turnBalancePenalty = Math.round(clamp(turnDeviation * 40, 0, 20));

  // anchorDistributionPenalty
  const gapRatio = m.maxAnchorGap / (N * N);
  const gapPenalty = clamp((gapRatio - 0.15) * 60, 0, 20);
  const densityPenalty = m.hiddenRatio > 0.55 ? 10 : 0;
  p.anchorDistributionPenalty = clamp(gapPenalty + densityPenalty, 0, 30);

  if (p.anchorDistributionPenalty >= 15) reasons.push('ANCHOR_DISTRIBUTION_BAD');

  // diagonalIdentityPenalty — only for diagonal mode
  if (mode === 'diagonal') {
    let diagScore = 0;
    if (m.diagRatio < 0.15) diagScore += 25;
    else if (m.diagRatio > 0.55) diagScore += 20;
    if (m.maxDiagRun > N) diagScore += 10;
    p.diagonalIdentityPenalty = clamp(diagScore, 0, 35);
    if (m.diagRatio < 0.15) reasons.push('DIAGONAL_IDENTITY_LOW');
    if (m.diagRatio > 0.55) reasons.push('DIAGONAL_IDENTITY_OVERUSED');
  } else {
    p.diagonalIdentityPenalty = 0;
  }

  return { penalties: p, reasons };
}

// ── scores ──

function computeQualityScore(penalties) {
  const total = Object.values(penalties).reduce((a, b) => a + b, 0);
  return clamp(100 - total, 0, 100);
}

function computeDifficultyScore(m, N) {
  const sizeWeight = N === 5 ? 10 : N === 7 ? 30 : 50;
  const hiddenWeight = Math.round(m.hiddenRatio * 35);
  const gapWeight = clamp(m.maxHiddenStreak * 3, 0, 15);
  const complexityWeight = clamp(m.turnRate * 25, 0, 25);
  return clamp(sizeWeight + hiddenWeight + gapWeight + complexityWeight, 0, 100);
}

// ── main ──

function scoreAllLevels() {
  const results = [];

  for (const mode of MODES) {
    let displayLevel = 1;
    const isDiag = mode === 'diagonal';
    const rules = isDiag
      ? { movement: MOVEMENT_TYPES.diagonal, path: { allowCrossing: false, requireSequential: true, requireFullBoard: true } }
      : { movement: MOVEMENT_TYPES.orthogonal, path: { allowCrossing: false, requireSequential: true, requireFullBoard: true } };

    for (const section of CLASSIC_STRUCTURE) {
      const { diff, count } = section;
      for (let idx = 0; idx < count; idx++) {
        const result = createClassicLevel(diff, idx, rules, mode);
        const grid = result?.grid;
        if (!grid) continue;
        const N = grid ? Math.round(Math.sqrt(grid.length)) : 0;
        const path = getPath(grid);
        const dirs = getDirections(path, N);
        const metrics = computeMetrics(grid, path, N, dirs);
        const { penalties, reasons } = computePenalties(metrics, mode, N);
        const qualityScore = computeQualityScore(penalties);
        const difficultyScore = computeDifficultyScore(metrics, N);

        if (qualityScore < 65 && !reasons.includes('QUALITY_BELOW_THRESHOLD')) {
          reasons.push('QUALITY_BELOW_THRESHOLD');
        }

        results.push({
          mode, displayLevel, diff, levelIdx: idx, N,
          qualityScore: Math.round(qualityScore),
          difficultyScore: Math.round(difficultyScore),
          penalties,
          metrics,
          rejectReasons: reasons
        });

        displayLevel++;
      }
    }
  }

  return results;
}

// ── report ──

function generateReport(results) {
  mkdirSync('reports', { recursive: true });

  // JSON
  writeFileSync('reports/level-quality-report.json', JSON.stringify(results, null, 2));

  // Markdown summary
  const lines = [];
  lines.push('# Classic / Diagonal 关卡质量评分报告\n');
  lines.push('> 当前评分仅作为关卡质量诊断，不作为关卡废弃或测试失败的唯一依据。\n');

  for (const mode of MODES) {
    const modeResults = results.filter(r => r.mode === mode);
    const avgQ = Math.round(avg(modeResults.map(r => r.qualityScore)));
    const avgD = Math.round(avg(modeResults.map(r => r.difficultyScore)));
    const rejected = modeResults.filter(r => r.rejectReasons.length > 0).length;

    lines.push(`## ${mode === 'classic' ? 'Classic' : 'Diagonal'}`);
    lines.push('');
    lines.push(`| 指标 | 值 |`);
    lines.push(`|------|----|`);
    lines.push(`| 关卡数 | ${modeResults.length} |`);
    lines.push(`| 平均 qualityScore | ${avgQ} |`);
    lines.push(`| 平均 difficultyScore | ${avgD} |`);
    lines.push(`| 有 rejectReasons 的关卡 | ${rejected} |`);
    lines.push('');

    for (const diff of ['easy', 'medium', 'hard']) {
      const d = modeResults.filter(r => r.diff === diff);
      const aq = Math.round(avg(d.map(r => r.qualityScore)));
      const ad = Math.round(avg(d.map(r => r.difficultyScore)));
      lines.push(`- **${diff}**: ${d.length} 关, avg quality ${aq}, avg difficulty ${ad}`);
    }
    lines.push('');

    // Top 10 worst
    const worst = [...modeResults].sort((a, b) => a.qualityScore - b.qualityScore).slice(0, 10);
    lines.push('### 最差 qualityScore Top 10');
    lines.push('');
    lines.push('| Lv | diff | quality | reasons |');
    lines.push('|-----|------|--------|---------|');
    for (const r of worst) {
      lines.push(`| ${r.displayLevel} | ${r.diff} | ${r.qualityScore} | ${r.rejectReasons.join(', ') || '—'} |`);
    }
    lines.push('');

    // Snake top 10
    const snake = [...modeResults].sort((a, b) => b.penalties.snakePenalty - a.penalties.snakePenalty).slice(0, 10);
    lines.push('### snakePenalty Top 10');
    lines.push('');
    lines.push('| Lv | diff | snakePenalty |');
    lines.push('|-----|------|-------------|');
    for (const r of snake) {
      lines.push(`| ${r.displayLevel} | ${r.diff} | ${r.penalties.snakePenalty} |`);
    }
    lines.push('');

    // Diagonal-specific
    if (mode === 'diagonal') {
      const diagLow = [...modeResults].filter(r => r.metrics.diagRatio < 0.15).sort((a, b) => a.metrics.diagRatio - b.metrics.diagRatio);
      const diagHigh = [...modeResults].filter(r => r.metrics.diagRatio > 0.55).sort((a, b) => b.metrics.diagRatio - a.metrics.diagRatio);
      lines.push('### Diagonal identity 异常');
      lines.push('');
      if (diagLow.length > 0) {
        lines.push(`斜向比例过低 (< 0.15): ${diagLow.length} 关 — ${diagLow.map(r => `Lv${r.displayLevel}`).join(', ')}`);
      }
      if (diagHigh.length > 0) {
        lines.push(`斜向比例过高 (> 0.55): ${diagHigh.length} 关 — ${diagHigh.map(r => `Lv${r.displayLevel}`).join(', ')}`);
      }
      if (diagLow.length === 0 && diagHigh.length === 0) {
        lines.push('无异常');
      }
      lines.push('');
    }
  }

  // 难度曲线摘要
  lines.push('## 难度曲线');
  lines.push('');
  lines.push('| mode | easy avg | medium avg | hard avg | 趋势 |');
  lines.push('|------|---------|-----------|---------|------|');
  for (const mode of MODES) {
    const mr = results.filter(r => r.mode === mode);
    const ea = Math.round(avg(mr.filter(r => r.diff === 'easy').map(r => r.difficultyScore)));
    const ma = Math.round(avg(mr.filter(r => r.diff === 'medium').map(r => r.difficultyScore)));
    const ha = Math.round(avg(mr.filter(r => r.diff === 'hard').map(r => r.difficultyScore)));
    const trend = ea < ma && ma < ha ? '✅ 递进' : '⚠️ 不平滑';
    lines.push(`| ${mode} | ${ea} | ${ma} | ${ha} | ${trend} |`);
  }
  lines.push('');

  const md = lines.join('\n');
  writeFileSync('reports/level-quality-summary.md', md);

  return md;
}

// ── execute ──

console.log('Scoring Classic & Diagonal levels...\n');
const results = scoreAllLevels();
const summary = generateReport(results);

console.log(summary);

const overallAvgQ = Math.round(avg(results.map(r => r.qualityScore)));
const rejectedTotal = results.filter(r => r.rejectReasons.length > 0).length;
console.log(`\n总览: ${results.length} 关, 平均 qualityScore ${overallAvgQ}, 有 rejectReasons 的 ${rejectedTotal} 关`);
console.log('报告已输出到 reports/level-quality-report.json 和 reports/level-quality-summary.md');
