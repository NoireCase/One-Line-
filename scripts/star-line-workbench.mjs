#!/usr/bin/env node
/**
 * Star Line 开发侧关卡工作台 (Package 2D.1)。
 *
 * 仅开发环境命令行使用：位于 scripts/ 下，不进入 Vite bundle，
 * 不接入正式玩家 UI，不读写玩家存档（浏览器本地存储）。
 * 会话与导出文件全部限制在 tmp/star-line-candidates/ 内。
 *
 * 用法:
 *   node scripts/star-line-workbench.mjs import --level star-lv-31 --session work.json [--force]
 *   node scripts/star-line-workbench.mjs import --candidate <file> [--id <candidateId>] --session work.json [--force]
 *   node scripts/star-line-workbench.mjs edit --session work.json --set 3,4=2 --set 97=5
 *   node scripts/star-line-workbench.mjs inspect --session work.json [--json]
 *   node scripts/star-line-workbench.mjs export --session work.json --output my-template.json [--force]
 *
 * inspect 输出：
 *   覆盖/连通检查、Solver 状态 (NO_SOLUTION/MULTIPLE/UNIQUE)、declared solution、
 *   与全部正式单星关卡的最高 D4 相似度及对应关卡、最小区域面积/数量/象限、开局指纹。
 *
 * export 输出 generator 可读取的模板 JSON（kind: 'star-line-template'），
 * 可被 generate-star-line-candidates.mjs 的 loadExternalTemplateFile 验证读取。
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { solveStarLine } from './starLineSolver.mjs';
import { resolveCandidatePath, safeWriteJSON } from './lib/star-line-candidate-io.mjs';
import { STAR_LINE_LEVELS } from '../src/data/starLineLevels.js';
import {
  canonicalRegionsSimple,
  canonicalizeRegions,
  d4AlignedRegionJaccard,
} from './star-line-candidate-signatures.mjs';
import { computeOpeningFingerprint } from './star-line-fingerprint.mjs';
import { validateRegions } from './star-line-macro-mutations.mjs';

const SESSION_KIND = 'star-line-workbench-session';
const TEMPLATE_KIND = 'star-line-template';

// ── CLI 解析（--set 支持多次出现） ──

function parseArgs(argv) {
  const p = { _: [], set: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { p._.push(a); continue; }
    const k = a.replace(/^--/, '');
    if (k === 'force' || k === 'json') { p[k] = true; continue; }
    const v = argv[i + 1];
    if (v === undefined) fail(`参数 --${k} 缺少值`);
    if (k === 'set') p.set.push(v);
    else p[k] = v;
    i++;
  }
  return p;
}

function fail(msg) {
  console.error(`[workbench] ${msg}`);
  process.exit(1);
}

function usage() {
  console.log(`用法:
  node scripts/star-line-workbench.mjs import --level <levelId> --session <name.json> [--force]
  node scripts/star-line-workbench.mjs import --candidate <file> [--id <candidateId>] --session <name.json> [--force]
  node scripts/star-line-workbench.mjs edit --session <name.json> --set <r,c=rid | idx=rid> [--set ...]
  node scripts/star-line-workbench.mjs inspect --session <name.json> [--json]
  node scripts/star-line-workbench.mjs export --session <name.json> --output <name.json> [--force]`);
  process.exit(1);
}

// ── 会话 I/O（限制在候选目录 workbench/ 子目录内） ──

function sessionPath(name) {
  if (!name) fail('--session 不能为空');
  if (name.includes('/') || name.includes('..')) fail('--session 只能是文件名');
  return resolveCandidatePath(`workbench/${name}`);
}

function loadSession(name) {
  const path = sessionPath(name);
  if (!existsSync(path)) fail(`会话不存在: ${path}（先运行 import）`);
  const raw = JSON.parse(readFileSync(path, 'utf-8'));
  if (raw.kind !== SESSION_KIND) fail(`不是工作台会话文件: ${path}`);
  return { path, session: raw };
}

function saveSession(name, session, { force = false } = {}) {
  const path = sessionPath(name);
  safeWriteJSON(path, session, { force });
  return path;
}

// ── 网格渲染 ──

function renderGrid(N, regions, stars = []) {
  const starSet = new Set(stars);
  const lines = [];
  const header = '    ' + Array.from({ length: N }, (_, c) => String(c).padStart(2)).join('');
  lines.push(header);
  for (let r = 0; r < N; r++) {
    let row = String(r).padStart(2) + '  ';
    for (let c = 0; c < N; c++) {
      const idx = r * N + c;
      const ch = regions[idx] >= 0 && regions[idx] < 36 ? regions[idx].toString(36) : '?';
      row += ' ' + (starSet.has(idx) ? ch.toUpperCase() + '*' : ch + ' ').slice(0, 2);
    }
    lines.push(row);
  }
  lines.push('   （字母=region，大写*=declared star）');
  return lines.join('\n');
}

// ── import ──

function cmdImport(args) {
  if (!args.session) usage();
  let source, gameId, N, quota, regions, declaredSolution;

  if (args.level) {
    const level = STAR_LINE_LEVELS.find((l) => l.id === args.level);
    if (!level) fail(`正式关卡不存在: ${args.level}`);
    source = { type: 'level', ref: level.id };
    gameId = level.gameId;
    N = level.N;
    quota = level.starsPerRow ?? level.starsPerCol ?? level.starsPerRegion ?? 1;
    regions = [...level.regions];
    declaredSolution = [...level.solution];
  } else if (args.candidate) {
    const filePath = resolve(args.candidate);
    if (!existsSync(filePath)) fail(`候选文件不存在: ${filePath}`);
    const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
    const cands = raw.candidates || [raw];
    const cand = args.id ? cands.find((c) => c.candidateId === args.id) : cands[0];
    if (!cand) fail(`候选不存在: ${args.id ?? '(first)'} in ${filePath}`);
    source = { type: 'candidate', ref: cand.candidateId ?? filePath };
    gameId = cand.gameId ?? 'starSingle';
    N = cand.N;
    quota = cand.starsPerRow ?? cand.starsPerCol ?? cand.starsPerRegion ?? 1;
    regions = [...cand.regions];
    declaredSolution = Array.isArray(cand.solution) ? [...cand.solution] : null;
  } else {
    usage();
  }

  const session = {
    kind: SESSION_KIND,
    formatVersion: 1,
    source,
    gameId,
    N,
    quota,
    regions,
    declaredSolution,
  };
  const path = saveSession(args.session, session, { force: !!args.force });
  console.log(`已导入 ${source.type}:${source.ref} → ${path}`);
  console.log(renderGrid(N, regions, declaredSolution ?? []));
}

// ── edit ──

function parseSetDirective(directive, N) {
  const m = directive.match(/^(\d+)(?:,(\d+))?=(\d+)$/);
  if (!m) fail(`--set 格式错误: ${directive}（应为 r,c=rid 或 idx=rid）`);
  const rid = parseInt(m[3], 10);
  let idx;
  if (m[2] !== undefined) {
    const r = parseInt(m[1], 10), c = parseInt(m[2], 10);
    if (r < 0 || r >= N || c < 0 || c >= N) fail(`--set 坐标越界: ${directive}`);
    idx = r * N + c;
  } else {
    idx = parseInt(m[1], 10);
    if (idx < 0 || idx >= N * N) fail(`--set 下标越界: ${directive}`);
  }
  if (rid < 0 || rid >= N) fail(`--set region 越界: ${directive}（region 必须在 0..${N - 1}）`);
  return { idx, rid };
}

function cmdEdit(args) {
  if (!args.session || args.set.length === 0) usage();
  const { session } = loadSession(args.session);
  const N = session.N;
  for (const directive of args.set) {
    const { idx, rid } = parseSetDirective(directive, N);
    session.regions[idx] = rid;
  }
  saveSession(args.session, session, { force: true });
  console.log(`已应用 ${args.set.length} 处修改 → ${args.session}`);
  console.log(renderGrid(N, session.regions, session.declaredSolution ?? []));
  const err = validateRegions(session.regions, N);
  if (err) console.log(`⚠ 当前区域不合法: ${err}（inspect 查看详情）`);
}

// ── inspect ──

export function inspectBoard({ N, quota, gameId, regions, declaredSolution }) {
  const result = {
    N,
    quota,
    gameId,
    coverage: null,
    solver: null,
    declaredSolution: declaredSolution ?? null,
    declaredSolutionMatchesSolver: null,
    catalog: { compared: 0, maxD4Similarity: null, closestLevelId: null, top: [] },
    minRegion: null,
    openingFingerprint: null,
  };

  // 覆盖 + 连通
  const err = validateRegions(regions, N);
  result.coverage = { valid: err === null, error: err };

  // Solver
  let solvedSolution = null;
  try {
    const sr = solveStarLine(N, regions, { starsPerRow: quota, starsPerCol: quota, starsPerRegion: quota });
    result.solver = { status: sr.status, solutionCount: sr.solutions?.length ?? 0 };
    if (sr.status === 'UNIQUE') solvedSolution = sr.solutions[0];
  } catch (e) {
    result.solver = { status: 'ERROR', error: e.message };
  }

  // declared solution vs solver
  if (Array.isArray(declaredSolution) && solvedSolution) {
    const a = new Set(declaredSolution), b = new Set(solvedSolution);
    result.declaredSolutionMatchesSolver = a.size === b.size && [...a].every((v) => b.has(v));
  }

  // 与全部正式单星关卡比较（同 N）
  const singles = STAR_LINE_LEVELS.filter((l) => l.gameId === 'starSingle' && l.N === N);
  const sims = [];
  for (const fl of singles) {
    const sim = d4AlignedRegionJaccard(canonicalRegionsSimple(regions), canonicalRegionsSimple(fl.regions), N);
    sims.push({ levelId: fl.id, d4Similarity: sim });
  }
  sims.sort((a, b) => b.d4Similarity - a.d4Similarity);
  result.catalog = {
    compared: sims.length,
    maxD4Similarity: sims.length ? sims[0].d4Similarity : null,
    closestLevelId: sims.length ? sims[0].levelId : null,
    top: sims.slice(0, 3),
  };

  // 最小区域 + 开局指纹
  const fp = computeOpeningFingerprint(N, regions, quota);
  result.minRegion = {
    area: fp.minRegionArea,
    count: fp.minRegionCount,
    quadrants: fp.minRegionQuadrants,
  };
  result.openingFingerprint = fp;

  return result;
}

function cmdInspect(args) {
  if (!args.session) usage();
  const { session } = loadSession(args.session);
  const report = inspectBoard(session);

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(renderGrid(session.N, session.regions, session.declaredSolution ?? []));
  console.log('');
  console.log(`覆盖/连通: ${report.coverage.valid ? 'OK' : `INVALID — ${report.coverage.error}`}`);
  console.log(`Solver: ${report.solver.status}`);
  console.log(`declared solution: ${report.declaredSolution ? `[${report.declaredSolution.join(', ')}]` : '—'}`);
  console.log(`declared 与 Solver 一致: ${report.declaredSolutionMatchesSolver ?? '—'}`);
  if (report.catalog.compared > 0) {
    console.log(`全单星目录最高 D4 相似度: ${report.catalog.maxD4Similarity.toFixed(3)} → ${report.catalog.closestLevelId}（共比对 ${report.catalog.compared} 关）`);
    for (const t of report.catalog.top) console.log(`  · ${t.levelId}: ${t.d4Similarity.toFixed(3)}`);
  } else {
    console.log(`全单星目录: 无同尺寸 (${session.N}×${session.N}) 正式单星关卡`);
  }
  console.log(`最小区域: 面积 ${report.minRegion.area} × ${report.minRegion.count} 个 @ ${report.minRegion.quadrants.join(',')}`);
  console.log(`初始强制步: [${report.openingFingerprint.initialForcedStars.join(', ') || '—'}]`);
  console.log(`开局指纹: ${report.openingFingerprint.fingerprint}`);
}

// ── export ──

function cmdExport(args) {
  if (!args.session || !args.output) usage();
  const { session } = loadSession(args.session);
  const { N, quota } = session;

  // 导出前必须通过覆盖/连通 + UNIQUE 验证
  const err = validateRegions(session.regions, N);
  if (err) fail(`导出被拒绝：区域不合法 — ${err}`);
  const sr = solveStarLine(N, session.regions, { starsPerRow: quota, starsPerCol: quota, starsPerRegion: quota });
  if (sr.status !== 'UNIQUE') fail(`导出被拒绝：Solver 状态为 ${sr.status}，要求 UNIQUE`);

  // 规范 label 到 0..N-1（generator 模板格式要求）
  const canonicalRegions = canonicalRegionsSimple(session.regions);
  const canonicalSr = solveStarLine(N, canonicalRegions, { starsPerRow: quota, starsPerCol: quota, starsPerRegion: quota });

  const template = {
    kind: TEMPLATE_KIND,
    formatVersion: 1,
    N,
    quota,
    regions: canonicalRegions,
    solution: canonicalSr.solutions[0],
    canonicalSignature: canonicalizeRegions(canonicalRegions, N),
    openingFingerprint: computeOpeningFingerprint(N, canonicalRegions, quota).fingerprint,
    source: session.source,
  };
  const outputPath = resolveCandidatePath(args.output);
  safeWriteJSON(outputPath, template, { force: !!args.force });
  console.log(`已导出模板 → ${outputPath}`);
  console.log(`Solver: UNIQUE | 指纹: ${template.openingFingerprint}`);
}

// ── main ──

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  if (cmd === 'import') return cmdImport(args);
  if (cmd === 'edit') return cmdEdit(args);
  if (cmd === 'inspect') return cmdInspect(args);
  if (cmd === 'export') return cmdExport(args);
  usage();
}

const __filename = import.meta.url.replace('file://', '');
if (process.argv[1] === __filename) {
  main();
}
