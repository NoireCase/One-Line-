/**
 * Star Double 质量分析模块 (Package D0)。
 *
 * 为双星候选提供开局分类、难度评估、相似度检测和批次多样性报告。
 * 所有分析针对 quota=2 重新定义，不照搬单星分类体系。
 *
 * 用法：
 *   import { analyzeDoubleStarCandidate, analyzeDoubleStarBatch } from './star-double-quality.mjs';
 */

import { solveStarLine } from './starLineSolver.mjs';
import {
  makeCanonicalSolutionSig,
  makeSolutionSig,
  makeRegionSig,
  makeCanonicalRegionSig,
} from './star-line-candidate-signatures.mjs';
import { classifyStructuralFamily } from './star-double-generator.mjs';
import {
  analyzeStarDoubleHumanLogic,
  replayHumanLogicTrace,
} from './star-double-human-logic.mjs';
import {
  analyzeReasoningDuplicates,
  analyzeStarDoubleSequence,
  makeReasoningFingerprint,
} from './star-double-reasoning-fingerprint.mjs';

export const QUALITY_VERSION = '1.1.0-d0.5';

// ═══ 开局分类 (quota=2) ═══

/**
 * 双星开局传播事件类型。
 * quota=2 下的传播推理单元与 quota=1 有本质不同：
 * - 不存在"区域只剩一格"（region singleton），因为每区域需要 2 星
 * - 核心推理单元变为：
 *   ROW_CAPACITY: 行剩余容量恰好等于剩余可放格数 → 全放
 *   COL_CAPACITY: 列剩余容量恰好等于剩余可放格数 → 全放
 *   REGION_CAPACITY: 区域剩余容量恰好等于剩余可放格数 → 全放
 *   ROW_REGION_LOCK: 行剩余可放格全在同一区域 → 锁定该区域同列格
 *   COL_REGION_LOCK: 列剩余可放格全在同一区域 → 锁定该区域同行格
 *   REGION_ROW_LOCK: 区域剩余可放格全在同一行 → 锁定该行同区域格
 *   REGION_COL_LOCK: 区域剩余可放格全在同一列 → 锁定该列同区域格
 *   PAIR_DEDUCTION: 双位置组合锁定
 */

/**
 * 双星开局事件类型
 */
export const DOUBLE_OPENING_EVENT = Object.freeze({
  ROW_CAPACITY: 'ROW_CAPACITY',
  COL_CAPACITY: 'COL_CAPACITY',
  REGION_CAPACITY: 'REGION_CAPACITY',
  ROW_REGION_LOCK: 'ROW_REGION_LOCK',
  COL_REGION_LOCK: 'COL_REGION_LOCK',
  REGION_ROW_LOCK: 'REGION_ROW_LOCK',
  REGION_COL_LOCK: 'REGION_COL_LOCK',
  NO_BASIC_OPENING: 'NO_BASIC_OPENING',
});

/**
 * 双星开局家族
 */
export const DOUBLE_OPENING_FAMILY = Object.freeze({
  DIRECT_CAPACITY: 'DIRECT_CAPACITY',
  SINGLE_LOCK_CHAIN: 'SINGLE_LOCK_CHAIN',
  MULTI_LOCK_CHAIN: 'MULTI_LOCK_CHAIN',
  MIXED_LOCK_CHAIN: 'MIXED_LOCK_CHAIN',
  NO_BASIC_OPENING: 'NO_BASIC_OPENING',
});

/**
 * 对 quota=2 棋盘执行单轮约束传播分析，返回开局事件。
 * 不执行回溯猜测——只分析纯粹的逻辑推演。
 *
 * @returns {object} { events, layers, forcedStars, openingFamily, propagationDepth }
 */
