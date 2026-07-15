#!/usr/bin/env node
/**
 * Star Line 候选关卡生成器。
 * 用法: node scripts/generate-star-line-candidates.mjs --mode starSingle --size 5 --count 10 --seed 42 --output single-5x5.json
 * 输出固定于 tmp/star-line-candidates/ 下。生成不足 count 时非零退出。
 *
 * Package 2B.1: 批量去重 + D4 签名 + 多模板
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

const _BASE_TEMPLATE = [
  // star-lv-20 regions
  0,0,0,1,1,1,1,1,1,1, 0,0,1,1,0,1,2,2,2,1, 0,0,0,0,0,2,2,1,1,1, 0,4,0,2,2,2,2,2,2,2, 0,4,0,0,0,2,2,2,5,2, 0,9,3,0,0,2,7,5,5,2, 8,9,3,3,0,6,7,5,7,7, 8,9,9,3,0,6,7,5,5,7, 9,9,3,3,0,6,7,7,7,7, 9,9,3,3,0,6,7,7,7,7,
];

/**
 * 从基础模板通过行列置换派生新模板。
 * 置换保持 puzzle 的数学结构，生成非同构布局。
 */
function _deriveTemplate(N, base, permSeed) {
  const total = N * N;
  const rand = mulberry32(permSeed);
  const cols = seededShuffle(Array.from({ length: N }, (_, i) => i), rand);
  const rows = seededShuffle(Array.from({ length: N }, (_, i) => i), rand);
  const out = new Array(total);
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      out[r * N + c] = base[rows[r] * N + cols[c]];
  return out;
}

/** 通过单格移动从基础模板派生新模板（固定 seed，启动时预计算） */
function _mutateTemplateHeavy(N, base, mutSeed) {
  const total = N * N;
  const rand = mulberry32(mutSeed);
  const regions = [...base];
  const moves = 10 + Math.floor(rand() * 20); // 10-29 次单格移动

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

  let applied = 0, attempts = 0;
  while (applied < moves && attempts < 500) {
    attempts++;
    const cell = Math.floor(rand() * total);
    const r = Math.floor(cell / N), c = cell % N;
    const oldRid = regions[cell];
    const adjDiffs = [];
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
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

  // solver 验证
  let sr;
  try { sr = solveStarLine(N, regions, { starsPerRow: 1, starsPerCol: 1, starsPerRegion: 1 }); }
  catch (_) { return null; }
  if (sr.status !== 'UNIQUE') return null;
  return regions;
}

/** 初始化模板池：基础 + 变异派生 + D4 去重 + 几何变换 */
function _build10x10Templates() {
  const N = 10, total = N * N;

  function hFlip(regs) { const o = new Array(total); for (let i = 0; i < total; i++) { const r = Math.floor(i / N), c = i % N; o[(N - 1 - r) * N + c] = regs[i]; } return o; }
  function vFlip(regs) { const o = new Array(total); for (let i = 0; i < total; i++) { const r = Math.floor(i / N), c = i % N; o[r * N + (N - 1 - c)] = regs[i]; } return o; }
  function rot90(regs) { const o = new Array(total); for (let i = 0; i < total; i++) { const r = Math.floor(i / N), c = i % N; o[c * N + (N - 1 - r)] = regs[i]; } return o; }
  function transpose(regs) { const o = new Array(total); for (let i = 0; i < total; i++) { const r = Math.floor(i / N), c = i % N; o[c * N + r] = regs[i]; } return o; }

  // 基础 + 行列置换 + 单格移动变异
  const bases = [_BASE_TEMPLATE];

  // 行列置换派生（保持唯一解）
  for (const ps of [377, 610, 987]) {
    const d = _deriveTemplate(N, _BASE_TEMPLATE, ps);
    if (d) bases.push(d);
  }

  // 单格移动派生（改变面积轮廓，固定 seed）
  for (const ms of [7, 47, 66]) {
    const m = _mutateTemplateHeavy(N, _BASE_TEMPLATE, ms);
    if (m) bases.push(m);
  }

  // D4 去重
  const seenSigs = new Set();
  const uniqueBases = [];
  for (const base of bases) {
    const sig = canonicalizeRegions(base, N);
    if (!seenSigs.has(sig)) { seenSigs.add(sig); uniqueBases.push(base); }
  }

  // 几何变换
  const templates = [];
  for (const base of uniqueBases) {
    templates.push(base, hFlip(base), vFlip(base), rot90(base), transpose(base));
  }

  return templates;
}

const SINGLE_STAR_10X10_TEMPLATES = _build10x10Templates();

/**
 * 多尺寸区域生成入口。
 */
function generateRegions(N, rand) {
  if (N <= 9) return _generateRegionsSmall(N, rand);
  return _generateRegionsTemplate(N, rand);
}

/** N ≤ 9: 纯随机蛇形扩张 */
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

/** N = 10: 模板变异（保留连通性） */
function _generateRegionsTemplate(N, rand) {
  const total = N * N;
  const templateIdx = Math.floor(rand() * SINGLE_STAR_10X10_TEMPLATES.length);
  const base = SINGLE_STAR_10X10_TEMPLATES[templateIdx];
  const regions = [...base];

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

  const mutations = Math.floor(rand() * 7) + 2; // 2-8 次变异
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
        generationMetadata: { generatorVersion: '2.0.0', seed, parameters: { mode: 'starDouble', N, quota: 2, index }, attempts: attempt + 1 },
      };
    }
  }
  return null;
}

