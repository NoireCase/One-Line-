/**
 * Portal Classic Candidate Generator v6。
 *
 * 使用项目内置 diagonal 模式 generator 生成基路径，通过子序列移位插入 portal jump。
 * 只输出通过全部合法性 + 质量检查的高分候选。
 * 不写入正式关卡数据。
 *
 * 参数：
 *   --size 5|7           棋盘尺寸（默认 7）
 *   --portals 1|2|3      portal 数量（N=5 支持 1-2，N=7 支持 2-3）
 *   --count N            输出候选数（默认 3）
 *   --json               JSON 输出到 stdout
 *   --out <file>         纯 JSON 写入指定文件
 *
 * 用法：
 *   node scripts/generate-portal-classic-candidates.mjs --size 5 --portals 1 --count 10 --json
 *   node scripts/generate-portal-classic-candidates.mjs --size 7 --portals 2 --count 5 --json --out /tmp/candidates.json
 *   npm run generate:portal-classic -- --size 5 --portals 1 --count 10 --json
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

// ── Rhythm presets ──
const RHYTHM_PRESETS = {
  'late-balanced': {
    label: 'late-balanced',
    description: '7×7 3-portal: firstPortal≥12, s2>20, s3≥36',
    minSize: 7, maxSize: 7, portalCount: 3,
    windows: [
      { id: 'A', min: 12, max: 22 },
      { id: 'B', min: 24, max: 34 },
      { id: 'C', min: 36, max: 46 },
    ],
    constraints: {
      firstPortalMin: 12, noPairInFirst20: true,
      latePortalMin: 36, notAllBefore34: true,
      first12MaxSameRun: 3, first12MaxLinearSpan: 4,
    },
  },
  'spatial-scatter': {
    label: 'spatial-scatter',
    description: '7×7 3-portal: spatial quality over timing. Modeled on Lv13.',
    minSize: 7, maxSize: 7, portalCount: 3,
    windows: null,
    constraints: {
      allDistMin: 5, oneDistMin: 8, maxRun: 4,
      rowSwMax: 1, colSwMax: 1,
      first12MinRows: 3, first12MinCols: 3, first12MinZones: 3,
      first12MaxSameRun: 4, minZoneDirections: 2,
      noMechanicalRhythm: true, mechanicalMaxInterval: 6,
    },
  },
  'spatial-scatter-plus': {
    label: 'spatial-scatter-plus',
    description: '7×7 3-portal: spatial-scatter + mid/late presence. Modeled on Lv19.',
    minSize: 7, maxSize: 7, portalCount: 3,
    windows: null,
    constraints: {
      allDistMin: 5, oneDistMin: 8, maxRun: 4,
      rowSwMax: 1, colSwMax: 1,
      first12MinRows: 3, first12MinCols: 3, first12MinZones: 3,
      first12MaxSameRun: 4, minZoneDirections: 2,
      noMechanicalRhythm: true, mechanicalMaxInterval: 6,
      // Plus: mid/late portal presence
      onePortalMinStep: 21,   // at least one portal at step >= 21 (relaxed from 24)
      preferStep28: true,     // bonus for step >= 28
      rejectAllBefore18: true, // if all < 18, hard reject
    },
  },
};

// ── First-12 exposure check ──
function checkFirst12Exposure(path, N) {
  const dirs = [];
  for (let i = 1; i < 12; i++) {
    const a = toCoord(path[i-1], N), b = toCoord(path[i], N);
    dirs.push({ dr: b.r-a.r, dc: b.c-a.c });
  }
  let maxSame = 1, same = 1;
  for (let i = 1; i < dirs.length; i++) {
    if (dirs[i].dr===dirs[i-1].dr && dirs[i].dc===dirs[i-1].dc) { same++; maxSame=Math.max(maxSame,same); }
    else same = 1;
  }
  const rSet = new Set(), cSet = new Set();
  for (let i = 0; i < 12; i++) { const {r,c}=toCoord(path[i],N); rSet.add(r); cSet.add(c); }
  const issues = [];
  if (maxSame >= 4) issues.push(`maxSameRun=${maxSame}`);
  if (rSet.size <= 2) issues.push(`linearRow(r=${rSet.size})`);
  if (cSet.size <= 2) issues.push(`linearCol(c=${cSet.size})`);
  return { exposed: issues.length > 0, issues, maxSame, rSpan: rSet.size, cSpan: cSet.size };
}

// ── Rhythm analysis ──
function analyzePortalRhythm(jumps) {
  const steps = jumps.map(j => j.step).sort((a,b)=>a-b);
  if (steps.length < 3) return { valid: false, rejectReasons: ['<3 portals'] };
  const [s1, s2, s3] = steps;
  const reasons = [];
  if (s1 < 12) reasons.push(`firstPortal=${s1}<12`);
  if (s2 <= 20) reasons.push(`s2=${s2}<=20 (pair in first 20)`);
  if (s3 < 36) reasons.push(`s3=${s3}<36 (no late portal)`);
  if (s3 < 34) reasons.push(`all before 34`);
  const inWindows = [
    s1 >= 12 && s1 <= 22,
    s2 >= 24 && s2 <= 34,
    s3 >= 36 && s3 <= 46,
  ];
  if (!inWindows.every(Boolean)) reasons.push(`windows: ${inWindows.map((b,i)=>'ABC'[i]+(b?'✓':'✗')).join(' ')}`);
  return {
    valid: reasons.length === 0,
    steps, inWindows,
    hasLatePortal: s3 >= 36,
    hasEarlyCluster: s1 < 12 || s2 <= 20,
    allBefore34: s3 < 34,
    matchesLateBalanced: reasons.length === 0,
    rejectReasons: reasons,
  };
}

// ── Spatial-scatter screening ──

function zoneOf(idx, N) {
  const { r, c } = toCoord(idx, N);
  const s = Math.ceil(N / 3);
  return Math.floor(r / s) + ',' + Math.floor(c / s);
}

function zoneDirection(from, to, N) {
  const a = toCoord(from, N), b = toCoord(to, N);
  const dr = b.r - a.r, dc = b.c - a.c;
  return Math.sign(dr) + ',' + Math.sign(dc);
}

function checkMechanicalRhythm(steps) {
  // Detect equal-interval patterns: 12-17-22 (interval 5), 14-19-24 (interval 5), etc.
  if (steps.length < 3) return { mechanical: false };
  const [s1, s2, s3] = steps;
  const i1 = s2 - s1, i2 = s3 - s2;
  if (i1 === i2 && i1 <= 6) return { mechanical: true, pattern: `${s1}-${s2}-${s3} interval=${i1}` };
  return { mechanical: false };
}

function checkFirst12Zones(path, N) {
  const zones = new Set();
  for (let i = 0; i < 12; i++) zones.add(zoneOf(path[i], N));
  return { zoneCount: zones.size, zones: [...zones].sort() };
}

function screenSpatialScatter(c, N) {
  // ── Hard gate: path validity ──
  const boardSize = N * N;
  if (!c.path || c.path.length !== boardSize) return { pass: false, reason: `path.length=${c.path?.length||0}!=${boardSize}` };
  if (new Set(c.path).size !== boardSize) return { pass: false, reason: `path duplicates: unique=${new Set(c.path).size}` };

  // ── Hard gate: portal validity ──
  const pv = validatePortals(c.portals, N);
  if (!pv.valid) return { pass: false, reason: 'portalErrors: ' + pv.errors.join('; ') };

  // ── Hard gate: path + portal combined validation ──
  const vp = validatePath(c.path, c.portals, N);
  if (!vp.valid) return { pass: false, reason: 'pathErrors: ' + vp.errors.join('; ') };

  const jumps = vp.portalJumps;
  if (jumps.length !== 3) return { pass: false, reason: 'portalJumps=' + jumps.length + '!=3' };
  const steps = jumps.map(j => j.step).sort((a,b)=>a-b);
  const reasons = [];

  // All dist >= 5
  const dists = jumps.map(j => {
    const a = toCoord(j.from, N), b = toCoord(j.to, N);
    return Math.abs(a.r-b.r) + Math.abs(a.c-b.c);
  });
  if (dists.some(d => d < 5)) reasons.push(`dist<5: ${dists.join(',')}`);

  // At least one dist >= 8
  if (!dists.some(d => d >= 8)) reasons.push(`no dist>=8: ${dists.join(',')}`);

  // maxRun / sweeps — compute from path
  const dirs = analyzeDirections(c.path, N);
  const maxRun = countConsecutiveSameDir(dirs);
  const rowSw = countRowSweeps(dirs);
  const colSw = countColSweeps(dirs);
  if (maxRun > 4) reasons.push(`maxRun=${maxRun}>4`);
  if (rowSw > 1) reasons.push(`rowSw=${rowSw}>1`);
  if (colSw > 1) reasons.push(`colSw=${colSw}>1`);

  // first12 span >= 3 rows AND >= 3 columns
  const rowSet = new Set(), colSet = new Set();
  for (let i = 0; i < 12; i++) { const p = toCoord(c.path[i], N); rowSet.add(p.r); colSet.add(p.c); }
  if (rowSet.size < 3) reasons.push(`first12 rows=${rowSet.size}<3`);
  if (colSet.size < 3) reasons.push(`first12 cols=${colSet.size}<3`);

  // first12 >= 3 zones
  const f12z = checkFirst12Zones(c.path, N);
  if (f12z.zoneCount < 3) reasons.push(`first12 zones=${f12z.zoneCount}<3`);

  // first12 not sweep-like
  const f12 = checkFirst12Exposure(c.path, N);
  if (f12.exposed) reasons.push('first12 exposed: ' + f12.issues.join(', '));

  // Portal jump zone directions: >= 2 different
  const zDirs = jumps.map(j => zoneDirection(j.from, j.to, N));
  if (new Set(zDirs).size < 2) reasons.push(`zoneDirs=${new Set(zDirs).size}<2: ${zDirs.join(',')}`);

  // No mechanical equal-interval rhythm
  const mech = checkMechanicalRhythm(steps);
  if (mech.mechanical) reasons.push('mechanical rhythm: ' + mech.pattern);

  // All portal cells non-adjacent (double-check)
  for (const p of c.portals) {
    if (isAdjacent(p.cells[0], p.cells[1], N)) reasons.push(`adjacent portal cells: ${p.cells[0]},${p.cells[1]}`);
  }

  return {
    pass: reasons.length === 0,
    reasons,
    dists, steps,
    zoneDirs: zDirs,
    maxRun, rowSw, colSw,
    first12Rows: rowSet.size, first12Cols: colSet.size, first12Zones: f12z.zoneCount,
  };
}

// ── 从 grid 提取路径 ──

function extractPath(grid) {
  if (!grid) return null;
  const sorted = grid.map((c, i) => ({ i, v: c.val })).sort((a, b) => a.v - b.v);
  return sorted.map(x => x.i);
}

// ── 生成基路径（扩展采样 + 变换 + 去重 + 质量预筛） ──

function diffForN(N) {
  if (N <= 5) return 'easy';
  if (N <= 7) return 'medium';
  return 'hard';
}

// ── Path transforms ──

function transformRotate90(path, N) {
  return path.map(idx => { const r = Math.floor(idx / N), c = idx % N; return c * N + (N - 1 - r); });
}
function transformMirrorH(path, N) {
  return path.map(idx => { const r = Math.floor(idx / N), c = idx % N; return r * N + (N - 1 - c); });
}
function transformMirrorV(path, N) {
  return path.map(idx => { const r = Math.floor(idx / N), c = idx % N; return (N - 1 - r) * N + c; });
}

function applyTransforms(path, N, maxExtras) {
  const results = [];
  // Rotations
  let current = path;
  for (let r = 0; r < 3; r++) {
    current = transformRotate90(current, N);
    const ck = crossingCheck(current, N);
    if (ck.valid) results.push(current);
  }
  // Mirrors
  const mh = transformMirrorH(path, N);
  if (crossingCheck(mh, N).valid) results.push(mh);
  const mv = transformMirrorV(path, N);
  if (crossingCheck(mv, N).valid) results.push(mv);
  return results.slice(0, maxExtras);
}

function crossingCheck(path, N) {
  if (new Set(path).size !== N * N) return { valid: false };
  for (let i = 1; i < path.length; i++) {
    if (isDiagonal(path[i - 1], path[i], N) && hasPathCrossing(path.slice(0, i), path[i - 1], path[i], N)) {
      return { valid: false };
    }
  }
  return { valid: true };
}

function first15Key(path) { return path.slice(0, 15).join(','); }
function first12ZonesKey(path, N) {
  const s = Math.ceil(N / 3);
  return path.slice(0, 12).map(idx => { const r = Math.floor(idx/N), c = idx%N; return Math.floor(r/s)+','+Math.floor(c/s); }).join('');
}

function generateBasePaths(N, count) {
  const diff = diffForN(N);
  const rules = {
    movement: MOVEMENT_TYPES.diagonal,
    path: { allowCrossing: false, requireSequential: true, requireFullBoard: true },
  };
  const paths = [];
  const seenFirst15 = new Set();
  const seenFirst12Z = new Set();
  const boardSize = N * N;

  // Phase 1: sample from wide idx range
  const maxSample = N === 7 ? 500 : 200;
  for (let idx = 0; idx < maxSample && paths.length < count * 2; idx++) {
    const result = createClassicLevel(diff, idx, rules, 'diagonal');
    if (!result?.grid) continue;
    const gn = Math.round(Math.sqrt(result.grid.length));
    if (gn !== N) continue;

    const path = extractPath(result.grid);
    if (!path || path.length !== boardSize) continue;
    if (new Set(path).size !== boardSize) continue;
    if (!crossingCheck(path, N).valid) continue;

    // Dedup by first15
    const f15 = first15Key(path);
    if (seenFirst15.has(f15)) continue;
    seenFirst15.add(f15);

    // Dedup by first12 zone pattern
    const f12z = first12ZonesKey(path, N);
    if (seenFirst12Z.has(f12z)) continue;
    seenFirst12Z.add(f12z);

    // Quality pre-filter for spatial-scatter
    const dirs = analyzeDirections(path, N);
    const maxRun = countConsecutiveSameDir(dirs);
    const rowSw = countRowSweeps(dirs);
    const colSw = countColSweeps(dirs);
    if (maxRun > 5) continue;
    if (rowSw > 2) continue;
    if (colSw > 2) continue;
    // first12 span
    const rS = new Set(), cS = new Set(), zS = new Set();
    const zs = Math.ceil(N / 3);
    for (let i = 0; i < 12; i++) { const p = toCoord(path[i], N); rS.add(p.r); cS.add(p.c); zS.add(Math.floor(p.r/zs)+','+Math.floor(p.c/zs)); }
    if (rS.size < 3 || cS.size < 3 || zS.size < 3) continue;

    paths.push(path);

    // Phase 2: apply transforms (limit per base to avoid bloat)
    const transforms = applyTransforms(path, N, 3);
    for (const tp of transforms) {
      const tf15 = first15Key(tp);
      if (seenFirst15.has(tf15)) continue;
      seenFirst15.add(tf15);
      const tf12z = first12ZonesKey(tp, N);
      if (seenFirst12Z.has(tf12z)) continue;
      seenFirst12Z.add(tf12z);
      // Quick quality check on transformed path
      const td = analyzeDirections(tp, N);
      if (countConsecutiveSameDir(td) > 5) continue;
      if (countRowSweeps(td) > 2 || countColSweeps(td) > 2) continue;
      paths.push(tp);
    }
  }

  if (paths.length < count) {
    console.error(`Base paths: sampled ${maxSample}, raw unique first15=${seenFirst15.size}, after quality+transform=${paths.length} (target ${count})`);
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
function tryInsertPortal(path, N, portalId, existingCells, stepWindow) {
  const boardSize = N * N;
  const results = [];
  const existing = new Set(existingCells || []);
  const iMin = stepWindow ? Math.max(stepWindow.min, MIN_PORTAL_STEP) : MIN_PORTAL_STEP;
  const iMax = stepWindow ? stepWindow.max : (path.length - 1);

  for (let dist = 3; dist <= Math.min(boardSize - 2, 30); dist += 2) {
    for (let i = iMin; i <= Math.min(iMax, path.length - dist); i++) {
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
function tryAppendPortal(candidate, N, portalId, stepWindow) {
  const path = candidate.path;
  const existingCells = candidate.portals.flatMap(p => p.cells);
  const boardSize = N * N;
  const results = [];
  const iMin = stepWindow ? Math.max(stepWindow.min, MIN_PORTAL_STEP) : MIN_PORTAL_STEP;
  const iMax = stepWindow ? stepWindow.max : (path.length - 1);

  for (let dist = 3; dist <= Math.min(boardSize - 2, 30); dist += 2) {
    for (let i = iMin; i <= Math.min(iMax, path.length - dist); i++) {

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
  const cfg = { portalCount: 2, candidateCount: 3, jsonOutput: false, outFile: null, size: 7, rhythm: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--size') cfg.size = parseInt(argv[i + 1]) || 7;
    if (argv[i] === '--portals') cfg.portalCount = parseInt(argv[i + 1]) || 2;
    if (argv[i] === '--count') cfg.candidateCount = parseInt(argv[i + 1]) || 3;
    if (argv[i] === '--rhythm' && argv[i + 1]) cfg.rhythm = argv[i + 1];
    if (argv[i] === '--json') cfg.jsonOutput = true;
    if (argv[i] === '--out' && argv[i + 1]) cfg.outFile = argv[i + 1];
  }
  if (cfg.rhythm && !RHYTHM_PRESETS[cfg.rhythm]) {
    console.error('Unknown rhythm: ' + cfg.rhythm + '. Available: ' + Object.keys(RHYTHM_PRESETS).join(', '));
    process.exit(1);
  }
  // Validate size
  if (![5, 7, 9].includes(cfg.size)) {
    console.error('--size must be 5, 7, or 9');
    process.exit(1);
  }
  return cfg;
}

function main() {
  const cfg = parseArgs(process.argv.slice(2));
  const { portalCount, candidateCount, jsonOutput, outFile, size: N, rhythm: rhythmName } = cfg;
  const boardSize = N * N;
  const rhythmCfg = rhythmName ? RHYTHM_PRESETS[rhythmName] : null;
  const basePaths = generateBasePaths(N, rhythmCfg ? 120 : 25);
  const rhythmWindows = rhythmCfg ? rhythmCfg.windows : null;

  if (basePaths.length === 0) {
    console.error('Failed to generate any base paths');
    process.exit(1);
  }

  const candidates = [];

  for (const basePath of basePaths) {
    // ── Step 1: 插入 portal A ──
    const winA = rhythmWindows ? rhythmWindows[0] : null;
    const onePortalCands = tryInsertPortal(basePath, N, 'A', [], winA);

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
    const winB = rhythmWindows ? rhythmWindows[1] : null;
    for (const c1 of onePortalCands) {
      const twoPortalCands = tryAppendPortal(c1, N, 'B', winB);
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
        const winC = rhythmWindows ? rhythmWindows[2] : null;
        for (const c2 of twoPortalCands) {
          const threePortalCands = tryAppendPortal(c2, N, 'C', winC);
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

  // ── Rhythm / spatial-scatter filtering ──
  let rhythmStats = null;
  let filtered = exactMatch;

  if (rhythmCfg && (rhythmName === 'spatial-scatter' || rhythmName === 'spatial-scatter-plus')) {
    // spatial-scatter / spatial-scatter-plus: post-generation screening
    rhythmStats = { total: exactMatch.length, passed: 0, rejected: {} };
    filtered = [];
    const isPlus = rhythmName === 'spatial-scatter-plus';
    for (const c of exactMatch) {
      const result = screenSpatialScatter(c, N);
      if (!result.pass) {
        for (const r of result.reasons) {
          rhythmStats.rejected[r] = (rhythmStats.rejected[r] || 0) + 1;
        }
        continue;
      }
      // Plus checks
      if (isPlus) {
        const maxStep = Math.max(...result.steps);
        if (maxStep < 18) {
          rhythmStats.rejected['plus:allBefore18'] = (rhythmStats.rejected['plus:allBefore18'] || 0) + 1;
          continue;
        }
        if (maxStep < 21) {
          rhythmStats.rejected['plus:noStep21'] = (rhythmStats.rejected['plus:noStep21'] || 0) + 1;
          continue;
        }
        result._plus = {
          maxStep,
          hasStep21: maxStep >= 21,
          hasStep28: maxStep >= 28,
          scoreBonus: maxStep >= 28 ? 5 : (maxStep >= 21 ? 2 : 0),
        };
      }
      rhythmStats.passed++;
      filtered.push({ ...c, _spatial: result });
    }
  } else if (rhythmCfg && rhythmCfg.constraints && rhythmCfg.windows) {
    // window-based rhythm (late-balanced etc.)
    rhythmStats = { total: exactMatch.length, passed: 0, rejected: {} };
    filtered = [];
    for (const c of exactMatch) {
      const vp = validatePath(c.path, c.portals, N);
      const rhythm = analyzePortalRhythm(vp.portalJumps);
      const f12 = checkFirst12Exposure(c.path, N);

      if (!rhythm.valid) {
        for (const r of rhythm.rejectReasons) {
          rhythmStats.rejected['rhythm:' + r] = (rhythmStats.rejected['rhythm:' + r] || 0) + 1;
        }
        continue;
      }
      if (f12.exposed) {
        for (const iss of f12.issues) {
          rhythmStats.rejected['first12:' + iss] = (rhythmStats.rejected['first12:' + iss] || 0) + 1;
        }
        continue;
      }
      rhythmStats.passed++;
      filtered.push(c);
    }
  }

  // 去重 + 排序
  const seenPaths = new Set();
  const seenPortalCells = new Set();
  const unique = [];
  for (const c of filtered.sort((a, b) => b.score - a.score)) {
    const pathKey = c.path.join(',');
    const portalKey = portalCellsKey(c.portals);
    if (seenPaths.has(pathKey) || seenPortalCells.has(portalKey)) continue;
    seenPaths.add(pathKey);
    seenPortalCells.add(portalKey);
    unique.push(c);
  }
  const top = unique.slice(0, candidateCount);

  if (rhythmStats) {
    console.error(`Rhythm stats: ${rhythmStats.total} total, ${rhythmStats.passed} passed. Rejected: ${JSON.stringify(rhythmStats.rejected)}`);
  }

  // ── Final validation gate ──
  const validatedTop = [];
  for (const c of top) {
    const pv = validatePortals(c.portals, N);
    const vp = validatePath(c.path, c.portals, N);
    if (!pv.valid || !vp.valid) {
      console.error(`Final validation FAILED for candidate: pathErrors=${vp.errors.join(';')} portalErrors=${pv.errors.join(';')}`);
      continue;
    }
    if (c.path.length !== boardSize || new Set(c.path).size !== boardSize) {
      console.error(`Final validation FAILED: path length/set mismatch`);
      continue;
    }
    // Verify hiddenVals don't include portal cell path numbers
    const portalPathVals = new Set();
    for (const p of c.portals) {
      for (const cell of p.cells) {
        const pos = c.path.indexOf(cell);
        if (pos >= 0) portalPathVals.add(pos + 1);
      }
    }
    const hv = suggestHiddenVals(c.path, c.portals, N <= 5 ? 5 : N === 7 ? 8 : 10);
    const hvClean = hv.filter(v => !portalPathVals.has(v));
    if (hvClean.length < hv.length) {
      console.error(`HiddenVals contained ${hv.length - hvClean.length} portal cell path numbers — fixed`);
    }

    validatedTop.push({...c, _valid: true, _pathLen: c.path.length, _unique: new Set(c.path).size, _portalCount: c.portals.length, _portalJumps: vp.portalJumps.length, _pathErrors: vp.errors, _portalErrors: pv.errors, _hv: hvClean});
  }

  if (validatedTop.length < candidateCount) {
    console.error(`Warning: requested ${candidateCount} candidates, only ${validatedTop.length} passed final validation.`);
  }

  // ── 构建输出 ──
  const output = validatedTop.map(c => {
    const s = snakeCheck(c.path, N);
    const vp = validatePath(c.path, c.portals, N);
    return {
      id: `portal-gen-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: '生成候选',
      N,
      targetSteps: boardSize - 1,
      path: c.path,
      portals: c.portals,
      hiddenVals: c._hv,
      _meta: {
        valid: true,
        pathLen: c.path.length,
        unique: new Set(c.path).size,
        portalCount: c.portals.length,
        portalJumps: vp.portalJumps.length,
        pathErrors: [],
        portalErrors: [],
        score: c.score,
        maxSameDirRun: s.maxRun,
        rowSweeps: s.rowSw,
        colSweeps: s.colSw,
        portalJumpDetails: vp.portalJumps.map(j => ({ step: j.step, from: j.from, to: j.to })),
        rhythm: analyzePortalRhythm(vp.portalJumps),
        first12: checkFirst12Exposure(c.path, N),
      },
    };
  });

  const jsonStr = JSON.stringify(output, null, 2);

  if (outFile) {
    writeFileSync(outFile, jsonStr, 'utf-8');
    console.error(`Wrote ${output.length} candidates to ${outFile}`);
  }

  if (jsonOutput) {
    console.log(jsonStr);
  } else {
    console.log(`Base paths: ${basePaths.length}  Validated: ${validatedTop.length}  (portals=${portalCount})\n`);
    for (let i = 0; i < validatedTop.length; i++) {
      const c = validatedTop[i];
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
