/**
 * Classic / Diagonal 候选关卡生成流水线。
 * 用法：
 *   node scripts/generate-level-candidates.mjs --mode classic --diff hard --count 5
 *   node scripts/generate-level-candidates.mjs --mode diagonal --diff medium --count 5 --multiplier 5
 *   node scripts/generate-level-candidates.mjs --mode classic --diff hard --count 5 --stage true
 */

import { writeFileSync, mkdirSync } from 'fs';
import { createClassicLevel } from '../src/game/classic/createClassicLevel.js';
import { MOVEMENT_TYPES } from '../src/config/gameModes.js';
import { CONFIG } from '../src/game/classic/createClassicLevel.js';

// ── CLI ──
const args = process.argv.slice(2);
function opt(k, def) { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : def; }

const mode = opt('--mode', 'classic');
const diff = opt('--diff', 'easy');
const count = parseInt(opt('--count', '5'), 10);
const multiplier = parseInt(opt('--multiplier', '5'), 10);
const maxRounds = parseInt(opt('--max-rounds', '5'), 10);
const maxCandidates = opt('--max-candidates', null);
const maxCandHard = maxCandidates ? parseInt(maxCandidates, 10) : Infinity;
const doStage = opt('--stage', 'false') === 'true';
const generatedAt = new Date().toISOString();
const generatorVersion = '1.0.0';

const VALID_MODES = ['classic', 'diagonal'];
const VALID_DIFFS = ['easy', 'medium', 'hard'];

if (!VALID_MODES.includes(mode) || !VALID_DIFFS.includes(diff)) {
  console.error(`用法: --mode classic|diagonal --diff easy|medium|hard --count N [--multiplier M] [--max-rounds N] [--max-candidates N] [--stage true]`);
  process.exit(1);
}

// ── helpers ──
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function getPath(grid) {
  return grid.map((c, i) => ({ i, val: c.val })).sort((a, b) => a.val - b.val).map(v => v.i);
}

function toCoord(idx, N) { return { r: Math.floor(idx / N), c: idx % N }; }

function getDirections(path, N) {
  const dirs = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = toCoord(path[i], N), b = toCoord(path[i + 1], N);
    dirs.push({ dr: b.r - a.r, dc: b.c - a.c, isDiag: Math.abs(b.r - a.r) === 1 && Math.abs(b.c - a.c) === 1, idx: i });
  }
  return dirs;
}

// ── validator ──
function validateLevel(grid, N, cfg) {
  const errors = [];
  if (!grid || grid.length !== N * N) errors.push('BOARD_SIZE_MISMATCH');
  if (grid) {
    const vals = grid.map(c => c.val).filter(v => v > 0);
    if (new Set(vals).size !== N * N) errors.push('VAL_NOT_UNIQUE');
    const hiddenCount = grid.filter(c => c.isHidden).length;
    if (hiddenCount < cfg.hiddenMin || hiddenCount > cfg.hiddenMax) errors.push('HIDDEN_COUNT_OUT_OF_RANGE');
  }
  return errors;
}

// ── scorer (same logic as score-level-quality, self-contained) ──
function computeMetrics(grid, path, N) {
  const hiddenVals = new Set(grid.filter(c => c.isHidden).map(c => c.val));
  const hiddenCount = grid.filter(c => c.isHidden).length;
  const hiddenRatio = hiddenCount / (N * N);

  let maxHiddenStreak = 0, streak = 0;
  for (let v = 1; v <= N * N; v++) {
    if (hiddenVals.has(v)) { streak++; maxHiddenStreak = Math.max(maxHiddenStreak, streak); }
    else { streak = 0; }
  }

  const dirs = getDirections(path, N);
  let turnCount = 0;
  const runLengths = [];
  let runLen = 1;
  for (let i = 1; i < dirs.length; i++) {
    if (dirs[i].dr !== dirs[i - 1].dr || dirs[i].dc !== dirs[i - 1].dc) {
      turnCount++; runLengths.push(runLen); runLen = 1;
    } else { runLen++; }
  }
  runLengths.push(runLen);
  const maxStraightRun = runLengths.length > 0 ? Math.max(...runLengths) : 0;
  const turnRate = path.length > 0 ? turnCount / (path.length - 1) : 0;

  const diagCount = dirs.filter(d => d.isDiag).length;
  const diagRatio = dirs.length > 0 ? diagCount / dirs.length : 0;
  let maxDiagRun = 0, diagRun = 0;
  for (const d of dirs) { if (d.isDiag) { diagRun++; maxDiagRun = Math.max(maxDiagRun, diagRun); } else { diagRun = 0; } }

  const horizCount = dirs.filter(d => d.dr === 0 && d.dc !== 0).length;
  const vertCount = dirs.filter(d => d.dc === 0 && d.dr !== 0).length;
  const orthoTotal = horizCount + vertCount;
  const directionBias = orthoTotal > 0 ? Math.max(horizCount, vertCount) / orthoTotal : 0;

  const dirFreq = {};
  dirs.forEach(d => { const k = `${d.dr},${d.dc}`; dirFreq[k] = (dirFreq[k] || 0) + 1; });
  const dominantDirRatio = dirs.length > 0 ? Math.max(...Object.values(dirFreq)) / dirs.length : 0;

  const visiblePositions = [];
  for (let v = 1; v <= N * N; v++) { if (!hiddenVals.has(v)) visiblePositions.push(v); }
  let maxAnchorGap = 0;
  for (let i = 1; i < visiblePositions.length; i++) maxAnchorGap = Math.max(maxAnchorGap, visiblePositions[i] - visiblePositions[i - 1]);

  return { hiddenCount, hiddenRatio, maxHiddenStreak, turnCount, maxStraightRun, turnRate, diagCount,
    diagRatio: Math.round(diagRatio * 1000) / 1000, maxDiagRun, directionBias: Math.round(directionBias * 1000) / 1000,
    dominantDirRatio: Math.round(dominantDirRatio * 1000) / 1000, maxAnchorGap };
}

