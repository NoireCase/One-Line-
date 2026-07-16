/**
 * Star Line 单星开局多样性定向生成器。
 *
 * 两种策略都先固定一组满足行、列和不相邻规则的完整答案，再构造区域：
 *   A. answer-growth：从答案星位和目标行列锁骨架向外生长全部区域；
 *   B. controlled-reconstruction：保留现有关卡答案，按原区域归属偏好重构多个区域。
 *
 * 生成器只复用现有离线 solver、区域连通校验和动态开局分析，不改变正式玩法规则。
 */
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { STAR_LINE_LEVELS } from '../src/data/starLineLevels.js';
import { canonicalizeRegions } from './star-line-candidate-signatures.mjs';
import { analyzeDynamicOpening, DYNAMIC_OPENING_STATUS } from './star-line-dynamic-opening.mjs';
import { computeOpeningFingerprint } from './star-line-fingerprint.mjs';
import { validateRegions } from './star-line-macro-mutations.mjs';
import { solveStarLine } from './starLineSolver.mjs';

export const OPENING_DIVERSITY_STRATEGIES = Object.freeze({
  ANSWER_GROWTH: 'answer-growth',
  CONTROLLED_RECONSTRUCTION: 'controlled-reconstruction',
});

export const OPENING_DIVERSITY_TARGETS = Object.freeze({
  LINE_LOCK_1: 'line-lock-1',
  LINE_LOCK_2PLUS: 'line-lock-2plus',
  REGION_LINE_MIXED: 'region-line-mixed',
});

const ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const TARGET_CONFIG = Object.freeze({
  [OPENING_DIVERSITY_TARGETS.LINE_LOCK_1]: { chainLength: 1, seededRegionLock: false },
  [OPENING_DIVERSITY_TARGETS.LINE_LOCK_2PLUS]: { chainLength: 2, seededRegionLock: false },
  [OPENING_DIVERSITY_TARGETS.REGION_LINE_MIXED]: { chainLength: 2, seededRegionLock: true },
});

export function mulberry32(seed) {
  let state = seed | 0;
  return function random() {
    state |= 0;
    state = state + 0x6D2B79F5 | 0;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function shuffled(values, rand) {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function neighbors(idx, N) {
  const row = Math.floor(idx / N), column = idx % N;
  const out = [];
  for (const [dr, dc] of ORTHO) {
    const nextRow = row + dr, nextColumn = column + dc;
    if (nextRow >= 0 && nextRow < N && nextColumn >= 0 && nextColumn < N) {
      out.push(nextRow * N + nextColumn);
    }
  }
  return out;
}

function sameSolution(a, b) {
  return [...a].sort((x, y) => x - y).join(',') === [...b].sort((x, y) => x - y).join(',');
}

export function validateSingleStarSolution(N, solution) {
  if (!Array.isArray(solution) || solution.length !== N) return 'solution must contain N stars';
  const sorted = [...solution].sort((a, b) => a - b);
  if (new Set(sorted).size !== N) return 'solution contains duplicate cells';
  const rows = new Set(), columns = new Set();
  for (const idx of sorted) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= N * N) return `invalid solution cell ${idx}`;
    const row = Math.floor(idx / N), column = idx % N;
    if (rows.has(row)) return `row ${row} contains multiple stars`;
    if (columns.has(column)) return `column ${column} contains multiple stars`;
    rows.add(row); columns.add(column);
  }
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1], current = sorted[i];
    const previousRow = Math.floor(previous / N), currentRow = Math.floor(current / N);
    if (currentRow !== previousRow + 1) continue;
    if (Math.abs((current % N) - (previous % N)) <= 1) return `adjacent stars at ${previous}/${current}`;
  }
  return null;
}

export function generateLegalSingleStarSolution(N, rand) {
  const columns = new Array(N).fill(-1);
  const used = new Set();
  function place(row) {
    if (row === N) return true;
    for (const column of shuffled(Array.from({ length: N }, (_, i) => i), rand)) {
      if (used.has(column)) continue;
      if (row > 0 && Math.abs(columns[row - 1] - column) <= 1) continue;
      columns[row] = column;
      used.add(column);
      if (place(row + 1)) return true;
      used.delete(column);
      columns[row] = -1;
    }
    return false;
  }
  if (!place(0)) return null;
  return columns.map((column, row) => row * N + column);
}

function solutionRowsByColumn(N, solution) {
  const rows = new Array(N).fill(-1);
  for (const idx of solution) rows[idx % N] = Math.floor(idx / N);
  return rows;
}

