/**
 * One-Line 关卡 validator。
 * 运行：node scripts/validate-levels.mjs  或  npm run validate:levels
 */

import { CONFIG, createClassicLevel } from '../src/game/classic/createClassicLevel.js';
import { PORTAL_LEVELS } from '../src/data/portalLevels.js';
import { STAR_LINE_LEVELS } from '../src/data/starLineLevels.js';
import { MOVEMENT_TYPES, GAME_MODES, CLASSIC_STRUCTURE } from '../src/config/gameModes.js';
import { ORTHOGONAL_DIRECTIONS, ALL_DIRECTIONS, hasPathCrossing } from '../src/game/rules/movement.js';
import { solveStarLine } from './starLineSolver.mjs';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = resolve(__dirname, 'star-line-baseline.json');

// ── helpers ──

const VALID_GRID_SIZES = new Set([5, 7, 9]);
const STAR_LINE_VALID_N = new Set([5, 6, 7, 8, 9, 10, 12]);
const PORTAL_CLASSIC_RULES = {
  movement: MOVEMENT_TYPES.diagonal,
  path: { allowCrossing: false, requireSequential: true, requireFullBoard: true }
};

function toCoord(idx, N) { return { r: Math.floor(idx / N), c: idx % N }; }

const errors = [];
const warnings = [];
let checks = { total: 0, passed: 0 };
const VALID_DIFF = ['easy', 'medium', 'hard'];

function fail(msg) { errors.push(msg); }
function chk(cond, msg) { checks.total++; if (cond) { checks.passed++; } else { fail(msg); } }

// ── 1. Classic / Diagonal config + movement ──

function validateModeMovement() {
  const classic = GAME_MODES['classic'];
  const diagonal = GAME_MODES['diagonal'];
  chk(classic && classic.movement === MOVEMENT_TYPES.orthogonal,
    `classic movement: 期望 orthogonal, 实际 ${classic?.movement}`);
  chk(diagonal && diagonal.movement === MOVEMENT_TYPES.diagonal,
    `diagonal movement: 期望 diagonal, 实际 ${diagonal?.movement}`);
  chk(GAME_MODES['portalClassic'] !== undefined, 'portalClassic mode key 存在');
}

function validateClassicConfig() {
  const diffs = ['easy', 'medium', 'hard'];
  const expectedN = { easy: 5, medium: 7, hard: 9 };

  for (const diff of diffs) {
    const cfg = CONFIG[diff];
    const label = `classic ${diff} (${cfg.N}×${cfg.N})`;

    chk(cfg.N === expectedN[diff], `${label}: N should be ${expectedN[diff]}`);
    chk(cfg.hiddenMin <= cfg.hiddenMax, `${label}: hiddenMin(${cfg.hiddenMin}) <= hiddenMax(${cfg.hiddenMax})`);
    chk(cfg.hiddenMax <= cfg.N * cfg.N, `${label}: hiddenMax(${cfg.hiddenMax}) <= ${cfg.N*cfg.N}`);
    chk(cfg.maxGap > 0, `${label}: maxGap(${cfg.maxGap}) > 0`);
    chk(cfg.hp > 0, `${label}: hp(${cfg.hp}) > 0`);
  }
}

function validateDiagonalConfig() {
  const diffs = ['easy', 'medium', 'hard'];
  for (const diff of diffs) {
    const cfg = CONFIG[diff];
    chk(VALID_GRID_SIZES.has(cfg.N), `diagonal ${diff}: N=${cfg.N} valid`);
  }
}

// ── 1b. Classic / Diagonal 生成结果抽样 ──

