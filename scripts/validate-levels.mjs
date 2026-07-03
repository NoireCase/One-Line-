/**
 * One-Line 四玩法关卡 validator。
 * 运行：node scripts/validate-levels.mjs  或  npm run validate:levels
 */

import { CONFIG, createClassicLevel } from '../src/game/classic/createClassicLevel.js';
import { PORTAL_LEVELS } from '../src/data/portalLevels.js';
import { PORTAL_V2_LEVELS } from '../src/data/portalV2Levels.js';
import { MOVEMENT_TYPES, GAME_MODES, CLASSIC_STRUCTURE } from '../src/config/gameModes.js';
import { ORTHOGONAL_DIRECTIONS, ALL_DIRECTIONS, hasPathCrossing } from '../src/game/rules/movement.js';

// ── helpers ──

const ALL_DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

const VALID_GRID_SIZES = new Set([5, 7, 9]);
const PORTAL_CLASSIC_RULES = {
  movement: MOVEMENT_TYPES.diagonal,
  path: { allowCrossing: false, requireSequential: true, requireFullBoard: true }
};

function toCoord(idx, N) { return { r: Math.floor(idx / N), c: idx % N }; }
function toIdx(r, c, N) { return r * N + c; }
function inBounds(r, c, N) { return r >= 0 && r < N && c >= 0 && c < N; }

const errors = [];
const warnings = [];
let checks = { total: 0, passed: 0 };

function fail(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }
function ok() { checks.passed++; checks.total++; }
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
  chk(GAME_MODES['portalCollect'] !== undefined, 'portalCollect mode key 存在');
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

  // 无 Portal 2.0 字段
  chk(!('start' in level), `${label}: 不含 start（Portal 2.0 字段）`);
  chk(!('exit' in level), `${label}: 不含 exit`);
  chk(!('targets' in level), `${label}: 不含 targets`);
  chk(!('obstacles' in level), `${label}: 不含 obstacles`);
  chk(!('excellentSteps' in level), `${label}: 不含 excellentSteps`);
}

// ── 3. Portal Collect ──

function validatePortalCollect(level) {
  const { id, name, version, N, start, exit, targets, portals, obstacles, targetSteps, excellentSteps } = level;
  const label = `Portal Collect [${id}]`;

  chk(typeof id === 'string' && id.length > 0, `${label}: id 存在`);
  chk(typeof name === 'string' && name.length > 0, `${label}: name 存在`);
  chk(version === 2, `${label}: version === 2`);
  chk(VALID_GRID_SIZES.has(N), `${label}: N=${N} 合法`);
  chk(typeof start === 'number' && start >= 0 && start < N * N, `${label}: start=${start} 合法`);
  chk(typeof exit === 'number' && exit >= 0 && exit < N * N, `${label}: exit=${exit} 合法`);

  // 必需字段类型检查
  chk(Array.isArray(targets), `${label}: targets 是数组`);
  chk(targets.length >= 2, `${label}: targets 数量=${targets.length}, 期望 ≥2`);
  chk(Array.isArray(portals), `${label}: portals 是数组`);
  chk(portals.length >= 1, `${label}: portals.length=${portals.length}, 期望 ≥1`);
  chk(Array.isArray(obstacles), `${label}: obstacles 是数组`);

  // targets 内容
  if (Array.isArray(targets)) {
    chk(targets.every(t => typeof t === 'number' && t >= 0 && t < N * N), `${label}: targets 索引合法`);
    chk(new Set(targets).size === targets.length, `${label}: targets 无重复`);
  }

  // portals 内容
  if (Array.isArray(portals)) {
    const portalIds = new Set();
    const allPortalCells = [];
    let portalOk = true;
    for (const p of portals) {
      if (!p.id || portalIds.has(p.id)) { portalOk = false; break; }
      portalIds.add(p.id);
      if (!Array.isArray(p.cells) || p.cells.length !== 2) { portalOk = false; break; }
      if (p.cells[0] < 0 || p.cells[0] >= N*N || p.cells[1] < 0 || p.cells[1] >= N*N) { portalOk = false; break; }
      if (p.cells[0] === p.cells[1]) { portalOk = false; break; }
      allPortalCells.push(p.cells[0], p.cells[1]);
    }
    chk(portalOk, `${label}: portals 合法（id 唯一、cells 成对不重复、索引合法）`);
    if (portalOk) {
      chk(new Set(allPortalCells).size === allPortalCells.length, `${label}: portal cells 全局无重复`);
    }
  }

  // obstacles 内容
  if (Array.isArray(obstacles)) {
    chk(obstacles.every(o => typeof o === 'number' && o >= 0 && o < N * N), `${label}: obstacles 索引合法`);
    chk(new Set(obstacles).size === obstacles.length, `${label}: obstacles 无重复`);
  }

  // ── 重叠检查（pairwise） ──
  chk(start !== exit, `${label}: start(${start}) !== exit(${exit})`);

  const tSet = new Set(targets || []);
  chk(!tSet.has(start), `${label}: targets 不含 start`);
  chk(!tSet.has(exit), `${label}: targets 不含 exit`);

  const obsSet = new Set(obstacles || []);
  chk(!obsSet.has(start), `${label}: obstacles 不含 start`);
  chk(!obsSet.has(exit), `${label}: obstacles 不含 exit`);
  for (const t of (targets || [])) {
    chk(!obsSet.has(t), `${label}: obstacle 不含 target ${t}`);
  }

  for (const p of (portals || [])) {
    if (!Array.isArray(p.cells)) continue;
    for (const c of p.cells) {
      chk(c !== start, `${label}: portal cell ${c} 不是 start`);
      chk(c !== exit, `${label}: portal cell ${c} 不是 exit`);
      chk(!tSet.has(c), `${label}: portal cell ${c} 不是 target`);
      chk(!obsSet.has(c), `${label}: portal cell ${c} 不是 obstacle`);
    }
  }

  // targetSteps / excellentSteps
  chk(typeof targetSteps === 'number' && targetSteps > 0, `${label}: targetSteps=${targetSteps} > 0`);
  chk(typeof excellentSteps === 'number' && excellentSteps > 0, `${label}: excellentSteps=${excellentSteps} > 0`);
  chk(excellentSteps <= targetSteps, `${label}: excellentSteps(${excellentSteps}) <= targetSteps(${targetSteps})`);

  // reachability
  checkPortalCollectReachability(level, label);
}

