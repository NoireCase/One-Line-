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

function generateRegions(N, rand) {
  const total=N*N, regions=new Array(total).fill(-1);
  const cells=Array.from({length:total},(_,i)=>i);
  const shuffled=seededShuffle(cells,rand);
  const seeds=shuffled.slice(0,N);
  seeds.forEach((s,i)=>{regions[s]=i;});
  const remaining=seededShuffle(shuffled.filter(c=>regions[c]===-1),rand);
  for(const cell of remaining){
    const r=Math.floor(cell/N),c=cell%N,adj=[];
    if(r>0){const n=cell-N;if(regions[n]>=0)adj.push(regions[n]);}
    if(r<N-1){const n=cell+N;if(regions[n]>=0)adj.push(regions[n]);}
    if(c>0){const n=cell-1;if(regions[n]>=0)adj.push(regions[n]);}
    if(c<N-1){const n=cell+1;if(regions[n]>=0)adj.push(regions[n]);}
    if(adj.length>0){const cnt={};adj.forEach(rid=>cnt[rid]=(cnt[rid]||0)+1);const sorted=Object.entries(cnt).sort((a,b)=>a[1]-b[1]);const minC=sorted[0][1];const tied=sorted.filter(e=>e[1]===minC).map(e=>Number(e[0]));regions[cell]=tied[Math.floor(rand()*tied.length)];}
    else{let minS=Infinity,minR=0;for(let i=0;i<N;i++){const sz=regions.filter(v=>v===i).length;if(sz<minS){minS=sz;minR=i;}}regions[cell]=minR;}
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
