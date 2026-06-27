/**
 * Classic / Diagonal 候选关卡生成流水线。
 * 用法：
 *   node scripts/generate-level-candidates.mjs --mode classic --diff hard --count 5
 *   node scripts/generate-level-candidates.mjs --mode diagonal --diff medium --count 5 --multiplier 5
 *   node scripts/generate-level-candidates.mjs --mode classic --diff hard --count 5 --stage true
 */

import { writeFileSync, mkdirSync } from 'fs';
import { createClassicLevel } from '../src/game/classic/createClassicLevel.js';
import { CLASSIC_STRUCTURE, MOVEMENT_TYPES, TARGET_STRUCTURE, getTargetSectionCount } from '../src/config/gameModes.js';
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

// ═══════════════════════════════════════════
// Similarity Score
// ═══════════════════════════════════════════

function normalizePathShape(path, N) {
  if (!path || path.length < 2) return { dirs: [], regions: new Set(), edgeRatio: 0, centerRatio: 0, runLengths: [], startZone: 0, endZone: 0, cornerTouches: 0, quadrantCoverage: new Set() };
  const dirs = [];
  const runLengths = [];
  let runLen = 1;
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1], curr = path[i];
    const dr = Math.floor(curr / N) - Math.floor(prev / N);
    const dc = (curr % N) - (prev % N);
    const dkey = `${dr},${dc}`;
    dirs.push(dkey);
    if (i > 1 && dirs[dirs.length - 1] === dirs[dirs.length - 2]) {
      runLen++;
    } else if (i > 1) {
      runLengths.push(runLen);
      runLen = 1;
    }
  }
  runLengths.push(runLen);

  const regions = new Set();
  const quadrantCoverage = new Set();
  const mid = (N - 1) / 2;
  const half = Math.floor(N / 2);
  let edge = 0, center = 0, corners = 0;
  for (const idx of path) {
    const r = Math.floor(idx / N), c = idx % N;
    regions.add(`${Math.floor(r / 2)},${Math.floor(c / 2)}`);
    quadrantCoverage.add(`${r < half ? 0 : 1},${c < half ? 0 : 1}`);
    if (r === 0 || r === N - 1 || c === 0 || c === N - 1) edge++;
    if (Math.abs(r - mid) <= 1 && Math.abs(c - mid) <= 1) center++;
    if ((r === 0 || r === N - 1) && (c === 0 || c === N - 1)) corners++;
  }
  const startIdx = path[0], endIdx = path[path.length - 1];
  const startR = Math.floor(startIdx / N), startC = startIdx % N;
  const endR = Math.floor(endIdx / N), endC = endIdx % N;
  const startZone = Math.floor(startR / (N / 3)) * 3 + Math.floor(startC / (N / 3));
  const endZone = Math.floor(endR / (N / 3)) * 3 + Math.floor(endC / (N / 3));

  return { dirs, regions, edgeRatio: edge / path.length, centerRatio: center / path.length, runLengths, startZone, endZone, cornerTouches: corners, quadrantCoverage };
}

function runLenSimilarity(runsA, runsB) {
  const histA = {}, histB = {};
  for (const r of runsA) histA[r] = (histA[r] || 0) + 1;
  for (const r of runsB) histB[r] = (histB[r] || 0) + 1;
  const allKeys = new Set([...Object.keys(histA), ...Object.keys(histB)]);
  let diff = 0;
  const totalA = runsA.length || 1, totalB = runsB.length || 1;
  for (const k of allKeys) diff += Math.abs((histA[k] || 0) / totalA - (histB[k] || 0) / totalB);
  return clamp(Math.round((1 - diff / 2) * 100), 0, 100);
}