export function analyzeDoubleStarOpening(N, regions) {
  const total = N * N;
  const quota = 2;

  // Build topology
  const rowCells = Array.from({ length: N }, (_, r) =>
    Array.from({ length: N }, (_, c) => r * N + c));
  const colCells = Array.from({ length: N }, (_, c) =>
    Array.from({ length: N }, (_, r) => r * N + c));
  const regionCells = new Map();
  for (let i = 0; i < total; i++) {
    const rid = regions[i];
    if (!regionCells.has(rid)) regionCells.set(rid, []);
    regionCells.get(rid).push(i);
  }

  function neighbors8(idx) {
    const r = Math.floor(idx / N), c = idx % N;
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < N && nc >= 0 && nc < N) out.push(nr * N + nc);
      }
    }
    return out;
  }

  // State
  const starred = new Array(total).fill(false);
  const forbidden = new Array(total).fill(false);
  const rowCounts = new Array(N).fill(0);
  const colCounts = new Array(N).fill(0);
  const regionCounts = new Map();
  for (const rid of regionCells.keys()) regionCounts.set(rid, 0);

  function canPlace(idx) {
    if (starred[idx] || forbidden[idx]) return false;
    const r = Math.floor(idx / N), c = idx % N;
    if (rowCounts[r] >= quota || colCounts[c] >= quota) return false;
    if ((regionCounts.get(regions[idx]) || 0) >= quota) return false;
    for (const nb of neighbors8(idx)) if (starred[nb]) return false;
    return true;
  }

  function placeStar(idx) {
    starred[idx] = true;
    const r = Math.floor(idx / N), c = idx % N;
    const rid = regions[idx];
    rowCounts[r]++;
    colCounts[c]++;
    regionCounts.set(rid, (regionCounts.get(rid) || 0) + 1);
    if (rowCounts[r] >= quota) for (const i of rowCells[r]) if (!starred[i]) forbidden[i] = true;
    if (colCounts[c] >= quota) for (const i of colCells[c]) if (!starred[i]) forbidden[i] = true;
    if ((regionCounts.get(rid) || 0) >= quota) for (const i of regionCells.get(rid)) if (!starred[i]) forbidden[i] = true;
    for (const nb of neighbors8(idx)) if (!starred[nb]) forbidden[nb] = true;
  }

  const events = [];
  const forcedStars = [];
  const MAX_LAYERS = 10;

  for (let layer = 0; layer < MAX_LAYERS; layer++) {
    let anyChange = false;

    // Check rows
    for (let r = 0; r < N; r++) {
      const placed = rowCounts[r];
      const needed = quota - placed;
      if (needed <= 0) continue;
      const available = rowCells[r].filter(canPlace);
      if (available.length < needed) continue; // contradiction, not analyzed here
      if (available.length === needed) {
        for (const idx of available) {
          placeStar(idx);
          forcedStars.push(idx);
          events.push({ layer, type: DOUBLE_OPENING_EVENT.ROW_CAPACITY, cell: idx, detail: `row ${r}` });
        }
        anyChange = true;
      }
    }

    // Check cols
    for (let c = 0; c < N; c++) {
      const placed = colCounts[c];
      const needed = quota - placed;
      if (needed <= 0) continue;
      const available = colCells[c].filter(canPlace);
      if (available.length < needed) continue;
      if (available.length === needed) {
        for (const idx of available) {
          if (starred[idx]) continue; // may have been placed by row check
          placeStar(idx);
          forcedStars.push(idx);
          events.push({ layer, type: DOUBLE_OPENING_EVENT.COL_CAPACITY, cell: idx, detail: `col ${c}` });
        }
        anyChange = true;
      }
    }

    // Check regions
    for (const [rid, cells] of regionCells) {
      const placed = regionCounts.get(rid) || 0;
      const needed = quota - placed;
      if (needed <= 0) continue;
      const available = cells.filter(canPlace);
      if (available.length < needed) continue;
      if (available.length === needed) {
        for (const idx of available) {
          if (starred[idx]) continue;
          placeStar(idx);
          forcedStars.push(idx);
          events.push({ layer, type: DOUBLE_OPENING_EVENT.REGION_CAPACITY, cell: idx, detail: `region ${rid}` });
        }
        anyChange = true;
      }
    }

    // Check row-region locks
    for (let r = 0; r < N; r++) {
      const placed = rowCounts[r];
      const needed = quota - placed;
      if (needed <= 0) continue;
      const available = rowCells[r].filter(canPlace);
      if (available.length <= needed) continue; // not a lock scenario
      const availableRids = new Set(available.map(idx => regions[idx]));
      if (availableRids.size === 1) {
        const rid = [...availableRids][0];
        events.push({
          layer, type: DOUBLE_OPENING_EVENT.ROW_REGION_LOCK,
          detail: `row ${r} → region ${rid}`,
          lockedCells: available,
        });
      }
    }

    // Check col-region locks
    for (let c = 0; c < N; c++) {
      const placed = colCounts[c];
      const needed = quota - placed;
      if (needed <= 0) continue;
      const available = colCells[c].filter(canPlace);
      if (available.length <= needed) continue;
      const availableRids = new Set(available.map(idx => regions[idx]));
      if (availableRids.size === 1) {
        const rid = [...availableRids][0];
        events.push({
          layer, type: DOUBLE_OPENING_EVENT.COL_REGION_LOCK,
          detail: `col ${c} → region ${rid}`,
          lockedCells: available,
        });
      }
    }

    // Check region-row locks
    for (const [rid, cells] of regionCells) {
      const placed = regionCounts.get(rid) || 0;
      const needed = quota - placed;
      if (needed <= 0) continue;
      const available = cells.filter(canPlace);
      if (available.length <= needed) continue;
      const availableRows = new Set(available.map(idx => Math.floor(idx / N)));
      if (availableRows.size === 1) {
        const r = [...availableRows][0];
        events.push({
          layer, type: DOUBLE_OPENING_EVENT.REGION_ROW_LOCK,
          detail: `region ${rid} → row ${r}`,
          lockedCells: available,
        });
      }
    }

    // Check region-col locks
    for (const [rid, cells] of regionCells) {
      const placed = regionCounts.get(rid) || 0;
      const needed = quota - placed;
      if (needed <= 0) continue;
      const available = cells.filter(canPlace);
      if (available.length <= needed) continue;
      const availableCols = new Set(available.map(idx => idx % N));
      if (availableCols.size === 1) {
        const c = [...availableCols][0];
        events.push({
          layer, type: DOUBLE_OPENING_EVENT.REGION_COL_LOCK,
          detail: `region ${rid} → col ${c}`,
          lockedCells: available,
        });
      }
    }

    if (!anyChange && events.filter(e => e.layer === layer).length === 0) break;
    if (events.filter(e => e.layer === layer && (
      e.type === DOUBLE_OPENING_EVENT.ROW_CAPACITY ||
      e.type === DOUBLE_OPENING_EVENT.COL_CAPACITY ||
      e.type === DOUBLE_OPENING_EVENT.REGION_CAPACITY
    )).length === 0 && !anyChange) break;
  }

  // Classify opening
  let openingFamily;
  const capacityEvents = events.filter(e =>
    e.type === DOUBLE_OPENING_EVENT.ROW_CAPACITY ||
    e.type === DOUBLE_OPENING_EVENT.COL_CAPACITY ||
    e.type === DOUBLE_OPENING_EVENT.REGION_CAPACITY);
  const lockEvents = events.filter(e =>
    e.type === DOUBLE_OPENING_EVENT.ROW_REGION_LOCK ||
    e.type === DOUBLE_OPENING_EVENT.COL_REGION_LOCK ||
    e.type === DOUBLE_OPENING_EVENT.REGION_ROW_LOCK ||
    e.type === DOUBLE_OPENING_EVENT.REGION_COL_LOCK);

  if (forcedStars.length === 0) {
    openingFamily = DOUBLE_OPENING_FAMILY.NO_BASIC_OPENING;
  } else if (lockEvents.length === 0) {
    openingFamily = DOUBLE_OPENING_FAMILY.DIRECT_CAPACITY;
  } else {
    const lockTypes = new Set(lockEvents.map(e => e.type));
    if (lockTypes.size === 1) {
      openingFamily = lockEvents.length <= 2
        ? DOUBLE_OPENING_FAMILY.SINGLE_LOCK_CHAIN
        : DOUBLE_OPENING_FAMILY.MULTI_LOCK_CHAIN;
    } else {
      openingFamily = DOUBLE_OPENING_FAMILY.MIXED_LOCK_CHAIN;
    }
  }

  const layers = [...new Set(events.map(e => e.layer))];

  return {
    events,
    layers: layers.length,
    forcedStars,
    forcedStarCount: forcedStars.length,
    openingFamily,
    capacityEventCount: capacityEvents.length,
    lockEventCount: lockEvents.length,
    propagationDepth: layers.length,
    firstForceLayer: forcedStars.length > 0 ? events.find(e =>
      e.type === DOUBLE_OPENING_EVENT.ROW_CAPACITY ||
      e.type === DOUBLE_OPENING_EVENT.COL_CAPACITY ||
      e.type === DOUBLE_OPENING_EVENT.REGION_CAPACITY)?.layer ?? -1 : -1,
  };
}