function sampleClassicLevel(playMode, diff, levelIdx) {
  const label = `${playMode} ${diff}[${levelIdx}]`;
  const rules = playMode === 'diagonal'
    ? { movement: MOVEMENT_TYPES.diagonal, path: { allowCrossing: false, requireSequential: true, requireFullBoard: true } }
    : { movement: MOVEMENT_TYPES.orthogonal, path: { allowCrossing: false, requireSequential: true, requireFullBoard: true } };
  const result = createClassicLevel(diff, levelIdx, rules, playMode);
  const grid = result?.grid;
  const N = grid ? Math.round(Math.sqrt(grid.length)) : 0;
  const cfg = CONFIG[diff];

  chk(grid && grid.length === N * N, `${label}: board 长度=${grid?.length}, 期望 ${N*N}`);

  if (!grid) return;

  // 从 grid 重建路径（val 按路径顺序赋值）
  const path = grid.map((c, i) => ({ i, val: c.val })).sort((a, b) => a.val - b.val).map(v => v.i);

  // val 覆盖 1..N*N，无重复
  const vals = grid.map(c => c.val).filter(v => v > 0);
  const valSet = new Set(vals);
  chk(vals.length === N * N && valSet.size === N * N,
    `${label}: val 覆盖 1..${N*N}, 无重复 (共 ${vals.length} 个)`);

  // hidden 数量在配置范围内
  const hiddenCount = grid.filter(c => c.isHidden).length;
  chk(hiddenCount >= cfg.hiddenMin && hiddenCount <= cfg.hiddenMax,
    `${label}: hidden=${hiddenCount}, 范围 [${cfg.hiddenMin}, ${cfg.hiddenMax}]`);

  // hidden 数字间隔不超过 maxGap
  const hiddenVals = new Set(grid.filter(c => c.isHidden).map(c => c.val));
  let maxRun = 0, run = 0;
  for (let v = 1; v <= N * N; v++) {
    if (hiddenVals.has(v)) { run++; maxRun = Math.max(maxRun, run); }
    else { run = 0; }
  }
  chk(maxRun <= cfg.maxGap, `${label}: hidden 最大连续=${maxRun}, maxGap=${cfg.maxGap}`);

  // 路径相邻移动检查
  const allowedDirs = playMode === 'diagonal' ? ALL_DIRECTIONS : ORTHOGONAL_DIRECTIONS;
  const allowedSet = new Set(allowedDirs.map(([dr, dc]) => `${dr},${dc}`));
  let moveOk = true;
  for (let i = 0; i < path.length - 1; i++) {
    const a = Math.floor(path[i] / N), b = path[i] % N;
    const c = Math.floor(path[i+1] / N), d = path[i+1] % N;
    const dr = c - a, dc = d - b;
    if (!allowedSet.has(`${dr},${dc}`)) { moveOk = false; break; }
  }
  chk(moveOk, `${label}: 路径移动符合 ${playMode === 'diagonal' ? '八向' : '正交'}`);
}

function validateGeneratedSamples() {
  for (const mode of ['classic', 'diagonal']) {
    for (const section of CLASSIC_STRUCTURE) {
      const { diff, count } = section;
      const samples = [0, Math.floor(count / 2), count - 1];
      for (const idx of samples) {
        sampleClassicLevel(mode, diff, idx);
      }
    }
  }
}

// ── 2. Portal Classic ──

