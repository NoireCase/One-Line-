#!/usr/bin/env node
/**
 * Star Line 候选关卡分析器。
 * 用法: node scripts/analyze-star-line-candidates.mjs --input <path> [--compare]
 *
 * Package 2B.1: D4 canonical 签名、exact 去重、区域形状指标。
 * Package 2D.1: 全目录收口门禁 —— --compare 读取全部正式关卡（含全部单星）作为历史目录，
 *   新增 D4 region+solution 同时等价 reject、相似度 >0.90 reject / 0.80–0.90 review、
 *   生产目标 <0.75、模板家族归属与超额告警、开局指纹与初始强制步输出。
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'fs';
import { resolve, basename, join } from 'path';
import { solveStarLine } from './starLineSolver.mjs';
import { resolveCandidatePath, safeWriteJSON } from './lib/star-line-candidate-io.mjs';
import { STAR_LINE_LEVELS } from '../src/data/starLineLevels.js';
import {
  makeSolutionSig,
  makeCanonicalRegionSig,
  makeRegionSig,
  canonicalRegionsSimple,
  regionAreaProfile,
  regionShapeMetrics,
  d4AlignedRegionJaccard,
  d4FullyEquivalent,
} from './star-line-candidate-signatures.mjs';
import { computeOpeningFingerprint } from './star-line-fingerprint.mjs';
import { getTemplatePoolDiagnostics } from './generate-star-line-candidates.mjs';
import {
  analyzeDynamicOpening,
  compareDynamicOpenings,
  findDynamicOpeningMatches,
  summarizeDynamicOpeningLayers,
} from './star-line-dynamic-opening.mjs';

// ── CLI ──
function parseArgs() {
  const a = process.argv.slice(2), p = {};
  for (let i = 0; i < a.length; i++) {
    const k = a[i].replace(/^--?/, '');
    if (k === 'compare' || k === 'force') { p[k] = true; continue; }
    p[k] = a[i + 1]; i++;
  }
  return p;
}

// ── Helpers ──
const SIMILARITY_THRESHOLD = 0.8;   // review 下限
const REJECT_SIMILARITY = 0.9;      // 严格大于该值直接 reject
const PRODUCTION_TARGET = 0.75;     // 生产目标：与全目录最高相似度 < 0.75
const FAMILY_MATCH_THRESHOLD = 0.6; // 无 metadata 时模板家族归属的最低相似度
const FAMILY_OVERUSE_LIMIT = 3;     // 同一模板家族批内超过该数量时告警
const formalDynamicCache = new WeakMap();

function analyzeFormalDynamic(level) {
  if (!formalDynamicCache.has(level)) {
    formalDynamicCache.set(level, analyzeDynamicOpening(level.N, level.regions, { quota: 1 }));
  }
  return formalDynamicCache.get(level);
}

/** 模板家族参照表（与生成器 familyKey 规则一致） */
let _familyRefs = null;
function templateFamilyRefs() {
  if (_familyRefs) return _familyRefs;
  const d = getTemplatePoolDiagnostics();
  _familyRefs = d.bases.map((b) => ({
    key: `${b.origin}:${b.seed ?? 'base'}`,
    regions: b.regions,
  }));
  return _familyRefs;
}

/** 候选模板家族归属：优先生成 metadata，其次 D4 相似度匹配模板池，否则 unknown */
function resolveTemplateFamily(candidate) {
  if (candidate.templateFamily) return candidate.templateFamily;
  if (candidate.N !== 10 || !Array.isArray(candidate.regions)) return null;
  let best = { key: null, sim: 0 };
  for (const ref of templateFamilyRefs()) {
    const sim = d4AlignedRegionJaccard(candidate.regions, ref.regions, 10);
    if (sim > best.sim) best = { key: ref.key, sim };
  }
  return best.sim >= FAMILY_MATCH_THRESHOLD ? best.key : 'unknown';
}

function mean(arr) { return arr.reduce((s, v) => s + v, 0) / arr.length; }
function variance(arr) { const m = mean(arr); return arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length; }