// ═══ 难度评估 ═══

/**
 * 双星难度评估。
 *
 * 综合以下维度：
 * - 开局推理可用数量
 * - 约束切换次数（行/列/区域）
 * - 锁定事件复杂度
 * - Solver 搜索节点（仅作参考，不直接映射难度）
 * - 棋盘尺寸因子
 *
 * 输出 band：intro, basic, intermediate, advanced, expert
 */
export const DIFFICULTY_BAND = Object.freeze({
  INTRO: 'intro',
  BASIC: 'basic',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
  EXPERT: 'expert',
});

/**
 * 评估双星候选难度。
 * 返回 { score, band, factors }。
 */
export function assessDoubleStarDifficulty(candidate, openingAnalysis) {
  const N = candidate.N;
  const opening = openingAnalysis || analyzeDoubleStarOpening(N, candidate.regions);

  // 因子 1：开局推理可用性 (0-30)
  // 有直接容量推理 = 较易；需要锁链 = 较难；无开局 = 需更多分析
  let openingScore = 0;
  if (opening.forcedStarCount >= 4) openingScore = 5;    // 有至少 4 个开局强制星 → 较易
  else if (opening.forcedStarCount >= 2) openingScore = 10;
  else if (opening.forcedStarCount >= 1) openingScore = 18;
  else openingScore = 30; // 无直接开局 → 高难

  // 因子 2：锁定复杂度 (0-25)
  let lockScore = 0;
  if (opening.lockEventCount === 0) lockScore = 0;
  else if (opening.lockEventCount <= 2) lockScore = 8;
  else if (opening.lockEventCount <= 4) lockScore = 15;
  else lockScore = 25;

  // 因子 3：传播深度 (0-20)
  let propagationScore = 0;
  if (opening.propagationDepth <= 1) propagationScore = 0;
  else if (opening.propagationDepth <= 3) propagationScore = 8;
  else if (opening.propagationDepth <= 5) propagationScore = 15;
  else propagationScore = 20;

  // 因子 4：尺寸因子 (0-15)
  let sizeScore = 0;
  if (N === 8) sizeScore = 0;
  else if (N === 9) sizeScore = 7;
  else sizeScore = 15;

  // 因子 5：约束类型切换 (0-10)
  const capacityTypes = new Set(
    (opening.events || [])
      .filter(e => e.type === 'ROW_CAPACITY' || e.type === 'COL_CAPACITY' || e.type === 'REGION_CAPACITY')
      .map(e => e.type)
  );
  let switchScore = 0;
  if (capacityTypes.size <= 1) switchScore = 0;
  else if (capacityTypes.size === 2) switchScore = 5;
  else switchScore = 10;

  const totalScore = openingScore + lockScore + propagationScore + sizeScore + switchScore;

  // Band 映射
  let band;
  if (totalScore <= 15) band = DIFFICULTY_BAND.INTRO;
  else if (totalScore <= 30) band = DIFFICULTY_BAND.BASIC;
  else if (totalScore <= 50) band = DIFFICULTY_BAND.INTERMEDIATE;
  else if (totalScore <= 70) band = DIFFICULTY_BAND.ADVANCED;
  else band = DIFFICULTY_BAND.EXPERT;

  return {
    score: totalScore,
    band,
    factors: {
      opening: openingScore,
      lock: lockScore,
      propagation: propagationScore,
      size: sizeScore,
      switch: switchScore,
    },
    openingFamily: opening.openingFamily,
    forcedStarCount: opening.forcedStarCount,
    lockEventCount: opening.lockEventCount,
  };
}

