#!/usr/bin/env node
/**
 * Star Line 候选关卡生成器。
 * 用法: node scripts/generate-star-line-candidates.mjs --mode starSingle --size 5 --count 10 --seed 42 --output single-5x5.json
 * 输出固定于 tmp/star-line-candidates/ 下。生成不足 count 时非零退出。
 *
 * Package 2B.2: 清理模板池 + 诊断导出 + 可控 attempts
 */
import { resolveCandidatePath, safeWriteJSON } from './lib/star-line-candidate-io.mjs';
import { solveStarLine } from './starLineSolver.mjs';
import {
  makeSolutionSig,
  makeCanonicalRegionSig,
  canonicalizeRegions,
} from './star-line-candidate-signatures.mjs';

function parseArgs() {
  const a = process.argv.slice(2), p = {};
  for (let i = 0; i < a.length; i++) {
    const k = a[i].replace(/^--?/, '');
    if (k === 'force') { p.force = true; continue; }
    p[k] = a[i + 1]; i++;
  }
  return p;
}
function usage() { console.log('用法: node scripts/generate-star-line-candidates.mjs --mode <mode> --size <5-10> --count <n> --seed <n> --output <path> [--force]'); process.exit(1); }

function mulberry32(a) { return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function seededShuffle(arr, rand) { const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(rand()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

// ═══ 10×10 单星模板 ═══

const _BASE_TEMPLATE = Object.freeze([
  // star-lv-20 regions
  0,0,0,1,1,1,1,1,1,1, 0,0,1,1,0,1,2,2,2,1, 0,0,0,0,0,2,2,1,1,1, 0,4,0,2,2,2,2,2,2,2, 0,4,0,0,0,2,2,2,5,2, 0,9,3,0,0,2,7,5,5,2, 8,9,3,3,0,6,7,5,7,7, 8,9,9,3,0,6,7,5,5,7, 9,9,3,3,0,6,7,7,7,7, 9,9,3,3,0,6,7,7,7,7,
]);

/** 验证基础模板合法性：覆盖、区域数、连通 */
function _validateBaseTemplate(regions, N) {
  const total = N * N;
  if (!Array.isArray(regions) || regions.length !== total) return 'wrong length';
  const ridSet = new Set(regions);
  if (ridSet.size !== N) return `expected ${N} regions, got ${ridSet.size}`;
  for (let i = 0; i < total; i++) {
    if (!Number.isInteger(regions[i]) || regions[i] < 0 || regions[i] >= N)
      return `invalid region id at ${i}: ${regions[i]}`;
  }
  // 连通性
  for (let rid = 0; rid < N; rid++) {
    const cells = [];
    for (let i = 0; i < total; i++) if (regions[i] === rid) cells.push(i);
    if (cells.length === 0) return `region ${rid} is empty`;
    const vis = new Set([cells[0]]), q = [cells[0]];
    while (q.length) {
      const cur = q.shift(), r = Math.floor(cur / N), c = cur % N;
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
        const ni = nr * N + nc;
        if (regions[ni] === rid && !vis.has(ni)) { vis.add(ni); q.push(ni); }
      }
    }
    if (vis.size !== cells.length) return `region ${rid} not connected`;
  }
  return null; // OK
}

/** 通过单格移动从基础模板派生新模板（固定 seed，连通性验证） */
function _mutateTemplateHeavy(N, base, mutSeed) {
  const total = N * N;
  const rand = mulberry32(mutSeed);
  const regions = [...base];
  const moves = 10 + Math.floor(rand() * 20);

  function ridConnected(regs, rid) {
    let start = -1;
    for (let i = 0; i < total; i++) if (regs[i] === rid) { start = i; break; }
    if (start === -1) return false;
    const vis = new Set([start]), q = [start];
    while (q.length) {
      const cur = q.shift(), r = Math.floor(cur / N), c = cur % N;
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
        const ni = nr * N + nc;
        if (regs[ni] === rid && !vis.has(ni)) { vis.add(ni); q.push(ni); }
      }
    }
    let expected = 0;
    for (let i = 0; i < total; i++) if (regs[i] === rid) expected++;
    return vis.size === expected;
  }

  let applied = 0, attempts = 0;
  while (applied < moves && attempts < 500) {
    attempts++;
    const cell = Math.floor(rand() * total);
    const r = Math.floor(cell / N), c = cell % N;
    const oldRid = regions[cell];
    const adjDiffs = [];
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
      const ni = nr * N + nc;
      if (regions[ni] !== oldRid) adjDiffs.push(regions[ni]);
    }
    if (adjDiffs.length === 0) continue;
    const newRid = adjDiffs[Math.floor(rand() * adjDiffs.length)];
    const prev = regions[cell];
    regions[cell] = newRid;
    if (ridConnected(regions, oldRid) && ridConnected(regions, newRid)) {
      applied++;
    } else {
      regions[cell] = prev;
    }
  }

  // solver 验证 UNIQUE
  let sr;
  try { sr = solveStarLine(N, regions, { starsPerRow: 1, starsPerCol: 1, starsPerRegion: 1 }); }
  catch (_) { return null; }
  if (sr.status !== 'UNIQUE') return null;
  return regions;
}