function computeSimilarityScore(candidate, referenceLevels) {
  if (!referenceLevels || referenceLevels.length === 0) return { similarityScore: 0, maxSimilarity: 0, similarTo: null, similarityReasons: [] };
  if (!candidate.path || candidate.path.length < 2) return { similarityScore: 0, maxSimilarity: 0, similarTo: null, similarityReasons: ['no_path'] };

  const N = candidate.N;
  const shape = normalizePathShape(candidate.path, N);
  const metrics = candidate.metrics || {};
  // Hidden anchor distribution (spatial spread)
  const hiddenSet = new Set(candidate.hiddenIndices || []);
  let hiddenEdge = 0, hiddenCenter = 0, hiddenTotal = hiddenSet.size || 1;
  const hiddenQuadrants = new Set();
  const half = Math.floor(N / 2), mid = (N - 1) / 2;
  for (const idx of (candidate.hiddenIndices || [])) {
    const r = Math.floor(idx / N), c = idx % N;
    if (r === 0 || r === N - 1 || c === 0 || c === N - 1) hiddenEdge++;
    if (Math.abs(r - mid) <= 1 && Math.abs(c - mid) <= 1) hiddenCenter++;
    hiddenQuadrants.add(`${r < half ? 0 : 1},${c < half ? 0 : 1}`);
  }

  let maxSim = 0;
  let closest = null;
  const reasons = [];

  for (const ref of referenceLevels) {
    if (!ref.path || ref.path.length < 2) continue;
    if (ref.N !== N) continue;
    const refShape = normalizePathShape(ref.path, N);
    const refM = ref.metrics || {};

    // 1. Run length histogram similarity (weight: 0.25)
    const runSim = runLenSimilarity(shape.runLengths, refShape.runLengths);

    // 2. Turn pattern: compare turnRate and turnCount directly (weight: 0.20)
    const turnDiff = Math.abs((metrics.turnRate || 0) - (refM.turnRate || 0));
    const turnSim = clamp(Math.round((1 - turnDiff) * 100), 0, 100);

    // 3. Hidden anchor spatial similarity (weight: 0.18)
    const refHiddenSet = new Set(ref.hiddenIndices || []);
    let refHiddenEdge = 0, refHiddenCenter = 0, refHiddenTotal = refHiddenSet.size || 1;
    const refHiddenQuadrants = new Set();
    for (const idx of (ref.hiddenIndices || [])) {
      const r = Math.floor(idx / N), c = idx % N;
      if (r === 0 || r === N - 1 || c === 0 || c === N - 1) refHiddenEdge++;
      if (Math.abs(r - mid) <= 1 && Math.abs(c - mid) <= 1) refHiddenCenter++;
      refHiddenQuadrants.add(`${r < half ? 0 : 1},${c < half ? 0 : 1}`);
    }
    const hiddenEdgeDiff = Math.abs(hiddenEdge / hiddenTotal - refHiddenEdge / refHiddenTotal);
    const hiddenCenterDiff = Math.abs(hiddenCenter / hiddenTotal - refHiddenCenter / refHiddenTotal);
    const hiddenQuadOverlap = [...hiddenQuadrants].filter(q => refHiddenQuadrants.has(q)).length;
    const hiddenQuadTotal = Math.max(hiddenQuadrants.size, refHiddenQuadrants.size, 1);
    const hiddenSim = clamp(Math.round((1 - (hiddenEdgeDiff + hiddenCenterDiff) / 2) * 50 + (hiddenQuadOverlap / hiddenQuadTotal) * 50), 0, 100);

    // 4. Spatial coverage: edge/center + quadrant + start/end zone (weight: 0.17)
    const edgeDiff = Math.abs(shape.edgeRatio - refShape.edgeRatio);
    const centerDiff = Math.abs(shape.centerRatio - refShape.centerRatio);
    const quadOverlap = [...shape.quadrantCoverage].filter(q => refShape.quadrantCoverage.has(q)).length;
    const quadTotal = Math.max(shape.quadrantCoverage.size, refShape.quadrantCoverage.size, 1);
    const startEndDiff = shape.startZone === refShape.startZone && shape.endZone === refShape.endZone ? 0 : 1;
    const spatialSim = clamp(Math.round((1 - (edgeDiff + centerDiff) / 2) * 40 + (quadOverlap / quadTotal) * 40 + (1 - startEndDiff) * 20), 0, 100);

    // 5. Metric-based similarity (weight: 0.12)
    const metricKeys = ['directionBias', 'hiddenRatio', 'diagRatio'];
    let metricDiff = 0, keyCount = 0;
    for (const k of metricKeys) {
      const a = metrics[k], b = refM[k];
      if (a != null && b != null) { metricDiff += Math.abs(a - b); keyCount++; }
    }
    const metricSim = keyCount > 0 ? clamp(Math.round((1 - metricDiff / keyCount) * 100), 0, 100) : 50;

    // 6. Direction frequency (weight: 0.08, reduced from 0.15)
    const freqA = {}, freqB = {};
    for (const d of shape.dirs) freqA[d] = (freqA[d] || 0) + 1;
    for (const d of refShape.dirs) freqB[d] = (freqB[d] || 0) + 1;
    let dirDiff = 0;
    const allKeys = new Set([...Object.keys(freqA), ...Object.keys(freqB)]);
    for (const k of allKeys) dirDiff += Math.abs((freqA[k] || 0) / shape.dirs.length - (freqB[k] || 0) / refShape.dirs.length);
    const dirSim = clamp(Math.round((1 - dirDiff / 2) * 100), 0, 100);

    // Weighted overall
    const overall = Math.round(
      runSim * 0.25 + turnSim * 0.20 + hiddenSim * 0.18 + spatialSim * 0.17 + metricSim * 0.12 + dirSim * 0.08
    );

    if (overall > maxSim) { maxSim = overall; closest = { ...ref, source: ref._source || 'unknown' }; }
    if (overall > 60) reasons.push(`run_sim=${runSim}`);
    if (overall > 75) reasons.push(`high_overall=${overall}`);
  }

  return {
    similarityScore: maxSim,
    maxSimilarity: maxSim,
    similarTo: closest ? {
      mode: closest.mode || candidate.mode,
      diff: closest.diff || candidate.diff,
      seed: closest.seed, levelIndex: closest.levelIdx,
      candidateKey: closest._key || `${closest.mode || candidate.mode}:${closest.diff || candidate.diff}:${closest.seed}:${closest.virtualIdx || closest.seed}`,
      source: closest.source || closest._source || 'unknown', score: maxSim
    } : null,
    similarityReasons: [...new Set(reasons)]
  };
}