// ═══ 候选分析 ═══

/**
 * 分析单个双星候选。
 * 返回完整质量报告。
 */
export function analyzeDoubleStarCandidate(candidate, _opts = {}) {
  const { N, regions, solution, candidateId, seed, gameId } = candidate;
  const quota = 2;

  const report = {
    candidateId: candidateId || 'unknown',
    gameId: gameId || 'starDouble',
    N,
    quota,
    seed,
    alerts: [],
    solver: null,
    solutionSignature: null,
    canonicalSolutionSignature: null,
    exactRegionSignature: null,
    canonicalRegionSignature: null,
    regions: Array.isArray(regions) ? [...regions] : null,
    generatorFamily: candidate.generatorFamily || null,
    structuralFamily: null,
    openingAnalysis: null,
    difficulty: null,
    legacyAdvisory: null,
    humanLogic: null,
    reasoningFingerprint: null,
    traceReplay: null,
    declaredSolutionMatchesSolver: null,
  };

  if (!N || N < 1 || !Array.isArray(regions) || regions.length !== N * N) {
    report.alerts.push('invalid-structure');
    return report;
  }

  // Solver re-verification
  let sr;
  try {
    sr = solveStarLine(N, regions, { starsPerRow: quota, starsPerCol: quota, starsPerRegion: quota });
  } catch (e) {
    report.alerts.push(`solver-exception:${e.message}`);
    return report;
  }

  report.solver = {
    status: sr.status === 'UNIQUE' ? 'unique' : sr.status === 'MULTIPLE' ? 'multiple' : 'unsolved',
    solutionCount: sr.solutions?.length ?? 0,
    backtracks: sr.stats?.backtracks ?? null,
    durationMs: sr.stats?.durationMs ?? null,
  };

  if (sr.status !== 'UNIQUE') {
    report.alerts.push(`solver-${sr.status}`);
    return report;
  }

  const solvedSol = sr.solutions[0];

  // Verify declared solution
  if (solution && Array.isArray(solution)) {
    const declaredSet = new Set(solution);
    const solvedSet = new Set(solvedSol);
    report.declaredSolutionMatchesSolver = declaredSet.size === solvedSet.size
      && [...declaredSet].every(v => solvedSet.has(v));
    if (!report.declaredSolutionMatchesSolver) {
      report.alerts.push('invalid-declared-solution');
    }
  }

  // Signatures
  report.solutionSignature = makeSolutionSig('starDouble', N, quota, solvedSol);
  report.canonicalSolutionSignature = makeCanonicalSolutionSig('starDouble', N, quota, solvedSol);
  report.exactRegionSignature = makeRegionSig('starDouble', N, quota, regions);
  report.canonicalRegionSignature = makeCanonicalRegionSig('starDouble', N, quota, regions);

  // Structural family
  report.structuralFamily = classifyStructuralFamily(solvedSol, N);

  // Opening analysis
  report.openingAnalysis = analyzeDoubleStarOpening(N, regions);

  // Difficulty
  report.difficulty = assessDoubleStarDifficulty(candidate, report.openingAnalysis);
  report.legacyAdvisory = {
    openingTaxonomy: true,
    difficultyAssessment: true,
    mayGateD1: false,
  };

  // Human-readable deductions are independent of uniqueness search. The known
  // solution is used only to validate deductions after they are generated.
  report.humanLogic = analyzeStarDoubleHumanLogic({
    N,
    quota,
    regions,
    solution: solvedSol,
  }, { solverStatus: sr.status });
  report.traceReplay = replayHumanLogicTrace({
    N,
    quota,
    regions,
    solution: solvedSol,
  }, report.humanLogic);
  if (!report.traceReplay.ok) report.alerts.push('human-logic-trace-replay-failed');
  if ((report.humanLogic.solutionConsistencyErrors || []).length > 0) {
    report.alerts.push('human-logic-solution-consistency-failed');
  }
  report.reasoningFingerprint = makeReasoningFingerprint(report.humanLogic, N);

  return report;
}