/** Solution Jaccard: set intersection/union of star positions */
function solutionJaccard(solA, solB) {
  const sa = new Set(solA), sb = new Set(solB);
  let inter = 0;
  for (const v of sa) { if (sb.has(v)) inter++; }
  const union = new Set([...solA, ...solB]).size;
  return union === 0 ? 0 : inter / union;
}

/** Region pair Jaccard: same-region unordered cell pairs (deprecated for D4-aligned) */
function regionPairJaccard(regA, regB) {
  if (regA.length !== regB.length) return 0;
  function pairs(r) {
    const groups = {};
    for (let i = 0; i < r.length; i++) {
      const g = r[i];
      if (!groups[g]) groups[g] = [];
      groups[g].push(i);
    }
    const s = new Set();
    for (const cells of Object.values(groups)) {
      for (let a = 0; a < cells.length; a++)
        for (let b = a + 1; b < cells.length; b++)
          s.add(`${Math.min(cells[a], cells[b])},${Math.max(cells[a], cells[b])}`);
    }
    return s;
  }
  const pa = pairs(regA), pb = pairs(regB);
  let inter = 0;
  for (const p of pa) { if (pb.has(p)) inter++; }
  const union = new Set([...pa, ...pb]).size;
  return union === 0 ? 0 : inter / union;
}

function elongatedRatio(regions, N) {
  const groups = {};
  for (let i = 0; i < regions.length; i++) {
    const g = regions[i]; if (!groups[g]) groups[g] = [];
    groups[g].push(i);
  }
  let elongated = 0;
  for (const cells of Object.values(groups)) {
    const rows = new Set(), cols = new Set();
    for (const c of cells) { rows.add(Math.floor(c / N)); cols.add(c % N); }
    if (rows.size * cols.size >= cells.length * 2.5) elongated++;
  }
  return elongated / N;
}
function edgeRegionRatio(regions, N) {
  const edgeSet = new Set();
  for (let i = 0; i < regions.length; i++) {
    const r = Math.floor(i / N), c = i % N;
    if (r === 0 || r === N - 1 || c === 0 || c === N - 1) edgeSet.add(regions[i]);
  }
  return edgeSet.size / N;
}

// ── Conclusion logic ──

function computeRecommendation(report) {
  const alerts = report.alerts || [];
  const solver = report.solver || {};
  if (!report || report.status === 'failed') return { conclusion: 'reject', reason: 'analysis failed' };
  if (solver.status !== 'unique') return { conclusion: 'reject', reason: `solver-${solver.status}` };
  if (alerts.includes('invalid-declared-solution')) return { conclusion: 'reject', reason: 'invalid-declared-solution' };
  if (alerts.includes('exact-solution-duplicate')) return { conclusion: 'reject', reason: 'exact-solution-duplicate' };
  if (alerts.includes('d4-region-duplicate')) return { conclusion: 'reject', reason: 'd4-region-duplicate' };
  if (alerts.includes('identical-solution-and-regions')) return { conclusion: 'reject', reason: 'identical-solution-and-regions' };
  if (alerts.includes('d4-identical-solution-and-regions')) return { conclusion: 'reject', reason: 'd4-identical-solution-and-regions' };
  if (alerts.includes('d4-similarity-reject')) return { conclusion: 'reject', reason: 'd4-similarity-reject' };
  if (alerts.includes('dynamic-trace-invalid')) return { conclusion: 'reject', reason: 'dynamic-trace-invalid' };
  if (alerts.includes('dynamic-short-contradiction')) return { conclusion: 'reject', reason: 'dynamic-short-contradiction' };
  if (alerts.includes('dynamic-exact-duplicate')) return { conclusion: 'reject', reason: 'dynamic-exact-duplicate' };
  if (alerts.includes('identical-solution')) return { conclusion: 'review', reason: 'identical-solution' };
  if (alerts.includes('high-solution-similarity')) return { conclusion: 'review', reason: 'high-solution-similarity' };
  if (alerts.includes('high-region-similarity')) return { conclusion: 'review', reason: 'high-region-similarity' };
  if (alerts.includes('d4-high-similarity')) return { conclusion: 'review', reason: 'd4-high-similarity' };
  if (alerts.includes('template-family-overuse')) return { conclusion: 'review', reason: 'template-family-overuse' };
  if (alerts.includes('area-profile-duplicate')) return { conclusion: 'review', reason: 'area-profile-duplicate' };
  if (alerts.includes('shape-concern')) return { conclusion: 'review', reason: 'shape-concern' };
  if (alerts.includes('batch-duplicate')) return { conclusion: 'review', reason: 'batch-duplicate (legacy)' };
  return { conclusion: 'keep', reason: 'unique solution, no alerts' };
}