// ═══════════════════════════════════════════
// Archetype Tag
// ═══════════════════════════════════════════

function computeArchetype(candidate) {
  const m = candidate.metrics || {};
  const N = candidate.N;
  const path = candidate.path || [];
  const reasons = [];
  let bestTag = 'UNKNOWN';
  let bestConf = 0;

  function considerTag(tag, conf, reason) {
    if (conf > bestConf) { bestTag = tag; bestConf = conf; }
    if (reason) reasons.push(reason);
  }

  // Grid-size adaptive thresholds
  const edgeThresh = N <= 5 ? 0.48 : N <= 7 ? 0.45 : 0.55;
  const centerThresh = N <= 5 ? 0.32 : N <= 7 ? 0.30 : 0.35;
  const maxRunThresh = N <= 5 ? Math.ceil(N * 0.7) : N <= 7 ? N : N;
  const zigzagTurnThresh = 0.50;
  const zigzagRunMax = N <= 7 ? 2 : 3;
  const diagThresh = N <= 7 ? 0.15 : 0.22;
  const turnDenseThresh = N <= 7 ? 0.55 : 0.60;

  // Compute spatial features
  let edge = 0, center = 0, corners = 0, total = path.length || 1;
  const mid = (N - 1) / 2;
  const halfN = Math.floor(N / 2);
  const quadrantVisit = new Set();
  const rowVisit = new Set(), colVisit = new Set();
  for (const idx of path) {
    const r = Math.floor(idx / N), c = idx % N;
    if (r === 0 || r === N - 1 || c === 0 || c === N - 1) edge++;
    if (Math.abs(r - mid) <= 1 && Math.abs(c - mid) <= 1) center++;
    if ((r === 0 || r === N - 1) && (c === 0 || c === N - 1)) corners++;
    quadrantVisit.add(`${r < halfN ? 0 : 1},${c < halfN ? 0 : 1}`);
    rowVisit.add(r); colVisit.add(c);
  }
  const edgeRatio = edge / total;
  const centerRatio = center / total;

  // Compute row/col sweep pattern (not just "visited all")
  let rowSweeps = 0, colSweeps = 0;
  for (let r = 0; r < N; r++) {
    let maxConsecutive = 0, cur = 0, lastCol = -2;
    for (const idx of path) { const pr = Math.floor(idx / N), pc = idx % N; if (pr === r) { if (pc === lastCol + 1 || pc === lastCol - 1) cur++; else { if (cur > maxConsecutive) maxConsecutive = cur; cur = 1; } lastCol = pc; } }
    if (cur > maxConsecutive) maxConsecutive = cur;
    if (maxConsecutive >= Math.ceil(N * 0.5)) rowSweeps++;
  }
  for (let c = 0; c < N; c++) {
    let maxConsecutive = 0, cur = 0, lastRow = -2;
    for (const idx of path) { const pr = Math.floor(idx / N), pc = idx % N; if (pc === c) { if (pr === lastRow + 1 || pr === lastRow - 1) cur++; else { if (cur > maxConsecutive) maxConsecutive = cur; cur = 1; } lastRow = pr; } }
    if (cur > maxConsecutive) maxConsecutive = cur;
    if (maxConsecutive >= Math.ceil(N * 0.5)) colSweeps++;
  }
  const isRowSweep = rowSweeps >= Math.ceil(N * 0.6);
  const isColSweep = colSweeps >= Math.ceil(N * 0.6);

  // Compute max horizontal/vertical dominance
  const horizontalRunRatio = m.directionBias != null ? (m.dominantDirRatio || 0) : 0;

  // Fallback: BALANCED_WEAVE (low base confidence, easily overridden)
  if (candidate.qualityScore >= 60) considerTag('BALANCED_WEAVE', 30, 'base_balanced');

  // EDGE_SWEEP — high edge coverage
  if (edgeRatio > edgeThresh)
    considerTag('EDGE_SWEEP', Math.round(edgeRatio * 100), `edge=${edgeRatio.toFixed(2)}`);

  // CENTER_SWEEP — high center coverage
  if (centerRatio > centerThresh)
    considerTag('CENTER_SWEEP', Math.round(centerRatio * 100), `center=${centerRatio.toFixed(2)}`);

  // CORNER_SWEEP — touches all 4 corners
  if (corners >= 4)
    considerTag('CORNER_SWEEP', 65, 'corners=4');

  // LONG_RUN_MIXED — long straight runs
  if (m.maxStraightRun >= maxRunThresh)
    considerTag('LONG_RUN_MIXED', Math.round(clamp(m.maxStraightRun / N * 50 + 10, 0, 100)), `maxRun=${m.maxStraightRun}`);

  // COMPACT_ROUTE — high turn rate + short runs
  if (m.turnRate > zigzagTurnThresh && m.maxStraightRun <= zigzagRunMax)
    considerTag('COMPACT_ROUTE', Math.round(m.turnRate * 100), `turn=${m.turnRate?.toFixed(2)}`);

  // TURN_DENSE — very high turn rate
  if (m.turnRate > turnDenseThresh)
    considerTag('TURN_DENSE', Math.round(m.turnRate * 95), `dense=${m.turnRate?.toFixed(2)}`);

  // ROW_COL_SWEEP — requires actual sweep pattern (not just visiting all rows/cols)
  if (isRowSweep || isColSweep)
    considerTag('ROW_COL_SWEEP', Math.round((isRowSweep ? 35 : 0) + (isColSweep ? 35 : 0) + 10), `rowS=${rowSweeps} colS=${colSweeps}`);

  // Diagonal-specific tags
  if (candidate.mode === 'diagonal') {
    const dr = m.diagRatio || 0;
    // DIAGONAL_WEAVE — strong diagonal identity
    if (dr > diagThresh * 1.3)
      considerTag('DIAGONAL_WEAVE', Math.round(clamp(dr * 100, 0, 100)), `diag=${dr.toFixed(2)}`);
    // DIAGONAL_CROSS — diagonal + quadrant crossing + moderate turns
    const diagQuadCross = quadrantVisit.size >= 3 && dr > diagThresh;
    if (diagQuadCross && m.turnRate > 0.30)
      considerTag('DIAGONAL_CROSS', Math.round(clamp(dr * 70 + quadrantVisit.size * 8, 0, 100)), `cross_d=${dr.toFixed(2)} q=${quadrantVisit.size}`);
  }

  // ANCHOR_SPARSE — notably large anchor gaps
  if (m.hiddenRatio > 0.4 && m.maxAnchorGap >= N * 1.5)
    considerTag('ANCHOR_SPARSE', Math.round(clamp(m.maxAnchorGap / (N * N) * 120, 0, 100)), `gap=${m.maxAnchorGap}`);

  // ANCHOR_DENSE — very tight anchors (only beats BALANCED_WEAVE base of 30)
  if (m.hiddenRatio > 0.5 && m.maxAnchorGap <= Math.ceil(N * 0.5))
    considerTag('ANCHOR_DENSE', Math.round(clamp((1 - m.maxAnchorGap / (N * N)) * 80, 0, 100)), 'dense');

  return {
    archetypeTag: bestTag,
    archetypeConfidence: clamp(bestConf, 0, 100),
    archetypeReasons: reasons
  };
}