/**
 * 初始化模板池。
 * 只使用经过验证的合法基础模板 + D4 几何变换（旋转/翻转/对角线反射）。
 * 不使用任意行列置换。
 */
function _build10x10Templates() {
  const N = 10, total = N * N;

  // D4 几何变换（保持正交邻接）
  function hFlip(regs) { const o = new Array(total); for (let i = 0; i < total; i++) { const r = Math.floor(i / N), c = i % N; o[(N - 1 - r) * N + c] = regs[i]; } return o; }
  function vFlip(regs) { const o = new Array(total); for (let i = 0; i < total; i++) { const r = Math.floor(i / N), c = i % N; o[r * N + (N - 1 - c)] = regs[i]; } return o; }
  function rot90(regs)  { const o = new Array(total); for (let i = 0; i < total; i++) { const r = Math.floor(i / N), c = i % N; o[c * N + (N - 1 - r)] = regs[i]; } return o; }
  function transp(regs) { const o = new Array(total); for (let i = 0; i < total; i++) { const r = Math.floor(i / N), c = i % N; o[c * N + r] = regs[i]; } return o; }

  // 基础模板来源：原始模板 + 单格移动变异
  const candidates = [_BASE_TEMPLATE];
  for (const ms of [7, 47, 66]) {
    const m = _mutateTemplateHeavy(N, _BASE_TEMPLATE, ms);
    if (m) candidates.push(m);
  }

  // 验证每个候选基础模板
  const validBases = [];
  for (const base of candidates) {
    const err = _validateBaseTemplate(base, N);
    if (err) {
      // 模板初始化失败是致命错误，抛错而非静默跳过
      throw new Error(`[Template Pool] base template validation failed: ${err}`);
    }
    validBases.push(base);
  }

  // D4 去重
  const seenSigs = new Set();
  const uniqueBases = [];
  for (const base of validBases) {
    const sig = canonicalizeRegions(base, N);
    if (!seenSigs.has(sig)) {
      seenSigs.add(sig);
      uniqueBases.push(base);
    }
  }

  // 几何变换展开
  const templates = [];
  for (const base of uniqueBases) {
    templates.push(
      [...base],
      hFlip(base),
      vFlip(base),
      rot90(base),
      transp(base),
    );
  }

  return { templates, uniqueBases };
}

const _templatePool = _build10x10Templates();
const SINGLE_STAR_10X10_TEMPLATES = _templatePool.templates;
const SINGLE_STAR_10X10_BASES = _templatePool.uniqueBases;

// ═══ 诊断导出（仅用于测试） ═══

/**
 * 返回模板池只读诊断信息。
 * 仅供测试使用，不进入候选 JSON、报告或正式关卡数据。
 */
