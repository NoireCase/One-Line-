#!/usr/bin/env node
/**
 * Star Line 候选关卡生成器。
 * 用法: node scripts/generate-star-line-candidates.mjs --mode starSingle --size 5 --count 10 --seed 42 --output single-5x5.json
 * 输出固定于 tmp/star-line-candidates/ 下。生成不足 count 时非零退出。
 */
import { resolveCandidatePath, safeWriteJSON } from './lib/star-line-candidate-io.mjs';
import { solveStarLine } from './starLineSolver.mjs';

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

// ═══ 10×10 单星模板（从已验证唯一解关卡派生） ═══
// star-lv-20 base regions + 几何变换变体
const _BASE_TEMPLATE = [
  // star-lv-20: solution [9,17,24,31,48,56,60,72,85,93]
  0,0,0,1,1,1,1,1,1,1, 0,0,1,1,0,1,2,2,2,1, 0,0,0,0,0,2,2,1,1,1, 0,4,0,2,2,2,2,2,2,2, 0,4,0,0,0,2,2,2,5,2, 0,9,3,0,0,2,7,5,5,2, 8,9,3,3,0,6,7,5,7,7, 8,9,9,3,0,6,7,5,5,7, 9,9,3,3,0,6,7,7,7,7, 9,9,3,3,0,6,7,7,7,7,
];

// 生成几何变换变体
function _build10x10Templates() {
  const N = 10;
  const total = N * N;
  const templates = [_BASE_TEMPLATE];

  // Horizontal flip: (r, c) → (N-1-r, c)
  function hFlip(regs) {
    const out = new Array(total);
    for (let i = 0; i < total; i++) {
      const r = Math.floor(i / N), c = i % N;
      out[(N - 1 - r) * N + c] = regs[i];
    }
    return out;
  }
  // Vertical flip: (r, c) → (r, N-1-c)
  function vFlip(regs) {
    const out = new Array(total);
    for (let i = 0; i < total; i++) {
      const r = Math.floor(i / N), c = i % N;
      out[r * N + (N - 1 - c)] = regs[i];
    }
    return out;
  }
  // Rotate 90°: (r, c) → (c, N-1-r)
  function rot90(regs) {
    const out = new Array(total);
    for (let i = 0; i < total; i++) {
      const r = Math.floor(i / N), c = i % N;
      out[c * N + (N - 1 - r)] = regs[i];
    }
    return out;
  }
  // Transpose: (r, c) → (c, r)
  function transpose(regs) {
    const out = new Array(total);
    for (let i = 0; i < total; i++) {
      const r = Math.floor(i / N), c = i % N;
      out[c * N + r] = regs[i];
    }
    return out;
  }

  templates.push(hFlip(_BASE_TEMPLATE));
  templates.push(vFlip(_BASE_TEMPLATE));
  templates.push(rot90(_BASE_TEMPLATE));
  templates.push(transpose(_BASE_TEMPLATE));

  return templates;
}

const SINGLE_STAR_10X10_TEMPLATES = _build10x10Templates();

/**
 * 多尺寸区域生成入口。
 * - N ≤ 9: 使用纯随机蛇形扩张
 * - N = 10: 使用模板变异（保证高概率唯一解）
 *
 * 关键不变量：
 *   - 每个格子只分配给正交相邻区域
 *   - 不存在非邻接 fallback
 *   - 每个区域正交连通
 */
function generateRegions(N, rand) {
  if (N <= 9) return _generateRegionsSmall(N, rand);
  return _generateRegionsTemplate(N, rand);
}