// ═══════════════════════════════════════════
// Diverse Staged Selection
// ═══════════════════════════════════════════

function selectDiverseStaged(recommended, count, allCandidates) {
  if (recommended.length <= count) return recommended;

  // Score each candidate for staged selection
  const scored = recommended.map(c => {
    let score = c.qualityScore * 0.35 + (100 - c.maxSimilarity) * 0.25 + c.difficultyTargetMatch * 0.15;
    // Penalize same archetype domination
    const archetypeCount = recommended.filter(r => r.archetypeTag === c.archetypeTag).length;
    const archetypePenalty = archetypeCount > recommended.length * 0.5 ? 10 : 0;
    score -= archetypePenalty;
    // Diagonal: reward diagonal identity
    if (c.mode === 'diagonal' && (c.metrics?.diagRatio || 0) > 0.2) score += 5;
    return { ...c, _selectScore: score };
  });

  scored.sort((a, b) => b._selectScore - a._selectScore);

  // Greedy diversity selection
  const selected = [scored[0]];
  const usedArchetypes = new Set([scored[0].archetypeTag]);

  for (let i = 1; i < scored.length && selected.length < count; i++) {
    const c = scored[i];
    // Boost diversity: prefer new archetypes
    if (!usedArchetypes.has(c.archetypeTag)) {
      c._selectScore += 5;
    }
    // Check similarity against already selected
    const maxSimToSelected = Math.max(...selected.map(s => {
      if (s.seed === c.seed) return 0;
      // Quick metric similarity check
      const m1 = s.metrics || {}, m2 = c.metrics || {};
      let diff = 0, n = 0;
      for (const k of ['turnRate', 'directionBias', 'hiddenRatio', 'diagRatio']) {
        if (m1[k] != null && m2[k] != null) { diff += Math.abs(m1[k] - m2[k]); n++; }
      }
      return n > 0 ? clamp(Math.round((1 - diff / n) * 100), 0, 100) : 0;
    }));
    if (maxSimToSelected > 85) continue; // too similar to already-selected

    selected.push(c);
    usedArchetypes.add(c.archetypeTag);
  }

  // Fill remaining with highest scored
  for (let i = 1; i < scored.length && selected.length < count; i++) {
    if (!selected.find(s => s.seed === scored[i].seed)) {
      selected.push(scored[i]);
      usedArchetypes.add(scored[i].archetypeTag);
    }
  }

  return selected.slice(0, count);
}