export function getTemplatePoolDiagnostics() {
  const N = 10;
  return {
    baseCount: SINGLE_STAR_10X10_BASES.length,
    totalTemplateCount: SINGLE_STAR_10X10_TEMPLATES.length,
    bases: SINGLE_STAR_10X10_BASES.map((base, idx) => {
      const areas = {};
      for (const rid of base) areas[rid] = (areas[rid] || 0) + 1;
      return {
        index: idx,
        canonicalSignature: canonicalizeRegions(base, N),
        areaProfile: Object.values(areas).sort((a, b) => a - b),
        isValid: _validateBaseTemplate(base, N) === null,
      };
    }),
  };
}

/**
 * 返回固定 seed 下连续 count 次模板选择的模板族索引序列。
 * 仅供测试使用。
 */
export function getSeedTemplateSequence(seed, count) {
  const N = 10;
  const sequence = [];
  for (let i = 0; i < count; i++) {
    const rand = mulberry32(seed + i * 31337);
    const idx = Math.floor(rand() * SINGLE_STAR_10X10_TEMPLATES.length);
    // 每 5 个几何变体对应一个基础模板族
    const familyIdx = Math.floor(idx / 5);
    sequence.push({ step: i, templateIdx: idx, familyIdx, inRange: familyIdx < SINGLE_STAR_10X10_BASES.length });
  }
  return sequence;
}

// ═══ 区域生成 ═══

function generateRegions(N, rand) {
  if (N <= 9) return _generateRegionsSmall(N, rand);
  return _generateRegionsTemplate(N, rand);
}

function _generateRegionsSmall(N, rand) {
  const total = N * N;
  const allCells = Array.from({ length: total }, (_, i) => i);
  const shuffled = seededShuffle(allCells, rand);
  const seeds = shuffled.slice(0, N);
  const regions = new Array(total).fill(-1);
  const assigned = new Set(seeds);
  const growthHeads = [...seeds];
  for (let i = 0; i < N; i++) regions[seeds[i]] = i;
  let stallCount = 0;
  const STALL_LIMIT = total * 3;
  while (assigned.size < total && stallCount < STALL_LIMIT) {
    const sizes = [];
    for (let rid = 0; rid < N; rid++) {
      let sz = 0;
      for (let i = 0; i < total; i++) if (regions[i] === rid) sz++;
      sizes.push({ rid, size: sz });
    }
    sizes.sort((a, b) => a.size - b.size);
    let anyGrew = false;
    for (const { rid } of sizes) {
      if (assigned.size >= total) break;
      const head = growthHeads[rid];
      const hr = Math.floor(head / N), hc = head % N;
      const dirs = seededShuffle([[0, 1], [0, -1], [1, 0], [-1, 0]], rand);
      let grew = false;
      for (const [dr, dc] of dirs) {
        const nr = hr + dr, nc = hc + dc;
        if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
        if (!assigned.has(nr * N + nc)) {
          const ni = nr * N + nc;
          assigned.add(ni); regions[ni] = rid; growthHeads[rid] = ni;
          grew = true; anyGrew = true; break;
        }
      }
      if (!grew) {
        for (let i = 0; i < total; i++) {
          if (regions[i] !== rid) continue;
          const r = Math.floor(i / N), c = i % N;
          for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
            const ni = nr * N + nc;
            if (!assigned.has(ni)) {
              assigned.add(ni); regions[ni] = rid; growthHeads[rid] = ni;
              grew = true; anyGrew = true; break;
            }
          }
          if (grew) break;
        }
      }
    }
    if (!anyGrew) {
      stallCount++;
      for (let i = 0; i < total; i++) {
        if (regions[i] !== -1) continue;
        const r = Math.floor(i / N), c = i % N;
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
          if (regions[nr * N + nc] >= 0) {
            assigned.add(i); regions[i] = regions[nr * N + nc];
            growthHeads[regions[nr * N + nc]] = i;
            anyGrew = true; break;
          }
        }
        if (anyGrew) break;
      }
    } else { stallCount = 0; }
  }
  return regions;
}

