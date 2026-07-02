/**
 * Portal Classic Candidate Generator v6 — 实用版。
 *
 * 使用项目内置 generator 生成 N=7 基路径，通过子序列移位插入 portal jump。
 * 只输出通过全部合法性 + 质量检查的高分候选。
 *
 * 用法：
 *   node scripts/generate-portal-classic-candidates.mjs [--portals 2|3] [--count 3] [--json] [--out <file>]
 *   npm run generate:portal-classic -- --portals 2 --count 3 --json --out /tmp/candidates.json
 */

import { writeFileSync } from 'fs';
import { createClassicLevel } from '../src/game/classic/createClassicLevel.js';
import { MOVEMENT_TYPES } from '../src/config/gameModes.js';
import {
  toCoord, isAdjacent,
  isDiagonal, hasPathCrossing,
  validatePath, validatePortals, suggestHiddenVals,
  analyzeDirections, countConsecutiveSameDir, countRowSweeps, countColSweeps,
  checkPortalNeighborConflicts, checkPortalClustering,
  renderBoard,
} from './portal-classic-candidate-core.mjs';

const MIN_PORTAL_STEP = 2;

// ── 从 grid 提取路径 ──

function extractPath(grid) {
  if (!grid) return null;
  const sorted = grid.map((c, i) => ({ i, v: c.val })).sort((a, b) => a.v - b.v);
  return sorted.map(x => x.i);
}

// ── 生成基路径（使用游戏内置 7×7 diagonal 生成） ──

function generateBasePaths(N, count) {
  const rules = {
    movement: MOVEMENT_TYPES.diagonal,
    path: { allowCrossing: false, requireSequential: true, requireFullBoard: true },
  };
  const paths = [];

  for (let idx = 0; idx < count * 3 && paths.length < count; idx++) {
    const result = createClassicLevel('medium', idx % 20, rules, 'diagonal');
    if (!result?.grid) continue;
    const gn = Math.round(Math.sqrt(result.grid.length));
    if (gn !== N) continue;

    const path = extractPath(result.grid);
    if (!path || path.length !== N * N) continue;
    if (new Set(path).size !== N * N) continue;

    let ok = true;
    for (let i = 1; i < path.length; i++) {
      if (isDiagonal(path[i - 1], path[i], N) &&
          hasPathCrossing(path.slice(0, i), path[i - 1], path[i], N)) {
        ok = false; break;
      }
    }
    if (ok) paths.push(path);
  }
  return paths;
}

// ── Portal 插入：子序列移位 ──

/**
 * 在 path 中选取 portal entry (a) 和 exit (b)，其中 a 和 b 在原始路径中间隔 >= 3 步。
 * 将 a 后面的子序列（直到 b 之前）移到路径末尾，使 a→b 在重排后连续。
 *
 * portalId: 此 portal 的 ID 字母 ('A', 'B', 'C'...)
 * existingCells: 已有的 portal cells（用于避免重叠）
 */
function tryInsertPortal(path, N, portalId, existingCells) {
  const boardSize = N * N;
  const results = [];
  const existing = new Set(existingCells || []);

  for (let dist = 3; dist <= Math.min(boardSize - 2, 30); dist += 2) {
    for (let i = 0; i < path.length - dist; i++) {
      if (i < MIN_PORTAL_STEP) continue;

      const a = path[i];
      const b = path[i + dist];

      if (existing.has(a) || existing.has(b)) continue;
      if (isAdjacent(a, b, N)) continue;

      const before = path.slice(0, i + 1);
      const middle = path.slice(i + 1, i + dist);
      const after = path.slice(i + dist + 1);
      const newPath = [...before, b, ...after, ...middle];

      if (newPath.length !== boardSize) continue;
      if (new Set(newPath).size !== boardSize) continue;

      const portals = [{ id: portalId, cells: [a, b] }];
      const pv = validatePortals(portals, N);
      if (!pv.valid) continue;

      const v = validatePath(newPath, portals, N);
      if (!v.valid) continue;

      const pn = checkPortalNeighborConflicts(newPath, portals, N);
      if (pn.length > 0) continue;

      results.push({ path: newPath, portals, jump: { from: a, to: b, dist } });
    }
  }

  return results;
}

