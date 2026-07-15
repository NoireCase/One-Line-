#!/usr/bin/env node
/**
 * Star Line 候选关卡分析器。
 * 用法: node scripts/analyze-star-line-candidates.mjs --input <path> [--compare]
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'fs';
import { resolve, basename, join } from 'path';
import { solveStarLine } from './starLineSolver.mjs';
import { resolveCandidatePath, safeWriteJSON } from './lib/star-line-candidate-io.mjs';
import { STAR_LINE_LEVELS } from '../src/data/starLineLevels.js';

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

/** solutionSignature: gameId:N:quota:sorted-indexes */
function makeSolutionSig(gameId, N, quota, sol) {
  return `${gameId}:${N}:${quota}:${[...sol].sort((a, b) => a - b).join(',')}`;
}

/** Canonicalize regions: remap labels in row-major order to 0,1,2... */
function canonicalRegions(regions) {
  const map = new Map();
  let next = 0;
  const result = [];
  for (const r of regions) {
    if (!map.has(r)) map.set(r, next++);
    result.push(map.get(r));
  }
  return result;
}

/** regionSignature: gameId:N:quota:canonical-region-grid */
function makeRegionSig(gameId, N, quota, regions) {
  const can = canonicalRegions(regions);
  return `${gameId}:${N}:${quota}:${can.join(',')}`;
}

/** Solution Jaccard: set intersection/union of star positions */
function solutionJaccard(solA, solB) {
  const sa = new Set(solA), sb = new Set(solB);
  let inter = 0;
  for (const v of sa) { if (sb.has(v)) inter++; }
  const union = new Set([...solA, ...solB]).size;
  return union === 0 ? 0 : inter / union;
}

/** Region pair Jaccard: same-region unordered cell pairs */
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

