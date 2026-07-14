#!/usr/bin/env node
/**
 * Star Line 候选关卡生成器。
 *
 * 用法:
 *   node scripts/generate-star-line-candidates.mjs --mode starSingle --size 5 --count 10 --seed 42 --output tmp/star-line-candidates/single-5x5.json
 *
 * 约束:
 *  - 支持 starSingle (quota=1) 与 starDouble (quota=2)
 *  - 支持 5×5 至 10×10
 *  - 可复现 seed (mulberry32 PRNG)
 *  - 不写正式关卡数据, 不修改 starLineLevels.js
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { solveStarLine } from './starLineSolver.mjs';

// ── CLI ──
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--?/, '');
    parsed[key] = args[i + 1];
  }
  return parsed;
}

function usage() {
  console.log(`用法: node scripts/generate-star-line-candidates.mjs [options]
选项:
  --mode    starSingle | starDouble (必需)
  --size    棋盘边长 5-10 (必需)
  --count   候选数量 (默认 10)
  --seed    随机种子 (默认 1)
  --output  输出 JSON 路径 (必需)
  --force   允许覆盖已有输出`);
  process.exit(1);
}

// ── PRNG ──
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ── Region generation ──
function seededShuffle(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateRandomRegions(N, rand) {
  const total = N * N;
  const cells = Array.from({ length: total }, (_, i) => i);
  const shuffled = seededShuffle(cells, rand);

  // Assign each cell to a region (0..N-1), roughly balanced
  const regions = new Array(total).fill(-1);
  const regionTarget = Math.ceil(total / N);

  // Seed N starting points
  const seeds = shuffled.slice(0, N);
  const regionCells = seeds.map(s => [s]);
  seeds.forEach((s, i) => { regions[s] = i; });

  // BFS grow from each seed
  const remaining = shuffled.filter(c => regions[c] === -1);
  const shuffledRemaining = seededShuffle(remaining, rand);

  for (const cell of shuffledRemaining) {
    // Find the smallest adjacent region
    const r = Math.floor(cell / N), c = cell % N;
    const adj = [];
    if (r > 0) { const n = cell - N; if (regions[n] >= 0) adj.push(regions[n]); }
    if (r < N - 1) { const n = cell + N; if (regions[n] >= 0) adj.push(regions[n]); }
    if (c > 0) { const n = cell - 1; if (regions[n] >= 0) adj.push(regions[n]); }
    if (c < N - 1) { const n = cell + 1; if (regions[n] >= 0) adj.push(regions[n]); }

    if (adj.length > 0) {
      // Pick smallest adjacent region
      const counts = {};
      for (const rid of adj) counts[rid] = (counts[rid] || 0) + 1;
      const sorted = Object.entries(counts).sort((a, b) => a[1] - b[1]);
      // Random among ties
      const minCount = sorted[0][1];
      const tied = sorted.filter(e => e[1] === minCount).map(e => Number(e[0]));
      const pick = tied[Math.floor(rand() * tied.length)];
      regions[cell] = pick;
      regionCells[pick].push(cell);
    } else {
      // Isolated cell — assign to smallest region
      let minSize = Infinity, minRid = 0;
      for (let i = 0; i < N; i++) {
        if (regionCells[i].length < minSize) { minSize = regionCells[i].length; minRid = i; }
      }
      regions[cell] = minRid;
      regionCells[minRid].push(cell);
    }
  }

  return regions;
}

function regionIsConnected(regions, N, rid) {
  const total = N * N;
  const cells = [];
  for (let i = 0; i < total; i++) if (regions[i] === rid) cells.push(i);
  if (cells.length === 0) return true;
  const visited = new Set();
  const queue = [cells[0]];
  visited.add(cells[0]);
  while (queue.length > 0) {
    const cur = queue.shift();
    const r = Math.floor(cur / N), c = cur % N;
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
      const nidx = nr * N + nc;
      if (regions[nidx] === rid && !visited.has(nidx)) {
        visited.add(nidx);
        queue.push(nidx);
      }
    }
  }
  return visited.size === cells.length;
}

function allRegionsConnected(regions, N) {
  for (let rid = 0; rid < N; rid++) {
    if (!regionIsConnected(regions, N, rid)) return false;
  }
  return true;
}

// ── Candidate generation ──
function generateCandidate(N, quota, seed, index) {
  const rand = mulberry32(seed + index * 31337);
  let regions, solverResult;
  let attempts = 0;
  const maxAttempts = 200;

  do {
    regions = generateRandomRegions(N, rand);
    if (!allRegionsConnected(regions, N)) { attempts++; continue; }

    solverResult = solveStarLine(N, regions, {
      starsPerRow: quota,
      starsPerCol: quota,
      starsPerRegion: quota,
    });

    attempts++;
  } while (solverResult?.status !== 'UNIQUE' && attempts < maxAttempts);

  if (!solverResult || solverResult.status !== 'UNIQUE') {
    return { status: 'failed', attempts, regions, solverResult };
  }

  return {
    status: 'ok',
    candidateId: `star-${quota === 1 ? 'single' : 'double'}-${N}x${N}-s${seed}-i${index}`,
    seed,
    gameId: quota === 1 ? 'starSingle' : 'starDouble',
    N,
    starsPerRow: quota,
    starsPerCol: quota,
    starsPerRegion: quota,
    regions,
    solution: solverResult.solutions[0],
    generationMetadata: {
      generatorVersion: '1.0.0',
      seed,
      generatedAt: new Date().toISOString(),
      parameters: { mode: quota === 1 ? 'starSingle' : 'starDouble', N, quota, index },
      attempts,
    },
    solverStats: solverResult.stats,
  };
}

// ── Main ──
function main() {
  const args = parseArgs();
  if (!args.mode || !args.size || !args.output) usage();

  const mode = args.mode;
  if (mode !== 'starSingle' && mode !== 'starDouble') {
    console.error('--mode 必须是 starSingle 或 starDouble');
    process.exit(1);
  }

  const N = parseInt(args.size, 10);
  if (isNaN(N) || N < 5 || N > 10) {
    console.error('--size 必须是 5-10 的整数');
    process.exit(1);
  }

  const count = parseInt(args.count || '10', 10);
  const seed = parseInt(args.seed || '1', 10);
  const outputPath = resolve(args.output);

  if (existsSync(outputPath) && !args.force) {
    console.error(`输出文件已存在: ${outputPath}。使用 --force 覆盖。`);
    process.exit(1);
  }

  const quota = mode === 'starSingle' ? 1 : 2;

  const candidates = [];
  for (let i = 0; i < count; i++) {
    const cand = generateCandidate(N, quota, seed, i);
    candidates.push(cand);
    if (cand.status === 'ok') {
      console.log(`[${i + 1}/${count}] ${cand.candidateId} ✓ (${cand.generationMetadata.attempts} 次尝试)`);
    } else {
      console.log(`[${i + 1}/${count}] FAILED after ${cand.generationMetadata?.attempts || '?'} attempts`);
    }
  }

  const output = {
    generatorVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    parameters: { mode, N, quota, count, seed },
    candidates,
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

  const ok = candidates.filter(c => c.status === 'ok').length;
  console.log(`\n完成: ${ok}/${count} 个候选 (唯一解), 输出到 ${outputPath}`);
}

main();