// ═══ 批次分析 ═══

/**
 * 分析双星候选批次，包含重复度检测和多样性门禁。
 *
 * @returns {object} { reports, summary, diversity }
 */
export function analyzeDoubleStarBatch(candidates, opts = {}) {
  const reports = candidates.map(c => analyzeDoubleStarCandidate(c, opts));

  // 批次内重复检测
  const batchAlerts = computeDoubleStarBatchSimilarity(reports);
  const reasoningDuplicates = analyzeReasoningDuplicates(reports);
  for (const pair of reasoningDuplicates.pairs) {
    if (pair.decision === 'allow') continue;
    const alert = pair.decision === 'hard-reject'
      ? 'd1-hard-reject-duplicate'
      : 'd1-manual-review-duplicate';
    for (const report of reports) {
      if ((report.candidateId === pair.a || report.candidateId === pair.b)
          && !report.alerts.includes(alert)) {
        report.alerts.push(alert);
      }
    }
  }

  // 汇总
  const summary = {
    total: reports.length,
    uniqueSolution: reports.filter(r => r.solver?.status === 'unique').length,
    invalidSolution: reports.filter(r => r.alerts.includes('invalid-declared-solution')).length,
    solverFailures: reports.filter(r => r.solver?.status !== 'unique').length,
    solvedBySupportedHumanLogic: reports.filter(r =>
      r.humanLogic?.status === 'SOLVED_SUPPORTED_RULES').length,
    stalledBySupportedHumanLogic: reports.filter(r =>
      r.humanLogic?.status === 'STALLED_SUPPORTED_RULES').length,
    uniqueOutsideSupportedRuleSet: reports.filter(r =>
      r.humanLogic?.status === 'UNIQUE_BUT_OUTSIDE_SUPPORTED_RULESET').length,
    exactDuplicates: batchAlerts.exactDuplicates,
    canonicalDuplicates: batchAlerts.canonicalDuplicates,
    d1HardRejectDuplicatePairs: reasoningDuplicates.hardRejectPairCount,
    d1WarningDuplicatePairs: reasoningDuplicates.warningPairCount,
  };

  // 多样性分析
  const diversity = computeDoubleStarDiversity(reports);

  return { reports, summary, diversity, batchAlerts, reasoningDuplicates };
}