function computePenalties(m, mode, N) {
  const p = {};
  const reasons = [];
  const biasPenalty = clamp((m.directionBias - 0.55) * 60, 0, 30);
  const dominantPenalty = clamp((m.dominantDirRatio - 0.25) * 80, 0, 25);
  p.snakePenalty = Math.round(clamp(biasPenalty + dominantPenalty, 0, 50));
  if (p.snakePenalty >= 25) reasons.push('SNAKE_PATTERN_HIGH');

  p.longRunPenalty = Math.round(clamp((m.maxStraightRun / N - 0.5) * 40, 0, 25));
  if (m.maxStraightRun >= N) reasons.push('LONG_STRAIGHT_RUN');

  const monotonyScore = (m.turnRate < 0.2 ? 15 : 0) + (m.dominantDirRatio > 0.35 ? 10 : 0);
  p.monotonyPenalty = clamp(monotonyScore, 0, 25);
  if (p.monotonyPenalty >= 15) reasons.push('MONOTONOUS_PATH');

  let chaosScore = 0;
  if (m.turnRate > 0.7) chaosScore += 12;
  if (m.maxStraightRun <= 2 && N > 5) chaosScore += 8;
  p.chaosPenalty = clamp(chaosScore, 0, 28);
  if (p.chaosPenalty >= 15) reasons.push('CHAOTIC_PATH');

  const idealTurnRate = N === 5 ? 0.4 : N === 7 ? 0.45 : 0.48;
  p.turnBalancePenalty = Math.round(clamp(Math.abs(m.turnRate - idealTurnRate) * 40, 0, 20));

  const gapPenalty = clamp((m.maxAnchorGap / (N * N) - 0.15) * 60, 0, 20);
  const densityPenalty = m.hiddenRatio > 0.55 ? 10 : 0;
  p.anchorDistributionPenalty = clamp(gapPenalty + densityPenalty, 0, 30);
  if (p.anchorDistributionPenalty >= 15) reasons.push('ANCHOR_DISTRIBUTION_BAD');

  if (mode === 'diagonal') {
    let diagScore = 0;
    if (m.diagRatio < 0.15) { diagScore += 25; reasons.push('DIAGONAL_IDENTITY_LOW'); }
    if (m.diagRatio > 0.55) { diagScore += 20; reasons.push('DIAGONAL_IDENTITY_OVERUSED'); }
    if (m.maxDiagRun > N) diagScore += 10;
    p.diagonalIdentityPenalty = clamp(diagScore, 0, 35);
  } else { p.diagonalIdentityPenalty = 0; }

  return { penalties: p, reasons };
}

function qualityScore(penalties) { return clamp(100 - Object.values(penalties).reduce((a, b) => a + b, 0), 0, 100); }
function difficultyScore(m, N) {
  return clamp((N === 5 ? 10 : N === 7 ? 30 : 50) + Math.round(m.hiddenRatio * 35) + clamp(m.maxHiddenStreak * 3, 0, 15) + clamp(m.turnRate * 25, 0, 25), 0, 100);
}

// ── target difficulty range ──
function targetDiffRange(diff) {
  return diff === 'easy' ? [0, 35] : diff === 'medium' ? [30, 70] : [60, 100];
}