// ── shared generation logic ──
const cfg = CONFIG[diff];
const N = cfg.N;
const rules = mode === 'diagonal'
  ? { movement: MOVEMENT_TYPES.diagonal, path: { allowCrossing: false, requireSequential: true, requireFullBoard: true } }
  : { movement: MOVEMENT_TYPES.orthogonal, path: { allowCrossing: false, requireSequential: true, requireFullBoard: true } };

// ── Load reference levels for similarity comparison ──
function loadReferenceLevels() {
  const refs = [];
  const seen = new Set();
  // Load formal classic/diagonal levels for the target mode
  const targetModes = [mode];
  // Also load the other normal mode for cross-mode comparison
  if (mode === 'classic') targetModes.push('diagonal');
  else if (mode === 'diagonal') targetModes.push('classic');

  for (const m of targetModes) {
    const rulesRef = m === 'diagonal'
      ? { movement: MOVEMENT_TYPES.diagonal, path: { allowCrossing: false, requireSequential: true, requireFullBoard: true } }
      : { movement: MOVEMENT_TYPES.orthogonal, path: { allowCrossing: false, requireSequential: true, requireFullBoard: true } };
    for (const section of CLASSIC_STRUCTURE) {
      const d = section.diff;
      const gridN = section.grid;
      // Only compare same-size boards for meaningful similarity
      if (gridN !== N) continue;
      for (let lvl = 0; lvl < section.count; lvl++) {
        try {
          const result = createClassicLevel(d, lvl, rulesRef, m);
          if (!result?.grid) continue;
          const p = getPath(result.grid);
          if (!p || p.length < 2) continue;
          const met = computeMetrics(result.grid, p, gridN);
          const key = `${m}:${d}:${lvl}`;
          if (seen.has(key)) continue;
          seen.add(key);
          refs.push({
            _key: key, _source: 'production',
            mode: m, diff: d, levelIdx: lvl, N: gridN,
            path: p, metrics: met, seed: `formal-${lvl}`
          });
        } catch { /* skip failed ref level */ }
      }
    }
  }
  return refs;
}