// ── Analyze single candidate ──

function analyzeCandidate(candidate, formalLevels) {
  const N = candidate.N;
  const gameId = candidate.gameId;
  const quota = candidate.starsPerRow ?? candidate.starsPerCol ?? candidate.starsPerRegion ?? 1;
  const solution = candidate.solution;
  const regions = candidate.regions;

  const report = {
    candidateId: candidate.candidateId || 'unknown',
    gameId: gameId || 'unknown',
    N: N || 0,
    quota,
    seed: candidate.seed,
    alerts: [],
    similarity: { formal: [], batch: [] },
    solver: null,
    solutionSignature: null,
    canonicalRegionSignature: null,
    regionsSignature: null,
    declaredSolutionSignature: null,
    solvedSolutionSignature: null,
    declaredSolutionMatchesSolver: null,
    regionMetrics: null,
    areaProfile: null,
    shapeMetrics: null,
    templateFamily: null,
    openingFingerprint: null,
    dynamicOpening: null,
    dynamicOpeningMatches: { formal: null, batch: { exactDuplicates: [], sameFamily: [], nearDuplicates: [] } },
    maxFormalSimilarity: null,
    closestFormalLevelId: null,
    meetsProductionTarget: null,
    conclusion: 'reject',
    conclusionReason: '',
  };

  if (!gameId || !N || N < 1 || !Array.isArray(regions) || regions.length !== N * N) {
    report.conclusionReason = 'invalid candidate structure';
    return report;
  }

  // Solver re-verification
  let solverResult;
  try {
    solverResult = solveStarLine(N, regions, {
      starsPerRow: quota, starsPerCol: quota, starsPerRegion: quota,
    });
  } catch (e) {
    report.conclusionReason = `solver exception: ${e.message}`;
    return report;
  }

  report.solver = {
    status: solverResult.status === 'UNIQUE' ? 'unique'
      : solverResult.status === 'MULTIPLE' ? 'multiple' : 'unsolved',
    solutionCount: solverResult.solutions?.length ?? 0,
    placements: solverResult.stats?.placements ?? null,
    propagations: solverResult.stats?.propagations ?? null,
    backtracks: solverResult.stats?.backtracks ?? null,
    durationMs: solverResult.stats?.durationMs ?? null,
  };

  // Cross-verify declared solution vs Solver result
  if (solution && Array.isArray(solution)) {
    report.declaredSolutionSignature = makeSolutionSig(gameId, N, quota, solution);
  }
  const solvedSol = solverResult.status === 'UNIQUE' ? solverResult.solutions[0] : null;
  if (solvedSol) {
    report.solvedSolutionSignature = makeSolutionSig(gameId, N, quota, solvedSol);
  }

  if (solverResult.status === 'UNIQUE' && solvedSol && solution && Array.isArray(solution)) {
    const declaredSet = new Set(solution), solvedSet = new Set(solvedSol);
    report.declaredSolutionMatchesSolver = declaredSet.size === solvedSet.size
      && [...declaredSet].every(v => solvedSet.has(v));
  }

  // Region metrics
  const areas = regionAreaProfile(regions);
  report.areaProfile = areas;
  const m = regionShapeMetrics(regions, N);
  report.shapeMetrics = m;
  report.regionMetrics = {
    regionCount: N,
    minRegionArea: Math.min(...areas),
    maxRegionArea: Math.max(...areas),
    meanRegionArea: mean(areas),
    regionAreaVariance: variance(areas),
    elongatedRegionRatio: elongatedRatio(regions, N),
    edgeRegionRatio: edgeRegionRatio(regions, N),
  };

  // Shape concerns: only flag when multiple regions show significant thin-cell count (>4)
  // or when multiple singleton regions (1 cell) exist
  const thinRegions = m.filter((r) => r.articulationRisk && r.thinCells > 4);
  const singletons = areas.filter((a) => a <= 1);
  if (thinRegions.length >= 2 || singletons.length >= 2) {
    report.alerts.push('shape-concern');
  }

  // Signatures
  const effectiveSol = solvedSol || (solution && Array.isArray(solution) ? solution : []);
  report.solutionSignature = effectiveSol.length ? makeSolutionSig(gameId, N, quota, effectiveSol) : null;
  report.canonicalRegionSignature = makeCanonicalRegionSig(gameId, N, quota, regions);
  report.regionsSignature = makeRegionSig(gameId, N, quota, regions);

  // Package 2D.1: 模板家族归属 + 开局指纹（含最小区域/象限/初始强制步）
  report.templateFamily = resolveTemplateFamily(candidate);
  report.openingFingerprint = computeOpeningFingerprint(N, regions, quota);
  if (gameId === 'starSingle' && quota === 1) {
    report.dynamicOpening = analyzeDynamicOpening(N, regions, { quota });
    if (!report.dynamicOpening.traceValidation.valid || !report.dynamicOpening.d4Validation.valid) {
      report.alerts.push('dynamic-trace-invalid');
    }
    if (report.dynamicOpening.status === 'SHORT_CONTRADICTION') {
      report.alerts.push('dynamic-short-contradiction');
    }
    if (formalLevels) {
      const formalDynamic = formalLevels
        .filter((level) => level.gameId === 'starSingle' && (level.starsPerRow ?? 1) === 1)
        .map((level) => ({
          id: level.id,
          analysis: analyzeFormalDynamic(level),
        }));
      report.dynamicOpeningMatches.formal = findDynamicOpeningMatches(report.dynamicOpening, formalDynamic);
      if (report.dynamicOpeningMatches.formal.exactDuplicates.length > 0) {
        report.alerts.push('dynamic-exact-duplicate');
      }
    }
  }

  // Solver-based alerts
  if (report.solver.status !== 'unique') {
    report.alerts.push(`solver-${report.solver.status}`);
  }
  if (report.declaredSolutionMatchesSolver === false) {
    report.alerts.push('invalid-declared-solution');
  }

  // Compare with formal levels (use D4-aligned Jaccard)
  // Package 2D.1 全目录门禁：
  //   - D4 region + solution 同时等价 → d4-identical-solution-and-regions (reject)
  //   - 相似度 > 0.90 → d4-similarity-reject (reject)
  //   - 0.80–0.90 → d4-high-similarity (review)
  //   - 生产目标：maxFormalSimilarity < 0.75
  if (formalLevels && solvedSol) {
    let maxSim = 0, closestId = null;
    for (const fl of formalLevels) {
      if (fl.gameId !== gameId || fl.N !== N) continue;
      const flQuota = fl.starsPerRow ?? fl.starsPerCol ?? fl.starsPerRegion ?? 1;
      if (flQuota !== quota) continue;

      const solSim = solutionJaccard(solvedSol, fl.solution);
      const regSimD4 = d4AlignedRegionJaccard(canonicalRegionsSimple(regions), canonicalRegionsSimple(fl.regions), N);
      const regSim = regionPairJaccard(canonicalRegionsSimple(regions), canonicalRegionsSimple(fl.regions));
      const solIdentical = solSim === 1.0;

      const flCanonSig = makeCanonicalRegionSig(gameId, N, quota, fl.regions);
      const regIdentical = report.canonicalRegionSignature === flCanonSig;
      const d4FullDup = d4FullyEquivalent(regions, solvedSol, fl.regions, fl.solution, N);

      if (regSimD4 > maxSim) { maxSim = regSimD4; closestId = fl.id; }

      const fs = {
        formalLevelId: fl.id,
        solutionJaccard: solSim,
        regionPairJaccard: regSim,
        d4RegionJaccard: regSimD4,
      };
      if (d4FullDup) fs.alert = 'd4-identical-solution-and-regions';
      else if (solIdentical && regIdentical) fs.alert = 'identical-solution-and-regions';
      if (regIdentical && !solIdentical) fs.alert = fs.alert || 'd4-region-duplicate';
      if (regSimD4 > REJECT_SIMILARITY) fs.alert = fs.alert || 'd4-similarity-reject';
      if (solIdentical) fs.alert = fs.alert || 'identical-solution';
      if (solSim >= SIMILARITY_THRESHOLD) fs.alert = fs.alert || 'high-solution-similarity';
      if (regSimD4 >= SIMILARITY_THRESHOLD && !regIdentical) fs.alert = fs.alert || 'd4-high-similarity';
      if (regSim >= SIMILARITY_THRESHOLD && !regIdentical) fs.alert = fs.alert || 'high-region-similarity';

      report.similarity.formal.push(fs);
      if (fs.alert) report.alerts.push(fs.alert);
    }
    report.maxFormalSimilarity = maxSim;
    report.closestFormalLevelId = closestId;
    report.meetsProductionTarget = maxSim < PRODUCTION_TARGET;
  }

  return report;
}