function validatePortalClassic(level) {
  const { id, name, N, path, portals, hiddenVals, targetSteps } = level;
  const label = `Portal Classic [${id}]`;
  const boardSize = typeof N === 'number' ? N * N : 0;

  chk(typeof id === 'string' && id.length > 0, `${label}: id 存在`);
  chk(typeof name === 'string' && name.length > 0, `${label}: name 存在`);
  chk(VALID_GRID_SIZES.has(N), `${label}: N=${N}, 期望为 5/7/9`);

  // 必需字段类型检查
  chk(Array.isArray(path), `${label}: path 是数组`);
  chk(Array.isArray(hiddenVals), `${label}: hiddenVals 是数组`);
  chk(Array.isArray(portals), `${label}: portals 是数组`);
  chk(Array.isArray(portals) && portals.length >= 1, `${label}: portals.length=${portals?.length}, 期望 ≥1`);

  if (Array.isArray(path) && path.length === boardSize) {
    const set = new Set(path);
    chk(set.size === boardSize, `${label}: path 无重复索引`);
    let allIdxOk = true;
    for (const idx of path) {
      if (idx < 0 || idx >= boardSize) { allIdxOk = false; break; }
    }
    chk(allIdxOk, `${label}: path 索引在 [0, ${boardSize-1}]`);
    let coversAllIndexes = true;
    for (let idx = 0; idx < boardSize; idx++) {
      if (!set.has(idx)) { coversAllIndexes = false; break; }
    }
    chk(coversAllIndexes, `${label}: path 覆盖 0..${boardSize-1}`);

    // 八向移动与 runtime 同款 crossing 检查（portal 跳转除外）
    const portalJumpPairs = new Set();
    for (const p of (portals || [])) {
      if (!Array.isArray(p.cells)) continue;
      portalJumpPairs.add(`${p.cells[0]},${p.cells[1]}`);
      portalJumpPairs.add(`${p.cells[1]},${p.cells[0]}`);
    }
    let moveOk = true;
    let crossingOk = true;
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i], to = path[i+1];
      if (portalJumpPairs.has(`${from},${to}`)) continue;
      const a = toCoord(from, N), b = toCoord(to, N);
      const dr = Math.abs(a.r - b.r), dc = Math.abs(a.c - b.c);
      if (dr > 1 || dc > 1 || (dr === 0 && dc === 0)) { moveOk = false; break; }
      if (hasPathCrossing(path.slice(0, i + 1), from, to, N, PORTAL_CLASSIC_RULES)) {
        crossingOk = false;
        break;
      }
    }
    chk(moveOk, `${label}: 相邻路径移动合法`);
    chk(crossingOk, `${label}: 路径不产生斜线交叉`);
  } else if (Array.isArray(path)) {
    fail(`${label}: path.length=${path.length}, 期望 ${boardSize}`);
  }

  if (Array.isArray(hiddenVals)) {
    chk(hiddenVals.every(v => typeof v === 'number' && v >= 1 && v <= boardSize), `${label}: hiddenVals 为路径数字，范围 [1, ${boardSize}]`);
    chk(new Set(hiddenVals).size === hiddenVals.length, `${label}: hiddenVals 无重复`);
  }

  if (Array.isArray(portals)) {
    const portalIds = new Set();
    const allPortalCells = [];
    let portalOk = true;
    for (const p of portals) {
      if (!p.id || portalIds.has(p.id)) { portalOk = false; break; }
      portalIds.add(p.id);
      if (!Array.isArray(p.cells) || p.cells.length !== 2) { portalOk = false; break; }
      if (p.cells[0] < 0 || p.cells[0] >= boardSize || p.cells[1] < 0 || p.cells[1] >= boardSize) { portalOk = false; break; }
      if (p.cells[0] === p.cells[1]) { portalOk = false; break; }
      allPortalCells.push(p.cells[0], p.cells[1]);
    }
    chk(portalOk, `${label}: portals 合法（id 唯一、cells 成对不重复、索引合法）`);
    if (portalOk) {
      chk(new Set(allPortalCells).size === allPortalCells.length, `${label}: portal cells 全局无重复`);
    }
  }

  chk(typeof targetSteps === 'number' && targetSteps > 0, `${label}: targetSteps=${targetSteps} > 0`);
  if (path?.length === boardSize) {
    chk(targetSteps === boardSize - 1, `${label}: targetSteps=${targetSteps}, 期望 ${boardSize-1}`);
  }

  // 无收集/自由路径字段
  chk(!('start' in level), `${label}: 不含 start`);
  chk(!('exit' in level), `${label}: 不含 exit`);
  chk(!('targets' in level), `${label}: 不含 targets`);
  chk(!('obstacles' in level), `${label}: 不含 obstacles`);
  chk(!('excellentSteps' in level), `${label}: 不含 excellentSteps`);
}

// ── 3. Star Line (星线番外) ──

function checkRegionConnectivity(regions, N) {
  const total = N * N;
  const regionCounts = new Array(N).fill(0);
  for (let i = 0; i < total; i++) regionCounts[regions[i]]++;

  const visited = new Array(total).fill(false);

  for (let rid = 0; rid < N; rid++) {
    // 找到该 region 的第一个格子
    let start = -1;
    for (let i = 0; i < total; i++) {
      if (regions[i] === rid) { start = i; break; }
    }
    if (start === -1) continue; // region 为空，其他检查会处理

    // BFS 四向连通
    const queue = [start];
    visited[start] = true;
    let connected = 0;

    while (queue.length > 0) {
      const idx = queue.shift();
      connected++;
      const r = Math.floor(idx / N);
      const c = idx % N;

      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
        const ni = nr * N + nc;
        if (!visited[ni] && regions[ni] === rid) {
          visited[ni] = true;
          queue.push(ni);
        }
      }
    }

    if (connected !== regionCounts[rid]) {
      return { connected: false, regionId: rid, expected: regionCounts[rid], found: connected };
    }
  }

  return { connected: true };
}