function regionAreas(regions, N) {
  const counts = {};
  for (const r of regions) { counts[r] = (counts[r] || 0) + 1; }
  return Object.values(counts);
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

function computeRecommendation(report) {
  const alerts = report.alerts || [];
  const solver = report.solver || {};
  if (!report || report.status === 'failed') return 'reject';
  if (solver.status !== 'unique') return 'reject';
  if (alerts.includes('invalid-declared-solution')) return 'reject';
  if (alerts.includes('identical-solution-and-regions')) return 'reject';
  if (alerts.includes('identical-solution')) return 'review';
  if (alerts.includes('high-solution-similarity')) return 'review';
  if (alerts.includes('high-region-similarity')) return 'review';
  if (alerts.includes('batch-duplicate')) return 'review';
  return 'keep';
}

// ── Analyze single candidate ──
function analyzeCandidate(candidate, formalLevels) {
  const report = {
    candidateId: candidate.candidateId,
    gameId: candidate.gameId,
    N: candidate.N,
    quota: candidate.starsPerRow,
    seed: candidate.seed,
    status: candidate.status,
  };

  if (candidate.status !== 'ok') {
    report.conclusion = 'reject';
    report.conclusionReason = 'candidate generation failed';
    return report;
  }

  const { N, regions, solution, gameId } = candidate;
  const quota = candidate.starsPerRow;

  // Solver re-verification
  const solverResult = solveStarLine(N, regions, {
    starsPerRow: quota, starsPerCol: quota, starsPerRegion: quota,
  });

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
  report.declaredSolutionSignature = solution ? makeSolutionSig(gameId, N, quota, solution) : null;
  const solvedSol = solverResult.status === 'UNIQUE' ? solverResult.solutions[0] : null;
  report.solvedSolutionSignature = solvedSol ? makeSolutionSig(gameId, N, quota, solvedSol) : null;

  if (solverResult.status === 'UNIQUE' && solvedSol && solution) {
    const declaredSet = new Set(solution), solvedSet = new Set(solvedSol);
    report.declaredSolutionMatchesSolver = declaredSet.size === solvedSet.size
      && [...declaredSet].every(v => solvedSet.has(v));
  } else {
    report.declaredSolutionMatchesSolver = null;
  }

  // Region metrics
  const areas = regionAreas(regions, N);
  report.regionMetrics = {
    regionCount: N,
    minRegionArea: Math.min(...areas),
    maxRegionArea: Math.max(...areas),
    meanRegionArea: mean(areas),
    regionAreaVariance: variance(areas),
    elongatedRegionRatio: elongatedRatio(regions, N),
    edgeRegionRatio: edgeRegionRatio(regions, N),
  };

  // Signatures
  report.solutionSignature = makeSolutionSig(gameId, N, quota, solvedSol || solution);
  report.regionsSignature = makeRegionSig(gameId, N, quota, regions);

  // Similarity
  report.similarity = { formal: [], batch: [] };
  report.alerts = [];

  // Solver-based alerts
  if (report.solver.status !== 'unique') {
    report.alerts.push(`solver-${report.solver.status}`);
  }
  if (report.declaredSolutionMatchesSolver === false) {
    report.alerts.push('invalid-declared-solution');
  }

  // Compare with formal levels
  if (formalLevels) {
    for (const fl of formalLevels) {
      if (fl.gameId !== gameId || fl.N !== N) continue;
      const flQuota = fl.starsPerRow ?? fl.starsPerCol ?? fl.starsPerRegion ?? 1;
      if (flQuota !== quota) continue;

      const solSim = solutionJaccard(solvedSol || solution, fl.solution);
      const regSim = regionPairJaccard(canonicalRegions(regions), canonicalRegions(fl.regions));
      const solIdentical = solSim === 1.0;
      const regIdentical = regSim === 1.0;

      const fs = { formalLevelId: fl.id, solutionJaccard: solSim, regionPairJaccard: regSim };
      if (solIdentical && regIdentical) fs.alert = 'identical-solution-and-regions';
      else if (solIdentical) fs.alert = 'identical-solution';
      else if (solSim >= SIMILARITY_THRESHOLD) fs.alert = 'high-solution-similarity';
      if (regIdentical && !solIdentical) fs.alert = fs.alert || 'identical-region-structure';
      if (regSim >= SIMILARITY_THRESHOLD && !regIdentical) fs.alert = fs.alert || 'high-region-similarity';

      report.similarity.formal.push(fs);
      if (fs.alert) report.alerts.push(fs.alert);
    }
  }

  return report;
}

// ── Batch similarity ──
function computeBatchSimilarity(reports) {
  for (let i = 0; i < reports.length; i++) {
    for (let j = i + 1; j < reports.length; j++) {
      const a = reports[i], b = reports[j];
      if (!a.solutionSignature || !b.solutionSignature) continue;
      if (a.gameId !== b.gameId || a.N !== b.N || a.quota !== b.quota) continue;
      if (a.solutionSignature === b.solutionSignature) {
        a.similarity.batch.push({ candidateId: b.candidateId, alert: 'batch-duplicate' });
        b.similarity.batch.push({ candidateId: a.candidateId, alert: 'batch-duplicate' });
        if (!a.alerts.includes('batch-duplicate')) a.alerts.push('batch-duplicate');
        if (!b.alerts.includes('batch-duplicate')) b.alerts.push('batch-duplicate');
      }
    }
  }
  // Recompute all recommendations after batch analysis
  for (const r of reports) {
    r.conclusion = computeRecommendation(r);
    r.conclusionReason = (r.alerts && r.alerts.length) ? r.alerts.join(', ') : 'unique solution, no alerts';
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
    // Try as a relative name within the candidate root
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
    if (!raw.complete && raw.complete === false) continue; // skip failed reports
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

  // Output to candidate dir
  const outBase = resolve(process.cwd(), 'tmp/star-line-candidates',
    basename(inputPath).replace(/\.json$/, '') + '-analysis');
  safeWriteJSON(outBase + '.json', result, { force });
  writeFileSync(outBase + '.md', generateMarkdown(result), 'utf-8');

  console.log(`JSON: ${outBase}.json`);
  console.log(`MD:   ${outBase}.md`);
  console.log(`Summary: ${reports.length} candidates | keep=${summary.keep} review=${summary.review} reject=${summary.reject}`);
}
main();