// ── shared generation logic ──
const cfg = CONFIG[diff];
const N = cfg.N;
const rules = mode === 'diagonal'
  ? { movement: MOVEMENT_TYPES.diagonal, path: { allowCrossing: false, requireSequential: true, requireFullBoard: true } }
  : { movement: MOVEMENT_TYPES.orthogonal, path: { allowCrossing: false, requireSequential: true, requireFullBoard: true } };

function generateRound(roundNum, baseSeedOffset) {
  const perRound = count * multiplier;
  const batch = [];
  for (let i = 0; i < perRound; i++) {
    const virtualIdx = 100 + baseSeedOffset + i;
    const result = createClassicLevel(diff, virtualIdx, rules, mode);
    const grid = result?.grid;
    if (!grid) { batch.push({ seed: virtualIdx, N, status: 'GENERATION_FAILED' }); continue; }
    const vErrors = validateLevel(grid, N, cfg);
    if (vErrors.length > 0) { batch.push({ seed: virtualIdx, N, status: 'VALIDATION_FAILED', vErrors }); continue; }
    const path = getPath(grid);
    const metrics = computeMetrics(grid, path, N);
    const { penalties, reasons } = computePenalties(metrics, mode, N);
    const qs = Math.round(qualityScore(penalties));
    const ds = Math.round(difficultyScore(metrics, N));
    if (qs < 65 && !reasons.includes('QUALITY_BELOW_THRESHOLD')) reasons.push('QUALITY_BELOW_THRESHOLD');
    batch.push({ seed: virtualIdx, N, status: 'PASSED', vErrors: [], qs, ds, penalties, metrics, reasons, grid, path });
  }
  return batch;
}

function classifyBatch(candidates) {
  const [dLo, dHi] = targetDiffRange(diff);
  const SEVERE = ['SNAKE_PATTERN_HIGH','LONG_STRAIGHT_RUN','CHAOTIC_PATH','DIAGONAL_IDENTITY_LOW','DIAGONAL_IDENTITY_OVERUSED'];
  const autoReject = [], review = [], recommended = [];
  for (const c of candidates) {
    if (c.status !== 'PASSED') { c.tier = 'AUTO_REJECT'; autoReject.push(c); continue; }
    const severeReasons = c.reasons.filter(r => SEVERE.includes(r));
    const hasSevere = severeReasons.length > 0;
    const outOfRange = c.ds < dLo || c.ds > dHi;
    if (c.qs < 55 || (hasSevere && c.qs < 65) || (outOfRange && c.qs < 70)) {
      c.tier = 'AUTO_REJECT'; autoReject.push(c);
    } else if (c.qs < 70 || hasSevere || outOfRange) {
      c.tier = 'REVIEW_CANDIDATE'; review.push(c);
    } else {
      c.tier = 'AUTO_RECOMMENDED'; recommended.push(c);
    }
  }
  const midDiff = (dLo + dHi) / 2;
  recommended.sort((a, b) => (b.qs - a.qs) || (a.reasons.length - b.reasons.length) || (Math.abs(a.ds - midDiff) - Math.abs(b.ds - midDiff)));
  review.sort((a, b) => (b.qs - a.qs) || (a.reasons.length - b.reasons.length));
  return { autoReject, review, recommended };
}

// ── multi-round generation ──
console.log(`Generating candidates for ${mode} ${diff}, target=${count}, multiplier=${multiplier}, maxRounds=${maxRounds}...\n`);

let allCandidates = [];
let totalGenerated = 0, totalPassed = 0;
let actualRounds = 0;
let finalRecommended = [];

for (let r = 0; r < maxRounds; r++) {
  if (finalRecommended.length >= count) break;
  if (totalGenerated >= maxCandHard && totalGenerated > 0) break;
  const baseOffset = r * count * multiplier * 9973 + 1;
  const batch = generateRound(r, baseOffset);
  allCandidates.push(...batch);
  totalGenerated += batch.length;
  totalPassed += batch.filter(c => c.status === 'PASSED').length;
  const classified = classifyBatch(allCandidates);
  finalRecommended = classified.recommended;
  actualRounds = r + 1;
}

const fullClassified = classifyBatch(allCandidates);
const autoReject = fullClassified.autoReject;
const review = fullClassified.review;
const recommended = fullClassified.recommended;

// ── reports ──
mkdirSync('reports', { recursive: true });

const [dLo, dHi] = targetDiffRange(diff);

