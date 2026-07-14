#!/usr/bin/env node
/**
 * Star Line 候选关卡分析器。
 *
 * 用法:
 *   node scripts/analyze-star-line-candidates.mjs --input tmp/star-line-candidates/single-5x5.json [--compare]
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'fs';
import { resolve, basename, join } from 'path';
import { solveStarLine } from './starLineSolver.mjs';
import { STAR_LINE_LEVELS } from '../src/data/starLineLevels.js';

// ── CLI ──
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--?/, '');
    parsed[key] = args[i + 1];
  }
  return parsed;
}

// ── Helpers ──
function mean(arr) { return arr.reduce((s, v) => s + v, 0) / arr.length; }
function variance(arr) { const m = mean(arr); return arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length; }

function solutionSignature(sol) { return [...sol].sort((a, b) => a - b).join(','); }

function regionsSignature(regions) { return regions.join(','); }

function solutionSimilarity(solA, solB) {
  const setA = new Set(solA), setB = new Set(solB);
  let intersection = 0;
  for (const v of setA) { if (setB.has(v)) intersection++; }
  const union = new Set([...solA, ...solB]).size;
  return union === 0 ? 0 : intersection / union;
}

function regionsJaccard(regA, regB) {
  if (regA.length !== regB.length) return 0;
  let same = 0;
  for (let i = 0; i < regA.length; i++) { if (regA[i] === regB[i]) same++; }
  return same / regA.length;
}

function regionAreas(regions, N) {
  const counts = {};
  for (const r of regions) { counts[r] = (counts[r] || 0) + 1; }
  return Object.values(counts);
}

function elongatedRatio(regions, N, areas) {
  // 细长区域: 面积 >= 1.5 * floor(sqrt(area)) 且连通的区域视为细长
  const total = N * N;
  const seen = new Set();
  const regionCells = {};
  for (let i = 0; i < total; i++) {
    const rid = regions[i];
    if (!regionCells[rid]) regionCells[rid] = [];
    regionCells[rid].push(i);
  }
  let elongated = 0;
  for (const rid of Object.keys(regionCells)) {
    const cells = regionCells[rid];
    const area = cells.length;
    // Bounding box aspect ratio
    const rows = new Set(), cols = new Set();
    for (const c of cells) { rows.add(Math.floor(c / N)); cols.add(c % N); }
    const bbArea = rows.size * cols.size;
    if (bbArea >= area * 2.5) elongated++;
  }
  return elongated / N;
}

function edgeRegionRatio(regions, N) {
  const total = N * N;
  const edgeSet = new Set();
  for (let i = 0; i < total; i++) {
    const r = Math.floor(i / N), c = i % N;
    if (r === 0 || r === N - 1 || c === 0 || c === N - 1) edgeSet.add(regions[i]);
  }
  return edgeSet.size / N;
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
    report.error = 'candidate generation failed';
    report.conclusion = 'reject';
    return report;
  }

  const { N, regions, solution } = candidate;
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

  // Region metrics
  const areas = regionAreas(regions, N);
  report.regionMetrics = {
    regionCount: N,
    minRegionArea: Math.min(...areas),
    maxRegionArea: Math.max(...areas),
    meanRegionArea: mean(areas),
    regionAreaVariance: variance(areas),
    elongatedRegionRatio: elongatedRatio(regions, N, areas),
    edgeRegionRatio: edgeRegionRatio(regions, N),
  };

  // Signatures
  report.solutionSignature = solutionSignature(solution);
  report.regionsSignature = regionsSignature(regions);

  // Similarity with formal levels
  report.similarity = { formal: [], batch: [] };

  if (formalLevels) {
    for (const fl of formalLevels) {
      if (fl.gameId !== candidate.gameId || fl.N !== N) continue;

      const solSim = solutionSimilarity(solution, fl.solution);
      const regSim = regionsJaccard(regions, fl.regions);
      const solIdentical = solSim === 1.0;
      const regIdentical = regSim === 1.0;

      const formalSim = {
        formalLevelId: fl.id,
        solutionSimilarity: solSim,
        regionsSimilarity: regSim,
      };

      if (solIdentical && regIdentical) {
        formalSim.alert = 'identical-solution-and-regions';
      } else if (solIdentical) {
        formalSim.alert = 'identical-solution';
      } else if (solSim >= 0.8) {
        formalSim.alert = 'high-solution-similarity';
      }
      if (regIdentical && !solIdentical) {
        formalSim.alert = formalSim.alert || 'identical-region-structure';
      }

      report.similarity.formal.push(formalSim);
    }
  }

  // Conclusion
  const alerts = (report.similarity.formal || []).filter(s => s.alert).map(s => s.alert);
  if (report.solver.status !== 'unique') {
    report.conclusion = 'reject';
    report.conclusionReason = `solver status: ${report.solver.status}`;
  } else if (alerts.some(a => a.includes('identical-solution-and-regions'))) {
    report.conclusion = 'reject';
    report.conclusionReason = 'identical solution and regions to existing formal level';
  } else if (alerts.some(a => a.includes('identical-solution'))) {
    report.conclusion = 'review';
    report.conclusionReason = 'identical solution layout to existing formal level';
  } else if (alerts.length > 0) {
    report.conclusion = 'review';
    report.conclusionReason = `alerts: ${alerts.join(', ')}`;
  } else {
    report.conclusion = 'keep';
    report.conclusionReason = 'unique solution, no similarity alerts';
  }

  report.alerts = alerts;

  return report;
}

// ── Batch similarity ──
function computeBatchSimilarity(reports) {
  const ok = reports.filter(r => r.status === 'ok' || r.solutionSignature);
  for (let i = 0; i < ok.length; i++) {
    for (let j = i + 1; j < ok.length; j++) {
      const a = ok[i], b = ok[j];
      if (!a.solutionSignature || !b.solutionSignature) continue;
      if (a.solutionSignature === b.solutionSignature) {
        a.similarity.batch.push({ candidateId: b.candidateId, alert: 'identical-solution' });
        b.similarity.batch.push({ candidateId: a.candidateId, alert: 'identical-solution' });
      }
      if (a.regionsSignature === b.regionsSignature) {
        a.similarity.batch.push({ candidateId: b.candidateId, alert: 'identical-region-structure' });
        b.similarity.batch.push({ candidateId: a.candidateId, alert: 'identical-region-structure' });
      }
    }
  }
}

// ── Generate markdown report ──
function generateMarkdown(analysisResult) {
  const lines = [];
  lines.push('# Star Line Candidate Analysis Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Input: ${analysisResult.input}`);
  lines.push(`Total candidates: ${analysisResult.candidates.length}`);
  lines.push(`Conclusion counts: ${JSON.stringify(analysisResult.summary)}`);
  lines.push('');

  for (const report of analysisResult.candidates) {
    lines.push(`## ${report.candidateId}`);
    lines.push('');
    lines.push(`- **gameId**: ${report.gameId}`);
    lines.push(`- **N**: ${report.N}×${report.N}`);
    lines.push(`- **quota**: ${report.quota}`);
    lines.push(`- **conclusion**: **${report.conclusion}**`);
    if (report.conclusionReason) lines.push(`- **reason**: ${report.conclusionReason}`);
    if (report.alerts?.length) lines.push(`- **alerts**: ${report.alerts.join(', ')}`);

    if (report.solver) {
      lines.push(`- **solver**: ${report.solver.status}, ${report.solver.solutionCount} solutions, ${report.solver.durationMs}ms, ${report.solver.backtracks} backtracks`);
    }
    if (report.regionMetrics) {
      lines.push(`- **regions**: areas ${report.regionMetrics.minRegionArea}-${report.regionMetrics.maxRegionArea} (mean ${report.regionMetrics.meanRegionArea.toFixed(1)}), elongated ${(report.regionMetrics.elongatedRegionRatio * 100).toFixed(0)}%, edge ${(report.regionMetrics.edgeRegionRatio * 100).toFixed(0)}%`);
    }
    if (report.similarity?.formal?.length) {
      const alerts = report.similarity.formal.filter(s => s.alert);
      if (alerts.length) {
        lines.push(`- **formal similarity alerts**: ${alerts.map(s => `${s.formalLevelId}: ${s.alert}`).join(', ')}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ── Main ──
function main() {
  const args = parseArgs();
  if (!args.input) {
    console.error('用法: node scripts/analyze-star-line-candidates.mjs --input <path> [--compare]');
    process.exit(1);
  }

  const inputPath = resolve(args.input);
  const isDir = existsSync(inputPath) && statSync(inputPath).isDirectory();
  const doCompare = args.compare !== undefined;

  // Load formal levels for comparison
  let formalLevels = null;
  if (doCompare) {
    formalLevels = STAR_LINE_LEVELS.slice(0, 30); // Only compare with published 30
  }

  // Gather candidate files
  const files = [];
  if (isDir) {
    for (const f of readdirSync(inputPath)) {
      if (f.endsWith('.json')) files.push(join(inputPath, f));
    }
  } else if (inputPath.endsWith('.json')) {
    files.push(inputPath);
  } else {
    console.error('--input 必须是 JSON 文件或包含 JSON 文件的目录');
    process.exit(1);
  }

  const allCandidates = [];
  for (const file of files) {
    const raw = JSON.parse(readFileSync(file, 'utf-8'));
    const cands = raw.candidates || [raw];
    for (const c of cands) {
      c._sourceFile = basename(file);
      allCandidates.push(c);
    }
  }

  const reports = allCandidates.map(c => analyzeCandidate(c, formalLevels));
  computeBatchSimilarity(reports);

  const summary = { keep: 0, review: 0, reject: 0, error: 0 };
  for (const r of reports) {
    if (r.conclusion === 'keep') summary.keep++;
    else if (r.conclusion === 'review') summary.review++;
    else if (r.conclusion === 'reject') summary.reject++;
    else summary.error++;
  }

  const analysisResult = {
    generatedAt: new Date().toISOString(),
    input: inputPath,
    candidates: reports,
    summary,
  };

  // Output JSON
  const jsonPath = inputPath.replace(/\.json$/, '') + '-analysis.json';
  writeFileSync(jsonPath, JSON.stringify(analysisResult, null, 2), 'utf-8');
  console.log(`JSON report: ${jsonPath}`);

  // Output Markdown
  const mdPath = inputPath.replace(/\.json$/, '') + '-analysis.md';
  writeFileSync(mdPath, generateMarkdown(analysisResult), 'utf-8');
  console.log(`Markdown report: ${mdPath}`);

  // Terminal summary
  console.log(`\nSummary: ${reports.length} candidates`);
  console.log(`  keep:   ${summary.keep}`);
  console.log(`  review: ${summary.review}`);
  console.log(`  reject: ${summary.reject}`);
}

main();