// ── Batch similarity (D4-aware) ──

function computeBatchSimilarity(reports) {
  for (let i = 0; i < reports.length; i++) {
    for (let j = i + 1; j < reports.length; j++) {
      const a = reports[i], b = reports[j];
      if (!a.solutionSignature || !b.solutionSignature) continue;
      if (a.gameId !== b.gameId || a.N !== b.N || a.quota !== b.quota) continue;

      // Exact solution duplicate
      if (a.solutionSignature === b.solutionSignature) {
        a.similarity.batch.push({ candidateId: b.candidateId, alert: 'exact-solution-duplicate' });
        b.similarity.batch.push({ candidateId: a.candidateId, alert: 'exact-solution-duplicate' });
        if (!a.alerts.includes('exact-solution-duplicate')) a.alerts.push('exact-solution-duplicate');
        if (!b.alerts.includes('exact-solution-duplicate')) b.alerts.push('exact-solution-duplicate');
      }

      // D4-equivalent region
      if (a.canonicalRegionSignature && b.canonicalRegionSignature &&
          a.canonicalRegionSignature === b.canonicalRegionSignature) {
        a.similarity.batch.push({ candidateId: b.candidateId, alert: 'd4-region-duplicate' });
        b.similarity.batch.push({ candidateId: a.candidateId, alert: 'd4-region-duplicate' });
        if (!a.alerts.includes('d4-region-duplicate')) a.alerts.push('d4-region-duplicate');
        if (!b.alerts.includes('d4-region-duplicate')) b.alerts.push('d4-region-duplicate');
      }

      // Area profile duplicate (only flag if profile appears too many times in batch)
      // Handled after all pairwise comparisons via frequency-based check

      if (a.dynamicOpening && b.dynamicOpening) {
        const dynamic = compareDynamicOpenings(a.dynamicOpening, b.dynamicOpening);
        if (dynamic.exact) {
          a.dynamicOpeningMatches.batch.exactDuplicates.push(b.candidateId);
          b.dynamicOpeningMatches.batch.exactDuplicates.push(a.candidateId);
          if (!a.alerts.includes('dynamic-exact-duplicate')) a.alerts.push('dynamic-exact-duplicate');
          if (!b.alerts.includes('dynamic-exact-duplicate')) b.alerts.push('dynamic-exact-duplicate');
        }
        if (dynamic.sameFamily) {
          a.dynamicOpeningMatches.batch.sameFamily.push(b.candidateId);
          b.dynamicOpeningMatches.batch.sameFamily.push(a.candidateId);
        }
        if (dynamic.nearDuplicate) {
          a.dynamicOpeningMatches.batch.nearDuplicates.push(b.candidateId);
          b.dynamicOpeningMatches.batch.nearDuplicates.push(a.candidateId);
        }
      }
    }
  }

  // Post-pairwise: area profile frequency check
  // Flag only when a profile appears in more than 40% of the batch
  const profileCounts = new Map();
  for (const r of reports) {
    if (!r.areaProfile) continue;
    const key = JSON.stringify(r.areaProfile);
    profileCounts.set(key, (profileCounts.get(key) || 0) + 1);
  }
  const threshold = Math.max(8, Math.ceil(reports.length * 0.4));
  for (const r of reports) {
    if (!r.areaProfile) continue;
    const key = JSON.stringify(r.areaProfile);
    if (profileCounts.get(key) > threshold) {
      if (!r.alerts.includes('area-profile-duplicate')) r.alerts.push('area-profile-duplicate');
    }
  }
  // Package 2D.1: 同一模板家族批内超过 FAMILY_OVERUSE_LIMIT 个成员时明确告警
  const familyCounts = new Map();
  for (const r of reports) {
    const fam = r.templateFamily;
    if (!fam || fam === 'unknown') continue;
    familyCounts.set(fam, (familyCounts.get(fam) || 0) + 1);
  }
  for (const r of reports) {
    const fam = r.templateFamily;
    if (!fam || fam === 'unknown') continue;
    if (familyCounts.get(fam) > FAMILY_OVERUSE_LIMIT) {
      if (!r.alerts.includes('template-family-overuse')) r.alerts.push('template-family-overuse');
    }
  }

  // Recompute all recommendations after batch analysis
  for (const r of reports) {
    for (const values of Object.values(r.dynamicOpeningMatches?.batch ?? {})) values.sort();
    const rec = computeRecommendation(r);
    r.conclusion = rec.conclusion;
    r.conclusionReason = rec.reason;
  }
}

