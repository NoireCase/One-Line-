#!/usr/bin/env node
/**
 * Star Line 候选关卡分析器。
 * 用法: node scripts/analyze-star-line-candidates.mjs --input <path> [--compare]
 *
 * Package 2B.1: D4 canonical 签名、exact 去重、区域形状指标。
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
} from './star-line-candidate-signatures.mjs';

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
const SIMILARITY_THRESHOLD = 0.8;

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
  if (alerts.includes('identical-solution')) return { conclusion: 'review', reason: 'identical-solution' };
  if (alerts.includes('high-solution-similarity')) return { conclusion: 'review', reason: 'high-solution-similarity' };
  if (alerts.includes('high-region-similarity')) return { conclusion: 'review', reason: 'high-region-similarity' };
  if (alerts.includes('d4-high-similarity')) return { conclusion: 'review', reason: 'd4-high-similarity' };
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

  // Solver-based alerts
  if (report.solver.status !== 'unique') {
    report.alerts.push(`solver-${report.solver.status}`);
  }
  if (report.declaredSolutionMatchesSolver === false) {
    report.alerts.push('invalid-declared-solution');
  }

  // Compare with formal levels (use D4-aligned Jaccard)
  if (formalLevels && solvedSol) {
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

      const fs = {
        formalLevelId: fl.id,
        solutionJaccard: solSim,
        regionPairJaccard: regSim,
        d4RegionJaccard: regSimD4,
      };
      if (solIdentical && regIdentical) fs.alert = 'identical-solution-and-regions';
      else if (solIdentical) fs.alert = 'identical-solution';
      else if (solSim >= SIMILARITY_THRESHOLD) fs.alert = 'high-solution-similarity';
      if (regIdentical && !solIdentical) fs.alert = fs.alert || 'd4-region-duplicate';
      if (regSimD4 >= SIMILARITY_THRESHOLD && !regIdentical) fs.alert = fs.alert || 'd4-high-similarity';
      if (regSim >= SIMILARITY_THRESHOLD && !regIdentical) fs.alert = fs.alert || 'high-region-similarity';

      report.similarity.formal.push(fs);
      if (fs.alert) report.alerts.push(fs.alert);
    }
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
  // Recompute all recommendations after batch analysis
  for (const r of reports) {
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
  const formalLevels = doCompare ? STAR_LINE_LEVELS.slice(0, 30) : null;

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