function _generateRegionsTemplate(N, rand) {
  const total = N * N;
  const templateIdx = Math.floor(rand() * SINGLE_STAR_10X10_TEMPLATES.length);
  // 浅拷贝模板数组，避免污染共享池
  const regions = [...SINGLE_STAR_10X10_TEMPLATES[templateIdx]];

  function ridConnected(regs, rid) {
    let start = -1;
    for (let i = 0; i < total; i++) if (regs[i] === rid) { start = i; break; }
    if (start === -1) return false;
    const vis = new Set([start]), q = [start];
    while (q.length) {
      const cur = q.shift(), r = Math.floor(cur / N), c = cur % N;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
        const ni = nr * N + nc;
        if (regs[ni] === rid && !vis.has(ni)) { vis.add(ni); q.push(ni); }
      }
    }
    let expected = 0;
    for (let i = 0; i < total; i++) if (regs[i] === rid) expected++;
    return vis.size === expected;
  }

  const mutations = Math.floor(rand() * 7) + 2;
  let applied = 0, attempts = 0;
  const MAX_MUT_ATTEMPTS = 200;
  while (applied < mutations && attempts < MAX_MUT_ATTEMPTS) {
    attempts++;
    const cell = Math.floor(rand() * total);
    const r = Math.floor(cell / N), c = cell % N;
    const oldRid = regions[cell];
    const diffNeighbors = [];
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
      const ni = nr * N + nc;
      if (regions[ni] !== oldRid) diffNeighbors.push({ idx: ni, rid: regions[ni] });
    }
    if (diffNeighbors.length === 0) continue;
    const pick = diffNeighbors[Math.floor(rand() * diffNeighbors.length)];
    const prevA = regions[cell], prevB = regions[pick.idx];
    regions[cell] = pick.rid;
    regions[pick.idx] = oldRid;
    if (ridConnected(regions, pick.rid) && ridConnected(regions, oldRid)) {
      applied++;
    } else {
      regions[cell] = prevA;
      regions[pick.idx] = prevB;
    }
  }
  return regions;
}

function regionConnected(regions,N,rid){
  const cells=[];for(let i=0;i<N*N;i++)if(regions[i]===rid)cells.push(i);
  if(!cells.length)return true;
  const vis=new Set([cells[0]]),q=[cells[0]];
  while(q.length){const cur=q.shift(),r=Math.floor(cur/N),c=cur%N;for(const[dr,dc]of[[-1,0],[1,0],[0,-1],[0,1]]){const nr=r+dr,nc=c+dc;if(nr<0||nr>=N||nc<0||nc>=N)continue;const ni=nr*N+nc;if(regions[ni]===rid&&!vis.has(ni)){vis.add(ni);q.push(ni);}}}
  return vis.size===cells.length;
}
function allConnected(regions,N){for(let rid=0;rid<N;rid++)if(!regionConnected(regions,N,rid))return false;return true;}

// ── Double-star generator ──

function getDoubleStarTemplates(N) {
  if (N !== 8) return [];
  return [
    [0,0,0,1,1,1,1,3,0,0,0,1,1,2,2,3,0,0,0,1,2,2,2,3,4,4,5,1,2,2,3,3,4,4,5,5,2,6,7,3,4,4,5,5,6,6,7,7,4,5,5,6,6,6,7,7,4,4,5,6,6,7,7,7],
    [0,0,1,1,1,2,3,3,0,0,1,1,2,2,3,3,0,0,0,1,2,2,3,3,4,0,5,1,2,2,3,3,4,5,5,5,6,2,7,7,4,4,5,6,6,2,7,7,4,4,5,5,6,7,7,7,4,4,6,6,6,6,7,7],
    [0,0,0,1,1,2,3,3,0,0,0,1,2,2,3,3,0,0,0,1,2,2,3,4,5,5,6,1,2,3,4,4,5,5,6,2,7,7,4,4,5,6,6,7,7,7,4,5,5,6,6,7,7,7,4,4,5,6,6,6,7,7,7,4],
  ];
}