function computeDoubleStarBatchSimilarity(reports) {
  const exactDuplicates = [];
  const canonicalDuplicates = [];
  const nearDuplicatePairs = [];

  for (let i = 0; i < reports.length; i++) {
    for (let j = i + 1; j < reports.length; j++) {
      const a = reports[i], b = reports[j];
      if (!a.solutionSignature || !b.solutionSignature) continue;
      if (a.N !== b.N) continue;

      // Exact solution duplicate
      if (a.solutionSignature === b.solutionSignature) {
        exactDuplicates.push([a.candidateId, b.candidateId]);
        if (!a.alerts.includes('exact-solution-duplicate')) a.alerts.push('exact-solution-duplicate');
        if (!b.alerts.includes('exact-solution-duplicate')) b.alerts.push('exact-solution-duplicate');
      }

      // Canonical region duplicate
      if (a.canonicalRegionSignature && b.canonicalRegionSignature &&
          a.canonicalRegionSignature === b.canonicalRegionSignature) {
        canonicalDuplicates.push([a.candidateId, b.candidateId]);
        if (!a.alerts.includes('d4-region-duplicate')) a.alerts.push('d4-region-duplicate');
        if (!b.alerts.includes('d4-region-duplicate')) b.alerts.push('d4-region-duplicate');
      }

      // Near duplicate: same structural family + similar opening
      if (a.structuralFamily?.family && b.structuralFamily?.family &&
          a.structuralFamily.family === b.structuralFamily.family &&
          a.openingAnalysis?.openingFamily === b.openingAnalysis?.openingFamily) {
        nearDuplicatePairs.push([a.candidateId, b.candidateId]);
        if (!a.alerts.includes('near-duplicate')) a.alerts.push('near-duplicate');
        if (!b.alerts.includes('near-duplicate')) b.alerts.push('near-duplicate');
      }
    }
  }

  return { exactDuplicates, canonicalDuplicates, nearDuplicatePairs };
}