// ── Markdown ──

function generateMarkdown(result) {
  const l = [];
  l.push('# Star Line Candidate Analysis');
  l.push('');
  l.push(`Generated: ${new Date().toISOString()}`);
  l.push(`Input: ${result.input}`);
  l.push(`Total: ${result.candidates.length} | keep=${result.summary.keep} review=${result.summary.review} reject=${result.summary.reject}`);
  l.push('');
  for (const r of result.candidates) {
    l.push(`## ${r.candidateId}`);
    l.push(`- **gameId**: ${r.gameId} | **N**: ${r.N} | **quota**: ${r.quota}`);
    l.push(`- **conclusion**: **${r.conclusion}** — ${r.conclusionReason || ''}`);
    if (r.solver) l.push(`- **solver**: ${r.solver.status}, ${r.solver.solutionCount} sol, ${r.solver.backtracks} bt, ${r.solver.durationMs}ms`);
    if (r.declaredSolutionMatchesSolver !== undefined) l.push(`- **declaredMatchesSolver**: ${r.declaredSolutionMatchesSolver}`);
    if (r.canonicalRegionSignature) l.push(`- **canonicalRegionSig**: \`${r.canonicalRegionSignature.substring(0, 60)}...\``);
    if (r.areaProfile) l.push(`- **areaProfile**: [${r.areaProfile.join(', ')}]`);
    if (r.regionMetrics) l.push(`- **regions**: area ${r.regionMetrics.minRegionArea}-${r.regionMetrics.maxRegionArea} (μ ${r.regionMetrics.meanRegionArea.toFixed(1)}), elongated ${(r.regionMetrics.elongatedRegionRatio*100).toFixed(0)}%, edge ${(r.regionMetrics.edgeRegionRatio*100).toFixed(0)}%`);
    if (r.templateFamily) l.push(`- **templateFamily**: ${r.templateFamily}`);
    if (r.openingFingerprint) {
      const fp = r.openingFingerprint;
      l.push(`- **opening**: min ${fp.minRegionArea}×${fp.minRegionCount} @ ${fp.minRegionQuadrants.join(',')} | forced [${fp.initialForcedStars.join(', ') || '—'}]`);
      l.push(`- **fingerprint**: \`${fp.fingerprint}\``);
    }
    if (r.dynamicOpening) {
      const d = r.dynamicOpening;
      l.push(`- **dynamic opening**: ${d.status} | depth ${d.propagationDepth} | tier ${d.openingTier ?? '—'} | cluster ${d.openingCluster} | ${d.openingFamily}`);
      l.push(`- **first stars**: [${d.firstStarCells.join(', ') || '—'}] | **causal spine**: ${d.causalSpineTypes.join(' → ') || '—'}`);
      l.push(`- **dynamic exact hash**: \`${d.exactDynamicHash}\``);
      l.push(`- **dynamic layers**: ${summarizeDynamicOpeningLayers(d).map((layer) => `L${layer.layer}[${layer.events.map((event) => `${event.type}:${event.candidates}>${event.excluded}${event.stars.length ? `★${event.stars.join(',')}` : ''}`).join(', ')}]`).join(' / ') || '—'}`);
      const formal = r.dynamicOpeningMatches?.formal;
      if (formal) {
        l.push(`- **dynamic catalog**: exact [${formal.exactDuplicates.join(', ') || '—'}] | family [${formal.sameFamilyLevels.join(', ') || '—'}] | near [${formal.nearDuplicates.join(', ') || '—'}]`);
      }
      const batch = r.dynamicOpeningMatches?.batch;
      if (batch) {
        l.push(`- **dynamic batch**: exact [${batch.exactDuplicates.join(', ') || '—'}] | family [${batch.sameFamily.join(', ') || '—'}] | near [${batch.nearDuplicates.join(', ') || '—'}]`);
      }
    }
    if (r.maxFormalSimilarity !== null && r.maxFormalSimilarity !== undefined) {
      l.push(`- **maxFormalSimilarity**: ${r.maxFormalSimilarity.toFixed(3)} (${r.closestFormalLevelId ?? '—'}) | productionTarget<0.75: ${r.meetsProductionTarget ? 'PASS' : 'MISS'}`);
    }
    if (r.alerts?.length) l.push(`- **alerts**: ${r.alerts.join(', ')}`);
    if (r.similarity?.formal?.filter(s=>s.alert).length) l.push(`- **formal**: ${r.similarity.formal.filter(s=>s.alert).map(s=>`${s.formalLevelId}:${s.alert}`).join(', ')}`);
    l.push('');
  }
  return l.join('\n');
}