function serializedCandidate(c, idx) {
  const base = {
    mode, diff, candidateIndex: idx, virtualIdx: c.seed, seed: c.seed,
    N: c.N, status: c.status, tier: c.tier,
    qualityScore: c.qs, difficultyScore: c.ds,
    rejectReasons: c.reasons || [], penalties: c.penalties, metrics: c.metrics,
    grid: c.grid || null, path: c.path || null,
    // hidden info embedded in grid.isHidden; exported explicitly for convenience
    hiddenCount: c.grid ? c.grid.filter(g => g.isHidden).length : 0,
    hiddenIndices: c.grid ? c.grid.map((g, i) => g.isHidden ? i : null).filter(i => i !== null) : [],
    generatorVersion, generatedAt
  };
  if (c.vErrors) base.vErrors = c.vErrors;
  return base;
}

const serializedAll = allCandidates.map((c, i) => serializedCandidate(c, i));

const rejectBreakdown = {};
for (const c of autoReject) {
  for (const r of (c.reasons || [c.status || 'UNKNOWN'])) rejectBreakdown[r] = (rejectBreakdown[r] || 0) + 1;
  if (c.vErrors) for (const e of c.vErrors) rejectBreakdown[e] = (rejectBreakdown[e] || 0) + 1;
}

const report = {
  params: { mode, diff, count, multiplier, maxRounds, maxCandidates: maxCandHard === Infinity ? null : maxCandHard, N, dLo, dHi, doStage, generatedAt, generatorVersion },
  summary: {
    maxRounds, actualRounds, totalGenerated, totalValidatorPassed: totalPassed,
    autoReject: autoReject.length, reviewCandidate: review.length, autoRecommended: recommended.length,
    stagedTarget: doStage ? count : null, stagedActual: null, stagedMet: null
  },
  candidates: serializedAll,
  rejectBreakdown
};

// staging
let staged = [];
let stagedMet = false;
if (doStage) {
  staged = recommended.slice(0, count);
  stagedMet = staged.length >= count;
  report.summary.stagedActual = staged.length;
  report.summary.stagedMet = stagedMet;

  const stagedReport = {
    params: { mode, diff, count, stagedCount: staged.length, stagedMet, maxRounds, actualRounds, totalGenerated, generatedAt, generatorVersion },
    candidates: staged.map((c, i) => serializedCandidate(c, i))
  };
  writeFileSync('reports/staged-level-candidates.json', JSON.stringify(stagedReport, null, 2));
}

writeFileSync('reports/generated-level-candidates.json', JSON.stringify(report, null, 2));

// ── Markdown summaries ──
function writeStagedMD(stagedList) {
  const sl = [];
  sl.push(`# Staged 候选关卡\n`);
  sl.push(`> 机器推荐结果，不要求人工逐关筛选，只建议产品抽检方向是否跑偏。\n`);
  sl.push(`| 参数 | 值 |`);
  sl.push(`|------|----|`);
  sl.push(`| mode | ${mode} |`);
  sl.push(`| diff | ${diff} |`);
  sl.push(`| 目标 staged | ${count} |`);
  sl.push(`| 实际 staged | ${stagedList.length} |`);
  sl.push(`| 满足目标 | ${stagedMet ? '是' : '否'} |`);
  sl.push('');
  if (stagedList.length > 0) {
    sl.push('| # | seed | quality | difficulty | reasons | key metrics |');
    sl.push('|---|------|--------|-----------|---------|-------------|');
    stagedList.forEach((c, i) => {
      const m = c.metrics || {};
      sl.push(`| ${i + 1} | ${c.seed} | ${c.qs} | ${c.ds} | ${c.reasons?.join(', ') || '—'} | turnRate=${typeof m.turnRate === 'number' ? m.turnRate.toFixed(2) : m.turnRate}, maxRun=${m.maxStraightRun}, diag=${m.diagRatio} |`);
    });
    sl.push('');
    sl.push('## 产品抽检建议\n');
    sl.push(`- 从以上 ${stagedList.length} 个推荐中抽取 2–3 关人工试玩。`);
  }
  if (!stagedMet) {
    sl.push('## 未满足目标\n');
    sl.push(`目标 staged ${count}，实际仅 ${stagedList.length}。`);
    sl.push('建议：提高 --multiplier 或 --max-rounds，或后续校准 Scorer 阈值降低 CHAOTIC_PATH / LONG_STRAIGHT_RUN 误判。');
  }
  sl.push(`\n> staging 是机器推荐结果，不要求逐关筛选。`);
  sl.push('');
  writeFileSync('reports/staged-level-candidates-summary.md', sl.join('\n'));
}
if (doStage) writeStagedMD(staged);