/**
 * 在已有路径上追加一个 portal（保留已有 portals，用空格避让）。
 */
function tryAppendPortal(candidate, N, portalId) {
  const path = candidate.path;
  const existingCells = candidate.portals.flatMap(p => p.cells);
  const boardSize = N * N;
  const results = [];

  for (let dist = 3; dist <= Math.min(boardSize - 2, 30); dist += 2) {
    for (let i = 0; i < path.length - dist; i++) {
      if (i < MIN_PORTAL_STEP) continue;

      const a = path[i];
      const b = path[i + dist];

      if (existingCells.includes(a) || existingCells.includes(b)) continue;
      if (isAdjacent(a, b, N)) continue;

      const before = path.slice(0, i + 1);
      const middle = path.slice(i + 1, i + dist);
      const after = path.slice(i + dist + 1);
      const newPath = [...before, b, ...after, ...middle];

      if (newPath.length !== boardSize) continue;
      if (new Set(newPath).size !== boardSize) continue;

      const portals = [
        ...candidate.portals,
        { id: portalId, cells: [a, b] },
      ];

      // 校验 portals：id 不重复、cells 不重复、互不邻接
      const ids = new Set();
      let dupId = false;
      for (const p of portals) {
        if (ids.has(p.id)) { dupId = true; break; }
        ids.add(p.id);
      }
      if (dupId) continue;

      const pv = validatePortals(portals, N);
      if (!pv.valid) continue;

      const v = validatePath(newPath, portals, N);
      if (!v.valid) continue;

      const pn = checkPortalNeighborConflicts(newPath, portals, N);
      if (pn.length > 0) continue;

      const cluster = checkPortalClustering(portals, N);
      if (cluster.minDist < 3) continue;

      results.push({
        path: newPath,
        portals,
        jumps: [...(candidate.jumps || [candidate.jump]), { from: a, to: b, dist }].filter(Boolean),
      });
    }
  }
  return results;
}

// ── 反蛇形 & 评分（clamp 0–100） ──

function snakeCheck(path, N) {
  const dirs = analyzeDirections(path, N);
  return {
    snake: countConsecutiveSameDir(dirs) > 6 || countRowSweeps(dirs) > 10 || countColSweeps(dirs) > 25,
    maxRun: countConsecutiveSameDir(dirs),
    rowSw: countRowSweeps(dirs),
    colSw: countColSweeps(dirs),
  };
}

function score(path, portals, N) {
  const s = snakeCheck(path, N);
  const cluster = checkPortalClustering(portals, N);

  // 基础分 85，加分项上限 +15，总 clamp 到 0–100
  let sc = 85;
  if (s.maxRun > 5) sc -= (s.maxRun - 5) * 6;
  sc -= s.rowSw * 0.5 + s.colSw * 0.3;
  if (cluster.minDist >= 5) sc += 12;
  else if (cluster.minDist >= 4) sc += 6;
  if (cluster.minDist < 3) sc -= 20;

  return Math.min(100, Math.max(0, Math.round(sc)));
}

// ── 入口 ──

function portalCellsKey(portals) {
  return portals
    .map(p => [...p.cells].sort((a, b) => a - b).join('-'))
    .sort()
    .join('|');
}

function parseArgs(argv) {
  const cfg = { portalCount: 2, candidateCount: 3, jsonOutput: false, outFile: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--portals') cfg.portalCount = parseInt(argv[i + 1]) || 2;
    if (argv[i] === '--count') cfg.candidateCount = parseInt(argv[i + 1]) || 3;
    if (argv[i] === '--json') cfg.jsonOutput = true;
    if (argv[i] === '--out' && argv[i + 1]) cfg.outFile = argv[i + 1];
  }
  return cfg;
}