// ═══ 主流程 ═══

function main() {
  const args=parseArgs();
  if(!args.mode||!args.size||!args.output)usage();
  const mode=args.mode;
  if(mode!=='starSingle'&&mode!=='starDouble'){console.error('--mode 必须是 starSingle 或 starDouble');process.exit(1);}
  const N=parseInt(args.size,10);
  if(isNaN(N)||N<5||N>10){console.error('--size 必须是 5-10');process.exit(1);}
  const count=parseInt(args.count||'10',10);
  if(isNaN(count)||count<1){console.error('--count 必须是正整数');process.exit(1);}
  const seed=parseInt(args.seed||'1',10);
  if(isNaN(seed)){console.error('--seed 必须是整数');process.exit(1);}

  let outputPath;
  try{outputPath=resolveCandidatePath(args.output);}catch(e){console.error(e.message);process.exit(1);}

  const quota=mode==='starSingle'?1:2;
  const candidates=[];
  const seenSolutionSigs = new Set();
  const seenRegionSigs = new Set();
  const MAX_TOTAL = count * 500;
  let totalAttempts=0, failReasons={};

  if (quota === 2) {
    for (let i = 0; i < count; i++) {
      const cand = generateDoubleStarCandidate(N, seed, i);
      if (cand) { candidates.push(cand); }
      else { failReasons['maxed-out'] = (failReasons['maxed-out'] || 0) + 1; }
    }
  } else {
    for (let i = 0; i < count; i++) {
      let ok = false;
      for (let a = 0; a < 500 && totalAttempts < MAX_TOTAL; a++, totalAttempts++) {
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
          generationMetadata: { generatorVersion: '2.0.0', seed, parameters: { mode: 'starSingle', N, quota, index: i }, attempts: a + 1 },
        });
        ok = true; break;
      }
      if (!ok) { failReasons['maxed-out'] = (failReasons['maxed-out'] || 0) + 1; }
    }
  }

  if(candidates.length<count){
    console.error(`生成不足: 请求 ${count}, 成功 ${candidates.length}, 总尝试 ${totalAttempts}`);
    console.error(`mode=${mode} size=${N} seed=${seed}`);
    for(const[k,v]of Object.entries(failReasons))console.error(`  ${k}: ${v}`);
    process.exit(1);
  }

  const output={
    generatorVersion: '2.0.0',
    parameters: { mode, N, quota, count, seed },
    candidates,
  };
  try{safeWriteJSON(outputPath,output,{force:!!args.force});}catch(e){console.error(e.message);process.exit(1);}
  console.log(`完成: ${candidates.length}/${count} 候选 (唯一解, 去重后), 输出 ${outputPath}`);
}
main();