function mutateRegions(baseRegions, N, rand) {
  const regions = [...baseRegions];
  const total = N * N;
  const swaps = Math.floor(rand() * 6) + 2;
  for (let s = 0; s < swaps; s++) {
    const cell = Math.floor(rand() * total);
    const r = Math.floor(cell / N), c = cell % N;
    const oldRid = regions[cell];
    const adjOptions = [];
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
      const ni = nr * N + nc;
      if (regions[ni] !== oldRid) adjOptions.push(regions[ni]);
    }
    if (adjOptions.length > 0) {
      const newRid = adjOptions[Math.floor(rand() * adjOptions.length)];
      regions[cell] = newRid;
    }
  }
  return regions;
}

function generateDoubleStarCandidate(N, seed, index) {
  if (N !== 8) return null;
  const templates = getDoubleStarTemplates(N);
  const rand = mulberry32(seed + index * 31337);
  const templateIdx = Math.floor(rand() * templates.length);
  const baseRegions = templates[templateIdx];
  for (let attempt = 0; attempt < 200; attempt++) {
    const r2 = mulberry32(seed + index * 31337 + attempt * 7919);
    const regions = mutateRegions(baseRegions, N, r2);
    if (!allConnected(regions, N)) continue;
    const sr = solveStarLine(N, regions, { starsPerRow: 2, starsPerCol: 2, starsPerRegion: 2 });
    if (sr.status === 'UNIQUE') {
      return {
        candidateId: `star-double-${N}x${N}-s${seed}-i${index}`,
        seed, gameId: 'starDouble', N,
        starsPerRow: 2, starsPerCol: 2, starsPerRegion: 2,
        regions, solution: sr.solutions[0],
        generationMetadata: { generatorVersion: '2.1.0', seed, parameters: { mode: 'starDouble', N, quota: 2, index }, attempts: attempt + 1 },
      };
    }
  }
  return null;
}

// ═══ 内部生成函数（可由 CLI 和测试共同调用） ═══

const DEFAULT_ATTEMPTS_PER_CANDIDATE = 500;

/**
 * 生成候选关卡的核心函数。
 *
 * @param {object} opts
 * @param {string} opts.mode        - 'starSingle' | 'starDouble'
 * @param {number} opts.N           - 棋盘边长
 * @param {number} opts.count       - 目标候选数量
 * @param {number} opts.seed        - 随机种子
 * @param {string} opts.output      - 输出文件名（相对于 candidate root）
 * @param {boolean} [opts.force]     - 是否覆盖已有文件
 * @param {number} [opts.maxTotalAttempts] - 最大总尝试次数（默认 count * 500）
 * @returns {object} { success: boolean, candidates: [], stats: { totalAttempts, failReasons } }
 */
