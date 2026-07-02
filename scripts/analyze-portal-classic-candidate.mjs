/**
 * Portal Classic Candidate Analyzer。
 *
 * 用法：
 *   node scripts/analyze-portal-classic-candidate.mjs < candidate.json
 *   或
 *   node scripts/analyze-portal-classic-candidate.mjs --file path/to/candidate.json
 *
 * 输入：单个候选 JSON 对象（含 path, portals, N 等），也可接受完整 portalLevels.js 条目格式。
 * 输出：详细分析报告（文本）。
 */

import { readFileSync } from 'fs';
import {
  toCoord,
  validatePath, validatePortals, suggestHiddenVals,
  analyzeDirections, countConsecutiveSameDir, countRowSweeps, countColSweeps,
  checkPortalNeighborConflicts, checkPortalClustering,
  analyzeRegionCoverage,
  renderBoard,
} from './portal-classic-candidate-core.mjs';

// ── 质量分析 ──

function analyze(candidate) {
  const N = candidate.N || 7;
  const boardSize = N * N;
  const path = candidate.path;
  const portals = candidate.portals || [];
  const targetSteps = candidate.targetSteps || (boardSize - 1);

  const report = { sections: [], issues: [], score: 100, rejectReasons: [] };

  function addSection(title, lines) {
    report.sections.push({ title, lines });
  }

  function addIssue(level, msg) {
    report.issues.push({ level, msg });
    if (level === 'error') report.rejectReasons.push(msg);
  }

  // ── 1. 基本数据 ──
  addSection('基本数据', [
    `N: ${N}  (${boardSize} 格)`,
    `targetSteps: ${targetSteps}`,
    `portals: ${portals.length} 组`,
    `path.length: ${path?.length || 0}`,
  ]);

  // ── 2. Portal 验证 ──
  const pv = validatePortals(portals, N);
  addSection('Portal 合法性', pv.errors.length === 0
    ? ['✓ 全部合法']
    : pv.errors.map(e => `✗ ${e}`));

  for (const e of pv.errors) addIssue('error', e);

  // ── 3. 路径验证 ──
  if (!path || path.length === 0) {
    addSection('路径验证', ['✗ path 为空']);
    addIssue('error', 'path is empty');
    report.score = 0;
    report.recommendation = 'AUTO_REJECT';
    return report;
  }

  const pathV = validatePath(path, portals, N);
  addSection('路径合法性', pathV.errors.length === 0
    ? ['✓ 全部合法']
    : pathV.errors.map(e => `✗ ${e}`));

  for (const e of pathV.errors) addIssue('error', e);

  if (path.length !== boardSize) {
    addIssue('error', `path.length=${path.length} != ${boardSize}`);
    report.score = 0;
    report.recommendation = 'AUTO_REJECT';
    return report;
  }

  // ── 4. Portal jump 详情 ──
  const jumpLines = [];
  if (pathV.portalJumps.length === 0) {
    jumpLines.push('(无 portal jump)');
  } else {
    for (const j of pathV.portalJumps) {
      const portal = portals.find(p =>
        (p.cells[0] === j.from && p.cells[1] === j.to) ||
        (p.cells[0] === j.to && p.cells[1] === j.from)
      );
      const a = toCoord(j.from, N), b = toCoord(j.to, N);
      const dr = Math.abs(a.r - b.r), dc = Math.abs(a.c - b.c);
      jumpLines.push(`Portal ${portal?.id || '?'}: step ${j.step}  ${j.from}(${a.r},${a.c}) -> ${j.to}(${b.r},${b.c})  dr=${dr} dc=${dc}`);
    }
  }
  addSection('Portal Jump 步骤', jumpLines);

  // ── 5. 方向分析 ──
  if (path.length >= 2) {
    const dirs = analyzeDirections(path, N);
    const maxRun = countConsecutiveSameDir(dirs);
    const rowSw = countRowSweeps(dirs);
    const colSw = countColSweeps(dirs);

    addSection('方向分析', [
      `连续同方向最大: ${maxRun}`,
      `行扫段数: ${rowSw}`,
      `列扫段数: ${colSw}`,
    ]);

    // 蛇形检测
    if (maxRun > 6) addIssue('warn', `max same-dir run=${maxRun} (>6), snake-like`);
    if (rowSw > 10) addIssue('warn', `row sweeps=${rowSw} (>10)`);
    if (colSw > 25) addIssue('warn', `col sweeps=${colSw} (>25)`);

    if (maxRun > 8) { report.score -= 20; report.rejectReasons.push(`excessive same-dir run: ${maxRun}`); }
    if (rowSw > 15) { report.score -= 15; report.rejectReasons.push(`excessive row sweeps: ${rowSw}`); }
    if (colSw > 30) { report.score -= 15; report.rejectReasons.push(`excessive col sweeps: ${colSw}`); }
  }

  // ── 6. Portal neighbor 冲突 ──
  const pnIssues = checkPortalNeighborConflicts(path, portals, N);
  addSection('Portal 邻位冲突检查',
    pnIssues.length === 0
      ? ['✓ 无相邻双 portal 候选']
      : pnIssues.map(i => `✗ ${i.message}`));

  for (const i of pnIssues) {
    addIssue('error', i.message);
    report.score -= 20;
  }

  // ── 7. Portal 聚集度 ──
  const cluster = checkPortalClustering(portals, N);
  addSection('Portal 空间分布', [
    `portal cell 最小棋盘距离: ${cluster.minDist}`,
    `portal cell 最大棋盘距离: ${cluster.maxDist}`,
    `portal cells: [${cluster.allCells.join(', ')}]`,
  ]);

  if (cluster.minDist <= 2) {
    addIssue('warn', `portal cells too close (min dist=${cluster.minDist})`);
    report.score -= 10;
  }
  if (cluster.minDist >= 5) report.score += 10;

  // ── 8. HiddenVals 建议 ──
  const count = N === 7 ? 8 : (N === 5 ? 4 : 10);
  const hv = suggestHiddenVals(path, portals, count);
  addSection('HiddenVals 建议', [
    `推荐 ${count} 个: [${hv.join(', ')}]`,
    '(已排除 portal cell 对应路径数字)',
  ]);

  // ── 9. 区域覆盖 ──
  const regions = analyzeRegionCoverage(path, N);
  const regionLines = regions.map(r =>
    `zone ${r.zone}: ${r.total} cells, first visit at step ${r.firstVisit}, last at ${r.lastVisit}`
  );
  // 检测是否所有区域跨度分散
  const spans = regions.map(r => r.lastVisit - r.firstVisit);
  const avgSpan = spans.reduce((a, b) => a + b, 0) / spans.length;
  regionLines.push(`平均区域跨度: ${Math.round(avgSpan)} 步`);
  addSection('区域覆盖分布 (3×3 分区)', regionLines);

  // ── 10. 路径分段摘要 ──
  const segmentSummary = [];
  let segStart = 0;
  for (let i = 1; i < path.length - 1; i++) {
    const ca = toCoord(path[i - 1], N), cb = toCoord(path[i], N), cc = toCoord(path[i + 1], N);
    const dr1 = cb.r - ca.r, dc1 = cb.c - ca.c;
    const dr2 = cc.r - cb.r, dc2 = cc.c - cb.c;
    if (dr1 !== dr2 || dc1 !== dc2) {
      segmentSummary.push(`steps ${segStart}-${i}: ${i - segStart + 1} cells, dir (${dr1},${dc1})`);
      segStart = i;
    }
  }
  segmentSummary.push(`steps ${segStart}-${path.length - 1}: ${path.length - segStart} cells`);
  addSection('路径分段', segmentSummary.slice(0, 20)); // 最多显示 20 段

  // ── 11. ASCII 棋盘 ──
  addSection('棋盘视图', [renderBoard(path, portals, N)]);

  // ── 12. 可复制对象 ──
  const exportObj = {
    id: candidate.id || 'portal-candidate',
    name: candidate.name || '候选关卡',
    N,
    targetSteps,
    path,
    portals,
    hiddenVals: hv,
  };
  addSection('可复制对象 (portalLevels.js 格式)', [
    JSON.stringify(exportObj, null, 2),
  ]);

  // ── 分数 clamp 0–100 ──
  report.score = Math.min(100, Math.max(0, report.score));

  // ── 最终推荐 ──
  const totalErrors = report.issues.filter(i => i.level === 'error').length;
  if (totalErrors > 0) {
    report.recommendation = 'AUTO_REJECT';
  } else if (report.score >= 70) {
    report.recommendation = 'RECOMMENDED';
  } else if (report.score >= 50) {
    report.recommendation = 'REVIEW';
  } else {
    report.recommendation = 'AUTO_REJECT';
  }

  report.rejectReasons = [...new Set(report.rejectReasons)];

  return report;
}