function main() {
  const cfg = parseArgs(process.argv.slice(2));
  const { portalCount, candidateCount, jsonOutput, outFile } = cfg;
  const N = 7;
  const boardSize = N * N;
  const basePaths = generateBasePaths(N, 20);

  if (basePaths.length === 0) {
    console.error('Failed to generate any base paths');
    process.exit(1);
  }

  const candidates = [];

  for (const basePath of basePaths) {
    // ── Step 1: 插入 portal A ──
    const onePortalCands = tryInsertPortal(basePath, N, 'A', []);

    if (portalCount === 1) {
      for (const c1 of onePortalCands) {
        if (!snakeCheck(c1.path, N).snake) {
          candidates.push({
            path: c1.path, portals: c1.portals,
            score: score(c1.path, c1.portals, N),
          });
        }
      }
      continue;
    }

    // ── Step 2: 插入 portal B ──
    for (const c1 of onePortalCands) {
      const twoPortalCands = tryAppendPortal(c1, N, 'B');
      if (portalCount === 2) {
        for (const c2 of twoPortalCands) {
          if (!snakeCheck(c2.path, N).snake) {
            candidates.push({
              path: c2.path, portals: c2.portals,
              score: score(c2.path, c2.portals, N),
            });
          }
        }
        continue;
      }

      // ── Step 3: 插入 portal C ──
      if (portalCount >= 3) {
        for (const c2 of twoPortalCands) {
          const threePortalCands = tryAppendPortal(c2, N, 'C');
          for (const c3 of threePortalCands) {
            if (!snakeCheck(c3.path, N).snake) {
              candidates.push({
                path: c3.path, portals: c3.portals,
                score: score(c3.path, c3.portals, N),
              });
            }
          }
        }
      }
    }
  }

  // ── 按 portalCount 严格筛选 ──
  const exactMatch = candidates.filter(c => c.portals.length === portalCount);

  // 去重 + 排序
  const seenPaths = new Set();
  const seenPortalCells = new Set();
  const unique = [];
  for (const c of exactMatch.sort((a, b) => b.score - a.score)) {
    const pathKey = c.path.join(',');
    const portalKey = portalCellsKey(c.portals);
    if (seenPaths.has(pathKey) || seenPortalCells.has(portalKey)) continue;
    seenPaths.add(pathKey);
    seenPortalCells.add(portalKey);
    unique.push(c);
  }
  const top = unique.slice(0, candidateCount);

  // 提示信息（到 stderr）
  if (top.length < candidateCount) {
    console.error(`Warning: requested ${candidateCount} candidates with ${portalCount} portals, only found ${top.length}.`);
  }

  // ── 构建输出 ──
  const output = top.map(c => {
    const s = snakeCheck(c.path, N);
    const vp = validatePath(c.path, c.portals, N);
    return {
      id: `portal-gen-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: '生成候选',
      N,
      targetSteps: boardSize - 1,
      path: c.path,
      portals: c.portals,
      hiddenVals: suggestHiddenVals(c.path, c.portals, N === 7 ? 8 : 6),
      _meta: {
        score: c.score,
        portalCount: c.portals.length,
        maxSameDirRun: s.maxRun,
        rowSweeps: s.rowSw,
        colSweeps: s.colSw,
        portalJumps: vp.portalJumps.map(j => ({ step: j.step, from: j.from, to: j.to })),
      },
    };
  });

  const jsonStr = JSON.stringify(output, null, 2);

  if (outFile) {
    writeFileSync(outFile, jsonStr, 'utf-8');
    console.error(`Wrote ${output.length} candidates to ${outFile}`);
  }

  if (jsonOutput) {
    // 纯 JSON 输出到 stdout
    console.log(jsonStr);
  } else {
    // 人类可读输出
    console.log(`Base paths: ${basePaths.length}  Candidates: ${top.length}  (portals=${portalCount})\n`);
    for (let i = 0; i < top.length; i++) {
      const c = top[i];
      const s = snakeCheck(c.path, N);
      const vp = validatePath(c.path, c.portals, N);
      console.log(`── #${i + 1} score=${c.score} maxRun=${s.maxRun} rowSw=${s.rowSw} colSw=${s.colSw}  portals=${c.portals.length}`);
      for (const j of vp.portalJumps) {
        const a = toCoord(j.from, N), b = toCoord(j.to, N);
        console.log(`  jump step ${j.step}: ${j.from}(${a.r},${a.c}) -> ${j.to}(${b.r},${b.c})`);
      }
      console.log();
      console.log(renderBoard(c.path, c.portals, N));
      console.log();
    }
  }
}

main();