function computeDoubleStarDiversity(reports) {
  // Family 分布
  const familyDist = {};
  const openingDist = {};
  const difficultyDist = {};
  const sizeDist = {};

  for (const r of reports) {
    const fam = r.structuralFamily?.family || 'unknown';
    familyDist[fam] = (familyDist[fam] || 0) + 1;

    const op = r.openingAnalysis?.openingFamily || 'unknown';
    openingDist[op] = (openingDist[op] || 0) + 1;

    const band = r.difficulty?.band || 'unknown';
    difficultyDist[band] = (difficultyDist[band] || 0) + 1;

    const sz = String(r.N);
    sizeDist[sz] = (sizeDist[sz] || 0) + 1;
  }

  // 最近邻相似度
  let avgNearestSimilarity = null;
  const sims = [];
  for (let i = 0; i < reports.length; i++) {
    let best = -1;
    for (let j = 0; j < reports.length; j++) {
      if (i === j) continue;
      if (reports[i].N !== reports[j].N) continue;
      // Parse solution signature: "gameId:N:quota:index1,index2,..."
      const parseSol = (sig) => {
        if (!sig) return new Set();
        const parts = sig.split(':');
        if (parts.length < 4) return new Set();
        return new Set(parts[3].split(',').map(Number).filter(n => !isNaN(n)));
      };
      const sa = parseSol(reports[i].solutionSignature);
      const sb = parseSol(reports[j].solutionSignature);
      if (sa.size === 0 || sb.size === 0) continue;
      let inter = 0;
      for (const v of sa) if (sb.has(v)) inter++;
      const sim = inter / Math.max(sa.size, sb.size);
      if (sim > best) best = sim;
    }
    if (best >= 0) sims.push(best);
  }
  if (sims.length > 0) {
    avgNearestSimilarity = sims.reduce((s, v) => s + v, 0) / sims.length;
  }

  return {
    familyDistribution: familyDist,
    openingDistribution: openingDist,
    difficultyDistribution: difficultyDist,
    sizeDistribution: sizeDist,
    uniqueStructuralFamilies: Object.keys(familyDist).length,
    uniqueOpeningFamilies: Object.keys(openingDist).length,
    avgNearestNeighborSimilarity: avgNearestSimilarity,
  };
}

// ═══ 批次报告生成 ═══

/**
 * 生成机器可读的 JSON 批次报告。
 */