// ── 格式化输出 ──

function printReport(report) {
  console.log('═══════════════════════════════════════');
  console.log(' Portal Classic Candidate Analysis');
  console.log('═══════════════════════════════════════\n');

  for (const section of report.sections) {
    console.log(`── ${section.title} ──`);
    for (const line of section.lines) {
      console.log(`  ${line}`);
    }
    console.log();
  }

  console.log('── 质量问题 ──');
  if (report.issues.length === 0) {
    console.log('  (无)');
  } else {
    for (const issue of report.issues) {
      const icon = issue.level === 'error' ? '✗' : '⚠';
      console.log(`  ${icon} ${issue.msg}`);
    }
  }
  console.log();

  console.log('── 最终评估 ──');
  console.log(`  qualityScore: ${report.score}`);
  console.log(`  recommendation: ${report.recommendation}`);
  if (report.rejectReasons.length > 0) {
    console.log(`  rejectReasons:`);
    for (const r of report.rejectReasons) console.log(`    - ${r}`);
  }
  console.log();
}

// ── 入口 ──

function main() {
  const args = process.argv.slice(2);
  let input;

  if (args.includes('--file')) {
    const idx = args.indexOf('--file');
    const filePath = args[idx + 1];
    if (!filePath) { console.error('Missing file path after --file'); process.exit(1); }
    try {
      input = JSON.parse(readFileSync(filePath, 'utf-8'));
      if (Array.isArray(input)) input = input[0];
    } catch (e) {
      console.error(`Failed to read/parse file: ${e.message}`);
      process.exit(1);
    }
  } else {
    // 从 stdin 读取
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => {
      try {
        input = JSON.parse(data);
        if (Array.isArray(input)) input = input[0];
      } catch (e) {
        console.error(`Failed to parse stdin: ${e.message}`);
        process.exit(1);
      }
      const report = analyze(input);
      printReport(report);

      if (report.recommendation === 'AUTO_REJECT') process.exit(1);
    });
    return;
  }

  const report = analyze(input);
  printReport(report);

  if (report.recommendation === 'AUTO_REJECT') process.exit(1);
}

main();