function validateStarLine(level) {
  const { id, name, N, regions, solution, revealPath, difficulty } = level;
  const label = `Star Line [${id}]`;
  const quota = level.starsPerRow ?? level.starsPerCol ?? level.starsPerRegion ?? 1;
  const quotaOk = Number.isInteger(quota) && quota >= 1;

  // ── quota 合法性校验 ──
  if (!quotaOk) {
    fail(`${label}: starsPerRow/starsPerCol/starsPerRegion 必须为正整数，实际 quota=${quota}`);
  }
  for (const field of ['starsPerRow', 'starsPerCol', 'starsPerRegion']) {
    const value = level[field];
    if (value != null && (!Number.isInteger(value) || value < 1)) {
      fail(`${label}: ${field}=${value} 必须为正整数`);
    }
  }

  // ── quota 一致性校验 ──
  const sr = level.starsPerRow ?? quota;
  const sc = level.starsPerCol ?? quota;
  const srg = level.starsPerRegion ?? quota;
  const quotaConsistent = sr === sc && sc === srg;
  if (!quotaConsistent) {
    fail(`${label}: starsPerRow(${sr}) / starsPerCol(${sc}) / starsPerRegion(${srg}) 必须一致，当前只支持统一 quota`);
  }

  // ── boardSize 校验 ──
  const boardSizeOk = level.boardSize == null || (Number.isInteger(level.boardSize) && level.boardSize === N);
  if (!boardSizeOk) {
    fail(`${label}: boardSize=${level.boardSize} 与 N=${N} 不一致，boardSize 必须为整数且等于 N`);
  }
  const effectiveQuota = quotaOk ? quota : 1;
  const sideLen = boardSizeOk && level.boardSize != null ? level.boardSize : N;
  const expectedStarCount = effectiveQuota * sideLen;

  // ── 字段存在性（永远检查） ──
  chk(typeof id === 'string' && id.length > 0, `${label}: id 存在`);
  chk(typeof name === 'string' && name.length > 0, `${label}: name 存在`);

  const nOk = STAR_LINE_VALID_N.has(N);
  chk(nOk, `${label}: N=${N}, 期望为 5/6/7/8/9/10/12`);
  const boardSize = nOk ? N * N : 0;

  // ── regionsStructOk 判定 ──
  // 必须同时满足：
  //   1. regions 是数组
  //   2. N 合法（在 STAR_LINE_VALID_N 中）
  //   3. regions.length === N * N
  //   4. 每个 region id 都是 Number.isInteger(rid)
  //   5. 每个 region id 都在 0..N-1
  //   6. 每个 region 至少出现 1 次
  const regionsIsArray = Array.isArray(regions);
  chk(regionsIsArray, `${label}: regions 是数组`);

  let regionsStructOk = false;
  if (regionsIsArray && nOk) {
    const lengthOk = regions.length === boardSize;
    chk(lengthOk, `${label}: regions.length=${regions.length}, 期望 ${boardSize}`);

    const regionCounts = new Array(N).fill(0);
    let idsOk = false;
    if (lengthOk) {
      idsOk = true;
      for (const rid of regions) {
        if (!Number.isInteger(rid) || rid < 0 || rid >= N) {
          idsOk = false;
          break;
        }
        regionCounts[rid]++;
      }
    }
    chk(idsOk, `${label}: region id 必须为 0..${N - 1} 的整数`);

    if (lengthOk && idsOk) {
      let allPresent = true;
      for (let rid = 0; rid < N; rid++) {
        if (regionCounts[rid] < 1) {
          allPresent = false;
          chk(false, `${label}: region ${rid} 至少 1 格 (实际 ${regionCounts[rid]})`);
        }
      }
      regionsStructOk = allPresent;
    }
  }

  // ── region 连通性 / Solver / 每 region 1 星（仅在 regionsStructOk 时执行）──
  if (regionsStructOk && quotaOk && quotaConsistent && boardSizeOk) {
    const conn = checkRegionConnectivity(regions, N);
    chk(conn.connected, `${label}: region ${conn.regionId} 不连通 (期望 ${conn.expected} 格，连通 ${conn.found} 格)`);

    const solverResult = solveStarLine(N, regions, { starsPerRow: effectiveQuota, starsPerCol: effectiveQuota, starsPerRegion: effectiveQuota });
    chk(solverResult.status === 'UNIQUE',
      `${label}: Solver 返回 ${solverResult.status} (找到 ${solverResult.solutions.length} 个解, quota=${effectiveQuota})`);
  }

  // ── solution ──
  const solIsArray = Array.isArray(solution);
  chk(solIsArray, `${label}: solution 是数组`);
  if (!solIsArray) {
    // 无 solution 时仍需检查 revealPath 基本类型 + difficulty
    chk(Array.isArray(revealPath), `${label}: revealPath 是数组`);
    const validDiff = ['easy', 'medium', 'hard'];
    if (!difficulty || !validDiff.includes(difficulty)) {
      fail(`${label}: difficulty='${difficulty}', 必须为 easy/medium/hard`);
    }
    return;
  }

  chk(solution.length === expectedStarCount, `${label}: solution.length=${solution.length}, 期望 ${expectedStarCount} (quota=${effectiveQuota})`);
  chk(new Set(solution).size === solution.length, `${label}: solution 无重复索引`);

  let solIdxOk = true;
  for (const idx of solution) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= boardSize) {
      solIdxOk = false;
      break;
    }
  }
  chk(solIdxOk, `${label}: solution 索引必须为 [0, ${boardSize - 1}] 内的整数`);

  // ── 约束检查（依赖 N / regionsStructOk / solution 全部合法） ──
  if (solIdxOk && regionsStructOk && solution.length === expectedStarCount) {
    // 每行 quota 星
    const rowCounts = new Array(N).fill(0);
    for (const idx of solution) rowCounts[Math.floor(idx / N)]++;
    for (let r = 0; r < N; r++) {
      chk(rowCounts[r] === effectiveQuota, `${label}: 第 ${r} 行有 ${rowCounts[r]} 个星点, 期望 ${effectiveQuota}`);
    }

    // 每列 quota 星
    const colCounts = new Array(N).fill(0);
    for (const idx of solution) colCounts[idx % N]++;
    for (let c = 0; c < N; c++) {
      chk(colCounts[c] === effectiveQuota, `${label}: 第 ${c} 列有 ${colCounts[c]} 个星点, 期望 ${effectiveQuota}`);
    }

    // 每个 region quota 星
    const regionStarCounts = new Array(N).fill(0);
    for (const idx of solution) regionStarCounts[regions[idx]]++;
    for (let rid = 0; rid < N; rid++) {
      chk(regionStarCounts[rid] === effectiveQuota, `${label}: region ${rid} 有 ${regionStarCounts[rid]} 个星点, 期望 ${effectiveQuota}`);
    }

    // 八向不相邻
    for (let i = 0; i < solution.length; i++) {
      for (let j = i + 1; j < solution.length; j++) {
        const a = solution[i];
        const b = solution[j];
        const ra = Math.floor(a / N), ca = a % N;
        const rb = Math.floor(b / N), cb = b % N;
        const dr = Math.abs(ra - rb);
        const dc = Math.abs(ca - cb);
        if (dr <= 1 && dc <= 1) {
          chk(false, `${label}: 星点 ${a}(${ra},${ca}) 与 ${b}(${rb},${cb}) 八向相邻 (dr=${dr}, dc=${dc})`);
        }
      }
    }
  }

  // ── revealPath（不检查相邻移动，只作为结算展示顺序） ──
  const revealIsArray = Array.isArray(revealPath);
  chk(revealIsArray, `${label}: revealPath 是数组`);
  if (revealIsArray) {
    let revealIdxOk = true;
    for (const idx of revealPath) {
      if (!Number.isInteger(idx) || idx < 0 || idx >= boardSize) {
        revealIdxOk = false;
        break;
      }
    }
    chk(revealIdxOk, `${label}: revealPath 索引必须为 [0, ${boardSize - 1}] 内的整数`);

    if (solIdxOk && solution.length === expectedStarCount) {
      const solSet = new Set(solution);
      chk(revealPath.length === expectedStarCount, `${label}: revealPath.length=${revealPath.length}, 期望 ${expectedStarCount}`);
      chk(new Set(revealPath).size === revealPath.length, `${label}: revealPath 无重复`);

      let allCovered = true;
      for (const idx of solution) {
        if (!revealPath.includes(idx)) { allCovered = false; break; }
      }
      chk(allCovered, `${label}: revealPath 未覆盖全部 solution`);

      let noExtra = true;
      for (const idx of revealPath) {
        if (!solSet.has(idx)) { noExtra = false; break; }
      }
      chk(noExtra, `${label}: revealPath 包含非 solution 点`);
    }
  }

  // ── difficulty（必须存在且合法） ──
  const validDiff = ['easy', 'medium', 'hard'];
  if (!difficulty || !validDiff.includes(difficulty)) {
    fail(`${label}: difficulty='${difficulty}', 必须为 easy/medium/hard`);
  }

  // Soft: 尺寸 vs 难度匹配（仅 N 合法时检查）
  if (nOk) {
    if (N <= 6 && difficulty === 'hard') {
      warnings.push(`${label}: N=${N} 但 difficulty=hard，可能过小`);
    }
    if (N >= 7 && difficulty === 'easy') {
      warnings.push(`${label}: N=${N} 但 difficulty=easy，可能过大`);
    }
  }

  // ── gameId 校验（Package 1 新增） ──
  const gameId = level.gameId;
  chk(typeof gameId === 'string' && (gameId === 'starSingle' || gameId === 'starDouble'),
    `${label}: gameId='${gameId}', 必须为 starSingle 或 starDouble`);

  // gameId 与 quota 一致性
  if (gameId === 'starSingle' && quotaOk && quotaConsistent) {
    chk(effectiveQuota === 1, `${label}: gameId=starSingle 但 quota=${effectiveQuota}, 必须为 1`);
  }
  if (gameId === 'starDouble' && quotaOk && quotaConsistent) {
    chk(effectiveQuota === 2, `${label}: gameId=starDouble 但 quota=${effectiveQuota}, 必须为 2`);
  }

  // 旧关稳定 ID；新增双星课程使用独立、稳定且不依赖展示槽位的 ID。
  const legacyIdOk = id && /^star-lv-(0[1-9]|[1-9]\d|1[01]\d|120)$/.test(id);
  const doubleCourseIdOk = id && (
    /^star-double-tutorial-(0[1-9]|10)$/.test(id)
    || /^star-double-promoted-(0[1-9]|1\d|20|21)$/.test(id)
    || /^star-double-expansion-(0[1-9]|1\d)$/.test(id)
  );
  chk(
    legacyIdOk || doubleCourseIdOk,
    `${label}: id='${id}' 格式非法。必须为旧 star-lv ID 或正式双星课程 ID`,
  );
  if (doubleCourseIdOk) {
    chk(gameId === 'starDouble', `${label}: 双星课程 ID 必须属于 starDouble`);
  }

  // ID 区间规则
  const lvNum = legacyIdOk ? parseInt(id.split('-')[2], 10) : 0;
  if (lvNum >= 1 && lvNum <= 20) {
    chk(gameId === 'starSingle', `${label}: ID 区间 01-20 必须为 starSingle, 实际 gameId=${gameId}`);
  }
  if (lvNum >= 21 && lvNum <= 30) {
    chk(gameId === 'starDouble', `${label}: ID 区间 21-30 必须为 starDouble, 实际 gameId=${gameId}`);
  }
  if (lvNum >= 31 && lvNum <= 70) {
    chk(gameId === 'starSingle', `${label}: ID 区间 31-70 必须为 starSingle, 实际 gameId=${gameId}`);
  }
  if (lvNum >= 71 && lvNum <= 120) {
    chk(gameId === 'starDouble', `${label}: ID 区间 71-120 必须为 starDouble, 实际 gameId=${gameId}`);
  }
  if (lvNum > 120) {
    fail(`${label}: star-lv 编号 ${lvNum} 超出 120 上限`);
  }

  // difficulty / difficultyBand 合法性
  if (difficulty) chk(VALID_DIFF.includes(difficulty), `${label}: difficulty='${difficulty}', 必须为 easy/medium/hard`);
  const VALID_BANDS = ['beginner', 'intermediate', 'advanced'];
  if (level.difficultyBand) {
    chk(VALID_BANDS.includes(level.difficultyBand), `${label}: difficultyBand='${level.difficultyBand}', 必须为 beginner/intermediate/advanced`);
  }

  // teachingFocus 非空
  chk(typeof level.teachingFocus === 'string' && level.teachingFocus.length > 0,
    `${label}: teachingFocus 缺失或为空`);

  // techniqueTags 存在且为非空数组
  const tags = level.techniqueTags;
  chk(Array.isArray(tags) && tags.length > 0, `${label}: techniqueTags 缺失或为空`);
}