// ── 4. Portal Collect reachability ──

function checkPortalCollectReachability(level, label) {
  const { N, start, exit, targets, portals, obstacles } = level;
  const obsSet = new Set(obstacles || []);
  const targetSet = new Set(targets || []);

  // portal 双向跳转映射
  const jumpMap = new Map();
  for (const p of (portals || [])) {
    if (!Array.isArray(p.cells)) continue;
    jumpMap.set(p.cells[0], p.cells[1]);
    jumpMap.set(p.cells[1], p.cells[0]);
  }

  // target bitmask
  const targetIdx = new Map();
  for (let i = 0; i < (targets || []).length; i++) targetIdx.set(targets[i], i);

  const ALL_COLLECTED = (1 << (targets || []).length) - 1;

  // BFS state: `${pos},${collectedMask}`
  const startMask = targetSet.has(start) ? (1 << targetIdx.get(start)) : 0;
  const visited = new Set();
  const queue = [{ pos: start, mask: startMask, steps: 0 }];
  visited.add(`${start},${startMask}`);

  let foundSolution = false;
  let shortestSteps = Infinity;

  while (queue.length > 0) {
    const { pos, mask, steps } = queue.shift();
    const allCollected = mask === ALL_COLLECTED;

    if (allCollected && pos === exit) {
      foundSolution = true;
      if (steps < shortestSteps) shortestSteps = steps;
      continue;
    }

    const { r, c } = toCoord(pos, N);

    for (const [dr, dc] of ALL_DIRS) {
      const nr = r + dr, nc = c + dc;
      if (!inBounds(nr, nc, N)) continue;
      let nextIdx = toIdx(nr, nc, N);

      if (obsSet.has(nextIdx)) continue;

      // exit blocked until all collected
      if (nextIdx === exit && !allCollected) continue;

      // portal auto-teleport
      if (jumpMap.has(nextIdx)) {
        const jumpTarget = jumpMap.get(nextIdx);
        if (!obsSet.has(jumpTarget)) {
          nextIdx = jumpTarget;
        }
      }

      let newMask = mask;
      if (targetSet.has(nextIdx)) newMask |= (1 << targetIdx.get(nextIdx));

      const key = `${nextIdx},${newMask}`;
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ pos: nextIdx, mask: newMask, steps: steps + 1 });
      }
    }
  }

  if (foundSolution) {
    ok();
    if (shortestSteps !== Infinity) {
      // excellentSteps < shortestSteps 是数据错误，三星不可达成
      chk(level.excellentSteps >= shortestSteps,
        `${label}: excellentSteps(${level.excellentSteps}) >= 最短步数(${shortestSteps})`);

      if (level.targetSteps > shortestSteps + 15) {
        warn(`${label}: targetSteps(${level.targetSteps}) 远大于最短步数(${shortestSteps})，可能过于宽松`);
      }
    }
  } else {
    fail(`${label}: 无可达解！从 start 出发无法收集所有 targets 并抵达 exit`);
  }
}

// ── main ──

console.log('Level validation started...\n');

// Classic / Diagonal config
console.log('Mode movement + Classic / Diagonal config:');
validateModeMovement();
validateClassicConfig();
validateDiagonalConfig();

console.log('\nClassic / Diagonal generated samples:');
validateGeneratedSamples();

// Portal levels
const portalClassic = PORTAL_LEVELS;
const portalCollect = PORTAL_V2_LEVELS;
chk(portalClassic.every(l => l.version !== 2), 'Portal Classic data file must not contain version: 2 levels');
chk(portalCollect.every(l => l.version === 2), 'Portal V2 data file must contain only version: 2 levels');

console.log(`\nPortal Classic (${portalClassic.length} levels):`);
const pcIds = new Set();
for (const l of portalClassic) {
  if (pcIds.has(l.id)) fail(`Portal Classic: 重复 id: ${l.id}`);
  pcIds.add(l.id);
  validatePortalClassic(l);
  console.log(`  ✓ ${l.id}`);
}

console.log(`\nPortal Collect (${portalCollect.length} levels):`);
const p2Ids = new Set();
for (const l of portalCollect) {
  if (p2Ids.has(l.id)) fail(`Portal Collect: 重复 id: ${l.id}`);
  p2Ids.add(l.id);
  validatePortalCollect(l);
  console.log(`  ✓ ${l.id}`);
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
console.log(`  Portal Collect: ${portalCollect.length} levels checked`);

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