function writeMainMD() {
  const lines = [];
  lines.push(`# 候选关卡生成报告\n`);
  lines.push(`> 机器自动筛选与分层，人工只做少量抽检，确认评分标准是否跑偏。\n`);
  lines.push(`| 参数 | 值 |`);
  lines.push(`|------|----|`);
  lines.push(`| mode | ${mode} |`);
  lines.push(`| diff | ${diff} |`);
  lines.push(`| N | ${N}×${N} |`);
  lines.push(`| 目标生成数 | ${count} |`);
  lines.push(`| multiplier | ${multiplier} |`);
  lines.push(`| maxRounds | ${maxRounds} |`);
  lines.push(`| actualRounds | ${actualRounds} |`);
  lines.push(`| totalGenerated | ${totalGenerated} |`);
  lines.push(`| totalValidatorPassed | ${totalPassed} |`);
  lines.push(`| 生成 staging | ${doStage ? '是' : '否'} |`);
  if (doStage) {
    lines.push(`| stagedTarget | ${count} |`);
    lines.push(`| stagedActual | ${staged.length} |`);
    lines.push(`| stagedMet | ${stagedMet ? '✅ 满足' : '❌ 未满足'} |`);
  }
  lines.push(`| AUTO_REJECT | ${autoReject.length} |`);
  lines.push(`| REVIEW_CANDIDATE | ${review.length} |`);
  lines.push(`| AUTO_RECOMMENDED | ${recommended.length} |`);
  lines.push('');

  lines.push('## 分层规则\n');
  lines.push('- **AUTO_REJECT**: Validator 不通过；或 qs < 55；或严重 reasons & qs < 65；或 ds 错位 & qs < 70');
  lines.push('- **REVIEW_CANDIDATE**: Validator 通过，(qs 55–69) 或 (qs ≥ 70 有轻微 reasons) 或 ds 偏离目标区间');
  lines.push('- **AUTO_RECOMMENDED**: Validator 通过，qs ≥ 70，reasons 空或极少，ds 在目标区间');
  lines.push('');

  if (staged.length > 0) {
    lines.push('## Staged 候选\n');
    lines.push('| # | seed | quality | difficulty | reasons |');
    lines.push('|---|------|--------|-----------|---------|');
    staged.forEach((c, i) => {
      lines.push(`| ${i + 1} | ${c.seed} | ${c.qs} | ${c.ds} | ${c.reasons?.join(', ') || '—'} |`);
    });
    lines.push('');
    if (!stagedMet) {
      lines.push(`⚠️ 目标 staged ${count}，实际 ${staged.length}，未满足目标。建议提高 --multiplier / --max-rounds，或后续校准 Scorer 阈值。`);
      lines.push('');
    }
  }

  if (!stagedMet && doStage) {
    const topReasons = Object.entries(rejectBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 5);
    lines.push('## 不足原因统计\n');
    lines.push('| 淘汰原因 | 数量 |');
    lines.push('|---------|------|');
    for (const [r, c] of topReasons) lines.push(`| ${r} | ${c} |`);
    lines.push('');
    lines.push('建议：提高 --multiplier 或 --max-rounds，或后续校准 Scorer 阈值降低误判。');
    lines.push('');
  }

  if (autoReject.length > 0 && recommended.length >= count) {
    lines.push('## 淘汰原因统计\n');
    lines.push('| 原因 | 数量 |');
    lines.push('|------|------|');
    for (const [reason, cnt] of Object.entries(rejectBreakdown).sort((a, b) => b[1] - a[1])) {
      lines.push(`| ${reason} | ${cnt} |`);
    }
    lines.push('');
  }

  lines.push('## 产品抽检建议\n');
  if (staged.length > 0) {
    lines.push(`- 从 staged ${staged.length} 个推荐中抽取 2–3 关人工试玩。`);
  } else if (recommended.length > 0) {
    lines.push(`- 从 AUTO_RECOMMENDED 中抽取 2–3 关人工试玩。`);
  }
  const sample = autoReject.filter(c => c.status === 'PASSED' && c.qs >= 45).slice(0, 1);
  if (sample.length > 0) {
    lines.push(`- 从 AUTO_REJECT 中抽取 1 关低分但合法试玩，校准 Scorer 阈值（seed ${sample[0].seed}, qs=${sample[0].qs}）。`);
  }
  lines.push(`- 不要逐关人工筛选——机器已完成自动分层，人工仅做校准抽检。`);
  lines.push('');

  const md = lines.join('\n');
  writeFileSync('reports/generated-level-candidates-summary.md', md);
  console.log(md);
}
writeMainMD();
console.log(`报告已输出到 reports/generated-level-candidates.json`);
if (staged.length) console.log(`Staging 已输出到 reports/staged-level-candidates.json`);