function enumerateLayouts(N, solution, config, rand) {
  const { chainLength, seededRegionLock } = config;
  const rowsByColumn = solutionRowsByColumn(N, solution);
  const layouts = [];
  for (let low = 0; low + chainLength < N; low++) {
    for (const direction of [1, -1]) {
      const columns = direction === 1
        ? Array.from({ length: chainLength + 1 }, (_, i) => low + i)
        : Array.from({ length: chainLength + 1 }, (_, i) => low + chainLength - i);
      let valid = true;
      for (let i = 0; i <= chainLength; i++) {
        const starRow = rowsByColumn[columns[i]];
        if (starRow < chainLength - i) valid = false;
        if (seededRegionLock && starRow === N - 1) valid = false;
      }
      if (!valid) continue;
      if (seededRegionLock) {
        const bottomStarColumn = solution.find((idx) => Math.floor(idx / N) === N - 1) % N;
        if (columns.includes(bottomStarColumn)) continue;
        const outsideRuns = [];
        let run = [];
        for (let column = 0; column < N; column++) {
          if (columns.includes(column)) {
            if (run.length) outsideRuns.push(run);
            run = [];
          } else run.push(column);
        }
        if (run.length) outsideRuns.push(run);
        const containing = outsideRuns.find((entry) => entry.includes(bottomStarColumn));
        if (!containing || containing.length < 2) continue;
      }
      layouts.push({ columns, rowsByColumn });
    }
  }
  return shuffled(layouts, rand);
}

function seedRowSegment(N, chainColumns, bottomStarColumn) {
  const allowed = new Set(Array.from({ length: N }, (_, i) => i).filter((column) => !chainColumns.includes(column)));
  const cells = [bottomStarColumn];
  for (const direction of [-1, 1]) {
    const next = bottomStarColumn + direction;
    if (allowed.has(next)) cells.push(next);
    if (cells.length >= 3) break;
  }
  if (cells.length < 2) return null;
  return cells.sort((a, b) => a - b).map((column) => (N - 1) * N + column);
}

function chooseWeightedLabel(labels, sizes, preferred, rand) {
  const weighted = labels.map((label) => {
    const balance = 1 / Math.pow((sizes[label] || 0) + 1, 1.35);
    return { label, weight: balance * (label === preferred ? 5 : 1) };
  });
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = rand() * total;
  for (const entry of weighted) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.label;
  }
  return weighted.at(-1).label;
}

function growRemainingCells(N, regions, lockedSeedLabel, originalPreference, rand) {
  const unassigned = new Set();
  const sizes = new Array(N).fill(0);
  for (let idx = 0; idx < regions.length; idx++) {
    if (regions[idx] === -1) unassigned.add(idx);
    else sizes[regions[idx]]++;
  }

  while (unassigned.size > 0) {
    const frontier = [];
    for (const cell of unassigned) {
      const labels = [...new Set(neighbors(cell, N).map((idx) => regions[idx]).filter((label) => label >= 0))]
        .filter((label) => label !== lockedSeedLabel || Math.floor(cell / N) === N - 1);
      if (labels.length > 0) frontier.push({ cell, labels });
    }
    if (frontier.length === 0) return false;
    frontier.sort((a, b) => a.labels.length - b.labels.length || a.cell - b.cell);
    const narrowCount = frontier.findIndex((entry) => entry.labels.length > frontier[0].labels.length);
    const poolSize = narrowCount === -1 ? frontier.length : narrowCount;
    const pick = frontier[Math.floor(rand() * poolSize)];
    const preferred = originalPreference?.[pick.cell] ?? null;
    const label = chooseWeightedLabel(pick.labels, sizes, preferred, rand);
    regions[pick.cell] = label;
    sizes[label]++;
    unassigned.delete(pick.cell);
  }
  return sizes.every((size) => size >= 2);
}

function buildOriginalPreference(baseLevel, solution, starLabelByCell) {
  if (!baseLevel) return null;
  const oldToNew = new Map();
  for (const star of solution) oldToNew.set(baseLevel.regions[star], starLabelByCell.get(star));
  return baseLevel.regions.map((oldLabel) => oldToNew.get(oldLabel) ?? null);
}