const referenceLevels = loadReferenceLevels();

function generateRound(roundNum, baseSeedOffset, stagedSoFar) {
  const perRound = count * multiplier;
  const batch = [];
  const allRefs = [...referenceLevels, ...(stagedSoFar || [])];
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

    const candidate = { mode, diff, seed: virtualIdx, N, status: 'PASSED', vErrors: [], qs, ds, penalties, metrics, reasons, grid, path, virtualIdx };

    // Compute similarity against all reference levels + staged-so-far
    const sim = computeSimilarityScore(candidate, allRefs);
    Object.assign(candidate, sim);

    // Compute archetype tag
    const arch = computeArchetype(candidate);
    Object.assign(candidate, arch);

    // Difficulty target match score
    const [dLo, dHi] = targetDiffRange(diff);
    const midDiff = (dLo + dHi) / 2;
    candidate.difficultyTargetMatch = Math.round(100 - clamp(Math.abs(ds - midDiff) / (dHi - dLo) * 100, 0, 100));

    batch.push(candidate);
  }
  return batch;
}

function classifyBatch(candidates) {
  const [dLo, dHi] = targetDiffRange(diff);
  const SEVERE = ['SNAKE_PATTERN_HIGH','LONG_STRAIGHT_RUN','CHAOTIC_PATH','DIAGONAL_IDENTITY_LOW','DIAGONAL_IDENTITY_OVERUSED'];
  const autoReject = [], review = [], recommended = [];
  for (const c of candidates) {
    if (c.status !== 'PASSED') { c.tier = 'AUTO_REJECT'; autoReject.push(c); continue; }
    const severeReasons = (c.reasons || []).filter(r => SEVERE.includes(r));
    const hasSevere = severeReasons.length > 0;
    const outOfRange = c.ds < dLo || c.ds > dHi;

    // Similarity thresholds:
    //   sim >= 98: cannot be AUTO_RECOMMENDED (too similar to production/staged)
    //   sim >= 95: default to REVIEW_CANDIDATE, flagged in summary
    const highSim = c.maxSimilarity >= 98;
    const warnSim = c.maxSimilarity >= 95;

    if (c.qs < 55 || (hasSevere && c.qs < 65) || (outOfRange && c.qs < 70) || (highSim && c.qs < 75)) {
      c.tier = 'AUTO_REJECT'; autoReject.push(c);
    } else if (c.qs < 70 || hasSevere || outOfRange || highSim) {
      c.tier = 'REVIEW_CANDIDATE'; review.push(c);
      if (highSim) c.reasons.push('HIGH_SIMILARITY');
      else if (warnSim) c.reasons.push('SIMILARITY_WARNING');
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
let stagedCandidates = [];
let totalGenerated = 0, totalPassed = 0;
let actualRounds = 0;
let finalRecommended = [];

for (let r = 0; r < maxRounds; r++) {
  if (finalRecommended.length >= count) break;
  if (totalGenerated >= maxCandHard && totalGenerated > 0) break;
  const baseOffset = r * count * multiplier * 9973 + 1;
  const batch = generateRound(r, baseOffset, stagedCandidates);
  allCandidates.push(...batch);
  totalGenerated += batch.length;
  totalPassed += batch.filter(c => c.status === 'PASSED').length;
  const classified = classifyBatch(allCandidates);
  // Use diverse selection for preliminary recommended
  finalRecommended = selectDiverseStaged(classified.recommended, count, allCandidates);
  // Track staged for similarity comparison in next round
  stagedCandidates = finalRecommended.map(c => ({
    _key: `${c.mode}:${c.diff}:${c.seed}:${c.virtualIdx || c.seed}`,
    _source: 'staged', mode: c.mode, diff: c.diff, N: c.N,
    path: c.path, metrics: c.metrics, seed: c.seed
  }));
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
    hiddenCount: c.grid ? c.grid.filter(g => g.isHidden).length : 0,
    hiddenIndices: c.grid ? c.grid.map((g, i) => g.isHidden ? i : null).filter(i => i !== null) : [],
    similarityScore: c.similarityScore ?? c.maxSimilarity ?? 0,
    maxSimilarity: c.maxSimilarity ?? 0,
    similarTo: c.similarTo || null,
    similarityReasons: c.similarityReasons || [],
    archetypeTag: c.archetypeTag || 'UNKNOWN',
    archetypeConfidence: c.archetypeConfidence ?? 0,
    archetypeReasons: c.archetypeReasons || [],
    difficultyTargetMatch: c.difficultyTargetMatch ?? 50,
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
  staged = selectDiverseStaged(recommended, count, allCandidates);
  stagedMet = staged.length >= count;
  report.summary.stagedActual = staged.length;
  report.summary.stagedMet = stagedMet;

  // Batch evaluation
  const stagedScores = staged.map(c => c.qs).filter(s => s != null);
  const stagedDScores = staged.map(c => c.ds).filter(s => s != null);
  const stagedSimScores = staged.map(c => c.maxSimilarity).filter(s => s != null);
  const archetypeDist = {};
  for (const c of staged) { const t = c.archetypeTag || 'UNKNOWN'; archetypeDist[t] = (archetypeDist[t] || 0) + 1; }
  const allArchetypeDist = {};
  for (const c of recommended) { const t = c.archetypeTag || 'UNKNOWN'; allArchetypeDist[t] = (allArchetypeDist[t] || 0) + 1; }

  const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
  const maxSimStaged = Math.max(...stagedSimScores, 0);
  const highSimWarnings = [];
  for (const c of staged) {
    if (c.maxSimilarity > 70 && c.similarTo) {
      highSimWarnings.push({ seed: c.seed, score: c.maxSimilarity, similarTo: c.similarTo });
    }
  }
  // Archetype domination warning
  const archetypeUniqueCount = Object.keys(archetypeDist).length;
  const maxArchetypeCount = Math.max(...Object.values(archetypeDist), 0);
  const maxArchetypeShare = staged.length > 0 ? maxArchetypeCount / staged.length : 0;
  const archetypeWarning = maxArchetypeShare > 0.6
    ? `⚠️ 单一 archetype 占比过高 (${maxArchetypeCount}/${staged.length} = ${(maxArchetypeShare*100).toFixed(0)}%)` : null;
  const archetypeDiversityVerdict = maxArchetypeShare >= 1.0 ? 'FAIL'
    : maxArchetypeShare > 0.6 ? 'REVIEW'
    : archetypeUniqueCount >= Math.min(3, staged.length) ? 'PASS' : 'REVIEW';

  // Batch verdict
  const hasVeryHighSim = staged.some(c => c.maxSimilarity >= 98);
  const hasHighSim = staged.some(c => c.maxSimilarity >= 95);
  let batchVerdict = 'PASS';
  if (staged.length < count || avg(stagedScores) < 65) batchVerdict = 'FAIL';
  else if (hasVeryHighSim || archetypeDiversityVerdict === 'FAIL') batchVerdict = 'FAIL';
  else if (hasHighSim || highSimWarnings.length > 0 || archetypeWarning || archetypeDiversityVerdict === 'REVIEW' || avg(stagedScores) < 75) batchVerdict = 'REVIEW';

  const batchEvaluation = {
    verdict: batchVerdict,
    stagedCount: staged.length,
    targetCount: count,
    avgQualityScore: avg(stagedScores),
    avgDifficultyScore: avg(stagedDScores),
    avgSimilarityScore: avg(stagedSimScores),
    maxSimilarity: maxSimStaged,
    archetypeDistribution: archetypeDist,
    archetypeUniqueCount,
    maxArchetypeShare,
    archetypeDiversityVerdict,
    allRecommendedArchetypeDistribution: allArchetypeDist,
    highSimilarityWarnings: highSimWarnings,
    archetypeWarning,
    stagedReasons: staged.map(c => ({
      seed: c.seed,
      qualityScore: c.qs,
      difficultyScore: c.ds,
      similarityScore: c.maxSimilarity,
      archetypeTag: c.archetypeTag,
      reason: c.tier === 'AUTO_RECOMMENDED' ? 'quality + diversity' : c.tier
    }))
  };

  const stagedReport = {
    params: { mode, diff, count, stagedCount: staged.length, stagedMet, maxRounds, actualRounds, totalGenerated, generatedAt, generatorVersion },
    candidates: staged.map((c, i) => serializedCandidate(c, i)),
    batchEvaluation
  };
  writeFileSync('reports/staged-level-candidates.json', JSON.stringify(stagedReport, null, 2));
  report.batchEvaluation = batchEvaluation;
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
    sl.push('| # | seed | quality | difficulty | similarity | archetype | reasons | key metrics |');
    sl.push('|---|------|--------|-----------|------------|-----------|---------|-------------|');
    stagedList.forEach((c, i) => {
      const m = c.metrics || {};
      sl.push(`| ${i + 1} | ${c.seed} | ${c.qs} | ${c.ds} | ${c.maxSimilarity ?? '-'} | ${c.archetypeTag || 'UNKNOWN'} | ${c.reasons?.join(', ') || '—'} | turnRate=${typeof m.turnRate === 'number' ? m.turnRate.toFixed(2) : m.turnRate}, maxRun=${m.maxStraightRun}, diag=${m.diagRatio} |`);
    });
    sl.push('');

    // Batch evaluation section
    const be = report.batchEvaluation;
    if (be) {
      sl.push('## 批次评估\n');
      sl.push(`| 指标 | 值 |`);
      sl.push(`|------|----|`);
      sl.push(`| 批次结论 | **${be.verdict}** |`);
      sl.push(`| 平均 qualityScore | ${be.avgQualityScore} |`);
      sl.push(`| 平均 difficultyScore | ${be.avgDifficultyScore} |`);
      sl.push(`| 平均 similarityScore | ${be.avgSimilarityScore} |`);
      sl.push(`| 最大 similarity | ${be.maxSimilarity} |`);
      sl.push('');

      sl.push('### Archetype 分布\n');
      sl.push('| archetype | 数量 |');
      sl.push('|-----------|------|');
      for (const [tag, cnt] of Object.entries(be.archetypeDistribution || {})) {
        sl.push(`| ${tag} | ${cnt} |`);
      }
      sl.push('');

      if (be.archetypeWarning) sl.push(`${be.archetypeWarning}\n`);
      if (be.highSimilarityWarnings?.length > 0) {
        sl.push('### 相似度预警\n');
        for (const w of be.highSimilarityWarnings) {
          sl.push(`- seed ${w.seed}: maxSim=${w.score}, similarTo=${w.similarTo?.candidateKey || w.similarTo?.seed || 'unknown'}`);
        }
        sl.push('');
      }
    }

    sl.push('## 产品抽检建议\n');
    sl.push(`- 从以上 ${stagedList.length} 个推荐中抽取 2–3 关人工试玩。`);
    if (be?.archetypeWarning) sl.push('- 注意 archetype 分布不均，可能需要调整多样性权重。');
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