// ── Main ──

function main() {
  const args = parseArgs();
  if (!args.input) { console.error('用法: --input <path> [--compare] [--force]'); process.exit(1); }

  const doCompare = args.compare !== undefined;
  const force = args.force !== undefined;

  let inputPath = resolve(args.input);
  if (!existsSync(inputPath)) {
    inputPath = resolveCandidatePath(args.input);
  }

  const isDir = existsSync(inputPath) && statSync(inputPath).isDirectory();
  // Package 2D.1: --compare 读取全部正式关卡作为历史目录（含全部单星），不再截断为前 30 关
  const formalLevels = doCompare ? STAR_LINE_LEVELS : null;

  const files = [];
  if (isDir) {
    for (const f of readdirSync(inputPath)) {
      if (f.endsWith('.json') && !f.includes('-analysis') && !f.includes('failed-report')) files.push(join(inputPath, f));
    }
  } else if (inputPath.endsWith('.json')) {
    files.push(inputPath);
  }

  const all = [];
  for (const f of files) {
    const raw = JSON.parse(readFileSync(f, 'utf-8'));
    if (!raw.complete && raw.complete === false) continue;
    const cands = raw.candidates || [raw];
    for (const c of cands) { c._sourceFile = basename(f); all.push(c); }
  }

  const reports = all.map(c => analyzeCandidate(c, formalLevels));
  computeBatchSimilarity(reports);

  const summary = { keep: 0, review: 0, reject: 0 };
  for (const r of reports) {
    const c = r.conclusion || 'error';
    summary[c] = (summary[c] || 0) + 1;
  }

  const result = { generatedAt: new Date().toISOString(), input: inputPath, candidates: reports, summary };

  const outBase = resolve(process.cwd(), 'tmp/star-line-candidates',
    basename(inputPath).replace(/\.json$/, '') + '-analysis');
  safeWriteJSON(outBase + '.json', result, { force });
  writeFileSync(outBase + '.md', generateMarkdown(result), 'utf-8');

  console.log(`JSON: ${outBase}.json`);
  console.log(`MD:   ${outBase}.md`);
  console.log(`Summary: ${reports.length} candidates | keep=${summary.keep} review=${summary.review} reject=${summary.reject}`);
}
main();