function labelComponents(regions, N, label) {
  const cells = regions.map((value, idx) => value === label ? idx : -1).filter((idx) => idx >= 0);
  const remaining = new Set(cells), components = [];
  while (remaining.size > 0) {
    const start = remaining.values().next().value;
    const component = [], queue = [start];
    remaining.delete(start);
    while (queue.length > 0) {
      const cell = queue.shift();
      component.push(cell);
      for (const next of neighbors(cell, N)) {
        if (remaining.has(next)) { remaining.delete(next); queue.push(next); }
      }
    }
    components.push(component);
  }
  return components;
}

function repairDisconnectedComponents(regions, N, solution, fixedCells, lockedSeedLabel, rand) {
  const starByLabel = new Map(solution.map((star) => [regions[star], star]));
  for (let round = 0; round < N * 2; round++) {
    let changed = false;
    for (const label of [...new Set(regions)]) {
      const components = labelComponents(regions, N, label);
      if (components.length <= 1) continue;
      const star = starByLabel.get(label);
      const keep = components.find((component) => component.includes(star));
      if (!keep) return false;
      for (const component of components) {
        if (component === keep) continue;
        if (component.some((cell) => fixedCells.has(cell))) return false;
        const boundary = new Map();
        for (const cell of component) {
          for (const next of neighbors(cell, N)) {
            const nextLabel = regions[next];
            if (nextLabel === label) continue;
            if (nextLabel === lockedSeedLabel && component.some((entry) => Math.floor(entry / N) !== N - 1)) continue;
            boundary.set(nextLabel, (boundary.get(nextLabel) || 0) + 1);
          }
        }
        if (boundary.size === 0) return false;
        const ranked = [...boundary.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
        const bestScore = ranked[0][1];
        const choices = ranked.filter((entry) => entry[1] === bestScore).map((entry) => entry[0]);
        const replacement = choices[Math.floor(rand() * choices.length)];
        for (const cell of component) regions[cell] = replacement;
        changed = true;
      }
    }
    if (!changed) return validateRegions(regions, N) === null;
  }
  return validateRegions(regions, N) === null;
}

function constructControlledReconstruction({ N, solution, config, layout, baseLevel, rand }) {
  const { columns, rowsByColumn } = layout;
  const { chainLength, seededRegionLock } = config;
  const regions = [...baseLevel.regions];
  const fixedCells = new Set();
  const logicalLabels = [];
  for (let i = 0; i <= chainLength; i++) {
    const star = rowsByColumn[columns[i]] * N + columns[i];
    logicalLabels[i] = baseLevel.regions[star];
  }
  let lockedSeedLabel = null;
  const assign = (cell, label) => {
    if (solution.includes(cell) && baseLevel.regions[cell] !== label) return false;
    regions[cell] = label;
    fixedCells.add(cell);
    return true;
  };

  for (let i = 1; i <= chainLength; i++) {
    const column = columns[i];
    for (let row = 0; row < N; row++) {
      let logical = i;
      for (let higher = i + 1; higher <= chainLength; higher++) {
        if (row === chainLength - higher) logical = higher;
      }
      if (!assign(row * N + column, logicalLabels[logical])) return null;
    }
  }
  const terminalStar = rowsByColumn[columns[0]] * N + columns[0];
  for (let row = 0; row < N; row++) {
    const cell = row * N + columns[0];
    if (cell === terminalStar) {
      if (!assign(cell, logicalLabels[0])) return null;
      continue;
    }
    let logical = 1;
    for (let higher = 2; higher <= chainLength; higher++) {
      if (row === chainLength - higher) logical = higher;
    }
    if (!assign(cell, logicalLabels[logical])) return null;
  }

  if (seededRegionLock) {
    const bottomStar = solution.find((idx) => Math.floor(idx / N) === N - 1);
    lockedSeedLabel = baseLevel.regions[bottomStar];
    const seedCells = seedRowSegment(N, columns, bottomStar % N);
    if (!seedCells) return null;
    for (const cell of seedCells) if (!assign(cell, lockedSeedLabel)) return null;
    for (const column of columns) {
      if (!assign((N - 1) * N + column, logicalLabels[1])) return null;
    }
  }

  for (const star of solution) if (regions[star] !== baseLevel.regions[star]) return null;
  if (!repairDisconnectedComponents(regions, N, solution, fixedCells, lockedSeedLabel, rand)) return null;
  return regions;
}

/**
 * 从完整答案反向搭出目标锁链，再生长其余区域。返回 null 表示本次布局不适用。
 */
export function constructOpeningDiversityRegions({ N, solution, target, rand, baseLevel = null }) {
  const config = TARGET_CONFIG[target];
  if (!config) throw new Error(`unknown opening target: ${target}`);
  if (validateSingleStarSolution(N, solution)) return null;
  const layouts = enumerateLayouts(N, solution, config, rand);
  if (layouts.length === 0) return null;
  const { columns, rowsByColumn } = layouts[0];
  const { chainLength, seededRegionLock } = config;
  if (baseLevel) {
    return constructControlledReconstruction({
      N, solution, config, layout: { columns, rowsByColumn }, baseLevel, rand,
    });
  }
  const regions = new Array(N * N).fill(-1);
  const starLabelByCell = new Map();

  // 终点列使用 R0；每一条锁列依次使用 R1..Rk。
  const terminalStar = rowsByColumn[columns[0]] * N + columns[0];
  starLabelByCell.set(terminalStar, 0);
  regions[terminalStar] = 0;
  for (let i = 1; i <= chainLength; i++) {
    const star = rowsByColumn[columns[i]] * N + columns[i];
    starLabelByCell.set(star, i);
  }

  // 柱 i 在更高编号区域被依次排除后，只剩区域 Ri。
  for (let i = 1; i <= chainLength; i++) {
    const column = columns[i];
    for (let row = 0; row < N; row++) {
      let label = i;
      for (let higher = i + 1; higher <= chainLength; higher++) {
        const corridorRow = chainLength - higher;
        if (row === corridorRow) label = higher;
      }
      regions[row * N + column] = label;
    }
  }

  // 终点列：高编号区域各留一条连通走廊，其余非目标格由 R1 收口。
  for (let row = 0; row < N; row++) {
    const cell = row * N + columns[0];
    if (cell === terminalStar) continue;
    let label = 1;
    for (let higher = 2; higher <= chainLength; higher++) {
      if (row === chainLength - higher) label = higher;
    }
    regions[cell] = label;
  }

  let nextLabel = chainLength + 1;
  let lockedSeedLabel = null;
  if (seededRegionLock) {
    lockedSeedLabel = nextLabel++;
    const bottomStar = solution.find((idx) => Math.floor(idx / N) === N - 1);
    const seedCells = seedRowSegment(N, columns, bottomStar % N);
    if (!seedCells) return null;
    for (const cell of seedCells) regions[cell] = lockedSeedLabel;
    starLabelByCell.set(bottomStar, lockedSeedLabel);
    // 底行锁产生前，最远锁列必须含有另一星域候选；统一接到 R1 保持连通。
    for (const column of columns) regions[(N - 1) * N + column] = 1;
  }

  // 其余答案星各自成为一个区域锚点。
  for (const star of solution) {
    if (starLabelByCell.has(star)) continue;
    if (regions[star] !== -1) return null;
    starLabelByCell.set(star, nextLabel);
    regions[star] = nextLabel++;
  }
  if (nextLabel !== N) return null;

  // 校验预制骨架没有把答案星放入错误区域。
  for (const [star, label] of starLabelByCell) {
    if (regions[star] !== label) return null;
  }

  const originalPreference = buildOriginalPreference(baseLevel, solution, starLabelByCell);
  if (!growRemainingCells(N, regions, lockedSeedLabel, originalPreference, rand)) return null;
  if (validateRegions(regions, N) !== null) return null;
  for (const star of solution) {
    if (regions.filter((label, idx) => label === regions[star] && solution.includes(idx)).length !== 1) return null;
  }
  return regions;
}

function matchesTargetMechanism(target, dynamic) {
  if (!dynamic.openingFamily.endsWith('TO_LINE_SINGLETON')) return false;
  const byId = new Map(dynamic.events.map((event) => [event.id, event]));
  const spineTypes = dynamic.causalSpine.map((id) => byId.get(id)?.type).filter(Boolean);
  const lineLocks = spineTypes.filter((type) => type === 'ROW_LOCK_REGION' || type === 'COLUMN_LOCK_REGION').length;
  const regionLocks = spineTypes.filter((type) => type === 'REGION_LOCK_ROW' || type === 'REGION_LOCK_COLUMN').length;
  if (target === OPENING_DIVERSITY_TARGETS.LINE_LOCK_1) return lineLocks === 1;
  if (target === OPENING_DIVERSITY_TARGETS.LINE_LOCK_2PLUS) return lineLocks >= 2;
  return lineLocks >= 1 && regionLocks >= 1;
}

function boundaryTransferOptions(cell, regions, N, targetSet, rand) {
  const from = regions[cell];
  const queue = [cell], parent = new Map([[cell, null]]), options = [];
  while (queue.length > 0) {
    const current = queue.shift();
    const path = [];
    for (let cursor = current; cursor !== null; cursor = parent.get(cursor)) path.push(cursor);
    for (const next of neighbors(current, N)) {
      if (regions[next] !== from) {
        options.push({ path, from, to: regions[next] });
        continue;
      }
      if (parent.has(next) || targetSet.has(next)) continue;
      parent.set(next, current);
      queue.push(next);
    }
  }
  const unique = new Map();
  for (const option of options) {
    const key = `${option.to}:${[...option.path].sort((a, b) => a - b).join(',')}`;
    if (!unique.has(key)) unique.set(key, option);
  }
  return shuffled([...unique.values()], rand).sort((a, b) => a.path.length - b.path.length);
}

function strengthenUniqueness(N, inputRegions, targetSolution, target, rand, maxRounds = 24) {
  let regions = [...inputRegions];
  const targetSet = new Set(targetSolution);
  const steps = [];
  for (let round = 0; round <= maxRounds; round++) {
    const solved = solveStarLine(N, regions, { starsPerRow: 1, starsPerCol: 1, starsPerRegion: 1 });
    if (solved.status === 'UNIQUE') return { regions, solved, steps };
    if (solved.status !== 'MULTIPLE' || round === maxRounds) return { regions, solved, steps };
    const alternate = solved.solutions.find((solution) => !sameSolution(solution, targetSolution));
    if (!alternate) return { regions, solved, steps };
    let accepted = false;
    for (const cell of shuffled(alternate.filter((idx) => !targetSet.has(idx)), rand)) {
      for (const option of boundaryTransferOptions(cell, regions, N, targetSet, rand)) {
        const next = [...regions];
        for (const pathCell of option.path) next[pathCell] = option.to;
        if (validateRegions(next, N) !== null) continue;
        const dynamic = analyzeDynamicOpening(N, next, { quota: 1 });
        if (!matchesTargetMechanism(target, dynamic)) continue;
        regions = next;
        steps.push({ cells: [...option.path], from: option.from, to: option.to });
        accepted = true;
        break;
      }
      if (accepted) break;
    }
    if (!accepted) return { regions, solved, steps };
  }
  return { regions, solved: solveStarLine(N, regions), steps };
}

export function validateOpeningDiversityCandidate({ N, regions, targetSolution, target }) {
  const regionError = validateRegions(regions, N);
  if (regionError) return { valid: false, reason: `regions:${regionError}` };
  const solved = solveStarLine(N, regions, { starsPerRow: 1, starsPerCol: 1, starsPerRegion: 1 });
  if (solved.status !== 'UNIQUE') return { valid: false, reason: solved.status, solved };
  if (!sameSolution(solved.solutions[0], targetSolution)) {
    return { valid: false, reason: 'solution-changed', solved };
  }
  const dynamic = analyzeDynamicOpening(N, regions, { quota: 1 });
  if (dynamic.status === DYNAMIC_OPENING_STATUS.SHORT_CONTRADICTION
    || dynamic.status === DYNAMIC_OPENING_STATUS.OPENING_DEPTH_CAP) {
    return { valid: false, reason: dynamic.status, solved, dynamic };
  }
  if (!matchesTargetMechanism(target, dynamic)) {
    return { valid: false, reason: `target-miss:${dynamic.openingFamily}`, solved, dynamic };
  }
  return { valid: true, solved, dynamic };
}

function resolveBaseLevels(N, baseLevels) {
  return (baseLevels ?? []).filter((level) => level.N === N && level.gameId === 'starSingle');
}

/**
 * 运行一个受控批次。maxStructures 只计算已通过答案/区域基础校验、真正进入 solver 的结构。
 */
export function generateOpeningDiversityBatch({
  N,
  seed,
  strategy,
  target,
  count,
  maxStructures = 80,
  baseLevels = [],
  existingExactSignatures = new Set(),
  existingRegionSignatures = new Set(),
}) {
  if (!Object.values(OPENING_DIVERSITY_STRATEGIES).includes(strategy)) throw new Error(`unknown strategy: ${strategy}`);
  if (!TARGET_CONFIG[target]) throw new Error(`unknown target: ${target}`);
  const usableBases = resolveBaseLevels(N, baseLevels);
  if (strategy === OPENING_DIVERSITY_STRATEGIES.CONTROLLED_RECONSTRUCTION && usableBases.length === 0) {
    throw new Error(`controlled-reconstruction requires N=${N} base levels`);
  }

  const candidates = [];
  const seenExact = new Set(existingExactSignatures);
  const seenRegions = new Set(existingRegionSignatures);
  const stats = { attempted: 0, baseValidStructures: 0, unique: 0, failures: {} };
  const maxAttempts = maxStructures * 10;
  const fail = (reason) => { stats.failures[reason] = (stats.failures[reason] || 0) + 1; };

  while (stats.baseValidStructures < maxStructures && candidates.length < count && stats.attempted < maxAttempts) {
    const attempt = stats.attempted++;
    const rand = mulberry32(seed + attempt * 7919);
    const baseLevel = strategy === OPENING_DIVERSITY_STRATEGIES.CONTROLLED_RECONSTRUCTION
      ? usableBases[attempt % usableBases.length]
      : null;
    const solution = baseLevel ? [...baseLevel.solution] : generateLegalSingleStarSolution(N, rand);
    if (!solution) { fail('no-solution-layout'); continue; }
    const constructed = constructOpeningDiversityRegions({ N, solution, target, rand, baseLevel });
    if (!constructed) { fail('construction'); continue; }
    stats.baseValidStructures++;

    const strengthened = strengthenUniqueness(N, constructed, solution, target, rand);
    const regions = strengthened.regions;
    const regionSignature = canonicalizeRegions(regions, N);
    if (seenRegions.has(regionSignature)) { fail('duplicate-region-d4'); continue; }
    const validation = validateOpeningDiversityCandidate({ N, regions, targetSolution: solution, target });
    if (!validation.valid) { fail(validation.reason); continue; }
    if (seenExact.has(validation.dynamic.exactDynamicSignature)) { fail('duplicate-dynamic-exact'); continue; }

    seenRegions.add(regionSignature);
    seenExact.add(validation.dynamic.exactDynamicSignature);
    stats.unique++;
    candidates.push({
      candidateId: `opening-${strategy}-n${N}-${target}-s${seed}-i${attempt}`,
      strategy,
      target,
      sourceLevelId: baseLevel?.id ?? null,
      N,
      starsPerRow: 1,
      starsPerCol: 1,
      starsPerRegion: 1,
      regions,
      solution: validation.solved.solutions[0],
      openingFingerprint: computeOpeningFingerprint(N, regions, 1).fingerprint,
      canonicalRegionSignature: regionSignature,
      dynamicOpening: validation.dynamic,
      solverStats: validation.solved.stats,
      uniquenessStrengtheningSteps: strengthened.steps,
    });
  }

  return { candidates, stats, parameters: { N, seed, strategy, target, count, maxStructures } };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    args[key] = argv[i + 1]?.startsWith('--') || argv[i + 1] === undefined ? true : argv[++i];
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const N = Number(args.size), count = Number(args.count ?? 8), seed = Number(args.seed ?? 1);
  const maxStructures = Number(args['max-structures'] ?? 80);
  const strategy = args.strategy ?? OPENING_DIVERSITY_STRATEGIES.ANSWER_GROWTH;
  const target = args.target ?? OPENING_DIVERSITY_TARGETS.LINE_LOCK_2PLUS;
  if (!Number.isInteger(N) || N < 5 || N > 10 || !Number.isInteger(count) || count < 1) {
    throw new Error('usage: --size 5..10 --count N --strategy answer-growth|controlled-reconstruction --target line-lock-1|line-lock-2plus|region-line-mixed [--base-ids id,id] [--output file]');
  }
  const requestedIds = String(args['base-ids'] ?? '').split(',').filter(Boolean);
  const baseLevels = requestedIds.length
    ? requestedIds.map((id) => STAR_LINE_LEVELS.find((level) => level.id === id)).filter(Boolean)
    : STAR_LINE_LEVELS.filter((level) => level.gameId === 'starSingle' && level.N === N);
  const result = generateOpeningDiversityBatch({ N, seed, strategy, target, count, maxStructures, baseLevels });
  const summary = {
    generatorVersion: 'opening-diversity/v1',
    parameters: result.parameters,
    stats: result.stats,
    candidates: result.candidates,
  };
  if (args.output) writeFileSync(args.output, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ parameters: result.parameters, stats: result.stats, output: args.output ?? null }, null, 2));
  if (result.candidates.length < count) process.exitCode = 2;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