export function generateCandidates(opts) {
  const { mode, N, count, seed, output, force, maxTotalAttempts } = opts;
  const quota = mode === 'starSingle' ? 1 : 2;
  const candidates = [];
  const seenSolutionSigs = new Set();
  const seenRegionSigs = new Set();
  const MAX_TOTAL = maxTotalAttempts ?? count * DEFAULT_ATTEMPTS_PER_CANDIDATE;
  let totalAttempts = 0, failReasons = {};

  if (quota === 2) {
    for (let i = 0; i < count; i++) {
      const cand = generateDoubleStarCandidate(N, seed, i);
      if (cand) { candidates.push(cand); }
      else { failReasons['maxed-out'] = (failReasons['maxed-out'] || 0) + 1; }
    }
  } else {
    for (let i = 0; i < count; i++) {
      let ok = false;
      for (let a = 0; a < DEFAULT_ATTEMPTS_PER_CANDIDATE && totalAttempts < MAX_TOTAL; a++, totalAttempts++) {
        const rand = mulberry32(seed + i * 31337 + a * 7919);
        const regions = generateRegions(N, rand);
        if (!allConnected(regions, N)) { failReasons['not-connected'] = (failReasons['not-connected'] || 0) + 1; continue; }
        const sr = solveStarLine(N, regions, { starsPerRow: quota, starsPerCol: quota, starsPerRegion: quota });
        if (sr.status !== 'UNIQUE') { failReasons[sr.status] = (failReasons[sr.status] || 0) + 1; continue; }

        const solution = sr.solutions[0];

        const solSig = makeSolutionSig(mode, N, quota, solution);
        if (seenSolutionSigs.has(solSig)) {
          failReasons['dup-solution'] = (failReasons['dup-solution'] || 0) + 1;
          continue;
        }
        const regionSig = makeCanonicalRegionSig(mode, N, quota, regions);
        if (seenRegionSigs.has(regionSig)) {
          failReasons['dup-region-d4'] = (failReasons['dup-region-d4'] || 0) + 1;
          continue;
        }

        seenSolutionSigs.add(solSig);
        seenRegionSigs.add(regionSig);

        candidates.push({
          candidateId: `star-single-${N}x${N}-s${seed}-i${i}`,
          seed, gameId: 'starSingle', N,
          starsPerRow: quota, starsPerCol: quota, starsPerRegion: quota,
          regions, solution,
          solutionSignature: solSig,
          canonicalRegionSignature: regionSig,
          generationMetadata: { generatorVersion: '2.1.0', seed, parameters: { mode: 'starSingle', N, quota, index: i }, attempts: a + 1 },
        });
        ok = true; break;
      }
      if (!ok) { failReasons['maxed-out'] = (failReasons['maxed-out'] || 0) + 1; }
    }
  }

  const stats = { totalAttempts, failReasons };

  if (candidates.length < count) {
    const err = new Error(`生成不足: 请求 ${count}, 成功 ${candidates.length}, 总尝试 ${totalAttempts}`);
    err.code = 'INSUFFICIENT_CANDIDATES';
    err.stats = stats;
    // 不写输出文件
    throw err;
  }

  // 写入输出
  const outputObj = {
    generatorVersion: '2.1.0',
    parameters: { mode, N, quota, count, seed },
    candidates,
  };
  const outputPath = resolveCandidatePath(output);
  safeWriteJSON(outputPath, outputObj, { force: !!force });

  return { success: true, candidates, stats, outputPath };
}

// ═══ CLI 入口（仅在直接执行时运行） ═══

function main() {
  const args = parseArgs();
  if (!args.mode || !args.size || !args.output) usage();
  const mode = args.mode;
  if (mode !== 'starSingle' && mode !== 'starDouble') { console.error('--mode 必须是 starSingle 或 starDouble'); process.exit(1); }
  const N = parseInt(args.size, 10);
  if (isNaN(N) || N < 5 || N > 10) { console.error('--size 必须是 5-10'); process.exit(1); }
  const count = parseInt(args.count || '10', 10);
  if (isNaN(count) || count < 1) { console.error('--count 必须是正整数'); process.exit(1); }
  const seed = parseInt(args.seed || '1', 10);
  if (isNaN(seed)) { console.error('--seed 必须是整数'); process.exit(1); }

  try {
    const result = generateCandidates({
      mode, N, count, seed,
      output: args.output,
      force: !!args.force,
    });
    console.log(`完成: ${result.candidates.length}/${count} 候选 (唯一解, 去重后), 输出 ${result.outputPath}`);
  } catch (e) {
    console.error(e.message);
    if (e.stats) {
      console.error(`mode=${mode} size=${N} seed=${seed}`);
      for (const [k, v] of Object.entries(e.stats.failReasons)) console.error(`  ${k}: ${v}`);
    }
    process.exit(1);
  }
}

const __filename = import.meta.url.replace('file://', '');
if (process.argv[1] === __filename) {
  main();
}