/** N ≤ 9: 纯随机蛇形扩张 */
function _generateRegionsSmall(N, rand) {
  const total = N * N;
  // 随机种子
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

  // 验证单个区域连通性（BFS 四向）
  function ridConnected(regs, rid) {
    let start = -1;
    for (let i = 0; i < total; i++) {
      if (regs[i] === rid) { start = i; break; }
    }
    if (start === -1) return false;
    const vis = new Set([start]);
    const q = [start];
    while (q.length) {
      const cur = q.shift();
      const r = Math.floor(cur / N), c = cur % N;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
        const ni = nr * N + nc;
        if (regs[ni] === rid && !vis.has(ni)) { vis.add(ni); q.push(ni); }
      }
    }
    // 计数应有格子数
    let expected = 0;
    for (let i = 0; i < total; i++) if (regs[i] === rid) expected++;
    return vis.size === expected;
  }

  const mutations = Math.floor(rand() * 12) + 4; // 4-15 次变异
  let applied = 0;
  let attempts = 0;
  const MAX_MUT_ATTEMPTS = 200;

  while (applied < mutations && attempts < MAX_MUT_ATTEMPTS) {
    attempts++;
    const cell = Math.floor(rand() * total);
    const r = Math.floor(cell / N);
    const c = cell % N;
    const oldRid = regions[cell];

    // 找相邻不同区域的格子
    const diffNeighbors = [];
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
      const ni = nr * N + nc;
      if (regions[ni] !== oldRid) diffNeighbors.push({ idx: ni, rid: regions[ni] });
    }
    if (diffNeighbors.length === 0) continue;

    const pick = diffNeighbors[Math.floor(rand() * diffNeighbors.length)];

    // 试交换 cell ↔ pick.idx
    const prevA = regions[cell];
    const prevB = regions[pick.idx];
    regions[cell] = pick.rid;
    regions[pick.idx] = oldRid;

    // 验证两个受影响区域的连通性
    if (ridConnected(regions, pick.rid) && ridConnected(regions, oldRid)) {
      applied++;
    } else {
      // 回滚
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

// ── Double-star generator using region templates ──
// Use real published level regions as templates, seed-controlled to produce variations

function getDoubleStarTemplates(N) {
  if (N !== 8) return [];
  // Use star-lv-21/22/23 region templates as bases (all have same solution)
  // These are known-valid connected regions with unique solutions
  return [
    [0,0,0,1,1,1,1,3,0,0,0,1,1,2,2,3,0,0,0,1,2,2,2,3,4,4,5,1,2,2,3,3,4,4,5,5,2,6,7,3,4,4,5,5,6,6,7,7,4,5,5,6,6,6,7,7,4,4,5,6,6,7,7,7],
    [0,0,1,1,1,2,3,3,0,0,1,1,2,2,3,3,0,0,0,1,2,2,3,3,4,0,5,1,2,2,3,3,4,5,5,5,6,2,7,7,4,4,5,6,6,2,7,7,4,4,5,5,6,7,7,7,4,4,6,6,6,6,7,7],
    [0,0,0,1,1,2,3,3,0,0,0,1,2,2,3,3,0,0,0,1,2,2,3,4,5,5,6,1,2,3,4,4,5,5,6,2,7,7,4,4,5,6,6,7,7,7,4,5,5,6,6,7,7,7,4,4,5,6,6,6,7,7,7,4],
  ];
}

function mutateRegions(baseRegions, N, rand) {
  // Apply seed-controlled mutations: swap a few boundary cells between adjacent regions
  const regions = [...baseRegions];
  const total = N * N;
  const swaps = Math.floor(rand() * 6) + 2; // 2-7 swaps

  for (let s = 0; s < swaps; s++) {
    const cell = Math.floor(rand() * total);
    const r = Math.floor(cell / N), c = cell % N;
    const oldRid = regions[cell];

    // Find adjacent cells belonging to a different region
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

  // Try mutations until we get a unique solution
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
        generationMetadata: { generatorVersion: '1.1.0', seed, parameters: { mode: 'starDouble', N, quota: 2, index }, attempts: attempt + 1 },
      };
    }
  }
  return null;
}

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
  const MAX_TOTAL=count*200;
  let totalAttempts=0, failReasons={};

  // Double-star: use solution-first generator
  if (quota === 2) {
    for (let i = 0; i < count; i++) {
      const cand = generateDoubleStarCandidate(N, seed, i);
      if (cand) { candidates.push(cand); }
      else { failReasons['maxed-out'] = (failReasons['maxed-out'] || 0) + 1; }
    }
  } else {
    // Single-star: use random region generation
    for (let i = 0; i < count; i++) {
      let ok = false;
      for (let a = 0; a < 200 && totalAttempts < MAX_TOTAL; a++, totalAttempts++) {
        const rand = mulberry32(seed + i * 31337 + a * 7919);
        const regions = generateRegions(N, rand);
        if (!allConnected(regions, N)) { failReasons['not-connected'] = (failReasons['not-connected'] || 0) + 1; continue; }
        const sr = solveStarLine(N, regions, { starsPerRow: quota, starsPerCol: quota, starsPerRegion: quota });
        if (sr.status !== 'UNIQUE') { failReasons[sr.status] = (failReasons[sr.status] || 0) + 1; continue; }
        candidates.push({
          candidateId: `star-single-${N}x${N}-s${seed}-i${i}`,
          seed, gameId: 'starSingle', N,
          starsPerRow: quota, starsPerCol: quota, starsPerRegion: quota,
          regions, solution: sr.solutions[0],
          generationMetadata: { generatorVersion: '1.1.0', seed, parameters: { mode: 'starSingle', N, quota, index: i }, attempts: a + 1 },
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

  const output={generatorVersion:'1.1.0',parameters:{mode,N,quota,count,seed},candidates};
  try{safeWriteJSON(outputPath,output,{force:!!args.force});}catch(e){console.error(e.message);process.exit(1);}
  console.log(`完成: ${candidates.length}/${count} 候选 (唯一解), 输出 ${outputPath}`);
}
main();