export function generateBatchReport(candidates, opts = {}) {
  const {
    reports,
    summary,
    diversity,
    batchAlerts,
    reasoningDuplicates,
  } = analyzeDoubleStarBatch(candidates, opts);

  // Nearest candidate ID for each
  for (let i = 0; i < reports.length; i++) {
    let nearestId = null;
    let nearestSimilarity = -1;
    for (let j = 0; j < reports.length; j++) {
      if (i === j || reports[i].N !== reports[j].N) continue;
      // Parse solution signature: "gameId:N:quota:index1,index2,..."
      const parseSolIndices = (sig) => {
        if (!sig) return new Set();
        const parts = sig.split(':');
        if (parts.length < 4) return new Set();
        return new Set(parts[3].split(',').map(Number).filter(n => !isNaN(n)));
      };
      const sa = parseSolIndices(reports[i].solutionSignature);
      const sb = parseSolIndices(reports[j].solutionSignature);
      if (sa.size === 0 || sb.size === 0) continue;
      let inter = 0;
      for (const v of sa) if (sb.has(v)) inter++;
      const similarity = inter / Math.max(sa.size, sb.size);
      if (similarity > nearestSimilarity) {
        nearestSimilarity = similarity;
        nearestId = reports[j].candidateId;
      }
    }
    reports[i].nearestCandidateId = nearestId;
    reports[i].nearestSolutionSimilarity = nearestSimilarity >= 0 ? nearestSimilarity : null;
  }

  return {
    analyzerVersion: QUALITY_VERSION,
    summary,
    diversity,
    batchAlerts: {
      exactDuplicatePairs: batchAlerts.exactDuplicates.length,
      canonicalDuplicatePairs: batchAlerts.canonicalDuplicates.length,
      nearDuplicatePairs: batchAlerts.nearDuplicatePairs.length,
    },
    reasoningDuplicates,
    candidates: reports.map(r => ({
      candidateId: r.candidateId,
      seed: r.seed,
      size: r.N,
      quota: r.quota,
      solutionSignature: r.solutionSignature,
      canonicalSolutionSignature: r.canonicalSolutionSignature,
      exactRegionSignature: r.exactRegionSignature,
      canonicalRegionSignature: r.canonicalRegionSignature,
      generatorFamily: r.generatorFamily,
      structuralSubFamily: r.structuralFamily?.subFamily,
      structuralFamily: r.structuralFamily?.family,
      legacyOpeningFamily: r.openingAnalysis?.openingFamily,
      legacyDifficultyScore: r.difficulty?.score,
      legacyDifficultyBand: r.difficulty?.band,
      legacyAdvisory: r.legacyAdvisory,
      openingFamily: r.openingAnalysis?.openingFamily,
      difficultyScore: r.difficulty?.score,
      difficultyBand: r.difficulty?.band,
      humanLogicStatus: r.humanLogic?.status,
      humanLogicSummary: r.humanLogic?.summary,
      exactTraceHash: r.reasoningFingerprint?.exact?.exactTraceHash,
      deductionWaveHash: r.reasoningFingerprint?.exact?.deductionWaveHash,
      normalizedReasoningFingerprint:
        r.reasoningFingerprint?.experience?.normalizedFingerprint,
      reasoningExperience: r.reasoningFingerprint?.experience,
      nearestCandidateId: r.nearestCandidateId,
      nearestSolutionSimilarity: r.nearestSolutionSimilarity,
      alerts: r.alerts,
      solverStatus: r.solver?.status,
      validatorVersion: QUALITY_VERSION,
    })),
  };
}

export function analyzeDoubleStarSequence(candidates, opts = {}) {
  const reports = candidates.map(candidate =>
    candidate.reasoningFingerprint && candidate.humanLogic
      ? candidate
      : analyzeDoubleStarCandidate(candidate, opts));
  return analyzeStarDoubleSequence(reports);
}