// ── 旧30关不可变基线 ──
function validateStarLineBaseline() {
  if (!existsSync(BASELINE_PATH)) {
    fail('基线文件缺失: scripts/star-line-baseline.json');
    return;
  }
  let baseline;
  try { baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')); }
  catch (e) { fail(`基线文件无法解析: ${e.message}`); return; }
  if (!baseline.levels || baseline.levels.length < 30) {
    fail('基线文件缺少 levels 数组或不足30关');
    return;
  }
  const current = STAR_LINE_LEVELS.slice(0, 30);
  if (current.length < 30) { fail('当前关卡数据不足30关'); return; }
  for (let i = 0; i < 30; i++) {
    const bl = baseline.levels[i], cl = current[i], lid = cl?.id || `index-${i}`;
    chk(cl.id === bl.id, `旧30基线 [${i}]: ID 变化, 基线=${bl.id}, 实际=${cl.id}`);
    chk(cl.N === bl.N, `旧30基线 [${lid}]: N 变化, 基线=${bl.N}, 实际=${cl.N}`);
    chk(cl.starsPerRow === bl.quota && cl.starsPerCol === bl.quota && cl.starsPerRegion === bl.quota,
      `旧30基线 [${lid}]: quota 变化, 基线=${bl.quota}, 实际 row=${cl.starsPerRow} col=${cl.starsPerCol} reg=${cl.starsPerRegion}`);
    const solOk = cl.solution && bl.solution && cl.solution.length === bl.solution.length
      && cl.solution.every((v, j) => v === bl.solution[j]);
    chk(solOk, `旧30基线 [${lid}]: solution 变化`);
    const regOk = cl.regions && bl.regions && cl.regions.length === bl.regions.length
      && cl.regions.every((v, j) => v === bl.regions[j]);
    chk(regOk, `旧30基线 [${lid}]: regions 变化`);
  }
}

// ── main ──

console.log('Level validation started...\n');
console.log('Star Line 旧30关不可变基线:');
validateStarLineBaseline();

// Classic / Diagonal config
console.log('Mode movement + Classic / Diagonal config:');
validateModeMovement();
validateClassicConfig();
validateDiagonalConfig();

console.log('\nClassic / Diagonal generated samples:');
validateGeneratedSamples();

// Portal levels
const portalClassic = PORTAL_LEVELS;
chk(portalClassic.every(l => l.version !== 2), 'Portal Classic data file must not contain version: 2 levels');

console.log(`\nPortal Classic (${portalClassic.length} levels):`);
const pcIds = new Set();
for (const l of portalClassic) {
  if (pcIds.has(l.id)) fail(`Portal Classic: 重复 id: ${l.id}`);
  pcIds.add(l.id);
  validatePortalClassic(l);
  console.log(`  ✓ ${l.id}`);
}

// Star Line levels
console.log(`\nStar Line (${STAR_LINE_LEVELS.length} levels):`);
const slIds = new Set();
for (const l of STAR_LINE_LEVELS) {
  if (slIds.has(l.id)) fail(`Star Line: 重复 id: ${l.id}`);
  slIds.add(l.id);
  validateStarLine(l);
}
if (STAR_LINE_LEVELS.length === 0) {
  console.log('  (无关卡)');
} else {
  for (const l of STAR_LINE_LEVELS) {
    const hasError = errors.some(e => e.includes(`[${l.id}]`));
    console.log(`  ${hasError ? '✗' : '✓'} ${l.id}`);
  }
}

// Summary
console.log('\n──────────────────────────────');
if (warnings.length > 0) {
  console.log('\nWarnings:');
  warnings.forEach(w => console.log(`  ⚠ ${w}`));
}
console.log(`\nSummary:`);
console.log(`  Checks: ${checks.passed}/${checks.total} passed`);
console.log(`  Portal Classic: ${portalClassic.length} levels checked`);
console.log(`  Star Line: ${STAR_LINE_LEVELS.length} levels checked`);

if (errors.length > 0) {
  console.log(`\n  ❌ ${errors.length} error(s):`);
  errors.forEach(e => console.log(`     - ${e}`));
} else {
  console.log(`  ✓ 0 errors`);
}
if (warnings.length > 0) {
  console.log(`  ⚠ ${warnings.length} warning(s)`);
}

process.exit(errors.length > 0 ? 1 : 0);
